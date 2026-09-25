#!/usr/bin/env python3
"""Share images for the place pages (og:image, 1200x630).

Each image is the place from the air, split down the middle like the map's slider: the old GSI photograph on
the left, the latest on the right, with the photo series period, the place name and the site name on it.
One image per place serves every language version of its page, so the text on it is limited to the English
and Japanese names, numbers and the site name. og:title and og:description carry the page's own language.

Not part of scripts/build.cjs: the build must work without the network, and this script downloads GSI tiles.
Run it when places are added or moved, then commit og/. Tiles are cached in .og-cache/ (ignored by git),
so a second run only redraws.

    python3 scripts/build-og-images.py              # every place page that has no image yet
    python3 scripts/build-og-images.py --force      # redraw everything
    python3 scripts/build-og-images.py --only hiroshima,l-hashima-island --force
    python3 scripts/build-og-images.py --probe      # print the chosen series and coverage, write nothing
    python3 scripts/build-og-images.py --generic    # also redraw og.jpg, the image of the pages without a place

Requires Pillow. Fonts: DejaVu Sans (Latin) and IPAGothic (Japanese) on Linux, Arial and Hiragino on macOS,
Arial and Yu Gothic on Windows; override with OG_FONT_BOLD, OG_FONT_REGULAR and OG_FONT_JA.

Which old photograph: a main place (data/places-world.json) uses the series its page names (`then`). Every other
spot uses the rule of pickOldLayer() in explore.js: the oldest of the six series that has a tile at zoom 16 at
the spot. If that series covers less than 70% of the left half at the image's zoom, the next one is tried; if
none does, the image shows the latest photograph alone and says no period.

The photographs are GSI's (国土地理院). The Japanese Survey Act can require approval to reproduce them as they
are, so, as with the 3D pages, only processed images are published, credited on the image
「国土地理院の空中写真を加工して作成」. Keep the credit if you change the layout.
"""
import argparse
import concurrent.futures
import io
import json
import math
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'og'
CACHE = ROOT / '.og-cache' / 'tiles'
GSI = 'https://cyberjapandata.gsi.go.jp/xyz'
UA = 'JapanTimeAtlas-share-images/1.0 (+https://japantimeatlas.com/about)'
W, H = 1200, 630
HALF = W // 2
MIN_COVER = 0.70

# Same order as OLD_LAYERS in explore.js: oldest first.
OLD_LAYERS = [
    ('ort_USA10', 'png', '1945–1950'),
    ('ort_old10', 'png', '1961–1969'),
    ('gazo1', 'jpg', '1974–1978'),
    ('gazo2', 'jpg', '1979–1983'),
    ('gazo3', 'jpg', '1984–1986'),
    ('gazo4', 'jpg', '1987–1990'),
]
LAYER = {name: (name, ext, period) for name, ext, period in OLD_LAYERS}

# How close to look. 16 shows about 2.3 km across at these latitudes, 17 about 1.2 km.
LANDMARK_ZOOM = {'mountain': 13, 'nature': 15, 'onsen': 15, 'art': 15, 'city': 17, 'market': 17, 'station': 17,
                 'tower': 17, 'aquarium': 17}
LANDMARK_ZOOM_BY_KEY = {'m-mount-koya': 15}
LIMINAL_ZOOM = {'aokigahara': 15, 'yubari-hokkaido': 15, 'tashirojima': 15, 'okunoshima': 15, 'tomogashima': 15,
                'sarushima': 16, 'inujima': 16, 'ikeshima': 16, 'zao-onsen': 16, 'kinugawa-onsen': 16,
                'nokogiriyama': 16, 'ashio-copper-mine': 16, 'chofu-airport': 16, 'ikoma-sanjo': 16}

PAPER = (226, 219, 203)
INK = (27, 27, 27)
LIGHT = (255, 253, 248)
NOW_RED = (224, 70, 62)


def font_path(env, candidates):
    if os.environ.get(env):
        return os.environ[env]
    for c in candidates:
        if Path(c).exists():
            return c
    sys.exit('No font for ' + env + '; set it to a .ttf/.ttc path')


FONT_BOLD = font_path('OG_FONT_BOLD', [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf',
    'C:/Windows/Fonts/arialbd.ttf'])
FONT_REGULAR = font_path('OG_FONT_REGULAR', [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf', '/Library/Fonts/Arial.ttf',
    'C:/Windows/Fonts/arial.ttf'])
FONT_JA = font_path('OG_FONT_JA', [
    '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf', '/usr/share/fonts/truetype/fonts-japanese-gothic.ttf',
    '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc', '/System/Library/Fonts/Hiragino Sans GB.ttc',
    'C:/Windows/Fonts/YuGothB.ttc', 'C:/Windows/Fonts/meiryob.ttc'])


def font(path, size):
    return ImageFont.truetype(path, size)


# --------------------------------------------------------------------------------------------- places

def slug(text):
    """slug() in build-spot-pages.cjs: the file name of a landmark's page."""
    t = unicodedata.normalize('NFKD', str(text or ''))
    t = ''.join(c for c in t if not 0x300 <= ord(c) <= 0x36f).lower()
    return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', t))


def targets():
    read = lambda p: json.loads((ROOT / p).read_text(encoding='utf-8'))
    src = (ROOT / 'activities-data.js').read_text(encoding='utf-8')
    activities = json.loads(src[src.index('{'):src.rindex('}') + 1])['places']
    m_pages = {f.name[2:-5] for f in (ROOT / 'place').glob('m-*.html')}
    out = []
    for p in read('data/places-world.json')['places']:
        out.append({'key': p['id'], 'lat': p['lat'], 'lon': p['lon'], 'en': p['names']['en'],
                    'ja': p['names'].get('ja') or p.get('name_ja'), 'zoom': max(13, min(17, p.get('zoom', 16))),
                    'then': p.get('then') or None})
    for m in read('data/landmarks.json')['landmarks']:
        key = next(('m-' + s for s in (slug(m.get('name')), slug(m.get('wiki_en')), slug(m.get('wiki')))
                    if s in m_pages), None)
        if not key:
            sys.exit('landmark without a page: ' + m['name'])
        names = m.get('names') or {}
        out.append({'key': key, 'lat': m['lat'], 'lon': m['lon'], 'en': names.get('en') or m['name'],
                    'ja': names.get('ja') or m.get('ja'),
                    'zoom': LANDMARK_ZOOM_BY_KEY.get(key, LANDMARK_ZOOM.get(m.get('kind'), 16)), 'then': None})
    for p in read('data/liminal.json')['places']:
        names = p.get('names') or {}
        out.append({'key': 'l-' + p['id'], 'lat': p['lat'], 'lon': p['lon'], 'en': names.get('en') or p['name'],
                    'ja': names.get('ja') or p.get('ja'), 'zoom': LIMINAL_ZOOM.get(p['id'], 17), 'then': None})
    for a in activities:
        out.append({'key': 'a-' + a['id'], 'lat': a['lat'], 'lon': a['lon'], 'en': a['names']['en'],
                    'ja': a['names'].get('ja'), 'zoom': 17, 'then': None})
    for t in out:
        if not (ROOT / 'place' / (t['key'] + '.html')).exists():
            sys.exit('no English page for ' + t['key'])
    return out


# ---------------------------------------------------------------------------------------------- tiles

def project(lat, lon, z):
    """Global pixel coordinates at zoom z (256 px tiles), as Leaflet and deg2tile() in explore.js."""
    n = 256 * 2 ** z
    r = math.radians(lat)
    return (lon + 180) / 360 * n, (1 - math.asinh(math.tan(r)) / math.pi) / 2 * n


def fetch(layer, ext, z, x, y):
    """A tile as RGBA, or None where GSI has none (404). Cached, including the 404s."""
    path = CACHE / layer / str(z) / str(x) / (str(y) + '.' + ext)
    missing = path.with_name(path.name + '.404')
    if path.exists():
        return Image.open(path).convert('RGBA')
    if missing.exists():
        return None
    url = '%s/%s/%d/%d/%d.%s' % (GSI, layer, z, x, y, ext)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30) as r:
                data = r.read()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            return Image.open(io.BytesIO(data)).convert('RGBA')
        except urllib.error.HTTPError as e:
            if e.code == 404:
                missing.parent.mkdir(parents=True, exist_ok=True)
                missing.touch()
                return None
            time.sleep(2 ** attempt)
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            time.sleep(2 ** attempt)
    raise RuntimeError('cannot fetch ' + url)


POOL = concurrent.futures.ThreadPoolExecutor(max_workers=4)


def mosaic(layer, ext, z, left, top, width, height):
    """The rectangle (left, top, width, height) in global pixels at zoom z, from as many tiles as it touches."""
    x0, y0 = int(math.floor(left)), int(math.floor(top))
    tx0, ty0, tx1, ty1 = x0 // 256, y0 // 256, (x0 + width - 1) // 256, (y0 + height - 1) // 256
    canvas = Image.new('RGBA', ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256), (0, 0, 0, 0))
    cells = [(tx, ty) for ty in range(ty0, ty1 + 1) for tx in range(tx0, tx1 + 1)]
    for (tx, ty), tile in zip(cells, POOL.map(lambda c: fetch(layer, ext, z, c[0], c[1]), cells)):
        if tile is not None:
            canvas.paste(tile, ((tx - tx0) * 256, (ty - ty0) * 256))
    ox, oy = x0 - tx0 * 256, y0 - ty0 * 256
    return canvas.crop((ox, oy, ox + width, oy + height))


def coverage(img):
    return 1 - img.getchannel('A').histogram()[0] / (img.width * img.height)


def has_tile_at(layer, ext, lat, lon):
    x, y = (int(v // 256) for v in project(lat, lon, 16))
    return fetch(layer, ext, 16, x, y) is not None


def choose_then(t, left, top):
    """(layer, period, image of the left half) or (None, None, None)."""
    z = t['zoom']
    if t['then']:
        order = [LAYER[t['then']]]
    else:
        first = next((i for i, (name, ext, _) in enumerate(OLD_LAYERS) if has_tile_at(name, ext, t['lat'], t['lon'])), None)
        order = OLD_LAYERS[first:] if first is not None else []
    for name, ext, period in order:
        if z < (10 if name.startswith('gazo') else 2):
            continue
        img = mosaic(name, ext, z, left, top, HALF, H)
        cover = coverage(img)
        t.setdefault('tried', []).append('%s %.0f%%' % (name, cover * 100))
        if cover >= MIN_COVER:
            return name, period, img
    return None, None, None


# ---------------------------------------------------------------------------------------------- drawing

def text_width(draw, text, f):
    box = draw.textbbox((0, 0), text, font=f)
    return box[2] - box[0]


def shadowed(base, xy, text, f, fill, radius=3, offset=(0, 2), shadow=(0, 0, 0, 170), anchor='ls'):
    layer = Image.new('RGBA', base.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((xy[0] + offset[0], xy[1] + offset[1]), text, font=f, fill=shadow, anchor=anchor)
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(radius)))
    ImageDraw.Draw(base).text(xy, text, font=f, fill=fill, anchor=anchor)


def badge(base, text, right=False, fill=LIGHT, ink=INK):
    f = font(FONT_BOLD, 30)
    d = ImageDraw.Draw(base)
    tw = text_width(d, text, f)
    w, h = tw + 44, 56
    x = W - 32 - w if right else 32
    shade = Image.new('RGBA', base.size, (0, 0, 0, 0))
    ImageDraw.Draw(shade).rounded_rectangle((x, 34, x + w, 34 + h), radius=h // 2, fill=(0, 0, 0, 90))
    base.alpha_composite(shade.filter(ImageFilter.GaussianBlur(4)))
    d.rounded_rectangle((x, 32, x + w, 32 + h), radius=h // 2, fill=fill)
    d.text((x + w / 2, 32 + h / 2 + 1), text, font=f, fill=ink, anchor='mm')


def handle(base):
    # The place itself is at the centre of the frame, so the slider handle sits in the upper third.
    cx, cy, r = HALF, 190, 28
    d = ImageDraw.Draw(base)
    shade = Image.new('RGBA', base.size, (0, 0, 0, 0))
    ImageDraw.Draw(shade).rectangle((HALF - 3, 0, HALF + 3, H), fill=(0, 0, 0, 80))
    ImageDraw.Draw(shade).ellipse((cx - 31, cy - 29, cx + 31, cy + 33), fill=(0, 0, 0, 110))
    base.alpha_composite(shade.filter(ImageFilter.GaussianBlur(4)))
    d.rectangle((HALF - 2, 0, HALF + 1, H), fill=LIGHT)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=LIGHT)
    d.polygon([(cx - 7, cy - 9), (cx - 7, cy + 9), (cx - 18, cy)], fill=INK)
    d.polygon([(cx + 7, cy - 9), (cx + 7, cy + 9), (cx + 18, cy)], fill=INK)


def fit_title(draw, text, max_width):
    """One line if it fits at 44 px or more, otherwise two lines at the largest size that fits."""
    for size in range(68, 43, -2):
        f = font(FONT_BOLD, size)
        if text_width(draw, text, f) <= max_width:
            return f, [text]
    words = text.split(' ')
    for size in range(52, 33, -2):
        f = font(FONT_BOLD, size)
        for cut in range(len(words) - 1, 0, -1):
            a, b = ' '.join(words[:cut]), ' '.join(words[cut:])
            if text_width(draw, a, f) <= max_width and text_width(draw, b, f) <= max_width:
                return f, [a, b]
    return font(FONT_BOLD, 34), [text]


def draw_card(old_half, new_img, title, ja, period, footer):
    """old_half: 600x630 RGBA or None; new_img: 1200x630 (or its right half when old_half is given)."""
    card = Image.new('RGBA', (W, H), PAPER + (255,))
    if old_half is not None:
        backed = Image.new('RGBA', old_half.size, PAPER + (255,))
        backed.alpha_composite(old_half)
        grey = ImageOps.autocontrast(backed.convert('RGB'), cutoff=0.5, preserve_tone=True)
        card.paste(grey.convert('RGBA'), (0, 0))
        card.paste(new_img.convert('RGBA'), (HALF, 0))
    else:
        card.paste(new_img.convert('RGBA'), (0, 0))
    # darken the foot for the text
    fade = Image.new('L', (W, H), 0)
    fd = ImageDraw.Draw(fade)
    for y in range(300, H):
        fd.line((0, y, W, y), fill=int(215 * ((y - 300) / (H - 300)) ** 1.3))
    shade = Image.new('RGBA', (W, H), (8, 10, 12, 0))
    shade.putalpha(fade)
    card.alpha_composite(shade)
    if old_half is not None:
        handle(card)
        badge(card, period)
        badge(card, 'TODAY', right=True, fill=NOW_RED, ink=(255, 255, 255))
    else:
        badge(card, 'TODAY', right=True, fill=NOW_RED, ink=(255, 255, 255))
    d = ImageDraw.Draw(card)
    f, lines = fit_title(d, title, W - 96)
    y = 548 if len(lines) == 1 else 500
    if ja and ja != title:
        fj = font(FONT_JA, 30)
        top_of_title = y - (f.size * (len(lines) - 1) * 1.12) - f.size * 0.95
        shadowed(card, (48, int(top_of_title - 14)), ja, fj, (241, 233, 214), radius=4, shadow=(0, 0, 0, 230))
    for i, line in enumerate(lines):
        shadowed(card, (46, int(y + i * f.size * 1.12)), line, f, (255, 255, 255))
    ff = font(FONT_BOLD, 21)
    shadowed(card, (48, 596), footer, ff, (236, 232, 222), radius=2)
    latin, fc = ' · GSI Japan', font(FONT_REGULAR, 14)
    shadowed(card, (W - 32, 612), latin, fc, (226, 222, 212), radius=2, anchor='rs')
    shadowed(card, (W - 32 - text_width(d, latin, fc), 612), '国土地理院の空中写真を加工して作成', font(FONT_JA, 15),
             (226, 222, 212), radius=2, anchor='rs')
    return card.convert('RGB')


def render(t, title=None, footer='JAPAN TIME ATLAS · japantimeatlas.com'):
    z = t['zoom']
    px, py = project(t['lat'], t['lon'], z)
    left, top = px - HALF, py - H / 2
    layer, period, old_half = choose_then(t, left, top)
    if old_half is not None:
        new = mosaic('seamlessphoto', 'jpg', z, left + HALF, top, HALF, H)
    else:
        new = mosaic('seamlessphoto', 'jpg', z, left, top, W, H)
    if coverage(new) < 0.9:
        raise RuntimeError(t['key'] + ': the latest photograph does not cover the frame')
    card = draw_card(old_half, new, title or t['en'], t.get('ja'), period, footer)
    return card, layer, period


def save(card, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    card.save(path, 'JPEG', quality=72, optimize=True, progressive=True, subsampling='4:2:0')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='comma-separated page keys, e.g. hiroshima,l-hashima-island')
    ap.add_argument('--force', action='store_true', help='redraw images that already exist')
    ap.add_argument('--probe', action='store_true', help='print the chosen series and coverage, write nothing')
    ap.add_argument('--generic', action='store_true', help='also redraw og.jpg')
    args = ap.parse_args()
    manifest_path = OUT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    wanted = set(args.only.split(',')) if args.only else None
    all_targets, failed = targets(), []
    if wanted and wanted - {t['key'] for t in all_targets}:
        sys.exit('unknown keys: ' + ', '.join(sorted(wanted - {t['key'] for t in all_targets})))
    for t in all_targets:
        if wanted and t['key'] not in wanted:
            continue
        out = OUT / (t['key'] + '.jpg')
        if out.exists() and t['key'] in manifest and not (args.force or args.probe):
            continue
        if args.probe:
            px, py = project(t['lat'], t['lon'], t['zoom'])
            layer, period, _ = choose_then(t, px - HALF, py - H / 2)
            print('%-44s z%d %-10s %s' % (t['key'], t['zoom'], layer or 'latest', ', '.join(t.get('tried', []))))
            continue
        try:
            card, layer, period = render(t)
        except RuntimeError as e:
            failed.append(t['key'])
            print('FAILED', e)
            continue
        save(card, out)
        manifest[t['key']] = {'then': layer, 'period': period, 'zoom': t['zoom']}
        print('%-44s %-10s %6.0f KB' % (t['key'], layer or 'latest', out.stat().st_size / 1024))
    if args.generic and not args.probe:
        # The pages without a place of their own (home pages, guides, country pages): central Hiroshima between
        # Aioi Bridge and the castle moat, as before, now with the site's name.
        t = {'key': 'og', 'lat': 34.3985, 'lon': 132.4555, 'zoom': 16, 'then': 'ort_USA10', 'ja': '日本の今昔マップ'}
        card, _, _ = render(t, title='Japan Time Atlas',
                            footer='Drag the slider. Eighty years go by. · japantimeatlas.com')
        save(card, ROOT / 'og.jpg')
        print('og.jpg', '%.0f KB' % ((ROOT / 'og.jpg').stat().st_size / 1024))
    if not args.probe:
        manifest = {k: manifest[k] for k in sorted(manifest)}
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    if failed:
        sys.exit('no image for: ' + ', '.join(failed))


if __name__ == '__main__':
    main()
