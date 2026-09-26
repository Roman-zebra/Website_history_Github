(function(){
'use strict';
const $=id=>document.getElementById(id);
const supported=['ja','en','ko','zh-Hans','zh-Hant'];
const lang=new URLSearchParams(location.search).get('lang')||'ja';
window.LAB_LANG=supported.includes(lang)?lang:'ja';window.JTA_WALK_PAGE=true;
const en={menu:'Menu',back:'← Gunkanjima',title:'Island walk',era:'Reconstruction centred on 1962',help:'Help & sources',pause:'Pause',resume:'Resume exploring',island:'Explore the island',mapHint:'● You　◇ Reconstructed scenes',destination:'Explore a place',choose:'Travel to…',camera:'Change camera',reset:'Return to start',fullscreen:'Full screen',near:'Approach a building to enter',details:'About this place',move:'Move',run:'Run',hint:'WASD / arrows: move · Shift: run · Drag: look · E: enter / leave',touchHint:'Left stick: move · Full tilt: sprint · Swipe: look',mouse:'Lock mouse look',helpTitle:'Walk around Gunkanjima',helpBody:'Explore the island and rooms in first person. Use the switchback stairs in inferred interiors to reach every floor and the roof. Use WASD or the left stick to move, and drag the scene to look. Approach a building to enter, or travel directly using the place list.',limits:'This is a schematic reconstruction. Inferred interiors use source-model footprints and storey counts, but stair positions, room layouts, furnishings and colours are not measured or photographically verified. Equipment and structures too narrow for stairs cannot be entered. Terrain cuts around buildings, paving joints and surface colours are also inferred. Weather is simulated.',sources:'Read the sources and reconstruction notes',enter:'Enter',leave:'Return outside',ready:'Explore freely. Drag to look around.',error:'This reconstructed scene could not be entered.',first:'Camera: first person',third:'Camera: third person'};
const ja={menu:'メニュー',island:'島内を探索',near:'建物の近くで中へ',details:'この場所について',title:'3D街歩き',enter:'中へ',leave:'屋外に戻る',ready:'自由に歩けます。ドラッグで周囲を見回せます。',error:'この再現シーンには入れませんでした。',first:'視点：一人称',third:'視点：三人称'};
const more={ko:{menu:'메뉴',back:'← 군함도',title:'섬 산책',era:'1962년 중심 복원',help:'조작・자료',pause:'일시 정지',resume:'탐험 계속',island:'섬 탐험',destination:'장소 탐험',choose:'장소로 이동…',camera:'시점 전환',reset:'출발점으로',fullscreen:'전체 화면',near:'건물 가까이에서 입장',details:'장소 설명',move:'이동',run:'달리기',enter:'입장',leave:'야외로',ready:'자유롭게 걸어보세요. 드래그하여 둘러봅니다.'},'zh-Hans':{menu:'菜单',back:'← 军舰岛',title:'3D漫步',era:'以1962年为中心的复原',help:'操作・资料',pause:'暂停',resume:'继续探索',island:'探索岛屿',destination:'探索地点',choose:'前往地点…',camera:'切换视角',reset:'返回起点',fullscreen:'全屏',near:'靠近建筑进入',details:'地点介绍',move:'移动',run:'奔跑',enter:'进入',leave:'返回室外',ready:'自由探索，拖动查看四周。'},'zh-Hant':{menu:'選單',back:'← 軍艦島',title:'3D漫步',era:'以1962年為中心的復原',help:'操作・資料',pause:'暫停',resume:'繼續探索',island:'探索島嶼',destination:'探索地點',choose:'前往地點…',camera:'切換視角',reset:'返回起點',fullscreen:'全螢幕',near:'靠近建築進入',details:'地點介紹',move:'移動',run:'奔跑',enter:'進入',leave:'返回室外',ready:'自由探索，拖動查看四周。'}};
const L=window.LAB_LANG,t=L==='ja'?{...en,...ja}:{...en,...(more[L]||{})};
const demo={ja:'デモ版',en:'Demo',ko:'데모','zh-Hans':'演示版','zh-Hant':'示範版'}[L];t.title+=' · '+demo;
document.querySelector('[data-t=title]').textContent=t.title;
if(L!=='ja')for(const el of document.querySelectorAll('[data-t]'))el.textContent=t[el.dataset.t]||el.textContent;
document.documentElement.lang=L;document.title=(L==='ja'?'軍艦島 3D街歩き デモ版':t.title+' · Gunkanjima')+' | Japan Time Atlas';
window.LAB_TEXT={walkReady:t.ready,...(L==='ja'?{loading:'3Dの島を読み込み中…',failed:'3Dデータを読み込めませんでした。ページを再読み込みしてください。',noWebgl:'このブラウザでは3Dを描画できないため、空中写真を表示しています。WebGL対応のブラウザで開いてください。'}:{})};
const dir={ja:'ja/',en:'',ko:'ko/','zh-Hans':'zh-cn/','zh-Hant':'zh-tw/'}[L];
$('backLink').href=$('sourcesLink').href='/3d/'+dir+'gunkanjima';$('language').value=L;
$('language').onchange=()=>{location.search='?lang='+encodeURIComponent($('language').value);};
let api,g,scenes={},near=null,stickId=null;
const label=s=>(s.label&&(s.label[L]||s.label.en))||s.building;
const paused=()=>!!document.querySelector('dialog[open]');
function stop(){if(g)g.pause();stickId=null;$('stickThumb').style.transform='';$('run').setAttribute('aria-pressed','false');$('stick').classList.remove('sprinting');}
function closeTools(){$('walkTools').hidden=true;$('toolsToggle').setAttribute('aria-expanded','false');}
$('toolsToggle').onclick=()=>{const open=$('walkTools').hidden;stop();$('walkTools').hidden=!open;$('toolsToggle').setAttribute('aria-expanded',String(open));};
$('view').addEventListener('pointerdown',closeTools);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeTools();});
function dialog(id){closeTools();stop();if(document.pointerLockElement)document.exitPointerLock();$(id).showModal();}
$('archive').onclick=()=>dialog('archiveDialog');$('help').onclick=()=>dialog('helpDialog');
for(const d of document.querySelectorAll('dialog'))d.addEventListener('close',()=>{if(api)$('view').focus();});
window.addEventListener('blur',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('game').requestFullscreen)await $('game').requestFullscreen();}catch{}};
function enter(id){closeTools();stop();if(g.enter(id)){$('details').hidden=false;$('viewStatus').textContent='';}else $('viewStatus').textContent=t.error;}
function interact(){if(!g||paused())return;if(g.indoor()){stop();g.leave();$('details').hidden=true;}else if(near)enter(near);}
$('interact').onclick=interact;
$('details').onclick=()=>{const s=scenes[api.scene()];if(!s)return;$('detailTitle').textContent=label(s);$('detailText').textContent=s.text[L]||s.text.en;$('detailSources').replaceChildren();for(const source of s.sources||[]){const li=document.createElement('li'),a=document.createElement('a');a.textContent=typeof source.label==='string'?source.label:(source.label[L]||source.label.en);a.href=source.url;a.target='_blank';a.rel='noopener';li.append(a);$('detailSources').append(li);}dialog('detailsDialog');};
$('destination').onchange=()=>{const id=$('destination').value;if(id)enter(id);$('destination').value='';};
$('reset').onclick=()=>{closeTools();stop();g.reset();$('details').hidden=true;};
function syncRun(){if(g){const running=g.input.run||g.input.autoRun;$('run').setAttribute('aria-pressed',String(running));stick.classList.toggle('sprinting',running);}}
$('run').onclick=()=>{g.input.run=!g.input.run;syncRun();$('view').focus();};
$('mouse').onclick=async()=>{try{await $('view').requestPointerLock();}catch{$('viewStatus').textContent=t.ready;}};
document.addEventListener('mousemove',e=>{if(g&&document.pointerLockElement===$('view')&&!paused())g.look(e.movementX,e.movementY);});
document.addEventListener('keydown',e=>{if(paused()||!g||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key.toLowerCase()==='e'){e.preventDefault();interact();}if(e.key==='Escape'){stop();closeTools();}});
const stick=$('stick');
function moveStick(e){if(e.pointerId!==stickId||!g)return;const r=stick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,length=Math.hypot(dx,dy),radius=Math.min(36,r.width*.34),amount=Math.min(1,length/radius),power=Math.max(0,(amount-.10)/.90),unit=Math.max(.001,length);g.input.x=dx/unit*power;g.input.y=power?-dy/unit*power:0;g.input.autoRun=amount>=.85;const scale=Math.min(1,radius/unit);$('stickThumb').style.transform='translate('+dx*scale+'px,'+dy*scale+'px)';syncRun();g.request();}
stick.onpointerdown=e=>{if(!g||paused()||stickId!==null)return;e.preventDefault();stickId=e.pointerId;stick.setPointerCapture(e.pointerId);$('view').focus();moveStick(e);};stick.onpointermove=moveStick;
for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,e=>{if(e.pointerId===stickId){g.input.x=g.input.y=0;g.input.autoRun=false;stickId=null;$('stickThumb').style.transform='';syncRun();}});
window.addEventListener('jta-walk-ready',()=>{
 api=window.jtaLab3d;g=api.game;scenes=g.scenes();
 for(const id of ['destination','reset','run','mouse','walkYear'])$(id).disabled=false;
 $('viewStatus').textContent=t.ready;
 function destinations(){
   const select=$('destination');while(select.options.length>1)select.remove(1);
   for(const [id,s]of Object.entries(scenes)){
    const b=s.generatedBuilding||(s.buildingId&&api.model().buildings.find(b=>b.id===s.buildingId));
    if(b&&(g.year()<(b.built||b.seen||1950)||(b.gone&&g.year()>b.gone)))continue;
    if(!s.inferred&&g.year()!==1962)continue;
    const o=document.createElement('option');o.value=id;o.textContent=label(s);select.append(o);
   }
  }
  destinations();$('walkYear').onchange=()=>{closeTools();stop();api.setYear(+$('walkYear').value,0);g.reset();$('details').hidden=true;$('eraLabel').textContent=$('walkYear').selectedOptions[0].textContent+' · '+t.first;destinations();};
 if(!$('view').requestPointerLock)$('mouse').hidden=true;
 const map=$('miniMap'),ctx=map.getContext('2d'),model=api.model(),coast=model.coast;
 // Fixed local scale: the player stays centred while the island moves underneath.
 const scale=.93;let center=[0,0];
 const xy=p=>[90+(p[0]-center[0])*scale,90+(p[1]-center[1])*scale];
 function polygon(p,color){ctx.beginPath();p.forEach((v,i)=>{const [x,y]=xy(v);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.fillStyle=color;ctx.fill();}
 function tick(){if(document.hidden)return;const st=api.st,p=g.fromWorld(st.wx,st.wz);center=p;ctx.clearRect(0,0,180,180);polygon(coast,'#73817b');for(const b of model.buildings){if(g.year()<(b.built||b.seen||1950)||(b.gone&&g.year()>b.gone))continue;polygon(b.poly,'#334951');}near=null;let distance=28;
 for(const [id,s] of Object.entries(scenes)){const b=s.generatedBuilding||(s.buildingId&&api.model().buildings.find(b=>b.id===s.buildingId));if(b&&(g.year()<(b.built||b.seen||1950)||(b.gone&&g.year()>b.gone)))continue;if(!s.inferred&&g.year()!==1962)continue;const w=g.toWorldTrue(s.camera.u,s.camera.v),d=Math.hypot(w[0]-st.wx,w[1]-st.wz);if(d<distance){near=id;distance=d;}const [x,y]=xy([s.camera.u,s.camera.v]);ctx.fillStyle='#e3bb70';ctx.fillRect(x-2,y-2,4,4);}
 const [x,y]=xy(p),ahead=g.fromWorld(st.wx+Math.sin(st.az),st.wz+Math.cos(st.az)),heading=Math.atan2(ahead[1]-p[1],ahead[0]-p[0]);
 ctx.beginPath();ctx.moveTo(x,y);ctx.arc(x,y,31,heading-.55,heading+.55);ctx.closePath();ctx.fillStyle='#f7e8af30';ctx.fill();
 ctx.save();ctx.translate(x,y);ctx.rotate(heading);ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-6,-5);ctx.lineTo(-3,0);ctx.lineTo(-6,5);ctx.closePath();ctx.fillStyle='#fff8d9';ctx.strokeStyle='#16384a';ctx.lineWidth=2;ctx.fill();ctx.stroke();ctx.restore();const indoor=g.indoor();$('interact').disabled=!indoor&&!near;$('interact').textContent=indoor?t.leave:near?t.enter+' · '+label(scenes[near]):t.near;$('location').textContent=indoor?label(scenes[api.scene()]):t.island;
 const level=g.floor();$('floorLevel').hidden=!level;if(level)$('floorLevel').textContent=level.current===level.total?(L==='ja'?'屋上':'ROOFTOP'):(level.current+1)+' F / '+level.total+' F';
 $('evidence').hidden=!indoor;if(indoor)$('evidence').textContent=scenes[api.scene()].inferred?(L==='ja'?'推定の探索モデル · 間取り・色は未実測':'INFERRED INTERIOR · layout & colour unmeasured'):(L==='ja'?'資料に基づく再現 · 一部推定':'SOURCE-BASED SCENE · partly inferred');
 }
 tick();setInterval(tick,50);setTimeout(()=>{if($('viewStatus').textContent===t.ready)$('viewStatus').textContent='';},7000);
});
})();
