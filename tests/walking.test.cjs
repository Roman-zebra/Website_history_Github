const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(__dirname,'../walking-data.js'),'utf8'),ctx);ctx.ATLAS_WALKS=ctx.window.ATLAS_WALKS;vm.runInContext(fs.readFileSync(path.join(__dirname,'../walking-time.js'),'utf8'),ctx);
ctx.PLACES=[{id:'featured'}];ctx.ACTIVITIES=[];ctx.LANDMARKS=[];ctx.LOCALS=[];ctx.LANG='ja';ctx.placeName=p=>p.name||'';ctx.localName=t=>t.name||'';ctx.localSummary=()=>'';
test('overview entry is offered to all requested categories and only the largest other marker tier',()=>{
 const eligible=ctx.window.AtlasWalking.eligible,at=[35,139];
 for(const o of [{placeId:'featured',adTier:3},{kind:'food',adTier:3},{kind:'shopping',adTier:3},{adTier:1}])assert.equal(eligible({...o,at}),true);
 for(const o of [{adTier:2},{adTier:3,kind:'liminal'},{adTier:4},{adTier:0,kind:'gyg-product'}])assert.equal(eligible({...o,at}),false);
 assert.equal(eligible({adTier:1}),false);
});
test('nearby suggestions require real names, deduplicate points and skip private or distant destinations',()=>{
 const points=ctx.window.AtlasWalking.nearby({at:[35,139],name:'Start'},[
 {lat:35.001,lon:139,tags:{}},{lat:35.002,lon:139,tags:{name:'Private',access:'private'}},
 {lat:35.003,lon:139,tags:{name:'Named museum'}},{lat:35.00301,lon:139,tags:{name:'Duplicate entrance'}},
 {lat:35.007,lon:139,name:'Park'},{lat:36,lon:139,name:'Far away'}]);
 assert.deepEqual(Array.from(points,p=>p.name),['Named museum','Park']);
});
test('all reviewed walks keep complete stops, continuous routes and balanced time budgets',()=>{
 assert.equal(ctx.ATLAS_WALKS.places.length,11);
 for(const p of ctx.ATLAS_WALKS.places){const q=ctx.window.AtlasWalking.plan(p);assert.equal(q.r.legs.length,p.stops.length-1);assert.equal(q.d.actions.length,p.stops.length);assert.equal(q.walking+q.visiting+q.buffer,q.total);assert.ok(q.buffer>=5);let elapsed=0;p.stops.forEach((s,i)=>{assert.equal(q.slots[i].start,elapsed);elapsed+=q.slots[i].stay;if(q.r.legs[i]){const leg=q.r.legs[i];assert.ok(leg.path.length>1);for(const point of leg.path){assert.ok(point[0]>20&&point[0]<46);assert.ok(point[1]>122&&point[1]<154);}elapsed+=leg.minutes;}});assert.equal(elapsed+q.buffer,q.total);}
});
test('market course retains named shops, official sources and 90-minute budget',()=>{const p=ctx.ATLAS_WALKS.places.find(p=>p.id==='kanazawa-market');const q=ctx.window.AtlasWalking.plan(p);assert.equal(q.total,90);assert.equal(q.visiting,75);assert.equal(q.walking,4);assert.equal(q.d.sources.length,3);assert.match(p.stops[0][0],/山さん寿司/);});
test('three purposes select genuinely different registered destinations',()=>{
 const choices=ctx.window.AtlasWalking.routeChoices({at:[35,139],name:'Start'},[
 {lat:35.002,lon:139,tags:{name:'Old gate',historic:'gate'}},
 {lat:35.004,lon:139,tags:{name:'Museum',tourism:'museum'}},
 {lat:35.007,lon:139,name:'Food market',category:'food'},
 {lat:35.009,lon:139,name:'Shopping street',category:'shopping'}]);
 assert.deepEqual(Array.from(choices,c=>c.purpose),['heritage','food','shopping']);
 assert.deepEqual(Array.from(choices[1].points,p=>p.name),['Start','Food market']);
 assert.deepEqual(Array.from(choices[2].points,p=>p.name),['Start','Shopping street']);
 assert.equal(choices[0].points.length,3);
});
test('missing shops use relevant scenery or art instead of inventing food stops',()=>{
 const choices=ctx.window.AtlasWalking.routeChoices({at:[35,139],name:'Start'},[
 {lat:35.002,lon:139,tags:{name:'Historic gate',historic:'gate'}},
 {lat:35.004,lon:139,tags:{name:'Riverside park',leisure:'park'}},
 {lat:35.007,lon:139,tags:{name:'Sculpture',tourism:'artwork'}}]);
 assert.deepEqual(Array.from(choices,c=>c.purpose),['heritage','scenery','art']);
 const signatures=choices.map(c=>c.points.map(p=>p.name).sort().join('|'));assert.equal(new Set(signatures).size,choices.length);
 assert.equal(ctx.window.AtlasWalking.routeChoices({at:[0,0],name:'No coverage'}).length,0);
});
test('reviewed history course is retained among Hiroshima purpose choices',()=>{
 const choices=ctx.window.AtlasWalking.routeChoices({at:[34.3955,132.4536],name:'Hiroshima'},[
 {lat:34.3915,lon:132.4622,name:'Okonomimura',category:'food'},
 {lat:34.397,lon:132.455,tags:{name:'River viewpoint',tourism:'viewpoint'}}]);
 assert.equal(choices.length,3);assert.equal(choices[0].course.id,'hiroshima');assert.equal(ctx.window.AtlasWalking.plan(choices[0].course).total,80);
 assert.equal(choices[1].purpose,'food');assert.equal(choices[2].purpose,'scenery');
});
