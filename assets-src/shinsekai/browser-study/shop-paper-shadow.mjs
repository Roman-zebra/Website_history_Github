import * as THREE from 'three/webgpu';
import {vec4} from 'three/tsl';

// Inferred thin paper attenuation; frames and room objects still cast geometry shadows.
// This is a single-layer shadow approximation, not volumetric light transport.
export function connectShopPaperShadows(model){
 const replacements=new Map();
 model.scene.traverse(o=>{
  if(!o.isMesh)return;
  const replace=source=>{
   if(source.name!=='M_Paper_Shoji')return source;
   if(replacements.has(source))return replacements.get(source);
   const material=new THREE.MeshStandardNodeMaterial().copy(source);
   material.castShadowNode=vec4(.40,.37,.32,1);
   material.userData.studyOriginalShadowMaterial=source;
   replacements.set(source,material);return material;
  };
  o.material=Array.isArray(o.material)?o.material.map(replace):replace(o.material);
 });
 return {materials:replacements.size,transmittance:[.40,.37,.32],inferred:true};
}
