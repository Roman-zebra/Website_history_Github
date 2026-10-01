// Only replace the connected cloth mesh; keep all frozen image/mesh bytes.
// Reject unrelated shape, UV, colour, material, transform or clip changes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {readGlb,writeGlb}=require('./shinsekai-glb-cell.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},sizes={5121:1,5123:2,5125:4,5126:4};
function attribute(asset,id){
 const a=asset.json.accessors[id],v=asset.json.bufferViews[a.bufferView],stride=widths[a.type]*sizes[a.componentType];
 assert.ok(v.buffer===0&&!v.extensions&&!v.byteStride&&!a.byteOffset&&!a.sparse&&!a.extensions&&Number.isInteger(stride)&&Number.isInteger(a.count)&&a.count>0,'Expected standalone raw accessor');
 const bytes=asset.binary.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);
 assert.equal(bytes.length,a.count*stride,'Accessor length');return {a,v,bytes,stride};
}
function indices(asset,id){
 const d=attribute(asset,id);assert.ok(d.a.type==='SCALAR'&&[5123,5125].includes(d.a.componentType)&&d.a.count%3===0,'Expected triangle indices');
 return Array.from({length:d.a.count},(_,i)=>d.a.componentType===5123?d.bytes.readUInt16LE(i*2):d.bytes.readUInt32LE(i*4));
}
function retainCloth(sourceBytes,candidateBytes,{target='Haori_connected'}={}){
 const a=readGlb(sourceBytes),b=readGlb(candidateBytes),j=clone(a.json);
 for(const key of ['nodes','scenes','scene','materials','textures','samplers','skins','animations','extensions','extensionsUsed','extensionsRequired'])assert.deepEqual(b.json[key],a.json[key],key+' changed');
 assert.equal(a.json.meshes.length,b.json.meshes.length,'Mesh count');
 const n=j.nodes.find(n=>n.name===target);assert.ok(n&&n.mesh!==undefined&&n.skin===undefined,'Missing static cloth target');
 assert.equal(j.nodes.filter(x=>x.mesh===n.mesh).length,1,'Shared target mesh');
 assert.equal(a.json.images?.length??0,b.json.images?.length??0,'Image count');
 for(let i=0;i<(a.json.images?.length??0);i++){
  const x=a.json.images[i],y=b.json.images[i];assert.deepEqual({...x,bufferView:0},{...y,bufferView:0},'Image contract');
  const xv=a.json.bufferViews[x.bufferView],yv=b.json.bufferViews[y.bufferView];
  assert.ok(a.binary.subarray(xv.byteOffset??0,(xv.byteOffset??0)+xv.byteLength).equals(b.binary.subarray(yv.byteOffset??0,(yv.byteOffset??0)+yv.byteLength)),'Image changed');
 }
 let maxDiscardedNormalDelta=0;
 for(let i=0;i<j.meshes.length;i++){
  const x=a.json.meshes[i],y=b.json.meshes[i];assert.deepEqual({...x,primitives:[]},{...y,primitives:[]},'Mesh contract');
  assert.equal(x.primitives.length,y.primitives.length,'Primitive count');
  for(let k=0;k<x.primitives.length;k++){
   const p=x.primitives[k],q=y.primitives[k];assert.deepEqual({...p,attributes:{},indices:0},{...q,attributes:{},indices:0},'Primitive contract');
   assert.ok(!p.extensions&&!p.targets&&(p.mode??4)===4,'Expected plain static triangles');
   assert.deepEqual(Object.keys(p.attributes).sort(),Object.keys(q.attributes).sort(),'Attribute set');
   const pi=indices(a,p.indices),qi=indices(b,q.indices);assert.equal(pi.length,qi.length,'Unchanged mesh triangle count');
   for(const key of Object.keys(p.attributes)){
    const av=attribute(a,p.attributes[key]),bv=attribute(b,q.attributes[key]);
    for(const meta of ['type','componentType','normalized'])assert.equal(av.a[meta],bv.a[meta],'Unchanged attribute contract');
    assert.ok(pi.every(index=>index<av.a.count)&&qi.every(index=>index<bv.a.count),'Triangle index out of bounds');
    // Exported vertex splits may change with normals/UVs; triangle count and
    // accessor contracts stay fixed. Closed-body connectivity is audited later.
    if(i===n.mesh)continue;
    for(let c=0;c<pi.length;c++){
     const left=av.bytes.subarray(pi[c]*av.stride,(pi[c]+1)*av.stride),right=bv.bytes.subarray(qi[c]*bv.stride,(qi[c]+1)*bv.stride);
     if(['NORMAL','TANGENT'].includes(key)&&av.a.componentType===5126){
      for(let d=0;d<av.stride;d+=4){const delta=Math.abs(left.readFloatLE(d)-right.readFloatLE(d));assert.ok(Number.isFinite(delta)&&delta<=5e-4,'Unrelated normal drift exceeds bound');maxDiscardedNormalDelta=Math.max(maxDiscardedNormalDelta,delta);}
     }else assert.ok(left.equals(right),'Unchanged mesh '+key+' differs');
    }
   }
  }
 }
 const ap=a.json.meshes[n.mesh].primitives,bp=b.json.meshes[n.mesh].primitives;
 const sameTarget=ap.every((p,i)=>[...Object.keys(p.attributes),'indices'].every(key=>{
  const x=attribute(a,key==='indices'?p.indices:p.attributes[key]),y=attribute(b,key==='indices'?bp[i].indices:bp[i].attributes[key]);
  return x.a.count===y.a.count&&x.a.type===y.a.type&&x.a.componentType===y.a.componentType&&x.a.normalized===y.a.normalized&&x.bytes.equals(y.bytes);
 }));
 if(sameTarget)return {bytes:Buffer.from(sourceBytes),targetUnchanged:true,maxDiscardedNormalDelta,originalBinaryBytes:a.binary.length};
 const chunks=[a.binary],accessorIds=new Map();let offset=a.binary.length;
 function append(id){
  if(accessorIds.has(id))return accessorIds.get(id);
  const data=attribute(b,id),view=clone(data.v),acc=clone(data.a);
  view.byteOffset=offset;const vi=j.bufferViews.length;j.bufferViews.push(view);acc.bufferView=vi;
  const ai=j.accessors.length;j.accessors.push(acc);accessorIds.set(id,ai);chunks.push(data.bytes);offset+=data.bytes.length;
  const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return ai;
 }
 j.meshes[n.mesh].primitives=bp.map(p=>{const q=clone(p);q.indices=append(p.indices);for(const key of Object.keys(p.attributes))q.attributes[key]=append(p.attributes[key]);return q;});
 j.buffers[0].byteLength=offset;
 return {bytes:writeGlb(j,Buffer.concat(chunks)),targetUnchanged:false,maxDiscardedNormalDelta,originalBinaryBytes:a.binary.length};
}
module.exports={retainCloth};
if(require.main===module){
 const [source,candidate,out]=process.argv.slice(2);if(!source||!candidate||!out)throw new Error('Usage: frozen.glb candidate.glb separate-output.glb');
 if([source,candidate].some(p=>path.resolve(p)===path.resolve(out)))throw new Error('Preserve source/candidate inputs');
 const result=retainCloth(fs.readFileSync(source),fs.readFileSync(candidate));fs.writeFileSync(out,result.bytes);
 console.log(JSON.stringify({out,targetUnchanged:result.targetUnchanged,maxDiscardedNormalDelta:result.maxDiscardedNormalDelta,originalBinaryBytes:result.originalBinaryBytes}));
}
