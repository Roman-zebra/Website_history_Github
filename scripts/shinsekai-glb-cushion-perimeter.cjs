// Vertical profile only on contour004g.35; preserved pre-contour guide fixes UV grid.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {readGlb,writeGlb}=require('./shinsekai-glb-cell.cjs');
const {contourFrame}=require('./shinsekai-glb-cushion-contour.cjs');
const SOURCE_SHA='e50d117a0249d3d5cc6478c139ef8366d47fc511052531aad9f0862c7bd68b7d',GUIDE_SHA='09a0e26d91da8775e29f32cb9967f348f7f519b0df7bfc317fa333445c583397';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),key=p=>p.map(v=>Math.round(v*1e5)).join(',');
const c=Math.cos(.4),s=Math.sin(.4),floor=3.455;
const local=p=>[c*p[0]-s*p[2],-s*p[0]-c*p[2],p[1]],world=p=>[c*p[0]-s*p[1],p[2],-s*p[0]-c*p[1]];
const unit=v=>{const n=Math.hypot(...v);assert.ok(Number.isFinite(n)&&n>1e-10);return v.map(x=>x/n);};
function perimeterFrame(x,y,upper,gap){
 assert.ok([.003,.022,.040].includes(gap));assert.ok(Math.abs(x)<=.275+1e-6&&Math.abs(y)<=.275+1e-6);
 const u=Math.max(0,Math.min(1,x/.55+.5)),v=Math.max(0,Math.min(1,y/.55+.5)),fill=Math.max(0,Math.sin(Math.PI*u)*Math.sin(Math.PI*v)),delta=(gap-.003)/2;
 const active=upper||fill<.65,scale=upper?-delta:active?delta/.65:0;
 const h=upper?delta*(1-fill):-delta*Math.max(0,1-fill/.65);
 const df=[Math.PI/.55*Math.cos(Math.PI*u)*Math.sin(Math.PI*v),Math.PI/.55*Math.sin(Math.PI*u)*Math.cos(Math.PI*v)];
 const {J,det}=contourFrame(x,y,.35),a=df.map(v=>v*scale);
 return {h,gradient:[(J[3]*a[0]-J[2]*a[1])/det,(-J[1]*a[0]+J[0]*a[1])/det],fill};
}
function thickenCushionPerimeter(bytes,guideBytes,{gap=.022}={}){
 assert.ok([.003,.022,.040].includes(gap),'Unexpected perimeter gap');assert.equal(sha(bytes),SOURCE_SHA,'Requires contour004g035');assert.equal(sha(guideBytes),GUIDE_SHA,'Requires retained pre-contour guide');
 if(gap===.003)return {bytes:Buffer.from(bytes),receipt:{sourceSHA256:SOURCE_SHA,guideSHA256:GUIDE_SHA,gap,exactIdentity:true,extraTriangles:0,extraDraws:0}};
 const src=readGlb(bytes),guide=readGlb(guideBytes),j=JSON.parse(JSON.stringify(src.json));
 function target(j){const n=j.nodes.find(n=>n.name==='Hybrid_Sonnet_upper');assert.ok(n&&!n.matrix&&!n.translation&&!n.rotation&&!n.scale&&!n.skin);assert.equal(j.nodes.filter(x=>x.mesh===n.mesh).length,1);const p=j.meshes[n.mesh].primitives.find(p=>j.materials[p.material]?.name==='CLOTH');assert.ok(p&&p.indices!==undefined&&!p.targets&&!p.extensions&&(p.mode??4)===4);return p;}
 const p=target(j),gp=target(guide.json),widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},sizes={5123:2,5126:4};
 function data(file,id){const a=file.json.accessors[id],v=file.json.bufferViews[a.bufferView],size=widths[a.type]*sizes[a.componentType];assert.ok(size&&!a.sparse&&!a.byteOffset&&!a.extensions&&!v.extensions&&!v.byteStride&&v.buffer===0);assert.equal(v.byteLength,a.count*size);return {a,size,bytes:file.binary.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength)};}
 const attrs=Object.fromEntries(Object.entries(p.attributes).map(([n,id])=>[n,data(src,id)])),pos=attrs.POSITION,guidePos=data(guide,gp.attributes.POSITION),index=data(src,p.indices);
 assert.equal(pos.a.count,1608);assert.equal(guidePos.a.count,1608);assert.equal(pos.a.type,'VEC3');assert.equal(pos.a.componentType,5126);assert.equal(index.a.componentType,5123);assert.equal(attrs.NORMAL.a.type,'VEC3');assert.equal(attrs.TANGENT.a.type,'VEC4');
 const point=(b,i)=>[0,1,2].map(k=>b.readFloatLE(i*12+4*k));
 const inside=q=>q[0]>2.79&&q[0]<3.61&&q[1]>3.45&&q[1]<3.54&&q[2]>-5.63&&q[2]<-4.80;
 const triangles=[];for(let n=0;n<index.a.count;n+=3){const t=[0,1,2].map(k=>index.bytes.readUInt16LE((n+k)*2));if(t.every(i=>inside(point(pos.bytes,i))))triangles.push(t);}
 assert.equal(triangles.length,240);
 // Coordinate welding groups split UV/normal vertices without touching source buffers.
 const parent=new Map(),find=k=>{if(!parent.has(k))parent.set(k,k);let r=k;while(parent.get(r)!==r)r=parent.get(r);while(parent.get(k)!==k){const next=parent.get(k);parent.set(k,r);k=next;}return r;};
 for(const t of triangles){const ks=t.map(i=>key(point(pos.bytes,i)));for(const k of ks.slice(1))parent.set(find(k),find(ks[0]));}
 const groups=new Map();for(const t of triangles){const k=find(key(point(pos.bytes,t[0])));if(!groups.has(k))groups.set(k,[]);groups.get(k).push(t);}
 assert.deepEqual([...groups.values()].map(v=>v.length).sort((a,b)=>a-b),[12,12,12,12,192]);
 const body=new Set([...groups.values()].find(g=>g.length===192).flat());assert.equal(body.size,336);
 const buffers=Object.fromEntries(['POSITION','NORMAL','TANGENT'].map(n=>[n,Buffer.from(attrs[n].bytes)]));let unchangedFloorVertices=0;
 for(const i of body){
  const old=point(pos.bytes,i),g=point(guidePos.bytes,i),uv=local([g[0]-3.2,g[1],g[2]+5.215]),upper=g[1]>floor+.0415;
  const {h,gradient:[hx,hy]}=perimeterFrame(uv[0],uv[1],upper,gap);
  if(Math.abs(old[1]-floor)<1e-6){assert.ok(!upper&&Math.abs(h)<1e-12&&hx===0&&hy===0);unchangedFloorVertices++;continue;}
  buffers.POSITION.writeFloatLE(old[1]+h,i*12+4);
  const read=n=>[0,1,2].map(k=>attrs[n].bytes.readFloatLE(i*attrs[n].size+k*4));
  const n=local(read('NORMAL')),t=local(read('TANGENT'));
  const normal=unit(world([n[0]-hx*n[2],n[1]-hy*n[2],n[2]])),tangent=world([t[0],t[1],t[2]+hx*t[0]+hy*t[1]]),dot=normal.reduce((a,v,k)=>a+v*tangent[k],0),orthogonal=unit(tangent.map((v,k)=>v-dot*normal[k]));
  normal.forEach((v,k)=>buffers.NORMAL.writeFloatLE(v,i*12+k*4));orthogonal.forEach((v,k)=>buffers.TANGENT.writeFloatLE(v,i*16+k*4));
 }
 assert.ok(unchangedFloorVertices>0);
 const chunks=[src.binary];let offset=src.binary.length;
 for(const [name,buffer]of Object.entries(buffers)){
  const a={...attrs[name].a};if(name==='POSITION'){const points=Array.from({length:a.count},(_,i)=>point(buffer,i));a.min=[0,1,2].map(k=>Math.min(...points.map(p=>p[k])));a.max=[0,1,2].map(k=>Math.max(...points.map(p=>p[k])));}
  a.bufferView=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:buffer.length});chunks.push(buffer);offset+=buffer.length;assert.equal(offset%4,0);p.attributes[name]=j.accessors.length;j.accessors.push(a);
 }
 j.buffers[0].byteLength=offset;const out=writeGlb(j,Buffer.concat(chunks));assert.ok(readGlb(out).binary.subarray(0,src.binary.length).equals(src.binary));
 return {bytes:out,receipt:{sourceSHA256:SOURCE_SHA,guideSHA256:GUIDE_SHA,candidateSHA256:sha(out),gap,seamCentre:.0415,edgeBottom:.0415-gap/2,edgeTop:.0415+gap/2,maximumHeight:.08,bodyVertexIds:[...body],bodyTriangles:192,selectedTriangles:240,unchangedFloorVertices,sourceBinaryPrefixExact:true,horizontalPositionsByteExact:true,cornerPatchesUnchanged:true,UVColoursMaterialsIndicesUnchanged:true,normalMethod:'Analytic vertical-height Jacobian inverse transpose; direct tangent derivative/orthogonalization; W unchanged; floor-contact vertices fully unchanged',extraTriangles:0,extraDraws:0,extraMaps:0,extraBytes:out.length-bytes.length,nativeVerified:false,phoneMeasured:false}};
}
module.exports={thickenCushionPerimeter,perimeterFrame,SOURCE_SHA,GUIDE_SHA};
if(require.main===module){const [input,guide,output,receipt,gap]=process.argv.slice(2);assert.ok(input&&guide&&output&&receipt);assert.ok(!fs.existsSync(output)&&!fs.existsSync(receipt),'Preserve numbered outputs');const r=thickenCushionPerimeter(fs.readFileSync(input),fs.readFileSync(guide),{gap:Number(gap??.022)});fs.writeFileSync(output,r.bytes);fs.writeFileSync(receipt,JSON.stringify(r.receipt,null,2)+'\n');console.log(JSON.stringify({...r.receipt,bodyVertexIds:r.receipt.bodyVertexIds?.length??0,bytes:r.bytes.length}));}
