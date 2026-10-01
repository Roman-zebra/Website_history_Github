import * as THREE from 'three/webgpu';
import {pass,mrt,normalView,builtinAOContext,screenUV} from 'three/tsl';
import {ao} from 'three/addons/tsl/display/GTAONode.js';

// Hall-only candidate: transparent glass must not populate normal/depth AO.
// The antialiased beauty pass still renders the original glass and full maps.
export function createHallAmbientLook(renderer,scene,camera){
 const prepass=pass(scene,camera,{samples:0});prepass.setMRT(mrt({output:normalView}));prepass.transparent=false;
 const occlusion=ao(prepass.getTextureNode('depth'),prepass.getTextureNode(),camera);
 occlusion.resolutionScale=.5;occlusion.radius.value=.35;occlusion.thickness.value=.35;
 const beautyPass=pass(scene,camera);beautyPass.contextNode=builtinAOContext(occlusion.getTextureNode().sample(screenUV).r);
 const pipeline=new THREE.RenderPipeline(renderer);pipeline.outputNode=beautyPass;
 return {render(){pipeline.render();},dispose(){pipeline.dispose();occlusion.dispose();prepass.dispose();beautyPass.dispose();}};
}
