"""Fictional sign / poster / banner atlas for the cinema wings (render with Blender 4.5, Cycles, emission only).

    blender -b --factory-startup -P make-sign-atlas.py -- [--out tex/tw-signs.png] [--size 4096] [--samples 12]

Everything drawn here is invented: hall names, film titles, slogans and pictures are fictional (no real
studio, brand, trademark or person; no human figures, project rule v3). The typefaces are the Windows
Yu Mincho / Yu Gothic files, used only to rasterise the lettering into the texture.
The layout table SLOTS is also written as JSON next to the image; build-tower-wings.py reads it for UVs.

Atlas pixel frame: x right, y down, origin top-left, SIZE x SIZE.  UV = (x / SIZE, 1 - y / SIZE).
"""
import json
import math
import random
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default, cast=str):
    return cast(ARGV[ARGV.index(name) + 1]) if name in ARGV else default


OUT = Path(arg("--out", str(HERE / "tex" / "tw-signs.png")))
SIZE = arg("--size", 4096, int)
SAMPLES = arg("--samples", 12, int)
S = SIZE / 4096.0                     # layout authored at 4096
FONT_M = r"C:\Windows\Fonts\yumindb.ttf"
FONT_ML = r"C:\Windows\Fonts\yumin.ttf"
FONT_G = r"C:\Windows\Fonts\YuGothB.ttc"
R = random.Random(1912)

# ---------------------------------------------------------------------------------------------
# Slots (authored in 4096 px space).  Names are what the builder asks for.
# ---------------------------------------------------------------------------------------------
SLOTS = {}


def slot(name, x, y, w, h):
    SLOTS[name] = [x * S, y * S, w * S, h * S]


HALLS = [  # id, name, romaji, board style
    ("W1", "光雲館", "KŌUN-KWAN"),
    ("W2", "千鳥館", "CHIDORI-KWAN"),
    ("E1", "銀波館", "GINPA-KWAN"),
    ("E2", "鶴鳴座", "KAKUMEI-ZA"),
    ("E3", "月華館", "GEKKA-KWAN"),
]
for i, h in enumerate(HALLS):
    slot("name_" + h[0], (i % 2) * 2048, (i // 2) * 320, 2048, 320)
slot("band_A", 2048, 640, 2048, 320)                                  # a spare frieze band (「常設活動寫眞」)
for i in range(6):
    slot(f"board_{i}", (i % 3) * 1365, 960 + (i // 3) * 512, 1365, 512)
for i in range(20):
    slot(f"poster_{i}", (i % 10) * 384 + 128, 1984 + (i // 10) * 576, 384, 576)
slot("prog_0", 0, 1984, 128, 576)                                     # narrow programme strips (番組) beside posters
slot("prog_1", 0, 2560, 128, 576)
for i in range(10):
    slot(f"nobori_{i}", i * 192, 3136, 192, 960)
slot("kiosk_0", 1920, 3136, 704, 176)
slot("kiosk_1", 1920, 3312, 704, 176)
slot("kiosk_2", 1920, 3488, 704, 176)
slot("prog_board", 2624, 3136, 640, 704)
for i in range(5):
    slot(f"lantern_{i}", 3264 + (i % 3) * 272, 3136 + (i // 3) * 272, 272, 272)
slot("plate_0", 1920, 3664, 352, 176)                                 # small enamel-look plates (fictional)
slot("plate_1", 2272, 3664, 352, 176)
slot("sun", 1920, 3840, 256, 256)                                     # sunburst disc (painted)
slot("paper", 2176, 3840, 448, 256)                                   # blank paper / torn poster backs
slot("wood", 3264, 3680, 832, 416)                                    # plain painted board (for the back of boards)

# ---------------------------------------------------------------------------------------------
# Scene helpers: every element is a flat mesh at a z layer with an emission material
# ---------------------------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
MATS = {}
Z = [0.0]


def zi():
    Z[0] += 0.01
    return Z[0]


def mat(col, grain=0.10, stroke=(1.0, 6.0), key=None):
    """Emission with a painterly value noise (stroke = anisotropic scale x, y)."""
    k = (tuple(round(c, 3) for c in col), grain, stroke, key)
    if k in MATS:
        return MATS[k]
    m = bpy.data.materials.new("m%d" % len(MATS))
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    rgb = nt.nodes.new("ShaderNodeRGB")
    rgb.outputs[0].default_value = (*col, 1)
    if grain > 0:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (stroke[0] * 0.02, stroke[1] * 0.02, 1)
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = 1.0
        nz.inputs["Detail"].default_value = 6.0
        nt.links.new(tc.outputs["Object"], mp.inputs[0])
        nt.links.new(mp.outputs[0], nz.inputs["Vector"])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs[3].default_value = 1.0 - grain
        mr.inputs[4].default_value = 1.0 + grain
        nt.links.new(nz.outputs[0], mr.inputs[0])
        mul = nt.nodes.new("ShaderNodeMix")
        mul.data_type = "RGBA"
        mul.blend_type = "MULTIPLY"
        mul.inputs[0].default_value = 1.0
        nt.links.new(rgb.outputs[0], mul.inputs[6])
        comb = nt.nodes.new("ShaderNodeCombineXYZ")
        for i in range(3):
            nt.links.new(mr.outputs[0], comb.inputs[i])
        nt.links.new(comb.outputs[0], mul.inputs[7])
        nt.links.new(mul.outputs[2], em.inputs[0])
    else:
        nt.links.new(rgb.outputs[0], em.inputs[0])
    nt.links.new(em.outputs[0], out.inputs[0])
    MATS[k] = m
    return m


def grad_mat(c_top, c_bot, y_top, y_bot, grain=0.08):
    m = bpy.data.materials.new("g%d" % len(MATS))
    MATS[("g", len(MATS))] = m
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs[1].default_value = -y_top * S
    mr.inputs[2].default_value = -y_bot * S
    nt.links.new(sep.outputs[1], mr.inputs[0])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[6].default_value = (*c_top, 1)
    mix.inputs[7].default_value = (*c_bot, 1)
    nt.links.new(mr.outputs[0], mix.inputs[0])
    # brushy noise
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (0.004, 0.03, 1)
    nt.links.new(tc.outputs["Object"], mp.inputs[0])
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Detail"].default_value = 5.0
    nt.links.new(mp.outputs[0], nz.inputs["Vector"])
    r2 = nt.nodes.new("ShaderNodeMapRange")
    r2.inputs[3].default_value = 1 - grain
    r2.inputs[4].default_value = 1 + grain
    nt.links.new(nz.outputs[0], r2.inputs[0])
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs[0].default_value = 1.0
    nt.links.new(mix.outputs[2], mul.inputs[6])
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    for i in range(3):
        nt.links.new(r2.outputs[0], comb.inputs[i])
    nt.links.new(comb.outputs[0], mul.inputs[7])
    nt.links.new(mul.outputs[2], em.inputs[0])
    nt.links.new(em.outputs[0], out.inputs[0])
    return m


def mesh_obj(verts, faces, m):
    me = bpy.data.meshes.new("e")
    me.from_pydata(verts, [], faces)
    o = bpy.data.objects.new("e", me)
    sc.collection.objects.link(o)
    me.materials.append(m)
    return o


def P(x, y):
    return (x * S, -y * S)


def poly(pts, col, z=None, m=None, **kw):
    z = zi() if z is None else z
    v = [(*P(x, y), z) for x, y in pts]
    return mesh_obj(v, [tuple(range(len(v)))], m or mat(col, **kw))


def rect(x0, y0, x1, y1, col, **kw):
    return poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], col, **kw)


def circle(cx, cy, r, col, n=48, a0=0.0, a1=2 * math.pi, **kw):
    pts = [(cx + r * math.cos(a0 + (a1 - a0) * k / n), cy - r * math.sin(a0 + (a1 - a0) * k / n)) for k in range(n + 1)]
    if a1 - a0 < 2 * math.pi - 1e-6:
        pts = [(cx, cy)] + pts
    return poly(pts, col, **kw)


def ring(cx, cy, r0, r1, col, n=48, **kw):
    z = zi()
    v, f = [], []
    for k in range(n):
        a = 2 * math.pi * k / n
        v.append((*P(cx + r0 * math.cos(a), cy - r0 * math.sin(a)), z))
        v.append((*P(cx + r1 * math.cos(a), cy - r1 * math.sin(a)), z))
    for k in range(n):
        a, b = 2 * k, 2 * ((k + 1) % n)
        f.append((a, b, b + 1, a + 1))
    return mesh_obj(v, f, mat(col, **kw))


def frame(x0, y0, x1, y1, t, col, **kw):
    rect(x0, y0, x1, y0 + t, col, **kw)
    rect(x0, y1 - t, x1, y1, col, **kw)
    rect(x0, y0, x0 + t, y1, col, **kw)
    rect(x1 - t, y0, x1, y1, col, **kw)


FONTS = {}


def font(path):
    if path not in FONTS:
        FONTS[path] = bpy.data.fonts.load(path)
    return FONTS[path]


def text(s, x, y, size, col, fnt=FONT_M, align="CENTER", spacing=1.0, width=None, **kw):
    """Horizontal text; (x, y) = anchor at the baseline-centre (align CENTER) in px."""
    cu = bpy.data.curves.new("t", "FONT")
    cu.body = s
    cu.font = font(fnt)
    cu.size = size * S
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.space_character = spacing
    o = bpy.data.objects.new("t", cu)
    sc.collection.objects.link(o)
    o.location = (*P(x, y), zi())
    cu.materials.append(mat(col, **kw) if "m" not in kw else kw["m"])
    if width:
        bpy.context.view_layer.update()
        dw = o.dimensions.x / S
        if dw > width:
            o.scale = (width / dw, 1, 1)
    return o


def vtext(s, x, y0, y1, size, col, fnt=FONT_M, **kw):
    """Vertical (top-to-bottom) column of characters centred on x, spread between y0 and y1."""
    n = len(s)
    step = (y1 - y0) / max(n, 1)
    for i, ch in enumerate(s):
        text(ch, x, y0 + step * (i + 0.5), min(size, step * 0.98), col, fnt=fnt, **kw)


def hexc(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


# palette (sRGB hex -> linear), period sign-painter colours (estimated)
C = {k: hexc(v) for k, v in dict(
    black="#1c1814", lacquer="#241510", gold="#d9a441", cream="#efe3c4", white="#f4efe2", red="#b8322a", vermil="#d4502c",
    indigo="#233a63", navy="#1b2a44", green="#2f5a3a", teal="#2f6a6a", yellow="#e2b73c", ochre="#c68a2e", pink="#dc8f9c",
    purple="#5a3d73", brown="#5a3a22", sky1="#f0c28a", sky2="#7fa0bf", sea="#2b4f6e", grey="#7c7a74", dgrey="#3b3935",
    orange="#e07a2c", moon="#f6e7b0", night="#172238", leaf="#3d6b35", snow="#e8eef0", rust="#8a3b22", sand="#d8c08a",
).items()}


# ---------------------------------------------------------------------------------------------
# 1. Hall name boards (5) + a frieze band
# ---------------------------------------------------------------------------------------------
BOARD_STYLE = {
    "W1": ("lacquer", "gold", "red"),
    "W2": ("cream", "green", "red"),
    "E1": ("navy", "white", "gold"),
    "E2": ("black", "gold", "vermil"),
    "E3": ("white", "red", "indigo"),
}
for hid, name, rom in HALLS:
    x, y, w, h = [v / S for v in SLOTS["name_" + hid]]
    bg, fg, acc = BOARD_STYLE[hid]
    rect(x, y, x + w, y + h, C[bg], grain=0.07)
    frame(x + 10, y + 10, x + w - 10, y + h - 10, 14, C[acc], grain=0.05)
    frame(x + 32, y + 32, x + w - 32, y + h - 32, 4, C[fg], grain=0.05)
    # corner fans
    for cx, cy in ((x + 32, y + 32), (x + w - 32, y + 32), (x + 32, y + h - 32), (x + w - 32, y + h - 32)):
        circle(cx, cy, 30, C[acc], n=20)
        circle(cx, cy, 14, C[fg], n=16)
    text(name, x + w / 2, y + h * 0.43, 190, C[fg], spacing=1.35)
    text(rom, x + w / 2, y + h * 0.84, 36, C[fg], fnt=FONT_G, spacing=1.6)
    for side, (a, b) in ((-1, ("常設", "活動")), (1, ("寫眞", "興行"))):
        text(a, x + w / 2 + side * 760, y + h * 0.35, 58, C[acc])
        text(b, x + w / 2 + side * 760, y + h * 0.62, 58, C[acc])
x, y, w, h = [v / S for v in SLOTS["band_A"]]
rect(x, y, x + w, y + h, C["red"], grain=0.08)
frame(x + 12, y + 12, x + w - 12, y + h - 12, 10, C["gold"])
text("常設活動大寫眞", x + w / 2, y + h * 0.5, 170, C["white"], spacing=1.4)

# ---------------------------------------------------------------------------------------------
# 2. Painted boards (絵看板): six invented scenes, no figures
# ---------------------------------------------------------------------------------------------
BOARDS = [("怒濤の汽船", "sea_ship"), ("鐵橋の急行", "train"), ("月下の古城", "castle"),
          ("空中大飛行", "airship"), ("火山大噴火", "volcano"), ("天然色　瀧の景", "falls")]


def waves(x0, x1, ybase, amp, wl, col, ybot, ph=0.0, n=80):
    pts = [(x0, ybot)]
    for k in range(n + 1):
        xx = x0 + (x1 - x0) * k / n
        pts.append((xx, ybase + amp * math.sin((xx / wl) * 2 * math.pi + ph)))
    pts.append((x1, ybot))
    poly(pts, col, grain=0.14, stroke=(3.0, 12.0))


def scene_board(i, title, kind):
    x, y, w, h = [v / S for v in SLOTS[f"board_{i}"]]
    ix0, iy0, ix1, iy1 = x + 24, y + 24, x + w - 24, y + h - 24
    band = 92
    py0 = iy0 + band
    if kind in ("castle", "volcano"):
        top, bot = C["night"], C["indigo"] if kind == "castle" else C["rust"]
    elif kind == "sea_ship":
        top, bot = C["dgrey"], C["sky2"]
    else:
        top, bot = C["sky2"], C["sky1"]
    poly([(ix0, py0), (ix1, py0), (ix1, iy1), (ix0, iy1)], None, m=grad_mat(top, bot, py0, iy1))
    W, H = ix1 - ix0, iy1 - py0
    if kind == "sea_ship":
        waves(ix0, ix1, py0 + H * 0.62, 12, 140, C["sea"], iy1, 0.0)
        waves(ix0, ix1, py0 + H * 0.75, 18, 110, C["navy"], iy1, 1.3)
        cx = ix0 + W * 0.45
        base_y = py0 + H * 0.64
        poly([(cx - 300, base_y - 40), (cx + 330, base_y - 40), (cx + 270, base_y + 30), (cx - 250, base_y + 30)], C["black"])
        rect(cx - 220, base_y - 95, cx + 180, base_y - 40, C["cream"])
        for k in range(8):
            rect(cx - 200 + k * 46, base_y - 80, cx - 186 + k * 46, base_y - 60, C["dgrey"])
        for fx in (cx - 80, cx + 40):
            rect(fx, base_y - 210, fx + 48, base_y - 95, C["red"])
            rect(fx, base_y - 215, fx + 48, base_y - 195, C["black"])
            for k in range(5):
                circle(fx + 24 - k * 60, max(py0 + 45, base_y - 240 + k * 12), 30 + k * 6, C["grey"], n=20, grain=0.2)
        for k in range(6):
            waves(ix0 + k * 60, ix0 + k * 60 + 160, py0 + H * (0.8 + 0.03 * k), 5, 40, C["white"], py0 + H * (0.8 + 0.03 * k) + 7, k)
    elif kind == "train":
        poly([(ix0, py0 + H * 0.55), (ix0 + W * 0.3, py0 + H * 0.3), (ix0 + W * 0.55, py0 + H * 0.5), (ix0 + W * 0.8, py0 + H * 0.28),
              (ix1, py0 + H * 0.45), (ix1, iy1), (ix0, iy1)], C["leaf"], grain=0.15)
        waves(ix0, ix1, py0 + H * 0.84, 4, 90, C["sea"], iy1)
        by = py0 + H * 0.6
        rect(ix0, by, ix1, by + 16, C["black"])
        for k in range(10):
            bx = ix0 + k * W / 9.0
            poly([(bx, by + 16), (bx + W / 18, by + 110), (bx + W / 9, by + 16)], C["black"])
            rect(bx - 4, by + 16, bx + 4, iy1, C["dgrey"])
        tx = ix0 + W * 0.28
        rect(tx, by - 90, tx + 170, by - 8, C["black"])
        rect(tx + 120, by - 140, tx + 170, by - 60, C["black"])
        rect(tx + 20, by - 130, tx + 50, by - 90, C["black"])
        for k in range(4):
            circle(tx + 25 + k * 40, by - 12, 18, C["red"], n=16)
        for c in range(4):
            rect(tx + 190 + c * 150, by - 80, tx + 330 + c * 150, by - 10, C["brown"])
            for k in range(4):
                rect(tx + 200 + c * 150 + k * 32, by - 70, tx + 220 + c * 150 + k * 32, by - 50, C["yellow"])
        for k in range(6):
            circle(tx + 35 - k * 50, by - 160 - k * 15, 30 + k * 8, C["white"], n=18, grain=0.25)
    elif kind == "castle":
        circle(ix0 + W * 0.78, py0 + H * 0.25, 60, C["moon"], n=40, grain=0.04)
        poly([(ix0, iy1), (ix0, py0 + H * 0.7), (ix0 + W * 0.35, py0 + H * 0.62), (ix0 + W * 0.7, py0 + H * 0.74), (ix1, py0 + H * 0.66), (ix1, iy1)], C["black"])
        cx = ix0 + W * 0.42
        cy = py0 + H * 0.62
        for k, (ww, hh) in enumerate(((300, 70), (230, 60), (160, 55), (90, 50))):
            yy = cy - sum(v[1] for v in ((300, 70), (230, 60), (160, 55), (90, 50))[:k]) - 20 * k
            rect(cx - ww / 2, yy - hh, cx + ww / 2, yy, C["dgrey"])
            poly([(cx - ww / 2 - 40, yy - hh), (cx + ww / 2 + 40, yy - hh), (cx + ww / 2 - 10, yy - hh - 22), (cx - ww / 2 + 10, yy - hh - 22)], C["black"])
            for j in range(max(1, ww // 60)):
                rect(cx - ww / 2 + 20 + j * 60, yy - hh + 20, cx - ww / 2 + 34 + j * 60, yy - hh + 40, C["yellow"])
        waves(ix0, ix1, py0 + H * 0.9, 3, 70, C["navy"], iy1)
        for k in range(40):
            circle(ix0 + R.uniform(0, W), py0 + R.uniform(0, H * 0.45), R.uniform(1.5, 3.5), C["white"], n=6, grain=0)
    elif kind == "airship":
        poly([(ix0, iy1), (ix0, py0 + H * 0.72), (ix0 + W * 0.2, py0 + H * 0.5), (ix0 + W * 0.4, py0 + H * 0.66), (ix0 + W * 0.6, py0 + H * 0.45),
              (ix0 + W * 0.85, py0 + H * 0.68), (ix1, py0 + H * 0.6), (ix1, iy1)], C["grey"], grain=0.15)
        poly([(ix0 + W * 0.53, py0 + H * 0.52), (ix0 + W * 0.6, py0 + H * 0.45), (ix0 + W * 0.66, py0 + H * 0.53)], C["snow"])
        cx, cy = ix0 + W * 0.42, py0 + H * 0.3
        pts = [(cx + 330 * math.cos(a), cy + 70 * math.sin(a)) for a in [2 * math.pi * k / 40 for k in range(40)]]
        poly(pts, C["cream"], grain=0.06)
        pts = [(cx + 330 * math.cos(a), cy + 70 * math.sin(a) + 8) for a in [math.pi * k / 20 for k in range(21)]]
        poly(pts, C["sand"])
        rect(cx - 60, cy + 90, cx + 80, cy + 120, C["brown"])
        for dx in (-50, 70):
            rect(cx + dx, cy + 60, cx + dx + 3, cy + 92, C["black"])
        poly([(cx + 320, cy), (cx + 390, cy - 60), (cx + 390, cy + 60)], C["red"])
        for k in range(12):
            circle(ix0 + R.uniform(0, W), py0 + R.uniform(0, H * 0.3), R.uniform(30, 70), C["white"], n=18, grain=0.25)
    elif kind == "volcano":
        poly([(ix0, iy1), (ix0 + W * 0.25, py0 + H * 0.35), (ix0 + W * 0.35, py0 + H * 0.3), (ix0 + W * 0.6, iy1)], C["black"])
        poly([(ix0 + W * 0.26, py0 + H * 0.36), (ix0 + W * 0.34, py0 + H * 0.31), (ix0 + W * 0.3, py0 + H * 0.6)], C["orange"])
        for k in range(10):
            circle(ix0 + W * (0.3 + 0.06 * k), max(py0 + 70, py0 + H * 0.3 - 22 * k), 40 + 6 * k, C["dgrey"] if k % 2 else C["grey"], n=20, grain=0.25)
        for k in range(14):
            circle(ix0 + W * 0.3 + R.uniform(-160, 160), py0 + H * 0.28 - R.uniform(0, 120), R.uniform(5, 12), C["yellow"], n=8)
        waves(ix0 + W * 0.55, ix1, py0 + H * 0.8, 6, 80, C["sea"], iy1)
    elif kind == "falls":
        poly([(ix0, py0), (ix0 + W * 0.42, py0), (ix0 + W * 0.46, iy1), (ix0, iy1)], C["dgrey"], grain=0.2)
        poly([(ix0 + W * 0.58, py0), (ix1, py0), (ix1, iy1), (ix0 + W * 0.54, iy1)], C["brown"], grain=0.2)
        rect(ix0 + W * 0.42, py0, ix0 + W * 0.58, iy1, C["snow"], grain=0.25, stroke=(10.0, 0.6))
        for k in range(7):
            rect(ix0 + W * (0.43 + 0.02 * k), py0, ix0 + W * (0.435 + 0.02 * k), iy1, C["sky2"], grain=0.2)
        for k in range(18):
            circle(ix0 + R.uniform(0, W * 0.4), py0 + R.uniform(0, H), R.uniform(20, 45), C["leaf"], n=12, grain=0.25)
            circle(ix0 + W * 0.6 + R.uniform(0, W * 0.4), py0 + R.uniform(0, H), R.uniform(20, 45), C["green"], n=12, grain=0.25)
        waves(ix0, ix1, py0 + H * 0.88, 5, 60, C["white"], iy1)
    # title band + frame
    rect(ix0, iy0, ix1, py0, C["cream"], grain=0.06)
    text(title, (ix0 + ix1) / 2, (iy0 + py0) / 2, 70, C["red"] if i % 2 else C["indigo"], spacing=1.25)
    frame(x, y, x + w, y + h, 24, C["black"], grain=0.05)


for i, (t, k) in enumerate(BOARDS):
    scene_board(i, t, k)

# ---------------------------------------------------------------------------------------------
# 3. Posters (20): invented titles, flat period colours, geometric pictures
# ---------------------------------------------------------------------------------------------
POSTERS = [
    ("海底旅行", "實寫", "sea", "sea", "cream"), ("怪盜黑蝙蝠", "探偵", "night", "moon", "white"),
    ("雪嶺の孤狼", "冒險", "sky2", "mount", "indigo"), ("紅椿", "新派悲劇", "cream", "flower", "red"),
    ("港の灯", "人情劇", "navy", "harbour", "yellow"), ("汽車大競爭", "滑稽", "yellow", "wheel", "black"),
    ("滑稽自轉車", "喜劇", "pink", "wheel", "black"), ("帽子の行方", "喜劇", "cream", "hat", "red"),
    ("瀧と溪谷", "天然色實寫", "leaf", "mount", "white"), ("夜の鍵", "探偵", "black", "key", "gold"),
    ("月の涙", "悲劇", "indigo", "moon", "cream"), ("氷の國", "冒險實寫", "snow", "mount", "navy"),
    ("夕霧", "新派", "purple", "moon", "cream"), ("消える箱", "大魔術", "red", "box", "yellow"),
    ("帆船の旅", "實況", "sky2", "sail", "navy"), ("花の庭", "天然色", "cream", "flower", "green"),
    ("象と虎", "猛獸實寫", "ochre", "sun", "black"), ("星の海峽", "冒險", "night", "sail", "yellow"),
    ("鐵橋", "活劇", "grey", "bridge", "red"), ("風車の村", "實寫", "sky1", "mill", "brown"),
]


def poster(i, title, genre, bgk, pic, fgk):
    x, y, w, h = [v / S for v in SLOTS[f"poster_{i}"]]
    bg, fg = C[bgk], C[fgk]
    rect(x, y, x + w, y + h, C["paper"] if False else C["cream"], grain=0.05)
    m = 14
    rect(x + m, y + m, x + w - m, y + h - m, bg, grain=0.1)
    cx, cy = x + w / 2, y + h * 0.47
    acc = C["red"] if bgk not in ("red", "pink") else C["black"]
    if pic == "sea":
        waves(x + m, x + w - m, cy + 40, 10, 60, C["navy"], y + h - 150)
        circle(cx, cy - 40, 50, C["yellow"], n=24)
    elif pic in ("moon",):
        circle(cx + 40, cy - 60, 70, C["moon"], n=32)
        circle(cx + 70, cy - 80, 62, bg, n=32)
        poly([(x + m, cy + 90), (cx - 40, cy + 20), (cx + 60, cy + 70), (x + w - m, cy + 30), (x + w - m, y + h - 150), (x + m, y + h - 150)], C["black"])
    elif pic == "mount":
        poly([(x + m, cy + 100), (cx - 30, cy - 90), (cx + 20, cy - 40), (cx + 80, cy - 110), (x + w - m, cy + 100)], fg)
        poly([(cx - 60, cy - 35), (cx - 30, cy - 90), (cx - 5, cy - 45)], C["white"])
    elif pic == "flower":
        for k in range(5):
            a = 2 * math.pi * k / 5
            circle(cx + 42 * math.cos(a), cy - 30 + 42 * math.sin(a), 36, C["red"] if bgk != "red" else C["white"], n=20)
        circle(cx, cy - 30, 22, C["yellow"], n=16)
        rect(cx - 4, cy + 10, cx + 4, cy + 120, C["green"])
    elif pic == "harbour":
        waves(x + m, x + w - m, cy + 60, 6, 40, C["black"], y + h - 150)
        rect(cx - 10, cy - 100, cx + 10, cy + 60, C["cream"])
        circle(cx, cy - 110, 26, fg, n=20)
        for k in range(5):
            rect(cx - 90 + k * 40, cy + 70 + 8 * (k % 2), cx - 70 + k * 40, cy + 74 + 8 * (k % 2), fg)
    elif pic == "wheel":
        for dx in (-70, 70):
            ring(cx + dx, cy + 20, 52, 60, C["black"] if bgk != "black" else C["white"], n=32)
            for k in range(8):
                a = math.pi * k / 8
                poly([(cx + dx + 52 * math.cos(a), cy + 20 - 52 * math.sin(a)), (cx + dx - 52 * math.cos(a), cy + 20 + 52 * math.sin(a)),
                      (cx + dx - 52 * math.cos(a) + 2, cy + 20 + 52 * math.sin(a) + 2)], C["dgrey"])
        poly([(cx - 70, cy + 20), (cx, cy - 50), (cx + 70, cy + 20), (cx + 10, cy + 20)], acc)
    elif pic == "hat":
        rect(cx - 90, cy + 10, cx + 90, cy + 26, C["black"])
        rect(cx - 55, cy - 90, cx + 55, cy + 12, C["black"])
        rect(cx - 55, cy - 20, cx + 55, cy - 4, C["red"])
        for k in range(4):
            circle(cx - 100 + k * 60, cy + 90, 8, acc, n=10)
    elif pic == "key":
        ring(cx - 50, cy - 20, 30, 46, fg, n=32)
        rect(cx - 6, cy - 28, cx + 110, cy - 12, fg)
        rect(cx + 70, cy - 12, cx + 84, cy + 20, fg)
        rect(cx + 94, cy - 12, cx + 108, cy + 14, fg)
    elif pic == "box":
        poly([(cx - 80, cy - 20), (cx + 40, cy - 20), (cx + 80, cy - 60), (cx - 40, cy - 60)], C["black"])
        rect(cx - 80, cy - 20, cx + 40, cy + 80, C["dgrey"])
        poly([(cx + 40, cy - 20), (cx + 80, cy - 60), (cx + 80, cy + 40), (cx + 40, cy + 80)], C["black"])
        for k in range(10):
            a = 2 * math.pi * k / 10
            poly([(cx - 20, cy + 30), (cx - 20 + 160 * math.cos(a), cy + 30 + 160 * math.sin(a)), (cx - 20 + 160 * math.cos(a + 0.12), cy + 30 + 160 * math.sin(a + 0.12))], C["yellow"])
    elif pic == "sail":
        waves(x + m, x + w - m, cy + 60, 8, 50, C["navy"], y + h - 150)
        poly([(cx - 90, cy + 50), (cx + 90, cy + 50), (cx + 60, cy + 80), (cx - 60, cy + 80)], C["brown"])
        poly([(cx - 5, cy - 110), (cx - 5, cy + 40), (cx - 90, cy + 40)], C["cream"])
        poly([(cx + 5, cy - 90), (cx + 5, cy + 40), (cx + 80, cy + 40)], C["white"])
    elif pic == "sun":
        for k in range(16):
            a = 2 * math.pi * k / 16
            poly([(cx, cy - 20), (cx + 160 * math.cos(a), cy - 20 + 160 * math.sin(a)), (cx + 160 * math.cos(a + 0.2), cy - 20 + 160 * math.sin(a + 0.2))], C["yellow"])
        circle(cx, cy - 20, 60, C["red"], n=32)
    elif pic == "bridge":
        rect(x + m, cy + 20, x + w - m, cy + 36, C["black"])
        for k in range(6):
            bx = x + m + k * (w - 2 * m) / 5
            poly([(bx, cy + 36), (bx + 25, cy + 110), (bx + 50, cy + 36)], C["black"])
        rect(cx - 70, cy - 30, cx + 40, cy + 18, C["black"])
        rect(cx + 20, cy - 60, cx + 40, cy - 30, C["black"])
    elif pic == "mill":
        rect(cx - 30, cy - 40, cx + 30, cy + 110, C["brown"])
        for k in range(4):
            a = math.pi / 4 + math.pi / 2 * k
            poly([(cx, cy - 40), (cx + 130 * math.cos(a) - 14 * math.sin(a), cy - 40 + 130 * math.sin(a) + 14 * math.cos(a)),
                  (cx + 130 * math.cos(a) + 14 * math.sin(a), cy - 40 + 130 * math.sin(a) - 14 * math.cos(a))], C["cream"])
    # title block: vertical title at the right, genre at the top, a slogan strip at the bottom
    rect(x + m, y + m, x + w - m, y + m + 58, fg, grain=0.06)
    text(genre, x + w / 2, y + m + 29, 38, bg if bgk not in ("cream", "snow", "sky1", "yellow") else C["red"], spacing=1.2, width=w - 2 * m - 20)
    band_y = y + h - 150
    rect(x + m, band_y, x + w - m, y + h - m, C["cream"] if bgk not in ("cream",) else C["black"], grain=0.06)
    tcol = C["red"] if bgk not in ("cream",) else C["cream"]
    text(title, x + w / 2, band_y + 60, 70 if len(title) <= 4 else 56, tcol, spacing=1.1, width=w - 2 * m - 16)
    text("近日封切　大好評", x + w / 2, band_y + 112, 26, C["black"] if bgk not in ("cream",) else C["white"], spacing=1.3)
    frame(x + m, y + m, x + w - m, y + h - m, 5, fg, grain=0.03)


for i, p in enumerate(POSTERS):
    poster(i, *p)

# programme strips (番組) and the big programme board: fictional lists
for k in ("prog_0", "prog_1"):
    x, y, w, h = [v / S for v in SLOTS[k]]
    rect(x, y, x + w, y + h, C["white"], grain=0.05)
    frame(x + 6, y + 6, x + w - 6, y + h - 6, 5, C["black"])
    vtext("番組" + ("一" if k == "prog_0" else "二"), x + w / 2, y + 20, y + 180, 44, C["red"])
    vtext("喜劇　海底旅行" if k == "prog_0" else "實寫　瀧と溪谷", x + w / 2, y + 200, y + h - 20, 40, C["black"])
x, y, w, h = [v / S for v in SLOTS["prog_board"]]
rect(x, y, x + w, y + h, C["white"], grain=0.05)
frame(x + 10, y + 10, x + w - 10, y + h - 10, 12, C["black"])
rect(x + 22, y + 22, x + w - 22, y + 110, C["red"])
text("本週番組", x + w / 2, y + 66, 64, C["white"], spacing=1.5)
lines = ["一、實寫　帆船の旅", "一、喜劇　帽子の行方", "一、新派　夕霧", "一、探偵　夜の鍵", "一、冒險　雪嶺の孤狼", "一、天然色　花の庭"]
for i, ln in enumerate(lines):
    xx = x + w - 80 - i * 92
    vtext(ln, xx, y + 140, y + h - 40, 50, C["black"], fnt=FONT_ML)

# ---------------------------------------------------------------------------------------------
# 4. Nobori banners (10)
# ---------------------------------------------------------------------------------------------
NOBORI = [("大活動寫眞", "red", "white"), ("新版封切", "indigo", "white"), ("連續大寫眞", "white", "red"), ("本日大入", "yellow", "red"),
          ("天然色寫眞", "green", "white"), ("喜劇大會", "pink", "indigo"), ("實寫大會", "purple", "white"), ("特別興行", "vermil", "white"),
          ("新着大寫眞", "teal", "white"), ("滑稽大寫眞", "white", "indigo")]
for i, (s, bgk, fgk) in enumerate(NOBORI):
    x, y, w, h = [v / S for v in SLOTS[f"nobori_{i}"]]
    rect(x, y, x + w, y + h, C[bgk], grain=0.12, stroke=(2.0, 8.0))
    rect(x, y, x + w, y + 70, C[fgk], grain=0.08)                     # top band (the 乳 side is modelled)
    circle(x + w / 2, y + 35, 22, C[bgk], n=20)
    vtext(s, x + w / 2, y + 100, y + h - 150, 150, C[fgk], spacing=1.0)
    hall = HALLS[i % 5][1]
    rect(x + 14, y + h - 140, x + w - 14, y + h - 12, C[fgk], grain=0.05)
    vtext(hall, x + w / 2, y + h - 136, y + h - 16, 40, C[bgk])

# kiosk plates, lantern prints, small plates, sunburst disc, paper, plain board
for k, s, bgk, fgk in (("kiosk_0", "切符賣場", "black", "gold"), ("kiosk_1", "入場券", "white", "red"), ("kiosk_2", "切符", "navy", "white")):
    x, y, w, h = [v / S for v in SLOTS[k]]
    rect(x, y, x + w, y + h, C[bgk], grain=0.06)
    frame(x + 8, y + 8, x + w - 8, y + h - 8, 6, C[fgk])
    text(s, x + w / 2, y + h / 2, 104, C[fgk], spacing=1.4)
for i, ch in enumerate(["光", "千", "銀", "鶴", "月"]):
    x, y, w, h = [v / S for v in SLOTS[f"lantern_{i}"]]
    rect(x, y, x + w, y + h, C["white"], grain=0.05)
    ring(x + w / 2, y + h / 2, 96, 110, C["red"] if i % 2 == 0 else C["black"], n=40)
    text(ch, x + w / 2, y + h / 2, 150, C["red"] if i % 2 == 0 else C["black"])
for k, s in (("plate_0", "非常口"), ("plate_1", "禁煙")):
    x, y, w, h = [v / S for v in SLOTS[k]]
    rect(x, y, x + w, y + h, C["navy"], grain=0.03)
    frame(x + 10, y + 10, x + w - 10, y + h - 10, 5, C["white"])
    text(s, x + w / 2, y + h / 2, 84, C["white"], spacing=1.2)
x, y, w, h = [v / S for v in SLOTS["sun"]]
rect(x, y, x + w, y + h, C["cream"], grain=0.05)
for k in range(24):
    a = 2 * math.pi * k / 24
    if k % 2 == 0:
        poly([(x + w / 2, y + h / 2), (x + w / 2 + 126 * math.cos(a), y + h / 2 + 126 * math.sin(a)),
              (x + w / 2 + 126 * math.cos(a + 2 * math.pi / 24), y + h / 2 + 126 * math.sin(a + 2 * math.pi / 24))], C["ochre"])
circle(x + w / 2, y + h / 2, 44, C["gold"], n=32)
x, y, w, h = [v / S for v in SLOTS["paper"]]
rect(x, y, x + w, y + h, C["cream"], grain=0.12, stroke=(8.0, 8.0))
x, y, w, h = [v / S for v in SLOTS["wood"]]
rect(x, y, x + w, y + h, C["brown"], grain=0.2, stroke=(0.6, 14.0))

# ---------------------------------------------------------------------------------------------
# Render (orthographic, emission only) and post-process (paper fibre, fade, stains)
# ---------------------------------------------------------------------------------------------
cam_d = bpy.data.cameras.new("c")
cam_d.type = "ORTHO"
cam_d.ortho_scale = SIZE
cam = bpy.data.objects.new("c", cam_d)
sc.collection.objects.link(cam)
cam.location = (SIZE / 2, -SIZE / 2, 50)
sc.camera = cam
sc.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == "OPTIX"
    sc.cycles.device = "GPU"
except Exception:
    pass
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = False
sc.cycles.max_bounces = 0
sc.render.resolution_x = sc.render.resolution_y = SIZE
sc.render.film_transparent = False
sc.view_settings.view_transform = "Standard"
sc.view_settings.look = "None"
sc.world = bpy.data.worlds.new("w")
sc.world.use_nodes = True
sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.02, 0.018, 0.015, 1)
tmp = OUT.with_name("_raw.png")
OUT.parent.mkdir(parents=True, exist_ok=True)
sc.render.filepath = str(tmp)
sc.render.image_settings.file_format = "PNG"
bpy.ops.render.render(write_still=True)

im = bpy.data.images.load(str(tmp))
W_, H_ = im.size
px = np.array(im.pixels[:], dtype=np.float32).reshape(H_, W_, 4)[:, :, :3]
rng = np.random.default_rng(1912)
# paper/board fibre: fine noise + a coarse blotch field; sun fade (towards cream) and faint stains
fine = rng.normal(0, 0.018, (H_, W_, 1)).astype(np.float32)
coarse = rng.normal(0, 1, (H_ // 64 + 2, W_ // 64 + 2)).astype(np.float32)
coarse = np.kron(coarse, np.ones((64, 64), dtype=np.float32))[:H_, :W_]
# cheap blur of the coarse field
for _ in range(3):
    coarse = (coarse + np.roll(coarse, 32, 0) + np.roll(coarse, -32, 0) + np.roll(coarse, 32, 1) + np.roll(coarse, -32, 1)) / 5
coarse = coarse[:, :, None]
px = px * (1 + fine) * (1 + 0.035 * coarse)
fade = np.clip(0.10 + 0.05 * coarse, 0, 0.3)
px = px * (1 - fade) + np.array([0.80, 0.72, 0.55], dtype=np.float32) * fade * px.mean(axis=2, keepdims=True) * 1.2 + 0.0 * fade
# edge darkening per 32 px block boundary is avoided; clamp
px = np.clip(px, 0, 1)
out = np.concatenate([px, np.ones((H_, W_, 1), dtype=np.float32)], axis=2)
im2 = bpy.data.images.new("atlas", W_, H_, alpha=False)
im2.pixels = out.ravel()
im2.filepath_raw = str(OUT)
im2.file_format = "PNG"
im2.save()
tmp.unlink(missing_ok=True)
meta = {"size": SIZE, "image": OUT.name, "frame": "px, origin top-left; uv = (x/size, 1 - y/size)",
        "slots": SLOTS, "note": "All names, titles and pictures are fictional (no real studios, brands or people)."}
OUT.with_suffix(".json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
print("atlas written", OUT, W_, H_)
