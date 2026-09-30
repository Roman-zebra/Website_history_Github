const test=require('node:test'),assert=require('node:assert/strict');
async function harness(){const {waitCaptureFrame}=await import('../assets-src/shinsekai/browser-study/capture-frame.mjs');let frame,timeout,frames=0,timers=0;const wait=waitCaptureFrame({request:fn=>(frame=fn,1),cancel:()=>frames++,setTimer:fn=>(timeout=fn,2),clearTimer:()=>timers++});return {wait,frame:()=>frame(),timeout:()=>timeout(),counts:()=>[frames,timers]};}
test('capture resolves on a frame and clears both pending callbacks once',async()=>{const h=await harness();h.frame();await h.wait.promise;h.timeout();h.wait.cancel();assert.deepEqual(h.counts(),[1,1]);});
test('a missing frame or hidden cancellation rejects without leaving an outstanding frame',async()=>{for(const mode of ['timeout','cancel']){const h=await harness();const rejection=assert.rejects(h.wait.promise,/timed out|cancelled/);if(mode==='timeout')h.timeout();else h.wait.cancel();await rejection;h.frame();assert.deepEqual(h.counts(),[1,1]);}});
test('PNG encoding releases a lost callback, cancellation and late completion safely',async()=>{
 const {encodeCanvasPng}=await import('../assets-src/shinsekai/browser-study/capture-frame.mjs');let timeout,callback,clears=0;
 const canvas={toBlob(fn){callback=fn;}},timers={setTimer:fn=>(timeout=fn,1),clearTimer:()=>clears++};
 const pending=encodeCanvasPng(canvas,timers);const rejection=assert.rejects(pending.promise,/timed out/);timeout();await rejection;callback({fake:'late'});assert.equal(clears,1);
 const cancelled=encodeCanvasPng(canvas,timers),cancelCheck=assert.rejects(cancelled.promise,/cancelled/);cancelled.cancel();await cancelCheck;
 const success=encodeCanvasPng(canvas,timers),blob={test:true};callback(blob);assert.equal(await success.promise,blob);
});
