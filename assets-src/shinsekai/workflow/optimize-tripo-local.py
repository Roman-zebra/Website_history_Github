"""Reduce an existing private GLB; immutable input, fresh numbered output folder."""
import argparse, hashlib, json, pathlib, sys
import bpy, bmesh
from mathutils import Vector

args=argparse.ArgumentParser()
args.add_argument('--input',required=True)
args.add_argument('--out-dir',required=True)
args.add_argument('--triangles',type=int,nargs='+',default=[4000,1000])
opt=args.parse_args(sys.argv[sys.argv.index('--')+1:])
source=pathlib.Path(opt.input).resolve(); out=pathlib.Path(opt.out_dir).resolve()
assert source.is_file() and source.suffix.lower()=='.glb'
assert all(50<=n<=100000 for n in opt.triangles)
out.mkdir(parents=True,exist_ok=False)
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source_hash=digest(source)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
assert len(objects)==1,'This pilot accepts one mesh only; building splitting needs a separate brief'
obj=objects[0]
# GLB render vertices can split a surface at UV/normal seams. Weld only coincident
# geometry before collapse; keep per-loop UV seams. Source remains immutable.
mesh=bmesh.new();mesh.from_mesh(obj.data)
before_vertices=len(mesh.verts)
bmesh.ops.remove_doubles(mesh,verts=list(mesh.verts),dist=0.0000001)
mesh.to_mesh(obj.data);mesh.free();obj.data.update()
print('Coincident vertices:',before_vertices,'->',len(obj.data.vertices),flush=True)
original=obj.data.copy()
original.calc_loop_triangles(); original_tri=len(original.loop_triangles)
records=[]
for target in opt.triangles:
    obj.data=original.copy()
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    modifier=obj.modifiers.new(name='Local mobile candidate',type='DECIMATE')
    modifier.decimate_type='COLLAPSE'
    modifier.ratio=target/original_tri
    modifier.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.calc_loop_triangles(); actual=len(obj.data.loop_triangles)
    assert actual<=target+4,(target,actual)
    file=out/f'baluster-{target}.glb'
    bpy.ops.export_scene.gltf(filepath=str(file),export_format='GLB',use_selection=True,export_yup=True,export_image_format='AUTO',export_animations=False,export_tangents=True)
    coords=[obj.matrix_world@Vector(c) for c in obj.bound_box]
    records.append({'target':target,'triangles':actual,'bytes':file.stat().st_size,'sha256':digest(file),'file':file.name,'boundsBlender':[[min(c[i] for c in coords) for i in range(3)],[max(c[i] for c in coords) for i in range(3)]],'productionApproved':False})
    bpy.ops.wm.save_as_mainfile(filepath=str(out/f'baluster-{target}.blend'))
assert digest(source)==source_hash
(out/'receipt.json').write_text(json.dumps({'blender':bpy.app.version_string,'sourceSha256':source_hash,'sourceUnchanged':True,'sourceTriangles':original_tri,'additionalStudioCredits':0,'candidates':records,'limits':['single mesh pilot','source texture unchanged','scale uncalibrated','no mobile fps acceptance','no production placement']},indent=2)+'\n',encoding='utf-8')
print(json.dumps(records))
