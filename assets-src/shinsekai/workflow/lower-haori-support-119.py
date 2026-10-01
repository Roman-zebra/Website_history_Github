import bpy,bmesh,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[3].parent;previous=root/'research-cache/haori-support-119-002';out=root/'research-cache/haori-support-119-003';out.mkdir(exist_ok=True)
assert not (out/'settled.blend').exists()
bpy.ops.wm.open_mainfile(filepath=str(previous/'settled.blend'))
for name in ['Haori_connected','Haori119_bamboo']:
 for v in bpy.data.objects[name].data.vertices:v.co.z-=.08
for name in ['Haori119_cord_0','Haori119_cord_1']:
 ob=bpy.data.objects[name];me=ob.data;points=[Vector(v.co) for v in me.vertices];anchor=sum(points[:8],Vector())/8;end=sum(points[8:16],Vector())/8;end.z-=.08
 direction=(end-anchor).normalized();u=direction.cross(Vector((0,0,1))).normalized();w=direction.cross(u).normalized()
 for i,p in enumerate([anchor,end]):
  for k in range(8):me.vertices[i*8+k].co=p+.002*(u*math.cos(math.tau*k/8)+w*math.sin(math.tau*k/8))
 me.update()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'settled.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'replacement.glb'),export_format='GLB',use_selection=True,export_extras=True,export_tangents=True,export_vertex_color='ACTIVE')
(out/'change.json').write_text(json.dumps({'from':'haori-support-119-002','factor':'Supported garment and bar lower80mm; cords remain anchored to unchanged original peg surfaces','reason':'Both fixed native views hide the short002 cords behind shoulder;119 requires visible cords','geometryQualified':False,'visualQualified':False},indent=2),encoding='utf-8')
