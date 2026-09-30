'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {projectPoint,projectLine}=require('../scripts/shinsekai-camera.cjs');
const {minimise}=require('../scripts/shinsekai-least-squares.cjs');
const {geometry,cameraSpecs,readInputs}=require('../scripts/profile-shinsekai-camera.cjs');
const scenario=require('../docs/shinsekai/research/camera-scenario-v1.json');
const close=(a,b)=>a.forEach((x,i)=>assert.ok(Math.abs(x-b[i])<1e-7));
test('role classifications exclude inferred centres/late upper forms and keep south prediction separate',()=>{
  const input=readInputs(scenario);assert.equal(input.observations.length,41);assert.equal(input.floor.length,6);
  assert.ok(!('plate46:2' in scenario.bindings));assert.ok(!('plate46:9' in scenario.bindings));
  assert.throws(()=>readInputs({...scenario,southHoldoutIds:[...scenario.southHoldoutIds,scenario.southCalibrationIds[0]]}),/disjoint/);
  assert.throws(()=>readInputs({...scenario,northHoldoutIds:['plate46:99']}),/role id/);
});
test('cornice alternative selects its own tilted samples without flattening rows',()=>{
  const floor=readInputs({...scenario,floorVariant:'cornice'}).floor.filter(o=>o.photo==='viewA');
  assert.deepEqual(floor.map(o=>[o.x,o.y]),[[2310,1608],[2640,1620]]);
  assert.throws(()=>readInputs({...scenario,floorSourceSha256:'bad'}),/hash/);
});
test('nine camera parameters recover a synthetic noncoplanar surveyed scene',()=>{
  const specs=cameraSpecs('plate46'),truth=[2,60,4,Math.PI+0.03,0.04,0.025,1100,1250,1800];
  const camera=x=>({centre:x.slice(0,3),heading:x[3],pitch:x[4],roll:x[5],focalPx:x[6],principalPx:x.slice(7)});
  const points=[[-12,-10,0],[12,-10,0],[-12,10,15],[12,10,15],[0,-8,30],[0,8,70],[-6,3,40],[6,-5,55]];
  const pixels=points.map(p=>projectPoint(camera(truth),p).pixel);
  const fit=minimise(x=>points.flatMap((p,i)=>projectPoint(camera(x),p).pixel.map((v,j)=>v-pixels[i][j])),specs,[1,65,3,Math.PI+0.02,0.03,0.02,1050,1200,1850]);
  assert.ok(fit.cost<1e-10);assert.equal(fit.diagnostics.rank,9);
  assert.ok(Math.abs(fit.values[6]-truth[6])<1e-3);
});
test('roof-fixed similarity gauge changes height yet preserves all training anchor projections',()=>{
  const g=Object.fromEntries(scenario.geometryParameters.map(s=>[s.name,s.initial])),H=75.76,R=scenario.roofM,s=1.01;
  const scaled={...g};for(const name of ['width','depth','turretWidth','archSpan','rodLength','crownHeight','galleryHeight'])scaled[name]*=s;
  for(const name of ['archCrown','archFeet','domeTop'])scaled[name]=R+(g[name]-R)*s;
  const before=geometry(g,H,scenario),after=geometry(scaled,R+(H-R)*s,scenario);
  const c={centre:[2,60,4],heading:Math.PI+0.03,pitch:0.04,roll:0.025,focalPx:1100,principalPx:[1250,1800]};
  const d={...c,centre:[c.centre[0]*s,c.centre[1]*s,R+(c.centre[2]-R)*s]};
  const aliases=new Set(Object.entries(scenario.bindings).filter(([id])=>!id.startsWith('south_')&&!scenario.northHoldoutIds.includes(id)).map(([,name])=>name));
  aliases.add('northFloor');
  for(const name of aliases){const a=before[name],b=after[name];close(a.kind==='point'?projectPoint(c,a.world).pixel:projectLine(c,a.origin,a.direction),b.kind==='point'?projectPoint(d,b.world).pixel:projectLine(d,b.origin,b.direction));}
});
