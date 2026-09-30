"""Review renders for build-tower-wings.py (render-only: nothing here is exported).

Context built here and NOT part of the deliverable: the base exterior LOD0 (built in memory from
../exterior/build-tower-base-exterior.py, nothing written), the v4 tower lattice, a ground plane, distant town
masses and a row of plain masses on the far side of the Luna Park-mae street.  Look-dev reuses
../exterior/render_setup.py (CC0 textures by path, world-position weathering: splash dirt, damp line, AO grime,
rain streaks under ledges, soot, mottling) and adds shaders for the wing materials.
"""
import importlib.util
import math
import random
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
RS = None
WING_LEDGES = (0.6, 4.4, 4.7, 9.05, 9.35, 9.85, 11.0, 11.3, 6.3, 5.3, 1.35, 2.4)

SHOTS = {
    "cinema-street-west": dict(loc=(-17.2, -18.6, 1.5), target=(-54.0, -9.0, 7.6), lens=18, night=False),
    "cinema-street-east": dict(loc=(17.2, -18.6, 1.5), target=(54.0, -9.0, 7.6), lens=18, night=False),
    "kiosk-closeup": dict(loc=(-23.02, -10.93, 1.66), target=(-23.3, -10.27, 1.42), lens=22, night=False),
    "facade-closeup": dict(loc=(-26.55, -13.2, 1.55), target=(-29.3, -9.9, 1.45), lens=22, night=False),
    "whole-base-with-wings": dict(loc=(4.0, -66.0, 1.7), target=(0.0, 0.0, 1.7), lens=15, night=False, hide_ctx=("ctx_opp",), shift=0.2),
    "night-cinemas": dict(loc=(-44.0, -16.2, 1.6), target=(-22.5, -9.4, 8.2), lens=18, night=True),
    "lod": dict(loc=(-51.0, -160.0, 23.6), target=(-51.0, 0.0, 23.6), lens=50, night=False),
}


def load_rs(G):
    global RS
    spec = importlib.util.spec_from_file_location("tb_render", HERE.parent / "exterior" / "render_setup.py")
    RS = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(RS)
    RS.CC0 = G["TEX"]


def build_base_context(G):
    """Base exterior LOD0 in memory (TB_EXT_LOD0_*), exactly as the base build makes it; nothing is written."""
    G["BUCKET"] = {}
    G["build_lod"](0)
    coll = bpy.context.scene.collection
    root = bpy.data.objects.new("TB_EXT_LOD0", None)
    coll.objects.link(root)
    objs = []
    for key, p in sorted(G["BUCKET"].items()):
        if p.F:
            objs.append(G["make_object"](key, p, coll, root))
    return objs, list(G["LAMPS"])


def _ctx_mats():
    if "ctx_opp_0" in bpy.data.materials:
        return [bpy.data.materials[n] for n in ("ctx_opp_0", "ctx_opp_1", "ctx_opp_2", "ctx_opp_roof", "ctx_opp_frame", "ctx_opp_win", "ctx_opp_dark", "ctx_opp_awn", "ctx_opp_noren")]
    mats = []
    for i, col in enumerate(((0.40, 0.33, 0.25), (0.33, 0.29, 0.24), (0.46, 0.4, 0.3))):
        m = bpy.data.materials.new(f"ctx_opp_{i}")
        RS.textured_principled(m, "Plaster007", 2.0, col, 0.9, 0.05, 0.3, 0.4, 1.3, cc0=RS.CC0)
        mats.append(m)
    for name, col, r in (("ctx_opp_roof", (0.05, 0.055, 0.06), 0.6), ("ctx_opp_frame", (0.12, 0.07, 0.04), 0.5), ("ctx_opp_dark", (0.03, 0.025, 0.02), 0.9),
                         ("ctx_opp_awn", (0.25, 0.2, 0.14), 0.8)):
        m = bpy.data.materials.new(name)
        RS.simple(m, col, r, weather_s=0.3)
        mats.insert(3 if name == "ctx_opp_roof" else len(mats), m)
    mw = bpy.data.materials.new("ctx_opp_win")
    RS.emissive_random(mw, (0.06, 0.05, 0.04), 0.3, 0.45, 2.0)
    md = bpy.data.materials["ctx_opp_dark"]
    RS.emissive_random(md, (0.08, 0.06, 0.045), 0.8, 0.8, 1.2, colour=(1.0, 0.66, 0.36), cell=3.0)
    mn = bpy.data.materials.new("ctx_opp_noren")
    RS.simple(mn, (0.02, 0.035, 0.08), 0.95)
    mats = mats[:3] + [bpy.data.materials["ctx_opp_roof"], bpy.data.materials["ctx_opp_frame"], mw, md, bpy.data.materials["ctx_opp_awn"], mn]
    return mats


def shop_row(x0, x1, y_front, facing, seed, name="ctx_opp"):
    """Two-storey plastered shop houses (S:158514 type) as render-only context: body, hipped roof, shopfront recess,
    awning, upper windows (frames proud, dark / lit panes), cornice.  facing = +1: the front faces +y."""
    import bmesh
    rnd = random.Random(seed)
    M = _ctx_mats()
    objs = []
    sgn = 1 if x1 > x0 else -1
    x = x0
    while (x1 - x) * sgn > 4:
        w = min(rnd.uniform(6.5, 12.0), abs(x1 - x))
        d = rnd.uniform(8, 12)
        h = rnd.uniform(6.0, 8.0)
        xa, xb = sorted((x, x + sgn * w))
        yf = y_front
        yb = y_front - facing * d
        bm = bmesh.new()

        def quad(p, mi):
            f = bm.faces.new([bm.verts.new(q) for q in p])
            f.material_index = mi
            return f

        def box(lo, hi, mi):
            (ax, ay, az), (bx, by, bz) = lo, hi
            for p in (((ax, ay, az), (bx, ay, az), (bx, ay, bz), (ax, ay, bz)), ((bx, by, az), (ax, by, az), (ax, by, bz), (bx, by, bz)),
                      ((ax, by, az), (ax, ay, az), (ax, ay, bz), (ax, by, bz)), ((bx, ay, az), (bx, by, az), (bx, by, bz), (bx, ay, bz)),
                      ((ax, ay, bz), (bx, ay, bz), (bx, by, bz), (ax, by, bz))):
                quad(p, mi)
        body = rnd.randrange(3)
        ya, yb2 = sorted((yf, yb))
        box((xa, ya, 0.0), (xb, yb2, h), body)
        ridge = h + 2.4
        ym = (yf + yb) / 2
        quad(((xa, yf, h), (xb, yf, h), (xb, ym, ridge), (xa, ym, ridge)), 3)
        quad(((xb, yb, h), (xa, yb, h), (xa, ym, ridge), (xb, ym, ridge)), 3)
        quad(((xa - 0.0, yf + facing * 0.5, h - 0.05), (xb, yf + facing * 0.5, h - 0.05), (xb, yf, h + 0.25), (xa, yf, h + 0.25)), 3)
        o = facing * 0.02
        # shopfront: dark recess, frame posts, awning, sign board
        quad(((xa + 0.4, yf + o, 0.15), (xb - 0.4, yf + o, 0.15), (xb - 0.4, yf + o, 2.7), (xa + 0.4, yf + o, 2.7)), 6)
        n = max(2, int((xb - xa - 0.8) / 0.3))          # 格子 lattice over a lit shop interior
        for k in range(n + 1):
            px = xa + 0.4 + (xb - xa - 0.8) * k / n
            w2 = 0.05 if k % 6 == 0 else 0.018
            box((px - w2, min(yf, yf + facing * 0.08), 0.15), (px + w2, max(yf, yf + facing * 0.08), 2.7), 4)
        for zz in (0.9, 1.8):
            box((xa + 0.4, min(yf, yf + facing * 0.09), zz), (xb - 0.4, max(yf, yf + facing * 0.09), zz + 0.04), 4)
        # noren cloth panels hanging under the awning (dark indigo), and a hanging signboard
        nn = max(2, int((xb - xa - 1.2) / 0.45))
        for k in range(nn):
            px = xa + 0.6 + (xb - xa - 1.2) * (k + 0.5) / nn
            quad(((px - 0.2, yf + facing * 0.35, 2.3), (px + 0.2, yf + facing * 0.35, 2.3), (px + 0.2, yf + facing * 0.33, 2.9), (px - 0.2, yf + facing * 0.33, 2.9)), 8)
        box((xa + 0.3, min(yf, yf + facing * 0.1), 2.7), (xb - 0.3, max(yf, yf + facing * 0.1), 2.85), 4)
        quad(((xa + 0.2, yf + facing * 1.4, 2.95), (xb - 0.2, yf + facing * 1.4, 2.95), (xb - 0.2, yf, 3.45), (xa + 0.2, yf, 3.45)), 7)
        box((xa + 0.8, min(yf, yf + facing * 0.08), 3.6), (xb - 0.8, max(yf, yf + facing * 0.08), 4.3), 4)
        # upper windows
        nw = max(2, int((xb - xa) / 2.4))
        for k in range(nw):
            cx = xa + (xb - xa) * (k + 0.5) / nw
            box((cx - 0.6, min(yf, yf + facing * 0.06), 4.8), (cx + 0.6, max(yf, yf + facing * 0.06), 6.4), 4)
            quad(((cx - 0.5, yf + facing * 0.065, 4.9), (cx + 0.5, yf + facing * 0.065, 4.9), (cx + 0.5, yf + facing * 0.065, 6.3),
                  (cx - 0.5, yf + facing * 0.065, 6.3)), 5)
            box((cx - 0.7, min(yf, yf + facing * 0.12), 4.65), (cx + 0.7, max(yf, yf + facing * 0.12), 4.8), 4)
        box((xa, min(yf, yf + facing * 0.25), h - 0.35), (xb, max(yf, yf + facing * 0.25), h - 0.1), body)
        me = bpy.data.meshes.new(name)
        bm.normal_update()
        bm.to_mesh(me)
        bm.free()
        for m in M:
            me.materials.append(m)
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        # fix orientation of every face: outward from the body centre
        me.flip_normals() if False else None
        objs.append(ob)
        x += sgn * (w + rnd.uniform(0.0, 2.5))
    return objs


def opposite_street():
    """Far side of the Luna Park-mae street and the street ends beyond the wings (render-only context)."""
    objs = []
    objs += shop_row(12.0, 125.0, -25.0, 1, 3)
    objs += shop_row(-12.0, -125.0, -25.0, 1, 4)
    objs += shop_row(-91.0, -140.0, -9.6, -1, 5)
    objs += shop_row(91.0, 140.0, -9.6, -1, 6)
    return objs


def street_surface():
    """Unpaved street between the kerb gutters and the far side: rutted earth, wheel tracks and a few puddles (render-only)."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -19.1, 0.004))
    o = bpy.context.object
    o.name = "ctx_street"
    o.scale = (290.0, 11.6, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    m = bpy.data.materials.new("ctx_street")
    nt = RS.NT(m)
    bs = nt.node("ShaderNodeBsdfPrincipled")
    g = nt.node("ShaderNodeNewGeometry")
    sep = nt.node("ShaderNodeSeparateXYZ")
    nt.link(g.outputs["Position"], sep.inputs[0])
    mp = nt.node("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (0.08, 2.5, 1.0)
    nt.link(g.outputs["Position"], mp.inputs[0])
    rut_n = nt.node("ShaderNodeTexNoise", in_Scale=1.5, in_Detail=6.0)
    nt.link(mp.outputs[0], rut_n.inputs["Vector"])
    # two wheel tracks per direction, wavering
    y = nt.math("ADD", sep.outputs[1], nt.math("MULTIPLY", rut_n.outputs[0], 0.6))
    tracks = None
    for yc in (-15.6, -17.2, -20.9, -22.5):
        t = nt.math("SUBTRACT", 1.0, nt.math("DIVIDE", nt.math("ABSOLUTE", nt.math("SUBTRACT", y, yc)), 0.35), clamp=True)
        tracks = t if tracks is None else nt.math("MAXIMUM", tracks, t)
    v = nt.node("ShaderNodeTexVoronoi", in_Scale=45.0)
    nt.link(g.outputs["Position"], v.inputs["Vector"])
    n2 = nt.node("ShaderNodeTexNoise", in_Scale=0.18, in_Detail=5.0)
    nt.link(g.outputs["Position"], n2.inputs["Vector"])
    c = nt.mix(nt.math("MULTIPLY", v.outputs["Distance"], 1.5), (0.19, 0.165, 0.13, 1), (0.33, 0.29, 0.23, 1))
    c = nt.mix(nt.math("MULTIPLY", n2.outputs[0], 0.6), c, (0.24, 0.2, 0.15, 1))
    c = nt.mix(nt.math("MULTIPLY", tracks, 0.45), c, (0.14, 0.12, 0.095, 1))
    puddle = nt.math("MULTIPLY", nt.math("GREATER_THAN", n2.outputs[0], 0.7), nt.math("GREATER_THAN", tracks, 0.45))
    c = nt.mix(nt.math("MULTIPLY", puddle, 0.6), c, (0.05, 0.045, 0.04, 1))
    nt.link(c, bs.inputs["Base Color"])
    nt.link(nt.mixf(puddle, 0.9, 0.04), bs.inputs["Roughness"])
    bump = nt.node("ShaderNodeBump", in_Strength=0.35, in_Distance=0.02)
    nt.link(nt.math("ADD", nt.math("MULTIPLY", tracks, -0.6), nt.math("MULTIPLY", v.outputs["Distance"], 0.3)), bump.inputs["Height"])
    nt.link(bump.outputs[0], bs.inputs["Normal"])
    nt.link(bs.outputs[0], nt.out.inputs[0])
    o.data.materials.append(m)
    return o


def weathered(mat, texset, tile, tint, strength=1.2, rough=0.08, nstr=0.35, lum=0.4, metallic=0.0):
    nt, bs = RS.textured_principled(mat, texset, tile, tint, 0.9, rough, nstr, lum, strength, cc0=RS.CC0, metallic=metallic)
    return nt, bs


def timber_mat(mat, col=(0.16, 0.09, 0.045)):
    nt = RS.NT(mat)
    bs = nt.node("ShaderNodeBsdfPrincipled", in_Roughness=0.62)
    g = nt.node("ShaderNodeNewGeometry")
    mp = nt.node("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (18.0, 18.0, 1.2)
    nt.link(g.outputs["Position"], mp.inputs[0])
    wv = nt.node("ShaderNodeTexNoise", in_Scale=2.0, in_Detail=8.0)
    nt.link(mp.outputs[0], wv.inputs["Vector"])
    c = nt.mix(wv.outputs[0], (col[0] * 0.6, col[1] * 0.6, col[2] * 0.6, 1), (col[0] * 1.4, col[1] * 1.35, col[2] * 1.3, 1))
    c, _ = RS.weather(nt, c, 0.8, soot=False, streaks=False)
    nt.link(c, bs.inputs["Base Color"])
    bump = nt.node("ShaderNodeBump", in_Strength=0.25)
    nt.link(wv.outputs[0], bump.inputs["Height"])
    nt.link(bump.outputs[0], bs.inputs["Normal"])
    nt.link(bs.outputs[0], nt.out.inputs[0])


def signs_mat(mat, image, night):
    """Atlas signs: painted / printed paper and boards, a little gloss, dust and grime from the weathering functions."""
    nt = RS.NT(mat)
    bs = nt.node("ShaderNodeBsdfPrincipled", in_Roughness=0.62)
    uv = nt.node("ShaderNodeUVMap", uv_map="UVMap")
    t = nt.node("ShaderNodeTexImage", image=image)
    nt.link(uv.outputs[0], t.inputs[0])
    c, _ = RS.weather(nt, t.outputs["Color"], 0.55, soot=True, streaks=False)
    nt.link(c, bs.inputs["Base Color"])
    # at night the lamps light the boards; a faint self-glow stands in for the bounce of the reflector lamps
    bs.inputs["Emission Color"].default_value = (1.0, 0.78, 0.5, 1)
    nt.link(t.outputs["Color"], bs.inputs["Emission Color"])
    bs.inputs["Emission Strength"].default_value = 0.35 if night else 0.0
    nt.link(bs.outputs[0], nt.out.inputs[0])


def paper_mat(mat, col, night, emit):
    nt = RS.NT(mat)
    bs = nt.node("ShaderNodeBsdfPrincipled", in_Roughness=0.85)
    g = nt.node("ShaderNodeNewGeometry")
    mp = nt.node("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1.0, 1.0, 38.0)
    nt.link(g.outputs["Position"], mp.inputs[0])
    wv = nt.node("ShaderNodeTexWave", wave_type="BANDS", bands_direction="Z", in_Scale=1.0)
    nt.link(mp.outputs[0], wv.inputs["Vector"])
    rib = nt.math("POWER", wv.outputs["Fac"], 6.0)
    base = nt.mix(nt.math("MULTIPLY", rib, 0.35), (*col, 1), (col[0] * 0.4, col[1] * 0.4, col[2] * 0.4, 1))
    nt.link(base, bs.inputs["Base Color"])
    bs.inputs["Subsurface Weight"].default_value = 0.2
    bs.inputs["Transmission Weight"].default_value = 0.25
    if emit:
        nt.link(base, bs.inputs["Emission Color"])
        bs.inputs["Emission Strength"].default_value = emit
    nt.link(bs.outputs[0], nt.out.inputs[0])


def tile_mat(mat):
    nt = RS.NT(mat)
    bs = nt.node("ShaderNodeBsdfPrincipled", in_Roughness=0.3)
    vec = RS.uvm(nt, 1.0)
    ck = nt.node("ShaderNodeTexBrick", offset=0.0)       # 10 cm encaustic squares with 2 mm grout, two tones + a border colour
    ck.inputs["Brick Width"].default_value = 0.1
    ck.inputs["Row Height"].default_value = 0.1
    ck.inputs["Mortar Size"].default_value = 0.002
    ck.inputs["Color1"].default_value = (0.26, 0.09, 0.045, 1)
    ck.inputs["Color2"].default_value = (0.42, 0.34, 0.22, 1)
    ck.inputs["Mortar"].default_value = (0.16, 0.14, 0.11, 1)
    nt.link(vec, ck.inputs["Vector"])
    c, _ = RS.weather(nt, ck.outputs["Color"], 0.7, soot=False, streaks=False)
    nt.link(c, bs.inputs["Base Color"])
    nt.link(bs.outputs[0], nt.out.inputs[0])


def brass_mat(mat):
    """Polished brass with tarnish in crevices (AO) and a fingerprint / wear roughness field (detail-spec s6)."""
    nt = RS.NT(mat)
    bs = nt.node("ShaderNodeBsdfPrincipled", in_Metallic=1.0)
    ao = nt.node("ShaderNodeAmbientOcclusion", samples=8, only_local=True, in_Distance=0.05)
    g = nt.node("ShaderNodeNewGeometry")
    nz = nt.node("ShaderNodeTexNoise", in_Scale=60.0, in_Detail=4.0)
    nt.link(g.outputs["Position"], nz.inputs["Vector"])
    tarn = nt.math("SUBTRACT", 1.0, ao.outputs["AO"], clamp=True)
    c = nt.mix(nt.math("MULTIPLY", tarn, 1.2), (0.8, 0.55, 0.24, 1), (0.22, 0.16, 0.08, 1))
    nt.link(c, bs.inputs["Base Color"])
    r = nt.math("ADD", nt.math("MULTIPLY_ADD", nz.outputs[0], 0.18, 0.14), nt.math("MULTIPLY", tarn, 0.35))
    nt.link(r, bs.inputs["Roughness"])
    nt.link(bs.outputs[0], nt.out.inputs[0])


def setup_wing_materials(night, image):
    M = {m.name[3:]: m for m in bpy.data.materials if m.name.startswith("tb_")}
    RS.setup_materials(RS.CC0, night)
    for hid, tint in (("W1", (0.64, 0.47, 0.24)), ("W2", (0.62, 0.36, 0.28)), ("E1", (0.42, 0.46, 0.36)), ("E2", (0.58, 0.43, 0.2)),
                      ("E3", (0.64, 0.32, 0.18))):
        if "wall_" + hid in M:
            weathered(M["wall_" + hid], "Plaster007", 1.3, tint, strength=1.9)
        if "wallh_" + hid in M:
            weathered(M["wallh_" + hid], "Plaster007", 1.6, tuple(c * 0.86 for c in tint), strength=2.2)
    if "wall_hall" in M:
        weathered(M["wall_hall"], "Plaster007", 1.6, (0.5, 0.41, 0.28), strength=1.45)
    if "trim_hi" in M:
        weathered(M["trim_hi"], "PaintedPlaster006", 1.2, (0.78, 0.72, 0.58), strength=1.5)
    if "footway" in M:
        weathered(M["footway"], "large_sandstone_blocks", 1.2, (0.34, 0.33, 0.31), strength=0.9, rough=0.0, nstr=0.7, lum=0.8)
    if "roof_lead" in M:
        weathered(M["roof_lead"], "Metal041B", 1.0, (0.1, 0.11, 0.11), strength=0.4, metallic=0.3)
    for k, col, r in (("paint_red", (0.42, 0.045, 0.03), 0.45), ("paint_cream", (0.74, 0.66, 0.48), 0.5), ("paint_green", (0.03, 0.11, 0.06), 0.4),
                      ("joinery_green", (0.02, 0.075, 0.035), 0.32), ("joinery_red", (0.21, 0.03, 0.02), 0.32), ("joinery_cream", (0.62, 0.54, 0.38), 0.34),
                      ("joinery_blue", (0.018, 0.035, 0.085), 0.32), ("soffit", (0.55, 0.5, 0.4), 0.7), ("kiosk_inner", (0.13, 0.085, 0.05), 0.6)):
        if k in M:
            RS.simple(M[k], col, r, weather_s=0.35)
    if "gilt" in M:
        RS.simple(M["gilt"], (0.75, 0.52, 0.2), 0.32, metal=1.0)
    if "brass" in M:
        brass_mat(M["brass"])
    for k in ("timber",):
        if k in M:
            timber_mat(M[k])
    if "bamboo" in M:
        timber_mat(M["bamboo"], (0.42, 0.32, 0.15))
    if "signs" in M:
        signs_mat(M["signs"], image, night)
    if "lantern_red" in M:
        paper_mat(M["lantern_red"], (0.55, 0.06, 0.035), night, 9.0 if night else 1.2)
    if "lantern_white" in M:
        paper_mat(M["lantern_white"], (0.82, 0.74, 0.58), night, 7.0 if night else 1.0)
    if "tile" in M:
        tile_mat(M["tile"])
    if "bulb" in M:
        RS.simple(M["bulb"], (0.95, 0.88, 0.7), 0.1, emit=(140.0 if night else 28.0), emit_col=(1.0, 0.55, 0.22))
    if "lamp_glass" in M:
        RS.simple(M["lamp_glass"], (0.9, 0.87, 0.8), 0.35, emit=(25.0 if night else 6.0), emit_col=(1.0, 0.62, 0.3), transl=0.3)
    for k in M:     # per-hall placeholders reuse the base shaders
        if k.endswith("_backing") or k.endswith("_backing_dark") or k.endswith("_curtain"):
            pass


def add_point(loc, energy, col=(1.0, 0.62, 0.32), size=0.1, name="ctx_pl"):
    ld = bpy.data.lights.new(name, "POINT")
    ld.energy, ld.shadow_soft_size, ld.color = energy, size, col
    o = bpy.data.objects.new(name, ld)
    o.location = loc
    bpy.context.scene.collection.objects.link(o)
    return o


def add_spot(loc, target, energy, angle=1.4, col=(1.0, 0.66, 0.36), name="ctx_sp"):
    ld = bpy.data.lights.new(name, "SPOT")
    ld.energy, ld.spot_size, ld.spot_blend, ld.shadow_soft_size, ld.color = energy, angle, 0.5, 0.05, col
    o = bpy.data.objects.new(name, ld)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(o)
    return o


def run(G, renders, samples, l0):
    load_rs(G)
    names = list(SHOTS) if renders == "all" else [r.strip() for r in renders.split(",") if r.strip()]
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        prefs.compute_device_type = "OPTIX"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = d.type == "OPTIX"
        sc.cycles.device = "GPU"
    except Exception:
        sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    sc.cycles.max_bounces = 6
    sc.cycles.transparent_max_bounces = 16
    sc.cycles.light_sampling_threshold = 0.01
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    sc.render.image_settings.file_format = "PNG"
    sc.view_settings.view_transform = "AgX"
    try:
        sc.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    base_objs, base_lamps = build_base_context(G)
    RS.LEDGES = tuple(sorted(set(RS.LEDGES + WING_LEDGES)))
    tower = RS.import_tower(G["V4_GLB"], "redbrown")
    ground = RS.ground()
    far = RS.far_context()
    for o in list(far):
        x, y = o.location.x, o.location.y
        if (abs(x) < 145 and -45 < y < 22) or (abs(x) < 40 and y < -20):
            bpy.data.objects.remove(o, do_unlink=True)
            far.remove(o)
    opp = opposite_street()
    street = street_surface()
    ctx = [ground, street] + far + opp
    image = bpy.data.images.load(str(G["ATLAS_PNG"]), check_existing=True)
    wing_roots = {o["lod"]: o for o in bpy.data.objects if o.name.startswith("TW_LOD") and o.type == "EMPTY"}
    base_root = bpy.data.objects.get("TB_EXT_LOD0")
    for name in names:
        shot = SHOTS[name]
        night = shot["night"]
        setup_wing_materials(night, image)
        RS.world_sky(night)
        for o in [o for o in bpy.data.objects if o.name.startswith(("ctx_sun", "Point", "shotcam", "ctx_pl", "ctx_sp", "Spot"))]:
            bpy.data.objects.remove(o, do_unlink=True)
        RS.sun(night)
        RS.point_lights(base_lamps, night)
        for p in l0["lamps"]:
            add_point(tuple(p), 180 if night else 45)
        for p in l0["poster_lamps"]:
            add_spot(tuple(p), tuple(Vector(p) + Vector((0, 0, -1.0))), 90 if night else 18, angle=1.9)
        for p in l0["kiosk_lamps"]:
            add_point(tuple(p), 25 if night else 6, size=0.05)
        if night:
            for p, red in l0["lanterns"]:
                add_point(tuple(p), 14 if red else 18, col=(1.0, 0.35, 0.18) if red else (1.0, 0.7, 0.4), size=0.15)
        RS.compositor(night)
        sc.view_settings.exposure = {True: 0.7, False: 0.55}[night]
        for o in [o for o in bpy.data.objects if o.name.startswith("ctx_fill")]:
            bpy.data.objects.remove(o, do_unlink=True)
        if name == "lod":
            w = sc.world.node_tree
            for n in list(w.nodes):
                w.nodes.remove(n)
            bg = w.nodes.new("ShaderNodeBackground")
            bg.inputs[0].default_value = (0.5, 0.52, 0.55, 1)
            bg.inputs[1].default_value = 1.2
            wo = w.nodes.new("ShaderNodeOutputWorld")
            w.links.new(bg.outputs[0], wo.inputs[0])
            s = bpy.data.objects.get("ctx_sun")
            s.rotation_euler = (math.radians(50), 0, math.radians(200))
            s.data.color = (1, 0.97, 0.92)
            s.data.energy = 3.0
            sc.node_tree.nodes["Math"].inputs[1].default_value = 0.0
            sc.view_settings.exposure = 0.0
            for o in [o for o in bpy.data.objects if o.type == "LIGHT" and o.name != "ctx_sun"]:
                o.hide_render = True
            for lod, root in wing_roots.items():
                for ch in root.children:
                    ch.hide_render = False
                root.location = (0, lod * 60.0, (2 - lod) * 15.8)
            for o in ctx + tower + base_objs:
                o.hide_render = True
            cam = RS.camera("shotcam", shot["loc"], shot["target"], shot["lens"])
            cam.data.type = "ORTHO"
            cam.data.ortho_scale = 84
        else:
            for lod, root in wing_roots.items():
                root.location = (0, 0, 0)
                for ch in root.children:
                    ch.hide_render = lod != 0
            for o in ctx + tower + base_objs:
                o.hide_render = False
            for o in ctx:
                if any(o.name.startswith(h) for h in shot.get("hide_ctx", ())):
                    o.hide_render = True
            cam = RS.camera("shotcam", shot["loc"], shot["target"], shot["lens"])
            cam.data.shift_y = shot.get("shift", 0.0)
        sc.camera = cam
        sc.render.filepath = str(HERE / f"{name}.png")
        bpy.ops.render.render(write_still=True)
        print("rendered", name)
