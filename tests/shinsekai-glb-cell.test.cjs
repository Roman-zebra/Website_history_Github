const test=require('node:test'),assert=require('node:assert/strict');
const {readGlb,writeGlb,extractRoot}=require('../scripts/shinsekai-glb-cell.cjs');
function fixture(){
 const chunks=[],views=[];let offset=0;
 const view=bytes=>{const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}const id=views.length;views.push({buffer:0,byteOffset:offset,byteLength:bytes.length});chunks.push(bytes);offset+=bytes.length;return id;};
 const floats=v=>{const b=Buffer.alloc(v.length*4);v.forEach((x,i)=>b.writeFloatLE(x,i*4));return b;};
 const pos=view(floats([0,0,0,1,0,0,0,1,0])),indices=view(Buffer.from([0,0,1,0,2,0])),time=view(floats([0,1])),move=view(floats([0,0,0,1,0,0])),image=view(Buffer.from([11,22,33,44])),sparseId=view(Buffer.from([1])),sparseValue=view(floats([.1,.2,.3]));
 const j={asset:{version:'2.0'},scene:0,scenes:[{nodes:[4,5]}],buffers:[{byteLength:offset}],bufferViews:views,
  accessors:[{bufferView:pos,componentType:5126,type:'VEC3',count:3},{bufferView:indices,componentType:5123,type:'SCALAR',count:3},{bufferView:time,componentType:5126,type:'SCALAR',count:2},{bufferView:move,componentType:5126,type:'VEC3',count:2},{componentType:5126,type:'VEC3',count:3,sparse:{count:1,indices:{bufferView:sparseId,componentType:5121},values:{bufferView:sparseValue}}}],
  nodes:[{name:'kept',mesh:0},{name:'other',mesh:1},{name:'lamp',extensions:{KHR_lights_punctual:{light:1}}},{name:'collision',mesh:0,extras:{collision:true}},{name:'cell_stair',translation:[0,0,-60],children:[0,2,3,6]},{name:'otherRoot',children:[1]},{name:'camera',camera:0}],
  meshes:[{primitives:[{attributes:{POSITION:0},indices:1,material:1,targets:[{POSITION:4}]}]},{primitives:[{attributes:{POSITION:0},indices:1,material:0}]}],materials:[{name:'unused'},{name:'kept',pbrMetallicRoughness:{baseColorTexture:{index:1}},extensions:{KHR_materials_clearcoat:{clearcoatNormalTexture:{index:1,scale:.4}}}}],textures:[{source:0},{source:1,sampler:0}],images:[{uri:'unused.png'},{bufferView:image,mimeType:'image/png'}],samplers:[{magFilter:9729}],
  cameras:[{type:'perspective',perspective:{yfov:1,znear:.1}}],extensionsUsed:['KHR_lights_punctual','KHR_materials_clearcoat'],extensionsRequired:['KHR_lights_punctual'],extensions:{KHR_lights_punctual:{lights:[{type:'point',intensity:99},{type:'point',intensity:12}]}},
  animations:[{name:'gate_open',samplers:[{input:2,output:3,interpolation:'LINEAR'},{input:2,output:3}],channels:[{sampler:0,target:{node:0,path:'translation'}},{sampler:1,target:{node:1,path:'translation'}}]}]};
 return {json:j,binary:Buffer.concat(chunks)};
}
test('cell extraction prunes other cells/collisions and remaps embedded images, sparse morphs, lights and clips',()=>{
 const source=fixture(),result=readGlb(extractRoot(writeGlb(source.json,source.binary),'cell_stair',{resetTranslation:true})),j=result.json;
 assert.deepEqual(j.nodes.map(n=>n.name),['cell_stair','kept','lamp','camera']);assert.deepEqual(j.nodes[0].translation,[0,0,0]);
 assert.equal(j.meshes.length,1);assert.equal(j.materials.length,1);assert.equal(j.materials[0].pbrMetallicRoughness.baseColorTexture.index,0);assert.equal(j.materials[0].extensions.KHR_materials_clearcoat.clearcoatNormalTexture.index,0);
 assert.equal(j.textures[0].source,0);assert.equal(j.images.length,1);assert.equal(j.cameras,undefined);assert.equal(j.nodes[3].camera,undefined);
 assert.equal(j.extensions.KHR_lights_punctual.lights.length,1);assert.equal(j.extensions.KHR_lights_punctual.lights[0].intensity,12);assert.equal(j.nodes[2].extensions.KHR_lights_punctual.light,0);
 assert.equal(j.animations[0].channels.length,1);assert.equal(j.animations[0].samplers.length,1);assert.equal(j.animations[0].channels[0].target.node,1);
 const p=j.meshes[0].primitives[0],a=j.accessors[p.attributes.POSITION],v=j.bufferViews[a.bufferView];assert.deepEqual(result.binary.subarray(v.byteOffset,v.byteOffset+v.byteLength),source.binary.subarray(0,36));
 const morph=j.accessors[p.targets[0].POSITION],sv=j.bufferViews[morph.sparse.values.bufferView];assert.equal(result.binary.readFloatLE(sv.byteOffset),Math.fround(.1));
 assert.ok(j.bufferViews.every(v=>v.byteOffset%4===0&&v.byteOffset+v.byteLength<=j.buffers[0].byteLength));assert.deepEqual(source.json.nodes[4].translation,[0,0,-60]);
});
test('unsupported compressed or skinned input fails closed; matrix root reset retains orientation',()=>{
 let s=fixture();s.json.meshes[0].primitives[0].extensions={KHR_draco_mesh_compression:{bufferView:0,attributes:{POSITION:0}}};assert.throws(()=>extractRoot(s,'cell_stair'),/Primitive extension/);
 s=fixture();s.json.nodes[0].skin=0;assert.throws(()=>extractRoot(s,'cell_stair'),/Skinned/);
 s=fixture();delete s.json.nodes[4].translation;s.json.nodes[4].matrix=[0,0,-1,0,0,1,0,0,1,0,0,0,3,4,5,1];const n=readGlb(extractRoot(s,'cell_stair',{resetTranslation:true})).json.nodes[0];assert.equal(n.translation,undefined);assert.deepEqual(n.matrix.slice(12,15),[0,0,0]);assert.deepEqual(n.matrix.slice(0,12),s.json.nodes[4].matrix.slice(0,12));
});
