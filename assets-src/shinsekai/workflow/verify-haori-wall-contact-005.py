"""Recover receipt only from existing005 bake; never rebake or replace assets."""
import bpy, json, hashlib, array
from pathlib import Path
root=Path(__file__).resolve().parents[3].parent
out=root/'research-cache/haori-wall-contact-119-005'
assert not (out/'bake-receipt.json').exists()
assert 'ReferenceError: StructRNA' in (out/'bake.log').read_text(encoding='utf-8')
# The failed command passed its original save/reopen and input equality checks;
# only dereferencing pre-reopen Object wrappers while constructing receipt failed.
exec_source=(root/'repo/assets-src/shinsekai/workflow/bake-haori-wall-contact-119.py').read_text(encoding='utf-8')
snapshot_source=exec_source.split('def snapshot():',1)[1].split('before=snapshot();',1)[0]
exec('def snapshot():'+snapshot_source)
bpy.ops.wm.open_mainfile(filepath=str(out/'contact-bake.blend'))
before=snapshot()
image=bpy.data.images['haori_wall_contact005']
assert list(image.size)==[512,512] and image.colorspace_settings.name=='Non-Color'
assert image.packed_file.data==(out/'wall-contact.png').read_bytes()
pixels=array.array('f',[0])*len(image.pixels);image.pixels.foreach_get(pixels);values=pixels[::4]
border=[values[i] for i in range(len(values)) if i//512 in [0,511] or i%512 in [0,511]]
assert min(values)<.7 and max(values)>.99 and min(border)>.99
names=sorted(o.name for o in bpy.context.scene.objects if not o.hide_render and o.name!='Actual west-wall005 receiver')
wall=bpy.data.objects['BldgA_LOD0_sideL']
ps=[wall.matrix_world@wall.data.vertices[i].co for f in wall.data.polygons if wall.data.materials[f.material_index].name=='M_Plaster_Int' for i in f.vertices]
lo=[min(v[k] for v in ps) for k in range(3)];hi=[max(v[k] for v in ps) for k in range(3)]
inputs=[root/'research-cache/haori-support-119-003/upper-cloth-support.glb',root/'repo/assets-src/shinsekai/eval-building-a/hybrid/runtime/exterior-lod0.glb']
hashes={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
bpy.ops.wm.open_mainfile(filepath=str(out/'contact-bake.blend'));assert before==snapshot()
r={'round':'haori-wall-contact-119-005','blender':bpy.app.version_string,'inputs':hashes,'sourceUnchanged':True,'wallWorldBounds':[lo,hi],'mapSize':[512,512],'colourSpace':'Non-Color','min':min(values),'max':max(values),'borderMinimum':min(border),'pixelsBelowPoint9':sum(v<.9 for v in values),'PNGBytes':(out/'wall-contact.png').stat().st_size,'pngSHA256':hashlib.sha256((out/'wall-contact.png').read_bytes()).hexdigest(),'casterNames':names,'savedSceneReopened':True,'snapshotEqual':True,'receiptRecovery':'Original bake exit1 after successful save/reopen/source checks: pre-reopen Object wrappers invalid while serializing names. Existing PNG/blend preserved; receipt recovered with current names and repeat reopen equality. No rebake.','scope':'Isolated static coat contribution; geometry/UV/matrix/hide/packed image/sample/seed/distance snapshot, not all shader settings','nativeVerified':False,'phoneMeasured':False}
(out/'bake-receipt.json').write_text(json.dumps(r,indent=2),encoding='utf-8')
print('RECOVERED',json.dumps(r),flush=True)
