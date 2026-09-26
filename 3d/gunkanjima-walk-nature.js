/* Placeholder nature for the walking view only: meadow grass, worn dirt paths, flowers, trees,
   bushes and rocks, generated deterministically from the terrain, footprints and coast.
   This is illustrative anime-style set dressing, NOT evidence of Hashima's historical vegetation. */
(function(root){
'use strict';
const MPP=.805;
function inPoly(p,poly){let v=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])v=!v;}return v;}
// Integer hash and value noise: identical results in every browser and in Node.
function hash(x,y,s){let h=Math.imul(x|0,0x27d4eb2d)^Math.imul(y|0,0x165667b1)^Math.imul((s|0)+0x3c6ef372,0x85ebca6b);h=Math.imul(h^(h>>>15),0x2c1b3c6d);h=Math.imul(h^(h>>>12),0x297a2d39);return ((h^(h>>>15))>>>0)/4294967296;}
function noise(x,y,s){const i=Math.floor(x),j=Math.floor(y),f=x-i,g=y-j,u=f*f*(3-2*f),v=g*g*(3-2*g),a=hash(i,j,s),b=hash(i+1,j,s),c=hash(i,j+1,s),d=hash(i+1,j+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
function fbm(x,y,s){return .55*noise(x,y,s)+.3*noise(x*2.03+11.3,y*2.03-7.1,s+1)+.15*noise(x*4.1-3.7,y*4.1+5.3,s+2);}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Two-pass chamfer distance (metres) to the cells marked in `source`.
function distance(source,w,h,cell){
 const d=new Float32Array(w*h),dg=cell*Math.SQRT2;
 for(let k=0;k<w*h;k++)d[k]=source[k]?0:1e9;
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){const k=j*w+i;let v=d[k];
  if(i>0)v=Math.min(v,d[k-1]+cell);
  if(j>0){v=Math.min(v,d[k-w]+cell);if(i>0)v=Math.min(v,d[k-w-1]+dg);if(i<w-1)v=Math.min(v,d[k-w+1]+dg);}
  d[k]=v;}
 for(let j=h-1;j>=0;j--)for(let i=w-1;i>=0;i--){const k=j*w+i;let v=d[k];
  if(i<w-1)v=Math.min(v,d[k+1]+cell);
  if(j<h-1){v=Math.min(v,d[k+w]+cell);if(i<w-1)v=Math.min(v,d[k+w+1]+dg);if(i>0)v=Math.min(v,d[k+w-1]+dg);}
  d[k]=v;}
 return d;
}
function rasterise(polys,grid,out){
 const {w,h,step,x0,y0}=grid;
 for(const poly of polys){
  if(!poly||poly.length<3)continue;
  const lo=[Math.max(0,Math.floor((Math.min(...poly.map(p=>p[0]))-x0)/step)),Math.max(0,Math.floor((Math.min(...poly.map(p=>p[1]))-y0)/step))];
  const hi=[Math.min(w-1,Math.ceil((Math.max(...poly.map(p=>p[0]))-x0)/step)),Math.min(h-1,Math.ceil((Math.max(...poly.map(p=>p[1]))-y0)/step))];
  for(let j=lo[1];j<=hi[1];j++)for(let i=lo[0];i<=hi[0];i++)if(inPoly([x0+i*step,y0+j*step],poly))out[j*w+i]=1;
 }
 return out;
}
/* Per-vertex surface classes for the terrain mesh. All values are 0..1 except shore (signed metres).
   grass: meadow/hillside cover; path: worn dirt through meadows; flower: flower patches;
   weed: tufts along wall bases and pavement cracks; rock: bare cliff faces. */
function field(grid,heights,buildings,coast,opts){
 opts=opts||{};
 const {w,h,step,x0,y0}=grid,cell=step*MPP,n=w*h;
 const built=rasterise(buildings.flatMap(b=>b.wings||[b.poly]),grid,new Uint8Array(n));
 const sea=new Uint8Array(n),land=new Uint8Array(n);
 for(let k=0;k<n;k++){const water=heights[k]<.05||(coast&&!inPoly([x0+(k%w)*step,y0+Math.floor(k/w)*step],coast));sea[k]=water?1:0;land[k]=water?0:1;}
 const f={w,h,step,x0,y0,cell,year:opts.year||1962,built,sea,toBuilding:distance(built,w,h,cell),toSea:distance(sea,w,h,cell),toLand:distance(land,w,h,cell),
  grass:new Float32Array(n),path:new Float32Array(n),flower:new Float32Array(n),weed:new Float32Array(n),rock:new Float32Array(n),shore:new Float32Array(n),upright:new Float32Array(n)};
 shade(f,heights,0,0,w-1,h-1);
 return f;
}
// Classifies grid cells in a box; called again after local terrain edits.
function shade(f,heights,i0,j0,i1,j1){
 const {w,h,step,x0,y0,cell,built,sea,toBuilding,toSea,toLand}=f,wild=smooth(1974,2010,f.year);
 for(let j=Math.max(0,j0);j<=Math.min(h-1,j1);j++)for(let i=Math.max(0,i0);i<=Math.min(w-1,i1);i++){
  const k=j*w+i,u=x0+i*step,v=y0+j*step;
  const hl=heights[j*w+Math.max(i-1,0)],hr=heights[j*w+Math.min(i+1,w-1)],hu=heights[Math.max(j-1,0)*w+i],hd=heights[Math.min(j+1,h-1)*w+i];
  const gx=(hr-hl)/(2*cell),gz=(hd-hu)/(2*cell),ny=1/Math.sqrt(1+gx*gx+gz*gz);
  f.upright[k]=ny;
  f.shore[k]=sea[k]?-Math.min(toLand[k],40):Math.min(toSea[k],40);
  f.grass[k]=f.path[k]=f.flower[k]=f.weed[k]=f.rock[k]=0;
  if(sea[k]||built[k])continue;
  const hill=smooth(.985,.9,ny),cliff=smooth(.62,.42,ny);
  const meadow=smooth(.36,.52,fbm(u*.042,v*.042,3));
  const clear=smooth(1.8,5.5,toBuilding[k]);
  const waterline=smooth(1.2,3.4,toSea[k]);
  const g=Math.max(hill,clear*meadow,wild*clear*.8)*waterline*(1-cliff*.75);
  const p=(1-smooth(.02,.046,Math.abs(fbm(u*.017+4.1,v*.017-2.7,7)-.5)))*smooth(.88,.97,ny)*clear;
  f.path[k]=Math.min(1,p*smooth(.15,.5,g)*1.15);
  f.grass[k]=g*(1-f.path[k]*.9);
  f.flower[k]=f.grass[k]*smooth(.6,.74,fbm(u*.1,v*.1,9));
  f.weed[k]=Math.max((1-smooth(.4,1.6,toBuilding[k]))*.8,smooth(.64,.8,noise(u*.6,v*.6,13))*.55)*waterline*(1-f.grass[k])*(1-f.path[k]);
  f.rock[k]=Math.max(cliff,(1-smooth(.4,2.0,toSea[k]))*.85);
 }
}
/* Meadow set pieces (illustrative, walking view only): grassy mounds ringed with rocks, a pond on a worn
   path crossed by an arched plank bridge, post-and-rail fences along coastal drop-offs and a row of mossy
   concrete ruins. Heights are edited in place and the local cover is re-shaded. */
function features(f,heights,opts){
 opts=opts||{};
 const out={mounds:[],ponds:[],bridges:[],fences:[],ruins:[],rocks:[],trees:[],keepOut:[]},spawn=opts.spawn,avoid=opts.avoid||[];
 const idx=(u,v)=>{const i=Math.round((u-f.x0)/f.step),j=Math.round((v-f.y0)/f.step);return i<0||j<0||i>=f.w||j>=f.h?-1:j*f.w+i;};
 const get=(arr,u,v)=>sample(f,arr,u,v),metres=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])*MPP;
 const clear=(u,v,r)=>(!spawn||metres([u,v],spawn)>r+9)&&get(f.toBuilding,u,v)>r+3.5&&get(f.toSea,u,v)>r+4&&!avoid.some(p=>inPoly([u,v],p))&&!out.keepOut.some(o=>metres([u,v],[o.u,o.v])<o.r+r+3);
 const flat=(u,v,r)=>{let lo=1e9,hi=-1e9;for(let a=0;a<8;a++)for(const t of [.5,1]){const y=get(heights,u+Math.cos(a*.785)*r*t/MPP,v+Math.sin(a*.785)*r*t/MPP);lo=Math.min(lo,y);hi=Math.max(hi,y);}return hi-lo;};
 const edit=(u,v,r,fn)=>{
  const rp=r/MPP,i0=Math.floor((u-rp-f.x0)/f.step),i1=Math.ceil((u+rp-f.x0)/f.step),j0=Math.floor((v-rp-f.y0)/f.step),j1=Math.ceil((v+rp-f.y0)/f.step);
  for(let j=Math.max(0,j0);j<=Math.min(f.h-1,j1);j++)for(let i=Math.max(0,i0);i<=Math.min(f.w-1,i1);i++){const k=j*f.w+i,d=metres([f.x0+i*f.step,f.y0+j*f.step],[u,v]);if(d<r)heights[k]=fn(heights[k],d);}
  shade(f,heights,i0-1,j0-1,i1+1,j1+1);
  return [i0,j0,i1,j1];
 };
 // Sunken worn paths: lowered relative to the existing surface so the relief is kept.
 for(let k=0;k<f.w*f.h;k++)if(f.path[k]>.05&&f.upright[k]>.9&&f.toBuilding[k]>3)heights[k]-=.22*smooth(.15,.8,f.path[k]);
 const cands=[],stride=Math.max(1,Math.round(2.5/f.step));
 for(let j=3;j<f.h-3;j+=stride)for(let i=3;i<f.w-3;i+=stride){const k=j*f.w+i;if(f.sea[k]||f.built[k]||f.upright[k]<.985)continue;cands.push({u:f.x0+i*f.step,v:f.y0+j*f.step,open:f.toBuilding[k],path:f.path[k],grass:f.grass[k]});}
 cands.sort((a,b)=>b.open-a.open||a.u-b.u||a.v-b.v);
 // 1. A pond where a worn path crosses open flat ground; the bridge follows the path.
 for(const c of cands){
  const R=4.2;
  if(c.path<.85||!clear(c.u,c.v,R+2)||flat(c.u,c.v,R+2)>.7)continue;
  let best=0,axis=0;
  for(let a=0;a<16;a++){const t=a/16*Math.PI,s=get(f.path,c.u+Math.cos(t)*(R+2)/MPP,c.v+Math.sin(t)*(R+2)/MPP)+get(f.path,c.u-Math.cos(t)*(R+2)/MPP,c.v-Math.sin(t)*(R+2)/MPP);if(s>best){best=s;axis=t;}}
  if(best<.9)continue;
  const y0=get(heights,c.u,c.v),level=y0-.06;
  edit(c.u,c.v,R+1.6,(y,d)=>d<R?Math.min(y,y0-.12-.55*(1-(d/R)*(d/R))):Math.min(y,y0-.12+(y-y0+.12)*smooth(R,R+1.6,d)));
  const rp=(R+1.4)/MPP;
  for(let j=Math.floor((c.v-rp-f.y0)/f.step);j<=Math.ceil((c.v+rp-f.y0)/f.step);j++)for(let i=Math.floor((c.u-rp-f.x0)/f.step);i<=Math.ceil((c.u+rp-f.x0)/f.step);i++){
   if(i<0||j<0||i>=f.w||j>=f.h)continue;const k=j*f.w+i,d=metres([f.x0+i*f.step,f.y0+j*f.step],[c.u,c.v]);
   if(d<R-.2){f.grass[k]=f.path[k]=f.flower[k]=f.weed[k]=f.rock[k]=0;}
   else if(d<R+1.4){const ring=1-smooth(R+.4,R+1.4,d);f.path[k]=Math.max(f.path[k],ring*.8);f.grass[k]*=1-ring*.9;f.flower[k]*=1-ring;f.weed[k]*=1-ring;}
  }
  out.ponds.push({u:c.u,v:c.v,r:R,level});
  const span=2*R+1.8,ax=[Math.cos(axis),Math.sin(axis)],ends=[-1,1].map(s=>get(heights,c.u+ax[0]*s*span/2/MPP,c.v+ax[1]*s*span/2/MPP));
  out.bridges.push({u:c.u,v:c.v,axis:ax,span,width:1.7,y0:ends[0],y1:ends[1],arch:.1*span});
  out.keepOut.push({u:c.u,v:c.v,r:R+1.2});
  break;
 }
 // 2. Grassy mounds, each ringed with rocks and topped by one tree.
 for(const c of cands){
  if(out.mounds.length>=(opts.lowEnd?2:3))break;
  const R=4.5+2*hash(Math.round(c.u),Math.round(c.v),61);
  if(c.path>.05||c.grass<.5||!clear(c.u,c.v,R+1)||flat(c.u,c.v,R)>.8)continue;
  let onPath=false;for(let a=0;a<12&&!onPath;a++)onPath=get(f.path,c.u+Math.cos(a*.524)*(R+1)/MPP,c.v+Math.sin(a*.524)*(R+1)/MPP)>.1;
  if(onPath)continue;
  const H=1.2+.8*hash(Math.round(c.u),Math.round(c.v),67);
  edit(c.u,c.v,R,(y,d)=>y+H*(.5+.5*Math.cos(Math.PI*d/R)));
  out.mounds.push({u:c.u,v:c.v,r:R,h:H});out.keepOut.push({u:c.u,v:c.v,r:R+2});
  const n=5+Math.floor(hash(Math.round(c.u),Math.round(c.v),71)*3);
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2+hash(i,Math.round(c.u),73)*.6,rr=R*(.9+.15*hash(i,Math.round(c.v),79)),u=c.u+Math.cos(a)*rr/MPP,v=c.v+Math.sin(a)*rr/MPP,size=.7+.9*hash(i,Math.round(c.u+c.v),83);out.rocks.push({u,v,y:get(heights,u,v)-size*.25,size,seed:Math.floor(hash(i,Math.round(c.u),89)*983)});}
  out.trees.push({u:c.u,v:c.v,y:get(heights,c.u,c.v)-.08,height:6+2*hash(Math.round(c.u),3,97),radius:2.6,seed:Math.floor(hash(Math.round(c.v),5,97)*997),kind:0});
 }
 // 3. A row of mossy concrete pillars with a fallen gear wheel (placeholder industrial ruin).
 for(const c of cands){
  if(out.ruins.length)break;
  if(c.path>.05||c.grass<.4||!clear(c.u,c.v,6))continue;
  const t=hash(Math.round(c.u),Math.round(c.v),101)*Math.PI,d=[Math.cos(t),Math.sin(t)],pillars=[];
  for(let i=-2;i<=2;i++){const u=c.u+d[0]*i*4.2/MPP,v=c.v+d[1]*i*4.2/MPP;if(get(f.path,u,v)>.1||!clear(u,v,1)||get(f.upright,u,v)<.95)continue;pillars.push({u,v,y:get(heights,u,v)-.2,h:3.2+2.8*hash(i+3,Math.round(c.u),103),size:1.05,yaw:t,seed:i+7});}
  if(pillars.length<3)continue;
  const g=pillars[0],gu=g.u-d[1]*2.6/MPP,gv=g.v+d[0]*2.6/MPP;
  out.ruins.push({pillars,gear:{u:gu,v:gv,y:get(heights,gu,gv)+.2,r:1.35,yaw:t+.6,seed:13}});
  out.keepOut.push({u:c.u,v:c.v,r:11});
 }
 // 4. Post-and-rail fences along grassy coastal drop-offs, open where paths reach the coast.
 const coast=opts.coast;
 if(coast){
  let run=[];const flush=()=>{if(run.length>=3){out.fences.push(run);for(const q of run)out.keepOut.push({u:q[0],v:q[1],r:.6});}run=[];};
  for(let e=0;e<coast.length;e++){
   const a=coast[e],b=coast[(e+1)%coast.length],len=metres(a,b),steps=Math.max(1,Math.floor(len/2.3));
   let nx=-(b[1]-a[1]),nz=b[0]-a[0];const nl=Math.hypot(nx,nz)||1;nx/=nl;nz/=nl;
   const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];if(!inPoly([mid[0]+nx*2,mid[1]+nz*2],coast)){nx=-nx;nz=-nz;}
   for(let s=0;s<steps;s++){
    const t=s/steps,u=a[0]+(b[0]-a[0])*t+nx*1.7/MPP,v=a[1]+(b[1]-a[1])*t+nz*1.7/MPP,y=get(heights,u,v);
    const ok=inPoly([u,v],coast)&&get(f.grass,u,v)>.3&&get(f.path,u,v)<.25&&get(f.toBuilding,u,v)>1.8&&y>.6&&(!spawn||metres([u,v],spawn)>5)&&!avoid.some(p=>inPoly([u,v],p))&&!out.keepOut.some(o=>metres([u,v],[o.u,o.v])<o.r+1);
    if(ok&&run.length&&metres(run[run.length-1],[u,v])>3.4)flush();
    if(ok)run.push([u,v,y-.04]);else flush();
   }
  }
  flush();
 }
 // 5. Short post-and-rail runs beside worn paths (in the video the AI fenced its path without being asked). Each
 //    run follows one edge of a path along a level line of the noise that draws the paths, and stops at walls,
 //    slopes, other set pieces or where the path turns away.
 const lane=(u,v)=>fbm(u*.017+4.1,v*.017-2.7,7),slope=(u,v)=>{const e=.6;return [(lane(u+e,v)-lane(u-e,v))/(2*e),(lane(u,v+e)-lane(u,v-e))/(2*e)];};
 const fenceOk=(u,v)=>(!coast||inPoly([u,v],coast))&&get(f.path,u,v)<.2&&get(f.grass,u,v)>.3&&get(f.toBuilding,u,v)>2.5&&get(f.toSea,u,v)>3&&get(f.upright,u,v)>.93&&(!spawn||metres([u,v],spawn)>6)&&!avoid.some(p=>inPoly([u,v],p))&&!out.keepOut.some(o=>metres([u,v],[o.u,o.v])<o.r+.8);
 const fenced=[];
 for(const c of cands){
  if(fenced.length>=(opts.lowEnd?2:4))break;
  if(c.path<.9||fenced.some(q=>metres(q,[c.u,c.v])<26))continue;
  const target=.5+(hash(Math.round(c.u),Math.round(c.v),131)<.5?-.058:.058);
  const snap=(u,v)=>{for(let it=0;it<5;it++){const g=slope(u,v),g2=g[0]*g[0]+g[1]*g[1]||1e-9,d=(target-lane(u,v))/g2;u+=d*g[0];v+=d*g[1];}return [u,v];};
  const s0=snap(c.u,c.v);
  if(metres(s0,[c.u,c.v])>6||!fenceOk(s0[0],s0[1]))continue;
  const pts=[s0];
  for(const dir of [1,-1]){
   let p=s0;
   for(let n=0;n<4;n++){
    const g=slope(p[0],p[1]),gl=Math.hypot(g[0],g[1])||1,q=snap(p[0]-g[1]/gl*dir*2.3/MPP,p[1]+g[0]/gl*dir*2.3/MPP);
    if(!fenceOk(q[0],q[1])||Math.abs(metres(q,p)-2.3)>.9)break;
    if(dir>0)pts.push(q);else pts.unshift(q);p=q;
   }
  }
  if(pts.length<4)continue;
  const run=pts.map(q=>[q[0],q[1],get(heights,q[0],q[1])-.04]);
  out.fences.push(run);fenced.push([c.u,c.v]);
  for(const q of run)out.keepOut.push({u:q[0],v:q[1],r:.6});
 }
 return out;
}
function sample(f,arr,u,v){
 const fx=Math.max(0,Math.min(f.w-1.001,(u-f.x0)/f.step)),fy=Math.max(0,Math.min(f.h-1.001,(v-f.y0)/f.step)),i=Math.floor(fx),j=Math.floor(fy),a=fx-i,b=fy-j,k=j*f.w+i;
 return (arr[k]*(1-a)+arr[k+1]*a)*(1-b)+(arr[k+f.w]*(1-a)+arr[k+f.w+1]*a)*b;
}
/* Trees, bushes and rocks on jittered grids. `avoid` polygons (every building in any era) keep
   trunks and rocks out of footprints; `spawn` keeps the arrival point clear. */
function scatter(f,heights,opts){
 opts=opts||{};
 const lowEnd=!!opts.lowEnd,avoid=opts.avoid||[],spawn=opts.spawn,trees=[],bushes=[],rocks=[];
 const keepOut=opts.keepOut||[];
 const clearOf=(u,v,r)=>{
  if(spawn&&Math.hypot(u-spawn[0],v-spawn[1])*MPP<r+3.2)return false;
  if(keepOut.some(o=>Math.hypot(u-o.u,v-o.v)*MPP<o.r+r))return false;
  for(const poly of avoid)if(inPoly([u,v],poly))return false;
  return sample(f,f.toBuilding,u,v)>r+.6;
 };
 const ground=(u,v)=>sample(f,heights,u,v);
 const grid=(spacing,seed,fn)=>{
  const s=spacing/MPP;
  for(let gv=f.y0;gv<f.y0+(f.h-1)*f.step;gv+=s)for(let gu=f.x0;gu<f.x0+(f.w-1)*f.step;gu+=s){
   const iu=Math.round(gu/s),iv=Math.round(gv/s);
   fn(gu+hash(iu,iv,seed)*s,gv+hash(iu,iv,seed+1)*s,hash(iu,iv,seed+2),hash(iu,iv,seed+3));
  }
 };
 grid(lowEnd?9.5:6.5,101,(u,v,r,q)=>{
  const g=sample(f,f.grass,u,v),up=sample(f,f.upright,u,v),sea=sample(f,f.toSea,u,v);
  if(g<.55||up<.72||sea<4.5||sample(f,f.path,u,v)>.25)return;
  const hill=smooth(.985,.9,up),chance=.16+.5*hill;
  if(r>chance)return;
  // Random scale x0.82-1.18 plus a few big "hero" trees, as the video enlarged trees for impact.
  const hero=hash(Math.round(u),Math.round(v),103)>.9?1.45:1,k=(.82+.36*hash(Math.round(u),Math.round(v),107))*hero;
  const height=(4.2+q*4.8)*k,radius=(1.5+q*1.6)*k;
  if(!clearOf(u,v,radius*.8))return;
  trees.push({u,v,y:ground(u,v)-.08,height,radius,seed:Math.floor(q*997),kind:q>.72?1:0});
 });
 // Canopy-overlap culling: keep the larger of two trees whose canopies overlap beyond 0.65 of their radii.
 trees.sort((a,b)=>b.radius-a.radius||a.u-b.u||a.v-b.v);
 for(let i=0;i<trees.length;i++)for(let j=trees.length-1;j>i;j--)if(Math.hypot(trees[i].u-trees[j].u,trees[i].v-trees[j].v)*MPP<(trees[i].radius+trees[j].radius)*.65)trees.splice(j,1);
 grid(lowEnd?4.8:3.2,211,(u,v,r,q)=>{
  const g=sample(f,f.grass,u,v),wall=sample(f,f.toBuilding,u,v),sea=sample(f,f.toSea,u,v);
  const nearWall=wall>1.1&&wall<3.2;
  if(sea<2.2||sample(f,f.path,u,v)>.2)return;
  if(r>(nearWall?.34:.12*g))return;
  const radius=.45+q*.75;
  if(!clearOf(u,v,Math.min(radius,.9)))return;
  bushes.push({u,v,y:ground(u,v)-.05,radius,height:radius*(1.05+.35*q),seed:Math.floor(q*991),flowering:q>.7});
 });
 grid(lowEnd?5.5:3.8,307,(u,v,r,q)=>{
  if(sample(f,f.shore,u,v)<.6)return;
  const sea=sample(f,f.toSea,u,v),cliff=sample(f,f.rock,u,v),g=sample(f,f.grass,u,v);
  const chance=sea<5?.3:cliff>.5?.22:g>.4?.04:0;
  if(r>chance)return;
  const size=.35+q*1.1;
  if(!clearOf(u,v,size))return;
  rocks.push({u,v,y:ground(u,v)-size*.25,size,seed:Math.floor(q*983)});
 });
 return {trees,bushes,rocks};
}
/* Indexed low-poly meshes, split into batches below 65,536 vertices for 16-bit index buffers.
   Positions are (u, y, v) in crop pixels/metres like interior boxes; normals are in the crop frame.
   `wind` is 0 at the ground and 1 at the top of each plant; `kind`: 0 trunk, 1 canopy, 2 bush, 3 rock, 4 blossom,
   5 wood (fences, bridge), 6 pond water, 7 mossy concrete/iron ruin, 8 conifer tier. Foliage colours are palette
   coordinates (r: 0 bright .. 1 dark, g: variation) so season presets recolour trees with the meadow. */
function meshes(set){
 const batches=[];let cur=null;
 const begin=need=>{if(!cur||cur.count+need>65000){cur={pos:[],nor:[],col:[],info:[],idx:[],count:0};batches.push(cur);}};
 const vert=(p,nrm,c,wind,kind,seed)=>{cur.pos.push(p[0],p[1],p[2]);cur.nor.push(nrm[0],nrm[1],nrm[2]);cur.col.push(c[0],c[1],c[2]);cur.info.push(wind,kind,seed);return cur.count++;};
 const toUV=(u,v,dx,dz)=>[u+dx/MPP,v+dz/MPP];
 // A squashed UV sphere; `bumpy` jitters radii for rocks; normals blend towards `center` for soft anime foliage shading.
 function blob(o,cx,cy,cz,rx,ry,rz,c,wind0,wind1,kind,seed,bumpy,center){
  const rings=bumpy?5:6,seg=bumpy?7:9;begin((rings+1)*(seg+1));const base=cur.count;
  for(let i=0;i<=rings;i++)for(let j=0;j<=seg;j++){
   const ph=i/rings*Math.PI,th=j/seg*Math.PI*2+seed*.37,jit=bumpy?.78+.34*hash(i,j%seg,seed):1+.1*(hash(i,j%seg,seed)-.5)*(i>0&&i<rings?1:0);
   const nx=Math.sin(ph)*Math.cos(th),ny=Math.cos(ph),nz=Math.sin(ph)*Math.sin(th);
   const lx=nx*rx*jit,ly=ny*ry*jit,lz=nz*rz*jit,uv=toUV(o.u,o.v,cx+lx,cz+lz);
   let n=[nx/rx,ny/ry,nz/rz];
   if(center){const d=[cx+lx-center[0],cy+ly-center[1],cz+lz-center[2]],l=Math.hypot(...d)||1;n=[n[0]*.35+d[0]/l*.65,n[1]*.35+d[1]/l*.65,n[2]*.35+d[2]/l*.65];}
   const nl=Math.hypot(...n)||1,shade=.86+.28*(ny*.5+.5);
   const col=kind===1||kind===2?[.08+.84*(1-(ny*.5+.5)),hash(seed,7,11),0]:[c[0]*shade,c[1]*shade,c[2]*shade];
   vert([uv[0],o.y+cy+ly,uv[1]],[n[0]/nl,n[1]/nl,n[2]/nl],col,wind0+(wind1-wind0)*(ny*.5+.5),kind,seed%97/97);
  }
  for(let i=0;i<rings;i++)for(let j=0;j<seg;j++){const a=base+i*(seg+1)+j,b=a+seg+1;cur.idx.push(a,b,a+1,a+1,b,b+1);}
 }
 function trunk(o,height,radius,c,seed){
  const seg=7;begin((seg+1)*3);const base=cur.count,lean=[(hash(seed,1,5)-.5)*.5,(hash(seed,2,5)-.5)*.5];
  for(let r=0;r<3;r++){const t=r/2,rad=radius*(1-.35*t);
   for(let j=0;j<=seg;j++){const th=j/seg*Math.PI*2,nx=Math.cos(th),nz=Math.sin(th),uv=toUV(o.u,o.v,nx*rad+lean[0]*t*height*.18,nz*rad+lean[1]*t*height*.18);
    vert([uv[0],o.y+t*height,uv[1]],[nx,0,nz],c,t*.35,0,seed%97/97);}}
  for(let r=0;r<2;r++)for(let j=0;j<seg;j++){const a=base+r*(seg+1)+j,b=a+seg+1;cur.idx.push(a,b,a+1,a+1,b,b+1);}
 }
 // A stacked conifer tier with a zig-zag skirt, flat-shaded so every facet is either lit or in shade (the video's
 // low-poly pine). The palette coordinate (colour r) runs from the tier's rim to its lighter tip; undersides are dark.
 function tier(o,cy,radius,height,tone,vary,seed,wind0,wind1){
  const seg=14,rim=[],apex=[0,cy+height,0],under=[0,cy+height*.08,0];
  for(let j=0;j<seg;j++){
   const th=j/seg*Math.PI*2+seed*.21,point=j%2===0,r=radius*(point?1:.74)*(.93+.14*hash(j,seed,23));
   rim.push([Math.cos(th)*r,cy-(point?height*.16:0),Math.sin(th)*r]);
  }
  begin(seg*6);
  const face=(pts,tones,winds,up)=>{
   const [a,b,d]=pts,e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],e2=[d[0]-a[0],d[1]-a[1],d[2]-a[2]];
   let n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];const l=Math.hypot(...n);if(l<1e-9)return;
   n=n.map(x=>x/l);if((n[1]<0)===up)n=n.map(x=>-x);
   pts.forEach((p,i)=>{const uv=toUV(o.u,o.v,p[0],p[2]);cur.idx.push(vert([uv[0],o.y+p[1],uv[1]],n,[tones[i],vary,0],winds[i],8,seed%97/97));});
  };
  for(let j=0;j<seg;j++){const a=rim[j],b=rim[(j+1)%seg];face([a,apex,b],[tone,Math.max(0,tone-.3),tone],[wind0,wind1,wind0],true);face([b,under,a],[1,1,1],[wind0,wind0,wind0],false);}
 }
 // Faceted low-poly rock: every triangle has its own face normal (flat shading).
 function rock(o,size,c,seed){
  const rings=3,seg=6,pts=[];
  for(let i=0;i<=rings;i++)for(let j=0;j<seg;j++){
   const ph=i/rings*Math.PI,th=j/seg*Math.PI*2+seed*.5,k=.72+.4*hash(i,j,seed+31),top=i===0?.55:1;
   pts.push([Math.sin(ph)*Math.cos(th)*size*.62*k,(1-Math.cos(ph))*size*.34*k*top,Math.sin(ph)*Math.sin(th)*size*.52*k]);
  }
  begin(rings*seg*6);
  const at=(i,j)=>pts[i*seg+(j%seg)];
  const tri=(a,b,d)=>{const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],e2=[d[0]-a[0],d[1]-a[1],d[2]-a[2]];let n=[e1[2]*e2[1]-e1[1]*e2[2],e1[0]*e2[2]-e1[2]*e2[0],e1[1]*e2[0]-e1[0]*e2[1]];const l=Math.hypot(...n);if(l<1e-9)return;n=n.map(x=>x/l);
   if(n[1]<-.2)return;const shade=.9+.2*hash(Math.round(a[0]*97),Math.round(d[2]*89),seed);
   for(const p of [a,b,d]){const uv=toUV(o.u,o.v,p[0],p[2]);cur.idx.push(vert([uv[0],o.y+p[1],uv[1]],n,[c[0]*shade,c[1]*shade,c[2]*shade],0,3,seed%97/97));}};
  for(let i=0;i<rings;i++)for(let j=0;j<seg;j++){tri(at(i,j),at(i+1,j),at(i,j+1));tri(at(i,j+1),at(i+1,j),at(i+1,j+1));}
 }
 const leafPalette=[[.27,.58,.24],[.33,.64,.22],[.22,.52,.30],[.38,.62,.20]];
 for(const t of set.trees){
  if(t.kind){
   // Conifer: a short tapered trunk under five stacked zig-zag tiers, dark green at the bottom, yellow-green at the tip.
   const H=t.height*1.15,trunkH=H*.14,foliage=H-trunkH,R=t.radius*1.1,vary=hash(t.seed,3,13);
   trunk(t,trunkH+foliage*.3,.12+t.radius*.05,[.36,.24,.15],t.seed);
   for(let i=0;i<5;i++){const k=i/4;tier(t,trunkH+foliage*.15*i,R*(1-.72*k)+.25,foliage*(.36-.1*k),.92-.62*k,vary,t.seed+i*7,.2+.16*i,.36+.16*i);}
   continue;
  }
  const trunkH=t.height*.5;
  trunk(t,trunkH+.4,.16+t.radius*.07,[.50,.28,.09],t.seed);
  const leaf=leafPalette[t.seed%4],center=[0,trunkH+t.radius*.55,0];
  for(let i=0;i<5;i++){
   const a=i/5*Math.PI*2+t.seed,ring=i===0?0:t.radius*.55,rr=t.radius*(i===0?.95:.72);
   const cy=trunkH+t.radius*(i===0?.75:.35+.25*hash(i,t.seed,17));
   blob(t,Math.cos(a)*ring,cy,Math.sin(a)*ring,rr,rr*.82,rr,leaf,.35,1,1,t.seed,false,center);
  }
 }
 const bushPalette=[[.26,.55,.25],[.31,.60,.24],[.24,.50,.30]];
 const blossom=[[.98,.72,.80],[1,.96,.86],[.99,.86,.38],[.80,.66,.95]];
 for(const b of set.bushes){
  // Three overlapping clumps read as one leafy shrub rather than a single smooth ball.
  const c=bushPalette[b.seed%3],center=[0,b.height*.45,0];
  for(let i=0;i<3;i++){const a=i*2.09+b.seed*.7,off=i?b.radius*.42:0,r=b.radius*(i?.72:.86);
   blob(b,Math.cos(a)*off,b.height*(i?.36:.5),Math.sin(a)*off,r,b.height*(i?.4:.5),r*.92,c,0,.55,2,b.seed+i,false,center);}
  if(b.flowering)for(let i=0;i<5;i++){const a=i*1.26+b.seed,rr=b.radius*.16;blob(b,Math.cos(a)*b.radius*.62,b.height*(.55+.3*hash(i,b.seed,3)),Math.sin(a)*b.radius*.62,rr,rr*.8,rr,blossom[(b.seed+i)%4],.3,.55,4,b.seed,false,null);}
 }
 // Light warm-grey faceted boulders; the cel shader tints their shade green-grey.
 for(const r of set.rocks){const tone=.78+.08*hash(r.seed,4,9);rock(r,r.size,[tone,tone*.99,tone*.9],r.seed);}
 // A box between two points (crop u, metres y, crop v), `w` wide horizontally and `h` thick.
 function beam(A,B,w,h,c,kind,seed){
  const d=[(B[0]-A[0])*MPP,B[1]-A[1],(B[2]-A[2])*MPP],l=Math.hypot(...d)||1,t=d.map(x=>x/l);
  let side=[t[2],0,-t[0]];const sl=Math.hypot(...side);side=sl<1e-6?[1,0,0]:side.map(x=>x/sl);
  const up=[side[1]*t[2]-side[2]*t[1],side[2]*t[0]-side[0]*t[2],side[0]*t[1]-side[1]*t[0]];
  const P=(E,sx,sy)=>[E[0]+(side[0]*sx*w/2+up[0]*sy*h/2)/MPP,E[1]+side[1]*sx*w/2+up[1]*sy*h/2,E[2]+(side[2]*sx*w/2+up[2]*sy*h/2)/MPP];
  const faces=[[up,[[-1,1],[1,1]]],[up.map(x=>-x),[[1,-1],[-1,-1]]],[side,[[1,1],[1,-1]]],[side.map(x=>-x),[[-1,-1],[-1,1]]]];
  begin(24);
  for(const [n,[p,q]] of faces){const b0=cur.count;for(const E of [A,B])for(const [sx,sy] of [p,q])vert(P(E,sx,sy),n,c,0,kind,seed%97/97);cur.idx.push(b0,b0+2,b0+1,b0+1,b0+2,b0+3);}
  for(const [E,n] of [[A,t.map(x=>-x)],[B,t]]){const b0=cur.count;for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]])vert(P(E,sx,sy),n,c,0,kind,seed%97/97);cur.idx.push(b0,b0+1,b0+2,b0,b0+2,b0+3);}
 }
 const post=(u,v,y,h,c,seed)=>beam([u,y,v],[u,y+h,v],.15,.15,c,5,seed);
 const wood=[.66,.45,.10],woodLight=[.74,.53,.16],rope=[.86,.78,.56];
 // Post-and-two-rail fences with rope lashings; every run gets end posts automatically.
 for(const run of set.fences||[]){
  run.forEach((p,i)=>{post(p[0],p[1],p[2],i===0||i===run.length-1?1.18:1.05,wood,i);beam([p[0],p[2]+.78,p[1]],[p[0],p[2]+.86,p[1]],.2,.2,rope,5,i);});
  for(let i=1;i<run.length;i++){const a=run[i-1],b=run[i];for(const y of [.4,.82])beam([a[0],a[2]+y,a[1]],[b[0],b[2]+y,b[1]],.09,.1,woodLight,5,i);}
 }
 // Arched plank bridge: transverse boards with gaps, stringers underneath, posts only at the two ends.
 for(const br of set.bridges||[]){
  const ax=br.axis,px=[-ax[1],ax[0]],deck=t=>br.y0+(br.y1-br.y0)*(t/br.span+.5)+br.arch*Math.sin(Math.PI*(t/br.span+.5)),at=(t,s,y)=>[br.u+(ax[0]*t+px[0]*s)/MPP,y,br.v+(ax[1]*t+px[1]*s)/MPP];
  const n=Math.floor(br.span/.3);
  for(let i=0;i<=n;i++){const t=-br.span/2+i*br.span/n,y=deck(t)-.04;beam(at(t,-br.width/2,y),at(t,br.width/2,y),.23,.07,i%3?wood:woodLight,5,i);}
  for(const s of [-.62,.62])for(let i=1;i<=n;i++){const t0=-br.span/2+(i-1)*br.span/n,t1=t0+br.span/n;beam(at(t0,s,deck(t0)-.14),at(t1,s,deck(t1)-.14),.12,.14,[.5,.32,.08],5,i);}
  for(const t of [-br.span/2,br.span/2])for(const s of [-.95,.95]){const q=at(t,s,0);post(q[0],q[2],deck(t)-.3,1.35,wood,Math.round(t+s));}
 }
 // Pond surfaces: a deeper mint centre fading to a pale rim (radial vertex colours).
 for(const pd of set.ponds||[]){
  const seg=28;begin(seg+1);const c0=vert([pd.u,pd.level,pd.v],[0,1,0],[.36,.80,.80],0,6,0);
  for(let j=0;j<seg;j++){const a=j/seg*Math.PI*2,r=pd.r*(1+.06*Math.sin(a*3+1.3))+.15;vert([pd.u+Math.cos(a)*r/MPP,pd.level,pd.v+Math.sin(a)*r/MPP],[0,1,0],[.74,.94,.86],0,6,96);}
  for(let j=0;j<seg;j++)cur.idx.push(c0,c0+1+j,c0+1+(j+1)%seg);
 }
 // Mossy concrete pillars (broken tops) and a fallen gear wheel.
 for(const ru of set.ruins||[]){
  for(const pl of ru.pillars){
   const d=[Math.cos(pl.yaw)*pl.size/2,Math.sin(pl.yaw)*pl.size/2],e=[-d[1],d[0]];
   beam([pl.u-(d[0])/MPP,pl.y,pl.v-(d[1])/MPP],[pl.u+d[0]/MPP,pl.y,pl.v+d[1]/MPP],pl.size,.01,[.55,.53,.38],7,pl.seed);
   beam([pl.u,pl.y,pl.v],[pl.u+.05*e[0]/MPP,pl.y+pl.h,pl.v+.05*e[1]/MPP],pl.size,pl.size,[.55,.53,.38],7,pl.seed);
   beam([pl.u,pl.y+pl.h-.35,pl.v],[pl.u+.3*e[0]/MPP,pl.y+pl.h+.25,pl.v+.3*e[1]/MPP],pl.size*.55,pl.size*.6,[.52,.50,.36],7,pl.seed+1);
  }
  const g=ru.gear,teeth=14,ax=[Math.cos(g.yaw),Math.sin(g.yaw)];
  for(let i=0;i<teeth;i++){const a=i/teeth*Math.PI*2,b=(i+1)/teeth*Math.PI*2,rim=(t,r)=>[g.u+ax[0]*Math.cos(t)*r/MPP,g.y+g.r+Math.sin(t)*r,g.v+ax[1]*Math.cos(t)*r/MPP];
   beam(rim(a,g.r*.72),rim(b,g.r*.72),.34,.3,[.50,.40,.26],7,i);beam(rim(a+.08,g.r*.78),rim(a+.08,g.r*1.02),.36,.24,[.48,.38,.24],7,i+20);}
  beam([g.u-ax[0]*.1/MPP,g.y+g.r-.2,g.v-ax[1]*.1/MPP],[g.u+ax[0]*.1/MPP,g.y+g.r+.2,g.v+ax[1]*.1/MPP],.4,.5,[.46,.36,.24],7,31);
 }
 return batches.map(b=>({pos:new Float32Array(b.pos),nor:new Float32Array(b.nor),col:new Float32Array(b.col),info:new Float32Array(b.info),idx:new Uint16Array(b.idx),count:b.count}));
}
/* Grass and flower blades for the camera-centred wrapping patch. Each blade is one triangle:
   (patch u, patch v, seed, tip weight) per vertex, plus side -1/+1/0. Heights, lean, colour and
   density come from the seed and the ground texture in the vertex shader. */
function blades(count,patch){
 // Blades come in clumps of three around a shared centre (the video's "cluster thickness").
 const data=new Float32Array(count*3*5),spread=.14/MPP;let o=0;
 for(let i=0;i<count;i++){
  const c=Math.floor(i/3),a=hash(i,4,41)*6.2832,r=hash(i,5,41)*spread;
  const u=((hash(c,1,41)*patch+Math.cos(a)*r)%patch+patch)%patch,v=((hash(c,2,41)*patch+Math.sin(a)*r)%patch+patch)%patch,seed=hash(i,3,41);
  for(const [side,tip] of [[-1,0],[1,0],[0,1]]){data[o++]=u;data[o++]=v;data[o++]=seed;data[o++]=tip;data[o++]=side;}
 }
 return data;
}
// Flowers: a head (two triangles, corners side -1/+1, top 0/1) and a thin stem (tip 2 = root, 3 = head).
function flowers(count,patch){
 const data=new Float32Array(count*9*5);let o=0;
 for(let i=0;i<count;i++){
  const u=hash(i,5,43)*patch,v=hash(i,6,43)*patch,seed=hash(i,7,43);
  for(const [side,top] of [[-1,0],[1,0],[1,1],[-1,0],[1,1],[-1,1],[-1,2],[1,2],[0,3]]){data[o++]=u;data[o++]=v;data[o++]=seed;data[o++]=top;data[o++]=side;}
 }
 return data;
}
// Clears grass and flower cover under rocks, trunks, ruins and ponds so no blade grows through them.
function stampCover(tex,f,stamps){
 for(const st of stamps){
  const rp=st.r/MPP,i0=Math.max(0,Math.floor((st.u-rp-f.x0)/f.step)),i1=Math.min(f.w-1,Math.ceil((st.u+rp-f.x0)/f.step)),j0=Math.max(0,Math.floor((st.v-rp-f.y0)/f.step)),j1=Math.min(f.h-1,Math.ceil((st.v+rp-f.y0)/f.step));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const d=Math.hypot(f.x0+i*f.step-st.u,f.y0+j*f.step-st.v)*MPP;if(d<st.r){const k=(j*f.w+i)*4;tex[k+2]=0;tex[k+3]=0;}}
 }
 return tex;
}
/* RGBA8 ground texture for the grass vertex shader: R/G = height in centimetres (16 bit),
   B = grass cover, A = flower cover. Sampled with NEAREST and interpolated by hand. */
function groundTexture(f,heights){
 const out=new Uint8Array(f.w*f.h*4);
 for(let k=0;k<f.w*f.h;k++){
  const cm=Math.max(0,Math.min(65535,Math.round(heights[k]*100)));
  out[k*4]=cm>>8;out[k*4+1]=cm&255;out[k*4+2]=Math.round(Math.min(1,f.grass[k]+f.weed[k]*.45)*(1-f.path[k]*.95)*255);out[k*4+3]=Math.round(f.flower[k]*255);
 }
 return out;
}
const api={inPoly,hash,noise,fbm,distance,field,shade,features,sample,scatter,meshes,blades,flowers,groundTexture,stampCover,MPP};
if(typeof module==='object')module.exports=api;else root.JTAWalkNature=api;
})(typeof window==='undefined'?this:window);
