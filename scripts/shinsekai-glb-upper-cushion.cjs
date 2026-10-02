// Geometry-only repair of the one open Sonnet writing-table cushion.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {readGlb,writeGlb}=require('./shinsekai-glb-cell.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},sizes={5123:2,5126:4};
const key=p=>p.map(v=>Math.round(v*1e5)).join(',');
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>{const n=Math.hypot(...v);assert.ok(n>1e-10);return v.map(x=>x/n);};
function repairUpperCushion(bytes,{shiftY=0,seamBottom=.018}={}){
 assert.ok([0,.165].includes(shiftY),'Unexpected scoped cushion placement');
 assert.ok([.018,.040].includes(seamBottom)&&(seamBottom===.018||shiftY===.165),'Unexpected scoped cushion profile');
 const src=readGlb(bytes),j=clone(src.json),node=j.nodes.find(n=>n.name==='Hybrid_Sonnet_upper');
 assert.ok(node&&!node.matrix&&!node.translation&&!node.rotation&&!node.scale&&!node.skin,'Expected unchanged world-space upper dressing');
 assert.equal(j.nodes.filter(n=>n.mesh===node.mesh).length,1,'Shared target mesh');
 const primitive=j.meshes[node.mesh].primitives.find(p=>j.materials[p.material]?.name==='CLOTH');
 assert.ok(primitive&&primitive.indices!==undefined&&!primitive.extensions&&!primitive.targets&&(primitive.mode??4)===4);
 const originals={};
 function data(id){const a=j.accessors[id],v=j.bufferViews[a.bufferView],size=widths[a.type]*sizes[a.componentType];assert.ok(size&&!a.sparse&&!a.byteOffset&&!a.extensions&&!v.extensions&&!v.byteStride&&v.buffer===0);assert.equal(v.byteLength,a.count*size);return {a,size,bytes:src.binary.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength)};}
 for(const [name,id]of Object.entries(primitive.attributes))originals[name]=data(id);
 const positions=originals.POSITION;assert.equal(positions.a.componentType,5126);assert.equal(positions.a.type,'VEC3');
 const count=positions.a.count;for(const d of Object.values(originals))assert.equal(d.a.count,count);
 function point(i){return [0,1,2].map(k=>positions.bytes.readFloatLE(i*12+k*4));}
 const index=data(primitive.indices);assert.equal(index.a.type,'SCALAR');assert.equal(index.a.componentType,5123);assert.equal(index.a.count%3,0);
 const triangles=Array.from({length:index.a.count/3},(_,i)=>[0,1,2].map(k=>index.bytes.readUInt16LE((i*3+k)*2)));
 const inside=p=>p[0]>2.79&&p[0]<3.61&&p[1]>3.50&&p[1]<3.59&&p[2]>-5.46&&p[2]<-4.64;
 const selected=triangles.map((t,i)=>t.every(v=>inside(point(v)))?i:-1).filter(i=>i>=0);assert.equal(selected.length,192,'Expected exactly two72-triangle surfaces and four12-triangle corner patches');
 const target=new Set(selected.flatMap(i=>triangles[i])),parent=new Map();
 const find=k=>{if(!parent.has(k))parent.set(k,k);let r=k;while(parent.get(r)!==r)r=parent.get(r);while(parent.get(k)!==k){const next=parent.get(k);parent.set(k,r);k=next;}return r;};
 for(const i of selected){const ks=triangles[i].map(v=>key(point(v)));for(const k of ks.slice(1))parent.set(find(k),find(ks[0]));}
 const groups=new Map();for(const i of selected){const k=find(key(point(triangles[i][0])));if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}assert.equal(groups.size,6,'Unexpected connected source cushion components');
 const points=Array.from({length:count},(_,i)=>point(i)),body=new Set(),top=new Map(),bottom=new Map();
 const c=Math.cos(.4),s=Math.sin(.4),floor=3.455;
 function grid(p){const x=p[0]-3.2,y=-p[2]-5.05;return [(x*c+y*s)/.55+.5,(y*c-x*s)/.55+.5];}
 for(const faces of groups.values()){
  const ids=new Set(faces.flatMap(i=>triangles[i]));
  const ys=[...ids].map(i=>point(i)[1]),lo=Math.min(...ys),hi=Math.max(...ys);
  if(faces.length===72){
   const upper=lo>3.545;assert.ok(upper?Math.abs(lo-3.55)<1e-5:Math.abs(lo-3.51)<1e-5);
   for(const i of ids){const p=point(i),uv=grid(p);assert.ok(uv.every(v=>v>=-1e-5&&v<=1+1e-5));const u=Math.max(0,Math.min(1,uv[0])),v=Math.max(0,Math.min(1,uv[1]));const fill=Math.max(0,Math.sin(Math.PI*u)*Math.sin(Math.PI*v));points[i][1]=floor+(upper?seamBottom+.003+(.08-seamBottom-.003)*fill:Math.max(0,seamBottom*(1-fill/.65)));body.add(i);const g=[Math.round(u*6),Math.round(v*6)].join(',');if(!(upper?top:bottom).has(g))(upper?top:bottom).set(g,i);}
  }else{assert.equal(faces.length,12);assert.ok(hi-lo>.034&&hi-lo<.036);for(const i of ids)points[i][1]=floor+seamBottom+(point(i)[1]-lo)/(hi-lo)*.005;}
 }
 assert.equal(top.size,49);assert.equal(bottom.size,49);
 for(const i of target)points[i][2]-=shiftY;
 const perimeter=[];for(let u=0;u<=6;u++)perimeter.push([u,0]);for(let v=1;v<=6;v++)perimeter.push([6,v]);for(let u=5;u>=0;u--)perimeter.push([u,6]);for(let v=5;v>=1;v--)perimeter.push([0,v]);assert.equal(perimeter.length,24);
 const copies=perimeter.flatMap(g=>[top.get(g.join(',')),bottom.get(g.join(','))]);assert.ok(copies.every(i=>i!==undefined));
 for(const i of copies)points.push([...points[i]]);
 const added=[];for(let n=0;n<24;n++){const a=count+n*2,b=count+((n+1)%24)*2;added.push([a,a+1,b+1],[a,b+1,b]);}
 const geometricNormals=new Map();for(const t of [...selected.filter(i=>triangles[i].every(v=>body.has(v))).map(i=>triangles[i]),...added]){
  const normal=cross(sub(points[t[1]],points[t[0]]),sub(points[t[2]],points[t[0]]));assert.ok(Math.hypot(...normal)>1e-12);
  for(const i of t){const k=key(points[i]),sum=geometricNormals.get(k)??[0,0,0];geometricNormals.set(k,sum.map((v,k)=>v+normal[k]));}
 }
 const chunks=[src.binary];let offset=src.binary.length;
 function append(a,buffer){const view=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:buffer.length});chunks.push(buffer);offset+=buffer.length;const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}const id=j.accessors.length;j.accessors.push({...a,bufferView:view});return id;}
 const newCount=count+copies.length;
 for(const [name,d]of Object.entries(originals)){
  const buffer=Buffer.alloc(newCount*d.size);d.bytes.copy(buffer);copies.forEach((old,n)=>d.bytes.copy(buffer,(count+n)*d.size,old*d.size,(old+1)*d.size));
  if(['POSITION','NORMAL','TANGENT'].includes(name)){
   assert.equal(d.a.componentType,5126);
   const ids=name==='POSITION'?[...target,...copies.map((_,i)=>count+i)]:[...body,...copies.map((_,i)=>count+i)];
   for(const i of ids){
    let value;if(name==='POSITION')value=points[i];else{
     const normal=unit(geometricNormals.get(key(points[i])));if(name==='NORMAL')value=normal;
     else{const old=i<count?i:copies[i-count],t=[0,1,2].map(k=>d.bytes.readFloatLE(old*d.size+k*4)),dot=t.reduce((a,v,k)=>a+v*normal[k],0);value=unit(t.map((v,k)=>v-dot*normal[k]));}
    }value.forEach((v,k)=>buffer.writeFloatLE(v,i*d.size+k*4));
   }
  }
  const a={...d.a,count:newCount};delete a.min;delete a.max;if(name==='POSITION'){a.min=[0,1,2].map(k=>Math.min(...points.map(p=>p[k])));a.max=[0,1,2].map(k=>Math.max(...points.map(p=>p[k])));}
  primitive.attributes[name]=append(a,buffer);
 }
 const allIndices=triangles.concat(added).flat(),newIndex=Buffer.alloc(allIndices.length*2);allIndices.forEach((v,i)=>newIndex.writeUInt16LE(v,i*2));assert.ok(newCount<65536);
 primitive.indices=append({...index.a,count:allIndices.length},newIndex);j.buffers[0].byteLength=offset;
 const candidate=writeGlb(j,Buffer.concat(chunks)),check=readGlb(candidate);assert.ok(check.binary.subarray(0,src.binary.length).equals(src.binary));
 for(const field of ['nodes','scenes','materials','textures','images','samplers','animations','skins','extensions'])assert.deepEqual(check.json[field],src.json[field],field+' changed');
 for(let i=0;i<j.meshes.length;i++)for(let p=0;p<j.meshes[i].primitives.length;p++)if(i!==node.mesh||j.meshes[i].primitives[p]!==primitive)assert.deepEqual(j.meshes[i].primitives[p],src.json.meshes[i].primitives[p]);
 return {bytes:candidate,receipt:{sourceVertexCount:count,newVertexCount:newCount,selectedSourceTriangles:192,selectedVertexIds:[...target],bodyVertexIds:[...body],addedTriangles:48,extraDraws:0,floorHeight:floor,filledHeight:.08,edgeThickness:.003,seamBottom,shiftY,sourceBinaryPrefixExact:true,unrelatedJSONExact:true,sourceCushions:1,scope:'One closed filled source cushion, same rotation/footprint, scoped rearward shift after door-frame contact audit; original colour/UV/custom data/materials; four source corner patches compressed to seam. No phone or artistic approval.'}};
}
module.exports={repairUpperCushion};
if(require.main===module){const [input,output,receipt,shift,seam]=process.argv.slice(2);assert.ok(input&&output&&receipt);assert.ok(!fs.existsSync(output)&&!fs.existsSync(receipt),'Preserve numbered candidate');const r=repairUpperCushion(fs.readFileSync(input),{shiftY:Number(shift??0),seamBottom:Number(seam??.018)});fs.writeFileSync(output,r.bytes);fs.writeFileSync(receipt,JSON.stringify(r.receipt,null,2)+'\n');console.log(JSON.stringify({...r.receipt,selectedVertexIds:r.receipt.selectedVertexIds.length,bodyVertexIds:r.receipt.bodyVertexIds.length,bytes:r.bytes.length}));}
