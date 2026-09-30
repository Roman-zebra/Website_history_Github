import * as THREE from 'three/webgpu';

// Deterministic frozen rain for the review photo. Motion/impact simulation is
// deliberately not represented by these original, sparse streak fixtures.
export function createRainStill({scene,camera,low=false}) {
 let seed=1912;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const count=low?128:640,vertices=[];
 for(let i=0;i<count;i++){const angle=random()*Math.PI*2,radius=4+random()*28,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,y=.8+random()*20,length=.2+random()*.4;vertices.push(x,y,z,x+.025,y-length,z+.01);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 const material=new THREE.LineBasicMaterial({color:0xa5b9d0,transparent:true,opacity:.16,depthWrite:false});
 const rain=new THREE.LineSegments(geometry,material);rain.frustumCulled=false;rain.visible=false;rain.name='frozen rain review fixture';scene.add(rain);
 return {setWet(wet){rain.visible=wet;},update(){rain.position.set(camera.position.x,0,camera.position.z);},dispose(){geometry.dispose();material.dispose();}};
}
