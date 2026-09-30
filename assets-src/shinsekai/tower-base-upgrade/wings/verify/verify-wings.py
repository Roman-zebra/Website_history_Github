"""Cinema wings self-check (Blender 4.5, background):

    blender -b -P assets-src/shinsekai/tower-base-upgrade/wings/verify/verify-wings.py

Reads the exported files only: ../tower-wings.glb, ../../exterior/tower-base-exterior.glb, ../../interior/tower-base-interiors.glb
(cell_cinema placed by its rule: world = T(-14.95, 8.55, 0.15) R180z cell).  Writes verify/tower-wings-verify.json:

1. Entrances.  For every IF_wing_*_door_* (street doors, exits) a walking line runs from the footway at the kerb, through the porch,
   the reveal and 1 m past the wall line (into cell_cinema for W1), three lanes across the clear width, every 2 cm.  Downward rays
   find (a) the collision surface (COL_wing_* + cinema__col_floor) and (b) the visible walking surface (wing LOD0 without
   placeholders + base LOD0 + cell_cinema).  Pass: no sample without support; report the longest unsupported run, the height range
   and the largest step between neighbours.
2. door_wing_W / door_wing_E (base -> wing zone -> cell): the same lines along x from the base hall across the 0.45 m wing zone.
3. The W1 street door against the interior's own opening: horizontal rays along +y through a 2 cm grid of the opening must pass the
   wing wall zone (y -9.00..-8.55) without a hit (wing LOD0 without placeholders, cell meshes without the door leaves); the jamb and
   head positions are found by bisection separately in the wing geometry and in the cell's wall, and their difference is reported.
4. Intrusion.  Every wing LOD0 triangle (placeholders listed separately) is tested against the INTERFACE clear boxes (the five
   cinemas, both halls, the upper rooms, the four stair shafts) shrunk by 1 mm, with an exact triangle / box (SAT) test.
5. Party-wall clearance: the highest wing LOD0 point within 1 m of the base E/W faces, against the L3 window sills (12.60).
6. Footway continuity along both wings (y = -10.9 and -12.1, every 0.25 m) against the collision set.
"""
import json
import math
import time
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
W = HERE.parent
TB = W.parent
WING_GLB = W / "tower-wings.glb"
EXT_GLB = TB / "exterior" / "tower-base-exterior.glb"
INT_GLB = TB / "interior" / "tower-base-interiors.glb"
OUT = HERE / "tower-wings-verify.json"
T0 = time.time()


def log(*a):
    print("VERIFY", *a, flush=True)


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
cin = bpy.data.objects["cell_cinema"]
cin.matrix_world = Matrix.Translation((-14.95, 8.55, 0.15)) @ Matrix.Rotation(math.pi, 4, "Z")
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
        return None, None, []
    return np.vstack(V), np.vstack(F), own


def bvh_of(objs):
    V, F, own = tris_world(objs)
    return BVHTree.FromPolygons([tuple(v) for v in V], [tuple(f) for f in F], all_triangles=True), own


PH = ("_backing", "_backing_dark", "_curtain")
wing_l0 = [o for o in wing_objs if o.type == "MESH" and o.name.startswith("TW_LOD0_")]
wing_l0_solid = [o for o in wing_l0 if not o.name.endswith(PH)]
wing_ph = [o for o in wing_l0 if o.name.endswith(PH)]
wing_col = [o for o in wing_objs if o.type == "MESH" and o.name.startswith("COL_wing")]
ext_l0 = [o for o in ext_objs if o.type == "MESH" and o.name.startswith("TB_EXT_LOD0_") and not o.name.endswith(PH) and "_stairhead_" not in o.name]
cin_meshes = [o for o in descendants(cin) if o.type == "MESH"]
cin_col = [o for o in cin_meshes if "col_floor" in o.name]
cin_vis = [o for o in cin_meshes if "col_floor" not in o.name]
cin_wall = [o for o in cin_vis if o.name in ("cinema__shell", "cinema__walls", "cinema__exit_door")]
cin_noleaf = [o for o in cin_vis if o.name != "cinema__doors"]
cin_walk = cin_noleaf          # the ajar exit-door leaves swing into the house by design (interior story); not a walking surface
log("objects: wing LOD0", len(wing_l0), "col", len(wing_col), "ext LOD0", len(ext_l0), "cell", len(cin_meshes))

bvh_col, _ = bvh_of(wing_col + cin_col)
bvh_walk, own_walk = bvh_of(wing_l0_solid + ext_l0 + cin_walk)
bvh_wing, own_wing = bvh_of(wing_l0_solid)
bvh_cellwall, _ = bvh_of(cin_wall)
bvh_cell_noleaf, _ = bvh_of(cin_noleaf)
report = {"version": "tower-wings v1.0 verify", "files": {"wings": WING_GLB.name, "exterior": EXT_GLB.name, "interior": INT_GLB.name},
          "method": __doc__.strip().splitlines()[5:]}


def down(bvh, x, y, z0=2.2, with_index=False):
    hit = bvh.ray_cast(Vector((x, y, z0)), Vector((0, 0, -1)), 3.0)
    if with_index:
        return (None, None) if hit[0] is None else (hit[0].z, hit[2])
    return None if hit[0] is None else hit[0].z


def walk_line(p0, p1, lanes, half, step=0.02):
    """Sample a walking line p0 -> p1 (world xy) with lateral lanes; return stats for both BVHs."""
    a, b = Vector((p0[0], p0[1], 0)), Vector((p1[0], p1[1], 0))
    d = (b - a)
    L = d.length
    d.normalize()
    side = Vector((-d.y, d.x, 0))
    out = {}
    for name, bvh, own in (("collision", bvh_col, None), ("visible", bvh_walk, own_walk)):
        worst_gap, zmin, zmax, maxstep, missing = 0.0, 9, -9, 0.0, 0
        top_owner = None
        for lane in lanes:
            prev, run = None, 0.0
            n = int(L / step) + 1
            for k in range(n):
                q = a + d * (k * step) + side * (lane * half)
                z, idx = down(bvh, q.x, q.y, with_index=True)
                if z is None:
                    missing += 1
                    run += step
                    worst_gap = max(worst_gap, run)
                    prev = None
                    continue
                run = 0.0
                if z > zmax and own is not None:
                    top_owner = [own[idx], round((q - a).dot(d), 3), lane]
                zmin, zmax = min(zmin, z), max(zmax, z)
                if prev is not None:
                    maxstep = max(maxstep, abs(z - prev))
                prev = z
        out[name] = {"samples": len(lanes) * (int(L / step) + 1), "missing": missing, "longestUnsupportedRunM": round(worst_gap, 3),
                     "zRange": [round(zmin, 4), round(zmax, 4)], "largestStepM": round(maxstep, 4),
                      "highestHit[object, distanceAlongLineM, lane]": top_owner}
    return out


# 1. entrances ------------------------------------------------------------------------------------------------------
ent = {}
for e in sorted([o for o in wing_objs if o.type == "EMPTY" and o.name.startswith("IF_wing_")], key=lambda o: o.name):
    ex = json.loads(e["opening"])
    M = e.matrix_world
    c = M.translation
    out_dir = (M.to_3x3() @ Vector((0, 1, 0))).normalized()
    if abs(out_dir.z) > 0.5:
        continue
    kind = ex.get("door", "wing")
    if e.name.startswith("IF_wing_door_wing"):
        west = e.name.endswith("_W")
        p0 = c + out_dir * (1.0 if west else -0.01)  # W: from inside cell_cinema; E: the E1 cell does not exist yet
        p1 = c - out_dir * 0.55           # onto the base threshold stone, stopping short of the base door leaves (x +/-14.35)
    elif kind == "rear":
        p0 = c + out_dir * 0.35
        p1 = c - out_dir * 0.1
    else:
        # from the footway just inside the kerb to 1 m past the inner wall face
        t = (c.y - (-12.3)) if out_dir.y < 0 else 1.0
        p0 = c + out_dir * abs(t)
        p1 = c - out_dir * (1.45 if ex.get("hall") == "W1" else 0.1)
    half = ex["width"] / 2 - 0.12
    res = walk_line((p0.x, p0.y), (p1.x, p1.y), (-1, 0, 1), half)
    res["from"] = [round(p0.x, 3), round(p0.y, 3)]
    res["to"] = [round(p1.x, 3), round(p1.y, 3)]
    res["opening"] = ex
    ent[e.name] = res
    log(e.name, res["collision"]["missing"], res["visible"]["missing"], res["visible"]["zRange"], res["visible"]["largestStepM"])
report["entrances"] = ent
report["entrancesNote"] = ("Street doors and exits run from the footway at the kerb (y -12.3) through the porch or the reveal: W1 continues 1 m into "
                           "cell_cinema; W2 and E1-E3 have no interior cell yet, so their lines stop on the threshold in front of the closed "
                           "leaves (0.1 m inside the wall face).  Rear doors: the yard north of the wings is outside this module (no ground, no "
                           "collision there), so the line covers the step and the threshold only; collision 'missing' there is expected.  "
                           "door_wing_W runs from 1 m inside cell_cinema across the 0.45 m wing zone onto the base threshold (0.15 since base v1.3, "
                           "with a 15 mm oak saddle under the leaves), stopping on the saddle short of the leaf plane (x -14.35); the base side has no "
                           "collision (the ticket-hall floor collision belongs to cell_hall), so the last 0.1 m reports collision 'missing' by design.  "
                           "door_wing_E: same without a cell on the wing side.  The ajar exit-door leaves of cell_cinema are not a walking surface "
                           "and are excluded.  (v1.0 found the interior wainscot across the W1 door below 1.45 m; fixed in interior v1.3, see "
                           "../../verify/seams-verify.json.)")

# 3. W1 door alignment -------------------------------------------------------------------------------------------------
X0 = -29.45
al = {}


def hy(bvh, x, z, y0=-10.1, y1=-8.2):
    h = bvh.ray_cast(Vector((x, y0, z)), Vector((0, 1, 0)), y1 - y0)
    return None if h[0] is None else h[0].y


grid_hits_wing, grid_hits_cell, n = 0, 0, 0
for i in range(59):
    x = X0 - 0.58 + 1.16 * i / 58
    for j in range(125):
        z = 0.17 + 2.46 * j / 124
        n += 1
        yw = hy(bvh_wing, x, z)
        if yw is not None and -9.0 - 1e-3 <= yw <= -8.55 + 1e-3:
            grid_hits_wing += 1
        yc = hy(bvh_cell_noleaf, x, z, -9.2, -8.2)
        if yc is not None and yc <= -8.5:
            grid_hits_cell += 1
al["gridRays"] = n
al["wingHitsInWallZone"] = grid_hits_wing
al["cellHitsInWallZone"] = grid_hits_cell


def bisect(f, a, b, it=30):
    fa = f(a)
    for _ in range(it):
        m = (a + b) / 2
        if f(m) == fa:
            a = m
        else:
            b = m
    return (a + b) / 2


def blocked_wing(x, z):
    y = hy(bvh_wing, x, z, -9.3, -8.3)
    return y is not None and abs(y + 9.0) < 0.05          # stopped by the outer face of the wall (y = -9.00) or its 35 mm casing


def blocked_cell(x, z):
    # v1.3: the cell no longer draws the wall zone (single owner per surface); its edges are those of its hall-face casing / wall face
    h = bvh_cellwall.ray_cast(Vector((x, -8.40, z)), Vector((0, -1, 0)), 0.2)
    return h[0] is not None


edges = {}
for name, fb in (("wing", blocked_wing), ("cell", blocked_cell)):
    left = bisect(lambda x: fb(x, 1.3), X0, X0 - 0.9)
    right = bisect(lambda x: fb(x, 1.3), X0, X0 + 0.9)
    head = bisect(lambda z: fb(X0, z), 1.3, 3.2)
    edges[name] = {"jambWest": round(left, 4), "jambEast": round(right, 4), "head": round(head, 4)}
al["edges"] = edges
al["edgeDifferenceMm"] = {k: round(abs(edges["wing"][k] - edges["cell"][k]) * 1000, 1) for k in edges["wing"]}
report["W1door"] = al
log("W1 door", al)

# 4. intrusion ---------------------------------------------------------------------------------------------------------
BOXES = {
    "cinema_W1": ((-50.8, -8.55, 0.15), (-14.95, 8.55, 9.0)), "cinema_W2": ((-86.75, -8.55, 0.15), (-51.25, 8.55, 9.0)),
    "cinema_E1": ((14.95, -8.55, 0.15), (38.85, 8.55, 9.0)), "cinema_E2": ((39.3, -8.55, 0.15), (63.1, 8.55, 9.0)),
    "cinema_E3": ((63.55, -8.55, 0.15), (86.75, 8.55, 9.0)),
    "ticket_hall": ((-14.05, -8.6, 0.15), (-10.5, 8.6, 4.6)), "east_hall": ((10.5, -8.6, 0.15), (14.05, 8.6, 4.6)),
    "upper_rooms_W": ((-14.05, -8.6, 4.9), (-10.5, 8.6, 14.8)), "upper_rooms_E": ((10.5, -8.6, 4.9), (14.05, 8.6, 14.8)),
    "stair_NW": ((-14.05, 9.05, 0.15), (-10.5, 12.55, 19.2)), "stair_SW": ((-14.05, -12.55, 0.15), (-10.5, -9.05, 19.2)),
    "stair_NE": ((10.5, 9.05, 0.15), (14.05, 12.55, 19.2)), "stair_SE": ((10.5, -12.55, 0.15), (14.05, -9.05, 19.2)),
}


def tri_box(tri, lo, hi):
    """Exact SAT overlap test (strict interiors: touching the box faces does not count)."""
    c = (lo + hi) / 2
    h = (hi - lo) / 2
    v = tri - c
    f = [v[1] - v[0], v[2] - v[1], v[0] - v[2]]
    ax = [np.array(a) for a in ((1, 0, 0), (0, 1, 0), (0, 0, 1))]
    axes = list(ax)
    for e in f:
        for a in ax:
            axes.append(np.cross(e, a))
    axes.append(np.cross(f[0], f[1]))
    for a in axes:
        if np.dot(a, a) < 1e-18:
            continue
        p = v @ a
        r = np.abs(a) @ h
        if p.min() >= r - 1e-9 or p.max() <= -r + 1e-9:
            return False
    return True


def intrusions(objs):
    V, F, own = tris_world(objs)
    res = {}
    if V is None:
        return res
    T = V[F]
    tmin, tmax = T.min(axis=1), T.max(axis=1)
    for name, (lo, hi) in BOXES.items():
        lo_, hi_ = np.array(lo) + 1e-3, np.array(hi) - 1e-3
        cand = np.where(np.all(tmax > lo_, axis=1) & np.all(tmin < hi_, axis=1))[0]
        hits = [int(i) for i in cand if tri_box(T[i], lo_, hi_)]
        by = {}
        for i in hits:
            by[own[i]] = by.get(own[i], 0) + 1
        res[name] = {"triangles": len(hits), "byObject": by}
    return res


report["intrusion"] = {"solid": intrusions(wing_l0_solid), "placeholders(hidden when a cell loads)": intrusions(wing_ph),
                       "note": "clear boxes from ../INTERFACE.md shrunk by 1 mm; exact triangle/box SAT test"}
log("intrusion solid", {k: v["triangles"] for k, v in report["intrusion"]["solid"].items()})

# 5. party wall clearance ------------------------------------------------------------------------------------------------
V, F, own = tris_world(wing_l0)
near = V[(np.abs(np.abs(V[:, 0]) - 14.5) < 1.0) & (np.abs(V[:, 1]) < 9.6)]
zmax = float(near[:, 2].max())
report["partyWall"] = {"highestWingPointWithin1mOfBaseFaceZ": round(zmax, 3), "baseL3WindowSill": 12.6, "clearanceM": round(12.6 - zmax, 3)}
log("party wall", report["partyWall"])

# 2b / 6. footway continuity ---------------------------------------------------------------------------------------------
fw = {}
kiosk_boxes = []
for o in wing_col:
    if "kiosk" in o.name:
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        kiosk_boxes.append((min(p.x for p in bb), max(p.x for p in bb), min(p.y for p in bb), max(p.y for p in bb)))
for side, xs in (("W", (-87.0, -14.6)), ("E", (14.6, 87.0))):
    for y in (-10.9, -12.1):
        miss, bad, n = 0, 0, 0
        x = xs[0]
        while x <= xs[1]:
            if any(a <= x <= b and c <= y <= d for a, b, c, d in kiosk_boxes):
                x += 0.25
                continue
            z = down(bvh_col, x, y, 0.6)
            n += 1
            if z is None:
                miss += 1
            elif abs(z - 0.15) > 0.005:
                bad += 1
            x += 0.25
        fw[f"{side}_y{y}"] = {"samples": n, "missing": miss, "offLevel": bad}
report["footway"] = fw
log("footway", fw)
report["timeS"] = round(time.time() - T0, 1)
OUT.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
log("written", OUT, report["timeS"])
