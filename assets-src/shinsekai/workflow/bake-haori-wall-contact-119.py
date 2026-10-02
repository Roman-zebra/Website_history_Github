"""Owned005 finite wall AO; unchanged003 garment and actual wall-plane contract."""
import bpy,array,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[3].parent
out=root/'research-cache/haori-wall-contact-119-005';out.mkdir(exist_ok=True)
assert not (out/'wall-contact.png').exists(),'Preserve numbered bake'
inputs=[root/'research-cache/haori-support-119-003/upper-cloth-support.glb',root/'repo/assets-src/shinsekai/eval-building-a/hybrid/runtime/exterior-lod0.glb']
hashes={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(inputs[1]));bpy.context.view_layer.update()
wall=bpy.data.objects['BldgA_LOD0_sideL'];ps=[wall.matrix_world@wall.data.vertices[i].co for f in wall.data.polygons if wall.data.materials[f.material_index].name=='M_Plaster_Int' for i in f.vertices]
lo=[min(v[k] for v in ps) for k in range(3)];hi=[max(v[k] for v in ps) for k in range(3)]
assert all(abs(v-e)<1e-5 for v,e in zip(lo,[.18,0,-.1])) and all(abs(v-e)<1e-5 for v,e in zip(hi,[.18,9,6]))
bpy.ops.import_scene.gltf(filepath=str(inputs[0]));bpy.context.view_layer.update()
coat=bpy.data.objects['UD_CoatRail_Haori_v2'];casters={coat,*coat.children_recursive};caster_names=sorted(o.name for o in casters)
for ob in bpy.context.scene.objects:ob.hide_render=ob not in casters
mesh=bpy.data.meshes.new('Actual west-wall005 receiver');mesh.from_pydata([(.18,1,3.35),(.18,3.4,3.35),(.18,3.4,5.55),(.18,1,5.55)],[],[(0,1,2,3)]);mesh.update();assert mesh.polygons[0].normal.x>.99
receiver=bpy.data.objects.new('Actual west-wall005 receiver',mesh);bpy.context.scene.collection.objects.link(receiver)
layer=mesh.uv_layers.new(name='contact_planar');coords=[(0,0),(1,0),(1,1),(0,1)]
for loop in mesh.loops:layer.data[loop.index].uv=coords[loop.vertex_index]
mat=bpy.data.materials.new('haori_wall_contact005');mat.use_nodes=True;mesh.materials.append(mat);nodes=mat.node_tree.nodes;nodes.clear()
ao=nodes.new('ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value=.55;ao.samples=32;ao.only_local=False;ao.inside=False
emit=nodes.new('ShaderNodeEmission');surface=nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(ao.outputs['AO'],emit.inputs['Color']);mat.node_tree.links.new(emit.outputs[0],surface.inputs['Surface'])
image=bpy.data.images.new('haori_wall_contact005',width=512,height=512,alpha=False,float_buffer=False,is_data=True);image.colorspace_settings.name='Non-Color';image.generated_color=(1,1,1,1)
target=nodes.new('ShaderNodeTexImage');target.image=image;nodes.active=target
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.seed=119005;scene.cycles.use_denoising=False;scene.render.bake.margin=4;scene.render.bake.use_clear=True
bpy.ops.object.select_all(action='DESELECT');receiver.select_set(True);bpy.context.view_layer.objects.active=receiver;bpy.ops.object.bake(type='EMIT')
pixels=array.array('f',[0])*len(image.pixels);image.pixels.foreach_get(pixels);values=pixels[::4]
assert min(values)<.7 and max(values)>.99
border=[values[i] for i in range(len(values)) if i//512 in [0,511] or i%512 in [0,511]];assert min(border)>.99,('Map boundary not white',min(border))
image.filepath_raw=str(out/'wall-contact.png');image.file_format='PNG';image.save();image.pack()
def snapshot():
 return {'objects':{o.name:{'matrix':[list(row) for row in o.matrix_world],'hidden':o.hide_render,'vertices':[list(v.co) for v in o.data.vertices] if o.type=='MESH' else None,'faces':[list(p.vertices) for p in o.data.polygons] if o.type=='MESH' else None,'UV':[[list(v.uv) for v in layer.data] for layer in o.data.uv_layers] if o.type=='MESH' else None} for o in bpy.context.scene.objects},'packedImage':hashlib.sha256(bpy.data.images['haori_wall_contact005'].packed_file.data).hexdigest(),'samples':bpy.context.scene.cycles.samples,'seed':bpy.context.scene.cycles.seed,'distance':bpy.data.materials['haori_wall_contact005'].node_tree.nodes.get('Ambient Occlusion').inputs['Distance'].default_value}
before=snapshot();bpy.ops.wm.save_as_mainfile(filepath=str(out/'contact-bake.blend'));bpy.ops.wm.open_mainfile(filepath=str(out/'contact-bake.blend'));assert snapshot()==before
assert hashes=={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
r={'round':'haori-wall-contact-119-005','blender':bpy.app.version_string,'inputs':hashes,'sourceUnchanged':True,'wallWorldBounds':[lo,hi],'mapSize':[512,512],'colourSpace':'Non-Color','min':min(values),'max':max(values),'borderMinimum':min(border),'pixelsBelowPoint9':sum(v<.9 for v in values),'PNGBytes':(out/'wall-contact.png').stat().st_size,'pngSHA256':hashlib.sha256((out/'wall-contact.png').read_bytes()).hexdigest(),'casterNames':caster_names,'savedSceneReopened':True,'snapshotEqual':True,'scope':'Isolated garment/support/source coat hardware finite static contribution; geometry/UV/matrices/hide/packed image/sample/seed/distance reopen snapshot, not all shader settings','nativeVerified':False,'phoneMeasured':False}
(out/'bake-receipt.json').write_text(json.dumps(r,indent=2),encoding='utf-8');print('HAORI_WALL_BAKE',json.dumps(r),flush=True)
