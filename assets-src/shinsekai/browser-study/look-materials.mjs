import * as THREE from 'three/webgpu';
import {texture,positionWorld,mix,vec3,color,uv} from 'three/tsl';

// Claude95's selected CC0 maps; tint, wear and placement remain look assumptions.
export async function applyLookMaterials(model,{canProceed=()=>true}={}) {
 const loader=new THREE.TextureLoader(),maps=new Map(),textures=[];
 const files=['large_sandstone_blocks_diff_2048.jpg','large_sandstone_blocks_nor_gl_2048.jpg','large_sandstone_blocks_arm_2048.jpg',
  'green_metal_rust_diff_1024.jpg','green_metal_rust_nor_gl_1024.jpg','green_metal_rust_arm_1024.jpg',
  'Plaster007_Color_1024.jpg','Plaster007_NormalGL_1024.jpg','Plaster007_Roughness_1024.jpg',
  'PaintedPlaster006_Color_1024.jpg','PaintedPlaster006_Roughness_1024.jpg','Metal041B_Color_1024.jpg'];
 const response=await fetch('./materials/ao/PROVENANCE.json');if(!response.ok)throw new Error('AO manifest failed to load.');
 const aoManifest=await response.json(),aoByNode=new Map(aoManifest.maps.map(m=>[m.node,m]));
 files.push(...aoManifest.maps.map(m=>'ao/'+m.file));
 const results=await Promise.allSettled(files.map(async file=>{const map=await loader.loadAsync('./materials/'+file);map.flipY=false;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=4;map.colorSpace=/diff|Color/.test(file)?THREE.SRGBColorSpace:THREE.NoColorSpace;maps.set(file,map);textures.push(map);}));
 const failure=results.find(r=>r.status==='rejected');
 if(failure||!canProceed()){textures.forEach(t=>t.dispose());throw failure?.reason??new DOMException('Study left while loading materials.','AbortError');}
 const replacements=new Map(),oldMaterials=new Set(),dirt=positionWorld.y.smoothstep(0,2).oneMinus();
 const dirtSample=texture(maps.get('PaintedPlaster006_Color_1024.jpg')).rgb;
 model.traverse(o=>{if(!o.isMesh)return;const atlas=aoByNode.get(o.name),aoMap=atlas?maps.get('ao/'+atlas.file):null;if(aoMap)aoMap.channel=1;o.material=[].concat(o.material).map(old=>{
  const key=atlas?.file??'no-atlas';if(replacements.get(old)?.has(key))return replacements.get(old).get(key);
  const iron=old.name.includes('dark iron'),stone=old.name.includes('pale masonry'),plaster=old.name.includes('trim');
  if(!iron&&!stone&&!plaster){if(!aoMap)return old;const plain=old.clone();plain.aoMap=aoMap;plain.aoMapIntensity=.65;plain.needsUpdate=true;if(!replacements.has(old))replacements.set(old,new Map());replacements.get(old).set(key,plain);oldMaterials.add(old);return plain;}
  const prefix=iron?'green_metal_rust':stone?'large_sandstone_blocks':'Plaster007',size=stone?2048:1024;
  const diffuse=maps.get(prefix+(plaster?'_Color_':'_diff_')+size+'.jpg'),normal=maps.get(prefix+(plaster?'_NormalGL_':'_nor_gl_')+size+'.jpg');
  const arm=plaster?null:maps.get(prefix+'_arm_'+size+'.jpg'),rough=plaster?maps.get('Plaster007_Roughness_1024.jpg'):arm;
  const material=new THREE.MeshStandardNodeMaterial({name:'look / '+old.name,normalMap:normal,roughnessMap:rough,metalnessMap:arm,aoMap:arm,metalness:iron?.65:0,roughness:plaster?.9:1});material.normalScale.setScalar(iron?.28:.45);
  if(aoMap)material.aoNode=mix(1,texture(aoMap,uv(1)).r,.65).mul(arm?texture(arm).r:1);
  const sample=texture(diffuse).rgb,grey=sample.dot(vec3(.2126,.7152,.0722)),tint=color(iron?0x5c5852:0xd8cbb4);
  const albedo=iron?grey.mul(1.3).mul(tint):mix(vec3(.65),sample,.6).mul(tint);
  if(iron){const joint=positionWorld.y.sub(15.15).mod(3).abs().smoothstep(.05,.3).oneMinus();material.colorNode=mix(albedo,texture(maps.get('Metal041B_Color_1024.jpg')).rgb,joint.mul(.08));}
  else {material.colorNode=mix(albedo,dirtSample.mul(tint),dirt.mul(.12)).mul(dirt.mul(.18).oneMinus());}
  if(!replacements.has(old))replacements.set(old,new Map());replacements.get(old).set(key,material);oldMaterials.add(old);return material;
 });if(o.material.length===1)o.material=o.material[0];});
 oldMaterials.forEach(m=>m.dispose());
 return {dispose(){textures.forEach(t=>t.dispose());},maps:files.length,status:'CC0 maps; metric UV0; original Blender baked AO on UV1; lightmaps pending'};
}
