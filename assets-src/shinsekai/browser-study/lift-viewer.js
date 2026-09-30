import * as THREE from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {bindElevator} from './bind-elevator.mjs';
import {readLiftLandings} from './lift-landings.mjs';
import {MACHINES,createGimmickState,connectGimmickEvents} from './gimmick-state.mjs';
import {shuttle,createRideClock} from './ride-motion.mjs';
const $=id=>document.getElementById(id),canvas=$('view'),play=$('play'),reset=$('reset'),form=$('form'),ride=$('ride');
let ready=false,disposed=false,frame=null,model=null,binding=null,layout=null,backend='',generation=0,rendered=0;
const clock=createRideClock({canStart:()=>ready&&layout?.canTravel&&!disposed&&!document.hidden});
const gimmicks=createGimmickState(MACHINES.filter(m=>m.id==='tower-lift'),{onStart:()=>{if(!clock.start(performance.now()))return false;play.textContent='Pause';requestRender();return true;}}),disconnectGimmicks=connectGimmickEvents(document,gimmicks);
const renderer=new THREE.WebGPURenderer({canvas,antialias:true,forceWebGL:new URLSearchParams(location.search).has('webgl')});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.toneMapping=THREE.AgXToneMapping;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xaec6d8);
const camera=new THREE.PerspectiveCamera(50,1,.1,500);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.maxDistance=200;controls.maxPolarAngle=Math.PI*.49;
function overview(){camera.position.set(70,45,95);controls.target.set(0,35,0);controls.update();}
overview();scene.add(new THREE.HemisphereLight(0xdceeff,0x5a5965,2));const sun=new THREE.DirectionalLight(0xffeed8,3);sun.position.set(40,80,50);scene.add(sun);
function disposeTree(root){const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of [].concat(o.material||[]))ms.add(m);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());}
function requestRender(){if(ready&&!disposed&&!document.hidden&&frame===null)frame=requestAnimationFrame(draw);}
function cancelRender(){if(frame!==null)cancelAnimationFrame(frame);frame=null;}
function update(time){if(!layout)return;const schedule=shuttle(layout.canTravel?time:0,Number($('travel').value),8);if(binding)binding.setFraction(schedule.fraction);const centre=model.getObjectByName('elevator_car').getWorldPosition(new THREE.Vector3());
 if(ride.value==='follow'){camera.position.copy(centre).add(new THREE.Vector3(5,1,8));camera.lookAt(centre);}
 $('phase').textContent=`${clock.playing?'Playing':'Paused'} · ${time.toFixed(1)} s · ${schedule.phase} · car floor ${(centre.y+layout.floorOffset).toFixed(2)} m`;
 canvas.dataset.carHeight=centre.y;canvas.dataset.travelFraction=schedule.fraction;
}
function pause(message){const now=performance.now();clock.pause(now);play.textContent='Play';update(clock.sample(now));if(message)$('status').textContent=message;requestRender();}
function draw(now){frame=null;if(!ready||disposed||document.hidden)return;try{const changed=ride.value==='overview'&&controls.update();update(clock.sample(now));renderer.render(scene,camera);canvas.dataset.renderedFrames=++rendered;if(clock.playing||changed)requestRender();}catch(error){pause();ready=false;cancelRender();play.disabled=reset.disabled=true;$('status').textContent='Stopped: '+error.message;console.error(error);}}
function resize(){if(!canvas.clientWidth||!canvas.clientHeight)return;camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);requestRender();}
async function loadForm(){pause();gimmicks.parkAll();ready=false;cancelRender();play.disabled=reset.disabled=form.disabled=true;const token=++generation;$('status').textContent='Loading candidate…';
 let candidate;
 try{candidate=(await new GLTFLoader().loadAsync('/assets-src/shinsekai/tower-study/tower-study-v4-'+form.value+'.glb')).scene;
  if(disposed||token!==generation){disposeTree(candidate);return;}
  const nextLayout=readLiftLandings(candidate.userData.lift),next=nextLayout.canTravel?bindElevator(candidate):null;if(model){scene.remove(model);disposeTree(model);}model=candidate;binding=next;layout=nextLayout;scene.add(model);clock.seek(0,performance.now());ready=true;update(0);resize();reset.disabled=form.disabled=false;play.disabled=$('travel').disabled=!layout.canTravel;
  $('status').textContent=layout.canTravel?`${backend} · floor ${layout.floors[0].toFixed(2)}–${layout.floors[1].toFixed(2)} m · upper floor assumed`:`${backend} · upper landing unresolved — travel disabled`;requestRender();
 }catch(error){if(candidate)disposeTree(candidate);form.disabled=false;$('status').textContent='Could not load: '+error.message;console.error(error);}
}
play.addEventListener('click',()=>{if(clock.playing)pause();else if(clock.start(performance.now())){gimmicks.startGimmick('tower-lift');play.textContent='Pause';requestRender();}});
reset.addEventListener('click',()=>{pause();gimmicks.parkAll();clock.seek(0,performance.now());update(0);requestRender();});
form.addEventListener('change',loadForm);ride.addEventListener('change',()=>{controls.enabled=ride.value==='overview';if(controls.enabled)overview();requestRender();});
$('travel').addEventListener('input',()=>{pause();$('duration').textContent=$('travel').value+' s';clock.seek(0,performance.now());update(0);requestRender();});
controls.addEventListener('change',requestRender);const observer=new ResizeObserver(resize);observer.observe(canvas);
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause('Paused while hidden. Select Play to resume.');cancelRender();}else requestRender();});
window.addEventListener('pagehide',event=>{pause();cancelRender();if(event.persisted)return;disposed=true;++generation;disconnectGimmicks();observer.disconnect();controls.dispose();disposeTree(scene);renderer.dispose();});
window.addEventListener('pageshow',requestRender);
try{await renderer.init();if(!disposed){backend=renderer.backend?.isWebGPUBackend?'WebGPU':'WebGL 2 fallback';await loadForm();}}catch(error){$('status').textContent='Could not start: '+error.message;console.error(error);}
