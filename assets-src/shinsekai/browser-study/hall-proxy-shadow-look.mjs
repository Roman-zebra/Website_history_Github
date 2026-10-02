import * as THREE from 'three/webgpu';
import {uniform,positionWorld,positionView,vec2,vec4,float,texture} from 'three/tsl';
import {createHallScopedMaterialAO} from './hall-scoped-material-ao.mjs';

// Independent colour-depth pass: never enables renderer shadow maps or changes alpha flags.
// Linear light-view depth avoids backend-specific clip-depth conventions.
export function createHallProxyShadowLook(renderer,scene,root,light,{enabled=false,mapSize=1024}={}){
 if(!renderer?.isRenderer||!scene?.isScene||!root?.isObject3D||!light?.isDirectionalLight||![512,1024,2048].includes(mapSize))throw new Error('Invalid hall proxy shadow');
 const proxyScene=new THREE.Scene();proxyScene.background=new THREE.Color(1,1,1);
 const camera=new THREE.OrthographicCamera(),range=uniform(1),viewMatrix=uniform(new THREE.Matrix4()),projection=uniform(new THREE.Matrix4());
 const depthMaterial=new THREE.NodeMaterial();depthMaterial.fragmentNode=vec4(positionView.z.negate().div(range),0,0,1);depthMaterial.side=THREE.DoubleSide;depthMaterial.toneMapped=false;
 const proxies=[];
 const actors=[];
 scene.updateMatrixWorld(true);
 scene.traverse(o=>{if(/_door_wing_[EW]_leaf[NS]$/.test(o.name))actors.push(o);});
 scene.traverse(o=>{
  if(!o.isMesh||!o.visible)return;
  const materials=[].concat(o.material??[]);
  // Unsupported deformation/alpha is excluded explicitly, never silently flattened.
  if(o.isSkinnedMesh||o.isInstancedMesh||o.morphTargetInfluences||!materials.length||materials.some(m=>!m||m.transparent||m.alphaTest>0))return;
  const proxy=new THREE.Mesh(o.geometry,depthMaterial);proxy.matrixAutoUpdate=false;proxy.matrix.copy(o.matrixWorld);proxyScene.add(proxy);const localBounds=o.geometry.boundingBox?.clone()??new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position);proxies.push({source:o,proxy,localBounds});
 });
 if(!proxies.length){depthMaterial.dispose();throw new Error('No opaque hall shadow casters');}
 const target=new THREE.RenderTarget(mapSize,mapSize,{type:THREE.HalfFloatType,depthBuffer:true,samples:0});target.texture.name='HallProxyShadow121.linearDepth';target.texture.minFilter=target.texture.magFilter=THREE.NearestFilter;
 const bounds=new THREE.Box3().setFromObject(root),projected=new THREE.Box3(),corner=new THREE.Vector3(),direction=new THREE.Vector3();let frustum;
 function fit(){
  scene.updateMatrixWorld(true);light.updateWorldMatrix(true,false);light.target.updateWorldMatrix(true,false);
  camera.position.setFromMatrixPosition(light.matrixWorld);camera.lookAt(new THREE.Vector3().setFromMatrixPosition(light.target.matrixWorld));camera.updateMatrixWorld(true);projected.makeEmpty();
  let nearestCasterDepth=Infinity;
  for(const {source,proxy,localBounds}of proxies){proxy.matrix.copy(source.matrixWorld);let visible=true;for(let p=source;p;p=p.parent)visible&&=p.visible;proxy.visible=visible;if(!visible)continue;for(const x of [localBounds.min.x,localBounds.max.x])for(const y of [localBounds.min.y,localBounds.max.y])for(const z of [localBounds.min.z,localBounds.max.z]){corner.set(x,y,z).applyMatrix4(proxy.matrix).applyMatrix4(camera.matrixWorldInverse);nearestCasterDepth=Math.min(nearestCasterDepth,-corner.z);}}
  // Receiver-only fitting clips upstream roofs and moving objects. Keep XY
  // tightly fitted to the room but include every visible opaque caster in Z.
  const originShift=Number.isFinite(nearestCasterDepth)?Math.max(0,.5-nearestCasterDepth):0;
  if(originShift){camera.position.addScaledVector(camera.getWorldDirection(direction),-originShift);camera.updateMatrixWorld(true);nearestCasterDepth+=originShift;}
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])projected.expandByPoint(corner.set(x,y,z).applyMatrix4(camera.matrixWorldInverse));
  camera.left=projected.min.x-.5;camera.right=projected.max.x+.5;camera.bottom=projected.min.y-.5;camera.top=projected.max.y+.5;camera.near=Math.max(.01,Math.min(-projected.max.z,nearestCasterDepth)-.5);camera.far=Math.max(camera.near+.1,-projected.min.z+2);camera.updateProjectionMatrix();
  range.value=camera.far;viewMatrix.value.copy(camera.matrixWorldInverse);projection.value.copy(camera.projectionMatrix);frustum={left:camera.left,right:camera.right,bottom:camera.bottom,top:camera.top,near:camera.near,far:camera.far,nearestCasterDepth,originShift};
 }
 fit();
 const lightPosition=viewMatrix.mul(vec4(positionWorld,1));
 const clip=projection.mul(lightPosition),uv=clip.xy.mul(.5).add(.5),currentDepth=lightPosition.z.negate().div(range);
 // Render-target UV uses the same orientation conversion as other TSL texture nodes.
 const offsets=[[-.5,-.5],[.5,-.5],[-.5,.5],[.5,.5]];
 const taps=offsets.map(([x,y])=>texture(target.texture,uv.add(vec2(x/mapSize,y/mapSize))).r.add(.001).greaterThanEqual(currentDepth).select(float(1),float(0)));
 const inBounds=uv.x.greaterThanEqual(0).and(uv.x.lessThanEqual(1)).and(uv.y.greaterThanEqual(0)).and(uv.y.lessThanEqual(1)).and(currentDepth.greaterThanEqual(0)).and(currentDepth.lessThanEqual(1));
 const visibility=enabled?inBounds.select(taps.reduce((a,b)=>a.add(b)).div(4),float(1)):float(1);
 // getShadow context is skipped by r186 when source castShadow is false. An owned
 // directional lighting node masks only this light without changing source flags.
 class ProxyDirectionalLightNode extends THREE.DirectionalLightNode{
  static get type(){return 'HallProxyDirectionalLightNode';}
  setupDirect(){const direct=super.setupDirect();return enabled?{...direct,lightColor:direct.lightColor.mul(visibility)}:direct;}
 }
 const sceneLights=[];
 scene.traverse(o=>{if(o.isLight){let visible=true;for(let p=o;p;p=p.parent)visible&&=p.visible;if(visible)sceneLights.push(o);}});
 // r186 sorts mixed light/node lists by .id. Replacing only one light with a
 // newly allocated node changes summation order. Own all light nodes, allocated
 // in original light-id order, to preserve the original accumulation sequence.
 sceneLights.sort((a,b)=>a.id-b.id);
 const ownedLightNodes=sceneLights.map(source=>{
  const Type=source===light?ProxyDirectionalLightNode:source.isDirectionalLight?THREE.DirectionalLightNode:source.isPointLight?THREE.PointLightNode:source.isHemisphereLight?THREE.HemisphereLightNode:source.isAmbientLight?THREE.AmbientLightNode:null;
  if(!Type)throw new Error('Unsupported proxy study light '+source.type);
  return new Type(source);
 });
 const lightsNode=new THREE.LightsNode().setLights(ownedLightNodes);
 let scope;try{scope=createHallScopedMaterialAO(root,{clone:s=>s.clone(),decorate:(copy,source)=>{if(source.lightsNode)throw new Error('Source already has selective lighting');copy.lightsNode=lightsNode;}});}catch(e){target.dispose();depthMaterial.dispose();throw e;}
 let disposed=false,active=false;
 return {get stats(){return {route:'independent-linear-depth-owned-directional-light-node',enabled,mapSize,casters:proxies.length,light:light.name||'global-sun',frustum,sourceMapsPreserved:true,sourceLightUnchanged:true,globalShadowStateUnchanged:true,alphaMaterialsUnchanged:true,movingTransformsSampled:true,sourceLightOrder:sceneLights.map(o=>({id:o.id,name:o.name,type:o.type})),actorBindings:actors.map(actor=>({name:actor.name,matrixWorld:actor.matrixWorld.toArray(),casters:proxies.filter(({source})=>{for(let p=source;p;p=p.parent)if(p===actor)return true;return false;}).length})),visualAcceptance:false};},withApplied(render){
  if(disposed||active||typeof render!=='function')throw new Error('Invalid proxy shadow scope');active=true;
  const savedTarget=renderer.getRenderTarget(),savedMRT=renderer.getMRT();
  try{fit();if(enabled){try{renderer.setMRT(null);renderer.setRenderTarget(target);renderer.render(proxyScene,camera);}finally{renderer.setRenderTarget(savedTarget);renderer.setMRT(savedMRT);}}return scope.withApplied(render);}
  finally{active=false;}
 },dispose(){if(disposed)return null;if(active)throw new Error('Cannot dispose active proxy shadow');disposed=true;scope.dispose();target.dispose();depthMaterial.dispose();lightsNode.dispose();for(const node of ownedLightNodes)node.dispose();proxyScene.clear();return {ownedTargetsDisposed:1,ownedMaterialsDisposed:1,sourceGeometryDisposed:false,sourceLightsChanged:false};}};
}
