"""Pull the named features on Hashima out of an OpenStreetMap map download into osm_named.json.

    curl -A "your-app/1.0" "https://api.openstreetmap.org/api/0.6/map?bbox=129.7345,32.6245,129.7425,32.6315" -o osm.xml
    python osm_extract.py

Map data © OpenStreetMap contributors, ODbL.
"""
import json
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOUTH, WEST, NORTH, EAST = 32.6245, 129.7345, 32.6315, 129.7425


def main():
    root = ET.parse(HERE / 'osm.xml').getroot()
    nodes = {n.get('id'): (float(n.get('lat')), float(n.get('lon'))) for n in root.iter('node')}
    out = []
    for el in root:
        tags = {t.get('k'): t.get('v') for t in el.findall('tag')}
        name = tags.get('name') or tags.get('name:ja')
        if not name and not ({'historic', 'man_made', 'tourism'} & set(tags)):
            continue
        if el.tag == 'node':
            pts = [(float(el.get('lat')), float(el.get('lon')))]
        else:
            pts = [nodes[nd.get('ref')] for nd in el.findall('nd') if nd.get('ref') in nodes]
        if not pts:
            continue
        lat = sum(p[0] for p in pts) / len(pts)
        lon = sum(p[1] for p in pts) / len(pts)
        if not (SOUTH < lat < NORTH and WEST < lon < EAST):
            continue
        out.append({'type': el.tag, 'id': el.get('id'), 'lat': round(lat, 6), 'lon': round(lon, 6), 'name': name,
                    'tags': {k: v for k, v in tags.items() if k != 'name'},
                    'outline': [[round(a, 6), round(b, 6)] for a, b in pts] if el.tag == 'way' else None})
    (HERE / 'osm_named.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    print(len(out), 'features')


if __name__ == '__main__':
    main()
