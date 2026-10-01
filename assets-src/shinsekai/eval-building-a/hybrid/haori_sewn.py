"""Original connected garment pattern for the optional118 cloth derivative.

Shared shoulder/armhole vertices are physical mesh joints, not painted seams.
Dimensions/colours and mounting remain inferred. The source rail stays intact.
"""
import math
import bpy, bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def build(root,zf,material,receipt,hat_collision=False,rail_collision=False,bending_stiffness=2):
    assert not rail_collision or hat_collision,'Rail contact requires the retained hat comparison'
    assert math.isfinite(bending_stiffness) and bending_stiffness>0,'Invalid bending stiffness'
    vertices=[];faces=[];colours=[]
    def vertex(p):
        vertices.append(tuple(p));return len(vertices)-1
    def quad(v,colour=(38,44,66)):
        faces.append(tuple(v));colours.append(colour)
    def grid(rows,cols,position,existing=None,colour=(38,44,66)):
        ids=[]
        for j in range(rows+1):
            ids.append([existing(j,i) if existing and existing(j,i) is not None else vertex(position(j,i)) for i in range(cols+1)])
        for j in range(rows):
            for i in range(cols):quad([ids[j][i],ids[j][i+1],ids[j+1][i+1],ids[j+1][i]],colour)
        return ids

    # Two retained pegs have their widest head ring at x.284, radius.016.
    # The midsurface rests .6mm above that ring before1.2mm solidification.
    top=zf+1.44+.0166;rows=12
    left=[1.955,1.97,2.03,2.085,2.14]
    right=[2.23,2.28,2.32,2.37,2.415]
    ys=left+right
    def body(j,i,x,values,side=0):
        t=j/rows;y=values[i]
        if side<0:y+=.04*t*i/4
        if side>0:y-=.04*t*(1-i/4)
        return (x+.015*math.sin(17*i/(len(values)-1))*t,y,top-.78*t)
    back=grid(rows,9,lambda j,i:body(j,i,.255,ys))
    frontL=grid(rows,4,lambda j,i:body(j,i,.325,left,-1))
    frontR=grid(rows,4,lambda j,i:body(j,i,.325,right,1))
    mids={}
    for front,offset in [(frontL,0),(frontR,5)]:
        middle=[vertex((.284,ys[offset+i],top)) for i in range(5)]
        mids[offset]=middle
        for i in range(4):
            quad([back[0][offset+i],back[0][offset+i+1],middle[i+1],middle[i]])
            quad([middle[i],middle[i+1],front[0][i+1],front[0][i]])
    pinned=[mids[0][1],mids[5][2]]
    expected=[Vector(vertices[i]) for i in pinned]

    # Each sleeve has front and back fabric, a connected shoulder, an underarm
    # seam and an open wrist. Its inner rows reuse the body's armhole vertices.
    for sign,front,fi,bi,mi in [(-1,frontL,0,0,mids[0][0]),(1,frontR,4,9,mids[5][4])]:
        sides=[]
        for bodyIds,index in [(back,bi),(front,fi)]:
            def position(j,i,bodyIds=bodyIds,index=index):
                p=Vector(vertices[bodyIds[j][index]])
                p.x+=.04*math.sin(math.pi*j/6)*i/4
                p.y+=sign*.20*i/4;p.z-=.035*i/4
                return tuple(p)
            sides.append(grid(6,4,position,lambda j,i,bodyIds=bodyIds,index=index:bodyIds[j][index] if i==0 else None,(34,40,60)))
        sb,sf=sides
        middle=[mi]+[vertex((Vector(vertices[sb[0][i]])+Vector(vertices[sf[0][i]]))*.5) for i in range(1,5)]
        for i in range(4):
            quad([sb[0][i],sb[0][i+1],middle[i+1],middle[i]],(34,40,60))
            quad([middle[i],middle[i+1],sf[0][i+1],sf[0][i]],(34,40,60))
            quad([sb[6][i+1],sb[6][i],sf[6][i],sf[6][i+1]],(34,40,60))
        for j in range(6,rows):quad([back[j][bi],back[j+1][bi],front[j+1][fi],front[j][fi]])

    # A folded lapel continues each front opening edge. The extension turns
    # back over the garment; it shares the seam instead of floating separately.
    for sign,front,index in [(-1,frontL,4),(1,frontR,0)]:
        def collar(j,i,front=front,index=index,sign=sign):
            p=Vector(vertices[front[j][index]])
            p.y+=sign*.025*i/2;p.x+=.013*math.sin(math.pi*i/3)
            return tuple(p)
        grid(8,2,collar,lambda j,i,front=front,index=index:front[j][index] if i==0 else None,(90,92,108))

    # The default pattern starts through the hat. Preserve front/back spacing
    # while translating the local overlap region before collision settlement;
    # otherwise a thin collider cannot reliably resolve an initial penetration.
    initialHatShift=0.0
    if hat_collision:
        hatVertices=[]
        for face in root.data.polygons:
            if root.data.materials[face.material_index].name.startswith('UD_wood_raw'):
                hatVertices.extend(root.data.vertices[i].co for i in face.vertices)
        assert hatVertices,'Missing source hat bounds'
        hiY=max(p.y for p in hatVertices);loZ=min(p.z for p in hatVertices);hiZ=max(p.z for p in hatVertices)
        for i,p in enumerate(vertices):
            if i in pinned:continue
            yWeight=max(0.0,min(1.0,(hiY+.05-p[1])/.05))
            zWeight=max(0.0,min(1.0,(p[2]-loZ+.03)/.03,(hiZ+.03-p[2])/.03))
            shift=.12*yWeight*zWeight
            vertices[i]=(p[0]+shift,p[1],p[2]);initialHatShift=max(initialHatShift,shift)

    initialRailShift=0.0
    if rail_collision:
        # Source post occupies x.18-.30/y2.45-2.57. Clear its initial sleeve
        # overlap before adding its collision faces. The back layer initially
        # crosses the peg shafts below their heads; bring the shoulder forward
        # before settlement. Fixed pins stay exact and retain their head contact.
        for i,p in enumerate(vertices):
            if i in pinned:continue
            post=.07*max(0.0,min(1.0,(p[1]-2.37)/.06))
            shoulder=max(0.0,min(1.0,(p[2]-(zf+1.44-.08))/.06))
            shift=max(post,.065*shoulder)
            vertices[i]=(p[0]+shift,p[1],p[2]);initialRailShift=max(initialRailShift,shift)

    mesh=bpy.data.meshes.new('Haori connected pattern');mesh.from_pydata(vertices,[],faces);mesh.update()
    mesh.materials.append(material)
    uv=mesh.uv_layers.new(name='UVMap')
    attr=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    # Adding an attribute reallocates Blender custom-data layers. Reacquire
    # handles after all layers exist before writing either UVs or RGB values.
    uv=mesh.uv_layers['UVMap'];attr=mesh.color_attributes['Color']
    def linear(c):
        c=c/255;return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
    for face,colour in zip(mesh.polygons,colours):
        # Original metric mapping, with dominant face projection; no image use.
        normal=face.normal;drop=max(range(3),key=lambda k:abs(normal[k]));axes=[k for k in range(3) if k!=drop]
        for li in face.loop_indices:
            p=mesh.vertices[mesh.loops[li].vertex_index].co
            uv.data[li].uv=(p[axes[0]]/.12,p[axes[1]]/.12)
            attr.data[li].color=(*[linear(c) for c in colour],1)
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces[:])
    assert all(len(e.link_faces) in [1,2] for e in bm.edges),'Nonmanifold midsurface'
    bm.to_mesh(mesh);bm.free()
    obj=bpy.data.objects.new('Haori_connected',mesh);bpy.context.scene.collection.objects.link(obj);obj.parent=root
    group=obj.vertex_groups.new(name='Actual peg-head attachments');group.add(pinned,1,'REPLACE')
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    # A neighbouring hat is behind the garment in this fixed arrangement.
    # The default keeps collision on two actual support pegs. The opt-in hat
    # trial uses the same stiffness/mass and retains source hardware unchanged.
    root.data.calc_loop_triangles();supportFaces=[];hatFaces=[];railFaces=[]
    for tri in root.data.loop_triangles:
        points=[root.data.vertices[i].co for i in tri.vertices]
        centre=sum(points,Vector())/3
        if .20<=centre.x<=.30 and abs(centre.z-(zf+1.44))<=.025 and min(abs(centre.y-y) for y in [1.97,2.32])<.024:
            supportFaces.append(tuple(tri.vertices))
        if hat_collision and root.data.materials[tri.material_index].name.startswith('UD_wood_raw'):
            hatFaces.append(tuple(tri.vertices))
        if rail_collision and root.data.materials[tri.material_index].name=='UD_wood':
            railFaces.append(tuple(tri.vertices))
    assert supportFaces,'Missing retained peg collider'
    if hat_collision:assert hatFaces,'Missing retained hat collider'
    supportVertices=[v.co.copy() for v in root.data.vertices]
    colliderFaces=(railFaces if rail_collision else supportFaces)+hatFaces
    structureFaces=0
    if rail_collision:
        bpy.context.view_layer.update()
        structure=bpy.data.objects['BldgA_Interior_Structure'];structure.data.calc_loop_triangles()
        transform=root.matrix_world.inverted()@structure.matrix_world
        lo=[min(p[k] for p in vertices)-.02 for k in range(3)];hi=[max(p[k] for p in vertices)+.02 for k in range(3)]
        for tri in structure.data.loop_triangles:
            if not structure.data.materials[tri.material_index].name.startswith('M_Timber_Natural'):continue
            points=[transform@structure.data.vertices[i].co for i in tri.vertices]
            if any(max(p[k] for p in points)<lo[k] or min(p[k] for p in points)>hi[k] for k in range(3)):continue
            start=len(supportVertices);supportVertices.extend(points);colliderFaces.append((start,start+1,start+2));structureFaces+=1
        assert railFaces and structureFaces,'Missing retained rail or neighbouring post'
    supportMesh=bpy.data.meshes.new('Private retained peg collision')
    supportMesh.from_pydata(supportVertices,[],colliderFaces);supportMesh.update()
    initialColliderPairs=None;initialByCollider={}
    if rail_collision:
        initialTree=BVHTree.FromPolygons([Vector(p) for p in vertices],faces)
        colliderTree=BVHTree.FromPolygons(supportVertices,colliderFaces,all_triangles=True)
        initialPairs=initialTree.overlap(colliderTree);initialColliderPairs=len(initialPairs)
        for i,j in initialPairs:
            if j>=len(railFaces)+len(hatFaces):label='structure post'
            elif j>=len(railFaces):label='hat'
            else:
                y=sum(supportVertices[k].y for k in colliderFaces[j])/3
                label='peg '+str(min([1.76,1.97,2.18,2.32],key=lambda p:abs(y-p)))
            initialByCollider[label]=initialByCollider.get(label,0)+1
    support=bpy.data.objects.new('Private retained peg collision',supportMesh);scene=bpy.context.scene
    scene.collection.objects.link(support);support.parent=root;support.modifiers.new('Support collision','COLLISION')
    support.collision.thickness_outer=.0006;support.collision.thickness_inner=.0006
    modifier=obj.modifiers.new('Connected garment settlement','CLOTH')
    s=modifier.settings;s.quality=10;s.mass=.008;s.air_damping=5
    s.tension_stiffness=60;s.compression_stiffness=60;s.shear_stiffness=40;s.bending_stiffness=bending_stiffness
    s.vertex_group_mass=group.name;s.pin_stiffness=1
    collisionDistance=.0024 if rail_collision else .0006
    modifier.collision_settings.use_collision=True;modifier.collision_settings.distance_min=collisionDistance
    if rail_collision:modifier.collision_settings.collision_quality=6
    collisionQuality=modifier.collision_settings.collision_quality
    modifier.collision_settings.use_self_collision=True;modifier.collision_settings.self_distance_min=.002
    modifier.point_cache.frame_start=1;modifier.point_cache.frame_end=32
    scene=bpy.context.scene
    for frame in range(1,33):scene.frame_set(frame);bpy.context.view_layer.update()
    evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    settled=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=bpy.context.evaluated_depsgraph_get())
    maxShift=max((v.co-Vector(p)).length for v,p in zip(settled.vertices,vertices))
    pinError=max((settled.vertices[i].co-p).length for i,p in zip(pinned,expected))
    assert pinError<1e-6,('Pin drift',pinError)
    # Fixed attachments are compared to retained source hardware triangles.
    root.data.calc_loop_triangles()
    tree=BVHTree.FromPolygons([v.co for v in root.data.vertices],[tuple(t.vertices) for t in root.data.loop_triangles],all_triangles=True)
    contact=[tree.find_nearest(settled.vertices[i].co)[3] for i in pinned]
    assert all(d<.0013 for d in contact),('Unsupported pin',contact)
    obj.modifiers.clear();obj.data=settled;bpy.data.objects.remove(support,do_unlink=True)
    thick=obj.modifiers.new('Inferred woven body1.2mm','SOLIDIFY');thick.thickness=.0012;thick.offset=0;thick.use_even_offset=True
    bpy.ops.object.modifier_apply(modifier=thick.name)
    obj.data.calc_loop_triangles()
    hatOverlaps=None
    if hat_collision:
        hatTree=BVHTree.FromPolygons([v.co for v in root.data.vertices],hatFaces,all_triangles=True)
        garmentTree=BVHTree.FromPolygons([v.co for v in obj.data.vertices],[tuple(t.vertices) for t in obj.data.loop_triangles],all_triangles=True)
        hatOverlaps=len(garmentTree.overlap(hatTree))
    bm=bmesh.new();bm.from_mesh(obj.data)
    assert all(len(e.link_faces)==2 for e in bm.edges),'Open/thickened garment'
    unseen=set(bm.verts);components=0
    while unseen:
        components+=1;stack=[unseen.pop()]
        while stack:
            for edge in stack.pop().link_edges:
                for v in edge.verts:
                    if v in unseen:unseen.remove(v);stack.append(v)
    assert components==1,('Disconnected garment',components)
    bm.free()
    for f in obj.data.polygons:f.use_smooth=True
    obj['sourceTags']='A: connected original haori pattern;32-frame cloth simulation; inferred1.2mm fabric and peg mounting'
    record=dict(name=obj.name,frames=32,quality=10,pinnedVertices=len(pinned),vertices=len(vertices),
        maxDisplacementMetres=maxShift,closedBodyThickness=.0012,connectedComponents=components,
        allThickenedEdgesHaveTwoFaces=True,pinDisplacementMetres=pinError,pinHardwareDistancesMetres=contact,
        settings=dict(mass=.008,airDamping=5,tension=60,compression=60,shear=40,bending=bending_stiffness),
        colliderTriangles=len(colliderFaces),
        supportScope=('Two fixed attachment points, retained pegs and hat surface; chin cord excluded; discrete final surface check only' if hat_collision else 'Two fixed attachment points and retained-peg collider only; neighbouring hat excluded; not whole garment collision or physical mounting certification'))
    if hat_collision:record.update(hatColliderTriangles=len(hatFaces),finalHatSurfaceTriangleOverlaps=hatOverlaps,initialHatClearanceShiftMetres=initialHatShift)
    if rail_collision:record.update(railColliderTriangles=len(railFaces),structureColliderTriangles=structureFaces,initialRailClearanceShiftMetres=initialRailShift,initialColliderMidsurfacePairs=initialColliderPairs,initialColliderPairsByPart=initialByCollider,collisionDistanceMetres=collisionDistance,collisionQuality=collisionQuality,supportScope='Retained rail/four pegs/hat and bounded neighbouring timber post; chin cord excluded. Final exported surface audit still required.')
    receipt['simulation'].append(record);receipt['connectedHaori']=record
    obj.select_set(False);scene.frame_set(1)
    print('SEWN_HAORI',record,flush=True)
    return obj
