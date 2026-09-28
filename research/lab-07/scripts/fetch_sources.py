"""Fetches the text of every source a dossier cites, for fact-checking.

    python3 fetch_sources.py research/lab-07/dossier/<id>.json [...]

Writes one text file per source to $LAB07_SOURCES/<dossier-id>/<source-id>.txt (default
~/.cache/japan-time-atlas-lab07/sources, outside the repo): for internet-public NDL Digital Collections items the
OCR text of the cited frames and two frames either side (from the NDL Lab full-text API), for web pages the page
text, for PDFs the extracted text. Restricted NDL items have no text online; their file says so. The texts are
working copies for checking claims and are never published."""
import html, io, json, os, re, sys, time, urllib.error, urllib.request

CACHE = os.environ.get('LAB07_SOURCES', os.path.join(os.path.expanduser('~'), '.cache', 'japan-time-atlas-lab07', 'sources'))
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
PID_RE = re.compile(r'dl\.ndl\.go\.jp/(?:pid/|info:ndljp/pid/)(\d+)(?:/(\d+)/(\d+))?')


def get(url, tries=3):
    err = None
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                return r.status, r.headers.get('Content-Type', ''), r.read()
        except urllib.error.HTTPError as e:
            return e.code, '', b''
        except Exception as e:
            err = e
            time.sleep(2 * (attempt + 1))
    return None, '', str(err).encode()


def page_text(body, ctype):
    if 'pdf' in ctype or body[:5] == b'%PDF-':
        import pymupdf
        doc = pymupdf.open(stream=body, filetype='pdf')
        return '\n'.join(f'--- PDF page {i} ---\n' + p.get_text() for i, p in enumerate(doc, 1))
    s = body.decode('utf-8', errors='ignore')
    m = re.search(r'charset=["\']?([\w-]+)', s[:3000], re.I)
    if m and m.group(1).lower() not in ('utf-8', 'utf8'):
        try:
            s = body.decode(m.group(1), errors='ignore')
        except LookupError:
            pass
    s = re.sub(r'(?is)<(script|style|noscript)[^>]*>.*?</\1>', ' ', s)
    s = re.sub(r'(?i)<br\s*/?>|</(p|div|li|h\d|tr|dd|dt)>', '\n', s)
    s = html.unescape(re.sub(r'<[^>]+>', ' ', s))
    return '\n'.join(l.strip() for l in re.sub(r'[ \t　]+', ' ', s).split('\n') if l.strip())


def ndl_text(pid, frames):
    status, _, body = get(f'https://lab.ndl.go.jp/dl/api/book/fulltext-json/{pid}')
    if status != 200:
        return None
    pages = {int(p['page']): p.get('contents', '') for p in json.loads(body).get('list', []) if str(p.get('page', '')).isdigit()}
    want = sorted({f + k for f in frames for k in (-2, -1, 0, 1, 2) if f + k in pages}) if frames else sorted(pages)[:40]
    return '\n'.join(f'--- frame {f} ---\n{pages[f]}' for f in want)


def fetch(path):
    d = json.load(open(path, encoding='utf-8'))
    out = os.path.join(CACHE, d.get('id') or os.path.splitext(os.path.basename(path))[0])
    os.makedirs(out, exist_ok=True)
    report = []
    entries = [(s.get('id'), s) for s in d.get('sources', [])] + [(f'further{i}', f) for i, f in enumerate(d.get('furtherReading', []), 1)]
    for sid, s in entries:
        url = s.get('url') or ''
        m = PID_RE.search(url)
        pid = str(s.get('pid') or (m.group(1) if m else '') or '')
        frames = [f for f in (s.get('frames') or []) if isinstance(f, int)] + ([int(m.group(3))] if m and m.group(3) else [])
        head = f"{sid}: {s.get('title', '')} | {url}\n"
        if pid:
            t = ndl_text(pid, frames)
            text = head + (t if t else f'(no online text: NDL item {pid} is not open on the internet, or the full-text API has no OCR for it; check the catalogue record only)')
        elif url.startswith('http'):
            status, ctype, body = get(url)
            text = head + (page_text(body, ctype) if status and status < 400 else f'(fetch failed: HTTP {status})')
        else:
            text = head + '(no URL: print source)'
        with open(os.path.join(out, f'{sid}.txt'), 'w', encoding='utf-8') as f:
            f.write(text)
        report.append(f'{sid}: {len(text):,} chars')
    print(out)
    print('  ' + '; '.join(report))


if __name__ == '__main__':
    for p in sys.argv[1:]:
        fetch(p)
