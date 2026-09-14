"""Export everything the lab page loads, in the frame of the 1962 crop (1,024 px, about 0.8 m each).

    python export_web.py

- Textures for 1947, 1962, 1975, 2010 and the latest GSI photo at 2,048 px (about 0.4 m), each warped
  straight from its original photograph so no detail is lost to an intermediate step.
- Height grids for 1962 and 2010 and a 1962 -> 2010 change grid at every pixel of the crop.
- For each spot: the position, then-and-now aerial views and, where there is one, a licensed photo.
- gunkanjima-lab.json describing all of it.

Needs out/ and out2010/ (stereo, georef, calibrate), photos/, tiles18/, out/osm_in_crop.json and spots_src/.
"""
import json
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

from years import CONFIGS

HERE = Path(__file__).resolve().parent
OUT = HERE / 'out'
OUT10 = HERE / 'out2010'
WEB = HERE / 'web'
PH = HERE / 'photos'
SIZE = 1024
TEX = 2048
S = np.array([[2.0, 0, 0.5], [0, 2.0, 0.5], [0, 0, 1.0]])  # crop pixel centre -> texture pixel centre


def imread(p, flag=cv2.IMREAD_COLOR):
    img = cv2.imdecode(np.fromfile(str(p), np.uint8), flag)
    assert img is not None, p
    return img


def imwrite(p, img, params=()):
    ok, buf = cv2.imencode(Path(p).suffix, img, list(params))
    assert ok, p
    buf.tofile(str(p))


def affine3(M):
    return np.vstack([np.asarray(M, float), [0.0, 0.0, 1.0]])


def translate(dx, dy):
    return np.array([[1.0, 0, dx], [0, 1.0, dy], [0, 0, 1.0]])


def proj(A, x, y):
    w = A[2, 0] * x + A[2, 1] * y + A[2, 2]
    return (A[0, 0] * x + A[0, 1] * y + A[0, 2]) / w, (A[1, 0] * x + A[1, 1] * y + A[1, 2]) / w


def sift_h(src, dst, dst_mask=None, ratio=0.75, thresh=4.0):
    sift = cv2.SIFT_create(contrastThreshold=0.015)
    ks, ds = sift.detectAndCompute(src, None)
    kd, dd = sift.detectAndCompute(dst, dst_mask)
    if ds is None or dd is None:
        return None, 0, None
    knn = cv2.FlannBasedMatcher(dict(algorithm=1, trees=5), dict(checks=128)).knnMatch(ds, dd, k=2)
    good = [p[0] for p in knn if len(p) == 2 and p[0].distance < ratio * p[1].distance]
    if len(good) < 10:
        return None, len(good), None
    ps = np.float32([ks[m.queryIdx].pt for m in good])
    pd = np.float32([kd[m.trainIdx].pt for m in good])
    H, inl = cv2.findHomography(ps, pd, cv2.USAC_MAGSAC, thresh, maxIters=50000, confidence=0.999)
    if H is None:
        return None, len(good), None
    inl = inl.ravel().astype(bool)
    q = cv2.perspectiveTransform(ps[inl].reshape(-1, 1, 2), H).reshape(-1, 2)
    return H, int(inl.sum()), round(float(np.median(np.linalg.norm(q - pd[inl], axis=1))), 2)


def to_texture(img, crop_to_src):
    """Warp a source image into the 2,048 px texture; crop_to_src maps 1962 crop px to source px."""
    return cv2.warpPerspective(img, crop_to_src @ np.linalg.inv(S), (TEX, TEX), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP)


def stretch(img, region, lo=0.5, hi=99.6, gamma=1.0):
    out = np.empty_like(img)
    for c in range(img.shape[2]):
        a, b = np.percentile(img[..., c][region], [lo, hi])
        v = np.clip((img[..., c].astype(np.float32) - a) / max(1.0, b - a), 0, 1) ** gamma
        out[..., c] = (v * 255).astype(np.uint8)
    return out


def main():
    if WEB.exists():
        shutil.rmtree(WEB)
    (WEB / 'spots').mkdir(parents=True)
    report = {}
    c62, c10 = json.loads((OUT / 'calib.json').read_text()), json.loads((OUT10 / 'calib.json').read_text())
    z62 = np.load(OUT / 'stereo.npz')
    z10 = np.load(OUT10 / 'stereo.npz')
    g62 = json.loads((OUT / 'georef.json').read_text())
    g10 = json.loads((OUT10 / 'georef.json').read_text())
    L62 = z62['L']
    h62 = np.load(OUT / 'height.npy')
    i62 = np.load(OUT / 'island.npy')
    near62 = ndimage.binary_dilation(i62, iterations=40)
    near_tex = cv2.resize(near62.astype(np.uint8), (TEX, TEX), interpolation=cv2.INTER_NEAREST).astype(bool)
    mask62 = (near62 * 255).astype(np.uint8)
    A62 = affine3(g62['M_crop_to_mosaic'])
    textures = {}

    # 1962: straight from the scan.
    scan62 = imread(PH / CONFIGS['1962']['left'], cv2.IMREAD_GRAYSCALE)
    t = to_texture(scan62, z62['A3'])
    lo, hi = np.percentile(L62, [1, 99.8])
    t = (np.clip((t.astype(np.float32) - lo) / (hi - lo), 0, 1) ** 0.95 * 255).astype(np.uint8)
    textures['1962'] = cv2.cvtColor(t, cv2.COLOR_GRAY2BGR)

    # 2010: both crops are registered to the same seamless-photo mosaic; chain the fits, then correct
    # what is left with a direct image-to-image fit.
    T10 = np.linalg.inv(A62) @ affine3(g10['M_crop_to_mosaic'])  # 2010 crop px -> 1962 crop px
    g10w = cv2.warpPerspective(z10['L'], T10, (SIZE, SIZE))
    Href, n, err = sift_h(g10w, L62, mask62)
    report['register2010'] = {'refineInliers': n, 'refineMedianPx': err}
    if Href is not None and n >= 40:
        T10 = Href @ T10
    scan10 = imread(PH / CONFIGS['2010']['left'])
    textures['2010'] = to_texture(scan10, z10['A3'] @ np.linalg.inv(T10))
    h10 = cv2.warpPerspective(np.load(OUT10 / 'height.npy'), T10, (SIZE, SIZE), flags=cv2.INTER_LINEAR)
    i10 = cv2.warpPerspective(np.load(OUT10 / 'island.npy').astype(np.uint8), T10, (SIZE, SIZE), flags=cv2.INTER_NEAREST).astype(bool)
    h10 = np.where(i10, h10, 0.0).astype(np.float32)

    # 1975 and 1947: SIFT where it works, otherwise the island outline refined on edges (register_photo.py).
    # January 1975 has long shadows where May 1962 had short ones, which is enough to defeat SIFT.
    import register_photo
    p75 = imread(PH / 'CKU7420-C45-6.jpg')
    cx, cy, half = 1296, 1638, 760
    H75, rep = register_photo.register(p75[cy - half:cy + half, cx - half:cx + half], L62, i62)
    report['register1975'] = rep
    textures['1975'] = to_texture(p75, np.linalg.inv(H75 @ translate(-(cx - half), -(cy - half))))

    # 1947: a US Army frame at about 1:30,000; enlarge the window before matching.
    p47 = imread(PH / 'USA-M185-38.jpg', cv2.IMREAD_GRAYSCALE)
    cx, cy, half, up = 2406, 2471, 330, 2.4
    win = cv2.resize(p47[cy - half:cy + half, cx - half:cx + half], None, fx=up, fy=up, interpolation=cv2.INTER_CUBIC)
    H47, rep = register_photo.register(win, L62, i62, min_inliers=12)
    report['register1947'] = rep
    T47 = H47 @ np.diag([up, up, 1.0]) @ translate(-(cx - half), -(cy - half))
    textures['1947'] = cv2.cvtColor(to_texture(p47, np.linalg.inv(T47)), cv2.COLOR_GRAY2BGR)

    # Latest seamless photo (an orthophoto), through the 1962 georeferencing.
    tiles = sorted((HERE / 'tiles18').glob('seamlessphoto_18_*.jpg'))
    xy = [tuple(int(v) for v in f.stem.split('_')[-2:]) for f in tiles]
    xmin, ymin = min(x for x, _ in xy), min(y for _, y in xy)
    mos = np.zeros(((max(y for _, y in xy) - ymin + 1) * 256, (max(x for x, _ in xy) - xmin + 1) * 256, 3), np.uint8)
    for f, (x, y) in zip(tiles, xy):
        mos[(y - ymin) * 256:(y - ymin + 1) * 256, (x - xmin) * 256:(x - xmin + 1) * 256] = imread(f)
    UU, VV = np.meshgrid(np.arange(TEX, dtype=np.float64), np.arange(TEX, dtype=np.float64))
    uu, vv = (UU - 0.5) / 2, (VV - 0.5) / 2
    mx = A62[0, 0] * uu + A62[0, 1] * vv + A62[0, 2]
    my = A62[1, 0] * uu + A62[1, 1] * vv + A62[1, 2]
    gx = 2 * (g62['tile_x0'] * 256 + mx + 0.5) - xmin * 256 - 0.5
    gy = 2 * (g62['tile_y0'] * 256 + my + 0.5) - ymin * 256 - 0.5
    textures['latest'] = cv2.remap(mos, gx.astype(np.float32), gy.astype(np.float32), cv2.INTER_CUBIC)

    for key in ('1947', '1975', '2010', 'latest'):
        if key in textures:
            textures[key] = stretch(textures[key], near_tex)
    for key, tex in textures.items():
        imwrite(WEB / f'gunkanjima-{key}.jpg', tex, (cv2.IMWRITE_JPEG_QUALITY, 84, cv2.IMWRITE_JPEG_PROGRESSIVE, 1))

    # Grids at every crop pixel over the island (1962 or 2010) with a margin of sea.
    both = i62 | i10
    ys, xs = np.nonzero(both)
    x0, y0 = max(0, xs.min() - 12), max(0, ys.min() - 12)
    x1, y1 = min(SIZE - 1, xs.max() + 12), min(SIZE - 1, ys.max() + 12)
    sl = (slice(y0, y1 + 1), slice(x0, x1 + 1))
    top62 = np.where(i62, h62, 0.0)
    (WEB / 'gunkanjima-1962-height.bin').write_bytes(np.round(top62[sl] * 10).clip(0, 65535).astype('<u2').tobytes())
    (WEB / 'gunkanjima-2010-height.bin').write_bytes(np.round(h10[sl] * 10).clip(0, 65535).astype('<u2').tobytes())
    # A point counts as lower in 2010 only if nothing within 3 px stands as high, and the reverse for higher,
    # so a few pixels of misregistration at walls do not show up as change.
    loss = top62 - ndimage.maximum_filter(h10, size=7)
    gain = h10 - ndimage.maximum_filter(top62, size=7)
    change = np.where(loss > 5, -loss, np.where(gain > 5, gain, 0.0))
    (WEB / 'gunkanjima-change.bin').write_bytes(np.round(change[sl]).clip(-127, 127).astype(np.int8).tobytes())
    m2 = c62['gsd'] ** 2
    report['change'] = {'lowerM2': round(float((change < -5).sum() * m2)), 'higherM2': round(float((change > 5).sum() * m2)),
                        'islandM2': round(float(i62.sum() * m2)),
                        'lowerBy10mM2': round(float((change <= -10).sum() * m2))}
    vis = np.dstack([L62] * 3).astype(np.float32) * 0.55
    vis[change < 0] = [60, 60, 235]
    vis[change > 0] = [235, 160, 50]
    imwrite(OUT / 'debug_change.jpg', vis.astype(np.uint8))

    # Spots. Positions from OpenStreetMap (checked against the 1962 photo); Building No. 30 read off the
    # photo, since OpenStreetMap does not name it (the square block with a light well).
    osm = {f['name']: (f['u'], f['v']) for f in json.loads((OUT / 'osm_in_crop.json').read_text(encoding='utf-8')) if f['name']}
    mid = lambda *names: tuple(float(np.mean([osm[k][i] for k in names])) for i in (0, 1))
    spots = {'no30': (361.0, 581.0), 'nikkyu': mid('17号棟', '18号棟'), 'no65': osm['65号棟'], 'school': osm['端島小中学校'],
             'shrine': osm['端島神社'], 'no3': osm['3号棟'], 'mine': mid('二坑口桟橋', '総合事務所'), 'pier': osm['ドルフィン桟橋']}
    north = np.linalg.inv(np.array(g62['M_crop_to_mosaic'])[:, :2]) @ np.array([0.0, -1.0])
    north /= np.linalg.norm(north)
    west = np.array([north[1], -north[0]])  # north turned 90 degrees anticlockwise on the map
    p = np.array(osm['16号棟'], float)
    for _ in range(300):
        nxt = p + west
        if not i62[int(round(nxt[1])), int(round(nxt[0]))]:
            break
        p = nxt
    spots['seawall'] = (float(p[0] - west[0] * 3), float(p[1] - west[1] * 3))
    # Commons may serve a PNG original as a JPEG thumbnail, so find each photo by name, not by extension.
    photos = {'no30': 'no30', 'mine': 'mine-entrance', 'no65': 'no65', 'school': 'school', 'no3': 'no3', 'seawall': 'sea-wall'}
    out_spots, board = {}, []
    for sid, (u, v) in spots.items():
        ui, vi = int(round(u)), int(round(v))
        entry = {'u': round(u, 1), 'v': round(v, 1), 'h1962': round(float(top62[vi - 4:vi + 5, ui - 4:ui + 5].max()), 1),
                 'h2010': round(float(h10[vi - 4:vi + 5, ui - 4:ui + 5].max()), 1), 'images': {}}
        U, V, r = 2 * ui, 2 * vi, 120
        for key in ('1962', 'latest'):
            crop = cv2.resize(textures[key][max(0, V - r):V + r, max(0, U - r):U + r], (360, 360), interpolation=cv2.INTER_AREA)
            name = f'{sid}-{key}.jpg'
            imwrite(WEB / 'spots' / name, crop, (cv2.IMWRITE_JPEG_QUALITY, 84, cv2.IMWRITE_JPEG_PROGRESSIVE, 1))
            entry['images'][key] = 'spots/' + name
            board.append(crop)
        if sid in photos:
            src = sorted((HERE / 'spots_src').glob(photos[sid] + '.*'))
            assert len(src) == 1, (sid, src)
            im = Image.open(src[0]).convert('RGB')
            im.thumbnail((720, 720), Image.LANCZOS)
            im.save(WEB / 'spots' / f'{sid}-photo.jpg', quality=80, optimize=True, progressive=True)
            entry['images']['photo'] = f'spots/{sid}-photo.jpg'
        out_spots[sid] = entry
    cols = 6
    rows = [np.hstack(board[i:i + cols] + [np.zeros_like(board[0])] * (cols - len(board[i:i + cols]))) for i in range(0, len(board), cols)]
    imwrite(OUT / 'debug_spot_crops.jpg', cv2.resize(np.vstack(rows), None, fx=0.5, fy=0.5))
    imwrite(OUT / 'debug_years.jpg', np.hstack([cv2.resize(textures[k], (400, 400), interpolation=cv2.INTER_AREA) for k in ('1947', '1962', '1975', '2010', 'latest') if k in textures]))

    pp = proj(np.linalg.inv(z62['A3']), *CONFIGS['1962']['principal_point'])
    years = [
        {'id': '1947', 'photo': 'USA M185-38', 'date': '1947-03-26', 'camera': 'K-17B', 'shape': None, 'ortho': False},
        {'id': '1962', 'photo': 'MKU628 C18-2, C18-3', 'date': '1962-05-30', 'camera': 'RMK', 'shape': '1962', 'ortho': False},
        {'id': '1975', 'photo': 'CKU7420 C45-6', 'date': '1975-01-02', 'camera': 'RC8', 'shape': '1962', 'ortho': False},
        {'id': '2010', 'photo': 'CKU20103 C44-12, C44-13', 'date': '2010-05-03', 'camera': 'DMC', 'shape': '2010', 'ortho': False},
        {'id': 'latest', 'photo': 'GSI seamless aerial photo', 'date': None, 'camera': None, 'shape': '2010', 'ortho': True},
    ]
    years = [dict(y, texture=f'gunkanjima-{y["id"]}.jpg') for y in years if y['id'] in textures]
    lab = {
        'frame': {'size': SIZE, 'metersPerPixel': round(c62['gsd'], 4)},
        'texture': {'size': TEX},
        'grid': {'x0': int(x0), 'y0': int(y0), 'w': int(x1 - x0 + 1), 'h': int(y1 - y0 + 1), 'step': 1, 'unit': 0.1,
                 'h1962': 'gunkanjima-1962-height.bin', 'h2010': 'gunkanjima-2010-height.bin', 'change': 'gunkanjima-change.bin'},
        'north': [round(float(north[0]), 4), round(float(north[1]), 4)],
        'principalPoint': [round(float(pp[0]), 1), round(float(pp[1]), 1)],
        'flyingHeightM': round(c62['flyingHeightM']),
        'years': years,
        'heights': {'1962': {'p50': c62['percentiles'][2], 'p99': c62['percentiles'][5], 'max': c62['max'], 'filledPct': c62['filledPct']},
                    '2010': {'p50': c10['percentiles'][2], 'p99': c10['percentiles'][5], 'max': c10['max'], 'filledPct': c10['filledPct']}},
        'check': {'1962': {'altimeterM': CONFIGS['1962']['altimeter_m'], 'flyingHeightM': c62['flyingHeightM'], 'probes': c62['probes']},
                  '2010': {'flyingHeightM': c10['flyingHeightM'], 'envelopeRmsM': c10['envelopeRmsM']}},
        'spots': out_spots,
        'report': report,
    }
    (WEB / 'gunkanjima-lab.json').write_text(json.dumps(lab, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps({k: lab[k] for k in ('grid', 'heights', 'check', 'report')}, ensure_ascii=False, indent=1))
    print('spots', json.dumps(out_spots, ensure_ascii=False))


if __name__ == '__main__':
    main()
