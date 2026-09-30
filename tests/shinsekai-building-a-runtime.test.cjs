const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {read,rays}=require('./helpers/gltf-study-geometry.cjs');
const base=path.resolve(__dirname,'../assets-src/shinsekai/eval-building-a/hybrid'),manifest=JSON.parse(fs.readFileSync(path.join(base,'runtime/manifest.json')));
test('runtime parts keep all LOD geometry and a separate bounded animated interior',()=>{
 const original=read(path.join(base,'building-a.glb'));
 for(const entry of manifest.entries){
  const part=read(path.join(base,'runtime',entry.file));
  assert.equal(crypto.createHash('sha256').update(part.bytes).digest('hex'),entry.sha256);
  assert.equal(part.bytes.length,entry.bytes);
  const root=entry.part==='interior'?'Hybrid_InteriorCell':entry.part==='dream'?'UD_Dream':'Hybrid_LOD'+entry.part.at(-1);
  if(entry.part!=='dream')assert.equal(part.triangles(part.node(root)),original.triangles(original.node(root)));
  else{assert.equal(original.node('UD_Dream'),-1);assert.equal(part.triangles(part.node(root)),entry.triangles);}
  assert.equal(part.triangles(part.node('BuildingA_Hybrid')),entry.triangles);
  if(entry.part==='interior'){
   assert.ok(part.json.animations.length>0);assert.ok(part.node('Cash drawer slider')>=0);
   assert.ok(part.json.nodes.every(n=>!/^Hybrid_LOD|Hybrid_Collision/.test(n.name)));
  }else{
   assert.equal(part.node('Hybrid_InteriorCell'),-1);assert.equal(part.node('Cash drawer slider'),-1);
  }
 }
 assert.ok(manifest.entries.find(e=>e.part==='exterior-lod2').bytes<1000000);
});
test('stair drawer stays horizontal and supported by guides, including its open pose',async()=>{
 const a=read(path.join(base,'runtime/interior.glb')),slider=a.json.nodes[a.node('Stair drawer slider')];
 assert.ok(!slider.rotation||slider.rotation.every((v,i)=>Math.abs(v-(i===3?1:0))<.0001));
 for(const travel of [0,-.24]){
  slider.translation=[travel,0,0];
  const hit=await rays(a,['Hero stair storage']);
  // The closed and extended drawer retain guide engagement at x5.20m. A
  // vertical ray from just below the drawer bottom first hits its guide top.
  assert.ok(Math.abs(hit([5.20,.648,-7.052],[0,1,0])-.002)<.0025);
  assert.ok(Math.abs(hit([5.20,.630,-7.052],[0,1,0])-.003)<.0025);
 }
});
