"""Check a private GLB -> .blend save/reopen without modifying the GLB.

Run with Blender -b --threads 2 --python-exit-code 1 --python this.py --
--input path/to/uncompressed.glb --out-dir path/to/private/new-directory
This checks Blender scene persistence, not a lossless GLB re-export or visual QA.
"""
import argparse
import array
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import bpy


def digest(collection, field, width, typecode="f"):
    values = array.array(typecode, [0]) * (len(collection) * width)
    collection.foreach_get(field, values)
    return hashlib.sha256(values.tobytes()).hexdigest()


def scene_snapshot():
    meshes = {}
    for mesh in sorted(bpy.data.meshes, key=lambda value: value.name):
        meshes[mesh.name] = {
            "vertices": len(mesh.vertices),
            "polygons": len(mesh.polygons),
            "positions": digest(mesh.vertices, "co", 3),
            "loopVertexIndices": digest(mesh.loops, "vertex_index", 1, "i"),
            "polygonSizes": digest(mesh.polygons, "loop_total", 1, "i"),
            "materialIndices": digest(mesh.polygons, "material_index", 1, "i"),
            "cornerNormals": digest(mesh.corner_normals, "vector", 3),
            "uvs": {layer.name: digest(layer.data, "uv", 2) for layer in mesh.uv_layers},
            "colours": {layer.name: {"domain": layer.domain, "type": layer.data_type,
                        "digest": digest(layer.data, "color", 4)} for layer in mesh.color_attributes},
            "materials": [material.name if material else None for material in mesh.materials],
        }
    objects = {}
    for obj in sorted(bpy.data.objects, key=lambda value: value.name):
        animation = obj.animation_data
        objects[obj.name] = {
            "type": obj.type,
            "data": obj.data.name if obj.data else None,
            "parent": obj.parent.name if obj.parent else None,
            "matrixLocal": [list(row) for row in obj.matrix_local],
            "action": animation.action.name if animation and animation.action else None,
            "nla": [{"name": track.name, "strips": [
                {"name": strip.name, "action": strip.action.name if strip.action else None,
                 "start": strip.frame_start, "end": strip.frame_end} for strip in track.strips]}
                for track in animation.nla_tracks] if animation else [],
        }
    return {
        "meshes": meshes, "objects": objects,
        "materials": sorted(material.name for material in bpy.data.materials),
        "packedImages": {img.name: {"size": list(img.size), "bytesSha256":
                         hashlib.sha256(img.packed_file.data).hexdigest() if img.packed_file else None}
                         for img in bpy.data.images},
        "actions": {action.name: list(action.frame_range) for action in bpy.data.actions},
    }


args = argparse.ArgumentParser(description=__doc__)
args.add_argument("--input", type=Path, required=True)
args.add_argument("--out-dir", type=Path, required=True)
options = args.parse_args(sys.argv[sys.argv.index("--") + 1:])
source = options.input.resolve(strict=True)
output = options.out_dir.resolve()
if source.suffix.lower() != ".glb":
    raise ValueError("Expected an uncompressed GLB authoring asset")
if output.exists() and any(output.iterdir()):
    raise ValueError("Use a new or empty private output directory")
output.mkdir(parents=True, exist_ok=True)
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
before = scene_snapshot()
if not before["meshes"] or not any(mesh["vertices"] for mesh in before["meshes"].values()):
    raise RuntimeError("Imported scene has no mesh geometry; do not accept an empty scene")
blend_path = output / "scene-reopen.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
bpy.ops.wm.open_mainfile(filepath=str(blend_path))
after = scene_snapshot()
equal = before == after
source_unchanged = hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
receipt = {
    "checkedAt": datetime.now(timezone.utc).isoformat(),
    "blenderVersion": bpy.app.version_string,
    "source": str(source), "sourceSha256": source_hash,
    "savedBlend": str(blend_path), "savedBlendBytes": blend_path.stat().st_size,
    "sourceUnchanged": source_unchanged, "sceneReopened": True,
    "snapshotEqual": equal, "passed": equal and source_unchanged,
    "objects": len(before["objects"]), "meshes": len(before["meshes"]),
    "vertices": sum(mesh["vertices"] for mesh in before["meshes"].values()),
    "actions": len(before["actions"]),
    "checked": ["mesh positions/topology/material assignment", "corner normals", "UVs and colour attributes",
                "local object matrices and parents", "material names", "packed image bytes",
                "action names/ranges and object/NLA assignment"],
    "notChecked": ["lossless GLB import/export equivalence", "full material node semantics",
                   "animation keyframe values", "render quality", "collision safety", "GPU performance"],
}
(output / "before.json").write_text(json.dumps(before, indent=2), encoding="utf-8")
(output / "after.json").write_text(json.dumps(after, indent=2), encoding="utf-8")
(output / "receipt.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
print(json.dumps(receipt, indent=2))
if not receipt["passed"]:
    raise RuntimeError("Scene persistence audit failed; inspect before.json and after.json")
