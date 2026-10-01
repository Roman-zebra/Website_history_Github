import * as THREE from 'three/webgpu';
import {pass,mrt,normalView,builtinAOContext,screenUV,texture,context,float} from 'three/tsl';
import {ao} from 'three/addons/tsl/display/GTAONode.js';
import {denoise} from 'three/addons/tsl/display/DenoiseNode.js';
import {hallPassRendererState} from './hall-pass-probe.mjs';
import {createHallScopedMaterialAO} from './hall-scoped-material-ao.mjs';

// Filter the AO buffer only. Source beauty maps, alpha and global context stay original.
export function createHallDenoisedAmbientLook(renderer,scene,camera,{enabled=true,root}={}){
 const prepass=pass(scene,camera,{samples:0});prepass.setMRT(mrt({output:normalView}));prepass.transparent=false;
 const occlusion=ao(prepass.getTextureNode('depth'),prepass.getTextureNode(),camera);
 occlusion.resolutionScale=.5;occlusion.radius.value=.35;occlusion.thickness.value=.35;
 const filtered=denoise(occlusion.getTextureNode(),prepass.getTextureNode('depth'),prepass.getTextureNode(),camera);
 // Public deterministic noise keeps comparisons/re-entry repeatable without vendor changes.
 const noiseData=new Uint8Array(64*64*4);let seed=0x119007;
 for(let i=0;i<noiseData.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;noiseData[i]=seed>>>24;}
 const noise=new THREE.DataTexture(noiseData,64,64);noise.wrapS=noise.wrapT=THREE.RepeatWrapping;noise.needsUpdate=true;
 filtered.noiseNode=texture(noise);
 const target=new THREE.RenderTarget(1,1,{depthBuffer:false,format:THREE.RedFormat});target.texture.name='HallAO007.filtered';
 const preparationMaterial=new THREE.NodeMaterial();preparationMaterial.fragmentNode=filtered;
 const preparation=new THREE.QuadMesh(preparationMaterial),size=new THREE.Vector2();
 const aoContext=builtinAOContext(enabled?texture(target.texture,screenUV).r:float(1)).getFlowContextData();
 let materialScope;
 function disposePreparation(){preparationMaterial.dispose();filtered.dispose();noise.dispose();target.dispose();occlusion.dispose();prepass.dispose();}
 try{materialScope=createHallScopedMaterialAO(root,{clone:source=>source.clone(),decorate:(copy,source)=>{if(source.contextNode&&!source.contextNode.isContextNode)throw new Error('Unsupported source material context');copy.contextNode=context({...source.contextNode?.getFlowContextData(),...aoContext});}});}catch(error){disposePreparation();throw error;}
 let disposed=false;
 return {render(){
  if(disposed)throw new Error('Disposed hall denoised AO');
  const before=hallPassRendererState(renderer,scene,camera),originalTarget=renderer.getRenderTarget();
  renderer.getDrawingBufferSize(size);target.setSize(Math.max(1,Math.round(size.x*.5)),Math.max(1,Math.round(size.y*.5)));
  try{renderer.setRenderTarget(target);preparation.render(renderer);}finally{renderer.setRenderTarget(originalTarget);}
  const preparedState=hallPassRendererState(renderer,scene,camera);
  materialScope.withApplied(()=>renderer.render(scene,camera));
  const after=hallPassRendererState(renderer,scene,camera);
  return {route:'opaque-material-scoped-denoised-AO',aoEnabled:enabled,...materialScope.stats,newAssetTextures:0,addedEffectTextures:3,filter:'depth-normal-aware',filterRadius:5,filterSamples:16,filterWidth:target.width,filterHeight:target.height,deterministicNoise:true,radius:.35,thickness:.35,resolutionScale:.5,beautyAntialias:true,indirectOnly:true,opaqueDepthOnly:true,before,preparedState,after,publicStateEqual:JSON.stringify(before)===JSON.stringify(after),preparationPublicStateEqual:JSON.stringify(before)===JSON.stringify(preparedState),counters:'renderer-reported multipass; fullscreen qualification pending',visualAcceptance:false};
 },dispose(){
  if(disposed)return null;disposed=true;
  const before=hallPassRendererState(renderer,scene,camera);
  materialScope.dispose();disposePreparation();
  const after=hallPassRendererState(renderer,scene,camera);
  return {before,after,publicStateEqual:JSON.stringify(before)===JSON.stringify(after)};
 }};
}
