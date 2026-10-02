import * as THREE from 'three/webgpu';
import {Fn,uv,positionLocal,positionView,normalGeometry,normalView,faceDirection,smoothstep} from 'three/tsl';

// Original inferred plain cloth normals; preserve source colour and edge shape.
export function connectShopHeriNormal(model,{gain=1}={}){
 if(![0,1].includes(gain))throw new Error('Invalid heri normal comparison');
 const revised=new Map(),structure=model.scene.getObjectByName('BldgA_Interior_Structure');
 if(gain&&structure)structure.traverse(o=>{
  if(!o.isMesh)return;
  const replace=source=>{
   if(source.name!=='M_Cloth_Heri'||source.normalMap||source.bumpMap||source.normalNode||source.userData.studyOriginalHeriMaterial)return source;
   if(revised.has(source))return revised.get(source);
   const Material=source.isMeshPhysicalMaterial?THREE.MeshPhysicalNodeMaterial:THREE.MeshStandardNodeMaterial;
   const material=new Material().copy(source);
   material.normalNode=Fn(()=>{
    const coord=uv(0);
    const wave=(metres,pitch)=>{
     const cycles=metres.div(pitch).toVar();
     return cycles.mul(2*Math.PI).sin().mul(smoothstep(.2,.45,cycles.fwidth()).oneMinus());
    };
    const upperTop=normalGeometry.y.greaterThan(.9).select(1,0).mul(positionLocal.y.greaterThan(3).select(1,0));
    const height=wave(coord.x,.0016).mul(.00008).add(wave(coord.y,.0012).mul(.00005)).mul(upperTop).toVar();
    const dx=positionView.dFdx(),dy=positionView.dFdy();
    const a=dy.cross(normalView),b=normalView.cross(dx),det=dx.dot(a).mul(faceDirection);
    const gradient=a.mul(height.dFdx()).add(b.mul(height.dFdy())).mul(det.sign());
    return normalView.mul(det.abs()).sub(gradient).normalize();
   })();
   material.userData.studyOriginalHeriMaterial=source;
   revised.set(source,material);return material;
  };
  o.material=Array.isArray(o.material)?o.material.map(replace):replace(o.material);
 });
 return {materials:revised.size,gain,scope:'upper upward-facing structural Heri only',pitchesMetres:[.0016,.0012],heightAmplitudesMetres:[.00008,.00005],frequencyFadeCyclesPerPixel:[.2,.45],sourceColourRoughnessUVGeometryPreserved:true,addedTextures:0,addedDraws:0,addedTriangles:0,inferred:true};
}
