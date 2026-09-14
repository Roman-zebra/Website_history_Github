"""Building footprints for the lab viewer: every OpenStreetMap building on Hashima, in 1962 crop
pixels, with a roof height per measured year taken from the stereo height grids.

    python buildings.py   ->  web/gunkanjima-buildings.json

Map data (c) OpenStreetMap contributors, ODbL. Heights: out/height.npy (1962), out2010/height.npy (2010),
already in the 1962 crop frame (export_web.py resamples 2010 into it; here we use the exported grid).
"""
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
OUT = HERE / 'out'
WEB = HERE / 'web'


def lonlat_to_crop(geo, lon, lat):
    M = np.vstack([np.array(geo['M_crop_to_mosaic']), [0, 0, 1]])
    n = 256 * 2 ** geo['z']
    gx = (lon + 180) / 360 * n
    phi = math.radians(lat)
    gy = (1 - math.log(math.tan(phi) + 1 / math.cos(phi)) / math.pi) / 2 * n
    mx, my = gx - geo['tile_x0'] * 256 - 0.5, gy - geo['tile_y0'] * 256 - 0.5
    u, v, w = np.linalg.inv(M) @ np.array([mx, my, 1.0])
    return float(u / w), float(v / w)


def load_grid(lab, name):
    g = lab['grid']
    a = np.fromfile(WEB / name, dtype='<u2').reshape(g['h'], g['w']).astype(np.float32) * g['unit']
    full = np.zeros((1024, 1024), np.float32)
    full[g['y0']:g['y0'] + g['h'], g['x0']:g['x0'] + g['w']] = a
    return full


def main():
    geo = json.loads((OUT / 'georef.json').read_text())
    lab = json.loads((WEB / 'gunkanjima-lab.json').read_text(encoding='utf-8'))
    h62, h10 = load_grid(lab, lab['grid']['h1962']), load_grid(lab, lab['grid']['h2010'])
    root = ET.parse(HERE / 'osm.xml').getroot()
    nodes = {n.get('id'): (float(n.get('lat')), float(n.get('lon'))) for n in root.iter('node')}
    out = []
    for w in root.iter('way'):
        tags = {t.get('k'): t.get('v') for t in w.findall('tag')}
        if 'building' not in tags:
            continue
        pts = [nodes[nd.get('ref')] for nd in w.findall('nd') if nd.get('ref') in nodes]
        if len(pts) < 4:
            continue
        poly = [lonlat_to_crop(geo, lon, lat) for lat, lon in pts]
        if poly[0] != poly[-1]:
            poly.append(poly[0])
        mask = Image.new('L', (1024, 1024), 0)
        ImageDraw.Draw(mask).polygon([(round(u, 2), round(v, 2)) for u, v in poly], fill=255)
        m = np.array(mask) > 0
        area_px = int(m.sum())
        if area_px < 6:
            continue
        # ring just outside the footprint (1 to 5 px away) = ground level around the building
        from PIL import ImageFilter
        big = np.array(mask.filter(ImageFilter.MaxFilter(11))) > 0
        near = np.array(mask.filter(ImageFilter.MaxFilter(3))) > 0
        r = big & ~near & (h62 > 0.05)
        # shrink the footprint by two pixels so smeared wall pixels do not pull the roof down
        core = np.array(mask.filter(ImageFilter.MinFilter(5))) > 0
        core = core if core.sum() >= 4 else m
        def roof(h):
            return float(np.percentile(h[core], 70))
        def ground(h):
            return float(np.percentile(h[r], 25)) if r.sum() else 0.0
        name = tags.get('name') or tags.get('name:ja') or ''
        osm_h = float(tags['height']) if tags.get('height', '').replace('.', '', 1).isdigit() else None
        out.append({
            'id': w.get('id'), 'name': name, 'osmHeightM': osm_h,
            'poly': [[round(u, 1), round(v, 1)] for u, v in poly[:-1]],
            'areaM2': round(area_px * lab['frame']['metersPerPixel'] ** 2),
            'ground': round(min(ground(h62), ground(h10)), 1),
            'roof1962': round(roof(h62), 1), 'roof2010': round(roof(h10), 1),
        })
    out.sort(key=lambda b: -b['areaM2'])
    (WEB / 'gunkanjima-buildings.json').write_text(json.dumps({'source': 'OpenStreetMap contributors, ODbL; roof heights from the stereo grids (70th percentile inside the footprint), ground from a ring just outside', 'buildings': out}, ensure_ascii=False, indent=0), encoding='utf-8')
    for b in out:
        print(f"{b['name'] or '-':14s} area {b['areaM2']:5d} m2  ground {b['ground']:5.1f}  roof62 {b['roof1962']:5.1f}  roof10 {b['roof2010']:5.1f}  osm {b['osmHeightM']}")
    print(len(out), 'buildings')


if __name__ == '__main__':
    main()
