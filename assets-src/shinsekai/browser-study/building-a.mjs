import * as THREE from 'three/webgpu';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createInteriorCells} from './interior-cells.mjs';
import {createPeriodGlassMaterial} from './interior-mapping.mjs';
import {waitCaptureFrame,encodeCanvasPng} from './capture-frame.mjs';

const base='../eval-building-a/hybrid/',canvas=document.querySelector('#view'),status=document.querySelector('#status'),metrics=document.querySelector('#metrics');
const select=document.querySelector('#viewpoint'),glassCheck=document.querySelector('#clearGlass');
const capture=document.querySelector('#capture');
const buttons={cash:document.querySelector('#cash'),storage:document.querySelector('#storage')};
const renderer=new THREE.WebGPURenderer({canvas,antialias:true,forceWebGL:new URLSearchParams(location.search).has('webgl')});
renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.1;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x8a9ba7);
const camera=new THREE.PerspectiveCamera(45,1,.03,150);camera.position.set(24,15,27);
const controls=new OrbitControls(camera,canvas);controls.target.set(3,2,-4.5);controls.enableDamping=true;controls.minDistance=.15;controls.maxDistance=65;
const hemi=new THREE.HemisphereLight(0xd7e3ee,0x655044,2);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffd3a1,3);sun.position.set(7,12,8);sun.target.position.set(3,0,-4.5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.5,far:40});sun.shadow.normalBias=.01;sun.shadow.bias=-.0001;scene.add(sun,sun.target);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(140,140),new THREE.MeshStandardMaterial({color:0x706654,roughness:.9}));ground.rotation.x=-Math.PI/2;ground.position.y=-.02;ground.receiveShadow=true;scene.add(ground);
const loader=new GLTFLoader(),glass=createPeriodGlassMaterial(),assets=[],exteriors=new Map(),drawers=new Map();
let manifest,shots,cells,exterior=null,interior=null,currentLOD=null,requestedLOD=null,lodEpoch=0,frame=null,disposed=false,ready=false,lastTime=null,frames=0,envTarget=null,capturing=false,captureWait=null;
function request(){if(ready&&!disposed&&!capturing&&!document.hidden&&frame===null)frame=requestAnimationFrame(draw);}
function cancel(){if(frame!==null)cancelAnimationFrame(frame);frame=null;lastTime=null;}
function meshes(model,fn){model.scene.traverse(o=>{if(o.isMesh)fn(o);});}
function release(model){
 const geometries=new Set(),materials=new Set(),textures=new Set();meshes(model,o=>{geometries.add(o.geometry);for(const m of [].concat(o.material,o.userData.authoringMaterial??[]))if(m&&m!==glass)materials.add(m);});
 for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}for(const t of textures){t.dispose();t.source?.data?.close?.();}for(const g of geometries)g.dispose();
}
async function load(part){
 const gltf=await loader.loadAsync(base+'runtime/'+part+'.glb');
 if(disposed){release(gltf);throw new DOMException('Page left','AbortError');}
 assets.push(part);canvas.dataset.loadedAssets=JSON.stringify(assets);
 meshes(gltf,o=>{o.castShadow=true;o.receiveShadow=true;});
 // Blender source watts were exported as high candela for its review lighting.
 // Calibrate this separate browser study, without changing the authoring GLB.
 gltf.scene.traverse(o=>{if(o.isPointLight){o.userData.studyLightGain=.003;o.intensity*=.003;o.distance=8;}});
 return gltf;
}
function applyGlass(){
 for(const model of [exterior,interior].filter(Boolean))meshes(model,o=>{
  o.userData.authoringMaterial??=o.material;
  const replacement=m=>/glass/i.test(m.name)&&glassCheck.checked&&Boolean(interior)?glass:m;
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
  if(exterior)scene.remove(exterior.scene);exterior=model;currentLOD=desired;scene.add(model.scene);applyGlass();request();
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
 else{const shot=shots.find(s=>s.file==='base-'+view+'.png');camera.position.set(shot.position[0],shot.position[2],-shot.position[1]);controls.target.set(shot.target[0],shot.target[2],-shot.target[1]);camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(36/(2*shot.lens)/camera.aspect));}
 camera.updateProjectionMatrix();controls.update();controls.enableDamping=true;request();
}
function resize(){if(disposed||capturing)return;const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();request();}
function draw(time){
 frame=null;if(disposed||document.hidden||capturing)return;
 try{
  const delta=lastTime===null?0:Math.min((time-lastTime)/1000,.25);lastTime=time;const changed=controls.update();
  cells.update(camera.position.toArray());updateLOD(camera.position.distanceTo(new THREE.Vector3(...manifest.position)));
  let moving=false;
  for(const d of drawers.values()){
   const difference=d.target-d.progress;d.progress+=Math.sign(difference)*Math.min(Math.abs(difference),delta/.65);
   d.action.time=d.progress*d.clip.duration/2;d.mixer.update(0);moving||=d.progress!==d.target;
  }
  const start=performance.now();renderer.render(scene,camera);frames++;
  canvas.dataset.renderedFrames=String(frames);canvas.dataset.interiorStatus=cells.snapshot()[0].status;canvas.dataset.exteriorLOD=String(currentLOD);
  canvas.dataset.drawerProgress=JSON.stringify(Object.fromEntries([...drawers].map(([k,d])=>[k,d.progress])));
  capture.disabled=currentLOD===null||currentLOD!==requestedLOD||cells.snapshot()[0].status==='loading';
  status.textContent=`${renderer.backend.isWebGPUBackend?'WebGPU':'WebGL 2'} · 外観LOD${currentLOD??'準備中'} · 室内 ${cells.snapshot()[0].status}`;
  metrics.textContent=`${frames}回描画 · CPU送信 ${(performance.now()-start).toFixed(1)}ms · 停止時は追加描画なし。ガラス調整は透過色と微小な波打ちの試作です。`;
  if(changed||moving)request();else lastTime=null;
 }catch(error){canvas.dataset.rendererError=error.message;status.textContent='描画失敗：'+error.message;console.error(error);}
}
controls.addEventListener('change',request);select.addEventListener('change',pose);glassCheck.addEventListener('change',applyGlass);
for(const [id,b] of Object.entries(buttons))b.addEventListener('click',()=>{const d=drawers.get(id);if(!d)return;d.target=d.target?0:1;b.textContent=(id==='cash'?'現金引き出し':'階段収納')+(d.target?'を閉じる':'を開く');lastTime=performance.now();request();});
capture.addEventListener('click',async()=>{
 if(capturing||disposed||document.hidden)return;
 capturing=true;cancel();controls.enabled=false;capture.disabled=select.disabled=glassCheck.disabled=true;Object.values(buttons).forEach(b=>b.disabled=true);
 const oldAspect=camera.aspect,oldFov=camera.fov;
 try{
  renderer.setSize(1280,720,false);camera.aspect=1280/720;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(oldFov/2))*oldAspect/camera.aspect));camera.updateProjectionMatrix();
  renderer.render(scene,camera);captureWait=waitCaptureFrame({request:requestAnimationFrame,cancel:cancelAnimationFrame});await captureWait.promise;captureWait=null;
  if(disposed||document.hidden)throw new Error('非表示になったため保存を中止しました。');
  renderer.render(scene,camera);captureWait=encodeCanvasPng(canvas);const blob=await captureWait.promise;captureWait=null;
  if(disposed||document.hidden||!blob)throw new Error('画像の保存を完了できませんでした。');
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`building-a-runtime-${select.value}-${glassCheck.checked?'clear':'authored'}-1280x720.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
 }catch(error){status.textContent=error.message;}
 finally{
  capturing=false;captureWait=null;
  if(!disposed){camera.aspect=oldAspect;camera.fov=oldFov;camera.updateProjectionMatrix();controls.enabled=true;select.disabled=glassCheck.disabled=false;Object.entries(buttons).forEach(([k,b])=>b.disabled=!drawers.has(k));resize();}
 }
});
window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(document.hidden){captureWait?.cancel();cancel();}else request();});
window.addEventListener('pagehide',event=>{
 captureWait?.cancel();cancel();if(event.persisted)return;disposed=true;lodEpoch++;cells?.dispose();drawers.forEach(d=>d.mixer.stopAllAction());
 for(const promise of exteriors.values())promise.then(release).catch(()=>{});controls.dispose();envTarget?.dispose();glass.dispose();ground.geometry.dispose();ground.material.dispose();renderer.dispose();
});window.addEventListener('pageshow',request);
try{
 await renderer.init();if(disposed)throw new DOMException('Page left','AbortError');
 // Original studio environment supplies broad glazing/metal reflections. It is
 // inferred review lighting, not an HDR photograph or historic illumination.
 const env=new THREE.Scene();env.background=new THREE.Color(0x536675);
 for(const [position,scale,col] of [[[0,5,0],[6,.1,6],0xffe4bd],[[4,2,1],[.1,4,4],0x829ba8]]){
  const p=new THREE.Mesh(new THREE.BoxGeometry(...scale),new THREE.MeshBasicMaterial({color:col}));p.position.set(...position);env.add(p);
 }
 const pmrem=new THREE.PMREMGenerator(renderer);envTarget=pmrem.fromScene(env,.04,.1,100,{size:128});scene.environment=envTarget.texture;scene.environmentIntensity=.6;pmrem.dispose();env.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
 [manifest,shots]=await Promise.all([fetch(base+'runtime/manifest.json').then(r=>{if(!r.ok)throw new Error('manifest '+r.status);return r.json();}),fetch(base+'review-cameras.json').then(r=>{if(!r.ok)throw new Error('cameras '+r.status);return r.json();})]);
 if(disposed)throw new DOMException('Page left','AbortError');
 cells=createInteriorCells({cells:[{id:'building-a',position:manifest.position}],enter:manifest.enter,leave:manifest.leave,load:()=>load('interior'),attach:(_,model)=>{interior=model;scene.add(model.scene);bindDrawers(model);applyGlass();request();},detach:(_,model)=>{if(interior===model){scene.remove(model.scene);drawers.forEach(d=>d.mixer.stopAllAction());drawers.clear();interior=null;Object.values(buttons).forEach(b=>b.disabled=true);applyGlass();}release(model);},onChange:request});
 ready=true;select.disabled=false;resize();request();
}catch(error){if(!disposed){canvas.dataset.rendererError=error.message;status.textContent='準備失敗：'+error.message;console.error(error);}}
