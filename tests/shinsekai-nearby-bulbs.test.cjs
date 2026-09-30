const test=require('node:test'),assert=require('node:assert/strict');
test('nearby bulb pool honors camera distance, budget and parked tiers',async()=>{
 const {nearestBulbs}=await import('../assets-src/shinsekai/browser-study/look-fixtures.mjs'),groups=[{id:'a',enabled:true,points:[[10,0,0],[0,0,0],[2,0,0]]},{id:'b',enabled:false,points:[[1,0,0]]}];
 assert.deepEqual(nearestBulbs(groups,[1,0,0],2).map(b=>b.id),['a:1','a:2']);assert.deepEqual(nearestBulbs(groups,[10,0,0],1)[0].point,[10,0,0]);assert.equal(nearestBulbs(groups,[0,0,0],0).length,0);
 groups[0].enabled=false;assert.equal(nearestBulbs(groups,[0,0,0],24).length,0);assert.throws(()=>nearestBulbs(groups,[0,0,0],41));assert.throws(()=>nearestBulbs(groups,[NaN,0,0],24));
});
