const test=require('node:test'),assert=require('node:assert/strict');
class Colour{constructor(rgb){this.rgb=[...rgb];}toArray(){return [...this.rgb];}fromArray(rgb){this.rgb=[...rgb];return this;}clone(){return new Colour(this.rgb);}}
function fixture(){
 const names=['light_desklamp_a','light_pend10_17','light_pend13_17','light_pend1_17','light_pend4_17','light_pend7_17','light_sconceE4','light_sconceE6','light_sconceW1','light_sconceW3','light_sconceW5'];
 const points=names.map(name=>({name:name+'_1',isPointLight:true,color:new Colour([1,.61,.26]),intensity:4.56,distance:0,decay:2}));let disposed=0;
 const texture={},geometry={},curtain={name:'curtain',emissive:new Colour([.12,.09,.05])};
 const meshes=[0,1,2].map(()=>({isMesh:true,geometry,material:['bulb','lamp_milk'].map(name=>({name,emissive:new Colour([1,.76,.40]),emissiveIntensity:name==='bulb'?40:5,roughness:.2,map:texture,clone(){return {...this,emissive:this.emissive.clone(),dispose(){disposed++;}};}}))}));
 const other={isMesh:true,material:curtain},sun={isDirectionalLight:true,color:new Colour([1,.8,.5]),intensity:.77862};
 return {points,meshes,curtain,sun,texture,geometry,model:{scene:{traverse(fn){[...points,...meshes,other,sun].forEach(fn);}}},get disposed(){return disposed;}};
}
test('lamp colour preserves linear luminance, source strengths/maps/geometry and unrelated emission across restore/re-entry',async()=>{
 const {createHallLampLook}=await import('../assets-src/shinsekai/browser-study/hall-lamp-look.mjs'),f=fixture(),original=f.meshes.map(m=>m.material),pointRGB=f.points.map(p=>p.color.toArray()),curtainRGB=f.curtain.emissive.toArray();
 const y=rgb=>rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
 const look=createHallLampLook(f.model);assert.equal(look.stats.points,11);assert.equal(look.stats.materials,6);
 f.points.forEach((p,i)=>{assert.ok(Math.abs(y(p.color.toArray())-y(pointRGB[i]))<1e-12);assert.equal(p.intensity,4.56);assert.equal(p.distance,0);assert.equal(p.decay,2);});
 f.meshes.forEach((m,i)=>{assert.equal(m.geometry,f.geometry);m.material.forEach((v,j)=>{assert.equal(v.map,f.texture);assert.equal(v.roughness,.2);assert.equal(v.emissiveIntensity,original[i][j].emissiveIntensity);assert.ok(Math.abs(y(v.emissive.toArray())-y(original[i][j].emissive.toArray()))<1e-12);});});
 assert.deepEqual(f.curtain.emissive.toArray(),curtainRGB);assert.equal(f.sun.intensity,.77862);
 look.dispose();look.dispose();assert.equal(f.disposed,6);f.meshes.forEach((m,i)=>assert.equal(m.material,original[i]));f.points.forEach((p,i)=>assert.deepEqual(p.color.toArray(),pointRGB[i]));
 const control=createHallLampLook(f.model,{mode:'control'});f.points.forEach((p,i)=>assert.deepEqual(p.color.toArray(),pointRGB[i]));control.dispose();f.meshes.forEach((m,i)=>assert.equal(m.material,original[i]));
});
test('failed or aliased emitter copies preserve point colours and source assignments; foreign points rejected before copy',async()=>{
 const {createHallLampLook}=await import('../assets-src/shinsekai/browser-study/hall-lamp-look.mjs'),f=fixture(),original=f.meshes.map(m=>m.material),rgb=f.points[0].color.toArray();let copies=0;
 assert.throws(()=>createHallLampLook(f.model,{createMaterial:s=>{if(++copies===3)throw Error('copy failed');return s.clone();}}),/copy failed/);assert.equal(f.disposed,2);f.meshes.forEach((m,i)=>assert.equal(m.material,original[i]));assert.deepEqual(f.points[0].color.toArray(),rgb);
 assert.throws(()=>createHallLampLook(f.model,{createMaterial:s=>s}),/independent/);assert.equal(f.disposed,2);
 assert.throws(()=>createHallLampLook(f.model,{createMaterial:s=>({...s,dispose(){copies++;}})}),/independent/);assert.deepEqual(f.points[0].color.toArray(),rgb);
 f.points[0].name='foreign_point';assert.throws(()=>createHallLampLook(f.model,{createMaterial:()=>{throw Error('must not copy');}}),/eleven measured/);
});
