"""Stitch the z17 GSI tiles around Hashima into one image per layer.

Writes hashima/mosaic_<layer>.png plus mosaic.json with the tile origin, so
later steps can turn mosaic pixels into lon/lat (Web Mercator).
"""
import json
import math
import os
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
TILES = HERE / 'tiles'
Z = 17


def tile_xy(lon, lat, z=Z):
    n = 2 ** z
    x = (lon + 180.0) / 360.0 * n
    phi = math.radians(lat)
    y = (1.0 - math.log(math.tan(phi) + 1.0 / math.cos(phi)) / math.pi) / 2.0 * n
    return x, y


def main():
    layers = {}
    for f in TILES.iterdir():
        name, z, x, y = f.stem.rsplit('_', 3)
        layers.setdefault(name, {})[(int(x), int(y))] = f
    meta = {}
    for name, tiles in layers.items():
        xs = sorted({k[0] for k in tiles})
        ys = sorted({k[1] for k in tiles})
        w = (xs[-1] - xs[0] + 1) * 256
        h = (ys[-1] - ys[0] + 1) * 256
        canvas = Image.new('RGB', (w, h), (0, 0, 0))
        for (x, y), f in tiles.items():
            canvas.paste(Image.open(f).convert('RGB'), ((x - xs[0]) * 256, (y - ys[0]) * 256))
        out = HERE / f'mosaic_{name}.png'
        canvas.save(out)
        meta[name] = {'x0': xs[0], 'y0': ys[0], 'w': w, 'h': h, 'z': Z}
        print(name, out.name, w, h)
    cx, cy = tile_xy(129.7383, 32.6278)
    any_meta = next(iter(meta.values()))
    print('Hashima centre in mosaic px:', (cx - any_meta['x0']) * 256, (cy - any_meta['y0']) * 256)
    (HERE / 'mosaic.json').write_text(json.dumps(meta, indent=1))


if __name__ == '__main__':
    main()
