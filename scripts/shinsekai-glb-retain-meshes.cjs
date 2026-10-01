// Freeze unchanged study meshes after verifying every oriented triangle corner.
// Process-salted exporter tint jitter can also reorder/merge duplicate vertices.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {readGlb,writeGlb}=require('./shinsekai-glb-cell.cjs');
const clone=value=>JSON.parse(JSON.stringify(value));
const components={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
function attribute(asset,id){
 const accessor=asset.json.accessors[id],view=asset.json.bufferViews[accessor.bufferView];
 if(view.buffer!==0||view.extensions||view.byteStride||accessor.byteOffset||accessor.sparse)throw new Error('Expected standalone raw accessor');
 const bytes=asset.binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength),stride=components[accessor.componentType]*widths[accessor.type];
 if(!Number.isInteger(stride)||bytes.length!==accessor.count*stride)throw new Error('Truncated/padded/unsupported accessor');
 return {accessor,view,bytes,stride};
}
function indexValues(asset,id){
 const a=attribute(asset,id),size=components[a.accessor.componentType];
 if(a.accessor.type!=='SCALAR'||![5123,5125].includes(a.accessor.componentType)||a.accessor.count%3)throw new Error('Expected triangle indices');
 return Array.from({length:a.accessor.count},(_,i)=>size===2?a.bytes.readUInt16LE(i*size):a.bytes.readUInt32LE(i*size));
}
function retainMeshes(sourceBytes,candidateBytes,names){
 const source=readGlb(sourceBytes),candidate=readGlb(candidateBytes),j=candidate.json;
 if(j.meshes.some(m=>m.primitives.some(p=>p.extensions)))throw new Error('Primitive extensions require another compaction adapter');
 const sourceAccessors=new Map(),sourceViews=new Map(),replacementBytes=new Map(),processedMeshes=new Set();
 function copyAccessor(id){
  if(sourceAccessors.has(id))return sourceAccessors.get(id);
  const {accessor,view,bytes}=attribute(source,id),a=clone(accessor),old=a.bufferView;
  if(!sourceViews.has(old)){
   const index=j.bufferViews.length;j.bufferViews.push(clone(view));sourceViews.set(old,index);replacementBytes.set(index,Buffer.from(bytes));
  }
  a.bufferView=sourceViews.get(old);const index=j.accessors.length;j.accessors.push(a);sourceAccessors.set(id,index);return index;
 }
 let retained=0;
 for(const name of names){
  const an=source.json.nodes.find(n=>n.name===name),bn=j.nodes.find(n=>n.name===name);
  if(!an||!bn||an.mesh===undefined||bn.mesh===undefined)throw new Error('Missing mesh '+name);
  if(an.skin!==undefined||bn.skin!==undefined)throw new Error('Expected unskinned study mesh');
  if(processedMeshes.has(bn.mesh))throw new Error('Expected distinct target meshes');processedMeshes.add(bn.mesh);
  const ap=source.json.meshes[an.mesh].primitives,bp=j.meshes[bn.mesh].primitives;
  assert.equal(ap.length,bp.length,name+' primitives');
  const replacements=[];
  for(let i=0;i<ap.length;i++){
   const a=ap[i],b=bp[i];
   if((a.mode??4)!==4||(b.mode??4)!==4||a.targets||b.targets||a.extensions||b.extensions)throw new Error('Expected plain static triangles');
   assert.equal(source.json.materials[a.material].name,j.materials[b.material].name,name+' material');
   assert.deepEqual(Object.keys(a.attributes).sort(),Object.keys(b.attributes).sort(),name+' attribute set');
   const ai=indexValues(source,a.indices),bi=indexValues(candidate,b.indices);
   assert.equal(ai.length,bi.length,name+' corner count');
   // Verify positions, normals, UV0 and ordered, oriented triangles, allowing
   // different allocation of tint/UV1 duplicates before grafting frozen data.
   for(const key of ['POSITION','NORMAL','TEXCOORD_0']){
    if(a.attributes[key]===undefined)continue;
    const av=attribute(source,a.attributes[key]),bv=attribute(candidate,b.attributes[key]);
    for(const meta of ['componentType','type','normalized'])assert.equal(av.accessor[meta],bv.accessor[meta],name+' '+key+' metadata');
    for(let k=0;k<ai.length;k++){
     const x=ai[k],y=bi[k];assert.ok(x<av.accessor.count&&y<bv.accessor.count,name+' index bounds');
     assert.ok(av.bytes.subarray(x*av.stride,(x+1)*av.stride).equals(bv.bytes.subarray(y*bv.stride,(y+1)*bv.stride)),name+' oriented triangle differs');
    }
   }
   const p=clone(a);p.material=b.material;p.indices=copyAccessor(a.indices);
   for(const key of Object.keys(p.attributes))p.attributes[key]=copyAccessor(a.attributes[key]);
   replacements.push(p);retained++;
  }
  j.meshes[bn.mesh].primitives=replacements;
 }
 // Compact referenced raw views; never leave doubled ghost mesh data.
 const refs=[],ref=(object,key)=>{if(object[key]!==undefined)refs.push([object,key]);};
 for(const m of j.meshes)for(const p of m.primitives){for(const key of Object.keys(p.attributes))ref(p.attributes,key);ref(p,'indices');for(const target of p.targets??[])for(const key of Object.keys(target))ref(target,key);}
 for(const a of j.animations??[])for(const s of a.samplers){ref(s,'input');ref(s,'output');}
 for(const s of j.skins??[])ref(s,'inverseBindMatrices');
 for(const n of j.nodes)if(n.extensions?.EXT_mesh_gpu_instancing)for(const key of Object.keys(n.extensions.EXT_mesh_gpu_instancing.attributes))ref(n.extensions.EXT_mesh_gpu_instancing.attributes,key);
 const used=[...new Set(refs.map(([o,k])=>o[k]))].sort((a,b)=>a-b),amap=new Map(used.map((id,i)=>[id,i])),accessors=used.map(id=>j.accessors[id]);
 if(accessors.some(a=>a.sparse||a.bufferView===undefined))throw new Error('Sparse/implicit compaction requires another adapter');
 refs.forEach(([o,k])=>{o[k]=amap.get(o[k]);});
 const viewIds=[...new Set([...accessors.map(a=>a.bufferView),...(j.images??[]).filter(i=>i.bufferView!==undefined).map(i=>i.bufferView)])].sort((a,b)=>a-b);
 const vmap=new Map(viewIds.map((id,i)=>[id,i])),parts=[],views=[];let offset=0;
 for(const id of viewIds){
  const v=clone(j.bufferViews[id]);if(v.buffer!==0||v.extensions)throw new Error('Expected raw embedded view');
  const bytes=replacementBytes.get(id)??candidate.binary.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);
  if(bytes.length!==v.byteLength)throw new Error('Truncated view');
  v.byteOffset=offset;views.push(v);parts.push(bytes);offset+=bytes.length;
  const pad=(4-offset%4)%4;if(pad){parts.push(Buffer.alloc(pad));offset+=pad;}
 }
 accessors.forEach(a=>{a.bufferView=vmap.get(a.bufferView);});
 for(const image of j.images??[])if(image.bufferView!==undefined)image.bufferView=vmap.get(image.bufferView);
 j.accessors=accessors;j.bufferViews=views;j.buffers=[{byteLength:offset}];
 return {bytes:writeGlb(j,Buffer.concat(parts)),retainedPrimitives:retained};
}
module.exports={retainMeshes};
if(require.main===module){
 const [source,input,output,...names]=process.argv.slice(2);
 if(!source||!input||!output||!names.length)throw new Error('Usage: frozen.glb candidate.glb output.glb meshNames...');
 if([source,input].some(f=>path.resolve(f)===path.resolve(output)))throw new Error('Preserve inputs: use a separate output');
 const result=retainMeshes(fs.readFileSync(source),fs.readFileSync(input),names);fs.writeFileSync(output,result.bytes);console.log(JSON.stringify({output,retainedPrimitives:result.retainedPrimitives}));
}
