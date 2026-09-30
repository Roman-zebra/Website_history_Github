"""Optional111 dream derivative, leaving normal GLBs unchanged.
Blender4.5 --python-exit-code 1 --python build-runtime-flowers.py -- [--output path]
The host replaces recorded blossoms with the original procedural runtime atlas.
No camera or reference image pixels are exported.
"""
import hashlib,json,sys
from pathlib import Path
import bpy
here=Path(__file__).resolve().parent
source=here/'build.py'
sys.path.insert(0,str(here))
from upper_runtime_flowers import install
from upper_portable import repair_export_tangents
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
target=Path(args[args.index('--output')+1]).resolve() if '--output' in args else here/'runtime/dream-petals.glb'
target.parent.mkdir(parents=True,exist_ok=True)
text=source.read_text(encoding='utf8').split('# Five explicit cameras')[0]
needle='upper.build_materials();upper.build_all()'
assert text.count(needle)==1
text=text.replace(needle,'upper.build_materials();flower_state=install(upper);upper.build_all()')
ns={'__file__':str(source),'__name__':'runtime_flower_derivative','install':install}
exec(compile(text,str(source),'exec'),ns)
state=ns['flower_state'];group=ns['dream_group']
group['flowerAnchors']=json.dumps(state['anchors'],separators=(',',':'))
group['flowerInstanceAssumptions']='A:original e3dd4e7 anchors; optional Codex80tri procedural replacement; no historic measurements'
bpy.ops.object.select_all(action='DESELECT');ns['root'].select_set(True);group.select_set(True)
for obj in bpy.context.scene.objects:
    p=obj.parent
    while p:
        if p==group:obj.select_set(True);break
        p=p.parent
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,
    export_extras=True,export_lights=True,export_cameras=False,export_tangents=True,
    export_attributes=True,export_vertex_color='ACTIVE')
state['tangentRepair']=repair_export_tangents(target)
state['proposedMaxActiveInteriorTriangles']=ns['metrics']['upper111']['maxActiveInteriorTriangles']+80*len(state['anchors'])
assert state['proposedMaxActiveInteriorTriangles']<=150000
state['retainedDreamTriangles']=ns['metrics']['upper111']['dreamTriangles']
state['bytes']=target.stat().st_size
state['sha256']=hashlib.sha256(target.read_bytes()).hexdigest()
state['upstreamRevision']='e3dd4e7'
state['sourceTags']='A:invented original flower placement/shape/palette; no survey or source-image pixels'
target.with_suffix('.json').write_text(json.dumps(state,indent=2),encoding='utf8')
print('FLOWER CANDIDATE',json.dumps({k:v for k,v in state.items() if k!='anchors'}),flush=True)
