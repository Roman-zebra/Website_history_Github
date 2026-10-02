const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
async function fixture(enabled,withUpstream=false){
 const url=p=>pathToFileURL(path.resolve(__dirname,p)).href;
 const THREE=await import(url('../vendor/three-r186/build/three.webgpu.js'));
 let code=fs.readFileSync(path.resolve(__dirname,'../assets-src/shinsekai/browser-study/hall-proxy-shadow-look.mjs'),'utf8');
 code=code.replace(/import \{([^}]+)\} from 'three\/tsl';/, 'const {$1}=THREE.TSL;');
 for(const [from,to]of [['three/webgpu',url('../vendor/three-r186/build/three.webgpu.js')],['three/tsl',url('../vendor/three-r186/build/three.tsl.js')],['./hall-scoped-material-ao.mjs',url('../assets-src/shinsekai/browser-study/hall-scoped-material-ao.mjs')]])code=code.replaceAll("'"+from+"'",JSON.stringify(to));
 const {createHallProxyShadowLook}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const scene=new THREE.Scene(),root=new THREE.Group(),point=new THREE.PointLight(0xffaa77,2),light=new THREE.DirectionalLight(0xffe2ba,3);light.position.set(-20,40,30);scene.add(root,light,point);
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardNodeMaterial(),glass=new THREE.MeshStandardNodeMaterial({transparent:true,opacity:.3});
 const mesh=new THREE.Mesh(geometry,material),alpha=new THREE.Mesh(geometry,glass);root.add(mesh,alpha);
 const upstream=withUpstream?new THREE.Mesh(geometry,material):null;if(upstream){upstream.position.copy(light.position).multiplyScalar(1.2);scene.add(upstream);}
 let geometryDisposed=0,sourceDisposed=0;geometry.addEventListener('dispose',()=>geometryDisposed++);material.addEventListener('dispose',()=>sourceDisposed++);
 const originalTarget={name:'original'},originalMRT={name:'mrt'};let target=originalTarget,mrt=originalMRT;
 const draws=[],renderer={isRenderer:true,shadowMap:{enabled:false,type:1},getRenderTarget:()=>target,getMRT:()=>mrt,setRenderTarget:t=>target=t,setMRT:v=>mrt=v,render(s,c){draws.push({scene:s,camera:c,target,mrt});}};
 const scope=createHallProxyShadowLook(renderer,scene,root,light,{enabled});
 return {scope,renderer,draws,mesh,alpha,material,glass,geometry,light,point,upstream,THREE,originalTarget,originalMRT,get geometryDisposed(){return geometryDisposed;},get sourceDisposed(){return sourceDisposed;}};
}
test('null shadow scopes only opaque copies and restores exact source assignments on draw failure',async()=>{
 const f=await fixture(false),shadow=f.light.shadow,target=f.light.target;
 assert.throws(()=>f.scope.withApplied(()=>{assert.notEqual(f.mesh.material,f.material);assert.equal(f.alpha.material,f.glass);assert.equal(f.renderer.getRenderTarget(),f.originalTarget);throw Error('beauty');}),/beauty/);
 assert.equal(f.mesh.material,f.material);assert.equal(f.alpha.material,f.glass);assert.equal(f.draws.length,0);assert.equal(f.light.castShadow,false);assert.equal(f.light.shadow,shadow);assert.equal(f.light.target,target);assert.deepEqual(f.renderer.shadowMap,{enabled:false,type:1});
 f.scope.dispose();f.scope.dispose();assert.equal(f.geometryDisposed,0);assert.equal(f.sourceDisposed,0);
});
test('independent depth updates moving caster transforms and restores renderer target/MRT before beauty',async()=>{
 const f=await fixture(true);f.mesh.position.x=2;
 f.scope.withApplied(()=>{assert.equal(f.renderer.getRenderTarget(),f.originalTarget);assert.equal(f.renderer.getMRT(),f.originalMRT);});
 assert.equal(f.draws.length,1);assert.equal(f.draws[0].scene.children.length,1);assert.equal(f.draws[0].scene.children[0].matrix.elements[12],2);assert.equal(f.draws[0].scene.children[0].geometry,f.geometry);assert.equal(f.draws[0].mrt,null);
 f.mesh.position.x=3;f.scope.withApplied(()=>{});assert.equal(f.draws[1].scene.children[0].matrix.elements[12],3);
 assert.equal(f.light.intensity,3);assert.equal(f.light.castShadow,false);assert.equal(f.mesh.material,f.material);f.scope.dispose();assert.equal(f.geometryDisposed,0);
});
test('failed independent depth draw does not strand offscreen target or material copies',async()=>{
 const f=await fixture(true);f.renderer.render=()=>{throw Error('depth');};assert.throws(()=>f.scope.withApplied(()=>assert.fail('beauty must not execute')),/depth/);assert.equal(f.renderer.getRenderTarget(),f.originalTarget);assert.equal(f.renderer.getMRT(),f.originalMRT);assert.equal(f.mesh.material,f.material);f.scope.dispose();assert.equal(f.sourceDisposed,0);
});
test('owned light nodes keep original light-id order despite different scene traversal order',async()=>{
 const f=await fixture(false);assert.ok(f.point.id<f.light.id);
 f.scope.withApplied(()=>{const nodes=f.mesh.material.lightsNode.getBuiltinLights();assert.deepEqual(nodes.map(n=>n.light),[f.point,f.light]);assert.ok(nodes[0].id<nodes[1].id);});
 assert.equal(f.point.intensity,2);assert.equal(f.light.intensity,3);assert.equal(f.point.castShadow,false);f.scope.dispose();assert.equal(f.sourceDisposed,0);
});
test('depth range includes upstream casters beyond the light origin and refits their motion without moving the source light',async()=>{
 const f=await fixture(true,true),lightPosition=f.light.position.clone();f.scope.withApplied(()=>{});
 const camera=f.draws[0].camera,stats=f.scope.stats.frustum;assert.ok(stats.originShift>0);assert.ok(stats.near<stats.nearestCasterDepth);
 for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]){const p=new f.THREE.Vector3(x,y,z).applyMatrix4(f.upstream.matrixWorld).applyMatrix4(camera.matrixWorldInverse);assert.ok(-p.z>=camera.near);}
 const oldShift=stats.originShift;f.upstream.position.multiplyScalar(1.3);f.scope.withApplied(()=>{});assert.ok(f.scope.stats.frustum.originShift>oldShift);assert.deepEqual(f.light.position,lightPosition);assert.equal(f.upstream.material,f.material);f.scope.dispose();assert.equal(f.geometryDisposed,0);assert.equal(f.sourceDisposed,0);
});
