const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {read}=require('./helpers/gltf-study-geometry.cjs');
const base=path.resolve(__dirname,'../assets-src/shinsekai/eval-building-a/hybrid/runtime');
test('optional flower GLB retains the authored bodies and budgeted original blossom anchors',()=>{
 const old=read(path.join(base,'dream.glb')),next=read(path.join(base,'dream-petals.glb'));
 const anchors=JSON.parse(next.json.nodes[next.node('UD_Dream')].extras.flowerAnchors);
 assert.equal(anchors.length,237);assert.ok(anchors.every(a=>a.originalTriangles===68));
 const groups=new Map();for(const a of anchors)groups.set(a.group,(groups.get(a.group)??0)+1);
 assert.equal(groups.size,4);
 const pointKey=point=>point.map(v=>v.toFixed(5)).join(',');
 for(const [name,count] of groups){
  assert.equal(old.triangles(old.node(name))-next.triangles(next.node(name)),count*68);
  const oldPoints=new Set(old.json.meshes[old.json.nodes[old.node(name)].mesh].primitives.flatMap(p=>old.data(p.attributes.POSITION,3).map(pointKey)));
  for(const primitive of next.json.meshes[next.json.nodes[next.node(name)].mesh].primitives)for(const point of next.data(primitive.attributes.POSITION,3))assert.ok(oldPoints.has(pointKey(point)),`${name}: retained body moved`);
 }
 for(const name of ['UD_Dream_HospitalBed','UD_Dream_Phonograph','UD_Dream_RabbitStatue','UD_Dream_Balloon_Stair','UD_Dream_Balloon_UpperCeiling'])assert.equal(old.triangles(old.node(name)),next.triangles(next.node(name)));
 const interior=read(path.join(base,'interior.glb'));
 const flowers=[...groups.keys()].reduce((sum,name)=>sum+next.triangles(next.node(name)),0)+anchors.length*80;
 const maxImpossible=Math.max(...next.json.nodes.filter(n=>n.extras?.dreamObject&&n.extras.dreamObject!=='flowers').map(n=>next.triangles(next.node(n.name))));
 const active=interior.triangles(interior.node('Hybrid_InteriorCell'))+flowers+maxImpossible;
 assert.equal(active,146554);assert.ok(active<150000);
 assert.ok(next.bytes.length<old.bytes.length);
 for(const mesh of next.json.meshes)for(const p of mesh.primitives)if(p.attributes.TANGENT!==undefined)for(const t of next.data(p.attributes.TANGENT,4))assert.ok(Math.abs(Math.hypot(...t.slice(0,3))-1)<.002);
});
