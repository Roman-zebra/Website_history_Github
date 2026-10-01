import bpy,json,hashlib
from pathlib import Path
folder=Path(__file__).resolve().parents[3].parent/'research-cache/haori-support-119-003';previous=folder.parent/'haori-support-119-001'
def snapshot():
 result={}
 for ob in bpy.context.scene.objects:
  if ob.type!='MESH':continue
  result[ob.name]={'matrix':list(sum((list(r) for r in ob.matrix_world),[])),'positions':[list(v.co) for v in ob.data.vertices],'faces':[list(p.vertices) for p in ob.data.polygons],'UV':[[list(v.uv) for v in l.data] for l in ob.data.uv_layers],'colour':[[list(v.color) for v in l.data] for l in ob.data.color_attributes],'materials':[m.name for m in ob.data.materials]}
 return result
bpy.ops.wm.open_mainfile(filepath=str(previous/'authoring.blend'));initial=[v.co.copy() for v in bpy.data.objects['Haori_connected'].data.vertices]
bpy.ops.wm.open_mainfile(filepath=str(folder/'settled.blend'));settled=bpy.data.objects['Haori_connected'];shift=max((settled.data.vertices[i].co-p).length for i,p in enumerate(initial));snap=snapshot()
bpy.ops.wm.open_mainfile(filepath=str(folder/'settled.blend'));assert snapshot()==snap
record={'sceneReopenEqual':True,'scope':'All scene mesh positions/faces/UV/vertex colours/material names/world matrices; not all shader nodes or physics cache settings','initialMidsurfaceVertices':len(initial),'maxFinalOffsetIncludingSolidify':shift,'sceneSHA256':hashlib.sha256((folder/'settled.blend').read_bytes()).hexdigest()}
(folder/'scene-reopen.json').write_text(json.dumps(record,indent=2),encoding='utf-8');print(record,flush=True)
