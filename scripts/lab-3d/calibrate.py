"""Turn stereo disparity into heights above sea level and export the web assets.

Heights use the vertical-photo parallax formula h = H (1 - P_sea / P), where P is
the absolute parallax of a pixel between the two photos. P_sea, the parallax of
sea level, is fitted to GSI's 5 m DEM along the lower envelope (in 1962 most of
the island was under buildings, so only the lowest surface in each block can be
ground). Boats on the water are the independent check: they must come out near 0.
"""
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
OUT = HERE / 'out'
WEB = OUT / 'web'
WEB.mkdir(exist_ok=True)

F_PX = 152.670 / (25.4 / 400)
ALTIMETER_M = 1950            # "ALT 1950" on the data strip of C18-3
PP_FULL = (1912.0, 1853.0)    # fiducial centre of photo 3 (preview estimate)
DEM_X0, DEM_Y0 = 28192, 13238
BLOCK = 24
# Probes in the 1024 crop (old 1100x900 positions shifted by (-38, +62)).
PROBES = {'boat (oval)': (502, 677), 'small boat a': (432, 690), 'small boat b': (462, 694),
          'pier': (614, 610), 'NE yard': (757, 452), 'SW tip': (252, 622)}


def imwrite(p, img, params=()):
    ok, buf = cv2.imencode(Path(p).suffix, img, list(params))
    assert ok, p
    buf.tofile(str(p))


def dem_mosaic():
    arr = np.full((512, 512), np.nan)
    for x in (DEM_X0, DEM_X0 + 1):
        for y in (DEM_Y0, DEM_Y0 + 1):
            f = HERE / 'dem' / f'dem5b_png_15_{x}_{y}.png'
            if not f.exists():
                continue
            a = np.asarray(Image.open(f).convert('RGB')).astype(np.int64)
            v = (a[..., 0] << 16) + (a[..., 1] << 8) + a[..., 2]
            h = np.where(v < 2 ** 23, v * 0.01, np.where(v > 2 ** 23, (v - 2 ** 24) * 0.01, np.nan))
            arr[(y - DEM_Y0) * 256:(y - DEM_Y0 + 1) * 256, (x - DEM_X0) * 256:(x - DEM_X0 + 1) * 256] = h
    return arr


def sample_nan(arr, px, py):
    valid = ~np.isnan(arr)
    v = ndimage.map_coordinates(np.where(valid, arr, 0.0), [py, px], order=1, mode='constant', cval=0.0)
    w = ndimage.map_coordinates(valid.astype(float), [py, px], order=1, mode='constant', cval=0.0)
    return np.where(w > 0.99, v / np.maximum(w, 1e-9), np.nan)


def proj(A, x, y):
    w = A[2, 0] * x + A[2, 1] * y + A[2, 2]
    return (A[0, 0] * x + A[0, 1] * y + A[0, 2]) / w, (A[1, 0] * x + A[1, 1] * y + A[1, 2]) / w


def fit_envelope(rows, tilt):
    keep = np.ones(len(rows), bool)
    coef = np.zeros(3)
    for _ in range(50):
        cols = [np.ones(keep.sum())]
        if tilt:
            cols += [rows[keep, 0] - 512, rows[keep, 1] - 512]
        A = np.c_[tuple(cols)]
        c, *_ = np.linalg.lstsq(A, rows[keep, 2], rcond=None)
        coef = np.r_[c, np.zeros(3 - len(c))]
        pred = coef[0] + coef[1] * (rows[:, 0] - 512) + coef[2] * (rows[:, 1] - 512)
        new = rows[:, 2] - pred < 0.8
        if (new == keep).all():
            break
        keep = new
    return coef, keep


def main():
    z = np.load(OUT / 'stereo.npz')
    disp, ok, mask, L = z['dispL'], z['consistent'], z['mask'], z['L']
    A3, A2 = z['A3'], z['A2']
    geo = json.loads((OUT / 'georef.json').read_text())
    hh, ww = disp.shape
    yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float64)

    x3, y3 = proj(A3, xx, yy)
    x2, y2 = proj(A2, xx - np.where(ok, disp, 0.0), yy)
    vx, vy = x3 - x2, y3 - y2
    isl = ok & mask
    b = np.array([np.median(vx[isl]), np.median(vy[isl])])
    b /= np.linalg.norm(b)
    P = vx * b[0] + vy * b[1]
    print('base direction', b.round(4), 'P median %.1f px, corr(P, disp) %.3f' % (np.median(P[isl]), np.corrcoef(P[isl], disp[isl])[0, 1]))

    gsd = geo['gsd_crop_m']
    H = F_PX * gsd + 15.0
    print('flying height from map scale %.0f m (layer %s, %.4f m/px); altimeter %d m' % (H, geo['layer'], gsd, ALTIMETER_M))

    M = np.array(geo['M_crop_to_mosaic'])
    mx = M[0, 0] * xx + M[0, 1] * yy + M[0, 2]
    my = M[1, 0] * xx + M[1, 1] * yy + M[1, 2]
    dpx = (geo['tile_x0'] * 256 + mx + 0.5) / 4 - DEM_X0 * 256 - 0.5
    dpy = (geo['tile_y0'] * 256 + my + 0.5) / 4 - DEM_Y0 * 256 - 0.5
    hdem = sample_nan(dem_mosaic(), dpx, dpy)
    land = ~np.isnan(hdem)
    print('DEM land px in crop', int(land.sum()), 'DEM range %.1f..%.1f' % (np.nanmin(hdem), np.nanmax(hdem)))

    Pm = float(np.median(P[isl]))
    t = P - Pm / H * hdem
    use = isl & land
    rows = []
    for by in range(0, hh, BLOCK):
        for bx in range(0, ww, BLOCK):
            sel = use[by:by + BLOCK, bx:bx + BLOCK]
            if sel.sum() < 0.5 * BLOCK * BLOCK:
                continue
            rows.append((bx + BLOCK / 2, by + BLOCK / 2, np.percentile(t[by:by + BLOCK, bx:bx + BLOCK][sel], 20)))
    rows = np.array(rows)
    results = {}
    for tilt in (False, True):
        coef, keep = fit_envelope(rows, tilt)
        psea = coef[0] + coef[1] * (xx - 512) + coef[2] * (yy - 512)
        h = H * (1 - psea / P)
        res_m = (rows[keep, 2] - (coef[0] + coef[1] * (rows[keep, 0] - 512) + coef[2] * (rows[keep, 1] - 512))) * H / Pm
        probes = {}
        for name, (px_, py_) in PROBES.items():
            s = (slice(py_ - 3, py_ + 4), slice(px_ - 3, px_ + 4))
            vals = h[s][ok[s]]
            probes[name] = round(float(np.median(vals)), 1) if vals.size else None
        tilt_m = math.hypot(coef[1], coef[2]) * 500 * H / Pm
        print(('plane' if tilt else 'offset') + f': blocks kept {keep.sum()}/{len(rows)}, residual rms {np.sqrt((res_m ** 2).mean()):.2f} m, '
              f'tilt over 500 px {tilt_m:.1f} m, probes {probes}')
        results[tilt] = (coef, h, probes)

    boats = [results[True][2][k] for k in ('boat (oval)', 'small boat a', 'small boat b')]
    boats0 = [results[False][2][k] for k in ('boat (oval)', 'small boat a', 'small boat b')]
    use_tilt = np.nanmean(np.abs(np.array(boats, float))) < np.nanmean(np.abs(np.array(boats0, float)))
    coef, h, probes = results[use_tilt]
    print('using', 'plane' if use_tilt else 'offset')

    island = mask & ndimage.binary_dilation(land, iterations=6)
    lab_, n_ = ndimage.label(island)
    if n_ > 1:  # foam and rocks cut off from the island
        island = lab_ == (1 + int(np.argmax(ndimage.sum(island, lab_, range(1, n_ + 1)))))
    island = ndimage.binary_fill_holes(island)

    def fill(a):
        gaps = np.isnan(a)
        near = ndimage.distance_transform_edt(gaps, return_distances=False, return_indices=True)
        return a[near[0], near[1]], gaps

    hv = np.where(ok & island, h, np.nan)
    hv[(hv < -3) | (hv > 75)] = np.nan
    first, _ = fill(hv)
    local = ndimage.median_filter(np.where(island, first, 0.0), size=21)
    with np.errstate(invalid='ignore'):
        spikes = island & (np.abs(hv - local) > 12)
    hv[spikes] = np.nan
    filled, inv = fill(hv)
    filled = ndimage.median_filter(np.where(island, filled, 0.0), size=5)
    # Needles a few pixels wide are matching errors (or chimneys too thin to measure). A grey opening
    # removes anything narrower than about 5.6 m and leaves the buildings their shape.
    filled = np.where(island, ndimage.grey_opening(filled, size=(7, 7)), 0.0)
    # Small blobs standing well above their surroundings are towers or chimneys too thin to match
    # reliably; smoothing turns them into cones, so they are left out. The local level is taken from
    # island pixels only, so buildings on the sea wall are not measured against the sea.
    inland, _ = fill(np.where(island, filled, np.nan))
    base = ndimage.median_filter(inland, size=41)
    tall = island & (filled - base > 10)
    blobs, nb = ndimage.label(tall)
    if nb:
        area = ndimage.sum(tall, blobs, range(1, nb + 1))
        towers = ndimage.binary_dilation(np.isin(blobs, 1 + np.nonzero(area < 150)[0]), iterations=3) & island
        filled = np.where(towers, base, filled)
        print('towers left out', int((area < 150).sum()), 'of', nb, 'tall blobs')
    # Smooth inside the island only, so the sea wall keeps a sharp edge.
    weight = ndimage.gaussian_filter(island.astype(float), 1.0)
    filled = np.where(island, ndimage.gaussian_filter(np.where(island, filled, 0.0), 1.0) / np.maximum(weight, 1e-6), 0.0)
    filled = np.where(island, np.clip(filled, 0, 75), 0.0).astype(np.float32)
    print('spikes removed', int(spikes.sum()))
    q = np.percentile(filled[island], [5, 25, 50, 75, 95, 99, 99.9])
    print('island px', int(island.sum()), 'filled from neighbours %.1f%%' % (100 * (inv & island).sum() / island.sum()),
          'height percentiles 5/25/50/75/95/99/99.9:', q.round(1))
    ridge = hdem[island & land]
    print('DEM on island p50 %.1f max %.1f; stereo minus DEM p10 %.1f p50 %.1f' % (
        np.nanmedian(ridge), np.nanmax(ridge), np.nanpercentile((filled - hdem)[island & land], 10), np.nanpercentile((filled - hdem)[island & land], 50)))
    np.save(OUT / 'height.npy', filled)
    np.save(OUT / 'island.npy', island)

    vis = cv2.applyColorMap((np.clip(filled / 50.0, 0, 1) * 255).astype(np.uint8), cv2.COLORMAP_TURBO)
    base = np.dstack([L, L, L]).astype(np.float32)
    blend = np.where(island[..., None], 0.35 * base + 0.65 * vis, 0.6 * base).astype(np.uint8)
    imwrite(OUT / 'debug_height.jpg', blend)
    gy, gx = np.gradient(filled.astype(np.float64) / gsd)
    az, alt = math.radians(315), math.radians(40)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    imwrite(OUT / 'debug_hillshade.jpg', (np.clip(shade, 0, 1) * 255).astype(np.uint8))

    ys, xs = np.nonzero(island)
    x0 = max(0, (xs.min() - 16) // 2 * 2)
    y0 = max(0, (ys.min() - 16) // 2 * 2)
    x1 = min(ww - 1, (xs.max() + 16) // 2 * 2)
    y1 = min(hh - 1, (ys.max() + 16) // 2 * 2)
    grid = filled[y0:y1 + 1:2, x0:x1 + 1:2]
    (WEB / 'gunkanjima-1962-height.bin').write_bytes(np.round(grid * 10).astype('<u2').tobytes())

    lo, hi = np.percentile(L, [1, 99.8])
    tex = np.clip((L.astype(np.float32) - lo) / (hi - lo), 0, 1) ** 0.95 * 255
    imwrite(WEB / 'gunkanjima-1962.jpg', tex.astype(np.uint8), (cv2.IMWRITE_JPEG_QUALITY, 86, cv2.IMWRITE_JPEG_PROGRESSIVE, 1))

    north = np.linalg.inv(M[:, :2]) @ np.array([0.0, -1.0])
    north /= np.linalg.norm(north)
    ppL = proj(np.linalg.inv(A3), np.array(PP_FULL[0]), np.array(PP_FULL[1]))
    meta = {
        'photo': {'main': 'MKU628-C18-3', 'pair': 'MKU628-C18-2', 'date': '1962-05-30', 'focalMm': 152.67},
        'texture': {'file': 'gunkanjima-1962.jpg', 'size': int(ww), 'metersPerPixel': round(gsd, 4)},
        'grid': {'file': 'gunkanjima-1962-height.bin', 'w': int(grid.shape[1]), 'h': int(grid.shape[0]),
                 'x0': int(x0), 'y0': int(y0), 'step': 2, 'unit': 0.1},
        'north': [round(float(north[0]), 4), round(float(north[1]), 4)],
        'principalPoint': [round(float(ppL[0]), 1), round(float(ppL[1]), 1)],
        'flyingHeightM': round(H),
        'heights': {'p50': round(float(q[2]), 1), 'p99': round(float(q[5]), 1), 'max': round(float(filled.max()), 1)},
        'check': {'boats': probes},
    }
    (WEB / 'gunkanjima-1962.json').write_text(json.dumps(meta, indent=1))
    print(json.dumps(meta))


if __name__ == '__main__':
    main()
