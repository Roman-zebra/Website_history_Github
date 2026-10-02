const fs=require('node:fs'),assert=require('node:assert/strict');
const {readGlb,writeGlb}=require('./shinsekai-glb-cell.cjs');
const clone=v=>JSON.parse(JSON.stringify(v));
function inspectCabinetInk(bytes){
 const file=readGlb(bytes),j=file.json,node=j.nodes.find(n=>n.name==='UD_Tansu_Futon');
 assert.ok(node&&!node.matrix&&!node.translation&&!node.rotation&&!node.scale&&!node.skin,'Expected unchanged cabinet frame');assert.equal(j.nodes.filter(n=>n.mesh===node.mesh).length,1,'Shared cabinet mesh');
 const primitive=j.meshes[node.mesh].primitives.find(p=>j.materials[p.material].name==='UD_ink');assert.ok(primitive);
 const a=j.accessors[primitive.attributes.POSITION],v=j.bufferViews[a.bufferView];assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');assert.ok(!a.sparse&&!v.byteStride);assert.equal(a.count,720);
 const start=(v.byteOffset??0)+(a.byteOffset??0),data=file.binary.subarray(start,start+a.count*12),points=Array.from({length:a.count},(_,i)=>[0,1,2].map(k=>data.readFloatLE(i*12+k*4)));
 const ia=j.accessors[primitive.indices],iv=j.bufferViews[ia.bufferView];assert.equal(ia.componentType,5123);assert.ok(!ia.sparse&&!iv.byteStride);const is=(iv.byteOffset??0)+(ia.byteOffset??0),indices=Array.from({length:ia.count},(_,i)=>file.binary.readUInt16LE(is+i*2));
 const triangles=Array.from({length:indices.length/3},(_,i)=>indices.slice(i*3,i*3+3));
 const key=p=>p.map(x=>Math.round(x*1e6)).join(','),parent=new Map(),find=k=>{if(!parent.has(k))parent.set(k,k);let r=k;while(parent.get(r)!==r)r=parent.get(r);while(parent.get(k)!==k){const next=parent.get(k);parent.set(k,r);k=next;}return r;};
 for(const t of triangles){const ks=t.map(i=>key(points[i]));for(const k of ks.slice(1))parent.set(find(k),find(ks[0]));}
 const grouped=new Map();triangles.forEach((t,i)=>{const k=find(key(points[t[0]]));if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(i);});
 const components=[...grouped.values()].map(faces=>{const ids=[...new Set(faces.flatMap(i=>triangles[i]))],bounds=[0,1,2].map(k=>[Math.min(...ids.map(i=>points[i][k])),Math.max(...ids.map(i=>points[i][k]))]);return {faces,ids,bounds};});
 const slabs=components.filter(c=>Math.abs(c.bounds[0][0]-5.28)<1e-5&&Math.abs(c.bounds[0][1]-5.281)<1e-5);assert.equal(slabs.length,4,'Expected four exact black gap slabs');
 for(const s of slabs){assert.equal(s.faces.length,12);const edges=new Map();for(const id of s.faces){const t=triangles[id].map(i=>key(points[i]));for(let k=0;k<3;k++){const e=[t[k],t[(k+1)%3]].sort().join('|');edges.set(e,(edges.get(e)??0)+1);}}assert.ok([...edges.values()].every(n=>n===2),'Gap slab not closed');}
 return {file,node,primitive,a,data,points,triangles,components,slabs,selected:new Set(slabs.flatMap(s=>s.ids))};
}
function repairCabinetInk(bytes,{recessM=.004}={}){
 assert.equal(recessM,.004,'Unexpected cabinet clearance');const src=inspectCabinetInk(bytes),j=clone(src.file.json),primitive=j.meshes[src.node.mesh].primitives.find(p=>j.materials[p.material].name==='UD_ink'),data=Buffer.from(src.data);
 for(const i of src.selected)data.writeFloatLE(src.points[i][0]+recessM,i*12);
 const view=j.bufferViews.length,accessor=j.accessors.length;j.bufferViews.push({buffer:0,byteOffset:src.file.binary.length,byteLength:data.length});const a={...src.a,bufferView:view,byteOffset:0};a.min=[0,1,2].map(k=>Math.min(...src.points.map((p,i)=>p[k]+(k===0&&src.selected.has(i)?recessM:0))));a.max=[0,1,2].map(k=>Math.max(...src.points.map((p,i)=>p[k]+(k===0&&src.selected.has(i)?recessM:0))));j.accessors.push(a);primitive.attributes.POSITION=accessor;j.buffers[0].byteLength=src.file.binary.length+data.length;
 const candidate=writeGlb(j,Buffer.concat([src.file.binary,data])),check=readGlb(candidate);assert.ok(check.binary.subarray(0,src.file.binary.length).equals(src.file.binary));
 for(const field of ['nodes','scenes','materials','textures','images','samplers','animations','skins','extensions'])assert.deepEqual(check.json[field],src.file.json[field]);
 return {bytes:candidate,receipt:{scope:'Four existing black gap slabs, full-component translation behind drawer bevel',selectedTriangles:48,selectedVertexIds:[...src.selected],recessM,sourceComponents:src.components.map(c=>({triangles:c.faces.length,bounds:c.bounds})),slabBounds:src.slabs.map(c=>c.bounds),closedBeforeAfterTranslation:true,sourceBinaryPrefixExact:true,extraPositionBytes:data.length,addedTriangles:0,addedDraws:0,addedMaps:0}};
}
module.exports={inspectCabinetInk,repairCabinetInk};
if(require.main===module){const [input,output,receipt]=process.argv.slice(2);assert.ok(input&&output&&receipt);assert.ok(!fs.existsSync(output)&&!fs.existsSync(receipt),'Preserve numbered outputs');const r=repairCabinetInk(fs.readFileSync(input));fs.writeFileSync(output,r.bytes);fs.writeFileSync(receipt,JSON.stringify(r.receipt,null,2)+'\n');console.log(JSON.stringify({selectedTriangles:r.receipt.selectedTriangles,vertices:r.receipt.selectedVertexIds.length,positionBytes:r.receipt.extraPositionBytes,slabs:r.receipt.slabBounds}));}
