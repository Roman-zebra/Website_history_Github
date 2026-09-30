const test=require('node:test'),assert=require('node:assert/strict'),load=()=>import('../assets-src/shinsekai/browser-study/turret-transfer.mjs');
test('assumed switchbacks fit the selected turret and end on the shared roof surface',async()=>{
 const {createTurretTransfer}=await load(),t=createTurretTransfer({roofFloor:15.15});let max=0;
 for(const s of t.steps){assert.ok(Math.abs(s.position[0]+12.3)+s.size[0]/2<=2.2+1e-6);assert.ok(Math.abs(s.position[2]-10.8)+s.size[2]/2<=2.2+1e-6);assert.ok(s.position[1]-s.size[1]/2>=-1e-6);max=Math.max(max,s.position[1]+s.size[1]/2);}
 assert.ok(Math.abs(max-15.15)<1e-6);assert.ok(t.flightRise-.12>=1.82);for(const w of t.walkway)assert.ok(Math.abs(w.centre[1]+.06-15.15)<1e-6);assert.deepEqual(t.walkway.at(-1).to,[0,1.9452]);
});
test('stair study rejects insufficient assumed clearance and invalid parameters',async()=>{
 const {createTurretTransfer}=await load();assert.throws(()=>createTurretTransfer({roofFloor:15.15,flights:8}),/clearance/);assert.throws(()=>createTurretTransfer({roofFloor:NaN}));assert.throws(()=>createTurretTransfer({roofFloor:15.15,stepsPerFlight:5}),/clearance/);
});
