"""Walk maps for the Area Dossiers: places each walking stop on the latest GSI aerial photograph.

    python3 walkmap.py geocode <id>|all     # finds coordinates for the walk stops, stores them as walk[].at
    (the map itself is drawn by draw(), called from dossier.py)

Stops are looked up by their Japanese name in OpenStreetMap's Nominatim, limited to a box around the district,
at most one request a second; a stop that cannot be found keeps no coordinates and is listed without a pin.
Coordinates from OpenStreetMap are credited in the PDF (ODbL)."""
import json, math, os, re, sys, time, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import basic, gsi

HERE = basic.HERE
DOSSIER_DIR = os.path.join(HERE, 'dossier')
UA = {'User-Agent': 'JapanTimeAtlas-lab07/1.0 (+https://japantimeatlas.com)'}
_last = [0.0]


def nominatim(q, box):
    s, w, n, e = box
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(
        {'q': q, 'format': 'json', 'limit': 1, 'viewbox': f'{w},{n},{e},{s}', 'bounded': 1, 'accept-language': 'ja'})
    wait = 1.1 - (time.time() - _last[0])
    if wait > 0:
        time.sleep(wait)
    _last[0] = time.time()
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
            res = json.load(r)
    except Exception as ex:
        print('   ! lookup failed', q, ex, file=sys.stderr)
        return None
    return (float(res[0]['lat']), float(res[0]['lon']), res[0].get('display_name', '')) if res else None


def candidates(stop):
    """Query strings for one stop, most specific first."""
    ja = (stop.get('ja') or '').strip()
    out = []
    for part in [ja] + re.split(r'[・／/、]', ja):
        part = re.sub(r'[（(][^）)]*[）)]', '', part).strip()
        if part and part not in out:
            out.append(part)
    name = re.sub(r'\([^)]*\)', '', stop.get('name', '')).strip()
    if name and name not in out:
        out.append(name)
    return out


def geocode(did):
    p = os.path.join(DOSSIER_DIR, did + '.json')
    d = json.load(open(p, encoding='utf-8'))
    c = basic.load_districts()[did]
    box = gsi.bbox(c['center'], max(4.0, c['half'] * 3))
    found = 0
    for w in d.get('walk', []):
        if w.get('at'):
            found += 1
            continue
        for q in candidates(w):
            hit = nominatim(q, box)
            if hit:
                w['at'] = [round(hit[0], 6), round(hit[1], 6)]
                w['atQuery'] = q
                found += 1
                break
    json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(p, 'a', encoding='utf-8').write('\n')
    print(did, f'{found}/{len(d.get("walk", []))} stops placed', flush=True)


def maps_url(at):
    return f'https://www.google.com/maps/search/?api=1&query={at[0]},{at[1]}'


def draw(walk, out_path, lang='en'):
    """Numbered stops on the latest aerial photo; returns (file name, width_km, height_km) or None."""
    from PIL import ImageDraw
    pts = [(i, w['at']) for i, w in enumerate(walk, 1) if w.get('at')]
    if len(pts) < 2:
        return None
    lats, lons = [a[0] for _, a in pts], [a[1] for _, a in pts]
    lat0 = (min(lats) + max(lats)) / 2
    kx = 111.320 * math.cos(math.radians(lat0))
    w_km = max((max(lons) - min(lons)) * kx + 0.5, 1.0)
    h_km = max((max(lats) - min(lats)) * 110.574 + 0.5, 0.8)
    if w_km / h_km < 1.4:
        w_km = h_km * 1.4
    else:
        h_km = w_km / 1.4
    lon0 = (min(lons) + max(lons)) / 2
    bb = (lat0 - h_km / 2 / 110.574, lon0 - w_km / 2 / kx, lat0 + h_km / 2 / 110.574, lon0 + w_km / 2 / kx)
    z = 17 if w_km <= 2.2 else 16 if w_km <= 4.5 else 15
    img, _ = gsi.mosaic('seamlessphoto', bb, z)
    img = basic.flatten(img).convert('RGB')
    f = basic.to_px(bb, img.size)
    d = ImageDraw.Draw(img, 'RGBA')
    r = max(14, img.width // 70)
    xy = [f(a[0], a[1]) for _, a in pts]
    for (x0, y0), (x1, y1) in zip(xy, xy[1:]):
        d.line([(x0, y0), (x1, y1)], fill=(255, 255, 255, 170), width=max(4, r // 4))
        d.line([(x0, y0), (x1, y1)], fill=(163, 58, 43, 230), width=max(2, r // 7))
    num_font = basic.font('Inter-SemiBold.ttf', int(r * 1.15))
    for (i, _), (x, y) in zip(pts, xy):
        d.ellipse([x - r, y - r, x + r, y + r], fill=(163, 58, 43, 245), outline=(255, 255, 255, 255), width=max(2, r // 6))
        t = str(i)
        tw = d.textlength(t, font=num_font)
        d.text((x - tw / 2, y - r * 0.72), t, font=num_font, fill=(255, 255, 255, 255))
    basic.annotate(img, basic.TXT[lang]['lbl_walkmap'], w_km, basic.TXT[lang]['sub_walkmap'], lang)
    name, _ = basic.save_jpg(img, out_path)
    return name, w_km, h_km


if __name__ == '__main__':
    if len(sys.argv) < 3 or sys.argv[1] != 'geocode':
        sys.exit(__doc__)
    ids = sorted(f[:-5] for f in os.listdir(DOSSIER_DIR) if f.endswith('.json')) if sys.argv[2] == 'all' else sys.argv[2:]
    for did in ids:
        geocode(did)
