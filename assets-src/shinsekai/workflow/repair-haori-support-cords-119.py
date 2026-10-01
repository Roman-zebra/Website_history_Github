import bpy,bmesh,json,math,sys,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[3].parent;previous=root/'research-cache/haori-support-119-001';out=root/'research-cache/haori-support-119-002';out.mkdir(exist_ok=True)
assert not (out/'settled.blend').exists(),'Preserve numbered candidate'
bpy.ops.wm.open_mainfile(filepath=str(previous/'settled-export-r2.blend'))
barx,barz=.45,4.87
hardware=bpy.data.objects['UD_CoatRail_Haori_v2'];hardware.data.calc_loop_triangles()
tree=BVHTree.FromPolygons([hardware.matrix_world@v.co for v in hardware.data.vertices],[tuple(t.vertices) for t in hardware.data.loop_triangles],all_triangles=True)
records=[]
for i,(y,end_y) in enumerate([(1.97,1.73),(2.32,2.64)]):
 ob=bpy.data.objects['Haori119_cord_'+str(i)]
 anchor=tree.find_nearest(Vector((.284,y,4.9176)))[0];points=[anchor,Vector((barx,end_y,barz+.014))]
 direction=(points[1]-points[0]).normalized();u=direction.cross(Vector((0,0,1))).normalized();w=direction.cross(u).normalized();v=[];f=[]
 for p in points:
  for k in range(8):v.append(tuple(p+.002*(u*math.cos(math.tau*k/8)+w*math.sin(math.tau*k/8))))
 for k in range(8):f.append((k,(k+1)%8,8+(k+1)%8,8+k))
 f.extend([tuple(range(7,-1,-1)),tuple(8+k for k in range(8))])
 me=bpy.data.meshes.new(ob.name+' exposed end attachments');me.from_pydata(v,[],f);me.update();me.materials.append(ob.data.materials[0]);me.uv_layers.new(name='UVMap');me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
 oldcolour=ob.data.color_attributes['Color'].data[0].color
 for p in me.polygons:
  p.use_smooth=len(p.vertices)==4
  for li in p.loop_indices:
   vi=me.loops[li].vertex_index
   me.uv_layers['UVMap'].data[li].uv=(vi%8/8,vi//8*(points[1]-points[0]).length/.25)
   me.color_attributes['Color'].data[li].color=oldcolour
 bm=bmesh.new();bm.from_mesh(me);layer=bm.loops.layers.uv['UVMap']
 for face in bm.faces:
  if len(face.verts)>4:
   centre=face.calc_center_median()
   for loop in face.loops:
    d=loop.vert.co-centre;loop[layer].uv=(d.dot(u)/.004+.5,d.dot(w)/.004+.5)
 bmesh.ops.triangulate(bm,faces=[f for f in bm.faces if len(f.verts)>4]);bm.to_mesh(me);bm.free();ob.data=me
 records.append({'name':ob.name,'anchor':list(anchor),'barEnd':list(points[1]),'sourceHardwareAnchorDistance':tree.find_nearest(anchor)[3]})
bpy.ops.wm.save_as_mainfile(filepath=str(out/'settled.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'replacement.glb'),export_format='GLB',use_selection=True,export_extras=True,export_tangents=True,export_vertex_color='ACTIVE')
(out/'cord-receipt.json').write_text(json.dumps(records,indent=2),encoding='utf-8');print(records,flush=True)
