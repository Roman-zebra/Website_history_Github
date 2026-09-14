"""Two-view stereo test for Hashima (Gunkanjima).

Photos: GSI aerial photographs MKU628 C18-2 and C18-3, 1962-05-30, RMK camera,
focal length 152.670 mm, scanned at 400 dpi.

Plane + parallax: photo 2 is warped onto photo 3 with a RANSAC homography, both
crops are turned so the remaining parallax runs along x, and semi-global
matching measures it. Photo 3 is the reference because Hashima sits near its
centre, so it is close to a vertical view of the island.
"""
import json
import math
from pathlib import Path

import cv2
import numpy as np
from scipy import ndimage

HERE = Path(__file__).resolve().parent
PHOTOS = HERE / 'photos'
OUT = HERE / 'out'
OUT.mkdir(exist_ok=True)

F_MM = 152.670
PITCH_MM = 25.4 / 400
F_PX = F_MM / PITCH_MM

# Hashima centre in photo 3, read off the 900 px preview (475, 420) scaled by 4087/900.
HASHIMA_3 = np.array([2157.0, 1907.0])
FINAL_W, FINAL_H = 1024, 1024  # power of two: the crop is also the WebGL texture
# Fiducial notches in photo 3 (preview estimates scaled to full size).
FIDUCIALS_3 = {'top': (1916, 114), 'bottom': (1907, 3646), 'left': (145, 1853), 'right': (3687, 1853)}


def imread(p):
    img = cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_GRAYSCALE)
    assert img is not None, p
    return img


def imwrite(p, img):
    ok, buf = cv2.imencode(Path(p).suffix, img)
    assert ok, p
    buf.tofile(str(p))


def fiducial_offsets(img3, img2, half=150, search=220):
    out = {}
    for name, (x, y) in FIDUCIALS_3.items():
        x0, y0 = max(0, x - half), max(0, y - half)
        tpl = img3[y0:y + half, x0:x + half]
        sx0, sy0 = max(0, x0 - search), max(0, y0 - search)
        win = img2[sy0:y + half + search, sx0:x + half + search]
        res = cv2.matchTemplate(win, tpl, cv2.TM_CCOEFF_NORMED)
        _, score, _, loc = cv2.minMaxLoc(res)
        out[name] = {'dx': sx0 + loc[0] - x0, 'dy': sy0 + loc[1] - y0, 'score': round(float(score), 3)}
    return out


def sift_matches(a, b):
    mask = np.zeros_like(a)
    mask[150:3650, 180:3680] = 255
    sift = cv2.SIFT_create(contrastThreshold=0.02)
    ka, da = sift.detectAndCompute(a, mask)
    kb, db = sift.detectAndCompute(b, mask)
    flann = cv2.FlannBasedMatcher(dict(algorithm=1, trees=5), dict(checks=96))
    knn = flann.knnMatch(da, db, k=2)
    good = [p[0] for p in knn if len(p) == 2 and p[0].distance < 0.75 * p[1].distance]
    pa = np.float32([ka[m.queryIdx].pt for m in good])
    pb = np.float32([kb[m.trainIdx].pt for m in good])
    print(f'SIFT features: photo3 {len(ka)}, photo2 {len(kb)}; ratio-test matches {len(good)}')
    return pa, pb


def apply_h(H, pts):
    pts = np.asarray(pts, np.float64).reshape(-1, 2)
    q = np.c_[pts, np.ones(len(pts))] @ H.T
    return q[:, :2] / q[:, 2:3]


def island_mask(img):
    blur = cv2.GaussianBlur(img, (0, 0), 2.0).astype(np.float32)
    mean = cv2.boxFilter(blur, -1, (21, 21))
    sq = cv2.boxFilter(blur * blur, -1, (21, 21))
    std = np.sqrt(np.maximum(sq - mean * mean, 0))
    t_int, _ = cv2.threshold(blur.astype(np.uint8), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    m = (blur > t_int) | (std > 14)
    m = ndimage.binary_closing(m, structure=np.ones((9, 9)))
    m = ndimage.binary_opening(m, structure=np.ones((5, 5)))
    m = ndimage.binary_fill_holes(m)
    lab, n = ndimage.label(m)
    if n == 0:
        return m, t_int
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    return lab == (1 + int(np.argmax(sizes))), t_int


def main():
    print('OpenCV', cv2.__version__, 'ximgproc' if hasattr(cv2, 'ximgproc') else 'no ximgproc')
    img2 = imread(PHOTOS / 'MKU628-C18-2.jpg')
    img3 = imread(PHOTOS / 'MKU628-C18-3.jpg')

    # Data strip (altimeter, clock, level) so the flying height can be read by eye.
    imwrite(OUT / 'strip_3.png', img3[900:3000, 3700:4087])

    fid = fiducial_offsets(img3, img2)
    print('fiducial offsets photo2 - photo3:', fid)
    scan_off = np.array([np.median([v['dx'] for v in fid.values()]), np.median([v['dy'] for v in fid.values()])])

    cache = OUT / 'matches.npz'
    if cache.exists():
        z = np.load(cache)
        p3, p2 = z['p3'], z['p2']
    else:
        p3, p2 = sift_matches(img3, img2)
        np.savez(cache, p3=p3, p2=p2)

    Fm, inl_f = cv2.findFundamentalMat(p3, p2, cv2.USAC_MAGSAC, 1.5, 0.9999, 100000)
    inl_f = inl_f.ravel().astype(bool)
    q3, q2 = p3[inl_f], p2[inl_f]
    print('F inliers', int(inl_f.sum()), 'of', len(p3))
    near = np.all(np.abs(q3 - HASHIMA_3) < 450, axis=1)
    print('F inliers on Hashima window', int(near.sum()))

    Hm, inl_h = cv2.findHomography(q3, q2, cv2.RANSAC, 4.0, maxIters=100000, confidence=0.9999)
    inl_h = inl_h.ravel().astype(bool)
    print('plane inliers', int(inl_h.sum()), 'of F inliers', len(q3))

    # Epipole in photo 3: F e3 = 0 (cv2 convention p2^T F p3 = 0).
    _, _, vt = np.linalg.svd(Fm)
    e3 = vt[-1]
    if abs(e3[2]) > 1e-12 and np.linalg.norm(e3[:2] / e3[2]) < 1e7:
        v = e3[:2] / e3[2] - HASHIMA_3
        print('epipole photo3 at', e3[:2] / e3[2], 'distance', np.linalg.norm(v))
    else:
        v = e3[:2]
        print('epipole photo3 at infinity')
    ang = math.atan2(v[1], v[0])
    if ang > math.pi / 2:
        ang -= math.pi
    if ang <= -math.pi / 2:
        ang += math.pi

    # Residual parallax direction from the matches as a cross-check.
    res = apply_h(np.linalg.inv(Hm), q2) - q3
    big = np.linalg.norm(res, axis=1) > 3
    if big.sum() > 10:
        u, s, wt = np.linalg.svd(res[big] - 0, full_matrices=False)
        d = wt[0]
        ang_pca = math.atan2(d[1], d[0])
        print('parallax direction: epipole %.2f deg, residual PCA %.2f deg (n=%d)' % (math.degrees(ang), math.degrees(ang_pca), big.sum()))

    c, s_ = math.cos(ang), math.sin(ang)
    rot_inv = np.array([[c, -s_, 0], [s_, c, 0], [0, 0, 1]])
    A3 = np.array([[1, 0, HASHIMA_3[0]], [0, 1, HASHIMA_3[1]], [0, 0, 1]]) @ rot_inv @ np.array([[1, 0, -FINAL_W / 2], [0, 1, -FINAL_H / 2], [0, 0, 1]])
    A2 = Hm @ A3
    L = cv2.warpPerspective(img3, A3, (FINAL_W, FINAL_H), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP)
    R = cv2.warpPerspective(img2, A2, (FINAL_W, FINAL_H), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP)
    imwrite(OUT / 'rect_L.png', L)
    imwrite(OUT / 'rect_R.png', R)
    ana = np.dstack([R, R, L])  # BGR: red = photo 3, cyan = photo 2
    imwrite(OUT / 'debug_anaglyph.jpg', ana)

    uL = apply_h(np.linalg.inv(A3), q3)
    uR = apply_h(np.linalg.inv(A2), q2)
    inside = (uL[:, 0] > 0) & (uL[:, 0] < FINAL_W) & (uL[:, 1] > 0) & (uL[:, 1] < FINAL_H)
    dy = (uR[:, 1] - uL[:, 1])[inside]
    dx = (uL[:, 0] - uR[:, 0])[inside]
    print('matches in crop', int(inside.sum()), 'dy median %.2f |dy| p50 %.2f p90 %.2f' % (np.median(dy), np.median(np.abs(dy)), np.percentile(np.abs(dy), 90)))
    print('disparity (xL-xR) p1 %.1f p50 %.1f p99 %.1f' % tuple(np.percentile(dx, [1, 50, 99])))

    dmin = int(math.floor(np.percentile(dx, 0.5) - 12))
    num = int(math.ceil((np.percentile(dx, 99.5) + 12 - dmin) / 16.0) * 16)
    block = 5
    params = dict(minDisparity=dmin, numDisparities=num, blockSize=block, P1=8 * block * block, P2=48 * block * block,
                  disp12MaxDiff=-1, uniquenessRatio=8, speckleWindowSize=0, speckleRange=0, preFilterCap=31,
                  mode=cv2.STEREO_SGBM_MODE_SGBM_3WAY)
    sg = cv2.StereoSGBM_create(**params)
    Lb = cv2.GaussianBlur(L, (0, 0), 0.8)
    Rb = cv2.GaussianBlur(R, (0, 0), 0.8)
    dispL = sg.compute(Lb, Rb).astype(np.float32) / 16.0
    dispR = cv2.flip(sg.compute(cv2.flip(Rb, 1), cv2.flip(Lb, 1)), 1).astype(np.float32) / 16.0
    invalid = dmin - 1
    valid = dispL > invalid + 0.5
    xs = np.arange(FINAL_W)[None, :].repeat(FINAL_H, 0)
    xr = np.clip(np.round(xs - dispL).astype(int), 0, FINAL_W - 1)
    back = dispR[np.arange(FINAL_H)[:, None], xr]
    consistent = valid & (back > invalid + 0.5) & (np.abs(back - dispL) <= 1.5)

    mask, t_int = island_mask(L)
    print('Otsu threshold', t_int, 'island pixels', int(mask.sum()))
    imwrite(OUT / 'mask.png', (mask * 255).astype(np.uint8))
    keep = consistent & mask
    print('consistent on island %.1f%%' % (100.0 * keep.sum() / max(1, mask.sum())))

    np.savez(OUT / 'stereo.npz', dispL=dispL, consistent=consistent, mask=mask, L=L, R=R, A3=A3, A2=A2, Hm=Hm, Fm=Fm)
    d = np.where(keep, dispL, np.nan)
    lo, hi = np.nanpercentile(d, [2, 98])
    vis = np.clip((np.nan_to_num(d, nan=lo) - lo) / (hi - lo), 0, 1)
    col = cv2.applyColorMap((vis * 255).astype(np.uint8), cv2.COLORMAP_TURBO)
    col[~keep] = (np.dstack([L, L, L])[~keep] * 0.5).astype(np.uint8)
    imwrite(OUT / 'debug_disp.jpg', col)
    meta = {'angle_deg': math.degrees(ang), 'dmin': dmin, 'num': num, 'scan_offset': scan_off.tolist(),
            'disp_p2_p98': [float(lo), float(hi)], 'f_px': F_PX, 'fiducials': fid}
    (OUT / 'stereo_meta.json').write_text(json.dumps(meta, indent=1))
    print(json.dumps(meta))


if __name__ == '__main__':
    main()
