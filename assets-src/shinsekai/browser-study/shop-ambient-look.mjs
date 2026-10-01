import * as THREE from 'three/webgpu';
import {pass,mrt,normalView,builtinAOContext,screenUV} from 'three/tsl';
import {ao} from 'three/addons/tsl/display/GTAONode.js';

// Geometry-based screen-space occlusion, through the r186 indirect-light context.
// It does not darken direct sunlight, emissive lamps or transparent glazing.
export function createShopAmbientLook(renderer,scene,camera){
 // GTAO gathers depth texels; its input must be single-sample. Beauty keeps MSAA.
 const prepass=pass(scene,camera,{samples:0});prepass.setMRT(mrt({output:normalView}));
 const occlusion=ao(prepass.getTextureNode('depth'),prepass.getTextureNode(),camera);
 occlusion.resolutionScale=.5;occlusion.radius.value=.35;occlusion.thickness.value=.35;
 const beautyPass=pass(scene,camera);
 beautyPass.contextNode=builtinAOContext(occlusion.getTextureNode().sample(screenUV).r);
 const pipeline=new THREE.RenderPipeline(renderer);pipeline.outputNode=beautyPass;
 return {beautyPass,render(){pipeline.render();},dispose(){pipeline.dispose();occlusion.dispose();prepass.dispose();beautyPass.dispose();}};
}
