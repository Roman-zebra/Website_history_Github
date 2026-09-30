const test=require('node:test'),assert=require('node:assert/strict');
test('original blossom matrices and colours survive instancing; geometry budget is explicit',async()=>{
 const THREE=await import('../vendor/three-r186/build/three.core.js'),{createChrysanthemumInstances}=await import('../assets-src/shinsekai/browser-study/chrysanthemum-instances.mjs');
 const anchors=[{matrix:new THREE.Matrix4().makeTranslation(4,3,-2).multiply(new THREE.Matrix4().makeRotationX(.4)).multiply(new THREE.Matrix4().makeScale(.12,.12,.12)).toArray(),colour:[235,163,180],core:[214,168,60]},
 {matrix:new THREE.Matrix4().makeTranslation(1,.2,-4).multiply(new THREE.Matrix4().makeScale(.08,.08,.08)).toArray(),colour:[160,180,230],core:[214,168,60]}];
 const materials={petalMaterial:new THREE.MeshStandardMaterial(),coreMaterial:new THREE.MeshStandardMaterial()},result=createChrysanthemumInstances(THREE,anchors,materials);
 assert.equal(result.petals.count,48);assert.equal(result.cores.count,2);
 assert.equal(result.petals.geometry.index.count/3*result.petals.count+result.cores.geometry.attributes.position.count/3*result.cores.count,result.stats.triangles);
 assert.equal(result.stats.triangles,160);
 const matrix=new THREE.Matrix4(),colour=new THREE.Color();
 for(let bloom=0;bloom<2;bloom++)for(let leaf=0;leaf<24;leaf++){
  result.petals.getMatrixAt(bloom*24+leaf,matrix);
  for(const index of [12,13,14])assert.ok(Math.abs(matrix.elements[index]-anchors[bloom].matrix[index])<.000001);
  result.petals.getColorAt(bloom*24+leaf,colour);
  const expected=new THREE.Color().setRGB(...anchors[bloom].colour.map(v=>v/255),THREE.SRGBColorSpace);
  assert.ok(Math.abs(colour.r-expected.r)<.000001);
  assert.ok([0,.25,.5,.75].includes(result.petals.geometry.attributes.petalTile.getX(bloom*24+leaf)));
 }
 assert.ok(result.petals.boundingBox.containsPoint(new THREE.Vector3(4,3,-2)));
 let disposedMaterials=0;materials.petalMaterial.addEventListener('dispose',()=>disposedMaterials++);result.dispose();assert.equal(disposedMaterials,0);
});
test('atlas has four distinct transparent outlines and finite unit normal relief',async()=>{
 const THREE=await import('../vendor/three-r186/build/three.core.js'),{createPetalAtlas,createPetalRibbon}=await import('../assets-src/shinsekai/browser-study/chrysanthemum-instances.mjs');
 const atlas=createPetalAtlas(THREE,32),colour=atlas.albedo.image.data,normal=atlas.relief.image.data;
 assert.equal(atlas.width,128);assert.equal(atlas.bytes,32*128*4*2);
 const shapes=new Set();
 for(let tile=0;tile<4;tile++){
  const alpha=[];
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
   const offset=(y*128+tile*32+x)*4;alpha.push(colour[offset+3]);
   if(x===0||x===31)assert.equal(colour[offset+3],0);
   const length=Math.hypot(...Array.from(normal.subarray(offset,offset+3),v=>v/255*2-1));assert.ok(Math.abs(length-1)<.015);
  }
  assert.ok(alpha.includes(255));assert.ok(alpha.includes(0));shapes.add(alpha.join(','));
 }
 assert.equal(shapes.size,4);
 const geometry=createPetalRibbon(THREE);geometry.computeBoundingBox();assert.ok(geometry.boundingBox.max.y-geometry.boundingBox.min.y>.2);
 assert.equal(geometry.index.count/3,3);
 for(let i=0;i<geometry.attributes.normal.count;i++)assert.ok(geometry.attributes.normal.getY(i)>0);
 assert.throws(()=>createPetalAtlas(THREE,0));
});
