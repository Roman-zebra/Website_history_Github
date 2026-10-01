"""Private image-encoding derivative: full dimensions and decoded RGBA retained."""
import argparse, copy, hashlib, io, json, pathlib, runpy
from PIL import Image, features, __version__ as pillow_version
glb = runpy.run_path(str(pathlib.Path(__file__).with_name('shinsekai-mobile-textures.py')))
read_glb, write_glb, normalized = glb['read_glb'], glb['write_glb'], glb['normalized']

def encode_lossless(raw, cache=None):
    if not features.check('webp'): raise ValueError('Existing Pillow has no WebP support')
    doc, binary = read_glb(raw); original = copy.deepcopy(doc)
    cache = {} if cache is None else cache
    image_views, replacements, changed_images, records = set(), {}, set(), []
    accessor_views = {a['bufferView'] for a in doc.get('accessors', []) if 'bufferView' in a}
    for a in doc.get('accessors', []):
        if a.get('sparse'):
            accessor_views |= {a['sparse']['indices']['bufferView'], a['sparse']['values']['bufferView']}
    for i, image in enumerate(doc.get('images', [])):
        if image.get('uri') or 'bufferView' not in image: raise ValueError('Embedded images only')
        vi=image['bufferView']; view=doc['bufferViews'][vi]
        if vi in accessor_views: raise ValueError('Image/accessor shared bufferView rejected')
        image_views.add(vi)
        start=view.get('byteOffset',0); encoded=binary[start:start+view['byteLength']]
        key=hashlib.sha256(encoded).hexdigest()
        if key not in cache:
            with Image.open(io.BytesIO(encoded)) as source:
                rgba=source.convert('RGBA'); target=io.BytesIO()
                retained_reason=None
                if source.mode not in ('1','L','LA','P','RGB','RGBA') or getattr(source,'n_frames',1)>1:
                    candidate=encoded;retained_reason='high-bit-depth or animated source retained unchanged'
                elif source.info.get('icc_profile') or source.info.get('exif'):
                    # Retain the original encoded image and colour interpretation.
                    candidate=encoded;retained_reason='colour/EXIF metadata retained unchanged'
                else:
                    rgba.save(target,format='WEBP',lossless=True,quality=100,method=6,exact=True)
                    candidate=target.getvalue()
                    with Image.open(io.BytesIO(candidate)) as decoded:
                        if decoded.size!=rgba.size or decoded.convert('RGBA').tobytes()!=rgba.tobytes(): raise ValueError('Decoded pixel drift')
                cache[key]=(candidate,rgba.size,hashlib.sha256(rgba.tobytes()).hexdigest(),retained_reason)
        candidate,size,pixels,retained_reason=cache[key]
        changed=len(candidate)<len(encoded)
        if changed:
            replacements[vi]=candidate; image['mimeType']='image/webp'; changed_images.add(i)
        records.append({'image':i,'width':size[0],'height':size[1],'originalBytes':len(encoded),'resultBytes':len(candidate) if changed else len(encoded),'changed':changed,'retainedReason':retained_reason,'decodedRgbaSha256':pixels,'decodedPixelsExact':True})
    for texture in doc.get('textures',[]):
        if texture.get('extensions'): raise ValueError('Existing texture extensions require separate handling')
        if texture.get('source') in changed_images:
            texture['extensions']={'EXT_texture_webp':{'source':texture.pop('source')}}
    if changed_images:
        for key in ['extensionsUsed','extensionsRequired']:
            doc[key]=list(dict.fromkeys(doc.get(key,[])+['EXT_texture_webp']))
    chunks=[]; offset=0
    for vi,view in enumerate(doc['bufferViews']):
        old=original['bufferViews'][vi]; start=old.get('byteOffset',0)
        value=replacements.get(vi,binary[start:start+old['byteLength']])
        pad=(-offset)%4
        if pad: chunks.append(b'\0'*pad);offset+=pad
        view['byteOffset']=offset;view['byteLength']=len(value);chunks.append(value);offset+=len(value)
    doc['buffers'][0]['byteLength']=offset
    out=write_glb(doc,b''.join(chunks)); check,new_binary=read_glb(out)
    for vi,old in enumerate(original['bufferViews']):
        if vi in image_views: continue
        new=check['bufferViews'][vi];a=old.get('byteOffset',0);b=new.get('byteOffset',0)
        if binary[a:a+old['byteLength']]!=new_binary[b:b+new['byteLength']]: raise ValueError('Non-image bytes changed')
    # Strip only declared transport changes, then compare every scene property.
    restored=copy.deepcopy(check)
    for i,image in enumerate(restored.get('images',[])):image['mimeType']=original['images'][i]['mimeType']
    for t in restored.get('textures',[]):
        if t.get('extensions',{}).get('EXT_texture_webp'):
            t['source']=t.pop('extensions')['EXT_texture_webp']['source']
    for key in ['extensionsUsed','extensionsRequired']:
        if key in original:restored[key]=original[key]
        else:restored.pop(key,None)
    if normalized(restored)!=normalized(original): raise ValueError('Unrelated JSON changed')
    return out,records

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--manifest',required=True);parser.add_argument('--out-dir',required=True)
    parser.add_argument('--parts',nargs='+',required=True);opt=parser.parse_args()
    source=pathlib.Path(opt.manifest).resolve();out=pathlib.Path(opt.out_dir).resolve();out.mkdir(parents=True,exist_ok=False)
    manifest=json.loads(source.read_text(encoding='utf-8'));parts=[];cache={};sha=lambda b:hashlib.sha256(b).hexdigest()
    for name in opt.parts:
        entry=next(p for p in manifest['parts'] if p['file']==name);file=source.parent/name;raw=file.read_bytes()
        if sha(raw)!=entry['sha256']:raise ValueError('Source hash mismatch')
        result,records=encode_lossless(raw,cache);(out/name).write_bytes(result)
        if sha(file.read_bytes())!=entry['sha256']:raise ValueError('Source changed')
        parts.append({'file':name,'bytes':len(result),'originalBytes':len(raw),'sha256':sha(result),'sourceSha256':sha(raw),'images':records,'nonImageViewsExact':True,'normalizedSceneJsonExact':True})
        print(json.dumps({'file':name,'originalBytes':len(raw),'bytes':len(result),'imagesChanged':sum(r['changed'] for r in records)}),flush=True)
    (out/'manifest.json').write_text(json.dumps({'revision':manifest['revision'],'pillowVersion':pillow_version,'sourceUnchanged':True,'additionalStudioCredits':0,'productionApproved':False,'parts':parts},indent=2)+'\n',encoding='utf-8')
