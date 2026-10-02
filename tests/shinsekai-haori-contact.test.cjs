const test=require('node:test'),assert=require('node:assert/strict');
async function fixture(gain=.6,fail=false){
 const {createHaoriWallContactLook}=await import('../assets-src/shinsekai/browser-study/haori-wall-contact-look.mjs');
 let maps=0,copies=0;const map={isTexture:true,image:{width:512,height:512},colorSpace:'',flipY:true,dispose(){maps++;}},grain={},normal={},plaster={name:'M_Plaster_Int',map:grain,normalMap:normal,colorNode:{wear:true}},other={},original=[plaster,other],geometry={},wall={isMesh:true,material:original,geometry,traverse(fn){fn(this);}},model={scene:{getObjectByName(name){return name==='BldgA_LOD0_sideL'?wall:null;}}};
 const look=createHaoriWallContactLook(map,{gain,createMaterial:s=>({...s,dispose(){copies++;}}),buildNode:(source,map,gain)=>{if(fail)throw Error('shader failure');return {source,map,gain};}});
 return {look,map,wall,model,original,plaster,geometry,counts:()=>({maps,copies})};
}
test('haori wall lifetime restores exact exterior assignment on dream/far, reconciles glass arrays and disposes only owned resources',async()=>{
 const f=await fixture();f.look.bind(f.model);assert.equal(f.wall.material,f.original);f.look.setEnabled(true);
 const copy=f.wall.material[0];assert.equal(copy.map,f.plaster.map);assert.equal(copy.normalMap,f.plaster.normalMap);assert.equal(copy.colorNode.source,f.plaster.colorNode);assert.equal(f.wall.geometry,f.geometry);assert.equal(f.wall.material[1],f.original[1]);
 f.look.setEnabled(false);assert.equal(f.wall.material,f.original);f.look.setEnabled(true);const fresh=[...f.original];f.wall.material=fresh;f.look.setEnabled(true);f.look.dispose();assert.equal(f.wall.material,fresh);assert.deepEqual(f.counts(),{maps:1,copies:1});assert.equal(f.look.dispose(),null);
});
test('haori null gain leaves source assignment and shaders exact, failed bind cleans copies, retirement preserves foreign material changes',async()=>{
 const control=await fixture(0);control.look.bind(control.model);control.look.setEnabled(true);assert.equal(control.wall.material,control.original);assert.equal(control.look.stats.materials,0);control.look.dispose();assert.deepEqual(control.counts(),{maps:1,copies:0});
 const failed=await fixture(.6,true);assert.throws(()=>failed.look.bind(failed.model),/shader failure/);assert.equal(failed.wall.material,failed.original);failed.look.dispose();assert.deepEqual(failed.counts(),{maps:1,copies:1});
 const foreign=await fixture();foreign.look.bind(foreign.model);foreign.look.setEnabled(true);const changed={};foreign.wall.material=changed;foreign.look.dispose();assert.equal(foreign.wall.material,changed);assert.deepEqual(foreign.counts(),{maps:1,copies:1});
});
