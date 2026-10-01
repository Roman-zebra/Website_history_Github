import * as THREE from 'three/webgpu';
import {pass} from 'three/tsl';

// Read public state only; this probe never repairs/reset states behind the evidence.
export function hallPassRendererState(renderer,scene,camera){
 const target=renderer.getRenderTarget(),materials=new Set();scene.traverse(object=>{for(const material of [].concat(object.material??[]))if(material.transmission>0||material.transparent===true)materials.add(material);});
 return {target:target?{texture:target.texture.uuid,width:target.width,height:target.height,samples:target.samples,type:target.texture.type}:null,mrt:renderer.getMRT()?.id??null,context:renderer.contextNode?.id??null,outputType:renderer.getOutputBufferType(),toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,colourSpace:renderer.outputColorSpace,autoClear:renderer.autoClear,clearColour:renderer.autoClearColor,clearDepth:renderer.autoClearDepth,clearStencil:renderer.autoClearStencil,transparent:renderer.transparent,opaque:renderer.opaque,lightingEnabled:renderer.lighting?.enabled??null,xr:renderer.xr.enabled,sceneOverride:scene.overrideMaterial?.uuid??null,cameraLayers:camera.layers.mask,glass:[...materials].map(m=>({name:m.name,side:m.side,transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest,transmission:m.transmission??0,thickness:m.thickness??0,forceSinglePass:m.forceSinglePass}))};
}
export function createHallPassProbe(renderer,scene,camera){
 const beauty=pass(scene,camera);beauty.transparent=true;
 const pipeline=new THREE.RenderPipeline(renderer);pipeline.outputNode=beauty;
 let disposed=false;
 return {render(){if(disposed)throw new Error('Disposed hall pass probe');const before=hallPassRendererState(renderer,scene,camera);pipeline.render();const after=hallPassRendererState(renderer,scene,camera);return {mode:'beauty-only',ao:false,normalDepthPrepass:false,beautySamples:beauty.renderTarget.samples,before,after,publicStateEqual:JSON.stringify(before)===JSON.stringify(after),visualAcceptance:false};},dispose(){if(disposed)return null;disposed=true;const before=hallPassRendererState(renderer,scene,camera);pipeline.dispose();beauty.dispose();const after=hallPassRendererState(renderer,scene,camera);return {before,after,publicStateEqual:JSON.stringify(before)===JSON.stringify(after)};}};
}
