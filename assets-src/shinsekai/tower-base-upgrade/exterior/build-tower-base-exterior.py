"""Tower base (1912) exterior: detailed, parametric replacement for the coarse v4 base blocks.

Run from the repository root with Blender 4.5:
    blender -b -P assets-src/shinsekai/tower-base-upgrade/exterior/build-tower-base-exterior.py -- \
        [--passage-depth 26] [--renders all|street-arch,facade-closeup,...] [--samples 96] [--no-export] [--iron redbrown]

Outputs next to this file: tower-base-exterior.glb (LOD0/1/2 + COL_* + IF_* nodes),
tower-base-exterior.parts.json (tri counts, materials, sources) and the review renders.

Frame: v4 coordinates (metres, X east, Y north, Z up, tower axis at the origin, street at z 0).
All base dimensions are read from ../../tower-study/build-tower-v4.py (not edited). Everything this
file adds is tagged S: (OML CC0 photo), T: (text), P: (plate 46 / view A), A: (assumption) in PARTS
and in README.md. The interior contract is ../INTERFACE.md.
"""

import ast
import json
import math
import random
import sys
import time
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

T_START = time.time()
HERE = Path(__file__).resolve().parent
V4_PATH = HERE.parents[1] / "tower-study" / "build-tower-v4.py"
V4_GLB = HERE.parents[1] / "tower-study" / "tower-study-v4-open-gallery.glb"
TEX = Path(r"C:\Users\NULL\Documents\Codex\JTA-shinsekai\research-cache\materials-93")
ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def argval(name, default, cast=str):
    return cast(ARGV[ARGV.index(name) + 1]) if name in ARGV else default


# ---------------------------------------------------------------------------------------------
# 1. v4 constants (parsed, not imported: v4 runs bpy operators at import time)
# ---------------------------------------------------------------------------------------------
def read_v4_constants():
    tree = ast.parse(V4_PATH.read_text(encoding="utf-8"))
    ns = {"math": math, "sys": sys, "Vector": Vector}
    for node in tree.body:
        if isinstance(node, (ast.Assign, ast.FunctionDef)):
            try:
                exec(compile(ast.Module([node], []), str(V4_PATH), "exec"), ns)
            except Exception:
                pass  # assignments that call bpy helpers (materials, blocks) are skipped
    keys = ["ROOF_GARDEN_Z", "FACADE_TOP", "LATTICE_BASE", "PASSAGE_DEPTH", "FACE_Y", "FACADE_HALF_WIDTH",
            "ARCH_HALF_SPAN", "ARCH_SPRING", "ARCH_CROWN", "TURRET", "TURRET_X", "TURRET_BODY_TOP",
            "TURRET_DOME_TOP", "TURRET_FINIAL_TOP", "SHAFT_BASE_HALF", "WELL", "LIFT", "HEIGHT"]
    return {k: ns[k] for k in keys if k in ns}


V4 = read_v4_constants()
RG = V4["ROOF_GARDEN_Z"]             # 15.15, sourced (T: PID 946141 fr.268)
FY = V4["FACE_Y"]                    # turret front faces (13.0)
FHW = V4["FACADE_HALF_WIDTH"]        # 14.5
AHS = V4["ARCH_HALF_SPAN"]           # 10.05
ASP = V4["ARCH_SPRING"]              # 2.9
ACR = V4["ARCH_CROWN"]               # 10.9
TUR = V4["TURRET"]                   # 4.4
TBT = V4["TURRET_BODY_TOP"]          # 19.6
TDT = V4["TURRET_DOME_TOP"]          # 22.1
TFT = V4["TURRET_FINIAL_TOP"]        # 22.9
LEG = V4["SHAFT_BASE_HALF"]          # 5.7
LATTICE_BASE = V4["LATTICE_BASE"]    # 15.85

# Derived / assumed dimensions (A: unless noted). Kept identical to ../INTERFACE.md.
WALL_T = 0.45
SCREEN_Y = FY - 0.25                 # A: the arch screen is recessed 0.25 m behind the turret fronts (S: 157437 lit turret returns)
TIN = AHS                            # turret inner face = passage wall face (x = +/-10.05)
TY0 = FY - TUR - 0.0 + 0.0           # turret back face y (8.6)
TY0 = round(FY - TUR, 4)
PLINTH = 0.6
GROUND_TOP = 4.6                     # string course 4.6..4.9 (L1 slab)
STRING_TOP = 4.9
FRIEZE0, FRIEZE1 = 13.1, 14.35
CORNICE_TOP = 15.45
TBAND0 = 14.95                       # turret band (continues the corona of the main cornice)
TCORN0 = 19.0                        # turret cornice 19.0..TBT
LEVELS = {"L0": 0.15, "L1": 4.90, "L2": 8.40, "L3": 11.80, "roof": RG}
RING = 0.9                           # voussoir ring width (A:)
SCREEN_RING_OVERLAP = 0.1
# v1.3 seams with the cinema wings (../wings, datums in its parts.json and INTERFACE change log 1.3): the base reads them, it does
# not draw any wing geometry.  Wing barrel roof: 9.62 over the wall line (y +/-9.0), crown 12.1, overhang edge y +/-9.45; half-round
# eaves gutter centred 0.10 beyond the edge (y +/-9.55), 0.12 below it.  Street poles at the wing ends nearest the base: x +/-20.5,
# y -13.3, crossarms at 9.25 and 8.55, porcelain insulators at +/-0.36 / +/-0.72 along the arm (profile max radius 0.045, 0.04 above
# the insulator base = arm + 0.10).
WING_DOOR_FLOOR = 0.15               # finished threshold of door_wing_E/W = hall floor = wing zone = cinema floor
WING_ROOF = dict(z_wall=9.62, crown=12.1, half=9.0, edge=9.45, gutter_dy=0.10, gutter_dz=-0.12, gutter_r=0.075)
WING_POLE = dict(x=20.5, y=-13.3, arms=(9.25, 8.55), u=(0.36, 0.72), ins_base=0.10, ins_rmax=0.045, ins_zmax=0.04)


def wing_roof_z(y):
    rise = WING_ROOF["crown"] - WING_ROOF["z_wall"]
    R = (WING_ROOF["half"] ** 2 + rise ** 2) / (2 * rise)
    return WING_ROOF["crown"] - R + math.sqrt(max(0.0, R * R - y * y))

IRON_COLOUR = argval("--iron", "redbrown")
SAMPLES = argval("--samples", 96, int)
RENDERS = argval("--renders", "", str)
DO_EXPORT = "--no-export" not in ARGV
random.seed(1912)

PARTS = []   # (element, source tags, note)


def note(element, src, text=""):
    PARTS.append({"element": element, "source": src, "note": text})


# ---------------------------------------------------------------------------------------------
# 2. Geometry core: per-(LOD, part) mesh accumulators, a matrix stack and generic generators
# ---------------------------------------------------------------------------------------------
class Part:
    def __init__(self, name, mat):
        self.name, self.mat = name, mat
        self.V, self.F, self.UV, self.S = [], [], [], []


BUCKET = {}
LOD = 0
MAT = Matrix.Identity(4)
MAT_STACK = []


def part(name, mat=None):
    key = (LOD, name)
    if key not in BUCKET:
        BUCKET[key] = Part(name, mat or name)
    return BUCKET[key]


class local:
    """with local(matrix): generators emit through this transform."""
    def __init__(self, m):
        self.m = m

    def __enter__(self):
        global MAT
        MAT_STACK.append(MAT)
        MAT = MAT @ self.m

    def __exit__(self, *a):
        global MAT
        MAT = MAT_STACK.pop()


def newell(pts):
    n = Vector((0, 0, 0))
    for i, a in enumerate(pts):
        b = pts[(i + 1) % len(pts)]
        n.x += (a.y - b.y) * (a.z + b.z)
        n.y += (a.z - b.z) * (a.x + b.x)
        n.z += (a.x - b.x) * (a.y + b.y)
    return n


def world_uv(W, n):
    if n.length < 1e-12:
        return [(p.x, p.y) for p in W]
    n = n.normalized()
    if abs(n.z) > 0.7071:
        return [(p.x, p.y) for p in W]
    t = Vector((-n.y, n.x, 0)).normalized()
    return [(p.x * t.x + p.y * t.y, p.z) for p in W]


def face(p, pts, out=None, smooth=False, uv=None):
    W = [MAT @ Vector(q) for q in pts]
    n = newell(W)
    if n.length < 1e-10:
        return
    if out is not None:
        o = MAT.to_3x3() @ Vector(out)
        if n.dot(o) < 0:
            W.reverse()
            n = -n
            if uv:
                uv = uv[::-1]
    if uv is None:
        uv = world_uv(W, n)
    i = len(p.V)
    p.V.extend(W)
    p.F.append(tuple(range(i, i + len(W))))
    p.UV.append(uv)
    p.S.append(smooth)


def cbox(p, lo, hi, c=0.0, skip=(), jitter=0.0):
    """Box from lo to hi (local), chamfered by c on every edge (c=0: plain). skip: faces like '-y'."""
    lo, hi = Vector(lo), Vector(hi)
    ctr = (lo + hi) / 2
    size = hi - lo
    c = min(c, 0.45 * min(size))
    if jitter:
        c *= 1 + random.uniform(-jitter, jitter)
    if c <= 1e-5:
        corners = lambda sx, sy, sz: Vector((hi.x if sx else lo.x, hi.y if sy else lo.y, hi.z if sz else lo.z))
        quads = {"-x": [(0, 0, 0), (0, 1, 0), (0, 1, 1), (0, 0, 1)], "+x": [(1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)],
                 "-y": [(0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)], "+y": [(0, 1, 0), (1, 1, 0), (1, 1, 1), (0, 1, 1)],
                 "-z": [(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)], "+z": [(0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)]}
        for k, q in quads.items():
            if k in skip:
                continue
            pts = [corners(*s) for s in q]
            face(p, pts, out=sum(pts, Vector()) / 4 - ctr)
        return

    def vert(s, axis):
        v = [hi[i] if s[i] else lo[i] for i in range(3)]
        for i in range(3):
            if i != axis:
                v[i] += -c if s[i] else c
        return Vector(v)

    names = ["x", "y", "z"]
    for a in range(3):
        for sa in (0, 1):
            if (("+" if sa else "-") + names[a]) in skip:
                continue
            b, d = [i for i in range(3) if i != a]
            pts = []
            for sb, sd in ((0, 0), (1, 0), (1, 1), (0, 1)):
                s = [0, 0, 0]
                s[a], s[b], s[d] = sa, sb, sd
                pts.append(vert(s, a))
            face(p, pts, out=sum(pts, Vector()) / 4 - ctr)
    def hidden(axis, sgn):
        return (("+" if sgn else "-") + names[axis]) in skip

    for a in range(3):
        for b in range(a + 1, 3):
            d = 3 - a - b
            for sa in (0, 1):
                for sb in (0, 1):
                    if hidden(a, sa) or hidden(b, sb):      # v1.2: the bevel strip of a buried (skipped) face is buried too
                        continue
                    pts = []
                    for sd, ax in ((0, a), (1, a), (1, b), (0, b)):
                        s = [0, 0, 0]
                        s[a], s[b], s[d] = sa, sb, sd
                        pts.append(vert(s, ax))
                    face(p, pts, out=sum(pts, Vector()) / 4 - ctr)
    for sx in (0, 1):
        for sy in (0, 1):
            for sz in (0, 1):
                if hidden(0, sx) or hidden(1, sy) or hidden(2, sz):
                    continue
                pts = [vert((sx, sy, sz), ax) for ax in range(3)]
                face(p, pts, out=sum(pts, Vector()) / 3 - ctr)


def sweep(p, prof, frames, closed_path=False, closed_prof=False, smooth=True, caps=False):
    """prof: [(a, b)] traversed with the outside on the LEFT of travel rotated clockwise
    (i.e. listed bottom->out->top for a cornice). frames: [(P, A, B)] -> point = P + a*A + b*B."""
    rings = [[Vector(P) + a * Vector(A) + b * Vector(B) for a, b in prof] for P, A, B in frames]
    # uv: u along path (metres), v along profile (metres)
    plen = [0.0]
    for i in range(1, len(prof)):
        plen.append(plen[-1] + math.dist(prof[i], prof[i - 1]))
    if closed_prof:
        plen.append(plen[-1] + math.dist(prof[0], prof[-1]))
    ulen = [0.0]
    for i in range(1, len(frames)):
        ulen.append(ulen[-1] + (Vector(frames[i][0]) - Vector(frames[i - 1][0])).length)
    nseg = len(frames) - (0 if closed_path else 1)
    nprof = len(prof) - (0 if closed_prof else 1)
    for i in range(nseg):
        i2 = (i + 1) % len(frames)
        u0, u1 = ulen[i], ulen[i] + (Vector(frames[i2][0]) - Vector(frames[i][0])).length
        for j in range(nprof):
            j2 = (j + 1) % len(prof)
            da, db = prof[j2][0] - prof[j][0], prof[j2][1] - prof[j][1]
            oa, ob = db, -da
            A0, B0 = Vector(frames[i][1]), Vector(frames[i][2])
            out = oa * A0 + ob * B0
            pts = [rings[i][j], rings[i2][j], rings[i2][j2], rings[i][j2]]
            uv = [(u0, plen[j]), (u1, plen[j]), (u1, plen[j + 1]), (u0, plen[j + 1])]
            face(p, pts, out=out, smooth=smooth, uv=uv)
    if caps and not closed_path:
        for k, sgn in ((0, -1), (len(frames) - 1, 1)):
            P, A, B = frames[k]
            t = (Vector(frames[min(k + 1, len(frames) - 1)][0]) - Vector(frames[max(k - 1, 0)][0])).normalized()
            face(p, rings[k], out=t * sgn)


def hframes(pts, closed=False, outward_sign=1.0):
    """Horizontal path frames with mitred corners; A = outward (t x Z for CCW loops), B = Z."""
    n = len(pts)
    P = [Vector((q[0], q[1], 0.0)) for q in pts]
    segn = []
    for i in range(n - (0 if closed else 1)):
        t = (P[(i + 1) % n] - P[i]).normalized()
        segn.append(t.cross(Vector((0, 0, 1))) * outward_sign)
    fr = []
    for i in range(n):
        if closed:
            n1, n2 = segn[i - 1], segn[i % len(segn)]
        else:
            n1 = segn[max(i - 1, 0)]
            n2 = segn[min(i, len(segn) - 1)]
        m = (n1 + n2).normalized()
        A = m / max(0.2, m.dot(n1))
        fr.append((P[i], A, Vector((0, 0, 1))))
    return fr


def lathe(p, prof, centre=(0, 0, 0), seg=12, sq=None, smooth=True, ang0=0.0, cap_top=False, cap_bot=False):
    """prof [(r, z)] bottom->top, outside on the right. sq(z) -> superellipse exponent (2 = round)."""
    cx, cy, cz = centre
    rings = []
    for r, z in prof:
        ring = []
        e = sq(z) if sq else 2.0
        for k in range(seg):
            th = ang0 + 2 * math.pi * k / seg
            c, s = math.cos(th), math.sin(th)
            fx = math.copysign(abs(c) ** (2 / e), c)
            fy = math.copysign(abs(s) ** (2 / e), s)
            ring.append(Vector((cx + r * fx, cy + r * fy, cz + z)))
        rings.append(ring)
    circ = 2 * math.pi * max(r for r, _ in prof)
    vl = [0.0]
    for i in range(1, len(prof)):
        vl.append(vl[-1] + math.dist(prof[i], prof[i - 1]))
    for i in range(len(prof) - 1):
        dr, dz = prof[i + 1][0] - prof[i][0], prof[i + 1][1] - prof[i][1]
        for k in range(seg):
            k2 = (k + 1) % seg
            th = ang0 + 2 * math.pi * (k + 0.5) / seg
            radial = Vector((math.cos(th), math.sin(th), 0))
            out = radial * dz + Vector((0, 0, -dr))
            u0, u1 = circ * k / seg, circ * (k + 1) / seg
            pts = [rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]]
            if (pts[2] - pts[3]).length < 1e-7:
                pts = pts[:3]
                uvs = [(u0, vl[i]), (u1, vl[i]), (u1, vl[i + 1])]
            elif (pts[0] - pts[1]).length < 1e-7:
                pts = [pts[0], pts[2], pts[3]]
                uvs = [(u0, vl[i]), (u1, vl[i + 1]), (u0, vl[i + 1])]
            else:
                uvs = [(u0, vl[i]), (u1, vl[i]), (u1, vl[i + 1]), (u0, vl[i + 1])]
            face(p, pts, out=out, smooth=smooth, uv=uvs)
    if cap_top and prof[-1][0] > 1e-6:
        face(p, rings[-1], out=(0, 0, 1))
    if cap_bot and prof[0][0] > 1e-6:
        face(p, rings[0], out=(0, 0, -1))


def tube(p, pts, r, seg=6, smooth=True, caps=False):
    pts = [Vector(q) for q in pts]
    frames = []
    t0 = (pts[1] - pts[0]).normalized()
    ref = Vector((0, 0, 1)) if abs(t0.z) < 0.9 else Vector((1, 0, 0))
    A = t0.cross(ref).normalized()
    for i, P in enumerate(pts):
        if i == 0:
            t = t0
        elif i == len(pts) - 1:
            t = (pts[i] - pts[i - 1]).normalized()
        else:
            t = ((pts[i + 1] - pts[i]).normalized() + (pts[i] - pts[i - 1]).normalized()).normalized()
        A = (A - t * A.dot(t)).normalized()
        B = t.cross(A)
        frames.append((P, A, B))
    prof = [(r * math.cos(-2 * math.pi * k / seg), r * math.sin(-2 * math.pi * k / seg)) for k in range(seg)]
    sweep(p, prof, frames, closed_prof=True, smooth=smooth, caps=caps)


def rod(p, a, b, r, seg=6, caps=True):
    tube(p, [a, b], r, seg, caps=caps)


def frame_matrix(origin, N):
    """Wall frame: local (u, n, z) -> world. N is the outward unit normal (horizontal)."""
    N = Vector(N).normalized()
    Z = Vector((0, 0, 1))
    U = N.cross(Z)
    m = Matrix.Identity(4)
    for r in range(3):
        m[r][0], m[r][1], m[r][2], m[r][3] = U[r], N[r], Z[r], origin[r]
    return m


# ---------------------------------------------------------------------------------------------
# 3. Openings and walls
# ---------------------------------------------------------------------------------------------
class Op:
    """Opening in a wall's (u, z) frame. kind: rect | round | seg | circle | ellipse."""
    def __init__(self, kind, uc, w, z0, z1=0.0, rise=0.0, r=0.0, b=0.0, fill=None, reveal=0.28, tag=""):
        self.kind, self.uc, self.w, self.z0, self.z1, self.rise = kind, uc, w, z0, z1, rise
        self.r, self.b, self.fill, self.reveal, self.tag = r, b, fill, reveal, tag
        if kind == "seg":
            hw = w / 2
            self.R = (hw * hw + rise * rise) / (2 * rise)
            self.zc = z1 + rise - self.R
        if kind == "circle":
            self.z0 = z1 - r

    def top(self):
        return {"rect": self.z1, "round": self.z1 + self.w / 2, "seg": self.z1 + self.rise,
                "circle": self.z1 + self.r, "ellipse": self.z1 + self.b}[self.kind]

    def curved_at(self, z):
        return self.kind in ("round", "seg", "ellipse") and z > self.z1 or self.kind == "circle"

    def half(self, z):
        k = self.kind
        if k == "rect":
            return self.w / 2
        if k == "circle":
            return math.sqrt(max(0.0, self.r ** 2 - (z - self.z1) ** 2))
        if z <= self.z1:
            return self.w / 2
        if k == "round":
            return math.sqrt(max(0.0, (self.w / 2) ** 2 - (z - self.z1) ** 2))
        if k == "seg":
            return math.sqrt(max(0.0, self.R ** 2 - (z - self.zc) ** 2))
        if k == "ellipse":
            return (self.w / 2) * math.sqrt(max(0.0, 1 - ((z - self.z1) / self.b) ** 2))

    def outline(self, n=None, closed_bottom=True):
        """Polyline (u, z): bottom-left, up the left jamb, over the head, down the right jamb."""
        hw = self.w / 2
        pts = []
        if self.kind == "circle":
            n = n or {0: 12, 1: 8, 2: 6}[LOD]
            return [(self.uc + self.r * math.cos(math.pi - 2 * math.pi * k / n), self.z1 + self.r * math.sin(math.pi - 2 * math.pi * k / n)) for k in range(n)]
        pts.append((self.uc - hw, self.z0))
        if self.kind == "rect":
            pts += [(self.uc - hw, self.z1), (self.uc + hw, self.z1)]
        elif self.kind == "round":
            n = n or {0: 8, 1: 6, 2: 4}[LOD]
            pts += [(self.uc + hw * math.cos(math.pi - math.pi * k / n), self.z1 + hw * math.sin(math.pi - math.pi * k / n)) for k in range(n + 1)]
        elif self.kind == "seg":
            n = n or {0: 6, 1: 4, 2: 3}[LOD]
            a0 = math.atan2(self.z1 - self.zc, -hw)
            a1 = math.atan2(self.z1 - self.zc, hw)
            pts += [(self.uc + self.R * math.cos(a0 + (a1 - a0) * k / n), self.zc + self.R * math.sin(a0 + (a1 - a0) * k / n)) for k in range(n + 1)]
        elif self.kind == "ellipse":
            n = n or 24
            pts += [(self.uc + hw * math.cos(math.pi - math.pi * k / n), self.z1 + self.b * math.sin(math.pi - math.pi * k / n)) for k in range(n + 1)]
        pts.append((self.uc + hw, self.z0))
        # remove duplicates
        out = [pts[0]]
        for q in pts[1:]:
            if math.dist(q, out[-1]) > 1e-6:
                out.append(q)
        return out


def zones_std(z0, z1, style, part_name, course=0.5, g=0.035, d=0.03, offset=0.0):
    """Expand a style into (za, zb, part, na, nb) strips. style: flat | band (V-jointed courses)."""
    if style == "flat":
        return [(z0, z1, part_name, offset, offset)]
    n = max(1, round((z1 - z0) / course))
    h = (z1 - z0) / n
    out = []
    for k in range(n):
        a, b = z0 + k * h, z0 + (k + 1) * h
        out += [(a, a + g, part_name, offset - d, offset), (a + g, b - g, part_name, offset, offset),
                (b - g, b, part_name, offset, offset - d)]
    return out


def wall(frame, u0, u1, zones, ops, step=0.04):
    """Wall surface pieces between openings (openings are holes); curved hole sides are sampled."""
    with local(frame):
        for za, zb, pname, na, nb in zones:
            p = part(pname)
            nz = lambda z: na + (nb - na) * (z - za) / (zb - za) if zb > za else na
            cuts = {za, zb}
            for o in ops:
                for z in (o.z0, o.z1, o.top()):
                    if za < z < zb:
                        cuts.add(z)
            cuts = sorted(cuts)
            for s0, s1 in zip(cuts, cuts[1:]):
                if s1 - s0 < 1e-5:
                    continue
                mid = (s0 + s1) / 2
                act = sorted([o for o in ops if o.z0 < mid < o.top() and o.uc + o.w / 2 > u0 - 20 and
                              o.uc - max(o.w / 2, o.r) < u1 and o.uc + max(o.w / 2, o.r) > u0],
                             key=lambda o: o.uc)
                curved = any(o.curved_at(mid) for o in act)
                k = max(2, math.ceil((s1 - s0) / step) + 1) if curved else 2
                zs = [s0 + (s1 - s0) * i / (k - 1) for i in range(k)]
                bounds = [(lambda z: u0)]
                for o in act:
                    bounds.append((lambda z, o=o: o.uc - o.half(z)))
                    bounds.append((lambda z, o=o: o.uc + o.half(z)))
                bounds.append(lambda z: u1)
                for i in range(0, len(bounds), 2):
                    Lf, Rf = bounds[i], bounds[i + 1]
                    left = [(max(u0, min(u1, Lf(z))), z) for z in zs]
                    right = [(max(u0, min(u1, Rf(z))), z) for z in reversed(zs)]
                    if max(r[0] for r in right) - min(l[0] for l in left) < 1e-4:
                        continue
                    if all(r[0] - l[0] < 1e-4 for l, r in zip(left, reversed(right))):
                        continue
                    poly = left + right
                    pts = []
                    for u, z in poly:
                        q = (u, nz(z), z)
                        if not pts or (Vector(q) - Vector(pts[-1])).length > 1e-6:
                            pts.append(q)
                    if len(pts) >= 3:
                        face(p, pts, out=(0, 1, 0))


def reveal(frame, o, depth, pname, n0=0.0):
    """Reveal surfaces through the wall for opening o (u,z frame), from n0 back to -depth."""
    ol = o.outline()
    closed = True
    OPENINGS.append((frame, o))
    with local(frame):
        p = part(pname)
        cu = o.uc
        cz = (o.z0 + o.top()) / 2 if o.kind != "circle" else o.z1
        m = len(ol)
        for i in range(m):
            a, b = ol[i], ol[(i + 1) % m]
            if not closed and i == m - 1:
                break
            mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            inward = Vector((cu - mid[0], 0, cz - mid[1]))
            if o.kind != "circle" and abs(a[1] - o.z0) < 1e-6 and abs(b[1] - o.z0) < 1e-6:
                inward = Vector((0, 0, 1))
            pts = [(a[0], n0, a[1]), (b[0], n0, b[1]), (b[0], -depth, b[1]), (a[0], -depth, a[1])]
            face(p, pts, out=inward, smooth=o.kind == "circle")


def outline_frames(ol, offset_n=0.0, closed=False):
    """Frames along an opening outline in the local wall frame: A = +n (wall normal), B = away from the hole."""
    fr = []
    m = len(ol)
    for i in range(m):
        if closed:
            prv, nxt = ol[i - 1], ol[(i + 1) % m]
        else:
            prv, nxt = ol[max(i - 1, 0)], ol[min(i + 1, m - 1)]
        t1 = Vector((ol[i][0] - prv[0], 0, ol[i][1] - prv[1]))
        t2 = Vector((nxt[0] - ol[i][0], 0, nxt[1] - ol[i][1]))
        if t1.length < 1e-9:
            t1 = t2
        if t2.length < 1e-9:
            t2 = t1
        t1.normalize()
        t2.normalize()
        # away-from-hole for a clockwise (u right, z up) outline = rotate tangent +90 deg: (tu, tz) -> (-tz, tu)
        m1 = Vector((-t1.z, 0, t1.x))
        m2 = Vector((-t2.z, 0, t2.x))
        mm = (m1 + m2)
        if mm.length < 1e-9:
            mm = m1
        mm.normalize()
        B = mm / max(0.3, mm.dot(m1))
        fr.append((Vector((ol[i][0], offset_n, ol[i][1])), Vector((0, 1, 0)), B))
    return fr


# ---------------------------------------------------------------------------------------------
# 4. Kits: surrounds, sills, windows, doors, balusters, bulbs (LOD aware)
# ---------------------------------------------------------------------------------------------
SURROUND = [(0.0, -0.012), (0.03, -0.012), (0.034, 0.03), (0.052, 0.05), (0.052, 0.13), (0.025, 0.165), (0.0, 0.17)]
SURROUND_L2 = [(0.0, -0.012), (0.05, 0.0), (0.05, 0.15), (0.0, 0.17)]
SURROUND_L1 = [(0.0, -0.012), (0.04, -0.012), (0.05, 0.02), (0.05, 0.14), (0.0, 0.17)]


def surround(frame, o, pname="trim", key=True):
    ol = o.outline()
    prof = {0: SURROUND, 1: SURROUND_L1, 2: SURROUND_L2}[LOD]
    if o.kind == "circle" and LOD == 0:
        prof = SURROUND_L1
    # traverse profile so that the outside is on the left rotated clockwise: (a=n out, b=away from hole)
    prof = [(a, b) for a, b in prof]
    closed = o.kind == "circle"
    if not closed:
        ol = ol[:-1] + [ol[-1]]
    with local(frame):
        p = part(pname)
        fr = outline_frames(ol, 0.0, closed=closed)
        sweep(p, [(b, a) for a, b in prof][::-1] if False else prof_swap(prof), fr, closed_path=closed,
              smooth=False, caps=not closed)
        if key and o.kind in ("round", "seg") and LOD <= 1:
            top = o.top()
            kw, kh = 0.22, 0.34
            cbox(p, (o.uc - kw / 2, -0.01, top - 0.06), (o.uc + kw / 2, 0.075, top + kh - 0.06), skip=("-y",))


def prof_swap(prof):
    """Surround profiles are authored as (n, away); sweep wants (a along A=+n, b along B=away)."""
    return [(a, b) for a, b in prof]


def sill(frame, o, pname="sill", proj=0.085, ext=0.1):
    """Stone sill with weathered top and a drip groove, swept along u."""
    z0 = o.z0
    u0, u1 = o.uc - o.w / 2 - ext, o.uc + o.w / 2 + ext
    if LOD == 0:
        prof = [(-0.30, z0 - 0.13), (0.0, z0 - 0.13), (proj - 0.03, z0 - 0.13), (proj - 0.03, z0 - 0.115),
                (proj - 0.045, z0 - 0.115), (proj - 0.045, z0 - 0.13), (proj, z0 - 0.13),
                (proj + 0.006, z0 - 0.124), (proj + 0.006, z0 - 0.035), (proj, z0 - 0.028), (-0.30, z0 + 0.005)]
    else:
        prof = [(-0.30, z0 - 0.13), (proj, z0 - 0.13), (proj, z0 - 0.03), (-0.30, z0 + 0.005)]
    # profile coords (n, z); path along u. A = +n (0,1,0), B = +z.  Reverse so the outside is left-clockwise.
    with local(frame):
        p = part(pname)
        fr = [(Vector((u0, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))),
              (Vector((u1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))]
        sweep(p, prof, fr, closed_prof=True, smooth=False, caps=True)


def window_fill(frame, o, lit_seed=0, sash_rows=2, sash_cols=3, backing=True):
    """Frame, sashes, muntins, glass 40 mm behind the frame face, and a shallow room/curtain behind."""
    rv = o.reveal
    fz = -rv                      # frame face
    with local(frame):
        fw = 0.065 if LOD == 0 else 0.07
        pj = part("joinery")
        ol = o.outline()
        closed = o.kind == "circle"
        # outer frame: a closed rectangular section swept round the opening (incl. the bottom)
        loop = ol if closed else ol + []
        frf = outline_frames(loop, 0.0, closed=True)
        prof = ([(fz - 0.10, -fw), (fz - 0.007, -fw), (fz, -fw + 0.007), (fz, 0.0)] if LOD == 0
                else [(fz - 0.10, -fw), (fz, -fw), (fz, 0.0)])   # open: the faces against the reveal are hidden
        sweep(pj, prof, frf, closed_path=True, closed_prof=False, smooth=False)
        if LOD >= 2:
            if o.kind != "circle":
                face(part("backing"), [(o.uc - o.w / 2, fz - 0.05, o.z0), (o.uc + o.w / 2, fz - 0.05, o.z0), (o.uc + o.w / 2, fz - 0.05, o.top()), (o.uc - o.w / 2, fz - 0.05, o.top())], out=(0, 1, 0))
            return
        pg = part("glass")
        hw = o.w / 2 - fw
        if o.kind == "circle":
            r = o.r - fw
            n = 16
            face(pg, [(o.uc + r * math.cos(2 * math.pi * k / n), fz - 0.04, o.z1 + r * math.sin(2 * math.pi * k / n)) for k in range(n)], out=(0, 1, 0))
            if LOD == 0:
                cbox(pj, (o.uc - r, fz - 0.035, o.z1 - 0.012), (o.uc + r, fz - 0.005, o.z1 + 0.012), c=0.003)
                cbox(pj, (o.uc - 0.012, fz - 0.035, o.z1 - r), (o.uc + 0.012, fz - 0.005, o.z1 + r), c=0.003)
            if backing:
                pb = part("backing")
                face(pb, [(o.uc - 0.6, -0.9, o.z1 - 0.6), (o.uc + 0.6, -0.9, o.z1 - 0.6), (o.uc + 0.6, -0.9, o.z1 + 0.6), (o.uc - 0.6, -0.9, o.z1 + 0.6)], out=(0, 1, 0))
            return
        z0 = o.z0 + fw
        spring = o.z1
        # sash split for double-hung: meeting rail at 55 % of the rectangular part
        meet = z0 + (spring - z0) * 0.52 if o.kind == "rect" else z0 + (spring - z0) * 0.55
        sw = 0.045
        # lower sash (set back 40 mm), upper sash at the frame line
        if LOD == 1:
            cbox(pj, (o.uc - hw, fz - 0.05, meet - 0.025), (o.uc + hw, fz, meet + 0.025))
            face(pg, [(o.uc - hw, fz - 0.04, z0), (o.uc + hw, fz - 0.04, z0), (o.uc + hw, fz - 0.04, spring), (o.uc - hw, fz - 0.04, spring)], out=(0, 1, 0))
        for (sa, sb, nf) in (() if LOD == 1 else ((z0, meet + 0.02, fz - 0.045), (meet - 0.02, spring - (0 if o.kind == "rect" else 0.0), fz - 0.005))):
            if o.kind == "rect" and sb > spring:
                sb = spring - fw
            top_edge = sb if o.kind != "rect" else min(sb, spring - fw)
            # stiles and rails: 4 mm arris on every visible edge (v1.2, detail-spec s6; hidden end faces still skipped)
            cs = 0.004 if LOD == 0 else 0.0
            cbox(pj, (o.uc - hw, nf - 0.045, sa), (o.uc - hw + sw, nf, top_edge), c=cs, skip=("-z", "+z", "-x"))
            cbox(pj, (o.uc + hw - sw, nf - 0.045, sa), (o.uc + hw, nf, top_edge), c=cs, skip=("-z", "+z", "+x"))
            cbox(pj, (o.uc - hw + sw, nf - 0.045, sa), (o.uc + hw - sw, nf, sa + (0.07 if sa == z0 else sw)), c=cs, skip=("-x", "+x"))
            cbox(pj, (o.uc - hw + sw, nf - 0.045, top_edge - sw), (o.uc + hw - sw, nf, top_edge), c=cs, skip=("-x", "+x"))
            gz = nf - 0.035
            face(pg, [(o.uc - hw + sw, gz, sa), (o.uc + hw - sw, gz, sa), (o.uc + hw - sw, gz, top_edge), (o.uc - hw + sw, gz, top_edge)], out=(0, 1, 0))
            if LOD == 0:
                mw = 0.02
                for c in range(1, sash_cols):
                    u = o.uc - hw + 2 * hw * c / sash_cols
                    cbox(pj, (u - mw / 2, nf - 0.03, sa), (u + mw / 2, nf - 0.004, top_edge), c=0.003, skip=("-z", "+z"))
                h = top_edge - sa
                for r in range(1, sash_rows):
                    z = sa + h * r / sash_rows
                    cbox(pj, (o.uc - hw, nf - 0.03, z - mw / 2), (o.uc + hw, nf - 0.004, z + mw / 2), c=0.003, skip=("-x", "+x"))
        # head: fanlight for round / segmental heads
        if o.kind in ("round", "seg"):
            cbox(pj, (o.uc - hw, fz - 0.06, spring - 0.03), (o.uc + hw, fz, spring + 0.03), c=0.004 if LOD == 0 else 0.0)
            head = [(u, z) for u, z in o.outline() if z > spring - 1e-6]
            # glass fan
            fan = [(o.uc, fz - 0.035, spring + 0.03)]
            for u, z in head:
                du, dz = u - o.uc, z - spring
                L = math.hypot(du, dz) or 1
                s = max(0.0, 1 - fw / L)
                fan.append((o.uc + du * s, fz - 0.035, spring + dz * s))
            face(pg, fan, out=(0, 1, 0))
            if LOD == 0 and o.kind == "round":
                for ang in (math.pi / 4, math.pi / 2, 3 * math.pi / 4):
                    a = Vector((o.uc, fz - 0.02, spring + 0.03))
                    b = Vector((o.uc + (hw - 0.01) * math.cos(ang), fz - 0.02, spring + (hw - 0.01) * math.sin(ang)))
                    rod(pj, a, b, 0.011, 4)
        if backing and LOD <= 1:
            pb = part("backing")
            pc = part("curtain")
            top = o.top()
            d = WALL_T + 0.9
            x0, x1 = o.uc - o.w / 2 - 0.5, o.uc + o.w / 2 + 0.5
            zb, zt = o.z0 - 0.9, top + 0.5
            # shallow room box behind the window (removed when the interior cell is loaded)
            face(pb, [(x0, -d, zb), (x1, -d, zb), (x1, -d, zt), (x0, -d, zt)], out=(0, 1, 0))
            face(pb, [(x0, -WALL_T - 0.01, zb), (x1, -WALL_T - 0.01, zb), (x1, -d, zb), (x0, -d, zb)], out=(0, 0, 1))
            face(pb, [(x0, -WALL_T - 0.01, zt), (x1, -WALL_T - 0.01, zt), (x1, -d, zt), (x0, -d, zt)], out=(0, 0, -1))
            face(pb, [(x0, -WALL_T - 0.01, zb), (x0, -d, zb), (x0, -d, zt), (x0, -WALL_T - 0.01, zt)], out=(1, 0, 0))
            face(pb, [(x1, -WALL_T - 0.01, zb), (x1, -d, zb), (x1, -d, zt), (x1, -WALL_T - 0.01, zt)], out=(-1, 0, 0))
            # a folded curtain drawn to one side, per-window random amount
            rnd = random.Random(lit_seed)
            side = rnd.choice((-1, 1))
            cw = o.w * rnd.uniform(0.3, 0.6)
            ua = o.uc + side * (o.w / 2 + 0.05)
            ub = ua - side * cw
            n_f = 6 if LOD == 0 else 3
            pts_top, pts_bot = [], []
            for k in range(n_f * 2 + 1):
                u = ua + (ub - ua) * k / (n_f * 2)
                nn = -WALL_T - 0.12 - (0.04 if k % 2 else 0.0)
                pts_top.append((u, nn, top + 0.05))
                pts_bot.append((u, nn, o.z0 - 0.05))
            for k in range(len(pts_top) - 1):
                face(pc, [pts_bot[k], pts_bot[k + 1], pts_top[k + 1], pts_top[k]], out=(0, 1, 0), smooth=True)


def door_leaf(pj, pg, pb, u0, u1, z0, z1, n_face, glazed=True, lod=0, hinge_left=True, knob=True):
    """Panelled leaf in the local frame, face at n_face, thickness 0.05."""
    t = 0.05
    st = 0.11
    c = 0.003 if lod == 0 else 0.0            # v1.2: 3 mm arris on stiles and rails (detail-spec s6)
    nb = n_face - t
    cbox(pj, (u0, nb, z0), (u0 + st, n_face, z1), c=c)
    cbox(pj, (u1 - st, nb, z0), (u1, n_face, z1), c=c)
    cbox(pj, (u0 + st, nb, z0), (u1 - st, n_face, z0 + 0.22), c=c)          # bottom rail
    cbox(pj, (u0 + st, nb, z1 - st), (u1 - st, n_face, z1), c=c)            # top rail
    lock = z0 + 1.0
    cbox(pj, (u0 + st, nb, lock - 0.08), (u1 - st, n_face, lock + 0.08), c=c)  # lock rail
    # lower raised panel
    cbox(pj, (u0 + st, nb + 0.012, z0 + 0.22), (u1 - st, n_face - 0.012, lock - 0.08), c=0)
    if lod == 0:
        cbox(pj, (u0 + st + 0.05, n_face - 0.015, z0 + 0.27), (u1 - st - 0.05, n_face + 0.004, lock - 0.13), c=0.012)
    if glazed:
        face(pg, [(u0 + st, n_face - 0.03, lock + 0.08), (u1 - st, n_face - 0.03, lock + 0.08), (u1 - st, n_face - 0.03, z1 - st), (u0 + st, n_face - 0.03, z1 - st)], out=(0, 1, 0))
        if lod == 0:
            for k in (1, 2):
                z = lock + 0.08 + (z1 - st - lock - 0.08) * k / 3
                cbox(pj, (u0 + st, n_face - 0.035, z - 0.01), (u1 - st, n_face - 0.01, z + 0.01))
            um = (u0 + u1) / 2
            cbox(pj, (um - 0.01, n_face - 0.035, lock + 0.08), (um + 0.01, n_face - 0.01, z1 - st))
    else:
        cbox(pj, (u0 + st, nb + 0.012, lock + 0.08), (u1 - st, n_face - 0.012, z1 - st), c=0)
        if lod == 0:
            cbox(pj, (u0 + st + 0.05, n_face - 0.015, lock + 0.13), (u1 - st - 0.05, n_face + 0.004, z1 - st - 0.05), c=0.012)
    if lod == 0:
        # hardware: 3 butt hinges (knuckles), kick plate, knob with rose and escutcheon
        hu = u0 if hinge_left else u1
        for hz in (z0 + 0.25, (z0 + z1) / 2, z1 - 0.25):
            rod(pb, (hu, n_face + 0.004, hz - 0.05), (hu, n_face + 0.004, hz + 0.05), 0.009, 6)
            cbox(pb, (hu - 0.04 if hinge_left else hu - 0.001, n_face - 0.0, hz - 0.05),
                 (hu + 0.001 if hinge_left else hu + 0.04, n_face + 0.003, hz + 0.05), c=0.001, skip=("-y",))
        cbox(pb, (u0 + 0.02, n_face, z0 + 0.02), (u1 - 0.02, n_face + 0.002, z0 + 0.2), skip=("-y",))
        if knob:
            ku = u1 - 0.07 if hinge_left else u0 + 0.07
            with local(Matrix.Translation((ku, n_face, lock)) @ Matrix.Rotation(-math.pi / 2, 4, "X")):
                lathe(pb, [(0.0, 0.0), (0.028, 0.0), (0.028, 0.004), (0.01, 0.008), (0.009, 0.045), (0.024, 0.055),
                           (0.027, 0.068), (0.02, 0.079), (0.0, 0.082)], seg=10)
            cbox(pb, (ku - 0.018, n_face, lock - 0.1), (ku + 0.018, n_face + 0.003, lock - 0.04), c=0.001)
            cbox(pb, (ku - 0.004, n_face + 0.003, lock - 0.085), (ku + 0.004, n_face + 0.0035, lock - 0.06))


LEAF_NODES = {}   # v1.3: (lod, "<door>_leaf<S|N>") -> pivot data for doors whose leaves are separate, animated nodes


def door_fill(frame, o, leaves=2, glazed=True, open_angle=0.0, n_face=-0.15, threshold=True, leaf_node=None, leaf_z0=None,
              frame_z0=None):
    """leaf_node (v1.3): emit each leaf into its own parts '<leaf_node>_leaf<S|N>_<material>' (closed pose, 3 mm joints to the frame
    and between the leaves) and register its hinge (the knuckle axis) in LEAF_NODES; main() turns them into pivot nodes with
    glTF clips.  leaf_z0 / frame_z0 override the leaf bottom and the frame foot (finished threshold above the masonry sill)."""
    with local(frame):
        pj, pg, pb = part("joinery"), part("glass"), part("brass")
        fw = 0.08
        hw = o.w / 2
        top = o.z1
        fz0 = o.z0 if frame_z0 is None else frame_z0
        # frame (jambs + head)
        cf = 0.005 if LOD == 0 else 0.0
        cbox(pj, (o.uc - hw, n_face - 0.12, fz0), (o.uc - hw + fw, n_face + 0.01, top), c=cf, skip=("-y",))
        cbox(pj, (o.uc + hw - fw, n_face - 0.12, fz0), (o.uc + hw, n_face + 0.01, top), c=cf, skip=("-y",))
        cbox(pj, (o.uc - hw, n_face - 0.12, top - fw), (o.uc + hw, n_face + 0.01, top), c=cf, skip=("-y",))
        if threshold:
            cbox(part("sill"), (o.uc - hw - 0.05, -0.45, o.z0 - 0.02), (o.uc + hw + 0.05, 0.12, o.z0 + 0.03), c=0.01 if LOD == 0 else 0)
        if o.kind in ("seg", "round"):
            # fanlight glass in the arched head above the transom
            head = [(u, z) for u, z in o.outline() if z > top - 1e-6]
            face(pg, [(u, n_face - 0.05, z) for u, z in head], out=(0, 1, 0))
            if LOD == 0:
                for k in (1, 2, 3):
                    u = o.uc - hw + 2 * hw * k / 4
                    cbox(pj, (u - 0.01, n_face - 0.06, top), (u + 0.01, n_face - 0.03, top + o.half(top) * 0 + (o.rise if o.kind == "seg" else o.w / 2) * 0.9))
        if LOD >= 2:
            face(pj, [(o.uc - hw, n_face - 0.03, o.z0), (o.uc + hw, n_face - 0.03, o.z0), (o.uc + hw, n_face - 0.03, top), (o.uc - hw, n_face - 0.03, top)], out=(0, 1, 0))
            return
        inner0, inner1 = o.uc - hw + fw, o.uc + hw - fw
        z0, z1 = o.z0 + 0.03, top - fw
        if leaf_z0 is not None:
            z0 = leaf_z0
        if leaf_node:
            z1 -= 0.003                                     # 3 mm under the head, 3 mm off each jamb: the leaves can swing
            inner0, inner1 = inner0 + 0.003, inner1 - 0.003
        if leaves == 2:
            um = (inner0 + inner1) / 2
            spans = [(inner0, um - 0.003, True), (um + 0.003, inner1, False)]
        else:
            spans = [(inner0, inner1, True)]
        for i, (a, b, hl) in enumerate(spans):
            ang = open_angle if i == 0 else -open_angle
            hinge = a if hl else b
            lj, lg, lb = pj, pg, pb
            if leaf_node:
                ang = 0.0                                   # stated node: built closed, opened by its clip at runtime
                hw_ = MAT @ Vector((hinge, n_face + 0.004, 0.0))     # hinge knuckle axis (door_leaf draws the knuckles there)
                tag = "S" if hw_.y < 0 else "N"
                key = f"{leaf_node}_leaf{tag}"
                lj, lg, lb = part(key + "_joinery", "joinery"), part(key + "_glass", "glass"), part(key + "_brass", "brass")
                # + open_angle about the local z opens toward +n (out of this wall face); local z = world z (right-handed frame)
                LEAF_NODES[(LOD, key)] = dict(door=leaf_node, hinge=tuple(round(v, 5) for v in hw_), openDeg=90.0 if i == 0 else -90.0,
                                              width=round(b - a, 4), z=[round(z0, 4), round(z1, 4)])
            m = Matrix.Translation((hinge, n_face, 0)) @ Matrix.Rotation(ang, 4, "Z") @ Matrix.Translation((-hinge, -n_face, 0))
            with local(m):
                if LOD == 1:
                    cbox(lj, (a, n_face - 0.05, z0), (b, n_face, z1))
                    if glazed:
                        face(lg, [(a + 0.1, n_face + 0.002, z0 + 1.1), (b - 0.1, n_face + 0.002, z0 + 1.1), (b - 0.1, n_face + 0.002, z1 - 0.1), (a + 0.1, n_face + 0.002, z1 - 0.1)], out=(0, 1, 0))
                    continue
                door_leaf(lj, lg, lb, a, b, z0, z1, n_face, glazed=glazed, lod=LOD, hinge_left=hl, knob=(leaves == 1 or i == 1))
        pbk = part("backing_dark")
        face(pbk, [(o.uc - hw - 0.6, -2.5, o.z0), (o.uc + hw + 0.6, -2.5, o.z0), (o.uc + hw + 0.6, -2.5, top + 0.6), (o.uc - hw - 0.6, -2.5, top + 0.6)], out=(0, 1, 0))


def baluster(p, x, y, z0, z1, seg):
    if LOD == 0:
        INSTANCES["baluster"].append([round(x, 4), round(y, 4), round(z0, 4), round(z1 - z0, 4)])
    h = z1 - z0
    prof = ([(0.075, 0.0), (0.045, 0.1), (0.075, 0.34), (0.045, 0.5), (0.042, 0.6), (0.075, 0.72)]
            if seg > 4 else [(0.075, 0.0), (0.05, 0.1), (0.075, 0.34), (0.04, 0.58), (0.07, 0.72)])
    s = h / 0.72
    lathe(p, [(r, z * s) for r, z in prof], centre=(x, y, z0), seg=seg, sq=(lambda z: 4.0) if seg == 4 else None, ang0=math.pi / seg)


BULBS = []   # (position, lod) for the night outline; built into 'bulb' and 'bulb_socket'


def bulb_row(pts, spacing, out_dir=None):
    """Place bulbs along a polyline (world coords) every `spacing` metres."""
    P = [Vector(q) for q in pts]
    acc = spacing / 2
    for a, b in zip(P, P[1:]):
        L = (b - a).length
        s = acc
        while s < L:
            BULBS.append((a + (b - a) * (s / L), out_dir))
            s += spacing
        acc = s - L


INSTANCES = {"bulb": [], "baluster": []}     # LOD0 placements for runtime instancing (written to parts.json)


def emit_bulbs():
    pr, pbu = part("iron"), part("bulb")
    for pos, out in BULBS:
        if LOD <= 1:
            lathe(pbu, [(0.0, -0.06), (0.024, -0.036), (0.0, 0.0)], centre=tuple(pos), seg=4)
        if LOD == 0:
            INSTANCES["bulb"].append([round(pos.x, 4), round(pos.y, 4), round(pos.z, 4)])


# ---------------------------------------------------------------------------------------------
# 5. The building
# ---------------------------------------------------------------------------------------------
def arch_z(x, a=AHS, b=ACR - ASP):
    return ASP + b * math.sqrt(max(0.0, 1 - (x / a) ** 2))


def build_all():
    global BULBS
    BULBS = []
    seg_l = {0: 1.0, 1: 0.5, 2: 0.25}[LOD]
    band_on = LOD <= 1

    # ---- facades: N/S arch screen (recessed 0.25 m), turret faces, E/W side walls, passage walls
    def wz(style_ground=True, top=None):
        pass

    ring_a, ring_b = AHS + RING, (ACR - ASP) + RING
    for face_sign in (1, -1):
        N = Vector((0, face_sign, 0))
        fr = frame_matrix(Vector((0, face_sign * SCREEN_Y, 0)), N)
        # arch hole in the screen: the ring covers the cut edge
        arch_hole = Op("ellipse", 0.0, 2 * (ring_a - SCREEN_RING_OVERLAP), 0.0, ASP, b=ring_b - SCREEN_RING_OVERLAP)
        zones = []
        if band_on:
            zones += zones_std(ASP, FRIEZE0, "band", "wall", course=0.6, g=0.02, d=0.014)
        else:
            zones += zones_std(ASP, FRIEZE0, "flat", "wall")
        zones += zones_std(FRIEZE0, RG, "flat", "wall")
        wall(fr, -TIN, TIN, zones, [arch_hole], step=0.05 / seg_l)
    note("arch screen: scored ashlar render, frieze", "S:157431 S:157437 S:158510 P:plate46",
         "screen recessed 0.25 m behind the turrets (A: from lit turret returns); courses 0.6 m on one grid from the springing (2.9 m), 14 mm V-joints A:")

    # turrets: every exposed face with its openings
    turrets = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            turrets.append((sx, sy))

    def turret_faces(sx, sy):
        """Yield (name, frame, u0, u1, z0, z1, ops) for the turret's exposed faces. Local u via frame."""
        xo, xi = sx * FHW, sx * TIN
        yo, yi = sy * FY, sy * TY0
        cxw = sx * (FHW + TIN) / 2          # turret centre x
        cyw = sy * (FY + TY0) / 2
        out = []
        # front face (outward sy*y)
        frF = frame_matrix(Vector((0, yo, 0)), Vector((0, sy, 0)))
        uF = lambda x: (Vector((x, 0, 0)) @ Vector((1, 0, 0))) * (1 if sy > 0 else -1)
        # U for N=+y is +x; for N=-y is -x
        ucF = cxw * (1 if sy > 0 else -1)
        uF0, uF1 = sorted(((xo) * (1 if sy > 0 else -1), (xi) * (1 if sy > 0 else -1)))
        out.append(("front", frF, uF0, uF1, ucF))
        # outer side (outward sx*x): U for N=+x is -y, for N=-x is +y
        frS = frame_matrix(Vector((xo, 0, 0)), Vector((sx, 0, 0)))
        s = -1 if sx > 0 else 1
        uS0, uS1 = sorted((yo * s, yi * s))
        out.append(("side", frS, uS0, uS1, cyw * s))
        # inner side (towards the axis, outward -sx*x)
        frI = frame_matrix(Vector((xi, 0, 0)), Vector((-sx, 0, 0)))
        s2 = -1 if -sx > 0 else 1
        uI0, uI1 = sorted((yo * s2, yi * s2))
        out.append(("inner", frI, uI0, uI1, cyw * s2, (yo * s2, (sy * SCREEN_Y) * s2)))
        # back face (towards the deck, outward -sy*y)
        frB = frame_matrix(Vector((0, yi, 0)), Vector((0, -sy, 0)))
        s3 = 1 if -sy > 0 else -1
        uB0, uB1 = sorted((xo * s3, xi * s3))
        out.append(("back", frB, uB0, uB1, cxw * s3))
        return out

    win_seed = [0]

    def add_window(fr, o, backing=True):
        win_seed[0] += 1
        reveal(fr, o, WALL_T, "reveal")
        surround(fr, o)
        if o.kind != "circle":
            sill(fr, o)
        window_fill(fr, o, lit_seed=win_seed[0], backing=backing)
        WINDOWS.append((fr, o))

    for sx, sy in turrets:
        faces = turret_faces(sx, sy)
        name = ("N" if sy > 0 else "S") + ("E" if sx > 0 else "W")
        for f in faces:
            kind, fr, u0, u1, uc = f[:5]
            ops = []
            doors = []
            if kind in ("front", "side"):
                # L1-L3 single windows with segmental heads, T4 paired round-headed lights (S:157431/157437)
                for zs, zt in ((5.8, 7.45), (9.3, 10.85), (12.7, 14.25)):
                    ops.append(Op("seg", uc, 1.0, zs, zt, rise=0.15, tag="L"))
                ops.append(Op("round", uc - 0.55, 0.8, 16.1, 18.0, tag="T4"))
                ops.append(Op("round", uc + 0.55, 0.8, 16.1, 18.0, tag="T4"))
                if kind == "front":
                    doors.append(Op("seg", uc, 1.2, 0.0, 2.55, rise=0.15, tag="door_turret_street_" + name))
                else:
                    ops.append(Op("rect", uc, 0.9, 1.5, 3.3, tag="L0"))
                zones = []
                zones += zones_std(0.0, PLINTH - 0.06, "flat", "plinth", offset=0.06)
                zones += [(PLINTH - 0.06, PLINTH, "plinth", 0.06, 0.0)]
                zones += zones_std(PLINTH, GROUND_TOP, "band" if band_on else "flat", "wall", course=0.5, g=0.035, d=0.03)
                zones += zones_std(GROUND_TOP, 4.7, "flat", "wall")
                zones += zones_std(4.7, 14.3, "band" if band_on else "flat", "wall", course=0.6, g=0.02, d=0.014)
                zones += zones_std(14.3, 15.5, "flat", "wall")
                zones += zones_std(15.5, 18.5, "band" if band_on else "flat", "wall", course=0.6, g=0.02, d=0.014)
                zones += zones_std(18.5, TCORN0 + 0.3, "flat", "wall")
                wall(fr, u0, u1, zones, ops + doors, step=0.04 / seg_l)
                for o in ops:
                    add_window(fr, o)
                for o in doors:
                    reveal(fr, o, WALL_T, "reveal")
                    surround(fr, o)
                    door_fill(fr, o, leaves=1, glazed=True, open_angle=0.0)
                    DOORS.append((fr, o))
            elif kind == "inner":
                yo_s, yscr_s = f[5]
                # below the deck only the 0.25 m return beside the screen is exposed (from the springing up)
                a0, a1 = sorted((yo_s, yscr_s))
                zones = zones_std(ASP, RG, "flat", "wall")
                wall(fr, a0, a1, zones, [])
                # above the deck the whole inner face is exposed: T4 pair or the SW lift transfer door
                ops = []
                doors = []
                if name == "SW":
                    doors.append(Op("seg", uc, 1.8, RG, RG + 2.6, rise=0.15, tag="door_lift_transfer_SW"))
                else:
                    ops.append(Op("round", uc - 0.55, 0.8, 16.1, 18.0, tag="T4"))
                    ops.append(Op("round", uc + 0.55, 0.8, 16.1, 18.0, tag="T4"))
                zones = zones_std(RG, 15.5, "flat", "wall") + zones_std(15.5, 18.5, "band" if band_on else "flat", "wall", course=0.6, g=0.02, d=0.014) + zones_std(18.5, TCORN0 + 0.3, "flat", "wall")
                wall(fr, u0, u1, zones, ops + doors)
                for o in ops:
                    add_window(fr, o)
                for o in doors:
                    reveal(fr, o, WALL_T, "reveal")
                    surround(fr, o)
                    door_fill(fr, o, leaves=2, glazed=True, open_angle=0.0)
                    hood(fr, o)
                    bell_push(fr, o)
                    DOORS.append((fr, o))
            elif kind == "back":
                doors = [Op("seg", uc, 1.4, RG, RG + 2.35, rise=0.15, tag="door_stairhead_" + name)]
                zones = zones_std(RG, 15.5, "flat", "wall") + zones_std(15.5, 18.5, "band" if band_on else "flat", "wall", course=0.6, g=0.02, d=0.014) + zones_std(18.5, TCORN0 + 0.3, "flat", "wall")
                wall(fr, u0, u1, zones, doors)
                for o in doors:
                    reveal(fr, o, WALL_T, "reveal")
                    surround(fr, o)
                    # stair heads: one leaf stands open (implied event: someone just went down)
                    door_fill(fr, o, leaves=2, glazed=False, open_angle=(-1.6 if name == "NE" else 0.0))
                    hood(fr, o)
                    DOORS.append((fr, o))
        turret_top(sx, sy)
        quoins(sx, sy)
    note("turrets: faces, windows L1-L3 (segmental), T4 paired round-headed lights, street doors",
         "S:157431 S:157437 S:158510 (paired upper lights, gables with oculi, caps with lanterns) T:fr.268 (stair exits form the turrets)",
         "window sizes and levels A: (fit to INTERFACE floor levels); street doors A:")

    # E/W side walls between the turrets (party walls to the cinema wings below ~9.5 m)
    for sx in (-1, 1):
        fr = frame_matrix(Vector((sx * FHW, 0, 0)), Vector((sx, 0, 0)))
        s = -1 if sx > 0 else 1
        u0, u1 = sorted((TY0 * s, -TY0 * s))
        ops = [Op("seg", s * yy, 1.0, 12.6, 14.0, rise=0.1, tag="window_hall_L3") for yy in (-5.0, 0.0, 5.0)]
        doors = [Op("seg", 0.0, 2.4, 0.0, 3.2, rise=0.2, tag="door_wing_" + ("E" if sx > 0 else "W"))]
        zones = zones_std(0.0, PLINTH - 0.06, "flat", "plinth", offset=0.06) + [(PLINTH - 0.06, PLINTH, "plinth", 0.06, 0.0)]
        zones += zones_std(PLINTH, GROUND_TOP, "band" if band_on else "flat", "wall", course=0.5, g=0.035, d=0.03)
        zones += zones_std(GROUND_TOP, 4.7, "flat", "wall")
        zones += zones_std(4.7, 14.3, "band" if band_on else "flat", "wall", course=0.6, g=0.02, d=0.014)
        zones += zones_std(14.3, RG, "flat", "wall")
        wall(fr, u0, u1, zones, ops + doors, step=0.04 / seg_l)
        for o in ops:
            add_window(fr, o)
        for o in doors:
            reveal(fr, o, WALL_T, "reveal")
            surround(fr, o)
            # v1.3: finished threshold at 0.15 (= ticket hall, wing zone and cinema floors; the masonry sill of the opening stays at
            # 0.00, INTERFACE datum) and an oak saddle 15 mm high under the leaves; the leaves are stated nodes (closed by default)
            # opening 90 deg into the wing (glTF clips door_wing_<E|W>_open / _close).
            with local(fr):
                hw = o.w / 2
                face(part("sill"), [(o.uc - hw, 0.0, WING_DOOR_FLOOR), (o.uc + hw, 0.0, WING_DOOR_FLOOR), (o.uc + hw, -WALL_T, WING_DOOR_FLOOR),
                                    (o.uc - hw, -WALL_T, WING_DOOR_FLOOR)], out=(0, 0, 1))
                sad = [(0.07, WING_DOOR_FLOOR), (0.045, WING_DOOR_FLOOR + 0.015), (-0.055, WING_DOOR_FLOOR + 0.015), (-0.08, WING_DOOR_FLOOR)]
                nf = -0.15 - 0.025                     # saddle centred under the leaves (leaf n -0.20..-0.15)
                ends = [(Vector((o.uc - hw + 0.08, nf, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))),
                        (Vector((o.uc + hw - 0.08, nf, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))]
                sweep(part("joinery"), sad, ends, smooth=False, caps=True)
            door_fill(fr, o, leaves=2, glazed=True, threshold=False, leaf_node=o.tag, leaf_z0=WING_DOOR_FLOOR + 0.022,
                      frame_z0=WING_DOOR_FLOOR)
            DOORS.append((fr, o))
    note("E/W side walls: party walls to the cinema wings, wing doors, L3 windows",
         "T:fr.267 (wings 各四十有餘間) T:fr.270 (cinemas beside the tower)", "wing height 9.5 m and door positions A:")

    # passage walls (x = +/-10.05, facing the axis), 0..springing
    for sx in (-1, 1):
        fr = frame_matrix(Vector((sx * TIN, 0, 0)), Vector((-sx, 0, 0)))
        s = -1 if -sx > 0 else 1
        u0, u1 = sorted((FY * s, -FY * s))
        doors = [Op("rect", s * yy, 1.8, 0.0, 2.6, tag="door_hall") for yy in (-4.6, 4.6)]
        ops = [Op("rect", 0.0, 1.4, 1.0, 2.4, tag="ticket_window" if sx < 0 else "east_window")]
        zones = zones_std(0.0, PLINTH - 0.06, "flat", "plinth", offset=0.06) + [(PLINTH - 0.06, PLINTH, "plinth", 0.06, 0.0)]
        zones += zones_std(PLINTH, ASP, "band" if band_on else "flat", "wall", course=0.5, g=0.035, d=0.03)
        wall(fr, u0, u1, zones, ops + doors, step=0.04 / seg_l)
        for o in ops:
            add_window(fr, o, backing=True)
        for o in doors:
            reveal(fr, o, WALL_T, "reveal")
            surround(fr, o)
            door_fill(fr, o, leaves=2, glazed=True, open_angle=(0.35 if (sx < 0 and o.uc * s > 0) else 0.0))
            DOORS.append((fr, o))
        # impost / springing course (2.9..3.12) along the passage wall
        with local(fr):
            p = part("trim")
            prof = [(0.0, ASP - 0.0), (0.06, ASP), (0.06, ASP + 0.05), (0.12, ASP + 0.1), (0.14, ASP + 0.2), (0.0, ASP + 0.22)]
            fr2 = [(Vector((u0, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), (Vector((u1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))]
            sweep(p, prof, fr2, smooth=False, caps=True)
    note("passage walls: ticket-hall doors, ticket window, impost course", "T:fr.268 (arch passage) A: door/window positions (INTERFACE.md)")

    arch_ring_and_vault()
    cornices_and_frieze()
    deck_and_balustrade()
    services()
    interior_shell()
    turret_stair_heads()
    inner_faces()
    emit_bulbs()


WINDOWS, DOORS = [], []


def bell_push(fr, o):
    """Electric bell push beside the lift transfer door (detail-spec §6 'one raised button'), and a blank
    enamel notice plate (no text: fictional/none). Porcelain rose with two slotted screws, brass push."""
    if LOD >= 2:
        return
    u = o.uc + o.w / 2 + 0.36
    z = o.z0 + 1.32
    pp, pb, pi = part("porcelain"), part("brass"), part("iron")
    seg = 24 if LOD == 0 else 8
    with local(fr @ Matrix.Translation((u, 0.0, z)) @ Matrix.Rotation(-math.pi / 2, 4, "X")):
        # rose: stepped disc 4 mm + 8 mm, bevelled rim
        lathe(pp, [(0.0, 0.0), (0.048, 0.0), (0.05, 0.003), (0.048, 0.008), (0.036, 0.012), (0.03, 0.016), (0.02, 0.017)], seg=seg)
        if LOD == 0:
            # brass push: ring groove, 2.5 mm proud, 0.4 mm bevel
            lathe(pb, [(0.02, 0.017), (0.018, 0.0175), (0.0165, 0.017), (0.0165, 0.0185), (0.012, 0.019), (0.0115, 0.0195),
                       (0.0115, 0.0205), (0.011, 0.0215), (0.0, 0.0218)], seg=seg)
            for dx in (-0.033, 0.033):
                with local(Matrix.Translation((dx, 0.0, 0.006))):
                    lathe(pb, [(0.0, 0.0), (0.0042, 0.0), (0.0042, 0.0006), (0.003, 0.0016), (0.0, 0.0019)], seg=8)
                    cbox(pi, (-0.0038, -0.0005, 0.0012), (0.0038, 0.0005, 0.0021))
    if LOD == 0:
        # blank enamel plate above the push, 4 mm, rounded corners approximated by a chamfer, 4 screws
        with local(fr):
            pu, pz = u, z + 0.33
            cbox(part("enamel"), (pu - 0.11, 0.0, pz - 0.15), (pu + 0.11, 0.004, pz + 0.15), c=0.0015, skip=("-y",))
            for dx in (-0.09, 0.09):
                for dz in (-0.13, 0.13):
                    with local(Matrix.Translation((pu + dx, 0.004, pz + dz)) @ Matrix.Rotation(-math.pi / 2, 4, "X")):
                        lathe(pb, [(0.0, 0.0), (0.004, 0.0), (0.003, 0.0012), (0.0, 0.0015)], seg=6)
            # cloth-covered bell wire running from the push to the door head (stapled)
            pts = [(u + 0.03, 0.006, z + 0.035), (u + 0.075, 0.006, z + 0.09), (u + 0.15, 0.006, z + 0.12), (u + 0.15, 0.006, o.top() + 0.25), (o.uc + o.w / 2 + 0.25, 0.006, o.top() + 0.35)]
            with local(Matrix.Identity(4)):
                pass
            tube(part("wire"), pts, 0.0025, 4)
    note("bell push and blank notice plate at the lift transfer door", "detail-spec §6 (raised control); A: electric bell pushes in 1912 Osaka († unverified)", "")


def hood(fr, o):
    """Small bracketed canopy over a roof-level door ('roofed opening')."""
    with local(fr):
        top = o.top() + 0.2
        w = o.w + 0.6
        p = part("roof_sheet")
        pi = part("iron")
        d = 0.75
        z_back, z_front = top + 0.35, top + 0.12
        # boarded soffit + sheet roof, slight fall outwards
        cbox(part("joinery"), (o.uc - w / 2, 0.0, z_back - 0.06), (o.uc + w / 2, 0.06, z_back), c=0.004)
        pts = [(o.uc - w / 2 - 0.05, 0.0, z_back + 0.02), (o.uc + w / 2 + 0.05, 0.0, z_back + 0.02),
               (o.uc + w / 2 + 0.05, d, z_front + 0.02), (o.uc - w / 2 - 0.05, d, z_front + 0.02)]
        face(p, pts, out=(0, 0, 1))
        face(p, [(q[0], q[1], q[2] - 0.035) for q in pts], out=(0, 0, -1))
        face(p, [pts[3], pts[2], (pts[2][0], pts[2][1], pts[2][2] - 0.035), (pts[3][0], pts[3][1], pts[3][2] - 0.035)], out=(0, 1, 0))
        for side in (-1, 1):
            u = o.uc + side * (w / 2 - 0.08)
            # scrolled iron bracket: a curved strut plus a straight arm
            arc = [(u, 0.02 + (d - 0.1) * (1 - math.cos(t * math.pi / 2)), z_front - 0.02 - 0.55 * (1 - math.sin(t * math.pi / 2))) for t in [k / 6 for k in range(7)]]
            arc = [(u, 0.02 + (d - 0.1) * math.sin(t * math.pi / 2), top - 0.4 + (z_front - top + 0.36) * (1 - math.cos(t * math.pi / 2))) for t in [k / 6 for k in range(7)]]
            tube(pi, arc, 0.014, 5)
            rod(pi, (u, 0.0, z_front - 0.02), (u, d - 0.05, z_front - 0.02), 0.012, 4)
            if LOD == 0:
                lathe(pi, [(0.0, 0.0), (0.025, 0.0), (0.025, 0.012), (0.0, 0.014)], centre=(0, 0, 0), seg=6) if False else None


def quoins(sx, sy):
    """Rusticated corner quoins on the turret shafts (smooth zone 4.9..19.0), alternating long/short."""
    p = part("trim")
    if LOD >= 2:
        return
    x_o, x_i = sx * FHW, sx * TIN
    y_o, y_i = sy * FY, sy * TY0
    corners = [(x_o, y_o, 4.9, TCORN0), (x_i, y_o, 4.9, TCORN0)]
    h = 0.55
    for cx, cy, z0, z1 in corners:
        dx = 1 if cx > 0 else -1          # outward x direction at this corner
        if abs(cx) < 11:
            dx = -dx if abs(cx - x_i) < 1e-6 else dx
        dx = sx if abs(cx - x_o) < 1e-6 else -sx
        dy = sy if abs(cy - y_o) < 1e-6 else -sy
        n = int((z1 - z0) / h)
        for k in range(n):
            za, zb = z0 + k * h + 0.012, z0 + (k + 1) * h - 0.012
            if TBAND0 - 0.05 < zb and za < CORNICE_TOP + 0.05:
                continue
            long_x = k % 2 == 0
            lx = 0.62 if long_x else 0.36
            ly = 0.36 if long_x else 0.62
            pr = 0.035
            # block hugging the corner: extends inward (-dx) along x and (-dy) along y
            x_lo, x_hi = sorted((cx + dx * pr, cx - dx * lx))
            y_lo, y_hi = sorted((cy + dy * pr, cy - dy * ly))
            cbox(p, (x_lo, y_lo, za), (x_hi, y_hi, zb), c=0.018 if LOD == 0 else 0.0, jitter=0.4)          # v1.2: inner quoins bevelled too
    if sx == 1 and sy == 1:
        note("turret quoins", "S:157437 (light corner strips on the turrets)", "0.55 m courses, 35 mm proud A:")


def turret_top(sx, sy):
    cx = sx * (FHW + TIN) / 2
    cy = sy * (FY + TY0) / 2
    hx = (FHW - TIN) / 2     # 2.225
    hy = (FY - TY0) / 2      # 2.2
    pt, ps, pi = part("trim"), part("roof_sheet"), part("iron")
    seg = {0: 20, 1: 12, 2: 8}[LOD]
    # turret band (continues the corona of the main cornice) and the turret cornice with modillions
    loop = [(cx - hx, cy - hy), (cx + hx, cy - hy), (cx + hx, cy + hy), (cx - hx, cy + hy)]
    band = [(0.0, TBAND0), (0.05, TBAND0), (0.05, TBAND0 + 0.06), (0.24, TBAND0 + 0.12), (0.30, TBAND0 + 0.14),
            (0.30, TBAND0 + 0.34), (0.33, TBAND0 + 0.37), (0.33, TBAND0 + 0.42), (0.0, TBAND0 + 0.5)]
    corn = [(0.0, TCORN0), (0.06, TCORN0), (0.06, TCORN0 + 0.07), (0.16, TCORN0 + 0.17), (0.34, TCORN0 + 0.2),
            (0.36, TCORN0 + 0.22), (0.36, TCORN0 + 0.42), (0.40, TCORN0 + 0.46), (0.40, TCORN0 + 0.52), (0.0, TBT)]
    string = [(0.0, GROUND_TOP), (0.06, GROUND_TOP), (0.12, GROUND_TOP + 0.08), (0.12, GROUND_TOP + 0.24), (0.0, STRING_TOP)]
    if LOD == 2:
        band = [(0.0, TBAND0), (0.3, TBAND0 + 0.12), (0.33, TBAND0 + 0.42), (0.0, TBAND0 + 0.5)]
        corn = [(0.0, TCORN0), (0.36, TCORN0 + 0.2), (0.40, TCORN0 + 0.52), (0.0, TBT)]
    sweep(pt, band, hframes(loop, closed=True), closed_path=True, smooth=False)
    sweep(pt, corn, hframes(loop, closed=True), closed_path=True, smooth=False)
    # string course around the two outer faces only (the others are inside the building below the deck)
    xo, yo = cx + sx * hx, cy + sy * hy
    xi = cx - sx * hx
    path = [(xi, yo), (xo, yo), (xo, cy - sy * hy)]
    fr = hframes(path, closed=False, outward_sign=-sx * sy)
    sweep(pt, string, fr, smooth=False, caps=True)
    if LOD <= 1:
        # modillions under the turret cornice corona
        for (a, b), (c_, d_) in zip(loop, loop[1:] + loop[:1]):
            L = math.dist((a, b), (c_, d_))
            t = Vector(((c_ - a) / L, (d_ - b) / L, 0))
            nrm = t.cross(Vector((0, 0, 1)))
            n = int(L / 0.5)
            for k in range(1, n):
                P0 = Vector((a, b, 0)) + t * (L * k / n)
                m = frame_matrix(P0, nrm)
                with local(m):
                    cbox(pt, (-0.045, 0.0, TCORN0 + 0.07), (0.045, 0.3, TCORN0 + 0.2), skip=("-y", "+z"))
    # gables with an oculus on each face (S:157437 curved gable heads; S:157431 oculi)
    gw = 2 * hx
    g_top = TBT + 0.72
    for k, (a, b) in enumerate(zip(loop, loop[1:] + loop[:1])):
        mid = Vector(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0))
        t = (Vector((b[0], b[1], 0)) - Vector((a[0], a[1], 0))).normalized()
        nrm = t.cross(Vector((0, 0, 1)))
        fr = frame_matrix(mid - nrm * 0.02, nrm)
        L = (Vector(b) - Vector(a)).length
        # segmental gable outline: arc from (-L/2+0.25, TBT) up to g_top
        hw = L / 2 - 0.3
        rise = g_top - TBT - 0.25
        R = (hw * hw + rise * rise) / (2 * rise)
        zc = TBT + 0.25 + rise - R
        n = {0: 14, 1: 8, 2: 5}[LOD]
        arc = [(-hw + 2 * hw * i / n, zc + math.sqrt(max(0, R * R - (-hw + 2 * hw * i / n) ** 2))) for i in range(n + 1)]
        oc = Op("circle", 0.0, 0.0, 0.0, z1=TBT + 0.33, r=0.17)
        with local(fr):
            # gable wall: flat pieces between the arc and the base, with the oculus hole
            outline = [(-hw, TBT)] + arc + [(hw, TBT)]
            gw_part = part("wall")
            # vertical strips from the cornice top to the arc; strips through the oculus leave the hole
            zarc = lambda u: zc + math.sqrt(max(0.0, R * R - u * u))
            n_hole = {0: 12, 1: 8, 2: 6}[LOD]
            us = sorted(set([round(u, 5) for u, _ in arc] +
                            [round(oc.r * math.cos(math.pi - math.pi * k / n_hole), 5) for k in range(n_hole + 1)]))
            for ua, ub in zip(us, us[1:]):
                um = (ua + ub) / 2
                if abs(um) < oc.r - 1e-6:
                    ha = math.sqrt(max(0.0, oc.r ** 2 - ua ** 2))
                    hb = math.sqrt(max(0.0, oc.r ** 2 - ub ** 2))
                    face(gw_part, [(ua, 0, TBT), (ub, 0, TBT), (ub, 0, oc.z1 - hb), (ua, 0, oc.z1 - ha)], out=(0, 1, 0))
                    face(gw_part, [(ua, 0, oc.z1 + ha), (ub, 0, oc.z1 + hb), (ub, 0, zarc(ub)), (ua, 0, zarc(ua))], out=(0, 1, 0))
                else:
                    face(gw_part, [(ua, 0, TBT), (ub, 0, TBT), (ub, 0, zarc(ub)), (ua, 0, zarc(ua))], out=(0, 1, 0))
            # the gable's back (roof side) so it is not paper-thin from above
            face(gw_part, [(-hw, -0.3, TBT), (hw, -0.3, TBT)] + [(u, -0.3, z) for u, z in reversed(arc)][::-1][::-1], out=(0, -1, 0)) if False else None
            # coping: a moulded cap swept along the arc
            ol = [(-hw - 0.08, TBT + 0.02)] + arc + [(hw + 0.08, TBT + 0.02)]
            cop = [(-0.34, 0.0), (0.06, -0.0), (0.06, 0.05), (0.09, 0.08), (0.09, 0.13), (-0.34, 0.16)]
            if LOD == 2:
                cop = [(-0.34, 0.0), (0.09, 0.0), (0.09, 0.13), (-0.34, 0.16)]
            frs = []
            for i, (u, z) in enumerate(arc):
                if 0 < i < len(arc) - 1:
                    tt = Vector((arc[i + 1][0] - arc[i - 1][0], 0, arc[i + 1][1] - arc[i - 1][1])).normalized()
                elif i == 0:
                    tt = Vector((arc[1][0] - arc[0][0], 0, arc[1][1] - arc[0][1])).normalized()
                else:
                    tt = Vector((arc[-1][0] - arc[-2][0], 0, arc[-1][1] - arc[-2][1])).normalized()
                up = Vector((-tt.z, 0, tt.x))
                frs.append((Vector((u, 0, z)), Vector((0, 1, 0)), up))
            sweep(pt, [(a_, b_) for a_, b_ in cop], frs, smooth=False, caps=True)
            # oculus: reveal, moulded ring, frame, cross muntins, glass, dark void behind
            reveal(fr, oc, 0.3, "reveal") if False else None
        reveal(fr, oc, 0.3, "reveal")
        surround(fr, oc, key=False)
        window_fill(fr, Op("circle", 0.0, 0.0, 0.0, z1=TBT + 0.33, r=0.17, reveal=0.12), backing=True)
        if LOD <= 1:
            # bulbs along the gable coping
            pts = [fr @ Vector((u, 0.12, z + 0.2)) for u, z in arc]
            bulb_row(pts, 0.55)
    # bell-shaped cap (square below, round at the neck), ribs and standing seams, lantern, finial
    base = min(hx, hy) - 0.12
    prof = [(base + 0.1, TBT - 0.05), (base + 0.12, TBT + 0.08), (base + 0.05, TBT + 0.4), (base - 0.12, TBT + 0.85),
            (base - 0.46, TBT + 1.3), (base - 0.93, TBT + 1.65), (0.75, TBT + 1.85), (0.5, TBT + 1.95), (0.44, TBT + 1.98)]
    if LOD == 2:
        prof = [prof[0], prof[2], prof[4], prof[6], prof[-1]]
    sq = lambda z: max(2.0, 7.0 - 5.0 * min(1.0, max(0.0, (z - TBT) / 1.95)))
    lathe(ps, prof, centre=(cx, cy, 0), seg=32 if LOD == 0 else seg, sq=sq, ang0=0.0)
    if LOD <= 1:
        # ribs: 4 corner + 4 mid-face, bulbs on the corner ribs (S:157871 outlined turret caps)
        for k in range(8):
            th = math.pi / 4 * k
            c, s = math.cos(th), math.sin(th)
            pts = []
            for r, z in prof[:-1]:
                e = sq(z)
                fx = math.copysign(abs(c) ** (2 / e), c)
                fy = math.copysign(abs(s) ** (2 / e), s)
                pts.append((cx + (r + 0.03) * fx, cy + (r + 0.03) * fy, z + 0.01))
            tube(pi if k % 2 else ps, pts, 0.045 if k % 2 == 1 else 0.03, 5)
            if k % 2 == 1:
                bulb_row([(x + 0.06 * c, y + 0.06 * s, z + 0.04) for x, y, z in pts], 0.5)
        if LOD == 0:
            # standing seams between the ribs
            for k in range(16):
                if k % 2 == 0:
                    continue
                th = 2 * math.pi * k / 16
                c, s = math.cos(th), math.sin(th)
                pts = []
                for r, z in prof[1:-2]:
                    e = sq(z)
                    fx = math.copysign(abs(c) ** (2 / e), c)
                    fy = math.copysign(abs(s) ** (2 / e), s)
                    pts.append((cx + (r + 0.008) * fx, cy + (r + 0.008) * fy, z))
                tube(ps, pts, 0.012, 3)
    # lantern: 8 posts on a ring, cap, finial with a ball (heights end at v4 TURRET_DOME_TOP / FINIAL_TOP)
    lz0 = TBT + 1.98
    lathe(pt, [(0.5, lz0), (0.52, lz0 + 0.04), (0.44, lz0 + 0.08)], centre=(cx, cy, 0), seg=seg, cap_top=False)
    npost = 8 if LOD <= 1 else 4
    for k in range(npost):
        th = 2 * math.pi * (k + 0.5) / npost
        a = (cx + 0.4 * math.cos(th), cy + 0.4 * math.sin(th), lz0 + 0.08)
        b = (a[0], a[1], TDT - 0.3)
        if LOD <= 1:
            cbox(pt, (a[0] - 0.045, a[1] - 0.045, a[2]), (a[0] + 0.045, a[1] + 0.045, b[2]))
        else:
            rod(pt, a, b, 0.05, 4)
    face(part("backing"), [(cx - 0.3, cy - 0.3, lz0 + 0.08), (cx + 0.3, cy - 0.3, lz0 + 0.08), (cx + 0.3, cy + 0.3, lz0 + 0.08), (cx - 0.3, cy + 0.3, lz0 + 0.08)], out=(0, 0, 1))
    lathe(pi if False else ps, [(0.5, TDT - 0.3), (0.52, TDT - 0.26), (0.46, TDT - 0.18), (0.3, TDT - 0.06), (0.1, TDT), (0.05, TDT + 0.02)],
          centre=(cx, cy, 0), seg=seg, cap_bot=True)
    fin = [(0.05, TDT), (0.035, TDT + 0.08), (0.07, TDT + 0.14), (0.075, TDT + 0.2), (0.05, TDT + 0.26), (0.02, TDT + 0.3),
           (0.018, TFT - 0.12), (0.03, TFT - 0.1), (0.018, TFT - 0.08), (0.0, TFT)]
    lathe(pi, fin, centre=(cx, cy, 0), seg=8 if LOD == 0 else 5)
    if LOD <= 1:
        # bulbs along the turret cornice front edge and the two front corners (S:157871)
        e = 0.42
        for (a, b), (c_, d_) in zip(loop, loop[1:] + loop[:1]):
            A = Vector((a, b, 0))
            Bv = Vector((c_, d_, 0))
            t = (Bv - A).normalized()
            nrm = t.cross(Vector((0, 0, 1)))
            bulb_row([A + nrm * e + t * 0.1 + Vector((0, 0, TCORN0 + 0.46)), Bv + nrm * e - t * 0.1 + Vector((0, 0, TCORN0 + 0.46))], 0.34)
        for cxx, cyy, z0 in ((sx * FHW, sy * FY, STRING_TOP + 0.1), (sx * TIN, sy * FY, 6.6)):
            dx = 0.07 * (1 if cxx > 0 else -1) * (1 if abs(abs(cxx) - FHW) < 1e-6 else -1)
            dy = 0.07 * sy
            bulb_row([(cxx + dx, cyy + dy, z0), (cxx + dx, cyy + dy, TBAND0 - 0.05)], 0.6)
            bulb_row([(cxx + dx, cyy + dy, CORNICE_TOP + 0.1), (cxx + dx, cyy + dy, TCORN0 - 0.05)], 0.6)


def arch_ring_and_vault():
    pt, pw = part("trim"), part("vault")
    a_i, b_i = AHS, ACR - ASP
    nv = {0: 33, 1: 25, 2: 13}[LOD]
    kstone = nv // 2

    def ell(th, off=0.0):
        """Point and outward normal (in x-z) on the intrados ellipse offset by `off` along the normal."""
        x, z = a_i * math.cos(th), b_i * math.sin(th)
        nx, nz = math.cos(th) / a_i, math.sin(th) / b_i
        L = math.hypot(nx, nz)
        nx, nz = nx / L, nz / L
        return Vector((x + nx * off, 0, ASP + z + nz * off)), Vector((nx, 0, nz))

    for fs in (1, -1):
        y_face = fs * (SCREEN_Y + 0.12)
        y_back = fs * (SCREEN_Y - 0.6)
        for i in range(nv):
            th0 = math.pi * i / nv
            th1 = math.pi * (i + 1) / nv
            gap = 0.012 / max(a_i, b_i)
            th0 += gap
            th1 -= gap
            is_key = i == kstone
            ring = RING + (0.45 if is_key else (0.12 if i % 2 else 0.0))
            proj = 0.25 if is_key else 0.0
            sub = 3 if LOD == 0 else 2
            ths = [th0 + (th1 - th0) * k / sub for k in range(sub + 1)]
            inner = [ell(t, 0.0)[0] for t in ths]
            outer = [ell(t, ring)[0] for t in ths]
            # v1.2: the springing voussoirs reach |x| 11.07, i.e. through the turret inner walls into the stair shafts (hidden from
            # outside behind the turret fronts): clamp every ring point to the shaft face |x| <= 10.50
            lim = TIN + WALL_T
            outer = [Vector((max(-lim, min(lim, v.x)), 0, v.z)) for v in outer]
            if is_key:
                # keystone: straight-sided, wider at the top
                mid = ell((th0 + th1) / 2, 0)[0]
                top = ell((th0 + th1) / 2, ring)[0]
                hw0 = (inner[0] - inner[-1]).length / 2
                hw1 = hw0 + 0.12
                outer = [Vector((mid.x + hw1, 0, top.z)), Vector((mid.x - hw1, 0, top.z))]
                inner = [Vector((mid.x + hw0, 0, inner[0].z)), Vector((mid.x - hw0, 0, inner[-1].z))]
            c = 0.03 if LOD == 0 else 0.0
            yf = y_face + fs * proj
            # front face (chamfered border: inset polygon at the face, bevel ring to the edge)
            poly = inner + outer[::-1]
            ctr = sum(poly, Vector()) / len(poly)
            def at(v, y):
                return Vector((v.x, y, v.z))
            if c > 0:
                inset = [ctr + (v - ctr) * (1 - c / max(0.2, (v - ctr).length)) for v in poly]
                face(pt, [at(v, yf) for v in inset], out=(0, fs, 0))
                for k in range(len(poly)):
                    a, b = poly[k], poly[(k + 1) % len(poly)]
                    ia, ib = inset[k], inset[(k + 1) % len(poly)]
                    face(pt, [at(a, yf - fs * c), at(b, yf - fs * c), at(ib, yf), at(ia, yf)], out=((a + b) / 2 - ctr) + Vector((0, fs * 0.5, 0)))
                yf2 = yf - fs * c
            else:
                face(pt, [at(v, yf) for v in poly], out=(0, fs, 0))
                yf2 = yf
            # soffit (intrados) strips, extrados, joints
            for k in range(len(inner) - 1):
                a, b = inner[k], inner[k + 1]
                face(pt, [at(a, yf2), at(b, yf2), at(b, y_back), at(a, y_back)], out=-(ell((ths[0] + ths[-1]) / 2)[1]) if not is_key else (0, 0, -1))
            for k in range(len(outer) - 1):
                a, b = outer[k], outer[k + 1]
                face(pt, [at(a, yf2), at(b, yf2), at(b, fs * (SCREEN_Y - 0.05)), at(a, fs * (SCREEN_Y - 0.05))], out=(outer[k] + outer[k + 1]) / 2 - ctr)
            for a, b in ((inner[0], outer[0]), (inner[-1], outer[-1])):
                face(pt, [at(a, yf2), at(b, yf2), at(b, y_back), at(a, y_back)], out=((a + b) / 2 - ctr))
            if is_key and LOD <= 1:
                # console on the keystone face (a scroll profile extruded across the key)
                top = outer[0].z
                zc = top - 0.25
                w = 0.26
                prof = [(0.0, zc - 0.35), (0.05, zc - 0.33), (0.08, zc - 0.22), (0.1, zc - 0.05), (0.16, zc + 0.08),
                        (0.2, zc + 0.14), (0.2, zc + 0.2), (0.0, zc + 0.22)]
                frs = [(Vector((-w, fs * (abs(yf) + 0.0), 0)), Vector((0, fs, 0)), Vector((0, 0, 1))),
                       (Vector((w, fs * abs(yf), 0)), Vector((0, fs, 0)), Vector((0, 0, 1)))]
                if fs < 0:
                    frs = frs[::-1]
                sweep(pt, prof, frs, closed_prof=False, smooth=False, caps=True)
        # bulb rail round the extrados (S:157871 arch outlined in bulbs)
        if LOD <= 1:
            pts = []
            for k in range(0, 97):
                th = math.pi * k / 96
                P, n = ell(th, RING + 0.14)
                if abs(P.x) < AHS - 0.1:
                    pts.append(Vector((P.x, fs * (SCREEN_Y + 0.08), P.z)))
            bulb_row(pts, 0.38)
            tube(part("iron"), pts, 0.012, 4)
    note("arch: 33 voussoirs, projecting keystone with console, bulb rail", "S:158510 S:157431 (moulded archivolt) S:157871 (bulb outline) P:plate46 (span/crown)",
         "voussoir articulation, count and keystone console A: (158510 reads as a plain moulded archivolt: flagged)")

    # coffered vault soffit between the voussoir rings
    y0, y1 = -(SCREEN_Y - 0.6), SCREEN_Y - 0.6
    nth = {0: 13, 1: 9, 2: 5}[LOD]
    ny = {0: 9, 1: 9, 2: 3}[LOD]
    rib = 0.16
    depth = 0.16 if LOD <= 1 else 0.0
    sub = 2

    def S(th, y, off=0.0):
        P, n = ell(th, off)
        return Vector((P.x, y, P.z))

    for i in range(nth):
        t0, t1 = math.pi * i / nth, math.pi * (i + 1) / nth
        for j in range(ny):
            ya, yb = y0 + (y1 - y0) * j / ny, y0 + (y1 - y0) * (j + 1) / ny
            if depth == 0:
                face(pw, [S(t0, ya), S(t1, ya), S(t1, yb), S(t0, yb)], out=-ell((t0 + t1) / 2)[1])
                continue
            # rib band on the base surface around the coffer, coffer floor recessed (outward) by depth
            dth = rib / ((a_i + b_i) / 2)
            ti0, ti1 = t0 + dth, t1 - dth
            yi0, yi1 = ya + rib, yb - rib
            ths = [ti0 + (ti1 - ti0) * k / sub for k in range(sub + 1)]
            # ribs (4 border strips on the base surface)
            face(pw, [S(t0, ya), S(t1, ya), S(t1, yi0), S(t0, yi0)], out=-ell((t0 + t1) / 2)[1])
            face(pw, [S(t0, yi1), S(t1, yi1), S(t1, yb), S(t0, yb)], out=-ell((t0 + t1) / 2)[1])
            face(pw, [S(t0, yi0), S(ti0, yi0), S(ti0, yi1), S(t0, yi1)], out=-ell(t0)[1])
            face(pw, [S(ti1, yi0), S(t1, yi0), S(t1, yi1), S(ti1, yi1)], out=-ell(t1)[1])
            # stepped/chamfered recess: side walls to an inset floor
            st = 0.07
            tf0, tf1 = ti0 + st / ((a_i + b_i) / 2), ti1 - st / ((a_i + b_i) / 2)
            yf0, yf1 = yi0 + st, yi1 - st
            fths = [tf0 + (tf1 - tf0) * k / sub for k in range(sub + 1)]
            for k in range(sub):
                face(pw, [S(fths[k], yf0, depth), S(fths[k + 1], yf0, depth), S(fths[k + 1], yf1, depth), S(fths[k], yf1, depth)], out=-ell((fths[k] + fths[k + 1]) / 2)[1])
                # y-side slopes
                face(pw, [S(ths[k], yi0), S(ths[k + 1], yi0), S(fths[k + 1], yf0, depth), S(fths[k], yf0, depth)], out=Vector((0, 1, 0)) - ell(ths[k])[1])
                face(pw, [S(ths[k], yi1), S(ths[k + 1], yi1), S(fths[k + 1], yf1, depth), S(fths[k], yf1, depth)], out=Vector((0, -1, 0)) - ell(ths[k])[1])
            # theta-side slopes
            face(pw, [S(ti0, yi0), S(ti0, yi1), S(tf0, yf1, depth), S(tf0, yf0, depth)], out=-ell(ti0)[1] + (S(ti1, 0) - S(ti0, 0)).normalized())
            face(pw, [S(ti1, yi0), S(ti1, yi1), S(tf1, yf1, depth), S(tf1, yf0, depth)], out=-ell(ti1)[1] - (S(ti1, 0) - S(ti0, 0)).normalized())
            # a rosette boss in every coffer on the crown line (LOD0)
            if LOD == 0 and i == nth // 2:
                tm = (t0 + t1) / 2
                P, n = ell(tm, depth)
                m = Matrix.Translation((P.x, (ya + yb) / 2, P.z)) @ Matrix.Rotation(math.pi, 4, "X")
                with local(m):
                    lathe(pt, [(0.0, -0.0), (0.16, 0.0), (0.16, 0.03), (0.1, 0.07), (0.05, 0.09), (0.0, 0.1)], seg=10)
        # transverse rib arches (bands) on the bay lines, projecting 0.08 below the base surface
    if LOD <= 1:
        for j in range(ny + 1):
            y = y0 + (y1 - y0) * j / ny
            n_t = 18 if LOD == 0 else 12
            ths = [math.pi * k / n_t for k in range(n_t + 1)]
            for k in range(n_t):
                a0, a1 = ths[k], ths[k + 1]
                A0, A1 = S(a0, y - 0.18, -0.08), S(a1, y - 0.18, -0.08)
                B0, B1 = S(a0, y + 0.18, -0.08), S(a1, y + 0.18, -0.08)
                face(pt, [A0, A1, B1, B0], out=-ell((a0 + a1) / 2)[1])
                face(pt, [S(a0, y - 0.18), S(a1, y - 0.18), A1, A0], out=(0, -1, 0))
                face(pt, [S(a0, y + 0.18), S(a1, y + 0.18), B1, B0], out=(0, 1, 0))
    note("coffered elliptical vault, transverse bands, rosettes", "S:158223 (dark ribbed vault; 1938 photo, ribs only)",
         "13 x 9 coffers, 0.16 m deep A:")

    # pendant lamps on the crown line (every other bay), 1912 electric globes on rods
    if LOD <= 1:
        for j in range(1, ny, 2):
            y = y0 + (y1 - y0) * (j + 0.5) / ny
            z_top = ACR
            lamp_pendant(Vector((0, y, z_top)), drop=1.6)


def lamp_pendant(P, drop):
    pi, pb, pg = part("iron"), part("brass"), part("lamp_glass")
    z = P.z
    rod(pi, (P.x, P.y, z), (P.x, P.y, z - drop), 0.012, 5)
    lathe(pi, [(0.0, 0.0), (0.09, 0.0), (0.09, 0.02), (0.02, 0.05), (0.0, 0.05)], centre=(P.x, P.y, z - 0.05), seg=8)
    lathe(pb, [(0.03, 0.0), (0.05, -0.02), (0.05, -0.06), (0.035, -0.08)], centre=(P.x, P.y, z - drop), seg=8)
    lathe(pg, [(0.035, -0.08), (0.12, -0.14), (0.16, -0.24), (0.15, -0.34), (0.1, -0.42), (0.0, -0.45)], centre=(P.x, P.y, z - drop), seg=12 if LOD == 0 else 8)
    LAMPS.append(Vector((P.x, P.y, z - drop - 0.25)))


LAMPS = []


def cornices_and_frieze():
    pt = part("trim")
    # main cornice on the screens (profile n, z; outside left-cw), bed mould + corona + cyma
    corn = [(0.0, FRIEZE1), (0.05, FRIEZE1), (0.05, FRIEZE1 + 0.05), (0.1, FRIEZE1 + 0.08), (0.12, FRIEZE1 + 0.16),
            (0.18, FRIEZE1 + 0.2), (0.2, FRIEZE1 + 0.26), (0.46, FRIEZE1 + 0.34), (0.55, TBAND0 + 0.14),
            (0.55, TBAND0 + 0.34), (0.58, TBAND0 + 0.37), (0.58, TBAND0 + 0.42), (0.25, CORNICE_TOP), (0.0, CORNICE_TOP)]
    if LOD == 2:
        corn = [(0.0, FRIEZE1), (0.2, FRIEZE1 + 0.26), (0.55, TBAND0 + 0.14), (0.58, TBAND0 + 0.42), (0.0, CORNICE_TOP)]
    for fs in (1, -1):
        fr = frame_matrix(Vector((0, fs * SCREEN_Y, 0)), Vector((0, fs, 0)))
        with local(fr):
            frs = [(Vector((-TIN, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), (Vector((TIN, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))]
            sweep(pt, corn, frs, smooth=False, caps=True)
            # modillions under the corona and the frieze: lesenes + roundels (S:157431 green roundels)
            if LOD <= 1:
                n = 40
                for k in range(n + 1):
                    u = -TIN + 0.2 + (2 * TIN - 0.4) * k / n
                    cbox(pt, (u - 0.05, 0.19, FRIEZE1 + 0.27), (u + 0.05, 0.5, TBAND0 + 0.14), skip=("-y", "+z"))
            nb = 10
            bay = 2 * TIN / nb
            for k in range(nb + 1):
                u = -TIN + bay * k
                if k in (0, nb):
                    continue
                cbox(pt, (u - 0.17, -0.01, FRIEZE0), (u + 0.17, 0.06, FRIEZE1), c=0.012 if LOD == 0 else 0, skip=("-y",))
            for k in range(nb):
                u = -TIN + bay * (k + 0.5)
                zc = (FRIEZE0 + FRIEZE1) / 2
                m = Matrix.Translation((u, 0.0, zc)) @ Matrix.Rotation(-math.pi / 2, 4, "X")
                with local(m):
                    if LOD <= 1:
                        lathe(pt, [(0.34, 0.0), (0.36, 0.04), (0.3, 0.08), (0.26, 0.05), (0.26, 0.03)], seg=12 if LOD == 0 else 10)
                    lathe(part("medallion"), [(0.26, 0.03), (0.13, 0.05), (0.0, 0.06)], seg=12 if LOD == 0 else 8)
            # string under the frieze
            prof = [(0.0, FRIEZE0 - 0.12), (0.05, FRIEZE0 - 0.1), (0.07, FRIEZE0 - 0.04), (0.07, FRIEZE0), (0.0, FRIEZE0 + 0.01)]
            sweep(pt, prof, frs, smooth=False, caps=True)
            if LOD <= 1:
                # bulb rail along the corona (S:157871 cornice lines)
                bulb_row([fr @ Vector((-TIN + 0.1, 0.62, TBAND0 + 0.3)), fr @ Vector((TIN - 0.1, 0.62, TBAND0 + 0.3))], 0.38)
                tube(part("iron"), [fr @ Vector((-TIN + 0.05, 0.6, TBAND0 + 0.33)), fr @ Vector((TIN - 0.05, 0.6, TBAND0 + 0.33))], 0.012, 4)
    note("main cornice with modillions, frieze of lesenes and roundels", "S:157431 (row of roundels above the arch, green) S:157437 (vertical strips)",
         "profile, 10 bays, modillion spacing A:")
    # E/W: cornice = turret band profile continuous with the turrets; ground string course
    band = [(0.0, TBAND0 - 0.6), (0.04, TBAND0 - 0.6), (0.04, TBAND0 - 0.5), (0.1, TBAND0 - 0.3), (0.16, TBAND0),
            (0.24, TBAND0 + 0.12), (0.30, TBAND0 + 0.14), (0.30, TBAND0 + 0.34), (0.33, TBAND0 + 0.37), (0.33, TBAND0 + 0.42), (0.0, TBAND0 + 0.5)]
    string = [(0.0, GROUND_TOP), (0.06, GROUND_TOP), (0.12, GROUND_TOP + 0.08), (0.12, GROUND_TOP + 0.24), (0.0, STRING_TOP)]
    for sx in (-1, 1):
        fr = frame_matrix(Vector((sx * FHW, 0, 0)), Vector((sx, 0, 0)))
        with local(fr):
            frs = [(Vector((-TY0, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), (Vector((TY0, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))]
            sweep(pt, band, frs, smooth=False, caps=True)
            sweep(pt, string, frs, smooth=False, caps=True)
            if LOD <= 1:
                bulb_row([fr @ Vector((-TY0 + 0.1, 0.4, TBAND0 + 0.3)), fr @ Vector((TY0 - 0.1, 0.4, TBAND0 + 0.3))], 0.38)
                tube(part("iron"), [fr @ Vector((-TY0, 0.38, TBAND0 + 0.33)), fr @ Vector((TY0, 0.38, TBAND0 + 0.33))], 0.012, 4)


def deck_and_balustrade():
    pd, pt = part("deck"), part("trim")
    # deck paving (top z = RG): central field + side fields over the halls, minus turret footprints
    y_in = SCREEN_Y - WALL_T
    x_in = FHW - WALL_T
    fields = [(-TIN, -y_in, TIN, y_in), (-x_in, -TY0, -TIN, TY0), (TIN, -TY0, x_in, TY0)]
    for x0, y0, x1, y1 in fields:
        face(pd, [(x0, y0, RG), (x1, y0, RG), (x1, y1, RG), (x0, y1, RG)], out=(0, 0, 1))
    # tower leg pedestals (masonry plinths with base plates and anchor nuts) at the v4 leg positions
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * LEG, sy * LEG
            lb = LATTICE_BASE - 0.05
            cbox(pt, (cx - 0.7, cy - 0.7, RG - 0.01), (cx + 0.7, cy + 0.7, lb), c=0.015 if LOD == 0 else 0, skip=("-z",))
            loop = [(cx - 0.7, cy - 0.7), (cx + 0.7, cy - 0.7), (cx + 0.7, cy + 0.7), (cx - 0.7, cy + 0.7)]
            base_m = [(0.0, RG), (0.13, RG), (0.13, RG + 0.16), (0.1, RG + 0.2), (0.05, RG + 0.26), (0.0, RG + 0.28)]
            cap_m = [(0.0, lb - 0.2), (0.04, lb - 0.17), (0.09, lb - 0.08), (0.09, lb - 0.02), (0.0, lb)]
            if LOD == 2:
                base_m = [(0.0, RG), (0.13, RG), (0.13, RG + 0.2), (0.0, RG + 0.28)]
                cap_m = [(0.0, lb - 0.2), (0.09, lb - 0.08), (0.09, lb), (0.0, lb)]
            sweep(pt, base_m, hframes(loop, closed=True), closed_path=True, smooth=False)
            sweep(pt, cap_m, hframes(loop, closed=True), closed_path=True, smooth=False)
            face(pt, [(cx - 0.79, cy - 0.79, lb), (cx + 0.79, cy - 0.79, lb), (cx + 0.79, cy + 0.79, lb), (cx - 0.79, cy + 0.79, lb)], out=(0, 0, 1))
            cbox(part("iron"), (cx - 0.55, cy - 0.55, lb), (cx + 0.55, cy + 0.55, LATTICE_BASE), c=0.004 if LOD == 0 else 0, skip=("-z",))
            if LOD <= 1:
                # gusseted shoe plates round the leg foot (v4 leg radius 0.30)
                for gx, gy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if gx:
                        cbox(part("iron"), (cx + gx * 0.28 - 0.01 + (gx < 0) * 0.0, cy - 0.012, LATTICE_BASE), (cx + gx * 0.55, cy + 0.012, LATTICE_BASE + 0.32), skip=("-z",)) if gx > 0 else \
                            cbox(part("iron"), (cx - 0.55, cy - 0.012, LATTICE_BASE), (cx - 0.28, cy + 0.012, LATTICE_BASE + 0.32), skip=("-z",))
                    else:
                        cbox(part("iron"), (cx - 0.012, cy + 0.28, LATTICE_BASE), (cx + 0.012, cy + 0.55, LATTICE_BASE + 0.32), skip=("-z",)) if gy > 0 else \
                            cbox(part("iron"), (cx - 0.012, cy - 0.55, LATTICE_BASE), (cx + 0.012, cy - 0.28, LATTICE_BASE + 0.32), skip=("-z",))
            if LOD == 0:
                for ax in (-0.42, 0.42):
                    for ay in (-0.42, 0.42):
                        lathe(part("iron"), [(0.04, 0.0), (0.04, 0.03), (0.035, 0.035), (0.02, 0.04), (0.02, 0.09), (0.0, 0.095)],
                              centre=(cx + ax, cy + ay, LATTICE_BASE), seg=6)
    note("tower leg pedestals on the deck", "P:plate46 (legs land on the roof)", "pedestal size, plates and anchors A: (legs at v4 SHAFT_BASE_HALF)")
    # flower-bed kerbs (T: 四時の花卉を栽; positions per INTERFACE)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x0, x1 = sorted((sx * 6.6, sx * 9.4))
            y0, y1 = sorted((sy * 2.0, sy * 7.5))
            k = 0.15
            for lo, hi in (((x0, y0, RG), (x1, y0 + k, RG + 0.35)), ((x0, y1 - k, RG), (x1, y1, RG + 0.35)),
                           ((x0, y0 + k, RG), (x0 + k, y1 - k, RG + 0.35)), ((x1 - k, y0 + k, RG), (x1, y1 - k, RG + 0.35))):
                cbox(part("sill"), lo, hi, c=0.012 if LOD == 0 else 0, skip=("-z",), jitter=0.3)
            face(part("soil"), [(x0 + k, y0 + k, RG + 0.28), (x1 - k, y0 + k, RG + 0.28), (x1 - k, y1 - k, RG + 0.28), (x0 + k, y1 - k, RG + 0.28)], out=(0, 0, 1))
            if LOD <= 1:
                planting(x0 + k, y0 + k, x1 - k, y1 - k, RG + 0.28)
    note("roof garden deck, flower beds", "T:fr.268 (200 tsubo, flower beds; 677 m2 net here = 205 tsubo)", "terracotta pavers and bed positions A:")
    # balustrade on the screen walls and the E/W walls: plinth, balusters, top rail, piers every ~2.5 m
    runs = []
    for fs in (1, -1):
        yc = fs * (SCREEN_Y - WALL_T / 2)
        runs.append(((-TIN, yc), (TIN, yc), (0, fs)))
    for sx in (-1, 1):
        xc = sx * (FHW - WALL_T / 2)
        runs.append(((xc, -TY0), (xc, TY0), (sx, 0)))
    z_pl0, z_pl1 = RG, CORNICE_TOP + 0.12
    z_rail0 = RG + 1.0
    z_rail1 = z_rail0 + 0.16
    seg = {0: 5, 1: 4, 2: 0}[LOD]
    for (xa, ya), (xb, yb), (ox, oy) in runs:
        A, B = Vector((xa, ya, 0)), Vector((xb, yb, 0))
        L = (B - A).length
        t = (B - A).normalized()
        nrm = Vector((ox, oy, 0))
        m = frame_matrix(A, nrm)   # u along -? use explicit points instead
        # plinth and rail as sweeps along the run
        pl = [(-0.23, z_pl0), (0.23, z_pl0), (0.23, z_pl1 - 0.04), (0.2, z_pl1), (-0.2, z_pl1), (-0.23, z_pl1 - 0.04)]
        rl = [(-0.2, z_rail0), (0.2, z_rail0), (0.22, z_rail0 + 0.03), (0.22, z_rail0 + 0.1), (0.17, z_rail1),
              (-0.17, z_rail1), (-0.22, z_rail0 + 0.1), (-0.22, z_rail0 + 0.03)]
        if LOD == 2:
            rl = [(-0.2, z_rail0), (0.2, z_rail0), (0.2, z_rail1), (-0.2, z_rail1)]
        frs = [(A, nrm, Vector((0, 0, 1))), (B, nrm, Vector((0, 0, 1)))]
        sweep(pt, pl, frs, closed_prof=True, smooth=False, caps=True)
        sweep(pt, rl, frs, closed_prof=True, smooth=False, caps=True)
        npier = max(2, round(L / 2.5))
        piers = [A + t * (L * k / npier) for k in range(npier + 1)]
        for P in piers:
            cbox(pt, (P.x - 0.26, P.y - 0.26, z_pl0), (P.x + 0.26, P.y + 0.26, z_rail1 + 0.02), c=0.015 if LOD == 0 else 0)
            cbox(pt, (P.x - 0.31, P.y - 0.31, z_rail1 + 0.02), (P.x + 0.31, P.y + 0.31, z_rail1 + 0.12), c=0.02 if LOD == 0 else 0)
            if LOD <= 1:
                lathe(pt, [(0.12, 0.0), (0.06, 0.05), (0.12, 0.14), (0.13, 0.2), (0.1, 0.27), (0.0, 0.3)], centre=(P.x, P.y, z_rail1 + 0.12), seg=8 if LOD == 0 else 5)
                BULBS.append((Vector((P.x, P.y, z_rail1 + 0.5)), None))
        if LOD <= 1:
            for k in range(npier):
                P0, P1 = piers[k], piers[k + 1]
                span = (P1 - P0).length - 0.52
                nb = int(span / 0.34)
                for i in range(nb):
                    Q = P0 + t * (0.26 + span * (i + 0.5) / nb)
                    baluster(pt, Q.x, Q.y, z_pl1, z_rail0, seg)
        else:
            # LOD2: a solid panel stands in for the balusters
            for k in range(npier):
                P0, P1 = piers[k] + t * 0.26, piers[k + 1] - t * 0.26
                for d in (-0.06, 0.06):
                    q = [P0 + nrm * d + Vector((0, 0, z_pl1)), P1 + nrm * d + Vector((0, 0, z_pl1)), P1 + nrm * d + Vector((0, 0, z_rail0)), P0 + nrm * d + Vector((0, 0, z_rail0))]
                    face(pt, q, out=nrm * (1 if d > 0 else -1))
    note("roof balustrade: plinth, turned balusters, moulded rail, piers with ball caps", "S:157431 (piers along the roof edge) S:158510",
         "balusters (vs. iron railing) A:; height 1.16 m above the deck A:")


def planting(x0, y0, x1, y1, z):
    """Low clipped edging and flower clumps (A: seasonal flowers; plant species not sourced)."""
    pl, pf = part("foliage"), part("flowers")
    rnd = random.Random(int((x0 + 50) * 100 + y0 * 10))
    # clipped box edging along the four sides
    e = 0.22
    for lo, hi in (((x0, y0, z), (x1, y0 + e, z + 0.22)), ((x0, y1 - e, z), (x1, y1, z + 0.22)),
                   ((x0, y0 + e, z), (x0 + e, y1 - e, z + 0.22)), ((x1 - e, y0 + e, z), (x1, y1 - e, z + 0.22))):
        cbox(pl, lo, hi, c=0.06 if LOD == 0 else 0.0, skip=("-z",), jitter=0.3)
    if LOD >= 1:
        n = 10
    else:
        n = 8
    for i in range(n):
        cx = rnd.uniform(x0 + 0.35, x1 - 0.35)
        cy = rnd.uniform(y0 + 0.35, y1 - 0.35)
        r = rnd.uniform(0.12, 0.22)
        h = rnd.uniform(0.18, 0.42)
        # a clump: bulged leaf mass + flower heads
        lathe(pl, [(r * 0.6, 0.0), (r, h * 0.35), (r * 0.8, h * 0.75), (0.0, h)], centre=(cx, cy, z), seg=7 if LOD == 0 else 5,
              sq=lambda zz: 2.0, ang0=rnd.uniform(0, 1))
        if LOD == 0:
            for k in range(rnd.randint(2, 4)):
                a = rnd.uniform(0, 2 * math.pi)
                rr = rnd.uniform(0, r * 0.8)
                P = (cx + rr * math.cos(a), cy + rr * math.sin(a), z + h * rnd.uniform(0.7, 1.05))
                lathe(pf, [(0.0, -0.02), (0.045, 0.0), (0.0, 0.025)], centre=P, seg=5)


def fillet_path(pts, rad, n=4):
    """Polyline with every interior corner replaced by a bend of radius ~rad (quadratic arc, n segments)."""
    P = [Vector(q) for q in pts]
    out = [P[0]]
    for i in range(1, len(P) - 1):
        a, b, c = P[i - 1], P[i], P[i + 1]
        d1, d2 = (b - a).normalized(), (c - b).normalized()
        ang = d1.angle(d2, 0.0)
        if ang < 1e-3:
            out.append(b)
            continue
        t = min(rad * math.tan(ang / 2), (b - a).length * 0.45, (c - b).length * 0.45)
        p1, p2 = b - d1 * t, b + d2 * t
        for k in range(n + 1):
            f = k / n
            out.append((1 - f) ** 2 * p1 + 2 * (1 - f) * f * b + f * f * p2)
    out.append(P[-1])
    return out


def holderbat(p, x, y, z, ox, r, seg, axis=None):
    """Split ring round the pipe (axis: pipe direction, default vertical) with ears bolted back to the wall (-ox side)."""
    if axis is None or abs(Vector(axis).normalized().z) > 0.999:
        lathe(p, [(r + 0.012, -0.03), (r + 0.012, 0.03)], centre=(x, y, z), seg=seg)
    else:
        q = Vector(axis).normalized().to_track_quat("Z", "X").to_matrix().to_4x4()
        with local(Matrix.Translation((x, y, z)) @ q):
            lathe(p, [(r + 0.012, -0.03), (r + 0.012, 0.03)], seg=seg)
    wx = x - ox * (r + 0.06)
    cbox(p, (min(x - ox * r, wx), y - 0.012, z - 0.03), (max(x - ox * r, wx), y + 0.012, z + 0.03))


def services():
    pd = part("downpipe", "iron")       # v1.3: all downpipes in their own node (TB_EXT_LOD<n>_downpipe, material iron)
    seg = {0: 8, 1: 6, 2: 4}[LOD]
    r = 0.05
    # 1. four full-height downpipes on the turret outer sides near the front corners (outside the wings: y +/-12.65)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y, ztop, ox = sx * (FHW + 0.1), sy * (FY - 0.35), TCORN0 - 0.1, sx
            zb = 0.18
            if LOD <= 1:
                cbox(pd, (x - 0.13, y - 0.14, ztop - 0.35), (x + 0.13, y + 0.14, ztop - 0.05), c=0.006 if LOD == 0 else 0, skip=("+z",))
                if LOD == 0:
                    cbox(pd, (x - 0.15, y - 0.16, ztop - 0.07), (x + 0.15, y + 0.16, ztop - 0.03), c=0.004)
            tube(pd, [(x, y, ztop - 0.35), (x, y, zb + 0.25)], r, seg)
            tube(pd, [(x, y, zb + 0.25), (x, y, zb + 0.12), (x + ox * 0.12, y, zb + 0.04)], r, seg)       # shoe (kick-out at the foot)
            if LOD <= 1:
                z = ztop - 0.6
                while z > 0.6:
                    holderbat(pd, x, y, z, ox, r, seg)
                    z -= 1.8
    # 2. v1.3: the two E/W downpipes beside the side-mass walls (hoppers at y +/-8.25, 14.3) no longer run down through the wing
    #    roofs: a 45-degree offset with two swan-neck bends carries each one along the wall face (x +/-14.6, 0.05 m off the
    #    render) past the wing roof edge to y +/-9.55, the centre line of the wing's eaves gutter, and a shoe discharges into that
    #    gutter 70 mm above its rim.  Holderbats on every run (A: route; the wing gutter drains to the wing's own downpipes).
    gy = WING_ROOF["edge"] + WING_ROOF["gutter_dy"]
    rim = wing_roof_z(WING_ROOF["edge"]) + WING_ROOF["gutter_dz"] + 0.012
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, ox = sx * (FHW + 0.1), sx
            y8, y9 = sy * (TY0 - 0.35), sy * gy
            ztop = TBAND0 - 0.65
            zb1 = ztop - 0.75
            zb2 = zb1 - abs(y9 - y8)                  # 45 degrees
            z_end = rim + 0.07
            if LOD <= 1:
                cbox(pd, (x - 0.13, y8 - 0.14, ztop - 0.35), (x + 0.13, y8 + 0.14, ztop - 0.05), c=0.006 if LOD == 0 else 0, skip=("+z",))
                if LOD == 0:
                    cbox(pd, (x - 0.15, y8 - 0.16, ztop - 0.07), (x + 0.15, y8 + 0.16, ztop - 0.03), c=0.004)
            path = [(x, y8, ztop - 0.35), (x, y8, zb1), (x, y9, zb2), (x, y9, z_end + 0.11), (x + ox * 0.065, y9, z_end)]
            pts = fillet_path(path, 0.16, n={0: 5, 1: 3, 2: 2}[LOD])
            tube(pd, pts, r, seg)
            if LOD <= 1:
                holderbat(pd, x, y8, ztop - 0.6, ox, r, seg)
                ym, zm = (y8 + y9) / 2, (zb1 + zb2) / 2
                holderbat(pd, x, ym, zm, ox, r, seg, axis=(0.0, y9 - y8, zb2 - zb1))
                z = zb2 - 0.35
                while z > z_end + 0.4:
                    holderbat(pd, x, y9, z, ox, r, seg)
                    z -= 1.6
    note("cast-iron downpipes with hopper heads, holderbats, shoes", "A: (not legible in the photos; required by detail-spec §2)",
         "positions A:; v1.3: the E/W pipes offset (45 deg, two swan necks) to discharge into the wing eaves gutters instead of passing through the wing roofs")

    # lamp brackets on the turret fronts flanking the arch (scroll arm + lantern), 1912 electric
    for sx in (-1, 1):
        for sy in (-1, 1):
            base = Vector((sx * (TIN + 0.55), sy * FY, 3.75))
            bracket_lamp(base, Vector((0, sy, 0)))
    note("wall lamp brackets flanking the arch", "S:158510 (lamp standard beside a turret) A: bracket form", "")

    # service entry (v1.3): one bracket per side on the street-side turret (SW / SE outer faces), fed by a four-wire service drop
    # from the wing end pole (x +/-20.5, y -13.3); dead-ended with tie wires on the bracket insulators, drip loops into porcelain
    # entrance tubes in the wall.  The v1 yard-side brackets (NW / NE) are gone: no line reaches them (no poles on the yard side).
    for sx in (-1, 1):
        base = Vector((sx * FHW, -(TY0 + 1.6), 13.8))
        insulator_bracket(base, Vector((sx, 0, 0)), sx)
    note("service entry: iron bracket with porcelain pin insulators, service drop from the wing end pole, drip loops, entrance tubes",
         "S:157218 S:157103 (wires everywhere, 1912 streets) A: position, pole datums from ../wings", "")


def bracket_lamp(base, nrm):
    pi, pg, pb = part("iron"), part("lamp_glass"), part("brass")
    t = nrm.cross(Vector((0, 0, 1)))
    reach = 0.85
    # back plate
    m = frame_matrix(base, nrm)
    with local(m):
        cbox(pi, (-0.07, 0.0, -0.26), (0.07, 0.018, 0.26), c=0.004 if LOD == 0 else 0, skip=("-y",))
        cbox(pi, (-0.05, 0.018, -0.2), (0.05, 0.03, 0.2), c=0.003 if LOD == 0 else 0, skip=("-y",))
        if LOD == 0:
            for dz in (-0.22, 0.22):
                lathe(pb, [(0.012, 0.0), (0.012, 0.004), (0.0, 0.007)], centre=(0, 0, 0), seg=6) if False else None
                with local(Matrix.Translation((0, 0.025, dz)) @ Matrix.Rotation(-math.pi / 2, 4, "X")):
                    lathe(pi, [(0.0, 0.0), (0.014, 0.0), (0.012, 0.006), (0.0, 0.008)], seg=6)
        # arm, diagonal strut and a spiral scroll in the (n, z) plane
        tube(pi, [(0, 0.02, 0.18), (0, reach * 0.5, 0.195), (0, reach, 0.16)], 0.018, 6)
        tube(pi, [(0, 0.02, -0.22), (0, reach * 0.35, -0.02), (0, reach * 0.62, 0.17)], 0.013, 5)
        if LOD == 0:
            scroll = []
            for k in range(22):
                a = k / 21 * 2.2 * math.pi
                rr = 0.12 * (1 - k / 26)
                scroll.append((0, 0.27 + rr * math.sin(a), 0.03 + rr * math.cos(a)))
            tube(pi, scroll, 0.008, 5)
            for k in range(3):
                zz = -0.1 + 0.08 * k
                lathe(pb, [(0.0, 0.0), (0.012, 0.0), (0.012, 0.006), (0.0, 0.009)], centre=(0, 0.14 + 0.1 * k, 0.19), seg=6)
        # lantern: cap, frosted globe, gallery
        top = Vector((0, reach, 0.16))
        rod(pi, top, top - Vector((0, 0, 0.12)), 0.01, 5)
        lathe(pi, [(0.0, 0.0), (0.13, -0.05), (0.14, -0.07), (0.05, -0.09)], centre=(0, reach, 0.04), seg=16 if LOD == 0 else 6)
        lathe(pg, ([(0.05, 0.0), (0.09, -0.025), (0.12, -0.06), (0.143, -0.11), (0.152, -0.16), (0.147, -0.21), (0.132, -0.26), (0.103, -0.3), (0.06, -0.328), (0.0, -0.34)] if LOD == 0
                  else [(0.05, 0.0), (0.12, -0.06), (0.15, -0.16), (0.13, -0.27), (0.0, -0.34)]), centre=(0, reach, -0.05), seg=16 if LOD == 0 else 8)
    LAMPS.append(m @ Vector((0, reach, -0.2)))


def tie_ring(p, centre, rad, rw=0.003, n=8):
    """Tie wire wrapped round an insulator neck (closed ring in the horizontal plane, vertices at k * 360 / n deg, like lathe())."""
    c = Vector(centre)
    pts = [c + Vector((rad * math.cos(2 * math.pi * k / n), rad * math.sin(2 * math.pi * k / n), 0.0)) for k in range(n + 1)]
    tube(p, pts, rw, 3)


SERVICE = []     # LOD0: one entry per conductor (parts.json, seams check)


def insulator_bracket(base, nrm, sx):
    """Street-side service bracket: wall plate, stay, crossarm, 4 porcelain pin insulators (tie groove at 0.17), service drop to
    the wing end pole, tie wires at both ends, drip loops into sloping porcelain entrance tubes 0.44-0.49 m under the bracket."""
    pi, pp = part("service_iron", "iron"), part("service_porcelain", "porcelain")
    pw = part("service_wire", "wire")
    m = frame_matrix(base, nrm)
    us = (-0.42, -0.14, 0.14, 0.42)
    with local(m):
        cbox(pi, (-0.04, 0.0, -0.35), (0.04, 0.02, 0.05), c=0.003 if LOD == 0 else 0, skip=("-y",))
        rod(pi, (0, 0.01, -0.3), (0, 0.45, 0.0), 0.014, 5)
        cbox(pi, (-0.5, 0.42, -0.02), (0.5, 0.48, 0.02))
        for u in us:
            rod(pi, (u, 0.45, 0.02), (u, 0.45, 0.09), 0.008, 5)
            if LOD <= 1:
                prof = [(0.0, 0.07), (0.035, 0.07), (0.045, 0.09), (0.04, 0.11), (0.06, 0.13), (0.055, 0.15), (0.035, 0.17), (0.04, 0.19),
                        (0.03, 0.21), (0.0, 0.215)]
                lathe(pp, prof, centre=(u, 0.45, 0), seg=8 if LOD == 0 else 5)
                # entrance tube (sloping down and out so the water drains away) with a flared lip
                t_in, t_out = Vector((u, -0.02, -0.44)), Vector((u, 0.075, -0.49))
                rod(pp, t_in, t_out, 0.016, 8 if LOD == 0 else 5)
                d = (t_out - t_in).normalized()
                rod(pp, t_out - d * 0.012, t_out, 0.022, 8 if LOD == 0 else 5)
    if LOD >= 2:
        return
    # conductors: groove points of the bracket insulators (world) -> the four pole insulators on the base side of the wing end pole
    grooves = [(u, m @ Vector((u, 0.45, 0.17))) for u in us]
    grooves.sort(key=lambda g: -g[1].y)                      # nearest the wing first
    xa, xb = sx * (WING_POLE["x"] - WING_POLE["u"][0]), sx * (WING_POLE["x"] - WING_POLE["u"][1])
    zu = WING_POLE["arms"][0] + WING_POLE["ins_base"] + WING_POLE["ins_zmax"]
    zl = WING_POLE["arms"][1] + WING_POLE["ins_base"] + WING_POLE["ins_zmax"]
    # plan order kept (no crossings in plan): the two conductors nearest the wing go to the insulators farther along the arm
    # (x +/-20.14, upper and lower arm), the other two to x +/-19.78
    targets = [Vector((xa, WING_POLE["y"], zu)), Vector((xa, WING_POLE["y"], zl)), Vector((xb, WING_POLE["y"], zu)), Vector((xb, WING_POLE["y"], zl))]
    # the wing's pole insulators are lathed with 5 sides in LOD0 and 4 in LOD1 (vertices at k * 360 / seg deg): the span end and
    # the tie follow that polygon (end 1 mm off the facet it faces, tie ring 0.5 mm clear of facets and corners)
    wseg = 5 if LOD == 0 else 4
    apo = WING_POLE["ins_rmax"] * math.cos(math.pi / wseg)
    for (u, g), tgt in zip(grooves, targets):
        dh = Vector((tgt.x - g.x, tgt.y - g.y, 0.0)).normalized()
        p0 = g + dh * (0.035 + 0.004 + 0.001)
        th = math.atan2(-dh.y, -dh.x)
        step = 2 * math.pi / wseg
        phi = abs(th % step - step / 2)                  # angle to the nearest facet normal (facet normals at (k + 1/2) * step)
        p1 = tgt - dh * (apo / math.cos(phi) + 0.004 + 0.001)
        L = (p1 - p0).length
        sag = 0.05 + 0.015 * L
        n = 14 if LOD == 0 else 8
        span = [p0 + (p1 - p0) * (k / n) - Vector((0, 0, sag * 4 * (k / n) * (1 - k / n))) for k in range(n + 1)]
        tube(pw, span, 0.004, 3)
        tie_ring(pw, g, 0.038)
        tie_ring(pw, tgt, (apo + 0.0035) / math.cos(math.pi / wseg), n=wseg)      # 0.5 mm off the (wing-owned) insulator
        # tail: from the wall side of the groove down in a drip loop into the entrance tube under the bracket
        tl = [m @ Vector(q) for q in ((u, 0.45 - 0.04, 0.17), (u, 0.37, 0.06), (u, 0.29, -0.22), (u, 0.20, -0.50), (u, 0.15, -0.60),
                                        (u, 0.12, -0.545), (u, 0.10, -0.503), (u, 0.075, -0.49))]
        tube(pw, tl, 0.004, 3)
        if LOD == 0:
            SERVICE.append({"conductor": u, "span": [[round(v, 4) for v in p0], [round(v, 4) for v in p1]], "sagM": round(sag, 3),
                            "poleInsulator": [round(v, 4) for v in tgt], "entranceTube": [round(v, 4) for v in tl[-1]]})


def interior_shell():
    """Slabs, cross walls and inner faces that bound the INTERFACE rooms (no contents)."""
    pi = part("inner")
    if LOD >= 2:
        return
    for sx in (-1, 1):
        x0, x1 = sorted((sx * 10.5, sx * 14.05))
        # slabs over the halls (L1, L2, L3 floors and the roof slab soffit)
        for fl in (LEVELS["L1"], LEVELS["L2"], LEVELS["L3"], RG):
            cz = fl - 0.30 if fl != RG else RG - 0.35
            face(pi, [(x0, -TY0, cz), (x1, -TY0, cz), (x1, TY0, cz), (x0, TY0, cz)], out=(0, 0, -1))
            if fl != RG:
                face(pi, [(x0, -TY0, fl), (x1, -TY0, fl), (x1, TY0, fl), (x0, TY0, fl)], out=(0, 0, 1))
        face(pi, [(x0, -TY0, LEVELS["L0"]), (x1, -TY0, LEVELS["L0"]), (x1, TY0, LEVELS["L0"]), (x0, TY0, LEVELS["L0"])], out=(0, 0, 1))
        # cross walls between the hall and the turret shafts (with the internal doors, 1.2 x 2.6)
        for sy in (-1, 1):
            yw = sy * TY0
            fr = frame_matrix(Vector((0, yw, 0)), Vector((0, -sy, 0)))
            s = 1 if -sy > 0 else -1
            u0, u1 = sorted((x0 * s, x1 * s))
            d = Op("rect", sx * 12.3 * s, 1.2, LEVELS["L0"], 2.6)
            wall(fr, u0, u1, [(LEVELS["L0"], RG - 0.35, "inner", 0.0, 0.0)], [d])
            reveal(fr, d, WALL_T, "inner")
        # turret shafts: floor and ceiling
        for sy in (-1, 1):
            xa, xb = sorted((sx * 10.5, sx * 14.05))
            ya, yb = sorted((sy * 9.05, sy * 12.55))
            face(pi, [(xa, ya, LEVELS["L0"]), (xb, ya, LEVELS["L0"]), (xb, yb, LEVELS["L0"]), (xa, yb, LEVELS["L0"])], out=(0, 0, 1))
            face(pi, [(xa, ya, 19.2), (xb, ya, 19.2), (xb, yb, 19.2), (xa, yb, 19.2)], out=(0, 0, -1))
    note("interior shell (slabs, cross walls, shaft floor/ceiling)", "../INTERFACE.md", "contents belong to the interior agent")


# ---------------------------------------------------------------------------------------------
# 5b. Turret heads: head floor slab with the stairwell opening (v1.2, 2026-10-01; INTERFACE change log 1.2)
# ---------------------------------------------------------------------------------------------
# The stair cell (../interior, stair_SW) is authored in a cell frame x 0..3.55, y 0..3.5 (x toward the passage wall, y toward
# the deck) with z = world - 0.15.  The other three turrets are its mirror images: world X = sx * (14.05 - x), Y = sy * (12.55 - y).
# Head floor = L of the strip along the passage-side wall (x 2.60..3.55) and the strip along the deck-side wall (y 2.55..3.5);
# the opening x 0..2.60, y 0..2.55 is framed by a riveted steel trimmer (I 250 x 125) along x 2.60 bearing on both end walls and a
# header along y 2.55 from the outer wall into the trimmer.  75 risers of 200 mm (must match ../interior).
ST_NR, ST_HEAD, ST_X0 = 75, 15.0, 0.05
ST_R = ST_HEAD / ST_NR
ST_OPEN = (0.0, 0.0, 2.60, 2.55)
ST_LANDING = [(2.60, 0.0), (3.55, 0.0), (3.55, 3.5), (0.0, 3.5), (0.0, 2.55), (2.60, 2.55)]
ST_SLAB, ST_TRIM_D, ST_TRIM_B = 0.30, 0.25, 0.125
TURRET_NAMES = {(-1, -1): "SW", (-1, 1): "NW", (1, -1): "SE", (1, 1): "NE"}


def st_world(sx, sy):
    return lambda x, y, z: (sx * (14.05 - x), sy * (12.55 - y), z + 0.15)


def stair_steps_cell():
    """Same plan as ../interior stair_steps(): list of (poly cell xy, z top, kind)."""
    def rot(p, k):
        x, y = p[0] - 1.75, p[1] - 1.75
        for _ in range(k % 4):
            x, y = -y, x
        return (x + 1.75 + ST_X0, y + 1.75)
    out = []

    def quarter(k, ntr, pitch, final=False):
        y0 = 2.55 - ntr * pitch
        for i in range(ntr):
            a, b = y0 + i * pitch, y0 + (i + 1) * pitch
            out.append(([rot(p, k) for p in ((2.55, a), (3.5, a), (3.5, b), (2.55, b))], (len(out) + 1) * ST_R, "tread"))
        if final:
            return
        P = (2.55, 2.55)
        for poly in ([P, (3.5, 2.55), (3.5, 3.10)], [P, (3.5, 3.10), (3.5, 3.5), (3.10, 3.5)], [P, (3.10, 3.5), (2.55, 3.5)]):
            out.append(([rot(p, k) for p in poly], (len(out) + 1) * ST_R, "winder"))
    quarter(0, 11, 2.55 / 11)
    for k in range(1, 7):
        quarter(k, 6, 1.6 / 6)
    quarter(7, 6, 1.6 / 6, final=True)
    assert len(out) == ST_NR - 1
    return out


def turret_stair_heads():
    """Head floor slab + opening + steel framing in every turret (LOD0/1), and a placeholder guard rail round each opening
    (`stairhead_<turret>`, hidden when that turret's stair cell is loaded; the cell carries the real balustrade)."""
    if LOD >= 2:
        return
    pi, pd, ps = part("inner"), part("deck"), part("iron")
    x0o, y0o, x1o, y1o = ST_OPEN
    zs = ST_HEAD - ST_SLAB
    zb = zs - ST_TRIM_D
    B = ST_TRIM_B
    for (sx, sy), nm in TURRET_NAMES.items():
        T = st_world(sx, sy)
        mir = sx * sy < 0

        def wbox(p, lo, hi, c=0.0):
            a, b = T(*lo), T(*hi)
            cbox(p, tuple(min(u, v) for u, v in zip(a, b)), tuple(max(u, v) for u, v in zip(a, b)), c=c)
        top = [T(x, y, ST_HEAD) for x, y in ST_LANDING]
        bot = [T(x, y, zs) for x, y in ST_LANDING]
        face(pd, top, out=(0, 0, 1))
        face(pi, bot, out=(0, 0, -1))
        # opening edge faces (the slab edge along x 2.60 and along y 2.55); outward = into the opening
        for (a, b, o) in (((x1o, 0.0), (x1o, y1o), (-1, 0)), ((0.0, y1o), (x1o, y1o), (0, -1))):
            q = [T(a[0], a[1], zs), T(b[0], b[1], zs), T(b[0], b[1], ST_HEAD), T(a[0], a[1], ST_HEAD)]
            face(pi, q, out=(o[0] * sx * -1, o[1] * sy * -1, 0))
        # trimmer (x 2.60..2.725, y -0.2..3.7 into the wall pockets) and header (y 2.55..2.675, x -0.2..web)
        tf, tw = 0.012, 0.008
        cz = 0.002 if LOD == 0 else 0.0
        for lo, hi in (((x1o, -0.2, zs - tf), (x1o + B, 3.7, zs)), ((x1o, -0.2, zb), (x1o + B, 3.7, zb + tf)),
                       ((x1o + B / 2 - tw / 2, -0.2, zb + tf), (x1o + B / 2 + tw / 2, 3.7, zs - tf))):
            wbox(ps, lo, hi, cz)
        xe = x1o + B / 2 - tw / 2 - 0.004
        for lo, hi in (((-0.2, y1o, zs - tf), (xe - 0.06, y1o + B, zs)), ((-0.2, y1o, zb + 0.03), (xe - 0.06, y1o + B, zb + 0.03 + tf)),
                       ((-0.2, y1o + B / 2 - tw / 2, zb + 0.03 + tf), (xe, y1o + B / 2 + tw / 2, zs - tf))):
            wbox(ps, lo, hi, cz)
        for sgn in (-1, 1):                                                   # angle cleats
            yc = y1o + B / 2 + sgn * tw / 2
            wbox(ps, (xe - 0.07, min(yc, yc + sgn * 0.008), zb + 0.06), (xe, max(yc, yc + sgn * 0.008), zs - 0.04), cz)
        # placeholder guard rail round the opening on the head floor (the interior cell replaces it)
        pr = part("stairhead_" + nm, "iron")
        rx_, ry_ = x1o + 0.055, y1o + 0.025
        runs = [((rx_, 0.925), (rx_, ry_)), ((rx_, ry_), (0.03, ry_))]
        zt = ST_HEAD
        for (pa, pb) in runs:
            A = Vector(T(pa[0], pa[1], zt + 0.93))
            Bv = Vector(T(pb[0], pb[1], zt + 0.93))
            rod(pr, A, Bv, 0.025, 6 if LOD == 0 else 4)
            if LOD == 0:
                rod(pr, Vector(T(pa[0], pa[1], zt + 0.08)), Vector(T(pb[0], pb[1], zt + 0.08)), 0.012, 4)
                L_ = math.dist(pa, pb)
                nb = int(L_ / 0.11)
                for i in range(1, nb):
                    t = i / nb
                    px, py = pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t
                    rod(pr, Vector(T(px, py, zt + 0.08)), Vector(T(px, py, zt + 0.91)), 0.008, 4)
        for (px, py) in ((rx_, 0.925), (rx_, ry_)):
            wbox(pr, (px - 0.045, py - 0.045, zt), (px + 0.045, py + 0.045, zt + 1.2), 0.004 if LOD == 0 else 0.0)
    note("turret heads: head floor slab with the stairwell opening, riveted steel trimmer + header, placeholder guard rail",
         "T:fr.268 (stair exits form the turrets) ../INTERFACE.md change log 1.2", "framing and rail form A:; mirrored from the SW stair cell")


def stair_collision(coll, parent):
    """COL_turret_head_floor_<t> (L-shaped head floor, 2 boxes), COL_stair_proxy_<t> (ramp through the nosings of every flight and
    winder, same plan as the interior stair cell), COL_stairhead_guard_<t> (1.0 m guard along the opening)."""
    steps = stair_steps_cell()
    for (sx, sy), nm in TURRET_NAMES.items():
        T = st_world(sx, sy)
        mir = sx * sy < 0
        # head floor: two boxes in one mesh
        vs, fs = [], []
        for lo, hi in (((2.60, 0.0, ST_HEAD - ST_SLAB), (3.55, 3.5, ST_HEAD)), ((0.0, 2.55, ST_HEAD - ST_SLAB), (2.60, 3.5, ST_HEAD))):
            a, b = T(*lo), T(*hi)
            x0, y0, z0 = (min(a[0], b[0]), min(a[1], b[1]), min(a[2], b[2]))
            x1, y1, z1 = (max(a[0], b[0]), max(a[1], b[1]), max(a[2], b[2]))
            k = len(vs)
            vs += [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
            fs += [tuple(k + i for i in f) for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7))]
        me = bpy.data.meshes.new(f"COL_turret_head_floor_{nm}")
        me.from_pydata(vs, [], fs)
        o = bpy.data.objects.new(me.name, me)
        coll.objects.link(o)
        o.parent = parent
        o["collision"] = True
        o.hide_render = True
        # stair ramp
        vs, fs = [], []
        for poly, z, kind in steps:
            if kind == "tread":
                pts = [(poly[0], z), (poly[1], z), (poly[2], z + ST_R), (poly[3], z + ST_R)]
            else:
                q = poly[1:]
                pts = [(poly[0], z + ST_R / 2)] + [(p, z + ST_R * i / (len(q) - 1)) for i, p in enumerate(q)]
            k = len(vs)
            vs += [T(p[0], p[1], zz) for p, zz in pts]
            f = tuple(range(k, k + len(pts)))
            fs.append(f[::-1] if mir else f)
        me = bpy.data.meshes.new(f"COL_stair_proxy_{nm}")
        me.from_pydata(vs, [], fs)
        o = bpy.data.objects.new(me.name, me)
        coll.objects.link(o)
        o.parent = parent
        o["collision"] = True
        o.hide_render = True
        # guard along the opening edges (x 2.60..2.70 from y 0.95, y 2.55..2.65 to the outer wall), 1.0 m high
        col_box_w = []
        for lo, hi in (((2.60, 0.95, ST_HEAD), (2.70, 2.65, ST_HEAD + 1.0)), ((0.0, 2.55, ST_HEAD), (2.60, 2.65, ST_HEAD + 1.0))):
            a, b = T(*lo), T(*hi)
            col_box_w.append((tuple(min(u, v) for u, v in zip(a, b)), tuple(max(u, v) for u, v in zip(a, b))))
        vs, fs = [], []
        for (x0, y0, z0), (x1, y1, z1) in col_box_w:
            k = len(vs)
            vs += [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
            fs += [tuple(k + i for i in f) for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7))]
        me = bpy.data.meshes.new(f"COL_stairhead_guard_{nm}")
        me.from_pydata(vs, [], fs)
        o = bpy.data.objects.new(me.name, me)
        coll.objects.link(o)
        o.parent = parent
        o["collision"] = True
        o.hide_render = True


OPENINGS = []


def inner_faces():
    """Inner wall faces of the halls, upper rooms and turret shafts, holed where openings pass through."""
    if LOD >= 2:
        return
    specs = []
    for sx in (-1, 1):
        specs.append(("x", sx * 10.5, sx, -TY0, TY0, LEVELS["L0"], RG - 0.35))
        specs.append(("x", sx * 14.05, -sx, -TY0, TY0, LEVELS["L0"], RG - 0.35))
        for sy in (-1, 1):
            specs.append(("y", sy * 12.55, -sy, sx * 10.5, sx * 14.05, LEVELS["L0"], 19.2))
            specs.append(("x", sx * 14.05, -sx, sy * 9.05, sy * 12.55, LEVELS["L0"], 19.2))
            specs.append(("x", sx * 10.5, sx, sy * 9.05, sy * 12.55, LEVELS["L0"], 19.2))
            specs.append(("y", sy * 9.05, sy, sx * 10.5, sx * 14.05, LEVELS["L0"], 19.2))
    for axis, c, ns, a0, a1, z0, z1 in specs:
        N = Vector((ns, 0, 0)) if axis == "x" else Vector((0, ns, 0))
        origin = Vector((c, 0, 0)) if axis == "x" else Vector((0, c, 0))
        fr = frame_matrix(origin, N)
        U = N.cross(Vector((0, 0, 1)))
        wa = Vector((0, a0, 0)) if axis == "x" else Vector((a0, 0, 0))
        wb = Vector((0, a1, 0)) if axis == "x" else Vector((a1, 0, 0))
        u0, u1 = sorted((wa.dot(U), wb.dot(U)))
        ops = []
        for f, o in OPENINGS:
            No = f.to_3x3() @ Vector((0, 1, 0))
            if abs(No.dot(N)) < 0.99:
                continue
            P = f @ Vector((o.uc, 0, 0))
            dist = abs((P - origin).dot(N))
            if dist > 0.56:
                continue
            along = P.dot(U)
            if not (u0 - 0.01 < along < u1 + 0.01) or o.top() < z0 or o.z0 > z1:
                continue
            q = Op(o.kind, along, o.w, o.z0, o.z1, rise=o.rise, r=o.r, b=o.b)
            ops.append(q)
        wall(fr, u0, u1, [(z0, z1, "inner", 0.0, 0.0)], ops)


# ---------------------------------------------------------------------------------------------
# 6. Objects, UVs, collision, export
# ---------------------------------------------------------------------------------------------
MATDEF = {
    # name: (base colour linear RGB, roughness, metallic, CC0 texture set, tile metres, source tag)
    "wall": ((0.56, 0.40, 0.20), 0.86, 0.0, "Plaster007", 2.0, "S:157431 S:157437 hand-coloured ochre-cream render (colour estimated)"),
    "trim": ((0.66, 0.54, 0.33), 0.82, 0.0, "PaintedPlaster006", 2.0, "S:157431 lighter trims (estimated)"),
    "reveal": ((0.52, 0.38, 0.20), 0.88, 0.0, "Plaster007", 2.0, "as wall"),
    "vault": ((0.40, 0.33, 0.22), 0.9, 0.0, "Plaster007", 2.0, "S:158223 dark vault"),
    "plinth": ((0.18, 0.17, 0.16), 0.72, 0.0, "large_sandstone_blocks", 1.2, "A: granite-look plinth"),
    "sill": ((0.42, 0.38, 0.31), 0.75, 0.0, "large_sandstone_blocks", 1.2, "A: stone sills/kerbs"),
    "roof_sheet": ((0.045, 0.06, 0.055), 0.42, 0.35, "Metal041B", 1.0, "S:157437 dark caps; S:157431 greenish (estimated)"),
    "iron": ((0.035, 0.045, 0.038), 0.55, 0.45, "green_metal_rust", 1.0, "A: painted cast/wrought iron"),
    "wire": ((0.02, 0.02, 0.02), 0.6, 0.6, None, 1.0, "A: copper line wire, weathered"),
    "joinery": ((0.11, 0.045, 0.028), 0.34, 0.0, None, 1.0, "S:157437 dark window frames (colour A:)"),
    "glass": ((0.62, 0.7, 0.68), 0.04, 0.0, None, 1.0, "detail-spec §1 period cylinder glass"),
    "backing": ((0.16, 0.11, 0.075), 0.9, 0.0, None, 1.0, "placeholder room box, replaced by the interior"),
    "curtain": ((0.55, 0.44, 0.28), 0.95, 0.0, None, 1.0, "A: cream cotton curtains"),
    "backing_dark": ((0.05, 0.04, 0.035), 0.95, 0.0, None, 1.0, "placeholder dark depth behind open doors, replaced by the interior"),
    "brass": ((0.78, 0.52, 0.22), 0.26, 1.0, None, 1.0, "detail-spec §6 polished brass"),
    "porcelain": ((0.82, 0.8, 0.74), 0.08, 0.0, None, 1.0, "A: white glazed porcelain insulators"),
    "enamel": ((0.015, 0.03, 0.09), 0.12, 0.0, None, 1.0, "A: blank navy enamel plate, no text"),
    "bulb": ((0.95, 0.88, 0.7), 0.1, 0.0, None, 1.0, "T:fr.274 五萬燈 S:157871; carbon-filament 2200 K emission at night"),
    "lamp_glass": ((0.9, 0.87, 0.8), 0.35, 0.0, None, 1.0, "A: frosted globe"),
    "medallion": ((0.07, 0.17, 0.10), 0.55, 0.0, "PaintedPlaster006", 1.0, "S:157431 green roundels"),
    "deck": ((0.33, 0.17, 0.09), 0.72, 0.0, None, 1.0, "A: terracotta pavers 0.3 m"),
    "soil": ((0.07, 0.05, 0.035), 0.95, 0.0, None, 1.0, "A:"),
    "foliage": ((0.04, 0.09, 0.03), 0.8, 0.0, None, 1.0, "A: clipped box edging"),
    "flowers": ((0.7, 0.28, 0.2), 0.7, 0.0, None, 1.0, "A: seasonal flowers (T: 四時の花卉)"),
    "inner": ((0.55, 0.52, 0.46), 0.9, 0.0, None, 1.0, "interior shell, finishes by the interior agent"),
    "paving": ((0.13, 0.12, 0.105), 0.85, 0.0, None, 1.0, "A: macadam carriageway"),
    "kerb": ((0.3, 0.29, 0.27), 0.75, 0.0, "large_sandstone_blocks", 1.2, "A: granite kerbs and footways"),
}


def passage_floor():
    pv, pk = part("paving"), part("kerb")
    # carriageway (macadam, slight camber), two raised footways (0.15) along the passage walls
    fw = 1.6
    xc = TIN - fw
    ys = [-FY - 2.0 + (2 * FY + 4.0) * k / 8 for k in range(9)]
    for a, b in zip(ys, ys[1:]):
        cols = [-xc, -xc / 2, 0, xc / 2, xc]
        for x0, x1 in zip(cols, cols[1:]):
            z0 = 0.06 * (1 - (x0 / xc) ** 2)
            z1 = 0.06 * (1 - (x1 / xc) ** 2)
            face(pv, [(x0, a, z0), (x1, a, z1), (x1, b, z1), (x0, b, z0)], out=(0, 0, 1))
    for sx in ((-1, 1) if LOD <= 1 else ()):
        x0, x1 = sorted((sx * xc, sx * TIN))
        # kerb stones (individual, 1.0 m, chamfered) and footway slabs
        y = -FY - 2.0
        while y < FY + 2.0 - 1e-6:
            yl = min(y + 1.5, FY + 2.0)
            kx0, kx1 = sorted((sx * xc, sx * (xc + 0.3)))
            cbox(pk, (kx0, y + 0.004, -0.1), (kx1, yl - 0.004, 0.15), c=0.012 if LOD == 0 else 0, skip=("-z",), jitter=0.4)
            y = yl
        sx0, sx1 = sorted((sx * (xc + 0.3), sx * TIN))
        yy = -FY - 2.0
        k = 0
        while yy < FY + 2.0 - 1e-6:
            yl = min(yy + 0.9, FY + 2.0)
            cbox(pk, (sx0 + 0.003, yy + 0.003, 0.08), (sx1 - 0.003, yl - 0.003, 0.15), c=0.006 if LOD == 0 else 0.0, skip=("-z",))
            yy = yl
    if LOD == 2:
        for sx in (-1, 1):
            a_, b_ = sorted((sx * xc, sx * TIN))
            cbox(pk, (a_, -FY - 2.0, -0.1), (b_, FY + 2.0, 0.15), skip=("-z",))
    note("passage floor: cambered macadam carriageway, granite kerbs, raised footways", "A: (1912 streets unpaved per S:158514; footways assumed)", "")


def build_lod(lod):
    global LOD, WINDOWS, DOORS, LAMPS
    LOD = lod
    if lod == 0:
        INSTANCES["bulb"].clear()
        INSTANCES["baluster"].clear()
        SERVICE.clear()
    for k in [k for k in LEAF_NODES if k[0] == lod]:
        del LEAF_NODES[k]
    WINDOWS, DOORS, LAMPS = [], [], []
    OPENINGS.clear()
    build_all()
    passage_floor()


MATS = {}


def get_mat(name):
    if name in MATS:
        return MATS[name]
    col, rough, metal, tex, tile, src = MATDEF[name]
    m = bpy.data.materials.new("tb_" + name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    m.diffuse_color = (*col, 1)
    if name == "glass":
        b.inputs["Alpha"].default_value = 0.35
        m.surface_render_method = "BLENDED"
    if name == "bulb":
        b.inputs["Emission Color"].default_value = (1.0, 0.62, 0.28, 1)
        b.inputs["Emission Strength"].default_value = 0.0
    m["tex"] = tex or ""
    m["tileM"] = tile
    m["source"] = src
    MATS[name] = m
    return m


def make_object(key, p, coll, parent):
    lod, name = key
    mesh = bpy.data.meshes.new(f"TB_EXT_LOD{lod}_{name}")
    mesh.from_pydata([tuple(v) for v in p.V], [], p.F)
    uv = mesh.uv_layers.new(name="UVMap")
    li = 0
    for poly, puv in zip(mesh.polygons, p.UV):
        for k, loop in enumerate(poly.loop_indices):
            uv.data[loop].uv = puv[k] if k < len(puv) else (0, 0)
    for poly, s in zip(mesh.polygons, p.S):
        poly.use_smooth = s
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(get_mat(p.mat))
    try:
        mesh.set_sharp_from_angle(angle=math.radians(38))
    except Exception:
        pass
    obj = bpy.data.objects.new(mesh.name, mesh)
    coll.objects.link(obj)
    obj.parent = parent
    return obj


def add_uv1(obj):
    me = obj.data
    if len(me.polygons) == 0:
        return
    uv1 = me.uv_layers.new(name="UV1")
    me.uv_layers.active = uv1
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.003, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    me.uv_layers.active = me.uv_layers["UVMap"]
    me.uv_layers["UVMap"].active_render = True


def col_box(coll, parent, name, lo, hi):
    me = bpy.data.meshes.new(name)
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    me.from_pydata(v, [], f)
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    o.parent = parent
    o["collision"] = True
    o.hide_render = True
    return o


def col_ramp(coll, parent, name, pts):
    me = bpy.data.meshes.new(name)
    me.from_pydata(pts, [], [tuple(range(len(pts)))])
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    o.parent = parent
    o["collision"] = True
    o.hide_render = True
    return o


def build_collision(coll, root):
    col_box(coll, root, "COL_passage_floor", (-TIN, -FY - 2, -0.3), (TIN, FY + 2, 0.0))
    for sx in (-1, 1):
        x0, x1 = sorted((sx * (TIN - 1.6), sx * TIN))
        col_box(coll, root, f"COL_steps_footway_{'E' if sx > 0 else 'W'}", (x0, -FY - 2, 0.0), (x1, FY + 2, 0.15))
    y_in = SCREEN_Y - WALL_T
    col_box(coll, root, "COL_roof_deck", (-TIN, -y_in, RG - 0.35), (TIN, y_in, RG))
    for sx in (-1, 1):
        a, b = sorted((sx * TIN, sx * (FHW - WALL_T)))
        col_box(coll, root, f"COL_roof_deck_side_{'E' if sx > 0 else 'W'}", (a, -TY0, RG - 0.35), (b, TY0, RG))
    for sx in (-1, 1):
        a, b = sorted((sx * TIN, sx * (TIN + WALL_T)))
        col_box(coll, root, f"COL_passage_wall_{'E' if sx > 0 else 'W'}", (a, -FY, 0.0), (b, FY, ASP))
    stair_collision(coll, root)
    for fs in (-1, 1):
        a, b = sorted((fs * (SCREEN_Y - WALL_T), fs * SCREEN_Y))
        col_box(coll, root, f"COL_parapet_{'N' if fs > 0 else 'S'}", (-TIN, a, RG), (TIN, b, RG + 1.16))
    for sx in (-1, 1):
        a, b = sorted((sx * (FHW - WALL_T), sx * FHW))
        col_box(coll, root, f"COL_parapet_{'E' if sx > 0 else 'W'}", (a, -TY0, RG), (b, TY0, RG + 1.16))


def add_interface_empties(coll, root):
    seen = set()
    for fr, o in DOORS + [(f, o) for f, o in WINDOWS if o.tag in ("ticket_window",)]:
        name = "IF_" + (o.tag or "door")
        if o.tag == "door_hall":
            name = "IF_door_hall"
        k = name
        i = 1
        while k in seen:
            i += 1
            k = f"{name}_{i}"
        seen.add(k)
        e = bpy.data.objects.new(k, None)
        e.empty_display_type = "ARROWS"
        coll.objects.link(e)
        e.parent = root
        e.matrix_world = fr @ Matrix.Translation((o.uc, 0.0, o.z0))
        e["opening"] = json.dumps({"width": o.w, "sill": o.z0, "head": o.top(), "kind": o.kind})
        if o.tag.startswith("door_wing_"):       # v1.3: stated door (runtime flag + clips); leaves = pivot nodes, default closed
            e["state"] = "closed"
            e["door"] = json.dumps({"leaves": [f"TB_EXT_LOD{l}_{o.tag}_leaf{t}" for l in (0, 1) for t in ("S", "N")],
                                    "clips": [f"{o.tag}_open", f"{o.tag}_close"], "seconds": DOOR_SECONDS, "openAngleDeg": 90,
                                    "opensInto": "wing", "thresholdTop": WING_DOOR_FLOOR, "default": "closed",
                                    "rule": "state 'open' = the end pose of the _open clip; LOD2 keeps a closed flat face"})


def tri_count(objs):
    t = 0
    for o in objs:
        if o.type == "MESH":
            for p in o.data.polygons:
                t += len(p.vertices) - 2
    return t


# ---------------------------------------------------------------------------------------------
# 7. Main
# ---------------------------------------------------------------------------------------------
DOOR_FPS, DOOR_SECONDS = 30, 1.2


def make_leaf_pivots(lod, objs, coll, root):
    """v1.3: every leaf registered by door_fill(leaf_node=...) becomes an empty 'TB_EXT_LOD<n>_<door>_leaf<S|N>' on its hinge
    (knuckle axis, world Z) with its material meshes as children, rest pose = closed, and two NLA tracks that the glTF exporter
    writes as the clips '<door>_open' (0 -> +/-90 deg, 1.2 s, eased) and '<door>_close'."""
    sc = bpy.context.scene
    sc.render.fps = DOOR_FPS
    nf = int(DOOR_FPS * DOOR_SECONDS)
    for (lk, key), info in sorted(LEAF_NODES.items()):
        if lk != lod:
            continue
        kids = [o for o in objs if o.name.startswith(f"TB_EXT_LOD{lod}_{key}_")]
        if not kids:
            continue
        piv = bpy.data.objects.new(f"TB_EXT_LOD{lod}_{key}", None)
        piv.empty_display_type = "SINGLE_ARROW"
        piv.empty_display_size = 0.5
        coll.objects.link(piv)
        piv.parent = root
        h = Vector(info["hinge"])
        piv.location = h
        for o in kids:
            o.data.transform(Matrix.Translation(-h))
            o.parent = piv
        door = info["door"]
        piv["door"] = door
        piv["defaultState"] = "closed"
        piv["openAngleDeg"] = info["openDeg"]
        piv["axis"] = "node +Z (Blender) = glTF +Y, through the node origin = the hinge knuckle axis"
        piv["clips"] = json.dumps([f"{door}_open", f"{door}_close"])
        piv["leaf"] = json.dumps({"widthM": info["width"], "zM": info["z"], "opensInto": "wing (away from the base hall)"})
        piv.rotation_mode = "XYZ"
        ad = piv.animation_data_create()
        a_open = math.radians(info["openDeg"])
        for clip, (r0, r1) in ((f"{door}_open", (0.0, a_open)), (f"{door}_close", (a_open, 0.0))):
            act = bpy.data.actions.new(f"{piv.name}__{clip}")
            ad.action = act
            for f, rz in ((0, r0), (nf, r1)):
                piv.rotation_euler = (0.0, 0.0, rz)
                piv.keyframe_insert("rotation_euler", frame=f)
            ad.action = None
            tr = ad.nla_tracks.new()
            tr.name = clip
            tr.strips.new(clip, 0, act)
            tr.mute = True
        piv.rotation_euler = (0.0, 0.0, 0.0)


def main():
    global BUCKET, WINDOWS, DOORS
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)
    scene = bpy.context.scene
    coll = scene.collection
    roots = {}
    lod_stats = {}
    t0 = time.time()
    for lod in (0, 1, 2):
        BUCKET = {}
        PARTS.clear()
        build_lod(lod)
        root = bpy.data.objects.new(f"TB_EXT_LOD{lod}", None)
        coll.objects.link(root)
        root["lod"] = lod
        root["switchDistanceM"] = [0, 25, 80][lod]
        roots[lod] = root
        objs = []
        for key, p in sorted(BUCKET.items()):
            if p.F:
                objs.append(make_object(key, p, coll, root))
        lod_stats[lod] = {"tris": tri_count(objs), "objects": len(objs),
                          "byPart": {o.name.split("_", 3)[-1]: tri_count([o]) for o in objs}}
        make_leaf_pivots(lod, objs, coll, root)
        if lod == 0:
            lod0_windows, lod0_doors, lod0_lamps, lod0_bulbs = list(WINDOWS), list(DOORS), list(LAMPS), len(BULBS)
            parts_meta = list(PARTS)
        if lod > 0:
            for o in objs:
                o.hide_render = True
    t_build = time.time() - t0
    col_root = bpy.data.objects.new("TB_EXT_COLLISION", None)
    coll.objects.link(col_root)
    build_collision(coll, col_root)
    if_root = bpy.data.objects.new("TB_EXT_INTERFACE", None)
    coll.objects.link(if_root)
    WINDOWS, DOORS = lod0_windows, lod0_doors
    add_interface_empties(coll, if_root)
    t0 = time.time()
    for o in list(scene.objects):
        if o.type == "MESH" and o.name.startswith("TB_EXT_LOD") and "bulb" not in o.name:
            add_uv1(o)
    t_uv = time.time() - t0
    print("LOD stats", json.dumps({k: {"tris": v["tris"], "objects": v["objects"]} for k, v in lod_stats.items()}))
    meta = {
        "version": "tower-base-exterior v1.3",
        "command": "blender -b -P assets-src/shinsekai/tower-base-upgrade/exterior/build-tower-base-exterior.py -- " + " ".join(ARGV),
        "v4Constants": {k: v for k, v in V4.items() if k != "LIFT"},
        "lift": V4.get("LIFT"),
        "lods": lod_stats, "bulbsLOD0": lod0_bulbs, "windowsLOD0": len(lod0_windows), "doorsLOD0": len(lod0_doors),
        "materials": {k: {"baseColorLinear": v[0], "roughness": v[1], "metallic": v[2],
                          "cc0Texture": (str(TEX / v[3]) if v[3] else None), "tileM": v[4], "source": v[5]} for k, v in MATDEF.items()},
        "parts": parts_meta,
        "timingsS": {"build": round(t_build, 1), "uv1": round(t_uv, 1)},
        "budgetLOD0": 160000,
        "statedDoors": {f"{k[1]}": v for k, v in sorted(LEAF_NODES.items()) if k[0] == 0},
        "serviceDrops": SERVICE,
        "wingDatumsRead": {"roof": WING_ROOF, "pole": WING_POLE, "doorWingFloor": WING_DOOR_FLOOR},
        "instancing": {
            "note": "LOD0 bulbs and balusters are also baked into TB_EXT_LOD0_bulb / _trim (counted above). For runtime instancing, hide "
                    "those faces and draw one prototype per placement (world Z-up metres; glTF Y-up = (x, z, -y)).",
            "bulb": {"prototype": "4-sided bipyramid: lathe (r, z) = (0, -0.06), (0.024, -0.036), (0, 0), apex at the placement",
                     "trisEach": 8, "count": len(INSTANCES["bulb"]), "positions": INSTANCES["bulb"]},
            "baluster": {"prototype": "5-sided turned baluster, profile (r, z/0.72 of height) = (0.075,0),(0.045,0.1),(0.075,0.34),(0.045,0.5),(0.042,0.6),(0.075,0.72), scaled to the height",
                         "trisEach": 50, "count": len(INSTANCES["baluster"]), "placements[x, y, zBase, height]": INSTANCES["baluster"]}},
        "replacesInV4": ["tower study - provisional pale masonry", "tower study - dark unglazed opening", "roof_garden_deck",
                         "tower study - provisional trim: faces below z 16.6 and turret crowns/domes (|x|>9 or |y|>9, z<23)",
                         "tower study - provisional dark iron: turret finials (|x|>9, z<23)"],
    }
    (HERE / "tower-base-exterior.parts.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    if DO_EXPORT:
        bpy.ops.object.select_all(action="DESELECT")
        for o in scene.objects:
            if o.name.startswith(("TB_EXT", "COL_", "IF_")):
                o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(HERE / "tower-base-exterior.glb"), export_format="GLB", use_selection=True,
                                  export_extras=True, export_apply=False, export_texcoords=True, export_normals=True,
                                  export_materials="EXPORT", export_yup=True, export_animations=True,
                                  export_animation_mode="NLA_TRACKS", export_force_sampling=True, export_optimize_animation_size=False)
    if RENDERS:
        import importlib.util
        spec = importlib.util.spec_from_file_location("tb_render", HERE / "render_setup.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.run(RENDERS, HERE, V4_GLB, TEX, SAMPLES, lod0_lamps, lod0_windows, IRON_COLOUR)
    print(f"done in {time.time() - T_START:.1f}s")


main()
