"""Page previews for lab/07/index.html: renders chosen PDF pages to small JPEGs in lab/07/img/.
    python3 thumbs.py"""
import os, sys
import pymupdf
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
PDF = os.path.join(ROOT, 'lab', '07', 'pdf')
IMG = os.path.join(ROOT, 'lab', '07', 'img')
PICKS = [  # (pdf, page number starting at 1 or a heading found on the page, output name)
    ('basic-tokyo-asakusa.pdf', 2, 'basic-asakusa-then-now.jpg'),
    ('basic-tokyo-asakusa.pdf', 5, 'basic-asakusa-meiji.jpg'),
    ('basic-kobe-meriken.pdf', 6, 'basic-kobe-memorials.jpg'),
    ('basic-hiroshima-peace.pdf', 4, 'basic-hiroshima-landform.jpg'),
    ('dossier-kyoto-higashiyama.pdf', 1, 'dossier-kyoto-cover.jpg'),
    ('dossier-kyoto-higashiyama.pdf', 2, 'dossier-kyoto-report.jpg'),
    ('dossier-kyoto-higashiyama.pdf', 'Walk map', 'dossier-kyoto-walkmap.jpg'),
    ('dossier-kyoto-higashiyama.pdf', 'The stops today', 'dossier-kyoto-photos.jpg'),

    ('deep-research-sample-suo-oshima.pdf', 1, 'deep-sample-cover.jpg'),
]


def main():
    os.makedirs(IMG, exist_ok=True)
    for name, page, out in PICKS:
        path = os.path.join(PDF, name)
        if not os.path.exists(path):
            print('skip', name)
            continue
        doc = pymupdf.open(path)
        if isinstance(page, str):
            page = next((i for i, pg in enumerate(doc, 1) if page in pg.get_text()), 0)
        if not 0 < page <= doc.page_count:
            continue
        pix = doc[page - 1].get_pixmap(dpi=90)
        img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
        img.thumbnail((620, 900), Image.LANCZOS)
        img.save(os.path.join(IMG, out), 'JPEG', quality=72, optimize=True, progressive=True)
        print('thumb', out, os.path.getsize(os.path.join(IMG, out)) // 1024, 'KB')


if __name__ == '__main__':
    main()
