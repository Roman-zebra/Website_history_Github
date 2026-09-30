"""Author metric box UVs on a separate v4 copy; prepare selected CC0 texture variants.
No vertex, landing, height or historical placement change. Run with Blender's Python.
"""
import bpy, json, struct, hashlib
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
CACHE=ROOT.parent/'research-cache'/'materials-93'
SOURCE=ROOT/'assets-src/shinsekai/tower-study/tower-study-v4-open-gallery.glb'
OUT=ROOT/'assets-src/shinsekai/tower-study/tower-study-v4-look-uv.glb'
TEXTURES=ROOT/'assets-src/shinsekai/browser-study/materials'
TEXTURES.mkdir(parents=True,exist_ok=True)
receipt=json.loads((CACHE/'download-receipt.json').read_text(encoding='utf8'))
if receipt['failures'] or len(receipt['files'])!=9:
    raise RuntimeError('Claude95 material download verification incomplete')
manifest=[]
for item in receipt['files']:
    original=CACHE/item['file']
    if hashlib.sha256(original.read_bytes()).hexdigest()!=item['sha256']:
        raise RuntimeError('Source asset hash changed: '+item['file'])
    if item['file'].endswith('.jpg'):
        paths=[original]
    else:
        import zipfile
        scratch=CACHE/item['asset']
        scratch.mkdir(exist_ok=True)
        paths=[]
        with zipfile.ZipFile(original) as archive:
            for channel in ['Color','NormalGL','Roughness']:
                name=item['asset']+'_2K-JPG_'+channel+'.jpg'
                if name not in archive.namelist():
                    raise RuntimeError('Expected map absent: '+name)
                target=scratch/name
                target.write_bytes(archive.read(name))
                paths.append(target)
    for image_path in paths:
        image=bpy.data.images.load(str(image_path),check_existing=False)
        channel=item.get('channel') or image_path.stem.split('_')[-1]
        color_map=channel in ['diff','Color']
        image.colorspace_settings.name='sRGB' if color_map else 'Non-Color'
        size=2048 if item['asset']=='large_sandstone_blocks' else 1024
        if tuple(image.size)!=(size,size): image.scale(size,size)
        name=image_path.stem.replace('_2K-JPG_','_').replace('_2k','')+f'_{size}.jpg'
        output=TEXTURES/name
        image.file_format='JPEG';image.filepath_raw=str(output);image.save()
        manifest.append({'file':name,'asset':item['asset'],'channel':channel,'sizePx':[size,size],
                         'colorSpace':'sRGB' if color_map else 'linear data','source':item['url'],
                         'sourceSha256':item['sha256'],'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
                         'license':item['license'],'licenseUrl':item['licenseUrl'],
                         'use':'Claude95 art-direction choice; not a measured 1912 material'})
        bpy.data.images.remove(image)

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
blob=SOURCE.read_bytes();length=struct.unpack_from('<I',blob,12)[0];source=json.loads(blob[20:20+length])
for key,value in source['scenes'][source.get('scene',0)].get('extras',{}).items():bpy.context.scene[key]=value
for obj in bpy.context.scene.objects:
    if obj.type!='MESH':continue
    mesh=obj.data
    layer=mesh.uv_layers[0] if mesh.uv_layers else mesh.uv_layers.new(name='world-metric')
    mesh.uv_layers.active_index=0;layer.active_render=True
    material_names=' '.join(m.name for m in mesh.materials if m)
    scale=3.0 if 'masonry' in material_names else 1.0
    matrix=obj.matrix_world;normal_matrix=matrix.to_3x3().inverted().transposed()
    for face in mesh.polygons:
        normal=(normal_matrix@face.normal).normalized();axis=max(range(3),key=lambda i:abs(normal[i]))
        for loop_index in face.loop_indices:
            point=matrix@mesh.vertices[mesh.loops[loop_index].vertex_index].co
            if axis==0:u,v=(-point.y if normal.x>0 else point.y),point.z
            elif axis==1:u,v=(point.x if normal.y>0 else -point.x),point.z
            else:u,v=point.x,(point.y if normal.z>0 else -point.y)
            layer.data[loop_index].uv=(u/scale,v/scale)
bpy.context.scene['lookUv']=json.dumps({'version':'v4-look-r2','method':'metric box projection; facade3m, other1m','geometry':'v4 unchanged','lightmap':'not baked yet'})
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_extras=True)
(TEXTURES/'PROVENANCE.json').write_text(json.dumps({'sourceHandoff':95,'derivation':'Blender resample/JPEG; facade2K, other1K; original hashes retained','textures':manifest},indent=2),encoding='utf8')
print('Authored look UV copy and '+str(len(manifest))+' texture variants')
