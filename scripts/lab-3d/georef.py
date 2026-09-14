"""Register a rotated photo crop (rect_L.png) to GSI z17 orthophoto mosaics.

    python georef.py --year 1962|2010

Gives the ground size of one crop pixel and which way north points, and writes
georef.json next to the crop so later steps can turn crop pixels into lon/lat.
"""
import argparse
import json
import math
from pathlib import Path

import cv2
import numpy as np

from years import CONFIGS

HERE = Path(__file__).resolve().parent
Z = 17
LAT0 = 32.6278
M_PER_PX = 156543.03392 * math.cos(math.radians(LAT0)) / 2 ** Z
# Window of the mosaic around Hashima (centre at 582, 1025).
WX0, WY0, WX1, WY1 = 230, 660, 940, 1390


def imread(p, flag=cv2.IMREAD_GRAYSCALE):
    img = cv2.imdecode(np.fromfile(str(p), np.uint8), flag)
    assert img is not None, p
    return img


def imwrite(p, img):
    ok, buf = cv2.imencode(Path(p).suffix, img)
    assert ok, p
    buf.tofile(str(p))


def register(src, dst, name, ratio=0.8):
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    s, d = clahe.apply(src), clahe.apply(dst)
    sift = cv2.SIFT_create(contrastThreshold=0.01)
    ks, ds = sift.detectAndCompute(s, None)
    kd, dd = sift.detectAndCompute(d, None)
    knn = cv2.FlannBasedMatcher(dict(algorithm=1, trees=5), dict(checks=128)).knnMatch(ds, dd, k=2)
    good = [p[0] for p in knn if len(p) == 2 and p[0].distance < ratio * p[1].distance]
    ps = np.float32([ks[m.queryIdx].pt for m in good])
    pd = np.float32([kd[m.trainIdx].pt for m in good])
    if len(good) < 6:
        print(name, 'too few matches', len(good))
        return None
    M, inl = cv2.estimateAffinePartial2D(ps, pd, method=cv2.RANSAC, ransacReprojThreshold=3.0, maxIters=50000, confidence=0.9999)
    if M is None:
        print(name, 'no fit')
        return None
    inl = inl.ravel().astype(bool)
    scale = math.hypot(M[0, 0], M[1, 0])
    rot = math.degrees(math.atan2(M[1, 0], M[0, 0]))
    err = np.linalg.norm((np.c_[ps, np.ones(len(ps))] @ M.T) - pd, axis=1)[inl]
    print(f'{name}: features {len(ks)}/{len(kd)} matches {len(good)} inliers {inl.sum()} '
          f'scale {scale:.4f} (={scale * M_PER_PX:.4f} m/px) rotation {rot:.2f} deg rms {np.sqrt((err ** 2).mean()):.2f}px')
    return {'M': M, 'inliers': int(inl.sum()), 'scale': scale, 'rot': rot, 'gsd': scale * M_PER_PX}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--year', default='1962', choices=sorted(CONFIGS))
    year = ap.parse_args().year
    out = HERE / CONFIGS[year]['out']
    L = imread(out / 'rect_L.png')
    meta = json.loads((HERE / 'mosaic.json').read_text())
    results = {}
    for layer in ('ort_old10', 'gazo1', 'seamlessphoto'):
        mos = imread(HERE / f'mosaic_{layer}.png')
        win = mos[WY0:WY1, WX0:WX1]
        r = register(L, win, layer)
        if not r:
            continue
        results[layer] = r
        warped = cv2.warpAffine(L, r['M'], (win.shape[1], win.shape[0]))
        imwrite(out / f'debug_georef_{layer}.jpg', np.dstack([warped, warped, win]))
    # A fit with almost no scale is degenerate (gazo1 returned scale 0 with 13 "inliers").
    sane = {k: v for k, v in results.items() if 0.6 < v['scale'] < 1.1 and v['inliers'] >= 7}
    assert sane, 'no usable registration'
    name, r = max(sane.items(), key=lambda kv: kv[1]['inliers'])
    M = r['M'].copy()
    M[0, 2] += WX0
    M[1, 2] += WY0
    info = {'layer': name, 'M_crop_to_mosaic': M.tolist(), 'tile_x0': meta[name]['x0'], 'tile_y0': meta[name]['y0'],
            'z': Z, 'm_per_mosaic_px': M_PER_PX, 'gsd_crop_m': r['gsd'], 'rot_deg': r['rot'],
            'all': {k: {kk: vv for kk, vv in v.items() if kk != 'M'} for k, v in results.items()}}
    (out / 'georef.json').write_text(json.dumps(info, indent=1))
    print('chosen', name, json.dumps(info['all']))


if __name__ == '__main__':
    main()
