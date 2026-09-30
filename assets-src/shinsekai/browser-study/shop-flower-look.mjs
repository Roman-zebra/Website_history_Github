import * as THREE from 'three/webgpu';
import {attribute,texture,uv,vec2,normalMap} from 'three/tsl';
import {createPetalAtlas,createChrysanthemumInstances} from './chrysanthemum-instances.mjs';

export function connectShopFlowers(model){
 const root=model.scene.getObjectByName('UD_Dream');
 if(!root?.userData.flowerAnchors)throw new Error('花の配置メタデータがありません。');
 const anchors=JSON.parse(root.userData.flowerAnchors),atlas=createPetalAtlas(THREE);
 const sampleUV=vec2(uv().x.mul(.25).add(attribute('petalTile','float')),uv().y);
 const petalMaterial=new THREE.MeshStandardNodeMaterial({roughness:.62,side:THREE.DoubleSide,alphaTest:.35});
 petalMaterial.name='Runtime_Kiku_Atlas';petalMaterial.colorNode=texture(atlas.albedo,sampleUV);petalMaterial.normalNode=normalMap(texture(atlas.relief,sampleUV).xyz,vec2(.35));
 const coreMaterial=new THREE.MeshStandardMaterial({roughness:.65});coreMaterial.name='Runtime_Kiku_Core';
 let blooms;
 try{blooms=createChrysanthemumInstances(THREE,anchors,{petalMaterial,coreMaterial});}
 catch(error){atlas.dispose();petalMaterial.dispose();coreMaterial.dispose();throw error;}
 blooms.group.name='Runtime_Chrysanthemum_Instances';root.add(blooms.group);
 return {stats:{...blooms.stats,atlasBytes:atlas.bytes,removedSourceTriangles:anchors.reduce((sum,a)=>sum+a.originalTriangles,0)},disposeTextures:()=>atlas.dispose()};
}
