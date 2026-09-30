"""Parametric, deliberately provisional first-tower silhouette study (v3 proposal).

Run with Blender 4.5 from the repository root:
    blender -b --python assets-src/shinsekai/tower-study/build-tower.py -- [--height 75.76] [--passage-depth 26]
        [--era 1912|1920s] [--iron grey|redbrown] [--export-only]
Axes: X east, Y north, Z up; the camera views south from the north side.

Sourced: the roof garden about 50 shaku (15.15 m) above ground.
Parameters, not findings: total height (default 75.76 m, the 1924 table value that
conflicts with the 1922 sea-elevation text) and the base depth along the passage
(default 26 m; the photo fit gives about 20.7-30.5 m and the 1939 retrospective's
"中段 十五間四角" would be about 27.3 m).
v2 shape changes come from Claude's camera-matched overlays against the 1921 plate 46
(NDL 962657 canvas 48) and the 1914 view A (NDL 952032 canvas 95); see
claude-out/qa/photomatch in the local workspace and the branch notes in README.md.
Plate 46 is a 1921 publication, so its facade details are later-period candidates.
v3 (Claude proposal, claude-out/design/review-tower-study-v2.md): flared leg profile from
plate-46 width ratios, a central lattice elevator well (roof garden to the box, 1912 text),
multi-cell face lacing, and era-switched tops (1912-14 open gallery + ribbed crown; 1920s
enclosed box + low cap). Iron colour is an option: grey (provisional) or red-brown (the
hand-coloured opening-era postcards; not a measured colour).
"""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def arg(name, default, cast=float):
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return cast(argv[argv.index(name) + 1]) if name in argv else default


OUT = Path(__file__).resolve().parent
HEIGHT = arg("--height", 75.76)             # parameter; see module docstring
PASSAGE_DEPTH = arg("--passage-depth", 26.0)  # parameter; north-south depth of the base block
ERA = arg("--era", "1912", str)              # "1912" (1912-14 photos) or "1920s" (plate 46, 1920s cards)
IRON = arg("--iron", "grey", str)            # "grey" (provisional) or "redbrown" (postcard candidate)
SUFFIX = ("" if ERA == "1912" else "-" + ERA) + ("" if IRON == "grey" else "-" + IRON)
ROOF_GARDEN_Z = 15.15   # about 50 shaku (sourced)
FACADE_TOP = 15.3
SHAFT_START = 15.85
FACE_Y = PASSAGE_DEPTH / 2   # outer face of the north (+) and south (-) facades

# Base block, measured in plate 46 at the roof-garden scale (about 27.7 px/m).
FACADE_HALF_WIDTH = 14.5     # outer edges of the flanking turrets, about 28-29.6 m
ARCH_HALF_SPAN = 10.05       # arch about 20.1 m wide at its feet
ARCH_SPRING = 2.9            # the intrados becomes vertical about 2.9 m above ground
ARCH_CROWN = 10.9            # intrados crown; flatter than a semicircle
TURRET = 4.4                 # turret plan size (estimate)
TURRET_X = FACADE_HALF_WIDTH - TURRET / 2
TURRET_BODY_TOP = 19.6
TURRET_DOME_TOP = 22.1       # plate 46 dome crown, about 22 m
TURRET_FINIAL_TOP = 22.9

# Tower shaft: legs about 11.4 m apart at the roof (36-42% of the facade width in
# plate 46). The plan is assumed square; no source gives the leg footprint.
SHAFT_BASE_HALF = 5.7
SHAFT_TOP_HALF_W, SHAFT_TOP_HALF_D = 2.65, 2.4
# Upper levels as fractions of the height above the roof garden. Both north views
# agree: observation box bottom about 0.72-0.73, box top about 0.86, crown apex 0.94-0.96.
SPAN = HEIGHT - ROOF_GARDEN_Z


def above_roof(fraction):
    return ROOF_GARDEN_Z + fraction * SPAN


SHAFT_TOP = above_roof(0.72)
ROOM_TOP = above_roof(0.845)
CROWN_BASE = above_roof(0.86)
CROWN_UPRIGHT_TOP = above_roof(0.93)
CROWN_APEX = above_roof(0.955)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, rgba, metallic=0, roughness=0.8):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgba
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = rgba
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    return mat


stone = material("provisional pale masonry", (0.56, 0.53, 0.46, 1))
iron = (material("candidate red-brown iron (postcard colour)", (0.30, 0.13, 0.09, 1), 0.5, 0.6)
        if IRON == "redbrown" else material("provisional dark iron", (0.14, 0.17, 0.17, 1), 0.6, 0.55))
trim = material("provisional trim", (0.37, 0.36, 0.33, 1))
window = material("dark unglazed opening", (0.08, 0.10, 0.11, 1), 0.1, 0.22)
ground_mat = material("study floor", (0.27, 0.29, 0.28, 1))


def block(name, location, scale, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj


def beam(name, start, end, radius, mat, vertices=8):
    a, b = Vector(start), Vector(end)
    delta = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=delta.length, location=(a + b) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    return obj


def arch_z(x):
    """Elliptical intrados above the springing line."""
    return ARCH_SPRING + (ARCH_CROWN - ARCH_SPRING) * math.sqrt(max(0.0, 1 - (x / ARCH_HALF_SPAN) ** 2))


# Base block with a vaulted passage running the full depth (north to south).
# The strip count is for the blockout, not a claim about stone joints.
side_width = FACADE_HALF_WIDTH - ARCH_HALF_SPAN
for side in (-1, 1):
    block("base side mass", (side * (ARCH_HALF_SPAN + side_width / 2), 0, FACADE_TOP / 2),
          (side_width, PASSAGE_DEPTH, FACADE_TOP), stone)
for step in range(48):
    x0 = -ARCH_HALF_SPAN + 2 * ARCH_HALF_SPAN * step / 48
    x1 = -ARCH_HALF_SPAN + 2 * ARCH_HALF_SPAN * (step + 1) / 48
    top = max(arch_z(x0), arch_z(x1))
    block("passage vault", ((x0 + x1) / 2, 0, (top + FACADE_TOP) / 2),
          (x1 - x0 + 0.02, PASSAGE_DEPTH, FACADE_TOP - top), stone)
for face in (-1, 1):
    y = face * (FACE_Y + 0.2)
    pts = [(ARCH_HALF_SPAN + 0.3) * math.cos(math.pi * i / 40) for i in range(41)]
    for xa, xb in zip(pts, pts[1:]):
        za = arch_z(xa * ARCH_HALF_SPAN / (ARCH_HALF_SPAN + 0.3)) + 0.3
        zb = arch_z(xb * ARCH_HALF_SPAN / (ARCH_HALF_SPAN + 0.3)) + 0.3
        beam("arch moulding", (xa, y, za), (xb, y, zb), 0.25, trim)
    block("roof cornice", (0, face * FACE_Y, FACADE_TOP - 0.25), (2 * FACADE_HALF_WIDTH + 0.3, 0.5, 0.5), trim)

# Four corner turrets, flush with the facades. The 1914 north view and 1921 plate
# show rounded cupolas; heights follow plate 46, plan sizes are estimates.
for x in (-TURRET_X, TURRET_X):
    for face in (-1, 1):
        y = face * (FACE_Y - TURRET / 2)
        block("flanking turret", (x, y, TURRET_BODY_TOP / 2), (TURRET, TURRET, TURRET_BODY_TOP), stone)
        block("turret crown", (x, y, TURRET_BODY_TOP + 0.35), (TURRET + 0.5, TURRET + 0.5, 0.7), trim)
        dome_r = TURRET_DOME_TOP - (TURRET_BODY_TOP + 0.7)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8,
                                              location=(x, y, TURRET_BODY_TOP + 0.7))
        bpy.context.object.scale = (TURRET / 2 - 0.2, TURRET / 2 - 0.2, dome_r)
        bpy.context.object.name = "rounded turret cupola study"
        bpy.context.object.data.materials.append(trim)
        for level in (5.5, 9.5, 13.0, 17.0):
            block("turret window", (x, face * (FACE_Y + 0.02), level), (1.1, 0.08, 2.2), window)
        beam("turret finial", (x, y, TURRET_DOME_TOP - 0.2), (x, y, TURRET_FINIAL_TOP), 0.1, iron)

block("roof garden deck", (0, 0, ROOF_GARDEN_Z), (2 * FACADE_HALF_WIDTH, PASSAGE_DEPTH, 0.5), trim)
rail_x = TURRET_X - TURRET / 2 - 0.4
for i in range(15):
    x = -rail_x + 2 * rail_x * i / 14
    for face in (-1, 1):
        beam("roof balustrade", (x, face * (FACE_Y - 0.3), ROOF_GARDEN_Z + 0.25),
             (x, face * (FACE_Y - 0.3), ROOF_GARDEN_Z + 1.65), 0.07, trim)
rail_y = FACE_Y - TURRET - 0.4
for i in range(max(2, int(2 * rail_y / 1.5)) + 1):
    y = -rail_y + 2 * rail_y * i / max(2, int(2 * rail_y / 1.5))
    for side in (-1, 1):
        beam("roof balustrade", (side * (FACADE_HALF_WIDTH - 0.3), y, ROOF_GARDEN_Z + 0.25),
             (side * (FACADE_HALF_WIDTH - 0.3), y, ROOF_GARDEN_Z + 1.65), 0.07, trim)


# Leg profile (v3). Plate-46 outer widths, as a fraction of the roof-level width, are
# about 0.45-0.5 at the box, about 0.59 halfway down and 1.0 at the roof, and the taper
# rate roughly triples in the lower part (review-tower-study-v2.md, section A). Profile
# p(u): u = 0 at the box underside, 1 at the roof; straight to u = 0.55, then a concave
# flare with a continuous slope. The ratios come from one photo; camera pitch is not removed.
FLARE_START = 0.55
P_MID = (0.59 - 0.47) / (1 - 0.47)


def profile(u):
    if u <= FLARE_START:
        return P_MID * u / FLARE_START
    s = (u - FLARE_START) / (1 - FLARE_START)
    a = P_MID / FLARE_START * (1 - FLARE_START)
    return P_MID + a * s + (1 - P_MID - a) * s * s


def shaft_half(z, top_half):
    u = min(1.0, max(0.0, (SHAFT_TOP - z) / (SHAFT_TOP - SHAFT_START)))
    return top_half + (SHAFT_BASE_HALF - top_half) * profile(u)


def lace(low_pts, high_pts, cells, radius):
    """Diamond lacing across one face between two levels."""
    (a0, a1), (b0, b1) = low_pts, high_pts
    for k in range(cells):
        f0, f1 = k / cells, (k + 1) / cells
        beam("face lacing", a0.lerp(a1, f0), b0.lerp(b1, f1), radius, iron, 5)
        beam("face lacing", a0.lerp(a1, f1), b0.lerp(b1, f0), radius, iron, 5)


segments = 18
levels = [SHAFT_START + (SHAFT_TOP - SHAFT_START) * i / segments for i in range(segments + 1)]
for index, (low, high) in enumerate(zip(levels, levels[1:])):
    wl, dl = shaft_half(low, SHAFT_TOP_HALF_W), shaft_half(low, SHAFT_TOP_HALF_D)
    wh, dh = shaft_half(high, SHAFT_TOP_HALF_W), shaft_half(high, SHAFT_TOP_HALF_D)
    lower_part = index < segments * (1 - FLARE_START)
    for sx in (-1, 1):
        for sy in (-1, 1):
            beam("flared lattice leg", (sx * wl, sy * dl, low), (sx * wh, sy * dh, high),
                 0.30 if lower_part else 0.20, iron)
    cells = max(4, round(2 * wl / 1.6))   # about 1.6 m cells; more cells where the tower is wider
    for sy in (-1, 1):
        lace((Vector((-wl, sy * dl, low)), Vector((wl, sy * dl, low))),
             (Vector((-wh, sy * dh, high)), Vector((wh, sy * dh, high))), cells, 0.045)
    for sx in (-1, 1):
        lace((Vector((sx * wl, -dl, low)), Vector((sx * wl, dl, low))),
             (Vector((sx * wh, -dh, high)), Vector((sx * wh, dh, high))), cells, 0.045)
    if index % 2 == 1:
        for sy in (-1, 1):
            beam("horizontal belt", (-wh, sy * dh, high), (wh, sy * dh, high), 0.11, iron)
        for sx in (-1, 1):
            beam("horizontal belt", (sx * wh, -dh, high), (sx * wh, dh, high), 0.11, iron)

# Central lattice elevator well, roof garden to the box. 1912 text (PID 946141 fr.268):
# 「此處よりエレベーターの裝置を以て塔の頂顚に達すべく」; two vertical lines run up the
# middle of each face in view A and plate 46. The ground-level well through the arch is
# 1938 only (S8), so it is not built here.
WELL = 0.28 * SHAFT_TOP_HALF_W
well_levels = [SHAFT_START + (SHAFT_TOP - SHAFT_START) * i / 12 for i in range(13)]
for sx in (-1, 1):
    for sy in (-1, 1):
        beam("elevator well post", (sx * WELL, sy * WELL, SHAFT_START),
             (sx * WELL, sy * WELL, SHAFT_TOP), 0.07, iron)
for low, high in zip(well_levels, well_levels[1:]):
    for sy in (-1, 1):
        beam("elevator well brace", (-WELL, sy * WELL, low), (WELL, sy * WELL, high), 0.035, iron, 5)
        beam("elevator well ring", (-WELL, sy * WELL, high), (WELL, sy * WELL, high), 0.04, iron, 5)
    for sx in (-1, 1):
        beam("elevator well brace", (sx * WELL, -WELL, low), (sx * WELL, WELL, high), 0.035, iron, 5)
        beam("elevator well ring", (sx * WELL, -WELL, high), (sx * WELL, WELL, high), 0.04, iron, 5)
block("elevator car (T5 motion; position assumed)",
      (0, 0, SHAFT_START + 0.45 * (SHAFT_TOP - SHAFT_START)), (1.2 * WELL, 1.2 * WELL, 2.3), window)

if ERA == "1912":
    # 1912-14 top (view A, CC0 south c0234001, OML 158510): a solid band, an open railed
    # gallery (light shows through; south rows 77-90) and an openwork ribbed crown.
    # South-view proportions band : gallery : crown = 15.5 : 14.5 : 22.5 (one camera).
    BAND_TOP = above_roof(0.72 + 0.14 * 15.5 / 30)
    GALLERY_TOP = above_roof(0.86)
    block("observation band (solid)", (0, 0, (SHAFT_TOP + BAND_TOP) / 2),
          (8.2, 7.8, BAND_TOP - SHAFT_TOP), iron)
    block("open gallery floor", (0, 0, BAND_TOP + 0.12), (8.6, 8.2, 0.25), trim)
    block("gallery core (elevator head)", (0, 0, (BAND_TOP + GALLERY_TOP) / 2),
          (2.2 * WELL + 0.6, 2.2 * WELL + 0.6, GALLERY_TOP - BAND_TOP), iron)
    rail_top = BAND_TOP + 1.2
    for y in (-4.1, 4.1):
        beam("gallery railing", (-4.2, y, rail_top), (4.2, y, rail_top), 0.06, trim)
        for x in (-4.2, -2.8, -1.4, 0, 1.4, 2.8, 4.2):
            beam("gallery post", (x, y, BAND_TOP), (x, y, GALLERY_TOP), 0.07, trim)
    for x in (-4.2, 4.2):
        beam("gallery side railing", (x, -4.1, rail_top), (x, 4.1, rail_top), 0.06, trim)
        for y in (-2.7, -1.35, 0, 1.35, 2.7):
            beam("gallery side post", (x, y, BAND_TOP), (x, y, GALLERY_TOP), 0.07, trim)
    block("gallery roof ring", (0, 0, GALLERY_TOP), (8.6, 8.2, 0.3), trim)
    crown_base_z = GALLERY_TOP + 0.15
    for n in range(12):
        angle = 2 * math.pi * n / 12
        next_angle = 2 * math.pi * (n + 1) / 12
        p = (3.2 * math.cos(angle), 3.0 * math.sin(angle), crown_base_z)
        q = (2.7 * math.cos(angle), 2.5 * math.sin(angle), CROWN_UPRIGHT_TOP)
        ring_next = (3.2 * math.cos(next_angle), 3.0 * math.sin(next_angle), crown_base_z)
        beam("open crown base ring", p, ring_next, 0.08, iron, 6)
        beam("open crown upright", p, q, 0.07, iron, 6)
        beam("open crown dome rib", q, (0, 0, CROWN_APEX), 0.07, iron, 6)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.45, minor_radius=0.08, location=(0, 0, CROWN_APEX))
    bpy.context.object.name = "crown lantern ring"
    bpy.context.object.data.materials.append(iron)
    beam("top rod", (0, 0, CROWN_APEX - 0.05), (0, 0, HEIGHT), 0.09, iron)
else:
    # 1920s top (plate 46; OML 158880/158886): a tall two-tier enclosed box and a low
    # solid cap, no ribbed crown. The shaft-top height is kept shared (a scenario).
    WIDE_TOP = above_roof(0.865)
    NARROW_TOP = above_roof(0.909)
    CAP_TOP = above_roof(0.93)
    block("enclosed box (wide tier)", (0, 0, (SHAFT_TOP + WIDE_TOP) / 2),
          (8.4, 8.0, WIDE_TOP - SHAFT_TOP), iron)
    for level in (0.35, 0.75):
        z = SHAFT_TOP + level * (WIDE_TOP - SHAFT_TOP)
        for x in (-2.7, -0.9, 0.9, 2.7):
            for y in (-4.02, 4.02):
                block("box window", (x, y, z), (1.3, 0.07, 1.5), window)
    block("enclosed box (narrow tier)", (0, 0, (WIDE_TOP + NARROW_TOP) / 2),
          (5.4, 5.1, NARROW_TOP - WIDE_TOP), iron)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, location=(0, 0, NARROW_TOP))
    bpy.context.object.scale = (2.7, 2.55, CAP_TOP - NARROW_TOP)
    bpy.context.object.name = "low solid cap"
    bpy.context.object.data.materials.append(trim)
    beam("top rod", (0, 0, CAP_TOP - 0.1), (0, 0, HEIGHT), 0.09, iron)

# Neutral reference rendering. The generated GLB excludes camera and floor.
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.04))
floor = bpy.context.object
floor.name = "study floor - render only"
floor.data.materials.append(ground_mat)

bpy.ops.object.camera_add(location=(0, 140, 38))
camera = bpy.context.object
camera.name = "north elevation study camera"
camera.rotation_euler = (Vector((0, 0, 38)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 92
bpy.context.scene.camera = camera

bpy.ops.object.light_add(type="AREA", location=(-45, 70, 90))
light = bpy.context.object
light.data.energy = 12000
light.data.shape = "DISK"
light.data.size = 65

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.render.resolution_x = 1100
scene.render.resolution_y = 1200
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(OUT / f"north-study{SUFFIX}.png")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.7, 0.74, 0.78, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "Medium High Contrast"
scene.view_settings.exposure = 0.8
if "--export-only" not in sys.argv:
    bpy.ops.render.render(write_still=True)

# A first tower must not cost hundreds of draw calls. Merge same-material study
# pieces before GLB export; keep the editable procedural source above.
for mat in (stone, iron, trim, window):
    members = [obj for obj in scene.objects
               if obj.type == "MESH" and obj != floor and obj.data.materials and obj.data.materials[0] == mat]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in members:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = members[0]
    bpy.ops.object.join()
    members[0].name = f"tower study - {mat.name}"

bpy.ops.object.select_all(action="DESELECT")
for obj in scene.objects:
    if obj.type == "MESH" and obj != floor:
        obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT / f"tower-study{SUFFIX}.glb"), export_format="GLB", use_selection=True)
print(f"Study written: north-study{SUFFIX}.png and tower-study{SUFFIX}.glb "
      f"(era {ERA}, iron {IRON}, height {HEIGHT} m, passage depth {PASSAGE_DEPTH} m)")
