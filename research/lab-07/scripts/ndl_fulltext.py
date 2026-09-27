"""NDL Digital Collections full-text survey for the page 07 districts.

    python3 ndl_fulltext.py <id> [...]      # or: all

The Digital Collections search the OCR text of about 2.47 million digitised items, including items that
can only be read by registered users (送信サービス, "ooc") or at the NDL ("inlibrary"). For every query of a
district this records how many items mention it, split by access, the top items, and the frames (page
images) where the words occur. Only bibliographic data, access classes and frame numbers are stored —
no snippets, no page text. Output: research/lab-07/ndl-fulltext/<id>.json"""
import json, os, sys, time, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'ndl-fulltext')
API = 'https://dl.ndl.go.jp/api/'
HEAD = {'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'JapanTimeAtlas-lab07/1.0 (+https://japantimeatlas.com)'}
ACCESS = {'internet': 'internet', 'ooc': 'transmission', 'inlibrary': 'inlibrary', 'ndl_only': 'inlibrary'}

QUERIES = {
    'tokyo-asakusa': ['浅草区 震災', '被服廠 横網', '本所区 埋立'],
    'tokyo-harajuku': ['ワシントンハイツ 代々木', '穏田 原宿', '代々木練兵場'],
    'yokohama-kannai': ['山下町 居留地', '関内 横浜 震災', '南京町 横浜'],
    'yokosuka': ['横須賀製鉄所 ヴェルニー', '横須賀 米海軍 基地', '汐入 横須賀'],
    'kyoto-higashiyama': ['鴨川 水害 昭和十年', '清水寺 五条坂', '祇園 花見小路'],
    'osaka-namba': ['道頓堀 堀川', '大正橋 津浪', '難波新地'],
    'kobe-meriken': ['神戸 居留地 外国人', '生田川 付替', 'メリケン波止場'],
    'hiroshima-peace': ['中島本町', '材木町 広島', '猿楽町 広島'],
    'nagasaki-dejima': ['出島 埋立', '唐人屋敷', '南山手 グラバー'],
    'suo-oshima': ['大島郡 布哇', '久賀村 布哇', '屋代村 布哇'],
    'mio': ['三尾村 加奈陀', '工野儀兵衛', '三尾村 アメリカ'],
    'kin': ['金武村 移民', '當山久三', '金武村 布哇'],
    'chatan': ['北谷村 嘉手納', 'ハンビー 北谷', '北谷 米軍'],
    'sapporo': ['創成川', '札幌 大通 火防', '開拓使 札幌 区画'],
    'hakodate': ['函館 大火 昭和九年', '函館 元町 居留地', '弁天 函館 埋立'],
    'fukuoka-hakata': ['博多 冷泉', '太閤町割', '博多津'],
    'kanazawa': ['八田與一', '辰巳用水', '東茶屋 金沢'],
    'fujiyoshida': ['上吉田 御師', '吉田口 登山', '新倉 忠霊塔'],
    'niseko': ['比羅夫 スキー', '倶知安 スキー', '狩太'],
    'kure': ['英連邦軍 呉市', '呉市 進駐軍', '呉鎮守府 設置'],
}


def post(path, body, tries=4):
    data = json.dumps(body, ensure_ascii=False).encode('utf-8')
    for attempt in range(tries):
        try:
            req = urllib.request.Request(API + path, data=data, headers=HEAD, method='POST')
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.load(r)
        except Exception as e:
            err = e
            time.sleep(2 * (attempt + 1))
    print('  ! failed', path, err, file=sys.stderr)
    return None


def survey(query, size=30, frames_for=20):
    res = post('item/search', {'accessRestrictions': ['internet', 'ooc', 'inlibrary'], 'fullText': True, 'pageNum': '0',
                               'pageSize': str(size), 'sortKey': 'SCORE', 'order': 'DESC', 'keyword': query,
                               'fullTextInterval': len(query.split()) > 1, 'ftInterval': 60, 'excludeVolumeNum': False})
    if not res:
        return {'query': query, 'total': None}
    by = {}
    for b in (res.get('aggregations', {}).get('asMap', {}).get('accessRestrictions', {}) or {}).get('buckets', []):
        by[ACCESS.get(b['key'], b['key'])] = b['docCount']
    items = []
    for h in res.get('searchHits', []):
        c = h['content']
        m = c.get('meta', {})
        items.append({'pid': c.get('itemId'), 'title': (m.get('0001Dtct') or [''])[0], 'volume': (m.get('0007Dtct') or [''])[0],
                      'by': (m.get('0010Dtct') or [''])[0], 'year': (m.get('0059Dk') or [''])[0],
                      'access': ACCESS.get((c.get('permission') or {}).get('rule'), (c.get('permission') or {}).get('rule')),
                      'bids': [b['id'] for b in c.get('contentsBundles') or []]})
    words = query.split()
    targets = [{'pid': it['pid'], 'bids': it['bids']} for it in items[:frames_for] if it['bids']]
    pages = post('fulltext/search', {'keyword': query, 'keywords': words, 'targets': targets, 'mode': 'SNIPPET', 'sort': 'SCORE',
                                     'size': 10, 'fullTextInterval': len(words) > 1, 'ftInterval': 60}) if targets else None
    for it in items:
        hit = (pages or {}).get(it['pid']) or {}
        it['pageHits'] = hit.get('totalHit')
        it['frames'] = sorted({ct.get('index') for ct in hit.get('contents', []) if isinstance(ct.get('index'), int)})[:10]
        it['url'] = f"https://dl.ndl.go.jp/pid/{it['pid']}" + (f"/1/{it['frames'][0]}" if it['frames'] else '')
        del it['bids']
    return {'query': query, 'proximity': 'all words within 60 characters' if len(words) > 1 else None, 'total': res.get('totalHits'), 'byAccess': by, 'items': items}


def main():
    ids = list(QUERIES) if sys.argv[1:] == ['all'] else sys.argv[1:]
    os.makedirs(OUT, exist_ok=True)
    for did in ids:
        out = {'id': did, 'checkedOn': time.strftime('%Y-%m-%d'), 'source': 'https://dl.ndl.go.jp (full-text search of digitised items)',
               'queries': [survey(q) for q in QUERIES[did]]}
        with open(os.path.join(OUT, did + '.json'), 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
            f.write('\n')
        print(did, [(q['query'], q['total'], q.get('byAccess')) for q in out['queries']], flush=True)


if __name__ == '__main__':
    main()
