const test=require('node:test'),assert=require('node:assert/strict');
const nav=require('../3d/gunkanjima-walk-nav.js'),scenes=require('../3d/gunkanjima-interiors.json').scenes;
for(const [id,scene] of Object.entries(scenes))test(id+' has a supported spawn and room to move',()=>{
 const p=nav.spawn(scene,.805);assert.ok(p,'valid floor, away from furniture');
 assert.equal(nav.ground(scene,p.u,p.v,.805,p.y),p.y);
 assert.ok([[.5,0],[-.5,0],[0,.5],[0,-.5]].some(([x,z])=>nav.ground(scene,p.u+x/.805,p.v+z/.805,.805,p.y)!==null));
 assert.equal(nav.ground(scene,-1000,-1000,.805,p.y),null,'cannot leave the modelled floor');
});
test('rotated walls block, floors support, door openings remain traversable',()=>{
 const floor={u:0,v:0,y:0,s:[10,.1,10],t:'floor'},wall={u:0,v:0,y:.1,s:[.2,3,4],r:45,t:'wall'};
 const sc={boxes:[floor,wall]};assert.equal(nav.ground(sc,0,0,1,.1),null);assert.equal(nav.ground(sc,3,0,1,.1),.1);
 assert.equal(nav.ground({boxes:[floor,{...wall,t:'door'}]},0,0,1,.1),.1);
 assert.equal(nav.ground({boxes:[{...floor,y:3}]},0,0,1,.1),null,'no teleport to a different storey');
});

const buildingWalk=require('../3d/gunkanjima-walk-buildings.js'),model=require('../3d/gunkanjima-model.json');
test('every generated building supports walking from the ground floor to the roof and back',()=>{
 let count=0;
 for(const b of model.buildings){
  const sc=buildingWalk.build(b,model.coast);if(!sc)continue;count++;
  const p=sc.walkPlan,toUV=q=>[(q[0]*p.c-q[1]*p.s)/.805,(q[0]*p.s+q[1]*p.c)/.805];
  assert.ok(nav.spawn(sc,.805),b.name+' has a usable entrance');
  let current=p.base;
  function traverse(points){
   for(let j=1;j<points.length;j++){
    const a=points[j-1],z=points[j],n=Math.ceil(Math.hypot(z[0]-a[0],z[1]-a[1])/.10);
    for(let i=0;i<=n;i++){
     const k=i/(n||1),uv=toUV([a[0]+(z[0]-a[0])*k,a[1]+(z[1]-a[1])*k]);
     assert.ok(buildingWalk.inPoly(uv,model.coast),'stairs stay within the coast');
     const y=nav.ground(sc,...uv,.805,current);
     assert.notEqual(y,null,(b.name||b.id)+' blocked at floor '+((current-p.base)/p.height).toFixed(2));
     assert.ok(Math.abs(y-current)<=.4,'single step, no storey teleport');current=y;
    }
   }
  }
  const points=p.routes.flatMap(r=>r.points);traverse(points);
  assert.ok(Math.abs(current-(p.base+p.floors*p.height))<.2,b.name+' reaches the roof');
  traverse(points.slice().reverse());assert.ok(Math.abs(current-p.base)<.2,b.name+' returns to ground level');
  assert.equal(nav.ground(sc,-1000,-1000,.805,current),null,'no floor outside building');
 }
 assert.equal(count,68,'68 feasible building studies; equipment and narrow structures excluded');
});
test('equipment is not presented as a residential interior',()=>{
 for(const name of ['起重機','タンク','貯水槽','桟橋'])assert.equal(buildingWalk.plan({name}),null);
});

test('inferred room walls stay inside footprints and every doorway is traversable',()=>{
 let doors=0;
 for(const b of model.buildings){
  const sc=buildingWalk.build(b,model.coast);if(!sc)continue;
  for(const wall of sc.boxes.filter(b=>b.t==='room-wall')){
   const a=wall.r*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
   for(const x of [-wall.s[0]/2,wall.s[0]/2])for(const z of [-wall.s[2]/2,wall.s[2]/2]){
    const uv=[wall.u+(x*c-z*s)/.805,wall.v+(x*s+z*c)/.805];
    assert.ok(buildingWalk.inPoly(uv,b.poly),(b.name||b.id)+' room wall outside footprint');
    assert.ok(buildingWalk.inPoly(uv,model.coast),'room wall outside coast');
   }
  }
  for(const door of sc.boxes.filter(b=>b.t==='door-header')){
   doors++;const a=door.r*Math.PI/180,c=Math.cos(a),s=Math.sin(a);let y=door.y-2.05;
   for(let d=-.2;d<=.8;d+=.1){
    const u=door.u-d*s/.805,v=door.v+d*c/.805,h=nav.ground(sc,u,v,.805,y);
    assert.notEqual(h,null,(b.name||b.id)+' doorway blocked');assert.ok(buildingWalk.inPoly([u,v],model.coast),'doorway inside coast');y=h;
   }
  }
 }
 assert.ok(doors>1000,'all generated floors were checked');
});
