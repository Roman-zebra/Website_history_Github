"""Facade module A (1912 Ebisu-dori shopfront, two storeys, 3 m bay) - pilot kit piece.

Run with Blender 4.5 from the repository root:
    blender -b --python assets-src/shinsekai/facade-kit/build-facade-1912.py -- [--no-render] [--only street|closeup|lod]
        [--samples 96] [--scale 1.0] [--no-export]
Outputs (next to this script): facade-a-1912.glb, review-street.png, review-window-closeup.png, review-lod.png
and a tri-count summary on stdout.

Axes (Blender): X along the street frontage, Y = depth (front face at y=0, the building goes to +Y, the street is -Y),
Z up. Origin = bottom-left-front corner of the bay. glTF export converts to Y-up, so the front faces +Z there.

Sourced from photo 158514 (OML CC0, Ebisu-dori 1912): two storeys, plastered upper storey, sash windows, small
parapet, deep ground-floor awning, long horizontal fascia board, disc signboard, open shopfront. Window typology from
157003/157013 (1905 Osaka). Every dimension is an ASSUMPTION unless the README says otherwise.

Per-vertex data (see README): COLOR_0 "Col" = true colour (interior albedo, canvas stripes, decal alpha), custom attribute
_WEAR = (R dirt/soot, G edge wear, B interior emissive mask, A unused). UV0 world-scaled metres, UV1 lightmap pack.
"""

import json
import math
import struct
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector


def arg(name, default, cast=float):
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return cast(argv[argv.index(name) + 1]) if name in argv else default


def flag(name):
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return name in argv


OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]                      # repository root (repo-claude)
TEX = OUT.parents[3] / "research-cache" / "materials-93"   # local CC0 textures, never copied into the repo
DO_RENDER = not flag("--no-render")
DO_EXPORT = not flag("--no-export")
ONLY = arg("--only", "", str)
SAMPLES = arg("--samples", 96, int)
SCALE = arg("--scale", 1.0)

# ---- dimensions (metres; ASSUMPTIONS, see README) ----------------------------------------------------------------
W = 3.0
WALL_T = 0.25
Z_PLINTH = 0.5
Z_HEAD_G = 2.75          # top of the shopfront opening
Z_STRING = 3.2
Z_SILL = 3.9
Z_HEAD_U = 5.4
Z_TOPWALL = 6.0
WIN_W = 1.0
WIN_X = (0.35, 1.65)     # window left edges

MAT_NAMES = ["PLASTER", "TIMBER", "GLASS", "FRAME", "CANVAS", "SIGN", "IRON", "INTERIOR", "STONE", "POSTER", "STAIN", "INK"]
MATS = {}
for _n in MAT_NAMES:
    MATS[_n] = bpy.data.materials.new(_n)


def srgb(r, g, b, a=1.0):
    f = lambda c: ((c / 255.0 + 0.055) / 1.055) ** 2.4 if c / 255.0 > 0.04045 else c / 255.0 / 12.92
    return (f(r), f(g), f(b), a)


def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def smoothstep(a, b, x):
    t = clamp((x - a) / (b - a))
    return t * t * (3 - 2 * t)


def hash01(*p):
    s = sum(math.sin(v * (12.9898 + 7.7 * i) + 4.1 * i) * 43758.5453 for i, v in enumerate(p))
    return s - math.floor(s)


# ---- part builder --------------------------------------------------------------------------------------------------
class Part:
    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.float_color.new("Col")
        self.wear = self.bm.loops.layers.float_color.new("_WEAR")
        self.uv0 = self.bm.loops.layers.uv.new("UV0")
        self.uv1 = self.bm.loops.layers.uv.new("UV1")
        self.flags = self.bm.faces.layers.int.new("flags")   # 1 = colours custom, 2 = uv custom
        self.slots = []
        self.dirt_scale = 1.0

    def mi(self, mat):
        if mat not in self.slots:
            self.slots.append(mat)
        return self.slots.index(mat)

    def face(self, vs, mat, smooth=False):
        f = self.bm.faces.new(vs)
        f.material_index = self.mi(mat)
        f.smooth = smooth
        return f

    def tris(self):
        return sum(len(f.verts) - 2 for f in self.bm.faces)

    def finish(self):
        """Generic per-loop vertex data and UV0 for faces that were not given custom values."""
        bm = self.bm
        bm.verts.ensure_lookup_table()
        bm.normal_update()
        wear_v = {}
        for v in bm.verts:
            ang = 0.0
            for e in v.link_edges:
                try:
                    a = e.calc_face_angle(None)
                except Exception:
                    a = None
                if a is not None:
                    ang = max(ang, a)
            wear_v[v] = clamp((ang - 0.35) / 0.9) * (0.65 + 0.35 * hash01(v.co.x * 5, v.co.y * 5, v.co.z * 5))
        for f in bm.faces:
            fl = f[self.flags]
            mat = self.slots[f.material_index]
            n = f.normal
            for lp in f.loops:
                co = lp.vert.co
                if not fl & 1:
                    r = self.dirt(co, n) if mat not in ("INTERIOR", "GLASS", "STAIN", "POSTER") else 0.0
                    if mat == "POSTER":
                        r = 0.25 + 0.4 * self.dirt(co, n)
                    lp[self.col] = (1, 1, 1, 1) if mat != "INTERIOR" else srgb(26, 20, 15)
                    lp[self.wear] = (r, wear_v[lp.vert] if mat not in ("GLASS", "STAIN", "CANVAS") else 0.0, 0.0, 1.0)
                if not fl & 2:
                    ax = max(range(3), key=lambda i: abs(n[i]))
                    if ax == 0:
                        uv = (co.y, co.z)
                    elif ax == 1:
                        uv = (co.x, co.z)
                    else:
                        uv = (co.x, co.y)
                    if mat in ("TIMBER", "FRAME", "SIGN", "IRON"):
                        ext = [0.0, 0.0]
                        for l2 in f.loops:
                            c2 = l2.vert.co
                            p2 = (c2.y, c2.z) if ax == 0 else ((c2.x, c2.z) if ax == 1 else (c2.x, c2.y))
                            ext[0] = max(ext[0], abs(p2[0] - uv[0]))
                            ext[1] = max(ext[1], abs(p2[1] - uv[1]))
                        if ext[1] > ext[0]:
                            uv = (uv[1], uv[0])
                        h = hash01(f.calc_center_median().x * 3, f.calc_center_median().z * 3)
                        uv = (uv[0] + h * 5.0, uv[1] + h * 3.0)
                    lp[self.uv0].uv = uv

    def dirt(self, co, n):
        z = co.z
        g = max(0.0, 1.0 - (z - Z_PLINTH) / 0.9) ** 1.7
        if z < Z_PLINTH:
            g = 1.0
        soot = smoothstep(5.35, 5.95, z) * 0.6 if z > 5.35 else 0.0
        r = max(g * 0.95, soot)
        if n.z < -0.5:
            r += 0.25
        elif n.z > 0.5:
            r += 0.12
        r += (hash01(co.x * 9, co.y * 9, co.z * 9) - 0.5) * 0.14
        return clamp(r * self.dirt_scale)

    def to_object(self, coll):
        mesh = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(mesh)
        for m in self.slots:
            mesh.materials.append(MATS[m])
        try:
            mesh.color_attributes.active_color = mesh.color_attributes["Col"]
            mesh.color_attributes.render_color_index = mesh.color_attributes.find("Col")
        except Exception:
            pass
        obj = bpy.data.objects.new(self.name, mesh)
        coll.objects.link(obj)
        self.bm.free()
        return obj


def obox(P, mat, c, axes, half, smooth=False):
    c = Vector(c)
    ax = [Vector(a) for a in axes]
    vs = []
    for i in range(8):
        sx = 1 if i & 1 else -1
        sy = 1 if i & 2 else -1
        sz = 1 if i & 4 else -1
        vs.append(P.bm.verts.new(c + ax[0] * sx * half[0] + ax[1] * sy * half[1] + ax[2] * sz * half[2]))
    quads = [(0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5), (0, 2, 3, 1), (4, 5, 7, 6)]
    det = ax[0].dot(ax[1].cross(ax[2]))
    for q in quads:
        idx = q if det > 0 else q[::-1]
        P.face([vs[i] for i in idx], mat, smooth)


def box(P, mat, x0, y0, z0, x1, y1, z1):
    x0, x1 = sorted((x0, x1))
    y0, y1 = sorted((y0, y1))
    z0, z1 = sorted((z0, z1))
    obox(P, mat, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), ((1, 0, 0), (0, 1, 0), (0, 0, 1)),
         ((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2))


def beam(P, mat, p0, p1, w, t, up=(1, 0, 0)):
    """Box of cross-section w (along `up`-ish) by t between two points."""
    p0, p1 = Vector(p0), Vector(p1)
    a = (p1 - p0)
    ln = a.length
    a.normalize()
    upv = Vector(up)
    if abs(a.dot(upv)) > 0.95:
        upv = Vector((0, 0, 1))
    s = a.cross(upv).normalized()
    u = s.cross(a).normalized()
    obox(P, mat, (p0 + p1) / 2, (a, u, s), (ln / 2, w / 2, t / 2))


def cyl(P, mat, p0, p1, r, seg=8, r1=None, caps=(True, True), smooth=True):
    p0, p1 = Vector(p0), Vector(p1)
    r1 = r if r1 is None else r1
    a = (p1 - p0).normalized()
    ref = Vector((0, 0, 1)) if abs(a.z) < 0.9 else Vector((1, 0, 0))
    u = a.cross(ref).normalized()
    v = a.cross(u)
    ring0 = [P.bm.verts.new(p0 + (u * math.cos(2 * math.pi * i / seg) + v * math.sin(2 * math.pi * i / seg)) * r) for i in range(seg)]
    ring1 = [P.bm.verts.new(p1 + (u * math.cos(2 * math.pi * i / seg) + v * math.sin(2 * math.pi * i / seg)) * r1) for i in range(seg)]
    for i in range(seg):
        j = (i + 1) % seg
        P.face([ring0[i], ring0[j], ring1[j], ring1[i]], mat, smooth)
    if caps[1]:
        P.face(ring1, mat, False)
    if caps[0]:
        P.face(ring0[::-1], mat, False)
    if smooth:
        for ring in (ring0, ring1):
            for i in range(seg):
                e = P.bm.edges.get((ring[i], ring[(i + 1) % seg]))
                if e:
                    e.smooth = False


def extrude_x(P, mat, prof, x0, x1):
    n = len(prof)
    area = sum(prof[i][0] * prof[(i + 1) % n][1] - prof[(i + 1) % n][0] * prof[i][1] for i in range(n)) / 2
    if area < 0:
        prof = prof[::-1]
    A = [P.bm.verts.new((x0, y, z)) for y, z in prof]
    B = [P.bm.verts.new((x1, y, z)) for y, z in prof]
    P.face(B, mat)
    P.face(A[::-1], mat)
    for i in range(n):
        j = (i + 1) % n
        P.face([A[i], A[j], B[j], B[i]], mat)


def patch(P, mat, org, U, V, nu, nv, disp=None, col=None, wear=None, smooth=True, flip=False):
    """Grid patch org + s*U + t*V; normal = U x V. col(s,t) -> RGBA, wear(s,t) -> RGBA (_WEAR)."""
    org, U, V = Vector(org), Vector(U), Vector(V)
    rows, st = [], {}
    for j in range(nv + 1):
        row = []
        for i in range(nu + 1):
            s, t = i / nu, j / nv
            p = org + U * s + V * t
            if disp:
                p = p + Vector(disp(s, t))
            vv = P.bm.verts.new(p)
            st[vv] = (s, t)
            row.append(vv)
        rows.append(row)
    lu, lv = U.length, V.length
    faces = []
    for j in range(nv):
        for i in range(nu):
            vs = [rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]]
            if flip:
                vs.reverse()
            f = P.face(vs, mat, smooth)
            fl = 2
            for lp in f.loops:
                s, t = st[lp.vert]
                lp[P.uv0].uv = (s * lu, t * lv)
                if col:
                    lp[P.col] = col(s, t)
                if wear:
                    lp[P.wear] = wear(s, t)
            if col or wear:
                fl |= 1
                for lp in f.loops:
                    s, t = st[lp.vert]
                    if not col:
                        lp[P.col] = (1, 1, 1, 1)
                    if not wear:
                        lp[P.wear] = (0, 0, 0, 1)
            f[P.flags] = fl
            faces.append(f)
    return faces


def poly(P, mat, pts, col=None, wear=None, smooth=False):
    vs = [P.bm.verts.new(p) for p in pts]
    f = P.face(vs, mat, smooth)
    f[P.flags] = 3
    ext = [max(p[k] for p in pts) - min(p[k] for p in pts) for k in range(3)]
    axes = sorted(range(3), key=lambda k: -ext[k])[:2]
    for lp in f.loops:
        co = lp.vert.co
        lp[P.uv0].uv = (co[axes[0]], co[axes[1]])
        lp[P.col] = col(co) if col else (1, 1, 1, 1)
        lp[P.wear] = wear(co) if wear else (0, 0, 0, 1)
    return f


def wall_slab(P, xs, zs, holes, yf, yb, bevel=0.0, hole_back=None, back_faces=True, mat="PLASTER", outer_sides=True):
    V = {}

    def v(i, j, y):
        k = (i, j, round(y, 5))
        if k not in V:
            V[k] = P.bm.verts.new((xs[i], y, zs[j]))
        return V[k]

    nx, nz = len(xs) - 1, len(zs) - 1
    perim = []
    for i in range(nx):
        for j in range(nz):
            if (i, j) in holes:
                if hole_back is not None:
                    P.face([v(i, j, hole_back), v(i + 1, j, hole_back), v(i + 1, j + 1, hole_back), v(i, j + 1, hole_back)], "INTERIOR")
                continue
            P.face([v(i, j, yf), v(i + 1, j, yf), v(i + 1, j + 1, yf), v(i, j + 1, yf)], mat)
            if back_faces:
                P.face([v(i, j, yb), v(i, j + 1, yb), v(i + 1, j + 1, yb), v(i + 1, j, yb)], mat)
            for d, (di, dj) in enumerate(((1, 0), (-1, 0), (0, 1), (0, -1))):
                ni, nj = i + di, j + dj
                outside = not (0 <= ni < nx and 0 <= nj < nz)
                nb_hole = (ni, nj) in holes
                if not (nb_hole or outside):
                    continue
                if outside and (not outer_sides or dj != 0):
                    continue
                y_end = hole_back if (nb_hole and hole_back is not None) else yb
                if d == 0:
                    P.face([v(i + 1, j, yf), v(i + 1, j, y_end), v(i + 1, j + 1, y_end), v(i + 1, j + 1, yf)], mat)
                    if nb_hole:
                        perim.append((v(i + 1, j, yf), v(i + 1, j + 1, yf)))
                elif d == 1:
                    P.face([v(i, j, yf), v(i, j + 1, yf), v(i, j + 1, y_end), v(i, j, y_end)], mat)
                    if nb_hole:
                        perim.append((v(i, j, yf), v(i, j + 1, yf)))
                elif d == 2:
                    P.face([v(i, j + 1, yf), v(i + 1, j + 1, yf), v(i + 1, j + 1, y_end), v(i, j + 1, y_end)], mat)
                    if nb_hole:
                        perim.append((v(i, j + 1, yf), v(i + 1, j + 1, yf)))
                else:
                    P.face([v(i, j, yf), v(i, j, y_end), v(i + 1, j, y_end), v(i + 1, j, yf)], mat)
                    if nb_hole:
                        perim.append((v(i, j, yf), v(i + 1, j, yf)))
    if bevel > 0:
        edges = []
        for a, b in perim:
            e = P.bm.edges.get((a, b))
            if e and e not in edges:
                edges.append(e)
        bmesh.ops.bevel(P.bm, geom=edges, offset=bevel, offset_type="OFFSET", segments=2, profile=0.5, affect="EDGES")


XS = [0, 0.30, 0.35, 1.35, 1.65, 2.65, 2.70, 3.0]
ZS = [Z_PLINTH, 0.7, 1.0, 1.5, Z_HEAD_G, Z_STRING, Z_SILL, Z_HEAD_U, Z_TOPWALL]
HOLES = {(i, j) for i in range(1, 6) for j in range(0, 4)} | {(2, 6), (4, 6)}
XS2 = [0, 0.30, 0.35, 1.35, 1.65, 2.65, 2.70, 3.0]
ZS2 = [Z_PLINTH, Z_HEAD_G, Z_SILL, Z_HEAD_U, Z_TOPWALL]
HOLES2 = {(i, 0) for i in range(1, 6)} | {(2, 2), (4, 2)}

# ---- shell: plaster wall, plinth, string course, cornice, sills --------------------------------------------------
def build_shell(lod):
    P = Part("shell")
    if lod == 2:
        wall_slab(P, XS2, ZS2, HOLES2, 0.0, WALL_T, hole_back=0.09, back_faces=False, outer_sides=False)
    elif lod == 1:
        wall_slab(P, XS, ZS, HOLES, 0.0, WALL_T, bevel=0.0, back_faces=False)
    else:
        wall_slab(P, XS, ZS, HOLES, 0.0, WALL_T, bevel=0.012)
    # plinth (stone) with sloped top, slightly proud
    if lod == 2:
        box(P, "STONE", 0, -0.04, 0, W, WALL_T, Z_PLINTH)
    else:
        extrude_x(P, "STONE", [(WALL_T, 0.0), (-0.04, 0.0), (-0.04, 0.455), (-0.015, 0.5), (WALL_T, 0.5)], 0, W)
    # string course between the storeys
    if lod == 2:
        box(P, "PLASTER", 0, -0.05, Z_STRING - 0.06, W, 0.0, Z_STRING + 0.1)
    else:
        extrude_x(P, "PLASTER", [(0.02, 3.14), (-0.03, 3.14), (-0.03, 3.17), (-0.06, 3.19), (-0.06, 3.26), (-0.04, 3.28),
                                 (0.0, 3.30), (0.02, 3.30)], 0, W)
    # cornice + small parapet (profile swept along X)
    if lod == 2:
        cor = [(0.28, 5.95), (-0.15, 5.95), (-0.15, 6.3), (-0.03, 6.32), (-0.03, 6.9), (0.28, 6.9)]
    elif lod == 1:
        cor = [(0.28, 5.95), (-0.02, 5.95), (-0.10, 6.06), (-0.16, 6.16), (-0.16, 6.28), (0.0, 6.3), (0.0, 6.78),
               (-0.03, 6.82), (-0.03, 6.9), (0.28, 6.9)]
    else:
        cor = [(0.28, 5.95), (-0.02, 5.95), (-0.02, 6.02), (-0.06, 6.04), (-0.09, 6.08), (-0.09, 6.12), (-0.16, 6.15),
               (-0.16, 6.22), (-0.13, 6.24), (-0.13, 6.28), (-0.04, 6.30), (0.0, 6.30), (0.0, 6.78), (-0.03, 6.82),
               (-0.03, 6.90), (0.28, 6.90), (0.28, 6.84), (0.25, 6.84)]
    extrude_x(P, "PLASTER", cor, 0, W)
    if lod < 2:
        for k in range(8):                      # corbel blocks under the cornice
            cx = (k + 0.5) * W / 8
            box(P, "PLASTER", cx - 0.045, -0.085, 5.76, cx + 0.045, 0.0, 5.95)
        # stone step in front of the shopfront and door threshold
        box(P, "STONE", 0.3, -0.42, 0.0, 2.7, -0.04, 0.24)
        box(P, "STONE", 0.3, -0.04, 0.0, 2.7, 0.0, 0.5)
    # window sills (stone, with drip groove) and heads
    for x0 in WIN_X:
        if lod == 2:
            continue
        zs = Z_SILL
        if lod == 1:
            box(P, "STONE", x0 - 0.05, -0.07, zs - 0.03, x0 + WIN_W + 0.05, 0.22, zs + 0.03)
            continue
        prof = [(0.22, zs + 0.04), (-0.07, zs + 0.005), (-0.07, zs - 0.03), (-0.05, zs - 0.03), (-0.05, zs - 0.012),
                (-0.03, zs - 0.012), (-0.03, zs - 0.03), (0.0, zs - 0.03), (0.22, zs - 0.03)]
        extrude_x(P, "STONE", prof, x0 - 0.05, x0 + WIN_W + 0.05)
        # plain head with a small drip hood
        box(P, "PLASTER", x0 - 0.06, -0.045, Z_HEAD_U + 0.02, x0 + WIN_W + 0.06, 0.0, Z_HEAD_U + 0.11)
        box(P, "PLASTER", x0 - 0.065, -0.055, Z_HEAD_U + 0.11, x0 + WIN_W + 0.065, -0.03, Z_HEAD_U + 0.135)
    P.dirt_scale = 1.0
    return P


# ---- upper windows: frame, two offset sashes, muntins, wavy glass -----------------------------------------------
def build_windows(lod):
    P = Part("windows")
    for k, x0 in enumerate(WIN_X):
        x1 = x0 + WIN_W
        zb, zt = Z_SILL, Z_HEAD_U
        raised = 0.26 if k == 1 else 0.0
        # frame ring, set back 5 cm from the wall face
        fy0, fy1 = 0.10, 0.24
        box(P, "FRAME", x0, fy0, zb + 0.04, x0 + 0.06, fy1, zt)
        box(P, "FRAME", x1 - 0.06, fy0, zb + 0.04, x1, fy1, zt)
        box(P, "FRAME", x0 + 0.06, fy0, zt - 0.06, x1 - 0.06, fy1, zt)
        box(P, "FRAME", x0, fy0 - 0.005, zb + 0.04, x1, fy1, zb + 0.075)        # window board / frame sill
        ix0, ix1 = x0 + 0.06, x1 - 0.06
        iz0, iz1 = zb + 0.075, zt - 0.06
        H = iz1 - iz0
        sh = H / 2 + 0.02
        if lod == 0:
            box(P, "FRAME", ix0, 0.158, iz0, ix0 + 0.012, 0.178, iz1)           # parting beads
            box(P, "FRAME", ix1 - 0.012, 0.158, iz0, ix1, 0.178, iz1)
        for name, ya, sz0, dz in (("upper", 0.125, iz1 - sh, 0.0), ("lower", 0.178, iz0, raised)):
            y0, y1 = ya, ya + 0.033
            z0, z1 = sz0 + dz, sz0 + sh + dz
            if name == "lower" and lod == 0:
                pass
            if lod == 0:
                stile, trail, brail = 0.04, (0.035 if name == "upper" else 0.045), (0.045 if name == "upper" else 0.05)
                box(P, "FRAME", ix0, y0, z0, ix0 + stile, y1, z1)
                box(P, "FRAME", ix1 - stile, y0, z0, ix1, y1, z1)
                box(P, "FRAME", ix0 + stile, y0, z1 - trail, ix1 - stile, y1, z1)
                box(P, "FRAME", ix0 + stile, y0, z0, ix1 - stile, y1, z0 + brail)
                gx0, gx1, gz0, gz1 = ix0 + stile, ix1 - stile, z0 + brail, z1 - trail
                ym = (y0 + y1) / 2
                for m in (1, 2):                                            # 3 lights across
                    xm = gx0 + (gx1 - gx0) * m / 3
                    box(P, "FRAME", xm - 0.011, ym - 0.012, gz0, xm + 0.011, ym + 0.012, gz1)
                for m in (1, 2):                                            # 3 lights high (9 lights per sash)
                    zm = gz0 + (gz1 - gz0) * m / 3
                    box(P, "FRAME", gx0, ym - 0.0115, zm - 0.011, gx1, ym + 0.0115, zm + 0.011)
                # wavy cylinder-glass with dirt at the edges
                def gcol(s, t):
                    return (0.86, 0.95, 0.92, 1.0)
                def gwear(s, t):
                    e = min(s, 1 - s, t, 1 - t)
                    return (clamp(1.0 - e * 9.0) * 0.8 + 0.1 * hash01(s * 40, t * 40), 0, 0, 1)
                def wave(s, t):
                    return (0, 0.0007 * math.sin(s * 9.0 + t * 3.0 + k) + 0.0005 * math.sin(t * 11.0 - s * 4.0), 0)
                patch(P, "GLASS", (gx0, ym, gz0), (gx1 - gx0, 0, 0), (0, 0, gz1 - gz0), 6, 6, disp=wave, col=gcol, wear=gwear)
            else:
                box(P, "FRAME", ix0, y0, z0, ix1, y1, z0 + 0.05)
                box(P, "FRAME", ix0, y0, z0, ix0 + 0.04, y1, z1)
                box(P, "FRAME", ix1 - 0.04, y0, z0, ix1, y1, z1)
                box(P, "FRAME", ix0 + 0.04, y0 + 0.008, (z0 + z1) / 2 - 0.01, ix1 - 0.04, y1 - 0.008, (z0 + z1) / 2 + 0.01)
                box(P, "FRAME", ix0, y0, z1 - 0.04, ix1, y1, z1)
                patch(P, "GLASS", (ix0, (y0 + y1) / 2, z0 + 0.05), (ix1 - ix0, 0, 0), (0, 0, sh - 0.09), 1, 1,
                      col=lambda s, t: (0.86, 0.95, 0.92, 1.0), wear=lambda s, t: (0.15, 0, 0, 1))
        if lod == 0:
            # sash lock at the meeting rail, sash lifts on the lower sash
            box(P, "IRON", (ix0 + ix1) / 2 - 0.02, 0.11, iz0 + sh + raised - 0.05, (ix0 + ix1) / 2 + 0.02, 0.13, iz0 + sh + raised - 0.03)
            for sx in (ix0 + 0.1, ix1 - 0.1):
                box(P, "IRON", sx - 0.02, 0.16, iz0 + raised + 0.0, sx + 0.02, 0.175, iz0 + raised + 0.012)
    return P


# ---- ground floor: header, posts, threshold, sliding lattice + glazed doors --------------------------------------
def door_panel(P, x0, y0, kind, lod):
    x1 = x0 + 0.6
    z0, z1 = 0.57, 2.53
    t = 0.03
    y1 = y0 + t
    ym = y0 + t / 2
    mat = "TIMBER" if kind == "lattice" else "FRAME"
    if lod >= 1:
        if kind == "lattice":
            box(P, "TIMBER", x0, y0, z0, x1, y1, z1)
        else:
            box(P, "FRAME", x0, y0, z0, x1, y1, 1.05)
            box(P, "FRAME", x0, y0, 2.45, x1, y1, z1)
            patch(P, "GLASS", (x0 + 0.04, ym, 1.05), (0.52, 0, 0), (0, 0, 1.4), 1, 1, col=lambda s, t: (0.86, 0.95, 0.92, 1.0),
                  wear=lambda s, t: (0.2, 0, 0, 1))
        return
    box(P, mat, x0, y0, z0, x0 + 0.04, y1, z1)
    box(P, mat, x1 - 0.04, y0, z0, x1, y1, z1)
    box(P, mat, x0 + 0.04, y0, z0, x1 - 0.04, y1, z0 + 0.09)
    box(P, mat, x0 + 0.04, y0, 2.45, x1 - 0.04, y1, z1)
    box(P, mat, x0 + 0.04, y0, 1.05, x1 - 0.04, y1, 1.10)
    if kind == "lattice":
        box(P, mat, x0 + 0.04, y0 + 0.006, 0.66, x1 - 0.04, y1 - 0.006, 1.05)          # kick board
        box(P, mat, x0 + 0.075, y0 - 0.006, 0.7, x1 - 0.075, y0 + 0.006, 1.0)          # raised panel
        for b in range(6):                                                              # 2 x 3.5 cm bars, 8 cm pitch
            bx = x0 + 0.04 + (b + 0.5) * 0.52 / 6
            box(P, mat, bx - 0.01, ym - 0.0175, 1.10, bx + 0.01, ym + 0.0175, 2.45)
        for zt in (1.62, 2.06):
            box(P, mat, x0 + 0.04, ym - 0.006, zt - 0.006, x1 - 0.04, ym + 0.006, zt + 0.006)
    else:
        box(P, "TIMBER", x0 + 0.04, y0 + 0.004, 0.66, x1 - 0.04, y1 - 0.004, 1.05)
        gx0, gx1, gz0, gz1 = x0 + 0.04, x1 - 0.04, 1.10, 2.45
        for m in (1, 2):
            xm = gx0 + (gx1 - gx0) * m / 3
            box(P, mat, xm - 0.008, ym - 0.01, gz0, xm + 0.008, ym + 0.01, gz1)
        for m in range(1, 5):
            zm = gz0 + (gz1 - gz0) * m / 5
            box(P, mat, gx0, ym - 0.01, zm - 0.008, gx1, ym + 0.01, zm + 0.008)
        wave = lambda s, t: (0, 0.0006 * math.sin(s * 8 + t * 5 + x0 * 7), 0)
        patch(P, "GLASS", (gx0, ym, gz0), (gx1 - gx0, 0, 0), (0, 0, gz1 - gz0), 4, 6, disp=wave,
              col=lambda s, t: (0.86, 0.95, 0.92, 1.0),
              wear=lambda s, t: (clamp(1.0 - min(s, 1 - s, t, 1 - t) * 8.0) * 0.8, 0, 0, 1))
    if kind == "lattice":
        box(P, "IRON", x1 - 0.13, y0 - 0.008, 1.0, x1 - 0.1, y0, 1.12)              # pull handle plate
    else:
        box(P, "IRON", x0 + 0.1, y0 - 0.008, 1.02, x0 + 0.13, y0, 1.12)


def build_ground(lod):
    P = Part("shopfront")
    box(P, "TIMBER", 0.3, 0.03, 2.55, 2.7, 0.24, Z_HEAD_G)          # header beam (kamoi)
    if lod == 2:
        return P
    box(P, "TIMBER", 0.3, 0.03, 0.5, 0.36, 0.22, 2.55)               # posts 6 cm
    box(P, "TIMBER", 2.64, 0.03, 0.5, 2.7, 0.22, 2.55)
    if lod == 0:
        box(P, "TIMBER", 0.36, 0.26, 0.5, 2.64, 0.44, 0.56)          # threshold sill (shikii)
        for yr in (0.285, 0.34):
            box(P, "TIMBER", 0.36, yr, 0.56, 2.64, yr + 0.012, 0.572)  # door-track ridges
        box(P, "TIMBER", 0.36, 0.26, 2.51, 2.64, 0.44, 2.55)         # upper track (kamoi groove)
    # sliding doors, two tracks offset in depth; the right lattice door is slid partly open
    door_panel(P, 0.36, 0.285, "lattice", lod)
    door_panel(P, 0.90, 0.345, "glazed", lod)
    door_panel(P, 1.50, 0.345, "glazed", lod)
    door_panel(P, 1.75, 0.285, "lattice", lod)
    if lod == 0:
        for bi in range(6):                                         # stacked shutter boards (agedo) beside the left post
            box(P, "TIMBER", 0.37, 0.05 + 0.0 * bi, 0.6 + bi * 0.008 + bi * 0.30, 0.42, 0.075, 0.6 + bi * 0.008 + bi * 0.30 + 0.29)
    return P


def build_lanterns(lod):
    """Paper lanterns hung from the awning rod (157871: lantern rows under eaves). Emissive via _WEAR.B."""
    P = Part("lanterns")
    for lx in (0.75, 1.5, 2.25):
        cx, cy, ztop = lx, -0.9, 2.03
        icyl(P, (cx, cy, ztop + 0.03), (cx, cy, ztop), 0.004, (30, 24, 20), 4)
        icyl(P, (cx, cy, ztop - 0.02), (cx, cy, ztop), 0.05, (40, 30, 24), 10)
        icyl(P, (cx, cy, ztop - 0.27), (cx, cy, ztop - 0.02), 0.095, (255, 190, 105), 14, emit=1.0)
        for rz in (0.06, 0.13, 0.2):                               # bamboo ribs
            icyl(P, (cx, cy, ztop - rz - 0.003), (cx, cy, ztop - rz + 0.003), 0.098, (60, 40, 24), 14, caps=(False, False))
        icyl(P, (cx, cy, ztop - 0.29), (cx, cy, ztop - 0.27), 0.05, (40, 30, 24), 10)
    return P


def build_fascia(lod):
    P = Part("fascia")
    zb, zt = 2.80, 3.13
    if lod == 2:
        box(P, "SIGN", 0, -0.055, zb, W, 0.0, zt)
        return P
    box(P, "SIGN", 0, -0.04, zb + 0.03, W, 0.0, zt - 0.03)
    box(P, "TIMBER", 0, -0.06, zt - 0.035, W, 0.0, zt)
    box(P, "TIMBER", 0, -0.06, zb, W, 0.0, zb + 0.035)
    if lod == 0:
        # fictional mark: a small ring + bar, no text
        seg = 20
        for i in range(seg):
            a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
            pts = []
            for a, r in ((a0, 0.085), (a1, 0.085), (a1, 0.065), (a0, 0.065)):
                pts.append((1.5 + r * math.cos(a), -0.0415, 2.965 + r * math.sin(a)))
            P.face([P.bm.verts.new(p) for p in pts[::-1]], "INK")
        box(P, "INK", 1.5 - 0.3, -0.043, 2.955, 1.5 - 0.11, -0.04, 2.975)
        box(P, "INK", 1.5 + 0.11, -0.043, 2.955, 1.5 + 0.3, -0.04, 2.975)
        for cx in (0.04, W - 0.04):                                   # iron nails at the ends
            box(P, "IRON", cx - 0.008, -0.05, 2.955, cx + 0.008, -0.04, 2.975)
    return P


# ---- awning: sagging striped canvas, scalloped valance, iron stays -----------------------------------------------
def build_awning(lod):
    P = Part("awning")
    y_w, z_w = -0.03, 2.72
    y_l, z_l = -0.95, 2.24
    nstrip = 12 if lod < 2 else 3
    ns = 6 if lod == 0 else (2 if lod == 1 else 1)
    sw = W / nstrip

    def stripe(i):
        return srgb(214, 205, 180) if i % 2 == 0 else srgb(38, 52, 86)

    def sag(x, t):
        ph = ((x - 0.375) % 1.125) / 1.125
        return -0.045 * math.sin(math.pi * ph) * t if lod == 0 else 0.0

    for i in range(nstrip):
        xa = i * sw
        c = stripe(i)
        def col(s, t, c=c):
            return c
        def wr(s, t):
            return (clamp(0.1 + 0.55 * t * t + 0.25 * (1 - t) * (0.6 + hash01(s * 20 + i, t * 9))), 0.0, 0.0, 1.0)
        def disp(s, t, xa=xa):
            x = xa + s * sw
            return (0, 0, sag(x, t))
        patch(P, "CANVAS", (xa, y_w, z_w), (sw, 0, 0), (0, y_l - y_w, z_l - z_w), 2 if lod == 0 else 1, ns, disp=disp, col=col, wear=wr,
              flip=True)
        # scalloped valance (real geometry)
        nseg = 6 if lod == 0 else (3 if lod == 1 else 1)
        top, bot = [], []
        for m in range(nseg + 1):
            s = m / nseg
            x = xa + s * sw
            zt_ = z_l + sag(x, 1.0)
            zb_ = zt_ - 0.17 - (0.06 * math.sin(math.pi * s) if lod == 0 else 0.03)
            yv = y_l - 0.004 * math.sin(x * 5.0)
            top.append(P.bm.verts.new((x, yv, zt_)))
            bot.append(P.bm.verts.new((x, yv - 0.012 * math.sin(math.pi * s), zb_)))
        for m in range(nseg):
            f = P.face([top[m], bot[m], bot[m + 1], top[m + 1]], "CANVAS", True)
            f[P.flags] = 3
            for lp in f.loops:
                lp[P.col] = stripe(i)
                zz = lp.vert.co.z
                lp[P.wear] = (clamp(0.35 + 0.5 * (z_l - zz) * 3.0), 0, 0, 1)
                lp[P.uv0].uv = (lp.vert.co.x, lp.vert.co.z)
    if lod == 0:
        cyl(P, "IRON", (0.02, y_l, z_l + 0.01), (W - 0.02, y_l, z_l + 0.01), 0.011, 8)          # front rod
        cyl(P, "IRON", (0.0, y_w - 0.005, z_w + 0.01), (W, y_w - 0.005, z_w + 0.01), 0.009, 8)  # wall rod
    for bx in (0.375, 1.5, 2.625):
        if lod == 2:
            continue
        beam(P, "IRON", (bx, -0.03, 2.66), (bx, -0.93, 2.19), 0.03, 0.012, up=(1, 0, 0))
        if lod == 0:
            beam(P, "IRON", (bx, -0.03, 2.28), (bx, -0.62, 2.43), 0.022, 0.012, up=(1, 0, 0))
            box(P, "IRON", bx - 0.04, -0.045, 2.2, bx + 0.04, -0.03, 2.72)
    return P


# ---- hanging disc signboard on an iron bracket -------------------------------------------------------------------
def build_sign(lod):
    P = Part("sign")
    cy, cz, cx = -0.65, 3.2, 0.15
    seg = 32 if lod == 0 else (12 if lod == 1 else 8)
    cyl(P, "TIMBER", (cx - 0.03, cy, cz), (cx + 0.03, cy, cz), 0.31, seg)           # rim
    cyl(P, "SIGN", (cx - 0.032, cy, cz), (cx + 0.032, cy, cz), 0.285, seg)          # face (blank board, fictional)
    if lod == 2:
        return P
    box(P, "IRON", cx - 0.03, -0.03, 3.45, cx + 0.03, -0.02, 3.8)                   # wall plate
    beam(P, "IRON", (cx, -0.03, 3.62), (cx, -0.9, 3.62), 0.035, 0.03, up=(1, 0, 0))
    beam(P, "IRON", (cx, -0.03, 3.4), (cx, -0.62, 3.6), 0.028, 0.02, up=(1, 0, 0))
    if lod == 0:
        for hy in (-0.5, -0.8):
            cyl(P, "IRON", (cx, hy, 3.62), (cx, hy, cz + 0.29), 0.006, 6)
        # fictional mark: ring with a diamond, both faces
        for sgn in (1, -1):
            xm = cx + sgn * 0.0335
            nseg = 24
            for i in range(nseg):
                a0, a1 = 2 * math.pi * i / nseg, 2 * math.pi * (i + 1) / nseg
                pts = [(xm, cy + r * math.cos(a), cz + r * math.sin(a)) for a, r in ((a0, 0.2), (a1, 0.2), (a1, 0.17), (a0, 0.17))]
                P.face([P.bm.verts.new(p) for p in (pts if sgn > 0 else pts[::-1])], "INK")
            d = 0.085
            pts = [(xm, cy, cz + d), (xm, cy + d, cz), (xm, cy, cz - d), (xm, cy - d, cz)]
            P.face([P.bm.verts.new(p) for p in (pts if sgn > 0 else pts[::-1])], "INK")
    return P


# ---- services (LOD0 only): insulator brackets with wires, house-number plate -------------------------------------
def build_services():
    P = Part("services")
    for ix in (2.78, 2.9):
        box(P, "IRON", ix - 0.02, -0.06, 5.56, ix + 0.02, 0.0, 5.6)
        cyl(P, "STONE", (ix, -0.06, 5.58), (ix, -0.15, 5.58), 0.022, 8)                # porcelain-like insulator (generic)
        cyl(P, "STONE", (ix, -0.15, 5.58), (ix, -0.19, 5.58), 0.03, 8)
        n = 8
        pts = [Vector((ix, -0.19 - 0.9 * i / n, 5.58 - 0.16 * (i / n) - 0.05 * math.sin(math.pi * i / n))) for i in range(n + 1)]
        for a, b in zip(pts[:-1], pts[1:]):
            cyl(P, "IRON", a, b, 0.005, 4, caps=(False, False), smooth=False)
    box(P, "SIGN", 0.09, -0.02, 1.7, 0.21, 0.0, 1.9)                                   # house-number plate (fictional)
    box(P, "INK", 0.13, -0.023, 1.74, 0.17, -0.02, 1.86)
    return P


# ---- wear decals: rain streaks, soot band, splash zone, torn fictional posters ----------------------------------
def build_decals():
    P = Part("decals")
    ink = (0.03, 0.022, 0.015, 1.0)

    def dec(s, t, a):
        return (0.03, 0.022, 0.015, a)

    # rain streaks under each sill
    for k, x0 in enumerate(WIN_X):
        for si in range(6):
            sx = x0 - 0.02 + WIN_W * (si + 0.5 + 0.3 * (hash01(k, si) - 0.5)) / 6
            wd = 0.016 + 0.03 * hash01(k, si, 3)
            ln = 0.3 + 0.28 * hash01(k, si, 7)
            def col(s, t, si=si, k=k):
                return (0.03, 0.022, 0.015, 0.55 * (1 - t) ** 1.4 * (0.6 + 0.4 * hash01(s * 3, si, k)))
            patch(P, "STAIN", (sx - wd / 2, -0.004, Z_SILL - 0.06), (wd, 0, 0), (0, 0, -ln), 2, 4, col=col,
                  wear=lambda s, t: (0, 0, 0, 1), smooth=False, flip=True)
    # soot band under the cornice
    def soot(s, t):
        return (0.02, 0.018, 0.014, clamp(t ** 1.6 * 0.55 * (0.55 + 0.9 * hash01(s * 18, t * 6))))
    patch(P, "STAIN", (0, -0.004, 5.5), (W, 0, 0), (0, 0, 0.45), 24, 4, col=soot, wear=lambda s, t: (0, 0, 0, 1), smooth=False, flip=True)
    # splash / damp zone on plinth and piers
    def splash(s, t):
        return (0.05, 0.035, 0.02, clamp((1 - t) * 0.75 * (0.6 + 0.6 * hash01(s * 25, t * 4)) - 0.05))
    patch(P, "STAIN", (0, -0.0455, 0.0), (W, 0, 0), (0, 0, 0.5), 30, 3, col=splash, wear=lambda s, t: (0, 0, 0, 1), smooth=False, flip=True)
    for px in (0.0, 2.7):
        patch(P, "STAIN", (px, -0.004, 0.5), (0.3, 0, 0), (0, 0, 0.75), 4, 5, col=splash, wear=lambda s, t: (0, 0, 0, 1),
              smooth=False, flip=True)
    # torn fictional handbills on the right pier (two layers) - no legible text
    def paper(co):
        return (1, 1, 1, 1)
    outline = [(2.725, 1.02), (2.985, 1.03), (2.98, 1.34), (2.95, 1.38), (2.985, 1.52), (2.97, 1.71), (2.9, 1.66), (2.86, 1.74),
               (2.8, 1.68), (2.76, 1.73), (2.725, 1.6)]
    poly(P, "POSTER", [(x, -0.0075, z) for x, z in outline][::-1], wear=lambda co: (0.25, 0, 0, 1))
    under = [(2.75, 1.3), (2.96, 1.32), (2.97, 1.62), (2.87, 1.58), (2.8, 1.64), (2.745, 1.55)]
    poly(P, "POSTER", [(x, -0.0045, z) for x, z in under][::-1], wear=lambda co: (0.35, 0, 0, 1))
    curl = [(2.985, 1.03, -0.0075), (2.985, 1.0, -0.03), (2.9, 1.02, -0.028), (2.9, 1.04, -0.0075)]
    poly(P, "POSTER", curl[::-1], wear=lambda co: (0.3, 0, 0, 1))
    return P


# ---- interiors behind the glass ---------------------------------------------------------------------------------
def albedo(rgb, emit=0.0):
    c = srgb(*rgb)

    return c, emit


def ibox(P, x0, y0, z0, x1, y1, z1, rgb, emit=0.0):
    """Box with per-face baked albedo, into INTERIOR."""
    n0 = len(P.bm.faces)
    box(P, "INTERIOR", x0, y0, z0, x1, y1, z1)
    tint(P, n0, rgb, emit)


def tint(P, n0, rgb, emit=0.0, shade=1.0):
    P.bm.faces.ensure_lookup_table()
    for f in list(P.bm.faces)[n0:]:
        f[P.flags] |= 1
        for lp in f.loops:
            c = srgb(*rgb)
            lp[P.col] = (c[0] * shade, c[1] * shade, c[2] * shade, 1.0)
            lp[P.wear] = (0, 0, emit, 1)


def icyl(P, p0, p1, r, rgb, seg=10, emit=0.0, caps=(True, True)):
    n0 = len(P.bm.faces)
    cyl(P, "INTERIOR", p0, p1, r, seg, caps=caps)
    tint(P, n0, rgb, emit)


def ipatch(P, org, U, V, nu, nv, rgb, emit=0.0, disp=None, vary=0.0, flip=False, shade_fn=None):
    def col(s, t):
        k = 1.0 - vary * hash01(s * 13.1, t * 7.7)
        if shade_fn:
            k *= shade_fn(s, t)
        c = srgb(*rgb)
        return (c[0] * k, c[1] * k, c[2] * k, 1.0)
    patch(P, "INTERIOR", org, U, V, nu, nv, disp=disp, col=col, wear=lambda s, t: (0, 0, emit, 1), smooth=False, flip=flip)


def build_interior(lod):
    P = Part("interior")
    # ---- ground floor shop: shallow box behind the doors ----
    gx0, gx1, gy0, gy1, gz0, gz1 = 0.36, 2.64, 0.44, 2.2, 0.56, 2.55
    if lod == 2:
        return P
    ipatch(P, (gx0, gy0, gz0), (gx1 - gx0, 0, 0), (0, gy1 - gy0, 0), 1 if lod else 12, 1, (112, 80, 50), vary=0.25)      # floor boards
    ipatch(P, (gx0, gy0, gz1), (0, gy1 - gy0, 0), (gx1 - gx0, 0, 0), 1, 1, (60, 44, 32), flip=False)                       # ceiling
    ipatch(P, (gx0, gy0, gz0), (0, 0, gz1 - gz0), (0, gy1 - gy0, 0), 1, 1, (150, 132, 104))                                # left wall
    ipatch(P, (gx1, gy0, gz0), (0, gy1 - gy0, 0), (0, 0, gz1 - gz0), 1, 1, (150, 132, 104))                                # right wall
    # back: shoji screens glowing warm
    ipatch(P, (gx0, gy1, gz0), (0, 0, gz1 - gz0), (gx1 - gx0, 0, 0), 1, 1, (236, 208, 158), emit=0.32, flip=False)
    if lod == 1:
        for x0 in WIN_X:                       # one box per window: floor, back wall, side walls
            rx0, rx1, ry0, ry1, rz0, rz1 = x0 - 0.25, x0 + WIN_W + 0.25, WALL_T, 2.4, 3.25, 5.85
            ipatch(P, (rx0, ry0, rz0), (rx1 - rx0, 0, 0), (0, ry1 - ry0, 0), 1, 1, (104, 72, 44))
            ipatch(P, (rx0, ry1, rz0), (0, 0, rz1 - rz0), (rx1 - rx0, 0, 0), 1, 1, (150, 134, 106), shade_fn=lambda s, t: 0.6)
            ipatch(P, (rx0, ry0, rz0), (0, 0, rz1 - rz0), (0, ry1 - ry0, 0), 1, 1, (130, 116, 92), shade_fn=lambda s, t: 0.5)
            ipatch(P, (rx1, ry0, rz0), (0, ry1 - ry0, 0), (0, 0, rz1 - rz0), 1, 1, (130, 116, 92), shade_fn=lambda s, t: 0.5)
            ipatch(P, (rx0, ry0, rz1), (0, ry1 - ry0, 0), (rx1 - rx0, 0, 0), 1, 1, (74, 62, 50))
            icyl(P, (x0 + 0.5, 0.9, 5.4), (x0 + 0.5, 0.9, 5.05), 0.12, (255, 200, 120), 8, emit=0.6)
        return P
    P.bm.faces.ensure_lookup_table()
    dark = (58, 38, 22)
    n0 = len(P.bm.faces)
    for k in range(4):
        bx = gx0 + k * (gx1 - gx0) / 3
        box(P, "INTERIOR", bx - 0.012, gy1 - 0.05, gz0, bx + 0.012, gy1 - 0.002, gz1)
    for k in range(3):
        for m in range(2):
            bx = gx0 + (k + (m + 1) / 3) * (gx1 - gx0) / 3
            box(P, "INTERIOR", bx - 0.007, gy1 - 0.035, gz0, bx + 0.007, gy1 - 0.002, gz1)
    for k in range(7):
        bz = gz0 + k * (gz1 - gz0) / 6
        box(P, "INTERIOR", gx0, gy1 - 0.04, bz - 0.008, gx1, gy1 - 0.002, bz + 0.008)
    tint(P, n0, dark)
    # counter (tana) with goods, barrel, crates, hanging paper lantern, wall shelves
    ibox(P, 0.45, 0.82, gz0, 1.3, 1.38, 1.1, (74, 48, 28))
    ibox(P, 0.42, 0.79, 1.1, 1.33, 1.41, 1.13, (96, 64, 38))
    ibox(P, 0.5, 0.9, 1.13, 0.85, 1.25, 1.4, (150, 112, 68))
    ibox(P, 0.55, 0.95, 1.4, 0.8, 1.2, 1.62, (168, 124, 76))
    icyl(P, (0.95, 1.1, 1.2), (1.25, 1.1, 1.2), 0.07, (34, 44, 82), 10)                      # bolt of indigo cloth
    icyl(P, (2.1, 1.35, gz0), (2.1, 1.35, gz0 + 0.72), 0.27, (112, 82, 50), 14)              # barrel
    icyl(P, (2.1, 1.35, gz0 + 0.24), (2.1, 1.35, gz0 + 0.26), 0.275, (40, 30, 24), 14)
    icyl(P, (2.1, 1.35, gz0 + 0.48), (2.1, 1.35, gz0 + 0.5), 0.275, (40, 30, 24), 14)
    ibox(P, 2.35, 0.95, gz0, 2.6, 1.25, gz0 + 0.3, (140, 105, 65))
    ibox(P, 2.38, 0.98, gz0 + 0.3, 2.62, 1.22, gz0 + 0.55, (128, 96, 58))
    icyl(P, (1.75, 1.0, 2.55), (1.75, 1.0, 2.2), 0.004, (30, 24, 20), 4)
    icyl(P, (1.75, 1.0, 2.2), (1.75, 1.0, 1.9), 0.11, (255, 196, 110), 12, emit=1.0)         # paper lantern
    for zz in (1.35, 1.85):
        ibox(P, gx0 + 0.02, 1.35, zz, gx0 + 0.22, 2.1, zz + 0.025, (84, 56, 34))
        ibox(P, gx0 + 0.05, 1.5, zz + 0.025, gx0 + 0.17, 1.65, zz + 0.16, (170, 150, 120))
        ibox(P, gx0 + 0.06, 1.85, zz + 0.025, gx0 + 0.16, 2.0, zz + 0.12, (120, 84, 60))
    # ---- upper rooms behind the sashes ----
    for k, x0 in enumerate(WIN_X):
        rx0, rx1 = x0 - 0.25, x0 + WIN_W + 0.25
        ry0, ry1, rz0, rz1 = WALL_T, 2.4, 3.25, 5.85
        ipatch(P, (rx0, ry0, rz0), (rx1 - rx0, 0, 0), (0, ry1 - ry0, 0), 8, 1, (104, 72, 44), vary=0.3)              # floor boards
        ipatch(P, (rx0, ry0, rz1), (0, ry1 - ry0, 0), (rx1 - rx0, 0, 0), 1, 1, (74, 62, 50))                          # ceiling
        ipatch(P, (rx0, ry0, rz0), (0, 0, rz1 - rz0), (0, ry1 - ry0, 0), 1, 1, (176, 160, 130), shade_fn=lambda s, t: 1 - 0.55 * t)
        ipatch(P, (rx1, ry0, rz0), (0, ry1 - ry0, 0), (0, 0, rz1 - rz0), 1, 1, (176, 160, 130), shade_fn=lambda s, t: 1 - 0.55 * s)
        ipatch(P, (rx0, ry1, rz0), (0, 0, rz1 - rz0), (rx1 - rx0, 0, 0), 1, 1, (150, 134, 106), shade_fn=lambda s, t: 0.75)   # back wall
        # dark doorway on the back wall
        ipatch(P, (x0 + (0.5 if k == 0 else 0.15), ry1 - 0.006, rz0), (0, 0, 1.75), (0.4, 0, 0), 1, 1, (18, 13, 10))
        n0 = len(P.bm.faces)
        if k == 0:
            # curtain rod + half-drawn cotton curtain with real folds, tansu chest behind
            icyl(P, (x0 - 0.02, 0.29, 5.32), (x0 + WIN_W + 0.02, 0.29, 5.32), 0.012, (30, 24, 20), 6)
            def fold(s, t):
                return (0, 0.02 * math.sin(s * 2 * math.pi * 4.5) * (0.4 + 0.6 * t) + 0.012 * s, 0)
            ipatch(P, (x0 + 0.02, 0.31, 5.3), (0.5, 0, 0), (0, 0, -1.25), 24, 6, (196, 188, 164), disp=fold, vary=0.06,
                   shade_fn=lambda s, t: 0.72 + 0.28 * math.cos(s * 2 * math.pi * 4.5 + 0.6), flip=True)
            ibox(P, x0 + 0.05, 1.7, rz0, x0 + 0.5, 2.3, rz0 + 0.82, (92, 58, 34))
            for dz in range(3):
                ibox(P, x0 + 0.06, 1.695, rz0 + 0.06 + dz * 0.25, x0 + 0.49, 1.7, rz0 + 0.06 + dz * 0.25 + 0.012, (36, 24, 16))
            ibox(P, x0 + 0.18, 1.9, rz0 + 0.82, x0 + 0.34, 2.06, rz0 + 0.98, (160, 150, 130))
        else:
            # lit paper lantern from the ceiling, low table, rolled bamboo blind at the head
            icyl(P, (x0 + 0.5, 0.9, rz1), (x0 + 0.5, 0.9, 5.4), 0.004, (30, 24, 20), 4)
            icyl(P, (x0 + 0.5, 0.9, 5.4), (x0 + 0.5, 0.9, 5.05), 0.12, (255, 200, 120), 12, emit=1.0)
            ibox(P, x0 + 0.1, 1.1, rz0 + 0.32, x0 + 0.65, 1.55, rz0 + 0.35, (100, 66, 38))
            for lx in (x0 + 0.12, x0 + 0.62):
                for ly in (1.12, 1.52):
                    ibox(P, lx - 0.015, ly - 0.015, rz0, lx + 0.015, ly + 0.015, rz0 + 0.32, (80, 52, 30))
            icyl(P, (x0 + 0.3, 1.3, rz0 + 0.35), (x0 + 0.3, 1.3, rz0 + 0.43), 0.035, (200, 190, 175), 8)
            icyl(P, (x0 + 0.02, 0.3, 5.3), (x0 + WIN_W - 0.02, 0.3, 5.3), 0.04, (150, 120, 70), 8)
            ipatch(P, (x0 + 0.02, 0.3, 5.26), (WIN_W - 0.04, 0, 0), (0, 0, -0.22), 24, 1, (170, 140, 86), vary=0.35, flip=True)
    return P


# ---- assemble one LOD ---------------------------------------------------------------------------------------------
def build_lod(lod, coll):
    empty = bpy.data.objects.new(f"FAC_A_LOD{lod}", None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.empty_display_size = 0.3
    coll.objects.link(empty)
    parts = [build_shell(lod), build_ground(lod), build_fascia(lod), build_awning(lod), build_sign(lod)]
    if lod == 0:
        parts.append(build_lanterns(lod))
    if lod < 2:
        parts.insert(1, build_windows(lod))
        parts.append(build_interior(lod))
    if lod == 0:
        parts += [build_services(), build_decals()]
    objs, tri = [], 0
    for P in parts:
        tri += P.tris()
        P.finish()
        o = P.to_object(coll)
        o.name = f"FAC_A_LOD{lod}_{P.name}"
        o.parent = empty
        objs.append(o)
    return empty, objs, tri


def lightmap_uv1(objs):
    for o in objs:
        me = o.data
        if "UV1" not in me.uv_layers:
            continue
        for x in bpy.context.view_layer.objects:
            x.select_set(False)
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        me.uv_layers.active_index = list(me.uv_layers.keys()).index("UV1")
        try:
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.select_all(action="SELECT")
            bpy.ops.uv.lightmap_pack(PREF_CONTEXT="ALL_FACES", PREF_PACK_IN_ONE=True, PREF_NEW_UVLAYER=False,
                                     PREF_BOX_DIV=12, PREF_MARGIN_DIV=0.08)
        except Exception as exc:
            print("lightmap pack failed for", o.name, exc)
        finally:
            if bpy.context.object and bpy.context.object.mode != "OBJECT":
                bpy.ops.object.mode_set(mode="OBJECT")
        me.uv_layers.active_index = 0


def count_tris(objs):
    total = 0
    for o in objs:
        me = o.data
        me.calc_loop_triangles()
        total += len(me.loop_triangles)
    return total


# ==== materials, review scene, export (second half of the script) ==================================================

# ---- node helpers --------------------------------------------------------------------------------------------------
def nt_of(mat):
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    return nt


def N(nt, typ, **kw):
    n = nt.nodes.new(typ)
    for k, v in kw.items():
        setattr(n, k, v)
    return n


def put(nt, sock_in, v):
    if isinstance(v, bpy.types.NodeSocket):
        nt.links.new(v, sock_in)
    else:
        sock_in.default_value = v


def mixc(nt, a, b, fac, blend="MIX"):
    m = N(nt, "ShaderNodeMixRGB", blend_type=blend)
    put(nt, m.inputs["Fac"], fac)
    put(nt, m.inputs["Color1"], a)
    put(nt, m.inputs["Color2"], b)
    return m.outputs["Color"]


def maths(nt, op, a, b=0.0, clamp_out=False):
    m = N(nt, "ShaderNodeMath", operation=op, use_clamp=clamp_out)
    put(nt, m.inputs[0], a)
    put(nt, m.inputs[1], b)
    return m.outputs["Value"]


def uvvec(nt, scale=(1, 1, 1)):
    uv = N(nt, "ShaderNodeUVMap", uv_map="UV0")
    mp = N(nt, "ShaderNodeMapping")
    mp.inputs["Scale"].default_value = scale
    nt.links.new(uv.outputs["UV"], mp.inputs["Vector"])
    return mp.outputs["Vector"]


def imgtex(nt, folder, fname, vec, noncolor=False):
    t = N(nt, "ShaderNodeTexImage", interpolation="Cubic")
    t.image = bpy.data.images.load(str(TEX / folder / fname), check_existing=True)
    if noncolor:
        t.image.colorspace_settings.name = "Non-Color"
    nt.links.new(vec, t.inputs["Vector"])
    return t


def world_noise(nt, scale, detail=5.0, rough=0.55):
    g = N(nt, "ShaderNodeNewGeometry")
    n = N(nt, "ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    nt.links.new(g.outputs["Position"], n.inputs["Vector"])
    return n.outputs["Fac"]


def wear_ch(nt):
    a = N(nt, "ShaderNodeAttribute", attribute_name="_WEAR", attribute_type="GEOMETRY")
    s = N(nt, "ShaderNodeSeparateColor")
    nt.links.new(a.outputs["Color"], s.inputs["Color"])
    return s.outputs["Red"], s.outputs["Green"], s.outputs["Blue"]


def princ(nt, base, rough, metallic=0.0, normal=None, spec=0.4, out=None):
    p = N(nt, "ShaderNodeBsdfPrincipled")
    put(nt, p.inputs["Base Color"], base)
    put(nt, p.inputs["Roughness"], rough)
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Specular IOR Level"].default_value = spec
    if normal is not None:
        nt.links.new(normal, p.inputs["Normal"])
    o = out or N(nt, "ShaderNodeOutputMaterial")
    nt.links.new(p.outputs["BSDF"], o.inputs["Surface"])
    return p


def dirt_fac(nt, r, noise, gain=1.15, spread=0.55):
    a = maths(nt, "MULTIPLY", r, gain)
    b = maths(nt, "MULTIPLY", maths(nt, "SUBTRACT", noise, 0.5), spread)
    return maths(nt, "ADD", a, b, clamp_out=True)


def make_render_materials():
    objinfo = lambda nt: N(nt, "ShaderNodeObjectInfo")
    # PLASTER: lime plaster, CC0 Plaster007 (ambientCG) tinted warm, dirt R, chips G
    nt = nt_of(MATS["PLASTER"])
    vec = uvvec(nt, (0.8, 0.8, 0.8))
    tc = imgtex(nt, "Plaster007", "Plaster007_2K-JPG_Color.jpg", vec)
    tr = imgtex(nt, "Plaster007", "Plaster007_2K-JPG_Roughness.jpg", vec, True)
    tn = imgtex(nt, "Plaster007", "Plaster007_2K-JPG_NormalGL.jpg", vec, True)
    nm = N(nt, "ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = 0.7
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    oi = objinfo(nt)
    tint = mixc(nt, (0.80, 0.77, 0.66, 1), oi.outputs["Color"], 1.0, "MULTIPLY")
    noise = world_noise(nt, 0.8, 6)
    base = mixc(nt, tc.outputs["Color"], tint, 1.0, "MULTIPLY")
    base = mixc(nt, base, (1.25, 1.2, 1.1, 1), maths(nt, "MULTIPLY", world_noise(nt, 0.45, 3), 1.0), "MULTIPLY")
    base = mixc(nt, base, (0.8, 0.78, 0.72, 1), maths(nt, "MULTIPLY", noise, 0.9), "MULTIPLY")
    r, g, b = wear_ch(nt)
    base = mixc(nt, base, (0.12, 0.09, 0.062, 1), dirt_fac(nt, r, noise))
    chip = maths(nt, "MULTIPLY", g, maths(nt, "GREATER_THAN", noise, 0.45), True)
    base = mixc(nt, base, (0.36, 0.22, 0.15, 1), maths(nt, "MULTIPLY", chip, 0.8))
    princ(nt, base, tr.outputs["Color"], normal=nm.outputs["Normal"], spec=0.25)

    # STONE: sandstone blocks (Poly Haven, CC0)
    nt = nt_of(MATS["STONE"])
    vec = uvvec(nt, (0.9, 0.9, 0.9))
    tc = imgtex(nt, ".", "large_sandstone_blocks_diff_2k.jpg", vec)
    tn = imgtex(nt, ".", "large_sandstone_blocks_nor_gl_2k.jpg", vec, True)
    nm = N(nt, "ShaderNodeNormalMap")
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    noise = world_noise(nt, 1.5, 5)
    r, g, b = wear_ch(nt)
    base = mixc(nt, tc.outputs["Color"], (0.62, 0.6, 0.56, 1), 1.0, "MULTIPLY")
    base = mixc(nt, base, (0.06, 0.05, 0.04, 1), dirt_fac(nt, r, noise, 1.1))
    princ(nt, base, 0.85, normal=nm.outputs["Normal"])

    # TIMBER: oiled/weathered wood, grain along U
    nt = nt_of(MATS["TIMBER"])
    vec = uvvec(nt, (5.0, 70.0, 1.0))
    n = N(nt, "ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = 1.0
    n.inputs["Detail"].default_value = 4.0
    nt.links.new(vec, n.inputs["Vector"])
    ramp = N(nt, "ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.03, 0.018, 0.010, 1)
    ramp.color_ramp.elements[1].color = (0.15, 0.085, 0.045, 1)
    nt.links.new(n.outputs["Fac"], ramp.inputs["Fac"])
    r, g, b = wear_ch(nt)
    noise = world_noise(nt, 3.0, 4)
    base = mixc(nt, ramp.outputs["Color"], (0.035, 0.03, 0.026, 1), dirt_fac(nt, r, noise, 0.9))
    base = mixc(nt, base, (0.30, 0.19, 0.10, 1), maths(nt, "MULTIPLY", g, 0.6))
    bump = N(nt, "ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
    bump.inputs["Distance"].default_value = 0.01
    nt.links.new(n.outputs["Fac"], bump.inputs["Height"])
    princ(nt, base, 0.62, normal=bump.outputs["Normal"])

    # FRAME: painted sash timber (pale lead paint), wear reveals timber
    nt = nt_of(MATS["FRAME"])
    r, g, b = wear_ch(nt)
    noise = world_noise(nt, 6.0, 4)
    paint = mixc(nt, (0.53, 0.52, 0.44, 1), (0.42, 0.42, 0.36, 1), noise)
    base = mixc(nt, paint, (0.05, 0.045, 0.04, 1), dirt_fac(nt, r, noise, 0.7))
    base = mixc(nt, base, (0.11, 0.075, 0.05, 1), maths(nt, "MULTIPLY", maths(nt, "ADD", g, maths(nt, "GREATER_THAN", noise, 0.7)), 0.4, True))
    princ(nt, base, 0.55)

    # GLASS: thin transparent + fresnel reflection, dirt haze at the edges, extra micro waviness
    nt = nt_of(MATS["GLASS"])
    MATS["GLASS"].use_backface_culling = False
    col = N(nt, "ShaderNodeVertexColor", layer_name="Col")
    r, g, b = wear_ch(nt)
    tr_ = N(nt, "ShaderNodeBsdfTransparent")
    nt.links.new(col.outputs["Color"], tr_.inputs["Color"])
    gl = N(nt, "ShaderNodeBsdfGlossy")
    gl.inputs["Roughness"].default_value = 0.02
    gl.inputs["Color"].default_value = (0.9, 0.98, 0.95, 1)
    noise = N(nt, "ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 14.0
    g_ = N(nt, "ShaderNodeNewGeometry")
    nt.links.new(g_.outputs["Position"], noise.inputs["Vector"])
    bump = N(nt, "ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.05
    bump.inputs["Distance"].default_value = 0.002
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], gl.inputs["Normal"])
    fr = N(nt, "ShaderNodeFresnel")
    fr.inputs["IOR"].default_value = 1.5
    nt.links.new(bump.outputs["Normal"], fr.inputs["Normal"])
    m1 = N(nt, "ShaderNodeMixShader")
    nt.links.new(maths(nt, "MULTIPLY", fr.outputs["Fac"], 1.0), m1.inputs["Fac"])
    nt.links.new(tr_.outputs["BSDF"], m1.inputs[1])
    nt.links.new(gl.outputs["BSDF"], m1.inputs[2])
    dif = N(nt, "ShaderNodeBsdfDiffuse")
    dif.inputs["Color"].default_value = (0.09, 0.085, 0.07, 1)
    m2 = N(nt, "ShaderNodeMixShader")
    nt.links.new(maths(nt, "MULTIPLY", dirt_fac(nt, r, noise.outputs["Fac"], 0.8, 0.4), 0.7, True), m2.inputs["Fac"])
    nt.links.new(m1.outputs["Shader"], m2.inputs[1])
    nt.links.new(dif.outputs["BSDF"], m2.inputs[2])
    o = N(nt, "ShaderNodeOutputMaterial")
    nt.links.new(m2.outputs["Shader"], o.inputs["Surface"])

    # CANVAS: striped cotton from vertex colour, hue varied per object, dirt R, some translucency
    nt = nt_of(MATS["CANVAS"])
    MATS["CANVAS"].use_backface_culling = False
    col = N(nt, "ShaderNodeVertexColor", layer_name="Col")
    oi = objinfo(nt)
    hs = N(nt, "ShaderNodeHueSaturation")
    put(nt, hs.inputs["Hue"], maths(nt, "ADD", 0.5, maths(nt, "MULTIPLY", maths(nt, "SUBTRACT", oi.outputs["Random"], 0.5), 0.6)))
    nt.links.new(col.outputs["Color"], hs.inputs["Color"])
    r, g, b = wear_ch(nt)
    noise = world_noise(nt, 6.0, 5)
    base = mixc(nt, hs.outputs["Color"], (0.07, 0.055, 0.04, 1), dirt_fac(nt, r, noise, 0.85, 0.5))
    weave = N(nt, "ShaderNodeTexNoise")
    weave.inputs["Scale"].default_value = 500.0
    nt.links.new(uvvec(nt), weave.inputs["Vector"])
    bump = N(nt, "ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.3
    bump.inputs["Distance"].default_value = 0.002
    nt.links.new(weave.outputs["Fac"], bump.inputs["Height"])
    d = N(nt, "ShaderNodeBsdfDiffuse")
    put(nt, d.inputs["Color"], base)
    nt.links.new(bump.outputs["Normal"], d.inputs["Normal"])
    tl = N(nt, "ShaderNodeBsdfTranslucent")
    put(nt, tl.inputs["Color"], base)
    mm = N(nt, "ShaderNodeMixShader")
    mm.inputs["Fac"].default_value = 0.3
    nt.links.new(d.outputs["BSDF"], mm.inputs[1])
    nt.links.new(tl.outputs["BSDF"], mm.inputs[2])
    o = N(nt, "ShaderNodeOutputMaterial")
    nt.links.new(mm.outputs["Shader"], o.inputs["Surface"])

    # SIGN: aged board
    nt = nt_of(MATS["SIGN"])
    r, g, b = wear_ch(nt)
    noise = world_noise(nt, 5.0, 5)
    base = mixc(nt, (0.55, 0.47, 0.32, 1), (0.36, 0.30, 0.20, 1), noise)
    base = mixc(nt, base, (0.06, 0.05, 0.04, 1), dirt_fac(nt, r, noise, 0.8))
    princ(nt, base, 0.75)

    # IRON: dark oiled iron, CC0 Metal041B roughness/normal
    nt = nt_of(MATS["IRON"])
    vec = uvvec(nt, (1.5, 1.5, 1.5))
    tc = imgtex(nt, "Metal041B", "Metal041B_2K-JPG_Color.jpg", vec)
    tr = imgtex(nt, "Metal041B", "Metal041B_2K-JPG_Roughness.jpg", vec, True)
    tn = imgtex(nt, "Metal041B", "Metal041B_2K-JPG_NormalGL.jpg", vec, True)
    nm = N(nt, "ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = 0.5
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    r, g, b = wear_ch(nt)
    noise = world_noise(nt, 4.0, 5)
    base = mixc(nt, tc.outputs["Color"], (0.10, 0.10, 0.11, 1), 1.0, "MULTIPLY")
    base = mixc(nt, base, (0.22, 0.09, 0.045, 1), maths(nt, "MULTIPLY", maths(nt, "ADD", r, g), 0.5, True))
    princ(nt, base, tr.outputs["Color"], metallic=0.75, normal=nm.outputs["Normal"])

    # INTERIOR: baked albedo in Col, emissive mask in _WEAR.B (lit paper, lanterns)
    nt = nt_of(MATS["INTERIOR"])
    col = N(nt, "ShaderNodeVertexColor", layer_name="Col")
    r, g, b = wear_ch(nt)
    p = princ(nt, col.outputs["Color"], 0.85, spec=0.2)
    p.inputs["Emission Color"].default_value = (1.0, 0.68, 0.36, 1)
    nt.links.new(maths(nt, "MULTIPLY", b, 1.5), p.inputs["Emission Strength"])
    # emission colour follows the albedo so lanterns stay warm
    nt.links.new(col.outputs["Color"], p.inputs["Emission Color"])

    # POSTER: fictional printed paper (bands = unreadable text), torn edges are geometry
    nt = nt_of(MATS["POSTER"])
    vec = uvvec(nt, (60.0, 8.0, 1.0))
    w = N(nt, "ShaderNodeTexWave", wave_type="BANDS", bands_direction="X")
    w.inputs["Scale"].default_value = 1.0
    w.inputs["Distortion"].default_value = 2.0
    nt.links.new(vec, w.inputs["Vector"])
    ramp = N(nt, "ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.45
    ramp.color_ramp.elements[1].position = 0.55
    ramp.color_ramp.elements[0].color = (0.05, 0.04, 0.035, 1)
    ramp.color_ramp.elements[1].color = (0.62, 0.56, 0.42, 1)
    nt.links.new(w.outputs["Color"], ramp.inputs["Fac"])
    r, g, b = wear_ch(nt)
    noise = world_noise(nt, 9.0, 4)
    base = mixc(nt, ramp.outputs["Color"], (0.12, 0.09, 0.06, 1), dirt_fac(nt, r, noise, 1.0))
    princ(nt, base, 0.9)
    MATS["POSTER"].use_backface_culling = False

    # STAIN: alpha-blended dark decal (alpha from Col.A)
    nt = nt_of(MATS["STAIN"])
    MATS["STAIN"].use_backface_culling = False
    col = N(nt, "ShaderNodeVertexColor", layer_name="Col")
    tr_ = N(nt, "ShaderNodeBsdfTransparent")
    d = N(nt, "ShaderNodeBsdfDiffuse")
    nt.links.new(col.outputs["Color"], d.inputs["Color"])
    mm = N(nt, "ShaderNodeMixShader")
    nt.links.new(col.outputs["Alpha"], mm.inputs["Fac"])
    nt.links.new(tr_.outputs["BSDF"], mm.inputs[1])
    nt.links.new(d.outputs["BSDF"], mm.inputs[2])
    o = N(nt, "ShaderNodeOutputMaterial")
    nt.links.new(mm.outputs["Shader"], o.inputs["Surface"])

    # INK: faded vermilion mark paint
    nt = nt_of(MATS["INK"])
    r, g, b = wear_ch(nt)
    princ(nt, mixc(nt, (0.34, 0.055, 0.04, 1), (0.05, 0.03, 0.025, 1), maths(nt, "MULTIPLY", r, 0.6, True)), 0.8)


PLAIN = {
    "PLASTER": ((0.80, 0.73, 0.60, 1), 0.9, 0.0), "TIMBER": ((0.09, 0.055, 0.03, 1), 0.7, 0.0),
    "GLASS": ((0.85, 0.95, 0.92, 1), 0.05, 0.0), "FRAME": ((0.55, 0.53, 0.45, 1), 0.6, 0.0),
    "CANVAS": ((1, 1, 1, 1), 0.95, 0.0), "SIGN": ((0.5, 0.42, 0.29, 1), 0.75, 0.0),
    "IRON": ((0.04, 0.04, 0.045, 1), 0.45, 0.8), "INTERIOR": ((1, 1, 1, 1), 0.9, 0.0),
    "STONE": ((0.55, 0.51, 0.45, 1), 0.85, 0.0), "POSTER": ((0.66, 0.6, 0.45, 1), 0.9, 0.0),
    "STAIN": ((1, 1, 1, 1), 1.0, 0.0), "INK": ((0.32, 0.055, 0.04, 1), 0.8, 0.0),
}


def make_plain_materials():
    """Constant-colour glTF-safe materials (no image textures, so nothing is copied into the repo)."""
    for name, (rgba, rough, metal) in PLAIN.items():
        m = MATS[name]
        nt = nt_of(m)
        p = N(nt, "ShaderNodeBsdfPrincipled")
        p.inputs["Base Color"].default_value = rgba
        p.inputs["Roughness"].default_value = rough
        p.inputs["Metallic"].default_value = metal
        o = N(nt, "ShaderNodeOutputMaterial")
        nt.links.new(p.outputs["BSDF"], o.inputs["Surface"])
        m.use_backface_culling = name not in ("GLASS", "CANVAS", "STAIN", "POSTER")
        if name in ("GLASS", "STAIN"):
            p.inputs["Alpha"].default_value = 0.18 if name == "GLASS" else 1.0
            if name == "STAIN":
                vc = N(nt, "ShaderNodeVertexColor", layer_name="Col")
                nt.links.new(vc.outputs["Alpha"], p.inputs["Alpha"])
            for attr, val in (("blend_method", "BLEND"), ("surface_render_method", "BLENDED")):
                try:
                    setattr(m, attr, val)
                except Exception:
                    pass
            try:
                m.shadow_method = "NONE"
            except Exception:
                pass


# ---- review scene --------------------------------------------------------------------------------------------------
def set_render(scene, w, h, samples):
    scene.render.engine = "CYCLES"
    scene.render.resolution_x = int(w * SCALE)
    scene.render.resolution_y = int(h * SCALE)
    scene.render.image_settings.file_format = "PNG"
    cy = scene.cycles
    cy.samples = samples
    cy.use_denoising = True
    try:
        cy.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    cy.max_bounces = 8
    cy.transparent_max_bounces = 12
    cy.glossy_bounces = 4
    cy.sample_clamp_indirect = 6.0
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "CUDA"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = d.type == "CUDA"
        cy.device = "GPU"
    except Exception as exc:
        print("GPU unavailable, CPU:", exc)
    scene.view_settings.view_transform = "AgX"
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass


def add_light(coll, kind, name, loc, energy, color, size=0.1, rot=None):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = color
    if kind == "POINT":
        ld.shadow_soft_size = size
    if kind == "AREA":
        ld.size = size
    if kind == "SUN":
        ld.angle = math.radians(1.6)
    o = bpy.data.objects.new(name, ld)
    o.location = loc
    if rot:
        o.rotation_euler = rot
    coll.objects.link(o)
    return o


def world_dusk(scene, elev=4.0, exposure=0.0):
    w = bpy.data.worlds.new("dusk")
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    sky = N(nt, "ShaderNodeTexSky", sky_type="NISHITA")
    sky.sun_elevation = math.radians(elev)
    sky.sun_rotation = math.radians(200)
    sky.sun_disc = False
    sky.air_density = 1.3
    sky.dust_density = 1.6
    bg = N(nt, "ShaderNodeBackground")
    bg.inputs["Strength"].default_value = 1.0
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    o = N(nt, "ShaderNodeOutputWorld")
    nt.links.new(bg.outputs["Background"], o.inputs["Surface"])


def road_material():
    m = bpy.data.materials.new("ROAD")
    nt = nt_of(m)
    n1 = world_noise(nt, 2.0, 6)
    n2 = world_noise(nt, 40.0, 4)
    base = mixc(nt, (0.10, 0.085, 0.065, 1), (0.24, 0.20, 0.15, 1), n1)
    base = mixc(nt, base, (0.2, 0.17, 0.13, 1), maths(nt, "MULTIPLY", n2, 0.5))
    bump = N(nt, "ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.8
    bump.inputs["Distance"].default_value = 0.03
    nt.links.new(n2, bump.inputs["Height"])
    princ(nt, base, 0.95, normal=bump.outputs["Normal"], spec=0.1)
    return m


def look_at(o, target, roll=0.0):
    d = Vector(target) - o.location
    q = d.to_track_quat("-Z", "Y")
    o.rotation_euler = q.to_euler()


def add_camera(coll, loc, target, lens, shift_y=0.0, name="cam"):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.sensor_width = 36
    cd.shift_y = shift_y
    o = bpy.data.objects.new(name, cd)
    o.location = loc
    coll.objects.link(o)
    look_at(o, target)
    bpy.context.scene.camera = o
    return o


def clone_module(coll, objs, dx, mirror, color):
    e = bpy.data.objects.new("nb", None)
    e.location = (dx + (W if mirror else 0.0), 0, 0)
    if mirror:
        e.scale = (-1, 1, 1)
    coll.objects.link(e)
    for o in objs:
        c = o.copy()
        c.color = color
        c.parent = e
        coll.objects.link(c)
    return e


def review_props(coll):
    P = Part("review_props")
    box(P, "TIMBER", 2.0, -1.5, 0.0, 2.55, -0.95, 0.42)
    box(P, "TIMBER", 2.08, -1.42, 0.42, 2.5, -1.02, 0.8)
    box(P, "TIMBER", 0.5, -1.25, 0.0, 1.0, -0.8, 0.36)
    cyl(P, "TIMBER", (1.55, -1.3, 0.0), (1.55, -1.3, 0.75), 0.27, 14)
    cyl(P, "IRON", (1.55, -1.3, 0.2), (1.55, -1.3, 0.23), 0.275, 14)
    cyl(P, "IRON", (1.55, -1.3, 0.5), (1.55, -1.3, 0.53), 0.275, 14)
    P.finish()
    o = P.to_object(coll)
    return o


def label(coll, text, loc, size=0.34):
    cu = bpy.data.curves.new("lbl", "FONT")
    cu.body = text
    cu.size = size
    cu.align_x = "CENTER"
    o = bpy.data.objects.new("lbl", cu)
    o.location = loc
    o.rotation_euler = (math.pi / 2, 0, 0)
    m = bpy.data.materials.new("lblmat")
    nt = nt_of(m)
    e = N(nt, "ShaderNodeEmission")
    e.inputs["Color"].default_value = (0.03, 0.02, 0.012, 1)
    e.inputs["Strength"].default_value = 1.0
    out = N(nt, "ShaderNodeOutputMaterial")
    nt.links.new(e.outputs["Emission"], out.inputs["Surface"])
    cu.materials.append(m)
    coll.objects.link(o)
    return o


def room_lights(coll, offset=0.0, scale=1.0):
    add_light(coll, "POINT", "lamp_shop", (1.5 + offset, 1.1, 2.15), 90 * scale, (1.0, 0.62, 0.32), 0.12)
    add_light(coll, "POINT", "lamp_r1", (0.95 + offset, 1.1, 4.9), 55 * scale, (1.0, 0.68, 0.38), 0.1)
    add_light(coll, "POINT", "lamp_r2", (2.15 + offset, 0.9, 5.15), 55 * scale, (1.0, 0.66, 0.36), 0.1)


def scene_lighting(coll, sun_dir=(0.85, -0.5, 0.2), sun_e=3.0):
    s = Vector(sun_dir).normalized()
    o = add_light(coll, "SUN", "sun_key", (0, 0, 10), sun_e, (1.0, 0.72, 0.48))
    o.rotation_euler = (-s).to_track_quat("-Z", "Y").to_euler()
    add_light(coll, "AREA", "sky_fill", (-4.5, -5.5, 6.0), 120, (0.55, 0.7, 1.0), 6.0, rot=(math.radians(60), 0, math.radians(-40)))


def render_to(scene, name):
    scene.render.filepath = str(OUT / name)
    bpy.ops.render.render(write_still=True)
    print("rendered", name)


# ---- main ----------------------------------------------------------------------------------------------------------
def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    coll = bpy.data.collections.new("FAC_A_01")
    scene.collection.children.link(coll)
    rev = bpy.data.collections.new("REVIEW_ONLY")
    scene.collection.children.link(rev)

    lods, tri = {}, {}
    for lod in (0, 1, 2):
        e, objs, t = build_lod(lod, coll)
        lightmap_uv1(objs)
        tri[lod] = count_tris(objs)
        lods[lod] = (e, objs)
        e["lod"] = lod
        e["range_m"] = ["0-15", "15-40", "40+"][lod]
        e["bay_m"] = "3.0 x 7.0 (+0.95 awning); all dimensions are assumptions, see README"
        e["uv0"] = "world-scaled metres (1 UV = 1 m)"
        e["uv1"] = "lightmap pack, no overlap per part"
        e["vertex_data"] = "COLOR_0=true colour/alpha; _WEAR=R dirt,G edge wear,B interior emissive"
    for lod in (0, 1, 2):
        print(f"LOD{lod}: {tri[lod]} tris; parts: " + ", ".join(f"{o.name.split('_')[-1]}={len(o.data.loop_triangles)}" for o in lods[lod][1]))

    if DO_RENDER:
        make_render_materials()
        scene.frame_current = 1
        set_render(scene, 1280, 720, SAMPLES)
        world_dusk(scene)
        scene_lighting(rev)
        room_lights(rev)
        ground = bpy.data.objects.new("road", bpy.data.meshes.new("road"))
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=2, y_segments=2, size=1500)
        bm.to_mesh(ground.data)
        bm.free()
        ground.data.materials.append(road_material())
        ground.location = (1.5, -60, -0.002)
        rev.objects.link(ground)
        for lod in (1, 2):
            for o in [lods[lod][0]] + lods[lod][1]:
                o.hide_render = True
        if ONLY in ("", "street"):
            nb1 = clone_module(rev, lods[0][1], -3.0, False, (0.78, 0.86, 0.92, 1))
            nb2 = clone_module(rev, lods[0][1], 3.0, True, (1.0, 0.86, 0.66, 1))
            review_props(rev)
            cam = add_camera(rev, (5.0, -7.4, 1.5), (1.3, 0, 3.4), 24)
            set_render(scene, 1280, 720, SAMPLES)
            render_to(scene, "review-street.png")
            nb1.hide_render = True
            for o in bpy.data.objects:
                if o.parent in (nb1, nb2):
                    o.hide_render = True
        if ONLY in ("", "closeup"):
            for o in list(bpy.data.objects):
                if o.name.startswith("nb") or o.parent and o.parent.name.startswith("nb"):
                    o.hide_render = True
            cam = add_camera(rev, (2.05, -1.5, 4.3), (0.85, 0.15, 4.6), 30, name="cam_close")
            render_to(scene, "review-window-closeup.png")
        if ONLY in ("", "lod"):
            for lod in (0, 1, 2):
                for o in [lods[lod][0]] + lods[lod][1]:
                    o.hide_render = False
            lods[1][0].location.x = 4.0
            lods[2][0].location.x = 8.0
            for o in bpy.data.objects:
                if o.name.startswith("lamp_"):
                    o.hide_render = False
            room_lights(rev, 4.0, 0.4)
            room_lights(rev, 8.0, 0.4)
            for lod in (0, 1, 2):
                label(rev, f"LOD{lod}  {tri[lod]:,} tris", (lods[lod][0].location.x + 1.5, -1.3, 7.3))
            cam = add_camera(rev, (5.5, -19.0, 3.6), (5.5, 0, 3.7), 40, name="cam_lod")
            for o in bpy.data.objects:
                if o.name.startswith("nb") or (o.parent and o.parent.name.startswith("nb")) or o.name.startswith("review_props"):
                    o.hide_render = True
            render_to(scene, "review-lod.png")
            lods[1][0].location.x = 0.0
            lods[2][0].location.x = 0.0
    # ---- export ----
    if DO_EXPORT:
        make_plain_materials()
        for o in list(bpy.data.objects):
            o.hide_render = False
            o.hide_viewport = False
            o.select_set(False)
        for lod in (0, 1, 2):
            lods[lod][0].select_set(True)
            for o in lods[lod][1]:
                o.select_set(True)
        bpy.context.view_layer.objects.active = lods[0][0]
        kw = dict(filepath=str(OUT / "facade-a-1912.glb"), export_format="GLB", use_selection=True, export_extras=True,
                  export_yup=True, export_cameras=False, export_lights=False, export_vertex_color="ACTIVE",
                  export_attributes=True, export_all_vertex_colors=False, export_texcoords=True, export_normals=True, export_apply=False)
        try:
            bpy.ops.export_scene.gltf(**kw)
        except TypeError as exc:
            print("export kw fallback:", exc)
            for k in ("export_vertex_color", "export_attributes"):
                kw.pop(k, None)
            bpy.ops.export_scene.gltf(**kw)
        summarize_glb(OUT / "facade-a-1912.glb")


def summarize_glb(path):
    data = path.read_bytes()
    ln = struct.unpack_from("<I", data, 12)[0]
    j = json.loads(data[20:20 + ln].decode("utf-8"))
    print("GLB", path.name, len(data), "bytes; nodes:", [n["name"] for n in j["nodes"]][:40])
    tris = {}
    for n in j["nodes"]:
        if "mesh" in n:
            m = j["meshes"][n["mesh"]]
            t = sum(j["accessors"][p["indices"]]["count"] // 3 for p in m["primitives"])
            grp = n["name"].split("_")[0] + "_" + n["name"].split("_")[1] + "_" + n["name"].split("_")[2]
            tris[grp] = tris.get(grp, 0) + t
    print("GLB tris per LOD node:", tris)
    prim = j["meshes"][0]["primitives"][0]
    print("attributes of first primitive:", list(prim["attributes"].keys()))
    print("materials:", [(m["name"], m.get("alphaMode", "OPAQUE"), m.get("doubleSided", False)) for m in j["materials"]])
    print("images in GLB:", len(j.get("images", [])))
    # basic integrity checks (gltf-validator is not on PATH)
    nb = j["buffers"][0]["byteLength"]
    for bv in j["bufferViews"]:
        assert bv["byteOffset"] + bv["byteLength"] <= nb, "bufferView out of range"
    for a in j["accessors"]:
        assert "bufferView" in a and a["count"] > 0
    print("basic GLB integrity checks passed (no gltf-validator on PATH)")


main()
