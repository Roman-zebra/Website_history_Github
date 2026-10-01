const test=require('node:test'),assert=require('node:assert/strict');
const flush=()=>new Promise(r=>setImmediate(r));
const plans=[{id:'base',bytes:100,textureBytes:1000},{id:'dream',bytes:110,textureBytes:1200}];
test('portal hysteresis retains one room and reuses the entrance preparation on entry',async()=>{
 const {createRoomPrefetch,nearStudyPortal}=await import('../assets-src/shinsekai/browser-study/room-prefetch.mjs');let loads=0,releases=0;
 const cache=createRoomPrefetch({plans,load:()=>{loads++;return {};},release:()=>releases++});
 const portal={portal:[0,0,0]};assert.equal(nearStudyPortal([9,0,0],portal),false);assert.equal(nearStudyPortal([9,0,0],portal,true),true);
 const prepared=await cache.select('base');assert.equal(await cache.select('base'),prepared);assert.equal(loads,1);assert.equal(cache.snapshot().reservedTextureBytes,1000);
 await cache.select(null);assert.equal(releases,1);assert.equal(cache.snapshot().reservedBytes,0);await cache.dispose();
});
test('a delayed stale load is released before a replacement reserves resources',async()=>{
 const {createRoomPrefetch}=await import('../assets-src/shinsekai/browser-study/room-prefetch.mjs');let finish;const events=[];
 const cache=createRoomPrefetch({plans,load:key=>{events.push('load '+key);return key==='base'?new Promise(r=>finish=r):{key};},release:value=>events.push('release '+value.key)});
 const old=cache.select('base');await flush();const next=cache.select('dream');await flush();assert.deepEqual(events,['load base']);assert.equal(cache.snapshot().reservedBytes,100);
 finish({key:'base'});assert.equal(await old,null);assert.equal((await next).key,'dream');assert.deepEqual(events,['load base','release base','load dream']);assert.equal(cache.snapshot().reservedBytes,110);
 await cache.dispose();assert.equal(cache.snapshot().reservedBytes,0);
});
test('failure is retained until leaving and disposal prevents a late result becoming resident',async()=>{
 const {createRoomPrefetch}=await import('../assets-src/shinsekai/browser-study/room-prefetch.mjs');let loads=0,finish,released=0;
 const cache=createRoomPrefetch({plans,load:()=>{loads++;if(loads===1)throw new Error('403');return new Promise(r=>finish=r);},release:()=>released++});
 await assert.rejects(cache.select('base'),/403/);await assert.rejects(cache.select('base'),/403/);assert.equal(loads,1);
 await cache.select(null);const work=cache.select('base');await flush();const disposal=cache.dispose();finish({});await work;await disposal;assert.equal(released,1);assert.equal(cache.snapshot().reservedBytes,0);
});
test('complete-room costs reject early and cleanup uncertainty blocks replacement',async()=>{
 const {createRoomPrefetch}=await import('../assets-src/shinsekai/browser-study/room-prefetch.mjs');
 assert.throws(()=>createRoomPrefetch({plans,load:()=>assert.fail(),release:()=>{},maxBytes:105}),/cost/);
 const cache=createRoomPrefetch({plans,load:key=>({key}),release:()=>{throw new Error('cleanup');}});await cache.select('base');await assert.rejects(cache.select('dream'),/cleanup/);
 assert.equal(cache.snapshot().status,'cleanup-required');assert.equal(cache.snapshot().reservedBytes,100);await assert.rejects(cache.select('dream'),/cleanup/);
});
