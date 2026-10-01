const test=require('node:test'),assert=require('node:assert/strict');
test('wall colour copies preserve shared sandstone windows, maps and roughness then restore cached walls',async()=>{
 const {createHallWallLook}=await import('../assets-src/shinsekai/browser-study/hall-wall-look.mjs');
 const map={},normalMap={},roughnessMap={},geometry={},stone={name:'sandstone',map,normalMap,roughnessMap,roughness:.7},plaster={name:'plaster_dk',map,roughness:.85},brass={name:'brass'};
 const originals=[stone,plaster,brass],walls={name:'hall__walls_2',isMesh:true,material:originals,geometry},sill={name:'hall__windows_doors',isMesh:true,material:stone};
 const model={scene:{traverse(fn){[walls,sill].forEach(fn);}}};let disposed=0;const opts={createMaterial:source=>({...source,dispose(){disposed++;}}),decorateWear:copy=>{copy.colorNode={wear:true};}};
 const look=createHallWallLook(model,opts);assert.equal(sill.material,stone);assert.equal(stone.colorNode,undefined);assert.equal(walls.material[0].map,map);assert.equal(walls.material[0].normalMap,normalMap);assert.equal(walls.material[0].roughnessMap,roughnessMap);assert.equal(walls.material[0].roughness,.7);assert.equal(walls.material[1].roughness,.85);assert.equal(walls.material[2],brass);assert.equal(walls.geometry,geometry);
 look.dispose();look.dispose();assert.equal(walls.material,originals);assert.equal(disposed,2);
 const control=createHallWallLook(model,{...opts,mode:'control'});assert.equal(walls.material[0].colorNode,undefined);control.dispose();assert.equal(walls.material,originals);
});
test('failed wall decorator attaches no partial copies and rejects source ownership',async()=>{
 const {createHallWallLook}=await import('../assets-src/shinsekai/browser-study/hall-wall-look.mjs');
 const originals=[{name:'sandstone'},{name:'plaster_dk'}],wall={isMesh:true,name:'hall__walls',material:originals},model={scene:{traverse(fn){fn(wall);}}};let disposed=0;
 assert.throws(()=>createHallWallLook(model,{createMaterial:s=>({...s,dispose(){disposed++;}}),decorateWear:c=>{if(c.name==='plaster_dk')throw Error('decoration failed');}}),/decoration failed/);assert.equal(wall.material,originals);assert.equal(disposed,2);
 assert.throws(()=>createHallWallLook(model,{mode:'control',createMaterial:s=>s}),/independent/);assert.equal(wall.material,originals);
 wall.name='hall__windows_doors';assert.throws(()=>createHallWallLook(model,{mode:'control',createMaterial:()=>{throw Error('must not copy');}}),/two measured/);
});
