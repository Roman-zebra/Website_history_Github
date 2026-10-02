const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {readGlb,writeGlb}=require('../scripts/shinsekai-glb-cell.cjs');
const {inspectCabinetInk,repairCabinetInk}=require('../scripts/shinsekai-glb-cabinet-ink.cjs');
const {repairUpperCushion}=require('../scripts/shinsekai-glb-upper-cushion.cjs');
const original=fs.readFileSync(path.join(__dirname,'../assets-src/shinsekai/eval-building-a/hybrid/runtime/interior.glb'));
function block(f,id){const a=f.json.accessors[id],v=f.json.bufferViews[a.bufferView],start=(v.byteOffset??0)+(a.byteOffset??0);return f.binary.subarray(start,start+a.count*12);}
for(const combined of [false,true])test('four cabinet gaps recess without changing wood, fabric, maps, topology or retained cushion '+combined,()=>{
 const bytes=combined?repairUpperCushion(original,{shiftY:.165,seamBottom:.04}).bytes:original,src=inspectCabinetInk(bytes),r=repairCabinetInk(bytes),dst=readGlb(r.bytes),before=src.file.json,after=dst.json;
 const p=after.meshes[src.node.mesh].primitives.find(p=>after.materials[p.material].name==='UD_ink'),pos=block(dst,p.attributes.POSITION);
 assert.ok(dst.binary.subarray(0,src.file.binary.length).equals(src.file.binary));assert.equal(dst.binary.length-src.file.binary.length,8640);
 const expected=structuredClone(before);expected.meshes[src.node.mesh].primitives.find(p=>expected.materials[p.material].name==='UD_ink').attributes.POSITION=p.attributes.POSITION;
 expected.bufferViews.push(after.bufferViews.at(-1));expected.accessors.push(after.accessors.at(-1));expected.buffers[0].byteLength=after.buffers[0].byteLength;assert.deepEqual(after,expected);
 for(let i=0;i<src.a.count;i++)for(let k=0;k<3;k++){
  const offset=i*12+k*4;
  if(src.selected.has(i)&&k===0)assert.ok(Math.abs(pos.readFloatLE(offset)-src.data.readFloatLE(offset)-.004)<1e-6);
  else assert.ok(pos.subarray(offset,offset+4).equals(src.data.subarray(offset,offset+4)),`untouched ${i}/${k}`);
 }
 assert.equal(src.selected.size,144);assert.equal(r.receipt.selectedTriangles,48);
 for(const slab of src.slabs){
  const keys=i=>[0,1,2].map(k=>Math.round(pos.readFloatLE(i*12+k*4)*1e6)).join(','),edges=new Map();
  for(const face of slab.faces){const ids=src.triangles[face].map(keys);for(let k=0;k<3;k++){const edge=[ids[k],ids[(k+1)%3]].sort().join('|');edges.set(edge,(edges.get(edge)??0)+1);}}
  assert.equal(edges.size,18);assert.ok([...edges.values()].every(n=>n===2),'actual translated component remains closed');
  for(const i of slab.ids){const x=pos.readFloatLE(i*12);assert.ok(x>5.283&&x<5.286,'behind 3mm drawer bevel, inside unchanged 20mm wood depth');}
 }
 assert.equal(r.receipt.addedTriangles,0);assert.equal(r.receipt.addedDraws,0);assert.equal(r.receipt.addedMaps,0);
});
test('cabinet repair refuses changed frames, shared meshes, attribute layouts and unintended offsets',()=>{
 for(const recessM of [0,.003,.005,NaN,Infinity])assert.throws(()=>repairCabinetInk(original,{recessM}));
 for(const edit of [j=>j.nodes.find(n=>n.name==='UD_Tansu_Futon').translation=[1,0,0],j=>j.nodes.push({mesh:j.nodes.find(n=>n.name==='UD_Tansu_Futon').mesh}),j=>{const p=j.meshes[j.nodes.find(n=>n.name==='UD_Tansu_Futon').mesh].primitives.find(p=>j.materials[p.material].name==='UD_ink');j.accessors[p.attributes.POSITION].count--;}]){
  const f=readGlb(original);edit(f.json);assert.throws(()=>repairCabinetInk(writeGlb(f.json,f.binary)));
 }
});
