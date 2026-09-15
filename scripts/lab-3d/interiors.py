"""Interior scenes for the viewer (v6): parts that stand inside or on a building while the building's
own shell is drawn as a ghost. Each part is a box, a cylinder (p='cyl'), a rock (p='rock') or a ball
(p='ball'): position in the 1962 crop frame (u, v in pixels; y in metres above sea level), size in
metres, colour, rotation about the vertical axis (degrees), a material kind k (see KIND), a seed sd
for the procedural surface, and an `assumed` flag for parts that no source documents and that are
drawn translucent.

    python interiors.py  ->  web/gunkanjima-interiors.json

Sources are listed per scene (`sources`) and summarised in interiors_facts_v6.md. Documented parts
are drawn solid; furniture and fittings that are only typical of the period are assumptions.
"""
import json
import math
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
WEB = HERE / 'web'
MPP = 0.805  # metres per crop pixel
ROT = -math.atan2(0.5517, 0.834)  # the viewer turns the model so that north is up

# material kinds understood by the viewer's box shader
KIND = dict(flat=0, tatami=1, wood=2, concrete=3, rock=4, tile=5, metal=6, paper=7, glass=8, cloth=9, leaf=10, wall=11, water=12, soil=13)

CONCRETE = [0.72, 0.70, 0.66]
CONCRETE_DARK = [0.55, 0.53, 0.50]
TATAMI = [0.66, 0.62, 0.40]
TATAMI_OLD = [0.60, 0.55, 0.36]
WOOD = [0.45, 0.33, 0.22]
WOOD_LIGHT = [0.68, 0.54, 0.36]
WOOD_PALE = [0.78, 0.68, 0.50]
STONE = [0.60, 0.60, 0.58]
IRON = [0.30, 0.30, 0.32]
IRON_PALE = [0.62, 0.64, 0.66]
PAPER = [0.92, 0.90, 0.82]
PLASTER = [0.86, 0.84, 0.78]
PLASTER_GREEN = [0.72, 0.80, 0.70]
TILE_WHITE = [0.90, 0.92, 0.90]
TILE_BLUE = [0.55, 0.70, 0.74]
WATER = [0.40, 0.62, 0.70]
GLASS = [0.62, 0.72, 0.78]
CLOTH_INDIGO = [0.25, 0.30, 0.48]
CLOTH_CREAM = [0.90, 0.86, 0.74]
CLOTH_RED = [0.70, 0.30, 0.28]
CLOTH_WHITE = [0.94, 0.94, 0.92]
LEAF = [0.32, 0.48, 0.22]
LEAF_DARK = [0.22, 0.36, 0.16]
SOIL = [0.42, 0.32, 0.22]
ROCK = [0.50, 0.47, 0.42]
ENAMEL = [0.92, 0.92, 0.90]
RUST = [0.45, 0.28, 0.18]
BLACKBOARD = [0.12, 0.28, 0.24]
PTILE = [0.62, 0.64, 0.60]
BRASS = [0.72, 0.60, 0.32]
CERAMIC = [0.88, 0.86, 0.80]
CERAMIC_DARK = [0.30, 0.24, 0.20]


def part(u, v, y, sx, sy, sz, c, r=0.0, assumed=False, tag=None, k=0, p=None, sd=0):
    b = {'u': round(u, 2), 'v': round(v, 2), 'y': round(y, 2), 's': [round(sx, 3), round(sy, 3), round(sz, 3)], 'c': c}
    if r:
        b['r'] = round(r, 1)
    if assumed:
        b['a'] = 1
    if tag:
        b['t'] = tag
    if k:
        b['k'] = k
    if p:
        b['p'] = p
    if sd:
        b['sd'] = sd
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


def building(model, name):
    return next(x for x in model['buildings'] if x['name'] == name)


def axis(poly):
    """Centroid and the direction (degrees, crop frame) of the longest edge, plus extents along and across it."""
    cu, cv = sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly)
    best, ang = 0, 0
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        d = math.hypot(b[0] - a[0], b[1] - a[1])
        if d > best:
            best, ang = d, math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
    ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    xs = [((p[0] - cu) * ca + (p[1] - cv) * sa) * MPP for p in poly]
    zs = [(-(p[0] - cu) * sa + (p[1] - cv) * ca) * MPP for p in poly]
    return cu, cv, ang, (min(xs), max(xs)), (min(zs), max(zs))


class Frame:
    """A local frame in metres: origin (u0, v0), x along `ang`, z across. Parts are placed by local coordinates."""

    def __init__(self, u0, v0, ang, boxes):
        self.u0, self.v0, self.ang, self.boxes = u0, v0, ang, boxes
        self.ca, self.sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))

    def at(self, x, z):
        return self.u0 + (x * self.ca - z * self.sa) / MPP, self.v0 + (x * self.sa + z * self.ca) / MPP

    def add(self, x, z, y, sx, sy, sz, c, k=0, r=0.0, assumed=False, tag=None, p=None, sd=0):
        u, v = self.at(x, z)
        self.boxes.append(part(u, v, y, sx, sy, sz, c, self.ang + r, assumed, tag, k, p, sd))

    def camera(self, tx, tz, ty, ex, ez, ey, fov=None):
        """Camera looking at local (tx, tz, ty) from the local offset (ex, ez, ey)."""
        du, dv = (ex * self.ca - ez * self.sa), (ex * self.sa + ez * self.ca)   # metres in the crop frame
        c, s = math.cos(ROT), math.sin(ROT)
        dx, dz = du * c - dv * s, dv * c + du * s
        dist = math.sqrt(ex * ex + ez * ez + ey * ey)
        u, v = self.at(tx, tz)
        cam = {'u': round(u, 1), 'v': round(v, 1), 'y': round(ty, 2), 'dist': round(dist, 1), 'el': round(math.asin(max(-1, min(1, ey / dist))), 3), 'az': round(math.atan2(dx, dz), 3)}
        if fov:
            cam['fov'] = fov
        return cam


# ------------------------------------------------------------------ furniture and fittings (local metres)

def floor_tatami(f, x, z, y, w, d, old=False, assumed=False, tag='tatami'):
    f.add(x, z, y, w, 0.05, d, TATAMI_OLD if old else TATAMI, KIND['tatami'], assumed=assumed, tag=tag)


def futon(f, x, z, y, r=0, assumed=True):
    f.add(x, z, y, 1.0, 0.07, 2.0, CLOTH_CREAM, KIND['cloth'], r, assumed, 'futon')
    f.add(x, z, y + 0.07, 0.95, 0.14, 1.85, CLOTH_INDIGO, KIND['cloth'], r, assumed, 'futon', sd=2)
    f.add(x, z - 0.75, y + 0.07, 0.5, 0.1, 0.3, CLOTH_CREAM, KIND['cloth'], r, assumed, 'pillow')


def chabudai(f, x, z, y, assumed=True):
    f.add(x, z, y + 0.26, 0.78, 0.03, 0.78, WOOD_LIGHT, KIND['wood'], 0, assumed, 'chabudai', p='cyl')
    for dx, dz in ((-0.28, -0.28), (0.28, -0.28), (0.28, 0.28), (-0.28, 0.28)):
        f.add(x + dx, z + dz, y, 0.04, 0.26, 0.04, WOOD, KIND['wood'], 0, assumed, 'chabudai')
    dishes(f, x, z, y + 0.29, assumed)


def dishes(f, x, z, y, assumed=True):
    f.add(x - 0.18, z + 0.1, y, 0.16, 0.13, 0.16, CERAMIC_DARK, KIND['flat'], 0, assumed, 'teapot', p='cyl')
    f.add(x - 0.32, z + 0.14, y, 0.12, 0.02, 0.12, CERAMIC_DARK, KIND['flat'], 0, assumed, 'teapot', p='cyl')
    for dx, dz in ((0.12, -0.14), (0.22, 0.08), (-0.02, 0.22)):
        f.add(x + dx, z + dz, y, 0.08, 0.06, 0.08, CERAMIC, KIND['flat'], 0, assumed, 'cup', p='cyl')
    f.add(x + 0.02, z - 0.02, y, 0.13, 0.055, 0.13, CERAMIC, KIND['flat'], 0, assumed, 'bowl', p='cyl')
    f.add(x + 0.16, z - 0.28, y, 0.2, 0.02, 0.2, CERAMIC, KIND['flat'], 0, assumed, 'plate', p='cyl')


def tansu(f, x, z, y, r=0, assumed=True):
    f.add(x, z, y, 0.95, 1.1, 0.45, WOOD, KIND['wood'], r, assumed, 'tansu', sd=3)
    for k in range(4):
        f.add(x, z - 0.24, y + 0.12 + k * 0.26, 0.85, 0.02, 0.02, IRON, KIND['metal'], r, assumed, 'tansu')
        for dx in (-0.2, 0.2):
            f.add(x + dx, z - 0.25, y + 0.14 + k * 0.26, 0.08, 0.03, 0.02, BRASS, KIND['metal'], r, assumed, 'tansu')


def cupboard(f, x, z, y, r=0, assumed=True):
    f.add(x, z, y, 0.9, 1.7, 0.4, WOOD_LIGHT, KIND['wood'], r, assumed, 'cupboard', sd=4)
    f.add(x, z - 0.21, y + 0.95, 0.8, 0.7, 0.02, GLASS, KIND['glass'], r, False, 'cupboard-glass')
    for k in range(3):
        f.add(x - 0.2 + k * 0.2, z - 0.05, y + 1.0 + (k % 2) * 0.25, 0.14, 0.05 + 0.02 * k, 0.14, CERAMIC, KIND['flat'], r, assumed, 'plates', p='cyl')
        f.add(x - 0.25 + k * 0.25, z, y + 1.3, 0.08, 0.07, 0.08, CERAMIC, KIND['flat'], r, assumed, 'cups', p='cyl')


def kamado(f, x, z, y, r=0, assumed=False):
    f.add(x, z, y, 0.9, 0.6, 0.6, [0.60, 0.52, 0.42], KIND['concrete'], r, assumed, 'kamado', sd=5)
    f.add(x - 0.2, z, y + 0.6, 0.34, 0.22, 0.34, IRON, KIND['metal'], r, assumed, 'pot', p='cyl')
    f.add(x - 0.2, z, y + 0.82, 0.38, 0.04, 0.38, WOOD, KIND['wood'], r, assumed, 'pot-lid', p='cyl')
    f.add(x + 0.25, z, y + 0.6, 0.26, 0.16, 0.26, IRON, KIND['metal'], r, assumed, 'kettle', p='cyl')
    f.add(x, z + 0.32, y + 0.1, 0.5, 0.25, 0.05, [0.12, 0.10, 0.08], KIND['flat'], r, assumed, 'hearth')


def sink(f, x, z, y, r=0, assumed=False):
    f.add(x, z, y, 0.9, 0.75, 0.5, CONCRETE_DARK, KIND['concrete'], r, assumed, 'sink')
    f.add(x, z, y + 0.75, 0.8, 0.04, 0.4, CONCRETE_DARK, KIND['concrete'], r, assumed, 'sink')
    f.add(x + 0.3, z - 0.2, y + 0.85, 0.03, 0.35, 0.03, IRON_PALE, KIND['metal'], r, assumed, 'tap', p='cyl')
    f.add(x + 0.3, z - 0.12, y + 1.15, 0.03, 0.03, 0.16, IRON_PALE, KIND['metal'], r, assumed, 'tap')
    f.add(x - 0.25, z, y + 0.79, 0.26, 0.2, 0.26, IRON_PALE, KIND['metal'], r, True, 'bucket', p='cyl')


def mizugame(f, x, z, y, assumed=True):
    f.add(x, z, y, 0.62, 0.7, 0.62, [0.32, 0.28, 0.26], KIND['flat'], 0, assumed, 'water-jar', p='cyl')
    f.add(x, z, y + 0.7, 0.66, 0.04, 0.66, WOOD, KIND['wood'], 0, assumed, 'water-jar-lid', p='cyl')


def bulb(f, x, z, y_ceiling, drop=0.5, assumed=True):
    f.add(x, z, y_ceiling - drop, 0.015, drop, 0.015, IRON, KIND['flat'], 0, assumed, 'cord', p='cyl')
    f.add(x, z, y_ceiling - drop - 0.12, 0.34, 0.12, 0.34, ENAMEL, KIND['flat'], 0, assumed, 'shade', p='cyl')
    f.add(x, z, y_ceiling - drop - 0.2, 0.08, 0.1, 0.08, [1.0, 0.96, 0.80], KIND['flat'], 0, assumed, 'bulb', p='ball')


def tv(f, x, z, y, r=0, assumed=True):
    f.add(x, z, y, 0.52, 0.42, 0.44, WOOD, KIND['wood'], r, assumed, 'tv', sd=6)
    f.add(x, z - 0.225, y + 0.07, 0.38, 0.28, 0.02, [0.35, 0.40, 0.38], KIND['glass'], r, False, 'tv-screen')
    f.add(x, z, y + 0.42, 0.02, 0.5, 0.02, IRON_PALE, KIND['metal'], r, assumed, 'aerial', p='cyl')
    for dx in (-0.2, 0.2):
        f.add(x + dx, z, y - 0.3, 0.03, 0.3, 0.03, WOOD, KIND['wood'], r, assumed, 'tv-leg')


def fridge(f, x, z, y, r=0, assumed=True):
    f.add(x, z, y, 0.55, 1.15, 0.6, ENAMEL, KIND['metal'], r, assumed, 'fridge', sd=7)
    f.add(x + 0.2, z - 0.31, y + 0.6, 0.03, 0.3, 0.02, IRON_PALE, KIND['metal'], r, assumed, 'fridge-handle')


def washer(f, x, z, y, r=0, assumed=True):
    f.add(x, z, y, 0.5, 0.85, 0.5, ENAMEL, KIND['metal'], r, assumed, 'washer', sd=8)
    f.add(x + 0.3, z, y + 0.85, 0.14, 0.2, 0.3, IRON_PALE, KIND['metal'], r, assumed, 'wringer')


def oshiire(f, x, z, y, w, r=0, assumed=False):
    f.add(x, z, y, w, 1.85, 0.85, WOOD, KIND['wood'], r, assumed, 'oshiire')
    for k in (-0.25, 0.25):
        f.add(x + k * w, z - 0.44, y + 0.02, w / 2 - 0.02, 1.8, 0.03, PAPER, KIND['paper'], r, assumed, 'fusuma')
    f.add(x, z, y + 0.9, w - 0.06, 0.03, 0.8, WOOD_LIGHT, KIND['wood'], r, assumed, 'oshiire-shelf')
    f.add(x - 0.15, z, y + 0.95, w * 0.6, 0.25, 0.7, CLOTH_INDIGO, KIND['cloth'], r, True, 'stored-futon')


def window(f, x, z, y, w, h, r=0, assumed=False):
    f.add(x, z, y, w, h, 0.08, GLASS, KIND['glass'], r, False, 'window')
    f.add(x, z, y, 0.06, h, 0.1, WOOD, KIND['wood'], r, assumed, 'window-frame')
    f.add(x - w / 2, z, y, 0.06, h, 0.1, WOOD, KIND['wood'], r, assumed, 'window-frame')
    f.add(x + w / 2, z, y, 0.06, h, 0.1, WOOD, KIND['wood'], r, assumed, 'window-frame')
    f.add(x, z, y + h / 2, w, 0.05, 0.1, WOOD, KIND['wood'], r, assumed, 'window-frame')


def door_wood(f, x, z, y, r=0, w=0.85, assumed=False):
    f.add(x, z, y, w, 1.85, 0.05, WOOD, KIND['wood'], r, assumed, 'door', sd=9)
    f.add(x + w * 0.3, z - 0.04, y + 0.9, 0.04, 0.12, 0.03, BRASS, KIND['metal'], r, assumed, 'handle')


def door_iron(f, x, z, y, r=0, assumed=False):
    f.add(x, z, y, 0.85, 1.9, 0.05, [0.36, 0.40, 0.42], KIND['metal'], r, assumed, 'iron-door', sd=10)
    f.add(x + 0.28, z - 0.04, y + 0.95, 0.03, 0.14, 0.03, IRON_PALE, KIND['metal'], r, assumed, 'handle')


def desk_school(f, x, z, y, r=0, assumed=False):
    f.add(x, z, y + 0.68, 0.6, 0.03, 0.42, WOOD_LIGHT, KIND['wood'], r, assumed, 'desk', sd=11)
    for dx, dz in ((-0.27, -0.18), (0.27, -0.18), (-0.27, 0.18), (0.27, 0.18)):
        f.add(x + dx, z + dz, y, 0.035, 0.68, 0.035, WOOD, KIND['wood'], r, assumed, 'desk-leg')
    f.add(x, z + 0.45, y + 0.42, 0.38, 0.03, 0.36, WOOD_LIGHT, KIND['wood'], r, assumed, 'chair')
    f.add(x, z + 0.62, y + 0.45, 0.38, 0.36, 0.03, WOOD_LIGHT, KIND['wood'], r, assumed, 'chair-back')
    for dx in (-0.16, 0.16):
        f.add(x + dx, z + 0.3, y, 0.03, 0.42, 0.03, WOOD, KIND['wood'], r, assumed, 'chair-leg')
        f.add(x + dx, z + 0.6, y, 0.03, 0.8, 0.03, WOOD, KIND['wood'], r, assumed, 'chair-leg')


def small_chair(f, x, z, y, r=0, assumed=False):
    f.add(x, z, y + 0.26, 0.3, 0.03, 0.3, WOOD_PALE, KIND['wood'], r, assumed, 'small-chair')
    f.add(x, z + 0.14, y + 0.26, 0.3, 0.26, 0.03, WOOD_PALE, KIND['wood'], r, assumed, 'small-chair')
    for dx, dz in ((-0.12, -0.12), (0.12, -0.12), (-0.12, 0.12), (0.12, 0.12)):
        f.add(x + dx, z + dz, y, 0.025, 0.26, 0.025, WOOD, KIND['wood'], r, assumed, 'small-chair')


def blackboard(f, x, z, y, w=3.6, r=0, assumed=False):
    f.add(x, z, y + 0.85, w, 1.2, 0.04, BLACKBOARD, KIND['flat'], r, assumed, 'blackboard')
    f.add(x, z, y + 0.85, w + 0.1, 1.3, 0.03, WOOD_LIGHT, KIND['wood'], r, assumed, 'blackboard-frame')
    f.add(x, z - 0.05, y + 0.82, w, 0.04, 0.08, WOOD_LIGHT, KIND['wood'], r, assumed, 'chalk-tray')


def hospital_bed(f, x, z, y, r=0, assumed=False):
    f.add(x, z, y + 0.3, 1.0, 0.1, 2.0, WOOD, KIND['wood'], r, assumed, 'bed-frame')
    for dx, dz in ((-0.45, -0.95), (0.45, -0.95), (-0.45, 0.95), (0.45, 0.95)):
        f.add(x + dx, z + dz, y, 0.05, 0.3, 0.05, WOOD, KIND['wood'], r, assumed, 'bed-leg')
    f.add(x, z, y + 0.4, 0.95, 0.06, 1.9, TATAMI, KIND['tatami'], r, assumed, 'tatami-bed')
    f.add(x, z + 0.1, y + 0.46, 0.9, 0.12, 1.6, CLOTH_WHITE, KIND['cloth'], r, True, 'quilt')
    f.add(x, z - 0.75, y + 0.46, 0.45, 0.1, 0.3, CLOTH_WHITE, KIND['cloth'], r, True, 'pillow')


def stall(f, x, z, y, r=0, sd=1, assumed=True):
    f.add(x, z, y + 0.75, 1.8, 0.05, 0.8, WOOD_LIGHT, KIND['wood'], r, assumed, 'stall', sd=sd)
    for dx, dz in ((-0.85, -0.35), (0.85, -0.35), (-0.85, 0.35), (0.85, 0.35)):
        f.add(x + dx, z + dz, y, 0.05, 0.75, 0.05, WOOD, KIND['wood'], r, assumed, 'stall-leg')
    for k, col in enumerate(((0.85, 0.45, 0.15), (0.35, 0.55, 0.20), (0.80, 0.25, 0.20))):
        f.add(x - 0.55 + k * 0.55, z, y + 0.8, 0.45, 0.28, 0.6, WOOD_PALE, KIND['wood'], r, assumed, 'crate', sd=sd + k)
        for i in range(4):
            f.add(x - 0.55 + k * 0.55 + (i % 2) * 0.16 - 0.08, z + (i // 2) * 0.2 - 0.1, y + 1.08, 0.15, 0.13, 0.15, list(col), KIND['flat'], r, assumed, 'produce', p='ball', sd=i)
    for dx in (-0.85, 0.85):
        f.add(x + dx, z - 0.4, y, 0.04, 2.2, 0.04, WOOD, KIND['wood'], r, assumed, 'awning-post')
    f.add(x, z - 0.1, y + 2.15, 2.0, 0.03, 1.3, CLOTH_CREAM, KIND['cloth'], r, assumed, 'awning', sd=sd + 5)
    f.add(x, z - 0.72, y + 1.55, 0.6, 0.45, 0.03, CLOTH_WHITE, KIND['cloth'], r, assumed, 'sign')


def tub(f, x, z, y, w, d, h=0.65, wall=0.15, tile=TILE_WHITE, assumed=False, tag='tub'):
    f.add(x, z - d / 2 + wall / 2, y, w, h, wall, tile, KIND['tile'], 0, assumed, tag)
    f.add(x, z + d / 2 - wall / 2, y, w, h, wall, tile, KIND['tile'], 0, assumed, tag)
    f.add(x - w / 2 + wall / 2, z, y, wall, h, d, tile, KIND['tile'], 0, assumed, tag)
    f.add(x + w / 2 - wall / 2, z, y, wall, h, d, tile, KIND['tile'], 0, assumed, tag)
    f.add(x, z, y + h - 0.12, w - 2 * wall, 0.02, d - 2 * wall, WATER, KIND['water'], 0, False, 'water')


def fence(f, x, z, y, length, r=0, h=1.8, assumed=False):
    n = max(2, int(length / 1.8) + 1)
    for i in range(n):
        f.add(x - length / 2 + i * length / (n - 1), z, y, 0.05, h, 0.05, IRON, KIND['metal'], r, assumed, 'fence-post', p='cyl')
    for k in (0.3, h / 2, h - 0.05):
        f.add(x, z, y + k, length, 0.03, 0.03, IRON, KIND['metal'], r, assumed, 'fence-rail')
    f.add(x, z, y + 0.3, length, h - 0.35, 0.01, [0.55, 0.58, 0.60], KIND['glass'], r, False, 'fence-mesh')


def tree(f, x, z, y, h=3.0, spread=2.4, sd=1, assumed=False):
    f.add(x, z, y, 0.22, h * 0.55, 0.22, WOOD, KIND['wood'], 0, assumed, 'trunk', p='cyl')
    f.add(x, z, y + h * 0.45, spread, h * 0.55, spread, LEAF, KIND['leaf'], 0, assumed, 'crown', p='ball', sd=sd)
    f.add(x + spread * 0.25, z - spread * 0.2, y + h * 0.35, spread * 0.7, h * 0.4, spread * 0.7, LEAF_DARK, KIND['leaf'], 0, assumed, 'crown', p='ball', sd=sd + 1)


def bush(f, x, z, y, w=1.2, h=0.8, sd=1, assumed=False):
    f.add(x, z, y, w, h, w, LEAF, KIND['leaf'], 0, assumed, 'bush', p='ball', sd=sd)
    f.add(x + w * 0.3, z + w * 0.2, y, w * 0.7, h * 0.8, w * 0.7, LEAF_DARK, KIND['leaf'], 0, assumed, 'bush', p='ball', sd=sd + 2)


def rock(f, x, z, y, w, h, d, sd=1, assumed=False):
    f.add(x, z, y, w, h, d, ROCK, KIND['rock'], 0, assumed, 'rock', p='rock', sd=sd)


# ------------------------------------------------------------------ scenes

def scene_no30(model):
    b = building(model, '30号棟')
    poly = b['poly']
    us, vs = [p[0] for p in poly], [p[1] for p in poly]
    cu, cv = sum(us) / 4, sum(vs) / 4
    W = (max(us) - min(us)) * MPP
    D = (max(vs) - min(vs)) * MPP
    ground, floorH, storeys = b['ground'], b['floorH'], b['storeys']
    court = 11.5
    gallery = 1.4
    boxes = []
    f = Frame(cu, cv, 0, boxes)
    f.add(0, 0, ground - 0.05, W - 0.6, 0.1, D - 0.6, CONCRETE_DARK, KIND['concrete'], tag='floor', sd=1)
    # galleries round the light well, with railings; the flat fronts behind them
    for k in range(storeys):
        y = ground + k * floorH
        if k > 0:
            for side in ('n', 's'):
                zz = -(court / 2 + gallery / 2) if side == 'n' else (court / 2 + gallery / 2)
                f.add(0, zz, y - 0.18, court + 2 * gallery, 0.18, gallery, CONCRETE, KIND['concrete'], tag='gallery', sd=k)
                f.add(0, -(court / 2) if side == 'n' else court / 2, y, court, 1.0, 0.05, IRON, KIND['metal'], tag='rail')
                f.add(0, -(court / 2) if side == 'n' else court / 2, y + 0.98, court, 0.04, 0.06, IRON, KIND['metal'], tag='rail')
            for side in ('w', 'e'):
                xx = -(court / 2 + gallery / 2) if side == 'w' else (court / 2 + gallery / 2)
                f.add(xx, 0, y - 0.18, gallery, 0.18, court + 2 * gallery, CONCRETE, KIND['concrete'], tag='gallery', sd=k + 7)
                f.add(-(court / 2) if side == 'w' else court / 2, 0, y, 0.05, 1.0, court, IRON, KIND['metal'], tag='rail')
                f.add(-(court / 2) if side == 'w' else court / 2, 0, y + 0.98, 0.06, 0.04, court, IRON, KIND['metal'], tag='rail')
        h = floorH - 0.18
        inner = court / 2 + gallery
        for side in ('n', 's'):
            zz = -inner if side == 'n' else inner
            f.add(0, zz, y, court + 2 * gallery, h, 0.2, CONCRETE, KIND['concrete'], assumed=True, tag='front', sd=k + 20)
            for i in range(-1, 2):
                door_wood(f, i * 4.4, zz + (0.14 if side == 'n' else -0.14), y, r=0 if side == 'n' else 180, assumed=True)
        for side in ('w', 'e'):
            xx = -inner if side == 'w' else inner
            f.add(xx, 0, y, 0.2, h, court + 2 * gallery, CONCRETE, KIND['concrete'], assumed=True, tag='front', sd=k + 30)
            for i in range(-1, 2):
                door_wood(f, xx + (0.14 if side == 'w' else -0.14), i * 4.4, y, r=90 if side == 'w' else -90, assumed=True)
        # the communal sink and washing place on the gallery (the sink was on the open corridor: exhibition panel)
        if k > 0:
            sink(f, -court / 2 + 1.2, court / 2 + 0.7, y, r=180, assumed=False)
            washer(f, court / 2 - 1.2, -court / 2 - 0.7, y, assumed=True)
    # stairs in two corners of the light well
    for (sx0, sz0, dirn) in ((-(court / 2 - 1.2), -(court / 2 - 0.6), 1), ((court / 2 - 1.2), (court / 2 - 0.6), -1)):
        for k in range(storeys - 1):
            y0 = ground + k * floorH
            for i in range(12):
                f.add(sx0, sz0 + dirn * (i * 0.28 - 1.5), y0 + i * (floorH / 12), 1.2, 0.16, 0.3, CONCRETE_DARK, KIND['concrete'], assumed=True, tag='stair')
    # one flat cut open on the 3rd floor, north-west corner: 6 tatami (2.7 x 3.6 m) with the earth-floored kitchen by the door
    y = ground + 2 * floorH
    fx, fz = -(court / 2 + gallery + 2.9), -(court / 2 + gallery - 1.6)
    ff = Frame(*f.at(fx, fz), 0, boxes)
    floor_tatami(ff, -0.55, 0, y, 3.6, 2.7, old=True)                                    # 6畳 = 3.6 x 2.7 m
    ff.add(1.9, -0.9, y - 0.05, 1.3, 0.04, 1.0, [0.40, 0.36, 0.30], KIND['soil'], tag='doma')  # 土間
    kamado(ff, 1.95, -1.1, y - 0.02, r=90)
    mizugame(ff, 2.2, -0.2, y - 0.02)
    f.add(fx + 1.4, fz + 0.9, y, 0.04, 2.0, 0.04, WOOD, KIND['wood'], assumed=True, tag='post')
    oshiire(ff, -2.3, 0, y, 2.6, r=90)                                                     # 押入 along the outer wall
    window(ff, -2.75, 0.9, y + 0.9, 1.4, 1.0, r=90)                                        # 出窓 (added after the war, west face)
    ff.add(-2.95, 0.9, y + 0.8, 0.5, 0.06, 1.5, CONCRETE, KIND['concrete'], tag='bay-sill')
    chabudai(ff, -0.5, 0.1, y)
    futon(ff, -1.4, -0.6, y + 0.05, r=90)
    tansu(ff, 0.6, 1.2, y, r=180)
    tv(ff, 1.3, 1.15, y + 0.3, r=180)
    bulb(ff, -0.5, 0.1, y + floorH - 0.2, 0.45)
    ff.add(-0.55, 1.75, y, 3.6, 2.5, 0.12, PAPER, KIND['paper'], assumed=True, tag='fusuma')   # partitions to the neighbours
    ff.add(-0.55, -1.75, y, 3.6, 2.5, 0.12, PAPER, KIND['paper'], assumed=True, tag='fusuma')
    # a cord of laundry across the gallery outside the flat
    ff.add(1.9, 0.5, y + 1.7, 0.01, 0.01, 2.2, IRON_PALE, KIND['flat'], assumed=True, tag='line')
    for i in range(3):
        ff.add(2.0, -0.4 + i * 0.7, y + 1.1, 0.02, 0.6, 0.5, [CLOTH_WHITE, CLOTH_INDIGO, CLOTH_CREAM][i], KIND['cloth'], assumed=True, tag='laundry', sd=i)
    cam = {'u': round(cu, 1), 'v': round(cv, 1), 'y': round(ground + 2 * floorH + 1.2, 1), 'dist': 8.5, 'el': 0.18, 'az': 2.4}
    return {
        'building': '30号棟', 'ghost': ['30号棟'], 'center': [round(cu, 1), round(cv, 1)], 'floor': round(ground, 1),
        'camera': cam, 'flatCamera': ff.camera(-0.3, 0.1, y + 0.9, 3.2, 4.0, 1.8, fov=0.95),
        'boxes': boxes,
        'text': {
            'en': 'Inside Building 30 (1916): seven floors of galleries round a light well, 140 one-room flats of six tatami. One flat on the third floor is cut open: the earth-floored entrance with its cooking hearth and water jar, the tatami room, the closet along the outer wall and the bay window that was added after the war. The communal sink stood on the open gallery and the shared toilets at the corners. Galleries, stairs, the low table, bedding, chest and television are drawn from period accounts and are assumptions.',
            'ja': '30号棟（1916年）の中。吹き抜けを囲む7階の回廊に、六畳一間の住戸が140戸。3階の一室を切り開いています。戸口の土間に竈と水がめ、六畳の畳、外壁側の押入、戦後に付いた出窓。共同の流しは回廊にあり、共同便所は角にありました。回廊と階段の位置、ちゃぶ台・布団・箪笥・テレビは当時の記録からの推定で、半透明にしています。',
            'ko': '30호동(1916년) 내부. 채광정을 둘러싼 7층의 복도에 다다미 6장 한 칸짜리 140세대. 3층 한 세대를 잘라 보여 줍니다. 문 앞 흙바닥에 부뚜막과 물독, 다다미 방, 바깥벽 쪽 벽장, 전후에 붙은 돌출창. 공동 개수대는 복도에, 공동 화장실은 모퉁이에 있었습니다. 복도와 계단 위치, 밥상·이불·장롱·TV는 당시 기록에서 추정한 것으로 반투명입니다.',
            'zh-Hans': '30号楼（1916年）内部：围绕天井的七层外廊，140户六叠一间。剖开三楼一户：门口的土间有灶台和水缸，六叠榻榻米，外墙侧的壁橱，战后加的凸窗。公用水槽在外廊上，公厕在拐角。走廊与楼梯位置、矮桌、被褥、衣柜和电视按当年记述推定，以半透明绘制。',
            'zh-Hant': '30號樓（1916年）內部：圍繞天井的七層外廊，140戶六疊一間。剖開三樓一戶：門口的土間有灶台和水缸，六疊榻榻米，外牆側的壁櫥，戰後加的凸窗。公用水槽在外廊上，公廁在轉角。走廊與樓梯位置、矮桌、被褥、衣櫃和電視按當年記述推定，以半透明繪製。',
        },
        'sources': [
            {'label': {'en': 'Exhibition panel on Building 30 (2024, PDF, Japanese)', 'ja': '端島30号棟展示パネル（2024年・PDF）'}, 'url': 'https://jogakkai.jp/MailMagMedia/2024/387/building30BigSightExhibition20240612.pdf'},
            {'label': {'en': 'Imagination and memory: Building 30 (Japanese)', 'ja': '想像と記憶（端島・軍艦島）30号棟'}, 'url': 'https://www6.cncm.ne.jp/~hashima/30goutoum.html'},
            {'label': {'en': 'Gunkanjima Excursion: Building 30 (Japanese)', 'ja': '軍艦島エクスカーション 30号棟'}, 'url': 'https://www.gunkanjima-excursion.com/architecture/30-building.html'},
            {'label': {'en': 'Household goods and cooking on Hashima (Japanese)', 'ja': '想像と記憶 文化休止集（台所・家電の変遷）'}, 'url': 'https://www6.cncm.ne.jp/~hashima/bunkakyusisyu.html'},
        ],
    }


def scene_shrine(model, at):
    b = building(model, '1号棟')
    poly = b['poly']
    cu, cv = sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly)
    top = max(at(cu, cv), b['ground'])
    boxes = []
    f = Frame(cu, cv, 0, boxes)
    f.add(0, 0, top - 0.05, 16, 0.12, 12, STONE, KIND['concrete'], tag='terrace', sd=3)
    # the rock itself: boulders with moss round the terrace and down the slopes
    for i, (x, z, w, h, d) in enumerate(((-9.5, -4, 4.5, 2.6, 3.5), (-8.5, 4.5, 3.8, 2.2, 3.0), (9.0, -5.5, 4.2, 2.4, 3.2), (9.5, 3.5, 3.0, 2.0, 2.6), (2.0, -7.5, 5.0, 1.8, 2.8), (-3.0, 7.5, 4.6, 2.0, 3.0), (-11.0, 0.5, 3.0, 3.2, 2.6), (6.0, 7.5, 3.4, 1.6, 2.4), (-5.5, -7.5, 3.6, 1.5, 2.6))):
        yy = at(*f.at(x, z))
        rock(f, x, z, min(yy, top) - h * 0.45, w, h, d, sd=i + 1)
    for i, (x, z) in enumerate(((-7.5, -2.5), (-6.5, 5.5), (8.0, 1.0), (4.5, -6.5), (-2.5, 6.5), (7.5, -3.0))):
        bush(f, x, z, min(at(*f.at(x, z)), top) - 0.1, 1.4 + 0.3 * (i % 3), 0.9 + 0.2 * (i % 2), sd=i + 3)
    tree(f, -6.0, -6.0, min(at(*f.at(-6.0, -6.0)), top) - 0.3, 3.2, 2.6, sd=4)
    # torii on the east side of the terrace (the approach from the stairway): two posts, two lintels
    tx = 5.5
    for dz in (-1.6, 1.6):
        f.add(tx, dz, top, 0.32, 4.2, 0.32, STONE, KIND['concrete'], tag='torii', p='cyl', sd=5)
    f.add(tx, 0, top + 3.9, 0.36, 0.34, 4.4, STONE, KIND['concrete'], tag='torii')
    f.add(tx, 0, top + 3.2, 0.24, 0.22, 3.6, STONE, KIND['concrete'], tag='torii')
    # the cenotaph inside the torii: a stepped base and a tall stele (1992 photograph)
    mx, mz = 3.2, -2.4
    f.add(mx, mz, top, 1.6, 0.4, 1.6, STONE, KIND['rock'], tag='cenotaph', sd=6)
    f.add(mx, mz, top + 0.4, 1.0, 0.5, 1.0, STONE, KIND['concrete'], tag='cenotaph')
    f.add(mx, mz, top + 0.9, 0.5, 2.4, 0.4, STONE, KIND['concrete'], tag='cenotaph', sd=7)
    # the inner shrine (RC, still standing): a small hut on a plinth with a gabled roof
    sx = -4.0
    f.add(sx, 0, top, 3.0, 0.5, 2.6, CONCRETE_DARK, KIND['concrete'], tag='hokora', sd=8)
    f.add(sx, 0, top + 0.5, 2.0, 2.2, 1.8, CONCRETE, KIND['concrete'], tag='hokora', sd=9)
    f.add(sx + 1.01, 0, top + 0.6, 0.02, 1.6, 0.9, WOOD, KIND['wood'], tag='hokora-door')
    f.add(sx, 0, top + 2.7, 2.8, 0.3, 2.6, CONCRETE_DARK, KIND['concrete'], tag='hokora')
    f.add(sx, 0, top + 3.0, 1.8, 0.35, 1.6, CONCRETE_DARK, KIND['concrete'], tag='hokora')
    f.add(sx + 1.4, 0, top + 0.5, 0.6, 0.02, 1.2, STONE, KIND['concrete'], tag='offering-step')
    for dz in (-0.35, 0.35):
        f.add(sx + 1.3, dz, top + 0.52, 0.12, 0.28, 0.12, CERAMIC, KIND['flat'], tag='sake-bottle', p='cyl', assumed=True)
    # the wooden worship hall that stood in front of it (collapsed; size assumed)
    hx = -0.5
    f.add(hx, 0, top, 5.0, 0.4, 4.0, WOOD, KIND['wood'], assumed=True, tag='haiden')
    for dx, dz in ((-2.2, -1.7), (2.2, -1.7), (-2.2, 1.7), (2.2, 1.7)):
        f.add(hx + dx, dz, top + 0.4, 0.25, 2.8, 0.25, WOOD, KIND['wood'], assumed=True, tag='haiden', p='cyl')
    f.add(hx, 0, top + 3.2, 6.0, 0.5, 5.0, [0.30, 0.30, 0.32], KIND['metal'], assumed=True, tag='haiden-roof')
    f.add(hx, 0, top + 3.7, 4.0, 0.5, 3.2, [0.30, 0.30, 0.32], KIND['metal'], assumed=True, tag='haiden-roof')
    f.add(hx + 2.6, 0, top + 1.9, 0.08, 0.5, 0.5, [0.55, 0.20, 0.18], KIND['cloth'], assumed=True, tag='bell-rope')
    f.add(hx, 0, top + 1.0, 1.2, 0.6, 0.5, WOOD, KIND['wood'], assumed=True, tag='offering-box')
    # 地獄段: the stairway from the terrace down toward the western blocks; heights follow the terrain
    b16 = building(model, '16号棟')
    eu, ev = sum(p[0] for p in b16['poly']) / len(b16['poly']), sum(p[1] for p in b16['poly']) / len(b16['poly'])
    su0, sv0 = f.at(tx + 1.5, 0)
    n = 46
    ang = math.degrees(math.atan2(ev - sv0, eu - su0))
    for i in range(n):
        t = i / (n - 1)
        u = su0 + (eu - su0) * t * 0.55
        v = sv0 + (ev - sv0) * t * 0.55
        y = max(at(u, v), b16['ground'])
        boxes.append(part(u, v, y, 2.2, 0.18, 0.5, STONE, r=ang, assumed=True, tag='jigokudan', k=KIND['concrete'], sd=i % 5))
        if i % 6 == 3:
            side = 1.5 if i % 12 == 3 else -1.5
            boxes.append(part(u + side * math.cos(math.radians(ang + 90)) / MPP, v + side * math.sin(math.radians(ang + 90)) / MPP, y - 0.6, 1.4, 1.1, 1.2, ROCK, r=ang, tag='rock', k=KIND['rock'], p='rock', sd=i))
    return {
        'building': '1号棟', 'ghost': ['1号棟'],
        'center': [round(cu, 1), round(cv, 1)], 'floor': round(top, 1),
        'camera': {'u': round(cu + m2px(6.5), 1), 'v': round(cv, 1), 'y': round(top + 1.4, 1), 'dist': 15, 'el': 0.3, 'az': -1.55},
        'boxes': boxes,
        'text': {
            'en': 'Hashima Shrine on top of the rock, reached from the Jigokudan stairway: through the torii, past the cenotaph, to the wooden worship hall and the small concrete inner shrine behind it. The inner shrine, the torii and the cenotaph are drawn from the 1992 photographs; the mossy boulders and shrubs follow the same photographs. The worship hall collapsed long ago and its size, and the exact line of the stairway, are assumptions drawn translucent.',
            'ja': '岩山の上の端島神社を、地獄段を上がってきた向きで見ています。鳥居をくぐり、慰霊碑の脇を通って、木造の拝殿、その奥にコンクリートの本殿（祠）。祠・鳥居・慰霊碑と、苔むした岩や灌木は1992年の写真から。拝殿は早くに倒壊したため大きさが推定、地獄段の正確な位置も推定で、半透明にしています。',
            'ko': '지고쿠단 계단을 올라온 방향에서 본 바위산 위의 하시마 신사. 도리이를 지나 위령비 옆을 거쳐 목조 배전, 그 뒤에 콘크리트 본전(사당). 사당·도리이·위령비와 이끼 낀 바위·관목은 1992년 사진에서 그렸습니다. 배전은 일찍 무너져 크기가 추정이며 계단의 정확한 위치도 추정이라 반투명입니다.',
            'zh-Hans': '从地狱段登上来的方向看岩山顶的端岛神社：穿过鸟居，经过慰灵碑，是木造拜殿，其后是混凝土本殿（祠）。祠、鸟居、慰灵碑以及长满青苔的岩石和灌木按1992年照片绘制；拜殿早已倒塌，尺寸为推定，台阶的确切位置也为推定，以半透明绘制。',
            'zh-Hant': '從地獄段登上來的方向看岩山頂的端島神社：穿過鳥居，經過慰靈碑，是木造拜殿，其後是混凝土本殿（祠）。祠、鳥居、慰靈碑以及長滿青苔的岩石和灌木按1992年照片繪製；拜殿早已倒塌，尺寸為推定，台階的確切位置也為推定，以半透明繪製。',
        },
        'sources': [
            {'label': {'en': 'Hashima Shrine, 1992 photographs (Wikimedia Commons)', 'ja': '端島神社の1992年の写真（Wikimedia Commons）'}, 'url': 'https://commons.wikimedia.org/wiki/Category:Hashima-jinja_(Nagasaki)'},
            {'label': {'en': 'Imagination and memory: Building 1, the shrine (Japanese)', 'ja': '想像と記憶 1号棟（端島神社）'}, 'url': 'https://www6.cncm.ne.jp/~hashima/1goutou.html'},
            {'label': {'en': 'Gunkanjima Digital Museum: spots (Japanese)', 'ja': '軍艦島デジタルミュージアム おすすめスポット'}, 'url': 'https://www.gunkanjima-museum.jp/data/558/detail/'},
        ],
    }


def scene_no65roof(model):
    """The nursery on the roof of the east wing of Building 65 (1953, 338 m2, +87 m2 in 1955)."""
    b = building(model, '65号棟')
    ground, floorH = b['ground'], b['floorH']
    roof = ground + 9 * floorH
    # the east wing: outer edge (655,481)->(718,451), inner edge (672,450)->(702,435); local x along the wing
    ang = math.degrees(math.atan2(451 - 481, 718 - 655))
    cu, cv = (655 + 718 + 672 + 702) / 4, (481 + 451 + 450 + 435) / 4
    boxes = []
    f = Frame(cu, cv, ang, boxes)
    f.add(0, 0, roof - 0.05, 54, 0.1, 15.5, CONCRETE, KIND['concrete'], tag='roof-slab', sd=2)
    # parapet and the high fence round the roof (the fence: former residents' site)
    for zz in (-7.6, 7.6):
        f.add(0, zz, roof, 54, 0.9, 0.25, CONCRETE, KIND['concrete'], tag='parapet', sd=3)
        fence(f, 0, zz, roof + 0.9, 54, h=2.2)
    # the nursery building: about 24 x 14 m, one storey with a flat roof, drawn as a cut-away without its front wall
    bx = 4.0
    f.add(bx, 0, roof, 24, 0.06, 13.5, WOOD_PALE, KIND['wood'], tag='nursery-floor', sd=5)
    f.add(bx, 6.75, roof, 24, 2.9, 0.2, PLASTER, KIND['wall'], tag='nursery-wall', sd=4)
    f.add(bx + 12, 0, roof, 0.2, 2.9, 13.5, PLASTER, KIND['wall'], tag='nursery-wall', sd=6)
    f.add(bx - 12, 0, roof, 0.2, 2.9, 13.5, PLASTER, KIND['wall'], tag='nursery-wall', sd=7)
    for i in range(3):
        f.add(bx - 12, -3.5 + i * 3.5, roof + 0.5, 0.05, 1.8, 2.4, GLASS, KIND['glass'], tag='window')
    for i in range(5):
        f.add(bx - 10 + i * 5.0, 6.75, roof + 0.9, 2.6, 1.4, 0.05, GLASS, KIND['glass'], tag='window')
    # the indoor garden room at the western end: a raised round pond with rocks, open to the view
    gx = bx - 8.0
    f.add(gx, 1.5, roof, 4.2, 0.55, 4.2, TILE_WHITE, KIND['tile'], tag='pond-rim', p='cyl')
    f.add(gx, 1.5, roof + 0.4, 3.6, 0.1, 3.6, WATER, KIND['water'], tag='pond', p='cyl')
    for i, (dx, dz, w) in enumerate(((0.6, 0.4, 1.0), (-0.7, -0.5, 0.8), (0.1, -1.0, 0.7), (-0.2, 0.9, 0.6))):
        rock(f, gx + dx, 1.5 + dz, roof + 0.4, w, 0.6, w * 0.8, sd=i + 10)
    f.add(gx - 0.4, 1.3, roof + 0.5, 0.4, 0.9, 0.4, LEAF_DARK, KIND['leaf'], tag='garden-pine', p='ball', sd=12)
    f.add(gx - 2.4, -1.0, roof, 0.9, 0.5, 0.9, [0.62, 0.36, 0.30], KIND['flat'], tag='rocking-horse', assumed=True)
    # the classroom: rows of tiny chairs and low tables, an organ, the shoe rack by the door
    cx = bx + 4.0
    for i in range(3):
        for j in range(2):
            f.add(cx - 3 + i * 3.0, -3.5 + j * 3.0, roof + 0.4, 1.6, 0.04, 0.8, WOOD_PALE, KIND['wood'], tag='low-table', sd=i + j)
            for dz in (-0.7, 0.7):
                for dx in (-0.5, 0.0, 0.5):
                    small_chair(f, cx - 3 + i * 3.0 + dx, -3.5 + j * 3.0 + dz, roof, r=0 if dz > 0 else 180)
    f.add(cx + 6.5, 4.0, roof, 1.2, 1.0, 0.55, WOOD, KIND['wood'], tag='organ', sd=13)
    f.add(cx + 6.5, 4.0, roof + 1.0, 1.1, 0.1, 0.3, [0.92, 0.92, 0.88], KIND['flat'], tag='organ-keys')
    f.add(cx + 9.0, 3.5, roof, 1.5, 1.1, 0.65, [0.12, 0.10, 0.10], KIND['wood'], tag='piano', sd=14)
    f.add(cx + 9.0, 3.5, roof + 0.85, 1.4, 0.03, 0.2, [0.92, 0.92, 0.88], KIND['flat'], tag='piano-keys')
    blackboard(f, cx + 2.0, 6.4, roof + 0.6, 3.0)
    # shoe rack: 6 x 5 pigeonholes (1992 photograph) inside the door at the eastern end
    sx = bx + 11.0
    f.add(sx, 4.5, roof, 0.35, 1.7, 2.6, WOOD_PALE, KIND['wood'], tag='shoe-rack', sd=15)
    for i in range(6):
        f.add(sx - 0.1, 4.5, roof + 0.05 + i * 0.28, 0.3, 0.02, 2.6, WOOD, KIND['wood'], tag='shoe-rack')
    for j in range(6):
        f.add(sx - 0.1, 4.5 - 1.3 + j * 0.52, roof, 0.3, 1.7, 0.02, WOOD, KIND['wood'], tag='shoe-rack')
    for i in range(7):
        f.add(sx - 0.15, 3.4 + (i % 5) * 0.52, roof + 0.06 + (i % 3) * 0.28, 0.22, 0.05, 0.1, [CLOTH_RED, CLOTH_INDIGO, CLOTH_WHITE][i % 3], KIND['cloth'], tag='shoes', sd=i)
    door_wood(f, sx + 0.4, 6.7, roof, r=0, w=1.6)
    # the terrace: the iron slide, a paddling pool, the sand pit
    tx = bx + 15.5
    f.add(tx, -3.5, roof, 0.9, 2.8, 0.9, IRON_PALE, KIND['metal'], tag='slide-tower', sd=16)
    for i in range(10):
        f.add(tx - 0.6 - i * 0.5, -3.5, roof + 2.4 - i * 0.24, 0.55, 0.06, 0.7, ENAMEL, KIND['metal'], tag='slide')
    for i in range(6):
        f.add(tx + 0.5, -3.5 + (i % 2) * 0.3 - 0.15, roof + 0.4 + i * 0.4, 0.5, 0.05, 0.05, IRON_PALE, KIND['metal'], tag='ladder')
    tub(f, tx + 2.5, 3.5, roof, 5.0, 3.0, 0.6, 0.2, TILE_BLUE, tag='pool')
    f.add(tx - 6.0, 4.5, roof, 4.0, 0.3, 3.0, [0.78, 0.70, 0.52], KIND['soil'], tag='sand-pit', sd=17)
    return {
        'building': '65号棟', 'ghost': ['65号棟'],
        'center': [round(cu, 1), round(cv, 1)], 'floor': round(roof, 1),
        'camera': f.camera(bx + 1.5, 0.5, roof + 0.9, -5.5, -6.0, 3.2, fov=1.0),
        'boxes': boxes,
        'text': {
            'en': 'The nursery on the roof of Building 65, ten floors up: opened in 1953 on the east wing for 150 children, extended in 1955, closed in January 1974. Inside, an indoor garden with a round pond that the children helped build, a classroom with tiny chairs, an organ and a piano, and the shoe rack by the door; outside, the iron slide, a paddling pool and a high fence round the roof. Pond, slide, shoe rack and chairs are drawn from the 1992 photographs; the room layout and the pool are assumptions.',
            'ja': '65号棟の屋上、10階の高さにあった保育園。1953年に東棟の屋上に建てられ、定員150人、1955年に増築、1974年1月に閉園。室内には園児がつくった日本庭園と丸い池、小さな椅子の並ぶ保育室、オルガンとピアノ、戸口の下駄箱。屋上には鉄の滑り台、水遊びのプール、周囲を囲む高い柵。池・滑り台・下駄箱・椅子は1992年の写真から。部屋割りとプールは推定です。',
            'ko': '65호동 옥상, 10층 높이에 있던 보육원. 1953년 동동 옥상에 세워져 정원 150명, 1955년 증축, 1974년 1월 폐원. 실내에는 원아들이 만든 일본 정원과 둥근 연못, 작은 의자가 늘어선 보육실, 오르간과 피아노, 문 옆의 신발장. 옥상에는 철제 미끄럼틀, 물놀이장, 둘레를 두른 높은 울타리. 연못·미끄럼틀·신발장·의자는 1992년 사진에서, 방 배치와 물놀이장은 추정입니다.',
            'zh-Hans': '65号楼屋顶、十层高处的保育园：1953年建于东翼屋顶，定员150人，1955年扩建，1974年1月关闭。室内有孩子们参与修建的日式庭园和圆形水池、摆着小椅子的保育室、风琴和钢琴、门口的鞋柜；屋顶上有铁制滑梯、戏水池和环绕四周的高栏。水池、滑梯、鞋柜和椅子按1992年照片绘制；房间布局和戏水池为推定。',
            'zh-Hant': '65號樓屋頂、十層高處的保育園：1953年建於東翼屋頂，定員150人，1955年擴建，1974年1月關閉。室內有孩子們參與修建的日式庭園和圓形水池、擺著小椅子的保育室、風琴和鋼琴、門口的鞋櫃；屋頂上有鐵製滑梯、戲水池和環繞四周的高欄。水池、滑梯、鞋櫃和椅子按1992年照片繪製；房間布局和戲水池為推定。',
        },
        'sources': [
            {'label': {'en': 'Hashima Kindergarten, 1992 photographs (Wikimedia Commons)', 'ja': '端島幼稚園・保育園の1992年の写真（Wikimedia Commons）'}, 'url': 'https://commons.wikimedia.org/wiki/File:Hashima_Kindergarten-01.jpg'},
            {'label': {'en': 'Imagination and memory: the nursery (Japanese)', 'ja': '想像と記憶 文化（保育園）'}, 'url': 'https://www6.cncm.ne.jp/~hashima/bunka.html'},
            {'label': {'en': 'Imagination and memory: Building 65 (Japanese)', 'ja': '想像と記憶 65号棟'}, 'url': 'https://www6.cncm.ne.jp/~hashima/65goutou.html'},
        ],
    }


def scene_no65flat(model):
    """A 2K flat in the south wing of Building 65 (1958): six and four-and-a-half tatami with an earth-floored kitchen."""
    b = building(model, '65号棟')
    ground, floorH = b['ground'], b['floorH']
    # the south wing: the arm (637,419)-(646,415)-(672,450)-(648,464); local x along (637,419)->(648,464)
    ang = math.degrees(math.atan2(464 - 419, 648 - 637))
    cu, cv = (637 + 646 + 672 + 648) / 4, (419 + 415 + 450 + 464) / 4
    y = ground + 4 * floorH
    boxes = []
    f = Frame(cu, cv, ang, boxes)
    # the middle corridor with flats on both sides: show the corridor and one flat cut open
    f.add(0, 0, y - 0.05, 14, 0.1, 2.0, CONCRETE_DARK, KIND['concrete'], tag='corridor', sd=1)
    f.add(0, 0, y + floorH - 0.25, 14, 0.2, 2.0, CONCRETE, KIND['concrete'], tag='corridor-ceiling', sd=2)
    for i in range(3):
        door_iron(f, -4.5 + i * 4.5, -1.02, y, r=0)
        door_iron(f, -4.5 + i * 4.5, 1.02, y, r=180)
        f.add(-4.5 + i * 4.5 + 1.3, 1.25, y, 0.5, 0.85, 0.5, ENAMEL, KIND['metal'], assumed=True, tag='washer', sd=i)
        f.add(-4.5 + i * 4.5 - 1.4, 1.3, y, 0.35, 0.3, 0.35, [0.30, 0.34, 0.36], KIND['metal'], assumed=True, tag='gas-cylinder', p='cyl')
    bulb(f, 0, 0, y + floorH - 0.25, 0.3)
    # the flat on the seaward side: 土間 kitchen by the door, then 6 tatami and 4.5 tatami
    ff = Frame(*f.at(0, -1.2), ang, boxes)
    ff.add(0, -1.0, y - 0.04, 3.6, 0.04, 1.8, [0.40, 0.36, 0.30], KIND['soil'], tag='doma')
    ff.add(-1.2, -1.4, y, 1.2, 0.5, 0.8, CONCRETE_DARK, KIND['concrete'], tag='kamado-slab', sd=3)
    ff.add(-1.2, -1.4, y + 0.5, 0.5, 0.25, 0.5, IRON, KIND['metal'], assumed=True, tag='gas-stove')
    ff.add(-1.2, -1.4, y + 0.75, 0.3, 0.15, 0.3, IRON, KIND['metal'], assumed=True, tag='pot', p='cyl')
    sink(ff, 0.6, -1.5, y, r=0, assumed=True)
    fridge(ff, 1.5, -1.4, y, r=0)
    floor_tatami(ff, 0, -3.35, y, 3.6, 2.7)
    floor_tatami(ff, 0, -6.0, y, 2.7, 2.7)
    ff.add(0, -4.7, y, 3.6, 2.4, 0.08, PAPER, KIND['paper'], assumed=True, tag='fusuma')
    chabudai(ff, 0.2, -3.3, y)
    tv(ff, -1.4, -2.6, y + 0.3, r=90)
    tansu(ff, 1.4, -3.6, y, r=-90)
    futon(ff, 0.0, -6.0, y + 0.05)
    oshiire(ff, -1.4, -6.0, y, 2.4, r=90)
    bulb(ff, 0.2, -3.3, y + floorH - 0.25, 0.4)
    # the veranda beyond the rooms, with washing hung out
    ff.add(0, -7.9, y - 0.05, 3.6, 0.1, 1.2, CONCRETE, KIND['concrete'], tag='veranda', sd=4)
    ff.add(0, -8.5, y, 3.6, 1.0, 0.1, CONCRETE, KIND['concrete'], tag='veranda-wall', sd=5)
    ff.add(0, -8.0, y + 1.8, 3.4, 0.02, 0.02, IRON_PALE, KIND['flat'], assumed=True, tag='pole')
    for i in range(4):
        ff.add(-1.2 + i * 0.8, -8.0, y + 1.2, 0.5, 0.6, 0.02, [CLOTH_WHITE, CLOTH_INDIGO, CLOTH_CREAM, CLOTH_RED][i], KIND['cloth'], assumed=True, tag='laundry', sd=i)
    window(ff, 0, -7.3, y + 0.9, 2.4, 1.1)
    ff.add(0, -7.3, y, 3.6, floorH - 0.2, 0.1, PLASTER, KIND['wall'], tag='outer-wall', sd=6)
    ff.add(-1.85, -4.0, y, 0.1, floorH - 0.2, 6.6, PLASTER, KIND['wall'], tag='party-wall', sd=7)
    return {
        'building': '65号棟', 'ghost': ['65号棟'],
        'center': [round(cu, 1), round(cv, 1)], 'floor': round(y, 1),
        'camera': ff.camera(0.1, -3.8, y + 1.0, 4.0, 4.6, 2.6, fov=0.95),
        'boxes': boxes,
        'text': {
            'en': 'A flat in Building 65, the island’s largest block: a middle corridor with flats on both sides, an earth-floored kitchen inside the iron door with the thick concrete slab that was built for a cooking hearth, then a six-tatami and a four-and-a-half-tatami room, and a veranda facing the next wing where the washing hung. Toilets were shared. The plan and the iron doors of the newer wings are documented; the gas stove, refrigerator, television, table and bedding are typical of the 1960s and are assumptions.',
            'ja': '島最大の65号棟の一室。中廊下の両側に住戸が並び、鉄の扉を入ると土間の台所。竈を据える前提で打った厚いコンクリートの台があり、その先に六畳と四畳半、向かいの棟に面したベランダに洗濯物。便所は共同でした。間取りと新しい棟の鉄扉は記録があり、ガス台・冷蔵庫・テレビ・ちゃぶ台・布団は1960年代の一般的な道具で、推定です。',
            'ko': '섬에서 가장 큰 65호동의 한 세대. 중복도 양쪽에 세대가 늘어서고, 철문을 들어서면 흙바닥 부엌. 부뚜막을 놓을 전제로 친 두꺼운 콘크리트 대가 있고, 그 너머에 다다미 6장과 4장 반, 맞은편 동을 향한 베란다에 빨래. 화장실은 공동이었습니다. 평면과 새 동의 철문은 기록이 있고, 가스레인지·냉장고·TV·밥상·이불은 1960년대의 일반적인 물건으로 추정입니다.',
            'zh-Hans': '岛上最大的65号楼中的一户：中间走廊两侧排列住户，进铁门是土间厨房，有为灶台而浇筑的厚混凝土台，往里是六叠和四叠半，面向对面楼翼的阳台晾着衣物。厕所是公用的。户型和新翼的铁门有记录；煤气灶、冰箱、电视、矮桌和被褥是1960年代的常见物品，为推定。',
            'zh-Hant': '島上最大的65號樓中的一戶：中間走廊兩側排列住戶，進鐵門是土間廚房，有為灶台而澆築的厚混凝土台，往裡是六疊和四疊半，面向對面樓翼的陽台晾著衣物。廁所是公用的。戶型和新翼的鐵門有記錄；瓦斯爐、冰箱、電視、矮桌和被褥是1960年代的常見物品，為推定。',
        },
        'sources': [
            {'label': {'en': 'Gunkanjima Excursion: Building 65 (Japanese)', 'ja': '軍艦島エクスカーション 65号棟'}, 'url': 'https://www.gunkanjima-excursion.com/architecture/65-building.html'},
            {'label': {'en': 'Ruins hymn: Building 65 (Japanese)', 'ja': '廃墟賛歌 65号棟'}, 'url': 'http://www.gunkanjima.ne2.jp/Gunkanjima-107.htm'},
            {'label': {'en': 'JBpress: a former resident on life in Building 65 (Japanese)', 'ja': 'JBpress 元島民の証言（65号棟の暮らし）'}, 'url': 'https://jbpress.ismedia.jp/articles/-/64267'},
        ],
    }


def scene_school(model):
    """A classroom on the third floor of the school (Building 70, 1958)."""
    b = building(model, '端島小中学校')
    cu, cv, ang, xr, zr = axis(b['poly'])
    ground, floorH = b['ground'], b['floorH']
    y = ground + 2 * floorH
    boxes = []
    f = Frame(cu, cv, ang, boxes)
    zc = (zr[0] + zr[1]) / 2
    f.add(0, zc, y - 0.05, 16, 0.1, 14, WOOD_LIGHT, KIND['wood'], tag='floor', sd=1)
    f.add(0, zc, y + floorH - 0.25, 16, 0.2, 14, PLASTER, KIND['wall'], tag='ceiling', sd=2)
    f.add(0, zc + 4.5, y, 16, floorH - 0.25, 0.15, PLASTER, KIND['wall'], tag='corridor-wall', sd=3)
    for i in range(2):
        door_wood(f, -3.0 + i * 8.0, zc + 4.42, y, w=0.9)
    f.add(-8.0, zc - 0.5, y, 0.15, floorH - 0.25, 10.0, PLASTER, KIND['wall'], tag='end-wall', sd=4)
    f.add(0, zc - 5.5, y, 16, floorH - 0.25, 0.2, PLASTER, KIND['wall'], tag='window-wall', sd=5)
    for i in range(4):
        window(f, -6.0 + i * 4.0, zc - 5.45, y + 0.9, 3.2, 1.7)
    blackboard(f, -7.9, zc - 0.5, y + 0.8, 3.6, r=90)
    f.add(-6.6, zc + 2.6, y, 1.2, 0.72, 0.6, WOOD, KIND['wood'], tag='teacher-desk', sd=6)
    # desks: 6 rows of 5, wooden (the photographs show one steel desk among wooden ones)
    for i in range(6):
        for j in range(5):
            desk_school(f, -5.0 + i * 1.5, zc - 3.6 + j * 1.4, y, r=90)
    f.add(-1.0, zc + 3.8, y, 0.5, 0.6, 0.4, IRON_PALE, KIND['metal'], tag='stove', assumed=True, p='cyl')
    f.add(2.5, zc + 4.3, y, 4.0, 1.5, 0.35, WOOD_LIGHT, KIND['wood'], tag='cupboard', sd=7)
    f.add(-7.85, zc + 3.4, y + 1.6, 0.05, 0.3, 0.6, [0.92, 0.92, 0.88], KIND['flat'], tag='room-sign')
    bulb(f, -2.0, zc - 1.0, y + floorH - 0.25, 0.4, assumed=False)
    bulb(f, 3.0, zc - 1.0, y + floorH - 0.25, 0.4, assumed=False)
    return {
        'building': '端島小中学校', 'ghost': ['端島小中学校'],
        'center': [round(cu, 1), round(cv, 1)], 'floor': round(y, 1),
        'camera': f.camera(-1.5, zc - 0.3, y + 1.1, 9.5, 5.0, 3.2, fov=0.95),
        'boxes': boxes,
        'text': {
            'en': 'A third-floor classroom of Hashima Elementary and Junior High School (Building 70, completed January 1958, a seventh floor added in 1961). The block stood in the shadow of the flats, so the classrooms face north with tall windows; the corridor runs along the other side. Rows of wooden desks and chairs, the blackboard, the teacher’s desk and the cupboard follow the photographs taken after closure; which grade used this room is not known.',
            'ja': '端島小中学校（70号棟、1958年1月に6階建てで完成、1961年に7階を増築）の3階の教室。高層アパートの影になるため教室は北向きに大きな窓をとり、反対側が廊下でした。木の机と椅子の列、黒板、教壇の机、戸棚は閉山後に撮られた写真のとおりで、この部屋をどの学年が使ったかは分かっていません。',
            'ko': '하시마 초·중학교(70호동, 1958년 1월 6층으로 완공, 1961년 7층 증축)의 3층 교실. 고층 아파트 그늘이 되기 때문에 교실은 북향으로 큰 창을 냈고 반대쪽이 복도였습니다. 나무 책상과 의자의 열, 칠판, 교탁, 수납장은 폐광 후 사진대로이며, 이 교실을 어느 학년이 썼는지는 알 수 없습니다.',
            'zh-Hans': '端岛中小学校（70号楼，1958年1月建成6层，1961年加建7层）三楼的教室。楼被高层公寓遮挡，教室朝北开大窗，另一侧是走廊。成排的木课桌椅、黑板、讲台桌和柜子按闭矿后拍摄的照片绘制；这间教室由哪个年级使用尚不清楚。',
            'zh-Hant': '端島中小學校（70號樓，1958年1月建成6層，1961年加建7層）三樓的教室。樓被高層公寓遮擋，教室朝北開大窗，另一側是走廊。成排的木課桌椅、黑板、講台桌和櫃子按閉礦後拍攝的照片繪製；這間教室由哪個年級使用尚不清楚。',
        },
        'sources': [
            {'label': {'en': 'Imagination and memory: Building 70, the school (Japanese)', 'ja': '想像と記憶 70号棟（端島小中学校）'}, 'url': 'https://www6.cncm.ne.jp/~hashima/70goutou.html'},
            {'label': {'en': 'Ruins hymn: the school (Japanese)', 'ja': '廃墟賛歌 端島小中学校'}, 'url': 'http://www.gunkanjima.ne2.jp/Gunkanjima-108.htm'},
            {'label': {'en': 'Nagasaki City heritage: the school building (Japanese)', 'ja': '長崎市 端島小中学校校舎'}, 'url': 'https://www.nagasakicitylegacy.info/heritage/1335/'},
        ],
    }


def scene_gym(model):
    """The gymnasium on the upper floor of Building 71 (1970)."""
    b = building(model, '端島小中学校体育館')
    cu, cv, ang, xr, zr = axis(b['poly'])
    ground, floorH = b['ground'], b['floorH']
    y = ground + floorH
    L, Wd = xr[1] - xr[0] - 1.0, zr[1] - zr[0] - 1.0
    boxes = []
    f = Frame(cu, cv, ang, boxes)
    f.add(0, 0, y - 0.05, L, 0.1, Wd, WOOD_LIGHT, KIND['wood'], tag='floor', sd=1)
    for zz in (-Wd / 2, Wd / 2):
        f.add(0, zz, y, L, 3.0, 0.2, PLASTER, KIND['wall'], tag='wall', sd=2)
        for i in range(5):
            window(f, -L / 2 + L / 10 + i * L / 5, zz, y + 3.6, L / 5 - 0.8, 1.2)
            window(f, -L / 2 + L / 10 + i * L / 5, zz, y + 5.4, L / 5 - 0.8, 1.2)
    # the stage at one end, the steel trusses of the roof
    f.add(-L / 2 + 2.5, 0, y, 4.5, 0.9, Wd - 1.0, WOOD, KIND['wood'], tag='stage', sd=3)
    f.add(-L / 2 + 1.0, 0, y + 0.9, 0.3, 4.0, Wd - 1.0, CLOTH_RED, KIND['cloth'], assumed=True, tag='curtain', sd=4)
    for i in range(6):
        xx = -L / 2 + 1.5 + i * (L - 3) / 5
        f.add(xx, 0, y + 6.6, 0.25, 0.4, Wd, RUST, KIND['metal'], tag='truss', sd=i)
        for j in range(4):
            f.add(xx, -Wd / 2 + Wd / 8 + j * Wd / 4, y + 6.2, 0.12, 0.45, 0.12, RUST, KIND['metal'], tag='truss')
    f.add(0, 0, y + 7.0, L, 0.15, Wd + 0.6, IRON_PALE, KIND['metal'], tag='roof', sd=5)
    f.add(L / 2 - 1.2, 0, y + 2.6, 0.05, 1.2, 1.8, CLOTH_WHITE, KIND['flat'], tag='backboard')
    f.add(L / 2 - 1.5, 0, y + 2.7, 0.5, 0.03, 0.5, [0.85, 0.45, 0.15], KIND['metal'], tag='hoop', p='cyl')
    f.add(L / 2 - 0.9, 0, y, 0.15, 3.9, 0.15, IRON_PALE, KIND['metal'], tag='post', p='cyl')
    f.add(2.0, -Wd / 2 + 1.5, y, 2.0, 0.5, 1.0, WOOD, KIND['wood'], assumed=True, tag='vaulting-box', sd=6)
    f.add(2.0, -Wd / 2 + 1.5, y + 0.5, 1.8, 0.35, 0.9, CLOTH_CREAM, KIND['cloth'], assumed=True, tag='vaulting-box')
    f.add(-2.0, Wd / 2 - 1.5, y, 2.4, 0.08, 1.2, CLOTH_INDIGO, KIND['cloth'], assumed=True, tag='mat', sd=7)
    return {
        'building': '端島小中学校体育館', 'ghost': ['端島小中学校体育館'],
        'center': [round(cu, 1), round(cv, 1)], 'floor': round(y, 1),
        'camera': f.camera(0, 0, y + 1.5, L * 0.45, Wd * 0.35, 3.5, fov=1.05),
        'boxes': boxes,
        'text': {
            'en': 'The gymnasium of Building 71, completed on 31 March 1970 with the island’s first lift: a two-storey block with the judo and kendo hall and the school kitchen below and the gym above, under steel roof trusses, with a stage at one end and two tiers of windows. The 1992 photographs show the stage, the trusses and the windows; the basketball hoop, curtain, vaulting box and mats are assumptions.',
            'ja': '71号棟の体育館。1970年3月31日に完成し、島で初めてのエレベーターがついた2階建て。1階は柔道場・剣道場と給食室、2階が体育館で、鉄骨のトラス屋根の下に舞台と2段の窓。舞台・トラス・窓は1992年の写真のとおりで、バスケットゴール・幕・跳び箱・マットは推定です。',
            'ko': '71호동 체육관. 1970년 3월 31일 완공, 섬 최초의 엘리베이터가 있던 2층 건물. 1층은 유도·검도장과 급식실, 2층이 체육관으로 철골 트러스 지붕 아래 무대와 2단의 창. 무대·트러스·창은 1992년 사진대로이고, 농구 골대·막·뜀틀·매트는 추정입니다.',
            'zh-Hans': '71号楼的体育馆。1970年3月31日建成，设有岛上第一部电梯的两层楼：一楼是柔道剑道场和供餐室，二楼是体育馆，钢桁架屋顶下有舞台和两层窗。舞台、桁架和窗按1992年照片绘制；篮球架、幕布、跳箱和垫子为推定。',
            'zh-Hant': '71號樓的體育館。1970年3月31日建成，設有島上第一部電梯的兩層樓：一樓是柔道劍道場和供餐室，二樓是體育館，鋼桁架屋頂下有舞台和兩層窗。舞台、桁架和窗按1992年照片繪製；籃球架、幕布、跳箱和墊子為推定。',
        },
        'sources': [
            {'label': {'en': 'School gymnasium, 1992 photograph (Wikimedia Commons)', 'ja': '体育館の1992年の写真（Wikimedia Commons）'}, 'url': 'https://commons.wikimedia.org/wiki/File:Hashima_School_gymnasium-02.jpg'},
            {'label': {'en': 'Imagination and memory: Building 71 (Japanese)', 'ja': '想像と記憶 71号棟（体育館）'}, 'url': 'https://www6.cncm.ne.jp/~hashima/71goutou.html'},
        ],
    }


def scene_hospital(model):
    """A ward on the second floor of Hashima Hospital (Building 69, 1958)."""
    b = building(model, '69号棟')
    cu, cv, ang, xr, zr = axis(b['poly'])
    ground, floorH = b['ground'], b['floorH']
    y = ground + floorH
    boxes = []
    f = Frame(cu, cv, ang, boxes)
    zc = (zr[0] + zr[1]) / 2
    f.add(0, zc, y - 0.05, 12, 0.1, 10, PTILE, KIND['tile'], tag='p-tile-floor', sd=1)
    f.add(0, zc, y + floorH - 0.25, 12, 0.2, 10, PLASTER, KIND['wall'], tag='ceiling', sd=2)
    f.add(0, zc + 3.6, y, 12, floorH - 0.25, 0.15, PLASTER_GREEN, KIND['wall'], tag='corridor-wall', sd=3)
    f.add(-6.0, zc - 0.5, y, 0.15, floorH - 0.25, 8.0, PLASTER_GREEN, KIND['wall'], tag='end-wall', sd=4)
    f.add(0, zc - 4.5, y, 12, floorH - 0.25, 0.2, PLASTER_GREEN, KIND['wall'], tag='window-wall', sd=5)
    for i in range(3):
        window(f, -4.0 + i * 4.0, zc - 4.45, y + 0.9, 2.6, 1.4)
    door_wood(f, 3.5, zc + 3.52, y, w=1.0)
    for i in range(3):
        for j in range(2):
            hospital_bed(f, -4.0 + i * 3.2, zc - 2.6 + j * 4.2, y, r=0)
            f.add(-4.0 + i * 3.2 + 0.8, zc - 2.6 + j * 4.2 - 0.9, y, 0.45, 0.6, 0.45, ENAMEL, KIND['metal'], assumed=True, tag='bedside-cabinet')
    f.add(4.8, zc + 2.4, y, 1.2, 0.75, 0.6, WOOD_LIGHT, KIND['wood'], assumed=True, tag='nurse-desk', sd=6)
    f.add(-5.2, zc + 2.6, y, 0.5, 1.6, 0.5, ENAMEL, KIND['metal'], assumed=True, tag='medicine-cabinet')
    for i in range(4):
        f.add(-5.2, zc + 2.4 + (i % 2) * 0.2, y + 1.62, 0.06, 0.12, 0.06, [0.55, 0.40, 0.25], KIND['glass'], tag='bottle', p='cyl')
    f.add(-3.2, zc + 3.0, y, 0.5, 1.5, 0.5, IRON_PALE, KIND['metal'], assumed=True, tag='iv-stand', p='cyl')
    bulb(f, -2.0, zc - 0.5, y + floorH - 0.25, 0.3, assumed=False)
    bulb(f, 2.5, zc - 0.5, y + floorH - 0.25, 0.3, assumed=False)
    return {
        'building': '69号棟', 'ghost': ['69号棟'],
        'center': [round(cu, 1), round(cv, 1)], 'floor': round(y, 1),
        'camera': f.camera(-0.5, zc - 0.5, y + 1.0, 7.5, 5.0, 2.8, fov=0.95),
        'boxes': boxes,
        'text': {
            'en': 'A ward on the second floor of Hashima Hospital (Building 69, 1958): consulting rooms, an operating theatre and the X-ray room were on the ground floor, wards on the second and third floors, staff quarters on the fourth. In 1969 it had 58 beds. Pale green walls, plastic-tile floors and steel sashes are documented, and the beds were tatami-topped. The bedside cabinets, nurse’s desk, medicine cabinet and drip stand are assumptions.',
            'ja': '端島病院（69号棟、1958年）の2階の病室。1階に診療室・手術室・レントゲン室、2〜3階が病室、4階が医師と看護婦の宿舎で、1969年には58床。薄い緑の壁、Pタイルの床、スチールサッシは記録があり、ベッドは畳敷きでした。床頭台、看護婦の机、薬品棚、点滴台は推定です。',
            'ko': '하시마 병원(69호동, 1958년)의 2층 병실. 1층에 진료실·수술실·X선실, 2~3층이 병실, 4층이 의사와 간호사 숙소로, 1969년에는 58병상. 연녹색 벽, P타일 바닥, 스틸 새시는 기록이 있고 침대는 다다미였습니다. 협탁, 간호사 책상, 약품장, 링거대는 추정입니다.',
            'zh-Hans': '端岛医院（69号楼，1958年）二楼的病房：一楼是诊室、手术室和X光室，二三楼是病房，四楼是医生和护士宿舍，1969年有58张病床。淡绿色墙面、塑料地砖和钢窗有记录，病床铺榻榻米。床头柜、护士桌、药柜和输液架为推定。',
            'zh-Hant': '端島醫院（69號樓，1958年）二樓的病房：一樓是診室、手術室和X光室，二三樓是病房，四樓是醫生和護士宿舍，1969年有58張病床。淡綠色牆面、塑膠地磚和鋼窗有記錄，病床鋪榻榻米。床頭櫃、護士桌、藥櫃和輸液架為推定。',
        },
        'sources': [
            {'label': {'en': 'Ruins hymn: Hashima Hospital (Japanese)', 'ja': '廃墟賛歌 端島病院'}, 'url': 'http://www.gunkanjima.ne2.jp/Gunkanjima-106.htm'},
            {'label': {'en': 'Imagination and memory: the hospital (Japanese)', 'ja': '想像と記憶 端島病院'}, 'url': 'https://www6.cncm.ne.jp/~hashima/byouin.html'},
            {'label': {'en': 'Hashima Hospital, 1992 photographs (Wikimedia Commons)', 'ja': '端島病院の1992年の写真（Wikimedia Commons）'}, 'url': 'https://commons.wikimedia.org/wiki/File:Hashima_Hospital-01.jpg'},
        ],
    }


def scene_ginza(model):
    """The shops under Building 57: Hashima Ginza, the island's shopping street (1939)."""
    b = building(model, '57号棟')
    cu, cv, ang, xr, zr = axis(b['poly'])
    ground = b['ground']
    y = ground
    boxes = []
    f = Frame(cu, cv, ang, boxes)
    L = xr[1] - xr[0]
    f.add(0, 0, y - 0.05, L, 0.1, 10, CONCRETE_DARK, KIND['concrete'], tag='floor', sd=1)
    f.add(0, 0, y + 2.75, L, 0.25, 10, CONCRETE, KIND['concrete'], tag='slab', sd=2)
    for i in range(5):
        f.add(-L / 2 + 1.0 + i * (L - 2) / 4, 0, y, 0.5, 2.75, 0.5, CONCRETE, KIND['concrete'], tag='column', sd=i)
    f.add(0, 4.5, y, L, 2.75, 0.2, PLASTER, KIND['wall'], tag='back-wall', sd=3)
    shops = ((-7.5, (0.85, 0.45, 0.15)), (-3.5, (0.35, 0.55, 0.20)), (0.5, (0.55, 0.60, 0.70)), (4.5, (0.80, 0.25, 0.20)), (8.0, (0.60, 0.50, 0.30)))
    for k, (xx, col) in enumerate(shops):
        stall(f, xx, 2.6, y, r=0, sd=k * 3)
        f.add(xx, 4.35, y + 2.0, 2.6, 0.5, 0.05, [CLOTH_WHITE, CLOTH_INDIGO, CLOTH_CREAM, CLOTH_RED, CLOTH_WHITE][k], KIND['cloth'], assumed=True, tag='shop-sign', sd=k)
        f.add(xx, 4.2, y, 2.4, 1.8, 0.6, WOOD_LIGHT, KIND['wood'], assumed=True, tag='shop-shelves', sd=k + 8)
        for j in range(6):
            f.add(xx - 1.0 + j * 0.4, 4.05, y + 0.6 + (j % 3) * 0.55, 0.22, 0.28, 0.22, [CERAMIC, list(col), [0.35, 0.30, 0.25]][j % 3], KIND['flat'], assumed=True, tag='goods', p='cyl')
    for i in range(4):
        f.add(-9.5 + (i % 2) * 0.7, 0.5 + (i // 2) * 0.5, y + (i // 2) * 0.25, 0.6, 0.25, 0.4, WOOD_PALE, KIND['wood'], assumed=True, tag='fish-box', sd=i)
    f.add(10.0, 1.0, y, 0.7, 0.9, 0.7, WOOD, KIND['wood'], assumed=True, tag='barrel', p='cyl', sd=4)
    f.add(6.5, -1.5, y + 0.3, 1.7, 0.05, 0.05, IRON, KIND['metal'], assumed=True, tag='bicycle')
    for dx in (-0.6, 0.6):
        f.add(6.5 + dx, -1.5, y, 0.65, 0.65, 0.05, IRON, KIND['metal'], assumed=True, tag='wheel', p='cyl')
    for i in range(6):
        f.add(-L / 2 + 1.5 + i * (L - 3) / 5, -0.2, y + 2.3, 0.35, 0.45, 0.35, [0.85, 0.40, 0.30], KIND['cloth'], assumed=True, tag='lantern', p='cyl', sd=i)
    return {
        'building': '57号棟', 'ghost': ['57号棟'],
        'center': [round(cu, 1), round(cv, 1)], 'floor': round(y, 1),
        'camera': f.camera(0, 1.5, y + 1.3, -7.0, -8.5, 2.6, fov=1.0),
        'boxes': boxes,
        'text': {
            'en': 'Hashima Ginza: the open ground floor of Building 57 (1939) along Shiofuri Street, where the island’s shops stood: a grocer, a fishmonger, a sake and general store, a clothes shop, a tobacconist and eating houses, with a daily open-air market of traders who came by boat. The colonnade and the row of shops are documented; the stalls, goods, signs and lanterns are drawn as a typical market of the 1960s and are assumptions.',
            'ja': '端島銀座。57号棟（1939年）の1階のピロティが塩降通りに面し、酒屋、雑貨、衣類、飲食店、料理屋、タバコ屋、八百屋、魚屋が並び、対岸から船で来る行商の青空市も毎日立ちました。柱の列と商店が並んだことは記録があり、屋台・商品・看板・提灯は1960年代の市場の一般的な姿として描いた推定です。',
            'ko': '하시마 긴자. 57호동(1939년) 1층의 필로티가 시오후리 거리에 면해 술집, 잡화, 의류, 음식점, 요릿집, 담배 가게, 채소 가게, 생선 가게가 늘어섰고, 건너편에서 배로 오는 행상의 노천 시장도 매일 열렸습니다. 기둥 열과 상점이 늘어선 것은 기록이 있고, 노점·상품·간판·초롱은 1960년대 시장의 일반적인 모습으로 그린 추정입니다.',
            'zh-Hans': '端岛银座：57号楼（1939年）底层的架空层面向盐降通，酒铺、杂货、服装、饮食店、料理店、烟草店、菜店和鱼店排列其间，从对岸乘船而来的小贩每天摆露天市。柱廊和店铺成排有记录；摊位、货物、招牌和灯笼按1960年代市场的常见样子绘制，为推定。',
            'zh-Hant': '端島銀座：57號樓（1939年）底層的架空層面向鹽降通，酒鋪、雜貨、服裝、飲食店、料理店、菸草店、菜店和魚店排列其間，從對岸乘船而來的小販每天擺露天市。柱廊和店鋪成排有記錄；攤位、貨物、招牌和燈籠按1960年代市場的常見樣子繪製，為推定。',
        },
        'sources': [
            {'label': {'en': 'President Online: the shops of Hashima (Japanese)', 'ja': 'プレジデントオンライン 端島銀座と商店'}, 'url': 'https://president.jp/articles/-/87741'},
            {'label': {'en': 'Imagination and memory: the Nikkyu blocks and their shops (Japanese)', 'ja': '想像と記憶 日給社宅（1階の商店）'}, 'url': 'https://www6.cncm.ne.jp/~hashima/nikkyuu.html'},
            {'label': {'en': 'Shiofuri Street, 1992 photograph (Wikimedia Commons)', 'ja': '塩降通りの1992年の写真（Wikimedia Commons）'}, 'url': 'https://commons.wikimedia.org/wiki/File:Hashima_Shiofuri_street-01.jpg'},
        ],
    }


def scene_nikkyu(model):
    """The seaward corridor and a flat in Building 16, the oldest of the Nikkyu blocks (1918)."""
    b = building(model, '16号棟')
    cu, cv, ang, xr, zr = axis(b['poly'])
    ground, floorH = b['ground'], b['floorH']
    y = ground + 3 * floorH
    boxes = []
    f = Frame(cu, cv, ang, boxes)
    # which side faces the open sea (west)? the side whose outward normal points west in the crop frame
    west = (-0.834, -0.5517)
    nz = (-math.sin(math.radians(ang)), math.cos(math.radians(ang)))
    sea = 1 if (nz[0] * west[0] + nz[1] * west[1]) > 0 else -1
    zsea = (zr[1] - 1.0) if sea > 0 else (zr[0] + 1.0)
    f.add(0, zsea, y - 0.05, 20, 0.1, 2.2, CONCRETE_DARK, KIND['concrete'], tag='corridor', sd=1)
    f.add(0, zsea + sea * 1.1, y, 20, 1.1, 0.25, CONCRETE, KIND['concrete'], tag='sea-parapet', sd=2)
    f.add(0, zsea + sea * 1.1, y + 1.1, 20, 0.05, 0.3, CONCRETE_DARK, KIND['concrete'], tag='sea-parapet')
    for i in range(6):
        xx = -8.5 + i * 3.4
        f.add(xx, zsea - sea * 1.1, y, 3.4, floorH - 0.2, 0.2, CONCRETE, KIND['concrete'], tag='front', sd=i + 3)
        door_wood(f, xx, zsea - sea * 1.0 + sea * 0.05, y, r=0 if sea < 0 else 180, w=0.9)
        f.add(xx, zsea - sea * 0.95, y - 0.02, 1.0, 0.04, 0.25, [0.40, 0.36, 0.30], KIND['soil'], tag='doma-step')
        if i % 2 == 0:
            washer(f, xx + 1.2, zsea - sea * 0.6, y)
        else:
            f.add(xx + 1.2, zsea - sea * 0.6, y, 0.5, 0.5, 0.5, CONCRETE_DARK, KIND['concrete'], assumed=True, tag='water-tank', sd=i)
    f.add(0, zsea + sea * 0.6, y + 1.75, 19, 0.02, 0.02, IRON_PALE, KIND['flat'], assumed=True, tag='pole')
    for i in range(9):
        f.add(-8.0 + i * 2.0, zsea + sea * 0.6, y + 1.2, 0.5, 0.65, 0.02, [CLOTH_WHITE, CLOTH_INDIGO, CLOTH_CREAM][i % 3], KIND['cloth'], assumed=True, tag='laundry', sd=i)
    f.add(-10.0, zsea, y, 0.1, floorH - 0.3, 2.2, WOOD, KIND['wood'], tag='storm-door', sd=20)
    # one flat cut open: entrance doma, 6 tatami, 4.5 tatami toward the light well
    ff = Frame(*f.at(-1.7, zsea - sea * 1.2), ang, boxes)
    ff.add(0, -sea * 0.5, y - 0.04, 3.4, 0.04, 1.0, [0.40, 0.36, 0.30], KIND['soil'], tag='doma')
    kamado(ff, -1.2, -sea * 0.55, y - 0.02, r=90)
    sink(ff, 0.9, -sea * 0.6, y, r=0 if sea > 0 else 180)
    for k in range(2):
        ff.add(1.15 + k * 0.3, -sea * 1.0, y + 0.95, 0.03, 0.25, 0.03, IRON_PALE, KIND['metal'], tag='two-taps', p='cyl')
    floor_tatami(ff, 0, -sea * 2.4, y, 3.4, 2.7, old=True)
    floor_tatami(ff, 0, -sea * 5.1, y, 2.7, 2.7, old=True)
    ff.add(0, -sea * 3.75, y, 3.4, 2.4, 0.08, PAPER, KIND['paper'], assumed=True, tag='fusuma')
    chabudai(ff, 0.2, -sea * 2.4, y)
    tansu(ff, -1.3, -sea * 2.9, y, r=90)
    futon(ff, 0.0, -sea * 5.1, y + 0.05)
    bulb(ff, 0.2, -sea * 2.4, y + floorH - 0.25, 0.4)
    ff.add(-1.75, -sea * 3.5, y, 0.12, floorH - 0.2, 6.0, PLASTER, KIND['wall'], tag='party-wall', sd=21)
    ff.add(1.75, -sea * 3.5, y, 0.12, floorH - 0.2, 6.0, PLASTER, KIND['wall'], tag='party-wall', sd=22)
    ff.add(0, -sea * 6.5, y, 3.4, floorH - 0.2, 0.15, PLASTER, KIND['wall'], tag='court-wall', sd=23)
    window(ff, 0, -sea * 6.45, y + 0.9, 1.6, 1.0)
    return {
        'building': '16号棟', 'ghost': ['16号棟', '17号棟'],
        'center': [round(cu, 1), round(cv, 1)], 'floor': round(y, 1),
        'camera': ff.camera(0.0, -sea * 2.0, y + 1.0, 4.6, -sea * 6.0, 3.0, fov=0.95),
        'boxes': boxes,
        'text': {
            'en': 'Building 16 (1918), the oldest of the five “day-wage” blocks that face the open sea: a wide seaward corridor with a parapet against the spray, closed at the ends by wooden storm doors, and wooden sliding doors into each flat. Inside, a sunken earth floor with the hearth and a sink with two taps, one for fresh water and one for sea water, then a six-tatami and a four-and-a-half-tatami room toward the narrow light well. Washing machines and laundry lined the corridor in later years. The corridor, doors, taps and plan are documented; the furniture is assumed.',
            'ja': '外海に面した5棟の日給社宅のうち最も古い16号棟（1918年）。海側に潮よけの壁を持つ大廊下があり、端は木の防潮扉、各戸は木の引き戸。中は一段低い土間に竈と、真水と海水の蛇口が2つ並ぶ流し、その先に六畳と四畳半が狭い光庭に向きます。のちには廊下に洗濯機と洗濯物が並びました。廊下・戸・蛇口・間取りは記録があり、家具は推定です。',
            'ko': '외해에 면한 다섯 동의 일급사택 가운데 가장 오래된 16호동(1918년). 바다 쪽에 물보라를 막는 벽이 있는 큰 복도가 있고, 끝은 나무 방조문, 각 세대는 나무 미닫이. 안은 한 단 낮은 흙바닥에 부뚜막과 민물·바닷물 수도꼭지 두 개가 달린 개수대, 그 너머에 다다미 6장과 4장 반이 좁은 채광정을 향합니다. 뒷날에는 복도에 세탁기와 빨래가 늘어섰습니다. 복도·문·수도꼭지·평면은 기록이 있고 가구는 추정입니다.',
            'zh-Hans': '面向外海的五栋“日薪社宅”中最老的16号楼（1918年）：海侧是带防浪墙的大走廊，两端是木制防潮门，各户是木推拉门。屋内是低一级的土间，有灶台和带淡水、海水两个龙头的水槽，往里是六叠和四叠半，朝向狭窄的采光天井。后来走廊上排满了洗衣机和晾晒的衣物。走廊、门、龙头和户型有记录；家具为推定。',
            'zh-Hant': '面向外海的五棟「日薪社宅」中最老的16號樓（1918年）：海側是帶防浪牆的大走廊，兩端是木製防潮門，各戶是木推拉門。屋內是低一級的土間，有灶台和帶淡水、海水兩個龍頭的水槽，往裡是六疊和四疊半，朝向狹窄的採光天井。後來走廊上排滿了洗衣機和晾曬的衣物。走廊、門、龍頭和戶型有記錄；家具為推定。',
        },
        'sources': [
            {'label': {'en': 'Imagination and memory: the Nikkyu blocks (Japanese)', 'ja': '想像と記憶 日給社宅'}, 'url': 'https://www6.cncm.ne.jp/~hashima/nikkyuu.html'},
            {'label': {'en': 'Ruins hymn: the Nikkyu blocks (Japanese)', 'ja': '廃墟賛歌 日給社宅'}, 'url': 'http://www.gunkanjima.ne2.jp/Gunkanjima-102.htm'},
            {'label': {'en': 'Gunkanjima Truth: life on Hashima (English)', 'ja': 'Gunkanjima Truth 端島の暮らし（英語）'}, 'url': 'https://www.gunkanjima-truth.com/l/en-US/article/Life-on-Hashima-where-population-density-was-highest-in-Japan'},
        ],
    }


def scene_bath(model):
    """The communal bath in the basement of Building 61 (1953), the 'lower bath'."""
    b = building(model, '61号棟')
    cu, cv, ang, xr, zr = axis(b['poly'])
    ground, floorH = b['ground'], b['floorH']
    y = ground - floorH + 0.3
    boxes = []
    f = Frame(cu, cv, ang, boxes)
    L, Wd = 14.0, 7.0
    f.add(0, 0, y - 0.05, L, 0.1, Wd, TILE_WHITE, KIND['tile'], tag='floor', sd=1)
    f.add(0, 0, y + floorH - 0.35, L, 0.25, Wd, CONCRETE, KIND['concrete'], tag='ceiling', sd=2)
    for zz in (-Wd / 2, Wd / 2):
        f.add(0, zz, y, L, floorH - 0.35, 0.2, TILE_BLUE, KIND['tile'], tag='wall', sd=3)
    f.add(-L / 2, 0, y, 0.2, floorH - 0.35, Wd, TILE_BLUE, KIND['tile'], tag='wall', sd=4)
    tub(f, 1.5, 0.6, y, 7.0, 3.6, 0.7, 0.2, TILE_WHITE, tag='tub')
    f.add(-4.0, -1.8, y + 0.9, 0.06, 0.06, 4.0, IRON_PALE, KIND['metal'], tag='steam-pipe', p='cyl', assumed=True)
    for i in range(5):
        f.add(-5.5 + i * 1.5, -3.2, y + 0.75, 0.04, 0.3, 0.04, IRON_PALE, KIND['metal'], tag='tap', p='cyl')
        f.add(-5.5 + i * 1.5, -3.3, y + 0.35, 0.28, 0.2, 0.28, WOOD_PALE, KIND['wood'], assumed=True, tag='bucket', p='cyl', sd=i)
        f.add(-5.5 + i * 1.5, -2.7, y, 0.3, 0.2, 0.3, WOOD_PALE, KIND['wood'], assumed=True, tag='stool', p='cyl', sd=i + 5)
    f.add(-5.8, 2.0, y, 1.6, 0.5, 1.4, TILE_WHITE, KIND['tile'], tag='rinse-basin')
    f.add(-5.8, 2.0, y + 0.4, 1.3, 0.02, 1.1, WATER, KIND['water'], tag='fresh-water')
    f.add(-L / 2 + 1.5, 0, y, 0.15, 1.5, Wd - 0.4, WOOD, KIND['wood'], assumed=True, tag='partition', sd=6)
    f.add(-L / 2 + 0.7, 0, y, 0.45, 1.9, 4.0, WOOD, KIND['wood'], assumed=True, tag='shelves', sd=7)
    for i in range(8):
        f.add(-L / 2 + 0.7, -1.6 + (i % 4) * 1.0, y + 0.3 + (i // 4) * 0.9, 0.36, 0.25, 0.36, WOOD_PALE, KIND['wood'], assumed=True, tag='basket', p='cyl', sd=i)
    bulb(f, -1.0, 0, y + floorH - 0.35, 0.3, assumed=False)
    bulb(f, 3.5, 0, y + floorH - 0.35, 0.3, assumed=False)
    return {
        'building': '61号棟', 'ghost': ['61号棟'],
        'center': [round(cu, 1), round(cv, 1)], 'floor': round(y, 1),
        'camera': f.camera(0.5, 0.3, y + 1.0, -5.5, -4.5, 1.6, fov=1.0),
        'boxes': boxes,
        'text': {
            'en': 'The “lower bath” in the basement of Building 61 (1953), one of the island’s three communal baths, free of charge and open from three to eight in the evening: a tiled tub that took about twenty people at once, heated with steam and hot water from the pit boilers, a basin of fresh water for the final rinse, and a changing room with basket shelves. Miners washed off the coal in the bath by the mine office first. Only the managers’ flats in Building 3 and the club had baths of their own. The tub size and fittings are assumptions.',
            'ja': '61号棟（1953年）地下の「下風呂」。島に3か所あった共同浴場のひとつで、無料、営業は午後3時から8時。20人ほどが一度に入れるタイルの浴槽を坑内のボイラーの蒸気と湯で沸かし、上がり湯は真水の水槽、脱衣場には籠の棚。鉱員はまず鉱業所そばの浴場で炭を落としました。内風呂があったのは3号棟の幹部住宅とクラブだけです。浴槽の大きさと設備は推定です。',
            'ko': '61호동(1953년) 지하의 「아래 목욕탕」. 섬에 세 곳 있던 공동 목욕탕 중 하나로 무료, 영업은 오후 3시부터 8시. 스무 명쯤 한꺼번에 들어가는 타일 욕조를 갱내 보일러의 증기와 온수로 데웠고, 마무리는 민물 수조, 탈의실에는 바구니 선반. 광부는 먼저 광업소 옆 목욕탕에서 석탄을 씻어냈습니다. 개인 욕실이 있던 곳은 3호동 간부 주택과 클럽뿐입니다. 욕조 크기와 설비는 추정입니다.',
            'zh-Hans': '61号楼（1953年）地下的“下浴场”，岛上三处公共浴场之一，免费，下午三点到八点开放：约二十人可同时入浴的瓷砖浴池，用矿井锅炉的蒸汽和热水加热，最后用淡水槽冲洗，更衣室有放篮子的架子。矿工先在矿业所旁的浴场洗掉煤灰。只有3号楼的干部住宅和俱乐部有独立浴室。浴池尺寸和设施为推定。',
            'zh-Hant': '61號樓（1953年）地下的「下浴場」，島上三處公共浴場之一，免費，下午三點到八點開放：約二十人可同時入浴的瓷磚浴池，用礦井鍋爐的蒸汽和熱水加熱，最後用淡水槽沖洗，更衣室有放籃子的架子。礦工先在礦業所旁的浴場洗掉煤灰。只有3號樓的幹部住宅和俱樂部有獨立浴室。浴池尺寸和設施為推定。',
        },
        'sources': [
            {'label': {'en': 'Gunkanjima Digital Museum: the communal baths (Japanese)', 'ja': '軍艦島デジタルミュージアム 共同浴場'}, 'url': 'https://www.gunkanjima-museum.jp/data/259/detail/'},
            {'label': {'en': 'JBpress: a former resident on the lower bath (Japanese)', 'ja': 'JBpress 元島民の証言（下風呂）'}, 'url': 'https://jbpress.ismedia.jp/articles/-/64267'},
            {'label': {'en': 'Imagination and memory: Buildings 59, 60 and 61 (Japanese)', 'ja': '想像と記憶 59・60・61号棟'}, 'url': 'https://www6.cncm.ne.jp/~hashima/596061.html'},
        ],
    }


def scene_no3(model):
    """A managers' flat with its own bath in Building 3 (1959), the highest building on the island."""
    b = building(model, '3号棟')
    cu, cv, ang, xr, zr = axis(b['poly'])
    ground, floorH = b['ground'], b['floorH']
    y = ground + floorH
    boxes = []
    f = Frame(cu, cv, ang, boxes)
    zc = (zr[0] + zr[1]) / 2
    f.add(0, zc, y - 0.05, 11, 0.1, 7.5, WOOD_LIGHT, KIND['wood'], tag='floor', sd=1)
    f.add(0, zc, y + floorH - 0.25, 11, 0.2, 7.5, PLASTER, KIND['wall'], tag='ceiling', sd=2)
    f.add(0, zc + 3.7, y, 11, floorH - 0.25, 0.15, PLASTER, KIND['wall'], tag='back-wall', sd=3)
    f.add(-5.5, zc, y, 0.15, floorH - 0.25, 7.5, PLASTER, KIND['wall'], tag='end-wall', sd=4)
    door_iron(f, 4.5, zc + 3.62, y)
    f.add(4.2, zc + 2.6, y - 0.04, 1.6, 0.04, 1.6, CONCRETE_DARK, KIND['concrete'], tag='genkan', sd=5)
    sink(f, 2.0, zc + 3.3, y, r=0, assumed=True)
    f.add(1.0, zc + 3.3, y, 0.6, 0.8, 0.55, ENAMEL, KIND['metal'], assumed=True, tag='gas-stove')
    fridge(f, 0.2, zc + 3.3, y)
    f.add(2.6, zc + 1.6, y, 1.2, 0.72, 0.7, WOOD_LIGHT, KIND['wood'], assumed=True, tag='dining-table', sd=6)
    for dx in (-0.35, 0.35):
        f.add(2.6 + dx, zc + 0.95, y, 0.4, 0.45, 0.4, WOOD, KIND['wood'], assumed=True, tag='chair')
    dishes(f, 2.6, zc + 1.6, y + 0.72)
    floor_tatami(f, -1.4, zc + 1.9, y, 3.6, 2.7)
    floor_tatami(f, -1.4, zc - 1.3, y, 3.6, 2.7)
    floor_tatami(f, -4.2, zc - 1.6, y, 2.7, 2.7)
    f.add(-1.4, zc + 0.3, y, 3.6, 2.4, 0.08, PAPER, KIND['paper'], assumed=True, tag='fusuma')
    f.add(-3.3, zc - 1.6, y, 0.08, 2.4, 2.7, PAPER, KIND['paper'], assumed=True, tag='fusuma')
    chabudai(f, -1.4, zc + 1.9, y)
    tv(f, -2.9, zc + 2.9, y + 0.3, r=45)
    tansu(f, 0.0, zc - 1.6, y, r=-90)
    futon(f, -1.4, zc - 1.3, y + 0.05, r=90)
    f.add(0.4, zc + 1.9, y + 0.7, 0.25, 0.15, 0.2, [0.12, 0.12, 0.12], KIND['flat'], assumed=True, tag='telephone')
    f.add(0.4, zc + 1.9, y, 0.5, 0.7, 0.4, WOOD, KIND['wood'], assumed=True, tag='phone-stand')
    # the bathroom: a tiled tub and a wooden duckboard
    f.add(4.0, zc - 1.8, y, 3.0, floorH - 0.3, 0.12, TILE_WHITE, KIND['tile'], tag='bath-wall', sd=7)
    f.add(2.5, zc - 2.9, y, 0.12, floorH - 0.3, 2.2, TILE_WHITE, KIND['tile'], tag='bath-wall', sd=8)
    f.add(4.0, zc - 2.9, y - 0.04, 3.0, 0.04, 2.2, TILE_WHITE, KIND['tile'], tag='bath-floor', sd=9)
    tub(f, 4.6, zc - 3.1, y, 1.4, 1.0, 0.6, 0.12, TILE_WHITE, tag='home-bath')
    f.add(3.2, zc - 3.0, y + 0.04, 0.9, 0.05, 1.2, WOOD_PALE, KIND['wood'], assumed=True, tag='duckboard')
    f.add(3.0, zc - 2.3, y, 0.4, 0.9, 0.25, IRON_PALE, KIND['metal'], assumed=True, tag='water-heater')
    bulb(f, -1.4, zc + 1.9, y + floorH - 0.25, 0.4)
    bulb(f, 2.6, zc + 1.6, y + floorH - 0.25, 0.4)
    window(f, -1.4, zc - 3.7, y + 0.9, 2.4, 1.1)
    f.add(-1.4, zc - 3.7, y, 8.0, floorH - 0.25, 0.15, PLASTER, KIND['wall'], tag='outer-wall', sd=10)
    return {
        'building': '3号棟', 'ghost': ['3号棟'],
        'center': [round(cu, 1), round(cv, 1)], 'floor': round(y, 1),
        'camera': f.camera(0.5, zc + 0.6, y + 1.0, 6.5, -5.0, 3.0, fov=1.0),
        'boxes': boxes,
        'text': {
            'en': 'A flat in Building 3 (1959), the managers’ housing on the highest ground of the island: twenty flats of two or three rooms, each with its own bath, a telephone and a door chime, the only ordinary homes on Hashima with a bath. Shown as a two-room flat with a kitchen, a dining table, a tiled bathroom and a bath heater. The building and its baths are documented; the room plan and furnishings are assumptions.',
            'ja': '島でいちばん高い場所に建つ幹部職員住宅、3号棟（1959年）の一室。2〜3室の住戸が20戸、各戸に風呂・電話・呼び鈴があり、端島で内風呂のあるふつうの住まいはここだけでした。台所と食卓、タイル張りの浴室と風呂釜を持つ2室の住戸として描いています。建物と各戸の風呂は記録があり、間取りと家具は推定です。',
            'ko': '섬에서 가장 높은 곳에 선 간부 직원 주택 3호동(1959년)의 한 세대. 2~3실 세대가 20세대, 각 세대에 욕실·전화·초인종이 있어 하시마에서 욕실이 있는 보통 집은 이곳뿐이었습니다. 부엌과 식탁, 타일 욕실과 욕조 가열기를 갖춘 2실 세대로 그렸습니다. 건물과 각 세대의 욕실은 기록이 있고 평면과 가구는 추정입니다.',
            'zh-Hans': '建在岛上最高处的干部职员住宅3号楼（1959年）的一户：二到三室的住户共20户，各户有浴室、电话和门铃，是端岛上唯一带浴室的普通住宅。按带厨房、餐桌、瓷砖浴室和热水器的两室住户绘制。建筑和各户浴室有记录；户型和家具为推定。',
            'zh-Hant': '建在島上最高處的幹部職員住宅3號樓（1959年）的一戶：二到三室的住戶共20戶，各戶有浴室、電話和門鈴，是端島上唯一帶浴室的普通住宅。按帶廚房、餐桌、瓷磚浴室和熱水器的兩室住戶繪製。建築和各戶浴室有記錄；戶型和家具為推定。',
        },
        'sources': [
            {'label': {'en': 'Imagination and memory: Building 3 (Japanese)', 'ja': '想像と記憶 3号棟'}, 'url': 'https://www6.cncm.ne.jp/~hashima/3goutou.html'},
            {'label': {'en': 'Gunkanjima Digital Museum: the communal baths (Japanese)', 'ja': '軍艦島デジタルミュージアム 共同浴場'}, 'url': 'https://www.gunkanjima-museum.jp/data/259/detail/'},
        ],
    }


def scene_roofgarden(model):
    """The rooftop farm on Buildings 18 and 19 (1963-67) and the archery hall on 19."""
    b = building(model, '18号棟')
    cu, cv, ang, xr, zr = axis(b['poly'])
    ground, floorH, storeys = b['ground'], b['floorH'], b['storeys']
    y = ground + storeys * floorH
    boxes = []
    f = Frame(cu, cv, ang, boxes)
    L, Wd = xr[1] - xr[0], zr[1] - zr[0]
    f.add(0, 0, y - 0.05, L, 0.1, Wd, CONCRETE, KIND['concrete'], tag='roof', sd=1)
    for zz in (-Wd / 2, Wd / 2):
        f.add(0, zz, y, L, 0.9, 0.25, CONCRETE, KIND['concrete'], tag='parapet', sd=2)
    for i in range(4):
        xx = -L / 2 + 3.5 + i * (L - 7) / 3
        f.add(xx, 0, y, 4.5, 0.35, Wd - 2.5, WOOD, KIND['wood'], tag='bed-frame', sd=i)
        f.add(xx, 0, y + 0.1, 4.3, 0.3, Wd - 2.7, SOIL, KIND['soil'], tag='soil', sd=i + 4)
        for j in range(5):
            for k in range(2):
                px, pz = xx - 1.8 + j * 0.9, -1.0 + k * 2.0
                f.add(px, pz, y + 0.4, 0.03, 1.4, 0.03, WOOD, KIND['wood'], tag='stake', p='cyl')
                f.add(px, pz, y + 0.7, 0.55, 0.9, 0.55, LEAF, KIND['leaf'], tag='plant', p='ball', sd=j + k)
                if i == 0:
                    f.add(px + 0.15, pz + 0.1, y + 0.9, 0.09, 0.09, 0.09, [0.85, 0.20, 0.15], KIND['flat'], tag='tomato', p='ball')
                elif i == 2:
                    f.add(px + 0.1, pz - 0.1, y + 0.75, 0.07, 0.16, 0.07, [0.25, 0.15, 0.35], KIND['flat'], tag='aubergine', p='ball')
    f.add(L / 2 - 2.5, 0, y, 3.0, 0.3, Wd - 2.5, [0.35, 0.45, 0.30], KIND['water'], tag='rice-plot')
    for j in range(6):
        for k in range(3):
            f.add(L / 2 - 3.6 + j * 0.45, -1.0 + k * 1.0, y + 0.3, 0.12, 0.5, 0.12, [0.55, 0.65, 0.30], KIND['leaf'], tag='rice', p='ball')
    f.add(0, -Wd / 2 + 0.7, y, L - 2, 0.2, 0.5, WOOD_PALE, KIND['wood'], assumed=True, tag='walkway')
    f.add(-L / 2 + 1.0, Wd / 2 - 1.0, y, 0.6, 0.6, 0.6, WOOD, KIND['wood'], assumed=True, tag='water-butt', p='cyl')
    b19 = building(model, '19号棟')
    c19u, c19v, ang19, xr19, zr19 = axis(b19['poly'])
    g = Frame(c19u, c19v, ang19, boxes)
    y19 = b19['ground'] + b19['storeys'] * b19['floorH']
    g.add(0, 0, y19 - 0.05, xr19[1] - xr19[0], 0.1, zr19[1] - zr19[0], CONCRETE, KIND['concrete'], tag='roof19', sd=3)
    g.add(-2.0, 0, y19, 8.0, 2.6, 4.5, WOOD, KIND['wood'], assumed=True, tag='archery-hall', sd=9)
    g.add(-2.0, 0, y19 + 2.6, 8.6, 0.3, 5.1, [0.30, 0.30, 0.32], KIND['metal'], assumed=True, tag='archery-roof')
    g.add(8.0, 0, y19, 0.4, 1.6, 1.8, [0.55, 0.45, 0.30], KIND['cloth'], assumed=True, tag='target-bank')
    g.add(7.75, 0, y19 + 0.6, 0.05, 0.36, 0.36, CLOTH_WHITE, KIND['flat'], assumed=True, tag='target')
    return {
        'building': '18号棟', 'ghost': ['18号棟', '19号棟'],
        'center': [round(cu, 1), round(cv, 1)], 'floor': round(y, 1),
        'camera': f.camera(0, 0, y + 0.8, -L * 0.55, -Wd * 0.9, 4.5, fov=0.95),
        'boxes': boxes,
        'text': {
            'en': 'The rooftop farm on Buildings 18 and 19, nine floors above the sea: soil was carried up to beds on the roof in the 1960s and the children grew tomatoes, cucumbers and aubergines, then rice in the autumn, with a harvest festival in 1966 and the rice offered to the shrine. A wooden archery hall stood on the roof of Building 19 and goats were kept on Building 16. The farm and the archery hall are documented; the layout of the beds, the walkway and the target are assumptions. The 1992 photographs show what remained of the beds.',
            'ja': '18・19号棟の屋上の菜園。海から9階の高さの屋上に土を運び上げ、1960年代に子どもたちがトマト・キュウリ・ナスを育て、秋には稲も植え、1966年に収穫祭をして餅米を神社に納めました。19号棟の屋上には木造の弓道場、16号棟の屋上では山羊も飼われていました。菜園と弓道場は記録があり、畝の配置・通路・的は推定です。1992年の写真に菜園の跡が写っています。',
            'ko': '18·19호동 옥상의 밭. 바다에서 9층 높이의 옥상으로 흙을 날라 올려 1960년대에 아이들이 토마토·오이·가지를 기르고 가을에는 벼도 심어 1966년에 수확제를 열고 찹쌀을 신사에 바쳤습니다. 19호동 옥상에는 목조 궁도장, 16호동 옥상에서는 염소도 키웠습니다. 밭과 궁도장은 기록이 있고 이랑 배치·통로·과녁은 추정입니다. 1992년 사진에 밭의 흔적이 남아 있습니다.',
            'zh-Hans': '18、19号楼屋顶的菜园：1960年代把土运上离海面九层高的屋顶，孩子们种番茄、黄瓜和茄子，秋天还种稻子，1966年办了收获祭，把糯米献给神社。19号楼屋顶有木造弓道场，16号楼屋顶还养过山羊。菜园和弓道场有记录；畦的布置、通道和箭靶为推定。1992年的照片上还能看到菜园的遗迹。',
            'zh-Hant': '18、19號樓屋頂的菜園：1960年代把土運上離海面九層高的屋頂，孩子們種番茄、黃瓜和茄子，秋天還種稻子，1966年辦了收穫祭，把糯米獻給神社。19號樓屋頂有木造弓道場，16號樓屋頂還養過山羊。菜園和弓道場有記錄；畦的布置、通道和箭靶為推定。1992年的照片上還能看到菜園的遺跡。',
        },
        'sources': [
            {'label': {'en': 'Imagination and memory: the rooftop farm (Japanese)', 'ja': '想像と記憶 日給社宅の屋上菜園'}, 'url': 'https://www6.cncm.ne.jp/~hashima/nikkyuu2.html'},
            {'label': {'en': 'Gunkanjima Digital Museum: the rooftop farm (Japanese)', 'ja': '軍艦島デジタルミュージアム 屋上菜園'}, 'url': 'https://www.gunkanjima-museum.jp/data/983/detail/'},
            {'label': {'en': 'Buildings 18 and 19 rooftop, 1992 photograph (Wikimedia Commons)', 'ja': '18・19号棟屋上の1992年の写真（Wikimedia Commons）'}, 'url': 'https://commons.wikimedia.org/wiki/File:Hashima_18_and_19_Building_Rooftop-03.jpg'},
        ],
    }


LABELS = {'no30': {'en': 'Light well and a flat', 'ja': '中庭の回廊と一室', 'ko': '채광정 복도와 한 세대', 'zh-Hans': '天井外廊与一户', 'zh-Hant': '天井外廊與一戶'}, 'shrine': {'en': 'The shrine precinct', 'ja': '神社の境内', 'ko': '신사 경내', 'zh-Hans': '神社境内', 'zh-Hant': '神社境內'}, 'no65roof': {'en': 'Rooftop nursery', 'ja': '屋上の保育園', 'ko': '옥상 보육원', 'zh-Hans': '屋顶保育园', 'zh-Hant': '屋頂保育園'}, 'no65flat': {'en': 'A flat', 'ja': '住戸（六畳と四畳半）', 'ko': '한 세대', 'zh-Hans': '一户住宅', 'zh-Hant': '一戶住宅'}, 'school': {'en': 'A classroom', 'ja': '3階の教室', 'ko': '3층 교실', 'zh-Hans': '三楼的教室', 'zh-Hant': '三樓的教室'}, 'gym': {'en': 'The gymnasium', 'ja': '体育館', 'ko': '체육관', 'zh-Hans': '体育馆', 'zh-Hant': '體育館'}, 'hospital': {'en': 'A ward', 'ja': '2階の病室', 'ko': '2층 병실', 'zh-Hans': '二楼的病房', 'zh-Hant': '二樓的病房'}, 'ginza': {'en': 'Hashima Ginza shops', 'ja': '1階の商店街（端島銀座）', 'ko': '1층 상점가(하시마 긴자)', 'zh-Hans': '底层商店街（端岛银座）', 'zh-Hant': '底層商店街（端島銀座）'}, 'nikkyu': {'en': 'Corridor and a flat', 'ja': '大廊下と住戸', 'ko': '큰 복도와 한 세대', 'zh-Hans': '大走廊与一户', 'zh-Hant': '大走廊與一戶'}, 'bath': {'en': 'Basement bath', 'ja': '地下の共同浴場', 'ko': '지하 공동 목욕탕', 'zh-Hans': '地下公共浴场', 'zh-Hant': '地下公共浴場'}, 'no3': {'en': 'A managers’ flat', 'ja': '幹部住宅の一室', 'ko': '간부 주택의 한 세대', 'zh-Hans': '干部住宅的一户', 'zh-Hant': '幹部住宅的一戶'}, 'roofgarden': {'en': 'Rooftop farm', 'ja': '屋上菜園', 'ko': '옥상 밭', 'zh-Hans': '屋顶菜园', 'zh-Hant': '屋頂菜園'}}


def main():
    model = json.loads((WEB / 'gunkanjima-model.json').read_text(encoding='utf-8'))
    at = terrain()
    scenes = {
        'no30': scene_no30(model), 'shrine': scene_shrine(model, at),
        'no65roof': scene_no65roof(model), 'no65flat': scene_no65flat(model),
        'school': scene_school(model), 'gym': scene_gym(model), 'hospital': scene_hospital(model),
        'ginza': scene_ginza(model), 'nikkyu': scene_nikkyu(model), 'bath': scene_bath(model),
        'no3': scene_no3(model), 'roofgarden': scene_roofgarden(model),
    }
    out = {'note': 'Parts in the 1962 crop frame (u, v px; y m above sea level; sizes in m). a=1 marks an assumption drawn translucent; k is the material kind; p the primitive (box, cyl, rock, ball).', 'scenes': scenes}
    (WEB / 'gunkanjima-interiors.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    for k, sc in scenes.items():
        sc['label'] = LABELS[k]
    (WEB / 'gunkanjima-interiors.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    for k, sc in scenes.items():
        print(k, 'parts', len(sc['boxes']), 'assumed', sum(1 for b in sc['boxes'] if b.get('a')), 'cam', sc['camera'])


if __name__ == '__main__':
    main()
