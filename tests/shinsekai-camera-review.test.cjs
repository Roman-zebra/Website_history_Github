'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {projectPoint,projectLine,cropCamera}=require('../scripts/shinsekai-camera.cjs');
const {scenarioObservation}=require('../scripts/profile-shinsekai-camera.cjs');
const {prediction,lineSegment,outsideRepo,jpegSize,serve}=require('../scripts/render-shinsekai-camera-review.cjs');
test('review uses original coordinates and edge row semantics across crop transforms',()=>{
  const camera={centre:[0,60,4],heading:Math.PI,pitch:0.04,roll:0.025,focalPx:1100,principalPx:[1250,1800]};
  const o={type:'edge-sample',x:950,y:1460},anchor={kind:'line',origin:[12,10,0],direction:[0,0,1]},transform={offsetPx:[560,440],scale:0.5};
  const original=prediction(camera,o,anchor),cropped=prediction(cropCamera(camera,transform),{...o,x:(o.x-560)*0.5,y:(o.y-440)*0.5},anchor);
  original.forEach((v,i)=>assert.ok(Math.abs(cropped[i]-(v-transform.offsetPx[i])*0.5)<1e-8));
  assert.equal(original[1],o.y);
  const orthogonal=prediction(camera,{...o,type:'line'},anchor),[a,b,c]=projectLine(camera,anchor.origin,anchor.direction);
  assert.ok(Math.abs(a*orthogonal[0]+b*orthogonal[1]+c)<1e-8);
  assert.ok(Math.abs((orthogonal[0]-o.x)*b-(orthogonal[1]-o.y)*a)<1e-8);
  assert.deepEqual(prediction(camera,{type:'point'},{kind:'point',world:[0,0,70]}),projectPoint(camera,[0,0,70]).pixel);
});
test('review clips rolled and vertical floor/edge lines without invented endpoints',()=>{
  assert.deepEqual(lineSegment([1,0,-5],[0,0,10,20]),[[5,0],[5,20]]);
  assert.deepEqual(lineSegment([0,1,-10],[0,0,10,20]),[[0,10],[10,10]]);
  assert.deepEqual(lineSegment([1,-1,0],[0,0,10,10]),[[0,0],[10,10]]);
  assert.equal(lineSegment([0,1,-30],[0,0,10,20]),null);
});
test('protected review output rejects repository destinations and malformed crop files',()=>{
  assert.throws(()=>outsideRepo(path.resolve(__dirname,'../review.html')),/outside repository/);
  assert.throws(()=>jpegSize(Buffer.from('not a JPEG')),/Expected JPEG/);
  const raw={id:'south_c0234001:29',y:50};assert.equal(scenarioObservation(raw).y,54);assert.equal(raw.y,50);
});
test('local review server serves only its single artifact and refuses mutation',async()=>{
  const file=path.join(__dirname,'../docs/shinsekai/research/camera-profile-study.md'),server=serve(file,0);
  await new Promise(resolve=>server.once('listening',resolve));
  try {
    const base='http://127.0.0.1:'+server.address().port;
    const allowed=await fetch(base+'/review.html');assert.equal(allowed.status,200);assert.equal(await allowed.text(),fs.readFileSync(file,'utf8'));
    assert.equal((await fetch(base+'/../AGENTS.md')).status,404);
    assert.equal((await fetch(base+'/review.html?file=AGENTS.md')).status,404);
    assert.equal((await fetch(base+'/review.html',{method:'POST'})).status,405);
    assert.equal((await fetch(base+'/review.html',{method:'HEAD'})).status,200);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
