'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {projectPoint,projectLine}=require('../scripts/shinsekai-camera.cjs');
const {minimise}=require('../scripts/shinsekai-least-squares.cjs');
const {geometry,cameraSpecs,readInputs,scenarioObservation,floorAnchor,measurements}=require('../scripts/profile-shinsekai-camera.cjs');
const scenario=require('../docs/shinsekai/research/camera-scenario-v1.json');
const twoLine=require('../docs/shinsekai/research/camera-scenario-v2.json');
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
test('two-line bindings retain eight rolled samples and hash-checked y-only refinements',()=>{
  const input=readInputs(twoLine);assert.equal(input.floor.length,8);
  assert.deepEqual(input.floor.map(o=>floorAnchor(o,twoLine)),['northFloor','northFloor','northFloor','northFloor','northCopingBottom','northCopingBottom','southCopingBottom','southCopingBottom']);
  const raw=input.observations.find(o=>o.id==='viewA:17'),refined=scenarioObservation(raw,twoLine);
  assert.equal(raw.y,840);assert.equal(refined.y,846);assert.equal(refined.x,raw.x);assert.equal(refined.tolerancePx,6);
  assert.equal(scenarioObservation(input.observations.find(o=>o.id==='south_c0234001:31'),twoLine).y,106.5);
  assert.throws(()=>readInputs({...twoLine,observationUpdateSource:{...twoLine.observationUpdateSource,sha256:'bad'}}),/update hash/);
  assert.throws(()=>readInputs({...twoLine,observationOverrides:{'viewA:17':{y:9999,sourceReading:'bad'}}}),/Invalid observation override/);
  assert.throws(()=>readInputs({...twoLine,observationOverrides:{'viewA:17':{y:846,x:100,sourceReading:'bad'}}}),/Unsupported observation override/);
});
test('shared coping thickness recovers both tilted floor lines instead of forcing them coincident',()=>{
  const g=Object.fromEntries(twoLine.geometryParameters.map(s=>[s.name,s.initial])),truth={...g,copingThickness:0.83};
  const camera={centre:[2,60,4],heading:Math.PI+0.02,pitch:0.04,roll:0.04,focalPx:1200,principalPx:[2500,1800]};
  const anchors=geometry(truth,75.76,twoLine),floor=[];
  for(const alternative of [false,true])for(const x of [-10,10]){
    const z=alternative?twoLine.roofM-truth.copingThickness:twoLine.roofM,p=projectPoint(camera,[x,g.depth/2,z]).pixel;
    floor.push({id:'synthetic:'+floor.length,photo:'viewA',x:p[0],y:p[1],tx:1,ty:1,alternative});
  }
  const fn=x=>measurements(geometry({...g,copingThickness:x[0]},75.76,twoLine),{viewA:camera},[],floor,twoLine).flatMap(o=>o.scaled);
  const fit=minimise(fn,[twoLine.geometryParameters.find(s=>s.name==='copingThickness')],[0.2]);
  assert.ok(fit.cost<1e-10);assert.ok(Math.abs(fit.values[0]-truth.copingThickness)<1e-6);
  assert.ok(fn([0]).some(v=>Math.abs(v)>10)); // The former one-line model cannot fit both edges.
});
test('adding two floor lines still preserves the exact roof-fixed training scale gauge',()=>{
  const g=Object.fromEntries(twoLine.geometryParameters.map(s=>[s.name,s.initial])),R=twoLine.roofM,s=1.08,H=75.76,scaled={...g};
  for(const name of ['width','depth','turretWidth','archSpan','rodLength','crownHeight','galleryHeight','copingThickness'])scaled[name]*=s;
  for(const name of ['archCrown','archFeet','domeTop'])scaled[name]=R+(g[name]-R)*s;
  const make=(east,heading)=>({centre:[east,60,4],heading,pitch:0.04,roll:0.025,focalPx:1100,principalPx:[1250,1800]});
  const cams={plate46:make(2,Math.PI+0.02),viewA:make(-3,Math.PI-0.03)},other=Object.fromEntries(Object.entries(cams).map(([name,c])=>[name,{...c,centre:[c.centre[0]*s,c.centre[1]*s,R+(c.centre[2]-R)*s]}]));
  const input=readInputs(twoLine),obs=input.observations.filter(o=>o.photo!=='south_c0234001'),floor=input.floor.filter(o=>o.photo!=='south_c0234001');
  const training=rows=>rows.filter(o=>!twoLine.northHoldoutIds.includes(o.id)).flatMap(o=>o.pixels);
  close(training(measurements(geometry(g,H,twoLine),cams,obs,floor,twoLine)),training(measurements(geometry(scaled,R+(H-R)*s,twoLine),other,obs,floor,twoLine)));
});
