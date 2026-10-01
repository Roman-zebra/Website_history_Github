// Offline qualification of this study's required Meshopt buffer-view format.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {MeshoptDecoder} from '../vendor/three-r186/examples/jsm/libs/meshopt_decoder.module.js';
import {writeGlb} from './shinsekai-glb-cell.cjs';

export async function decodeMeshopt(bytes){
 await MeshoptDecoder.ready;
 if(bytes.length<28||bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw new Error('Expected complete GLB2');
 const length=bytes.readUInt32LE(12),binHeader=20+length;
 if(bytes.readUInt32LE(16)!==0x4e4f534a||binHeader+8>bytes.length||bytes.readUInt32LE(binHeader+4)!==0x004e4942||binHeader+8+bytes.readUInt32LE(binHeader)!==bytes.length)throw new Error('Expected JSON and embedded BIN only');
 const doc=JSON.parse(bytes.subarray(20,20+length)),binary=bytes.subarray(binHeader+8),parts=[];
 if(doc.buffers?.length!==2||doc.buffers.some(b=>b.uri)||!doc.buffers[1].extensions?.EXT_meshopt_compression?.fallback)throw new Error('Expected this study required-extension format');
 let offset=0;
 for(const view of doc.bufferViews){
  const ext=view.extensions?.EXT_meshopt_compression;let data;
  if(ext){
   if(ext.buffer!==0||view.buffer!==1||(ext.filter??'NONE')!=='NONE'||ext.byteOffset+ext.byteLength>binary.length)throw new Error('Unsupported compression view');
   data=Buffer.alloc(ext.count*ext.byteStride);
   MeshoptDecoder.decodeGltfBuffer(data,ext.count,ext.byteStride,binary.subarray(ext.byteOffset,ext.byteOffset+ext.byteLength),ext.mode,ext.filter??'NONE');
   delete view.extensions.EXT_meshopt_compression;if(!Object.keys(view.extensions).length)delete view.extensions;
  }else{
   if(view.buffer!==0)throw new Error('Unexpected uncompressed buffer');
   data=Buffer.from(binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength));
   if(data.length!==view.byteLength)throw new Error('Truncated view');
  }
  view.buffer=0;view.byteOffset=offset;view.byteLength=data.length;parts.push(data);offset+=data.length;
  const pad=(4-offset%4)%4;if(pad){parts.push(Buffer.alloc(pad));offset+=pad;}
 }
 doc.buffers=[{byteLength:offset}];
 for(const key of ['extensionsUsed','extensionsRequired'])if(doc[key]){doc[key]=doc[key].filter(x=>x!=='EXT_meshopt_compression');if(!doc[key].length)delete doc[key];}
 return writeGlb(doc,Buffer.concat(parts));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const [input,output]=process.argv.slice(2);if(!input||!output)throw new Error('Usage: compressed.glb decoded.glb');
 if(path.resolve(input)===path.resolve(output))throw new Error('Preserve input: output must differ');
 const bytes=await decodeMeshopt(fs.readFileSync(input));fs.writeFileSync(output,bytes);console.log(JSON.stringify({output,bytes:bytes.length}));
}
