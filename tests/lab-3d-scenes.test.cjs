/* Inside the Gunkanjima 3D model: every room camera looks into its room, not onto the room's ceiling; the
   shrine is approached from the front through the torii; the viewer's panels, zoom limits and walls hold;
   the audio guide keeps chapters and transcript under the player. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const lab=JSON.parse(read('3d/gunkanjima-lab.json')),scenes=JSON.parse(read('3d/gunkanjima-interiors.json')).scenes;
const mpp=lab.frame.metersPerPixel,rot=-Math.atan2(lab.north[0],-lab.north[1]),cr=Math.cos(rot),sr=Math.sin(rot);
const PAGES=['3d/gunkanjima.html','3d/ja/gunkanjima.html','3d/ko/gunkanjima.html','3d/zh-cn/gunkanjima.html','3d/zh-tw/gunkanjima.html'];

/* the eye as the viewer places it (target + dist x (cos el sin az, sin el, cos el cos az)), back in the crop frame */
function eye(cam){
 const ce=Math.cos(cam.el),dx=cam.dist*ce*Math.sin(cam.az),dz=cam.dist*ce*Math.cos(cam.az);
 return [cam.u+(dx*cr+dz*sr)/mpp,cam.v+(-dx*sr+dz*cr)/mpp,cam.y+cam.dist*Math.sin(cam.el)];
}
function inside(b,u,v){
 const a=(b.r||0)*Math.PI/180,du=(u-b.u)*mpp,dv=(v-b.v)*mpp;
 return Math.abs(du*Math.cos(a)+dv*Math.sin(a))<=b.s[0]/2&&Math.abs(-du*Math.sin(a)+dv*Math.cos(a))<=b.s[2]/2;
}

test('no room camera looks at its room through the room ceiling',()=>{
 assert.ok(Object.keys(scenes).length>=12);
 let rooms=0;
 for(const [id,sc] of Object.entries(scenes)){
  const overhead=sc.boxes.filter(b=>b.s[1]<=0.6&&b.s[0]*b.s[2]>=4&&b.y>=sc.floor+1.5&&!b.a&&b.k!==8&&b.k!==12);
  if(overhead.length)rooms++;
  for(const cam of [sc.camera,sc.approach].filter(Boolean)){
   const [eu,ev,ey]=eye(cam);
   for(const b of overhead){
    if(ey>b.y&&cam.y<b.y){
     const t=(ey-b.y)/(ey-cam.y);
     assert.ok(!inside(b,eu+(cam.u-eu)*t,ev+(cam.v-ev)*t),id+': the view crosses the '+(b.t||'slab')+' at '+b.y+' m from an eye at '+ey.toFixed(2)+' m');
    }
   }
   assert.ok(ey>=sc.floor-0.3,id+': the eye is not below the floor');
  }
 }
 assert.ok(rooms>=6,'rooms with a ceiling are checked ('+rooms+')');
});

test('the shrine is seen from the front: outside the torii first, then walking through it toward the hall',()=>{
 const sh=scenes.shrine,avg=(tag,k)=>{const xs=sh.boxes.filter(b=>b.t===tag).map(b=>b[k]);return xs.reduce((a,x)=>a+x,0)/xs.length;};
 const toriiU=avg('torii','u'),hokoraU=avg('hokora','u'),dir=Math.sign(toriiU-hokoraU);
 assert.ok(sh.approach,'the shrine has an approach view');
 const start=eye(sh.camera),end=eye(sh.approach);
 assert.ok((start[0]-toriiU)*dir>0,'the first view stands outside the torii');
 assert.ok((end[0]-toriiU)*dir<0&&(end[0]-hokoraU)*dir>0,'the approach ends between the torii and the inner shrine');
 assert.ok(Math.abs(sh.camera.az-sh.approach.az)<1e-6,'both views face the same way');
 assert.ok(sh.camera.el<0.15&&sh.approach.el<0.15,'views at eye level, not from above');
});

test('the viewer opens its panels, lets the camera into rooms, ghosts both host buildings and draws every wall outward',()=>{
 const js=read('3d/gunkanjima-3d.js');
 const body=name=>{const a=js.indexOf('function '+name+'(');assert.ok(a>0,name);return js.slice(a,js.indexOf('\n  function ',a+10));};
 for(const name of ['openSpot','openBuilding']){
  const f=body(name);
  assert.ok(f.includes('const scIds = '),name+' declares the scenes it lists');
  assert.ok(!/\bsc\b/.test(f.replace(/scIds/g,'')),name+' uses no undeclared sc');
 }
 assert.equal((js.match(/, D_MIN, D_MAX\)/g)||[]).length,1,'only the home distance keeps the outside limits; input uses dMin()/dMax()');
 assert.equal((js.match(/dMin\(\), dMax\(\)/g)||[]).length,5,'wheel, pinch and keys use the scene-aware limits');
 assert.ok(js.includes('const D_MIN_SCENE = 0.6'),'the camera can come close inside a room');
 assert.ok(js.includes('const poly = signedArea(part) < 0 ? part.slice().reverse() : part;'),'outlines are wound one way');
 assert.equal((js.match(/abs\(aBid - uGhostId2\)/g)||[]).length,2,'walls and roofs ghost a second host building');
 assert.ok(js.includes('sc.approach && scene === id'),'a scene can walk on to its approach view');
 assert.ok(js.includes('st.dist < 420 && !scene')&&js.includes('if (!q || scene){ pin.hidden = true; continue; }'),'names and pins step aside inside a room');
});

test('the audio guide keeps chapters and transcript under the player; the method notes and the intro paragraph are gone',()=>{
 for(const file of PAGES){
  const s=read(file);
  const player=s.indexOf('<div class="pod-player">'),audio=s.indexOf('<audio id="podAudio"'),cols=s.indexOf('<div class="pod-columns">'),lead=s.indexOf('<p class="lead">');
  assert.ok(player>0&&audio>player&&cols>audio&&lead>cols,file+': chapters and transcript follow the player');
  assert.ok(s.indexOf('id="podCredit"')>cols&&s.indexOf('id="podCredit"')<lead,file+': the voice credit stays with them');
  for(const gone of ['<h2>How it was made</h2>','<h2>作り方</h2>','<h2>만든 방법</h2>','<h2>制作方法</h2>','<h2>製作方法</h2>','class="podcast"','日本語（約10分）か英語（約9分）','A two-voice episode','The page explains the method'])
   assert.ok(!s.includes(gone),file+': no '+gone);
  for(const keep of ['国土地理院','加工して作成','OpenStreetMap contributors','Wikimedia Commons'])assert.ok(s.includes(keep),file+': credit '+keep);
 }
 for(const [file,twice] of [['3d/ko/gunkanjima.html','음성 가이드를 재생하면'],['3d/zh-cn/gunkanjima.html','播放音频导览时模型会跟着讲解移动'],['3d/zh-tw/gunkanjima.html','播放語音導覽時模型會跟著講解移動']]){
  const lead=/<p class="lead">([^<]*)<\/p>/.exec(read(file))[1];
  assert.equal(lead.split(twice).length-1,1,file+': the lead says it once');
 }
});
