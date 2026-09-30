"""Original inferred counter/cash drawer study under Claude106.
Hollow assembled furniture, real slider travel/contents, metric detail texture,
slotted screws and rounded grip. No historic make, real money or verified plan.
"""
import bpy, math, json
import numpy as np
from mathutils import Vector

def build(parent,folder):
    meshes=[]
    def root(name,par):
        o=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(o);o.parent=par;return o
    hero=root('Hero counter',parent)
    hero['heroProp']='counter';hero['sourceTags']='A:original inferred joinery/contents; no measured merchant counter or hardware source'
    hero['texelDensityPxM']=2048;hero['detailAtlasDensityPxM']=4096
    def image(name,rgb,non_color=False):
        img=bpy.data.images.new(name,width=rgb.shape[1],height=rgb.shape[0],alpha=False)
        if non_color:img.colorspace_settings.name='Non-Color'
        rgba=np.ones((*rgb.shape[:2],4),np.float32);rgba[:,:,:3]=rgb;img.pixels.foreach_set(rgba.ravel());img.pack();return img
    rng=np.random.default_rng(1912);u,v=np.meshgrid(np.arange(1024)/1024,np.arange(1024)/1024)
    def field(cells):
        lattice=rng.random((cells+1,cells+1));x=u*cells;y=v*cells;ix=x.astype(int);iy=y.astype(int)
        fx=x-ix;fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy)
        return (lattice[iy,ix]*(1-fx)+lattice[iy,ix+1]*fx)*(1-fy)+(lattice[iy+1,ix]*(1-fx)+lattice[iy+1,ix+1]*fx)*fy
    bend=field(8);grain=np.sin(v*182+bend*14+np.sin(u*19)*2)*.018+np.sin(v*487+bend*24)*.006+(field(64)-.5)*.012
    for ku,kv in [(.18,.37),(.78,.82)]:
        radius=np.sqrt(((u-ku)/.055)**2+((v-kv)/.15)**2)
        grain+=np.exp(-radius*radius*.6)*np.sin(radius*15)*.014
    # Original stylised touch smudges and settled dust; no person's fingerprint.
    touch=np.exp(-(((u-.56)/.13)**2+((v-.22)/.07)**2))*np.sin(np.sqrt(((u-.56)*1.6)**2+(v-.22)**2)*530)**2
    dust=field(14)*.007;variation=np.clip(grain*.7+touch*.012+dust,-.035,.035)
    diffuse=image('Original counter wood,0.5m repeat',np.stack([.27+grain,.14+grain*.7,.065+grain*.35],axis=2))
    rough=image('Original varnish micro variation',np.repeat((.27+variation)[:,:,None],3,axis=2),True)
    n=2048;x,y=np.meshgrid(np.arange(n)/n,np.arange(n)/n)
    # Original shallow seam/screw-like normal detail tile; real hero screws below
    # are geometry. This atlas is a material detail, never fake controls or doors.
    hf=.002*np.sin(y*310)+.0004*np.sin(x*137+y*80)
    dy,dx=np.gradient(hf);nz=np.ones_like(hf);norm=np.stack([-dx*24,-dy*24,nz],axis=2);norm/=np.linalg.norm(norm,axis=2)[:,:,None]
    normals=image('Original furniture detail normal,0.5m repeat',norm*.5+.5,True)
    wood=bpy.data.materials.new('Hero varnished timber');wood.use_nodes=True
    tree=wood.node_tree;bs=tree.nodes.get('Principled BSDF');uv=tree.nodes.new('ShaderNodeUVMap');uv.uv_map='UVMap'
    for img,socket in [(diffuse,'Base Color'),(rough,'Roughness')]:
        tex=tree.nodes.new('ShaderNodeTexImage');tex.image=img;tree.links.new(uv.outputs['UV'],tex.inputs['Vector']);tree.links.new(tex.outputs['Color'],bs.inputs[socket])
    tex=tree.nodes.new('ShaderNodeTexImage');tex.image=normals;tree.links.new(uv.outputs['UV'],tex.inputs['Vector'])
    normal=tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.28;tree.links.new(tex.outputs['Color'],normal.inputs['Color']);tree.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
    def material(name,color,roughness,metal=0):
        m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=roughness;b.inputs['Metallic'].default_value=metal;return m
    brass=material('Hero brass with crevice tarnish',(.35,.23,.07),.24,.82)
    dark=material('Hero recessed join seam',(.018,.012,.008),.63)
    paper=material('Hero blank paper contents',(.75,.68,.51),.9)
    def finish(o,name,mat,par,bevel):
        o.name=name;o.parent=par;o.data.materials.append(mat)
        if bevel:
            mod=o.modifiers.new('Material edge radius','BEVEL');mod.width=bevel;mod.segments=3
            mod=o.modifiers.new('Weighted edge highlights','WEIGHTED_NORMAL');mod.keep_sharp=True
            bpy.context.view_layer.objects.active=o
            for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
        for f in o.data.polygons:f.use_smooth=True
        # World-metric box UV0,0.5m original material repeat, including slides.
        uv=o.data.uv_layers.get('UVMap') or o.data.uv_layers.new(name='UVMap')
        for p in o.data.polygons:
            axis=max(range(3),key=lambda i:abs(p.normal[i]))
            for i in p.loop_indices:
                c=o.matrix_world@o.data.vertices[o.data.loops[i].vertex_index].co
                uv.data[i].uv=((c.y,c.z) if axis==0 else (c.x,c.z) if axis==1 else (c.x,c.y));uv.data[i].uv*=2
                phase=sum(map(ord,name))+len(meshes)*17
                uv.data[i].uv.x+=.023*math.sin(uv.data[i].uv.y*2.1+phase)+phase*.137
                uv.data[i].uv.y+=phase*.271
        o['bevelM']=bevel;o['sourceTags']='A:original inferred furniture micro detail';meshes.append(o);return o
    def box(name,a,b,mat=wood,par=hero,bevel=.003):
        a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cube_add(size=1,location=(a+b)/2);o=bpy.context.object;o.scale=b-a
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        if name in ['Counter inset front panel','Counter top,slightly offset']:
            # Small geometric twist on decorative panels only. Runners and
            # contact faces stay straight so slider support is not simulated.
            for vertex in o.data.vertices:
                if name=='Counter inset front panel':vertex.co.y+=.001*(vertex.co.x/max(b.x-a.x,.001))*(vertex.co.z/max(b.z-a.z,.001))*4
                else:vertex.co.z+=.0008*(vertex.co.x/(b.x-a.x))*(vertex.co.y/(b.y-a.y))*4
        return finish(o,name,mat,par,bevel)
    def cylinder(name,position,radius,depth,mat=brass,par=hero,bevel=.0007):
        bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=radius,depth=depth,location=position);return finish(bpy.context.object,name,mat,par,bevel)
    # Frame/panels/trim/feet/hardware are actual separate pieces. Rear stays open
    # around the cash drawer so its runner and contents remain inspectable.
    for x in [1.35,3.46]:
        for y in [2.75,3.21]:box('Counter foot and post',(x,y,0),(x+.09,y+.09,.80))
    box('Counter bottom rail',(1.35,2.75,.08),(3.55,2.81,.16))
    box('Counter left end',(1.35,2.81,.14),(1.372,3.21,.77))
    box('Counter right end',(3.528,2.81,.14),(3.55,3.21,.77))
    for i in range(4):
        x=1.442+i*.502
        box('Counter inset front panel',(x,2.751,.18),(x+.500,2.771,.74),bevel=.003)
        box('Counter panel rail',(x,2.739,.15),(x+.50,2.755,.18),bevel=.002)
    box('Counter top,slightly offset',(1.31,2.70,.80),(3.59,3.34,.845),bevel=.005)
    for x in [1.5,3.4]:
        box('Brass corner plate',(x-.03,2.729,.68),(x+.03,2.733,.74),brass,bevel=.001)
        for z in [.689,.731]:
            screw=cylinder('Slotted plate screw',(x,2.727,z),.003,.002,brass,bevel=.0005);screw.rotation_euler.x=math.pi/2
            box('Visible screw slot',(x-.002,2.7255,z-.00045),(x+.002,2.726,z+.00045),dark,bevel=.0001)
    # Drawer is a real five-sided box on two guides, with bounded straight travel.
    for x in [2.18,2.69]:box('Drawer hardwood guide',(x,2.83,.455),(x+.018,3.28,.475),bevel=.002)
    slider=root('Cash drawer slider',hero)
    slider['gimmick']=json.dumps({'type':'linear drawer','axisBlender':[0,1,0],'travelM':.28,'closed':0,'open':.28,'inferred':True})
    for name,a,b in [
        ('Cash drawer bottom',(2.2,2.89,.476),(2.69,3.24,.491)),
        ('Cash drawer left',(2.2,2.89,.491),(2.215,3.24,.625)),
        ('Cash drawer right',(2.675,2.89,.491),(2.69,3.24,.625)),
        ('Cash drawer back',(2.215,2.89,.491),(2.675,2.905,.625)),
        ('Cash drawer proud front',(2.187,3.242,.463),(2.703,3.265,.640))]:box(name,a,b,par=slider,bevel=.003)
    box('Drawer dark recess,1.5mm seam',(2.1855,3.2405,.4615),(2.7045,3.2418,.6415),dark,par=hero,bevel=.0003)
    for x in [2.31,2.58]:
        plate=box('Drawer handle escutcheon',(x-.022,3.266,.54),(x+.022,3.270,.58),brass,par=slider,bevel=.001)
        grip=cylinder('Rounded drawer grip',(x,3.293,.56),.010,.05,brass,par=slider,bevel=.001);grip.rotation_euler.x=math.pi/2
        for z in [.547,.574]:
            screw=cylinder('Drawer slotted fastener',(x,3.271,z),.002,.0015,brass,par=slider,bevel=.0004);screw.rotation_euler.x=math.pi/2
    box('Drawer compartment divider',(2.43,2.915,.491),(2.438,3.22,.55),par=slider,bevel=.002)
    for i in range(7):cylinder('Blank inferred coin,not historical currency',(2.26+.03*(i%3),3.06+.045*(i//3),.497+.002*(i%2)),.014,.002,brass,par=slider,bevel=.0005)
    for i in range(4):box('Unprinted drawer paper',(2.48+i*.001,2.94+i*.001,.492+i*.001),(2.61+i*.001,3.16+i*.001,.493+i*.001),paper,par=slider,bevel=.0002)
    bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=61
    for frame,y in [(1,0),(31,.28),(61,0)]:slider.location.y=y;slider.keyframe_insert(data_path='location',frame=frame)
    slider['contact']='Original hardwood guides; contents are parented to the moving drawer; arbitrary study timing'
    stair=root('Hero stair storage',parent);stair['heroProp']='stair drawer';stair['sourceTags']='A:original inferred storage cavity in box stair, not an inspectable original plan'
    stair_slider=root('Stair drawer slider',stair)
    stair_slider['gimmick']=json.dumps({'type':'linear drawer','axisBlender':[-1,0,0],'travelM':.24,'closed':0,'open':.24,'inferred':True})
    for name,a,b in [
        ('Stair drawer bottom',(5.12,7.034,.650),(5.515,7.196,.665)),
        ('Stair drawer sideA',(5.12,7.034,.665),(5.515,7.047,.986)),
        ('Stair drawer sideB',(5.12,7.183,.665),(5.515,7.196,.986)),
        ('Stair drawer back',(5.501,7.047,.665),(5.515,7.183,.986)),
        ('Stair drawer proud front',(5.079,7.027,.641),(5.105,7.203,1.001))]:box(name,a,b,par=stair_slider,bevel=.003)
    for y in [7.048,7.180]:box('Stair drawer hardwood guide',(5.12,y,.633),(5.52,y+.008,.650),par=stair,bevel=.002)
    for name,a,b in [
        ('Storage lower reveal',(5.060,7.017,.615),(5.101,7.213,.638)),
        ('Storage upper reveal',(5.060,7.017,1.005),(5.101,7.213,1.028)),
        ('Storage left reveal',(5.060,7.007,.638),(5.101,7.026,1.005)),
        ('Storage right reveal',(5.060,7.204,.638),(5.101,7.223,1.005))]:box(name,a,b,par=stair,bevel=.002)
    box('Stair drawer handle plate',(5.074,7.075,.790),(5.078,7.155,.846),brass,par=stair_slider,bevel=.001)
    knob=cylinder('Raised rounded stair drawer pull',(5.050,7.115,.818),.013,.05,brass,par=stair_slider,bevel=.001);knob.rotation_euler.y=math.pi/2
    for y in [7.086,7.145]:
        screw=cylinder('Stair drawer plate screw',(5.072,y,.818),.002,.002,brass,par=stair_slider,bevel=.0004);screw.rotation_euler.y=math.pi/2
        box('Stair screw visible slot',(5.0705,y-.0015,.8177),(5.071,y+.0015,.8183),dark,par=stair_slider,bevel=.0001)
    for i in range(5):box('Blank folded storage paper',(5.24+i*.001,7.055+i*.001,.666+i*.004),(5.43+i*.001,7.17+i*.001,.669+i*.004),paper,par=stair_slider,bevel=.0004)
    for frame,x in [(1,0),(31,-.24),(61,0)]:stair_slider.location.x=x;stair_slider.keyframe_insert(data_path='location',frame=frame)
    # Three inferred approach treads repair the source's single45.5cm step.
    for i,(y0,y1,top) in enumerate([(4.70,5.00,.15),(5.00,5.35,.30),(5.35,5.70,.455)]):
        o=box('Inferred platform approach step'+str(i+1),(4.05,y0,0),(4.95,y1,top),par=parent,bevel=.005)
        o['sourceTags']='A:walkability repair; no original platform-access plan was supplied'

    # Removable polished plank runners, explicitly inferred rather than a
    # replacement of the source's doma/tatami floor. Keep original contact tests.
    polish=wood.copy();polish.name='Hero polished aisle timber'
    pbs=polish.node_tree.nodes.get('Principled BSDF');original=pbs.inputs['Roughness'].links[0].from_socket
    gain=polish.node_tree.nodes.new('ShaderNodeMath');gain.operation='MULTIPLY';gain.inputs[1].default_value=.89
    polish.node_tree.links.new(original,gain.inputs[0]);polish.node_tree.links.new(gain.outputs[0],pbs.inputs['Roughness'])
    for label,x0,x1,y0,length,boards in [('entry',4.08,4.92,.70,3.97,18),('window',.95,2.40,1.85,.90,6)]:
        for i in range(boards):
            y=y0+length*i/boards
            o=box('Polished inferred '+label+' floor plank'+str(i),(x0,y+.001,0),(x1,y+length/boards-.001,.018),polish,par=parent,bevel=.003)
            o['sourceTags']='A:inferred removable polished wood runner; no original floor finish plan'

    # A third physical window layer: glass at Blender y.225, these thin folded
    # curtains behind it at y.34, and the real room behind. Display bay only;
    # the door and Claude-owned upper-room dressing remain clear.
    cloth=material('Hero translucent display curtains',(.75,.66,.51),.93)
    cbs=cloth.node_tree.nodes.get('Principled BSDF');cbs.inputs['Alpha'].default_value=.56;cbs.inputs['Transmission Weight'].default_value=.16
    cloth.surface_render_method='DITHERED'
    curtains=root('Inferred display window curtain layer',parent);curtains['sourceTags']='A:period-plausible thin cloth behind sourced display-window shape; no historic curtain placement evidence'
    for x0 in [.29,2.45]:
        verts=[];faces=[];nx,nz=20,30
        for j in range(nz+1):
            z=.70+(2.62-.70)*j/nz
            for i in range(nx+1):
                x=x0+.34*i/nx;y=.34+.018*math.sin(i/nx*math.pi*8)+.004*math.sin(j/nz*math.pi*3)
                verts.append((x,y,z))
        for j in range(nz):
            for i in range(nx):
                k=j*(nx+1)+i;faces.append((k,k+1,k+nx+2,k+nx+1))
        mesh=bpy.data.meshes.new('Original folded display cloth');mesh.from_pydata(verts,[],faces);mesh.update()
        o=bpy.data.objects.new('Separate folded display curtain',mesh);bpy.context.scene.collection.objects.link(o);finish(o,o.name,cloth,curtains,0)
    rod=cylinder('Curtain timber pole',(1.55,.34,2.65),.013,2.72,wood,par=curtains,bevel=.001);rod.rotation_euler.y=math.pi/2
    for x in [.19,2.91]:
        box('Curtain bracket plate',(x-.025,.28,2.61),(x+.025,.29,2.68),brass,par=curtains,bevel=.001)
        cylinder('Curtain pole end cap',(x,.34,2.65),.018,.02,brass,par=curtains,bevel=.001).rotation_euler.y=math.pi/2

    lantern=root('Hero paper lantern',parent);lantern['heroProp']='andon';lantern['sourceTags']='A:original period-plausible oil-lamp assembly, not this shop historical fixture'
    lantern['texelDensityPxM']=2048
    lx,ly,lz=3.826,8.459,.457
    def lamp_box(name,a,b,mat=wood,bevel=.002):
        return box(name,Vector(a)+Vector((lx,ly,lz)),Vector(b)+Vector((lx,ly,lz)),mat,par=lantern,bevel=bevel)
    lamp_box('Lamp base joinery',(-.14,-.14,0),(.14,.14,.045),bevel=.004)
    for x in [-.12,.10]:
        for y in [-.12,.10]:lamp_box('Lamp mortised post',(x,y,.045),(x+.02,y+.02,.52))
    lamp_box('Lamp lid rim',(-.14,-.14,.52),(.14,.14,.55),bevel=.004)
    lamp_box('Lamp lid grip',(-.038,-.028,.55),(.038,.028,.575),bevel=.003)
    for z in [.045,.50]:
        for y in [-.12,.10]:lamp_box('Lamp horizontal frame',(-.10,y,z),(.10,y+.018,z+.02))
        for x in [-.12,.10]:lamp_box('Lamp side frame',(x,-.10,z),(x+.018,.10,z+.02))
    lamp_paper=material('Hero translucent fibrous paper',(.68,.55,.35),.9)
    bs=lamp_paper.node_tree.nodes.get('Principled BSDF');bs.inputs['Transmission Weight'].default_value=.42
    bs.inputs['Emission Color'].default_value=(1,.38,.075,1);bs.inputs['Emission Strength'].default_value=.07
    fibers=rng.random((1024,1024))*.06+np.sin(u*1100+v*3)*.005
    fiber_image=image('Original lantern fibers,0.5m repeat',np.repeat((.82+fibers)[:,:,None],3,axis=2))
    tex=lamp_paper.node_tree.nodes.new('ShaderNodeTexImage');tex.image=fiber_image;lamp_paper.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    for a,b in [((-.10,.108,.065),(.10,.109,.50)),((-.108,-.10,.065),(-.107,.10,.50)),((.107,-.10,.065),(.108,.10,.50))]:lamp_box('Lamp separate paper screen',a,b,lamp_paper,bevel=.0002)
    screen=root('Lamp access screen hinge',lantern);screen.location=(lx-.10,ly-.109,lz+.065)
    access=box('Lamp open front screen',(0,0,0),(.20,.001,.435),lamp_paper,par=screen,bevel=.0002);access.location=(.10,.0005,.2175)
    screen.rotation_euler.z=math.radians(-105);screen['gimmick']='A:open access screen rotates about left vertical frame; static review angle105deg'
    oil=cylinder('Lamp oil reservoir',(lx,ly,lz+.085),.045,.06,brass,par=lantern,bevel=.001)
    cylinder('Lamp burner collar',(lx,ly,lz+.126),.018,.022,brass,par=lantern,bevel=.0008)
    box('Lamp visible wick',(lx-.0015,ly-.003,lz+.137),(lx+.0015,ly+.003,lz+.148),dark,par=lantern,bevel=.0003)
    data=bpy.data.lights.new('Assumed lamp interior glow','POINT');data.energy=2;data.color=(1,.43,.13);data.shadow_soft_size=.022
    light=bpy.data.objects.new(data.name,data);bpy.context.scene.collection.objects.link(light);light.parent=lantern;light.location=(lx,ly,lz+.17)

    # A single close-view glazed jar with foot/lip, hollow wall, separate lid,
    # grip and raised fictional band. Other stock remains a needs-work item.
    ceramic=material('Hero glazed teal ceramic',(.03,.21,.16),.10)
    cb=ceramic.node_tree.nodes.get('Principled BSDF');ct=ceramic.node_tree.nodes.new('ShaderNodeTexImage');ct.image=rough
    mult=ceramic.node_tree.nodes.new('ShaderNodeMath');mult.operation='MULTIPLY';mult.inputs[1].default_value=.37
    ceramic.node_tree.links.new(ct.outputs['Color'],mult.inputs[0]);ceramic.node_tree.links.new(mult.outputs[0],cb.inputs['Roughness'])
    cn=ceramic.node_tree.nodes.new('ShaderNodeTexImage');cn.image=normals
    normal=ceramic.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.018
    ceramic.node_tree.links.new(cn.outputs['Color'],normal.inputs['Color']);ceramic.node_tree.links.new(normal.outputs['Normal'],cb.inputs['Normal'])
    jar=root('Hero glazed jar',parent);jar['heroProp']='shelf-goods jar';jar['sourceTags']='A:original generic crockery; exact form/glaze/location invented'
    jar['texelDensityPxM']=2048
    center=Vector((3.37,2.88,.845))
    def lathe(name,profile,mat,par=jar):
        vertices=[];faces=[];segments=48
        for r,z in profile:
            for i in range(segments):
                angle=i*math.tau/segments;vertices.append(center+Vector((r*math.cos(angle),r*math.sin(angle),z)))
        for row in range(len(profile)-1):
            for i in range(segments):faces.append((row*segments+i,row*segments+(i+1)%segments,(row+1)*segments+(i+1)%segments,(row+1)*segments+i))
        faces.extend([tuple(reversed(range(segments))),tuple(range((len(profile)-1)*segments,len(profile)*segments))])
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update();obj=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(obj)
        return finish(obj,name,mat,par,.0006)
    lathe('Jar hollow glazed body',[(.035,0),(.046,.004),(.053,.014),(.082,.05),(.088,.11),(.073,.18),(.047,.216),(.050,.223),(.046,.225),(.043,.215),(.069,.175),(.083,.11),(.077,.05),(.035,.012)],ceramic)
    lathe('Jar foot ring',[(.045,.004),(.048,.006),(.048,.011),(.046,.013)],ceramic)
    lathe('Jar separate lid with rolled rim',[(.050,.226),(.052,.229),(.050,.237),(.040,.241),(.009,.245)],ceramic)
    lathe('Jar rounded grip',[(.007,.244),(.008,.25),(.013,.255),(.012,.26),(.004,.264)],ceramic)
    lathe('Jar raised unprinted band',[(.0875,.096),(.0885,.098),(.0885,.109),(.0875,.111)],paper)
    return {'hero':hero,'slider':slider,'stair':stair,'stairSlider':stair_slider,'lantern':lantern,'jar':jar,'meshes':meshes,'materials':[wood,brass,dark,paper,lamp_paper,ceramic]}
