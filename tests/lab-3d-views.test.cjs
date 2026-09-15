/* Every room and place the audio guide opens must show what the narration describes: the eye stands in the open,
   the line to the camera's target is clear, and most of the furnishings near the scene's focus are in view with
   nothing solid in front of them. The rules of scripts/lab-3d/viewcheck.py (which placed the cameras), written
   again here so the published data is checked by a second implementation. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const MPP=0.805,ROT=-Math.atan2(0.5517,0.834),YEAR=1962,ASPECT=1.0,MIN_SCORE=0.4,FOCUS_R=7,FOCUS_DY=2.6,EYE_CLEAR=0.25;
const STRUCTURE=['floor','ceiling','slab','wall','corridor','roof','terrace','parapet','gallery','rail','window','frame','veranda','front','door','handle','fence','truss','post','column','stair','jigokudan','rock','bush','trunk','crown','soil','stake','cord','shade','bulb','aerial','tatami','doma','genkan','duckboard','partition','ladder','walkway','line','pole','curtain','awning'];
const lab=JSON.parse(read('3d/gunkanjima-lab.json')),model=JSON.parse(read('3d/gunkanjima-model.json')),scenes=JSON.parse(read('3d/gunkanjima-interiors.json')).scenes;
const g=lab.grid,bin=fs.readFileSync(path.join(root,'3d/gunkanjima-terrain.bin'));
const height=(x,z)=>{const c=Math.min(Math.max(Math.round(x/MPP)-g.x0,0),g.w-1),r=Math.min(Math.max(Math.round(z/MPP)-g.y0,0),g.h-1);return bin.readUInt16LE((r*g.w+c)*2)*g.unit;};
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len=a=>Math.hypot(a[0],a[1],a[2]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],scale=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];

const buildings=[];
for(const b of model.buildings){
 const built=b.built||b.seen||1950;
 if(built>YEAR||(b.gone&&YEAR>b.gone))continue;
 for(const poly of (b.wings||[b.poly])){
  const p=poly.map(q=>[q[0]*MPP,q[1]*MPP]);
  buildings.push({name:b.name,poly:p,base:b.ground-0.6,top:b.ground+b.storeys*b.floorH,
   lo:[Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1]))],hi:[Math.max(...p.map(q=>q[0])),Math.max(...p.map(q=>q[1]))]});
 }
}
/* entry parameter of the segment into a part (a box turned about the vertical axis), Infinity when it misses */
function segPart(b,p0,p1,grow=0){
 const a=(b.r||0)*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),cx=b.u*MPP,cz=b.v*MPP;
 const loc=p=>{const dx=p[0]-cx,dz=p[2]-cz;return [dx*ca+dz*sa,p[1]-b.y,-dx*sa+dz*ca];};
 const q0=loc(p0),q1=loc(p1),lo=[-b.s[0]/2-grow,-grow,-b.s[2]/2-grow],hi=[b.s[0]/2+grow,b.s[1]+grow,b.s[2]/2+grow];
 let t0=0,t1=1;
 for(let i=0;i<3;i++){
  const d=q1[i]-q0[i];
  if(Math.abs(d)<1e-9){if(q0[i]<lo[i]||q0[i]>hi[i])return Infinity;continue;}
  let ta=(lo[i]-q0[i])/d,tb=(hi[i]-q0[i])/d;
  if(ta>tb)[ta,tb]=[tb,ta];
  t0=Math.max(t0,ta);t1=Math.min(t1,tb);
  if(t0>t1)return Infinity;
 }
 return t0;
}
function insidePoly(x,z,poly){
 let inside=false;
 for(let i=0;i<poly.length;i++){const [ax,az]=poly[i],[bx,bz]=poly[(i+1)%poly.length];if((az>z)!==(bz>z)&&x<ax+(z-az)*(bx-ax)/(bz-az))inside=!inside;}
 return inside;
}
function segBuilding(bl,p0,p1){
 if(Math.max(p0[0],p1[0])<bl.lo[0]||Math.min(p0[0],p1[0])>bl.hi[0]||Math.max(p0[2],p1[2])<bl.lo[1]||Math.min(p0[2],p1[2])>bl.hi[1]||Math.max(p0[1],p1[1])<bl.base||Math.min(p0[1],p1[1])>bl.top)return null;
 if(bl.base<=p0[1]&&p0[1]<=bl.top&&insidePoly(p0[0],p0[2],bl.poly))return 0;
 const ts=[],rx=p1[0]-p0[0],rz=p1[2]-p0[2];
 for(let i=0;i<bl.poly.length;i++){
  const [ax,az]=bl.poly[i],[bx,bz]=bl.poly[(i+1)%bl.poly.length],sx=bx-ax,sz=bz-az,den=rx*sz-rz*sx;
  if(Math.abs(den)<1e-12)continue;
  const t=((ax-p0[0])*sz-(az-p0[2])*sx)/den,s=((ax-p0[0])*rz-(az-p0[2])*rx)/den,y=p0[1]+t*(p1[1]-p0[1]);
  if(t>=0&&t<=1&&s>=0&&s<=1&&y>=bl.base&&y<=bl.top)ts.push(t);
 }
 const dy=p1[1]-p0[1];
 if(Math.abs(dy)>1e-9)for(const yc of [bl.base,bl.top]){const t=(yc-p0[1])/dy;if(t>=0&&t<=1&&insidePoly(p0[0]+t*rx,p0[2]+t*rz,bl.poly))ts.push(t);}
 return ts.length?Math.min(...ts):null;
}
function crossesTerrain(p0,p1,end=0.3){
 const L=len(sub(p1,p0)),n=Math.max(3,Math.floor(L/0.35)),lim=1-Math.min(0.5,end/Math.max(L,1e-6));
 let up=false,down=false;
 for(let i=0;i<=n;i++){const t=i/n;if(t>lim)break;const x=p0[0]+t*(p1[0]-p0[0]),y=p0[1]+t*(p1[1]-p0[1]),z=p0[2]+t*(p1[2]-p0[2]);if(y>height(x,z)+0.05)up=true;else down=true;}
 return up&&down;
}
function viewer(sc){
 const boxes=sc.boxes,idx=boxes.map((b,i)=>i);
 const solid=idx.filter(i=>!boxes[i].a&&boxes[i].k!==8&&boxes[i].k!==12);
 const hosts=new Set(sc.ghost||[]),others=buildings.filter(bl=>!hosts.has(bl.name));
 const P=(u,v,y)=>[u*MPP,y,v*MPP],center=i=>P(boxes[i].u,boxes[i].v,boxes[i].y+boxes[i].s[1]/2);
 const f=sc.focus||sc.camera,F=P(f.u,f.v,f.y);
 const content=idx.filter(i=>!STRUCTURE.some(w=>(boxes[i].t||'').includes(w))&&Math.max(...boxes[i].s)<=3.5);
 const near=content.filter(i=>{const c=center(i);return Math.hypot(c[0]-F[0],c[2]-F[2])<=FOCUS_R&&Math.abs(c[1]-F[1])<=FOCUS_DY;});
 const focus=near.length>=4?near:content,weight=i=>Math.min(2,Math.max(0.02,boxes[i].s[0]*boxes[i].s[1]*boxes[i].s[2]));
 const blockers=(p0,p1,skip=-1,end=0.97)=>{
  const hit=[];
  for(const i of solid)if(i!==skip&&segPart(boxes[i],p0,p1)<end)hit.push(boxes[i].t||'part');
  for(const bl of others){const t=segBuilding(bl,p0,p1);if(t!==null&&t<end)hit.push(bl.name);}
  if(crossesTerrain(p0,p1))hit.push('terrain');
  return hit;
 };
 return cam=>{
  const ce=Math.cos(cam.el),dx=cam.dist*ce*Math.sin(cam.az),dz=cam.dist*ce*Math.cos(cam.az),c=Math.cos(ROT),s=Math.sin(ROT);
  const T=P(cam.u,cam.v,cam.y),e=[T[0]+dx*c+dz*s,T[1]+cam.dist*Math.sin(cam.el),T[2]-dx*s+dz*c];
  const fwd=scale(sub(T,e),1/len(sub(T,e)));
  let r=cross(fwd,[0,1,0]);r=len(r)>1e-6?scale(r,1/len(r)):[1,0,0];
  const up=cross(r,fwd),ty=Math.tan((cam.fov||0.9)/2);
  /* each translucent part in front (assumed walls and doors, paper screens, glass, water) halves what it lets through */
  const glassy=idx.filter(i=>boxes[i].a||boxes[i].k===8||boxes[i].k===12);
  let seen=0,total=0;
  for(const i of focus){
   const w=weight(i),d=sub(center(i),e),z=dot(d,fwd);
   total+=w;
   if(z<0.3||Math.abs(dot(d,r))/z>ty*ASPECT||Math.abs(dot(d,up))/z>ty)continue;
   if(blockers(e,center(i),i).length)continue;
   let layers=0;
   for(const j of glassy)if(j!==i&&segPart(boxes[j],e,center(i))<0.97)layers++;
   seen+=w*Math.pow(0.5,layers);
  }
  const inside=solid.filter(i=>segPart(boxes[i],e,e,EYE_CLEAR)<Infinity).map(i=>boxes[i].t||'part')
   .concat(others.filter(bl=>bl.base<=e[1]&&e[1]<=bl.top&&insidePoly(e[0],e[2],bl.poly)).map(bl=>bl.name));
  return {eyeInside:inside,blocked:[...new Set(blockers(e,T))],score:seen/Math.max(total,1e-9),focus:focus.length};
 };
}

test('every room and place the audio guide flies to shows its room',()=>{
 assert.ok(Object.keys(scenes).length>=12);
 for(const [id,sc] of Object.entries(scenes)){
  const look=viewer(sc),a=look(sc.camera);
  assert.deepEqual(a.eyeInside,[],id+': the eye stands inside '+a.eyeInside.join(', '));
  assert.deepEqual(a.blocked,[],id+': the line to the target is blocked by '+a.blocked.join(', '));
  assert.ok(a.score>=MIN_SCORE,id+': only '+Math.round(a.score*100)+'% of the furnishings near the focus are in view ('+a.focus+' parts)');
  if(sc.approach){
   const b=look(sc.approach);
   assert.deepEqual(b.eyeInside,[],id+': the approach eye stands inside '+b.eyeInside.join(', '));
   assert.deepEqual(b.blocked,[],id+': the approach line is blocked by '+b.blocked.join(', '));
  }
 }
});

test('the check fails the cameras that hid their rooms before (walls, not only ceilings)',()=>{
 const before={
  nikkyu:{u:591.1,v:438.8,y:15.85,dist:8.1,el:0.378,az:-2.644,fov:0.95},
  bath:{u:638,v:392.1,y:4.75,dist:7.3,el:0.221,az:0.322,fov:1},
  no3:{u:539.5,v:522.6,y:33.75,dist:5.71,el:0.114,az:0.06,fov:1},
  school:{u:714.5,v:487.1,y:12.6,dist:11.2,el:0.29,az:0.571,fov:0.95}
 };
 for(const [id,cam] of Object.entries(before)){
  const a=viewer(scenes[id])(cam);
  assert.ok(a.eyeInside.length||a.blocked.length||a.score<MIN_SCORE,id+': the old camera must fail ('+JSON.stringify(a)+')');
 }
});
