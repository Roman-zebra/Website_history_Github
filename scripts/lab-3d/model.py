"""Reconstruction model for the lab viewer v4 -> web/gunkanjima-model.json + web/gunkanjima-terrain.bin

Every building carries an outline (OpenStreetMap, or traced from the 1962 height grid), storeys and a
completion year from the published building list (buildings_facts.json), a use, and the roof heights
measured in the stereo grids. The viewer raises each one as a prism for the years in which it stood.
Terrain: GSI 5 m elevation resampled into the crop frame, gaps filled from the stereo ground, lightly
smoothed. Sea wall: the OpenStreetMap retaining-wall ring with a top height read from the 1962 grid.

    python model.py
"""
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
OUT = HERE / 'out'
WEB = HERE / 'web'
FLOOR_RES, FLOOR_IND = 2.85, 4.3


def lonlat_to_crop(geo, lon, lat):
    M = np.vstack([np.array(geo['M_crop_to_mosaic']), [0, 0, 1]])
    n = 256 * 2 ** geo['z']
    gx = (lon + 180) / 360 * n
    phi = math.radians(lat)
    gy = (1 - math.log(math.tan(phi) + 1 / math.cos(phi)) / math.pi) / 2 * n
    mx, my = gx - geo['tile_x0'] * 256 - 0.5, gy - geo['tile_y0'] * 256 - 0.5
    u, v, w = np.linalg.inv(M) @ np.array([mx, my, 1.0])
    return float(u / w), float(v / w)


def way_points(root, nodes, way_id):
    for w in root.iter('way'):
        if w.get('id') == way_id:
            return [nodes[nd.get('ref')] for nd in w.findall('nd') if nd.get('ref') in nodes]
    return []


def style_for(name, facts, wallh):
    f = facts or {}
    use, struct = f.get('use', ''), f.get('structure', '')
    if '神社' in use:
        return 'shrine'
    if struct in ('wood', 'wood+RC', 'prefab'):
        return 'wood'
    if '日給社宅' in use:
        return 'nikkyu'
    if '学校' in use and '体育' not in use:
        return 'school'
    if '社宅' in use or '住宅' in use or '合宿' in use or '飯場' in use or '寮' in use or '病院' in use or '病棟' in use or '公民館' in use or '役場' in use:
        return 'apartment'
    if name and ('号棟' in name):
        return 'apartment'
    return 'industrial'


def main():
    geo = json.loads((OUT / 'georef.json').read_text())
    lab = json.loads((WEB / 'gunkanjima-lab.json').read_text(encoding='utf-8')); g = lab['grid']; mpp = lab['frame']['metersPerPixel']
    facts = json.loads((HERE / 'buildings_facts.json').read_text(encoding='utf-8'))
    F = facts['buildings']
    osm = json.loads((WEB / 'gunkanjima-buildings.json').read_text(encoding='utf-8'))['buildings']
    traced = json.loads((OUT / 'traced_1962.json').read_text(encoding='utf-8'))

    # ---- terrain: DEM with gaps filled from the stereo ground, smoothed ----
    def grid(name):
        a = np.fromfile(WEB / name, dtype='<u2').reshape(g['h'], g['w']).astype(np.float32) * g['unit']
        f = np.zeros((1024, 1024), np.float32); f[g['y0']:g['y0'] + g['h'], g['x0']:g['x0'] + g['w']] = a; return f
    h62 = grid(g['h1962'])
    dem = np.load(OUT / 'dem_crop.npy'); island = np.load(OUT / 'island.npy')
    # stereo ground = a wide minimum of the 1962 heights (streets and yards between the blocks)
    stereo_ground = cv2.erode(h62, np.ones((21, 21), np.uint8))
    stereo_ground = cv2.GaussianBlur(stereo_ground, (0, 0), 3.0)
    terr = np.where(np.isnan(dem), stereo_ground, dem)
    terr = np.where(island, terr, 0.0).astype(np.float32)
    terr = cv2.GaussianBlur(terr, (0, 0), 1.2)
    terr[~island] = 0.0
    sub = terr[g['y0']:g['y0'] + g['h'], g['x0']:g['x0'] + g['w']]
    (WEB / 'gunkanjima-terrain.bin').write_bytes(np.clip(np.round(sub / g['unit']), 0, 65535).astype('<u2').tobytes())

    def ground_at(poly):
        m = Image.new('L', (1024, 1024), 0)
        ImageDraw.Draw(m).polygon([tuple(p) for p in poly], fill=255)
        mm = np.array(m) > 0
        big = cv2.dilate(mm.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
        vals = terr[big & island]
        return float(np.percentile(vals, 35)) if vals.size else 0.0

    # ---- buildings ----
    buildings = []
    alias = {k: v['alias'] for k, v in F.items() if 'alias' in v}
    for b in osm:
        name = b['name'] or ''
        key = alias.get(name, name)
        f = F.get(key)
        wallh_meas = max(b['roof1962'], b['roof2010']) - b['ground']
        style = style_for(name, f, wallh_meas)
        storeys = f.get('storeys') if f else None
        floor = FLOOR_RES if style in ('apartment', 'nikkyu', 'wood', 'shrine') else (3.6 if style == 'school' else FLOOR_IND)
        if storeys is None:
            storeys = max(1, round(wallh_meas / floor)) if wallh_meas > 2.5 else 1
            storeys_note = '高さから推定'
        else:
            storeys_note = None
        entry = {
            'id': b['id'], 'name': name or None, 'poly': b['poly'], 'ground': round(ground_at(b['poly']), 1),
            'storeys': int(storeys), 'floorH': floor, 'style': style,
            'built': (f or {}).get('built'), 'gone': (f or {}).get('gone'),
            'structure': (f or {}).get('structure'), 'use': (f or {}).get('use'), 'units': (f or {}).get('units'),
            'notes': (f or {}).get('notes'), 'builtNote': (f or {}).get('builtNote'),
            'roof1962': b['roof1962'], 'roof2010': b['roof2010'], 'source': 'osm' if not b.get('traced') else 'traced',
        }
        if storeys_note:
            entry['storeysNote'] = storeys_note
        # a measured collapse: standing height in 2010 well below 1962 -> mark as fallen before 2010
        if entry['gone'] is None and b['roof2010'] - b['ground'] < 0.55 * (b['roof1962'] - b['ground']) and b['roof1962'] - b['ground'] > 4:
            entry['gone'] = 2000
            entry['goneNote'] = '2010年の写真で高さが大きく減っている（崩壊時期は不明、2000年としている）'
        if b.get('traced'):
            # Building No. 30: a hollow square; model it as four wings around a courtyard
            p = np.array(b['poly'], np.float64)
            c = p.mean(axis=0)
            inner = c + (p - c) * 0.36
            wings = []
            for i in range(4):
                a, bpt = p[i], p[(i + 1) % 4]
                ia, ib = inner[i], inner[(i + 1) % 4]
                wings.append([[round(float(x), 1), round(float(y), 1)] for x, y in (a, bpt, ib, ia)])
            entry['wings'] = wings
            entry['name'] = '30号棟'
            entry['courtyard'] = True
        buildings.append(entry)
    # traced 1962-only structures (no OSM outline)
    for t in traced:
        wallh = t['roof1962'] - t['ground']
        st = max(1, min(3, round(wallh / FLOOR_RES)))
        buildings.append({
            'id': t['id'], 'name': None, 'poly': t['poly'], 'ground': round(ground_at(t['poly']), 1),
            'storeys': st, 'floorH': FLOOR_RES, 'style': 'wood' if wallh < 9 else 'apartment',
            'built': None, 'seen': 1962, 'gone': None if t['standing2010'] else 2000,
            'goneNote': None if t['standing2010'] else '2010年の写真では低い',
            'structure': None, 'use': '1962年の写真に写る建物（名称不明・輪郭は高さ格子から）',
            'roof1962': t['roof1962'], 'roof2010': t['roof2010'], 'source': 'traced1962'
        })

    # ---- sea wall and coast from OSM ----
    root = ET.parse(HERE / 'osm.xml').getroot()
    nodes = {n.get('id'): (float(n.get('lat')), float(n.get('lon'))) for n in root.iter('node')}
    wall_ll = way_points(root, nodes, '192217475')
    coast_ll = way_points(root, nodes, '191502696')
    wall = [lonlat_to_crop(geo, lon, lat) for lat, lon in wall_ll]
    coast = [lonlat_to_crop(geo, lon, lat) for lat, lon in coast_ll]
    def top_at(u, v):
        x, y = int(round(u)), int(round(v))
        win = h62[max(0, y - 3):y + 4, max(0, x - 3):x + 4]
        win = win[win > 0.05]
        return float(np.clip(np.percentile(win, 80) if win.size else 6.0, 3.0, 12.0))
    seawall = [{'u': round(u, 1), 'v': round(v, 1), 'top': round(top_at(u, v), 1)} for u, v in wall]

    model = {
        'frame': lab['frame'], 'principalPoint': lab['principalPoint'], 'flyingHeightM': lab['flyingHeightM'], 'north': lab['north'],
        'terrain': {'x0': g['x0'], 'y0': g['y0'], 'w': g['w'], 'h': g['h'], 'unit': g['unit'], 'file': 'gunkanjima-terrain.bin',
                    'source': 'GSI 5 m DEM (dem5b) resampled; gaps from the 1962 stereo ground'},
        'seawall': seawall, 'coast': [[round(u, 1), round(v, 1)] for u, v in coast],
        'buildings': buildings,
        'facts': {'source': facts['source'], 'url': facts['sourceUrl']},
    }
    (WEB / 'gunkanjima-model.json').write_text(json.dumps(model, ensure_ascii=False, indent=0), encoding='utf-8')
    named = [b for b in buildings if b['name']]
    print('buildings', len(buildings), 'named', len(named), 'with built year', sum(1 for b in buildings if b['built']), 'traced', len(traced))
    print('seawall points', len(seawall), 'top m', np.percentile([s['top'] for s in seawall], [10, 50, 90]))
    print('terrain on island pct', np.percentile(terr[island], [5, 50, 95]).round(1))
    for b in named:
        print(f"{b['name']:12s} {b['style']:10s} storeys {b['storeys']} built {b['built']} gone {b['gone']} ground {b['ground']} roof62 {b['roof1962']}")


if __name__ == '__main__':
    main()
