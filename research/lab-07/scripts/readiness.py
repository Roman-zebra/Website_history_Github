"""Data readiness of every candidate: which GSI photo series cover the study square,
how much of it is former river channel / filled or reclaimed land / former water,
how many natural-disaster monuments stand within 3 km, and NDL Search hit counts.
Writes research/lab-07/readiness.json."""
import json, os, sys, urllib.parse, urllib.request, re, html, time
sys.path.insert(0, os.path.dirname(__file__))
import gsi

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cands = json.load(open(os.path.join(HERE, 'candidates.json'), encoding='utf-8'))['candidates']
only = set(sys.argv[1:])

SRU = 'https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&recordSchema=dcndl&maximumRecords=1&query='


def ndl_count(cql):
    url = SRU + urllib.parse.quote(cql)
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': gsi.UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                s = r.read().decode('utf-8')
            m = re.search(r'<numberOfRecords>(\d+)</numberOfRecords>', s)
            return int(m.group(1)) if m else None
        except Exception:
            time.sleep(2 * (attempt + 1))
    return None


def lab_count(keyword):
    """Copyright-expired digitised books whose title or table of contents names the place
    (NDL Lab next-generation digital library API)."""
    url = 'https://lab.ndl.go.jp/dl/api/book/search?size=1&keyword=' + urllib.parse.quote(keyword)
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': gsi.UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r).get('hit')
        except Exception:
            time.sleep(2 * (attempt + 1))
    return None


def main():
    out = {}
    path = os.path.join(HERE, 'readiness.json')
    if os.path.exists(path):
        out = json.load(open(path, encoding='utf-8'))
    for c in cands:
        if only and c['id'] not in only:
            continue
        bb = gsi.bbox(c['center'], c['half'])
        z = 15
        photos = {}
        for layer, ext, label in gsi.PHOTO_LAYERS:
            try:
                _, cov = gsi.mosaic(layer, bb, z)
            except Exception as e:
                cov = None
            photos[layer] = None if cov is None else round(cov, 3)
        shares = gsi.landform_shares(bb, 14)
        nat, art = shares['natural'], shares['artificial']
        mons = gsi.monuments_near(c['center'], 3.0)
        mons10 = gsi.monuments_near(c['center'], 10.0)
        q = c['queries'][0]
        counts = {
            'anywhere': ndl_count(f'anywhere="{q}"'),
            'title': ndl_count(f'title="{q}"'),
            'labBooks': lab_count(q),
        }
        out[c['id']] = {
            'photos': photos,
            'landform': {
                'natural': {k: round(v, 3) for k, v in sorted(nat.items(), key=lambda kv: -kv[1])},
                'artificial': {k: round(v, 3) for k, v in sorted(art.items(), key=lambda kv: -kv[1])},
            },
            'monuments3km': len(mons), 'monuments10km': len(mons10),
            'nearest': [{k: m[k] for k in ('id', 'name', 'year', 'kind', 'dist_km')} for m in mons10[:5]],
            'ndl': counts,
        }
        print(c['id'], json.dumps(out[c['id']]['photos']), 'mon3', len(mons), 'ndl', counts, flush=True)
        json.dump(out, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
