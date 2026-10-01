const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {readGlb,writeGlb}=require('../scripts/shinsekai-glb-cell.cjs');
const {partitionGlb}=require('../scripts/shinsekai-glb-partition.cjs');
function fixture(){
 const binary=Buffer.alloc(36);[0,0,0,1,0,0,0,1,0].forEach((v,i)=>binary.writeFloatLE(v,i*4));
 const doc={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'root',translation:[3,4,5],children:[1,2,3]},{name:'shell',mesh:0},{name:'detail',translation:[1,0,0],mesh:0},{name:'lamp',translation:[0,2,0],extensions:{KHR_lights_punctual:{light:0}}}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],materials:[{name:'finish',pbrMetallicRoughness:{baseColorFactor:[.3,.4,.5,1]}}],buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,type:'VEC3',count:3,min:[0,0,0],max:[1,1,0]}],extensions:{KHR_lights_punctual:{lights:[{type:'point',intensity:30}]}},extensionsUsed:['KHR_lights_punctual']};
 const bytes=writeGlb(doc,binary),plan={root:'root',sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),parts:{core:['shell'],near:['detail']},lightOwner:'core'};return{bytes,plan,binary};
}
test('partitions preserve exact geometry, material and ancestor transforms with one light owner',()=>{
 const {bytes,plan,binary}=fixture(),outputs=partitionGlb(bytes,plan);
 assert.equal(outputs.length,2);
 for(const output of outputs){const {json:j,binary:b}=readGlb(output.bytes);assert.deepEqual(j.nodes[0].translation,[3,4,5]);assert.deepEqual(j.materials,readGlb(bytes).json.materials);assert.deepEqual(b.subarray(0,36),binary);assert.equal(j.nodes.filter(n=>n.mesh!==undefined).length,1);assert.equal(j.nodes.find(n=>n.mesh!==undefined).name,output.part==='core'?'shell':'detail');if(output.part==='near'){assert.deepEqual(j.nodes.find(n=>n.name==='detail').translation,[1,0,0]);assert.equal(j.nodes.some(n=>n.extensions?.KHR_lights_punctual),false);}else assert.equal(j.nodes.filter(n=>n.extensions?.KHR_lights_punctual).length,1);}
});
test('missing or duplicate ownership and a changed source reject incomplete streaming plans',()=>{
 const {bytes,plan}=fixture();assert.throws(()=>partitionGlb(bytes,{...plan,parts:{core:['shell']}}),/Every source/);
 assert.throws(()=>partitionGlb(bytes,{...plan,parts:{core:['shell'],near:['shell','detail']}}),/duplicate/);
 assert.throws(()=>partitionGlb(bytes,{...plan,sourceSha256:'0'.repeat(64)}),/hash mismatch/);
});
test('unloaded instance nodes retain transforms without invalid orphan instance bindings',()=>{
 const {bytes,plan}=fixture(),{json:j,binary}=readGlb(bytes);j.nodes[2].extensions={EXT_mesh_gpu_instancing:{attributes:{TRANSLATION:0}}};j.extensionsUsed.push('EXT_mesh_gpu_instancing');
 const source=writeGlb(j,binary),outputs=partitionGlb(source,{...plan,sourceSha256:crypto.createHash('sha256').update(source).digest('hex')});
 for(const output of outputs){const doc=readGlb(output.bytes).json,node=doc.nodes.find(n=>n.name==='detail');assert.deepEqual(node.translation,[1,0,0]);assert.equal(!!node.extensions?.EXT_mesh_gpu_instancing,output.part==='near');}
});
