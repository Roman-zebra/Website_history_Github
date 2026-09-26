(function(){
'use strict';
const $=id=>document.getElementById(id);
const supported=['ja','en','ko','zh-Hans','zh-Hant'];
const lang=new URLSearchParams(location.search).get('lang')||'ja';
window.LAB_LANG=supported.includes(lang)?lang:'ja';window.JTA_WALK_PAGE=true;
const en={menu:'Menu',back:'← Gunkanjima',title:'Island walk',era:'Reconstruction centred on 1962',help:'Help & sources',pause:'Pause',resume:'Resume exploring',island:'Explore the island',mapHint:'● You　◇ Reconstructed scenes',destination:'Explore a place',choose:'Travel to…',camera:'Change camera',reset:'Return to start',fullscreen:'Full screen',near:'Approach a building to enter',details:'About this place',move:'Move',run:'Run',hint:'WASD / arrows: move · Shift: run · Drag: look · E: enter / leave',touchHint:'Left stick: move · Full tilt: sprint · Swipe: look',mouse:'Lock mouse look',helpTitle:'Walk around Gunkanjima',helpBody:'Explore the island and rooms in first person. Use the switchback stairs in inferred interiors to reach every floor and the roof. Use WASD or the left stick to move, and drag the scene to look. Approach a building to enter, or travel directly using the place list.',limits:'This is a schematic reconstruction. Inferred interiors use source-model footprints and storey counts, but stair positions, room layouts, furnishings and colours are not measured or photographically verified. Equipment and structures too narrow for stairs cannot be entered. Terrain cuts around buildings, paving joints and surface colours are also inferred. Weather is simulated.',sources:'Read the sources and reconstruction notes',enter:'Enter',leave:'Return outside',ready:'Explore freely. Drag to look around.',error:'This reconstructed scene could not be entered.',first:'Camera: first person',third:'Camera: third person'};
Object.assign(en,{"extra0": "Year", "extra1": "Latest", "extra2": "Photo archive", "extra3": "Weather: clear", "extra4": "Loading the 3D island…", "extra5": "Rendering code: ", "extra6": "NiloCat Toon Shader (MIT): adaptation credits", "extra7": "Photo archive", "extra8": "Compare GSI aerial photographs with library and museum records. Colour interpretations of monochrome photographs do not establish historical colours.", "extra9": "Adapted from Geospatial Information Authority of Japan aerial photographs, using previously aligned images.", "extra10": "Reference videos and historical context", "extra11": "Present-day ruins and records from the inhabited period are distinguished. These references do not imply a precise reconstruction.", "extra12": "Gunkanjima 4K walk (filmed in 2020)", "extra13": "NCC: interiors with former residents (2013)", "extra14": "Hachiyo Consultant: 2024 survey footage and building-number correction", "extra15": "Genshin main story: user-supplied visual reference", "extra16": " — visual reference only; this playlist has not been viewed", "extra17": "Libraries and primary sources", "extra18": "1952 / 1970: Life on Gunkanjima (NDL catalogue)", "extra19": " — full text not obtained", "extra20": "Gunkanjima measured survey collection (NDL catalogue)", "extra21": " — drawings not obtained", "extra22": "Hashima around 1954 (Showa Memorial Museum)", "extra23": " — original archive page", "extra24": "Building 65, parks and rooftops: Gunkanjima Digital Museum", "extra25": "Yuji Saiga photo collection, 1986 (NDL restricted digital access)", "aria0": "Gunkanjima 3D exploration", "aria1": "3D exploration. WASD to move; drag to look.", "aria2": "Your location on the island", "aria3": "Actions at this location", "aria4": "Movement stick", "aria5": "Close", "alt0": "Aerial photograph of Gunkanjima in 1962", "alt1": "Aerial photograph, 1947", "alt2": "Aerial photograph, 1962", "alt3": "Colour aerial photograph, 1975", "alt4": "Colour aerial photograph, 2010"});
const ja={menu:'メニュー',island:'島内を探索',near:'建物の近くで中へ',details:'この場所について',title:'3D街歩き',enter:'中へ',leave:'屋外に戻る',ready:'自由に歩けます。ドラッグで周囲を見回せます。',error:'この再現シーンには入れませんでした。',first:'視点：一人称',third:'視点：三人称'};
const more={ko:{menu:'메뉴',back:'← 군함도',title:'섬 산책',era:'1962년 중심 복원',help:'조작・자료',pause:'일시 정지',resume:'탐험 계속',island:'섬 탐험',destination:'장소 탐험',choose:'장소로 이동…',camera:'시점 전환',reset:'출발점으로',fullscreen:'전체 화면',near:'건물 가까이에서 입장',details:'장소 설명',move:'이동',run:'달리기',enter:'입장',leave:'야외로',ready:'자유롭게 걸어보세요. 드래그하여 둘러봅니다.'},'zh-Hans':{menu:'菜单',back:'← 军舰岛',title:'3D漫步',era:'以1962年为中心的复原',help:'操作・资料',pause:'暂停',resume:'继续探索',island:'探索岛屿',destination:'探索地点',choose:'前往地点…',camera:'切换视角',reset:'返回起点',fullscreen:'全屏',near:'靠近建筑进入',details:'地点介绍',move:'移动',run:'奔跑',enter:'进入',leave:'返回室外',ready:'自由探索，拖动查看四周。'},'zh-Hant':{menu:'選單',back:'← 軍艦島',title:'3D漫步',era:'以1962年為中心的復原',help:'操作・資料',pause:'暫停',resume:'繼續探索',island:'探索島嶼',destination:'探索地點',choose:'前往地點…',camera:'切換視角',reset:'返回起點',fullscreen:'全螢幕',near:'靠近建築進入',details:'地點介紹',move:'移動',run:'奔跑',enter:'進入',leave:'返回室外',ready:'自由探索，拖動查看四周。'}};
const L=window.LAB_LANG,t=L==='ja'?{...en,...ja}:{...en,...(more[L]||{})};
// Look tuning panel (vegetation, water, clouds and light effects are illustrative placeholders, not history).
const lookText={
ja:{look:'見た目の調整',lookTitle:'見た目の調整',natureNote:'草木・花・池・雲・光の粒などは雰囲気づくりのための仮の表現で、当時の植生や景観を再現したものではありません。',lookSeason:'季節の色',spring:'春',summer:'夏',autumn:'秋',winter:'冬',magic:'魔法',quality:'画質',qAuto:'自動',qLow:'軽量',qMid:'標準',qHigh:'高品質',lookReset:'初期値に戻す',lookCopy:'設定をコピー',lookCopied:'コピーしました',look_exposure:'明るさ',look_saturation:'鮮やかさ',look_contrast:'コントラスト',look_warmth:'暖かみ',look_grass:'草の量',look_flowers:'花の量',look_clouds:'雲の影',look_land:'遠くの山並み',look_haze:'かすみ',look_wind:'風',look_mottle:'草原のまだら',look_sheen:'草原のつや',look_streaks:'風の筋',look_spots:'水面の模様',look_sparkle:'水のきらめき',look_ambient:'花びら・鳥・光の粒',look_bloom:'光のにじみ',look_grain:'フィルムの粒子'},
en:{look:'Adjust look',lookTitle:'Adjust the look',natureNote:'Grass, flowers, trees, the pond, clouds and light effects are illustrative placeholders for atmosphere, not a reconstruction of the island\'s historical vegetation or scenery.',lookSeason:'Season colours',spring:'Spring',summer:'Summer',autumn:'Autumn',winter:'Winter',magic:'Magic',quality:'Quality',qAuto:'Auto',qLow:'Light',qMid:'Standard',qHigh:'High',lookReset:'Reset',lookCopy:'Copy settings',lookCopied:'Copied',look_exposure:'Brightness',look_saturation:'Saturation',look_contrast:'Contrast',look_warmth:'Warmth',look_grass:'Grass',look_flowers:'Flowers',look_clouds:'Cloud shadows',look_land:'Distant hills',look_haze:'Haze',look_wind:'Wind',look_mottle:'Meadow mottling',look_sheen:'Meadow sheen',look_streaks:'Wind streaks',look_spots:'Water pattern size',look_sparkle:'Water sparkle',look_ambient:'Petals, birds, sparkles',look_bloom:'Bloom',look_grain:'Film grain'},
ko:{look:'화면 조정',lookTitle:'화면 분위기 조정',natureNote:'풀·꽃·나무·연못·구름·빛 효과는 분위기를 위한 임시 표현이며, 당시의 식생이나 경관을 복원한 것이 아닙니다.',lookSeason:'계절 색상',spring:'봄',summer:'여름',autumn:'가을',winter:'겨울',magic:'마법',quality:'화질',qAuto:'자동',qLow:'가볍게',qMid:'표준',qHigh:'고품질',lookReset:'초기화',lookCopy:'설정 복사',lookCopied:'복사했습니다',look_exposure:'밝기',look_saturation:'채도',look_contrast:'대비',look_warmth:'따뜻함',look_grass:'풀의 양',look_flowers:'꽃의 양',look_clouds:'구름 그림자',look_land:'먼 산줄기',look_haze:'연무',look_wind:'바람',look_mottle:'초원 얼룩',look_sheen:'초원 광택',look_streaks:'바람 줄기',look_spots:'수면 무늬 크기',look_sparkle:'물의 반짝임',look_ambient:'꽃잎·새·빛 입자',look_bloom:'빛 번짐',look_grain:'필름 그레인'},
'zh-Hans':{look:'画面调整',lookTitle:'调整画面风格',natureNote:'草木、花、池塘、云和光效是营造氛围的临时表现，并非对当时植被或景观的复原。',lookSeason:'季节配色',spring:'春',summer:'夏',autumn:'秋',winter:'冬',magic:'魔法',quality:'画质',qAuto:'自动',qLow:'流畅',qMid:'标准',qHigh:'高画质',lookReset:'恢复默认',lookCopy:'复制设置',lookCopied:'已复制',look_exposure:'亮度',look_saturation:'饱和度',look_contrast:'对比度',look_warmth:'暖色调',look_grass:'草量',look_flowers:'花量',look_clouds:'云影',look_land:'远山',look_haze:'雾气',look_wind:'风',look_mottle:'草地斑驳',look_sheen:'草地光泽',look_streaks:'风痕',look_spots:'水面纹理大小',look_sparkle:'水面闪光',look_ambient:'花瓣、鸟、光点',look_bloom:'光晕',look_grain:'胶片颗粒'},
'zh-Hant':{look:'畫面調整',lookTitle:'調整畫面風格',natureNote:'草木、花、池塘、雲和光效是營造氛圍的暫定表現，並非對當時植被或景觀的復原。',lookSeason:'季節配色',spring:'春',summer:'夏',autumn:'秋',winter:'冬',magic:'魔法',quality:'畫質',qAuto:'自動',qLow:'流暢',qMid:'標準',qHigh:'高畫質',lookReset:'恢復預設',lookCopy:'複製設定',lookCopied:'已複製',look_exposure:'亮度',look_saturation:'飽和度',look_contrast:'對比度',look_warmth:'暖色調',look_grass:'草量',look_flowers:'花量',look_clouds:'雲影',look_land:'遠山',look_haze:'霧氣',look_wind:'風',look_mottle:'草地斑駁',look_sheen:'草地光澤',look_streaks:'風痕',look_spots:'水面紋理大小',look_sparkle:'水面閃光',look_ambient:'花瓣、鳥、光點',look_bloom:'光暈',look_grain:'膠片顆粒'}};
Object.assign(t,lookText.en,lookText[L]||{});
const demo={ja:'デモ版',en:'Demo',ko:'데모','zh-Hans':'演示版','zh-Hant':'示範版'}[L];t.title+=' · '+demo;
document.querySelector('[data-t=title]').textContent=t.title;
if(L!=='ja')for(const el of document.querySelectorAll('[data-t]'))el.textContent=t[el.dataset.t]||el.textContent;
if(L!=='ja')for(const [selector,attribute,key] of [['[data-t-aria]','aria-label','tAria'],['[data-t-alt]','alt','tAlt']])for(const el of document.querySelectorAll(selector))el.setAttribute(attribute,t[el.dataset[key]]);
$('eraLabel').textContent='1962 · '+t.first;
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
 // Look tuning: the reference video's lesson was to expose the parameters and tune them by eye. Kept in this browser only.
 const look=g.appearance;
 if(look&&$('lookButton')){
  const KEY='jta-walk-look-v1',box=$('lookSliders'),inputs={},ranges=look.ranges(),presets=[...document.querySelectorAll('[data-preset]')];
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(look.get()));}catch{}};
  try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&typeof saved==='object')look.set(saved);}catch{}
  const sync=()=>{const v=look.get();for(const k in inputs){inputs[k][0].value=v[k];inputs[k][1].textContent=(+v[k]).toFixed(2);}$('lookQuality').value=v.quality;for(const b of presets)b.setAttribute('aria-pressed',String(b.dataset.preset===v.preset));};
  for(const key of ['exposure','saturation','contrast','warmth','grass','flowers','clouds','land','haze','wind','mottle','sheen','streaks','spots','sparkle','ambient','bloom','grain']){
   if(!ranges[key])continue;
   const row=document.createElement('label'),name=document.createElement('span'),input=document.createElement('input'),out=document.createElement('output');
   name.textContent=t['look_'+key]||key;input.type='range';input.min=ranges[key][0];input.max=ranges[key][1];input.step=key==='grain'?.005:.01;
   input.oninput=()=>{look.set({[key]:+input.value});out.textContent=(+input.value).toFixed(2);save();};
   row.append(name,input,out);box.append(row);inputs[key]=[input,out];
  }
  for(const b of presets)b.onclick=()=>{look.set({preset:b.dataset.preset});sync();save();};
  $('lookQuality').onchange=()=>{look.set({quality:$('lookQuality').value});sync();save();};
  $('lookReset').onclick=()=>{look.reset();sync();try{localStorage.removeItem(KEY);}catch{}};
  $('lookCopy').onclick=async()=>{const text=JSON.stringify(look.get());try{await navigator.clipboard.writeText(text);$('lookCopy').textContent=t.lookCopied;setTimeout(()=>{$('lookCopy').textContent=t.lookCopy;},1600);}catch{window.prompt(t.lookCopy,text);}};
  $('lookButton').onclick=()=>{sync();dialog('lookDialog');};
  $('lookButton').disabled=false;
 }
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
