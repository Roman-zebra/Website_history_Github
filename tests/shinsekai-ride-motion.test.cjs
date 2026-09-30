const test=require('node:test'),assert=require('node:assert/strict');
const load=()=>import('../assets-src/shinsekai/browser-study/ride-motion.mjs');
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('paired ropeway preserves distinct tracks and opposing fractions over cycles',async()=>{
 const {ropeway,DEFAULT_RIDES:c}=await load();
 for(let t=0;t<600;t+=0.37){const {cars}=ropeway(t);near(cars[0].fraction+cars[1].fraction,1);near(cars[0].velocity+cars[1].velocity,0);assert.ok(cars[0].fraction>=0&&cars[0].fraction<=1);near(cars[1].position[2]-cars[0].position[2],c.trackSpacing);}
 const mid=ropeway(c.dwellSeconds+c.travelSeconds/2);near(mid.cars[0].position[0],0);near(mid.cars[1].position[0],0);
});
test('shuttle dwells at both terminals and joins travel with zero velocity/acceleration',async()=>{
 const {shuttle}=await load(),travel=65,dwell=8;
 near(shuttle(0,travel,dwell).fraction,0);near(shuttle(75,travel,dwell).fraction,1);near(shuttle(146,travel,dwell).fraction,0);
 for(const edge of [8,73,81,146]){const left=shuttle(edge-1e-4,travel,dwell),right=shuttle(edge+1e-4,travel,dwell);near(left.fraction,right.fraction,1e-10);near(left.velocity,right.velocity,1e-9);near((right.velocity-left.velocity)/2e-4,0,1e-5);}
 assert.throws(()=>shuttle(-1,65,8));
});
test('cable keeps unequal endpoint heights and declared midpoint sag; elevator stays inside roof/top bounds',async()=>{
 const {cablePoint,elevator,DEFAULT_RIDES:defaults}=await load(),c={...defaults,endHeight:30};near(cablePoint(0,-1,c)[1],c.startHeight);near(cablePoint(1,-1,c)[1],c.endHeight);near(cablePoint(.5,-1,c)[1],(c.startHeight+c.endHeight)/2-c.sag);
 for(let t=0;t<400;t+=.33){const h=elevator(t).height;assert.ok(h>=c.elevatorLow&&h<=c.elevatorHigh);}
 assert.throws(()=>cablePoint(1.1,1));
});
test('dwell preserves the preceding direction including a full-cycle return',async()=>{
 const {ropeway}=await load();for(const [t,direction] of [[0,1],[75,1],[145,-1],[150,-1],[160,1]]){const {cars}=ropeway(t);assert.equal(cars[0].direction,direction);assert.equal(cars[1].direction,-direction);}
});
test('precessing wave remains rigid in its moving plane',async()=>{
 const {waveSeat,DEFAULT_RIDES:c}=await load(),config={...c,wavePrecessionPeriod:35};let distance;
 for(const t of [0,7,19,35,900]){const p=2*Math.PI*(t%35)/35,normal=[-Math.sin(c.waveTilt)*Math.cos(p),Math.cos(c.waveTilt),Math.sin(c.waveTilt)*Math.sin(p)],a=waveSeat(t,0,20,config),b=waveSeat(t,1,20,config);near(a.reduce((s,v,i)=>s+v*normal[i],0),0);near(Math.hypot(...a),c.waveRadius);const d=Math.hypot(...a.map((v,i)=>v-b[i]));if(distance===undefined)distance=d;else near(d,distance);}
});
test('blocked start while hidden or unready cannot advance the clock',async()=>{
 const {createRideClock}=await load();let visible=false;const clock=createRideClock({canStart:()=>visible});assert.equal(clock.start(1000),false);near(clock.sample(31000),0);assert.equal(clock.playing,false);visible=true;assert.equal(clock.start(32000),true);near(clock.sample(33000),1);clock.pause(33000);visible=false;assert.equal(clock.start(34000),false);near(clock.sample(90000),1);
});
test('wave candidate is rigid and coplanar, preserving seat spacing and radius',async()=>{
 const {waveSeat,DEFAULT_RIDES:c}=await load();let distance;
 for(const t of [0,1,5,19,20,1000]){const a=waveSeat(t,0,12),b=waveSeat(t,1,12);near(Math.hypot(...a),c.waveRadius);near(-Math.sin(c.waveTilt)*a[0]+Math.cos(c.waveTilt)*a[1],0);const d=Math.hypot(...a.map((v,i)=>v-b[i]));if(distance===undefined)distance=d;else near(d,distance);}
});
test('clock freezes across hidden/pause intervals, preserves seek and rejects invalid geometry',async()=>{
 const {createRideClock,validateRides,DEFAULT_RIDES:c}=await load(),clock=createRideClock();
 clock.start(1000);near(clock.sample(2500),1.5);clock.pause(3000);near(clock.sample(90000),2);clock.start(100000);near(clock.sample(101000),3);clock.seek(10,101000);near(clock.sample(102000),11);clock.pause(102000);clock.seek(0,103000);near(clock.sample(120000),0);
 assert.throws(()=>validateRides({...c,elevatorHigh:10}));assert.throws(()=>validateRides({...c,travelSeconds:0}));assert.throws(()=>validateRides({...c,endHeight:NaN}));
});
