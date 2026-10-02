"""Technical export only: triangulate subdivision transition ngons for tangents."""
import bpy,bmesh,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[3].parent;folder=root/'research-cache/haori-frontfold-119-008'
assert not (folder/'replacement-r2.glb').exists()
bpy.ops.wm.open_mainfile(filepath=str(folder/'candidate.blend'))
ob=bpy.data.objects['Haori_connected'];positions=[tuple(v.co) for v in ob.data.vertices]
bm=bmesh.new();bm.from_mesh(ob.data);ngons=[f for f in bm.faces if len(f.verts)>4];count=len(ngons)
bmesh.ops.triangulate(bm,faces=ngons);bm.to_mesh(ob.data);bm.free();assert positions==[tuple(v.co) for v in ob.data.vertices]
ob.data.calc_loop_triangles();assert len(ob.data.loop_triangles)==3212
bpy.ops.object.select_all(action='DESELECT')
for name in ['Haori_connected','Haori119_bamboo','Haori119_cord_0','Haori119_cord_1']:bpy.data.objects[name].select_set(True)
bpy.context.view_layer.objects.active=ob
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'candidate-export-r2.blend'))
bpy.ops.export_scene.gltf(filepath=str(folder/'replacement-r2.glb'),export_format='GLB',use_selection=True,export_extras=True,export_tangents=True,export_vertex_color='ACTIVE')
r={'transitionNgonsTriangulated':count,'positionsExact':True,'trianglesUnchanged':3212,'candidateSceneSHA256':hashlib.sha256((folder/'candidate.blend').read_bytes()).hexdigest(),'reason':'Initial export retained and unaccepted: ngon transitions prevent MikkTSpace garment tangents; fixed triangulation only, no shape/material/light change.'}
(folder/'technical-export-r2.json').write_text(json.dumps(r,indent=2),encoding='utf-8');print('EXPORT',json.dumps(r),flush=True)
