"""Photos of the walking stops for the Area Dossiers, each one chosen by eye.

    python3 spotphotos.py find    <id> <n> [--radius M] [--cat CATEGORY ...] [--grep WORD ...] [--api QUERY ...]
    python3 spotphotos.py findall <id> ... | all          # 'find' for every stop not yet decided
    python3 spotphotos.py choose  <id> <n> <k> "<what it shows>" ["<日本語で何が写っているか>"]
    python3 spotphotos.py none    <id> <n> "<why no photo is used>"
    python3 spotphotos.py place   <id> <n> <lat> <lon> "<source of the position>"
    python3 spotphotos.py sheet   <id> ...                # the chosen photos of a dossier on one sheet
    python3 spotphotos.py refresh <id> ... | all          # re-read the credits of the chosen photos

Where candidates come from:
  - Wikidata (query.wikidata.org): items within --radius (default 300 m) of the stop (walk[].at), and items in the
    district whose name contains the stop's name, that have an image (P18) — the photo the Wikidata community
    picked to show that very temple, gate, bridge or monument;
  - --cat: files listed on a Commons category page, filtered by --grep (words in the file name);
  - --api: a Commons full-text search. The Commons API lets this environment make only a few requests a minute,
    so this is slow and meant for the few stops the other routes miss.
Each candidate's Commons file page gives its licence, author, date, description and camera position. A candidate
is kept only if its licence allows commercial use — CC0, public domain, CC BY or CC BY-SA, never NC/ND or
GFDL-only — and no personality-rights warning is on the page. Candidates are drawn numbered on a sheet
(<BUILD>/<id>/spots/find-<n>.jpg, list in find-<n>.txt). Nothing is used until a person has looked at the sheet
and confirmed that the photo shows the very place the walking note describes, then runs 'choose', which downloads
the photo (960 px) to <BUILD>/<id>/spots/<n>.jpg and stores its credit (title, author, licence, links) and what it
shows in walk[].photo. Photos are only scaled, never cropped or altered.

Only /wiki/File: and /wiki/Category: pages are read from Commons (both allowed by its robots.txt), under two a second."""
import fcntl, html, io, json, math, os, re, sys, time, urllib.error, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import basic, gsi

API = 'https://commons.wikimedia.org/w/api.php'
WIKI = 'https://commons.wikimedia.org/wiki/'
WDQS = 'https://query.wikidata.org/sparql'
UA = {'User-Agent': 'JapanTimeAtlas/1.0 (https://japantimeatlas.com/; lab07 research) python-urllib/3.11'}
GAPS = {'api': 20.0, 'page': 0.6, 'wdqs': 1.0, 'file': 0.25}   # seconds between requests, shared by all processes
DOSSIER_DIR = os.path.join(basic.HERE, 'dossier')
GENERIC = {'and', 'the', 'of', 'to', 'down', 'from', 'on', 'at', 'in', 'old', 'former', 'site', 'park', 'temple', 'shrine',
           'river', 'bridge', 'street', 'hall', 'gate', 'museum', 'memorial', 'riverside', 'district', 'area', 'town',
           'city', 'station', 'monument', 'main', 'today', 'house', 'garden', 'road', 'walk', 'view', 'japan', 'tokyo',
           'kyoto', 'osaka', 'kobe', 'port', 'hill', 'cape', 'bay', 'hot', 'spring', 'national', 'center', 'centre',
           'with', 'where', 'what', 'that', 'this', 'jinja', 'dera', 'tera', 'great', 'historic', 'grounds'}
BAD = re.compile(r'\b(map|plan|logo|diagram|chart|flag|emblem|seal|karte|stamp|ticket|coin)\b|地図|案内図|\.svg$|\.pdf$|\.tiff?$|\.gif$|\.webm$|\.ogv$|\.djvu$', re.I)


def pause(key):
    os.makedirs(basic.SCRATCH, exist_ok=True)
    with open(os.path.join(basic.SCRATCH, f'.commons-{key}.lock'), 'a+') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        f.seek(0)
        try:
            last = float(f.read() or 0)
        except ValueError:
            last = 0.0
        wait = GAPS[key] - (time.time() - last)
        if wait > 0:
            time.sleep(wait)
        f.seek(0)
        f.truncate()
        f.write(str(time.time()))


def fetch(url, tries=5):
    key = 'api' if url.startswith(API) else 'wdqs' if url.startswith(WDQS) else 'page' if url.startswith(WIKI) else 'file'
    for attempt in range(tries):
        pause(key)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504) or attempt == tries - 1:
                raise
            time.sleep(int(e.headers.get('Retry-After') or 0) + 5 + 10 * attempt)
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(3 + 3 * attempt)


def load(did):
    return json.load(open(os.path.join(DOSSIER_DIR, did + '.json'), encoding='utf-8'))


def save(did, d):
    with open(os.path.join(DOSSIER_DIR, did + '.json'), 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
        f.write('\n')


def spot_dir(did):
    p = os.path.join(basic.BUILD, did, 'spots')
    os.makedirs(p, exist_ok=True)
    return p


def plain(v):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', v or ''))).strip()


def tokens(*texts):
    ja, en = [], []
    for s in texts:
        s = re.sub(r'[（(]([^）)]*)[）)]', r' \1 ', s or '')     # names in brackets count too: カナダミュージアム（旧野田家住宅）
        ja += [t for t in re.split(r'[・／/、\s「」A-Za-z0-9\-\'.,]+', s) if len(t) >= 2]
        en += [t for t in re.findall(r"[A-Za-z][A-Za-z'\-]+", s) if t.lower() not in GENERIC and len(t) >= 4]
    return list(dict.fromkeys(ja)), list(dict.fromkeys(en))


def score(text, ja, en, label=''):
    """How well a file name or item label names the stop: 3 for its Japanese name (or a label of 3+ characters
    inside that name, e.g. 北谷城 in 北谷城跡), 2 for each distinctive English word."""
    t = (text or '').lower().replace('_', ' ')
    s = 3 if any(j in (text or '') for j in ja) or (len(label) >= 3 and any(label in j for j in ja)) else 0
    for e in en:
        e2 = e.lower()
        if e2 in t or e2.replace('-', '') in t.replace('-', '').replace(' ', ''):
            s += 2
    return s


def dist_m(a, b):
    k = math.cos(math.radians(a[0]))
    return math.hypot((a[0] - b[0]) * 110574, (a[1] - b[1]) * 111320 * k)


def licence_ok(short):
    l = (short or '').strip().lower()
    if not l or 'nc' in re.split(r'[\s\-]', l) or 'nd' in re.split(r'[\s\-]', l):
        return False
    return bool(l.startswith('cc0') or 'public domain' in l or l.startswith('pd') or re.match(r'cc[ -]by(-sa)?[ -]\d', l))


# ---- Wikidata ----
Q_NEAR = """SELECT ?item ?ja ?en ?img ?cat ?dist WHERE {
 SERVICE wikibase:around { ?item wdt:P625 ?loc . bd:serviceParam wikibase:center "Point(%.6f %.6f)"^^geo:wktLiteral .
   bd:serviceParam wikibase:radius "%.3f" . bd:serviceParam wikibase:distance ?dist . }
 ?item wdt:P18 ?img . OPTIONAL { ?item wdt:P373 ?cat }
 OPTIONAL { ?item rdfs:label ?ja FILTER(LANG(?ja) = "ja") } OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
} ORDER BY ?dist LIMIT 80"""
Q_NAMED = """SELECT DISTINCT ?item ?ja ?en ?img ?cat ?loc WHERE {
 SERVICE wikibase:box { ?item wdt:P625 ?loc .
   bd:serviceParam wikibase:cornerSouthWest "Point(%.6f %.6f)"^^geo:wktLiteral .
   bd:serviceParam wikibase:cornerNorthEast "Point(%.6f %.6f)"^^geo:wktLiteral . }
 ?item rdfs:label ?l . FILTER((LANG(?l) = "ja" || LANG(?l) = "en") && (%s))
 OPTIONAL { ?item wdt:P18 ?img } OPTIONAL { ?item wdt:P373 ?cat }
 OPTIONAL { ?item rdfs:label ?ja FILTER(LANG(?ja) = "ja") } OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
} LIMIT 80"""


def sparql(q):
    try:
        r = json.loads(fetch(WDQS + '?' + urllib.parse.urlencode({'query': q, 'format': 'json'})))
    except Exception as ex:
        print('   ! Wikidata query failed:', ex, file=sys.stderr)
        return []
    return [{k: v['value'] for k, v in b.items()} for b in r['results']['bindings']]


def file_of(url):
    return urllib.parse.unquote(url.rsplit('/', 1)[1]).replace('_', ' ')


def point(wkt):
    lon, lat = map(float, re.findall(r'[-\d.]+', wkt)[:2])
    return lat, lon


# ---- Commons pages ----
def category_files(cat):
    try:
        h = fetch(WIKI + 'Category:' + urllib.parse.quote(cat.replace(' ', '_'))).decode('utf-8', 'ignore')
    except Exception as ex:
        print('   ! category failed:', cat, ex, file=sys.stderr)
        return [], []
    names = list(dict.fromkeys(urllib.parse.unquote(m).replace('_', ' ') for m in re.findall(r'href="/wiki/File:([^"#?]+)"', h)))
    subs = list(dict.fromkeys(urllib.parse.unquote(m).replace('_', ' ') for m in re.findall(r'href="/wiki/Category:([^"#?]+)"', h)))
    return names, subs


MONTHS = {m: i for i, m in enumerate(['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
                                        'october', 'november', 'december'], 1)}
ERAS = {'明治': 1867, '大正': 1911, '昭和': 1925, '平成': 1988, '令和': 2018}


def norm_date(cell):
    """ISO date (or year-month, or year) from a Commons 'Date' cell; '' if there is none."""
    if not cell:
        return ''
    dt = re.search(r'datetime="(\d{4}(?:-\d{2}(?:-\d{2})?)?)', cell)
    if dt:
        return dt.group(1)
    t = plain(cell)
    m = re.search(r'(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})', t)
    if m and m.group(2).lower() in MONTHS:
        return f'{m.group(3)}-{MONTHS[m.group(2).lower()]:02d}-{int(m.group(1)):02d}'
    m = re.search(r'([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})', t)
    if m and m.group(1).lower() in MONTHS:
        return f'{m.group(3)}-{MONTHS[m.group(1).lower()]:02d}-{int(m.group(2)):02d}'
    m = re.search(r'(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?', t)
    if m:
        return f'{m.group(1)}-{int(m.group(2)):02d}' + (f'-{int(m.group(3)):02d}' if m.group(3) else '')
    m = re.search(r'(明治|大正|昭和|平成|令和)(\d{1,2}|元)年', t)
    if m:
        return str(ERAS[m.group(1)] + (1 if m.group(2) == '元' else int(m.group(2))))
    m = re.search(r'\b(1[89]\d\d|20\d\d)\b', t)
    return m.group(1) if m else ''


def clean_artist(a):
    """(credit name, Japanese credit name or '') from the Author field or the requested attribution."""
    a = re.split(r'You are free', a)[0]
    a = re.sub(r'\(\s*talk\s*\)', '', a)
    a = re.sub(r'^I,\s*', '', a.strip())
    a = re.sub(r'(?i)^(this )?photo(graph)?\s+(was\s+)?taken\s+by\s*', '', a)
    ja = re.search(r'(?:日本語|Japanese)\s*[:：]\s*(.+?)(?=\s*(?:English|英語)\s*[:：]|$)', a)
    en = re.search(r'(?:English|英語)\s*[:：]\s*(.+)$', a)
    main = en.group(1) if en else ja.group(1) if ja else a
    tidy = lambda x: re.sub(r'\s+', ' ', x).strip(' .,;:-')[:80]
    return tidy(main) or 'unknown', tidy(ja.group(1)) if ja else ''


def file_meta(name):
    """Licence, author, date, description, size and camera position from the file's Commons page."""
    page = WIKI + 'File:' + urllib.parse.quote(name.replace(' ', '_'))
    try:
        h = fetch(page).decode('utf-8', 'ignore').replace('&#95;', '_')
    except Exception as ex:
        return {'fileName': name, 'reject': f'page failed: {ex}'}
    m = {'fileName': name, 'title': re.sub(r'\.(jpe?g|png)$', '', name, flags=re.I), 'page': page}
    shorts = [plain(x) for x in re.findall(r'class="licensetpl_short"[^>]*>(.*?)</span>', h, re.S)]
    links = [plain(x) for x in re.findall(r'class="licensetpl_link"[^>]*>(.*?)</span>', h, re.S)]
    ok = [(s, links[i] if i < len(links) else '') for i, s in enumerate(shorts) if licence_ok(s)]
    ok.sort(key=lambda x: (0 if x[0].lower().startswith(('cc0', 'public', 'pd')) else 1 if 'sa' not in x[0].lower() else 2))
    attr = re.search(r'class="licensetpl_attr"[^>]*>(.*?)</(?:span|div)>', h, re.S)
    aut = re.search(r'id="fileinfotpl_aut".*?</td>\s*<td[^>]*>(.*?)</td>', h, re.S)
    date = re.search(r'id="fileinfotpl_date".*?</td>\s*<td[^>]*>(.*?)</td>', h, re.S)
    desc = re.search(r'id="fileinfotpl_desc".*?<td class="description">(.*?)</td>', h, re.S)
    geo = re.search(r'class="geo"[^>]*>\s*(-?[\d.]+);\s*(-?[\d.]+)', h)
    dims = re.search(r'class="fileInfo">\(?([\d,]+) × ([\d,]+) pixels', h)
    orig = re.search(r'class="fullImageLink" id="file"><a href="(https://upload\.wikimedia\.org/wikipedia/commons/[^"?]+)', h)
    m.update({'license': ok[0][0] if ok else (shorts[0] if shorts else ''), 'licenseUrl': ok[0][1] if ok else '',
              'artist': '', 'artistJa': '', 'date': norm_date(date.group(1) if date else ''),
              'desc': re.sub(r'^(English|日本語|Japanese)\s*[:：]\s*', '', plain(desc.group(1)) if desc else '')[:200],
              'at': [float(geo.group(1)), float(geo.group(2))] if geo else None,
              'width': int(dims.group(1).replace(',', '')) if dims else 0, 'height': int(dims.group(2).replace(',', '')) if dims else 0})
    raw = plain(attr.group(1)) if attr and 0 < len(plain(attr.group(1))) <= 120 else plain(aut.group(1)) if aut else ''
    m['artist'], m['artistJa'] = clean_artist(raw)
    if orig:
        u = orig.group(1)
        base = u.rsplit('/', 1)[1]
        thumb = u.replace('/wikipedia/commons/', '/wikipedia/commons/thumb/') + '/{w}px-' + base
        m['thumb'] = thumb.format(w=330)
        m['file'] = thumb.format(w=960) if m['width'] > 960 else u
    if not ok:
        m['reject'] = 'licence ' + (', '.join(shorts) or 'unknown')
    elif re.search(r'(?i)personality[ _]rights', h):
        m['reject'] = 'personality rights warning'
    elif not orig or BAD.search(name) or m['width'] < 800:
        m['reject'] = 'not a usable photo file'
    return m


def find(did, n, radius=300, cats=(), grep=(), api_queries=()):
    from PIL import Image, ImageDraw
    d = load(did)
    stop = d['walk'][n - 1]
    ja, en = tokens(stop.get('ja'), stop.get('name'))
    lines = [f"stop {n}: {stop['name']} / {stop.get('ja')}  at={stop.get('at')}\n  {stop['what']}"]
    cands = {}   # file name -> (rank, origin)

    def add(name, rank, origin):
        if name and not BAD.search(name) and (name not in cands or cands[name][0] < rank):
            cands[name] = (rank, origin)

    if stop.get('at'):
        for r in sparql(Q_NEAR % (stop['at'][1], stop['at'][0], radius / 1000)):
            label = r.get('ja') or r.get('en') or ''
            sc, dm = score(label + ' ' + r.get('en', ''), ja, en, r.get('ja', '')), float(r['dist']) * 1000
            if sc or dm <= 150:   # named like the stop, or right beside it
                add(file_of(r['img']), (sc, -dm), f"WD {r['item'].rsplit('/', 1)[1]} {label} {dm:.0f} m")
    stems = [re.sub(r'(跡地|跡|付近|周辺)$', '', t) for t in ja]
    names = list(dict.fromkeys(t for t in ja + stems if len(t) >= 2))[:5] or en[:2]
    if names:
        c = basic.load_districts()[did]
        s, w, nn, e = gsi.bbox(c['center'], max(4.0, c['half'] * 3))
        cond = ' || '.join('CONTAINS(?l, "%s")' % t.replace('"', '') for t in names)
        for r in sparql(Q_NAMED % (w, s, e, nn, cond)):
            label = r.get('ja') or r.get('en') or ''
            lat, lon = point(r['loc'])
            dm = dist_m(stop['at'], (lat, lon)) if stop.get('at') else None
            sc = score(label + ' ' + r.get('en', ''), ja, en, r.get('ja', ''))
            if sc >= 3 and r.get('cat'):
                lines.append(f"  Commons category of {r['item'].rsplit('/', 1)[1]} {label}: {r['cat']}")
            if sc >= 3 and (not stop.get('at') or dm > 150):
                lines.append(f"  position of {r['item'].rsplit('/', 1)[1]} {label} / {r.get('en', '')}: {lat:.6f} {lon:.6f}"
                             + (f' ({dm:.0f} m from walk[].at)' if dm is not None else ' (stop has no position)'))
            if r.get('img') and (dm is None or dm <= max(radius, 1500)):
                add(file_of(r['img']), (sc, -(dm if dm is not None else 900)), f"WD {r['item'].rsplit('/', 1)[1]} {label}")
    for cat in cats:
        files, subs = category_files(cat)
        for f in files:
            if not grep or any(g.lower() in f.lower() for g in grep):
                add(f, (6, 0), f'Category:{cat}')
        if subs:
            lines.append(f"  subcategories of {cat}: " + ' | '.join(subs[:25]))
    for q in api_queries:
        try:
            r = json.loads(fetch(API + '?' + urllib.parse.urlencode({'action': 'query', 'list': 'search', 'format': 'json',
                                                                        'srsearch': q + ' filetype:bitmap', 'srnamespace': 6, 'srlimit': 30})))
            qja, qen = tokens(q)
            for x in r.get('query', {}).get('search', []):
                add(x['title'][5:], (max(score(x['title'], ja, en), score(x['title'], qja, qen)) + 1, -500), f'search "{q}"')
        except Exception as ex:
            print('   ! Commons search failed:', ex, file=sys.stderr)
    ranked = sorted(cands.items(), key=lambda kv: kv[1][0], reverse=True)[:16]
    kept = []
    for name, (rank, origin) in ranked:
        m = file_meta(name)
        if m.get('reject'):
            lines.append(f"  (skipped {name}: {m['reject']})")
            continue
        m['origin'] = origin
        m['distanceM'] = round(dist_m(stop['at'], m['at'])) if stop.get('at') and m.get('at') else None
        kept.append(m)
        if len(kept) == 12:
            break
    sd = spot_dir(did)
    json.dump(kept, open(os.path.join(sd, f'find-{n}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    cols, cw, ch = 4, 330, 250
    sheet = Image.new('RGB', (cols * (cw + 10), max(1, math.ceil(len(kept) / cols)) * (ch + 30)), 'white')
    dr = ImageDraw.Draw(sheet)
    f = basic.font('Inter-SemiBold.ttf', 15)
    for k, c in enumerate(kept):
        x, y = (k % cols) * (cw + 10), (k // cols) * (ch + 30)
        try:
            im = Image.open(io.BytesIO(fetch(c['thumb']))).convert('RGB')
            im.thumbnail((cw, ch))
            sheet.paste(im, (x, y))
        except Exception as ex:
            print('   ! thumbnail failed', c['fileName'], ex, file=sys.stderr)
        dm = f"{c['distanceM']} m" if c['distanceM'] is not None else 'no position'
        dr.text((x + 2, y + ch + 4), f"[{k}] {dm} · {c['date'][:4]} · {c['title'][:26]}", font=f, fill='black')
        lines.append(f"  [{k}] {dm:>11} | {c['date']:10} | {c['license']:12} | {c['title']}  <{c['origin']}>\n{'':8}{c['desc'][:160]}")
    out = os.path.join(sd, f'find-{n}.jpg')
    sheet.save(out, quality=75)
    lines.append(f'sheet: {out}' if kept else 'no candidates')
    open(os.path.join(sd, f'find-{n}.txt'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print('\n'.join(lines), flush=True)


def ensure(did, n, photo):
    """Local copy of a chosen photo, downloaded again if the build cache was cleared."""
    dest = os.path.join(spot_dir(did), f'{n}.jpg')
    if not os.path.exists(dest):
        data = fetch(photo['file'])
        with open(dest, 'wb') as f:
            f.write(data)
    return dest


def choose(did, n, k, shows, shows_ja=''):
    d = load(did)
    stop = d['walk'][n - 1]
    c = json.load(open(os.path.join(spot_dir(did), f'find-{n}.json'), encoding='utf-8'))[k]
    ph = {'title': c['title'], 'fileName': c['fileName'], 'page': c['page'], 'file': c['file'], 'artist': c['artist'],
          'artistJa': c.get('artistJa', ''),
          'license': c['license'], 'licenseUrl': c['licenseUrl'], 'date': c['date'], 'distanceM': c['distanceM'],
          'source': 'Wikimedia Commons', 'via': c['origin'].split(' ')[1] if c['origin'].startswith('WD ') else c['origin'],
          'shows': shows, 'showsJa': shows_ja, 'checked': basic.TODAY}
    old = os.path.join(spot_dir(did), f'{n}.jpg')
    if os.path.exists(old):
        os.remove(old)
    ensure(did, n, ph)
    stop.pop('photoNone', None)
    stop['photo'] = ph
    save(did, d)
    print(f"stop {n}: {ph['title']} ({ph['license']}, {ph['artist']})")


def refresh(did):
    """Re-read licence, author and date of every chosen photo from its Commons page."""
    d = load(did)
    for i, w in enumerate(d.get('walk', []), 1):
        ph = w.get('photo')
        if not ph:
            continue
        m = file_meta(ph['fileName'])
        if m.get('reject'):
            print(f"stop {i}: {ph['fileName']}: {m['reject']} — photo removed, review again", file=sys.stderr)
            w.pop('photo')
            continue
        for k in ('artist', 'artistJa', 'license', 'licenseUrl', 'date'):
            ph[k] = m[k]
        ph['distanceM'] = round(dist_m(w['at'], m['at'])) if w.get('at') and m.get('at') else None
        print(f"stop {i}: {ph['artist']} | {ph['artistJa']} | {ph['license']} | {ph['date']}")
    save(did, d)


def none(did, n, why):
    d = load(did)
    stop = d['walk'][n - 1]
    stop.pop('photo', None)
    stop['photoNone'] = why
    save(did, d)
    print(f'stop {n}: no photo — {why}')


def place(did, n, lat, lon, src):
    d = load(did)
    stop = d['walk'][n - 1]
    stop['at'] = [round(float(lat), 6), round(float(lon), 6)]
    stop['atSource'] = src
    stop.pop('atQuery', None)
    save(did, d)
    print(f"stop {n}: placed at {stop['at']} ({src})")


def sheet(did):
    from PIL import Image, ImageDraw
    walk = load(did).get('walk', [])
    cw, ch = 480, 340
    img = Image.new('RGB', (2 * (cw + 12), math.ceil(len(walk) / 2) * (ch + 58)), 'white')
    dr = ImageDraw.Draw(img)
    f, fs = basic.font('Inter-SemiBold.ttf', 17), basic.font('Inter-Regular.ttf', 14)
    for i, w in enumerate(walk, 1):
        x, y = ((i - 1) % 2) * (cw + 12), ((i - 1) // 2) * (ch + 58)
        dr.text((x, y), f"{i}. {w['name'][:46]}", font=f, fill='black')
        if w.get('photo'):
            im = Image.open(ensure(did, i, w['photo'])).convert('RGB')
            im.thumbnail((cw, ch))
            img.paste(im, (x, y + 24))
            dr.text((x, y + 26 + im.height), w['photo'].get('shows', '')[:64], font=fs, fill='black')
        else:
            dr.text((x, y + 40), 'no photo: ' + (w.get('photoNone') or '(not reviewed)')[:60], font=fs, fill='black')
    out = os.path.join(spot_dir(did), 'chosen.jpg')
    img.save(out, quality=75)
    print('sheet:', out)


def options(rest):
    """Split 'find' arguments into positionals and --radius/--cat/--grep/--api lists."""
    pos, opt, cur = [], {'radius': [], 'cat': [], 'grep': [], 'api': []}, None
    for a in rest:
        if a.startswith('--') and a[2:] in opt:
            cur = a[2:]
        elif cur:
            opt[cur].append(a)
        else:
            pos.append(a)
    return pos, opt


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    cmd, rest = a[0], a[1:]
    if cmd == 'find':
        pos, o = options(rest)
        find(pos[0], int(pos[1]), int(o['radius'][0]) if o['radius'] else 300, o['cat'], o['grep'], o['api'])
    elif cmd == 'findall':
        ids = sorted(f[:-5] for f in os.listdir(DOSSIER_DIR) if f.endswith('.json')) if rest == ['all'] else rest
        for did in ids:
            for n, w in enumerate(load(did).get('walk', []), 1):
                if not w.get('photo') and not w.get('photoNone') and not os.path.exists(os.path.join(spot_dir(did), f'find-{n}.json')):
                    print(f'== {did}', flush=True)
                    find(did, n)
    elif cmd == 'choose':
        choose(rest[0], int(rest[1]), int(rest[2]), rest[3], rest[4] if len(rest) > 4 else '')
    elif cmd == 'none':
        none(rest[0], int(rest[1]), rest[2])
    elif cmd == 'place':
        place(rest[0], int(rest[1]), rest[2], rest[3], rest[4])
    elif cmd == 'refresh':
        for did in (sorted(f[:-5] for f in os.listdir(DOSSIER_DIR) if f.endswith('.json')) if rest == ['all'] else rest):
            print('==', did)
            refresh(did)
    elif cmd == 'sheet':
        for did in rest:
            sheet(did)
    else:
        sys.exit(__doc__)
