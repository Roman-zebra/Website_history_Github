"""GSI 5 m elevation (dem5b PNG tiles, z15) resampled into the 1962 crop frame -> out/dem_crop.npy
(1024 x 1024 float32, NaN where the tile has no data or is missing). Also writes out/debug_dem.png.
Tile value: h = (R*65536 + G*256 + B) * 0.01 m, with 2^23 as 'no data'; values above 2^23 are negative."""
import json, math
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
OUT = HERE / 'out'
Z = 15


def load_tiles():
    tiles = {}
    for p in (HERE / 'dem').glob('dem5b_png_15_*_*.png'):
        _, _, _, x, y = p.stem.split('_')
        a = np.array(Image.open(p).convert('RGB')).astype(np.int64)
        v = a[..., 0] * 65536 + a[..., 1] * 256 + a[..., 2]
        h = np.where(v == 2 ** 23, np.nan, np.where(v > 2 ** 23, v - 2 ** 24, v) * 0.01).astype(np.float32)
        tiles[(int(x), int(y))] = h
    return tiles


def main():
    geo = json.loads((OUT / 'georef.json').read_text())
    M = np.vstack([np.array(geo['M_crop_to_mosaic']), [0, 0, 1]])
    tiles = load_tiles()
    xs = sorted({k[0] for k in tiles}); ys = sorted({k[1] for k in tiles})
    x0, y0 = min(xs), min(ys)
    W, H = (max(xs) - x0 + 1) * 256, (max(ys) - y0 + 1) * 256
    big = np.full((H, W), np.nan, np.float32)
    for (x, y), h in tiles.items():
        big[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = h
    # crop px -> z17 global px -> z15 global px -> local px in `big`
    u, v = np.meshgrid(np.arange(1024, dtype=np.float64), np.arange(1024, dtype=np.float64))
    pts = M @ np.stack([u.ravel(), v.ravel(), np.ones(u.size)])
    mx, my = pts[0] / pts[2], pts[1] / pts[2]
    gx17 = geo['tile_x0'] * 256 + mx + 0.5
    gy17 = geo['tile_y0'] * 256 + my + 0.5
    lx = gx17 / 2 ** (17 - Z) - x0 * 256 - 0.5
    ly = gy17 / 2 ** (17 - Z) - y0 * 256 - 0.5
    # bilinear
    i0 = np.floor(lx).astype(int); j0 = np.floor(ly).astype(int)
    fx = lx - i0; fy = ly - j0
    ok = (i0 >= 0) & (j0 >= 0) & (i0 < W - 1) & (j0 < H - 1)
    out = np.full(u.size, np.nan, np.float32)
    ii, jj = i0[ok], j0[ok]
    a = big[jj, ii]; b = big[jj, ii + 1]; c = big[jj + 1, ii]; d = big[jj + 1, ii + 1]
    out[ok] = (a * (1 - fx[ok]) + b * fx[ok]) * (1 - fy[ok]) + (c * (1 - fx[ok]) + d * fx[ok]) * fy[ok]
    dem = out.reshape(1024, 1024)
    np.save(OUT / 'dem_crop.npy', dem)
    island = np.load(OUT / 'island.npy')
    vals = dem[island & ~np.isnan(dem)]
    print('tiles', sorted(tiles), 'z15 px per crop px', 0.805 / (156543.03 * math.cos(math.radians(32.63)) / 2 ** 15))
    print('dem on island: n', vals.size, 'nan', np.isnan(dem[island]).mean().round(3), 'pct', np.percentile(vals, [1, 10, 50, 90, 99, 100]).round(1))
    vis = np.nan_to_num(dem, nan=0)
    vis = np.clip(vis / 50 * 255, 0, 255).astype(np.uint8)
    Image.fromarray(vis).save(OUT / 'debug_dem.png')


if __name__ == '__main__':
    main()
