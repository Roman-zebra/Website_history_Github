const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {readGlb,writeGlb}=require('../scripts/shinsekai-glb-cell.cjs');
const {repairUpperCushion}=require('../scripts/shinsekai-glb-upper-cushion.cjs');
const bytes=fs.readFileSync(require('node:path').join(__dirname,'../assets-src/shinsekai/eval-building-a/hybrid/runtime/interior.glb'));
function target(j){return j.meshes[j.nodes.find(n=>n.name==='Hybrid_Sonnet_upper').mesh].primitives.find(p=>j.materials[p.material].name==='CLOTH');}
function block(file,id){const a=file.json.accessors[id],v=file.json.bufferViews[a.bufferView];return file.binary.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);}
for(const [shiftY,seamBottom] of [[0,.018],[.165,.018],[.165,.040]])test('one cushion closes with48 triangles at rearward shift '+shiftY+' and seam '+seamBottom+' while original binary, attributes outside target, colour/UV/wear, materials and all unrelated primitives remain exact',()=>{
 const source=readGlb(bytes),r=repairUpperCushion(bytes,{shiftY,seamBottom}),after=readGlb(r.bytes),a=target(source.json),b=target(after.json),changed=new Set(r.receipt.selectedVertexIds),body=new Set(r.receipt.bodyVertexIds);
 assert.ok(after.binary.subarray(0,source.binary.length).equals(source.binary));for(const name of ['nodes','scenes','materials','textures','images','animations','extensions'])assert.deepEqual(after.json[name],source.json[name]);
 const sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},widths={5123:2,5126:4};
 for(const [name,id]of Object.entries(a.attributes)){const old=block(source,id),fresh=block(after,b.attributes[name]),acc=source.json.accessors[id],width=sizes[acc.type]*widths[acc.componentType];for(let i=0;i<acc.count;i++){if(name==='POSITION'&&changed.has(i)||['NORMAL','TANGENT'].includes(name)&&body.has(i))continue;assert.ok(old.subarray(i*width,(i+1)*width).equals(fresh.subarray(i*width,(i+1)*width)),name+' index'+i);}}
 assert.ok(block(after,b.indices).subarray(0,block(source,a.indices).length).equals(block(source,a.indices)));assert.equal(after.json.accessors[b.indices].count-source.json.accessors[a.indices].count,144);assert.equal(r.receipt.extraDraws,0);assert.equal(r.receipt.addedTriangles,48);
 for(let i=0;i<source.json.meshes.length;i++)for(let p=0;p<source.json.meshes[i].primitives.length;p++)if(source.json.meshes[i].primitives[p]!==a)assert.deepEqual(after.json.meshes[i].primitives[p],source.json.meshes[i].primitives[p]);
 const positions=block(after,b.attributes.POSITION);const ys=r.receipt.selectedVertexIds.map(i=>positions.readFloatLE(i*12+4));assert.ok(Math.abs(Math.min(...ys)-3.455)<1e-6);assert.ok(Math.abs(Math.max(...ys)-3.535)<1e-6);
 const originalPositions=block(source,a.attributes.POSITION);for(const i of changed){assert.equal(positions.readFloatLE(i*12),originalPositions.readFloatLE(i*12));assert.ok(Math.abs(positions.readFloatLE(i*12+8)-originalPositions.readFloatLE(i*12+8)+shiftY)<1e-6);}
});
test('cushion repair refuses transformed/shared nodes and changed attribute contracts instead of altering a different object',()=>{
 for(const shiftY of [-.01,.166,NaN,Infinity])assert.throws(()=>repairUpperCushion(bytes,{shiftY}));
 for(const seamBottom of [-.01,.041,NaN,Infinity])assert.throws(()=>repairUpperCushion(bytes,{shiftY:.165,seamBottom}));assert.throws(()=>repairUpperCushion(bytes,{seamBottom:.04}));
 for(const edit of [j=>j.nodes.find(n=>n.name==='Hybrid_Sonnet_upper').translation=[1,0,0],j=>j.nodes.push({mesh:j.nodes.find(n=>n.name==='Hybrid_Sonnet_upper').mesh}),j=>j.accessors[target(j).attributes.COLOR_0].count--]){const file=readGlb(bytes);edit(file.json);assert.throws(()=>repairUpperCushion(writeGlb(file.json,file.binary)));}
});
