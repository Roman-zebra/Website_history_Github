"""NDL Search harvest for one or more districts of page 07.

For every query term of a district (candidates.json -> queries, plus district-specific extras
in ndl-queries.json) this collects:
  * NDL Search SRU (dcndl) records: bibliographic data, NDL Digital Collections pid and the
    access class of the digital copy (internet = open without login; transmission = 図書館・
    個人送信 for registered users; inlibrary = NDL premises only; paper = not digitised);
  * NDL Lab (next-generation digital library) hits in copyright-expired books, with the
    table-of-contents line and frame number that names the place;
  * Collaborative Reference Database (レファレンス協同データベース) questions and answers
    written by Japanese libraries about the place;
  * Japan Search items whose rights code allows commercial reuse (ccby, pdm, cc0, com).
Only bibliographic data, links, frame numbers and short TOC lines are stored: no page images,
no full text. Output: research/lab-07/ndl/<id>.json"""
import html, json, os, re, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'ndl')
UA = 'JapanTimeAtlas-lab07/1.0 (+https://japantimeatlas.com)'
SRU = 'https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&recordSchema=dcndl&maximumRecords=500&query='
LAB = 'https://lab.ndl.go.jp/dl/api/book/search?size=60&keyword='
CRD = 'https://crd.ndl.go.jp/api/refsearch?type=reference&results_num=30&query='
JPS = 'https://jpsearch.go.jp/api/item/search/jps-cross?size=40&keyword='
LOCAL = re.compile(r'(市史|町史|村史|区史|郡誌|郡史|県史|府史|郷土|誌|沿革|案内|写真|地図|絵図|移民|今昔|百年|記念誌|物語|風土記|名所|史料|資料|町誌|村誌|市誌)')


def get(url, tries=4, timeout=90):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode('utf-8', 'replace')
        except Exception as e:
            err = e
            time.sleep(2 * (attempt + 1))
    print('  ! failed', url[:120], err, file=sys.stderr)
    return None


def text(pattern, s, flags=0):
    m = re.search(pattern, s, flags)
    return html.unescape(m.group(1)).strip() if m else ''


def parse_record(rec):
    about = text(r'<dcndl:BibAdminResource rdf:about="([^"]+)"', rec)
    title = text(r'<dcterms:title>([\s\S]*?)</dcterms:title>', rec)
    vol = text(r'<dcndl:volume><rdf:Description>\s*<rdf:value>([\s\S]*?)</rdf:value>', rec)
    creators = [html.unescape(x).strip() for x in re.findall(r'<dcterms:creator>[\s\S]*?<foaf:name>([\s\S]*?)</foaf:name>', rec)]
    if not creators:
        creators = [html.unescape(x).strip() for x in re.findall(r'<dc:creator>([\s\S]*?)</dc:creator>', rec)]
    publisher = text(r'<dcterms:publisher>[\s\S]*?<foaf:name>([\s\S]*?)</foaf:name>', rec)
    issued = text(r'<dcterms:issued[^>]*>([\s\S]*?)</dcterms:issued>', rec) or text(r'<dcterms:date[^>]*>([\s\S]*?)</dcterms:date>', rec)
    year = re.search(r'(1[5-9]\d\d|20\d\d)', issued or '')
    pids = sorted(set(re.findall(r'info:ndljp/pid/(\d+)', rec)))
    access = [html.unescape(x).strip() for x in re.findall(r'<dcterms:accessRights[^>]*>([\s\S]*?)</dcterms:accessRights>', rec)]
    mtypes = [html.unescape(x).strip() for x in re.findall(r'<dcndl:materialType[^>]*rdfs:label="([^"]+)"', rec)]
    if not mtypes:
        mtypes = [html.unescape(x).strip() for x in re.findall(r'<dcndl:materialType[^>]*>[\s\S]*?<rdfs:label>([\s\S]*?)</rdfs:label>', rec)]
    subjects = [html.unescape(x).strip() for x in re.findall(r'<dcterms:subject>[\s\S]*?<rdf:value>([\s\S]*?)</rdf:value>', rec)]
    ndc = text(r'rdf:datatype="http://ndl.go.jp/dcndl/terms/NDC\d*">([^<]+)<', rec) or text(r'<dcterms:subject rdf:resource="http://id.ndl.go.jp/class/ndc\d*/([^"]+)"', rec)
    extent = text(r'<dcterms:extent>([\s\S]*?)</dcterms:extent>', rec)
    toc = [html.unescape(x).strip() for x in re.findall(r'<dcterms:tableOfContents>([\s\S]*?)</dcterms:tableOfContents>', rec)]
    part = text(r'<dcterms:isPartOf>[\s\S]*?<dcterms:title>([\s\S]*?)</dcterms:title>', rec)
    if any('インターネット公開' in a for a in access):
        cls = 'internet'
    elif any('個人送信' in a for a in access):
        cls = 'transmission'
    elif any('館内限定' in a for a in access) or pids:
        cls = 'inlibrary'
    else:
        cls = 'paper'
    return {
        'url': about.split('#')[0], 'title': title, 'volume': vol, 'creators': creators[:4], 'publisher': publisher,
        'issued': issued, 'year': int(year.group(1)) if year else None, 'pids': pids[:3], 'access': cls,
        'materialTypes': mtypes[:4], 'subjects': subjects[:6], 'ndc': ndc, 'extent': extent, 'partOf': part,
        'toc': [t[:160] for t in toc[:12]],
    }


def sru(cql):
    s = get(SRU + urllib.parse.quote(cql))
    if not s:
        return 0, []
    total = int(text(r'<numberOfRecords>(\d+)</numberOfRecords>', s) or 0)
    recs = [html.unescape(r) for r in re.findall(r'<recordData>([\s\S]*?)</recordData>', s)]
    return total, [parse_record(r) for r in recs]


def lab(keyword):
    s = get(LAB + urllib.parse.quote(keyword))
    if not s:
        return 0, []
    d = json.loads(s)
    out = []
    for b in d.get('list', []):
        hl = b.get('highlights') or []
        if isinstance(hl, str):
            try:
                hl = json.loads(hl.replace("'", '"'))
            except Exception:
                hl = [hl]
        lines = []
        for h in hl:
            h = html.unescape(re.sub(r'</?em>', '', str(h)))
            m = re.search(r'\((\d{4})\.jp2\)', h)
            lines.append({'line': re.sub(r'\s*\(\d{4}\.jp2\)\s*', '', h).strip()[:140], 'frame': int(m.group(1)) if m else None})
        out.append({'pid': b.get('id'), 'title': b.get('title'), 'volume': b.get('volume'), 'by': b.get('responsibility'),
                    'publisher': b.get('publisher'), 'year': b.get('publishyear'), 'pages': b.get('page'), 'hits': lines[:6]})
    return d.get('hit', 0), out


def crd(terms):
    s = get(CRD + urllib.parse.quote('anywhere all ' + terms))
    if not s:
        return 0, []
    total = int(text(r'<hit_num>(\d+)</hit_num>', s) or 0)
    out = []
    for r in re.findall(r'<reference>([\s\S]*?)</reference>', s):
        out.append({
            'regId': text(r'<reg-id>([\s\S]*?)</reg-id>', r),
            'question': text(r'<question>([\s\S]*?)</question>', r)[:220],
            'library': text(r'<lib-name>([\s\S]*?)</lib-name>', r),
            'date': text(r'<crt-date>([\s\S]*?)</crt-date>', r),
            'url': text(r'<url>([\s\S]*?)</url>', r),
            'sources': [html.unescape(x).strip()[:200] for x in re.findall(r'<bibl-desc>([\s\S]*?)</bibl-desc>', r)][:6],
        })
    return total, out


def jps(keyword):
    items = []
    for rights in ('ccby', 'pdm', 'cc0', 'com'):
        s = get(JPS + urllib.parse.quote(keyword) + '&f-rights=' + rights)
        if not s:
            continue
        d = json.loads(s)
        for it in d.get('list', []):
            c = it.get('common', {})
            items.append({'id': it.get('id'), 'title': c.get('title'), 'rights': c.get('contentsRightsType'),
                          'provider': c.get('provider'), 'db': c.get('database'), 'type': c.get('category'),
                          'temporal': c.get('temporal'), 'link': c.get('linkUrl'),
                          'jps': 'https://jpsearch.go.jp/item/' + it.get('id', '')})
    return items


def score(r, terms):
    t = (r['title'] or '') + ' ' + (r['volume'] or '')
    s = 0
    if any(k in t for k in terms):
        s += 5
    if any(any(k in x for k in terms) for x in r['subjects']):
        s += 3
    if LOCAL.search(t):
        s += 2
    s += {'internet': 3, 'transmission': 2, 'inlibrary': 0, 'paper': 0}[r['access']]
    if (r['ndc'] or '').startswith('2'):
        s += 1
    if any('雑誌' in m for m in r['materialTypes']) and not any(k in r['title'] for k in terms):
        s -= 2
    return s


def harvest(c, extra):
    terms = extra.get('queriesOverride') or (c['queries'] + extra.get('queries', []))
    exclude = re.compile(extra['exclude']) if extra.get('exclude') else None
    lab_must = extra.get('labMust', [])
    title_terms = [t.split(' ')[0] for t in terms]
    log = []
    records = {}

    def add(label, total, recs):
        log.append({'query': label, 'total': total, 'fetched': len(recs)})
        for r in recs:
            key = r['url'] or (r['title'] + str(r['year']))
            if key not in records:
                r['matched'] = [label]
                records[key] = r
            elif label not in records[key]['matched']:
                records[key]['matched'].append(label)

    cqls = []
    for t in terms:
        words = t.split(' ')
        if len(words) == 1:
            cqls.append(f'title="{t}"')
            cqls.append(f'subject="{t}"')
        cqls.append('anywhere=' + ' AND anywhere='.join(f'"{w}"' for w in words))
    for q in extra.get('cql', []):
        cqls.append(q)
    with ThreadPoolExecutor(3) as ex:
        for cql, (total, recs) in zip(cqls, ex.map(sru, cqls)):
            add('SRU ' + cql, total, recs)
    recs = list(records.values())
    if exclude:
        recs = [r for r in recs if not exclude.search((r['title'] or '') + ' ' + (r['volume'] or '') + ' ' + (r['publisher'] or ''))]
    for r in recs:
        r['score'] = score(r, title_terms)
    recs.sort(key=lambda r: (-r['score'], r['year'] or 9999))
    counts = {}
    for r in recs:
        counts[r['access']] = counts.get(r['access'], 0) + 1
    labs = {}
    for t in terms:
        total, books = lab(t.split(' ')[0])
        if exclude:
            books = [b for b in books if not exclude.search((b['title'] or '') + ' ' + (b['by'] or ''))]
        if lab_must:
            def hit_text(b):
                return ' '.join([b['title'] or '', b['by'] or '', b['publisher'] or ''] + [h['line'] for h in b['hits']])
            books = [b for b in books if any(m in hit_text(b) for m in lab_must)]
        labs[t] = {'total': total, 'books': books}
    crds = {}
    for t in terms[:4] + extra.get('crd', []):
        total, qa = crd(t)
        crds[t] = {'total': total, 'items': qa}
    jitems = []
    for t in terms[:3] + extra.get('jps', []):
        jitems += jps(t)
    seen = set()
    jitems = [j for j in jitems if not (j['id'] in seen or seen.add(j['id']))]
    return {
        'id': c['id'], 'name': c['ja'], 'checkedOn': time.strftime('%Y-%m-%d'),
        'queries': log, 'uniqueRecords': len(recs), 'byAccess': counts,
        'top': recs[:60],
        'internet': [r for r in recs if r['access'] == 'internet'][:120],
        'transmissionLocalHistories': [r for r in recs if r['access'] == 'transmission' and LOCAL.search(r['title'] or '')][:80],
        'paperLocalHistories': [r for r in recs if r['access'] in ('paper', 'inlibrary') and LOCAL.search(r['title'] or '') and any(k in (r['title'] or '') for k in title_terms)][:60],
        'maps': [r for r in recs if any('地図' in m for m in r['materialTypes']) or re.search(r'(地図|絵図|図$)', r['title'] or '')][:40],
        'labTOC': labs, 'crd': crds, 'japanSearchReusable': jitems[:80],
    }


def main():
    cands = {c['id']: c for c in json.load(open(os.path.join(HERE, 'candidates.json'), encoding='utf-8'))['candidates']}
    extra_path = os.path.join(HERE, 'ndl-queries.json')
    extras = json.load(open(extra_path, encoding='utf-8')) if os.path.exists(extra_path) else {}
    os.makedirs(OUT, exist_ok=True)
    for cid in sys.argv[1:]:
        c = cands[cid]
        t0 = time.time()
        res = harvest(c, extras.get(cid, {}))
        with open(os.path.join(OUT, cid + '.json'), 'w', encoding='utf-8') as f:
            json.dump(res, f, ensure_ascii=False, separators=(',', ':'))
            f.write('\n')
        print(cid, 'records', res['uniqueRecords'], res['byAccess'], 'lab', {k: v['total'] for k, v in res['labTOC'].items()},
              'crd', {k: v['total'] for k, v in res['crd'].items()}, 'jps', len(res['japanSearchReusable']), f'{time.time()-t0:.0f}s', flush=True)


if __name__ == '__main__':
    main()
