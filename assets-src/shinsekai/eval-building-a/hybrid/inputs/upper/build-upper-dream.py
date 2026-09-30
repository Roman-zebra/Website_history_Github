"""Building A upper-room set dressing + dream-layer staging (Claude handoff 108, add-on module).

Run (Blender 4.5):  blender -b -P build-upper-dream.py -- [options]
  --export            write upper-dream-addon.glb (add-on nodes only, no hybrid geometry)
  --render            load the frozen hybrid (read-only) and render review images into renders/
  --views a,b,c       subset of review views (default: all)   --variants base0,base,dream
  --quick             640x360 draft renders                     --tag name   (filename prefix for drafts)
Nothing inside eval-building-a/hybrid/ is written.  Everything is original procedural geometry;
all coordinates, colours, props and text are A: assumptions (period-plausible, not surveyed).
Coordinates = hybrid Blender coordinates: X along the street 0..6, Y into the plot (street face y=0),
Z up; upper floor Z_F2=3.455, board ceiling 5.90, nageshi 5.57..5.67, front-room interior x .18..5.82,
y .25..4.75 (fusuma partition y=4.75).  glTF export converts to Y-up (same as the hybrid).
"""
import bpy, bmesh, math, random, json, sys, time, os
from pathlib import Path
from mathutils import Vector, Matrix, Euler
import numpy as np

T0 = time.time()
HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
CACHE = REPO.parent / 'research-cache'
HYB = REPO / 'assets-src' / 'shinsekai' / 'eval-building-a' / 'hybrid'
ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default=None):
    return ARGV[ARGV.index(name) + 1] if name in ARGV else default


def flag(name):
    return name in ARGV


ZF, ZC = 3.455, 5.90                   # upper floor, ceiling-board underside
X0, X1, Y0, Y1 = 0.18, 5.82, 0.25, 4.75  # front-room clear interior
TRI_LIMIT = 80000

# =====================================================================================
# 1. procedural textures (numpy, seamless by construction: filtered periodic noise)
# =====================================================================================

def fnoise(n, sx, sy, seed, m=None):
    """Seamless anisotropic noise, unit std.  sx/sy = low-pass cut-off in cycles per tile along u(x)/v(y)."""
    rng = np.random.default_rng(seed)
    w = rng.standard_normal((n, m or n))
    F = np.fft.rfft2(w)
    fy = np.fft.fftfreq(n)[:, None] * n
    fx = np.fft.rfftfreq(m or n)[None, :] * (m or n)
    a = np.fft.irfft2(F * np.exp(-((fx / sx) ** 2 + (fy / sy) ** 2)), s=(n, m or n))
    return (a - a.mean()) / (a.std() + 1e-9)


def smooth01(a, lo=-1.5, hi=1.5):
    return np.clip((a - lo) / (hi - lo), 0, 1)


def gradient_normal(h, strength):
    """tangent-space normal map (GL, +Y up) from a height field (periodic)."""
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    n = np.stack([-dx * strength, -dy * strength, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5


def make_image(name, rgb, noncolor=False, alpha=None):
    """generated 8-bit image.  Colour images are given as sRGB-encoded values (converted so the stored bytes equal them);
    data images (normal/roughness) get Non-Color BEFORE the pixels are written so nothing is re-encoded."""
    h, w = rgb.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=alpha is not None)
    buf = np.ones((h, w, 4), np.float32)
    buf[..., :3] = rgb if rgb.ndim == 3 else rgb[..., None]
    if alpha is not None:
        buf[..., 3] = alpha
    buf = np.clip(buf, 0, 1)
    if noncolor:
        img.colorspace_settings.name = 'Non-Color'
    else:
        c = buf[..., :3]
        buf[..., :3] = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    img.pixels.foreach_set(buf.ravel())
    if alpha is not None:
        img.alpha_mode = 'STRAIGHT'
    img.pack()
    return img


_TEX = {}


def tex(key):
    """Lazy generated texture sets -> dict(color, rough, normal) images."""
    if key in _TEX:
        return _TEX[key]
    n = 512
    out = {}
    if key == 'grain':               # neutral timber grain, 0.9 m tile, grain runs along u
        a = fnoise(n, 4, 150, 11)
        b = fnoise(n, 2, 40, 12)
        rings = 0.5 + 0.5 * np.sin(2 * np.pi * (np.linspace(0, 1, n)[:, None] * 9 + 0.9 * b))
        h = 0.55 * a + 0.9 * rings + 0.35 * fnoise(n, 10, 300, 13)
        lum = 0.88 + 0.05 * h
        tint = np.stack([lum * 1.03, lum, lum * 0.94], -1)
        out['color'] = make_image('UD_grain_c', tint)
        out['rough'] = make_image('UD_grain_r', np.clip(0.52 + 0.13 * h, 0, 1), True)
        out['normal'] = make_image('UD_grain_n', gradient_normal(h * 0.0016 * n / 8, 1.0), True)
    elif key == 'weave':             # neutral woven cloth, 0.12 m tile (plain weave + slub)
        t = np.arange(n)
        u, v = np.meshgrid(t, t)
        period = 16
        wf = np.sin(2 * np.pi * u / period) * 0.5 + 0.5
        wv = np.sin(2 * np.pi * v / period) * 0.5 + 0.5
        chk = (((u // (period // 2)) + (v // (period // 2))) % 2)
        h = np.where(chk == 0, wf, wv)
        slub = fnoise(n, 120, 6, 21) * 0.25 + fnoise(n, 6, 120, 22) * 0.25 + fnoise(n, 40, 40, 23) * 0.3
        lum = 0.86 + 0.07 * (h - 0.5) + 0.05 * slub
        out['color'] = make_image('UD_weave_c', np.stack([lum] * 3, -1))
        out['normal'] = make_image('UD_weave_n', gradient_normal(h * 1.6 + slub * 0.25, 2.0), True)
    elif key == 'speckle':           # neutral micro variation for metal / glaze / lacquer (fingerprints, wear), 0.3 m tile
        f1 = fnoise(n, 60, 60, 51)
        f2 = fnoise(n, 10, 10, 52)
        f3 = fnoise(n, 200, 200, 53)
        lum = 0.88 + 0.04 * f1 + 0.03 * f2
        out['color'] = make_image('UD_speckle_c', np.stack([lum] * 3, -1))
        out['rough'] = make_image('UD_speckle_r', np.clip(0.55 + 0.085 * f1 + 0.07 * f2 + 0.03 * f3, 0, 1), True)
        out['normal'] = make_image('UD_speckle_n', gradient_normal(0.5 * f1 + 0.3 * f3, 0.35), True)
    elif key == 'washi':             # paper fibre, 0.5 m tile
        f1 = fnoise(n, 180, 14, 31)
        f2 = fnoise(n, 14, 180, 32)
        f3 = fnoise(n, 90, 90, 33)
        blot = fnoise(n, 4, 4, 34)
        lum = 0.90 + 0.028 * (f1 + f2) + 0.02 * f3 + 0.03 * blot
        out['color'] = make_image('UD_washi_c', np.stack([lum, lum * 0.985, lum * 0.94], -1))
        out['normal'] = make_image('UD_washi_n', gradient_normal(0.4 * (f1 + f2) + 0.3 * f3, 0.9), True)
    elif key == 'plank':             # ceiling boards (baked colour), 0.9 m tile; boards run along u, 5 boards
        boards = 5
        v = np.linspace(0, 1, n, endpoint=False)[:, None]
        idx = np.floor(v * boards).astype(int)
        rng = np.random.default_rng(41)
        tone = 0.94 + 0.05 * (rng.random(boards) - 0.5) * 2
        toneI = tone[idx[:, 0]][:, None] * np.ones((1, n))
        a = fnoise(n, 3, 140, 42)
        rings = 0.5 + 0.5 * np.sin(2 * np.pi * (v * 22 + 0.7 * fnoise(n, 3, 10, 43)))
        seam = np.abs((v * boards) % 1.0 - 0.5) > 0.488     # dark joint
        seam = np.maximum(seam, (np.abs((v * boards) % 1.0) < 0.012))
        lum = toneI * (0.90 + 0.035 * a + 0.025 * rings)
        lum = np.where(seam, lum * 0.6, lum)
        # sooty ends / dirt
        dirt = smooth01(fnoise(n, 5, 5, 44), -1.0, 2.5)
        lum = lum * (1 - 0.07 * dirt)
        col = np.stack([lum * 0.93, lum * 0.80, lum * 0.64], -1)    # cedar, aged
        out['color'] = make_image('UD_plank_c', col)
        hh = 0.5 * a + 0.4 * rings - 2.0 * seam
        out['normal'] = make_image('UD_plank_n', gradient_normal(hh * 0.9, 1.4), True)
        out['rough'] = make_image('UD_plank_r', np.clip(0.62 + 0.1 * a - 0.12 * dirt, 0, 1), True)
    _TEX[key] = out
    return out


# =====================================================================================
# 2. materials  (Principled; vertex colour 'Color' tints neutral textures; all export to glTF)
# =====================================================================================
MATS = {}
SPEC = {}     # name -> dict (kept for the dream-variant / README)


def lin(c):
    return tuple(((x / 255.0) / 12.92 if (x / 255.0) <= 0.04045 else (((x / 255.0) + 0.055) / 1.055) ** 2.4) for x in c)


def mat(name, base=(128, 128, 128), rough=0.6, metal=0.0, tx=None, tile=0.9, vcol=True, normal=0.35,
        emit=None, emit_strength=0.0, alpha_img=None, trans=0.0, ior=1.45, double=False, blend=False,
        spec=0.5, coat=0.0, sheen=0.0, alpha=None):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new('UD_' + name)
    m.use_nodes = True
    nt = m.node_tree
    bs = nt.nodes['Principled BSDF']
    SPEC[name] = dict(base=base, rough=rough, metal=metal, tx=tx, tile=tile, emit=emit, trans=trans, double=double)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    try:
        bs.inputs['Specular IOR Level'].default_value = spec
    except Exception:
        pass
    bs.inputs['Base Color'].default_value = (*lin(base), 1)
    uv = nt.nodes.new('ShaderNodeUVMap')
    uv.uv_map = 'UVMap'
    colsrc = None
    if tx:
        t = tex(tx)
        ti = nt.nodes.new('ShaderNodeTexImage')
        ti.image = t['color']
        ti.extension = 'REPEAT'
        nt.links.new(uv.outputs['UV'], ti.inputs['Vector'])
        colsrc = ti.outputs['Color']
    if vcol:
        ca = nt.nodes.new('ShaderNodeVertexColor')
        ca.layer_name = 'Color'
        if colsrc is not None:
            mx = nt.nodes.new('ShaderNodeMix')
            mx.data_type = 'RGBA'
            mx.blend_type = 'MULTIPLY'
            mx.inputs[0].default_value = 1.0
            nt.links.new(colsrc, mx.inputs[6])
            nt.links.new(ca.outputs['Color'], mx.inputs[7])
            nt.links.new(mx.outputs[2], bs.inputs['Base Color'])
        else:
            nt.links.new(ca.outputs['Color'], bs.inputs['Base Color'])
    elif colsrc is not None:
        nt.links.new(colsrc, bs.inputs['Base Color'])
    if tx and 'rough' in tex(tx):
        ri = nt.nodes.new('ShaderNodeTexImage')
        ri.image = tex(tx)['rough']
        nt.links.new(uv.outputs['UV'], ri.inputs['Vector'])
        sp = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(ri.outputs['Color'], sp.inputs['Color'])
        sc = nt.nodes.new('ShaderNodeMath')
        sc.operation = 'MULTIPLY'
        sc.inputs[1].default_value = rough / 0.55
        nt.links.new(sp.outputs['Green'], sc.inputs[0])
        nt.links.new(sc.outputs[0], bs.inputs['Roughness'])
    if tx and 'normal' in tex(tx):
        ni = nt.nodes.new('ShaderNodeTexImage')
        ni.image = tex(tx)['normal']
        nt.links.new(uv.outputs['UV'], ni.inputs['Vector'])
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = normal
        nt.links.new(ni.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    if emit is not None:
        bs.inputs['Emission Color'].default_value = (*lin(emit), 1)
        bs.inputs['Emission Strength'].default_value = emit_strength
    if trans:
        bs.inputs['Transmission Weight'].default_value = trans
        bs.inputs['IOR'].default_value = ior
    if coat:
        bs.inputs['Coat Weight'].default_value = coat
        bs.inputs['Coat Roughness'].default_value = 0.08
    if sheen:
        bs.inputs['Sheen Weight'].default_value = sheen
        bs.inputs['Sheen Roughness'].default_value = 0.5
    if alpha_img is not None:
        ai = nt.nodes.new('ShaderNodeTexImage')
        ai.image = alpha_img
        ai.extension = 'EXTEND'
        nt.links.new(uv.outputs['UV'], ai.inputs['Vector'])
        nt.links.new(ai.outputs['Color'], bs.inputs['Base Color'])
        nt.links.new(ai.outputs['Alpha'], bs.inputs['Alpha'])
        blend = True
    if alpha is not None:
        bs.inputs['Alpha'].default_value = alpha
        blend = True
    if blend:
        for attr, val in (('surface_render_method', 'BLENDED'), ('blend_method', 'BLEND')):
            try:
                setattr(m, attr, val)
            except Exception:
                pass
    m.use_backface_culling = not (double or blend)
    MATS[name] = m
    return m


# =====================================================================================
# 3. geometry kit: a Node = one named glTF node; parts are appended with per-part material/colour
# =====================================================================================
ROOT = {}
NODES = []


def group(name, parent=None, **extras):
    o = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(o)
    if parent is not None:
        o.parent = parent
    for k, v in extras.items():
        o[k] = v
    return o


def get_root():
    if 'root' not in ROOT:
        ROOT['root'] = group('UpperDream_Addon', None, handoff=108, role='add-on: parent under Hybrid_InteriorCell',
                             assumptions='A: all dressing is period-plausible invention; no surveyed plan/props')
    return ROOT['root']


def get_group(name, **extras):
    key = 'g_' + name
    if key not in ROOT:
        ROOT[key] = group(name, get_root(), **extras)
    return ROOT[key]


class Node:
    def __init__(self, name, grp='UD_Base_Upper', smooth=38.0, tags='A:period-plausible invention', **extras):
        self.name = name
        self.bm = bmesh.new()
        self.slots = []
        self.M = [Matrix.Identity(4)]
        self.uvl = self.bm.loops.layers.uv.new('UVMap')
        self.col = self.bm.loops.layers.float_color.new('Color')
        self.grp = grp
        self.smooth = smooth
        self.extras = dict(extras)
        self.extras['sourceTags'] = tags
        self.rng = random.Random(sum(ord(c) * (i + 1) for i, c in enumerate(name)))
        self.obj = None
        NODES.append(self)

    # ---- transform stack
    def push(self, pos=(0, 0, 0), rot=(0, 0, 0), order='XYZ'):
        M = Matrix.Translation(pos) @ Euler(rot, order).to_matrix().to_4x4()
        self.M.append(self.M[-1] @ M)
        return self

    def pushm(self, M):
        self.M.append(self.M[-1] @ M)
        return self

    def pop(self):
        self.M.pop()

    def at(self, pos=(0, 0, 0), rot=(0, 0, 0), order='XYZ'):
        node = self

        class Ctx:
            def __enter__(s):
                node.push(pos, rot, order)
                return node

            def __exit__(s, *a):
                node.pop()
        return Ctx()

    def mi(self, m):
        if m not in self.slots:
            self.slots.append(m)
        return self.slots.index(m)

    # ---- low-level emit of a temp bmesh
    def _emit(self, t, mat, col=None, tile=0.9, uvmode='box', jitter=0.03):
        M = self.M[-1]
        bm = self.bm
        mi = self.mi(mat)
        if col is None:
            col = SPEC.get(mat, {}).get('base', (128, 128, 128))
        if isinstance(mat, str) and mat in ('wood', 'wood_raw', 'bamboo'):
            gy = 0.3 * col[0] + 0.59 * col[1] + 0.11 * col[2]
            col = tuple(c * 0.68 + gy * 0.32 for c in col)
        lc = lin(col)
        jr = 1.0 + (self.rng.random() * 2 - 1) * jitter
        lc = (lc[0] * jr, lc[1] * jr, lc[2] * jr, 1.0)
        vmap = {v: bm.verts.new(M @ v.co) for v in t.verts}
        tuv = t.loops.layers.uv.get('UVMap') if uvmode == 'given' else None
        off = (self.rng.random(), self.rng.random())
        for f in t.faces:
            try:
                nf = bm.faces.new([vmap[v] for v in f.verts])
            except ValueError:
                continue
            nf.material_index = mi
            nf.smooth = True
            n = f.normal
            if uvmode == 'given':
                for loop, tl in zip(nf.loops, f.loops):
                    loop[self.uvl].uv = (tl[tuv].uv[0] / tile, tl[tuv].uv[1] / tile)
            else:
                ax = max(range(3), key=lambda i: abs(n[i]))
                ta = [i for i in range(3) if i != ax]
                if uvmode == 'grain':      # u along the longer tangential extent of the primitive
                    ext = [max(v.co[i] for v in t.verts) - min(v.co[i] for v in t.verts) for i in ta]
                    if ext[1] > ext[0]:
                        ta = [ta[1], ta[0]]
                for loop, v in zip(nf.loops, f.verts):
                    loop[self.uvl].uv = (v.co[ta[0]] / tile + off[0], v.co[ta[1]] / tile + off[1])
            for loop in nf.loops:
                loop[self.col] = lc
        t.free()

    @staticmethod
    def _bevel(t, r, seg=1, angle=35.0):
        if r <= 0:
            return
        edges = [e for e in t.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(angle)]
        if edges:
            bmesh.ops.bevel(t, geom=edges, offset=r, offset_type='OFFSET', segments=seg, profile=0.5, affect='EDGES')

    # ---- primitives (all arguments in the current local frame, metres)
    def box(self, a, b, mat, col=None, r=0.002, seg=1, tile=0.9, grain=True, jitter=0.03):
        a = Vector(a)
        b = Vector(b)
        lo = Vector([min(a[i], b[i]) for i in range(3)])
        hi = Vector([max(a[i], b[i]) for i in range(3)])
        t = bmesh.new()
        bmesh.ops.create_cube(t, size=1.0)
        s = hi - lo
        c = (hi + lo) / 2
        for v in t.verts:
            v.co = Vector((v.co.x * s.x + c.x, v.co.y * s.y + c.y, v.co.z * s.z + c.z))
        t.normal_update()
        self._bevel(t, min(r, 0.45 * min(s.x, s.y, s.z)), seg)
        t.normal_update()
        self._emit(t, mat, col, tile, 'grain' if grain else 'box', jitter)
        return self

    def prism(self, pts2, z0, z1, mat, col=None, r=0.0, tile=0.9, plane='xy'):
        """extrude a closed 2D polygon along the plane normal (xy->z, xz->y, yz->x)"""
        t = bmesh.new()
        vs0 = []
        vs1 = []
        for (p, q) in pts2:
            if plane == 'xy':
                vs0.append(t.verts.new((p, q, z0)))
                vs1.append(t.verts.new((p, q, z1)))
            elif plane == 'xz':
                vs0.append(t.verts.new((p, z0, q)))
                vs1.append(t.verts.new((p, z1, q)))
            else:
                vs0.append(t.verts.new((z0, p, q)))
                vs1.append(t.verts.new((z1, p, q)))
        n = len(pts2)
        t.faces.new(vs1)
        t.faces.new(list(reversed(vs0)))
        for i in range(n):
            t.faces.new((vs0[i], vs0[(i + 1) % n], vs1[(i + 1) % n], vs1[i]))
        bmesh.ops.recalc_face_normals(t, faces=t.faces[:])
        self._bevel(t, r)
        t.normal_update()
        self._emit(t, mat, col, tile, 'box')
        return self

    def cyl(self, p0, p1, r0, r1=None, seg=12, mat='iron', col=None, caps=(True, True), r=0.0, tile=0.9,
            jitter=0.03):
        p0 = Vector(p0)
        p1 = Vector(p1)
        d = p1 - p0
        L = d.length
        if L < 1e-7:
            return self
        r1 = r0 if r1 is None else r1
        t = bmesh.new()
        ub = t.loops.layers.uv.new('UVMap')
        rings = []
        for (z, rr) in ((0.0, r0), (L, r1)):
            rings.append([t.verts.new((rr * math.cos(i * math.tau / seg), rr * math.sin(i * math.tau / seg), z)) for i in range(seg)])
        rm = (r0 + r1) / 2
        for i in range(seg):
            j = (i + 1) % seg
            f = t.faces.new((rings[0][i], rings[0][j], rings[1][j], rings[1][i]))
            for loop, (uu, vv) in zip(f.loops, ((i, 0), (i + 1, 0), (i + 1, L), (i, L))):
                loop[ub].uv = (uu / seg * math.tau * rm, vv)
        if caps[0] and r0 > 0:
            f = t.faces.new(list(reversed(rings[0])))
            for loop in f.loops:
                loop[ub].uv = (loop.vert.co.x, loop.vert.co.y)
        if caps[1] and r1 > 0:
            f = t.faces.new(rings[1])
            for loop in f.loops:
                loop[ub].uv = (loop.vert.co.x, loop.vert.co.y)
        q = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        bmesh.ops.transform(t, matrix=Matrix.Translation(p0) @ q, verts=t.verts)
        t.normal_update()
        mode = 'given'
        if r > 0:
            self._bevel(t, r, 1, 50)
            t.normal_update()
            mode = 'box'
        self._emit(t, mat, col, tile, mode, jitter)
        return self

    def lathe(self, prof, seg, mat, col=None, tile=0.9, phase=0.0, jitter=0.03, at=None, rot=None):
        if at is None and rot is None:
            return self._lathe(prof, seg, mat, col, tile, phase, jitter)
        self.push(at or (0, 0, 0), rot or (0, 0, 0))
        self._lathe(prof, seg, mat, col, tile, phase, jitter)
        self.pop()
        return self

    def _lathe(self, prof, seg, mat, col=None, tile=0.9, phase=0.0, jitter=0.03):
        """prof = [(radius, z), ...] ordered so that the outward face is on the 'outside' (bottom->top for an outer wall)."""
        t = bmesh.new()
        ub = t.loops.layers.uv.new('UVMap')
        rings = []
        for (rr, z) in prof:
            if rr <= 1e-6:
                rings.append([t.verts.new((0, 0, z))])
            else:
                rings.append([t.verts.new((rr * math.cos(phase + i * math.tau / seg), rr * math.sin(phase + i * math.tau / seg), z)) for i in range(seg)])
        sacc = [0.0]
        for k in range(1, len(prof)):
            sacc.append(sacc[-1] + math.hypot(prof[k][0] - prof[k - 1][0], prof[k][1] - prof[k - 1][1]))
        for k in range(len(prof) - 1):
            A, B = rings[k], rings[k + 1]
            if len(A) == 1 and len(B) == 1:
                continue
            for i in range(seg):
                j = (i + 1) % seg
                uu0, uu1 = i / seg * math.tau * max(prof[k][0], .01), (i + 1) / seg * math.tau * max(prof[k][0], .01)
                vv0, vv1 = i / seg * math.tau * max(prof[k + 1][0], .01), (i + 1) / seg * math.tau * max(prof[k + 1][0], .01)
                if len(A) == 1:
                    f = t.faces.new((A[0], B[j], B[i]))
                    uvs = ((0, sacc[k]), (vv1, sacc[k + 1]), (vv0, sacc[k + 1]))
                elif len(B) == 1:
                    f = t.faces.new((A[i], A[j], B[0]))
                    uvs = ((uu0, sacc[k]), (uu1, sacc[k]), (0, sacc[k + 1]))
                else:
                    f = t.faces.new((A[i], A[j], B[j], B[i]))
                    uvs = ((uu0, sacc[k]), (uu1, sacc[k]), (vv1, sacc[k + 1]), (vv0, sacc[k + 1]))
                for loop, uv in zip(f.loops, uvs):
                    loop[ub].uv = uv
        t.normal_update()
        self._emit(t, mat, col, tile, 'given', jitter)
        return self

    def tube(self, pts, rad, seg=6, mat='cord', col=None, caps=True, tile=0.3, rfun=None, jitter=0.03):
        pts = [Vector(p) for p in pts]
        n = len(pts)
        t = bmesh.new()
        ub = t.loops.layers.uv.new('UVMap')
        tang = []
        for i in range(n):
            a = pts[max(i - 1, 0)]
            b = pts[min(i + 1, n - 1)]
            tang.append((b - a).normalized())
        ref = Vector((0, 0, 1)) if abs(tang[0].z) < 0.9 else Vector((1, 0, 0))
        nrm = tang[0].cross(ref).normalized()
        rings = []
        s = 0.0
        sacc = []
        for i in range(n):
            if i > 0:
                s += (pts[i] - pts[i - 1]).length
                nrm = nrm - tang[i] * nrm.dot(tang[i])
                nrm.normalize()
            sacc.append(s)
            bn = tang[i].cross(nrm).normalized()
            rr = rad if rfun is None else rad * rfun(i / max(n - 1, 1))
            rings.append([t.verts.new(pts[i] + (nrm * math.cos(k * math.tau / seg) + bn * math.sin(k * math.tau / seg)) * rr) for k in range(seg)])
        for i in range(n - 1):
            for k in range(seg):
                j = (k + 1) % seg
                f = t.faces.new((rings[i][k], rings[i][j], rings[i + 1][j], rings[i + 1][k]))
                u0, u1 = k / seg * math.tau * rad, (k + 1) / seg * math.tau * rad
                for loop, uv in zip(f.loops, ((u0, sacc[i]), (u1, sacc[i]), (u1, sacc[i + 1]), (u0, sacc[i + 1]))):
                    loop[ub].uv = uv
        if caps:
            f = t.faces.new(list(reversed(rings[0])))
            for loop in f.loops:
                loop[ub].uv = (0, 0)
            f = t.faces.new(rings[-1])
            for loop in f.loops:
                loop[ub].uv = (0, 0)
        bmesh.ops.recalc_face_normals(t, faces=t.faces[:])
        self._emit(t, mat, col, tile, 'given', jitter)
        return self

    def patch(self, org, U, V, nu, nv, mat, col=None, disp=None, tile=0.5, flip=False, jitter=0.03, normalize_uv=False):
        """grid sheet org + s*U + t*V (s,t in 0..1), optional displacement disp(s,t)->(dx,dy,dz).
        normalize_uv: UV spans 0..1 over the sheet (decals) instead of metric."""
        org, U, V = Vector(org), Vector(U), Vector(V)
        t = bmesh.new()
        ub = t.loops.layers.uv.new('UVMap')
        g = []
        for j in range(nv + 1):
            row = []
            for i in range(nu + 1):
                s, q = i / nu, j / nv
                p = org + U * s + V * q
                if disp:
                    p = p + Vector(disp(s, q))
                row.append(t.verts.new(p))
            g.append(row)
        su, sv = (1.0, 1.0) if normalize_uv else (U.length, V.length)
        for j in range(nv):
            for i in range(nu):
                vs = [g[j][i], g[j][i + 1], g[j + 1][i + 1], g[j + 1][i]]
                uvs = [(i / nu * su, j / nv * sv), ((i + 1) / nu * su, j / nv * sv),
                       ((i + 1) / nu * su, (j + 1) / nv * sv), (i / nu * su, (j + 1) / nv * sv)]
                if flip:
                    vs, uvs = vs[::-1], uvs[::-1]
                f = t.faces.new(vs)
                for loop, uv in zip(f.loops, uvs):
                    loop[ub].uv = uv
        t.normal_update()
        self._emit(t, mat, col, 1.0 if normalize_uv else tile, 'given', jitter)
        return self

    def poly(self, pts, mat, col=None, tile=0.5, flip=False):
        t = bmesh.new()
        ub = t.loops.layers.uv.new('UVMap')
        vs = [t.verts.new(p) for p in pts]
        if flip:
            vs = vs[::-1]
        f = t.faces.new(vs)
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        ta = [i for i in range(3) if i != ax]
        for loop in f.loops:
            loop[ub].uv = (loop.vert.co[ta[0]], loop.vert.co[ta[1]])
        t.normal_update()
        self._emit(t, mat, col, tile, 'given', 0.0)
        return self

    def ellipsoid(self, c, rad, mat, col=None, seg=12, rings=8, tile=0.5, jitter=0.03, rot=(0, 0, 0)):
        t = bmesh.new()
        ub = t.loops.layers.uv.new('UVMap')
        bmesh.ops.create_uvsphere(t, u_segments=seg, v_segments=rings, radius=1.0)
        for v in t.verts:
            v.co = Vector((v.co.x * rad[0], v.co.y * rad[1], v.co.z * rad[2]))
        if any(rot):
            bmesh.ops.transform(t, matrix=Euler(rot).to_matrix().to_4x4(), verts=t.verts)
        bmesh.ops.translate(t, vec=Vector(c), verts=t.verts)
        t.normal_update()
        for f in t.faces:
            for loop in f.loops:
                p = loop.vert.co - Vector(c)
                loop[ub].uv = (math.atan2(p.y, p.x) * max(rad[0], rad[1]), p.z)
        self._emit(t, mat, col, tile, 'given', jitter)
        return self

    # ---- finalize
    def finish(self, parent=None):
        bm = self.bm
        if len(bm.faces) == 0:
            return None
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.normal_update()
        ang = math.radians(self.smooth)
        for e in bm.edges:                     # sharp edges split the smoothing fans (bevel facets stay readable)
            if len(e.link_faces) == 2 and e.calc_face_angle(0) > ang:
                e.smooth = False
        area = {f: f.calc_area() for f in bm.faces}
        nl = []
        cache = {}
        for f in bm.faces:
            for l in f.loops:
                v = l.vert
                fan = {f}
                stack = [(f, l)]
                while stack:
                    cf, cl = stack.pop()
                    for e in (cl.edge, cl.link_loop_prev.edge):
                        if e.smooth and len(e.link_faces) == 2:
                            of = e.link_faces[0] if e.link_faces[1] == cf else e.link_faces[1]
                            if of not in fan:
                                fan.add(of)
                                ol = next(x for x in of.loops if x.vert == v)
                                stack.append((of, ol))
                s = Vector()
                for ff in fan:
                    s += ff.normal * area[ff]
                nl.append(s.normalized() if s.length > 1e-12 else f.normal.copy())
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
        try:
            me.normals_split_custom_set(nl)
        except Exception as e:
            print('custom normals failed', self.name, e)
        for k in self.slots:
            me.materials.append(k if isinstance(k, bpy.types.Material) else MATS[k])
        me.update()
        o = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(o)
        o.parent = parent or get_group(self.grp)
        for k, v in self.extras.items():
            o[k] = v
        self.obj = o
        return o

    def tris(self):
        if self.obj is None:
            return 0
        me = self.obj.data
        me.calc_loop_triangles()
        return len(me.loop_triangles)


def uv1_pack(objs):
    """second UV set (lightmap): blender lightmap pack per object."""
    for o in objs:
        me = o.data
        if 'UV1' not in me.uv_layers:
            me.uv_layers.new(name='UV1')
        me.uv_layers.active = me.uv_layers['UV1']
        for x in bpy.context.view_layer.objects:
            x.select_set(False)
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        try:
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.uv.lightmap_pack(PREF_CONTEXT='ALL_FACES', PREF_PACK_IN_ONE=True, PREF_NEW_UVLAYER=False,
                                     PREF_BOX_DIV=12, PREF_MARGIN_DIV=0.08)
        except Exception as exc:
            print('lightmap pack failed', o.name, exc)
        finally:
            if bpy.context.object and bpy.context.object.mode != 'OBJECT':
                bpy.ops.object.mode_set(mode='OBJECT')
        me.uv_layers.active = me.uv_layers['UVMap']
        me.uv_layers['UVMap'].active_render = True


# =====================================================================================
# 4. material library (roughness per detail-spec s6: glaze .05-.15, lacquer .1-.2, brass .15-.3, varnished wood .2-.35,
#    cast iron .5-.7, plaster .8-.9, tatami .6-.8, cloth .85-1, paper .9 + transmission)
# =====================================================================================

def build_materials():
    mat('wood', (150, 110, 70), 0.42, tx='grain', tile=0.55, normal=0.35)                # varnished / waxed timber
    mat('plank', (255, 255, 255), 0.6, tx='plank', tile=0.9, normal=0.6)
    mat('tea', (92, 62, 22), 0.05, coat=0.6, vcol=False)
    mat('wood_raw', (170, 135, 95), 0.7, tx='grain', tile=0.55, normal=0.4)           # unfinished pine/cedar
    mat('bamboo', (150, 140, 92), 0.42, tx='grain', tile=0.6, normal=0.25)
    mat('lacquer', (40, 18, 14), 0.17, coat=0.6, spec=0.6, tx='speckle', tile=0.3, normal=0.03)                              # urushi (col tints it)
    mat('iron', (42, 40, 38), 0.58, 0.85, spec=0.5, tx='speckle', tile=0.3, normal=0.5)                                     # cast / wrought iron
    mat('iron_worn', (80, 76, 70), 0.4, 0.9, tx='speckle', tile=0.3, normal=0.4)                                            # rubbed edges
    mat('brass', (205, 150, 70), 0.26, 1.0, tx='speckle', tile=0.3, normal=0.2)
    mat('tin', (150, 152, 150), 0.38, 0.9, tx='speckle', tile=0.3, normal=0.3)
    mat('copper', (170, 95, 60), 0.32, 1.0, tx='speckle', tile=0.3, normal=0.3)
    mat('glaze', (200, 200, 190), 0.11, coat=0.5, spec=0.6, tx='speckle', tile=0.3, normal=0.05)                             # glazed ceramic
    mat('porcelain', (236, 234, 226), 0.09, coat=0.4, spec=0.7, tx='speckle', tile=0.3, normal=0.05)
    mat('porcelain_plain', (236, 234, 226), 0.10, coat=0.5, spec=0.7)
    mat('enamel', (228, 228, 222), 0.24, coat=0.3, spec=0.6, tx='speckle', tile=0.3, normal=0.2)                            # white-enamelled iron
    mat('cloth', (200, 190, 170), 0.94, tx='weave', tile=0.12, normal=0.7, sheen=0.3, double=True)
    mat('cloth_bed', (220, 220, 215), 0.95, tx='weave', tile=0.12, normal=0.5, sheen=0.25, double=True)
    mat('paper', (240, 232, 210), 0.9, tx='washi', tile=0.5, normal=0.4, double=True)
    mat('cord', (90, 70, 50), 0.9, tx='weave', tile=0.04, normal=0.6)
    mat('glass_clear', (235, 245, 240), 0.03, spec=0.8, alpha=0.14)
    mat('glass_opal', (244, 236, 218), 0.2, emit=(255, 226, 170), emit_strength=0.45, coat=0.3)
    mat('bulb', (255, 226, 170), 0.2, emit=(255, 170, 80), emit_strength=16.0, vcol=False)
    mat('ember', (255, 120, 40), 0.5, emit=(255, 90, 20), emit_strength=6.0, vcol=False)
    mat('lantern', (250, 235, 200), 0.9, tx='washi', tile=0.5, emit=(255, 160, 70), emit_strength=2.2, double=True)
    mat('latex', (190, 25, 22), 0.17, coat=0.8, spec=0.7, vcol=False)
    mat('petal', (220, 140, 120), 0.6, sheen=0.4, double=True)
    mat('leaf', (60, 100, 45), 0.55, sheen=0.2, double=True)
    mat('soil', (50, 38, 28), 0.95, vcol=False)
    mat('ash', (150, 146, 138), 0.95, vcol=False)
    mat('plaster', (200, 185, 160), 0.88)
    mat('rubber', (30, 28, 26), 0.8, vcol=False)
    mat('felt', (130, 40, 36), 0.98, tx='weave', tile=0.08, normal=0.3, sheen=0.4)
    mat('wax', (225, 215, 185), 0.5, vcol=False)
    mat('ink', (16, 14, 14), 0.5, vcol=False)
    mat('ceramic_unglazed', (150, 100, 70), 0.75, tx='grain', tile=0.4, normal=0.1)


# =====================================================================================
# 5. helpers shared by the props
# =====================================================================================
C_CEDAR = (176, 130, 84)
C_DARKWOOD = (92, 58, 36)
C_WARMWOOD = (132, 88, 54)
C_LACQ = (34, 20, 16)
C_LACQ_RED = (128, 30, 24)
C_INDIGO = (36, 50, 92)
C_INDIGO_FADED = (84, 102, 136)
C_MADDER = (150, 54, 44)
C_OCHRE = (196, 150, 72)
C_CREAM = (232, 222, 198)
C_TEAL = (54, 146, 134)
C_CELADON = (150, 188, 168)


def mark(n):
    n.bm.verts.ensure_lookup_table()
    return len(n.bm.verts)


def deform(n, start, fn):
    n.bm.verts.ensure_lookup_table()
    for v in n.bm.verts[start:]:
        v.co = Vector(fn(v.co.copy()))


def smoothstep(a, b, x):
    t = min(max((x - a) / (b - a), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def ring_pts(cx, cy, z, r, n=12, start=0.0, arc=math.tau, plane='xy'):
    pts = []
    for i in range(n + 1):
        a = start + arc * i / n
        if plane == 'xy':
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a), z))
        elif plane == 'xz':
            pts.append((cx + r * math.cos(a), cy, z + r * math.sin(a)))
        else:
            pts.append((cx, cy + r * math.cos(a), z + r * math.sin(a)))
    return pts


def screw(n, p, axis, rad=0.0032, mat='brass', col=None, seg=8):
    """slotted screw head, raised 1.2 mm, slot as a recessed-looking dark bar"""
    p = Vector(p)
    a = Vector(axis).normalized()
    q = a.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    n.pushm(Matrix.Translation(p) @ q)
    n.cyl((0, 0, 0), (0, 0, 0.0013), rad, rad * 0.92, seg, mat, col, r=0.0004)
    n.box((-rad * 0.85, -0.0004, 0.0011), (rad * 0.85, 0.0004, 0.0015), 'ink', r=0, jitter=0)
    n.pop()


# =====================================================================================
# 6. props: floor
# =====================================================================================

def pillow(n, cx, cy, sx, sy, h, col, mat='cloth', nx=10, dent=None, puff=0.6, zb=0.0, tile=0.12):
    """cushion: smooth closed surface, top follows a superellipse bulge; dent=(dx,dy,depth,rad) presses the top"""
    hx, hy = sx / 2, sy / 2
    t = bmesh.new()
    ub = t.loops.layers.uv.new('UVMap')

    def ztop(i, j):
        x = (i / nx - 0.5) * sx
        y = (j / nx - 0.5) * sy
        e = (abs(x) / hx) ** 3 + (abs(y) / hy) ** 3
        z = zb + h * (0.36 + 0.64 * max(0.0, 1.0 - min(e, 1.0)) ** 0.7)
        if e >= 0.999:
            z = zb + h * 0.40
        if dent:
            d2 = ((x - dent[0]) ** 2 + (y - dent[1]) ** 2) / dent[3] ** 2
            z -= dent[2] * math.exp(-d2)
        return x, y, z
    g = [[t.verts.new((cx + ztop(i, j)[0], cy + ztop(i, j)[1], ztop(i, j)[2])) for i in range(nx + 1)] for j in range(nx + 1)]
    for j in range(nx):
        for i in range(nx):
            f = t.faces.new((g[j][i], g[j][i + 1], g[j + 1][i + 1], g[j + 1][i]))
            for loop in f.loops:
                loop[ub].uv = (loop.vert.co.x, loop.vert.co.y)
    # skirt around the edge
    bot = {}
    def edge_loop():
        loop = []
        for i in range(nx): loop.append((i, 0))
        for j in range(nx): loop.append((nx, j))
        for i in range(nx, 0, -1): loop.append((i, nx))
        for j in range(nx, 0, -1): loop.append((0, j))
        return loop
    L = edge_loop()
    lower = [t.verts.new((g[j][i].co.x, g[j][i].co.y, zb)) for (i, j) in L]
    for k in range(len(L)):
        a, b = L[k], L[(k + 1) % len(L)]
        f = t.faces.new((g[a[1]][a[0]], g[b[1]][b[0]], lower[(k + 1) % len(L)], lower[k]))
        for loop in f.loops:
            loop[ub].uv = (loop.vert.co.x + loop.vert.co.y, loop.vert.co.z)
    f = t.faces.new(list(reversed(lower)))
    for loop in f.loops:
        loop[ub].uv = (loop.vert.co.x, loop.vert.co.y)
    bmesh.ops.recalc_face_normals(t, faces=t.faces[:])
    n._emit(t, mat, col, tile, 'given', 0.04)


def zabuton(n, cx, cy, col, rot=0.0, dent=None, size=0.56, hem=(232, 222, 198)):
    with n.at((cx, cy, ZF), (0, 0, rot)):
        pillow(n, 0, 0, size, size * 1.04, 0.090, col, dent=dent)
        # piped border (contrasting hem strip) and centre button tuft
        s = size / 2 - 0.004
        for (a, b) in (((-s, -s * 1.04), (s, -s * 1.04 + 0.012)), ((-s, s * 1.04 - 0.012), (s, s * 1.04))):
            n.box((a[0], a[1], 0.028), (b[0], b[1], 0.040), 'cloth', hem, r=0.004, tile=0.12)
        for (a, b) in (((-s, -s * 1.04), (-s + 0.012, s * 1.04)), ((s - 0.012, -s * 1.04), (s, s * 1.04))):
            n.box((a[0], a[1], 0.028), (b[0], b[1], 0.040), 'cloth', hem, r=0.004, tile=0.12)
        zc = 0.075 - (dent[2] if dent and abs(dent[0]) < 0.05 and abs(dent[1]) < 0.05 else 0) * 0.9
        n.cyl((0, 0, zc - 0.004), (0, 0, zc + 0.006), 0.012, 0.009, 10, 'cloth', (90, 30, 26), r=0.002, tile=0.05)
        for sx in (-1, 1):
            for sy in (-1, 1):       # corner tassel knots
                n.ellipsoid((sx * (size / 2 - 0.012), sy * (size * 1.04 / 2 - 0.012), 0.038), (0.008, 0.008, 0.007), 'cloth', (150, 40, 34), 8, 5)


def hibachi_set(pos, rot=0.0):
    n = Node('UD_Hibachi_Kettle', hero='hibachi+kettle+tongs', tags='A:period-plausible kiri hibachi, copper liner, cast-iron tetsubin')
    with n.at((pos[0], pos[1], ZF), (0, 0, rot)):
        w, hgt, th = 0.44, 0.34, 0.03
        for (a, b) in (((-w / 2, -w / 2, 0.02), (w / 2, -w / 2 + th, hgt)), ((-w / 2, w / 2 - th, 0.02), (w / 2, w / 2, hgt)),
                       ((-w / 2, -w / 2 + th, 0.02), (-w / 2 + th, w / 2 - th, hgt)), ((w / 2 - th, -w / 2 + th, 0.02), (w / 2, w / 2 - th, hgt))):
            n.box(a, b, 'wood', (166, 122, 80), r=0.0035, seg=2)
        n.box((-w / 2 + 0.002, -w / 2 + 0.002, 0.03), (w / 2 - 0.002, w / 2 - 0.002, 0.045), 'wood_raw', (120, 88, 60), r=0.002)   # floor board
        for sx in (-1, 1):
            for sy in (-1, 1):
                n.box((sx * (w / 2 - 0.05) - 0.02, sy * (w / 2 - 0.05) - 0.02, 0.0), (sx * (w / 2 - 0.05) + 0.02, sy * (w / 2 - 0.05) + 0.02, 0.03), 'wood', C_DARKWOOD, r=0.004)
        # black-lacquer rim frame 25 mm wide, 12 mm thick, proud 1 mm; brass corner caps
        rw = 0.05
        for (a, b) in (((-w / 2 - 0.006, -w / 2 - 0.006), (w / 2 + 0.006, -w / 2 + rw)), ((-w / 2 - 0.006, w / 2 - rw), (w / 2 + 0.006, w / 2 + 0.006)),
                       ((-w / 2 - 0.006, -w / 2 + rw), (-w / 2 + rw, w / 2 - rw)), ((w / 2 - rw, -w / 2 + rw), (w / 2 + 0.006, w / 2 - rw))):
            n.box((a[0], a[1], hgt), (b[0], b[1], hgt + 0.014), 'lacquer', C_LACQ, r=0.003, seg=2)
        for sx in (-1, 1):
            for sy in (-1, 1):
                n.box((sx * (w / 2 + 0.006) - 0.016 * sx, sy * (w / 2 + 0.006) - 0.016 * sy, hgt + 0.0135), (sx * (w / 2 + 0.006) + 0.001 * sx, sy * (w / 2 + 0.006) + 0.001 * sy, hgt + 0.0155), 'brass', r=0.0007, jitter=0.05)
                screw(n, (sx * (w / 2 - 0.008), sy * (w / 2 - 0.008), hgt + 0.0155), (0, 0, 1), 0.0026)
        # copper liner (hollow bowl), ash, charcoal
        n.lathe([(0.17, 0.12), (0.185, 0.17), (0.192, 0.27), (0.198, 0.335), (0.192, 0.338), (0.184, 0.334), (0.178, 0.27), (0.168, 0.17), (0.150, 0.14)], 20, 'copper', (150, 90, 60))
        n.lathe([(0.0, 0.215), (0.16, 0.218), (0.178, 0.262), (0.12, 0.275), (0.06, 0.28), (0.0, 0.29)], 24, 'ash', (154, 150, 142), tile=0.4)
        rng = random.Random(5)
        for k, (ang, rr, hot) in enumerate(((0.3, 0.06, 1), (1.6, 0.085, 1), (2.7, 0.05, 0), (3.9, 0.095, 1), (5.0, 0.07, 0), (5.7, 0.04, 1))):
            c = (math.cos(ang) * rr, math.sin(ang) * rr, 0.283)
            with n.at(c, (rng.uniform(-.3, .3), rng.uniform(-.3, .3), rng.uniform(0, 3))):
                n.box((-0.025, -0.02, 0), (0.025, 0.02, 0.042), 'ember' if hot else 'ink', (255, 90, 20) if hot else (26, 24, 24), r=0.006, seg=2, jitter=0.15)
                if hot:
                    n.box((-0.027, -0.022, 0.03), (0.027, 0.022, 0.044), 'ink', (34, 30, 30), r=0.006, jitter=0.1)   # grey crust on top of the glow
        # trivet (gotoku) and kettle
        for a in (0.4, 2.5, 4.6):
            n.cyl((math.cos(a) * 0.09, math.sin(a) * 0.09, 0.28), (math.cos(a) * 0.085, math.sin(a) * 0.085, 0.36), 0.0075, 0.007, 6, 'iron', (40, 38, 36))
        n.tube(ring_pts(0, 0, 0.36, 0.088, 16), 0.0055, 5, 'iron', (44, 40, 38), caps=False)
        kz = 0.368
        n.lathe([(0.0, kz), (0.072, kz), (0.092, kz + 0.018), (0.108, kz + 0.06), (0.112, kz + 0.105), (0.098, kz + 0.148), (0.072, kz + 0.172),
                 (0.056, kz + 0.18), (0.056, kz + 0.186), (0.048, kz + 0.184), (0.046, kz + 0.16)], 20, 'iron', (46, 42, 40))
        # seam line (raised band) around the shoulder and lug pair
        n.lathe([(0.1125, kz + 0.092), (0.1145, kz + 0.096), (0.1145, kz + 0.101), (0.1125, kz + 0.105)], 20, 'iron_worn', (78, 70, 62))
        for s in (-1, 1):
            n.box((s * 0.118 - 0.01, -0.008, kz + 0.11), (s * 0.118 + 0.01, 0.008, kz + 0.128), 'iron', r=0.002)
        bail = [(math.cos(a) * 0.118, 0.0, kz + 0.12 + math.sin(a) * 0.13) for a in [math.pi * i / 14 for i in range(15)]]
        n.tube(bail, 0.0042, 6, 'iron', (40, 38, 36))
        # spout (tapered curved tube) and lid, slightly askew and lifted on one side
        n.tube([(0.095, 0.0, kz + 0.04), (0.125, 0.0, kz + 0.072), (0.150, 0.0, kz + 0.11), (0.165, 0.0, kz + 0.135)], 0.0145, 8, 'iron', (46, 42, 40), caps=False, rfun=lambda t: 1.0 - 0.45 * t)
        n.tube([(0.165, 0.0, kz + 0.135), (0.171, 0.0, kz + 0.147)], 0.0088, 8, 'iron_worn', (90, 82, 70), caps=False)
        with n.at((0.0, 0.0, kz + 0.186), (0.0, math.radians(7), 0)):
            n.push((0.004, 0, 0.004))
            n.lathe([(0.0, 0.0), (0.050, 0.0), (0.060, 0.004), (0.055, 0.012), (0.032, 0.018), (0.0, 0.019)], 24, 'iron', (50, 46, 44))
            n.cyl((0, 0, 0.018), (0, 0, 0.034), 0.0065, 0.0055, 10, 'brass', (190, 140, 66), r=0.0008)
            n.ellipsoid((0, 0, 0.036), (0.0105, 0.0105, 0.0075), 'brass', (190, 140, 66), 10, 6)
            n.pop()
        # tongs (hibashi) standing in the ash, one cool iron ash spatula leaning on the rim
        for s, a in ((0.012, 0.25), (-0.012, 0.36)):
            n.cyl((-0.12, s, 0.285), (-0.12 + 0.05, s * 3 - 0.012, 0.50), 0.0042, 0.0035, 6, 'iron_worn', (70, 66, 62))
        n.cyl((0.11, 0.06, 0.285), (0.19, 0.105, 0.42), 0.0035, 0.004, 6, 'iron', (52, 48, 44))
        n.box((0.183, 0.099, 0.41), (0.205, 0.12, 0.425), 'iron', r=0.001)
    return n.finish()


def sewing_box(pos, rot=0.0):
    """hero 1: black-lacquer saiho-bako, lid open on two brass hinges, inner tray with compartments and contents"""
    n = Node('UD_SewingBox_Mending', hero='sewing box, mid-mending', tags='A:period-plausible sewing box; contents invented')
    L, Wd, H = 0.40, 0.26, 0.105
    with n.at((pos[0], pos[1], ZF), (0, 0, rot)):
        tk = 0.012
        for (a, b) in (((-L / 2, -Wd / 2, 0.0), (L / 2, Wd / 2, 0.012)),                       # bottom
                       ((-L / 2, -Wd / 2, 0.012), (L / 2, -Wd / 2 + tk, H)), ((-L / 2, Wd / 2 - tk, 0.012), (L / 2, Wd / 2, H)),
                       ((-L / 2, -Wd / 2 + tk, 0.012), (-L / 2 + tk, Wd / 2 - tk, H)), ((L / 2 - tk, -Wd / 2 + tk, 0.012), (L / 2, Wd / 2 - tk, H))):
            n.box(a, b, 'lacquer', (38, 22, 16), r=0.0028, seg=1)
        n.box((-L / 2 + tk, -Wd / 2 + tk, 0.012), (L / 2 - tk, Wd / 2 - tk, 0.016), 'wood_raw', (196, 172, 128), r=0.0005)   # paulownia lining
        # recessed seam lip (lid seat) and lip gap line
        n.box((-L / 2 + 0.002, -Wd / 2 + 0.002, H - 0.004), (L / 2 - 0.002, -Wd / 2 + 0.004, H), 'ink', r=0, jitter=0)
        # lid open ~108 deg about the rear (+y) top edge
        with n.at((0, Wd / 2, H), (math.radians(108), 0, 0)):
            for (a, b) in (((-L / 2, 0.0, 0.0), (L / 2, Wd, 0.012)), ((-L / 2, 0.0, 0.012), (L / 2, tk, 0.03)), ((-L / 2, Wd - tk, 0.012), (L / 2, Wd, 0.03)),
                           ((-L / 2, tk, 0.012), (-L / 2 + tk, Wd - tk, 0.03)), ((L / 2 - tk, tk, 0.012), (L / 2, Wd - tk, 0.03))):
                n.box(a, b, 'lacquer', (38, 22, 16), r=0.0028, seg=1)
            n.box((-L / 2 + tk, tk, 0.012), (L / 2 - tk, Wd - tk, 0.0135), 'wood_raw', (200, 176, 130), r=0.0004)
            # brass corner plates + slotted screws on the lid back (outer face is z<0 side)
            for sx in (-1, 1):
                for yy in (0.04, Wd - 0.04):
                    n.box((sx * (L / 2 - 0.022) - 0.02, yy - 0.022, -0.0035), (sx * (L / 2 - 0.022) + 0.02, yy + 0.022, 0.0), 'brass', (200, 148, 68), r=0.0006, jitter=0.06)
            # inner mirror-free pocket: paper sheet with a pin-strip (needle book)
            n.box((-0.10, 0.06, 0.0136), (0.06, 0.15, 0.0146), 'felt', (170, 60, 50), r=0.0003, tile=0.08)
        # hinges (two brass leaves + pin) at the back
        for sx in (-0.11, 0.11):
            n.box((sx - 0.022, Wd / 2 - 0.004, H - 0.052), (sx + 0.022, Wd / 2 + 0.0015, H - 0.004), 'brass', (204, 150, 70), r=0.0008, jitter=0.05)
            n.cyl((sx - 0.022, Wd / 2 + 0.004, H), (sx + 0.022, Wd / 2 + 0.004, H), 0.0045, None, 8, 'brass', (204, 150, 70))
            for k in (-1, 1):
                screw(n, (sx + k * 0.014, Wd / 2 + 0.0015, H - 0.03), (0, 1, 0), 0.0028)
        # front latch plate + raised knob and keyhole shield; carry-loop on the end
        n.box((-0.02, -Wd / 2 - 0.0016, H - 0.04), (0.02, -Wd / 2 + 0.0002, H - 0.004), 'brass', (204, 150, 70), r=0.0007)
        n.cyl((0, -Wd / 2 - 0.0016, H - 0.02), (0, -Wd / 2 - 0.007, H - 0.02), 0.0055, 0.0045, 10, 'brass', (204, 150, 70), r=0.001)
        for sx in (-1, 1):
            screw(n, (sx * 0.013, -Wd / 2 - 0.0016, H - 0.012), (0, -1, 0), 0.0024)
        n.tube([(L / 2 + 0.001, -0.03, H - 0.03), (L / 2 + 0.018, -0.03, H - 0.022), (L / 2 + 0.022, 0.0, H - 0.028), (L / 2 + 0.018, 0.03, H - 0.022), (L / 2 + 0.001, 0.03, H - 0.03)], 0.0028, 6, 'brass', (204, 150, 70), caps=False)
        # removable inner tray on rebates, with five compartments
        tz = 0.05
        n.box((-L / 2 + tk + 0.004, -Wd / 2 + tk + 0.004, tz), (L / 2 - tk - 0.004, Wd / 2 - tk - 0.004, tz + 0.008), 'wood_raw', (186, 154, 112), r=0.001)
        for (a, b) in (((-0.18, -0.112, tz + 0.008), (0.18, -0.108, tz + 0.04)), ((-0.18, 0.108, tz + 0.008), (0.18, 0.112, tz + 0.04)),
                       ((-0.182, -0.112, tz + 0.008), (-0.178, 0.112, tz + 0.04)), ((0.178, -0.112, tz + 0.008), (0.182, 0.112, tz + 0.04)),
                       ((-0.06, -0.108, tz + 0.008), (-0.056, 0.108, tz + 0.03)), ((0.07, -0.108, tz + 0.008), (0.074, 0.0, tz + 0.03)),
                       ((0.07, 0.0, tz + 0.008), (0.18, 0.004, tz + 0.03))):
            n.box(a, b, 'wood_raw', (186, 154, 112), r=0.0008)
        # under-tray cloth scraps (folded, stacked, slightly proud of the rim)
        for k, c in enumerate(((150, 54, 44), (58, 82, 110), (214, 196, 150))):
            n.box((-0.17 + 0.012 * k, -0.095 + 0.02 * k, 0.018 + 0.011 * k), (-0.06 + 0.012 * k, -0.02 + 0.02 * k, 0.029 + 0.011 * k), 'cloth', c, r=0.004, tile=0.12)
        # spools of thread
        for k, (px, py, c) in enumerate(((-0.14, -0.06, (58, 82, 110)), (-0.1, -0.03, (150, 54, 44)), (-0.14, 0.03, (224, 214, 190)), (-0.095, 0.07, (40, 40, 44)))):
            zz = tz + 0.008
            n.lathe([(0.0, zz), (0.0135, zz), (0.0135, zz + 0.003), (0.0075, zz + 0.0035), (0.0115, zz + 0.0055), (0.0115, zz + 0.0225), (0.0075, zz + 0.0245),
                     (0.0135, zz + 0.0255), (0.0135, zz + 0.0285), (0.0, zz + 0.0285)], 12, 'cloth', c, tile=0.05, at=(px, py, 0))
        # scissors (warabite), slightly open, laid in the long compartment
        with n.at((0.0, -0.085, tz + 0.012), (0, 0, math.radians(14))):
            for sg in (-1, 1):
                with n.at((0, 0, 0), (0, 0, sg * 0.09)):
                    n.prism([(-0.056, 0.0), (0.054, sg * 0.0035), (0.0, sg * 0.0058), (-0.05, sg * 0.0048)], 0.0 if sg > 0 else 0.0025, 0.0025 if sg > 0 else 0.005, 'tin', (188, 190, 188), r=0.0003, plane='xy')
                    n.tube(ring_pts(-0.075, sg * -0.004, 0.0015 if sg > 0 else 0.0035, 0.0115, 12), 0.0022, 5, 'tin', (170, 172, 170), caps=False)
            n.cyl((0.0, 0.0, -0.0005), (0.0, 0.0, 0.0055), 0.0028, None, 8, 'brass', (190, 140, 66))
        # pin cushion with five pins
        n.ellipsoid((0.125, -0.06, tz + 0.025), (0.032, 0.03, 0.02), 'felt', (170, 58, 48), 10, 6, tile=0.08)
        for k in range(5):
            a = k * 1.3
            p0 = Vector((0.125 + 0.012 * math.cos(a), -0.06 + 0.012 * math.sin(a), tz + 0.040))
            p1 = p0 + Vector((0.008 * math.cos(a), 0.008 * math.sin(a), 0.018))
            n.cyl(p0, p1, 0.0007, None, 4, 'tin', (200, 200, 198), caps=(False, True))
            n.ellipsoid(p1, (0.0022, 0.0022, 0.0022), 'glaze', [(180, 40, 36), (230, 210, 120), (60, 90, 160)][k % 3], 6, 4)
        # needle book and bamboo measure (kujirajaku) with tick marks as proud notches
        n.box((0.09, 0.03, tz + 0.008), (0.17, 0.085, tz + 0.012), 'felt', (60, 84, 110), r=0.0006, tile=0.08)
        n.box((-0.17, 0.088, tz + 0.008), (0.05, 0.102, tz + 0.013), 'bamboo', (196, 176, 100), r=0.0008)
        for k in range(18):
            n.box((-0.165 + 0.0122 * k, 0.0875, tz + 0.0128), (-0.165 + 0.0122 * k + 0.0008, 0.0995 if k % 5 == 0 else 0.094, tz + 0.0135), 'ink', r=0, jitter=0)
    return n.finish()


def mending_piece(pos, rot=0.0):
    """the half-finished garment: an indigo sleeve panel with a pale patch stitched on two sides, needle still in it"""
    n = Node('UD_Mending_Piece', tags='A:period-plausible mending; invented')

    def drape(x, y):        # cloth height at local (x, y), shared by the panel, patch, stitches and needle
        s, t = (x + 0.27) / 0.54, (y + 0.19) / 0.38
        return (0.004 + 0.012 * math.sin(s * 7.0 + t * 2.0) * math.sin(t * 3.14) + 0.03 * smoothstep(0.75, 1.0, s) * (1 - t * 0.6)
                + 0.006 * math.sin(t * 11 + s * 3))
    with n.at((pos[0], pos[1], ZF), (0, 0, rot)):
        n.patch((-0.27, -0.19, 0), (0.54, 0, 0), (0, 0.38, 0), 18, 12, 'cloth', (40, 52, 94), lambda s, t: (0, 0, drape(-0.27 + s * 0.54, -0.19 + t * 0.38)), tile=0.12)

        def lifted(x, y):   # pale patch: lifted at the unstitched corner
            return drape(x, y) + 0.0042 + 0.012 * smoothstep(0.14, 0.18, x) * smoothstep(0.0, 0.03, y)
        n.patch((0.03, -0.09, 0), (0.15, 0, 0), (0, 0.12, 0), 6, 5, 'cloth', (204, 184, 142),
                lambda s, t: (0, 0, lifted(0.03 + s * 0.15, -0.09 + t * 0.12)), tile=0.12)
        for k in range(10):       # running stitches along the two finished edges
            x = 0.03 + 0.0145 * k
            z = drape(x, -0.09) + 0.0042
            n.box((x, -0.0915, z - 0.0004), (x + 0.008, -0.0897, z + 0.0012), 'cloth', (236, 232, 222), r=0.0003, jitter=0.02, tile=0.05)
        for k in range(7):
            y = -0.088 + 0.0135 * k
            z = drape(0.03, y) + 0.0042
            n.box((0.0285, y, z - 0.0004), (0.0305, y + 0.0075, z + 0.0012), 'cloth', (236, 232, 222), r=0.0003, jitter=0.02, tile=0.05)
        # needle slanted through the piece, thread tail trailing toward the sewing box
        zn = drape(0.18, 0.0) + 0.003
        n.cyl((0.18, -0.02, zn - 0.001), (0.186, 0.028, zn + 0.042), 0.0008, None, 5, 'tin', (200, 200, 198))
        n.tube([(0.186, 0.028, zn + 0.042), (0.2, 0.05, zn + 0.03), (0.218, 0.09, zn + 0.004), (0.205, 0.14, zn - 0.002), (0.17, 0.20, zn - 0.004)], 0.0008, 4, 'cloth', (236, 232, 222), caps=False, tile=0.02)
    return n.finish()


def tobacco_tray(pos, rot=0.0):
    n = Node('UD_TobaccoTray', tags='A:period-plausible tabakobon; contents invented')
    with n.at((pos[0], pos[1], ZF), (0, 0, rot)):
        L, Wd = 0.27, 0.17
        n.box((-L / 2, -Wd / 2, 0.0), (L / 2, Wd / 2, 0.012), 'wood', C_WARMWOOD, r=0.002)
        for (a, b) in (((-L / 2, -Wd / 2, 0.012), (L / 2, -Wd / 2 + 0.012, 0.055)), ((-L / 2, Wd / 2 - 0.012, 0.012), (L / 2, Wd / 2, 0.055)),
                       ((-L / 2, -Wd / 2 + 0.012, 0.012), (-L / 2 + 0.012, Wd / 2 - 0.012, 0.055)), ((L / 2 - 0.012, -Wd / 2 + 0.012, 0.012), (L / 2, Wd / 2 - 0.012, 0.055))):
            n.box(a, b, 'wood', C_WARMWOOD, r=0.002)
        # carrying bar (arched) across the middle
        n.box((-0.004, -Wd / 2, 0.055), (0.004, Wd / 2, 0.063), 'wood', C_DARKWOOD, r=0.002)
        n.box((-0.004, -Wd / 2, 0.012), (0.004, -Wd / 2 + 0.008, 0.063), 'wood', C_DARKWOOD, r=0.001)
        n.box((-0.004, Wd / 2 - 0.008, 0.012), (0.004, Wd / 2, 0.063), 'wood', C_DARKWOOD, r=0.001)
        # hiire (fire bowl) with a last ember and haifuki (bamboo ash pot)
        n.lathe([(0.012, 0.012), (0.034, 0.014), (0.042, 0.04), (0.04, 0.056), (0.036, 0.054), (0.03, 0.04), (0.0, 0.034)], 18, 'glaze', (120, 96, 70))
        n.lathe([(0.0, 0.034), (0.028, 0.038), (0.03, 0.045), (0.0, 0.04)], 12, 'ash', (150, 146, 140), tile=0.3)
        n.ellipsoid((0.004, 0.0, 0.043), (0.008, 0.007, 0.005), 'ember', (255, 90, 20), 8, 4)
        n.cyl((0.09, -0.02, 0.012), (0.09, -0.02, 0.095), 0.022, 0.02, 14, 'bamboo', (170, 168, 100), caps=(True, False), r=0.0012)
        n.lathe([(0.0195, 0.072), (0.0225, 0.074), (0.0225, 0.078), (0.0195, 0.0795)], 14, 'bamboo', (140, 134, 70), at=(0.09, -0.02, 0))       # node ring
        n.lathe([(0.02, 0.095), (0.012, 0.0965), (0.012, 0.03)], 14, 'ink', (30, 26, 22), at=(0.09, -0.02, 0))
        # kiseru laid across the tray edge: bamboo shaft, brass bowl and mouthpiece
        with n.at((0.0, 0.0, 0.0), (0, 0, math.radians(-14))):
            zk = 0.063 + 0.0044
            n.cyl((-0.12, 0.03, zk), (0.15, 0.03, zk), 0.0042, 0.0042, 8, 'bamboo', (160, 130, 70), r=0.0008)
            n.cyl((-0.165, 0.03, zk), (-0.118, 0.03, zk), 0.0056, 0.0046, 8, 'brass', (200, 148, 66), r=0.0006)
            n.lathe([(0.0055, 0.0), (0.0085, 0.004), (0.0105, 0.015), (0.0105, 0.019), (0.0075, 0.02), (0.0, 0.0205)], 12, 'brass', (200, 148, 66), at=(-0.158, 0.03, zk - 0.002))
            n.cyl((0.148, 0.03, zk), (0.175, 0.03, zk), 0.0046, 0.0052, 8, 'brass', (200, 148, 66), r=0.0006)
        # tobacco pouch (cloth) slumped beside, with a brass clasp
        def slump(s, t):
            return (0, 0, 0.035 * math.sin(s * math.pi) * math.sin(t * math.pi))
        n.patch((-0.06, -0.14, 0.0), (0.12, 0, 0), (0, 0.09, 0), 8, 6, 'cloth', (130, 60, 48), slump, tile=0.12)
    return n.finish()


# =====================================================================================
# 7. generated pictures: calendar / scroll / print / clock dial / shoji / sun pools (numpy + a Workbench text pass)
#    All text is fictional (shop name 新榮堂 invented; numerals and classical-sounding phrases are generic).
# =====================================================================================
FONT_PATHS = ['C:/Windows/Fonts/BIZ-UDMinchoM.ttc', 'C:/Windows/Fonts/yumin.ttf', 'C:/Windows/Fonts/msmincho.ttc']
_FONT = {}


def text_mask(specs, w, h):
    """render text to a coverage mask (h x w float, row 0 = bottom) with a throw-away Workbench scene.
    specs: dict(text, x, y, size, align='CENTER'|'LEFT'|'RIGHT', rot=0) in pixel units, origin bottom-left."""
    if 'f' not in _FONT:
        _FONT['f'] = None
        for p in FONT_PATHS:
            if os.path.exists(p):
                try:
                    _FONT['f'] = bpy.data.fonts.load(p)
                    break
                except Exception as e:
                    print('font load failed', p, e)
    sc = bpy.data.scenes.new('UD_txt')
    coll = sc.collection
    wd = bpy.data.worlds.new('UD_txt_w')
    wd.color = (1, 1, 1)
    sc.world = wd
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'FLAT'
    sc.display.shading.color_type = 'SINGLE'
    sc.display.shading.single_color = (0, 0, 0)
    sc.display_settings.display_device = 'sRGB'
    sc.view_settings.view_transform = 'Standard'
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    try:
        sc.display.render_aa = '8'
    except Exception:
        pass
    cd = bpy.data.cameras.new('UD_txt_c')
    cd.type = 'ORTHO'
    cd.ortho_scale = max(w, h)
    cam = bpy.data.objects.new('UD_txt_c', cd)
    coll.objects.link(cam)
    cam.location = (w / 2, h / 2, 10)
    sc.camera = cam
    objs = []
    for s in specs:
        cu = bpy.data.curves.new('t', 'FONT')
        cu.body = s['text']
        cu.size = s['size']
        cu.align_x = s.get('align', 'CENTER')
        cu.align_y = 'CENTER'
        if _FONT['f'] is not None:
            cu.font = _FONT['f']
        ob = bpy.data.objects.new('t', cu)
        coll.objects.link(ob)
        ob.location = (s['x'], s['y'], 0)
        ob.rotation_euler = (0, 0, math.radians(s.get('rot', 0)))
        objs.append(ob)
    path = os.path.join(os.environ.get('TEMP', '.'), 'ud_txt_tmp.png')
    sc.render.filepath = path
    bpy.ops.render.render(scene='UD_txt', write_still=True)
    img = bpy.data.images.load(path)
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[..., 0]
    bpy.data.images.remove(img)
    for ob in objs:
        bpy.data.objects.remove(ob)
    bpy.data.scenes.remove(sc)
    try:
        os.remove(path)
    except Exception:
        pass
    return 1.0 - px


def vtext(chars, x, y0, size, step):
    return [dict(text=c, x=x, y=y0 - i * step, size=size) for i, c in enumerate(chars)]


def blur(a, k=1):
    for _ in range(k):
        a = (a + np.roll(a, 1, 0) + np.roll(a, -1, 0) + np.roll(a, 1, 1) + np.roll(a, -1, 1)) / 5.0
    return a


_IMG = {}


def picture(key):
    if key in _IMG:
        return _IMG[key]
    img = None
    if key == 'calendar':     # 0.30 x 0.46 m; 384 x 588 px
        w, h = 384, 588
        paper = np.zeros((h, w, 3)) + np.array([238, 228, 204]) / 255.0
        paper = paper * (1 + 0.02 * fnoise(1024, 30, 30, 61)[:h, :w, None])
        sp = []
        sp.append(dict(text='新榮堂', x=w / 2, y=h - 62, size=58))
        sp.append(dict(text='明治四十五年', x=w / 2, y=h - 128, size=30))
        black = text_mask(sp + [dict(text='日　月　火　水　木　金　土', x=w / 2, y=268, size=15)], w, h)
        red_sp = [dict(text='六月', x=w / 2, y=h - 215, size=86), dict(text='日', x=27 + 0 * 49, y=268, size=15)]
        nums = []
        reds = []
        for d in range(1, 31):
            idx = d + 0            # June 1912 started on a Saturday; fictional grid, Sundays in red
            col = (idx + 5) % 7
            row = (idx + 5) // 7
            px = 40 + col * 50.6
            py = 232 - row * 40
            (reds if col == 0 else nums).append(dict(text=str(d), x=px, y=py, size=21))
        black = np.maximum(black, text_mask(nums, w, h))
        red = np.maximum(text_mask(red_sp[:1], w, h), text_mask(reds, w, h))
        arr = paper.copy()
        arr = paper * (1 - black[..., None]) + np.array([0.08, 0.07, 0.07]) * black[..., None]
        arr = arr * (1 - red[..., None]) + np.array([0.70, 0.12, 0.10]) * red[..., None]
        # border double line
        yy, xx = np.mgrid[0:h, 0:w]
        edge = ((xx > 10) & (xx < w - 10) & (yy > 10) & (yy < h - 10)) & ~((xx > 14) & (xx < w - 14) & (yy > 14) & (yy < h - 14))
        arr = np.where(edge[..., None], np.array([0.25, 0.16, 0.12]), arr)
        img = make_image('UD_pic_calendar', arr)
    elif key == 'scroll':     # ink landscape 0.30 x 0.62 m; 256 x 528 px
        w, h = 256, 528
        paper = np.zeros((h, w, 3)) + np.array([232, 218, 186]) / 255.0
        paper = paper * (1 + 0.035 * fnoise(1024, 20, 20, 62)[:h, :w, None])
        yy, xx = np.mgrid[0:h, 0:w]
        ink = np.zeros((h, w))
        rng = np.random.default_rng(7)
        for k, (base, amp, dens) in enumerate(((150, 120, 0.9), (95, 70, 0.6), (50, 40, 0.35))):
            ridge = base + amp * (0.5 + 0.5 * np.sin(xx / w * 7 + k * 2.1)) * (0.6 + 0.4 * np.sin(xx / w * 17 + k))
            ink = np.maximum(ink, np.where(yy < ridge, dens * np.clip((ridge - yy) / 60.0, 0, 1) ** 0.6 + 0.2 * dens, 0))
        mist = blur(fnoise(1024, 3, 3, 63)[:h, :w] * 0.5 + 0.5, 2)
        ink = ink * (0.55 + 0.45 * smooth01(fnoise(1024, 6, 40, 64)[:h, :w], -1, 1.5)) * (1 - 0.35 * mist * (yy < 260))
        moon = ((xx - 160) ** 2 + (yy - 395) ** 2) < 26 ** 2
        ink = np.where(moon, 0, ink)
        arr = paper * (1 - 0.85 * ink[..., None])
        arr = np.where(moon[..., None], paper * 1.02, arr)
        txt = text_mask(vtext('春風来', 214, 480, 40, 46), w, h)
        arr = arr * (1 - 0.95 * txt[..., None]) + np.array([0.04, 0.03, 0.03]) * 0.95 * txt[..., None]
        seal = (xx > 195) & (xx < 228) & (yy > 268) & (yy < 300)
        arr = np.where(seal[..., None], np.array([0.72, 0.13, 0.10]), arr)
        img = make_image('UD_pic_scroll', arr)
    elif key == 'print':      # framed woodblock-style print (waves + rising sun), 0.42 x 0.56 m; 336 x 448 px
        w, h = 336, 448
        yy, xx = np.mgrid[0:h, 0:w]
        arr = np.zeros((h, w, 3)) + np.array([236, 224, 196]) / 255.0
        sun = ((xx - 200) ** 2 + (yy - 330) ** 2) < 62 ** 2
        arr = np.where(sun[..., None], np.array([0.74, 0.22, 0.16]), arr)
        for k in range(7):
            y0 = 60 + k * 34
            wave = y0 + 16 * np.sin(xx / w * (9 + k) + k * 1.3) + 7 * np.sin(xx / w * 31 + k)
            col = [(0.11, 0.20, 0.36), (0.16, 0.28, 0.46), (0.23, 0.38, 0.56), (0.34, 0.50, 0.66), (0.50, 0.62, 0.74), (0.66, 0.74, 0.80), (0.80, 0.84, 0.84)][k]
            arr = np.where((yy < wave)[..., None], np.array(col), arr)
            foam = np.abs(yy - wave) < 2.2
            arr = np.where(foam[..., None], np.array([0.94, 0.92, 0.86]), arr)
        arr = arr * (1 + 0.03 * fnoise(1024, 25, 25, 65)[:h, :w, None])
        edge = (xx < 8) | (xx > w - 9) | (yy < 8) | (yy > h - 9)
        arr = np.where(edge[..., None], np.array([0.93, 0.88, 0.78]), arr)
        img = make_image('UD_pic_print', arr)
    elif key == 'clock':      # enamel dial, 512 px
        w = h = 512
        yy, xx = np.mgrid[0:h, 0:w]
        r = np.hypot(xx - 256, yy - 256)
        arr = np.zeros((h, w, 3)) + np.array([240, 236, 224]) / 255.0
        arr = arr * (1 + 0.012 * fnoise(512, 50, 50, 66)[..., None])
        arr = np.where((r > 232)[..., None], np.array([0.12, 0.10, 0.09]), arr)
        ang = np.arctan2(yy - 256, xx - 256)
        for k in range(60):
            a = k * math.tau / 60
            major = k % 5 == 0
            d = np.abs(np.sin(ang - a)) * r
            on = (d < (2.4 if major else 1.1)) & (r > (200 if major else 212)) & (r < 228) & (np.cos(ang - a) > 0)
            arr = np.where(on[..., None], np.array([0.08, 0.07, 0.07]), arr)
        rom = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']
        sp = [dict(text=rom[k], x=256 + 160 * math.sin(k * math.tau / 12), y=256 + 160 * math.cos(k * math.tau / 12), size=46, rot=-k * 30) for k in range(12)]
        m = text_mask(sp, w, h)
        arr = arr * (1 - 0.95 * m[..., None]) + np.array([0.06, 0.05, 0.05]) * 0.95 * m[..., None]
        img = make_image('UD_pic_clock', arr)
    elif key == 'ledger':     # cover label strip + ledger cover paper
        w, h = 256, 128
        arr = np.zeros((h, w, 3)) + np.array([236, 228, 206]) / 255.0
        m = text_mask([dict(text='大福帳', x=128, y=64, size=70)], w, h)
        arr = arr * (1 - 0.92 * m[..., None]) + np.array([0.06, 0.05, 0.05]) * 0.92 * m[..., None]
        img = make_image('UD_pic_ledger', arr)
    _IMG[key] = img
    return img


def mat_img(name, img, rough=0.85, alpha=False, emit=None, emit_strength=0.0, double=True, spec=0.3, coat=0.0, trans=0.0, repeat=False):
    key = 'img_' + name
    if key in MATS:
        return MATS[key]
    m = bpy.data.materials.new('UD_' + name)
    m.use_nodes = True
    nt = m.node_tree
    bs = nt.nodes['Principled BSDF']
    ti = nt.nodes.new('ShaderNodeTexImage')
    ti.image = img
    ti.extension = 'REPEAT' if repeat else 'EXTEND'
    nt.links.new(ti.outputs['Color'], bs.inputs['Base Color'])
    if alpha:
        nt.links.new(ti.outputs['Alpha'], bs.inputs['Alpha'])
        for attr, val in (('surface_render_method', 'BLENDED'), ('blend_method', 'BLEND')):
            try:
                setattr(m, attr, val)
            except Exception:
                pass
    bs.inputs['Roughness'].default_value = rough
    try:
        bs.inputs['Specular IOR Level'].default_value = spec
    except Exception:
        pass
    if coat:
        bs.inputs['Coat Weight'].default_value = coat
    if trans:
        bs.inputs['Transmission Weight'].default_value = trans
    if emit is not None:
        if emit == 'self':
            nt.links.new(ti.outputs['Color'], bs.inputs['Emission Color'])
        else:
            bs.inputs['Emission Color'].default_value = (*lin(emit), 1)
        bs.inputs['Emission Strength'].default_value = emit_strength
    m.use_backface_culling = not (double or alpha)
    MATS[key] = m
    return m


# =====================================================================================
# 8. helpers: oriented quads, discs, flowers
# =====================================================================================

def fquad(n, org, U, V, want, mat, col=None, nu=1, nv=1, disp=None, tile=0.5, normalize_uv=True):
    """planar patch facing `want` (a direction); UVs 0..1 over the patch unless normalize_uv=False (metric)."""
    U, V = Vector(U), Vector(V)
    flip = U.cross(V).dot(Vector(want)) < 0
    n.patch(org, U, V, nu, nv, mat, col, disp, tile, flip=flip, normalize_uv=normalize_uv, jitter=0.0 if normalize_uv else 0.03)


def disc(n, c, normal, rad, mat, col=None, seg=28, mirror_u=False):
    """flat disc with 0..1 planar UVs (for dials / pictures)"""
    normal = Vector(normal).normalized()
    q = normal.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    t = bmesh.new()
    ub = t.loops.layers.uv.new('UVMap')
    vs = [t.verts.new((rad * math.cos(i * math.tau / seg), rad * math.sin(i * math.tau / seg), 0)) for i in range(seg)]
    f = t.faces.new(vs)
    for loop in f.loops:
        x, y = loop.vert.co.x, loop.vert.co.y
        loop[ub].uv = (0.5 + (-x if mirror_u else x) / (2 * rad), 0.5 + y / (2 * rad))
    bmesh.ops.transform(t, matrix=Matrix.Translation(c) @ q, verts=t.verts)
    t.normal_update()
    n._emit(t, mat, col, 1.0, 'given', 0.0)


def orient(d):
    return Vector(d).normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()


def chrysanthemum(n, c, d, R, col, rng, petals=10, rings=3, mat='petal', core=(214, 168, 60)):
    """low-poly kiku: rings of curved petals (2 tris each), inner rings shorter/more upright, yellow centre"""
    n.pushm(Matrix.Translation(c) @ orient(d))
    for j in range(rings):
        t = j / max(rings - 1, 1)
        k = max(petals - 2 * j, 6)
        r0 = 0.10 * R
        ln = R * (1.0 - 0.55 * t)
        lift = math.radians(12 + 66 * t)
        cc = tuple(min(255, int(v * (1.0 + 0.08 * t) + 6 * t)) for v in col)
        for i in range(k):
            a = i * math.tau / k + j * 0.4 + rng.uniform(-0.15, 0.15)
            ca, sa = math.cos(a), math.sin(a)
            rad_v = Vector((ca, sa, 0))
            tan_v = Vector((-sa, ca, 0))
            zb = 0.010 * R * j
            base = rad_v * r0 + Vector((0, 0, zb))
            mid = base + rad_v * (ln * 0.5 * math.cos(lift * 0.6)) + Vector((0, 0, ln * 0.5 * math.sin(lift * 0.6)))
            tip = base + rad_v * (ln * math.cos(lift)) + Vector((0, 0, ln * math.sin(lift) - 0.10 * ln * (1 - t)))
            w = 0.19 * ln * (1.0 + rng.uniform(-0.2, 0.2))
            n.poly([base, mid + tan_v * w, tip, mid - tan_v * w], mat, cc, tile=0.1)
    n.ellipsoid((0, 0, 0.02 * R), (0.16 * R, 0.16 * R, 0.10 * R), 'petal', core, 5, 3)
    n.pop()


def stem(n, p0, p1, rad=0.003, col=(70, 100, 50), bend=0.02, seg=4):
    p0, p1 = Vector(p0), Vector(p1)
    mid = (p0 + p1) / 2 + Vector((bend, bend * 0.6, 0))
    pts = [p0, p0.lerp(mid, 0.6), mid, mid.lerp(p1, 0.5), p1]
    n.tube(pts, rad, seg, 'leaf', col, caps=False)


def leaf(n, p, d, ln, wd, col=(58, 98, 44), curl=0.25):
    """serrated-ish kiku leaf as a bent kite"""
    p, d = Vector(p), Vector(d).normalized()
    side = d.cross(Vector((0, 0, 1)))
    if side.length < 1e-4:
        side = Vector((1, 0, 0))
    side.normalize()
    tip = p + d * ln + Vector((0, 0, -curl * ln * 0.3))
    mid = p + d * ln * 0.45 + Vector((0, 0, curl * ln * 0.12))
    n.poly([p, mid + side * wd, tip, mid - side * wd], 'leaf', col, tile=0.1)


def morning_glory(n, p, d, R, col):
    """trumpet bloom: lathe funnel with a rolled lip + star fold lines (8 seg)"""
    n.pushm(Matrix.Translation(p) @ orient(d))
    n.lathe([(0.0, 0.0), (0.004 * R / 0.04, 0.0), (0.008 * R / 0.04, 0.03 * R / 0.04), (0.022 * R / 0.04, 0.052 * R / 0.04), (R, 0.075 * R / 0.04),
             (R * 1.04, 0.078 * R / 0.04), (R * 0.97, 0.078 * R / 0.04), (0.022 * R / 0.04 * 0.9, 0.048 * R / 0.04), (0.004 * R / 0.04, 0.012 * R / 0.04)], 8, 'petal', col, tile=0.1)
    n.cyl((0, 0, 0.055 * R / 0.04), (0, 0, 0.066 * R / 0.04), 0.004, 0.003, 4, 'petal', (240, 236, 210))
    n.pop()


# =====================================================================================
# 9. walls: tokonoma, chigaidana, coat rail, clock, calendar, print, hooks, chest
# =====================================================================================

def kakejiku(n, x, yc, ztop, w=0.44, h=1.22):
    """hanging scroll on the east wall (faces -x): silk mount, ink landscape, ichimonji band, roller with knobs, fuutai, cord + nail"""
    X = x
    fq = lambda org, U, V, mat, col=None, nu=1, nv=1, disp=None: fquad(n, Vector(org) + Vector(U), -Vector(U), V, (-1, 0, 0), mat, col, nu, nv, (None if disp is None else (lambda s, t: disp(1 - s, t))))
    zb = ztop - h
    silk = (74, 92, 82)
    fq((X, yc - w / 2, zb), (0, w, 0), (0, 0, h - 0.05), 'paper', silk, 1, 6, lambda s, t: (-0.0015 * math.sin(s * 3.1) - 0.002 * (1 - t), 0, 0))
    fq((X - 0.008, yc - w / 2, ztop - 0.17), (0, w, 0), (0, 0, 0.12), 'paper', (206, 176, 112))                  # ichimonji band (upper mount)
    fq((X - 0.008, yc - w / 2, zb + 0.03), (0, w, 0), (0, 0, 0.11), 'paper', (206, 176, 112))                    # lower band
    fq((X - 0.012, yc - 0.165, zb + 0.20), (0, 0.33, 0), (0, 0, 0.68), MATS['img_scroll'], None, 1, 1)                          # painting
    n.cyl((X - 0.016, yc - w / 2 - 0.012, zb + 0.004), (X - 0.016, yc + w / 2 + 0.012, zb + 0.004), 0.010, 0.010, 10, 'wood', (90, 60, 40), r=0.0015)
    for s in (-1, 1):
        n.cyl((X - 0.016, yc + s * (w / 2 + 0.012), zb + 0.004), (X - 0.016, yc + s * (w / 2 + 0.030), zb + 0.004), 0.0135, 0.0125, 10, 'lacquer', C_LACQ, r=0.002)
    n.cyl((X - 0.010, yc - w / 2 - 0.006, ztop - 0.005), (X - 0.010, yc + w / 2 + 0.006, ztop - 0.005), 0.007, 0.007, 8, 'wood', (90, 60, 40), r=0.001)
    for s in (-1, 1):
        n.poly([(X - 0.008, yc + s * 0.05, ztop - 0.02), (X - 0.008, yc + s * 0.07, ztop - 0.02), (X - 0.012, yc + s * 0.075 + s * 0.01, ztop - 0.36), (X - 0.012, yc + s * 0.055 + s * 0.01, ztop - 0.36)],
               'cloth', (176, 140, 62), tile=0.12)                     # fuutai (wind bands)
    n.tube([(X - 0.010, yc - w / 2, ztop), (X - 0.014, yc - w / 4, ztop + 0.05), (X - 0.016, yc, ztop + 0.095), (X - 0.014, yc + w / 4, ztop + 0.05), (X - 0.010, yc + w / 2, ztop)],
           0.0016, 4, 'cord', (150, 40, 34), caps=False)
    n.cyl((X + 0.012, yc, ztop + 0.10), (X - 0.010, yc, ztop + 0.10), 0.0028, 0.004, 8, 'brass', (204, 150, 70))           # hook nail


def tokonoma():
    n = Node('UD_Tokonoma', hero='tokonoma + scroll + vase + incense burner', tags='A:period-plausible okidoko-style alcove, invented scroll/ware')
    x0, x1, ya, yb, H = 5.26, 5.82, 2.80, 4.42, 5.25
    yc = (ya + yb) / 2
    zt = ZF + 0.145
    # alcove shell: sand-wall (tsuchi-kabe) back and sides, lowered ceiling board, hanging beam, floor and black-lacquer kamachi
    n.box((5.811, ya, zt), (5.818, yb, H), 'plaster', (178, 150, 118), r=0, tile=0.6)
    for y in (ya - 0.02, yb):
        n.box((x0 + 0.06, y, zt), (x1 - 0.004, y + 0.02, H), 'plaster', (170, 142, 112), r=0, tile=0.6)
    n.box((x0, ya - 0.02, H), (x1, yb + 0.02, H + 0.02), 'wood_raw', (150, 110, 72), r=0.002)
    n.box((x0, ya - 0.02, H - 0.22), (x0 + 0.055, yb + 0.02, H), 'wood', (126, 86, 56), r=0.004, seg=2)
    n.box((x0 + 0.07, ya, ZF), (x1, yb, ZF + 0.135), 'wood', C_DARKWOOD, r=0.002)
    n.box((x0 + 0.07, ya, ZF + 0.135), (x1, yb, zt), 'wood', (168, 120, 78), r=0.002)
    n.box((x0, ya - 0.02, ZF), (x0 + 0.07, yb + 0.02, ZF + 0.16), 'lacquer', C_LACQ, r=0.004, seg=2)
    # tokobashira: natural-log post with bark edges (octagonal prism with irregular chamfers)
    r = 0.058
    pts = [(yb + 0.06 + r * math.cos(a + 0.2 * math.sin(a * 3)) * (1 + 0.06 * math.sin(a * 5)), x0 + 0.06 + r * math.sin(a + 0.2 * math.sin(a * 3))) for a in [i * math.tau / 8 for i in range(8)]]
    n.prism([(p[1], p[0]) for p in pts], ZF, H, 'wood', (138, 96, 62), r=0.004, plane='xy')
    # scroll
    mat_img('scroll', picture('scroll'), rough=0.86)
    kakejiku(n, 5.803, yc + 0.05, 5.00)
    # vase (celadon/teal glaze counter-colour) with a modest kiku arrangement
    rng = random.Random(21)
    vx, vy = 5.50, 3.12
    n.lathe([(0.0, 0.0), (0.050, 0.0), (0.056, 0.012), (0.085, 0.085), (0.098, 0.14), (0.078, 0.21), (0.034, 0.262), (0.031, 0.30), (0.040, 0.318), (0.044, 0.326), (0.040, 0.328),
             (0.030, 0.318), (0.026, 0.30), (0.0, 0.295)], 22, 'glaze', (110, 168, 150), at=(vx, vy, zt))
    n.lathe([(0.046, 0.0), (0.047, 0.004), (0.057, 0.008), (0.056, 0.012)], 22, 'glaze', (92, 140, 126), at=(vx, vy, zt))          # foot ring
    n.lathe([(0.0975, 0.092), (0.0995, 0.097), (0.0995, 0.104), (0.0975, 0.109)], 22, 'glaze', (236, 232, 214), at=(vx, vy, zt))      # raised slip band
    top = Vector((vx, vy, zt + 0.30))
    for k, (dx, dy, h2, tilt, colr, Rr) in enumerate(((0.0, 0.0, 0.40, (0.0, 0.0), (236, 226, 190), 0.048), (0.05, -0.03, 0.30, (0.2, -0.1), (218, 172, 58), 0.042),
                                                        (-0.04, 0.05, 0.27, (-0.2, 0.25), (188, 84, 52), 0.040))):
        p1 = top + Vector((dx * 1.4, dy * 1.4, h2))
        stem(n, top + Vector((dx * 0.1, dy * 0.1, -0.03)), p1, 0.0032, bend=dx * 0.3)
        d = Vector((tilt[0] + dx * 1.3, tilt[1] + dy * 1.3, 1.0))
        chrysanthemum(n, p1 + d.normalized() * 0.01, d, Rr, colr, rng)
        leaf(n, top + Vector((dx * 0.3, dy * 0.3, h2 * 0.35)), (dx + 0.4, dy - 0.3, 0.3), 0.09, 0.028)
        leaf(n, top + Vector((dx * 0.5, dy * 0.5, h2 * 0.55)), (dx - 0.3, dy + 0.4, 0.25), 0.08, 0.025)
    # incense burner (koro): tripod brass bowl with pierced-look band, lid and ash
    bx, by = 5.46, 3.98
    n.lathe([(0.0, 0.0), (0.030, 0.0), (0.036, 0.018), (0.052, 0.042), (0.054, 0.056), (0.050, 0.062), (0.046, 0.058), (0.046, 0.05), (0.0, 0.048)], 18, 'brass', (186, 138, 62), at=(bx, by, zt + 0.03))
    for a in (0.3, 2.4, 4.5):
        n.cyl((bx + 0.028 * math.cos(a), by + 0.028 * math.sin(a), zt + 0.03), (bx + 0.042 * math.cos(a), by + 0.042 * math.sin(a), zt), 0.0055, 0.0075, 6, 'brass', (170, 124, 56))
    n.lathe([(0.0, 0.0), (0.040, 0.0), (0.038, 0.004), (0.0, 0.007)], 14, 'ash', (150, 146, 140), at=(bx, by, zt + 0.074), tile=0.3)
    for k in range(3):
        n.cyl((bx + 0.004 * k, by - 0.004 * k, zt + 0.078), (bx + 0.012 * k + 0.01, by - 0.012 * k + 0.004, zt + 0.15 + 0.01 * k), 0.0011, 0.0011, 4, 'wood_raw', (150, 100, 60))
    return n.finish()


def chigaidana():
    """free-standing staggered-shelf unit with a small cupboard, west wall bay 1 (faces +x)"""
    n = Node('UD_Chigaidana', hero='chigaidana shelf unit + objects', tags='A:period-plausible okidana-type staggered shelf; contents invented')
    x0, dep = 0.18, 0.30
    y0, y1 = 0.60, 1.52
    zb = ZF
    wood = 'wood'
    # lower cupboard carcass (h 0.52) with two sliding doors and a black top rail
    n.box((x0, y0, zb), (x0 + dep, y0 + 0.022, zb + 0.52), wood, (104, 70, 46), r=0.003)
    n.box((x0, y1 - 0.022, zb), (x0 + dep, y1, zb + 0.52), wood, (104, 70, 46), r=0.003)
    n.box((x0, y0, zb + 0.50), (x0 + dep, y1, zb + 0.53), 'lacquer', C_LACQ, r=0.003, seg=2)
    n.box((x0, y0 + 0.022, zb), (x0 + 0.012, y1 - 0.022, zb + 0.50), wood, (104, 70, 46), r=0.002)            # back
    n.box((x0 + 0.012, y0 + 0.022, zb), (x0 + dep - 0.01, y1 - 0.022, zb + 0.03), wood, (90, 60, 40), r=0.002)   # floor
    dw = (y1 - y0 - 0.044) / 2 + 0.012
    for k, (yy, xo) in enumerate(((y0 + 0.022, dep - 0.022), (y0 + 0.022 + dw - 0.024, dep - 0.040))):
        n.box((x0 + xo, yy, zb + 0.035), (x0 + xo + 0.008, yy + dw, zb + 0.49), wood, (150, 110, 74), r=0.002)
        n.box((x0 + xo - 0.001, yy + 0.004, zb + 0.045), (x0 + xo + 0.010, yy + dw - 0.004, zb + 0.06), 'lacquer', C_LACQ, r=0.001)
        n.box((x0 + xo - 0.001, yy + 0.004, zb + 0.465), (x0 + xo + 0.010, yy + dw - 0.004, zb + 0.48), 'lacquer', C_LACQ, r=0.001)
        n.cyl((x0 + xo + 0.010, yy + (0.05 if k == 0 else dw - 0.05), zb + 0.25), (x0 + xo + 0.012, yy + (0.05 if k == 0 else dw - 0.05), zb + 0.25), 0.017, 0.017, 12, 'brass', (186, 140, 64), r=0.001)
    # staggered shelves: left upper (h 1.12) and right lower (h 0.86) on a thin post, small hanging cupboard above the right
    def board(ya, yb, h, col=(150, 108, 72)):
        n.box((x0 + 0.004, ya, zb + h), (x0 + dep, yb, zb + h + 0.022), wood, col, r=0.003, seg=1)
    board(y0, y0 + 0.50, 1.12)
    board(y0 + 0.40, y1, 0.86)
    n.box((x0 + 0.004, y0, zb + 0.53), (x0 + 0.014, y1, zb + 1.72), 'wood_raw', (120, 84, 56), r=0.001)           # back board
    n.box((x0 + 0.05, y0 + 0.44, zb + 0.86 + 0.022), (x0 + 0.062, y0 + 0.456, zb + 1.12), wood, (100, 66, 42), r=0.002)   # post (tsuka)
    cy0, cy1, ch0, ch1 = y0 + 0.44, y1, zb + 1.38, zb + 1.72
    n.box((x0, cy0, ch1 - 0.02), (x0 + dep * 0.85, cy1, ch1), 'lacquer', C_LACQ, r=0.003)
    n.box((x0, cy0, ch0), (x0 + dep * 0.85, cy1, ch0 + 0.02), 'lacquer', C_LACQ, r=0.003)
    n.box((x0, cy0, ch0), (x0 + dep * 0.85, cy0 + 0.018, ch1), wood, (104, 70, 46), r=0.002)
    n.box((x0, cy1 - 0.018, ch0), (x0 + dep * 0.85, cy1, ch1), wood, (104, 70, 46), r=0.002)
    n.box((x0 + dep * 0.8, cy0 + 0.018, ch0 + 0.02), (x0 + dep * 0.81, cy1 - 0.018, ch1 - 0.02), 'paper', (232, 222, 196), r=0.0005)
    n.box((x0 + dep * 0.81, cy0 + 0.018, ch0 + 0.02), (x0 + dep * 0.82, cy1 - 0.018, ch1 - 0.02), 'lacquer', C_LACQ, r=0.0005)   # (frame)
    n.cyl((x0 + dep * 0.82, (cy0 + cy1) / 2, (ch0 + ch1) / 2), (x0 + dep * 0.835, (cy0 + cy1) / 2, (ch0 + ch1) / 2), 0.010, 0.010, 10, 'brass', (186, 140, 64), r=0.0008)
    # objects: books on the cupboard top, lidded jar and folded fan on the upper shelf, tea caddy and cups on the lower shelf, small bell
    zt0 = zb + 0.53
    for k in range(4):
        with n.at((x0 + 0.15 + 0.004 * k, y0 + 0.18 + 0.002 * k, zt0 + 0.029 * k), (0, 0, 0.12 * (k % 2) - 0.05)):
            n.box((-0.11, -0.085, 0), (0.11, 0.085, 0.027), 'paper', [(186, 160, 120), (54, 70, 104), (150, 62, 48), (176, 168, 140)][k], r=0.002, tile=0.3)
            n.box((-0.108, -0.083, 0.002), (0.108, 0.083, 0.004), 'ink', r=0, jitter=0)
    n.lathe([(0.0, 0.0), (0.034, 0.0), (0.046, 0.02), (0.050, 0.06), (0.040, 0.10), (0.036, 0.116), (0.030, 0.119)], 16, 'glaze', (190, 180, 160), at=(x0 + 0.16, y0 + 0.35, zb + 1.142))
    n.lathe([(0.0, 0.118), (0.038, 0.114), (0.040, 0.122), (0.028, 0.132), (0.0, 0.134)], 16, 'glaze', (190, 180, 160), at=(x0 + 0.16, y0 + 0.35, zb + 1.142))
    # folded sensu fan, slightly opened, lying on the shelf
    with n.at((x0 + 0.17, y0 + 0.13, zb + 1.142), (0, 0, 0.35)):
        n.poly([(0, 0, 0.001), (0.17, -0.07, 0.001), (0.17, 0.07, 0.001)], 'paper', (236, 226, 196), tile=0.3)
        for k in range(7):
            a = -0.40 + k * 0.13
            n.cyl((0, 0, 0.003), (0.175 * math.cos(a), 0.175 * math.sin(a), 0.003), 0.0022, 0.0018, 4, 'wood_raw', (120, 84, 50))
    n.lathe([(0.0, 0.0), (0.030, 0.0), (0.036, 0.02), (0.036, 0.07), (0.026, 0.078), (0.028, 0.084), (0.0, 0.086)], 16, 'tin', (196, 170, 96), at=(x0 + 0.16, y0 + 0.78, zb + 0.882))     # tea caddy
    for k in range(2):
        n.lathe([(0.0, 0.0), (0.020, 0.0), (0.030, 0.045), (0.032, 0.050), (0.029, 0.050), (0.0, 0.004)], 14, 'porcelain', None, at=(x0 + 0.17 + 0.03 * k, y0 + 0.54 + 0.015 * k, zb + 0.882), phase=0)
    n.lathe([(0.0, 0.0), (0.027, 0.0), (0.040, 0.012), (0.046, 0.05), (0.030, 0.056), (0.0, 0.02)][::-1][::-1], 14, 'brass', (180, 132, 60), at=(x0 + 0.13, y0 + 0.22, zt0 + 0.12))       # rin (small bell) on books
    return n.finish()


def tansu_chest():
    n = Node('UD_Tansu_Futon', hero='futon chest + folded futon', tags='A:period-plausible tansu; contents invented')
    x0, x1, ya, yb = 5.30, 5.82, 1.42, 2.40
    h = 0.90
    zb = ZF
    n.box((x0, ya, zb + 0.03), (x1, yb, zb + h), 'wood', (122, 82, 54), r=0.004, seg=1)                     # carcass
    n.box((x0 - 0.004, ya - 0.004, zb), (x1, yb + 0.004, zb + 0.05), 'wood', C_DARKWOOD, r=0.004)           # plinth
    n.box((x0 - 0.008, ya - 0.008, zb + h), (x1, yb + 0.008, zb + h + 0.022), 'wood', (98, 66, 44), r=0.004, seg=2)   # top board
    rows = [(0.06, 0.25), (0.26, 0.45), (0.46, 0.65), (0.66, 0.89)]
    for k, (za, zz) in enumerate(rows):
        za, zz = zb + za + 0.004, zb + zz - 0.004
        n.box((x0 - 0.020, ya + 0.012, za), (x0, yb - 0.012, zz), 'wood_raw', (188, 146, 98), r=0.003, tile=0.4)        # drawer front, proud of carcass
        n.box((x0 - 0.020, ya + 0.012, za), (x0 - 0.019, yb - 0.012, zz), 'ink', r=0, jitter=0)                        # gap line
        ym = (ya + yb) / 2
        for s in (-1, 1):                                                    # iron drop handles on plates
            yy = ym + s * 0.22
            n.box((x0 - 0.0225, yy - 0.030, (za + zz) / 2 - 0.022), (x0 - 0.020, yy + 0.030, (za + zz) / 2 + 0.022), 'iron', (52, 48, 46), r=0.001)
            n.tube(ring_pts(0, yy, (za + zz) / 2 - 0.004, 0.0145, 10, 0.0, math.tau * 0.75, 'yz'), 0.0022, 4, 'iron', (52, 48, 46), caps=False)
            screw(n, (x0 - 0.0225, yy - 0.020, (za + zz) / 2 + 0.014), (-1, 0, 0), 0.0024, 'iron', (80, 74, 68), 6)
            screw(n, (x0 - 0.0225, yy + 0.020, (za + zz) / 2 + 0.014), (-1, 0, 0), 0.0024, 'iron', (80, 74, 68), 6)
        n.box((x0 - 0.0225, ym - 0.017, (za + zz) / 2 + 0.05), (x0 - 0.020, ym + 0.017, (za + zz) / 2 + 0.078), 'iron', (52, 48, 46), r=0.0008)   # keyhole shield
    for (yy, zz) in ((ya - 0.004, zb + h + 0.022), (yb + 0.004, zb + h + 0.022)):                               # top corner brackets
        n.box((x0 - 0.010, yy - 0.002, zz - 0.06), (x0 - 0.004, yy + 0.002, zz), 'iron', (52, 48, 46), r=0.0008)
    # folded futon on top: two quilts (slightly askew, different stripe colours) + buckwheat-husk pillow roll
    zt = zb + h + 0.022
    with n.at((x0 + 0.26, (ya + yb) / 2 + 0.01, zt), (0, 0, 0.06)):
        n.box((-0.22, -0.43, 0), (0.22, 0.43, 0.15), 'cloth_bed', (54, 76, 120), r=0.03, seg=2, tile=0.12)
        n.box((-0.20, -0.42, 0.15), (0.20, 0.40, 0.27), 'cloth_bed', (178, 70, 56), r=0.03, seg=2, tile=0.12)
        n.box((-0.222, -0.43, 0.07), (0.222, 0.43, 0.082), 'cloth_bed', (236, 230, 214), r=0.004, tile=0.12)       # white seam band of the folded edge
        n.cyl((0.0, -0.36, 0.30), (0.0, 0.0, 0.30), 0.065, 0.065, 12, 'cloth_bed', (214, 200, 168), r=0.03, tile=0.12)
    return n.finish()


def coat_rail():
    """west wall bay 1, right part: peg rail with an indigo haori (jacket) and a sedge hat; faces +x"""
    n = Node('UD_CoatRail_Haori', hero='coat rail + garment', tags='A:period-plausible Meiji peg rail; garment invented')
    x0 = 0.18
    zr = ZF + 1.44
    n.box((x0, 1.66, zr - 0.05), (x0 + 0.022, 2.40, zr + 0.055), 'wood', (98, 66, 44), r=0.003, seg=2)
    pegs = (1.76, 1.97, 2.18, 2.32)
    for y in pegs:
        n.lathe([(0.0, 0.0), (0.0075, 0.0), (0.0085, 0.05), (0.011, 0.075), (0.016, 0.082), (0.014, 0.092), (0.0, 0.094)], 10, 'wood', (120, 82, 54), at=(x0 + 0.022, y, zr), rot=(0, math.pi / 2, 0))
        screw(n, (x0 + 0.0225, y, zr + 0.032), (1, 0, 0), 0.0024, 'iron', (80, 74, 66), 6)
    # haori hung over two pegs: back panel with gentle vertical folds, two sleeves, inner lining at the parted front, collar band
    xg = x0 + 0.060

    def fold(s, t):
        return (0.022 * math.sin(s * 11.0 + 0.6) * (0.3 + 0.7 * t) + 0.010 * math.sin(s * 23 + t * 3) * t + 0.004, 0, 0)
    fquad(n, (xg, 1.98, zr + 0.02), (0, 0.19, 0), (0, 0, -0.84), (1, 0, 0), 'cloth', (38, 44, 66), 5, 10, fold, normalize_uv=False, tile=0.12)
    fquad(n, (xg, 2.21, zr + 0.02), (0, 0.18, 0), (0, 0, -0.84), (1, 0, 0), 'cloth', (38, 44, 66), 5, 10, lambda s, t: fold(s + 0.4, t), normalize_uv=False, tile=0.12)
    fquad(n, (xg - 0.004, 2.17, zr + 0.02), (0, 0.04, 0), (0, 0, -0.84), (1, 0, 0), 'cloth', (122, 120, 130), 1, 4, lambda s, t: (0.004 * math.sin(t * 6), 0, 0), normalize_uv=False, tile=0.12)   # lining at the parting
    fquad(n, (xg + 0.004, 1.93, zr + 0.02), (0, 0.15, 0), (0, 0, -0.40), (1, 0, 0), 'cloth', (34, 40, 60), 4, 5, lambda s, t: (0.04 * t * (1 - s * 0.3) + 0.02 * math.sin(s * 9), -0.02 * t, -0.05 * t), normalize_uv=False, tile=0.12)   # sleeves
    fquad(n, (xg + 0.004, 2.27, zr + 0.02), (0, 0.14, 0), (0, 0, -0.42), (1, 0, 0), 'cloth', (34, 40, 60), 4, 5, lambda s, t: (0.04 * t + 0.01 * math.sin(s * 8), 0.02 * t, -0.03 * t), normalize_uv=False, tile=0.12)
    fquad(n, (xg + 0.002, 1.98, zr + 0.022), (0, 0.40, 0), (0, 0, -0.06), (1, 0, 0), 'cloth', (90, 92, 108), 10, 1, lambda s, t: (0.005 * math.sin(s * 14), 0, 0), normalize_uv=False, tile=0.12)       # collar
    # sedge hat on the outer peg: shallow cone on a chin cord
    n.lathe([(0.182, 0.0), (0.186, 0.004), (0.180, 0.008), (0.10, 0.030), (0.028, 0.048), (0.0, 0.054), (0.0, 0.050), (0.028, 0.045), (0.10, 0.027), (0.176, 0.004)], 18, 'wood_raw', (194, 170, 104), at=(x0 + 0.105, 1.80, zr - 0.22), rot=(0, math.radians(80), 0), tile=0.3)
    n.tube([(x0 + 0.03, 1.79, zr - 0.04), (x0 + 0.06, 1.80, zr - 0.12), (x0 + 0.105, 1.80, zr - 0.22)], 0.0018, 4, 'cord', (150, 40, 34), caps=False)
    return n.finish()


def wall_clock():
    n = Node('UD_WallClock', hero='hakkake clock with visible pendulum', tags='A:period-plausible Meiji wall clock; generic, no maker marks')
    x0, yc, zc = 0.18, 2.03, 5.30
    zt, zb = zc + 0.20, zc - 0.33
    n.box((x0, yc - 0.135, zb), (x0 + 0.050, yc + 0.135, zt), 'wood', (108, 72, 46), r=0.004, seg=2)                              # case
    n.box((x0 + 0.050, yc - 0.15, zt - 0.02), (x0 + 0.058, yc + 0.15, zt + 0.02), 'wood', (90, 60, 40), r=0.003)                   # pediment cap
    n.box((x0, yc - 0.15, zt + 0.02), (x0 + 0.06, yc + 0.15, zt + 0.044), 'wood', (90, 60, 40), r=0.004, seg=2)
    n.box((x0 + 0.05, yc - 0.15, zb - 0.02), (x0 + 0.06, yc + 0.15, zb + 0.006), 'wood', (90, 60, 40), r=0.003)
    n.box((x0 + 0.05, yc - 0.13, zc - 0.135), (x0 + 0.056, yc + 0.13, zc - 0.128), 'lacquer', C_LACQ, r=0)                         # rail between dial and pendulum
    # dial: enamel disc in a brass bezel, glass, hands (frozen at 4:20 - she stepped out)
    xd = x0 + 0.056
    mat_img('clock', picture('clock'), rough=0.3, spec=0.5, coat=0.3)
    disc(n, (xd + 0.001, yc, zc), (1, 0, 0), 0.098, MATS['img_clock'], None, 36, mirror_u=False)
    n.tube(ring_pts(xd + 0.003, yc, zc, 0.104, 28, 0, math.tau, 'yz'), 0.004, 6, 'brass', (204, 150, 70), caps=False)
    n.tube(ring_pts(xd + 0.001, yc, zc, 0.108, 28, 0, math.tau, 'yz'), 0.002, 4, 'brass', (150, 108, 50), caps=False)
    n.cyl((xd + 0.0045, yc, zc), (xd + 0.0046, yc, zc), 0.098, 0.098, 24, 'glass_clear', (236, 244, 240), caps=(False, True))
    for (ang, L, wd, zoff) in ((math.radians(-130), 0.060, 0.0035, 0.0065), (math.radians(0) + math.radians(120), 0.084, 0.0024, 0.0075)):
        tipy, tipz = yc + L * math.sin(ang), zc + L * math.cos(ang)
        n.poly([(xd + zoff, yc - 0.004 * math.cos(ang), zc + 0.004 * math.sin(ang)), (xd + zoff, yc + 0.004 * math.cos(ang), zc - 0.004 * math.sin(ang)),
                (xd + zoff, tipy, tipz)], 'ink', (16, 14, 14), tile=0.1)
    n.cyl((xd + 0.006, yc, zc), (xd + 0.0085, yc, zc), 0.0055, 0.0045, 10, 'brass', (204, 150, 70))
    # pendulum window: glass, rod and bob (mid-swing), brass key hole stop
    n.box((x0 + 0.050, yc - 0.105, zb + 0.03), (x0 + 0.053, yc + 0.105, zc - 0.14), 'wood', (60, 40, 30), r=0, jitter=0)            # dark interior back
    ang = math.radians(9)
    p0 = Vector((x0 + 0.056, yc, zc - 0.14))
    p1 = p0 + Vector((0, math.sin(ang) * 0.16, -math.cos(ang) * 0.16))
    n.cyl(p0, p1, 0.0016, 0.0016, 4, 'brass', (200, 146, 66))
    n.lathe([(0.0, 0.0), (0.030, 0.0), (0.034, 0.003), (0.030, 0.006), (0.0, 0.007)], 18, 'brass', (214, 160, 76), at=(p1.x, p1.y, p1.z), rot=(0, math.pi / 2, 0))
    n.box((x0 + 0.0565, yc - 0.108, zb + 0.026), (x0 + 0.0585, yc + 0.108, zc - 0.138), 'glass_clear', (236, 244, 240), r=0, jitter=0)
    for s in (-1, 1):
        screw(n, (x0 + 0.0585, yc + s * 0.095, zc - 0.138), (1, 0, 0), 0.0028)
    # hanging loop + nail
    n.tube([(x0 + 0.0, yc - 0.05, zt + 0.044), (x0 + 0.03, yc, zt + 0.07), (x0 + 0.0, yc + 0.05, zt + 0.044)], 0.0015, 4, 'cord', (90, 70, 50), caps=False)
    return n.finish()


def wall_calendar():
    n = Node('UD_WallCalendar', hero='wall calendar (fictional text)', tags='A:period-plausible printed calendar; fictional shop name')
    x, w, h = 3.50, 0.30, 0.46
    y = Y0 + 0.004
    zb, zt = 4.76, 4.76 + h
    mat_img('calendar', picture('calendar'), rough=0.82)
    curl = lambda s, t: (0, 0.014 * smoothstep(0.55, 1.0, s) * smoothstep(0.0, 0.35, 1 - t) + 0.003 * math.sin(t * 7) * (1 - t) * 0, 0)
    fquad(n, (x + w / 2, y, zb), (-w, 0, 0), (0, 0, h), (0, 1, 0), MATS['img_calendar'], None, 6, 8, lambda s, t: (0, 0.012 * smoothstep(0.6, 1.0, s) * smoothstep(0.5, 0.0, t), 0))
    n.box((x - w / 2 - 0.008, y + 0.0, zt), (x + w / 2 + 0.008, y + 0.013, zt + 0.014), 'wood', (60, 40, 30), r=0.002)           # top bar
    n.box((x - w / 2 - 0.008, y + 0.0, zb - 0.014), (x + w / 2 + 0.008, y + 0.013, zb), 'wood', (60, 40, 30), r=0.002)           # bottom weight bar
    n.tube([(x - w / 2 + 0.01, y + 0.006, zt + 0.014), (x, y + 0.008, zt + 0.06), (x + w / 2 - 0.01, y + 0.006, zt + 0.014)], 0.0012, 4, 'cord', (150, 40, 34), caps=False)
    n.cyl((x, y - 0.004, zt + 0.062), (x, y + 0.012, zt + 0.062), 0.0024, 0.0034, 8, 'brass', (204, 150, 70))
    # torn-off leaf stubs: a pad of older months under the current sheet (thin stack on the top bar)
    for k in range(5):
        n.box((x - w / 2, y + 0.001 + 0.0008 * k, zt - 0.03 - 0.002 * k), (x + w / 2, y + 0.0018 + 0.0008 * k, zt), 'paper', (232, 222, 196), r=0.0002, jitter=0.05, tile=0.3)
    return n.finish()


def framed_print():
    n = Node('UD_FramedPrint', hero='framed woodblock-style print', tags='A:period-plausible framed print; generic abstract scene')
    xc, zc = 2.52, 5.06
    w, h, m = 0.56, 0.74, 0.050
    y = Y0 + 0.002
    mat_img('print', picture('print'), rough=0.8)
    fquad(n, (xc + (w / 2 - m), y + 0.022, zc - (h / 2 - m)), (-(w - 2 * m), 0, 0), (0, 0, h - 2 * m), (0, 1, 0), MATS['img_print'], None, 1, 1)
    for (a, b) in (((xc - w / 2, y), (xc + w / 2, y + 0.032)),):
        pass
    n.box((xc - w / 2, y, zc - h / 2), (xc + w / 2, y + 0.034, zc - h / 2 + m), 'lacquer', C_LACQ, r=0.004, seg=2)
    n.box((xc - w / 2, y, zc + h / 2 - m), (xc + w / 2, y + 0.034, zc + h / 2), 'lacquer', C_LACQ, r=0.004, seg=2)
    n.box((xc - w / 2, y, zc - h / 2 + m), (xc - w / 2 + m, y + 0.034, zc + h / 2 - m), 'lacquer', C_LACQ, r=0.004, seg=2)
    n.box((xc + w / 2 - m, y, zc - h / 2 + m), (xc + w / 2, y + 0.034, zc + h / 2 - m), 'lacquer', C_LACQ, r=0.004, seg=2)
    # gilt inner slip and glass with a corner reflection flaw
    n.box((xc - w / 2 + m - 0.004, y + 0.014, zc - h / 2 + m - 0.004), (xc + w / 2 - m + 0.004, y + 0.0185, zc - h / 2 + m), 'brass', (196, 160, 86), r=0.0005)
    n.box((xc - w / 2 + m - 0.004, y + 0.014, zc + h / 2 - m), (xc + w / 2 - m + 0.004, y + 0.0185, zc + h / 2 - m + 0.004), 'brass', (196, 160, 86), r=0.0005)
    n.box((xc - w / 2 + m + 0.0, y + 0.0255, zc - h / 2 + m), (xc + w / 2 - m, y + 0.0262, zc + h / 2 - m), 'glass_clear', (236, 244, 240), r=0, jitter=0)
    n.tube([(xc - w / 2 + 0.05, y + 0.02, zc + h / 2 - 0.004), (xc, y + 0.04, zc + h / 2 + 0.14), (xc + w / 2 - 0.05, y + 0.02, zc + h / 2 - 0.004)], 0.0016, 4, 'cord', (90, 70, 50), caps=False)
    n.cyl((xc, y + 0.0, zc + h / 2 + 0.14), (xc, y + 0.036, zc + h / 2 + 0.14), 0.0024, 0.0034, 8, 'iron', (52, 48, 46))
    return n.finish()


def nageshi_hooks():
    n = Node('UD_NageshiHooks', hero='nageshi hooks: fan, keys, pouch', tags='A:period-plausible hooks + hung goods; invented')
    zn = 5.57
    y = 0.285
    for x in (2.66, 3.32, 5.30):
        n.cyl((x, y, zn), (x, y, zn - 0.020), 0.0042, 0.0042, 8, 'brass', (200, 146, 66), r=0.0005)
        n.tube([(x, y, zn - 0.02), (x, y + 0.012, zn - 0.05), (x, y + 0.024, zn - 0.042), (x, y + 0.028, zn - 0.03)], 0.0026, 5, 'brass', (200, 146, 66), caps=False)
    # uchiwa (round fan): bamboo ribs under paper, handle
    with n.at((2.66, y + 0.028, zn - 0.045), (0, 0, 0)):
        n.tube([(0, 0, 0), (0, 0.004, -0.02)], 0.0015, 4, 'cord', (90, 70, 50), caps=False)
        with n.at((0, 0.006, -0.16), (math.radians(84), 0, 0)):
            disc(n, (0, 0, 0), (0, 0, 1), 0.085, 'paper', (236, 226, 196), 24)
            for k in range(9):
                a = math.radians(-30 + k * 7.5) + math.pi / 2
                n.cyl((0, 0, -0.0012), (0.085 * math.cos(a), 0.085 * math.sin(a), -0.0012), 0.0016, 0.0012, 4, 'wood_raw', (170, 130, 80))
            n.box((-0.006, -0.17, -0.002), (0.006, -0.075, 0.0012), 'wood_raw', (170, 130, 80), r=0.002)
            n.tube(ring_pts(0, 0, 0.0008, 0.085, 24), 0.0016, 4, 'wood_raw', (170, 130, 80), caps=False)
    # key ring with three keys
    kx = 3.32
    n.tube(ring_pts(kx, y + 0.028, zn - 0.085, 0.022, 14, 0, math.tau, 'yz')[:0] or ring_pts(kx, y + 0.028, zn - 0.075, 0.020, 14, 0.0, math.tau, 'xz'), 0.0020, 4, 'brass', (200, 146, 66), caps=False)
    for k, (dx, L) in enumerate(((-0.010, 0.085), (0.0, 0.098), (0.010, 0.078))):
        with n.at((kx + dx, y + 0.028, zn - 0.095), (0, 0, 0)):
            n.box((-0.0025, -0.0012, -L), (0.0025, 0.0012, 0.0), 'iron', (70, 64, 58), r=0.0005)
            n.tube(ring_pts(0, 0, 0.004, 0.0075, 10, 0, math.tau, 'xz'), 0.0016, 4, 'iron', (70, 64, 58), caps=False)
            n.box((0.0, -0.0012, -L), (0.012, 0.0012, -L + 0.014), 'iron', (70, 64, 58), r=0.0004)
    # kinchaku drawstring pouch (indigo) with cord
    px = 5.30
    n.lathe([(0.0, 0.0), (0.030, 0.004), (0.050, 0.030), (0.046, 0.070), (0.028, 0.098), (0.010, 0.110), (0.020, 0.122), (0.008, 0.124)], 12, 'cloth', C_INDIGO, at=(px, y + 0.030, zn - 0.205), tile=0.12)
    n.tube([(px, y + 0.028, zn - 0.03), (px + 0.004, y + 0.032, zn - 0.085), (px, y + 0.030, zn - 0.094)], 0.0018, 4, 'cord', (150, 40, 34), caps=False)
    n.tube(ring_pts(px, y + 0.030, zn - 0.096, 0.012, 10, 0, math.tau, 'xz'), 0.0018, 4, 'cord', (150, 40, 34), caps=False)
    return n.finish()


# =====================================================================================
# 10. ceiling: board skin, pendant, hook + pole with cloths, lantern row
# =====================================================================================

def ceiling_skin():
    n = Node('UD_Ceiling_Skin', tags='A:aged cedar board texture skin under the hybrid ceiling (1 mm below the board, battens stay proud)')
    zc = ZC - 0.0012
    fquad(n, (X0 + 0.06, Y0 + 0.07, zc), (X1 - X0 - 0.12, 0, 0), (0, Y1 - Y0 - 0.13, 0), (0, 0, -1), 'plank', None, 1, 1, tile=0.9, normalize_uv=False)
    return n.finish()


def pendant_lamp():
    n = Node('UD_Pendant_Lamp', hero='pendant: porcelain rose, twisted cord, opal glass shade, bulb', dagger=True, variant='electric pendant (swap: hanging oil lamp)',
             tags='A:period-plausible 1912 electric pendant (dagger: verify date) ; generic, no maker marks')
    cx, cy = 3.0, 2.4
    zc = ZC
    # ceiling rose: porcelain base + cap, brass cord grip, two slotted screws
    n.lathe([(0.0, 0.0), (0.062, 0.0), (0.066, 0.003), (0.066, 0.010), (0.058, 0.019), (0.036, 0.024), (0.0, 0.024)], 20, 'porcelain', (236, 232, 220), at=(cx, cy, zc - 0.024))
    n.lathe([(0.0, 0.0), (0.014, 0.0), (0.016, -0.014), (0.010, -0.020)], 10, 'brass', (204, 150, 70), at=(cx, cy, zc - 0.024))
    for a in (0.0, math.pi):
        screw(n, (cx + 0.046 * math.cos(a), cy + 0.046 * math.sin(a), zc - 0.0245), (0, 0, -1), 0.0035, 'iron', (90, 84, 76), 6)
    # twisted two-strand cloth cord down to the socket
    zs = 5.68
    L = zc - 0.05 - zs
    for ph in (0.0, math.pi):
        pts = []
        for i in range(17):
            t = i / 16
            a = ph + t * 11
            pts.append((cx + 0.0026 * math.cos(a), cy + 0.0026 * math.sin(a), zc - 0.05 - L * t))
        n.tube(pts, 0.0024, 4, 'cord', (96, 76, 46), caps=False, tile=0.04)
    # socket: brass shell, porcelain collar and a small turn-key (raised, knurled look by 10 ribs)
    n.lathe([(0.0, 0.0), (0.019, 0.0), (0.021, 0.008), (0.023, 0.05), (0.020, 0.056), (0.013, 0.062), (0.011, 0.085)], 16, 'brass', (200, 146, 66), at=(cx, cy, zs - 0.058))
    n.lathe([(0.0, 0.0), (0.0235, 0.0), (0.0235, 0.012), (0.019, 0.016)], 16, 'porcelain', (236, 232, 220), at=(cx, cy, zs - 0.060))
    n.cyl((cx + 0.022, cy, zs - 0.03), (cx + 0.036, cy, zs - 0.03), 0.0038, 0.0046, 8, 'brass', (204, 150, 70), r=0.0006)
    n.box((cx + 0.034, cy - 0.011, zs - 0.0355), (cx + 0.042, cy + 0.011, zs - 0.0245), 'brass', (204, 150, 70), r=0.002)
    # opal glass shade: rolled rim, slightly scalloped; clear bulb with filament loop
    zsh = zs - 0.06
    prof_out = [(0.198, -0.181), (0.204, -0.176), (0.198, -0.168), (0.180, -0.140), (0.130, -0.094), (0.078, -0.052), (0.042, -0.020), (0.030, 0.0)]
    prof_in = [(0.026, -0.004), (0.038, -0.020), (0.072, -0.052), (0.124, -0.094), (0.172, -0.140), (0.186, -0.170), (0.192, -0.176), (0.198, -0.181)]
    n.lathe(prof_out + prof_in, 28, 'glass_opal', (240, 232, 214), at=(cx, cy, zsh), tile=0.3)
    n.lathe([(0.030, 0.0), (0.030, 0.012), (0.022, 0.016)], 16, 'brass', (186, 138, 62), at=(cx, cy, zsh))
    n.lathe([(0.0, -0.104), (0.016, -0.098), (0.028, -0.082), (0.030, -0.062), (0.022, -0.028), (0.013, -0.004), (0.0, 0.0)], 14, 'glass_clear', (250, 244, 228), at=(cx, cy, zsh - 0.012))
    n.tube([(cx - 0.004, cy, zsh - 0.022), (cx - 0.008, cy, zsh - 0.060), (cx, cy, zsh - 0.078), (cx + 0.008, cy, zsh - 0.060), (cx + 0.004, cy, zsh - 0.022)], 0.0007, 4, 'bulb', (255, 210, 130), caps=False)
    return n.finish()


def hook_pole_cloths():
    n = Node('UD_DryingPole_Cloths', hero='bamboo drying pole + hanging cloths', tags='A:period-plausible laundry pole on ceiling hooks; cloths invented')
    y = 4.45
    zp = 5.46
    x_a, x_b = 0.40, 3.30
    for x in (0.85, 2.85):
        n.cyl((x, y, ZC), (x, y, ZC - 0.032), 0.0044, 0.0044, 8, 'iron', (52, 48, 46))                # screw eye shank
        n.tube(ring_pts(x, y, ZC - 0.046, 0.016, 10, 0.0, math.tau, 'xz'), 0.0024, 4, 'iron', (52, 48, 46), caps=False)
        n.tube([(x, y - 0.015, ZC - 0.05), (x + 0.004, y - 0.03, zp + 0.06), (x, y - 0.02, zp + 0.012), (x, y + 0.0, zp + 0.022), (x, y + 0.02, zp + 0.012), (x + 0.004, y + 0.03, zp + 0.06), (x, y + 0.015, ZC - 0.05)], 0.0021, 4, 'cord', (150, 130, 96), caps=False, tile=0.04)
    n.cyl((x_a, y, zp), (x_b, y, zp), 0.0135, 0.0115, 12, 'bamboo', (176, 168, 96), r=0.0012)
    for k in range(6):                                                    # bamboo nodes
        xk = x_a + 0.32 + k * 0.47
        n.lathe([(0.0125, 0.0), (0.0155, 0.004), (0.0155, 0.009), (0.0125, 0.013)], 12, 'bamboo', (140, 130, 70), at=(xk, y, zp), rot=(0, math.pi / 2, 0))
    # an indigo yukata (kimono) over the pole, a pale tenugui and a madder-red tenugui
    def garment(x0w, w, hang_f, hang_b, col, colb):
        fquad(n, (x0w, y - 0.012, zp + 0.014), (w, 0, 0), (0, 0, -hang_f), (0, -1, 0), 'cloth', col, 10, 10, lambda s, t: (0, -0.03 * t * (0.4 + 0.6 * math.sin(s * 4.5 + 0.3) ** 2) - 0.006, 0.0), normalize_uv=False, tile=0.12)
        fquad(n, (x0w, y + 0.012, zp + 0.014), (w, 0, 0), (0, 0, -hang_b), (0, 1, 0), 'cloth', colb, 10, 10, lambda s, t: (0, 0.03 * t * (0.4 + 0.6 * math.sin(s * 4.0 + 1.0) ** 2) + 0.006, 0.0), normalize_uv=False, tile=0.12)
        fquad(n, (x0w, y - 0.012, zp + 0.014), (w, 0, 0), (0, 0.024, 0), (0, 0, 1), 'cloth', col, 10, 1, lambda s, t: (0, 0, 0.0), normalize_uv=False, tile=0.12)
    garment(0.50, 0.55, 0.66, 0.70, (78, 96, 134), (72, 90, 128))
    # kimono sleeves dropping at both sides
    for sx, dx in ((0.44, -1), (1.05, 1)):
        fquad(n, (sx, y - 0.010, zp - 0.10), (0.06 * dx, 0, 0), (0, 0, -0.40), (0, -1, 0), 'cloth', (72, 90, 128), 3, 6, lambda s, t: (0.02 * dx * t, -0.012 * t, 0), normalize_uv=False, tile=0.12)
    garment(2.10, 0.33, 0.78, 0.74, (226, 220, 204), (218, 210, 192))
    n.box((2.10, y - 0.040, zp - 0.80), (2.43, y - 0.038, zp - 0.75), 'cloth', (52, 70, 118), r=0.0004, tile=0.12)
    garment(2.56, 0.33, 0.60, 0.64, (150, 54, 44), (140, 50, 42))
    return n.finish()


def lantern_row():
    n = Node('UD_LanternRow', hero='row of festival paper lanterns (receding)', tags='A:period-plausible chochin string for a festival/opening; fictional blank paper (no marks)')
    x = 2.02
    ys = [0.78, 1.55, 2.33, 3.10, 3.88, 4.52]
    zr = ZC - 0.17
    for yy in (0.46, 4.62):
        n.cyl((x, yy, ZC), (x, yy, ZC - 0.05), 0.0042, 0.0042, 8, 'iron', (52, 48, 46))
        n.tube(ring_pts(x, yy, ZC - 0.06, 0.012, 8, 0, math.tau, 'yz'), 0.002, 4, 'iron', (52, 48, 46), caps=False)
        n.tube([(x, yy, ZC - 0.072), (x, yy + (0.012 if yy < 2 else -0.012), zr + 0.012)], 0.0021, 4, 'cord', (150, 130, 96), caps=False, tile=0.04)
    pts = []
    for i in range(25):
        t = i / 24
        pts.append((x, 0.46 + (4.62 - 0.46) * t, zr + 0.012 - 0.035 * math.sin(t * math.pi)))
    n.tube(pts, 0.0028, 5, 'cord', (170, 150, 112), caps=False, tile=0.04)
    rng = random.Random(9)
    for k, yy in enumerate(ys):
        t = (yy - 0.46) / (4.62 - 0.46)
        zt = zr + 0.012 - 0.035 * math.sin(t * math.pi) - 0.045
        s = 1.0 + rng.uniform(-0.06, 0.06)
        n.tube([(x, yy, zt + 0.045), (x, yy, zt + 0.008)], 0.0018, 4, 'cord', (150, 130, 96), caps=False, tile=0.04)
        # bellows body: paper ribs bulging between lacquer rings; slight lean
        with n.at((x, yy, zt), (rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), 0.0)):
            prof = [(0.0, 0.0), (0.040 * s, 0.0), (0.042 * s, -0.012)]
            for r_i in range(5):
                z0 = -0.012 - r_i * 0.028
                prof += [(0.078 * s * (1 - 0.10 * abs(r_i - 2) / 2), z0 - 0.014), (0.056 * s, z0 - 0.028)]
            zend = -0.012 - 5 * 0.028
            prof += [(0.044 * s, zend - 0.004), (0.040 * s, zend - 0.016), (0.0, zend - 0.016)]
            n.lathe(prof[::-1], 10, 'lantern', (250, 232, 196), tile=0.3)
            n.lathe([(0.0395 * s, 0.0), (0.0425 * s, 0.0), (0.0425 * s, -0.014), (0.0395 * s, -0.014)], 12, 'lacquer', C_LACQ)
            n.lathe([(0.0395 * s, zend - 0.002), (0.0425 * s, zend - 0.002), (0.0425 * s, zend - 0.016), (0.0395 * s, zend - 0.016)], 12, 'lacquer', C_LACQ)
            n.tube([(0, 0, zend - 0.016), (0, 0, zend - 0.05)], 0.0018, 4, 'cord', (150, 40, 34), caps=False)
            n.poly([(0.004, 0, zend - 0.05), (-0.004, 0, zend - 0.05), (-0.008, 0, zend - 0.085), (0.008, 0, zend - 0.085)], 'cloth', (150, 40, 34), tile=0.1)   # tassel
    ld = bpy.data.lights.new('UDLamp_lanterns', 'POINT')
    ld.energy = 10
    ld.color = (1.0, 0.64, 0.36)
    ld.shadow_soft_size = 0.3
    lo = bpy.data.objects.new(ld.name, ld)
    bpy.context.scene.collection.objects.link(lo)
    lo.parent = get_group('UD_Lights')
    lo.location = (x, 2.5, zr - 0.3)
    return n.finish()


def west_bay2_goods():
    """west wall bay 2 (y 2.57..4.63): shop signboard + a bracketed shelf of jars and bottles (was bare plaster)"""
    n = Node('UD_WestBay2_Signboard_Shelf', hero='signboard + jar shelf', tags='A:period-plausible shop goods; fictional signboard text')
    x0 = 0.18
    # signboard: lacquered board with painted characters (fictional), hung by two cords from the nageshi
    mat_img('signboard', make_signboard(), rough=0.5, coat=0.3)
    yc, zc = 3.55, 5.12
    w, h = 0.98, 0.30
    fquad(n, (x0 + 0.030, yc - w / 2, zc - h / 2), (0, w, 0), (0, 0, h), (1, 0, 0), MATS['img_signboard'], None, 1, 1)
    n.box((x0 + 0.012, yc - w / 2 - 0.02, zc - h / 2 - 0.02), (x0 + 0.030, yc + w / 2 + 0.02, zc + h / 2 + 0.02), 'wood', (74, 52, 38), r=0.004, seg=2)
    for s in (-1, 1):
        n.tube([(x0 + 0.02, yc + s * w * 0.42, zc + h / 2 + 0.02), (x0 + 0.012, yc + s * w * 0.42, 5.56)], 0.0024, 4, 'cord', (150, 130, 96), caps=False)
    # shelf on two brackets + jars / bottles in a slightly uneven row
    zs = 4.52
    n.box((x0, 2.88, zs), (x0 + 0.22, 4.22, zs + 0.022), 'wood', (98, 66, 44), r=0.003, seg=1)
    for y in (2.95, 4.15):
        n.prism([(0.0, 0.0), (0.0, -0.17), (0.17, 0.0)], y - 0.012, y + 0.012, 'wood', (98, 66, 44), r=0.001, plane='xz') if False else n.box((x0, y - 0.012, zs - 0.16), (x0 + 0.012, y + 0.012, zs), 'wood', (98, 66, 44), r=0.002)
    rng = random.Random(3)
    y = 2.97
    kinds = [('jar', (190, 180, 160)), ('bottle', (70, 120, 90)), ('jar', (120, 70, 50)), ('bottle', (150, 100, 50)), ('jar', (200, 196, 184)), ('jar', (54, 82, 130)), ('bottle', (70, 120, 90))]
    for (k, c) in kinds:
        r = rng.uniform(0.030, 0.042)
        hh = rng.uniform(0.11, 0.17)
        if k == 'jar':
            n.lathe([(0.0, 0.0), (r * 0.8, 0.0), (r, hh * 0.3), (r * 1.05, hh * 0.65), (r * 0.7, hh * 0.92), (r * 0.6, hh), (r * 0.66, hh + 0.012), (0.0, hh + 0.014)], 14, 'glaze', c, at=(x0 + 0.11, y, zs + 0.022))
        else:
            n.lathe([(0.0, 0.0), (r * 0.9, 0.0), (r, hh * 0.45), (r * 0.42, hh * 0.72), (r * 0.36, hh * 1.05), (r * 0.42, hh * 1.1), (r * 0.3, hh * 1.1), (r * 0.3, hh * 0.72), (r * 0.8, hh * 0.45 - 0.004)][:6], 12, 'glaze', c, at=(x0 + 0.11, y, zs + 0.022))
        y += 2 * r + rng.uniform(0.02, 0.06)
    return n.finish()


def make_signboard():
    if 'signboard' in _IMG:
        return _IMG['signboard']
    w, h = 512, 157
    arr = np.zeros((h, w, 3)) + np.array([226, 210, 168]) / 255.0
    arr = arr * (1 + 0.03 * fnoise(1024, 30, 6, 91)[:h, :w, None])
    m = text_mask([dict(text='千客萬来', x=w / 2 - 70, y=h / 2, size=88), dict(text='新榮堂', x=w - 66, y=h / 2, size=50)], w, h)
    arr = arr * (1 - 0.95 * m[..., None]) + np.array([0.05, 0.04, 0.04]) * 0.95 * m[..., None]
    _IMG['signboard'] = make_image('UD_pic_signboard', arr)
    return _IMG['signboard']


# =====================================================================================
# 11. floor story props: tea tray mid-use, ledgers + inkstone
# =====================================================================================

def tea_tray(pos, rot=0.0):
    n = Node('UD_TeaTray', hero='tea tray, mid-use', tags='A:period-plausible tea things; invented arrangement')
    mat('tea', (92, 62, 22), 0.05, coat=0.6, vcol=False)
    with n.at((pos[0], pos[1], ZF), (0, 0, rot)):
        L, Wd = 0.38, 0.26
        n.box((-L / 2, -Wd / 2, 0.0), (L / 2, Wd / 2, 0.012), 'lacquer', (120, 28, 22), r=0.003, seg=2)
        for (a, b) in (((-L / 2, -Wd / 2, 0.012), (L / 2, -Wd / 2 + 0.014, 0.030)), ((-L / 2, Wd / 2 - 0.014, 0.012), (L / 2, Wd / 2, 0.030)),
                       ((-L / 2, -Wd / 2 + 0.014, 0.012), (-L / 2 + 0.014, Wd / 2 - 0.014, 0.030)), ((L / 2 - 0.014, -Wd / 2 + 0.014, 0.012), (L / 2, Wd / 2 - 0.014, 0.030))):
            n.box(a, b, 'lacquer', (36, 20, 16), r=0.0025, seg=2)
        z0 = 0.012
        # kyusu (side-handled clay teapot): body, lid askew with knob, spout, side handle
        px, py = -0.07, 0.0
        n.lathe([(0.0, 0.0), (0.038, 0.0), (0.052, 0.014), (0.058, 0.034), (0.050, 0.056), (0.036, 0.066), (0.030, 0.068)], 20, 'ceramic_unglazed', (158, 82, 56), at=(px, py, z0))
        n.lathe([(0.030, 0.068), (0.034, 0.062), (0.020, 0.054)], 14, 'ceramic_unglazed', (120, 62, 42), at=(px, py, z0))
        with n.at((px + 0.004, py, z0 + 0.068), (0, math.radians(5), 0)):
            n.lathe([(0.0, 0.0), (0.032, 0.0), (0.033, 0.004), (0.026, 0.011), (0.0, 0.013)], 16, 'ceramic_unglazed', (158, 82, 56))
            n.ellipsoid((0, 0, 0.018), (0.008, 0.008, 0.006), 'ceramic_unglazed', (130, 66, 44), 8, 4)
        n.tube([(px + 0.045, py, z0 + 0.028), (px + 0.062, py, z0 + 0.040), (px + 0.078, py, z0 + 0.056)], 0.0105, 8, 'ceramic_unglazed', (158, 82, 56), caps=False, rfun=lambda t: 1 - 0.5 * t)
        n.tube([(px, py - 0.050, z0 + 0.052), (px, py - 0.088, z0 + 0.046), (px, py - 0.098, z0 + 0.024), (px, py - 0.070, z0 + 0.012)], 0.0052, 6, 'ceramic_unglazed', (158, 82, 56), caps=False)
        # two yunomi: one standing, tea left in it; one tipped over mid-pour with a drop on the lacquer
        cup = [(0.0, 0.0), (0.016, 0.0), (0.017, 0.004), (0.030, 0.030), (0.032, 0.062), (0.029, 0.062), (0.0, 0.004)]
        n.lathe([(0.016, 0.0), (0.017, 0.004), (0.030, 0.030), (0.032, 0.062), (0.029, 0.062), (0.027, 0.058), (0.0, 0.006)][::1], 18, 'porcelain', (238, 236, 226), at=(0.07, 0.05, z0))
        n.lathe([(0.0, 0.0), (0.0275, 0.0)], 18, 'tea', (92, 62, 22), at=(0.07, 0.05, z0 + 0.034))
        n.lathe([(0.016, 0.0), (0.0172, 0.0), (0.0172, 0.0035)], 18, 'glaze', (54, 82, 130), at=(0.07, 0.05, z0))
        with n.at((0.045, -0.075, z0 + 0.030), (math.radians(90), 0, math.radians(30))):
            n.lathe([(0.016, 0.0), (0.017, 0.004), (0.030, 0.030), (0.032, 0.062), (0.029, 0.062), (0.027, 0.058), (0.0, 0.006)], 18, 'porcelain', (238, 236, 226))
        n.lathe([(0.0, 0.0), (0.012, 0.0002), (0.010, 0.0007), (0.0, 0.001)], 12, 'tea', (92, 62, 22), at=(0.075, -0.040, z0))
        # wagashi on a small plate: one left, one with a bite taken (cut face visible)
        n.lathe([(0.0, 0.0), (0.040, 0.0), (0.058, 0.010), (0.056, 0.011), (0.038, 0.004), (0.0, 0.003)][::1], 20, 'porcelain', (238, 236, 226), at=(-0.06, 0.085, z0))
        n.ellipsoid((-0.075, 0.085, z0 + 0.020), (0.022, 0.022, 0.014), 'wax', (236, 226, 204), 10, 6)
        n.ellipsoid((-0.040, 0.085, z0 + 0.018), (0.018, 0.020, 0.012), 'wax', (236, 210, 198), 10, 6)
        n.box((-0.046, 0.084, z0 + 0.006), (-0.036, 0.092, z0 + 0.022), 'wax', (170, 62, 54), r=0.002)
        # folded damp cloth (chakin) and a dented tin caddy
        n.box((0.11, -0.11, z0), (0.16, -0.06, z0 + 0.022), 'cloth', (236, 232, 222), r=0.008, seg=2, tile=0.12)
        n.lathe([(0.0, 0.0), (0.028, 0.0), (0.030, 0.004), (0.030, 0.060), (0.024, 0.066), (0.0, 0.066)], 18, 'tin', (196, 172, 100), at=(0.16, 0.06, z0))
    return n.finish()


def ledgers(pos, rot=0.0, dz=0.0):
    n = Node('UD_Ledgers_Inkstone', hero='ledgers + inkstone (writing interrupted)', tags='A:period-plausible daifukucho ledgers; blank except one fictional label')
    mat_img('ledger', picture('ledger'), rough=0.85)
    with n.at((pos[0], pos[1], ZF + dz), (0, 0, rot)):
        cols = [(58, 72, 110), (120, 92, 66), (48, 62, 98), (150, 70, 52), (58, 72, 110)]
        z = 0.0
        for k, c in enumerate(cols):
            with n.at((0.004 * math.sin(k * 2.3), 0.004 * math.cos(k * 1.9), z), (0, 0, 0.08 * math.sin(k * 3.1 + 1))):
                n.box((-0.13, -0.095, 0.0), (0.13, 0.095, 0.034), 'paper', c, r=0.003, tile=0.3)                   # cover
                n.box((-0.128, -0.093, 0.004), (0.128, 0.093, 0.030), 'paper', (232, 222, 196), r=0.001, tile=0.3)      # page block
                n.box((-0.13, -0.095, 0.0), (-0.121, 0.095, 0.034), 'paper', tuple(int(v * 0.8) for v in c), r=0.003, tile=0.3)   # spine band
                for sy in (-0.07, -0.025, 0.025, 0.07):                                 # binding stitches through the spine
                    n.cyl((-0.1255, sy, -0.0006), (-0.1255, sy, 0.0346), 0.0016, 0.0016, 4, 'cloth', (236, 232, 222))
            z += 0.034
        # label strip on the top cover
        fquad(n, (-0.09, -0.016, z + 0.0012), (0.05, 0, 0), (0, 0.11, 0), (0, 0, 1), MATS['img_ledger'], None, 1, 1)
    # inkstone (suzuri) with ink stick and a brush laid across it
    with n.at((pos[0] + 0.34, pos[1] - 0.08, ZF + dz), (0, 0, rot + 0.5)):
        n.box((-0.065, -0.045, 0.0), (0.065, 0.045, 0.030), 'lacquer', C_LACQ, r=0.003, seg=2)
        n.box((-0.052, -0.034, 0.030), (0.052, 0.034, 0.038), 'iron', (44, 44, 48), r=0.002)
        n.lathe([(0.0, 0.0), (0.0230, 0.0), (0.0236, -0.004), (0.0, -0.005)], 14, 'tea', (20, 18, 18), at=(0.022, 0.0, 0.0385))
        n.box((-0.050, 0.004, 0.0382), (0.004, 0.030, 0.0392), 'iron', (36, 36, 40), r=0.0008)
        n.box((-0.040, -0.030, 0.0385), (-0.018, -0.022, 0.048), 'ink', (22, 20, 20), r=0.001)
        n.cyl((-0.11, -0.03, 0.040), (0.13, 0.06, 0.056), 0.0042, 0.0042, 8, 'bamboo', (160, 120, 70), r=0.0008)
        n.cyl((0.09, 0.045, 0.053), (0.165, 0.071, 0.057), 0.0055, 0.0015, 8, 'ink', (20, 18, 18))
    return n.finish()


# =====================================================================================
# 12. window wall: torn shoji, sudare, sun pools
# =====================================================================================

def img_arr_sudare():
    w, h = 1024, 512
    xx = np.arange(w)[None, :]
    yy = np.arange(h)[:, None]
    slat = ((xx % 5.0) < 4.1).astype(np.float32) * np.ones((h, 1))
    thread = (((yy % 128) > 119) | ((yy % 128) < 5)).astype(np.float32)
    alpha = np.clip(slat + thread * 0.9, 0, 1)
    var = 0.10 * fnoise(1024, 140, 6, 72)[:h, :w]
    base = np.stack([0.66 + var, 0.58 + var, 0.34 + var * 0.6], -1)
    base = np.where(thread[..., None] > 0.5, np.array([0.18, 0.13, 0.08]), base)
    return make_image('UD_pic_sudare', np.clip(base, 0, 1), alpha=alpha)


def decal_image(kind):
    key = 'decal_' + kind
    if key in _IMG:
        return _IMG[key]
    w, h = 512, 512
    yy, xx = np.mgrid[0:h, 0:w] / float(w)
    a = np.zeros((h, w), np.float32)
    col = np.array([0.35, 0.26, 0.16])
    if kind == 'stain':
        nz = fnoise(1024, 5, 5, 81)[:h, :w]
        r = np.hypot(xx - 0.45, (yy - 0.55) * 1.3)
        a = smooth01(0.85 - r * 1.6 + 0.35 * nz, 0.0, 0.6)
        ring = np.exp(-((0.85 - r * 1.6 + 0.35 * nz - 0.12) / 0.08) ** 2)
        a = np.clip(0.32 * a + 0.35 * ring, 0, 0.6)
        col = np.array([0.42, 0.30, 0.16])
    elif kind == 'soot':
        nz = fnoise(1024, 3, 40, 82)[:h, :w]
        r = np.abs(xx - 0.5) * 2.2
        a = np.clip((1 - yy) ** 1.4 * np.exp(-r ** 2 * (2.0 + 1.2 * nz)) * 0.75, 0, 0.75)
        col = np.array([0.10, 0.09, 0.08])
    elif kind == 'crack':
        rng = np.random.default_rng(5)
        a = np.zeros((h, w), np.float32)
        x, y = 40.0, 380.0
        for step in range(520):
            x += rng.normal(1.0, 0.8)
            y += rng.normal(-0.35, 1.4)
            xi, yi = int(np.clip(x, 1, w - 2)), int(np.clip(y, 1, h - 2))
            a[yi - 1:yi + 1, xi - 1:xi + 1] = 0.85
            if step % 90 == 45:                   # branch
                bx, by = x, y
                for s2 in range(60):
                    bx += rng.normal(0.7, 0.6)
                    by += rng.normal(-1.0, 0.8)
                    a[int(np.clip(by, 1, h - 2)), int(np.clip(bx, 1, w - 2))] = 0.7
        a = blur(a, 1) * 1.6
        a = np.clip(a, 0, 0.8)
        col = np.array([0.14, 0.11, 0.09])
    elif kind == 'faded':          # lighter rectangle where a picture once hung + 4 nail holes
        a = np.zeros((h, w), np.float32)
        rect = (xx > 0.22) & (xx < 0.78) & (yy > 0.12) & (yy < 0.9)
        a = np.where(rect, 0.22, 0.0).astype(np.float32)
        a = blur(a, 2)
        carr = np.tile(np.array([0.93, 0.89, 0.80]), (h, w, 1))
        for (px, py) in ((0.5, 0.93), (0.27, 0.15), (0.73, 0.15)):
            hole = np.hypot(xx - px, yy - py) < 0.012
            a = np.maximum(a, hole * 0.9).astype(np.float32)
            carr[hole] = (0.10, 0.08, 0.06)
        img = make_image('UD_decal_' + kind, carr, alpha=a)
        _IMG[key] = img
        return img
    elif kind == 'dirt':           # skirting dirt band: strong at the bottom, fading up, patchy
        nz = fnoise(1024, 30, 6, 83)[:h, :w]
        a = np.clip(np.exp(-yy * 6.0) * (0.55 + 0.25 * nz) + 0.05 * np.exp(-yy * 1.5), 0, 0.7)
        col = np.array([0.22, 0.17, 0.12])
    elif kind == 'wear':           # tatami traffic lane (soft darker streak)
        nz = fnoise(1024, 4, 4, 84)[:h, :w]
        a = np.clip(np.exp(-((xx - 0.5) / 0.22) ** 2) * (0.22 + 0.10 * nz), 0, 0.3)
        a *= smooth01(yy, 0.0, 0.25) * smooth01(1 - yy, 0.0, 0.25)
        col = np.array([0.30, 0.26, 0.16])
    elif kind == 'pool':           # soft sun pool through shoji: warm, with kumiko lattice shadow (3 x 6), sash edge
        w2, h2 = 512, 1024
        v = np.linspace(0, 1, h2)[:, None] * np.ones((1, w2))
        u = np.linspace(0, 1, w2)[None, :] * np.ones((h2, 1))
        edge = np.minimum.reduce([u, 1 - u, v * 1.0, 1 - v]) * 14
        a = smooth01(edge, 0.0, 1.0) * 0.72
        # kumiko bars: 3 columns, 6 rows across the window; window spans u:0..1 (1.0 m) and v:0..1 (1.45 m)
        for i in range(1, 3):
            a *= 1 - 0.75 * np.exp(-(((u - i / 3.0) / 0.012) ** 2))
        for j in range(1, 6):
            a *= 1 - 0.75 * np.exp(-(((v - (0.069 + 0.91 * j / 6.0)) / 0.008) ** 2))
        a *= 1 - 0.8 * np.exp(-((u / 0.03) ** 2)) - 0.8 * np.exp(-(((1 - u) / 0.03) ** 2))
        a = np.clip(a, 0, 1) * (0.9 + 0.1 * fnoise(1024, 8, 8, 85)[:h2, :w2])
        img = make_image('UD_decal_pool', np.tile(np.array([1.0, 0.84, 0.58]), (h2, w2, 1)), alpha=np.clip(a, 0, 1).astype(np.float32))
        _IMG[key] = img
        return img
    elif kind == 'spot':           # hard sun spot through the torn pane
        r = np.hypot((xx - 0.5) * 1.0, (yy - 0.5) * 1.0)
        nz = fnoise(1024, 10, 10, 86)[:h, :w]
        a = smooth01(0.42 - r + 0.04 * nz, 0.0, 0.03)
        col = np.array([1.0, 0.92, 0.72])
    img = make_image('UD_decal_' + kind, np.tile(col, (h, w, 1)), alpha=np.clip(a, 0, 1).astype(np.float32))
    _IMG[key] = img
    return img


def window_shoji_tear():
    n = Node('UD_ShojiTear_Patch', hero='slightly torn shoji pane + paste patch', tags='A:invented repair/tear on the hybrid inner shoji (window1, panel x1.485..2.1, y0.30)')
    mat('skyhole', (214, 230, 248), 0.5, emit=(214, 230, 248), emit_strength=5.5, vcol=False)
    y = 0.3042
    cx, cz = 1.793, 4.925
    # jagged hole (window1 shoji cell col1,row3): bright daylight shows through
    pts = []
    rng = random.Random(31)
    for i in range(11):
        a = i * math.tau / 11
        r = (0.052 + 0.020 * math.sin(a * 2.0 + 0.5)) * (1 + rng.uniform(-0.25, 0.2))
        pts.append((cx + r * 0.85 * math.cos(a), y, cz + r * 1.25 * math.sin(a)))
    n.poly(pts, 'skyhole', None, tile=0.3, flip=True)
    # two curled flaps of torn paper at the top edge and left edge (curl toward the room)
    fquad(n, (cx - 0.045, y + 0.0004, cz + 0.060), (0.075, 0, 0), (0, 0, -0.058), (0, 1, 0), 'paper', (242, 234, 210), 5, 5,
          lambda s, t: (0.004 * math.sin(s * 3) * t, 0.020 * t ** 1.8, 0.0), tile=0.5, normalize_uv=False)
    fquad(n, (cx - 0.072, y + 0.0004, cz - 0.05), (0.040, 0, 0), (0, 0, 0.085), (0, 1, 0), 'paper', (238, 230, 206), 3, 5,
          lambda s, t: (0.0, 0.014 * (1 - s) ** 1.5 * t + 0.002, 0.0), tile=0.5, normalize_uv=False)
    # older paste patch (brighter, slightly proud, frayed edge) in the cell below-left
    px, pz = 1.615, 4.48
    fquad(n, (px - 0.085, y + 0.0002, pz - 0.105), (0.17, 0, 0), (0, 0, 0.21), (0, 1, 0), 'paper', (250, 246, 232), 4, 5,
          lambda s, t: (0.0, 0.0012 + 0.0006 * math.sin(s * 9 + t * 5), 0.0), tile=0.5, normalize_uv=False)
    for k in range(6):       # paste brush marks along the patch border
        yy = pz - 0.10 + 0.04 * k
        n.box((px + 0.083, y + 0.0014, yy), (px + 0.0925, y + 0.0020, yy + 0.028), 'paper', (206, 196, 168), r=0.0002, jitter=0.03)
    return n.finish()


def sudare_window2():
    n = Node('UD_Sudare_Window2', hero='half-rolled bamboo blind', tags='A:period-plausible sudare; invented hanging')
    cx, w = 4.50, 1.34
    y = 0.40
    zt = 5.54
    zb = 4.93
    sud = mat_img('sudare', img_arr_sudare(), rough=0.55, alpha=True)
    fquad(n, (cx - w / 2, y, zb), (w, 0, 0), (0, 0, zt - zb), (0, 1, 0), sud, None, 12, 4, lambda s, t: (0, 0.008 * math.sin(s * 7 + t) * (1 - t) + 0.004 * math.sin(s * 19), 0), normalize_uv=True)
    n.box((cx - w / 2 - 0.02, y - 0.015, zt), (cx + w / 2 + 0.02, y + 0.02, zt + 0.055), 'cloth', (48, 52, 70), r=0.004, seg=2, tile=0.12)     # heri (dark cloth band) over the hanging rail
    n.box((cx - w / 2 - 0.03, y - 0.02, zt + 0.055), (cx + w / 2 + 0.03, y + 0.025, zt + 0.078), 'wood', (98, 66, 44), r=0.003, seg=2)
    for x in (cx - w / 2 + 0.02, cx + w / 2 - 0.02):
        n.cyl((x, y, zt + 0.078), (x, y, zt + 0.092), 0.0028, 0.0028, 6, 'brass', (204, 150, 70))
    # rolled-up lower part: sudare rolled on a bamboo core, tied with two red cords that run back up
    with n.at((cx, y + 0.012, zb - 0.045), (0, math.pi / 2, 0)):
        n.cyl((0, 0, -w / 2 - 0.01), (0, 0, w / 2 + 0.01), 0.048, 0.048, 14, 'bamboo', (176, 160, 92), tile=0.3, r=0.0015)
        for zq in (-0.42, 0.42):
            n.tube([(0.0495 * math.cos(a), 0.0495 * math.sin(a), zq) for a in [i * math.tau / 14 for i in range(15)]], 0.0012, 4, 'cord', (150, 40, 34), caps=False)
    for x in (cx - 0.42, cx + 0.42):
        n.tube([(x, y + 0.004, zt - 0.02), (x + 0.003, y + 0.03, zb - 0.0), (x + 0.004, y + 0.05, zb - 0.045), (x, y + 0.04, zb - 0.095), (x - 0.008, y + 0.02, zb - 0.06), (x - 0.004, y + 0.0, zb - 0.0)], 0.0022, 4, 'cord', (150, 40, 34), caps=False, tile=0.04)
    return n.finish()


def sun_decals():
    """fake-but-physical sun pools (sun from the hybrid KEY_sun: elev 18, az 220 => travel d=(.611,.729,-.309))"""
    d = Vector((0.611, 0.729, -0.309))
    nd = Node('UD_SunPool_Decals', hero='sun pools on the tatami (alpha decals, optional until Codex lights)', tags='A:derived from the hybrid sun direction; shoji-diffused pool + hard spot through the tear')
    mat_img('pool', decal_image('pool'), rough=1.0, alpha=True, emit=(255, 210, 140), emit_strength=2.4, double=True)
    mat_img('spot', decal_image('spot'), rough=1.0, alpha=True, emit=(255, 236, 190), emit_strength=3.2, double=True)

    def hit(x, z, yw=0.304):
        t = (z - ZF) / 0.309
        return Vector((x + 0.611 * t, yw + 0.729 * t, ZF + 0.0015))
    # window 1 (x 1.0..2.0, z 4.05..5.32 clipped at the partition): parallelogram on the floor
    z_lo, z_hi = 4.05, 5.32
    a, b, c, dd = hit(1.0, z_lo), hit(2.0, z_lo), hit(1.0, z_hi), hit(2.0, z_hi)
    v_frac = (z_hi - z_lo) / (5.50 - 4.05)
    U, V = b - a, c - a
    # uv: pool texture covers full window height (1.45 m) -> only the lower v_frac of it is used
    nd.patch(a, U, V, 1, 1, MATS['img_pool'], None, None, 1.0, flip=False, normalize_uv=True)
    # rescale v of the last patch: v in 0..v_frac
    nd.bm.verts.ensure_lookup_table()
    uvl = nd.uvl
    for f in nd.bm.faces:
        for loop in f.loops:
            loop[uvl].uv = (loop[uvl].uv[0], loop[uvl].uv[1] * v_frac)
    # hard spot through the tear (hole ~0.11 x 0.15 at x1.793, z4.925)
    p0 = hit(1.738, 4.85)
    p1 = hit(1.848, 4.85)
    p2 = hit(1.738, 5.00)
    nd.patch(p0, p1 - p0, p2 - p0, 1, 1, MATS['img_spot'], None, None, 1.0, normalize_uv=True)
    o = nd.finish()
    return o


def wall_decals():
    n = Node('UD_Wall_Decals', hero='wall wear: stains, soot, crack, faded print ghost, skirting dirt', tags='A:invented wear')
    specs = [
        ('stain', 'decal_stain', (0.181, 0.30, 5.05), (0, 1.1, 0), (0, 0, 0.52), (1, 0, 0)),
        ('soot', 'decal_soot', (5.818, 0.78, 4.08), (0, 0.80, 0), (0, 0, 1.35), (-1, 0, 0)),
        ('crack', 'decal_crack', (5.06, Y0 + 0.002, 4.30), (0.62, 0, 0), (0, 0, 1.20), (0, 1, 0)),
        ('faded', 'decal_faded', (0.181, 3.05, 4.78), (0, 0.55, 0), (0, 0, 0.70), (1, 0, 0)),
        ('dirt_w', 'decal_dirt', (0.1805, 0.30, ZF), (0, 4.4, 0), (0, 0, 0.42), (1, 0, 0)),
        ('dirt_e', 'decal_dirt', (5.8195, 0.30, ZF), (0, 4.4, 0), (0, 0, 0.42), (-1, 0, 0)),
        ('dirt_f', 'decal_dirt', (0.30, Y0 + 0.0015, ZF), (5.4, 0, 0), (0, 0, 0.42), (0, 1, 0)),
    ]
    for nm, key, org, U, V, want in specs:
        mt = mat_img(nm, decal_image(key[6:]), rough=1.0, alpha=True, double=True)
        fquad(n, org, U, V, want, mt, None, 1, 1)
    # tatami traffic lane from the partition opening toward the window, and a sun-faded patch by window 1
    mtw = mat_img('wear', decal_image('wear'), rough=1.0, alpha=True, double=True)
    fquad(n, (2.4, 1.3, ZF + 0.0012), (1.25, 0, 0), (0.3, 3.45, 0), (0, 0, 1), mtw, None, 1, 1)
    return n.finish()


def ceiling_decals():
    n = Node('UD_Ceiling_Decals', hero='ceiling wear: water stain + soot halo around the pendant', tags='A:invented wear')
    zc = ZC - 0.0020
    w, h = 512, 512
    yy, xx = np.mgrid[0:h, 0:w] / float(w)
    r = np.hypot(xx - 0.5, yy - 0.5)
    nz = fnoise(1024, 6, 6, 87)[:h, :w]
    halo = np.clip(np.exp(-(r / (0.24 + 0.03 * nz)) ** 2) * 0.55, 0, 0.6).astype(np.float32)
    mh = mat_img('halo', make_image('UD_decal_halo', np.tile(np.array([0.12, 0.10, 0.08]), (h, w, 1)), alpha=halo), rough=1.0, alpha=True, double=True)
    fquad(n, (3.0 - 0.75, 2.4 - 0.75, zc), (1.5, 0, 0), (0, 1.5, 0), (0, 0, -1), mh, None, 1, 1)
    ms = mat_img('stain_c', decal_image('stain'), rough=1.0, alpha=True, double=True)
    fquad(n, (4.2, 0.5, zc), (1.4, 0, 0), (0, 1.1, 0), (0, 0, -1), ms, None, 1, 1)
    fquad(n, (0.5, 3.4, zc), (1.0, 0, 0), (0, 0.9, 0), (0, 0, -1), ms, None, 1, 1)
    return n.finish()


def chabudai(pos, rot=0.0):
    n = Node('UD_Chabudai', hero='low lacquered table with ledgers', tags='A:period-plausible chabudai; invented')
    with n.at((pos[0], pos[1], ZF), (0, 0, rot)):
        L, Wd, H = 0.92, 0.60, 0.31
        n.box((-L / 2, -Wd / 2, H - 0.03), (L / 2, Wd / 2, H), 'lacquer', (110, 26, 22), r=0.004, seg=2)
        n.box((-L / 2 + 0.03, -Wd / 2 + 0.03, H - 0.075), (L / 2 - 0.03, Wd / 2 - 0.03, H - 0.03), 'wood', (98, 66, 44), r=0.003)       # apron
        for sx in (-1, 1):
            for sy in (-1, 1):
                n.lathe([(0.0, 0.0), (0.022, 0.0), (0.020, 0.004), (0.016, 0.03), (0.020, 0.06), (0.017, 0.12), (0.022, 0.15), (0.026, 0.24), (0.028, 0.27), (0.0, 0.27)],
                        10, 'wood', (98, 66, 44), at=(sx * (L / 2 - 0.06), sy * (Wd / 2 - 0.06), 0.0))
        # ring stain left by a teacup
        n.lathe([(0.033, 0.0), (0.036, 0.0008), (0.0345, 0.0016)], 14, 'tea', (92, 62, 22), at=(0.30, -0.10, H))
    return n.finish()


def cloth_bolt_spread():
    """the half-cut bolt of cotton: unrolled across the tatami toward the mending corner (a receding diagonal), shears + chalk lines"""
    n = Node('UD_ClothBolt_Spread', hero='bolt of cloth unrolled across the tatami', tags='A:period-plausible dry-goods cloth; invented')
    p0 = Vector((1.85, 1.75, ZF))
    p1 = Vector((3.05, 3.35, ZF))
    dirv = (p1 - p0)
    Ln = dirv.length
    dirv.normalize()
    perp = Vector((-dirv.y, dirv.x, 0))
    w = 0.40

    def surf(s, t):
        u = t * Ln
        return (perp.x * 0.0 + 0.012 * math.sin(u * 7.0 + s * 2.0) * perp.x, 0.012 * math.sin(u * 7.0 + s * 2.0) * perp.y, 0.004 + 0.008 * math.sin(u * 11 + s * 5) * (0.5 + 0.5 * math.sin(u * 2.3)))
    org = p0 - perp * (w / 2)
    fquad(n, org, perp * w, dirv * Ln, (0, 0, 1), 'cloth', (214, 168, 110), 4, 30, surf, normalize_uv=False, tile=0.12)
    for sgn in (-1, 1):       # indigo selvedge stripes
        fquad(n, p0 + perp * (sgn * (w / 2 - 0.045)) - perp * 0.012, perp * 0.024, dirv * Ln, (0, 0, 1), 'cloth', (40, 56, 100), 1, 30,
              lambda s, t: (0, 0, surf(0.5, t)[2] + 0.0030), normalize_uv=False, tile=0.12)
    # the roll at the far end: wrapped layers on a card core, tied with a red tape
    c = p1 + dirv * 0.0 + Vector((0, 0, 0.058))
    ang = math.atan2(perp.y, perp.x)
    with n.at((c.x, c.y, c.z), (0, 0, ang)):
        n.pushm(Matrix.Rotation(math.pi / 2, 4, 'Y'))
        n.cyl((0, 0, -w / 2), (0, 0, w / 2), 0.055, 0.055, 20, 'cloth', (226, 214, 184), r=0.004, tile=0.12)
        n.cyl((0, 0, -w / 2 - 0.004), (0, 0, w / 2 + 0.004), 0.016, 0.016, 10, 'wood_raw', (186, 154, 110), r=0.001)
        n.pop()
        n.box((-0.06, -0.008, -0.058), (0.06, 0.008, 0.058), 'cloth', (150, 40, 34), r=0.001, tile=0.12) if False else None
    # chalk marks and a pair of tailor's shears (open) lying on the cloth
    mid = p0.lerp(p1, 0.45)
    with n.at((mid.x, mid.y, ZF + 0.012), (0, 0, ang + 0.4)):
        for sg in (-1, 1):
            with n.at((0, 0, 0), (0, 0, sg * 0.12)):
                n.prism([(-0.02, 0.0), (0.17, sg * 0.004), (0.17, sg * 0.0), (0.0, sg * 0.012)], 0.0 if sg > 0 else 0.003, 0.003 if sg > 0 else 0.006, 'tin', (188, 190, 188), r=0.0004, plane='xy')
                n.tube(ring_pts(-0.05, sg * -0.014, 0.0045 if sg > 0 else 0.0075, 0.022, 12), 0.004, 5, 'iron', (52, 48, 46), caps=False)
        n.cyl((0.05, 0, -0.0005), (0.05, 0, 0.0075), 0.0035, None, 8, 'brass', (190, 140, 66))
    for k in range(4):
        q = p0.lerp(p1, 0.15 + 0.2 * k) + perp * (0.05 - 0.03 * k)
        n.box((q.x - 0.06, q.y - 0.0006, ZF + 0.0128), (q.x + 0.06, q.y + 0.0006, ZF + 0.0134), 'cloth', (244, 242, 236), r=0, jitter=0.02, tile=0.05)
    return n.finish()


# =====================================================================================
# 13. DREAM LAYER: one impossible object per review view + period-flower over-abundance
#     (interior-directive s0.5/0.6, dreamcore-study s3; nothing here is historic; all nodes carry dreamLayer=True)
# =====================================================================================
DREAM_PINKS = [(232, 140, 124), (240, 168, 148), (250, 212, 194), (214, 98, 96), (244, 188, 170), (226, 120, 120)]
DREAM_TEAL = (120, 196, 184)


def dnode(name, key, **kw):
    kw['dreamLayer'] = True
    return Node(name, grp='UD_Dream', dreamObject=key, **kw)


def wire_image():
    if 'wire' in _IMG:
        return _IMG['wire']
    n = 256
    yy, xx = np.mgrid[0:n, 0:n]
    d1 = np.abs(((xx + yy) % 32) - 16) < 2
    d2 = np.abs(((xx - yy) % 32) - 16) < 2
    a = (d1 | d2).astype(np.float32)
    img = make_image('UD_pic_wire', np.tile(np.array([0.30, 0.30, 0.31]), (n, n, 1)), alpha=blur(a, 1) * 1.3)
    _IMG['wire'] = img
    return img


def dream_bed(cx=2.35, cy=3.6):
    n = dnode('UD_Dream_HospitalBed', 'bed', hero='Meiji iron hospital bed on the tatami', tags='A: generic iron hospital bedstead (white enamel), no maker marks')
    L, W = 2.0, 0.92
    hw = W / 2
    wmesh = mat_img('wire', wire_image(), rough=0.5, alpha=True, repeat=True)
    with n.at((cx, cy, ZF)):
        def post(x, y, h):
            n.cyl((x, y, 0.07), (x, y, h), 0.0175, 0.0175, 10, 'enamel', (230, 230, 224), r=0.002)
            n.ellipsoid((x, y, h + 0.022), (0.026, 0.026, 0.026), 'enamel', (232, 232, 226), 10, 6)
            n.lathe([(0.0175, 0.0), (0.024, 0.008), (0.021, 0.02), (0.0175, 0.03)], 10, 'brass', (186, 140, 64), at=(x, y, h - 0.02))   # brass socket ring
            n.lathe([(0.0, 0.0), (0.012, 0.0), (0.014, 0.012), (0.0, 0.03)], 8, 'iron', (50, 48, 46), at=(x, y, 0.07))
            # caster: fork + wheel
            n.box((x - 0.011, y - 0.004, 0.030), (x + 0.011, y + 0.004, 0.075), 'iron', (50, 48, 46), r=0.001)
            n.cyl((x - 0.010, y, 0.026), (x + 0.010, y, 0.026), 0.026, 0.026, 12, 'iron_worn', (80, 76, 70), r=0.002)
        hp, fp = 0.98, 0.70
        for sx in (-1, 1):
            post(sx * hw, L / 2, hp)
            post(sx * hw, -L / 2, fp)
        for (y, h_top, h_low, nb) in ((L / 2, hp - 0.03, 0.56, 10), (-L / 2, fp - 0.03, 0.40, 10)):
            n.cyl((-hw, y, h_top), (hw, y, h_top), 0.0125, 0.0125, 10, 'enamel', (230, 230, 224), caps=(True, True))
            n.cyl((-hw, y, h_low), (hw, y, h_low), 0.0105, 0.0105, 8, 'enamel', (230, 230, 224))
            for k in range(1, nb):
                xb = -hw + W * k / nb
                n.cyl((xb, y, h_low), (xb, y, h_top), 0.0065, 0.0065, 6, 'enamel', (230, 230, 224))
        for sx in (-1, 1):       # side angle rails carrying the spring deck
            n.box((sx * hw - 0.012, -L / 2, 0.40), (sx * hw + 0.012, L / 2, 0.434), 'enamel', (226, 226, 220), r=0.003, seg=1)
        for k in range(0, 5):
            n.box((-hw, -L / 2 + 0.05 + k * 0.475, 0.405), (hw, -L / 2 + 0.065 + k * 0.475, 0.415), 'iron', (60, 58, 56), r=0.0015)
        fquad(n, (-hw + 0.02, -L / 2 + 0.02, 0.425), (W - 0.04, 0, 0), (0, L - 0.04, 0), (0, 0, 1), wmesh, None, 1, 1)
        # mattress with piping, blanket (teal counter-colour) with turned-down sheet, pillow
        n.box((-hw + 0.03, -L / 2 + 0.05, 0.43), (hw - 0.03, L / 2 - 0.05, 0.58), 'cloth_bed', (224, 226, 216), r=0.04, seg=3, tile=0.12)
        n.box((-hw + 0.029, -L / 2 + 0.049, 0.50), (hw - 0.029, L / 2 - 0.049, 0.512), 'cloth_bed', (196, 206, 200), r=0.004, tile=0.12)
        zt = 0.585

        def bl(s, t):
            edge = abs(2 * s - 1)
            drop = 0.21 * smoothstep(0.80, 1.0, edge)
            return (0.06 * math.copysign(smoothstep(0.80, 1.0, edge), 2 * s - 1) * 0 , 0.0, -drop + 0.012 * math.sin(t * 9 + s * 4) * (1 - edge) + 0.006 * math.sin(s * 25))
        fquad(n, (-hw - 0.02, -L / 2 + 0.03, zt), (W + 0.04, 0, 0), (0, 1.25, 0), (0, 0, 1), 'cloth_bed', (96, 168, 158), 14, 16, bl, normalize_uv=False, tile=0.14)
        fquad(n, (-hw + 0.04, -L / 2 + 1.25 + 0.01, zt + 0.006), (W - 0.08, 0, 0), (0, 0.22, 0), (0, 0, 1), 'cloth_bed', (238, 236, 228), 8, 4,
              lambda s, t: (0, 0, 0.018 * math.sin(s * 5) * (0.3 + t) + 0.01 * t), normalize_uv=False, tile=0.14)
        pillow(n, 0.0, 0.72, 0.56, 0.36, 0.11, (240, 236, 226), 'cloth_bed', nx=10, dent=(0.0, 0.0, 0.03, 0.12), zb=0.585 - ZF + ZF, tile=0.12)
    return n.finish()


def dream_rabbit(x=2.05, y=2.86, z=0.845):
    n = dnode('UD_Dream_RabbitStatue', 'rabbit', hero='white rabbit statue on the shop counter', tags='A: porcelain garden-ornament rabbit (animal, no person-like figure)')
    mat('pink_glaze', (238, 160, 160), 0.12, coat=0.4, vcol=False)
    W = (242, 240, 232)
    with n.at((x, y, z), (0, 0, 0.0)):
        n.lathe([(0.0, 0.0), (0.135, 0.0), (0.142, 0.006), (0.138, 0.018), (0.126, 0.022), (0.0, 0.022)], 24, 'porcelain_plain', (232, 228, 218))
        zb = 0.022
        E = lambda c, r, rot=(0, 0, 0), m='porcelain_plain', col=W, s=14, rg=9: n.ellipsoid((c[0], c[1], c[2] + zb), r, m, col, s, rg, rot=rot)
        E((0, -0.012, 0.115), (0.092, 0.135, 0.108), (-0.30, 0, 0))                       # body
        E((-0.078, -0.055, 0.075), (0.056, 0.092, 0.075))                                 # haunches
        E((0.078, -0.055, 0.075), (0.056, 0.092, 0.075))
        E((0.0, 0.078, 0.150), (0.060, 0.062, 0.095), (-0.15, 0, 0))                      # chest
        E((0.0, 0.112, 0.262), (0.052, 0.066, 0.058))                                      # head
        E((0.0, 0.172, 0.250), (0.027, 0.032, 0.025))                                      # muzzle
        for s in (-1, 1):
            E((s * 0.024, 0.090, 0.356), (0.017, 0.013, 0.088), (0.22, -s * 0.16, 0), s=10, rg=8)           # ears
            E((s * 0.023, 0.099, 0.356), (0.008, 0.005, 0.070), (0.22, -s * 0.16, 0), 'pink_glaze', (238, 160, 160), 8, 6)
            E((s * 0.038, 0.142, 0.278), (0.0085, 0.0085, 0.0085), (0, 0, 0), 'glaze', (16, 14, 14), 8, 6)       # eyes
            E((s * 0.034, 0.145, 0.045), (0.015, 0.045, 0.014))                                             # forepaws
            E((s * 0.070, 0.02, 0.012), (0.03, 0.055, 0.014))                                               # hind feet
        E((0.0, 0.198, 0.252), (0.008, 0.007, 0.007), (0, 0, 0), 'pink_glaze', (238, 160, 160), 8, 6)
        E((0.0, -0.150, 0.095), (0.034, 0.034, 0.034), (0, 0, 0), 'porcelain_plain', W, 10, 7)                   # tail
        # a hairline crack and a glaze chip on the plinth (imperfection)
        n.box((0.05, 0.10, 0.0219), (0.085, 0.104, 0.0226), 'ink', (60, 52, 46), r=0, jitter=0)
    return n.finish()


def dream_balloon(name, p, tie, r=0.175):
    n = dnode(name, 'balloon', dagger=True, variant='rubber toy balloon (swap: paper or silk balloon)', hero='red balloon tethered', tags='A: rubber toy balloon (dagger: verify 1912 Osaka); string tied to a fixture')
    p, tie = Vector(p), Vector(tie)
    n.ellipsoid(p, (r, r, r * 1.2), 'latex', None, 24, 14, rot=(0.0, 0.0, 0.0))
    n.lathe([(0.0, 0.0), (0.012, 0.0), (0.016, -0.012), (0.008, -0.022), (0.0, -0.022)][::-1], 10, 'latex', None, at=(p.x, p.y, p.z - r * 1.2 - 0.004))   # knot
    bot = Vector((p.x, p.y, p.z - r * 1.2 - 0.028))
    pts = []
    for i in range(14):
        t = i / 13
        q = bot.lerp(tie, t)
        q.z -= 0.05 * math.sin(t * math.pi) * 0.4
        q.x += 0.06 * math.sin(t * math.pi * 2.0) * (1 - t)
        pts.append(q)
    n.tube(pts, 0.0013, 4, 'cord', (236, 226, 204), caps=True, tile=0.05)
    n.ellipsoid(tie, (0.006, 0.006, 0.006), 'cord', (236, 226, 204), 6, 4)
    return n.finish()


def dream_phonograph(x=2.56, y=0.66):
    n = dnode('UD_Dream_Phonograph', 'phonograph', dagger=True, variant='cylinder phonograph (swap: hand-cranked music box / hand bell)',
              hero='phonograph by the window', tags='A: generic horn phonograph (dagger: verify 1912 Osaka); no maker marks')
    with n.at((x, y, ZF), (0, 0, 0.0)):
        # low stand
        for sx in (-1, 1):
            for sy in (-1, 1):
                n.box((sx * 0.20 - 0.022, sy * 0.15 - 0.022, 0.0), (sx * 0.20 + 0.022, sy * 0.15 + 0.022, 0.42), 'wood', C_DARKWOOD, r=0.004)
        n.box((-0.24, -0.19, 0.42), (0.24, 0.19, 0.45), 'wood', (96, 66, 44), r=0.004, seg=2)
        n.box((-0.21, -0.16, 0.20), (0.21, 0.16, 0.215), 'wood', (96, 66, 44), r=0.003)
        z0 = 0.45
        # oak case with raised lid rim and brass corner screws
        n.box((-0.17, -0.11, z0), (0.17, 0.11, z0 + 0.105), 'wood', (150, 106, 66), r=0.004, seg=2)
        n.box((-0.175, -0.115, z0 + 0.095), (0.175, 0.115, z0 + 0.108), 'wood', (120, 84, 54), r=0.003, seg=2)
        for sx in (-1, 1):
            for sy in (-1, 1):
                screw(n, (sx * 0.16, sy * 0.105, z0 + 0.108), (0, 0, 1), 0.0028)
        # mandrel with a wax cylinder (cream), two brass bearings, feed screw; reproducer on a crane arm
        n.cyl((-0.085, 0.0, z0 + 0.135), (0.085, 0.0, z0 + 0.135), 0.034, 0.034, 18, 'wax', (224, 206, 166), r=0.002)
        for s in (-1, 1):
            n.box((s * 0.095 - 0.008, -0.02, z0 + 0.108), (s * 0.095 + 0.008, 0.02, z0 + 0.150), 'brass', (200, 146, 66), r=0.002)
        n.cyl((-0.10, 0.0, z0 + 0.135), (0.10, 0.0, z0 + 0.135), 0.004, 0.004, 6, 'iron_worn', (110, 104, 96))
        n.cyl((-0.085, -0.055, z0 + 0.108), (0.085, -0.055, z0 + 0.108), 0.005, 0.005, 6, 'brass', (200, 146, 66))
        n.lathe([(0.0, 0.0), (0.014, 0.0), (0.016, 0.012), (0.010, 0.022)], 10, 'brass', (200, 146, 66), at=(0.0, 0.0, z0 + 0.17))
        n.tube([(0.0, 0.0, z0 + 0.19), (-0.03, -0.03, z0 + 0.22), (-0.07, -0.06, z0 + 0.23)], 0.006, 6, 'brass', (200, 146, 66))
        # horn: brass flared trumpet on a bent crane, bell toward the window, seam line
        hp = Vector((-0.07, -0.06, z0 + 0.23))
        ang = math.radians(28)
        dirv = Vector((-0.6, -0.12, 0.8))
        n.pushm(Matrix.Translation(hp) @ orient(dirv))
        prof = [(0.008, 0.0)]
        for i in range(1, 15):
            t = i / 14
            prof.append((0.008 + 0.145 * (t ** 2.6), 0.40 * t))
        prof.append((0.160, 0.402))
        prof.append((0.152, 0.402))
        prof += [(0.008 + 0.145 * ((1 - i / 14) ** 2.6) - 0.004 * (1 - i / 14), 0.40 * (1 - i / 14)) for i in range(0, 15)]
        n.lathe(prof, 20, 'brass', (204, 152, 72), tile=0.5)
        n.lathe([(0.152, 0.398), (0.162, 0.400), (0.162, 0.408), (0.152, 0.408)], 20, 'brass', (186, 138, 62))      # rolled bell lip
        n.pop()
        # crank handle on the right side
        n.cyl((0.17, 0.0, z0 + 0.06), (0.215, 0.0, z0 + 0.06), 0.005, 0.005, 6, 'iron_worn', (110, 104, 96))
        n.tube([(0.215, 0.0, z0 + 0.06), (0.215, 0.0, z0 + 0.02), (0.232, 0.0, z0 + 0.02)], 0.004, 6, 'iron_worn', (110, 104, 96))
        n.cyl((0.232, 0.0, z0 + 0.02), (0.262, 0.0, z0 + 0.02), 0.009, 0.007, 8, 'wood', (90, 60, 40), r=0.002)
    return n.finish()


# ---- flowers ------------------------------------------------------------------------------------
def bloom_cloud(n, pts, rng, size=0.075, pal=DREAM_PINKS, petals=10, rings=3, up=0.5, leaves=0.3):
    for (p, nrm) in pts:
        d = Vector(nrm) * (1 - up) + Vector((0, 0, 1)) * up
        d.normalize()
        chrysanthemum(n, p, d, size * rng.uniform(0.75, 1.25), rng.choice(pal), rng, petals=petals, rings=rings)
        if rng.random() < leaves:
            leaf(n, p - d * 0.03, (rng.uniform(-1, 1), rng.uniform(-1, 1), 0.3), 0.07, 0.022)


def dream_flowers_tokonoma():
    n = dnode('UD_Dream_Flowers_Tokonoma', 'flowers', hero='chrysanthemums + irises + morning glory spilling from the tokonoma', tags='A: period species (kiku, asagao, ayame), impossible quantity')
    rng = random.Random(77)
    path = [(5.50, 3.12, 3.86), (5.47, 3.24, 3.70), (5.42, 3.42, 3.62), (5.34, 3.55, 3.58), (5.22, 3.60, 3.50), (5.05, 3.52, 3.48), (4.88, 3.40, 3.47)]
    pts = []
    for i in range(len(path) - 1):
        a, b = Vector(path[i]), Vector(path[i + 1])
        for k in range(9):
            q = a.lerp(b, rng.random()) + Vector((rng.uniform(-0.13, 0.13), rng.uniform(-0.15, 0.15), rng.uniform(0.0, 0.09)))
            q.z = max(q.z, ZF + 0.03 + (0.145 if q.x > 5.27 else 0.0))
            nrm = (rng.uniform(-0.6, 0.3), rng.uniform(-0.6, 0.6), 1.0)
            pts.append((q, nrm))
    for k in range(24):      # the platform itself, and the kamachi edge, heaped
        q = Vector((rng.uniform(5.30, 5.72), rng.uniform(2.90, 4.32), ZF + 0.16 + rng.uniform(0.0, 0.12)))
        pts.append((q, (rng.uniform(-0.5, 0.3), rng.uniform(-0.5, 0.5), 1.0)))
    for k in range(40):      # heaped on the tatami in front of the alcove
        pts.append((Vector((rng.uniform(4.72, 5.24), rng.uniform(2.45, 4.50), ZF + 0.025 + rng.uniform(0, 0.13))), (rng.uniform(-0.8, 0.3), rng.uniform(-0.6, 0.6), 1.0)))
    bloom_cloud(n, pts, rng, 0.125, petals=10, up=0.55, leaves=0.25)
    # irises at the foot of the alcove: clumps of sword leaves and violet-teal flowers
    for (ix, iy) in ((5.08, 2.72), (4.98, 3.96), (5.14, 4.22), (4.92, 2.92), (5.05, 4.05)):
        iris_clump(n, (ix, iy, ZF), rng)
    # morning-glory vine up the tokobashira and along the hanging beam (otoshigake), trumpets toward the room
    vine(n, [(5.30, 4.52, ZF + 0.02), (5.27, 4.50, ZF + 0.6), (5.30, 4.46, ZF + 1.2), (5.27, 4.40, ZF + 1.8), (5.28, 4.0, 5.06), (5.27, 3.5, 5.03), (5.28, 3.0, 5.05)], rng, 0.18)
    return n.finish()


def iris_clump(n, c, rng, stalks=3):
    c = Vector(c)
    for k in range(5):      # sword leaves
        a = rng.uniform(0, math.tau)
        d = Vector((math.cos(a) * 0.12, math.sin(a) * 0.12, 1.0)).normalized()
        ln = rng.uniform(0.32, 0.50)
        w = 0.014
        side = d.cross(Vector((0, 0, 1)))
        side = side.normalized() if side.length > 1e-4 else Vector((1, 0, 0))
        pts = [c + Vector((0, 0, 0)), c + d * ln * 0.35 + side * 0, c + d * ln * 0.7 + Vector((math.cos(a) * 0.05, math.sin(a) * 0.05, 0)), c + d * ln + Vector((math.cos(a) * 0.12, math.sin(a) * 0.12, -0.04))]
        n.poly([pts[0] - side * w, pts[1] - side * w * 0.8, pts[2], pts[3], pts[2] + side * 0.0, pts[1] + side * w * 0.8, pts[0] + side * w][:4] + [pts[0] + side * w], 'leaf', (70, 120, 96), tile=0.1)
    for k in range(stalks):
        h = rng.uniform(0.40, 0.62)
        top = c + Vector((rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), h))
        n.tube([c, c + Vector((0, 0, h * 0.5)), top], 0.0035, 4, 'leaf', (80, 128, 100), caps=False)
        col = rng.choice([(96, 140, 176), (130, 120, 190), (118, 196, 184)])
        for j in range(3):   # standards (upright) and falls (drooping)
            a = j * math.tau / 3 + rng.uniform(-0.2, 0.2)
            r = Vector((math.cos(a), math.sin(a), 0))
            n.poly([top, top + r * 0.012 + Vector((0, 0, 0.03)), top + r * 0.02 + Vector((0, 0, 0.075)), top - r * 0.012 + Vector((0, 0, 0.03))][::1] if False else
                   [top + r.cross(Vector((0, 0, 1))) * 0.012, top + Vector((0, 0, 0.07)) + r * 0.01, top - r.cross(Vector((0, 0, 1))) * 0.012], 'petal', col, tile=0.1)
            aa = a + math.pi / 3
            rr = Vector((math.cos(aa), math.sin(aa), 0))
            tn = rr.cross(Vector((0, 0, 1)))
            n.poly([top + tn * 0.008, top + rr * 0.05 + tn * 0.022 + Vector((0, 0, -0.03)), top + rr * 0.065 + Vector((0, 0, -0.045)), top + rr * 0.05 - tn * 0.022 + Vector((0, 0, -0.03)), top - tn * 0.008], 'petal', tuple(int(v * 0.85) for v in col), tile=0.1)


def vine(n, pts, rng, density=0.15, glory=(92, 104, 196)):
    pts = [Vector(p) for p in pts]
    # densify along the polyline with a little waviness
    dense = []
    for i in range(len(pts) - 1):
        seg = pts[i + 1] - pts[i]
        m = max(2, int(seg.length / 0.12))
        for k in range(m):
            t = k / m
            dense.append(pts[i].lerp(pts[i + 1], t) + Vector((rng.uniform(-0.012, 0.012), rng.uniform(-0.012, 0.012), rng.uniform(-0.01, 0.01))))
    dense.append(pts[-1])
    n.tube(dense, 0.0028, 4, 'leaf', (74, 112, 60), caps=False)
    last = -1.0
    acc = 0.0
    for i, p in enumerate(dense[:-1]):
        d = (dense[i + 1] - p).normalized()
        if rng.random() < 0.7:
            s = rng.choice((-1, 1))
            side = d.cross(Vector((1, 0, 0)))
            side = side.normalized() if side.length > 1e-4 else Vector((0, 1, 0))
            base = p + side * 0.004 * s
            tipd = (side * s * 0.7 + Vector((0, 0, -0.3)) + d * 0.2).normalized()
            wd = rng.uniform(0.028, 0.04)
            tip = base + tipd * wd * 2.2
            n.poly([base, base + side * s * wd * 0.6 + tipd * wd * 0.6 - side.cross(d) * wd * 0.5, tip, base + side * s * wd * 0.6 + tipd * wd * 0.6 + side.cross(d) * wd * 0.5], 'leaf', (62 + rng.randint(-8, 10), 108 + rng.randint(-10, 10), 52), tile=0.1)
        acc += (dense[i + 1] - p).length
        if acc > 1.0 / max(density * 6.0, 0.001) and rng.random() < 0.8:
            acc = 0
            outd = Vector((0.3 * rng.uniform(-1, 1), 1.0 if p.y < 4.3 else -0.3, 0.25 + 0.2 * rng.uniform(-1, 1)))
            morning_glory(n, p + Vector((0, 0.01, 0)), outd.normalized(), rng.uniform(0.032, 0.048), rng.choice([glory, (150, 120, 210), (226, 130, 150), (92, 104, 196)]))


def dream_flowers_window():
    n = dnode('UD_Dream_Flowers_Window', 'flowers', hero='morning-glory over-growth on the window wall', tags='A: period species (asagao), impossible quantity')
    rng = random.Random(51)
    vine(n, [(2.26, 0.36, ZF + 0.02), (2.24, 0.34, ZF + 0.6), (2.23, 0.33, ZF + 1.2), (2.21, 0.32, ZF + 1.75), (2.30, 0.33, 5.52), (2.7, 0.33, 5.50), (3.15, 0.33, 5.52), (3.5, 0.33, 5.49), (3.8, 0.35, 5.50)], rng, 0.2)
    vine(n, [(0.92, 0.33, ZF + 0.02), (0.90, 0.32, ZF + 1.0), (0.90, 0.33, ZF + 1.75), (0.86, 0.33, 5.50)], rng, 0.2, (226, 130, 150))
    # tendrils dropping from the nageshi over the window
    for x in (2.45, 2.85, 3.3, 3.6, 4.0):
        vine(n, [(x, 0.33, 5.52), (x + rng.uniform(-0.04, 0.04), 0.35, 5.25), (x + rng.uniform(-0.05, 0.05), 0.38, 4.95), (x + rng.uniform(-0.05, 0.05), 0.42, 4.72)], rng, 0.3)
    # flowers heaped around the phonograph stand
    pts = []
    for k in range(18):
        a = rng.uniform(0, math.tau)
        q = Vector((2.56 + math.cos(a) * rng.uniform(0.25, 0.42), 0.66 + math.sin(a) * rng.uniform(0.22, 0.35), ZF + 0.04 + rng.uniform(0.0, 0.10)))
        pts.append((q, (math.cos(a), math.sin(a), 1.2)))
    for k in range(14):      # drift of petals-and-blooms under window 1
        pts.append((Vector((rng.uniform(0.75, 2.2), rng.uniform(0.40, 0.85), ZF + 0.03 + rng.uniform(0, 0.10))), (rng.uniform(-0.4, 0.4), 0.8, 1.0)))
    bloom_cloud(n, pts, rng, 0.11, up=0.5)
    return n.finish()


def flower_pot(n, c, r, h, col, rng, blooms=5, pal=DREAM_PINKS):
    c = Vector(c)
    n.lathe([(r * 0.62, 0.0), (r * 0.78, 0.01), (r, 0.42 * h), (r * 1.08, h * 0.9), (r * 1.1, h), (r * 1.0, h), (r * 0.92, h * 0.96), (r * 0.9, h * 0.88)], 14, 'glaze', col, at=c)
    n.lathe([(0.0, 0.0), (r * 0.9, 0.0)], 14, 'soil', None, at=(c.x, c.y, c.z + h * 0.9))
    pts = []
    for k in range(blooms):
        a = rng.uniform(0, math.tau)
        rr = rng.uniform(0.0, r * 0.8)
        q = c + Vector((math.cos(a) * rr, math.sin(a) * rr, h + 0.05 + rng.uniform(0, 0.12) + 0.05 * (1 - rr / r)))
        pts.append((q, (math.cos(a) * 0.5, math.sin(a) * 0.5, 1.0)))
    bloom_cloud(n, pts, rng, 0.11, pal, petals=10, rings=3, up=0.45, leaves=0.3)


def dream_flowers_shop():
    n = dnode('UD_Dream_Flowers_ShopFloor', 'flowers', hero='receding row of flower pots along the shop floor (over-abundance)', tags='A: period species (kiku); impossible quantity')
    rng = random.Random(13)
    cols = [(58, 150, 138), (214, 120, 100), (232, 196, 170), (58, 150, 138)]
    for i, y in enumerate([1.25, 1.75, 2.25, 2.75, 3.25, 3.75, 4.25, 4.75]):
        s = 1.15 + 0.05 * i
        flower_pot(n, (4.62 + 0.05 * math.sin(i * 1.7), y, 0.0), 0.12 * s, 0.22 * s, cols[i % 4], rng, blooms=5)
    for (ix, iy) in ((1.0, 5.25), (1.6, 5.3), (2.3, 5.26), (3.0, 5.3), (3.6, 5.27)):
        iris_clump(n, (ix, iy, 0.0), rng, stalks=3)
    # heaped blooms along the raised-room step
    pts = []
    for k in range(12):
        q = Vector((rng.uniform(0.6, 3.9), rng.uniform(5.32, 5.52), rng.uniform(0.18, 0.46)))
        pts.append((q, (0.0, -1.0, 0.8)))
    bloom_cloud(n, pts, rng, 0.11, up=0.35)
    return n.finish()


def dream_flowers_hanging():
    n = dnode('UD_Dream_Flowers_ShopHanging', 'flowers', hero='hanging clusters of kiku + asagao from the shop beams', tags='A: period species; impossible quantity')
    rng = random.Random(29)
    for (x, y) in ((2.6, 1.6), (3.3, 2.1), (2.2, 4.0), (4.4, 3.0), (1.4, 1.4)):
        z = 2.78 + rng.uniform(-0.05, 0.08)
        top = Vector((x, y, 3.25))
        n.tube([top, Vector((x, y, (z + 3.25) / 2)), Vector((x + 0.01, y, z + 0.1))], 0.003, 4, 'cord', (150, 130, 96), caps=False)
        pts = []
        for k in range(7):
            q = Vector((x + rng.uniform(-0.16, 0.16), y + rng.uniform(-0.16, 0.16), z + rng.uniform(-0.12, 0.05)))
            pts.append((q, ((q.x - x) * 3, (q.y - y) * 3, -0.6)))
        bloom_cloud(n, pts, rng, 0.11, up=-0.2, leaves=0.3)
        vine(n, [(x, y, z), (x + 0.05, y + 0.04, z - 0.3), (x - 0.03, y - 0.02, z - 0.6)], rng, 0.4)
    return n.finish()


# =====================================================================================
# 9. review harness: loads the frozen hybrid READ-ONLY (exec of build.py up to its camera block), applies the
#    add-on, renders 1280x720 with the hybrid's own cameras/lights/world, writes only into ./renders
# =====================================================================================
# faces of Hybrid_Sonnet_upper that the add-on replaces (every vertex of the face inside the box); see MERGE.md
HIDE_UPPER = [
    ('sonnet chabudai + tea set', (2.45, 1.93, 3.49), (3.55, 2.67, 4.02)),
    ('sonnet zabuton a', (2.40, 1.05, 3.49), (3.40, 1.95, 3.67)),
    ('sonnet zabuton b', (3.60, 1.85, 3.49), (4.60, 2.85, 3.67)),
    ('sonnet zabuton c', (1.40, 1.95, 3.49), (2.40, 2.85, 3.67)),
    ('sonnet hibachi', (4.35, 2.85, 3.49), (4.86, 3.36, 3.90)),
    ('sonnet paper lantern (pokes through ceiling)', (2.78, 2.08, 5.50), (3.22, 2.52, 6.06)),
]
HIDE_NODES = ['Dream floating sphere', 'Dream repeated flower pot', 'Dream original flower cluster']   # review-only objects of hybrid build.py

CAMERAS = {   # copied 1:1 from hybrid/review-cameras.json (position, target, lens)
    'ground-axis': ((4.25, 1.0, 1.5), (2.6, 7.3, 1.1), 22), 'ground-corner': ((5.45, 4.7, 1.5), (0.8, 1.7, 1.1), 22),
    'ground-ceiling': ((3, 3, 1.5), (3, 5.7, 3.05), 24), 'ground-window': ((2.8, 4.4, 1.5), (2.4, 0, 1.15), 24),
    'ground-street': ((4.4, -2.0, 1.5), (3, 3.9, 1.15), 30),
    'upper-axis': ((4.3, 4.4, 4.955), (1.5, 0.55, 4.2), 22), 'upper-corner': ((0.8, 0.6, 4.955), (4.1, 4.3, 4.15), 22),
    'upper-ceiling': ((3, 2, 4.955), (3, 4.3, 5.9), 24), 'upper-window': ((3.2, 3.9, 4.955), (1.5, 0.25, 4.5), 24),
    'upper-street': ((2.2, -2.2, 4.955), (1.5, 1.3, 4.4), 35),
    'hero-counter': ((2.9, 3.9, 1.0), (2.45, 3.3, 0.6), 50),
    'debug-counter': ((2.45, 3.02, 2.4), (2.45, 3.02, 0.85), 30),
    'hero-sewing': ((1.95, 0.62, 4.12), (1.85, 1.18, 3.52), 40),
    'hero-hibachi': ((1.72, 2.92, 4.12), (1.02, 2.28, 3.80), 40),
    'hero-phonograph': ((1.95, 1.85, 4.62), (2.45, 0.62, 4.22), 30),
    'hero-rabbit': ((2.55, 3.85, 1.22), (2.05, 2.86, 1.0), 50),
    'hero-tokonoma': ((4.30, 3.55, 4.45), (5.60, 3.60, 4.30), 32),
}
# which single impossible object each review view shows (interior-directive s0.6: exactly one per view)
DREAM_VIEW = {
    'ground-axis': 'balloon', 'ground-corner': 'rabbit', 'ground-ceiling': 'balloon', 'ground-window': 'rabbit', 'ground-street': 'rabbit',
    'upper-axis': 'phonograph', 'upper-corner': 'bed', 'upper-ceiling': 'balloon', 'upper-window': 'phonograph', 'upper-street': 'phonograph',
    'hero-phonograph': 'phonograph', 'hero-rabbit': 'rabbit', 'hero-tokonoma': 'phonograph', 'hero-sewing': 'phonograph', 'hero-hibachi': 'phonograph',
}


def hybrid_load():
    sys.dont_write_bytecode = True
    src = (HYB / 'build.py').read_text(encoding='utf8')
    i1 = src.index('# Five explicit cameras')
    g = {'__file__': str(HYB / 'build.py'), '__name__': 'hybrid_part1'}
    exec(compile(src[:i1], str(HYB / 'build.py'), 'exec'), g)
    return g


def apply_hides(g):
    o = bpy.data.objects['Hybrid_Sonnet_upper']
    bm = bmesh.new()
    bm.from_mesh(o.data)
    kill = []
    for f in bm.faces:
        for (nm, lo, hi) in HIDE_UPPER:
            if all(all(lo[i] - 0.004 <= v.co[i] <= hi[i] + 0.004 for i in range(3)) for v in f.verts):
                kill.append(f)
                break
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm.to_mesh(o.data)
    bm.free()
    print('hidden faces', len(kill))
    for nm, pos in (('HybridLamp_upper_room', (3.0, 2.4, 5.50)), ('HybridLamp_andon', (5.15, 1.15, 3.95))):
        if nm in bpy.data.objects:
            bpy.data.objects[nm].location = pos


def set_vis(objs, state):
    for o in objs:
        o.hide_render = not state
        o.hide_viewport = not state


def children(root):
    out = []
    for o in bpy.data.objects:
        p = o.parent
        while p is not None:
            if p == root:
                out.append(o)
                break
            p = p.parent
    return out


def comp_chain(scene, dream):
    scene.use_nodes = True
    nt = scene.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new('CompositorNodeRLayers')
    out = nt.nodes.new('CompositorNodeComposite')
    cur = rl.outputs['Image']

    def link(node, sockin='Image', sockout='Image'):
        nonlocal cur
        nt.links.new(cur, node.inputs[sockin])
        cur = node.outputs[sockout]
    gl = nt.nodes.new('CompositorNodeGlare')
    if dream:
        gl.glare_type = 'FOG_GLOW'
        gl.quality = 'HIGH'
        gl.threshold = 0.84
        gl.mix = -0.55
        gl.size = 9
    else:
        gl.glare_type = 'FOG_GLOW'
        gl.quality = 'HIGH'
        gl.threshold = 1.2
        gl.mix = -0.75
        gl.size = 8
    link(gl)
    if dream:
        # dreamcore-study numeric start: midtones toward ~10 deg coral, saturation x0.85, blacks lifted ~7 %, white rolled to ~95 %,
        # grain ~2 % luminance.  (haze/fog and the LUT are Codex's grade; this is the review proxy.)
        cb = nt.nodes.new('CompositorNodeColorBalance')
        cb.correction_method = 'OFFSET_POWER_SLOPE'
        cb.slope = (1.0, 0.80, 0.80)
        cb.power = (1.0, 1.06, 1.08)
        cb.offset = (0.0, 0.0, 0.0)
        link(cb)
        hs = nt.nodes.new('CompositorNodeHueSat')
        hs.inputs['Hue'].default_value = 0.5
        hs.inputs['Saturation'].default_value = 0.92
        hs.inputs['Value'].default_value = 1.0
        link(hs)
        mul = nt.nodes.new('CompositorNodeMixRGB')
        mul.blend_type = 'MULTIPLY'
        mul.inputs[0].default_value = 1.0
        mul.inputs[2].default_value = (0.92, 0.92, 0.92, 1)
        link(mul, 1, 0)
        add = nt.nodes.new('CompositorNodeMixRGB')
        add.blend_type = 'ADD'
        add.inputs[0].default_value = 1.0
        add.inputs[2].default_value = (0.06, 0.05, 0.052, 1)
        link(add, 1, 0)
        gr = grain_image(scene.render.resolution_x, scene.render.resolution_y)
        im = nt.nodes.new('CompositorNodeImage')
        im.image = gr
        sc = nt.nodes.new('CompositorNodeScale')
        sc.space = 'RENDER_SIZE'
        nt.links.new(im.outputs['Image'], sc.inputs['Image'])
        gm = nt.nodes.new('CompositorNodeMixRGB')
        gm.blend_type = 'ADD'
        gm.inputs[0].default_value = 1.0
        nt.links.new(cur, gm.inputs[1])
        nt.links.new(sc.outputs['Image'], gm.inputs[2])
        cur = gm.outputs[0]
    nt.links.new(cur, out.inputs['Image'])


def grain_image(w, h):
    img = bpy.data.images.get('UD_grain_film')
    if img is None:
        img = bpy.data.images.new('UD_grain_film', w, h, alpha=False, float_buffer=True)
        img.colorspace_settings.name = 'Non-Color'
        rng = np.random.default_rng(24)
        g = np.clip(rng.standard_normal((h, w)).astype(np.float32), -2.5, 2.5) * 0.0065
        buf = np.ones((h, w, 4), np.float32)
        buf[..., 0] = buf[..., 1] = buf[..., 2] = g
        img.pixels.foreach_set(buf.ravel())
    return img


def review_setup(g):
    opus, sonnet, scene, geometry, lods, collision, empty = (g[k] for k in ('opus', 'sonnet', 'scene', 'geometry', 'lods', 'collision', 'empty'))
    sonnet.make_render_materials()
    opus.setup_render(48)
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.eevee.taa_render_samples = 64
    for _a, _v in (('shadow_pool_size', '1024'), ('shadow_ray_count', 1), ('shadow_step_count', 6)):
        try:
            setattr(scene.eevee, _a, _v)
        except Exception as _e:
            print('eevee attr', _a, _e)
    scene.eevee.use_raytracing = True
    scene.frame_set(31)
    opus.setup_world(18, 220, .45, 2.0)
    bpy.ops.object.camera_add()
    cam = bpy.context.object
    scene.camera = cam
    for o in geometry:
        o.hide_render = o.parent in [lods[1], lods[2], collision]
    review = empty('ReviewOnly', None)
    for z in [1.8, 4.8]:
        data = bpy.data.lights.new('window_fill', 'AREA')
        data.energy = 100
        data.color = (.64, .77, 1)
        data.shape = 'RECTANGLE'
        data.size = 4
        data.size_y = 2
        o = bpy.data.objects.new(data.name, data)
        scene.collection.objects.link(o)
        o.parent = review
        o.location = (3, -.5, z)
        o.rotation_euler = (math.pi / 2, 0, 0)
    return cam


def render_views(g, cam, views, variants, res=(1280, 720), tag=''):
    opus, scene = g['opus'], g['scene']
    scene.render.resolution_x, scene.render.resolution_y = res
    outdir = HERE / 'renders'
    outdir.mkdir(exist_ok=True)
    base_nodes = children(get_group('UD_Base_Upper')) + children(get_group('UD_Base_Ground')) if ROOT.get('g_UD_Base_Ground') else children(get_group('UD_Base_Upper'))
    dream_nodes = children(get_group('UD_Dream')) if ROOT.get('g_UD_Dream') else []
    for variant in variants:
        scene.view_settings.exposure = 0.38 if variant == 'dream' else 0.05
        scene.view_settings.use_curve_mapping = False
        set_vis(base_nodes, variant != 'base0')
        comp_chain(scene, variant == 'dream')
        for name in views:
            pos, target, lens = CAMERAS[name]
            if variant == 'dream':
                pick = DREAM_VIEW.get(name)
                for o in dream_nodes:
                    k = o.get('dreamObject', '')
                    flo = k in ('flowers',)
                    set_vis([o], flo or k == pick)
            else:
                set_vis(dream_nodes, False)
            opus.look(cam, pos, target, lens)
            scene.render.filepath = str(outdir / f'{tag}{variant}-{name}.png')
            t = time.time()
            bpy.ops.render.render(write_still=True)
            print(f'rendered {variant}-{name} {time.time() - t:.1f}s', flush=True)


# =====================================================================================
# 10. assembly, export, CLI
# =====================================================================================

def export_glb(path):
    root = get_root()
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for o in children(root):
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_extras=True, export_lights=True,
                              export_cameras=False, export_tangents=False, export_attributes=True, export_vertex_color='ACTIVE',
                              export_apply=False)


def main():
    t_start = time.time()
    do_render = flag('--render')
    do_export = flag('--export')
    views = arg('--views', 'upper-axis,upper-corner,upper-ceiling,upper-window').split(',')
    variants = arg('--variants', 'base0,base,dream').split(',')
    tag = arg('--tag', '')
    res = (640, 360) if flag('--quick') else (1280, 720)
    g = None
    if do_render:
        g = hybrid_load()
        cam = review_setup(g)
        apply_hides(g)
    else:
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete()
    build_materials()
    build_all()
    tri = sum(n.tris() for n in NODES if n.obj)
    for _n in NODES:
        if _n.obj:
            print('NODETRIS', _n.name, _n.tris())
    print('ADDON TRIS', tri, 'nodes', len([n for n in NODES if n.obj]))
    if do_export or flag('--uv1'):
        uv1_pack([n.obj for n in NODES if n.obj])
    if do_export:
        export_glb(HERE / 'upper-dream-addon.glb')
    if do_render:
        render_views(g, cam, views, variants, res, tag)
    print('seconds', round(time.time() - t_start, 1))


def build_all():
    build_upper_base()
    build_dream()


def build_upper_base():
    get_group('UD_Base_Upper')
    get_group('UD_Lights')
    # ceiling
    ceiling_skin()
    pendant_lamp()
    hook_pole_cloths()
    lantern_row()
    # walls
    tokonoma()
    chigaidana()
    coat_rail()
    wall_clock()
    wall_calendar()
    framed_print()
    nageshi_hooks()
    tansu_chest()
    west_bay2_goods()
    wall_decals()
    ceiling_decals()
    # window wall
    window_shoji_tear()
    sudare_window2()
    sun_decals()
    # floor: the mending corner by window 1 + tea, ledgers
    zn = Node('UD_Zabuton_Set', hero='zabuton (dented, askew)')
    zabuton(zn, 1.35, 1.40, (38, 52, 96), 0.12, dent=(0.0, -0.02, 0.028, 0.14))
    zabuton(zn, 3.15, 2.20, C_MADDER, -0.55)

    zn.finish()
    zn2 = Node('UD_Zabuton_Set2', hero='second zabuton')
    cloth_bolt_spread()
    mending_piece((1.42, 0.92), 0.15)
    sewing_box((1.98, 1.16), 0.3)
    tobacco_tray((0.86, 1.34), 0.4)
    hibachi_set((1.02, 2.28), 0.3)
    tea_tray((3.12, 1.72), -0.35)
    chabudai((3.55, 3.25), 0.2)
    ledgers((3.50, 3.22), 0.35, 0.31)
    zabuton(zn2, 3.6, 3.95, (196, 160, 80), 0.6)
    zn2.finish()


def build_dream():
    get_group('UD_Dream', dreamLayer=True, note='hide/show as a unit; per-view choice of the single impossible object is in MERGE.md')
    dream_bed()
    dream_rabbit()
    dream_balloon('UD_Dream_Balloon_Stair', (4.00, 4.70, 2.50), (5.10, 5.75, 0.66))
    dream_balloon('UD_Dream_Balloon_UpperCeiling', (3.60, 3.50, 5.42), (2.02, 4.62, 5.74), 0.15)
    dream_phonograph()
    dream_flowers_tokonoma()
    dream_flowers_window()
    dream_flowers_shop()
    dream_flowers_hanging()


if 'UD_NO_MAIN' not in globals():
    main()
