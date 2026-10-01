const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {readGlb,writeGlb}=require('../scripts/shinsekai-glb-cell.cjs');
const {replaceHaoriSupport}=require('../scripts/shinsekai-glb-replace-haori-support.cjs');
const source=fs.readFileSync(path.join(__dirname,'../assets-src/shinsekai/eval-building-a/hybrid/runtime/upper-cloth-v2-sewn-rail.glb'));
function fixture(){
 const a=readGlb(source),j=structuredClone(a.json),mesh=j.nodes.find(n=>n.name==='Haori_connected').mesh;
 j.nodes=['Haori_connected','Haori119_bamboo','Haori119_cord_0','Haori119_cord_1'].map((name,i)=>({name,mesh:i}));
 j.meshes=[0,1,2,3].map((_,i)=>{const m=structuredClone(a.json.meshes[mesh]);m.primitives[0].material=i===0?0:i===1?9:8;return m;});
 j.scenes=[{nodes:[0,1,2,3]}];return writeGlb(j,a.binary);
}
test('support replacement preserves every original binary byte, unrelated mesh and material binding',()=>{
 const before=readGlb(source),r=replaceHaoriSupport(source,fixture()),after=readGlb(r.bytes),target=before.json.nodes.find(n=>n.name==='Haori_connected');
 assert.ok(after.binary.subarray(0,before.binary.length).equals(before.binary));assert.ok(r.appendedBytes>0);
 for(let i=0;i<before.json.meshes.length;i++)if(i!==target.mesh)assert.deepEqual(after.json.meshes[i],before.json.meshes[i]);
 assert.deepEqual(after.json.materials,before.json.materials);assert.deepEqual(after.json.images,before.json.images);
 for(let i=0;i<before.json.nodes.length;i++){const n=structuredClone(after.json.nodes[i]);if(n.name==='UD_CoatRail_Haori_v2')n.children=n.children.slice(0,-3);assert.deepEqual(n,before.json.nodes[i]);}
});
test('unexpected objects, placements, support materials and out-of-range indices are rejected',()=>{
 for(const edit of [a=>a.json.nodes[1].name='unexpected',a=>a.json.nodes[1].translation=[1,0,0],a=>a.json.meshes[1].primitives[0].material=0,a=>{const acc=a.json.accessors[a.json.meshes[0].primitives[0].indices],v=a.json.bufferViews[acc.bufferView];a.binary.writeUInt16LE(65535,v.byteOffset);}]){
  const candidate=readGlb(fixture());edit(candidate);assert.throws(()=>replaceHaoriSupport(source,writeGlb(candidate.json,candidate.binary)));
 }
});
