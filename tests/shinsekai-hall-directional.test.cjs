const test=require('node:test'),assert=require('node:assert/strict');
test('directional balance preserves point lights and restores source after reuse and dream',async()=>{
 const {createHallDirectionalLook}=await import('../assets-src/shinsekai/browser-study/hall-directional-look.mjs');
 const sun={name:'light_sun',isDirectionalLight:true,intensity:77.862},point={isPointLight:true,intensity:4.565,color:[1,.61,.26],distance:0};
 const pointSource=structuredClone(point),model={scene:{traverse(fn){[sun,point].forEach(fn);}}};
 const look=createHallDirectionalLook(model);look.apply(true);const value=sun.intensity;look.apply(true);assert.equal(sun.intensity,value);assert.deepEqual(point,pointSource);
 look.apply(false);assert.equal(sun.intensity,77.862);look.apply(true);look.dispose();assert.equal(sun.intensity,77.862);
 const reentry=createHallDirectionalLook(model);reentry.apply(true);assert.equal(sun.intensity,value);reentry.dispose();
});
test('ambiguous or unmeasured directional ownership is rejected',async()=>{
 const {createHallDirectionalLook}=await import('../assets-src/shinsekai/browser-study/hall-directional-look.mjs');
 const model=lights=>({scene:{traverse(fn){lights.forEach(fn);}}});
 assert.throws(()=>createHallDirectionalLook(model([])),/Expected/);
 assert.throws(()=>createHallDirectionalLook(model([{isDirectionalLight:true,intensity:1},{isDirectionalLight:true,intensity:2}])),/Expected/);
 assert.throws(()=>createHallDirectionalLook(model([{isDirectionalLight:true,intensity:NaN}])),/Expected/);
});
