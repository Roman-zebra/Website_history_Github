const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {read,rays}=require('./helpers/gltf-study-geometry.cjs');
const a=read(path.resolve(__dirname,'../assets-src/shinsekai/eval-building-a/hybrid/building-a.glb'));
test('104 hybrid retains sourced exterior LODs, separate cell and portable normal-map tangents without dream staging',()=>{
 const counts=[0,1,2].map(i=>a.triangles(a.node('Hybrid_LOD'+i)));assert.ok(counts[0]<=20000&&counts[0]>counts[1]&&counts[1]>counts[2]);
 assert.ok(a.triangles(a.node('Hybrid_InteriorCell'))<150000);assert.equal(a.json.nodes[a.node('Hybrid_InteriorCell')].extras.load_within_m,15);
 assert.equal(a.json.nodes[a.node('BuildingA_Hybrid')].extras.handoff,104);
 assert.ok(a.bytes.length<40000000);assert.ok(!a.json.nodes.some(n=>/Dream|ReviewOnly|Camera|window_fill|KEY_sun/.test(n.name)));
 for(const i of a.descendants(a.node('Hybrid_LOD0')))if(a.json.nodes[i].mesh!==undefined){const tags=JSON.parse(a.json.nodes[i].extras.sourceTags);assert.match(tags.assumption,/^A:/);}
 for(const mesh of a.json.meshes)for(const p of mesh.primitives){const m=a.json.materials[p.material];if(m.normalTexture)assert.ok(p.attributes.TANGENT!==undefined,'Missing normal-map tangent');}
});
test('hybrid preserves actual ground/upper floors and stair void; door aperture is clear',async()=>{
 const hit=await rays(a,['Hybrid_LOD0','Hybrid_InteriorCell']);
 const near=(x,y)=>assert.ok(Math.abs(x-y)<.018,`${x} != ${y}`);
 near(1-hit([3.7,1,-1.0],[0,-1,0]),0);
 near(4-hit([4.7,4,-3.5],[0,-1,0]),3.455);
 assert.ok(hit([5.5,3.35,-7.3],[0,-1,0])>.6,'Upper floor blocks authored stair void');
 // Right-hand open leaf is4.60..5.80m; the flexible noren begins at1.36m.
 // Check the solid opening below it; cloth/controller collision remains separate.
 assert.ok(hit([5.2,1.1,.5],[0,0,-1])>1,'Solid open-leaf aperture blocked');
 for(let step=1;step<=12;step++){
  const depth=5.75+(step-1)*.21+.10,height=.455+step*3/13;
  near(height+.015-hit([5.45,height+.015,-depth],[0,-1,0]),height);
  assert.ok(hit([5.45,height+.02,-depth],[0,1,0])>=1.8,`Stair${step}: headroom blocked`);
 }
});
