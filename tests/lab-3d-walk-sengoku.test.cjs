const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const N=require('../3d/gunkanjima-walk-nature.js'),{fitTerrain}=require('../3d/gunkanjima-walk-buildings.js'),model=require('../3d/gunkanjima-model.json');
const footprints=model.buildings.flatMap(b=>b.wings||[b.poly]),spawn=[490,650];
function world(step){
 const t=model.terrain,raw=fs.readFileSync(path.join(root,'3d',t.file)),w=Math.floor((t.w-1)/step)+1,h=Math.floor((t.h-1)/step)+1;
 const heights=Float32Array.from({length:w*h},(_,i)=>raw.readUInt16LE((Math.floor(i/w)*step*t.w+(i%w)*step)*2)*t.unit);
 const grid={w,h,step,x0:t.x0,y0:t.y0};fitTerrain(heights,grid,model.buildings);
 const f=N.field(grid,heights,model.buildings,model.coast,{year:1962}),F=N.features(f,heights,{spawn,avoid:footprints,coast:model.coast,lowEnd:step>1});
 const s=N.scatter(f,heights,{lowEnd:step>1,avoid:footprints,spawn,keepOut:F.keepOut});
 const set=Object.assign({},s,{trees:s.trees.concat(F.trees),rocks:s.rocks.concat(F.rocks),fences:F.fences,bridges:F.bridges,ponds:F.ponds,ruins:F.ruins});
 const keepOut=F.keepOut.concat(set.trees.map(t=>({u:t.u,v:t.v,r:1.2})),set.rocks.map(r=>({u:r.u,v:r.v,r:r.size*.6})),set.ponds.map(p=>({u:p.u,v:p.v,r:p.r+1.5})));
 set.props=N.sengokuProps(f,heights,{lowEnd:step>1,avoid:footprints,spawn,keepOut});
 return {f,heights,set,keepOut};
}
for(const step of [1,2])test('realistic-look props stand on land, outside every footprint, clear of the arrival point and each other (terrain step '+step+')',()=>{
 const {f,heights,set,keepOut}=world(step),P=set.props;
 assert.ok(P.fires.length>=3&&P.fires.length<=8,'fires '+P.fires.length);
 assert.ok(P.fires.some(x=>x.kind===0)&&P.fires.some(x=>x.kind===1),'open fires and drum-can fires');
 assert.ok(P.lanterns.length>=(step>1?2:4)&&P.lanterns.length<=12&&P.jizo.length>=3&&P.jizo.length<=6&&P.banners.length===0,'street lamps '+P.lanterns.length+', jizo '+P.jizo.length+', banners '+P.banners.length);
 const all=[...P.fires,...P.lanterns,...P.jizo,...P.banners];
 for(const o of all){
  assert.ok(N.inPoly([o.u,o.v],model.coast),'inside the coast');
  assert.ok(!footprints.some(p=>N.inPoly([o.u,o.v],p)),'outside every footprint of every era');
  assert.ok(Math.hypot(o.u-spawn[0],o.v-spawn[1])*N.MPP>4,'arrival point stays open');
  assert.ok(Number.isFinite(o.y)&&o.y>0,'on the ground');
  assert.ok(!keepOut.some(k=>Math.hypot(o.u-k.u,o.v-k.v)*N.MPP<k.r),'clear of trees, rocks, ponds and set pieces');
 }
 for(const fi of P.fires)assert.ok(N.sample(f,f.path,fi.u,fi.v)<=.3,'fires keep off the worn paths');
 for(let i=0;i<P.fires.length;i++)for(let j=i+1;j<P.fires.length;j++)assert.ok(Math.hypot(P.fires[i].u-P.fires[j].u,P.fires[i].v-P.fires[j].v)*N.MPP>=28,'fires are spread out');
 assert.deepEqual(world(step).set.props,P,'deterministic placement');
});
test('sengoku meshes fit 16-bit indices with unit normals; the anime look is unchanged',()=>{
 const {set}=world(2),kinds=new Set(),animeKinds=new Set();
 for(const b of N.meshes(set,'sengoku')){
  assert.ok(b.count<65536&&b.idx.every(i=>i<b.count));
  for(let i=0;i<b.count;i++){const l=Math.hypot(b.nor[i*3],b.nor[i*3+1],b.nor[i*3+2]);assert.ok(Math.abs(l-1)<1e-3,'unit normals');kinds.add(Math.round(b.info[i*3+1]));}
 }
 for(const k of [0,1,3,8,9,10,11,12])assert.ok(kinds.has(k),'sengoku mesh kind '+k);
 for(const b of N.meshes(set))for(let i=0;i<b.count;i++)animeKinds.add(Math.round(b.info[i*3+1]));
 assert.ok(![9,10,11,12].some(k=>animeKinds.has(k)),'no sengoku props in the anime look');
 assert.ok(animeKinds.has(4),'anime blossoms remain');
});
test('the walk opens in the realistic look with six skies; the anime look keeps four; props block walking only in the sengoku look',async()=>{
 const noop=()=>{},raf=[],sources=[];let now=0,ready;const loaded=new Promise(r=>ready=r);
 const gl=new Proxy({shaderSource:(s,src)=>sources.push(src),getExtension:n=>n==='OES_element_index_uint'?{}:null,getParameter:()=>4096,getShaderParameter:()=>true,getProgramParameter:()=>true,createBuffer:()=>({}),createShader:()=>({}),createProgram:()=>({}),createTexture:()=>({}),getUniformLocation:()=>({})},{get:(o,k)=>k in o?o[k]:/^[A-Z_0-9]+$/.test(k)?1:noop});
 const canvas={getContext:()=>gl,getBoundingClientRect:()=>({width:1280,height:800}),clientWidth:1280,clientHeight:800,classList:{add:noop,remove:noop},focus:noop,addEventListener:noop};
 const document={currentScript:{src:'https://japantimeatlas.com/3d/gunkanjima-3d.js'},getElementById:id=>id==='view'?canvas:null,querySelectorAll:()=>[],addEventListener:noop};
 const win={JTA_WALK_PAGE:true,LAB_LANG:'ja',JTAWalkNav:require(root+'/3d/gunkanjima-walk-nav.js'),JTAWalkInteriors:require(root+'/3d/gunkanjima-walk-interiors.js'),JTAWalkBuildings:require(root+'/3d/gunkanjima-walk-buildings.js'),JTAWalkNature:N,devicePixelRatio:1,matchMedia:()=>({matches:false}),addEventListener:noop,dispatchEvent:e=>{if(e.type==='jta-walk-ready')ready();}};
 const ctx={window:win,document,navigator:{},location:{search:'',hash:''},console,URL,CustomEvent:class{constructor(type){this.type=type;}},performance:{now:()=>now},requestAnimationFrame:f=>raf.push(f),setTimeout:()=>0,Image:class{width=1024;set src(v){queueMicrotask(()=>this.onload())}},fetch:async url=>{const data=fs.readFileSync(path.join(root,new URL(url).pathname));return{ok:true,json:async()=>JSON.parse(data),arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)}},matchMedia:win.matchMedia};
 vm.runInNewContext(fs.readFileSync(root+'/3d/gunkanjima-3d.js','utf8'),ctx);
 await loaded;const api=win.jtaLab3d,g=api.game,look=g.appearance;
 assert.equal(look.get().style,'sengoku','sengoku is the default look');
 assert.ok(sources.some(s=>s.startsWith('#define SENGOKU 1\n')),'the sengoku look compiles its own shader variant');
 assert.ok(!fs.readFileSync(root+'/3d/gunkanjima-3d.js','utf8').includes('uEnv.x'),'no runtime branch between the looks is left in the shaders');
 const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
 same(look.styles(),['sengoku','anime']);
 same(g.skies(),['dusk','overcast','rain','mist','snow','night'],'six sengoku skies');
 const P=g.nature().props;assert.ok(P&&P.lanterns.length,'props are built with the nature');
 const l=P.lanterns[0],at=g.toWorldTrue(l.u,l.v);
 assert.equal(g.canWalk(at[0],at[1]),null,'a stone lantern blocks walking in the sengoku look');
 api.st.weather=5;look.set({style:'anime'});
 assert.equal(api.st.weather,0,'an out-of-range sky falls back to the first');
 same(g.skies(),['clear','cloudy','rain','fog'],'four anime skies');
 assert.equal(look.get().saturation,1.06,'the anime look restores its own defaults');
 assert.notEqual(g.canWalk(at[0],at[1]),null,'props do not block walking in the anime look');
 const n0=sources.length;api.draw();const anime=sources.slice(n0);
 assert.ok(anime.length>0&&anime.every(s=>!s.includes('SENGOKU 1')),'the anime look rebuilds its programs without the sengoku variant');
 const n1=sources.length;look.set({style:'sengoku'});api.draw();const back=sources.slice(n1);
 assert.ok(back.length===anime.length&&back.every(s=>s.startsWith('#define SENGOKU 1\n')),'switching back rebuilds the sengoku variant');
 assert.equal(look.get().preset,'summer');assert.equal(look.get().saturation,.8);
 look.reset();assert.equal(look.get().style,'sengoku');
});
