const test=require('node:test'),assert=require('node:assert/strict');
async function methods(){return {THREE:await import('../vendor/three-r186/build/three.core.js'),...await import('../assets-src/shinsekai/browser-study/tower-placeholder-mask.mjs')};}
function fixture(THREE,offset=0){
 const group=new THREE.Group(),positions=[],ids=[];
 for(const [x,y,z]of [[-12,2,0],[-12,6,11],[12,2,0],[-12,13,0],[-30,3,0]]){
  // Full split at every triangle corner, as exported normal/UV seams can do.
  const vertices=[[x-.1-offset,y-.1,z],[x+.1-offset,y-.1,z],[x+.1-offset,y+.1,z],[x-.1-offset,y+.1,z]];
  for(const i of [0,1,2,0,2,3]){ids.push(positions.length/3);positions.push(...vertices[i]);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(Array(positions.length).fill(.25),3));g.setAttribute('uv',new THREE.Float32BufferAttribute(Array(positions.length/3*2).fill(.5),2));g.setIndex(ids);
 const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial());mesh.name='TB_EXT_LOD0_backing';group.add(mesh);group.position.x=offset;
 const frame=new THREE.Mesh(g.clone(),mesh.material);frame.name='TB_EXT_LOD0_joinery';group.add(frame);
 return {group,mesh,frame,g};
}
test('loaded hall hides only its complete placeholder and retains stair/east/upper/cinema windows',async()=>{
 const {THREE,createTowerPlaceholderMask}=await methods(),{group,mesh,frame,g}=fixture(THREE),original=g.index.array.slice(),normal=g.getAttribute('normal').array.slice(),uv=g.getAttribute('uv').array.slice(),mask=createTowerPlaceholderMask(THREE,group),index=g.index;
 const stats=mask.select('cell_hall');assert.equal(stats.meshes[0].components,5);assert.equal(stats.meshes[0].hiddenTriangles,2);assert.equal(g.drawRange.count,24);assert.deepEqual(g.index.array.subarray(0,24),original.subarray(6));assert.equal(g.index,index);assert.deepEqual(g.getAttribute('normal').array,normal);assert.deepEqual(g.getAttribute('uv').array,uv);assert.equal(mesh.visible,true);assert.equal(frame.visible,true);assert.equal(frame.geometry.drawRange.count,Infinity);
});
test('switch/dream/unload/dispose restore source order with the same index buffer',async()=>{
 const {THREE,createTowerPlaceholderMask}=await methods(),{group,g}=fixture(THREE),original=g.index.array.slice(),mask=createTowerPlaceholderMask(THREE,group),index=g.index;
 const hall=mask.select('cell_hall'),version=index.version;assert.equal(mask.select('cell_hall_dream'),hall);assert.equal(index.version,version);const stair=mask.select('cell_stair');assert.equal(stair.meshes[0].hiddenTriangles,2);assert.deepEqual(g.index.array.subarray(0,6),original.subarray(0,6));mask.select(null);assert.deepEqual(index.array,original);assert.equal(g.drawRange.count,Infinity);mask.select('cell_cinema');assert.equal(g.drawRange.count,24);mask.dispose();mask.dispose();assert.equal(g.index,index);assert.deepEqual(index.array,original);assert.equal(g.drawRange.count,Infinity);assert.throws(()=>mask.select(null),/disposed/);
});
test('classification uses root transforms and whole split components, including faces outside a room allowance',async()=>{
 const {THREE,createTowerPlaceholderMask,partitionPlaceholderComponents}=await methods(),{group}=fixture(THREE,100);assert.equal(createTowerPlaceholderMask(THREE,group).select('cell_hall').meshes[0].hiddenTriangles,2);
 const pos=new Float32Array([-12,4.4,0,-11,4.4,0,-11,4.8,0,-12,4.4,0,-11,4.8,0,-12,4.8,0]),parts=partitionPlaceholderComponents(pos,new Uint16Array([0,1,2,3,4,5]));assert.equal(parts.length,1);assert.equal(parts[0].offsets.length,2);assert.deepEqual(parts[0].owners,['hall']);assert.ok(parts[0].max[1]>4.7);
});
test('unknown room and malformed indices fail before mutation; lift keeps all base placeholders',async()=>{
 const {THREE,createTowerPlaceholderMask,partitionPlaceholderComponents}=await methods(),{group,g}=fixture(THREE),original=g.index.array.slice(),mask=createTowerPlaceholderMask(THREE,group);assert.throws(()=>mask.select('cell_unknown'),/Unknown/);assert.deepEqual(g.index.array,original);assert.equal(mask.select('cell_lift').meshes[0].hiddenTriangles,0);assert.equal(g.drawRange.count,original.length);assert.throws(()=>partitionPlaceholderComponents(new Float32Array([0,0,0]),new Uint16Array([0,1,2])),/out of bounds/);
});
