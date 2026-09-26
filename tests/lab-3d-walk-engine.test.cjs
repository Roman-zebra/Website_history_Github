const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..');
for(const bigIndex of [true,false])require('node:test')('walk engine: controls, sea boundary, every available interior and floor levels (uint indexes: '+bigIndex+')',async()=>{
const noop=()=>{},events={},raf=[];let now=0,draws=0,ready;
const loaded=new Promise(r=>ready=r);
const gl=new Proxy({getExtension:n=>bigIndex&&n==='OES_element_index_uint'?{}:null,getParameter:()=>4096,getShaderParameter:()=>true,getProgramParameter:()=>true,createBuffer:()=>({}),createShader:()=>({}),createProgram:()=>({}),createTexture:()=>({}),getUniformLocation:()=>({}),drawElements:()=>draws++},{get:(o,k)=>k in o?o[k]:/^[A-Z_0-9]+$/.test(k)?1:noop});
const canvas={getContext:()=>gl,getBoundingClientRect:()=>({width:1280,height:800}),clientWidth:1280,clientHeight:800,classList:{add:noop,remove:noop},focus:noop,addEventListener:(k,f)=>(events[k]??=[]).push(f)};
const status={textContent:''},document={currentScript:{src:'https://japantimeatlas.com/3d/gunkanjima-3d.js'},getElementById:id=>id==='view'?canvas:id==='viewStatus'?status:null,querySelectorAll:()=>[],addEventListener:noop};
const win={JTA_WALK_PAGE:true,LAB_LANG:'ja',JTAWalkNav:require(root+'/3d/gunkanjima-walk-nav.js'),JTAWalkInteriors:require(root+'/3d/gunkanjima-walk-interiors.js'),JTAWalkBuildings:require(root+'/3d/gunkanjima-walk-buildings.js'),JTAWalkNature:require(root+'/3d/gunkanjima-walk-nature.js'),devicePixelRatio:1,matchMedia:()=>({matches:false}),addEventListener:noop,dispatchEvent:e=>{if(e.type==='jta-walk-ready')ready();}};
const ctx={window:win,document,navigator:{},location:{search:'',hash:''},console,URL,CustomEvent:class{constructor(type){this.type=type;}},performance:{now:()=>now},requestAnimationFrame:f=>raf.push(f),setTimeout:()=>0,Image:class{width=1024;set src(v){queueMicrotask(()=>this.onload())}},fetch:async url=>{const file=path.join(root,new URL(url).pathname);const data=fs.readFileSync(file);return{ok:true,json:async()=>JSON.parse(data),arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)}},matchMedia:win.matchMedia};
vm.runInNewContext(fs.readFileSync(root+'/3d/gunkanjima-3d.js','utf8'),ctx);
await loaded;const api=win.jtaLab3d,g=api.game;
// Browser zoom shortcuts are not captured by the 3D camera.
for(const type of ['wheel','keydown'])for(const mod of ['ctrlKey','metaKey'])for(const fn of events[type]||[])fn({key:'-',deltaY:120,[mod]:true,preventDefault(){assert.fail('browser zoom intercepted');}});
// Reversing at either pinch limit must respond immediately, without a stale baseline.
api.st.walk=false;api.st.dist=100;
const emit=(type,id,x)=>{for(const fn of events[type]||[])fn({pointerId:id,clientX:x,clientY:0,buttons:1});};
emit('pointerdown',1,0);emit('pointerdown',2,100);
emit('pointermove',2,1);const far=api.st.dist;emit('pointermove',2,2);assert.ok(api.st.dist<far,'reverse from far clamp');
emit('pointermove',2,100000);const nearZoom=api.st.dist;emit('pointermove',2,50000);assert.ok(api.st.dist>nearZoom,'reverse from near clamp');
emit('lostpointercapture',1,0);emit('lostpointercapture',2,50000);const az=api.st.az;emit('pointermove',2,2);assert.equal(api.st.az,az,'lost capture clears drag');
api.st.walk=true;
assert.ok(api.st.walk);assert.notEqual(g.canWalk(api.st.wx,api.st.wz),null,'outdoor spawn supported');
function frame(){now+=40;const f=raf.shift();if(f)f(now);}
frame();const start={...api.st};g.input.y=1;for(let i=0;i<20;i++)frame();assert.ok(Math.hypot(api.st.wx-start.wx,api.st.wz-start.wz)>.1,'outdoor moves');g.pause();
let entered=0;for(const id of Object.keys(g.scenes())){const info=g.scenes()[id],b=info.generatedBuilding;if(b&&(1962<(b.built||b.seen||1950)||(b.gone&&1962>b.gone)))continue;entered++;const outside={x:api.st.wx,z:api.st.wz};assert.ok(g.enter(id),id+' enters');assert.ok(api.st.walk);assert.ok(g.indoor());assert.notEqual(g.canWalk(api.st.wx,api.st.wz),null);frame();g.leave();assert.equal(g.indoor(),false);assert.equal(api.st.wx,outside.x);assert.equal(api.st.wz,outside.z);}
assert.ok(entered>60,'source scenes plus inferred buildings are available');
// The flat must open on its furnished room, not the open edge of the cutaway.
assert.ok(g.enter('no65flat'));
const entryUV=g.fromWorld(api.st.wx,api.st.wz),look=g.toWorldTrue(656.33,435.26);
assert.ok(Math.hypot(entryUV[0]-655.15,entryUV[1]-437.21)<.05,'entry remains at the supported room threshold');
const angle=Math.atan2(look[0]-api.st.wx,look[1]-api.st.wz);
assert.ok(Math.cos(api.st.az-angle)>.999,'view faces the table and room');
assert.ok(api.st.el<-.4&&api.st.el>-.8,'table is in the first-person field of view');
assert.notEqual(g.canWalk(api.st.wx+Math.sin(api.st.az)*.3,api.st.wz+Math.cos(api.st.az)*.3),null,'can walk into the room');
g.leave();

// Building 30 must open on the depicted third-floor dwelling, not the lower gallery used by the source overview.
assert.ok(g.enter('no30'));const no30=g.scenes().no30,no30Entry=no30.walkEntry,no30UV=g.fromWorld(api.st.wx,api.st.wz),no30Look=g.toWorldTrue(...no30Entry.target);
assert.ok(Math.hypot(no30UV[0]-no30Entry.u,no30UV[1]-no30Entry.v)<.01,'Building 30 entry remains on its selected room floor');
assert.ok(api.st.walkGround>no30.walkEnvelope.base&&api.st.walkGround<no30.walkEnvelope.base+.1,'Building 30 avoids the lower-gallery floor');
assert.ok(Math.cos(api.st.az-Math.atan2(no30Look[0]-api.st.wx,no30Look[1]-api.st.wz))>.999,'Building 30 opens toward the kamado and water jar');g.leave();

// Building 16 opens toward the documented pair of fresh-water and seawater taps.
assert.ok(g.enter('nikkyu'));const nikkyu=g.scenes().nikkyu,nikkyuEntry=nikkyu.walkEntry,nikkyuUV=g.fromWorld(api.st.wx,api.st.wz),nikkyuLook=g.toWorldTrue(...nikkyuEntry.target);
assert.ok(Math.hypot(nikkyuUV[0]-nikkyuEntry.u,nikkyuUV[1]-nikkyuEntry.v)<.01,'Building 16 entry remains on clear floor');
assert.ok(Math.cos(api.st.az-Math.atan2(nikkyuLook[0]-api.st.wx,nikkyuLook[1]-api.st.wz))>.999,'Building 16 opens toward its dual taps');g.leave();

// A classroom opens toward the board and supports actual forward input from the rear aisle.
assert.ok(g.enter('school'));const schoolEntry=g.scenes().school.walkEntry,schoolUV=g.fromWorld(api.st.wx,api.st.wz),schoolLook=g.toWorldTrue(...schoolEntry.target);
assert.ok(Math.hypot(schoolUV[0]-schoolEntry.u,schoolUV[1]-schoolEntry.v)<.01);
assert.ok(Math.cos(api.st.az-Math.atan2(schoolLook[0]-api.st.wx,schoolLook[1]-api.st.wz))>.999);
const schoolStart=[api.st.wx,api.st.wz];g.input.y=1;for(let i=0;i<10;i++)frame();g.pause();
assert.ok(Math.hypot(api.st.wx-schoolStart[0],api.st.wz-schoolStart[1])>.95,'walk forward into classroom');g.leave();

for(let x=-1000;x<=1000;x+=100)for(let z=-1000;z<=1000;z+=100){const uv=g.fromWorld(x,z);if(!win.JTAWalkBuildings.inPoly(uv,api.model().coast))assert.equal(g.canWalk(x,z),null,'sea is not walkable');}
// Move east/right relative to the screen when facing positive world Z.
g.reset();api.st.az=0;const x=api.st.wx;g.input.x=1;for(let i=0;i<3;i++)frame();assert.ok(api.st.wx<x,'right is camera-relative');g.pause();const px=api.st.wx;frame();assert.equal(api.st.wx,px,'pause clears input');
assert.ok(draws>0);
assert.equal(g.camera,undefined,'walk has only a first-person camera');
// Exercise the keyboard event path, not only synthetic joystick input.
for(const [key,axis,sign] of [['w','wz',1],['s','wz',-1],['a','wx',1],['d','wx',-1]]){
 g.enter('gym');api.st.az=0;const start=api.st[axis];
 for(const fn of events.keydown||[])fn({key,preventDefault:noop});
 for(let i=0;i<3;i++)frame();
 for(const fn of events.keyup||[])fn({key});
 assert.ok((api.st[axis]-start)*sign>.1,key+' moves in its camera-relative direction');
 const end=api.st[axis];frame();assert.equal(api.st[axis],end,key+' release stops movement');g.leave();
}

// Indoor sprint must actually be faster; full touch input uses the same running path.
function travel(run,autoRun){g.leave();g.enter('gym');api.st.az=0;g.pause();g.input.run=run;g.input.autoRun=autoRun;g.input.y=1;const x=api.st.wx,z=api.st.wz;for(let i=0;i<5;i++)frame();g.pause();return Math.hypot(api.st.wx-x,api.st.wz-z);}
const walkDistance=travel(false,false),runDistance=travel(true,false),stickDistance=travel(false,true);
assert.ok(runDistance>walkDistance*1.9,'indoor run doubles actual travelled distance');assert.ok(Math.abs(stickDistance-runDistance)<.01,'full stick sprints');
// Run toward a completed gym end wall at the maximum simulated frame duration.
g.enter('gym');const envelope=g.scenes().gym.walkEnvelope,cc=Math.cos(envelope.angle),ss=Math.sin(envelope.angle);
const wall=g.toWorldTrue(envelope.u+(envelope.x1*cc)/.805,envelope.v+(envelope.x1*ss)/.805);
api.st.az=Math.atan2(wall[0]-api.st.wx,wall[1]-api.st.wz);g.input.run=true;g.input.y=1;
for(let i=0;i<180;i++){now+=20;frame();}
const endUV=g.fromWorld(api.st.wx,api.st.wz),localX=(endUV[0]-envelope.u)*.805*cc+(endUV[1]-envelope.v)*.805*ss;
assert.ok(localX<envelope.x1-.10,'sprinting cannot tunnel through the completed wall');g.pause();g.leave();

// Drive the actual axis-separated movement loop up and down a representative 10-storey building.
assert.ok(g.enter('building-190946508'));
const sc=g.scenes()[api.scene()],p=sc.walkPlan;
function drive(points){for(const q of points){const uv=[(q[0]*p.c-q[1]*p.s)/.805,(q[0]*p.s+q[1]*p.c)/.805],target=g.toWorldTrue(...uv);let n=0;
 while(Math.hypot(target[0]-api.st.wx,target[1]-api.st.wz)>.09&&n++<1000){api.st.az=Math.atan2(target[0]-api.st.wx,target[1]-api.st.wz);g.input.y=1;frame();}
 assert.ok(n<1000,'real movement reaches stair waypoint');g.pause();
}}
const points=p.routes.flatMap(r=>r.points);drive(points);assert.equal(g.floor().current,p.floors,'roof reached through movement');drive(points.slice().reverse());assert.equal(g.floor().current,0,'returned to ground floor');
g.leave();api.setYear(0,0);assert.equal(g.year(),1947);g.reset();assert.ok(api.st.walk);
// Inferred studies are labelled in every page language from the names table, not in Japanese only.
const all=Object.values(g.scenes()),blower=all.find(x=>x.building==='ブロワー室'),block=all.find(x=>x.generatedBuilding&&/^\d+号棟$/.test(x.building||''));
assert.equal(blower.label.en,'Blower house · floors & roof (inferred)');assert.equal(blower.label['zh-Hans'],'鼓风机室 · 各层与屋顶（推定）');
assert.match(block.label.en,/^Building \d+ · floors & roof \(inferred\)$/);assert.match(block.label.ko,/^\d+호동 · 각 층·옥상\(추정\)$/);
// Look tuning accepts only known keys, clamps numbers to their ranges and resets to the defaults.
const tune=g.appearance,defaults=tune.get(),ranges=tune.ranges();
assert.equal(defaults.preset,'summer');assert.equal(defaults.quality,'auto');
const tuned=tune.set(JSON.parse('{"exposure":99,"grass":-3,"preset":"nope","quality":"low","__proto__":{"polluted":1},"unknown":5,"haze":"2"}'));
assert.equal(tuned.exposure,ranges.exposure[1]);assert.equal(tuned.grass,ranges.grass[0]);assert.equal(tuned.preset,'summer');assert.equal(tuned.quality,'low');
assert.equal(tuned.haze,defaults.haze);assert.ok(!('unknown' in tuned)&&!({}).polluted);
tune.set({preset:'winter'});assert.equal(tune.get().preset,'winter');tune.get().preset='magic';assert.equal(tune.get().preset,'winter','get returns a copy');
for(const q of tune.qualities()){tune.set({quality:q});frame();}
assert.deepEqual(tune.reset(),defaults);
// Placeholder nature (walking view): the arched deck carries the walker over the pond; the pond beside it and fence rails block.
api.setYear(1,0);g.reset();
const set=g.nature(),br=set.bridges[0],pd=set.ponds[0],at=(k,s)=>g.toWorldTrue(br.u+(br.axis[0]*k*br.span-br.axis[1]*s)/.805,br.v+(br.axis[1]*k*br.span+br.axis[0]*s)/.805);
const end=at(-.5,0);api.st.wx=end[0];api.st.wz=end[1];api.st.walkGround=br.y0;
const mid=at(0,0);assert.ok(Math.abs(g.canWalk(mid[0],mid[1])-((br.y0+br.y1)/2+br.arch))<.05,'arched deck height at mid-span');
const side=at(0,pd.r*.7);assert.equal(g.canWalk(side[0],side[1]),null,'the pond blocks beside the deck');
const run=set.fences[set.fences.length-1],rail=g.toWorldTrue((run[1][0]+run[2][0])/2,(run[1][1]+run[2][1])/2);
api.st.wx=rail[0]+1;api.st.wz=rail[1];api.st.walkGround=run[1][2];
assert.equal(g.canWalk(rail[0],rail[1]),null,'fence rails block');
});
