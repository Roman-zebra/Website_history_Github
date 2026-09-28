"""Area Dossier assembler (page 07 experiment).

    python3 dossier.py [--lang ja] <district-id> [...]      # or: all  (districts that have a dossier JSON)

Reads the history report written for a district (research/lab-07/dossier/<id>.json, English, or with
--lang ja research/lab-07/dossier-ja/<id>.json, Japanese; see DOSSIER-SCHEMA in README) and the Basic
brief built by basic.py for the same district, and renders lab/07/pdf/dossier-<id>.pdf (or
dossier-ja-<id>.pdf): dossier cover, the history report with numbered citations, a timeline, walking
notes, the Basic pages, and the full source list. --lang ja builds the Basic brief's images and
sections into a separate <BUILD>/<id>-ja/ folder, so the English build is never touched."""
import html, json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
import basic, walkmap

HERE = basic.HERE
DOSSIER_DIR = os.path.join(HERE, 'dossier')
DOSSIER_DIR_JA = os.path.join(HERE, 'dossier-ja')
ACCESS_EN = {'internet': 'open online (NDL Digital Collections, no login)', 'transmission': 'NDL individual digital transmission (registered users)',
             'inlibrary': 'NDL premises only', 'paper': 'print only', None: ''}
ACCESS_JA = {'internet': 'オンライン公開（国立国会図書館デジタルコレクション、ログイン不要）', 'transmission': '国立国会図書館個人向けデジタル化資料送信サービス（登録利用者向け）',
             'inlibrary': '国立国会図書館館内限定', 'paper': '紙媒体のみ', None: ''}

EXTRA_CSS = r"""
.report p{margin:0 0 3mm;text-align:left;hyphens:auto}
.report h2{margin-top:7mm}
.report h2:first-of-type{margin-top:0}
sup.c{font:600 6.4pt Sans,sans-serif;color:#a33a2b;margin-left:.4mm}
.stand{font-size:12.5pt;line-height:1.45;color:#39404f;margin:0 0 6mm}
.tl{width:100%;border-collapse:collapse;font:8.6pt/1.38 Sans,JP,sans-serif;margin:2mm 0 4mm}
.tl td{border-bottom:1px solid #e3dfd6;padding:1.6mm 2mm;vertical-align:top}
.tl td.w{width:24mm;font-weight:700;color:#a33a2b;white-space:nowrap}
.walk{counter-reset:w;list-style:none;padding:0;margin:0}
.walk li{position:relative;padding:0 0 3mm 9mm;font:8.9pt/1.42 Sans,JP,sans-serif}
.walk li:before{counter-increment:w;content:counter(w);position:absolute;left:0;top:0;width:6mm;height:6mm;border-radius:50%;background:#1d2230;color:#fff;font:700 7.5pt/6mm Sans,sans-serif;text-align:center}
.srcs{font:7.9pt/1.38 Sans,JP,sans-serif;padding-left:6mm}
.srcs li{margin-bottom:1.8mm;break-inside:avoid}
.toc{font:9.5pt/1.6 Sans,JP,sans-serif;padding-left:5mm}
img.wm{width:100%;height:auto;max-height:175mm;object-fit:contain;display:block;margin:0 auto}
.wmlist{columns:2;column-gap:8mm;margin-top:4mm}.wmlist li{break-inside:avoid;padding-bottom:2mm}
.maplink{font:600 7.5pt Sans,sans-serif;color:#a33a2b;text-decoration:none;white-space:nowrap}
.draft{display:inline-block;font:700 7.5pt Sans,sans-serif;letter-spacing:.12em;color:#a33a2b;border:1.2px solid #a33a2b;padding:.8mm 2mm;margin-bottom:4mm}
h1,h2,h3{break-after:avoid}
.report p,.srcs li{orphans:3;widows:3}
"""

# Japanese-mode overrides: Noto Sans JP for body text (no Japanese serif face is available),
# comfortable Japanese line height, no hyphenation. Appended after CSS+EXTRA_CSS so it wins the
# cascade on these properties only; never applied in English mode (lang='en'), which stays on
# CSS+EXTRA_CSS exactly as before.
JA_CSS = r"""
html{font-family:JP,sans-serif;line-height:1.75}
.report p{hyphens:none}
.stand{line-height:1.75}
.walk li{font-size:8.5pt;line-height:1.55;padding-bottom:2.2mm}
.tl td{line-height:1.45}
"""

# Fixed English/Japanese strings for dossier.py's own chrome (cover, part headers, back matter).
# TXT['en'] is the literal text dossier.py used before --lang existed, so lang='en' (the default)
# renders exactly as before.
TXT = {
    'en': {
        'ndl_frame': '; NDL frame{s} {nums}', 'checked': ', checked {d}', 'used_for': '. <span class="muted">Used for: {u}</span>',
        'draft_badge': 'EXPERIMENTAL EDITION · {d}',
        'in_this_dossier': 'In this dossier',
        'toc_history': 'A history of the district ({n} chapters, about {w} words)',
        'toc_timeline': 'Timeline', 'toc_walk': 'Walking notes', 'toc_thennow': 'Then and now: aerial photographs',
        'toc_ground': 'How the ground was made', 'toc_disasters': 'Disasters remembered',
        'toc_sources': 'Sources ({n}) and further reading',
        'cover_box': ('Written in English from Japanese library sources — chiefly books digitised by the National '
                       'Diet Library — and official records. Superscript numbers point to the numbered sources at '
                       'the end, with page frames for the digitised books.'),
        'part_history': 'Part 1 · History', 'part_timeline': 'Part 1 · Timeline', 'part_walk': 'Part 1 · Walking notes',
        'timeline_h2': 'Timeline', 'walk_h2': 'Walking notes',
        'walk_note': "Places to stand and look, in walking order. Straight-line distances only; check today's access and opening before you go.",
        'walkmap_h2': 'Walk map', 'walkmap_alt': 'Walk map',
        'walkmap_fig': ('The walking stops, numbered as in the notes, on the latest GSI aerial photograph '
                         '({w:.1f} × {h:.1f} km, north up). Lines join the stops in order and are not a route; '
                         'follow streets on the ground. '),
        'walkmap_missing': 'Stops not shown: {list}. ',
        'walkmap_apps': 'Each stop in the notes links to a map app.',
        'sources_kicker': 'Sources', 'sources_h2': 'Sources', 'further_h3': 'Further reading',
        'leads_h3': 'Where a Deep Research request would go next', 'caveats_h3': 'Caveats',
        'back_credit': ("Digitised books are cited, not reproduced: the page frames let you open the same page in "
                         "the NDL Digital Collections. Aerial photographs, landform and memorial data: GSI, "
                         "processed by Japan Time Atlas. Positions of the walking stops: © OpenStreetMap "
                         "contributors (ODbL), found with Nominatim. {checked}"),
        'checked_yes': 'This experimental edition was checked against its cited sources on {d} but has not had independent fact-checking.',
        'checked_no': 'This experimental edition is a draft for testing the product and has not had independent fact-checking.',
        'footer': 'Japan Time Atlas · Area Dossier · {place} · experimental edition {d}',
        'title_tag': '{place} — Area Dossier (Japan Time Atlas)',
    },
    'ja': {
        'ndl_frame': '；NDLコマ{nums}', 'checked': '、確認日 {d}', 'used_for': '。<span class="muted">利用箇所：{u}</span>',
        'draft_badge': '実験版 · {d}',
        'in_this_dossier': '収録内容',
        'toc_history': '地区の歴史（全{n}章、本文約{w}字）',
        'toc_timeline': '年表', 'toc_walk': '歩き方メモ', 'toc_thennow': '空中写真で見るいまとむかし',
        'toc_ground': '土地の成り立ち', 'toc_disasters': '災害の記憶',
        'toc_sources': '出典（{n}）とさらに読む',
        'cover_box': ('国立国会図書館デジタルコレクションを中心とする日本語の図書館資料と公的記録をもとに執筆。'
                       '肩付き数字は巻末の出典番号を示し、デジタル化資料にはコマ番号を付した。'),
        'part_history': '第1部・歴史', 'part_timeline': '第1部・年表', 'part_walk': '第1部・歩き方メモ',
        'timeline_h2': '年表', 'walk_h2': '歩き方メモ',
        'walk_note': '歩く順に、立ち止まって眺めたい場所を並べた。距離はすべて直線距離。訪問前に最新のアクセス方法と開館状況を確認すること。',
        'walkmap_h2': '散策マップ', 'walkmap_alt': '散策マップ',
        'walkmap_fig': ('歩き方メモと同じ番号を付けた立ち寄り先を、最新の国土地理院空中写真（{w:.1f}×{h:.1f} km、'
                         '上が北）の上に示した。線は立ち寄り先を順番につないだだけで、実際の経路ではない。道順は'
                         '現地の道路に従うこと。'),
        'walkmap_missing': '地図に示していない立ち寄り先：{list}。',
        'walkmap_apps': '各立ち寄り先の番号から地図アプリを開ける。',
        'sources_kicker': '出典', 'sources_h2': '出典', 'further_h3': 'さらに読む',
        'leads_h3': 'Deep Researchで次に調べる先', 'caveats_h3': '注意',
        'back_credit': ('デジタル化資料は引用のみで、転載はしていない。コマ番号から国立国会図書館デジタルコレクション'
                         'の同じページを開ける。空中写真・地形・伝承碑データ：国土地理院、Japan Time Atlasが加工。'
                         '立ち寄り先の位置：© OpenStreetMap contributors（ODbL）、Nominatimで検索。{checked}'),
        'checked_yes': 'この実験版は{d}に出典と照合したが、第三者による事実確認は受けていない。',
        'checked_no': 'この実験版は製品を試すための下書きであり、第三者による事実確認は受けていない。',
        'footer': 'Japan Time Atlas · Area Dossier · {place} · 実験版 {d}',
        'title_tag': '{place} — Area Dossier（Japan Time Atlas）',
    },
}


def esc(s):
    return html.escape(str(s if s is not None else ''))


def rich(text):
    """Escape, but keep <i>…</i> for titles."""
    t = esc(text)
    return re.sub(r'&lt;(/?)i&gt;', r'<\1i>', t)


def cites(ids, num):
    ns = sorted({num[i] for i in ids if i in num})
    return ''.join(f'<sup class="c">{n}</sup>' for n in ns) if ns else ''


def source_line(s, lang='en'):
    T = TXT[lang]
    access_map = ACCESS_EN if lang == 'en' else ACCESS_JA
    bits = []
    if s.get('author'):
        bits.append(esc(s['author']))
    t = f'<i class="jp">{esc(s["title"])}</i>' if s.get('title') else ''
    if s.get('titleEn'):
        t += f' [{esc(s["titleEn"])}]'
    bits.append(t)
    if s.get('publisher'):
        bits.append(esc(s['publisher']))
    if s.get('year'):
        bits.append(esc(s['year']))
    line = ', '.join(b for b in bits if b)
    if s.get('frames'):
        fr = s['frames']
        line += T['ndl_frame'].format(s='s' if len(fr) > 1 else '', nums=esc(', '.join(str(x) for x in fr)))
    if s.get('url'):
        line += f'. {esc(s["url"])}'
    if s.get('access'):
        line += f' ({esc(access_map.get(s["access"], s["access"]))})'
    if s.get('checked'):
        line += T['checked'].format(d=esc(s['checked']))
    if s.get('used'):
        line += T['used_for'].format(u=esc(s['used']))
    return line


def build(did, lang='en'):
    T = TXT[lang]
    districts = basic.load_districts()
    c = districts[did]
    dossier_dir = DOSSIER_DIR_JA if lang == 'ja' else DOSSIER_DIR
    rep = json.load(open(os.path.join(dossier_dir, did + '.json'), encoding='utf-8'))
    if lang == 'ja':
        # the Japanese JSON follows the English writer's convention of keeping walk[].name in
        # English/romanized form with the Japanese name in .ja; it is not expected to carry its own
        # .at coordinates, so copy them from the English dossier's walk stops by position (same
        # order, same count) rather than re-geocoding. This only changes the in-memory dict used to
        # render — the Japanese dossier JSON on disk is never written to.
        en_path = os.path.join(DOSSIER_DIR, did + '.json')
        if os.path.exists(en_path):
            en_walk = json.load(open(en_path, encoding='utf-8')).get('walk', [])
            for i, w in enumerate(rep.get('walk', [])):
                if not w.get('at') and i < len(en_walk) and en_walk[i].get('at'):
                    w['at'] = en_walk[i]['at']
    out_dir = os.path.join(basic.BUILD, did + ('-ja' if lang == 'ja' else ''))
    sec_path = os.path.join(out_dir, 'sections.json')
    if not os.path.exists(sec_path):
        mon_path = os.path.join(HERE, 'monuments-en.json')
        mon_en = json.load(open(mon_path, encoding='utf-8')) if os.path.exists(mon_path) else {}
        basic.build(c, mon_en, lang=lang, out_dir=out_dir)
    sections = json.load(open(sec_path, encoding='utf-8'))
    num = {s['id']: i for i, s in enumerate(rep['sources'], 1)}
    units = 0  # word count in English, character count in Japanese (Japanese prose has no spaces)
    body = []
    for sec in rep['sections']:
        body.append(f'<h2>{rich(sec["heading"])}</h2>')
        for p in sec['paragraphs']:
            plain = re.sub('<[^>]+>', '', p['text'])
            units += len(plain.split()) if lang == 'en' else len(plain)
            body.append(f'<p>{rich(p["text"])}{cites(p.get("cite", []), num)}</p>')
    tl = ''.join(f'<tr><td class="w">{esc(r["when"])}</td><td>{rich(r["what"])}{cites(r.get("cite", []), num)}</td></tr>' for r in rep.get('timeline', []))
    def walk_name(w):
        """(primary display name, secondary gloss or None). In ja mode the Japanese .ja name (GSI/
        the writer's own Japanese) leads and the English/romanized .name becomes the gloss, mirroring
        English mode exactly (never rewriting either string, just swapping which one is bold)."""
        if lang == 'ja' and w.get('ja'):
            return w['ja'], w.get('name')
        return w['name'], (w.get('ja') if lang == 'en' else None)
    def walk_item(w):
        primary, secondary = walk_name(w)
        gloss_cls = 'jp muted' if lang == 'en' else 'muted'
        gloss = f' <span class="{gloss_cls}">{esc(secondary)}</span>' if secondary else ''
        pin = f' <a class="maplink" href="{walkmap.maps_url(w["at"])}">{basic.TXT[lang]["map_link"]}&#8599;</a>' if w.get('at') else ''
        return f'<li><b>{esc(primary)}</b>{gloss}. {rich(w["what"])}{cites(w.get("cite", []), num)}{pin}</li>'
    walk = ''.join(walk_item(w) for w in rep.get('walk', []))
    stops = rep.get('walk', [])
    placed = [w for w in stops if w.get('at')]
    wm = walkmap.draw(stops, os.path.join(out_dir, 'walkmap.jpg'), lang=lang) if stops and len(placed) >= 3 and len(placed) >= 0.6 * len(stops) else None
    map_page = (f'<section class="page"><p class="kicker">{T["part_walk"]}</p><h2>{T["walkmap_h2"]}</h2>'
                f'<figure><img class="wm" src="{wm[0]}" alt="{T["walkmap_alt"]}"><figcaption>{T["walkmap_fig"].format(w=wm[1], h=wm[2])}'
                + (T['walkmap_missing'].format(list=', '.join(str(i) for i, w in enumerate(stops, 1) if not w.get('at'))) if len(placed) < len(stops) else '')
                + T['walkmap_apps'] + '</figcaption></figure>'
                + '<ol class="walk wmlist">' + ''.join(f'<li><b>{esc(walk_name(w)[0])}</b>' + (f' <a class="maplink" href="{walkmap.maps_url(w["at"])}">{basic.TXT[lang]["map_link"]}&#8599;</a>' if w.get('at') else '') + '</li>' for w in stops) + '</ol></section>') if wm else ''
    srcs = ''.join(f'<li>{source_line(s, lang)}</li>' for s in rep['sources'])
    access_map = ACCESS_EN if lang == 'en' else ACCESS_JA
    further = ''.join(f'<li><i class="jp">{esc(f["title"])}</i>{" — " + esc(f["why"]) if f.get("why") else ""} {esc(f.get("url", ""))} ({esc(access_map.get(f.get("access"), f.get("access", "")))})</li>' for f in rep.get('furtherReading', []))
    leads = ''.join(f'<li><b>{esc(l["what"])}</b> — {esc(l["where"])}{". " + esc(l["how"]) if l.get("how") else ""}</li>' for l in rep.get('deepResearchLeads', []))
    caveats = ''.join(f'<li>{rich(x)}</li>' for x in rep.get('caveats', []))
    word_unit = round(units, -2)
    cover = f"""<section class="page"><p class="kicker">Japan Time Atlas · Area Dossier</p><span class="draft">{T['draft_badge'].format(d=basic.TODAY)}</span>
<h1>{rich(rep['title'])}</h1><p class="stand">{rich(rep['standfirst'])}</p>
<div class="cover-grid"><div><img src="locator.png" alt="Location in Japan"><p class="small muted" style="margin-top:2mm"><span class="jp">{esc(c['ja'] if lang == 'en' else c['en'])}</span></p></div>
<div><h3 style="margin-top:0">{T['in_this_dossier']}</h3><ol class="toc"><li>{T['toc_history'].format(n=len(rep['sections']), w=word_unit)}</li><li>{T['toc_timeline']}</li>{'<li>' + T['toc_walk'] + '</li>' if walk else ''}<li>{T['toc_thennow']}</li><li>{T['toc_ground']}</li><li>{T['toc_disasters']}</li><li>{T['toc_sources'].format(n=len(rep['sources']))}</li></ol>
<div class="box"><p>{T['cover_box']}</p></div></div></div></section>"""
    report = f'<section class="page report"><p class="kicker">{T["part_history"]}</p>{"".join(body)}</section>'
    tl_page = f'<section class="page"><p class="kicker">{T["part_timeline"]}</p><h2>{T["timeline_h2"]}</h2><table class="tl">{tl}</table>' + (f'<h2>{T["walk_h2"]}</h2><p class="small">{T["walk_note"]}</p><ol class="walk">{walk}</ol>' if walk else '') + '</section>'
    checked = T['checked_yes'].format(d=esc(rep['checked'])) if rep.get('checked') else T['checked_no']
    back = f"""<section class="page"><p class="kicker">{T['sources_kicker']}</p><h2>{T['sources_h2']}</h2><ol class="srcs">{srcs}</ol>
{(f'<h3>{T["further_h3"]}</h3><ul class="srcs">' + further + '</ul>') if further else ''}
{(f'<h3>{T["leads_h3"]}</h3><ul class="srcs">' + leads + '</ul>') if leads else ''}
{(f'<h3>{T["caveats_h3"]}</h3><ul class="srcs">' + caveats + '</ul>') if caveats else ''}
<p class="small muted">{T['back_credit'].format(checked=checked)}</p></section>"""
    css = basic.CSS.replace('FONTDIR', 'file://' + basic.FONTS) + EXTRA_CSS + (JA_CSS if lang == 'ja' else '')
    place = c['en'] if lang == 'en' else c['ja']
    page = (f'<!doctype html><html lang="{lang}" data-footer="{T["footer"].format(place=esc(place), d=basic.TODAY)}"><head><meta charset="utf-8">'
            f'<title>{T["title_tag"].format(place=esc(place))}</title><style>{css}</style></head><body>'
            + cover + report + tl_page + map_page + sections['thennow'] + sections.get('timeline', '') + sections['ground'] + sections['manmade'] + sections['disasters'] + back + '</body></html>')
    hp = os.path.join(out_dir, 'dossier.html')
    with open(hp, 'w', encoding='utf-8') as f:
        f.write(page)
    return hp, units


def main():
    argv = sys.argv[1:]
    lang = 'en'
    if argv[:1] == ['--lang']:
        lang = argv[1]
        argv = argv[2:]
        if lang not in TXT:
            raise SystemExit(f'--lang {lang}: unsupported (have: {", ".join(TXT)})')
    ids = argv
    dossier_dir = DOSSIER_DIR_JA if lang == 'ja' else DOSSIER_DIR
    if ids == ['all']:
        ids = sorted(f[:-5] for f in os.listdir(dossier_dir) if f.endswith('.json'))
    pairs = []
    prefix = 'dossier-ja-' if lang == 'ja' else 'dossier-'
    for did in ids:
        hp, units = build(did, lang=lang)
        pairs += [hp, os.path.join(basic.PDF_DIR, f'{prefix}{did}.pdf')]
        print('dossier', did, units, ('chars' if lang == 'ja' else 'words'), flush=True)
    env = dict(os.environ, NODE_PATH=basic.NODE_PATH)
    subprocess.run(['node', os.path.join(os.path.dirname(__file__), 'render_pdf.cjs')] + pairs, check=True, env=env)


if __name__ == '__main__':
    main()
