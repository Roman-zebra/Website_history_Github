"""Private Claude118 cloth simulation derivative; no frozen source overwrite.

Blender4.5 -b --python-exit-code 1 --python build-cloth-v2.py
Outputs only parent research-cache/upper-118-cloth-v2 for review.
"""
import json, math, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from upper_cloth import install, TARGETS
from upper_portable import repair_export_tangents
sewn='--sewn' in sys.argv
hat_contact='--hat-contact' in sys.argv
rail_contact='--rail-contact' in sys.argv
assert not hat_contact or sewn,'Hat contact comparison requires --sewn'
assert not rail_contact or hat_contact,'Rail contact comparison requires --hat-contact'
bending=float(sys.argv[sys.argv.index('--haori-bending')+1]) if '--haori-bending' in sys.argv else 2
assert math.isfinite(bending) and bending>0,'Invalid haori bending stiffness'
assert bending==2 or rail_contact,'Bending comparison requires the rail-contact variant'
sleeve_drop=float(sys.argv[sys.argv.index('--sleeve-drop')+1]) if '--sleeve-drop' in sys.argv else .035
assert math.isfinite(sleeve_drop) and 0<=sleeve_drop<=.25,'Invalid initial sleeve drop'
assert '--sleeve-drop' not in sys.argv or rail_contact,'Sleeve comparison requires the rail-contact variant'
sleeve_relief=float(sys.argv[sys.argv.index('--sleeve-relief')+1]) if '--sleeve-relief' in sys.argv else 0
assert math.isfinite(sleeve_relief) and 0<=sleeve_relief<=.025,'Invalid initial sleeve relief'
assert '--sleeve-relief' not in sys.argv or rail_contact,'Sleeve relief requires the rail-contact variant'

source=HERE/'build.py'
text=source.read_text(encoding='utf8').split('# Five explicit cameras')[0]
needle='upper.build_materials();upper.build_all()'
assert text.count(needle)==1
text=text.replace(needle,'upper.build_materials();cloth_state=install(upper);upper.build_all()')
scope={'__file__':str(source),'__name__':'private_cloth118','install':install}
exec(compile(text,str(source),'exec'),scope)
upper=scope['upper']; scene=bpy.context.scene
variant='upper-118-cloth-v2-sewn-rail' if rail_contact else 'upper-118-cloth-v2-sewn-hat' if hat_contact else 'upper-118-cloth-v2-sewn' if sewn else 'upper-118-cloth-v2'
if bending!=2:variant+='-bend-'+str(bending).replace('.','p')
if '--sleeve-drop' in sys.argv:variant+='-sleeve-'+str(sleeve_drop).replace('.','p')
if '--sleeve-relief' in sys.argv:variant+='-relief-'+str(sleeve_relief).replace('.','p')
out=scope['CACHE']/variant;out.mkdir(exist_ok=True)
roots={name:bpy.data.objects[name] for name in TARGETS}
normal_material=next(m for m in bpy.data.materials if m.name.startswith('Original cloth with fine wrinkle normal'))
receipt={'sourceRevision':'e3dd4e7','handoff':118,'sourceTags':'A: inferred original garment patterns/colour and Blender cloth simulation, no image pixels','simulation':[],'retainedHardware':{},'photographicAcceptance':False}

# Remove cloth only, retaining the exact source rail, pegs, hat, bamboo, shears
# and core triangles. Source authoring files and current browser GLBs stay intact.
for name,root in roots.items():
    mesh=root.data; bm=bmesh.new();bm.from_mesh(mesh)
    ids={i for i,m in enumerate(mesh.materials) if m==upper.MATS['cloth'] or m.name.startswith('Original cloth with fine wrinkle normal')}
    removed=[f for f in bm.faces if f.material_index in ids]
    before=len(bm.faces); bmesh.ops.delete(bm,geom=removed,context='FACES')
    bm.to_mesh(mesh);bm.free();mesh.update()
    root.name=name+'_v2'
    receipt['retainedHardware'][name]={'sourceFaces':before,'remainingFaces':len(mesh.polygons),'placement':list(root.matrix_world.translation)}

def linear(c):
    c=c/255;return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4

def panel(name,root,nu,nv,position,pin,colour,collision=False):
    vertices=[position(i/nu,j/nv) for j in range(nv+1) for i in range(nu+1)]
    faces=[(j*(nu+1)+i,j*(nu+1)+i+1,(j+1)*(nu+1)+i+1,(j+1)*(nu+1)+i) for j in range(nv) for i in range(nu)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);obj.parent=root
    mesh.materials.append(normal_material)
    uv=mesh.uv_layers.new(name='UVMap')
    # Metric wrinkle UV; the original12cm normal tile is reused by the browser.
    for face in mesh.polygons:
        for index in face.loop_indices:
            vi=mesh.loops[index].vertex_index; i,j=vi%(nu+1),vi//(nu+1)
            u=Vector(vertices[j*(nu+1)+nu])-Vector(vertices[j*(nu+1)])
            v=Vector(vertices[nv*(nu+1)+i])-Vector(vertices[i])
            uv.data[index].uv=(i/nu*u.length/.12,j/nv*v.length/.12)
    attr=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for datum in attr.data:datum.color=(*[linear(c) for c in colour],1)
    group=obj.vertex_groups.new(name='attachment')
    pinned=[i for i in range(len(vertices)) if pin(i%(nu+1)/nu,i//(nu+1)/nv)]
    assert pinned, name
    group.add(pinned,1,'REPLACE')
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    modifier=obj.modifiers.new('Local cloth settlement','CLOTH')
    s=modifier.settings;s.quality=8;s.mass=.08;s.air_damping=2
    s.tension_stiffness=30;s.compression_stiffness=30;s.shear_stiffness=20;s.bending_stiffness=.15
    s.vertex_group_mass=group.name;s.pin_stiffness=1
    modifier.collision_settings.use_collision=collision
    modifier.collision_settings.distance_min=.0006 if collision else .002
    modifier.collision_settings.use_self_collision=True
    modifier.collision_settings.self_distance_min=.002
    modifier.point_cache.frame_start=1;modifier.point_cache.frame_end=32
    for frame in range(1,33):scene.frame_set(frame);bpy.context.view_layer.update()
    evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    settled=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=bpy.context.evaluated_depsgraph_get())
    deviations=[(Vector(a)-v.co).length for a,v in zip(vertices,settled.vertices)]
    obj.modifiers.clear();obj.data=settled
    thickness=obj.modifiers.new('Inferred woven body1.2mm','SOLIDIFY');thickness.thickness=.0012;thickness.offset=0
    thickness.use_even_offset=True
    bpy.ops.object.modifier_apply(modifier=thickness.name)
    for face in obj.data.polygons:face.use_smooth=True
    obj['sourceTags']='A: simulated original cloth pattern; inferred1.2mm fabric thickness'
    receipt['simulation'].append({'name':name,'frames':32,'quality':8,'pinnedVertices':len(pinned),'maxDisplacementMetres':max(deviations),'vertices':len(vertices),'closedBodyThickness':.0012})
    obj.select_set(False);scene.frame_set(1)
    print('SETTLED',name,round(max(deviations),5),flush=True)
    return obj

# The haori stays over the original pegs. Separate front opening, back, sleeves
# and folded collar provide shoulder/sleeve/collar silhouettes before settlement.
h=roots['UD_CoatRail_Haori']; z=upper.ZF+1.46;yc=2.185
if sewn:
    from haori_sewn import build as build_sewn_haori
    build_sewn_haori(h,upper.ZF,normal_material,receipt,hat_collision=hat_contact,rail_collision=rail_contact,bending_stiffness=bending,initial_sleeve_drop=sleeve_drop,initial_sleeve_relief=sleeve_relief)
else:
    for label,x,offset,width,colour in [('back',.255,-.23,.46,(38,44,66)),('frontL',.325,-.23,.205,(38,44,66)),('frontR',.325,.025,.205,(38,44,66))]:
        panel('Haori_'+label,h,8 if label=='back' else 4,16,
              lambda s,t,x=x,offset=offset,width=width:(x+.015*math.sin(17*s)*t,yc+offset+width*s,z-.78*t),
              lambda s,t:t==0 and .2<=s<=.8,colour)
    for sign in [-1,1]:
        panel('Haori_sleeve_'+str(sign),h,6,8,
              lambda s,t,sign=sign:(.285+.045*math.sin(math.pi*t),yc+sign*(.215+.20*s),z-.035*s-.38*t),
              lambda s,t:s==0,(34,40,60))
    for sign in [-1,1]:
        panel('Haori_collar_'+str(sign),h,2,12,
              lambda s,t,sign=sign:(.341+.012*math.sin(math.pi*s),yc+sign*(.015+.13*(1-t))+.045*(s-.5),z-.42*t),
              lambda s,t:t==0,(90,92,108))
# Three folded garments settle independently over the exact authored pole.
d=roots['UD_DryingPole_Cloths']
for k,(xa,width,front,back,col) in enumerate([( .50,.55,.66,.70,(78,96,134)),(2.10,.33,.78,.74,(226,220,204)),(2.56,.33,.60,.64,(150,54,44))]):
    def fold(s,t,xa=xa,width=width,front=front,back=back):
        a=(t-.5)*math.pi*2
        y=4.45+.02*math.sin(a)+.02*math.sin(17*s)*abs(t-.5)
        z=5.475-(front if t<.5 else back)*abs(2*t-1)
        return xa+width*s,y,z
    panel('Laundry_fold_'+str(k),d,6,20,fold,lambda s,t:abs(t-.5)<.045,col)

# The bolt retains the authored diagonal and card core. A real roll and draped
# loose sheet are distinct surfaces; grounding uses a private collision plane.
b=roots['UD_ClothBolt_Spread']; p0=Vector((1.85,1.75,upper.ZF));p1=Vector((3.05,3.35,upper.ZF))
direction=(p1-p0).normalized();perp=Vector((-direction.y,direction.x,0));length=(p1-p0).length
bpy.ops.mesh.primitive_plane_add(size=12,location=(3,2,upper.ZF-.0002));floor=bpy.context.object
floor.name='Private cloth collider';floor.modifiers.new('Collision','COLLISION')
floor.collision.thickness_outer=.0008;floor.collision.thickness_inner=.0008
def loose(s,t):
    p=p0+direction*(length*t)+perp*((s-.5)*.4)
    p.z+=.002+.003*math.sin(s*13+t*18)*math.sin(math.pi*t)
    return tuple(p)
panel('Bolt_unrolled',b,6,24,loose,lambda s,t:t==1,(214,168,110),collision=True)
roll_mesh=bpy.data.meshes.new('Cotton winding'); verts=[];faces=[]
for j in range(7):
    for i in range(24):
        angle=i/24*math.tau;radius=.055+.0008*math.cos(angle*3+j)
        p=p1+perp*((j/6-.5)*.4)+direction*(radius*math.cos(angle))+Vector((0,0,.058+radius*math.sin(angle)))
        verts.append(tuple(p))
for j in range(6):
    for i in range(24):faces.append((j*24+i,j*24+(i+1)%24,(j+1)*24+(i+1)%24,(j+1)*24+i))
# End annuli and inner surface close the winding around the retained source core.
for end,sign in [(0,-1),(6,1)]:
    start=len(verts)
    for i in range(24):
        angle=i/24*math.tau
        verts.append(tuple(p1+perp*(sign*.2)+direction*(.0163*math.cos(angle))+Vector((0,0,.058+.0163*math.sin(angle)))))
    for i in range(24):
        ring=(end*24+i,end*24+(i+1)%24,start+(i+1)%24,start+i)
        faces.append(ring if sign>0 else ring[::-1])
for i in range(24):faces.append((168+i,192+i,192+(i+1)%24,168+(i+1)%24))
roll_mesh.from_pydata(verts,[],faces);roll_mesh.update()
roll_bm=bmesh.new();roll_bm.from_mesh(roll_mesh)
bmesh.ops.recalc_face_normals(roll_bm,faces=roll_bm.faces[:])
roll_bm.to_mesh(roll_mesh);roll_bm.free();roll_mesh.update()
roll=bpy.data.objects.new('Bolt_cotton_roll',roll_mesh);scene.collection.objects.link(roll);roll.parent=b
roll_mesh.materials.append(normal_material);uv=roll_mesh.uv_layers.new(name='UVMap')
for face in roll_mesh.polygons:
    face.use_smooth=True
    for index in face.loop_indices:
        vi=roll_mesh.loops[index].vertex_index;uv.data[index].uv=(min(vi//24,6)/6*.4/.12,vi%24/24*math.tau*.055/.12)
attr=roll_mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
for datum in attr.data:datum.color=(*[linear(c) for c in (226,214,184)],1)
# Original winding edges and a few short fibres: geometry, not painted lines.
detail=upper.Node('UD_Bolt_winding_fibres_v2',tags='A: inferred winding and short cotton fibres')
for sign in [-1,1]:
    points=[]
    for i in range(33):
        theta=i/32*math.tau*2.75;r=.018+( .055-.018)*i/32
        points.append(p1+perp*(sign*.201)+direction*(r*math.cos(theta))+Vector((0,0,.058+r*math.sin(theta))))
    detail.tube(points,.00045,3,'cloth',(196,182,150),caps=False)
for i in range(10):
    p=p0+perp*((i/9-.5)*.4)+Vector((0,0,.003))
    detail.tube([p,p-direction*.005+Vector((0,0,.001)),p-direction*.011+Vector((0,0,-.001))],.00035,3,'cloth',(214,168,110),caps=False)
detail.finish(parent=b)
bpy.data.objects.remove(floor,do_unlink=True)

def triangles(root):
    total=0
    for o in [root,*root.children_recursive]:
        if o.type=='MESH':o.data.calc_loop_triangles();total+=len(o.data.loop_triangles)
    return total
receipt['replacementTriangles']=sum(triangles(r) for r in roots.values())
receipt['oldClothTriangles']=4612
receipt['maxActiveInteriorWithPetals']=146554-4612+receipt['replacementTriangles']
assert receipt['maxActiveInteriorWithPetals']<=150000,receipt
bpy.ops.object.select_all(action='DESELECT')
for root in roots.values():
    for obj in [root,*root.children_recursive]:obj.select_set(True)
    parent=root.parent
    while parent:parent.select_set(True);parent=parent.parent
file=out/'upper-cloth-v2.glb'
bpy.ops.export_scene.gltf(filepath=str(file),export_format='GLB',use_selection=True,export_extras=True,export_lights=False,export_cameras=False,export_tangents=True,export_attributes=True,export_vertex_color='ACTIVE')
receipt['tangentRepair']=repair_export_tangents(file);receipt['bytes']=file.stat().st_size
(out/'receipt.json').write_text(json.dumps(receipt,indent=2),encoding='utf8')
print('CLOTH118',json.dumps(receipt),flush=True)
