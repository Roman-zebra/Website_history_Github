"""Independent Blender profile/floor/neighbour check; GLB,new folder,gap arguments."""
import bpy,bmesh,json,hashlib,sys
from pathlib import Path
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:];candidate=Path(args[0]).resolve();folder=Path(args[1]).resolve();gap=float(args[2])
assert gap in (.022,.04) and candidate.is_file() and not folder.exists();folder.mkdir()
source=folder.parent.parent/'upper-cushion-119-004/interior-cushion-g035.glb';sourcehash=hashlib.sha256(source.read_bytes()).hexdigest();assert sourcehash=='e50d117a0249d3d5cc6478c139ef8366d47fc511052531aad9f0862c7bd68b7d'
def select(ob):
    ids=[];verts=[];faces=[]
    for f in ob.data.polygons:
        if ob.data.materials[f.material_index].name!='CLOTH':continue
        ps=[ob.matrix_world@ob.data.vertices[i].co for i in f.vertices]
        if not all(2.79<p.x<3.61 and 4.80<p.y<5.63 and 3.45<p.z<3.54 for p in ps):continue
        ids.append(f.index);start=len(verts);verts.extend(ps);faces.append(tuple(range(start,start+len(ps))))
    assert len(faces)==240,len(faces)
    return ids,verts,faces
def examine(verts,faces):
    mesh=bpy.data.meshes.new('Coordinate welded profile');mesh.from_pydata(verts,[],faces);mesh.update();bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-5)
    assert all(len(e.link_faces)==2 for e in bm.edges),'Open cushion';volume=bm.calc_volume(signed=True);assert volume>0
    pending=set(bm.faces);components=[]
    while pending:
        seed=pending.pop();seen={seed};front=[seed]
        while front:
            f=front.pop()
            for e in f.edges:
                for n in e.link_faces:
                    if n not in seen:seen.add(n);pending.discard(n);front.append(n)
        components.append(seen)
    assert sorted(len(c) for c in components)==[12,12,12,12,192]
    body=[list(v.co) for v in {v for f in next(c for c in components if len(c)==192) for v in f.verts}]
    patches=sorted(tuple(round(n,7) for n in v.co) for c in components if len(c)==12 for v in {v for f in c for v in f.verts})
    bm.free();bpy.data.meshes.remove(mesh);return body,patches,volume
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source));bpy.context.view_layer.update();_,sv,sf=select(bpy.data.objects['Hybrid_Sonnet_upper']);sbody,spatches,_=examine(sv,sf)
xy=lambda p:(round(p[0],6),round(p[1],6))
perimeter={xy(p) for p in sbody if any(abs(p[2]-(3.455+h))<1e-6 for h in (.04,.043))};assert len(perimeter)==24,len(perimeter)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(candidate));bpy.context.view_layer.update();ob=bpy.data.objects['Hybrid_Sonnet_upper'];ids,verts,faces=select(ob);body,patches,volume=examine(verts,faces)
assert sorted(xy(p) for p in sbody)==sorted(xy(p) for p in body),'Horizontal contour changed';assert patches==spatches,'Source corner patches changed'
bottom=min(p[2] for p in body);top=max(p[2] for p in body);assert abs(bottom-3.455)<1e-6 and abs(top-3.535)<1e-6
edge=[p[2]-3.455 for p in body if xy(p) in perimeter];assert len(edge)==48,len(edge)
assert all(min(abs(z-(.0415-gap/2)),abs(z-(.0415+gap/2)))<1e-6 for z in edge);actualgap=max(edge)-min(edge);assert abs(actualgap-gap)<1e-6
assert sorted(tuple(round(n,7) for n in p) for p in sbody if abs(p[2]-3.455)<1e-6)==sorted(tuple(round(n,7) for n in p) for p in body if abs(p[2]-3.455)<1e-6),'Floor patch changed'
ct=BVHTree.FromPolygons(verts,faces);hits={};floorpairs=[]
for other in bpy.context.scene.objects:
    if other.type!='MESH' or other==ob:continue
    other.data.calc_loop_triangles();tris=list(other.data.loop_triangles);ps=[other.matrix_world@v.co for v in other.data.vertices];pairs=ct.overlap(BVHTree.FromPolygons(ps,[tuple(t.vertices) for t in tris],all_triangles=True))
    if not pairs:continue
    hits[other.name]=len(pairs);assert other.name=='BldgA_Interior_Structure',hits
    for _,b in pairs:
        t=tris[b];f=other.data.polygons[t.polygon_index];normal=(other.matrix_world.to_3x3().inverted().transposed()@f.normal).normalized()
        assert other.data.materials[f.material_index].name=='M_Timber_Natural' and abs(normal.z-1)<1e-5 and all(abs(ps[i].z-3.455)<1e-6 for i in t.vertices),'Non-floor contact'
    floorpairs=pairs
assert floorpairs
ob.data.calc_loop_triangles();excluded=set(ids);neighbours=[tuple(t.vertices) for t in ob.data.loop_triangles if t.polygon_index not in excluded];internal=len(ct.overlap(BVHTree.FromPolygons([ob.matrix_world@v.co for v in ob.data.vertices],neighbours,all_triangles=True)));assert internal==0,internal
def snapshot():
    return {o.name:{'matrix':[list(r) for r in o.matrix_world],'vertices':[list(v.co) for v in o.data.vertices] if o.type=='MESH' else None,'faces':[list(f.vertices) for f in o.data.polygons] if o.type=='MESH' else None,'uv':[[list(p.uv) for p in layer.data] for layer in o.data.uv_layers] if o.type=='MESH' else None,'colours':{a.name:[list(v.color) for v in a.data] for a in o.data.color_attributes} if o.type=='MESH' else None,'materials':[m.name for m in o.data.materials] if o.type=='MESH' else None} for o in bpy.context.scene.objects}
before=snapshot();bpy.ops.wm.save_as_mainfile(filepath=str(folder/'candidate.blend'));bpy.ops.wm.open_mainfile(filepath=str(folder/'candidate.blend'));assert before==snapshot();assert hashlib.sha256(source.read_bytes()).hexdigest()==sourcehash
r={'candidateSHA256':hashlib.sha256(candidate.read_bytes()).hexdigest(),'sourceSHA256':sourcehash,'blender':bpy.app.version_string,'selectedTriangles':240,'bodyTriangles':192,'closedCoordinateWeldedEdges':True,'signedVolumeM3':volume,'minimumZ':bottom,'maximumZ':top,'actualPerimeterGapMetres':actualgap,'edgeBottomTopMetres':[min(edge),max(edge)],'horizontalContourMatchSource':True,'originalCornerPatchesEqual':True,'floorPatchEqual':True,'otherObjectSurfacePairs':hits,'allStructuralPairsExistingWoodenFloorTop':True,'otherMergedDressingSurfacePairs':internal,'sourceUnchanged':True,'savedSceneReopenEqual':True,'snapshotScope':'Geometry/UV/colour/material names/world matrices; not all shader/cache settings','method':'Coordinate weld1e-5m, discrete triangle surface contacts, not containment/continuous certification. Four original source seam patches internally overlap body; no cloth simulation or native acceptance.','nativeVerified':False,'phoneMeasured':False}
(folder/'authoring-receipt.json').write_text(json.dumps(r,indent=2),encoding='utf-8');print('PERIMETER',json.dumps(r),flush=True)
