const test=require('node:test'),assert=require('node:assert/strict');
test('floor comparison preserves source identities and restores shared array assignments before reuse',async()=>{
 const {createHallFloorLook}=await import('../assets-src/shinsekai/browser-study/hall-floor-look.mjs');
 const texture={},geometry={},floor={name:'stone_floor',roughness:.1,map:texture},worn={name:'stone_floor_worn',roughness:.34,map:texture},wall={name:'plaster_ceil',roughness:.9};
 const original=[floor,worn,wall],mesh={isMesh:true,material:original,geometry},other={isMesh:true,material:wall};const model={scene:{traverse(fn){[mesh,other].forEach(fn);}}};let disposed=0;
 const options={createMaterial:source=>({...source,dispose(){disposed++;}}),decorateWear:material=>{material.colorNode={wear:true};}};
 const look=createHallFloorLook(model,{...options,mode:'wear'});assert.equal(mesh.material[0].roughness,.72);assert.equal(mesh.material[1].roughness,.76);assert.equal(mesh.material[0].map,texture);assert.equal(mesh.geometry,geometry);assert.equal(mesh.material[2],wall);assert.equal(other.material,wall);assert.equal(floor.roughness,.1);assert.equal(floor.colorNode,undefined);
 look.dispose();look.dispose();assert.equal(mesh.material,original);assert.equal(disposed,2);
 const control=createHallFloorLook(model,{...options,mode:'control'});assert.equal(mesh.material[0].roughness,.1);assert.equal(mesh.material[0].colorNode,undefined);control.dispose();assert.equal(mesh.material,original);
});
test('invalid ownership or failed floor copy attaches no partial revision and cleans temporary copies',async()=>{
 const {createHallFloorLook}=await import('../assets-src/shinsekai/browser-study/hall-floor-look.mjs');
 const floor={name:'stone_floor',roughness:.1},worn={name:'stone_floor_worn',roughness:.34},original=[floor,worn],mesh={isMesh:true,material:original},model={scene:{traverse(fn){fn(mesh);}}};let cleaned=0,calls=0;
 assert.throws(()=>createHallFloorLook(model,{createMaterial:source=>{if(++calls===2)throw Error('copy failed');return {...source,dispose(){cleaned++;}};}}),/copy failed/);assert.equal(mesh.material,original);assert.equal(cleaned,1);
 assert.throws(()=>createHallFloorLook(model,{createMaterial:source=>source}),/independent/);assert.equal(mesh.material,original);
 worn.roughnessMap={};assert.throws(()=>createHallFloorLook(model,{createMaterial:()=>{throw Error('must not copy');}}),/two measured/);assert.equal(mesh.material,original);
});
