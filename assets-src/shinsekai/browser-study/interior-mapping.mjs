import * as THREE from 'three/webgpu';
import {Fn,positionGeometry,modelWorldMatrixInverse,cameraPosition,vec3,vec4,color,mix,uv,normalMap} from 'three/tsl';

// Original procedural room, viewed from a true recessed window back plane.
// Local axes: X horizontal,Y vertical,+Z into room. No borrowed room atlas.
export function createInteriorMappingMaterial({width=3.4,floor=-1.25,height=2.8,depth=2.8}={}) {
 const material=new THREE.MeshBasicNodeMaterial({side:THREE.FrontSide});
 material.name='original parallax room study';
 material.colorNode=Fn(()=>{
  const origin=positionGeometry,camera=modelWorldMatrixInverse.mul(vec4(cameraPosition,1)).xyz;
  const direction=origin.sub(camera).normalize();
  const safe=vec3(direction.x.greaterThanEqual(0).select(direction.x.max(.0001),direction.x.min(-.0001)),
      direction.y.greaterThanEqual(0).select(direction.y.max(.0001),direction.y.min(-.0001)),direction.z.max(.0001));
  const tx=direction.x.greaterThanEqual(0).select(width/2,-width/2).sub(origin.x).div(safe.x),
        ty=direction.y.greaterThanEqual(0).select(floor+height,floor).sub(origin.y).div(safe.y),tz=depth/safe.z;
  const t=tx.min(ty).min(tz),hit=origin.add(direction.mul(t));
  const isFloor=ty.lessThanEqual(tx).and(ty.lessThanEqual(tz)).and(direction.y.lessThan(0));
  const planks=hit.x.mul(5).fract().smoothstep(.94,.99);
  const floorColor=mix(color(0x5a3d25),color(0x2f251d),planks);
  const wallColor=mix(color(0x716450),color(0x4b4539),hit.y.sub(floor).div(height).clamp(0,1));
  let result=isFloor.select(floorColor,wallColor);
  // A real ray/box intersection gives the cabinet its own parallax/occlusion.
  const near=vec3(-.65,floor,depth-.85).sub(origin).div(safe),far=vec3(.65,floor+.95,depth-.20).sub(origin).div(safe);
  const lo=near.min(far),hi=near.max(far),entry=lo.x.max(lo.y).max(lo.z),exit=hi.x.min(hi.y).min(hi.z);
  const cabinet=exit.greaterThanEqual(entry.max(0)).and(entry.greaterThan(0)).and(entry.lessThan(t));
  result=cabinet.select(color(0x3f2c1b),result);
  const distanceFade=t.div(depth*2).clamp(0,.35).oneMinus();
  return result.mul(distanceFade).mul(.7);
 })();
 return material;
}

// Static slight period-glass waviness, with independent glass mesh/depth.
// A conservative alpha surface; physical transmission/refraction is pending.
export function createPeriodGlassMaterial() {
 const material=new THREE.MeshPhysicalNodeMaterial({color:0x718884,roughness:.035,metalness:.03,
    transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide});
 const coordinates=uv();
 material.normalNode=normalMap(vec3(coordinates.x.mul(31).add(coordinates.y.mul(5)).sin().mul(.012).add(.5),
    coordinates.y.mul(23).add(coordinates.x.mul(4)).sin().mul(.010).add(.5),1));
 const corner=coordinates.x.min(coordinates.x.oneMinus()).min(coordinates.y.min(coordinates.y.oneMinus()));
 material.roughnessNode=corner.smoothstep(.01,.09).oneMinus().mul(.10).add(.035);
 material.name='separate subtly wavy period glass study';return material;
}
