import * as THREE from 'three/webgpu';
import {vec3,float,positionWorld} from 'three/tsl';
import {towerWeatherNodes} from './tower-weathering.mjs';
import {waitCaptureFrame,encodeCanvasPng} from './capture-frame.mjs';
const canvas=document.querySelector('#view'),status=document.querySelector('#status'),capture=document.querySelector('#capture');
const renderer=new THREE.WebGPURenderer({canvas,antialias:true,forceWebGL:new URLSearchParams(location.search).has('webgl')});
renderer.setPixelRatio(1);renderer.setSize(1280,720,false);renderer.toneMapping=THREE.AgXToneMapping;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x56616c);
const camera=new THREE.OrthographicCamera(-22,22,12.375,-12.375,.1,80);camera.position.set(0,12,30);camera.lookAt(0,12,0);
scene.add(new THREE.HemisphereLight(0xe7e8de,0x413b33,2));const sun=new THREE.DirectionalLight(0xffddaa,3);sun.position.set(-12,28,15);scene.add(sun);
for(const [x,strength,withAO] of [[-12,0,false],[0,1,false],[12,1,true]]){
 const material=new THREE.MeshStandardNodeMaterial({roughness:.7});
 // Explicit synthetic repeated crevice input, not a building AO bake.
 const ao=withAO?positionWorld.y.mod(4).smoothstep(.05,.3).mul(.7).add(.3):float(1);
 Object.assign(material,towerWeatherNodes({albedo:vec3(.56,.46,.32),strength,ao}));
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(9,24,.5),material);mesh.position.set(x,12,0);scene.add(mesh);
}
let disposed=false,wait=null,initializing=null;
const fail=error=>{canvas.dataset.rendererError=error.message;status.textContent='描画失敗：'+error.message;capture.disabled=true;};
async function settle(){const queue=renderer.backend.isWebGPUBackend?renderer.backend.device?.queue:null;if(!queue)return;let timer;try{await Promise.race([queue.onSubmittedWorkDone(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('GPU待機が終了しませんでした。')),5000);})]);}finally{clearTimeout(timer);}}
initializing=(async()=>{try{await renderer.init();if(disposed)return;if(renderer.backend.isWebGPUBackend)renderer.backend.device.addEventListener('uncapturederror',event=>{if(!disposed)fail(event.error);});await renderer.compileAsync(scene,camera);if(!disposed){renderer.render(scene,camera);await settle();if(!canvas.dataset.rendererError){canvas.dataset.backend=renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2';canvas.dataset.ready='true';status.textContent=canvas.dataset.backend+' · 1280×720 · 材質準備完了';capture.disabled=false;}}}catch(error){if(!disposed)fail(error);}})();
capture.addEventListener('click',async()=>{capture.disabled=true;canvas.dataset.capture='pending';try{if(document.hidden||disposed)throw new Error('表示中に保存してください。');renderer.render(scene,camera);wait=waitCaptureFrame({request:requestAnimationFrame,cancel:cancelAnimationFrame});await wait.promise;wait=null;renderer.render(scene,camera);await settle();if(canvas.dataset.rendererError||document.hidden||disposed)throw new Error('画像保存を中止しました。');wait=encodeCanvasPng(canvas);const blob=await wait.promise;wait=null;if(!blob||disposed)throw new Error('保存できませんでした。');const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='tower-weathering-'+canvas.dataset.backend+'-1280x720.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);canvas.dataset.capture='saved';}catch(error){canvas.dataset.capture='failed';status.textContent=error.message;}finally{wait=null;if(!disposed&&!canvas.dataset.rendererError)capture.disabled=false;}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)wait?.cancel();});
window.addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;wait?.cancel();initializing.finally(()=>{scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});renderer.dispose();});});
