"""Tower cinema wings (1912): exterior of the two wings that housed the five cinemas beside the tower base.

Run from the repository root with Blender 4.5:
    blender -b -P assets-src/shinsekai/tower-base-upgrade/wings/build-tower-wings.py -- \
        [--renders all|cinema-street-west,...] [--samples 128] [--no-export] [--regen-atlas]

Outputs next to this file: tower-wings.glb (TW_LOD0/1/2 + COL_* + IF_* nodes), tower-wings.parts.json,
tex/tw-signs.png (+ .json slot table, from make-sign-atlas.py) and the review renders.

Frame: v4 / INTERFACE coordinates (metres, X east, Y north, Z up, tower axis at the origin, street at z 0).
The wing envelopes, the cinema clear boxes and the doors into the base are fixed in ../INTERFACE.md (v1.2);
this module attaches to the base without editing it.  The base generator's kit (walls with openings,
reveals, surrounds, sills, windows and doors to detail-spec s1, bevelled boxes, sweeps, lathes, bulbs) is
reused by executing ../exterior/build-tower-base-exterior.py without its final main() call.
Every element carries a source tag (S: OML CC0 photo, T: 1912 text, P: plate, M: map, A: assumption) in
NOTES -> parts.json and README.md.
"""

import json
import math
import random
import sys
import time
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

WHERE = Path(__file__).resolve().parent
BASE_PY = WHERE.parent / "exterior" / "build-tower-base-exterior.py"
MY_ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

# ---- 0. load the base kit (definitions only; its main() is not called, nothing of the base is written) ----
_src = BASE_PY.read_text(encoding="utf-8").rstrip()
assert _src.endswith("main()")
_src = _src[: -len("main()")]
_saved = list(sys.argv)
sys.argv = [sys.argv[0], "--", "--no-export"]
exec(compile(_src, str(BASE_PY), "exec"), globals())
sys.argv = _saved
HERE = WHERE
T0_WINGS = time.time()


def myarg(name, default, cast=str):
    return cast(MY_ARGV[MY_ARGV.index(name) + 1]) if name in MY_ARGV else default


W_RENDERS = myarg("--renders", "", str)
W_SAMPLES = myarg("--samples", 128, int)
W_EXPORT = "--no-export" not in MY_ARGV
ATLAS_PNG = WHERE / "tex" / "tw-signs.png"
ATLAS_JSON = WHERE / "tex" / "tw-signs.json"

# ---------------------------------------------------------------------------------------------
# 1. Datums (INTERFACE v1.2) and the five halls
# ---------------------------------------------------------------------------------------------
WY = -9.0                 # south (street) face of both wings: fronts open on the Luna Park-mae street (T: fr.270; face A:)
WYN = 9.0                 # north face
WT = 0.45                 # wall thickness (INTERFACE)
EAVES = 9.5               # eaves (INTERFACE: envelope z 0..9.5 eaves)
XB = FHW                  # base E/W faces x = +/-14.5
ROOF_CROWN = 12.1         # A: kept 0.5 m under the base L3 window sills (12.6) on the party walls (flashing top 12.3)
ROOF_Y = 9.45             # eaves overhang edge
Z_WP = 9.62               # roof surface over the wall line
FOOT_Y = -12.45           # footway outer edge (kerb inner face)
KERB_Y = -12.75           # kerb outer face (gutter channel beyond)
FOOT_Z = 0.15             # footway top = interior floor level = porch floors (no step at any door)
Z_STR0, Z_STR1 = 4.40, 4.70      # string course
Z_CORN = 9.05                    # hall cornice 9.05..9.45 (eaves 9.5 at the wall face)

CLEAR = {  # INTERFACE clear boxes (x0, x1) with y -8.55..8.55, z 0.15..9.0
    "W1": (-50.8, -14.95), "W2": (-86.75, -51.25), "E1": (14.95, 38.85), "E2": (39.3, 63.1), "E3": (63.55, 86.75)}
HALL_X = {  # outer extents incl. walls; cross walls split at their centre lines
    "W2": (-87.2, -51.025), "W1": (-51.025, -14.5), "E1": (14.5, 39.075), "E2": (39.075, 63.325), "E3": (63.325, 87.2)}

# the interior's W1 south door (interior/README + build-tower-base-interiors.py: door_x 14.5 cell, 1.2 x 2.5, cell -> world X = -14.95 - x)
W1_DOOR_X = -14.95 - 14.5        # -29.45
W1_DOOR_W, W1_DOOR_Z0, W1_DOOR_Z1 = 1.2, 0.15, 2.65

NOTES = []


def wnote(element, src, text=""):
    NOTES.append({"element": element, "source": src, "note": text})


# ---------------------------------------------------------------------------------------------
# 2. Materials (added to the base MATDEF; same PBR conventions; colours are estimates, project rule v3)
# ---------------------------------------------------------------------------------------------
MATDEF.update({
    "wall_W1": ((0.60, 0.46, 0.27), 0.86, 0.0, "Plaster007", 2.0, "S:158045 inset (pale fronts, hand-coloured tone) A: cream-ochre, estimated"),
    "wall_W2": ((0.58, 0.36, 0.30), 0.86, 0.0, "Plaster007", 2.0, "A: rose render (estimated; no two fronts alike, detail-spec s2)"),
    "wall_E1": ((0.40, 0.44, 0.36), 0.86, 0.0, "Plaster007", 2.0, "A: sage-grey render (estimated)"),
    "wall_E2": ((0.55, 0.42, 0.23), 0.86, 0.0, "Plaster007", 2.0, "A: buff render (estimated)"),
    "wall_E3": ((0.60, 0.32, 0.20), 0.86, 0.0, "Plaster007", 2.0, "A: salmon render (estimated)"),
    "wall_hall": ((0.50, 0.42, 0.30), 0.88, 0.0, "Plaster007", 2.0, "A: plain render on the long walls, darker than the fronts"),
    "trim_hi": ((0.72, 0.66, 0.52), 0.8, 0.0, "PaintedPlaster006", 2.0, "A: white-cream trims on the fronts"),
    "paint_red": ((0.42, 0.045, 0.03), 0.45, 0.0, None, 1.0, "A: red paint (pennant, paint pot)"),
    "paint_ochre": ((0.46, 0.27, 0.07), 0.5, 0.0, None, 1.0, "S:158045 inset (ray / fan pattern in the arched parapet) A: colours; deliberately not a flag motif"),
    "wallh_W1": ((0.52, 0.41, 0.26), 0.88, 0.0, "Plaster007", 2.0, "A: long-wall render, a weathered shade of the W1 front"),
    "wallh_W2": ((0.50, 0.36, 0.30), 0.88, 0.0, "Plaster007", 2.0, "A: long-wall render (W2)"),
    "wallh_E1": ((0.40, 0.41, 0.34), 0.88, 0.0, "Plaster007", 2.0, "A: long-wall render (E1)"),
    "wallh_E2": ((0.50, 0.40, 0.25), 0.88, 0.0, "Plaster007", 2.0, "A: long-wall render (E2)"),
    "wallh_E3": ((0.52, 0.34, 0.24), 0.88, 0.0, "Plaster007", 2.0, "A: long-wall render (E3)"),
    "paint_cream": ((0.74, 0.66, 0.48), 0.5, 0.0, None, 1.0, "S:158045 inset rays, A: colour"),
    "paint_green": ((0.03, 0.11, 0.06), 0.4, 0.0, None, 1.0, "A: green trim paint"),
    "gilt": ((0.75, 0.52, 0.2), 0.32, 1.0, None, 1.0, "A: gilded finials and studs"),
    "timber": ((0.16, 0.09, 0.045), 0.62, 0.0, None, 1.0, "A: oiled / weathered timber (barge boards, kiosk E2, ladder)"),
    "bamboo": ((0.42, 0.32, 0.15), 0.55, 0.0, None, 1.0, "A: bamboo nobori poles"),
    "lantern_red": ((0.50, 0.05, 0.03), 0.9, 0.0, None, 1.0, "S:157871 (large paper lanterns hung along the eaves at night) colour A:"),
    "lantern_white": ((0.80, 0.74, 0.60), 0.9, 0.0, None, 1.0, "S:157871 paper lanterns, A: colour"),
    "signs": ((1.0, 1.0, 1.0), 0.7, 0.0, "tex/tw-signs.png", 1.0, "fictional atlas (make-sign-atlas.py): hall names, titles, pictures invented"),
    "tile": ((0.30, 0.13, 0.07), 0.35, 0.0, None, 1.0, "A: encaustic tile porch floors"),
    "roof_lead": ((0.10, 0.11, 0.11), 0.5, 0.3, "Metal041B", 1.0, "A: lead / zinc flashings"),
    "soffit": ((0.55, 0.50, 0.40), 0.7, 0.0, None, 1.0, "A: painted boarded eaves soffit"),
    "joinery_green": ((0.02, 0.075, 0.035), 0.32, 0.0, None, 1.0, "A: kiosk paint (detail-spec s6 lacquer/paint gloss)"),
    "joinery_red": ((0.21, 0.03, 0.02), 0.32, 0.0, None, 1.0, "A: kiosk paint"),
    "joinery_cream": ((0.62, 0.54, 0.38), 0.34, 0.0, None, 1.0, "A: kiosk paint"),
    "joinery_blue": ((0.018, 0.035, 0.085), 0.32, 0.0, None, 1.0, "A: kiosk paint"),
    "kiosk_inner": ((0.13, 0.085, 0.05), 0.6, 0.0, None, 1.0, "A: kiosk interior boarding"),
    "footway": ((0.30, 0.29, 0.27), 0.78, 0.0, "large_sandstone_blocks", 1.2, "A: granite slab footway (1912 streets unpaved per S:158514; footway assumed like the base passage)"),
})

# ---------------------------------------------------------------------------------------------
# 3. Kit extensions
# ---------------------------------------------------------------------------------------------
_base_part = part
HALL = [None]
PLACEHOLDERS = ("backing", "backing_dark", "curtain")


REAL_LOD = [None]     # set while a lower-detail kit is used inside a higher LOD (bucket keys keep the real LOD)


def part(name, mat=None):  # noqa: F811  (overrides the base helper: placeholders are split per hall)
    lod = LOD if REAL_LOD[0] is None else REAL_LOD[0]
    if name in PLACEHOLDERS and HALL[0]:
        nm, mt = f"{HALL[0]}_{name}", name
    elif name.endswith("_endwall"):
        nm, mt = name, "inner"
    else:
        nm, mt = name, (mat or name)
    key = (lod, nm)
    if key not in BUCKET:
        BUCKET[key] = Part(nm, mt)
    return BUCKET[key]


ATLAS = {"size": 4096, "slots": {}}


def atlas_uv(slot, pts_uv01):
    """pts_uv01: [(s, t)] with s 0..1 left->right, t 0..1 bottom->top inside the slot -> atlas UV."""
    x, y, w, h = ATLAS["slots"][slot]
    S = ATLAS["size"]
    return [((x + s * w) / S, 1.0 - (y + (1.0 - t) * h) / S) for s, t in pts_uv01]


def S_FR(xc, y=WY):
    """South-facing wall frame at (xc, y): local u = xc - x (u runs west), n = -y (out), z up."""
    return frame_matrix(Vector((xc, y, 0.0)), Vector((0, -1, 0)))


def N_FR(xc, y=WYN):
    return frame_matrix(Vector((xc, y, 0.0)), Vector((0, 1, 0)))


def nseg_for(o):
    return {0: 20, 1: 10, 2: 6}[LOD] if (o.w > 2.0 and o.kind in ("round", "seg")) else None


def reveal_nf(frame, o, depth, pname, floor_part=None, n0=0.0):
    """Reveal like the base one, but the bottom face is optional (porches and door thresholds get their own floors)."""
    ol = o.outline(n=nseg_for(o))
    OPENINGS.append((frame, o))
    with local(frame):
        p = part(pname)
        cu = o.uc
        cz = (o.z0 + o.top()) / 2 if o.kind != "circle" else o.z1
        m = len(ol)
        for i in range(m):
            a, b = ol[i], ol[(i + 1) % m]
            bottom = o.kind != "circle" and abs(a[1] - o.z0) < 1e-6 and abs(b[1] - o.z0) < 1e-6
            if bottom and floor_part is None:
                continue
            inward = Vector((0, 0, 1)) if bottom else Vector((cu - (a[0] + b[0]) / 2, 0, cz - (a[1] + b[1]) / 2))
            pts = [(a[0], n0, a[1]), (b[0], n0, b[1]), (b[0], -depth, b[1]), (a[0], -depth, a[1])]
            face(part(floor_part) if bottom else p, pts, out=inward, smooth=o.kind == "circle")


def archivolt(frame, o, pname, width=0.34, proj=0.11, key=True):
    """Bold moulded archivolt / architrave round an opening (porches)."""
    ol = o.outline(n=nseg_for(o))
    if LOD == 2:
        prof = [(0.0, -0.01), (proj, 0.0), (proj, width), (0.0, width + 0.01)]
    else:
        prof = [(0.0, -0.012), (0.04, -0.012), (0.05, 0.03), (proj * 0.7, 0.06), (proj, 0.09), (proj, width - 0.07),
                (proj * 0.75, width - 0.03), (proj * 0.6, width), (0.0, width + 0.01)]
    with local(frame):
        p = part(pname)
        fr = outline_frames(ol, 0.0, closed=False)
        sweep(p, prof, fr, smooth=False, caps=True)
        if key and o.kind in ("round", "seg") and LOD <= 1:
            top = o.top()
            cbox(p, (o.uc - 0.2, -0.01, top - 0.08), (o.uc + 0.2, proj + 0.07, top + width + 0.14),
                 c=0.012 if LOD == 0 else 0.0, skip=("-y",))
            if LOD == 0:   # scroll console face on the keystone
                cbox(p, (o.uc - 0.12, proj + 0.07, top + 0.02), (o.uc + 0.12, proj + 0.1, top + width), c=0.008, skip=("-y",))


def outline_normals(ol):
    """Mitred normals for a (u, z) polyline traversed left -> right; normal = (-dz, du) (up / outward)."""
    segn = []
    for (ua, za), (ub, zb) in zip(ol, ol[1:]):
        L = math.hypot(ub - ua, zb - za) or 1.0
        segn.append(((-(zb - za)) / L, (ub - ua) / L))
    out = []
    for i in range(len(ol)):
        n1 = segn[max(i - 1, 0)]
        n2 = segn[min(i, len(segn) - 1)]
        m = (n1[0] + n2[0], n1[1] + n2[1])
        L = math.hypot(*m) or 1.0
        m = (m[0] / L, m[1] / L)
        d = max(0.35, m[0] * n1[0] + m[1] * n1[1])
        out.append((m[0] / d, m[1] / d))
    return out


def parapet(frame, ol, z0, thick, pname, n0=0.0, coping=None, bulbs=0.0, bulb_n=0.12):
    """Screen wall in a frame: front/back/top strips under the (u, z) outline `ol` (u non-decreasing), end caps,
    an optional coping swept along the outline and an optional bulb row just outside it (world bulbs)."""
    with local(frame):
        p = part(pname)
        for (ua, za), (ub, zb) in zip(ol, ol[1:]):
            if ub - ua > 1e-6:
                face(p, [(ua, n0, z0), (ub, n0, z0), (ub, n0, zb), (ua, n0, za)], out=(0, 1, 0))
                face(p, [(ua, n0 - thick, z0), (ub, n0 - thick, z0), (ub, n0 - thick, zb), (ua, n0 - thick, za)], out=(0, -1, 0))
            if coping is None:
                face(p, [(ua, n0, za), (ub, n0, zb), (ub, n0 - thick, zb), (ua, n0 - thick, za)], out=(-(zb - za), 0, ub - ua))
        for (u, z), s in ((ol[0], -1), (ol[-1], 1)):
            face(p, [(u, n0, z0), (u, n0 - thick, z0), (u, n0 - thick, z), (u, n0, z)], out=(s, 0, 0))
        if coping:
            pc = part(coping)
            nrm = outline_normals(ol)
            h = thick / 2 + (0.06 if LOD <= 1 else 0.04)
            prof = ([(-h, -0.03), (h, -0.03), (h, 0.05), (0.0, 0.1), (-h, 0.05)] if LOD <= 1 else [(-h, -0.02), (h, -0.02), (h, 0.07), (-h, 0.07)])
            frs = [(Vector((u, n0 - thick / 2, z)), Vector((0, 1, 0)), Vector((b0, 0, b1))) for (u, z), (b0, b1) in zip(ol, nrm)]
            sweep(pc, prof, frs, closed_prof=True, smooth=False, caps=True)
    if bulbs and LOD <= 1:
        nrm = outline_normals(ol)
        pts = [frame @ Vector((u + b0 * 0.14, n0 + bulb_n, z + b1 * 0.14)) for (u, z), (b0, b1) in zip(ol, nrm)]
        bulb_row(pts, bulbs)
        tube(part("iron"), [frame @ Vector((u + b0 * 0.12, n0 + bulb_n - 0.02, z + b1 * 0.12 + 0.03)) for (u, z), (b0, b1) in zip(ol, nrm)],
             0.01, 4)


def circ_pts(cu, cz, r, a0, a1, n):
    return [(cu + r * math.cos(a0 + (a1 - a0) * k / n), cz + r * math.sin(a0 + (a1 - a0) * k / n)) for k in range(n + 1)]


def finial(p, x, y, z, s=1.0, kind="ball", seg=None):
    seg = seg or {0: 8, 1: 6, 2: 4}[LOD]
    if kind == "ball":
        prof = [(0.0, 0.0), (0.13, 0.0), (0.13, 0.05), (0.07, 0.09), (0.06, 0.14), (0.1, 0.2), (0.14, 0.29), (0.12, 0.38),
                (0.06, 0.43), (0.0, 0.45)]
    else:  # spike
        prof = [(0.0, 0.0), (0.08, 0.0), (0.08, 0.04), (0.04, 0.08), (0.07, 0.14), (0.04, 0.2), (0.015, 0.45), (0.0, 0.55)]
    lathe(p, [(r * s, zz * s) for r, zz in prof], centre=(x, y, z), seg=seg)


def gooseneck(frame, u, n0, z, reach=0.55, drop=0.25, hero=False):
    """Poster / board lamp: wall rose, gooseneck arm, enamel reflector shade and a bulb (A: 1912 electric)."""
    pi, pb = part("iron"), part("bulb")
    seg = {0: 6, 1: 4, 2: 3}[LOD]
    with local(frame):
        if LOD == 0 and hero:
            with local(Matrix.Translation((u, n0, z)) @ Matrix.Rotation(-math.pi / 2, 4, "X")):
                lathe(pi, [(0.0, 0.0), (0.045, 0.0), (0.045, 0.01), (0.02, 0.025), (0.0, 0.03)], seg=8)
        elif LOD <= 1:
            cbox(pi, (u - 0.04, n0, z - 0.06), (u + 0.04, n0 + 0.02, z + 0.06), skip=("-y",))
        pts = [(u, n0 + 0.02, z)] + [(u, n0 + 0.02 + reach * math.sin(t * math.pi / 2), z + 0.18 * math.sin(t * math.pi) - drop * t * t)
                                      for t in (0.25, 0.5, 0.75, 1.0)]
        tube(pi, pts, 0.011, seg)
        tip = Vector(pts[-1])
        lathe(part("enamel"), [(0.018, 0.0), (0.06, -0.05), (0.13, -0.11), (0.135, -0.12), (0.02, -0.02)], centre=tuple(tip), seg=(10 if hero else 8) if LOD == 0 else 6)
        if LOD <= 1:
            lathe(pb, [(0.0, -0.06), (0.03, -0.09), (0.0, -0.13)], centre=tuple(tip), seg=4)
    w = frame @ Vector((u, n0 + 0.02 + reach, z - drop - 0.1))
    POSTER_LAMPS.append(w)


POSTER_LAMPS = []
PROP_BOXES = []
INSTANCES_W = {"bulb": [], "lantern": [], "nobori": [], "poster_frame": [], "kerb": [], "footway_slab": []}


def poster_frame(frame, uc, zc, w, h, slot, n0=0.0, glazed=True, lamp=False, torn=False, hero=False):
    """Moulded frame, back board, poster (atlas), glass and four screws; optional gooseneck lamp."""
    pj, ps = part("joinery"), part("signs")
    t = 0.045
    c = 0.004 if (LOD == 0 and hero) else 0.0
    with local(frame):
        if LOD <= 1:
            cbox(pj, (uc - w / 2 - t, n0, zc - h / 2 - t), (uc + w / 2 + t, n0 + 0.012, zc + h / 2 + t), c=0.0, skip=("-y",))
            for a, b in (((uc - w / 2 - t, zc - h / 2 - t), (uc + w / 2 + t, zc - h / 2)), ((uc - w / 2 - t, zc + h / 2), (uc + w / 2 + t, zc + h / 2 + t)),
                         ((uc - w / 2 - t, zc - h / 2), (uc - w / 2, zc + h / 2)), ((uc + w / 2, zc - h / 2), (uc + w / 2 + t, zc + h / 2))):
                cbox(pj, (a[0], n0 + 0.012, a[1]), (b[0], n0 + 0.045, b[1]), c=c, skip=("-y",))
        nf = n0 + 0.02
        quad = [(uc + w / 2, nf, zc - h / 2), (uc - w / 2, nf, zc - h / 2), (uc - w / 2, nf, zc + h / 2), (uc + w / 2, nf, zc + h / 2)]
        # frame local u runs opposite to world for south frames; the poster reads left->right when facing the wall
        face(ps, quad, out=(0, 1, 0), uv=atlas_uv(slot, [(0, 0), (1, 0), (1, 1), (0, 1)]))
        if torn and LOD == 0:
            # an older poster under it, torn at a corner (a jagged strip shows below the current one)
            jag = [(uc + w / 2 + 0.03, nf - 0.004, zc - h / 2 - 0.04), (uc - w / 2 - 0.02, nf - 0.004, zc - h / 2 - 0.02)]
            for k in range(6):
                jag.append((uc - w / 2 + (w + 0.02) * k / 5, nf - 0.004, zc - h / 2 + 0.03 + 0.03 * ((k * 7) % 3)))
            face(ps, jag, out=(0, 1, 0), uv=atlas_uv("paper", [(0.1 + 0.8 * i / len(jag), 0.2 + 0.1 * (i % 2)) for i in range(len(jag))]))
        if glazed and LOD <= 1:
            face(part("glass"), [(uc + w / 2, n0 + 0.035, zc - h / 2), (uc - w / 2, n0 + 0.035, zc - h / 2), (uc - w / 2, n0 + 0.035, zc + h / 2),
                                 (uc + w / 2, n0 + 0.035, zc + h / 2)], out=(0, 1, 0))
        if LOD == 0 and hero:
            for du in (-1, 1):
                for dz in (-1, 1):
                    with local(Matrix.Translation((uc + du * (w / 2 + t / 2), n0 + 0.045, zc + dz * (h / 2 + t / 2))) @ Matrix.Rotation(-math.pi / 2, 4, "X")):
                        lathe(part("brass"), [(0.0, 0.0), (0.006, 0.0), (0.0045, 0.0022), (0.0, 0.0028)], seg=5)
    if LOD == 0:
        wc = frame @ Vector((uc, n0, zc))
        INSTANCES_W["poster_frame"].append([round(wc.x, 3), round(wc.y, 3), round(wc.z, 3), w, h, slot])
    if lamp:
        gooseneck(frame, uc, n0, zc + h / 2 + 0.42, reach=0.5, drop=0.22)


def painted_board(frame, uc, zc, w, h, slot, n0=0.0, stand=0.14, lamps=2):
    """Painted signboard (絵看板) on standoff brackets with reflector lamps over it."""
    pj, ps, pi = part("joinery"), part("signs"), part("iron")
    c = 0.006 if LOD == 0 else 0.0
    t = 0.09
    nb = n0 + stand
    with local(frame):
        # boarded back (visible from the side), frame and the painted face
        cbox(part("timber"), (uc - w / 2, nb - 0.04, zc - h / 2), (uc + w / 2, nb, zc + h / 2), c=0.0)
        for a, b in (((uc - w / 2 - t, zc - h / 2 - t), (uc + w / 2 + t, zc - h / 2)), ((uc - w / 2 - t, zc + h / 2), (uc + w / 2 + t, zc + h / 2 + t)),
                     ((uc - w / 2 - t, zc - h / 2), (uc - w / 2, zc + h / 2)), ((uc + w / 2, zc - h / 2), (uc + w / 2 + t, zc + h / 2))):
            cbox(pj, (a[0], nb - 0.05, a[1]), (b[0], nb + 0.03, b[1]), c=c)
        face(ps, [(uc + w / 2, nb + 0.002, zc - h / 2), (uc - w / 2, nb + 0.002, zc - h / 2), (uc - w / 2, nb + 0.002, zc + h / 2),
                  (uc + w / 2, nb + 0.002, zc + h / 2)], out=(0, 1, 0), uv=atlas_uv(slot, [(0, 0), (1, 0), (1, 1), (0, 1)]))
        if LOD <= 1:
            for k in range(3):
                u = uc - w / 2 + 0.25 + (w - 0.5) * k / 2
                for z in (zc - h / 2 + 0.2, zc + h / 2 - 0.2):
                    cbox(pi, (u - 0.025, n0, z - 0.03), (u + 0.025, nb - 0.04, z + 0.03), c=0.002 if LOD == 0 else 0.0, skip=("-y",))
    for k in range(lamps):
        u = uc - w / 2 + w * (k + 0.5) / lamps
        gooseneck(frame, u, n0, zc + h / 2 + 0.55, reach=stand + 0.55, drop=0.3)


def nobori(x, y, slot, yaw, h=4.3, lean=0.0):
    """Nobori banner: bamboo pole in a stone foot, top crossbar, cloth (double-sided, slight wave) and loops."""
    pb, ps = part("bamboo"), part("signs")
    seg = {0: 6, 1: 4, 2: 3}[LOD]
    z0 = FOOT_Z
    top = Vector((x + lean * h, y, z0 + h))
    tube(pb, [(x, y, z0), (x + lean * h * 0.5, y, z0 + h * 0.5), tuple(top)], 0.022, seg)
    if LOD <= 1:
        cbox(part("sill"), (x - 0.13, y - 0.13, z0), (x + 0.13, y + 0.13, z0 + 0.16), c=0.012 if LOD == 0 else 0.0, skip=("-z",))
    d = Vector((math.cos(yaw), math.sin(yaw), 0.0))       # banner width direction
    n = Vector((-d.y, d.x, 0.0))
    bw, bh = 0.46, 2.7
    zt = z0 + h - 0.12
    rod(pb, top + Vector((0, 0, -0.12)), top + Vector((0, 0, -0.12)) + d * (bw + 0.05), 0.012, max(3, seg - 2))
    nrow = {0: 6, 1: 3, 2: 1}[LOD]
    grid = []
    for r in range(nrow + 1):
        t = r / nrow
        z = zt - bh * t
        base = Vector((x + lean * (z - z0), y, z))
        row = []
        for cc in range(2):
            s = cc
            wave = 0.035 * math.sin(t * 5.0 + s * 2.0) * (0.3 + t)
            row.append(base + d * (0.03 + bw * s) + n * wave + Vector((0, 0, -0.08 * s * t)))
        grid.append(row)
    for r in range(nrow):
        a, b, c2, dd = grid[r + 1][0], grid[r + 1][1], grid[r][1], grid[r][0]
        t0, t1 = 1 - (r + 1) / nrow, 1 - r / nrow
        uvf = atlas_uv(slot, [(0, t0), (1, t0), (1, t1), (0, t1)])
        # A: printed on both faces, so the lettering reads from both sides (the +n face takes the mirrored mapping).  The two faces
        # stand 8 mm apart: at 2 mm Cycles' self-intersection offset let the far face bleed through.
        face(ps, [a, b, c2, dd], out=tuple(n), uv=atlas_uv(slot, [(1, t0), (0, t0), (0, t1), (1, t1)]))
        face(ps, [a - n * 0.008, b - n * 0.008, c2 - n * 0.008, dd - n * 0.008], out=tuple(-n), uv=uvf)
    if LOD == 0:
        for k in range(4):   # 乳 loops round the pole
            z = zt - 0.1 - (bh - 0.2) * k / 3
            cc = Vector((x + lean * (z - z0), y, z))
            cbox(ps, tuple(cc - Vector((0.035, 0.035, 0.03))), tuple(cc + Vector((0.035, 0.035, 0.03))))
        INSTANCES_W["nobori"].append([round(x, 3), round(y, 3), round(z0, 3), round(yaw, 3), h, slot])


def lantern(p_top, r=0.2, h=0.52, red=True):
    """Paper lantern (提灯): lacquered rings, paper body, hanger (S:157871)."""
    seg = {0: 8, 1: 6, 2: 4}[LOD]
    x, y, z = p_top
    pp = part("lantern_red" if red else "lantern_white")
    pi = part("iron")
    body = [(0.55 * r, -0.07), (0.86 * r, -0.07 - 0.14 * h), (r, -0.07 - 0.5 * h), (0.86 * r, -0.07 - 0.86 * h), (0.55 * r, -0.07 - h)]
    if LOD >= 1:
        body = [body[0], body[2], body[4]]
    lathe(pp, list(reversed(body)), centre=(x, y, z), seg=seg)
    lathe(pi, [(0.6 * r, -0.07 - h - 0.05), (0.6 * r, -0.07 - h + 0.01), (0.5 * r, -0.07 - h + 0.01)], centre=(x, y, z), seg=seg)
    lathe(pi, [(0.5 * r, -0.08), (0.6 * r, -0.08), (0.6 * r, -0.02), (0.0, -0.02)], centre=(x, y, z), seg=seg)
    if LOD <= 1:
        rod(pi, (x, y, z), (x, y, z - 0.03), 0.006, 3)
    if LOD == 0:
        INSTANCES_W["lantern"].append([round(x, 3), round(y, 3), round(z, 3), r, h, "red" if red else "white"])
    LANTERNS.append((Vector((x, y, z - 0.07 - h / 2)), red))


LANTERNS = []


# ---------------------------------------------------------------------------------------------
# 4. The frontages (5 fronts, no two alike)
# ---------------------------------------------------------------------------------------------
FRONTS = {
    "W1": dict(xc=W1_DOOR_X, w=11.0, d=1.2, wall="wall_W1", trim="trim", style="arch", ground="band", upper="band",
               porch=dict(kind="round", w=3.0, z1=2.55), door=dict(w=W1_DOOR_W, z1=W1_DOOR_Z1, interior=True),
               upper_ops=[("seg", -4.25, 1.0, 5.3, 7.3, 0.15), ("seg", 4.25, 1.0, 5.3, 7.3, 0.15)],
               board=("board_0", 0.0, 6.65, 5.6, 2.1), canopy="glass", kiosk=("pyramid", "joinery_green", 1, "kiosk_0"),
               nobori=[0, 2, 7, 3, 9, 1], name="name_W1", posters=[0, 3, 9, 13], lamps="bracket"),
    "W2": dict(xc=-69.0, w=10.0, d=1.2, wall="wall_W2", trim="trim_hi", style="stepped", ground="flat", upper="flat",
               porch=dict(kind="seg", w=2.8, z1=3.0, rise=0.45), door=dict(w=2.2, z1=2.95),
               upper_ops=[("round", -2.4, 0.9, 5.3, 7.0, 0), ("round", 0.0, 0.9, 5.3, 7.0, 0), ("round", 2.4, 0.9, 5.3, 7.0, 0)],
               board=None, canopy="awning", kiosk=("bell", "joinery_cream", -1, "kiosk_1"),
               nobori=[4, 5, 8, 6, 0], name="name_W2", posters=[1, 5, 10, 14], lamps="goose"),
    "E1": dict(xc=26.9, w=9.0, d=1.2, wall="wall_E1", trim="trim_hi", style="pylons", ground="band", upper="flat",
               porch=dict(kind="rect", w=3.2, z1=3.3), door=dict(w=2.2, z1=2.95, ajar=0.55),
               upper_ops=[("seg", -3.75, 0.8, 5.4, 7.2, 0.12), ("seg", 3.75, 0.8, 5.4, 7.2, 0.12)],
               board=("board_4", 0.0, 6.4, 5.4, 2.1), canopy="bullnose", kiosk=("cresting", "joinery_red", 1, "kiosk_2"),
               nobori=[1, 3, 6, 9], name="name_E1", posters=[2, 6, 11, 15], lamps="goose"),
    "E2": dict(xc=51.2, w=10.0, d=1.2, wall="wall_E2", trim="trim", style="karahafu", ground="flat", upper="band",
               porch=dict(kind="round", w=3.0, z1=2.6), door=dict(w=2.2, z1=2.95),
               upper_ops=[("seg", -3.3, 1.0, 5.3, 7.3, 0.15), ("seg", 3.3, 1.0, 5.3, 7.3, 0.15)],
               board=("board_2", 0.0, 6.45, 4.4, 2.0), canopy="lanterns", kiosk=("hip", "timber", -1, "kiosk_0"),
               nobori=[7, 2, 5, 8, 0], name="name_E2", posters=[4, 7, 12, 16], lamps="lantern"),
    "E3": dict(xc=75.3, w=9.6, d=1.2, wall="wall_E3", trim="trim_hi", style="domes", ground="band", upper="flat",
               porch=dict(kind="round", w=3.2, z1=2.5), door=dict(w=2.2, z1=2.95),
               upper_ops=[("round", -2.6, 0.9, 5.3, 7.0, 0), ("round", 0.0, 0.9, 5.3, 7.0, 0), ("round", 2.6, 0.9, 5.3, 7.0, 0)],
               board=None, canopy="scallop", kiosk=("dome", "joinery_blue", 1, "kiosk_1"),
               nobori=[3, 4, 9, 1, 6], name="name_E3", posters=[8, 17, 18, 19], lamps="bracket"),
}
Z_CORNF = 9.35          # front block cornice 9.35..9.85 (a step above the hall cornice)
Z_PAR0 = 9.85           # parapet base


def front_zones(F):
    wm = F["wall"]
    z = [(0.0, PLINTH - 0.06, "plinth", 0.06, 0.06), (PLINTH - 0.06, PLINTH, "plinth", 0.06, 0.0)]
    band = LOD <= 1
    z += zones_std(PLINTH, Z_STR0, "band" if (band and F["ground"] == "band") else "flat", wm, course=0.5, g=0.035, d=0.03)
    z += zones_std(Z_STR0, Z_STR1, "flat", wm)
    z += zones_std(Z_STR1, Z_CORNF, "band" if (band and F["upper"] == "band") else "flat", wm, course=0.6, g=0.02, d=0.014)
    return z


def parapet_outline(F):
    """(u, z) top outline of the parapet screen, u from -w/2 to +w/2 (front frame u)."""
    hw = F["w"] / 2
    st = F["style"]
    nseg = {0: 28, 1: 16, 2: 8}[LOD]
    if st == "arch":
        za, Ra, ua = 11.3, 4.6, 4.4
        zc = za - math.sqrt(Ra * Ra - ua * ua)
        a0 = math.atan2(za - zc, ua)
        arc = circ_pts(0.0, zc, Ra, math.pi - a0, a0, nseg)
        return [(-hw, za)] + arc + [(hw, za)], dict(zc=zc, Ra=Ra, za=za, ua=ua)
    if st == "stepped":
        za = 11.0
        steps = [(3.8, 11.8), (2.6, 12.6), (1.3, 13.4)]
        ol = [(-hw, za)]
        for uu, zz in steps:
            ol += [(-uu, ol[-1][1]), (-uu, zz)]
        cap = circ_pts(0.0, 13.4 - 1.1, math.hypot(1.3, 1.1), math.pi - math.atan2(1.1, 1.3), math.atan2(1.1, 1.3), max(4, nseg // 3))
        ol = ol[:-1] + cap
        for uu, zz in reversed(steps):
            ol += [(uu, ol[-1][1]) if ol[-1][0] < uu else ol[-1], (uu, zz - (0.8 if uu != 3.8 else 0.8))]
        # rebuild the right side cleanly as the mirror of the left
        left = [q for q in ol if q[0] < -1e-6]
        right = [(-u, z) for u, z in reversed(left)]
        ol = left + cap[1:-1] + right
        return ol, dict(za=za)
    if st == "pylons":
        za = 11.2
        a = circ_pts(0.0, 11.2 - 3.3, math.hypot(3.2, 3.3), math.pi - math.atan2(3.3, 3.2), math.atan2(3.3, 3.2), nseg // 2)
        # segmental pediment rise 11.2 -> 11.2 + (R - 3.3) = 12.6
        return [(-hw, za)] + a + [(hw, za)], dict(za=za)
    if st == "karahafu":
        za, H, u2 = 11.0, 2.4, 4.8
        ol = [(-hw, za)]
        for k in range(nseg + 1):
            u = -u2 + 2 * u2 * k / nseg
            ol.append((u, za + H * (1 + math.cos(math.pi * u / u2)) / 2))
        ol.append((hw, za))
        return ol, dict(za=za, H=H, u2=u2)
    if st == "domes":
        za = 10.9
        a = circ_pts(0.0, za - 0.4, 1.9, math.pi - math.asin(0.4 / 1.9), math.asin(0.4 / 1.9), nseg // 2)
        return [(-hw, za)] + a + [(hw, za)], dict(za=za)
    raise ValueError(st)


def front_block(hid, F):
    """Frontispiece: front face with porch and windows, side returns, string course, cornice, parapet with its
    style ornaments, name board and the porch (floor, back wall with the hall door)."""
    xc, w, d = F["xc"], F["w"], F["d"]
    hw = w / 2
    yf = WY - d
    fr = S_FR(xc, yf)
    zones = front_zones(F)
    P = F["porch"]
    po = Op(P["kind"], 0.0, P["w"], FOOT_Z, P["z1"], rise=P.get("rise", 0.0), tag=f"porch_{hid}")
    ups = [Op(k, u, ww, z0, z1, rise=ri) for k, u, ww, z0, z1, ri in F["upper_ops"]]
    wall(fr, -hw, hw, zones, [po] + ups, step=0.05 if LOD == 0 else 0.1)
    for o in ups:          # front-block rooms (office / benshi room over the porch): placeholders stay with the front, not the hall cell
        add_win(fr, o, hid + "F", shutters=False)
    HALL[0] = hid
    # side returns (west: N=-x, u=y; east: N=+x, u=-y)
    for sgn in (-1, 1):
        x = xc + sgn * hw
        frs = frame_matrix(Vector((x, 0, 0)), Vector((sgn, 0, 0)))
        if sgn < 0:
            u0, u1 = yf, WY
        else:
            u0, u1 = -WY, -yf
        wall(frs, u0, u1, zones, [])
    # string course and cornice round three sides
    pts = [(xc - hw, WY), (xc - hw, yf), (xc + hw, yf), (xc + hw, WY)]
    hf = hframes(pts, closed=False)
    tm = F["trim"]
    string = [(0.0, Z_STR0), (0.06, Z_STR0), (0.12, Z_STR0 + 0.08), (0.12, Z_STR0 + 0.24), (0.0, Z_STR1)]
    corn = [(0.0, Z_CORNF), (0.05, Z_CORNF), (0.05, Z_CORNF + 0.05), (0.12, Z_CORNF + 0.1), (0.16, Z_CORNF + 0.18),
            (0.36, Z_CORNF + 0.3), (0.40, Z_CORNF + 0.3), (0.40, Z_CORNF + 0.42), (0.43, Z_CORNF + 0.45), (0.2, Z_PAR0), (0.0, Z_PAR0)]
    if LOD == 2:
        corn = [(0.0, Z_CORNF), (0.16, Z_CORNF + 0.18), (0.40, Z_CORNF + 0.3), (0.43, Z_CORNF + 0.45), (0.0, Z_PAR0)]
    sweep(part(tm), string, hf, smooth=False, caps=True)
    sweep(part(tm), corn, hf, smooth=False, caps=True)
    if LOD <= 1:   # modillions under the corona
        with local(fr):
            n = int(w / 0.45)
            for k in range(n + 1):
                u = -hw + 0.2 + (w - 0.4) * k / n
                cbox(part(tm), (u - 0.05, 0.15, Z_CORNF + 0.12), (u + 0.05, 0.38, Z_CORNF + 0.3), skip=("-y", "+z"))
    # flat roof of the block behind the parapet (sheet) and the parapet screen
    face(part("roof_sheet"), [(xc - hw + 0.05, yf + 0.35, Z_PAR0 - 0.02), (xc + hw - 0.05, yf + 0.35, Z_PAR0 - 0.02),
                              (xc + hw - 0.05, WY + 0.2, Z_PAR0 - 0.02), (xc - hw + 0.05, WY + 0.2, Z_PAR0 - 0.02)], out=(0, 0, 1))
    ol, info = parapet_outline(F)
    parapet(fr, ol, Z_PAR0 - 0.3, 0.35, F["wall"], n0=0.0, coping=tm, bulbs=0.36)
    # iron raking stays behind the parapet (seen from the roof garden)
    if LOD <= 1:
        for k in range(4):
            u = -hw + 0.8 + (w - 1.6) * k / 3
            topz = min(z for uu, z in ol if abs(uu - u) < 1.2) if any(abs(uu - u) < 1.2 for uu, _ in ol) else Z_PAR0 + 1.0
            with local(fr):
                rod(part("iron"), (u, -0.35, min(topz - 0.3, Z_PAR0 + 1.6)), (u, -1.15, Z_PAR0 + 0.05), 0.02, 4)
    style_ornaments(hid, F, fr, info, ol)
    # name board on the attic (atlas)
    nb_w = {"arch": 6.6, "stepped": 5.4, "pylons": 5.8, "karahafu": 5.6, "domes": 5.8}[F["style"]]
    nb_z = {"arch": 10.55, "stepped": 10.45, "pylons": 10.5, "karahafu": 10.4, "domes": 10.42}[F["style"]]
    board_face(fr, 0.0, nb_z, nb_w, nb_w * 320 / 2048 * 1.1, F["name"], n0=0.0)
    # porch: reveal (no floor), archivolt, tile floor, back wall with the hall door, posters in the porch sides
    reveal_nf(fr, po, d, "reveal")
    archivolt(fr, po, tm, width=0.34 if P["kind"] != "rect" else 0.3)
    with local(fr):
        pw = P["w"] / 2
        cbox(part("tile"), (-pw, -d, FOOT_Z - 0.04), (pw, 0.02, FOOT_Z + 0.004), c=0.004 if LOD == 0 else 0.0, skip=("-z",))
    frh = S_FR(xc, WY)
    ptop = po.top()
    # back wall inside the porch (hall wall plane) with the door
    D = F["door"]
    do = Op("rect", 0.0, D["w"], FOOT_Z if D.get("interior") else FOOT_Z, D["z1"], tag=f"door_cinema_{hid}_main")
    zs_back = [(FOOT_Z, 1.0, tm, 0.0, 0.0), (1.0, ptop + 0.05, "reveal", 0.0, 0.0)]
    wall(frh, -pw, pw, zs_back, [do])
    reveal_nf(frh, do, WT, "reveal")
    door_in_hall(frh, do, D, hid)
    # porch side posters and a lamp in the porch soffit
    if LOD <= 1:
        for sgn in (-1, 1):
            x = xc + sgn * pw
            frp = frame_matrix(Vector((x, 0, 0)), Vector((-sgn, 0, 0)))    # reveal side faces the porch axis
            uc = (yf + WY) / 2 * (1 if sgn > 0 else -1)
            poster_frame(frp, uc, 1.75, 0.6, 0.9, f"poster_{F['posters'][0 if sgn < 0 else 1]}", n0=0.0, glazed=True, hero=True)
        lamp_pendant(Vector((xc, WY - d / 2, min(ptop, P["z1"] + P["w"] / 2) - 0.05)), 0.15)
    wnote(f"front {hid}: frontispiece ({F['style']})", FRONT_SRC[F["style"]],
          f"width {w} m, projection {d} m (A:), parapet top {max(z for _, z in ol):.2f} m")
    return fr, po, do, ol


FRONT_SRC = {
    "arch": "S:158045 inset (arched parapet filled with a ray / fan pattern, lantern rows, banners) A: proportions; rays in ochre / cream with a gilt half-disc (deliberately not a flag motif)",
    "stepped": "A: stepped gable (variation; Western false fronts of 1910s Osaka street views, S:158225 parapets)",
    "pylons": "A: pylons + segmental pediment (variation); S:158225 (parapet facades with finials)",
    "karahafu": "A: 唐破風 cusped gable over a Western front (period theatre type; variation), S:157871 lanterns",
    "domes": "S:158225 (domed corner building) S:158514 (small dome on a corner building) A: twin domed turrets",
}


def board_face(fr, uc, zc, w, h, slot, n0=0.0):
    """Framed board flush on a wall (name boards)."""
    pj, ps = part("paint_green" if slot == "name_W2" else "joinery"), part("signs")
    t = 0.08
    c = 0.006 if LOD == 0 else 0.0
    with local(fr):
        cbox(pj, (uc - w / 2 - t, n0, zc - h / 2 - t), (uc + w / 2 + t, n0 + 0.03, zc + h / 2 + t), c=c, skip=("-y",))
        face(ps, [(uc + w / 2, n0 + 0.032, zc - h / 2), (uc - w / 2, n0 + 0.032, zc - h / 2), (uc - w / 2, n0 + 0.032, zc + h / 2),
                  (uc + w / 2, n0 + 0.032, zc + h / 2)], out=(0, 1, 0), uv=atlas_uv(slot, [(0, 0), (1, 0), (1, 1), (0, 1)]))
        if LOD <= 1:
            cbox(part("gilt"), (uc - w / 2 - t, n0 + 0.03, zc - h / 2 - t), (uc + w / 2 + t, n0 + 0.045, zc - h / 2 - t + 0.025), c=0.003 if LOD == 0 else 0.0)
            cbox(part("gilt"), (uc - w / 2 - t, n0 + 0.03, zc + h / 2 + t - 0.025), (uc + w / 2 + t, n0 + 0.045, zc + h / 2 + t), c=0.003 if LOD == 0 else 0.0)


def door_in_hall(frh, do, D, hid):
    """The hall door behind the porch.  W1: the interior's own south door (leaves belong to cell_cinema):
    only a casing, the threshold and a dark placeholder card.  Others: double glazed doors (exterior-owned)."""
    if D.get("interior"):
        with local(frh):
            pj = part("joinery")
            hw = do.w / 2
            cf = 0.005 if LOD == 0 else 0.0
            # casing on the porch face only (n 0..+0.03); the reveal behind stays clear for the inward-opening leaves
            cbox(pj, (do.uc - hw - 0.1, 0.0, FOOT_Z), (do.uc - hw, 0.035, do.z1 + 0.1), c=cf, skip=("-y",))
            cbox(pj, (do.uc + hw, 0.0, FOOT_Z), (do.uc + hw + 0.1, 0.035, do.z1 + 0.1), c=cf, skip=("-y",))
            cbox(pj, (do.uc - hw - 0.1, 0.0, do.z1), (do.uc + hw + 0.1, 0.035, do.z1 + 0.1), c=cf, skip=("-y",))
            cbox(part("sill"), (do.uc - hw, -WT, FOOT_Z - 0.05), (do.uc + hw, 0.06, FOOT_Z), c=0.008 if LOD == 0 else 0.0, skip=("-z",))
            face(part("backing_dark"), [(do.uc - hw - 0.6, -2.5, FOOT_Z), (do.uc + hw + 0.6, -2.5, FOOT_Z), (do.uc + hw + 0.6, -2.5, do.z1 + 0.6),
                                         (do.uc - hw - 0.6, -2.5, do.z1 + 0.6)], out=(0, 1, 0))
            if LOD == 0:   # enamel exit plate (atlas, fictional wording) over the door
                face(part("signs"), [(do.uc + 0.26, 0.036, do.z1 + 0.16), (do.uc - 0.26, 0.036, do.z1 + 0.16), (do.uc - 0.26, 0.036, do.z1 + 0.42),
                                     (do.uc + 0.26, 0.036, do.z1 + 0.42)], out=(0, 1, 0), uv=atlas_uv("plate_0", [(0, 0), (1, 0), (1, 1), (0, 1)]))
                cbox(part("iron"), (do.uc - 0.28, 0.0, do.z1 + 0.14), (do.uc + 0.28, 0.034, do.z1 + 0.44), c=0.002, skip=("-y",))
    else:
        door_fill(frh, do, leaves=2, glazed=True, open_angle=D.get("ajar", 0.0), n_face=-0.12, threshold=True)
    DOORS_W.append((frh, do, hid, "main"))


DOORS_W = []
WINDOWS_W = []


def style_ornaments(hid, F, fr, info, ol):
    tm, st = F["trim"], F["style"]
    hw = F["w"] / 2
    with local(fr):
        if st == "arch":
            zc, Ra, ua = info["zc"], info["Ra"], info["za"]
            # archivolt band on the parapet face just inside the top, keystone, springer piers with ball finials
            n = {0: 28, 1: 16, 2: 8}[LOD]
            ring = circ_pts(0.0, zc, Ra - 0.28, math.pi - math.atan2(info["za"] - zc, info["ua"]) - 0.02,
                            math.atan2(info["za"] - zc, info["ua"]) + 0.02, n)
            frs = outline_frames(ring, 0.0, closed=False)
            prof = [(0.0, -0.2), (0.05, -0.18), (0.09, -0.12), (0.09, 0.12), (0.05, 0.18), (0.0, 0.2)]
            sweep(part(tm), prof, frs, smooth=False, caps=True)
            # sunburst: 15 alternating rays (red / cream boards) fanned behind the name board, red half-sun on top
            nr = 15
            R0, R1 = 0.9, Ra - 0.55
            cz = 11.2
            for k in range(nr):
                a0, a1 = math.pi * k / nr, math.pi * (k + 1) / nr
                pm = part("paint_ochre" if k % 2 == 0 else "paint_cream")
                pts = [(R0 * math.cos(a0), 0.025, cz + R0 * math.sin(a0)), (R1 * math.cos(a0), 0.025, max(cz, zc) + R1 * math.sin(a0) * 0.98),
                       (R1 * math.cos(a1), 0.025, max(cz, zc) + R1 * math.sin(a1) * 0.98), (R0 * math.cos(a1), 0.025, cz + R0 * math.sin(a1))]
                # clamp rays inside the arch ring
                pts = [(u, nn, min(z, zc + math.sqrt(max(0.0, (Ra - 0.5) ** 2 - u * u)))) for u, nn, z in pts]
                face(pm, pts, out=(0, 1, 0))
            sun = [(0.0, 0.04, cz)] + [(R0 * math.cos(math.pi * k / 12), 0.04, cz + R0 * math.sin(math.pi * k / 12)) for k in range(13)]
            face(part("gilt"), sun, out=(0, 1, 0))
            if LOD <= 1:
                sweep(part("gilt"), [(0.0, -0.03), (0.03, -0.02), (0.03, 0.02), (0.0, 0.03)],
                      outline_frames(list(reversed(circ_pts(0.0, cz, R0, 0.0, math.pi, 12))), 0.04, closed=False), smooth=True, caps=True)
            for u in (-hw + 0.25, -info["ua"], info["ua"], hw - 0.25):
                cbox(part(tm), (u - 0.22, -0.05, Z_PAR0 - 0.3), (u + 0.22, 0.12, info["za"] + 0.55), c=0.012 if LOD == 0 else 0.0, skip=("-y",))
                cbox(part(tm), (u - 0.27, -0.05, info["za"] + 0.55), (u + 0.27, 0.16, info["za"] + 0.68), c=0.01 if LOD == 0 else 0.0, skip=("-y",))
                finial(part(tm), u, 0.05, info["za"] + 0.68, 1.0)
            cbox(part(tm), (-0.3, -0.05, zc + Ra - 0.45), (0.3, 0.2, zc + Ra + 0.25), c=0.015 if LOD == 0 else 0.0, skip=("-y",))
        elif st == "stepped":
            for u in (-hw + 0.2, hw - 0.2, -3.8, 3.8, -2.6, 2.6):
                ztop = max(z for uu, z in ol if abs(uu - u) < 0.05) if any(abs(uu - u) < 0.05 for uu, _ in ol) else info["za"]
                cbox(part(tm), (u - 0.18, -0.04, Z_PAR0 - 0.3), (u + 0.18, 0.1, ztop + 0.25), c=0.01 if LOD == 0 else 0.0, skip=("-y",))
                finial(part("gilt" if abs(u) < 3 else tm), u, 0.03, ztop + 0.25, 0.8, "spike" if abs(u) < 3 else "ball")
            # roundel with a medallion (base frieze language) in the top step
            with local(Matrix.Translation((0.0, 0.0, 12.35)) @ Matrix.Rotation(-math.pi / 2, 4, "X")):
                if LOD <= 1:
                    lathe(part(tm), [(0.62, 0.0), (0.64, 0.05), (0.56, 0.1), (0.5, 0.07), (0.5, 0.04)], seg=16 if LOD == 0 else 10)
                lathe(part("medallion"), [(0.5, 0.04), (0.25, 0.07), (0.0, 0.08)], seg=16 if LOD == 0 else 8)
            # flag pole with a pennant on the top step (sky-zone dressing, fictional plain pennant)
            if LOD <= 1:
                rod(part("iron"), (0.0, -0.15, 13.45), (0.0, -0.15, 16.2), 0.03, 5)
                finial(part("gilt"), 0.0, -0.15, 16.2, 0.5)
                pen = [(0.0, -0.15, 16.05), (-1.4, -0.3, 15.8), (0.0, -0.15, 15.55)]
                face(part("paint_red"), pen, out=(0, 1, 0))
                face(part("paint_red"), [(q[0], q[1] - 0.004, q[2]) for q in pen], out=(0, -1, 0))
        elif st == "pylons":
            for sgn in (-1, 1):
                u = sgn * (hw - 0.45)
                cbox(part(tm), (u - 0.5, -0.1, Z_PAR0 - 0.3), (u + 0.5, 0.25, 12.9), c=0.015 if LOD == 0 else 0.0, skip=("-y",))
                cbox(part(tm), (u - 0.58, -0.1, 12.9), (u + 0.58, 0.33, 13.08), c=0.012 if LOD == 0 else 0.0, skip=("-y",))
                if LOD <= 1:
                    for k in range(3):   # recessed panels (three strips) on the pylon face
                        cbox(part(F["wall"]), (u - 0.32, 0.25, 10.3 + k * 0.85), (u + 0.32, 0.27, 10.95 + k * 0.85), c=0.004 if LOD == 0 else 0.0, skip=("-y",))
                finial(part("gilt"), u, 0.08, 13.08, 1.4)
            # pediment tympanum rosette and raking cornice already in the coping; a festoon (swag) of bulbs
            if LOD <= 1:
                sw = [(-2.8 + 5.6 * k / 16, 0.12, 11.35 - 0.35 * math.sin(math.pi * k / 16)) for k in range(17)]
                bulb_row([fr @ Vector(q) for q in sw], 0.3)
                tube(part("iron"), sw, 0.008, 4)
        elif st == "karahafu":
            # timber barge boards following the cusped outline, gegyo (懸魚) at the centre, gilt studs
            core = [q for q in ol if abs(q[0]) <= info["u2"] + 1e-6]
            nrm = outline_normals(core)
            frs = [(Vector((u, 0.02, z)), Vector((0, 1, 0)), Vector((b0, 0, b1))) for (u, z), (b0, b1) in zip(core, nrm)]
            prof = [(-0.02, -0.34), (0.14, -0.34), (0.16, -0.3), (0.16, 0.06), (0.12, 0.1), (-0.02, 0.1)] if LOD <= 1 else [(-0.02, -0.34), (0.16, -0.34), (0.16, 0.1), (-0.02, 0.1)]
            sweep(part("timber"), prof, frs, smooth=True, caps=True)
            top = info["za"] + info["H"]
            gg = [(0.0, 0.18, top - 0.3), (0.45, 0.18, top - 0.6), (0.38, 0.18, top - 1.0), (0.0, 0.18, top - 1.25), (-0.38, 0.18, top - 1.0), (-0.45, 0.18, top - 0.6)]
            face(part("timber"), gg, out=(0, 1, 0))
            if LOD <= 1:
                for q1, q2 in zip(gg, gg[1:] + gg[:1]):
                    face(part("timber"), [q1, q2, (q2[0], 0.02, q2[2]), (q1[0], 0.02, q1[2])], out=(q1[0] + q2[0], 0.0, (q1[2] + q2[2]) / 2 - (top - 0.8)))
                for k in range(-4, 5):   # gilt studs along the barge board
                    u = info["u2"] * 0.85 * k / 4
                    z = info["za"] + info["H"] * (1 + math.cos(math.pi * u / info["u2"])) / 2 - 0.12
                    with local(Matrix.Translation((u, 0.17, z)) @ Matrix.Rotation(-math.pi / 2, 4, "X")):
                        lathe(part("gilt"), [(0.0, 0.0), (0.05, 0.0), (0.045, 0.02), (0.0, 0.03)], seg=8 if LOD == 0 else 5)
                with local(Matrix.Translation((0.0, 0.2, top - 0.75)) @ Matrix.Rotation(-math.pi / 2, 4, "X")):
                    lathe(part("gilt"), [(0.0, 0.0), (0.16, 0.0), (0.14, 0.04), (0.0, 0.06)], seg=12 if LOD == 0 else 6)
            # small tiled hoods at the gable feet
            for sgn in (-1, 1):
                u = sgn * (hw - 0.3)
                cbox(part("timber"), (u - 0.35, -0.05, info["za"] - 0.05), (u + 0.35, 0.3, info["za"] + 0.12), c=0.01 if LOD == 0 else 0.0, skip=("-y",))
        elif st == "domes":
            # twin domed turrets on the front corners, crest with a medallion
            for sgn in (-1, 1):
                u = sgn * (hw - 0.6)
                cbox(part(F["trim"]), (u - 0.6, -0.4, Z_PAR0 - 0.3), (u + 0.6, 0.18, 11.7), c=0.015 if LOD == 0 else 0.0, skip=("-y",))
                cbox(part(F["trim"]), (u - 0.68, -0.48, 11.7), (u + 0.68, 0.26, 11.88), c=0.012 if LOD == 0 else 0.0)
                if LOD <= 1:   # arched louvre openings (dark recess) in the drum face
                    cbox(part("backing_dark"), (u - 0.18, 0.181, 10.5), (u + 0.18, 0.19, 11.35), skip=("-y",))
                    for k in range(5):
                        cbox(part("joinery"), (u - 0.18, 0.19, 10.55 + k * 0.16), (u + 0.18, 0.21, 10.6 + k * 0.16))
                seg = {0: 16, 1: 10, 2: 6}[LOD]
                prof = [(0.66, 0.0), (0.66, 0.06), (0.6, 0.12), (0.62, 0.3), (0.56, 0.6), (0.42, 0.9), (0.22, 1.1), (0.08, 1.18), (0.0, 1.2)]
                if LOD == 2:
                    prof = [(0.66, 0.0), (0.6, 0.4), (0.35, 0.95), (0.0, 1.2)]
                lathe(part("roof_sheet"), prof, centre=(u, -0.11, 11.88), seg=seg, sq=lambda z: 2.0 + max(0.0, 2.5 - z * 3.0))
                finial(part("gilt"), u, -0.11, 13.05, 1.0, "spike")
            with local(Matrix.Translation((0.0, 0.0, 11.35)) @ Matrix.Rotation(-math.pi / 2, 4, "X")):
                if LOD <= 1:
                    lathe(part(tm), [(0.55, 0.0), (0.57, 0.05), (0.5, 0.1), (0.44, 0.07), (0.44, 0.04)], seg=16 if LOD == 0 else 10)
                lathe(part("medallion"), [(0.44, 0.04), (0.2, 0.07), (0.0, 0.08)], seg=16 if LOD == 0 else 8)


# ---------------------------------------------------------------------------------------------
# 5. Canopies, lamps, kiosks
# ---------------------------------------------------------------------------------------------
def canopy(hid, F, fr):
    kind = F["canopy"]
    P = F["porch"]
    pw = P["w"] / 2
    pi, pj = part("iron"), part("joinery")
    seg = {0: 6, 1: 4, 2: 3}[LOD]
    if kind in ("glass", "scallop"):
        W, D = pw + 1.1, 2.0
        zb, zf = Z_STR1 + 0.05, Z_STR1 - 0.2
        with local(fr):
            # glazed roof on T-bars, fascia (valance) on three sides, bulbs under the fascia, tie rods to the wall
            nbar = int(2 * W / 0.6)
            for k in range(nbar + 1):
                u = -W + 2 * W * k / nbar
                rod(pi, (u, 0.0, zb), (u, D, zf), 0.018, 4)
            face(part("glass"), [(-W, 0.0, zb + 0.02), (W, 0.0, zb + 0.02), (W, D, zf + 0.02), (-W, D, zf + 0.02)], out=(0, 0, 1))
            fz0 = zf - (0.32 if kind == "glass" else 0.26)
            if kind == "glass":
                cbox(pj, (-W - 0.03, D - 0.03, fz0), (W + 0.03, D + 0.04, zf + 0.06), c=0.004 if LOD == 0 else 0.0)
                for sgn in (-1, 1):
                    cbox(pj, (sgn * W - 0.035, 0.0, fz0), (sgn * W + 0.035, D, zf + 0.06), c=0.004 if LOD == 0 else 0.0)
                cbox(part("gilt"), (-W - 0.035, D + 0.04, fz0 + 0.12), (W + 0.035, D + 0.05, fz0 + 0.16), c=0.002 if LOD == 0 else 0.0)
            else:   # scalloped (sawtooth) sheet valance
                n = int(2 * W / 0.3)
                for k in range(n):
                    u0, u1 = -W + 2 * W * k / n, -W + 2 * W * (k + 1) / n
                    face(part("paint_cream"), [(u0, D, zf + 0.05), (u1, D, zf + 0.05), (u1, D, fz0 + 0.1), ((u0 + u1) / 2, D, fz0 - 0.02), (u0, D, fz0 + 0.1)], out=(0, 1, 0))
                    face(part("paint_cream"), [(u1, D - 0.01, zf + 0.05), (u0, D - 0.01, zf + 0.05), (u0, D - 0.01, fz0 + 0.1), ((u0 + u1) / 2, D - 0.01, fz0 - 0.02), (u1, D - 0.01, fz0 + 0.1)], out=(0, -1, 0))
                cbox(pj, (-W, D - 0.04, zf - 0.02), (W, D + 0.01, zf + 0.08), c=0.003 if LOD == 0 else 0.0)
                for sgn in (-1, 1):
                    cbox(pj, (sgn * W - 0.03, 0.0, zf - 0.02), (sgn * W + 0.03, D, zf + 0.08))
            for sgn in (-1, 1):
                rod(pi, (sgn * (W - 0.1), 0.0, zb + 0.7), (sgn * (W - 0.1), D - 0.05, zf + 0.06), 0.014, 4)
                if LOD <= 1:
                    # wall eye plates and scroll brackets under the canopy
                    cbox(pi, (sgn * (W - 0.1) - 0.05, 0.0, zb + 0.6), (sgn * (W - 0.1) + 0.05, 0.02, zb + 0.8), c=0.002 if LOD == 0 else 0.0, skip=("-y",))
                    arc = [(sgn * (W - 0.25), 0.02 + 0.9 * math.sin(t * math.pi / 2), zb - 0.9 + 0.8 * (1 - math.cos(t * math.pi / 2)) + 0.05) for t in [k / 6 for k in range(7)]]
                    tube(pi, arc, 0.016, seg)
            if LOD <= 1:
                bulb_row([fr @ Vector((-W, D + 0.08, fz0 - 0.03)), fr @ Vector((W, D + 0.08, fz0 - 0.03))], 0.3)
        if kind == "glass":
            for k in range(6):
                u = -W + 0.45 + (2 * W - 0.9) * k / 5
                lantern(tuple(fr @ Vector((u, D - 0.12, fz0 - 0.02))), 0.17, 0.42, red=(k % 2 == 0))
    elif kind == "awning":
        W, D = pw + 0.9, 1.6
        zb, zf = Z_STR0 + 0.1, Z_STR0 - 0.45
        with local(fr):
            pr = part("roof_sheet")
            face(pr, [(-W - 0.1, 0.0, zb), (W + 0.1, 0.0, zb), (W + 0.1, D, zf), (-W - 0.1, D, zf)], out=(0, 0, 1))
            face(part("soffit"), [(-W - 0.1, 0.0, zb - 0.04), (W + 0.1, 0.0, zb - 0.04), (W + 0.1, D, zf - 0.04), (-W - 0.1, D, zf - 0.04)], out=(0, 0, -1))
            face(pr, [(-W - 0.1, D, zf), (W + 0.1, D, zf), (W + 0.1, D, zf - 0.04), (-W - 0.1, D, zf - 0.04)], out=(0, 1, 0))
            if LOD <= 1:
                nb = int(2 * W / 0.5)
                for k in range(nb + 1):     # standing seams / battens
                    u = -W + 2 * W * k / nb
                    rod(pr, (u, 0.0, zb + 0.015), (u, D, zf + 0.015), 0.012, 3)
                for k in range(nb + 1):     # exposed rafters under the soffit
                    u = -W + 2 * W * k / nb
                    face(part("timber"), [(u - 0.035, 0.0, zb - 0.16), (u - 0.035, D - 0.05, zf - 0.16), (u - 0.035, D - 0.05, zf - 0.04), (u - 0.035, 0.0, zb - 0.04)], out=(-1, 0, 0))
                cbox(part("timber"), (-W - 0.1, D - 0.1, zf - 0.22), (W + 0.1, D, zf - 0.02), c=0.006 if LOD == 0 else 0.0)
                for sgn in (-1, 1):  # knee braces (timber brackets)
                    u = sgn * (W - 0.2)
                    tube(part("timber"), [(u, 0.02, zb - 1.1), (u, 0.5, zb - 0.9), (u, D - 0.15, zf - 0.2)], 0.05, 4)
                bulb_row([fr @ Vector((-W, D + 0.05, zf - 0.25)), fr @ Vector((W, D + 0.05, zf - 0.25))], 0.32)
    elif kind == "bullnose":
        W, D = pw + 1.0, 2.4
        z0 = Z_STR0 - 0.2
        n = {0: 7, 1: 4, 2: 2}[LOD]
        with local(fr):
            prof = [(0.0, z0 + 0.4)] + [(D * math.sin(t * math.pi / 2), z0 + 0.4 - 0.55 * (1 - math.cos(t * math.pi / 2))) for t in [k / n for k in range(1, n + 1)]]
            pr = part("roof_sheet")
            for (y0_, z0_), (y1_, z1_) in zip(prof, prof[1:]):
                face(pr, [(-W, y0_, z0_), (W, y0_, z0_), (W, y1_, z1_), (-W, y1_, z1_)], out=(0, y1_ - y0_ + 0.001, 0.5))
                face(part("soffit"), [(-W, y0_, z0_ - 0.03), (W, y0_, z0_ - 0.03), (W, y1_, z1_ - 0.03), (-W, y1_, z1_ - 0.03)], out=(0, 0, -1))
            for sgn in (-1, 1):
                face(pr, [(sgn * W, y, z) for y, z in prof] + [(sgn * W, prof[-1][0], prof[-1][1] - 0.03), (sgn * W, 0.0, prof[0][1] - 0.03)], out=(sgn, 0, 0))
            if LOD <= 1:
                nb = int(2 * W / 0.45)
                for k in range(nb + 1):
                    u = -W + 2 * W * k / nb
                    tube(pr, [(u, y, z + 0.012) for y, z in prof], 0.01, 3)
            # beam and two cast-iron columns at the kerb
            zbm = prof[-1][1] - 0.03
            cbox(pj, (-W, D - 0.12, zbm - 0.25), (W, D + 0.02, zbm), c=0.005 if LOD == 0 else 0.0)
            for sgn in (-1, 1):
                u = sgn * (W - 0.25)
                colp = [(0.0, 0.0), (0.12, 0.0), (0.12, 0.08), (0.09, 0.14), (0.07, 0.3), (0.06, 1.8), (0.055, zbm - FOOT_Z - 0.45),
                        (0.09, zbm - FOOT_Z - 0.35), (0.13, zbm - FOOT_Z - 0.28), (0.13, zbm - FOOT_Z - 0.25), (0.0, zbm - FOOT_Z - 0.25)]
                if LOD == 2:
                    colp = [(0.0, 0.0), (0.1, 0.0), (0.06, 0.3), (0.06, zbm - FOOT_Z - 0.25), (0.0, zbm - FOOT_Z - 0.25)]
                lathe(pi, colp, centre=(u, D - 0.05, FOOT_Z), seg={0: 10, 1: 6, 2: 4}[LOD])
                if LOD <= 1:   # spandrel bracket
                    tube(pi, [(u, D - 0.1, zbm - 0.9), (u, D - 0.45, zbm - 0.35), (u, D - 0.8, zbm - 0.26)], 0.015, 4)
            if LOD <= 1:
                bulb_row([fr @ Vector((-W, D + 0.06, zbm - 0.26)), fr @ Vector((W, D + 0.06, zbm - 0.26))], 0.3)
        for k in range(5):
            u = -W + 0.5 + (2 * W - 1.0) * k / 4
            lantern(tuple(fr @ Vector((u, D - 0.05, zbm - 0.26))), 0.16, 0.4, red=(k % 2 == 1))
        CANOPY_POSTS.extend([fr @ Vector((sgn * (W - 0.25), D - 0.05, FOOT_Z)) for sgn in (-1, 1)])
    elif kind == "lanterns":
        W = F["w"] / 2 - 0.4
        zb = 4.05
        with local(fr):
            cbox(part("timber"), (-W, 0.9, zb), (W, 1.08, zb + 0.22), c=0.008 if LOD == 0 else 0.0)
            for sgn in (-1, 1):
                u = sgn * (W - 0.3)
                cbox(part("timber"), (u - 0.07, 0.0, zb + 0.02), (u + 0.07, 1.0, zb + 0.18), c=0.006 if LOD == 0 else 0.0)
                tube(part("timber"), [(u, 0.02, zb - 0.7), (u, 0.5, zb - 0.25), (u, 0.95, zb + 0.02)], 0.05, 4)
            # small hood over the porch: sheet with a curved front edge
            hwp = pw + 0.4
            face(part("roof_sheet"), [(-hwp, 0.0, Z_STR0 + 0.25), (hwp, 0.0, Z_STR0 + 0.25), (hwp, 0.75, Z_STR0 - 0.05), (-hwp, 0.75, Z_STR0 - 0.05)], out=(0, 0.3, 1))
            face(part("soffit"), [(-hwp, 0.0, Z_STR0 + 0.21), (hwp, 0.0, Z_STR0 + 0.21), (hwp, 0.75, Z_STR0 - 0.09), (-hwp, 0.75, Z_STR0 - 0.09)], out=(0, 0, -1))
            cbox(part("timber"), (-hwp, 0.7, Z_STR0 - 0.15), (hwp, 0.78, Z_STR0 - 0.02), c=0.005 if LOD == 0 else 0.0)
            if LOD <= 1:
                bulb_row([fr @ Vector((-W, 1.12, zb + 0.1)), fr @ Vector((W, 1.12, zb + 0.1))], 0.3)
        n = 8
        for k in range(n):
            u = -W + 0.35 + (2 * W - 0.7) * k / (n - 1)
            lantern(tuple(fr @ Vector((u, 0.99, zb))), 0.24, 0.62, red=(k % 3 != 1))
    wnote(f"front {hid}: canopy ({kind})", {"glass": "A: iron-and-glass canopy (period type); S:158045 inset (projecting canopy with lantern row)",
                                             "scallop": "A: glazed canopy with a scalloped sheet valance",
                                             "awning": "A: timber-bracketed sheet awning (庇)", "bullnose": "A: bullnose sheet verandah on cast-iron columns",
                                             "lanterns": "S:157871 (big paper lanterns in rows along the eaves) A: beam"}[kind], "")


CANOPY_POSTS = []


def raised_button(fr, u, n0, z):
    """Porcelain rose with a brass push: 2.5 mm proud, ring groove, two slotted screws (detail-spec s6)."""
    if LOD >= 2:
        return
    seg = 14 if LOD == 0 else 8
    with local(fr @ Matrix.Translation((u, n0, z)) @ Matrix.Rotation(-math.pi / 2, 4, "X")):
        lathe(part("porcelain"), [(0.0, 0.0), (0.036, 0.0), (0.038, 0.003), (0.036, 0.007), (0.026, 0.011), (0.018, 0.013)], seg=seg)
        if LOD == 0:
            lathe(part("brass"), [(0.018, 0.013), (0.0155, 0.0135), (0.0145, 0.013), (0.0145, 0.0148), (0.0105, 0.0152), (0.0100, 0.0158),
                                  (0.0100, 0.0168), (0.0095, 0.0176), (0.0, 0.0178)], seg=seg)
            for dx in (-0.025, 0.025):
                with local(Matrix.Translation((dx, 0.0, 0.004))):
                    lathe(part("brass"), [(0.0, 0.0), (0.0035, 0.0), (0.0035, 0.0006), (0.0025, 0.0014), (0.0, 0.0016)], seg=8)
                    cbox(part("iron"), (-0.003, -0.0004, 0.0010), (0.003, 0.0004, 0.0018))


def kiosk(hid, F):
    """Ticket kiosk (切符売場) beside the front: panelled stall with a counter, a brass grille with a speaking oval and a
    money arch, a recessed brass money trough, a raised bell push, glazed sides, a back door (ajar), a sign frieze,
    a cornice with bulbs and one of five roofs.  Built from parts (detail-spec s6: >= 5 parts per box, no primitive)."""
    style, jm, side, sign = F["kiosk"]
    x = F["xc"] + side * (F["w"] / 2 + 0.95)
    y = WY - 0.72
    fr = frame_matrix(Vector((x, y, FOOT_Z)), Vector((0, -1, 0)))
    a, b = 0.62, 0.55            # half width (u), half depth (n)
    pj, pb, pg, pk = part(jm), part("brass"), part("glass"), part("kiosk_inner")
    c = 0.004 if LOD == 0 else 0.0
    with local(fr):
        cbox(part("sill"), (-a - 0.04, -b - 0.04, 0.0), (a + 0.04, b + 0.04, 0.1), c=0.01 if LOD == 0 else 0.0, skip=("-z",))
        # core and corner posts
        cbox(pj, (-a + 0.05, -b + 0.05, 0.1), (a - 0.05, b - 0.05, 1.0), c=c)
        for su in (-1, 1):
            for sn in (-1, 1):
                cbox(pj, (su * a - 0.05, sn * b - 0.05, 0.1), (su * a + 0.05, sn * b + 0.05, 2.42), c=0.006 if LOD == 0 else 0.0)
        if LOD <= 1:
            # rails and raised fielded panels on the front and both sides
            for (n0, sgn, span, axis) in ((b - 0.05, 1, a - 0.05, "u"), (-a + 0.05, -1, b - 0.05, "n"), (a - 0.05, 1, b - 0.05, "n")):
                if axis == "u":
                    for zz in (0.1, 0.9):
                        cbox(pj, (-span, n0, zz), (span, n0 + 0.025, zz + 0.1), c=c)
                    for k in range(2):
                        u0 = -span + 0.06 + k * span
                        cbox(pj, (u0, n0, 0.26), (u0 + span - 0.12, n0 + 0.018, 0.84), c=0.01 if LOD == 0 else 0.0)
                else:
                    for zz in (0.1, 0.9):
                        cbox(pj, (n0 * 1.0 - (0.025 if sgn < 0 else 0.0), -span, zz), (n0 + (0.025 if sgn > 0 else 0.0), span, zz + 0.1), c=c)
                    cbox(pj, (n0 - (0.018 if sgn < 0 else 0.0), -span + 0.06, 0.26), (n0 + (0.018 if sgn > 0 else 0.0), span - 0.06, 0.84), c=0.01 if LOD == 0 else 0.0)
        # counter with brackets, recessed brass money trough
        cbox(pj, (-a - 0.03, b - 0.08, 0.98), (a + 0.03, b + 0.2, 1.03), c=0.006 if LOD == 0 else 0.0)
        if LOD <= 1:
            for su in (-1, 1):
                cbox(pj, (su * 0.4 - 0.025, b, 0.8), (su * 0.4 + 0.025, b + 0.16, 0.98), c=c)
            lathe(pb, [(0.0, 1.033), (0.068, 1.033), (0.076, 1.036), (0.084, 1.046), (0.09, 1.047), (0.092, 1.043), (0.086, 1.031)], centre=(0.0, b + 0.07, 0.0), seg=22 if LOD == 0 else 8)
            if LOD == 0:   # a coin left in the tray (implied event)
                lathe(pb, [(0.0, 1.034), (0.0115, 1.034), (0.0118, 1.0355), (0.011, 1.0365), (0.0, 1.0365)], centre=(0.021, b + 0.05, 0.0), seg=12)
                # a punched ticket left on the counter (atlas paper, slightly curled)
                face(part("signs"), [(-0.31, b + 0.08, 1.0312), (-0.24, b + 0.1, 1.0312), (-0.235, b + 0.07, 1.034), (-0.305, b + 0.05, 1.0322)], out=(0, 0, 1),
                     uv=atlas_uv("kiosk_1", [(0, 0), (1, 0), (1, 1), (0, 1)]))
        # window zone: grille frame, glass, bars, speaking oval, money arch
        zg0, zg1 = 1.05, 2.0
        ga = a - 0.06
        face(pg, [(-ga, b - 0.08, zg0), (ga, b - 0.08, zg0), (ga, b - 0.08, zg1), (-ga, b - 0.08, zg1)], out=(0, 1, 0))
        for (u0, z0, u1, z1) in ((-ga, zg0 - 0.03, ga, zg0 + 0.02), (-ga, zg1 - 0.02, ga, zg1 + 0.03), (-ga - 0.01, zg0, -ga + 0.03, zg1), (ga - 0.03, zg0, ga + 0.01, zg1)):
            cbox(pb, (u0, b - 0.03, z0), (u1, b + 0.005, z1), c=0.002 if LOD == 0 else 0.0)
        if LOD <= 1:
            zo, ro_u, ro_z = 1.56, 0.13, 0.1
            nb = 15 if LOD == 0 else 9
            for k in range(nb):
                u = -ga + 0.05 + (2 * ga - 0.1) * k / (nb - 1)
                segs = []
                lo = 1.2 if abs(u) < 0.14 else zg0 + 0.02
                if abs(u) < ro_u:
                    dz = ro_z * math.sqrt(max(0.0, 1 - (u / ro_u) ** 2))
                    segs = [(lo, zo - dz), (zo + dz, zg1 - 0.02)]
                else:
                    segs = [(lo, zg1 - 0.02)]
                for z0, z1 in segs:
                    if z1 - z0 > 0.01:
                        rod(pb, (u, b - 0.012, z0), (u, b - 0.012, z1), 0.0055, 5 if LOD == 0 else 4, caps=False)
            nn = 28 if LOD == 0 else 10
            oval = [(ro_u * math.cos(2 * math.pi * k / nn), b - 0.012, zo + ro_z * math.sin(2 * math.pi * k / nn)) for k in range(nn + 1)]
            tube(pb, oval, 0.009, 8 if LOD == 0 else 4)
            na = 12 if LOD == 0 else 6
            arch = [(0.14 * math.cos(math.pi * k / na), b - 0.012, 1.06 + 0.13 * math.sin(math.pi * k / na)) for k in range(na + 1)]
            tube(pb, arch, 0.008, 6 if LOD == 0 else 4)
            rod(pb, (-ga, b - 0.012, 1.19), (ga, b - 0.012, 1.19), 0.006, 4)
        # side glazing with muntins, frieze sign, cornice
        for sgn in (-1, 1):
            u = sgn * (a - 0.05)
            face(pg, [(u, -b + 0.08, zg0), (u, b - 0.08, zg0), (u, b - 0.08, zg1), (u, -b + 0.08, zg1)], out=(sgn, 0, 0))
            if LOD == 0:
                cbox(pj, (u - 0.015, -b + 0.05, (zg0 + zg1) / 2 - 0.012), (u + 0.015, b - 0.05, (zg0 + zg1) / 2 + 0.012), c=0.003)
                cbox(pj, (u - 0.015, -0.012, zg0), (u + 0.015, 0.012, zg1), c=0.003)
        cbox(pj, (-a - 0.02, -b - 0.02, 2.02), (a + 0.02, b + 0.02, 2.42), c=c)
        face(part("signs"), [(a - 0.06, b + 0.025, 2.06), (-a + 0.06, b + 0.025, 2.06), (-a + 0.06, b + 0.025, 2.38), (a - 0.06, b + 0.025, 2.38)],
             out=(0, 1, 0), uv=atlas_uv(sign, [(0, 0), (1, 0), (1, 1), (0, 1)]))
        loop = [(-a - 0.03, -b - 0.03), (a + 0.03, -b - 0.03), (a + 0.03, b + 0.03), (-a - 0.03, b + 0.03)]
        cp = [(0.0, 2.42), (0.03, 2.42), (0.05, 2.46), (0.1, 2.5), (0.12, 2.53), (0.0, 2.55)]
        with local(Matrix.Identity(4)):
            pass
        sweep(pj, cp, hframes(loop, closed=True), closed_path=True, smooth=False)
        # inside: back boarding, inner shelf, ticket roll on a spindle, a cash box, a lamp
        face(pk, [(-a + 0.05, -b + 0.06, 0.95), (a - 0.05, -b + 0.06, 0.95), (a - 0.05, -b + 0.06, 2.4), (-a + 0.05, -b + 0.06, 2.4)], out=(0, 1, 0))
        face(pk, [(-a + 0.05, -b + 0.06, 2.4), (a - 0.05, -b + 0.06, 2.4), (a - 0.05, b - 0.05, 2.4), (-a + 0.05, b - 0.05, 2.4)], out=(0, 0, -1))
        face(pk, [(-a + 0.05, -b + 0.06, 1.0), (a - 0.05, -b + 0.06, 1.0), (a - 0.05, b - 0.05, 1.0), (-a + 0.05, b - 0.05, 1.0)], out=(0, 0, 1))
        if LOD == 0:
            cbox(pk, (-a + 0.06, -b + 0.06, 1.55), (a - 0.06, -b + 0.3, 1.58), c=0.003)
            with local(Matrix.Translation((0.25, 0.1, 1.06)) @ Matrix.Rotation(math.pi / 2, 4, "Y")):
                lathe(part("paint_cream"), [(0.0, -0.04), (0.055, -0.04), (0.055, 0.04), (0.0, 0.04)], seg=12)
            rod(pb, (0.17, 0.1, 1.06), (0.33, 0.1, 1.06), 0.006, 6)
            cbox(part("paint_green"), (-0.35, -0.05, 1.0), (-0.1, 0.18, 1.08), c=0.004)
            cbox(pb, (-0.36, 0.05, 1.08), (-0.09, 0.07, 1.085))
            lathe(part("lamp_glass"), [(0.0, 0.0), (0.04, -0.02), (0.05, -0.06), (0.0, -0.1)], centre=(0.0, 0.0, 2.35), seg=8)
        KIOSK_LAMPS.append(fr @ Vector((0.0, 0.0, 2.1)))
        # back door (ajar, implied event: the clerk has just stepped out); built in a frame turned to face the back
        if LOD <= 1:
            dw = 0.56
            hinge = -dw / 2
            with local(Matrix.Rotation(math.pi, 4, "Z")):
                m = Matrix.Translation((hinge, b, 0.0)) @ Matrix.Rotation(0.3, 4, "Z") @ Matrix.Translation((-hinge, -b, 0.0))
                with local(m):
                    door_leaf(pj, pg, pb, -dw / 2, dw / 2, 0.12, 1.96, b, glazed=False, lod=LOD, hinge_left=True, knob=True)
        # roof
        roof_kiosk(style, a + 0.12, b + 0.12, 2.55, jm)
    raised_button(frame_matrix(Vector((x, y, FOOT_Z)), Vector((0, -1, 0))) @ Matrix.Translation((a - 0.0, b + 0.05, 0.0)), 0.0, 0.0, 1.32)
    if LOD <= 1:
        loopw = [fr @ Vector((u, n, 2.56)) for u, n in ((-a - 0.12, b + 0.14), (a + 0.12, b + 0.14))]
        bulb_row(loopw, 0.22)
    KIOSKS.append((hid, x, y, a, b, fr))
    wnote(f"front {hid}: ticket kiosk ({style})", "A: 1912 kiosk type (no photo legible at this size); detail-spec s6 parts, gloss, raised button",
          "brass grille 15 bars, speaking oval, money arch and trough; bell push (+ unverified for 1912 Osaka); back door ajar")


KIOSKS, KIOSK_LAMPS = [], []


def roof_kiosk(style, ha, hb, z0, jm):
    pr = part("roof_sheet")
    seg = {0: 16, 1: 8, 2: 4}[LOD]
    if style == "pyramid":
        apex = (0.0, 0.0, z0 + 0.62)
        corners = [(-ha, -hb, z0), (ha, -hb, z0), (ha, hb, z0), (-ha, hb, z0)]
        for p1, p2 in zip(corners, corners[1:] + corners[:1]):
            face(pr, [p1, p2, apex], out=((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, 0.5))
        if LOD <= 1:
            for p1 in corners:
                rod(pr, p1, apex, 0.018, 4)
        finial(part("gilt"), 0.0, 0.0, z0 + 0.58, 0.9, "spike")
    elif style == "bell":
        lathe(pr, [(ha * 1.15, 0.0), (ha * 1.05, 0.06), (ha * 0.75, 0.18), (ha * 0.55, 0.38), (ha * 0.45, 0.6), (ha * 0.2, 0.75), (0.0, 0.8)],
              centre=(0.0, 0.0, z0), seg=seg, sq=lambda z: 6.0 - 4.0 * min(1.0, z / 0.6), ang0=math.pi / 4)
        finial(part("gilt"), 0.0, 0.0, z0 + 0.78, 0.8, "ball")
    elif style == "cresting":
        cbox(pr, (-ha, -hb, z0), (ha, hb, z0 + 0.06), c=0.006 if LOD == 0 else 0.0)
        if LOD <= 1:
            n = 9
            for sx, sy, ex, ey in ((-ha, hb, ha, hb), (-ha, -hb, ha, -hb), (-ha, -hb, -ha, hb), (ha, -hb, ha, hb)):
                for k in range(n + 1):
                    t = k / n
                    px, py = sx + (ex - sx) * t, sy + (ey - sy) * t
                    rod(part("iron"), (px, py, z0 + 0.06), (px, py, z0 + 0.3 + 0.08 * (k % 2)), 0.006, 3)
                rod(part("iron"), (sx, sy, z0 + 0.22), (ex, ey, z0 + 0.22), 0.007, 3)
            finial(part("gilt"), 0.0, 0.0, z0 + 0.06, 0.7, "ball")
    elif style == "hip":
        e = 0.18
        ridge = 0.3
        zt = z0 + 0.5
        c4 = [(-ha - e, -hb - e, z0 - 0.06), (ha + e, -hb - e, z0 - 0.06), (ha + e, hb + e, z0 - 0.06), (-ha - e, hb + e, z0 - 0.06)]
        r2 = [(-ridge, 0.0, zt), (ridge, 0.0, zt)]
        face(pr, [c4[0], c4[1], r2[1], r2[0]], out=(0, -1, 1))
        face(pr, [c4[2], c4[3], r2[0], r2[1]], out=(0, 1, 1))
        face(pr, [c4[1], c4[2], r2[1]], out=(1, 0, 1))
        face(pr, [c4[3], c4[0], r2[0]], out=(-1, 0, 1))
        face(part("soffit"), [c4[0], c4[1], c4[2], c4[3]], out=(0, 0, -1))
        rod(part("roof_lead"), r2[0], r2[1], 0.04, 5)
        for q in r2:
            cbox(part("roof_lead"), (q[0] - 0.06, -0.06, zt - 0.03), (q[0] + 0.06, 0.06, zt + 0.1), c=0.01 if LOD == 0 else 0.0)
    elif style == "dome":
        lathe(pr, [(ha * 1.12, 0.0), (ha * 1.12, 0.05), (ha * 0.98, 0.1), (ha * 0.95, 0.3), (ha * 0.8, 0.55), (ha * 0.55, 0.75), (ha * 0.25, 0.86), (0.0, 0.9)],
              centre=(0.0, 0.0, z0), seg=seg)
        finial(part("gilt"), 0.0, 0.0, z0 + 0.88, 0.9, "spike")


# ---------------------------------------------------------------------------------------------
# 6. Halls: long walls with pilasters, windows, doors, boards and posters; roofs, gutters, pipes; ends and fire walls
# ---------------------------------------------------------------------------------------------
def bays(hid):
    c0, c1 = CLEAR[hid]
    n = int((c1 - c0) / 3.0)
    return [c0 + (c1 - c0) * k / n for k in range(n + 1)]     # pilaster lines (W1: the interior rib bays, int(35.85/3) = 11)


def hall_zones(wm, top=Z_CORN):
    z = [(0.0, PLINTH - 0.06, "plinth", 0.06, 0.06), (PLINTH - 0.06, PLINTH, "plinth", 0.06, 0.0)]
    z += zones_std(PLINTH, Z_STR0, "flat", wm)
    z += zones_std(Z_STR0, top, "flat", wm)
    return z


def hall_south(hid):
    """South (street) wall of one hall outside its frontispiece."""
    x0, x1 = HALL_X[hid]
    F = FRONTS[hid]
    fl, frt = F["xc"] - F["w"] / 2, F["xc"] + F["w"] / 2
    fr = S_FR(0.0, WY)            # u = -x
    lines = bays(hid)
    kx = F["xc"] + F["kiosk"][2] * (F["w"] / 2 + 0.95)
    windows, doors, boards, posters = [], [], [], []
    wm = "wallh_" + hid
    PIL_MAT[0] = wm
    boards_low = []
    # bays: centre of each span between pilaster lines
    rnd = random.Random("south-" + hid)
    for i, (xa, xb) in enumerate(zip(lines, lines[1:])):
        xm = (xa + xb) / 2
        if fl - 0.8 < xm < frt + 0.8:
            continue
        if hid != "W1":
            windows.append(Op("seg", -xm, 1.1, 6.3, 7.8, rise=0.15, tag=f"window_{hid}_S{i}"))
        near_kiosk = abs(xm - kx) < 1.6
        if hid != "W1" and i == (1 if hid in ("W2",) else len(lines) - 3) and not near_kiosk:
            doors.append(Op("rect", -xm, 1.2, FOOT_Z, 2.65, tag=f"door_cinema_{hid}_exit"))
            continue
        if hid == "W1":
            if i % 3 != 1 and not near_kiosk:
                boards.append((xm, "board_" + str((i // 2) % 6 + 1 if (i // 2) % 6 + 1 < 6 else 5)))
            if not near_kiosk:
                posters.append(xm)
        elif i % 2 == 0 and not near_kiosk:
            posters.append(xm)
        elif i % 4 == 1 and not near_kiosk:
            boards_low.append((xm, f"board_{(i + len(hid) * 2) % 6}"))
    # wall segments either side of the frontispiece
    zones = hall_zones(wm)
    segs = [(a, b) for a, b in ((x0, fl), (frt, x1)) if b - a > 0.05]
    for a, b in segs:
        ops = [o for o in windows + doors if a < -o.uc < b]
        wall(fr, -b, -a, zones, ops, step=0.05 if LOD == 0 else 0.1)
        with local(fr):
            sfr = [(Vector((-b, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), (Vector((-a, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))]
            sweep(part("trim"), [(0.0, Z_STR0 + 0.05), (0.05, Z_STR0 + 0.05), (0.07, Z_STR0 + 0.12), (0.07, Z_STR0 + 0.2), (0.0, Z_STR0 + 0.25)], sfr, smooth=False, caps=True)
        if LOD <= 1:   # bulb rail at the eaves (continues the base's night outline along the wing eaves)
            bulb_row([Vector((a + 0.3, WY - 0.36, Z_CORN + 0.33)), Vector((b - 0.3, WY - 0.36, Z_CORN + 0.33))], 0.45)
            tube(part("iron"), [(a + 0.2, WY - 0.34, Z_CORN + 0.36), (b - 0.2, WY - 0.34, Z_CORN + 0.36)], 0.01, 4)
    for o in windows:
        add_win(fr, o, hid)
    for o in doors:
        reveal_nf(fr, o, WT, "reveal", floor_part="sill")
        surround(fr, o)
        door_fill(fr, o, leaves=1, glazed=False, n_face=-0.12, threshold=True)
        DOORS_W.append((fr, o, hid, "exit"))
        if LOD == 0:
            with local(fr):
                face(part("signs"), [(o.uc + 0.26, 0.012, o.z1 + 0.25), (o.uc - 0.26, 0.012, o.z1 + 0.25), (o.uc - 0.26, 0.012, o.z1 + 0.51), (o.uc + 0.26, 0.012, o.z1 + 0.51)],
                     out=(0, 1, 0), uv=atlas_uv("plate_0", [(0, 0), (1, 0), (1, 1), (0, 1)]))
                cbox(part("iron"), (o.uc - 0.28, 0.0, o.z1 + 0.23), (o.uc + 0.28, 0.01, o.z1 + 0.53), c=0.0015 if LOD == 0 else 0.0, skip=("-y",))
    # pilasters on the bay lines (skip inside the front block and at the ends: the fire-wall piers stand there)
    pil = [xl for xl in lines if not (fl - 0.4 < xl < frt + 0.4) and not abs(xl - kx) < 0.9]
    for xl in pil:
        pilaster(fr, -xl)
    # boards (W1: its long wall has no windows: the interior has none), posters with lamps
    for xm, slot in boards:
        painted_board(fr, -xm, 6.0, 2.5, 0.94, slot, n0=0.0, stand=0.12, lamps=1)
    for xm, slot in boards_low:
        painted_board(fr, -xm, 3.25, 2.3, 0.86, slot, n0=0.0, stand=0.1, lamps=1)
    for j, xm in enumerate(posters):
        slots = [f"poster_{(j * 3 + k + len(hid)) % 20}" for k in range(2)]
        for k, du in enumerate((-0.42, 0.42)):
            poster_frame(fr, -xm + du, 1.85, 0.6, 0.9, slots[k], n0=0.0, glazed=(k == 0), lamp=(k == 0), torn=(j % 2 == 1 and k == 1))
    # cornice at the eaves
    with local(fr):
        cfr = [(Vector((-x1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), (Vector((-x0, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))]
        sweep(part("trim"), hall_cornice(), cfr, smooth=False, caps=True)
    # downpipes on two pilaster lines clear of the front block and the kiosk
    cand = [xl for xl in pil if xl not in (lines[0], lines[-1])]
    for xl in (cand[:1] + cand[-1:]) if len(cand) > 1 else cand:
        downpipe(xl + 0.45, -1)
    wnote(f"hall {hid}: south wall", "T:fr.267 (wings, halls) A: bays on the interior rib lines, windows" if hid != "W1" else
          "T:fr.267; ../interior (W1 has no windows: the house is dark; the long wall carries painted boards and posters) A:", "")
    return windows, doors


def hall_cornice():
    if LOD == 2:
        return [(0.0, Z_CORN), (0.26, Z_CORN + 0.22), (0.28, Z_CORN + 0.32), (0.0, Z_CORN + 0.42)]
    return [(0.0, Z_CORN), (0.04, Z_CORN), (0.04, Z_CORN + 0.05), (0.1, Z_CORN + 0.1), (0.14, Z_CORN + 0.16), (0.26, Z_CORN + 0.22),
            (0.28, Z_CORN + 0.22), (0.28, Z_CORN + 0.3), (0.29, Z_CORN + 0.32), (0.12, Z_CORN + 0.37), (0.0, Z_CORN + 0.42)]


def downpipe(x, sgn, zb=None):
    """Cast-iron downpipe from the eaves gutter: swan neck, hopper head, holderbats every 1.8 m, shoe (A: positions)."""
    yw = sgn * 9.0
    yp = sgn * 9.11
    zt = roof_z(ROOF_Y) - 0.2
    zb = FOOT_Z if zb is None else zb
    r = 0.05
    seg = {0: 6, 1: 5, 2: 4}[LOD]
    pi = part("iron")
    tube(pi, [(x, sgn * 9.55, zt + 0.02), (x, sgn * 9.4, zt - 0.2), (x, yp, zt - 0.35)], 0.035, seg)
    if LOD <= 1:
        cbox(pi, (x - 0.13, yp - 0.12, zt - 0.72), (x + 0.13, yp + 0.12, zt - 0.4), c=0.006 if LOD == 0 else 0.0, skip=("+z",))
        if LOD == 0:
            cbox(pi, (x - 0.15, yp - 0.14, zt - 0.43), (x + 0.15, yp + 0.14, zt - 0.39), c=0.004)
    tube(pi, [(x, yp, zt - 0.72), (x, yp, zb + 0.3)], r, seg)
    tube(pi, [(x, yp, zb + 0.3), (x, yp, zb + 0.15), (x, yp + sgn * 0.14, zb + 0.05)], r, seg)
    if LOD <= 1:
        z = zt - 1.2
        while z > 0.8:
            lathe(pi, [(r + 0.012, -0.03), (r + 0.012, 0.03)], centre=(x, yp, z), seg=seg)
            cbox(pi, (x - 0.012, min(yw, yp - sgn * r), z - 0.03), (x + 0.012, max(yw, yp - sgn * r), z + 0.03))
            z -= 1.8


PIL_MAT = ["wall_hall"]


def pilaster(fr, u, w=0.5, proj=0.1, z1=Z_CORN - 0.02, plain=False):
    c = 0.012 if (LOD == 0 and not plain) else 0.0
    with local(fr):
        cbox(part("trim"), (u - w / 2 - 0.05, 0.0, 0.0), (u + w / 2 + 0.05, proj + 0.06, PLINTH + 0.25), c=c, skip=("-y", "-z"))
        cbox(part(PIL_MAT[0]), (u - w / 2, 0.0, PLINTH + 0.25), (u + w / 2, proj, z1 - 0.3), c=c, skip=("-y",))
        cbox(part("trim"), (u - w / 2 - 0.06, 0.0, z1 - 0.3), (u + w / 2 + 0.06, proj + 0.05, z1), c=c, skip=("-y",))


def add_win(fr, o, hid, backing=True, shutters=True):
    HALL[0] = hid
    WIN_SEED[0] += 1
    reveal(fr, o, WT, "reveal")
    surround(fr, o)
    sill(fr, o)
    window_fill(fr, o, lit_seed=WIN_SEED[0] + hash(hid) % 97, backing=backing)
    WINDOWS_W.append((fr, o, hid))
    if shutters and LOD <= 1 and o.kind == "seg" and o.w > 1.0:
        shutter_pair(fr, o, WIN_SEED[0])


WIN_SEED = [0]


def shutter_pair(fr, o, seed):
    """Louvred shutters (exterior), per window either folded back open, one half closed, or both closed (A: period type)."""
    r = random.Random(seed)
    mode = r.choice(("open", "open", "half", "closed"))
    pj = part("paint_green")
    hw = o.w / 2
    h = o.z1 - o.z0 + 0.1
    for sgn in (-1, 1):
        closed = mode == "closed" or (mode == "half" and sgn > 0)
        ang = 0.0 if closed else sgn * -2.9
        hinge = o.uc + sgn * hw
        m = Matrix.Translation((hinge, 0.02, 0)) @ Matrix.Rotation(ang, 4, "Z") @ Matrix.Translation((-hinge, -0.02, 0))
        with local(fr @ m):
            u0, u1 = sorted((hinge, hinge - sgn * hw))
            c = 0.0
            cbox(pj, (u0, 0.0, o.z0), (u0 + 0.05, 0.035, o.z0 + h), c=c)
            cbox(pj, (u1 - 0.05, 0.0, o.z0), (u1, 0.035, o.z0 + h), c=c)
            cbox(pj, (u0 + 0.05, 0.0, o.z0), (u1 - 0.05, 0.035, o.z0 + 0.08), c=c)
            cbox(pj, (u0 + 0.05, 0.0, o.z0 + h - 0.08), (u1 - 0.05, 0.035, o.z0 + h), c=c)
            if LOD == 0:
                n = int((h - 0.16) / 0.08)
                for k in range(n):
                    z = o.z0 + 0.08 + (h - 0.16) * (k + 0.5) / n
                    face(pj, [(u0 + 0.05, 0.03, z + 0.02), (u1 - 0.05, 0.03, z + 0.02), (u1 - 0.05, 0.005, z - 0.02), (u0 + 0.05, 0.005, z - 0.02)], out=(0, 1, 1))
            else:
                face(pj, [(u0 + 0.05, 0.018, o.z0 + 0.08), (u1 - 0.05, 0.018, o.z0 + 0.08), (u1 - 0.05, 0.018, o.z0 + h - 0.08), (u0 + 0.05, 0.018, o.z0 + h - 0.08)], out=(0, 1, 0))


def hall_north(hid):
    """Rear wall: plinth, pilasters, windows (not W1: its interior north wall is solid), a rear door, cornice."""
    global LOD
    x0, x1 = HALL_X[hid]
    fr = N_FR(0.0, WYN)      # u = +x
    lines = bays(hid)
    ops, doors = [], []
    for i, (xa, xb) in enumerate(zip(lines, lines[1:])):
        xm = (xa + xb) / 2
        if hid != "W1" and i % 2 == 1:
            ops.append(Op("seg", xm, 1.1, 6.3, 7.8, rise=0.15, tag=f"window_{hid}_N{i}"))
        if hid != "W1" and i == len(lines) // 2:
            doors.append(Op("rect", xm, 1.2, FOOT_Z, 2.7, tag=f"door_cinema_{hid}_rear"))
    PIL_MAT[0] = "wallh_" + hid
    wall(fr, x0, x1, hall_zones("wallh_" + hid), ops + doors, step=0.1)
    lod_saved = LOD
    REAL_LOD[0] = LOD
    LOD = max(LOD, 1)       # A: yard side (not public, seen from >= 20 m): the LOD1 window / door kit also in LOD0 (reveal depth, frame,
    for o in ops:           # meeting rail, glass and backing kept: detail-spec s1 LOD1 column)
        add_win(fr, o, hid, shutters=False)
    for o in doors:
        reveal_nf(fr, o, WT, "reveal", floor_part="sill")
        surround(fr, o)
        door_fill(fr, o, leaves=1, glazed=False, n_face=-0.12, threshold=True)
        DOORS_W.append((fr, o, hid, "rear"))
        with local(fr):   # stone step down to the yard (ground z 0 on the north side)
            cbox(part("sill"), (o.uc - o.w / 2 - 0.15, 0.0, -0.1), (o.uc + o.w / 2 + 0.15, 0.4, FOOT_Z - 0.005), c=0.012 if lod_saved == 0 else 0.0, skip=("-z", "-y"))
    LOD = lod_saved
    REAL_LOD[0] = None
    for xl in lines[1:-1]:
        pilaster(fr, xl, plain=True)
    for xl in (lines[2], lines[-3]):
        downpipe(xl + 0.45, 1, zb=0.0)
    with local(fr):
        cfr = [(Vector((x0, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), (Vector((x1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))]
        sweep(part("trim"), hall_cornice(), cfr, smooth=False, caps=True)
    wnote(f"hall {hid}: north wall", "A: rear walls (not photographed); W1 solid to match ../interior", "")


def roof_z(y):
    R = (9.0 ** 2 + (ROOF_CROWN - Z_WP) ** 2) / (2 * (ROOF_CROWN - Z_WP))
    return ROOF_CROWN - R + math.sqrt(max(0.0, R * R - y * y))


def roof_ends(hid):
    """Roof x extent: to the base party wall, to the inner face of a free-end gable, or to the fire-wall faces."""
    x0, x1 = HALL_X[hid]

    def adj(x, sgn):
        if abs(abs(x) - 87.2) < 1e-6:
            return x + sgn * WT
        if abs(abs(x) - XB) < 1e-6:
            return x
        return x + sgn * WT / 2
    return adj(x0, 1), adj(x1, -1)


def roof_normal(y):
    R = (9.0 ** 2 + (ROOF_CROWN - Z_WP) ** 2) / (2 * (ROOF_CROWN - Z_WP))
    zc = ROOF_CROWN - R
    v = Vector((0.0, y, roof_z(y) - zc))
    return v.normalized()


def hall_roof(hid):
    """Segmental barrel roof of galvanised sheet on roll battens (S:157674 curved ribbed roof beside the base; A: sheet,
    rise and battens), fascia and boarded soffit, half-round gutters on brackets, ridge ventilators, flashings."""
    xa, xb = roof_ends(hid)
    nseg = {0: 16, 1: 10, 2: 6}[LOD]
    ys = [-ROOF_Y + 2 * ROOF_Y * k / nseg for k in range(nseg + 1)]
    pr = part("roof_sheet")
    for ya, yb in zip(ys, ys[1:]):
        face(pr, [(xa, ya, roof_z(ya)), (xb, ya, roof_z(ya)), (xb, yb, roof_z(yb)), (xa, yb, roof_z(yb))], out=tuple(roof_normal((ya + yb) / 2)))
    if LOD <= 1:
        spacing = 1.8 if LOD == 0 else 3.6
        nb = max(1, int((xb - xa) / spacing))
        prof = [(0.03, 0.0), (0.0, 0.04), (-0.03, 0.0)]
        for k in range(1, nb):
            x = xa + (xb - xa) * k / nb
            frs = [(Vector((x, y, roof_z(y))), Vector((1, 0, 0)), roof_normal(y)) for y in ys]
            sweep(pr, prof, frs, smooth=False)
    for sgn in (-1, 1):
        y = sgn * ROOF_Y
        z = roof_z(ROOF_Y)
        # fascia board, and a boarded soffit following the curve under the overhang
        cbox(part("joinery"), (xa, min(y, y + sgn * 0.03), z - 0.22), (xb, max(y, y + sgn * 0.03), z + 0.02), c=0.004 if LOD == 0 else 0.0)
        ys2 = [sgn * (9.0 + 0.45 * k / 3) for k in range(4)]
        for ya, yb in zip(ys2, ys2[1:]):
            face(part("soffit"), [(xa, ya, roof_z(ya) - 0.05), (xb, ya, roof_z(ya) - 0.05), (xb, yb, roof_z(yb) - 0.05), (xa, yb, roof_z(yb) - 0.05)], out=(0, 0, -1))
        # half-round gutter on brackets (outside and inside surfaces: it is seen from the roof garden)
        gy = y + sgn * 0.1
        gz = z - 0.12
        gp = ([(-0.075, 0.012), (-0.07, 0.0), (-0.05, -0.05), (0.0, -0.075), (0.05, -0.05), (0.07, 0.0), (0.075, 0.012)] if LOD <= 1
              else [(-0.075, 0.01), (0.0, -0.075), (0.075, 0.01)])
        frs = [(Vector((xa, gy, gz)), Vector((0, 1, 0)), Vector((0, 0, 1))), (Vector((xb, gy, gz)), Vector((0, 1, 0)), Vector((0, 0, 1)))]
        sweep(part("iron"), gp, frs, smooth=True, caps=False)
        if LOD <= 1:
            sweep(part("iron"), [(a * 0.9, b * 0.9 + 0.002) for a, b in reversed(gp[1:-1])], frs, smooth=True, caps=False)
        if LOD == 0:
            n = int((xb - xa) / 2.0)
            for k in range(n + 1):
                x = xa + 0.1 + (xb - xa - 0.2) * k / n
                cbox(part("iron"), (x - 0.015, min(y, gy + sgn * 0.08), gz - 0.1), (x + 0.015, max(y, gy + sgn * 0.08), gz - 0.085))
    # ridge ventilators (越屋根-type louvred boxes) along the crown
    nv = 3 if (xb - xa) > 30 else 2
    for k in range(nv):
        xv = xa + (xb - xa) * (k + 0.5) / nv
        ventilator(xv)
    # W1: sheet-iron vent pipe over the projection booth (interior: booth at the tower end, lamp house with a chimney)
    if hid == "W1":
        vent_pipe(-17.2, 3.2)
    wnote(f"hall {hid}: barrel roof", "S:157674 (large curved ribbed roof beside the base) A: galvanised sheet, crown 12.1 m (0.5 m under the base L3 sills 12.6), roll battens every 1.8 m",
          "ridge ventilators A: (halls needed ventilation); W1 booth vent pipe A: (from ../interior booth)")


def ventilator(x):
    zc = ROOF_CROWN
    L, Wd, H = 2.4, 1.3, 0.85
    pj = part("roof_sheet")
    c = 0.006 if LOD == 0 else 0.0
    zb = roof_z(Wd / 2) - 0.02
    cbox(part("joinery"), (x - L / 2, -Wd / 2, zb), (x + L / 2, Wd / 2, zc + 0.12), c=c)
    cbox(part("iron"), (x - L / 2 + 0.08, -Wd / 2 - 0.01, zc + 0.12), (x + L / 2 - 0.08, Wd / 2 + 0.01, zc + H - 0.1))
    if LOD <= 1:
        n = 6 if LOD == 0 else 3
        for sgn in (-1, 1):
            for k in range(n):
                z = zc + 0.17 + (H - 0.3) * (k + 0.5) / n
                y = sgn * (Wd / 2 + 0.02)
                face(part("joinery"), [(x - L / 2 + 0.08, y, z + 0.05), (x + L / 2 - 0.08, y, z + 0.05), (x + L / 2 - 0.08, y + sgn * 0.06, z - 0.04), (x - L / 2 + 0.08, y + sgn * 0.06, z - 0.04)],
                     out=(0, sgn, 0.6))
        for sx in (-1, 1):
            cbox(part("joinery"), (x + sx * L / 2 - (0.08 if sx > 0 else 0.0), -Wd / 2 - 0.03, zc + 0.12), (x + sx * L / 2 + (0.0 if sx > 0 else 0.08), Wd / 2 + 0.03, zc + H - 0.1), c=c)
    # small curved cap
    n = {0: 6, 1: 4, 2: 2}[LOD]
    ys = [-Wd / 2 - 0.2 + (Wd + 0.4) * k / n for k in range(n + 1)]
    zt = lambda y: zc + H - 0.1 + 0.28 * (1 - (y / (Wd / 2 + 0.2)) ** 2)
    for ya, yb in zip(ys, ys[1:]):
        face(pj, [(x - L / 2 - 0.15, ya, zt(ya)), (x + L / 2 + 0.15, ya, zt(ya)), (x + L / 2 + 0.15, yb, zt(yb)), (x - L / 2 - 0.15, yb, zt(yb))], out=(0, (ya + yb) / 2, 1))
        face(part("soffit"), [(x - L / 2 - 0.15, ya, zt(ya) - 0.03), (x + L / 2 + 0.15, ya, zt(ya) - 0.03), (x + L / 2 + 0.15, yb, zt(yb) - 0.03), (x - L / 2 - 0.15, yb, zt(yb) - 0.03)], out=(0, 0, -1))
    for sx in (-1, 1):
        face(pj, [(x + sx * (L / 2 + 0.15), y, zt(y)) for y in ys] + [(x + sx * (L / 2 + 0.15), ys[-1], zt(ys[-1]) - 0.03), (x + sx * (L / 2 + 0.15), ys[0], zt(ys[0]) - 0.03)], out=(sx, 0, 0))


def vent_pipe(x, y):
    seg = {0: 8, 1: 6, 2: 4}[LOD]
    z0 = roof_z(y) - 0.05
    lathe(part("roof_lead"), [(0.32, 0.0), (0.2, 0.18), (0.16, 0.2)], centre=(x, y, z0), seg=seg)
    lathe(part("iron"), [(0.16, 0.2), (0.16, 2.4), (0.19, 2.42), (0.19, 2.5), (0.16, 2.52), (0.16, 2.7)], centre=(x, y, z0), seg=seg)
    lathe(part("iron"), [(0.0, 2.72), (0.34, 2.8), (0.36, 2.83), (0.2, 3.05), (0.0, 3.12)], centre=(x, y, z0), seg=seg)
    for k in range(3):   # guy stays
        a = 2 * math.pi * k / 3 + 0.3
        rod(part("iron"), (x, y, z0 + 2.1), (x + 1.3 * math.cos(a), y + 1.3 * math.sin(a), roof_z(y + 1.3 * math.sin(a)) + 0.02), 0.006, 3)


def fire_wall(xw, sgn_face):
    """Cross wall (fire wall) standing 0.55 m proud of the two roofs, with a coping and a bulb row; flush end piers on
    both long faces rising above the cornice."""
    fr = frame_matrix(Vector((xw, 0, 0)), Vector((sgn_face, 0, 0)))
    s = -1 if sgn_face > 0 else 1
    n = {0: 20, 1: 12, 2: 6}[LOD]
    ol = []
    for k in range(n + 1):
        y = -ROOF_Y + 2 * ROOF_Y * k / n
        ol.append((y * s, roof_z(y) + 0.55))
    ol.sort()
    parapet(fr, [(u, z) for u, z in ol], EAVES - 0.2, WT, "wall_hall", n0=WT / 2, coping="trim", bulbs=0.5, bulb_n=0.1)
    for ys in (WY, WYN):
        o = -1 if ys < 0 else 1
        c = 0.015 if LOD == 0 else 0.0
        cbox(part("trim"), (xw - 0.55, ys + (o * 0.0) - (0.12 if o < 0 else 0.0), 0.0), (xw + 0.55, ys + (0.12 if o > 0 else 0.0), EAVES + 0.9),
             c=c, skip=("+y",) if o < 0 else ("-y",))
        cbox(part("trim"), (xw - 0.62, ys - (0.18 if o < 0 else 0.0) + (0.0 if o < 0 else -0.05), EAVES + 0.9), (xw + 0.62, ys + (0.18 if o > 0 else 0.0) + (0.05 if o < 0 else 0.0), EAVES + 1.05), c=c)
        finial(part("trim"), xw, ys + o * 0.05, EAVES + 1.05, 0.9)
    wnote("fire walls between halls (右二棟 / 左三棟 = separate buildings)", "T:fr.267 (二棟 / 三棟: separate buildings) A: fire-wall parapets", "")


def end_wall(hid, xe):
    """Free end of a wing (W2 west, E3 east): wall to the eaves, arched gable parapet over the barrel roof, windows,
    pilasters, a board.  sgn = outward x direction."""
    sgn = 1 if xe > 0 else -1
    fr = frame_matrix(Vector((xe, 0, 0)), Vector((sgn, 0, 0)))
    s = -1 if sgn > 0 else 1        # u = s * y
    ops = [Op("seg", s * yy, 1.1, 6.3, 7.8, rise=0.15, tag=f"window_{hid}_end{k}") for k, yy in enumerate((-4.5, 4.5))]
    zones = hall_zones("wallh_" + hid)
    PIL_MAT[0] = "wallh_" + hid
    wall(fr, -9.0, 9.0, zones, ops, step=0.1)
    for o in ops:
        add_win(fr, o, hid)
    n = {0: 24, 1: 14, 2: 8}[LOD]
    ol = []
    for k in range(n + 1):
        y = -9.0 + 18.0 * k / n
        ol.append((s * y, max(EAVES + 0.4, roof_z(y) + 0.7)))
    ol.sort()
    parapet(fr, ol, Z_CORN, WT, "wallh_" + hid, n0=0.0, coping="trim", bulbs=0.45)
    for yy in (-8.6, -3.0, 3.0, 8.6):
        pilaster(fr, s * yy, w=0.6 if abs(yy) > 8 else 0.5)
    with local(fr):
        cfr = [(Vector((-9.0, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), (Vector((9.0, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))]
        sweep(part("trim"), hall_cornice(), cfr, smooth=False, caps=True)
    painted_board(fr, 0.0, 3.4, 4.2, 1.58, "board_5" if hid == "W2" else "board_1", n0=0.0, stand=0.12, lamps=2)
    board_face(fr, 0.0, 8.2, 3.6, 0.62, "band_A", n0=0.0)
    wnote(f"end wall {hid}", "A: free wing end with an arched gable parapet over the barrel (S:157674 arched gable beside the base)", "")


def base_door_reveals():
    """The 0.45 m wing wall zone at the base party walls (x +/-14.5..14.95): reveal and threshold of door_wing_W/E, so
    the base door, this zone and the cinema cell's own opening meet without a gap (INTERFACE: 2.4 wide; cell head 3.25 = 3.40 world)."""
    for sx in (-1, 1):
        x_in = sx * 14.95
        fr = frame_matrix(Vector((x_in, 0, 0)), Vector((sx, 0, 0)))    # faces the hall; n < 0 goes to the base
        o = Op("rect", 0.0, 2.4, FOOT_Z, 3.4, tag="door_wing_" + ("E" if sx > 0 else "W"))
        reveal_nf(fr, o, 0.45, "reveal", floor_part="sill")
        if LOD <= 1:   # the hall-side face of this wall (cell x = 0: "the exterior's", ../interior/README); plain plaster, the cell dresses it
            wall(fr, -8.55, 8.55, [(FOOT_Z, 9.0, ("W1" if sx < 0 else "E1") + "_endwall", 0.0, 0.0)], [o], step=0.2)
        # riser from the base threshold stone (top 0.03) up to 0.15 at the base face
        x_b = sx * 14.5
        face(part("sill"), [(x_b, -1.2, 0.03), (x_b, 1.2, 0.03), (x_b, 1.2, FOOT_Z), (x_b, -1.2, FOOT_Z)], out=(-sx, 0, 0))
        IF_EXTRA.append(("IF_wing_door_wing_" + ("E" if sx > 0 else "W"), fr @ Matrix.Translation((0.0, 0.0, FOOT_Z)),
                         {"width": 2.4, "sill": FOOT_Z, "head": 3.4, "kind": "rect", "matches": "base door_wing_" + ("E" if sx > 0 else "W") + " + cell_cinema x=0 opening"}))


IF_EXTRA = []


# ---------------------------------------------------------------------------------------------
# 7. Street edge: footway, kerb, gutter channel, poles and wires, nobori, event props
# ---------------------------------------------------------------------------------------------
def footway(side):
    xs = (-87.2, -XB) if side < 0 else (XB, 87.2)
    x0, x1 = xs
    pk, pf = part("kerb"), part("footway")
    step = 1.8
    n = int(round((x1 - x0) / step))
    c = 0.006 if LOD == 0 else 0.0
    for k in range(n):
        a, b = x0 + (x1 - x0) * k / n, x0 + (x1 - x0) * (k + 1) / n
        if LOD <= 1:
            for (ya, yb) in ((-10.8, WY), (FOOT_Y, -10.8)):
                cbox(pf, (a + 0.003, ya + 0.003, 0.05), (b - 0.003, yb - 0.003, FOOT_Z), c=c, skip=("-z",), jitter=0.3)
            cbox(pk, (a + 0.003, KERB_Y, -0.22), (b - 0.003, FOOT_Y - 0.003, FOOT_Z + 0.005), c=0.012 if LOD == 0 else 0.0, skip=("-z",), jitter=0.4)
            if LOD == 0:
                INSTANCES_W["footway_slab"].append([round(a, 3), round(b, 3)])
                INSTANCES_W["kerb"].append([round(a, 3), round(b, 3)])
    if LOD <= 1:   # mortar bed under the slab and kerb joints (a joint is a groove, never a hole)
        face(part("sill"), [(x0, KERB_Y, FOOT_Z - 0.01), (x1, KERB_Y, FOOT_Z - 0.01), (x1, WY, FOOT_Z - 0.01), (x0, WY, FOOT_Z - 0.01)], out=(0, 0, 1))
    if LOD == 2:
        cbox(pf, (x0, FOOT_Y, 0.0), (x1, WY, FOOT_Z), skip=("-z",))
        cbox(pk, (x0, KERB_Y, -0.22), (x1, FOOT_Y, FOOT_Z), skip=("-z",))
    # open gutter channel (側溝) beyond the kerb: stone-lined, bridged by slabs at the porches
    gy0, gy1 = KERB_Y, KERB_Y - 0.36
    face(pk, [(x0, gy0, -0.24), (x1, gy0, -0.24), (x1, gy1, -0.24), (x0, gy1, -0.24)], out=(0, 0, 1))
    face(pk, [(x0, gy1, -0.24), (x1, gy1, -0.24), (x1, gy1, 0.0), (x0, gy1, 0.0)], out=(0, 1, 0))
    face(pk, [(x0, gy1, 0.0), (x1, gy1, 0.0), (x1, gy1 - 0.3, 0.0), (x0, gy1 - 0.3, 0.0)], out=(0, 0, 1))
    for hid, F in FRONTS.items():
        if (F["xc"] < 0) != (side < 0):
            continue
        cbox(pk, (F["xc"] - 1.3, gy1 - 0.1, -0.08), (F["xc"] + 1.3, gy0 + 0.02, 0.02), c=0.01 if LOD == 0 else 0.0, skip=("-z",))
    wnote("footway, kerb and open gutter channel", "A: granite footway at 0.15 (= floor level), kerb, stone gutter channel (1912 streets unpaved per S:158514)", "")


def street_poles(side):
    """Wooden poles at the kerb with two crossarms, porcelain insulators, catenary wires along the street and service
    drops to brackets on the wing walls (S:157101 multi-crossarm poles, S:157103 / S:157218 wires everywhere)."""
    xs = [-20.5, -44.0, -63.5, -85.0] if side < 0 else [20.5, 45.5, 69.0, 85.5]
    y = KERB_Y - 0.55
    tops = []
    seg = {0: 8, 1: 5, 2: 4}[LOD]
    for x in xs:
        lathe(part("timber"), [(0.0, 0.0), (0.13, 0.0), (0.12, 3.0), (0.095, 9.6), (0.07, 9.75), (0.0, 9.8)], centre=(x, y, 0.0), seg=seg)
        arms = []
        for za in (9.25, 8.55):
            cbox(part("timber"), (x - 0.85, y - 0.05, za - 0.05), (x + 0.85, y + 0.05, za + 0.05), c=0.006 if LOD == 0 else 0.0)
            if LOD <= 1:
                rod(part("iron"), (x - 0.5, y, za - 0.04), (x, y, za - 0.5), 0.01, 3)
                rod(part("iron"), (x + 0.5, y, za - 0.04), (x, y, za - 0.5), 0.01, 3)
            for u in (-0.72, -0.36, 0.36, 0.72):
                if LOD <= 1:
                    rod(part("iron"), (x + u, y, za + 0.05), (x + u, y, za + 0.11), 0.007, 3)
                    lathe(part("porcelain"), [(0.0, 0.0), (0.04, 0.0), (0.045, 0.04), (0.03, 0.09), (0.0, 0.1)],
                          centre=(x + u, y, za + 0.1), seg=5 if LOD == 0 else 4)
                arms.append(Vector((x + u, y, za + 0.2)))
        tops.append(arms)
        if LOD <= 1:   # pole street lamp (reflector) facing the footway
            fr = frame_matrix(Vector((x, y + 0.13, 0)), Vector((0, 1, 0)))
            gooseneck(fr, 0.0, 0.0, 6.2, reach=0.9, drop=0.35)
        POLES.append((x, y))
    if LOD <= 1:
        for a, b in zip(tops, tops[1:]):
            for pa, pb in zip(a, b):
                sag = 0.35 + 0.02 * (pa - pb).length / 10
                pts = [pa + (pb - pa) * (k / 10) + Vector((0, 0, -sag * math.sin(math.pi * k / 10))) for k in range(11)]
                tube(part("wire"), [tuple(q) for q in pts], 0.004, 3)
        # service drops to wall insulator brackets over the fronts
        for hid, F in FRONTS.items():
            if (F["xc"] < 0) != (side < 0):
                continue
            bx = F["xc"] + F["w"] / 2 + 3.2 * (1 if F["kiosk"][2] < 0 else -1) * -1
            base = Vector((bx, WY, 8.55))
            insulator_bracket_short(base)
            near = min(tops, key=lambda arms: abs(arms[0].x - bx))
            for k, q in enumerate(near[:2]):
                s0 = Vector((bx + (-0.25 if k == 0 else 0.25), WY - 0.45, 8.73))
                pts = [s0 + (q - s0) * (t / 8) + Vector((0, 0, -0.45 * math.sin(math.pi * t / 8))) for t in range(9)]
                tube(part("wire"), [tuple(v) for v in pts], 0.004, 3)
    wnote("street poles, crossarms, insulators, wires and pole lamps", "S:157101 S:157103 S:157218 (poles and wires) A: positions", "")


POLES = []


def insulator_bracket_short(base):
    fr = frame_matrix(base, Vector((0, -1, 0)))
    with local(fr):
        cbox(part("iron"), (-0.04, 0.0, -0.3), (0.04, 0.02, 0.05), c=0.003 if LOD == 0 else 0.0, skip=("-y",))
        rod(part("iron"), (0.0, 0.01, -0.25), (0.0, 0.45, 0.0), 0.012, 4)
        cbox(part("iron"), (-0.35, 0.42, -0.02), (0.35, 0.48, 0.02))
        for u in (-0.25, 0.25):
            rod(part("iron"), (u, 0.45, 0.02), (u, 0.45, 0.08), 0.007, 3)
            if LOD <= 1:
                lathe(part("porcelain"), [(0.0, 0.07), (0.035, 0.07), (0.045, 0.1), (0.04, 0.13), (0.03, 0.16), (0.0, 0.17)], centre=(u, 0.45, 0.0), seg=6 if LOD == 0 else 4)


def frontage_dressing(hid, F):
    """Nobori along the kerb, lamps, front posters, the implied event (W1: sign painter's ladder and pot)."""
    fr = S_FR(F["xc"], WY - F["d"])
    hw = F["w"] / 2
    rnd = random.Random("dress-" + hid)
    xs = []
    n = len(F["nobori"])
    span = F["w"] + 3.2
    for k in range(n):
        x = F["xc"] - span / 2 + span * k / max(1, n - 1)
        if abs(x - F["xc"]) < 1.9:
            x += 1.9 * (1 if x >= F["xc"] else -1)
        xs.append(x)
    for k, x in enumerate(xs):
        lean = 0.0
        if hid == "E1" and k == len(xs) - 1:
            lean = 0.13          # implied event: one banner leaning after a gust
        nobori(x, FOOT_Y + 0.28, f"nobori_{F['nobori'][k]}", (math.pi / 2 if F["xc"] < 0 else -math.pi / 2) + rnd.uniform(-0.25, 0.25), h=4.3 + rnd.uniform(-0.2, 0.3), lean=lean)
    # front posters flanking the porch
    for k, sgn in enumerate((-1, 1)):
        u = sgn * (F["porch"]["w"] / 2 + 0.95)
        poster_frame(fr, u, 1.85, 0.6, 0.9, f"poster_{F['posters'][2 + k]}", glazed=True, lamp=False, hero=True)
        # programme strip beside it
        if LOD <= 1:
            with local(fr):
                uu = u + sgn * 0.52
                cbox(part("joinery"), (uu - 0.1, 0.0, 1.35), (uu + 0.1, 0.02, 2.35), c=0.003 if LOD == 0 else 0.0, skip=("-y",))
                face(part("signs"), [(uu + 0.075, 0.021, 1.38), (uu - 0.075, 0.021, 1.38), (uu - 0.075, 0.021, 2.32), (uu + 0.075, 0.021, 2.32)],
                     out=(0, 1, 0), uv=atlas_uv(f"prog_{k}", [(0, 0), (1, 0), (1, 1), (0, 1)]))
    # lamps
    if F["lamps"] == "bracket":
        for sgn in (-1, 1):
            u = sgn * (F["porch"]["w"] / 2 + 1.75)
            bracket_lamp(fr @ Vector((u, 0.0, 3.35)), Vector((0, -1, 0)))
    elif F["lamps"] == "goose":
        for sgn in (-1, 1):
            gooseneck(fr, sgn * (F["porch"]["w"] / 2 + 0.95), 0.0, 3.05, reach=0.55, drop=0.2, hero=True)
    # painted board on the upper storey of the front
    if F["board"]:
        slot, u, zc, w, h = F["board"]
        painted_board(fr, u, zc, w, h, slot, n0=0.0, stand=0.14, lamps=2)
    # the programme board on a trestle at the kerb (W1 and E2), the implied event at W1
    if hid in ("W1", "E2"):
        prog_board(F["xc"] + (-3.4 if hid == "W1" else -2.4), FOOT_Y + 0.9, 0.2 if hid == "W1" else -0.25)
    if hid == "W1":
        ladder_event(-19.2)


def prog_board(x, y, yaw):
    """A-frame programme board (本週番組) standing on the footway."""
    m = Matrix.Translation((x, y, FOOT_Z)) @ Matrix.Rotation(yaw, 4, "Z")
    c = 0.004 if LOD == 0 else 0.0
    with local(m):
        for s in (-1, 1):
            with local(Matrix.Rotation(s * 0.18, 4, "X")):
                cbox(part("joinery"), (-0.38, -0.02, 0.0), (0.38, 0.02, 1.5), c=c)
                if s < 0:
                    face(part("signs"), [(0.33, -0.021, 0.45), (-0.33, -0.021, 0.45), (-0.33, -0.021, 1.43), (0.33, -0.021, 1.43)], out=(0, -1, 0),
                         uv=atlas_uv("prog_board", [(1, 0), (0, 0), (0, 1), (1, 1)]))
        if LOD <= 1:
            rod(part("iron"), (-0.3, -0.13, 0.5), (-0.3, 0.13, 0.5), 0.006, 3)
            rod(part("iron"), (0.3, -0.13, 0.5), (0.3, 0.13, 0.5), 0.006, 3)


def bench(x, y, yaw, L=1.8):
    """Wooden bench (縁台) for the queue: two seat planks with a 4 mm gap, legs, stretchers."""
    if LOD >= 2:
        return
    PROP_BOXES.append(((x - L / 2 - 0.05, y - 0.25, 0.0), (x + L / 2 + 0.05, y + 0.25, 0.45))) if LOD == 0 and abs(yaw) < 0.3 else None
    m = Matrix.Translation((x, y, FOOT_Z)) @ Matrix.Rotation(yaw, 4, "Z")
    c = 0.004 if LOD == 0 else 0.0
    with local(m):
        pt = part("timber")
        for k in (-1, 1):
            cbox(pt, (-L / 2, k * 0.002 if k > 0 else -0.17, 0.4), (L / 2, 0.17 if k > 0 else -0.002, 0.44), c=c)
        for sx in (-1, 1):
            for sy in (-1, 1):
                cbox(pt, (sx * (L / 2 - 0.12) - 0.03, sy * 0.12 - 0.03, 0.0), (sx * (L / 2 - 0.12) + 0.03, sy * 0.12 + 0.03, 0.4), c=c)
            cbox(pt, (sx * (L / 2 - 0.12) - 0.025, -0.12, 0.12), (sx * (L / 2 - 0.12) + 0.025, 0.12, 0.17), c=c)
        cbox(pt, (-L / 2 + 0.12, -0.02, 0.2), (L / 2 - 0.12, 0.02, 0.25), c=c)


def handcart_event(x, y):
    """Implied event: a handcart (大八車) resting on its shafts at the kerb, left mid-unload: two slatted crates of film cans
    on the bed, one crate on the footway with its lid off and a few cans stacked beside it (no figure)."""
    if LOD >= 2:
        return
    pt, pi = part("timber"), part("iron")
    c = 0.004 if LOD == 0 else 0.0
    seg = 14 if LOD == 0 else 8
    R = 0.55
    tilt = math.atan2(R + 0.03, 1.9)              # shaft tips on the footway 1.9 m ahead of the axle (+x)
    PROP_BOXES.append(((x - 1.2, y - 0.7, 0.0), (x + 1.95, y + 0.7, 1.2)))
    with local(Matrix.Translation((x, y, FOOT_Z + R + 0.03)) @ Matrix.Rotation(tilt, 4, "Y")):
        # bed: two long rails running on as shafts, cross slats
        for sy in (-1, 1):
            cbox(pt, (-1.1, sy * 0.45 - 0.035, 0.0), (1.9, sy * 0.45 + 0.035, 0.08), c=c)
        for k in range(7):
            xx = -1.0 + 1.9 * k / 6
            cbox(pt, (xx - 0.07, -0.45, 0.08), (xx + 0.07, 0.45, 0.11), c=c)
        cbox(pt, (1.75, -0.45, 0.0), (1.82, 0.45, 0.06), c=c)          # cross bar between the shaft tips
        # crates of film cans on the bed
        for k, (cx, rot) in enumerate(((-0.55, 0.05), (0.15, -0.08))):
            with local(Matrix.Translation((cx, 0.0, 0.11)) @ Matrix.Rotation(rot, 4, "Z")):
                crate(0.62, 0.42, 0.34)
    # wheels on the axle (world: the axle is horizontal along y)
    for sy in (-1, 1):
        with local(Matrix.Translation((x, y + sy * 0.56, FOOT_Z + R)) @ Matrix.Rotation(math.pi / 2, 4, "X")):
            lathe(pt, [(R - 0.06, -0.035), (R, -0.035), (R, 0.035), (R - 0.06, 0.035)], seg=seg + 6, cap_top=False)
            lathe(pi, [(R - 0.005, -0.03), (R + 0.012, -0.03), (R + 0.012, 0.03), (R - 0.005, 0.03)], seg=seg + 6)   # iron tyre
            lathe(pt, [(0.0, -0.09), (0.09, -0.09), (0.1, -0.05), (0.1, 0.05), (0.09, 0.09), (0.0, 0.09)], seg=10 if LOD == 0 else 6)
            for k in range(10 if LOD == 0 else 6):
                a = 2 * math.pi * k / (10 if LOD == 0 else 6)
                rod(pt, (0.09 * math.cos(a), 0.09 * math.sin(a), 0.0), ((R - 0.05) * math.cos(a), (R - 0.05) * math.sin(a), 0.0), 0.018, 4)
    rod(pi, (x, y - 0.62, FOOT_Z + R), (x, y + 0.62, FOOT_Z + R), 0.025, 6)
    # a crate on the footway, lid leaning, cans stacked
    with local(Matrix.Translation((x - 0.3, y + 1.15, FOOT_Z)) @ Matrix.Rotation(0.25, 4, "Z")):
        crate(0.62, 0.42, 0.34, lid=False)
        cbox(pt, (0.33, -0.23, 0.0), (0.36, 0.23, 0.38), c=c)                   # the lid, leaning against it
    for k, (dx, dy, dz) in enumerate(((0.55, 1.5, 0.0), (0.55, 1.5, 0.045), (0.72, 1.62, 0.0), (0.4, 1.7, 0.0), (0.4, 1.7, 0.045))):
        lathe(part("roof_lead"), [(0.0, 0.0), (0.17, 0.0), (0.175, 0.006), (0.175, 0.038), (0.17, 0.044), (0.0, 0.044)],
              centre=(x + dx - 1.0, y + dy - 0.35, FOOT_Z + dz), seg=seg)
    wnote("implied event E1: handcart left mid-unload with crates of film cans", "A: (interior-directive s7.5 implied event; no figure)", "")


def crate(L, W, H, lid=True):
    """Slatted crate: four boarded sides with gaps, corner battens, a lid of three boards, nail heads."""
    pt = part("timber")
    c = 0.003 if LOD == 0 else 0.0
    for sy in (-1, 1):
        for k in range(3):
            z0 = 0.01 + (H - 0.02) * k / 3
            cbox(pt, (-L / 2, sy * W / 2 - (0.018 if sy > 0 else 0.0), z0), (L / 2, sy * W / 2 + (0.0 if sy > 0 else 0.018), z0 + (H - 0.02) / 3 - 0.012), c=c)
    for sx in (-1, 1):
        cbox(pt, (sx * L / 2 - (0.018 if sx > 0 else 0.0), -W / 2, 0.0), (sx * L / 2 + (0.0 if sx > 0 else 0.018), W / 2, H), c=c)
        for sy in (-1, 1):
            cbox(pt, (sx * (L / 2 - 0.04) - 0.02, sy * (W / 2 + 0.01) - 0.012, 0.0), (sx * (L / 2 - 0.04) + 0.02, sy * (W / 2 + 0.01) + 0.012, H), c=c)
    cbox(pt, (-L / 2, -W / 2, 0.0), (L / 2, W / 2, 0.018), c=c)
    if lid:
        for k in range(3):
            y0 = -W / 2 + W * k / 3
            cbox(pt, (-L / 2, y0 + 0.004, H), (L / 2, y0 + W / 3 - 0.004, H + 0.018), c=c)


def ladder_event(x):
    """Implied event (interior-directive s7.5): the sign painter's ladder against a W1 board, a paint pot and brush on
    the footway, one board half primed.  No figure."""
    if LOD >= 2:
        return
    base_y = WY - 1.05
    top_y = WY - 0.28
    z1 = 6.5
    c = 0.004 if LOD == 0 else 0.0
    for dx in (-0.23, 0.23):
        a = Vector((x + dx, base_y, FOOT_Z))
        b = Vector((x + dx, top_y, z1))
        rod(part("timber"), a, b, 0.03, 4)
    for k in range(1, 20):
        t = k / 20
        p = Vector((x, base_y + (top_y - base_y) * t, FOOT_Z + (z1 - FOOT_Z) * t))
        rod(part("timber"), p + Vector((-0.23, 0, 0)), p + Vector((0.23, 0, 0)), 0.014, 4)
    lathe(part("iron"), [(0.0, 0.0), (0.1, 0.0), (0.11, 0.18), (0.115, 0.2), (0.0, 0.2)], centre=(x + 0.55, base_y - 0.2, FOOT_Z), seg=10 if LOD == 0 else 6)
    lathe(part("paint_red"), [(0.0, 0.17), (0.105, 0.17)], centre=(x + 0.55, base_y - 0.2, FOOT_Z), seg=10 if LOD == 0 else 6)
    rod(part("timber"), (x + 0.5, base_y - 0.2, FOOT_Z + 0.19), (x + 0.75, base_y - 0.12, FOOT_Z + 0.33), 0.008, 4)
    cbox(part("paint_cream"), (x + 0.28, base_y - 0.25, FOOT_Z), (x + 0.6, base_y + 0.2, FOOT_Z + 0.004)) if LOD == 0 else None


# ---------------------------------------------------------------------------------------------
# 8. Build one LOD
# ---------------------------------------------------------------------------------------------
def build_wings():
    global BULBS
    BULBS = []
    DOORS_W.clear()
    WINDOWS_W.clear()
    POSTER_LAMPS.clear()
    LANTERNS.clear()
    KIOSKS.clear()
    KIOSK_LAMPS.clear()
    CANOPY_POSTS.clear()
    PROP_BOXES.clear()
    POLES.clear()
    IF_EXTRA.clear()
    NOTES.clear()
    WIN_SEED[0] = 0
    for hid in ("W2", "W1", "E1", "E2", "E3"):
        HALL[0] = hid
        F = FRONTS[hid]
        fr, po, do, ol = front_block(hid, F)
        canopy(hid, F, fr)
        kiosk(hid, F)
        frontage_dressing(hid, F)
        hall_south(hid)
        hall_north(hid)
        hall_roof(hid)
    HALL[0] = "W2"
    end_wall("W2", -87.2)
    HALL[0] = "E3"
    end_wall("E3", 87.2)
    HALL[0] = None
    fire_wall(-51.025, 1)
    fire_wall(39.075, -1)
    fire_wall(63.325, -1)
    base_door_reveals()
    base_flashing()
    for side in (-1, 1):
        footway(side)
        street_poles(side)
    bench(-37.2, -9.5, 0.0)
    bench(60.4, -9.5, 0.08)          # clear of the E2 side exit (x 58.0)
    handcart_event(35.4, -11.55)
    emit_bulbs()


def base_flashing():
    """Lead apron where each barrel roof meets the base party wall (x = +/-14.5), 0.18 m up the wall, and a cover strip."""
    n = {0: 16, 1: 10, 2: 6}[LOD]
    for sx in (-1, 1):
        x = sx * (XB + 0.012)
        ys = [-ROOF_Y + 2 * ROOF_Y * k / n for k in range(n + 1)]
        for ya, yb in zip(ys, ys[1:]):
            face(part("roof_lead"), [(x, ya, roof_z(ya)), (x, yb, roof_z(yb)), (x, yb, roof_z(yb) + 0.2), (x, ya, roof_z(ya) + 0.2)], out=(sx, 0, 0))
            face(part("roof_lead"), [(x, ya, roof_z(ya) + 0.005), (x, yb, roof_z(yb) + 0.005), (x + sx * 0.25, yb, roof_z(yb) + 0.005), (x + sx * 0.25, ya, roof_z(ya) + 0.005)],
                 out=(0, 0, 1))
    wnote("lead flashings at the base party walls", "A: roofs abut the base E/W walls below the L3 windows (INTERFACE: no windows below 10.0)", "")


def build_lod_w(lod):
    global LOD, LAMPS
    LOD = lod
    LAMPS = []
    if lod == 0:
        INSTANCES["bulb"].clear()
        for k in INSTANCES_W:
            INSTANCES_W[k].clear()
    build_wings()


# ---------------------------------------------------------------------------------------------
# 9. Objects, collision, interface, export
# ---------------------------------------------------------------------------------------------
_base_get_mat = get_mat


def get_mat(name):  # noqa: F811  (signs get the atlas texture; everything else as the base)
    if name != "signs":
        return _base_get_mat(name)
    if name in MATS:
        return MATS[name]
    m = _base_get_mat(name)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    im = bpy.data.images.load(str(ATLAS_PNG), check_existing=True)
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = im
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    return m


def make_obj(key, p, coll, parent, prefix):
    lod, name = key
    mesh = bpy.data.meshes.new(f"{prefix}{lod}_{name}")
    mesh.from_pydata([tuple(v) for v in p.V], [], p.F)
    uv = mesh.uv_layers.new(name="UVMap")
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


def col_boxes(coll, parent, name, boxes):
    """One collision mesh made of several axis-aligned boxes."""
    V, Fc = [], []
    for lo, hi in boxes:
        x0, y0, z0 = lo
        x1, y1, z1 = hi
        i = len(V)
        V += [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
        Fc += [(i, i + 3, i + 2, i + 1), (i + 4, i + 5, i + 6, i + 7), (i, i + 1, i + 5, i + 4), (i + 1, i + 2, i + 6, i + 5),
               (i + 2, i + 3, i + 7, i + 6), (i + 3, i, i + 4, i + 7)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(V, [], Fc)
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    o.parent = parent
    o["collision"] = True
    o.hide_render = True
    return o


def split_x(x0, x1, gaps):
    """[x0, x1] minus the gaps [(a, b)] -> list of intervals."""
    out = [(x0, x1)]
    for a, b in gaps:
        nxt = []
        for p, q in out:
            if b <= p or a >= q:
                nxt.append((p, q))
            else:
                if a > p:
                    nxt.append((p, a))
                if b < q:
                    nxt.append((b, q))
        out = nxt
    return out


def build_collision_w(coll, root):
    names = []
    for side, tag in ((-1, "W"), (1, "E")):
        xs = (-87.2, -XB) if side < 0 else (XB, 87.2)
        names.append(col_boxes(coll, root, f"COL_wing_footway_{tag}", [((xs[0], KERB_Y, -0.3), (xs[1], WY, FOOT_Z))]).name)
    for hid, F in FRONTS.items():
        x0, x1 = HALL_X[hid]
        xc, hw, d = F["xc"], F["w"] / 2, F["d"]
        pw = F["porch"]["w"] / 2
        ptop = F["porch"]["z1"] + (pw if F["porch"]["kind"] == "round" else F["porch"].get("rise", 0.0))
        ztop = 12.0
        names.append(col_boxes(coll, root, f"COL_wing_{hid}_front", [
            ((xc - hw, WY - d, 0.0), (xc - pw, WY, ztop)), ((xc + pw, WY - d, 0.0), (xc + hw, WY, ztop)),
            ((xc - pw, WY - d, ptop), (xc + pw, WY, ztop))]).name)
        names.append(col_boxes(coll, root, f"COL_wing_{hid}_porch_floor", [((xc - pw, WY - d, -0.3), (xc + pw, WY, FOOT_Z))]).name)
        # south wall: open only at the W1 door (the interior cell carries the room); other doors are closed leaves
        gaps = [(W1_DOOR_X - W1_DOOR_W / 2, W1_DOOR_X + W1_DOOR_W / 2)] if hid == "W1" else []
        boxes = [((a, WY, 0.0), (b, WY + WT, EAVES)) for a, b in split_x(x0, x1, gaps)]
        if hid == "W1":
            boxes.append(((W1_DOOR_X - W1_DOOR_W / 2, WY, W1_DOOR_Z1), (W1_DOOR_X + W1_DOOR_W / 2, WY + WT, EAVES)))
            boxes.append(((W1_DOOR_X - W1_DOOR_W / 2, WY, -0.3), (W1_DOOR_X + W1_DOOR_W / 2, WY + WT, FOOT_Z)))
        names.append(col_boxes(coll, root, f"COL_wing_{hid}_wall_S", boxes).name)
        names.append(col_boxes(coll, root, f"COL_wing_{hid}_wall_N", [((x0, WYN - WT, 0.0), (x1, WYN, EAVES))]).name)
        for (h2, x, y, a, b, fr) in KIOSKS_L0:
            if h2 == hid:
                names.append(col_boxes(coll, root, f"COL_wing_{hid}_kiosk", [((x - a - 0.04, y - b - 0.04, 0.0), (x + a + 0.04, y + b + 0.04, 2.6))]).name)
    for tag, x in (("W", -87.2), ("E", 87.2)):
        a, b = sorted((x, x - (WT if x > 0 else -WT)))
        names.append(col_boxes(coll, root, f"COL_wing_end_{tag}", [((a, -9.0, 0.0), (b, 9.0, EAVES))]).name)
    for tag, sx in (("W", -1), ("E", 1)):
        a, b = sorted((sx * 14.5, sx * 14.95))
        names.append(col_boxes(coll, root, f"COL_wing_door_wing_{tag}", [((a, -1.2, -0.3), (b, 1.2, FOOT_Z)), ((a, -9.0, 0.0), (b, -1.2, EAVES)),
                                                                          ((a, 1.2, 0.0), (b, 9.0, EAVES)), ((a, -1.2, 3.4), (b, 1.2, EAVES))]).name)
    props = [((x - 0.14, y - 0.14, 0.0), (x + 0.14, y + 0.14, 3.0)) for (x, y) in POLES_L0]
    props += [((q.x - 0.13, q.y - 0.13, 0.0), (q.x + 0.13, q.y + 0.13, 3.5)) for q in CANOPY_POSTS_L0]
    props += [((n[0] - 0.14, n[1] - 0.14, 0.0), (n[0] + 0.14, n[1] + 0.14, 1.2)) for n in INSTANCES_W["nobori"]]
    props += list(PROP_BOXES_L0)
    names.append(col_boxes(coll, root, "COL_wing_props", props).name)
    return names


KIOSKS_L0, POLES_L0, CANOPY_POSTS_L0, PROP_BOXES_L0 = [], [], [], []


def add_if_empties(coll, root):
    out = []
    for fr, o, hid, kind in DOORS_L0:
        name = f"IF_wing_{hid}_door_{kind}"
        e = bpy.data.objects.new(name, None)
        e.empty_display_type = "ARROWS"
        coll.objects.link(e)
        e.parent = root
        e.matrix_world = fr @ Matrix.Translation((o.uc, 0.0, o.z0))
        ex = {"width": o.w, "sill": o.z0, "head": o.top(), "kind": o.kind, "hall": hid, "door": kind}
        if hid == "W1" and kind == "main":
            ex["matches"] = "cell_cinema south exit door (cell x 14.5, 1.2 x 2.5): leaves belong to the interior"
        e["opening"] = json.dumps(ex)
        out.append(name)
    for name, M, ex in IF_EXTRA_L0:
        e = bpy.data.objects.new(name, None)
        e.empty_display_type = "ARROWS"
        coll.objects.link(e)
        e.parent = root
        e.matrix_world = M
        e["opening"] = json.dumps(ex)
        out.append(name)
    return out


DOORS_L0, IF_EXTRA_L0 = [], []


def main_w():
    global BUCKET, DOORS_L0, IF_EXTRA_L0, KIOSKS_L0, POLES_L0, CANOPY_POSTS_L0, PROP_BOXES_L0
    if "--regen-atlas" in MY_ARGV or not ATLAS_PNG.exists():
        import subprocess
        subprocess.run([bpy.app.binary_path, "-b", "--factory-startup", "-P", str(WHERE / "make-sign-atlas.py")], check=True)
    meta_a = json.loads(ATLAS_JSON.read_text(encoding="utf-8"))
    ATLAS["size"] = meta_a["size"]
    ATLAS["slots"] = meta_a["slots"]
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)
    scene = bpy.context.scene
    coll = scene.collection
    lod_stats = {}
    t0 = time.time()
    for lod in (0, 1, 2):
        BUCKET = {}
        build_lod_w(lod)
        root = bpy.data.objects.new(f"TW_LOD{lod}", None)
        coll.objects.link(root)
        root["lod"] = lod
        root["switchDistanceM"] = [0, 25, 80][lod]
        objs = []
        for key, p in sorted(BUCKET.items()):
            if p.F:
                objs.append(make_obj(key, p, coll, root, "TW_LOD"))
        lod_stats[lod] = {"tris": tri_count(objs), "objects": len(objs),
                          "byPart": {o.name.split("_", 2)[-1]: tri_count([o]) for o in objs}}
        if lod == 0:
            DOORS_L0 = list(DOORS_W)
            IF_EXTRA_L0 = list(IF_EXTRA)
            KIOSKS_L0 = list(KIOSKS)
            POLES_L0 = list(POLES)
            CANOPY_POSTS_L0 = list(CANOPY_POSTS)
            PROP_BOXES_L0 = list(PROP_BOXES)
            l0 = dict(bulbs=len(BULBS), windows=len(WINDOWS_W), doors=len(DOORS_W), lamps=list(LAMPS), poster_lamps=list(POSTER_LAMPS),
                      lanterns=list(LANTERNS), kiosk_lamps=list(KIOSK_LAMPS), notes=list(NOTES),
                      windows_list=[(hid, o.tag, o.kind, o.w, o.z0, o.top(), tuple(round(v, 3) for v in (fr @ Vector((o.uc, 0, o.z0))))) for fr, o, hid in WINDOWS_W])
        else:
            for o in objs:
                o.hide_render = True
        print(f"LOD{lod}", lod_stats[lod]["tris"], "tris", len(objs), "objects", f"{time.time() - t0:.1f}s")
    t_build = time.time() - t0
    col_root = bpy.data.objects.new("TW_COLLISION", None)
    coll.objects.link(col_root)
    col_names = build_collision_w(coll, col_root)
    if_root = bpy.data.objects.new("TW_INTERFACE", None)
    coll.objects.link(if_root)
    if_names = add_if_empties(coll, if_root)
    t0 = time.time()
    if W_EXPORT:
        for o in list(scene.objects):
            if o.type == "MESH" and o.name.startswith("TW_LOD") and not o.name.endswith("_bulb"):
                add_uv1(o)
    t_uv = time.time() - t0
    byp0 = lod_stats[0]["byPart"]
    meta = {
        "version": "tower-wings v1.0",
        "command": "blender -b -P assets-src/shinsekai/tower-base-upgrade/wings/build-tower-wings.py -- " + " ".join(MY_ARGV),
        "frame": "v4 / INTERFACE world, metres, Z-up (glTF Y-up = (x, z, -y))",
        "datums": {"southFaceY": WY, "northFaceY": WYN, "eaves": EAVES, "roofCrown": ROOF_CROWN, "footwayTop": FOOT_Z, "kerbY": [FOOT_Y, KERB_Y],
                   "halls": HALL_X, "clearBoxes": CLEAR, "W1door": {"x": W1_DOOR_X, "w": W1_DOOR_W, "z": [W1_DOOR_Z0, W1_DOOR_Z1]}},
        "fronts": {h: {k: v for k, v in F.items() if k in ("xc", "w", "d", "style", "canopy", "kiosk", "wall", "lamps")} for h, F in FRONTS.items()},
        "lods": lod_stats, "budgetLOD0": 150000, "bulbsLOD0": l0["bulbs"], "windowsLOD0": l0["windows"], "doorsLOD0": l0["doors"],
        "windows": l0["windows_list"],
        "materials": {k: {"baseColorLinear": v[0], "roughness": v[1], "metallic": v[2],
                          "texture": (str(TEX / v[3]) if v[3] and not v[3].startswith("tex/") else v[3]), "tileM": v[4], "source": v[5]}
                      for k, v in MATDEF.items() if any(n.endswith("_" + k) or n == k for n in byp0) or k in ("backing", "backing_dark", "curtain")},
        "placeholders": "hide TW_LOD*_<hall>_backing, _backing_dark, _curtain when that hall's interior cell loads (W1 = cell_cinema)",
        "signsUV": "TW_LOD*_signs uses UV0 in atlas space (tex/tw-signs.png, slots in tex/tw-signs.json); every other part has UV0 in metres",
        "notes": l0["notes"],
        "collision": col_names, "interface": if_names,
        "timingsS": {"build": round(t_build, 1), "uv1": round(t_uv, 1)},
        "instancing": {
            "note": "LOD0 bulbs, lanterns, nobori, poster frames, kerbs and footway slabs are baked into the LOD meshes and counted; the placements "
                    "below let the runtime draw them as instances instead (world Z-up metres).",
            "bulb": {"prototype": "4-sided bipyramid, lathe (0,-0.06),(0.024,-0.036),(0,0), apex at the placement", "trisEach": 8,
                     "count": len(INSTANCES["bulb"]), "positions": INSTANCES["bulb"]},
            "lantern": {"prototype": "8-sided paper lantern (5 rings) + 2 lacquered rings, top at the placement", "trisEach": 112,
                        "count": len(INSTANCES_W["lantern"]), "placements[x,y,zTop,r,h,colour]": INSTANCES_W["lantern"]},
            "nobori": {"prototype": "bamboo pole + stone foot + crossbar + 6-row double-sided cloth + 6 loops", "count": len(INSTANCES_W["nobori"]),
                       "placements[x,y,z0,yaw,h,atlasSlot]": INSTANCES_W["nobori"]},
            "posterFrame": {"count": len(INSTANCES_W["poster_frame"]), "placements[x,y,zc,w,h,slot]": INSTANCES_W["poster_frame"]},
            "kerb": {"count": len(INSTANCES_W["kerb"]), "xRanges": INSTANCES_W["kerb"]},
            "footwaySlab": {"count": 2 * len(INSTANCES_W["footway_slab"]), "xRanges(2 rows)": INSTANCES_W["footway_slab"]},
        },
    }
    (WHERE / "tower-wings.parts.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    if W_EXPORT:
        bpy.ops.object.select_all(action="DESELECT")
        for o in scene.objects:
            if o.name.startswith(("TW_", "COL_", "IF_")):
                o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(WHERE / "tower-wings.glb"), export_format="GLB", use_selection=True,
                                  export_extras=True, export_apply=False, export_texcoords=True, export_normals=True,
                                  export_materials="EXPORT", export_yup=True, export_image_format="JPEG", export_jpeg_quality=88)
    print("LOD stats", json.dumps({k: {"tris": v["tris"], "objects": v["objects"]} for k, v in lod_stats.items()}))
    print("LOD0 by part", json.dumps(dict(sorted(byp0.items(), key=lambda kv: -kv[1]))))
    if W_RENDERS:
        import importlib.util
        spec = importlib.util.spec_from_file_location("tw_render", WHERE / "render_wings.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.run(globals(), W_RENDERS, W_SAMPLES, l0)
    print(f"wings done in {time.time() - T0_WINGS:.1f}s")


main_w()
