const test=require('node:test'),assert=require('node:assert/strict');
test('cold compilation cannot consume the post-submit warm period',async()=>{
 const {createViewPreparation}=await import('../assets-src/shinsekai/browser-study/view-preparation.mjs');
 const p=createViewPreparation(),token=p.begin();
 assert.equal(p.sample(token,4200,4100),false);
 for(let i=1;i<=15;i++)assert.equal(p.sample(token,4200+i*10,2),false);
 assert.equal(p.sample(token,5849,2),false);
 assert.equal(p.sample(token,5850,2),true);
 assert.equal(p.result.firstSubmitMs,4100);assert.equal(p.result.warmElapsedMs,1500);
 assert.equal(p.active,false);
});
test('view changes and hiding invalidate old preparation frames and results',async()=>{
 const {createViewPreparation}=await import('../assets-src/shinsekai/browser-study/view-preparation.mjs');
 const p=createViewPreparation({minFrames:2,warmMs:10}),old=p.begin();p.sample(old,10,2);
 const next=p.begin();assert.equal(p.sample(old,100,2),false);assert.equal(p.result,null);
 p.sample(next,110,3);assert.equal(p.sample(next,120,4),false);assert.equal(p.sample(next,130,4),true);assert.equal(p.result.revision,next);
 p.cancel();assert.equal(p.result,null);assert.equal(p.sample(next,140,4),false);
});
test('slow steady rendering is retained for the subsequent measurement',async()=>{
 const {createViewPreparation}=await import('../assets-src/shinsekai/browser-study/view-preparation.mjs');
 const p=createViewPreparation(),token=p.begin();
 for(let i=0;i<15;i++)assert.equal(p.sample(token,i*1000,300),false);
 assert.equal(p.sample(token,15000,300),false);assert.equal(p.sample(token,16000,300),false);
 assert.equal(p.sample(token,17000,300),true);
 assert.equal(p.result.maxIntervalMs,1000);assert.equal(p.result.frames,18);
});
