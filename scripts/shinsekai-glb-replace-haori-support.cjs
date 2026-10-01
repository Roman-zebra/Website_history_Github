// Explicit119 replacement: original binary and unrelated JSON remain exact.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {readGlb,writeGlb}=require('./shinsekai-glb-cell.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const allowed=new Set(['Haori_connected','Haori119_bamboo','Haori119_cord_0','Haori119_cord_1']);
function replaceHaoriSupport(sourceBytes,replacementBytes){
 const source=readGlb(sourceBytes),candidate=readGlb(replacementBytes),j=clone(source.json);
 const target=j.nodes.find(n=>n.name==='Haori_connected'),parent=j.nodes.find(n=>n.name==='UD_CoatRail_Haori_v2');
 assert.ok(target&&parent?.children?.includes(j.nodes.indexOf(target)),'Missing original garment/parent');
 assert.equal(candidate.json.nodes.length,4,'Expected garment and three supports only');
 assert.deepEqual(new Set(candidate.json.nodes.map(n=>n.name)),allowed,'Unexpected replacement objects');
 assert.equal(j.nodes.filter(n=>n.mesh===target.mesh).length,1,'Shared original garment');
 for(const n of candidate.json.nodes){
  assert.ok(n.mesh!==undefined&&!n.children&&!n.matrix&&!n.translation&&!n.rotation&&!n.scale&&!n.skin&&!n.extensions,'Expected world-space static replacement');
 }
 assert.ok(!candidate.json.animations&&!candidate.json.skins,'No replacement animation/skin');
 const materialIds=new Map();
 for(const [i,m] of candidate.json.materials.entries()){
  const matches=j.materials.map((v,k)=>v.name===m.name?k:-1).filter(k=>k>=0);
  assert.equal(matches.length,1,'Unknown or ambiguous replacement material');materialIds.set(i,matches[0]);
 }
 assert.equal(materialIds.get(candidate.json.meshes[candidate.json.nodes.find(n=>n.name==='Haori_connected').mesh].primitives[0].material),source.json.meshes[target.mesh].primitives[0].material,'Cloth material must remain original');
 const chunks=[source.binary],accessors=new Map();let offset=source.binary.length;
 function appendAccessor(id){
  if(accessors.has(id))return accessors.get(id);
  const a=clone(candidate.json.accessors[id]),v=clone(candidate.json.bufferViews[a.bufferView]);
  assert.ok(v.buffer===0&&!v.extensions&&!v.byteStride&&!a.byteOffset&&!a.sparse&&!a.extensions,'Plain standalone replacement accessor required');
  const data=candidate.binary.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);assert.equal(data.length,v.byteLength);
  const width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5121:1,5123:2,5125:4,5126:4}[a.componentType];
  assert.ok(width&&size&&Number.isInteger(a.count)&&a.count>0,'Invalid accessor contract');assert.equal(data.length,a.count*width*size,'Accessor length mismatch');
  v.byteOffset=offset;v.buffer=0;a.bufferView=j.bufferViews.length;j.bufferViews.push(v);
  const result=j.accessors.length;j.accessors.push(a);accessors.set(id,result);chunks.push(data);offset+=data.length;
  const padding=(4-offset%4)%4;if(padding){chunks.push(Buffer.alloc(padding));offset+=padding;}return result;
 }
 function replacementMesh(n){
  const mesh=clone(candidate.json.meshes[n.mesh]);
  for(const p of mesh.primitives){
   assert.ok((p.mode??4)===4&&!p.targets&&!p.extensions&&p.indices!==undefined,'Static indexed triangles required');
   assert.ok(['POSITION','NORMAL','TANGENT','TEXCOORD_0','COLOR_0'].every(k=>p.attributes[k]!==undefined),'Missing shape/detail attributes');
   const position=candidate.json.accessors[p.attributes.POSITION],index=candidate.json.accessors[p.indices],view=candidate.json.bufferViews[index.bufferView];
   assert.ok(position.type==='VEC3'&&position.componentType===5126&&index.type==='SCALAR'&&[5123,5125].includes(index.componentType)&&index.count%3===0,'Invalid indexed geometry');
   for(let i=0;i<index.count;i++)assert.ok((index.componentType===5123?candidate.binary.readUInt16LE((view.byteOffset??0)+i*2):candidate.binary.readUInt32LE((view.byteOffset??0)+i*4))<position.count,'Index outside replacement mesh');
   assert.ok(Object.values(p.attributes).every(id=>candidate.json.accessors[id].count===position.count),'Attribute count mismatch');
   p.indices=appendAccessor(p.indices);for(const k of Object.keys(p.attributes))p.attributes[k]=appendAccessor(p.attributes[k]);p.material=materialIds.get(p.material);assert.ok(p.material!==undefined);
  }
  return mesh;
 }
 const garment=candidate.json.nodes.find(n=>n.name==='Haori_connected');
 j.meshes[target.mesh].primitives=replacementMesh(garment).primitives;
 for(const name of ['Haori119_bamboo','Haori119_cord_0','Haori119_cord_1']){
  assert.ok(!j.nodes.some(n=>n.name===name),'Support already installed');
  const n=candidate.json.nodes.find(n=>n.name===name),mesh=replacementMesh(n),id=j.meshes.length;j.meshes.push(mesh);
  assert.ok(mesh.primitives.every(p=>j.materials[p.material].name===(name==='Haori119_bamboo'?'UD_bamboo':'UD_cord')),'Support material changed');
  const node=clone(n);node.mesh=id;parent.children.push(j.nodes.length);j.nodes.push(node);
 }
 j.buffers[0].byteLength=offset;
 const bytes=writeGlb(j,Buffer.concat(chunks));const result=readGlb(bytes);
 assert.ok(result.binary.subarray(0,source.binary.length).equals(source.binary),'Original binary changed');
 for(let i=0;i<source.json.meshes.length;i++)if(i!==target.mesh)assert.deepEqual(result.json.meshes[i],source.json.meshes[i],'Unrelated mesh changed');
 for(const k of ['materials','images','textures','samplers','scenes','scene','skins','animations','extensions','extensionsUsed','extensionsRequired'])assert.deepEqual(result.json[k],source.json[k],k+' changed');
 return {bytes,originalBinaryBytes:source.binary.length,appendedBytes:offset-source.binary.length};
}
module.exports={replaceHaoriSupport};
if(require.main===module){
 const [source,candidate,out]=process.argv.slice(2);if(!source||!candidate||!out)throw Error('Usage: frozen.glb replacement.glb separate-output.glb');
 assert.ok(![source,candidate].some(p=>path.resolve(p)===path.resolve(out)),'Preserve inputs');
 const result=replaceHaoriSupport(fs.readFileSync(source),fs.readFileSync(candidate));fs.writeFileSync(out,result.bytes);console.log(JSON.stringify({originalBinaryBytes:result.originalBinaryBytes,appendedBytes:result.appendedBytes,out}));
}
