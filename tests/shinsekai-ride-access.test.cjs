const test=require('node:test'),assert=require('node:assert/strict');
const load=()=>import('../assets-src/shinsekai/browser-study/ride-access.mjs');
const config={stops:[17.05,57.5892],width:.8904,depth:.8904,height:2.3};
const lower={fraction:0,velocity:0,phase:'departing-end dwell'},upper={fraction:1,velocity:0,phase:'arrival-end dwell'},moving={fraction:.5,velocity:.01,phase:'outbound'};
test('boarding and exit require the correct exact dwell; pausing mid-trip does not enable exit',async()=>{
 const {createRideAccess,dockedStation}=await load(),access=createRideAccess(config);
 assert.equal(access.board(upper),false);assert.equal(access.board(moving),false);assert.equal(dockedStation({...moving,velocity:0}),null);
 assert.equal(access.board(lower),true);assert.equal(access.exit(lower),false);access.advance(2);assert.equal(access.mode,'riding');assert.equal(access.exit(moving),false);
 assert.equal(access.exit(upper),true);assert.equal(access.station,1);access.advance(2);assert.equal(access.mode,'landing');assert.equal(access.board(lower),false);assert.equal(access.board(upper),true);
});
test('next landing targets the first actual dwell, including exact terminal boundaries and later cycles',async()=>{
 const {nextLandingTime,dockedStation}=await load(),{shuttle}=await import('../assets-src/shinsekai/browser-study/ride-motion.mjs');
 for(const [time,target] of [[0,28],[18,28],[28,56],[30,56],[56,84],[83.9,84],[1000,1008]]){assert.equal(nextLandingTime(time,20,8),target);assert.notEqual(dockedStation(shuttle(target,20,8)),null);assert.ok(target>time);}
 assert.throws(()=>nextLandingTime(0,20,0));
});
test('crossing camera stays on the clear doorway centreline and ends inside the car volume',async()=>{
 const {createRideAccess}=await load(),access=createRideAccess(config);access.board(lower);let last=Infinity;
 for(let i=0;i<125;i++){access.advance(.01);const p=access.pose(config.stops[0],100);assert.equal(p.position[0],0);assert.ok(p.position[2]>=0&&p.position[2]<=last);last=p.position[2];assert.ok(p.yaw<=Math.PI+1e-8);assert.ok(p.position[1]-config.stops[0]<config.height/2-.08-.18);}
 access.advance(.1);assert.equal(access.mode,'riding');assert.equal(access.pose(config.stops[1]).position[2],0);assert.equal(access.pose(config.stops[1]).position[1]-access.pose(config.stops[0]).position[1],config.stops[1]-config.stops[0]);
});
test('reset cancels incomplete crossings and rejects impossible camera volumes',async()=>{
 const {createRideAccess}=await load(),access=createRideAccess(config);access.board(lower);access.advance(.5);assert.throws(()=>access.pose(config.stops[0]+1),/moved during crossing/);access.reset(1);assert.equal(access.mode,'landing');assert.equal(access.station,1);assert.equal(access.pose(config.stops[1]).progress,0);
 assert.throws(()=>createRideAccess({...config,width:.4}),/does not fit/);assert.throws(()=>createRideAccess({...config,height:1.8}),/does not fit/);assert.throws(()=>access.advance(-1));assert.throws(()=>access.pose(80));assert.throws(()=>access.reset(2));
});
test('crossing clock freezes camera progress across a hidden interval and resumes only explicitly',async()=>{
 const {createRideAccess}=await load(),{createRideClock}=await import('../assets-src/shinsekai/browser-study/ride-motion.mjs');let visible=true;const access=createRideAccess(config),clock=createRideClock({canStart:()=>visible});access.board(lower);clock.start(0);access.advance(clock.sample(400));clock.pause(400);visible=false;const before=access.pose(config.stops[0]);assert.equal(clock.start(1000),false);assert.deepEqual(access.pose(config.stops[0]),before);assert.equal(clock.sample(30000),.4);visible=true;clock.start(31000);access.advance(clock.sample(32000)-.4);assert.equal(access.mode,'riding');
});
