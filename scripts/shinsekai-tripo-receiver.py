"""Run in a dedicated Blender UI process; never attach to an authoring scene.

Official Tripo bridge is installed separately and enabled only in this process.
Incoming objects are saved in private, numbered .blend / GLB review snapshots.
"""
import bpy
import addon_utils
import json
import os
from pathlib import Path
from datetime import datetime, timezone

OUT = Path(__file__).resolve().parents[2] / 'research-cache' / 'tripo-bridge'
OUT.mkdir(parents=True, exist_ok=True)
if bpy.app.background:
    raise RuntimeError('Use a dedicated UI process so Blender timers can import incoming models.')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
addon_utils.enable('Tripo3d_Blender_Bridge', default_set=False, persistent=False)
from Tripo3d_Blender_Bridge.core.status_manager import status

known = set()
last_state = None
def tick():
    global known, last_state
    state = {'pid':os.getpid(), 'blender':bpy.app.version_string, 'bridgeState':status.state.value,
             'lastLog':status.last_log, 'objects':len(bpy.context.scene.objects),
             'outputDirectory':str(OUT / 'received'), 'binding':'127.0.0.1:60600'}
    if state != last_state:
        (OUT / 'receiver-status.json').write_text(json.dumps(state, indent=2), encoding='utf-8')
        last_state = state
    current = {obj.as_pointer() for obj in bpy.context.scene.objects}
    if current != known and current:
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        folder = OUT / 'received' / stamp
        folder.mkdir(parents=True, exist_ok=False)
        bpy.ops.wm.save_as_mainfile(filepath=str(folder / 'received.blend'))
        bpy.ops.export_scene.gltf(filepath=str(folder / 'review.glb'), export_format='GLB', export_yup=True)
        (folder / 'receipt.json').write_text(json.dumps({'source':'TRIPO official DCC Bridge', 'objects':[obj.name for obj in bpy.context.scene.objects], 'scope':'cumulative inbox snapshot', 'inputProvenance':'record per asset before adoption', 'productionApproved':False}, indent=2), encoding='utf-8')
    known = current
    return 2.0

bpy.app.timers.register(tick, first_interval=1.0, persistent=True)
print('TRIPO receiver ready; private inbox only.', flush=True)
