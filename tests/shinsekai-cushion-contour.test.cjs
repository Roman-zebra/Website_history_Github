const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {readGlb}=require('../scripts/shinsekai-glb-cell.cjs');
const {repairUpperCushion}=require('../scripts/shinsekai-glb-upper-cushion.cjs');
const {repairCabinetInk}=require('../scripts/shinsekai-glb-cabinet-ink.cjs');
const {roundCushionContour,contourFrame}=require('../scripts/shinsekai-glb-cushion-contour.cjs');
const original=fs.readFileSync(path.join(__dirname,'../assets-src/shinsekai/eval-building-a/hybrid/runtime/interior.glb'));
const source=repairCabinetInk(repairUpperCushion(original,{shiftY:.165,seamBottom:.04}).bytes).bytes;
const target=j=>j.meshes[j.nodes.find(n=>n.name==='Hybrid_Sonnet_upper').mesh].primitives.find(p=>j.materials[p.material]?.name==='CLOTH');
const block=(f,id)=>{const a=f.json.accessors[id],v=f.json.bufferViews[a.bufferView];return f.binary.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);};
test('contour control is exact and wrong source or unbounded strength cannot modify assets',()=>{
 assert.ok(roundCushionContour(source,{strength:0}).bytes.equals(source));assert.throws(()=>roundCushionContour(original));
 for(const strength of [.1,-1,1,NaN,Infinity])assert.throws(()=>roundCushionContour(source,{strength}));
 const corrupt=Buffer.from(source);corrupt[corrupt.length-1]^=1;assert.throws(()=>roundCushionContour(corrupt));
});
for(const strength of [.35,.65])test('contour '+strength+' preserves heights, fabric, cabinet and topology while normals remain orthonormal',()=>{
 const a=readGlb(source),r=roundCushionContour(source,{strength}),b=readGlb(r.bytes),p=target(a.json),q=target(b.json),ids=new Set(r.receipt.selectedVertexIds);
 assert.equal(ids.size,432);assert.ok(b.binary.subarray(0,a.binary.length).equals(a.binary));assert.equal(q.indices,p.indices);
 for(const name of Object.keys(a.json))if(!['meshes','accessors','bufferViews','buffers'].includes(name))assert.deepEqual(b.json[name],a.json[name],name);
 for(let i=0;i<a.json.meshes.length;i++)for(let k=0;k<a.json.meshes[i].primitives.length;k++)if(a.json.meshes[i].primitives[k]!==p)assert.deepEqual(b.json.meshes[i].primitives[k],a.json.meshes[i].primitives[k]);
 for(const [name,id]of Object.entries(p.attributes)){
  if(!['POSITION','NORMAL','TANGENT'].includes(name)){assert.equal(q.attributes[name],id);continue;}
  const old=block(a,id),fresh=block(b,q.attributes[name]),size=name==='TANGENT'?16:12;
  for(let i=0;i<1608;i++)if(!ids.has(i))assert.ok(old.subarray(i*size,(i+1)*size).equals(fresh.subarray(i*size,(i+1)*size)));
  for(const i of ids)if(name==='POSITION')assert.ok(old.subarray(i*12+4,i*12+8).equals(fresh.subarray(i*12+4,i*12+8)));else if(name==='TANGENT')assert.ok(old.subarray(i*16+12,i*16+16).equals(fresh.subarray(i*16+12,i*16+16)));
 }
 const n=block(b,q.attributes.NORMAL),t=block(b,q.attributes.TANGENT),pos=block(b,q.attributes.POSITION),idx=block(b,q.indices);
 for(const i of ids){const N=[0,1,2].map(k=>n.readFloatLE(i*12+k*4)),T=[0,1,2].map(k=>t.readFloatLE(i*16+k*4));assert.ok(Math.abs(Math.hypot(...N)-1)<1e-6);assert.ok(Math.abs(Math.hypot(...T)-1)<1e-6);assert.ok(Math.abs(N.reduce((s,x,k)=>s+x*T[k],0))<1e-6);}
 // No newly collapsed or inverted triangles after moving the actual float32 vertices.
 const oldpos=block(a,p.attributes.POSITION),point=(buf,i)=>[0,1,2].map(k=>buf.readFloatLE(i*12+k*4));
 const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 const normal=(buf,v)=>{const P=v.map(i=>point(buf,i));return cross(P[1].map((x,k)=>x-P[0][k]),P[2].map((x,k)=>x-P[0][k]));};
 for(let k=0;k<idx.length;k+=6){const v=[0,1,2].map(n=>idx.readUInt16LE(k+n*2));if(!v.every(i=>ids.has(i)))continue;const before=normal(oldpos,v),after=normal(pos,v);assert.ok(Math.hypot(...after)>1e-10);assert.ok(before.reduce((s,x,k)=>s+x*after[k],0)>0);}
});
test('analytic contour derivative agrees with finite differences through body and overhanging seam corners',()=>{
 for(const g of [.35,.65])for(const x of [-.287,-.18,0,.18,.287])for(const y of [-.287,-.18,0,.18,.287]){
  const f=contourFrame(x,y,g),h=1e-6;
  const dx=contourFrame(x+h,y,g).point.map((v,k)=>(v-contourFrame(x-h,y,g).point[k])/(2*h)),dy=contourFrame(x,y+h,g).point.map((v,k)=>(v-contourFrame(x,y-h,g).point[k])/(2*h));
  [dx[0],dy[0],dx[1],dy[1]].forEach((v,k)=>assert.ok(Math.abs(v-f.J[k])<1e-7));assert.ok(f.det>.25);
 }
});
