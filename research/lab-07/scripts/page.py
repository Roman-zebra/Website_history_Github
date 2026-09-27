"""Builds lab/07/index.html, the unpublished research page 07 (Japanese), from the research data:
audience.json, licenses.json, districts.json, readiness.json, ndl/<id>.json, basic-meta.json,
dossier/<id>.json and the PDFs in lab/07/pdf. Run after the other scripts:
    python3 research/lab-07/scripts/page.py"""
import html, json, os, re, datetime

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'lab', '07')
TODAY = datetime.date.today().isoformat()


def load(name, default=None):
    p = os.path.join(HERE, name)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else default


def esc(s):
    return html.escape(str(s if s is not None else ''))


def mb(path):
    return f'{os.path.getsize(path) / 1e6:.1f}MB' if os.path.exists(path) else ''


def link(url, text=None):
    return f'<a href="{esc(url)}" rel="noopener">{esc(text or url)}</a>'


ACCESS_JA = {'internet': 'ネット公開', 'transmission': '個人送信', 'inlibrary': '館内限定', 'paper': '紙のみ'}
SEG_JA = {'roots': '移民のルーツ', 'base': '基地の町', 'occupation': '占領期', 'city': '都市観光', 'settlement': '外国人居留地',
          'disaster': '災害伝承', 'reclaimed': '埋立・運河', 'volcano': '火山', 'property': '不動産・リゾート', 'village': '山村',
          'resort': '避暑地'}
LAYER_JA = {'ort_1928': '1928頃', 'ort_riku10': '1936-42', 'ort_USA10': '1945-50', 'ort_old10': '1961-69', 'gazo1': '1974-78',
            'gazo2': '1979-83', 'gazo3': '1984-86', 'gazo4': '1987-90'}
LF_JA = {'oldchannel': '旧河道', 'formerwater': '旧水部', 'fill': '盛土・埋立', 'polder': '干拓地', 'cut': '切土'}

CSS = r"""
:root{--bg:#f3f1ea;--card:#fbfaf6;--ink:#1f2f2c;--muted:#5f6c68;--line:#d6dbd1;--accent:#1f5d56;--warn:#9a4a1c;--chip:#e6ece6}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#171c1f;--card:#1f262a;--ink:#e7e9e4;--muted:#a8b3ae;--line:#334046;--accent:#8fd0c3;--warn:#f0a36b;--chip:#2a3438}}
:root[data-theme=dark]{--bg:#171c1f;--card:#1f262a;--ink:#e7e9e4;--muted:#a8b3ae;--line:#334046;--accent:#8fd0c3;--warn:#f0a36b;--chip:#2a3438}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.75 -apple-system,"Hiragino Sans","Yu Gothic UI","Noto Sans JP",sans-serif;overflow-wrap:anywhere}
header,main,footer{max-width:64rem;margin:0 auto;padding:0 16px}
header{padding-top:22px}
.tag{display:inline-block;font:700 12px/1 system-ui,sans-serif;letter-spacing:.12em;color:var(--warn);border:1.5px solid var(--warn);padding:5px 8px;border-radius:3px}
h1{font:600 clamp(26px,5vw,40px)/1.25 Georgia,"Yu Mincho","Hiragino Mincho ProN",serif;margin:14px 0 8px;letter-spacing:-.01em}
h2{font:600 clamp(20px,3.4vw,26px)/1.35 Georgia,"Yu Mincho","Hiragino Mincho ProN",serif;margin:38px 0 10px;padding-top:14px;border-top:1px solid var(--line)}
h3{font-size:16px;margin:22px 0 6px}
p{margin:0 0 12px;max-width:72ch}
a{color:var(--accent);text-underline-offset:3px}
.lead{font-size:17px;color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:16px 18px;margin:14px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));gap:12px}
nav.toc{display:flex;flex-wrap:wrap;gap:6px 14px;margin:18px 0 0;font-size:14px}
nav.toc a{display:inline-block;padding:6px 0;min-height:32px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:12px 14px}
.stat b{display:block;font:600 24px/1.2 Georgia,serif}
.stat span{color:var(--muted);font-size:13px}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:10px 0 16px;border:1px solid var(--line);border-radius:6px;background:var(--card)}
table{border-collapse:collapse;width:100%;font-size:13.5px;line-height:1.5}
th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{font-weight:600;color:var(--muted);white-space:nowrap;background:var(--chip)}
td.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
td.dname{min-width:11em}
.chip{display:inline-block;background:var(--chip);border-radius:999px;padding:1px 8px;margin:1px 2px;font-size:12px;white-space:nowrap}
details{background:var(--card);border:1px solid var(--line);border-radius:6px;margin:10px 0;padding:0 14px}
details[open]{padding-bottom:10px}
summary{cursor:pointer;padding:12px 0;font-weight:600;list-style-position:outside}
summary small{font-weight:400;color:var(--muted)}
ul.src{padding-left:18px;margin:6px 0 10px}ul.src li{margin:3px 0;font-size:13.5px}
.muted{color:var(--muted)}.small{font-size:13px}
.pdfs{display:grid;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr));gap:10px;margin:10px 0}
.pdfs a{display:block;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:10px 12px;text-decoration:none;min-height:44px}
.pdfs a b{display:block;color:var(--ink)}.pdfs a span{font-size:12px;color:var(--muted)}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr));gap:10px;margin:12px 0 18px}
.gallery a{display:block;text-decoration:none;color:var(--muted);font-size:12px;line-height:1.4}
.gallery img{display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:4px;background:#fff;margin-bottom:4px}
.note{border-left:3px solid var(--warn);padding:8px 12px;background:var(--card);margin:12px 0;font-size:14px}
footer{margin:48px auto 32px;padding-top:16px;border-top:1px solid var(--line);font-size:12.5px;color:var(--muted)}
@media (max-width:600px){body{font-size:14.5px}th,td{padding:7px 8px}}
"""


def section_summary(ctx):
    return ctx['summary_html']


def build(ctx):
    parts = [f"""<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>07 有料商品の実験：20地区とNDL調査</title>
<meta name="description" content="Japan Time Atlas 非公開ページ07。英語PDF商品（Basic・Area Dossier・Deep Research）の実験と、候補20地区の国立国会図書館サーチ調査。">
<link rel="icon" href="/icons/atlas-96.png" type="image/png"><style>{CSS}</style></head><body>
<header><span class="tag">未公開 · 07</span><h1>有料商品の実験：候補20地区と国立国会図書館サーチ調査</h1>
<p class="lead">英語PDFの3商品（Basic／Area Dossier／Deep Research）を想定し、訪問者の国ごとの関心から20地区を選び、国立国会図書館サーチでできる調査をすべて行い、試作品を作りました。{esc(TODAY)}時点。</p></header><main>"""]
    parts += ctx['sections']
    parts.append(f"""</main><footer>Japan Time Atlas · 実験ページ07（検索エンジン非表示・サイト内リンクなし）。データ出典：国土地理院（地理院タイル・地形分類・明治期の低湿地・自然災害伝承碑）、国立国会図書館（NDLサーチ・デジタルコレクション・NDLラボ・レファレンス協同データベース）、ジャパンサーチ、JNTO、観光庁ほか。図書館資料は書誌・URL・コマ番号の引用のみで、画像や本文は転載していません。調査データと生成スクリプト：research/lab-07/。 · <a href="/about">このサイトについて</a> · <a href="/support">サイトを支援</a></footer></body></html>""")
    return ''.join(parts)


if __name__ == '__main__':
    import page_sections
    ctx = page_sections.context()
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(build(ctx))
    print('wrote lab/07/index.html')
