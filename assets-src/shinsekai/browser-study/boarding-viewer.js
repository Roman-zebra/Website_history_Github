import * as THREE from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {bindElevator} from './bind-elevator.mjs';
import {readLiftLandings} from './lift-landings.mjs';
import {createTurretTransfer} from './turret-transfer.mjs';
import {MACHINES,createGimmickState,connectGimmickEvents} from './gimmick-state.mjs';
import {shuttle,createRideClock} from './ride-motion.mjs';
import {createRideAccess,dockedStation,nextLandingTime} from './ride-access.mjs';
const $=id=>document.getElementById(id),canvas=$('view');
let ready=false,disposed=false,frame=null,group=null,car=null,doors=[],access=null,stops=null,backend='',generation=0,rendered=0,lastCrossing=0;
let layout=null;
const canStart=()=>ready&&!disposed&&!document.hidden,clock=createRideClock({canStart:()=>canStart()&&layout?.canTravel}),crossing=createRideClock({canStart});
const gimmicks=createGimmickState(MACHINES.filter(m=>m.id==='tower-lift'),{onStart:()=>{if(access?.transitioning||!clock.start(performance.now()))return false;stopAt=access?.mode==='riding'&&$('stopAtLanding').checked?nextLandingTime(clock.sample(performance.now()),Number($('travel').value),8):null;requestRender();return true;}}),disconnectGimmicks=connectGimmickEvents(document,gimmicks);
const renderer=new THREE.WebGPURenderer({canvas,antialias:true,forceWebGL:new URLSearchParams(location.search).has('webgl')});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.toneMapping=THREE.AgXToneMapping;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xaec6d8);const camera=new THREE.PerspectiveCamera(55,1,.05,500);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.maxDistance=180;controls.maxPolarAngle=Math.PI*.49;
scene.add(new THREE.HemisphereLight(0xe3efff,0x666057,2));const sun=new THREE.DirectionalLight(0xffeed8,3);sun.position.set(30,70,40);scene.add(sun);
function disposeTree(root){const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of [].concat(o.material||[]))ms.add(m);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());}
function requestRender(){if(ready&&!disposed&&!document.hidden&&frame===null)frame=requestAnimationFrame(draw);}
function cancelRender(){if(frame!==null)cancelAnimationFrame(frame);frame=null;}
function overview(){camera.position.set(40,43,82);controls.target.set(-5,32,3);controls.update();}
function makeSchematic(width,depth,height){const root=new THREE.Group(),cage=new THREE.Group();root.add(cage);doors=[];
 const metal=new THREE.MeshStandardMaterial({color:0x7c4232,roughness:.7}),deck=new THREE.MeshStandardMaterial({color:0xdbc8a2,roughness:1}),wire=new THREE.LineBasicMaterial({color:0x43525c});
 const box=(s,p,m,parent=root)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...s),m);mesh.position.set(...p);parent.add(mesh);return mesh;};
 const panel=(w,h,axis,position)=>{const points=[],put=(a,b)=>points.push(...a,...b),at=(u,v)=>axis==='side'?[0,v,u]:[u,v,0];
  for(let i=0;i<=Math.ceil(w/.1);i++){const u=-w/2+w*i/Math.ceil(w/.1);put(at(u,-h/2),at(u,h/2));}
  for(let i=0;i<=Math.ceil(h/.1);i++){const v=-h/2+h*i/Math.ceil(h/.1);put(at(-w/2,v),at(w/2,v));}
  const mesh=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(points,3)),wire);mesh.position.set(...position);cage.add(mesh);return mesh;};
 box([width,layout.car.floorThickness,depth],[0,-height/2+layout.car.floorThickness/2,0],deck,cage);box([width,.08,depth],[0,height/2-.04,0],metal,cage);
 for(const x of [-width/2+.025,width/2-.025])for(const z of [-depth/2+.025,depth/2-.025])box([.05,height,.05],[x,0,z],metal,cage);
 for(const x of [-width/2+.01,width/2-.01])panel(depth,height-.16,'side',[x,0,0]);
 panel(width,height-.16,'front',[0,0,-depth/2+.01]);
 for(const sign of [-1,1]){const door=panel(width/2-.05,height-.16,'front',[sign*width/4,0,depth/2-.01]);doors.push({door,sign});}
 for(const surface of layout.floors.filter(Number.isFinite)){box([3,.15,3],[0,surface-.075,depth/2+1.5],deck);
  for(const x of [-1.45,1.45])box([.06,.9,3],[x,surface+.45,depth/2+1.5],metal);
 }
 const well=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(width+.8,stops[1]-stops[0]+height,depth+.8)),new THREE.LineBasicMaterial({color:0x445564}));well.position.y=(stops[0]+stops[1])/2;root.add(well);
 for(let y=layout.floors[0]+3;y<stops[1];y+=3){const ring=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(width+.8,.04,depth+.8)),new THREE.LineBasicMaterial({color:0xa38759}));ring.position.y=y;root.add(ring);}
 const transfer=createTurretTransfer({roofFloor:layout.floors[0],landingZ:depth/2+1.5});for(const step of transfer.steps)box(step.size,step.position,deck);
 for(const segment of transfer.walkway){const mesh=box([1.2,.12,segment.length],segment.centre,deck);mesh.rotation.y=segment.yaw;}
 const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(4.4,layout.floors[0],4.4)),new THREE.LineBasicMaterial({color:0x658194}));outline.position.set(-12.3,layout.floors[0]/2,10.8);root.add(outline);
 root.add(new THREE.GridHelper(100,20,0x526578,0x80929c));return {root,cage,width};
}
let carWidth=0;
let stopAt=null;
function update(now){if(!access)return;let time=clock.sample(now);if(stopAt!==null&&time>=stopAt){clock.pause(now);clock.seek(stopAt,now);time=stopAt;stopAt=null;}
 const schedule=shuttle(layout.canTravel?time:0,Number($('travel').value),8),height=stops[0]+(stops[1]-stops[0])*schedule.fraction;
 if(access.transitioning){const elapsed=crossing.sample(now);access.advance(elapsed-lastCrossing);lastCrossing=elapsed;if(!access.transitioning)crossing.pause(now);}
 car.position.y=height;const docked=dockedStation(schedule)!==null;
 for(const {door,sign} of doors)door.position.x=sign*carWidth*(docked?.72:.25);
 const pose=access.pose(height,Number($('look').value)*Math.PI/180);
 if($('viewMode').value==='person'){camera.position.set(...pose.position);camera.lookAt(camera.position.clone().add(new THREE.Vector3(Math.sin(pose.yaw),0,Math.cos(pose.yaw))));}
 $('board').disabled=!access.canBoard(schedule);$('exit').disabled=!access.canExit(schedule);
 const locked=access.mode!=='landing';$('form').disabled=$('landing').disabled=locked;$('travel').disabled=locked||!layout.canTravel;$('viewMode').disabled=access.transitioning;
 if(!locked)$('landing').value=String(access.station);
 $('play').textContent=clock.playing||crossing.playing?'Pause':'Play';
 $('play').disabled=!layout.canTravel&&!access.transitioning;
 $('height').textContent=`Car floor ${(height+layout.floorOffset).toFixed(2)} m · ${layout.canTravel?'upper floor assumed':'upper landing unresolved — travel disabled'}`;
 $('phase').textContent=`${access.mode} · ${time.toFixed(1)} s · ${schedule.phase} · pivot ${height.toFixed(2)} m`;
 canvas.dataset.accessMode=access.mode;canvas.dataset.carHeight=height;canvas.dataset.carFloor=height+layout.floorOffset;canvas.dataset.cameraY=pose.position[1];canvas.dataset.cameraZ=pose.position[2];
}
function pause(message){const now=performance.now();clock.pause(now);crossing.pause(now);update(now);if(message)$('status').textContent=message;requestRender();}
function draw(now){frame=null;if(!ready||disposed||document.hidden)return;try{const changed=$('viewMode').value==='overview'&&controls.update();update(now);renderer.render(scene,camera);canvas.dataset.renderedFrames=++rendered;if(clock.playing||crossing.playing||changed)requestRender();}catch(error){clock.pause(now);crossing.pause(now);ready=false;cancelRender();for(const id of ['play','board','exit','reset'])$(id).disabled=true;$('status').textContent='Stopped: '+error.message;console.error(error);}}
function resize(){if(!canvas.clientWidth||!canvas.clientHeight)return;camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);requestRender();}
async function loadForm(){pause();gimmicks.parkAll();ready=false;cancelRender();for(const id of ['play','reset','form','board','exit','landing'])$(id).disabled=true;const token=++generation;$('status').textContent='Loading car envelope…';let source;
 try{source=(await new GLTFLoader().loadAsync('/assets-src/shinsekai/tower-study/tower-study-v4-'+$('form').value+'.glb')).scene;if(disposed||token!==generation){disposeTree(source);return;}
  layout=readLiftLandings(source.userData.lift);stops=layout.stops;if(layout.canTravel){const binding=bindElevator(source);for(const i of [0,1])if(Math.abs(binding.travel.point(i)[1]-stops[i])>1e-4)throw new Error('GLB/landing stops disagree');}
  const size=new THREE.Box3().setFromObject(source.getObjectByName('elevator_car')).getSize(new THREE.Vector3());
  access=createRideAccess({stops,landingEnabled:layout.landingEnabled,width:size.x,depth:size.z,height:size.y,floorThickness:layout.car.floorThickness});if(group){scene.remove(group);disposeTree(group);}const schematic=makeSchematic(size.x,size.z,size.y);group=schematic.root;car=schematic.cage;carWidth=schematic.width;scene.add(group);disposeTree(source);source=null;
  const now=performance.now();clock.seek(0,now);crossing.seek(0,now);lastCrossing=0;stopAt=null;$('landing').value='0';$('landing').options[1].disabled=!layout.canTravel;ready=true;controls.enabled=$('viewMode').value==='overview';overview();update(now);resize();$('reset').disabled=false;$('status').textContent=`${backend} · assumed camera radius0.18m / eye1.6m · envelope ${size.x.toFixed(2)} × ${size.z.toFixed(2)} × ${size.y.toFixed(2)}m`;requestRender();
 }catch(error){if(source)disposeTree(source);$('form').disabled=false;$('status').textContent='Could not load: '+error.message;console.error(error);}
}
function beginCrossing(kind){const now=performance.now(),schedule=shuttle(clock.sample(now),Number($('travel').value),8);if(!canStart()||!access[kind](schedule))return;clock.pause(now);crossing.pause(now);crossing.seek(0,now);lastCrossing=0;$('viewMode').value='person';controls.enabled=false;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)access.advance(access.duration);else crossing.start(now);update(now);requestRender();
}
$('board').addEventListener('click',()=>beginCrossing('board'));$('exit').addEventListener('click',()=>beginCrossing('exit'));
$('play').addEventListener('click',()=>{if(clock.playing||crossing.playing)pause();else{const now=performance.now(),active=access.transitioning?crossing:clock;stopAt=active===clock&&access.mode==='riding'&&$('stopAtLanding').checked?nextLandingTime(clock.sample(now),Number($('travel').value),8):null;if(active.start(now)&&active===clock)gimmicks.startGimmick('tower-lift');requestRender();}});
$('stopAtLanding').addEventListener('change',()=>{stopAt=clock.playing&&access.mode==='riding'&&$('stopAtLanding').checked?nextLandingTime(clock.sample(performance.now()),Number($('travel').value),8):null;});
function resetAt(station=0){pause();gimmicks.parkAll();access.reset(station);const now=performance.now();clock.seek(station?Number($('travel').value)+9:0,now);crossing.seek(0,now);lastCrossing=0;stopAt=null;update(now);requestRender();}
$('reset').addEventListener('click',()=>{$('landing').value='0';resetAt(0);});$('landing').addEventListener('change',()=>resetAt(Number($('landing').value)));$('form').addEventListener('change',loadForm);
$('travel').addEventListener('input',()=>{$('duration').textContent=$('travel').value+' s';resetAt(access.station);});$('look').addEventListener('input',()=>{$('lookValue').textContent=$('look').value+'°';requestRender();});
$('viewMode').addEventListener('change',()=>{controls.enabled=$('viewMode').value==='overview';if(controls.enabled)overview();requestRender();});controls.addEventListener('change',requestRender);
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause('Paused while hidden. Select Play to resume.');cancelRender();}else requestRender();});
const observer=new ResizeObserver(resize);observer.observe(canvas);window.addEventListener('pagehide',event=>{pause();cancelRender();if(event.persisted)return;disposed=true;++generation;disconnectGimmicks();observer.disconnect();controls.dispose();disposeTree(scene);renderer.dispose();});window.addEventListener('pageshow',requestRender);
try{await renderer.init();if(!disposed){backend=renderer.backend?.isWebGPUBackend?'WebGPU':'WebGL 2 fallback';await loadForm();}}catch(error){$('status').textContent='Could not start: '+error.message;console.error(error);}
