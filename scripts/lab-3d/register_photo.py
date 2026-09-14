"""Register a single aerial photograph of Hashima to the 1962 crop.

First try SIFT. Photos from other seasons defeat it (January 1975 has long shadows where May 1962
had short ones), so fall back to the island itself: line up the two island outlines with a
similarity transform, then refine with ECC on edge images, which follows the sea wall and the
building outlines rather than the shadows.
"""
import math

import cv2
import numpy as np
from scipy import ndimage


def largest(m):
    m = ndimage.binary_closing(m, structure=np.ones((9, 9)))
    m = ndimage.binary_opening(m, structure=np.ones((5, 5)))
    m = ndimage.binary_fill_holes(m)
    lab, n = ndimage.label(m)
    if n == 0:
        return m
    return lab == (1 + int(np.argmax(ndimage.sum(m, lab, range(1, n + 1)))))


def island_mask(img):
    """Island = bright or textured against a darker, smoother sea (works for grey and colour)."""
    if img.ndim == 3:
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        sat = cv2.GaussianBlur(hsv[..., 1], (0, 0), 2.0)
        t, _ = cv2.threshold(sat, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        grey = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        m_col = sat < t
    else:
        grey, m_col = img, None
    blur = cv2.GaussianBlur(grey, (0, 0), 2.0).astype(np.float32)
    mean = cv2.boxFilter(blur, -1, (21, 21))
    std = np.sqrt(np.maximum(cv2.boxFilter(blur * blur, -1, (21, 21)) - mean * mean, 0))
    t_int, _ = cv2.threshold(blur.astype(np.uint8), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    m = (blur > t_int) | (std > 14)
    if m_col is not None:
        m = m & m_col if (m & m_col).sum() > 0.3 * m.sum() else m
    return largest(m)


def edges(img):
    g = cv2.GaussianBlur(img.astype(np.float32), (0, 0), 1.5)
    mag = cv2.magnitude(cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1))
    return mag / (np.percentile(mag, 99) + 1e-6)


def outline_similarity(ms, md, shape_d):
    """Similarity (source px -> destination px) that lines up two island masks; tries both 180-degree choices."""
    def stats(m):
        ys, xs = np.nonzero(m)
        c = np.array([xs.mean(), ys.mean()])
        evals, evecs = np.linalg.eigh(np.cov(np.vstack([xs - c[0], ys - c[1]])))
        major = evecs[:, 1]
        return c, math.atan2(major[1], major[0]), math.sqrt(m.sum())
    cs, a_s, ss = stats(ms)
    cd, a_d, sd = stats(md)
    k = sd / ss
    best = None
    for flip in (0.0, math.pi):
        ang = a_d - a_s + flip
        R = k * np.array([[math.cos(ang), -math.sin(ang)], [math.sin(ang), math.cos(ang)]])
        t = cd - R @ cs
        M = np.array([[R[0, 0], R[0, 1], t[0]], [R[1, 0], R[1, 1], t[1]], [0, 0, 1.0]])
        warped = cv2.warpPerspective(ms.astype(np.uint8), M, (shape_d[1], shape_d[0]), flags=cv2.INTER_NEAREST).astype(bool)
        iou = (warped & md).sum() / max(1, (warped | md).sum())
        if best is None or iou > best[1]:
            best = (M, iou)
    return best


def sift_h(src, dst, dst_mask=None, ratio=0.75, thresh=4.0):
    sift = cv2.SIFT_create(contrastThreshold=0.015)
    ks, ds = sift.detectAndCompute(src, None)
    kd, dd = sift.detectAndCompute(dst, dst_mask)
    if ds is None or dd is None:
        return None, 0
    knn = cv2.FlannBasedMatcher(dict(algorithm=1, trees=5), dict(checks=128)).knnMatch(ds, dd, k=2)
    good = [p[0] for p in knn if len(p) == 2 and p[0].distance < ratio * p[1].distance]
    if len(good) < 10:
        return None, len(good)
    ps = np.float32([ks[m.queryIdx].pt for m in good])
    pd = np.float32([kd[m.trainIdx].pt for m in good])
    H, inl = cv2.findHomography(ps, pd, cv2.USAC_MAGSAC, thresh, maxIters=50000, confidence=0.999)
    return H, (int(inl.sum()) if H is not None else 0)


def register(src, dst_grey, dst_island, min_inliers=25):
    """Return (H, report): H maps source px to destination (1962 crop) px."""
    grey = cv2.cvtColor(src, cv2.COLOR_BGR2GRAY) if src.ndim == 3 else src
    near = ndimage.binary_dilation(dst_island, iterations=40)
    H, n = sift_h(grey, dst_grey, (near * 255).astype(np.uint8))
    if H is not None and n >= min_inliers:
        return H, {'method': 'sift', 'inliers': n}
    ms = island_mask(src)
    M0, iou0 = outline_similarity(ms, dst_island, dst_grey.shape)
    # ECC: warp maps template (destination) px to input (source) px.
    W = np.linalg.inv(M0).astype(np.float32)
    template, image = edges(dst_grey), edges(grey)
    # OpenCV's mask marks valid pixels of the input (source) image, so build it from the source island.
    mask = (ndimage.binary_dilation(ms, iterations=40) * 255).astype(np.uint8)
    criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-6)
    try:
        cc, W = cv2.findTransformECC(template, image, W, cv2.MOTION_HOMOGRAPHY, criteria, mask, 5)
    except cv2.error as e:
        return M0, {'method': 'outline', 'sift_inliers': n, 'iou': round(float(iou0), 3), 'ecc': str(e)[:80]}
    H = np.linalg.inv(W.astype(np.float64))
    warped = cv2.warpPerspective(ms.astype(np.uint8), H, (dst_grey.shape[1], dst_grey.shape[0]), flags=cv2.INTER_NEAREST).astype(bool)
    iou = (warped & dst_island).sum() / max(1, (warped | dst_island).sum())
    return H, {'method': 'outline+ecc', 'sift_inliers': n, 'iou_outline': round(float(iou0), 3), 'iou': round(float(iou), 3), 'ecc_cc': round(float(cc), 3)}
