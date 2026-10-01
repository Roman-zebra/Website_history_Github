"""Texture-only second round on a saved reduced scene; fresh output folder."""
import bpy, hashlib, json, pathlib, sys
source=pathlib.Path(sys.argv[sys.argv.index('--')+1]).resolve()
out=pathlib.Path(sys.argv[sys.argv.index('--')+2]).resolve()
out.mkdir(parents=True,exist_ok=False)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before=sha(source)
bpy.ops.wm.open_mainfile(filepath=str(source))
images=[]
for index,image in enumerate(list(bpy.data.images)):
    if image.type!='IMAGE':continue
    if not len(image.pixels):continue # Force packed images to load after reopening .blend.
    old=list(image.size); factor=min(1,512/max(old))
    image.scale(max(1,round(old[0]*factor)),max(1,round(old[1]*factor)))
    image.filepath_raw=str(out/f'texture-{index}.png')
    image.file_format='PNG'
    image.save()
    resized=bpy.data.images.load(image.filepath_raw,check_existing=False)
    resized.colorspace_settings.name=image.colorspace_settings.name
    for material in bpy.data.materials:
        if material.use_nodes:
            for node in material.node_tree.nodes:
                if node.type=='TEX_IMAGE' and node.image==image:node.image=resized
    images.append({'name':image.name,'before':old,'after':list(image.size)})
file=out/'baluster-mobile.glb'
bpy.ops.export_scene.gltf(filepath=str(file),export_format='GLB',use_selection=True,export_yup=True,export_image_format='AUTO',export_animations=False,export_tangents=True)
assert file.stat().st_size<=1048576,'Mobile per-prop file budget exceeded'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'baluster-mobile.blend'))
assert sha(source)==before
(out/'receipt.json').write_text(json.dumps({'sourceBlendSha256':before,'sourceUnchanged':True,'images':images,'file':file.name,'bytes':file.stat().st_size,'sha256':sha(file),'additionalStudioCredits':0,'productionApproved':False,'iPhone14Measured':False},indent=2)+'\n',encoding='utf-8')
print(file.stat().st_size)
