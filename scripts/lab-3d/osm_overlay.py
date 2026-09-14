"""Draw OpenStreetMap buildings onto the 1962 crop to check the georeferencing, and write
every named feature's crop-pixel position to out/osm_in_crop.json for placing spot icons."""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE / 'out'


def lonlat_to_crop(geo, lon, lat):
    """Inverse of the crop -> z17 mosaic similarity written by georef.py."""
    M = np.vstack([np.array(geo['M_crop_to_mosaic']), [0, 0, 1]])
    n = 256 * 2 ** geo['z']
    gx = (lon + 180) / 360 * n
    phi = math.radians(lat)
    gy = (1 - math.log(math.tan(phi) + 1 / math.cos(phi)) / math.pi) / 2 * n
    mx, my = gx - geo['tile_x0'] * 256 - 0.5, gy - geo['tile_y0'] * 256 - 0.5
    u, v, w = np.linalg.inv(M) @ np.array([mx, my, 1.0])
    return float(u / w), float(v / w)


def main():
    geo = json.loads((OUT / 'georef.json').read_text())
    feats = json.loads((HERE / 'osm_named.json').read_text(encoding='utf-8'))
    img = Image.open(OUT / 'rect_L.png').convert('RGB')
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc', 11)
    placed = []
    for f in feats:
        u, v = lonlat_to_crop(geo, f['lon'], f['lat'])
        placed.append({'name': f['name'], 'type': f['type'], 'u': round(u, 1), 'v': round(v, 1), 'tags': f['tags']})
        if f.get('outline'):
            pts = [lonlat_to_crop(geo, lon, lat) for lat, lon in f['outline']]
            draw.line(pts + [pts[0]], fill=(255, 210, 0), width=1)
        draw.ellipse([u - 2, v - 2, u + 2, v + 2], fill=(255, 60, 60))
        if f['name']:
            draw.text((u + 3, v - 7), f['name'].replace('号棟', ''), font=font, fill=(120, 255, 255))
    (OUT / 'osm_in_crop.json').write_text(json.dumps(placed, ensure_ascii=False, indent=1), encoding='utf-8')
    us = [p['u'] for p in placed]
    vs = [p['v'] for p in placed]
    box = (int(max(0, min(us) - 60)), int(max(0, min(vs) - 60)), int(min(1024, max(us) + 60)), int(min(1024, max(vs) + 60)))
    crop = img.crop(box)
    crop = crop.resize((int(crop.width * 1.6), int(crop.height * 1.6)), Image.LANCZOS)
    crop.save(OUT / 'debug_osm_overlay.jpg', quality=90)
    print('features', len(placed), 'box', box, 'saved', crop.size)


if __name__ == '__main__':
    main()
