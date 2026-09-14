"""Interior scenes for the viewer (v5): box primitives that stand inside or around a building while the
building's own shell is drawn as a ghost. Everything is a box: position in the 1962 crop frame
(u, v in pixels; y in metres above sea level), size in metres, a colour, an optional rotation about
the vertical axis (degrees, in the crop frame), and an `assumed` flag for parts that are not
documented and are drawn as a translucent guess.

    python interiors.py  ->  web/gunkanjima-interiors.json

Sources used for the shapes (see `sources` in each scene):
- 30号棟: reinforced concrete, 1916, four storeys then seven; a hollow square (ロの字) around a
  light well with the stairs set around the void; 6-tatami one-room flats with a small kitchen and
  4.5-tatami flats; shared toilets at the ends of the galleries; shops on the ground floor and a
  basement (想像と記憶, 軍艦島コンシェルジュ/エクスカーション, Wikipedia 端島). Unit depth, gallery width and
  stair positions are assumptions and flagged.
- 端島神社 (1号棟, 1936): a torii and a cenotaph inside it, a wooden worship hall (collapsed) and the
  reinforced-concrete inner shrine that still stands; the 地獄段 stairway climbs to it from the side
  of Building 16 (1992 photographs Hashima Shrine-01/02/03, Wikipedia, 軍艦島デジタルミュージアム).
  Hall size and stair alignment are assumptions and flagged.
"""
import json
import math
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
WEB = HERE / 'web'
MPP = 0.805  # metres per crop pixel

CONCRETE = [0.72, 0.70, 0.66]
CONCRETE_DARK = [0.55, 0.53, 0.50]
TATAMI = [0.62, 0.60, 0.40]
WOOD = [0.45, 0.33, 0.22]
WOOD_LIGHT = [0.66, 0.52, 0.36]
STONE = [0.60, 0.60, 0.58]
IRON = [0.30, 0.30, 0.32]
PAPER = [0.90, 0.88, 0.80]


def box(u, v, y, sx, sy, sz, c, r=0.0, assumed=False, tag=None):
    b = {'u': round(u, 2), 'v': round(v, 2), 'y': round(y, 2), 's': [round(sx, 2), round(sy, 2), round(sz, 2)], 'c': c}
    if r:
        b['r'] = round(r, 1)
    if assumed:
        b['a'] = 1
    if tag:
        b['t'] = tag
    return b


def m2px(m):
    return m / MPP


def terrain():
    lab = json.loads((WEB / 'gunkanjima-lab.json').read_text(encoding='utf-8'))
    g = lab['grid']
    a = np.fromfile(WEB / 'gunkanjima-terrain.bin', dtype='<u2').reshape(g['h'], g['w']).astype(np.float32) * g['unit']
    def at(u, v):
        x, y = int(round(u)) - g['x0'], int(round(v)) - g['y0']
        return float(a[min(max(y, 0), g['h'] - 1), min(max(x, 0), g['w'] - 1)])
    return at


def scene_no30(model):
    b = next(x for x in model['buildings'] if x['name'] == '30号棟')
    poly = b['poly']
    us, vs = [p[0] for p in poly], [p[1] for p in poly]
    cu, cv = sum(us) / 4, sum(vs) / 4
    W = (max(us) - min(us)) * MPP           # about 32 m across (u)
    D = (max(vs) - min(vs)) * MPP           # about 33 m across (v)
    ground, floorH, storeys = b['ground'], b['floorH'], b['storeys']
    court = 11.5                            # light well, metres (assumed from the aerial photograph)
    gallery = 1.4                           # gallery width along the light well (assumed)
    boxes = []
    # courtyard floor and the ground below the building
    boxes.append(box(cu, cv, ground - 0.05, W - 0.6, 0.1, D - 0.6, CONCRETE_DARK, tag='floor'))
    # galleries on every floor around the light well: slab + railing
    for k in range(storeys):
        y = ground + k * floorH
        if k > 0:
            for side in ('n', 's', 'e', 'w'):
                if side in ('n', 's'):
                    vv = cv + (-(court / 2 + gallery / 2) if side == 'n' else (court / 2 + gallery / 2)) / MPP
                    boxes.append(box(cu, vv, y - 0.18, court + 2 * gallery, 0.18, gallery, CONCRETE, tag='gallery'))
                    boxes.append(box(cu, cv + (-(court / 2) if side == 'n' else court / 2) / MPP, y, court, 1.0, 0.06, IRON, tag='rail'))
                else:
                    uu = cu + (-(court / 2 + gallery / 2) if side == 'w' else (court / 2 + gallery / 2)) / MPP
                    boxes.append(box(uu, cv, y - 0.18, gallery, 0.18, court + 2 * gallery, CONCRETE, tag='gallery'))
                    boxes.append(box(cu + (-(court / 2) if side == 'w' else court / 2) / MPP, cv, y, 0.06, 1.0, court, IRON, tag='rail'))
        # the flat fronts along the gallery: a wall with doors every 4.4 m (assumed rhythm: about 20 flats a floor)
        h = floorH - 0.18
        inner = court / 2 + gallery
        for side in ('n', 's'):
            vv = cv + (-inner if side == 'n' else inner) / MPP
            boxes.append(box(cu, vv, y, court + 2 * gallery, h, 0.2, CONCRETE, assumed=True, tag='front'))
            for i in range(-1, 2):
                boxes.append(box(cu + i * m2px(4.4), vv + (0.14 if side == 'n' else -0.14) / MPP, y, 0.9, 2.0, 0.05, WOOD, assumed=True, tag='door'))
        for side in ('w', 'e'):
            uu = cu + (-inner if side == 'w' else inner) / MPP
            boxes.append(box(uu, cv, y, 0.2, h, court + 2 * gallery, CONCRETE, assumed=True, tag='front'))
            for i in range(-1, 2):
                boxes.append(box(uu + (0.14 if side == 'w' else -0.14) / MPP, cv + i * m2px(4.4), y, 0.05, 2.0, 0.9, WOOD, assumed=True, tag='door'))
    # two stairs in the light well corners (the stairs were set around the void; exact places assumed)
    for (su, sv, dirn) in ((cu - m2px(court / 2 - 1.2), cv - m2px(court / 2 - 0.6), 1), (cu + m2px(court / 2 - 1.2), cv + m2px(court / 2 - 0.6), -1)):
        for k in range(storeys - 1):
            y0 = ground + k * floorH
            for i in range(12):
                boxes.append(box(su, sv + dirn * m2px(i * 0.28 - 1.5), y0 + i * (floorH / 12), 1.2, 0.16, 0.3, CONCRETE_DARK, assumed=True, tag='stair'))
    # one flat shown as a cut-away on the 3rd floor, north-west corner: 6 tatami with a small kitchen
    y = ground + 2 * floorH
    fu, fv = cu - m2px(court / 2 + gallery + 2.9), cv - m2px(court / 2 + gallery - 1.6)
    boxes.append(box(fu, fv, y, 5.4, 0.06, 3.6, TATAMI, tag='flat-floor'))                           # 6畳 = 2.7 x 3.6 m, plus kitchen strip
    boxes.append(box(fu + m2px(2.7), fv - m2px(1.2), y, 0.9, 0.85, 0.55, IRON, assumed=True, tag='sink'))   # sink and stove by the door
    boxes.append(box(fu - m2px(1.3), fv, y + 0.3, 0.8, 0.28, 0.8, WOOD_LIGHT, assumed=True, tag='chabudai'))  # low table
    boxes.append(box(fu - m2px(2.3), fv, y, 0.9, 1.8, 3.4, WOOD, assumed=True, tag='oshiire'))           # closet along the outer wall
    boxes.append(box(fu, fv + m2px(1.75), y, 5.4, 2.6, 0.15, PAPER, assumed=True, tag='fusuma'))          # partition to the next flat
    boxes.append(box(fu, fv - m2px(1.75), y, 5.4, 2.6, 0.15, PAPER, assumed=True, tag='fusuma'))
    boxes.append(box(fu - m2px(2.75), fv, y + 1.0, 0.08, 1.1, 1.6, [0.55, 0.65, 0.72], tag='window'))    # window in the outer wall
    return {
        'building': '30号棟', 'ghost': ['30号棟'],
        'center': [round(cu, 1), round(cv, 1)], 'floor': round(ground, 1),
        'camera': {'u': round(cu, 1), 'v': round(cv, 1), 'y': round(ground + 2 * floorH + 1.2, 1), 'dist': 8.5, 'el': 0.18, 'az': 2.4},
        'flatCamera': {'u': round(fu + m2px(1.5), 1), 'v': round(fv, 1), 'y': round(y + 1.2, 1), 'dist': 9, 'el': 0.35, 'az': 1.2},
        'boxes': boxes,
        'text': {
            'en': 'Inside Building 30: a hollow square of seven floors around a light well. Every flat opens onto a gallery that runs round the well, the stairs sit in the well, and the shared toilets were at the ends of the galleries. One flat is shown cut open on the third floor: a six-tatami room with a small kitchen by the door and a closet against the outer wall, which is how most of the 140 flats were laid out. Gallery width, the door rhythm, the stair positions and the furniture are assumptions and are drawn translucent.',
            'ja': '30号棟の中：吹き抜けの中庭を囲む7階のロの字。各戸は中庭に面した外廊下に開き、階段は中庭側にあり、共同便所は廊下の突き当たりにありました。3階の一室を切り開いて見せています。六畳一間に、戸口脇の小さな台所と外壁側の押入。140戸の多くがこの型でした。廊下幅・戸口の間隔・階段の位置・家具は推定で、半透明で描いています。',
            'ko': '30호동 내부: 채광정을 둘러싼 7층의 ㅁ자형. 각 세대는 채광정 쪽 복도로 열리고, 계단은 채광정 쪽에, 공동 화장실은 복도 끝에 있었습니다. 3층 한 세대를 잘라 보여 줍니다. 다다미 6장 방에 문 옆의 작은 부엌과 바깥벽 쪽 벽장. 140세대 대부분이 이 형태였습니다. 복도 폭·문 간격·계단 위치·가구는 추정이며 반투명으로 그렸습니다.',
            'zh-Hans': '30号楼内部：围绕采光天井的七层“口”字形。各户面向天井一侧的外廊，楼梯设在天井处，公共厕所在走廊尽头。三楼有一户剖开展示：六叠一间，门边有小厨房，外墙侧有壁橱，140户多为此型。走廊宽度、门的间隔、楼梯位置和家具为推定，以半透明绘制。',
            'zh-Hant': '30號樓內部：圍繞採光天井的七層「口」字形。各戶面向天井一側的外廊，樓梯設在天井處，公共廁所在走廊盡頭。三樓有一戶剖開展示：六疊一間，門邊有小廚房，外牆側有壁櫥，140戶多為此型。走廊寬度、門的間隔、樓梯位置和家具為推定，以半透明繪製。',
        },
        'sources': [
            {'label': {'en': 'Imagination and memory: Building 30 (Japanese)', 'ja': '想像と記憶（端島・軍艦島）30号棟'}, 'url': 'https://www6.cncm.ne.jp/~hashima/30goutoum.html'},
            {'label': {'en': 'Gunkanjima Excursion: Building 30 (Japanese)', 'ja': '軍艦島エクスカーション 30号棟'}, 'url': 'https://www.gunkanjima-excursion.com/architecture/30-building.html'},
            {'label': {'en': 'Japanese Wikipedia: Hashima, building list', 'ja': 'Wikipedia「端島 (長崎県)」建物一覧'}, 'url': 'https://ja.wikipedia.org/wiki/端島_(長崎県)'},
        ],
    }


def scene_shrine(model, at):
    b = next(x for x in model['buildings'] if x['name'] == '1号棟')
    poly = b['poly']
    cu, cv = sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly)
    top = max(at(cu, cv), b['ground'])
    boxes = []
    # the rock top as a paved terrace
    boxes.append(box(cu, cv, top - 0.05, 16, 0.12, 12, STONE, tag='terrace'))
    # torii on the east side of the terrace (the approach from the stairway): two posts, two lintels
    tu = cu + m2px(5.5)
    for dv in (-1.6, 1.6):
        boxes.append(box(tu, cv + m2px(dv), top, 0.32, 4.2, 0.32, STONE, tag='torii'))
    boxes.append(box(tu, cv, top + 3.9, 0.36, 0.34, 4.4, STONE, tag='torii'))
    boxes.append(box(tu, cv, top + 3.2, 0.24, 0.22, 3.6, STONE, tag='torii'))
    # the cenotaph inside the torii: a stepped base and a tall stele (seen in the 1992 photograph)
    mu, mv = cu + m2px(3.2), cv - m2px(2.4)
    boxes.append(box(mu, mv, top, 1.6, 0.4, 1.6, STONE, tag='cenotaph'))
    boxes.append(box(mu, mv, top + 0.4, 1.0, 0.5, 1.0, STONE, tag='cenotaph'))
    boxes.append(box(mu, mv, top + 0.9, 0.5, 2.4, 0.4, STONE, tag='cenotaph'))
    # the inner shrine (RC, still standing): a small hut on a plinth with a gabled roof
    su, sv = cu - m2px(4.0), cv
    boxes.append(box(su, sv, top, 3.0, 0.5, 2.6, CONCRETE_DARK, tag='hokora'))
    boxes.append(box(su, sv, top + 0.5, 2.0, 2.2, 1.8, CONCRETE, tag='hokora'))
    boxes.append(box(su, sv, top + 2.7, 2.8, 0.3, 2.6, CONCRETE_DARK, tag='hokora'))
    boxes.append(box(su, sv, top + 3.0, 1.8, 0.35, 1.6, CONCRETE_DARK, tag='hokora'))
    # the wooden worship hall that stood in front of it (collapsed; size assumed)
    hu = cu - m2px(0.5)
    boxes.append(box(hu, cv, top, 5.0, 0.4, 4.0, WOOD, assumed=True, tag='haiden'))
    for du, dv in ((-2.2, -1.7), (2.2, -1.7), (-2.2, 1.7), (2.2, 1.7)):
        boxes.append(box(hu + m2px(du), cv + m2px(dv), top + 0.4, 0.25, 2.8, 0.25, WOOD, assumed=True, tag='haiden'))
    boxes.append(box(hu, cv, top + 3.2, 6.0, 0.5, 5.0, [0.30, 0.30, 0.32], assumed=True, tag='haiden-roof'))
    boxes.append(box(hu, cv, top + 3.7, 4.0, 0.5, 3.2, [0.30, 0.30, 0.32], assumed=True, tag='haiden-roof'))
    # 地獄段: a stairway of steps from the terrace down toward the west blocks (line assumed; heights follow the terrain)
    b16 = next(x for x in model['buildings'] if x['name'] == '16号棟')
    eu, ev = sum(p[0] for p in b16['poly']) / len(b16['poly']), sum(p[1] for p in b16['poly']) / len(b16['poly'])
    su0, sv0 = tu + m2px(1.5), cv
    n = 46
    for i in range(n):
        f = i / (n - 1)
        u = su0 + (eu - su0) * f * 0.55
        v = sv0 + (ev - sv0) * f * 0.55
        y = max(at(u, v), b16['ground'])
        boxes.append(box(u, v, y, 2.2, 0.18, 0.5, STONE, r=math.degrees(math.atan2(ev - sv0, eu - su0)), assumed=True, tag='jigokudan'))
    return {
        'building': '1号棟', 'ghost': ['1号棟'],
        'center': [round(cu, 1), round(cv, 1)], 'floor': round(top, 1),
        'camera': {'u': round(tu + m2px(1.0), 1), 'v': round(cv, 1), 'y': round(top + 1.4, 1), 'dist': 15, 'el': 0.3, 'az': -1.55},
        'boxes': boxes,
        'text': {
            'en': 'Hashima Shrine on top of the rock, as it was reached from the Jigokudan stairway: through the torii, past the cenotaph, to the wooden worship hall and the small concrete inner shrine behind it. The inner shrine, the torii and the cenotaph are drawn from the 1992 photographs; the worship hall collapsed long ago and its size, and the exact line of the stairway, are assumptions drawn translucent.',
            'ja': '岩山の上の端島神社を、地獄段を上がってきた向きで見ています。鳥居をくぐり、慰霊碑の脇を通って、木造の拝殿、その奥にコンクリートの小さな本殿（祠）。祠・鳥居・慰霊碑は1992年の写真から描き、拝殿は早くに倒壊したため大きさが推定、地獄段の正確な位置も推定で、半透明にしています。',
            'ko': '지고쿠단 계단을 올라온 방향에서 본 바위산 위의 하시마 신사. 도리이를 지나 위령비 옆을 거쳐 목조 배전, 그 뒤에 작은 콘크리트 본전(사당). 사당·도리이·위령비는 1992년 사진으로 그렸고, 배전은 일찍 무너져 크기가 추정이며 계단의 정확한 위치도 추정이라 반투명입니다.',
            'zh-Hans': '从地狱段登上来的方向看岩山顶的端岛神社：穿过鸟居，经过慰灵碑，是木造拜殿，其后是小小的混凝土本殿（祠）。祠、鸟居、慰灵碑按1992年照片绘制；拜殿早已倒塌，尺寸为推定，台阶的确切位置也为推定，以半透明绘制。',
            'zh-Hant': '從地獄段登上來的方向看岩山頂的端島神社：穿過鳥居，經過慰靈碑，是木造拜殿，其後是小小的混凝土本殿（祠）。祠、鳥居、慰靈碑按1992年照片繪製；拜殿早已倒塌，尺寸為推定，台階的確切位置也為推定，以半透明繪製。',
        },
        'sources': [
            {'label': {'en': 'Hashima Shrine, 1992 photographs (Wikimedia Commons)', 'ja': '端島神社の1992年の写真（Wikimedia Commons）'}, 'url': 'https://commons.wikimedia.org/wiki/Category:Hashima-jinja_(Nagasaki)'},
            {'label': {'en': 'Gunkanjima Digital Museum: spots (Japanese)', 'ja': '軍艦島デジタルミュージアム おすすめスポット'}, 'url': 'https://www.gunkanjima-museum.jp/data/558/detail/'},
            {'label': {'en': 'Japanese Wikipedia: Hashima', 'ja': 'Wikipedia「端島 (長崎県)」'}, 'url': 'https://ja.wikipedia.org/wiki/端島_(長崎県)'},
        ],
    }


def main():
    model = json.loads((WEB / 'gunkanjima-model.json').read_text(encoding='utf-8'))
    at = terrain()
    scenes = {'no30': scene_no30(model), 'shrine': scene_shrine(model, at)}
    out = {'note': 'Box primitives in the 1962 crop frame (u, v px; y m above sea level; sizes in m). a=1 marks an assumption drawn translucent.', 'scenes': scenes}
    (WEB / 'gunkanjima-interiors.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    for k, sc in scenes.items():
        print(k, 'boxes', len(sc['boxes']), 'assumed', sum(1 for b in sc['boxes'] if b.get('a')))


if __name__ == '__main__':
    main()
