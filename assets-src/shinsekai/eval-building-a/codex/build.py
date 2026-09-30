"""Blind Building A, original Codex authoring; Blender 4.5, metres.

blender -b --python-exit-code 1 --python build.py -- [--no-render] [--no-ao]
Only shared Claude100 inputs were read. No competing checkout is imported.
"""
import bpy, math, json, sys, hashlib, random
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
OUT=Path(__file__).resolve().parent
OUT.mkdir(parents=True,exist_ok=True)
random.seed(1912)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=1
MATS={};PARTS=[];CURRENT=None;ZONE='shell'

def texture(name,kind,size=512):
    """Original periodic, deterministic surface study; no borrowed pixels."""
    image=bpy.data.images.new(name,width=size,height=size,alpha=False)
    pixels=[];rng=random.Random(1912+sum(map(ord,name)))
    palettes={'plaster':(.66,.59,.46),'wood':(.23,.115,.048),'stone':(.28,.25,.21),
              'tile':(.105,.13,.14),'tatami':(.45,.46,.255),'paper':(.87,.76,.51),'cloth':(.25,.32,.34)}
    base=palettes[kind]
    for y in range(size):
        for x in range(size):
            u=x/size;v=y/size;n=rng.random()-.5
            if kind=='wood':
                f=.88+.12*math.sin(u*math.tau*17+math.sin(v*math.tau*3)*.7)+n*.08
                f*=.76 if x%128<3 else 1
            elif kind=='tatami':f=.89+.09*math.sin(v*math.tau*128)+.035*math.sin(u*math.tau*48)+n*.08
            elif kind=='cloth':f=.88+.07*math.sin(u*math.tau*128)+.04*math.sin(v*math.tau*128)+n*.08
            elif kind=='paper':f=.96+n*.07
            else:f=.91+n*.09+.04*math.sin(u*math.tau*7)*math.sin(v*math.tau*5)
            pixels.extend([max(0,min(1,c*f)) for c in base]+[1])
    image.pixels=pixels;image.filepath_raw=str(OUT/'textures'/f'{name}.png');image.file_format='PNG'
    (OUT/'textures').mkdir(exist_ok=True);image.save();return image

def mat(name,color,kind=None,rough=.8,metal=0,alpha=1,emission=None):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,alpha)
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,alpha)
    b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal;b.inputs['Alpha'].default_value=alpha
    if alpha<1:m.surface_render_method='DITHERED'
    if kind:
        t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=texture(name,kind)
        m.node_tree.links.new(t.outputs['Color'],b.inputs['Base Color'])
    if emission:
        b.inputs['Emission Color'].default_value=(*emission,1);b.inputs['Emission Strength'].default_value=2
    MATS[name]=m;return m

plaster=mat('warm lime plaster',(.66,.59,.46),'plaster',.91)
wood=mat('oiled dark timber',(.23,.115,.048),'wood',.72)
stone=mat('damp plinth',(.28,.25,.21),'stone',.95)
tile=mat('blue grey fired roof',(.105,.13,.14),'tile',.58)
tatami=mat('woven rush',(.45,.46,.255),'tatami',.95)
paper=mat('unprinted washi',(.87,.76,.51),'paper',.8,emission=(.4,.22,.075))
cloth=mat('blue green canvas',(.25,.32,.34),'cloth',.94)
brass=mat('aged brass',(.37,.24,.08),rough=.38,metal=.7)
iron=mat('painted iron',(.07,.08,.09),rough=.6,metal=.55)
ceramic=mat('cream ceramic',(.57,.49,.34),rough=.26)
red=mat('ochre sign paint',(.37,.16,.08),rough=.77)
edge=mat('tatami border',(.12,.16,.12),rough=.9)
soot=mat('dry soot and splash',(.22,.205,.17),rough=.97)
glass=mat('wavy cylinder glass',(.50,.61,.59),rough=.17,metal=.06,alpha=.19)
# Geometric waviness survives glTF; no unsupported Blender-only normal shader.

def empty(name,parent=None,**extras):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent
    for k,v in extras.items():o[k]=json.dumps(v) if isinstance(v,(dict,list)) else v
    return o

def finish(o,name,material,bevel=0):
    o.name=name;o.parent=CURRENT;o['zone']=ZONE;o.data.materials.append(material)
    if bevel:
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        mod=o.modifiers.new('authored edge bevel','BEVEL');mod.width=bevel;mod.segments=1
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    PARTS.append(o);return o

def box(name,loc,size,material,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size
    return finish(o,name,material,bevel)

def mesh(name,verts,faces,material):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);return finish(o,name,material)

def cylinder(name,loc,radius,depth,material,vertices=12,rotation=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    o=finish(bpy.context.object,name,material)
    if rotation:o.rotation_euler=rotation
    return o

def beam(name,a,b,radius,material,vertices=8):
    a,b=Vector(a),Vector(b);o=cylinder(name,(a+b)/2,radius,(b-a).length,material,vertices)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o

def ball(name,loc,radius,material):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=radius,location=loc)
    return finish(bpy.context.object,name,material)

def wall_span(x0,x1,z0,z1,y=.125):
    if x1-x0>.005 and z1-z0>.005:box('front plaster section',((x0+x1)/2,y,(z0+z1)/2),(x1-x0,.25,z1-z0),plaster,.008)

def front_wall(z0,z1,openings):
    # Tile the wall around true apertures; no coincident wall behind the glass.
    edges=sorted(set([-3,3]+[e for x,w,zc,h in openings for e in [x-w/2,x+w/2]]))
    for a,b in zip(edges,edges[1:]):
        opening=next((q for q in openings if q[0]-q[1]/2 <= (a+b)/2 <= q[0]+q[1]/2),None)
        if opening:
            x,w,z,h=opening;wall_span(a,b,z0,z-h/2);wall_span(a,b,z+h/2,z1)
        else:wall_span(a,b,z0,z1)

def pane(name,x,z,w,h,y,lod):
    if lod:
        return mesh(name,[(x-w/2,y,z-h/2),(x+w/2,y,z-h/2),(x+w/2,y,z+h/2),(x-w/2,y,z+h/2)],[(0,1,2,3)],glass)
    nx,nz=3,4;verts=[]
    for j in range(nz+1):
        for i in range(nx+1):
            X=x-w/2+w*i/nx;Z=z-h/2+h*j/nz
            dy=.0015*math.sin(i*2.4+j*1.8+x)
            verts.append((X,y+dy,Z))
    faces=[]
    for j in range(nz):
        for i in range(nx):
            k=j*(nx+1)+i;faces.append((k,k+1,k+nx+2,k+nx+1))
    return mesh(name,verts,faces,glass)

def window(x,z,w,h,lod):
    t=.07
    # Wall front y0, inside+y; reveal22cm, frame face14cm, glass18cm.
    for X in [x-w/2,x+w/2]:box('window reveal jamb',(X,.11,z),(.035,.22,h),plaster)
    for Z in [z-h/2,z+h/2]:box('window reveal return',(x,.11,Z),(w,.22,.035),plaster)
    for X in [x-(w-t)/2,x+(w-t)/2]:box('recessed sash stile',(X,.18,z),(t,.08,h),wood,.006 if lod==0 else 0)
    for Z in [z-(h-t)/2,z+(h-t)/2]:box('recessed sash rail',(x,.18,Z),(w-t,.08,t),wood,.006 if lod==0 else 0)
    if lod==0:
        box('paired sash centre',(x,.16,z),(.045,.06,h-2*t),wood,.003)
        for row in [1,2]:box('small pane muntin',(x,.16,z-h/2+t+(h-2*t)*row/3),(w-2*t,.04,.028),wood)
        for col in [-1,1]:
            for row in range(3):pane('separate wavy glass pane',x+col*(w-2*t)/4,z-h/2+t+(h-2*t)*(row+.5)/3,(w-2*t)/2-.035,(h-2*t)/3-.03,.18,lod)
    else:pane('separate simplified glass',x,z,w-2*t,h-2*t,.18,lod)
    if lod<2:
        box('projecting stone sill',(x,-.04,z-h/2-.045),(w+.20,.48,.09),stone,.01)
        box('sill drip edge',(x,-.265,z-h/2-.06),(w+.10,.035,.045),stone)
        box('shallow lintel',(x,-.055,z+h/2+.08),(w+.22,.27,.12),plaster,.01)
    if lod:
        box('far room depth backing',(x,.75,z),(w,.04,h),wood)

def roof_piece(x0,x1,y0,y1,lod):
    # Pitched roof lies behind the street parapet; real tiled eaves at the sides.
    def z(y):return 6.08+max(0,1-abs(y-4.5)/4.9)*1.05
    mesh('pitched roof plane',[(x0,y0,z(y0)),(x1,y0,z(y0)),(x1,y1,z(y1)),(x0,y1,z(y1))],[(0,1,2,3)],tile)
    if lod==0:
        stepX=.32;stepY=.42
        for ix in range(math.ceil((x1-x0)/stepX)):
            x=x0+ix*stepX
            for iy in range(math.ceil((y1-y0)/stepY)):
                y=y0+iy*stepY;y2=min(y+stepY+.06,y1)
                # Half-round rolls, a simple original fired-clay profile,12tris each.
                verts=[]
                for Y in [y,y2]:
                    for j in range(5):
                        a=j*math.pi/4;verts.append((x+.14*math.cos(a),Y,z(Y)+.025+.055*math.sin(a)))
                mesh('individual roof tile roll',verts,[(j,j+1,j+6,j+5) for j in range(4)],tile)
    elif lod==1:
        for x in [x0+i*.48 for i in range(int((x1-x0)/.48)+1)]:beam('simplified eave tile roll',(x,y0,z(y0)),(x,y0+.36,z(y0+.36)),.06,tile,6)

def outside(lod):
    global CURRENT,ZONE
    print('Authoring exterior LOD'+str(lod),flush=True)
    root=empty('building-a-exterior-lod'+str(lod),lod=lod,featureId='eval-building-a',
        assumptions='6m frontage/9m depth, bays, colours, dimensions and wear assumed; no surveyed reconstruction')
    CURRENT=root;ZONE='front'
    front_wall(.1,3.12,[(-1.35,2.3,1.58,2.12),(1.65,1.4,1.38,2.56)])
    front_wall(3.12,6.12,[(-1.45,1.8,4.65,1.72),(1.45,1.8,4.65,1.72)])
    window(-1.35,1.58,2.3,2.12,lod)
    for x in [-1.45,1.45]:window(x,4.65,1.8,1.72,lod)
    for x in [.95,2.35]:box('open shop doorway jamb',(x,.16,1.40),(.08,.24,2.64),wood,.007 if lod==0 else 0)
    box('open door head',(1.65,.16,2.70),(1.48,.24,.1),wood)
    box('door threshold',(1.65,.10,.10),(1.40,.42,.08),stone,.006)
    # Door is slid aside; the actual walk aperture remains1.4m wide.
    box('parked sliding door',(2.7,.3,1.4),(.42,.07,2.5),wood)
    ZONE='left';box('left exterior wall',(-2.875,4.55,3.10),(.25,8.85,6.0),plaster,.01)
    ZONE='right';box('right exterior wall',(2.875,4.55,3.10),(.25,8.85,6.0),plaster,.01)
    ZONE='back';box('rear exterior wall',(0,8.875,3.10),(5.5,.25,6.0),plaster,.01)
    ZONE='front'
    for x,w in [(-2.8,.4),(.2,.8),(2.7,.6)]:box('street plinth',(x,-.045,.29),(w,.34,.42),stone,.014)
    for z,projection,h in [(3.12,.13,.16),(5.95,.2,.14),(6.20,.28,.14),(6.42,.20,.12)]:
        box('projecting cornice or string course',(0,-projection/2,z),(6.12,projection+.25,h),plaster,.015 if lod==0 else 0)
    box('low street parapet',(0,.17,6.28),(6.04,.36,.40),plaster,.012)
    box('fascia backing',(0,-.20,2.97),(5.6,.14,.28),wood,.015)
    for x in [-2.8,0,2.8]:box('fascia raised border',(x,-.285,2.97),(.04,.04,.27),brass)
    # Abstract diamond mark, not text copied from the postcard.
    if lod<2:
        sign=box('fictional diamond shop mark',(-.45,-.292,2.97),(.13,.025,.13),ceramic,.005);sign.rotation_euler.y=math.pi/4
        for x in [.05,.20,.35,.50]:box('fictional fascia short strokes',(x,-.292,2.97),(.035,.025,.12),ceramic)
    mesh('sloping canvas awning',[(-3,-.14,2.87),(3,-.14,2.87),(3,-1.34,2.48),(-3,-1.34,2.48)],[(0,1,2,3)],cloth)
    box('canvas valance',(0,-1.33,2.37),(6,.035,.22),cloth)
    if lod<2:
        for x in [-2.85,2.85]:beam('awning brace',(x,.04,2.12),(x,-1.34,2.48),.024,iron)
        beam('sign wall arm',(2.68,-.1,3.6),(2.68,-.92,3.6),.025,iron)
        cylinder('hanging disc sign',(2.68,-.92,3.28),.30,.065,wood,24 if lod==0 else 12,(math.pi/2,0,0))
        cylinder('disc sign ochre face',(2.68,-.957,3.28),.25,.01,red,24 if lod==0 else 12,(math.pi/2,0,0))
        beam('disc sign hanging link',(2.68,-.92,3.59),(2.68,-.92,3.52),.016,brass)
        for x in [2.58,2.68,2.78]:box('fictional disc three strokes',(x,-.968,3.28),(.025,.01,.12),ceramic)
    ZONE='roof'
    roof_piece(-3.25,3.25,-.15,4.5,lod);roof_piece(-3.25,3.25,4.5,9.25,lod)
    beam('ridge cap',(-3.3,4.5,7.17),(3.3,4.5,7.17),.10,tile,12 if lod==0 else 6)
    for x in [-3.22,3.22]:beam('side eave fascia',(x,0,6.08),(x,9.2,6.05),.045,wood)
    ZONE='right'
    if lod<2:
        beam('rain downpipe',(3.08,.28,.15),(3.08,.28,6.15),.045,iron)
        for z in [.6,2.7,5.4]:box('downpipe fixing',(3.03,.28,z),(.15,.16,.025),iron)
        beam('utility entry bracket',(2.88,1.15,5.4),(3.4,1.15,5.4),.022,iron)
        for x in [3.12,3.3]:cylinder('porcelain service insulator',(x,1.15,5.5),.06,.13,ceramic,10)
        beam('service wire',(3.3,1.15,5.56),(5.7,-2.0,6.2),.008,iron,6)
    ZONE='front'
    if lod==0:
        # Original shallow, irregular solid stains; not transparent coplanar planes.
        for x,w,z in [(-2.65,.35,.72),(.14,.22,.66),(2.77,.27,.58),(-2.3,.18,5.58),(1.1,.16,5.56)]:
            mesh('splash or sill streak',[(x-w/2,-.011,z),(x+w/2,-.011,z+.025),(x+w*.28,-.012,z-.30),(x-w*.30,-.012,z-.36)],[(0,1,2,3)],soot)
        for x in [-2.92,2.92]:box('stacked shutter board',(x,-.19,.78),(.14,.16,1.35),wood,.01)
        # Noren panels leave the doorway open below2m.
        for x in [1.17,1.65,2.13]:box('unmarked doorway noren',(x,.12,2.25),(.43,.035,.52),cloth)
    return root

def table(x,y,z=.08,low=False):
    height=.32 if low else .82
    box('low table top' if low else 'shop counter top',(x,y,z+height),(1.32,.68,.07),wood,.018)
    for X in [-.54,.54]:
        for Y in [-.25,.25]:box('table leg',(x+X,y+Y,z+height/2),(.085,.085,height),wood,.008)

def cup(x,y,z):
    cylinder('left ceramic cup',(x,y,z+.06),.055,.12,ceramic,16)
    cylinder('cup dark opening',(x,y,z+.122),.043,.002,wood,16)

def tatami_area(x0,x1,y0,y1,z):
    for j in range(math.floor((y1-y0)/.9+1e-6)):
        for i in range(math.floor((x1-x0)/1.8+1e-6)):
            x=x0+.9+i*1.8;y=y0+.45+j*.9
            box('individual tatami',(x,y,z+.035),(1.78,.88,.07),tatami,.003)
            for Y in [-.43,.43]:box('tatami sewn edge',(x,y+Y,z+.072),(1.78,.024,.01),edge)

def andon(x,y,z):
    box('andon foot',(x,y,z+.035),(.30,.30,.07),wood,.01)
    box('andon paper shade',(x,y,z+.32),(.25,.25,.43),paper,.012)
    for X in [-.13,.13]:
        for Y in [-.13,.13]:box('andon upright',(x+X,y+Y,z+.31),(.018,.018,.48),wood)
    box('andon lid',(x,y,z+.57),(.30,.30,.04),wood,.007)
    empty('warm lamp anchor',CURRENT,light={'position':[x,y,z+.35],'color':[1,.52,.18],'powerW':14,'assumed':True})

def inside():
    global CURRENT,ZONE
    print('Authoring interior cell',flush=True)
    root=empty('building-a-interior-cell',cellId='eval-building-a-interior',loadDistanceM=15,
        status='generic invented shop-house rooms; no sourced floor plan')
    CURRENT=root;ZONE='interior'
    box('doma walk floor',(0,4.5,.015),(5.5,8.5,.13),stone)
    box('raised rear platform',(-.75,7.1,.16),(4.0,3.4,.18),wood)
    # Ramp into the raised area,12cm rise over60cm, no vertical teleport threshold.
    mesh('rear floor ramp',[(-.5,4.9,.08),(.75,4.9,.08),(.75,5.5,.25),(-.5,5.5,.25),(-.5,5.5,.08),(.75,5.5,.08)],[(0,1,2,3),(0,3,4),(1,5,2)],wood)
    tatami_area(-2.7,.9,5.6,8.4,.25)
    # Upper slab split leaves a true stair void x1.05..2.75,y4.05..7.65.
    box('upper main walk floor',(-.85,4.5,3.07),(3.8,8.5,.14),wood)
    for y,length in [(2.15,3.8),(8.16,1.02)]:box('upper stair front or rear landing',(1.9,y,3.07),(1.7,length,.14),wood)
    for i in range(18):
        z=.08+(3.12-.08)*(i+1)/18;y=4.05+(i+.5)*.2
        box('stair tread '+str(i),(1.89,y,z-.045),(1.45,.215,.09),wood,.006)
        box('stair riser '+str(i),(1.89,y+.092,z-.11),(1.45,.025,.17),wood)
    for x in [1.17,2.60]:
        beam('stair stringer',(x,4.03,.03),(x,7.68,3.05),.07,wood)
        beam('stair handrail',(x,4.03,.98),(x,7.68,4.02),.035,wood)
        for i in range(0,19,3):
            y=4.05+i*.2;z=.08+3.04*i/18
            box('stair baluster',(x,y,z+.47),(.045,.045,.94),wood)
    table(-1.45,2.6);table(-.8,6.85,.32,True)
    # Counter detail, goods and signs stay abstract and unbranded.
    box('open ledger',(-1.45,2.60,.96),(.33,.24,.026),paper)
    beam('ledger pen',(-1.20,2.57,.99),(-1.20,2.77,.99),.012,wood)
    cup(-1.95,2.58,.94)
    for y in [3.9,5.0]:
        for z in [.4,.9,1.4,1.9]:box('goods shelf',(-2.35,y,z),(.54,.94,.06),wood,.008)
        for Y in [-.45,.45]:box('shelf post',(-2.35,y+Y,1.08),(.055,.055,2.08),wood)
        for row in range(3):
            for j in range(3):cylinder('generic goods jar',(-2.34,y-.3+j*.30,.46+row*.5),.09,.20,ceramic,10)
    for x,y in [(-.3,3.6),(-2.2,1.3)]:
        box('timber goods crate',(x,y,.32),(.65,.52,.48),wood,.012)
        for z in [.18,.40]:box('crate binding strap',(x,y-.27,z),(.65,.025,.035),iron)
    for x in [-1.85,-.65]:andon(x,7.7,.32)
    cup(-.85,6.9,.70)
    # Lower ceiling exposes structural framing instead of a floating second floor.
    for y in [1.1,3.0,5.0,7.8]:box('lower ceiling beam',(0,y,2.94),(5.5,.13,.21),wood,.008)
    tatami_area(-2.65,.95,.55,3.25,3.14)
    tatami_area(-2.65,.95,4.0,8.5,3.14)
    table(-1.25,2.1,3.23,True);cup(-1.1,2.05,3.60)
    andon(-2.0,1.5,3.23);andon(-1.7,7.5,3.23)
    box('upper futon chest',(-2.0,8.22,3.49),(1.3,.46,.54),wood,.014)
    for x in [-2.4,-1.6]:box('chest drawer pull',(x,7.978,3.53),(.13,.03,.03),brass)
    # Internal paper screen below the front windows; separate room behind the glass.
    for x in [-1.45,1.45]:
        box('shoji paper leaf',(x,.52,4.65),(1.62,.018,1.58),paper)
        for X in [-.81,.81]:box('shoji side stile',(x+X,.50,4.65),(.04,.035,1.64),wood)
        for X in [-.4,0,.4]:box('shoji vertical lattice',(x+X,.485,4.65),(.018,.025,1.58),wood)
        for Z in [-.78,-.39,0,.39,.78]:box('shoji horizontal lattice',(x,.485,4.65+Z),(1.62,.025,.018),wood)
        for X in [-.4,0,.4]:box('shoji inner vertical lattice',(x+X,.545,4.65),(.018,.025,1.58),wood)
        for Z in [-.78,-.39,0,.39,.78]:box('shoji inner horizontal lattice',(x,.545,4.65+Z),(1.62,.025,.018),wood)
    ZONE='ceiling'
    box('upper ceiling',(0,4.5,5.96),(5.5,8.5,.09),wood)
    for y in [1.2,4.5,7.8]:box('upper ceiling cross beam',(0,y,5.82),(5.5,.13,.20),wood)
    ZONE='interior'
    # An empty sandal pair, a towel and a tea tray are traces of use, no people.
    for x in [1.5,1.75]:box('left sandals',(x,.7,.16),(.14,.30,.04),wood,.015)
    box('folded cloth',(-.46,2.58,.96),(.28,.18,.035),cloth,.012)
    box('tea tray',(-1.44,2.11,3.6),(.36,.27,.02),red,.012)
    root['walkability']=json.dumps({'doorClearWidthM':1.32,'groundFloorY':.08,'upperFloorY':3.14,
        'stairs':{'steps':18,'riserM':3.04/18,'treadM':.20,'widthM':1.45,'voidM':[1.7,3.6]},
        'status':'authored contiguous route and floor openings; no browser collision/controller certification'})
    return root

roots=[outside(lod) for lod in [0,1,2]];interior=inside()
sys.path.insert(0,str(OUT))
from room_dressing import decorate
def set_zone(value):
    global ZONE
    ZONE=value
decorate(box,beam,cylinder,mesh,ball,MATS,interior,set_zone)
polished=wood.copy();polished.name='waxed corridor boards';polished.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.18
for obj in PARTS:
    if obj.parent==interior and obj.name.startswith(('upper main walk floor','upper stair front or rear landing')):
        obj.data.materials[0]=polished

def merge_groups(root):
    print('Merging '+root.name,flush=True)
    objects=[o for o in scene.objects if o.type=='MESH' and o.parent==root]
    groups={}
    for o in objects:groups.setdefault((o['zone'],o.data.materials[0].name),[]).append(o)
    for (zone,name),members in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in members:o.select_set(True)
        bpy.context.view_layer.objects.active=members[0]
        if len(members)>1:bpy.ops.object.join()
        obj=members[0];obj.name=root.name+' / '+zone+' / '+name
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        # Metre-scaled box UVs. Primary texture variation is reusable and independent
        # of AO packing; all geometry has a second atlas for later light baking.
        uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='metric-surface')
        for face in obj.data.polygons:
            axes=sorted(range(3),key=lambda i:abs(face.normal[i]))[:2]
            for loop_index in face.loop_indices:
                p=obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
                uv.data[loop_index].uv=(p[axes[0]]/.8,p[axes[1]]/.8)
        atlas=obj.data.uv_layers.new(name='baked-occlusion')
        obj.data.uv_layers.active_index=1
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.025,scale_to_bounds=True)
        bpy.ops.object.mode_set(mode='OBJECT');obj.data.uv_layers.active_index=0;uv.active_render=True
        obj.data.calc_loop_triangles();obj['triangleCount']=len(obj.data.loop_triangles)

for root in roots+[interior]:merge_groups(root)

def descendants(root):return [o for o in scene.objects if o.parent==root and o.type=='MESH']
def visibility(lod=0,interior_visible=True):
    for n,root in enumerate(roots):
        for o in descendants(root):o.hide_render=n!=lod
    for o in descendants(interior):o.hide_render=not interior_visible

visibility()
counts={root.name:sum(o['triangleCount'] for o in descendants(root)) for root in roots+[interior]}
if counts[roots[0].name]>20000:raise RuntimeError('Exterior triangle budget exceeded: '+str(counts))
if counts[interior.name]>150000:raise RuntimeError('Interior triangle budget exceeded')
scene['buildingStudy']=json.dumps({'schemaVersion':1,'id':'eval-building-a','lodDistancesM':[0,25,80],
    'defaultLod':0,'interiorCell':interior.name,'footprintM':[6,9],'triangleCounts':counts,
    'sources':['OML158514 (1912)','OML157003/157013 (1905 typology)','Claude100 shared brief'],
    'status':'blind comparison candidate; generic dimensions/colour/interior/layout inferred; no history/AAA acceptance'})

# Original AO is packed with each material/zone, not claimed as a lightmap.
scene.render.engine='BLENDER_EEVEE_NEXT'
# Cycles4.5/OpenImageIO repeatedly crashed while synchronising this authored
# scene, including one-thread execution. Use original finite-radius Blender BVH
# ray AO instead. This is an8-ray cosine hemisphere study, not a lightmap.
occluder_vertices=[];occluder_faces=[]
for obj in descendants(roots[0])+descendants(interior):
    if obj.data.materials[0] in [glass,paper]:continue
    offset=len(occluder_vertices);obj.data.calc_loop_triangles()
    occluder_vertices.extend(obj.matrix_world@v.co for v in obj.data.vertices)
    occluder_faces.extend(tuple(offset+i for i in t.vertices) for t in obj.data.loop_triangles)
bvh=BVHTree.FromPolygons(occluder_vertices,occluder_faces,all_triangles=True)

def ray_ao(obj,image,size):
    data=obj.data;uv=data.uv_layers[1].data;pixels=[1.0]*(size*size*4)
    matrix=obj.matrix_world;normals=matrix.to_3x3().inverted().transposed()
    samples=8
    for triangle in data.loop_triangles:
        tex=[uv[i].uv*size for i in triangle.loops]
        p=[matrix@data.vertices[i].co for i in triangle.vertices]
        normal=(normals@triangle.normal).normalized()
        tangent=normal.cross(Vector((0,0,1)) if abs(normal.z)<.95 else Vector((1,0,0))).normalized()
        bitangent=normal.cross(tangent)
        rays=[]
        for i in range(samples):
            r=math.sqrt((i+.5)/samples);phi=i*2.39996323
            rays.append(tangent*(r*math.cos(phi))+bitangent*(r*math.sin(phi))+normal*math.sqrt(1-r*r))
        a,c,d=tex;den=(c.y-d.y)*(a.x-d.x)+(d.x-c.x)*(a.y-d.y)
        if abs(den)<1e-10:continue
        for y in range(max(0,math.floor(min(v.y for v in tex))),min(size,math.ceil(max(v.y for v in tex)))):
            for x in range(max(0,math.floor(min(v.x for v in tex))),min(size,math.ceil(max(v.x for v in tex)))):
                u=((c.y-d.y)*(x+.5-d.x)+(d.x-c.x)*(y+.5-d.y))/den
                v=((d.y-a.y)*(x+.5-d.x)+(a.x-d.x)*(y+.5-d.y))/den;w=1-u-v
                if min(u,v,w)<-.001:continue
                origin=p[0]*u+p[1]*v+p[2]*w+normal*.004
                blocked=sum(bvh.ray_cast(origin,ray,.7)[0] is not None for ray in rays)
                value=1-blocked/samples;index=(y*size+x)*4
                pixels[index:index+3]=[value]*3
    image.pixels.foreach_set(pixels)
ao_manifest=[]
if '--no-ao' not in sys.argv:
    for obj in descendants(roots[0])+descendants(interior):
        original=obj.data.materials[0]
        if original in [glass,paper] or sum(p.area for p in obj.data.polygons)<.15:continue
        # Use512 atlases except the large plaster shell. Limit total texture budget.
        size=512 if original==plaster else 256
        image=bpy.data.images.new('AO '+obj.name,width=size,height=size,alpha=False,float_buffer=True)
        image.colorspace_settings.name='Non-Color'
        print('BVH AO '+obj.name+' '+str(size),flush=True);ray_ao(obj,image,size)
        filename='ao-'+str(len(ao_manifest))+'.png';image.filepath_raw=str(OUT/'textures'/filename);image.file_format='PNG';image.save()
        obj.data.materials[0]=original.copy();m=obj.data.materials[0];m.name=original.name+' / AO '+str(len(ao_manifest))
        uvnode=m.node_tree.nodes.new('ShaderNodeUVMap');uvnode.uv_map='baked-occlusion'
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;m.node_tree.links.new(uvnode.outputs['UV'],tex.inputs['Vector'])
        group=bpy.data.node_groups.get('glTF Material Output')
        if not group:
            group=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree');group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
        node=m.node_tree.nodes.new('ShaderNodeGroup');node.node_tree=group;m.node_tree.links.new(tex.outputs['Color'],node.inputs['Occlusion'])
        # Render previews share the same baked AO factor as exported PBR occlusion.
        b=m.node_tree.nodes.get('Principled BSDF');base=b.inputs['Base Color'];links=list(base.links)
        mult=m.node_tree.nodes.new('ShaderNodeMixRGB');mult.blend_type='MULTIPLY';mult.inputs[0].default_value=.65
        if links:m.node_tree.links.new(links[0].from_socket,mult.inputs[1])
        else:mult.inputs[1].default_value=base.default_value
        m.node_tree.links.new(tex.outputs['Color'],mult.inputs[2]);m.node_tree.links.new(mult.outputs[0],base)
        obj.data.uv_layers.active_index=0;obj.data.uv_layers[0].active_render=True
        ao_manifest.append({'file':filename,'node':obj.name,'sizePx':[size,size],'uvChannel':1,'sha256':hashlib.sha256((OUT/'textures'/filename).read_bytes()).hexdigest()})

# Restore the simple exported base-colour link for glTF. The Blender-only mix
# below is a preview AO multiplier; glTF receives its separate occlusion channel.
preview_links=[]
for obj in descendants(roots[0])+descendants(interior):
    m=obj.data.materials[0];b=m.node_tree.nodes.get('Principled BSDF');base=b.inputs['Base Color']
    if base.links and base.links[0].from_node.type=='MIX_RGB':
        source=base.links[0].from_socket;mixnode=source.node
        if mixnode.inputs[1].links:
            m.node_tree.links.new(mixnode.inputs[1].links[0].from_socket,base)
            preview_links.append((m,source,base))
        else:
            m.node_tree.links.remove(base.links[0]);base.default_value=mixnode.inputs[1].default_value
            preview_links.append((m,source,base))
bpy.ops.object.select_all(action='DESELECT')
for root in roots+[interior]:
    root.select_set(True)
    for o in scene.objects:
        if o.parent==root:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'building-a.glb'),export_format='GLB',use_selection=True,export_extras=True,export_cameras=False,export_lights=False)
for m,source,base in preview_links:m.node_tree.links.new(source,base)
(OUT/'metrics.json').write_text(json.dumps({'triangles':counts,'ao':ao_manifest,'noAo':'--no-ao' in sys.argv},indent=2),encoding='utf8')

# Review staging is not exported into the asset. Six fixed views are independent
# of the live JTA renderer, and are clearly labelled Blender comparison renders.
scene.render.engine='BLENDER_EEVEE_NEXT';scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100
if hasattr(scene.eevee,'use_raytracing'):scene.eevee.use_raytracing=True
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.16,.23,.36,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.35
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=.3
scene.use_nodes=True;nodes=scene.node_tree.nodes;nodes.clear();rl=nodes.new('CompositorNodeRLayers');glare=nodes.new('CompositorNodeGlare');glare.glare_type='FOG_GLOW';glare.quality='HIGH';glare.threshold=2;glare.mix=-.93
composite=nodes.new('CompositorNodeComposite');scene.node_tree.links.new(rl.outputs['Image'],glare.inputs['Image']);scene.node_tree.links.new(glare.outputs['Image'],composite.inputs['Image'])
CURRENT=None;ZONE='review-only'
ground=box('review dirt ground',(0,0,-.13),(400,400,.12),stone)

def light(name,loc,power,color,size=2):
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size
    o.rotation_euler=(Vector((0,3,2.5))-o.location).to_track_quat('-Z','Y').to_euler();return o
light('dusk soft sky',(-4,-4,11),700,(.49,.64,1),12)
light('raking evening key',(-8,-12,9),2300,(1,.65,.35),8)
bpy.ops.object.light_add(type='SUN',location=(-8,-12,9));window_sun=bpy.context.object
window_sun.name='assumed late-afternoon window sun';window_sun.data.energy=2.0;window_sun.data.color=(1,.81,.59);window_sun.data.angle=.06
window_sun.rotation_euler=Vector((-.28,.78,-.56)).to_track_quat('-Z','Y').to_euler()
for x,y,z in [(-1.5,3,2.55),(-1.1,7,2.5),(-1.3,2,5.35),(-1.5,7.2,5.3)]:
    bpy.ops.object.light_add(type='POINT',location=(x,y,z));o=bpy.context.object;o.data.energy=75;o.data.color=(1,.63,.32);o.data.shadow_soft_size=.5
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera

def render(name,position,target,lens=35,ortho=None):
    camera.location=position;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO' if ortho else 'PERSP';camera.data.lens=lens
    if ortho:camera.data.ortho_scale=ortho
    scene.render.filepath=str(OUT/'renders'/f'{name}.png');print('Rendering '+name,flush=True);bpy.ops.render.render(write_still=True)

if '--no-render' not in sys.argv:
    (OUT/'renders').mkdir(exist_ok=True);visibility()
    render('street',(9,-15,1.5),(0,1.2,3.2),32)
    render('window-closeup',(-3.7,-3.6,4.7),(-1.45,.12,4.65),50)
    render('interior-ground',(1.72,1.5,1.65),(-1.0,5.8,1.05),24)
    render('interior-upper',(.45,7.65,4.7),(-1.3,1.8,4.1),26)
    hidden=[]
    for o in descendants(roots[0]):
        if o['zone'] in ['front','right','roof']:hidden.append(o);o.hide_render=True
    for o in descendants(interior):
        if o['zone']=='ceiling':hidden.append(o);o.hide_render=True
    render('cutaway',(14,-11,11),(0,4.2,2.7),ortho=14)
    for o in hidden:o.hide_render=False
    for n,root in enumerate(roots):
        root.location.x=(n-1)*9
        for o in descendants(root):o.hide_render=False
    for o in descendants(interior):o.hide_render=True
    render('lod',(21,-32,17),(0,3.8,3.0),ortho=32)
    for root in roots:root.location.x=0
    visibility()
print(json.dumps(counts),flush=True)
