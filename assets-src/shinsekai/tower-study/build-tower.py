"""Parametric, deliberately provisional first-tower silhouette study.

Run with Blender 4.5: blender -b --python build-tower.py
Axes: X east, Y north, Z up; the camera views south from the north side.
The approximately 50-shaku roof-garden level is sourced. The 75.76 m
ground-relative total height is provisional because a 1922 description uses
250 shaku for sea elevation. Horizontal and other intermediate heights are
photo-proportion estimates awaiting calibrated camera matching.
"""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


OUT = Path(__file__).resolve().parent
HEIGHT = 75.76  # Provisional: 250 shaku may describe sea elevation, not tower height.
ROOF_GARDEN_Z = 15.15  # about 50 shaku; lower than the turret crowns
ARCH_RADIUS = 8.5
ARCH_SPRING = 5.0
FACADE_TOP = 15.3
SHAFT_START = 15.85
SHAFT_TOP = 67.5

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


# Triumphal arch: masonry strips leave a continuous open passage. The strip
# count is for the blockout, not a claim about historical stone joints.
for face_y in (-5.0, 5.0):
    for step in range(48):
        x0 = -ARCH_RADIUS + (2 * ARCH_RADIUS * step / 48)
        x1 = -ARCH_RADIUS + (2 * ARCH_RADIUS * (step + 1) / 48)
        x = (x0 + x1) / 2
        arch_top = ARCH_SPRING + math.sqrt(max(0, ARCH_RADIUS ** 2 - x ** 2))
        block("arch spandrel", (x, face_y, (arch_top + FACADE_TOP) / 2),
              (x1 - x0 + 0.02, 0.65, FACADE_TOP - arch_top), stone)
    for side in (-1, 1):
        block("arch pier", (side * 10.9, face_y, FACADE_TOP / 2),
              (4.8, 0.65, FACADE_TOP), stone)
        for i in range(40):
            a0 = math.pi * i / 40
            a1 = math.pi * (i + 1) / 40
            p0 = ((ARCH_RADIUS + 0.25) * math.cos(a0), face_y - 0.38, ARCH_SPRING + (ARCH_RADIUS + 0.25) * math.sin(a0))
            p1 = ((ARCH_RADIUS + 0.25) * math.cos(a1), face_y - 0.38, ARCH_SPRING + (ARCH_RADIUS + 0.25) * math.sin(a1))
            # Only one arch moulding per face; the side loop adds the two halves.
            if (side == 1 and i < 20) or (side == -1 and i >= 20):
                beam("arch moulding", p0, p1, 0.25, trim)

# The historical facade has two prominent flanking turret silhouettes.
for x in (-13.7, 13.7):
    for y in (-5.0, 5.0):
        block("flanking turret", (x, y, 12.1), (4.8, 4.2, 24.2), stone)
        block("turret crown", (x, y, 24.5), (5.5, 4.8, 1.1), trim)
        # The 1914 north view and 1921 plate show rounded cupolas, not cones.
        # The sphere's lower half is hidden by the crown; radii remain guesses.
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8,
                                              location=(x, y, 25.05))
        bpy.context.object.scale = (2.25, 1.95, 1.5)
        bpy.context.object.name = "rounded turret cupola study"
        bpy.context.object.data.materials.append(trim)
        for level in (6.0, 10.5, 15.0, 19.5):
            block("turret window", (x, y - 2.18 if y < 0 else y + 2.18, level),
                  (1.15, 0.08, 2.4), window)
        beam("turret finial", (x, y, 26.5), (x, y, 28.3), 0.12, iron)

block("roof garden deck", (0, 0, ROOF_GARDEN_Z), (23.0, 10.5, 0.5), trim)
for x in [i * 1.5 for i in range(-7, 8)]:
    for y in (-5.5, 5.5):
        beam("roof balustrade", (x, y, ROOF_GARDEN_Z + 0.25), (x, y, ROOF_GARDEN_Z + 1.65), 0.07, trim)


def shaft_half_width(z):
    t = (z - SHAFT_START) / (SHAFT_TOP - SHAFT_START)
    return 2.65 + 8.3 * (1 - t) ** 1.75


def shaft_half_depth(z):
    t = (z - SHAFT_START) / (SHAFT_TOP - SHAFT_START)
    return 2.4 + 3.5 * (1 - t) ** 1.6


levels = [SHAFT_START, 22.0, 28.0, 34.0, 40.0, 46.0, 52.0, 58.0, 64.0, SHAFT_TOP]
for index, (low, high) in enumerate(zip(levels, levels[1:])):
    for sx in (-1, 1):
        for sy in (-1, 1):
            a = (sx * shaft_half_width(low), sy * shaft_half_depth(low), low)
            b = (sx * shaft_half_width(high), sy * shaft_half_depth(high), high)
            beam("tapered lattice leg", a, b, 0.22 if index < 4 else 0.16, iron)
            beam("face diagonal", a,
                 (-sx * shaft_half_width(high), sy * shaft_half_depth(high), high),
                 0.08, iron, 6)
            beam("side diagonal", a,
                 (sx * shaft_half_width(high), -sy * shaft_half_depth(high), high),
                 0.075, iron, 6)
    w, d = shaft_half_width(high), shaft_half_depth(high)
    for sy in (-1, 1):
        beam("horizontal lattice rail", (-w, sy * d, high), (w, sy * d, high), 0.10, iron)
    for sx in (-1, 1):
        beam("horizontal side rail", (sx * w, -d, high), (sx * w, d, high), 0.10, iron)

# Two visible galleries and an open crown approximate the large forms in the
# 1914 north view. Their heights and spans are still photo-proportion estimates.
block("observation underdeck", (0, 0, 67.95), (10.1, 9.0, 0.9), iron)
block("observation room", (0, 0, 70.35), (8.8, 7.8, 3.7), iron)
for x in (-3.2, -1.1, 1.1, 3.2):
    for y in (-3.96, 3.96):
        block("observation window", (x, y, 70.35), (1.45, 0.07, 1.55), window)
block("upper gallery deck", (0, 0, 72.4), (10.5, 9.5, 0.45), iron)
for lower, upper in ((68.4, 69.5), (72.65, 73.55)):
    for y in (-4.65, 4.65):
        beam("gallery rim", (-5.1, y, upper), (5.1, y, upper), 0.08, trim)
        for x in (-5.1, -2.55, 0, 2.55, 5.1):
            beam("gallery post", (x, y, lower), (x, y, upper), 0.065, trim)
    for x in (-5.1, 5.1):
        beam("gallery side rim", (x, -4.65, upper), (x, 4.65, upper), 0.08, trim)
        for y in (-2.3, 0, 2.3):
            beam("gallery side post", (x, y, lower), (x, y, upper), 0.065, trim)
block("crown base", (0, 0, 72.95), (5.6, 5.0, 0.55), trim)
for n in range(12):
    angle = 2 * math.pi * n / 12
    next_angle = 2 * math.pi * (n + 1) / 12
    p = (2.5 * math.cos(angle), 2.2 * math.sin(angle), 73.25)
    q = (2.2 * math.cos(angle), 1.95 * math.sin(angle), 74.75)
    ring_next = (2.5 * math.cos(next_angle), 2.2 * math.sin(next_angle), 73.25)
    beam("open crown base ring", p, ring_next, 0.08, iron, 6)
    beam("open crown upright", p, q, 0.07, iron, 6)
    beam("open crown dome rib", q, (0, 0, 75.45), 0.07, iron, 6)
beam("top finial", (0, 0, 75.4), (0, 0, HEIGHT), 0.09, iron)

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
print(f"Study written: {OUT / 'north-study.png'} and {OUT / 'tower-study.glb'}")
