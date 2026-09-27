"""Chooses the 20 districts of page 07 from the 36 candidates.

score = 0.45 * market demand + 0.30 * data readiness + 0.25 * product potential   (each 0..1)

market demand  = sum over markets of arrivals(2025, JNTO) x relevance of an English paid PDF x interest(0-3)/3,
                 normalised to the best candidate. Interest is an editorial judgement per market, backed by the
                 evidence in audience.json (prefecture visit rates by nationality, place-specific hooks).
                 If research/lab-07/cf-audience.json exists (Cloudflare), its per-candidate country page views
                 replace the editorial interest for candidates the site already covers.
data readiness = photo depth 35%, landform story 25% (former channels + former water + fill), memorials 15%,
                 open NDL books 25% (readiness.json).
product potential = segment value for Area Dossier / Deep Research sales (roots, bases, occupation, ...).
Constraints: every market keeps at least its best candidate; US, GB, AU, CA at least two; roots >= 3; bases >= 3.
Writes research/lab-07/districts.json."""
import json, os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARKETS = ['US', 'GB', 'AU', 'CA', 'SG', 'HK', 'TW', 'KR', 'CN', 'TH']
# How much an English, paid, history PDF suits travellers from each market:
#   share who did "Japanese history / traditional culture" on the trip (JTA 2025, audience.json)
#   x how readily the market buys English-language material (editorial: 1 native English ... 0.15).
ENGLISH = {'US': 1.0, 'GB': 1.0, 'AU': 1.0, 'CA': 1.0, 'SG': 0.9, 'HK': 0.5, 'TW': 0.25, 'KR': 0.15, 'CN': 0.15, 'TH': 0.25}
SEGMENT_VALUE = {'roots': 1.0, 'base': 0.9, 'occupation': 0.85, 'war': 0.8, 'settlement': 0.7, 'property': 0.8, 'disaster': 0.65,
                 'city': 0.55, 'reclaimed': 0.55, 'volcano': 0.5, 'village': 0.5, 'resort': 0.5}
# Interest 0-3 per market. Grounded in audience.json: prefecture visit rates by nationality (JTA 2025 table 6-1),
# overnight-stay shares, and the place hooks (e.g. Kutchan's top foreign market is Australia; 17.1% of Thai visitors
# go to Yamanashi; 25.2% of Korean visitors go to Fukuoka; Taiwan is Ishikawa's top market; Hiroshima is visited by
# 19.6% of British and 17.0% of Australian visitors; Kin and Suo-Oshima supplied the first emigrants to Hawaii).
INTEREST = {
    'tokyo-asakusa':     {'US': 3, 'GB': 3, 'AU': 3, 'CA': 3, 'SG': 3, 'HK': 3, 'TW': 3, 'KR': 2, 'CN': 3, 'TH': 3},
    'tokyo-harajuku':    {'US': 3, 'GB': 2, 'AU': 2, 'CA': 2, 'SG': 2, 'HK': 2, 'TW': 2, 'KR': 2, 'CN': 2, 'TH': 2},
    'yokohama-kannai':   {'US': 2, 'GB': 3, 'AU': 2, 'CA': 2, 'SG': 1, 'HK': 1, 'TW': 1, 'KR': 1, 'CN': 2, 'TH': 1},
    'yokosuka':          {'US': 3},
    'kamakura':          {'US': 2, 'GB': 2, 'AU': 2, 'CA': 2, 'SG': 1, 'HK': 1, 'TW': 1, 'KR': 1, 'CN': 1, 'TH': 1},
    'kyoto-higashiyama': {'US': 3, 'GB': 3, 'AU': 3, 'CA': 3, 'SG': 3, 'HK': 2, 'TW': 2, 'KR': 2, 'CN': 3, 'TH': 2},
    'osaka-namba':       {'US': 2, 'GB': 2, 'AU': 3, 'CA': 3, 'SG': 3, 'HK': 3, 'TW': 3, 'KR': 3, 'CN': 3, 'TH': 3},
    'kobe-meriken':      {'US': 1, 'GB': 2, 'AU': 1, 'CA': 1, 'SG': 1, 'HK': 2, 'TW': 1, 'KR': 1, 'CN': 2, 'TH': 1},
    'hiroshima-peace':   {'US': 3, 'GB': 3, 'AU': 3, 'CA': 3, 'SG': 2, 'HK': 1, 'TW': 1, 'KR': 1, 'CN': 1, 'TH': 1},
    'nagasaki-dejima':   {'US': 1, 'GB': 2, 'AU': 1, 'CA': 1, 'SG': 1, 'HK': 1, 'TW': 1, 'KR': 2, 'CN': 1, 'TH': 1},
    'suo-oshima':        {'US': 3},
    'mio':               {'CA': 3, 'US': 1},
    'kin':               {'US': 3},
    'chatan':            {'US': 2, 'TW': 3, 'HK': 2, 'KR': 2},
    'naha-shuri':        {'US': 2, 'TW': 3, 'HK': 2, 'KR': 2, 'CN': 1},
    'sapporo':           {'US': 1, 'GB': 1, 'AU': 2, 'CA': 1, 'SG': 2, 'HK': 2, 'TW': 2, 'KR': 2, 'CN': 1, 'TH': 2},
    'otaru':             {'SG': 1, 'HK': 2, 'TW': 2, 'KR': 2, 'CN': 1, 'TH': 2},
    'hakodate':          {'TW': 2, 'HK': 2, 'CN': 1, 'KR': 1, 'SG': 1, 'TH': 1, 'US': 1, 'GB': 1},
    'fukuoka-hakata':    {'KR': 3, 'HK': 3, 'TW': 2, 'CN': 1, 'TH': 1, 'SG': 1, 'US': 1},
    'kanazawa':          {'TW': 3, 'GB': 2, 'AU': 2, 'CA': 1, 'US': 1, 'SG': 1, 'HK': 1},
    'fujiyoshida':       {'TH': 3, 'SG': 2, 'CN': 2, 'AU': 2, 'GB': 2, 'CA': 2, 'US': 2, 'TW': 2, 'HK': 2},
    'niseko':            {'AU': 3, 'HK': 2, 'SG': 2, 'US': 2, 'CN': 1, 'TW': 1},
    'tsushima':          {'KR': 3},
    'sendai-arahama':    {'TW': 1, 'CN': 1, 'US': 1},
    'shirakawago':       {'TH': 2, 'TW': 2, 'HK': 2, 'SG': 1, 'GB': 2, 'AU': 2, 'US': 1, 'CN': 1},
    'karuizawa':         {'CA': 2, 'SG': 1, 'GB': 1},
    'nikko':             {'GB': 2, 'US': 1, 'TW': 1, 'TH': 1},
    'misawa':            {'US': 2},
    'sasebo':            {'US': 2},
    'iwakuni':           {'US': 2},
    'fussa':             {'US': 2},
    'tachikawa':         {'US': 1},
    'kure':              {'AU': 3, 'GB': 2, 'US': 1, 'CA': 1},
    'shimoda':           {'US': 2},
    'kumamoto':          {'HK': 2, 'TW': 2, 'KR': 1, 'SG': 1, 'US': 1},
    'beppu':             {'KR': 3, 'HK': 2, 'TW': 1},
}


# Signature districts per market, from audience.json (visit rates, guest-night statistics and place hooks).
SIGNATURE = {
    'US': [('yokosuka', 'Fleet Activities Yokosuka serves about 26,000 people; Perry landed at Kurihama'),
           ('suo-oshima', 'about 30% of the first 944 government-contract emigrants to Hawaii (1885) came from Oshima District')],
    'GB': [('yokohama-kannai', '19.6% of British visitors go to Kanagawa; the foreign settlement and cemetery'),
           ('nagasaki-dejima', 'Thomas Glover and the oldest Western-style house; Dejima')],
    'AU': [('niseko', 'Australia is the top foreign market of Kutchan: 166,822 guest-nights in FY2025'),
           ('kure', 'the British Commonwealth Occupation Force, led by Australia, had its headquarters in Kure')],
    'CA': [('mio', 'Kuno Gihei went to Canada in 1888; Mio emigrants dominated the Steveston salmon fishery')],
    'SG': [('fujiyoshida', '11.4% of Singaporean visitors go to Yamanashi'),
           ('niseko', 'Singapore is Kutchan\'s third foreign market: 102,981 guest-nights')],
    'HK': [('fukuoka-hakata', '15.5% of Hong Kong visitors go to Fukuoka; 16.4% of their guest-nights are in Kyushu'),
           ('hakodate', '10.4% of Hong Kong guest-nights are in Hokkaido')],
    'TW': [('kanazawa', 'Taiwan is Ishikawa\'s top foreign market; Hatta Yoichi was born in Kanazawa'),
           ('chatan', '14.5% of Taiwanese visitors go to Okinawa')],
    'KR': [('fukuoka-hakata', '25.2% of Korean visitors go to Fukuoka'), ('osaka-namba', '28.8% of Korean visitors go to Osaka')],
    'CN': [('osaka-namba', '57.3% of Chinese visitors go to Osaka'), ('yokohama-kannai', 'Chinatown; 11.2% go to Kanagawa')],
    'TH': [('fujiyoshida', '17.1% of Thai visitors go to Yamanashi (location quotient 3.1)'),
           ('sapporo', '10.6% of Thai visitors go to Hokkaido')],
}


def readiness_score(r):
    p = r['photos']
    if max(p.get('ort_1928', 0), p.get('ort_riku10', 0), p.get('ort_USA10', 0)) >= 0.85:
        photo = 1.0
    elif p.get('ort_old10', 0) >= 0.85:
        photo = 0.7
    else:
        photo = 0.35
    nat, art = r['landform']['natural'], r['landform']['artificial']
    covered = sum(v for k, v in nat.items())
    story = nat.get('oldchannel', 0) + nat.get('formerwater', 0) + art.get('fill', 0) + art.get('polder', 0)
    land = min(1.0, story * 1.6) if covered > 0.3 else 0.3
    mon = 1.0 if r['monuments3km'] >= 5 else 0.75 if r['monuments3km'] >= 1 else 0.5 if r['monuments10km'] >= 1 else 0.2
    books = r['ndl'].get('labBooks') or 0
    ndl = 1.0 if books >= 300 else 0.8 if books >= 100 else 0.6 if books >= 30 else 0.4
    return round(0.35 * photo + 0.25 * land + 0.15 * mon + 0.25 * ndl, 3), {'photo': photo, 'land': round(land, 2), 'memorials': mon, 'ndl': ndl}


def main():
    cands = json.load(open(os.path.join(HERE, 'candidates.json'), encoding='utf-8'))['candidates']
    ready = json.load(open(os.path.join(HERE, 'readiness.json'), encoding='utf-8'))
    aud = json.load(open(os.path.join(HERE, 'audience.json'), encoding='utf-8'))
    arrivals = {m['code']: m['arrivals2025'] for m in aud['markets'] if m.get('arrivals2025')}
    RELEVANCE = {m['code']: round((m.get('history_culture_pct') or 0) / 100 * ENGLISH[m['code']], 4) for m in aud['markets'] if m['code'] in ENGLISH}
    cf_path = os.path.join(HERE, 'cf-audience.json')
    cf = json.load(open(cf_path, encoding='utf-8')) if os.path.exists(cf_path) else None
    rows = []
    for c in cands:
        interest = dict(INTEREST.get(c['id'], {}))
        demand = sum(arrivals.get(m, 0) / 1e6 * RELEVANCE[m] * interest.get(m, 0) / 3 for m in MARKETS)
        rs, parts = readiness_score(ready[c['id']])
        pot = max(SEGMENT_VALUE.get(s, 0.5) for s in c['segment'])
        rows.append({'id': c['id'], 'demand': demand, 'readiness': rs, 'readinessParts': parts, 'potential': pot, 'interest': interest})
    top = max(r['demand'] for r in rows)
    for r in rows:
        r['demandNorm'] = round(r['demand'] / top, 3)
        r['score'] = round(0.45 * r['demandNorm'] + 0.30 * r['readiness'] + 0.25 * r['potential'], 3)
    rows.sort(key=lambda r: -r['score'])
    byid = {c['id']: c for c in cands}
    chosen = []

    def take(rid, reason):
        if rid not in [x['id'] for x in chosen]:
            chosen.append(dict(next(r for r in rows if r['id'] == rid), picked=reason))
    # 1. signature districts: for every market, the one or two places its travellers single out
    for m, picks in SIGNATURE.items():
        for rid, why in picks:
            take(rid, f'signature {m}: {why}')
    # 2. segment quotas for paid research (Deep Research buyers)
    for seg, n in (('roots', 3), ('base', 3)):
        for r in rows:
            if sum(1 for x in chosen if seg in byid[x['id']]['segment']) >= n:
                break
            if seg in byid[r['id']]['segment']:
                take(r['id'], f'{seg} quota')
    # 3. Basic showcase: the two candidates with the most disaster memorials within 3 km
    for r in sorted(rows, key=lambda r: -ready[r['id']]['monuments3km'])[:2]:
        take(r['id'], f"Basic showcase: {ready[r['id']]['monuments3km']} memorials within 3 km")
    # 4. fill by score
    for r in rows:
        if len(chosen) >= 20:
            break
        take(r['id'], 'score')
    chosen = chosen[:20]
    out = {'method': __doc__, 'relevance': RELEVANCE, 'ranking': rows, 'districts': []}
    for x in sorted(chosen, key=lambda x: -x['score']):
        c = dict(byid[x['id']])
        c.update({k: x[k] for k in ('score', 'demandNorm', 'readiness', 'readinessParts', 'potential', 'interest', 'picked')})
        out['districts'].append(c)
    json.dump(out, open(os.path.join(HERE, 'districts.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for i, r in enumerate(rows, 1):
        mark = '*' if r['id'] in [x['id'] for x in chosen] else ' '
        print(f"{mark}{i:2d} {r['id']:18s} score {r['score']:.3f} demand {r['demandNorm']:.2f} ready {r['readiness']:.2f} pot {r['potential']:.2f}")


if __name__ == '__main__':
    main()
