import * as THREE from 'three/webgpu';
import {texture,uv,vec2,vec3,normalMap} from 'three/tsl';

// Claude117: mix two scales and rotate the second tangent-space sample.
// Geometry, existing UV sets, base colour and physical material fields stay intact.
export function connectShopClothNormal(model){
 const revised=new Map(),angle=37*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 model.scene.traverse(o=>{
  if(!o.isMesh)return;
  const replace=source=>{
   if(!source.normalMap||!source.name.startsWith('Original cloth with fine wrinkle normal'))return source;
   if(revised.has(source))return revised.get(source);
   const material=new (source.isMeshPhysicalMaterial?THREE.MeshPhysicalNodeMaterial:THREE.MeshStandardNodeMaterial)().copy(source);
   const first=texture(source.normalMap,uv()).rgb.mul(2).sub(1);
   const coordinates=vec2(uv().x.mul(c).sub(uv().y.mul(s)),uv().x.mul(s).add(uv().y.mul(c))).mul(.37).add(vec2(.173,.419));
   const second=texture(source.normalMap,coordinates).rgb.mul(2).sub(1);
   // Return the rotated sample's slopes to the original UV tangent frame.
   const rotated=vec2(second.x.mul(c).add(second.y.mul(s)),second.y.mul(c).sub(second.x.mul(s)));
   const slopes=first.xy.div(first.z.max(.05)).mul(.68).add(rotated.div(second.z.max(.05)).mul(.32));
   const combined=vec3(slopes,1).normalize().mul(.5).add(.5);
   material.normalNode=normalMap(combined,vec2(source.normalScale.x,source.normalScale.y));
   material.userData.studyOriginalWrinkleMaterial=source;
   revised.set(source,material);return material;
  };
  o.material=Array.isArray(o.material)?o.material.map(replace):replace(o.material);
 });
 return {materials:revised.size,scales:[1,.37],rotationDegrees:37,weights:[.68,.32],geometryChanged:false};
}
