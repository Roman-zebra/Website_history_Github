import * as THREE from 'three/webgpu';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {inspectGlb, MAX_GLB_BYTES} from './tripo-intake.mjs';

const canvas=document.querySelector('#view'),status=document.querySelector('#status'),fileInput=document.querySelector('#file'),flip=document.querySelector('#flip'),reset=document.querySelector('#reset'),clear=document.querySelector('#clear');
const sample=document.querySelector('#sample');
const scene=new THREE.Scene();scene.background=new THREE.Color('#18212c');
const camera=new THREE.PerspectiveCamera(50,1,.01,10000);
const renderer=new THREE.WebGPURenderer({canvas,antialias:true,forceWebGL:new URLSearchParams(location.search).has('webgl')});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;
const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;
scene.add(new THREE.HemisphereLight(0xffffff,0x67778a,2));
const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(5,10,8);scene.add(light);
let model=null,frame=null,disposed=false,revision=0,ready=false;
function disposeModel(object){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  object.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const material of (Array.isArray(node.material)?node.material:[node.material]).filter(Boolean)){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
  for(const value of textures){value.source?.data?.close?.();value.dispose();}for(const value of materials)value.dispose();for(const value of geometries)value.dispose();
}
function draw(){if(ready&&!disposed&&!document.hidden&&frame===null)frame=requestAnimationFrame(()=>{frame=null;try{renderer.render(scene,camera);}catch(error){ready=false;status.textContent=`描画できません：${error.message}`;}});}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();draw();}
function fit(){if(!model)return;const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),extent=box.getSize(new THREE.Vector3()).length();if(!Number.isFinite(extent)||extent<=0)throw new Error('表示できる大きさのモデルがありません。');const distance=extent/(2*Math.sin(THREE.MathUtils.degToRad(camera.fov/2)));camera.near=Math.max(extent/10000,.001);camera.far=Math.max(distance*20,100);camera.position.copy(center).add(new THREE.Vector3(1,.65,1).normalize().multiplyScalar(distance*1.15));camera.updateProjectionMatrix();controls.target.copy(center);controls.update();draw();}
function unload(){if(model){scene.remove(model);disposeModel(model);model=null;}flip.checked=false;flip.disabled=reset.disabled=clear.disabled=true;canvas.dataset.modelReady='false';draw();}
fileInput.disabled=true;
async function openFile(file){
  if(!file)return;const token=++revision;fileInput.disabled=sample.disabled=true;status.textContent='GLBを確認しています…';
  let loaded=null;
  try{
    if(file.size>MAX_GLB_BYTES)throw new Error('512 MiB以下のGLBを選んでください。');
    const bytes=await file.arrayBuffer(),{stats}=inspectGlb(bytes);
    if(disposed||token!==revision)return;
    loaded=(await new GLTFLoader().parseAsync(bytes,'')).scene;
    if(disposed||token!==revision){disposeModel(loaded);loaded=null;return;}
    unload();model=new THREE.Group();model.add(loaded);loaded=null;scene.add(model);fit();
    flip.disabled=reset.disabled=clear.disabled=false;canvas.dataset.modelReady='true';
    canvas.dataset.modelStats=JSON.stringify(stats);
    status.textContent=`${file.name} · ${(stats.bytes/1048576).toFixed(1)} MB · メッシュ定義 ${stats.trianglesInMeshDefinitions.toLocaleString()} 三角形。実寸は未確認です。`;
  }catch(error){if(loaded)disposeModel(loaded);if(model)unload();status.textContent=`開けません：${error.message}`;}
  finally{fileInput.value='';if(!disposed&&ready)fileInput.disabled=sample.disabled=false;}
}
fileInput.addEventListener('change',()=>openFile(fileInput.files[0]));
sample.addEventListener('click',async()=>{
  fileInput.disabled=sample.disabled=true;
  try{
    const response=await fetch('/study/tripo/baluster-001/source.glb');
    if(!response.ok)throw new Error('保存済みモデルがありません。GLBを選んでください。');
    const bytes=await response.arrayBuffer();
    await openFile({name:'TRIPO 柱モデル baluster-001',size:bytes.byteLength,arrayBuffer:async()=>bytes});
  }catch(error){status.textContent=error.message;if(!disposed&&ready)fileInput.disabled=sample.disabled=false;}
});
flip.addEventListener('change',()=>{if(model){model.rotation.x=flip.checked?Math.PI:0;fit();}});
reset.addEventListener('click',fit);clear.addEventListener('click',()=>{revision++;unload();status.textContent='GLBを選んでください。';});controls.addEventListener('change',draw);addEventListener('resize',resize);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&frame!==null){cancelAnimationFrame(frame);frame=null;}else draw();});
addEventListener('pagehide',()=>{disposed=true;revision++;if(frame!==null)cancelAnimationFrame(frame);unload();controls.dispose();renderer.dispose();},{once:true});
try{await renderer.init();if(!disposed){ready=true;resize();fileInput.disabled=sample.disabled=false;status.textContent=`GLBを選んでください。${renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2'}で確認します。`;canvas.dataset.rendererReady='true';}}catch(error){status.textContent=`描画の準備に失敗しました：${error.message}。?webglで開き直してください。`;}
