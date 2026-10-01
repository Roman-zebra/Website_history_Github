import * as THREE from 'three/webgpu';
import {Fn,positionLocal,positionView,normalView,faceDirection,mx_noise_float,materialColor,materialRoughness} from 'three/tsl';

// Original, inferred plaster variation; no source textures or geometry change.
// Local metres keep the pattern fixed to the model rather than the camera.
export function connectShopWallWear(model){
 const revised=new Map();
 model.scene.traverse(o=>{
  if(!o.isMesh)return;
  const replace=source=>{
   if(!['M_Plaster_Int','UD_plaster'].includes(source.name)||source.normalMap||source.bumpMap)return source;
   if(revised.has(source))return revised.get(source);
   const material=new THREE.MeshStandardNodeMaterial().copy(source);
   const broad=mx_noise_float(positionLocal.mul(.8));
   const grain=mx_noise_float(positionLocal.mul(420));
   material.colorNode=materialColor.mul(broad.mul(.03).add(1));
   material.roughnessNode=materialRoughness.mul(grain.mul(.06).add(1)).clamp(.8,.96);
   // The texture bump helper offsets UV samples, so procedural position noise
   // needs direct height derivatives in the view-space surface gradient.
   material.normalNode=Fn(()=>{
    const height=grain.mul(.0001).add(mx_noise_float(positionLocal.mul(20)).mul(.0003)).toVar();
    const dx=positionView.dFdx(),dy=positionView.dFdy();
    const a=dy.cross(normalView),b=normalView.cross(dx),det=dx.dot(a).mul(faceDirection);
    const gradient=a.mul(height.dFdx()).add(b.mul(height.dFdy())).mul(det.sign());
    return normalView.mul(det.abs()).sub(gradient).normalize();
   })();
   material.userData.studyOriginalWallMaterial=source;
   revised.set(source,material);return material;
  };
  o.material=Array.isArray(o.material)?o.material.map(replace):replace(o.material);
 });
 return {materials:revised.size,colourVariation:.03,roughnessVariation:.06,heightAmplitudes:[.0001,.0003],geometryChanged:false,inferred:true};
}
