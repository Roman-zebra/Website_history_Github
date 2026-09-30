import * as THREE from 'three/webgpu';
import {Fn,mix,uniform,exponentialHeightFogFactor,fog,positionWorld,cameraPosition,vec4,attribute,modelViewMatrix,cameraProjectionMatrix,cameraProjectionMatrixInverse,cameraWorldMatrix,screenUV,positionGeometry,uv,pass,mrt,output,emissive,texture3D,renderOutput} from 'three/tsl';
import {SkyMesh} from 'three/addons/objects/SkyMesh.js';
import {CSMShadowNode} from 'three/addons/csm/CSMShadowNode.js';
import {bloom} from 'three/addons/tsl/display/BloomNode.js';
import {lut3D} from 'three/addons/tsl/display/Lut3DNode.js';
import {catenaryPoints,bulbOutlineGroups} from './look-fixtures.mjs';
import {MACHINES,createGimmickState,connectGimmickEvents} from './gimmick-state.mjs';
import {applyLookMaterials} from './look-materials.mjs';

// Art-direction study settings, not a measured 1912 sky, smoke field or sun ephemeris.
export function createSceneLook({scene,camera,renderer,hemisphere,sun,ground,low=false,invalidate=()=>{}}) {
 const diagnostic=new URLSearchParams(location.search);
 let materialResources=null,disposed=false;
 const sky=new SkyMesh();sky.scale.setScalar(10000);sky.cloudCoverage.value=0;sky.cloudSpeed.value=0;
 sky.turbidity.value=7;sky.rayleigh.value=2;sky.mieCoefficient.value=.008;
 const hazeHorizon=uniform(new THREE.Color(0x95878a));
 const skyColor=sky.material.colorNode;
 sky.material.colorNode=Fn(()=>{const ray=cameraProjectionMatrixInverse.mul(vec4(screenUV.x.mul(2).sub(1),screenUV.y.oneMinus().mul(2).sub(1),1,1));const worldRay=cameraWorldMatrix.mul(vec4(ray.xyz.div(ray.w),0)).xyz.normalize();const horizon=worldRay.y.abs().smoothstep(0,.12).oneMinus();return vec4(mix(skyColor.rgb.mul(.14),hazeHorizon,horizon.mul(.88)),1);})();scene.add(sky);
 if(diagnostic.has('sky-original'))sky.material.colorNode=vec4(skyColor.rgb.mul(.14),1);
 renderer.shadowMap.enabled=true;sun.castShadow=true;sun.shadow.mapSize.set(low?1024:1536,low?1024:1536);
 sun.shadow.camera.near=.1;sun.shadow.camera.far=500;sun.shadow.bias=-.00008;sun.shadow.normalBias=.035;
 const csm=new CSMShadowNode(sun,{cascades:low?1:3,maxFar:230,mode:'practical'});csm.lightMargin=85;sun.shadow.shadowNode=csm;
 ground.receiveShadow=true;
 // The authored tower is unchanged; only the study ground reaches the fog horizon.
 ground.geometry.dispose();ground.geometry=new THREE.PlaneGeometry(4000,4000);
 const density=uniform(.00024),height=uniform(30),rangeDensity=uniform(.0025),fogTint=uniform(new THREE.Color()),scatterTint=uniform(new THREE.Color()),direction=uniform(new THREE.Vector3());
 const ray=positionWorld.sub(cameraPosition),range=ray.length().mul(rangeDensity),distanceFactor=range.mul(range).negate().exp().oneMinus();
 const heightFactor=exponentialHeightFogFactor(density,height),factor=heightFactor.max(distanceFactor).clamp(0,.98);
 const scatter=ray.normalize().dot(direction).max(0).pow(8).mul(.28);
 scene.fog=null;scene.fogNode=fog(mix(fogTint,scatterTint,scatter),factor);
 const bulbPower=uniform(5),warm=uniform(new THREE.Color(0xffa757));
 const bulbsMaterial=new THREE.MeshStandardNodeMaterial({color:0x000000,roughness:1,transparent:true,depthWrite:false,alphaTest:.05});
 const circle=uv().sub(.5).length().mul(2);bulbsMaterial.opacityNode=circle.smoothstep(.35,1).oneMinus();bulbsMaterial.emissiveNode=warm.mul(bulbPower);
 const centre=modelViewMatrix.mul(vec4(attribute('bulbOffset','vec3'),1));
 bulbsMaterial.vertexNode=cameraProjectionMatrix.mul(vec4(centre.xy.add(positionGeometry.xy.mul(.23)),centre.zw));
 const tiers=new Map(),gimmicks=createGimmickState(MACHINES.filter(m=>m.id.startsWith('tower-bulbs-')),{onStart:id=>{const tier=tiers.get(id);if(!tier||document.hidden)return false;tier.enabled.value=1;invalidate();return true;}}),disconnectGimmicks=connectGimmickEvents(document,gimmicks);
 const scenePass=pass(scene,camera);scenePass.setMRT(mrt({output,emissive:vec4(emissive,output.a)}));
 const glow=bloom(scenePass.getTextureNode('emissive'),.6,.3,.5),pipeline=new THREE.RenderPipeline(renderer);
 // Original restrained LUT, not a measured postcard/era palette. Grade after AgX.
 const size=16,lutData=new Uint8Array(size**3*4),lut=new THREE.Data3DTexture(lutData,size,size,size);lut.format=THREE.RGBAFormat;lut.type=THREE.UnsignedByteType;lut.minFilter=lut.magFilter=THREE.LinearFilter;lut.unpackAlignment=1;
 const grade=amount=>{for(let b=0;b<size;b++)for(let g=0;g<size;g++)for(let r=0;r<size;r++){const R=r/(size-1),G=g/(size-1),B=b/(size-1),l=.2126*R+.7152*G+.0722*B,i=((b*size+g)*size+r)*4;const rgb=[R+amount*(.06*l-.025*(1-l)*R),G+amount*(.005*l+.01*(1-l)*G),B+amount*(.04*(1-l)*B-.06*l*B)];for(let c=0;c<3;c++)lutData[i+c]=Math.round(255*Math.max(0,Math.min(1,rgb[c])));lutData[i+3]=255;}lut.needsUpdate=true;};
 pipeline.outputColorTransform=false;pipeline.outputNode=lut3D(renderOutput(scenePass.getTextureNode('output').add(glow)),texture3D(lut),size,uniform(1));
 if(diagnostic.has('no-lut'))pipeline.outputNode=renderOutput(scenePass.getTextureNode('output').add(glow));
 const wireMaterial=new THREE.LineBasicMaterial({color:0x211e20});
 for(const z of [-20,-28]){const points=catenaryPoints([-55,7,z],[55,7,z],1.4,64);scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),wireMaterial));}
 const poleMaterial=new THREE.MeshStandardMaterial({color:0x594237,roughness:1}),pole=new THREE.InstancedMesh(new THREE.CylinderGeometry(.12,.2,7,8),poleMaterial,4),arms=new THREE.InstancedMesh(new THREE.BoxGeometry(2.6,.12,.16),poleMaterial,4),dummy=new THREE.Object3D();let p=0;
 for(const x of [-55,55])for(const z of [-20,-28]){dummy.position.set(x,3.5,z);dummy.updateMatrix();pole.setMatrixAt(p,dummy.matrix);dummy.position.y=6.9;dummy.updateMatrix();arms.setMatrixAt(p++,dummy.matrix);}pole.castShadow=arms.castShadow=true;scene.add(pole,arms);
 // Paired level cable fixture; both endpoint location/height/span are assumptions.
 for(const x of [-.8,.8]){const points=catenaryPoints([x,16,-16],[x,16,-90],2,64);scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),wireMaterial));}
 const modes={
  dusk:{sun:[-.92,.085,-.37],direct:3.5,ambient:.65,exposure:1.15,fog:0x95878a,scatter:0xe3b98c,sky:0x8b8f9c,sunColor:0xffc48c},
  day:{sun:[-.25,.82,-.52],direct:3,ambient:1.4,exposure:1.05,fog:0xa9b4bb,scatter:0xdfc8a9,sky:0xa9b7c5,sunColor:0xffeedb},
  night:{sun:[-.92,-.08,-.37],direct:.1,ambient:.24,exposure:1.3,fog:0x273442,scatter:0x626a79,sky:0x101c2e,sunColor:0x809cce}
 };
 return {
  setMode(mode){const m=modes[mode];if(!m)return;direction.value.set(...m.sun).normalize();sky.sunPosition.value.copy(direction.value);sky.visible=mode!=='night';scene.background=new THREE.Color(m.sky);sun.position.copy(direction.value).multiplyScalar(180);sun.color.set(m.sunColor);sun.intensity=m.direct;hemisphere.intensity=m.ambient;hemisphere.color.set(mode==='day'?0xbdd0e1:0x8d9eb7);hemisphere.groundColor.set(0x554748);renderer.toneMappingExposure=m.exposure;fogTint.value.set(m.fog);hazeHorizon.value.set(m.fog);scatterTint.value.set(m.scatter);sun.castShadow=mode!=='night';bulbPower.value=mode==='day'?0:mode==='dusk'?5:7;grade(mode==='day'?.18:mode==='dusk'?.7:.55);},
  async attach(model){materialResources=await applyLookMaterials(model,{canProceed:()=>!disposed});model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});const lift=JSON.parse(model.userData.lift),study=JSON.parse(model.userData.study),roof=lift.landings[0].floor,groups=bulbOutlineGroups({roof,shaftTop:roof+(study.heightM-roof)*.72,galleryFloor:lift.landings[1].floor});for(const group of groups){const geometry=new THREE.PlaneGeometry(1,1),enabled=uniform(0),material=bulbsMaterial.clone();material.emissiveNode=warm.mul(bulbPower,enabled);geometry.setAttribute('bulbOffset',new THREE.InstancedBufferAttribute(new Float32Array(group.points.flat()),3));const bulbs=new THREE.InstancedMesh(geometry,material,group.points.length);bulbs.name=group.id;bulbs.userData={area:group.area,tier:group.tier,featureId:'first-tower'};bulbs.frustumCulled=false;scene.add(bulbs);tiers.set(group.id,{enabled,bulbs});if(!diagnostic.has('parked'))gimmicks.startGimmick(group.id);}bulbsMaterial.dispose();},
  render(){if(csm.camera)csm.updateFrustums();pipeline.render();},
  dispose(){disposed=true;disconnectGimmicks();materialResources?.dispose();csm.dispose();glow.dispose();scenePass.dispose();pipeline.dispose();lut.dispose();},
  label:`physical sky / AgX / ${low?1:3} CSM / height haze / warm bulbs + bloom / wires / time LUT / CC0 PBR; TRAA/baked AO/rain pending`
 };
}
