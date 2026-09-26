/* Walking round Gunkanjima and the weather over it: the sun stands where it stood over Hashima on the day of the
   photograph, the walk starts on free ground inside the sea wall, a body cannot pass through a wall, every room can
   be stood in, the model view keeps the lighting it always had, and the controls speak the page's language. The
   viewer's own functions are taken from 3d/gunkanjima-3d.js and run here. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const js=read('3d/gunkanjima-3d.js').split('\r\n').join('\n');
const lab=JSON.parse(read('3d/gunkanjima-lab.json')),model=JSON.parse(read('3d/gunkanjima-model.json')),scenes=JSON.parse(read('3d/gunkanjima-interiors.json')).scenes;
const MPP=lab.frame.metersPerPixel,ROT=-Math.atan2(lab.north[0],-lab.north[1]);
const slice=(from,to)=>{const a=js.indexOf(from),b=js.indexOf(to,a+1);assert.ok(a>0&&b>a,'the viewer has '+from.trim());return js.slice(a,b);};
const deg=v=>Math.asin(v[1])*180/Math.PI;

function sunAt(ms){
 const consts=/const LAT = [^\n]+\n/.exec(js)[0];
 return vm.runInNewContext(consts+slice('  function sunAt(ms){','\n  function photoDay(')+'\nsunAt('+ms+')',{Math});
}
const jst=(y,m,d,h,min=0)=>Date.UTC(y,m-1,d,h-9,min);

test('the sun stands where it stood over Hashima',()=>{
 const unit=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);};
 const SUN=unit(/const SUN = \(\(\) => \{ const v = \[([^\]]+)\]/.exec(js)[1].split(',').map(Number));
 const ten=sunAt(jst(1962,5,30,10));
 const angle=Math.acos(Math.min(1,ten[0]*SUN[0]+ten[1]*SUN[1]+ten[2]*SUN[2]))*180/Math.PI;
 assert.ok(angle<4,'10 a.m. on 30 May 1962 is the sun the model view was lit by (off by '+angle.toFixed(1)+' degrees)');
 assert.ok(deg(sunAt(jst(1962,5,30,4,30)))<0&&deg(sunAt(jst(1962,5,30,6)))>0,'sunrise between 4:30 and 6:00');
 assert.ok(deg(sunAt(jst(1962,5,30,19)))>0&&deg(sunAt(jst(1962,5,30,19,50)))<0,'sunset between 19:00 and 19:50');
 const noon=sunAt(jst(1975,1,2,12,20));
 assert.ok(deg(noon)>30&&deg(noon)<38,'a January noon is low: '+deg(noon).toFixed(1));
 assert.ok(noon[2]>0.75&&Math.abs(noon[0])<0.25,'and in the south (+z is south, +x east)');
 const morning=sunAt(jst(2010,5,3,7));
 assert.ok(morning[0]>0.6,'the morning sun is in the east');
});

/* the terrain as the tests of the views read it */
const g=lab.grid,bin=fs.readFileSync(path.join(root,'3d/gunkanjima-terrain.bin'));
const height=(u,v)=>{const c=Math.min(Math.max(Math.round(u)-g.x0,0),g.w-1),r=Math.min(Math.max(Math.round(v)-g.y0,0),g.h-1);return bin.readUInt16LE((r*g.w+c)*2)*g.unit;};
function inside(x,y,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]))c=!c;}return c;}
function edgeDistance(x,y,poly){let best=Infinity;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i],ex=b[0]-a[0],ey=b[1]-a[1],l2=ex*ex+ey*ey,t=l2?Math.min(1,Math.max(0,((x-a[0])*ex+(y-a[1])*ey)/l2)):0;best=Math.min(best,Math.hypot(x-a[0]-t*ex,y-a[1]-t*ey));}return best;}

test('the walk starts on free ground inside the sea wall, by the pier where the boats land',()=>{
 const [u,v]=JSON.parse('['+/const LANDING = \[([^\]]+)\]/.exec(js)[1]+']');
 const ring=model.seawall.map(p=>[p.u,p.v]);
 assert.ok(inside(u,v,ring),'inside the sea wall');
 assert.ok(edgeDistance(u,v,ring)*MPP>=2.5,'clear of the wall');
 assert.ok(height(u,v)>1,'on land, not at sea level');
 for(const b of model.buildings){
  const built=b.built||b.seen||1950;
  if(built>1962||(b.gone&&b.gone<1962))continue;
  for(const p of b.wings||[b.poly]){assert.ok(!inside(u,v,p),'not inside '+(b.name||'a building'));assert.ok(edgeDistance(u,v,p)*MPP>=1.5,'clear of '+(b.name||'a building'));}
 }
 const pier=lab.spots.pier;
 assert.ok(Math.hypot(u-pier.u,v-pier.v)*MPP<40,'near the Dolphin pier');
});

test('a body cannot pass through a wall, a piece of furniture or the sea wall',()=>{
 const P=vm.runInNewContext(slice('  function inPoly(','  function sceneNow(')+'\n({ inPoly, nearestOn, pushOut, pushBox })',
  {Math,RADIUS:0.3,mpp:MPP,RAD:Math.PI/180,clamp:(v,a,b)=>Math.min(b,Math.max(a,v))});
 const square=[[0,0],[10,0],[10,10],[0,10]];
 let pos=[9.8,5];
 assert.ok(P.pushOut(pos,square,false));
 assert.ok(!P.inPoly(pos[0],pos[1],square)&&Math.abs(pos[0]-10.3)<1e-9&&pos[1]===5,'out through the nearest wall, a body radius clear: '+pos);
 pos=[10.1,5];
 assert.ok(P.pushOut(pos,square,false)&&Math.abs(pos[0]-10.3)<1e-9,'kept a body radius from the wall outside it');
 pos=[12,5];
 assert.ok(!P.pushOut(pos,square,false),'free ground stays free');
 pos=[11,5];
 assert.ok(P.pushOut(pos,square,true)&&P.inPoly(pos[0],pos[1],square)&&Math.abs(pos[0]-9.7)<1e-9,'the sea wall keeps the body on the island: '+pos);
 /* a table turned 30 degrees in the crop frame, 2 m by 1 m, centred at (100, 100) px */
 const table={u:100,v:100,y:0,s:[2,0.7,1],r:30};
 const c=[100*MPP,100*MPP];
 pos=[c[0]+0.1,c[1]];
 assert.ok(P.pushBox(pos,table),'pushed off the table');
 const a=30*Math.PI/180,dx=pos[0]-c[0],dz=pos[1]-c[1],lx=dx*Math.cos(a)+dz*Math.sin(a),lz=-dx*Math.sin(a)+dz*Math.cos(a);
 assert.ok(Math.abs(lx)>1-1e-9||Math.abs(lz)>0.5+0.3-1e-9,'outside the turned table: '+[lx,lz]);
});

test('every room can be stood in: the walker lands on a floor of the room, not on the ground under it',()=>{
 const PASS=new RegExp(/const PASS = \/(.+)\/;/.exec(js)[1]);
 const cr=Math.cos(ROT),sr=Math.sin(ROT);
 /* the highest surface of the room at a point, no higher than a height; the ground if there is none */
 function floorAt(sc,u,v,below){
  const ground=height(u,v);
  let best=ground>below?-Infinity:ground;   /* a room under the ground stands on its own floors */
  for(const b of sc.boxes){
   const top=b.y+b.s[1];
   if(top<=best||top>below||PASS.test(b.t||''))continue;
   const a=(b.r||0)*Math.PI/180,du=(u-b.u)*MPP,dv=(v-b.v)*MPP;
   if(Math.abs(du*Math.cos(a)+dv*Math.sin(a))<=b.s[0]/2&&Math.abs(-du*Math.sin(a)+dv*Math.cos(a))<=b.s[2]/2)best=top;
  }
  return best===-Infinity?ground:best;
 }
 assert.ok(Object.keys(scenes).length>=12);
 for(const [id,sc] of Object.entries(scenes)){
  const cam=sc.flatCamera||sc.camera,ce=Math.cos(cam.el),dx=cam.dist*ce*Math.sin(cam.az),dz=cam.dist*ce*Math.cos(cam.az);
  const eu=cam.u+(dx*cr+dz*sr)/MPP,ev=cam.v+(-dx*sr+dz*cr)/MPP,ey=cam.y+cam.dist*Math.sin(cam.el);
  const drop=ey-floorAt(sc,eu,ev,ey-0.3),eyeStands=cam.el<0.5&&drop>0.9&&drop<2.4;
  const feet=eyeStands?floorAt(sc,eu,ev,ey-0.3):floorAt(sc,cam.u,cam.v,cam.y);
  const look=eyeStands?ey:cam.y;
  assert.ok(look-feet<2.4&&look-feet>-0.01,id+': the walker stands '+(look-feet).toFixed(2)+' m under the view it replaces');
  assert.ok(feet>=sc.floor-0.35,id+': on the room\'s floors ('+feet.toFixed(2)+' m), not below its lowest floor at '+sc.floor+' m');
 }
});

test('the model view keeps its lighting; the page offers walking, weather and the hour in five languages',()=>{
 for(const need of ["env: [1, 1, 0, 0]","fogR: [500, 2400]","tint: [1, 1, 1]","if (uStage > 0.5){ float k = smoothstep(-0.2, 1.0, vP.y + uEl * 0.6);","const envState = { weather: 'stage', hour: 10 };"])
  assert.ok(js.includes(need),'the model view: '+need);
 const tpl=read('scripts/lab-3d/gunkanjima.template.html');
 const TEXT=vm.runInNewContext('('+/var TEXT = (\{[\s\S]*?\n  \});/.exec(tpl)[1]+')');
 const KANA=/[぀-ヿ]/,CJK=/[぀-ヿ㐀-鿿가-힯＀-￯]/,HANGUL=/[가-힯]/;
 const KEYS=['walk','walkStop','walkHelp','walkHelpTouch','walkMap','weather','hour','skyStage','skyClear','skyCloudy','skyRain','skyFog','skyStorm','envNote'];
 for(const l of ['en','ja','ko','zh-Hans','zh-Hant']){
  for(const k of KEYS){
   const v=TEXT[l][k];
   assert.ok(typeof v==='string'&&v.trim(),l+' '+k);
   if(l==='en')assert.ok(!CJK.test(v),l+' '+k+': '+v);
   if(l!=='ja')assert.ok(!KANA.test(v),l+' '+k+': '+v);
   if(l==='ko')assert.ok(HANGUL.test(v)||/^[\s\S]*[A-Z]/.test(v),l+' '+k+': '+v);
  }
 }
 const pages=['3d/gunkanjima.html','3d/ja/gunkanjima.html','3d/ko/gunkanjima.html','3d/zh-cn/gunkanjima.html','3d/zh-tw/gunkanjima.html'];
 for(const p of pages){
  const s=read(p);
  for(const id of ['btnWalk','envWeather','envHour','envHourLabel','envNote','walkMap','walkHud','walkFacing','walkJoy'])assert.ok(s.includes('id="'+id+'"'),p+' has #'+id);
 }
 /* every weather the menu offers is one the viewer knows */
 const skies=vm.runInNewContext(/const SKIES = (\[[^\]]+\]);/.exec(js)[1]);
 assert.equal(JSON.stringify(skies),JSON.stringify(['stage','clear','cloudy','rain','fog','storm']));
 for(const k of skies.slice(1))assert.ok(new RegExp('\\n    '+k+':\\s+\\{ cloud:').test(js),'weather '+k+' is defined');
});
