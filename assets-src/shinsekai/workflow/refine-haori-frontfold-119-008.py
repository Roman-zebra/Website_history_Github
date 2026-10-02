"""Retain simulated003 and resolve only its front body folds; numbered output."""
import bpy,bmesh,json,math,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3].parent
OUT=ROOT/'research-cache/haori-frontfold-119-008';OUT.mkdir(exist_ok=True)
SOURCE=ROOT/'research-cache/haori-support-119-003/settled.blend'
assert not (OUT/'candidate.blend').exists()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
assert bpy.app.version[:2]==(4,5)
api=bmesh.ops.subdivide_edges.__doc__;assert 'cuts' in api and 'use_grid_fill' in api
(OUT/'installed-api.txt').write_text(bpy.app.version_string+'\n'+api,encoding='utf-8')
ob=bpy.data.objects['Haori_connected'];me=ob.data;assert len(me.vertices)==956
original=[Vector(v.co) for v in me.vertices]
other={o.name:{'matrix':[list(r) for r in o.matrix_world],'vertices':[list(v.co) for v in o.data.vertices] if o.type=='MESH' else None} for o in bpy.context.scene.objects if o!=ob}
bm=bmesh.new();bm.from_mesh(me);bm.verts.ensure_lookup_table();bm.faces.ensure_lookup_table()
labels=bm.faces.layers.int.new('Private_front_patch');parent=bm.faces.layers.int.new('Private_source_face')
u=bm.verts.layers.float.new('Private_panel_u');t=bm.verts.layers.float.new('Private_body_t')
bm.verts.ensure_lookup_table();bm.faces.ensure_lookup_table();oldverts=list(bm.verts)
for f in bm.faces:f[parent]=f.index
facebyverts={frozenset(v.index for v in f.verts):f for f in bm.faces};patches=[]
for half in [0,478]:
 for panel,base in enumerate([126,189]):
  label=1+panel+(2 if half else 0)
  for row in range(9):
   for col in range(7):oldverts[half+base+row*7+col][u]=col/6;oldverts[half+base+row*7+col][t]=row/8
  for row in range(0,8):
   for col in range(6):
    i=half+base+row*7+col;f=facebyverts[frozenset([i,i+1,i+7,i+8])];f[labels]=label;patches.append(f)
assert len(patches)==192
selected={v.index for f in patches for v in f.verts};edges=list({e for f in patches for e in f.edges if abs(e.verts[0][t]-e.verts[1][t])<1e-7})
loopuv=bm.loops.layers.uv['UVMap'];loopcolour=bm.loops.layers.float_color['Color']
corners=[(f[parent],l.vert.index,tuple(l[loopuv].uv),tuple(l[loopcolour])) for f in bm.faces for l in f.loops]
bmesh.ops.subdivide_edges(bm,edges=edges,cuts=3,use_grid_fill=True,smooth=0)
# The operator can replace BMVert wrappers. Recover original corners by exact
# coordinates BEFORE deformation; reject duplicates/missing source vertices.
originalkeys={tuple(p):i for i,p in enumerate(original)};assert len(originalkeys)==956
recovered={}
for v in bm.verts:
 i=originalkeys.get(tuple(v.co))
 if i is not None:assert i not in recovered;recovered[i]=v
assert len(recovered)==956,len(recovered)
refined=[f for f in bm.faces if f[labels]];active={v for f in refined for v in f.verts}
assert len(refined)==768,len(refined)
def smooth(v):v=max(0,min(1,v));return v*v*(3-2*v)
def edgebase(label,tt,uu):
 half=478 if label>2 else 0;base=126 if label%2 else 189;r=min(7,int(tt*8));s=tt*8-r
 a=original[half+base+r*7].x*(1-s)+original[half+base+(r+1)*7].x*s
 b=original[half+base+r*7+6].x*(1-s)+original[half+base+(r+1)*7+6].x*s
 return a*(1-uu)+b*uu
changed=[];parameters=[]
for v in active:
 owned={f[labels] for f in v.link_faces if f[labels]};assert len(owned)==1,owned;label=owned.pop();uu=float(v[u]);tt=float(v[t]);a=2/24;b=22/24
 ww=smooth(tt/(2/8))*smooth((1-tt)/(1/8));hh=smooth(uu/a)*smooth((1-uu)/(1-b))
 vv=(uu-a)/(b-a);bump=.022*math.sin(math.tau*vv)**2 if 0<=vv<=1 else 0
 oldx=v.co.x;v.co.x+=ww*hh*(edgebase(label,tt,uu)+bump-oldx)
 if abs(v.co.x-oldx)>1e-8:changed.append(v)
 parameters.append((v,label,uu,tt))
for i,v in recovered.items():
 if i not in selected:assert v.co==original[i],('Changed unrelated source vertex',i)
# Attribute interpolation must retain original corners, including patch boundaries.
for sourceface,oldindex,uv,colour in corners:
 v=recovered[oldindex]
 matches=[l for f in v.link_faces if f[parent]==sourceface for l in f.loops if l.vert==v]
 assert matches,('Lost source corner',sourceface)
 assert any(max(abs(a-b) for a,b in zip(l[loopuv].uv,uv))<1e-6 and max(abs(a-b) for a,b in zip(l[loopcolour],colour))<1e-6 for l in matches),('Changed source corner attributes',sourceface)
bm.normal_update();assert all(len(e.link_faces)==2 for e in bm.edges),'Open garment'
pending=set(bm.verts);components=0
while pending:
 components+=1;front=[pending.pop()]
 while front:
  for e in front.pop().link_edges:
   for v in e.verts:
    if v in pending:pending.remove(v);front.append(v)
assert components==1
bm.verts.index_update();profiles=[]
for label,name in [(1,'frontL'),(2,'frontR')]:
 for row in [4,5,6,7]:
  line=sorted([(uu,v.co.y,v.co.x) for v,l,uu,tt in parameters if l==label and abs(tt-row/8)<1e-6],key=lambda p:p[0])
  # Shared refined-face edges refer to one BMVert; parameters has unique vertices.
  assert len(line)==25,(name,row,len(line))
  assert all(b[1]>a[1] for a,b in zip(line,line[1:])),('Folded panel order',name,row)
  valleys=[0]+[i for i in range(1,len(line)-1) if line[i][2]<line[i-1][2] and line[i][2]<line[i+1][2]]+[len(line)-1]
  peaks=[]
  for i in range(1,len(line)-1):
   if line[i][2]<=line[i-1][2] or line[i][2]<=line[i+1][2]:continue
   left=max(k for k in valleys if k<i);right=min(k for k in valleys if k>i);yy=(line[i][1]-line[left][1])/(line[right][1]-line[left][1]);depth=line[i][2]-line[left][2]*(1-yy)-line[right][2]*yy
   peaks.append({'column':i,'brackets':[left,right],'boundaryBracket':left==0 or right==len(line)-1,'depthM':depth,'within10to25mm':.01<=depth<=.025})
  profiles.append({'panel':name,'row':row,'samples':len(line),'maxYStepM':max(b[1]-a[1] for a,b in zip(line,line[1:])),'crests':peaks})
for row in [4,5,6,7]:
 good=[p for f in profiles if f['row']==row for p in f['crests'] if not p['boundaryBracket'] and p['within10to25mm']]
 assert 3<=len(good)<=5,('Unqualified actual front crests',row,good)
# Private parameter layers are inspection aids, not published attributes.
bm.faces.layers.int.remove(labels);bm.faces.layers.int.remove(parent);bm.verts.layers.float.remove(u);bm.verts.layers.float.remove(t)
bm.to_mesh(me);bm.free();me.update();me.calc_loop_triangles()
assert {o.name:{'matrix':[list(r) for r in o.matrix_world],'vertices':[list(v.co) for v in o.data.vertices] if o.type=='MESH' else None} for o in bpy.context.scene.objects if o!=ob}==other
ob['frontFold119007']='Post-settlement front body correction; 4 inferred22mm crests, source supports/sleeve/collar/hem preserved; not new simulation'
bpy.ops.object.select_all(action='DESELECT')
for name in ['Haori_connected','Haori119_bamboo','Haori119_cord_0','Haori119_cord_1']:bpy.data.objects[name].select_set(True)
bpy.context.view_layer.objects.active=ob
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'candidate.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'replacement.glb'),export_format='GLB',use_selection=True,export_extras=True,export_tangents=True,export_vertex_color='ACTIVE')
out={'round':'haori-frontfold-119-008','sourceSceneSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'blender':bpy.app.version_string,'sourceVertices':956,'vertices':len(me.vertices),'clothTriangles':len(me.loop_triangles),'sourcePatchQuads':192,'refinedPatchQuads':len(refined),'changedVertices':len(changed),'allUnselectedOriginalPositionsExact':True,'sourceCornerUVColourPreserved':True,'otherObjectsGeometryMatricesExact':True,'closedComponents':1,'profiles':profiles,'export':'Initial replacement.glb retained; export-r2 required for transition ngons and missing tangents. No tangent-repair claim.','nativeVerified':False,'historicalApproved':False,'full119Complete':False,'TRIPO':0}
(OUT/'geometry-receipt.json').write_text(json.dumps(out,indent=2),encoding='utf-8');print('FRONTFOLD',json.dumps(out),flush=True)
