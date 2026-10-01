import * as THREE from 'three/webgpu';
import {positionLocal,mx_noise_float,materialColor,vec2,vec3,float,smoothstep} from 'three/tsl';

// Measured support contacts from frozen hall__benches iron geometry (metres).
export const HALL_BENCH_FOOT_Z=Object.freeze([-13.6101,-11.558615,-9.497455,-7.449685,-5.40698,-3.345025,-1.316575]);
export function cloneHallFloorMaterial(source){return new THREE.MeshStandardNodeMaterial().copy(source);}
export function decorateHallFloorWear(material){
 const x=positionLocal.x,z=positionLocal.z;
 const edge=float(1).sub(smoothstep(.035,.42,x.min(float(3.55).sub(x))));
 const walk=float(1).sub(smoothstep(.48,1.05,x.sub(1.775).abs()));
 const broad=mx_noise_float(positionLocal.mul(.85)).mul(.5).add(.5).clamp(0,1);
 let feet=float(0);for(const contactZ of HALL_BENCH_FOOT_Z){const distance=vec2(x.sub(.31).div(.28),z.sub(contactZ).div(.22)).length();feet=feet.max(float(1).sub(smoothstep(.4,1,distance)));}
 const dirt=edge.mul(.18).add(walk.mul(broad.mul(.045).add(.025))).add(feet.mul(.14)).clamp(0,.3);
 material.colorNode=materialColor.mul(vec3(1).sub(vec3(.85,.96,1).mul(dirt)));
}
