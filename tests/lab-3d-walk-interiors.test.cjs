const test=require('node:test'),assert=require('node:assert/strict');
const scenes=require('../3d/gunkanjima-interiors.json').scenes;
const interior=require('../3d/gunkanjima-walk-interiors.js'),nav=require('../3d/gunkanjima-walk-nav.js');
test('walking cutaways have complete opaque wall coverage outside framed openings',()=>{
 for(const id of Object.keys(interior.profiles)){
  const original=scenes[id],sc=interior.complete(original,id),p=sc.walkEnvelope;
  assert.ok(p,id+' enclosure exists');assert.notEqual(sc,original);assert.ok(!original.walkEnclosed,'source cutaway is preserved');
  assert.equal(interior.complete(sc,id),sc,'completion is idempotent');
  const walls=sc.boxes.filter(b=>b.t==='walk-enclosure-wall'),c=Math.cos(p.angle),s=Math.sin(p.angle);
  const uv=(x,z)=>[p.u+(x*c-z*s)/.805,p.v+(x*s+z*c)/.805];
  for(const [axis,at,lo,hi]of [[0,p.z0,p.x0,p.x1],[0,p.z1,p.x0,p.x1],[1,p.x0,p.z0,p.z1],[1,p.x1,p.z0,p.z1]]){
   for(let along=lo+.2;along<hi-.2;along+=.37)for(let h=.3;h<p.height-.1;h+=.31){
    if(p.windows.some(w=>w.side===axis&&Math.abs(w.at-at)<.01&&along>w.lo&&along<w.hi&&h>w.bottom&&h<w.top))continue;
    if(interior.profiles[id].door&&axis===0&&at===p.z1&&Math.abs(along-(lo+hi)/2)<.65&&h<Math.min(2.2,p.height-.2))continue;
    const q=axis===0?uv(along,at):uv(at,along);
    assert.ok(walls.some(b=>b.k!==8&&b.y<=p.base+h&&b.y+b.s[1]>=p.base+h&&nav.inside(b,...q,.805,.015)),id+' uncovered wall');
   }
  }
  assert.ok(sc.boxes.some(b=>b.t==='walk-ceiling'&&b.k!==8));
  assert.ok(sc.walkLights.length>0);assert.ok(sc.text.ja.includes('推定'));
 }
 assert.equal(interior.complete(scenes.shrine,'shrine'),scenes.shrine,'open shrine precinct stays outdoors');
 assert.equal(interior.complete(scenes.roofgarden,'roofgarden'),scenes.roofgarden,'roof garden stays open');
});

test('school props stay on desks and the rear-to-front aisle remains walkable',()=>{
 const original=scenes.school,sc=interior.complete(original,'school'),p=sc.walkEnvelope,c=Math.cos(p.angle),s=Math.sin(p.angle);
 const uv=(x,z)=>[p.u+(x*c-z*s)/.805,p.v+(x*s+z*c)/.805];
 assert.ok(!original.walkEntry,'source camera metadata is not overwritten');
 assert.ok(sc.walkEntry&&sc.text.ja.includes('推定'));
 const spawn=nav.spawn({...sc,camera:sc.walkEntry},.805);
 assert.ok(Math.hypot(spawn.u-sc.walkEntry.u,spawn.v-sc.walkEntry.v)<.001,'spawn remains at selected clear aisle');
 const desks=original.boxes.filter(b=>b.t==='desk');
 const props=sc.boxes.filter(b=>/^walk-school-(notebook|pages|pencil)$/.test(b.t));assert.ok(props.length>30);
 for(const prop of props){
  const a=prop.r*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);
  const corners=[-1,1].flatMap(i=>[-1,1].map(j=>[prop.u+(i*prop.s[0]*ca-j*prop.s[2]*sa)/2/.805,prop.v+(i*prop.s[0]*sa+j*prop.s[2]*ca)/2/.805]));
  assert.ok(desks.some(d=>corners.every(q=>nav.inside(d,...q,.805,0))),'small objects stay within a supporting desktop');
  assert.equal(prop.a,1,'prop is marked inferred');
 }
 const route=[[5.8,3.5],[5.8,-4.5],[-6,-4.5],[-6,1]];let y=p.base;
 for(let j=1;j<route.length;j++){
  const a=route[j-1],b=route[j],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.10);
  for(let i=0;i<=n;i++){const t=i/n,q=uv(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t),h=nav.ground(sc,...q,.805,y);assert.notEqual(h,null,'school aisle is traversable');y=h;}
 }
});
