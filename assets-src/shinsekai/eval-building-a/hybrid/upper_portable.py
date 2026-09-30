"""Codex glTF encoding adapter; frozen Claude geometry/material intent stays intact."""
import numpy as np
import bpy
import json, math, struct

def repair_export_tangents(path):
    """MikkTSpace can emit non-orthogonal frames at degenerate authored UVs.
    Keep custom normals/positions/UVs; Gram-Schmidt the tangent, and only at a
    parallel/zero tangent choose a stable least-aligned-axis fallback. This is
    not evidence of a physically meaningful UV direction on degenerate faces.
    """
    payload=bytearray(path.read_bytes());length=struct.unpack_from('<I',payload,12)[0]
    doc=json.loads(payload[20:20+length]);binary=28+length
    report={'orthogonalized':0,'fallbacks':0,'maximumDotBefore':0}
    seen=set()
    for node in doc['nodes']:
        if not node.get('name','').startswith('UD_') or 'mesh' not in node:continue
        for primitive in doc['meshes'][node['mesh']]['primitives']:
            attrs=primitive['attributes']
            if 'TANGENT' not in attrs:continue
            key=(attrs['NORMAL'],attrs['TANGENT'])
            if key in seen:continue
            seen.add(key)
            normal,tangent=(doc['accessors'][i] for i in key)
            assert normal['componentType']==tangent['componentType']==5126
            nv,tv=(doc['bufferViews'][a['bufferView']] for a in [normal,tangent])
            for i in range(tangent['count']):
                no=binary+nv.get('byteOffset',0)+normal.get('byteOffset',0)+i*nv.get('byteStride',12)
                to=binary+tv.get('byteOffset',0)+tangent.get('byteOffset',0)+i*tv.get('byteStride',16)
                n=struct.unpack_from('<3f',payload,no);t=struct.unpack_from('<4f',payload,to)
                nn=sum(v*v for v in n);assert nn>.99
                dot=sum(n[k]*t[k] for k in range(3));report['maximumDotBefore']=max(report['maximumDotBefore'],abs(dot))
                tangent_size=math.sqrt(sum(v*v for v in t[:3]))
                if abs(dot)<.0001 and abs(tangent_size-1)<.0001:continue
                projected=[t[k]-n[k]*dot/nn for k in range(3)]
                size=math.sqrt(sum(v*v for v in projected))
                if size<.0001:
                    axis=min(range(3),key=lambda k:abs(n[k]))
                    projected=[(1 if k==axis else 0)-n[k]*n[axis]/nn for k in range(3)]
                    size=math.sqrt(sum(v*v for v in projected));report['fallbacks']+=1
                struct.pack_into('<4f',payload,to,*[v/size for v in projected],t[3])
                report['orthogonalized']+=1
    path.write_bytes(payload)
    return report

def repair(objects):
    report = {'roughness': [], 'colours': [], 'customNormalMeshes': 0}
    mats = {m for o in objects if o.type == 'MESH' for m in o.data.materials if m}
    for material in sorted(mats, key=lambda m: m.name):
        if not material.use_nodes:
            continue
        tree = material.node_tree
        for bs in [n for n in tree.nodes if n.type == 'BSDF_PRINCIPLED']:
            socket = bs.inputs['Roughness']
            if not socket.is_linked:
                continue
            scale = socket.links[0].from_node
            if scale.type != 'MATH' or scale.operation != 'MULTIPLY' or scale.inputs[1].is_linked:
                continue
            factor = scale.inputs[1].default_value
            if factor <= 1:
                continue
            separate = scale.inputs[0].links[0].from_node
            image_node = separate.inputs['Color'].links[0].from_node
            assert image_node.type == 'TEX_IMAGE' and image_node.image.colorspace_settings.name == 'Non-Color'
            image = image_node.image
            values = np.empty(len(image.pixels), dtype=np.float32)
            image.pixels.foreach_get(values)
            values = values.reshape((-1, 4))
            raw = values[:, :3] * factor
            values[:, :3] = np.clip(raw, 0, 1)
            baked = bpy.data.images.new(material.name + '_portable_rough', *image.size, alpha=True)
            baked.colorspace_settings.name = 'Non-Color'
            baked.pixels.foreach_set(values.ravel())
            baked.pack()
            image_node.image = baked
            scale.inputs[1].default_value = 1
            report['roughness'].append({'material': material.name, 'factorBakedIntoTexture': factor,
                                       'clippedComponents': int(np.count_nonzero(raw > 1))})
    for obj in objects:
        if obj.type != 'MESH':
            continue
        mesh = obj.data
        assert all(len(p.vertices) == 3 for p in mesh.polygons), 'Keep the authored triangulation/custom normals'
        report['customNormalMeshes'] += int(mesh.has_custom_normals)
        for colour in mesh.color_attributes:
            values = np.empty(len(colour.data) * 4, dtype=np.float32)
            colour.data.foreach_get('color', values)
            invalid = (values < 0) | (values > 1)
            if np.any(invalid):
                report['colours'].append({'object': obj.name, 'attribute': colour.name,
                                         'clampedComponents': int(np.count_nonzero(invalid))})
                colour.data.foreach_set('color', np.clip(values, 0, 1))
        mesh.update()
    return report
