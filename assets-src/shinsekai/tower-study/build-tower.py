"""Parametric, deliberately provisional first-tower silhouette study.

Run with Blender 4.5: blender -b --python build-tower.py
Axes: X east, Y north, Z up; the camera views south from the north side.
The 75.76 m total height is sourced; horizontal and intermediate heights are
photo-proportion estimates awaiting calibrated camera matching.
"""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


OUT = Path(__file__).resolve().parent
HEIGHT = 75.76
ARCH_RADIUS = 10.2
ARCH_SPRING = 7.4
FACADE_TOP = 24.0
SHAFT_START = 25.0
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
        block("arch pier", (side * 12.6, face_y, FACADE_TOP / 2),
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
for x in (-15.8, 15.8):
    for y in (-5.0, 5.0):
        block("flanking turret", (x, y, 15.5), (4.8, 4.2, 31.0), stone)
        block("turret crown", (x, y, 31.3), (5.5, 4.8, 1.1), trim)
        bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=2.2, radius2=0.6,
                                    depth=2.0, location=(x, y, 32.8))
        bpy.context.object.name = "turret cupola silhouette"
        bpy.context.object.data.materials.append(trim)
        for level in (10.2, 14.4, 18.6, 22.8):
            block("turret window", (x, y - 2.18 if y < 0 else y + 2.18, level),
                  (1.15, 0.08, 2.4), window)
    beam("turret finial", (x, -5.0, 33.8), (x, -5.0, 35.1), 0.12, iron)

block("roof garden deck", (0, 0, 24.7), (23.0, 10.5, 1.0), trim)
for x in [i * 1.5 for i in range(-7, 8)]:
    for y in (-5.5, 5.5):
        beam("roof balustrade", (x, y, 25.2), (x, y, 26.6), 0.07, trim)


def shaft_half_width(z):
    t = (z - SHAFT_START) / (SHAFT_TOP - SHAFT_START)
    return 2.65 + 8.3 * (1 - t) ** 1.75


def shaft_half_depth(z):
    t = (z - SHAFT_START) / (SHAFT_TOP - SHAFT_START)
    return 2.4 + 3.5 * (1 - t) ** 1.6


levels = [SHAFT_START, 29.0, 34.0, 39.0, 44.0, 49.0, 54.0, 59.0, 64.0, SHAFT_TOP]
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

# A glazed-looking observation volume and light crown approximate the outline.
block("observation underdeck", (0, 0, 68.1), (10.1, 9.0, 1.2), iron)
block("observation room", (0, 0, 70.7), (9.3, 8.3, 4.2), iron)
for x in (-3.2, -1.1, 1.1, 3.2):
    for y in (-4.21, 4.21):
        block("observation window", (x, y, 70.8), (1.45, 0.07, 1.55), window)
block("observation cornice", (0, 0, 73.1), (10.5, 9.5, 0.85), iron)
block("crown base", (0, 0, 74.0), (6.2, 5.4, 0.7), trim)
for n in range(12):
    angle = 2 * math.pi * n / 12
    p = (2.6 * math.cos(angle), 2.2 * math.sin(angle), 74.3)
    beam("crown ribs", p, (0, 0, HEIGHT - 0.25), 0.075, iron, 6)
beam("top finial", (0, 0, HEIGHT - 0.3), (0, 0, HEIGHT), 0.09, iron)

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
