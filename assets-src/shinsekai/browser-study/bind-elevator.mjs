import * as THREE from 'three/webgpu';
import {safeElevatorTravel} from './elevator-travel.mjs';
export function bindElevator(root,clearance=0.05) {
  const unique=name=>{const matches=[];root.traverse(o=>{if(o.name===name)matches.push(o);});if(matches.length!==1)throw new Error('Missing/duplicate '+name);return matches[0];};
  const car=unique('elevator_car'),bottom=unique('elevator_well_bottom'),top=unique('elevator_well_top');
  root.updateMatrixWorld(true);
  const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert(),pivot=car.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
  const offsets=[];
  car.traverse(object=>{if(!object.geometry)return;object.geometry.computeBoundingBox();const box=object.geometry.boundingBox;
    if(!box||box.isEmpty())return;
    const transform=new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld);
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])offsets.push(new THREE.Vector3(x,y,z).applyMatrix4(transform).sub(pivot).toArray());
  });
  const local=o=>o.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse).toArray();
  const travel=safeElevatorTravel({bottom:local(bottom),top:local(top),bodyOffsets:offsets,clearance});
  return {car,travel,setFraction(fraction){const target=new THREE.Vector3(...travel.point(fraction));root.updateMatrixWorld(true);root.localToWorld(target);car.parent.worldToLocal(target);car.position.copy(target);car.updateMatrixWorld(true);},worldCentre(){return car.getWorldPosition(new THREE.Vector3());}};
}
