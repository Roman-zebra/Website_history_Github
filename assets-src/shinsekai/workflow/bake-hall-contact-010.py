"""Create an owned normal-hall floor AO study; never overwrite source GLBs."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,array,sys
import bpy
root=Path(__file__).resolve().parents[4]
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if len(args) not in (0,2):raise RuntimeError('Expected optional source-directory output-directory after --')
source=(root/(args[0] if args else 'research-cache/hall-stream-transport-002')).resolve()
out=(root/(args[1] if args else 'research-cache/hall-contact-119-010')).resolve()
if not source.is_relative_to(root/'research-cache') or not out.is_relative_to(root/'research-cache') or source==out:raise RuntimeError('Keep distinct source/output caches inside research-cache')
out.mkdir(parents=True,exist_ok=True)
if (out/'floor-contact.png').exists():raise RuntimeError('Preserve numbered bake; inspect existing output before another run')
inputs=[source/f'cell_hall-{part}-decoded.glb' for part in ['core','desk','lamps','furnishings']]
hashes={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in inputs}
bpy.ops.wm.read_factory_settings(use_empty=True)
for f in inputs:bpy.ops.import_scene.gltf(filepath=str(f))
bpy.context.view_layer.update()
shell=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('hall__shell_finish')]
assert len(shell)==1 and {m.name.split('.')[0] for m in shell[0].data.materials}=={'stone_floor','stone_floor_worn','plaster_ceil'}
floor=[shell[0].matrix_world@shell[0].data.vertices[k].co for poly in shell[0].data.polygons if shell[0].data.materials[poly.material_index].name.split('.')[0] in ['stone_floor','stone_floor_worn'] for k in poly.vertices]
lo=[min(p[k] for p in floor) for k in range(3)];hi=[max(p[k] for p in floor) for k in range(3)]
assert all(abs(v-e)<2e-5 for v,e in zip(lo,[0,0,.003])) and all(abs(v-e)<2e-5 for v,e in zip(hi,[3.55,17.2,.003])),(lo,hi)
# Avoid coincident receiver geometry. The omitted ceiling is4.444m above the
# receiver, outside the.45m AO radius. All nearby walls/supports stay imported.
shell[0].hide_render=True
mesh=bpy.data.meshes.new('contact_floor_receiver');mesh.from_pydata([(0,0,.003),(3.55,0,.003),(3.55,17.2,.003),(0,17.2,.003)],[],[(0,1,2,3)]);mesh.update()
receiver=bpy.data.objects.new('contact_floor_receiver',mesh);bpy.context.scene.collection.objects.link(receiver)
uv=mesh.uv_layers.new(name='contact_planar');coords=[(0,0),(1,0),(1,1),(0,1)]
for loop in mesh.loops:uv.data[loop.index].uv=coords[loop.vertex_index]
mat=bpy.data.materials.new('contact_ao_bake');mat.use_nodes=True;mesh.materials.append(mat);nodes=mat.node_tree.nodes;nodes.clear()
ao=nodes.new('ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value=.45;ao.samples=16;ao.only_local=False;ao.inside=False
emit=nodes.new('ShaderNodeEmission');output=nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(ao.outputs['AO'],emit.inputs['Color']);mat.node_tree.links.new(emit.outputs[0],output.inputs['Surface'])
image=bpy.data.images.new('floor_contact_010',width=512,height=2048,alpha=False,float_buffer=False,is_data=True);image.colorspace_settings.name='Non-Color';image.generated_color=(1,1,1,1)
target=nodes.new('ShaderNodeTexImage');target.image=image;nodes.active=target
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.seed=119010;scene.cycles.use_denoising=False;scene.render.bake.margin=4;scene.render.bake.use_clear=True
bpy.ops.object.select_all(action='DESELECT');receiver.select_set(True);bpy.context.view_layer.objects.active=receiver
bpy.ops.object.bake(type='EMIT')
pixels=array.array('f',[0])*(len(image.pixels));image.pixels.foreach_get(pixels)
values=pixels[::4];assert min(values)<.5 and max(values)>.99 and sum(v<.9 for v in values)>1000
image.filepath_raw=str(out/'floor-contact.png');image.file_format='PNG';image.save();image.pack()
def snapshot():
 def digest(items,field,width,typecode='f'):
  vals=array.array(typecode,[0])*(len(items)*width);items.foreach_get(field,vals);return hashlib.sha256(vals.tobytes()).hexdigest()
 return dict(meshes={m.name:dict(vertices=digest(m.vertices,'co',3),indices=digest(m.loops,'vertex_index',1,'i'),uvs={u.name:digest(u.data,'uv',2) for u in m.uv_layers}) for m in bpy.data.meshes},objects={o.name:dict(matrix=[list(r) for r in o.matrix_world],hide=o.hide_render) for o in bpy.context.scene.objects},imageSize=list(bpy.data.images['floor_contact_010'].size),imagePackedHash=hashlib.sha256(bpy.data.images['floor_contact_010'].packed_file.data).hexdigest(),cyclesSamples=bpy.context.scene.cycles.samples,seed=bpy.context.scene.cycles.seed,aoDistance=bpy.data.materials['contact_ao_bake'].node_tree.nodes.get('Ambient Occlusion').inputs['Distance'].default_value)
before=snapshot();blend=out/'contact-bake.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend));bpy.ops.wm.open_mainfile(filepath=str(blend));after=snapshot();assert before==after
assert hashes=={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in inputs}
receipt=dict(at=datetime.now(timezone.utc).isoformat(),blender=bpy.app.version_string,sourceHashes=hashes,sourceUnchanged=True,floorWorldBounds=[lo,hi],mapSize=[512,2048],mapColourSpace='Non-Color',pngBytes=(out/'floor-contact.png').stat().st_size,pngSha256=hashlib.sha256((out/'floor-contact.png').read_bytes()).hexdigest(),minimum=min(values),maximum=max(values),pixelsBelowPoint9=sum(v<.9 for v in values),aoDistance=.45,aoNodeSamples=16,cyclesSamples=16,seed=119010,receiverOnlyGeometryDerivative=True,sourceBrowserGeometryChanged=False,savedSceneReopened=True,snapshotEqual=True,blendBytes=blend.stat().st_size,phoneMeasured=False,visualAcceptance=False)
receipt['sourceDirectory']=source.relative_to(root).as_posix()
(out/'bake-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print('HALL_CONTACT_BAKE '+json.dumps(receipt),flush=True)
