import * as THREE from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {bindElevator} from './bind-elevator.mjs';
import {shuttle,createRideClock} from './ride-motion.mjs';
import {createRideAccess,dockedStation,nextLandingTime} from './ride-access.mjs';
const $=id=>document.getElementById(id),canvas=$('view');
let ready=false,disposed=false,frame=null,group=null,car=null,doors=[],access=null,stops=null,backend='',generation=0,rendered=0,lastCrossing=0;
const canStart=()=>ready&&!disposed&&!document.hidden,clock=createRideClock({canStart}),crossing=createRideClock({canStart});
const renderer=new THREE.WebGPURenderer({canvas,antialias:true,forceWebGL:new URLSearchParams(location.search).has('webgl')});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.toneMapping=THREE.AgXToneMapping;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xaec6d8);const camera=new THREE.PerspectiveCamera(55,1,.05,500);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.maxDistance=180;controls.maxPolarAngle=Math.PI*.49;
scene.add(new THREE.HemisphereLight(0xe3efff,0x666057,2));const sun=new THREE.DirectionalLight(0xffeed8,3);sun.position.set(30,70,40);scene.add(sun);
function disposeTree(root){const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of [].concat(o.material||[]))ms.add(m);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());}
function requestRender(){if(ready&&!disposed&&!document.hidden&&frame===null)frame=requestAnimationFrame(draw);}
function cancelRender(){if(frame!==null)cancelAnimationFrame(frame);frame=null;}
function overview(){camera.position.set(16,38,38);controls.target.set(0,36,0);controls.update();}
function makeSchematic(width,depth,height){const root=new THREE.Group(),cage=new THREE.Group();root.add(cage);doors=[];
 const metal=new THREE.MeshStandardMaterial({color:0x7c4232,roughness:.7}),deck=new THREE.MeshStandardMaterial({color:0xdbc8a2,roughness:1}),wall=new THREE.MeshStandardMaterial({color:0x658194,roughness:.8});
 const box=(s,p,m,parent=root)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...s),m);mesh.position.set(...p);parent.add(mesh);return mesh;};
 box([width,.08,depth],[0,-height/2+.04,0],deck,cage);box([width,.08,depth],[0,height/2-.04,0],metal,cage);
 for(const x of [-width/2+.025,width/2-.025])for(const z of [-depth/2+.025,depth/2-.025])box([.05,height,.05],[x,0,z],metal,cage);
 for(const x of [-width/2+.01,width/2-.01])box([.02,.8,depth],[x,-height/2+.48,0],wall,cage);
 box([width,.8,.02],[0,-height/2+.48,-depth/2+.01],wall,cage);
 for(const sign of [-1,1]){const door=box([width/2-.05,height-.16,.02],[sign*width/4,0,depth/2-.01],wall,cage);doors.push({door,sign});}
 for(const stop of stops){const surface=stop+access.floorOffset;box([3,.15,3],[0,surface-.075,depth/2+1.5],deck);
  for(const x of [-1.45,1.45])box([.06,.9,3],[x,surface+.45,depth/2+1.5],metal);
 }
 const well=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(width+.8,stops[1]-stops[0]+height,depth+.8)),new THREE.LineBasicMaterial({color:0x445564}));well.position.y=(stops[0]+stops[1])/2;root.add(well);
 root.add(new THREE.GridHelper(100,20,0x526578,0x80929c));return {root,cage,width};
}
let carWidth=0;
let stopAt=null;
function update(now){if(!access)return;let time=clock.sample(now);if(stopAt!==null&&time>=stopAt){clock.pause(now);clock.seek(stopAt,now);time=stopAt;stopAt=null;}
 const schedule=shuttle(time,Number($('travel').value),8),height=stops[0]+(stops[1]-stops[0])*schedule.fraction;
 if(access.transitioning){const elapsed=crossing.sample(now);access.advance(elapsed-lastCrossing);lastCrossing=elapsed;if(!access.transitioning)crossing.pause(now);}
 car.position.y=height;const docked=dockedStation(schedule)!==null;
 for(const {door,sign} of doors)door.position.x=sign*carWidth*(docked?.72:.25);
 const pose=access.pose(height,Number($('look').value)*Math.PI/180);
 if($('viewMode').value==='person'){camera.position.set(...pose.position);camera.lookAt(camera.position.clone().add(new THREE.Vector3(Math.sin(pose.yaw),0,Math.cos(pose.yaw))));}
 $('board').disabled=!access.canBoard(schedule);$('exit').disabled=!access.canExit(schedule);
 const locked=access.mode!=='landing';$('form').disabled=$('landing').disabled=$('travel').disabled=locked;$('viewMode').disabled=access.transitioning;
 if(!locked)$('landing').value=String(access.station);
 $('play').textContent=clock.playing||crossing.playing?'Pause':'Play';
 $('phase').textContent=`${access.mode} · ${time.toFixed(1)} s · ${schedule.phase} · pivot ${height.toFixed(2)} m`;
 canvas.dataset.accessMode=access.mode;canvas.dataset.carHeight=height;canvas.dataset.cameraY=pose.position[1];canvas.dataset.cameraZ=pose.position[2];
}
function pause(message){const now=performance.now();clock.pause(now);crossing.pause(now);update(now);if(message)$('status').textContent=message;requestRender();}
function draw(now){frame=null;if(!ready||disposed||document.hidden)return;try{const changed=$('viewMode').value==='overview'&&controls.update();update(now);renderer.render(scene,camera);canvas.dataset.renderedFrames=++rendered;if(clock.playing||crossing.playing||changed)requestRender();}catch(error){clock.pause(now);crossing.pause(now);ready=false;cancelRender();for(const id of ['play','board','exit','reset'])$(id).disabled=true;$('status').textContent='Stopped: '+error.message;console.error(error);}}
function resize(){if(!canvas.clientWidth||!canvas.clientHeight)return;camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);requestRender();}
async function loadForm(){pause();ready=false;cancelRender();for(const id of ['play','reset','form','board','exit','landing'])$(id).disabled=true;const token=++generation;$('status').textContent='Loading car envelope…';let source;
 try{source=(await new GLTFLoader().loadAsync('/assets-src/shinsekai/tower-study/tower-study-v3-'+$('form').value+'.glb')).scene;if(disposed||token!==generation){disposeTree(source);return;}
  const binding=bindElevator(source);if(Math.abs(binding.travel.axis[1]-1)>1e-6)throw new Error('Schematic requires a vertical well');stops=[0,1].map(u=>binding.travel.point(u)[1]);const size=new THREE.Box3().setFromObject(binding.car).getSize(new THREE.Vector3());
  access=createRideAccess({stops,width:size.x,depth:size.z,height:size.y});if(group){scene.remove(group);disposeTree(group);}const schematic=makeSchematic(size.x,size.z,size.y);group=schematic.root;car=schematic.cage;carWidth=schematic.width;scene.add(group);disposeTree(source);source=null;
  const now=performance.now();clock.seek(0,now);crossing.seek(0,now);lastCrossing=0;stopAt=null;$('landing').value='0';ready=true;controls.enabled=$('viewMode').value==='overview';overview();update(now);resize();$('play').disabled=$('reset').disabled=false;$('status').textContent=`${backend} · assumed camera radius0.18m / eye1.6m · envelope ${size.x.toFixed(2)} × ${size.z.toFixed(2)} × ${size.y.toFixed(2)}m`;requestRender();
 }catch(error){if(source)disposeTree(source);$('form').disabled=false;$('status').textContent='Could not load: '+error.message;console.error(error);}
}
function beginCrossing(kind){const now=performance.now(),schedule=shuttle(clock.sample(now),Number($('travel').value),8);if(!canStart()||!access[kind](schedule))return;clock.pause(now);crossing.pause(now);crossing.seek(0,now);lastCrossing=0;$('viewMode').value='person';controls.enabled=false;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)access.advance(access.duration);else crossing.start(now);update(now);requestRender();
}
$('board').addEventListener('click',()=>beginCrossing('board'));$('exit').addEventListener('click',()=>beginCrossing('exit'));
$('play').addEventListener('click',()=>{if(clock.playing||crossing.playing)pause();else{const now=performance.now(),active=access.transitioning?crossing:clock;stopAt=active===clock&&access.mode==='riding'&&$('stopAtLanding').checked?nextLandingTime(clock.sample(now),Number($('travel').value),8):null;active.start(now);requestRender();}});
$('stopAtLanding').addEventListener('change',()=>{stopAt=clock.playing&&access.mode==='riding'&&$('stopAtLanding').checked?nextLandingTime(clock.sample(performance.now()),Number($('travel').value),8):null;});
function resetAt(station=0){pause();access.reset(station);const now=performance.now();clock.seek(station?Number($('travel').value)+9:0,now);crossing.seek(0,now);lastCrossing=0;stopAt=null;update(now);requestRender();}
$('reset').addEventListener('click',()=>{$('landing').value='0';resetAt(0);});$('landing').addEventListener('change',()=>resetAt(Number($('landing').value)));$('form').addEventListener('change',loadForm);
$('travel').addEventListener('input',()=>{$('duration').textContent=$('travel').value+' s';resetAt(access.station);});$('look').addEventListener('input',()=>{$('lookValue').textContent=$('look').value+'°';requestRender();});
$('viewMode').addEventListener('change',()=>{controls.enabled=$('viewMode').value==='overview';if(controls.enabled)overview();requestRender();});controls.addEventListener('change',requestRender);
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause('Paused while hidden. Select Play to resume.');cancelRender();}else requestRender();});
const observer=new ResizeObserver(resize);observer.observe(canvas);window.addEventListener('pagehide',event=>{pause();cancelRender();if(event.persisted)return;disposed=true;++generation;observer.disconnect();controls.dispose();disposeTree(scene);renderer.dispose();});window.addEventListener('pageshow',requestRender);
try{await renderer.init();if(!disposed){backend=renderer.backend?.isWebGPUBackend?'WebGPU':'WebGL 2 fallback';await loadForm();}}catch(error){$('status').textContent='Could not start: '+error.message;console.error(error);}
