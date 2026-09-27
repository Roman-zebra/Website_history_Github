"""Shared helpers for page 07: GSI tile fetching with a local cache, Web Mercator maths,
landform-classification vectors and the disaster-monument table.

Tiles are read from cyberjapandata.gsi.go.jp (GSI Tiles, https://maps.gsi.go.jp/development/ichiran.html)
and cached under $LAB07_CACHE (default: ./.cache/gsi). Nothing in the cache is committed."""
import io, json, math, os, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
CACHE = os.environ.get('LAB07_CACHE', os.path.join(ROOT, '.cache', 'gsi'))
BASE = 'https://cyberjapandata.gsi.go.jp/xyz/'
UA = 'JapanTimeAtlas-lab07/1.0 (+https://japantimeatlas.com)'

# Photo series used in the products, oldest first. ext = file type on the GSI server.
PHOTO_LAYERS = [
    ('ort_1928', 'png', 'c. 1928'),
    ('ort_riku10', 'png', 'c. 1936–1942'),
    ('ort_USA10', 'png', '1945–1950'),
    ('ort_old10', 'png', '1961–1969'),
    ('gazo1', 'jpg', '1974–1978'),
    ('gazo2', 'jpg', '1979–1983'),
    ('gazo3', 'jpg', '1984–1986'),
    ('gazo4', 'jpg', '1987–1990'),
    ('seamlessphoto', 'jpg', 'latest'),
]
EXT = {k: e for k, e, _ in PHOTO_LAYERS}
EXT.update({'pale': 'png', 'std': 'png', 'lcmfc2': 'png', 'lcm25k_2012': 'png', 'swale': 'png',
            'experimental_landformclassification1': 'geojson', 'experimental_landformclassification2': 'geojson'})


def deg2px(lat, lon, z):
    """Global pixel coordinates (256 px tiles) of a WGS84 point at zoom z."""
    n = 256 * 2 ** z
    x = (lon + 180.0) / 360.0 * n
    s = math.sin(math.radians(lat))
    y = (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n
    return x, y


def px2deg(x, y, z):
    n = 256 * 2 ** z
    lon = x / n * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lat, lon


def bbox(center, half_km):
    """(south, west, north, east) of a square of 2*half_km around center (lat, lon)."""
    lat, lon = center
    dlat = half_km / 110.574
    dlon = half_km / (111.320 * math.cos(math.radians(lat)))
    return lat - dlat, lon - dlon, lat + dlat, lon + dlon


def haversine_km(a, b):
    (la1, lo1), (la2, lo2) = a, b
    p1, p2 = math.radians(la1), math.radians(la2)
    dp, dl = p2 - p1, math.radians(lo2 - lo1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


def fetch(layer, z, x, y, retries=3):
    """Bytes of one tile, or None when GSI has no tile there (404). Cached on disk."""
    ext = EXT[layer]
    path = os.path.join(CACHE, layer, str(z), str(x), f'{y}.{ext}')
    miss = path + '.404'
    if os.path.exists(path):
        with open(path, 'rb') as f:
            return f.read()
    if os.path.exists(miss):
        return None
    url = f'{BASE}{layer}/{z}/{x}/{y}.{ext}'
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'wb') as f:
                f.write(data)
            return data
        except urllib.error.HTTPError as e:
            if e.code == 404:
                os.makedirs(os.path.dirname(path), exist_ok=True)
                open(miss, 'w').close()
                return None
            time.sleep(1.5 * (attempt + 1))
        except Exception:
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError('tile fetch failed: ' + url)


def tiles_for(bb, z):
    s, w, n, e = bb
    x0, y0 = deg2px(n, w, z)
    x1, y1 = deg2px(s, e, z)
    return [(x, y) for x in range(int(x0 // 256), int(x1 // 256) + 1) for y in range(int(y0 // 256), int(y1 // 256) + 1)]


def mosaic(layer, bb, z, workers=6):
    """PIL RGBA image of layer cropped exactly to bb at zoom z, plus the share of the
    square actually covered by imagery (0..1)."""
    from PIL import Image
    s, w, n, e = bb
    x0, y0 = deg2px(n, w, z)
    x1, y1 = deg2px(s, e, z)
    tx0, ty0, tx1, ty1 = int(x0 // 256), int(y0 // 256), int(x1 // 256), int(y1 // 256)
    canvas = Image.new('RGBA', ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256), (0, 0, 0, 0))
    jobs = [(tx, ty) for tx in range(tx0, tx1 + 1) for ty in range(ty0, ty1 + 1)]
    with ThreadPoolExecutor(workers) as ex:
        results = list(ex.map(lambda t: (t, fetch(layer, z, t[0], t[1])), jobs))
    for (tx, ty), data in results:
        if not data:
            continue
        tile = Image.open(io.BytesIO(data)).convert('RGBA')
        canvas.paste(tile, ((tx - tx0) * 256, (ty - ty0) * 256))
    left, top = int(round(x0 - tx0 * 256)), int(round(y0 - ty0 * 256))
    right, bottom = int(round(x1 - tx0 * 256)), int(round(y1 - ty0 * 256))
    img = canvas.crop((left, top, right, bottom))
    alpha = img.getchannel('A')
    hist = alpha.histogram()
    covered = 1 - hist[0] / max(1, img.width * img.height)
    # GSI fills some gaps with white or black; count near-white/near-black as uncovered too
    if covered > 0:
        small = img.convert('RGB').resize((64, 64))
        px = list(small.getdata())
        blank = sum(1 for r, g, b in px if (r > 248 and g > 248 and b > 248) or (r < 6 and g < 6 and b < 6))
        covered = min(covered, 1 - blank / len(px))
    return img, max(0.0, covered)


_LFC = None


def landform_legend():
    global _LFC
    if _LFC is None:
        with open(os.path.join(os.path.dirname(__file__), 'landform-legend.json'), encoding='utf-8') as f:
            _LFC = json.load(f)
    return _LFC


def landform_features(bb, z=14):
    """Landform polygons (natural + artificial) clipped to bb: list of (layer, code, shapely geom in lon/lat)."""
    from shapely.geometry import shape, box
    clip = box(bb[1], bb[0], bb[3], bb[2])
    out = []
    for layer in ('experimental_landformclassification1', 'experimental_landformclassification2'):
        for x, y in tiles_for(bb, z):
            data = fetch(layer, z, x, y)
            if not data:
                continue
            try:
                gj = json.loads(data)
            except Exception:
                continue
            for f in gj.get('features', []):
                try:
                    g = shape(f['geometry']).buffer(0)
                except Exception:
                    continue
                g = g.intersection(clip)
                if g.is_empty:
                    continue
                out.append((layer, str(f['properties'].get('code')), g))
    return out


def landform_shares(bb, z=14, feats=None):
    """Share of the study rectangle by English landform class, for the natural and the artificial layer.
    Polygons of one class are merged first, so a polygon repeated in neighbouring tiles counts once."""
    legend = landform_legend()
    from shapely.geometry import box
    from shapely.ops import unary_union
    total = box(bb[1], bb[0], bb[3], bb[2]).area
    groups = {'natural': {}, 'artificial': {}}
    for layer, code, g in (feats if feats is not None else landform_features(bb, z)):
        info = legend['codes'].get(code)
        if not info or info['class'] in ('note',):
            continue
        key = 'natural' if layer.endswith('1') else 'artificial'
        groups[key].setdefault(info['class'], []).append(g)
    return {k: {cls: unary_union(gs).area / total for cls, gs in v.items()} for k, v in groups.items()}


# Meiji-era lowland layer (swale): legend colours from https://maps.gsi.go.jp/legend/lw_legend.pdf
MEIJI = [
    ((254, 227, 200), 'sand', 'Sand and gravel', '砂礫地'),
    ((254, 200, 200), 'mud', 'Bare mud', '泥地'),
    ((228, 172, 123), 'peat', 'Peat', '泥炭地'),
    ((200, 200, 228), 'marsh', 'Marsh', '湿地'),
    ((209, 234, 255), 'tidal', 'Tidal flat or beach', '干潟・砂浜'),
    ((147, 200, 254), 'water', 'River, pond or sea', '河川・湖沼・海面'),
    ((251, 247, 176), 'paddy', 'Rice paddy', '田（水田・陸田）'),
    ((225, 227, 118), 'deeppaddy', 'Deep, boggy paddy', '深田'),
    ((227, 227, 200), 'salt', 'Salt pans', '塩田'),
    ((162, 222, 162), 'grass', 'Grassland', '草地'),
    ((173, 200, 147), 'waste', 'Uncultivated land', '荒地'),
    ((119, 227, 201), 'reed', 'Reed beds', 'ヨシ（芦葦）'),
    ((173, 255, 173), 'thatch', 'Thatch-grass fields', '茅'),
    ((144, 73, 11), 'bank', 'Embankment', '堤防'),
]


def meiji_shares(img):
    """Share of an RGBA swale mosaic by Meiji-era land class (opaque pixels matched to legend colours)."""
    from collections import Counter
    counts = Counter(p[:3] for p in img.getdata() if p[3] >= 200)
    total = img.width * img.height
    out = {}
    for rgb, n in counts.items():
        best, dist = None, 1e9
        for col, key, _, _ in MEIJI:
            dd = sum((a - b) ** 2 for a, b in zip(rgb, col))
            if dd < dist:
                best, dist = key, dd
        if dist <= 300:
            out[best] = out.get(best, 0) + n / total
    return out


_MON = None


def monuments():
    global _MON
    if _MON is None:
        with open(os.path.join(ROOT, 'data', 'monuments.json'), encoding='utf-8') as f:
            _MON = json.load(f)
    return _MON


def monuments_near(center, radius_km):
    out = []
    for m in monuments():
        d = haversine_km(center, (m['lat'], m['lon']))
        if d <= radius_km:
            out.append(dict(m, dist_km=round(d, 2)))
    return sorted(out, key=lambda m: m['dist_km'])
