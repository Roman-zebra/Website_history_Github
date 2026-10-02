import * as THREE from 'three/webgpu';
import {Fn,uv,positionLocal,positionView,normalGeometry,normalView,faceDirection,smoothstep} from 'three/tsl';

// Source UV0 uses nominal metres. Art dimensions, not historic weave measurements.
// Normal-only upper tatami; source colour/roughness/edging and ground stay fixed.
export function connectShopTatamiNormal(model,{gain=1}={}){
 if(![0,1].includes(gain))throw new Error('Invalid tatami normal comparison');
 const revised=new Map();
 const structure=model.scene.getObjectByName('BldgA_Interior_Structure');
 // A multi-primitive glTF mesh loads as a named Group with individual Mesh children.
 if(gain&&structure)structure.traverse(o=>{
  if(!o.isMesh)return;
  const replace=source=>{
   if(source.name!=='M_Tatami'||source.normalMap||source.bumpMap||source.normalNode||source.userData.studyOriginalTatamiMaterial)return source;
   if(revised.has(source))return revised.get(source);
   const Material=source.isMeshPhysicalMaterial?THREE.MeshPhysicalNodeMaterial:THREE.MeshStandardNodeMaterial;
   const material=new Material().copy(source);
   material.normalNode=Fn(()=>{
    const coord=uv(0);
    // Derivatives always execute; frequencies vanish before they become unresolved.
    const filteredWave=(metres,pitch)=>{
     const cycles=metres.div(pitch).toVar();
     return cycles.mul(2*Math.PI).sin().mul(smoothstep(.2,.45,cycles.fwidth()).oneMinus());
    };
    const top=normalGeometry.y.greaterThan(.9).select(1,0).mul(positionLocal.y.greaterThan(3).select(1,0));
    const height=filteredWave(coord.y,.0042).mul(.00018).add(filteredWave(coord.x,.02).mul(.00004)).mul(top).toVar();
    const dx=positionView.dFdx(),dy=positionView.dFdy();
    const a=dy.cross(normalView),b=normalView.cross(dx),det=dx.dot(a).mul(faceDirection);
    const gradient=a.mul(height.dFdx()).add(b.mul(height.dFdy())).mul(det.sign());
    return normalView.mul(det.abs()).sub(gradient).normalize();
   })();
   material.userData.studyOriginalTatamiMaterial=source;
   revised.set(source,material);return material;
  };
  o.material=Array.isArray(o.material)?o.material.map(replace):replace(o.material);
 });
 return {materials:revised.size,gain,scope:'upper upward-facing structural tatami only',pitchesMetres:[.0042,.02],heightAmplitudesMetres:[.00018,.00004],frequencyFadeCyclesPerPixel:[.2,.45],sourceColourRoughnessUVGeometryPreserved:true,edgingUnchanged:true,addedTextures:0,addedDraws:0,addedTriangles:0,inferred:true};
}
