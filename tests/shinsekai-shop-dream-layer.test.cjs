const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {read}=require('./helpers/gltf-study-geometry.cjs');
const base=path.resolve(__dirname,'../assets-src/shinsekai/eval-building-a/hybrid');
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('111 actual dream nodes obey one impossible object and the active interior triangle budget',async()=>{
 const {stageDream}=await import('../assets-src/shinsekai/browser-study/shop-dream-layer.mjs');
 const a=read(path.join(base,'runtime/dream.glb')),interior=read(path.join(base,'runtime/interior.glb'));
 const nodes=a.json.nodes.filter(n=>n.extras?.dreamObject).map(n=>({name:n.name,userData:n.extras}));
 const model={scene:{traverse:fn=>nodes.forEach(fn)}};
 assert.equal(nodes.length,9);
 for(const view of ['ground-axis','ground-ceiling','ground-corner','ground-window','ground-street','upper-axis','upper-window','upper-street','upper-corner','upper-ceiling','floor-study','hero-counter']){
  const visible=stageDream(model,view),chosen=nodes.filter(n=>n.visible&&n.userData.dreamObject!=='flowers');
  assert.equal(nodes.filter(n=>n.visible&&n.userData.dreamObject==='flowers').length,4);
  assert.equal(chosen.length,/^(floor-study|hero-counter)$/.test(view)?0:1);
  const triangles=interior.triangles(interior.node('Hybrid_InteriorCell'))+visible.reduce((sum,name)=>sum+a.triangles(a.node(name)),0);
  assert.ok(triangles<=150000,`${view}: ${triangles}`);
 }
});

test('late dream loading cannot attach after toggle/unload; current view wins and resources release once',async()=>{
 const {createShopDreamLayer}=await import('../assets-src/shinsekai/browser-study/shop-dream-layer.mjs');
 const pending=[],attached=[],released=[];
 const model=id=>({id,scene:{traverse:fn=>[{name:'UD_Dream_HospitalBed',userData:{dreamObject:'bed'}},{name:'UD_Dream_Phonograph',userData:{dreamObject:'phonograph'}}].forEach(fn)}});
 const layer=createShopDreamLayer({load:()=>new Promise(resolve=>pending.push(resolve)),attach:m=>attached.push(m.id),release:m=>released.push(m.id)});
 layer.update(true,'upper-axis');await flush();layer.update(false,'far');
 layer.update(true,'upper-axis');await flush();layer.update(true,'upper-corner');
 pending[1](model(2));await flush();pending[0](model(1));await flush();
 assert.deepEqual(attached,[2]);assert.deepEqual(released,[1]);
 assert.deepEqual(layer.snapshot().visible,['UD_Dream_HospitalBed']);
 layer.dispose();layer.dispose();assert.deepEqual(released,[1,2]);
});

test('111 exported colour factors are clamped and tangent frames remain unit and orthogonal',()=>{
 for(const file of ['interior.glb','dream.glb']){
  const a=read(path.join(base,'runtime',file));
  for(const node of a.json.nodes.filter(n=>n.name.startsWith('UD_')&&n.mesh!==undefined)){
   for(const primitive of a.json.meshes[node.mesh].primitives){
    const {attributes}=primitive;
    assert.ok(attributes.TEXCOORD_1!==undefined,`${node.name} missing lightmap UV`);
    if(attributes.COLOR_0!==undefined){
     const accessor=a.json.accessors[attributes.COLOR_0],divisor=accessor.normalized?(accessor.componentType===5121?255:65535):1;
     for(const colour of a.data(attributes.COLOR_0,accessor.type==='VEC4'?4:3))for(const c of colour)assert.ok(c/divisor>=0&&c/divisor<=1);
    }
    if(!a.json.materials[primitive.material].normalTexture)continue;
    assert.ok(attributes.TANGENT!==undefined);
    const normals=a.data(attributes.NORMAL,3),tangents=a.data(attributes.TANGENT,4);
    for(let i=0;i<tangents.length;i++){
     const tangent=tangents[i],normal=normals[i];
     assert.ok(Math.abs(Math.hypot(...tangent.slice(0,3))-1)<.002);
     assert.ok(Math.abs(tangent[3])===1);
     assert.ok(Math.abs(normal.reduce((sum,n,k)=>sum+n*tangent[k],0))<.002);
    }
   }
  }
 }
});
