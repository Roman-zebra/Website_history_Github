import bpy,bmesh,json,hashlib
from pathlib import Path
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[3].parent;folder=root/'research-cache/haori-frontfold-119-008'
assert not (folder/'verification.json').exists()
def snapshot():
 rows={}
 for o in bpy.context.scene.objects:
  if o.type!='MESH':continue
  rows[o.name]={'matrix':[list(r) for r in o.matrix_world],'vertices':[list(v.co) for v in o.data.vertices],'faces':[list(f.vertices) for f in o.data.polygons],'uv':[[list(v.uv) for v in l.data] for l in o.data.uv_layers],'colours':[[list(v.color) for v in a.data] for a in o.data.color_attributes],'materials':[m.name for m in o.data.materials]}
 return hashlib.sha256(json.dumps(rows,sort_keys=True).encode()).hexdigest()
scene=folder/'candidate-export-r2.blend';bpy.ops.wm.open_mainfile(filepath=str(scene));before=snapshot();custom=bpy.data.objects['Haori_connected'].data.has_custom_normals
bpy.ops.wm.open_mainfile(filepath=str(scene));assert snapshot()==before
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(folder/'upper-cloth-support.glb'));garment=bpy.data.objects['Haori_connected']
for name in ['interior','exterior-lod0']:
 bpy.ops.import_scene.gltf(filepath=str(root/'repo/assets-src/shinsekai/eval-building-a/hybrid/runtime'/f'{name}.glb'))
bpy.context.view_layer.update();garment.data.calc_loop_triangles()
points=[garment.matrix_world@v.co for v in garment.data.vertices];tri=[tuple(t.vertices) for t in garment.data.loop_triangles];assert len(tri)==3212
bm=bmesh.new();bm.from_mesh(garment.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-5)
assert all(len(e.link_faces)==2 for e in bm.edges),'Exported shell not closed'
pending=set(bm.verts);components=0
while pending:
 components+=1;stack=[pending.pop()]
 while stack:
  for e in stack.pop().link_edges:
   for v in e.verts:
    if v in pending:pending.remove(v);stack.append(v)
assert components==1;volume=bm.calc_volume(signed=True);assert volume>0;bm.free()
tree=BVHTree.FromPolygons(points,tri,all_triangles=True);contacts={}
for other in bpy.context.scene.objects:
 if other.type!='MESH' or other==garment:continue
 other.data.calc_loop_triangles();ps=[other.matrix_world@v.co for v in other.data.vertices];fs=[tuple(t.vertices) for t in other.data.loop_triangles]
 pairs=tree.overlap(BVHTree.FromPolygons(ps,fs,all_triangles=True))
 if pairs:contacts[other.name]=len(pairs)
assert not contacts,contacts
source=root/'repo/assets-src/shinsekai/eval-building-a/hybrid/runtime/upper-cloth-v2-sewn-rail.glb'
assert hashlib.sha256(source.read_bytes()).hexdigest()=='7240ebf2851bc40a80e5bb2fc95644b2c4f372a08935a597d8c04f730f0b0f30'
out={'blender':bpy.app.version_string,'candidateSceneSHA256':hashlib.sha256(scene.read_bytes()).hexdigest(),'savedSceneReopenGeometryUVColourMaterialsMatricesExact':True,'sceneCustomNormals':custom,'candidateSHA256':hashlib.sha256((folder/'upper-cloth-support.glb').read_bytes()).hexdigest(),'candidateBytes':(folder/'upper-cloth-support.glb').stat().st_size,'exportedClothTriangles':len(tri),'exportedCoordinateWeldedClosedComponents':components,'signedVolumeM3':volume,'allOtherExportedInteriorExteriorHardwareSupportSurfacePairs':contacts,'frozenSourceUnchanged':True,'limitations':'Discrete surface pairs/coordinate weld/reopen geometry scope; not all containment, continuous collision, material-cache or actual device certification.'}
(folder/'verification.json').write_text(json.dumps(out,indent=2),encoding='utf-8');print('VERIFY',json.dumps(out),flush=True)
