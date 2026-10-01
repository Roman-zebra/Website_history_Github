const test=require('node:test'),assert=require('node:assert/strict');
const {readGlb,writeGlb}=require('../scripts/shinsekai-glb-cell.cjs');
const {retainCloth}=require('../scripts/shinsekai-glb-retain-cloth.cjs');
function fixture(){
 const j={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0,1]}],nodes:[{name:'Haori_connected',mesh:0},{name:'retained hardware',mesh:1}],materials:[{name:'frozen'}],meshes:[],images:[],buffers:[{byteLength:0}],bufferViews:[],accessors:[]},chunks=[];let offset=0;
 function data(bytes){const id=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});chunks.push(bytes);offset+=bytes.length;const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return id;}
 function attr(values,type,count,componentType=5126){const bytes=Buffer.from((componentType===5126?new Float32Array(values):new Uint16Array(values)).buffer),id=j.accessors.length;j.accessors.push({bufferView:data(bytes),componentType,type,count});return id;}
 for(let i=0;i<2;i++)j.meshes.push({primitives:[{attributes:{POSITION:attr([0,0,0,1,0,0,0,1,0],'VEC3',3),NORMAL:attr([0,0,1,0,0,1,0,0,1],'VEC3',3),TEXCOORD_0:attr([0,0,1,0,0,1],'VEC2',3),COLOR_0:attr(Array(12).fill(.5),'VEC4',3)},indices:attr([0,1,2],'SCALAR',3,5123),material:0}]});
 j.images.push({bufferView:data(Buffer.from([1,2,3,4])),mimeType:'image/png'});j.buffers[0].byteLength=offset;return writeGlb(j,Buffer.concat(chunks));
}
function change(bytes,mesh,key,value){const a=readGlb(Buffer.from(bytes)),p=a.json.meshes[mesh].primitives[0],id=key==='indices'?p.indices:p.attributes[key],v=a.json.bufferViews[a.json.accessors[id].bufferView];if(key==='indices')a.binary.writeUInt16LE(value,v.byteOffset);else a.binary.writeFloatLE(value,v.byteOffset);return writeGlb(a.json,a.binary);}
test('unchanged cloth restores exact frozen bytes despite bounded discarded hardware normals',()=>{
 const source=fixture(),candidate=change(source,1,'NORMAL',.0003),r=retainCloth(source,candidate);assert.ok(r.bytes.equals(source));assert.equal(r.targetUnchanged,true);assert.ok(r.maxDiscardedNormalDelta>.00029);
});
test('a sleeve position change preserves the complete frozen binary prefix and unrelated bindings',()=>{
 const source=fixture(),candidate=change(change(source,0,'POSITION',.1),1,'NORMAL',.0003),r=retainCloth(source,candidate),before=readGlb(source),after=readGlb(r.bytes);assert.equal(r.targetUnchanged,false);assert.ok(after.binary.subarray(0,before.binary.length).equals(before.binary));assert.deepEqual(after.json.meshes[1],before.json.meshes[1]);assert.deepEqual(after.json.images,before.json.images);assert.deepEqual(after.json.nodes,before.json.nodes);const acc=after.json.accessors[after.json.meshes[0].primitives[0].attributes.POSITION];assert.ok(Math.abs(after.binary.readFloatLE(after.json.bufferViews[acc.bufferView].byteOffset)-.1)<1e-7);
});
test('unrelated geometry, UV, colour and excessive normal changes are rejected',()=>{
 const source=fixture();for(const key of ['POSITION','TEXCOORD_0','COLOR_0','NORMAL'])assert.throws(()=>retainCloth(source,change(source,1,key,.1)),/differs|exceeds bound/);
});
test('invalid indices, material and transform edits are rejected',()=>{
 const source=fixture();assert.throws(()=>retainCloth(source,change(source,1,'indices',99)),/out of bounds/);assert.throws(()=>retainCloth(source,change(source,0,'indices',99)),/out of bounds/);for(const field of ['materials','nodes']){const a=readGlb(source);a.json[field][0].name='changed';assert.throws(()=>retainCloth(source,writeGlb(a.json,a.binary)),/changed/);}
});
