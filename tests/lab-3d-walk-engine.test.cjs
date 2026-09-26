const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..');
for(const bigIndex of [true,false])require('node:test')('walk engine: controls, sea boundary, every available interior and floor levels (uint indexes: '+bigIndex+')',async()=>{
const noop=()=>{},events={},raf=[];let now=0,draws=0,ready;
const loaded=new Promise(r=>ready=r);
const gl=new Proxy({getExtension:n=>bigIndex&&n==='OES_element_index_uint'?{}:null,getParameter:()=>4096,getShaderParameter:()=>true,getProgramParameter:()=>true,createBuffer:()=>({}),createShader:()=>({}),createProgram:()=>({}),createTexture:()=>({}),getUniformLocation:()=>({}),drawElements:()=>draws++},{get:(o,k)=>k in o?o[k]:/^[A-Z_0-9]+$/.test(k)?1:noop});
const canvas={getContext:()=>gl,getBoundingClientRect:()=>({width:1280,height:800}),clientWidth:1280,clientHeight:800,classList:{add:noop,remove:noop},focus:noop,addEventListener:(k,f)=>(events[k]??=[]).push(f)};
const status={textContent:''},document={currentScript:{src:'https://japantimeatlas.com/3d/gunkanjima-3d.js'},getElementById:id=>id==='view'?canvas:id==='viewStatus'?status:null,querySelectorAll:()=>[],addEventListener:noop};
const win={JTA_WALK_PAGE:true,LAB_LANG:'ja',JTAWalkNav:require(root+'/3d/gunkanjima-walk-nav.js'),JTAWalkInteriors:require(root+'/3d/gunkanjima-walk-interiors.js'),JTAWalkBuildings:require(root+'/3d/gunkanjima-walk-buildings.js'),devicePixelRatio:1,matchMedia:()=>({matches:false}),addEventListener:noop,dispatchEvent:e=>{if(e.type==='jta-walk-ready')ready();}};
const ctx={window:win,document,navigator:{},location:{search:'',hash:''},console,URL,CustomEvent:class{constructor(type){this.type=type;}},performance:{now:()=>now},requestAnimationFrame:f=>raf.push(f),setTimeout:()=>0,Image:class{width=1024;set src(v){queueMicrotask(()=>this.onload())}},fetch:async url=>{const file=path.join(root,new URL(url).pathname);const data=fs.readFileSync(file);return{ok:true,json:async()=>JSON.parse(data),arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)}},matchMedia:win.matchMedia};
vm.runInNewContext(fs.readFileSync(root+'/3d/gunkanjima-3d.js','utf8'),ctx);
await loaded;const api=win.jtaLab3d,g=api.game;assert.ok(api.st.walk);assert.notEqual(g.canWalk(api.st.wx,api.st.wz),null,'outdoor spawn supported');
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
});
