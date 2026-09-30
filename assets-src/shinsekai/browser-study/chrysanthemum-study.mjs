import * as THREE from 'three/webgpu';
import {attribute,texture,uv,vec2,normalMap} from 'three/tsl';
import {createPetalAtlas,createChrysanthemumInstances} from './chrysanthemum-instances.mjs';
import {waitCaptureFrame,encodeCanvasPng} from './capture-frame.mjs';
const canvas=document.querySelector('#view'),status=document.querySelector('#status'),capture=document.querySelector('#capture');
const renderer=new THREE.WebGPURenderer({canvas,antialias:true,forceWebGL:new URLSearchParams(location.search).has('webgl')});
renderer.setPixelRatio(1);renderer.setSize(1280,720,false);renderer.toneMapping=THREE.AgXToneMapping;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x66737a);
const camera=new THREE.PerspectiveCamera(42,1280/720,.05,50);camera.position.set(0,6.8,9.5);camera.lookAt(0,0,0);
scene.add(new THREE.HemisphereLight(0xe1e9f1,0x4b3631,1.2));const sun=new THREE.DirectionalLight(0xffe3c1,3);sun.position.set(-3,7,6);scene.add(sun);
const plane=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:0x3e4944,roughness:1}));plane.rotation.x=-Math.PI/2;plane.position.y=-.3;scene.add(plane);
const atlas=createPetalAtlas(THREE),sampleUV=vec2(uv().x.mul(.25).add(attribute('petalTile','float')),uv().y);
const material=new THREE.MeshStandardNodeMaterial({roughness:.62,side:THREE.DoubleSide,alphaTest:.35});
material.colorNode=texture(atlas.albedo,sampleUV);material.normalNode=normalMap(texture(atlas.relief,sampleUV).xyz,vec2(.35));
const coreMaterial=new THREE.MeshStandardMaterial({roughness:.65}),baselineMaterial=new THREE.MeshStandardMaterial({roughness:.62,side:THREE.DoubleSide});
const colours=[[232,160,163],[226,184,129],[166,180,230]],anchors=[];
for(let i=0;i<3;i++){
 const matrix=new THREE.Matrix4().makeTranslation(2.1,.1,2.15-i*2.1);
 anchors.push({matrix:matrix.toArray(),colour:colours[i],core:[214,168,60]});
 // Same scalar ring/lift construction as the frozen source, without jitter,
 // textures, stems or surrounding room: explicitly a silhouette proxy.
 const positions=[];
 for(let ring=0;ring<3;ring++){
  const t=ring/2,count=Math.max(10-2*ring,6),length=1-.55*t,lift=(12+66*t)*Math.PI/180;
  for(let petal=0;petal<count;petal++){
   const angle=petal*Math.PI*2/count+ring*.4,c=Math.cos(angle),s=Math.sin(angle),radial=new THREE.Vector3(c,0,-s),tangent=new THREE.Vector3(-s,0,-c);
   const base=radial.clone().multiplyScalar(.1).add(new THREE.Vector3(0,.01*ring,0));
   const mid=base.clone().addScaledVector(radial,length*.5*Math.cos(lift*.6)).add(new THREE.Vector3(0,length*.5*Math.sin(lift*.6),0));
   const tip=base.clone().addScaledVector(radial,length*Math.cos(lift)).add(new THREE.Vector3(0,length*Math.sin(lift)-.1*length*(1-t),0));
   const left=mid.clone().addScaledVector(tangent,.19*length),right=mid.clone().addScaledVector(tangent,-.19*length);
   for(const v of [base,left,tip,base,tip,right])positions.push(...v.toArray());
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
 const mat=baselineMaterial.clone();mat.color.setRGB(...colours[i].map(v=>v/255),THREE.SRGBColorSpace);
 const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(-2.1,.1,2.15-i*2.1);scene.add(mesh);
 const core=new THREE.Mesh(new THREE.SphereGeometry(.16,5,3),coreMaterial.clone());core.material.color.setRGB(214/255,168/255,60/255,THREE.SRGBColorSpace);core.scale.y=.625;core.position.set(-2.1,.12,2.15-i*2.1);scene.add(core);
}
const blooms=createChrysanthemumInstances(THREE,anchors,{petalMaterial:material,coreMaterial});scene.add(blooms.group);
let disposed=false,wait=null,initializing;
const fail=error=>{canvas.dataset.rendererError=error.message;status.textContent='描画失敗：'+error.message;capture.disabled=true;};
async function settle(){const queue=renderer.backend.isWebGPUBackend?renderer.backend.device?.queue:null;if(!queue)return;let timer;try{await Promise.race([queue.onSubmittedWorkDone(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('GPU待機が終了しませんでした。')),5000);})]);}finally{clearTimeout(timer);}}
initializing=(async()=>{try{await renderer.init();if(disposed)return;if(renderer.backend.isWebGPUBackend)renderer.backend.device.addEventListener('uncapturederror',event=>{if(!disposed)fail(event.error);});await renderer.compileAsync(scene,camera);if(disposed)return;renderer.render(scene,camera);await settle();if(!canvas.dataset.rendererError){canvas.dataset.backend=renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2';canvas.dataset.ready='true';canvas.dataset.stats=JSON.stringify(blooms.stats);status.textContent=canvas.dataset.backend+' · 1280×720 · 比較準備完了';capture.disabled=false;}}catch(error){if(!disposed)fail(error);}})();
capture.addEventListener('click',async()=>{capture.disabled=true;canvas.dataset.capture='pending';try{if(document.hidden||disposed)throw new Error('表示中に保存してください。');renderer.render(scene,camera);wait=waitCaptureFrame({request:requestAnimationFrame,cancel:cancelAnimationFrame});await wait.promise;wait=null;renderer.render(scene,camera);await settle();if(canvas.dataset.rendererError||document.hidden||disposed)throw new Error('画像保存を中止しました。');wait=encodeCanvasPng(canvas);const blob=await wait.promise;wait=null;if(!blob||disposed)throw new Error('保存できませんでした。');const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='chrysanthemum-study-'+canvas.dataset.backend+'-1280x720.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);canvas.dataset.capture='saved';}catch(error){canvas.dataset.capture='failed';status.textContent=error.message;}finally{wait=null;if(!disposed&&!canvas.dataset.rendererError)capture.disabled=false;}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)wait?.cancel();});
window.addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;wait?.cancel();initializing.finally(()=>{atlas.dispose();const gs=new Set(),ms=new Set();scene.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.add(baselineMaterial);ms.add(material);ms.add(coreMaterial);ms.forEach(m=>m.dispose());renderer.dispose();});});
