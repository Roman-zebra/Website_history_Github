const test=require('node:test'),assert=require('node:assert/strict');
async function setup(){
 const THREE=await import('../vendor/three-r186/build/three.core.js');
 const {connectShopCloth}=await import('../assets-src/shinsekai/browser-study/shop-cloth-detail.mjs');
 const names=['UD_CoatRail_Haori','UD_DryingPole_Cloths','UD_ClothBolt_Spread'];
 const model=()=>{const scene=new THREE.Group();for(const name of names){const group=new THREE.Group();group.name=name;group.position.set(1,2,3);group.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));scene.add(group);}return {scene};};
 return {THREE,connectShopCloth,names,interior:model(),replacement:model()};
}
test('cloth replacement preserves placement and remains owned by the loaded interior',async()=>{
 const {connectShopCloth,names,interior,replacement}=await setup();
 const originalNodes=names.map(name=>interior.scene.getObjectByName(name));
 const stats=connectShopCloth(interior,replacement);
 assert.equal(replacement.scene.parent,interior.scene);assert.ok(originalNodes.every(o=>!o.visible));
 assert.deepEqual(stats.nodes,names);assert.equal(stats.originalTriangles,36);assert.equal(stats.replacementTriangles,36);
 assert.equal(interior.scene.getObjectByName(names[0]),originalNodes[0]);
});
test('missing, moved or unrelated replacement meshes leave the original visible',async()=>{
 for(const invalid of ['missing','moved','extra']){
  const {THREE,connectShopCloth,names,interior,replacement}=await setup();
  if(invalid==='missing')replacement.scene.remove(replacement.scene.getObjectByName(names[0]));
  if(invalid==='moved')replacement.scene.getObjectByName(names[0]).position.x+=.001;
  if(invalid==='extra')replacement.scene.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));
  assert.throws(()=>connectShopCloth(interior,replacement));assert.equal(replacement.scene.parent,null);
  assert.ok(names.every(name=>interior.scene.getObjectByName(name).visible));
 }
});
