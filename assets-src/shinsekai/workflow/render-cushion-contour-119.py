"""Matched offline diagnostic renders; no claim of browser light equivalence."""
import bpy,json,sys,hashlib
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];root=Path(args[0]).resolve();device=args[1] if len(args)>1 else 'CPU'
assert device in ('CPU','CUDA');out=root/('renders' if device=='CPU' else 'renders-cuda')
mode=args[2] if len(args)>2 else None
assert mode in (None,'top','perimeter')
top_only=mode=='top'
if top_only:out=root/('top-corrected-'+device.lower())
assert not out.exists();out.mkdir()
inputs={'source':root.parent/'cabinet-ink-119-001/interior-cabinet.glb','g035':root/'interior-cushion-g035.glb','g065':root/'interior-cushion-g065.glb'}
if mode=='perimeter':inputs={'gap022':root/'interior-cushion-gap022.glb','gap040':root/'interior-cushion-gap040.glb'}
views={'close':{'position':[4.0,4.35,3.95],'target':[3.2,5.215,3.50],'lens':32},'side':{'position':[4.0,5.2,3.73],'target':[3.2,5.215,3.50],'lens':28},'top':{'position':[3.2,5.215,4.5],'target':[3.2,5.215,3.50],'ortho':1.48},'context':{'position':[4.8,3.8,4.5],'target':[3.1,5.25,3.65],'lens':28}}
if top_only:views={'top':views['top']}
lights=[{'position':[3.2,4.5,5.1],'target':[3.2,5.215,3.5],'energy':120,'size':1.5},{'position':[4.3,5.5,4.6],'target':[3.2,5.215,3.5],'energy':40,'size':1.0}]
files=[]
for label,file in inputs.items():
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(file));bpy.context.view_layer.update()
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU' if device=='CPU' else 'GPU';scene.cycles.samples=32;scene.cycles.seed=119004;scene.cycles.use_denoising=True
    if device=='CUDA':
        prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='CUDA';prefs.get_devices()
        assert any(d.type=='CUDA' for d in prefs.devices),'No CUDA device'
        for d in prefs.devices:d.use=d.type=='CUDA'
    scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';scene.view_settings.exposure=0
    world=bpy.data.worlds.new('Fixed diagnostic world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.7,.75,.8,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.08;scene.world=world
    for ob in scene.objects:
        if ob.type=='LIGHT':ob.hide_render=True
    for n,spec in enumerate(lights):
        data=bpy.data.lights.new('Diagnostic area'+str(n),'AREA');data.energy=spec['energy'];data.shape='DISK';data.size=spec['size'];ob=bpy.data.objects.new(data.name,data);scene.collection.objects.link(ob);ob.location=spec['position'];ob.rotation_euler=(Vector(spec['target'])-ob.location).to_track_quat('-Z','Y').to_euler()
    camera=bpy.data.objects.new('Fixed diagnostic camera',bpy.data.cameras.new('Fixed diagnostic camera'));scene.collection.objects.link(camera);scene.camera=camera
    # Top silhouette isolates just the existing cushion faces to avoid ceiling/table occlusion;
    # original mesh/material/UV copied unchanged, no remeshing or new surface shader.
    body=bpy.data.objects['Hybrid_Sonnet_upper'];subset=body.copy();subset.data=body.data.copy();scene.collection.objects.link(subset)
    import bmesh
    bm=bmesh.new();bm.from_mesh(subset.data);remove=[]
    for face in bm.faces:
        ps=[subset.matrix_world@v.co for v in face.verts]
        if subset.data.materials[face.material_index].name!='CLOTH' or not all(2.79<p.x<3.61 and 4.8<p.y<5.63 and 3.45<p.z<3.54 for p in ps):remove.append(face)
    bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(subset.data);bm.free();subset.hide_render=True
    for name,spec in views.items():
        states={o.name:o.hide_render for o in scene.objects}
        if name=='top':
            for ob in scene.objects:
                if ob.type=='MESH':ob.hide_render=ob!=subset
        camera.data.type='ORTHO' if 'ortho' in spec else 'PERSP';camera.data.ortho_scale=spec.get('ortho',.82);camera.data.lens=spec.get('lens',32)
        camera.location=spec['position'];camera.rotation_euler=(Vector(spec['target'])-camera.location).to_track_quat('-Z','Y').to_euler()
        image=out/(label+'-'+name+'.png');assert not image.exists();scene.render.filepath=str(image);bpy.ops.render.render(write_still=True)
        files.append({'file':image.name,'sourceSHA256':hashlib.sha256(file.read_bytes()).hexdigest(),'PNG_SHA256':hashlib.sha256(image.read_bytes()).hexdigest()})
        for ob in scene.objects:ob.hide_render=states[ob.name]
r={'blender':bpy.app.version_string,'engine':'Cycles '+device,'samples':32,'seed':119004,'denoise':True,'viewTransform':'AgX','exposure':0,'resolution':[1280,720],'lights':lights,'worldStrength':.08,'sourceLightRendering':'disabled for all variants in offline diagnostic only','views':views,'topScope':'Isolated existing cushion faces with source materials; close/side/context retain entire room','files':files,'nativeVerified':False,'phoneMeasured':False}
(out/'render-receipt.json').write_text(json.dumps(r,indent=2),encoding='utf-8');print('MATCHED_RENDER_RECEIPT',len(files),flush=True)
