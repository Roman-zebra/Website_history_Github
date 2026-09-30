"""Handoff104: Opus envelope/structure + Sonnet dressing, with explicit adaptations.
Blender4.5 --python build.py -- [--no-render] [--review-only]
Frozen author inputs are loaded without calling either author's main().
All coordinates/colours/interiors remain assumptions; review staging is not exported.
"""
import ast, hashlib, json, math, sys, time, types
from pathlib import Path
import bpy, bmesh
from mathutils import Vector

OUT=Path(__file__).resolve().parent
REPO=OUT.parents[3]
CACHE=REPO.parent/'research-cache'
START=time.time()
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
sys.path.insert(0,str(OUT))
from micro_props import build as build_micro_props

def author(who):
    path=OUT/'inputs'/who/'build-building-a.py'
    tree=ast.parse(path.read_text(encoding='utf8'),filename=str(path))
    # Sonnet's entrypoint is unguarded. Preserve the frozen source bytes and
    # suppress that top-level call only; Opus's guarded entrypoint stays idle.
    tree.body=[n for n in tree.body if not(isinstance(n,ast.Expr) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Name) and n.value.func.id=='main')]
    module=types.ModuleType('building_a_'+who);module.__file__=str(path)
    exec(compile(tree,str(path),'exec'),module.__dict__)
    module.OUT=OUT;return module

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):bpy.data.collections.remove(c)
opus=author('opus');opus.MAT93=CACHE/'materials-93';opus.TEX=opus.make_textures()
sonnet=author('sonnet');sonnet.TEX=CACHE/'materials-93'
scene=bpy.context.scene;scene.unit_settings.system='METRIC'
root=bpy.data.objects.new('BuildingA_Hybrid',None);scene.collection.objects.link(root)
root['handoff']=104;root['source']='Opus shell/structure; Sonnet dressing; Codex adaptations. See inputs/PROVENANCE.json.'
root['assumptions']='6x9m brief; all numeric geometry, colours, interiors and lighting are inferred, not a surveyed historic floor plan.'

def empty(name,parent,**extras):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent
    for k,v in extras.items():o[k]=v
    return o
lods=[empty('Hybrid_LOD'+str(i),root,lod=i) for i in range(3)]
cell=empty('Hybrid_InteriorCell',root,load_within_m=15,unload_beyond_m=18)
collision=empty('Hybrid_Collision',root,collision=True,render=False)
geometry=[]

def source_tag(o,tag,reason):
    o['sourceTags']=json.dumps({'form':tag,'assumption':'A:'+reason},ensure_ascii=False)
    return o

parts=opus.build_lod0(scene.collection)
for name,p in parts.items():
    o=p.to_object(scene.collection);o.parent=lods[0];geometry.append(o)
    tag='S:OML158514 (1912)' if name in ['walls','trim','awning','signs'] else ('S:OML157003/157013 (1905 Osaka typology)' if name in ['windows','shopfront','roof'] else 'A:unseen side/rear/services')
    source_tag(o,tag,'Exact profiles, dimensions, colours, marks and hidden roof/back are inferred; no photograph gives scale.')
for i,p in [(1,opus.build_lod1()),(2,opus.build_lod2())]:
    o=p.to_object(scene.collection);o.parent=lods[i];geometry.append(o)
    source_tag(o,'S:OML158514 (1912) massing','Simplified inferred LOD proxy, not source-confirmed room mapping.')
# The Opus rear board floor covered its own declared stairwell. Split every
# overlapping upper slab/board into rectangles around that opening. This is a
# geometry repair to the inferred plan, not a new historical measurement.
original_box=opus.Part.box
def open_stairwell(part,a,b,mat,*args,**kwargs):
    x0,y0,z0=a;x1,y1,z1=b
    hx0,hy0,hx1,hy1=5.10,6.35,5.82,8.27
    if part.name=='BldgA_Interior_Structure' and abs(x0-5.10)<.001 and abs(x1-5.82)<.001 and abs(y0-7.01)<.001 and abs(y1-7.22)<.001 and abs(z0-.455)<.001 and z1>1.5:
        # An actual small storage cavity opens on the left side of this box stair.
        # Keep the back/side webs and the full upper tread supported.
        for aa,bb in [((5.54,y0,z0),(x1,y1,z1)),((x0,y0,z0),(5.54,7.025,z1)),((x0,7.205,z0),(5.54,y1,z1)),((x0,7.025,z0),(5.54,7.205,.630)),((x0,7.025,1.015),(5.54,7.205,z1))]:original_box(part,aa,bb,mat,*args,**kwargs)
        return
    if part.name=='BldgA_Interior_Structure' and z0>=3.25 and z1<=3.50 and x0<hx1 and x1>hx0 and y0<hy1 and y1>hy0:
        for ax,ay,bx,by in [(x0,y0,min(x1,hx0),y1),(max(x0,hx1),y0,x1,y1),(max(x0,hx0),y0,min(x1,hx1),min(y1,hy0)),(max(x0,hx0),max(y0,hy1),min(x1,hx1),y1)]:
            if bx-ax>1e-6 and by-ay>1e-6:original_box(part,(ax,ay,z0),(bx,by,z1),mat,*args,**kwargs)
        return
    return original_box(part,a,b,mat,*args,**kwargs)
opus.Part.box=open_stairwell
structure,unused,lamps=opus.build_interior()
opus.Part.box=original_box
o=structure.to_object(scene.collection);o.parent=cell;geometry.append(o)
source_tag(o,'A:Opus structure','Invented floors0/.455/3.455m, box stair and room partition; no inspectable floor plan.')
o=opus.build_collision().to_object(scene.collection);o.parent=collision;geometry.append(o)

# Preserve the Opus envelope, floor slabs, stair and openings. Sonnet's original
# floor heights and four-window dressing are incompatible and are not overlaid.
sonnet.tatami_mat=lambda *a,**kw:None
sonnet.stair_build=lambda *a,**kw:None
sonnet.Z_FLOOR_U=opus.Z_F2
sonnet.Z_RAISED=opus.Z_RAISED
dress=[]
for kind,make in [('shop',sonnet.build_shop_props),('raised',sonnet.build_room_g),('upper',sonnet.build_room_u)]:
    old_andon=sonnet.andon
    if kind=='raised':sonnet.andon=lambda *a,**kw:None
    p=make()
    sonnet.andon=old_andon
    if kind=='raised':
        # Opus has a raised rear room rather than Sonnet's rear doma kitchen.
        # Remove that incompatible kitchen/storage (including spanning faces),
        # then fit the retained room props into the Opus rear room footprint.
        drop=[f for f in p.bm.faces if max(v.co.y for v in f.verts)>7.50]
        bmesh.ops.delete(p.bm,geom=drop,context='FACES')
        for v in p.bm.verts:
            v.co.x=.18+(v.co.x-.25)*(4.92-.18)/(4.93-.25)
            v.co.y=6.02+(v.co.y-4.60)*(8.85-6.02)/(7.50-4.60)
    if kind=='shop':
        # Replace the original solid counter carcass while preserving its ledger,
        # abacus, stock and cloth. The replacement is hollow and assembled.
        drop=[f for f in p.bm.faces if p.slots[f.material_index]=='WOOD' and all(1.309<=v.co.x<=3.591 and 2.699<=v.co.y<=3.341 and .499<=v.co.z<=1.346 for v in f.verts)]
        bmesh.ops.delete(p.bm,geom=drop,context='FACES')
        # Sonnet's coat/clock were attached to its structural centre post.
        # Restore that assumed support instead of leaving them floating.
        sonnet.mbox(p,'WOOD',2.92,4.29,.50,3.08,4.39,3.75,(96,74,56))
        for v in p.bm.verts:v.co.z-=.50
    p.finish();o=p.to_object(scene.collection);o.name='Hybrid_Sonnet_'+kind;o.parent=cell
    source_tag(o,'A:Sonnet period-plausible dressing','Invented goods/trace of use; floor relocation and rear-room fit by Codex. Kitchen, duplicate stair/mats and incompatible window dressing excluded.')
    dress.append(o);geometry.append(o)
sonnet.lightmap_uv1(dress)
micro=build_micro_props(cell,OUT)
geometry.extend(micro['meshes'])
for o in geometry:
    if o.parent!=collision and o not in dress:opus.add_uv2(o)
for name,pos,col,power,radius in lamps:
    # These are explicit local study lighting assumptions, not source evidence.
    data=bpy.data.lights.new('HybridLamp_'+name,'POINT');data.energy=power;data.color=col;data.shadow_soft_size=radius
    obj=bpy.data.objects.new(data.name,data);scene.collection.objects.link(obj);obj.location=pos;obj.parent=cell

def count(parent):
    total=0
    for o in geometry:
        p=o.parent
        while p is not None:
            if p==parent:o.data.calc_loop_triangles();total+=len(o.data.loop_triangles);break
            p=p.parent
    return total
metrics={'triangles':{'lod'+str(i):count(lods[i]) for i in range(3)},'interiorTriangles':count(cell),'collisionTriangles':count(collision),'adaptations':['Opus shell/floors/stair retained; rear boards cut around stair opening','Sonnet shop lowered0.50m; floating coat/clock post restored','Sonnet rear props fit into6.02..8.85m raised room','Sonnet upper built at3.455m','Duplicate mats/stair/kitchen/four-window dressing excluded'],'performance':'Blender review only; qualifying1920x1080 browser harness unavailable; no60fps claim'}
assert metrics['triangles']['lod0']<=20000 and metrics['interiorTriangles']<=150000

# Five explicit cameras for each of the two storeys, each repeated in a separate
# dream staging variant. Base architecture and object coordinates stay unchanged.
if '--no-render' not in ARGS:
    sonnet.make_render_materials();opus.setup_render(48)
    scene.render.engine='BLENDER_EEVEE_NEXT';scene.eevee.taa_render_samples=64
    scene.eevee.use_raytracing=True
    scene.frame_set(31)
    opus.setup_world(18,220,.45,2.0)
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam
    for o in geometry:o.hide_render=o.parent in [lods[1],lods[2],collision]
    review=empty('ReviewOnly',None)
    # Front-facing fill is reviewed staging and deliberately excluded from GLB.
    for z in [1.8,4.8]:
        data=bpy.data.lights.new('window_fill','AREA');data.energy=100;data.color=(.64,.77,1);data.shape='RECTANGLE';data.size=4;data.size_y=2
        o=bpy.data.objects.new(data.name,data);scene.collection.objects.link(o);o.parent=review;o.location=(3,-.5,z);o.rotation_euler=(math.pi/2,0,0)
    cameras={
        'ground-axis':((4.25,1.0,1.5),(2.6,7.3,1.1),22),
        'ground-corner':((5.45,4.7,1.5),(.8,1.7,1.1),22),
        'ground-ceiling':((3,3,1.5),(3,5.7,3.05),24),
        'ground-window':((2.8,4.4,1.5),(2.4,0,1.15),24),
        'ground-street':((4.4,-2.0,1.5),(3,3.9,1.15),30),
        'upper-axis':((4.3,4.4,4.955),(1.5,.55,4.2),22),
        'upper-corner':((.8,.6,4.955),(4.1,4.3,4.15),22),
        'upper-ceiling':((3,2,4.955),(3,4.3,5.9),24),
        'upper-window':((3.2,3.9,4.955),(1.5,.25,4.5),24),
        'upper-street':((2.2,-2.2,4.955),(1.5,1.3,4.4),35)
    }
    cameras['hero-counter']=((2.9,3.9,1.0),(2.45,3.3,.6),50)
    cameras['hero-stair-storage']=((4.15,6.75,1.18),(4.94,7.115,.82),35)
    cameras['hero-andon']=((3.92,7.66,.99),(3.826,8.459,.63),40)
    cameras['hero-shelf-goods']=((3.87,2.27,1.2),(3.37,2.88,.96),50)
    dream=empty('DreamReviewOnly',None)
    # One impossible object per room: a suspended teal sphere, explicitly a dream
    # assumption rather than a period artefact. No people or brand marks.
    for z in [1.9,4.9]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=.23,location=(3,2.8,z))
        o=bpy.context.object;o.name='Dream floating sphere';o.parent=dream
        for face in o.data.polygons:face.use_smooth=True
        m=bpy.data.materials.get('Dream teal') or bpy.data.materials.new('Dream teal');m.diffuse_color=(.03,.55,.5,1);m.use_nodes=True
        bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.03,.55,.5,1);bs.inputs['Roughness'].default_value=.15
        o.data.materials.append(m)
    # One abundance category: repeated original flower pots in the dream layer.
    # They are staging assumptions, not claims about this merchant's inventory.
    flower_material=bpy.data.materials.new('Dream coral petals');flower_material.diffuse_color=(.75,.12,.17,1)
    for floor in [0,opus.Z_F2]:
        for i in range(9):
            x=.58+(i%3)*.30;y=2.9+(i//3)*.32
            bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=.09,radius2=.12,depth=.18,location=(x,y,floor+.09))
            pot=bpy.context.object;pot.name='Dream repeated flower pot';pot.parent=dream;pot.data.materials.append(sonnet.MATS['WOOD'])
            for j in range(3):
                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.07,location=(x+.06*math.cos(j*2.1),y+.06*math.sin(j*2.1),floor+.33+j*.04))
                flower=bpy.context.object;flower.name='Dream original flower cluster';flower.parent=dream;flower.data.materials.append(flower_material)
    dream_objects=[o for o in scene.objects if o.parent==dream]
    dream_materials={}
    for obj in geometry:
        if obj.parent==collision:continue
        for mat in obj.data.materials:
            if mat in dream_materials or not mat.use_nodes:continue
            clone=mat.copy();clone.name=mat.name+' / dream coral tint'
            bs=next((n for n in clone.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
            if bs:
                socket=bs.inputs['Base Color'];mix=clone.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.72
                mix.inputs[2].default_value=(1,.36,.39,1)
                if socket.links:clone.node_tree.links.new(socket.links[0].from_socket,mix.inputs[1])
                else:mix.inputs[1].default_value=socket.default_value
                clone.node_tree.links.new(mix.outputs[0],socket)
            dream_materials[mat]=clone
    shots=[];(OUT/'renders').mkdir(exist_ok=True)
    for variant in ['base','dream']:
        for o in dream_objects:o.hide_render=variant=='base'
        # A coherent coral grade is review-only. It does not recolour historic
        # source evidence or pretend to be the final dreamcore material system.
        scene.view_settings.exposure=.05 if variant=='base' else .3
        scene.view_settings.use_curve_mapping=False
        if variant=='dream':
            for obj in geometry:
                if obj.parent!=collision:
                    for i,mat in enumerate(obj.data.materials):
                        if mat in dream_materials:obj.data.materials[i]=dream_materials[mat]
        for name,(pos,target,lens) in cameras.items():
            opus.look(cam,pos,target,lens);scene.render.filepath=str(OUT/'renders'/f'{variant}-{name}.png')
            print('Rendering '+variant+'-'+name,flush=True);bpy.ops.render.render(write_still=True)
            shots.append({'file':f'{variant}-{name}.png','position':pos,'target':target,'lens':lens,'referenceFrames':['mZX2Xqb13xc/00012','mZX2Xqb13xc/00033','mZX2Xqb13xc/00044'],'stage':'Blender Eevee64,1280x720; not browser performance'})
    (OUT/'review-cameras.json').write_text(json.dumps(shots,indent=2),encoding='utf8')
    originals={clone:original for original,clone in dream_materials.items()}
    for obj in geometry:
        for i,mat in enumerate(obj.data.materials):
            if mat in originals:obj.data.materials[i]=originals[mat]

if '--review-only' not in ARGS:
    scene.frame_set(1)
    # Export the selected asset only; no camera/sun/fill/sphere/dream grade.
    for m in list(opus._MAT_CACHE.values()):
        if m.name in opus.MATS:opus.export_material(m)
    sonnet.make_plain_materials()
    # Blender cannot compute MikkTSpace on the source's n-gons. Triangulate
    # explicitly so the generated glass/roof normal maps carry portable tangents.
    for o in geometry:
        bm=bmesh.new();bm.from_mesh(o.data)
        bmesh.ops.triangulate(bm,faces=list(bm.faces))
        bm.to_mesh(o.data);bm.free();o.data.update()
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
    for o in scene.objects:
        p=o.parent
        while p is not None:
            if p==root:o.select_set(True);break
            p=p.parent
    bpy.ops.export_scene.gltf(filepath=str(OUT/'building-a.glb'),export_format='GLB',use_selection=True,export_extras=True,export_lights=True,export_cameras=False,export_tangents=True,export_attributes=True,export_vertex_color='ACTIVE')
    metrics['bytes']=(OUT/'building-a.glb').stat().st_size
    if '--runtime-splits' in ARGS:
        runtime=OUT/'runtime';runtime.mkdir(exist_ok=True)
        entries=[]
        for part,name in [(lods[i],'exterior-lod'+str(i)) for i in range(3)]+[(cell,'interior')]:
            bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
            for o in scene.objects:
                p=o
                while p is not None:
                    if p==part:o.select_set(True);break
                    p=p.parent
            file=runtime/(name+'.glb')
            bpy.ops.export_scene.gltf(filepath=str(file),export_format='GLB',use_selection=True,export_extras=True,export_lights=True,export_cameras=False,export_tangents=True,export_attributes=True,export_vertex_color='ACTIVE')
            entries.append({'part':name,'file':file.name,'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'triangles':count(part)})
        (runtime/'manifest.json').write_text(json.dumps({'source':'Source-only local hybrid derivative; no paid delivery implemented','position':[3,1.8,-4.5],'enter':15,'leave':18,'coordinateSystem':'glTF X right,Y up,-Z toward rear; Blender X,Z,-Y','entries':entries},indent=2),encoding='utf8')
        metrics['runtimeParts']=entries
metrics['buildSeconds']=round(time.time()-START,2)
(OUT/'metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf8')
print(json.dumps(metrics),flush=True)
