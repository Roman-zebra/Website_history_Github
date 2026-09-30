const test=require('node:test'),assert=require('node:assert/strict');
test('loaded gate plays the distinct open and close clips and releases bindings',async()=>{
 const THREE=await import('../vendor/three-r186/build/three.core.js'),{createTowerGatePlayback}=await import('../assets-src/shinsekai/browser-study/tower-gate-playback.mjs');
 const scene=new THREE.Group(),part=new THREE.Object3D();part.name='lift__car_gate';scene.add(part);
 const model={scene,animations:[new THREE.AnimationClip('car_gate_open',1.5,[new THREE.VectorKeyframeTrack(part.name+'.position',[0,1.5],[0,0,0,1,0,0])]),new THREE.AnimationClip('car_gate_close',1.5,[new THREE.VectorKeyframeTrack(part.name+'.position',[0,.75,1.5],[1,0,0,.2,0,0,0,0,0])])]};
 const gate=createTowerGatePlayback(THREE,model,'car_gate');gate.scrub(.5);assert.equal(part.position.x,.5);gate.play();gate.update(.75);assert.equal(part.position.x,.5);gate.update(1.5);assert.ok(Math.abs(part.position.x-.2)<1e-6);assert.equal(gate.snapshot().phase,'close');gate.update(.75);assert.equal(part.position.x,0);assert.equal(gate.snapshot().playing,false);
 gate.play();gate.update(10);assert.equal(part.position.x,0);assert.equal(gate.snapshot().playing,false);gate.dispose();gate.dispose();assert.throws(()=>gate.play(),/released/);
});
test('a clip referencing an unloaded cell fails before creating mixer bindings',async()=>{
 const THREE=await import('../vendor/three-r186/build/three.core.js'),{createTowerGatePlayback}=await import('../assets-src/shinsekai/browser-study/tower-gate-playback.mjs');
 const scene=new THREE.Group(),clip=name=>new THREE.AnimationClip(name,1.5,[new THREE.VectorKeyframeTrack('unloaded_lift_dream.position',[0,1.5],[0,0,0,1,0,0])]);
 assert.throws(()=>createTowerGatePlayback(THREE,{scene,animations:[clip('car_gate_open'),clip('car_gate_close')]},'car_gate'),/unloaded/);assert.equal(createTowerGatePlayback(THREE,{scene,animations:[]},'car_gate'),null);
});
