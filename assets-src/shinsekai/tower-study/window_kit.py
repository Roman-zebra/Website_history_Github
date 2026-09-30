"""Original Blender facade kit, Claude97/98; dimensions/layout are assumptions.

Canonical face is Blender+Y, inward-Y, uprightZ. Shared mesh datablocks let the
runtime instance matching parts. No historic lettering, people or brand assets.
"""
import bpy, math, json

_meshes={}
_materials={}

def material(name,color,roughness=.8,metallic=0,alpha=1):
    if name in _materials:return _materials[name]
    mat=bpy.data.materials.new(name);mat.diffuse_color=(*color,alpha);mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*color,alpha)
    bsdf.inputs['Roughness'].default_value=roughness;bsdf.inputs['Metallic'].default_value=metallic
    if alpha<1:
        bsdf.inputs['Alpha'].default_value=alpha;mat.surface_render_method='DITHERED'
    _materials[name]=mat;return mat

def box(root,name,location,size,mat,bevel=0):
    key=(tuple(size),mat.name,bevel)
    if key not in _meshes:
        bpy.ops.mesh.primitive_cube_add(size=1)
        prototype=bpy.context.object;prototype.dimensions=size
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        prototype.data.materials.append(mat)
        if bevel:
            modifier=prototype.modifiers.new('small authored edge bevel','BEVEL');modifier.width=bevel;modifier.segments=1
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        data=prototype.data;_meshes[key]=data;bpy.data.objects.remove(prototype,do_unlink=True)
    obj=bpy.data.objects.new(name,_meshes[key]);bpy.context.collection.objects.link(obj)
    obj.parent=root;obj.location=location;obj['windowKit']=True;return obj

def panel(root,name,location,size,mat):
    # Author upright geometry explicitly so glTF local position is browserXY.
    key=('panel',tuple(size),mat.name)
    if key not in _meshes:
        w,h=size;mesh=bpy.data.meshes.new(name)
        mesh.from_pydata([(-w/2,0,-h/2),(w/2,0,-h/2),(w/2,0,h/2),(-w/2,0,h/2)],[],[(3,2,1,0)])
        mesh.materials.append(mat);layer=mesh.uv_layers.new(name='pane')
        for loop_index,coordinate in zip(mesh.polygons[0].loop_indices,[(0,1),(1,1),(1,0),(0,0)]):layer.data[loop_index].uv=coordinate
        _meshes[key]=mesh
    obj=bpy.data.objects.new(name,_meshes[key]);bpy.context.collection.objects.link(obj)
    obj.parent=root;obj.location=location;obj['windowKit']=True;return obj

def window(name='window',lod=0,width=1.1,height=2.2,door=False):
    if lod not in (0,1,2):raise ValueError('Invalid window LOD')
    root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root)
    root['windowKit']=True
    root['windowStudy']=json.dumps({'schemaVersion':1,'lod':lod,'revealM':.30,'frameFaceM':-.08,
        'glassPlaneM':-.12,'glassBehindFrameM':.04,'widthM':width,'heightM':height,
        'roomWidthM':3.4,'roomHeightM':2.8,'roomDepthM':2.8,'roomFloorM':-1.25,
        'source':'Claude97 detail standard; Claude98 typology references',
        'status':'dimensions/pane pattern/room plan assumed; original bay positions retained',
        'kind':'door kit' if door else 'window kit'})
    frame=material('assumed painted window frame',(.28,.25,.20),.72)
    stone=material('provisional trim / window sill',(.52,.49,.42))
    glass=material('separate period glass study',(.35,.46,.49),.14,.08,.22)
    interior=material('window interior mapping',(.15,.12,.09),1)
    reveal=material('provisional pale masonry / reveal',(.52,.49,.42))
    t=.065;innerW=width-2*t;innerH=height-2*t
    # Three genuine depth layers: wall/reveal, recessed sash, projecting sill.
    for x in (-width/2,width/2):box(root,'reveal jamb',(x,-.15,0),(.04,.30,height),reveal)
    for z in (-height/2,height/2):box(root,'reveal head or foot',(0,-.15,z),(width,.30,.04),reveal)
    for x in (-(width-t)/2,(width-t)/2):box(root,'sash upright',(x,-.12,0),(t,.08,height),frame,.006 if lod==0 else 0)
    for z in (-(height-t)/2,(height-t)/2):box(root,'sash rail',(0,-.12,z),(width-t,.08,t),frame,.006 if lod==0 else 0)
    if lod<2:
        rows=3 if not door else 2
        if lod==0:
            box(root,'vertical muntin',(0,-.10,0),(.025,.04,innerH),frame,.003)
            for i in range(1,rows):box(root,'horizontal muntin',(0,-.10,-innerH/2+innerH*i/rows),(innerW,.04,.025),frame,.003)
            for col in (-1,1):
                for row in range(rows):panel(root,'separate glass pane',(col*innerW/4,-.12,-innerH/2+innerH*(row+.5)/rows),(innerW/2-.025,innerH/rows-.025),glass)
        else:
            panel(root,'muntin card vertical',(0,-.095,0),(.025,innerH),frame)
            for i in range(1,rows):panel(root,'muntin card horizontal',(0,-.095,-innerH/2+innerH*i/rows),(innerW,.025),frame)
            panel(root,'separate glass layer',(0,-.12,0),(innerW,innerH),glass)
    else:panel(root,'separate glass far layer',(0,-.12,0),(innerW,innerH),glass)
    if lod<2:
        box(root,'projecting sill',(0,.07,-height/2-.05),(width+.18,.36,.10),stone,.01 if lod==0 else 0)
        box(root,'sill drip edge',(0,.23,-height/2-.075),(width+.12,.035,.035),stone)
        box(root,'lintel',(0,.025,height/2+.08),(width+.18,.16,.13),stone,.008 if lod==0 else 0)
    panel(root,'interior mapping back',(0,-.285,0),(innerW,innerH),interior)
    return root

def carve_opening(targets,x,face,faceY,level,width=1.1,height=2.2,room=True):
    # Apply each cut to the separate manifold source blocks before material join.
    cutters=[((x,face*(faceY-.125),level),(width,.35,height))]
    if room:cutters.append(((x,face*(faceY-1.70),level+.15),(3.4,2.8,2.8)))
    for location,size in cutters:
        bpy.ops.mesh.primitive_cube_add(size=1,location=location);cutter=bpy.context.object;cutter.dimensions=size
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        for obj in targets:
            bpy.context.view_layer.objects.active=obj
            modifier=obj.modifiers.new('assumed recessed opening / room','BOOLEAN');modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=cutter
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.data.objects.remove(cutter,do_unlink=True)

def place_tower_window(x,face,faceY,level,index,lod=0):
    print('Authoring recessed tower window '+str(index)+' LOD'+str(lod),flush=True)
    targets=[o for o in bpy.context.scene.objects if o.type=='MESH' and
             (o.name.startswith('base side mass') or o.name.startswith('flanking turret')) and abs(o.location.x-x)<.1]
    carve_opening(targets,x,face,faceY,level)
    root=window('tower-window-'+str(index),lod);root.location=(x,face*faceY,level);root.rotation_euler.z=0 if face==1 else math.pi
    root['featureId']='first-tower';root['cellId']='tower-window-'+str(index)
    return root
