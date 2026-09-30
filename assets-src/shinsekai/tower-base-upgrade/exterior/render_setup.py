"""Review renders for build-tower-base-exterior.py (render-only: nothing here is exported).

Shaders use the CC0 sets in research-cache/materials-93 by path (not copied) plus procedural
weathering driven by world position (splash dirt, damp line, rain streaks, soot, AO grime). The same
functions are described in README.md for a TSL port. Context that is NOT part of the deliverable:
the v4 tower lattice (base parts stripped), cinema-wing placeholder masses, a street ground plane.
"""

import math
import random
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector, Matrix


def img(path, noncolor=False):
    im = bpy.data.images.load(str(path), check_existing=True)
    if noncolor:
        im.colorspace_settings.name = "Non-Color"
    return im


class NT:
    def __init__(self, mat):
        mat.use_nodes = True
        self.nt = mat.node_tree
        self.n = self.nt.nodes
        self.l = self.nt.links
        for node in list(self.n):
            self.n.remove(node)
        self.out = self.n.new("ShaderNodeOutputMaterial")

    def node(self, t, **kw):
        nd = self.n.new(t)
        for k, v in kw.items():
            if k.startswith("in_"):
                key = k[3:]
                try:
                    nd.inputs[key].default_value = v
                except Exception:
                    nd.inputs[int(key)].default_value = v
            else:
                setattr(nd, k, v)
        return nd

    def link(self, a, b):
        self.l.new(a, b)

    def math(self, op, a, b=None, c=None, clamp=False):
        m = self.node("ShaderNodeMath", operation=op, use_clamp=clamp)
        for i, v in enumerate((a, b, c)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                m.inputs[i].default_value = v
            else:
                self.link(v, m.inputs[i])
        return m.outputs[0]

    def mix(self, fac, a, b, mode="MIX"):
        m = self.node("ShaderNodeMix", data_type="RGBA", blend_type=mode)
        for sock, v in ((m.inputs[0], fac), (m.inputs[6], a), (m.inputs[7], b)):
            if isinstance(v, (int, float)):
                sock.default_value = v
            elif isinstance(v, tuple):
                sock.default_value = v
            else:
                self.link(v, sock)
        return m.outputs[2]

    def mixf(self, fac, a, b):
        m = self.node("ShaderNodeMix", data_type="FLOAT")
        for sock, v in ((m.inputs[0], fac), (m.inputs[2], a), (m.inputs[3], b)):
            if isinstance(v, (int, float)):
                sock.default_value = v
            else:
                self.link(v, sock)
        return m.outputs[0]


def uvm(nt, scale, uvname="UVMap", rot=0.0):
    uv = nt.node("ShaderNodeUVMap", uv_map=uvname)
    mp = nt.node("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / scale, 1 / scale, 1)
    mp.inputs["Rotation"].default_value = (0, 0, rot)
    nt.link(uv.outputs[0], mp.inputs[0])
    return mp.outputs[0]


def pos_xyz(nt):
    g = nt.node("ShaderNodeNewGeometry")
    sep = nt.node("ShaderNodeSeparateXYZ")
    nt.link(g.outputs["Position"], sep.inputs[0])
    return g, sep


LEDGES = (4.6, 13.1, 14.35, 14.95, 19.0, 5.8, 9.3, 12.7, 16.1, 1.5, 2.9)


def weather(nt, col, strength=1.0, grime=(0.09, 0.075, 0.06), soot=True, streaks=True, ledges=LEDGES):
    """World-position weathering on a colour socket. Returns (colour, roughness_add)."""
    g, sep = pos_xyz(nt)
    z = sep.outputs[2]
    # splash dirt 0..0.7 m with a ragged top edge
    nz = nt.node("ShaderNodeTexNoise", in_Scale=6.0, in_Detail=6.0)
    nt.link(g.outputs["Position"], nz.inputs["Vector"])
    ragged = nt.math("ADD", z, nt.math("MULTIPLY", nz.outputs[0], 0.35))
    splash = nt.math("SUBTRACT", 1.0, nt.math("DIVIDE", ragged, 0.85), clamp=True)
    splash = nt.math("POWER", splash, 1.6)
    col = nt.mix(nt.math("MULTIPLY", splash, 0.75 * strength), col, (0.075, 0.058, 0.04, 1))
    # damp line (darker band just above the splash)
    damp = nt.math("LESS_THAN", ragged, 0.55)
    col = nt.mix(nt.math("MULTIPLY", damp, 0.22 * strength), col, (0.0, 0.0, 0.0, 1), "MULTIPLY") if False else \
        nt.mix(nt.math("MULTIPLY", damp, 0.25 * strength), col, nt.mix(1.0, col, (0.62, 0.6, 0.58, 1), "MULTIPLY"))
    # AO grime in crevices
    ao = nt.node("ShaderNodeAmbientOcclusion", samples=8, only_local=True, in_Distance=0.35)
    inv = nt.math("SUBTRACT", 1.0, ao.outputs["AO"], clamp=True)
    col = nt.mix(nt.math("MULTIPLY", nt.math("POWER", inv, 0.8), 0.85 * strength), col, (*grime, 1), "MULTIPLY")
    if streaks:
        # rain streaks: noise stretched vertically, stronger under projections (proxy: upper half of storeys)
        mp = nt.node("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (7.0, 7.0, 0.35)
        nt.link(g.outputs["Position"], mp.inputs[0])
        sn = nt.node("ShaderNodeTexNoise", in_Scale=1.6, in_Detail=3.0, in_Roughness=0.4)
        nt.link(mp.outputs[0], sn.inputs["Vector"])
        st = nt.math("SUBTRACT", sn.outputs[0], 0.52, clamp=True)
        st = nt.math("MULTIPLY", st, 3.0 * strength, clamp=True)
        # rain run-off starts under each ledge (cornices, string courses, sills) and fades over ~1.6 m
        m = None
        for h in ledges:
            d = nt.math("SUBTRACT", h, z)
            mh = nt.math("MULTIPLY", nt.math("GREATER_THAN", d, 0.0), nt.math("SUBTRACT", 1.0, nt.math("DIVIDE", d, 1.6), clamp=True))
            m = mh if m is None else nt.math("MAXIMUM", m, mh)
        st = nt.math("MULTIPLY", st, nt.math("MULTIPLY_ADD", m, 0.8, 0.25))
        col = nt.mix(nt.math("MULTIPLY", st, 0.65), col, nt.mix(1.0, col, (0.55, 0.52, 0.48, 1), "MULTIPLY"))
    if soot:
        sootf = nt.math("MULTIPLY", nt.math("SUBTRACT", nt.math("DIVIDE", z, 22.0), 0.45, clamp=True), 0.6 * strength)
        col = nt.mix(sootf, col, nt.mix(1.0, col, (0.72, 0.7, 0.68, 1), "MULTIPLY"))
    # large-scale mottling +/- a few percent
    mn = nt.node("ShaderNodeTexNoise", in_Scale=0.35, in_Detail=2.0)
    nt.link(g.outputs["Position"], mn.inputs["Vector"])
    mottle = nt.math("MULTIPLY_ADD", mn.outputs[0], 0.16, 0.92)
    cm = nt.node("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    cm.inputs[0].default_value = 1.0
    nt.link(col, cm.inputs[6])
    comb = nt.node("ShaderNodeCombineXYZ")
    for i in range(3):
        nt.link(mottle, comb.inputs[i])
    nt.link(comb.outputs[0], cm.inputs[7])
    return cm.outputs[2], nt.math("MULTIPLY", splash, 0.1)


def joints(nt, uvsock_u_v):
    """Scored-ashlar vertical joints from UV (u metres) and world z: rows 0.5 m from 0.6 below 4.6 m,
    0.6 m from 2.9 above. Returns a 0..1 joint mask (1 = in the joint)."""
    u, zsock = uvsock_u_v
    low = nt.math("LESS_THAN", zsock, 4.6)
    z0 = nt.mixf(low, 2.9, 0.6)
    c = nt.mixf(low, 0.6, 0.5)
    blen = nt.mixf(low, 1.2, 1.0)
    row = nt.math("FLOOR", nt.math("DIVIDE", nt.math("SUBTRACT", zsock, z0), c))
    off = nt.math("MULTIPLY", nt.math("MODULO", nt.math("ADD", row, 1000.0), 2.0), 0.5)
    fu = nt.math("FRACT", nt.math("ADD", nt.math("DIVIDE", u, blen), off))
    d = nt.math("ABSOLUTE", nt.math("SUBTRACT", fu, 0.5))
    w = nt.math("DIVIDE", 0.007, blen)
    return nt.math("GREATER_THAN", d, nt.math("SUBTRACT", 0.5, w))


def textured_principled(mat, texset, tile, tint, rough_mul=1.0, rough_add=0.0, normal_strength=0.6, lum_mix=0.6,
                        weather_strength=1.0, joint=False, metallic=0.0, cc0=None, is_arm=False):
    nt = NT(mat)
    bs = nt.node("ShaderNodeBsdfPrincipled")
    nt.link(bs.outputs[0], nt.out.inputs[0])
    vec = uvm(nt, tile)
    col = None
    rough = None
    nrm = None
    if texset:
        base = cc0 / texset
        if texset in ("large_sandstone_blocks", "green_metal_rust"):
            cimg = cc0 / f"{texset}_diff_2k.jpg"
            rimg = cc0 / f"{texset}_arm_2k.jpg"
            nimg = cc0 / f"{texset}_nor_gl_2k.jpg"
            is_arm = True
        else:
            cimg = base / f"{texset}_2K-JPG_Color.jpg"
            rimg = base / f"{texset}_2K-JPG_Roughness.jpg"
            nimg = base / f"{texset}_2K-JPG_NormalGL.jpg"
        ct = nt.node("ShaderNodeTexImage", image=img(cimg))
        nt.link(vec, ct.inputs[0])
        rt = nt.node("ShaderNodeTexImage", image=img(rimg, True))
        nt.link(vec, rt.inputs[0])
        nm = nt.node("ShaderNodeTexImage", image=img(nimg, True))
        nt.link(vec, nm.inputs[0])
        # keep the texture's value variation, take hue from the estimated period colour
        bw = nt.node("ShaderNodeRGBToBW")
        nt.link(ct.outputs[0], bw.inputs[0])
        lum = nt.math("MULTIPLY_ADD", bw.outputs[0], 1.6 * lum_mix, 1.0 - 0.45 * lum_mix)
        comb = nt.node("ShaderNodeCombineXYZ")
        for i in range(3):
            nt.link(lum, comb.inputs[i])
        col = nt.mix(1.0, (*tint, 1), comb.outputs[0], "MULTIPLY")
        if is_arm:
            sepc = nt.node("ShaderNodeSeparateColor")
            nt.link(rt.outputs[0], sepc.inputs[0])
            rough = nt.math("MULTIPLY_ADD", sepc.outputs[1], rough_mul, rough_add)
        else:
            rough = nt.math("MULTIPLY_ADD", rt.outputs[0], rough_mul, rough_add)
        nmap = nt.node("ShaderNodeNormalMap", in_Strength=normal_strength)
        nt.link(nm.outputs[0], nmap.inputs["Color"])
        nrm = nmap.outputs[0]
    else:
        col = nt.node("ShaderNodeRGB").outputs[0]
        col.node.outputs[0].default_value = (*tint, 1)
        rough = rough_add
    if joint:
        uvn = nt.node("ShaderNodeUVMap", uv_map="UVMap")
        sepu = nt.node("ShaderNodeSeparateXYZ")
        nt.link(uvn.outputs[0], sepu.inputs[0])
        g, sep = pos_xyz(nt)
        jm = joints(nt, (sepu.outputs[0], sep.outputs[2]))
        col = nt.mix(nt.math("MULTIPLY", jm, 0.45), col, (0.12, 0.1, 0.08, 1), "MULTIPLY")
        bump = nt.node("ShaderNodeBump", in_Strength=0.35, in_Distance=0.01)
        nt.link(nt.math("SUBTRACT", 1.0, jm), bump.inputs["Height"])
        if nrm is not None:
            nt.link(nrm, bump.inputs["Normal"])
        nrm = bump.outputs[0]
    if weather_strength > 0:
        col, radd = weather(nt, col, weather_strength)
        if not isinstance(rough, (int, float)):
            rough = nt.math("ADD", rough, radd)
    nt.link(col, bs.inputs["Base Color"])
    if isinstance(rough, (int, float)):
        bs.inputs["Roughness"].default_value = rough
    else:
        nt.link(rough, bs.inputs["Roughness"])
    if nrm is not None:
        nt.link(nrm, bs.inputs["Normal"])
    bs.inputs["Metallic"].default_value = metallic
    return nt, bs


def glass_mat(mat, night):
    nt = NT(mat)
    tr = nt.node("ShaderNodeBsdfTransparent", in_Color=(0.8, 0.86, 0.84, 1))
    gl = nt.node("ShaderNodeBsdfGlossy", in_Roughness=0.03, in_Color=(1, 1, 1, 1))
    # period cylinder glass: slight waviness
    g = nt.node("ShaderNodeNewGeometry")
    mp = nt.node("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (2.0, 2.0, 0.6)
    nt.link(g.outputs["Position"], mp.inputs[0])
    nz = nt.node("ShaderNodeTexNoise", in_Scale=3.0, in_Detail=1.0)
    nt.link(mp.outputs[0], nz.inputs["Vector"])
    bump = nt.node("ShaderNodeBump", in_Strength=0.08, in_Distance=0.02)
    nt.link(nz.outputs[0], bump.inputs["Height"])
    nt.link(bump.outputs[0], gl.inputs["Normal"])
    fr = nt.node("ShaderNodeFresnel", in_IOR=1.52)
    nt.link(bump.outputs[0], fr.inputs["Normal"])
    # dust: lifts the reflection base a little, more at the bottom of the pane (noise proxy)
    dn = nt.node("ShaderNodeTexNoise", in_Scale=18.0, in_Detail=4.0)
    nt.link(g.outputs["Position"], dn.inputs["Vector"])
    fac = nt.math("ADD", fr.outputs[0], nt.math("MULTIPLY", dn.outputs[0], 0.12))
    mx = nt.node("ShaderNodeMixShader")
    nt.link(fac, mx.inputs[0])
    nt.link(tr.outputs[0], mx.inputs[1])
    nt.link(gl.outputs[0], mx.inputs[2])
    nt.link(mx.outputs[0], nt.out.inputs[0])


def emissive_random(mat, base, rough, lit_frac, strength, colour=(1.0, 0.62, 0.3), cell=1.6):
    nt = NT(mat)
    bs = nt.node("ShaderNodeBsdfPrincipled", in_Roughness=rough)
    bs.inputs["Base Color"].default_value = (*base, 1)
    g = nt.node("ShaderNodeNewGeometry")
    mp = nt.node("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / cell, 1 / cell, 1 / 2.5)
    nt.link(g.outputs["Position"], mp.inputs[0])
    v = nt.node("ShaderNodeTexVoronoi", in_Scale=1.0)
    nt.link(mp.outputs[0], v.inputs["Vector"])
    on = nt.math("LESS_THAN", v.outputs["Distance"] if False else nt.node("ShaderNodeSeparateColor").outputs[0], 1.0) if False else None
    sepc = nt.node("ShaderNodeSeparateColor")
    nt.link(v.outputs["Color"], sepc.inputs[0])
    lit = nt.math("LESS_THAN", sepc.outputs[0], lit_frac)
    # warm light falls off towards the floor/ceiling of the room box
    em = nt.math("MULTIPLY", lit, strength)
    bs.inputs["Emission Color"].default_value = (*colour, 1)
    nt.link(em, bs.inputs["Emission Strength"])
    nt.link(bs.outputs[0], nt.out.inputs[0])


def simple(mat, col, rough, metal=0.0, emit=0.0, emit_col=(1, 0.6, 0.28), transl=0.0, weather_s=0.0):
    nt = NT(mat)
    bs = nt.node("ShaderNodeBsdfPrincipled", in_Roughness=rough, in_Metallic=metal)
    colsock = nt.node("ShaderNodeRGB").outputs[0]
    colsock.node.outputs[0].default_value = (*col, 1)
    c = colsock
    if weather_s > 0:
        c, _ = weather(nt, c, weather_s, soot=False, streaks=False)
    nt.link(c, bs.inputs["Base Color"])
    if emit:
        bs.inputs["Emission Color"].default_value = (*emit_col, 1)
        bs.inputs["Emission Strength"].default_value = emit
    if transl:
        bs.inputs["Subsurface Weight"].default_value = transl
    nt.link(bs.outputs[0], nt.out.inputs[0])
    return nt, bs


def tile_deck(mat):
    nt = NT(mat)
    bs = nt.node("ShaderNodeBsdfPrincipled")
    vec = uvm(nt, 1.0)
    br = nt.node("ShaderNodeTexBrick", offset=0.0)
    br.inputs["Brick Width"].default_value = 0.3
    br.inputs["Row Height"].default_value = 0.3
    br.inputs["Color1"].default_value = (0.36, 0.17, 0.08, 1)
    br.inputs["Color2"].default_value = (0.28, 0.13, 0.07, 1)
    br.inputs["Mortar"].default_value = (0.2, 0.18, 0.15, 1)
    br.inputs["Mortar Size"].default_value = 0.007
    nt.link(vec, br.inputs["Vector"])
    col, radd = weather(nt, br.outputs["Color"], 0.8, soot=False, streaks=False)
    # foot-traffic wear lane: lighter, smoother along the centre line between the stair heads
    nt.link(col, bs.inputs["Base Color"])
    rn = nt.node("ShaderNodeTexNoise", in_Scale=4.0)
    nt.link(rn.outputs[0], bs.inputs["Roughness"]) if False else None
    bs.inputs["Roughness"].default_value = 0.68
    bump = nt.node("ShaderNodeBump", in_Strength=0.3, in_Distance=0.01)
    nt.link(br.outputs["Fac"], bump.inputs["Height"])
    nt.link(bump.outputs[0], bs.inputs["Normal"])
    nt.link(bs.outputs[0], nt.out.inputs[0])


def macadam(mat, wet=0.35):
    nt = NT(mat)
    bs = nt.node("ShaderNodeBsdfPrincipled")
    g = nt.node("ShaderNodeNewGeometry")
    v = nt.node("ShaderNodeTexVoronoi", in_Scale=60.0)
    nt.link(g.outputs["Position"], v.inputs["Vector"])
    n2 = nt.node("ShaderNodeTexNoise", in_Scale=0.25, in_Detail=4.0)
    nt.link(g.outputs["Position"], n2.inputs["Vector"])
    c = nt.mix(nt.math("MULTIPLY", v.outputs["Distance"], 1.4), (0.07, 0.065, 0.058, 1), (0.16, 0.15, 0.13, 1))
    c = nt.mix(nt.math("MULTIPLY", n2.outputs[0], 0.5), c, (0.12, 0.1, 0.075, 1))
    puddle = nt.math("GREATER_THAN", n2.outputs[0], 1.0 - wet)
    nt.link(c, bs.inputs["Base Color"])
    nt.link(nt.mixf(puddle, 0.82, 0.12), bs.inputs["Roughness"])
    bump = nt.node("ShaderNodeBump", in_Strength=0.25, in_Distance=0.01)
    nt.link(v.outputs["Distance"], bump.inputs["Height"])
    nt.link(bump.outputs[0], bs.inputs["Normal"])
    nt.link(bs.outputs[0], nt.out.inputs[0])


def earth(mat):
    nt = NT(mat)
    bs = nt.node("ShaderNodeBsdfPrincipled", in_Roughness=0.92)
    g = nt.node("ShaderNodeNewGeometry")
    n1 = nt.node("ShaderNodeTexNoise", in_Scale=0.08, in_Detail=6.0)
    nt.link(g.outputs["Position"], n1.inputs["Vector"])
    v = nt.node("ShaderNodeTexVoronoi", in_Scale=30.0)
    nt.link(g.outputs["Position"], v.inputs["Vector"])
    c = nt.mix(n1.outputs[0], (0.13, 0.1, 0.07, 1), (0.22, 0.18, 0.13, 1))
    c = nt.mix(nt.math("MULTIPLY", v.outputs["Distance"], 0.5), c, (0.09, 0.08, 0.06, 1))
    nt.link(c, bs.inputs["Base Color"])
    bump = nt.node("ShaderNodeBump", in_Strength=0.3)
    nt.link(v.outputs["Distance"], bump.inputs["Height"])
    nt.link(bump.outputs[0], bs.inputs["Normal"])
    nt.link(bs.outputs[0], nt.out.inputs[0])


def foliage(mat, flowers=False):
    nt = NT(mat)
    bs = nt.node("ShaderNodeBsdfPrincipled", in_Roughness=0.75)
    g = nt.node("ShaderNodeNewGeometry")
    v = nt.node("ShaderNodeTexVoronoi", in_Scale=25.0 if not flowers else 3.0)
    nt.link(g.outputs["Position"], v.inputs["Vector"])
    if flowers:
        sepc = nt.node("ShaderNodeSeparateColor")
        nt.link(v.outputs["Color"], sepc.inputs[0])
        c = nt.mix(nt.math("GREATER_THAN", sepc.outputs[0], 0.5), (0.75, 0.62, 0.12, 1), (0.62, 0.1, 0.08, 1))
        c = nt.mix(nt.math("GREATER_THAN", sepc.outputs[1], 0.7), c, (0.8, 0.78, 0.7, 1))
    else:
        c = nt.mix(nt.math("MULTIPLY", v.outputs["Distance"], 1.5), (0.02, 0.05, 0.015, 1), (0.06, 0.12, 0.035, 1))
    nt.link(c, bs.inputs["Base Color"])
    bs.inputs["Subsurface Weight"].default_value = 0.15
    bump = nt.node("ShaderNodeBump", in_Strength=0.8)
    nt.link(v.outputs["Distance"], bump.inputs["Height"])
    nt.link(bump.outputs[0], bs.inputs["Normal"])
    nt.link(bs.outputs[0], nt.out.inputs[0])


def setup_materials(cc0, night):
    M = {m.name[3:]: m for m in bpy.data.materials if m.name.startswith("tb_")}
    def has(k):
        return k in M
    if has("wall"):
        textured_principled(M["wall"], "Plaster007", 1.3, (0.62, 0.41, 0.15), 0.9, 0.08, 0.22, 0.32, 1.25, joint=True, cc0=cc0)
    if has("reveal"):
        textured_principled(M["reveal"], "Plaster007", 1.3, (0.55, 0.37, 0.14), 0.9, 0.08, 0.22, 0.32, 1.25, cc0=cc0)
    if has("trim"):
        textured_principled(M["trim"], "PaintedPlaster006", 1.2, (0.70, 0.53, 0.27), 0.8, 0.1, 0.3, 0.3, 1.0, cc0=cc0)
    if has("vault"):
        textured_principled(M["vault"], "Plaster007", 2.0, (0.42, 0.34, 0.22), 0.9, 0.05, 0.4, 0.5, 1.0, cc0=cc0)
    if has("plinth"):
        textured_principled(M["plinth"], "large_sandstone_blocks", 1.6, (0.3, 0.29, 0.28), 1.0, 0.0, 0.8, 0.9, 1.2, cc0=cc0)
    if has("sill"):
        textured_principled(M["sill"], "large_sandstone_blocks", 1.2, (0.48, 0.44, 0.37), 1.0, 0.0, 0.6, 0.7, 0.7, cc0=cc0)
    if has("kerb"):
        textured_principled(M["kerb"], "large_sandstone_blocks", 1.0, (0.36, 0.35, 0.33), 1.0, 0.0, 0.8, 0.8, 1.0, cc0=cc0)
    if has("roof_sheet"):
        textured_principled(M["roof_sheet"], "Metal041B", 1.0, (0.06, 0.085, 0.075), 0.6, 0.18, 0.5, 0.4, 0.5, metallic=0.35, cc0=cc0)
    if has("iron"):
        textured_principled(M["iron"], "green_metal_rust", 0.8, (0.05, 0.065, 0.055), 0.8, 0.05, 0.6, 0.6, 0.4, metallic=0.4, cc0=cc0)
    if has("medallion"):
        textured_principled(M["medallion"], "PaintedPlaster006", 1.0, (0.06, 0.16, 0.09), 0.8, 0.1, 0.4, 0.3, 0.5, cc0=cc0)
    if has("joinery"):
        simple(M["joinery"], (0.11, 0.045, 0.028), 0.36, weather_s=0.4)
    if has("glass"):
        glass_mat(M["glass"], night)
    if has("backing"):
        emissive_random(M["backing"], (0.13, 0.095, 0.07), 0.9, 0.7 if night else 0.35, 5.0 if night else 1.5)
    if has("backing_dark"):
        simple(M["backing_dark"], (0.04, 0.032, 0.028), 0.95)
    if has("curtain"):
        emissive_random(M["curtain"], (0.55, 0.44, 0.28), 0.95, 0.55 if night else 0.3, 1.5 if night else 0.6, cell=1.6)
    if has("brass"):
        nt, bs = simple(M["brass"], (0.78, 0.52, 0.22), 0.24, metal=1.0)
    if has("porcelain"):
        simple(M["porcelain"], (0.82, 0.8, 0.74), 0.08)
    if has("bulb"):
        simple(M["bulb"], (0.95, 0.88, 0.7), 0.1, emit=(140.0 if night else 0.0), emit_col=(1.0, 0.55, 0.22))
    if has("lamp_glass"):
        simple(M["lamp_glass"], (0.9, 0.87, 0.8), 0.35, emit=(25.0 if night else 2.2), emit_col=(1.0, 0.62, 0.3), transl=0.3)
    if has("deck"):
        tile_deck(M["deck"])
    if has("paving"):
        macadam(M["paving"])
    if has("soil"):
        simple(M["soil"], (0.06, 0.045, 0.03), 0.95)
    if has("foliage"):
        foliage(M["foliage"])
    if has("flowers"):
        foliage(M["flowers"], True)
    if has("inner"):
        simple(M["inner"], (0.5, 0.47, 0.42), 0.9)
    if has("enamel"):
        simple(M["enamel"], (0.015, 0.03, 0.09), 0.1)
    if has("wire"):
        simple(M["wire"], (0.02, 0.02, 0.02), 0.5, metal=0.6)


def import_tower(v4glb, iron_colour):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(v4glb))
    new = [o for o in bpy.data.objects if o not in before]
    keep = []
    for o in new:
        if o.type != "MESH":
            continue
        nm = o.name
        if "pale masonry" in nm or "unglazed" in nm or nm.startswith("roof_garden_deck") or nm.startswith("elevator_car"):
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        me = o.data
        bm = bmesh.new()
        bm.from_mesh(me)
        mw = o.matrix_world
        kill = []
        for v in bm.verts:
            p = mw @ v.co
            if "trim" in nm:
                if p.z < 16.7 or (p.z < 23.2 and (abs(p.x) > 8.5 or abs(p.y) > 8.5)):
                    kill.append(v)
            elif "iron" in nm:
                if p.z < 23.2 and abs(p.x) > 8.5:
                    kill.append(v)
        bmesh.ops.delete(bm, geom=kill, context="VERTS")
        bm.to_mesh(me)
        bm.free()
        if "iron" in nm:
            m = bpy.data.materials.new("ctx_tower_iron")
            col = (0.24, 0.085, 0.05) if iron_colour == "redbrown" else (0.12, 0.14, 0.14)
            textured_principled(m, "green_metal_rust", 0.6, col, 0.7, 0.15, 0.6, 0.35, 0.3, metallic=0.5, cc0=CC0)
            me.materials.clear()
            me.materials.append(m)
        keep.append(o)
    return keep


def wing_stubs():
    """Render-only placeholder masses for the cinema wings (T: fr.267; envelope per INTERFACE)."""
    mw = bpy.data.materials.new("ctx_wing_wall")
    textured_principled(mw, "Plaster007", 2.0, (0.62, 0.36, 0.34), 0.9, 0.05, 0.5, 0.5, 1.0, cc0=CC0)
    mr = bpy.data.materials.new("ctx_wing_roof")
    nt = NT(mr)
    bs = nt.node("ShaderNodeBsdfPrincipled", in_Roughness=0.55)
    g = nt.node("ShaderNodeNewGeometry")
    wv = nt.node("ShaderNodeTexWave", wave_type="BANDS", bands_direction="Y", in_Scale=3.0)
    wv.inputs["Scale"].default_value = 1.0
    mp = nt.node("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (3.6, 3.6, 3.6)
    nt.link(g.outputs["Position"], mp.inputs[0])
    nt.link(mp.outputs[0], wv.inputs["Vector"])
    c = nt.mix(wv.outputs["Fac"], (0.03, 0.035, 0.04, 1), (0.08, 0.085, 0.09, 1))
    nt.link(c, bs.inputs["Base Color"])
    bump = nt.node("ShaderNodeBump", in_Strength=0.6)
    nt.link(wv.outputs["Fac"], bump.inputs["Height"])
    nt.link(bump.outputs[0], bs.inputs["Normal"])
    nt.link(bs.outputs[0], nt.out.inputs[0])
    md = bpy.data.materials.new("ctx_wing_dark")
    mg = bpy.data.materials.new("ctx_wing_glass")
    glass_mat(mg, False)
    mj = bpy.data.materials.new("ctx_wing_joinery")
    simple(mj, (0.12, 0.1, 0.08), 0.5)
    emissive_random(md, (0.05, 0.04, 0.035), 0.9, 0.4, 1.5)
    objs = []
    for sx in (-1, 1):
        x0, x1 = sorted((sx * 14.55, sx * 44.0))
        bpy.ops.mesh.primitive_cube_add(size=1)
        o = bpy.context.object
        o.name = "ctx_wing_body"
        o.scale = (x1 - x0, 18.0, 9.5)
        o.location = ((x0 + x1) / 2, 0, 4.75)
        bpy.ops.object.transform_apply(scale=True)
        o.data.materials.append(mw)
        # window cutters: two storeys on the N and S faces
        cutters = []
        for fs in (-1, 1):
            for row, (zb, zt) in enumerate(((1.2, 3.4), (5.2, 7.6))):
                x = x0 + 2.0
                while x < x1 - 1.5:
                    bpy.ops.mesh.primitive_cube_add(size=1)
                    c = bpy.context.object
                    c.scale = (1.1, 0.6, zt - zb)
                    c.location = (x + 0.55, fs * 9.0, (zb + zt) / 2)
                    bpy.ops.object.transform_apply(scale=True)
                    cutters.append(c)
                    # dark room card + a frame
                    bpy.ops.mesh.primitive_plane_add(size=1)
                    card = bpy.context.object
                    card.scale = (1.3, zt - zb + 0.2, 1)
                    card.rotation_euler = (math.pi / 2, 0, 0)
                    card.location = (x + 0.55, fs * 8.6, (zb + zt) / 2)
                    card.data.materials.append(md)
                    objs.append(card)
                    bpy.ops.mesh.primitive_plane_add(size=1)
                    gl = bpy.context.object
                    gl.scale = (1.1, zt - zb, 1)
                    gl.rotation_euler = (math.pi / 2, 0, 0)
                    gl.location = (x + 0.55, fs * 8.84, (zb + zt) / 2)
                    gl.data.materials.append(mg)
                    objs.append(gl)
                    for (sxx, szz, lx, lz) in ((1.1, 0.05, 0, 0), (0.04, zt - zb, 0, 0)):
                        bpy.ops.mesh.primitive_cube_add(size=1)
                        fb = bpy.context.object
                        fb.scale = (sxx, 0.05, szz)
                        fb.location = (x + 0.55, fs * 8.86, (zb + zt) / 2)
                        fb.data.materials.append(mj)
                        objs.append(fb)
                    x += 2.4
        if cutters:
            bpy.ops.object.select_all(action="DESELECT")
            for c in cutters:
                c.select_set(True)
            bpy.context.view_layer.objects.active = cutters[0]
            bpy.ops.object.join()
            cut = bpy.context.object
            mod = o.modifiers.new("win", "BOOLEAN")
            mod.operation = "DIFFERENCE"
            mod.object = cut
            mod.solver = "EXACT"
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier="win")
            bpy.data.objects.remove(cut, do_unlink=True)
        bev = o.modifiers.new("bev", "BEVEL")
        bev.width = 0.02
        # hip roof
        bm = bmesh.new()
        xa, xb = x0 - 0.5, x1 + 0.5
        ya, yb = -9.6, 9.6
        v = [bm.verts.new(p) for p in ((xa, ya, 9.5), (xb, ya, 9.5), (xb, yb, 9.5), (xa, yb, 9.5),
                                         (xa + 8, 0, 12.8), (xb - 8, 0, 12.8))]
        bm.faces.new((v[0], v[1], v[5], v[4]))
        bm.faces.new((v[2], v[3], v[4], v[5]))
        bm.faces.new((v[1], v[2], v[5]))
        bm.faces.new((v[3], v[0], v[4]))
        me = bpy.data.meshes.new("ctx_wing_roof")
        bm.to_mesh(me)
        bm.free()
        r = bpy.data.objects.new("ctx_wing_roof", me)
        bpy.context.scene.collection.objects.link(r)
        me.materials.append(mr)
        objs += [o, r]
    return objs


def far_context():
    """Render-only distant town masses so the arch does not frame a void (not part of the deliverable)."""
    rnd = random.Random(7)
    mats = []
    for i, col in enumerate(((0.3, 0.25, 0.2), (0.24, 0.2, 0.17), (0.34, 0.3, 0.25), (0.2, 0.17, 0.15))):
        m = bpy.data.materials.new(f"ctx_far_{i}")
        textured_principled(m, "Plaster007", 2.0, col, 0.9, 0.05, 0.3, 0.4, 0.8, cc0=CC0)
        mats.append(m)
    mroof = bpy.data.materials.new("ctx_far_roof")
    simple(mroof, (0.05, 0.055, 0.06), 0.6)
    objs = []
    for k in range(140):
        while True:
            x = rnd.uniform(-160, 160)
            y = rnd.uniform(-220, 220)
            if abs(x) < 50 and abs(y) < 28:
                continue
            if abs(x) < 47 and abs(y) < 45:
                continue
            if abs(x) < 45 and 30 < y < 95:
                continue
            if abs(x) < 24 and y < -28:
                continue
            break
        w, d, h = rnd.uniform(6, 16), rnd.uniform(6, 14), rnd.uniform(4.5, 11)
        if abs(x) < 16 and y < -40:
            h *= 0.8
        bm = bmesh.new()
        ridge = h + rnd.uniform(1.5, 3.2)
        pts = [(-w / 2, -d / 2, 0), (w / 2, -d / 2, 0), (w / 2, d / 2, 0), (-w / 2, d / 2, 0),
               (-w / 2, -d / 2, h), (w / 2, -d / 2, h), (w / 2, d / 2, h), (-w / 2, d / 2, h),
               (-w / 2, 0, ridge), (w / 2, 0, ridge)]
        v = [bm.verts.new(p) for p in pts]
        walls = [(0, 1, 5, 4), (2, 3, 7, 6), (1, 2, 6, 9, 5), (3, 0, 4, 8, 7)]
        roofs = [(4, 5, 9, 8), (6, 7, 8, 9)]
        for f in walls:
            bm.faces.new([v[i] for i in f]).material_index = 0
        for f in roofs:
            bm.faces.new([v[i] for i in f]).material_index = 1
        me = bpy.data.meshes.new("ctx_far")
        bm.to_mesh(me)
        bm.free()
        me.materials.append(mats[k % len(mats)])
        me.materials.append(mroof)
        o = bpy.data.objects.new("ctx_far", me)
        o.location = (x, y, 0)
        o.rotation_euler = (0, 0, rnd.choice((0, math.pi / 2)) + rnd.uniform(-0.05, 0.05))
        bpy.context.scene.collection.objects.link(o)
        objs.append(o)
    return objs


def ground():
    bpy.ops.mesh.primitive_plane_add(size=600, location=(0, 0, -0.005))
    g = bpy.context.object
    g.name = "ctx_ground"
    m = bpy.data.materials.new("ctx_earth")
    earth(m)
    g.data.materials.append(m)
    # cut the ground under the passage (the exported paving covers it)
    return g


def world_sky(night):
    w = bpy.context.scene.world
    w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "NISHITA"
    sky.sun_elevation = math.radians(-7.0 if night else 3.5)
    sky.sun_rotation = math.radians(292.5 - 90)   # Blender rotation 0 = +X; WNW azimuth
    sky.altitude = 30
    sky.air_density = 1.4
    sky.dust_density = 4.0 if not night else 2.0
    sky.ozone_density = 1.0
    sky.sun_intensity = 0.6
    nt.links.new(sky.outputs[0], bg.inputs[0])
    bg.inputs[1].default_value = 0.55 if not night else 1.0
    if night:
        # deep-blue night: Nishita below the horizon is almost black; add a faint blue fill
        add = nt.nodes.new("ShaderNodeBackground")
        add.inputs[0].default_value = (0.02, 0.032, 0.07, 1)
        add.inputs[1].default_value = 1.0
        mx = nt.nodes.new("ShaderNodeAddShader")
        nt.links.new(bg.outputs[0], mx.inputs[0])
        nt.links.new(add.outputs[0], mx.inputs[1])
        nt.links.new(mx.outputs[0], out.inputs[0])
    else:
        nt.links.new(bg.outputs[0], out.inputs[0])
    w.mist_settings.start = 25
    w.mist_settings.depth = 500
    w.mist_settings.falloff = "QUADRATIC"


def sun(night):
    bpy.ops.object.light_add(type="SUN")
    s = bpy.context.object
    s.name = "ctx_sun"
    el = math.radians(3.5 if not night else 25)
    az = math.radians(292.5 if not night else 140)
    d = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
    s.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    s.data.energy = 4.2 if not night else 0.05
    s.data.color = (1.0, 0.58, 0.32) if not night else (0.6, 0.7, 1.0)
    s.data.angle = math.radians(0.6)
    return s


def point_lights(lamps, night):
    objs = []
    for i, p in enumerate(lamps):
        bpy.ops.object.light_add(type="POINT", location=p)
        l = bpy.context.object
        l.data.energy = 180 if night else 60
        l.data.color = (1.0, 0.62, 0.32)
        l.data.shadow_soft_size = 0.12
        objs.append(l)
    return objs


def compositor(night, haze=(0.62, 0.5, 0.42)):
    sc = bpy.context.scene
    sc.use_nodes = True
    sc.view_layers[0].use_pass_mist = True
    nt = sc.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    rl = nt.nodes.new("CompositorNodeRLayers")
    comp = nt.nodes.new("CompositorNodeComposite")
    mix = nt.nodes.new("CompositorNodeMixRGB")
    mix.blend_type = "MIX"
    mul = nt.nodes.new("CompositorNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = 0.3 if not night else 0.25
    nt.links.new(rl.outputs["Mist"], mul.inputs[0])
    nt.links.new(mul.outputs[0], mix.inputs[0])
    nt.links.new(rl.outputs["Image"], mix.inputs[1])
    mix.inputs[2].default_value = (*haze, 1) if not night else (0.02, 0.03, 0.06, 1)
    last = mix.outputs[0]
    gl = nt.nodes.new("CompositorNodeGlare")
    try:
        gl.glare_type = "BLOOM"
    except Exception:
        gl.glare_type = "FOG_GLOW"
    gl.threshold = 1.2 if not night else 0.6
    try:
        gl.size = 7 if not night else 8
    except Exception:
        pass
    gl.mix = -0.6 if not night else 0.0
    nt.links.new(last, gl.inputs[0])
    last = gl.outputs[0]
    # fine grain (dreamcore/film base grade, 1.5 %)
    nt.links.new(last, comp.inputs[0])


def camera(name, loc, target, lens):
    bpy.ops.object.camera_add(location=loc)
    c = bpy.context.object
    c.name = name
    c.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    c.data.lens = lens
    c.data.clip_start = 0.02
    c.data.clip_end = 1500
    return c


CC0 = None

SHOTS = {
    "street-arch": dict(loc=(-2.2, 31.0, 1.5), target=(0.4, 0.0, 16.0), lens=18, night=False),
    "facade-closeup": dict(loc=(13.4, 16.2, 1.5), target=(11.2, 13.0, 2.5), lens=18, night=False),
    "turret-dome": dict(loc=(6.6, -1.5, 16.9), target=(12.3, 10.8, 20.4), lens=32, night=False),
    "roof-garden": dict(loc=(1.5, -1.0, 16.85), target=(-9.5, -10.0, 16.9), lens=22, night=False),
    "night-outline": dict(loc=(-16.0, 62.0, 2.5), target=(0.0, 0.0, 17.0), lens=26, night=True),
    "prop-closeup": dict(loc=(-9.36, -11.78, 16.7), target=(-10.05, -11.92, 16.58), lens=32, night=False),
    "lod": dict(loc=(0.0, 150.0, 12.0), target=(0.0, 0.0, 12.0), lens=50, night=False),
    # v1.2 review shots: bevelled sash / muntins / frame of the SW turret L1 side window in the grazing dusk light; the open NE
    # stair head (landing, opening, guard rail); the NW head floor from the stair below (trimmer, header, slab edge).  The
    # placeholder room boxes / dark cards are hidden in these shots so the shell itself is visible.
    "window-bevel": dict(loc=(-15.95, -10.15, 7.05), target=(-14.30, -10.80, 6.62), lens=35, night=False, hide=("backing", "curtain")),
    "stairhead-open": dict(loc=(11.55, 6.35, 16.80), target=(12.35, 10.70, 15.25), lens=22, night=False, hide=("backing",), fill=((12.3, 9.6, 17.6), 60.0)),
    "turret-soffit": dict(loc=(-13.55, 10.65, 14.10), target=(-11.60, 9.80, 14.80), lens=16, night=False, hide=("backing", "curtain"),
                          fill=((-12.6, 10.8, 13.6), 45.0)),
}


def run(renders, here, v4glb, cc0, samples, lamps, windows, iron_colour):
    global CC0
    CC0 = cc0
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
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    sc.render.image_settings.file_format = "PNG"
    sc.view_settings.view_transform = "AgX"
    try:
        sc.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    tower = import_tower(v4glb, iron_colour)
    ctx = wing_stubs() + [ground()] + far_context()
    lod_roots = {o["lod"]: o for o in bpy.data.objects if o.name.startswith("TB_EXT_LOD") and o.type == "EMPTY"}
    for name in names:
        shot = SHOTS[name]
        night = shot["night"]
        setup_materials(cc0, night)
        world_sky(night)
        for o in [o for o in bpy.data.objects if o.name.startswith(("ctx_sun", "Point", "shotcam"))]:
            bpy.data.objects.remove(o, do_unlink=True)
        sun(night)
        point_lights(lamps, night)
        compositor(night)
        sc.view_settings.exposure = {True: 0.6, False: 0.25}[night]
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
            # three LODs side by side (0, 1, 2 from left), noon-grey light, orthographic front
            for lod, root in lod_roots.items():
                for ch in root.children:
                    ch.hide_render = False
                root.location = ((1 - lod) * 40.0, 0, 0)
            for o in ctx + tower:
                o.hide_render = True
            cam = camera("shotcam", shot["loc"], shot["target"], shot["lens"])
            cam.data.type = "ORTHO"
            cam.data.ortho_scale = 118
        else:
            for lod, root in lod_roots.items():
                root.location = (0, 0, 0)
                for ch in root.children:
                    ch.hide_render = lod != 0 or any(h in ch.name for h in shot.get("hide", ()))
            for o in ctx + tower:
                o.hide_render = False
            cam = camera("shotcam", shot["loc"], shot["target"], shot["lens"])
            for o in [o for o in bpy.data.objects if o.name.startswith("ctx_fill")]:
                bpy.data.objects.remove(o, do_unlink=True)
            if shot.get("fill"):
                ld = bpy.data.lights.new("ctx_fill", "POINT")
                ld.energy, ld.shadow_soft_size, ld.color = shot["fill"][1], 0.3, (1.0, 0.86, 0.68)
                lo = bpy.data.objects.new("ctx_fill", ld)
                lo.location = shot["fill"][0]
                bpy.context.scene.collection.objects.link(lo)
        sc.camera = cam
        sc.render.filepath = str(here / f"{name}.png")
        bpy.ops.render.render(write_still=True)
        print("rendered", name)
