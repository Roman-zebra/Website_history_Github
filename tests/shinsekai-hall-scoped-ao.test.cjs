const test=require('node:test'),assert=require('node:assert/strict');
function fixture(){
 let disposed=0;const map={};
 const a={name:'floor',transparent:false,opacity:1,side:2,roughness:.72,map,color:{r:.2,g:.3,b:.4}},b={...a,name:'wood'},glass={...a,name:'glass',transparent:true,opacity:.12};
 const geometry={},array=[a,glass,b],meshes=[{isMesh:true,geometry,material:array},{isMesh:true,geometry,material:a},{isMesh:true,geometry,material:glass}];
 return {a,b,glass,map,array,geometry,meshes,root:{traverse(fn){meshes.forEach(fn);}},clone:s=>({...s,dispose(){disposed++;}}),decorate:c=>{c.contextNode={ao:true};},get disposed(){return disposed;}};
}
test('opaque AO copies preserve alpha identity, shared maps and exact assignments across success, throw and reuse',async()=>{
 const {createHallScopedMaterialAO}=await import('../assets-src/shinsekai/browser-study/hall-scoped-material-ao.mjs'),f=fixture(),scope=createHallScopedMaterialAO(f.root,f);
 assert.equal(f.meshes[0].material,f.array);assert.equal(f.a.contextNode,undefined);
 scope.withApplied(()=>{assert.notEqual(f.meshes[0].material,f.array);assert.notEqual(f.meshes[0].material[0],f.a);assert.equal(f.meshes[0].material[0],f.meshes[1].material);assert.equal(f.meshes[0].material[0].map,f.map);assert.deepEqual(f.meshes[0].material[0].color,f.a.color);assert.equal(f.meshes[0].material[1],f.glass);assert.equal(f.meshes[2].material,f.glass);assert.equal(f.meshes[0].geometry,f.geometry);});
 assert.equal(f.meshes[0].material,f.array);assert.equal(f.meshes[1].material,f.a);
 assert.throws(()=>scope.withApplied(()=>{throw Error('draw');}),/draw/);assert.equal(f.meshes[0].material,f.array);assert.equal(f.meshes[1].material,f.a);
 scope.withApplied(()=>assert.equal(f.meshes[0].material[1],f.glass));scope.dispose();scope.dispose();assert.equal(f.disposed,2);assert.equal(f.meshes[0].material,f.array);assert.equal(f.a.contextNode,undefined);assert.equal(f.glass.contextNode,undefined);assert.throws(()=>scope.withApplied(()=>{}),/Invalid/);
});
test('failed decoration or lossy map copies leave cached assignments original and dispose staged copies only',async()=>{
 const {createHallScopedMaterialAO}=await import('../assets-src/shinsekai/browser-study/hall-scoped-material-ao.mjs');
 for(const reason of ['decorate','map']){const f=fixture();assert.throws(()=>createHallScopedMaterialAO(f.root,{clone:s=>reason==='map'?{...f.clone(s),map:{}}:f.clone(s),decorate:(c,s)=>{if(s===f.b)throw Error('decorate');f.decorate(c);}}),reason==='map'?/changed map/:/decorate/);assert.equal(f.meshes[0].material,f.array);assert.equal(f.meshes[1].material,f.a);assert.equal(f.disposed,reason==='map'?1:2);assert.equal(f.a.map,f.map);assert.equal(f.a.contextNode,undefined);}
});
test('original or duplicate copy aliases are rejected without disposing source materials',async()=>{
 const {createHallScopedMaterialAO}=await import('../assets-src/shinsekai/browser-study/hall-scoped-material-ao.mjs');
 for(const kind of ['source','alpha','duplicate']){const f=fixture();let copy;assert.throws(()=>createHallScopedMaterialAO(f.root,{clone:s=>kind==='source'?s:kind==='alpha'?f.glass:copy??(copy=f.clone(s)),decorate:f.decorate}),/independent/);assert.equal(f.meshes[0].material,f.array);assert.equal(f.disposed,kind==='duplicate'?1:0);assert.equal(f.glass.contextNode,undefined);assert.equal(f.a.contextNode,undefined);}
});
