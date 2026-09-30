"""Building A - two-storey shop-house on Ebisu-dori, 1912 (Blender 4.5, headless, fully scripted).

    blender -b -P assets-src/shinsekai/eval-building-a/sonnet/build-building-a.py -- [--no-render] [--no-export]
        [--only street|closeup|ground|upper|cutaway|lod] [--samples 96] [--scale 1.0]

Outputs (next to this script): building-a.glb + 1280x720 renders street / window-closeup / interior-ground /
interior-upper / cutaway / lod (.png).

World axes (Blender): X along the street frontage (0..6 m), Y depth (front face y=0, street at -Y, back wall y=9),
Z up. glTF export converts to Y-up (the front then faces +Z).
Source: OML CC0 158514 (Ebisu-dori 1912; two storeys, plastered upper storey, small parapet, deep awning, long fascia
board, disc sign, open shopfront), 157003/157013 (window/shopfront types), 157871 (lanterns). Every dimension is an
ASSUMPTION unless README says otherwise. All marks are fictional; no text, no brands, no people.
Per-vertex data: COLOR_0 "Col" = true colour / paint tint; custom attribute _WEAR = (R dirt, G edge wear, B emissive, A 1).
UV0 = world-scaled metres, UV1 = lightmap pack (unbaked).
"""

import json
import math
import random
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
TEX = OUT.parents[4] / "research-cache" / "materials-93"   # local CC0 textures, referenced by path, never copied
DO_RENDER = not flag("--no-render")
DO_EXPORT = not flag("--no-export")
ONLY = arg("--only", "", str)
SAMPLES = arg("--samples", 96, int)
SCALE = arg("--scale", 1.0)
GLB_NAME = "building-a.glb"
RNG = random.Random(1912)

# ---- dimensions (metres) - ALL ASSUMPTIONS, see README -----------------------------------------------------------------
W, D, T = 6.0, 9.0, 0.25           # frontage, depth, wall thickness
Z_PL = 0.5                          # plinth top = doma floor level
Z_HEAD_G = 2.75                     # shopfront opening head
Z_STRING, Z_SILL, Z_HEAD_U = 3.2, 3.9, 5.4
Z_CEIL_G, Z_FLOOR_U, Z_CEIL_U = 3.3, 3.6, 6.0   # underside of upper floor, top of upper floor, upper ceiling
Z_TOP = 6.0                         # plate height of the plastered walls
Z_RAISED = 0.95                     # raised tatami floor (agari) level
Y_KAMACHI, Y_KITCHEN = 4.6, 7.5     # step line shop->raised floor, raised floor -> rear kitchen doma
ROOF_PITCH, EAVE_OUT, Z_EAVE = 0.5, 0.6, 6.05
GROUND_OPEN = [(0.30, 2.85), (3.15, 5.70)]
WINDOWS = [  # x0, width, lights across, lights high per sash, lower sash raised, paint (sRGB), dressing
    dict(x0=0.35, w=1.00, cols=3, rows=3, raised=0.00, paint=(158, 152, 128), deco="curtain"),
    dict(x0=1.65, w=1.00, cols=3, rows=3, raised=0.26, paint=(112, 122, 104), deco="blind"),
    dict(x0=3.25, w=0.85, cols=3, rows=4, raised=0.00, paint=(92, 84, 72), deco="curtain2"),
    dict(x0=4.60, w=0.90, cols=2, rows=4, raised=0.50, paint=(122, 100, 74), deco="open"),
]

MAT_NAMES = ["PLASTER", "TIMBER", "GLASS", "FRAME", "CANVAS", "SIGN", "IRON", "INTERIOR", "STONE", "POSTER", "STAIN", "INK",
             "ROOF", "TATAMI", "SHOJI", "EARTH", "WALLIN", "WOOD", "FLOOR", "CLOTH"]
MATS = {n: bpy.data.materials.new(n) for n in MAT_NAMES}


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
        self.flags = self.bm.faces.layers.int.new("flags")   # 1 = colours custom, 2 = uv custom, 4 = paint tint
        self.tintl = self.bm.faces.layers.float_vector.new("tint")
        self.emitl = self.bm.faces.layers.float.new("emit")
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

    def paint(self, n0, rgb, emit=0.0):
        """Tint every face created since face index n0 (sRGB 0-255). INTERIOR: baked albedo + emissive mask."""
        self.bm.faces.ensure_lookup_table()
        c = srgb(*rgb)
        for f in list(self.bm.faces)[n0:]:
            if self.slots[f.material_index] == "INTERIOR":
                f[self.flags] |= 1
                for lp in f.loops:
                    lp[self.col] = (c[0], c[1], c[2], 1.0)
                    lp[self.wear] = (0, 0, emit, 1)
            else:
                f[self.flags] |= 4
                f[self.tintl] = (c[0], c[1], c[2])
                f[self.emitl] = emit

    def nf(self):
        return len(self.bm.faces)

    def nv(self):
        return len(self.bm.verts)

    def xform(self, n0, M):
        self.bm.verts.ensure_lookup_table()
        for v in list(self.bm.verts)[n0:]:
            v.co = M @ v.co

    def finish(self):
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
                    r = self.dirt(co, n) if mat not in ("INTERIOR", "GLASS", "STAIN", "POSTER", "SHOJI") else 0.0
                    if mat == "POSTER":
                        r = 0.25 + 0.4 * self.dirt(co, n)
                    if fl & 4:
                        tc = f[self.tintl]
                        lp[self.col] = (tc[0], tc[1], tc[2], 1.0)
                    else:
                        lp[self.col] = srgb(*DEFAULT_COL[mat]) if mat in DEFAULT_COL else (1, 1, 1, 1)
                    lp[self.wear] = (r, wear_v[lp.vert] if mat not in ("GLASS", "STAIN", "CANVAS", "SHOJI") else 0.0,
                                     f[self.emitl] if fl & 4 else 0.0, 1.0)
                if not fl & 2:
                    ax = max(range(3), key=lambda i: abs(n[i]))
                    uv = (co.y, co.z) if ax == 0 else ((co.x, co.z) if ax == 1 else (co.x, co.y))
                    if mat in ("TIMBER", "FRAME", "SIGN", "IRON", "WOOD"):
                        ext = [0.0, 0.0]
                        for l2 in f.loops:
                            c2 = l2.vert.co
                            p2 = (c2.y, c2.z) if ax == 0 else ((c2.x, c2.z) if ax == 1 else (c2.x, c2.y))
                            ext[0] = max(ext[0], abs(p2[0] - uv[0]))
                            ext[1] = max(ext[1], abs(p2[1] - uv[1]))
                        if ext[1] > ext[0]:
                            uv = (uv[1], uv[0])
                        cm = f.calc_center_median()
                        h = hash01(cm.x * 3, cm.z * 3, cm.y * 3)
                        uv = (uv[0] + h * 5.0, uv[1] + h * 3.0)
                    lp[self.uv0].uv = uv

    def dirt(self, co, n):
        z = co.z
        g = max(0.0, 1.0 - (z - Z_PL) / 0.9) ** 1.7
        if z < Z_PL:
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


def wall_slab(P, xs, zs, holes, yf, yb, bevel=0.0, hole_back=None, back_faces=True, mat="PLASTER", back_mat="WALLIN",
              outer_sides=True):
    """Grid wall with rectangular openings (cells in `holes`), reveals in `mat`, inner skin in `back_mat`."""
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
                P.face([v(i, j, yb), v(i, j + 1, yb), v(i + 1, j + 1, yb), v(i + 1, j, yb)], back_mat)
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


def grid_from_openings(x0, x1, z0, z1, rects, extra_x=(), extra_z=()):
    """Break lines + hole cells for a wall from a list of opening rects (xa, xb, za, zb)."""
    xs = sorted({round(v, 4) for v in [x0, x1] + [r[0] for r in rects] + [r[1] for r in rects] + list(extra_x)})
    zs = sorted({round(v, 4) for v in [z0, z1] + [r[2] for r in rects] + [r[3] for r in rects] + list(extra_z)})
    holes = set()
    for i in range(len(xs) - 1):
        for j in range(len(zs) - 1):
            cx, cz = (xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2
            if any(r[0] < cx < r[1] and r[2] < cz < r[3] for r in rects):
                holes.add((i, j))
    return xs, zs, holes


def lathe(P, mat, prof, c, seg=12, rgb=None, emit=0.0, smooth=True):
    """Solid of revolution about the vertical axis at c; prof = [(radius, dz)] bottom to top."""
    c = Vector(c)
    n0 = P.nf()
    rings = []
    for r, dz in prof:
        if r <= 1e-6:
            rings.append([P.bm.verts.new(c + Vector((0, 0, dz)))])
        else:
            rings.append([P.bm.verts.new(c + Vector((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), dz)))
                          for i in range(seg)])
    for a, b in zip(rings[:-1], rings[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            if len(a) == 1:
                P.face([a[0], b[j], b[i]], mat, smooth)
            elif len(b) == 1:
                P.face([a[i], a[j], b[0]], mat, smooth)
            else:
                P.face([a[i], a[j], b[j], b[i]], mat, smooth)
    if len(rings[0]) > 1:
        P.face(rings[0][::-1], mat)
    if len(rings[-1]) > 1:
        P.face(rings[-1], mat)
    if rgb is not None:
        P.paint(n0, rgb, emit)


def mbox(P, mat, x0, y0, z0, x1, y1, z1, rgb=None, emit=0.0):
    n0 = P.nf()
    box(P, mat, x0, y0, z0, x1, y1, z1)
    if rgb is not None:
        P.paint(n0, rgb, emit)


def mcyl(P, mat, p0, p1, r, seg=10, rgb=None, emit=0.0, r1=None, caps=(True, True)):
    n0 = P.nf()
    cyl(P, mat, p0, p1, r, seg, r1=r1, caps=caps)
    if rgb is not None:
        P.paint(n0, rgb, emit)


def mbeam(P, mat, p0, p1, w, t, rgb=None, up=(1, 0, 0)):
    n0 = P.nf()
    beam(P, mat, p0, p1, w, t, up=up)
    if rgb is not None:
        P.paint(n0, rgb)


def mpatch(P, mat, org, U, V, nu, nv, rgb, vary=0.0, disp=None, flip=False, shade=None, emit=0.0, smooth=True):
    """Patch with per-vertex colour = rgb (sRGB 0-255) * variation; wear.B = emit."""
    c0 = srgb(*rgb)

    def col(s, t):
        k = 1.0 - vary * hash01(s * 13.1, t * 7.7, org[0] + org[1] + org[2])
        if shade:
            k *= shade(s, t)
        return (c0[0] * k, c0[1] * k, c0[2] * k, 1.0)
    return patch(P, mat, org, U, V, nu, nv, disp=disp, col=col, wear=lambda s, t: (0.0, 0.0, emit, 1), smooth=smooth, flip=flip)


def side_xform(side):
    """Local wall frame (x along the wall, y = 0 outer face .. +T inner, z up) -> world."""
    if side == "front":
        return Matrix.Identity(4)
    if side == "back":
        return Matrix.Translation((W, D, 0)) @ Matrix.Rotation(math.pi, 4, "Z")
    if side == "right":       # local x = world y - T
        return Matrix.Translation((W, T, 0)) @ Matrix.Rotation(math.pi / 2, 4, "Z")
    return Matrix.Translation((0, D - T, 0)) @ Matrix.Rotation(-math.pi / 2, 4, "Z")   # left: local x = D - T - y




# ==== EXTERIOR ======================================================================================================
def front_rects():
    return ([(a, b, Z_PL, Z_HEAD_G) for a, b in GROUND_OPEN] +
            [(w["x0"], w["x0"] + w["w"], Z_SILL, Z_HEAD_U) for w in WINDOWS])


def build_wall_front(lod):
    P = Part("wall_front")
    xs, zs, holes = grid_from_openings(0, W, Z_PL, Z_TOP, front_rects())
    if lod == 2:
        wall_slab(P, xs, zs, holes, 0.0, T, hole_back=0.09, back_faces=False)
    elif lod == 1:
        wall_slab(P, xs, zs, holes, 0.0, T, hole_back=0.34, back_faces=False)
    else:
        wall_slab(P, xs, zs, holes, 0.0, T, bevel=0.012)
    # stone plinth with sloped top (slightly proud); the side plinths are built with the side walls
    if lod == 2:
        box(P, "STONE", 0, -0.04, 0, W, T, Z_PL)
    else:
        extrude_x(P, "STONE", [(T, 0.0), (-0.04, 0.0), (-0.04, 0.455), (-0.015, 0.5), (T, 0.5)], 0, W)
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
        # irregular dentils under the cornice: two missing, one chipped, heights and widths not uniform
        for k in range(16):
            if k in (5, 11):
                continue
            cx = (k + 0.5) * W / 16 + (hash01(k, 1) - 0.5) * 0.03
            hw = 0.038 + 0.014 * hash01(k, 2)
            top = 5.95
            bot = 5.76 + 0.03 * hash01(k, 3) + (0.08 if k == 3 else 0.0)
            box(P, "PLASTER", cx - hw, -0.085, bot, cx + hw, 0.0, top)
        # stone steps in front of the two shopfronts (different depths)
        box(P, "STONE", 0.3, -0.42, 0.0, 2.85, -0.04, 0.24)
        box(P, "STONE", 0.3, -0.04, 0.0, 2.85, 0.0, 0.5)
        box(P, "STONE", 3.15, -0.30, 0.0, 5.7, -0.04, 0.26)
        box(P, "STONE", 3.15, -0.62, 0.0, 5.7, -0.30, 0.11)
        box(P, "STONE", 3.15, -0.04, 0.0, 5.7, 0.0, 0.5)
    # window sills (stone with drip groove) and heads
    for k, wd in enumerate(WINDOWS):
        x0, x1 = wd["x0"], wd["x0"] + wd["w"]
        zs_ = Z_SILL
        if lod == 2:
            continue
        if lod == 1:
            box(P, "STONE", x0 - 0.05, -0.07, zs_ - 0.03, x1 + 0.05, 0.22, zs_ + 0.03)
            continue
        prof = [(0.22, zs_ + 0.04), (-0.07, zs_ + 0.005), (-0.07, zs_ - 0.03), (-0.05, zs_ - 0.03), (-0.05, zs_ - 0.012),
                (-0.03, zs_ - 0.012), (-0.03, zs_ - 0.03), (0.0, zs_ - 0.03), (0.22, zs_ - 0.03)]
        extrude_x(P, "STONE", prof, x0 - 0.05, x1 + 0.05)
        if k in (0, 1):          # bay A: plain head with drip hood
            box(P, "PLASTER", x0 - 0.06, -0.045, Z_HEAD_U + 0.02, x1 + 0.06, 0.0, Z_HEAD_U + 0.11)
            box(P, "PLASTER", x0 - 0.065, -0.055, Z_HEAD_U + 0.11, x1 + 0.065, -0.03, Z_HEAD_U + 0.135)
        elif k == 2:             # bay B: flat lintel band only
            box(P, "PLASTER", x0 - 0.05, -0.03, Z_HEAD_U + 0.02, x1 + 0.05, 0.0, Z_HEAD_U + 0.16)
        else:                    # window 4: timber lintel board (unpainted) with a hood
            box(P, "TIMBER", x0 - 0.07, -0.05, Z_HEAD_U + 0.02, x1 + 0.07, 0.0, Z_HEAD_U + 0.13)
            box(P, "TIMBER", x0 - 0.09, -0.08, Z_HEAD_U + 0.13, x1 + 0.09, -0.02, Z_HEAD_U + 0.155)
    P.dirt_scale = 1.0
    return P


# ---- upper windows: frame, two offset sashes, muntins, wavy glass -----------------------------------------------
def build_windows(lod):
    P = Part("windows")
    for k, wd in enumerate(WINDOWS):
        x0, x1 = wd["x0"], wd["x0"] + wd["w"]
        zb, zt = Z_SILL, Z_HEAD_U
        raised = wd["raised"]
        pr = wd["paint"]
        pr_up = tuple(min(255, int(c * (1.07 + 0.03 * k))) for c in pr)
        pr_lo = tuple(int(c * (0.90 - 0.02 * k)) for c in pr)

        def fb(xa, ya, za, xb, yb, zb_, rgb=pr):
            mbox(P, "FRAME", xa, ya, za, xb, yb, zb_, rgb)
        fy0, fy1 = 0.10, 0.24
        fb(x0, fy0, zb + 0.04, x0 + 0.06, fy1, zt)
        fb(x1 - 0.06, fy0, zb + 0.04, x1, fy1, zt)
        fb(x0 + 0.06, fy0, zt - 0.06, x1 - 0.06, fy1, zt)
        fb(x0, fy0 - 0.005, zb + 0.04, x1, fy1, zb + 0.075)
        ix0, ix1 = x0 + 0.06, x1 - 0.06
        iz0, iz1 = zb + 0.075, zt - 0.06
        H = iz1 - iz0
        sh = H / 2 + 0.02
        if lod == 0:
            fb(ix0, 0.158, iz0, ix0 + 0.012, 0.178, iz1)
            fb(ix1 - 0.012, 0.158, iz0, ix1, 0.178, iz1)
        for name, ya, sz0, dz in (("upper", 0.125, iz1 - sh, 0.0), ("lower", 0.178, iz0, raised)):
            y0, y1 = ya, ya + 0.033
            z0, z1 = sz0 + dz, sz0 + sh + dz
            rgb = pr_up if name == "upper" else pr_lo
            gtint = (0.86 - 0.03 * k, 0.95, 0.92 - 0.02 * k, 1.0)
            if lod == 0:
                stile, trail, brail = 0.04, (0.035 if name == "upper" else 0.045), (0.045 if name == "upper" else 0.05)
                fb(ix0, y0, z0, ix0 + stile, y1, z1, rgb)
                fb(ix1 - stile, y0, z0, ix1, y1, z1, rgb)
                fb(ix0 + stile, y0, z1 - trail, ix1 - stile, y1, z1, rgb)
                fb(ix0 + stile, y0, z0, ix1 - stile, y1, z0 + brail, rgb)
                gx0, gx1, gz0, gz1 = ix0 + stile, ix1 - stile, z0 + brail, z1 - trail
                ym = (y0 + y1) / 2
                for m in range(1, wd["cols"]):
                    xm = gx0 + (gx1 - gx0) * m / wd["cols"]
                    fb(xm - 0.011, ym - 0.012, gz0, xm + 0.011, ym + 0.012, gz1, rgb)
                for m in range(1, wd["rows"]):
                    zm = gz0 + (gz1 - gz0) * m / wd["rows"]
                    fb(gx0, ym - 0.0115, zm - 0.011, gx1, ym + 0.0115, zm + 0.011, rgb)

                def gwear(s, t):
                    e = min(s, 1 - s, t, 1 - t)
                    return (clamp(1.0 - e * 9.0) * 0.8 + 0.1 * hash01(s * 40, t * 40), 0, 0, 1)

                def wave(s, t, k=k):
                    return (0, 0.0007 * math.sin(s * 9.0 + t * 3.0 + k) + 0.0005 * math.sin(t * 11.0 - s * 4.0), 0)
                patch(P, "GLASS", (gx0, ym, gz0), (gx1 - gx0, 0, 0), (0, 0, gz1 - gz0), 6, 6, disp=wave,
                      col=lambda s, t, g=gtint: g, wear=gwear)
            else:
                fb(ix0, y0, z0, ix1, y1, z0 + 0.05, rgb)
                fb(ix0, y0, z0, ix0 + 0.04, y1, z1, rgb)
                fb(ix1 - 0.04, y0, z0, ix1, y1, z1, rgb)
                fb(ix0 + 0.04, y0 + 0.008, (z0 + z1) / 2 - 0.01, ix1 - 0.04, y1 - 0.008, (z0 + z1) / 2 + 0.01, rgb)
                fb(ix0, y0, z1 - 0.04, ix1, y1, z1, rgb)
                patch(P, "GLASS", (ix0, (y0 + y1) / 2, z0 + 0.05), (ix1 - ix0, 0, 0), (0, 0, sh - 0.09), 1, 1,
                      col=lambda s, t: (0.86, 0.95, 0.92, 1.0), wear=lambda s, t: (0.15, 0, 0, 1))
        if lod == 0:
            mx = (ix0 + ix1) / 2
            box(P, "IRON", mx - 0.02, 0.11, iz0 + sh + raised - 0.05, mx + 0.02, 0.13, iz0 + sh + raised - 0.03)
            for sx in (ix0 + 0.1, ix1 - 0.1):
                box(P, "IRON", sx - 0.02, 0.16, iz0 + raised + 0.0, sx + 0.02, 0.175, iz0 + raised + 0.012)
        if k == 3 and lod < 2:
            # a single louvred shutter leaf folded back against the wall (the other leaf is gone)
            lx0, lx1, lz0, lz1 = x1 + 0.03, x1 + 0.03 + 0.44, zb + 0.02, zt
            sp = (150, 118, 80) if lod == 0 else (150, 118, 80)
            mbox(P, "FRAME", lx0, -0.052, lz0, lx0 + 0.05, -0.012, lz1, (120, 96, 68))
            mbox(P, "FRAME", lx1 - 0.05, -0.052, lz0, lx1, -0.012, lz1, (120, 96, 68))
            mbox(P, "FRAME", lx0, -0.052, lz0, lx1, -0.012, lz0 + 0.06, (120, 96, 68))
            mbox(P, "FRAME", lx0, -0.052, lz1 - 0.06, lx1, -0.012, lz1, (120, 96, 68))
            if lod == 0:
                nsl = 11
                for m in range(nsl):
                    zz = lz0 + 0.1 + m * (lz1 - lz0 - 0.2) / (nsl - 1)
                    a = 0.5
                    P.face([P.bm.verts.new(p) for p in ((lx0 + 0.05, -0.048, zz), (lx1 - 0.05, -0.048, zz),
                                                       (lx1 - 0.05, -0.012, zz - 0.055), (lx0 + 0.05, -0.012, zz - 0.055))][::-1], "FRAME")
                    P.face([P.bm.verts.new(p) for p in ((lx0 + 0.05, -0.048, zz), (lx1 - 0.05, -0.048, zz),
                                                       (lx1 - 0.05, -0.012, zz - 0.055), (lx0 + 0.05, -0.012, zz - 0.055))], "FRAME")
                for hz in (lz0 + 0.3, lz1 - 0.3):    # iron strap hinges
                    box(P, "IRON", lx0 - 0.005, -0.06, hz - 0.02, lx0 + 0.16, -0.05, hz + 0.02)
    return P


# ---- ground floor: header, posts, threshold, sliding lattice + glazed doors, display window ---------------------------
def door_panel(P, x0, y0, kind, lod, w=0.6):
    x1 = x0 + w
    z0, z1 = 0.57, 2.53
    t = 0.03
    y1 = y0 + t
    ym = y0 + t / 2
    mat = "TIMBER" if kind == "lattice" else "FRAME"
    tint = (70, 52, 38) if kind == "lattice" else (96, 104, 92)
    bw = w - 0.08
    if lod >= 1:
        if kind == "lattice":
            mbox(P, "TIMBER", x0, y0, z0, x1, y1, z1, tint)
        else:
            mbox(P, "FRAME", x0, y0, z0, x1, y1, 1.05, tint)
            mbox(P, "FRAME", x0, y0, 2.45, x1, y1, z1, tint)
            patch(P, "GLASS", (x0 + 0.04, ym, 1.05), (bw, 0, 0), (0, 0, 1.4), 1, 1, col=lambda s, t: (0.86, 0.95, 0.92, 1.0),
                  wear=lambda s, t: (0.2, 0, 0, 1))
        return
    mbox(P, mat, x0, y0, z0, x0 + 0.04, y1, z1, tint)
    mbox(P, mat, x1 - 0.04, y0, z0, x1, y1, z1, tint)
    mbox(P, mat, x0 + 0.04, y0, z0, x1 - 0.04, y1, z0 + 0.09, tint)
    mbox(P, mat, x0 + 0.04, y0, 2.45, x1 - 0.04, y1, z1, tint)
    mbox(P, mat, x0 + 0.04, y0, 1.05, x1 - 0.04, y1, 1.10, tint)
    if kind == "lattice":
        mbox(P, mat, x0 + 0.04, y0 + 0.006, 0.66, x1 - 0.04, y1 - 0.006, 1.05, tint)
        mbox(P, mat, x0 + 0.075, y0 - 0.006, 0.7, x1 - 0.075, y0 + 0.006, 1.0, tint)
        nb = int(bw / 0.085)
        for b in range(nb):
            bx = x0 + 0.04 + (b + 0.5) * bw / nb
            mbox(P, mat, bx - 0.01, ym - 0.0175, 1.10, bx + 0.01, ym + 0.0175, 2.45, tint)
        for zt in (1.62, 2.06):
            mbox(P, mat, x0 + 0.04, ym - 0.006, zt - 0.006, x1 - 0.04, ym + 0.006, zt + 0.006, tint)
    else:
        mbox(P, "TIMBER", x0 + 0.04, y0 + 0.004, 0.66, x1 - 0.04, y1 - 0.004, 1.05, (80, 62, 46))
        gx0, gx1, gz0, gz1 = x0 + 0.04, x1 - 0.04, 1.10, 2.45
        for m in (1, 2):
            xm = gx0 + (gx1 - gx0) * m / 3
            mbox(P, mat, xm - 0.008, ym - 0.01, gz0, xm + 0.008, ym + 0.01, gz1, tint)
        for m in range(1, 5):
            zm = gz0 + (gz1 - gz0) * m / 5
            mbox(P, mat, gx0, ym - 0.01, zm - 0.008, gx1, ym + 0.01, zm + 0.008, tint)
        wave = lambda s, t: (0, 0.0006 * math.sin(s * 8 + t * 5 + x0 * 7), 0)
        patch(P, "GLASS", (gx0, ym, gz0), (gx1 - gx0, 0, 0), (0, 0, gz1 - gz0), 4, 6, disp=wave,
              col=lambda s, t: (0.86, 0.95, 0.92, 1.0),
              wear=lambda s, t: (clamp(1.0 - min(s, 1 - s, t, 1 - t) * 8.0) * 0.8, 0, 0, 1))
    if kind == "lattice":
        box(P, "IRON", x1 - 0.13, y0 - 0.008, 1.0, x1 - 0.1, y0, 1.12)
    else:
        box(P, "IRON", x0 + 0.1, y0 - 0.008, 1.02, x0 + 0.13, y0, 1.12)


def display_window(P, x0, x1, lod):
    """Fixed shop window with small panes on a kick board (157003/157013 type), set back 0.1 m."""
    y0, y1 = 0.16, 0.20
    ym = 0.18
    tint = (66, 72, 62)
    mbox(P, "TIMBER", x0, 0.05, 0.5, x1, 0.24, 1.05, (86, 66, 48))
    if lod == 0:
        for m in range(3):                                    # raised panels on the kick board
            px0 = x0 + 0.08 + m * (x1 - x0 - 0.16) / 3
            mbox(P, "TIMBER", px0 + 0.02, 0.04, 0.62, px0 + (x1 - x0 - 0.16) / 3 - 0.02, 0.055, 0.95, (92, 70, 50))
    mbox(P, "FRAME", x0, y0 - 0.02, 1.05, x1, y1 + 0.02, 1.12, tint)
    mbox(P, "FRAME", x0, y0 - 0.02, 2.47, x1, y1 + 0.02, 2.55, tint)
    mbox(P, "FRAME", x0, y0 - 0.02, 1.12, x0 + 0.06, y1 + 0.02, 2.47, tint)
    mbox(P, "FRAME", x1 - 0.06, y0 - 0.02, 1.12, x1, y1 + 0.02, 2.47, tint)
    gx0, gx1, gz0, gz1 = x0 + 0.06, x1 - 0.06, 1.12, 2.47
    if lod == 0:
        nc, nr = 5, 6
        for m in range(1, nc):
            xm = gx0 + (gx1 - gx0) * m / nc
            mbox(P, "FRAME", xm - 0.009, ym - 0.011, gz0, xm + 0.009, ym + 0.011, gz1, tint)
        for m in range(1, nr):
            zm = gz0 + (gz1 - gz0) * m / nr
            mbox(P, "FRAME", gx0, ym - 0.011, zm - 0.009, gx1, ym + 0.011, zm + 0.009, tint)
    wave = lambda s, t: (0, 0.0007 * math.sin(s * 7 + t * 5) + 0.0004 * math.sin(t * 13), 0)
    patch(P, "GLASS", (gx0, ym, gz0), (gx1 - gx0, 0, 0), (0, 0, gz1 - gz0), 6 if lod == 0 else 1, 6 if lod == 0 else 1,
          disp=wave if lod == 0 else None, col=lambda s, t: (0.84, 0.94, 0.9, 1.0),
          wear=lambda s, t: (clamp(1.0 - min(s, 1 - s, t, 1 - t) * 7.0) * 0.85, 0, 0, 1))


def build_ground(lod):
    P = Part("shopfront")
    for a, b in GROUND_OPEN:
        mbox(P, "TIMBER", a, 0.03, 2.55, b, 0.24, Z_HEAD_G, (150, 130, 112) if a < 1 else (120, 100, 84))   # header (kamoi)
    if lod == 2:
        return P
    for a, b in GROUND_OPEN:
        mbox(P, "TIMBER", a, 0.03, 0.5, a + 0.06, 0.22, 2.55, (140, 120, 100))
        mbox(P, "TIMBER", b - 0.06, 0.03, 0.5, b, 0.22, 2.55, (140, 120, 100))
    if lod == 0:
        for a, b in GROUND_OPEN:
            box(P, "TIMBER", a + 0.06, 0.26, 0.5, b - 0.06, 0.44, 0.56)
            for yr in (0.285, 0.34):
                box(P, "TIMBER", a + 0.06, yr, 0.56, b - 0.06, yr + 0.012, 0.572)
            box(P, "TIMBER", a + 0.06, 0.26, 2.51, b - 0.06, 0.44, 2.55)
    # bay A: sliding lattice + glazed doors, the right lattice leaf slid part-way
    door_panel(P, 0.36, 0.285, "lattice", lod)
    door_panel(P, 0.90, 0.345, "glazed", lod)
    door_panel(P, 1.50, 0.345, "glazed", lod)
    door_panel(P, 1.85, 0.285, "lattice", lod)
    # bay B: fixed small-pane display window (left) and a two-leaf entrance (right), one leaf open
    display_window(P, 3.21, 4.50, lod)
    mbox(P, "TIMBER", 4.50, 0.03, 0.5, 4.56, 0.22, 2.55, (140, 120, 100))
    door_panel(P, 4.57, 0.285, "glazed", lod, 0.55)
    door_panel(P, 5.08, 0.345, "lattice", lod, 0.55)
    if lod == 0:
        for bi in range(6):                                 # stacked shutter boards (agedo) beside the left post
            box(P, "TIMBER", 0.37, 0.05, 0.6 + bi * 0.308, 0.42, 0.075, 0.6 + bi * 0.308 + 0.29)
    return P



def build_fascia(lod):
    P = Part("fascia")
    zb, zt = 2.80, 3.13
    if lod == 2:
        box(P, "SIGN", 0, -0.055, zb, W, 0.0, zt)
        return P
    for x0, x1, board, frame in ((0.0, 3.0, (92, 80, 62), (78, 60, 44)), (3.0, W, (158, 140, 108), (120, 92, 66))):
        mbox(P, "SIGN", x0, -0.04, zb + 0.03, x1, 0.0, zt - 0.03, board)
        mbox(P, "TIMBER", x0, -0.06, zt - 0.035, x1, 0.0, zt, frame)
        mbox(P, "TIMBER", x0, -0.06, zb, x1, 0.0, zb + 0.035, frame)
    if lod == 0:
        pale = (206, 190, 156)
        n0 = P.nf()
        seg = 20
        for i in range(seg):                                       # bay A: ring + two bars (fictional mark)
            a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
            pts = [(1.5 + r * math.cos(a), -0.0415, 2.965 + r * math.sin(a)) for a, r in ((a0, 0.085), (a1, 0.085), (a1, 0.065), (a0, 0.065))]
            P.face([P.bm.verts.new(p) for p in pts[::-1]], "INK")
        box(P, "INK", 1.5 - 0.3, -0.043, 2.955, 1.5 - 0.11, -0.04, 2.975)
        box(P, "INK", 1.5 + 0.11, -0.043, 2.955, 1.5 + 0.3, -0.04, 2.975)
        # bay B: a diamond flanked by three short strokes on each side (fictional mark)
        dcx, dcz, d = 4.5, 2.965, 0.075
        P.face([P.bm.verts.new(p) for p in ((dcx, -0.0415, dcz + d), (dcx - d, -0.0415, dcz), (dcx, -0.0415, dcz - d), (dcx + d, -0.0415, dcz))], "INK")
        for sgn in (-1, 1):
            for m in range(3):
                bx = dcx + sgn * (0.18 + m * 0.07)
                box(P, "INK", bx - 0.012, -0.043, 2.9, bx + 0.012, -0.04, 3.03)
        P.paint(n0, pale)
        for cx in (0.04, 2.96, 3.04, W - 0.04):
            box(P, "IRON", cx - 0.008, -0.05, 2.955, cx + 0.008, -0.04, 2.975)
    return P


# ---- awnings: two different faded canvas shades (bay A ochre, bay B bleached off-white with a patched panel) --------------
def awning_bay(P, xa, xb, depth, z_w, z_l, base, lod, seed, patch_panel=None, patch_rgb=None):
    y_w, y_l = -0.03, -depth
    npan = max(1, round((xb - xa) / 0.75)) if lod < 2 else 2
    sw = (xb - xa) / npan
    ns = 6 if lod == 0 else (2 if lod == 1 else 1)

    def sag(x, t, xa_=None):
        if lod != 0:
            return 0.0
        ph = ((x - xa) % sw) / sw
        return -0.042 * math.sin(math.pi * ph) * t
    for i in range(npan):
        x_a = xa + i * sw
        rgb = patch_rgb if (patch_panel == i and patch_rgb) else tuple(int(c * (0.93 + 0.1 * hash01(i, seed))) for c in base)
        c0 = srgb(*rgb)

        def col(s, t, c0=c0, i=i):
            k = 1.0 - 0.10 * t + 0.05 * (hash01(s * 7 + i, t * 5, seed) - 0.5)
            return (c0[0] * k, c0[1] * k, c0[2] * k, 1.0)

        def wr(s, t, i=i):
            return (clamp(0.12 + 0.5 * t * t + 0.25 * (1 - t) * (0.6 + hash01(s * 20 + i, t * 9, seed))), 0.0, 0.0, 1.0)

        def disp(s, t, x_a=x_a):
            return (0, 0, sag(x_a + s * sw, t))
        patch(P, "CANVAS", (x_a, y_w, z_w), (sw, 0, 0), (0, y_l - y_w, z_l - z_w), 2 if lod == 0 else 1, ns, disp=disp, col=col,
              wear=wr, flip=True)
        nseg = 6 if lod == 0 else (3 if lod == 1 else 1)
        top, bot = [], []
        for m in range(nseg + 1):
            s = m / nseg
            x = x_a + s * sw
            zt_ = z_l + sag(x, 1.0)
            zb_ = zt_ - 0.15 - (0.05 * math.sin(math.pi * s) if lod == 0 else 0.03) - 0.02 * hash01(i, m, seed)
            yv = y_l - 0.004 * math.sin(x * 5.0)
            top.append(P.bm.verts.new((x, yv, zt_)))
            bot.append(P.bm.verts.new((x, yv - 0.012 * math.sin(math.pi * s), zb_)))
        for m in range(nseg):
            f = P.face([top[m], bot[m], bot[m + 1], top[m + 1]], "CANVAS", True)
            f[P.flags] = 3
            for lp in f.loops:
                lp[P.col] = (c0[0] * 0.92, c0[1] * 0.92, c0[2] * 0.92, 1.0)
                zz = lp.vert.co.z
                lp[P.wear] = (clamp(0.4 + 0.6 * (z_l - zz) * 3.0), 0, 0, 1)
                lp[P.uv0].uv = (lp.vert.co.x, lp.vert.co.z)
    if lod == 0:
        cyl(P, "IRON", (xa + 0.02, y_l, z_l + 0.01), (xb - 0.02, y_l, z_l + 0.01), 0.011, 8)
        cyl(P, "IRON", (xa, y_w - 0.005, z_w + 0.01), (xb, y_w - 0.005, z_w + 0.01), 0.009, 8)
    return sw


def build_awning(lod):
    P = Part("awning")
    swA = awning_bay(P, 0.0, 3.0, 0.95, 2.72, 2.24, (196, 168, 112), lod, 3)
    swB = awning_bay(P, 3.0, W, 0.78, 2.66, 2.27, (208, 200, 178), lod, 9, patch_panel=2, patch_rgb=(176, 168, 140))
    if lod < 2:
        stays = [(0.375, 0.95, 2.72, 2.24), (1.5, 0.95, 2.72, 2.24), (2.625, 0.95, 2.72, 2.24),
                 (3.75, 0.78, 2.66, 2.27), (5.25, 0.78, 2.66, 2.27)]
        for bx, dp, zw, zl in stays:
            beam(P, "IRON", (bx, -0.03, zw - 0.06), (bx, -dp + 0.02, zl - 0.05), 0.03, 0.012, up=(1, 0, 0))
            if lod == 0:
                beam(P, "IRON", (bx, -0.03, 2.28), (bx, -0.62, 2.43), 0.022, 0.012, up=(1, 0, 0))
                box(P, "IRON", bx - 0.04, -0.045, 2.2, bx + 0.04, -0.03, 2.72)
    return P


def build_noren(lod):
    """Indigo cloth strips hung in the entrance of bay B (sun-faded at the hem), fictional ring mark."""
    P = Part("noren")
    if lod > 0:
        return P
    xa, xb, zt, ln, y = 4.66, 5.60, 2.50, 0.78, 0.115
    mcyl(P, "IRON", (xa - 0.03, y - 0.02, zt + 0.01), (xb + 0.03, y - 0.02, zt + 0.01), 0.008, 6, (30, 26, 24))
    n = 3
    sw = (xb - xa) / n
    for i in range(n):
        x0 = xa + i * sw + 0.01
        def fold(s, t, i=i):
            return (0, -0.012 * math.sin(s * math.pi * 2 + i) * t * t - 0.03 * t * t * (0.5 + 0.5 * math.sin(i * 2.1 + 0.4)), 0)

        def shade(s, t):
            return 1.0 + 0.55 * t * t - 0.08 * math.cos(s * 12 + t * 3)
        mpatch(P, "CLOTH", (x0, y, zt), (sw - 0.02, 0, 0), (0, 0, -ln), 5, 8, (54, 62, 84), vary=0.1, disp=fold, flip=True,
               shade=shade)
    # faded ring mark on the middle strip
    cx, cz, seg = xa + 1.5 * sw, zt - 0.27, 16
    n0 = P.nf()
    for i in range(seg):
        a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
        pts = [(cx + r * math.cos(a) * 0.9, y - 0.006 - 0.004, cz + r * math.sin(a)) for a, r in ((a0, 0.1), (a1, 0.1), (a1, 0.075), (a0, 0.075))]
        P.face([P.bm.verts.new(p) for p in pts], "INK")
    P.paint(n0, (176, 176, 168))
    return P


def build_sign(lod):
    P = Part("sign")
    cy, cz, cx = -0.65, 3.2, 0.15
    seg = 32 if lod == 0 else (12 if lod == 1 else 8)
    mcyl(P, "TIMBER", (cx - 0.03, cy, cz), (cx + 0.03, cy, cz), 0.31, seg, (70, 58, 46))
    mcyl(P, "SIGN", (cx - 0.032, cy, cz), (cx + 0.032, cy, cz), 0.285, seg, (72, 68, 58))
    if lod == 2:
        return P
    box(P, "IRON", cx - 0.03, -0.03, 3.45, cx + 0.03, -0.02, 3.8)
    beam(P, "IRON", (cx, -0.03, 3.62), (cx, -0.9, 3.62), 0.035, 0.03, up=(1, 0, 0))
    beam(P, "IRON", (cx, -0.03, 3.4), (cx, -0.62, 3.6), 0.028, 0.02, up=(1, 0, 0))
    # bay B: hanging vertical board (tategamban) on an iron arm, fictional bar mark
    bx = 5.86
    box(P, "IRON", bx - 0.03, -0.03, 4.55, bx + 0.03, -0.02, 4.95)
    beam(P, "IRON", (bx, -0.03, 4.8), (bx, -0.7, 4.8), 0.03, 0.025, up=(1, 0, 0))
    beam(P, "IRON", (bx, -0.03, 4.55), (bx, -0.5, 4.78), 0.024, 0.02, up=(1, 0, 0))
    if lod == 0:
        for hy in (-0.25, -0.6):
            cyl(P, "IRON", (bx, hy, 4.8), (bx, hy, 4.62), 0.004, 5)
        mbox(P, "SIGN", bx - 0.02, -0.72, 3.62, bx + 0.02, -0.16, 4.62, (170, 154, 122)) if False else None
        mbox(P, "SIGN", bx - 0.02, -0.52, 3.46, bx + 0.02, -0.28, 4.62, (170, 154, 122))
        mbox(P, "TIMBER", bx - 0.03, -0.54, 4.58, bx + 0.03, -0.26, 4.62, (74, 58, 44))
        mbox(P, "TIMBER", bx - 0.03, -0.54, 3.46, bx + 0.03, -0.26, 3.5, (74, 58, 44))
        for sgn in (1, -1):
            xm = bx + sgn * 0.0225
            n0 = P.nf()
            y_a, y_b = -0.43, -0.37
            for zz in (3.62, 3.86, 4.1, 4.34):
                pts = [(xm, y_a, zz), (xm, y_b, zz), (xm, y_b, zz + 0.16), (xm, y_a, zz + 0.16)]
                P.face([P.bm.verts.new(p) for p in (pts if sgn > 0 else pts[::-1])], "INK")
            P.paint(n0, (60, 30, 24))
        for sgn in (1, -1):
            xm = cx + sgn * 0.0335
            nseg = 24
            n0 = P.nf()
            for i in range(nseg):
                a0, a1 = 2 * math.pi * i / nseg, 2 * math.pi * (i + 1) / nseg
                pts = [(xm, cy + r * math.cos(a), cz + r * math.sin(a)) for a, r in ((a0, 0.2), (a1, 0.2), (a1, 0.17), (a0, 0.17))]
                P.face([P.bm.verts.new(p) for p in (pts if sgn > 0 else pts[::-1])], "INK")
            d = 0.085
            pts = [(xm, cy, cz + d), (xm, cy + d, cz), (xm, cy, cz - d), (xm, cy - d, cz)]
            P.face([P.bm.verts.new(p) for p in (pts if sgn > 0 else pts[::-1])], "INK")
            P.paint(n0, (196, 180, 148))
    return P


def chochin(P, cx, cy, ztop, r, h, rgb, emit=1.0, seg=14):
    """Paper lantern on a hook: ribbed body (INTERIOR, emissive) and black lacquer caps."""
    mcyl(P, "INTERIOR", (cx, cy, ztop + 0.05), (cx, cy, ztop), 0.004, 4, (30, 24, 20))
    lathe(P, "INTERIOR", [(0.0, 0), (r * 0.5, 0), (r * 0.52, -0.025), (0.0, -0.025)], (cx, cy, ztop), seg, (36, 28, 22))
    prof = [(r * 0.62, -0.025), (r * 0.9, -0.09 * h), (r, -0.3 * h), (r * 1.04, -0.5 * h), (r, -0.7 * h), (r * 0.9, -0.9 * h), (r * 0.62, -h + 0.025)]
    lathe(P, "INTERIOR", prof, (cx, cy, ztop), seg, rgb, emit, smooth=True)
    for f in (0.2, 0.4, 0.6, 0.8):                      # bamboo ribs (darker rings)
        rr = [pr for pr in prof]
        zz = -f * h
        rad = r * (1.0 + 0.04 * math.sin(f * 3.14))
        mcyl(P, "INTERIOR", (cx, cy, ztop + zz - 0.002), (cx, cy, ztop + zz + 0.002), rad * 1.01, seg, (110, 70, 40), caps=(False, False))
    lathe(P, "INTERIOR", [(r * 0.62, -h + 0.025), (r * 0.5, -h + 0.025), (r * 0.5, -h), (0.0, -h)], (cx, cy, ztop), seg, (36, 28, 22))


def build_lanterns(lod):
    P = Part("lanterns")
    chochin(P, 0.85, -0.78, 2.03, 0.095, 0.28, (238, 176, 96), 0.9)
    chochin(P, 1.95, -0.72, 2.0, 0.075, 0.22, (232, 168, 92), 0.9)
    chochin(P, 4.35, -0.62, 2.05, 0.115, 0.34, (240, 182, 100), 0.9)
    # bracket lamp on the middle pier: iron arm + glass globe (early electric)
    box(P, "IRON", 2.985, -0.02, 2.2, 3.015, 0.0, 2.6)
    beam(P, "IRON", (3.0, -0.02, 2.5), (3.0, -0.34, 2.5), 0.022, 0.02, up=(1, 0, 0))
    beam(P, "IRON", (3.0, -0.02, 2.3), (3.0, -0.3, 2.47), 0.018, 0.016, up=(1, 0, 0))
    lathe(P, "IRON", [(0.0, 0), (0.035, 0), (0.035, 0.05)], (3.0, -0.34, 2.5), 10)
    lathe(P, "INTERIOR", [(0.0, -0.17), (0.05, -0.16), (0.09, -0.1), (0.1, -0.05), (0.075, -0.0), (0.04, 0.0), (0.0, 0.0)],
          (3.0, -0.34, 2.5), 12, (255, 214, 150), 0.7)
    return P


def build_services():
    P = Part("services")
    for ix in (5.28, 5.42, 5.56):
        box(P, "IRON", ix - 0.02, -0.06, 5.56, ix + 0.02, 0.0, 5.6)
        cyl(P, "STONE", (ix, -0.06, 5.58), (ix, -0.15, 5.58), 0.022, 8)
        cyl(P, "STONE", (ix, -0.15, 5.58), (ix, -0.19, 5.58), 0.03, 8)
        n = 8
        tw = 0.5 * (ix - 5.28) / 0.14
        pts = [Vector((ix + 1.5 * (i / n) * (0.4 + 0.3 * tw), -0.19 - 1.4 * i / n, 5.58 - 0.34 * (i / n) - 0.06 * math.sin(math.pi * i / n))) for i in range(n + 1)]
        for a, b in zip(pts[:-1], pts[1:]):
            cyl(P, "IRON", a, b, 0.005, 4, caps=(False, False), smooth=False)
    box(P, "SIGN", 2.87, -0.02, 1.7, 2.99, 0.0, 1.9)
    box(P, "INK", 2.91, -0.023, 1.74, 2.95, -0.02, 1.86)
    # electric service cable dropping down the right pier to a fuse box
    cyl(P, "IRON", (5.85, -0.015, 5.55), (5.85, -0.015, 3.5), 0.006, 4, caps=(False, False), smooth=False)
    mbox(P, "TIMBER", 5.8, -0.05, 3.4, 5.9, 0.0, 3.55, (60, 46, 34))
    return P


def stain_blob(P, cx, cz, rx, rz, rgb, a0, seed, y=-0.0035):
    c = srgb(*rgb)

    def col(s, t):
        d = math.hypot(s - 0.5, t - 0.5) * 2
        n = 0.55 + 0.45 * hash01(s * 9 + seed, t * 9, seed)
        return (c[0], c[1], c[2], clamp(a0 * (1 - smoothstep(0.25, 1.0, d)) * n))
    patch(P, "STAIN", (cx - rx, y, cz - rz), (2 * rx, 0, 0), (0, 0, 2 * rz), 6, 6, col=col, wear=lambda s, t: (0, 0, 0, 1),
          smooth=False, flip=True)


def stain_poly(P, cx, cz, r, rgb, alpha, seed, y=-0.005, n=11, squash=1.0):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        rr = r * (0.55 + 0.6 * hash01(i, seed, 5))
        pts.append((cx + rr * math.cos(a) * squash, y, cz + rr * math.sin(a)))
    c = srgb(*rgb)
    poly(P, "STAIN", pts[::-1], col=lambda co: (c[0], c[1], c[2], alpha), wear=lambda co: (0, 0, 0, 1))


def build_decals():
    P = Part("decals")
    for k, wd in enumerate(WINDOWS):
        x0 = wd["x0"]
        for si in range(6):
            sx = x0 - 0.02 + wd["w"] * (si + 0.5 + 0.3 * (hash01(k, si) - 0.5)) / 6
            wdt = 0.016 + 0.03 * hash01(k, si, 3)
            ln = 0.3 + 0.28 * hash01(k, si, 7)

            def col(s, t, si=si, k=k):
                return (0.03, 0.022, 0.015, 0.5 * (1 - t) ** 1.4 * (0.6 + 0.4 * hash01(s * 3, si, k)))
            patch(P, "STAIN", (sx - wdt / 2, -0.004, Z_SILL - 0.06), (wdt, 0, 0), (0, 0, -ln), 2, 4, col=col,
                  wear=lambda s, t: (0, 0, 0, 1), smooth=False, flip=True)

    def soot(s, t):
        return (0.02, 0.018, 0.014, clamp(t ** 1.6 * 0.5 * (0.55 + 0.9 * hash01(s * 30, t * 6))))
    patch(P, "STAIN", (0, -0.004, 5.5), (W, 0, 0), (0, 0, 0.45), 40, 4, col=soot, wear=lambda s, t: (0, 0, 0, 1), smooth=False, flip=True)

    def splash(s, t):
        return (0.05, 0.04, 0.025, clamp((1 - t) * 0.7 * (0.6 + 0.6 * hash01(s * 25, t * 4)) - 0.05))
    patch(P, "STAIN", (0, -0.0455, 0.0), (W, 0, 0), (0, 0, 0.5), 50, 3, col=splash, wear=lambda s, t: (0, 0, 0, 1), smooth=False, flip=True)
    for px in (0.0, 2.85, 5.7):
        patch(P, "STAIN", (px, -0.004, 0.5), (0.3, 0, 0), (0, 0, 0.75), 4, 5, col=splash, wear=lambda s, t: (0, 0, 0, 1),
              smooth=False, flip=True)
    # uneven plaster: big soft tone blotches (warm/cool), lime-wash repairs and chipped patches showing the lath
    tones = [((150, 132, 100), 0.20), ((92, 96, 92), 0.16), ((190, 172, 138), 0.22), ((110, 94, 72), 0.14)]
    blobs = [(0.85, 3.58, 0.95, 0.26), (2.95, 4.7, 0.27, 0.95), (4.35, 4.7, 0.22, 0.95), (5.75, 4.7, 0.22, 0.95), (1.5, 4.7, 0.13, 0.95),
             (3.0, 5.72, 1.3, 0.2), (5.0, 3.58, 0.95, 0.26), (1.4, 5.72, 1.0, 0.2), (4.8, 5.72, 1.1, 0.2), (0.15, 1.5, 0.15, 0.8),
             (5.9, 2.3, 0.1, 0.8)]
    for i, (cx, cz, rx, rz) in enumerate(blobs):
        rgb, a = tones[i % 4]
        stain_blob(P, cx, cz, rx, rz, rgb, a, i)
    stain_poly(P, 2.95, 4.3, 0.17, (176, 164, 138), 0.28, 1, squash=1.0)      # lime-wash repair
    stain_poly(P, 5.55, 3.45, 0.24, (170, 158, 132), 0.24, 2, squash=1.7)
    stain_poly(P, 0.18, 4.7, 0.1, (172, 160, 134), 0.26, 3, squash=0.8)
    stain_poly(P, 5.78, 6.02 - 0.15, 0.13, (72, 50, 34), 0.85, 4)             # chip to the lath under the cornice
    stain_poly(P, 0.18, 0.72, 0.14, (78, 54, 38), 0.85, 5)                     # chip at the plinth corner
    stain_poly(P, 2.98, 0.9, 0.11, (76, 52, 36), 0.8, 6)
    # torn fictional handbills (right pier) and one small bill on the left pier
    outline = [(5.725, 1.02), (5.985, 1.03), (5.98, 1.34), (5.95, 1.38), (5.985, 1.52), (5.97, 1.71), (5.9, 1.66), (5.86, 1.74),
               (5.8, 1.68), (5.76, 1.73), (5.725, 1.6)]
    poly(P, "POSTER", [(x, -0.0075, z) for x, z in outline][::-1], wear=lambda co: (0.25, 0, 0, 1))
    under = [(5.75, 1.3), (5.96, 1.32), (5.97, 1.62), (5.87, 1.58), (5.8, 1.64), (5.745, 1.55)]
    poly(P, "POSTER", [(x, -0.0045, z) for x, z in under][::-1], wear=lambda co: (0.35, 0, 0, 1))
    curl = [(5.985, 1.03, -0.0075), (5.985, 1.0, -0.03), (5.9, 1.02, -0.028), (5.9, 1.04, -0.0075)]
    poly(P, "POSTER", curl[::-1], wear=lambda co: (0.3, 0, 0, 1))
    small = [(0.06, 1.3), (0.24, 1.32), (0.25, 1.52), (0.2, 1.55), (0.07, 1.5)]
    poly(P, "POSTER", [(x, -0.0075, z) for x, z in small][::-1], wear=lambda co: (0.4, 0, 0, 1))
    return P



# ---- side and back walls (built in a local wall frame, then moved) ----------------------------------------------------
def small_window(P, x0, x1, z0, z1, kind, rgb, lod):
    """Window in a side/back wall, local frame (y=0 outer face, +T inner face). Real reveal is the wall's own."""
    def fb(xa, ya, za, xb, yb, zb, c=rgb):
        mbox(P, "FRAME", xa, ya, za, xb, yb, zb, c)
    mbox(P, "STONE", x0 - 0.05, -0.06, z0 - 0.03, x1 + 0.05, 0.2, z0 + 0.015)        # sill
    fb(x0, 0.10, z0 + 0.015, x0 + 0.05, 0.2, z1)
    fb(x1 - 0.05, 0.10, z0 + 0.015, x1, 0.2, z1)
    fb(x0 + 0.05, 0.10, z1 - 0.05, x1 - 0.05, 0.2, z1)
    fb(x0 + 0.05, 0.10, z0 + 0.015, x1 - 0.05, 0.2, z0 + 0.06)
    if kind == "lattice":
        n = int((x1 - x0 - 0.1) / 0.075)
        for i in range(n):
            bx = x0 + 0.05 + (i + 0.5) * (x1 - x0 - 0.1) / n
            mbox(P, "TIMBER", bx - 0.012, 0.06, z0 + 0.06, bx + 0.012, 0.11, z1 - 0.05, (66, 50, 36))
        mbox(P, "TIMBER", x0 + 0.05, 0.075, (z0 + z1) / 2 - 0.012, x1 - 0.05, 0.095, (z0 + z1) / 2 + 0.012, (66, 50, 36))
        return
    if lod == 0:
        mid = (x0 + x1) / 2
        for xa, xb, ya in ((x0 + 0.05, mid + 0.02, 0.13), (mid - 0.02, x1 - 0.05, 0.17)):        # two sliding sashes
            fb(xa, ya, z0 + 0.06, xa + 0.035, ya + 0.03, z1 - 0.05)
            fb(xb - 0.035, ya, z0 + 0.06, xb, ya + 0.03, z1 - 0.05)
            fb(xa, ya, z0 + 0.06, xb, ya + 0.03, z0 + 0.1)
            fb(xa, ya, z1 - 0.09, xb, ya + 0.03, z1 - 0.05)
            for m in range(1, 3):
                zm = z0 + 0.1 + (z1 - z0 - 0.19) * m / 3
                fb(xa + 0.035, ya + 0.008, zm - 0.008, xb - 0.035, ya + 0.022, zm + 0.008)
            patch(P, "GLASS", (xa + 0.035, ya + 0.015, z0 + 0.1), (xb - xa - 0.07, 0, 0), (0, 0, z1 - z0 - 0.19), 2, 3,
                  col=lambda s, t: (0.84, 0.94, 0.9, 1.0), wear=lambda s, t: (clamp(1.0 - min(s, 1 - s, t, 1 - t) * 8.0) * 0.8, 0, 0, 1))
    else:
        patch(P, "GLASS", (x0 + 0.05, 0.15, z0 + 0.06), (x1 - x0 - 0.1, 0, 0), (0, 0, z1 - z0 - 0.11), 1, 1,
              col=lambda s, t: (0.84, 0.94, 0.9, 1.0), wear=lambda s, t: (0.2, 0, 0, 1))


def back_door(P, x0, x1, lod):
    z1 = 2.4
    mbox(P, "FRAME", x0, 0.08, Z_PL, x0 + 0.05, 0.2, z1, (90, 72, 54))
    mbox(P, "FRAME", x1 - 0.05, 0.08, Z_PL, x1, 0.2, z1, (90, 72, 54))
    mbox(P, "FRAME", x0, 0.08, z1 - 0.05, x1, 0.2, z1, (90, 72, 54))
    mbox(P, "TIMBER", x0 + 0.05, 0.10, Z_PL + 0.02, x1 - 0.05, 0.155, z1 - 0.05, (120, 100, 84))
    if lod == 0:
        w = x1 - x0 - 0.1
        for i in range(1, 6):
            xx = x0 + 0.05 + w * i / 6
            mbox(P, "TIMBER", xx - 0.004, 0.095, Z_PL + 0.02, xx + 0.004, 0.105, z1 - 0.05, (40, 30, 22))
        for zz in (0.95, 1.8):
            mbox(P, "TIMBER", x0 + 0.05, 0.085, zz - 0.06, x1 - 0.05, 0.1, zz + 0.06, (90, 70, 52))
            mbox(P, "IRON", x0 + 0.05, 0.078, zz - 0.02, x0 + 0.42, 0.088, zz + 0.02)
        mbox(P, "IRON", x1 - 0.16, 0.078, 1.2, x1 - 0.12, 0.09, 1.34)
    mbox(P, "STONE", x0 - 0.1, -0.2, 0.0, x1 + 0.1, 0.0, 0.34)                               # back step


def wall_openings(side):
    """Openings in local wall coordinates (x along the wall, z)."""
    if side == "right":      # world y = x + 0.25
        return [(2.05, 3.05, 1.5, 2.4, "lattice"), (1.35, 2.25, 4.0, 5.3, "sliding")]
    if side == "left":       # world y = 8.75 - x
        return [(3.4, 4.0, 4.6, 5.2, "lattice"), (5.6, 6.4, 1.4, 2.2, "lattice")]
    return [(0.9, 1.8, Z_PL, 2.4, "door"), (3.8, 4.8, 4.0, 5.3, "sliding"), (1.6, 2.4, 4.0, 5.3, "sliding"), (3.2, 4.0, 1.6, 2.3, "lattice")]


def build_side(side, lod):
    P = Part("wall_" + side)
    length = W if side == "back" else D - 2 * T
    ops = wall_openings(side)
    rects = [(a, b, c, d) for a, b, c, d, _ in ops]
    xs, zs, holes = grid_from_openings(0, length, Z_PL, Z_TOP, rects)
    n0 = P.nv()
    if lod == 2:
        wall_slab(P, xs, zs, holes, 0.0, T, hole_back=0.09, back_faces=False, outer_sides=(side == "back"))
        box(P, "STONE", 0, -0.04, 0, length, T, Z_PL)
    else:
        wall_slab(P, xs, zs, holes, 0.0, T, bevel=0.012 if lod == 0 else 0.0, back_faces=lod == 0,
                  hole_back=None if lod == 0 else 0.34, outer_sides=(side == "back"))
        extrude_x(P, "STONE", [(T, 0.0), (-0.04, 0.0), (-0.04, 0.455), (-0.015, 0.5), (T, 0.5)], 0, length)
        for i, (a, b, c, d, kind) in enumerate(ops):
            if kind == "door":
                back_door(P, a, b, lod)
            else:
                small_window(P, a, b, c, d, kind, (104 + 10 * i, 96 + 8 * i, 76 + 6 * i), lod)
    P.xform(n0, side_xform(side))
    return P


# ---- tiled hip roof ---------------------------------------------------------------------------------------------------
def oriented_face(P, pts, mat, want, smooth=False):
    vs = [P.bm.verts.new(p) for p in pts]
    n = (Vector(pts[1]) - Vector(pts[0])).cross(Vector(pts[2]) - Vector(pts[0]))
    if n.dot(want) < 0:
        vs = vs[::-1]
    return P.face(vs, mat, smooth)


def roof_plane(P, a, b, d, c, nc, ns, thick=0.045):
    """Kawara courses on a plane: eave a->b, ridge d (above a) .. c (above b); courses parallel to the eave.
    Each course = a thin upper face + a riser (the thick tile end), giving the stepped tile silhouette."""
    a, b, d, c = Vector(a), Vector(b), Vector(d), Vector(c)
    n = (b - a).cross(d - a).normalized()
    if n.z < 0:
        n = -n
    down = (a - d).normalized()
    apex = (c - d).length < 1e-5
    lu, lv = (b - a).length, (d - a).length

    def pt(s, t, off):
        return (a.lerp(b, s)).lerp(d.lerp(c, s), t) + n * off

    for k in range(nc):
        t0, t1 = k / nc, (k + 1) / nc
        for i in range(ns):
            s0, s1 = i / ns, (i + 1) / ns
            top_edge = 0.006
            if apex and k == nc - 1:
                f = oriented_face(P, [pt(s0, t0, thick), pt(s1, t0, thick), pt(0.5, 1.0, top_edge)], "ROOF", n)
            else:
                f = oriented_face(P, [pt(s0, t0, thick), pt(s1, t0, thick), pt(s1, t1, top_edge), pt(s0, t1, top_edge)], "ROOF", n)
            f[P.flags] = 2
            for lp in f.loops:
                p = lp.vert.co
                lp[P.uv0].uv = ((p - a).dot((b - a).normalized()), (p - a).dot((d - a).normalized()))
            # riser at the lower end of this course (the exposed thick edge)
            g = oriented_face(P, [pt(s0, t0, 0.0), pt(s1, t0, 0.0), pt(s1, t0, thick), pt(s0, t0, thick)], "ROOF", down)
            g[P.flags] = 2
            for lp in g.loops:
                p = lp.vert.co
                lp[P.uv0].uv = ((p - a).dot((b - a).normalized()), p.z)


def build_roof(lod):
    P = Part("roof")
    xL, xR, yF, yB = -EAVE_OUT, W + EAVE_OUT, 0.28, D + EAVE_OUT
    half = (xR - xL) / 2
    zr = Z_EAVE + ROOF_PITCH * half
    r0, r1 = (W / 2, yF + half, zr), (W / 2, yB - half, zr)
    ze = Z_EAVE
    slope = math.hypot(half, zr - ze)
    nc = max(3, round(slope / 0.19)) if lod == 0 else (7 if lod == 1 else 2)
    ns = 3 if lod == 0 else 1
    roof_plane(P, (xR, yF, ze), (xR, yB, ze), r0, r1, nc, ns)
    roof_plane(P, (xL, yB, ze), (xL, yF, ze), r1, r0, nc, ns)
    roof_plane(P, (xL, yF, ze), (xR, yF, ze), r0, r0, nc, 2 if lod == 0 else 1)
    roof_plane(P, (xR, yB, ze), (xL, yB, ze), r1, r1, nc, 2 if lod == 0 else 1)
    if lod == 2:
        return P
    tile = (54, 60, 66)
    # ridge (munemaru): stacked cap + half-round roll along the ridge and the four hips
    lines = [(r0, r1), ((xR, yF, ze), r0), ((xL, yF, ze), r0), ((xR, yB, ze), r1), ((xL, yB, ze), r1)]
    for i, (p, q) in enumerate(lines):
        wid = 0.34 if i == 0 else 0.26
        mbeam(P, "ROOF", (p[0], p[1], p[2] + 0.02), (q[0], q[1], q[2] + 0.02), wid, 0.09, tile)
        if lod == 0:
            mbeam(P, "ROOF", (p[0], p[1], p[2] + 0.09), (q[0], q[1], q[2] + 0.09), wid * 0.62, 0.07, tile)
            mcyl(P, "ROOF", (p[0], p[1], p[2] + 0.14), (q[0], q[1], q[2] + 0.14), 0.07 if i == 0 else 0.055, 6, tile, caps=(True, True))
    if lod == 0:
        for (px, py, pz, dy) in ((r0[0], r0[1], r0[2], -1), (r1[0], r1[1], r1[2], 1)):     # generic onigawara at the ridge ends
            for k in range(3):
                mbox(P, "ROOF", px - 0.16 + 0.03 * k, py + dy * (0.05 + 0.06 * k) - 0.13, pz + 0.14 + 0.12 * k,
                     px + 0.16 - 0.03 * k, py + dy * (0.05 + 0.06 * k) + 0.13, pz + 0.26 + 0.12 * k, tile)
            mcyl(P, "ROOF", (px - 0.13, py + dy * 0.16, pz + 0.24), (px + 0.13, py + dy * 0.16, pz + 0.24), 0.09, 8, (60, 66, 70))
            mbox(P, "ROOF", px - 0.05, py + dy * 0.26, pz + 0.4, px + 0.05, py + dy * 0.34, pz + 0.66, tile)     # curled fin
    # eave tiles: half-round tile rolls + round ends along the sides and the back
    def eave_tiles(p0, p1, dirv, count):
        for i in range(count):
            f = (i + 0.5) / count
            e = Vector(p0).lerp(Vector(p1), f)
            top = e + dirv * 0.3 + Vector((0, 0, 0.07))
            mcyl(P, "ROOF", e + Vector((0, 0, 0.055)), top + Vector((0, 0, 0)), 0.045, 5, tile, caps=(False, False))
            n0 = P.nf()
            cyl(P, "ROOF", e + Vector((0, 0, 0.05)) - dirv * 0.012, e + Vector((0, 0, 0.05)) + dirv * 0.01, 0.052, 8)
            P.paint(n0, (78, 82, 84))
    if lod == 0:
        sl = Vector((-1, 0, ROOF_PITCH)).normalized()
        eave_tiles((xR, yF, ze), (xR, yB, ze), sl, 26)
        eave_tiles((xL, yB, ze), (xL, yF, ze), Vector((1, 0, ROOF_PITCH)).normalized(), 26)
        eave_tiles((xR, yB, ze), (xL, yB, ze), Vector((0, -1, ROOF_PITCH)).normalized(), 20)
        # rafters, eave board, soffit
        for i in range(19):
            yy = yF + 0.2 + i * (D - 0.2) / 18
            mbox(P, "TIMBER", W - 0.02, yy - 0.04, 5.86, xR - 0.05, yy + 0.04, 5.97, (110, 92, 76))
            mbox(P, "TIMBER", xL + 0.05, yy - 0.04, 5.86, 0.02, yy + 0.04, 5.97, (110, 92, 76))
        for i in range(14):
            xx = xL + 0.1 + i * (xR - xL - 0.2) / 13
            mbox(P, "TIMBER", xx - 0.04, D - 0.02, 5.86, xx + 0.04, yB - 0.05, 5.97, (110, 92, 76))
    mbox(P, "TIMBER", xR - 0.05, yF, 5.88, xR, yB, Z_EAVE, (96, 80, 64))
    mbox(P, "TIMBER", xL, yF, 5.88, xL + 0.05, yB, Z_EAVE, (96, 80, 64))
    mbox(P, "TIMBER", xL, yB - 0.05, 5.88, xR, yB, Z_EAVE, (96, 80, 64))
    mbox(P, "WOOD", W, yF, 5.96, xR, yB, 5.985, (60, 46, 34))
    mbox(P, "WOOD", xL, yF, 5.96, 0.0, yB, 5.985, (60, 46, 34))
    mbox(P, "WOOD", xL, D, 5.96, xR, yB, 5.985, (60, 46, 34))
    return P


def build_gutters(lod):
    P = Part("gutters")
    zg = Z_EAVE - 0.06
    gc = (86, 92, 84)
    xL, xR, yB = -EAVE_OUT, W + EAVE_OUT, D + EAVE_OUT
    if lod == 0:
        for (x, ya, yb, sgn) in ((xR + 0.03, 0.28, yB + 0.03, 1), (xL - 0.03, 0.28, yB + 0.03, -1)):
            mbox(P, "IRON", x - 0.07, ya, zg - 0.045, x + 0.07, yb, zg - 0.035, gc)
            mbox(P, "IRON", x + sgn * 0.065, ya, zg - 0.045, x + sgn * 0.071, yb, zg + 0.05, gc)
            mbox(P, "IRON", x - sgn * 0.07, ya, zg - 0.045, x - sgn * 0.064, yb, zg + 0.02, gc)
            for yy in [ya + 0.4 + i * 1.0 for i in range(9)]:
                mbox(P, "IRON", x - 0.075, yy - 0.012, zg - 0.06, x + 0.075, yy + 0.012, zg - 0.03, (60, 62, 58))
        mbox(P, "IRON", xL - 0.03, yB + 0.03 - 0.07, zg - 0.045, xR + 0.03, yB + 0.03 + 0.07, zg - 0.035, gc)
        mbox(P, "IRON", xL - 0.03, yB + 0.1, zg - 0.045, xR + 0.03, yB + 0.106, zg + 0.05, gc)
        mbox(P, "IRON", xL - 0.03, yB - 0.04, zg - 0.045, xR + 0.03, yB - 0.034, zg + 0.02, gc)
        for xx in [xL + 0.4 + i * 1.0 for i in range(7)]:
            mbox(P, "IRON", xx - 0.012, yB - 0.045, zg - 0.06, xx + 0.012, yB + 0.105, zg - 0.03, (60, 62, 58))

    def pipe(pts, r=0.038):
        for p, q in zip(pts[:-1], pts[1:]):
            mcyl(P, "IRON", p, q, r, 8 if lod == 0 else 4, gc, caps=(False, False))
            if lod == 0:
                pass
    # back corners: gutter outlet -> elbow -> pipe down the side wall
    for sx, wx in ((1, W + 0.07), (-1, -0.07)):
        gx = xR + 0.03 if sx > 0 else xL - 0.03
        yy = D - 0.1
        pipe([(gx, yy, zg - 0.05), (gx, yy, zg - 0.2), (wx, yy, zg - 0.55), (wx, yy, 0.68)])
        if lod == 0:
            for zc in (1.2, 2.5, 3.8, 5.0):
                mbox(P, "IRON", wx - 0.055, yy - 0.012, zc - 0.015, wx + 0.055, yy + 0.012, zc + 0.015, (48, 46, 42))
            mcyl(P, "IRON", (wx, yy, 0.68), (wx, yy, 0.6), 0.05, 8, gc)
            mbox(P, "IRON", gx - 0.06, yy - 0.06, zg - 0.05, gx + 0.06, yy + 0.06, zg - 0.03, (70, 74, 70))
    # front: scupper through the parapet + pipe down the right pier
    fx = 5.93
    mbox(P, "IRON", fx - 0.06, -0.22, 6.42, fx + 0.06, 0.05, 6.47, gc)
    mbox(P, "IRON", fx - 0.07, -0.24, 6.3, fx + 0.07, -0.16, 6.55, (70, 74, 70))            # rainwater head
    pipe([(fx, -0.2, 6.3), (fx, -0.2, 6.15), (fx, -0.07, 6.02), (fx, -0.075, 0.6)])
    if lod == 0:
        for zc in (0.9, 2.2, 3.5, 4.8, 5.8):
            mbox(P, "IRON", fx - 0.055, -0.07 - 0.012, zc - 0.015, fx + 0.055, -0.07 + 0.012 - 0.0, zc + 0.015, (48, 46, 42))
        mbox(P, "IRON", fx - 0.05, -0.115, 0.6, fx + 0.05, -0.035, 0.75, (70, 74, 70))
    return P


def crate(P, x, y, z, w, d, h, rgb, rot=0.0):
    n0 = P.nf()
    n1 = P.nv()
    box(P, "WOOD", x - w / 2, y - d / 2, z, x + w / 2, y + d / 2, z + h)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(P, "WOOD", x + sx * (w / 2 - 0.02) - 0.025 + sx * 0.005, y + sy * (d / 2 - 0.02) - 0.025 + sy * 0.005, z,
                x + sx * (w / 2 - 0.02) + 0.025 + sx * 0.005, y + sy * (d / 2 - 0.02) + 0.025 + sy * 0.005, z + h)
    for zz in (0.33, 0.66):
        box(P, "WOOD", x - w / 2 - 0.008, y - d / 2 - 0.008, z + h * zz - 0.02, x + w / 2 + 0.008, y + d / 2 + 0.008, z + h * zz + 0.02)
    P.paint(n0, rgb)
    if rot:
        P.xform(n1, Matrix.Translation((x, y, 0)) @ Matrix.Rotation(rot, 4, "Z") @ Matrix.Translation((-x, -y, 0)))


def barrel(P, cx, cy, cz, r, h, rgb, hoop=(60, 48, 38), seg=14):
    ps = [(r * 0.86, 0), (r * 0.94, 0.15 * h), (r, 0.5 * h), (r * 0.94, 0.85 * h), (r * 0.86, h)]
    lathe(P, "WOOD", ps, (cx, cy, cz), seg, rgb)
    for f in (0.1, 0.28, 0.72, 0.9):
        idx = f
        rr = r * (0.86 + 0.14 * (1 - abs(f - 0.5) * 2 * 0.9)) + 0.006
        mcyl(P, "IRON", (cx, cy, cz + f * h - 0.012), (cx, cy, cz + f * h + 0.012), rr * 1.0, seg, hoop, caps=(False, False))


def build_streetprops():
    P = Part("streetprops")
    crate(P, 0.62, -0.75, 0.0, 0.5, 0.4, 0.34, (150, 122, 84), 0.1)
    crate(P, 0.58, -0.76, 0.34, 0.42, 0.34, 0.3, (132, 108, 76), -0.25)
    crate(P, 1.2, -0.62, 0.0, 0.44, 0.34, 0.28, (140, 114, 80), 0.05)
    barrel(P, 2.35, -0.95, 0.0, 0.27, 0.78, (118, 88, 56))
    # bench (koshikake) with a folded cushion and a left-behind tea cup, in front of the display window
    mbox(P, "WOOD", 3.3, -0.85, 0.42, 4.5, -0.5, 0.46, (122, 96, 66))
    for lx in (3.36, 4.44):
        for ly in (-0.8, -0.55):
            mbox(P, "WOOD", lx - 0.03, ly - 0.03, 0.0, lx + 0.03, ly + 0.03, 0.42, (108, 84, 58))
    mbox(P, "CLOTH", 3.5, -0.8, 0.46, 3.95, -0.55, 0.51, (64, 74, 92))
    lathe(P, "INTERIOR", [(0.0, 0), (0.026, 0), (0.038, 0.03), (0.036, 0.05), (0.032, 0.05), (0.0, 0.01)], (4.2, -0.68, 0.46), 10, (210, 200, 180))
    # wooden bucket with ladle, jar with lid, bamboo broom leaning on the pier
    lathe(P, "WOOD", [(0.13, 0), (0.15, 0.1), (0.155, 0.2), (0.14, 0.25)], (5.4, -0.45, 0.0), 12, (126, 100, 70))
    mcyl(P, "IRON", (5.4, -0.45, 0.06), (5.4, -0.45, 0.075), 0.152, 12, (50, 44, 38), caps=(False, False))
    mcyl(P, "IRON", (5.4, -0.45, 0.17), (5.4, -0.45, 0.185), 0.156, 12, (50, 44, 38), caps=(False, False))
    mbeam(P, "WOOD", (5.4, -0.45, 0.28), (5.55, -0.6, 0.02), 0.02, 0.02, (100, 76, 52))
    lathe(P, "INTERIOR", [(0.0, 0), (0.12, 0.0), (0.2, 0.12), (0.24, 0.3), (0.2, 0.5), (0.13, 0.58), (0.14, 0.62), (0.0, 0.62)],
          (5.15, -1.05, 0.0), 14, (92, 74, 58))
    lathe(P, "INTERIOR", [(0.0, 0.62), (0.15, 0.62), (0.16, 0.65), (0.0, 0.7)], (5.15, -1.05, 0.0), 14, (72, 58, 46))
    mbeam(P, "WOOD", (5.99, -0.25, 1.35), (5.9, -0.4, 0.02), 0.024, 0.024, (150, 128, 88))
    for i in range(7):                                                         # bristles
        a = (i - 3) * 0.02
        mbeam(P, "WOOD", (5.9 + a, -0.4, 0.34), (5.88 + a * 2.4, -0.43, 0.0), 0.018, 0.012, (156, 132, 92))
    return P


def build_backdrop():
    """Dark quads behind every opening: stand-in when the interior cell is not loaded (toggle off with the cell)."""
    P = Part("backdrop")
    for a, b in GROUND_OPEN:
        oriented_face(P, [(a, 0.3, Z_PL), (b, 0.3, Z_PL), (b, 0.3, Z_HEAD_G), (a, 0.3, Z_HEAD_G)], "INTERIOR", Vector((0, -1, 0)))
    for wd in WINDOWS:
        a, b = wd["x0"], wd["x0"] + wd["w"]
        oriented_face(P, [(a, 0.3, Z_SILL), (b, 0.3, Z_SILL), (b, 0.3, Z_HEAD_U), (a, 0.3, Z_HEAD_U)], "INTERIOR", Vector((0, -1, 0)))
    P.paint(0, (34, 26, 20))
    return P



# ==== INTERIOR CELL (loaded within ~15 m; separate node) =============================================================
def at(P, n1, pos, rot=0.0, scale=(1, 1, 1)):
    """Move geometry created since vertex index n1: scale, rotate about Z, translate."""
    M = Matrix.Translation(pos) @ Matrix.Rotation(rot, 4, "Z") @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1))
    P.xform(n1, M)


def jar(P, x, y, z, r, h, rgb, lid=None, seg=12):
    n1 = P.nv()
    lathe(P, "INTERIOR", [(0.0, 0), (r * 0.7, 0), (r * 0.95, h * 0.15), (r, h * 0.45), (r * 0.85, h * 0.8), (r * 0.55, h * 0.92),
                          (r * 0.5, h), (r * 0.56, h * 1.0 + 0.008)], (0, 0, 0), seg, rgb)
    at(P, n1, (x, y, z))
    if lid:
        lathe(P, "INTERIOR", [(r * 0.62, h), (r * 0.62, h + 0.012), (r * 0.15, h + 0.035), (0.0, h + 0.05)], (x, y, z), seg, lid)


def bowl(P, x, y, z, r, h, rgb, seg=10):
    lathe(P, "INTERIOR", [(0.0, 0), (r * 0.4, 0), (r * 0.8, h * 0.4), (r, h), (r * 0.94, h), (r * 0.72, h * 0.45), (0.0, h * 0.12)],
          (x, y, z), seg, rgb)


def bottle(P, x, y, z, r, h, rgb, seg=8):
    lathe(P, "INTERIOR", [(0.0, 0), (r, 0), (r, h * 0.55), (r * 0.5, h * 0.72), (r * 0.36, h * 0.88), (r * 0.4, h), (r * 0.3, h), (r * 0.3, h * 0.72)],
          (x, y, z), seg, rgb)


def cloth_bolt(P, x, y, z, ln, r, rgb, along="y"):
    if along == "y":
        mcyl(P, "CLOTH", (x, y, z + r), (x, y + ln, z + r), r, 10, rgb)
    else:
        mcyl(P, "CLOTH", (x, y, z + r), (x + ln, y, z + r), r, 10, rgb)


def sack(P, x, y, z, w, d, h, rgb, rot=0.0):
    n1 = P.nv()
    lathe(P, "CLOTH", [(0.0, 0), (0.5, 0.02), (0.56, 0.3), (0.48, 0.65), (0.3, 0.92), (0.14, 1.0), (0.0, 1.0)], (0, 0, 0), 10, rgb)
    at(P, n1, (x, y, z), rot, (w, d, h))


def tawara(P, x, y, z, rot=0.0, r=0.16, ln=0.6):
    """Rice bale: bulged straw cylinder with rope bands (lying along X, then turned by rot)."""
    n1 = P.nv()
    lathe(P, "CLOTH", [(0.0, -ln / 2), (r * 0.8, -ln / 2), (r * 0.95, -ln * 0.36), (r, -ln * 0.15), (r, ln * 0.15), (r * 0.95, ln * 0.36),
                       (r * 0.8, ln / 2), (0.0, ln / 2)], (0, 0, 0), 16, (128, 108, 74))
    for t in (-0.36, -0.13, 0.13, 0.36):
        lathe(P, "CLOTH", [(r * 1.0 + 0.004, t * ln - 0.012), (r * 1.0 + 0.012, t * ln), (r * 1.0 + 0.004, t * ln + 0.012)], (0, 0, 0), 16, (92, 76, 52), smooth=False)
    M = Matrix.Translation((x, y, z + r)) @ Matrix.Rotation(rot, 4, "Z") @ Matrix.Rotation(math.pi / 2, 4, "Y")
    P.xform(n1, M)


def kettle(P, x, y, z, s=1.0, glow=False):
    n1 = P.nv()
    lathe(P, "IRON", [(0.0, 0), (0.09, 0), (0.135, 0.05), (0.14, 0.11), (0.1, 0.17), (0.07, 0.19), (0.075, 0.2), (0.0, 0.2)], (0, 0, 0), 12)
    lathe(P, "IRON", [(0.0, 0.2), (0.07, 0.2), (0.06, 0.225), (0.02, 0.24), (0.0, 0.245)], (0, 0, 0), 8)
    mbeam(P, "IRON", (0.13, 0, 0.13), (0.2, 0, 0.2), 0.028, 0.02, (28, 24, 22))                                  # spout
    for a in range(9):                                                                                              # arched handle
        t0, t1 = math.pi * a / 9, math.pi * (a + 1) / 9
        p0 = (0.13 * math.cos(t0), 0, 0.19 + 0.09 * math.sin(t0))
        p1 = (0.13 * math.cos(t1), 0, 0.19 + 0.09 * math.sin(t1))
        cyl(P, "IRON", p0, p1, 0.007, 4, caps=(False, False), smooth=False)
    at(P, n1, (x, y, z), 0, (s, s, s))


def teacup(P, x, y, z, s=1.0, rgb=(220, 214, 196), dregs=False):
    n1 = P.nv()
    lathe(P, "INTERIOR", [(0.0, 0), (0.022, 0), (0.03, 0.01), (0.036, 0.04), (0.038, 0.055), (0.034, 0.055), (0.03, 0.04), (0.0, 0.012)],
          (0, 0, 0), 10, rgb)
    if dregs:
        lathe(P, "INTERIOR", [(0.0, 0.03), (0.032, 0.03), (0.0, 0.031)], (0, 0, 0), 10, (74, 90, 40))
    at(P, n1, (x, y, z), 0, (s, s, s))


def zabuton(P, x, y, z, rot, rgb, s=0.55):
    n1 = P.nv()
    for k in range(6):
        pass
    mpatch(P, "CLOTH", (-s / 2, -s / 2, 0.04), (s, 0, 0), (0, s, 0), 6, 6, rgb, vary=0.05,
           disp=lambda a, b: (0, 0, 0.03 * math.sin(math.pi * a) * math.sin(math.pi * b)))
    mpatch(P, "CLOTH", (-s / 2, -s / 2, 0.0), (0, s, 0), (s, 0, 0), 6, 6, rgb, vary=0.05,
           disp=lambda a, b: (0, 0, 0.03 * math.sin(math.pi * a) * math.sin(math.pi * b)))
    for cx, cy in ((-s / 2, -s / 2), (s / 2, -s / 2), (s / 2, s / 2), (-s / 2, s / 2)):
        mbox(P, "CLOTH", cx - 0.012, cy - 0.012, 0.005, cx + 0.012, cy + 0.012, 0.04, (196, 186, 160))
    at(P, n1, (x, y, z), rot)


def tatami_mat(P, x0, y0, z, along="x", rgb=None, ln=1.8, wd=0.9):
    rgb = rgb or (136 + int(14 * hash01(x0, y0)), 126 + int(12 * hash01(x0, y0, 2)), 90 + int(12 * hash01(x0, y0, 3)))
    n1 = P.nv()
    n0 = P.nf()
    box(P, "TATAMI", 0.0, 0.0, 0.0, ln - 0.004, wd - 0.004, 0.055)
    P.paint(n0, rgb)
    heri = (34, 34, 40) if hash01(x0, y0, 9) > 0.35 else (46, 40, 34)
    for yy in (0.0, wd - 0.004 - 0.05):
        mbox(P, "CLOTH", 0.0, yy, 0.052, ln - 0.004, yy + 0.05, 0.0562, heri)
    if along == "x":
        at(P, n1, (x0, y0, z))
    else:
        at(P, n1, (x0, y0, z), math.pi / 2)


def shoji(P, x0, x1, z0, z1, y, emit=0.32, closed=True, lit=(238, 222, 184)):
    """Sliding shoji leaf facing +/-y: wood frame, kumiko grid, paper (SHOJI, emissive when lit)."""
    fr = (176, 146, 104)
    t = 0.032
    mbox(P, "WOOD", x0, y - t / 2, z0, x0 + 0.035, y + t / 2, z1, fr)
    mbox(P, "WOOD", x1 - 0.035, y - t / 2, z0, x1, y + t / 2, z1, fr)
    mbox(P, "WOOD", x0, y - t / 2, z0, x1, y + t / 2, z0 + 0.12, fr)
    mbox(P, "WOOD", x0, y - t / 2, z1 - 0.04, x1, y + t / 2, z1, fr)
    nx = max(2, int((x1 - x0) / 0.27))
    for i in range(1, nx):
        xx = x0 + (x1 - x0) * i / nx
        mbox(P, "WOOD", xx - 0.007, y - 0.014, z0 + 0.12, xx + 0.007, y + 0.014, z1 - 0.04, fr)
    nz = 6
    for i in range(1, nz):
        zz = z0 + 0.12 + (z1 - z0 - 0.16) * i / nz
        mbox(P, "WOOD", x0 + 0.035, y - 0.014, zz - 0.007, x1 - 0.035, y + 0.014, zz + 0.007, fr)
    mpatch(P, "SHOJI", (x0 + 0.035, y + 0.004, z0 + 0.12), (x1 - x0 - 0.07, 0, 0), (0, 0, z1 - z0 - 0.16), 1, 1, lit, vary=0.0,
           emit=emit if closed else 0.0, flip=True, smooth=False)


def andon(P, x, y, z, s=1.0, rot=0.0, lit=True):
    """Standing paper lamp: wooden base, four posts, glowing paper box, lid."""
    n1 = P.nv()
    mbox(P, "WOOD", -0.13, -0.13, 0.0, 0.13, 0.13, 0.05, (96, 66, 40))
    for sx in (-1, 1):
        for sy in (-1, 1):
            mbox(P, "WOOD", sx * 0.105 - 0.012, sy * 0.105 - 0.012, 0.05, sx * 0.105 + 0.012, sy * 0.105 + 0.012, 0.5, (84, 58, 36))
    for sx, sy, ax in ((0.0, -0.105, "x"), (0.0, 0.105, "x"), (-0.105, 0.0, "y"), (0.105, 0.0, "y")):
        if ax == "x":
            mpatch(P, "SHOJI", (-0.105, sy, 0.06), (0.21, 0, 0), (0, 0, 0.42), 1, 1, (244, 214, 160), emit=0.55 if lit else 0.0,
                   flip=(sy > 0), smooth=False)
        else:
            mpatch(P, "SHOJI", (sx, -0.105, 0.06), (0, 0.21, 0), (0, 0, 0.42), 1, 1, (244, 214, 160), emit=0.55 if lit else 0.0,
                   flip=(sx < 0), smooth=False)
    mbox(P, "WOOD", -0.14, -0.14, 0.5, 0.14, 0.14, 0.54, (96, 66, 40))
    mbox(P, "WOOD", -0.05, -0.05, 0.54, 0.05, 0.05, 0.6, (96, 66, 40))
    lathe(P, "INTERIOR", [(0.0, 0.08), (0.03, 0.08), (0.03, 0.1), (0.0, 0.11)], (0, 0, 0), 8, (255, 230, 170), 1.0)      # flame
    at(P, n1, (x, y, z), rot, (s, s, s))


def bulb(P, x, y, ztop, drop):
    mcyl(P, "INTERIOR", (x, y, ztop), (x, y, ztop - drop), 0.004, 4, (28, 24, 20))
    lathe(P, "INTERIOR", [(0.018, 0), (0.02, -0.03), (0.0, -0.032)], (x, y, ztop - drop), 8, (60, 50, 40))
    lathe(P, "INTERIOR", [(0.02, -0.03), (0.03, -0.06), (0.036, -0.09), (0.03, -0.125), (0.012, -0.145), (0.0, -0.15)],
          (x, y, ztop - drop), 10, (255, 226, 170), 1.0)
    mbox(P, "IRON", x - 0.14, y - 0.14, ztop - drop + 0.04, x + 0.14, y + 0.14, ztop - drop + 0.06, (60, 44, 32)) if False else None


def tansu(P, x0, y0, z0, w, d, h, front="+y"):
    """Chest of drawers (front faces +y or -y): body, drawer fronts, iron pulls."""
    sgn = 1 if front == "+y" else -1
    yf = y0 + d if sgn > 0 else y0
    mbox(P, "WOOD", x0, y0, z0, x0 + w, y0 + d, z0 + h, (98, 66, 40))
    rows = [0.16, 0.16, 0.2, 0.24, 0.24]
    tot = sum(rows)
    zz = z0 + 0.04
    for i, rh in enumerate(rows):
        hh = (h - 0.08) * rh / tot
        cols = 2 if i < 3 else 1
        for c in range(cols):
            xa = x0 + 0.03 + c * (w - 0.06) / cols
            xb = x0 + 0.03 + (c + 1) * (w - 0.06) / cols
            mbox(P, "WOOD", xa + 0.006, yf if sgn > 0 else yf - 0.014, zz + 0.006, xb - 0.006, yf + 0.014 if sgn > 0 else yf,
                 zz + hh - 0.006, (112, 76, 46))
            px = (xa + xb) / 2
            mbox(P, "IRON", px - 0.035, yf + 0.014 * (1 if sgn > 0 else 0) - 0.002 * (0 if sgn > 0 else 1) + (0 if sgn > 0 else -0.014),
                 zz + hh / 2 - 0.02, px + 0.035, yf + 0.026 if sgn > 0 else yf - 0.026, zz + hh / 2 + 0.02, (30, 28, 26))
        zz += hh
    mbox(P, "WOOD", x0 - 0.01, y0 - 0.01, z0 + h, x0 + w + 0.01, y0 + d + 0.01, z0 + h + 0.025, (84, 56, 34))


def shelf_bay(P, x0, x1, ya, yb, ztops, depth_dir, seed, kinds):
    """Shelf unit against a side wall: uprights, boards, goods. x0..x1 = shelf depth range."""
    dark = (78, 56, 38)
    for yy in (ya, yb - 0.05):
        mbox(P, "WOOD", x0, yy, Z_PL, x1, yy + 0.05, ztops[-1] + 0.04, dark)
    zs = [Z_PL + 0.22] + ztops
    for z in zs:
        mbox(P, "WOOD", x0, ya, z, x1, yb, z + 0.03, (118, 88, 58))
    r = random.Random(seed)
    for ti, z in enumerate(zs[:-1]):
        room = zs[ti + 1] - z - 0.03
        y = ya + 0.09
        while y < yb - 0.16:
            kind = kinds[(ti + int(y * 7)) % len(kinds)] if r.random() > 0.15 else "gap"
            cx = (x0 + x1) / 2 + (r.random() - 0.5) * 0.04
            zt = z + 0.03
            if kind == "jar":
                rr = 0.06 + 0.03 * r.random()
                jar(P, cx, y + rr, zt, rr, min(room - 0.05, 0.16 + 0.1 * r.random()), r.choice([(86, 74, 60), (118, 96, 66), (60, 66, 62), (150, 132, 104)]),
                    lid=(66, 52, 40))
                y += rr * 2 + 0.03
            elif kind == "box":
                w = 0.1 + 0.08 * r.random()
                hgt = min(room - 0.04, 0.12 + 0.12 * r.random())
                mbox(P, "INTERIOR", cx - 0.1, y, zt, cx + 0.1, y + w, zt + hgt, r.choice([(160, 142, 108), (140, 112, 82), (146, 150, 142), (172, 162, 134)]))
                mbox(P, "INTERIOR", cx - 0.101, y + w * 0.35, zt, cx + 0.101, y + w * 0.6, zt + hgt, r.choice([(150, 40, 34), (52, 60, 84), (80, 66, 48)])) if r.random() > 0.5 else None
                y += w + 0.02
            elif kind == "bolt":
                for j in range(3):
                    cloth_bolt(P, cx - 0.14, y + 0.055, zt + j * 0.095 if False else zt, 0.28, 0.05, r.choice([(54, 62, 84), (196, 188, 164), (132, 100, 72), (100, 108, 88), (132, 78, 68)]), "x")
                    break
                for j in range(1, 3):
                    if zt + j * 0.1 + 0.05 < zs[ti + 1]:
                        cloth_bolt(P, cx - 0.14, y + 0.055 + (0.0 if j % 2 else 0.02), zt + j * 0.1, 0.28, 0.05,
                                   r.choice([(54, 62, 84), (196, 188, 164), (132, 100, 72), (100, 108, 88)]), "x")
                y += 0.13
            elif kind == "tin":
                rr = 0.045 + 0.02 * r.random()
                hgt = min(room - 0.05, 0.13 + 0.06 * r.random())
                mcyl(P, "IRON", (cx, y + rr, zt), (cx, y + rr, zt + hgt), rr, 10, r.choice([(120, 60, 44), (60, 78, 92), (150, 130, 80)]))
                y += rr * 2 + 0.02
            elif kind == "bottle":
                bottle(P, cx, y + 0.03, zt, 0.032, min(room - 0.04, 0.22), r.choice([(90, 130, 108), (70, 100, 84), (150, 110, 60)]))
                y += 0.075
            elif kind == "bowls":
                for j in range(3):
                    bowl(P, cx, y + 0.06, zt + j * 0.028, 0.06, 0.05, r.choice([(214, 210, 200), (80, 110, 140), (196, 186, 170)]))
                y += 0.15
            else:
                y += 0.09


def build_int_struct():
    P = Part("int_structure")
    dark = (66, 46, 32)
    # floors -------------------------------------------------------------------------------------------------------
    mbox(P, "EARTH", T, T, 0.3, W - T, Y_KAMACHI, Z_PL)                              # shop doma (packed earth)
    mbox(P, "EARTH", T, Y_KITCHEN, 0.3, W - T, D - T, Z_PL)                          # kitchen doma
    mbox(P, "FLOOR", T, Y_KAMACHI, 0.3, W - T, Y_KITCHEN, Z_RAISED, (150, 118, 84))  # raised floor (board)
    mbox(P, "WOOD", T, Y_KAMACHI - 0.09, Z_RAISED - 0.13, W - T, Y_KAMACHI + 0.05, Z_RAISED, (58, 38, 26))      # kamachi lip beam
    mbox(P, "WOOD", T, Y_KAMACHI - 0.05, Z_PL, W - T, Y_KAMACHI, Z_RAISED - 0.13, (98, 70, 46))                # step facing board
    mbox(P, "WOOD", T, Y_KITCHEN - 0.09, Z_RAISED - 0.13, W - T, Y_KITCHEN + 0.05, Z_RAISED, (58, 38, 26)) if False else None
    mbox(P, "WOOD", T, Y_KITCHEN, Z_PL, W - T, Y_KITCHEN + 0.05, Z_RAISED, (88, 62, 40))
    # upper floor slab with the stair opening (x 4.95..5.75, y 5.45..8.1) --------------------------------------------
    sx0, sx1, sy0, sy1 = 4.95, W - T, 5.45, 8.1
    for (a, b, c, d) in ((T, T, sx0, D - T), (sx0, T, W - T, sy0), (sx0, sy1, W - T, D - T)):
        mbox(P, "FLOOR", a, b, Z_CEIL_G, c, d, Z_FLOOR_U, (140, 110, 78))
    # ceiling beams below the upper floor, exposed and smoke-darkened
    for i, y in enumerate((1.0, 2.35, 3.7, 5.05, 6.4, 7.75)):
        xe = sx0 if (6.4 == y or 7.75 == y) else W - T
        mbox(P, "TIMBER", T, y - 0.1, 2.93, xe, y + 0.1, Z_CEIL_G, (62 - 4 * (i % 2), 44, 32))
    mbox(P, "TIMBER", T, 4.4, 2.86, W - T, 4.8, Z_CEIL_G, dark) if False else None
    # daikoku post, corner and wall posts (exposed timber on the earthen walls)
    mbox(P, "TIMBER", 2.86, 4.36, Z_PL, 3.14, 4.64, Z_CEIL_G, (54, 38, 28))
    mbox(P, "TIMBER", 2.84, 4.34, 2.9, 3.16, 4.66, Z_CEIL_G, (48, 34, 24))
    for y in (1.5, 3.0, 4.5, 6.0, 7.5):
        mbox(P, "TIMBER", T + 0.003, y - 0.06, Z_PL, T + 0.12, y + 0.06, Z_CEIL_G, (70, 50, 36))
        mbox(P, "TIMBER", W - T - 0.12, y - 0.06, Z_PL, W - T - 0.003, y + 0.06, Z_CEIL_G, (70, 50, 36))
        mbox(P, "TIMBER", T + 0.003, y - 0.06, Z_FLOOR_U, T + 0.12, y + 0.06, Z_CEIL_U, (70, 50, 36))
        mbox(P, "TIMBER", W - T - 0.12, y - 0.06, Z_FLOOR_U, W - T - 0.003, y + 0.06, Z_CEIL_U, (70, 50, 36))
    for x0_, x1_ in ((T + 0.004, T + 0.10), (W - T - 0.10, W - T - 0.004)):
        mbox(P, "TIMBER", x0_, T, 3.05, x1_, D - T, Z_CEIL_G, (60, 44, 32))
        mbox(P, "TIMBER", x0_, T, 5.85, x1_, D - T, Z_CEIL_U, (60, 44, 32))
        mbox(P, "TIMBER", x0_, T, 2.6, x1_, D - T, 2.68, (60, 44, 32))
    # upper ceiling (plank underside) + beams
    mbox(P, "WOOD", T, T, Z_CEIL_U, W - T, D - T, Z_CEIL_U + 0.05, (120, 96, 72))
    for y in (1.0, 2.35, 3.7, 5.05, 6.4, 7.75):
        mbox(P, "TIMBER", T, y - 0.08, 5.86, W - T, y + 0.08, Z_CEIL_U, (58, 42, 30))
    # upper partition at y=4.5: sill track, lintel, plaster above, two closed shoji on the left half, right half open ---
    yp = 4.5
    mbox(P, "WOOD", T, yp - 0.06, Z_FLOOR_U, W - T, yp + 0.06, Z_FLOOR_U + 0.05, (74, 52, 34))
    mbox(P, "TIMBER", T, yp - 0.06, 5.4, W - T, yp + 0.06, 5.52, (60, 44, 32))
    mbox(P, "WALLIN", T, yp - 0.05, 5.52, W - T, yp + 0.05, Z_CEIL_U, (255, 255, 255))
    shoji(P, 0.29, 1.62, Z_FLOOR_U + 0.05, 5.4, yp - 0.02, 0.4)
    shoji(P, 1.6, 2.94, Z_FLOOR_U + 0.05, 5.4, yp + 0.02, 0.4)
    mbox(P, "TIMBER", 2.94, yp - 0.06, Z_FLOOR_U + 0.05, 3.02, yp + 0.06, 5.4, (66, 48, 34))
    # ground-floor back shoji (raised room | kitchen), three closed, one ajar
    yb_ = Y_KITCHEN - 0.06
    mbox(P, "WOOD", T, yb_ - 0.05, Z_RAISED, 4.95, yb_ + 0.05, Z_RAISED + 0.04, (74, 52, 34))
    mbox(P, "TIMBER", T, yb_ - 0.05, 2.55, 4.95, yb_ + 0.05, 2.66, (60, 44, 32))
    mbox(P, "WALLIN", T, yb_ - 0.04, 2.66, 4.95, yb_ + 0.04, Z_CEIL_G, (255, 255, 255))
    for i, (a, b) in enumerate(((0.29, 1.5), (1.5, 2.72), (2.72, 3.9))):
        shoji(P, a + 0.01, b, Z_RAISED + 0.04, 2.55, yb_ + (0.025 if i % 2 else -0.025), 0.3, lit=(232, 210, 168))
    shoji(P, 3.9, 4.93, Z_RAISED + 0.04, 2.55, yb_ - 0.025, 0.0)
    # tokonoma in the upper front room (left wall): raised board, scroll, vase
    mbox(P, "WOOD", T, 1.3, Z_FLOOR_U, 0.9, 2.7, Z_FLOOR_U + 0.12, (78, 54, 36))
    mbox(P, "TIMBER", T, 1.25, 4.9, 0.32, 1.35, Z_CEIL_U - 0.4, (56, 40, 30))
    mbox(P, "TIMBER", T, 2.65, 4.9, 0.32, 2.75, Z_CEIL_U - 0.4, (56, 40, 30))
    mbox(P, "TIMBER", T, 1.25, Z_CEIL_U - 0.5, 0.42, 2.75, Z_CEIL_U - 0.4, (56, 40, 30))
    sc = mbox
    mpatch(P, "CLOTH", (T + 0.012, 1.55, 4.0), (0, 0.42, 0), (0, 0, 1.35), 1, 4, (206, 192, 158), vary=0.08, flip=False)
    mbox(P, "TIMBER", T + 0.01, 1.53, 5.34, T + 0.03, 2.0, 5.38, (50, 36, 26))
    mbox(P, "TIMBER", T + 0.01, 1.53, 3.98, T + 0.03, 2.0, 4.02, (50, 36, 26))
    n0 = P.nf()
    for zz, ln_ in ((4.9, 0.18), (4.55, 0.14), (4.3, 0.2)):                    # faint ink strokes on the scroll (fictional)
        mbox(P, "INK", T + 0.013, 1.68, zz, T + 0.016, 1.68 + ln_, zz + 0.05)
    P.paint(n0, (30, 26, 22))
    lathe(P, "INTERIOR", [(0.0, 0), (0.05, 0), (0.07, 0.08), (0.06, 0.18), (0.035, 0.24), (0.045, 0.27), (0.03, 0.27)], (0.62, 2.35, Z_FLOOR_U + 0.12), 10, (92, 108, 120))
    for a in range(5):                                                           # a few bare twigs
        mbeam(P, "WOOD", (0.62, 2.35, Z_FLOOR_U + 0.38), (0.62 + 0.08 * (a - 2) * 0.5, 2.35 + 0.05 * (a % 2), Z_FLOOR_U + 0.75 + 0.05 * a), 0.008, 0.008, (70, 52, 36))
    return P


def stair_build(P):
    n = 13
    y0 = 4.9
    x0, x1 = 4.95, W - T
    rise = (Z_FLOOR_U - Z_RAISED) / n
    run = (8.1 - y0) / n
    for i in range(n):
        zt = Z_RAISED + rise * (i + 1)
        ya = y0 + run * i
        mbox(P, "WOOD", x0, ya - 0.025, zt - 0.045, x1, ya + run + 0.01, zt, (128, 98, 66))                # tread with nosing
        mbox(P, "WOOD", x0 + 0.02, ya, zt - rise, x1, ya + 0.02, zt - 0.045, (100, 74, 50))               # riser
    p0 = (x0 + 0.03, y0 - 0.05, Z_RAISED - 0.05)
    p1 = (x0 + 0.03, 8.1 + 0.02, Z_FLOOR_U - 0.06)
    mbeam(P, "TIMBER", p0, p1, 0.05, 0.3, (72, 52, 38))                                                     # open stringer
    # handrail on the open side + newel posts + balusters
    hz = 0.82
    mbeam(P, "WOOD", (x0 + 0.02, y0 - 0.02, Z_RAISED + hz), (x0 + 0.02, 8.1 + 0.02, Z_FLOOR_U + hz), 0.045, 0.045, (96, 68, 44))
    for yy, zz in ((y0 - 0.02, Z_RAISED), (8.1 + 0.05, Z_FLOOR_U)):
        mbox(P, "WOOD", x0 - 0.02, yy - 0.04, zz - 0.0, x0 + 0.06, yy + 0.04, zz + hz + 0.08, (84, 58, 38))
    for i in range(1, n, 2):
        ya = y0 + run * i + run / 2
        zt = Z_RAISED + rise * (i + 1)
        mbox(P, "WOOD", x0 + 0.005, ya - 0.012, zt, x0 + 0.035, ya + 0.012, zt + hz - 0.02, (100, 72, 48))
    # guard along the stair opening on the upper floor
    mbeam(P, "WOOD", (x0 + 0.02, 5.45, Z_FLOOR_U + hz), (x0 + 0.02, 8.1, Z_FLOOR_U + hz), 0.04, 0.04, (96, 68, 44)) if False else None


def build_shop_props():
    P = Part("int_shop")
    r = RNG
    # left wall shelves (three bays), right wall shelves (two bays)
    lz = [1.0 + Z_PL - 0.5, 1.5, 1.95, 2.4]
    shelf_bay(P, 0.27, 0.62, 0.85, 2.05, [1.18, 1.62, 2.06, 2.5], 1, 11, ["jar", "box", "bolt", "tin", "bottle", "bowls"])
    shelf_bay(P, 0.27, 0.62, 2.05, 3.25, [1.18, 1.62, 2.06, 2.5], 1, 12, ["box", "bolt", "jar", "bowls", "tin", "bottle"])
    shelf_bay(P, 0.27, 0.62, 3.25, 4.45, [1.18, 1.62, 2.06, 2.5], 1, 13, ["bolt", "tin", "jar", "box", "bottle", "bowls"])
    shelf_bay(P, 5.38, 5.73, 1.0, 2.2, [1.18, 1.62, 2.06], 1, 14, ["tin", "jar", "box", "bottle", "bowls", "bolt"])
    shelf_bay(P, 5.38, 5.73, 2.2, 3.4, [1.18, 1.62, 2.06], 1, 15, ["box", "bolt", "bowls", "jar", "tin", "bottle"])
    # counter (choba) with goods and traces of use
    cx0, cx1, cy0, cy1 = 1.35, 3.55, 2.75, 3.3
    mbox(P, "WOOD", cx0, cy0, Z_PL, cx1, cy1, 1.3, (86, 60, 40))
    for i in range(4):                                                        # panelled front
        xa = cx0 + 0.06 + i * (cx1 - cx0 - 0.12) / 4
        mbox(P, "WOOD", xa + 0.02, cy0 - 0.012, 0.65, xa + (cx1 - cx0 - 0.12) / 4 - 0.02, cy0, 1.22, (100, 72, 48))
    mbox(P, "WOOD", cx0 - 0.04, cy0 - 0.05, 1.3, cx1 + 0.04, cy1 + 0.04, 1.345, (112, 80, 52))
    # abacus
    ax, ay = 1.75, 3.0
    mbox(P, "WOOD", ax, ay, 1.345, ax + 0.32, ay + 0.13, 1.362, (90, 64, 40))
    mbox(P, "WOOD", ax, ay, 1.362, ax + 0.32, ay + 0.012, 1.4, (90, 64, 40))
    mbox(P, "WOOD", ax, ay + 0.118, 1.362, ax + 0.32, ay + 0.13, 1.4, (90, 64, 40))
    for c in range(9):
        bx = ax + 0.02 + c * 0.032
        mbox(P, "IRON", bx - 0.0015, ay + 0.012, 1.376, bx + 0.0015, ay + 0.118, 1.38, (40, 36, 30))
        for b in range(3):
            mbox(P, "WOOD", bx - 0.012, ay + 0.02 + b * 0.03 + (0.03 if c % 3 == 0 else 0), 1.362, bx + 0.012,
                 ay + 0.04 + b * 0.03 + (0.03 if c % 3 == 0 else 0), 1.394, (48, 30, 20))
    # open ledger (daifukucho) with a brush lying across, inkstone and cup left out
    mbox(P, "INTERIOR", 2.3, 2.9, 1.345, 2.52, 3.2, 1.352, (30, 42, 60))
    mbox(P, "INTERIOR", 2.3, 2.9, 1.352, 2.41, 3.19, 1.364, (216, 206, 178))
    mbox(P, "INTERIOR", 2.41, 2.9, 1.352, 2.52, 3.19, 1.362, (208, 198, 170))
    mbeam(P, "WOOD", (2.62, 2.96, 1.36), (2.42, 3.16, 1.372), 0.012, 0.012, (76, 52, 34))
    mbox(P, "INTERIOR", 2.68, 3.05, 1.345, 2.82, 3.2, 1.372, (34, 32, 36))
    mbox(P, "INTERIOR", 2.9, 2.85, 1.345, 3.1, 2.97, 1.375, (70, 50, 34))
    teacup(P, 3.25, 3.0, 1.345, 1.0, (210, 204, 186), dregs=True)
    # scale (sao-bakari): beam + pan + weights
    mbeam(P, "WOOD", (3.35, 2.85, 1.7), (3.35, 3.25, 1.66), 0.014, 0.014, (60, 44, 30))
    mbox(P, "WOOD", 3.33, 2.85, 1.345, 3.37, 2.89, 1.7, (60, 44, 30))
    lathe(P, "IRON", [(0.0, 0), (0.06, 0.01), (0.075, 0.03), (0.0, 0.0)], (3.35, 3.2, 1.36), 10)
    # cash box (zenibako) and a lacquered tray
    mbox(P, "WOOD", 1.45, 2.85, 1.345, 1.68, 3.05, 1.46, (70, 48, 32))
    mbox(P, "IRON", 1.45, 2.84, 1.38, 1.68, 2.85, 1.42, (44, 40, 36))
    mbox(P, "INTERIOR", 3.05, 3.05, 1.345, 3.3, 3.22, 1.36, (110, 30, 26))
    # goods hung on the shop side of the counter: folded cloth stack
    for j in range(4):
        mbox(P, "CLOTH", 3.05 - 0.01 * (j % 2), 3.05, 1.36 + j * 0.03, 3.3, 3.22, 1.39 + j * 0.03, [(196, 188, 160), (54, 62, 84), (130, 88, 56), (100, 108, 88)][j])
    # behind the counter: stool (maruisu) with a cushion
    lathe(P, "WOOD", [(0.0, 0), (0.17, 0), (0.17, 0.02), (0.14, 0.05), (0.14, 0.34), (0.19, 0.36), (0.19, 0.4), (0.0, 0.4)], (2.4, 3.75, Z_PL), 12, (112, 84, 56))
    mpatch(P, "CLOTH", (2.4 - 0.17, 3.75 - 0.17, Z_PL + 0.41), (0.34, 0, 0), (0, 0.34, 0), 5, 5, (110, 60, 50), vary=0.05,
           disp=lambda s, t: (0, 0, 0.02 * math.sin(math.pi * s) * math.sin(math.pi * t)))
    # display table in the middle of the shop (tiered) with cloths, pots
    mbox(P, "WOOD", 1.3, 1.2, Z_PL, 2.8, 1.9, 0.98, (100, 72, 48))
    mbox(P, "WOOD", 1.3, 1.2, 0.98, 2.8, 1.9, 1.01, (124, 90, 60))
    mbox(P, "WOOD", 1.45, 1.4, 1.01, 2.65, 1.9, 1.24, (100, 72, 48))
    mbox(P, "WOOD", 1.45, 1.4, 1.24, 2.65, 1.9, 1.26, (124, 90, 60))
    for i, c in enumerate([(196, 188, 160), (54, 62, 84), (126, 76, 66), (100, 108, 88), (184, 160, 112)]):
        for j in range(3 + i % 2):
            mbox(P, "CLOTH", 1.5 + i * 0.24 + 0.005 * (j % 2), 1.45, 1.26 + j * 0.035, 1.5 + i * 0.24 + 0.2, 1.72, 1.29 + j * 0.035, c)
    for i in range(4):
        jar(P, 1.45 + i * 0.32, 1.35, 1.01, 0.08 + 0.01 * (i % 2), 0.16, [(86, 74, 60), (118, 96, 66), (60, 66, 62), (150, 132, 104)][i], lid=(60, 48, 38))
    # bay B display window stand (visible through the small panes)
    mbox(P, "WOOD", 3.3, 0.4, Z_PL, 4.42, 0.95, 1.12, (96, 68, 44))
    mbox(P, "WOOD", 3.28, 0.38, 1.12, 4.44, 0.97, 1.15, (120, 88, 58))
    mbox(P, "WOOD", 3.4, 0.55, 1.15, 4.3, 0.95, 1.36, (96, 68, 44))
    for i in range(6):
        bowl(P, 3.5 + i * 0.15, 0.7, 1.36, 0.055, 0.05, [(214, 210, 200), (80, 110, 140), (196, 186, 170)][i % 3])
        bowl(P, 3.5 + i * 0.15, 0.7, 1.41, 0.05, 0.045, [(80, 110, 140), (214, 210, 200), (196, 186, 170)][i % 3])
    for i in range(3):
        jar(P, 3.5 + i * 0.36, 0.45, 1.15, 0.09, 0.2, [(90, 80, 66), (130, 104, 70), (66, 72, 68)][i], lid=(56, 46, 36))
    for i in range(3):
        cloth_bolt(P, 3.36 + i * 0.36, 0.66, 1.15 + 0.0, 0.3, 0.05, [(54, 62, 84), (196, 188, 164), (132, 100, 72)][i], "x")
    # sake barrel with ladle, rice bales, sacks (traces of stock)
    barrel(P, 1.15, 4.1, Z_PL, 0.27, 0.76, (110, 82, 52))
    lathe(P, "WOOD", [(0.0, 0.0), (0.24, 0.0), (0.24, 0.02), (0.0, 0.02)], (1.15, 4.1, Z_PL + 0.76), 12, (140, 108, 72))
    mbeam(P, "WOOD", (1.3, 4.05, Z_PL + 0.78), (1.05, 4.2, Z_PL + 0.79), 0.018, 0.02, (156, 128, 84))
    lathe(P, "WOOD", [(0.0, 0), (0.03, 0.01), (0.04, 0.05), (0.0, 0.05)], (1.02, 4.22, Z_PL + 0.78), 8, (150, 120, 80))
    for i in range(3):
        tawara(P, 5.15, 3.75 + i * 0.32 - 0.32, Z_PL, 1.5708)
    for i in range(2):
        tawara(P, 5.15, 3.75 + i * 0.32 - 0.16, Z_PL + 0.3, 1.5708)
    tawara(P, 5.15, 3.75, Z_PL + 0.58, 1.5708 + 0.15)
    sack(P, 4.5, 4.05, Z_PL, 0.42, 0.34, 0.55, (150, 138, 112), 0.3)
    sack(P, 4.15, 3.7, Z_PL, 0.4, 0.34, 0.5, (128, 116, 90), -0.5)
    # hanging things: straw sandals on a line, lanterns, electric bulb, a coat on the post
    for i in range(6):
        sx = 1.6 + i * 0.33
        mcyl(P, "IRON", (sx, 2.35, 2.93), (sx, 2.35, 2.62), 0.003, 4, (60, 48, 36))
        n1 = P.nv()
        lathe(P, "CLOTH", [(0.0, -1.0), (0.6, -0.8), (0.92, -0.4), (1.0, 0.0), (0.9, 0.4), (0.6, 0.8), (0.0, 1.0)], (0, 0, 0), 8, (140, 116, 74))
        at(P, n1, (sx, 2.35, 2.5), 0.15 * (i % 3 - 1), (0.06, 0.014, 0.12))
    mcyl(P, "CLOTH", (1.5, 2.35, 2.72), (3.6, 2.35, 2.72), 0.006, 4, (150, 128, 84))
    chochin(P, 1.6, 3.7, 2.93, 0.13, 0.4, (238, 176, 96), 0.9)
    chochin(P, 4.4, 3.5, 2.93, 0.11, 0.34, (236, 172, 92), 0.85)
    bulb(P, 2.5, 3.3, 2.93, 0.4)
    n1 = P.nv()
    mbox(P, "IRON", 0.0, -0.03, 0.0, 0.12, 0.03, 0.03, (36, 30, 26))
    mpatch(P, "CLOTH", (0.0, -0.17, -0.02), (0.0, 0.34, 0), (0, 0, -0.62), 4, 8, (46, 60, 92), vary=0.05, flip=True,
           disp=lambda s, t: (0.05 + 0.03 * math.sin(s * 3.14) * t, 0, 0), shade=lambda s, t: 1.0 + 0.15 * math.cos(s * 9))
    at(P, n1, (3.14, 4.3, 2.35))
    # bench inside the shop by bay A, a broom by the counter, an abandoned tea tray on the step
    mbox(P, "WOOD", 0.9, 0.55, 0.85, 2.05, 0.9, 0.89, (120, 92, 62))
    for lx in (0.96, 1.99):
        mbox(P, "WOOD", lx - 0.03, 0.6, Z_PL, lx + 0.03, 0.85, 0.85, (100, 76, 50))
    mbox(P, "INTERIOR", 1.15, 0.6, 0.89, 1.65, 0.85, 0.895, (110, 30, 26))
    teacup(P, 1.3, 0.72, 0.895, 1.0, (214, 208, 190))
    teacup(P, 1.5, 0.75, 0.895, 1.0, (214, 208, 190), dregs=True)
    lathe(P, "INTERIOR", [(0.0, 0), (0.07, 0), (0.08, 0.05), (0.06, 0.11), (0.03, 0.14), (0.05, 0.16), (0.0, 0.16)], (1.55, 0.72, 0.895), 10, (206, 200, 182))
    # umbrella barrel by the door: three oiled-paper umbrellas, one leaning out
    barrel(P, 1.02, 1.5, Z_PL, 0.2, 0.55, (108, 80, 52))
    for k, (rgb, tilt, dx) in enumerate((((150, 116, 70), 0.08, -0.06), ((118, 70, 56), -0.12, 0.05), ((62, 72, 92), 0.22, 0.0))):
        n1 = P.nv()
        lathe(P, "CLOTH", [(0.0, 0.98), (0.03, 0.93), (0.06, 0.7), (0.06, 0.4), (0.03, 0.05), (0.0, 0.0)], (0, 0, 0), 8, rgb)
        mcyl(P, "WOOD", (0, 0, 0.0), (0, 0, -0.35), 0.008, 5, (120, 90, 60))
        P.xform(n1, Matrix.Translation((1.02 + dx, 1.5 + 0.02 * k, Z_PL + 0.5)) @ Matrix.Rotation(tilt, 4, "Y") @ Matrix.Rotation(k * 1.3, 4, "Z"))
    # pendulum clock on the daikoku post (case, dial, hands)
    mbox(P, "WOOD", 2.9, 4.29, 1.7, 3.1, 4.36, 2.28, (74, 48, 30))
    lathe(P, "INTERIOR", [(0.0, 0.0), (0.075, 0.0), (0.078, 0.004), (0.0, 0.004)], (3.0, 4.29, 2.1), 16, (216, 208, 184))
    n1 = P.nv()
    n0 = P.nf()
    lathe(P, "INTERIOR", [(0.0, 0.0), (0.075, 0.0), (0.078, 0.004), (0.0, 0.004)], (0, 0, 0), 16, (216, 208, 184))
    P.xform(n1, Matrix.Translation((3.0, 4.29, 2.1)) @ Matrix.Rotation(math.pi / 2, 4, "X"))
    mbox(P, "IRON", 2.995, 4.285, 2.1, 3.005, 4.29, 2.17, (26, 22, 20))
    mbox(P, "IRON", 3.0, 4.285, 2.095, 3.05, 4.29, 2.105, (26, 22, 20))
    mbox(P, "WOOD", 2.93, 4.29, 1.72, 3.07, 4.31, 1.98, (60, 40, 26))
    lathe(P, "INTERIOR", [(0.0, 0.0), (0.04, 0.0), (0.04, 0.006), (0.0, 0.006)], (3.0, 4.28, 1.85), 12, (150, 122, 60))
    # hanging price tags board (blank, fictional) on the right wall
    mbox(P, "WOOD", 5.7, 3.7, 1.85, 5.74, 4.25, 2.45, (110, 84, 56))
    for i in range(8):
        yy = 3.73 + i * 0.065
        mbox(P, "INTERIOR", 5.665, yy, 1.95 - 0.04 * (i % 3), 5.7, yy + 0.045, 2.35 - 0.04 * (i % 3), (204, 190, 158))
        mbox(P, "INK", 5.662, yy + 0.012, 2.0 - 0.04 * (i % 3), 5.665, yy + 0.02, 2.28 - 0.04 * (i % 3), (40, 30, 24))
    # geta left on the step, one pair knocked over
    for gx, gy, rot, fl in ((1.9, 4.25, 0.3, 0), (2.2, 4.3, -0.2, 1)):
        n1 = P.nv()
        mbox(P, "WOOD", -0.05, -0.1, 0.05, 0.05, 0.1, 0.075, (150, 122, 84))
        mbox(P, "WOOD", -0.05, -0.07, 0.0, 0.05, -0.04, 0.05, (110, 86, 58))
        mbox(P, "WOOD", -0.05, 0.05, 0.0, 0.05, 0.08, 0.05, (110, 86, 58))
        mbox(P, "CLOTH", -0.005, -0.09, 0.075, 0.005, 0.09, 0.083, (110, 40, 36))
        M = Matrix.Translation((gx, gy, Z_PL + (0.06 if fl else 0.0))) @ Matrix.Rotation(rot, 4, "Z") @ (Matrix.Rotation(math.pi, 4, "Y") if fl else Matrix.Identity(4))
        P.xform(n1, M)
    return P


def build_room_g():
    """Ground floor: raised tatami room, kitchen, stair."""
    P = Part("int_ground_back")
    # tatami block 2 x 3 mats: x 0.75..4.35, y 4.75..7.45; boards elsewhere
    for row in range(3):
        for col in range(2):
            tatami_mat(P, 0.75 + col * 1.8, 4.75 + row * 0.9, Z_RAISED)
    # low table with tea things, three zabuton, hibachi with kettle, andon
    n1 = P.nv()
    mbox(P, "WOOD", -0.45, -0.3, 0.27, 0.45, 0.3, 0.3, (84, 40, 30))
    for sx in (-1, 1):
        for sy in (-1, 1):
            mbox(P, "WOOD", sx * 0.4 - 0.03, sy * 0.25 - 0.03, 0.0, sx * 0.4 + 0.03, sy * 0.25 + 0.03, 0.27, (70, 34, 26))
    at(P, n1, (2.55, 6.05, Z_RAISED + 0.055))
    teacup(P, 2.4, 5.95, Z_RAISED + 0.355, 1.0, (214, 208, 190), dregs=True)
    teacup(P, 2.85, 6.15, Z_RAISED + 0.355, 1.0, (214, 208, 190))
    lathe(P, "IRON", [(0.0, 0), (0.05, 0), (0.07, 0.04), (0.07, 0.08), (0.04, 0.11), (0.05, 0.12), (0.0, 0.12)], (2.6, 6.1, Z_RAISED + 0.355), 10, (60, 60, 64))
    mbox(P, "INTERIOR", 2.15, 6.2, Z_RAISED + 0.355, 2.35, 6.38, Z_RAISED + 0.365, (206, 196, 168))
    for (zx, zy, rot) in ((1.75, 6.1, 1.6), (3.35, 6.05, -1.5), (2.5, 6.85, 3.0)):
        zabuton(P, zx, zy, Z_RAISED + 0.055, rot, [(112, 66, 58), (60, 68, 88), (108, 98, 64)][int(zx * 3) % 3])
    n1 = P.nv()                                                                                       # hibachi
    lathe(P, "IRON", [(0.0, 0.02), (0.14, 0.02), (0.2, 0.1), (0.2, 0.32), (0.22, 0.34), (0.22, 0.36), (0.19, 0.36), (0.0, 0.3)], (0, 0, 0), 14, (98, 78, 52))
    lathe(P, "INTERIOR", [(0.0, 0.3), (0.19, 0.3), (0.19, 0.31), (0.0, 0.31)], (0, 0, 0), 12, (140, 132, 122))
    lathe(P, "INTERIOR", [(0.0, 0.31), (0.06, 0.312), (0.05, 0.34), (0.0, 0.345)], (0.05, 0.02, 0), 8, (255, 120, 40), 0.9)       # embers
    mcyl(P, "IRON", (-0.1, -0.05, 0.31), (-0.12, -0.05, 0.44), 0.008, 5, (30, 28, 26))
    mcyl(P, "IRON", (0.1, -0.05, 0.31), (0.12, -0.05, 0.44), 0.008, 5, (30, 28, 26))
    mcyl(P, "IRON", (0.0, 0.1, 0.31), (0.0, 0.12, 0.44), 0.008, 5, (30, 28, 26))
    at(P, n1, (1.25, 5.55, Z_RAISED + 0.055))
    kettle(P, 1.25, 5.55, Z_RAISED + 0.055 + 0.44, 1.0)
    andon(P, 3.85, 7.1, Z_RAISED + 0.055, 1.0, 0.4)
    tansu(P, 0.3, 6.25, Z_RAISED, 0.5, 1.05, 0.95, "+y") if False else None
    # tansu chest on the left border (front faces +x): build sideways
    n1 = P.nv()
    tansu(P, 0.0, 0.0, 0.0, 1.05, 0.45, 1.05, "+y")
    at(P, n1, (0.27, 7.45, Z_RAISED), -1.5708)
    # sewing box + folded kimono on the tatami
    mbox(P, "WOOD", 3.6, 5.2, Z_RAISED + 0.055, 3.9, 5.42, Z_RAISED + 0.13, (110, 72, 44))
    mbox(P, "CLOTH", 3.62, 5.22, Z_RAISED + 0.13, 3.88, 5.4, Z_RAISED + 0.16, (128, 60, 74))
    for j in range(3):
        mbox(P, "CLOTH", 3.5 + 0.01 * j, 4.9 - 0.0, Z_RAISED + 0.055 + j * 0.035, 3.95 + 0.01 * j, 5.1, Z_RAISED + 0.09 + j * 0.035,
             [(64, 74, 100), (196, 176, 140), (110, 84, 60)][j])
    # ---- kitchen (rear doma) ----
    kz = Z_PL
    mbox(P, "WALLIN", 0.27, 7.95, kz, 1.65, 8.73, 0.98, (255, 255, 255))                            # kamado: earthen stove
    mbox(P, "TIMBER", 0.27, 7.92, 0.98, 1.68, 8.0, 1.02, (52, 38, 28))
    for i, px in enumerate((0.7, 1.25)):
        lathe(P, "IRON", [(0.0, 0.0), (0.16, 0.0), (0.2, 0.06), (0.21, 0.16), (0.19, 0.2), (0.0, 0.2)], (px, 8.34, 0.98), 14, (46, 44, 44))
        lathe(P, "WOOD", [(0.0, 0.2), (0.21, 0.2), (0.2, 0.22), (0.05, 0.27), (0.0, 0.28)], (px, 8.34, 0.98), 14, (128, 96, 60))
    mbox(P, "WALLIN", 0.27, 8.3, 0.98, 1.65, 8.73, 2.5, (255, 255, 255)) if False else None
    for i in range(6):                                                                              # firewood beside the stove
        mcyl(P, "WOOD", (1.85, 8.0 + i * 0.1 * 0.0 + 0.09 * (i % 3), kz + 0.05 + 0.08 * (i // 3) * 0 + 0.09 * (i // 3)), (2.35, 8.0 + 0.09 * (i % 3), kz + 0.05 + 0.09 * (i // 3)), 0.045, 6, (120, 92, 60))
    n1 = P.nv()                                                                                       # water jar with lid
    lathe(P, "INTERIOR", [(0.0, 0), (0.2, 0), (0.29, 0.15), (0.32, 0.4), (0.26, 0.65), (0.2, 0.74), (0.22, 0.78)], (0, 0, 0), 14, (98, 78, 60))
    lathe(P, "WOOD", [(0.0, 0.78), (0.24, 0.78), (0.22, 0.8), (0.0, 0.84)], (0, 0, 0), 14, (150, 116, 76))
    at(P, n1, (2.75, 8.35, kz))
    mbox(P, "WOOD", 3.05, 8.15, kz, 4.35, 8.73, 0.92, (84, 60, 40))                                # sink (nagashi)
    mbox(P, "IRON", 3.2, 8.25, 0.92, 4.2, 8.63, 0.94, (86, 88, 84))
    lathe(P, "WOOD", [(0.0, 0), (0.12, 0), (0.15, 0.1), (0.14, 0.24)], (3.5, 7.95, kz), 12, (132, 104, 72))
    for k, zz in enumerate((1.75, 2.15)):                                                          # crockery shelves
        mbox(P, "WOOD", 2.3, 8.45, zz, 4.45, 8.73, zz + 0.03, (100, 72, 48))
        for i in range(7):
            bowl(P, 2.42 + i * 0.29, 8.6, zz + 0.03, 0.07 + 0.01 * (i % 2), 0.06, [(214, 210, 200), (80, 110, 140), (196, 186, 170), (150, 130, 96)][(i + k) % 4])
            bowl(P, 2.42 + i * 0.29, 8.6, zz + 0.09, 0.065, 0.055, [(80, 110, 140), (214, 210, 200), (150, 130, 96)][(i + k) % 3])
    for i in range(4):                                                                              # cooking tools on hooks
        mcyl(P, "IRON", (2.5 + i * 0.4, 8.73, 2.55), (2.5 + i * 0.4, 8.66, 2.52), 0.006, 4, (40, 36, 32))
        lathe(P, "IRON", [(0.0, 0), (0.05, 0.0), (0.06, 0.03), (0.0, 0.03)], (2.5 + i * 0.4, 8.6, 2.15), 8, (70, 66, 62))
    # stair
    stair_build(P)
    # under-stair storage crate and baskets
    crate(P, 5.35, 7.85, kz, 0.55, 0.5, 0.42, (142, 116, 80), 0.2)
    lathe(P, "WOOD", [(0.0, 0), (0.2, 0.0), (0.26, 0.1), (0.28, 0.24), (0.26, 0.26)], (5.2, 8.35, kz), 12, (176, 152, 96))
    return P


def build_room_u():
    P = Part("int_upper")
    z = Z_FLOOR_U
    # front room tatami: 3 x 4 mats (x 0.3..5.7, y 0.55..4.15); back room: 2 x 3 (x 0.3..3.9, y 4.75..7.45)
    for row in range(4):
        for col in range(3):
            tatami_mat(P, 0.3 + col * 1.8, 0.55 + row * 0.9, z)
    for row in range(3):
        for col in range(2):
            tatami_mat(P, 0.3 + col * 1.8, 4.75 + row * 0.9, z)
    zt = z + 0.055
    # low table (chabudai) with tea set, cups (one half full), zabuton, hibachi, andon
    n1 = P.nv()
    mbox(P, "WOOD", -0.5, -0.32, 0.29, 0.5, 0.32, 0.32, (86, 40, 30))
    for sx in (-1, 1):
        for sy in (-1, 1):
            mbox(P, "WOOD", sx * 0.44 - 0.03, sy * 0.26 - 0.03, 0.0, sx * 0.44 + 0.03, sy * 0.26 + 0.03, 0.29, (70, 34, 26))
    at(P, n1, (3.0, 2.3, zt))
    tz = zt + 0.32
    lathe(P, "INTERIOR", [(0.0, 0), (0.05, 0), (0.075, 0.03), (0.08, 0.07), (0.06, 0.1), (0.03, 0.11), (0.0, 0.115)], (2.85, 2.25, tz), 12, (108, 96, 78))     # teapot
    mbeam(P, "INTERIOR", (2.92, 2.25, tz + 0.06), (2.99, 2.25, tz + 0.1), 0.018, 0.012, (108, 96, 78))
    for a in range(7):
        t0, t1 = math.pi * a / 7, math.pi * (a + 1) / 7
        cyl(P, "INTERIOR", (2.85 + 0.06 * math.cos(t0), 2.25, tz + 0.1 + 0.05 * math.sin(t0)), (2.85 + 0.06 * math.cos(t1), 2.25, tz + 0.1 + 0.05 * math.sin(t1)), 0.006, 4, caps=(False, False), smooth=False)
    teacup(P, 3.15, 2.05, tz, 1.0, (214, 208, 190), dregs=True)
    teacup(P, 3.25, 2.4, tz, 1.0, (214, 208, 190))
    mbox(P, "INTERIOR", 2.6, 2.4, tz, 2.84, 2.55, tz + 0.012, (176, 60, 40))
    for k in range(3):
        lathe(P, "INTERIOR", [(0.0, 0), (0.03, 0), (0.034, 0.012), (0.0, 0.02)], (2.7 + 0.02 * k, 2.47, tz + 0.012 + 0.012 * k), 8, (226, 208, 166))
    zabuton(P, 2.9, 1.5, zt, 0.1, (60, 68, 88))
    zabuton(P, 4.1, 2.35, zt, 1.5, (112, 66, 58))
    zabuton(P, 1.85, 2.4, zt, -1.3, (108, 98, 64))
    andon(P, 5.15, 1.15, zt, 1.15, 0.5)
    n1 = P.nv()                                                                                       # hibachi
    lathe(P, "IRON", [(0.0, 0.02), (0.13, 0.02), (0.19, 0.1), (0.19, 0.3), (0.21, 0.32), (0.21, 0.34), (0.18, 0.34), (0.0, 0.28)], (0, 0, 0), 14, (110, 86, 58))
    lathe(P, "INTERIOR", [(0.0, 0.28), (0.18, 0.28), (0.18, 0.29), (0.0, 0.29)], (0, 0, 0), 12, (150, 142, 130))
    lathe(P, "INTERIOR", [(0.0, 0.29), (0.05, 0.292), (0.04, 0.32), (0.0, 0.325)], (-0.04, 0.03, 0), 8, (255, 120, 40), 0.9)
    at(P, n1, (4.6, 3.1, zt))
    # sewing/laundry: kimono on a rack, folded futon stack, box of things
    n1 = P.nv()
    mbox(P, "WOOD", -0.42, -0.02, 0.0, -0.38, 0.02, 1.35, (110, 78, 48))
    mbox(P, "WOOD", 0.38, -0.02, 0.0, 0.42, 0.02, 1.35, (110, 78, 48))
    mbox(P, "WOOD", -0.44, -0.02, 1.3, 0.44, 0.02, 1.34, (110, 78, 48))
    mbox(P, "WOOD", -0.42, -0.14, 0.0, -0.38, 0.14, 0.03, (100, 70, 44))
    mbox(P, "WOOD", 0.38, -0.14, 0.0, 0.42, 0.14, 0.03, (100, 70, 44))
    mpatch(P, "CLOTH", (-0.38, -0.015, 1.31), (0.76, 0, 0), (0, 0, -1.0), 6, 8, (122, 74, 88), vary=0.04, flip=True,
           disp=lambda s, t: (0, -0.02 * math.sin(s * 12) * t - 0.02, 0), shade=lambda s, t: 0.85 + 0.2 * math.cos(s * 11))
    mpatch(P, "CLOTH", (-0.38, 0.015, 1.31), (0.76, 0, 0), (0, 0, -1.0), 6, 8, (98, 60, 74), vary=0.04, flip=False,
           disp=lambda s, t: (0, 0.02 * math.sin(s * 12) * t + 0.02, 0))
    for sx, sgn in ((-0.38, -1), (0.38, 1)):
        mpatch(P, "CLOTH", (sx, -0.02, 1.31), (sgn * 0.42, 0, 0), (0, 0, -0.58), 3, 4, (122, 74, 88), vary=0.04,
               disp=lambda s, t: (0, -0.02 - 0.03 * t, -0.05 * s), flip=(sgn > 0))
    at(P, n1, (4.3, 8.3, z), 3.1416)
    # futon stack (folded quilts) and pillow
    for j, (c, dx, dy) in enumerate([((70, 84, 110), 0.0, 0.0), ((150, 90, 70), 0.03, -0.02), ((186, 176, 146), -0.02, 0.02), ((84, 96, 74), 0.02, 0.0)]):
        mpatch(P, "CLOTH", (2.4 + dx, 7.65 + dy, z + j * 0.13), (1.0, 0, 0), (0, 0.95, 0), 6, 6, c, vary=0.05,
               disp=lambda s, t: (0, 0, 0.05 * math.sin(math.pi * s) * math.sin(math.pi * t)))
        mbox(P, "CLOTH", 2.4 + dx, 7.65 + dy, z + j * 0.13 - 0.0, 3.4 + dx, 8.6 + dy, z + j * 0.13 + 0.115, c)
    mbox(P, "CLOTH", 3.45, 7.8, z, 3.75, 8.3, z + 0.14, (206, 196, 168))
    tansu(P, 0.6, 8.25, z, 1.2, 0.46, 1.1, "-y")
    tansu(P, 1.85, 8.25, z, 0.7, 0.46, 0.8, "-y")
    n1 = P.nv()                                                                                       # small writing table + open book
    mbox(P, "WOOD", -0.3, -0.2, 0.26, 0.3, 0.2, 0.29, (86, 40, 30))
    for sx in (-1, 1):
        for sy in (-1, 1):
            mbox(P, "WOOD", sx * 0.26 - 0.02, sy * 0.16 - 0.02, 0.0, sx * 0.26 + 0.02, sy * 0.16 + 0.02, 0.26, (70, 34, 26))
    mbox(P, "INTERIOR", -0.1, -0.14, 0.29, 0.1, 0.1, 0.295, (206, 198, 172))
    mbox(P, "INTERIOR", -0.1, -0.14, 0.295, 0.0, 0.1, 0.304, (216, 208, 180))
    mbox(P, "INTERIOR", 0.0, -0.14, 0.295, 0.1, 0.1, 0.302, (210, 202, 174))
    mbox(P, "INTERIOR", 0.16, 0.0, 0.29, 0.26, 0.14, 0.31, (34, 32, 36))
    at(P, n1, (3.2, 5.6, zt))
    andon(P, 1.0, 6.9, zt, 1.0, -0.3)
    zabuton(P, 3.2, 5.05, zt, 0.4, (108, 98, 64))
    # hanging lantern and bulb
    chochin(P, 3.0, 2.3, Z_CEIL_U - 0.02, 0.14, 0.42, (238, 178, 98), 0.9)
    bulb(P, 2.0, 6.2, Z_CEIL_U - 0.02, 0.5)
    return P


def build_window_dressing():
    """Curtains, blind, sill objects behind the four upper windows (y just behind the sashes)."""
    P = Part("int_windows")
    zb, zt = Z_SILL, Z_HEAD_U
    y = 0.29
    # A1: half-drawn cotton curtain with real folds on a rod
    x0 = WINDOWS[0]["x0"]
    mcyl(P, "IRON", (x0 - 0.05, y - 0.02, zt - 0.07), (x0 + 1.05, y - 0.02, zt - 0.07), 0.011, 6, (30, 24, 20))
    mpatch(P, "CLOTH", (x0 + 0.0, y, zt - 0.08), (0.55, 0, 0), (0, 0, -1.2), 22, 6, (200, 192, 168), vary=0.05,
           disp=lambda s, t: (0, 0.02 * math.sin(s * 2 * math.pi * 4.5) * (0.4 + 0.6 * t) + 0.012 * s, 0), flip=True,
           shade=lambda s, t: 0.72 + 0.28 * math.cos(s * 2 * math.pi * 4.5 + 0.6))
    # A2: bamboo blind, rolled up a third of the way, cord tail
    x0 = WINDOWS[1]["x0"]
    mcyl(P, "WOOD", (x0 + 0.02, y, zt - 0.17), (x0 + 0.98, y, zt - 0.17), 0.045, 8, (150, 120, 70))
    mpatch(P, "WOOD", (x0 + 0.02, y, zt - 0.2), (0.96, 0, 0), (0, 0, -0.62), 24, 1, (170, 140, 86), vary=0.35, flip=True, smooth=False)
    mcyl(P, "CLOTH", (x0 + 0.12, y - 0.01, zt - 0.14), (x0 + 0.12, y - 0.01, zt - 0.5), 0.004, 4, (190, 176, 140))
    # B1: indigo-check cloth pulled to one side and tied, small plant pot on the sill
    x0 = WINDOWS[2]["x0"]
    mcyl(P, "WOOD", (x0 - 0.03, y - 0.02, zt - 0.07), (x0 + 0.88, y - 0.02, zt - 0.07), 0.01, 6, (60, 44, 30))
    mpatch(P, "CLOTH", (x0 + 0.0, y, zt - 0.08), (0.28, 0, 0), (0, 0, -1.1), 14, 6, (68, 82, 112), vary=0.05, flip=True,
           disp=lambda s, t: (0, 0.03 * math.sin(s * 2 * math.pi * 3) * (0.5 + 0.5 * t), 0), shade=lambda s, t: 0.75 + 0.25 * math.cos(s * 2 * math.pi * 3))
    lathe(P, "INTERIOR", [(0.0, 0), (0.05, 0), (0.07, 0.11), (0.075, 0.12), (0.0, 0.12)], (x0 + 0.6, 0.42, zb + 0.06), 10, (160, 96, 64))
    for a in range(6):
        mbeam(P, "INTERIOR", (x0 + 0.6, 0.42, zb + 0.16), (x0 + 0.6 + 0.09 * math.cos(a * 1.05), 0.42 + 0.09 * math.sin(a * 1.05), zb + 0.38), 0.03, 0.006, (70, 110, 60))
    # B2: sash raised: a lit lantern glow behind, a cotton cloth drying over a pole
    x0 = WINDOWS[3]["x0"]
    mcyl(P, "WOOD", (x0 - 0.02, y + 0.04, zt - 0.22), (x0 + 0.92, y + 0.04, zt - 0.22), 0.013, 6, (120, 92, 60))
    mpatch(P, "CLOTH", (x0 + 0.05, y + 0.02, zt - 0.22), (0.8, 0, 0), (0, 0, -0.55), 12, 5, (216, 208, 186), vary=0.05, flip=True,
           disp=lambda s, t: (0, 0.02 * math.sin(s * 9) * t, 0))
    return P


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



# ==== MATERIALS (review renders use procedural nodes + CC0 images by path; the GLB carries constant colours) ============
DEFAULT_COL = {"TIMBER": (96, 74, 56), "WOOD": (150, 116, 80), "FLOOR": (150, 118, 84), "TATAMI": (136, 126, 94), "CLOTH": (150, 140, 120),
               "FRAME": (150, 144, 120), "SIGN": (140, 120, 90), "CANVAS": (200, 190, 160), "INK": (128, 30, 22), "IRON": (36, 34, 34),
               "ROOF": (58, 64, 72), "SHOJI": (236, 222, 190), "INTERIOR": (26, 20, 15)}


def col_of(nt):
    return N(nt, "ShaderNodeVertexColor", layer_name="Col").outputs["Color"]


def ao_grime(nt, dist=0.22):
    n = N(nt, "ShaderNodeAmbientOcclusion")
    n.samples = 6
    n.inputs["Distance"].default_value = dist
    return maths(nt, "SUBTRACT", 1.0, n.outputs["AO"], True)


def stretch_noise(nt, scale, sx=1.0, sy=1.0, sz=1.0, detail=5.0, rough=0.55):
    g = N(nt, "ShaderNodeNewGeometry")
    mp = N(nt, "ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (sx, sy, sz)
    nt.links.new(g.outputs["Position"], mp.inputs["Vector"])
    n = N(nt, "ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
    return n.outputs["Fac"]


def grain(nt, sx=4.0, sy=60.0, detail=4.0):
    n = N(nt, "ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = 1.0
    n.inputs["Detail"].default_value = detail
    nt.links.new(uvvec(nt, (sx, sy, 1.0)), n.inputs["Vector"])
    return n.outputs["Fac"]


def make_render_materials():
    Mx = mixc
    # ---- PLASTER: lime plaster (CC0 Plaster007), uneven tone, vertical run-off streaks, AO grime, chips ----
    nt = nt_of(MATS["PLASTER"])
    vec = uvvec(nt, (0.8, 0.8, 0.8))
    tc = imgtex(nt, "Plaster007", "Plaster007_2K-JPG_Color.jpg", vec)
    tr = imgtex(nt, "Plaster007", "Plaster007_2K-JPG_Roughness.jpg", vec, True)
    tn = imgtex(nt, "Plaster007", "Plaster007_2K-JPG_NormalGL.jpg", vec, True)
    nm = N(nt, "ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = 0.4
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    big = stretch_noise(nt, 0.55, 1, 1, 0.8, 3)
    mid = stretch_noise(nt, 2.2, 1.6, 1.6, 0.9, 5)
    streak = stretch_noise(nt, 6.0, 3.0, 3.0, 0.12, 4)
    base = Mx(nt, tc.outputs["Color"], (0.76, 0.74, 0.67, 1), 1.0, "MULTIPLY")
    base = Mx(nt, base, (1.18, 1.14, 1.04, 1), maths(nt, "MULTIPLY", big, 0.7), "MULTIPLY")
    base = Mx(nt, base, (0.72, 0.72, 0.68, 1), maths(nt, "MULTIPLY", mid, 0.4), "MULTIPLY")
    r, g, b = wear_ch(nt)
    grime = ao_grime(nt, 0.3)
    dirt = dirt_fac(nt, r, mid, 1.0, 0.35)
    dirt = maths(nt, "ADD", dirt, maths(nt, "MULTIPLY", grime, 0.55), True)
    base = Mx(nt, base, (0.13, 0.105, 0.075, 1), dirt)
    base = Mx(nt, base, (0.2, 0.19, 0.16, 1), maths(nt, "MULTIPLY", maths(nt, "GREATER_THAN", streak, 0.6), 0.35))
    chip = maths(nt, "MULTIPLY", g, maths(nt, "GREATER_THAN", mid, 0.45), True)
    base = Mx(nt, base, (0.36, 0.25, 0.17, 1), maths(nt, "MULTIPLY", chip, 0.8))
    base = Mx(nt, base, col_of(nt), 1.0, "MULTIPLY")
    princ(nt, base, tr.outputs["Color"], normal=nm.outputs["Normal"], spec=0.25)

    # ---- WALLIN: earthen / sand-plaster inner walls (Plaster007 tinted darker), soot up high ----
    nt = nt_of(MATS["WALLIN"])
    vec = uvvec(nt, (0.9, 0.9, 0.9))
    tc = imgtex(nt, "Plaster007", "Plaster007_2K-JPG_Color.jpg", vec)
    tn = imgtex(nt, "Plaster007", "Plaster007_2K-JPG_NormalGL.jpg", vec, True)
    nm = N(nt, "ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = 0.6
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    big = stretch_noise(nt, 0.7, 1, 1, 0.6, 3)
    r, g, b = wear_ch(nt)
    base = Mx(nt, tc.outputs["Color"], (0.50, 0.38, 0.26, 1), 1.0, "MULTIPLY")
    base = Mx(nt, base, (1.3, 1.2, 1.05, 1), maths(nt, "MULTIPLY", big, 0.5), "MULTIPLY")
    base = Mx(nt, base, (0.05, 0.04, 0.03, 1), maths(nt, "ADD", dirt_fac(nt, r, big, 0.9, 0.2), maths(nt, "MULTIPLY", ao_grime(nt, 0.3), 0.6), True))
    princ(nt, base, 0.92, normal=nm.outputs["Normal"], spec=0.2)

    # ---- STONE ----
    nt = nt_of(MATS["STONE"])
    vec = uvvec(nt, (0.9, 0.9, 0.9))
    tc = imgtex(nt, ".", "large_sandstone_blocks_diff_2k.jpg", vec)
    tn = imgtex(nt, ".", "large_sandstone_blocks_nor_gl_2k.jpg", vec, True)
    nm = N(nt, "ShaderNodeNormalMap")
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    noise = world_noise(nt, 1.5, 5)
    r, g, b = wear_ch(nt)
    base = Mx(nt, tc.outputs["Color"], (0.58, 0.56, 0.52, 1), 1.0, "MULTIPLY")
    base = Mx(nt, base, (0.06, 0.05, 0.04, 1), maths(nt, "ADD", dirt_fac(nt, r, noise, 1.1), maths(nt, "MULTIPLY", ao_grime(nt, 0.2), 0.5), True))
    base = Mx(nt, base, (0.2, 0.26, 0.17, 1), maths(nt, "MULTIPLY", maths(nt, "GREATER_THAN", noise, 0.62), maths(nt, "SUBTRACT", 1.0, maths(nt, "MULTIPLY", r, 2.0, True)), True) if False else 0.0)
    princ(nt, base, 0.85, normal=nm.outputs["Normal"])

    # ---- TIMBER / WOOD: grain along U, colour from Col, silvered by sun/rain (weathering on exposed grain) ----
    for nm_, rough in (("TIMBER", 0.66), ("WOOD", 0.6)):
        nt = nt_of(MATS[nm_])
        gr = grain(nt, 4.0, 70.0)
        cc = col_of(nt)
        r, g, b = wear_ch(nt)
        noise = world_noise(nt, 3.0, 4)
        base = Mx(nt, cc, (1.15, 1.1, 1.05, 1), maths(nt, "MULTIPLY", gr, 1.0), "MULTIPLY")
        base = Mx(nt, base, (0.24, 0.21, 0.18, 1), maths(nt, "MULTIPLY", maths(nt, "GREATER_THAN", noise, 0.5), 0.12), "MIX")
        base = Mx(nt, base, (0.03, 0.026, 0.022, 1), maths(nt, "ADD", dirt_fac(nt, r, noise, 0.8), maths(nt, "MULTIPLY", ao_grime(nt, 0.12), 0.28), True))
        base = Mx(nt, base, (0.32, 0.2, 0.11, 1), maths(nt, "MULTIPLY", g, 0.5))
        bump = N(nt, "ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.25
        bump.inputs["Distance"].default_value = 0.01
        nt.links.new(gr, bump.inputs["Height"])
        princ(nt, base, rough, normal=bump.outputs["Normal"])

    # ---- FLOOR: boards (planks along Y), gaps + wear ----
    nt = nt_of(MATS["FLOOR"])
    vec = uvvec(nt, (1.0, 1.0, 1.0))
    br = N(nt, "ShaderNodeTexBrick")
    br.offset = 0.0
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Brick Width"].default_value = 0.17
    br.inputs["Row Height"].default_value = 3.0
    br.inputs["Mortar Size"].default_value = 0.006
    br.inputs["Color1"].default_value = (0.9, 0.85, 0.8, 1)
    br.inputs["Color2"].default_value = (1.15, 1.1, 1.05, 1)
    nt.links.new(vec, br.inputs["Vector"])
    gr = grain(nt, 3.0, 40.0)
    r, g, b = wear_ch(nt)
    base = Mx(nt, col_of(nt), br.outputs["Color"], 1.0, "MULTIPLY")
    base = Mx(nt, base, (1.2, 1.15, 1.1, 1), gr, "MULTIPLY")
    base = Mx(nt, base, (0.02, 0.015, 0.01, 1), br.outputs["Fac"])
    base = Mx(nt, base, (0.03, 0.026, 0.02, 1), maths(nt, "ADD", maths(nt, "MULTIPLY", r, 0.5), maths(nt, "MULTIPLY", ao_grime(nt, 0.2), 0.5), True))
    bump = N(nt, "ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.3
    bump.inputs["Distance"].default_value = 0.008
    nt.links.new(maths(nt, "MULTIPLY", br.outputs["Fac"], 1.0), bump.inputs["Height"])
    princ(nt, base, 0.5, normal=bump.outputs["Normal"])

    # ---- FRAME: painted sash timber. Col = paint colour (varies per window), grime in corners (AO), chips ----
    nt = nt_of(MATS["FRAME"])
    r, g, b = wear_ch(nt)
    noise = world_noise(nt, 7.0, 4)
    fine = world_noise(nt, 30.0, 3)
    paint = Mx(nt, col_of(nt), (1.12, 1.1, 1.05, 1), maths(nt, "MULTIPLY", noise, 1.0), "MULTIPLY")
    grime = ao_grime(nt, 0.09)
    base = Mx(nt, paint, (0.04, 0.035, 0.03, 1), maths(nt, "ADD", dirt_fac(nt, r, noise, 0.8), maths(nt, "MULTIPLY", grime, 0.75), True))
    base = Mx(nt, base, (0.2, 0.19, 0.17, 1), maths(nt, "MULTIPLY", maths(nt, "GREATER_THAN", fine, 0.66), 0.7))            # bare, sun-silvered patches
    base = Mx(nt, base, (0.11, 0.075, 0.05, 1), maths(nt, "MULTIPLY", maths(nt, "ADD", g, maths(nt, "GREATER_THAN", noise, 0.72)), 0.45, True))
    bump = N(nt, "ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.2
    bump.inputs["Distance"].default_value = 0.004
    nt.links.new(fine, bump.inputs["Height"])
    princ(nt, base, 0.6, normal=bump.outputs["Normal"])

    # ---- GLASS ----
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
    bump.inputs["Strength"].default_value = 0.06
    bump.inputs["Distance"].default_value = 0.002
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], gl.inputs["Normal"])
    fr = N(nt, "ShaderNodeFresnel")
    fr.inputs["IOR"].default_value = 1.5
    nt.links.new(bump.outputs["Normal"], fr.inputs["Normal"])
    m1 = N(nt, "ShaderNodeMixShader")
    nt.links.new(fr.outputs["Fac"], m1.inputs["Fac"])
    nt.links.new(tr_.outputs["BSDF"], m1.inputs[1])
    nt.links.new(gl.outputs["BSDF"], m1.inputs[2])
    dif = N(nt, "ShaderNodeBsdfDiffuse")
    dif.inputs["Color"].default_value = (0.09, 0.085, 0.07, 1)
    m2 = N(nt, "ShaderNodeMixShader")
    nt.links.new(maths(nt, "MULTIPLY", dirt_fac(nt, r, noise.outputs["Fac"], 0.8, 0.4), 0.65, True), m2.inputs["Fac"])
    nt.links.new(m1.outputs["Shader"], m2.inputs[1])
    nt.links.new(dif.outputs["BSDF"], m2.inputs[2])
    o = N(nt, "ShaderNodeOutputMaterial")
    nt.links.new(m2.outputs["Shader"], o.inputs["Surface"])

    # ---- CANVAS: sun-bleached awning cloth (Col = colour), dirt, weave, some translucency ----
    nt = nt_of(MATS["CANVAS"])
    MATS["CANVAS"].use_backface_culling = False
    r, g, b = wear_ch(nt)
    noise = world_noise(nt, 6.0, 5)
    blot = stretch_noise(nt, 2.5, 1.0, 1.0, 1.0, 4)
    base = Mx(nt, col_of(nt), (1.1, 1.08, 1.0, 1), blot, "MULTIPLY")
    base = Mx(nt, base, (0.07, 0.055, 0.04, 1), dirt_fac(nt, r, noise, 0.85, 0.5))
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

    # ---- CLOTH: cotton / indigo / silk (Col), fine weave, soft ----
    nt = nt_of(MATS["CLOTH"])
    MATS["CLOTH"].use_backface_culling = False
    r, g, b = wear_ch(nt)
    blot = stretch_noise(nt, 6.0, 1.0, 1.0, 1.0, 4)
    base = Mx(nt, col_of(nt), (1.15, 1.12, 1.05, 1), blot, "MULTIPLY")
    base = Mx(nt, base, (0.05, 0.045, 0.04, 1), maths(nt, "MULTIPLY", dirt_fac(nt, r, blot, 0.5, 0.3), 0.6, True))
    weave = N(nt, "ShaderNodeTexNoise")
    weave.inputs["Scale"].default_value = 400.0
    nt.links.new(uvvec(nt), weave.inputs["Vector"])
    bump = N(nt, "ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.002
    nt.links.new(weave.outputs["Fac"], bump.inputs["Height"])
    d = N(nt, "ShaderNodeBsdfDiffuse")
    put(nt, d.inputs["Color"], base)
    nt.links.new(bump.outputs["Normal"], d.inputs["Normal"])
    tl = N(nt, "ShaderNodeBsdfTranslucent")
    put(nt, tl.inputs["Color"], base)
    mm = N(nt, "ShaderNodeMixShader")
    mm.inputs["Fac"].default_value = 0.25
    nt.links.new(d.outputs["BSDF"], mm.inputs[1])
    nt.links.new(tl.outputs["BSDF"], mm.inputs[2])
    o = N(nt, "ShaderNodeOutputMaterial")
    nt.links.new(mm.outputs["Shader"], o.inputs["Surface"])

    # ---- SIGN: aged painted board ----
    nt = nt_of(MATS["SIGN"])
    r, g, b = wear_ch(nt)
    noise = world_noise(nt, 5.0, 5)
    base = Mx(nt, col_of(nt), (1.15, 1.1, 1.0, 1), noise, "MULTIPLY")
    base = Mx(nt, base, (0.05, 0.045, 0.04, 1), maths(nt, "ADD", dirt_fac(nt, r, noise, 0.8), maths(nt, "MULTIPLY", ao_grime(nt, 0.1), 0.5), True))
    princ(nt, base, 0.75)

    # ---- IRON (CC0 Metal041B roughness/normal), Col = colour, rust where worn ----
    nt = nt_of(MATS["IRON"])
    vec = uvvec(nt, (1.5, 1.5, 1.5))
    tr = imgtex(nt, "Metal041B", "Metal041B_2K-JPG_Roughness.jpg", vec, True)
    tn = imgtex(nt, "Metal041B", "Metal041B_2K-JPG_NormalGL.jpg", vec, True)
    nm = N(nt, "ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = 0.5
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    r, g, b = wear_ch(nt)
    noise = world_noise(nt, 4.0, 5)
    base = Mx(nt, col_of(nt), (0.22, 0.09, 0.045, 1), maths(nt, "MULTIPLY", maths(nt, "ADD", r, g), 0.5, True))
    princ(nt, base, maths(nt, "MAXIMUM", tr.outputs["Color"], 0.6), metallic=0.45, normal=nm.outputs["Normal"])

    # ---- INTERIOR: baked albedo in Col, emissive mask in _WEAR.B (lit paper, lanterns, embers) ----
    nt = nt_of(MATS["INTERIOR"])
    cc = col_of(nt)
    r, g, b = wear_ch(nt)
    p = princ(nt, cc, 0.7, spec=0.3)
    nt.links.new(cc, p.inputs["Emission Color"])
    nt.links.new(maths(nt, "MULTIPLY", b, 3.0), p.inputs["Emission Strength"])

    # ---- SHOJI: paper, translucent, lit from behind ----
    nt = nt_of(MATS["SHOJI"])
    MATS["SHOJI"].use_backface_culling = False
    cc = col_of(nt)
    r, g, b = wear_ch(nt)
    fib = N(nt, "ShaderNodeTexNoise")
    fib.inputs["Scale"].default_value = 200.0
    nt.links.new(uvvec(nt, (1, 1, 1)), fib.inputs["Vector"])
    d = N(nt, "ShaderNodeBsdfDiffuse")
    put(nt, d.inputs["Color"], Mx(nt, cc, (1.1, 1.08, 1.0, 1), fib.outputs["Fac"], "MULTIPLY"))
    tl = N(nt, "ShaderNodeBsdfTranslucent")
    put(nt, tl.inputs["Color"], cc)
    mm = N(nt, "ShaderNodeMixShader")
    mm.inputs["Fac"].default_value = 0.5
    nt.links.new(d.outputs["BSDF"], mm.inputs[1])
    nt.links.new(tl.outputs["BSDF"], mm.inputs[2])
    em = N(nt, "ShaderNodeEmission")
    nt.links.new(cc, em.inputs["Color"])
    nt.links.new(maths(nt, "MULTIPLY", b, 3.5), em.inputs["Strength"])
    ad = N(nt, "ShaderNodeAddShader")
    nt.links.new(mm.outputs["Shader"], ad.inputs[0])
    nt.links.new(em.outputs["Emission"], ad.inputs[1])
    o = N(nt, "ShaderNodeOutputMaterial")
    nt.links.new(ad.outputs["Shader"], o.inputs["Surface"])

    # ---- TATAMI: rush weave (fine bands along the long edge), faded, dark edging is a separate cloth strip ----
    nt = nt_of(MATS["TATAMI"])
    vec = uvvec(nt, (1.0, 1.0, 1.0))
    w = N(nt, "ShaderNodeTexWave", wave_type="BANDS", bands_direction="Y", wave_profile="SIN")
    w.inputs["Scale"].default_value = 130.0
    w.inputs["Distortion"].default_value = 1.0
    nt.links.new(vec, w.inputs["Vector"])
    bl = stretch_noise(nt, 1.5, 1, 1, 1, 4)
    r, g, b = wear_ch(nt)
    base = Mx(nt, col_of(nt), (1.25, 1.2, 1.0, 1), w.outputs["Fac"], "MULTIPLY")
    base = Mx(nt, base, (1.2, 1.15, 1.05, 1), bl, "MULTIPLY")
    base = Mx(nt, base, (0.04, 0.035, 0.02, 1), maths(nt, "MULTIPLY", maths(nt, "ADD", maths(nt, "MULTIPLY", r, 0.4), ao_grime(nt, 0.1)), 0.6, True))
    bump = N(nt, "ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.4
    bump.inputs["Distance"].default_value = 0.003
    nt.links.new(w.outputs["Fac"], bump.inputs["Height"])
    princ(nt, base, 0.9, normal=bump.outputs["Normal"], spec=0.2)

    # ---- EARTH: packed earth doma with a worn path and damp patches ----
    nt = nt_of(MATS["EARTH"])
    n1 = stretch_noise(nt, 1.3, 1, 1, 1, 6)
    n2 = stretch_noise(nt, 18.0, 1, 1, 1, 4)
    base = Mx(nt, (0.17, 0.125, 0.085, 1), (0.31, 0.24, 0.17, 1), n1)
    base = Mx(nt, base, (0.06, 0.045, 0.03, 1), maths(nt, "MULTIPLY", maths(nt, "GREATER_THAN", n1, 0.62), 0.6))
    bump = N(nt, "ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.9
    bump.inputs["Distance"].default_value = 0.02
    nt.links.new(n2, bump.inputs["Height"])
    princ(nt, base, 0.95, normal=bump.outputs["Normal"], spec=0.1)

    # ---- ROOF: dark grey kawara. Courses are geometry; tile undulation + colour per tile in the shader ----
    nt = nt_of(MATS["ROOF"])
    vec = uvvec(nt, (1.0, 1.0, 1.0))
    br = N(nt, "ShaderNodeTexBrick")
    br.offset = 0.0
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Brick Width"].default_value = 0.30
    br.inputs["Row Height"].default_value = 0.19
    br.inputs["Mortar Size"].default_value = 0.01
    br.inputs["Color1"].default_value = (0.6, 0.62, 0.66, 1)
    br.inputs["Color2"].default_value = (1.05, 1.02, 1.0, 1)
    nt.links.new(vec, br.inputs["Vector"])
    w = N(nt, "ShaderNodeTexWave", wave_type="BANDS", bands_direction="X", wave_profile="SIN")
    w.inputs["Scale"].default_value = 2.0 * math.pi / 0.30 / 2.0
    w.inputs["Distortion"].default_value = 0.0
    nt.links.new(vec, w.inputs["Vector"])
    r, g, b = wear_ch(nt)
    noise = world_noise(nt, 2.0, 5)
    base = Mx(nt, col_of(nt), br.outputs["Color"], 1.0, "MULTIPLY")
    base = Mx(nt, base, (0.02, 0.02, 0.02, 1), maths(nt, "MULTIPLY", w.outputs["Fac"], 0.5))
    base = Mx(nt, base, (0.13, 0.15, 0.09, 1), maths(nt, "MULTIPLY", maths(nt, "GREATER_THAN", noise, 0.7), 0.16))     # moss
    base = Mx(nt, base, (0.02, 0.02, 0.022, 1), maths(nt, "MULTIPLY", ao_grime(nt, 0.1), 0.5))
    bump = N(nt, "ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.5
    bump.inputs["Distance"].default_value = 0.02
    nt.links.new(maths(nt, "ADD", w.outputs["Fac"], br.outputs["Fac"]), bump.inputs["Height"])
    princ(nt, base, 0.78, normal=bump.outputs["Normal"], spec=0.2)

    # ---- POSTER ----
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
    princ(nt, Mx(nt, ramp.outputs["Color"], (0.12, 0.09, 0.06, 1), dirt_fac(nt, r, noise, 1.0)), 0.9)
    MATS["POSTER"].use_backface_culling = False

    # ---- STAIN ----
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

    # ---- INK: faded paint (Col) ----
    nt = nt_of(MATS["INK"])
    r, g, b = wear_ch(nt)
    princ(nt, Mx(nt, col_of(nt), (0.05, 0.03, 0.025, 1), maths(nt, "MULTIPLY", r, 0.5, True)), 0.8)


PLAIN = {   # glTF constant colours: Col-driven materials are white (COLOR_0 = albedo), the others carry a colour
    "PLASTER": ((0.80, 0.73, 0.60, 1), 0.9, 0.0), "TIMBER": ((1, 1, 1, 1), 0.7, 0.0), "WOOD": ((1, 1, 1, 1), 0.65, 0.0),
    "FLOOR": ((1, 1, 1, 1), 0.55, 0.0), "TATAMI": ((1, 1, 1, 1), 0.92, 0.0), "CLOTH": ((1, 1, 1, 1), 0.95, 0.0),
    "GLASS": ((0.85, 0.95, 0.92, 1), 0.05, 0.0), "FRAME": ((1, 1, 1, 1), 0.6, 0.0), "CANVAS": ((1, 1, 1, 1), 0.95, 0.0),
    "SIGN": ((1, 1, 1, 1), 0.75, 0.0), "IRON": ((1, 1, 1, 1), 0.45, 0.7), "INTERIOR": ((1, 1, 1, 1), 0.8, 0.0),
    "SHOJI": ((1, 1, 1, 1), 0.9, 0.0), "EARTH": ((0.22, 0.16, 0.11, 1), 0.95, 0.0), "WALLIN": ((0.5, 0.38, 0.26, 1), 0.92, 0.0),
    "STONE": ((0.55, 0.51, 0.45, 1), 0.85, 0.0), "POSTER": ((0.66, 0.6, 0.45, 1), 0.9, 0.0),
    "STAIN": ((1, 1, 1, 1), 1.0, 0.0), "INK": ((1, 1, 1, 1), 0.8, 0.0), "ROOF": ((1, 1, 1, 1), 0.55, 0.0),
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
        m.use_backface_culling = name not in ("GLASS", "CANVAS", "STAIN", "POSTER", "CLOTH", "SHOJI")
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


# ---- review scene ------------------------------------------------------------------------------------------------------
def world_dusk(scene, elev=3.0, strength=0.85):
    w = bpy.data.worlds.new("dusk")
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    sky = N(nt, "ShaderNodeTexSky", sky_type="NISHITA")
    sky.sun_elevation = math.radians(elev)
    sky.sun_rotation = math.radians(200)
    sky.sun_disc = False
    sky.air_density = 1.6
    sky.dust_density = 2.2
    bg = N(nt, "ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    o = N(nt, "ShaderNodeOutputWorld")
    nt.links.new(bg.outputs["Background"], o.inputs["Surface"])
    return bg


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


def build_neighbors(coll):
    """Review-only massing so the street view has context (not part of the deliverable)."""
    P = Part("neighbors")
    for x0, x1, h, ry in ((-12.5, -3.0, 6.0, 0.0), (9.8, 17.0, 5.7, 0.0)):
        box(P, "PLASTER", x0, 0.0, 0.0, x1, 9.0, h)
        box(P, "TIMBER", x0 + 0.3, -0.05, 0.4, x1 - 0.3, 0.05, 2.6)
        box(P, "INTERIOR", x0 + 0.5, -0.06, 0.6, x1 - 0.5, -0.05, 2.4)
        for k in range(3):
            wx = x0 + 0.6 + k * (x1 - x0 - 1.2) / 3
            box(P, "FRAME", wx, -0.06, 3.9, wx + 0.9, -0.03, 5.3)
            box(P, "INTERIOR", wx + 0.06, -0.07, 3.96, wx + 0.84, -0.06, 5.24)
        box(P, "CANVAS", x0, -0.9, 2.5, x1, 0.0, 2.55)
        box(P, "ROOF", x0 - 0.1, -0.15, h, x1 + 0.1, 9.2, h + 0.5)
    P.dirt_scale = 1.0
    P.finish()
    o = P.to_object(coll)
    # review-only plaster: calm, low-contrast (the building's own PLASTER carries the wear look)
    m = bpy.data.materials.new("NEIGH_PLASTER")
    nt = nt_of(m)
    vec = uvvec(nt, (0.8, 0.8, 0.8))
    tc = imgtex(nt, "Plaster007", "Plaster007_2K-JPG_Color.jpg", vec)
    base = mixc(nt, tc.outputs["Color"], (0.66, 0.6, 0.52, 1), 1.0, "MULTIPLY")
    base = mixc(nt, base, (0.8, 0.78, 0.74, 1), maths(nt, "MULTIPLY", stretch_noise(nt, 0.6, 1, 1, 0.5, 3), 0.6), "MULTIPLY")
    princ(nt, base, 0.9)
    for i, sl in enumerate(P.slots):
        if sl == "PLASTER":
            o.data.materials[i] = m
    return o


def build_pole(coll):
    """Review-only utility pole with the service wires running to the facade insulators."""
    P = Part("pole")
    px, py = 12.2, -4.6
    mcyl(P, "TIMBER", (px, py, 0.0), (px, py, 8.8), 0.13, 8, (84, 68, 54), r1=0.09)
    mbox(P, "TIMBER", px - 0.9, py - 0.05, 7.55, px + 0.9, py + 0.05, 7.68, (74, 58, 44))
    mbeam(P, "TIMBER", (px, py - 0.04, 6.4), (px - 0.7, py - 0.04, 7.55), 0.06, 0.05, (74, 58, 44))
    for k in range(3):
        ix = px - 0.6 + 0.6 * k
        mcyl(P, "STONE", (ix, py, 7.68), (ix, py, 7.86), 0.035, 8)
    for k, ix in enumerate((5.28, 5.42, 5.56)):
        tw = 0.5 * (ix - 5.28) / 0.14
        a = Vector((ix + 1.5 * (0.4 + 0.3 * tw), -1.59, 5.24))
        b = Vector((px - 0.6 + 0.6 * k, py, 7.86))
        n = 14
        pts = [a.lerp(b, i / n) + Vector((0, 0, -0.35 * math.sin(math.pi * i / n))) for i in range(n + 1)]
        for u, v in zip(pts[:-1], pts[1:]):
            cyl(P, "IRON", u, v, 0.006, 4, caps=(False, False), smooth=False)
        c = b + Vector((3.0, -2.0, 0.0))
        pts = [b.lerp(c, i / n) + Vector((0, 0, -0.4 * math.sin(math.pi * i / n))) for i in range(n + 1)]
        for u, v in zip(pts[:-1], pts[1:]):
            cyl(P, "IRON", u, v, 0.006, 4, caps=(False, False), smooth=False)
    P.finish()
    return P.to_object(coll)


def room_lights(coll):
    L = [((2.5, 3.2, 2.55), 90, (1.0, 0.62, 0.32)), ((1.6, 3.6, 2.6), 40, (1.0, 0.58, 0.28)), ((4.4, 3.4, 2.6), 40, (1.0, 0.58, 0.28)),
         ((2.4, 1.0, 2.5), 45, (1.0, 0.62, 0.32)), ((3.85, 7.0, 1.7), 35, (1.0, 0.6, 0.3)), ((2.0, 7.4, 2.4), 35, (1.0, 0.62, 0.32)),
         ((2.0, 8.2, 1.9), 40, (1.0, 0.6, 0.3)), ((3.0, 5.6, 2.6), 30, (1.0, 0.62, 0.32)),
         ((5.15, 1.15, 4.4), 45, (1.0, 0.6, 0.3)), ((3.0, 2.3, 5.2), 60, (1.0, 0.62, 0.32)), ((1.0, 6.9, 4.3), 40, (1.0, 0.6, 0.3)),
         ((2.0, 6.2, 5.4), 40, (1.0, 0.64, 0.34)), ((1.3, 2.4, 4.6), 20, (1.0, 0.62, 0.34))]
    out = []
    for i, (p, e, c) in enumerate(L):
        out.append(add_light(coll, "POINT", f"lamp_{i}", p, e, c, 0.12))
    return out


def scene_lighting(coll, sun_dir=(0.85, -0.5, 0.22), sun_e=3.0):
    s = Vector(sun_dir).normalized()
    o = add_light(coll, "SUN", "sun_key", (0, 0, 10), sun_e, (1.0, 0.76, 0.55))
    o.rotation_euler = (-s).to_track_quat("-Z", "Y").to_euler()
    f = add_light(coll, "AREA", "sky_fill", (-4.5, -9.5, 7.0), 320, (0.55, 0.7, 1.0), 8.0, rot=(math.radians(60), 0, math.radians(-25)))
    return o, f


def render_to(scene, name):
    scene.render.filepath = str(OUT / name)
    bpy.ops.render.render(write_still=True)
    print("rendered", name)


def set_cam(coll, loc, target, lens, name, clip=0.05):
    for o in list(bpy.data.objects):
        if o.type == "CAMERA":
            bpy.data.objects.remove(o)
    cam = add_camera(coll, loc, target, lens, name=name)
    cam.data.clip_start = clip
    cam.data.clip_end = 400
    return cam


# ---- assembly ------------------------------------------------------------------------------------------------------------
def build_lod(lod, coll, root):
    empty = bpy.data.objects.new(f"BLD_A_LOD{lod}", None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.empty_display_size = 0.5
    coll.objects.link(empty)
    empty.parent = root
    parts = [build_wall_front(lod), build_side("right", lod), build_side("left", lod), build_side("back", lod), build_ground(lod),
             build_fascia(lod), build_awning(lod), build_sign(lod), build_roof(lod)]
    if lod < 2:
        parts.append(build_gutters(lod))
    if lod < 2:
        parts.insert(1, build_windows(lod))
    if lod == 0:
        parts += [build_lanterns(lod), build_noren(lod), build_services(), build_decals(), build_streetprops(), build_backdrop()]
    objs = []
    for P in parts:
        P.finish()
        o = P.to_object(coll)
        o.name = f"BLD_A_LOD{lod}_{P.name}"
        o.parent = empty
        objs.append(o)
    return empty, objs


def build_interior_cell(coll, root):
    empty = bpy.data.objects.new("BLD_A_INTERIOR", None)
    empty.empty_display_type = "CUBE"
    empty.empty_display_size = 0.5
    coll.objects.link(empty)
    empty.parent = root
    objs = []
    P = build_int_struct()
    stair_parts = None
    for P in (P, build_shop_props(), build_room_g(), build_room_u(), build_window_dressing()):
        P.finish()
        o = P.to_object(coll)
        o.name = f"BLD_A_INTERIOR_{P.name}"
        o.parent = empty
        objs.append(o)
    return empty, objs


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


def hide(objs, state=True):
    for o in objs:
        o.hide_render = state
        o.hide_viewport = state


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    coll = bpy.data.collections.new("BLD_A")
    scene.collection.children.link(coll)
    rev = bpy.data.collections.new("REVIEW_ONLY")
    scene.collection.children.link(rev)
    root = bpy.data.objects.new("BLD_A", None)
    root.empty_display_type = "ARROWS"
    coll.objects.link(root)
    root["building"] = "A - two-storey shop-house, Ebisu-dori 1912 (6 x 9 m); every dimension is an assumption, see README"
    root["uv0"] = "world-scaled metres (1 UV = 1 m)"
    root["uv1"] = "lightmap pack, no overlap per part (unbaked)"
    root["vertex_data"] = "COLOR_0=albedo/tint (+alpha for STAIN); _WEAR=R dirt,G edge wear,B emissive mask"
    root["lod_ranges_m"] = "LOD0 0-15 (with interior cell), LOD1 15-40, LOD2 40+"

    lods, tri = {}, {}
    for lod in (0, 1, 2):
        e, objs = build_lod(lod, coll, root)
        lightmap_uv1(objs)
        tri[lod] = count_tris(objs)
        lods[lod] = (e, objs)
        e["lod"] = lod
        e["range_m"] = ["0-15", "15-40", "40+"][lod]
    ie, iobjs = build_interior_cell(coll, root)
    lightmap_uv1(iobjs)
    ie["load_within_m"] = 15
    ie["note"] = "interior cell: floors, stair, partitions, props, lamps, window dressing; LOD0 openings are open onto it"
    tri["int"] = count_tris(iobjs)
    bd = [o for o in lods[0][1] if o.name.endswith("backdrop")][0]
    for lod in (0, 1, 2):
        print(f"LOD{lod}: {tri[lod]} tris; parts: " + ", ".join(f"{o.name.split('_', 3)[-1]}={len(o.data.loop_triangles)}" for o in lods[lod][1]))
    print(f"INTERIOR: {tri['int']} tris; parts: " + ", ".join(f"{o.name.split('_', 3)[-1]}={len(o.data.loop_triangles)}" for o in iobjs))
    print("exterior LOD0 without backdrop:", tri[0] - len(bd.data.loop_triangles))

    if DO_RENDER:
        make_render_materials()
        scene.frame_current = 1
        set_render(scene, 1280, 720, SAMPLES)
        bg = world_dusk(scene)
        sun, fill = scene_lighting(rev)
        lamps = room_lights(rev)
        ground = bpy.data.objects.new("road", bpy.data.meshes.new("road"))
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=2, y_segments=2, size=1500)
        bm.to_mesh(ground.data)
        bm.free()
        ground.data.materials.append(road_material())
        ground.location = (1.5, -60, -0.002)
        rev.objects.link(ground)
        # yard behind the building
        hide(lods[1][1] + [lods[1][0]] + lods[2][1] + [lods[2][0]] + [bd])
        nb = build_neighbors(rev)
        pole = build_pole(rev)
        view = scene.view_settings
        if ONLY in ("", "street"):
            hide([nb, pole], False)
            sun.data.energy = 4.5
            set_cam(rev, (8.4, -10.6, 1.5), (3.1, 0.0, 3.7), 24, "cam_street")
            render_to(scene, "street.png")
        hide([nb, pole])
        sun.data.energy = 3.0
        if ONLY in ("", "closeup"):
            set_cam(rev, (5.7, -2.5, 4.4), (4.55, 0.1, 4.65), 40, "cam_close")
            render_to(scene, "window-closeup.png")
        if ONLY in ("", "ground"):
            for L in lamps:
                L.data.energy *= 1.0
            sun.data.energy = 1.2
            sky_in = add_light(rev, "AREA", "sky_in", (3.0, 0.4, 2.2), 70, (0.62, 0.74, 1.0), 3.0, rot=(math.radians(90), 0, 0))
            set_cam(rev, (4.55, 0.6, 1.7), (3.3, 8.0, 1.5), 20, "cam_ground")
            render_to(scene, "interior-ground.png")
            bpy.data.objects.remove(sky_in)
            sun.data.energy = 3.0
        if ONLY in ("", "upper"):
            sun.data.energy = 1.2
            sky_in = add_light(rev, "AREA", "sky_in", (3.0, 0.4, 4.7), 60, (0.62, 0.74, 1.0), 3.0, rot=(math.radians(90), 0, 0))
            set_cam(rev, (5.35, 0.5, 5.0), (2.6, 4.4, 4.35), 20, "cam_upper")
            render_to(scene, "interior-upper.png")
            bpy.data.objects.remove(sky_in)
            sun.data.energy = 3.0
        if ONLY == "debug":
            v = [float(t) for t in arg("--cam", "0,0,0,0,0,0,30", str).split(",")]
            hide([o for o in lods[0][1] if o.name.endswith("wall_left") or o.name.endswith("gutters")])
            add_light(rev, "AREA", "cut_fill", (-9.0, 4.5, 4.5), 900, (1.0, 0.86, 0.7), 8.0, rot=(0, math.radians(-90), 0))
            set_cam(rev, v[0:3], v[3:6], v[6], "cam_dbg")
            render_to(scene, "debug.png")
        if ONLY in ("", "cutaway"):
            hide([o for o in lods[0][1] if o.name.endswith("wall_left") or o.name.endswith("gutters")])
            add_light(rev, "AREA", "cut_fill", (-9.0, 4.5, 4.5), 900, (1.0, 0.86, 0.7), 8.0, rot=(0, math.radians(-90), 0))
            set_cam(rev, (-15.5, 4.6, 4.2), (3.0, 4.5, 3.7), 34, "cam_cut")
            render_to(scene, "cutaway.png")
            hide([o for o in lods[0][1] if o.name.endswith("wall_left") or o.name.endswith("gutters")], False)
            for o in list(bpy.data.objects):
                if o.name.startswith("cut_fill"):
                    bpy.data.objects.remove(o)
        if ONLY in ("", "lod"):
            hide(lods[1][1] + [lods[1][0]] + lods[2][1] + [lods[2][0]], False)
            lods[1][0].location.x = 9.0
            lods[2][0].location.x = 18.0
            hide(iobjs + [ie])
            for lod in (0, 1, 2):
                label(rev, f"LOD{lod}  {tri[lod] - (len(bd.data.loop_triangles) if lod == 0 else 0):,} tris" + ("  (+ interior cell not shown)" if lod == 0 else ""),
                      (lods[lod][0].location.x + 3.0, -1.4, 8.6), 0.4)
            set_cam(rev, (13.0, -27.0, 6.0), (10.5, 0.0, 3.7), 34, "cam_lod")
            for L in lamps:
                L.hide_render = True
            render_to(scene, "lod.png")
            lods[1][0].location.x = 0.0
            lods[2][0].location.x = 0.0
    if DO_EXPORT:
        make_plain_materials()
        for o in list(bpy.data.objects):
            o.hide_render = False
            o.hide_viewport = False
            o.select_set(False)
        for o in bpy.data.objects:
            if o.name.startswith("BLD_A"):
                o.select_set(True)
        bpy.context.view_layer.objects.active = root
        kw = dict(filepath=str(OUT / GLB_NAME), export_format="GLB", use_selection=True, export_extras=True,
                  export_yup=True, export_cameras=False, export_lights=False, export_vertex_color="ACTIVE",
                  export_attributes=True, export_all_vertex_colors=False, export_texcoords=True, export_normals=True, export_apply=False)
        try:
            bpy.ops.export_scene.gltf(**kw)
        except TypeError as exc:
            print("export kw fallback:", exc)
            for k in ("export_vertex_color", "export_attributes"):
                kw.pop(k, None)
            bpy.ops.export_scene.gltf(**kw)
        summarize_glb(OUT / GLB_NAME)


def summarize_glb(path):
    data = path.read_bytes()
    ln = struct.unpack_from("<I", data, 12)[0]
    j = json.loads(data[20:20 + ln].decode("utf-8"))
    print("GLB", path.name, len(data), "bytes; nodes:", len(j["nodes"]))
    tris = {}
    for n in j["nodes"]:
        if "mesh" in n:
            m = j["meshes"][n["mesh"]]
            t = sum(j["accessors"][p["indices"]]["count"] // 3 for p in m["primitives"])
            grp = "_".join(n["name"].split("_")[:3])
            tris[grp] = tris.get(grp, 0) + t
    print("GLB tris per node group:", tris)
    prim = j["meshes"][0]["primitives"][0]
    print("attributes of first primitive:", list(prim["attributes"].keys()))
    print("materials:", [(m["name"], m.get("alphaMode", "OPAQUE"), m.get("doubleSided", False)) for m in j["materials"]])
    print("images in GLB:", len(j.get("images", [])))
    nb = j["buffers"][0]["byteLength"]
    for bv in j["bufferViews"]:
        assert bv["byteOffset"] + bv["byteLength"] <= nb, "bufferView out of range"
    for a in j["accessors"]:
        assert "bufferView" in a and a["count"] > 0
    print("basic GLB integrity checks passed")


main()
