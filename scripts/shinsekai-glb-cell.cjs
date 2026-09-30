// Lossless local-study extraction; no mesh decoder or geometry resampling.
const fs=require('node:fs');
function readGlb(bytes){
 if(bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw new Error('Expected complete GLB2');
 let json,binary;
 for(let offset=12;offset<bytes.length;){const size=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4),chunk=bytes.subarray(offset+8,offset+8+size);if(type===0x4e4f534a)json=JSON.parse(chunk);if(type===0x004e4942)binary=chunk;offset+=8+size;}
 if(!json||!binary||json.buffers.length!==1||json.buffers[0].uri)throw new Error('Expected one embedded buffer');
 return {json,binary};
}
function writeGlb(json,binary){
 const raw=Buffer.from(JSON.stringify(json)),jb=Buffer.alloc(Math.ceil(raw.length/4)*4,0x20);raw.copy(jb);
 const bb=Buffer.alloc(Math.ceil(binary.length/4)*4);binary.copy(bb);
 const bytes=Buffer.alloc(28+jb.length+bb.length);bytes.writeUInt32LE(0x46546c67,0);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);
 bytes.writeUInt32LE(jb.length,12);bytes.writeUInt32LE(0x4e4f534a,16);jb.copy(bytes,20);bytes.writeUInt32LE(bb.length,20+jb.length);bytes.writeUInt32LE(0x004e4942,24+jb.length);bb.copy(bytes,28+jb.length);return bytes;
}
function extractRoot(input,name,{resetTranslation=false,excludeCollision=true}={}){
 const {json:j,binary}=Buffer.isBuffer(input)?readGlb(input):input;
 const clone=x=>JSON.parse(JSON.stringify(x));
 const out={asset:clone(j.asset),scene:0,scenes:[{nodes:[0]}],nodes:[],meshes:[],materials:[],textures:[],images:[],samplers:[],accessors:[],bufferViews:[],buffers:[{byteLength:0}]};
 const original=j.nodes.findIndex(n=>n.name===name);if(original<0)throw new Error('Missing root '+name);
 const ids=[];const walk=i=>{const n=j.nodes[i];if(excludeCollision&&(n.extras?.collision||n.name?.startsWith('COL_')))return;ids.push(i);for(const c of n.children??[])walk(c);};walk(original);
 const nodes=new Map(ids.map((n,i)=>[n,i]));
 const cache={mesh:new Map(),material:new Map(),texture:new Map(),image:new Map(),sampler:new Map(),accessor:new Map(),view:new Map(),light:new Map()};
 const chunks=[];let offset=0;
 function mapped(kind,id,build){const c=cache[kind];if(c.has(id))return c.get(id);const array=out[({mesh:'meshes',material:'materials',texture:'textures',image:'images',sampler:'samplers',accessor:'accessors',view:'bufferViews'})[kind]],index=array.length;c.set(id,index);array.push(null);array[index]=build();return index;}
 function view(id){return mapped('view',id,()=>{const v=clone(j.bufferViews[id]);if(v.buffer!==0||v.extensions)throw new Error('Unsupported buffer view');const start=v.byteOffset??0;const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}const bytes=binary.subarray(start,start+v.byteLength);if(bytes.length!==v.byteLength)throw new Error('Truncated view');v.byteOffset=offset;v.buffer=0;chunks.push(bytes);offset+=bytes.length;return v;});}
 function accessor(id){return mapped('accessor',id,()=>{const a=clone(j.accessors[id]);if(a.bufferView!==undefined)a.bufferView=view(a.bufferView);if(a.sparse){a.sparse.indices.bufferView=view(a.sparse.indices.bufferView);a.sparse.values.bufferView=view(a.sparse.values.bufferView);}return a;});}
 function image(id){return mapped('image',id,()=>{const i=clone(j.images[id]);if(i.uri||i.bufferView===undefined)throw new Error('Expected embedded image');i.bufferView=view(i.bufferView);return i;});}
 function texture(id){return mapped('texture',id,()=>{const t=clone(j.textures[id]);if(t.extensions)throw new Error('Compressed texture requires separate adapter');t.source=image(t.source);if(t.sampler!==undefined)t.sampler=mapped('sampler',t.sampler,()=>clone(j.samplers[t.sampler]));return t;});}
 function material(id){return mapped('material',id,()=>{const m=clone(j.materials[id]);function scan(x){for(const [key,v]of Object.entries(x)){if(v&&typeof v==='object'){if(key.endsWith('Texture')&&v.index!==undefined)v.index=texture(v.index);else scan(v);}}}scan(m);return m;});}
 function mesh(id){return mapped('mesh',id,()=>{const m=clone(j.meshes[id]);for(const p of m.primitives){if(p.extensions)throw new Error('Primitive extension requires separate adapter');for(const key of Object.keys(p.attributes))p.attributes[key]=accessor(p.attributes[key]);if(p.indices!==undefined)p.indices=accessor(p.indices);if(p.material!==undefined)p.material=material(p.material);for(const target of p.targets??[])for(const k of Object.keys(target))target[k]=accessor(target[k]);}return m;});}
 const lights=[];
 for(const id of ids){const n=clone(j.nodes[id]);if(n.skin!==undefined)throw new Error('Skinned node requires separate adapter');if(n.mesh!==undefined)n.mesh=mesh(n.mesh);delete n.camera;
  if(n.children)n.children=n.children.filter(c=>nodes.has(c)).map(c=>nodes.get(c));
  for(const [extension,v]of Object.entries(n.extensions??{})){
   if(extension==='KHR_lights_punctual'){const old=v.light;if(!cache.light.has(old)){cache.light.set(old,lights.length);lights.push(clone(j.extensions.KHR_lights_punctual.lights[old]));}v.light=cache.light.get(old);}
   else if(extension==='EXT_mesh_gpu_instancing'){for(const k of Object.keys(v.attributes))v.attributes[k]=accessor(v.attributes[k]);}
   else throw new Error('Unsupported node extension '+extension);
  }
  out.nodes.push(n);
 }
 if(resetTranslation){if(out.nodes[0].matrix)for(const k of [12,13,14])out.nodes[0].matrix[k]=0;else out.nodes[0].translation=[0,0,0];}
 const animations=[];
 for(const originalAnimation of j.animations??[]){const a=clone(originalAnimation);a.channels=a.channels.filter(c=>nodes.has(c.target.node));if(!a.channels.length)continue;const oldSamplers=a.samplers,newSamplers=[],samplerMap=new Map();for(const c of a.channels){c.target.node=nodes.get(c.target.node);const old=c.sampler;if(!samplerMap.has(old)){samplerMap.set(old,newSamplers.length);const s=clone(oldSamplers[old]);s.input=accessor(s.input);s.output=accessor(s.output);newSamplers.push(s);}c.sampler=samplerMap.get(old);}a.samplers=newSamplers;animations.push(a);}
 if(animations.length)out.animations=animations;
 if(lights.length)out.extensions={KHR_lights_punctual:{lights}};
 const used=new Set();function extensions(x){if(!x||typeof x!=='object')return;for(const [key,v]of Object.entries(x)){if(key==='extensions')Object.keys(v).forEach(e=>used.add(e));extensions(v);}}extensions(out);
 if(used.size)out.extensionsUsed=[...used];const required=(j.extensionsRequired??[]).filter(e=>used.has(e));if(required.length)out.extensionsRequired=required;
 for(const key of ['meshes','materials','textures','images','samplers','accessors','bufferViews'])if(!out[key].length)delete out[key];
 out.buffers[0].byteLength=offset;
 return writeGlb(out,Buffer.concat(chunks));
}
module.exports={readGlb,writeGlb,extractRoot};
if(require.main===module){const [input,root,output]=process.argv.slice(2);if(!input||!root||!output)throw new Error('Usage: input.glb root output.glb');fs.writeFileSync(output,extractRoot(fs.readFileSync(input),root,{resetTranslation:root.startsWith('cell_')}));console.log(output);}
