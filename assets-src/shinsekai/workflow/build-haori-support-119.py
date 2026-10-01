"""Private numbered119 support construction; frozen cloth asset stays read-only."""
import bpy,bmesh,math,json,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
REPO=Path(__file__).resolve().parents[3]
OUT=REPO.parent/'research-cache'/'haori-support-119-001'
OUT.mkdir(exist_ok=True)
assert not (OUT/'authoring.blend').exists(),'Preserve numbered candidate; choose a new output revision'
SOURCE=REPO/'assets-src/shinsekai/eval-building-a/hybrid/runtime/upper-cloth-v2-sewn-rail.glb'
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()=='7240ebf2851bc40a80e5bb2fc95644b2c4f372a08935a597d8c04f730f0b0f30'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
old=bpy.data.objects['Haori_connected'];root=old.parent
material=old.data.materials[0]
bpy.data.objects.remove(old,do_unlink=True)
verts=[];faces=[];colours=[];pins=[]
def vertex(p):verts.append(tuple(p));return len(verts)-1
def quad(v,c=(38,44,66)):faces.append(tuple(v));colours.append(c)
def grid(nr,nc,pos,reuse=None,c=(38,44,66)):
    ids=[]
    for j in range(nr+1):
        line=[]
        for i in range(nc+1):
            value=reuse(j,i) if reuse else None
            line.append(value if value is not None else vertex(pos(j,i)))
        ids.append(line)
    for j in range(nr):
        for i in range(nc):quad([ids[j][i],ids[j][i+1],ids[j+1][i+1],ids[j+1][i]],c)
    return ids
barx,barz,radius=.45,4.87,.0135
rows=8;left=[1.955+i*.185/6 for i in range(7)];right=[2.23+i*.185/6 for i in range(7)];ys=left+right
def body(j,i,values,front):
    t=j/rows;y=values[i]
    fold=.011*math.sin(math.tau*4*(y-1.955)/.46)*math.sin(math.pi*t/2)
    x=barx+(1 if front else -1)*(radius+.042*math.sin(math.pi*t*.75))+fold
    if j==rows:x+=(-1 if front else 1)*.012
    return x,y,barz-.78*t+(.006 if j==rows else 0)
back=grid(rows,13,lambda j,i:body(j,i,ys,False))
fl=grid(rows,6,lambda j,i:body(j,i,left,True));fr=grid(rows,6,lambda j,i:body(j,i,right,True))
wraps={}
for front,offset in [(fl,0),(fr,7)]:
    wrap=[]
    for k in range(7):
        theta=math.pi-k*math.pi/6
        line=[]
        for i in range(7):
            value=back[0][offset+i] if k==0 else front[0][i] if k==6 else vertex((barx+radius*math.cos(theta),ys[offset+i],barz+radius*math.sin(theta)))
            line.append(value);pins.append(value)
        wrap.append(line)
    for k in range(6):
        for i in range(6):quad([wrap[k][i],wrap[k][i+1],wrap[k+1][i+1],wrap[k+1][i]])
    wraps[offset]=wrap
for sign,front,fi,bi,offset in [(-1,fl,0,0,0),(1,fr,6,13,7)]:
    sides=[]
    for bodyids,idx,isfront in [(back,bi,False),(front,fi,True)]:
        def position(j,i,bodyids=bodyids,idx=idx,isfront=isfront):
            p=Vector(verts[bodyids[j][idx]]);u=i/4;t=j/4
            p.y+=sign*.20*u
            p.z-=.11*math.sin(math.pi*u/2)*t
            p.x+=(1 if isfront else -1)*.025*math.sin(math.pi*t)*u
            return p
        sides.append(grid(4,4,position,lambda j,i,bodyids=bodyids,idx=idx:bodyids[j][idx] if i==0 else None,c=(34,40,60)))
    sb,sf=sides;sw=[]
    edge=0 if sign<0 else 6
    for k in range(7):
        theta=math.pi-k*math.pi/6
        line=[]
        for i in range(5):
            value=wraps[offset][k][edge] if i==0 else sb[0][i] if k==0 else sf[0][i] if k==6 else vertex((barx+radius*math.cos(theta),ys[bi]+sign*.2*i/4,barz+radius*math.sin(theta)))
            line.append(value);pins.append(value)
        sw.append(line)
    for k in range(6):
        for i in range(4):quad([sw[k][i],sw[k][i+1],sw[k+1][i+1],sw[k+1][i]],(34,40,60))
    for i in range(4):quad([sb[4][i+1],sb[4][i],sf[4][i],sf[4][i+1]],(34,40,60))
    for j in range(4,rows):quad([back[j][bi],back[j+1][bi],front[j+1][fi],front[j][fi]])
for sign,front,index in [(-1,fl,6),(1,fr,0)]:
    def collar(j,i,front=front,index=index,sign=sign):
        p=Vector(verts[front[j][index]]);p.y+=sign*.025*i/3;p.x+=.010*math.sin(math.pi*i/3)
        return p
    grid(5,3,collar,lambda j,i,front=front,index=index:front[j][index] if i==0 else None,c=(90,92,108))
mesh=bpy.data.meshes.new('Haori119 supported pattern');mesh.from_pydata(verts,[],faces);mesh.update();mesh.materials.append(material)
mesh.uv_layers.new(name='UVMap');mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
uv=mesh.uv_layers['UVMap'];color=mesh.color_attributes['Color']
def linear(v):v=v/255;return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
for f,c in zip(mesh.polygons,colours):
    axes=[k for k in range(3) if k!=max(range(3),key=lambda k:abs(f.normal[k]))]
    for li in f.loop_indices:
        p=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(p[axes[0]]/.12,p[axes[1]]/.12);color.data[li].color=(*map(linear,c),1)
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces[:]);assert all(len(e.link_faces) in [1,2] for e in bm.edges);bm.to_mesh(mesh);bm.free()
garment=bpy.data.objects.new('Haori_connected',mesh);bpy.context.scene.collection.objects.link(garment)
pins=sorted(set(pins));group=garment.vertex_groups.new(name='Bamboo-supported wrap');group.add(pins,1,'REPLACE')
supports=[]
def tube(name,points,r,mat,colour,sides=12):
    points=list(map(Vector,points));v=[];f=[]
    direction=(points[-1]-points[0]).normalized();u=direction.cross(Vector((0,0,1)))
    if u.length<.001:u=direction.cross(Vector((0,1,0)))
    u.normalize();w=direction.cross(u).normalized()
    for p in points:
        for i in range(sides):v.append(tuple(p+r*(u*math.cos(math.tau*i/sides)+w*math.sin(math.tau*i/sides))))
    for j in range(len(points)-1):
        for i in range(sides):f.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
    f.extend([tuple(range(sides-1,-1,-1)),tuple((len(points)-1)*sides+i for i in range(sides))])
    me=bpy.data.meshes.new(name);me.from_pydata(v,[],f);me.update();me.materials.append(mat)
    me.uv_layers.new(name='UVMap');me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for poly in me.polygons:
        poly.use_smooth=len(poly.vertices)==4
        for li in poly.loop_indices:
            vi=me.loops[li].vertex_index;me.uv_layers['UVMap'].data[li].uv=(vi%sides/sides,vi//sides*(points[-1]-points[0]).length/.25)
            me.color_attributes['Color'].data[li].color=(*map(linear,colour),1)
    ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob);supports.append(ob);return ob
bar=tube('Haori119_bamboo',[(barx,1.72,barz),(barx,2.65,barz)],.012,bpy.data.materials['UD_bamboo'],(172,150,94))
for i,y in enumerate([1.97,2.32]):tube('Haori119_cord_'+str(i),[(.284,y,4.90),(barx,y,barz+.014)],.002,bpy.data.materials['UD_cord'],(142,120,90),8)
# Retained neighbouring hardware and the added physical bamboo are colliders.
colliderverts=[];colliderfaces=[]
for ob in [root,bar]:
    ob.data.calc_loop_triangles()
    for tri in ob.data.loop_triangles:
        start=len(colliderverts);colliderverts.extend([ob.matrix_world@ob.data.vertices[i].co for i in tri.vertices]);colliderfaces.append((start,start+1,start+2))
collidermesh=bpy.data.meshes.new('Private119 hardware collider');collidermesh.from_pydata(colliderverts,[],colliderfaces);collidermesh.update()
collider=bpy.data.objects.new('Private119 hardware collider',collidermesh);bpy.context.scene.collection.objects.link(collider);collider.modifiers.new('Collision','COLLISION');collider.collision.thickness_outer=.0006;collider.collision.thickness_inner=.0006
tree=BVHTree.FromPolygons(colliderverts,colliderfaces,all_triangles=True)
initialpairs=len(BVHTree.FromPolygons(list(map(Vector,verts)),faces).overlap(tree));assert initialpairs==0,initialpairs
bpy.ops.object.select_all(action='DESELECT');garment.select_set(True);bpy.context.view_layer.objects.active=garment
cloth=garment.modifiers.new('119 supported cloth settlement','CLOTH');s=cloth.settings;s.quality=10;s.mass=.008;s.air_damping=5;s.tension_stiffness=60;s.compression_stiffness=60;s.shear_stiffness=40;s.bending_stiffness=.6;s.vertex_group_mass=group.name;s.pin_stiffness=1
cloth.collision_settings.use_collision=True;cloth.collision_settings.distance_min=.001;cloth.collision_settings.collision_quality=6;cloth.collision_settings.use_self_collision=True;cloth.collision_settings.self_distance_min=.002;cloth.point_cache.frame_start=1;cloth.point_cache.frame_end=32
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'authoring.blend'))
for frame in range(1,33):bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get();settled=bpy.data.meshes.new_from_object(garment.evaluated_get(deps),preserve_all_data_layers=True,depsgraph=deps)
pinerror=max((settled.vertices[i].co-Vector(verts[i])).length for i in pins);assert pinerror<1e-6
garment.modifiers.clear();garment.data=settled
solid=garment.modifiers.new('Fabric1.2mm','SOLIDIFY');solid.thickness=.0012;solid.offset=0;solid.use_even_offset=True;bpy.ops.object.modifier_apply(modifier=solid.name)
bm=bmesh.new();bm.from_mesh(garment.data);assert all(len(e.link_faces)==2 for e in bm.edges),'Open fabric';bm.free()
garment.data.calc_loop_triangles();finalpairs=len(BVHTree.FromPolygons([v.co for v in garment.data.vertices],[tuple(t.vertices) for t in garment.data.loop_triangles],all_triangles=True).overlap(tree))
for f in garment.data.polygons:f.use_smooth=True
bpy.data.objects.remove(collider,do_unlink=True)
garment['sourceTags']='A:119 inferred supported garment;32-frame local cloth;1.2mm fabric; original colour/material retained'
receipt={'round':'haori-support-119-001','sourceSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'initialHardwareSurfacePairs':initialpairs,'finalHardwareSurfacePairs':finalpairs,'pinDrift':pinerror,'pinnedVertices':len(pins),'clothTriangles':len(garment.data.loop_triangles),'newSupportTriangles':0,'geometryQualified':False,'visualQualified':False,'limitations':['Final discrete original hardware/bamboo check only; full interior post/wall audit still required','Final measured sag/folds/collar and native comparisons pending','Material sheen/wall AO fixed for this shape round']}
for ob in supports:ob.data.calc_loop_triangles();receipt['newSupportTriangles']+=len(ob.data.loop_triangles)
bpy.ops.object.select_all(action='DESELECT')
for ob in [garment,*supports]:ob.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'settled.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'replacement.glb'),export_format='GLB',use_selection=True,export_extras=True,export_tangents=True,export_vertex_color='ACTIVE')
(OUT/'receipt.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8');print('HAORI119',json.dumps(receipt),flush=True)
