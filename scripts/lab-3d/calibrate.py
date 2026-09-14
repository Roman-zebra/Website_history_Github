"""Turn stereo disparity into heights above sea level.

    python calibrate.py --year 1962|2010

Heights use the vertical-photo parallax formula h = H (1 - P_sea / P), where P is
the absolute parallax of a pixel between the two photos. P_sea, the parallax of
sea level, is fitted to GSI's 5 m DEM along the lower envelope (most of the island
was under buildings, so only the lowest surface in each block can be ground). It is
fitted as a plane, because the reference plane of the image-to-image homography is
tilted. Floating objects, where the photos show any, are the independent check.

Writes height.npy, island.npy and calib.json next to the stereo output; export_web.py
turns them into the files the page loads.
"""
import argparse
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

from years import CONFIGS

HERE = Path(__file__).resolve().parent
DEM_X0, DEM_Y0 = 28192, 13238
BLOCK = 24


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


def guided(I, p, r=3, eps=0.004):
    """Guided filter (He et al.): smooths p but keeps the edges that the photo I has."""
    k = (2 * r + 1, 2 * r + 1)
    box = lambda x: cv2.boxFilter(x, cv2.CV_32F, k)
    mI, mp = box(I), box(p)
    a = (box(I * p) - mI * mp) / (box(I * I) - mI * mI + eps)
    b = mp - a * mI
    return box(a) * I + box(b)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--year', default='1962', choices=sorted(CONFIGS))
    year = ap.parse_args().year
    cfg = CONFIGS[year]
    out = HERE / cfg['out']
    f_px = cfg['focal_mm'] / cfg['pitch_mm']

    z = np.load(out / 'stereo.npz')
    disp, ok, mask, L = z['dispL'], z['consistent'], z['mask'], z['L']
    A3, A2 = z['A3'], z['A2']
    geo = json.loads((out / 'georef.json').read_text())
    hh, ww = disp.shape
    yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float64)

    x3, y3 = proj(A3, xx, yy)
    x2, y2 = proj(A2, xx - np.where(ok, disp, 0.0), yy)
    vx, vy = x3 - x2, y3 - y2
    isl = ok & mask
    b = np.array([np.median(vx[isl]), np.median(vy[isl])])
    b /= np.linalg.norm(b)
    P = vx * b[0] + vy * b[1]
    print('year', year, 'base direction', b.round(4), 'P median %.1f px, corr(P, disp) %.3f' % (np.median(P[isl]), np.corrcoef(P[isl], disp[isl])[0, 1]))

    gsd = geo['gsd_crop_m']
    H = f_px * gsd + 15.0
    print('flying height from map scale %.0f m (layer %s, %.4f m/px); altimeter %s' % (H, geo['layer'], gsd, cfg['altimeter_m']))

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
        for name, (px_, py_) in cfg['probes'].items():
            s = (slice(py_ - 3, py_ + 4), slice(px_ - 3, px_ + 4))
            vals = h[s][ok[s]]
            probes[name] = round(float(np.median(vals)), 1) if vals.size else None
        tilt_m = math.hypot(coef[1], coef[2]) * 500 * H / Pm
        print(('plane' if tilt else 'offset') + f': blocks kept {keep.sum()}/{len(rows)}, residual rms {np.sqrt((res_m ** 2).mean()):.2f} m, '
              f'tilt over 500 px {tilt_m:.1f} m, probes {probes}')
        results[tilt] = (coef, h, probes, float(np.sqrt((res_m ** 2).mean())), int(keep.sum()), float(tilt_m))

    boats = [k for k in cfg['probes'] if 'boat' in k]
    if boats:
        err = {tilt: np.nanmean(np.abs(np.array([results[tilt][2][k] for k in boats], float))) for tilt in (False, True)}
        use_tilt = err[True] < err[False]
    else:
        use_tilt = True  # nothing floating to check against; 1962 showed the tilt is needed
    coef, h, probes, rms, kept, tilt_m = results[use_tilt]
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
    # Smooth along the photo: walls stay where the photo has an edge, flat roofs lose their noise.
    smooth = guided(L.astype(np.float32) / 255.0, np.where(island, filled, 0.0).astype(np.float32))
    filled = np.where(island, np.clip(smooth, 0, 75), 0.0).astype(np.float32)
    print('spikes removed', int(spikes.sum()))
    q = np.percentile(filled[island], [5, 25, 50, 75, 95, 99, 99.9])
    filled_pct = 100 * (inv & island).sum() / island.sum()
    print('island px', int(island.sum()), 'filled from neighbours %.1f%%' % filled_pct,
          'height percentiles 5/25/50/75/95/99/99.9:', q.round(1))
    ridge = hdem[island & land]
    print('DEM on island p50 %.1f max %.1f; stereo minus DEM p10 %.1f p50 %.1f' % (
        np.nanmedian(ridge), np.nanmax(ridge), np.nanpercentile((filled - hdem)[island & land], 10), np.nanpercentile((filled - hdem)[island & land], 50)))
    np.save(out / 'height.npy', filled)
    np.save(out / 'island.npy', island)
    (out / 'calib.json').write_text(json.dumps({
        'year': year, 'flyingHeightM': round(H, 1), 'gsd': gsd, 'plane': coef.tolist(), 'tilted': bool(use_tilt),
        'tiltOver500pxM': round(tilt_m, 1), 'envelopeRmsM': round(rms, 2), 'envelopeBlocks': kept, 'probes': probes,
        'filledPct': round(float(filled_pct), 1), 'percentiles': [round(float(x), 1) for x in q],
        'max': round(float(filled.max()), 1)}, indent=1))

    vis = cv2.applyColorMap((np.clip(filled / 50.0, 0, 1) * 255).astype(np.uint8), cv2.COLORMAP_TURBO)
    base_img = np.dstack([L, L, L]).astype(np.float32)
    blend = np.where(island[..., None], 0.35 * base_img + 0.65 * vis, 0.6 * base_img).astype(np.uint8)
    imwrite(out / 'debug_height.jpg', blend)
    gy, gx = np.gradient(filled.astype(np.float64) / gsd)
    az, alt = math.radians(315), math.radians(40)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    imwrite(out / 'debug_hillshade.jpg', (np.clip(shade, 0, 1) * 255).astype(np.uint8))


if __name__ == '__main__':
    main()
