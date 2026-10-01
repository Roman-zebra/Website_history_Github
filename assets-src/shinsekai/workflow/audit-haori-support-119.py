import bpy,bmesh,json
from pathlib import Path
folder=Path(__file__).resolve().parents[3].parent/'research-cache/haori-support-119-003';bpy.ops.wm.open_mainfile(filepath=str(folder/'settled.blend'))
ob=bpy.data.objects['Haori_connected'];bm=bmesh.new();bm.from_mesh(ob.data);assert all(len(e.link_faces)==2 for e in bm.edges)
unseen=set(bm.verts);components=0
while unseen:
 components+=1;stack=[unseen.pop()]
 while stack:
  for edge in stack.pop().link_edges:
   for v in edge.verts:
    if v in unseen:unseen.remove(v);stack.append(v)
assert components==1;bm.free();bs=next(n for n in ob.data.materials[0].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
r={'closedFabric':True,'connectedComponents':components,'roughness':bs.inputs['Roughness'].default_value,'sheenWeight':bs.inputs['Sheen Weight'].default_value,'scope':'Saved Blender shape/material; native clothlook fibre sheen gain.35 retained. Wall AO and final local crease amplitude not approved'}
(folder/'topology-material.json').write_text(json.dumps(r,indent=2),encoding='utf-8');print(r,flush=True)
