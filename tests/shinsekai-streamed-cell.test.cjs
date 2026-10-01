const test=require('node:test'),assert=require('node:assert/strict');
const receipt=()=>({revision:'aa030cd',sourceUnchanged:true,partitionUnionExact:true,parts:['core','desk','lamps','furnishings'].map(group=>({file:'cell_hall-'+group+'.glb',bytes:100000,sha256:'a'.repeat(64),attributesAndAnimationBytesExact:true,sourceEncodedImagesExact:true,triangleOrderAndWindingExact:true}))});
test('stream receipt refuses missing parts and accounts total bytes rather than individual requests',async()=>{
 const {hallStreamParts}=await import('../assets-src/shinsekai/browser-study/streamed-cell.mjs'),r=receipt();assert.equal(hallStreamParts(r,'cell_hall').length,4);
 assert.throws(()=>hallStreamParts({...r,parts:r.parts.slice(1)},'cell_hall'),/Missing/);
 r.parts.forEach(p=>p.bytes=6000000);assert.throws(()=>hallStreamParts(r,'cell_hall'),/total/);
});
test('room assembly waits for every part and exposes their source transforms only together',async()=>{
 const {loadStreamedCell}=await import('../assets-src/shinsekai/browser-study/streamed-cell.mjs'),parts=receipt().parts;let finish,constructed=false;
 const pending=new Promise(resolve=>finish=resolve),models=parts.map((p,i)=>({scene:{name:p.file,position:[i,0,0]},animations:[]}));
 const work=loadStreamedCell(parts,{load:file=>file===parts[3].file?pending:models.find(m=>m.scene.name===file),createScene:()=>{constructed=true;return {children:[],add(scene){this.children.push(scene);}};},release:()=>assert.fail('Successful parts must not be released during attach')});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(constructed,false);finish(models[3]);const result=await work;assert.equal(result.scene.children.length,4);assert.deepEqual(result.scene.children[2].position,[2,0,0]);assert.equal(result.streamParts.length,4);
});
test('failed loads settle delayed siblings and release every successful resource before rejection',async()=>{
 const {loadStreamedCell}=await import('../assets-src/shinsekai/browser-study/streamed-cell.mjs');let finish;const slow=new Promise(resolve=>finish=resolve),released=[];
 const work=loadStreamedCell([{file:'fail'},{file:'fast'},{file:'slow'}],{load:file=>file==='fail'?Promise.reject(new Error('404')):file==='slow'?slow:{scene:{name:file}},createScene:()=>assert.fail('Incomplete room must not attach'),release:model=>released.push(model.scene.name)});
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(released,[]);finish({scene:{name:'slow'}});await assert.rejects(work,/404/);assert.deepEqual(released.sort(),['fast','slow']);
});
test('construction or cleanup errors still attempt all sibling releases',async()=>{
 const {loadStreamedCell}=await import('../assets-src/shinsekai/browser-study/streamed-cell.mjs'),released=[];
 await assert.rejects(loadStreamedCell([{file:'a'},{file:'b'}],{load:file=>({scene:{name:file}}),createScene:()=>{throw new Error('assembly');},release:model=>{released.push(model.scene.name);if(model.scene.name==='a')throw new Error('dispose');}}),/cleanup/);assert.deepEqual(released,['a','b']);
});
