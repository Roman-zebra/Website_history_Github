// Scoped horizontal contour study on the verified cabinet001/cushion003 input.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {readGlb,writeGlb}=require('./shinsekai-glb-cell.cjs');
const SOURCE_SHA='09a0e26d91da8775e29f32cb9967f348f7f519b0df7bfc317fa333445c583397';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const unit=v=>{const n=Math.hypot(...v);assert.ok(Number.isFinite(n)&&n>1e-10);return v.map(x=>x/n);};
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const c=Math.cos(.4),s=Math.sin(.4),half=.275;
// Orthonormal glTF-world to cushion-local frame (local Z is world Y).
const localVector=p=>[c*p[0]-s*p[2],-s*p[0]-c*p[2],p[1]];
const worldVector=p=>[c*p[0]-s*p[1],p[2],-s*p[0]-c*p[1]];
function contourFrame(x,y,g){
 const u=x/half,v=y/half,a=Math.sqrt(1-g*v*v/2),b=Math.sqrt(1-g*u*u/2);
 assert.ok(Number.isFinite(a)&&Number.isFinite(b));
 const J=[a,-g*u*v/(2*a),-g*u*v/(2*b),b],det=J[0]*J[3]-J[1]*J[2];assert.ok(det>.25,'Contour folds over');
 return {point:[x*a,y*b],J,det};
}
function roundCushionContour(bytes,{strength=.35}={}){
 assert.ok([0,.35,.65].includes(strength),'Unexpected bounded contour strength');
 assert.equal(sha(bytes),SOURCE_SHA,'Contour requires retained cabinet001/cushion003 source');
 if(strength===0)return {bytes:Buffer.from(bytes),receipt:{sourceSHA256:SOURCE_SHA,strength,exactIdentity:true,extraTriangles:0,extraDraws:0}};
 const src=readGlb(bytes),j=JSON.parse(JSON.stringify(src.json)),node=j.nodes.find(n=>n.name==='Hybrid_Sonnet_upper');
 assert.ok(node&&!node.matrix&&!node.translation&&!node.rotation&&!node.scale&&!node.skin);
 assert.equal(j.nodes.filter(n=>n.mesh===node.mesh).length,1);
 const p=j.meshes[node.mesh].primitives.find(p=>j.materials[p.material]?.name==='CLOTH');assert.ok(p&&p.indices!==undefined&&!p.targets&&!p.extensions&&(p.mode??4)===4);
 const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},sizes={5123:2,5126:4};
 function data(id){const a=j.accessors[id],v=j.bufferViews[a.bufferView],size=widths[a.type]*sizes[a.componentType];assert.ok(size&&!a.sparse&&!a.byteOffset&&!a.extensions&&!v.extensions&&!v.byteStride&&v.buffer===0);assert.equal(v.byteLength,a.count*size);return {a,size,bytes:src.binary.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength)};}
 const attrs=Object.fromEntries(Object.entries(p.attributes).map(([n,id])=>[n,data(id)])),pos=attrs.POSITION,ind=data(p.indices);
 assert.equal(pos.a.count,1608);assert.equal(pos.a.type,'VEC3');assert.equal(pos.a.componentType,5126);assert.equal(ind.a.componentType,5123);
 for(const a of Object.values(attrs))assert.equal(a.a.count,1608);
 assert.equal(attrs.NORMAL.a.type,'VEC3');assert.equal(attrs.TANGENT.a.type,'VEC4');
 const point=i=>[0,1,2].map(k=>pos.bytes.readFloatLE(i*12+k*4));
 const inside=q=>q[0]>2.79&&q[0]<3.61&&q[1]>3.45&&q[1]<3.54&&q[2]>-5.63&&q[2]<-4.80;
 const selected=new Set(),triangles=[];
 for(let n=0;n<ind.a.count;n+=3){const t=[0,1,2].map(k=>ind.bytes.readUInt16LE((n+k)*2));if(t.every(i=>inside(point(i)))){triangles.push(t);t.forEach(i=>selected.add(i));}}
 assert.equal(triangles.length,240);assert.equal(selected.size,432);
 const buffers=Object.fromEntries(['POSITION','NORMAL','TANGENT'].map(n=>[n,Buffer.from(attrs[n].bytes)]));let minDet=1;
 for(const i of selected){
  // Four original seam patches extend12mm beyond the55cm body; deform them too.
  const old=point(i),loc=localVector([old[0]-3.2,old[1],old[2]+5.215]);assert.ok(Math.abs(loc[0])<=half+.012+1e-6&&Math.abs(loc[1])<=half+.012+1e-6);
  const {point:q,J,det}=contourFrame(loc[0],loc[1],strength);minDet=Math.min(minDet,det);
  const next=worldVector([q[0],q[1],old[1]]);next[0]+=3.2;next[2]-=5.215;
  // Only X/Z are written: world Y/elevation retains exact Float32 bytes.
  buffers.POSITION.writeFloatLE(next[0],i*12);buffers.POSITION.writeFloatLE(next[2],i*12+8);
  const read=n=>[0,1,2].map(k=>attrs[n].bytes.readFloatLE(i*attrs[n].size+k*4));
  const n=localVector(read('NORMAL')),t=localVector(read('TANGENT'));
  const normal=unit(worldVector([(J[3]*n[0]-J[2]*n[1])/det,(-J[1]*n[0]+J[0]*n[1])/det,n[2]]));
  const tangent=worldVector([J[0]*t[0]+J[1]*t[1],J[2]*t[0]+J[3]*t[1],t[2]]),d=dot(normal,tangent),orthogonal=unit(tangent.map((v,k)=>v-d*normal[k]));
  normal.forEach((v,k)=>buffers.NORMAL.writeFloatLE(v,i*12+k*4));orthogonal.forEach((v,k)=>buffers.TANGENT.writeFloatLE(v,i*16+k*4));
 }
 const chunks=[src.binary];let offset=src.binary.length;
 for(const [name,buffer]of Object.entries(buffers)){
  const a={...attrs[name].a};if(name==='POSITION'){const points=Array.from({length:a.count},(_,i)=>[0,1,2].map(k=>buffer.readFloatLE(i*12+4*k)));a.min=[0,1,2].map(k=>Math.min(...points.map(p=>p[k])));a.max=[0,1,2].map(k=>Math.max(...points.map(p=>p[k])));}
  a.bufferView=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:buffer.length});chunks.push(buffer);offset+=buffer.length;assert.equal(offset%4,0);p.attributes[name]=j.accessors.length;j.accessors.push(a);
 }
 j.buffers[0].byteLength=offset;const out=writeGlb(j,Buffer.concat(chunks));assert.ok(readGlb(out).binary.subarray(0,src.binary.length).equals(src.binary));
 return {bytes:out,receipt:{sourceSHA256:SOURCE_SHA,candidateSHA256:sha(out),strength,selectedVertexIds:[...selected],selectedTriangles:triangles.length,minimumJacobianDeterminant:minDet,sourceBinaryPrefixExact:true,elevationsByteExact:true,UVColoursMaterialsIndicesUnchanged:true,normalMethod:'Analytic Jacobian inverse transpose; tangent direct derivative reorthogonalized; W unchanged',extraTriangles:0,extraDraws:0,extraMaps:0,extraBytes:out.length-bytes.length,nativeVerified:false,phoneMeasured:false}};
}
module.exports={roundCushionContour,contourFrame,SOURCE_SHA};
if(require.main===module){const [input,output,receipt,strength]=process.argv.slice(2);assert.ok(input&&output&&receipt);assert.ok(!fs.existsSync(output)&&!fs.existsSync(receipt),'Preserve numbered outputs');const r=roundCushionContour(fs.readFileSync(input),{strength:Number(strength??.35)});fs.writeFileSync(output,r.bytes);fs.writeFileSync(receipt,JSON.stringify(r.receipt,null,2)+'\n');console.log(JSON.stringify({...r.receipt,selectedVertexIds:r.receipt.selectedVertexIds?.length??0,bytes:r.bytes.length}));}
