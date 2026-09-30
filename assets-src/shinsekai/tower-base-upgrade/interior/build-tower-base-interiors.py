"""Tower base (1912) interiors: ticket hall, stair, lift landing, tower-wing cinema (+ dream variants).

    blender -b -P build-tower-base-interiors.py -- [--room hall|stair|lift|cinema|all] [--variant base|dream|both]
        [--render cams|closeups|none] [--export] [--samples 96] [--scale 1.0] [--iter 1] [--regen-tex]

Blender axes: Z up. Every room is a standalone cell built around its own origin (0,0,0 = floor level, SW inner corner);
the glb puts each cell under a node `cell_<room>[_dream]` so it can be placed later from INTERFACE.md (not yet
published when this was written; see README "Interface requests").  glTF export converts to Y-up.
Materials: PBR only (Principled + image textures + COLOR_0 tint).  UV0 = metres / tile size (box projection),
UV1 = smart-project pack (lightmap).  Everything is generated here; only CC0 textures from research-cache are referenced.
Period rule: 1912 Osaka, no fluorescent light / AC / CRT.  Items marked (+) in names/README are unverified variants, kept in
`var_*` nodes.  No people, no person-like figures, no real brands; every sign is fictional (digits / abstract marks only).
"""
import bpy, bmesh, math, random, sys, os, time, json
from contextlib import contextmanager
from pathlib import Path
from mathutils import Matrix, Vector, Euler, Quaternion, geometry
import numpy as np


def _argv():
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default, cast=str):
    a = _argv()
    return cast(a[a.index(name) + 1]) if name in a else default


def flag(name):
    return name in _argv()


HERE = Path(__file__).resolve().parent
TEXDIR = HERE / "tex"
RENDERDIR = HERE / "renders"
CC0 = Path("C:/Users/NULL/Documents/Codex/JTA-shinsekai/research-cache/materials-93")
ROOM = arg("--room", "all")
VARIANT = arg("--variant", "both")
DO_RENDER = arg("--render", "none")
DO_EXPORT = flag("--export")
SAMPLES = arg("--samples", 96, int)
SCALE = arg("--scale", 1.0, float)
ITER = arg("--iter", 1, int)
REGEN = flag("--regen-tex")
ONLYCAM = arg("--cam", "")
GATE_RENDERS = flag("--gate-renders")
RNG = random.Random(1912)
NPR = np.random.default_rng(1912)
D2R = math.pi / 180.0


def srgb(r, g, b):
    f = lambda c: ((c / 255.0 + 0.055) / 1.055) ** 2.4 if c / 255.0 > 0.04045 else c / 255.0 / 12.92
    return (f(r), f(g), f(b), 1.0)


def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


# ======================================================================================================================
# cell builder
# ======================================================================================================================
class Cell:
    def __init__(self, name, dream=False):
        self.name, self.dream = name, dream
        self.F = []          # faces: dict(v=[3d tuples], m=mat, sm=smooth, uv=None|list, vc=None|rgb, g=group)
        self.st = [Matrix.Identity(4)]
        self.group = "main"
        self.goff = {}
        self.lights = []
        self.cams = []
        self.lod = 1
        self.pivots = {}
        self.col = []
        self.env = {}
        self.gates = []          # KinGate instances (articulated parts, clips)
        self.anims = {}

    @contextmanager
    def at(self, loc=(0, 0, 0), rx=0.0, ry=0.0, rz=0.0, s=1.0, m=None):
        if m is None:
            sv = tuple(s) if isinstance(s, (tuple, list)) else (s, s, s)
            S = Matrix.Diagonal((sv[0], sv[1], sv[2], 1.0))
            R = Euler((rx * D2R, ry * D2R, rz * D2R), "XYZ").to_matrix().to_4x4()
            m = Matrix.Translation(loc) @ R @ S
        self.st.append(self.st[-1] @ m)
        try:
            yield
        finally:
            self.st.pop()

    @contextmanager
    def grp(self, name):
        old = self.group
        self.group = name
        off = self.goff.get(name, self.goff.get("*"))
        if off:
            self.st.append(self.st[-1] @ Matrix.Translation(off))
        try:
            yield
        finally:
            if off:
                self.st.pop()
            self.group = old

    def P(self, p):
        return tuple(self.st[-1] @ Vector(p))

    def face(self, pts, mat, smooth=False, uv=None, vc=None, flip=False):
        M = self.st[-1]
        vs = [tuple(M @ Vector(p)) for p in pts]
        if (M.determinant() < 0) != flip:
            vs = vs[::-1]
            if uv:
                uv = uv[::-1]
        self.F.append(dict(v=vs, m=mat, sm=smooth, uv=uv, vc=vc, g=self.group))

    def tris(self):
        return sum(len(f["v"]) - 2 for f in self.F)

    def light(self, kind, name, loc, color=(255, 240, 210), watt=100.0, size=0.1, target=None, spot=None, **kw):
        self.lights.append(dict(kind=kind, name=name, loc=self.P(loc), color=color, watt=watt, size=size,
                                target=None if target is None else self.P(target), spot=spot, **kw))


# ---- primitives --------------------------------------------------------------------------------------------------
def box(c, mat, lo, hi, r=0.004, smooth=False, vc=None, flip=False):
    lo, hi = Vector(lo), Vector(hi)
    cen, h = (lo + hi) / 2, (hi - lo) / 2
    r = min(r, min(h) * 0.45)

    def add(pts):
        n = Vector((0, 0, 0))
        for i in range(len(pts)):
            a, b = Vector(pts[i]), Vector(pts[(i + 1) % len(pts)])
            n += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
        ctr = sum((Vector(p) for p in pts), Vector()) / len(pts)
        if n.dot(ctr - cen) < 0:
            pts = pts[::-1]
        c.face(pts, mat, smooth=smooth, vc=vc, flip=flip)

    S = (-1, 1)
    if r <= 1e-5:
        for ax in range(3):
            u, v = [(1, 2), (0, 2), (0, 1)][ax]
            for s in S:
                pts = []
                for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                    p = [0, 0, 0]
                    p[ax], p[u], p[v] = s * h[ax], su * h[u], sv * h[v]
                    pts.append(tuple(cen + Vector(p)))
                add(pts)
        return

    def vx(sg, ax):
        p = [sg[0] * h.x, sg[1] * h.y, sg[2] * h.z]
        for k in range(3):
            if k != ax:
                p[k] -= (1 if p[k] > 0 else -1) * r
        return tuple(cen + Vector(p))

    for ax in range(3):
        u, v = [(1, 2), (0, 2), (0, 1)][ax]
        for s in S:
            pts = []
            for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                sg = [0, 0, 0]
                sg[ax], sg[u], sg[v] = s, su, sv
                pts.append(vx(sg, ax))
            add(pts)
    for ax1, ax2 in ((0, 1), (0, 2), (1, 2)):
        ax3 = 3 - ax1 - ax2
        for s1 in S:
            for s2 in S:
                sgs = []
                for s3 in S:
                    sg = [0, 0, 0]
                    sg[ax1], sg[ax2], sg[ax3] = s1, s2, s3
                    sgs.append(sg)
                add([vx(sgs[0], ax1), vx(sgs[1], ax1), vx(sgs[1], ax2), vx(sgs[0], ax2)])
    for sx in S:
        for sy in S:
            for sz in S:
                sg = [sx, sy, sz]
                add([vx(sg, 0), vx(sg, 1), vx(sg, 2)])


def lathe(c, mat, prof, seg=16, smooth=True, vc=None, a0=0.0, a1=360.0):
    """Revolve profile [(r, z)...] (bottom->top, outside facing out) about local Z."""
    n = seg
    full = abs(a1 - a0 - 360.0) < 1e-6
    ang = [(a0 + (a1 - a0) * i / n) * D2R for i in range(n + 1)]
    for i in range(len(prof) - 1):
        (r0, z0), (r1, z1) = prof[i], prof[i + 1]
        if r0 < 1e-9 and r1 < 1e-9:
            continue
        for k in range(n):
            ca, sa, cb, sb = math.cos(ang[k]), math.sin(ang[k]), math.cos(ang[k + 1]), math.sin(ang[k + 1])
            p00, p01 = (r0 * ca, r0 * sa, z0), (r0 * cb, r0 * sb, z0)
            p10, p11 = (r1 * ca, r1 * sa, z1), (r1 * cb, r1 * sb, z1)
            if r0 < 1e-9:
                c.face([p00, p11, p10], mat, smooth=smooth, vc=vc)
            elif r1 < 1e-9:
                c.face([p00, p01, p10], mat, smooth=smooth, vc=vc)
            else:
                c.face([p00, p01, p11, p10], mat, smooth=smooth, vc=vc)


def cyl(c, mat, r, h, seg=16, z0=0.0, ch=0.0, r2=None, smooth=True, vc=None, cap=True):
    r2 = r if r2 is None else r2
    if ch > 0:
        prof = [(0, z0), (r - ch, z0), (r, z0 + ch), (r2, z0 + h - ch), (r2 - ch, z0 + h), (0, z0 + h)]
    elif cap:
        prof = [(0, z0), (r, z0), (r2, z0 + h), (0, z0 + h)]
    else:
        prof = [(r, z0), (r2, z0 + h)]
    lathe(c, mat, prof, seg, smooth, vc)


def sphere(c, mat, r, seg=12, rings=8, smooth=True, vc=None):
    prof = [(r * math.sin(math.pi * i / rings), -r * math.cos(math.pi * i / rings)) for i in range(rings + 1)]
    prof[0] = (0.0, -r)
    prof[-1] = (0.0, r)
    lathe(c, mat, prof, seg, smooth, vc)


def tube(c, mat, p0, p1, r, seg=6, smooth=True, vc=None, ch=0.0):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    L = d.length
    if L < 1e-6:
        return
    q = d.to_track_quat("Z", "Y")
    with c.at(m=Matrix.Translation(p0) @ q.to_matrix().to_4x4()):
        cyl(c, mat, r, L, seg, smooth=smooth, vc=vc, ch=ch)


def _orient2(pts, ccw=True):
    a = 0.0
    for i in range(len(pts)):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % len(pts)]
        a += x0 * y1 - x1 * y0
    return pts if (a > 0) == ccw else pts[::-1]


def extrude(c, mat, outer, holes=(), depth=0.1, w0=0.0, vc=None, smooth=False, caps=True):
    """Extrude a 2D polygon (local u,v) along local w from w0 to w0+depth (bottom cap faces -w, top +w)."""
    outer = _orient2(list(outer), True)
    holes = [_orient2(list(h), False) for h in holes]
    w1 = w0 + depth
    for loop in [outer] + holes:
        for i in range(len(loop)):
            a, b = loop[i], loop[(i + 1) % len(loop)]
            c.face([(a[0], a[1], w0), (b[0], b[1], w0), (b[0], b[1], w1), (a[0], a[1], w1)], mat, smooth=smooth, vc=vc)
    if caps:
        loops = [[Vector((p[0], p[1], 0)) for p in outer]] + [[Vector((p[0], p[1], 0)) for p in h] for h in holes]
        tr = geometry.tessellate_polygon(loops)
        flat = [p for l in loops for p in l]
        for t in tr:
            pa, pb, pc = [(flat[i].x, flat[i].y) for i in t]
            ar = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pc[0] - pa[0]) * (pb[1] - pa[1])
            tt = t if ar > 0 else (t[0], t[2], t[1])
            c.face([(flat[i].x, flat[i].y, w1) for i in tt], mat, vc=vc)
            c.face([(flat[i].x, flat[i].y, w0) for i in tt[::-1]], mat, vc=vc)


def M_XZ(y):    # local (u,v,w) -> world (u, y+w, v): w toward +Y
    return Matrix(((1, 0, 0, 0), (0, 0, 1, y), (0, 1, 0, 0), (0, 0, 0, 1)))


def M_YZ(x):    # local (u,v,w) -> world (x+w, u, v)
    return Matrix(((0, 0, 1, x), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def arch_pts(x0, x1, zs, rise=None, n=14, z0=0.0):
    """Arched opening outline: (x0,z0) up to spring zs, over the arch, down to (x1,z0). rise=None -> semicircle."""
    w = x1 - x0
    rise = w / 2 if rise is None else rise
    R = (w * w / 4 + rise * rise) / (2 * rise)
    cx, cz = (x0 + x1) / 2, zs + rise - R
    a0 = math.atan2(zs - cz, x1 - cx)
    pts = [(x0, z0), (x0, zs)]
    for i in range(1, n):
        a = math.pi - a0 - (math.pi - 2 * a0) * i / n
        pts.append((cx + R * math.cos(a), cz + R * math.sin(a)))
    pts += [(x1, zs), (x1, z0)]
    return pts


def rect_pts(x0, z0, x1, z1):
    return [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]


def decal(c, mat, w, h, uv=((0, 0), (1, 0), (1, 1), (0, 1)), vc=None):
    """Quad in local XY plane centred at origin facing +Z."""
    c.face([(-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0)], mat, uv=list(uv), vc=vc)


def hash01(*p):
    s = sum(math.sin(v * (12.9898 + 7.7 * i) + 4.1 * i) * 43758.5453 for i, v in enumerate(p))
    return s - math.floor(s)


# ======================================================================================================================
# procedural textures (numpy) -> tex/*.png   (neutral, roughly 0.75-1.0 luminance; colour comes from COLOR_0)
# ======================================================================================================================
def _vnoise(h, w, cy, cx, rng):
    g = rng.random((cy, cx))
    y = np.linspace(0, cy, h, endpoint=False)
    x = np.linspace(0, cx, w, endpoint=False)
    y0, x0 = np.floor(y).astype(int), np.floor(x).astype(int)
    fy, fx = y - y0, x - x0
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    y1, x1 = (y0 + 1) % cy, (x0 + 1) % cx
    top = g[y0][:, x0] * (1 - fx) + g[y0][:, x1] * fx
    bot = g[y1][:, x0] * (1 - fx) + g[y1][:, x1] * fx
    return top * (1 - fy)[:, None] + bot * fy[:, None]


def _fbm(h, w, base, oct_, rng, aniso=(1, 1)):
    out = np.zeros((h, w))
    amp, tot = 1.0, 0.0
    for o in range(oct_):
        out += amp * _vnoise(h, w, max(1, int(base * aniso[0] * 2 ** o)), max(1, int(base * aniso[1] * 2 ** o)), rng)
        tot += amp
        amp *= 0.5
    return out / tot


def _sm(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def _rgb(lum, tint=(1, 1, 1)):
    return np.stack([lum * tint[0], lum * tint[1], lum * tint[2]], -1)


def t_marble(n=1024):
    r = np.random.default_rng(11)
    yy, xx = np.mgrid[0:n, 0:n] / n
    warp = _fbm(n, n, 3, 5, r)
    v = np.abs(np.sin((xx * 2.3 + yy * 1.1 + warp * 2.2) * np.pi * 2))
    vein = _sm(0.93, 1.0, v) * 0.07
    v2 = np.abs(np.sin((xx * 0.9 - yy * 1.7 + warp * 3.1) * np.pi * 2))
    vein += _sm(0.97, 1.0, v2) * 0.045
    cloud = _fbm(n, n, 4, 5, r)
    lum = 0.95 - 0.05 * cloud - vein
    sl = n // 2
    tone = r.uniform(0.95, 1.03, (2, 2))
    ii, jj = (np.arange(n) // sl)[:, None], (np.arange(n) // sl)[None, :]
    lum = lum * tone[ii, jj]
    ex = np.minimum(np.arange(n) % sl, sl - 1 - np.arange(n) % sl)
    e = np.minimum(ex[:, None], ex[None, :])
    lum = np.where(e < 2, lum * 0.48, np.where(e < 4, lum * 1.03, lum))
    return _rgb(np.clip(lum, 0, 1), (1.0, 0.975, 0.93))


def t_boards(n=1024, planks=8, hue=(1.0, 0.92, 0.82), varnish=True):
    r = np.random.default_rng(7)
    lum = np.zeros((n, n))
    pw = n // planks
    yy = np.arange(n)[:, None]
    xx = np.arange(n)[None, :]
    fine = _fbm(n, n, 6, 4, r, aniso=(1.0, 0.04))
    for p in range(planks):
        y0 = p * pw
        off = r.integers(0, n)
        tone = r.uniform(0.82, 1.0)
        ring = np.sin(((xx + off) / n * 6.0 + _fbm(pw, n, 3, 3, r, aniso=(1, 0.3))[0] * 4) * math.pi * 2 * 2)
        g = 0.72 + 0.18 * ring[:1] + 0.20 * fine[y0:y0 + pw]
        lum[y0:y0 + pw] = g * tone
        # butt joint
        jx = int(r.integers(n // 5, n - n // 5))
        lum[y0:y0 + pw, max(0, jx - 1):jx + 1] *= 0.4
    edge = np.minimum(np.arange(n) % pw, pw - 1 - np.arange(n) % pw)
    lum *= np.where(edge < 2, 0.5, np.where(edge < 4, 1.04, 1.0))[:, None]
    return _rgb(np.clip(lum, 0, 1), hue)


def t_wood_fine(n=1024):
    r = np.random.default_rng(9)
    yy, xx = np.mgrid[0:n, 0:n] / n
    w = _fbm(n, n, 3, 4, r)
    ring = np.sin((yy * 46 + w * 1.6) * math.pi * 2)
    fibre = _fbm(n, n, 3, 5, r, aniso=(1.0, 0.03))
    lum = 0.70 + 0.05 * ring + 0.34 * (fibre - 0.5)
    return _rgb(np.clip(lum, 0, 1), (1.0, 0.94, 0.86))


def t_velvet(n=512):
    r = np.random.default_rng(5)
    lum = 0.7 + 0.25 * _fbm(n, n, 24, 3, r) + 0.06 * r.random((n, n))
    fold = np.sin(np.arange(n) / n * math.pi * 2 * 6)[None, :] * 0.06
    return _rgb(np.clip(lum + fold, 0, 1))


def t_pleat(n=512):
    r = np.random.default_rng(6)
    x = np.arange(n) / n
    p = 0.72 + 0.26 * (0.5 + 0.5 * np.sin(x * math.pi * 2 * 10))
    lum = p[None, :] * (0.94 + 0.06 * _fbm(n, n, 30, 2, r, aniso=(1, 0.2)))
    return _rgb(np.clip(lum, 0, 1))


def t_wallpaper(n=512):
    yy, xx = np.mgrid[0:n, 0:n] / n
    dia = np.abs(((xx * 4) % 1) - 0.5) + np.abs(((yy * 4) % 1) - 0.5)
    motif = _sm(0.30, 0.24, dia) * 0.10
    dot = _sm(0.06, 0.03, np.hypot(((xx * 4) % 1) - 0.5, ((yy * 4) % 1) - 0.5)) * 0.12
    stripe = 0.03 * np.sin(xx * math.pi * 2 * 8)
    r = np.random.default_rng(3)
    lum = 0.86 - motif - dot + stripe + 0.03 * (_fbm(n, n, 8, 3, r) - 0.5)
    return _rgb(np.clip(lum, 0, 1))


def t_encaustic(n=1024):
    """Victorian-style two/three colour geometric floor tile (0.9 m repeat, 3x3 tiles of 0.3 m). Colour in RGB here."""
    yy, xx = np.mgrid[0:n, 0:n] / n
    cell = 3
    u, v = (xx * cell) % 1, (yy * cell) % 1
    d = np.abs(u - 0.5) + np.abs(v - 0.5)
    ring = _sm(0.40, 0.42, d) - _sm(0.30, 0.32, d) + _sm(0.12, 0.14, np.maximum(np.abs(u - .5), np.abs(v - .5)))
    ii = (np.floor(xx * cell) + np.floor(yy * cell)) % 2
    base = np.where(ii == 0, 0.85, 0.30)[..., None] * np.ones(3)
    cream, terra, dark = np.array([0.93, 0.88, 0.76]), np.array([0.62, 0.30, 0.20]), np.array([0.16, 0.20, 0.26])
    img = np.where(ii[..., None] == 0, cream, dark)
    img = img * (1 - 0.7 * ring[..., None]) + terra * 0.7 * ring[..., None]
    r = np.random.default_rng(2)
    img = img * (0.93 + 0.07 * _fbm(n, n, 20, 3, r))[..., None]
    e = np.minimum((xx * cell * n) % (n / cell), n / cell - (xx * cell * n) % (n / cell))
    e2 = np.minimum((yy * cell * n) % (n / cell), n / cell - (yy * cell * n) % (n / cell))
    m = np.minimum(e, e2)
    img = np.where((m < 2)[..., None], img * 0.55, img)
    return np.clip(img, 0, 1)


def t_tile_small(n=1024):
    r = np.random.default_rng(4)
    k = 10
    yy, xx = np.mgrid[0:n, 0:n]
    e = np.minimum(xx % (n // k), (n // k) - 1 - xx % (n // k))
    e2 = np.minimum(yy % (n // k), (n // k) - 1 - yy % (n // k))
    m = np.minimum(e, e2)
    tone = r.uniform(0.94, 1.0, (k, k))[yy // (n // k), xx // (n // k)]
    lum = np.where(m < 2, 0.55, tone)
    return _rgb(lum)


FONT = {"0": "111101101101111", "1": "010110010010111", "2": "111001111100111", "3": "111001111001111",
        "4": "101101111001001", "5": "111100111001111", "6": "111100111101111", "7": "111001010010010",
        "8": "111101111101111", "9": "111101111001111", "-": "000000111000000", ".": "000000000000010", " ": "0" * 15}


def _text(img, s, x, y, k, col):
    for i, ch in enumerate(s):
        bits = FONT.get(ch, FONT[" "])
        for j, b in enumerate(bits):
            if b == "1":
                px, py = x + (i * 4 + j % 3) * k, y + (j // 3) * k
                img[py:py + k, px:px + k] = col


def t_dial(n=512):
    """Floor-indicator dial (fictional): cream face, black tick ring, digits 1-3, red needle rest mark."""
    yy, xx = np.mgrid[0:n, 0:n] / n - 0.5
    rr = np.hypot(xx, yy)
    ang = np.arctan2(yy, xx)
    img = np.ones((n, n, 3)) * np.array([0.90, 0.86, 0.74])
    img[rr > 0.47] = 0.18
    ring = (rr > 0.40) & (rr < 0.44)
    tick = (np.abs(((ang + math.pi) / (math.pi / 12)) % 1 - 0.5) < 0.06)
    img[ring & tick] = 0.1
    img[(rr > 0.455) & (rr < 0.47)] = np.array([0.5, 0.4, 0.2])
    for i, dgt in enumerate("123"):
        _text(img, dgt, int(n * (0.30 + 0.16 * i)), int(n * 0.22), 14, 0.1)
    img[(rr < 0.03)] = 0.15
    return np.clip(img, 0, 1)


def t_clock(n=512):
    yy, xx = np.mgrid[0:n, 0:n] / n - 0.5
    rr = np.hypot(xx, yy)
    ang = np.arctan2(yy, xx)
    img = np.ones((n, n, 3)) * np.array([0.93, 0.90, 0.80])
    img[rr > 0.485] = 0.12
    for k in range(60):
        a = k / 60 * math.pi * 2
        big = k % 5 == 0
        r0 = 0.40 if big else 0.44
        px = np.abs(np.sin(ang - a)) * rr
        m = (np.abs(np.sin(ang - a)) * rr < (0.008 if big else 0.004)) & (np.cos(ang - a) > 0) & (rr > r0) & (rr < 0.47)
        img[m] = 0.08
    for h in range(12):
        a = h / 12 * math.pi * 2 - math.pi / 2
        cx, cy = 0.5 + 0.33 * math.cos(a), 0.5 + 0.33 * math.sin(a)
        _text(img, str(h if h else 12)[-1:] if h < 10 else str(h)[-1], int(cx * n) - 6, int(cy * n) - 10, 4, 0.08)
    return np.clip(img, 0, 1)


def t_fareboard(n=1024):
    r = np.random.default_rng(8)
    h, w = 512, 1024
    img = np.ones((h, w, 3)) * np.array([0.10, 0.20, 0.16]) * (0.9 + 0.1 * _fbm(h, w, 12, 3, r))[..., None]
    img[:6] = 0.75; img[-6:] = 0.75; img[:, :6] = 0.75; img[:, -6:] = 0.75
    for i in range(5):
        y = 40 + i * 92
        img[y + 78:y + 80, 40:w - 40] = 0.55
        fares = ["2", "3", "5", "8", "12"][i]
        _text(img, fares + " 0", 640, y + 16, 9, np.array([0.93, 0.90, 0.78]))
        _text(img, "1" + str(i + 1), 60, y + 16, 9, np.array([0.93, 0.90, 0.78]))
        img[y + 30:y + 36, 240:520] = 0.6
    return np.clip(img, 0, 1)


def _poster(seed, size=(256, 384)):
    r = np.random.default_rng(seed)
    h, w = size[1], size[0]
    pals = [((0.85, 0.75, 0.55), (0.55, 0.12, 0.10), (0.1, 0.15, 0.3)), ((0.86, 0.85, 0.75), (0.12, 0.30, 0.34), (0.75, 0.55, 0.15)),
            ((0.12, 0.13, 0.20), (0.85, 0.70, 0.25), (0.75, 0.25, 0.20)), ((0.82, 0.60, 0.52), (0.20, 0.30, 0.22), (0.95, 0.9, 0.8))]
    p = pals[seed % 4]
    img = np.ones((h, w, 3)) * np.array(p[0])
    img[:8] = p[1]; img[-8:] = p[1]; img[:, :8] = p[1]; img[:, -8:] = p[1]
    yy, xx = np.mgrid[0:h, 0:w]
    for k in range(int(r.integers(2, 4))):
        cx, cy, rad = r.integers(50, w - 50), r.integers(60, h // 2), r.integers(30, 70)
        img[np.hypot(xx - cx, yy - cy) < rad] = p[1 + k % 2]
    for k in range(6):
        y = h // 2 + 20 + k * 30
        x0 = int(r.integers(20, 60))
        img[y:y + 10, x0:x0 + int(r.integers(80, w - 80))] = p[2]
    _text(img, str(int(r.integers(10, 99))), 20, h - 60, 8, np.array(p[2]))
    img *= (0.93 + 0.07 * _fbm(h, w, 8, 3, r))[..., None]
    return np.clip(img, 0, 1)


def t_posters(n=1024):
    img = np.zeros((768, 1024, 3))
    for i in range(4):
        img[:384, i * 256:(i + 1) * 256] = _poster(i)
        img[384:, i * 256:(i + 1) * 256] = _poster(i + 4)
    return img


def t_screen(n=1024):
    yy, xx = np.mgrid[0:n, 0:n] / n
    r = np.random.default_rng(12)
    lum = 0.90 - 0.10 * ((xx - 0.5) ** 2 + (yy - 0.5) ** 2) * 2 + 0.03 * (_fbm(n, n, 30, 3, r) - 0.5)
    return _rgb(np.clip(lum, 0, 1), (0.98, 0.98, 0.96))


def t_sea(n=1024):
    """Looping placeholder clip frame (procedural sea, grey-scale sepia). NOT a real PD clip."""
    r = np.random.default_rng(13)
    h, w = 576, 1024
    yy, xx = np.mgrid[0:h, 0:w] / np.array([h, w])[:, None, None]
    sky = 0.86 - 0.25 * yy
    hor = 0.55
    sea = 0.45 + 0.12 * np.sin((xx * 60 + yy * 8) * 2) * (yy - hor) * 6 + 0.1 * _fbm(h, w, 20, 3, r)
    lum = np.where(yy < hor, sky, sea)
    lum = np.where((np.hypot((xx - 0.7) * 1.8, yy - 0.3) < 0.07), 1.0, lum)
    img = _rgb(np.clip(lum, 0, 1), (1.0, 0.92, 0.78))
    return np.concatenate([img, np.zeros((n - h, w, 3))], 0)[:n]


def t_film(n=512):
    img = np.ones((n, n, 3)) * 0.10
    for k in range(12):
        y = int((k + 0.5) / 12 * n)
        for x0 in (14, n - 34):
            img[y - 7:y + 7, x0:x0 + 20] = 0.85
    img[:, 60:n - 60] = 0.24
    return img


def t_dirt(n=512):
    """RGBA-ish: returns (n,n,4). Vertical rain streaks / grime decal."""
    r = np.random.default_rng(14)
    a = _fbm(n, n, 6, 5, r, aniso=(0.15, 1.0))
    a = _sm(0.45, 0.85, a) * _sm(0.0, 0.6, 1 - np.mgrid[0:n, 0:n][0] / n)
    return np.dstack([np.ones((n, n)) * 0.12, np.ones((n, n)) * 0.10, np.ones((n, n)) * 0.08, a * 0.55])


def t_sunpool_soft(n=256):
    yy, xx = np.mgrid[0:n, 0:n] / n - 0.5
    a = _sm(0.5, 0.2, np.hypot(xx, yy))
    return np.dstack([np.ones((n, n)), np.ones((n, n)) * 0.93, np.ones((n, n)) * 0.75, a])


def _save_png(name, arr):
    import zlib, struct
    TEXDIR.mkdir(exist_ok=True)
    p = TEXDIR / (name + ".png")
    h, w = arr.shape[:2]
    if arr.shape[2] == 3:
        arr = np.dstack([arr, np.ones((h, w))])
    b = (np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8)
    raw = b"".join(b"\x00" + b[y].tobytes() for y in range(h))
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b"")
    p.write_bytes(png)
    return p


GEN = dict(marble=t_marble, boards=t_boards, wood_fine=t_wood_fine, velvet=t_velvet, pleat=t_pleat, wallpaper=t_wallpaper,
           encaustic=t_encaustic, tile_small=t_tile_small, dial=t_dial, clock=t_clock, fareboard=t_fareboard,
           posters=t_posters, screen=t_screen, sea=t_sea, film=t_film, dirt=t_dirt, sunpool=t_sunpool_soft)


def tex_path(name):
    if name in ("plaster", "sandstone", "steel"):
        return {"plaster": CC0 / "PaintedPlaster006" / "PaintedPlaster006_2K-JPG_Color.jpg",
                "sandstone": CC0 / "large_sandstone_blocks_diff_2k.jpg",
                "steel": CC0 / "Metal041B" / "Metal041B_2K-JPG_Color.jpg"}[name]
    ext = "png" if name in ("dirt", "grime", "sunpool") else "jpg"
    p = TEXDIR / (name + "." + ext)
    if REGEN or not p.exists():
        arr = GEN[name]()
        if ext == "png":
            _save_png(name, arr)
        else:
            TEXDIR.mkdir(exist_ok=True)
            h, w = arr.shape[:2]
            a4 = np.dstack([np.clip(arr[..., :3], 0, 1), np.ones((h, w))]).astype(np.float32)
            im = bpy.data.images.new("_j_" + name, w, h, alpha=False)
            im.pixels.foreach_set(np.flipud(a4).ravel())
            im.update()
            sc_ = bpy.context.scene
            old = (sc_.render.image_settings.file_format, sc_.render.image_settings.quality)
            sc_.render.image_settings.file_format, sc_.render.image_settings.quality = "JPEG", 90
            im.save_render(str(p))
            sc_.render.image_settings.file_format, sc_.render.image_settings.quality = old
            bpy.data.images.remove(im)
    return p


def t_plaster_fine(n=1024):
    r = np.random.default_rng(21)
    m = _fbm(n, n, 5, 5, r)
    tr = _fbm(n, n, 4, 3, r, aniso=(0.3, 1.0))
    lum = 0.93 + 0.10 * (m - 0.5) + 0.05 * (tr - 0.5) + 0.02 * (r.random((n, n)) - 0.5)
    return _rgb(np.clip(lum, 0, 1), (1.0, 0.99, 0.97))


GEN["plaster_fine"] = t_plaster_fine


def t_grime(n=512):
    """RGBA: soot/damp gradient - opaque near the top and bottom edges, mottled."""
    r = np.random.default_rng(31)
    yy = np.mgrid[0:n, 0:n][0] / n
    edge = np.maximum(_sm(0.55, 1.0, yy), _sm(0.45, 0.0, yy) * 0.8)
    a = edge * (0.55 + 0.45 * _fbm(n, n, 5, 4, r)) * 0.55
    return np.dstack([np.ones((n, n)) * 0.10, np.ones((n, n)) * 0.09, np.ones((n, n)) * 0.08, np.clip(a, 0, 1)])


GEN["grime"] = t_grime


# ======================================================================================================================
# materials
# ======================================================================================================================
MATS = {}


def defmat(name, col, rough=0.5, metal=0.0, tex=None, tile=1.0, dcol=None, ems=None, dems=None, alpha=None, dalpha=None):
    MATS[name] = dict(col=col, dcol=dcol, rough=rough, metal=metal, tex=tex, tile=tile, ems=ems, dems=dems, alpha=alpha,
                      dalpha=dalpha)


# fmt: off
defmat("stone_floor", (218, 208, 190), 0.10, 0, "marble", 1.2, dcol=(238, 168, 150))
defmat("plaster",     (226, 214, 190), 0.85, 0, "plaster_fine", 1.5, dcol=(240, 196, 184))
defmat("plaster_ceil",(236, 230, 212), 0.9, 0, "plaster_fine", 1.5, dcol=(246, 214, 202))
defmat("plaster_dk",  (150, 138, 116), 0.85, 0, "plaster_fine", 1.5, dcol=(240, 178, 168))
defmat("sandstone",   (190, 172, 142), 0.7, 0, "sandstone", 2.0, dcol=(246, 200, 186))
defmat("teak",        (98, 56, 30), 0.26, 0, "wood_fine", 0.8, dcol=(222, 150, 134))
defmat("oak",         (160, 116, 70), 0.38, 0, "wood_fine", 0.8, dcol=(240, 190, 172))
defmat("boards",      (128, 84, 50), 0.22, 0, "boards", 1.0, dcol=(214, 148, 128))
defmat("boards_dk",   (78, 50, 32), 0.28, 0, "boards", 1.0, dcol=(224, 158, 148))
defmat("brass",       (206, 156, 70), 0.24, 1, None, 1, dcol=(236, 156, 128))
defmat("brass_worn",  (170, 128, 62), 0.45, 1, None, 1, dcol=(214, 140, 118))
defmat("iron",        (40, 40, 42), 0.55, 0.85, None, 1, dcol=(120, 60, 64))
defmat("steel",       (170, 172, 172), 0.5, 0.9, "steel", 0.8, dcol=(230, 150, 148))
defmat("wire",        (168, 170, 168), 0.38, 0.95, None, 1, dcol=(238, 160, 156))
defmat("paint_green", (44, 70, 56), 0.5, 0, None, 1, dcol=(92, 186, 192))
defmat("paint_cream", (222, 214, 190), 0.45, 0, None, 1, dcol=(246, 206, 196))
defmat("paint_red",   (120, 30, 28), 0.4, 0, None, 1, dcol=(214, 70, 70))
defmat("paint_dark",  (36, 34, 32), 0.5, 0, None, 1, dcol=(120, 50, 56))
defmat("porcelain",   (236, 234, 226), 0.08, 0, None, 1, dcol=(246, 226, 220))
defmat("glass",       (196, 210, 210), 0.03, 0, None, 1, alpha=0.12, dalpha=0.22, dcol=(150, 226, 232))
defmat("glass_smoke", (170, 190, 190), 0.04, 0, None, 1, alpha=0.4, dalpha=0.3)
defmat("velvet",      (118, 26, 34), 0.95, 0, "velvet", 0.6, dcol=(70, 168, 180))
defmat("curtain",     (214, 200, 172), 0.9, 0, "pleat", 0.5, dcol=(244, 176, 172), dems=((255, 190, 170), 0.2), ems=((255, 226, 176), 0.12))
defmat("wallpaper",   (226, 200, 160), 0.85, 0, "wallpaper", 0.6, dcol=(244, 176, 166))
defmat("paper_ticket",(240, 228, 200), 0.8, 0, None, 1, dcol=(250, 224, 212))
defmat("posters",     (255, 255, 255), 0.75, 0, "posters", 1, dcol=(255, 236, 232))
defmat("fareboard",   (255, 255, 255), 0.55, 0, "fareboard", 1, dcol=(255, 226, 222))
defmat("dial",        (255, 255, 255), 0.3, 0, "dial", 1)
defmat("clock",       (255, 255, 255), 0.3, 0, "clock", 1)
defmat("bulb",        (255, 236, 190), 0.1, 0, None, 1, ems=((255, 214, 140), 40.0), dems=((255, 190, 170), 40.0))
defmat("lamp_milk",   (240, 236, 224), 0.2, 0, None, 1, ems=((255, 226, 170), 5.0), dems=((255, 200, 190), 5.0))
defmat("exit_lamp",   (60, 200, 90), 0.3, 0, None, 1, ems=((60, 255, 110), 6.0), dems=((255, 90, 110), 6.0))
defmat("rubber",      (28, 26, 26), 0.8, 0, None, 1)
defmat("leather",     (70, 34, 24), 0.55, 0, None, 1, dcol=(190, 96, 92))
defmat("encaustic",   (255, 255, 255), 0.18, 0, "encaustic", 0.9)
defmat("tile_small",  (232, 222, 214), 0.08, 0, "tile_small", 1.0, dcol=(246, 184, 170))
defmat("soil",        (52, 38, 28), 0.95, 0, None, 1)
defmat("leaf",        (54, 96, 52), 0.7, 0, None, 1, dcol=(82, 122, 100))
defmat("petal_a",     (222, 112, 132), 0.65, 0, None, 1, dcol=(248, 140, 150))
defmat("petal_b",     (238, 210, 120), 0.65, 0, None, 1, dcol=(255, 200, 190))
defmat("petal_c",     (236, 232, 222), 0.65, 0, None, 1, dcol=(255, 226, 226))
defmat("terracotta",  (168, 92, 60), 0.6, 0, None, 1, dcol=(226, 140, 120))
defmat("water",       (78, 130, 150), 0.02, 0, None, 1, alpha=0.65, dalpha=0.65)
defmat("screen",      (255, 255, 255), 0.85, 0, "screen", 1, ems=((255, 250, 235), 0.05))
defmat("screen_sea",  (255, 255, 255), 0.85, 0, "sea", 1, ems=((255, 245, 225), 0.35))
defmat("beam",        (255, 236, 190), 1.0, 0, None, 1, ems=((255, 236, 190), 0.6), alpha=0.022, dalpha=0.026)
defmat("dust",        (255, 240, 200), 1.0, 0, None, 1, ems=((255, 240, 200), 5.0), alpha=0.8)
defmat("film",        (255, 255, 255), 0.35, 0, "film", 0.05, dcol=(255, 210, 200))
defmat("celluloid",   (34, 28, 22), 0.25, 0, None, 1)
defmat("dirt",        (255, 255, 255), 1.0, 0, "dirt", 1.0, alpha=0.9)
defmat("balloon",     (196, 22, 30), 0.12, 0, None, 1)
defmat("fur",         (236, 232, 226), 0.9, 0, None, 1)
defmat("pink_ink",    (240, 150, 160), 0.7, 0, None, 1)
# fmt: on

_IMG = {}


def load_img(p, nonc=False):
    p = str(p)
    if p not in _IMG:
        im = bpy.data.images.load(p)
        if nonc:
            im.colorspace_settings.name = "Non-Color"
        _IMG[p] = im
    return _IMG[p]


_MAT = {}


def get_mat(name, dream):
    key = (name, dream)
    if key in _MAT:
        return _MAT[key]
    s = MATS[name]
    m = bpy.data.materials.new(name + ("_dream" if dream else ""))
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bs.outputs[0], out.inputs[0])
    vcn = nt.nodes.new("ShaderNodeVertexColor")
    vcn.layer_name = "Col"
    if s["tex"]:
        tn = nt.nodes.new("ShaderNodeTexImage")
        tn.image = load_img(tex_path(s["tex"]))
        tn.interpolation = "Smart"
        mx = nt.nodes.new("ShaderNodeMix")
        mx.data_type = "RGBA"
        mx.blend_type = "MULTIPLY"
        mx.inputs[0].default_value = 1.0
        nt.links.new(tn.outputs[0], mx.inputs[6])
        nt.links.new(vcn.outputs[0], mx.inputs[7])
        nt.links.new(mx.outputs[2], bs.inputs["Base Color"])
        if s["tex"] in ("posters", "dial", "clock", "fareboard", "film", "sea", "dirt"):
            pass
        if s["alpha"] is not None and s["tex"] in ("dirt", "grime"):
            nt.links.new(tn.outputs[1], bs.inputs["Alpha"])
    else:
        nt.links.new(vcn.outputs[0], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = s["rough"]
    bs.inputs["Metallic"].default_value = s["metal"]
    if s["metal"] > 0.5:
        bs.inputs["Specular IOR Level"].default_value = 0.5
    ems = s["dems"] if dream and s["dems"] else s["ems"]
    if ems:
        bs.inputs["Emission Color"].default_value = srgb(*ems[0])
        bs.inputs["Emission Strength"].default_value = ems[1]
    al = s["dalpha"] if dream and s["dalpha"] is not None else s["alpha"]
    if al is not None and s["tex"] not in ("dirt", "grime"):
        bs.inputs["Alpha"].default_value = al
    if al is not None:
        m.surface_render_method = "BLENDED"
    m.use_backface_culling = False
    _MAT[key] = m
    return m


# ======================================================================================================================
# realise a Cell -> Blender objects
# ======================================================================================================================
def _newell(vs):
    n = np.zeros(3)
    for i in range(len(vs)):
        a, b = vs[i], vs[(i + 1) % len(vs)]
        n += ((a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1]))
    return n


def realize(cell, offset, do_uv1=False):
    scene = bpy.context.scene
    coll = bpy.data.collections.new(cell.name)
    scene.collection.children.link(coll)
    root = bpy.data.objects.new("cell_" + cell.name, None)
    root.empty_display_size = 0.5
    root.location = offset
    coll.objects.link(root)
    root["room"] = cell.name
    groups = {}
    for f in cell.F:
        groups.setdefault(f["g"], []).append(f)
    rj = random.Random(hash(cell.name) & 0xffff)
    stats = {}
    for g, faces in groups.items():
        pivot = np.array(cell.pivots.get(g, (0, 0, 0)), dtype=float) if hasattr(cell, "pivots") else np.zeros(3)
        vmap, verts, polys, mats, smooth, uv0, vcs = {}, [], [], [], [], [], []
        seenf = set()
        for f in faces:
            spec = MATS[f["m"]]
            col = spec["dcol"] if cell.dream and spec["dcol"] else spec["col"]
            j = 1.0 + rj.uniform(-0.03, 0.03)
            base = srgb(*col)
            vcm = f["vc"] or (1, 1, 1)
            fc = (min(1, base[0] * j * vcm[0]), min(1, base[1] * j * vcm[1]), min(1, base[2] * j * vcm[2]), 1.0)
            idx, fuv = [], []
            nn = np.abs(_newell([np.array(p) for p in f["v"]]))
            ax = int(np.argmax(nn))
            uu, vv = [(1, 2), (0, 2), (0, 1)][ax]
            for ii, p in enumerate(f["v"]):
                pp = np.array(p) - pivot
                k = (round(pp[0], 5), round(pp[1], 5), round(pp[2], 5))
                if k not in vmap:
                    vmap[k] = len(verts)
                    verts.append(k)
                if idx and idx[-1] == vmap[k]:
                    continue
                idx.append(vmap[k])
                fuv.append(f["uv"][ii] if f["uv"] else (p[uu] / spec["tile"], p[vv] / spec["tile"]))
            while len(idx) > 1 and idx[0] == idx[-1]:
                idx.pop(); fuv.pop()
            if len(set(idx)) < 3 or len(set(idx)) != len(idx) or frozenset(idx) in seenf:
                continue
            seenf.add(frozenset(idx))
            polys.append(idx)
            mats.append(f["m"])
            smooth.append(f["sm"])
            vcs.extend([fc] * len(idx))
            uv0.extend(fuv)
        if not polys:
            continue
        me = bpy.data.meshes.new(f"{cell.name}__{g}")
        me.vertices.add(len(verts))
        me.vertices.foreach_set("co", np.array(verts, dtype=np.float32).ravel())
        me.loops.add(sum(len(p) for p in polys))
        me.loops.foreach_set("vertex_index", np.array([i for p in polys for i in p], dtype=np.int32))
        me.polygons.add(len(polys))
        me.polygons.foreach_set("loop_start", np.cumsum([0] + [len(p) for p in polys[:-1]]).astype(np.int32))
        me.polygons.foreach_set("loop_total", np.array([len(p) for p in polys], dtype=np.int32))
        me.update(calc_edges=True)
        slots = []
        for mn in mats:
            if mn not in slots:
                slots.append(mn)
        for mn in slots:
            me.materials.append(get_mat(mn, cell.dream))
        me.polygons.foreach_set("material_index", [slots.index(x) for x in mats])
        me.polygons.foreach_set("use_smooth", smooth)
        uvl = me.uv_layers.new(name="UV0")
        uvl.data.foreach_set("uv", np.array(uv0, dtype=np.float32).ravel())
        ca = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
        ca.data.foreach_set("color", np.array(vcs, dtype=np.float32).ravel())
        me.update()
        ob = bpy.data.objects.new(f"{cell.name}__{g}", me)
        ob.location = tuple(pivot)
        ob.parent = root
        coll.objects.link(ob)
        stats[g] = sum(len(p) - 2 for p in polys)
        if do_uv1:
            uv1 = me.uv_layers.new(name="UV1")
            me.uv_layers.active = uv1
            bpy.ops.object.select_all(action="DESELECT")
            bpy.context.view_layer.objects.active = ob
            ob.select_set(True)
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.select_all(action="SELECT")
            try:
                bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.004)
            except Exception as e:
                print("uv1 fail", e)
            bpy.ops.object.mode_set(mode="OBJECT")
            me.uv_layers.active = me.uv_layers["UV0"]
    # collision floors
    if getattr(cell, "col", None):
        vs, ps = [], []
        for quad in cell.col:
            ps.append(list(range(len(vs), len(vs) + len(quad))))
            vs.extend(quad)
        me = bpy.data.meshes.new(f"{cell.name}__col_floor")
        me.from_pydata(vs, [], ps)
        ob = bpy.data.objects.new(f"{cell.name}__col_floor", me)
        ob["collision"] = 1
        ob.hide_render = True
        ob.parent = root
        coll.objects.link(ob)
    # lights
    for L in cell.lights:
        if L.get("ref") and DO_EXPORT:
            continue
        kind = L["kind"]
        ld = bpy.data.lights.new("light_" + L["name"], {"point": "POINT", "sun": "SUN", "area": "AREA", "spot": "SPOT"}[kind])
        ld.color = srgb(*L["color"])[:3]
        ld.energy = L["watt"]
        if kind == "point":
            ld.shadow_soft_size = L["size"]
        elif kind == "sun":
            ld.angle = L["size"] * D2R
        elif kind == "area":
            ld.shape = "RECTANGLE"
            ld.size, ld.size_y = L["size"] if isinstance(L["size"], tuple) else (L["size"], L["size"])
        elif kind == "spot":
            ld.spot_size = (L["spot"] or 60) * D2R
            ld.spot_blend = 0.4
            ld.shadow_soft_size = L["size"]
        lo = bpy.data.objects.new("light_" + L["name"], ld)
        lo.location = L["loc"]
        if L["target"] is not None:
            d = Vector(L["target"]) - Vector(L["loc"])
            lo.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        lo.parent = root
        coll.objects.link(lo)
    # cameras
    for cm in cell.cams:
        cd = bpy.data.cameras.new(cm["name"])
        cd.lens = cm["lens"]
        cd.sensor_width = 36
        cd.clip_start, cd.clip_end = 0.05, 200
        co = bpy.data.objects.new("cam_" + cell.name + "_" + cm["name"], cd)
        co.location = cm["loc"]
        d = Vector(cm["tgt"]) - Vector(cm["loc"])
        co.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        co.parent = root
        co["cam"] = cm["name"]
        coll.objects.link(co)
    return coll, root, stats


# ======================================================================================================================
# articulated parts: rivet empties, kinematic extras, NLA clips (exported as named glTF animations), render poses
# ======================================================================================================================
def rig_cell(cell, coll, root):
    if not cell.gates:
        return
    sc = bpy.context.scene
    sc.render.fps = GATE_FPS
    info = {}
    for gate in cell.gates:
        fr = gate.frames()
        M3 = gate.M3
        info[gate.key] = dict(clips=[f"{gate.key}_open", f"{gate.key}_close"], seconds=GATE_T, fps=GATE_FPS, cells=gate.N,
                              widthClosed=gate.wmax, widthOpen=gate.wmin, widthRest=gate.wrest, strapHalfLength=GATE_L,
                              bands=list(gate.bands), rule="pitch s = W/N, strap angle = acos(s / 2l); straps turn about their picket rivet")
        for g, p in gate.parts.items():
            ob = bpy.data.objects.get(f"{cell.name}__{g}")
            if ob is None:
                print("RIG missing", g)
                continue
            ob.rotation_mode = "QUATERNION"
            ob["kin"] = json.dumps({k: v for k, v in p.items() if k in ("kind", "i", "b", "lay")})
            pins = {pn: tuple(M3 @ Vector(off)) for pn, off in p.get("pins", {}).items()}
            if p["kind"] == "strap" and p["lay"] == "A":
                for pn, off in pins.items():
                    e = bpy.data.objects.new(f"{cell.name}__{gate.key}_{pn}", None)
                    e.empty_display_size = 0.012
                    coll.objects.link(e)
                    e.parent = ob
                    e.location = off
                    e["rivet"] = pn
            elif pins:
                ob["pin_local"] = json.dumps({pn: [round(x, 6) for x in v] for pn, v in pins.items()})
            if p["kind"] in ("latch", "roller"):
                e = bpy.data.objects.new(f"{cell.name}__{gate.key}_{'latch_pin' if p['kind'] == 'latch' else 'axle%d' % p['i']}", None)
                e.empty_display_size = 0.012
                coll.objects.link(e)
                e.parent = ob
                e["rivet"] = "pivot"
            rest_loc = Vector(ob.location)
            ad = ob.animation_data_create()
            for clip, keys in fr[g].items():
                act = bpy.data.actions.new(f"{cell.name}__{g}__{clip}")
                ad.action = act
                for (f, loc, (axis, ang)) in keys:
                    ob.location = loc
                    ob.rotation_quaternion = Quaternion(axis, ang)
                    ob.keyframe_insert("location", frame=f)
                    ob.keyframe_insert("rotation_quaternion", frame=f)
                ad.action = None
                tr = ad.nla_tracks.new()
                tr.name = clip
                tr.strips.new(clip, 0, act)
                tr.mute = True
            ob.location = rest_loc
            ob.rotation_quaternion = Quaternion()
    root["gates"] = json.dumps(info)


def pose_gate(cell, gate, W, latch=0.0):
    for g, (loc, (axis, ang)) in gate.pose(W, latch).items():
        ob = bpy.data.objects.get(f"{cell.name}__{g}")
        if ob is not None:
            ob.location = loc
            ob.rotation_quaternion = Quaternion(axis, ang)


def render_gate_states(cell, coll, outdir):
    """Gate closeups at closed / half / open (1280x720): each gate is posed through the same kinematics as its clips; the other
    gate stays at its rest pose."""
    sc = bpy.context.scene
    outdir.mkdir(parents=True, exist_ok=True)
    for c_ in bpy.data.collections:
        c_.hide_render = c_ is not coll
    setup_render(getattr(cell, "env", {}), SAMPLES)
    root = bpy.data.objects["cell_" + cell.name]
    cams = {"car_gate": ((2.72, 0.98, 1.50), (2.02, 1.60, 1.12), 26), "landing_gate": ((2.62, 0.52, 1.48), (1.92, 1.43, 1.12), 24)}
    for gate in cell.gates:
        for other in cell.gates:
            pose_gate(cell, other, other.wrest)
        loc, tgt, lens = cams[gate.key]
        dz = 0.45 if (cell.dream and gate.key == "car_gate") else 0.0
        cd = bpy.data.cameras.new("gatecam")
        cd.lens, cd.sensor_width, cd.clip_start = lens, 36, 0.02
        co = bpy.data.objects.new("gatecam_" + gate.key, cd)
        coll.objects.link(co)
        co.parent = root
        co.location = (loc[0], loc[1], loc[2] + dz)
        co.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        sc.camera = co
        for state, W, la in (("closed", gate.wmax, 0.0), ("half", 0.5 * (gate.wmax + gate.wmin), GATE_LATCH_LIFT * D2R), ("open", gate.wmin, 0.0)):
            pose_gate(cell, gate, W, la)
            bpy.context.view_layer.update()
            sc.view_settings.exposure = cell.env.get("exposure", 0.0)
            pth = outdir / f"{cell.name}_gate_{gate.key}_{state}.png"
            sc.render.filepath = str(pth)
            t0 = time.time()
            bpy.ops.render.render(write_still=True)
            print(f"RENDER {pth.name} {time.time() - t0:.1f}s", flush=True)
        pose_gate(cell, gate, gate.wrest)


def write_stair_plan(cell):
    """stair-plan.json: every step polygon (cell coords, Z-up), its tread height, walking samples, the head landing and the
    opening, plus the cell->world transform, so the runtime and the ray check use the same numbers."""
    steps = cell.stair_steps
    out = dict(version="v1.2", risers=ST_NR, riser=ST_R, headZ=ST_HEAD, cellToWorld="world = cell + (-14.05, -12.55, +0.15)",
               opening=ST_OPEN, headLanding=ST_LANDING, slab=ST_SLAB, trimmerDepth=ST_TRIM_D,
               doors={"stairhead": {"wall": "y 3.5", "x": [1.075, 2.475], "z": [15.0, 17.5]},
                      "liftTransfer": {"wall": "x 3.55", "y": [0.85, 2.65], "z": [15.0, 17.75]}},
               steps=[dict(n=s["n"], kind=s["kind"], quarter=s["k"], z=round(s["z"], 4), poly=[[round(a, 4), round(b, 4)] for a, b in s["poly"]],
                           walk={k: [round(v[0], 4), round(v[1], 4)] for k, v in st_walk_samples(s).items()}) for s in steps])
    (HERE / "stair-plan.json").write_text(json.dumps(out, indent=1), encoding="utf-8")


# ======================================================================================================================
# render
# ======================================================================================================================
def setup_render(env, samples):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    cp = bpy.context.preferences.addons["cycles"].preferences
    cp.compute_device_type = "CUDA"
    cp.get_devices()
    for d in cp.devices:
        d.use = d.type == "CUDA"
    sc.cycles.device = "GPU"
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.015
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    sc.cycles.max_bounces = 8
    sc.cycles.glossy_bounces = 6
    sc.cycles.transparent_max_bounces = 16
    sc.cycles.sample_clamp_indirect = 8
    sc.cycles.blur_glossy = 0.4
    sc.render.resolution_x = int(1280 * SCALE)
    sc.render.resolution_y = int(720 * SCALE)
    sc.render.image_settings.file_format = "PNG"
    sc.view_settings.view_transform = "AgX"
    try:
        sc.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    sc.view_settings.exposure = env.get("exposure", 0.0)
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "NISHITA"
    sky.sun_elevation = env.get("sun_elev", 35) * D2R
    sky.sun_rotation = env.get("sun_rot", 200) * D2R
    sky.sun_disc = False
    sky.air_density, sky.dust_density = 1.0, 1.2
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = env.get("sky", 0.6)
    o = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(sky.outputs[0], bg.inputs[0])
    nt.links.new(bg.outputs[0], o.inputs[0])
    sc.world = w
    sc.use_nodes = True
    nt = sc.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new("CompositorNodeRLayers")
    gl = nt.nodes.new("CompositorNodeGlare")
    gl.glare_type = "FOG_GLOW"
    gl.quality = "HIGH"
    gl.threshold = env.get("glare_thr", 1.0)
    gl.size = 7
    gl.mix = env.get("glare_mix", -0.55)
    cmp_ = nt.nodes.new("CompositorNodeComposite")
    nt.links.new(rl.outputs[0], gl.inputs[0])
    nt.links.new(gl.outputs[0], cmp_.inputs[0])


def render_cams(cell, coll, outdir, names=None):
    sc = bpy.context.scene
    outdir.mkdir(parents=True, exist_ok=True)
    for c_ in bpy.data.collections:
        c_.hide_render = c_ is not coll
    setup_render(getattr(cell, "env", {}), SAMPLES)
    for cm in cell.cams:
        if names and not any(cm["name"].startswith(n) for n in names):
            continue
        obj = bpy.data.objects["cam_" + cell.name + "_" + cm["name"]]
        sc.camera = obj
        sc.view_settings.exposure = cell.env.get("exposure", 0.0) + cm.get("exp", 0.0)
        p = outdir / f"{cell.name}_{cm['name']}.png"
        sc.render.filepath = str(p)
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        print(f"RENDER {p.name} {time.time() - t0:.1f}s", flush=True)


def export_glb(path):
    for c_ in bpy.data.collections:
        c_.hide_render = False
    kw = dict(filepath=str(path), export_format="GLB", export_apply=False, export_cameras=True, export_lights=True,
              export_extras=True, export_yup=True, export_texcoords=True, export_normals=True, export_materials="EXPORT",
              export_image_format="AUTO", export_attributes=False, export_animations=True,
              export_animation_mode="NLA_TRACKS", export_force_sampling=True, export_optimize_animation_size=False)
    if not flag("--no-draco"):
        kw.update(export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6, export_draco_position_quantization=14,
                  export_draco_normal_quantization=10, export_draco_texcoord_quantization=12, export_draco_color_quantization=8,
                  export_draco_generic_quantization=12)
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color="MATERIAL")
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)


# ======================================================================================================================
# shared prop kit.  Local origin = floor centre unless noted.  All edges beveled (detail-spec s6), parts separate.
# ======================================================================================================================
def R(a, b):
    return RNG.uniform(a, b)


def bevbox(c, mat, x0, y0, z0, x1, y1, z1, r=0.004, vc=None):
    box(c, mat, (x0, y0, z0), (x1, y1, z1), r=r, vc=vc)


def screw(c, x, y, z, axis="z", r=0.0035, mat="brass"):
    """Slotted screw head, sits 1.5 mm proud."""
    with c.at((x, y, z), rx={"z": 0, "y": -90, "x": 0}[axis], ry={"z": 0, "y": 0, "x": 90}[axis]):
        cyl(c, mat, r, 0.0016, 8, ch=0.0005, smooth=False)
        box(c, "paint_dark", (-r * 0.8, -0.0004, 0.0012), (r * 0.8, 0.0004, 0.0019), r=0)


def coin_cluster(c, n, spread=0.06, mat="brass_worn", r=0.012):
    for i in range(n):
        a, d = R(0, 6.28), R(0, spread) ** 1.0
        st = i // 6
        with c.at((math.cos(a) * d, math.sin(a) * d, st * 0.0015), rz=R(0, 360)):
            cyl(c, mat, r, 0.0015, 10, smooth=False)


def bench(c, L=1.8, back=True, mat_wood="oak", tall=0.44):
    """Slatted bench, length along X centred, seat front toward -Y, back at +Y.  Cast-iron standards + slats + stretchers."""
    D = 0.42
    n = 5 if c.lod else 3
    gap = 0.005
    sw = (D - gap * (n - 1)) / n
    for i in range(n):                      # seat slats, front edge rounded
        y0 = -D / 2 + i * (sw + gap)
        box(c, mat_wood, (-L / 2, y0, tall - 0.028), (L / 2, y0 + sw, tall), r=0.006)
        for sx in ((-L / 2 + 0.05, L / 2 - 0.05) if c.lod else ()):
            if c.lod:
                screw(c, sx, y0 + sw / 2, tall)
    nmid = max(0, int(L / 1.6))
    xs = [-L / 2 + 0.06 + k * (L - 0.12) / (nmid + 1) for k in range(nmid + 2)]
    prof = [(-0.20, 0.0), (-0.16, 0.0), (-0.15, 0.03), (-0.14, tall - 0.028), (0.20, tall - 0.028), (0.22, tall - 0.03)]
    for x in xs:                            # cast iron standard: leg + scroll foot + back post
        with c.at((x, 0, 0), m=Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))):
            extrude(c, "iron", [(-0.19, 0), (0.19, 0), (0.19, 0.02), (0.05, 0.025), (0.035, tall - 0.028), (-0.16, tall - 0.028),
                                (-0.16, tall - 0.05), (-0.03, tall - 0.06), (-0.035, 0.03), (-0.19, 0.02)], depth=0.018, w0=-0.009)
        if back:
            tube(c, "iron", (x, D / 2 - 0.02, tall - 0.03), (x, D / 2 - 0.03, tall + 0.42), 0.011, 8)
            if c.lod:
                with c.at((x, D / 2 - 0.03, tall + 0.43)):
                    sphere(c, "iron", 0.017, 8, 5)
    for zz in (0.14,):                      # stretcher bars
        tube(c, "iron", (-L / 2 + 0.06, -0.02, zz), (L / 2 - 0.06, -0.02, zz), 0.008, 6)
    if back:
        for k, z0 in enumerate((tall + 0.05, tall + 0.19, tall + 0.32) if c.lod else (tall + 0.08, tall + 0.30)):
            box(c, mat_wood, (-L / 2 + 0.03, D / 2 - 0.045, z0), (L / 2 - 0.03, D / 2 - 0.02, z0 + 0.1), r=0.005)
            for sx in xs:
                if c.lod:
                    screw(c, sx, D / 2 - 0.045, z0 + 0.05, axis="y")


def lamp_shade(c, r=0.11, h=0.16, mat="lamp_milk"):
    prof = [(r * 0.30, 0), (r * 0.55, 0.01), (r * 0.9, h * 0.35), (r, h * 0.6), (r * 0.92, h * 0.9), (r * 0.7, h)]
    lathe(c, mat, prof, 14 if c.lod else 8, True)


def pendant(c, drop=0.9, r=0.11, real_light=False, name="pend", watt=25, gm="lamp_milk", rose=True):
    """Origin at ceiling.  Cord, rose, brass socket, bulb + shade.  Bulb emissive."""
    if rose:
        lathe(c, "porcelain", [(0, 0), (0.06, 0), (0.06, -0.006), (0.045, -0.02), (0.02, -0.028), (0, -0.028)], 12 if c.lod else 6, True)
    tube(c, "rubber", (0, 0, -0.028), (0, 0, -drop + 0.09), 0.0035, 5 if c.lod else 3)
    with c.at((0, 0, -drop)):
        lathe(c, "brass", [(0.014, 0.10), (0.022, 0.095), (0.022, 0.06), (0.03, 0.05), (0.03, 0.03), (0.02, 0.02)], 10 if c.lod else 6, True)
        with c.at((0, 0, -0.03)):
            sphere(c, "bulb", 0.034, 10 if c.lod else 6, 6 if c.lod else 4)
            if c.lod:
                tube(c, "wire", (0, 0, -0.005), (0, 0, 0.03), 0.0006, 3)
        with c.at((0, 0, -0.10)):
            lamp_shade(c, r, 0.16, gm)
    if real_light:
        c.light("point", name, (0, 0, -drop - 0.03), color=(255, 205, 140), watt=watt, size=0.05)


def globe_lamp(c, r=0.13, real_light=False, name="globe", watt=30):
    """Brass-collared milk-glass globe on a stem (newel lamp). Origin = base."""
    cyl(c, "brass", 0.06, 0.03, 12, ch=0.004)
    lathe(c, "brass", [(0.035, 0.03), (0.02, 0.06), (0.02, 0.16), (0.05, 0.19), (0.075, 0.2)], 12, True)
    with c.at((0, 0, 0.2 + r * 0.82)):
        sphere(c, "lamp_milk", r, 16, 10)
    with c.at((0, 0, 0.2 + r * 0.82)):
        sphere(c, "bulb", 0.03, 8, 5)
    if real_light:
        c.light("point", name, (0, 0, 0.2 + r * 0.82), color=(255, 205, 140), watt=watt, size=0.06)


def switch_plate(c, kind="rotary"):
    """Porcelain rotary switch on a plate, standing 3 mm proud of the wall (wall = local XY plane facing +Z)."""
    box(c, "porcelain", (-0.035, -0.055, 0), (0.035, 0.055, 0.008), r=0.0025)
    for sy in (-0.043, 0.043):
        screw(c, 0, sy, 0.008, "z", 0.0032, "brass_worn")
    with c.at((0, 0, 0.008)):
        cyl(c, "brass", 0.019, 0.006, 16, ch=0.001)
        lathe(c, "porcelain", [(0, 0.006), (0.015, 0.006), (0.015, 0.012), (0.011, 0.016), (0, 0.016)], 16, True)
        box(c, "brass", (-0.0025, -0.013, 0.014), (0.0025, 0.013, 0.0175), r=0.0008)


def bell_push(c):
    """Porcelain plate with a brass ring and a raised button (1912 electric bell push +)."""
    box(c, "porcelain", (-0.03, -0.05, 0), (0.03, 0.05, 0.007), r=0.002)
    with c.at((0, 0, 0.007)):
        cyl(c, "brass", 0.021, 0.004, 20, ch=0.0008)
        cyl(c, "paint_dark", 0.0175, 0.0042, 20)                          # ring groove
        lathe(c, "porcelain", [(0, 0.004), (0.014, 0.004), (0.014, 0.0075), (0.011, 0.0100), (0, 0.0105)], 20, True)
    for sy in (-0.038, 0.038):
        screw(c, 0, sy, 0.007, "z", 0.003, "brass_worn")


def wall_clock(c, w=0.44, mat_case="teak", tag="a", t_hands=(10, 10)):
    """Regulator pendulum clock, wall = XZ plane, depth toward +Y.  Case parts, brass bezel, glazed dial, hands, glass
    trunk door with visible pendulum rod + bob, two hanging weights.  Pendulum = node `anim_clock_pendulum_<tag>`."""
    H, D = 1.15, 0.16
    box(c, mat_case, (-w / 2, 0, 0.02), (w / 2, D, H), r=0.008)
    box(c, mat_case, (-w / 2 - 0.025, -0.01, H), (w / 2 + 0.025, D + 0.02, H + 0.05), r=0.012)     # cornice
    box(c, mat_case, (-w / 2 - 0.012, -0.005, H + 0.05), (w / 2 + 0.012, D + 0.01, H + 0.08), r=0.008)
    box(c, mat_case, (-w / 2 - 0.02, -0.01, -0.02), (w / 2 + 0.02, D + 0.02, 0.02), r=0.01)        # base plinth
    zc = H - 0.19
    with c.at((0, D, zc), rx=-90):                                                               # dial group (axis -> +Y)
        cyl(c, "brass", 0.158, 0.03, 32, ch=0.004)
        cyl(c, "wood_dummy" if False else "paint_dark", 0.152, 0.004, 32, z0=0.028)
        with c.at((0, 0, 0.0315)):
            decal(c, "clock", 0.30, 0.30, uv=((0, 1), (1, 1), (1, 0), (0, 0)))
        with c.at((0, 0, 0.0325)):
            cyl(c, "glass", 0.152, 0.002, 32, cap=True)
        a_h = -(t_hands[0] % 12 * 30 + t_hands[1] * 0.5)
        a_m = -(t_hands[1] * 6)
        for ang, ln, wd, zz in ((a_h, 0.085, 0.011, 0.0325), (a_m, 0.125, 0.007, 0.0345)):
            with c.at((0, 0, zz), rz=ang):
                extrude(c, "paint_dark", [(-wd / 2, -0.02), (wd / 2, -0.02), (wd / 2 * 0.4, ln), (-wd / 2 * 0.4, ln)], (), depth=0.0016)
        with c.at((0, 0, 0.036)):
            sphere(c, "brass", 0.008, 8, 5)
    # trunk door: frame + glass, dark cavity behind, pendulum + weights
    zt0, zt1 = 0.14, H - 0.42
    box(c, "paint_dark", (-w / 2 + 0.05, D - 0.02, zt0), (w / 2 - 0.05, D - 0.005, zt1), r=0.002)
    for x0, x1 in ((-w / 2 + 0.028, -w / 2 + 0.05), (w / 2 - 0.05, w / 2 - 0.028)):
        box(c, mat_case, (x0, D - 0.03, zt0 - 0.02), (x1, D + 0.012, zt1 + 0.02), r=0.003)
    for zz in (zt0 - 0.022, zt1):
        box(c, mat_case, (-w / 2 + 0.028, D - 0.03, zz), (w / 2 - 0.028, D + 0.012, zz + 0.022), r=0.003)
    box(c, "glass", (-w / 2 + 0.05, D + 0.004, zt0), (w / 2 - 0.05, D + 0.0065, zt1), r=0)
    # brass key-hole escutcheon on the trunk door stile (raised, 2 mm)
    with c.at((w / 2 - 0.039, D + 0.012, (zt0 + zt1) / 2), rx=-90):
        cyl(c, "brass", 0.007, 0.003, 12, ch=0.0006)
    # gear train hint behind the dial door (movement plate)
    box(c, "brass_worn", (-0.08, D - 0.06, zc - 0.09), (0.08, D - 0.04, zc + 0.09), r=0.002)
    pv = (0, D - 0.035, zt1 - 0.02)
    with c.grp("anim_clock_pendulum_" + tag):
        c.pivots["anim_clock_pendulum_" + tag] = c.P(pv)
        tube(c, "brass", pv, (pv[0], pv[1], zt0 + 0.10), 0.0028, 6)
        with c.at((pv[0], pv[1], zt0 + 0.10)):
            lathe(c, "brass", [(0, -0.006), (0.055, -0.005), (0.058, 0), (0.055, 0.005), (0, 0.006)], 20, True)
    for sx in (-0.07, 0.07):                                                                    # weights on chains
        tube(c, "brass_worn", (sx, D - 0.04, zt1 - 0.01), (sx, D - 0.04, zt0 + 0.22), 0.0012, 4)
        with c.at((sx, D - 0.04, zt0 + 0.10)):
            cyl(c, "iron", 0.026, 0.12, 12, ch=0.003)
    return H


def abacus(c, rods=13, val=None):
    """Soroban: frame, divider bar, 13 rods; beads separate. Lies on a counter (origin = centre of underside)."""
    W, Dp, T = 0.24, 0.085, 0.024
    L = 0.10 + rods * 0.0185
    box(c, "teak", (-L / 2, -Dp / 2, 0), (L / 2, -Dp / 2 + 0.008, T), r=0.002)
    box(c, "teak", (-L / 2, Dp / 2 - 0.008, 0), (L / 2, Dp / 2, T), r=0.002)
    for sx in (-L / 2, L / 2 - 0.008):
        box(c, "teak", (sx, -Dp / 2, 0), (sx + 0.008, Dp / 2, T), r=0.002)
    box(c, "teak", (-L / 2 + 0.008, 0.012, 0.003), (L / 2 - 0.008, 0.0165, T - 0.003), r=0.0015)     # divider bar
    val = val or [0, 0, 0, 0, 0, 3, 8, 7, 1, 4, 2, 0, 0][:rods]
    for i in range(rods):
        x = -L / 2 + 0.055 + i * 0.0185
        tube(c, "brass_worn", (x, -Dp / 2 + 0.008, T / 2), (x, Dp / 2 - 0.008, T / 2), 0.0009, 4)
        v = val[i % len(val)]
        up = 1 if v >= 5 else 0
        low = v - 5 * up
        y = 0.0203 if up else 0.031
        with c.at((x, y, T / 2), rx=90):
            lathe(c, "paint_dark", [(0.001, -0.0035), (0.0085, -0.0008), (0.0085, 0.0008), (0.001, 0.0035)], 8, False)
        for k in range(4):
            y = (0.0085 - k * 0.007) if k < low else (-0.031 + (3 - k) * 0.007)
            with c.at((x, y, T / 2), rx=90):
                lathe(c, "paint_dark", [(0.001, -0.0035), (0.0085, -0.0008), (0.0085, 0.0008), (0.001, 0.0035)], 8, False)


def ticket_stack(c, n=12, w=0.03, h=0.055):
    """Stack of card tickets (Edmondson-like, fictional), origin at bottom centre."""
    for i in range(n):
        with c.at((R(-0.0008, 0.0008), R(-0.0008, 0.0008), i * 0.0006), rz=R(-1.5, 1.5)):
            box(c, "paper_ticket", (-w / 2, -h / 2, 0), (w / 2, h / 2, 0.0006), r=0)


def punch(c):
    """Hand ticket punch (pliers-like): two steel jaws, pivot pin, spring, handle grips."""
    for s in (-1, 1):
        with c.at(rz=s * 7):
            box(c, "steel", (0.0, -0.007 * (1 if s > 0 else 0) - 0.0055 * (0 if s > 0 else 1) - (0.004 if s > 0 else 0), 0), (0.085, 0.0035 if s > 0 else -0.0035, 0.008), r=0.0012)
            tube(c, "steel", (0.085, 0, 0.004), (0.14, 0, 0.004), 0.004, 6)
            with c.at((0.15, 0, 0.004), ry=90):
                cyl(c, "leather", 0.007, 0.075, 8, smooth=True)
    with c.at((0.03, 0, 0)):
        cyl(c, "brass", 0.005, 0.014, 8, ch=0.001)


def coin_tray(c, w=0.16, d=0.11):
    """Brass dip tray: rim + sloped floor, with coins."""
    box(c, "brass", (-w / 2, -d / 2, 0), (w / 2, -d / 2 + 0.006, 0.02), r=0.0015)
    box(c, "brass", (-w / 2, d / 2 - 0.006, 0), (w / 2, d / 2, 0.02), r=0.0015)
    box(c, "brass", (-w / 2, -d / 2, 0), (-w / 2 + 0.006, d / 2, 0.02), r=0.0015)
    box(c, "brass", (w / 2 - 0.006, -d / 2, 0), (w / 2, d / 2, 0.02), r=0.0015)
    box(c, "brass", (-w / 2 + 0.006, -d / 2 + 0.006, 0), (w / 2 - 0.006, d / 2 - 0.006, 0.003), r=0.0008)
    with c.at((0.0, 0, 0.003)):
        coin_cluster(c, 14, 0.04)


def umbrella(c, closed=True, mat_cloth="paint_dark", L=0.85):
    """Furled umbrella with hooked cane handle; standing on its tip, origin at tip."""
    tube(c, "iron", (0, 0, 0), (0, 0, 0.03), 0.003, 5)
    lathe(c, mat_cloth, [(0.0, 0.03), (0.011, 0.05), (0.028, 0.25), (0.034, 0.45), (0.024, 0.68), (0.006, 0.76)], 10, True)
    tube(c, "brass", (0, 0, 0.755), (0, 0, 0.84), 0.0065, 6)
    tube(c, "teak", (0, 0, 0.84), (0, 0, 0.90), 0.011, 8)
    # hook: half-torus from small segments
    pts = [(0.035 - 0.035 * math.cos(a * D2R), 0, 0.90 + 0.035 * math.sin(a * D2R)) for a in range(0, 190, 30)]
    for i in range(len(pts) - 1):
        tube(c, "teak", pts[i], pts[i + 1], 0.011, 6)
    tube(c, "brass", (0.0, 0, 0.80), (0.0, 0, 0.83), 0.0075, 6)   # ferrule


def potted_plant(c, h=0.9, pot_mat="terracotta", leaf_n=14, spread=0.34, leaf_mat="leaf"):
    """Aspidistra / palm-like plant: lathe pot, soil, long extruded leaves."""
    lathe(c, pot_mat, [(0.0, 0), (0.12, 0), (0.13, 0.02), (0.17, 0.30), (0.185, 0.32), (0.185, 0.34), (0.16, 0.34), (0.16, 0.32)], 18, True)
    with c.at((0, 0, 0.31)):
        cyl(c, "soil", 0.155, 0.01, 12)
    for i in range(leaf_n):
        a = i / leaf_n * 360 + R(-12, 12)
        L = h * R(0.7, 1.0)
        with c.at((0, 0, 0.32), rz=a, ry=R(10, 55)):
            n = 6
            pts_l, pts_r = [], []
            for k in range(n + 1):
                t = k / n
                wdt = 0.045 * math.sin(math.pi * min(1, t * 1.05)) ** 0.8 + 0.002
                z = L * t * 0.75
                x = L * (t ** 1.7) * 0.5
                pts_l.append((x, -wdt, z))
                pts_r.append((x, wdt, z))
            for k in range(n):
                c.face([pts_l[k], pts_r[k], pts_r[k + 1], pts_l[k + 1]], leaf_mat, smooth=False, vc=(R(0.85, 1.1),) * 3)
                c.face([pts_l[k + 1], pts_r[k + 1], pts_r[k], pts_l[k]], leaf_mat, smooth=False, vc=(R(0.85, 1.1),) * 3)


def pole_flower(c, mat="petal_a", n=7, r=0.035, stem=0.3, leaf=True):
    """Small daisy / chrysanthemum head on a stem. Origin = stem bottom. Tiny (~60 tris)."""
    tube(c, "leaf", (0, 0, 0), (0, 0, stem), 0.0022, 4)
    with c.at((0, 0, stem)):
        for i in range(n):
            a = i / n * 360
            with c.at(rz=a, ry=-20):
                c.face([(0, -0.006, 0), (r, -0.011, 0.004), (r * 1.1, 0.0, 0.006), (r, 0.011, 0.004), (0, 0.006, 0)], mat, vc=(R(0.9, 1.1),) * 3)
        with c.at((0, 0, 0.004)):
            sphere(c, "petal_b" if mat != "petal_b" else "petal_a", 0.011, 6, 4)


def flower_pot_bouquet(c, mat_flower=("petal_a", "petal_b", "petal_c"), n=9, vase=True, h=0.5, r=0.13):
    if vase:
        lathe(c, "porcelain", [(0, 0), (0.07, 0), (0.09, 0.06), (0.10, 0.16), (0.075, 0.25), (0.06, 0.28), (0.075, 0.30), (0.062, 0.30), (0.05, 0.25)], 16, True)
    for i in range(n):
        a = R(0, 360)
        tilt = R(4, 34)
        with c.at((R(-0.02, 0.02), R(-0.02, 0.02), 0.27), rz=a, ry=tilt):
            pole_flower(c, RNG.choice(mat_flower), 6, R(0.028, 0.045), h * R(0.7, 1.05))


def film_reel(c, r=0.18, w=0.03, film=True, mat="steel"):
    """Steel film reel, axis along local Z: two flanges with cut-outs (spokes), hub with keyed bore, wound film."""
    for zz in (0.0, w - 0.002):
        with c.at((0, 0, zz)):
            lathe(c, mat, [(0.02, 0.0), (r * 0.97, 0.0), (r, 0.001), (r, 0.002), (r * 0.97, 0.002), (0.02, 0.002)], 40, False)
    with c.at((0, 0, 0)):
        cyl(c, mat, 0.03, w, 20, ch=0.002)
        cyl(c, "iron", 0.011, w + 0.004, 8, z0=-0.002)
    if film:
        rr = r * 0.9
        lathe(c, "celluloid", [(0.032, 0.004), (rr, 0.004), (rr, w - 0.006), (0.032, w - 0.006)], 32, True)


def film_can(c, r=0.19, h=0.045):
    """Round tin film can with lid seam, rim bead, hinge clasp; fictional paper label = blank."""
    cyl(c, "steel", r, h, 18, ch=0.003)
    with c.at((0, 0, h)):
        cyl(c, "steel", r * 1.02, 0.014, 18, ch=0.0025)
        cyl(c, "steel", r * 0.6, 0.003, 12, z0=0.014, ch=0.001)
    with c.at((r * 1.0, 0, h * 0.5)):
        box(c, "brass_worn", (0, -0.014, -0.02), (0.006, 0.014, 0.03), r=0.0015)


def brass_grille(c, w=0.36, h=0.30, bars=9, arch=True):
    """Ticket-window grille in local XZ plane (front toward -Y... faces +Y). Round bars between top/bottom rails, rosettes."""
    z0 = 0.0
    for z in (0.0, h - 0.014):
        box(c, "brass", (-w / 2, -0.008, z), (w / 2, 0.008, z + 0.014), r=0.0025)
    for i in range(bars):
        x = -w / 2 + 0.02 + i * (w - 0.04) / (bars - 1)
        tube(c, "brass", (x, 0, 0.012), (x, 0, h - 0.012), 0.0032, 8)
    with c.at((0, 0, h * 0.5), rx=90):
        for dz in (-1, 1):
            pass
    # oval speaking aperture ring (centre)
    with c.at((0, 0.0, h * 0.42), rx=90):
        for i in range(24):
            a0, a1 = i / 24 * 2 * math.pi, (i + 1) / 24 * 2 * math.pi
            p0 = (0.055 * math.cos(a0), 0.028 * math.sin(a0), 0)
            p1 = (0.055 * math.cos(a1), 0.028 * math.sin(a1), 0)
            tube(c, "brass", (p0[0], p0[1], -0.006), (p1[0], p1[1], -0.006), 0.0035, 6)
    for i in range(bars - 1):
        x = -w / 2 + 0.02 + (i + 0.5) * (w - 0.04) / (bars - 1)
        with c.at((x, 0, h * 0.75)):
            sphere(c, "brass", 0.0065, 8, 5)


def poster(c, w=0.5, h=0.75, idx=0, frame="teak"):
    """Framed fictional poster (posters atlas cell idx 0-7), wall = XY plane facing +Z, origin bottom centre."""
    fr = 0.03
    box(c, frame, (-w / 2, 0, 0), (w / 2, 0.02, fr), r=0.004)
    box(c, frame, (-w / 2, 0, h - fr), (w / 2, 0.02, h), r=0.004)
    box(c, frame, (-w / 2, 0, 0), (-w / 2 + fr, 0.02, h), r=0.004)
    box(c, frame, (w / 2 - fr, 0, 0), (w / 2, 0.02, h), r=0.004)
    col, row = idx % 4, 1 - idx // 4
    u0, u1, v0, v1 = col / 4, (col + 1) / 4, row / 2, (row + 1) / 2
    with c.at((0, 0.012, h / 2), rx=90):
        # rx=90: local +Z -> -Y; we want the print facing +Y, so flip about local X
        c.face([(-w / 2 + fr, -(h / 2 - fr), 0), (w / 2 - fr, -(h / 2 - fr), 0), (w / 2 - fr, h / 2 - fr, 0), (-w / 2 + fr, h / 2 - fr, 0)],
               "posters", uv=[(u0, v0), (u1, v0), (u1, v1), (u0, v1)], flip=True)
    with c.at((0, 0.0125, h / 2), rx=90):
        pass


def lathe_baluster(c, h=0.85, mat="teak"):
    prof = [(0.0, 0), (0.022, 0), (0.022, 0.02), (0.014, 0.04), (0.014, 0.12), (0.024, 0.16), (0.027, 0.20), (0.017, 0.26),
            (0.012, 0.30), (0.012, h - 0.30), (0.017, h - 0.26), (0.027, h - 0.20), (0.024, h - 0.16), (0.014, h - 0.12),
            (0.014, h - 0.04), (0.022, h - 0.02), (0.022, h), (0.0, h)]
    lathe(c, mat, prof, 10, True)


def porcelain_cleat_run(c, p0, p1, every=0.55, z_off=0.0, wire=True):
    """Knob-and-tube style wire on porcelain insulators along a straight run (1912 open wiring)."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    L = d.length
    n = max(1, int(L / (every if c.lod else every * 2.0)))
    if wire:
        for i in range(n):
            a = p0 + d * (i / n)
            b = p0 + d * ((i + 1) / n)
            sag = 0.012
            m = (a + b) / 2 - Vector((0, 0, sag))
            tube(c, "rubber", a + Vector((0, 0, 0.014)), m + Vector((0, 0, 0.014)), 0.0028, 3)
            tube(c, "rubber", m + Vector((0, 0, 0.014)), b + Vector((0, 0, 0.014)), 0.0028, 3)
    for i in range(n + 1):
        a = p0 + d * (i / n)
        with c.at(a):
            cyl(c, "porcelain", 0.008, 0.012, 8 if c.lod else 5, ch=0.0015 if c.lod else 0.0)
            cyl(c, "porcelain", 0.013, 0.004, 8 if c.lod else 5, z0=0.006, smooth=True)


# ======================================================================================================================
# shell helpers + shared dressing pieces
# ======================================================================================================================
def wallXZ(c, mat, x0, x1, z0, z1, y0, y1, holes=(), vc=None):
    """Wall slab in an XZ plane spanning y0..y1; holes = polygons in (x, z)."""
    with c.at(m=M_XZ(y0)):
        extrude(c, mat, rect_pts(x0, z0, x1, z1), holes, depth=y1 - y0, vc=vc)


def wallYZ(c, mat, y0, y1, z0, z1, x0, x1, holes=(), vc=None):
    with c.at(m=M_YZ(x0)):
        extrude(c, mat, rect_pts(y0, z0, y1, z1), holes, depth=x1 - x0, vc=vc)


def slab(c, mat, x0, x1, y0, y1, z0, z1, r=0.006, vc=None):
    box(c, mat, (x0, y0, z0), (x1, y1, z1), r=r, vc=vc)


def offset_poly(pts, d):
    """Crude outward offset of a convex-ish polygon about its centroid (fine for arch outlines)."""
    cx = sum(p[0] for p in pts) / len(pts)
    cz = sum(p[1] for p in pts) / len(pts)
    out = []
    for p in pts:
        vx, vz = p[0] - cx, p[1] - cz
        L = math.hypot(vx, vz) or 1
        out.append((p[0] + vx / L * d, p[1] + vz / L * d))
    return out


def arch_ring(c, mat, x0, x1, zs, rise, z0, d_out, depth, w0, n=14, vc=None):
    """Moulded arch ring (architrave / voussoirs) in the current local (u,v,w) frame."""
    inner = arch_pts(x0, x1, zs, rise, n, z0)
    outer = arch_pts(x0 - d_out, x1 + d_out, zs, rise + d_out, n, z0)
    # keep the ring open at the bottom: use inner/outer strip between the two outlines (skip the closing base)
    loops_o, loops_i = outer[1:-1], inner[1:-1]
    pts = loops_o + loops_i[::-1]
    extrude(c, mat, pts, (), depth=depth, w0=w0, vc=vc)


def muntin_grid(c, mat, u0, u1, v0, v1, cols, rows, w0, th=0.022, dp=0.03):
    for i in range(1, cols):
        u = u0 + (u1 - u0) * i / cols
        box(c, mat, (u - th / 2, v0, w0), (u + th / 2, v1, w0 + dp), r=0.002)
    for j in range(1, rows):
        v = v0 + (v1 - v0) * j / rows
        box(c, mat, (u0, v - th / 2, w0), (u1, v + th / 2, w0 + dp), r=0.002)


def arched_window(c, wall_plane_x, yc, w=1.3, sill=0.9, spring=3.1, wall=0.5, frame_mat="paint_cream", curtain=True, M=None,
                  dirt=True, glass_mat="glass", sun_ref=False, inner_trim=True):
    """Deep-reveal arched sash window with muntins and a tie-back curtain in a YZ wall (plane at x=wall_plane_x, wall
    extends to -x by `wall`).  Local frame: u=y, v=z, w=x.  Glass sits 4 cm behind the frame face (detail-spec s1)."""
    rise = w / 2
    u0, u1 = yc - w / 2, yc + w / 2
    with c.at(m=M if M is not None else M_YZ(wall_plane_x)):
        # outer frame ring (in the reveal), sash frame, muntins, glass
        fo = arch_pts(u0 - 0.05, u1 + 0.05, spring, rise + 0.05, 14, sill - 0.05)
        fi = arch_pts(u0, u1, spring, rise, 14, sill)
        extrude(c, frame_mat, fo, [fi], depth=0.075, w0=-wall * 0.5 - 0.02)
        g = arch_pts(u0 + 0.005, u1 - 0.005, spring, rise - 0.005, 14, sill + 0.005)
        extrude(c, glass_mat, g, (), depth=0.006, w0=-wall * 0.5 + 0.02, caps=True)
        # transom bar under the fanlight + vertical bars + horizontal glazing bars
        box(c, frame_mat, (u0, spring - 0.03, -wall * 0.5 - 0.02), (u1, spring + 0.03, -wall * 0.5 + 0.055), r=0.003)
        muntin_grid(c, frame_mat, u0, u1, sill, spring, 3, 4, -wall * 0.5 + 0.005, 0.024, 0.045)
        for k in range(1, 5):                       # radial bars of the fanlight
            a = math.pi * k / 5
            cx, cz = (u0 + u1) / 2, spring
            with c.at((cx, cz, -wall * 0.5 + 0.005), rz=a / D2R - 90):
                box(c, frame_mat, (-0.011, 0, 0), (0.011, rise, 0.045), r=0.002)
        with c.at((0, 0, -wall * 0.5 + 0.005)):
            pts = [((u0 + u1) / 2 + rise * 0.55 * math.cos(math.pi * i / 10), spring + rise * 0.55 * math.sin(math.pi * i / 10)) for i in range(11)]
            for i in range(10):
                p, q = pts[i], pts[i + 1]
                tube(c, frame_mat, (p[0], p[1], 0.0), (q[0], q[1], 0.0), 0.011, 4)
                # (thin arc muntin built from short rods)
        # sash catch (brass)
        with c.at(((u0 + u1) / 2, sill + 1.25, -wall * 0.5 + 0.055)):
            box(c, "brass", (-0.03, -0.006, 0), (0.03, 0.006, 0.012), r=0.002)
            with c.at((0.0, 0.0, 0.012)):
                cyl(c, "brass", 0.0045, 0.008, 8)
        if inner_trim:
            # inner architrave (room side) + moulded outer ring
            arch_ring(c, frame_mat, u0, u1, spring, rise, sill, 0.12, 0.028, -0.005)
            arch_ring(c, frame_mat, u0, u1, spring, rise, sill, 0.075, 0.02, 0.020)
            # stone sill with drip edge, projecting into the room (apron below)
            box(c, "sandstone", (u0 - 0.10, sill - 0.06, -wall - 0.02), (u1 + 0.10, sill, 0.07), r=0.008)
            box(c, "sandstone", (u0 - 0.06, sill - 0.20, -0.005), (u1 + 0.06, sill - 0.06, 0.03), r=0.006)
            # keystone
            with c.at(((u0 + u1) / 2, spring + rise + 0.10, 0.0)):
                extrude(c, "sandstone", [(-0.07, -0.05), (0.07, -0.05), (0.09, 0.09), (-0.09, 0.09)], (), depth=0.03, w0=0.0)
        else:
            # a flight crosses this window: stone sill only inside the reveal (flush with the wall face), no room-side trim
            box(c, "sandstone", (u0, sill - 0.04, -wall + 0.02), (u1, sill, -0.004), r=0.006)
    if dirt:      # rain-streak grime below the sill on the inside (dust) is subtle; put a decal on the wall face
        with c.at(m=M_YZ(wall_plane_x)):
            pass
    if curtain and M is None:
        with c.at((wall_plane_x + 0.10, yc, 0)):
            for s in (-1, 1):
                curtain_panel(c, s, 0.40, 3.3, spring + 0.9, edge=w / 2 + 0.26, tie_z=1.5)
            tube(c, "brass", (0, -w / 2 - 0.18, spring + 1.05), (0, w / 2 + 0.18, spring + 1.05), 0.012, 8)
            for s in (-1, 1):
                with c.at((0, s * (w / 2 + 0.18), spring + 1.05)):
                    sphere(c, "brass", 0.028, 8, 6)


def curtain_panel(c, side, wd, ht, top, folds=9, tie_z=1.4, edge=0.75):
    """Pleated curtain hanging from a rod at height `top`: anchored at y=side*edge, inner edge pulled outward at the
    tie-back height tie_z, flaring below.  Local x = out of the wall, y along the wall, z up."""
    cols, rows = folds * 2, 14
    grid = []
    for r_ in range(rows + 1):
        z = top - (top - 0.03) * r_ / rows
        pinch = clamp((0.55 - abs(z - tie_z)) / 0.55, 0, 1) ** 0.8
        sc = 1.0 - 0.72 * pinch
        row = []
        for k in range(cols + 1):
            t = k / cols
            y = side * (edge - wd * (1 - t) * sc)
            row.append((0.03 + 0.045 * math.sin(k * math.pi) * (1 - 0.4 * pinch) + 0.02 * pinch, y, z))
        grid.append(row)
    for r_ in range(rows):
        for k in range(cols):
            a, b, cc, d = grid[r_][k], grid[r_][k + 1], grid[r_ + 1][k + 1], grid[r_ + 1][k]
            c.face([a, b, cc, d], "curtain", smooth=True)
    # tie-back cord (brass ring + cord)
    with c.at((0.05, side * (edge - wd * 0.2), tie_z), rx=90):
        lathe(c, "brass", [(0.02, 0), (0.024, 0.004), (0.024, 0.01), (0.02, 0.014)], 12, True)


def clamp01(x):
    return max(0.0, min(1.0, x))


def floor_slabs(c, W, L, x0=0.0, y0=0.0, s=0.6, lane_x=None, lane_w=1.2, z=0.0, path_y=None, slab_mat="stone_floor",
                worn_mat="stone_floor_worn", seed=3, sun=None):
    """Polished slab floor built from s-metre tiles; dust/traffic lane down the axis in a duller material."""
    rr = random.Random(seed)
    nx, ny = int(round(W / s)), int(round(L / s))
    for i in range(nx):
        for j in range(ny):
            xa, ya = x0 + i * W / nx, y0 + j * L / ny
            xb, yb = xa + W / nx, ya + L / ny
            cx, cy = (xa + xb) / 2, (ya + yb) / 2
            worn = lane_x is not None and abs(cx - lane_x) < lane_w / 2 and rr.random() < 0.85
            if path_y is not None and abs(cy - path_y[0]) < path_y[1] / 2:
                worn = True
            t = rr.uniform(0.94, 1.03) * (0.90 if worn else 1.0)
            c.face([(xa, ya, z), (xb, ya, z), (xb, yb, z), (xa, yb, z)], worn_mat if worn else slab_mat, vc=(t, t * 0.99, t * 0.97))


defmat("stone_floor_worn", (206, 194, 174), 0.34, 0, "marble", 1.2, dcol=(226, 154, 138))
defmat("sun_pool", (255, 244, 200), 1.0, 0, "sunpool", 1, alpha=0.5)


def panel(c, mat, u0, u1, v0, v1, w=0.0, flip=False, uv=None):
    """Textured quad in the current local (u,v,w) frame, uv 0..1 unless given."""
    c.face([(u0, v0, w), (u1, v0, w), (u1, v1, w), (u0, v1, w)], mat, uv=uv or [(0, 0), (1, 0), (1, 1), (0, 1)], flip=flip)


def field(c, M, sgn, u0, u1, v0, v1, paper="wallpaper", frame="paint_cream", fw=0.055):
    """Wall panel field: wallpaper inset + 4-piece moulding frame + inner bead.  M = M_YZ(x)/M_XZ(y) of the wall face,
    sgn = +1 if the room is on the +w side of the wall, -1 otherwise."""
    with c.at(m=M):
        panel(c, paper, u0, u1, v0, v1, w=sgn * 0.004, flip=(sgn < 0), uv=[(u0 / 0.6, v0 / 0.6), (u1 / 0.6, v0 / 0.6), (u1 / 0.6, v1 / 0.6), (u0 / 0.6, v1 / 0.6)])
        a, b = (0.004, 0.028) if sgn > 0 else (-0.028, -0.004)
        box(c, frame, (u0, v0, a), (u1, v0 + fw, b), r=0.004)
        box(c, frame, (u0, v1 - fw, a), (u1, v1, b), r=0.004)
        box(c, frame, (u0, v0 + fw, a), (u0 + fw, v1 - fw, b), r=0.004)
        box(c, frame, (u1 - fw, v0 + fw, a), (u1, v1 - fw, b), r=0.004)
        a2, b2 = (0.004, 0.014) if sgn > 0 else (-0.014, -0.004)
        for (p, q, r_, s_) in ((u0 + fw, v0 + fw, u1 - fw, v0 + fw + 0.014), (u0 + fw, v1 - fw - 0.014, u1 - fw, v1 - fw)):
            box(c, "brass_worn", (p, q, a2), (r_, s_, b2), r=0.0015)


def sconce(c, real_light=False, name="sconce", watt=14, arm=0.16):
    """Electric wall bracket lamp; wall = XZ plane facing +Y (like posters). Porcelain back-plate, brass S-arm, socket,
    milk-glass tulip shade, bulb."""
    with c.at(rx=-90):
        cyl(c, "porcelain", 0.055, 0.014, 16 if c.lod else 8, ch=0.003 if c.lod else 0.0)
        cyl(c, "brass", 0.02, 0.02, 12 if c.lod else 6, z0=0.014, ch=0.003 if c.lod else 0.0)
    tube(c, "brass", (0, 0.02, 0), (0, 0.02 + arm * 0.5, -0.02), 0.008, 8)
    tube(c, "brass", (0, 0.02 + arm * 0.5, -0.02), (0, 0.02 + arm, 0.05), 0.008, 8)
    with c.at((0, 0.02 + arm, 0.05)):
        lathe(c, "brass", [(0.014, -0.03), (0.02, -0.02), (0.02, 0.0), (0.03, 0.02)], 10 if c.lod else 6, True)
        with c.at((0, 0, 0.08)):
            sphere(c, "bulb", 0.026, 8 if c.lod else 6, 5 if c.lod else 3)
        with c.at((0, 0, 0.03)):
            lathe(c, "lamp_milk", [(0.03, 0), (0.05, 0.06), (0.075, 0.13), (0.08, 0.16), (0.07, 0.165), (0.05, 0.10), (0.03, 0.02)], 12 if c.lod else 8, True)
    if real_light:
        c.light("point", name, (0, 0.02 + arm, 0.13), color=(255, 205, 140), watt=watt, size=0.05)


defmat("grime", (255, 255, 255), 1.0, 0, "grime", 1.0, alpha=0.9)


# ======================================================================================================================
# ROOM 1 - TOWER TICKET HALL  (INTERFACE.md `ticket_hall`: world x -14.05..-10.50, y -8.60..8.60, z 0.15..4.60)
#   Cell frame: x 0..3.55 (west party wall -> passage wall), y 0..17.2 (south turret door -> north turret door), z 0..4.45
#   (cell = world + (14.05, 8.60, -0.15)).  Passage floor outside the east wall is at cell z = -0.15 (150 mm step).
#   Openings (INTERFACE): east wall doors S/N at y 4.0 / 13.2 (1.8 x 2.7 world -> z -0.15..2.55), ticket window y 8.6
#   (1.4 wide, sill 0.85, head 2.25); end doors to turret stairs x 1.75 (1.2 wide, head 2.45).
#   Story: the clerk stepped out mid-sale - the ticket roll hangs off the desk to the floor, the abacus still shows a
#   sum, an umbrella lies in a small puddle, the north door stands open and the sun walks across the floor.
#   A: everything inside is assumed (no interior source); the ticket window is the clerk side of a counter window that
#   opens onto the passage (INTERFACE: exterior has sill + frame, interior puts the brass grille and counter).
# ======================================================================================================================
HALL_W, HALL_H = 3.55, 4.45
MG = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))       # grille-local (x,y,z) -> unit-local (u=x, v=z, w=y)


def door_leaf(c, w=0.9, h=2.7, mat="teak"):
    """Glazed door leaf. Local: hinge at origin, leaf extends +x, thickness along y (0..0.055), z up.
    Stiles/rails with raised lower panels, 3x3 glazing bars over a glass upper half, brass finger plate, bar pull,
    kick plate and three hinge knuckles (detail-spec s6: separate parts, gaps, hardware)."""
    T = 0.055
    box(c, mat, (0, 0, 0), (0.10, T, h), r=0.004)
    box(c, mat, (w - 0.11, 0, 0), (w, T, h), r=0.004)
    box(c, mat, (0.10, 0, h - 0.12), (w - 0.11, T, h), r=0.004)
    box(c, mat, (0.10, 0, 1.05), (w - 0.11, T, 1.30), r=0.004)
    box(c, mat, (0.10, 0, 0), (w - 0.11, T, 0.28), r=0.004)
    bw = w - 0.21
    box(c, mat, (0.10, 0.012, 0.28), (w - 0.11, 0.043, 1.05), r=0.003, vc=(0.85, 0.85, 0.85))
    box(c, "oak", (0.16, 0.043, 0.36), (w - 0.17, 0.052, 0.97), r=0.006)
    z0, z1 = 1.30, h - 0.12
    box(c, "glass", (0.10, 0.026, z0), (w - 0.11, 0.030, z1), r=0)
    for i in range(1, 3):
        x = 0.10 + bw * i / 3
        box(c, mat, (x - 0.011, 0.012, z0), (x + 0.011, 0.043, z1), r=0.002)
    for j in range(1, 3):
        z = z0 + (z1 - z0) * j / 3
        box(c, mat, (0.10, 0.012, z - 0.011), (w - 0.11, 0.043, z + 0.011), r=0.002)
    box(c, "brass", (w - 0.09, T, 0.90), (w - 0.03, T + 0.004, 1.48), r=0.002)
    for zz in (0.96, 1.42):
        screw(c, w - 0.06, T + 0.004, zz, "y", 0.0035)
    tube(c, "brass", (w - 0.06, T + 0.05, 0.98), (w - 0.06, T + 0.05, 1.32), 0.011, 8)
    for zz in (0.98, 1.32):
        tube(c, "brass", (w - 0.06, T + 0.004, zz), (w - 0.06, T + 0.05, zz), 0.008, 6)
    box(c, "brass", (0.11, T, 0.02), (w - 0.12, T + 0.003, 0.24), r=0.0015)
    for zz in (0.25, 1.35, h - 0.35):
        with c.at((0.0, T / 2, zz)):
            cyl(c, "brass", 0.011, 0.11, 8, ch=0.002)


def ticket_window_unit(c, yc):
    """The hero: ticket window in the east (passage) wall, clerk side.  Local frame u = y (0 at the window axis), v = z,
    w = x (0 at the inner wall face, wall body w 0..0.45, hall side = -w).  Sash (upper fixed / lower raised 0.32 m),
    brass grille with rosettes and speaking oval, brass dip tray in a stone sill, bell push, sash lifts."""
    hw, sill, spring, rise = 0.70, 0.85, 2.05, 0.20
    with c.at(m=M_YZ(HALL_W) @ Matrix.Translation((yc, 0, 0))):
        arch_ring(c, "teak", -hw, hw, spring, rise, sill, 0.11, 0.032, -0.032, n=12)
        for s in (-1, 1):
            box(c, "teak", (s * hw + (0 if s > 0 else -0.11), sill, -0.032), (s * hw + (0.11 if s > 0 else 0), spring, 0.0), r=0.004)
        box(c, "sandstone", (-hw - 0.12, sill - 0.06, -0.18), (hw + 0.12, sill, 0.45), r=0.008)
        box(c, "sandstone", (-hw - 0.08, sill - 0.16, -0.05), (hw + 0.08, sill - 0.06, 0.0), r=0.006)
        outer = arch_pts(-hw, hw, spring, rise, 10, sill)
        inner = arch_pts(-hw + 0.06, hw - 0.06, spring - 0.005, rise - 0.055, 10, sill + 0.06)
        extrude(c, "paint_cream", outer, [inner], depth=0.06, w0=0.16)
        gl = arch_pts(-hw + 0.06, hw - 0.06, spring - 0.005, rise - 0.055, 10, 1.57)
        extrude(c, "glass", gl, (), depth=0.005, w0=0.19)
        for i in (-1, 0, 1):
            box(c, "paint_cream", (i * 0.42 - 0.011, 1.57, 0.175), (i * 0.42 + 0.011, spring + 0.14 - abs(i) * 0.07, 0.205), r=0.002)
        box(c, "paint_cream", (-hw + 0.06, 1.55, 0.165), (hw - 0.06, 1.59, 0.215), r=0.003)
        z_lo = sill + 0.06 + 0.32
        for (u0, u1, v0, v1) in ((-hw + 0.06, hw - 0.06, z_lo, z_lo + 0.05), (-hw + 0.06, hw - 0.06, 1.51, 1.55),
                                 (-hw + 0.06, -hw + 0.11, z_lo, 1.55), (hw - 0.11, hw - 0.06, z_lo, 1.55)):
            box(c, "paint_cream", (u0, v0, 0.10), (u1, v1, 0.155), r=0.003)
        box(c, "glass", (-hw + 0.11, z_lo + 0.05, 0.128), (hw - 0.11, 1.51, 0.132), r=0)
        for s in (-1, 1):
            box(c, "brass", (s * 0.30 - 0.02, z_lo + 0.005, 0.04), (s * 0.30 + 0.02, z_lo + 0.014, 0.10), r=0.001)
        # roller blind on the hall side, half lowered (the middle layer of the three-layer window), pull cord + acorn
        tube(c, "iron", (-hw + 0.07, 2.02, -0.075), (hw - 0.07, 2.02, -0.075), 0.019, 10)
        panel(c, "curtain", -hw + 0.08, hw - 0.08, 1.80, 2.02, w=-0.075)
        box(c, "teak", (-hw + 0.08, 1.78, -0.085), (hw - 0.08, 1.815, -0.065), r=0.004)
        tube(c, "paper_ticket", (0.25, 1.78, -0.08), (0.25, 1.50, -0.08), 0.002, 4)
        with c.at((0.25, 1.49, -0.08)):
            sphere(c, "teak", 0.011, 8, 5)
        # brass grille across the aperture, on the customer side of the reveal (w ~ 0.30)
        with c.at(m=Matrix(((1, 0, 0, 0), (0, 0, 1, sill + 0.09), (0, 1, 0, 0.30), (0, 0, 0, 1)))):
            brass_grille(c, 2 * hw - 0.20, 1.12, 17)
        with c.at((0, spring - 0.02, 0.30)):
            for k in range(1, 8):
                a = math.pi * k / 8
                tube(c, "brass", (0, 0, 0), (-math.cos(a) * (hw - 0.10), math.sin(a) * (rise + 0.12), 0), 0.0035, 6)
        with c.at(m=Matrix(((1, 0, 0, 0), (0, 0, 1, sill), (0, 1, 0, -0.09), (0, 0, 0, 1)))):
            coin_tray(c, 0.34, 0.16)
        with c.at((-hw - 0.17, 1.28, -0.032), rx=0):
            bell_push_local(c)


def bell_push_local(c):
    """Bell push standing proud of a wall whose face is the local (u,v) plane, normal -w (hall side)."""
    with c.at(m=Matrix(((1, 0, 0, 0), (0, 1, 0, 0), (0, 0, -1, 0), (0, 0, 0, 1)))):
        bell_push(c)


def pigeonholes(c, w=1.25, h=1.75, cols=10, rows=7):
    """Ticket cabinet: frame, back panel, dividers, cubbies with ticket stacks. Local: x along wall, y depth, z up."""
    D = 0.22
    box(c, "teak", (-w / 2, 0, 0), (w / 2, D, 0.05), r=0.004)
    box(c, "teak", (-w / 2, 0, h - 0.05), (w / 2, D, h), r=0.004)
    box(c, "teak", (-w / 2, 0, 0.05), (-w / 2 + 0.03, D, h - 0.05), r=0.003)
    box(c, "teak", (w / 2 - 0.03, 0, 0.05), (w / 2, D, h - 0.05), r=0.003)
    box(c, "paint_dark", (-w / 2 + 0.03, 0, 0.05), (w / 2 - 0.03, 0.012, h - 0.05), r=0)
    iw, ih = (w - 0.06) / cols, (h - 0.10) / rows
    for i in range(1, cols):
        box(c, "oak", (-w / 2 + 0.03 + i * iw - 0.004, 0.012, 0.05), (-w / 2 + 0.03 + i * iw + 0.004, D - 0.01, h - 0.05), r=0.001)
    for j in range(1, rows):
        box(c, "oak", (-w / 2 + 0.03, 0.012, 0.05 + j * ih - 0.004), (w / 2 - 0.03, D - 0.01, 0.05 + j * ih + 0.004), r=0.001)
    rr = random.Random(5)
    for i in range(cols):
        for j in range(rows):
            if rr.random() < 0.72:
                with c.at((-w / 2 + 0.03 + (i + 0.5) * iw, 0.09, 0.05 + j * ih + 0.004)):
                    box(c, "paper_ticket", (-iw * 0.36, -0.05, 0), (iw * 0.36, 0.05, rr.uniform(0.01, ih * 0.75)), r=0.0008)
    for i in range(cols):
        box(c, "brass", (-w / 2 + 0.03 + (i + 0.5) * iw - 0.012, D - 0.01, h - 0.085), (-w / 2 + 0.03 + (i + 0.5) * iw + 0.012, D + 0.002, h - 0.06), r=0.0008)


def stool(c, h=0.62):
    """Clerk's high stool: round seat, 3 splayed legs, brass foot ring."""
    with c.at((0, 0, h)):
        lathe(c, "oak", [(0, 0), (0.17, 0), (0.18, 0.012), (0.18, 0.03), (0.16, 0.04), (0, 0.04)], 20, True)
    for k in range(3):
        a = k * 120 + 20
        ca, sa = math.cos(a * D2R), math.sin(a * D2R)
        tube(c, "oak", (0.16 * ca, 0.16 * sa, h), (0.23 * ca, 0.23 * sa, 0.0), 0.017, 8)
    for i in range(12):
        a0, a1 = i * 30, (i + 1) * 30
        tube(c, "brass_worn", (0.205 * math.cos(a0 * D2R), 0.205 * math.sin(a0 * D2R), 0.24),
             (0.205 * math.cos(a1 * D2R), 0.205 * math.sin(a1 * D2R), 0.24), 0.006, 4)


def clerk_desk(c, tag="a"):
    """Desk under the ticket window (local x along wall, y out from the wall, z up; length 3.0).  Drawers with brass pulls,
    ledger, ink, rack, punch, abacus, coin trays, desk lamp, ticket roll running over the front edge to the floor."""
    zt = 0.78
    box(c, "teak", (-1.5, 0.02, 0), (1.5, 0.72, 0.10), r=0.004, vc=(0.7, 0.7, 0.7))
    for s in (-1, 1):
        x0, x1 = (-1.5, -0.55) if s < 0 else (0.55, 1.5)
        box(c, "teak", (x0, 0.02, 0.10), (x1, 0.70, zt - 0.03), r=0.004)
        for k in range(4):
            z0 = 0.13 + k * 0.155
            box(c, "oak", (x0 + 0.03, 0.70, z0), (x1 - 0.03, 0.716, z0 + 0.145), r=0.004)
            with c.at(((x0 + x1) / 2, 0.716, z0 + 0.0725)):
                tube(c, "brass", (-0.05, 0, 0.0), (0.05, 0, 0.0), 0.006, 8)
                for sx in (-0.05, 0.05):
                    tube(c, "brass", (sx, 0, 0), (sx, 0.02, 0), 0.004, 6)
                box(c, "brass", (-0.02, 0.0, -0.05), (0.02, 0.003, -0.032), r=0.0008)
    box(c, "teak", (-0.55, 0.60, 0.10), (0.55, 0.70, zt - 0.03), r=0.004)
    box(c, "teak", (-1.53, 0.0, zt - 0.03), (1.53, 0.76, zt + 0.02), r=0.005)
    box(c, "leather", (-1.2, 0.12, zt + 0.02), (1.2, 0.62, zt + 0.026), r=0.002)
    with c.at((0.0, 0.34, zt + 0.026), rz=-14):
        abacus(c)
    with c.at((0.52, 0.50, zt + 0.026), rz=32):
        punch(c)
    with c.at((-0.8, 0.30, zt + 0.026), rz=6):
        box(c, "oak", (-0.2, -0.06, 0.0), (0.2, 0.06, 0.012), r=0.002)
        box(c, "oak", (-0.2, -0.06, 0.0), (0.2, -0.05, 0.08), r=0.002)
        box(c, "oak", (-0.2, 0.05, 0.0), (0.2, 0.06, 0.11), r=0.002)
        for k in range(-3, 4):
            box(c, "oak", (k * 0.05 - 0.002, -0.06, 0.0), (k * 0.05 + 0.002, 0.06, 0.07), r=0.001)
            with c.at((k * 0.05 + 0.025, 0.0, 0.012)):
                ticket_stack(c, RNG.randint(5, 16))
    for (px, py) in ((0.9, 0.5), (-1.2, 0.5)):
        with c.at((px, py, zt + 0.026), rz=RNG.uniform(-20, 20)):
            coin_cluster(c, 9, 0.05)
    with c.at((1.15, 0.30, zt + 0.026), rz=-6):
        box(c, "leather", (-0.22, -0.16, 0.0), (0.22, 0.16, 0.01), r=0.002)
        for s in (-1, 1):
            box(c, "paper_ticket", (0.0 if s > 0 else -0.205, -0.15, 0.01), (0.205 if s > 0 else 0.0, 0.15, 0.017), r=0.0005)
        for k in range(9):
            box(c, "paint_dark", (-0.19, -0.13 + k * 0.03, 0.0172), (-0.02, -0.128 + k * 0.03, 0.0174), r=0)
            box(c, "paint_dark", (0.02, -0.13 + k * 0.03, 0.0172), (0.19, -0.128 + k * 0.03, 0.0174), r=0)
        with c.at((0.30, 0.10, 0.0)):
            lathe(c, "glass_smoke", [(0, 0), (0.03, 0), (0.034, 0.02), (0.026, 0.045), (0.016, 0.05), (0.016, 0.055), (0.024, 0.056)], 14, True)
        tube(c, "teak", (-0.12, -0.20, 0.006), (0.10, -0.19, 0.012), 0.004, 6)
    with c.at((-1.25, 0.16, zt + 0.026)):
        lathe(c, "brass", [(0, 0), (0.06, 0), (0.06, 0.012), (0.014, 0.03), (0.014, 0.30)], 14, True)
        tube(c, "brass", (0, 0, 0.30), (0.10, 0.06, 0.40), 0.008, 8)
        with c.at((0.10, 0.06, 0.40)):
            lathe(c, "lamp_milk", [(0.02, 0.0), (0.05, -0.02), (0.09, -0.08), (0.10, -0.10), (0.09, -0.10), (0.02, -0.03)], 14, True)
            with c.at((0, 0, -0.05)):
                sphere(c, "bulb", 0.025, 8, 5)
        c.light("point", "desklamp_" + tag, (0.10, 0.06, 0.33), color=(255, 196, 120), watt=14, size=0.05)
    with c.at((-0.25, 0.63, zt + 0.026)):                                    # implied event: ticket roll hanging to the floor
        box(c, "oak", (-0.05, -0.03, 0), (0.05, 0.03, 0.02), r=0.003)
        for s in (-0.045, 0.045):
            box(c, "oak", (s - 0.005, -0.02, 0.02), (s + 0.005, 0.02, 0.10), r=0.002)
        with c.at((0, 0, 0.09), ry=90):
            cyl(c, "paper_ticket", 0.045, 0.075, 20, z0=-0.0375)
        tube(c, "steel", (-0.06, 0, 0.09), (0.06, 0, 0.09), 0.004, 6)
        pts = []
        for t in [i / 26 for i in range(27)]:
            if t < 0.22:
                q = t / 0.22
                p = (0.0, 0.045 + 0.06 * q, 0.09 - 0.05 * q)
            elif t < 0.30:
                q = (t - 0.22) / 0.08
                p = (0.0, 0.105 + 0.02 * q, 0.04 - 0.04 * q)
            else:
                q = (t - 0.30) / 0.70
                p = (0.03 * math.sin(q * 6), 0.125 + 0.02 * q + 0.42 * q * q, -(zt + 0.026) * min(1, q * 1.12))
            pts.append(p)
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            hwd = 0.024
            c.face([(a[0] - hwd, a[1], a[2]), (a[0] + hwd, a[1], a[2]), (b[0] + hwd, b[1], b[2]), (b[0] - hwd, b[1], b[2])], "paper_ticket", vc=(R(0.93, 1.05),) * 3)


def build_hall(dream=False):
    c = Cell("hall_dream" if dream else "hall", dream)
    W, H = HALL_W, HALL_H
    L = 34.4 if dream else 17.2                       # dream: an impossibly long hall (x2)
    c.lod = 0 if dream else 1
    NB = 14 if dream else 7                            # wall bays
    BAY = L / NB
    c.env = dict(exposure=1.0 if not dream else 1.5, sun_elev=24, sun_rot=250, sky=0.35, glare_thr=0.9)
    sun_dir = Vector((-0.80, 0.50, -0.40)).normalized()
    ylook = 14.0 if not dream else 13.0
    c.light("sun", "sun", Vector((W / 2, ylook, 0.6)) - sun_dir * 40, color=(255, 230, 190) if not dream else (255, 210, 185),
            watt=38.0, size=0.9, target=(W / 2, ylook, 0.6))
    c.light("area", "passage_skyfill", (W + 3.0, 8.6, 2.0), color=(200, 216, 240), watt=260, size=(3.0, 12.0), target=(0, 8.6, 1.4), ref=True)
    c.light("area", "hall_skyfill", (W / 2, L / 2, H - 0.5), color=(200, 214, 236), watt=8, size=(2.0, 6.0), target=(W / 2, L / 2, 0), ref=True)

    # ---------------- shell ----------------
    tw = 0.45
    dS, dN = 4.0, 13.2
    if dream:
        dS, dN = 6.0, L - 4.0
    yw = L / 2
    east_holes = [rect_pts(dS - 0.9, -0.15, dS + 0.9, 2.45), rect_pts(dN - 0.9, -0.15, dN + 0.9, 2.45),
                  arch_pts(yw - 0.7, yw + 0.7, 2.05, 0.20, 10, 0.85)]
    with c.grp("shell_finish"):                                             # exported: floor finish + ceiling skin (inside the clear box)
        floor_slabs(c, W, L, z=0.003, s=0.59, lane_x=W * 0.62, lane_w=1.6, path_y=None)
        c.face([(0, 0, H - 0.003), (0, L, H - 0.003), (W, L, H - 0.003), (W, 0, H - 0.003)], "plaster_ceil")
    with c.grp("ref_shell"):                                                # walls/slabs are drawn by the exterior (INTERFACE); render-only here
        wallYZ(c, "plaster", -0.45, L + 0.45, -0.3, H + 0.3, W, W + tw, holes=east_holes)
        wallYZ(c, "plaster", -0.45, L + 0.45, -0.3, H + 0.3, -tw, 0.0)
        for yy, y1 in ((-tw, 0.0), (L, L + tw)):
            wallXZ(c, "plaster", -tw, W + tw, -0.3, H + 0.3, yy, y1, holes=[rect_pts(1.175, 0.0, 2.375, 2.45)])
        box(c, "plaster_ceil", (-tw, -tw, H), (W + tw, L + tw, H + 0.3), r=0)
        box(c, "plaster_dk", (-tw, -tw, -0.3), (W + tw, L + tw, -0.01), r=0)
        for d in (dS, dN):
            box(c, "sandstone", (W - 0.30, d - 0.9, -0.15), (W + tw + 0.20, d + 0.9, 0.0), r=0.008)
    c.col.append([(0, 0, 0), (W, 0, 0), (W, L, 0), (0, L, 0)])
    with c.grp("ref_outside"):
        box(c, "sandstone", (W + tw, -30, -1.0), (W + tw + 20.1, L + 30, -0.15), r=0)
        box(c, "sandstone", (W + tw + 20.1, -30, -1.0), (W + tw + 20.6, L + 30, 9.0), r=0)
        with c.at(m=M_YZ(W + tw)):
            extrude(c, "sandstone", rect_pts(-0.45, -0.15, L + 0.45, 2.9), [rect_pts(dS - 0.9, -0.15, dS + 0.9, 2.45), rect_pts(dN - 0.9, -0.15, dN + 0.9, 2.45),
                    arch_pts(yw - 0.7, yw + 0.7, 2.05, 0.20, 10, 0.85)], depth=0.02)
            extrude(c, "sandstone", rect_pts(-0.45, 2.9, L + 0.45, 9.0), (), depth=0.02)

    # ---------------- doors, window ----------------
    with c.grp("windows_doors"):
        ticket_window_unit(c, yw)
        with c.at((1.175, 0.0, 0.0), rz=-70):                                # internal hall-to-shaft doors stay with the interior (INTERFACE v1.1)
            door_leaf(c, 1.2, 2.45)
        with c.at((1.175, L, 0.0), rz=0):
            door_leaf(c, 1.2, 2.45)
    with c.grp("ref_doors"):                                                   # exterior-owned leaves, shown in renders only
        for s, base in ((1, dS - 0.9), (-1, dS + 0.9)):
            with c.at((W + 0.16, base, -0.15), rz=90 if s > 0 else -90):
                door_leaf(c, 0.9, 2.6)
        for s, base in ((1, dN - 0.9), (-1, dN + 0.9)):                       # north pair ajar 0.35 rad (as the exterior)
            with c.at((W + 0.02, base, -0.15), rz=(90 + 20) if s > 0 else (-90 - 20)):
                door_leaf(c, 0.9, 2.6)

    # ---------------- wall dressing ----------------
    with c.grp("walls"):
        for (ya, yb) in ((0.0, dS - 0.9), (dS + 0.9, yw - 0.7), (yw + 0.7, dN - 0.9), (dN + 0.9, L)):
            box(c, "sandstone", (W - 0.09, ya, 0.0), (W, yb, 1.15), r=0.006)
            box(c, "sandstone", (W - 0.12, ya, 1.15), (W, yb, 1.21), r=0.006)
        box(c, "sandstone", (0.0, 0.0, 0.0), (0.09, L, 1.15), r=0.006)
        box(c, "sandstone", (0.0, 0.0, 1.15), (0.12, L, 1.21), r=0.006)
        for (yy, sgn) in ((0.0, 1), (L, -1)):
            for (xa, xb) in ((0.0, 1.175), (2.375, W)):
                box(c, "sandstone", (xa, yy if sgn > 0 else yy - 0.09, 0.0), (xb, yy + 0.09 if sgn > 0 else yy, 1.15), r=0.006)
        for yy, sgn in ((0.0, 1), (L, -1)):                                   # stone lintel + blank brass "stairs" plaque
            with c.at((1.775, yy, 0.0), rz=0 if sgn > 0 else 180):
                box(c, "sandstone", (-0.72, 0.0, 2.45), (0.72, 0.09, 2.60), r=0.008)
                box(c, "brass", (-0.32, 0.0, 2.66), (0.32, 0.012, 2.94), r=0.002)
                box(c, "paint_dark", (-0.02, 0.0125, 2.72), (0.02, 0.0135, 2.90), r=0)
                for s_ in (-1, 1):
                    with c.at((0, 0.0125, 2.90), ry=0, rz=0):
                        with c.at(m=Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))):
                            pass
        for k in range(NB + 1):
            yp = k * BAY
            for (px, sgn) in ((0.0, 1), (W, -1)):
                if px == W:
                    if any(abs(yp - d) < 1.15 for d in (dS, dN, yw)) or yp < 0.1 or yp > L - 0.1:
                        continue
                x_in = px + sgn * 0.14
                zb = 1.21
                box(c, "plaster_dk", (min(px, x_in), yp - 0.16, zb), (max(px, x_in), yp + 0.16, H - 0.42), r=0.005, vc=(0.96, 0.96, 0.96))
                box(c, "sandstone", (min(px, x_in + sgn * 0.03), yp - 0.20, H - 0.42), (max(px, x_in + sgn * 0.03), yp + 0.20, H - 0.30), r=0.008)
                box(c, "sandstone", (min(px, x_in + sgn * 0.03), yp - 0.20, zb - 0.06), (max(px, x_in + sgn * 0.03), yp + 0.20, zb), r=0.008)
        for (b, z0, z1) in ((0.10, H - 0.30, H - 0.22), (0.18, H - 0.22, H - 0.12), (0.28, H - 0.12, H)):
            box(c, "plaster_ceil", (0, 0, z0), (b, L, z1), r=0.004)
            box(c, "plaster_ceil", (W - b, 0, z0), (W, L, z1), r=0.004)
            box(c, "plaster_ceil", (0, 0, z0), (W, b, z1), r=0.004)
            box(c, "plaster_ceil", (0, L - b, z0), (W, L, z1), r=0.004)
        for k in range(NB):
            if dream and k % 2 and k != NB - 1:
                continue
            ya, yb = k * BAY + 0.30, (k + 1) * BAY - 0.30
            field(c, M_YZ(0.0), 1, ya, yb, 1.34, H - 0.60, fw=0.05)
        for (ya, yb) in ((dS + 1.15, yw - 0.95), (yw + 0.95, dN - 1.15)):
            if yb - ya > 0.4:
                field(c, M_YZ(W), -1, ya, yb, 1.34, H - 0.60, fw=0.05)
        for yy, sgn in ((0.0, 1), (L, -1)):
            for (xa, xb) in ((0.25, 1.0), (2.5, W - 0.25)):
                field(c, M_XZ(yy), sgn, xa, xb, 1.34, H - 0.60, fw=0.04)
        for k in range(NB):
            if dream and k % 2:
                continue
            yc_ = (k + 0.5) * BAY
            with c.at((0.03, yc_, 0), rz=90):
                if k == NB // 2:
                    with c.at((0, 0, 1.55)):
                        wall_clock(c, tag="w")
                elif k % 3 == 0:
                    with c.at((0, 0, 1.55)):
                        poster(c, 0.80, 1.20, k % 8)
                elif k % 3 == 1:
                    with c.at((0, 0, 2.05)):
                        box(c, "brass", (-0.72, 0, 0), (0.72, 0.03, 0.74), r=0.004)
                        with c.at((0, 0.0305, 0.37), rx=90):
                            c.face([(-0.68, -0.33, 0), (0.68, -0.33, 0), (0.68, 0.33, 0), (-0.68, 0.33, 0)], "fareboard",
                                   uv=[(0, 0), (1, 0), (1, 1), (0, 1)], flip=True)
                        for sx in (-0.68, 0.68):
                            screw(c, sx, 0.03, 0.03, "y", 0.004)
                            screw(c, sx, 0.03, 0.71, "y", 0.004)
                else:
                    with c.at((0, 0, 1.75)):
                        box(c, "teak", (-0.45, 0, 0), (0.45, 0.03, 0.75), r=0.004)
                        box(c, "leather", (-0.41, 0.03, 0.04), (0.41, 0.045, 0.71), r=0.002)
                        for kk in range(11):
                            px, pz = RNG.uniform(-0.34, 0.34), RNG.uniform(0.1, 0.60)
                            with c.at((px, 0.045, pz), rx=90, rz=RNG.uniform(-12, 12)):
                                decal(c, "paper_ticket", RNG.uniform(0.07, 0.14), RNG.uniform(0.09, 0.15))
                            with c.at((px, 0.05, pz + 0.04)):
                                sphere(c, "brass", 0.005, 6, 4)
        for k in range(1, NB):
            yp = k * BAY
            with c.at((0.14 + 0.03, yp, 2.6), rz=90):
                sconce(c, real_light=(k % 2 == 1), name="sconceW%d" % k)
            if any(abs(yp - d) < 1.15 for d in (dS, dN, yw)):
                continue
            with c.at((W - 0.14 - 0.03, yp, 2.6), rz=-90):
                sconce(c, real_light=(k % 2 == 0), name="sconceE%d" % k)
        with c.at((W, dN + 1.35, 1.35), ry=-90):
            switch_plate(c)
        with c.at((W, dN + 1.55, 1.35), ry=-90):
            bell_push(c)
        porcelain_cleat_run(c, (0.42, 0.2, H - 0.36), (0.42, L - 0.2, H - 0.36))
        porcelain_cleat_run(c, (W - 0.42, 0.2, H - 0.36), (W - 0.42, L - 0.2, H - 0.36))
        with c.at(m=M_YZ(W)):
            panel(c, "grime", 0.0, L, H - 1.0, H, w=-0.0025, flip=True)
        with c.at(m=M_YZ(0.0)):
            panel(c, "grime", 0.0, L, H - 1.0, H, w=0.0025)
            panel(c, "dirt", 0.0, L, 0.0, 1.1, w=0.0025)
    with c.grp("var_crank_telephone"):
        with c.at((0.03, yw + 2.6, 1.6), rz=90):
            box(c, "teak", (-0.10, 0, 0), (0.10, 0.09, 0.38), r=0.006)
            for sx in (-0.045, 0.045):
                with c.at((sx, 0.09, 0.30), rx=-90):
                    lathe(c, "brass", [(0.0, 0), (0.038, 0), (0.038, 0.006), (0.03, 0.02), (0, 0.024)], 14, True)
            with c.at((0.135, 0.06, 0.20)):
                tube(c, "iron", (-0.03, 0, 0), (0.03, 0, 0), 0.005, 6)
                tube(c, "iron", (0.03, 0, 0), (0.03, 0.05, -0.02), 0.005, 6)
                with c.at((0.03, 0.05, -0.02)):
                    sphere(c, "teak", 0.011, 8, 5)
            tube(c, "iron", (0, 0.08, 0.14), (0, 0.16, 0.16), 0.006, 6)
            with c.at((0, 0.16, 0.16), rx=90):
                lathe(c, "brass", [(0.004, 0), (0.028, 0.005), (0.03, 0.02), (0.0, 0.02)], 12, True)
            with c.at((-0.13, 0.05, 0.14)):
                lathe(c, "paint_dark", [(0, -0.07), (0.022, -0.065), (0.02, -0.0), (0.02, 0.07), (0, 0.075)], 10, True)

    # ---------------- ceiling ----------------
    with c.grp("ceiling"):
        nb = int(L / 1.72)
        by = [(i + 1) * L / (nb + 1) for i in range(nb)]
        for y in by:
            box(c, "teak", (0.28, y - 0.13, H - 0.30), (W - 0.28, y + 0.13, H), r=0.006)
            box(c, "brass_worn", (0.28, y - 0.135, H - 0.29), (W - 0.28, y - 0.13, H - 0.03), r=0)
        box(c, "teak", (W / 2 - 0.12, 0.28, H - 0.22), (W / 2 + 0.12, L - 0.28, H), r=0.006)
        ys_ = [0.0] + by + [L]
        for i in range(0, nb + 1, 2):
            y = (ys_[i] + ys_[i + 1]) / 2
            for xx in (W * 0.25, W * 0.75):
                with c.at((xx, y, H - 0.01)):
                    lathe(c, "brass", [(0.17, 0.0), (0.17, -0.02), (0.15, -0.025), (0.0, -0.03)], 20, True)
                    for k in range(-3, 4):
                        if abs(k * 0.04) < 0.15:
                            box(c, "brass", (k * 0.04 - 0.005, -0.15, -0.038), (k * 0.04 + 0.005, 0.15, -0.03), r=0.001)
    with c.grp("var_pressed_ceiling"):
        for i in range(nb + 1):
            ya = ys_[i] + (0.13 if i > 0 else 0.28)
            yb = ys_[i + 1] - (0.13 if i < nb else 0.28)
            for (xa, xb) in ((0.28, W / 2 - 0.12), (W / 2 + 0.12, W - 0.28)):
                if yb - ya < 0.5:
                    continue
                cx, cy = (xa + xb) / 2, (ya + yb) / 2
                box(c, "plaster_ceil", (xa + 0.06, ya + 0.06, H - 0.02), (xb - 0.06, yb - 0.06, H), r=0.003)
                with c.at((cx, cy, H - 0.02)):
                    lathe(c, "plaster_ceil", [(0.22, 0.0), (0.22, -0.012), (0.15, -0.024), (0.07, -0.03), (0, -0.032)], 18, True)

    # ---------------- pendants: over-abundance, receding to the far door ----------------
    with c.grp("pendants"):
        n_p = int(L / (1.15 if not dream else 1.6))
        for i in range(n_p):
            y = 0.7 + i * (L - 1.4) / (n_p - 1)
            for (xx, dr) in ((W * 0.22, 0.75), (W * 0.5, 1.45), (W * 0.78, 0.75)):
                rl = (xx == W * 0.5 and i % 3 == 1)
                dr_ = dr + (0.14 if (i % 2) else 0.0)
                with c.at((xx, y, H)):
                    pendant(c, dr_, r=0.10, real_light=rl, name="pend%d_%d" % (i, int(xx * 10)), watt=28)

    # ---------------- benches along the west wall: a receding row ----------------
    with c.grp("benches"):
        nbn = int((L - 1.6) / 2.05)
        for i in range(nbn):
            y = 1.3 + i * 2.05
            with c.at((0.31, y + RNG.uniform(-0.02, 0.02), 0), rz=90 + RNG.uniform(-0.8, 0.8)):
                bench(c, 1.8, True)
            if i in (1, 4):
                with c.at((0.44, y + 0.2, 0.44), rz=RNG.uniform(-25, 25)):
                    box(c, "paper_ticket", (-0.16, -0.11, 0.0), (0.16, 0.11, 0.012), r=0.002)
                    box(c, "paper_ticket", (-0.15, -0.10, 0.012), (0.17, 0.12, 0.024), r=0.002)

    # ---------------- clerk zone at the window (hero) ----------------
    with c.grp("desk"):
        with c.at((W - 0.02, yw, 0), rz=90):
            clerk_desk(c)
        with c.at((W - 0.95, yw + 0.55, 0), rz=RNG.uniform(0, 360)):
            stool(c)
        with c.at((W - 0.03, yw - 2.15, 0.10), rz=90):
            pigeonholes(c, 1.25, 1.75)
        with c.at((W - 0.03, yw + 2.15, 0.10), rz=90):
            pigeonholes(c, 1.25, 1.75, cols=8, rows=8)
        xr = W - 1.18
        for (ya, yb) in ((yw - 1.55, yw - 0.28), (yw + 0.28, yw + 1.55)):
            box(c, "teak", (xr - 0.04, ya, 0.92), (xr + 0.04, yb, 0.97), r=0.006)
            box(c, "teak", (xr - 0.03, ya, 0.08), (xr + 0.03, yb, 0.12), r=0.004)
            n_b = int((yb - ya) / 0.11)
            for k in range(n_b):
                with c.at((xr, ya + 0.05 + k * (yb - ya - 0.1) / (n_b - 1), 0.12)):
                    lathe_baluster(c, 0.80)
        for yy in (yw - 1.55, yw + 1.55):
            box(c, "teak", (xr - 0.05, yy - 0.05, 0.0), (xr + 0.05, yy + 0.05, 1.02), r=0.005)
            with c.at((xr, yy, 1.02)):
                sphere(c, "brass", 0.035, 10, 6)

    with c.grp("var_cash_register"):
        with c.at((W - 0.55, yw - 1.25, 0.80), rz=90):
            box(c, "brass", (-0.20, -0.17, 0.0), (0.20, 0.17, 0.10), r=0.006)
            box(c, "brass", (-0.20, -0.14, 0.10), (0.20, 0.14, 0.34), r=0.006)
            for r_ in range(4):
                for k in range(6):
                    with c.at((-0.15 + k * 0.06, -0.12, 0.12 + r_ * 0.045), rx=-25):
                        cyl(c, "porcelain", 0.014, 0.008, 12, ch=0.002)
            with c.at((0.0, 0.12, 0.42)):
                lathe(c, "brass", [(0, 0), (0.055, 0), (0.05, 0.04), (0.0, 0.05)], 14, True)

    # ---------------- floor props & clusters ----------------
    with c.grp("props"):
        with c.at((0.55, 1.05, 0), rz=RNG.uniform(0, 360)):
            lathe(c, "porcelain", [(0.0, 0), (0.15, 0), (0.17, 0.05), (0.18, 0.55), (0.165, 0.60), (0.15, 0.58), (0.0, 0.5)], 18, True)
            for zz in (0.12, 0.45):
                lathe(c, "brass", [(0.172, zz), (0.184, zz + 0.006), (0.184, zz + 0.026), (0.172, zz + 0.03)], 18, True)
            for k in range(5):
                a = k / 5 * 6.28 + 0.3
                with c.at((0.07 * math.cos(a), 0.07 * math.sin(a), 0.16), ry=RNG.uniform(-6, 6), rz=RNG.uniform(0, 360)):
                    umbrella(c, True, "paint_dark" if k % 2 else "paint_green")
        with c.at((1.35, 1.75, 0.034), rz=-40):
            with c.at((0, 0, 0), ry=90):
                umbrella(c, True, "paint_red")
        with c.at((1.45, 1.75, 0.0015), rz=20):
            decal(c, "water", 0.85, 0.5)
        for (px, py) in ((0.35, 0.45), (0.35, L - 0.45), (W - 0.4, 0.5), (W - 0.4, L - 0.5)):
            with c.at((px, py, 0), rz=RNG.uniform(0, 360)):
                potted_plant(c, 1.0, leaf_n=14)
        for k in range(18 if not dream else 30):
            with c.at((RNG.uniform(0.4, W - 0.3), RNG.uniform(0.6, L - 0.6), 0.001), rz=RNG.uniform(0, 360)):
                decal(c, "dirt", RNG.uniform(0.5, 1.2), RNG.uniform(0.3, 0.5))
        with c.at((W - 0.55, dN + 0.95, 0.0), rz=30):
            box(c, "brass_worn", (-0.05, -0.03, 0), (0.05, 0.03, 0.04), r=0.004)
        with c.at((W - 1.4, yw + 0.4, 0.001), rz=42):
            box(c, "paper_ticket", (-0.03, -0.055, 0), (0.03, 0.055, 0.0012), r=0)

    if dream:
        with c.grp("dream"):
            # the one impossible object: a single red balloon, tethered to the clerk's desk, floating up into the coffers
            bx, by_ = W - 1.05, yw - 0.7
            with c.at((bx, by_, 3.25)):
                with c.at((0, 0, 0), s=(1.0, 1.0, 1.22)):
                    sphere(c, "balloon", 0.34, 20, 14)
                lathe(c, "balloon", [(0.0, -0.46), (0.03, -0.425), (0.012, -0.405), (0.0, -0.40)], 8, True)
            pts = [(bx, by_, 2.78), (bx + 0.05, by_ + 0.05, 2.3), (bx - 0.06, by_ - 0.03, 1.8), (bx + 0.04, by_ + 0.02, 1.3), (bx, by_, 0.85)]
            for i in range(len(pts) - 1):
                tube(c, "paper_ticket", pts[i], pts[i + 1], 0.0025, 4)
            # teal runner down the aisle (the dream counter-colour) with brass edge lines
            box(c, "velvet", (W * 0.40, 0.5, 0.004), (W * 0.40 + 0.95, L - 0.5, 0.012), r=0.002)
            for xx in (W * 0.40 + 0.03, W * 0.40 + 0.92):
                box(c, "brass", (xx - 0.008, 0.5, 0.012), (xx + 0.008, L - 0.5, 0.014), r=0.0008)
            # over-abundance of flowers: a bouquet vase beside every other bench and on the desk and sill
            for i in range(0, nbn, 2):
                with c.at((0.95, 1.3 + i * 2.05 + 1.0, 0.0), rz=RNG.uniform(0, 360)):
                    flower_pot_bouquet(c, n=7, h=0.55)
            with c.at((W - 0.6, yw + 0.9, 0.80)):
                flower_pot_bouquet(c, n=9, h=0.5)
            for k in range(40):
                with c.at((RNG.uniform(0.5, W - 0.5), RNG.uniform(0.6, L - 0.6), 0.003), rz=RNG.uniform(0, 360)):
                    decal(c, "petal_a" if k % 2 else "petal_b", RNG.uniform(0.04, 0.08), RNG.uniform(0.03, 0.05))
    c.cams = [
        dict(name="cam1_axis", loc=(W * 0.55, 0.8, 1.55), tgt=(W * 0.5, L, 1.75), lens=18),
        dict(name="cam2_corner", loc=(0.3, 1.0, 1.55), tgt=(3.3, 9.8, 1.25), lens=20),
        dict(name="cam3_ceiling", loc=(W * 0.5, 2.0, 1.4), tgt=(W * 0.5 + 0.1, 10.0, H - 0.1), lens=18),
        dict(name="cam4_window", loc=(0.35, dN - 3.6, 1.45), tgt=(W, dN + 0.4, 1.35), lens=22),
        dict(name="cam5_street", loc=(W + 0.45 + 3.0, yw + 0.6, 1.5), tgt=(W - 0.3, yw, 1.5), lens=24),
        dict(name="closeup_ticket_window", loc=(W - 0.92, yw - 0.55, 1.36), tgt=(W, yw - 0.50, 1.24), lens=24),
    ]
    if dream:
        c.cams.append(dict(name="cam6_impossible", loc=(0.55, yw - 3.4, 1.7), tgt=(W - 1.05, yw - 0.7, 2.7), lens=24))
    return c


# ======================================================================================================================
# ROOM 2 - TURRET STAIR SW  (INTERFACE.md `stair_SW`: world x -14.05..-10.50, y -12.55..-9.05, z 0.15..19.20)
#   Cell frame: x 0..3.55, y 0..3.5, z 0..19.05 (cell = world + (14.05, 12.55, -0.15)); walls 0.45 outside the box.
#   v1.2 (2026-10-01, Codex review 109): 75 risers of 200 mm (15.0 m rise ground -> head floor = roof-garden deck 15.15 world),
#   going 267 mm on the side flights (2R+G 667 mm), 232 mm on the first flight.  The v1 stair (84 x 178.6 mm) ended with a
#   flight up the east strip that ran under the head floor (headroom 1.75 -> 0.14 m); v1.2 ends with a straight flight up the
#   south strip that arrives on a proper head landing: the L of the east strip + north strip at z 15.0, which carries the lift
#   transfer door (east wall, y 0.85..2.65) and the stair-head door (north wall, x 1.075..2.475) with full thresholds.
#   Stairwell opening in the head floor: cell x 0..2.60, y 0..2.55 (eyewell + west strip + SW corner + south strip), framed by a
#   steel trimmer along x 2.60 (south wall -> north wall) and a header along y 2.55 (west wall -> trimmer) under a 0.30 m slab
#   (exterior owns slab + steel; the interior owns finishes, nosings, fascia and the balustrade round the opening).
#   T: 「各二個の階段ありて塔上に誘ふ」 / 「階段の昇降口自ら四隅の小塔を為す」 (fr.268).  A: winder-cornered square newel stair around a
#   1.6 m eyewell, first flight up the east strip (14 risers) so later flights pass >= 2.5 m over the two ground doors.
#   Openings (INTERFACE): hall door N wall z 0..2.45, street door S wall z 0..2.55, windows S and W faces (w 1.0, sill/head
#   5.65/7.45, 9.15/10.85, 12.55/14.25; T4 paired 0.8 at 15.95/18.25), stair-head door N wall (1.4 wide, z 15.0..17.5) and lift
#   transfer door E wall (1.8 wide, z 15.0..17.75).  Where a flight crosses an L1-L3 window the inner trim is omitted.
#   Story: the cleaner stopped mid-sweep and went out onto the roof garden: broom leaning in the dead-end corner of the head
#   landing, dustpan with a heap, bucket, and a wet stripe down the top three treads.  Over-abundance: a string of pendant bulbs
#   hanging down the eyewell to the ground.
# ======================================================================================================================
ST_NR = 75                                   # risers
ST_W, ST_HEAD = 3.5, 15.0
ST_R = ST_HEAD / ST_NR                       # 0.200 m
ST_H = 19.05
ST_X0 = 0.05                                 # the 3.5 m stair square sits at cell x 0.05..3.55 (5 cm timber gap on the west wall)
ST_WX, ST_WY = 3.55, 3.5
ST_OPEN = (0.0, 0.0, 2.60, 2.55)             # stairwell opening in the head floor, cell (x0, y0, x1, y1)
ST_SLAB = 0.30                               # head floor slab (exterior), soffit at 14.70
ST_TRIM_D, ST_TRIM_B = 0.25, 0.125           # steel trimmer / header: depth below the soffit, flange width
ST_LANDING = [(2.60, 0.0), (3.55, 0.0), (3.55, 3.5), (0.0, 3.5), (0.0, 2.55), (2.60, 2.55)]   # head landing (L), z 15.0
ST_RAIL = 0.95                               # landing guard height


def rot_pt(p, k, cx=1.75, cy=1.75):
    x, y = p[0] - cx, p[1] - cy
    for _ in range(k % 4):
        x, y = -y, x
    return (x + cx, y + cy)


def st_pt(x, y, k):
    """Template point (x, y) of quarter k -> cell coordinates."""
    q = rot_pt((x, y), k)
    return (q[0] + ST_X0, q[1])


def stair_steps():
    """Steps 1..74 as dicts: n, poly [(x, y)] in cell coords, z (tread top), kind tread|winder, k (quarter), and for treads the
    template y-range ty0..ty1 (template: east strip x 2.55..3.5, travel +y).  Step 75 is the head landing (z 15.0)."""
    steps = []

    def emit(poly, kind, k, ty=None):
        n = len(steps) + 1
        d = dict(n=n, poly=[st_pt(x, y, k) for (x, y) in poly], z=n * ST_R, kind=kind, k=k, tpl=poly)
        if ty:
            d["ty0"], d["ty1"] = ty
        steps.append(d)

    def quarter(k, ntr, pitch, final=False):
        y0 = 2.55 - ntr * pitch
        for i in range(ntr):
            a, b = y0 + i * pitch, y0 + (i + 1) * pitch
            emit([(2.55, a), (3.5, a), (3.5, b), (2.55, b)], "tread", k, (a, b))
        if final:
            return
        P = (2.55, 2.55)
        for poly in ([P, (3.5, 2.55), (3.5, 3.10)], [P, (3.5, 3.10), (3.5, 3.5), (3.10, 3.5)], [P, (3.10, 3.5), (2.55, 3.5)]):
            emit(poly, "winder", k)

    quarter(0, 11, 2.55 / 11)
    for k in range(1, 7):
        quarter(k, 6, 1.6 / 6)
    quarter(7, 6, 1.6 / 6, final=True)            # the final flight: south strip, heading east, onto the head landing
    assert len(steps) == ST_NR - 1
    return steps


def _pip(p, poly):
    x, y = p
    ins = False
    for i in range(len(poly)):
        (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % len(poly)]
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            ins = not ins
    return ins


def st_top_below(steps, x, y, zmax):
    """Highest walking surface (tread, head landing or ground) at plan point (x, y) not above zmax."""
    best = 0.0
    for s in steps:
        if s["z"] <= zmax + 1e-6 and s["z"] > best and _pip((x, y), s["poly"]):
            best = s["z"]
    if ST_HEAD <= zmax + 1e-6 and _pip((x, y), ST_LANDING):
        best = ST_HEAD
    return best


def st_walk_samples(s):
    """Walking-line samples for a step (cell x, y): centre + both edges of the clear width (inner rail line + 0.10, wall rail - 0.08).
    Treads: at mid-going.  Winders: along the bisector at radii 0.30 / 0.475 / 0.80 (kite 0.95) from the newel pivot."""
    k = s["k"]
    if s["kind"] == "tread":
        ym = (s["ty0"] + s["ty1"]) / 2
        return {"inner": st_pt(2.575 + 0.10, ym, k), "centre": st_pt(3.025, ym, k), "outer": st_pt(3.44 - 0.017 - 0.08, ym, k)}
    P = s["tpl"][0]
    q = s["tpl"][1:]
    a0 = math.atan2(q[0][1] - P[1], q[0][0] - P[0])
    a1 = math.atan2(q[-1][1] - P[1], q[-1][0] - P[0])
    am = (a0 + a1) / 2
    far = 0.95 if len(q) == 3 else 0.80
    out = {}
    for nm, r in (("inner", 0.30), ("centre", 0.475), ("outer", far)):
        out[nm] = st_pt(P[0] + r * math.cos(am), P[1] + r * math.sin(am), k)
    return out


def pendant_string(c, z_top, n=22, seed=3):
    """Over-abundance: a chain of pendant bulbs of many heights hanging in the eyewell down to the ground floor."""
    rr = random.Random(seed)
    for i in range(n):
        x = 1.75 + ST_X0 + rr.uniform(-0.55, 0.55)
        y = 1.75 + rr.uniform(-0.55, 0.55)
        z = z_top - 0.5 - i * (z_top - 1.7) / n
        with c.at((x, y, z + 0.9)):
            pendant(c, 0.9, r=0.10, real_light=(i % 4 == 0), name="well%d" % i, watt=45, rose=False)


def st_head_structure(c, slab_mat="plaster_ceil", steel_mat="iron", rivets=True):
    """The head floor as the exterior builds it (render stand-in): 0.30 m slab with the stairwell opening, a riveted steel trimmer
    (I 250 x 125) along x 2.60 bearing on the S and N walls, a header along y 2.55 from the W wall framing into the trimmer with
    angle cleats.  Bottom flanges at z 14.45, visible from the stair."""
    x0, y0, x1, y1 = ST_OPEN
    zt, zs = ST_HEAD, ST_HEAD - ST_SLAB
    zb = zs - ST_TRIM_D
    extrude(c, slab_mat, ST_LANDING, (), depth=ST_SLAB, w0=zs)
    tf, tw = 0.012, 0.008
    # trimmer along x = x1 (flange x1..x1+B), y from -0.2 (wall pocket) to WY + 0.2
    B = ST_TRIM_B
    for (lo, hi) in (((x1, -0.2, zs - tf), (x1 + B, ST_WY + 0.2, zs)), ((x1, -0.2, zb), (x1 + B, ST_WY + 0.2, zb + tf)),
                     ((x1 + B / 2 - tw / 2, -0.2, zb + tf), (x1 + B / 2 + tw / 2, ST_WY + 0.2, zs - tf))):
        box(c, steel_mat, lo, hi, r=0.002)
    # header along y = y1 (flange y1..y1+B), x from -0.2 (wall pocket) to the trimmer web
    xe = x1 + B / 2 - tw / 2 - 0.004
    for (lo, hi) in (((-0.2, y1, zs - tf), (xe - 0.06, y1 + B, zs)), ((-0.2, y1, zb + 0.03), (xe - 0.06, y1 + B, zb + 0.03 + tf)),
                     ((-0.2, y1 + B / 2 - tw / 2, zb + 0.03 + tf), (xe, y1 + B / 2 + tw / 2, zs - tf))):
        box(c, steel_mat, lo, hi, r=0.002)
    # angle cleats (header web -> trimmer web) with rivets
    for sgn in (-1, 1):
        yc = y1 + B / 2 + sgn * (tw / 2 + 0.004)
        box(c, steel_mat, (xe - 0.07, min(yc, yc + sgn * 0.008), zb + 0.06), (xe, max(yc, yc + sgn * 0.008), zs - 0.04), r=0.001)
        if rivets:
            for zz in (zb + 0.09, zs - 0.07):
                with c.at((xe - 0.04, yc + sgn * 0.008, zz), rx=-90 * sgn):
                    lathe(c, steel_mat, [(0, 0), (0.009, 0), (0.008, 0.003), (0.004, 0.006), (0, 0.0065)], 8, True)
    if rivets:                                      # flange rivets along the trimmer and header soffits
        for i in range(12):
            yy = 0.15 + i * (ST_WY - 0.3) / 11
            for dx in (0.03, B - 0.03):
                with c.at((x1 + dx, yy, zb), rx=180):
                    lathe(c, steel_mat, [(0, 0), (0.008, 0), (0.007, 0.003), (0.0035, 0.0055), (0, 0.006)], 6, True)
        for i in range(8):
            xx = 0.15 + i * (xe - 0.3) / 7
            for dy in (0.03, B - 0.03):
                with c.at((xx, y1 + dy, zb + 0.03), rx=180):
                    lathe(c, steel_mat, [(0, 0), (0.008, 0), (0.007, 0.003), (0.0035, 0.0055), (0, 0.006)], 6, True)


def build_stair(dream=False):
    c = Cell("stair_dream" if dream else "stair", dream)
    rs = random.Random("stair-dream" if dream else "stair")
    WX, WY = ST_WX, ST_WY                            # INTERFACE v1.1 clear plan 3.55 x 3.50
    W = WY
    c.lod = 0
    c.env = dict(exposure=1.2 if not dream else 1.6, sun_elev=38, sun_rot=230, sky=0.5, glare_thr=0.9)
    sun_dir = Vector((0.55, 0.62, -0.56)).normalized()
    c.light("sun", "sun", Vector((1.75, 1.0, 6.0)) - sun_dir * 40, color=(255, 232, 196) if not dream else (255, 210, 190),
            watt=26.0, size=1.0, target=(1.75, 1.0, 6.0))
    tw = 0.45
    CXW, CYW = 1.775, 1.75                          # turret centre: x on the S wall, y on the W wall
    steps = stair_steps()
    c.stair_steps = steps
    x0o, y0o, x1o, y1o = ST_OPEN

    def win_holes(cx):
        out = []
        for (s, h) in ((5.65, 7.45), (9.15, 10.85), (12.55, 14.25)):
            out.append(arch_pts(cx - 0.5, cx + 0.5, h - 0.5, 0.5, 14, s))
        for dx in (-0.5, 0.5):
            out.append(arch_pts(cx + dx - 0.4, cx + dx + 0.4, 18.25 - 0.4, 0.4, 14, 15.95))
        return out

    def l0_hole(cy):                                  # INTERFACE v1.1: one L0 window 0.90 x (sill 1.50, head 3.30 world) on each turret E/W face
        return arch_pts(cy - 0.45, cy + 0.45, 3.15 - 0.45, 0.45, 12, 1.35)

    with c.grp("shell_finish"):                                             # exported: floor finishes + ceiling skin inside the clear box
        c.face([(0, 0, 0.003), (WX, 0, 0.003), (WX, WY, 0.003), (0, WY, 0.003)], "stone_floor", uv=[(0, 0), (WX / 1.2, 0), (WX / 1.2, WY / 1.2), (0, WY / 1.2)])
        with c.at(m=Matrix.Translation((0, 0, ST_HEAD + 0.001))):          # head landing boards (L), the opening is x 0..2.60, y 0..2.55
            extrude(c, "boards", ST_LANDING, (), depth=0.004)
        c.face([(0, 0, ST_H - 0.003), (0, WY, ST_H - 0.003), (WX, WY, ST_H - 0.003), (WX, 0, ST_H - 0.003)], "plaster_ceil")
    with c.grp("ref_shell"):                                                # walls + slabs + steel are drawn by the exterior (INTERFACE); render-only
        extrude(c, "stone_floor", rect_pts(-tw, -tw, WX + tw, WY + tw), (), depth=0.30, w0=-0.30, caps=True)
        st_head_structure(c)
        box(c, "plaster_ceil", (-tw, -tw, ST_H), (WX + tw, WY + tw, ST_H + 0.3), r=0)
        wallXZ(c, "plaster", -tw, WX + tw, -0.3, ST_H + 0.3, -tw, 0.0, holes=[rect_pts(CXW - 0.6, 0.0, CXW + 0.6, 2.55)] + win_holes(CXW))
        wallYZ(c, "plaster", -tw, WY + tw, -0.3, ST_H + 0.3, -tw, 0.0, holes=win_holes(CYW) + [l0_hole(CYW)])
        wallXZ(c, "plaster", -tw, WX + tw, -0.3, ST_H + 0.3, WY, WY + tw, holes=[rect_pts(CXW - 0.6, 0.0, CXW + 0.6, 2.45), rect_pts(CXW - 0.7, ST_HEAD, CXW + 0.7, 17.5)])
        wallYZ(c, "plaster", -tw, WY + tw, -0.3, ST_H + 0.3, WX, WX + tw, holes=[rect_pts(0.85, ST_HEAD, 2.65, 17.75), l0_hole(CYW)])
    # collision: ground floor, head landing (L) and a ramp through the nosings of every flight / winder fan
    c.col.append([(0, 0, 0), (WX, 0, 0), (WX, WY, 0), (0, WY, 0)])
    c.col.append([(2.60, 0.0, ST_HEAD), (WX, 0.0, ST_HEAD), (WX, WY, ST_HEAD), (2.60, WY, ST_HEAD)])
    c.col.append([(0.0, 2.55, ST_HEAD), (2.60, 2.55, ST_HEAD), (2.60, WY, ST_HEAD), (0.0, WY, ST_HEAD)])
    for s in steps:
        k = s["k"]
        if s["kind"] == "tread":
            # nosing ramp: front edge at the step's own nosing (z), back edge at the next nosing (z + R)
            (a, b, cc, d) = s["poly"]
            c.col.append([(a[0], a[1], s["z"]), (b[0], b[1], s["z"]), (cc[0], cc[1], s["z"] + ST_R), (d[0], d[1], s["z"] + ST_R)])
        else:
            P, q = s["poly"][0], s["poly"][1:]
            pts = [(P[0], P[1], s["z"] + ST_R * 0.5)] + [(p[0], p[1], s["z"] + ST_R * i / (len(q) - 1)) for i, p in enumerate(q)]
            c.col.append(pts)

    with c.grp("ref_outside"):
        box(c, "sandstone", (-60, -60, -1.0), (60, 60, -0.31), r=0)
        with c.at(m=M_XZ(-tw - 0.02)):
            extrude(c, "sandstone", rect_pts(-tw, 0, WX + tw, ST_H + 0.3), [rect_pts(CXW - 0.6, 0.0, CXW + 0.6, 2.55)] + win_holes(CXW), depth=0.02)
        with c.at(m=M_YZ(-tw - 0.02)):
            extrude(c, "sandstone", rect_pts(-tw, 0, WY + tw, ST_H + 0.3), win_holes(CYW) + [l0_hole(CYW)], depth=0.02)

    # ---------- windows (S and W faces, L0 windows on W and E) ----------
    # L1-L3 and the east L0 window are crossed by flights: their inner architrave, sill and keystone are left off (reveal only)
    Mflip = Matrix(((0, 0, -1, WX), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))        # E-face frame: room on -x
    with c.grp("windows"):
        for (s_, h_) in ((5.65, 7.45), (9.15, 10.85), (12.55, 14.25)):
            arched_window(c, 0.0, CYW, 1.0, s_, h_ - 0.5, tw, curtain=False, inner_trim=False)
            arched_window(c, 0.0, CXW, 1.0, s_, h_ - 0.5, tw, curtain=False, M=M_XZ(0.0), inner_trim=False)
        for dx in (-0.5, 0.5):
            arched_window(c, 0.0, CYW + dx, 0.8, 15.95, 18.25 - 0.4, tw, curtain=False)
            arched_window(c, 0.0, CXW + dx, 0.8, 15.95, 18.25 - 0.4, tw, curtain=False, M=M_XZ(0.0))
        arched_window(c, 0.0, CYW, 0.9, 1.35, 3.15 - 0.45, tw, curtain=False)
        arched_window(c, 0.0, CYW, 0.9, 1.35, 3.15 - 0.45, tw, curtain=False, M=Mflip, inner_trim=False)
    with c.grp("ref_doors"):                                   # leaves of exterior doors belong to the exterior (INTERFACE v1.1); render-only, closed as built
        with c.at((CXW - 0.6, -0.10, 0.0)):
            door_leaf(c, 1.2, 2.55)
        for (u0, u1) in ((CXW - 0.62, CXW - 0.003), (CXW + 0.003, CXW + 0.62)):     # stair-head pair, frame line 0.15 in from the deck face
            with c.at((u0, WY + 0.25, ST_HEAD + 0.03)):
                door_leaf(c, u1 - u0, 2.39)
        for (v0, v1) in ((0.93, 1.747), (1.753, 2.57)):                            # lift-transfer pair
            with c.at((WX + 0.25, v0, ST_HEAD + 0.03), rz=90):
                door_leaf(c, v1 - v0, 2.64)

    # ---------- the stair ----------
    with c.grp("stair"):
        for s in steps:
            with c.at((0, 0, s["z"] - 0.17)):
                extrude(c, "boards" if s["kind"] == "tread" else "boards_dk", s["poly"], (), depth=0.17)
        # carpet runner + brass nosing + stair rods on straight flights
        for s in steps:
            if s["kind"] != "tread":
                continue
            k = s["k"]
            xs = [p[0] for p in s["poly"]]
            ys = [p[1] for p in s["poly"]]
            cx, cy = sum(xs) / 4, sum(ys) / 4
            dpt = s["ty1"] - s["ty0"]
            with c.at((cx, cy, s["z"]), rz=90 * k):
                box(c, "velvet", (-0.30, -dpt / 2 + 0.005, 0.0), (0.30, dpt / 2, 0.007), r=0.002)
                box(c, "brass", (-0.40, -dpt / 2 - 0.004, -0.008), (0.40, -dpt / 2 + 0.018, 0.002), r=0.002)           # nosing
                tube(c, "brass", (-0.335, -dpt / 2 + 0.03, 0.013), (0.335, -dpt / 2 + 0.03, 0.013), 0.0045, 6)         # stair rod
                for sx in (-0.335, 0.335):
                    with c.at((sx, -dpt / 2 + 0.03, 0.013)):
                        sphere(c, "brass", 0.007, 6, 4)
        # sloped plaster soffits under each straight flight (hides the saw-tooth underside of the stepped treads)
        for k in range(0, 8):
            fl = [s for s in steps if s["kind"] == "tread" and s["k"] == k]
            if len(fl) < 2:
                continue
            xs_ = [p[0] for s in fl for p in s["poly"]]
            ys_ = [p[1] for s in fl for p in s["poly"]]
            f0 = (sum(p[0] for p in fl[0]["poly"]) / 4, sum(p[1] for p in fl[0]["poly"]) / 4)
            f1 = (sum(p[0] for p in fl[-1]["poly"]) / 4, sum(p[1] for p in fl[-1]["poly"]) / 4)
            dx, dy = f1[0] - f0[0], f1[1] - f0[1]
            dl = math.hypot(dx, dy)
            ux, uy = dx / dl, dy / dl
            zb0_, zb1_ = fl[0]["z"] - 0.17, fl[-1]["z"] - 0.17

            def zat(px, py):
                t = ((px - f0[0]) * ux + (py - f0[1]) * uy) / dl
                return zb0_ + (zb1_ - zb0_) * t
            cs = [(min(xs_), min(ys_)), (max(xs_), min(ys_)), (max(xs_), max(ys_)), (min(xs_), max(ys_))]
            c.face([(p[0], p[1], zat(*p) - 0.02) for p in cs], "plaster_ceil")
        # inner balustrade: iron bars, teak handrail per straight flight; brass wall rail on brackets
        for k in range(0, 8):
            fl = [s for s in steps if s["kind"] == "tread" and s["k"] == k]
            if not fl:
                continue
            first, last = fl[0], fl[-1]

            def inner(s):
                return st_pt(2.575, (s["ty0"] + s["ty1"]) / 2, k)

            def outer(s):
                return st_pt(3.44, (s["ty0"] + s["ty1"]) / 2, k)
            a, b = inner(first), inner(last)
            tube(c, "teak", (a[0], a[1], first["z"] + 0.92), (b[0], b[1], last["z"] + 0.92), 0.032, 8)
            for s in fl:
                p = inner(s)
                tube(c, "iron", (p[0], p[1], s["z"]), (p[0], p[1], s["z"] + 0.88), 0.008, 4)
            oa, ob = outer(first), outer(last)
            tube(c, "brass", (oa[0], oa[1], first["z"] + 0.88), (ob[0], ob[1], last["z"] + 0.88), 0.017, 8)
            for s in (first, last):
                o = outer(s)
                w_ = st_pt(3.5, (s["ty0"] + s["ty1"]) / 2, k)
                tube(c, "brass", (w_[0], w_[1], s["z"] + 0.88), (o[0], o[1], s["z"] + 0.88), 0.008, 6)
        # newel posts at the inner winder pivots, wooden with a brass ball
        for k in range(0, 7):
            P = st_pt(2.55, 2.55, k)
            wz = [s for s in steps if s["kind"] == "winder" and s["k"] == k]
            z0 = wz[0]["z"]
            with c.at((P[0], P[1], z0)):
                box(c, "teak", (-0.045, -0.045, 0.0), (0.045, 0.045, 1.25), r=0.004)
                with c.at((0, 0, 1.25)):
                    sphere(c, "brass", 0.05, 10, 6)
        # ---- head landing: nosing + fascia on the opening edges, brass nosing at the arrival, balustrade with newels ----
        zt = ST_HEAD
        box(c, "teak", (x1o - 0.025, 0.93, zt - 0.03), (x1o + 0.07, y1o + 0.07, zt + 0.006), r=0.004)            # nosing along x 2.60
        box(c, "teak", (-0.0, y1o - 0.025, zt - 0.03), (x1o - 0.025, y1o + 0.07, zt + 0.006), r=0.004)             # nosing along y 2.55
        box(c, "paint_cream", (x1o - 0.012, 0.95, ST_HEAD - ST_SLAB + 0.02), (x1o, y1o, zt - 0.03), r=0.002)        # fascia over the slab edge
        box(c, "paint_cream", (0.0, y1o - 0.012, ST_HEAD - ST_SLAB + 0.02), (x1o, y1o, zt - 0.03), r=0.002)
        box(c, "boards_dk", (x1o - 0.012, 0.0, zt - 0.20), (x1o, 0.95, zt - 0.03), r=0.002)                        # top riser board
        box(c, "brass", (x1o - 0.004, 0.005, zt - 0.008), (x1o + 0.018, 0.94, zt + 0.004), r=0.002)                # arrival nosing
        with c.at((x1o + 0.12, 0.475, zt + 0.005)):
            box(c, "velvet", (-0.10, -0.30, 0.0), (0.10, 0.30, 0.006), r=0.002)                                     # runner turns onto the landing
        # toe kerb + iron balusters + teak rail round the opening (x = 2.625 from y 0.925 to 2.575, then y = 2.575 to the W wall)
        rx_, ry_ = x1o + 0.025, y1o + 0.025
        run = [((rx_ + 0.03, 0.925), (rx_ + 0.03, ry_)), ((rx_ + 0.03, ry_), (0.03, ry_))]
        for (pa, pb) in run:
            lo = (min(pa[0], pb[0]) - 0.03, min(pa[1], pb[1]) - 0.03, zt + 0.006)
            hi = (max(pa[0], pb[0]) + 0.03, max(pa[1], pb[1]) + 0.03, zt + 0.075)
            box(c, "teak", lo, hi, r=0.004)
            L_ = math.dist(pa, pb)
            nb = int(L_ / 0.11)
            for i in range(1, nb):
                t = i / nb
                p = (pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t)
                box(c, "iron", (p[0] - 0.008, p[1] - 0.008, zt + 0.075), (p[0] + 0.008, p[1] + 0.008, zt + ST_RAIL - 0.03), r=0.0015)
            tube(c, "teak", (pa[0], pa[1], zt + ST_RAIL - 0.01), (pb[0], pb[1], zt + ST_RAIL - 0.01), 0.032, 8)
        for (px, py, hgt) in ((rx_ + 0.03, 0.925, 1.25), (rx_ + 0.03, ry_, 1.25)):
            with c.at((px, py, zt + 0.006)):
                box(c, "teak", (-0.05, -0.05, 0.0), (0.05, 0.05, 0.12), r=0.006)
                box(c, "teak", (-0.042, -0.042, 0.12), (0.042, 0.042, hgt - 0.08), r=0.004)
                box(c, "teak", (-0.05, -0.05, hgt - 0.08), (0.05, 0.05, hgt - 0.05), r=0.006)
                with c.at((0, 0, hgt)):
                    sphere(c, "brass", 0.05, 10, 6)
        box(c, "teak", (0.0, ry_ - 0.035, zt + 0.006), (0.03, ry_ + 0.035, zt + ST_RAIL + 0.03), r=0.004)           # wall plate at the W end
        # the final flight's inner rail runs on to the head newel
        fl = [s for s in steps if s["kind"] == "tread" and s["k"] == 7]
        a = st_pt(2.575, (fl[-1]["ty0"] + fl[-1]["ty1"]) / 2, 7)
        tube(c, "teak", (a[0], a[1], fl[-1]["z"] + 0.92), (rx_ + 0.03, 0.925, zt + 1.05), 0.032, 8)
    # ---------- walls dressing: lobby / landing dado, fields, sconces, grime ----------
    # (v1.2: the mid-height horizontal dado bands crossed the flights and were removed; fields, posters, sconces and switch
    #  plates are placed from the stair geometry so nothing wall-mounted sits in the 2.0 m headroom zone above a tread)
    with c.grp("walls"):
        def dado(M_, sgn, spans, z0, z1):
            with c.at(m=M_):
                for (u0, u1) in spans:
                    box(c, "plaster_dk", (u0, z0, 0.0 if sgn > 0 else -0.05), (u1, z1 - 0.06, 0.05 if sgn > 0 else 0.0), r=0.004)
                    box(c, "sandstone" if z0 < 1 else "paint_cream", (u0, z1 - 0.06, 0.0 if sgn > 0 else -0.06), (u1, z1, 0.06 if sgn > 0 else 0.0), r=0.004)
        dado(M_XZ(0.0), 1, ((0.0, CXW - 0.6), (CXW + 0.6, 2.60)), 0.0, 1.16)                 # S wall lobby (street door, E-strip foot excluded)
        dado(M_XZ(W), -1, ((0.0, CXW - 0.6), (CXW + 0.6, 2.60)), 0.0, 1.16)                  # N wall lobby (hall door)
        dado(M_YZ(0.0), 1, ((0.0, W),), 0.0, 1.16)                                           # W wall lobby
        dado(M_XZ(W), -1, ((0.0, CXW - 0.7), (CXW + 0.7, WX)), ST_HEAD, ST_HEAD + 1.16)      # N wall on the head landing
        dado(M_YZ(WX), -1, ((0.0, 0.85), (2.65, W)), ST_HEAD, ST_HEAD + 1.16)                # E wall on the head landing
        # wallpaper fields in the wall areas no flight crosses
        field(c, M_YZ(WX), -1, 0.15, 3.35, 5.5, 7.45, fw=0.04)
        field(c, M_XZ(W), -1, 0.15, 0.95, 1.5, 3.5, fw=0.04)
        field(c, M_XZ(W), -1, 0.15, 1.0, 5.5, 7.5, fw=0.04)
        field(c, M_XZ(W), -1, 2.5, 3.35, 5.5, 7.5, fw=0.04)
        field(c, M_XZ(W), -1, 0.15, 0.95, 12.3, 14.3, fw=0.04)
        field(c, M_XZ(W), -1, 2.5, 3.35, 11.0, 13.0, fw=0.04)
        # posters at eye level over the flights beside them (E wall)
        for i, (py, zmax) in enumerate(((1.0, 3.0), (2.5, 10.0), (1.0, 9.0))):
            zb = st_top_below(steps, WX - 0.2, py, zmax) + 1.35
            with c.at((WX, py, zb), rz=90):
                poster(c, 0.42, 0.62, (i * 3) % 8)
        # sconces 2.2 m over the surface below them (E wall y 1.0 / 0.45 and N wall x 2.9); back plate on the wall face
        sc_pts = []
        for zmax in (3.0, 9.0):
            sc_pts.append((90, WX, 1.0, st_top_below(steps, 3.3, 1.0, zmax) + 2.2))
        sc_pts.append((90, WX, 0.45, ST_HEAD + 2.0))
        for zmax in (3.0, 10.1):
            sc_pts.append((180, 2.9, WY, st_top_below(steps, 2.9, 3.35, zmax) + 2.2))
        sc_pts.append((180, 2.9, WY, ST_HEAD + 2.0))
        for i, (ang, px, py, zs) in enumerate(sc_pts):
            with c.at((px, py, zs), rz=ang):
                sconce(c, real_light=(i in (1, 2, 4)), name="sc%d%d" % (int(zs * 10), int(px * 10)), watt=16)
        # open wiring on porcelain cleats along the E wall above the first flight; switch plates beside the NE winders / landing
        with c.at((WX, 0.0, 5.0), ry=-90):
            porcelain_cleat_run(c, (0.0, 0.3, 0.0), (0.0, 3.2, 0.0))
        for zmax in (3.0, 10.1, ST_HEAD):
            zs = st_top_below(steps, WX - 0.2, 3.05, zmax) + 1.3
            with c.at((WX - 0.0, 3.05, zs), ry=-90):
                switch_plate(c)
        with c.at(m=M_YZ(WX)):
            panel(c, "grime", 0.0, W, ST_H - 1.5, ST_H, w=-0.0025, flip=True)
        with c.at(m=M_XZ(W)):
            panel(c, "grime", 0.0, W, ST_H - 1.5, ST_H, w=-0.0025, flip=True)
    # ---------- ceiling rose + eyewell lamp string ----------
    with c.grp("pendants"):
        with c.at((1.75 + ST_X0, 1.75, ST_H)):
            lathe(c, "plaster_ceil", [(0.70, 0.0), (0.70, -0.03), (0.52, -0.06), (0.30, -0.09), (0.0, -0.11)], 24, True)
        pendant_string(c, ST_H, 22)
    # ---------- story: the cleaner went out onto the roof garden (props in the dead-end NW corner of the head landing) ----------
    with c.grp("props"):
        zt = ST_HEAD + 0.005
        with c.at((0.40, 3.20, zt), rz=-35):                                  # broom leaning into the W/N wall corner
            with c.at((0, 0, 0.0), ry=-14):
                tube(c, "teak", (0, 0, 0.09), (0, 0, 1.30), 0.012, 8)
                with c.at((0, 0, 0.09)):
                    box(c, "oak", (-0.14, -0.02, 0.0), (0.14, 0.02, 0.07), r=0.004)
                    for i in range(14):                                     # bristles
                        tube(c, "leather", (-0.13 + i * 0.02, 0.0, 0.0), (-0.13 + i * 0.02 + rs.uniform(-0.01, 0.01), rs.uniform(-0.02, 0.02), -0.085), 0.003, 4)
        with c.at((0.62, 3.02, zt), rz=30):                                   # dustpan with a heap
            box(c, "iron", (-0.09, -0.11, 0.0), (0.09, 0.11, 0.012), r=0.003)
            box(c, "iron", (-0.09, 0.09, 0.012), (0.09, 0.11, 0.05), r=0.002)
            for i in range(9):
                with c.at((rs.uniform(-0.06, 0.06), rs.uniform(-0.07, 0.05), 0.012)):
                    sphere(c, "rubber", rs.uniform(0.006, 0.012), 5, 3)
        with c.at((0.32, 2.92, zt)):                                          # bucket
            lathe(c, "iron", [(0.0, 0), (0.12, 0), (0.14, 0.02), (0.16, 0.26), (0.165, 0.28), (0.16, 0.27), (0.0, 0.05)], 16, True)
            tube(c, "iron", (-0.165, 0, 0.27), (0.0, 0, 0.36), 0.004, 4)
            tube(c, "iron", (0.165, 0, 0.27), (0.0, 0, 0.36), 0.004, 4)
        for s in steps[-3:]:                                                  # wet stripe down the top three treads
            cx = sum(p[0] for p in s["poly"]) / 4
            cy = sum(p[1] for p in s["poly"]) / 4
            with c.at((cx, cy, s["z"] + 0.009), rz=90 * s["k"]):
                decal(c, "water", 0.5, 0.2)
        with c.at((x1o + 0.25, 0.5, zt + 0.004)):
            decal(c, "water", 0.35, 0.5)
    # fire-bucket rack (+ unverified) on the S wall of the ground lobby (clear of the first flight)
    with c.grp("var_fire_buckets"):
        with c.at((0.55, 0.0, 1.2), rz=0):
            box(c, "teak", (-0.35, 0, 0), (0.35, 0.03, 0.10), r=0.003)
            for xx in (-0.2, 0.2):
                tube(c, "iron", (xx, 0.03, 0.02), (xx, 0.10, 0.02), 0.006, 6)
                with c.at((xx, 0.18, 0.02)):
                    lathe(c, "paint_red", [(0.0, 0), (0.09, 0), (0.12, 0.28), (0.125, 0.30), (0.0, 0.30)], 12, True)
    # ground lobby floor dressing: runner, mat, dirt
    with c.grp("lobby"):
        with c.at((1.75 + ST_X0, 1.75, 0.001)):
            for k in range(10):
                with c.at((rs.uniform(-1.4, 1.4), rs.uniform(-1.4, 1.4), 0.0), rz=rs.uniform(0, 360)):
                    decal(c, "dirt", rs.uniform(0.5, 1.0), rs.uniform(0.3, 0.6))
        with c.at((CXW, 0.55, 0.002)):
            box(c, "rubber", (-0.55, -0.35, 0.0), (0.55, 0.35, 0.02), r=0.006)                # door mat
        with c.at((CXW, 3.0, 0.002)):
            box(c, "rubber", (-0.55, -0.30, 0.0), (0.55, 0.30, 0.02), r=0.006)
        with c.at((CXW, 3.0, ST_HEAD + 0.006)):
            box(c, "rubber", (-0.55, -0.30, 0.0), (0.55, 0.30, 0.012), r=0.004)             # mat at the stair-head door
    if dream:
        with c.grp("dream"):
            # petals on every tread (over-abundance), bouquets in the wall corner of every kite winder, and one upside-down stair
            # hanging from the ceiling over the open part of the stairwell only (bottom >= 17.2: >= 2.0 m over the head landing)
            for s in steps:
                cx = sum(p[0] for p in s["poly"]) / len(s["poly"])
                cy = sum(p[1] for p in s["poly"]) / len(s["poly"])
                for j in range(3):
                    with c.at((cx + rs.uniform(-0.3, 0.3), cy + rs.uniform(-0.1, 0.1), s["z"] + 0.009), rz=rs.uniform(0, 360)):
                        decal(c, "petal_a" if j % 2 else "petal_b", rs.uniform(0.04, 0.08), rs.uniform(0.03, 0.05))
            for s in steps:
                if s["kind"] == "winder" and len(s["poly"]) == 4:
                    corner = s["poly"][2]
                    P = s["poly"][0]
                    d = (P[0] - corner[0], P[1] - corner[1])
                    L_ = math.hypot(*d)
                    with c.at((corner[0] + d[0] / L_ * 0.15, corner[1] + d[1] / L_ * 0.15, s["z"]), rz=rs.uniform(0, 360)):
                        flower_pot_bouquet(c, n=6, h=0.36, vase=(s["n"] % 2 == 0))
            with c.at((0, 0, ST_H - 0.35)):
                for s in [s_ for s_ in steps if 24 <= s_["n"] <= 38]:
                    extrude(c, "boards_dk", s["poly"], (), depth=0.17, w0=-(s["n"] - 24) * ST_R * 0.45 - 0.17)
    # ---------- cameras ----------
    z_ = {s["n"]: s["z"] for s in steps}
    c.cams = [
        dict(name="cam1_axis", loc=(1.80, 1.80, 1.2), tgt=(1.74, 1.72, 18.0), lens=15),
        dict(name="cam2_corner", loc=(0.25, 3.25, z_[36] + 1.55), tgt=(3.2, 0.3, z_[36] + 0.8), lens=18),
        dict(name="cam3_ceiling", loc=(3.05, 0.4, ST_HEAD + 1.5), tgt=(1.0, 2.2, ST_H - 0.6), lens=18),
        dict(name="cam4_window", loc=(2.95, 2.6, z_[29] + 1.5), tgt=(1.6, 0.0, 6.7), lens=24),
        dict(name="cam5_street", loc=(1.75, -7.0, 6.0), tgt=(1.75, 0.0, 6.6), lens=28),
        dict(name="closeup_stairhead", loc=(0.75, 3.30, ST_HEAD + 1.55), tgt=(2.45, 0.55, ST_HEAD - 0.25), lens=20),
        dict(name="cam7_trimmers", loc=(0.55, 1.95, z_[62] + 1.55), tgt=(2.45, 2.75, ST_HEAD - 0.35), lens=16),
        dict(name="cam8_arrival", loc=(1.15, 0.45, z_[69] + 1.62), tgt=(3.55, 1.6, ST_HEAD + 1.0), lens=20),
    ]
    if dream:
        c.cams.append(dict(name="cam6_impossible", loc=(3.0, 2.9, ST_HEAD + 1.2), tgt=(1.0, 1.0, ST_H - 1.0), lens=18))
    return c


# ======================================================================================================================
# ROOM 3 - LIFT LANDING + WIRE-MESH CAGE CAR  (INTERFACE.md `lift_landing_roof`: x -2.20..2.20, y -2.20..2.20, z 15.15..18.20)
#   Cell frame: x,y 0..4.4, z 0..3.05 (cell = world + (2.2, 2.2, -15.15)); well half-size 0.742 (INTERFACE, from v4 LIFT) at the centre,
#   car floor at z 0.  T: elevator from the roof garden to the tower top (fr.268, S7 1913 album); S7 (reference answer, secondary):
#   German Siemens make, 金網張り (wire-mesh) cage, stairs to the roof garden then change to the lift; fare 2 sen (secondary).
#   A: scissor (pantograph) gate, latch, floor dial, lever, control rope are period-typical assumptions of the mechanism; the enclosure
#   (iron-framed glazed pavilion with a skylight) is assumed.  The garden side (south, y=0) is an open arch.
#   Story: the operator left the gate half-drawn and the car standing with a dropped bouquet on its floor; the dial needle rests at
#   "down".  Over-abundance: potted flowers (roof-garden 四時の花卉) on every pier and sill.
#   Light: skylight + side glazing; the wire mesh throws a diamond lattice of shadow across the encaustic floor.
# ======================================================================================================================
LF = 3.9          # clear plan (INTERFACE bounds 4.4 incl. 0.25 m walls)
LH = 3.05
WELL = 0.742
CAR_HW = 0.66            # half width of the car footprint


def wire(c, p0, p1, r=0.0013, mat="wire"):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    if d.length < 1e-6:
        return
    q = d.to_track_quat("Z", "Y")
    with c.at(m=Matrix.Translation(p0) @ q.to_matrix().to_4x4()):
        cyl(c, mat, r, d.length, 4, cap=False, smooth=False)


def _clip(p, d, w, h):
    t0, t1 = -1e9, 1e9
    for k, (lo, hi) in enumerate(((0.0, w), (0.0, h))):
        if abs(d[k]) < 1e-9:
            if p[k] < lo or p[k] > hi:
                return None
        else:
            a, b = (lo - p[k]) / d[k], (hi - p[k]) / d[k]
            if a > b:
                a, b = b, a
            t0, t1 = max(t0, a), min(t1, b)
    if t0 >= t1:
        return None
    return (p[0] + d[0] * t0, p[1] + d[1] * t0), (p[0] + d[0] * t1, p[1] + d[1] * t1)


def mesh_panel(c, w, h, pitch=0.055, slope=1.35, r=0.0013):
    """Woven diamond wire mesh in the local XZ plane (y = 0 mid-plane), size w x h.  Two crossing wire families offset +/- r in y."""
    for fam, sg in ((0, 1), (1, -1)):
        n = int((w + h / slope) / pitch) + 2
        for i in range(-n, n):
            x0 = i * pitch
            p = (x0, 0.0) if sg > 0 else (x0, 0.0)
            d = (1.0, slope * sg) if sg > 0 else (1.0, -slope)
            base = (x0 - (0 if sg > 0 else -h / slope), 0.0) if False else None
            if sg > 0:
                seg = _clip((x0, 0.0), (1.0, slope), w, h)
            else:
                seg = _clip((x0 + h / slope, 0.0), (1.0, -slope), w, h)
            if seg is None:
                continue
            (xa, za), (xb, zb) = seg
            if math.hypot(xb - xa, zb - za) < 0.01:
                continue
            wire(c, (xa, (0.0016 if fam == 0 else -0.0016), za), (xb, (0.0016 if fam == 0 else -0.0016), zb), r)


def angle_post(c, x, y, z0, z1, s=0.045, t=0.006, mat="steel"):
    """L-section steel angle post."""
    box(c, mat, (x, y, z0), (x + s, y + t, z1), r=0.0015)
    box(c, mat, (x, y, z0), (x + t, y + s, z1), r=0.0015)


# ---- articulated scissor (lazy-tongs) gates, v1.2 ------------------------------------------------------------------
# Kinematics (Bostwick-type folding gate, A: period-typical): N+1 vertical channel pickets hang from rollers in a top track and are
# guided by tongues in a bottom channel.  Each lattice band is an independent lazy-tongs chain: at every picket an X of two flat
# straps (half-length l) crosses at a rivet on the picket; strap ends meet the neighbouring X's straps at end pins halfway between
# pickets.  Gate width W sets everything: picket pitch s = W / N, strap angle theta = acos(s / 2l), band half-height h = l sin theta.
# Layers (gate-local v, the lattice on the -v side): picket channel | 1 mm | back strap layer B | 1 mm | front strap layer A |
# rivet heads.  Same-layer straps are parallel with a perpendicular gap s sin(theta) - bar width >= 10 mm at the collapsed pitch.
# The latch is a gravity drop latch on the lead post whose notch drops over a stud on the strike side.
GATE_FPS, GATE_T = 30, 1.5
GATE_L = 0.29                       # strap half length (pin to pin 0.58 m)
GATE_SMIN = 0.032                   # collapsed picket pitch
GATE_BW, GATE_BT = 0.022, 0.005     # strap width, thickness
GV_PK = (-0.0115, 0.0065)           # picket channel depth range
GV_B = (-0.0175, -0.0125)           # back strap layer
GV_A = (-0.0235, -0.0185)           # front strap layer
GATE_RR = 0.013                     # roller radius
GATE_LATCH_LIFT = 35.0              # degrees


def _smoother(t):
    t = max(0.0, min(1.0, t))
    return t * t * t * (t * (6 * t - 15) + 10)


@contextmanager
def part_grp(c, name):
    """Switch the face group without applying a group offset (the enclosing group's transform already holds it)."""
    old = c.group
    c.group = name
    try:
        yield
    finally:
        c.group = old


def _stadium(xa, xb, r, n=5):
    pts = []
    for i in range(n + 1):
        a = -math.pi / 2 + math.pi * i / n
        pts.append((xb + r * math.cos(a), r * math.sin(a)))
    for i in range(n + 1):
        a = math.pi / 2 + math.pi * i / n
        pts.append((xa + r * math.cos(a), r * math.sin(a)))
    return pts


def _rivet(c, mat="brass_worn", r=0.0055):
    lathe(c, mat, [(0, 0), (r, 0), (r * 0.92, r * 0.35), (r * 0.6, r * 0.68), (0, r * 0.8)], 8, True)


class KinGate:
    """Build an articulated scissor gate in the current local frame (u = along the gate, v = depth, w = up), register its moving
    parts as separate groups with pivots, its rivet pivot empties, and the open / close clips.  Static parts (tracks, jamb picket,
    strike, keeper) go into the enclosing group."""

    def __init__(self, c, key, x0, wmax, wrest, ncell, bands, zb, zt, zlatch, handle_v, strike_post=False, name_pfx=None):
        self.c, self.key, self.x0, self.N = c, key, x0, ncell
        self.wmax, self.wmin, self.wrest = wmax, ncell * GATE_SMIN, wrest
        self.bands, self.zb, self.zt, self.zlatch, self.handle_v = bands, zb, zt, zlatch, handle_v
        self.zpk0, self.zpk1 = zb + 0.020, zt - 0.006          # picket body
        self.zax = zt + 0.004 + GATE_RR + 0.0005               # roller axle height
        self.Mg = c.st[-1].copy()
        self.M3 = self.Mg.to_3x3()
        u, v, w = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
        self.ax_rot = (self.M3 @ u).cross(self.M3 @ w).normalized()     # +angle maps +u toward +w
        self.ax_v = (self.M3 @ v).normalized()
        self.parts = {}
        self.build(strike_post)
        c.gates.append(self)

    # ---- kinematics ----
    def state(self, W):
        s = W / self.N
        th = math.acos(max(-1.0, min(1.0, s / (2 * GATE_L))))
        return s, th

    def x_i(self, i, W):
        return self.x0 + i * W / self.N

    def width_at(self, clip, t):
        a = _smoother((t - 0.2) / 1.15)
        W0, W1 = (self.wmax, self.wmin) if clip == "open" else (self.wmin, self.wmax)
        if clip == "close":
            a = _smoother((t - 0.0) / 1.15)
        return W0 + (W1 - W0) * a

    def latch_at(self, clip, t):
        if clip == "open":       # lift 0..0.2 s, drop 1.35..1.5 s
            up = _smoother(t / 0.2) if t < 0.2 else (1.0 - _smoother((t - 1.35) / 0.15) if t > 1.35 else 1.0)
        else:                    # lifted while the gate travels, drops onto the stud at the end
            up = _smoother(t / 0.15) if t < 0.15 else (1.0 - _smoother((t - 1.25) / 0.2) if t > 1.25 else 1.0)
        return up * GATE_LATCH_LIFT * D2R

    def cellp(self, u, v, w):
        return tuple(self.Mg @ Vector((u, v, w)))

    # ---- geometry ----
    def reg(self, g, pivot_local, kind, **kw):
        self.c.pivots[g] = self.cellp(*pivot_local)
        self.parts[g] = dict(kind=kind, pivot=pivot_local, **kw)

    def build(self, strike_post):
        c, N = self.c, self.N
        Wr = self.wrest
        s_r, th_r = self.state(Wr)
        # static: top track (C-channel open at the bottom), bottom channel, jamb picket with its bracket, strike + keeper stud
        ua, ub = self.x0 - 0.03, self.x0 + self.wmax + 0.05
        zt = self.zt
        for lo, hi in (((ua, -0.022, zt + 0.036), (ub, 0.016, zt + 0.040)), ((ua, -0.022, zt), (ub, -0.018, zt + 0.036)),
                       ((ua, 0.012, zt), (ub, 0.016, zt + 0.036)), ((ua, -0.022, zt), (ub, -0.007, zt + 0.004)),
                       ((ua, 0.001, zt), (ub, 0.016, zt + 0.004))):
            box(c, "steel", lo, hi, r=0.0008)
        for uu in (ua + 0.01, ub - 0.01):                      # end stops
            box(c, "steel", (uu - 0.004, -0.018, zt + 0.004), (uu + 0.004, 0.012, zt + 0.036), r=0.0008)
        zb = self.zb
        for lo, hi in (((ua, -0.012, zb), (ub, 0.006, zb + 0.003)), ((ua, -0.012, zb), (ub, -0.0065, zb + 0.016)),
                       ((ua, 0.0005, zb), (ub, 0.006, zb + 0.016))):
            box(c, "steel", lo, hi, r=0.0008)
        self.picket_mesh(self.x0, jamb=True)
        box(c, "steel", (self.x0 - 0.011, 0.0065, 0.9), (self.x0 + 0.011, 0.012, 1.1), r=0.001)          # fixing lug of the jamb
        xs = self.x0 + self.wmax + 0.017                      # strike face (2 mm clear of the closed lead post)
        if strike_post:
            for lo, hi in (((xs, -0.0115, zb + 0.020), (xs + 0.030, -0.0095, zt - 0.006)), ((xs, 0.0045, zb + 0.020), (xs + 0.030, 0.0065, zt - 0.006)),
                           ((xs + 0.028, -0.0115, zb + 0.020), (xs + 0.030, 0.0065, zt - 0.006))):
                box(c, "steel", lo, hi, r=0.0008)
            stud_v0 = 0.0065
        else:
            box(c, "steel", (xs, -0.010, self.zlatch - 0.07), (xs + 0.008, 0.005, self.zlatch + 0.03), r=0.001)       # keeper lug on the strike post
            stud_v0 = 0.005
        xstud = self.x0 + self.wmax + 0.021
        with c.at((xstud, stud_v0, self.zlatch - 0.004), rx=-90):
            cyl(c, "brass_worn", 0.004, 0.020 - stud_v0, 8, ch=0.0008)
        # moving pickets 1..N (N = lead post), rollers
        for i in range(1, N + 1):
            g = f"anim_{self.key}_pk{i}"
            xi = self.x_i(i, Wr)
            with part_grp(c, g):
                self.picket_mesh(xi, lead=(i == N))
            self.reg(g, (xi, 0.0, self.zpk0), "picket", i=i, pins={f"pin_b{b}_{i}c": (0.0, 0.0, zc - self.zpk0) for b, zc in enumerate(self.bands)})
            g = f"anim_{self.key}_rl{i}"
            with part_grp(c, g):
                for (va, vb) in ((-0.016, -0.007), (0.001, 0.010)):
                    with c.at(m=Matrix.Translation((xi, va, self.zax)) @ Matrix.Rotation(-math.pi / 2, 4, "X")):
                        lathe(c, "iron", [(0.004, 0.0), (GATE_RR - 0.0015, 0.0), (GATE_RR, 0.0015), (GATE_RR, vb - va - 0.0015),
                                          (GATE_RR - 0.0015, vb - va), (0.004, vb - va), (0.004, 0.0)], 10, False)
                    # a brass web mark on the outer face so the roll reads
                    with c.at((xi, (va if va < 0 else vb), self.zax)):
                        box(c, "brass", (-0.0012, -0.0005 if va < 0 else 0.0, 0.004), (0.0012, 0.0 if va < 0 else 0.0005, GATE_RR - 0.002), r=0)
            self.reg(g, (xi, 0.0, self.zax), "roller", i=i)
        # latch on the lead post
        xl = self.x_i(N, Wr)
        g = f"anim_{self.key}_latch"
        with part_grp(c, g):
            with c.at(m=Matrix.Translation((xl, 0.0085, self.zlatch)) @ Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))):
                # notch 0.008..0.027 over the stud (0.017..0.025): the left wall clears the stud on the lift arc
                extrude(c, "brass", [(-0.045, -0.010), (0.008, -0.010), (0.008, 0.006), (0.027, 0.006), (0.027, -0.010), (0.040, -0.010),
                                     (0.040, 0.012), (-0.045, 0.012)], (), depth=0.005)
            with c.at((xl - 0.040, 0.0195, self.zlatch + 0.001)):
                sphere(c, "brass", 0.006, 8, 5)                                        # thumb knob (behind the latch plate)
            with c.at((xl, 0.0135, self.zlatch), rx=-90):
                _rivet(c, "brass", 0.0045)
        self.reg(g, (xl, 0.0, self.zlatch), "latch")
        # lattice straps
        for b, zc in enumerate(self.bands):
            for i in range(0, N + 1):
                xi = self.x_i(i, Wr)
                for lay in ("A", "B"):
                    ph = th_r if lay == "A" else -th_r
                    xa, xb = (-GATE_L, GATE_L) if 0 < i < N else ((0.0, GATE_L) if i == 0 else (-GATE_L, 0.0))
                    g = f"anim_{self.key}_b{b}_{lay}{i}"
                    vr = GV_A if lay == "A" else GV_B
                    Mst = (Matrix.Translation((xi, 0.0, zc)) @
                           Matrix(((math.cos(ph), -math.sin(ph), 0, 0), (0, 0, 1, 0), (math.sin(ph), math.cos(ph), 0, 0), (0, 0, 0, 1))))
                    with part_grp(c, g):
                        with c.at(m=Mst):
                            extrude(c, "iron", _stadium(xa, xb, GATE_BW / 2), (), depth=vr[1] - vr[0], w0=vr[0])
                            if lay == "A":
                                for xr in sorted({xa, 0.0, xb}):
                                    with c.at((xr, 0.0, GV_A[0]), rx=180):
                                        _rivet(c)
                    self.reg(g, (xi, 0.0, zc), "strap", i=i, b=b, lay=lay, xa=xa, xb=xb)
                    # pivot empties at every rivet (on the A strap = the rivet carrier); B straps / pickets carry the matching
                    # local points as extras so the pin closure can be checked
                    dirr = (math.cos(ph), math.sin(ph))
                    pins = {}
                    for xr in sorted({xa, 0.0, xb}):
                        if xr == 0.0:
                            pn = f"pin_b{b}_{i}c"
                        elif lay == "A":
                            pn = f"pin_b{b}_{i}t" if xr > 0 else f"pin_b{b}_{i - 1}b"
                        else:
                            pn = f"pin_b{b}_{i}b" if xr > 0 else f"pin_b{b}_{i - 1}t"
                        pins[pn] = (xr * dirr[0], 0.0, xr * dirr[1])       # gate-local offset from the pivot at rest
                    self.parts[g]["pins"] = pins
        c.anims.setdefault("_gates", []).append(self.key)

    def picket_mesh(self, xi, jamb=False, lead=False):
        c = self.c
        hw = 0.015 if lead else 0.011
        z0, z1 = self.zpk0, self.zpk1
        box(c, "steel", (xi - hw, 0.0045, z0), (xi + hw, GV_PK[1], z1), r=0.0008)                      # web
        for (fa, fb) in ((xi - hw, xi - hw + 0.002), (xi + hw - 0.002, xi + hw)):                  # flanges
            box(c, "steel", (fa, GV_PK[0], z0), (fb, 0.0045, z1), r=0.0006)
        for zc in self.bands:                                                                         # centre rivet tails
            with c.at((xi, GV_PK[1], zc), rx=-90):
                _rivet(c, "steel", 0.0045)
        if jamb:
            return
        box(c, "steel", (xi - 0.008, -0.005, z1 - 0.004), (xi + 0.008, -0.001, self.zax + 0.004), r=0.0005)    # hanger stem
        with c.at(m=Matrix.Translation((xi, -0.016, self.zax)) @ Matrix.Rotation(-math.pi / 2, 4, "X")):
            cyl(c, "steel", 0.003, 0.026, 8, ch=0.0005)                                                 # roller axle
        box(c, "steel", (xi - 0.008, -0.0045, self.zb + 0.005), (xi + 0.008, -0.0015, z0 + 0.004), r=0.0005)   # guide tongue
        if lead:
            with c.at((xi, GV_PK[1], self.zlatch), rx=-90):
                cyl(c, "brass", 0.007, 0.0015, 10)                                                     # latch pivot boss
            hv = self.handle_v
            zh = (0.80, 1.40) if hv > 0 else (0.77, 1.47)
            v_from = GV_PK[1] if hv > 0 else GV_PK[0]
            for zz in zh:
                tube(c, "brass", (xi, v_from, zz), (xi, hv, zz), 0.006, 8)
            tube(c, "brass", (xi, hv, zh[0] - 0.02), (xi, hv, zh[1] + 0.02), 0.010, 10)                 # pull bar

    # ---- animation frames (cell space): {group: {clip: [(frame, loc, (axis, angle))]}} ----
    def frames(self):
        out = {}
        n = int(GATE_T * GATE_FPS)
        _, th_r = self.state(self.wrest)
        for clip in ("open", "close"):
            name = f"{self.key}_{clip}"
            for f in range(n + 1):
                t = f / GATE_FPS
                W = self.width_at(clip, t)
                _, th = self.state(W)
                for g, p in self.parts.items():
                    k = p["kind"]
                    if k in ("picket", "roller"):
                        xi = self.x_i(p["i"], W)
                        loc = self.cellp(xi, 0.0, self.zpk0 if k == "picket" else self.zax)
                        rot = (self.ax_v, (xi - self.x_i(p["i"], self.wrest)) / GATE_RR) if k == "roller" else (self.ax_v, 0.0)
                    elif k == "latch":
                        loc = self.cellp(self.x_i(self.N, W), 0.0, self.zlatch)
                        rot = (self.ax_rot, self.latch_at(clip, t))
                    else:
                        loc = self.cellp(self.x_i(p["i"], W), 0.0, self.bands[p["b"]])
                        ph, ph_r = (th, th_r) if p["lay"] == "A" else (-th, -th_r)
                        rot = (self.ax_rot, ph - ph_r)
                    out.setdefault(g, {}).setdefault(name, []).append((f, loc, rot))
        return out

    def pose(self, W, latch=0.0):
        """Static pose (cell space) for renders: {group: (loc, (axis, angle))}."""
        _, th = self.state(W)
        _, th_r = self.state(self.wrest)
        out = {}
        for g, p in self.parts.items():
            k = p["kind"]
            if k in ("picket", "roller"):
                xi = self.x_i(p["i"], W)
                out[g] = (self.cellp(xi, 0.0, self.zpk0 if k == "picket" else self.zax),
                          (self.ax_v, (xi - self.x_i(p["i"], self.wrest)) / GATE_RR if k == "roller" else 0.0))
            elif k == "latch":
                out[g] = (self.cellp(self.x_i(self.N, W), 0.0, self.zlatch), (self.ax_rot, latch))
            else:
                ph, ph_r = (th, th_r) if p["lay"] == "A" else (-th, -th_r)
                out[g] = (self.cellp(self.x_i(p["i"], W), 0.0, self.bands[p["b"]]), (self.ax_rot, ph - ph_r))
        return out


def cage_car(c, gate_open=0.45, dream=False):
    """Siemens-type wire-mesh cage car, footprint 2*CAR_HW square, 2.2 m tall, origin at the car floor centre.
    Open gate face = local -Y (toward the landing)."""
    hw, H = CAR_HW, 2.2
    # floor: planks with brass threshold, steel frame under
    with c.at((0, 0, -0.06)):
        box(c, "iron", (-hw, -hw, 0.0), (hw, hw, 0.06), r=0.003)
    box(c, "boards_dk", (-hw + 0.02, -hw + 0.02, 0.0), (hw - 0.02, hw - 0.02, 0.018), r=0.002)
    box(c, "brass", (-hw + 0.02, -hw - 0.005, 0.0), (hw - 0.02, -hw + 0.06, 0.024), r=0.002)              # threshold
    for i in range(6):
        box(c, "boards_dk", (-hw + 0.02, -hw + 0.18 + i * 0.19 - 0.0015, 0.018), (hw - 0.02, -hw + 0.18 + i * 0.19 + 0.0015, 0.0185), r=0)
    # corner posts (angle iron), top and bottom frames, waist rail with brass cap, kick plates
    for sx in (-1, 1):
        for sy in (-1, 1):
            angle_post(c, sx * hw - (0.045 if sx > 0 else 0), sy * hw - (0.045 if sy > 0 else 0), 0.0, H, 0.045)
    for z0, z1 in ((0.0, 0.14), (H - 0.06, H)):
        for sy in (-1, 1):
            box(c, "steel", (-hw, sy * hw - (0.02 if sy > 0 else 0), z0), (hw, sy * hw + (0.0 if sy > 0 else 0.02), z1), r=0.002)
        for sx in (-1, 1):
            box(c, "steel", (sx * hw - (0.02 if sx > 0 else 0), -hw, z0), (sx * hw + (0.0 if sx > 0 else 0.02), hw, z1), r=0.002)
    for sx in (-1, 1):
        box(c, "brass", (sx * hw - (0.028 if sx > 0 else 0.0), -hw, 0.94), (sx * hw + (0.0 if sx > 0 else 0.028), hw, 0.97), r=0.004)
    box(c, "brass", (-hw, hw - 0.028, 0.94), (hw, hw, 0.97), r=0.004)
    # wire-mesh panels: E, W, N sides + roof
    for (loc, rz) in (((-hw + 0.010, 0.0), 90), ((hw - 0.010, 0.0), 90)):
        with c.at((loc[0], -hw + 0.045, 0.14), rz=rz):
            mesh_panel(c, 2 * hw - 0.09, H - 0.20)
    with c.at((-hw + 0.045, hw - 0.012, 0.14)):
        mesh_panel(c, 2 * hw - 0.09, H - 0.20)
    with c.at((-hw + 0.045, -hw + 0.045, H - 0.06), rx=90):
        pass
    for j in range(0, 4):                                                    # roof: mesh in the XY plane at H
        pass
    with c.at(m=Matrix.Translation((-hw + 0.045, -hw + 0.045, H - 0.03)) @ Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))):
        mesh_panel(c, 2 * hw - 0.09, 2 * hw - 0.09)
    # front gate: articulated scissor gate (6 cells, 3 lattice bands) folding to the -x side; jamb at x -0.60, closed lead post at
    # x 0.59 with a drop latch over the keeper stud on the right front post; gate plane 55 mm inside the car front (clear of the frame)
    with c.at((0, -hw + 0.055, 0.0)):
        KinGate(c, "car_gate", x0=-0.60, wmax=1.19, wrest=max(6 * GATE_SMIN, 1.19 * gate_open), ncell=6, bands=(0.40, 1.07, 1.74),
                zb=0.024, zt=H - 0.13, zlatch=1.25, handle_v=0.05)
    # top gantry: rope sockets, safety-gear box, four hoist ropes going up out of the cell
    box(c, "steel", (-hw + 0.05, -0.10, H), (hw - 0.05, 0.10, H + 0.10), r=0.004)
    box(c, "brass_worn", (-0.16, -0.16, H + 0.10), (0.16, 0.16, H + 0.26), r=0.004)                 # safety-gear housing
    for sx in (-0.10, 0.10):
        for sy in (-0.06, 0.06):
            with c.at((sx, sy, H + 0.26)):
                cyl(c, "brass", 0.018, 0.05, 10, ch=0.004)
                wire(c, (0, 0, 0.05), (0, 0, 3.5 - (0.3 if dream else 0.0)), 0.0065, "iron")
    # inside: lamp in a wire guard, hand lever on a quadrant, control rope
    with c.at((0.0, 0.0, H - 0.06)):
        lathe(c, "lamp_milk", [(0.03, 0), (0.08, -0.05), (0.11, -0.14), (0.08, -0.22), (0.04, -0.24)], 12, True)
        with c.at((0, 0, -0.10)):
            sphere(c, "bulb", 0.03, 8, 5)
        for a in range(0, 360, 45):
            wire(c, (0.105 * math.cos(a * D2R), 0.105 * math.sin(a * D2R), -0.14), (0.04 * math.cos(a * D2R), 0.04 * math.sin(a * D2R), 0.0), 0.0012)
    c.light("point", "carlamp_" + ("d" if dream else "b"), (0.0, 0.0, H - 0.20), color=(255, 210, 150), watt=20, size=0.05)
    with c.at((hw - 0.055, 0.30, 1.05), rz=90):                            # lever quadrant on the east side
        box(c, "brass", (-0.10, 0, -0.10), (0.10, 0.008, 0.10), r=0.003)
        for a in range(-40, 41, 10):
            with c.at((0, 0.008, 0.0), ry=a):
                box(c, "iron", (0.055, 0, -0.0015), (0.09, 0.002, 0.0015), r=0)
        with c.at((0, 0.008, 0.0), ry=-8):
            tube(c, "iron", (0, 0.0, 0), (0.14 * 0, 0.0, 0.0), 0.005, 4)
            with c.at((0, 0, 0)):
                with c.at(rx=-90):
                    tube(c, "steel", (0, 0, 0), (0.0, 0.0, 0.12), 0.007, 8)
                    with c.at((0, 0, 0.12)):
                        sphere(c, "teak", 0.016, 8, 5)
    for x_ in (-0.2, 0.05):                                                # control rope loop through eyelets
        with c.at((x_, 0.0, H - 0.02)):
            cyl(c, "brass", 0.012, 0.012, 8, ch=0.002)
        wire(c, (x_, 0.0, H - 0.02), (x_ + 0.02, hw - 0.14, 0.7), 0.004, "rubber")
    with c.at((0.25, hw - 0.14, 0.7)):
        sphere(c, "teak", 0.02, 8, 5)


def landing_dial(c, needle=-38.0):
    """Floor-indicator dial over the landing gate: brass bezel, cream face (digits 1-3 fictional), glass, needle (anim node), bracket."""
    with c.at(rx=90):
        cyl(c, "brass", 0.16, 0.05, 32, ch=0.006)
        with c.at((0, 0, 0.0505)):
            decal(c, "dial", 0.30, 0.30)
        with c.at((0, 0, 0.052)):
            cyl(c, "glass", 0.15, 0.003, 28)
    with c.grp("anim_dial_needle"):
        c.pivots["anim_dial_needle"] = c.P((0.0, -0.058, 0.0))
        with c.at((0.0, -0.056, 0.0), rx=90, rz=needle):
            extrude(c, "paint_red", [(-0.008, -0.03), (0.008, -0.03), (0.003, 0.125), (-0.003, 0.125)], (), depth=0.002)
            extrude(c, "paint_red", [(-0.012, -0.05), (0.012, -0.05), (0.012, -0.03), (-0.012, -0.03)], (), depth=0.002)
    with c.at((0.0, -0.058, 0.0), rx=90):
        sphere(c, "brass", 0.011, 8, 5)


def call_plate(c):
    """Brass call plate: engraved rectangle, raised push button in a ring groove, a red jewel lamp; wall = XZ plane facing -Y (local +Z out)."""
    box(c, "brass", (-0.05, -0.09, 0.0), (0.05, 0.09, 0.006), r=0.002)
    for sy in (-0.075, 0.075):
        screw(c, 0, sy, 0.006, "z", 0.0032, "brass_worn")
    with c.at((0, 0.03, 0.006)):
        cyl(c, "paint_dark", 0.024, 0.0015, 20)
        cyl(c, "brass_worn", 0.021, 0.0028, 20, ch=0.0006)
        lathe(c, "porcelain", [(0, 0.0028), (0.015, 0.0028), (0.015, 0.0065), (0.012, 0.0085), (0, 0.009)], 20, True)       # raised button
    with c.at((0, -0.045, 0.006)):
        sphere(c, "paint_red", 0.011, 10, 6)


def bench_short(c):
    bench(c, 1.2, True, "oak")


def build_lift(dream=False):
    c = Cell("lift_dream" if dream else "lift", dream)
    c.lod = 1
    c.env = dict(exposure=0.7 if not dream else 1.1, sun_elev=58, sun_rot=210, sky=0.7, glare_thr=0.95)
    c.goff = {"*": (0.25, 0.25, 0)}
    CXB = 2.2
    sun_dir = Vector((0.35, 0.42, -0.84)).normalized()
    c.light("sun", "sun", Vector((2.2, 2.2, 0.0)) - sun_dir * 40, color=(255, 236, 205) if not dream else (255, 216, 196),
            watt=34.0, size=0.9, target=(2.2, 2.2, 0.0))
    c.light("area", "skyfill", (2.2, 2.2, LH + 0.6), color=(196, 214, 240), watt=90, size=(3.2, 3.2), target=(2.2, 2.2, 0.0), ref=True)
    t = 0.25
    cx = LF / 2
    car_lift = 0.45 if dream else 0.0
    # ---------- shell: floor, low walls, glazed iron upper walls, skylight ----------
    with c.grp("shell"):
        # encaustic floor (border + field) in 0.9 m repeating tile
        box(c, "encaustic", (-t, -t, -0.15), (LF + t, LF + t, -0.005), r=0)
        c.face([(0, 0, 0), (LF, 0, 0), (LF, LF, 0), (0, LF, 0)], "encaustic", uv=[(0, 0), (LF / 0.9, 0), (LF / 0.9, LF / 0.9), (0, LF / 0.9)])
        # low plaster wall 1.0 high on E, W, N; S wall with the garden arch
        wallYZ(c, "plaster", -t, LF + t, 0.0, 1.05, -t, 0.0)
        wallYZ(c, "plaster", -t, LF + t, 0.0, 1.05, LF, LF + t)
        wallXZ(c, "plaster", -t, LF + t, 0.0, 1.05, LF, LF + t)
        wallXZ(c, "plaster", -t, LF + t, 0.0, 3.05, -t, 0.0, holes=[arch_pts(0.75, 3.15, 2.0, 1.2, 16, 0.0), ])
        for (px, py) in ((-t, -t), (LF, -t), (-t, LF), (LF, LF)):
            box(c, "sandstone", (px, py, 0.0), (px + t, py + t, LH), r=0.008)
        # roof frame: perimeter beam and skylight with iron glazing bars
        box(c, "plaster_dk", (-t, -t, LH), (LF + t, LF + t, LH + 0.22), r=0.004)
        # skylight opening 3.4 x 3.4 with a 1.7 x 1.7 hole for the shaft (opening handled by the shaft posts passing through)
        for k in range(0, 8):
            xk = 0.5 + k * (LF - 1.0) / 7
            box(c, "iron", (xk - 0.012, 0.35, LH - 0.06), (xk + 0.012, LF - 0.35, LH), r=0.002)
            box(c, "iron", (0.35, xk - 0.012, LH - 0.06), (LF - 0.35, xk + 0.012, LH), r=0.002)
        for i in range(0, 8):
            for j in range(0, 8):
                xa, ya = 0.5 + i * (LF - 1.0) / 7, 0.5 + j * (LF - 1.0) / 7
                if abs(xa + (LF - 1.0) / 14 - cx) < 0.9 and abs(ya + (LF - 1.0) / 14 - cx) < 0.9:
                    continue
                box(c, "glass", (xa + 0.02, ya + 0.02, LH - 0.03), (xa + (LF - 1.0) / 7 - 0.02, ya + (LF - 1.0) / 7 - 0.02, LH - 0.026), r=0)
        box(c, "plaster_ceil", (0.0, 0.0, LH - 0.03), (LF, 0.35, LH), r=0)
        box(c, "plaster_ceil", (0.0, LF - 0.35, LH - 0.03), (LF, LF, LH), r=0)
        box(c, "plaster_ceil", (0.0, 0.0, LH - 0.03), (0.35, LF, LH), r=0)
        box(c, "plaster_ceil", (LF - 0.35, 0.0, LH - 0.03), (LF, LF, LH), r=0)
        # cornice and skirting inside
        for (a, b, z0, z1) in ((0.06, 0.10, LH - 0.20, LH - 0.10), (0.06, 0.16, LH - 0.10, LH)):
            pass
    c.col.append([(0.25, 0.25, 0), (LF + 0.25, 0.25, 0), (LF + 0.25, LF + 0.25, 0), (0.25, LF + 0.25, 0)])
    with c.grp("ref_outside"):
        box(c, "sandstone", (-30, -30, -1.2), (30, 30, -0.16), r=0)                          # roof deck outside
        with c.at(m=M_XZ(-t - 0.02)):
            extrude(c, "sandstone", rect_pts(-t, -0.15, LF + t, LH + 0.22), [arch_pts(0.75, 3.15, 2.0, 1.2, 16, 0.0)], depth=0.02)
        box(c, "sandstone", (-t - 0.08, -t - 0.08, LH + 0.22), (LF + t + 0.08, LF + t + 0.08, LH + 0.32), r=0.01)
        for (bx, by) in ((-4.5, -3.0), (6.5, 4.0)):                                        # kerbs of the flower beds (T: 四時の花卉)
            box(c, "sandstone", (bx, by, -0.16), (bx + 2.6, by + 5.5, 0.19), r=0.01)
            box(c, "soil", (bx + 0.2, by + 0.2, 0.15), (bx + 2.4, by + 5.3, 0.21), r=0)
    # ---------- glazed iron upper walls (E, W, N) with muntins ----------
    with c.grp("glazing"):
        for (M_, sgn) in ((M_YZ(0.0), 1), (M_YZ(LF), -1)):
            with c.at(m=M_):
                for k in range(3):
                    u0 = 0.3 + k * 1.22
                    u1 = u0 + 1.12
                    for (v0, v1) in ((1.05, 2.9),):
                        box(c, "paint_green", (u0, v0, -0.03 if sgn > 0 else 0.0), (u1, v0 + 0.06, 0.03 if sgn > 0 else 0.03), r=0.003)
                        box(c, "paint_green", (u0, v1 - 0.06, -0.03 if sgn > 0 else 0.0), (u1, v1, 0.03), r=0.003)
                        for uu in (u0, u1 - 0.05):
                            box(c, "paint_green", (uu, v0, -0.03 if sgn > 0 else 0.0), (uu + 0.05, v1, 0.03), r=0.003)
                        for i in range(1, 4):
                            box(c, "paint_green", (u0 + i * 1.12 / 4 - 0.011, v0, -0.01 if sgn > 0 else 0.0), (u0 + i * 1.12 / 4 + 0.011, v1, 0.02), r=0.002)
                        for j in range(1, 4):
                            zz = v0 + j * (v1 - v0) / 4
                            box(c, "paint_green", (u0, zz - 0.011, -0.01 if sgn > 0 else 0.0), (u1, zz + 0.011, 0.02), r=0.002)
                        box(c, "glass", (u0 + 0.05, v0 + 0.06, -0.004), (u1 - 0.05, v1 - 0.06, 0.004), r=0)
        with c.at(m=M_XZ(LF)):
            for k in range(3):
                u0 = 0.3 + k * 1.22
                u1 = u0 + 1.12
                box(c, "paint_green", (u0, 1.05, -0.03), (u1, 1.11, 0.0), r=0.003)
                box(c, "paint_green", (u0, 2.84, -0.03), (u1, 2.9, 0.0), r=0.003)
                for uu in (u0, u1 - 0.05):
                    box(c, "paint_green", (uu, 1.05, -0.03), (uu + 0.05, 2.9, 0.0), r=0.003)
                for i in range(1, 4):
                    box(c, "paint_green", (u0 + i * 1.12 / 4 - 0.011, 1.05, -0.02), (u0 + i * 1.12 / 4 + 0.011, 2.9, 0.0), r=0.002)
                for j in range(1, 4):
                    zz = 1.05 + j * 1.85 / 4
                    box(c, "paint_green", (u0, zz - 0.011, -0.02), (u1, zz + 0.011, 0.0), r=0.002)
                box(c, "glass", (u0 + 0.05, 1.11, -0.004), (u1 - 0.05, 2.84, 0.004), r=0)
    # ---------- the well: steel posts, ties, guide rails, counterweight ----------
    with c.grp("shaft"):
        wx0, wx1 = cx - WELL, cx + WELL
        for (px, py) in ((wx0, wx0), (wx1 - 0.045, wx0), (wx0, wx1 - 0.045), (wx1 - 0.045, wx1 - 0.045)):
            angle_post(c, px, py, -0.15, LH + 1.6, 0.07, 0.008)
        for zz in (0.35, 1.1, 1.85, 2.6, 3.35):
            for (a, b) in (((wx0, wx0), (wx1, wx0)), ((wx0, wx0), (wx0, wx1)), ((wx1, wx0), (wx1, wx1)), ((wx0, wx1), (wx1, wx1))):
                if (a[1] == wx0 and b[1] == wx0):
                    continue                                                                # south face open at the landing
                box(c, "steel", (min(a[0], b[0]), min(a[1], b[1]), zz), (max(a[0], b[0]) + 0.008, max(a[1], b[1]) + 0.008, zz + 0.05), r=0.002)
        for x_ in (wx0 + 0.09, wx1 - 0.09):                                                   # T-section guide rails
            box(c, "steel", (x_ - 0.02, cx - 0.04, -0.15), (x_ + 0.02, cx + 0.04, LH + 1.6), r=0.002)
            box(c, "steel", (x_ - 0.006, cx - 0.04, -0.15), (x_ + 0.006, cx + 0.10, LH + 1.6), r=0.002)
            for zz in (0.5, 1.4, 2.3, 3.2):
                box(c, "iron", (x_ - 0.05, cx + 0.10, zz), (x_ + 0.05, wx1 - 0.02, zz + 0.03), r=0.002)   # rail brackets
        # counterweight frame behind the car with plate stack
        with c.at((cx, wx1 - 0.16, 0.9)):
            for i in range(8):
                box(c, "iron", (-0.25, -0.06, i * 0.14), (0.25, 0.06, i * 0.14 + 0.12), r=0.004)
            for sx in (-0.26, 0.26):
                box(c, "steel", (sx - 0.01, -0.07, -0.05), (sx + 0.01, 0.07, 1.2), r=0.002)
        # cast overhead bracket + sheave beam above the roof (only rope tails visible in this cell)
    # ---------- the car + gate + dial ----------
    with c.grp("car"):
        with c.at((cx, cx, car_lift)):
            cage_car(c, 0.45, dream)
    with c.grp("landing_gate"):
        # outer landing gate: articulated, 7 cells, folded open to the west side; strike post with the keeper stud on the east side
        with c.at((0.0, cx - WELL - 0.03, 0.0)):
            KinGate(c, "landing_gate", x0=cx - WELL + 0.02, wmax=1.415, wrest=0.26, ncell=7, bands=(0.42, 1.12, 1.82),
                    zb=0.0, zt=2.27, zlatch=1.30, handle_v=-0.06, strike_post=True)
    with c.grp("dial"):
        with c.at((cx, cx - WELL - 0.06, 2.62)):
            landing_dial(c)
        with c.at((cx + WELL + 0.28, cx - WELL - 0.10, 1.35), rx=90):
            call_plate(c)
    # ---------- wall dressing ----------
    with c.grp("walls"):
        for (M_, sgn) in ((M_YZ(0.0), 1), (M_YZ(LF), -1), (M_XZ(LF), -1)):
            with c.at(m=M_):
                box(c, "sandstone", (0.0, 0.0, 0.0 if sgn > 0 else -0.06), (LF, 0.75, 0.05 if sgn > 0 else 0.0), r=0.005)
                box(c, "sandstone", (0.0, 0.75, -0.02 if sgn < 0 else 0.0), (LF, 0.81, 0.06 if sgn > 0 else 0.02), r=0.005) if False else None
                box(c, "paint_cream", (0.0, 1.0, -0.05 if sgn < 0 else 0.0), (LF, 1.05, 0.05 if sgn > 0 else 0.0), r=0.004)
        field(c, M_XZ(LF), -1, 0.3, 1.2, 0.15, 0.95, fw=0.03)
        field(c, M_XZ(LF), -1, 2.7, 3.6, 0.15, 0.95, fw=0.03)
        # fare plate (enamel, fictional digits) and notice on the pier by the arch
        with c.at((0.12, 0.55, 1.5), rz=90):
            box(c, "paint_dark", (-0.18, 0, 0), (0.18, 0.012, 0.26), r=0.003)
            with c.at((0, 0.0125, 0.13), rx=90):
                c.face([(-0.16, -0.11, 0), (0.16, -0.11, 0), (0.16, 0.11, 0), (-0.16, 0.11, 0)], "fareboard",
                       uv=[(0.0, 0.62), (0.5, 0.62), (0.5, 0.82), (0.0, 0.82)], flip=True)
        for (px, py, ang) in ((0.30, 0.30, 45), (LF - 0.30, 0.30, 135)):
            with c.at((px, py, 2.4), rz=ang - 90):
                sconce(c, real_light=True, name="sc_l%d" % ang, watt=18)
        with c.at(m=M_YZ(0.0)):
            panel(c, "dirt", 0.4, 4.0, 0.0, 1.0, w=0.0025)
    # ---------- benches, flowers everywhere (over-abundance), story bits ----------
    with c.grp("props"):
        with c.at((0.34, cx, 0.0), rz=90):
            bench(c, 1.3, True)
        with c.at((LF - 0.34, cx, 0.0), rz=-90):
            bench(c, 1.3, True)
        n_fl = 16 if not dream else 30
        for i in range(n_fl):
            ang = i / n_fl * 6.283
            px = cx + 1.85 * math.cos(ang) * 1.0
            py = cx + 1.85 * math.sin(ang) * 1.0
            px, py = max(0.35, min(LF - 0.35, px)), max(0.35, min(LF - 0.35, py))
            if py < 0.9 and 1.0 < px < 3.4:
                continue
            with c.at((px, py, 0.0), rz=RNG.uniform(0, 360)):
                lathe(c, "terracotta", [(0.0, 0), (0.09, 0), (0.12, 0.22), (0.13, 0.24), (0.115, 0.24), (0.0, 0.22)], 12, True)
                for k in range(6 if not dream else 10):
                    with c.at((RNG.uniform(-0.05, 0.05), RNG.uniform(-0.05, 0.05), 0.22), rz=RNG.uniform(0, 360), ry=RNG.uniform(0, 30)):
                        pole_flower(c, RNG.choice(("petal_a", "petal_b", "petal_c")), 6, RNG.uniform(0.03, 0.045), RNG.uniform(0.25, 0.45))
        # sills: hanging baskets on the south arch (pots on the sill line)
        for k in range(9):
            with c.at((1.15 + k * 0.28, 0.12, 0.0)):
                lathe(c, "terracotta", [(0.0, 0), (0.07, 0), (0.09, 0.15), (0.095, 0.16), (0.085, 0.16), (0.0, 0.15)], 10, True)
                for kk in range(4):
                    with c.at((RNG.uniform(-0.03, 0.03), RNG.uniform(-0.03, 0.03), 0.15), rz=RNG.uniform(0, 360), ry=RNG.uniform(0, 35)):
                        pole_flower(c, RNG.choice(("petal_a", "petal_b", "petal_c")), 5, 0.03, RNG.uniform(0.15, 0.3))
        # implied event: a dropped bouquet on the car floor + scattered petals
        with c.at((cx - 0.22, cx - 0.10, car_lift + 0.02), rz=25):
            for k in range(10):
                with c.at((RNG.uniform(-0.05, 0.05), RNG.uniform(-0.05, 0.05), 0.0), rz=RNG.uniform(0, 360), ry=90 + RNG.uniform(-10, 10)):
                    pole_flower(c, RNG.choice(("petal_a", "petal_b", "petal_c")), 6, RNG.uniform(0.03, 0.045), RNG.uniform(0.35, 0.5))
        for k in range(24 if not dream else 90):
            with c.at((cx + RNG.uniform(-0.55, 0.55), cx + RNG.uniform(-0.55, 0.55), car_lift + 0.025), rz=RNG.uniform(0, 360)):
                decal(c, "petal_a" if k % 3 else "petal_b", RNG.uniform(0.03, 0.06), RNG.uniform(0.02, 0.04))
        for k in range(10 if not dream else 40):
            with c.at((RNG.uniform(0.5, LF - 0.5), RNG.uniform(0.6, 1.6), 0.002), rz=RNG.uniform(0, 360)):
                decal(c, "petal_c" if k % 2 else "petal_a", RNG.uniform(0.03, 0.06), RNG.uniform(0.02, 0.04))
        with c.at((3.3, 3.0, 0.0), rz=RNG.uniform(0, 360)):
            potted_plant(c, 1.0, leaf_n=12)
        # dirt / boot marks on the tile
        for k in range(10):
            with c.at((RNG.uniform(0.5, LF - 0.5), RNG.uniform(0.3, 1.8), 0.0015), rz=RNG.uniform(0, 360)):
                decal(c, "dirt", RNG.uniform(0.4, 0.9), RNG.uniform(0.25, 0.5))
    if dream:
        with c.grp("dream"):
            with c.at((cx, cx, 0.001)):                                        # a shallow pool under the hovering car (water 180-190 deg)
                for k in range(6):
                    pass
                box(c, "water", (-0.95, -WELL + 0.03, 0.0), (0.95, 0.95, 0.012), r=0.006)       # stops inside the well, behind the landing gate track
    c.cams = [
        dict(name="cam1_axis", loc=(CXB + 0.05, 0.85, 1.35), tgt=(CXB, CXB + 0.3, 1.15), lens=20),
        dict(name="cam2_corner", loc=(0.7, 0.85, 1.55), tgt=(3.15, 3.15, 1.0), lens=20),
        dict(name="cam3_ceiling", loc=(CXB, 0.95, 1.2), tgt=(CXB + 0.05, 3.15, LH - 0.1), lens=18),
        dict(name="cam4_window", loc=(1.15, 3.95, 1.4), tgt=(3.85, 1.05, 1.2), lens=22),
        dict(name="cam5_garden", loc=(CXB, -5.5, 1.6), tgt=(CXB, 1.65, 1.3), lens=24),
        dict(name="closeup_gate_mechanism", loc=(CXB + 0.35, CXB - 1.30, 1.22), tgt=(CXB - 0.10, CXB - CAR_HW + 0.02, 0.98), lens=38),
    ]
    if dream:
        c.cams.append(dict(name="cam6_impossible", loc=(CXB + 0.35, 1.2, 0.22), tgt=(CXB, CXB, 0.65), lens=22))
    return c


# ======================================================================================================================
# ROOM 4 - CINEMA IN THE WEST TOWER WING  (INTERFACE.md `cinema_W1`: world x -50.8..-14.95, y -8.55..8.55, z 0.15..9.0)
#   T: 「脚側左右に翼を張ること各四十有餘間、右にありては二棟左にありては三棟の大活動寫眞館」 (fr.267); fronts open on the
#   Luna-Park-mae street (fr.270).  Two halls in the west wing (INTERFACE reads 'right' as west).  A: everything inside is assumed.
#   Cell frame: x 0..35.85 from the tower end (entrance foyer, door_wing_W at x=0, y=8.55) to the screen at the far end, y 0..17.1,
#   z 0..8.85 (cell = R180(world - (-14.95, 8.55, 0.15)): cell_x = -14.95 - X, cell_y = 8.55 - Y, cell_z = Z - 0.15).
#   Layout: foyer 0..3.4 (projection booth on top, z 3.9..7.1), auditorium 3.4..31, orchestra pit + benshi dais, stage + screen 31.6..35.85.
#   Story: the film is running in an empty house - the projectionist stepped out mid-reel: the take-up reel is still turning, the
#   carbon arc burns, a cup of tea on the benshi's dais is still steaming-warm.  Over-abundance: film cans and reels (foyer shelves,
#   booth racks).  Hero: the projector (lamp house with carbon arc, sprockets, reels, film path, hand crank, shutter).
#   (+) unverified: projector drop-shutter with fusible link, wall telephone, fire buckets, electric fans.
# ======================================================================================================================
CL, CW, CH = 35.85, 17.1, 8.85
BX0, BX1 = 0.0, 3.4            # foyer / booth footprint in x
SCREEN_X = 35.3
BY = CW / 2


def rev_reel_flange(c, r, mat="steel"):
    """Reel flange with 5 lightening holes, in the local XY plane (thickness 2 mm)."""
    outer = [(r * math.cos(a * D2R), r * math.sin(a * D2R)) for a in range(0, 360, 15)]
    holes = []
    for k in range(5):
        a0 = k * 72 + 36
        hole = [(r * 0.56 + r * 0.22 * math.cos(b * D2R) * 1.0, 0) for b in range(0, 360, 60)]
        cxh, cyh = r * 0.56 * math.cos(a0 * D2R), r * 0.56 * math.sin(a0 * D2R)
        holes.append([(cxh + r * 0.22 * math.cos(b * D2R), cyh + r * 0.22 * math.sin(b * D2R)) for b in range(0, 360, 60)])
    extrude(c, mat, outer, holes, depth=0.002)


def reel(c, r=0.18, w=0.04, film=True):
    """Film reel: two perforated steel flanges, hub with a keyed bore, wound celluloid; axis local Z."""
    with c.at((0, 0, 0)):
        rev_reel_flange(c, r)
    with c.at((0, 0, w)):
        rev_reel_flange(c, r)
    cyl(c, "steel", 0.032, w + 0.002, 16, ch=0.002)
    cyl(c, "iron", 0.010, w + 0.008, 8, z0=-0.004)
    box(c, "iron", (-0.004, 0.008, -0.002), (0.004, 0.014, w + 0.004), r=0)                       # keyway
    if film:
        rr = r * 0.88
        lathe(c, "celluloid", [(0.034, 0.004), (rr, 0.004), (rr, w - 0.002), (0.034, w - 0.002)], 28, True)
    with c.at((r * 0.7, 0.0, w + 0.002)):
        box(c, "paper_ticket", (-0.03, -0.012, 0), (0.03, 0.012, 0.001), r=0)                     # blank tag


def sprocket(c, r=0.03, w=0.03, teeth=14):
    cyl(c, "steel", r, w, 18, ch=0.002)
    for i in range(teeth):
        with c.at((0, 0, w / 2), rz=i * 360 / teeth):
            box(c, "steel", (r - 0.001, -0.0025, -w * 0.3), (r + 0.006, 0.0025, w * 0.3), r=0.0008)


def film_ribbon(c, pts, w=0.035):
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        c.face([(a[0], a[1] - w / 2, a[2]), (a[0], a[1] + w / 2, a[2]), (b[0], b[1] + w / 2, b[2]), (b[0], b[1] - w / 2, b[2])], "film",
               uv=[(0, 0), (1, 0), (1, 1), (0, 1)])


def handwheel(c, r=0.05, mat="iron"):
    cyl(c, mat, 0.012, 0.03, 10, ch=0.002)
    with c.at((0, 0, 0.02)):
        for a in range(0, 360, 60):
            with c.at(rz=a):
                tube(c, mat, (0.01, 0, 0), (r - 0.004, 0, 0), 0.004, 6)
        for i in range(24):
            a0, a1 = i * 15, (i + 1) * 15
            tube(c, mat, (r * math.cos(a0 * D2R), r * math.sin(a0 * D2R), 0), (r * math.cos(a1 * D2R), r * math.sin(a1 * D2R), 0), 0.005, 4)


def projector(c, tag="p"):
    """Hand-cranked carbon-arc projector on a table.  Local: lens toward +X, lateral Y, up Z, origin = floor below the gate.
    Parts: cast-iron table, head casting, film gate with pressure shoe, brass lens barrel with knurled focus ring, 2-blade shutter,
    crank + gear, upper/lower reels on arms, sprockets and idlers, film path ribbon, lamp house (arc, mica window, chimney,
    louvres, feed handwheels), resistance coil box and cable."""
    zt = 0.92
    # table: teak top, iron legs with cross-stretchers
    box(c, "teak", (-0.75, -0.30, zt - 0.05), (0.55, 0.30, zt), r=0.004)
    for sx in (-0.72, 0.52):
        for sy in (-0.27, 0.27):
            box(c, "iron", (sx - 0.025, sy - 0.025, 0.0), (sx + 0.025, sy + 0.025, zt - 0.05), r=0.004)
    for sy in (-0.27, 0.27):
        tube(c, "iron", (-0.72, sy, 0.22), (0.52, sy, 0.22), 0.012, 8)
    tube(c, "iron", (-0.72, -0.27, 0.22), (-0.72, 0.27, 0.22), 0.012, 8)
    tube(c, "iron", (0.52, -0.27, 0.22), (0.52, 0.27, 0.22), 0.012, 8)
    # head casting (dark green enamel) with bevels, front plate, gate door
    hx0, hx1 = -0.22, 0.20
    box(c, "paint_green", (hx0, -0.10, zt), (hx1, 0.10, zt + 0.46), r=0.008)
    box(c, "paint_green", (hx0 - 0.02, -0.12, zt + 0.42), (hx1 + 0.02, 0.12, zt + 0.50), r=0.006)
    box(c, "paint_green", (hx1 - 0.01, -0.13, zt + 0.06), (hx1 + 0.03, 0.13, zt + 0.40), r=0.006)        # front plate
    with c.at((hx1 + 0.03, 0.0, zt + 0.23)):
        box(c, "brass", (0, -0.055, -0.07), (0.012, 0.055, 0.07), r=0.002)                               # gate door (hinged, brass)
        box(c, "steel", (0.012, -0.03, -0.045), (0.022, 0.03, 0.045), r=0.002)                          # pressure shoe
        for zz in (-0.06, 0.06):
            with c.at((0.0, 0.055, zz), rx=0):
                cyl(c, "brass", 0.006, 0.014, 8, ch=0.001)                                              # hinge knuckles
        box(c, "brass_worn", (0.012, -0.065, -0.012), (0.03, -0.045, 0.012), r=0.001)                  # latch knob
    # lens barrel: stepped brass, focus rack ring knurled, front element glass
    with c.at((hx1 + 0.045, 0.0, zt + 0.23), ry=90):
        lathe(c, "brass", [(0.0, 0.0), (0.040, 0.0), (0.040, 0.06), (0.046, 0.065), (0.046, 0.15), (0.040, 0.155), (0.040, 0.20), (0.030, 0.205), (0.0, 0.205)], 24, True)
        with c.at((0, 0, 0.085)):
            for i in range(28):
                with c.at(rz=i * 360 / 28):
                    box(c, "brass_worn", (0.0455, -0.0015, 0.0), (0.050, 0.0015, 0.05), r=0.0003)
        with c.at((0, 0, 0.206)):
            cyl(c, "glass", 0.028, 0.003, 18)
    # shutter disc in front of the gate with two blades, driven from the crank axle
    with c.grp("anim_shutter_" + tag):
        c.pivots["anim_shutter_" + tag] = c.P((hx1 + 0.05, 0.085, zt + 0.23))
        with c.at((hx1 + 0.05, 0.085, zt + 0.23), ry=90):
            extrude(c, "brass", [(0.095 * math.cos(a * D2R), 0.095 * math.sin(a * D2R)) for a in range(0, 360, 12)],
                    [[(0.0, 0.0), (0.05 * math.cos(a * D2R), 0.05 * math.sin(a * D2R)), (0.05 * math.cos((a + 70) * D2R), 0.05 * math.sin((a + 70) * D2R))] for a in (20, 200)],
                    depth=0.003)
            cyl(c, "brass_worn", 0.012, 0.012, 10, z0=-0.006, ch=0.002)
    # crank side: gear train and handle
    with c.at((0.0, -0.10, zt + 0.25), rx=90):
        with c.at((0, 0, 0.0)):
            cyl(c, "brass", 0.055, 0.012, 24, ch=0.002)
            for i in range(24):
                with c.at(rz=i * 15):
                    box(c, "brass", (0.052, -0.004, 0.0), (0.062, 0.004, 0.012), r=0.0005)
        with c.at((0.085, 0.0, 0.0)):
            cyl(c, "brass", 0.027, 0.012, 16, ch=0.002)
            for i in range(12):
                with c.at(rz=i * 30):
                    box(c, "brass", (0.025, -0.003, 0.0), (0.032, 0.003, 0.012), r=0.0005)
    with c.grp("anim_crank_" + tag):
        c.pivots["anim_crank_" + tag] = c.P((0.0, -0.13, zt + 0.25))
        with c.at((0.0, -0.13, zt + 0.25), rx=90):
            cyl(c, "steel", 0.008, 0.06, 8, z0=0.0)
            with c.at((0, 0, 0.06), rz=-35):
                box(c, "steel", (-0.012, 0, -0.004), (0.012, 0.11, 0.008), r=0.002)
                with c.at((0, 0.11, 0)):
                    cyl(c, "teak", 0.014, 0.085, 12, ch=0.003)
    # sprockets, idler rollers, reels on arms, film path
    sp_u = (-0.02, 0.0, zt + 0.40)
    sp_l = (-0.02, 0.0, zt + 0.06)
    for (px, py, pz) in (sp_u, sp_l):
        with c.at((px, 0.135, pz), rx=90):
            sprocket(c)
    arm_u = (-0.40, 0.165, zt + 0.92)
    arm_l = (-0.40, 0.165, zt - 0.05)
    for (ax, ay, az) in (arm_u, arm_l):
        tube(c, "iron", (hx0 + 0.04, 0.12, az - 0.05 if az < zt else zt + 0.46), (ax, ay, az), 0.012, 8)
        tube(c, "iron", (ax, 0.12, az), (ax, 0.20, az), 0.011, 8)
    with c.grp("anim_reel_upper_" + tag):
        c.pivots["anim_reel_upper_" + tag] = c.P((arm_u[0], arm_u[1] + 0.03, arm_u[2]))
        with c.at((arm_u[0], arm_u[1] + 0.03, arm_u[2]), rx=-90):
            reel(c, 0.21, 0.044)
    with c.grp("anim_reel_lower_" + tag):
        c.pivots["anim_reel_lower_" + tag] = c.P((arm_l[0], arm_l[1] + 0.03, arm_l[2]))
        with c.at((arm_l[0], arm_l[1] + 0.03, arm_l[2]), rx=-90):
            reel(c, 0.15, 0.044)
    for (px, pz) in ((hx0 + 0.10, zt + 0.47), (hx0 - 0.03, zt + 0.15)):
        with c.at((px, 0.135, pz), rx=90):
            cyl(c, "steel", 0.014, 0.03, 10, ch=0.002)
    film_ribbon(c, [(-0.40, 0.205, zt + 0.92 - 0.20), (-0.30, 0.205, zt + 0.92 - 0.45), (-0.10, 0.205, zt + 0.47 + 0.02), (-0.02, 0.205, zt + 0.43),
                    (-0.02, 0.205, zt + 0.37), (0.02, 0.205, zt + 0.33), (0.045, 0.205, zt + 0.26), (0.045, 0.205, zt + 0.20), (0.02, 0.205, zt + 0.12),
                    (-0.02, 0.205, zt + 0.09), (-0.10, 0.205, zt - 0.02), (-0.30, 0.205, zt - 0.12), (-0.40, 0.205, zt - 0.05 - 0.15)], 0.032)
    # lamp house behind the head: horizontal iron drum with riveted bands, chimney, louvres, feed wheels, arc window
    lx0, lx1 = -0.70, -0.26
    with c.at((lx0, 0.0, zt + 0.25), ry=90):
        lathe(c, "iron", [(0.0, 0.0), (0.17, 0.0), (0.17, lx1 - lx0 - 0.0), (0.0, lx1 - lx0)], 28, True)
        for zz in (0.06, 0.20, 0.34):
            lathe(c, "steel", [(0.17, zz), (0.178, zz + 0.004), (0.178, zz + 0.02), (0.17, zz + 0.024)], 28, True)
            for i in range(18):
                with c.at((0, 0, zz + 0.012), rz=i * 20):
                    with c.at((0.178, 0, 0)):
                        sphere(c, "steel", 0.004, 4, 3)
    tube(c, "iron", (-0.52, 0.0, zt + 0.40), (-0.52, 0.0, zt + 0.95), 0.06, 14)                        # chimney
    with c.at((-0.52, 0.0, zt + 0.95)):
        cyl(c, "iron", 0.085, 0.03, 14, ch=0.004)
    for i in range(6):                                                                                   # louvres on the drum
        box(c, "paint_dark", (lx0 + 0.12 + i * 0.04, 0.165, zt + 0.32), (lx0 + 0.12 + i * 0.04 + 0.022, 0.176, zt + 0.40), r=0.0008)
    with c.at((-0.48, 0.18, zt + 0.25), rx=-90):                                                      # mica window with glowing arc
        cyl(c, "brass", 0.05, 0.012, 18, ch=0.002)
        with c.at((0, 0, 0.012)):
            cyl(c, "bulb", 0.038, 0.002, 16)
    c.light("point", "arc_" + tag, (-0.45, 0.24, zt + 0.25), color=(255, 240, 215), watt=180, size=0.05)
    for sy, z_ in ((-0.12, 0.0), (0.0, 0.0)):
        pass
    with c.at((lx0 - 0.0, -0.17, zt + 0.25), rx=90):                                                   # feed handwheels on the back end
        pass
    with c.at((lx0 + 0.02, 0.0, zt + 0.25), ry=-90):
        handwheel(c, 0.055)
    with c.at((lx0 + 0.02, 0.10, zt + 0.12), ry=-90):
        handwheel(c, 0.04)
    # carbon rods visible through the open back (two angled rods)
    tube(c, "celluloid", (-0.62, 0.0, zt + 0.25), (-0.40, 0.0, zt + 0.25 + 0.015), 0.006, 6)
    tube(c, "celluloid", (-0.62, 0.0, zt + 0.25 - 0.06), (-0.40, 0.0, zt + 0.25 - 0.01), 0.006, 6)
    # resistance coil box beside the table with porcelain insulators and a thick cable
    with c.at((-0.15, 0.55, 0.0)):
        box(c, "iron", (-0.30, -0.12, 0.0), (0.30, 0.12, 0.42), r=0.004)
        for i in range(7):
            with c.at((-0.24 + i * 0.08, 0.125, 0.0)):
                tube(c, "brass_worn", (0, 0, 0.10), (0, 0, 0.35), 0.014, 8)
                cyl(c, "porcelain", 0.020, 0.03, 10, z0=0.36, ch=0.003)
        tube(c, "rubber", (0.30, 0.0, 0.30), (0.62, -0.55, 0.30), 0.012, 6)
    tube(c, "rubber", (-0.40, 0.45, 0.30), (-0.62, 0.15, zt + 0.17), 0.010, 6)


def cinema_bench(c, L=4.5):
    bench(c, L, True, "oak")


def curtain_drape(c, x0, y0, w, h, folds=14, top_swag=0.55):
    """Stage curtain panel: pleated velvet, drawn to one side."""
    cols, rows = folds * 2, 10
    for r_ in range(rows):
        z0 = h * (1 - r_ / rows)
        z1 = h * (1 - (r_ + 1) / rows)
        for k in range(cols):
            a0, a1 = k / cols, (k + 1) / cols
            def pt(a, z):
                sc = 1.0 - 0.45 * (1 - z / h) ** 2            # gathers toward the bottom (tied back)
                return (x0 + 0.10 * math.sin(a * math.pi * folds) * 1.0 + 0.02 * (1 - z / h), y0 + w * a * sc, z)
            c.face([pt(a0, z0), pt(a1, z0), pt(a1, z1), pt(a0, z1)], "velvet", smooth=True)


def build_cinema(dream=False):
    c = Cell("cinema_dream" if dream else "cinema", dream)
    c.lod = 0
    L = 58.0 if dream else CL                       # dream: the house recedes much further (x1.6)
    nrows = 34 if dream else 25
    ST = 2 if dream else 1
    c.env = dict(exposure=1.8 if not dream else 2.1, sun_elev=30, sun_rot=30, sky=0.12, glare_thr=0.75, glare_mix=-0.4)
    cx = BY
    tw = 0.45
    zs = 1.0                                        # stage floor height
    sx = (SCREEN_X - CL + L) if dream else SCREEN_X
    screen_c = (sx, cx, 4.3)
    # lights: dim exit lamp, a sun shaft from the ajar south exit door, projector beam light, screen spill
    sun_dir = Vector((0.15, -0.88, -0.45)).normalized()
    c.light("sun", "sun", Vector((14.5 if not dream else 26.0, CW - 0.4, 0.8)) - sun_dir * 40, color=(255, 232, 196) if not dream else (255, 210, 190),
            watt=30.0, size=0.6, target=(14.5 if not dream else 26.0, CW - 0.4, 0.8))
    c.light("area", "screen_spill", (sx - 0.8, cx, 3.6), color=(235, 238, 255), watt=420, size=(6.0, 3.0), target=(sx - 12, cx, 1.6))
    c.light("area", "hall_fill", (L * 0.5, cx, CH - 0.6), color=(255, 226, 190), watt=160, size=(8.0, 6.0), target=(L * 0.5, cx, 0), ref=True)
    c.light("spot", "beam_spot", (2.9, cx, 5.0), color=(255, 240, 215), watt=1300, size=0.03, target=(sx - 0.3, cx, 3.0), spot=30)

    # ---------- shell ----------
    with c.grp("shell"):
        box(c, "boards_dk", (-tw, -tw, -0.3), (L + tw, CW + tw, -0.005), r=0)
        # floor: boards for aisles/foyer drawn as one grid of planks
        c.face([(0, 0, 0), (L, 0, 0), (L, CW, 0), (0, CW, 0)], "boards", uv=[(0, 0), (L, 0), (L, CW), (0, CW)])
        # side walls (long): south wall (y=CW) with the exit door ajar; north wall (y=0)
        door_x = 14.5 if not dream else 26.0
        wallXZ(c, "plaster", -tw, L + tw, -0.3, CH + 0.3, -tw, 0.0)
        wallXZ(c, "plaster", -tw, L + tw, -0.3, CH + 0.3, CW, CW + tw, holes=[rect_pts(door_x - 0.6, 0.0, door_x + 0.6, 2.5)])
        # end walls: entrance (x=0) with the door_wing_W opening (2.4 wide, head 3.25), far wall behind the stage
        with c.grp("ref_shell"):
            wallYZ(c, "plaster", -tw, CW + tw, -0.3, CH + 0.3, -tw, 0.0, holes=[rect_pts(cx - 1.2, 0.0, cx + 1.2, 3.25)])
        wallYZ(c, "plaster", -tw, CW + tw, -0.3, CH + 0.3, L, L + tw)
        # barrel-vault ceiling made of ribs + boards: arch from spring z=6.2 to crown CH
        for k in range(0, 1):
            pass
        box(c, "plaster_ceil", (-tw, -tw, CH), (L + tw, CW + tw, CH + 0.3), r=0)
    c.col.append([(0, 0, 0), (BX1 + 0.0, 0, 0), (BX1 + 0.0, CW, 0), (0, CW, 0)])
    c.col.append([(BX1, 0, 0), (sx - 4.5 + 0.0, 0, 0), (sx - 4.5, CW, 0), (BX1, CW, 0)])
    c.col.append([(sx - 3.8, 0, zs), (L, 0, zs), (L, CW, zs), (sx - 3.8, CW, zs)])
    with c.grp("ref_outside"):
        box(c, "sandstone", (-40, -40, -1.0), (L + 40, 60, -0.31), r=0)
        with c.at(m=M_XZ(CW + tw + 0.02)):
            extrude(c, "sandstone", rect_pts(-tw, 0, L + tw, 9.0), [rect_pts(door_x - 0.6, 0.0, door_x + 0.6, 2.5)], depth=0.02)
        # the passage side of the entrance (tower base) - a lit vestibule seen in cam5
        box(c, "plaster_dk", (-8.3, -tw, 0.0), (-8.0, CW + tw, 4.4), r=0)
        box(c, "stone_floor", (-8.3, -tw, -0.3), (-tw, CW + tw, -0.01), r=0)
        c.light("area", "vestibule_fill", (-2.0, cx, 2.6), color=(255, 226, 190), watt=25, size=(2.0, 2.0), target=(3.0, cx, 1.4), ref=True)

    # ---------- barrel vault ribs with iron tie-rods ----------
    with c.grp("vault"):
        nbay = int(L / 3.0)
        bay = L / nbay
        zsp, rise = 6.0, CH - 6.0
        rib_out = arch_pts(0.0, CW, zsp, rise, 26, 5.8)
        rib_in = arch_pts(0.14, CW - 0.14, zsp - 0.0, rise - 0.14, 26, 5.8)
        for i in range(nbay + 1):
            xk = i * bay
            with c.at(m=Matrix(((0, 0, 1, xk - 0.11), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))):
                extrude(c, "teak", rib_out, [rib_in] if False else (), depth=0.22) if False else None
                arch_ring(c, "teak", 0.0, CW, zsp, rise, 5.8, 0.0, 0.22, 0.0, n=26) if False else None
            # rib as a band: arch ring polygon built from two offset outlines
            with c.at(m=Matrix(((0, 0, 1, xk - 0.11), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))):
                outer = arch_pts(0.0, CW, zsp, rise, 26, 5.8)
                inner = arch_pts(0.28, CW - 0.28, zsp, rise - 0.28, 26, 5.8)
                pts = outer[1:-1] + inner[1:-1][::-1]
                extrude(c, "teak", pts, (), depth=0.22)
            # tie rod across at the springing with turnbuckle and brass sleeve
            tube(c, "iron", (xk, 0.05, zsp - 0.15), (xk, CW - 0.05, zsp - 0.15), 0.014, 8)
            with c.at((xk, cx, zsp - 0.15)):
                cyl(c, "brass", 0.028, 0.22, 10, ch=0.003, z0=-0.11) if False else None
            tube(c, "brass", (xk, cx - 0.14, zsp - 0.15), (xk, cx + 0.14, zsp - 0.15), 0.026, 10)
            # king post + hangers from the ribs (simple)
        for i in range(nbay):
            xm = (i + 0.5) * bay
            # ceiling boards between ribs: barrel surface quads (plaster soffit)
            nseg = 22
            for s in range(nseg):
                a0 = math.pi * s / nseg
                a1 = math.pi * (s + 1) / nseg
                def pp(a, x):
                    t = a / math.pi
                    # half ellipse above the spring line
                    yy = cx - cx * math.cos(a)
                    zz = zsp + rise * math.sin(a)
                    return (x, yy, zz)
                x0_, x1_ = i * bay + 0.11, (i + 1) * bay - 0.11
                c.face([pp(a0, x0_), pp(a0, x1_), pp(a1, x1_), pp(a1, x0_)], "plaster_ceil", flip=False)
        # vent roses in the crown of every 2nd bay
        for i in range(0, nbay, 2):
            with c.at(((i + 0.5) * bay, cx, CH - 0.02)):
                lathe(c, "brass", [(0.40, 0.0), (0.40, -0.03), (0.34, -0.05), (0.0, -0.07)], 24, True)
        # mid-bay secondary ribs, longitudinal battens and pendant globes over the aisles (dressing the plaster soffit)
        for i in range(nbay):
            xm = (i + 0.5) * bay
            with c.at(m=Matrix(((0, 0, 1, xm - 0.05), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))):
                outer = arch_pts(0.0, CW, zsp, rise, 26, 5.8)
                inner = arch_pts(0.16, CW - 0.16, zsp, rise - 0.16, 26, 5.8)
                extrude(c, "teak", outer[1:-1] + inner[1:-1][::-1], (), depth=0.10)
        for a_deg in (20, 45, 70, 90, 110, 135, 160):
            a_ = a_deg * D2R
            yy_, zz_ = cx - cx * math.cos(a_), zsp + rise * math.sin(a_)
            box(c, "teak", (0.0, yy_ - 0.05, zz_ - 0.07), (L, yy_ + 0.05, zz_ - 0.005), r=0.004)
        for i in range(0, nbay, ST):
            xm = (i + 0.5) * bay
            for yy_ in (cx - 3.4, cx + 3.4):
                a_ = math.acos((cx - yy_) / cx)
                zz_ = zsp + rise * math.sin(a_)
                with c.at((xm, yy_, zz_ - 0.02)):
                    pendant(c, 1.5, r=0.13, real_light=(i % 4 == 0), name="cin%d_%d" % (i, int(yy_)), watt=60)

    # ---------- walls: wainscot, pilasters, fields, brackets ----------
    with c.grp("walls"):
        nbay = int(L / 3.0)
        bay = L / nbay
        for (yy, sg) in ((0.0, 1), (CW, -1)):
            for i in range(nbay + 1):
                xk = i * bay
                if sg < 0 and abs(xk - door_x) < 1.0:
                    continue
                box(c, "plaster_dk", (xk - 0.18, yy if sg > 0 else yy - 0.20, 1.30), (xk + 0.18, yy + 0.20 if sg > 0 else yy, 5.6), r=0.006)
                box(c, "sandstone", (xk - 0.24, yy if sg > 0 else yy - 0.26, 5.6), (xk + 0.24, yy + 0.26 if sg > 0 else yy, 5.75), r=0.008)
                box(c, "sandstone", (xk - 0.24, yy if sg > 0 else yy - 0.26, 1.24), (xk + 0.24, yy + 0.26 if sg > 0 else yy, 1.30), r=0.008)
            # wainscot (oak panelled dado) to 1.3 m, skirting, dado rail
            box(c, "oak", (0.0, yy if sg > 0 else yy - 0.07, 0.0), (L, yy + 0.07 if sg > 0 else yy, 1.24), r=0.005)
            box(c, "teak", (0.0, yy if sg > 0 else yy - 0.09, 1.24), (L, yy + 0.09 if sg > 0 else yy, 1.30), r=0.005)
            for i in range(0, nbay, ST):
                xa, xb = i * bay + 0.40, (i + 1) * bay - 0.40
                with c.at(m=M_XZ(yy)):
                    if abs((xa + xb) / 2 - door_x) > 1.3 or sg > 0:
                        field(c, M_XZ(yy), sg, xa, xb, 1.55, 4.55, fw=0.05)
                # painted wainscot panels (tri-economical)
                with c.at(m=M_XZ(yy)):
                    box(c, "paint_cream", (xa, 0.25, -0.03 if sg < 0 else 0.0), (xb, 1.10, 0.0 if sg < 0 else 0.03), r=0.004)
        # wall brackets + fictional posters on the long walls (every other bay), dim lamps
        for i in range(0, nbay, ST):
            xm = (i + 0.5) * bay
            with c.at((xm, 0.07, 2.4), rz=0):
                sconce(c, real_light=(i % 3 == 0), name="s0_%d" % i, watt=10)
            if abs(xm - door_x) > 1.4:
                with c.at((xm, CW - 0.07, 2.4), rz=180):
                    sconce(c, real_light=(i % 3 == 1), name="s1_%d" % i, watt=10)
            if i % 2 == 1:
                with c.at((xm + bay * 0.25, 0.04, 2.0)):
                    poster(c, 0.7, 1.05, i % 8)
        # porcelain cleats wire runs along the vault springing both sides
        porcelain_cleat_run(c, (0.2, 0.30, 5.9), (L - 0.2, 0.30, 5.9))
        porcelain_cleat_run(c, (0.2, CW - 0.30, 5.9), (L - 0.2, CW - 0.30, 5.9))
        with c.at(m=M_XZ(0.0)):
            panel(c, "grime", 0.0, L, 4.6, 6.2, w=0.0025)
        with c.at(m=M_XZ(CW)):
            panel(c, "grime", 0.0, L, 4.6, 6.2, w=-0.0025, flip=True)
    # ---------- exit door (ajar) with sun; exit lamp ----------
    with c.grp("doors"):
        with c.at((door_x - 0.6, CW + 0.02, 0.0), rz=-60):
            door_leaf(c, 0.6, 2.5)
        with c.at((door_x + 0.6, CW + 0.02, 0.0), rz=-120 - 60):
            door_leaf(c, 0.6, 2.5)
        with c.at((door_x, CW - 0.08, 2.7)):
            box(c, "paint_dark", (-0.22, -0.04, 0), (0.22, 0.04, 0.22), r=0.004)
            box(c, "exit_lamp", (-0.19, -0.042, 0.02), (0.19, -0.03, 0.20), r=0.002)             # glowing pictogram panel (no text)
        # entrance doors at x=0 (opened onto the vestibule) + double swing doors into the auditorium at x=BX1
    with c.grp("ref_doors"):                                   # door_wing_W leaves belong to the exterior (INTERFACE v1.1); renders only
        with c.at((-0.03, cx - 1.2, 0.0), rz=90 + 75):
            door_leaf(c, 1.2, 3.25)
        with c.at((-0.03, cx + 1.2, 0.0), rz=-90 - 75):
            door_leaf(c, 1.2, 3.25)

    # ---------- foyer + projection booth ----------
    with c.grp("foyer"):
        # partition wall x=3.4 between foyer and the house: two doorways into the auditorium with baize doors standing ajar
        wallYZ(c, "plaster", 0.0, CW, 0.0, CH, BX1 - 0.25, BX1, holes=[rect_pts(cx - 3.3, 0.0, cx - 1.0, 2.6), rect_pts(cx + 1.0, 0.0, cx + 3.3, 2.6)])
        # booth: floor slab at 3.9, front wall (x 3.0..3.4) with ports, back, sides
        zb0, zb1 = 3.9, 7.1
        c.light("point", "booth_lamp", (1.6, cx, 6.7), color=(255, 214, 150), watt=90, size=0.1)
        c.light("point", "booth_lamp2", (2.4, cx - 1.4, 5.6), color=(255, 214, 150), watt=40, size=0.08)
        yb0, yb1 = cx - 2.8, cx + 2.8
        box(c, "boards", (0.0, yb0, zb0 - 0.22), (BX1, yb1, zb0), r=0.004)
        box(c, "plaster_dk", (0.0, yb0 - 0.2, zb0), (0.2, yb1 + 0.2, zb1), r=0.004)
        for yy in (yb0 - 0.2, yb1):
            box(c, "plaster_dk", (0.0, yy, zb0), (BX1, yy + 0.2, zb1), r=0.004)
        box(c, "plaster_dk", (0.0, yb0, zb1), (BX1, yb1, zb1 + 0.2), r=0.004)
        with c.at(m=M_YZ(BX1 - 0.3)):
            extrude(c, "plaster_dk", rect_pts(yb0 - 0.2, zb0, yb1 + 0.2, zb1), [rect_pts(cx - 0.38, 4.85, cx - 0.14, 5.05), rect_pts(cx + 0.14, 4.85, cx + 0.38, 5.05), rect_pts(cx + 1.4, 4.95, cx + 1.7, 5.2)], depth=0.3)
        # port glasses and drop shutters (+ fusible links)
        for yy in (cx - 0.26, cx + 0.26):
            box(c, "glass", (BX1 - 0.12, yy - 0.12, 4.85), (BX1 - 0.115, yy + 0.12, 5.05), r=0)
        # steel drop shutters held up by cord + fusible link (+ unverified)
        with c.grp("var_drop_shutters"):
            for yy in (cx - 0.26, cx + 0.26):
                with c.at((BX1 - 0.33, yy, 5.12)):
                    box(c, "steel", (-0.16, -0.012, 0.0), (0.16, 0.012, 0.36), r=0.002)
                    tube(c, "paint_dark", (0, -0.0, 0.36), (0.0, 0.0, 0.62), 0.0025, 4)
                    box(c, "brass_worn", (-0.012, -0.008, 0.62), (0.012, 0.008, 0.66), r=0.001)
        # projector on its table behind the first port, lens to the port
        with c.grp("projector"):
            with c.at((BX1 - 0.62 - 0.0, cx - 0.26, zb0)):
                projector(c, "p")
        # second (spare) projector: dust-sheeted table? a wire rewind bench with hand rewinder and cans
        with c.at((1.0, cx + 1.9, zb0)):
            box(c, "teak", (-0.45, -0.30, 0.78), (0.45, 0.30, 0.83), r=0.004)
            for sxx in (-0.4, 0.4):
                for syy in (-0.25, 0.25):
                    box(c, "iron", (sxx - 0.02, syy - 0.02, 0.0), (sxx + 0.02, syy + 0.02, 0.78), r=0.003)
            for sxx in (-0.25, 0.25):
                with c.at((sxx, 0.0, 0.83)):
                    cyl(c, "steel", 0.015, 0.14, 8, ch=0.002)
                    with c.at((0, 0, 0.04)):
                        reel(c, 0.16, 0.036)
            with c.at((0.0, 0.0, 0.83)):
                tube(c, "celluloid", (-0.25, 0.14, 0.04), (0.25, 0.14, 0.04), 0.0012, 4)
            with c.at((0.0, -0.36, 0.80)):
                tube(c, "steel", (0, 0, 0), (0, 0.08, 0), 0.008, 8)
                tube(c, "steel", (0, 0, 0), (0.0, 0.0, 0.14), 0.007, 8)
                with c.at((0, 0, 0.14)):
                    sphere(c, "teak", 0.016, 8, 5)
        # film cans: many, in stacks and on shelves in the booth (over-abundance)
        for k in range(10):
            with c.at((0.35 + (k % 2) * 0.05, cx - 2.3 + RNG.uniform(-0.05, 0.05), zb0 + 0.05 + (k // 2) * 0.055), rz=RNG.uniform(0, 30)):
                film_can(c, 0.17, 0.045)
        for k in range(10):
            with c.at((0.6 + RNG.uniform(0, 0.5), cx + 2.6 - RNG.uniform(0, 0.3), zb0 + 0.05 + (k // 3) * 0.055), rz=RNG.uniform(0, 360)):
                film_can(c, 0.17, 0.045)
        # wall rack of spare reels in the booth
        for row in range(3 if not dream else 2):
            for k in range(6 if not dream else 4):
                with c.at((0.22, yb0 + 0.3 + k * 0.42, zb0 + 1.0 + row * 0.42), ry=0):
                    with c.at(rx=0, ry=90):
                        reel(c, 0.17, 0.035, film=(k % 2 == 0))
        # knife switch panel (slate, raised copper blades) on the booth wall
        with c.at((0.21, yb1 - 0.6, zb0 + 1.2), rz=90):
            box(c, "paint_dark", (-0.25, 0, -0.30), (0.25, 0.03, 0.30), r=0.004)
            for xx in (-0.12, 0.12):
                box(c, "brass", (xx - 0.012, 0.03, -0.22), (xx + 0.012, 0.04, -0.20), r=0.001)
                with c.at((xx, 0.04, -0.20), rx=-20):
                    box(c, "brass", (-0.008, 0, 0), (0.008, 0.004, 0.36), r=0.0008)
                    with c.at((0, 0.002, 0.36)):
                        sphere(c, "teak", 0.014, 8, 5)
                box(c, "porcelain", (xx - 0.02, 0.03, 0.14), (xx + 0.02, 0.05, 0.22), r=0.003)
        # stool, fire bucket (+)
        with c.at((2.0, cx - 1.0, zb0), rz=30):
            stool(c, 0.55)
        with c.at((0.6, cx - 2.5, zb0)):
            lathe(c, "paint_red", [(0.0, 0), (0.10, 0), (0.13, 0.26), (0.135, 0.28), (0.0, 0.28)], 14, True)
        # booth floor shadows and small dirt
        for k in range(8):
            with c.at((RNG.uniform(0.3, 3.0), RNG.uniform(yb0 + 0.3, yb1 - 0.3), zb0 + 0.001), rz=RNG.uniform(0, 360)):
                decal(c, "dirt", RNG.uniform(0.3, 0.7), RNG.uniform(0.2, 0.4))
        # foyer below the booth: low ceiling, shelves of film cans + programme racks + poster frames
        box(c, "plaster_ceil", (0.0, 0.0, 3.6), (BX1, CW, 3.9), r=0.002)
        for k in range(1, 9, 2 * ST):
            yy = 0.4 + k * 2.0
            if abs(yy - cx) < 1.6:
                continue
            with c.at((0.12, yy, 0.0), rz=90):
                box(c, "teak", (-0.45, 0, 0.0), (0.45, 0.35, 0.06), r=0.004)
                for zz in (0.06, 0.66, 1.26, 1.86):
                    box(c, "oak", (-0.45, 0, zz), (0.45, 0.35, zz + 0.03), r=0.003)
                for sxx in (-0.45, 0.45):
                    box(c, "teak", (sxx - 0.015 if sxx < 0 else sxx - 0.015, 0, 0.0), (sxx + 0.015, 0.35, 2.2), r=0.003)
                for lev in range(1, 3):
                    for kk in range(4):
                        with c.at((-0.32 + kk * 0.16, 0.17, 0.06 + lev * 0.60 - 0.60 + 0.03)):
                            with c.at(rx=90):
                                pass
                        with c.at((-0.32 + kk * 0.16, 0.17, 0.09 + (lev - 1) * 0.60), rx=0):
                            for st in range(5):
                                with c.at((0, 0, st * 0.050)):
                                    cyl(c, "steel", 0.072, 0.042, 8, ch=0.003, smooth=False)
                                    pass
        for k in range(6):
            with c.at((0.04, 1.0 + k * 0.9 + (0 if k < 3 else 10.0), 1.7), rz=90):
                poster(c, 0.5, 0.8, k)
        for (yy) in (cx - 3.0, cx + 3.0):
            with c.at((2.2, yy, 0.0), rz=RNG.uniform(0, 360)):
                potted_plant(c, 1.0, leaf_n=12)
        with c.at((2.3, 4.0, 0.0)):
            with c.at((0.0, 0.0, 0.0)):
                box(c, "teak", (-0.5, -0.25, 0.0), (0.5, 0.25, 0.9), r=0.006)
                box(c, "brass", (-0.52, -0.27, 0.9), (0.52, 0.27, 0.93), r=0.003)
                for kk in range(10):
                    with c.at((RNG.uniform(-0.4, 0.4), RNG.uniform(-0.15, 0.15), 0.93), rz=RNG.uniform(0, 360)):
                        box(c, "paper_ticket", (-0.07, -0.10, 0), (0.07, 0.10, 0.002 + kk * 0.0005), r=0)

    # ---------- seating ----------
    with c.grp("seating"):
        block_w = (CW - 2 * 0.5 - 2 * 1.3) / 3.0
        y0s = [0.5, 0.5 + block_w + 1.3, 0.5 + 2 * (block_w + 1.3)]
        x_first = 4.2
        x_last = sx - 6.4
        pitch = (x_last - x_first) / (nrows - 1)
        for r in range(nrows):
            xr = x_first + r * pitch
            for b in range(3):
                yc = y0s[b] + block_w / 2
                with c.at((xr + 0.0, yc, 0.0), rz=90):
                    cinema_bench(c, block_w)
        # cushions left on a few benches, programme sheets on the floor (implied event: an empty house)
        for k in range(10):
            xr = x_first + RNG.randint(1, nrows - 2) * pitch
            yc = y0s[RNG.randint(0, 2)] + RNG.uniform(0.6, block_w - 0.6)
            with c.at((xr + 0.12, yc, 0.44), rz=RNG.uniform(0, 360)):
                box(c, "leather", (-0.18, -0.18, 0.0), (0.18, 0.18, 0.07), r=0.03, vc=(1.0, 0.8, 0.8))
        for k in range(12):
            with c.at((RNG.uniform(5, sx - 8), RNG.uniform(0.6, CW - 0.6), 0.003), rz=RNG.uniform(0, 360)):
                box(c, "paper_ticket", (-0.06, -0.09, 0), (0.06, 0.09, 0.0015), r=0)

    # ---------- proscenium, stage, screen, curtains, pit, benshi dais ----------
    with c.grp("stage"):
        ps = sx - 3.7                                   # proscenium plane
        pw, phh = 9.4, 6.4
        # stage floor + front riser + pit opening
        box(c, "boards", (ps - 0.3, 0.0, zs - 0.15), (L, CW, zs), r=0.002)
        box(c, "teak", (ps - 0.32, 0.0, 0.0), (ps - 0.30, CW, zs), r=0)
        # proscenium frame: arch ring + pilasters, gilded brass trim
        with c.at(m=Matrix(((0, 0, 1, ps), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))):
            inner = arch_pts(cx - pw / 2, cx + pw / 2, zs + 4.6, 1.4, 28, zs)
            extrude(c, "plaster", rect_pts(0.0, 0.0, CW, CH), [inner], depth=0.35, w0=-0.35)
            extrude(c, "brass", arch_pts(cx - pw / 2 - 0.30, cx + pw / 2 + 0.30, zs + 4.6, 1.4 + 0.30, 28, zs)[1:-1] + arch_pts(cx - pw / 2 - 0.02, cx + pw / 2 + 0.02, zs + 4.6, 1.4 + 0.02, 28, zs)[1:-1][::-1], (), depth=0.06, w0=-0.41)
        # screen with masking border, hung slightly behind the frame; emissive "projected light"
        scr_w, scr_h = 6.4, 4.8
        with c.at((SCREEN_X if not dream else sx, cx, 0.0)):
            box(c, "paint_dark", (-0.05, -scr_w / 2 - 0.25, 1.75), (0.0, scr_w / 2 + 0.25, 1.75 + scr_h + 0.5), r=0.004)
            c.face([(-0.06, -scr_w / 2, 1.80), (-0.06, scr_w / 2, 1.80), (-0.06, scr_w / 2, 1.80 + scr_h), (-0.06, -scr_w / 2, 1.80 + scr_h)],
                   "screen_sea" if dream else "screen", uv=[(0, 0), (1, 0), (1, 1), (0, 1)] if True else None)
            for zz in (1.80, 1.80 + scr_h):
                tube(c, "iron", (-0.07, -scr_w / 2 - 0.25, zz), (-0.07, scr_w / 2 + 0.25, zz), 0.008, 6)
        # curtains tied back to both sides of the proscenium + pelmet with gilt fringe
        for s in (-1, 1):
            with c.at((ps - 0.4, cx + (pw / 2 + 0.2 if s > 0 else -(pw / 2 + 0.2)), zs), rz=0):
                pass
        curtain_drape(c, ps - 0.6, cx - pw / 2 - 0.3, 1.7, 6.6 + zs)
        curtain_drape(c, ps - 0.6, cx + pw / 2 - 1.4, 1.7, 6.6 + zs)
        box(c, "velvet", (ps - 0.75, cx - pw / 2 - 0.4, zs + 5.9), (ps - 0.30, cx + pw / 2 + 0.4, zs + 6.45), r=0.02)
        for k in range(60):                                                                           # gilt fringe of the pelmet
            tube(c, "brass", (ps - 0.74, cx - pw / 2 - 0.35 + k * (pw + 0.7) / 59, zs + 5.9), (ps - 0.74, cx - pw / 2 - 0.35 + k * (pw + 0.7) / 59, zs + 5.75), 0.004, 4)
        # orchestra pit: rail, recessed floor, chairs and music stands
        with c.at((ps - 1.0, 0, 0)):
            box(c, "teak", (-0.04, cx - 4.0, 1.0), (0.04, cx + 4.0, 1.06), r=0.006)
            for k in range(0, 41):
                with c.at((0.0, cx - 4.0 + k * 0.2, 0.3)):
                    lathe_baluster(c, 0.7)
            for yy in (cx - 4.0, cx + 4.0):
                box(c, "teak", (-0.05, yy - 0.05, 0.0), (0.05, yy + 0.05, 1.12), r=0.005)
        box(c, "boards_dk", (ps - 2.6, cx - 4.0, -0.5), (ps - 0.3, cx + 4.0, -0.47), r=0)
        for k in range(5):
            with c.at((ps - 1.7, cx - 2.6 + k * 1.3, -0.48), rz=RNG.uniform(160, 200)):
                stool(c, 0.46)
            with c.at((ps - 2.3, cx - 2.6 + k * 1.3 + RNG.uniform(-0.1, 0.1), -0.48), rz=RNG.uniform(0, 360)):
                tube(c, "iron", (0, 0, 0), (0, 0, 1.05), 0.009, 6)
                for a in range(3):
                    tube(c, "iron", (0, 0, 0.05), (0.22 * math.cos(a * 2.09), 0.22 * math.sin(a * 2.09), 0.0), 0.006, 4)
                with c.at((0, 0, 1.05), rx=-75):
                    box(c, "iron", (-0.2, -0.002, 0.0), (0.2, 0.002, 0.3), r=0.001)
                    box(c, "paper_ticket", (-0.17, 0.002, 0.04), (0.17, 0.004, 0.26), r=0)
        # benshi dais at stage left (north side, y small): platform, lectern, tea set, clappers, fan - no figure, empty
        with c.at((ps + 1.6, 1.8, zs)):
            box(c, "teak", (-0.7, -0.7, 0.0), (0.7, 0.7, 0.28), r=0.006)
            box(c, "brass", (-0.72, -0.72, 0.28), (0.72, -0.70, 0.30), r=0.002)
            with c.at((0.0, 0.0, 0.28)):
                box(c, "teak", (-0.25, -0.22, 0.0), (0.25, 0.22, 0.85), r=0.005)                   # lectern post
                with c.at((0.0, -0.05, 0.85), rx=-25):
                    box(c, "oak", (-0.32, -0.25, 0.0), (0.32, 0.25, 0.035), r=0.004)
                    box(c, "teak", (-0.32, -0.25, 0.035), (0.32, -0.23, 0.07), r=0.003)
                    box(c, "paper_ticket", (-0.22, -0.18, 0.035), (0.05, 0.17, 0.037), r=0)
                with c.at((0.0, 0.0, 0.90)):
                    pass
                # cup + saucer + teapot (tea still warm = he just left)
                with c.at((0.55, 0.25, 0.0)):
                    box(c, "teak", (-0.22, -0.22, 0.0), (0.22, 0.22, 0.60), r=0.005)
                    with c.at((0.0, 0.0, 0.60)):
                        box(c, "oak", (-0.26, -0.26, 0.0), (0.26, 0.26, 0.03), r=0.004)
                        with c.at((-0.10, 0.0, 0.03)):
                            lathe(c, "porcelain", [(0, 0), (0.05, 0), (0.06, 0.008), (0.012, 0.012)], 14, True)
                            lathe(c, "porcelain", [(0.0, 0.012), (0.022, 0.012), (0.04, 0.024), (0.044, 0.05), (0.038, 0.05), (0.034, 0.03), (0.0, 0.016)], 14, True)
                        with c.at((0.10, 0.03, 0.03)):
                            lathe(c, "porcelain", [(0.0, 0), (0.06, 0), (0.075, 0.05), (0.06, 0.11), (0.03, 0.12), (0.0, 0.12)], 16, True)
                            tube(c, "porcelain", (0.06, 0, 0.06), (0.11, 0, 0.11), 0.011, 8)
                            for a in range(4):
                                tube(c, "porcelain", (-0.06, 0, 0.09 - a * 0.0), (-0.09, 0, 0.05), 0.008, 6) if a == 0 else None
                        with c.at((0.0, -0.12, 0.03), rz=20):
                            box(c, "oak", (-0.045, -0.02, 0.0), (0.045, 0.02, 0.022), r=0.003)
                            box(c, "oak", (-0.045, 0.03, 0.0), (0.045, 0.07, 0.022), r=0.003)                # hyoshigi clappers
    # projector beam (alpha mesh + dust), only the final frustum is mesh; a spot light does the actual illumination
    with c.grp("beam"):
        p0 = (2.98, cx - 0.26, 5.0)
        a = (sx - 0.12, cx - scr_w / 2 * 0.0 - 3.2, 1.8 + 0.0)
        ends = [(sx - 0.15, cx - 3.2, 1.8), (sx - 0.15, cx + 3.2, 1.8), (sx - 0.15, cx + 3.2, 6.6), (sx - 0.15, cx - 3.2, 6.6)]
        ctr = (sx - 0.15, cx, 4.2)
        for layer in range(7):                                  # nested frusta: soft edge, denser core (dust-lit beam)
            sc_ = 1.0 - layer * 0.13
            ends_l = [(e[0], ctr[1] + (e[1] - ctr[1]) * sc_, ctr[2] + (e[2] - ctr[2]) * sc_) for e in ends]
            for i in range(4):
                c.face([p0, ends_l[i], ends_l[(i + 1) % 4]], "beam")
        rr = random.Random(9)
        for k in range(700):                                   # dust motes inside the frustum
            t = rr.random() ** 0.6
            ux, uz = rr.uniform(-1, 1), rr.uniform(-1, 1)
            px = p0[0] + (sx - 0.15 - p0[0]) * t
            py = (cx - 0.26) + (ux * 3.2 + 0.26) * t
            pz = p0[2] + ((4.2 + uz * 2.4) - p0[2]) * t
            with c.at((px, py, pz), rx=rr.uniform(0, 180), ry=rr.uniform(0, 180)):
                c.face([(-0.004, 0, 0), (0.004, 0, 0), (0, 0.004, 0)], "dust")
    # ---------- props on the auditorium floor / dream ----------
    if dream:
        with c.grp("dream"):
            # the white rabbit statue (plaster, pedestal) in the front row centre seat: ears, body, head, tail
            with c.at((sx - 6.4 - 0.25, cx, 0.44)):
                with c.at((0, 0, 0.0)):
                    lathe(c, "fur", [(0, 0), (0.17, 0.0), (0.22, 0.10), (0.20, 0.22), (0.12, 0.30), (0.0, 0.32)], 16, True)
                with c.at((0.0, 0.0, 0.42)):
                    sphere(c, "fur", 0.11, 14, 10)
                    for s_ in (-1, 1):
                        with c.at((0.0, s_ * 0.045, 0.14), rx=s_ * -8, ry=-6):
                            lathe(c, "fur", [(0, 0), (0.030, 0.0), (0.042, 0.10), (0.036, 0.22), (0.015, 0.28), (0, 0.29)], 10, True)
                    with c.at((0.09, 0.0, -0.01)):
                        sphere(c, "fur", 0.055, 10, 6)
                    for s_ in (-1, 1):
                        with c.at((0.12, s_ * 0.05, 0.04)):
                            sphere(c, "paint_dark", 0.013, 6, 4)
                with c.at((-0.2, 0.0, 0.12)):
                    sphere(c, "fur", 0.06, 8, 6)
                with c.at((0.0, 0.0, -0.44)):
                    cyl(c, "fur", 0.0, 0.0, 4) if False else None
    # ---------- cameras ----------
    c.cams = [
        dict(name="cam1_axis", loc=(BX1 + 0.5, cx + 0.15, 1.45), tgt=(sx, cx, 2.6), lens=18),
        dict(name="cam2_corner", loc=(5.0, 1.0, 1.55), tgt=(sx - 3, 12.0, 2.0), lens=20),
        dict(name="cam3_ceiling", loc=(L * 0.35, cx, 1.4), tgt=(L * 0.35 + 7.0, cx + 1.0, CH - 1.0), lens=18),
        dict(name="cam4_window", loc=(door_x - 3.0, 6.0, 1.4), tgt=(door_x, CW, 1.2), lens=24),
        dict(name="cam5_street", loc=(-3.6, cx + 0.4, 1.6), tgt=(BX1, cx, 1.6), lens=22, exp=-1.4),
        dict(name="closeup_projector", loc=(1.65, cx + 1.75, 3.9 + 1.75), tgt=(2.62, cx - 0.12, 3.9 + 1.32), lens=30, exp=0.3),
    ]
    if dream:
        c.cams.append(dict(name="cam6_impossible", loc=(sx - 6.4 - 1.8, cx - 1.3, 1.25), tgt=(sx - 6.4 - 0.25, cx, 0.85), lens=26))
    return c


# ======================================================================================================================
# main
# ======================================================================================================================
BUILDERS = {}
def _reg():
    for nm, fn in (("hall", "build_hall"), ("stair", "build_stair"), ("lift", "build_lift"), ("cinema", "build_cinema")):
        if fn in globals():
            BUILDERS[nm] = globals()[fn]
_reg()
POS = {"hall": (0, 0, 0), "stair": (0, 60, 0), "lift": (0, 120, 0), "cinema": (0, 180, 0)}


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rooms = list(BUILDERS) if ROOM == "all" else [ROOM]
    variants = [False, True] if VARIANT == "both" else [VARIANT == "dream"]
    made = []
    t0 = time.time()
    for rm in rooms:
        for dr in variants:
            t1 = time.time()
            if rm != "hall":           # v1.2: every room after the hall starts from its own seed (independent of the others' draws)
                RNG.seed(f"{rm}-{'dream' if dr else 'base'}")
            cell = BUILDERS[rm](dr)
            off = tuple(np.array(POS[rm]) + np.array((60 if dr else 0, 0, 0)))
            if DO_EXPORT:
                cell.F = [f for f in cell.F if not f["g"].startswith("ref_")]
            coll, root, st = realize(cell, off, do_uv1=DO_EXPORT)
            rig_cell(cell, coll, root)
            if rm == "stair" and not dr:
                write_stair_plan(cell)
            made.append((cell, coll))
            print(f"CELL {cell.name}: {sum(v for k, v in st.items() if not k.startswith('ref_'))} tris (ex ref), {len(cell.lights)} lights, groups {st}  build {time.time() - t1:.1f}s", flush=True)
    if DO_RENDER != "none":
        for cell, coll in made:
            names = [ONLYCAM] if ONLYCAM else None
            render_cams(cell, coll, RENDERDIR / f"iter-{ITER:03d}", names)
    if GATE_RENDERS:
        for cell, coll in made:
            if cell.gates:
                render_gate_states(cell, coll, RENDERDIR / f"iter-{ITER:03d}")
    if DO_EXPORT:
        export_glb(HERE / "tower-base-interiors.glb")
    print(f"TOTAL {time.time() - t0:.1f}s")


main()
