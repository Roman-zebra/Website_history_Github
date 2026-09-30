const test=require('node:test'),assert=require('node:assert/strict');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const cell={id:'tower-window-0',position:[0,5,0]};
test('rooms load only within15m, remain stable in hysteresis band and detach beyond18m',async()=>{
 const {createInteriorCells}=await import('../assets-src/shinsekai/browser-study/interior-cells.mjs');let loads=0,attached=0,detached=0;
 const cells=createInteriorCells({cells:[cell],load:async()=>{loads++;return {};},attach:()=>attached++,detach:()=>detached++});
 cells.update([16,5,0]);await flush();assert.equal(loads,0);cells.update([15,5,0]);await flush();assert.equal(loads,1);assert.equal(attached,1);
 cells.update([17,5,0]);cells.update([10,5,0]);await flush();assert.equal(loads,1);assert.equal(detached,0);cells.update([19,5,0]);assert.equal(detached,1);cells.dispose();
});
test('late room loads after departure or disposal are released without scene attachment',async()=>{
 const {createInteriorCells}=await import('../assets-src/shinsekai/browser-study/interior-cells.mjs');let resolve,attached=0,detached=0;
 const cells=createInteriorCells({cells:[cell],load:()=>new Promise(r=>resolve=r),attach:()=>attached++,detach:()=>detached++});
 cells.update([0,5,0]);await flush();cells.update([30,5,0]);resolve({});await flush();assert.equal(attached,0);assert.equal(detached,1);
 cells.update([0,5,0]);await flush();cells.dispose();resolve({});await flush();assert.equal(attached,0);assert.equal(detached,2);
});
test('failed cells avoid per-frame retries until leaving the hysteresis range',async()=>{
 const {createInteriorCells}=await import('../assets-src/shinsekai/browser-study/interior-cells.mjs');let loads=0;
 const cells=createInteriorCells({cells:[cell],load:async()=>{loads++;throw new Error('unavailable');},attach:()=>{},detach:()=>{}});
 cells.update([0,5,0]);await flush();cells.update([0,5,0]);await flush();assert.equal(loads,1);assert.equal(cells.snapshot()[0].status,'failed');
 cells.update([30,5,0]);cells.update([0,5,0]);await flush();assert.equal(loads,2);cells.dispose();
});
