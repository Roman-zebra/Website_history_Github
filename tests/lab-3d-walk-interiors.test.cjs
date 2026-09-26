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
 assert.ok(interior.complete(scenes.shrine,'shrine').walkStairsAdjusted,'open shrine precinct keeps its walk-only stair adjustment');
 assert.ok(!interior.complete(scenes.roofgarden,'roofgarden').walkEnclosed,'roof garden stays open');
});

test('the source-labelled Jigokudan study is climbable in both directions without altering source data',()=>{
 const original=scenes.shrine,sc=interior.complete(original,'shrine');
 assert.notEqual(sc,original);assert.ok(!original.walkStairsAdjusted,'source scene remains unchanged');
 assert.equal(interior.complete(sc,'shrine'),sc,'walking adjustment is idempotent');
 assert.ok(sc.text.ja.includes('実測復元ではありません'));
 const source=original.boxes.filter(b=>b.t==='jigokudan'),steps=sc.boxes.filter(b=>b.t==='jigokudan');
 assert.equal(steps.length,46);assert.deepEqual(steps.map(b=>[b.u,b.v,b.s]),source.map(b=>[b.u,b.v,b.s]),'positions, count and dimensions stay source-authored');
 const tops=steps.map(b=>b.y+b.s[1]);
 for(let i=1;i<tops.length;i++){assert.ok(tops[i]<tops[i-1]);assert.ok(tops[i-1]-tops[i]<.4,'each walking rise fits the collision step limit');}
 function traverse(route,current){for(const b of route){const y=nav.ground(sc,b.u,b.v,.805,current);assert.notEqual(y,null,'each Jigokudan tread is supported');assert.ok(Math.abs(y-current)<.4);current=y;}return current;}
 let y=traverse(steps,tops[0]);assert.ok(Math.abs(y-tops.at(-1))<.001,'descends to the bottom');
 y=traverse(steps.slice().reverse(),y);assert.ok(Math.abs(y-tops[0])<.001,'climbs back to the shrine terrace');
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

test('hospital walking copy shows documented steel sashes and tatami-topped beds without changing source geometry',()=>{
 const original=scenes.hospital,sc=interior.complete(original,'hospital');
 assert.ok(original.boxes.filter(b=>b.t==='window-frame').every(b=>b.k===2),'source material labels remain untouched');
 assert.ok(sc.boxes.filter(b=>b.t==='window-frame').every(b=>b.k===6),'walking copy uses steel sash material');
 const beds=original.boxes.filter(b=>b.t==='tatami-bed'),edges=sc.boxes.filter(b=>b.t==='walk-hospital-tatami-edge'),weave=sc.boxes.filter(b=>b.t==='walk-hospital-tatami-weave');
 assert.equal(beds.length,6);assert.equal(edges.length,beds.length*4);assert.equal(weave.length,beds.length*16);
 for(const prop of [...edges,...weave]){
  const a=prop.r*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const corners=[-1,1].flatMap(i=>[-1,1].map(j=>[prop.u+(i*prop.s[0]*c-j*prop.s[2]*s)/2/.805,prop.v+(i*prop.s[0]*s+j*prop.s[2]*c)/2/.805]));
  assert.ok(beds.some(b=>corners.every(q=>nav.inside(b,...q,.805,.001))),'tatami detail stays on an existing bed');
  assert.equal(prop.a,1,'new finish detail is labelled inferred');
 }
 assert.ok(sc.text.ja.includes('畳縁・畳目')&&sc.text.ja.includes('推定'));
});

test('communal bath tile cues stay on the existing floor and tub caps without changing source geometry',()=>{
 const original=scenes.bath,source=JSON.stringify(original),sc=interior.complete(original,'bath'),p=sc.walkEnvelope;
 assert.equal(JSON.stringify(original),source,'source bath remains untouched');
 const floorLines=sc.boxes.filter(b=>b.t==='walk-bath-floor-grout-line'),tubLines=sc.boxes.filter(b=>b.t==='walk-bath-tub-grout-line'),tubs=original.boxes.filter(b=>b.t==='tub');
 assert.ok(floorLines.length>=20,'floor receives a readable bounded grid');
 assert.ok(tubLines.length>=50,'four existing tub walls receive cap joints');
 for(const line of floorLines){
  const a=(line.r||0)*Math.PI/180-p.angle,c=Math.cos(a),s=Math.sin(a),q=[(line.u-p.u)*.805*Math.cos(p.angle)+(line.v-p.v)*.805*Math.sin(p.angle),-(line.u-p.u)*.805*Math.sin(p.angle)+(line.v-p.v)*.805*Math.cos(p.angle)];
  const hx=(Math.abs(c)*line.s[0]+Math.abs(s)*line.s[2])/2,hz=(Math.abs(s)*line.s[0]+Math.abs(c)*line.s[2])/2;
  assert.ok(q[0]-hx>=p.x0-.001&&q[0]+hx<=p.x1+.001&&q[1]-hz>=p.z0-.001&&q[1]+hz<=p.z1+.001,'floor joint stays inside existing floor');
  assert.equal(line.a,1);
 }
 for(const line of tubLines){
  const corners=[-1,1].flatMap(i=>[-1,1].map(j=>{const a=line.r*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return[line.u+(i*line.s[0]*c-j*line.s[2]*s)/2/.805,line.v+(i*line.s[0]*s+j*line.s[2]*c)/2/.805];}));
  assert.ok(tubs.some(b=>corners.every(q=>nav.inside(b,...q,.805,.02))),'tub joint stays on an existing tub cap');
  assert.equal(line.a,1);
 }
 assert.ok(sc.text.ja.includes('タイル浴槽')&&sc.text.ja.includes('推定'));
});

test('Building 3 telephone detail stays inside the existing inferred phone and faces the walking entry',()=>{
 const original=scenes.no3,source=JSON.stringify(original),sc=interior.complete(original,'no3'),phone=original.boxes.find(b=>b.t==='telephone');
 assert.equal(JSON.stringify(original),source,'source room and furniture remain untouched');
 const detail=sc.boxes.filter(b=>/^walk-no3-phone-/.test(b.t));
 assert.equal(detail.filter(b=>b.t==='walk-no3-phone-handset').length,1);
 assert.equal(detail.filter(b=>b.t==='walk-no3-phone-earpiece').length,2);
 assert.equal(detail.filter(b=>b.t==='walk-no3-phone-dial').length,10);
 for(const part of detail){
  const a=part.r*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const corners=[-1,1].flatMap(i=>[-1,1].map(j=>[part.u+(i*part.s[0]*c-j*part.s[2]*s)/2/.805,part.v+(i*part.s[0]*s+j*part.s[2]*c)/2/.805]));
  assert.ok(corners.every(q=>nav.inside(phone,...q,.805,.002)),'telephone cue stays within the existing body footprint');
  assert.equal(part.a,1,'telephone cue is labelled inferred');
 }
 const spawn=nav.spawn({...sc,camera:sc.walkEntry},.805);assert.ok(spawn,'curated telephone view starts on supported floor');
 assert.ok(Math.hypot(spawn.u-sc.walkEntry.u,spawn.v-sc.walkEntry.v)<.001,'telephone entry needs no fallback displacement');
 const view=[sc.walkEntry.target[0]-sc.walkEntry.u,sc.walkEntry.target[1]-sc.walkEntry.v],toPhone=[phone.u-sc.walkEntry.u,phone.v-sc.walkEntry.v];
 assert.ok((view[0]*toPhone[0]+view[1]*toPhone[1])/Math.hypot(...view)/Math.hypot(...toPhone)>.999,'entry looks directly at the documented telephone');
 assert.ok(sc.text.ja.includes('各戸の電話は記録')&&sc.text.ja.includes('形と色')&&sc.text.ja.includes('推定'));
 assert.ok(sc.text.en.includes('Records confirm a telephone')&&sc.text.en.includes('inferred'));
});

test('Building 30 walking copy starts in the depicted third-floor dwelling facing the documented kamado and water jar',()=>{
 const original=scenes.no30,source=JSON.stringify(original),sc=interior.complete(original,'no30'),p=sc.walkEnvelope;
 assert.equal(JSON.stringify(original),source,'source multi-storey gallery scene remains untouched');
 assert.ok(original.floor<p.base-5,'source navigation floor belongs to a lower gallery');
 assert.equal(sc.floor,p.base,'walking copy selects the depicted dwelling floor');
 const spawn=nav.spawn({...sc,camera:sc.walkEntry},.805);assert.ok(spawn,'third-floor entry has support');
 assert.ok(Math.hypot(spawn.u-sc.walkEntry.u,spawn.v-sc.walkEntry.v)<.001,'third-floor entry needs no fallback displacement');
 assert.ok(spawn.y>p.base&&spawn.y<p.base+.1,'entry stands on the depicted room surface, not a lower gallery');
 const view=[sc.walkEntry.target[0]-sc.walkEntry.u,sc.walkEntry.target[1]-sc.walkEntry.v],vl=Math.hypot(...view);
 for(const type of ['kamado','water-jar']){
  const b=original.boxes.find(x=>x.t===type),to=[b.u-sc.walkEntry.u,b.v-sc.walkEntry.v],tl=Math.hypot(...to);
  assert.ok((view[0]*to[0]+view[1]*to[1])/vl/tl>Math.cos(12*Math.PI/180),type+' is inside the opening view cone');
 }
 assert.ok(sc.text.ja.includes('3階住戸')&&sc.text.ja.includes('竈と水がめ')&&sc.text.ja.includes('歴史的な視線位置'));
 assert.ok(sc.text.en.includes('third-floor dwelling')&&sc.text.en.includes('not a historical camera position'));
});

test('Building 16 walking copy presents the documented fresh-water and seawater taps with bounded inferred fittings',()=>{
 const original=scenes.nikkyu,source=JSON.stringify(original),sc=interior.complete(original,'nikkyu'),taps=original.boxes.filter(b=>b.t==='two-taps');
 assert.equal(JSON.stringify(original),source,'source daily-wage housing scene remains untouched');
 assert.equal(taps.length,2,'source retains the documented pair of tap stems');
 const handles=sc.boxes.filter(b=>b.t==='walk-nikkyu-tap-handle'),spouts=sc.boxes.filter(b=>b.t==='walk-nikkyu-tap-spout'),parts=[...handles,...spouts];
 assert.equal(handles.length,2);assert.equal(spouts.length,2);
 for(const part of parts){
  const nearest=Math.min(...taps.map(t=>Math.hypot(part.u-t.u,part.v-t.v)*.805));
  assert.ok(nearest<.22,'added fitting stays immediately beside an existing tap stem');
  assert.equal(part.a,1,'added fitting is labelled inferred');
 }
 const spawn=nav.spawn({...sc,camera:sc.walkEntry},.805);assert.ok(spawn,'dual-tap entry has floor support');
 assert.ok(Math.hypot(spawn.u-sc.walkEntry.u,spawn.v-sc.walkEntry.v)<.001,'dual-tap entry needs no fallback displacement');
 const view=[sc.walkEntry.target[0]-sc.walkEntry.u,sc.walkEntry.target[1]-sc.walkEntry.v],vl=Math.hypot(...view);
 for(const tap of taps){const to=[tap.u-sc.walkEntry.u,tap.v-sc.walkEntry.v],tl=Math.hypot(...to);assert.ok((view[0]*to[0]+view[1]*to[1])/vl/tl>Math.cos(8*Math.PI/180),'both taps remain in the opening view cone');}
 assert.ok(sc.text.ja.includes('真水・海水の二連蛇口')&&sc.text.ja.includes('形と色')&&sc.text.ja.includes('推定'));
 assert.ok(sc.text.en.includes('fresh-water and seawater taps')&&sc.text.en.includes('inferred'));
});

test('Hashima Ginza walking copy opens along the documented column and shop rows without changing source geometry',()=>{
 const original=scenes.ginza,source=JSON.stringify(original),sc=interior.complete(original,'ginza');
 assert.equal(JSON.stringify(original),source,'source arcade scene remains untouched');
 assert.notEqual(sc,original);assert.deepEqual(sc.boxes,original.boxes,'walking copy adds no shop or product geometry');
 const stalls=original.boxes.filter(b=>b.t==='stall'),columns=original.boxes.filter(b=>b.t==='column');
 assert.equal(stalls.length,5);assert.equal(columns.length,5);
 const spawn=nav.spawn({...sc,camera:sc.walkEntry},.805);assert.ok(spawn,'arcade entry has floor support');
 assert.ok(Math.hypot(spawn.u-sc.walkEntry.u,spawn.v-sc.walkEntry.v)<.001,'arcade entry needs no fallback displacement');
 const view=[sc.walkEntry.target[0]-sc.walkEntry.u,sc.walkEntry.target[1]-sc.walkEntry.v],vl=Math.hypot(...view);
 const inCone=(b,degrees)=>{const to=[b.u-sc.walkEntry.u,b.v-sc.walkEntry.v],tl=Math.hypot(...to);return(view[0]*to[0]+view[1]*to[1])/vl/tl>Math.cos(degrees*Math.PI/180);};
 assert.ok(stalls.every(b=>inCone(b,27)),'all five existing stalls are inside the opening field of view');
 assert.equal(columns.filter(b=>inCone(b,25)).length,4,'the forward column sequence remains legible');
 for(const lang of ['ja','en','ko','zh-Hans','zh-Hant'])assert.ok(sc.text[lang].length>original.text[lang].length,lang+' receives the viewpoint caveat');
 assert.ok(sc.text.ja.includes('歴史的な視点位置')&&sc.text.en.includes('not a historical camera position'));
});

test('rooftop farm walking copy presents all existing crop beds and the rice plot without changing source geometry',()=>{
 const original=scenes.roofgarden,source=JSON.stringify(original),sc=interior.complete(original,'roofgarden');
 assert.equal(JSON.stringify(original),source,'source rooftop-farm scene remains untouched');
 assert.notEqual(sc,original);assert.deepEqual(sc.boxes,original.boxes,'walking copy adds no crop or roof geometry');
 const beds=original.boxes.filter(b=>b.t==='bed-frame'),rice=original.boxes.filter(b=>b.t==='rice-plot');
 assert.equal(beds.length,4);assert.equal(rice.length,1);
 const spawn=nav.spawn({...sc,camera:sc.walkEntry},.805);assert.ok(spawn,'rooftop-farm entry has floor support');
 assert.ok(Math.hypot(spawn.u-sc.walkEntry.u,spawn.v-sc.walkEntry.v)<.001,'rooftop-farm entry needs no fallback displacement');
 const view=[sc.walkEntry.target[0]-sc.walkEntry.u,sc.walkEntry.target[1]-sc.walkEntry.v],vl=Math.hypot(...view);
 for(const b of [...beds,...rice]){const to=[b.u-sc.walkEntry.u,b.v-sc.walkEntry.v],tl=Math.hypot(...to);assert.ok((view[0]*to[0]+view[1]*to[1])/vl/tl>Math.cos(25*Math.PI/180),'every crop bed and rice plot stays inside the opening view cone');}
 assert.ok(sc.walkEntry.el<-.2&&sc.walkEntry.el>-.35,'opening pitch favours the crop beds without hiding the horizon');
 for(const lang of ['ja','en','ko','zh-Hans','zh-Hant'])assert.ok(sc.text[lang].length>original.text[lang].length,lang+' receives the evidence caveat');
 assert.ok(sc.text.ja.includes('菜園の存在は記録')&&sc.text.ja.includes('開始視点は推定'));
 assert.ok(sc.text.en.includes('rooftop farm is documented')&&sc.text.en.includes('starting viewpoint are inferred'));
});

test('rooftop nursery walking entry presents the existing activity tables from a clear aisle',()=>{
 const original=scenes.no65roof,sourceCamera=JSON.stringify(original.camera),sc=interior.complete(original,'no65roof'),p=sc.walkEnvelope,c=Math.cos(p.angle),s=Math.sin(p.angle);
 const local=(u,v)=>[(u-p.u)*.805*c+(v-p.v)*.805*s,-(u-p.u)*.805*s+(v-p.v)*.805*c];
 assert.equal(JSON.stringify(original.camera),sourceCamera,'source orbit camera stays untouched');
 assert.ok(sc.walkEntry&&sc.walkEntry.target,'walking copy has a curated first-person entry');
 const spawn=nav.spawn({...sc,camera:sc.walkEntry},.805);assert.ok(spawn,'entry is supported and obstacle-free');
 assert.ok(Math.hypot(spawn.u-sc.walkEntry.u,spawn.v-sc.walkEntry.v)<.001,'entry does not need fallback displacement');
 const pos=local(sc.walkEntry.u,sc.walkEntry.v),target=local(...sc.walkEntry.target),dir=[target[0]-pos[0],target[1]-pos[1]],dl=Math.hypot(...dir);
 const tables=original.boxes.filter(b=>b.t==='low-table'),chairs=original.boxes.filter(b=>b.t==='small-chair');assert.equal(tables.length,6);assert.equal(chairs.length,216);
 for(const table of tables){const q=local(table.u,table.v),v=[q[0]-pos[0],q[1]-pos[1]],vl=Math.hypot(...v),cos=(dir[0]*v[0]+dir[1]*v[1])/dl/vl;assert.ok(cos>Math.cos(25*Math.PI/180),'every existing activity table is inside the opening view cone');}
});
