"""Cross-module seams self-check: base exterior x cinema wings x interior cell_cinema (Blender 4.5, background):

    blender -b -P assets-src/shinsekai/tower-base-upgrade/verify/seams-verify.py [-- --ext X.glb --wing Y.glb --int Z.glb --out F.json]

Reads the exported files only (defaults: ../exterior/tower-base-exterior.glb, ../wings/tower-wings.glb,
../interior/tower-base-interiors.glb; cell_cinema placed by its rule world = T(-14.95, 8.55, 0.15) R180z cell) and writes
verify/seams-verify.json:

1. Street -> W1 hall.  A walking line from the footway at the kerb (y -12.3) straight through the W1 porch and street door into
   the hall to the cross aisle (cell 14.5, 11.45), then along the aisle between the bench blocks to cell x 5.0; three lanes
   (-0.25, 0, +0.25 m), a downward ray every 1 cm against (a) the visible surfaces (wing LOD0 without placeholders + base LOD0 +
   cell) and (b) the collision set (COL_wing_* + cinema__col_floor).  Reported: missing samples, longest unsupported run, largest
   step between neighbouring samples.  Pass: gap 0 mm, step <= 20 mm.  A 1 mm scan across the wall zone (y -9.20..-8.30) checks
   the joints.  Body clearance: a 0.6 m wide corridor from 0.20 to 2.15 m (world) along the line must not touch any visible
   triangle (BVH overlap).  Door opening: rays along -y from inside the hall on a 2 cm grid of the clear opening through the wall
   zone must hit nothing; jamb / head edges by bisection in the wing (street side) and in the cell (hall side), difference in mm.
2. Coplanar overlaps.  Every triangle pair (cell x wing LOD0, cell x base LOD0, base LOD0 x wing LOD0) whose planes are parallel
   (|n.n'| > 0.9998) and within 1 mm, and whose projections overlap by more than 1 mm2 (convex clipping), is counted as
   same-facing (z-fighting) or opposite-facing (back to back).  Pass: 0 between the cell and the wings.
3. Downpipes / wires vs the wing roofs: exact triangle overlap (BVH) between the base LOD0 downpipe / service / wire meshes (and,
   for files older than v1.3, every base LOD0 iron / wire / porcelain triangle outside the base footprint |x| > 14.45) and the
   wing LOD0 roof sheet, lead flashing, soffit, fascia / ventilator joinery, gutters and every other wing mesh.  Pass: 0.
4. Wire ends.  Every wire (connected component of a wire-material mesh, vertices welded at 0.01 mm) has its open ends found as
   boundary loops; each end must lie within the wire radius + 2 mm of a non-wire surface (insulator, bracket, tube, wall).
5. door_wing_W / door_wing_E state.  The glTF clips <door>_open / <door>_close are read from the base GLB (samplers, target
   nodes); the leaf pivots must rest closed (identity) with extras defaultState = closed; the leaves are posed through each open
   clip at t = 0.25, 0.5, 0.75, 1.0 of its length and tested (BVH overlap, hinge hardware excluded) against the wings, the base
   and cell_cinema.  The interior GLB must carry no door_wing_W leaves of its own.
6. cell_cinema triangles outside its INTERFACE clear box (1 mm).
"""
import json
import math
import struct
import sys
import time
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

T0 = time.time()
HERE = Path(__file__).resolve().parent
TB = HERE.parent
ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def argp(name, default):
    return Path(ARGV[ARGV.index(name) + 1]) if name in ARGV else default


EXT_GLB = argp("--ext", TB / "exterior" / "tower-base-exterior.glb")
WING_GLB = argp("--wing", TB / "wings" / "tower-wings.glb")
INT_GLB = argp("--int", TB / "interior" / "tower-base-interiors.glb")
OUT = argp("--out", HERE / "seams-verify.json")
CELL_T = Matrix.Translation((-14.95, 8.55, 0.15)) @ Matrix.Rotation(math.pi, 4, "Z")
W1_BOX = ((-50.8, -8.55, 0.15), (-14.95, 8.55, 9.0))


def log(*a):
    print("SEAMS", *a, flush=True)


def c2w(x, y, z=0.0):
    return Vector((-14.95 - x, 8.55 - y, z + 0.15))


# ---------------------------------------------------------------------------------------------------------------------
# import
# ---------------------------------------------------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(INT_GLB))
int_objs = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=str(EXT_GLB))
ext_objs = set(bpy.context.scene.objects) - int_objs
bpy.ops.import_scene.gltf(filepath=str(WING_GLB))
wing_objs = set(bpy.context.scene.objects) - int_objs - ext_objs
for o in bpy.context.scene.objects:
    if o.animation_data:
        o.animation_data_clear()
cin_root = bpy.data.objects["cell_cinema"]
cin_root.matrix_world = CELL_T
for o in ext_objs:
    if o.type == "EMPTY" and "_leaf" in o.name:
        o.rotation_mode = "XYZ"
        o.rotation_euler = (0.0, 0.0, 0.0)
bpy.context.view_layer.update()


def descendants(root):
    out, stack = [], list(root.children)
    while stack:
        o = stack.pop()
        out.append(o)
        stack.extend(o.children)
    return out


def tris_world(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    V, F, own = [], [], []
    base = 0
    for o in objs:
        if o.type != "MESH":
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        me.calc_loop_triangles()
        co = np.empty(len(me.vertices) * 3)
        me.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        co = (np.c_[co, np.ones(len(co))] @ np.array(o.matrix_world).T)[:, :3]
        lt = np.empty(len(me.loop_triangles) * 3, dtype=np.int64)
        me.loop_triangles.foreach_get("vertices", lt)
        lt = lt.reshape(-1, 3) + base
        V.append(co)
        F.append(lt)
        own += [o.name] * len(lt)
        base += len(co)
        ev.to_mesh_clear()
    if not V:
        return np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64), []
    return np.vstack(V), np.vstack(F), own


def bvh_from(V, F):
    return BVHTree.FromPolygons([tuple(v) for v in V], [tuple(f) for f in F], all_triangles=True)


def bvh_of(objs):
    V, F, own = tris_world(objs)
    return bvh_from(V, F), own


PH = ("_backing", "_backing_dark", "_curtain")
wing_l0 = [o for o in wing_objs if o.type == "MESH" and o.name.startswith("TW_LOD0_")]
wing_solid = [o for o in wing_l0 if not o.name.endswith(PH)]
wing_ph = [o for o in wing_l0 if o.name.endswith(PH)]
wing_col = [o for o in wing_objs if o.type == "MESH" and o.name.startswith("COL_wing")]
ext_l0 = [o for o in ext_objs if o.type == "MESH" and o.name.startswith("TB_EXT_LOD0_") and not o.name.endswith(PH) and "_stairhead_" not in o.name]
ext_leaves = [o for o in ext_l0 if "_leaf" in o.name]
cin_meshes = [o for o in descendants(cin_root) if o.type == "MESH"]
cin_col = [o for o in cin_meshes if "col_floor" in o.name]
cin_vis = [o for o in cin_meshes if "col_floor" not in o.name]
cin_noleaf = [o for o in cin_vis if o.name != "cinema__doors"]
report = {"version": "tower-base-upgrade seams v1.3", "files": {"exterior": str(EXT_GLB.name), "wings": str(WING_GLB.name), "interior": str(INT_GLB.name)},
          "method": [l for l in __doc__.strip().splitlines()[4:]]}
log("objects: wing LOD0", len(wing_l0), "ext LOD0", len(ext_l0), "cell", len(cin_meshes), "leaves", len(ext_leaves))

# ---------------------------------------------------------------------------------------------------------------------
# 1. street -> W1 hall
# ---------------------------------------------------------------------------------------------------------------------
bvh_vis, own_vis = bvh_of(wing_solid + ext_l0 + cin_vis)
bvh_col, _ = bvh_of(wing_col + cin_col)
P_KERB = Vector((-29.45, -12.3, 0.0))
P_JUNC = c2w(14.5, 11.45)
P_END = c2w(5.0, 11.45)
PATH = [(P_KERB.x, P_KERB.y), (P_JUNC.x, P_JUNC.y), (P_END.x, P_END.y)]
LANES = (-0.25, 0.0, 0.25)


def down(bvh, x, y, z0=1.0):
    h = bvh.ray_cast(Vector((x, y, z0)), Vector((0, 0, -1)), 1.5)
    return (None, None) if h[0] is None else (h[0].z, h[2])


def walk(bvh, own, pts, lanes, step=0.01):
    res = {"samples": 0, "missing": 0, "longestUnsupportedRunM": 0.0, "zRange": [9.0, -9.0], "largestStepM": 0.0, "largestStepAt": None}
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        a, b = Vector((ax, ay, 0)), Vector((bx, by, 0))
        d = b - a
        L = d.length
        d.normalize()
        side = Vector((-d.y, d.x, 0))
        n = int(L / step) + 1
        for lane in lanes:
            prev, run = None, 0.0
            for k in range(n):
                q = a + d * (k * step + 0.0037) + side * lane          # off the mesh edges on purpose
                z, idx = down(bvh, q.x, q.y)
                res["samples"] += 1
                if z is None:
                    res["missing"] += 1
                    run += step
                    res["longestUnsupportedRunM"] = max(res["longestUnsupportedRunM"], round(run, 3))
                    prev = None
                    continue
                run = 0.0
                res["zRange"] = [round(min(res["zRange"][0], z), 4), round(max(res["zRange"][1], z), 4)]
                if prev is not None and abs(z - prev) > res["largestStepM"]:
                    res["largestStepM"] = round(abs(z - prev), 4)
                    res["largestStepAt"] = [round(q.x, 3), round(q.y, 3), round(prev, 4), round(z, 4), own[idx] if own else None]
                prev = z
    return res


walkrep = {"path(world xy)": [[round(a, 3), round(b, 3)] for a, b in PATH], "lanes": LANES,
           "visible": walk(bvh_vis, own_vis, PATH, LANES), "collision": walk(bvh_col, None, PATH, LANES)}
# 1 mm scan across the wall zone joints
fine = {"samples": 0, "missing": 0, "largestStepM": 0.0, "zRange": [9, -9]}
for lane in LANES:
    prev = None
    for k in range(901):
        y = -9.20 + k * 0.001
        z, _ = down(bvh_vis, -29.45 + lane + 0.0003, y + 0.00031)
        fine["samples"] += 1
        if z is None:
            fine["missing"] += 1
            prev = None
            continue
        fine["zRange"] = [round(min(fine["zRange"][0], z), 4), round(max(fine["zRange"][1], z), 4)]
        if prev is not None:
            fine["largestStepM"] = round(max(fine["largestStepM"], abs(z - prev)), 4)
        prev = z
walkrep["wallZone1mm"] = fine


def box_mesh_bvh(boxes):
    V, F = [], []
    for (x0, y0, z0), (x1, y1, z1) in boxes:
        b = len(V)
        V += [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
        for q in ((0, 1, 2), (0, 2, 3), (4, 6, 5), (4, 7, 6), (0, 4, 5), (0, 5, 1), (1, 5, 6), (1, 6, 2), (2, 6, 7), (2, 7, 3), (3, 7, 4), (3, 4, 0)):
            F.append(tuple(b + i for i in q))
    return BVHTree.FromPolygons(V, F, all_triangles=True)


corr = []
for (ax, ay), (bx, by) in zip(PATH, PATH[1:]):
    xs, ys = sorted((ax, bx)), sorted((ay, by))
    if abs(ax - bx) < 1e-6:
        corr.append(((ax - 0.30, ys[0], 0.20), (ax + 0.30, ys[1], 2.15)))
    else:
        corr.append(((xs[0], ay - 0.30, 0.20), (xs[1], ay + 0.30, 2.15)))
hits = bvh_vis.overlap(box_mesh_bvh(corr))
by = {}
for i, _ in hits:
    by[own_vis[i]] = by.get(own_vis[i], 0) + 1
walkrep["corridor"] = {"boxes": [[list(map(lambda v: round(v, 3), a)), list(map(lambda v: round(v, 3), b))] for a, b in corr],
                       "trianglesTouching": len(hits), "byObject": by}

# door opening: rays -y from inside the hall through the wall zone
bvh_open, own_open = bvh_of(cin_noleaf + wing_solid)
blocked, n_rays, by_b = 0, 0, {}
for i in range(59):
    x = -30.03 + i * 0.02
    for j in range(124):
        z = 0.17 + j * 0.02
        n_rays += 1
        h = bvh_open.ray_cast(Vector((x, -8.30, z)), Vector((0, -1, 0)), 0.95)
        if h[0] is not None:
            blocked += 1
            by_b[own_open[h[2]]] = by_b.get(own_open[h[2]], 0) + 1
walkrep["doorOpening"] = {"rays(-y, 2 cm grid, x -30.03..-28.87, z 0.17..2.63, y -8.30 -> -9.25)": n_rays, "blocked": blocked, "byObject": by_b}


def bisect(inside, a, b, it=30):
    for _ in range(it):
        m = (a + b) / 2
        if inside(m):
            a = m
        else:
            b = m
    return (a + b) / 2


bvh_wing_only, _ = bvh_of(wing_solid)
bvh_cell_only, _ = bvh_of(cin_noleaf)
w_in = lambda x, z: bvh_wing_only.ray_cast(Vector((x, -9.25, z)), Vector((0, 1, 0)), 0.30)[0] is None
c_in = lambda x, z: bvh_cell_only.ray_cast(Vector((x, -8.40, z)), Vector((0, -1, 0)), 0.20)[0] is None
edges = {"wing(street face)": {"jambWest": bisect(lambda x: w_in(x, 1.2), -29.45, -30.35), "jambEast": bisect(lambda x: w_in(x, 1.2), -29.45, -28.55),
                               "head": bisect(lambda z: w_in(-29.45, z), 2.0, 3.0)},
         "cell(hall face)": {"jambWest": bisect(lambda x: c_in(x, 1.2), -29.45, -30.35), "jambEast": bisect(lambda x: c_in(x, 1.2), -29.45, -28.55),
                             "head": bisect(lambda z: c_in(-29.45, z), 2.0, 3.0)}}
edges = {k: {kk: round(vv, 5) for kk, vv in v.items()} for k, v in edges.items()}
walkrep["doorEdges"] = edges
walkrep["doorEdgeDifferenceMm"] = {k: round(abs(edges["wing(street face)"][k] - edges["cell(hall face)"][k]) * 1000, 2) for k in ("jambWest", "jambEast", "head")}
report["streetToW1Hall"] = walkrep
log("walk", walkrep["visible"]["missing"], walkrep["visible"]["longestUnsupportedRunM"], walkrep["visible"]["largestStepM"],
    "corridor", len(hits), "blocked", blocked, walkrep["doorEdgeDifferenceMm"])

# ---------------------------------------------------------------------------------------------------------------------
# 2. coplanar overlapping faces
# ---------------------------------------------------------------------------------------------------------------------
def tri_arrays(objs):
    V, F, own = tris_world(objs)
    if len(F) == 0:
        return None
    P = V[F]                                  # (n, 3, 3)
    n = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0])
    ar = np.linalg.norm(n, axis=1)
    ok = ar > 2e-8
    P, n, ar = P[ok], n[ok] / ar[ok, None], ar[ok] / 2
    own = [o for o, k in zip(own, ok) if k]
    return P, n, ar, own


def clip_poly(subject, clip):
    """Sutherland-Hodgman in 2D (clip must be convex, CCW)."""
    out = subject
    for i in range(len(clip)):
        a, b = clip[i], clip[(i + 1) % len(clip)]
        inp, out = out, []
        if not inp:
            break
        s = inp[-1]
        for e in inp:
            ein = (b[0] - a[0]) * (e[1] - a[1]) - (b[1] - a[1]) * (e[0] - a[0]) >= -1e-12
            sin_ = (b[0] - a[0]) * (s[1] - a[1]) - (b[1] - a[1]) * (s[0] - a[0]) >= -1e-12
            if ein:
                if not sin_:
                    out.append(_isect(s, e, a, b))
                out.append(e)
            elif sin_:
                out.append(_isect(s, e, a, b))
            s = e
    return out


def _isect(p, q, a, b):
    x1, y1, x2, y2 = p[0], p[1], q[0], q[1]
    x3, y3, x4, y4 = a[0], a[1], b[0], b[1]
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(den) < 1e-18:
        return q
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
    return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))


def area2(poly):
    return 0.5 * sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))


def coplanar(A, B, tol=0.001, amin=1e-6, bbox_pad=0.01):
    if A is None or B is None:
        return {"same": 0, "opposite": 0, "pairs": {}}
    PA, nA, aA, oA = A
    PB, nB, aB, oB = B
    lo = np.maximum(PA.min(axis=(0, 1)), PB.min(axis=(0, 1))) - bbox_pad
    hi = np.minimum(PA.max(axis=(0, 1)), PB.max(axis=(0, 1))) + bbox_pad
    if np.any(lo > hi):
        return {"same": 0, "opposite": 0, "pairs": {}}
    selA = np.where(np.all((PA.max(axis=1) >= lo) & (PA.min(axis=1) <= hi), axis=1))[0]
    selB = np.where(np.all((PB.max(axis=1) >= lo) & (PB.min(axis=1) <= hi), axis=1))[0]

    def canon_all(n, P):
        k = np.argmax(np.abs(n), axis=1)
        sg = np.where(n[np.arange(len(n)), k] > 0, 1.0, -1.0)
        cn = n * sg[:, None]
        d = np.einsum("ij,ij->i", cn, P[:, 0])
        return cn, k, np.round(cn, 2), np.floor(d / tol).astype(np.int64)

    cnB, kB, rB, dbB = canon_all(nB[selB], PB[selB])
    cnA, kA, rA, dbA = canon_all(nA[selA], PA[selA])
    table = {}
    for jj, j in enumerate(selB):
        key = (float(rB[jj, 0]), float(rB[jj, 1]), float(rB[jj, 2]), int(dbB[jj]))
        table.setdefault(key, []).append(j)
    same = opp = 0
    pairs = {}
    examples = []
    for ii, i in enumerate(selA):
        k = int(kA[ii])
        kb = int(dbA[ii])
        base = (float(rA[ii, 0]), float(rA[ii, 1]), float(rA[ii, 2]))
        cands = []
        for dk in (-1, 0, 1):
            cands += table.get(base + (kb + dk,), [])
        if not cands:
            continue
        amin_i, amax_i = PA[i].min(axis=0), PA[i].max(axis=0)
        for dk in (0,):
            for j in cands:
                dot = float(np.dot(nA[i], nB[j]))
                if abs(dot) < 0.9998:
                    continue
                if np.any(PB[j].min(axis=0) > amax_i + tol) or np.any(PB[j].max(axis=0) < amin_i - tol):
                    continue
                if np.max(np.abs((PA[i] - PB[j, 0]) @ nB[j])) > tol or np.max(np.abs((PB[j] - PA[i, 0]) @ nA[i])) > tol:
                    continue
                ax = [a for a in range(3) if a != k]
                ta = [(float(p[ax[0]]), float(p[ax[1]])) for p in PA[i]]
                tb = [(float(p[ax[0]]), float(p[ax[1]])) for p in PB[j]]
                if area2(ta) < 0:
                    ta = ta[::-1]
                if area2(tb) < 0:
                    tb = tb[::-1]
                poly = clip_poly(ta, tb)
                if len(poly) < 3:
                    continue
                ov = abs(area2(poly))
                if ov <= amin:
                    continue
                if dot > 0:
                    same += 1
                else:
                    opp += 1
                key = f"{oA[i]} x {oB[j]} ({'same' if dot > 0 else 'opposite'})"
                pairs[key] = pairs.get(key, 0) + 1
                if len(examples) < 12:
                    examples.append({"a": oA[i], "b": oB[j], "facing": "same" if dot > 0 else "opposite", "overlapMm2": round(ov * 1e6, 1),
                                     "centroid": [round(v, 3) for v in PA[i].mean(axis=0)]})
    return {"same": same, "opposite": opp, "pairs": dict(sorted(pairs.items(), key=lambda kv: -kv[1])[:20]), "examples": examples,
            "trianglesTested": [int(len(selA)), int(len(selB))]}


T_cell = tri_arrays(cin_vis)
T_shell = tri_arrays([o for o in cin_vis if o.name == "cinema__shell"])
T_wing = tri_arrays(wing_solid)
T_wph = tri_arrays(wing_ph)
T_ext = tri_arrays(ext_l0)
cop = {"tolM": 0.001, "minOverlapM2": 1e-6,
       "cell_cinema x wings LOD0": coplanar(T_cell, T_wing),
       "cinema__shell x wings LOD0": coplanar(T_shell, T_wing),
       "cell_cinema x wing placeholders (hidden when the cell loads)": coplanar(T_cell, T_wph),
       "cell_cinema x base LOD0": coplanar(T_cell, T_ext),
       "base LOD0 x wings LOD0": coplanar(T_ext, T_wing)}
report["coplanar"] = cop
log("coplanar", {k: (v["same"], v["opposite"]) for k, v in cop.items() if isinstance(v, dict)})

# ---------------------------------------------------------------------------------------------------------------------
# 3. downpipes / wires vs the wing roofs
# ---------------------------------------------------------------------------------------------------------------------
SERVICE_KEYS = ("_downpipe", "_service_wire", "_service_iron", "_service_porcelain", "_wire", "_iron", "_porcelain")
ROOF_KEYS = ("_roof_sheet", "_roof_lead", "_soffit", "_joinery", "_iron")
serv_objs = [o for o in ext_l0 if o.name.endswith(SERVICE_KEYS) and "_leaf" not in o.name]
V, F, own = tris_world(serv_objs)
cent = V[F].mean(axis=1) if len(F) else np.zeros((0, 3))
keep = np.abs(cent[:, 0]) > 14.45 if len(F) else np.zeros(0, dtype=bool)
Fk = F[keep]
own_k = [o for o, k in zip(own, keep) if k]
res3 = {"baseMeshes": sorted({o.name for o in serv_objs}), "baseTrianglesOutsideFootprint": int(len(Fk))}
if len(Fk):
    bvh_s = bvh_from(V, Fk)
    for label, objs in (("wingRoofs(roof_sheet, roof_lead, soffit, joinery, iron)", [o for o in wing_solid if o.name.endswith(ROOF_KEYS)]),
                        ("allWingLOD0", wing_solid)):
        bw, ow = bvh_of(objs)
        ov = bvh_s.overlap(bw)
        byp = {}
        for i, j in ov:
            kk = f"{own_k[i]} x {ow[j]}"
            byp[kk] = byp.get(kk, 0) + 1
        res3[label] = {"trianglePairs": len(ov), "byObject": byp}
report["servicesVsWings"] = res3
log("services vs wings", {k: v["trianglePairs"] for k, v in res3.items() if isinstance(v, dict)})

# ---------------------------------------------------------------------------------------------------------------------
# 4. wire ends on supports
# ---------------------------------------------------------------------------------------------------------------------
def wire_mat(o):
    return any(m and m.name.split(".")[0] in ("tb_wire", "wire") for m in o.data.materials)


support = [o for o in ext_l0 + wing_solid + cin_vis if not wire_mat(o)]
bvh_sup, own_sup = bvh_of(support)


def wire_ends(o, r_wire=0.004):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.transform(o.matrix_world)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.faces.ensure_lookup_table()
    seen, comps = set(), []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack, comp = [f], []
        seen.add(f.index)
        while stack:
            g = stack.pop()
            comp.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen:
                        seen.add(h.index)
                        stack.append(h)
        comps.append(comp)
    out = []
    for comp in comps:
        edges = {e for g in comp for e in g.edges if e.is_boundary}
        loops, used = [], set()
        for e in edges:
            if e in used:
                continue
            loop, stack = [], [e]
            used.add(e)
            while stack:
                x = stack.pop()
                loop.append(x)
                for v in x.verts:
                    for y in v.link_edges:
                        if y in edges and y not in used:
                            used.add(y)
                            stack.append(y)
            loops.append(loop)
        ends = []
        for loop in loops:
            vs = {v for e in loop for v in e.verts}
            c = sum((v.co for v in vs), Vector()) / len(vs)
            loc, nrm, idx, dist = bvh_sup.find_nearest(c)
            ends.append({"at": [round(c.x, 3), round(c.y, 3), round(c.z, 3)], "distM": None if dist is None else round(dist, 4),
                         "support": None if idx is None else own_sup[idx]})
        out.append(ends)
    bm.free()
    return out


res4 = {"tolM": "wire radius 0.004 + 0.002"}
for label, objs in (("base", [o for o in ext_l0 if wire_mat(o)]), ("wings", [o for o in wing_solid if wire_mat(o)])):
    n_w, n_e, off, worst, closed = 0, 0, [], 0.0, 0
    for o in objs:
        for ends in wire_ends(o):
            n_w += 1
            if not ends:
                closed += 1
            for e in ends:
                n_e += 1
                d = e["distM"] if e["distM"] is not None else 9.0
                worst = max(worst, d)
                if d > 0.006:
                    off.append({"object": o.name, **e})
    res4[label] = {"meshes": [o.name for o in objs], "wires": n_w, "closedRings": closed, "ends": n_e, "offSupport": len(off),
                   "worstDistM": round(worst, 4), "offSupportList": off[:40]}
report["wireEnds"] = res4
log("wire ends", {k: (v["wires"], v["ends"], v["offSupport"], v["worstDistM"]) for k, v in res4.items() if isinstance(v, dict)})

# ---------------------------------------------------------------------------------------------------------------------
# 5. door_wing state and clips
# ---------------------------------------------------------------------------------------------------------------------
def read_glb(path):
    data = path.read_bytes()
    _, _, length = struct.unpack_from("<III", data, 0)
    off, js, bn = 12, None, None
    while off < length:
        clen, ctype = struct.unpack_from("<II", data, off)
        off += 8
        chunk = data[off:off + clen]
        off += clen
        if ctype == 0x4E4F534A:
            js = json.loads(chunk.decode("utf-8"))
        elif ctype == 0x004E4942:
            bn = chunk
    return js, bn


def accessor(js, bn, i):
    a = js["accessors"][i]
    bv = js["bufferViews"][a["bufferView"]]
    nc = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[a["type"]]
    stride = bv.get("byteStride", 4 * nc)
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    return np.array([np.frombuffer(bn, dtype=np.float32, count=nc, offset=start + k * stride) for k in range(a["count"])])


js, bn = read_glb(EXT_GLB)
anims = {a["name"]: a for a in js.get("animations", [])}
res5 = {"clipsInBaseGLB": sorted(anims)}
bvh_env_W, own_env_W = bvh_of(wing_solid + [o for o in ext_l0 if "_leaf" not in o.name] + cin_vis)
for door in ("door_wing_W", "door_wing_E"):
    d = {}
    for clip in (f"{door}_open", f"{door}_close"):
        a = anims.get(clip)
        if not a:
            d[clip] = "missing"
            continue
        info = {}
        for ch in a["channels"]:
            node = js["nodes"][ch["target"]["node"]]
            smp = a["samplers"][ch["sampler"]]
            t = accessor(js, bn, smp["input"])[:, 0]
            v = accessor(js, bn, smp["output"])
            if ch["target"]["path"] != "rotation":
                continue
            ang = lambda q: round(math.degrees(2 * math.atan2(q[1], q[3])), 3)       # glTF +Y = Blender +Z
            info[node["name"]] = {"seconds": round(float(t[-1] - t[0]), 3), "startDeg": ang(v[0]), "endDeg": ang(v[-1]), "keys": int(len(t)),
                                  "restRotation": node.get("rotation", [0, 0, 0, 1]), "extras": node.get("extras", {}).get("defaultState")}
        d[clip] = info
    # pose sweep through the open clip (angles from the clip), leaves' joinery + glass against everything else
    op = d.get(f"{door}_open")
    sweep = {}
    if isinstance(op, dict) and op:
        leaves = {n: v["endDeg"] for n, v in op.items()}
        for f in (0.0, 0.25, 0.5, 0.75, 1.0):
            for n, deg in leaves.items():
                ob = bpy.data.objects.get(n)
                if ob:
                    ob.rotation_mode = "XYZ"
                    ob.rotation_euler = (0, 0, math.radians(deg * f))
            bpy.context.view_layer.update()
            lv = [o for o in ext_l0 if o.name.startswith(tuple(f"{n}_" for n in leaves if n.startswith("TB_EXT_LOD0_"))) and not o.name.endswith("_brass")]
            bl, ol = bvh_of(lv)
            ov = bl.overlap(bvh_env_W)
            byp = {}
            for i, j in ov:
                kk = f"{ol[i]} x {own_env_W[j]}"
                byp[kk] = byp.get(kk, 0) + 1
            sweep[f"t={f:.2f}"] = {"trianglePairs": len(ov), "byObject": byp}
        for n in leaves:
            ob = bpy.data.objects.get(n)
            if ob:
                ob.rotation_euler = (0, 0, 0)
        bpy.context.view_layer.update()
    d["poseSweepOpen(leaves vs wings + base + cell_cinema, hinge brass excluded)"] = sweep
    ifn = bpy.data.objects.get(f"IF_{door}")
    d["interfaceEmpty"] = None if ifn is None else {"state": ifn.get("state"), "door": ifn.get("door")}
    res5[door] = d
res5["interiorCarriesNoDoorWingLeaves"] = not any(o.name.startswith("cinema__ref") for o in bpy.data.objects)
report["doorWingState"] = res5
log("door clips", res5["clipsInBaseGLB"])

# ---------------------------------------------------------------------------------------------------------------------
# 6. cell_cinema outside its clear box
# ---------------------------------------------------------------------------------------------------------------------
V, F, own = tris_world(cin_vis)
lo, hi = np.array(W1_BOX[0]) - 0.001, np.array(W1_BOX[1]) + 0.001
P = V[F]
out = np.any((P < lo) | (P > hi), axis=(1, 2))
byo = {}
for o, k in zip(own, out):
    if k:
        byo[o] = byo.get(o, 0) + 1
report["cellOutsideClearBox"] = {"box": W1_BOX, "triangles": int(out.sum()), "byObject": byo,
                                 "note": "cinema__doors = the exit-door leaves hung in the opening (INTERFACE: leaves inside openings are allowed)"}
log("cell outside box", int(out.sum()), byo)

# ---------------------------------------------------------------------------------------------------------------------
# summary
# ---------------------------------------------------------------------------------------------------------------------
w = report["streetToW1Hall"]
s5W = report["doorWingState"].get("door_wing_W", {})
sweepW = s5W.get("poseSweepOpen(leaves vs wings + base + cell_cinema, hinge brass excluded)", {})
report["summary"] = {
    "walkGapMm(visible, collision)": [round(w["visible"]["longestUnsupportedRunM"] * 1000, 1), round(w["collision"]["longestUnsupportedRunM"] * 1000, 1)],
    "walkMissing(visible, collision)": [w["visible"]["missing"], w["collision"]["missing"]],
    "walkMaxStepMm(visible)": round(w["visible"]["largestStepM"] * 1000, 1),
    "wallZone1mmMissing": w["wallZone1mm"]["missing"],
    "corridorTrianglesTouching": w["corridor"]["trianglesTouching"],
    "doorOpeningBlockedRays": w["doorOpening"]["blocked"],
    "doorEdgeDifferenceMm": w["doorEdgeDifferenceMm"],
    "coplanarCellVsWings(same, opposite)": [cop["cell_cinema x wings LOD0"]["same"], cop["cell_cinema x wings LOD0"]["opposite"]],
    "coplanarShellVsWings(same, opposite)": [cop["cinema__shell x wings LOD0"]["same"], cop["cinema__shell x wings LOD0"]["opposite"]],
    "coplanarCellVsBase(same, opposite)": [cop["cell_cinema x base LOD0"]["same"], cop["cell_cinema x base LOD0"]["opposite"]],
    "coplanarBaseVsWings(same, opposite)": [cop["base LOD0 x wings LOD0"]["same"], cop["base LOD0 x wings LOD0"]["opposite"]],
    "servicesVsWingRoofsTrianglePairs": res3.get("wingRoofs(roof_sheet, roof_lead, soffit, joinery, iron)", {}).get("trianglePairs"),
    "servicesVsAllWingTrianglePairs": res3.get("allWingLOD0", {}).get("trianglePairs"),
    "wireEndsOffSupport(base, wings)": [res4["base"]["offSupport"], res4["wings"]["offSupport"]],
    "doorWingWClips": [c for c in res5["clipsInBaseGLB"] if c.startswith("door_wing_W")],
    "doorWingWOpenSweepTrianglePairs": {k: v["trianglePairs"] for k, v in sweepW.items()},
    "cellOutsideClearBoxTriangles": report["cellOutsideClearBox"]["triangles"],
}
report["seconds"] = round(time.time() - T0, 1)
OUT.write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
log("summary", json.dumps(report["summary"]))
log("wrote", OUT, report["seconds"], "s")
