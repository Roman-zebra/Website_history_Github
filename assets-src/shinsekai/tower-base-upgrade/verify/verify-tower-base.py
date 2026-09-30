"""Tower base v1.2 self-check (Blender 4.5, background):

    blender -b -P assets-src/shinsekai/tower-base-upgrade/verify/verify-tower-base.py

Reads the exported files only (../interior/tower-base-interiors.glb, ../exterior/tower-base-exterior.glb, ../interior/stair-plan.json)
and writes verify/tower-base-verify.json:

1. Stair headroom.  For every step 1..74 and three walking samples (centre, inner and outer edge of the clear width between the
   rails) a downward ray finds the real walking surface, then an upward ray measures the vertical clearance to the first mesh
   above.  Collision meshes (extras collision) are excluded, as in Codex's receipt.  Two scenes: (a) the stair cell alone (Codex's
   method), (b) the stair cell placed in the world together with the exterior LOD0 shell (placeholders `*_backing*`, `*_curtain`,
   `*_stairhead_*` hidden, as when the cell is loaded).  Pass: every clearance >= 1.8 m.
2. Head landing and thresholds.  A 5 cm grid over the head landing must hit the finish at z 15.00-15.01 (cell); lines across the
   stair-head door (N wall) and the lift-transfer door (E wall, x = -10.05 face) sampled every 1 cm from 0.5 m inside the landing to
   0.25 m outside the wall must never lose support (gap = longest unsupported run) and report the step height at the threshold.
   The arrival (last tread -> landing) is checked the same way.
3. Step 27 (the v1 bucket) and the collision ramp: every walking sample must be above the exterior COL_stair_proxy_SW surface by
   0..R and the interior ramp alike.
4. Scissor gates.  The glTF animation samplers of car_gate_open / car_gate_close / landing_gate_open / landing_gate_close are
   evaluated at t = 0, 0.375, 0.75, 1.125, 1.5 s and applied to the imported nodes.  Checks: pin closure (every rivet empty on a
   front strap against the matching point carried by the back strap / picket, in mm), lazy-tongs rule (strap angle vs picket
   pitch), and interpenetration (triangle overlap, BVH) of every moving part against every other mesh of the lift cell.
"""
import bpy, bmesh, json, math, struct, sys, time
from pathlib import Path
from mathutils import Vector, Quaternion, Matrix
from mathutils.bvhtree import BVHTree
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
INT_GLB = ROOT / "interior" / "tower-base-interiors.glb"
EXT_GLB = ROOT / "exterior" / "tower-base-exterior.glb"
PLAN = json.loads((ROOT / "interior" / "stair-plan.json").read_text(encoding="utf-8"))
OUT = HERE / "tower-base-verify.json"
CELL2WORLD = Vector((-14.05, -12.55, 0.15))
T0 = time.time()


def log(*a):
    print("VERIFY", *a, flush=True)


# ---------------------------------------------------------------------------------------------------------------------
# import
# ---------------------------------------------------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(INT_GLB))
int_objs = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=str(EXT_GLB))
ext_objs = set(bpy.context.scene.objects) - int_objs
for o in bpy.context.scene.objects:
    if o.animation_data:
        o.animation_data_clear()
bpy.context.view_layer.update()


def is_col(o):
    return o.get("collision") in (1, True, "1", "true") or o.name.startswith("COL_") or "col_floor" in o.name


def descendants(root):
    out = []
    stack = list(root.children)
    while stack:
        o = stack.pop()
        out.append(o)
        stack.extend(o.children)
    return out


def tris_world(objs):
    """World-space triangles of mesh objects -> (verts np, tris np, owner list)."""
    dg = bpy.context.evaluated_depsgraph_get()
    V, F, own = [], [], []
    base = 0
    for o in objs:
        if o.type != "MESH":
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        me.calc_loop_triangles()
        mw = o.matrix_world
        co = np.empty(len(me.vertices) * 3, dtype=np.float64)
        me.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        co = (np.c_[co, np.ones(len(co))] @ np.array(mw).T)[:, :3]
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
    if V is None:
        return None, []
    return BVHTree.FromPolygons([tuple(v) for v in V], [tuple(f) for f in F], all_triangles=True), own


def cell_root(name):
    return bpy.data.objects.get("cell_" + name)


def tri_count(objs):
    n = 0
    for o in objs:
        if o.type == "MESH":
            n += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return n


report = {"version": "tower-base v1.2 verify", "files": {"interior": str(INT_GLB.name), "exterior": str(EXT_GLB.name)}}

# ---------------------------------------------------------------------------------------------------------------------
# triangle counts (cells and exterior LODs), exported meshes
# ---------------------------------------------------------------------------------------------------------------------
cells = {}
for o in bpy.data.objects:
    if o.name.startswith("cell_") and o.parent is None:
        d = descendants(o)
        cells[o.name] = {"triangles": tri_count([x for x in d if not is_col(x)]), "collisionTriangles": tri_count([x for x in d if is_col(x)]),
                         "meshes": sum(1 for x in d if x.type == "MESH"), "empties": sum(1 for x in d if x.type == "EMPTY")}
report["cells"] = cells
lods = {}
for l in (0, 1, 2):
    r = bpy.data.objects.get(f"TB_EXT_LOD{l}")
    if r:
        lods[f"LOD{l}"] = tri_count(descendants(r))
report["exteriorLODs"] = lods
log("cells", json.dumps(cells))
log("exterior", json.dumps(lods))

# ---------------------------------------------------------------------------------------------------------------------
# 1-3. stair
# ---------------------------------------------------------------------------------------------------------------------
PLACEHOLDER = ("_backing", "_curtain", "_stairhead_")


def stair_checks(cellname):
    root = cell_root(cellname)
    others = [o for o in bpy.data.objects if o.name.startswith("cell_") and o.parent is None and o is not root]
    root.location = CELL2WORLD
    bpy.context.view_layer.update()
    cell_mesh = [o for o in descendants(root) if o.type == "MESH" and not is_col(o)]
    ext_mesh = [o for o in ext_objs if o.type == "MESH" and not is_col(o) and o.name.startswith("TB_EXT_LOD0")
                and not any(p in o.name for p in PLACEHOLDER)]
    bvh_cell, own_cell = bvh_of(cell_mesh)
    bvh_all, own_all = bvh_of(cell_mesh + ext_mesh)
    col_int = [o for o in descendants(root) if is_col(o)]
    col_ext = [o for o in ext_objs if o.name.startswith("COL_stair_proxy_SW")]
    bvh_cint, _ = bvh_of(col_int)
    bvh_cext, _ = bvh_of(col_ext)
    R = PLAN["riser"]
    down, up = Vector((0, 0, -1)), Vector((0, 0, 1))
    rows, worst = [], {}
    for st in PLAN["steps"]:
        zexp = st["z"]
        for nm, (x, y) in st["walk"].items():
            P = CELL2WORLD + Vector((x, y, zexp + 0.10))
            hit = bvh_cell.ray_cast(P, down, 0.5)
            if hit[0] is None:
                rows.append(dict(step=st["n"], sample=nm, error="no floor"))
                continue
            zact = hit[0].z
            res = dict(step=st["n"], sample=nm, x=x, y=y, expected=round(zexp, 4), actual=round(zact - CELL2WORLD.z, 4),
                       floorDelta=round(zact - CELL2WORLD.z - zexp, 4))
            for key, bv, own in (("clearanceCell", bvh_cell, own_cell), ("clearanceWithShell", bvh_all, own_all)):
                h = bv.ray_cast(Vector((P.x, P.y, zact + 0.03)), up, 30.0)
                if h[0] is None:
                    res[key] = None
                else:
                    res[key] = round(h[0].z - zact, 4)
                    res[key + "By"] = own[h[2]]
            for key, bv in (("colInterior", bvh_cint), ("colExterior", bvh_cext)):
                if bv is None:
                    continue
                h = bv.ray_cast(Vector((P.x, P.y, zact + 0.5)), down, 1.0)
                res[key] = None if h[0] is None else round(h[0].z - zact, 4)
            rows.append(res)
    ok = [r for r in rows if "error" not in r]
    def mn(key):
        vals = [(r[key], r) for r in ok if r.get(key) is not None]
        if not vals:
            return None
        v, r = min(vals, key=lambda t: t[0])
        return dict(value=v, step=r["step"], sample=r["sample"], by=r.get(key + "By"))
    out = dict(samples=len(rows), errors=[r for r in rows if "error" in r], minClearanceCell=mn("clearanceCell"),
               minClearanceWithShell=mn("clearanceWithShell"),
               below18=[r for r in ok if (r.get("clearanceWithShell") or 99) < 1.8 or (r.get("clearanceCell") or 99) < 1.8],
               below20=len([r for r in ok if (r.get("clearanceWithShell") or 99) < 2.0]),
               maxFloorDelta=max(abs(r["floorDelta"]) for r in ok),
               colInteriorRange=[min(r["colInterior"] for r in ok if r.get("colInterior") is not None), max(r["colInterior"] for r in ok if r.get("colInterior") is not None)] if bvh_cint else None,
               colExteriorRange=[min(r["colExterior"] for r in ok if r.get("colExterior") is not None), max(r["colExterior"] for r in ok if r.get("colExterior") is not None)] if bvh_cext else None,
               step27=[r for r in ok if r["step"] == 27])
    # head landing grid
    L = PLAN["headLanding"]

    def pip(p, poly):
        x, y = p
        ins = False
        for i in range(len(poly)):
            (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % len(poly)]
            if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
                ins = not ins
        return ins
    grid, miss = [], []
    for i in range(1, 71):
        for j in range(1, 70):
            x, y = i * 0.05, j * 0.05
            if not pip((x, y), L):
                continue
            h = bvh_all.ray_cast(CELL2WORLD + Vector((x, y, PLAN["headZ"] + 0.5)), down, 1.0)
            grid.append(None if h[0] is None else h[0].z - CELL2WORLD.z)
            if h[0] is None:
                miss.append((round(x, 3), round(y, 3)))
    # floors hit under things standing on the landing (props, mats, rail kerb) are above 15.0; count the plain finish
    fin = [g for g in grid if g is not None and g < PLAN["headZ"] + 0.012]
    out["headLanding"] = dict(points=len(grid), noFloor=sum(1 for g in grid if g is None), noFloorAt=miss,
                              finishMin=round(min(fin), 4), finishMax=round(max(fin), 4), pointsOnFinish=len(fin))

    def line(p0, p1, name):
        n = int(round((Vector(p1) - Vector(p0)).length / 0.01))
        zs = []
        for k in range(n + 1):
            p = Vector(p0).lerp(Vector(p1), k / n)
            h = bvh_all.ray_cast(CELL2WORLD + Vector((p.x, p.y, PLAN["headZ"] + 0.6)), down, 1.2)
            zs.append(None if h[0] is None else round(h[0].z - CELL2WORLD.z, 4))
        run, best = 0, 0
        for z in zs:
            run = run + 1 if (z is None or z < PLAN["headZ"] - 0.25) else 0
            best = max(best, run)
        valid = [z for z in zs if z is not None]
        return dict(name=name, samples=len(zs), longestUnsupportedM=round(best * 0.01, 3), zMin=min(valid) if valid else None,
                    zMax=max(valid) if valid else None)
    thr = []
    for xx in [1.10 + 0.1 * k for k in range(14)]:
        thr.append(line((xx, 3.0, 0), (xx, 3.5 + 0.45 + 0.25, 0), f"stairhead x{xx:.2f}"))
    for yy in [0.88 + 0.1 * k for k in range(18)]:
        thr.append(line((3.05, yy, 0), (3.55 + 0.45 + 0.25, yy, 0), f"lift-transfer y{yy:.2f}"))
    def z_at(x, y):
        h = bvh_all.ray_cast(CELL2WORLD + Vector((x, y, PLAN["headZ"] + 0.3)), down, 0.6)
        return None if h[0] is None else round(h[0].z - CELL2WORLD.z, 4)
    out["thresholdSteps"] = dict(stairheadLanding=z_at(1.40, 3.45), stairheadStone=z_at(1.40, 3.62),
                                 liftLanding=z_at(3.50, 1.30), liftStone=z_at(3.67, 1.30))
    out["thresholds"] = dict(lines=len(thr), worstUnsupportedM=max(t["longestUnsupportedM"] for t in thr),
                             zRange=[min(t["zMin"] for t in thr), max(t["zMax"] for t in thr)], detail=thr)
    # arrival: last tread centre -> landing
    last = PLAN["steps"][-1]
    arr = []
    for yy in (0.2, 0.475, 0.75):
        zs = []
        for k in range(0, 61):
            x = 2.10 + k * 0.01
            h = bvh_all.ray_cast(CELL2WORLD + Vector((x, yy, PLAN["headZ"] + 0.5)), down, 1.0)
            zs.append(None if h[0] is None else round(h[0].z - CELL2WORLD.z, 4))
        unsup = sum(1 for z in zs if z is None or z < last["z"] - 0.25)        # would drop more than a riser into the well
        arr.append(dict(y=yy, unsupportedSamples=unsup, zFirst=zs[0], zLast=zs[-1], riserTop=round(max(z for z in zs if z is not None) - last["z"], 4)))
    out["arrival"] = arr
    out["rows"] = rows
    root.location = (0, 0, 0)
    bpy.context.view_layer.update()
    return out


def intrusion_test():
    """Exterior LOD0 triangles (placeholders excluded) whose centroid lies inside an interior clear box shrunk by 2 cm.  The head
    floor slab / trimmers of each turret (z 14.40..15.15, owned by the exterior) are reported separately."""
    boxes = {}
    for sx in (-1, 1):
        for sy in (-1, 1):
            nm = ("N" if sy > 0 else "S") + ("E" if sx > 0 else "W")
            boxes["stair_" + nm] = (sorted((sx * 10.50, sx * 14.05)), sorted((sy * 9.05, sy * 12.55)), (0.15, 19.20))
        boxes["hall_" + ("E" if sx > 0 else "W")] = (sorted((sx * 10.50, sx * 14.05)), (-8.60, 8.60), (0.15, 4.60))
    objs = [o for o in ext_objs if o.type == "MESH" and not is_col(o) and o.name.startswith("TB_EXT_LOD0") and not any(p in o.name for p in PLACEHOLDER)]
    V, F, own = tris_world(objs)
    C = V[F].mean(axis=1)
    res = {}
    for bn, ((x0, x1), (y0, y1), (z0, z1)) in boxes.items():
        m = (C[:, 0] > x0 + 0.02) & (C[:, 0] < x1 - 0.02) & (C[:, 1] > y0 + 0.02) & (C[:, 1] < y1 - 0.02) & (C[:, 2] > z0 + 0.02) & (C[:, 2] < z1 - 0.02)
        head = m & (C[:, 2] > 14.40) & (C[:, 2] < 15.16)
        other = m & ~head
        by = {}
        for i in np.nonzero(other)[0]:
            by[own[i]] = by.get(own[i], 0) + 1
        res[bn] = dict(headFloorTris=int(head.sum()), otherTris=int(other.sum()), otherByPart=by)
    return res


report["shellIntrusion"] = intrusion_test()
log("intrusion", json.dumps(report["shellIntrusion"]))

for cn in ("stair", "stair_dream"):
    if cell_root(cn):
        t = time.time()
        r = stair_checks(cn)
        report[cn] = r
        log(cn, "min cell", r["minClearanceCell"], "min with shell", r["minClearanceWithShell"], "below1.8", len(r["below18"]),
            "below2.0", r["below20"], "landing", r["headLanding"], "thr worst", r["thresholds"]["worstUnsupportedM"],
            "arrival", r["arrival"], f"{time.time() - t:.1f}s")

# ---------------------------------------------------------------------------------------------------------------------
# 4. gates: GLB animation samplers applied to the imported nodes
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
    assert a["componentType"] == 5126
    stride = bv.get("byteStride", 4 * nc)
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    out = np.empty((a["count"], nc), dtype=np.float32)
    for k in range(a["count"]):
        out[k] = np.frombuffer(bn, dtype=np.float32, count=nc, offset=start + k * stride)
    return out


js, bn = read_glb(INT_GLB)
anims = {a["name"]: a for a in js.get("animations", [])}
report["animations"] = {n: dict(channels=len(a["channels"])) for n, a in anims.items()}
log("animations", {n: len(a["channels"]) for n, a in anims.items()})


def sample(times, vals, t, rot):
    if t <= times[0]:
        v = vals[0]
    elif t >= times[-1]:
        v = vals[-1]
    else:
        k = int(np.searchsorted(times, t)) - 1
        f = (t - times[k]) / (times[k + 1] - times[k])
        a, b = vals[k].astype(float), vals[k + 1].astype(float)
        if rot and np.dot(a, b) < 0:
            b = -b
        v = a + (b - a) * f
        if rot:
            v = v / np.linalg.norm(v)
    return v


def apply_clip(clip, t):
    a = anims[clip]
    moved = set()
    for ch in a["channels"]:
        node = js["nodes"][ch["target"]["node"]]
        ob = bpy.data.objects.get(node["name"])
        if ob is None:
            continue
        smp = a["samplers"][ch["sampler"]]
        times = accessor(js, bn, smp["input"])[:, 0]
        vals = accessor(js, bn, smp["output"])
        path = ch["target"]["path"]
        if path == "translation":
            x, y, z = sample(times, vals, t, False)
            ob.location = (x, -z, y)
        elif path == "rotation":
            x, y, z, w = sample(times, vals, t, True)
            ob.rotation_mode = "QUATERNION"
            ob.rotation_quaternion = Quaternion((w, x, -z, y))
        moved.add(ob.name)
    bpy.context.view_layer.update()
    return moved


def gate_checks(cellname, key):
    root = cell_root(cellname)
    if root is None:
        return None
    parts = [o for o in descendants(root) if o.type == "MESH" and f"__anim_{key}_" in o.name]
    statics = [o for o in descendants(root) if o.type == "MESH" and not is_col(o) and o not in parts]
    info = json.loads(root["gates"])[key] if "gates" in root else {}
    N, l = info.get("cells"), info.get("strapHalfLength")
    res = {}
    for clip in (f"{key}_open", f"{key}_close"):
        if clip not in anims:
            res[clip] = "missing"
            continue
        samples = []
        for t in (0.0, 0.375, 0.75, 1.125, 1.5):
            apply_clip(clip, t)
            # pin closure
            errs = []
            for o in parts:
                if "pin_local" not in o:
                    continue
                for pn, loc in json.loads(o["pin_local"]).items():
                    e = bpy.data.objects.get(f"{cellname}__{key}_{pn}")
                    if e is None:
                        errs.append(("missing", pn))
                        continue
                    w = o.matrix_world @ Vector(loc)
                    errs.append(((w - e.matrix_world.translation).length * 1000.0, pn))
            num = [e for e in errs if e[0] != "missing"]
            # lazy-tongs rule: picket pitch vs strap angle (band 1, strap A1 vs picket 1 / lead post)
            pk = sorted([o for o in parts if f"__anim_{key}_pk" in o.name], key=lambda o: int(o.name.split("_pk")[1]))
            lead = pk[-1].matrix_world.translation
            jamb_x = pk[0].matrix_world.translation - (pk[1].matrix_world.translation - pk[0].matrix_world.translation)
            W = (lead - jamb_x).length
            sA = bpy.data.objects.get(f"{cellname}__anim_{key}_b1_A1")
            ang = None
            if sA:
                d = sA.matrix_world.to_3x3() @ Vector((1, 0, 0))
                # rest direction of A straps is (cos th_r, 0, sin th_r) in the gate plane; the rotated x axis carries the rest angle offset
                d0 = Vector((math.cos(math.acos(info["widthRest"] / N / (2 * l))), 0, math.sin(math.acos(info["widthRest"] / N / (2 * l)))))
                q = sA.matrix_world.to_quaternion()
                dd = q @ d0
                ang = math.degrees(math.atan2(dd.z, math.hypot(dd.x, dd.y)))
            th_rule = math.degrees(math.acos(max(-1, min(1, W / N / (2 * l))))) if N else None
            # interpenetration
            bv_parts = {}
            for o in parts:
                b, _ = bvh_of([o])
                bv_parts[o.name] = b
            hits = []
            names = [o.name for o in parts]
            # static neighbours, once per sample time (the car moves with nothing; cheap enough)
            bv_st = {}
            for o in statics:
                b, _ = bvh_of([o])
                if b:
                    bv_st[o.name] = b
            for i, a in enumerate(names):
                for bname in names[i + 1:]:
                    ov = bv_parts[a].overlap(bv_parts[bname])
                    if ov:
                        hits.append((a, bname, len(ov)))
                for sname, sb in bv_st.items():
                    ov = bv_parts[a].overlap(sb)
                    if ov:
                        hits.append((a, sname, len(ov)))
            # minimum clearance: every vertex of a moving part against the surfaces of every other mesh whose box is within 1 cm
            dg = bpy.context.evaluated_depsgraph_get()
            boxes = {}
            vw = {}
            for o in parts + statics:
                V_, F_, _ = tris_world([o])
                if V_ is None:
                    continue
                boxes[o.name] = (V_.min(axis=0) - 0.01, V_.max(axis=0) + 0.01)
                if o in parts:
                    vw[o.name] = V_
            bv_all = dict(bv_parts)
            bv_all.update(bv_st)
            gap = (1e9, None, None)
            for an, V_ in vw.items():
                lo, hi = boxes[an]
                for bname, bb in bv_all.items():
                    if bname == an or bname not in boxes:
                        continue
                    blo, bhi = boxes[bname]
                    if np.any(hi < blo) or np.any(bhi < lo):
                        continue
                    for v in V_:
                        h = bb.find_nearest(Vector(v), 0.01)
                        if h[0] is not None and h[3] < gap[0]:
                            gap = (h[3], an, bname)
            samples.append(dict(t=t, width=round(W, 4), strapAngleDeg=None if ang is None else round(ang, 3),
                                minClearanceMm=round(gap[0] * 1000, 3) if gap[1] else None, minClearancePair=[gap[1], gap[2]],
                                ruleAngleDeg=None if th_rule is None else round(th_rule, 3),
                                pinsChecked=len(num), pinErrorMaxMm=round(max(e[0] for e in num), 4) if num else None,
                                missingPins=[e[1] for e in errs if e[0] == "missing"], interpenetrations=hits))
        res[clip] = samples
        log(cellname, clip, [(s["t"], s["width"], s["strapAngleDeg"], s["ruleAngleDeg"], s["pinErrorMaxMm"], len(s["interpenetrations"]), s["minClearanceMm"], s["minClearancePair"]) for s in samples])
    res["movingParts"] = len(parts)
    res["rivetEmpties"] = sum(1 for o in descendants(root) if o.type == "EMPTY" and f"__{key}_pin_" in o.name)
    return res


report["gates"] = {}
for cn in ("lift", "lift_dream"):
    for key in ("car_gate", "landing_gate"):
        r = gate_checks(cn, key)
        if r is not None:
            report["gates"][f"{cn}/{key}"] = r

# ---------------------------------------------------------------------------------------------------------------------
# summary
# ---------------------------------------------------------------------------------------------------------------------
summ = {}
for cn in ("stair", "stair_dream"):
    if cn in report:
        r = report[cn]
        summ[cn] = dict(pass18=len(r["below18"]) == 0 and not r["errors"], minClearanceCell=r["minClearanceCell"],
                        minClearanceWithShell=r["minClearanceWithShell"], samplesBelow2m=r["below20"],
                        landingNoFloor=r["headLanding"]["noFloor"], landingFinish=[r["headLanding"]["finishMin"], r["headLanding"]["finishMax"]],
                        thresholdWorstUnsupportedM=r["thresholds"]["worstUnsupportedM"],
                        arrivalUnsupported=max(a["unsupportedSamples"] for a in r["arrival"]), thresholdSteps=r["thresholdSteps"],
                        step27MinClearance=min((x.get("clearanceWithShell") or 99) for x in r["step27"]),
                        colRampAboveTread=dict(interior=r["colInteriorRange"], exterior=r["colExteriorRange"]))
g = {}
for k, r in report["gates"].items():
    worst_pin = max((s["pinErrorMaxMm"] or 0) for c in ("_open", "_close") for s in r[k.split("/")[1] + c]) if isinstance(r.get(k.split("/")[1] + "_open"), list) else None
    ints = sum(len(s["interpenetrations"]) for c in ("_open", "_close") for s in r[k.split("/")[1] + c]) if isinstance(r.get(k.split("/")[1] + "_open"), list) else None
    angdev = max(abs((s["strapAngleDeg"] or 0) - (s["ruleAngleDeg"] or 0)) for c in ("_open", "_close") for s in r[k.split("/")[1] + c]) if isinstance(r.get(k.split("/")[1] + "_open"), list) else None
    mincl = min((s["minClearanceMm"] if s["minClearanceMm"] is not None else 1e9) for c in ("_open", "_close") for s in r[k.split("/")[1] + c]) if isinstance(r.get(k.split("/")[1] + "_open"), list) else None
    g[k] = dict(movingParts=r["movingParts"], rivetEmpties=r["rivetEmpties"], pinErrorMaxMm=worst_pin, interpenetrations=ints, strapAngleDevDeg=angdev,
                minClearanceMm=mincl, samplesPerClip=5)
summ["gates"] = g
summ["shellIntrusionOtherTris"] = {k: v["otherTris"] for k, v in report["shellIntrusion"].items()}
report["summary"] = summ
report["seconds"] = round(time.time() - T0, 1)
OUT.write_text(json.dumps(report, indent=1), encoding="utf-8")
log("SUMMARY", json.dumps(summ, indent=1))
log("wrote", OUT, report["seconds"], "s")
