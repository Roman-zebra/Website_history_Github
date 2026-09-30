"""Blender4.5 --python-exit-code 1 --python build-cloth.py -- --no-render --review-only.
Exports only to the parent research-cache; frozen inputs and default GLBs stay intact.
"""
import json,struct,sys
from pathlib import Path
import bpy
source=Path(__file__).resolve().parent/'build.py'
cache=source.parent.parents[3].parent/'research-cache'
sys.path.insert(0,str(source.parent))
from upper_cloth import install,TARGETS
from upper_portable import repair_export_tangents
text=source.read_text(encoding='utf8').split('# Five explicit cameras')[0]
needle='upper.build_materials();upper.build_all()';assert text.count(needle)==1
text=text.replace(needle,'upper.build_materials();cloth_state=install(upper);upper.build_all()')
scope={'__file__':str(source),'__name__':'private_upper_cloth','install':install}
exec(compile(text,str(source),'exec'),scope)
state=scope['cloth_state']
data=(source.parent/'runtime/dream-petals.glb').read_bytes()
length=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+length])
anchors=json.loads(next(n['extras']['flowerAnchors'] for n in doc['nodes'] if n.get('name')=='UD_Dream'))
state['maxActiveWithPetals']=scope['metrics']['upper111']['maxActiveInteriorTriangles']+80*len(anchors)-sum(a['originalTriangles'] for a in anchors)
assert state['maxActiveWithPetals']<=150000
bpy.ops.object.select_all(action='DESELECT')
for name in TARGETS:
    obj=bpy.data.objects[name];obj.select_set(True);parent=obj.parent
    while parent:parent.select_set(True);parent=parent.parent
target=cache/'upper-111-cloth';target.mkdir(exist_ok=True)
file=target/'upper-cloth.glb'
bpy.ops.export_scene.gltf(filepath=str(file),export_format='GLB',use_selection=True,
    export_extras=True,export_lights=False,export_cameras=False,export_tangents=True,
    export_attributes=True,export_vertex_color='ACTIVE')
state['tangentRepair']=repair_export_tangents(file);state['bytes']=file.stat().st_size
(target/'receipt.json').write_text(json.dumps(state,indent=2),encoding='utf8')
print('CLOTH CANDIDATE',json.dumps(state),flush=True)
