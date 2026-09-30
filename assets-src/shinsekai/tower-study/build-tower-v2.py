"""Parametric, deliberately provisional first-tower silhouette study (v2).

Run with Blender 4.5 from the repository root:
    blender -b --python assets-src/shinsekai/tower-study/build-tower.py -- [--height 75.76] [--passage-depth 26] [--export-only]
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
"""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def arg(name, default):
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return float(argv[argv.index(name) + 1]) if name in argv else default


OUT = Path(__file__).resolve().parent
HEIGHT = arg("--height", 75.76)             # parameter; see module docstring
PASSAGE_DEPTH = arg("--passage-depth", 26.0)  # parameter; north-south depth of the base block
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
iron = material("provisional dark iron", (0.14, 0.17, 0.17, 1), 0.6, 0.55)
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


def shaft_half(z, top_half):
    t = min(1.0, max(0.0, (z - SHAFT_START) / (SHAFT_TOP - SHAFT_START)))
    return top_half + (SHAFT_BASE_HALF - top_half) * (1 - t) ** 0.9


segments = 9
levels = [SHAFT_START + (SHAFT_TOP - SHAFT_START) * i / segments for i in range(segments + 1)]
for index, (low, high) in enumerate(zip(levels, levels[1:])):
    wl, dl = shaft_half(low, SHAFT_TOP_HALF_W), shaft_half(low, SHAFT_TOP_HALF_D)
    wh, dh = shaft_half(high, SHAFT_TOP_HALF_W), shaft_half(high, SHAFT_TOP_HALF_D)
    for sx in (-1, 1):
        for sy in (-1, 1):
            a = (sx * wl, sy * dl, low)
            beam("tapered lattice leg", a, (sx * wh, sy * dh, high), 0.22 if index < 4 else 0.16, iron)
            beam("face diagonal", a, (-sx * wh, sy * dh, high), 0.08, iron, 6)
            beam("side diagonal", a, (sx * wh, -sy * dh, high), 0.075, iron, 6)
    for sy in (-1, 1):
        beam("horizontal lattice rail", (-wh, sy * dh, high), (wh, sy * dh, high), 0.10, iron)
    for sx in (-1, 1):
        beam("horizontal side rail", (sx * wh, -dh, high), (sx * wh, dh, high), 0.10, iron)

# Observation box with two galleries and an open crown, placed by the photo
# fractions above. Plan sizes are estimates (box about 7.9 m wide in view A).
block("observation underdeck", (0, 0, SHAFT_TOP + 0.45), (8.4, 8.0, 0.9), iron)
room_bottom = SHAFT_TOP + 0.9
block("observation room", (0, 0, (room_bottom + ROOM_TOP) / 2), (7.6, 7.2, ROOM_TOP - room_bottom), iron)
for level in (room_bottom + 0.35 * (ROOM_TOP - room_bottom), room_bottom + 0.75 * (ROOM_TOP - room_bottom)):
    for x in (-2.7, -0.9, 0.9, 2.7):
        for y in (-3.62, 3.62):
            block("observation window", (x, y, level), (1.3, 0.07, 1.5), window)
block("upper gallery deck", (0, 0, ROOM_TOP + 0.22), (8.6, 8.2, 0.45), iron)
for lower in (room_bottom, ROOM_TOP + 0.45):
    upper = lower + 1.1
    for y in (-4.05, 4.05):
        beam("gallery rim", (-4.2, y, upper), (4.2, y, upper), 0.08, trim)
        for x in (-4.2, -2.1, 0, 2.1, 4.2):
            beam("gallery post", (x, y, lower), (x, y, upper), 0.065, trim)
    for x in (-4.2, 4.2):
        beam("gallery side rim", (x, -4.05, upper), (x, 4.05, upper), 0.08, trim)
        for y in (-2.0, 0, 2.0):
            beam("gallery side post", (x, y, lower), (x, y, upper), 0.065, trim)
block("crown base", (0, 0, CROWN_BASE), (5.6, 5.0, 0.55), trim)
for n in range(12):
    angle = 2 * math.pi * n / 12
    next_angle = 2 * math.pi * (n + 1) / 12
    p = (2.5 * math.cos(angle), 2.2 * math.sin(angle), CROWN_BASE + 0.3)
    q = (2.2 * math.cos(angle), 1.95 * math.sin(angle), CROWN_UPRIGHT_TOP)
    ring_next = (2.5 * math.cos(next_angle), 2.2 * math.sin(next_angle), CROWN_BASE + 0.3)
    beam("open crown base ring", p, ring_next, 0.08, iron, 6)
    beam("open crown upright", p, q, 0.07, iron, 6)
    beam("open crown dome rib", q, (0, 0, CROWN_APEX), 0.07, iron, 6)
beam("top finial", (0, 0, CROWN_APEX - 0.05), (0, 0, HEIGHT), 0.09, iron)

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
scene.render.filepath = str(OUT / "north-study.png")
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
bpy.ops.export_scene.gltf(filepath=str(OUT / "tower-study.glb"), export_format="GLB", use_selection=True)
print(f"Study written: {OUT / 'north-study.png'} and {OUT / 'tower-study.glb'} "
      f"(height {HEIGHT} m, passage depth {PASSAGE_DEPTH} m)")
