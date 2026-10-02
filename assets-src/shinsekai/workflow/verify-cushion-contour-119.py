"""Independent Blender check; arguments: candidate GLB, new output directory."""
import bpy,bmesh,json,hashlib,sys
from pathlib import Path
from mathutils.bvhtree import BVHTree

args=sys.argv[sys.argv.index('--')+1:];candidate=Path(args[0]).resolve();folder=Path(args[1]).resolve()
assert candidate.is_file() and not folder.exists();folder.mkdir()
source=folder.parent.parent/'cabinet-ink-119-001/interior-cabinet.glb'
sourcehash=hashlib.sha256(source.read_bytes()).hexdigest();assert sourcehash=='09a0e26d91da8775e29f32cb9967f348f7f519b0df7bfc317fa333445c583397'
def select(ob):
    ids=[];verts=[];faces=[]
    for face in ob.data.polygons:
        if ob.data.materials[face.material_index].name!='CLOTH':continue
        ps=[ob.matrix_world@ob.data.vertices[i].co for i in face.vertices]
        if not all(2.79<p.x<3.61 and 4.80<p.y<5.63 and 3.45<p.z<3.54 for p in ps):continue
        ids.append(face.index);start=len(verts);verts.extend(ps);faces.append(tuple(range(start,start+len(ps))))
    assert len(faces)==240,len(faces)
    return ids,verts,faces
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source));bpy.context.view_layer.update()
_,sourceverts,_=select(bpy.data.objects['Hybrid_Sonnet_upper']);sourceheights=sorted(round(p.z,7) for p in sourceverts)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(candidate));bpy.context.view_layer.update()
ob=bpy.data.objects['Hybrid_Sonnet_upper'];ids,verts,faces=select(ob)
assert sourceheights==sorted(round(p.z,7) for p in verts),'Changed elevation/seam profile'
mesh=bpy.data.meshes.new('Coordinate welded cushion check');mesh.from_pydata(verts,[],faces);mesh.update()
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-5)
assert all(len(e.link_faces)==2 for e in bm.edges),'Open contour';volume=bm.calc_volume(signed=True);assert volume>0
bottom=min(v.co.z for v in bm.verts);top=max(v.co.z for v in bm.verts)
assert abs(bottom-3.455)<1e-6 and abs(top-3.535)<1e-6
bm.free();bpy.data.meshes.remove(mesh)
ct=BVHTree.FromPolygons(verts,faces);hits={};floorpairs=[]
for other in bpy.context.scene.objects:
    if other.type!='MESH' or other==ob:continue
    other.data.calc_loop_triangles();tris=list(other.data.loop_triangles);ps=[other.matrix_world@v.co for v in other.data.vertices]
    pairs=ct.overlap(BVHTree.FromPolygons(ps,[tuple(t.vertices) for t in tris],all_triangles=True))
    if not pairs:continue
    hits[other.name]=len(pairs);assert other.name=='BldgA_Interior_Structure',hits
    for _,b in pairs:
        t=tris[b];face=other.data.polygons[t.polygon_index];normal=(other.matrix_world.to_3x3().inverted().transposed()@face.normal).normalized()
        assert other.data.materials[face.material_index].name=='M_Timber_Natural' and abs(normal.z-1)<1e-5 and all(abs(ps[i].z-3.455)<1e-6 for i in t.vertices),'Non-floor contact'
    floorpairs=pairs
assert floorpairs,'No floor support contacts'
ob.data.calc_loop_triangles();excluded=set(ids);neighbours=[tuple(t.vertices) for t in ob.data.loop_triangles if t.polygon_index not in excluded]
internal=len(ct.overlap(BVHTree.FromPolygons([ob.matrix_world@v.co for v in ob.data.vertices],neighbours,all_triangles=True)));assert internal==0,internal
def snapshot():
    return {o.name:{'matrix':[list(r) for r in o.matrix_world],'vertices':[list(v.co) for v in o.data.vertices] if o.type=='MESH' else None,'faces':[list(f.vertices) for f in o.data.polygons] if o.type=='MESH' else None,'uv':[[list(p.uv) for p in layer.data] for layer in o.data.uv_layers] if o.type=='MESH' else None,'colours':{a.name:[list(v.color) for v in a.data] for a in o.data.color_attributes} if o.type=='MESH' else None,'materials':[m.name for m in o.data.materials] if o.type=='MESH' else None} for o in bpy.context.scene.objects}
before=snapshot();bpy.ops.wm.save_as_mainfile(filepath=str(folder/'candidate.blend'));bpy.ops.wm.open_mainfile(filepath=str(folder/'candidate.blend'));assert before==snapshot()
assert hashlib.sha256(source.read_bytes()).hexdigest()==sourcehash
r={'candidateSHA256':hashlib.sha256(candidate.read_bytes()).hexdigest(),'sourceSHA256':sourcehash,'blender':bpy.app.version_string,'selectedTriangles':240,'closedCoordinateWeldedEdges':True,'signedVolumeM3':volume,'minimumZ':bottom,'maximumZ':top,'allSelectedElevationsMatchSource':True,'otherObjectSurfacePairs':hits,'allStructuralPairsExistingWoodenFloorTop':True,'otherMergedDressingSurfacePairs':internal,'sourceUnchanged':True,'savedSceneReopenEqual':True,'snapshotScope':'Geometry/UV/colour/material names/world matrices; not all shader/cache settings','method':'Coordinate weld1e-5m; discrete triangle surface contacts, not continuous/containment certification. Four original seam patches internally overlap body as in003. Inferred art deformation, no cloth simulation.','nativeVerified':False,'phoneMeasured':False}
(folder/'authoring-receipt.json').write_text(json.dumps(r,indent=2),encoding='utf-8');print('CONTOUR',json.dumps(r),flush=True)
