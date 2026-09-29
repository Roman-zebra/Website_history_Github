"""「空から見る 今昔さんぽ」: a short Japanese walking booklet (A5) for a general audience.

    python3 booklet.py <district-id> [...]

Reads the booklet text written for the district (research/lab-07/booklet/<id>.json, Japanese), the walking stops
of its English Area Dossier (positions and the photographs checked for each stop), and the Japanese Basic build
(district then/now photographs and landform map), and renders lab/07/pdf/booklet-<id>.pdf: a cover, the route,
one page per stop — the checked photograph with its credit, the stop seen from the air in the oldest series and
today, and a short story — the landform page and the credits. Every fact in the text comes from the dossier's
checked sources; no AI-generated picture is used unless research/lab-07/ai-images/<id>/<n>.(png|jpg) exists,
and then it is labelled as one."""
import html, json, os, shutil, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
import basic, spotphotos, walkmap

HERE = basic.HERE
AI_DIR = os.path.join(HERE, 'ai-images')

CSS = r"""
@font-face{font-family:JP;src:url(FONTDIR/NotoSansJP-Regular.ttf)}
@font-face{font-family:JP;font-weight:700;src:url(FONTDIR/NotoSansJP-Bold.ttf)}
@font-face{font-family:Inter;src:url(FONTDIR/Inter-Regular.ttf)}
@font-face{font-family:Inter;font-weight:600;src:url(FONTDIR/Inter-SemiBold.ttf)}
@font-face{font-family:Inter;font-weight:700;src:url(FONTDIR/Inter-Bold.ttf)}
@page{size:A5}
html{font:9.1pt/1.68 JP,sans-serif;color:#1d2230;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0}
.page{break-after:page}
.page:last-child{break-after:auto}
h1{font:700 19pt/1.3 JP,sans-serif;margin:0 0 2mm;letter-spacing:.02em}
h2{font:700 13.5pt/1.4 JP,sans-serif;margin:0 0 2.5mm}
h3{font:700 10pt/1.5 JP,sans-serif;margin:3mm 0 1.5mm}
p{margin:0 0 2mm}
.kicker{font:700 7.2pt Inter,JP,sans-serif;letter-spacing:.16em;color:#a33a2b;margin:0 0 1.2mm;text-transform:uppercase}
.sub{font-size:10.5pt;color:#39404f;margin:0 0 1mm}
.catch{font-size:9pt;color:#5a6172;margin:0 0 4mm}
.cover figure{margin:0 0 2.5mm;position:relative}
.cover img{width:100%;height:66mm;object-fit:cover;display:block;border-radius:1.5mm}
.cover figcaption{position:absolute;left:2mm;top:2mm;background:rgba(29,34,48,.82);color:#fff;font:700 8pt Inter,JP,sans-serif;padding:.6mm 2mm;border-radius:1mm}
.small{font-size:7.4pt;line-height:1.55;color:#5a6172}
.map img{width:100%;display:block;border-radius:1.5mm}
.stops{list-style:none;padding:0;margin:2.5mm 0 0;columns:2;column-gap:5mm}
.stops li{font-size:8.4pt;margin-bottom:1.2mm;break-inside:avoid}
.num{display:inline-block;width:5.2mm;height:5.2mm;border-radius:50%;background:#a33a2b;color:#fff;font:700 7.5pt/5.2mm Inter,sans-serif;text-align:center;margin-right:1.5mm}
h2 .num{width:7mm;height:7mm;font-size:10pt;line-height:7mm;vertical-align:1mm}
.photo{margin:0 0 2mm}
.photo img{width:100%;height:52mm;object-fit:contain;background:#f1eee8;display:block;border-radius:1.5mm}
.credit{font:5.9pt/1.35 Inter,JP,sans-serif;color:#6b7282;margin-top:.7mm;overflow-wrap:anywhere}
.credit a{color:inherit;text-decoration:none}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:2.5mm;margin:0 0 2mm}
.pair figure{margin:0}
.pair img{width:100%;display:block;border-radius:1.2mm}
.pair figcaption{font:700 7pt Inter,JP,sans-serif;color:#1d2230;margin-top:.7mm}
.big.pair{grid-template-columns:1fr}
.look{background:#f4efe6;border-left:2.5px solid #a33a2b;padding:1.6mm 2.6mm;font-size:8.2pt;line-height:1.6;margin-top:2mm}
.ai{font:700 6.5pt Inter,JP,sans-serif;color:#fff;background:#6b4fa3;padding:.4mm 1.6mm;border-radius:1mm}
.land img{width:100%;display:block;border-radius:1.5mm;margin-bottom:2mm}
.qr{display:flex;align-items:center;gap:2.5mm;margin-top:2mm;font-size:7.4pt;color:#5a6172}
.qr img{width:13mm;height:13mm;display:block}
.qr a{color:#a33a2b;text-decoration:none;font-weight:700}
.src{font-size:7.3pt;line-height:1.55;padding-left:4.5mm}
.src li{margin-bottom:1mm;overflow-wrap:anywhere}
"""


def esc(s):
    return html.escape(str(s or ''), quote=True)


def qr(url, path):
    """QR code that opens the stop in a map app (needs the qrcode package; without it the link stays text)."""
    try:
        import qrcode
    except ImportError:
        return None
    img = qrcode.make(url, box_size=6, border=1)
    img.save(path)
    return os.path.basename(path)


def build(did):
    c = basic.load_districts()[did]
    b = json.load(open(os.path.join(HERE, 'booklet', did + '.json'), encoding='utf-8'))
    d = json.load(open(os.path.join(HERE, 'dossier', did + '.json'), encoding='utf-8'))
    stops = d['walk']
    assert len(stops) == len(b['stops']), 'booklet text and dossier walk must list the same stops'
    ja_dir = os.path.join(basic.BUILD, did + '-ja')           # the Japanese Basic build, as for the ja dossier
    if not os.path.exists(os.path.join(ja_dir, 'sections.json')):
        mon = os.path.join(HERE, 'monuments-en.json')
        basic.build(c, json.load(open(mon, encoding='utf-8')) if os.path.exists(mon) else {}, lang='ja', out_dir=ja_dir)
    meta = json.load(open(os.path.join(ja_dir, 'meta.json'), encoding='utf-8'))
    out = os.path.join(basic.BUILD, 'booklet-' + did)
    os.makedirs(out, exist_ok=True)
    for f in ('then.jpg', 'now.jpg', 'natural.jpg'):
        if os.path.exists(os.path.join(ja_dir, f)):
            shutil.copyfile(os.path.join(ja_dir, f), os.path.join(out, f))
    then_layer = meta['then']
    then_label = basic.SERIES_JA.get(then_layer, then_layer)
    wm = walkmap.draw(stops, os.path.join(out, 'walkmap.jpg'), lang='ja')

    cover = (f'<section class="page cover"><p class="kicker">Japan Time Atlas</p><h1>{esc(b["title"])}</h1>'
             f'<p class="sub">{esc(b["subtitle"])}</p><p class="catch">{esc(b["catch"])}</p>'
             f'<figure><img src="then.jpg" alt=""><figcaption>{esc(then_label)}</figcaption></figure>'
             f'<figure><img src="now.jpg" alt=""><figcaption>現在</figcaption></figure>'
             f'<p class="small">空中写真：国土地理院。同じ範囲を上が北で写している。</p></section>')
    route = (f'<section class="page"><p class="kicker">はじめに</p><h2>足もとの90年を、空から</h2><p>{esc(b["intro"])}</p>'
             + (f'<div class="map"><img src="{wm[0]}" alt="散策マップ"></div>' if wm else '')
             + '<ol class="stops">' + ''.join(f'<li><span class="num">{i}</span>{esc(s["title"])}</li>' for i, s in enumerate(b['stops'], 1))
             + f'</ol><p class="small" style="margin-top:2mm">{esc(b["howto"])}</p></section>')

    pages = []
    for i, (w, s) in enumerate(zip(stops, b['stops']), 1):
        parts = [f'<section class="page"><p class="kicker">Stop {i}</p><h2><span class="num">{i}</span>{esc(s["title"])}</h2>']
        ph = w.get('photo')
        ai = next((os.path.join(AI_DIR, did, f'{i}{k}.{x}') for k in ('-past', '') for x in ('png', 'jpg', 'jpeg')
                   if os.path.exists(os.path.join(AI_DIR, did, f'{i}{k}.{x}'))), None)   # a reconstruction first, then today's place
        if ph:
            shutil.copyfile(spotphotos.ensure(did, i, ph), os.path.join(out, f'photo-{i}.jpg'))
            artist = ph.get('artistJa') or ph['artist']
            lic = f'<a href="{esc(ph["licenseUrl"])}">{esc(ph["license"])}</a>' if ph.get('licenseUrl') else esc(ph['license'])
            parts.append(f'<figure class="photo"><img src="photo-{i}.jpg" alt="{esc(s["title"])}"><figcaption class="credit">'
                         f'{esc(ph.get("showsJa") or "")}　写真：{esc(artist)}「{esc(ph["title"])}」{lic}、'
                         f'<a href="{esc(ph["page"])}">Wikimedia Commons</a>より</figcaption></figure>')
        elif ai:
            shutil.copyfile(ai, os.path.join(out, f'ai-{i}' + os.path.splitext(ai)[1]))
            parts.append(f'<figure class="photo"><img src="ai-{i}{os.path.splitext(ai)[1]}" alt="{esc(s["title"])}"><figcaption class="credit">'
                         f'<span class="ai">AI生成</span>　ChatGPT（OpenAI）で作成した'
                         + ('当時の様子の想像図' if '-past.' in ai else 'この場所のイメージ図') + 'です。実際の写真ではありません。</figcaption></figure>')
        at = w.get('at')
        pair = [walkmap.closeup(at, os.path.join(out, f'{k}-{i}.jpg'), 0.4, 0.3, layer=layer) for k, layer in
                (('then', then_layer), ('now', 'seamlessphoto'))] if at else [None, None]
        if all(pair):
            parts.append(f'<div class="pair"><figure><img src="{pair[0]}" alt=""><figcaption>{esc(then_label)}</figcaption></figure>'
                         f'<figure><img src="{pair[1]}" alt=""><figcaption>現在</figcaption></figure></div>')
        parts.append(f'<p>{esc(s["story"])}</p>')
        if s.get('look'):
            parts.append(f'<div class="look"><b>ここを見る</b>　{esc(s["look"])}</div>')
        if at:
            url = walkmap.maps_url(at)
            code = qr(url, os.path.join(out, f'qr-{i}.png'))
            parts.append(f'<div class="qr">' + (f'<img src="{code}" alt="QR">' if code else '')
                         + f'<span>スマートフォンで読み取ると、この場所を地図アプリで開けます。<br><a href="{url}">地図で開く</a></span></div>')
        pages.append(''.join(parts) + '</section>')

    land = b.get('landform')
    land_page = (f'<section class="page land"><p class="kicker">土地の成り立ち</p><h2>{esc(land["title"])}</h2>'
                 + ('<img src="natural.jpg" alt="地形分類">' if os.path.exists(os.path.join(out, 'natural.jpg')) else '')
                 + f'<p>{esc(land["text"])}</p><p class="small">地形分類：国土地理院「地形分類（自然地形）」ベクトルタイルをJapan Time Atlasが加工。</p></section>') if land else ''
    ai_used = any(os.path.exists(os.path.join(AI_DIR, did, f'{i}{k}.{x}')) for i in range(1, len(stops) + 1)
                  for k in ('-past', '') for x in ('png', 'jpg', 'jpeg'))
    credits = ('<section class="page"><p class="kicker">出典とクレジット</p><h2>この本のもとになった資料</h2><ul class="src">'
               + ''.join(f'<li>{esc(x)}</li>' for x in b['sources'])
               + '<li>立ち寄り先の写真：各ページに撮影者・ライセンス・出典を記載。縮小のみで、ほかの加工はしていない。</li>'
               + ('<li>「AI生成」と表示した画像は、AIで生成した想像図であり、実際の写真ではない。</li>' if ai_used else '<li>この版にはAIで生成した画像は含まれていない。</li>')
               + f'</ul><p class="small">国立国会図書館デジタルコレクションの資料は引用・要約のみで、転載はしていない。本文の事実はJapan Time Atlas Area Dossierで出典と照合したものに基づく。試作版 {basic.TODAY}。</p></section>')

    css = CSS.replace('FONTDIR', 'file://' + basic.FONTS)
    page = (f'<!doctype html><html lang="ja" data-footer="Japan Time Atlas · {esc(b["title"])} · 試作版 {basic.TODAY}"><head><meta charset="utf-8">'
            f'<title>{esc(b["title"])}</title><style>{css}</style></head><body>'
            + cover + route + ''.join(pages) + land_page + credits + '</body></html>')
    hp = os.path.join(out, 'booklet.html')
    with open(hp, 'w', encoding='utf-8') as f:
        f.write(page)
    return hp


def main():
    pairs = []
    for did in sys.argv[1:]:
        pairs += [build(did), os.path.join(basic.PDF_DIR, f'booklet-{did}.pdf')]
        print('booklet', did, flush=True)
    env = dict(os.environ, NODE_PATH=basic.NODE_PATH)
    subprocess.run(['node', os.path.join(os.path.dirname(__file__), 'render_pdf.cjs')] + pairs, check=True, env=env)


if __name__ == '__main__':
    main()
