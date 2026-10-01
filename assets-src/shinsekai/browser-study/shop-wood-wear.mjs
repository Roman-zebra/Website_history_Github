import * as THREE from 'three/webgpu';
import {positionLocal,mx_noise_float,materialColor,materialRoughness} from 'three/tsl';

// Small inferred surface variation. Existing grain/normal maps remain authoritative.
// Excludes painted timber, signs and the separately calibrated reflective floor.
export function connectShopWoodWear(model,{mode='combined'}={}){
 if(!['roughness','colour','combined'].includes(mode))throw new Error('Invalid wood wear comparison mode');
 const revised=new Map();
 model.scene.traverse(o=>{
  if(!o.isMesh)return;
  const replace=source=>{
   if(!/^(M_Timber_(Dark|Light|Aged|Natural)|UD_wood(_raw)?)$/.test(source.name)||source.userData.studyOriginalWoodMaterial)return source;
   if(revised.has(source))return revised.get(source);
   const Material=source.isMeshPhysicalMaterial?THREE.MeshPhysicalNodeMaterial:THREE.MeshStandardNodeMaterial;
   const material=new Material().copy(source);
   const broad=mx_noise_float(positionLocal.mul(.7));
   const fine=mx_noise_float(positionLocal.mul(35));
   if(mode!=='roughness')material.colorNode=materialColor.mul(broad.mul(.04).add(1));
   if(mode!=='colour')material.roughnessNode=materialRoughness.mul(fine.mul(.12).add(1)).clamp(.35,1);
   material.userData.studyOriginalWoodMaterial=source;
   revised.set(source,material);return material;
  };
  o.material=Array.isArray(o.material)?o.material.map(replace):replace(o.material);
 });
 return {materials:revised.size,mode,colourVariation:mode==='roughness'?0:.04,roughnessVariation:mode==='colour'?0:.12,newTextures:0,normalMapsPreserved:true,geometryChanged:false,inferred:true};
}
