import * as THREE from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {DEFAULT_RIDES,validateRides,cablePoint,ropeway,elevator,createRideClock} from './ride-motion.mjs';
import {MACHINES,createGimmickState,connectGimmickEvents} from './gimmick-state.mjs';

const canvas=document.querySelector('#view'),status=document.querySelector('#status'),phase=document.querySelector('#phase');
const play=document.querySelector('#play'),reset=document.querySelector('#reset'),ride=document.querySelector('#ride');
const config={...DEFAULT_RIDES},clock=createRideClock({canStart:()=>ready&&!disposed&&!document.hidden});
const machines=MACHINES.filter(m=>['tower-lift','ropeway','circling-wave'].includes(m.id));
const gimmicks=createGimmickState(machines,{getTime:()=>clock.sample(performance.now()),onStart:()=>{if(!clock.start(performance.now()))return false;play.textContent='Pause';requestRender();return true;}}),disconnectGimmicks=connectGimmickEvents(document,gimmicks);
const renderer=new THREE.WebGPURenderer({canvas,antialias:true,forceWebGL:new URLSearchParams(location.search).has('webgl')});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.toneMapping=THREE.AgXToneMapping;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xaec6d8);
const camera=new THREE.PerspectiveCamera(50,1,.1,500);camera.position.set(85,64,95);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,22,0);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.49;controls.update();
const light=new THREE.HemisphereLight(0xdceeff,0x5a5965,2),sun=new THREE.DirectionalLight(0xffeed8,3);sun.position.set(40,80,50);scene.add(light,sun);
const metal=new THREE.MeshStandardMaterial({color:0x607285,roughness:.7}),red=new THREE.MeshStandardMaterial({color:0x9e4133,roughness:.7}),cream=new THREE.MeshStandardMaterial({color:0xd4c3a3,roughness:1});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(300,200),new THREE.MeshStandardMaterial({color:0x727d72,roughness:1}));floor.rotation.x=-Math.PI/2;scene.add(floor);
function box(size,position,material=metal,parent=scene){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.set(...position);parent.add(mesh);return mesh;}
const lineMaterial=new THREE.LineBasicMaterial({color:0x283f55}),cables=[-1,1].map(()=>{const line=new THREE.Line(new THREE.BufferGeometry(),lineMaterial);scene.add(line);return line;});
const terminals=[box([5,.4,9],[0,0,0],cream),box([5,.4,9],[0,0,0],cream)];
const supports=[box([.5,1,.5],[0,0,0]),box([.5,1,.5],[0,0,0])];
const cars=[0,1].map(i=>{const group=new THREE.Group();scene.add(group);group.name=`ropeway-car-${i}`;box([3,1.2,1.8],[0,-1.6,0],i?cream:red,group);box([3.3,.15,2],[0,-.7,0],cream,group);box([.15,.7,.15],[0,-.35,0],metal,group);return group;});
// Distinct schematic shaft/car interface, independent of a pending historical GLB.
const liftOrigin=new THREE.Vector3(-20,0,-22),liftCar=new THREE.Group();scene.add(liftCar);
box([2.5,.15,2.5],[0,-1.25,0],red,liftCar);
box([2.5,.15,2.5],[0,1.25,0],cream,liftCar);
for(const x of [-1.15,1.15])for(const z of [-1.15,1.15])box([.09,2.5,.09],[x,0,z],red,liftCar);
const wellHeight=config.elevatorHigh-config.elevatorLow;
for(const dx of [-1.6,1.6])for(const dz of [-1.6,1.6])box([.12,wellHeight,.12],[liftOrigin.x+dx,(config.elevatorLow+config.elevatorHigh)/2,liftOrigin.z+dz]);
for(const h of [config.elevatorLow,config.elevatorHigh])box([5,.3,5],[liftOrigin.x,h-1.4,liftOrigin.z],cream);
const waveYaw=new THREE.Group(),waveTilt=new THREE.Group(),waveSpin=new THREE.Group();waveYaw.position.set(24,4,25);waveTilt.rotation.z=config.waveTilt;waveTilt.add(waveSpin);waveYaw.add(waveTilt);scene.add(waveYaw);
const disc=new THREE.Mesh(new THREE.CylinderGeometry(config.waveRadius,config.waveRadius,.4,48),cream);waveSpin.add(disc);
// Reported capacity ~80; twenty four-place benches are an assumed arrangement.
for(let i=0;i<20;i++){const a=2*Math.PI*i/20;const bench=box([1.4,.7,.6],[config.waveRadius*Math.cos(a),.55,config.waveRadius*Math.sin(a)],red,waveSpin);bench.rotation.y=-a;}
box([2,4,2],[24,2,25]);

let ready=false,disposed=false,frame=null,rendered=0;
function requestRender(){if(ready&&!disposed&&!document.hidden&&frame===null)frame=requestAnimationFrame(draw);}
function cancelRender(){if(frame!==null)cancelAnimationFrame(frame);frame=null;}
function refreshGeometry(){validateRides(config);for(let i=0;i<2;i++){const points=Array.from({length:65},(_,j)=>new THREE.Vector3(...cablePoint(j/64,i?1:-1,config)));cables[i].geometry.dispose();cables[i].geometry=new THREE.BufferGeometry().setFromPoints(points);const h=i?config.endHeight:config.startHeight;terminals[i].position.set((i?.5:-.5)*config.span,h-2,0);supports[i].position.set((i?.5:-.5)*config.span,h/2,0);supports[i].scale.y=h;}}
function update(time){const r=ropeway(gimmicks.time('ropeway',time),config),e=elevator(gimmicks.time('tower-lift',time),config),waveTime=gimmicks.time('circling-wave',time);cars.forEach((car,i)=>car.position.set(...r.cars[i].position));liftCar.position.set(liftOrigin.x,e.height,liftOrigin.z);waveSpin.rotation.y=-2*Math.PI*(waveTime%config.wavePeriod)/config.wavePeriod;waveYaw.rotation.y=config.wavePrecessionPeriod?2*Math.PI*(waveTime%config.wavePrecessionPeriod)/config.wavePrecessionPeriod:0;
 if(ride.value==='ropeway'){camera.position.copy(cars[0].position).add(new THREE.Vector3(0,-1.15,0));const direction=r.cars[0].direction;camera.lookAt(camera.position.clone().add(document.querySelector('#orientation').value==='along'?new THREE.Vector3(direction*8,0,0):new THREE.Vector3(0,0,8)));}
 if(ride.value==='elevator'){camera.position.copy(liftCar.position).add(new THREE.Vector3(0,.2,-.6));camera.lookAt(camera.position.clone().add(new THREE.Vector3(0,0,10)));}
 phase.textContent=`${clock.playing?'Playing':'Paused'} · ${time.toFixed(1)} s · ${r.schedule.phase} · lift ${e.height.toFixed(1)} m`;
}
function pause(message){const now=performance.now();clock.pause(now);update(clock.sample(now));play.textContent='Play';if(message)status.textContent=message;requestRender();}
function draw(now){frame=null;if(!ready||disposed||document.hidden)return;try{const changed=ride.value==='overview'&&controls.update();update(clock.sample(now));renderer.render(scene,camera);canvas.dataset.renderedFrames=++rendered;if(clock.playing||changed)requestRender();}catch(error){pause();ready=false;cancelRender();play.disabled=reset.disabled=true;status.textContent=`Motion stopped: ${error.message}`;console.error(error);}}
function resize(){if(!canvas.clientWidth||!canvas.clientHeight)return;camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);requestRender();}
controls.addEventListener('change',requestRender);
play.addEventListener('click',()=>{if(clock.playing)pause();else if(clock.start(performance.now())){for(const m of machines)gimmicks.startGimmick(m.id);play.textContent='Pause';status.textContent=`${backend} · local conditional motion`;requestRender();}});
reset.addEventListener('click',()=>{pause();gimmicks.parkAll();clock.seek(0,performance.now());update(0);requestRender();});
ride.addEventListener('change',()=>{controls.enabled=ride.value==='overview';if(controls.enabled){camera.position.set(85,64,95);controls.target.set(0,22,0);controls.update();}requestRender();});
document.querySelector('#orientation').addEventListener('change',requestRender);
for(const name of ['span','endHeight','sag','travelSeconds','wavePrecessionPeriod']){const input=document.querySelector('#'+name),output=document.querySelector('#'+name+'-value');input.value=config[name];input.addEventListener('input',()=>{pause();config[name]=Number(input.value);output.textContent=`${config[name]} ${['travelSeconds','wavePrecessionPeriod'].includes(name)?'s':'m'}`;gimmicks.parkAll();clock.seek(0,performance.now());refreshGeometry();update(0);requestRender();});}
const arrival=document.querySelector('#arrival');arrival.addEventListener('change',()=>{pause();config.endHeight=arrival.value==='equal'?config.startHeight:30.15;document.querySelector('#endHeight').disabled=arrival.value==='equal';document.querySelector('#endHeight').value=config.endHeight;document.querySelector('#endHeight-value').textContent=`${config.endHeight} m`;gimmicks.parkAll();clock.seek(0,performance.now());refreshGeometry();update(0);requestRender();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause('Paused while hidden. Select Play to resume.');cancelRender();}else requestRender();});
const observer=new ResizeObserver(resize);observer.observe(canvas);
window.addEventListener('pagehide',event=>{pause();cancelRender();if(event.persisted)return;disposed=true;disconnectGimmicks();observer.disconnect();controls.dispose();const geometries=new Set(),materials=new Set();scene.traverse(obj=>{if(obj.geometry)geometries.add(obj.geometry);for(const m of [].concat(obj.material||[]))materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();});
window.addEventListener('pageshow',requestRender);
let backend='';
try{await renderer.init();backend=renderer.backend?.isWebGPUBackend?'WebGPU':'WebGL 2 fallback';refreshGeometry();resize();ready=true;play.disabled=reset.disabled=false;status.textContent=`${backend} · local conditional motion · paused`;requestRender();}catch(error){status.textContent=`Could not start: ${error.message}`;console.error(error);}
