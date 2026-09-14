"""Two-view stereo for Hashima (Gunkanjima) from a pair of GSI aerial photographs.

    python stereo.py --year 1962   MKU628 C18-2 / C18-3, film scanned at 400 dpi
    python stereo.py --year 2010   CKU20103 C44-12 / C44-13, digital DMC

Plane + parallax: the right photo is warped onto the left one with a RANSAC homography,
both crops are turned so the remaining parallax runs along x, and semi-global matching
measures it. The left photo is the one with Hashima near its centre, so it is close to
a vertical view of the island.
"""
import argparse
import json
import math
from pathlib import Path

import cv2
import numpy as np
from scipy import ndimage

from years import CONFIGS

HERE = Path(__file__).resolve().parent
PHOTOS = HERE / 'photos'
FINAL_W, FINAL_H = 1024, 1024  # power of two: the crop is also the WebGL texture


def config():
    ap = argparse.ArgumentParser()
    ap.add_argument('--year', default='1962', choices=sorted(CONFIGS))
    year = ap.parse_args().year
    return year, CONFIGS[year]


def imread(p, flag=cv2.IMREAD_GRAYSCALE):
    img = cv2.imdecode(np.fromfile(str(p), np.uint8), flag)
    assert img is not None, p
    return img


def imwrite(p, img):
    ok, buf = cv2.imencode(Path(p).suffix, img)
    assert ok, p
    buf.tofile(str(p))


def fiducial_offsets(imgL, imgR, fiducials, half=150, search=220):
    out = {}
    for name, (x, y) in fiducials.items():
        x0, y0 = max(0, x - half), max(0, y - half)
        tpl = imgL[y0:y + half, x0:x + half]
        sx0, sy0 = max(0, x0 - search), max(0, y0 - search)
        win = imgR[sy0:y + half + search, sx0:x + half + search]
        res = cv2.matchTemplate(win, tpl, cv2.TM_CCOEFF_NORMED)
        _, score, _, loc = cv2.minMaxLoc(res)
        out[name] = {'dx': sx0 + loc[0] - x0, 'dy': sy0 + loc[1] - y0, 'score': round(float(score), 3)}
    return out


def sift_matches(a, b, frame):
    y0, y1, x0, x1 = frame
    ma = np.zeros_like(a)
    ma[y0:y1, x0:x1] = 255
    mb = np.zeros_like(b)
    mb[y0:y1, x0:x1] = 255
    sift = cv2.SIFT_create(contrastThreshold=0.02)
    ka, da = sift.detectAndCompute(a, ma)
    kb, db = sift.detectAndCompute(b, mb)
    flann = cv2.FlannBasedMatcher(dict(algorithm=1, trees=5), dict(checks=96))
    knn = flann.knnMatch(da, db, k=2)
    good = [p[0] for p in knn if len(p) == 2 and p[0].distance < 0.75 * p[1].distance]
    pa = np.float32([ka[m.queryIdx].pt for m in good])
    pb = np.float32([kb[m.trainIdx].pt for m in good])
    print(f'SIFT features: left {len(ka)}, right {len(kb)}; ratio-test matches {len(good)}')
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
    year, cfg = config()
    out = HERE / cfg['out']
    out.mkdir(exist_ok=True)
    f_px = cfg['focal_mm'] / cfg['pitch_mm']
    centre = np.array(cfg['centre'])
    print('year', year, 'OpenCV', cv2.__version__, 'focal %.1f px' % f_px)
    imgR = imread(PHOTOS / cfg['right'])
    imgL = imread(PHOTOS / cfg['left'])
    colourL = imread(PHOTOS / cfg['left'], cv2.IMREAD_COLOR)

    if cfg['strip']:
        y0, y1, x0, x1 = cfg['strip']
        imwrite(out / 'strip_3.png', imgL[y0:y1, x0:x1])
    fid = fiducial_offsets(imgL, imgR, cfg['fiducials']) if cfg['fiducials'] else {}
    if fid:
        print('fiducial offsets right - left:', fid)
    scan_off = [float(np.median([v['dx'] for v in fid.values()])), float(np.median([v['dy'] for v in fid.values()]))] if fid else [0.0, 0.0]

    cache = out / 'matches.npz'
    if cache.exists():
        z = np.load(cache)
        pL, pR = z['p3'], z['p2']
    else:
        pL, pR = sift_matches(imgL, imgR, cfg['frame'])
        np.savez(cache, p3=pL, p2=pR)

    Fm, inl_f = cv2.findFundamentalMat(pL, pR, cv2.USAC_MAGSAC, 1.5, 0.9999, 100000)
    inl_f = inl_f.ravel().astype(bool)
    qL, qR = pL[inl_f], pR[inl_f]
    print('F inliers', int(inl_f.sum()), 'of', len(pL))
    near = np.all(np.abs(qL - centre) < 450, axis=1)
    print('F inliers on Hashima window', int(near.sum()))

    Hm, inl_h = cv2.findHomography(qL, qR, cv2.RANSAC, 4.0, maxIters=100000, confidence=0.9999)
    inl_h = inl_h.ravel().astype(bool)
    print('plane inliers', int(inl_h.sum()), 'of F inliers', len(qL))

    # Epipole in the left photo: F e = 0 (cv2 convention pR^T F pL = 0).
    _, _, vt = np.linalg.svd(Fm)
    e = vt[-1]
    if abs(e[2]) > 1e-12 and np.linalg.norm(e[:2] / e[2]) < 1e7:
        v = e[:2] / e[2] - centre
        print('epipole at', e[:2] / e[2], 'distance', np.linalg.norm(v))
    else:
        v = e[:2]
        print('epipole at infinity')
    ang = math.atan2(v[1], v[0])
    if ang > math.pi / 2:
        ang -= math.pi
    if ang <= -math.pi / 2:
        ang += math.pi

    res = apply_h(np.linalg.inv(Hm), qR) - qL
    big = np.linalg.norm(res, axis=1) > 3
    if big.sum() > 10:
        _, _, wt = np.linalg.svd(res[big], full_matrices=False)
        print('parallax direction: epipole %.2f deg, residual PCA %.2f deg (n=%d)' % (math.degrees(ang), math.degrees(math.atan2(wt[0][1], wt[0][0])), big.sum()))

    c, s_ = math.cos(ang), math.sin(ang)
    rot_inv = np.array([[c, -s_, 0], [s_, c, 0], [0, 0, 1]])
    A3 = np.array([[1, 0, centre[0]], [0, 1, centre[1]], [0, 0, 1]]) @ rot_inv @ np.array([[1, 0, -FINAL_W / 2], [0, 1, -FINAL_H / 2], [0, 0, 1]])
    A2 = Hm @ A3
    L = cv2.warpPerspective(imgL, A3, (FINAL_W, FINAL_H), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP)
    R = cv2.warpPerspective(imgR, A2, (FINAL_W, FINAL_H), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP)
    Lc = cv2.warpPerspective(colourL, A3, (FINAL_W, FINAL_H), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP)
    imwrite(out / 'rect_L.png', L)
    imwrite(out / 'rect_R.png', R)
    imwrite(out / 'rect_L_color.png', Lc)
    imwrite(out / 'debug_anaglyph.jpg', np.dstack([R, R, L]))

    uL = apply_h(np.linalg.inv(A3), qL)
    uR = apply_h(np.linalg.inv(A2), qR)
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
    imwrite(out / 'mask.png', (mask * 255).astype(np.uint8))
    keep = consistent & mask
    print('consistent on island %.1f%%' % (100.0 * keep.sum() / max(1, mask.sum())))

    np.savez(out / 'stereo.npz', dispL=dispL, consistent=consistent, mask=mask, L=L, R=R, A3=A3, A2=A2, Hm=Hm, Fm=Fm)
    d = np.where(keep, dispL, np.nan)
    lo, hi = np.nanpercentile(d, [2, 98])
    vis = np.clip((np.nan_to_num(d, nan=lo) - lo) / (hi - lo), 0, 1)
    col = cv2.applyColorMap((vis * 255).astype(np.uint8), cv2.COLORMAP_TURBO)
    col[~keep] = (np.dstack([L, L, L])[~keep] * 0.5).astype(np.uint8)
    imwrite(out / 'debug_disp.jpg', col)
    meta = {'year': year, 'angle_deg': math.degrees(ang), 'dmin': dmin, 'num': num, 'scan_offset': scan_off,
            'disp_p2_p98': [float(lo), float(hi)], 'f_px': f_px, 'fiducials': fid}
    (out / 'stereo_meta.json').write_text(json.dumps(meta, indent=1))
    print(json.dumps(meta))


if __name__ == '__main__':
    main()
