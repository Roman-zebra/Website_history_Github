import * as THREE from 'three/webgpu';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {waitCaptureFrame,encodeCanvasPng} from './capture-frame.mjs';
import {repeatedMeshInstances} from './repeated-mesh-instances.mjs';
import {createTowerBalusterInstances} from './tower-baluster-instances.mjs';
import {createTowerGatePlayback} from './tower-gate-playback.mjs';
const canvas=document.querySelector('#view'),status=document.querySelector('#status'),metrics=document.querySelector('#metrics');
const view=document.querySelector('#viewpoint'),dream=document.querySelector('#dream'),measure=document.querySelector('#measure'),capture=document.querySelector('#capture');
const sliders={car:document.querySelector('#car'),landing:document.querySelector('#landing')};
const playButtons={car:document.querySelector('#carPlay'),landing:document.querySelector('#landingPlay')};
const review=document.documentElement.dataset.towerReview==='115'?'115':'113';
if(review==='115')for(const key of ['wingW','wingE']){sliders[key]=document.querySelector('#'+key);playButtons[key]=document.querySelector('#'+key+'Play');}
const query=new URLSearchParams(location.search),width=query.get('size')==='1080'?1920:1280,height=width*9/16;
const renderer=new THREE.WebGPURenderer({canvas,antialias:true,forceWebGL:query.has('webgl')});renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x99a9b5);scene.add(new THREE.HemisphereLight(0xdce7f1,0x72614e,1.2));
const sun=new THREE.DirectionalLight(0xffe2ba,3);sun.position.set(-20,40,30);scene.add(sun);
const camera=new THREE.PerspectiveCamera(50,width/height,.05,350),controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.maxDistance=200;
const loader=new GLTFLoader(),base='/study/tower-base-'+review+'/';
const placement={hall:[-14.05,.15,8.6],stair:[-14.05,.15,12.55],lift:[-2.2,15.15,2.2],cinema:[-14.95,.15,-8.55]};
const views={north:{pos:[0,10,-48],target:[0,11,0]},hall:{cell:'hall',pos:[-12.275,1.65,6.9],target:[-12.275,1.8,-3]},stair:{cell:'stair',pos:[-11.03,1.55,12.03],target:[-12.6,3,10.8]},head:{cell:'stair',pos:[-11.15,16.65,9.6],target:[-12.7,15.8,11.8]},lift:{cell:'lift',pos:[-1.2,16.7,1.8],target:[.3,16.8,-.7]},cinema:{cell:'cinema',pos:[-20,1.8,0],target:[-46,3,0]}};
if(review==='115')Object.assign(views,{north:{pos:[0,17,-85],target:[0,8,0]},far:{lod:2,pos:[0,30,-145],target:[0,8,0]},wingW:{cell:'hall',pos:[-11.4,1.65,-.3],target:[-17,1.65,-.3]},wingE:{pos:[12,1.65,.3],target:[18,1.65,.3]},exit:{cell:'cinema',pos:[-29.45,1.65,11.7],target:[-29.45,1.65,5.5]}});
let exterior,wings,manifest,activeLOD=0,current=null,epoch=0,frame=null,disposed=false,preparing=false,ready=false,captureWait=null,pending=Promise.resolve(),initializing;
let frames=0,lastTime=null,mixers={};const intervals=[];
const fail=error=>{if(disposed)return;canvas.dataset.error=error.message;canvas.dataset.ready='false';ready=false;status.textContent='検証失敗：'+error.message;console.error(error);};
function release(model){if(!model)return;const gs=new Set(),ms=new Set(),ts=new Set();model.scene.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)gs.add(o.geometry);for(const m of [].concat(o.material??[]))ms.add(m);});for(const m of ms){for(const t of Object.values(m))if(t?.isTexture)ts.add(t);m.dispose();}for(const t of ts){t.dispose();t.source?.data?.close?.();}gs.forEach(g=>g.dispose());}
function request(){if(!disposed&&ready&&!preparing&&!document.hidden&&frame===null)frame=requestAnimationFrame(draw);}
function cancel(){if(frame!==null)cancelAnimationFrame(frame);frame=null;lastTime=null;}
async function settleGPU(){const queue=renderer.backend.isWebGPUBackend?renderer.backend.device?.queue:null;if(!queue)return;let timer;try{await Promise.race([queue.onSubmittedWorkDone(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('GPUの画像保存待機が終了しませんでした。')),5000);})]);}finally{clearTimeout(timer);}}
function locked(value){view.disabled=dream.disabled=measure.disabled=capture.disabled=value;controls.enabled=!value;for(const key of Object.keys(sliders))sliders[key].disabled=playButtons[key].disabled=value||!mixers[key];}
function placeholders(){if(!exterior)return;exterior.scene.traverse(o=>{if(/_backing|_curtain/.test(o.name))o.visible=!current;if(/_stairhead_SW$/.test(o.name))o.visible=!current?.cell.startsWith('cell_stair');});wings?.scene.traverse(o=>{if(/_W1_backing_dark$/.test(o.name))o.visible=!current?.cell.startsWith('cell_cinema');});}
function clearCell(){Object.values(mixers).forEach(m=>m.dispose());mixers={};for(const [key,slider]of Object.entries(sliders)){slider.value='0';slider.oninput=null;playButtons[key].onclick=null;}delete canvas.dataset.gateProgress;if(current){scene.remove(current.model.scene);release(current.model);current=null;}placeholders();}
function gates(){mixers={};for(const [key,slider]of Object.entries(sliders)){slider.value='0';const wing=key.startsWith('wing'),model=wing?exterior:current?.model;if(!model)continue;const clipKey=wing?'door_wing_'+key.slice(-1):key==='car'?'car_gate':'landing_gate';const playback=createTowerGatePlayback(THREE,model,clipKey);if(!playback)continue;mixers[key]=playback;playback.scrub(0);slider.oninput=()=>{playback.scrub(Number(slider.value));request();};playButtons[key].onclick=()=>{playback.play();lastTime=null;request();};}}
function instances(){
 const bulbs=exterior.scene.getObjectByName('TB_EXT_LOD'+activeLOD+'_bulb');if(bulbs)try{const result=repeatedMeshInstances(bulbs,{trianglesPerInstance:8});bulbs.parent.add(result.mesh);bulbs.parent.remove(bulbs);bulbs.geometry.dispose();canvas.dataset.bulbInstances=JSON.stringify(result.stats);}catch(error){canvas.dataset.bulbInstances=JSON.stringify({retainedOriginal:true,reason:error.message});}
 const trim=exterior.scene.getObjectByName('TB_EXT_LOD'+activeLOD+'_trim');if(activeLOD===0&&trim)try{const result=createTowerBalusterInstances(THREE,trim,manifest.balusterPlacements,repeatedMeshInstances),old=trim.geometry;trim.geometry=result.remaining;trim.parent.add(result.mesh);old.dispose();canvas.dataset.balusterInstances=JSON.stringify(result.stats);}catch(error){canvas.dataset.balusterInstances=JSON.stringify({retainedOriginal:true,reason:error.message});}
}
async function assembly(lod,token){
 if(exterior&&activeLOD===lod)return true;
 const models=[];try{models.push(await loader.loadAsync(base+'TB_EXT_LOD'+lod+'.glb'));if(review==='115')models.push(await loader.loadAsync(base+'TW_LOD'+lod+'.glb'));}catch(error){models.forEach(release);throw error;}
 if(disposed||token!==epoch){models.forEach(release);return false;}
 for(const model of [exterior,wings])if(model){scene.remove(model.scene);release(model);}
 [exterior,wings]=models;activeLOD=lod;instances();scene.add(exterior.scene);if(wings)scene.add(wings.scene);canvas.dataset.lod=String(lod);canvas.dataset.wings=wings?'TW_LOD'+lod:'empty';return true;
}
async function select(){
 const token=++epoch;ready=false;canvas.dataset.ready='false';intervals.length=0;cancel();locked(true);status.textContent='部屋を準備中…';
 // Serialization prevents releasing geometry while compileAsync still uses it.
 pending=pending.catch(()=>{}).then(async()=>{
  if(disposed||token!==epoch)return;clearCell();const config=views[view.value];if(!await assembly(config.lod??0,token))return;camera.position.fromArray(config.pos);controls.target.fromArray(config.target);controls.update();
  if(config.cell){const name='cell_'+config.cell+(dream.checked?'_dream':''),start=performance.now(),model=await loader.loadAsync(base+name+'.glb');
   if(disposed||token!==epoch){release(model);return;}
   model.scene.position.fromArray(placement[config.cell]);if(config.cell==='cinema')model.scene.rotation.y=Math.PI;
   model.scene.traverse(o=>{if(o.isLight)o.intensity*=.003;});current={cell:name,model};scene.add(model.scene);canvas.dataset.loadDecodeMs=String(performance.now()-start);placeholders();
  }
  gates();
  if(disposed||token!==epoch)return;preparing=true;const start=performance.now();try{await renderer.compileAsync(scene,camera);}finally{preparing=false;}
  if(disposed||token!==epoch)return;canvas.dataset.compileMs=String(performance.now()-start);ready=true;canvas.dataset.ready='false';canvas.dataset.viewRevision=String(token);canvas.dataset.cell=current?.cell??'empty';canvas.dataset.backend=renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2';locked(false);request();
 }).catch(fail);await pending;
}
function draw(time){
 frame=null;if(!ready||disposed||document.hidden)return;
 try{
  const cpu=performance.now(),delta=lastTime===null?0:Math.max(0,(time-lastTime)/1000);let moving=false;
  for(const [key,playback]of Object.entries(mixers)){moving=playback.update(delta)||moving;sliders[key].value=String(playback.snapshot().progress);}
  canvas.dataset.gatePlayback=JSON.stringify(Object.fromEntries(Object.entries(mixers).map(([k,p])=>[k,p.snapshot()])));
  controls.update();renderer.render(scene,camera);frames++;
  canvas.dataset.frames=String(frames);canvas.dataset.cpuSubmitMs=String(performance.now()-cpu);
  canvas.dataset.draws=String(renderer.info.render.drawCalls);canvas.dataset.triangles=String(renderer.info.render.triangles);canvas.dataset.ready='true';
  canvas.dataset.viewport=JSON.stringify({width:canvas.width,height:canvas.height,clientWidth:canvas.clientWidth,clientHeight:canvas.clientHeight,visibility:document.visibilityState});
  if(measure.checked&&lastTime!==null){intervals.push(time-lastTime);if(intervals.length>240)intervals.shift();}
  lastTime=time;canvas.dataset.frameIntervals=JSON.stringify(intervals);
  status.textContent=`${canvas.dataset.backend} · ${current?.cell??'外観'} · ${width}×${height}`;
  metrics.textContent=`${frames}回描画 · ${renderer.info.render.triangles}tri · 歩行・衝突・本番配信は未実装`;
  if(measure.checked||moving)request();
 }catch(error){fail(error);}
}
controls.addEventListener('change',request);view.addEventListener('change',select);dream.addEventListener('change',select);measure.addEventListener('change',()=>{intervals.length=0;lastTime=null;request();});
capture.addEventListener('click',async()=>{locked(true);cancel();try{if(document.hidden||!ready)throw new Error('表示・描画完了後に保存してください。');renderer.render(scene,camera);captureWait=waitCaptureFrame({request:requestAnimationFrame,cancel:cancelAnimationFrame});await captureWait.promise;captureWait=null;renderer.render(scene,camera);await settleGPU();if(disposed||document.hidden||canvas.dataset.error)throw new Error('保存を中止しました。');captureWait=encodeCanvasPng(canvas);const blob=await captureWait.promise;captureWait=null;if(!blob||disposed)throw new Error('画像を保存できませんでした。');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`tower-base-${review}-${view.value}-${dream.checked?'dream':'base'}-${width}x${height}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);canvas.dataset.capture='saved';}catch(error){status.textContent=error.message;canvas.dataset.capture='failed';}finally{if(!disposed){locked(!ready);request();}}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();captureWait?.cancel();}else request();});
window.addEventListener('pagehide',event=>{cancel();captureWait?.cancel();if(event.persisted)return;disposed=true;epoch++;Promise.allSettled([initializing,pending]).then(()=>{clearCell();release(exterior);release(wings);controls.dispose();renderer.dispose();});});
initializing=(async()=>{try{await renderer.init();if(disposed)throw new DOMException('Page left','AbortError');if(renderer.backend.isWebGPUBackend)renderer.backend.device.addEventListener('uncapturederror',event=>fail(event.error));
 manifest=await fetch(base+'manifest.json').then(r=>{if(!r.ok)throw new Error('manifest '+r.status);return r.json();});canvas.dataset.sourceRevision=manifest.revision;await select();
}catch(error){fail(error);}})();
