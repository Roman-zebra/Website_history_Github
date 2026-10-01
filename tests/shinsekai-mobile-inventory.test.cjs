const test=require('node:test'),assert=require('node:assert/strict');
const {writeGlb}=require('../scripts/shinsekai-glb-cell.cjs');
test('asset inventory ignores inactive scenes and accounts parent transforms, instances and overlap diagnostics',async()=>{
 const {inventoryGlb}=await import('../scripts/shinsekai-asset-inventory.mjs');
 const binary=Buffer.alloc(36);[0,0,0,1,0,0,0,1,0].forEach((x,i)=>binary.writeFloatLE(x,i*4));
 const j={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]},{nodes:[4]}],buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,type:'VEC3',count:3},{componentType:5126,type:'VEC3',count:5}],nodes:[{translation:[10,0,0],children:[1,2,3]},{name:'roof_first',mesh:0},{name:'roof_second',mesh:0},{name:'repeat',mesh:0,extensions:{EXT_mesh_gpu_instancing:{attributes:{TRANSLATION:1}}}},{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}]};
 const r=inventoryGlb(writeGlb(j,binary));assert.equal(r.activeRenderedTriangles,7);assert.equal(r.primitiveDrawsBeforeRuntimeBatching,3);assert.deepEqual(r.selectedMeshes[0].bounds,[[10,0,0],[11,1,0]]);assert.equal(r.selectedDuplicateFacesAtMicrometrePrecision.length,1);assert.ok(r.notes.some(n=>n.includes('per-instance transforms')));
});
test('decoded texture estimates include complete non-square mip chain and reject unknown formats',async()=>{
 const {imageDimensions,rgbaMipBytes}=await import('../scripts/shinsekai-asset-inventory.mjs');
 assert.equal(rgbaMipBytes(4,2),44);assert.equal(rgbaMipBytes(512,512),1398100);assert.throws(()=>rgbaMipBytes(0,1));assert.throws(()=>imageDimensions(Buffer.from('unknown')));
 const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.write('IHDR',12);png.writeUInt32BE(512,16);png.writeUInt32BE(256,20);assert.deepEqual(imageDimensions(png),{format:'PNG',width:512,height:256});
});
test('double-sided blended materials include both renderer passes in conservative budgets',async()=>{
 const {inventoryGlb}=await import('../scripts/shinsekai-asset-inventory.mjs');const binary=Buffer.alloc(36);[0,0,0,1,0,0,0,1,0].forEach((x,i)=>binary.writeFloatLE(x,i*4));
 const j={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,type:'VEC3',count:3}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],materials:[{alphaMode:'BLEND',doubleSided:true}]};
 const r=inventoryGlb(writeGlb(j,binary));assert.equal(r.activeGeometryTriangles,1);assert.equal(r.activeRenderedTriangles,2);assert.equal(r.primitiveDrawsBeforeRuntimeBatching,2);
});
test('phone assembly blocks large or unknown rooms before loading and bounds portrait render buffer',async()=>{
 const {checkPhoneAssembly,phoneBuffer}=await import('../assets-src/shinsekai/browser-study/tower-mobile-profile.mjs');
 const parts=[{file:'TB_EXT_LOD2.glb',bytes:760000,triangles:16676,draws:19,estimatedTextureBytes:0},{file:'TW_LOD2.glb',bytes:1223000,triangles:22247,draws:53,estimatedTextureBytes:1398100},{file:'cell_stair.glb',bytes:3292372,triangles:39914,draws:45,estimatedTextureBytes:12582912}];
 assert.equal(checkPhoneAssembly(parts,'cell_stair').allowed,true);assert.equal(checkPhoneAssembly(parts,'cell_hall').allowed,false);
 const oversized=[...parts,{file:'cell_hall.glb',bytes:7621616,triangles:105494,draws:84,estimatedTextureBytes:16777216}];assert.ok(checkPhoneAssembly(oversized,'cell_hall').reasons.some(r=>r.includes('cellBytes')));
 parts[1].estimatedTextureBytes=null;assert.equal(checkPhoneAssembly(parts).allowed,false);assert.deepEqual(phoneBuffer(390,844),[333,720]);assert.deepEqual(phoneBuffer(200,300),[200,300]);
});
