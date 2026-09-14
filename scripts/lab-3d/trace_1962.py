"""Structures that stood in 1962 but have no OpenStreetMap outline (mostly wooden housing that has
since collapsed): find blocks in the 1962 height grid that rise well above the DEM ground and are not
covered by an OSM footprint, and fit a rectangle to each. -> out/traced_1962.json, out/debug_traced.jpg"""
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
OUT = HERE / 'out'
WEB = HERE / 'web'


def main():
    lab = json.loads((WEB / 'gunkanjima-lab.json').read_text(encoding='utf-8')); g = lab['grid']; mpp = lab['frame']['metersPerPixel']
    def grid(name):
        a = np.fromfile(WEB / name, dtype='<u2').reshape(g['h'], g['w']).astype(np.float32) * g['unit']
        f = np.zeros((1024, 1024), np.float32); f[g['y0']:g['y0'] + g['h'], g['x0']:g['x0'] + g['w']] = a; return f
    h62, h10 = grid(g['h1962']), grid(g['h2010'])
    dem = np.load(OUT / 'dem_crop.npy'); island = np.load(OUT / 'island.npy')
    ground = np.where(np.isnan(dem), cv2.blur(np.nan_to_num(dem), (15, 15)), dem)
    ground = cv2.GaussianBlur(ground, (0, 0), 2.0)
    osm = json.loads((WEB / 'gunkanjima-buildings.json').read_text(encoding='utf-8'))['buildings']
    covered = Image.new('L', (1024, 1024), 0)
    dr = ImageDraw.Draw(covered)
    for b in osm:
        dr.polygon([tuple(p) for p in b['poly']], fill=255)
    covered = cv2.dilate((np.array(covered) > 0).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    rise = h62 - ground
    cand = (rise > 3.2) & island & ~covered & (h62 > 0.05)
    cand = cv2.morphologyEx(cand.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab_, stats, cents = cv2.connectedComponentsWithStats(cand, 8)
    out = []
    img = cv2.imread(str(OUT / 'rect_L.png'))
    for k in range(1, n):
        area = stats[k, cv2.CC_STAT_AREA]
        if area < 25:  # under ~16 m2
            continue
        m = (lab_ == k).astype(np.uint8)
        cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        c = max(cs, key=cv2.contourArea)
        rect = cv2.minAreaRect(c)
        (cx, cy), (w, hh), ang = rect
        if min(w, hh) * mpp < 3.0:
            continue
        box = cv2.boxPoints(rect)
        fill = np.zeros_like(m); cv2.fillPoly(fill, [np.int32(box)], 1)
        if m.sum() / max(1, fill.sum()) < 0.45:  # not block-like
            continue
        core = cv2.erode(m, np.ones((3, 3), np.uint8)); core = core if core.sum() >= 4 else m
        roof62 = float(np.percentile(h62[core > 0], 70)); roof10 = float(np.percentile(h10[core > 0], 70))
        grd = float(np.percentile(ground[fill > 0], 30))
        out.append({'id': f'trace-{k}', 'poly': [[round(float(x), 1), round(float(y), 1)] for x, y in box],
                    'areaM2': round(float(fill.sum()) * mpp * mpp), 'ground': round(grd, 1), 'roof1962': round(roof62, 1), 'roof2010': round(roof10, 1),
                    'standing2010': bool(roof10 - grd > 0.6 * (roof62 - grd))})
        cv2.polylines(img, [np.int32(box)], True, (0, 200, 255) if out[-1]['standing2010'] else (0, 80, 255), 1)
    out.sort(key=lambda b: -b['areaM2'])
    (OUT / 'traced_1962.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    x0, y0 = g['x0'], g['y0']
    cv2.imwrite(str(OUT / 'debug_traced.jpg'), cv2.resize(img[y0:y0 + g['h'], x0:x0 + g['w']], None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC))
    print(len(out), 'traced blocks; area sum', sum(b['areaM2'] for b in out), 'm2; standing in 2010:', sum(b['standing2010'] for b in out))
    for b in out[:12]:
        print(b)


if __name__ == '__main__':
    main()
