"""Building A (model evaluation, Opus builder): a two-bay, two-storey shop-house on Ebisu-dori, 1912.

Run with Blender 4.5 from the repository root:
    blender -b --python assets-src/shinsekai/eval-building-a/opus/build-building-a.py -- \
        [--renders street,window-closeup,interior-ground,interior-upper,cutaway,lod] [--samples 160]
        [--no-render] [--no-export] [--materials <path to research-cache/materials-93>]
Outputs (next to this script): building-a.glb, <render>.png, building-a.stats.json.

Axes (Blender): X along the street (frontage, 0..6 m), Y into the plot (street face at Y=0, rear at
Y=9), Z up. Ground-floor earth floor (doma) at Z=0; street at Z=-0.10. glTF export converts to Y-up.

Sources (all CC0, Osaka Municipal Library, refs-claude/oml-cc0-streets):
  158514 (Ebisu-dori, 1912): two-storey rows, plastered upper storey, sash windows, small parapet,
          deep ground-floor awnings, hanging disc signboards, long horizontal fascia boards.
  157003 (1905): wooden-framed windows in plaster; dark timber ground-floor posts; tiled roof.
  157013 (1905): glazed display window of small panes; lantern on a bracket; vertical lattice.
  157016 (1905): lattice, noren and fascia lettering that reads right-to-left.
Every dimension below is an ASSUMPTION unless its comment says "photo": the photos have no scale.
Signs use invented text only (shop name 新榮堂 is fictional); no real brand, crest or trademark.

GLB structure: BuildingA > {BldgA_LOD0, BldgA_LOD1, BldgA_LOD2, BldgA_InteriorCell, BldgA_Collision}.
The GLB carries flat PBR factors + vertex-colour wear (COLOR_0) + two generated textures (glass
waviness normal, roof-tile course albedo/normal). The CC0 photo textures (materials-93) are used only
for the renders and are NOT embedded; material extras name the CC0 set to bind in the engine.
"""

import json
import math
import random
import sys
import time
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector, noise

T_START = time.time()


def arg(name, default, cast=str):
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return cast(argv[argv.index(name) + 1]) if name in argv else default


def flag(name):
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return name in argv


OUT = Path(__file__).resolve().parent
MAT93 = Path(arg("--materials", str(Path(__file__).resolve().parents[5] / "research-cache" / "materials-93")))
RENDERS = arg("--renders", "street,window-closeup,interior-ground,interior-upper,cutaway,lod").split(",")
SAMPLES = arg("--samples", 160, int)
SEED = 1912

# ----------------------------------------------------------------------------------------------
# Parameters (ASSUMPTIONS unless marked "photo")
# ----------------------------------------------------------------------------------------------
W, D = 6.0, 9.0                 # plan spec: ~6 m frontage (two bays, photo: two bays) x ~9 m depth
BAY = 3.0                       # one bay = 3.0 m (breakdown-study recipe)
T_FRONT, T_SIDE, T_REAR = 0.25, 0.18, 0.15   # plastered front 25 cm (detail-spec reveal range)
Z_STREET = -0.10
Z_HEAD = (2.62, 2.95)           # ground-floor head beam
Z_FASCIA = (2.96, 3.52)         # horizontal fascia board (photo: long horizontal boards)
Z_F2 = 3.455                    # upper-floor walking surface (tatami top)
Z_CEIL_G = 3.25                 # underside of upper-floor joists (shop ceiling)
Z_WIN = (4.05, 5.50)            # upper sash opening (photo: sash windows, one per bay)
WIN_W = 1.0
Z_CORNICE = (6.05, 6.35)
Z_PARAPET = 7.0                 # photo: small parapet; height assumed
RIDGE_Y, RIDGE_Z, PITCH = 4.55, 8.10, 0.45   # ridge parallel to the street; 4.5-sun pitch
EAVE_Y_REAR = 9.75
Z_RAISED = 0.455                # raised tatami floor at the back of the shop
STAIR = dict(x0=5.10, x1=5.82, y0=5.75, going=0.21, risers=13)


def roof_z(y):
    """Top of tile surface along the section (mean)."""
    return RIDGE_Z - abs(y - RIDGE_Y) * PITCH


# ----------------------------------------------------------------------------------------------
# Materials: spec table. kind drives the render node tree; base/rough/metal drive the GLB factors.
# ----------------------------------------------------------------------------------------------
MATS = {
    "M_Plaster_Ext":    dict(kind="plaster", base=(0.70, 0.655, 0.57), rough=0.9, wear=1.0, cc0="Plaster007 + PaintedPlaster006"),
    "M_Plaster_Int":    dict(kind="plaster_int", base=(0.55, 0.45, 0.33), rough=0.92, wear=0.25, cc0="Plaster007"),
    "M_Stone_Granite":  dict(kind="stone", base=(0.55, 0.54, 0.52), rough=0.8, wear=1.0, cc0="large_sandstone_blocks"),
    "M_Timber_Dark":    dict(kind="wood", base=(0.045, 0.032, 0.024), rough=0.62, wear=0.8),
    "M_Timber_Paint":   dict(kind="wood", base=(0.07, 0.085, 0.07), rough=0.5, wear=0.7),
    "M_Timber_Natural": dict(kind="wood", base=(0.40, 0.27, 0.16), rough=0.55, wear=0.3),
    "M_Timber_Light":   dict(kind="wood", base=(0.62, 0.47, 0.31), rough=0.5, wear=0.15),
    "M_Timber_Aged":    dict(kind="wood", base=(0.23, 0.16, 0.10), rough=0.6, wear=0.4),
    "M_Lacquer_Black":  dict(kind="lacquer", base=(0.018, 0.016, 0.014), rough=0.28, wear=0.4),
    "M_Lacquer_Red":    dict(kind="lacquer", base=(0.25, 0.035, 0.02), rough=0.3),
    "M_Gilt":           dict(kind="metal", base=(0.80, 0.60, 0.28), metal=1.0, rough=0.35),
    "M_Iron":           dict(kind="metal", base=(0.055, 0.052, 0.05), metal=0.7, rough=0.6, wear=0.5, cc0="Metal041B"),
    "M_Copper_Aged":    dict(kind="metal", base=(0.10, 0.08, 0.06), metal=0.2, rough=0.75, wear=0.8,
                             patina=(0.16, 0.26, 0.21)),
    "M_Brass":          dict(kind="metal", base=(0.66, 0.50, 0.24), metal=1.0, rough=0.3),
    "M_Tile_Roof":      dict(kind="tile", base=(0.20, 0.21, 0.23), rough=0.5, wear=0.5),
    "M_Canvas_Awning":  dict(kind="canvas", base=(0.64, 0.58, 0.45), rough=0.95, wear=0.8),
    "M_Glass":          dict(kind="glass", base=(0.93, 0.97, 0.94), rough=0.03),
    "M_Glass_Bottle_G": dict(kind="glass", base=(0.35, 0.60, 0.40), rough=0.08),
    "M_Glass_Bottle_B": dict(kind="glass", base=(0.55, 0.32, 0.12), rough=0.08),
    "M_Paper_Shoji":    dict(kind="paper", base=(0.92, 0.89, 0.80), rough=0.9),
    "M_Paper_Fusuma":   dict(kind="fusuma", base=(0.74, 0.68, 0.52), rough=0.85),
    "M_Paper_Goods":    dict(kind="flat", base=(0.82, 0.78, 0.68), rough=0.8),
    "M_Paper_Print":    dict(kind="flat", base=(0.70, 0.66, 0.58), rough=0.8),
    "M_Tatami":         dict(kind="tatami", base=(0.58, 0.54, 0.31), rough=0.8),
    "M_Cloth_Heri":     dict(kind="cloth", base=(0.04, 0.05, 0.08), rough=0.9),
    "M_Cloth_Indigo":   dict(kind="cloth", base=(0.035, 0.05, 0.11), rough=0.95, wear=0.4),
    "M_Cloth_White":    dict(kind="cloth", base=(0.80, 0.78, 0.72), rough=0.95),
    "M_Cloth_Zabuton":  dict(kind="cloth", base=(0.17, 0.06, 0.045), rough=0.95),
    "M_Cloth_Haori":    dict(kind="cloth", base=(0.10, 0.09, 0.08), rough=0.95),
    "M_Cloth_Red":      dict(kind="cloth", base=(0.45, 0.06, 0.04), rough=0.9),
    "M_Felt_Red":     dict(kind="cloth", base=(0.30, 0.04, 0.035), rough=1.0),
    "M_Earth_Doma":     dict(kind="earth", base=(0.33, 0.28, 0.23), rough=0.95, wear=0.6),
    "M_Ceramic_White":  dict(kind="flat", base=(0.80, 0.79, 0.74), rough=0.2),
    "M_Ceramic_Brown":  dict(kind="flat", base=(0.22, 0.12, 0.06), rough=0.25),
    "M_Ceramic_Blue":   dict(kind="flat", base=(0.12, 0.20, 0.35), rough=0.2),
    "M_Goods_Indigo":   dict(kind="flat", base=(0.07, 0.10, 0.22), rough=0.8),
    "M_Goods_Red":      dict(kind="flat", base=(0.40, 0.09, 0.05), rough=0.8),
    "M_Goods_Green":    dict(kind="flat", base=(0.20, 0.28, 0.17), rough=0.8),
    "M_Goods_Ochre":    dict(kind="flat", base=(0.55, 0.40, 0.14), rough=0.8),
    "M_Straw":          dict(kind="wood", base=(0.55, 0.45, 0.25), rough=0.9),
    "M_Bamboo":         dict(kind="wood", base=(0.50, 0.44, 0.24), rough=0.5),
    "M_Bulb":           dict(kind="emit", base=(1.0, 0.85, 0.6), emit=(1.0, 0.62, 0.30), strength=18.0),
    "M_Lantern_Glow":   dict(kind="emit", base=(1.0, 0.9, 0.7), emit=(1.0, 0.70, 0.40), strength=6.0),
    "M_Enamel_Shade":   dict(kind="flat", base=(0.78, 0.78, 0.74), rough=0.3),
    "M_Soot":           dict(kind="flat", base=(0.03, 0.03, 0.03), rough=0.9),
}
# render-only (never exported)
SET_MATS = {
    "S_Street":   dict(kind="earth", base=(0.36, 0.31, 0.25), rough=0.95),
    "S_Pine":     dict(kind="cloth", base=(0.05, 0.10, 0.05), rough=0.8),
    "S_Bark":     dict(kind="wood", base=(0.12, 0.09, 0.07), rough=0.9),
    "S_Label":    dict(kind="flat", base=(0.9, 0.88, 0.8), rough=0.8),
    "S_Backdrop": dict(kind="plaster_int", base=(0.45, 0.36, 0.26), rough=0.9),
}
ALL_MATS = {**MATS, **SET_MATS}


# ----------------------------------------------------------------------------------------------
# Mesh builder
# ----------------------------------------------------------------------------------------------
def V(*a):
    return Vector(a if len(a) == 3 else a[0])


class Part:
    """One bmesh with material slots. wear=True gets the facade weathering vertex colours."""

    def __init__(self, name, wear=True):
        self.name, self.wear = name, wear
        self.bm = bmesh.new()
        self.mats = []
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.lock = self.bm.faces.layers.int.new("uvlock")

    def mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    @staticmethod
    def orient(f, out):
        f.normal_update()
        if f.normal.dot(out) < 0:
            f.normal_flip()

    def face(self, pts, mat, out=None, uvs=None):
        vs = [self.bm.verts.new(Vector(p)) for p in pts]
        f = self.bm.faces.new(vs)
        if out is not None:
            self.orient(f, Vector(out))
        f.material_index = self.mi(mat)
        if uvs:
            m = {v: Vector(uv) for v, uv in zip(vs, uvs)}
            for loop in f.loops:
                loop[self.uv].uv = m[loop.vert]
            f[self.lock] = 1
        return f

    def cube(self, M, mat, bevel=0.0, skip=()):
        """Unit cube [-.5,.5]^3 transformed by M. skip: faces by name ('-x','+x','-y','+y','-z','+z')."""
        corners = [V(ix - .5, iy - .5, iz - .5) for iz in (0, 1) for iy in (0, 1) for ix in (0, 1)]
        vs = [self.bm.verts.new(M @ c) for c in corners]
        centre = M @ V(0, 0, 0)
        spec = {"-x": (0, 2, 6, 4), "+x": (1, 3, 7, 5), "-y": (0, 1, 5, 4), "+y": (2, 3, 7, 6),
                "-z": (0, 1, 3, 2), "+z": (4, 5, 7, 6)}
        faces = []
        idx = self.mi(mat)
        for k, q in spec.items():
            if k in skip:
                continue
            f = self.bm.faces.new([vs[i] for i in q])
            fc = sum((vs[i].co for i in q), Vector()) / 4
            self.orient(f, fc - centre)
            f.material_index = idx
            faces.append(f)
        if bevel > 0 and not skip:
            edges = list({e for v in vs for e in v.link_edges})
            res = bmesh.ops.bevel(self.bm, geom=vs + edges, offset=bevel, segments=1, profile=0.5,
                                  affect='EDGES', clamp_overlap=True)
            for f in res["faces"]:
                f.material_index = idx
        return faces

    def box(self, a, b, mat, bevel=0.0, skip=()):
        a, b = V(a), V(b)
        lo = V(min(a.x, b.x), min(a.y, b.y), min(a.z, b.z))
        hi = V(max(a.x, b.x), max(a.y, b.y), max(a.z, b.z))
        size = hi - lo
        if min(size) <= 1e-5:
            return []
        M = Matrix.Translation((lo + hi) / 2) @ Matrix.Diagonal((*size, 1))
        return self.cube(M, mat, min(bevel, min(size) * 0.3), skip)

    def beam(self, p0, p1, w, h, mat, up=V(0, 0, 1), bevel=0.0):
        """Rectangular member from p0 to p1 (w across, h along 'up')."""
        p0, p1 = V(p0), V(p1)
        d = p1 - p0
        L = d.length
        x = d.normalized()
        z = (up - x * up.dot(x)).normalized()
        y = z.cross(x)
        R = Matrix((x, y, z)).transposed().to_4x4()
        M = Matrix.Translation((p0 + p1) / 2) @ R @ Matrix.Diagonal((L, w, h, 1))
        return self.cube(M, mat, bevel)

    def cyl(self, p0, p1, r, segs, mat, r1=None, caps=(True, True), phase=0.0):
        p0, p1 = V(p0), V(p1)
        ax = (p1 - p0).normalized()
        t = ax.orthogonal().normalized()
        b = ax.cross(t)
        r1 = r if r1 is None else r1
        ring0, ring1 = [], []
        for i in range(segs):
            a = 2 * math.pi * i / segs + phase
            c = t * math.cos(a) + b * math.sin(a)
            ring0.append(self.bm.verts.new(p0 + c * r))
            ring1.append(self.bm.verts.new(p1 + c * r1))
        idx = self.mi(mat)
        mid = (p0 + p1) / 2
        for i in range(segs):
            j = (i + 1) % segs
            f = self.bm.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
            fc = (ring0[i].co + ring0[j].co + ring1[i].co + ring1[j].co) / 4
            self.orient(f, fc - (p0 + ax * ax.dot(fc - p0)))
            f.material_index = idx
        if caps[0] and r > 0:
            f = self.bm.faces.new(ring0)
            self.orient(f, -ax)
            f.material_index = idx
        if caps[1] and r1 > 0:
            f = self.bm.faces.new(ring1)
            self.orient(f, ax)
            f.material_index = idx

    def lathe(self, c, prof, segs, mat, cap_top=True, cap_bot=True, axis="z"):
        """prof: [(r, h)] from bottom to top around vertical axis through c."""
        c = V(c)
        rings = []
        for r, h in prof:
            ring = []
            for i in range(segs):
                a = 2 * math.pi * i / segs
                if axis == "z":
                    p = c + V(r * math.cos(a), r * math.sin(a), h)
                elif axis == "y":
                    p = c + V(r * math.cos(a), h, r * math.sin(a))
                else:
                    p = c + V(h, r * math.cos(a), r * math.sin(a))
                ring.append(self.bm.verts.new(p))
            rings.append(ring)
        idx = self.mi(mat)
        axv = {"z": V(0, 0, 1), "y": V(0, 1, 0), "x": V(1, 0, 0)}[axis]
        for k in range(len(rings) - 1):
            for i in range(segs):
                j = (i + 1) % segs
                q = [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]]
                if prof[k][0] < 1e-6 and prof[k + 1][0] < 1e-6:
                    continue
                try:
                    if prof[k][0] < 1e-6:
                        q = [rings[k][i], rings[k + 1][j], rings[k + 1][i]]
                    elif prof[k + 1][0] < 1e-6:
                        q = [rings[k][i], rings[k][j], rings[k + 1][i]]
                    f = self.bm.faces.new(q)
                except ValueError:
                    continue
                fc = sum((v.co for v in q), Vector()) / len(q)
                rel = fc - c
                self.orient(f, rel - axv * axv.dot(rel))
                f.material_index = idx
        if cap_bot and prof[0][0] > 1e-6:
            f = self.bm.faces.new(rings[0])
            self.orient(f, -axv)
            f.material_index = idx
        if cap_top and prof[-1][0] > 1e-6:
            f = self.bm.faces.new(rings[-1])
            self.orient(f, axv)
            f.material_index = idx

    def sweep_x(self, prof, x0, x1, mat, caps=True):
        """Profile [(y, z)] swept along X. Profile + closing edge must form a simple polygon."""
        area = sum(prof[i][0] * prof[(i + 1) % len(prof)][1] - prof[(i + 1) % len(prof)][0] * prof[i][1]
                   for i in range(len(prof)))
        sgn = 1 if area > 0 else -1
        for i in range(len(prof) - 1):
            (ya, za), (yb, zb) = prof[i], prof[i + 1]
            n = V(0, (zb - za) * sgn, -(yb - ya) * sgn)
            self.face([(x0, ya, za), (x1, ya, za), (x1, yb, zb), (x0, yb, zb)], mat, out=n)
        if caps:
            self.face([(x0, y, z) for y, z in prof], mat, out=(-1, 0, 0))
            self.face([(x1, y, z) for y, z in prof], mat, out=(1, 0, 0))

    def prism_y(self, poly_xz, y0, y1, mat):
        """Polygon in XZ extruded along Y (y0 front .. y1 back)."""
        self.face([(x, y0, z) for x, z in poly_xz], mat, out=(0, -1, 0))
        self.face([(x, y1, z) for x, z in poly_xz], mat, out=(0, 1, 0))
        cx = sum(p[0] for p in poly_xz) / len(poly_xz)
        cz = sum(p[1] for p in poly_xz) / len(poly_xz)
        for i in range(len(poly_xz)):
            (xa, za), (xb, zb) = poly_xz[i], poly_xz[(i + 1) % len(poly_xz)]
            self.face([(xa, y0, za), (xb, y0, zb), (xb, y1, zb), (xa, y1, za)], mat,
                      out=((xa + xb) / 2 - cx, 0, (za + zb) / 2 - cz))

    def prism_x(self, poly_yz, x0, x1, mat):
        self.face([(x0, y, z) for y, z in poly_yz], mat, out=(-1, 0, 0))
        self.face([(x1, y, z) for y, z in poly_yz], mat, out=(1, 0, 0))
        cy = sum(p[0] for p in poly_yz) / len(poly_yz)
        cz = sum(p[1] for p in poly_yz) / len(poly_yz)
        for i in range(len(poly_yz)):
            (ya, za), (yb, zb) = poly_yz[i], poly_yz[(i + 1) % len(poly_yz)]
            self.face([(x0, ya, za), (x0, yb, zb), (x1, yb, zb), (x1, ya, za)], mat,
                      out=(0, (ya + yb) / 2 - cy, (za + zb) / 2 - cz))

    def tube(self, pts, r, segs, mat):
        for a, b in zip(pts[:-1], pts[1:]):
            self.cyl(a, b, r, segs, mat, caps=(False, False))

    def wall(self, O, U, Vv, N, su, sv, t, holes, step, mat_out, mat_in, caps=("u0", "u1", "v1"),
             reveal=True):
        """Thick wall: outer face grid (for vertex-colour wear) with rectangular holes and real reveals.
        Point(u, v, d) = O + U*u + V*v - N*d; d=0 outer face, d=t inner face."""
        O, U, Vv, N = V(O), V(U), V(Vv), V(N)

        def P(u, v, d=0.0):
            return O + U * u + Vv * v - N * d

        def breaks(lo, hi, st, extra):
            vals = {lo, hi, *extra}
            n = max(1, int(round((hi - lo) / st)))
            vals |= {lo + (hi - lo) * i / n for i in range(n + 1)}
            vals = sorted(v for v in vals if lo - 1e-6 <= v <= hi + 1e-6)
            out = []
            for v in vals:
                if not out or v - out[-1] > 0.02:
                    out.append(v)
                else:
                    out[-1] = v if v in extra else out[-1]
            return out

        hu = [h[0] for h in holes] + [h[2] for h in holes]
        hv = [h[1] for h in holes] + [h[3] for h in holes]

        def in_hole(u, v):
            return any(h[0] < u < h[2] and h[1] < v < h[3] for h in holes)

        ub, vb = breaks(0, su, step, hu), breaks(0, sv, step, hv)
        for i in range(len(ub) - 1):
            for j in range(len(vb) - 1):
                if in_hole((ub[i] + ub[i + 1]) / 2, (vb[j] + vb[j + 1]) / 2):
                    continue
                self.face([P(ub[i], vb[j]), P(ub[i + 1], vb[j]), P(ub[i + 1], vb[j + 1]), P(ub[i], vb[j + 1])],
                          mat_out, out=N)
        ubc, vbc = breaks(0, su, 99, hu), breaks(0, sv, 99, hv)
        for i in range(len(ubc) - 1):
            for j in range(len(vbc) - 1):
                if in_hole((ubc[i] + ubc[i + 1]) / 2, (vbc[j] + vbc[j + 1]) / 2):
                    continue
                self.face([P(ubc[i], vbc[j], t), P(ubc[i + 1], vbc[j], t), P(ubc[i + 1], vbc[j + 1], t),
                           P(ubc[i], vbc[j + 1], t)], mat_in, out=-N)
        if reveal:
            for (u0, v0, u1, v1) in holes:
                segs_u = [u for u in ub if u0 - 1e-6 <= u <= u1 + 1e-6]
                segs_v = [v for v in vb if v0 - 1e-6 <= v <= v1 + 1e-6]
                for a, b in zip(segs_u[:-1], segs_u[1:]):
                    self.face([P(a, v0), P(b, v0), P(b, v0, t), P(a, v0, t)], mat_out, out=Vv)
                    self.face([P(a, v1), P(b, v1), P(b, v1, t), P(a, v1, t)], mat_out, out=-Vv)
                for a, b in zip(segs_v[:-1], segs_v[1:]):
                    self.face([P(u0, a), P(u0, b), P(u0, b, t), P(u0, a, t)], mat_out, out=U)
                    self.face([P(u1, a), P(u1, b), P(u1, b, t), P(u1, a, t)], mat_out, out=-U)
        if "u0" in caps:
            self.face([P(0, 0), P(0, sv), P(0, sv, t), P(0, 0, t)], mat_out, out=-U)
        if "u1" in caps:
            self.face([P(su, 0), P(su, sv), P(su, sv, t), P(su, 0, t)], mat_out, out=U)
        if "v1" in caps:
            self.face([P(0, sv), P(su, sv), P(su, sv, t), P(0, sv, t)], mat_out, out=Vv)
        if "v0" in caps:
            self.face([P(0, 0), P(su, 0), P(su, 0, t), P(0, 0, t)], mat_out, out=-Vv)

    def add_mesh(self, me, M, mat):
        vs = [self.bm.verts.new(M @ v.co) for v in me.vertices]
        idx = self.mi(mat)
        for p in me.polygons:
            try:
                f = self.bm.faces.new([vs[i] for i in p.vertices])
                f.material_index = idx
            except ValueError:
                pass

    def tris(self):
        return sum(len(f.verts) - 2 for f in self.bm.faces)

    # ---- finalisation: UVs + vertex colours ----
    def finalize(self):
        bm = self.bm
        bm.normal_update()
        for f in bm.faces:
            if f[self.lock]:
                continue
            n = f.normal
            ax = max(range(3), key=lambda i: abs(n[i]))
            for loop in f.loops:
                co = loop.vert.co
                if ax == 2:
                    loop[self.uv].uv = (co.x, co.y)
                elif ax == 0:
                    loop[self.uv].uv = (co.y * (1 if n.x > 0 else -1), co.z)
                else:
                    loop[self.uv].uv = (co.x * (-1 if n.y > 0 else 1), co.z)
        col = bm.loops.layers.float_color.new("Col")
        wm = bm.loops.layers.float_color.new("WearMask")
        for f in bm.faces:
            mname = self.mats[f.material_index]
            spec = ALL_MATS.get(mname, {})
            k = spec.get("wear", 0.0) if self.wear else 0.0
            vary = 1.0
            if mname in VARY_PER_FACE:
                fc = f.calc_center_median()
                vary = 1.0 + VARY_PER_FACE[mname] * noise.noise(fc * 1.7 + V(0.3, 0.1, 0.7))
            for loop in f.loops:
                c, m = wear_colour(loop.vert.co, f.normal, k)
                c = (c[0] * vary, c[1] * vary, c[2] * vary * (1.0 - 0.3 * (vary - 1.0)))
                loop[col] = (*c, 1.0)
                loop[wm] = (*m, 1.0)

    def to_object(self, coll, name=None):
        self.finalize()
        me = bpy.data.meshes.new(name or self.name)
        self.bm.to_mesh(me)
        for m in self.mats:
            me.materials.append(get_mat(m))
        me.color_attributes.active_color = me.color_attributes["Col"]
        me.color_attributes.render_color_index = me.color_attributes.find("Col")
        ob = bpy.data.objects.new(name or self.name, me)
        coll.objects.link(ob)
        for poly in me.polygons:
            poly.use_smooth = False
        return ob


WINDOW_XS = (1.5, 4.5)
# per-face value variation baked into COLOR_0 (sun-faded tatami, uneven boards, mixed goods)
VARY_PER_FACE = {"M_Tatami": 0.35, "M_Timber_Natural": 0.25, "M_Timber_Light": 0.2, "M_Paper_Goods": 0.2,
                 "M_Stone_Granite": 0.25, "M_Timber_Aged": 0.3, "M_Tile_Roof": 0.15}


def wear_colour(co, n, k):
    """Weathering baked to vertex colour (glTF COLOR_0 multiplies base colour).
    Returns (rgb multiplier, mask rgb): mask.r = rain-streak zone, mask.g = soot, mask.b = splash."""
    if k <= 0:
        return (1.0, 1.0, 1.0), (0.0, 0.0, 0.0)
    x, y, z = co
    h = z - Z_STREET
    c = 1.0
    splash = max(0.0, 1.0 - h / 0.75) ** 1.6
    c *= 1 - 0.42 * k * splash
    damp = math.exp(-((h - 0.32) / 0.07) ** 2) * (0.6 + 0.4 * noise.noise(V(x * 3, y * 3, 0.5)))
    c *= 1 - 0.16 * k * damp
    soot = 0.0
    if 5.3 < z < 6.1 and n.y < -0.5:
        soot = ((z - 5.3) / 0.8) ** 2
    if z > 6.3:
        soot = 0.35 + 0.3 * max(0.0, (z - 6.3))
    c *= 1 - 0.25 * k * min(1.0, soot)
    streak = 0.0
    if n.y < -0.5 or abs(n.z) < 0.3:
        for wx in WINDOW_XS:
            if abs(x - wx) < 0.62 and 2.95 < z < Z_WIN[0]:
                streak = max(streak, (1 - abs(x - wx) / 0.62) ** 0.5 * (1 - (Z_WIN[0] - z) / 1.2))
        if 3.7 < z < Z_CORNICE[0]:
            streak = max(streak, 0.35 * (z - 3.7) / 2.3)
    mottle = noise.noise(V(x * 0.9, y * 0.9, z * 0.9)) * 0.07 + noise.noise(V(x * 4, y * 4, z * 4)) * 0.03
    c *= 1 + mottle * k
    c *= 1 - 0.12 * k * max(0.0, streak)
    warm = (1.0, 0.97, 0.92)
    rgb = tuple(max(0.0, min(1.2, c * (w if splash > 0.1 else 1))) for w in warm)
    return rgb, (max(0.0, min(1.0, streak)), min(1.0, soot), splash)


# ----------------------------------------------------------------------------------------------
# Generated textures (our own; embedded in the GLB): glass waviness normal, roof-tile courses
# ----------------------------------------------------------------------------------------------
def np_image(name, arr, non_color):
    h, w, _ = arr.shape
    img = bpy.data.images.new(name, w, h, alpha=True)
    rgba = np.concatenate([arr, np.ones((h, w, 1))], axis=2).astype(np.float32)
    img.pixels.foreach_set(rgba.ravel())
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    img.pack()
    img.file_format = "PNG"
    return img


def height_to_normal(hf, strength):
    dy, dx = np.gradient(hf)
    nx, ny = -dx * strength, -dy * strength
    nz = np.ones_like(hf)
    L = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / L * .5 + .5, ny / L * .5 + .5, nz / L * .5 + .5], axis=2)


def make_textures():
    rng = np.random.default_rng(SEED)
    n = 256
    u, v = np.meshgrid(np.linspace(0, 1, n, endpoint=False), np.linspace(0, 1, n, endpoint=False))
    # cylinder glass: long horizontal ripples with slow drift + seeds
    hf = (np.sin(2 * np.pi * (5 * v + 0.35 * np.sin(2 * np.pi * (u + 0.2 * v)))) * 0.6
          + np.sin(2 * np.pi * (13 * v + 1.3 * u)) * 0.2)
    for _ in range(18):
        cx, cy, r = rng.random(), rng.random(), rng.uniform(0.004, 0.012)
        d = np.hypot((u - cx + .5) % 1 - .5, (v - cy + .5) % 1 - .5)
        hf += np.exp(-(d / r) ** 2) * 0.8
    glass_n = np_image("T_Glass_Wave_N", height_to_normal(hf, 1.6), True)
    # roof tiles: 8 rolls x 8 courses per tile; course lip shadow + per-tile value variation
    n = 512
    u, v = np.meshgrid(np.linspace(0, 1, n, endpoint=False), np.linspace(0, 1, n, endpoint=False))
    cv = (v * 8) % 1.0
    cell = rng.random((8, 8))
    ci, pi = (v * 8).astype(int) % 8, (u * 8).astype(int) % 8
    hf = (1 - cv) * 3.0 + cell[ci, pi] * 0.3
    tile_n = np_image("T_Roof_Tile_N", height_to_normal(hf, 2.5), True)
    val = 0.82 + 0.3 * cell[ci, pi] - 0.45 * np.exp(-((1 - cv) / 0.05) ** 2) - 0.15 * (cv < 0.08)
    val += rng.normal(0, 0.03, val.shape)
    alb = np.clip(np.stack([val * 0.95, val, val * 1.08], axis=2), 0, 1.3) * 0.75
    tile_c = np_image("T_Roof_Tile_C", np.clip(alb, 0, 1), False)
    return dict(glass_n=glass_n, tile_n=tile_n, tile_c=tile_c)


TEX = None
_MAT_CACHE = {}


def get_mat(name):
    if name in _MAT_CACHE:
        return _MAT_CACHE[name]
    m = bpy.data.materials.new(name)
    m["spec"] = json.dumps({k: v for k, v in ALL_MATS[name].items()})
    if "cc0" in ALL_MATS[name]:
        m["cc0_texture_set"] = ALL_MATS[name]["cc0"]
    _MAT_CACHE[name] = m
    build_render_material(m, ALL_MATS[name])
    return m


# ----------------------------------------------------------------------------------------------
# Render materials (Cycles). CC0 textures from materials-93 are referenced, not copied.
# ----------------------------------------------------------------------------------------------
_IMG = {}


def cc0(path, non_color=False):
    p = MAT93 / path
    if not p.exists():
        return None
    if path not in _IMG:
        img = bpy.data.images.load(str(p), check_existing=True)
        if non_color:
            img.colorspace_settings.name = "Non-Color"
        _IMG[path] = img
    return _IMG[path]


def build_render_material(m, spec):
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    N, L = nt.nodes, nt.links
    out = N.new("ShaderNodeOutputMaterial")
    bsdf = N.new("ShaderNodeBsdfPrincipled")
    L.new(bsdf.outputs[0], out.inputs[0])
    base = spec["base"]
    kind = spec["kind"]
    bsdf.inputs["Roughness"].default_value = spec.get("rough", 0.6)
    bsdf.inputs["Metallic"].default_value = spec.get("metal", 0.0)
    m.diffuse_color = (*base, 1)

    rgb = N.new("ShaderNodeRGB")
    rgb.outputs[0].default_value = (*base, 1)
    col = rgb.outputs[0]

    def mul(a, b, fac=1.0):
        n = N.new("ShaderNodeMix")
        n.data_type = "RGBA"
        n.blend_type = "MULTIPLY"
        n.inputs["Factor"].default_value = fac
        L.new(a, n.inputs[6])
        if isinstance(b, (tuple, list)):
            n.inputs[7].default_value = (*b, 1) if len(b) == 3 else b
        else:
            L.new(b, n.inputs[7])
        return n.outputs[2]

    uv = N.new("ShaderNodeUVMap")
    uv.uv_map = "UVMap"
    geo = N.new("ShaderNodeNewGeometry")
    vcol = N.new("ShaderNodeVertexColor")
    vcol.layer_name = "Col"
    wmask = N.new("ShaderNodeVertexColor")
    wmask.layer_name = "WearMask"
    sep = N.new("ShaderNodeSeparateColor")
    L.new(wmask.outputs[0], sep.inputs[0])
    obinfo = N.new("ShaderNodeObjectInfo")

    def mapping(scale):
        mp = N.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = scale
        L.new(uv.outputs[0], mp.inputs[0])
        return mp.outputs[0]

    def noise_tex(vec, scale, detail=6, rough=0.55):
        t = N.new("ShaderNodeTexNoise")
        t.inputs["Scale"].default_value = scale
        t.inputs["Detail"].default_value = detail
        t.inputs["Roughness"].default_value = rough
        if vec is not None:
            L.new(vec, t.inputs["Vector"])
        return t

    def ramp(src, a, b, ca=(0, 0, 0, 1), cb=(1, 1, 1, 1)):
        r = N.new("ShaderNodeValToRGB")
        r.color_ramp.elements[0].position, r.color_ramp.elements[0].color = a, ca
        r.color_ramp.elements[1].position, r.color_ramp.elements[1].color = b, cb
        L.new(src, r.inputs[0])
        return r.outputs[0]

    def normal_img(img, vec, strength):
        t = N.new("ShaderNodeTexImage")
        t.image = img
        L.new(vec, t.inputs[0])
        nm = N.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = strength
        L.new(t.outputs[0], nm.inputs["Color"])
        return nm.outputs[0]

    def img_tex(img, vec, gain=1.0):
        t = N.new("ShaderNodeTexImage")
        t.image = img
        L.new(vec, t.inputs[0])
        if gain != 1.0:
            return mul(t.outputs[0], (gain, gain, gain)), t
        return t.outputs[0], t

    bump_in = None
    if kind in ("plaster", "plaster_int", "S_Backdrop"):
        vec = mapping((0.55, 0.55, 0.55))
        cimg = cc0("Plaster007/Plaster007_2K-JPG_Color.jpg")
        if cimg:
            c1, _ = img_tex(cimg, vec, 1.45)
            col = mul(col, c1, 1.0 if kind == "plaster" else 0.45)
            if kind != "plaster":
                col = mul(col, (1.25, 1.25, 1.25))
            nimg = cc0("Plaster007/Plaster007_2K-JPG_NormalGL.jpg", True)
            bump_in = normal_img(nimg, vec, 0.8 if kind == "plaster" else 0.25)
            rimg = cc0("Plaster007/Plaster007_2K-JPG_Roughness.jpg", True)
            if rimg:
                rt = N.new("ShaderNodeTexImage")
                rt.image = rimg
                L.new(vec, rt.inputs[0])
                L.new(rt.outputs[0], bsdf.inputs["Roughness"])
        if kind == "plaster":
            # patches of older repaint / plaster loss (PaintedPlaster006), stronger low on the wall
            pimg = cc0("PaintedPlaster006/PaintedPlaster006_2K-JPG_Color.jpg")
            if pimg:
                vec2 = mapping((0.4, 0.4, 0.4))
                c2, _ = img_tex(pimg, vec2, 1.25)
                pn = noise_tex(geo.outputs["Position"], 0.6, 4)
                msk = ramp(pn.outputs[0], 0.55, 0.62)
                mix = N.new("ShaderNodeMix")
                mix.data_type = "RGBA"
                L.new(msk, mix.inputs["Factor"])
                L.new(col, mix.inputs[6])
                L.new(mul(rgb.outputs[0], c2), mix.inputs[7])
                col = mix.outputs[2]
            # rain streaks: vertical noise masked by the baked streak zone
            mp = N.new("ShaderNodeMapping")
            mp.inputs["Scale"].default_value = (28, 28, 0.9)
            L.new(geo.outputs["Position"], mp.inputs[0])
            sn = noise_tex(mp.outputs[0], 1.0, 3)
            sr = ramp(sn.outputs[0], 0.45, 0.7)
            mm = N.new("ShaderNodeMath")
            mm.operation = "MULTIPLY"
            L.new(sr, mm.inputs[0])
            L.new(sep.outputs[0], mm.inputs[1])
            dark = N.new("ShaderNodeMix")
            dark.data_type = "RGBA"
            L.new(mm.outputs[0], dark.inputs["Factor"])
            L.new(col, dark.inputs[6])
            L.new(mul(col, (0.55, 0.52, 0.47)), dark.inputs[7])
            col = dark.outputs[2]
            # soot (cool grey-brown) near the top
            soot = N.new("ShaderNodeMix")
            soot.data_type = "RGBA"
            sm = N.new("ShaderNodeMath")
            sm.operation = "MULTIPLY"
            sn2 = noise_tex(geo.outputs["Position"], 2.5, 4)
            L.new(sep.outputs[1], sm.inputs[0])
            L.new(sn2.outputs[0], sm.inputs[1])
            L.new(sm.outputs[0], soot.inputs["Factor"])
            L.new(col, soot.inputs[6])
            L.new(mul(col, (0.45, 0.43, 0.42)), soot.inputs[7])
            col = soot.outputs[2]
            col = mul(col, obinfo.outputs["Color"])
    elif kind == "stone":
        vec = mapping((0.7, 0.7, 0.7))
        cimg = cc0("large_sandstone_blocks_diff_2k.jpg")
        if cimg:
            c1, _ = img_tex(cimg, vec, 1.6)
            hsv = N.new("ShaderNodeHueSaturation")
            hsv.inputs["Saturation"].default_value = 0.25
            L.new(c1, hsv.inputs["Color"])
            col = mul(col, hsv.outputs[0])
            bump_in = normal_img(cc0("large_sandstone_blocks_nor_gl_2k.jpg", True), vec, 0.8)
    elif kind in ("wood", "lacquer"):
        mp = N.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (2.5, 45.0, 2.5) if kind == "wood" else (3, 3, 3)
        L.new(uv.outputs[0], mp.inputs[0])
        t = noise_tex(mp.outputs[0], 3.0, 8, 0.6)
        g = ramp(t.outputs[0], 0.3, 0.75, (0.62, 0.62, 0.62, 1), (1.25, 1.2, 1.15, 1))
        col = mul(col, g)
        bump = N.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.12 if kind == "wood" else 0.03
        L.new(t.outputs[0], bump.inputs["Height"])
        bump_in = bump.outputs[0]
        if kind == "lacquer":
            rn = noise_tex(geo.outputs["Position"], 8, 4)
            rr = ramp(rn.outputs[0], 0.4, 0.7, (0.18, 0.18, 0.18, 1), (0.5, 0.5, 0.5, 1))
            L.new(rr, bsdf.inputs["Roughness"])
        if spec.get("wear", 0) > 0.5:
            col = mul(col, obinfo.outputs["Color"])
            # sun-bleached / dusty timber on upward faces and low down
            dust = N.new("ShaderNodeMix")
            dust.data_type = "RGBA"
            sp = N.new("ShaderNodeSeparateXYZ")
            L.new(geo.outputs["Position"], sp.inputs[0])
            zr = N.new("ShaderNodeMapRange")
            L.new(sp.outputs[2], zr.inputs[0])
            zr.inputs[1].default_value, zr.inputs[2].default_value = Z_STREET, Z_STREET + 0.55
            zr.inputs[3].default_value, zr.inputs[4].default_value = 0.65, 0.0
            L.new(zr.outputs[0], dust.inputs["Factor"])
            L.new(col, dust.inputs[6])
            dust.inputs[7].default_value = (0.20, 0.17, 0.13, 1)
            col = dust.outputs[2]
    elif kind == "metal":
        t = noise_tex(geo.outputs["Position"], 12, 6)
        r = ramp(t.outputs[0], 0.35, 0.75, (0.3, 0.3, 0.3, 1), (0.75, 0.75, 0.75, 1))
        L.new(r, bsdf.inputs["Roughness"])
        if spec.get("wear", 0) > 0:
            rust = ramp(t.outputs[0], 0.55, 0.7)
            mx = N.new("ShaderNodeMix")
            mx.data_type = "RGBA"
            L.new(rust, mx.inputs["Factor"])
            L.new(col, mx.inputs[6])
            mx.inputs[7].default_value = (*spec.get("patina", (0.16, 0.07, 0.035)), 1)
            col = mx.outputs[2]
    elif kind == "tile":
        vec = uv.outputs[0]
        c1, _ = img_tex(TEX["tile_c"], vec, 1.35)
        col = mul(col, c1)
        bump_in = normal_img(TEX["tile_n"], vec, 1.0)
        t = noise_tex(geo.outputs["Position"], 0.8, 4)
        lic = ramp(t.outputs[0], 0.5, 0.7)
        mx = N.new("ShaderNodeMix")
        mx.data_type = "RGBA"
        L.new(lic, mx.inputs["Factor"])
        L.new(col, mx.inputs[6])
        L.new(mul(col, (1.0, 1.05, 0.9)), mx.inputs[7])
        col = mx.outputs[2]
    elif kind == "canvas":
        vec = mapping((1, 1, 1))
        t = noise_tex(vec, 2.2, 6)
        stain = ramp(t.outputs[0], 0.5, 0.75, (1, 1, 1, 1), (0.62, 0.58, 0.5, 1))
        col = mul(col, stain)
        col = mul(col, obinfo.outputs["Color"])
        wv = N.new("ShaderNodeTexWave")
        wv.inputs["Scale"].default_value = 60
        L.new(uv.outputs[0], wv.inputs[0])
        bump = N.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.05
        L.new(wv.outputs[1], bump.inputs["Height"])
        bump_in = bump.outputs[0]
        bsdf.inputs["Transmission Weight"].default_value = 0.08
    elif kind == "tatami":
        wv = N.new("ShaderNodeTexWave")
        wv.wave_type = "BANDS"
        wv.bands_direction = "Y"
        wv.inputs["Scale"].default_value = 120
        wv.inputs["Distortion"].default_value = 0.4
        L.new(uv.outputs[0], wv.inputs[0])
        bump = N.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.25
        L.new(wv.outputs[1], bump.inputs["Height"])
        bump_in = bump.outputs[0]
        t = noise_tex(geo.outputs["Position"], 1.5, 4)
        g = ramp(t.outputs[0], 0.35, 0.7, (0.85, 0.85, 0.8, 1), (1.12, 1.08, 1.0, 1))
        col = mul(col, g)
        lines = ramp(wv.outputs[1], 0.0, 1.0, (0.72, 0.72, 0.7, 1), (1.08, 1.08, 1.05, 1))
        col = mul(col, lines)
    elif kind in ("earth",):
        t = noise_tex(geo.outputs["Position"], 1.2, 8, 0.6)
        g = ramp(t.outputs[0], 0.35, 0.72, (0.78, 0.78, 0.76, 1), (1.18, 1.14, 1.08, 1))
        col = mul(col, g)
        t2 = noise_tex(geo.outputs["Position"], 40, 4, 0.7)
        bump = N.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.35
        L.new(t2.outputs[0], bump.inputs["Height"])
        bump_in = bump.outputs[0]
        vor = N.new("ShaderNodeTexVoronoi")
        vor.inputs["Scale"].default_value = 30
        L.new(geo.outputs["Position"], vor.inputs[0])
        peb = ramp(vor.outputs[0], 0.0, 0.25, (0.7, 0.68, 0.64, 1), (1, 1, 1, 1))
        col = mul(col, peb)
        # cart ruts / foot-worn bands along the street (X) and damp patches that go glossy
        mp = N.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (0.08, 1.6, 1.0)
        L.new(geo.outputs["Position"], mp.inputs[0])
        rut = noise_tex(mp.outputs[0], 1.0, 3, 0.5)
        rr = ramp(rut.outputs[0], 0.35, 0.65, (0.72, 0.70, 0.68, 1), (1.12, 1.1, 1.05, 1))
        col = mul(col, rr)
        wet = noise_tex(geo.outputs["Position"], 0.7, 3, 0.5)
        wm = ramp(wet.outputs[0], 0.68, 0.72)
        wcol = N.new("ShaderNodeMix")
        wcol.data_type = "RGBA"
        L.new(wm, wcol.inputs["Factor"])
        L.new(col, wcol.inputs[6])
        L.new(mul(col, (0.55, 0.55, 0.58)), wcol.inputs[7])
        col = wcol.outputs[2]
        wr = N.new("ShaderNodeMapRange")
        L.new(wm, wr.inputs[0])
        wr.inputs[3].default_value = spec.get("rough", 0.95)
        wr.inputs[4].default_value = 0.12
        L.new(wr.outputs[0], bsdf.inputs["Roughness"])
    elif kind == "cloth":
        t = noise_tex(geo.outputs["Position"], 6, 4)
        g = ramp(t.outputs[0], 0.3, 0.7, (0.85, 0.85, 0.85, 1), (1.1, 1.1, 1.1, 1))
        col = mul(col, g)
        bsdf.inputs["Sheen Weight"].default_value = 0.3
    elif kind == "fusuma":
        t = noise_tex(mapping((1, 1, 1)), 4, 5)
        g = ramp(t.outputs[0], 0.4, 0.75, (0.9, 0.9, 0.88, 1), (1.08, 1.05, 1.0, 1))
        col = mul(col, g)
    elif kind == "glass":
        bsdf.inputs["Transmission Weight"].default_value = 1.0
        bsdf.inputs["IOR"].default_value = 1.52
        bump_in = normal_img(TEX["glass_n"], uv.outputs[0], 0.35)
        # dust in the pane corners (UV 0..1 per pane)
        sepuv = N.new("ShaderNodeSeparateXYZ")
        L.new(uv.outputs[0], sepuv.inputs[0])
        edge = N.new("ShaderNodeMath")
        edge.operation = "PINGPONG"
        L.new(sepuv.outputs[0], edge.inputs[0])
        edge.inputs[1].default_value = 0.5
        edge2 = N.new("ShaderNodeMath")
        edge2.operation = "PINGPONG"
        L.new(sepuv.outputs[1], edge2.inputs[0])
        edge2.inputs[1].default_value = 0.5
        mn = N.new("ShaderNodeMath")
        mn.operation = "MINIMUM"
        L.new(edge.outputs[0], mn.inputs[0])
        L.new(edge2.outputs[0], mn.inputs[1])
        dirt = ramp(mn.outputs[0], 0.0, 0.12, (1, 1, 1, 1), (0, 0, 0, 1))
        rmix = N.new("ShaderNodeMapRange")
        L.new(dirt, rmix.inputs[0])
        rmix.inputs[3].default_value = spec.get("rough", 0.03)
        rmix.inputs[4].default_value = 0.45
        L.new(rmix.outputs[0], bsdf.inputs["Roughness"])
        cm = N.new("ShaderNodeMix")
        cm.data_type = "RGBA"
        L.new(dirt, cm.inputs["Factor"])
        L.new(col, cm.inputs[6])
        cm.inputs[7].default_value = (0.35, 0.33, 0.28, 1)
        col = cm.outputs[2]
    elif kind == "paper":
        bsdf.inputs["Transmission Weight"].default_value = 0.55
        t = noise_tex(mapping((1, 1, 1)), 30, 4)
        g = ramp(t.outputs[0], 0.4, 0.7, (0.92, 0.92, 0.9, 1), (1.0, 1.0, 1.0, 1))
        col = mul(col, g)
    elif kind == "emit":
        bsdf.inputs["Emission Color"].default_value = (*spec["emit"], 1)
        bsdf.inputs["Emission Strength"].default_value = spec["strength"]

    col = mul(col, vcol.outputs[0])
    L.new(col, bsdf.inputs["Base Color"])
    if bump_in is not None:
        L.new(bump_in, bsdf.inputs["Normal"])


def export_material(m):
    """Replace the render tree with glTF-friendly factors (+ generated textures only)."""
    spec = json.loads(m["spec"])
    nt = m.node_tree
    nt.nodes.clear()
    N, L = nt.nodes, nt.links
    out = N.new("ShaderNodeOutputMaterial")
    b = N.new("ShaderNodeBsdfPrincipled")
    L.new(b.outputs[0], out.inputs[0])
    b.inputs["Base Color"].default_value = (*spec["base"], 1)
    b.inputs["Roughness"].default_value = spec.get("rough", 0.6)
    b.inputs["Metallic"].default_value = spec.get("metal", 0.0)
    k = spec["kind"]
    if k == "glass":
        b.inputs["Transmission Weight"].default_value = 1.0
        b.inputs["IOR"].default_value = 1.52
    if k == "paper":
        b.inputs["Transmission Weight"].default_value = 0.5
    if k == "emit":
        b.inputs["Emission Color"].default_value = (*spec["emit"], 1)
        b.inputs["Emission Strength"].default_value = min(spec["strength"], 8.0)
    uvn = N.new("ShaderNodeUVMap")
    uvn.uv_map = "UVMap"
    if k in ("glass", "tile"):
        img = TEX["glass_n"] if k == "glass" else TEX["tile_n"]
        t = N.new("ShaderNodeTexImage")
        t.image = img
        L.new(uvn.outputs[0], t.inputs[0])
        nm = N.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = 0.35 if k == "glass" else 1.0
        L.new(t.outputs[0], nm.inputs["Color"])
        L.new(nm.outputs[0], b.inputs["Normal"])
    if k == "tile":
        t = N.new("ShaderNodeTexImage")
        t.image = TEX["tile_c"]
        L.new(uvn.outputs[0], t.inputs[0])
        L.new(t.outputs[0], b.inputs["Base Color"])


# ----------------------------------------------------------------------------------------------
# Text (fictional signage) as flat mesh letters
# ----------------------------------------------------------------------------------------------
FONT = None


def text_mesh(s, size, spacing=1.0):
    global FONT
    if FONT is None:
        for fp in ("C:/Windows/Fonts/yumindb.ttf", "C:/Windows/Fonts/msmincho.ttc", "C:/Windows/Fonts/yumin.ttf"):
            if Path(fp).exists():
                FONT = bpy.data.fonts.load(fp)
                break
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = s
    if FONT:
        cu.font = FONT
    cu.size = size
    cu.align_x, cu.align_y = "CENTER", "CENTER"
    cu.space_character = spacing
    cu.resolution_u = 2
    cu.fill_mode = "BOTH"
    ob = bpy.data.objects.new("txt", cu)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(2), verts=bm.verts, edges=bm.edges)
    bm.to_mesh(me)
    bm.free()
    return me


def facing(normal_axis):
    """Matrix mapping text XY plane (normal +Z) to a plane facing the given axis."""
    if normal_axis == "-y":
        return Matrix.Rotation(math.radians(90), 4, "X")
    if normal_axis == "+y":
        return Matrix.Rotation(math.radians(180), 4, "Z") @ Matrix.Rotation(math.radians(90), 4, "X")
    if normal_axis == "-x":
        return Matrix.Rotation(math.radians(-90), 4, "Z") @ Matrix.Rotation(math.radians(90), 4, "X")
    if normal_axis == "+x":
        return Matrix.Rotation(math.radians(90), 4, "Z") @ Matrix.Rotation(math.radians(90), 4, "X")


# ----------------------------------------------------------------------------------------------
# LOD0 exterior
# ----------------------------------------------------------------------------------------------
def pane_grid(P, x0, x1, z0, z1, y, cols, rows, mb, md, fmat, gy=None, gmat="M_Glass", rnd=None):
    """Muntin grid + separate glass panes (per-pane UV 0..1 for waviness and corner dust)."""
    rnd = rnd or random.Random(7)
    gy = y if gy is None else gy
    for i in range(1, cols):
        x = x0 + (x1 - x0) * i / cols
        P.box((x - mb / 2, y - md / 2, z0), (x + mb / 2, y + md / 2, z1), fmat)
    for j in range(1, rows):
        z = z0 + (z1 - z0) * j / rows
        P.box((x0, y - md / 2, z - mb / 2), (x1, y + md / 2, z + mb / 2), fmat)
    for i in range(cols):
        for j in range(rows):
            a = x0 + (x1 - x0) * i / cols
            b = x0 + (x1 - x0) * (i + 1) / cols
            c = z0 + (z1 - z0) * j / rows
            d = z0 + (z1 - z0) * (j + 1) / rows
            ou, ov = rnd.random() * 0.0, rnd.random() * 0.0
            P.face([(a, gy, c), (b, gy, c), (b, gy, d), (a, gy, d)], gmat, out=(0, -1, 0),
                   uvs=[(0 + ou, 0 + ov), (1 + ou, 0 + ov), (1 + ou, 1 + ov), (0 + ou, 1 + ov)])


def sash(P, x0, x1, z0, z1, y0, y1, cols, rows, top_rail=0.045, bot_rail=0.06):
    st = 0.045
    m = "M_Timber_Paint"
    P.box((x0, y0, z0), (x0 + st, y1, z1), m, bevel=0.004)
    P.box((x1 - st, y0, z0), (x1, y1, z1), m, bevel=0.004)
    P.box((x0 + st, y0, z1 - top_rail), (x1 - st, y1, z1), m, bevel=0.004)
    P.box((x0 + st, y0, z0), (x1 - st, y1, z0 + bot_rail), m, bevel=0.004)
    ym = (y0 + y1) / 2
    pane_grid(P, x0 + st, x1 - st, z0 + bot_rail, z1 - top_rail, ym, cols, rows, 0.022, (y1 - y0) * 0.8, m,
              gy=ym + 0.004)


def shoji(P, x0, x1, z0, z1, y, cols=3, rows=6):
    fr, t = 0.03, 0.03
    m = "M_Timber_Light"
    P.box((x0, y, z0), (x0 + fr, y + t, z1), m)
    P.box((x1 - fr, y, z0), (x1, y + t, z1), m)
    P.box((x0 + fr, y, z1 - fr), (x1 - fr, y + t, z1), m)
    P.box((x0 + fr, y, z0), (x1 - fr, y + t, z0 + 0.10), m)
    for i in range(1, cols):
        x = x0 + fr + (x1 - x0 - 2 * fr) * i / cols
        P.box((x - 0.006, y + 0.004, z0 + 0.10), (x + 0.006, y + t, z1 - fr), m)
    for j in range(1, rows):
        z = z0 + 0.10 + (z1 - fr - z0 - 0.10) * j / rows
        P.box((x0 + fr, y + 0.004, z - 0.006), (x1 - fr, y + t, z + 0.006), m)
    # paper on the street side of the lattice, lit from the room at night
    P.face([(x0 + fr, y + 0.003, z0 + 0.10), (x1 - fr, y + 0.003, z0 + 0.10), (x1 - fr, y + 0.003, z1 - fr),
            (x0 + fr, y + 0.003, z1 - fr)], "M_Paper_Shoji", out=(0, -1, 0))
    P.face([(x0 + fr, y + 0.0035, z0 + 0.10), (x1 - fr, y + 0.0035, z0 + 0.10), (x1 - fr, y + 0.0035, z1 - fr),
            (x0 + fr, y + 0.0035, z1 - fr)], "M_Paper_Shoji", out=(0, 1, 0))


def upper_window(P, cx, lower_open=0.0, shoji_open=False):
    z0, z1 = Z_WIN
    x0, x1 = cx - WIN_W / 2, cx + WIN_W / 2
    fy0, fy1, fw = 0.10, 0.20, 0.065
    tm = "M_Timber_Paint"
    # frame (set 10 cm back from the face -> 10 cm reveal outside, 5 cm inside)
    P.box((x0, fy0, z0), (x0 + fw, fy1, z1), tm, bevel=0.006)
    P.box((x1 - fw, fy0, z0), (x1, fy1, z1), tm, bevel=0.006)
    P.box((x0 + fw, fy0, z1 - fw), (x1 - fw, fy1, z1), tm, bevel=0.006)
    P.prism_x([(fy0 - 0.03, z0 + 0.03), (fy1, z0 + 0.06), (fy1, z0), (fy0 - 0.03, z0)], x0 + fw, x1 - fw, tm)
    ix0, ix1, iz0, iz1 = x0 + fw, x1 - fw, z0 + 0.055, z1 - fw
    hs = (iz1 - iz0) / 2 + 0.018
    # double-hung: upper sash outside, lower sash inside, 6-over-6 lights (1912: small panes)
    sash(P, ix0, ix1, iz1 - hs, iz1, 0.112, 0.146, 3, 2, bot_rail=0.035)
    lo = min(lower_open, hs - 0.08)
    sash(P, ix0, ix1, iz0 + lo, iz0 + lo + hs, 0.152, 0.186, 3, 2, top_rail=0.035)
    # outer sill with drip groove (swept profile)
    s0 = z0
    prof = [(0.10, s0), (-0.05, s0 - 0.02), (-0.065, s0 - 0.022), (-0.07, s0 - 0.03), (-0.07, s0 - 0.075),
            (-0.058, s0 - 0.085), (-0.042, s0 - 0.085), (-0.042, s0 - 0.072), (-0.034, s0 - 0.072),
            (-0.034, s0 - 0.085), (0.0, s0 - 0.085), (0.0, s0 - 0.1), (0.10, s0 - 0.1)]
    P.sweep_x(prof, x0 - 0.13, x1 + 0.13, "M_Stone_Granite")
    # sill corbels
    for sx in (x0 - 0.09, x1 + 0.03):
        P.prism_x([(0.0, s0 - 0.085), (-0.05, s0 - 0.085), (0.0, s0 - 0.20)], sx, sx + 0.06, "M_Plaster_Ext")
    # plaster architrave, hood cornice and keystone
    ar, pr = 0.10, 0.03
    P.box((x0 - ar, -pr, z0 - 0.0), (x0, 0.0, z1 + ar), "M_Plaster_Ext", bevel=0.008)
    P.box((x1, -pr, z0 - 0.0), (x1 + ar, 0.0, z1 + ar), "M_Plaster_Ext", bevel=0.008)
    P.box((x0, -pr, z1), (x1, 0.0, z1 + ar), "M_Plaster_Ext", bevel=0.008)
    h0 = z1 + ar
    hood = [(0.0, h0), (-0.045, h0), (-0.045, h0 + 0.02), (-0.07, h0 + 0.045), (-0.095, h0 + 0.06),
            (-0.095, h0 + 0.085), (0.0, h0 + 0.085)]
    P.sweep_x(hood, x0 - ar - 0.07, x1 + ar + 0.07, "M_Plaster_Ext")
    P.prism_y([(cx - 0.06, z1 - 0.06), (cx + 0.06, z1 - 0.06), (cx + 0.08, h0 + 0.01), (cx - 0.08, h0 + 0.01)],
              -0.055, 0.0, "M_Plaster_Ext")
    # inner sill board + shoji behind the glass ("something behind")
    P.box((x0 - 0.10, 0.25, z0 - 0.04), (x1 + 0.10, 0.34, z0), "M_Timber_Natural", bevel=0.004)
    P.box((x0 - 0.10, 0.25, z1), (x1 + 0.10, 0.34, z1 + 0.06), "M_Timber_Natural", bevel=0.004)
    pw = (x1 - x0 + 0.20) / 2 + 0.015
    sx0 = x0 - 0.10
    if shoji_open:
        shoji(P, sx0, sx0 + pw, z0, z1, 0.265)
        shoji(P, sx0 + 0.05, sx0 + 0.05 + pw, z0, z1, 0.30)
    else:
        shoji(P, sx0, sx0 + pw, z0, z1, 0.265)
        shoji(P, sx0 + pw - 0.03, sx0 + 2 * pw - 0.03, z0, z1, 0.30)


def build_lod0(parts_coll):
    rnd = random.Random(SEED)
    P = {k: Part("BldgA_LOD0_" + k) for k in
         ("walls", "sideL", "sideR", "rear", "trim", "windows", "shopfront", "roof", "awning", "signs", "services")}

    # --- front upper wall (plaster, fine grid for weathering) ---
    holes = [(cx - WIN_W / 2, Z_WIN[0] - Z_HEAD[1], cx + WIN_W / 2, Z_WIN[1] - Z_HEAD[1]) for cx in WINDOW_XS]
    P["walls"].wall((0, 0, Z_HEAD[1]), (1, 0, 0), (0, 0, 1), (0, -1, 0), W, Z_CORNICE[0] - Z_HEAD[1], T_FRONT,
                    holes, 0.12, "M_Plaster_Ext", "M_Plaster_Int", caps=())
    # pilasters (bay rhythm) and string course
    for x0, x1 in ((0.0, 0.24), (2.86, 3.14), (5.76, 6.0)):
        P["trim"].box((x0, -0.025, 3.66), (x1, 0.0, Z_CORNICE[0]), "M_Plaster_Ext", bevel=0.008)
        P["trim"].box((x0 - 0.01, -0.04, 3.66), (x1 + 0.01, 0.0, 3.80), "M_Plaster_Ext", bevel=0.008)
    P["trim"].sweep_x([(0.0, 3.52), (-0.145, 3.52), (-0.145, 3.575), (-0.11, 3.60), (-0.10, 3.63),
                       (-0.06, 3.645), (-0.06, 3.665), (0.0, 3.68)], -0.03, W + 0.03, "M_Plaster_Ext")
    # cornice with dentils
    c0 = Z_CORNICE[0]
    P["trim"].sweep_x([(0.0, c0), (-0.035, c0), (-0.035, c0 + 0.05), (-0.07, c0 + 0.065), (-0.09, c0 + 0.08),
                       (-0.09, c0 + 0.155), (-0.2, c0 + 0.17), (-0.215, c0 + 0.19), (-0.215, c0 + 0.25),
                       (-0.18, c0 + 0.27), (-0.03, c0 + 0.28), (-0.03, c0 + 0.30), (0.0, c0 + 0.30)],
                      -0.05, W + 0.05, "M_Plaster_Ext")
    x = 0.02
    while x < W - 0.05:
        P["trim"].box((x, -0.16, c0 + 0.10), (x + 0.05, -0.09, c0 + 0.155), "M_Plaster_Ext", skip=("+y",))
        x += 0.11
    # parapet: wall + raised panels + coping + central crest with a fictional mark
    pz0 = Z_CORNICE[1]
    P["walls"].wall((0, 0, pz0), (1, 0, 0), (0, 0, 1), (0, -1, 0), W, Z_PARAPET - pz0, 0.20, [], 0.15,
                    "M_Plaster_Ext", "M_Plaster_Ext", caps=("u0", "u1"))
    for x0, x1 in ((0.35, 2.55), (3.45, 5.65)):
        for a, b in (((x0, pz0 + 0.12), (x1, pz0 + 0.17)), ((x0, Z_PARAPET - 0.17), (x1, Z_PARAPET - 0.12)),
                     ((x0, pz0 + 0.17), (x0 + 0.05, Z_PARAPET - 0.17)), ((x1 - 0.05, pz0 + 0.17), (x1, Z_PARAPET - 0.17))):
            P["trim"].box((a[0], -0.02, a[1]), (b[0], 0.0, b[1]), "M_Plaster_Ext", bevel=0.006)
    cop = [(0.23, Z_PARAPET), (-0.035, Z_PARAPET), (-0.035, Z_PARAPET + 0.035), (-0.015, Z_PARAPET + 0.065),
           (0.215, Z_PARAPET + 0.075), (0.23, Z_PARAPET + 0.045)]
    P["trim"].sweep_x(cop, -0.03, W + 0.03, "M_Stone_Granite")
    # stepped central pediment (crisp coped steps) with a fictional roundel mark
    zp = Z_PARAPET + 0.075
    P["trim"].box((2.2, -0.01, zp), (3.8, 0.18, zp + 0.24), "M_Plaster_Ext", bevel=0.008)
    P["trim"].box((2.16, -0.035, zp + 0.24), (3.84, 0.2, zp + 0.29), "M_Stone_Granite", bevel=0.008)
    P["trim"].box((2.6, -0.01, zp + 0.29), (3.4, 0.16, zp + 0.47), "M_Plaster_Ext", bevel=0.008)
    P["trim"].box((2.56, -0.035, zp + 0.47), (3.44, 0.18, zp + 0.52), "M_Stone_Granite", bevel=0.008)
    for x0 in (2.3, 3.5):
        P["trim"].box((x0, -0.025, zp + 0.05), (x0 + 0.2, -0.01, zp + 0.19), "M_Plaster_Ext", bevel=0.004)
    P["trim"].cyl((3.0, -0.01, zp + 0.12), (3.0, -0.035, zp + 0.12), 0.085, 20, "M_Plaster_Ext")
    P["trim"].cyl((3.0, -0.035, zp + 0.12), (3.0, -0.045, zp + 0.12), 0.06, 20, "M_Plaster_Ext")
    P["trim"].box((2.94, -0.055, zp + 0.105), (3.06, -0.04, zp + 0.135), "M_Plaster_Ext")
    for px in (0.0, W - 0.3):
        P["trim"].box((px, -0.04, Z_PARAPET), (px + 0.3, 0.24, Z_PARAPET + 0.16), "M_Plaster_Ext", bevel=0.01)
        P["trim"].box((px - 0.015, -0.055, Z_PARAPET + 0.16), (px + 0.315, 0.255, Z_PARAPET + 0.2),
                      "M_Stone_Granite", bevel=0.008)

    # --- upper windows: left closed with shoji closed; right lower sash raised, one shoji slid open ---
    upper_window(P["windows"], WINDOW_XS[0], lower_open=0.0, shoji_open=False)
    upper_window(P["windows"], WINDOW_XS[1], lower_open=0.26, shoji_open=True)

    # --- side walls (party walls) and gables ---
    for key, x_out, n in (("sideL", 0.0, -1), ("sideR", W, 1)):
        Pw = P[key]
        O = (x_out, D if n < 0 else 0.0, Z_STREET)
        U = (0, -1, 0) if n < 0 else (0, 1, 0)
        Pw.wall(O, U, (0, 0, 1), (n, 0, 0), D, 6.0 - Z_STREET, T_SIDE, [], 0.5, "M_Plaster_Ext", "M_Plaster_Int",
                caps=("u0", "u1"))
        xi = x_out - n * T_SIDE
        xa, xb = min(x_out, xi), max(x_out, xi)
        g = [(0.25, 6.0), (D, 6.0), (D, roof_z(D) - 0.2), (RIDGE_Y, RIDGE_Z - 0.2), (0.45, roof_z(0.45) - 0.2),
             (0.25, roof_z(0.45) - 0.2)]
        Pw.prism_x(g, xa, xb, "M_Plaster_Ext")

    # --- rear wall with a barred window, back door and an upper window ---
    rh = [(3.4 - T_SIDE, 1.0 - Z_STREET, 4.4 - T_SIDE, 1.8 - Z_STREET),
          (0.8 - T_SIDE, 0.0 - Z_STREET, 1.7 - T_SIDE, 2.0 - Z_STREET),
          (2.5 - T_SIDE, 4.3 - Z_STREET, 3.5 - T_SIDE, 5.1 - Z_STREET)]
    P["rear"].wall((W - T_SIDE, D, Z_STREET), (-1, 0, 0), (0, 0, 1), (0, 1, 0), W - 2 * T_SIDE, 6.0 - Z_STREET,
                   T_REAR, [(W - 2 * T_SIDE - h[2], h[1], W - 2 * T_SIDE - h[0], h[3]) for h in rh], 0.4,
                   "M_Plaster_Ext", "M_Plaster_Int", caps=("v1",))
    for (x0, z0, x1, z1) in ((3.4, 1.0, 4.4, 1.8), (2.5, 4.3, 3.5, 5.1)):
        n = int((x1 - x0) / 0.1)
        for i in range(1, n):
            xx = x0 + (x1 - x0) * i / n
            P["rear"].cyl((xx, D - 0.05, z0), (xx, D - 0.05, z1), 0.012, 6, "M_Timber_Dark")
        shoji(P["rear"], x0, x1, z0, z1, D - T_REAR - 0.04, cols=4, rows=3)
    P["rear"].box((0.8, D - 0.10, 0.0), (1.7, D - 0.05, 2.0), "M_Timber_Aged", bevel=0.005)
    for i in range(6):
        P["rear"].box((0.8 + 0.15 * i + 0.01, D + 0.0, 0.0), (0.8 + 0.15 * i + 0.14, D + 0.01, 2.0), "M_Timber_Aged")

    # --- shopfront (ground floor) ---
    S = P["shopfront"]
    for x0, x1 in ((0.0, 0.20), (2.90, 3.10), (5.80, 6.0)):
        S.box((x0, -0.03, 0.0), (x1, 0.24, Z_HEAD[0]), "M_Timber_Dark", bevel=0.012)
        S.box((x0 - 0.02, -0.05, Z_STREET), (x1 + 0.02, 0.26, 0.0), "M_Stone_Granite", bevel=0.01)
    S.box((0.0, -0.04, Z_HEAD[0]), (W, 0.26, Z_HEAD[1]), "M_Timber_Dark", bevel=0.012)
    # bay 1: display window, small panes (157013), wooden koshi base on a granite course
    S.box((0.20, 0.10, Z_STREET), (2.90, 0.30, 0.15), "M_Stone_Granite", bevel=0.01)
    S.box((0.20, 0.18, 0.15), (2.90, 0.28, 0.62), "M_Timber_Dark")
    for i in range(7):
        xx = 0.20 + 2.7 * (i + 0.5) / 7
        S.box((xx - 0.025, 0.155, 0.15), (xx + 0.025, 0.18, 0.62), "M_Timber_Dark", bevel=0.004)
    S.box((0.20, 0.06, 0.62), (2.90, 0.30, 0.68), "M_Timber_Dark", bevel=0.008)
    S.box((0.20, 0.17, 0.68), (0.26, 0.27, Z_HEAD[0]), "M_Timber_Dark")
    S.box((2.84, 0.17, 0.68), (2.90, 0.27, Z_HEAD[0]), "M_Timber_Dark")
    S.box((0.26, 0.16, 2.18), (2.84, 0.27, 2.26), "M_Timber_Dark", bevel=0.005)
    pane_grid(S, 0.26, 2.84, 0.68, 2.18, 0.22, 4, 3, 0.03, 0.05, "M_Timber_Dark", gy=0.225, rnd=rnd)
    pane_grid(S, 0.26, 2.84, 2.26, Z_HEAD[0], 0.22, 4, 1, 0.03, 0.05, "M_Timber_Dark", gy=0.225, rnd=rnd)
    # bay 2: threshold, head rail, two sliding glazed doors (one slid open), lattice transom
    S.box((3.10, 0.02, Z_STREET), (5.80, 0.32, 0.03), "M_Stone_Granite", bevel=0.01)
    S.box((3.10, 0.10, 0.03), (5.80, 0.26, 0.045), "M_Timber_Aged")
    S.box((3.10, 0.06, 2.10), (5.80, 0.28, 2.20), "M_Timber_Dark", bevel=0.006)

    def door(x0, x1, y0, y1):
        st = 0.05
        m = "M_Timber_Dark"
        S.box((x0, y0, 0.045), (x0 + st, y1, 2.10), m, bevel=0.004)
        S.box((x1 - st, y0, 0.045), (x1, y1, 2.10), m, bevel=0.004)
        S.box((x0 + st, y0, 2.04), (x1 - st, y1, 2.10), m, bevel=0.004)
        S.box((x0 + st, y0, 0.045), (x1 - st, y1, 0.58), m, bevel=0.004)
        S.box((x0 + st + 0.03, y0 - 0.004, 0.10), (x1 - st - 0.03, y0, 0.52), "M_Timber_Aged")
        pane_grid(S, x0 + st, x1 - st, 0.58, 2.04, (y0 + y1) / 2, 2, 4, 0.02, (y1 - y0) * 0.8, m,
                  gy=(y0 + y1) / 2 + 0.003, rnd=rnd)
        S.box((x1 - st - 0.004, y0 - 0.008, 1.0), (x1 - st + 0.004, y0, 1.18), "M_Iron")

    door(3.10, 4.50, 0.11, 0.15)
    door(3.20, 4.60, 0.17, 0.21)
    S.box((3.10, 0.14, 2.20), (5.80, 0.20, 2.26), "M_Timber_Dark")
    x = 3.14
    while x < 5.78:
        S.box((x, 0.15, 2.26), (x + 0.025, 0.19, Z_HEAD[0]), "M_Timber_Dark")
        x += 0.075
    # noren over the open leaf (fictional mark: ring + bar)
    S.cyl((4.55, 0.02, 2.08), (5.80, 0.02, 2.08), 0.012, 6, "M_Bamboo")
    for k in range(3):
        nx0 = 4.60 + k * 0.40
        nx1 = nx0 + 0.38
        cols, rows = 4, 6
        grid = []
        for j in range(rows + 1):
            row = []
            for i in range(cols + 1):
                xx = nx0 + (nx1 - nx0) * i / cols
                zz = 2.08 - 0.72 * j / rows
                yy = 0.005 - 0.018 * math.sin(xx * 9 + k) * (j / rows) - 0.02 * (j / rows) ** 2
                row.append((xx, yy, zz))
            grid.append(row)
        for j in range(rows):
            for i in range(cols):
                S.face([grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]], "M_Cloth_Indigo",
                       out=(0, -1, 0))
                S.face([grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]], "M_Cloth_Indigo",
                       out=(0, 1, 0))
    for r_in, r_out in ((0.10, 0.13),):
        ring = 20
        for i in range(ring):
            a0, a1 = 2 * math.pi * i / ring, 2 * math.pi * (i + 1) / ring
            cx, cz = 5.20, 1.72
            S.face([(cx + r_in * math.cos(a0), -0.02, cz + r_in * math.sin(a0)),
                    (cx + r_out * math.cos(a0), -0.02, cz + r_out * math.sin(a0)),
                    (cx + r_out * math.cos(a1), -0.02, cz + r_out * math.sin(a1)),
                    (cx + r_in * math.cos(a1), -0.02, cz + r_in * math.sin(a1))], "M_Cloth_White", out=(0, -1, 0))
    S.box((5.09, -0.022, 1.705), (5.31, -0.019, 1.735), "M_Cloth_White")

    # --- fascia board with gilt letters, read right to left (period practice, photo 157016) ---
    G = P["signs"]
    G.box((0.05, -0.10, Z_FASCIA[0]), (W - 0.05, -0.01, Z_FASCIA[1]), "M_Lacquer_Black", bevel=0.01)
    for a, b in (((0.02, Z_FASCIA[0] - 0.02), (W - 0.02, Z_FASCIA[0] + 0.02)),
                 ((0.02, Z_FASCIA[1] - 0.02), (W - 0.02, Z_FASCIA[1] + 0.02)),
                 ((0.02, Z_FASCIA[0]), (0.07, Z_FASCIA[1])), ((W - 0.07, Z_FASCIA[0]), (W - 0.02, Z_FASCIA[1]))):
        G.box((a[0], -0.125, a[1]), (b[0], -0.005, b[1]), "M_Timber_Dark", bevel=0.006)
    zc = (Z_FASCIA[0] + Z_FASCIA[1]) / 2
    me = text_mesh("堂榮新", 0.44, 1.2)
    G.add_mesh(me, Matrix.Translation((4.35, -0.104, zc - 0.01)) @ facing("-y"), "M_Gilt")
    me = text_mesh("品粧化物間小", 0.30, 1.08)
    G.add_mesh(me, Matrix.Translation((1.75, -0.104, zc - 0.01)) @ facing("-y"), "M_Gilt")
    for xx in (0.25, W - 0.25, 3.05):
        G.cyl((xx, -0.10, zc), (xx, -0.115, zc), 0.022, 8, "M_Brass")
    # disc signboard on an iron bracket (photo 158514: hanging disc signs); fictional character
    bx, bz = 0.22, 4.95
    G.box((bx - 0.04, -0.01, bz - 0.25), (bx + 0.04, 0.0, bz + 0.12), "M_Iron")
    G.beam((bx, 0.0, bz), (bx, -1.0, bz), 0.03, 0.04, "M_Iron")
    G.beam((bx, 0.0, bz - 0.22), (bx, -0.62, bz - 0.01), 0.02, 0.02, "M_Iron")
    pts = [(bx, -0.62 - 0.12 * math.sin(a), bz - 0.13 + 0.12 * math.cos(a)) for a in np.linspace(0, math.pi * 1.4, 8)]
    G.tube(pts, 0.009, 6, "M_Iron")
    dc = V(bx, -0.62, bz - 0.47)
    for yy in (-0.44, -0.80):
        G.cyl((bx, yy, bz - 0.02), (bx, yy, dc.z + 0.40), 0.006, 5, "M_Iron")
    G.cyl(dc - V(0.035, 0, 0), dc + V(0.035, 0, 0), 0.40, 32, "M_Lacquer_Black")
    G.cyl(dc - V(0.04, 0, 0), dc + V(0.04, 0, 0), 0.34, 32, "M_Lacquer_Red", caps=(False, False))
    for s in (-1, 1):
        G.cyl(dc + V(s * 0.035, 0, 0), dc + V(s * 0.039, 0, 0), 0.34, 32, "M_Paper_Goods", caps=(False, True))
        me = text_mesh("榮", 0.40)
        G.add_mesh(me, Matrix.Translation(dc + V(s * 0.041, 0, -0.015)) @ facing("+x" if s > 0 else "-x"),
                   "M_Lacquer_Black")
        ring = 32
        for i in range(ring):
            a0, a1 = 2 * math.pi * i / ring, 2 * math.pi * (i + 1) / ring
            pts4 = [(dc.x + s * 0.0405, dc.y + r * math.cos(a), dc.z + r * math.sin(a))
                    for r, a in ((0.25, a0), (0.28, a0), (0.28, a1), (0.25, a1))]
            G.face(pts4, "M_Lacquer_Red", out=(s, 0, 0))
    # house-number plate (fictional number)
    G.box((5.84, -0.045, 1.55), (5.96, -0.035, 1.88), "M_Ceramic_White", bevel=0.004)
    me = text_mesh("二\n丁\n目", 0.07)
    G.add_mesh(me, Matrix.Translation((5.90, -0.047, 1.72)) @ facing("-y"), "M_Goods_Indigo")

    # --- awning (158514: deep ground-floor shades) ---
    A = P["awning"]
    ax0, ax1 = 0.12, 5.74
    yz_top, yz_bot = (-0.10, Z_FASCIA[0] - 0.03), (-1.15, 2.48)
    nx, ny = 28, 5
    brackets = (ax0 + 0.05, (ax0 + ax1) / 2, ax1 - 0.05)
    grid = []
    for j in range(ny + 1):
        t = j / ny
        row = []
        for i in range(nx + 1):
            xx = ax0 + (ax1 - ax0) * i / nx
            dist = min(abs(xx - b) for b in brackets) / ((ax1 - ax0) / 4)
            sag = 0.05 * math.sin(math.pi * t) * min(1, dist)
            yy = yz_top[0] + (yz_bot[0] - yz_top[0]) * t
            zz = yz_top[1] + (yz_bot[1] - yz_top[1]) * t - sag
            row.append((xx, yy, zz))
        grid.append(row)
    for j in range(ny):
        for i in range(nx):
            q = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]]
            A.face(q, "M_Canvas_Awning", out=(0, -0.4, 1))
            A.face([(p[0], p[1], p[2] - 0.004) for p in q], "M_Canvas_Awning", out=(0, 0.4, -1))
    # scalloped valance
    vy, vz = yz_bot
    n_sc = 24
    for i in range(n_sc):
        xa = ax0 + (ax1 - ax0) * i / n_sc
        xb = ax0 + (ax1 - ax0) * (i + 1) / n_sc
        sub = 3
        for k in range(sub):
            x_a = xa + (xb - xa) * k / sub
            x_b = xa + (xb - xa) * (k + 1) / sub
            za = vz - 0.16 - 0.06 * math.sin(math.pi * k / sub)
            zb = vz - 0.16 - 0.06 * math.sin(math.pi * (k + 1) / sub)
            q = [(x_a, vy, vz), (x_b, vy, vz), (x_b, vy, zb), (x_a, vy, za)]
            A.face(q, "M_Canvas_Awning", out=(0, -1, 0))
            A.face([(p[0], p[1] + 0.004, p[2]) for p in q], "M_Canvas_Awning", out=(0, 1, 0))
        # painted border stripe on the valance
        A.face([(xa, vy - 0.002, vz - 0.03), (xb, vy - 0.002, vz - 0.03), (xb, vy - 0.002, vz - 0.07),
                (xa, vy - 0.002, vz - 0.07)], "M_Goods_Red", out=(0, -1, 0))
    A.cyl((ax0 - 0.03, vy + 0.01, vz), (ax1 + 0.03, vy + 0.01, vz), 0.016, 8, "M_Iron")
    A.cyl((ax0, -0.08, yz_top[1] + 0.01), (ax1, -0.08, yz_top[1] + 0.01), 0.035, 10, "M_Timber_Dark")
    for bxx in brackets:
        A.cyl((bxx, 0.0, 2.15), (bxx, vy + 0.02, vz - 0.01), 0.013, 6, "M_Iron")
        A.box((bxx - 0.04, -0.02, 2.08), (bxx + 0.04, 0.0, 2.22), "M_Iron")
        pts = [(bxx, -0.02 - 0.45 * s, 2.15 + 0.3 * s * s) for s in np.linspace(0, 1, 6)]
        A.tube(pts, 0.008, 5, "M_Iron")

    # --- roof: sanwa-type pan tiles (rolls modelled, courses in the generated normal/albedo map) ---
    R = P["roof"]
    x0r, x1r = -0.12, W + 0.12
    nper = 22
    per = (x1r - x0r) / nper
    prof_u = [0.0, 0.18, 0.36, 0.54, 0.66, 0.78, 0.9]

    def h_of(u):
        return -0.022 * math.sin(math.pi * u / 0.6) if u < 0.6 else 0.035 * math.sin(math.pi * (u - 0.6) / 0.4)

    xs = [x0r + per * (k + u) for k in range(nper) for u in prof_u] + [x1r]
    hs = [h_of(u) for k in range(nper) for u in prof_u] + [0.0]
    for (ya, yb) in ((0.42, RIDGE_Y), (RIDGE_Y, EAVE_Y_REAR)):
        rows = 2
        slope_len = math.hypot(yb - ya, roof_z(ya) - roof_z(yb))
        sgn = -1 if yb < RIDGE_Y + 0.01 and ya < RIDGE_Y else 1
        nrm = V(0, -PITCH if ya < RIDGE_Y else PITCH, 1).normalized()
        grid = []
        for j in range(rows + 1):
            yy = ya + (yb - ya) * j / rows
            row = [V(xx, yy, roof_z(yy)) + nrm * hh for xx, hh in zip(xs, hs)]
            grid.append(row)
        for j in range(rows):
            for i in range(len(xs) - 1):
                sa = slope_len * j / rows / 2.0
                sb = slope_len * (j + 1) / rows / 2.0
                ua, ub = (xs[i] - x0r) / (8 * per), (xs[i + 1] - x0r) / (8 * per)
                if ya >= RIDGE_Y:
                    sa, sb = slope_len / 2.0 - sa, slope_len / 2.0 - sb
                R.face([grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]], "M_Tile_Roof", out=nrm,
                       uvs=[(ua, sa), (ub, sa), (ub, sb), (ua, sb)])
        # underside boards (sheathing), visible under the rear eave
        R.face([(x0r, ya, roof_z(ya) - 0.10), (x1r, ya, roof_z(ya) - 0.10), (x1r, yb, roof_z(yb) - 0.10),
                (x0r, yb, roof_z(yb) - 0.10)], "M_Timber_Aged", out=-nrm)
    # eave-end tiles (rear) + eave board, rafters tails, gutter
    ye = EAVE_Y_REAR
    ze = roof_z(ye)
    R.box((x0r, ye - 0.02, ze - 0.12), (x1r, ye + 0.02, ze - 0.02), "M_Tile_Roof")
    for k in range(nper):
        cx = x0r + per * (k + 0.78)
        R.cyl((cx, ye, ze + 0.0), (cx, ye + 0.03, ze + 0.0), 0.055, 8, "M_Tile_Roof")
    R.box((x0r, ye - 0.06, ze - 0.26), (x1r, ye - 0.02, ze - 0.10), "M_Timber_Dark")
    x = 0.1
    while x < W:
        R.beam((x, 8.6, roof_z(8.6) - 0.17), (x, ye - 0.06, roof_z(ye - 0.06) - 0.17), 0.045, 0.06,
               "M_Timber_Aged", up=V(0, PITCH, 1))
        x += 0.45
    R.cyl((x0r, ye + 0.08, ze - 0.2), (x1r, ye + 0.08, ze - 0.2), 0.06, 8, "M_Copper_Aged", caps=(True, True))
    R.cyl((5.7, ye + 0.08, ze - 0.2), (5.7, ye + 0.08, Z_STREET), 0.035, 8, "M_Copper_Aged")
    # ridge: stacked noshi tiles + round cap + generic ridge-end blocks (onigawara as plain shapes)
    for i, (w2, zz) in enumerate(((0.17, 0.03), (0.15, 0.08), (0.13, 0.13))):
        R.box((x0r - 0.02, RIDGE_Y - w2, RIDGE_Z - 0.02 + zz - 0.05), (x1r + 0.02, RIDGE_Y + w2, RIDGE_Z + zz),
              "M_Tile_Roof", bevel=0.008)
    R.cyl((x0r - 0.03, RIDGE_Y, RIDGE_Z + 0.14), (x1r + 0.03, RIDGE_Y, RIDGE_Z + 0.14), 0.085, 12, "M_Tile_Roof")
    for ex, dx in ((x0r - 0.05, -1), (x1r + 0.05, 1)):
        R.box((ex - 0.05, RIDGE_Y - 0.22, RIDGE_Z - 0.1), (ex + 0.05, RIDGE_Y + 0.22, RIDGE_Z + 0.36),
              "M_Tile_Roof", bevel=0.03)
        R.cyl((ex + dx * 0.05, RIDGE_Y, RIDGE_Z + 0.15), (ex + dx * 0.07, RIDGE_Y, RIDGE_Z + 0.15), 0.12, 14,
              "M_Tile_Roof")
    # verge tiles along both gables
    for vx in (x0r, x1r):
        for (ya, yb) in ((0.42, RIDGE_Y), (RIDGE_Y, EAVE_Y_REAR)):
            nseg = 6
            for s in range(nseg):
                y_a = ya + (yb - ya) * s / nseg
                y_b = ya + (yb - ya) * (s + 1) / nseg
                R.beam((vx, y_a, roof_z(y_a) + 0.03), (vx, y_b, roof_z(y_b) + 0.03), 0.11, 0.07, "M_Tile_Roof")
    # box gutter behind the parapet
    R.box((0.0, 0.20, 6.08), (W, 0.45, 6.14), "M_Copper_Aged")

    # --- services: downpipe, bracket lantern, insulators, wire entry ---
    Sv = P["services"]
    dx, dy = 5.93, -0.075
    Sv.box((dx - 0.09, dy - 0.07, 6.22), (dx + 0.07, dy + 0.075, 6.45), "M_Copper_Aged", bevel=0.01)
    Sv.cyl((dx, dy, 6.22), (dx, dy, 3.62), 0.045, 10, "M_Copper_Aged")
    Sv.cyl((dx, dy, 3.62), (dx, dy - 0.08, 3.5), 0.045, 10, "M_Copper_Aged")
    Sv.cyl((dx, dy - 0.08, 3.5), (dx, dy - 0.08, 0.2), 0.045, 10, "M_Copper_Aged")
    Sv.cyl((dx, dy - 0.08, 0.2), (dx, dy - 0.3, Z_STREET + 0.03), 0.045, 10, "M_Copper_Aged")
    for zz in (0.9, 2.0, 4.3, 5.4):
        yy = dy - (0.08 if zz < 3.5 else 0.0)
        Sv.box((dx - 0.06, yy - 0.055, zz), (dx + 0.06, yy + 0.055, zz + 0.03), "M_Iron")
        Sv.box((dx - 0.015, yy, zz), (dx + 0.015, 0.0, zz + 0.03), "M_Iron")
    # bracket lantern over the centre post (157013: lantern on a bracket)
    lx, lz = 3.0, 3.98
    Sv.box((lx - 0.05, -0.02, lz - 0.1), (lx + 0.05, 0.0, lz + 0.12), "M_Iron")
    Sv.beam((lx, 0.0, lz), (lx, -0.46, lz), 0.02, 0.025, "M_Iron")
    Sv.tube([(lx, -0.02, lz - 0.1), (lx, -0.2, lz - 0.08), (lx, -0.35, lz - 0.02), (lx, -0.44, lz)], 0.007, 5,
            "M_Iron")
    lc = V(lx, -0.44, lz - 0.30)
    Sv.cyl(lc + V(0, 0, 0.2), lc + V(0, 0, 0.25), 0.01, 5, "M_Iron")
    Sv.lathe(lc + V(0, 0, 0.14), [(0.16, 0.0), (0.02, 0.07), (0.0, 0.08)], 6, "M_Iron")
    Sv.lathe(lc + V(0, 0, -0.14), [(0.07, 0.0), (0.105, 0.02), (0.11, 0.03)], 6, "M_Iron")
    Sv.lathe(lc + V(0, 0, -0.11), [(0.10, 0.0), (0.13, 0.25)], 6, "M_Glass", cap_top=False)
    Sv.lathe(lc + V(0, 0, -0.1), [(0.0, 0.0), (0.03, 0.03), (0.035, 0.07), (0.02, 0.1), (0.0, 0.11)], 8, "M_Bulb")
    for i in range(6):
        a = 2 * math.pi * i / 6
        Sv.beam(lc + V(0.10 * math.cos(a), 0.10 * math.sin(a), -0.11), lc + V(0.13 * math.cos(a), 0.13 * math.sin(a), 0.14),
                0.012, 0.012, "M_Iron")
    # insulator bracket + wire entry tube
    ix, iz = 5.55, 6.0
    Sv.beam((ix - 0.35, -0.02, iz), (ix + 0.1, -0.02, iz), 0.03, 0.04, "M_Iron")
    for k in range(3):
        px = ix - 0.3 + 0.13 * k
        Sv.cyl((px, -0.03, iz + 0.02), (px, -0.03, iz + 0.07), 0.006, 5, "M_Iron")
        Sv.lathe((px, -0.03, iz + 0.07), [(0.03, 0), (0.035, 0.03), (0.022, 0.05), (0.028, 0.07), (0.0, 0.085)],
                 8, "M_Ceramic_White")
    Sv.cyl((5.35, 0.0, 5.2), (5.35, -0.06, 5.25), 0.018, 8, "M_Ceramic_White")
    Sv.tube([(ix - 0.3, -0.03, iz + 0.14), (5.42, -0.05, 5.8), (5.37, -0.06, 5.3)], 0.004, 4, "M_Soot")

    return P


# ----------------------------------------------------------------------------------------------
# LOD1 / LOD2 exterior
# ----------------------------------------------------------------------------------------------
def build_lod1():
    P = Part("BldgA_LOD1_Exterior")
    holes = [(cx - WIN_W / 2, Z_WIN[0] - Z_HEAD[1], cx + WIN_W / 2, Z_WIN[1] - Z_HEAD[1]) for cx in WINDOW_XS]
    P.wall((0, 0, Z_HEAD[1]), (1, 0, 0), (0, 0, 1), (0, -1, 0), W, Z_PARAPET - Z_HEAD[1], T_FRONT, holes, 0.6,
           "M_Plaster_Ext", "M_Plaster_Int", caps=("v1",))
    for x0, x1 in ((0.0, 0.2), (2.9, 3.1), (5.8, 6.0)):
        P.box((x0, -0.03, 0.0), (x1, 0.24, Z_HEAD[0]), "M_Timber_Dark")
    P.box((0.0, -0.04, Z_HEAD[0]), (W, 0.26, Z_HEAD[1]), "M_Timber_Dark")
    P.box((0.2, 0.18, Z_STREET), (2.9, 0.28, 0.68), "M_Timber_Dark")
    for (x0, x1, y) in ((0.2, 2.9, 0.22), (3.1, 4.5, 0.13), (4.5, 5.8, 0.4)):
        P.face([(x0, y, 0.68 if x1 < 3 else 0.05), (x1, y, 0.68 if x1 < 3 else 0.05), (x1, y, Z_HEAD[0]),
                (x0, y, Z_HEAD[0])], "M_Glass" if x1 < 5 else "M_Plaster_Int", out=(0, -1, 0),
               uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
    P.box((3.1, 0.06, 2.1), (5.8, 0.28, 2.2), "M_Timber_Dark")
    P.box((3.1, 0.1, 0.05), (3.15, 0.15, 2.1), "M_Timber_Dark")
    P.box((4.45, 0.1, 0.05), (4.5, 0.15, 2.1), "M_Timber_Dark")
    for cx in WINDOW_XS:
        x0, x1 = cx - 0.5, cx + 0.5
        z0, z1 = Z_WIN
        for a, b in (((x0, z0), (x0 + 0.065, z1)), ((x1 - 0.065, z0), (x1, z1)), ((x0, z1 - 0.065), (x1, z1)),
                     ((x0, z0), (x1, z0 + 0.06)), ((x0, (z0 + z1) / 2 - 0.02), (x1, (z0 + z1) / 2 + 0.02)),
                     ((cx - 0.012, z0), (cx + 0.012, z1))):
            P.box((a[0], 0.10, a[1]), (b[0], 0.19, b[1]), "M_Timber_Paint")
        P.face([(x0, 0.15, z0), (x1, 0.15, z0), (x1, 0.15, z1), (x0, 0.15, z1)], "M_Glass", out=(0, -1, 0),
               uvs=[(0, 0), (2, 0), (2, 2), (0, 2)])
        P.face([(x0, 0.27, z0), (x1, 0.27, z0), (x1, 0.27, z1), (x0, 0.27, z1)], "M_Paper_Shoji", out=(0, -1, 0))
        P.box((x0 - 0.12, -0.07, z0 - 0.09), (x1 + 0.12, 0.1, z0), "M_Stone_Granite")
        P.box((x0 - 0.1, -0.03, z1), (x1 + 0.1, 0.0, z1 + 0.19), "M_Plaster_Ext")
    P.sweep_x([(0.0, Z_CORNICE[0]), (-0.09, Z_CORNICE[0] + 0.08), (-0.215, Z_CORNICE[0] + 0.19),
               (-0.215, Z_CORNICE[0] + 0.25), (0.0, Z_CORNICE[0] + 0.30)], -0.05, W + 0.05, "M_Plaster_Ext")
    P.sweep_x([(0.0, 3.52), (-0.145, 3.52), (-0.145, 3.6), (0.0, 3.68)], -0.03, W + 0.03, "M_Plaster_Ext")
    P.box((-0.03, -0.035, Z_PARAPET), (W + 0.03, 0.23, Z_PARAPET + 0.07), "M_Stone_Granite")
    P.prism_y([(2.25, Z_PARAPET + 0.07), (2.4, Z_PARAPET + 0.3), (3.0, Z_PARAPET + 0.38), (3.6, Z_PARAPET + 0.3),
               (3.75, Z_PARAPET + 0.07)], -0.02, 0.19, "M_Plaster_Ext")
    P.box((0.05, -0.10, Z_FASCIA[0]), (W - 0.05, -0.01, Z_FASCIA[1]), "M_Lacquer_Black")
    P.box((1.0, -0.102, 3.1), (2.5, -0.1, 3.38), "M_Gilt")
    P.box((3.8, -0.102, 3.06), (4.9, -0.1, 3.42), "M_Gilt")
    for key, xo in (("L", 0.0), ("R", W)):
        P.box((min(xo, xo + (T_SIDE if xo == 0 else -T_SIDE)), 0.0, Z_STREET),
              (max(xo, xo + (T_SIDE if xo == 0 else -T_SIDE)), D, 6.0), "M_Plaster_Ext")
    P.box((T_SIDE, D - T_REAR, Z_STREET), (W - T_SIDE, D, 6.0), "M_Plaster_Ext")
    # roof: triangle-wave rolls (3 verts per period)
    x0r, x1r, nper = -0.12, W + 0.12, 22
    per = (x1r - x0r) / nper
    for (ya, yb) in ((0.42, RIDGE_Y), (RIDGE_Y, EAVE_Y_REAR)):
        nrm = V(0, -PITCH if ya < RIDGE_Y else PITCH, 1).normalized()
        xs = [x0r + per * (k + u) for k in range(nper) for u in (0.0, 0.3, 0.75)] + [x1r]
        hh = [0.0, -0.02, 0.035] * nper + [0.0]
        slope_len = math.hypot(yb - ya, roof_z(ya) - roof_z(yb)) / 2.0
        for i in range(len(xs) - 1):
            a0 = V(xs[i], ya, roof_z(ya)) + nrm * hh[i]
            a1 = V(xs[i + 1], ya, roof_z(ya)) + nrm * hh[i + 1]
            b1 = V(xs[i + 1], yb, roof_z(yb)) + nrm * hh[i + 1]
            b0 = V(xs[i], yb, roof_z(yb)) + nrm * hh[i]
            ua, ub = (xs[i] - x0r) / (8 * per), (xs[i + 1] - x0r) / (8 * per)
            P.face([a0, a1, b1, b0], "M_Tile_Roof", out=nrm, uvs=[(ua, 0), (ub, 0), (ub, slope_len), (ua, slope_len)])
        P.face([(x0r, ya, roof_z(ya) - 0.1), (x1r, ya, roof_z(ya) - 0.1), (x1r, yb, roof_z(yb) - 0.1),
                (x0r, yb, roof_z(yb) - 0.1)], "M_Timber_Aged", out=-nrm)
    P.box((x0r, RIDGE_Y - 0.15, RIDGE_Z - 0.05), (x1r, RIDGE_Y + 0.15, RIDGE_Z + 0.2), "M_Tile_Roof")
    for ex in (x0r - 0.05, x1r + 0.05):
        P.box((ex - 0.05, RIDGE_Y - 0.22, RIDGE_Z - 0.1), (ex + 0.05, RIDGE_Y + 0.22, RIDGE_Z + 0.36), "M_Tile_Roof")
    for sx, sgn in ((0.0, 1), (W, -1)):
        g = [(0.25, 6.0), (D, 6.0), (D, roof_z(D) - 0.2), (RIDGE_Y, RIDGE_Z - 0.2), (0.45, roof_z(0.45) - 0.2)]
        P.prism_x(g, min(sx, sx + sgn * T_SIDE), max(sx, sx + sgn * T_SIDE), "M_Plaster_Ext")
    # awning + valance
    P.face([(0.12, -0.1, 2.93), (5.74, -0.1, 2.93), (5.74, -1.15, 2.48), (0.12, -1.15, 2.48)], "M_Canvas_Awning",
           out=(0, -0.4, 1))
    P.face([(0.12, -0.1, 2.925), (5.74, -0.1, 2.925), (5.74, -1.15, 2.475), (0.12, -1.15, 2.475)],
           "M_Canvas_Awning", out=(0, 0.4, -1))
    P.box((0.12, -1.155, 2.28), (5.74, -1.145, 2.48), "M_Canvas_Awning")
    P.box((0.19, -1.0, 4.93), (0.25, 0.0, 4.97), "M_Iron")
    P.cyl((0.18, -0.62, 4.48), (0.26, -0.62, 4.48), 0.40, 12, "M_Lacquer_Black")
    P.cyl((5.93, -0.075, 6.3), (5.93, -0.155, Z_STREET), 0.045, 6, "M_Copper_Aged")
    return P


def build_lod2():
    P = Part("BldgA_LOD2_Exterior")
    P.box((0, 0.0, Z_STREET), (W, D, 6.0), "M_Plaster_Ext", skip=("-z", "-y"))
    # front face with recessed openings (dark backing), windows as inset boxes
    P.face([(0, 0, Z_HEAD[1]), (W, 0, Z_HEAD[1]), (W, 0, Z_PARAPET), (0, 0, Z_PARAPET)], "M_Plaster_Ext", out=(0, -1, 0))
    P.box((0, 0, 6.0), (W, 0.2, Z_PARAPET), "M_Plaster_Ext", skip=("-y", "-z"))
    for cx in WINDOW_XS:
        P.face([(cx - 0.5, -0.002, Z_WIN[0]), (cx + 0.5, -0.002, Z_WIN[0]), (cx + 0.5, -0.002, Z_WIN[1]),
                (cx - 0.5, -0.002, Z_WIN[1])], "M_Timber_Paint", out=(0, -1, 0))
        P.box((cx - 0.62, -0.07, Z_WIN[0] - 0.09), (cx + 0.62, 0.0, Z_WIN[0]), "M_Stone_Granite", skip=("+y",))
    P.face([(0, 0.2, Z_STREET), (W, 0.2, Z_STREET), (W, 0.2, Z_HEAD[1]), (0, 0.2, Z_HEAD[1])], "M_Timber_Dark",
           out=(0, -1, 0))
    P.box((0, -0.1, Z_FASCIA[0]), (W, 0.0, Z_FASCIA[1]), "M_Lacquer_Black", skip=("+y",))
    P.box((-0.05, -0.2, Z_CORNICE[0]), (W + 0.05, 0.0, Z_CORNICE[1]), "M_Plaster_Ext", skip=("+y",))
    P.face([(0.12, -0.1, 2.93), (5.74, -0.1, 2.93), (5.74, -1.15, 2.4), (0.12, -1.15, 2.4)], "M_Canvas_Awning",
           out=(0, -0.4, 1))
    P.face([(0.12, -0.1, 2.93), (5.74, -0.1, 2.93), (5.74, -1.15, 2.4), (0.12, -1.15, 2.4)], "M_Canvas_Awning",
           out=(0, 0.4, -1))
    P.prism_x([(0.42, roof_z(0.42)), (RIDGE_Y, RIDGE_Z), (EAVE_Y_REAR, roof_z(EAVE_Y_REAR)),
               (D, 6.0), (0.42, 6.0)], -0.12, W + 0.12, "M_Tile_Roof")
    P.cyl((0.18, -0.62, 4.48), (0.26, -0.62, 4.48), 0.40, 8, "M_Lacquer_Black")
    return P


# ----------------------------------------------------------------------------------------------
# Interior cell (structure + props)
# ----------------------------------------------------------------------------------------------
def tatami_area(P, x0, x1, y0, y1, z_top, long_along_x=True, rows=3):
    """Staggered layout (no four-corner joints)."""
    depth = (y1 - y0) / rows
    full = depth * 2
    for r in range(rows):
        ya, yb = y0 + depth * r, y0 + depth * (r + 1)
        n_full = max(1, round((x1 - x0) / full))
        L = (x1 - x0) / n_full
        cuts = [x0 + L * i for i in range(n_full + 1)]
        if r % 2 == 1:
            cuts = [x0] + [x0 + L * (i + 0.5) for i in range(n_full)] + [x1]
        for a, b in zip(cuts[:-1], cuts[1:]):
            P.box((a + 0.002, ya + 0.002, z_top - 0.055), (b - 0.002, yb - 0.002, z_top - 0.002), "M_Tatami",
                  skip=("+z", "-z"))
            P.face([(a + 0.002, ya + 0.002, z_top), (b - 0.002, ya + 0.002, z_top), (b - 0.002, yb - 0.002, z_top),
                    (a + 0.002, yb - 0.002, z_top)], "M_Tatami", out=(0, 0, 1),
                   uvs=[(0, 0), ((b - a), 0), ((b - a), (yb - ya)), (0, (yb - ya))])
            for yy in (ya + 0.002, yb - 0.032):
                P.box((a + 0.002, yy, z_top - 0.01), (b - 0.002, yy + 0.03, z_top + 0.002), "M_Cloth_Heri")


def zabuton(P, cx, cy, z, rot=0.0):
    M = Matrix.Translation((cx, cy, z + 0.035)) @ Matrix.Rotation(rot, 4, "Z") @ Matrix.Diagonal((0.55, 0.6, 0.07, 1))
    P.cube(M, "M_Cloth_Zabuton", bevel=0.025)


def build_interior():
    rnd = random.Random(SEED + 1)
    S = Part("BldgA_Interior_Structure", wear=False)
    Pp = Part("BldgA_Interior_Props", wear=False)
    lights = []
    xi0, xi1 = T_SIDE, W - T_SIDE
    yb = D - T_REAR
    # --- ground: doma (earth floor), raised floor, beams, joists, boards ---
    nx, ny = 12, 11
    for i in range(nx):
        for j in range(ny):
            x0 = xi0 + (xi1 - xi0) * i / nx
            x1 = xi0 + (xi1 - xi0) * (i + 1) / nx
            y0 = 0.26 + (5.40 - 0.26) * j / ny
            y1 = 0.26 + (5.40 - 0.26) * (j + 1) / ny
            S.face([(x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0)], "M_Earth_Doma", out=(0, 0, 1))
    S.box((xi0, 5.40, 0.0), (xi1, 5.45, 0.40), "M_Timber_Aged")
    S.box((xi0, 5.40, 0.33), (xi1, 5.56, Z_RAISED), "M_Lacquer_Black", bevel=0.01)
    S.box((xi0, 5.56, 0.40), (xi1, 6.02, Z_RAISED), "M_Timber_Natural")
    for k in range(6):
        yy = 5.56 + k * 0.077
        S.box((xi0, yy, Z_RAISED - 0.001), (xi1, yy + 0.002, Z_RAISED + 0.0005), "M_Timber_Dark")
    S.box((STAIR["x0"], 6.02, 0.40), (xi1, yb, Z_RAISED), "M_Timber_Natural")
    tatami_area(S, xi0, STAIR["x0"], 6.02, yb, Z_RAISED + 0.002, rows=3)
    # stepping stone and the geta left on it (trace of use)
    Pp.prism_y([(3.45, 0.0), (4.15, 0.0), (4.2, 0.12), (4.1, 0.2), (3.5, 0.2), (3.42, 0.1)], 5.02, 5.38,
               "M_Stone_Granite")
    for gx in (3.62, 3.83):
        Pp.box((gx, 5.08, 0.235), (gx + 0.1, 5.30, 0.255), "M_Timber_Light", bevel=0.004)
        Pp.box((gx, 5.12, 0.2), (gx + 0.1, 5.135, 0.235), "M_Timber_Light")
        Pp.box((gx, 5.24, 0.2), (gx + 0.1, 5.255, 0.235), "M_Timber_Light")
        Pp.cyl((gx + 0.05, 5.11, 0.256), (gx + 0.05, 5.2, 0.265), 0.006, 4, "M_Cloth_Red")
    # beams (spanning side to side), joists, floor boards with the stair well
    for yy in (0.26, 2.85, 5.45, yb - 0.16):
        S.box((xi0, yy, 3.0), (xi1, yy + 0.16, Z_CEIL_G), "M_Timber_Aged", bevel=0.01)
    x = xi0 + 0.2
    while x < xi1 - 0.05:
        if not (STAIR["x0"] - 0.05 < x < xi1 and 6.3 < 7.0):
            S.box((x - 0.04, 0.26, Z_CEIL_G), (x + 0.04, yb, 3.37), "M_Timber_Aged")
        else:
            S.box((x - 0.04, 0.26, Z_CEIL_G), (x + 0.04, 6.35, 3.37), "M_Timber_Aged")
            S.box((x - 0.04, 8.27, Z_CEIL_G), (x + 0.04, yb, 3.37), "M_Timber_Aged")
        x += 0.45
    well = (STAIR["x0"], 6.35, xi1, 8.27)
    for a, b in (((xi0, 0.26), (xi1, well[1])), ((xi0, well[1]), (well[0], well[3])), ((xi0, well[3]), (xi1, yb))):
        S.box((a[0], a[1], 3.37), (b[0], b[1], 3.40), "M_Timber_Natural")
    S.box((well[0] - 0.08, well[1], 3.0), (well[0], well[3], 3.40), "M_Timber_Aged")
    # --- box staircase with drawers (hako-kaidan) ---
    sx0, sx1, sy0, go = STAIR["x0"], STAIR["x1"], STAIR["y0"], STAIR["going"]
    rise = (Z_F2 - Z_RAISED) / STAIR["risers"]
    for k in range(1, STAIR["risers"]):
        y0, y1 = sy0 + (k - 1) * go, sy0 + k * go
        ztop = Z_RAISED + k * rise
        S.box((sx0, y0, Z_RAISED), (sx1, y1, ztop - 0.03), "M_Timber_Natural")
        S.box((sx0 - 0.005, y0 - 0.02, ztop - 0.03), (sx1, y1, ztop), "M_Timber_Light", bevel=0.005)
    # drawers and a cupboard in the stair side (x = sx0 face)
    for (za, zb, ya, yb2) in ((0.50, 0.70, 6.00, 6.40), (0.50, 0.70, 6.42, 6.82), (0.74, 0.94, 6.42, 6.82),
                              (0.74, 0.94, 6.84, 7.24), (0.98, 1.18, 6.84, 7.24), (0.50, 1.18, 7.26, 7.94),
                              (1.22, 1.62, 7.26, 7.94), (0.50, 1.62, 7.96, 8.50)):
        Pp.box((sx0 - 0.012, ya, za), (sx0, yb2, zb), "M_Timber_Light", bevel=0.003)
        Pp.box((sx0 - 0.025, (ya + yb2) / 2 - 0.04, (za + zb) / 2 - 0.006), (sx0 - 0.012, (ya + yb2) / 2 + 0.04,
                                                                             (za + zb) / 2 + 0.006), "M_Iron")
    # upper floor: railing around the well
    for yy in (well[1] + 0.05, 7.3, well[3] - 0.05):
        S.box((well[0] - 0.05, yy - 0.03, 3.40), (well[0] + 0.01, yy + 0.03, 4.25), "M_Timber_Natural")
    S.box((well[0] - 0.06, well[1], 4.20), (well[0] + 0.02, well[3], 4.27), "M_Timber_Natural", bevel=0.01)
    S.box((well[0], well[1] - 0.05, 3.40), (xi1, well[1] + 0.01, 4.25), "M_Timber_Natural")
    # --- upper floor: tatami front room, fusuma partition + ranma, board floor at the back ---
    tatami_area(S, xi0, xi1, 0.26, 4.75, Z_F2, rows=5)
    # shinkabe framing: exposed posts (hashira) and a nageshi band in the upper room; posts in the shop
    for (px, py) in ((xi0, 0.26), (xi1 - 0.12, 0.26), (2.94, 0.26), (xi0, 2.45), (xi1 - 0.12, 2.45),
                     (xi0, 4.63), (xi1 - 0.12, 4.63)):
        S.box((px, py, Z_F2), (px + 0.12, py + 0.12, 5.86), "M_Timber_Natural", bevel=0.006)
    for (a, b) in (((xi0, 0.25), (xi1, 0.30)), ((xi0, 0.26), (xi0 + 0.045, 4.75)), ((xi1 - 0.045, 0.26), (xi1, 4.75))):
        S.box((a[0], a[1], 5.57), (b[0], b[1], 5.67), "M_Timber_Natural", bevel=0.005)
    for (px, py) in ((xi0, 2.79), (xi1 - 0.12, 2.79), (xi0, 5.33), (xi1 - 0.12, 5.33)):
        S.box((px, py, 0.0), (px + 0.12, py + 0.12, 3.0), "M_Timber_Aged", bevel=0.008)
    S.box((xi0, 0.26, 0.0), (xi0 + 0.012, D - T_REAR, 0.25), "M_Timber_Aged")
    S.box((xi1 - 0.012, 0.26, 0.0), (xi1, D - T_REAR, 0.25), "M_Timber_Aged")
    S.box((xi0, 4.75, 3.40), (xi1, 4.85, Z_F2 + 0.005), "M_Timber_Light")
    S.box((xi0, 4.75, 5.18), (xi1, 4.85, 5.28), "M_Timber_Natural", bevel=0.006)
    S.box((xi0, 4.77, 5.84), (xi1, 4.83, 5.90), "M_Timber_Natural")
    x = xi0 + 0.1
    while x < xi1 - 0.05:
        S.box((x, 4.785, 5.28), (x + 0.018, 4.815, 5.84), "M_Timber_Natural")
        x += 0.13
    for yy in (5.40, 5.72):
        S.box((xi0, 4.785, yy), (xi1, 4.815, yy + 0.018), "M_Timber_Natural")

    def fusuma(x0, x1, y):
        S.box((x0, y, Z_F2 + 0.005), (x1, y + 0.03, 5.18), "M_Paper_Fusuma")
        for a, b in (((x0, Z_F2), (x0 + 0.025, 5.18)), ((x1 - 0.025, Z_F2), (x1, 5.18)),
                     ((x0, 5.155), (x1, 5.18)), ((x0, Z_F2), (x1, Z_F2 + 0.03))):
            S.box((a[0], y - 0.003, a[1]), (b[0], y + 0.033, b[1]), "M_Lacquer_Black")
        for s, yy in ((1, y - 0.004), (-1, y + 0.034)):
            hx = x1 - 0.12 if s > 0 else x0 + 0.12
            S.cyl((hx, yy, 4.35), (hx, yy + 0.002 * s * -1, 4.35), 0.03, 10, "M_Brass")

    pw = (xi1 - xi0) / 4
    fusuma(xi0, xi0 + pw + 0.02, 4.76)
    fusuma(xi0 + pw, xi0 + 2 * pw + 0.02, 4.80)
    fusuma(xi0 + 3 * pw - 0.02, xi1, 4.76)          # third panel slid behind the fourth -> opening
    fusuma(xi0 + 3 * pw, xi1, 4.80)
    S.box((xi0, 4.85, 3.40), (xi1, yb, Z_F2), "M_Timber_Natural")
    for k in range(1, 12):
        xx = xi0 + (xi1 - xi0) * k / 12
        S.box((xx - 0.001, 4.85, Z_F2 - 0.0005), (xx + 0.001, yb, Z_F2 + 0.0005), "M_Timber_Dark")
    # ceilings: board ceiling with battens (sao-buchi)
    S.box((xi0, 0.26, 5.90), (xi1, yb, 5.92), "M_Timber_Light")
    x = xi0 + 0.3
    while x < xi1:
        S.box((x - 0.018, 0.26, 5.86), (x + 0.018, yb, 5.90), "M_Timber_Natural")
        x += 0.45
    for a, b in (((xi0, 0.26), (xi1, 0.32)), ((xi0, yb - 0.06), (xi1, yb)), ((xi0, 0.26), (xi0 + 0.06, yb)),
                 ((xi1 - 0.06, 0.26), (xi1, yb))):
        S.box((a[0], a[1], 5.82), (b[0], b[1], 5.90), "M_Timber_Natural")
    # roof framing (wagoya): tie beams, struts, purlins; rafters are in the exterior roof part
    for tx in (1.5, 3.0, 4.5):
        S.box((tx - 0.075, 0.26, 5.95), (tx + 0.075, yb, 6.22), "M_Timber_Aged", bevel=0.015)
        for py in (0.6, 2.55, RIDGE_Y, 6.6, 8.6):
            S.box((tx - 0.05, py - 0.05, 6.22), (tx + 0.05, py + 0.05, roof_z(py) - 0.28), "M_Timber_Aged")
    for py in (0.6, 2.55, RIDGE_Y, 6.6, 8.6):
        S.box((0.0, py - 0.055, roof_z(py) - 0.28), (W, py + 0.055, roof_z(py) - 0.17), "M_Timber_Aged")
    x = 0.1
    while x < W:
        for (ya, yb2) in ((0.42, RIDGE_Y), (RIDGE_Y, 8.6)):
            S.beam((x, ya, roof_z(ya) - 0.14), (x, yb2, roof_z(yb2) - 0.14), 0.045, 0.06, "M_Timber_Aged",
                   up=V(0, -PITCH if ya < RIDGE_Y else PITCH, 1))
        x += 0.45

    # --- props: ground floor shop ---
    # wall shelves along the left wall with goods
    sh_x0, sh_x1 = xi0, xi0 + 0.42
    for py in (1.0, 2.4, 3.8, 5.2):
        Pp.box((sh_x0, py - 0.03, 0.0), (sh_x1, py + 0.03, 2.45), "M_Timber_Natural", bevel=0.005)
    levels = [0.08, 0.50, 0.92, 1.34, 1.76, 2.18]
    for z in levels:
        Pp.box((sh_x0, 1.0, z - 0.03), (sh_x1 + 0.01, 5.2, z), "M_Timber_Natural", bevel=0.004)
    Pp.box((sh_x0, 1.0, 2.42), (sh_x1 + 0.04, 5.2, 2.46), "M_Timber_Natural", bevel=0.004)
    box_mats = ["M_Paper_Goods", "M_Goods_Indigo", "M_Goods_Red", "M_Goods_Green", "M_Goods_Ochre",
                "M_Timber_Light", "M_Paper_Print"]
    for z in levels:
        y = 1.05
        while y < 5.1:
            kind = rnd.random()
            if kind < 0.45:
                w = rnd.uniform(0.10, 0.28)
                h = rnd.uniform(0.06, 0.30)
                dpt = rnd.uniform(0.18, 0.34)
                stack = 1 if h > 0.15 else rnd.randint(1, 3)
                m = rnd.choice(box_mats)
                for s in range(stack):
                    Pp.box((sh_x0 + 0.03, y, z + h * s), (sh_x0 + 0.03 + dpt, y + w, z + h * (s + 1) - 0.003),
                           m, bevel=0.004)
                    if rnd.random() < 0.4:
                        Pp.box((sh_x0 + 0.03 + dpt, y + w * 0.3, z + h * s + h * 0.3),
                               (sh_x0 + 0.032 + dpt, y + w * 0.7, z + h * s + h * 0.7), "M_Paper_Goods")
                y += w + rnd.uniform(0.01, 0.05)
            elif kind < 0.7:
                n = rnd.randint(2, 5)
                m = rnd.choice(["M_Glass_Bottle_G", "M_Glass_Bottle_B", "M_Ceramic_White"])
                hh = rnd.uniform(0.14, 0.28)
                for b in range(n):
                    r = 0.035
                    Pp.lathe((sh_x0 + 0.12 + (b % 2) * 0.08, y + r, z),
                             [(r * 0.9, 0), (r, 0.01), (r, hh * 0.65), (r * 0.4, hh * 0.8), (r * 0.35, hh), (0.0, hh)],
                             8, m)
                    y += 2 * r + 0.012
                y += 0.03
            elif kind < 0.85:
                r = rnd.uniform(0.05, 0.08)
                m = rnd.choice(["M_Goods_Indigo", "M_Goods_Red", "M_Cloth_White", "M_Goods_Ochre", "M_Goods_Green"])
                for b in range(rnd.randint(1, 3)):
                    Pp.cyl((sh_x0 + 0.03, y + r, z + r + 0.002), (sh_x0 + 0.38, y + r, z + r + 0.002), r, 10, m)
                    y += 2 * r + 0.005
                y += 0.03
            else:
                r = rnd.uniform(0.07, 0.11)
                Pp.lathe((sh_x0 + 0.2, y + r, z), [(r * 0.6, 0), (r, r * 0.8), (r * 0.9, r * 1.6), (r * 0.5, r * 1.8),
                                                   (r * 0.55, r * 2.0), (0.0, r * 2.0)], 10,
                         rnd.choice(["M_Ceramic_Brown", "M_Ceramic_Blue"]))
                y += 2 * r + 0.04
        # price tags hanging from the shelf edge
        for _ in range(4):
            ty = rnd.uniform(1.1, 5.0)
            Pp.face([(sh_x1 + 0.012, ty, z - 0.03), (sh_x1 + 0.012, ty + 0.035, z - 0.03),
                     (sh_x1 + 0.012, ty + 0.035, z - 0.11), (sh_x1 + 0.012, ty, z - 0.11)], "M_Paper_Goods",
                    out=(1, 0, 0))
    # display case counter on the doma
    cx0, cx1, cy0, cy1 = 0.95, 3.65, 3.55, 4.05
    Pp.box((cx0, cy0, 0.0), (cx1, cy1, 0.08), "M_Timber_Dark")
    Pp.box((cx0 + 0.02, cy0 + 0.02, 0.08), (cx1 - 0.02, cy1 - 0.02, 0.70), "M_Timber_Natural", bevel=0.006)
    for k in range(4):
        xa = cx0 + 0.07 + (cx1 - cx0 - 0.14) * k / 4
        Pp.box((xa + 0.03, cy0 + 0.012, 0.15), (xa + (cx1 - cx0 - 0.14) / 4 - 0.03, cy0 + 0.02, 0.62),
               "M_Timber_Light", bevel=0.004)
    Pp.box((cx0, cy0, 0.70), (cx1, cy1, 0.74), "M_Timber_Dark", bevel=0.006)
    Pp.box((cx0 + 0.02, cy0 + 0.02, 0.74), (cx1 - 0.02, cy1 - 0.02, 0.75), "M_Felt_Red")
    for (px, py) in ((cx0, cy0), (cx1 - 0.03, cy0), (cx0, cy1 - 0.03), (cx1 - 0.03, cy1 - 0.03)):
        Pp.box((px, py, 0.74), (px + 0.03, py + 0.03, 1.06), "M_Timber_Dark")
    Pp.box((cx0, cy0, 1.03), (cx1, cy0 + 0.03, 1.06), "M_Timber_Dark")
    Pp.box((cx0, cy1 - 0.03, 1.03), (cx1, cy1, 1.06), "M_Timber_Dark")
    Pp.face([(cx0 + 0.03, cy0 + 0.01, 0.75), (cx1 - 0.03, cy0 + 0.01, 0.75), (cx1 - 0.03, cy0 + 0.01, 1.03),
             (cx0 + 0.03, cy0 + 0.01, 1.03)], "M_Glass", out=(0, -1, 0), uvs=[(0, 0), (3, 0), (3, 1), (0, 1)])
    Pp.face([(cx0 + 0.03, cy0 + 0.03, 1.055), (cx1 - 0.03, cy0 + 0.03, 1.055), (cx1 - 0.03, cy1 - 0.03, 1.055),
             (cx0 + 0.03, cy1 - 0.03, 1.055)], "M_Glass", out=(0, 0, 1), uvs=[(0, 0), (3, 0), (3, 1), (0, 1)])
    x = cx0 + 0.12
    while x < cx1 - 0.12:
        t = rnd.random()
        if t < 0.35:
            Pp.box((x, cy0 + 0.1, 0.75), (x + 0.12, cy0 + 0.3, 0.78), rnd.choice(box_mats), bevel=0.003)
        elif t < 0.6:
            Pp.lathe((x + 0.04, cy0 + 0.25, 0.75), [(0.025, 0), (0.028, 0.06), (0.012, 0.08), (0.012, 0.1), (0, 0.1)],
                     8, rnd.choice(["M_Glass_Bottle_G", "M_Ceramic_White"]))
        elif t < 0.8:
            M = Matrix.Translation((x + 0.06, cy0 + 0.2, 0.755)) @ Matrix.Rotation(rnd.uniform(-.4, .4), 4, "Z") @ \
                Matrix.Diagonal((0.11, 0.035, 0.008, 1))
            Pp.cube(M, "M_Lacquer_Red")
        else:
            Pp.cyl((x + 0.06, cy0 + 0.2, 0.75), (x + 0.06, cy0 + 0.2, 0.765), 0.06, 12, "M_Brass")
        x += 0.17
    # abacus, ledger and a cup left on the counter
    ab = V(2.9, 3.85, 1.06)
    Pp.box(ab + V(-0.16, -0.06, 0), ab + V(0.16, 0.06, 0.02), "M_Timber_Dark")
    Pp.box(ab + V(-0.16, -0.06, 0.02), ab + V(0.16, -0.05, 0.035), "M_Timber_Dark")
    Pp.box(ab + V(-0.16, 0.05, 0.02), ab + V(0.16, 0.06, 0.035), "M_Timber_Dark")
    for k in range(13):
        bx = ab.x - 0.14 + 0.28 * k / 12
        for j, by in enumerate((-0.042, -0.03, -0.018, -0.006, 0.02, 0.035)):
            Pp.cyl((bx, ab.y + by - 0.005, ab.z + 0.03), (bx, ab.y + by + 0.005, ab.z + 0.03), 0.009, 6,
                   "M_Timber_Natural" if j else "M_Timber_Dark")
    led = V(1.7, 3.8, 1.06)
    for s in (-1, 1):
        M = Matrix.Translation(led + V(s * 0.1, 0, 0.012)) @ Matrix.Rotation(s * 0.06, 4, "Y") @ Matrix.Diagonal((0.2, 0.26, 0.02, 1))
        Pp.cube(M, "M_Paper_Goods")
    Pp.box(led + V(-0.005, -0.13, 0), led + V(0.005, 0.13, 0.01), "M_Goods_Indigo")
    Pp.lathe((2.3, 3.75, 1.06), [(0.025, 0), (0.035, 0.05), (0.037, 0.065), (0.0, 0.065)], 10, "M_Ceramic_White",
             cap_top=False)
    # display stand behind the shop window
    for k, (z, y0, y1) in enumerate(((0.0, 0.32, 0.95), (0.35, 0.50, 0.95), (0.70, 0.66, 0.95), (1.05, 0.80, 0.95))):
        Pp.box((xi0 + 0.1, y0, z), (2.84, y1, z + 0.35 if k == 0 else z + 0.03), "M_Felt_Red" if k else "M_Timber_Dark")
        if k:
            Pp.box((xi0 + 0.1, y0, z - 0.35), (2.84, y0 + 0.02, z), "M_Timber_Dark")
        x = 0.35
        while x < 2.7:
            zz = z + (0.35 if k == 0 else 0.03)
            t = rnd.random()
            if t < 0.3:
                Pp.lathe((x, y0 + 0.08, zz), [(0.03, 0), (0.035, 0.1), (0.014, 0.13), (0.014, 0.16), (0, 0.16)], 8,
                         rnd.choice(["M_Glass_Bottle_G", "M_Glass_Bottle_B"]))
            elif t < 0.55:
                M = Matrix.Translation((x, y0 + 0.08, zz + 0.14)) @ Matrix.Rotation(0.2, 4, "X") @ Matrix.Diagonal((0.2, 0.01, 0.2, 1))
                Pp.cube(M, rnd.choice(["M_Paper_Print", "M_Goods_Ochre"]))
                Pp.box((x - 0.008, y0 + 0.07, zz), (x + 0.008, y0 + 0.09, zz + 0.05), "M_Bamboo")
            elif t < 0.8:
                Pp.box((x - 0.08, y0 + 0.02, zz), (x + 0.08, y0 + 0.14, zz + 0.07), rnd.choice(box_mats), bevel=0.004)
            else:
                Pp.cyl((x, y0 + 0.08, zz), (x, y0 + 0.08, zz + 0.012), 0.07, 14, "M_Lacquer_Red")
            x += rnd.uniform(0.22, 0.32)
    # tall glass-front cabinet on the right wall and a wall clock
    gx0, gx1, gy0, gy1 = xi1 - 0.42, xi1, 1.2, 2.9
    Pp.box((gx0, gy0, 0.0), (gx1, gy1, 0.5), "M_Timber_Dark")
    for (a, b) in (((gx0, gy0), (gx1, gy0 + 0.04)), ((gx0, gy1 - 0.04), (gx1, gy1)), ((gx0, (gy0 + gy1) / 2 - 0.02), (gx1, (gy0 + gy1) / 2 + 0.02))):
        Pp.box((a[0], a[1], 0.5), (b[0], b[1], 1.9), "M_Timber_Dark")
    Pp.box((gx0, gy0, 1.9), (gx1 + 0.0, gy1, 1.96), "M_Timber_Dark", bevel=0.01)
    for z in (0.95, 1.4):
        Pp.box((gx0 + 0.02, gy0, z - 0.02), (gx1, gy1, z), "M_Timber_Natural")
        x = gy0 + 0.1
        while x < gy1 - 0.1:
            Pp.box((gx0 + 0.08, x, z), (gx0 + 0.3, x + 0.14, z + rnd.uniform(0.05, 0.2)), rnd.choice(box_mats), bevel=0.004)
            x += 0.2
    for yy in ((gy0 + 0.04, (gy0 + gy1) / 2 - 0.02), ((gy0 + gy1) / 2 + 0.02, gy1 - 0.04)):
        Pp.face([(gx0 - 0.002, yy[0], 0.5), (gx0 - 0.002, yy[1], 0.5), (gx0 - 0.002, yy[1], 1.9), (gx0 - 0.002, yy[0], 1.9)],
                "M_Glass", out=(-1, 0, 0), uvs=[(0, 0), (1, 0), (1, 2), (0, 2)])
    ck = V(xi1 - 0.06, 3.7, 2.35)
    Pp.box(ck + V(-0.06, -0.16, -0.35), ck + V(0.06, 0.16, 0.25), "M_Timber_Dark", bevel=0.01)
    Pp.cyl(ck + V(-0.061, 0, 0.1), ck + V(-0.065, 0, 0.1), 0.12, 20, "M_Ceramic_White")
    Pp.box(ck + V(-0.07, -0.005, 0.1), ck + V(-0.066, 0.005, 0.19), "M_Iron")
    Pp.box(ck + V(-0.07, -0.005, 0.095), ck + V(-0.066, 0.07, 0.105), "M_Iron")
    Pp.cyl(ck + V(-0.02, 0.0, -0.05), ck + V(-0.02, 0.0, -0.28), 0.003, 4, "M_Brass")
    Pp.cyl(ck + V(-0.03, 0.0, -0.28), ck + V(-0.01, 0.0, -0.28), 0.04, 12, "M_Brass")
    Pp.face([(ck.x - 0.062, ck.y - 0.1, ck.z - 0.33), (ck.x - 0.062, ck.y + 0.1, ck.z - 0.33),
             (ck.x - 0.062, ck.y + 0.1, ck.z - 0.02), (ck.x - 0.062, ck.y - 0.1, ck.z - 0.02)], "M_Glass",
            out=(-1, 0, 0), uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
    # doma clutter: umbrella stand with two wagasa, a broom, a bucket, a crate
    us = V(5.35, 0.8, 0.0)
    Pp.lathe(us, [(0.13, 0), (0.14, 0.5), (0.0, 0.5)], 10, "M_Ceramic_Blue", cap_top=False)
    for k, a in enumerate((0.1, -0.12)):
        p0 = us + V(0.03 * k, 0.03, 0.05)
        p1 = p0 + V(math.sin(a) * 0.3, 0.1, 1.05)
        Pp.cyl(p0, p0.lerp(p1, 0.35), 0.012, 6, "M_Bamboo")
        Pp.cyl(p0.lerp(p1, 0.3), p1, 0.07, 10, "M_Goods_Ochre" if k else "M_Goods_Red", r1=0.03)
    Pp.cyl((5.62, 4.9, 0.0), (5.7, 5.1, 1.35), 0.012, 6, "M_Bamboo")
    Pp.cyl((5.62, 4.9, 0.0), (5.63, 4.93, 0.35), 0.09, 10, "M_Straw", r1=0.03)
    Pp.lathe((4.6, 4.9, 0.0), [(0.13, 0), (0.15, 0.25), (0.0, 0.25)], 12, "M_Timber_Light", cap_top=False)
    Pp.cyl((4.45, 4.9, 0.25), (4.75, 4.9, 0.25), 0.01, 4, "M_Bamboo")
    Pp.box((4.2, 4.2, 0.0), (4.7, 4.6, 0.3), "M_Timber_Aged", bevel=0.006)
    Pp.box((4.25, 4.25, 0.3), (4.45, 4.55, 0.42), "M_Paper_Goods", bevel=0.004)
    # choba (merchant's desk area) on the raised floor: desk, lattice screen, brazier + kettle
    zr = Z_RAISED
    Pp.box((0.75, 5.95, zr), (1.65, 6.40, zr + 0.30), "M_Timber_Natural", bevel=0.006)
    for k in range(3):
        Pp.box((0.80 + k * 0.28, 5.945, zr + 0.18), (1.03 + k * 0.28, 5.95, zr + 0.26), "M_Timber_Light")
        Pp.box((0.90 + k * 0.28, 5.935, zr + 0.21), (0.94 + k * 0.28, 5.945, zr + 0.225), "M_Iron")
    lg = V(1.2, 6.18, zr + 0.30)
    for s in (-1, 1):
        M = Matrix.Translation(lg + V(s * 0.1, 0, 0.008)) @ Matrix.Rotation(s * 0.05, 4, "Y") @ Matrix.Diagonal((0.2, 0.28, 0.016, 1))
        Pp.cube(M, "M_Paper_Goods")
    Pp.box((1.47, 6.05, zr + 0.30), (1.6, 6.3, zr + 0.32), "M_Lacquer_Black")
    Pp.cyl((1.35, 6.0, zr + 0.305), (1.55, 6.12, zr + 0.305), 0.004, 5, "M_Bamboo")
    for k in range(3):
        a = 0.75 + k * 0.45
        Pp.box((a, 5.66, zr), (a + 0.44, 5.69, zr + 0.45), "M_Timber_Dark")
    x = 0.78
    while x < 2.08:
        Pp.box((x, 5.665, zr + 0.03), (x + 0.012, 5.685, zr + 0.42), "M_Timber_Dark")
        x += 0.05
    zabuton(Pp, 1.2, 6.75, zr)
    hb = V(2.35, 6.3, zr)
    Pp.box(hb, hb + V(0.85, 0.42, 0.33), "M_Timber_Natural", bevel=0.01)
    Pp.box(hb + V(0.05, 0.05, 0.25), hb + V(0.5, 0.37, 0.331), "M_Iron")
    Pp.box(hb + V(0.06, 0.06, 0.30), hb + V(0.49, 0.36, 0.332), "M_Soot")
    Pp.lathe(hb + V(0.28, 0.21, 0.33), [(0.07, 0), (0.11, 0.05), (0.10, 0.10), (0.05, 0.13), (0.0, 0.135)], 12, "M_Iron")
    Pp.cyl(hb + V(0.36, 0.21, 0.40), hb + V(0.44, 0.21, 0.46), 0.012, 6, "M_Iron")
    Pp.tube([hb + V(0.2, 0.21, 0.45), hb + V(0.28, 0.21, 0.55), hb + V(0.36, 0.21, 0.45)], 0.005, 4, "M_Iron")
    Pp.lathe(hb + V(0.66, 0.2, 0.33), [(0.025, 0), (0.035, 0.05), (0.037, 0.065), (0.0, 0.065)], 10,
             "M_Ceramic_White", cap_top=False)
    # tansu against the back wall of the raised room
    tb = V(0.4, yb - 0.45, zr)
    Pp.box(tb, tb + V(1.1, 0.45, 0.95), "M_Timber_Natural", bevel=0.008)
    for r in range(4):
        for c in range(2 if r < 1 else 1):
            w2 = 1.0 / (2 if r < 1 else 1)
            a = V(tb.x + 0.05 + c * w2, tb.y - 0.005, tb.z + 0.05 + r * 0.22)
            Pp.box(a, a + V(w2 - 0.02, 0.006, 0.2), "M_Timber_Light", bevel=0.003)
            Pp.box(a + V(w2 / 2 - 0.05, -0.006, 0.09), a + V(w2 / 2 + 0.03, 0.0, 0.11), "M_Iron")
    # --- upper room props ---
    zf = Z_F2
    tb2 = V(2.55, 2.35, zf)
    Pp.cyl(tb2 + V(0, 0, 0.28), tb2 + V(0, 0, 0.305), 0.40, 28, "M_Timber_Natural")
    Pp.cyl(tb2 + V(0, 0, 0.23), tb2 + V(0, 0, 0.28), 0.36, 28, "M_Timber_Natural", caps=(True, False))
    for a in range(4):
        ang = math.pi / 4 + a * math.pi / 2
        p = tb2 + V(0.28 * math.cos(ang), 0.28 * math.sin(ang), 0)
        Pp.box(p - V(0.02, 0.02, 0), p + V(0.02, 0.02, 0.23), "M_Timber_Natural")
    top = tb2.z + 0.305
    Pp.box((2.35, 2.2, top), (2.7, 2.45, top + 0.012), "M_Lacquer_Black", bevel=0.004)
    Pp.lathe((2.45, 2.32, top + 0.012), [(0.04, 0), (0.07, 0.03), (0.075, 0.06), (0.05, 0.09), (0.0, 0.095)], 12,
             "M_Ceramic_Brown")
    Pp.cyl((2.5, 2.32, top + 0.07), (2.56, 2.32, top + 0.07), 0.008, 5, "M_Ceramic_Brown")
    for (cxp, cyp, tipped) in ((2.62, 2.3, False), (2.75, 2.6, True)):
        if tipped:
            Pp.lathe((cxp, cyp, top + 0.02), [(0.022, 0), (0.032, 0.055), (0.0, 0.055)], 10, "M_Ceramic_White",
                     cap_top=False, axis="x")
        else:
            Pp.lathe((cxp, cyp, top + 0.012), [(0.022, 0), (0.032, 0.055), (0.0, 0.055)], 10, "M_Ceramic_White",
                     cap_top=False)
    M = Matrix.Translation((2.3, 2.62, top + 0.006)) @ Matrix.Rotation(0.35, 4, "Z") @ Matrix.Diagonal((0.27, 0.19, 0.008, 1))
    Pp.cube(M, "M_Paper_Print")
    # smoking box (tabako-bon) with a kiseru pipe laid across it, beside the cushion
    tbx = V(3.05, 3.3, zf)
    Pp.box(tbx, tbx + V(0.26, 0.18, 0.12), "M_Timber_Natural", bevel=0.006)
    Pp.lathe(tbx + V(0.07, 0.09, 0.12), [(0.05, 0), (0.055, 0.05), (0.0, 0.05)], 10, "M_Ceramic_Blue", cap_top=False)
    Pp.cyl(tbx + V(0.19, 0.09, 0.12), tbx + V(0.19, 0.09, 0.17), 0.025, 8, "M_Bamboo", caps=(True, False))
    Pp.cyl(tbx + V(-0.02, 0.02, 0.125), tbx + V(0.30, 0.2, 0.125), 0.005, 5, "M_Brass")
    zabuton(Pp, 2.55, 3.15, zf, 0.08)
    zabuton(Pp, 1.75, 2.2, zf, 1.5)
    # andon (paper lamp) near the left window, lit
    an = V(1.0, 1.05, zf)
    Pp.box(an + V(-0.19, -0.19, 0), an + V(0.19, 0.19, 0.03), "M_Timber_Natural")
    for sx in (-1, 1):
        for sy in (-1, 1):
            Pp.box(an + V(sx * 0.15 - 0.012, sy * 0.15 - 0.012, 0.03), an + V(sx * 0.15 + 0.012, sy * 0.15 + 0.012, 0.8),
                   "M_Lacquer_Black")
    for zz in (0.18, 0.78):
        Pp.box(an + V(-0.16, -0.16, zz), an + V(0.16, 0.16, zz + 0.02), "M_Lacquer_Black")
    for (a, b, n) in ((V(-0.14, -0.14, 0), V(0.14, -0.14, 0), (0, -1, 0)), (V(0.14, -0.14, 0), V(0.14, 0.14, 0), (1, 0, 0)),
                      (V(0.14, 0.14, 0), V(-0.14, 0.14, 0), (0, 1, 0)), (V(-0.14, 0.14, 0), V(-0.14, -0.14, 0), (-1, 0, 0))):
        Pp.face([an + a + V(0, 0, 0.2), an + b + V(0, 0, 0.2), an + b + V(0, 0, 0.78), an + a + V(0, 0, 0.78)],
                "M_Paper_Shoji", out=n)
        Pp.face([an + a + V(0, 0, 0.2), an + b + V(0, 0, 0.2), an + b + V(0, 0, 0.78), an + a + V(0, 0, 0.78)],
                "M_Paper_Shoji", out=(-n[0], -n[1], -n[2]))
    Pp.cyl(an + V(0, 0, 0.35), an + V(0, 0, 0.38), 0.06, 10, "M_Ceramic_White")
    Pp.cyl(an + V(0, 0, 0.38), an + V(0, 0, 0.42), 0.006, 5, "M_Lantern_Glow")
    lights.append(("andon", an + V(0, 0, 0.45), (1.0, 0.62, 0.32), 60, 0.05))
    # tansu and clothes stand with a coat (trace of use)
    tt = V(xi0, 2.8, zf)
    Pp.box(tt, tt + V(0.45, 1.0, 1.15), "M_Timber_Natural", bevel=0.008)
    for r in range(5):
        a = V(tt.x + 0.445, tt.y + 0.04, tt.z + 0.05 + r * 0.22)
        Pp.box(a, a + V(0.006, 0.92, 0.2), "M_Timber_Light", bevel=0.003)
        for hy in (0.25, 0.67):
            Pp.box(a + V(0.006, hy - 0.04, 0.09), a + V(0.014, hy + 0.04, 0.11), "M_Iron")
    for c in ((0, 0, 1.13), (0, 0.97, 1.13), (0, 0, 0), (0, 0.97, 0)):
        Pp.box(tt + V(0.43, c[1], c[2]), tt + V(0.455, c[1] + 0.03, c[2] + 0.03), "M_Iron")
    ek = V(4.9, 3.9, zf)
    for sy in (-0.45, 0.45):
        Pp.box(ek + V(-0.03, sy - 0.2, 0), ek + V(0.03, sy + 0.2, 0.05), "M_Lacquer_Black")
        Pp.box(ek + V(-0.02, sy - 0.02, 0), ek + V(0.02, sy + 0.02, 1.55), "M_Lacquer_Black")
    Pp.box(ek + V(-0.02, -0.6, 1.5), ek + V(0.02, 0.6, 1.54), "M_Lacquer_Black")
    Pp.box(ek + V(-0.015, -0.45, 1.25), ek + V(0.015, 0.45, 1.28), "M_Lacquer_Black")
    Pp.box(ek + V(-0.012, -0.58, 0.72), ek + V(0.012, 0.58, 1.5), "M_Cloth_Haori", bevel=0.005)
    Pp.box(ek + V(-0.018, -0.2, 1.3), ek + V(0.018, 0.2, 1.52), "M_Cloth_Haori", bevel=0.005)
    # hanging scroll (plain ink landscape: generic) and a printed sheet pinned by the shop clock
    sx = xi0 + 0.004
    Pp.face([(sx, 1.05, 4.05), (sx, 1.55, 4.05), (sx, 1.55, 5.35), (sx, 1.05, 5.35)], "M_Goods_Ochre", out=(1, 0, 0))
    Pp.face([(sx + 0.002, 1.12, 4.25), (sx + 0.002, 1.48, 4.25), (sx + 0.002, 1.48, 5.1), (sx + 0.002, 1.12, 5.1)],
            "M_Paper_Print", out=(1, 0, 0))
    # generic ink landscape: three overlapping mountain silhouettes and a moon
    for k, (y0, y1, peak, zb, m) in enumerate(((1.13, 1.40, 1.24, 4.35, "M_Soot"), (1.25, 1.47, 1.38, 4.42, "M_Iron"),
                                                (1.15, 1.32, 1.22, 4.55, "M_Paper_Print"))):
        Pp.face([(sx + 0.003 + k * 0.0005, y0, zb), (sx + 0.003 + k * 0.0005, y1, zb),
                 (sx + 0.003 + k * 0.0005, peak, zb + 0.28 - 0.06 * k)], m, out=(1, 0, 0))
    Pp.cyl((sx + 0.002, 1.38, 4.92), (sx + 0.0045, 1.38, 4.92), 0.035, 12, "M_Ceramic_White")
    Pp.cyl((sx + 0.012, 1.0, 4.05), (sx + 0.012, 1.6, 4.05), 0.012, 8, "M_Lacquer_Black")
    Pp.cyl((sx + 0.006, 1.05, 5.36), (sx + 0.006, 1.55, 5.36), 0.008, 6, "M_Timber_Natural")
    Pp.cyl((sx + 0.01, 1.3, 5.36), (sx + 0.01, 1.3, 5.62), 0.001, 3, "M_Soot")
    Pp.face([(xi1 - 0.004, 4.4, 1.5), (xi1 - 0.004, 4.1, 1.5), (xi1 - 0.004, 4.1, 1.95), (xi1 - 0.004, 4.4, 1.95)],
            "M_Paper_Print", out=(-1, 0, 0))
    for k in range(6):
        Pp.face([(xi1 - 0.006, 4.37, 1.85 - k * 0.055), (xi1 - 0.006, 4.13, 1.85 - k * 0.055),
                 (xi1 - 0.006, 4.13, 1.83 - k * 0.055), (xi1 - 0.006, 4.37, 1.83 - k * 0.055)], "M_Soot", out=(-1, 0, 0))
    # pendant lamps
    for (lx, ly, lz, ceil, name, watts) in ((2.2, 2.0, 2.35, Z_CEIL_G, "shop_front", 150),
                                            (2.3, 4.7, 2.35, Z_CEIL_G, "shop_back", 110),
                                            (2.6, 7.2, 2.45, Z_CEIL_G, "raised_room", 90),
                                            (3.0, 2.4, 5.1, 5.86, "upper_room", 55)):
        Pp.cyl((lx, ly, ceil), (lx, ly, lz + 0.1), 0.004, 4, "M_Soot")
        Pp.lathe((lx, ly, lz), [(0.2, 0.0), (0.19, 0.012), (0.10, 0.07), (0.035, 0.1), (0.02, 0.12), (0.0, 0.125)], 16,
                 "M_Enamel_Shade", cap_bot=False)
        Pp.lathe((lx, ly, lz - 0.04), [(0.0, 0.0), (0.03, 0.02), (0.035, 0.05), (0.018, 0.08), (0.0, 0.09)], 10,
                 "M_Bulb" if watts else "M_Ceramic_White")
        if watts:
            lights.append((name, V(lx, ly, lz - 0.075), (1.0, 0.64, 0.33), watts, 0.03))
    # wall kerosene lamp by the stair
    kl = V(xi1 - 0.08, 5.55, 1.75)
    Pp.box(kl + V(0.02, -0.08, -0.15), kl + V(0.06, 0.08, 0.2), "M_Brass")
    Pp.lathe(kl + V(-0.04, 0, -0.1), [(0.05, 0), (0.06, 0.05), (0.03, 0.08), (0.02, 0.1), (0.028, 0.2), (0.02, 0.26),
                                      (0.0, 0.26)], 10, "M_Glass", cap_bot=True)
    lights.append(("kerosene", kl + V(-0.04, 0, 0.02), (1.0, 0.55, 0.25), 25, 0.02))
    # upper back room: storage boxes and a folded futon
    Pp.box((0.3, 7.6, zf), (1.2, 8.6, zf + 0.35), "M_Cloth_Indigo", bevel=0.04)
    Pp.box((0.3, 7.6, zf + 0.35), (1.2, 8.6, zf + 0.55), "M_Cloth_White", bevel=0.04)
    Pp.box((2.0, 8.2, zf), (2.6, 8.6, zf + 0.4), "M_Timber_Light", bevel=0.006)
    Pp.box((2.05, 8.25, zf + 0.4), (2.55, 8.55, zf + 0.7), "M_Timber_Light", bevel=0.006)
    return S, Pp, lights


def build_collision():
    C = Part("BldgA_Collision", wear=False)
    m = "M_Soot"
    boxes = [
        ((0, 0.0, Z_STREET - 0.2), (W, D, 0.0)),                     # doma slab
        ((T_SIDE, 5.40, 0.0), (W - T_SIDE, D, Z_RAISED)),            # raised floor
        ((0, 0, 0), (T_SIDE, D, 6.0)), ((W - T_SIDE, 0, 0), (W, D, 6.0)), ((0, D - T_REAR, 0), (W, D, 6.0)),
        ((0.0, 0.0, 0.0), (2.95, 0.30, Z_HEAD[1])),                  # display window bay (solid)
        ((2.90, 0.0, 0.0), (4.60, 0.30, Z_HEAD[1])),                 # closed door leaves
        ((4.60, 0.0, 2.10), (W, 0.30, Z_HEAD[1])),                   # head over the open leaf
        ((0.0, 0.0, Z_HEAD[1]), (W, T_FRONT, Z_PARAPET)),            # upper front wall (windows solid)
        ((T_SIDE, 0.26, 3.25), (W - T_SIDE, 6.35, Z_F2)),            # upper floor (front of well)
        ((T_SIDE, 6.35, 3.25), (STAIR["x0"], 8.27, Z_F2)),
        ((T_SIDE, 8.27, 3.25), (W - T_SIDE, D - T_REAR, Z_F2)),
        ((0.95, 3.55, 0.0), (3.65, 4.05, 1.06)),                     # counter
        ((T_SIDE, 1.0, 0.0), (T_SIDE + 0.42, 5.2, 2.45)),            # shelves
        ((W - T_SIDE - 0.42, 1.2, 0.0), (W - T_SIDE, 2.9, 1.96)),    # cabinet
        ((STAIR["x0"] - 0.06, 6.35, 3.40), (STAIR["x0"], 8.27, 4.27)),  # rail
        ((T_SIDE, 4.76, Z_F2), (T_SIDE + 2 * (W - 2 * T_SIDE) / 4, 4.83, 5.9)),  # fusuma closed part
        ((T_SIDE + 3 * (W - 2 * T_SIDE) / 4, 4.76, Z_F2), (W - T_SIDE, 4.83, 5.9)),
        ((T_SIDE, 0.26, 5.86), (W - T_SIDE, D - T_REAR, 5.92)),      # ceiling
    ]
    for a, b in boxes:
        C.box(a, b, m)
    # stair as a ramp (walkable slope)
    sy0, go = STAIR["y0"], STAIR["going"]
    y_top = sy0 + (STAIR["risers"] - 1) * go
    C.prism_x([(sy0, Z_RAISED), (y_top, Z_RAISED), (y_top, Z_F2), (sy0, Z_RAISED + 0.05)], STAIR["x0"], STAIR["x1"], m)
    return C


# ----------------------------------------------------------------------------------------------
# Render-only set dressing (never exported)
# ----------------------------------------------------------------------------------------------
def build_set(set_coll, lod0_objs):
    rnd = random.Random(SEED + 2)
    G = Part("SET_ground", wear=False)
    G.face([(-400, -300, Z_STREET - 0.02), (400, -300, Z_STREET - 0.02), (400, 300, Z_STREET - 0.02), (-400, 300, Z_STREET - 0.02)],
           "S_Street", out=(0, 0, 1))
    x = -40.0
    while x < 40:
        w = rnd.uniform(0.7, 1.1)
        for (ya, yb) in ((-0.62, -0.02), (-1.25, -0.64)):
            G.box((x + 0.008, ya, Z_STREET - 0.1), (x + w - 0.008, yb, Z_STREET + rnd.uniform(-0.008, 0.006)),
                  "M_Stone_Granite", bevel=0.012)
        x += w
    x = -40.0
    while x < 40:
        w = rnd.uniform(0.5, 0.9)
        G.box((x + 0.005, -1.55, Z_STREET - 0.35), (x + w - 0.005, -1.30, Z_STREET), "M_Stone_Granite", bevel=0.01)
        G.box((x + 0.005, -1.95, Z_STREET - 0.35), (x + w - 0.005, -1.72, Z_STREET - 0.02), "M_Stone_Granite", bevel=0.01)
        if rnd.random() < 0.6:
            G.box((x + 0.01, -1.72, Z_STREET - 0.04), (x + w - 0.01, -1.55, Z_STREET - 0.015), "M_Timber_Aged", bevel=0.004)
        x += w
    G.box((-40, -1.72, Z_STREET - 0.36), (40, -1.55, Z_STREET - 0.34), "M_Earth_Doma")
    # neighbours: linked duplicates of the LOD0 shell with per-instance tint and width (no signage)
    tints = [((0.82, 0.88, 0.95, 1), 0.96), ((1.12, 0.98, 0.80, 1), 1.04), ((0.74, 0.72, 0.70, 1), 1.0),
             ((1.1, 0.9, 0.78, 1), 0.93), ((0.86, 0.95, 0.88, 1), 1.06), ((1.15, 1.06, 0.9, 1), 1.0)]
    offsets = []
    xl, xr = 0.0, W
    for k in range(4):
        t, s = tints[k % len(tints)]
        xl -= W * s
        offsets.append((xl, s, t, 0.0, False))
        t2, s2 = tints[(k + 3) % len(tints)]
        offsets.append((xr, s2, t2, 0.0, False))
        xr += W * s2
    for k in range(5):
        t, s = tints[(k + 1) % len(tints)]
        offsets.append((-6 + k * W + 6, s, t, -13.5, True))
    for nb_i, (ox, s, tint, oy, flip) in enumerate(offsets):
        zs = 1.0 + 0.05 * ((nb_i * 7) % 3 - 1)
        for ob in lod0_objs:
            if "signs" in ob.name or ("awning" in ob.name and nb_i % 3 == 1):
                continue
            d = ob.copy()
            d.color = tint
            if flip:
                d.matrix_world = Matrix.Translation((ox, oy, 0)) @ Matrix.Rotation(math.pi, 4, "Z") @ Matrix.Diagonal((s, 1, zs, 1))
            else:
                d.matrix_world = Matrix.Translation((ox, oy, 0)) @ Matrix.Diagonal((s, 1, zs, 1))
            set_coll.objects.link(d)
        # warm lit backdrop so neighbour shops read as occupied at dusk
        bx = ox if not flip else ox - W * s
        by = oy if not flip else oy - D
        bdp = Part("SET_nb_room", wear=False)
        bdp.box((bx + 0.2, by + 0.4 if not flip else by + D - 3.0, 0.0),
                (bx + W * s - 0.2, by + 3.0 if not flip else by + D - 0.4, 3.2), "S_Backdrop")
        o = bdp.to_object(set_coll, "SET_nb_room")
        for poly in o.data.polygons:
            poly.flip()
        lp = bpy.data.lights.new("nb_lamp", "POINT")
        lp.energy = rnd.uniform(25, 60)
        lp.color = (1.0, 0.62, 0.32)
        lp.shadow_soft_size = 0.05
        lo = bpy.data.objects.new("SET_nb_lamp", lp)
        lo.location = (bx + W * s / 2, (by + 1.6) if not flip else (by + D - 1.6), 2.3)
        set_coll.objects.link(lo)
    # utility poles, cross-arms, insulators and catenary wires
    P = Part("SET_poles", wear=False)
    poles = [(-4.6, -2.1), (-26.0, -2.1), (22.0, -2.1)]
    for (px, py) in poles:
        P.cyl((px, py, Z_STREET - 0.1), (px, py, 9.2), 0.14, 10, "M_Timber_Aged", r1=0.10)
        for k, zz in enumerate((8.6, 8.0)):
            P.box((px - 0.05, py - 0.9, zz), (px + 0.05, py + 0.9, zz + 0.1), "M_Timber_Aged")
            for iy in (-0.8, -0.35, 0.35, 0.8):
                P.lathe((px, py + iy, zz + 0.1), [(0.03, 0), (0.035, 0.03), (0.022, 0.05), (0.0, 0.08)], 8,
                        "M_Ceramic_White")
    for zz in (8.68, 8.08):
        for iy in (-0.8, -0.35, 0.35, 0.8):
            for (pa, pb) in zip(sorted(poles)[:-1], sorted(poles)[1:]):
                pts = []
                for t in np.linspace(0, 1, 16):
                    xx = pa[0] + (pb[0] - pa[0]) * t
                    sag = 0.45 * 4 * t * (1 - t)
                    pts.append((xx, pa[1] + iy, zz + 0.07 - sag))
                P.tube(pts, 0.006, 4, "M_Soot")
    pts = []
    a, b = V(-4.6, -2.1 + 0.8, 8.15), V(5.25, -0.03, 6.14)
    for t in np.linspace(0, 1, 14):
        p = a.lerp(b, t)
        p.z -= 0.35 * 4 * t * (1 - t)
        pts.append(p)
    P.tube(pts, 0.006, 4, "M_Soot")
    P.to_object(set_coll)
    # street props: bench, fire buckets, barrels, stand sign, potted pine, young propped pine (158514)
    Q = Part("SET_props", wear=False)
    b0 = V(0.6, -0.95, Z_STREET)
    Q.box(b0 + V(0, 0, 0.42), b0 + V(1.5, 0.4, 0.46), "M_Timber_Aged", bevel=0.008)
    for (lx, ly) in ((0.1, 0.05), (1.35, 0.05), (0.1, 0.3), (1.35, 0.3)):
        Q.box(b0 + V(lx, ly, 0), b0 + V(lx + 0.05, ly + 0.05, 0.42), "M_Timber_Aged")
    fb = V(-0.55, -0.55, Z_STREET)
    Q.box(fb, fb + V(0.5, 0.35, 0.3), "M_Timber_Aged", bevel=0.01)
    for (dx, dz) in ((0.12, 0.3), (0.38, 0.3), (0.25, 0.52)):
        Q.lathe(fb + V(dx, 0.17, dz), [(0.1, 0), (0.12, 0.22), (0.0, 0.22)], 10, "M_Lacquer_Red", cap_top=False)
    for (bx, by) in ((6.35, -0.5), (6.62, -0.28)):
        Q.lathe((bx, by, Z_STREET), [(0.17, 0), (0.2, 0.12), (0.21, 0.3), (0.2, 0.48), (0.17, 0.6), (0.0, 0.6)], 14,
                "M_Timber_Aged")
        for zz in (0.08, 0.5):
            Q.cyl((bx, by, Z_STREET + zz), (bx, by, Z_STREET + zz + 0.03), 0.205, 14, "M_Iron", caps=(False, False))
    sg = V(3.45, -0.75, Z_STREET)
    Q.box(sg + V(-0.2, -0.05, 0.0), sg + V(0.2, 0.05, 1.2), "M_Lacquer_Black", bevel=0.01)
    me = text_mesh("御\n化\n粧\n品", 0.11)
    Q.add_mesh(me, Matrix.Translation(sg + V(0.0, -0.052, 0.72)) @ facing("-y"), "M_Paper_Goods")
    for (px, py) in ((5.0, -0.55), (5.55, -0.45)):
        Q.lathe((px, py, Z_STREET), [(0.12, 0), (0.17, 0.25), (0.18, 0.28), (0.0, 0.28)], 12, "M_Ceramic_Brown")
        for k in range(5):
            Q.lathe((px + rnd.uniform(-.1, .1), py + rnd.uniform(-.1, .1), Z_STREET + 0.3 + k * 0.08),
                    [(0.0, 0), (0.12 - k * 0.018, 0.04), (0.0, 0.1)], 8, "S_Pine")
    Q.to_object(set_coll)
    # young street pine propped with bamboo (158514), needle tufts as radiating thin spikes
    T = Part("SET_pine", wear=False)
    tree = V(-2.3, -7.6, Z_STREET)
    trunk = [tree + V(0.12 * math.sin(t * 2.2), 0.07 * math.cos(t * 3), t * 5.8) for t in np.linspace(0, 1, 10)]
    for k in range(len(trunk) - 1):
        r0 = 0.10 - 0.075 * k / 9
        T.cyl(trunk[k], trunk[k + 1], r0, 9, "S_Bark", r1=r0 - 0.008)
    for k in range(11):
        t = 0.32 + 0.66 * k / 11
        base = trunk[0].lerp(trunk[-1], t)
        ang = k * 2.4 + rnd.uniform(-.3, .3)
        L = 1.3 * (1 - t) + 0.35
        tip = base + V(math.cos(ang) * L, math.sin(ang) * L, rnd.uniform(0.0, 0.35))
        T.cyl(base, tip, 0.03, 6, "S_Bark", r1=0.01)
        for j in range(3):
            c = base.lerp(tip, 0.4 + 0.3 * j)
            for n in range(55):
                th = rnd.uniform(0, 2 * math.pi)
                ph = rnd.uniform(-0.25, 0.9)
                d = V(math.cos(th) * math.cos(ph), math.sin(th) * math.cos(ph), math.sin(ph))
                ln = rnd.uniform(0.12, 0.24)
                T.cyl(c, c + d * ln, 0.007, 3, "S_Pine", r1=0.002, caps=(False, False))
    for k in range(3):
        a = k * 2.1 + 0.4
        T.cyl(tree + V(math.cos(a) * 1.1, math.sin(a) * 1.1, 0), tree + V(0, 0, 2.2) + V(math.cos(a) * 0.1, math.sin(a) * 0.1, 0),
              0.022, 6, "M_Bamboo")
        T.cyl(tree + V(math.cos(a) * 0.11, math.sin(a) * 0.11, 2.1), tree + V(math.cos(a) * 0.11, math.sin(a) * 0.11, 2.3), 0.075,
              12, "M_Straw", caps=(False, False))
    T.box(tree + V(-0.5, -0.5, -0.02), tree + V(0.5, 0.5, 0.0), "M_Stone_Granite")
    T.to_object(set_coll)
    G.to_object(set_coll)


# ----------------------------------------------------------------------------------------------
# Scene, cameras, renders, export
# ----------------------------------------------------------------------------------------------
def new_coll(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(c)
    return c


def look(cam, pos, target, lens, shift_y=0.0, shift_x=0.0):
    cam.location = pos
    d = V(target) - V(pos)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = lens
    cam.data.shift_y = shift_y
    cam.data.shift_x = shift_x


def setup_world(sun_elev_deg, sun_az_deg, sky_strength, sun_strength):
    sc = bpy.context.scene
    w = sc.world or bpy.data.worlds.new("World")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "NISHITA"
    sky.sun_disc = False
    sky.sun_elevation = math.radians(sun_elev_deg)
    sky.sun_rotation = math.radians(sun_az_deg)
    sky.dust_density = 1.2
    sky.air_density = 1.0
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = sky_strength
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(sky.outputs[0], bg.inputs[0])
    nt.links.new(bg.outputs[0], out.inputs[0])
    sun = bpy.data.objects.get("KEY_sun")
    if sun is None:
        ld = bpy.data.lights.new("KEY_sun", "SUN")
        sun = bpy.data.objects.new("KEY_sun", ld)
        sc.collection.objects.link(sun)
    sun.data.energy = sun_strength
    sun.data.color = (1.0, 0.62, 0.36)
    sun.data.angle = math.radians(1.2)
    el, az = math.radians(sun_elev_deg), math.radians(sun_az_deg)
    to_sun = V(math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el))
    sun.rotation_euler = (-to_sun).to_track_quat("-Z", "Y").to_euler()


def setup_render(samples):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for dev in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = dev
            prefs.get_devices()
            for d in prefs.devices:
                d.use = d.type == dev
            sc.cycles.device = "GPU"
            break
        except Exception:
            continue
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.02
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 8
    sc.cycles.transmission_bounces = 8
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 1.0
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.view_settings.view_transform = "AgX"
    try:
        sc.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    sc.render.film_transparent = False
    sc.use_nodes = True
    nt = sc.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new("CompositorNodeRLayers")
    gl = nt.nodes.new("CompositorNodeGlare")
    gl.glare_type = "FOG_GLOW"
    gl.quality = "HIGH"
    gl.threshold = 1.2
    gl.mix = -0.75
    gl.size = 8
    comp = nt.nodes.new("CompositorNodeComposite")
    nt.links.new(rl.outputs["Image"], gl.inputs["Image"])
    nt.links.new(gl.outputs["Image"], comp.inputs["Image"])


def add_haze(coll, density):
    ob = bpy.data.objects.get("SET_haze")
    if ob is None:
        me = bpy.data.meshes.new("SET_haze")
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bm.to_mesh(me)
        ob = bpy.data.objects.new("SET_haze", me)
        ob.scale = (120, 80, 40)
        ob.location = (0, 0, 15)
        coll.objects.link(ob)
        m = bpy.data.materials.new("S_Haze")
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.clear()
        vol = nt.nodes.new("ShaderNodeVolumePrincipled")
        vol.inputs["Color"].default_value = (0.75, 0.68, 0.62, 1)
        vol.inputs["Anisotropy"].default_value = 0.4
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(vol.outputs[0], out.inputs["Volume"])
        me.materials.append(m)
    ob.data.materials[0].node_tree.nodes["Principled Volume"].inputs["Density"].default_value = density
    return ob


def main():
    global TEX
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    TEX = make_textures()
    root_c = new_coll("BuildingA")
    c_l0, c_l1, c_l2 = new_coll("C_LOD0", root_c), new_coll("C_LOD1", root_c), new_coll("C_LOD2", root_c)
    c_int, c_col = new_coll("C_Interior", root_c), new_coll("C_Collision", root_c)
    c_set, c_lodshow = new_coll("SET_render_only"), new_coll("SET_lodshow")

    parts0 = build_lod0(c_l0)
    stats = {"lod0_parts": {}, "tris": {}}
    lod0_objs = []
    for k, p in parts0.items():
        stats["lod0_parts"][k] = p.tris()
        lod0_objs.append(p.to_object(c_l0))
    p1, p2 = build_lod1(), build_lod2()
    stats["tris"]["LOD0_exterior"] = sum(stats["lod0_parts"].values())
    stats["tris"]["LOD1_exterior"] = p1.tris()
    stats["tris"]["LOD2_exterior"] = p2.tris()
    o1, o2 = p1.to_object(c_l1), p2.to_object(c_l2)
    s_int, p_int, lights = build_interior()
    stats["tris"]["interior_structure"] = s_int.tris()
    stats["tris"]["interior_props"] = p_int.tris()
    stats["tris"]["interior_cell_total"] = s_int.tris() + p_int.tris()
    o_s, o_p = s_int.to_object(c_int), p_int.to_object(c_int)
    light_objs = []
    for (name, pos, colr, watts, radius) in lights + [("street_lantern", V(3.0, -0.44, 3.72), (1.0, 0.62, 0.3), 30, 0.03)]:
        ld = bpy.data.lights.new("BldgA_Light_" + name, "POINT")
        ld.energy = watts
        ld.color = colr
        ld.shadow_soft_size = radius
        lo = bpy.data.objects.new("BldgA_Light_" + name, ld)
        lo.location = pos
        c_int.objects.link(lo)
        light_objs.append(lo)
    col = build_collision()
    stats["tris"]["collision"] = col.tris()
    o_col = col.to_object(c_col)
    build_set(c_set, lod0_objs)
    print("STATS", json.dumps(stats))

    # LOD showcase copies (render only)
    for ob, dx in ((o1, 8.5), (o2, 17.0)):
        d = ob.copy()
        d.location = (dx, 0, 0)
        c_lodshow.objects.link(d)
    for i, (lbl, x) in enumerate((("LOD0  %.1fk tris" % (stats["tris"]["LOD0_exterior"] / 1000), 3.0),
                                  ("LOD1  %.1fk tris" % (stats["tris"]["LOD1_exterior"] / 1000), 11.5),
                                  ("LOD2  %d tris" % stats["tris"]["LOD2_exterior"], 20.0))):
        cu = bpy.data.curves.new("lbl", "FONT")
        cu.body = lbl
        cu.size = 0.55
        cu.align_x = "CENTER"
        t = bpy.data.objects.new("SET_label_%d" % i, cu)
        t.location = (x, -2.2, 9.3)
        t.rotation_euler = (math.radians(90), 0, 0)
        t.data.materials.append(get_mat("S_Label"))
        c_lodshow.objects.link(t)

    cam_d = bpy.data.cameras.new("CAM")
    cam = bpy.data.objects.new("CAM", cam_d)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam_d.sensor_width = 36

    lc = {c.name: c for c in bpy.context.view_layer.layer_collection.children}
    lc_root = {c.name: c for c in lc["BuildingA"].children}

    def show(set_=True, lodshow=False, lod12=False, col=False):
        lc["SET_render_only"].exclude = not set_
        lc["SET_lodshow"].exclude = not lodshow
        lc_root["C_LOD1"].exclude = not lod12
        lc_root["C_LOD2"].exclude = not lod12
        lc_root["C_Collision"].exclude = not col

    def hide(names, state):
        for ob in bpy.data.objects:
            if any(ob.name.startswith(n) for n in names):
                ob.hide_render = state

    if not flag("--no-render"):
        setup_render(SAMPLES)
        shots = {
            "street": dict(pos=(-1.2, -12.6, 1.5), tgt=(3.6, 0.0, 1.5), lens=18, shift=0.16, sun=(6, 245, 0.35, 4.5),
                           haze=0.010, ev=-0.2),
            "window-closeup": dict(pos=(3.35, -1.85, 4.95), tgt=(4.55, 0.1, 4.7), lens=32, shift=0.0,
                                   sun=(6, 245, 0.35, 4.5), haze=0.0, ev=-0.1),
            "interior-ground": dict(ev=0.5, pos=(4.75, 0.75, 1.45), tgt=(1.6, 6.6, 0.95), lens=16, shift=0.05,
                                    sun=(4, 255, 0.35, 1.5), haze=0.0),
            "interior-upper": dict(ev=0.35, pos=(4.3, 4.45, Z_F2 + 1.15), tgt=(1.6, 0.3, Z_F2 + 0.75), lens=16, shift=0.04,
                                   sun=(4, 255, 0.35, 1.5), haze=0.0),
            "cutaway": dict(pos=(-9.5, -4.2, 5.2), tgt=(3.2, 4.6, 3.3), lens=24, shift=0.0, sun=(6, 250, 0.4, 3.0),
                            haze=0.0),
            "lod": dict(pos=(10.5, -27.0, 5.5), tgt=(10.5, 3.0, 4.2), lens=34, shift=0.0, sun=(8, 240, 0.45, 3.5), ev=-0.3,
                        haze=0.0),
        }
        for name in RENDERS:
            if name not in shots:
                continue
            s = shots[name]
            t0 = time.time()
            setup_world(*s["sun"])
            hz = add_haze(c_set, s["haze"])
            hz.hide_render = s["haze"] <= 0
            if name == "lod":
                show(set_=False, lodshow=True, lod12=False)
                bpy.data.objects["SET_ground"].hide_render = False
                if "SET_ground" not in c_lodshow.objects:
                    c_lodshow.objects.link(bpy.data.objects["SET_ground"])
                hide(["BldgA_Interior", "BldgA_Light"], True)
            else:
                show(set_=True)
                hide(["BldgA_Interior", "BldgA_Light"], False)
            hide(["BldgA_LOD0_sideL"], name == "cutaway")
            if name == "cutaway":
                for ob in c_set.objects:
                    bc = ob.matrix_world @ (sum((V(c) for c in ob.bound_box), Vector()) / 8)
                    if bc.x < -0.02 and bc.y > -5 and ob.name != "SET_ground" and ob.name != "SET_haze":
                        ob.hide_render = True
            else:
                for ob in c_set.objects:
                    ob.hide_render = ob.name == "SET_haze" and s["haze"] <= 0
            bpy.context.scene.cycles.samples = SAMPLES if name in ("street", "window-closeup", "lod") else int(SAMPLES * 1.6)
            bpy.context.scene.view_settings.exposure = s.get("ev", 0.0)
            look(cam, s["pos"], s["tgt"], s["lens"], s["shift"])
            bpy.context.scene.render.filepath = str(OUT / f"{name}.png")
            bpy.ops.render.render(write_still=True)
            stats.setdefault("render_seconds", {})[name] = round(time.time() - t0, 1)
            print("RENDERED", name, round(time.time() - t0, 1))

    if not flag("--no-export"):
        export_glb(stats, lod0_objs, o1, o2, o_s, o_p, light_objs, o_col)
    stats["build_seconds"] = round(time.time() - T_START, 1)
    (OUT / "building-a.stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    print("DONE", json.dumps(stats))


def join_copy(objs, name, coll):
    copies = []
    for o in objs:
        d = o.copy()
        d.data = o.data.copy()
        coll.objects.link(d)
        copies.append(d)
    with bpy.context.temp_override(active_object=copies[0], selected_editable_objects=copies,
                                   selected_objects=copies, object=copies[0]):
        bpy.ops.object.join()
    ob = copies[0]
    ob.name = ob.data.name = name
    return ob


def add_uv2(ob):
    me = ob.data
    uv2 = me.uv_layers.new(name="UV2_Lightmap")
    me.uv_layers.active = uv2
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.view_layer.objects:
        o.select_set(o == ob)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004)
    bpy.ops.object.mode_set(mode="OBJECT")
    me.uv_layers.active = me.uv_layers["UVMap"]
    me.uv_layers["UVMap"].active_render = True


def export_glb(stats, lod0_objs, o1, o2, o_s, o_p, light_objs, o_col):
    # free the clean names for the export copies (source objects stay in the scene for renders)
    for ob in list(bpy.data.objects):
        if ob.name.startswith(("BldgA_", "BuildingA")):
            ob.name = "src_" + ob.name
            if ob.data is not None and hasattr(ob.data, "name"):
                ob.data.name = "src_" + ob.data.name
    ex = new_coll("EXPORT")
    root = bpy.data.objects.new("BuildingA", None)
    ex.objects.link(root)
    root["source"] = "OML CC0 158514 (1912), 157003/157013/157016 (1905); see README"
    root["assumptions"] = "All dimensions are assumptions (photos unscaled): 6.0 x 9.0 m plot, bays 3.0 m"
    root["frontage_m"], root["depth_m"] = W, D
    groups = []
    for name, objs, extra in (("BldgA_LOD0", lod0_objs, {"lod": 0, "lod_range_m": "0-25"}),
                              ("BldgA_LOD1", [o1], {"lod": 1, "lod_range_m": "25-80"}),
                              ("BldgA_LOD2", [o2], {"lod": 2, "lod_range_m": ">80"}),
                              ("BldgA_InteriorCell", [o_s, o_p], {"cell": "interior",
                                                                   "stream_radius_m": 15}),
                              ("BldgA_Collision", [o_col], {"collision": True, "render": False})):
        e = bpy.data.objects.new(name, None)
        ex.objects.link(e)
        e.parent = root
        for k, v in extra.items():
            e[k] = v
        if name == "BldgA_InteriorCell":
            for o in objs:
                d = o.copy()
                d.data = o.data.copy()
                ex.objects.link(d)
                d.name = o.name.removeprefix("src_")
                d.data.name = d.name
                d.parent = e
                groups.append(d)
            for lo in light_objs:
                d = lo.copy()
                ex.objects.link(d)
                d.name = lo.name.removeprefix("src_")
                d.parent = e
                groups.append(d)
        else:
            mesh_name = {"BldgA_LOD0": "BldgA_LOD0_Exterior", "BldgA_Collision": "BldgA_Collision_Mesh"}.get(name, objs[0].name.removeprefix("src_"))
            j = join_copy(objs, mesh_name, ex) if len(objs) > 1 else None
            if j is None:
                j = objs[0].copy()
                j.data = objs[0].data.copy()
                ex.objects.link(j)
                j.name = j.data.name = mesh_name
            j.parent = e
            groups.append(j)
        groups.append(e)
    for ob in groups:
        if ob.type == "MESH" and "Collision" not in ob.name:
            add_uv2(ob)
    for m in list(_MAT_CACHE.values()):
        if m.name in MATS:
            export_material(m)
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    root.select_set(True)
    for ob in groups:
        ob.select_set(True)
    kw = dict(filepath=str(OUT / "building-a.glb"), export_format="GLB", use_selection=True, export_extras=True,
              export_lights=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
              export_apply=True, export_yup=True, export_image_format="AUTO", export_tangents=False)
    try:
        bpy.ops.export_scene.gltf(**kw)
    except TypeError:
        kw.pop("export_vertex_color")
        kw.pop("export_all_vertex_colors")
        bpy.ops.export_scene.gltf(**kw)
    stats["glb_bytes"] = (OUT / "building-a.glb").stat().st_size


if __name__ == "__main__":
    main()
