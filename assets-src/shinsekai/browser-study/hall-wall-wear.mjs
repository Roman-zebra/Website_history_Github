import * as THREE from 'three/webgpu';
import {positionLocal,normalLocal,mx_noise_float,materialColor,vec3,float,smoothstep} from 'three/tsl';

export function cloneHallWallMaterial(source){return new THREE.MeshStandardNodeMaterial().copy(source);}
export function decorateHallWallWear(material){
 const broad=mx_noise_float(positionLocal.mul(.65)).mul(.5).add(.5).clamp(0,1);
 const fine=mx_noise_float(positionLocal.mul(4)).mul(.5).add(.5).clamp(0,1);
 const offset=broad.sub(.5).mul(.025);
 const band=float(1).sub(smoothstep(.015,.14,positionLocal.y.sub(1.21).sub(offset).abs()));
 const vertical=float(1).sub(smoothstep(.1,.4,normalLocal.y.abs()));
 const dirt=band.mul(vertical).mul(broad.mul(.25).add(fine.mul(.2)).add(.55)).mul(.18);
 material.colorNode=materialColor.mul(vec3(1).sub(vec3(.85,.94,1).mul(dirt)));
}
