"""Offline unfiltered height-profile comparison; never TSL/phone approval."""
import bpy,json,sys,hashlib,math
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1]).resolve();runtime_file=root/'interior-cushion-fabric.glb'
assert hashlib.sha256(runtime_file.read_bytes()).hexdigest()=='490706d60adff9ab55ed75efb8f50e6afa70013442d4a720c2c312ba4565b04a'
# Blender4.5.10's custom-attribute merge failed when a SCALAR exists on just
# one primitive (missing-attribute fill has width4). Preserve failed diagnostic;
# use byte-identical source geometry for offline material authoring only.
file=root.parent/'upper-cushion-119-005/interior-cushion-gap022.glb'
assert hashlib.sha256(file.read_bytes()).hexdigest()=='178f76bf655cc30cfdbf532767149e48d90f5bae6c32b2e382107a92ee90c909'
out=root/'renders-cuda-r3';assert not out.exists();out.mkdir()
views={'close':{'position':[4.,4.35,3.95],'target':[3.2,5.215,3.5],'lens':32},'side':{'position':[4.,5.2,3.73],'target':[3.2,5.215,3.5],'lens':28},'context':{'position':[4.8,3.8,4.5],'target':[3.1,5.25,3.65],'lens':28},'far':{'position':[4.8,1.,4.6],'target':[3.1,5.25,3.65],'lens':28}}
lights=[{'position':[3.2,4.5,5.1],'target':[3.2,5.215,3.5],'energy':120,'size':1.5},{'position':[4.3,5.5,4.6],'target':[3.2,5.215,3.5],'energy':40,'size':1.}]
def digest():
    # Actual shader graph values/links, geometry, UV, colour and assignment;
    # check saved authoring scenes, not a fabricated runtime shader conversion.
    result={}
    for o in bpy.context.scene.objects:
        row={'matrix':[list(r) for r in o.matrix_world]}
        if o.type=='MESH':
            row.update(vertices=[list(v.co) for v in o.data.vertices],faces=[(list(f.vertices),f.material_index) for f in o.data.polygons],uv=[[list(p.uv) for p in a.data] for a in o.data.uv_layers],colours={a.name:[list(v.color) for v in a.data] for a in o.data.color_attributes},materials=[m.name for m in o.data.materials])
        result[o.name]=row
    shaders={}
    used={m for o in bpy.context.scene.objects if o.type=='MESH' for m in o.data.materials}
    for m in used:
        if not m.use_nodes:continue
        shaders[m.name]={'nodes':[(n.name,n.bl_idname,getattr(n,'operation',None),[(i.name,str(i.default_value)) for i in n.inputs if hasattr(i,'default_value')]) for n in m.node_tree.nodes],'links':[(l.from_node.name,l.from_socket.identifier,l.to_node.name,l.to_socket.identifier) for l in m.node_tree.links]}
    return {'objects':result,'shaders':shaders}
files=[];authoring=[]
for label,gain in [('source',0),('gain05',.5),('gain1',1)]:
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(file));bpy.context.view_layer.update()
    body=bpy.data.objects['Hybrid_Sonnet_upper'];selected=[]
    for f in body.data.polygons:
        ps=[body.matrix_world@body.data.vertices[i].co for i in f.vertices]
        if body.data.materials[f.material_index].name=='CLOTH' and all(2.79<p.x<3.61 and 4.8<p.y<5.63 and 3.45<p.z<3.54 for p in ps):selected.append(f)
    assert len(selected)==240
    source=body.data.materials[selected[0].material_index];original_colour=list(source.diffuse_color);original_roughness=source.roughness
    if gain:
        mat=source.copy();mat.name='Offline cushion weave '+label;nodes=mat.node_tree.nodes;links=mat.node_tree.links
        bsdf=next(n for n in nodes if n.type=='BSDF_PRINCIPLED');assert not bsdf.inputs['Normal'].is_linked
        def math_node(op,a,b=None):
            n=nodes.new('ShaderNodeMath');n.operation=op
            for k,v in enumerate((a,b)):
                if v is None:continue
                if isinstance(v,(float,int)):n.inputs[k].default_value=v
                else:links.new(v,n.inputs[k])
            return n.outputs[0]
        tc=nodes.new('ShaderNodeTexCoord');sub=nodes.new('ShaderNodeVectorMath');sub.operation='SUBTRACT';sub.inputs[1].default_value=(3.2,5.215,0);links.new(tc.outputs['Object'],sub.inputs[0])
        waves=[]
        for axis,pitch in [((math.cos(.4),math.sin(.4),0),.002),((-math.sin(.4),math.cos(.4),0),.0026)]:
            dot=nodes.new('ShaderNodeVectorMath');dot.operation='DOT_PRODUCT';dot.inputs[1].default_value=axis;links.new(sub.outputs['Vector'],dot.inputs[0]);waves.append(math_node('SINE',math_node('MULTIPLY',dot.outputs['Value'],2*math.pi/pitch)))
        height=math_node('MULTIPLY',math_node('ADD',*waves),.00016*gain/2)
        bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=1.;bump.inputs['Distance'].default_value=1.;links.new(height,bump.inputs['Height']);links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
        slot=len(body.data.materials);body.data.materials.append(mat)
        for f in selected:f.material_index=slot
        assert list(mat.diffuse_color)==original_colour and mat.roughness==original_roughness
        assert sum(f.material_index==slot for f in body.data.polygons)==240
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='GPU';scene.cycles.samples=32;scene.cycles.seed=119004;scene.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='CUDA';prefs.get_devices();assert any(d.type=='CUDA' for d in prefs.devices)
    for d in prefs.devices:d.use=d.type=='CUDA'
    scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';scene.view_settings.exposure=0
    world=bpy.data.worlds.new('Fixed diagnostic world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.7,.75,.8,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.08;scene.world=world
    for ob in scene.objects:
        if ob.type=='LIGHT':ob.hide_render=True
    for i,spec in enumerate(lights):
        data=bpy.data.lights.new('Diagnostic area'+str(i),'AREA');data.energy=spec['energy'];data.shape='DISK';data.size=spec['size'];ob=bpy.data.objects.new(data.name,data);scene.collection.objects.link(ob);ob.location=spec['position'];ob.rotation_euler=(Vector(spec['target'])-ob.location).to_track_quat('-Z','Y').to_euler()
    camera=bpy.data.objects.new('Fixed diagnostic camera',bpy.data.cameras.new('Fixed diagnostic camera'));scene.collection.objects.link(camera);scene.camera=camera
    bpy.context.view_layer.update();before=digest();blend=out/(label+'.blend');assert not blend.exists();bpy.ops.wm.save_as_mainfile(filepath=str(blend));bpy.ops.wm.open_mainfile(filepath=str(blend));bpy.context.view_layer.update();after=digest()
    if before!=after:
        (out/(label+'-reopen-mismatch.json')).write_text(json.dumps({'before':before,'after':after}),encoding='utf-8')
    assert before==after
    authoring.append({'label':label,'gain':gain,'selectedFaces':240,'saveReopenEqual':True,'scope':'geometry/UV/colour/material assignment/matrices/shader nodes, inputs and links','blend':blend.name})
    scene=bpy.context.scene;camera=scene.camera
    for name,spec in views.items():
        camera.data.lens=spec['lens'];camera.location=spec['position'];camera.rotation_euler=(Vector(spec['target'])-camera.location).to_track_quat('-Z','Y').to_euler()
        image=out/(label+'-'+name+'.png');assert not image.exists();scene.render.filepath=str(image);bpy.ops.render.render(write_still=True)
        files.append({'file':image.name,'gain':gain,'PNG_SHA256':hashlib.sha256(image.read_bytes()).hexdigest()});print('FABRIC_FRAME',image.name,flush=True)
r={'blender':bpy.app.version_string,'sourceSHA256':hashlib.sha256(file.read_bytes()).hexdigest(),'maskedRuntimeSHA256':hashlib.sha256(runtime_file.read_bytes()).hexdigest(),'offlineInput':'005gap022: geometry/UV/colour/materials byte-identical to masked006; failed masked import retained in render.log, not claimed as Blender-qualified','engine':'Cycles CUDA','samples':32,'seed':119004,'denoise':True,'resolution':[1280,720],'viewTransform':'AgX','exposure':0,'worldStrength':.08,'lights':lights,'views':views,'authoring':authoring,'files':files,'sourceUnchanged':hashlib.sha256(file.read_bytes()).hexdigest()=='178f76bf655cc30cfdbf532767149e48d90f5bae6c32b2e382107a92ee90c909','limitations':'Offline sine height/Bump comparison only. Blender does not reproduce TSL fwidth fade; far images are not proof of runtime alias filtering. Offline diagnostic lights differ from browser. No native/performance/phone or historical acceptance.','nativeVerified':False,'phoneMeasured':False}
(out/'render-receipt.json').write_text(json.dumps(r,indent=2),encoding='utf-8');print('FABRIC_RECEIPT',len(files),flush=True)
