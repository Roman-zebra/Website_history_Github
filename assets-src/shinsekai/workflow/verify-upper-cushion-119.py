import bpy,bmesh,json,hashlib,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
folder=Path(__file__).resolve().parents[3].parent/'research-cache/upper-cushion-119-003';source=folder/'interior-cushion.glb';original=folder.parent.parent/'repo/assets-src/shinsekai/eval-building-a/hybrid/runtime/interior.glb';beforehash=hashlib.sha256(original.read_bytes()).hexdigest();assert beforehash=='a5c102f5c499eaca29a6dede27b5bf419c8296e1752ec1c88af281dee43bd935'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source));bpy.context.view_layer.update();ob=bpy.data.objects['Hybrid_Sonnet_upper'];verts=[];faces=[];sourcefaces=[]
for face in ob.data.polygons:
 if ob.data.materials[face.material_index].name!='CLOTH':continue
 ps=[ob.matrix_world@ob.data.vertices[i].co for i in face.vertices]
 if not all(2.79<p.x<3.61 and 4.80<p.y<5.63 and 3.45<p.z<3.54 for p in ps):continue
 start=len(verts);verts.extend(ps);faces.append(tuple(range(start,start+len(ps))));sourcefaces.append(face.index)
assert len(faces)==240,len(faces)
# Boundary elevations distinguish003 from the technically valid but thin002.
def grid(p):
 x=p.x-3.2;y=p.y-5.215;c=math.cos(.4);s=math.sin(.4);return ((x*c+y*s)/.55+.5,(y*c-x*s)/.55+.5)
bodypoints=[p for face in ob.data.polygons if face.index in sourcefaces for p in [ob.matrix_world@ob.data.vertices[i].co for i in face.vertices] if all(-1e-5<=v<=1+1e-5 for v in grid(p))]
boundary=[p.z for p in bodypoints if any(abs(v)<1e-5 or abs(v-1)<1e-5 for v in grid(p))];assert boundary and all(any(abs(z-h)<1e-6 for h in (3.495,3.498)) for z in boundary),'Unexpected seam profile'
mesh=bpy.data.meshes.new('Private welded cushion check');mesh.from_pydata(verts,[],faces);mesh.update();bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-5);assert all(len(e.link_faces)==2 for e in bm.edges),'Open cushion';assert bm.calc_volume(signed=True)>0
bottom=min(v.co.z for v in bm.verts);top=max(v.co.z for v in bm.verts);assert abs(bottom-3.455)<1e-6 and abs(top-3.535)<1e-6;volume=bm.calc_volume(signed=True);bm.free();bpy.data.meshes.remove(mesh)
# Exact triangle-pair surface contact test against all other source objects;
# floor supports intentionally touch, stitch patches within garment intentionally overlap.
ct=BVHTree.FromPolygons(verts,faces);hits={}
for other in bpy.context.scene.objects:
 if other.type!='MESH' or other==ob:continue
 other.data.calc_loop_triangles();ps=[other.matrix_world@v.co for v in other.data.vertices];fs=[tuple(t.vertices) for t in other.data.loop_triangles];pairs=ct.overlap(BVHTree.FromPolygons(ps,fs,all_triangles=True))
 if pairs:hits[other.name]=len(pairs)
assert set(hits).issubset({'BldgA_Interior_Structure'}),hits
# A node-name whitelist alone also permits intersections with the fusuma frame.
# Qualify every contact against the actual material, world normal and floor height.
floorob=bpy.data.objects['BldgA_Interior_Structure'];floorob.data.calc_loop_triangles();floortris=list(floorob.data.loop_triangles);floorps=[floorob.matrix_world@v.co for v in floorob.data.vertices];floortree=BVHTree.FromPolygons(floorps,[tuple(t.vertices) for t in floortris],all_triangles=True);floorpairs=ct.overlap(floortree);assert floorpairs
for a,b in floorpairs:
 t=floortris[b];face=floorob.data.polygons[t.polygon_index];normal=(floorob.matrix_world.to_3x3().inverted().transposed()@face.normal).normalized();assert floorob.data.materials[face.material_index].name=='M_Timber_Natural' and abs(normal.z-1)<1e-5 and all(abs(floorps[i].z-3.455)<1e-6 for i in t.vertices),'Non-floor contact'
# Verify surrounding dressing in SAME merged source mesh too.
ob.data.calc_loop_triangles();excluded=set(sourcefaces);tri=[t for t in ob.data.loop_triangles if t.polygon_index not in excluded];selfother=BVHTree.FromPolygons([ob.matrix_world@v.co for v in ob.data.vertices],[tuple(t.vertices) for t in tri],all_triangles=True);internal=len(ct.overlap(selfother));assert internal==0,internal
support=[];undersides=[];dg=bpy.context.evaluated_depsgraph_get()
for x,y in [(3.2,5.215),(3.05,5.065),(3.35,5.365),(3.05,5.365),(3.35,5.065)]:
 ok,p,n,i,hit,m=bpy.context.scene.ray_cast(dg,Vector((x,y,3.4549)),Vector((0,0,-1)),distance=.2);undersides.append({'hit':list(p) if ok else None,'normal':list(n) if ok else None,'object':hit.name if ok else None})
 floorob=bpy.data.objects['BldgA_Interior_Structure'];floorob.data.calc_loop_triangles();tree=BVHTree.FromPolygons([floorob.matrix_world@v.co for v in floorob.data.vertices],[tuple(t.vertices) for t in floorob.data.loop_triangles],all_triangles=True);p,n,i,d=tree.ray_cast(Vector((x,y,3.49)),Vector((0,0,-1)),.2);assert p and abs(p.z-3.455)<1e-6;support.append(list(p))
def snapshot():
 return {o.name:{'matrix':[list(r) for r in o.matrix_world],'vertices':[list(v.co) for v in o.data.vertices] if o.type=='MESH' else None,'faces':[list(f.vertices) for f in o.data.polygons] if o.type=='MESH' else None,'uv':[[list(p.uv) for p in layer.data] for layer in o.data.uv_layers] if o.type=='MESH' else None,'colours':{a.name:[list(v.color) for v in a.data] for a in o.data.color_attributes} if o.type=='MESH' else None,'materials':[m.name for m in o.data.materials] if o.type=='MESH' else None} for o in bpy.context.scene.objects}
before=snapshot()
if not (folder/'candidate.blend').exists():bpy.ops.wm.save_as_mainfile(filepath=str(folder/'candidate.blend'))
bpy.ops.wm.open_mainfile(filepath=str(folder/'candidate.blend'));assert before==snapshot();assert hashlib.sha256(original.read_bytes()).hexdigest()==beforehash
r={'round':'upper-cushion-119-003','blender':bpy.app.version_string,'candidateSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceSHA256':beforehash,'sourceUnchanged':True,'selectedTriangles':240,'closedCoordinateWeldedEdges':True,'signedVolumeM3':volume,'minimumZ':bottom,'maximumZ':top,'floorSupportPoints':support,'sourceFloorUndersideDiagnostic':undersides,'otherObjectSurfacePairs':hits,'allStructuralPairsExistingWoodenFloorTop':True,'otherMergedDressingSurfacePairs':internal,'savedSceneReopenEqual':True,'snapshotScope':'Geometry/UV/colour/material names/world matrices, not all shader/cache settings','method':'One cushion top/bottom connected to side seam, original6x6 grids and four source corner patches. No cloth simulation; filled80mm profile with40/43mm seam and rearward165mm placement are inferred art. Closedness after1e-5m coordinate weld, discrete surface-pair test not containment/continuous certification.','nativeVerified':False,'phoneMeasured':False}
receipt=folder/'authoring-floor-receipt.json';assert not receipt.exists();receipt.write_text(json.dumps(r,indent=2),encoding='utf-8');print('CUSHION',json.dumps(r),flush=True)
