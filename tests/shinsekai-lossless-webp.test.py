"""Authoring checks with the existing Pillow runtime; no network or installs."""
import io,pathlib,runpy,struct,unittest
from PIL import Image,ImageCms
ROOT=pathlib.Path(__file__).resolve().parents[1]
codec=runpy.run_path(str(ROOT/'scripts/shinsekai-lossless-webp.py'))
read_glb,write_glb,encode=codec['read_glb'],codec['write_glb'],codec['encode_lossless']

def fixture(profile=False,shared=False):
    image=Image.new('RGBA',(64,64));image.putdata([(i%256,70,120,0 if i%3==0 else 128 if i%3==1 else 255) for i in range(4096)])
    target=io.BytesIO();options={'compress_level':0}
    if profile:options['icc_profile']=ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
    image.save(target,format='PNG',**options);png=target.getvalue();geometry=struct.pack('<9f',0,0,0,1,0,0,0,1,0)
    doc={'asset':{'version':'2.0'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'parent','translation':[3,4,5],'children':[1]},{'name':'detail','mesh':0}],'meshes':[{'primitives':[{'attributes':{'POSITION':0},'material':0}]}],'materials':[{'name':'original','pbrMetallicRoughness':{'baseColorTexture':{'index':0}}}],'textures':[{'source':0,'sampler':0}],'samplers':[{'wrapS':33071}],'images':[{'bufferView':1,'mimeType':'image/png'}],'buffers':[{'byteLength':len(geometry)+len(png)}],'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':36},{'buffer':0,'byteOffset':36,'byteLength':len(png)}],'accessors':[{'bufferView':1 if shared else 0,'componentType':5126,'count':3,'type':'VEC3','min':[0,0,0],'max':[1,1,0]}]}
    return write_glb(doc,geometry+png),image,geometry,png

class LosslessWebP(unittest.TestCase):
    def test_rgba_transparent_rgb_and_scene_geometry_preserved(self):
        source,pixels,geometry,_=fixture();output,records=encode(source);doc,binary=read_glb(output)
        self.assertLess(len(output),len(source));self.assertTrue(records[0]['changed'])
        view=doc['bufferViews'][1];start=view['byteOffset']
        with Image.open(io.BytesIO(binary[start:start+view['byteLength']])) as decoded:self.assertEqual(decoded.convert('RGBA').tobytes(),pixels.tobytes())
        self.assertEqual(binary[:36],geometry);self.assertEqual(doc['nodes'],read_glb(source)[0]['nodes'])
        self.assertIn('EXT_texture_webp',doc['extensionsRequired']);self.assertNotIn('source',doc['textures'][0]);self.assertEqual(doc['samplers'],read_glb(source)[0]['samplers'])
    def test_colour_profile_is_retained_without_silent_colour_change(self):
        source,_,_,original=fixture(profile=True);output,records=encode(source);doc,binary=read_glb(output)
        view=doc['bufferViews'][1];start=view['byteOffset']
        self.assertEqual(binary[start:start+view['byteLength']],original);self.assertFalse(records[0]['changed']);self.assertIn('metadata',records[0]['retainedReason'])
        self.assertEqual(doc['textures'],read_glb(source)[0]['textures']);self.assertNotIn('EXT_texture_webp',doc.get('extensionsRequired',[]))
    def test_shared_image_accessor_is_rejected(self):
        source,*_=fixture(shared=True)
        with self.assertRaisesRegex(ValueError,'shared'):encode(source)
    def test_high_bit_depth_image_is_not_silently_converted_to_eight_bits(self):
        source,*_=fixture();doc,binary=read_glb(source);image=Image.new('I;16',(64,64),12000);target=io.BytesIO();image.save(target,format='PNG',compress_level=0);original=target.getvalue()
        doc['bufferViews'][1]['byteLength']=len(original);doc['buffers'][0]['byteLength']=36+len(original)
        output,records=encode(write_glb(doc,binary[:36]+original));new,data=read_glb(output);view=new['bufferViews'][1];start=view['byteOffset']
        self.assertEqual(data[start:start+view['byteLength']],original);self.assertFalse(records[0]['changed']);self.assertIn('high-bit-depth',records[0]['retainedReason'])

if __name__=='__main__':unittest.main()
