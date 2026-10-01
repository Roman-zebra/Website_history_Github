const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
async function studyModule(name){
 const root=path.resolve(__dirname,'..'),webgpu=pathToFileURL(path.join(root,'vendor/three-r186/build/three.webgpu.js')).href;
 const tslSource=fs.readFileSync(path.join(root,'vendor/three-r186/build/three.tsl.js'),'utf8').replace("'three/webgpu'",JSON.stringify(webgpu));
 const tsl='data:text/javascript;base64,'+Buffer.from(tslSource).toString('base64');
 const source=fs.readFileSync(path.join(root,'assets-src/shinsekai/browser-study',name),'utf8').replace("'three/webgpu'",JSON.stringify(webgpu)).replace("'three/tsl'",JSON.stringify(tsl));
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
test('cloth normal mixing preserves physical fields, shared materials and geometry',async()=>{
 const THREE=await import('../vendor/three-r186/build/three.webgpu.js');
 const {connectShopClothNormal}=await studyModule('shop-cloth-normal.mjs');
 const source=new THREE.MeshPhysicalMaterial({color:0x73594f,roughness:.83,sheen:.6,sheenRoughness:.72,metalness:0});
 source.name='Original cloth with fine wrinkle normal';source.normalMap=new THREE.Texture();source.normalScale.set(.7,.7);source.map=new THREE.Texture();
 const other=new THREE.MeshStandardMaterial({color:0x222222}),geometry=new THREE.BoxGeometry(),scene=new THREE.Group();
 const a=new THREE.Mesh(geometry,source),b=new THREE.Mesh(geometry,source),c=new THREE.Mesh(geometry,other);scene.add(a,b,c);
 connectShopClothNormal({scene});assert.equal(a.material,b.material);assert.notEqual(a.material,source);
 assert.equal(a.geometry,geometry);assert.equal(a.material.color.getHex(),source.color.getHex());
 for(const key of ['roughness','metalness','sheen','sheenRoughness','map','normalMap'])assert.equal(a.material[key],source[key]);
 assert.equal(a.material.userData.studyOriginalWrinkleMaterial,source);assert.ok(a.material.normalNode?.isNode);
 assert.equal(c.material,other);assert.equal(source.normalNode,undefined);assert.equal(source.normalScale.x,.7);
});
test('optional fibre sheen separates shared coloured and uncoloured geometry without mutating source data',async()=>{
 const THREE=await import('../vendor/three-r186/build/three.webgpu.js');
 const {connectShopClothNormal}=await studyModule('shop-cloth-normal.mjs');
 const source=new THREE.MeshPhysicalMaterial({sheen:1,sheenRoughness:.4,vertexColors:true});
 source.name='Original cloth with fine wrinkle normal';source.normalMap=new THREE.Texture();
 const coloured=new THREE.BoxGeometry(),plain=new THREE.BoxGeometry();
 const colours=new Float32Array(coloured.getAttribute('position').count*3).fill(.02);
 coloured.setAttribute('color',new THREE.BufferAttribute(colours,3));
 const scene=new THREE.Group(),a=new THREE.Mesh(coloured,source),b=new THREE.Mesh(coloured,source),c=new THREE.Mesh(plain,source);
 scene.add(a,b,c);const stats=connectShopClothNormal({scene},{fibreSheen:true});
 assert.equal(a.material,b.material);assert.notEqual(a.material,c.material);
 assert.ok(a.material.sheenNode?.isNode);assert.equal(c.material.sheenNode,null);
 assert.equal(c.material.sheenRoughness,source.sheenRoughness);assert.equal(source.sheenRoughness,.4);
 assert.equal(source.sheenNode,undefined);assert.equal(stats.tintedMaterials,1);
 assert.equal(a.geometry,coloured);assert.equal(coloured.getAttribute('color').array,colours);
 assert.deepEqual([...colours],new Array(colours.length).fill(Math.fround(.02)));
});
test('paper shadow transmission retains opaque visible paper and leaves timber unchanged',async()=>{
 const THREE=await import('../vendor/three-r186/build/three.webgpu.js');
 const {connectShopPaperShadows}=await studyModule('shop-paper-shadow.mjs');
 const paper=new THREE.MeshStandardMaterial({color:0xd8ceb1,roughness:.94});paper.name='M_Paper_Shoji';paper.map=new THREE.Texture();
 const timber=new THREE.MeshStandardMaterial({color:0x705237}),a=new THREE.Mesh(new THREE.BoxGeometry(),[paper,timber]),scene=new THREE.Group();scene.add(a);
 const inner=paper.clone();inner.name='SHOJI';const partition=paper.clone();partition.name='M_Paper_Fusuma';
 const b=new THREE.Mesh(new THREE.BoxGeometry(),[inner,partition]);scene.add(b);
 connectShopPaperShadows({scene});const revised=a.material[0];assert.notEqual(revised,paper);
 assert.equal(revised.color.getHex(),paper.color.getHex());assert.equal(revised.map,paper.map);assert.equal(revised.roughness,paper.roughness);
 assert.equal(revised.opacity,1);assert.equal(revised.transparent,false);assert.ok(revised.castShadowNode?.isNode);
 assert.equal(revised.userData.studyOriginalShadowMaterial,paper);assert.equal(a.material[1],timber);
 assert.equal(b.material[0],inner,'inner paper retains the source comparison by default');
 connectShopPaperShadows({scene},{names:['SHOJI']});
 assert.notEqual(b.material[0],inner);assert.ok(b.material[0].castShadowNode?.isNode);
 assert.equal(b.material[0].userData.studyOriginalShadowMaterial,inner);
 assert.equal(b.material[1],partition,'opaque partitions are outside window paper scope');
});
