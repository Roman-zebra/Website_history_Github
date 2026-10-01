// Local authoring only. The caller supplies the official Meshoptimizer encoder;
// no quantization, filters, image resampling or scene/material rewrite.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {readGlb,writeGlb} from './shinsekai-glb-cell.cjs';

export async function packMeshopt(bytes,encoder){
 await encoder.ready;
 if(!encoder.supported)throw new Error('Meshoptimizer encoder unavailable');
 const {json:doc,binary}=readGlb(bytes),parts=[];
 const indices=new Set((doc.meshes??[]).flatMap(m=>m.primitives.map(p=>p.indices).filter(i=>i!==undefined)));
 const components={5121:1,5123:2,5125:4,5126:4},widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
 if((doc.accessors??[]).some(a=>a.sparse))throw new Error('Sparse accessors require a separate adapter');
 if((doc.meshes??[]).some(m=>m.primitives.some(p=>p.indices!==undefined&&(p.mode??4)!==4)))throw new Error('Only triangle indices supported');
 let offset=0;
 for(let vi=0;vi<(doc.bufferViews??[]).length;vi++){
  const view=doc.bufferViews[vi],accessors=(doc.accessors??[]).map((a,i)=>({a,i})).filter(({a})=>a.bufferView===vi);
  if(view.buffer!==0||view.extensions)throw new Error('Expected uncompressed embedded buffer view '+vi);
  const start=view.byteOffset??0,raw=Buffer.from(binary.subarray(start,start+view.byteLength));
  if(raw.length!==view.byteLength)throw new Error('Truncated buffer view '+vi);
  let data=raw;
  if(accessors.length){
   const [{a,i}]=accessors,stride=view.byteStride??components[a.componentType]*widths[a.type],index=indices.has(i);
   if(accessors.length!==1||a.byteOffset||!Number.isInteger(stride)||raw.length!==a.count*stride)throw new Error('Shared, offset, padded or unsupported view '+vi);
   if(index&&(a.type!=='SCALAR'||![5123,5125].includes(a.componentType)||a.count%3))throw new Error('Unsupported triangle index view '+vi);
   if(!index&&(stride%4||stride>256))throw new Error('Unsupported attribute stride '+vi);
   data=encoder.encodeGltfBuffer(raw,a.count,stride,index?'TRIANGLES':'ATTRIBUTES');
   view.buffer=1;
   view.extensions={EXT_meshopt_compression:{buffer:0,byteOffset:offset,byteLength:data.length,byteStride:stride,count:a.count,mode:index?'TRIANGLES':'ATTRIBUTES',filter:'NONE'}};
  }else{view.buffer=0;view.byteOffset=offset;}
  parts.push(data);offset+=data.length;
  const pad=(4-offset%4)%4;if(pad){parts.push(Buffer.alloc(pad));offset+=pad;}
 }
 doc.buffers=[{byteLength:offset},{byteLength:binary.length,extensions:{EXT_meshopt_compression:{fallback:true}}}];
 for(const key of ['extensionsUsed','extensionsRequired'])doc[key]=[...new Set([...(doc[key]??[]),'EXT_meshopt_compression'])];
 return writeGlb(doc,Buffer.concat(parts));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const [input,output,encoderFile]=process.argv.slice(2);
 if(!input||!output||!encoderFile)throw new Error('Usage: input.glb output.glb path/to/official/meshopt_encoder.js');
 if(path.resolve(input)===path.resolve(output))throw new Error('Preserve source: output must differ from input');
 const {MeshoptEncoder}=await import(pathToFileURL(path.resolve(encoderFile)).href);
 const bytes=await packMeshopt(fs.readFileSync(input),MeshoptEncoder);
 fs.writeFileSync(output,bytes);console.log(JSON.stringify({output,bytes:bytes.length}));
}
