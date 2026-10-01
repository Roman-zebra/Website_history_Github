"""Image-only private GLB derivative; retain exact geometry/animation bytes."""
import argparse, copy, hashlib, io, json, pathlib, struct
from PIL import Image, __version__ as pillow_version

def read_glb(raw):
    magic, version, length = struct.unpack_from('<III', raw)
    if magic != 0x46546C67 or version != 2 or length != len(raw):
        raise ValueError('Expected complete GLB2')
    chunks, offset = {}, 12
    while offset < len(raw):
        size, kind = struct.unpack_from('<II', raw, offset)
        chunks[kind] = raw[offset + 8:offset + 8 + size]
        if len(chunks[kind]) != size: raise ValueError('Truncated chunk')
        offset += 8 + size
    doc = json.loads(chunks[0x4E4F534A])
    if len(doc['buffers']) != 1 or doc['buffers'][0].get('uri'):
        raise ValueError('Resize before compressed transport; one embedded buffer required')
    return doc, chunks[0x004E4942]

def write_glb(doc, binary):
    encoded = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    encoded += b' ' * (-len(encoded) % 4)
    binary += b'\0' * (-len(binary) % 4)
    return struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary)) + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded + struct.pack('<II', len(binary), 0x004E4942) + binary

def normalized(doc):
    clone = copy.deepcopy(doc)
    for v in clone['bufferViews']:
        v.pop('byteOffset', None); v.pop('byteLength', None)
    clone['buffers'][0].pop('byteLength', None)
    return clone

def resize_glb(raw, edge):
    doc, binary = read_glb(raw)
    original = copy.deepcopy(doc)
    image_views, replacements, records = set(), {}, []
    accessor_views = {a['bufferView'] for a in doc.get('accessors', []) if 'bufferView' in a}
    for a in doc.get('accessors', []):
        if 'sparse' in a:
            accessor_views |= {a['sparse']['indices']['bufferView'], a['sparse']['values']['bufferView']}
    for i, image in enumerate(doc.get('images', [])):
        if image.get('uri') or 'bufferView' not in image: raise ValueError('Embedded images only')
        vi = image['bufferView']
        if vi in accessor_views: raise ValueError('Image/accessor shared view rejected')
        image_views.add(vi)
        view = doc['bufferViews'][vi]
        start = view.get('byteOffset', 0)
        encoded = binary[start:start + view['byteLength']]
        with Image.open(io.BytesIO(encoded)) as im:
            before = im.size
            if max(before) <= edge: continue
            factor = edge / max(before)
            size = tuple(max(1, round(n * factor)) for n in before)
            resized = im.resize(size, Image.Resampling.LANCZOS, reducing_gap=3.0)
            target = io.BytesIO()
            if image['mimeType'] == 'image/jpeg':
                resized.convert('RGB').save(target, format='JPEG', quality=90, subsampling=0, optimize=True)
            elif image['mimeType'] == 'image/png':
                resized.save(target, format='PNG', optimize=True)
            else: raise ValueError('Unsupported image MIME')
            replacements[vi] = target.getvalue()
            records.append({'image': i, 'before': before, 'after': size, 'originalBytes': len(encoded), 'bytes': len(replacements[vi])})
    chunks, offset = [], 0
    for vi, view in enumerate(doc['bufferViews']):
        if view.get('buffer', 0) != 0 or view.get('extensions'): raise ValueError('Plain bufferViews required')
        start = view.get('byteOffset', 0)
        old = binary[start:start + view['byteLength']]
        if len(old) != view['byteLength']: raise ValueError('Truncated view')
        data = replacements.get(vi, old)
        pad = -offset % 4
        chunks.append(b'\0' * pad); offset += pad
        view['byteOffset'], view['byteLength'] = offset, len(data)
        chunks.append(data); offset += len(data)
    doc['buffers'][0]['byteLength'] = offset
    out = write_glb(doc, b''.join(chunks))
    check, new_binary = read_glb(out)
    if normalized(original) != normalized(check): raise ValueError('Unrelated JSON changed')
    for vi, old_view in enumerate(original['bufferViews']):
        if vi in replacements: continue
        new_view = check['bufferViews'][vi]
        old_start, new_start = old_view.get('byteOffset', 0), new_view.get('byteOffset', 0)
        if binary[old_start:old_start + old_view['byteLength']] != new_binary[new_start:new_start + new_view['byteLength']]:
            raise ValueError('Non-target view changed')
    return out, records

if __name__ == '__main__':
    args = argparse.ArgumentParser()
    args.add_argument('--manifest', required=True); args.add_argument('--out-dir', required=True)
    args.add_argument('--edge', type=int, default=512)
    opt = args.parse_args()
    if opt.edge not in [512, 1024]: raise ValueError('Scoped edge512 or1024 required')
    source = pathlib.Path(opt.manifest).resolve(); out = pathlib.Path(opt.out_dir).resolve()
    out.mkdir(parents=True, exist_ok=False)
    manifest = json.loads(source.read_text(encoding='utf-8')); parts = []
    sha = lambda data: hashlib.sha256(data).hexdigest()
    for entry in manifest['parts']:
        file = source.parent / entry['file']; raw = file.read_bytes()
        if sha(raw) != entry['sha256']: raise ValueError('Input hash mismatch')
        result, changes = resize_glb(raw, opt.edge)
        destination = out / entry['file']; destination.write_bytes(result)
        if sha(file.read_bytes()) != entry['sha256']: raise ValueError('Source changed')
        parts.append({'file': entry['file'], 'bytes': len(result), 'sha256': sha(result), 'sourceSha256': entry['sha256'], 'originalBytes': len(raw), 'resizedImages': changes, 'exactUnrelatedViews': True, 'normalizedJsonUnchanged': True})
    receipt = {'revision': manifest['revision'], 'pillowVersion': pillow_version, 'textureEdge': opt.edge, 'sourceUnchanged': True, 'additionalStudioCredits': 0, 'productionApproved': False, 'parts': parts}
    (out / 'manifest.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    print(json.dumps([{'file': p['file'], 'bytes': p['bytes'], 'imagesChanged': len(p['resizedImages'])} for p in parts]))
