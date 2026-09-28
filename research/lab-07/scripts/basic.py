"""Basic brief generator (page 07 experiment).

    python3 basic.py <district-id> [...]      # or: all

For each district: picks the GSI aerial-photo series that cover the study rectangle, builds
then/now and timeline images, a landform map from GSI's landform-classification vector tiles
(former river channels, filled/reclaimed land …) and a map of natural-disaster memorials,
writes an English HTML brief and renders it to lab/07/pdf/basic-<id>.pdf.
Everything shown is generated from public data at run time; nothing is written by hand
except the fixed explanatory text in this file and the English monument notes in
research/lab-07/monuments-en.json."""
import datetime, html, io, json, math, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
import gsi
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageOps

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = gsi.ROOT
SCRATCH = os.environ.get('LAB07_SCRATCH', os.path.join(os.path.expanduser('~'), '.cache', 'japan-time-atlas-lab07'))  # outside the repo: the site tests scan every .html in it
FONTS = os.environ.get('LAB07_FONTS', os.path.join(SCRATCH, 'fonts'))
BUILD = os.path.join(SCRATCH, 'basic')
PDF_DIR = os.path.join(ROOT, 'lab', '07', 'pdf')
TODAY = datetime.date.today().isoformat()
NODE_PATH = '/opt/node22/lib/node_modules'

SERIES = [  # layer, label, decade key
    ('ort_1928', 'c. 1928'), ('ort_riku10', 'c. 1936–1942'), ('ort_USA10', '1945–1950'),
    ('ort_old10', '1961–1969'), ('gazo1', '1974–1978'), ('gazo2', '1979–1983'),
    ('gazo3', '1984–1986'), ('gazo4', '1987–1990'),
]
SERIES_JA = {  # same series, Japanese-language captions for the --lang ja Area Dossier
    'ort_1928': '1928年頃', 'ort_riku10': '1936〜1942年頃', 'ort_USA10': '1945〜1950年',
    'ort_old10': '1961〜1969年', 'gazo1': '1974〜1978年', 'gazo2': '1979〜1983年',
    'gazo3': '1984〜1986年', 'gazo4': '1987〜1990年',
}
KIND_EN = {'洪水': 'flood', '土砂災害': 'landslide or debris flow', '地震': 'earthquake', '津波': 'tsunami',
           '高潮': 'storm surge', '火山災害': 'volcanic disaster', 'その他': 'other'}
Z_PHOTO = 16
W_BIG = 1120

# Fixed English/Japanese strings for the sections basic.build() writes into sections.json
# (thennow, timeline, ground, manmade, disasters — the ones dossier.py embeds in the Area
# Dossier PDF). Keyed the same in both languages; used as TXT[lang][key]. The 'en' side is
# copied verbatim from the strings basic.py used before --lang existed, so lang='en' (the
# default everywhere) renders exactly as before.
TXT = {
    'en': {
        'thennow_kicker': '1 · Then and now',
        'thennow_compare': ('<b>How to compare.</b> Anchor on features that rarely move — river banks, rail lines, '
                             'shrine and temple grounds, main roads — then look for what changed around them. '
                             'Differences in tone come from film, camera and season, not from the land itself.'),
        'today': 'today', 'latest': 'Latest',
        'decades_kicker': '2 · In between', 'decades_h2': 'The decades in between',
        'decades_note': ("Every further GSI series that covers the same frame, oldest first. Each series is a "
                          "compilation: photographs within one series were taken on different dates, which is why "
                          "seams and changes of tone can appear inside a frame."),
        'us_military': ' (US military photography)', 'processed': 'processed',
        'ground_kicker': '3 · How the ground was made', 'ground_h2': 'Rivers, shorelines and terraces',
        'ground_fig': ('Natural landforms as classified by GSI, over a recent aerial photograph in gray. Dark blue '
                        'outlines mark former river channels.'),
        'ground_none': 'No detailed natural landform data for this frame.',
        'ground_regional': ("GSI has no detailed landform survey for this frame, so the map uses GSI's regional "
                             "classification (compiled for zoom levels 9–13). It shows the broad landform only; "
                             "former river channels and man-made ground are not mapped at that scale."),
        'ground_partial': ("GSI's detailed landform survey covers only part of this frame (mainly lowland plains); "
                            "unshaded ground was not classified at this scale."),
        'ground_meaning': 'What the main landforms mean',
        'ground_credit': ("Descriptions translated and condensed from GSI's landform-classification legend. They "
                           "describe tendencies of each landform type, not the condition of any individual plot."),
        'manmade_kicker': '4 · Made by people, and the Meiji landscape',
        'manmade_h2': 'Fill, reclamation and the fields beneath the town',
        'manmade_fig': ('Hatching: man-made ground as classified by GSI. Teal outlines: former sea, river or pond. '
                         'Dark blue outlines: former river channels.'),
        'meiji_fig': ('GSI “Meiji-era lowland” data, traced from topographic maps of the 1880s–1900s; GSI warns '
                       'that positions can be off by a considerable distance, especially in the Kanto and Kinki '
                       'regions. Only low, wet or open ground was traced: towns, dry fields and forest of the '
                       'period are left blank.'),
        'meiji_h3': 'Meiji-era lowland', 'meiji_none': 'GSI has not traced Meiji-era lowland for this frame.',
        'manmade_h3': 'Man-made ground', 'manmade_none': 'No man-made ground mapped in this frame.',
        'disasters_kicker': '5 · Disasters remembered', 'disasters_h2': 'Memorials to natural disasters nearby',
        'disasters_fig': 'Numbered memorials; the black rectangle is the study area of this brief. Frame {km:.0f} km across.',
        'disasters_radius': ('Fewer than three memorials stand within 3 km of the study area, so the nearest ones '
                              'within {r:.0f} km are listed.'),
        'th_memorial': 'Memorial', 'th_disaster': 'Disaster', 'th_erected': 'Erected', 'th_distance': 'Distance',
        'disasters_none': 'No memorial is registered within 30 km.',
        'disasters_meaning': 'What the memorials record',
        'disasters_notes_none': 'English notes for these memorials are being prepared.',
        'disasters_credit': ('Source: GSI Natural Disaster Memorials (自然災害伝承碑). English names and notes are '
                              'Japan Time Atlas translations and summaries of GSI\'s Japanese descriptions; the '
                              'memorials\' own inscriptions may say more. “Erected” is the year GSI records for '
                              'the monument.'),
        'unknown_year': 'unknown',
        # image-overlay label/sub text drawn by annotate() (basic.py) and walkmap.draw()
        'lbl_aerial_sub': 'Aerial photograph', 'lbl_natural': 'Natural landforms', 'lbl_manmade': 'Man-made ground',
        'sub_landform_class': 'GSI landform classification', 'lbl_meiji': 'Meiji-era lowland',
        'sub_meiji_source': 'GSI, from maps of the 1880s–1900s', 'lbl_disasters_nearby': 'Disasters remembered nearby',
        'sub_memorials': 'Natural-disaster memorials (GSI)', 'lbl_walkmap': 'Walk map',
        'sub_walkmap': 'Latest aerial photograph',
    },
    'ja': {
        'thennow_kicker': '1 · いまとむかし',
        'thennow_compare': ('<b>見比べ方。</b>川岸、鉄道の線路、神社仏閣の境内、幹線道路など位置が変わりにくい目印を'
                             '基準にして、その周りで何が変わったかを見る。色調の違いはフィルムやカメラ、撮影季節の'
                             '違いによるもので、土地そのものの変化ではない。'),
        'today': '現在', 'latest': '最新',
        'decades_kicker': '2 · その間の年代', 'decades_h2': 'その間の年代',
        'decades_note': ('同じ範囲を写した国土地理院の他の写真シリーズを、古い順にすべて掲載した。各シリーズは'
                          '撮影日の異なる写真をまとめた合成図であり、そのため1枚の中に写真のつなぎ目や色調の違いが'
                          '生じることがある。'),
        'us_military': '（米軍撮影）', 'processed': '加工',
        'ground_kicker': '3 · 土地の成り立ち', 'ground_h2': '川・海岸・段丘',
        'ground_fig': '国土地理院の分類による自然地形。背景はグレー処理した最近の空中写真。濃い青の輪郭線は旧河道を示す。',
        'ground_none': 'この範囲の詳細な自然地形データはない。',
        'ground_regional': ('この範囲には国土地理院の詳細な地形分類調査がないため、地図は国土地理院の地方版の分類'
                             '（ズームレベル9〜13向け）を用いている。大まかな地形のみを示し、旧河道や人工地形は'
                             'この縮尺では表されていない。'),
        'ground_partial': ('国土地理院の詳細な地形分類調査は、この範囲の一部（主に低地の平野部）しか対象としていない。'
                            '着色していない土地はこの縮尺では分類されていない。'),
        'ground_meaning': '主な地形の意味',
        'ground_credit': ('国土地理院の地形分類の凡例による説明。地形の種類ごとの一般的な傾向を示すもので、'
                           '個々の土地の状態を示すものではない。'),
        'manmade_kicker': '4 · 人がつくった土地と明治の低湿地',
        'manmade_h2': '盛土・埋立と、町の下に眠る田畑',
        'manmade_fig': ('ハッチング：国土地理院の分類による人工地形。青緑の輪郭線：旧水部（かつての海・河川・池）。'
                         '濃い青の輪郭線：旧河道。'),
        'meiji_fig': ('国土地理院「明治期の低湿地」データ。1880〜1900年代の地形図から作成されたもので、位置は特に'
                       '関東・近畿地方でかなりずれる場合があると国土地理院自身が注記している。低くて湿った土地や'
                       '空地のみが対象で、当時の市街地・畑・森林は着色していない。'),
        'meiji_h3': '明治期の低湿地', 'meiji_none': 'この範囲について、国土地理院は明治期の低湿地を調査していない。',
        'manmade_h3': '人工地形', 'manmade_none': 'この範囲に人工地形は分類されていない。',
        'disasters_kicker': '5 · 災害の記憶', 'disasters_h2': '災害の記憶（自然災害伝承碑）',
        'disasters_fig': '番号は伝承碑。黒い枠はこの資料の対象範囲。画像の幅は{km:.0f} km。',
        'disasters_radius': ('対象範囲から3 km以内の伝承碑が3件に満たないため、{r:.0f} km以内にある最も近いものを'
                              '掲載した。'),
        'th_memorial': '伝承碑', 'th_disaster': '災害', 'th_erected': '建立', 'th_distance': '距離',
        'disasters_none': '半径30 km以内に登録された伝承碑はない。',
        'disasters_meaning': '碑が伝えること',
        'disasters_notes_none': 'この碑については国土地理院のデータに説明の記載がない。',
        'disasters_credit': ('出典：国土地理院 自然災害伝承碑。碑文はここに記した以上のことを伝えている場合がある。'
                              '「建立」は国土地理院の記録による年。'),
        'unknown_year': '不明',
        'lbl_aerial_sub': '空中写真', 'lbl_natural': '自然地形', 'lbl_manmade': '人工地形',
        'sub_landform_class': '国土地理院の地形分類', 'lbl_meiji': '明治期の低湿地',
        'sub_meiji_source': '国土地理院、1880〜1900年代の地図による', 'lbl_disasters_nearby': '周辺の災害の記憶',
        'sub_memorials': '自然災害伝承碑（国土地理院）', 'lbl_walkmap': '散策マップ',
        'sub_walkmap': '最新の空中写真',
    },
}


def esc(s):
    return html.escape(str(s if s is not None else ''))


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


def load_districts():
    path = os.path.join(HERE, 'districts.json')
    src = path if os.path.exists(path) else os.path.join(HERE, 'candidates.json')
    d = json.load(open(src, encoding='utf-8'))
    return {c['id']: c for c in d.get('districts', d.get('candidates'))}


def study_bbox(c):
    aspect = c.get('aspect', 1.55)
    half_w = c['half']
    half_h = half_w / aspect
    lat, lon = c['center']
    dlat = half_h / 110.574
    dlon = half_w / (111.320 * math.cos(math.radians(lat)))
    return (lat - dlat, lon - dlon, lat + dlat, lon + dlon), 2 * half_w, 2 * half_h


def to_px(bb, size):
    """Function mapping (lat, lon) to pixel (x, y) in an image of `size` covering bb (Web Mercator)."""
    s, w, n, e = bb
    x0, y0 = gsi.deg2px(n, w, 20)
    x1, y1 = gsi.deg2px(s, e, 20)
    W, H = size

    def f(lat, lon):
        x, y = gsi.deg2px(lat, lon, 20)
        return (x - x0) / (x1 - x0) * W, (y - y0) / (y1 - y0) * H
    return f


def flatten(img, bg=(255, 255, 255)):
    base = Image.new('RGB', img.size, bg)
    base.paste(img, mask=img.getchannel('A') if img.mode == 'RGBA' else None)
    return base


def nice_scale(width_m, px_width, target_px=160):
    m_per_px = width_m / px_width
    raw = m_per_px * target_px
    for v in (50, 100, 200, 250, 500, 1000, 2000, 2500, 5000):
        if v >= raw * 0.8:
            return v, v / m_per_px
    return 5000, 5000 / m_per_px


def annotate(img, label, width_km, sub=None, lang='en'):
    """Label box, scale bar and north arrow on a map image (in place). label/sub are drawn
    with Noto Sans JP when lang='ja' (Inter, used otherwise, has no Japanese glyphs)."""
    d = ImageDraw.Draw(img, 'RGBA')
    W, H = img.size
    if lang == 'ja':
        f1, f2 = font('NotoSansJP-Bold.ttf', 22), font('NotoSansJP-Regular.ttf', 17)
    else:
        f1, f2 = font('Inter-SemiBold.ttf', 22), font('Inter-Regular.ttf', 17)
    tw = d.textlength(label, font=f1)
    sw = d.textlength(sub, font=f2) if sub else 0
    bw = max(tw, sw) + 24
    bh = 40 + (24 if sub else 0)
    d.rounded_rectangle((12, 12, 12 + bw, 12 + bh), 6, fill=(255, 255, 255, 225))
    d.text((24, 20), label, font=f1, fill=(20, 24, 33))
    if sub:
        d.text((24, 46), sub, font=f2, fill=(70, 76, 90))
    meters, px = nice_scale(width_km * 1000, W)
    x0, y0 = 20, H - 34
    d.rectangle((x0 - 8, y0 - 26, x0 + px + 70, y0 + 16), fill=(255, 255, 255, 215))
    d.rectangle((x0, y0, x0 + px, y0 + 7), fill=(20, 24, 33))
    d.rectangle((x0 + px / 2, y0, x0 + px, y0 + 7), fill=(255, 255, 255), outline=(20, 24, 33))
    txt = f'{meters // 1000} km' if meters >= 1000 else f'{meters} m'
    d.text((x0, y0 - 24), '0', font=f2, fill=(20, 24, 33))
    d.text((x0 + px - d.textlength(txt, font=f2) / 2, y0 - 24), txt, font=f2, fill=(20, 24, 33))
    cx, cy = W - 38, 44
    d.ellipse((cx - 24, cy - 24, cx + 24, cy + 24), fill=(255, 255, 255, 215))
    d.polygon([(cx, cy - 18), (cx - 9, cy + 10), (cx, cy + 4), (cx + 9, cy + 10)], fill=(20, 24, 33))
    d.text((cx - 6, cy + 9), 'N', font=font('Inter-Bold.ttf', 13), fill=(20, 24, 33))
    return img


def save_jpg(img, path, width=W_BIG, q=70):
    if img.width != width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    img.save(path, 'JPEG', quality=q, optimize=True, progressive=True)
    return os.path.basename(path), img.size


def pick_series(bb):
    """Coverage of every historical series and of the newest annual orthophoto."""
    cov = {}
    imgs = {}
    for layer, label in SERIES:
        img, c = gsi.mosaic(layer, bb, Z_PHOTO)
        cov[layer] = c
        if c >= 0.85:
            imgs[layer] = img
    now = None
    lat, lon = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
    cx, cy = gsi.deg2px(lat, lon, Z_PHOTO)
    for year in range(datetime.date.today().year, datetime.date.today().year - 9, -1):  # older annual photos lose to the seamless mosaic
        layer = f'nendophoto{year}'
        gsi.EXT[layer] = 'png'
        if not gsi.fetch(layer, Z_PHOTO, int(cx // 256), int(cy // 256)):
            continue  # no photograph of that year at the centre: skip without fetching the whole frame
        try:
            img, c = gsi.mosaic(layer, bb, Z_PHOTO)
        except Exception:
            continue
        if c >= 0.9:
            if c < 0.995:
                fill, _ = gsi.mosaic('seamlessphoto', bb, Z_PHOTO)
                base = flatten(fill).convert('RGBA')
                base.alpha_composite(img)
                img = base
            now = (layer, str(year), img)
            break
    if not now:
        img, c = gsi.mosaic('seamlessphoto', bb, Z_PHOTO)
        now = ('seamlessphoto', 'latest', img)
    return cov, imgs, now


def gray_base(img, strength=0.55):
    g = ImageOps.grayscale(flatten(img)).convert('RGB')
    g = ImageEnhance.Contrast(g).enhance(0.7)
    return Image.blend(g, Image.new('RGB', g.size, (255, 255, 255)), strength)


def hatch(size, color, spacing=9, width=2, direction=1):
    pat = Image.new('RGBA', size, (0, 0, 0, 0))
    d = ImageDraw.Draw(pat)
    W, H = size
    for k in range(-H, W + H, spacing):
        if direction > 0:
            d.line([(k, 0), (k + H, H)], fill=color, width=width)
        else:
            d.line([(k, H), (k + H, 0)], fill=color, width=width)
    return pat


def polys(geom):
    if geom.geom_type == 'Polygon':
        return [geom]
    if geom.geom_type in ('MultiPolygon', 'GeometryCollection'):
        out = []
        for g in geom.geoms:
            out += polys(g)
        return out
    return []


ART_STYLE = {  # artificial landform classes: hatch colour, direction
    'fill': ((192, 57, 43, 235), 1), 'cut': ((125, 60, 152, 235), -1), 'polder': ((36, 113, 163, 235), -1),
    'levelledfarm': ((160, 110, 40, 235), 1), 'works': ((90, 90, 90, 235), 1),
}


def draw_polys(d, f, g, **kw):
    for p in polys(g):
        ring = [f(lat, lon) for lon, lat in p.exterior.coords]
        if len(ring) > 2:
            d.polygon(ring, **kw)


def outline(d, f, g, fill, width):
    for p in polys(g):
        ring = [f(lat, lon) for lon, lat in p.exterior.coords]
        if len(ring) > 2:
            d.line(ring + [ring[0]], fill=fill, width=width)


def landform_maps(bb, base_img, width_km, lang='en'):
    """(natural map, man-made map, shares). Natural: GSI colours; man-made: hatching; both show
    former river channels as dark-blue outlines."""
    from shapely.ops import unary_union
    legend = gsi.landform_legend()
    raw = gsi.landform_features(bb, 14)
    shares = gsi.landform_shares(bb, 14, raw)
    scale = 'detailed'
    if sum(shares['natural'].values()) < 0.3:
        # no detailed survey here: use GSI's regional version (zoom 9-13) for the natural landforms
        regional = [f for f in gsi.landform_features(bb, 13) if f[0].endswith('1')]
        raw = regional + [f for f in raw if f[0].endswith('2')]
        shares = gsi.landform_shares(bb, 14, raw)
        scale = 'regional'
    shares['scale'] = scale
    groups = {}
    for layer, code, g in raw:  # merge per class so tile edges do not show as outlines
        groups.setdefault((layer, code), []).append(g)
    feats = [(layer, code, unary_union(gs).buffer(0)) for (layer, code), gs in groups.items()]
    base = gray_base(base_img, 0.45)
    W, H = base.size
    f = to_px(bb, (W, H))
    over = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    art, old_channels, former_water = [], [], []
    for layer, code, g in feats:
        info = legend['codes'].get(code)
        if not info or info['class'] == 'note':
            continue
        if layer.endswith('2'):
            art.append((info['class'], g))
            continue
        col = info.get('color', '#dddddd').lstrip('#')
        rgb = tuple(int(col[i:i + 2], 16) for i in (0, 2, 4))
        for p in polys(g):
            ring = [f(lat, lon) for lon, lat in p.exterior.coords]
            if len(ring) > 2:
                d.polygon(ring, fill=rgb + (165,))
        if info['class'] == 'oldchannel':
            old_channels.append(g)
        if info['class'] == 'formerwater':
            former_water.append(g)
    nat = Image.alpha_composite(base.convert('RGBA'), over)
    od = ImageDraw.Draw(nat)
    for g in old_channels:
        outline(od, f, g, (16, 52, 120, 255), 4)
    nat = annotate(nat.convert('RGB'), TXT[lang]['lbl_natural'], width_km, TXT[lang]['sub_landform_class'], lang)

    man = gray_base(base_img, 0.3).convert('RGBA')
    for cls, g in art:
        colr, direction = ART_STYLE.get(cls, ((80, 80, 80, 235), 1))
        mask = Image.new('L', (W, H), 0)
        draw_polys(ImageDraw.Draw(mask), f, g, fill=255)
        pat = hatch((W, H), colr, 11, 3, direction)
        man.paste(pat, (0, 0), Image.composite(pat.getchannel('A'), Image.new('L', (W, H), 0), mask))
        outline(ImageDraw.Draw(man), f, g, colr[:3] + (255,), 3)
    md = ImageDraw.Draw(man)
    for g in former_water:
        outline(md, f, g, (0, 128, 128, 255), 3)
    for g in old_channels:
        outline(md, f, g, (16, 52, 120, 255), 5)
    man = annotate(man.convert('RGB'), TXT[lang]['lbl_manmade'], width_km, TXT[lang]['sub_landform_class'], lang)
    return nat, man, shares


def meiji_map(bb, base_img, width_km, lang='en'):
    """GSI 'Meiji-era lowland' overlay on the grey photograph, and its shares by class."""
    img, cov = gsi.mosaic('swale', bb, 15)
    if cov < 0.002:
        return None, {}
    shares = gsi.meiji_shares(img)
    base = gray_base(base_img, 0.4).convert('RGBA')
    over = img.resize(base.size, Image.NEAREST)
    a = over.getchannel('A').point(lambda v: 0 if v < 60 else 215)
    over.putalpha(a)
    out = Image.alpha_composite(base, over).convert('RGB')
    return annotate(out, TXT[lang]['lbl_meiji'], width_km, TXT[lang]['sub_meiji_source'], lang), shares


def monuments_for(center):
    near = gsi.monuments_near(center, 3.0)
    radius = 3.0
    if len(near) < 3:
        near = gsi.monuments_near(center, 8.0)[:6]
        radius = 8.0
    if not near:
        near = gsi.monuments_near(center, 30.0)[:3]
        radius = 30.0 if near else 8.0
    return near[:12], radius, len(gsi.monuments_near(center, 3.0))


def monument_map(center, study_bb, mons, radius, lang='en'):
    half = max(radius, max([m['dist_km'] for m in mons], default=1) + 0.4)
    half = min(max(half, 2.0), 32.0)
    lat, lon = center
    dlat = half / 110.574
    dlon = half / (111.320 * math.cos(math.radians(lat)))
    bb = (lat - dlat, lon - dlon, lat + dlat, lon + dlon)
    z = 14 if half <= 3.5 else 13 if half <= 9 else 11
    img, cov = gsi.mosaic('seamlessphoto', bb, z)
    base = gray_base(img, 0.35).convert('RGBA')
    W, H = base.size
    f = to_px(bb, (W, H))
    d = ImageDraw.Draw(base, 'RGBA')
    s, w, n, e = study_bb
    rect = [f(n, w), f(s, e)]
    d.rectangle([rect[0], rect[1]], outline=(20, 24, 33, 255), width=3)
    fn = font('Inter-Bold.ttf', max(16, W // 42))
    r = max(13, W // 50)
    for i, m in enumerate(mons, 1):
        x, y = f(m['lat'], m['lon'])
        d.ellipse((x - r, y - r, x + r, y + r), fill=(200, 40, 40, 240), outline=(255, 255, 255, 255), width=3)
        t = str(i)
        d.text((x - d.textlength(t, font=fn) / 2, y - fn.size * 0.62), t, font=fn, fill=(255, 255, 255))
    img = annotate(base.convert('RGB'), TXT[lang]['lbl_disasters_nearby'], 2 * half, TXT[lang]['sub_memorials'], lang)
    return img, 2 * half


def japan_locator(center, size=(520, 560)):
    src = open(os.path.join(ROOT, 'japan-boundary.js'), encoding='utf-8').read()
    m = re.search(r'const polygons = (\{.*?\});\n', src, re.S)
    land = json.loads(m.group(1))['land']
    W, H = size
    bb = (24.0, 123.0, 45.8, 146.2)
    img = Image.new('RGB', (W, H), (246, 244, 239))
    d = ImageDraw.Draw(img)
    s, w, n, e = bb
    x0, y0 = gsi.deg2px(n, w, 6)
    x1, y1 = gsi.deg2px(s, e, 6)
    sc = min(W / (x1 - x0), H / (y1 - y0))

    def f(lat, lon):
        x, y = gsi.deg2px(lat, lon, 6)
        return (x - x0) * sc, (y - y0) * sc
    for poly in land:
        ring = [f(lat, lon) for lat, lon in poly[1]]
        if len(ring) > 2:
            d.polygon(ring, fill=(205, 200, 188), outline=(150, 145, 135))
    x, y = f(*center)
    d.ellipse((x - 11, y - 11, x + 11, y + 11), fill=(200, 40, 40), outline=(255, 255, 255), width=3)
    return img


def kind_en(kind):
    return ' / '.join(KIND_EN.get(k, k) for k in kind.split('・'))


def pct(v):
    if v >= 0.095:
        return f'{v * 100:.0f}%'
    if v >= 0.005:
        return f'{v * 100:.1f}%'
    return 'under 0.5%'


CSS = r"""
@font-face{font-family:Serif;src:url('FONTDIR/SourceSerif4-Regular.ttf')}
@font-face{font-family:Serif;font-style:italic;src:url('FONTDIR/SourceSerif4-Italic.ttf')}
@font-face{font-family:Serif;font-weight:600;src:url('FONTDIR/SourceSerif4-SemiBold.ttf')}
@font-face{font-family:Sans;src:url('FONTDIR/Inter-Regular.ttf')}
@font-face{font-family:Sans;font-weight:600;src:url('FONTDIR/Inter-SemiBold.ttf')}
@font-face{font-family:Sans;font-weight:700;src:url('FONTDIR/Inter-Bold.ttf')}
@font-face{font-family:JP;src:url('FONTDIR/NotoSansJP-Regular.ttf')}
@font-face{font-family:JP;font-weight:700;src:url('FONTDIR/NotoSansJP-Bold.ttf')}
@page{size:A4}
*{box-sizing:border-box}
html{font:10.2pt/1.5 Serif,JP,serif;color:#1d2230}
body{margin:0}
.page{page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto}
h1,h2,h3,.sans{font-family:Sans,JP,sans-serif}
h1{font-size:25pt;line-height:1.12;margin:0 0 4mm;letter-spacing:-.01em}
h2{font-size:15pt;margin:0 0 2.5mm;letter-spacing:-.005em}
h3{font-size:10.5pt;margin:4mm 0 1.2mm}
.kicker{font:600 8pt Sans,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#a33a2b;margin:0 0 3mm}
.lede{font-size:12pt;line-height:1.45;color:#39404f;margin:0 0 6mm}
.jp{font-family:JP,sans-serif}
.cover-grid{display:grid;grid-template-columns:62mm 1fr;gap:8mm;align-items:start}
.cover-grid img{width:62mm;border:1px solid #d9d4c9}
.facts{list-style:none;padding:0;margin:0;font:9.2pt/1.4 Sans,JP,sans-serif}
.facts li{padding:2.3mm 0;border-bottom:1px solid #e3dfd6;display:grid;grid-template-columns:46mm 1fr;gap:3mm}
.facts b{font-weight:600;color:#5a6172}
.box{background:#f6f4ef;border-left:3px solid #a33a2b;padding:3.5mm 4.5mm;margin:5mm 0;font:9pt/1.45 Sans,JP,sans-serif}
.box p{margin:0 0 1.5mm}
figure{margin:0 0 3.5mm}
figure img{width:100%;display:block;border:1px solid #cfc9bd}
figcaption{font:8pt/1.35 Sans,JP,sans-serif;color:#5a6172;margin-top:1.4mm}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
.legend{display:grid;grid-template-columns:1fr 1fr;gap:1.2mm 5mm;font:8.2pt/1.3 Sans,JP,sans-serif;margin:2mm 0 3mm}
.legend span.sw{display:inline-block;width:3.6mm;height:3.6mm;border:1px solid #777;vertical-align:-0.6mm;margin-right:1.6mm}
.legend .share{color:#5a6172}
table{width:100%;border-collapse:collapse;font:8.1pt/1.32 Sans,JP,sans-serif}
th,td{text-align:left;padding:1.4mm 1.6mm;border-bottom:1px solid #e3dfd6;vertical-align:top}
th{font-weight:600;color:#5a6172;border-bottom:1.5px solid #1d2230}
td.n{font-weight:700;color:#c82828;width:6mm}
.small{font:8pt/1.4 Sans,JP,sans-serif;color:#4c5363}
.src li{margin-bottom:1.6mm}
.muted{color:#6b7282}
.pill{display:inline-block;font:600 7.2pt Sans,sans-serif;background:#1d2230;color:#fff;border-radius:2mm;padding:.6mm 2mm;margin-right:1.5mm}
.risk{margin:0 0 2.2mm;font:8.6pt/1.42 Sans,JP,sans-serif}
.risk b{font-weight:600}
.tn figure img{max-height:104mm;width:auto;max-width:100%;margin:0 auto}
.stack figure img{max-height:88mm;width:auto;max-width:100%;margin:0 auto}
.stack figure{text-align:center;margin-bottom:2.5mm}
.stack figcaption{text-align:left}
.tn figure{text-align:center}
.tn figcaption{text-align:left}
"""


def html_page(c, data):
    css = CSS.replace('FONTDIR', 'file://' + FONTS)
    parts = [f'<!doctype html><html lang="en" data-footer="Japan Time Atlas · Basic brief · {esc(c["en"])} · generated {TODAY}"><head><meta charset="utf-8"><title>{esc(c["en"])} — Basic brief (Japan Time Atlas)</title><style>{css}</style></head><body>']
    parts.append(data['cover'])
    parts.append(data['thennow'])
    if data.get('timeline'):
        parts.append(data['timeline'])
    parts.append(data['ground'])
    parts.append(data['manmade'])
    parts.append(data['disasters'])
    parts.append(data['sources'])
    parts.append('</body></html>')
    return ''.join(parts)


MEIJI_EN = {key: (en, ja, rgb) for rgb, key, en, ja in gsi.MEIJI}


def year_en(y):
    """Year a memorial was erected, as GSI records it: 不明 -> unknown, 1940頃 -> c. 1940."""
    if not y or y in ('不明', '不詳'):
        return 'unknown'
    y = str(y)
    if y.endswith('頃'):
        return 'c. ' + y[:-1]
    return y


def build(c, mon_en):
    out_dir = os.path.join(BUILD, c['id'])
    if os.path.isdir(out_dir):
        for name in os.listdir(out_dir):
            if name.endswith(('.jpg', '.png', '.html')):
                os.remove(os.path.join(out_dir, name))
    os.makedirs(out_dir, exist_ok=True)
    bb, wkm, hkm = study_bbox(c)
    cov, imgs, now = pick_series(bb)
    order = [l for l, _ in SERIES if l in imgs]
    labels = dict(SERIES)
    if not order:
        raise SystemExit(c['id'] + ': no historical series covers the study area')
    # the headline comparison needs a complete frame; partly covered older series stay in the decades grid
    then = next((l for l in order if cov[l] >= 0.97), order[0])
    now_layer, now_label, now_img = now
    now_name = now_label if now_label != 'latest' else 'Latest'
    now_text = f'{now_label} annual orthophoto' if now_label != 'latest' else 'latest seamless mosaic'
    files = {}
    files['then'] = save_jpg(annotate(flatten(imgs[then]), labels[then], wkm, 'Aerial photograph'), os.path.join(out_dir, 'then.jpg'))
    files['now'] = save_jpg(annotate(flatten(now_img), now_name, wkm, 'Aerial photograph'), os.path.join(out_dir, 'now.jpg'))
    mids = [l for l in order if l != then][:6]
    for l in mids:
        files[l] = save_jpg(annotate(flatten(imgs[l]), labels[l], wkm), os.path.join(out_dir, l + '.jpg'), width=640, q=64)
    nat_img, man_img, shares = landform_maps(bb, now_img, wkm)
    files['natural'] = save_jpg(nat_img, os.path.join(out_dir, 'natural.jpg'), q=76)
    files['manmade'] = save_jpg(man_img, os.path.join(out_dir, 'manmade.jpg'), width=980, q=62)
    meiji_img, meiji = meiji_map(bb, now_img, wkm)
    if meiji_img is not None:
        files['meiji'] = save_jpg(meiji_img, os.path.join(out_dir, 'meiji.jpg'), width=980, q=70)
    mons, radius, n3 = monuments_for(c['center'])
    mm_img, mm_km = monument_map(c['center'], bb, mons, radius)
    files['monuments'] = save_jpg(mm_img, os.path.join(out_dir, 'monuments.jpg'), width=860, q=68)
    japan_locator(c['center']).save(os.path.join(out_dir, 'locator.png'), optimize=True)

    legend = gsi.landform_legend()['classes']
    lf_scale = shares.get('scale', 'detailed')
    nat = sorted(shares['natural'].items(), key=lambda kv: -kv[1])
    art = sorted(shares['artificial'].items(), key=lambda kv: -kv[1])
    covered = sum(v for k, v in nat)
    oldch = shares['natural'].get('oldchannel', 0)
    fill = shares['artificial'].get('fill', 0) + shares['artificial'].get('polder', 0)
    formerwater = shares['natural'].get('formerwater', 0)
    series_list = ', '.join(labels[l] for l in order) + f', {now_label}'
    kinds = {}
    for m in gsi.monuments_near(c['center'], 3.0):
        for k in m['kind'].split('・'):
            kinds[KIND_EN.get(k, k)] = kinds.get(KIND_EN.get(k, k), 0) + 1
    kinds_txt = ', '.join(f'{k} {v}' for k, v in sorted(kinds.items(), key=lambda kv: -kv[1]))
    main_nat = next(((k, v) for k, v in nat if k not in ('water',)), None)
    meiji_sorted = sorted(((k, v) for k, v in meiji.items() if k != 'bank'), key=lambda kv: -kv[1])
    meiji_land = [(k, v) for k, v in meiji_sorted if k != 'water' and v >= 0.005]
    facts = [
        ('Study area', f'{wkm:.1f} km × {hkm:.1f} km around {c["center"][0]:.4f}° N, {c["center"][1]:.4f}° E'),
        ('Oldest aerial photograph', labels[then]),
        ('Aerial series in this brief', series_list),
        ('Main natural landform', f'{legend[main_nat[0]]["en"]} ({pct(main_nat[1])})' if main_nat else 'not mapped at detailed scale'),
        ('Former river channels', pct(oldch) if oldch else 'none mapped'),
        ('Filled, reclaimed or drained land', pct(fill) if fill else 'none mapped'),
        ('Former sea, river or pond', pct(formerwater) if formerwater else 'none mapped'),
        ('Meiji-era paddies, marsh and flats', ', '.join(f'{MEIJI_EN[k][0].lower()} {pct(v)}' for k, v in meiji_land[:3]) if meiji_land else 'none mapped'),
        ('Disaster memorials within 3 km', f'{n3}' + (f' ({kinds_txt})' if kinds_txt else '')),
    ]
    cover = f"""<section class="page">
<p class="kicker">Japan Time Atlas · Basic brief</p>
<h1>{esc(c['en'])}</h1>
<p class="lede">Then-and-now aerial photographs, how the ground was made, and the disasters people chose to remember — compiled automatically from public Japanese government data.</p>
<div class="cover-grid"><div><img src="locator.png" alt="Location in Japan"><p class="small muted" style="margin-top:2mm"><span class="jp">{esc(c['ja'])}</span></p></div>
<ul class="facts">{''.join(f'<li><b>{esc(k)}</b><span>{esc(v)}</span></li>' for k, v in facts)}</ul></div>
<div class="box"><p><b>What this brief is.</b> A reading aid for comparing the same ground across decades. It shows what the photographs and GSI's land surveys record; it does not describe current conditions, access or opening hours.</p>
<p><b>What it is not.</b> Not a hazard assessment or a property survey. Landform classes describe typical tendencies of the ground; for present-day risk, read the official hazard map of the municipality.</p></div>
<p class="small muted">Edition {TODAY}. Aerial photographs, landform and Meiji-era lowland data: Geospatial Information Authority of Japan (GSI), processed by Japan Time Atlas. Memorial data: GSI Natural Disaster Memorials, summarised and translated by Japan Time Atlas.</p>
</section>"""
    thennow = f"""<section class="page tn">
<p class="kicker">1 · Then and now</p><h2>The same ground, {esc(labels[then])} and {esc(now_label if now_label != 'latest' else 'today')}</h2>
<figure><img src="{files['then'][0]}" alt="Aerial photograph {esc(labels[then])}"><figcaption>{esc(labels[then])} aerial photograph{' (US military photography)' if then == 'ort_USA10' else ''} — GSI Tiles <i>{then}</i>, cropped and annotated by Japan Time Atlas. North is up; the frame is identical in both images.</figcaption></figure>
<figure><img src="{files['now'][0]}" alt="Recent aerial photograph"><figcaption>{esc(now_text[0].upper() + now_text[1:])} — GSI Tiles <i>{now_layer}</i>, cropped and annotated by Japan Time Atlas. Capture dates within a mosaic can differ from place to place.</figcaption></figure>
<p class="small"><b>How to compare.</b> Anchor on features that rarely move — river banks, rail lines, shrine and temple grounds, main roads — then look for what changed around them. Differences in tone come from film, camera and season, not from the land itself.</p>
</section>"""
    timeline = ''
    if mids:
        cells = ''.join(f'<figure><img src="{files[l][0]}" alt="{esc(labels[l])}"><figcaption>{esc(labels[l])}{" (US military photography)" if l == "ort_USA10" else ""} · GSI Tiles <i>{l}</i>, processed</figcaption></figure>' for l in mids)
        timeline = f"""<section class="page"><p class="kicker">2 · In between</p><h2>The decades in between</h2>
<p class="small">Every further GSI series that covers the same frame, oldest first. Each series is a compilation: photographs within one series were taken on different dates, which is why seams and changes of tone can appear inside a frame.</p>
<div class="grid2">{cells}</div></section>"""

    def legend_row(k, v, manmade=False):
        if manmade:
            colr = ART_STYLE.get(k, ((80, 80, 80, 235), 1))[0]
            sw = f'background:repeating-linear-gradient(45deg,rgb{colr[:3]} 0 1.3px,#fff 1.3px 3.6px)'
        else:
            sw = f'background:{legend[k]["color"]};opacity:.8'
        return f'<div><span class="sw" style="{sw}"></span>{esc(legend[k]["en"])} <span class="share">{pct(v)}</span></div>'
    nat_rows = ''.join(legend_row(k, v) for k, v in nat if v >= 0.003 and k in legend)
    art_rows = ''.join(legend_row(k, v, True) for k, v in art if v >= 0.003 and k in legend)
    risks = []
    for k, v in nat:
        if k in ('water',) or v < 0.04 or k not in legend or not legend[k].get('risk'):
            continue
        risks.append(f'<p class="risk"><b>{esc(legend[k]["en"])}</b> ({pct(v)}). {esc(legend[k]["origin"])} <span class="muted">{esc(legend[k]["risk"])}</span></p>')
    if oldch and oldch < 0.04:
        risks.append(f'<p class="risk"><b>{esc(legend["oldchannel"]["en"])}</b> ({pct(oldch)}). {esc(legend["oldchannel"]["origin"])} <span class="muted">{esc(legend["oldchannel"]["risk"])}</span></p>')
    if lf_scale == 'regional':
        note = '<p class="small muted">GSI has no detailed landform survey for this frame, so the map uses GSI\'s regional classification (compiled for zoom levels 9–13). It shows the broad landform only; former river channels and man-made ground are not mapped at that scale.</p>'
    else:
        note = '' if covered > 0.5 else '<p class="small muted">GSI\'s detailed landform survey covers only part of this frame (mainly lowland plains); unshaded ground was not classified at this scale.</p>'
    ground = f"""<section class="page"><p class="kicker">3 · How the ground was made</p><h2>Rivers, shorelines and terraces</h2>
<figure><img src="{files['natural'][0]}" alt="Natural landform map"><figcaption>Natural landforms as classified by GSI, over a recent aerial photograph in gray. Dark blue outlines mark former river channels.</figcaption></figure>
<div class="legend">{nat_rows or '<div class="muted">No detailed natural landform data for this frame.</div>'}</div>{note}
<h3>What the main landforms mean</h3>{''.join(risks[:5]) or '<p class="small muted">—</p>'}
<p class="small muted">Descriptions translated and condensed from GSI's landform-classification legend. They describe tendencies of each landform type, not the condition of any individual plot.</p></section>"""
    art_text = []
    for k, v in art:
        if v >= 0.02 and k in legend and legend[k].get('risk'):
            art_text.append(f'<p class="risk"><b>{esc(legend[k]["en"])}</b> ({pct(v)}). {esc(legend[k]["origin"])} <span class="muted">{esc(legend[k]["risk"])}</span></p>')
    meiji_rows = ''.join(f'<div><span class="sw" style="background:rgb{MEIJI_EN[k][2]}"></span>{esc(MEIJI_EN[k][0])} <span class="share">{pct(v)}</span></div>' for k, v in meiji_sorted if v >= 0.003)
    meiji_fig = (f'<figure><img src="{files["meiji"][0]}" alt="Meiji-era lowland map"><figcaption>GSI “Meiji-era lowland” data, traced from topographic maps of the 1880s–1900s; GSI warns that positions can be off by a considerable distance, especially in the Kanto and Kinki regions. Only low, wet or open ground was traced: towns, dry fields and forest of the period are left blank.</figcaption></figure>'
                 if 'meiji' in files else '')
    meiji_leg = (f'<div><h3 style="margin-top:0">Meiji-era lowland</h3><div class="legend" style="grid-template-columns:1fr">{meiji_rows}</div></div>' if 'meiji' in files
                 else '<div><h3 style="margin-top:0">Meiji-era lowland</h3><p class="small muted">GSI has not traced Meiji-era lowland for this frame.</p></div>')
    manmade = f"""<section class="page stack"><p class="kicker">4 · Made by people, and the Meiji landscape</p><h2>Fill, reclamation and the fields beneath the town</h2>
<figure><img src="{files['manmade'][0]}" alt="Man-made ground map"><figcaption>Hatching: man-made ground as classified by GSI. Teal outlines: former sea, river or pond. Dark blue outlines: former river channels.</figcaption></figure>
{meiji_fig}
<div class="grid2" style="align-items:start"><div><h3 style="margin-top:0">Man-made ground</h3><div class="legend" style="grid-template-columns:1fr">{art_rows or '<div class="muted">No man-made ground mapped in this frame.</div>'}</div></div>{meiji_leg}</div>
{''.join(art_text[:2])}</section>"""
    rows, notes = [], []
    for i, m in enumerate(mons, 1):
        en = mon_en.get(m['id'], {})
        name = en.get('name_en') or '—'
        dis = en.get('disaster_en') or m.get('dis', '')
        rows.append(f'<tr><td class="n">{i}</td><td><b>{esc(name)}</b> <span class="jp muted" style="font-size:7pt">{esc(m["name"])}</span></td><td>{esc(dis)} <span class="muted">· {esc(kind_en(m["kind"]))}</span></td><td>{esc(year_en(m.get("year")))}</td><td style="white-space:nowrap">{m["dist_km"]:.1f} km</td></tr>')
        if en.get('summary_en') and len(notes) < 6:
            notes.append(f'<p class="risk"><b>{i}. {esc(name)}.</b> {esc(en["summary_en"])}</p>')
    radius_note = '' if radius <= 3 else f'<p class="small">Fewer than three memorials stand within 3 km of the study area, so the nearest ones within {radius:.0f} km are listed.</p>'
    disasters = f"""<section class="page stack"><p class="kicker">5 · Disasters remembered</p><h2>Memorials to natural disasters nearby</h2>
<figure><img src="{files['monuments'][0]}" alt="Map of disaster memorials" style="max-height:92mm"><figcaption>Numbered memorials; the black rectangle is the study area of this brief. Frame {mm_km:.0f} km across.</figcaption></figure>
{radius_note}<table><tr><th></th><th>Memorial</th><th>Disaster</th><th>Erected</th><th>Distance</th></tr>{''.join(rows) or '<tr><td colspan="5">No memorial is registered within 30 km.</td></tr>'}</table>
<h3>What the memorials record</h3>{''.join(notes) or '<p class="small muted">English notes for these memorials are being prepared.</p>'}
<p class="small muted">Source: GSI Natural Disaster Memorials (自然災害伝承碑). English names and notes are Japan Time Atlas translations and summaries of GSI's Japanese descriptions; the memorials' own inscriptions may say more. “Erected” is the year GSI records for the monument.</p></section>"""
    pg = {'photos': '2' + ('–3' if mids else ''), 'ground': str(4 if mids else 3), 'manmade': str(5 if mids else 4), 'memorials': str(6 if mids else 5)}
    sources = f"""<section class="page"><p class="kicker">6 · Sources and method</p><h2>Where every element comes from</h2>
<ul class="src small">
<li><b>Aerial photographs</b> (pp. {pg['photos']}) — Geospatial Information Authority of Japan (GSI), GSI Tiles: series {', '.join(f'<i>{l}</i> ({esc(labels[l])}{", US military photography" if l == "ort_USA10" else ""})' for l in order)} and <i>{now_layer}</i>. Cropped, resized and annotated by Japan Time Atlas. List of GSI Tiles: https://maps.gsi.go.jp/development/ichiran.html</li>
<li><b>Landform classification</b> (pp. {pg['ground']}–{pg['manmade']}) — GSI landform-classification vector tiles (natural and artificial landforms), compiled by GSI from its Land Condition Maps, Flood Control Terrain Classification Maps and vulnerable-landform surveys. Rendered, measured and translated into English by Japan Time Atlas. https://github.com/gsi-cyberjapan/experimental_landformclassification</li>
<li><b>Meiji-era lowland</b> (p. {pg['manmade']}) — GSI “明治期の低湿地” tiles and legend (https://maps.gsi.go.jp/legend/lw_legend.pdf), measured and translated by Japan Time Atlas.</li>
<li><b>Natural disaster memorials</b> (p. {pg['memorials']}) — GSI Natural Disaster Memorials (自然災害伝承碑), registered by municipalities, https://www.gsi.go.jp/bousaichiri/denshouhi.html; processed by Japan Time Atlas (selection by distance, English translation and summary). Memorial photographs are not reproduced.</li>
<li>GSI content is used under the GSI Content Terms of Use, which follow the Public Data License v1.0 (PDL1.0, compatible with CC BY 4.0). Data retrieved {TODAY}.</li>
<li><b>Outline of Japan</b> — Data of Japan / JapanPrefGeoJson (public domain), simplified.</li>
</ul>
<h3>Method</h3>
<p class="small">The study area is a fixed rectangle of {wkm:.1f} × {hkm:.1f} km. Every GSI photo series that covers at least 85% of it is included; the newest annual orthophoto covering at least 90% of it is used as “now”, with any gap filled from GSI's latest seamless mosaic. Landform shares are areas of the rectangle measured on GSI's polygons at zoom level 14, each class merged before measuring. Meiji-era shares count map pixels by legend color. Memorials are selected by straight-line distance from the center of the study area.</p>
<h3>Limits</h3>
<p class="small">Historical series are mosaics of photographs taken on different dates; GSI publishes the flight date of each photograph. Landform data record conditions at the time of survey. Nothing in this brief shows present-day access, safety or opening hours.</p>
<div class="box"><p><b>Area Dossier.</b> The same district with a 4–8 page English history, written from Japanese library sources and cited page by page.</p><p><b>Deep Research.</b> A single hamlet or address, researched in libraries and archives.</p></div>
<p class="small muted">Compiled by Japan Time Atlas; not produced, reviewed or endorsed by GSI, MLIT or any Japanese government agency. Not an official hazard map and not for statutory real-estate disclosure. Generated {TODAY} by an automated pipeline (research/lab-07/scripts/basic.py).</p></section>"""
    data = dict(cover=cover, thennow=thennow, timeline=timeline, ground=ground, manmade=manmade, disasters=disasters, sources=sources)
    page = html_page(c, data)
    hp = os.path.join(out_dir, 'basic.html')
    with open(hp, 'w', encoding='utf-8') as fh:
        fh.write(page)
    meta = {'id': c['id'], 'then': then, 'series': order, 'now': [now_layer, now_label], 'coverage': {k: round(v, 3) for k, v in cov.items()},
            'landform': {'natural': {k: round(v, 4) for k, v in nat}, 'artificial': {k: round(v, 4) for k, v in art}},
            'landformScale': lf_scale, 'meiji': {k: round(v, 4) for k, v in meiji_sorted}, 'monuments': [m['id'] for m in mons], 'monumentRadiusKm': radius,
            'monuments3km': n3, 'studyKm': [round(wkm, 2), round(hkm, 2)], 'bbox': [round(x, 6) for x in bb], 'generated': TODAY}
    json.dump(meta, open(os.path.join(out_dir, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump(data, open(os.path.join(out_dir, 'sections.json'), 'w'), ensure_ascii=False)
    return hp, meta


def main():
    districts = load_districts()
    ids = list(districts) if sys.argv[1:] == ['all'] else sys.argv[1:]
    mon_path = os.path.join(HERE, 'monuments-en.json')
    mon_en = json.load(open(mon_path, encoding='utf-8')) if os.path.exists(mon_path) else {}
    os.makedirs(PDF_DIR, exist_ok=True)
    pairs = []
    metas = {}
    for i in ids:
        hp, meta = build(districts[i], mon_en)
        metas[i] = meta
        pairs += [hp, os.path.join(PDF_DIR, f'basic-{i}.pdf')]
        print('built', i, meta['series'], meta['now'], 'mon3', meta['monuments3km'], flush=True)
    env = dict(os.environ, NODE_PATH=NODE_PATH)
    subprocess.run(['node', os.path.join(os.path.dirname(__file__), 'render_pdf.cjs')] + pairs, check=True, env=env)
    summary_path = os.path.join(HERE, 'basic-meta.json')
    summary = json.load(open(summary_path)) if os.path.exists(summary_path) else {}
    summary.update(metas)
    json.dump(summary, open(summary_path, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
