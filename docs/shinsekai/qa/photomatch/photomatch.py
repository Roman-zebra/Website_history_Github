"""Photo-match overlay for the first-tower study (Claude, P13).

Run: blender -b --factory-startup --python photomatch.py -- config.json
Reads a GLB (read-only; e.g. Codex's tower-study.glb), sets a pinhole camera from
photo-fitted parameters, renders the model with a transparent background, and writes
  <out>_render.png    model only (RGBA)
  <out>_overlay.png   photo + translucent model + red outline + markers
  <out>_points.json   projected model points vs photo landmarks (px and metres)
Axes follow build-tower.py: X east, Y north, Z up (metres). Pixel coordinates are in
the photo crop given by config["photo"], origin top-left, y down.
"""
import bpy, sys, json, math
import numpy as np
from mathutils import Vector, Euler, Matrix
from bpy_extras.object_utils import world_to_camera_view

cfg = json.load(open(sys.argv[sys.argv.index('--') + 1], encoding='utf-8'))
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=cfg['glb'])
meshes = [o for o in scene.objects if o.type == 'MESH']

# Optional vertex transforms to test proposed dimensions without editing the source model.
# Each transform has a vertex filter (zmin, zmax, xabs_min, xabs_max, yabs_min) and a kind:
#   scale_z   z' = z0 + (z - z0) * s
#   taper_xy  x, y *= s0 + (s1 - s0) * clamp((z - z0) / (z1 - z0))
#   shift_y_out  y += sign(y) * d   (deepens the base symmetrically)
for tf in cfg.get('transforms', []):
    for o in meshes:
        mw = o.matrix_world
        inv = mw.inverted()
        for v in o.data.vertices:
            p = mw @ v.co
            if not (tf.get('zmin', -1e9) <= p.z <= tf.get('zmax', 1e9)
                    and tf.get('xabs_min', 0) <= abs(p.x) <= tf.get('xabs_max', 1e9)
                    and abs(p.y) >= tf.get('yabs_min', 0)):
                continue
            if tf['kind'] == 'scale_z':
                p.z = tf['z0'] + (p.z - tf['z0']) * tf['s']
            elif tf['kind'] == 'taper_xy':
                k = min(1.0, max(0.0, (p.z - tf['z0']) / (tf['z1'] - tf['z0'])))
                f = tf['s0'] + (tf['s1'] - tf['s0']) * k
                p.x *= f
                p.y *= f
            elif tf['kind'] == 'shift_y_out':
                p.y += math.copysign(tf['d'], p.y)
            v.co = inv @ p

W, H = cfg['W'], cfg['H']
r = scene.render
r.resolution_x, r.resolution_y, r.resolution_percentage = W, H, 100
cd = bpy.data.cameras.new('pm')
cam = bpy.data.objects.new('pm', cd)
scene.collection.objects.link(cam)
scene.camera = cam
cd.sensor_fit = 'HORIZONTAL'
cd.sensor_width = 36.0
cd.lens = cfg['f_px'] * 36.0 / W
cd.clip_start, cd.clip_end = 0.1, 3000
cam.location = Vector(cfg['cam'])
heading = math.radians(cfg.get('heading_deg', 180))   # clockwise from north (+Y)
pitch = math.radians(cfg.get('pitch_deg', 0))          # up positive
roll = math.radians(cfg.get('roll_deg', 0))
rot = Euler((math.radians(90) + pitch, 0, -heading), 'XYZ').to_matrix() @ Matrix.Rotation(roll, 3, 'Z')
cam.rotation_euler = rot.to_euler('XYZ')
bpy.context.view_layer.update()


def proj(p):
    q = world_to_camera_view(scene, cam, Vector(p))
    return (q.x * W, (1 - q.y) * H, q.z)


# Calibrate lens shift so the optical axis lands on the photo's principal point (cx, cy).
fwd = rot @ Vector((0, 0, -1))
axis_pt = cam.location + fwd * 100
cd.shift_x = cd.shift_y = 0
bpy.context.view_layer.update()
p0 = proj(axis_pt)
cd.shift_x, cd.shift_y = 0.1, 0.1
bpy.context.view_layer.update()
p1 = proj(axis_pt)
ux, uy = (p1[0] - p0[0]) / 0.1, (p1[1] - p0[1]) / 0.1
cd.shift_x = (cfg['cx'] - p0[0]) / ux
cd.shift_y = (cfg['cy'] - p0[1]) / uy
bpy.context.view_layer.update()
chk = proj(axis_pt)

# Render: flat colours per material group, transparent background.
colors = {'stone': (1.0, 0.85, 0.1, 1), 'iron': (0.1, 0.9, 1.0, 1), 'trim': (1.0, 0.3, 1.0, 1), 'window': (0.2, 0.2, 0.9, 1)}
for o in meshes:
    key = next((k for k in colors if k in o.name.lower() or any(k in (m.name.lower() if m else '') for m in o.data.materials)), None)
    o.color = colors.get(key, (1, 1, 1, 1))
r.engine = 'BLENDER_WORKBENCH'
sh = scene.display.shading
sh.light = 'FLAT'
sh.color_type = 'OBJECT'
r.film_transparent = True
scene.display.render_aa = '8'
scene.view_settings.view_transform = 'Standard'
r.image_settings.file_format = 'PNG'
r.image_settings.color_mode = 'RGBA'
out = cfg['out']
r.filepath = out + '_render.png'
bpy.ops.render.render(write_still=True)

# Composite with numpy (Blender images are bottom-up RGBA floats).
def load(path):
    im = bpy.data.images.load(path)
    a = np.empty(im.size[0] * im.size[1] * 4, dtype=np.float32)
    im.pixels.foreach_get(a)
    return a.reshape(im.size[1], im.size[0], 4)[::-1].copy()

photo = load(cfg['photo'])
assert photo.shape[0] == H and photo.shape[1] == W, (photo.shape, W, H)
ren = load(out + '_render.png')
al = ren[..., 3:4] * cfg.get('fill_alpha', 0.35)
comp = photo.copy()
comp[..., :3] = photo[..., :3] * (1 - al) + ren[..., :3] * al
m = ren[..., 3] > 0.5
edge = m & ~(np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1))
comp[edge, :3] = (1.0, 0.05, 0.05)


def cross(img, x, y, col, s=14, t=2):
    x, y = int(round(x)), int(round(y))
    for dx in range(-s, s + 1):
        for dt in range(-t, t + 1):
            for (xx, yy) in ((x + dx, y + dt), (x + dt, y + dx)):
                if 0 <= xx < W and 0 <= yy < H:
                    img[yy, xx, :3] = col

res = {'camera': {k: cfg[k] for k in ('cam', 'heading_deg', 'pitch_deg', 'f_px', 'cx', 'cy') if k in cfg},
       'principal_point_check_px': [round(chk[0], 1), round(chk[1], 1)],
       'lens_mm_on_36mm': round(cd.lens, 3), 'shift': [round(cd.shift_x, 5), round(cd.shift_y, 5)], 'points': {}}
marks = cfg.get('photo_marks', {})
for name, p in cfg.get('points', {}).items():
    x, y, depth = proj(p)
    cross(comp, x, y, (1.0, 0.1, 0.1))
    e = {'model_xyz': p, 'model_px': [round(x, 1), round(y, 1)]}
    if name in marks:
        mx, my = marks[name]
        cross(comp, mx, my, (0.1, 1.0, 0.2))
        e['photo_px'] = [mx, my]
        e['d_px'] = [round(x - mx, 1), round(y - my, 1)]
        dist = math.hypot(p[0] - cfg['cam'][0], p[1] - cfg['cam'][1])
        # metres at the model point's horizontal distance (+ = model sits lower/right than photo)
        e['d_m_at_point_depth'] = [round((x - mx) * dist / cfg['f_px'], 2), round(-(y - my) * dist / cfg['f_px'], 2)]
    res['points'][name] = e
for name, (mx, my) in marks.items():
    if name not in cfg.get('points', {}):
        cross(comp, mx, my, (0.1, 1.0, 0.2))
if 'horizon_row' in cfg:
    y = int(cfg['horizon_row'])
    comp[y - 1:y + 1, ::6, :3] = (0.1, 1.0, 0.2)

img = bpy.data.images.new('comp', W, H, alpha=True)
img.pixels.foreach_set(comp[::-1].ravel())
img.filepath_raw = out + '_overlay.png'
img.file_format = 'PNG'
img.save()
json.dump(res, open(out + '_points.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('PHOTOMATCH OK', out)
