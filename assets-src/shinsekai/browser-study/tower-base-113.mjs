import * as THREE from 'three/webgpu';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {waitCaptureFrame,encodeCanvasPng} from './capture-frame.mjs';
import {repeatedMeshInstances} from './repeated-mesh-instances.mjs';
import {createTowerBalusterInstances} from './tower-baluster-instances.mjs';
import {createTowerGatePlayback} from './tower-gate-playback.mjs';
import {createTowerPlaceholderMask} from './tower-placeholder-mask.mjs';
import {checkPhoneAssembly,phoneBuffer,PHONE_BUDGET} from './tower-mobile-profile.mjs';
import {hallStreamParts,loadStreamedCell} from './streamed-cell.mjs';
import {createRoomPrefetch,nearStudyPortal} from './room-prefetch.mjs';
import {createHallDirectionalLook} from './hall-directional-look.mjs';
const canvas=document.querySelector('#view'),status=document.querySelector('#status'),metrics=document.querySelector('#metrics');
const view=document.querySelector('#viewpoint'),dream=document.querySelector('#dream'),measure=document.querySelector('#measure'),capture=document.querySelector('#capture');
const sliders={car:document.querySelector('#car'),landing:document.querySelector('#landing')};
const playButtons={car:document.querySelector('#carPlay'),landing:document.querySelector('#landingPlay')};
const review=document.documentElement.dataset.towerReview==='115'?'115':'113';
if(review==='115')for(const key of ['wingW','wingE']){sliders[key]=document.querySelector('#'+key);playButtons[key]=document.querySelector('#'+key+'Play');}
const query=new URLSearchParams(location.search),mobile=review==='115'&&(query.has('mobile')||(matchMedia('(pointer:coarse)').matches&&Math.min(innerWidth,innerHeight)<=600)),mobileTextures=review==='115'&&(mobile||query.has('mobiletextures'));
let [width,height]=mobile?phoneBuffer(innerWidth,innerHeight):[query.get('size')==='1080'?1920:1280,query.get('size')==='1080'?1080:720];
const renderer=new THREE.WebGPURenderer({canvas,antialias:!mobile,forceWebGL:query.has('webgl')});renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.15;
canvas.dataset.profile=mobile?'mobile':mobileTextures?'texture-comparison':'desktop';
const scene=new THREE.Scene();scene.background=new THREE.Color(0x99a9b5);scene.add(new THREE.HemisphereLight(0xdce7f1,0x72614e,1.2));
const sun=new THREE.DirectionalLight(0xffe2ba,3);sun.position.set(-20,40,30);scene.add(sun);
const camera=new THREE.PerspectiveCamera(50,width/height,.05,350),controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.maxDistance=200;
const loader=new GLTFLoader(),base=mobileTextures?'/study/tower-mobile-115/':'/study/tower-base-'+review+'/';
const cinemaProposal=!mobileTextures&&review==='115'&&query.has('cinemaproposal');
const hallProposal=!mobileTextures&&review==='115'&&query.has('hallproposal'),hallBase='/study/hall-115-proposal/';
const hallStream=!mobileTextures&&!hallProposal&&review==='115'&&query.has('hallstream'),hallStreamBase='/study/hall-115-stream/';
const hallPrefetch=hallStream&&query.has('hallprefetch'),hallPortal={portal:[-11.4,1.65,-.3],enter:8,leave:12},hallGainApplied=new WeakSet();let roomPrefetch;
const hallExposure=!mobileTextures&&review==='115'&&query.has('hallexposure');
const hallDirectional=!mobileTextures&&review==='115'&&query.has('halldirectional');let hallDirectionalLook;
const hallAO=!mobileTextures&&review==='115'&&query.has('hallao');let hallAmbientLook,createHallAmbientLook;
const hallFloorMode=!mobileTextures&&review==='115'?query.get('hallfloor'):null;let hallFloorLook,createHallFloorLook,cloneHallFloorMaterial,decorateHallFloorWear;
const hallWallMode=!mobileTextures&&review==='115'?query.get('hallwall'):null;let hallWallLook,createHallWallLook,cloneHallWallMaterial,decorateHallWallWear;
const hallLampMode=!mobileTextures&&hallStream?query.get('halllamp'):null,hallPointGain=hallLampMode!==null&&query.has('hallpoint')?Number(query.get('hallpoint')):1;let hallLampLook,createHallLampLook;
const liftProposal=!mobileTextures&&review==='115'&&query.has('liftproposal'),liftBase='/study/lift-115-proposal/';
const proposalBase='/study/cinema-115-proposal/';
let proposalReceipt,hallReceipt,liftReceipt,hallStreamReceipt;
if(cinemaProposal||mobileTextures||hallStream)loader.setMeshoptDecoder((await import('three/addons/libs/meshopt_decoder.module.js')).MeshoptDecoder);
const placement={hall:[-14.05,.15,8.6],stair:[-14.05,.15,12.55],lift:[-2.2,15.15,2.2],cinema:[-14.95,.15,-8.55]};
const views={north:{pos:[0,10,-48],target:[0,11,0]},hall:{cell:'hall',pos:[-12.275,1.65,6.9],target:[-12.275,1.8,-3]},stair:{cell:'stair',pos:[-11.03,1.55,12.03],target:[-12.6,3,10.8]},head:{cell:'stair',pos:[-11.15,16.65,9.6],target:[-12.7,15.8,11.8]},lift:{cell:'lift',pos:[-1.2,16.7,1.8],target:[.3,16.8,-.7]},cinema:{cell:'cinema',pos:[-20,1.8,0],target:[-46,3,0]}};
if(review==='115')Object.assign(views,{north:{pos:[0,17,-85],target:[0,8,0]},far:{lod:2,pos:[0,30,-145],target:[0,8,0]},wingW:{cell:'hall',pos:[-11.4,1.65,-.3],target:[-17,1.65,-.3]},wingE:{pos:[12,1.65,.3],target:[18,1.65,.3]},exit:{cell:'cinema',pos:[-29.45,1.65,11.7],target:[-29.45,1.65,5.5]}});
if(review==='115'&&(hallStream||query.has('hallviews'))){views.hallDesk={cell:'hall',pos:[-12.65,1.65,.7],target:[-10.85,1.2,.7]};const option=document.createElement('option');option.value='hallDesk';option.textContent='机の素材・近景';view.append(option);}
if(hallPrefetch){views.hallApproach={pos:[-6,1.65,-.3],target:[-12.275,1.65,-.3]};const option=document.createElement('option');option.value='hallApproach';option.textContent='西翼の手前・読み込み準備';view.append(option);}
if(review==='115'&&(hallFloorMode!==null||query.has('hallfloorview'))){views.hallFloor={cell:'hall',pos:[-12.35,.8,6.25],target:[-13.2,.153,4.5]};const option=document.createElement('option');option.value='hallFloor';option.textContent='床とベンチの脚元・近景';view.append(option);}
if(review==='115'&&(query.has('hallwall')||query.has('hallwallview'))){views.hallWall={cell:'hall',pos:[-12.35,1.65,5.2],target:[-14.035,1.41,3.5]};const option=document.createElement('option');option.value='hallWall';option.textContent='腰石と漆喰の境・近景';view.append(option);}
if(cinemaProposal){views.projector={cell:'cinema',pos:[-16.05,5.95,-1.65],target:[-17.35,5.20,-.40]};const option=document.createElement('option');option.value='projector';option.textContent='映写機の修正候補';view.append(option);}
if(liftProposal){views.liftThreshold={cell:'lift',pos:[0,15.9,1.75],target:[0,15.2,.45]};const option=document.createElement('option');option.value='liftThreshold';option.textContent='昇降機入口の敷居';view.append(option);}
let exterior,wings,manifest,placeholderMask,activeLOD=0,current=null,epoch=0,frame=null,disposed=false,preparing=false,ready=false,captureWait=null,pending=Promise.resolve(),initializing;
let frames=0,lastTime=null,mixers={};const intervals=[];
let blockedCell=false;
const fail=error=>{if(disposed)return;canvas.dataset.error=error.message;canvas.dataset.ready='false';ready=false;status.textContent='検証失敗：'+error.message;console.error(error);};
function release(model){if(!model)return;const gs=new Set(),ms=new Set(),ts=new Set();model.scene.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)gs.add(o.geometry);for(const m of [].concat(o.material??[]))ms.add(m);});for(const m of ms){for(const t of Object.values(m))if(t?.isTexture)ts.add(t);m.dispose();}for(const t of ts){t.dispose();t.source?.data?.close?.();}gs.forEach(g=>g.dispose());}
function request(){if(!disposed&&ready&&!preparing&&!document.hidden&&frame===null)frame=requestAnimationFrame(draw);}
function cancel(){if(frame!==null)cancelAnimationFrame(frame);frame=null;lastTime=null;}
async function settleGPU(){const queue=renderer.backend.isWebGPUBackend?renderer.backend.device?.queue:null;if(!queue)return;let timer;try{await Promise.race([queue.onSubmittedWorkDone(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('GPUの画像保存待機が終了しませんでした。')),5000);})]);}finally{clearTimeout(timer);}}
function locked(value){view.disabled=dream.disabled=measure.disabled=capture.disabled=value;controls.enabled=!value;for(const key of Object.keys(sliders))sliders[key].disabled=playButtons[key].disabled=value||!mixers[key];}
function placeholders(){if(!exterior)return;canvas.dataset.placeholderMask=JSON.stringify(placeholderMask.select(current?.cell??null));exterior.scene.traverse(o=>{if(/_stairhead_SW$/.test(o.name))o.visible=!current?.cell.startsWith('cell_stair');});wings?.scene.traverse(o=>{if(/_W1_backing_dark$/.test(o.name))o.visible=!current?.cell.startsWith('cell_cinema');});}
function clearCell(){hallAmbientLook?.dispose();hallAmbientLook=null;delete canvas.dataset.hallAO;hallLampLook?.dispose();hallLampLook=null;delete canvas.dataset.hallLamp;hallWallLook?.dispose();hallWallLook=null;delete canvas.dataset.hallWall;hallFloorLook?.dispose();hallFloorLook=null;delete canvas.dataset.hallFloor;hallDirectionalLook?.dispose();hallDirectionalLook=null;delete canvas.dataset.hallDirectional;Object.values(mixers).forEach(m=>m.dispose());mixers={};for(const [key,slider]of Object.entries(sliders)){slider.value='0';slider.oninput=null;playButtons[key].onclick=null;}delete canvas.dataset.gateProgress;delete canvas.dataset.cinemaProposal;delete canvas.dataset.hallProposal;delete canvas.dataset.liftProposal;delete canvas.dataset.hallStream;if(current){scene.remove(current.model.scene);if(!current.model.prefetchedHall)release(current.model);current=null;}placeholders();}
async function streamHall(name){canvas.dataset.hallStreamReleased='0';return loadStreamedCell(hallStreamParts(hallStreamReceipt,name),{load:file=>loader.loadAsync(hallStreamBase+file+(query.has('hallstreamfail')&&file.endsWith('-desk.glb')?'.missing':'')),createScene:()=>new THREE.Group(),release:model=>{release(model);canvas.dataset.hallStreamReleased=String(Number(canvas.dataset.hallStreamReleased)+1);}});}
function prefetchAt(position){if(!roomPrefetch||current)return;const name='cell_hall'+(dream.checked?'_dream':''),near=nearStudyPortal(position,hallPortal,roomPrefetch.snapshot().desired===name);roomPrefetch.select(near?name:null).catch(()=>{});canvas.dataset.hallPrefetch=JSON.stringify(roomPrefetch.snapshot());}
function gates(){mixers={};for(const [key,slider]of Object.entries(sliders)){slider.value='0';const wing=key.startsWith('wing'),model=wing?exterior:current?.model;if(!model)continue;const clipKey=wing?'door_wing_'+key.slice(-1):key==='car'?'car_gate':'landing_gate';const playback=createTowerGatePlayback(THREE,model,clipKey);if(!playback)continue;mixers[key]=playback;playback.scrub(0);slider.oninput=()=>{playback.scrub(Number(slider.value));request();};playButtons[key].onclick=()=>{playback.play();lastTime=null;request();};}}
function instances(){
 const bulbs=exterior.scene.getObjectByName('TB_EXT_LOD'+activeLOD+'_bulb');if(bulbs)try{const result=repeatedMeshInstances(bulbs,{trianglesPerInstance:8});bulbs.parent.add(result.mesh);bulbs.parent.remove(bulbs);bulbs.geometry.dispose();canvas.dataset.bulbInstances=JSON.stringify(result.stats);}catch(error){canvas.dataset.bulbInstances=JSON.stringify({retainedOriginal:true,reason:error.message});}
 const trim=exterior.scene.getObjectByName('TB_EXT_LOD'+activeLOD+'_trim');if(activeLOD===0&&trim)try{const result=createTowerBalusterInstances(THREE,trim,manifest.balusterPlacements,repeatedMeshInstances),old=trim.geometry;trim.geometry=result.remaining;trim.parent.add(result.mesh);old.dispose();canvas.dataset.balusterInstances=JSON.stringify(result.stats);}catch(error){canvas.dataset.balusterInstances=JSON.stringify({retainedOriginal:true,reason:error.message});}
}
async function assembly(lod,token){
 if(exterior&&activeLOD===lod)return true;
 const models=[];try{models.push(await loader.loadAsync(base+'TB_EXT_LOD'+lod+'.glb'));if(review==='115')models.push(await loader.loadAsync(base+'TW_LOD'+lod+'.glb'));}catch(error){models.forEach(release);throw error;}
 if(disposed||token!==epoch){models.forEach(release);return false;}
 placeholderMask?.dispose();for(const model of [exterior,wings])if(model){scene.remove(model.scene);release(model);}
 [exterior,wings]=models;activeLOD=lod;instances();scene.add(exterior.scene);if(wings)scene.add(wings.scene);placeholderMask=createTowerPlaceholderMask(THREE,exterior.scene);placeholders();canvas.dataset.lod=String(lod);canvas.dataset.wings=wings?'TW_LOD'+lod:'empty';return true;
}
async function select(){
 const token=++epoch;ready=false;canvas.dataset.ready='false';intervals.length=0;cancel();locked(true);status.textContent='部屋を準備中…';
 // Serialization prevents releasing geometry while compileAsync still uses it.
 pending=pending.catch(()=>{}).then(async()=>{
  if(disposed||token!==epoch)return;clearCell();const config=views[view.value];blockedCell=false;
  const hallEV=hallExposure&&config.cell==='hall'&&!dream.checked?-1.25:0;renderer.toneMappingExposure=1.15*Math.pow(2,hallEV);if(hallExposure)canvas.dataset.hallExposure=JSON.stringify({ev:hallEV,sourceExposure:1.15,visualAcceptance:false,handoff:119});
  if(mobile){const exteriorCheck=checkPhoneAssembly(manifest.parts);if(!exteriorCheck.allowed)throw new Error('軽量版の外観データを確認できません。');const name=config.cell?'cell_'+config.cell+(dream.checked?'_dream':''):null;const check=checkPhoneAssembly(manifest.parts,name);blockedCell=!check.allowed;canvas.dataset.phoneBudget=JSON.stringify(check);canvas.dataset.blockedCell=blockedCell?name:'none';}
  if(!await assembly(mobile?2:config.lod??0,token))return;camera.position.fromArray(config.pos);controls.target.fromArray(config.target);controls.update();
  if(hallPrefetch&&config.cell!=='hall'){if(config.cell)await roomPrefetch.select(null);else prefetchAt(config.pos);}
  if(config.cell&&!blockedCell){const name='cell_'+config.cell+(dream.checked?'_dream':''),candidate=cinemaProposal&&config.cell==='cinema',hallCandidate=hallProposal&&config.cell==='hall',streamCandidate=hallStream&&config.cell==='hall',liftCandidate=liftProposal&&config.cell==='lift',start=performance.now(),model=streamCandidate?(hallPrefetch?await roomPrefetch.select(name):await streamHall(name)):await loader.loadAsync(candidate?proposalBase+name+'-lossless-meshopt.glb':hallCandidate?hallBase+name+'-retained.glb':liftCandidate?liftBase+name+'-retained.glb':base+name+'.glb');
   if(disposed||token!==epoch){if(model&&!model.prefetchedHall)release(model);return;}
   model.scene.position.fromArray(placement[config.cell]);if(config.cell==='cinema')model.scene.rotation.y=Math.PI;
   let localLights=0;if(!model.prefetchedHall||!hallGainApplied.has(model)){model.scene.traverse(o=>{if(o.isLight){o.intensity*=.003;if(mobile&&++localLights>4)o.visible=false;}});if(model.prefetchedHall)hallGainApplied.add(model);}current={cell:name,model};scene.add(model.scene);canvas.dataset.loadDecodeMs=String(performance.now()-start);placeholders();
   if(hallDirectional&&config.cell==='hall'){hallDirectionalLook=createHallDirectionalLook(model);canvas.dataset.hallDirectional=JSON.stringify(hallDirectionalLook.apply(!dream.checked));}
   if(hallFloorMode!==null&&config.cell==='hall'&&!dream.checked){hallFloorLook=createHallFloorLook(model,{mode:hallFloorMode,createMaterial:cloneHallFloorMaterial,decorateWear:decorateHallFloorWear});canvas.dataset.hallFloor=JSON.stringify(hallFloorLook.stats);}
   if(hallWallMode!==null&&config.cell==='hall'&&!dream.checked){hallWallLook=createHallWallLook(model,{mode:hallWallMode,createMaterial:cloneHallWallMaterial,decorateWear:decorateHallWallWear});canvas.dataset.hallWall=JSON.stringify(hallWallLook.stats);}
   if(hallLampMode!==null&&config.cell==='hall'&&!dream.checked){hallLampLook=createHallLampLook(model,{mode:hallLampMode,pointGain:hallPointGain});canvas.dataset.hallLamp=JSON.stringify(hallLampLook.stats);}
   if(candidate){const receipt=proposalReceipt.find(r=>r.cell===name);canvas.dataset.cinemaProposal=JSON.stringify({codec:'EXT_meshopt_compression',bytes:receipt.compressedBytes,sha256:receipt.sha256,visualAcceptance:false});}else delete canvas.dataset.cinemaProposal;
   if(hallCandidate){const receipt=hallReceipt.find(r=>r.cell===name);canvas.dataset.hallProposal=JSON.stringify({bytes:receipt.bytes,sha256:receipt.sha256,visualAcceptance:false});}
   if(liftCandidate){const receipt=liftReceipt.find(r=>r.cell===name);canvas.dataset.liftProposal=JSON.stringify({bytes:receipt.bytes,sha256:receipt.sha256,visualAcceptance:false});}
   if(streamCandidate)canvas.dataset.hallStream=JSON.stringify({parts:model.streamParts,bytes:model.streamParts.reduce((n,p)=>n+p.bytes,0),sourceQualityPreserved:true,visualAcceptance:false});else delete canvas.dataset.hallStream;
  }
  gates();
  if(disposed||token!==epoch)return;preparing=true;const start=performance.now();try{await renderer.compileAsync(scene,camera);}finally{preparing=false;}
  if(disposed||token!==epoch)return;canvas.dataset.compileMs=String(performance.now()-start);ready=true;canvas.dataset.ready='false';canvas.dataset.viewRevision=String(token);canvas.dataset.cell=current?.cell??'empty';canvas.dataset.backend=renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2';locked(false);request();
 }).catch(fail);await pending;
}
function renderStudy(){
 const autoReset=renderer.info.autoReset,callStart=renderer.info.render.calls;renderer.info.autoReset=false;renderer.info.reset();
 try{
  if(hallAO&&current?.cell.startsWith('cell_hall')&&!dream.checked){hallAmbientLook??=createHallAmbientLook(renderer,scene,camera);hallAmbientLook.render();canvas.dataset.hallAO=JSON.stringify({radius:.35,thickness:.35,resolutionScale:.5,beautyAntialias:true,indirectOnly:true,opaqueDepthOnly:true,counters:'renderer-reported multipass; fullscreen qualification pending',visualAcceptance:false});}
  else{renderer.render(scene,camera);delete canvas.dataset.hallAO;}
 }finally{canvas.dataset.renderCalls=String(renderer.info.render.calls-callStart);renderer.info.autoReset=autoReset;}
}
function draw(time){
 frame=null;if(!ready||disposed||document.hidden)return;
 try{
  const cpu=performance.now(),delta=lastTime===null?0:Math.max(0,(time-lastTime)/1000);let moving=false;
  for(const [key,playback]of Object.entries(mixers)){moving=playback.update(delta)||moving;sliders[key].value=String(playback.snapshot().progress);}
  canvas.dataset.gatePlayback=JSON.stringify(Object.fromEntries(Object.entries(mixers).map(([k,p])=>[k,p.snapshot()])));
  controls.update();renderStudy();frames++;
  if(mobile&&(renderer.info.render.triangles>PHONE_BUDGET.triangles||renderer.info.render.drawCalls>PHONE_BUDGET.draws)){clearCell();throw new Error('実際の描画が軽量版の予算を超えました。外観へ戻してください。');}
  canvas.dataset.frames=String(frames);canvas.dataset.cpuSubmitMs=String(performance.now()-cpu);
  canvas.dataset.draws=String(renderer.info.render.drawCalls);canvas.dataset.triangles=String(renderer.info.render.triangles);canvas.dataset.ready='true';
  canvas.dataset.viewport=JSON.stringify({width:canvas.width,height:canvas.height,clientWidth:canvas.clientWidth,clientHeight:canvas.clientHeight,visibility:document.visibilityState});
  if(measure.checked&&lastTime!==null){intervals.push(time-lastTime);if(intervals.length>240)intervals.shift();}
  lastTime=time;canvas.dataset.frameIntervals=JSON.stringify(intervals);
  status.textContent=`${canvas.dataset.backend} · ${current?.cell??'外観'} · ${width}×${height}${mobile?' · スマートフォン用の検証候補':''}${blockedCell?' · この部屋の軽量版は制作中です':''}${canvas.dataset.hallStream?' · 元の素材を保った部屋の分割候補（未承認）':''}${canvas.dataset.cinemaProposal?' · 活動写真館の圧縮・修正候補（未承認）':''}${canvas.dataset.hallProposal?' · 西翼入口の修正候補（未承認）':''}`;
  metrics.textContent=`${frames}回描画 · ${renderer.info.render.triangles}tri · 歩行・衝突・本番配信は未実装`;
  if(measure.checked||moving)request();
 }catch(error){fail(error);}
}
controls.addEventListener('change',()=>{if(ready&&!preparing)prefetchAt(camera.position.toArray());request();});view.addEventListener('change',select);dream.addEventListener('change',select);measure.addEventListener('change',()=>{intervals.length=0;lastTime=null;request();});
if(mobile)addEventListener('resize',()=>{[width,height]=phoneBuffer(innerWidth,innerHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();request();});
capture.addEventListener('click',async()=>{locked(true);cancel();try{if(document.hidden||!ready)throw new Error('表示・描画完了後に保存してください。');renderStudy();captureWait=waitCaptureFrame({request:requestAnimationFrame,cancel:cancelAnimationFrame});await captureWait.promise;captureWait=null;renderStudy();await settleGPU();if(disposed||document.hidden||canvas.dataset.error)throw new Error('保存を中止しました。');captureWait=encodeCanvasPng(canvas);const blob=await captureWait.promise;captureWait=null;if(!blob||disposed)throw new Error('画像を保存できませんでした。');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`tower-base-${review}-${view.value}-${dream.checked?'dream':'base'}-${width}x${height}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);canvas.dataset.capture='saved';}catch(error){status.textContent=error.message;canvas.dataset.capture='failed';}finally{if(!disposed){locked(!ready);request();}}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();captureWait?.cancel();}else request();});
window.addEventListener('pagehide',event=>{cancel();captureWait?.cancel();if(event.persisted)return;disposed=true;epoch++;Promise.allSettled([initializing,pending]).then(async()=>{clearCell();try{await roomPrefetch?.dispose();}finally{placeholderMask?.dispose();release(exterior);release(wings);controls.dispose();renderer.dispose();}});});
initializing=(async()=>{try{await renderer.init();if(disposed)throw new DOMException('Page left','AbortError');if(renderer.backend.isWebGPUBackend)renderer.backend.device.addEventListener('uncapturederror',event=>fail(event.error));
 manifest=await fetch(base+(mobileTextures?'phone-manifest.json':'manifest.json')).then(r=>{if(!r.ok)throw new Error('manifest '+r.status);return r.json();});canvas.dataset.sourceRevision=manifest.revision;
 if(cinemaProposal){proposalReceipt=await fetch(proposalBase+'lossless-summary.json').then(r=>{if(!r.ok)throw new Error('cinema receipt '+r.status);return r.json();});if(!['cell_cinema','cell_cinema_dream'].every(cell=>proposalReceipt.some(r=>r.cell===cell&&r.compressedBytes<=26214400&&/^[a-f0-9]{64}$/.test(r.sha256))))throw new Error('Invalid cinema compression receipt');}
 if(hallProposal){hallReceipt=await fetch(hallBase+'split-summary.json').then(r=>{if(!r.ok)throw new Error('hall receipt '+r.status);return r.json();});if(!['cell_hall','cell_hall_dream'].every(cell=>hallReceipt.some(r=>r.cell===cell&&r.bytes<=26214400&&/^[a-f0-9]{64}$/.test(r.sha256))))throw new Error('Invalid hall receipt');}
 if(hallStream){hallStreamReceipt=await fetch(hallStreamBase+'stream-summary.json').then(r=>{if(!r.ok)throw new Error('hall stream receipt '+r.status);return r.json();});for(const cell of ['cell_hall','cell_hall_dream'])hallStreamParts(hallStreamReceipt,cell);}
 if(hallAO)createHallAmbientLook=(await import('./hall-ambient-look.mjs')).createHallAmbientLook;
 if(hallFloorMode!==null){if(!['control','roughness','wear'].includes(hallFloorMode))throw new Error('Invalid hall floor comparison mode');({createHallFloorLook}=await import('./hall-floor-look.mjs'));({cloneHallFloorMaterial,decorateHallFloorWear}=await import('./hall-floor-wear.mjs'));}
 if(hallWallMode!==null){if(!['control','wear'].includes(hallWallMode))throw new Error('Invalid hall wall comparison mode');({createHallWallLook}=await import('./hall-wall-look.mjs'));({cloneHallWallMaterial,decorateHallWallWear}=await import('./hall-wall-wear.mjs'));}
 if(hallLampMode!==null){if(!['control','colour'].includes(hallLampMode)||![1,.7,.5,.35].includes(hallPointGain)||(hallLampMode==='control'&&hallPointGain!==1))throw new Error('Invalid hall lamp comparison mode');({createHallLampLook}=await import('./hall-lamp-look.mjs'));}
 if(hallPrefetch)roomPrefetch=createRoomPrefetch({plans:['cell_hall','cell_hall_dream'].map(id=>{const parts=hallStreamParts(hallStreamReceipt,id);return {id,bytes:parts.reduce((n,p)=>n+p.bytes,0),textureBytes:parts.reduce((n,p)=>n+p.estimatedTextureBytes,0)};}),load:async name=>{const model=await streamHall(name);model.prefetchedHall=true;return model;},release:model=>{release(model);canvas.dataset.hallPrefetchReleases=String(Number(canvas.dataset.hallPrefetchReleases??0)+1);},onChange:snapshot=>{canvas.dataset.hallPrefetch=JSON.stringify(snapshot);}});
 if(liftProposal){liftReceipt=await fetch(liftBase+'split-summary.json').then(r=>{if(!r.ok)throw new Error('lift receipt '+r.status);return r.json();});if(!['cell_lift','cell_lift_dream'].every(cell=>liftReceipt.some(r=>r.cell===cell&&r.bytes<=26214400&&/^[a-f0-9]{64}$/.test(r.sha256))))throw new Error('Invalid lift receipt');}
 await select();
}catch(error){fail(error);}})();
