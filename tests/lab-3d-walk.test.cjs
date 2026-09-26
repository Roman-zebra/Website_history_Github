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
