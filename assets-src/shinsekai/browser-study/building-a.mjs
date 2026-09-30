import * as THREE from 'three/webgpu';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createInteriorCells} from './interior-cells.mjs';
import {createPeriodGlassMaterial} from './interior-mapping.mjs';
import {waitCaptureFrame,encodeCanvasPng} from './capture-frame.mjs';
import {connectShopFloor} from './shop-floor.mjs';
import {createShopDreamLook} from './shop-dream-look.mjs';
import {createShopDreamLayer} from './shop-dream-layer.mjs';

const base='../eval-building-a/hybrid/',canvas=document.querySelector('#view'),status=document.querySelector('#status'),metrics=document.querySelector('#metrics');
const select=document.querySelector('#viewpoint'),glassCheck=document.querySelector('#clearGlass');
const dreamCheck=document.querySelector('#dreamLook');
// Opt-in comparison: compileAsync still increases total readiness time here.
const precompile=new URLSearchParams(location.search).has('precompile');
const capture=document.querySelector('#capture');
const buttons={cash:document.querySelector('#cash'),storage:document.querySelector('#storage')};
const renderer=new THREE.WebGPURenderer({canvas,antialias:true,forceWebGL:new URLSearchParams(location.search).has('webgl')});
renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.1;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x8a9ba7);
const camera=new THREE.PerspectiveCamera(45,1,.03,150);camera.position.set(24,15,27);
const controls=new OrbitControls(camera,canvas);controls.target.set(3,2,-4.5);controls.enableDamping=true;controls.minDistance=.15;controls.maxDistance=65;
const hemi=new THREE.HemisphereLight(0xd7e3ee,0x655044,.8);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffd3a1,3);sun.position.set(3,12,12);sun.target.position.set(3,0,-4.5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.5,far:40});sun.shadow.normalBias=.01;sun.shadow.bias=-.0001;scene.add(sun,sun.target);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(140,140),new THREE.MeshStandardMaterial({color:0x706654,roughness:.9}));ground.rotation.x=-Math.PI/2;ground.position.y=-.02;ground.receiveShadow=true;scene.add(ground);
const loader=new GLTFLoader(),glass=createPeriodGlassMaterial(),assets=[],exteriors=new Map(),drawers=new Map();
let manifest,shots,cells,exterior=null,interior=null,currentLOD=null,requestedLOD=null,lodEpoch=0,frame=null,disposed=false,ready=false,lastTime=null,frames=0,envTarget=null,capturing=false,captureWait=null;
let floorLook=null,dreamLook=null;
let dreamModel=null;
const dreamLayer=createShopDreamLayer({load:()=>load('dream'),attach:model=>{dreamModel=model;scene.add(model.scene);applyGlass();prepareScene('dream');request();},release:model=>{scene.remove(model.scene);if(dreamModel===model)dreamModel=null;release(model);},onChange:request});
let preparationQueue=Promise.resolve(),preparations=0,preparationPaused=false;
const preparationHistory=[];
function prepareScene(reason){
 if(!precompile)return;
 preparations++;cancel();controls.enabled=false;
 select.disabled=glassCheck.disabled=dreamCheck.disabled=capture.disabled=true;Object.values(buttons).forEach(b=>b.disabled=true);
 canvas.dataset.preparation='queued';status.textContent='描画を準備中…';
 preparationQueue=preparationQueue.then(async()=>{
  if(disposed||!ready)return;if(document.hidden){preparationPaused=true;return;}
  // Let the loading message paint before node translation/driver compilation.
  const paint=waitCaptureFrame({request:requestAnimationFrame,cancel:cancelAnimationFrame});await paint.promise;
  if(disposed)return;if(document.hidden){preparationPaused=true;return;}
  const start=performance.now();canvas.dataset.preparation='compiling';
  await renderer.compileAsync(scene,camera,null,event=>{
   if(disposed)return;status.textContent=`描画を準備中 ${event.loaded}/${event.total}`;
   canvas.dataset.compilationProgress=JSON.stringify({loaded:event.loaded,total:event.total});
  });
  preparationHistory.push({reason,compileMs:performance.now()-start,visibility:document.visibilityState});if(preparationHistory.length>24)preparationHistory.shift();
  canvas.dataset.preparationHistory=JSON.stringify(preparationHistory);
 }).catch(error=>{if(!disposed){if(document.hidden){preparationPaused=true;return;}canvas.dataset.rendererError=error.message;ready=false;status.textContent='描画準備失敗：再読み込みしてください。';}}).finally(()=>{
  preparations--;
  if(!disposed&&!preparations){canvas.dataset.preparation=preparationPaused?'paused':ready?'prepared':'failed';controls.enabled=true;select.disabled=glassCheck.disabled=dreamCheck.disabled=false;Object.entries(buttons).forEach(([k,b])=>b.disabled=!drawers.has(k));request();}
 });
}
function render(time=performance.now()){if(dreamCheck.checked){dreamLook??=createShopDreamLook(renderer,scene,camera);dreamLook.render(time);}else renderer.render(scene,camera);canvas.dataset.look=dreamCheck.checked?'dream':'base';}
async function settleGPU(){
 const queue=renderer.backend.isWebGPUBackend?renderer.backend.device?.queue:null;if(!queue)return;
 let timer;try{await Promise.race([queue.onSubmittedWorkDone(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('画像保存のGPU待機が完了しませんでした。')),5000);})]);}finally{clearTimeout(timer);}
}
function request(){if(ready&&!disposed&&!capturing&&!document.hidden&&frame===null)frame=requestAnimationFrame(draw);}
function cancel(){if(frame!==null)cancelAnimationFrame(frame);frame=null;lastTime=null;}
function meshes(model,fn){model.scene.traverse(o=>{if(o.isMesh)fn(o);});}
function release(model){
 const geometries=new Set(),materials=new Set(),textures=new Set();meshes(model,o=>{geometries.add(o.geometry);for(const m of [].concat(o.material,o.userData.authoringMaterial??[]))if(m&&m!==glass)materials.add(m);});
 for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}for(const t of textures){t.dispose();t.source?.data?.close?.();}for(const g of geometries)g.dispose();
}
async function load(part){
 const loadStart=performance.now();
 const gltf=await loader.loadAsync(base+'runtime/'+part+'.glb');
 gltf.studyLoadMs=performance.now()-loadStart;
 if(disposed){release(gltf);throw new DOMException('Page left','AbortError');}
 assets.push(part);canvas.dataset.loadedAssets=JSON.stringify(assets);
 meshes(gltf,o=>{o.castShadow=true;o.receiveShadow=true;
  for(const m of [].concat(o.material))if(m.transmission>0){
   // In this r186 study, nested reflector + physical transmission reuses
   // destroyed framebuffer textures on later draws. Use explicitly approximate
   // thin-sheet alpha here; preserve the authored transmission in the GLB.
   m.userData.authoredTransmission=m.transmission;
   m.opacity=Math.min(m.opacity,/^M_Glass$|glass_clear/i.test(m.name)?.18:1-m.transmission*.65);
   m.transmission=0;m.transparent=true;m.depthWrite=false;m.needsUpdate=true;
  }
 });
 // Blender source watts were exported as high candela for its review lighting.
 // Calibrate this separate browser study, without changing the authoring GLB.
 gltf.scene.traverse(o=>{if(o.isPointLight){o.userData.studyLightGain=.003;o.intensity*=.003;o.distance=8;}});
 return gltf;
}
function applyGlass(){
 for(const model of [exterior,interior,dreamModel].filter(Boolean))meshes(model,o=>{
  o.userData.authoringMaterial??=o.material;
  // Preserve the add-on's opal lamp shade and small glassware. The toggle
  // adjusts exterior glazing only, whose separate frame casts the grid shadow.
  const replacement=m=>m.name==='M_Glass'&&glassCheck.checked&&Boolean(interior)?glass:m;
  o.material=Array.isArray(o.userData.authoringMaterial)?o.userData.authoringMaterial.map(replacement):replacement(o.userData.authoringMaterial);
  // Glass does not cast an opaque shadow; the separate frame still does.
  o.castShadow=![].concat(o.material).every(m=>m===glass);
 });request();
}
async function updateLOD(distance){
 let desired=distance<12?0:distance<30?1:2;
 if(currentLOD!==null&&Math.abs(distance-(currentLOD===0?12:currentLOD===2?30:desired===0?12:30))<1.5)desired=currentLOD;
 if(desired===requestedLOD)return;
 requestedLOD=desired;const epoch=++lodEpoch;
 if(!exteriors.has(desired))exteriors.set(desired,load('exterior-lod'+desired).catch(error=>{exteriors.delete(desired);throw error;}));
 try{
  const model=await exteriors.get(desired);if(disposed||epoch!==lodEpoch)return;
  if(exterior)scene.remove(exterior.scene);exterior=model;currentLOD=desired;scene.add(model.scene);applyGlass();prepareScene('exterior-lod'+desired);request();
 }catch(error){if(!disposed&&epoch===lodEpoch){canvas.dataset.loadError=error.message;status.textContent='外観を読み込めませんでした。再読み込みしてください。';}}
}
function bindDrawers(model){
 for(const [id,name] of [['cash','Cash_drawer_slider'],['storage','Stair_drawer_slider']]){
  const node=model.scene.getObjectByName(name);
  const tracks=model.animations.flatMap(a=>a.tracks.filter(t=>t.name===name+'.position'));
  if(!node||!tracks.length)continue;
  const clip=new THREE.AnimationClip('study-'+id,-1,tracks),mixer=new THREE.AnimationMixer(model.scene),action=mixer.clipAction(clip);action.play();action.paused=true;
  drawers.set(id,{mixer,action,clip,progress:0,target:0});buttons[id].disabled=false;buttons[id].textContent=(id==='cash'?'現金引き出し':'階段収納')+'を開く';
 }
}
function pose(){
 const view=select.value;
 controls.enableDamping=false;controls.update();
 if(view==='far'){camera.position.set(24,15,27);controls.target.set(3,2,-4.5);camera.fov=45;}
 else if(view==='floor-study'){camera.position.set(4.55,1.15,-3.7);controls.target.set(4.35,.08,-1.45);camera.fov=55;}
 else{const shot=shots.find(s=>s.file==='base-'+view+'.png');camera.position.set(shot.position[0],shot.position[2],-shot.position[1]);controls.target.set(shot.target[0],shot.target[2],-shot.target[1]);camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(36/(2*shot.lens)/camera.aspect));}
 camera.updateProjectionMatrix();controls.update();controls.enableDamping=true;request();
}
// Fixed review resolution and letterboxed CSS keep live/captured framing equal
// and avoid resizing transmission/reflector render targets while they are used.
function resize(){if(disposed||capturing)return;renderer.setSize(1280,720,false);camera.aspect=1280/720;camera.updateProjectionMatrix();request();}
function draw(time){
 frame=null;if(disposed||document.hidden||capturing||preparations)return;
 try{
  const delta=lastTime===null?0:Math.min((time-lastTime)/1000,.25);lastTime=time;const changed=controls.update();
  cells.update(camera.position.toArray());updateLOD(camera.position.distanceTo(new THREE.Vector3(...manifest.position)));
  dreamLayer.update(dreamCheck.checked&&Boolean(interior),select.value);canvas.dataset.dreamLayer=JSON.stringify(dreamLayer.snapshot());
  let moving=false;
  for(const d of drawers.values()){
   const difference=d.target-d.progress;d.progress+=Math.sign(difference)*Math.min(Math.abs(difference),delta/.65);
   d.action.time=d.progress*d.clip.duration/2;d.mixer.update(0);moving||=d.progress!==d.target;
  }
  const start=performance.now();render(time);const submitMs=performance.now()-start;frames++;
  if(interior&&interior.studyFirstSubmitMs===undefined){interior.studyFirstSubmitMs=submitMs;canvas.dataset.interiorPreparation=JSON.stringify({loadDecodeMs:interior.studyLoadMs,firstSubmitMs:submitMs,precompile,width:canvas.width,height:canvas.height,backend:renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2',view:select.value});}
  canvas.dataset.renderedFrames=String(frames);canvas.dataset.interiorStatus=cells.snapshot()[0].status;canvas.dataset.exteriorLOD=String(currentLOD);
  canvas.dataset.drawerProgress=JSON.stringify(Object.fromEntries([...drawers].map(([k,d])=>[k,d.progress])));
  capture.disabled=currentLOD===null||currentLOD!==requestedLOD||cells.snapshot()[0].status==='loading'||dreamLayer.snapshot().status==='loading';
  if(dreamLayer.snapshot().status==='failed')throw new Error('夢部品の読み込み失敗：'+dreamLayer.snapshot().error);
  status.textContent=`${renderer.backend.isWebGPUBackend?'WebGPU':'WebGL 2'} · 外観LOD${currentLOD??'準備中'} · 室内 ${cells.snapshot()[0].status}`;
  metrics.textContent=`${frames}回描画 · CPU送信 ${submitMs.toFixed(1)}ms · 停止時は追加描画なし。ガラス調整は透過色と微小な波打ちの試作です。`;
  if(changed||moving)request();else lastTime=null;
 }catch(error){canvas.dataset.rendererError=error.message;status.textContent='描画失敗：'+error.message;console.error(error);}
}
controls.addEventListener('change',request);select.addEventListener('change',pose);glassCheck.addEventListener('change',applyGlass);
dreamCheck.addEventListener('change',request);
for(const [id,b] of Object.entries(buttons))b.addEventListener('click',()=>{const d=drawers.get(id);if(!d)return;d.target=d.target?0:1;b.textContent=(id==='cash'?'現金引き出し':'階段収納')+(d.target?'を閉じる':'を開く');lastTime=performance.now();request();});
capture.addEventListener('click',async()=>{
 if(capturing||disposed||document.hidden)return;
 capturing=true;canvas.dataset.capture='pending';cancel();controls.enabled=false;capture.disabled=select.disabled=glassCheck.disabled=dreamCheck.disabled=true;Object.values(buttons).forEach(b=>b.disabled=true);
 try{
  // Finish submitted work before capture. No render target is resized for PNG.
  await settleGPU();
  if(disposed||document.hidden)throw new Error('非表示になったため保存を中止しました。');
  render();captureWait=waitCaptureFrame({request:requestAnimationFrame,cancel:cancelAnimationFrame});await captureWait.promise;captureWait=null;
  if(disposed||document.hidden)throw new Error('非表示になったため保存を中止しました。');
  render();await settleGPU();if(canvas.dataset.rendererError)throw new Error('GPU描画失敗のため保存を中止しました。');captureWait=encodeCanvasPng(canvas);const blob=await captureWait.promise;captureWait=null;
  if(disposed||document.hidden||!blob)throw new Error('画像の保存を完了できませんでした。');
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`building-a-runtime-${select.value}-${glassCheck.checked?'clear':'authored'}-${dreamCheck.checked?'dream':'base'}-1280x720.png`;link.click();canvas.dataset.capture='saved';setTimeout(()=>URL.revokeObjectURL(url),10000);
 }catch(error){canvas.dataset.capture='failed';status.textContent=error.message;}
 finally{
  capturing=false;captureWait=null;
  if(!disposed){controls.enabled=true;select.disabled=glassCheck.disabled=dreamCheck.disabled=false;Object.entries(buttons).forEach(([k,b])=>b.disabled=!drawers.has(k));request();}
 }
});
window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(document.hidden){captureWait?.cancel();cancel();}else{if(preparationPaused){preparationPaused=false;prepareScene('visibility-resume');}request();}});
window.addEventListener('pagehide',event=>{
 captureWait?.cancel();cancel();if(event.persisted)return;disposed=true;lodEpoch++;
 const cleanup=()=>{dreamLayer.dispose();cells?.dispose();drawers.forEach(d=>d.mixer.stopAllAction());for(const promise of exteriors.values())promise.then(release).catch(()=>{});controls.dispose();dreamLook?.dispose();envTarget?.dispose();glass.dispose();ground.geometry.dispose();ground.material.dispose();renderer.dispose();};
 // compileAsync yields between objects. Do not dispose a model while its
 // queued shader jobs still refer to geometry or textures.
 if(preparations)preparationQueue.finally(cleanup);else cleanup();
});window.addEventListener('pageshow',request);
try{
 await renderer.init();if(disposed)throw new DOMException('Page left','AbortError');
 if(renderer.backend.isWebGPUBackend)renderer.backend.device.addEventListener('uncapturederror',event=>{
  if(disposed)return;canvas.dataset.rendererError=event.error.message;ready=false;cancel();capture.disabled=true;status.textContent='GPU描画失敗：再読み込みしてください。';
 });
 // Original studio environment supplies broad glazing/metal reflections. It is
 // inferred review lighting, not an HDR photograph or historic illumination.
 const env=new THREE.Scene();env.background=new THREE.Color(0x536675);
 for(const [position,scale,col] of [[[0,5,0],[6,.1,6],0xffe4bd],[[4,2,1],[.1,4,4],0x829ba8]]){
  const p=new THREE.Mesh(new THREE.BoxGeometry(...scale),new THREE.MeshBasicMaterial({color:col}));p.position.set(...position);env.add(p);
 }
 const pmrem=new THREE.PMREMGenerator(renderer);envTarget=pmrem.fromScene(env,.04,.1,100,{size:128});scene.environment=envTarget.texture;scene.environmentIntensity=.45;pmrem.dispose();env.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
 [manifest,shots]=await Promise.all([fetch(base+'runtime/manifest.json').then(r=>{if(!r.ok)throw new Error('manifest '+r.status);return r.json();}),fetch(base+'review-cameras.json').then(r=>{if(!r.ok)throw new Error('cameras '+r.status);return r.json();})]);
 if(disposed)throw new DOMException('Page left','AbortError');
 cells=createInteriorCells({cells:[{id:'building-a',position:manifest.position}],enter:manifest.enter,leave:manifest.leave,load:()=>load('interior'),attach:(_,model)=>{interior=model;scene.add(model.scene);floorLook=connectShopFloor(scene,model);bindDrawers(model);applyGlass();prepareScene('interior');request();},detach:(_,model)=>{if(interior===model){floorLook?.dispose();floorLook=null;scene.remove(model.scene);drawers.forEach(d=>d.mixer.stopAllAction());drawers.clear();interior=null;Object.values(buttons).forEach(b=>b.disabled=true);applyGlass();}release(model);},onChange:request});
 ready=true;select.disabled=false;resize();request();
}catch(error){if(!disposed){canvas.dataset.rendererError=error.message;status.textContent='準備失敗：'+error.message;console.error(error);}}
