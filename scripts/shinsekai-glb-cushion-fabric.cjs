// Exact selected-face mask only; no geometry, UV, colour or material revision.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {readGlb,writeGlb}=require('./shinsekai-glb-cell.cjs');
const SOURCE_SHA='178f76bf655cc30cfdbf532767149e48d90f5bae6c32b2e382107a92ee90c909';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function maskCushionFabric(bytes){
 assert.equal(sha(bytes),SOURCE_SHA,'Requires retained005gap022');
 const src=readGlb(bytes),j=JSON.parse(JSON.stringify(src.json));
 const n=j.nodes.find(n=>n.name==='Hybrid_Sonnet_upper');
 assert.ok(n&&!n.matrix&&!n.translation&&!n.rotation&&!n.scale&&!n.skin);
 assert.equal(j.nodes.filter(x=>x.mesh===n.mesh).length,1);
 const p=j.meshes[n.mesh].primitives.find(p=>j.materials[p.material]?.name==='CLOTH');
 assert.ok(p&&p.indices!==undefined&&!p.targets&&!p.extensions&&(p.mode??4)===4&&!p.attributes._CUSHION);
 const data=id=>{const a=j.accessors[id],v=j.bufferViews[a.bufferView];assert.ok(!a.sparse&&!a.byteOffset&&!a.extensions&&!v.byteStride&&!v.extensions&&v.buffer===0);return {a,b:src.binary.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength)};};
 const pos=data(p.attributes.POSITION),idx=data(p.indices);
 assert.equal(pos.a.count,1608);assert.equal(pos.a.type,'VEC3');assert.equal(pos.a.componentType,5126);assert.equal(pos.b.length,1608*12);assert.equal(idx.a.componentType,5123);
 const inside=i=>{const x=pos.b.readFloatLE(i*12),y=pos.b.readFloatLE(i*12+4),z=pos.b.readFloatLE(i*12+8);return x>2.79&&x<3.61&&y>3.45&&y<3.54&&z>-5.63&&z<-4.80;};
 const tris=Array.from({length:idx.a.count/3},(_,i)=>[0,1,2].map(k=>idx.b.readUInt16LE(i*6+k*2))),selected=tris.filter(t=>t.every(inside)),ids=new Set(selected.flat());
 assert.equal(selected.length,240);assert.equal(ids.size,432);assert.equal(tris.filter(t=>t.some(i=>ids.has(i))&&!t.every(i=>ids.has(i))).length,0);
 const buffer=Buffer.alloc(1608*4);for(const i of ids)buffer.writeFloatLE(1,i*4);
 const offset=src.binary.length;assert.equal(offset%4,0);
 p.attributes._CUSHION=j.accessors.length;j.accessors.push({bufferView:j.bufferViews.length,componentType:5126,count:1608,type:'SCALAR',min:[0],max:[1]});
 j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:buffer.length,target:34962});j.buffers[0].byteLength=offset+buffer.length;
 const out=writeGlb(j,Buffer.concat([src.binary,buffer]));assert.ok(readGlb(out).binary.subarray(0,offset).equals(src.binary));
 return {bytes:out,receipt:{round:'cushion-fabric-119-006',sourceSHA256:SOURCE_SHA,candidateSHA256:sha(out),targetVertices:432,otherClothVertices:1176,targetTriangles:240,mixedFaces:0,attribute:'_CUSHION',loaderAttribute:'_cushion',sourceBinaryPrefixExact:true,allExistingAttributesIndicesMaterialsExact:true,extraBytes:out.length-bytes.length,extraTriangles:0,extraDraws:0,extraMaps:0,nativeVerified:false,phoneMeasured:false}};
}
module.exports={maskCushionFabric,SOURCE_SHA};
if(require.main===module){const [input,output,receipt]=process.argv.slice(2);assert.ok(input&&output&&receipt);assert.ok(!fs.existsSync(output)&&!fs.existsSync(receipt),'Preserve numbered outputs');const r=maskCushionFabric(fs.readFileSync(input));fs.writeFileSync(output,r.bytes);fs.writeFileSync(receipt,JSON.stringify(r.receipt,null,2)+'\n');console.log(JSON.stringify(r.receipt));}
