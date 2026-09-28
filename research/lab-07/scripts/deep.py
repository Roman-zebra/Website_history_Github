"""Deep Research sample renderer (page 07 experiment).

    python3 deep.py [research/lab-07/deep/sample-suo-oshima-kuka.json]

Renders the sample report written from research/lab-07/deep/<name>.json into
lab/07/pdf/deep-research-sample-suo-oshima.pdf, with a then/now pair of GSI aerial photographs of the
hamlet studied (Kuka, Suo-Oshima)."""
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
import basic, gsi
from dossier import EXTRA_CSS, esc, rich, source_line

HERE = basic.HERE
SRC = os.path.join(HERE, 'deep', 'sample-suo-oshima-kuka.json')
OUT_PDF = os.path.join(basic.PDF_DIR, 'deep-research-sample-suo-oshima.pdf')
KUKA = {'id': 'deep-kuka', 'en': 'Kuka, Suo-Oshima', 'ja': '山口県周防大島町久賀（旧 大島郡久賀村）',
        'center': [33.9377, 132.2670], 'half': 0.9, 'aspect': 1.55}


def images(out_dir):
    bb, wkm, hkm = basic.study_bbox(KUKA)
    cov, imgs, now = basic.pick_series(bb)
    order = [l for l, _ in basic.SERIES if l in imgs]
    labels = dict(basic.SERIES)
    files = {}
    if order:
        then = order[0]
        files['then'] = (basic.save_jpg(basic.annotate(basic.flatten(imgs[then]), labels[then], wkm, 'Aerial photograph'), os.path.join(out_dir, 'kuka-then.jpg'))[0], labels[then], then)
    layer, label, img = now
    files['now'] = (basic.save_jpg(basic.annotate(basic.flatten(img), label if label != 'latest' else 'Latest', wkm, 'Aerial photograph'), os.path.join(out_dir, 'kuka-now.jpg'))[0], label, layer)
    basic.japan_locator(KUKA['center']).save(os.path.join(out_dir, 'locator.png'), optimize=True)
    return files, wkm, hkm


def build(path=SRC):
    rep = json.load(open(path, encoding='utf-8'))
    out_dir = os.path.join(basic.BUILD, 'deep-kuka')
    os.makedirs(out_dir, exist_ok=True)
    files, wkm, hkm = images(out_dir)
    num = {s['id']: i for i, s in enumerate(rep['sources'], 1)}

    def cites(ids):
        ns = sorted({num[i] for i in ids or [] if i in num})
        return ''.join(f'<sup class="c">{n}</sup>' for n in ns)
    summary = ''.join(f'<li>{rich(x)}</li>' for x in rep.get('answerSummary', []))
    body = []
    for sec in rep['sections']:
        body.append(f'<h2>{rich(sec["heading"])}</h2>')
        for p in sec['paragraphs']:
            body.append(f'<p>{rich(p["text"])}{cites(p.get("cite"))}</p>')
    trail = ''.join(f'<tr><td><b>{rich(r["record"])}</b><br><span class="muted">{rich(r.get("holder", ""))}</span></td><td>{rich(r.get("whatItCanShow", ""))}</td>'
                    f'<td>{rich(r.get("access", ""))}</td><td>{rich(r.get("status", ""))}{cites(r.get("cite"))}</td></tr>' for r in rep.get('recordsTrail', []))
    plan = ''.join(f'<tr><td class="w">{i}</td><td>{rich(s["step"])}</td><td>{rich(s.get("where", ""))}</td><td>{rich(s.get("time", ""))}</td></tr>' for i, s in enumerate(rep.get('onSitePlan', []), 1))
    tiers = ''.join(f'<tr><td class="w">{esc(t["price"])}</td><td>{rich(t["includes"])}</td></tr>' for t in rep.get('tiers', []))
    limits = ''.join(f'<li>{rich(x)}</li>' for x in rep.get('limits', []))
    srcs = ''.join(f'<li>{source_line(s)}</li>' for s in rep['sources'])
    figs = ''
    if 'then' in files:
        figs += f'<figure><img src="{files["then"][0]}" alt="Kuka {esc(files["then"][1])}"><figcaption>Kuka, {esc(files["then"][1])} (GSI <i>{files["then"][2]}</i>) — the oldest GSI aerial series that covers the hamlet.</figcaption></figure>'
    figs += f'<figure><img src="{files["now"][0]}" alt="Kuka recent"><figcaption>The same frame, {esc(files["now"][1])} (GSI <i>{files["now"][2]}</i>). {wkm:.1f} × {hkm:.1f} km, north up.</figcaption></figure>'
    css = basic.CSS.replace('FONTDIR', 'file://' + basic.FONTS) + EXTRA_CSS + '.tl td.w{width:18mm}.req{font-size:11.5pt;line-height:1.5;font-style:italic;color:#39404f}'
    html = f"""<!doctype html><html lang="en" data-footer="Japan Time Atlas · Deep Research · sample report (fictional request, real sources) · {basic.TODAY}"><head><meta charset="utf-8">
<title>Deep Research sample — Kuka, Suo-Oshima (Japan Time Atlas)</title><style>{css}</style></head><body>
<section class="page"><p class="kicker">Japan Time Atlas · Deep Research</p><span class="draft">SAMPLE · FICTIONAL REQUEST · REAL SOURCES</span>
<h1>{rich(rep['title'])}</h1><p class="stand">{rich(rep.get('subtitle', ''))}</p>
<div class="box"><p><b>The request</b></p><p class="req">{rich(rep['request'])}</p></div>
<h3>Answer in brief</h3><ul class="srcs" style="font-size:9.2pt">{summary}</ul>
<div class="cover-grid" style="margin-top:4mm"><div><img src="locator.png" alt="Location"></div><div class="small">This sample shows the format and the method of a Deep Research report. The client and the request are invented; every source, archive and record type described is real and was checked on {basic.TODAY}. Nothing in this report identifies a living person.</div></div></section>
<section class="page report"><p class="kicker">Report</p>{''.join(body)}</section>
<section class="page stack"><p class="kicker">The hamlet from the air</p><h2>Kuka then and now</h2>{figs}</section>
<section class="page"><p class="kicker">Records trail</p><h2>Where the records are, and who can open them</h2>
<table class="tl"><tr><th>Record and holder</th><th>What it can show</th><th>Access</th><th>Status</th></tr>{trail}</table>
<h2>On-site plan</h2><table class="tl">{plan}</table>
<h2>What each price includes</h2><table class="tl">{tiers}</table>
{('<h3>Limits</h3><ul class="srcs">' + limits + '</ul>') if limits else ''}</section>
<section class="page"><p class="kicker">Sources</p><h2>Sources</h2><ol class="srcs">{srcs}</ol>
<p class="small muted">Digitised books and archival records are cited, not reproduced. Aerial photographs: GSI, processed by Japan Time Atlas.</p></section>
</body></html>"""
    hp = os.path.join(out_dir, 'deep.html')
    with open(hp, 'w', encoding='utf-8') as f:
        f.write(html)
    env = dict(os.environ, NODE_PATH=basic.NODE_PATH)
    subprocess.run(['node', os.path.join(os.path.dirname(__file__), 'render_pdf.cjs'), hp, OUT_PDF], check=True, env=env)


if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv) > 1 else SRC)
