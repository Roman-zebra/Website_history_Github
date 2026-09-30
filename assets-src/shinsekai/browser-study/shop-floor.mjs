import {reflector,textureBicubic} from 'three/tsl';

// Inferred removable runners, not a claim about the historical shop floor.
// One horizontal plane; rough mip sampling is a study approximation, not SSR.
export function connectShopFloor(scene,model){
 const reflection=reflector({resolutionScale:.35,bounces:false,generateMipmaps:true});
 reflection.target.rotation.x=-Math.PI/2;reflection.target.position.y=.018;
 const materials=new Set();
 model.scene.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material))if(m.name==='Hero polished aisle timber')materials.add(m);});
 if(!materials.size){reflection.dispose();return {dispose(){}};}
 scene.add(reflection.target);
 // The renderer's standard-to-node conversion retains these custom node fields.
 for(const m of materials){m.emissiveNode=textureBicubic(reflection,2.5).rgb.mul(.16);m.needsUpdate=true;}
 return {dispose(){scene.remove(reflection.target);reflection.dispose();}};
}
