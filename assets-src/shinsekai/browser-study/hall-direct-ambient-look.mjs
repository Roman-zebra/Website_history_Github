import * as THREE from 'three/webgpu';
import {pass,mrt,normalView,builtinAOContext,screenUV,texture,context,float} from 'three/tsl';
import {ao} from 'three/addons/tsl/display/GTAONode.js';
import {hallPassRendererState} from './hall-pass-probe.mjs';

// Prepare only opaque geometry; the main colour/alpha draw stays on the canvas.
// A plain texture node prevents another scheduled prepass inside the main draw.
export function createHallDirectAmbientLook(renderer,scene,camera,{enabled=true}={}){
 const prepass=pass(scene,camera,{samples:0});prepass.setMRT(mrt({output:normalView}));prepass.transparent=false;
 const occlusion=ao(prepass.getTextureNode('depth'),prepass.getTextureNode(),camera);
 occlusion.resolutionScale=.5;occlusion.radius.value=.35;occlusion.thickness.value=.35;
 const prepared=occlusion.getTextureNode();
 const preparation=new THREE.RenderPipeline(renderer);preparation.outputNode=prepared;
 const originalContext=renderer.contextNode;
 const mainContext=context({...originalContext.getFlowContextData(),...builtinAOContext(enabled?texture(prepared.value,screenUV).r:float(1)).getFlowContextData()});
 let disposed=false;
 return {render(){
  if(disposed)throw new Error('Disposed hall direct AO');
  const before=hallPassRendererState(renderer,scene,camera);
  preparation.render();
  const preparedState=hallPassRendererState(renderer,scene,camera),currentContext=renderer.contextNode;
  try{renderer.contextNode=mainContext;renderer.render(scene,camera);}finally{renderer.contextNode=currentContext;}
  const after=hallPassRendererState(renderer,scene,camera);
  return {route:'opaque-preparation-direct-beauty',aoEnabled:enabled,radius:.35,thickness:.35,resolutionScale:.5,beautyAntialias:true,indirectOnly:true,opaqueDepthOnly:true,before,preparedState,after,publicStateEqual:JSON.stringify(before)===JSON.stringify(after),preparationPublicStateEqual:JSON.stringify(before)===JSON.stringify(preparedState),counters:'renderer-reported multipass; fullscreen qualification pending',visualAcceptance:false};
 },dispose(){
  if(disposed)return null;disposed=true;
  const before=hallPassRendererState(renderer,scene,camera);
  preparation.dispose();occlusion.dispose();prepass.dispose();
  const after=hallPassRendererState(renderer,scene,camera);
  return {before,after,publicStateEqual:JSON.stringify(before)===JSON.stringify(after)};
 }};
}
