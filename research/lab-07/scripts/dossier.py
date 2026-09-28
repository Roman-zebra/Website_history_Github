"""Area Dossier assembler (page 07 experiment).

    python3 dossier.py <district-id> [...]      # or: all  (districts that have a dossier JSON)

Reads the English history report written for a district (research/lab-07/dossier/<id>.json, see
DOSSIER-SCHEMA in README) and the Basic brief built by basic.py for the same district, and renders
lab/07/pdf/dossier-<id>.pdf: dossier cover, the history report with numbered citations, a
timeline, walking notes, the Basic pages, and the full source list."""
import html, json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
import basic

HERE = basic.HERE
DOSSIER_DIR = os.path.join(HERE, 'dossier')
ACCESS_EN = {'internet': 'open online (NDL Digital Collections, no login)', 'transmission': 'NDL individual digital transmission (registered users)',
             'inlibrary': 'NDL premises only', 'paper': 'print only', None: ''}

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
.draft{display:inline-block;font:700 7.5pt Sans,sans-serif;letter-spacing:.12em;color:#a33a2b;border:1.2px solid #a33a2b;padding:.8mm 2mm;margin-bottom:4mm}
h1,h2,h3{break-after:avoid}
.report p,.srcs li{orphans:3;widows:3}
"""


def esc(s):
    return html.escape(str(s if s is not None else ''))


def rich(text):
    """Escape, but keep <i>…</i> for titles."""
    t = esc(text)
    return re.sub(r'&lt;(/?)i&gt;', r'<\1i>', t)


def cites(ids, num):
    ns = sorted({num[i] for i in ids if i in num})
    return ''.join(f'<sup class="c">{n}</sup>' for n in ns) if ns else ''


def source_line(s):
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
        line += f'; NDL frame{"s" if len(fr) > 1 else ""} {esc(", ".join(str(x) for x in fr))}'
    if s.get('url'):
        line += f'. {esc(s["url"])}'
    if s.get('access'):
        line += f' ({esc(ACCESS_EN.get(s["access"], s["access"]))})'
    if s.get('checked'):
        line += f', checked {esc(s["checked"])}'
    if s.get('used'):
        line += f'. <span class="muted">Used for: {esc(s["used"])}</span>'
    return line


def build(did):
    districts = basic.load_districts()
    c = districts[did]
    rep = json.load(open(os.path.join(DOSSIER_DIR, did + '.json'), encoding='utf-8'))
    out_dir = os.path.join(basic.BUILD, did)
    sec_path = os.path.join(out_dir, 'sections.json')
    if not os.path.exists(sec_path):
        mon_path = os.path.join(HERE, 'monuments-en.json')
        mon_en = json.load(open(mon_path, encoding='utf-8')) if os.path.exists(mon_path) else {}
        basic.build(c, mon_en)
    sections = json.load(open(sec_path, encoding='utf-8'))
    num = {s['id']: i for i, s in enumerate(rep['sources'], 1)}
    words = 0
    body = []
    for sec in rep['sections']:
        body.append(f'<h2>{rich(sec["heading"])}</h2>')
        for p in sec['paragraphs']:
            words += len(re.sub('<[^>]+>', '', p['text']).split())
            body.append(f'<p>{rich(p["text"])}{cites(p.get("cite", []), num)}</p>')
    tl = ''.join(f'<tr><td class="w">{esc(r["when"])}</td><td>{rich(r["what"])}{cites(r.get("cite", []), num)}</td></tr>' for r in rep.get('timeline', []))
    def walk_item(w):
        ja = f' <span class="jp muted">{esc(w["ja"])}</span>' if w.get('ja') else ''
        return f'<li><b>{esc(w["name"])}</b>{ja}. {rich(w["what"])}{cites(w.get("cite", []), num)}</li>'
    walk = ''.join(walk_item(w) for w in rep.get('walk', []))
    srcs = ''.join(f'<li>{source_line(s)}</li>' for s in rep['sources'])
    further = ''.join(f'<li><i class="jp">{esc(f["title"])}</i>{" — " + esc(f["why"]) if f.get("why") else ""} {esc(f.get("url", ""))} ({esc(ACCESS_EN.get(f.get("access"), f.get("access", "")))})</li>' for f in rep.get('furtherReading', []))
    leads = ''.join(f'<li><b>{esc(l["what"])}</b> — {esc(l["where"])}{". " + esc(l["how"]) if l.get("how") else ""}</li>' for l in rep.get('deepResearchLeads', []))
    caveats = ''.join(f'<li>{rich(x)}</li>' for x in rep.get('caveats', []))
    cover = f"""<section class="page"><p class="kicker">Japan Time Atlas · Area Dossier</p><span class="draft">EXPERIMENTAL EDITION · {basic.TODAY}</span>
<h1>{rich(rep['title'])}</h1><p class="stand">{rich(rep['standfirst'])}</p>
<div class="cover-grid"><div><img src="locator.png" alt="Location in Japan"><p class="small muted" style="margin-top:2mm"><span class="jp">{esc(c['ja'])}</span></p></div>
<div><h3 style="margin-top:0">In this dossier</h3><ol class="toc"><li>A history of the district ({len(rep['sections'])} chapters, about {round(words, -2)} words)</li><li>Timeline</li>{'<li>Walking notes</li>' if walk else ''}<li>Then and now: aerial photographs</li><li>How the ground was made</li><li>Disasters remembered</li><li>Sources ({len(rep['sources'])}) and further reading</li></ol>
<div class="box"><p>Written in English from Japanese library sources — chiefly books digitised by the National Diet Library — and official records. Superscript numbers point to the numbered sources at the end, with page frames for the digitised books.</p></div></div></div></section>"""
    report = f'<section class="page report"><p class="kicker">Part 1 · History</p>{"".join(body)}</section>'
    tl_page = f'<section class="page"><p class="kicker">Part 1 · Timeline</p><h2>Timeline</h2><table class="tl">{tl}</table>' + (f'<h2>Walking notes</h2><p class="small">Places to stand and look, in walking order. Straight-line distances only; check today\'s access and opening before you go.</p><ol class="walk">{walk}</ol>' if walk else '') + '</section>'
    back = f"""<section class="page"><p class="kicker">Sources</p><h2>Sources</h2><ol class="srcs">{srcs}</ol>
{('<h3>Further reading</h3><ul class="srcs">' + further + '</ul>') if further else ''}
{('<h3>Where a Deep Research request would go next</h3><ul class="srcs">' + leads + '</ul>') if leads else ''}
{('<h3>Caveats</h3><ul class="srcs">' + caveats + '</ul>') if caveats else ''}
<p class="small muted">Digitised books are cited, not reproduced: the page frames let you open the same page in the NDL Digital Collections. Aerial photographs, landform and memorial data: GSI, processed by Japan Time Atlas. {f'This experimental edition was checked against its cited sources on {esc(rep["checked"])} but has not had independent fact-checking.' if rep.get('checked') else 'This experimental edition is a draft for testing the product and has not had independent fact-checking.'}</p></section>"""
    css = basic.CSS.replace('FONTDIR', 'file://' + basic.FONTS) + EXTRA_CSS
    page = (f'<!doctype html><html lang="en" data-footer="Japan Time Atlas · Area Dossier · {esc(c["en"])} · experimental edition {basic.TODAY}"><head><meta charset="utf-8">'
            f'<title>{esc(c["en"])} — Area Dossier (Japan Time Atlas)</title><style>{css}</style></head><body>'
            + cover + report + tl_page + sections['thennow'] + sections.get('timeline', '') + sections['ground'] + sections['manmade'] + sections['disasters'] + back + '</body></html>')
    hp = os.path.join(out_dir, 'dossier.html')
    with open(hp, 'w', encoding='utf-8') as f:
        f.write(page)
    return hp, words


def main():
    ids = sys.argv[1:]
    if ids == ['all']:
        ids = sorted(f[:-5] for f in os.listdir(DOSSIER_DIR) if f.endswith('.json'))
    pairs = []
    for did in ids:
        hp, words = build(did)
        pairs += [hp, os.path.join(basic.PDF_DIR, f'dossier-{did}.pdf')]
        print('dossier', did, words, 'words', flush=True)
    env = dict(os.environ, NODE_PATH=basic.NODE_PATH)
    subprocess.run(['node', os.path.join(os.path.dirname(__file__), 'render_pdf.cjs')] + pairs, check=True, env=env)


if __name__ == '__main__':
    main()
