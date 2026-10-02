const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {readGlb}=require('../scripts/shinsekai-glb-cell.cjs');
const {repairUpperCushion}=require('../scripts/shinsekai-glb-upper-cushion.cjs');
const {repairCabinetInk}=require('../scripts/shinsekai-glb-cabinet-ink.cjs');
const {roundCushionContour,contourFrame}=require('../scripts/shinsekai-glb-cushion-contour.cjs');
const {thickenCushionPerimeter,perimeterFrame}=require('../scripts/shinsekai-glb-cushion-perimeter.cjs');
const original=fs.readFileSync(path.join(__dirname,'../assets-src/shinsekai/eval-building-a/hybrid/runtime/interior.glb'));
const guide=repairCabinetInk(repairUpperCushion(original,{shiftY:.165,seamBottom:.04}).bytes).bytes;
const source=roundCushionContour(guide,{strength:.35}).bytes;
const target=j=>j.meshes[j.nodes.find(n=>n.name==='Hybrid_Sonnet_upper').mesh].primitives.find(p=>j.materials[p.material]?.name==='CLOTH');
const block=(f,id)=>{const a=f.json.accessors[id],v=f.json.bufferViews[a.bufferView];return f.binary.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);};
test('perimeter null control is exact; other contour, guide or unbounded profile cannot silently alter source',()=>{
 assert.ok(thickenCushionPerimeter(source,guide,{gap:.003}).bytes.equals(source));
 assert.throws(()=>thickenCushionPerimeter(guide,guide));assert.throws(()=>thickenCushionPerimeter(source,original));assert.throws(()=>thickenCushionPerimeter(roundCushionContour(guide,{strength:.65}).bytes,guide));
 for(const gap of [-1,.01,.08,NaN,Infinity])assert.throws(()=>thickenCushionPerimeter(source,guide,{gap}));
});
for(const gap of [.022,.04])test('perimeter '+gap+' preserves footprint, floor, corner patches, fabric and neighbours with actual target gap',()=>{
 const a=readGlb(source),r=thickenCushionPerimeter(source,guide,{gap}),b=readGlb(r.bytes),p=target(a.json),q=target(b.json),ids=new Set(r.receipt.bodyVertexIds);
 assert.equal(ids.size,336);assert.ok(b.binary.subarray(0,a.binary.length).equals(a.binary));assert.equal(q.indices,p.indices);
 for(const name of Object.keys(a.json))if(!['meshes','accessors','bufferViews','buffers'].includes(name))assert.deepEqual(b.json[name],a.json[name],name);
 for(let i=0;i<a.json.meshes.length;i++)for(let k=0;k<a.json.meshes[i].primitives.length;k++)if(a.json.meshes[i].primitives[k]!==p)assert.deepEqual(b.json.meshes[i].primitives[k],a.json.meshes[i].primitives[k]);
 const pos=block(b,q.attributes.POSITION),oldPos=block(a,p.attributes.POSITION),n=block(b,q.attributes.NORMAL),t=block(b,q.attributes.TANGENT),idx=block(b,q.indices);
 for(const [name,id]of Object.entries(p.attributes)){
  if(!['POSITION','NORMAL','TANGENT'].includes(name)){assert.equal(q.attributes[name],id);continue;}
  const old=block(a,id),fresh=block(b,q.attributes[name]),size=name==='TANGENT'?16:12;
  for(let i=0;i<1608;i++){
   const onFloor=Math.abs(oldPos.readFloatLE(i*12+4)-3.455)<1e-6;
   if(!ids.has(i)||onFloor)assert.ok(old.subarray(i*size,(i+1)*size).equals(fresh.subarray(i*size,(i+1)*size)),name+' '+i);
   if(name==='POSITION'){assert.equal(old.readUInt32LE(i*12),fresh.readUInt32LE(i*12));assert.equal(old.readUInt32LE(i*12+8),fresh.readUInt32LE(i*12+8));}
   if(name==='TANGENT')assert.equal(old.readUInt32LE(i*16+12),fresh.readUInt32LE(i*16+12));
  }
 }
 const heights=[...ids].map(i=>pos.readFloatLE(i*12+4));assert.ok(Math.abs(Math.min(...heights)-3.455)<1e-6);assert.ok(Math.abs(Math.max(...heights)-3.535)<1e-6);
 // Independent pre-contour grid selects the real perimeter after horizontal deformation.
 const g=readGlb(guide),gp=block(g,target(g.json).attributes.POSITION),c=Math.cos(.4),s=Math.sin(.4),edge=[];
 for(const i of ids){const x=gp.readFloatLE(i*12)-3.2,y=-gp.readFloatLE(i*12+8)-5.215,u=x*c+y*s,v=y*c-x*s;if(Math.abs(Math.abs(u)-.275)<1e-5||Math.abs(Math.abs(v)-.275)<1e-5)edge.push(pos.readFloatLE(i*12+4)-3.455);const N=[0,1,2].map(k=>n.readFloatLE(i*12+k*4)),T=[0,1,2].map(k=>t.readFloatLE(i*16+k*4));assert.ok(Math.abs(Math.hypot(...N)-1)<1e-6);assert.ok(Math.abs(Math.hypot(...T)-1)<1e-6);assert.ok(Math.abs(N.reduce((s,x,k)=>s+x*T[k],0))<1e-6);}
 assert.ok(edge.length);for(const h of edge)assert.ok(Math.min(Math.abs(h-(.0415-gap/2)),Math.abs(h-(.0415+gap/2)))<1e-6);assert.ok(Math.abs(Math.max(...edge)-Math.min(...edge)-gap)<1e-6);
 const point=(buf,i)=>[0,1,2].map(k=>buf.readFloatLE(i*12+k*4)),cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],normal=(buf,v)=>{const P=v.map(i=>point(buf,i));return cross(P[1].map((x,k)=>x-P[0][k]),P[2].map((x,k)=>x-P[0][k]));};
 for(let k=0;k<idx.length;k+=6){const v=[0,1,2].map(n=>idx.readUInt16LE(k+n*2));if(!v.every(i=>ids.has(i)))continue;const before=normal(oldPos,v),after=normal(pos,v);assert.ok(Math.hypot(...after)>1e-10);assert.ok(before.reduce((s,x,k)=>s+x*after[k],0)>0);}
});
test('vertical height gradients agree with finite differences through the retained curved horizontal map',()=>{
 for(const gap of [.003,.022,.04])for(const upper of [true,false])for(const x of [-.20,-.10,.12,.23])for(const y of [-.21,-.09,.13,.22]){
  const f=perimeterFrame(x,y,upper,gap);if(Math.abs(f.fill-.65)<1e-4)continue;const h=1e-6,dx=(perimeterFrame(x+h,y,upper,gap).h-perimeterFrame(x-h,y,upper,gap).h)/(2*h),dy=(perimeterFrame(x,y+h,upper,gap).h-perimeterFrame(x,y-h,upper,gap).h)/(2*h),{J}=contourFrame(x,y,.35);
  assert.ok(Math.abs(f.gradient[0]*J[0]+f.gradient[1]*J[2]-dx)<1e-7);assert.ok(Math.abs(f.gradient[0]*J[1]+f.gradient[1]*J[3]-dy)<1e-7);
 }
});
