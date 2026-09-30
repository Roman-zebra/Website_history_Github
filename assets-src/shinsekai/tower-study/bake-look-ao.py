"""Bake an original AO atlas per mesh, preserving v4 metric UVs and geometry.

Run with Blender4.5 --background --python-exit-code1 --python this file.
Occlusion distance/strength are art assumptions. No downloaded scene is executed.
"""
import bpy, json, math, hashlib, struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
SOURCE=Path(__file__).with_name('tower-study-v4-look-uv.glb')
OUT=Path(__file__).with_name('tower-study-v4-look-ao.glb')
TARGET=ROOT/'assets-src/shinsekai/browser-study/materials/ao'
TARGET.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
blob=SOURCE.read_bytes();length=struct.unpack_from('<I',blob,12)[0];original=json.loads(blob[20:20+length])
for key,value in original['scenes'][0].get('extras',{}).items():bpy.context.scene[key]=value
bpy.context.scene.render.engine='CYCLES'
bpy.context.scene.cycles.samples=32
bpy.context.scene.cycles.device='CPU'
bpy.context.scene.render.bake.margin=8
bpy.context.scene.render.bake.use_clear=True
manifest=[]
for obj in list(bpy.context.scene.objects):
    if obj.type!='MESH':continue
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    mesh=obj.data
    metric=mesh.uv_layers[0]
    atlas=mesh.uv_layers.new(name='baked-occlusion')
    mesh.uv_layers.active_index=1;atlas.active_render=True
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.025,scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    size=1024 if 'masonry' in obj.name else 512
    if obj.name in ['elevator_car','roof_garden_deck','open_gallery_floor']:size=256
    image=bpy.data.images.new('AO / '+obj.name,width=size,height=size,alpha=False,float_buffer=True)
    image.colorspace_settings.name='Non-Color'
    slots=list(mesh.materials)
    material=bpy.data.materials.new('temporary AO bake');material.use_nodes=True
    nodes=material.node_tree.nodes;nodes.clear()
    ao=nodes.new('ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value=1.5
    emit=nodes.new('ShaderNodeEmission');output=nodes.new('ShaderNodeOutputMaterial')
    material.node_tree.links.new(ao.outputs['Color'],emit.inputs['Color'])
    material.node_tree.links.new(emit.outputs[0],output.inputs['Surface'])
    target=nodes.new('ShaderNodeTexImage');target.image=image;nodes.active=target
    for i in range(len(mesh.materials)):mesh.materials[i]=material
    print('Baking '+obj.name+' '+str(size),flush=True)
    bpy.ops.object.bake(type='EMIT')
    filename='ao-'+str(len(manifest))+'.png';image.file_format='PNG';image.filepath_raw=str(TARGET/filename);image.save()
    for i,slot in enumerate(slots):mesh.materials[i]=slot
    mesh.uv_layers.active_index=0;metric.active_render=True
    manifest.append({'node':obj.name,'file':filename,'sizePx':[size,size],'uvChannel':1,
                     'sha256':hashlib.sha256((TARGET/filename).read_bytes()).hexdigest(),
                     'license':'original project bake; source geometry rights ledger applies',
                     'assumption':'Cycles ambient occlusion distance1.5m,32 samples; no historic lighting measurement'})
    bpy.data.materials.remove(material);bpy.data.images.remove(image)
bpy.context.scene['lookAo']=json.dumps({'version':'v4-look-r3','channel':1,'method':'Cycles AO shader baked as emission; distance1.5m; no lightmap','source':'project geometry','status':'art assumption'})
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_extras=True)
(TARGET/'PROVENANCE.json').write_text(json.dumps({'sourceGlbSha256':hashlib.sha256(blob).hexdigest(),'maps':manifest},indent=2),encoding='utf8')
print('Baked '+str(len(manifest))+' original AO atlases',flush=True)
