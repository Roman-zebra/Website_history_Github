"""Checks the sources of an Area Dossier or Deep Research JSON against the live catalogues.

    python3 verify_sources.py research/lab-07/dossier/<id>.json [...]

For every NDL Digital Collections item (a `pid`, or a dl.ndl.go.jp URL) it looks the item up and compares the
title, year, access class and the cited frame numbers with the catalogue record. Every other URL is fetched
once to see that it resolves. Prints one line per problem and a summary per file; nothing is written except a
cache of the item records under .cache/ndl-item (git-ignored)."""
import difflib, json, os, re, sys, time, unicodedata, urllib.error, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(HERE))
CACHE = os.path.join(ROOT, '.cache', 'ndl-item')
UA = {'User-Agent': 'JapanTimeAtlas-lab07/1.0 (+https://japantimeatlas.com)'}
RULE = {'internet': 'internet', 'ooc': 'transmission', 'inlibrary': 'inlibrary', 'ndl_only': 'inlibrary'}
PID_RE = re.compile(r'(?:dl\.ndl\.go\.jp/(?:pid/|info:ndljp/pid/)|info:ndljp/pid/)(\d+)(?:/(\d+)/(\d+))?')


def get(url, tries=3):
    err = None
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, b''
        except Exception as e:
            err = e
            time.sleep(2 * (attempt + 1))
    return None, str(err).encode()


def item(pid):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, pid + '.json')
    if os.path.exists(p):
        return json.load(open(p, encoding='utf-8'))
    status, body = get(f'https://dl.ndl.go.jp/api/item/search/info:ndljp/pid/{pid}')
    if status != 200:
        return None
    it = json.loads(body)['item']
    m = it.get('meta', {})
    rec = {'title': (m.get('0001Dtct') or [''])[0], 'volume': (m.get('0007Dtct') or [''])[0], 'by': (m.get('0010Dtct') or [''])[0],
           'year': (m.get('0059Dk') or [''])[0], 'rule': (it.get('permission') or {}).get('rule'),
           'frames': [len(b.get('contents') or []) for b in it.get('contentsBundles') or []]}
    json.dump(rec, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
    return rec


def norm(s):
    s = unicodedata.normalize('NFKC', str(s or '')).lower()
    return re.sub(r'[\s・「」『』()（）\[\]〔〕【】,，.。:：;；\-‐—–~〜!！?？"\'“”‘’/]', '', s)


def title_ok(cited, rec):
    a, b = norm(cited), norm(rec['title'] + rec['volume'])
    t = norm(rec['title'])
    if not a:
        return True
    if a in b or t in a or (len(a) >= 4 and a[:6] in b):
        return True
    return difflib.SequenceMatcher(None, a, b).ratio() >= 0.6


def check_ndl(label, pid, cited_title, year, access, frames, bundle=1):
    rec = item(pid)
    if rec is None:
        return [f'{label}: pid {pid} not found in NDL Digital Collections']
    probs = []
    if cited_title and not title_ok(cited_title, rec):
        probs.append(f'{label}: title differs — cited 「{cited_title}」, catalogue 「{rec["title"]} {rec["volume"]}」')
    y = re.match(r'\d{4}', str(year or ''))
    ry = re.match(r'\d{4}', rec['year'] or '')
    if y and ry and abs(int(y.group()) - int(ry.group())) > 1:
        probs.append(f'{label}: year {y.group()} vs catalogue {ry.group()}')
    if access and RULE.get(rec['rule'], rec['rule']) != access:
        probs.append(f'{label}: access "{access}" vs catalogue "{RULE.get(rec["rule"], rec["rule"])}"')
    n = rec['frames'][bundle - 1] if len(rec['frames']) >= bundle else 0
    big = [f for f in frames or [] if isinstance(f, int) and n and f > n]
    if big:
        probs.append(f'{label}: frames {big} beyond the {n} frames of the item')
    return probs


def check_file(path):
    d = json.load(open(path, encoding='utf-8'))
    probs, checked, urls = [], 0, {}
    entries = [(s.get('id', '?'), s) for s in d.get('sources', [])] + [(f'further{i}', f) for i, f in enumerate(d.get('furtherReading', []), 1)]
    for label, s in entries:
        url = s.get('url') or ''
        m = PID_RE.search(url)
        pid = str(s.get('pid') or (m.group(1) if m else '') or '')
        if pid:
            frames = list(s.get('frames') or [])
            if m and m.group(3):
                frames.append(int(m.group(3)))
            if m and s.get('pid') and m.group(1) != str(s['pid']):
                probs.append(f'{label}: pid {s["pid"]} but URL points at {m.group(1)}')
            title = s.get('title', '')
            if label.startswith('further'):
                title = re.sub(r'[（(][^）)]*[）)]\s*$', '', title)  # "title（publisher, year）"
            probs += check_ndl(label, pid, title, s.get('year'), s.get('access') if s.get('access') in RULE.values() else None, frames,
                               int(m.group(2)) if m and m.group(2) else 1)
            checked += 1
        elif url.startswith('http'):
            urls.setdefault(url, label)
    for url, label in urls.items():
        status, _ = get(url)
        checked += 1
        if status is None or status >= 400:
            probs.append(f'{label}: URL does not resolve ({status}) {url}')
    return probs, checked


def main():
    for path in sys.argv[1:]:
        probs, checked = check_file(path)
        print(f'== {os.path.basename(path)}: {checked} sources checked, {len(probs)} problem(s)')
        for p in probs:
            print('  ' + p)


if __name__ == '__main__':
    main()
