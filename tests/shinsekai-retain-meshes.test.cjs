const test=require('node:test'),assert=require('node:assert/strict');
const {writeGlb}=require('../scripts/shinsekai-glb-cell.cjs');
const {retainMeshes}=require('../scripts/shinsekai-glb-retain-meshes.cjs');
function fixture({candidate=false,flip=false,move=false}={}){
 const positions=Buffer.from(new Float32Array([0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,1,0]).buffer);
 if(move)positions.writeFloatLE(.125,candidate?36:0);
 const colours=Buffer.from(new Float32Array(Array(18).fill(candidate?.25:.75)).buffer);
 const uv1=Buffer.from(new Float32Array(Array(12).fill(candidate?.125:.625)).buffer);
 const indices=Buffer.from(new Uint16Array(flip?[0,2,1]:candidate?[3,4,5]:[0,1,2]).buffer);
 const paddedIndices=Buffer.alloc(8);indices.copy(paddedIndices);
 const binary=Buffer.concat([positions,colours,uv1,paddedIndices]);
 const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'unchanged',mesh:0}],materials:[{name:'source material'}],meshes:[{primitives:[{attributes:{POSITION:0,COLOR_0:1,TEXCOORD_1:2},indices:3,material:0}]}],buffers:[{byteLength:binary.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:72},{buffer:0,byteOffset:72,byteLength:72},{buffer:0,byteOffset:144,byteLength:48},{buffer:0,byteOffset:192,byteLength:6}],accessors:[{bufferView:0,componentType:5126,type:'VEC3',count:6},{bufferView:1,componentType:5126,type:'VEC3',count:6},{bufferView:2,componentType:5126,type:'VEC2',count:6},{bufferView:3,componentType:5123,type:'SCALAR',count:3}]};
 return writeGlb(json,binary);
}
test('retention restores frozen colours, UV1 and duplicate-vertex index bindings',()=>{
 const source=fixture(),result=retainMeshes(source,fixture({candidate:true}),['unchanged']);
 assert.equal(result.retainedPrimitives,1);
 const {readGlb}=require('../scripts/shinsekai-glb-cell.cjs');
 const before=readGlb(source),after=readGlb(result.bytes),p=after.json.meshes[0].primitives[0];
 function values(asset,id){const a=asset.json.accessors[id],v=asset.json.bufferViews[a.bufferView];return asset.binary.subarray(v.byteOffset,v.byteOffset+v.byteLength);}
 for(const key of Object.keys(p.attributes))assert.ok(values(after,p.attributes[key]).equals(values(before,before.json.meshes[0].primitives[0].attributes[key])));
 assert.ok(values(after,p.indices).equals(values(before,3)));assert.equal(after.binary.length,before.binary.length);assert.equal(after.json.accessors.length,4);
});
test('retention rejects a changed oriented triangle despite matching vertex pools',()=>{
 assert.throws(()=>retainMeshes(fixture(),fixture({candidate:true,flip:true}),['unchanged']),/oriented triangle differs/);
});
test('retention rejects moved geometry before copying appearance',()=>{
 assert.throws(()=>retainMeshes(fixture(),fixture({candidate:true,move:true}),['unchanged']),/oriented triangle differs/);
});
