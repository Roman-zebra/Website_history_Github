"""Content of page 07 (Japanese). Tables come from research/lab-07/*.json; the commentary is written here.
Used by page.py."""
import json, os, re
from page import HERE, ROOT, OUT, TODAY, load, esc, mb, link, ACCESS_JA, SEG_JA, LAYER_JA, LF_JA

MARKET_JA = {'US': '米国', 'GB': '英国', 'AU': '豪州', 'CA': 'カナダ', 'SG': 'シンガポール', 'HK': '香港', 'TW': '台湾',
             'KR': '韓国', 'CN': '中国', 'TH': 'タイ', 'BR': 'ブラジル', 'PE': 'ペルー'}
MARKETS = ['US', 'GB', 'AU', 'CA', 'SG', 'HK', 'TW', 'KR', 'CN', 'TH']
PREF_JA = {'Tokyo': '東京', 'Kanagawa': '神奈川', 'Osaka': '大阪', 'Kyoto': '京都', 'Hyogo': '兵庫', 'Hiroshima': '広島',
           'Nagasaki': '長崎', 'Fukuoka': '福岡', 'Hokkaido': '北海道', 'Okinawa': '沖縄', 'Yamanashi': '山梨', 'Ishikawa': '石川',
           'Yamaguchi': '山口', 'Wakayama': '和歌山', 'Nagano': '長野'}
SEG_JA.update({'war': '戦争の記憶'})
CLASS_JA = {'A': 'A 商用可（出典表示）', 'B': 'B 条件付き', 'C': 'C 引用・リンクのみ', 'D': 'D 避ける'}


def pct(v):
    return f'{v * 100:.0f}%' if v >= 0.095 else f'{v * 100:.1f}%' if v >= 0.005 else '—'


def num(v):
    return f'{v:,}' if isinstance(v, (int, float)) else '—'


def pdf_pages(path):
    try:
        with open(path, 'rb') as f:
            data = f.read()
        return len(re.findall(rb'/Type\s*/Page[^s]', data))
    except OSError:
        return 0


def fulltext_html(ft):
    if not ft:
        return ''
    out = []
    for q in ft['queries']:
        if not q.get('total'):
            out.append(f"<li><b>{esc(q['query'])}</b>：0件</li>")
            continue
        by = q.get('byAccess', {})
        items = ''.join(
            f"<li>{link(it['url'], (it['title'] or '')[:60])}{(' ' + esc(it['volume'])) if it.get('volume') else ''} <span class='muted'>({esc(it.get('year') or '')}・{ACCESS_JA.get(it.get('access'), it.get('access') or '')}"
            f"{'・' + ','.join(str(f) for f in it['frames'][:6]) + 'コマ' if it.get('frames') else ''})</span></li>" for it in q['items'][:8])
        out.append(f"<li><b>{esc(q['query'])}</b>{'（近接60字）' if q.get('proximity') else ''}：本文ヒット {q['total']:,}件（ネット公開 {by.get('internet', 0):,}・送信 {by.get('transmission', 0):,}・館内 {by.get('inlibrary', 0):,}）<ul class='src'>{items}</ul></li>")
    return '<h3>デジタルコレクション全文検索（本文OCR・コマ番号つき）</h3><ul class="src">' + ''.join(out) + '</ul>'


def ndl_block(d, nd, ft=None):
    """Per-district NDL result, collapsed."""
    if not nd:
        return f'<details><summary>{esc(d["ja"])} <small>NDL調査データなし</small></summary></details>'
    acc = nd.get('byAccess', {})
    qrows = ''.join(f'<tr><td>{esc(q["query"].replace("SRU ", ""))}</td><td class="num">{q["total"]:,}</td></tr>' for q in nd['queries'])

    def rec(r):
        pid = r['pids'][0] if r.get('pids') else None
        url = f'https://dl.ndl.go.jp/pid/{pid}' if pid and r['access'] == 'internet' else r['url']
        vol = f' {esc(r["volume"])}' if r.get('volume') else ''
        return f'<li>{link(url, (r["title"] or "")[:80])}{vol} <span class="muted">({esc(r.get("year") or "")}・{ACCESS_JA.get(r["access"], "")})</span></li>'
    internet = ''.join(rec(r) for r in nd.get('internet', [])[:12])
    trans = ''.join(rec(r) for r in nd.get('transmissionLocalHistories', [])[:10])
    paper = ''.join(rec(r) for r in nd.get('paperLocalHistories', [])[:8])
    lab = []
    for term, v in nd.get('labTOC', {}).items():
        for b in v.get('books', [])[:4]:
            fr = next((h['frame'] for h in b['hits'] if h.get('frame')), None)
            line = next((h['line'] for h in b['hits'] if h.get('frame')), (b['hits'][0]['line'] if b['hits'] else ''))
            url = f'https://dl.ndl.go.jp/pid/{b["pid"]}' + (f'/1/{fr}' if fr else '')
            lab.append(f'<li>{link(url, (b["title"] or "")[:60])} <span class="muted">({esc(b.get("year") or "")}{"・" + str(fr) + "コマ" if fr else ""})：{esc(line[:70])}</span></li>')
    crd = []
    for term, v in nd.get('crd', {}).items():
        for it in v.get('items', [])[:2]:
            crd.append(f'<li>{link(it["url"] or "https://crd.ndl.go.jp/", it["question"][:90])} <span class="muted">（{esc(it["library"])}）</span></li>')
    jps = ''.join(f'<li>{link(j["jps"], (j["title"] or "")[:60])} <span class="muted">（{esc(j["provider"])}・{esc(j["rights"])}）</span></li>' for j in nd.get('japanSearchReusable', [])[:6])
    return f"""<details><summary>{esc(d['ja'])} <small>固有書誌 {nd['uniqueRecords']:,}件 ／ ネット公開 {acc.get('internet', 0):,}・個人送信 {acc.get('transmission', 0):,}・館内 {acc.get('inlibrary', 0):,}・紙 {acc.get('paper', 0):,}</small></summary>
<div class="scroll"><table><tr><th>検索式（NDLサーチSRU）</th><th>ヒット</th></tr>{qrows}</table></div>
<h3>ログインなしで読める資料（関連度上位）</h3><ul class="src">{internet or '<li class="muted">なし</li>'}</ul>
{fulltext_html(ft)}
<h3>目次で地名が見つかった公開図書（NDLラボ・コマ番号つき）</h3><ul class="src">{''.join(lab[:8]) or '<li class="muted">なし</li>'}</ul>
<h3>Deep Research向け：個人送信・紙の郷土史</h3><ul class="src">{trans}{paper or ''}{'' if (trans or paper) else '<li class="muted">なし</li>'}</ul>
<h3>レファレンス協同データベース（図書館の調査事例）</h3><ul class="src">{''.join(crd[:8]) or '<li class="muted">なし</li>'}</ul>
<h3>ジャパンサーチ：商用利用可の権利表示がある資料（リンクのみ）</h3><ul class="src">{jps or '<li class="muted">なし</li>'}</ul></details>"""


def context():
    aud = load('audience.json', {})
    sel = load('districts.json', {'districts': [], 'ranking': []})
    ready = load('readiness.json', {})
    bmeta = load('basic-meta.json', {})
    lic = load('licenses.json', None)
    districts = sel['districts']
    ndl = {d['id']: load(os.path.join('ndl', d['id'] + '.json'), None) for d in districts}
    ftx = {d['id']: load(os.path.join('ndl-fulltext', d['id'] + '.json'), None) for d in districts}
    dossiers = {d['id']: load(os.path.join('dossier', d['id'] + '.json'), None) for d in districts}
    deep = load(os.path.join('deep', 'sample-suo-oshima-kuka.json'), None)
    pdf = lambda name: os.path.join(OUT, 'pdf', name)

    # ---------- numbers for the summary
    tot_records = sum(n['uniqueRecords'] for n in ndl.values() if n)
    tot_internet = sum(n['byAccess'].get('internet', 0) for n in ndl.values() if n)
    tot_trans = sum(n['byAccess'].get('transmission', 0) for n in ndl.values() if n)
    tot_queries = sum(len(n['queries']) for n in ndl.values() if n)
    tot_crd = sum(v['total'] for n in ndl.values() if n for v in n['crd'].values())
    tot_jps = sum(len(n['japanSearchReusable']) for n in ndl.values() if n)
    n_ndl = sum(1 for n in ndl.values() if n)
    basics = [d for d in districts if os.path.exists(pdf(f'basic-{d["id"]}.pdf'))]
    doss = [d for d in districts if os.path.exists(pdf(f'dossier-{d["id"]}.pdf'))]
    deep_pdf = os.path.exists(pdf('deep-research-sample-suo-oshima.pdf'))

    S = []
    S.append('<nav class="toc" aria-label="目次"><a href="#summary">要約</a><a href="#audience">1 訪問者の想定</a><a href="#districts">2 20地区の選定</a><a href="#ndl">3 NDLサーチ調査</a><a href="#rights">4 権利</a><a href="#products">5 試作品</a><a href="#next">6 次の一手</a></nav>')
    S.append(f"""<h2 id="summary">要約</h2>
<div class="grid">
<div class="stat"><b>20地区</b><span>36候補から、国別の関心・有料調査の需要・データの揃い具合で選定</span></div>
<div class="stat"><b>{tot_records:,}件</b><span>NDLサーチの固有書誌（{n_ndl}地区・検索{tot_queries}本）。うちログインなしで読める{tot_internet:,}件、個人送信{tot_trans:,}件</span></div>
<div class="stat"><b>{len(basics)}本</b><span>Basic（英語PDF・自動生成）</span></div>
<div class="stat"><b>{len(doss)}本</b><span>Area Dossier（Basic＋英語の歴史レポート）{'・Deep Research見本1本' if deep_pdf else ''}</span></div>
</div>
<ul>
<li><b>誰が買うか。</b>英語の歴史商品の中心は米・英・豪・加です。訪日中に「日本の歴史・伝統文化体験」をした割合は65〜75%で、東アジア（12〜25%）の約3倍、1人当たり支出も最大です。数では韓国・中国・台湾が上回りますが、英語PDFの購買層ではありません（将来の各言語版の対象）。</li>
<li><b>高単価（Deep Research）の母集団は二つ。</b>米国の日系人158.7万人（うちハワイ31.3万人、2020年国勢調査）など海外日系社会と、在日米軍の現役5.5万人とその家族・OBです。周防大島・三尾・金武は祖先の村探し、横須賀・北谷は基地の町の記憶に直結します。</li>
<li><b>NDLサーチで「できる範囲」の中身。</b>戦前の町の案内記・郡誌・写真帖などは保護期間満了で誰でも読めます。戦後の市史・町誌の多くは「個人送信」（登録利用者のみ）か紙だけで、ここが人手の調査＝Deep Researchの価値になります。</li>
<li><b>データの弱点。</b>沖縄は米国の施政下にあったため地理院の空中写真が1974年以降しかありません（1945年前後は米国国立公文書館の写真で補える見込み）。{'・'.join(d['ja'].split('（')[0] for d in districts if bmeta.get(d['id'], {}).get('landformScale') == 'regional') or '一部の地区'}は詳細な地形分類がなく、国土地理院の広域版で代用しました。</li>
<li><b>Cloudflareの実アクセスは未反映。</b>このセッションには解析の権限がないため、公式統計で代替しました。読み取り専用トークンがあれば、国別×ページ別の実数で順位を付け直せます（下記）。</li>
</ul>""")

    # ---------- audience
    mrows = []
    rel = sel.get('relevance', {})
    for m in aud.get('markets', []):
        mrows.append(f"<tr><td>{esc(MARKET_JA.get(m['code'], m['code']))}</td><td class='num'>{num(m.get('arrivals2025'))}</td>"
                     f"<td class='num'>{num(m.get('janAug2026'))}<br><span class='muted small'>{'' if m.get('janAug2026_yoy_pct') is None else ('%+.1f%%' % m['janAug2026_yoy_pct'])}</span></td>"
                     f"<td class='num'>{m.get('history_culture_pct', '—')}%</td><td class='num'>{m.get('first_time_pct', '—')}%</td>"
                     f"<td class='num'>¥{num(m.get('yen_per_person_all_purposes'))}</td><td class='num'>{rel.get(m['code'], 0):.2f}</td></tr>")
    rates = aud.get('prefectureVisitRates', {}).get('rates', {})
    prefs = ['Tokyo', 'Kanagawa', 'Kyoto', 'Osaka', 'Hiroshima', 'Hokkaido', 'Okinawa', 'Fukuoka', 'Yamanashi', 'Ishikawa', 'Nagasaki', 'Yamaguchi', 'Wakayama', 'Nagano']
    prow = ''.join('<tr><td>' + esc(PREF_JA.get(p, p)) + '</td>' + ''.join(
        f"<td class='num'>{rates.get(m, {}).get(p, 0):.1f}</td>" for m in ['ALL'] + MARKETS) + '</tr>' for p in prefs)
    seg = aud.get('segments', {})
    nik = ''.join(f"<li>{esc(x['country'])}：{num(x['figure'])}人 <span class='muted'>（{esc(x['definition'][:60])}・{esc(x['year'])}）</span></li>" for x in seg.get('nikkei', []))
    hooks = ''.join(f"<li><b>{esc(MARKET_JA.get({'USA': 'US', 'UK': 'GB', 'Hong Kong': 'HK', 'Taiwan': 'TW', 'Korea': 'KR', 'China': 'CN', 'Thailand': 'TH', 'Australia': 'AU', 'Canada': 'CA', 'Singapore': 'SG'}.get(h['market'], ''), h['market']))}</b>・{esc(h['place'])}：{esc(h.get('evidence', '')[:170])}</li>" for h in aud.get('placeHooks', []))
    S.append(f"""<h2 id="audience">1. サイトに来る人の想定（国別）</h2>
<div class="note"><b>Cloudflareの解析について。</b>サイトはCloudflare Workersで配信されていますが、このセッションには解析APIの権限がありません。代わりに、国籍別の公式統計（JNTO訪日外客数、観光庁インバウンド消費動向調査・宿泊旅行統計）で「サイトの対象10市場の旅行者が、どこで何をするか」を推定しました。実アクセスで順位を付け直すには、クラウド環境の設定（セッション上部の環境メニュー → Edit）に、Cloudflareの読み取り専用APIトークン（テンプレート「Read analytics and logs」、japantimeatlas.comのみ）を環境変数 <code>CF_API_TOKEN</code> として追加し、新しいセッションで <code>node research/lab-07/scripts/cf-audience.cjs</code> を実行します。国別の閲覧数と、各候補地区の場所ページを国ごとに何回開いたかが <code>cf-audience.json</code> に出力され、選定スクリプトがそれを優先して使います。トークンはチャットに貼らないでください。</div>
<div class="scroll"><table><tr><th>市場</th><th>2025年 訪日客</th><th>2026年1–8月</th><th>歴史・伝統文化体験</th><th>初訪日</th><th>1人当たり支出</th><th>英語PDFの適合度*</th></tr>{''.join(mrows)}</table></div>
<p class="small muted">出典：JNTO 国籍/月別訪日外客数（2025確定値、2026年1–6月暫定・7–8月推計）、観光庁 インバウンド消費動向調査 2025年年間集計表（参考3・表6-1）ほか。*適合度＝「歴史・伝統文化体験」の割合 × 英語資料の購買しやすさ（米英豪加1.0、星0.9、香0.5、台・タイ0.25、韓・中0.15。後者は編集判断）。</p>
<h3>都道府県別の訪問率（%・2025年）</h3>
<div class="scroll"><table><tr><th>都道府県</th><th>全体</th>{''.join(f'<th>{MARKET_JA[m]}</th>' for m in MARKETS)}</tr>{prow}</table></div>
<p class="small muted">観光庁 インバウンド消費動向調査 2025年 表6-1（出国時の標本調査・複数回答）。</p>
<h3>有料調査の母集団</h3><ul class="src">{nik}
<li>在日米軍の現役：54,891人（米国防人員データセンター、2026年3月31日）。横須賀の支援対象人口は約26,000人、嘉手納の米国人は約18,000人（米国防総省 Military OneSource）。</li>
<li>移民の出身県（1885–1972年）：広島109,893・沖縄89,424・熊本76,802・山口57,837・福岡57,684・和歌山32,853（広島県資料、海外移住資料館の採用値）。</li></ul>
<h3>国ごとの「この場所」の根拠</h3><ul class="src">{hooks}</ul>""")

    # ---------- selection
    rows = []
    for i, d in enumerate(districts, 1):
        r = ready.get(d['id'], {})
        bm = bmeta.get(d['id'], {})
        oldest = LAYER_JA.get(bm.get('then') or '', '—')
        lf = bm.get('landform', r.get('landform', {}))
        nat, art = lf.get('natural', {}), lf.get('artificial', {})
        story = ' '.join(f"{LF_JA[k]}{pct(v)}" for k, v in {**{k: nat.get(k, 0) for k in ('oldchannel', 'formerwater')}, **{k: art.get(k, 0) for k in ('fill', 'polder')}}.items() if v >= 0.01)
        chips = ''.join(f"<span class='chip'>{MARKET_JA[m]}{'★' if v >= 3 else ''}</span>" for m, v in sorted(d['interest'].items(), key=lambda kv: -kv[1]) if v >= 2)
        nd = ndl.get(d['id'])
        rows.append(f"<tr><td class='num'>{d['score']:.2f}</td><td><b>{esc(d['ja'])}</b><br><span class='muted small'>{esc(d['en'])}</span></td><td>{chips}</td>"
                    f"<td class='small'>{esc(d['picked'])}</td><td class='small'>{' '.join(SEG_JA.get(s, s) for s in d['segment'])}</td>"
                    f"<td>{oldest}</td><td class='small'>{story or '—'}</td><td class='num'>{r.get('monuments3km', '—')}</td>"
                    f"<td class='num'>{num(nd['uniqueRecords']) if nd else '—'}</td></tr>")
    chosen = {d['id'] for d in districts}
    reserve = [r for r in sel.get('ranking', []) if r['id'] not in chosen][:8]
    cands = {c['id']: c for c in load('candidates.json', {'candidates': []})['candidates']}
    reserve_notes = {
        'kamakura': '英語圏の関心は高い（神奈川の訪問率 英19.6%・米17.0%）が、3km圏の伝承碑が1基でBasicの見本として弱い。次点1位。',
        'iwakuni': '米国の宿泊シェア14.8%（山口）。基地の町は横須賀・北谷・金武で代表させた。',
        'sasebo': '海軍の町。基地人口の公式数値なし。横須賀で代表させた。',
        'fussa': '横田基地の門前町。1945–50年写真なし（1961年以降）。',
        'misawa': '三沢基地（約9,200人）。米国の宿泊シェア7.9%（青森）。次の基地枠の候補。',
        'naha-shuri': '台湾の沖縄訪問率14.5%。沖縄は北谷・金武で代表。1974年以前の写真なし。',
        'shimoda': 'ペリー・ハリスの米国史跡。3km圏の伝承碑1基。',
        'kumamoto': '香港・台湾の九州志向。熊本地震の伝承。移民送出3位の県だが城下町は「祖先の村」ではない。',
        'sapporo': '', 'otaru': 'タイ・台湾・香港に人気。運河の埋立が明確。北海道は札幌・函館で代表。',
        'tsushima': '韓国人入国（比田勝226,102人）の圧倒的な島。英語PDFの対象外のため韓国語版の最優先候補として保留。',
        'shirakawago': 'タイ・台湾・香港に人気の山村。詳細な地形分類なし・1974年以前の写真なし。',
        'sendai-arahama': '東日本大震災の伝承地。魯迅の縁は仙台中心部で別地区。',
    }
    rsv = ''.join(f"<li><b>{esc(cands[r['id']]['ja'])}</b>（{r['score']:.2f}）{esc(reserve_notes.get(r['id'], ''))}</li>" for r in reserve)
    S.append(f"""<h2 id="districts">2. 20地区の選定</h2>
<p>36候補のそれぞれについて、①需要（2025年の訪日客数 × 英語PDFの適合度 × 各国の関心度0〜3）、②データの揃い具合（最古の空中写真・旧河道や埋立地の割合・災害伝承碑・NDLの公開図書）、③有料調査への結びつき（移民のルーツ・基地・占領期・居留地など）を点数化しました（45:30:25）。そのうえで、</p>
<ol><li>各国の旅行者が特に選ぶ「シグネチャー地区」を1〜2か所ずつ確保（訪問率・宿泊統計・歴史的な結びつきの根拠つき）</li>
<li>Deep Researchの買い手がいる「移民のルーツ」3地区・「基地の町」3地区を確保</li>
<li>Basicの見本として災害伝承碑が最も多い2地区（浅草・両国15基、神戸10基）を確保</li>
<li>残りを総合点順で補充</li></ol>
<div class="scroll"><table><tr><th>点</th><th>地区</th><th>関心の強い国（★=最上位）</th><th>選定理由</th><th>分類</th><th>最古の写真</th><th>旧河道・埋立など</th><th>伝承碑3km</th><th>NDL書誌</th></tr>{''.join(rows)}</table></div>
<p class="small muted">点数・関心度・根拠は research/lab-07/districts.json と scripts/select.py。関心度は観光庁の都道府県別訪問率、宿泊旅行統計、自治体統計、歴史的な結びつき（公式資料）に基づく編集判断です。</p>
<h3>次点（入れ替え候補）</h3><ul class="src">{rsv}</ul>""")

    # ---------- NDL
    trows = []
    for d in districts:
        n = ndl.get(d['id'])
        if not n:
            trows.append(f"<tr><td>{esc(d['ja'])}</td><td colspan='7' class='muted'>調査中</td></tr>")
            continue
        labn = sum(len(v['books']) for v in n['labTOC'].values())
        crdn = sum(v['total'] for v in n['crd'].values())
        a = n['byAccess']
        trows.append(f"<tr><td>{esc(d['ja'])}</td><td class='num'>{n['uniqueRecords']:,}</td><td class='num'>{a.get('internet', 0):,}</td><td class='num'>{a.get('transmission', 0):,}</td>"
                     f"<td class='num'>{a.get('inlibrary', 0) + a.get('paper', 0):,}</td><td class='num'>{labn}</td><td class='num'>{crdn:,}</td><td class='num'>{len(n['japanSearchReusable'])}</td></tr>")
    blocks = ''.join(ndl_block(d, ndl.get(d['id']), ftx.get(d['id'])) for d in districts)
    S.append(f"""<h2 id="ndl">3. 国立国会図書館サーチでの調査（20地区）</h2>
<p>各地区で、現在と旧来の地名・主題（例：「本所区」「横須賀製鉄所」「布哇 移民 山口」）を6語ずつ設定し、NDLサーチのAPI（SRU）でタイトル・件名・全項目の3通りに検索しました（計{tot_queries}本、1本あたり最大500件取得）。同名の別地域は除外語で落としています。取得した書誌は、デジタル化資料の公開範囲で4つに分けました。</p>
<ul class="src"><li><b>ネット公開</b>：ログインなしで誰でも閲覧（保護期間満了など）。Area Dossierの根拠に使える。</li>
<li><b>個人送信</b>：NDLの登録利用者だけが閲覧可。市史・町誌の多くがここ。Deep Researchで読む。</li>
<li><b>館内限定・紙のみ</b>：国会図書館や地元の図書館で読む。Deep Researchの現地調査。</li></ul>
<p>さらに、ブラウザ（Chromium）の自動操作で国立国会図書館デジタルコレクションの全文検索を調べ、その内部APIで各地区3本ずつ本文（OCR）を検索しました。約247万点のデジタル化資料の本文が対象で、登録利用者向けの「送信サービス」や館内限定の資料でも、どの本の何コマ目に地名が出てくるかまで分かります（本文や抜粋は保存せず、書名とコマ番号だけを記録）。複数語は60字以内に並ぶものに限りました。</p>
<p>あわせて、NDLラボ（次世代デジタルライブラリー）で保護期間満了図書の目次を検索して地名が出るコマ番号を特定し、レファレンス協同データベースで各地の図書館が過去に受けた調査事例（{tot_crd:,}件ヒット）を、ジャパンサーチで商用利用可の権利表示（CC BY・PDM・CC0など）がある資料（{tot_jps}件）を集めました。保存したのは書誌・URL・コマ番号・短い目次行だけで、画像や本文は複製していません。</p>
<div class="scroll"><table><tr><th>地区</th><th>固有書誌</th><th>ネット公開</th><th>個人送信</th><th>館内・紙</th><th>目次ヒット本</th><th>レファ協</th><th>商用可</th></tr>{''.join(trows)}</table></div>
{blocks}""")

    # ---------- licenses
    if lic:
        lrows = ''.join(f"<tr><td><b>{esc(x['name'])}</b></td><td>{esc(CLASS_JA.get(x.get('class'), x.get('class')))}</td><td class='small'>{esc(x.get('attribution', ''))}</td>"
                        f"<td class='small'>{esc(x.get('embedInPaidPdf', ''))}</td><td class='small'>{esc(x.get('notes', ''))}</td><td class='small'>{link(x['url'], '規約')}</td></tr>" for x in lic)
        S.append(f"""<h2 id="rights">4. 商用で使えるデータ源と引用ルール</h2>
<div class="scroll"><table><tr><th>データ源</th><th>区分</th><th>出典表示</th><th>有料PDFへの掲載</th><th>注意</th><th>確認先</th></tr>{lrows}</table></div>
<p class="small muted">確認日 {TODAY}。規約は変わるため、販売開始前に再確認します。図書館資料は「引用」（主従関係・明瞭区別・出所明示）の範囲で要約し、画像やPDFの転載はしません。</p>""")

    # ---------- products
    def pdf_card(name, title, sub):
        path = pdf(name)
        if not os.path.exists(path):
            return ''
        return f'<a href="pdf/{esc(name)}"><b>{esc(title)}</b><span>{esc(sub)} · {pdf_pages(path)}ページ · {mb(path)}</span></a>'
    basic_cards = ''.join(pdf_card(f'basic-{d["id"]}.pdf', d['en'], 'Basic') for d in districts)
    doss_cards = ''.join(pdf_card(f'dossier-{d["id"]}.pdf', d['en'], f"Area Dossier · 約{round(sum(len(re.sub('<[^>]+>', '', p['text']).split()) for s in (dossiers[d['id']] or {}).get('sections', []) for p in s['paragraphs']), -2)}語 · 出典{len((dossiers[d['id']] or {}).get('sources', []))}件") for d in districts if dossiers.get(d['id']))
    deep_card = pdf_card('deep-research-sample-suo-oshima.pdf', 'Deep Research sample: Kuka, Suo-Oshima', '架空の依頼・実在の資料')
    thumbs = [('basic-asakusa-then-now.jpg', 'basic-tokyo-asakusa.pdf', 'Basic：浅草・両国の1936–42年と2019年'),
              ('basic-asakusa-meiji.jpg', 'basic-tokyo-asakusa.pdf', 'Basic：人工地形と明治期の低湿地'),
              ('basic-hiroshima-landform.jpg', 'basic-hiroshima-peace.pdf', 'Basic：広島・旧中島地区の地形分類'),
              ('basic-kobe-memorials.jpg', 'basic-kobe-meriken.pdf', 'Basic：神戸の災害伝承碑（英訳）'),
              ('dossier-yokosuka-cover.jpg', 'dossier-yokosuka.pdf', 'Area Dossier：横須賀'),
              ('dossier-suo-oshima-report.jpg', 'dossier-suo-oshima.pdf', 'Area Dossier：周防大島の本文'),
              ('deep-sample-cover.jpg', 'deep-research-sample-suo-oshima.pdf', 'Deep Research見本：久賀')]
    gallery = ''.join(f'<a href="pdf/{p}"><img src="img/{i}" alt="{esc(c)}" loading="lazy" width="620" height="877"><span>{esc(c)}</span></a>'
                      for i, p, c in thumbs if os.path.exists(os.path.join(OUT, 'img', i)) and os.path.exists(pdf(p)))
    S.append(f"""<h2 id="products">5. 試作品</h2>
<div class="gallery">{gallery}</div>
<h3>Basic（英語PDF・全自動）</h3>
<p>地区の中心座標を与えるだけで、地理院タイルから①最古の空中写真と最新の年度別オルソ画像の比較、②その間の年代の写真、③地形分類（自然地形：旧河道など／人工地形：盛土・埋立・干拓）、④明治期の低湿地（田・湿地・水面）、⑤半径3km（なければ8km・30km）の自然災害伝承碑を英訳つきで並べ、出典と方法を書き添えたPDFを作ります。1地区あたり数分、人手ゼロ。地形の説明文と伝承碑の英訳は国土地理院の情報を翻訳・要約したもので、その旨を明記しています。</p>
<div class="pdfs">{basic_cards or '<p class="muted">生成中</p>'}</div>
<h3>Area Dossier（Basic＋英語の歴史レポート）</h3>
<p>NDLのネット公開図書（コマ番号を明記）と自治体などの公式資料だけを根拠に、地区の成り立ちから現在までを英語で書き、年表・歩き方メモ・出典一覧・さらに調べる先（個人送信の市史など）を付けました。本文には段落ごとに出典番号があります。試作版のため、販売前に第三者の事実確認が必要です。</p>
<div class="pdfs">{doss_cards or '<p class="muted">執筆中</p>'}</div>
<h3>Deep Research（見本）</h3>
<p>「曾祖父がハワイへ渡る前にいた周防大島の久賀村」を調べる、という架空の依頼に、実在の資料で答えた見本です。遠隔で確認できたこと、現地や本人の請求（戸籍など）が必要なこと、料金帯ごとの範囲を分けて示しています。</p>
<div class="pdfs">{deep_card or '<p class="muted">作成中</p>'}</div>""")

    # ---------- economics and next steps
    S.append(f"""<h2 id="next">6. 見立てと次の一手</h2>
<div class="scroll"><table><tr><th>商品</th><th>主な買い手</th><th>作る手間</th><th>リスク</th></tr>
<tr><td>Basic</td><td>米英豪加の個人旅行者、日本の不動産を検討する外国人（ニセコなど）</td><td>自動（1地区数分）。新地区の追加は座標だけ</td><td>地理院の空中写真を有料PDFに載せる条件の最終確認</td></tr>
<tr><td>Area Dossier<br>$29–39</td><td>歴史志向の欧米豪、日系人の家族旅行、基地OB</td><td>1地区あたり調査・執筆＋人の事実確認（目安2〜4時間）。一度作れば再利用</td><td>誤りの混入。販売前の校閲が必須</td></tr>
<tr><td>Deep Research<br>$190–390</td><td>祖先の村を探す日系人、基地で暮らした家族</td><td>遠隔調査4〜8時間、現地1日。数量限定</td><td>個人情報（戸籍は本人・直系のみ請求可）。約束できる成果の線引き</td></tr></table></div>
<ol>
<li><b>Cloudflareの実アクセスで再採点</b>（上記トークン）。サイト内で実際に開かれている場所ページと国の組み合わせを、関心度の代わりに使う。</li>
<li><b>権利の最終確認</b>：地理院の空中写真・地形分類を有料PDFに使う条件（出典表示で足りるか）を国土地理院に照会する。販売開始前に規約を再確認。</li>
<li><b>パイロット販売</b>：Area Dossierを5地区（周防大島・横須賀・浅草・広島・ニセコなど）に絞り、第三者の事実確認を経てから販売ページを作る。</li>
<li><b>沖縄の空白を埋める</b>：1945–1972年の沖縄は米国国立公文書館（パブリックドメイン）の空中写真・地図で補う。</li>
<li><b>東アジア向けは言語版で</b>：対馬（韓国）、札幌・函館・沖縄（台湾・香港）は、英語ではなく韓国語・繁体字版で試す。</li>
</ol>""")
    return {'summary_html': '', 'sections': S}
