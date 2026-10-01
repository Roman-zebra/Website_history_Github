import bpy,bmesh,json,sys
from pathlib import Path
folder=Path(__file__).resolve().parents[3].parent/'research-cache/haori-support-119-001'
assert not (folder/'replacement-r2.glb').exists(),'Preserve existing technical export'
bpy.ops.wm.open_mainfile(filepath=str(folder/'settled.blend'))
for ob in bpy.context.scene.objects:
 if ob.name.startswith('Haori119_'):
  bm=bmesh.new();bm.from_mesh(ob.data)
  for face in bm.faces:
   if len(face.verts)>4:
    layer=bm.loops.layers.uv['UVMap'];centre=face.calc_center_median();axis=(face.verts[1].co-face.verts[0].co).normalized();other=face.normal.cross(axis).normalized()
    for loop in face.loops:
     d=loop.vert.co-centre;loop[layer].uv=(d.dot(axis)/.024+.5,d.dot(other)/.024+.5)
  bmesh.ops.triangulate(bm,faces=[f for f in bm.faces if len(f.verts)>4]);bm.to_mesh(ob.data);bm.free()
repo=folder.parents[1]/'repo';sys.path.insert(0,str(repo/'assets-src/shinsekai/eval-building-a/hybrid'))
from upper_portable import repair_export_tangents
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'settled-export-r2.blend'))
bpy.ops.export_scene.gltf(filepath=str(folder/'replacement-r2.glb'),export_format='GLB',use_selection=True,export_extras=True,export_tangents=True,export_vertex_color='ACTIVE')
print('TANGENT',repair_export_tangents(folder/'replacement-r2.glb'),flush=True)
