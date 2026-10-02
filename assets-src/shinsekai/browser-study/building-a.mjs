import * as THREE from 'three/webgpu';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createInteriorCells} from './interior-cells.mjs';
import {createPeriodGlassMaterial} from './interior-mapping.mjs';
import {waitCaptureFrame,encodeCanvasPng} from './capture-frame.mjs';
import {connectShopFloor} from './shop-floor.mjs';
import {createShopDreamLook} from './shop-dream-look.mjs';
import {createShopDreamLayer} from './shop-dream-layer.mjs';
import {connectShopFlowers} from './shop-flower-look.mjs';
import {connectShopCloth} from './shop-cloth-detail.mjs';
import {connectShopClothNormal} from './shop-cloth-normal.mjs';
import {createShopAmbientLook} from './shop-ambient-look.mjs';
import {connectShopPaperShadows} from './shop-paper-shadow.mjs';
import {connectShopDaylight} from './shop-daylight.mjs';
import {connectShopWallWear} from './shop-wall-wear.mjs';
import {connectShopWoodWear} from './shop-wood-wear.mjs';
import {connectShopTatamiNormal} from './shop-tatami-normal.mjs';
import {connectShopHeriNormal} from './shop-heri-normal.mjs';
import {createHaoriWallContactLook} from './haori-wall-contact-look.mjs';
import {buildHaoriWallContactNode} from './haori-wall-contact-node.mjs';
import {resolveHaoriContactStudy} from './haori-contact-study.mjs';
import {resolveCushionContourStudy} from './cushion-contour-study.mjs';

const base='../eval-building-a/hybrid/',canvas=document.querySelector('#view'),status=document.querySelector('#status'),metrics=document.querySelector('#metrics');
const select=document.querySelector('#viewpoint'),glassCheck=document.querySelector('#clearGlass');
const dreamCheck=document.querySelector('#dreamLook');
// Opt-in comparison: compileAsync still increases total readiness time here.
const precompile=new URLSearchParams(location.search).has('precompile');
const flowerInstances=!new URLSearchParams(location.search).has('legacyflowers');
const clothSupport=new URLSearchParams(location.search).has('clothsupport');
const clothFold=new URLSearchParams(location.search).has('clothfold');
const clothFoldRevision=clothFold?(new URLSearchParams(location.search).get('clothfold')||'007'):null;
if(clothFold&&!['007','008'].includes(clothFoldRevision))throw new Error('Invalid front fold revision');
if(clothFold&&!clothSupport)throw new Error('Front fold study requires retained physical support');
const upperCushion=new URLSearchParams(location.search).has('uppercushion');
const cabinetInk=new URLSearchParams(location.search).has('cabinetink');
if(cabinetInk&&!upperCushion)throw new Error('Cabinet study requires its retained cushion003 input');
const cushionContour=resolveCushionContourStudy({revision:new URLSearchParams(location.search).get('uppercontour'),cushion:upperCushion,cabinet:cabinetInk});
const tatamiGain=new URLSearchParams(location.search).has('tatami')?Number(new URLSearchParams(location.search).get('tatami')||1):null;
if(tatamiGain!==null&&![0,1].includes(tatamiGain))throw new Error('Invalid tatami normal comparison');
const heriGain=new URLSearchParams(location.search).has('heri')?Number(new URLSearchParams(location.search).get('heri')||1):null;
if(heriGain!==null&&![0,1].includes(heriGain))throw new Error('Invalid heri normal comparison');
const sunShadowGain=new URLSearchParams(location.search).has('sunshadow')?Number(new URLSearchParams(location.search).get('sunshadow')):1;
if(![0,1].includes(sunShadowGain))throw new Error('Invalid sun shadow comparison');
const haoriContactGain=new URLSearchParams(location.search).has('haoricontact')?Number(new URLSearchParams(location.search).get('haoricontact')):null;
const haoriContactStudy=resolveHaoriContactStudy({gain:haoriContactGain,support:clothSupport,foldRevision:clothFoldRevision,bakeRevision:new URLSearchParams(location.search).get('contactbake')});
const clothRail=clothSupport||new URLSearchParams(location.search).has('clothrail');
const clothHat=clothRail||new URLSearchParams(location.search).has('clothhat');
const clothSewn=clothHat||new URLSearchParams(location.search).has('clothsewn');
const clothV2=clothSewn||new URLSearchParams(location.search).has('clothv2');
const clothDetail=clothV2||new URLSearchParams(location.search).has('cloth');
const clothLook=new URLSearchParams(location.search).has('clothlook');
// Fixed grain phase for repeatable dream comparisons; normal preview stays timed.
const reviewTime=new URLSearchParams(location.search).has('reviewtime')?Number(new URLSearchParams(location.search).get('reviewtime')):null;
if(reviewTime!==null&&(!Number.isFinite(reviewTime)||reviewTime<0))throw new Error('Invalid review time');
const ambientDetail=new URLSearchParams(location.search).has('ao');
const daylight=new URLSearchParams(location.search).has('daylight');
const wallWear=new URLSearchParams(location.search).has('wallwear');
const woodWear=new URLSearchParams(location.search).has('woodwear');
const woodWearMode=new URLSearchParams(location.search).get('woodwear')||'combined';
const windowLight=daylight||new URLSearchParams(location.search).has('windowlight');
const upperLampGain=new URLSearchParams(location.search).has('upperlamp')?Number(new URLSearchParams(location.search).get('upperlamp')):null;
if(upperLampGain!==null&&(!daylight||![.3,1].includes(upperLampGain)))throw new Error('Invalid upper room lamp comparison');
const capture=document.querySelector('#capture');
const buttons={cash:document.querySelector('#cash'),storage:document.querySelector('#storage')};
const renderer=new THREE.WebGPURenderer({canvas,antialias:true,forceWebGL:new URLSearchParams(location.search).has('webgl')});
renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.1;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.shadowMap.transmitted=true;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x8a9ba7);
const camera=new THREE.PerspectiveCamera(45,1,.03,150);camera.position.set(24,15,27);
const controls=new OrbitControls(camera,canvas);controls.target.set(3,2,-4.5);controls.enableDamping=true;controls.minDistance=.15;controls.maxDistance=65;
const hemi=new THREE.HemisphereLight(0xd7e3ee,0x655044,.8);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffd3a1,3);sun.position.set(3,12,12);sun.target.position.set(3,0,-4.5);sun.castShadow=Boolean(sunShadowGain);sun.shadow.mapSize.set(2048,2048);
canvas.dataset.sunShadow=JSON.stringify({castShadow:sun.castShadow,bias:-.0001,normalBiasMetres:.01,mapSize:[2048,2048],diagnostic:sunShadowGain===0});
// Inferred comparison: lower front light reaches deeper through the real sash
// openings. The source side walls have no windows. Reuse the existing shadow
// map rather than adding a light or altering window/frame geometry.
if(windowLight)sun.position.set(-5,9,18);
Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.5,far:40});sun.shadow.normalBias=.01;sun.shadow.bias=-.0001;scene.add(sun,sun.target);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(140,140),new THREE.MeshStandardMaterial({color:0x706654,roughness:.9}));ground.rotation.x=-Math.PI/2;ground.position.y=-.02;ground.receiveShadow=true;scene.add(ground);
const loader=new GLTFLoader(),glass=createPeriodGlassMaterial(),assets=[],exteriors=new Map(),drawers=new Map();
let manifest,shots,cells,exterior=null,interior=null,currentLOD=null,requestedLOD=null,lodEpoch=0,frame=null,disposed=false,ready=false,lastTime=null,frames=0,envTarget=null,capturing=false,captureWait=null;
let floorLook=null,dreamLook=null,ambientLook=null;
let dreamModel=null;
const dreamLayer=createShopDreamLayer({load:()=>load(flowerInstances?'dream-petals':'dream'),attach:model=>{dreamModel=model;scene.add(model.scene);applyGlass();prepareScene('dream');request();},release:model=>{scene.remove(model.scene);if(dreamModel===model)dreamModel=null;release(model);},onChange:request});
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
function render(time=performance.now()){
 if(interior?.studyHaoriContact){
  if(currentLOD===0&&exterior)interior.studyHaoriContact.bind(exterior);
  interior.studyHaoriContact.setEnabled(currentLOD===0&&!dreamCheck.checked);
  canvas.dataset.haoriContact=JSON.stringify({...interior.studyHaoriContact.stats,bakeRevision:haoriContactStudy.bakeRevision,geometryRevision:haoriContactStudy.geometryRevision});
 }else canvas.dataset.haoriContact='empty';
 canvas.dataset.daylight=interior?.studyDaylight?JSON.stringify(interior.studyDaylight.apply(!dreamCheck.checked)):'off';
 canvas.dataset.wallWear=wallWear?JSON.stringify({exterior:exterior?.studyWallWear??{materials:0},interior:interior?.studyWallWear??{materials:0}}):'off';
 canvas.dataset.woodWear=woodWear?JSON.stringify({exterior:exterior?.studyWoodWear??{materials:0},interior:interior?.studyWoodWear??{materials:0}}):'off';
 canvas.dataset.tatamiNormal=tatamiGain===null?'off':interior?.studyTatamiNormal?JSON.stringify(interior.studyTatamiNormal):'empty';
 canvas.dataset.heriNormal=heriGain===null?'off':interior?.studyHeriNormal?JSON.stringify(interior.studyHeriNormal):'empty';
 hemi.intensity=interior ? (windowLight ? .22 : .45) : .8;
 scene.environmentIntensity=interior&&windowLight ? .14 : .45;
 canvas.dataset.windowLight=windowLight?JSON.stringify({sun:[-5,9,18],target:[3,0,-4.5],interiorFill:.22,environmentIntensity:scene.environmentIntensity,shadowMap:[2048,2048],inferred:true,geometryChanged:false}):'source comparison';
 renderer.toneMappingExposure=dreamCheck.checked ? 1.1*Math.pow(2,-.3) : 1.1;
 if(ambientDetail)ambientLook??=createShopAmbientLook(renderer,scene,camera);
 if(dreamCheck.checked){dreamLook??=createShopDreamLook(renderer,scene,camera,ambientLook?.beautyPass);dreamLook.render(reviewTime??time);}
 else if(ambientLook)ambientLook.render();else renderer.render(scene,camera);
 canvas.dataset.look=dreamCheck.checked?'dream':'base';
 canvas.dataset.ambientOcclusion=ambientLook?'GTAO .35m half resolution indirect light':'off';
 canvas.dataset.paperShadow=JSON.stringify(exterior?.studyPaperShadows??{materials:0});
 canvas.dataset.interiorPaperShadow=JSON.stringify(interior?.studyPaperShadows??{materials:0});
}
async function settleGPU(){
 const queue=renderer.backend.isWebGPUBackend?renderer.backend.device?.queue:null;if(!queue)return;
 let timer;try{await Promise.race([queue.onSubmittedWorkDone(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('画像保存のGPU待機が完了しませんでした。')),5000);})]);}finally{clearTimeout(timer);}
}
function request(){if(ready&&!disposed&&!capturing&&!document.hidden&&frame===null)frame=requestAnimationFrame(draw);}
function cancel(){if(frame!==null)cancelAnimationFrame(frame);frame=null;lastTime=null;}
function meshes(model,fn){model.scene.traverse(o=>{if(o.isMesh)fn(o);});}
function release(model){
 if(model.studyHaoriContact){canvas.dataset.haoriContactRetired=JSON.stringify(model.studyHaoriContact.dispose());model.studyHaoriContact=null;}
 model.studyDaylight?.dispose();
 model.studyFlowers?.disposeTextures();
 const geometries=new Set(),materials=new Set(),textures=new Set();meshes(model,o=>{if(o.isInstancedMesh)o.dispose();geometries.add(o.geometry);for(const m of [].concat(o.material,o.userData.authoringMaterial??[]))if(m&&m!==glass)materials.add(m);});
 for(const m of materials)if(m.userData.studyOriginalWrinkleMaterial)materials.add(m.userData.studyOriginalWrinkleMaterial);
 for(const m of materials)if(m.userData.studyOriginalShadowMaterial)materials.add(m.userData.studyOriginalShadowMaterial);
 for(const m of materials)if(m.userData.studyOriginalWallMaterial)materials.add(m.userData.studyOriginalWallMaterial);
 for(const m of materials)if(m.userData.studyOriginalWoodMaterial)materials.add(m.userData.studyOriginalWoodMaterial);
 for(const m of materials)if(m.userData.studyOriginalTatamiMaterial)materials.add(m.userData.studyOriginalTatamiMaterial);
 for(const m of materials)if(m.userData.studyOriginalHeriMaterial)materials.add(m.userData.studyOriginalHeriMaterial);
 const tatamiOriginals=new Set([...materials].map(m=>m.userData.studyOriginalTatamiMaterial).filter(Boolean));let tatamiCopiesDisposed=0,tatamiOriginalsDisposed=0;
 const heriOriginals=new Set([...materials].map(m=>m.userData.studyOriginalHeriMaterial).filter(Boolean));let heriCopiesDisposed=0,heriOriginalsDisposed=0;
 for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();if(m.userData.studyOriginalTatamiMaterial)tatamiCopiesDisposed++;if(tatamiOriginals.has(m))tatamiOriginalsDisposed++;if(m.userData.studyOriginalHeriMaterial)heriCopiesDisposed++;if(heriOriginals.has(m))heriOriginalsDisposed++;}for(const t of textures){t.dispose();t.source?.data?.close?.();}for(const g of geometries)g.dispose();
 if(model.studyTatamiNormal)canvas.dataset.tatamiNormalRetired=JSON.stringify({copiesDisposed:tatamiCopiesDisposed,originalsDisposed:tatamiOriginalsDisposed});
 if(model.studyHeriNormal)canvas.dataset.heriNormalRetired=JSON.stringify({copiesDisposed:heriCopiesDisposed,originalsDisposed:heriOriginalsDisposed});
}
async function load(part){
 const loadStart=performance.now();
 const gltf=await loader.loadAsync(cushionContour&&part==='interior'?cushionContour.path:cabinetInk&&part==='interior'?'/study/cabinet-ink-119-001/interior-cabinet.glb':upperCushion&&part==='interior'?'/study/upper-cushion-119-003/interior-cushion.glb':clothFold&&part==='upper-cloth-v2-sewn-rail'?`/study/haori-frontfold-119-${clothFoldRevision}/upper-cloth-support.glb`:clothSupport&&part==='upper-cloth-v2-sewn-rail'?'/study/haori-support-119-003/upper-cloth-support.glb':base+'runtime/'+part+'.glb');
 if(part==='interior')canvas.dataset.cabinetInk=cabinetInk?'cabinet-ink-119-001':'source';
 if(part==='interior')canvas.dataset.upperCushion=cushionContour?`${cushionContour.round}-g${cushionContour.revision}`:upperCushion?'upper-cushion-119-003':'sourcea5c102f5';
 if(part==='upper-cloth-v2-sewn-rail')canvas.dataset.clothSupport=clothFold?`haori-frontfold-119-${clothFoldRevision}`:clothSupport?'haori-support-119-003':'source7240';
 gltf.studyLoadMs=performance.now()-loadStart;
 if(disposed){release(gltf);throw new DOMException('Page left','AbortError');}
 if(part==='dream-petals'){
  try{gltf.studyFlowers=connectShopFlowers(gltf);}
  catch(error){release(gltf);throw error;}
 }
 if(['upper-cloth','upper-cloth-v2','upper-cloth-v2-sewn','upper-cloth-v2-sewn-hat','upper-cloth-v2-sewn-rail'].includes(part))try{gltf.studyClothNormal=connectShopClothNormal(gltf,{fibreSheen:clothLook});}catch(error){release(gltf);throw error;}
 if(part==='exterior-lod0')try{gltf.studyPaperShadows=connectShopPaperShadows(gltf);}catch(error){release(gltf);throw error;}
 if(part==='interior'&&windowLight)try{gltf.studyPaperShadows=connectShopPaperShadows(gltf,{names:['SHOJI']});}catch(error){release(gltf);throw error;}
 if(['interior','exterior-lod0'].includes(part)&&wallWear)try{gltf.studyWallWear=connectShopWallWear(gltf);}catch(error){release(gltf);throw error;}
 if(['interior','exterior-lod0'].includes(part)&&woodWear)try{gltf.studyWoodWear=connectShopWoodWear(gltf,{mode:woodWearMode});}catch(error){release(gltf);throw error;}
 if(part==='interior'&&tatamiGain!==null)try{gltf.studyTatamiNormal=connectShopTatamiNormal(gltf,{gain:tatamiGain});if(tatamiGain&&gltf.studyTatamiNormal.materials===0)throw new Error('Tatami comparison did not bind its source material');}catch(error){release(gltf);throw error;}
 if(part==='interior'&&heriGain!==null)try{gltf.studyHeriNormal=connectShopHeriNormal(gltf,{gain:heriGain});if(heriGain&&gltf.studyHeriNormal.materials===0)throw new Error('Heri comparison did not bind its source material');}catch(error){release(gltf);throw error;}
 if(part==='interior'&&clothDetail){
  let cloth;
  try{cloth=await load(clothRail?'upper-cloth-v2-sewn-rail':clothHat?'upper-cloth-v2-sewn-hat':clothSewn?'upper-cloth-v2-sewn':clothV2?'upper-cloth-v2':'upper-cloth');gltf.studyCloth=connectShopCloth(gltf,cloth,{suffix:clothV2?'_v2':''});gltf.studyCloth.normal=cloth.studyClothNormal;}
  catch(error){if(cloth)release(cloth);release(gltf);throw error;}
 }
 assets.push(part);canvas.dataset.loadedAssets=JSON.stringify(assets);
 if(part==='interior'&&haoriContactGain!==null){
  let map;try{
   map=await new THREE.TextureLoader().loadAsync(haoriContactStudy.path);
   if(disposed)throw new DOMException('Page left','AbortError');
   gltf.studyHaoriContact=createHaoriWallContactLook(map,{gain:haoriContactGain,createMaterial:source=>new (source.isMeshPhysicalMaterial?THREE.MeshPhysicalNodeMaterial:THREE.MeshStandardNodeMaterial)().copy(source),buildNode:buildHaoriWallContactNode});
  }catch(error){map?.dispose();release(gltf);throw error;}
 }
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
 if(part==='interior'&&daylight)gltf.studyDaylight=connectShopDaylight(gltf,{upperGain:upperLampGain});
 // Include the optional cloth dependency in total readiness, not only the
 // first interior download. The companion remains inside this cell's lifetime.
 gltf.studyLoadMs=performance.now()-loadStart;
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
  o.castShadow=![].concat(o.material).every(m=>m===glass||m.name==='M_Glass'||/glass_clear/i.test(m.name));
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
 const clothShots={
  'hero-upper-cushion':{position:[4.0,4.35,3.95],target:[3.2,5.05,3.50],lens:32},
  'hero-upper-cushion-side':{position:[4.0,5.2,3.73],target:[3.2,5.215,3.50],lens:28},
  'hero-upper-tatami':{position:[1.15,.85,3.95],target:[.95,1.55,3.455],lens:28},
  'hero-upper-tatami-macro':{position:[.6,1.65,3.66],target:[.75,1.95,3.455],lens:35},
  'hero-upper-heri':{position:[.75,1.92,3.57],target:[.85,2.04,3.457],lens:35},
  'hero-upper-tansu':{position:[4.3,1.60,4.1],target:[5.3,1.91,3.94],lens:32},
  'hero-haori':{position:[1.42,2.22,4.50],target:[.26,2.16,4.50],lens:24},
  'hero-haori-side':{position:[.88,3.10,4.55],target:[.40,2.18,4.50],lens:28},
  'hero-haori-support':{position:[1.75,2.22,4.55],target:[.38,2.18,4.55],lens:24},
  'hero-haori-side-wide':{position:[1.10,3.40,4.55],target:[.40,2.18,4.50],lens:24},
  'hero-haori-complete':{position:[1.90,2.22,4.48],target:[.38,2.18,4.48],lens:24},
  'hero-haori-side-complete':{position:[1.25,3.65,4.48],target:[.40,2.18,4.46],lens:24},
  'hero-laundry':{position:[1.90,2.75,5.10],target:[1.90,4.44,5.08],lens:22},
  'hero-cloth-bolt':{position:[3.05,1.35,4.15],target:[2.45,2.55,3.49],lens:30}
 };
 controls.enableDamping=false;controls.update();
 if(view==='far'){camera.position.set(24,15,27);controls.target.set(3,2,-4.5);camera.fov=45;}
 else if(view==='floor-study'){camera.position.set(4.55,1.15,-3.7);controls.target.set(4.35,.08,-1.45);camera.fov=55;}
 else{const shot=clothShots[view]??shots.find(s=>s.file==='base-'+view+'.png');camera.position.set(shot.position[0],shot.position[2],-shot.position[1]);controls.target.set(shot.target[0],shot.target[2],-shot.target[1]);camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(36/(2*shot.lens)/camera.aspect));}
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
  canvas.dataset.flowerInstances=dreamModel?.studyFlowers?JSON.stringify(dreamModel.studyFlowers.stats):'empty';
  canvas.dataset.clothDetail=interior?.studyCloth?JSON.stringify(interior.studyCloth):'empty';
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
  if(cells.snapshot()[0].status==='failed')throw new Error('室内部品の読み込み失敗：'+cells.snapshot()[0].error);
  if(dreamLayer.snapshot().status==='failed')throw new Error('夢部品の読み込み失敗：'+dreamLayer.snapshot().error);
  status.textContent=`${renderer.backend.isWebGPUBackend?'WebGPU':'WebGL 2'} · 外観LOD${currentLOD??'準備中'} · 室内 ${cells.snapshot()[0].status}`;
  metrics.textContent=`${frames}回描画 · CPU送信 ${submitMs.toFixed(1)}ms · 停止時は追加描画なし。ガラス調整は透過色と微小な波打ちの試作です。`;
  if(changed||moving)request();else lastTime=null;
 }catch(error){canvas.dataset.rendererError=error.message;capture.disabled=true;status.textContent='描画失敗：'+error.message;console.error(error);}
}
controls.addEventListener('change',request);select.addEventListener('change',pose);glassCheck.addEventListener('change',applyGlass);
dreamCheck.addEventListener('change',request);
for(const [id,b] of Object.entries(buttons))b.addEventListener('click',()=>{const d=drawers.get(id);if(!d)return;d.target=d.target?0:1;b.textContent=(id==='cash'?'現金引き出し':'階段収納')+(d.target?'を閉じる':'を開く');lastTime=performance.now();request();});
capture.addEventListener('click',async()=>{
 if(capturing||disposed||document.hidden)return;
 capturing=true;canvas.dataset.capture='pending';delete canvas.dataset.captureError;cancel();controls.enabled=false;capture.disabled=select.disabled=glassCheck.disabled=dreamCheck.disabled=true;Object.values(buttons).forEach(b=>b.disabled=true);
 try{
  // Finish submitted work before capture. No render target is resized for PNG.
  await settleGPU();
  if(disposed||document.hidden)throw new Error('非表示になったため保存を中止しました。');
  render();captureWait=waitCaptureFrame({request:requestAnimationFrame,cancel:cancelAnimationFrame});await captureWait.promise;captureWait=null;
  if(disposed||document.hidden)throw new Error('非表示になったため保存を中止しました。');
  render();await settleGPU();if(canvas.dataset.rendererError)throw new Error('GPU描画失敗のため保存を中止しました。');captureWait=encodeCanvasPng(canvas);const blob=await captureWait.promise;captureWait=null;
  if(disposed||document.hidden||!blob)throw new Error('画像の保存を完了できませんでした。');
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`building-a-runtime-${select.value}-${glassCheck.checked?'clear':'authored'}-${dreamCheck.checked?'dream':'base'}-1280x720.png`;link.click();canvas.dataset.capture='saved';setTimeout(()=>URL.revokeObjectURL(url),10000);
 }catch(error){canvas.dataset.capture='failed';canvas.dataset.captureError=error.message;status.textContent=error.message;}
 finally{
  capturing=false;captureWait=null;
  if(!disposed){controls.enabled=true;select.disabled=glassCheck.disabled=dreamCheck.disabled=false;Object.entries(buttons).forEach(([k,b])=>b.disabled=!drawers.has(k));request();}
 }
});
window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(document.hidden){captureWait?.cancel();cancel();}else{if(preparationPaused){preparationPaused=false;prepareScene('visibility-resume');}request();}});
window.addEventListener('pagehide',event=>{
 captureWait?.cancel();cancel();if(event.persisted)return;disposed=true;lodEpoch++;
 const cleanup=()=>{dreamLayer.dispose();cells?.dispose();drawers.forEach(d=>d.mixer.stopAllAction());for(const promise of exteriors.values())promise.then(release).catch(()=>{});controls.dispose();dreamLook?.dispose();ambientLook?.dispose();envTarget?.dispose();glass.dispose();ground.geometry.dispose();ground.material.dispose();renderer.dispose();};
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
