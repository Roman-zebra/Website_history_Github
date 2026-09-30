const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const folder=path.resolve(__dirname,'../assets-src/shinsekai/tower-study');
const read=file=>{const b=fs.readFileSync(path.join(folder,file)),n=b.readUInt32LE(12);return JSON.parse(b.subarray(20,20+n));};
const descendants=(m,index)=>[index,...(m.nodes[index].children??[]).flatMap(i=>descendants(m,i))];
const triangles=(m,index)=>descendants(m,index).reduce((sum,i)=>sum+(m.nodes[i].mesh===undefined?0:m.meshes[m.nodes[i].mesh].primitives.reduce((n,p)=>n+m.accessors[p.indices].count/3,0)),0);
test('tower detail LOD candidates preserve landings,16 stable bays, real recess and separate glass within window budget',()=>{
 const source=read('tower-study-v4-open-gallery.glb'),counts=[];
 for(let lod=0;lod<3;lod++){
  const m=read(`tower-study-v5-detail-lod${lod}-open-gallery.glb`),windows=m.nodes.map((n,i)=>({n,i})).filter(({n})=>n.extras?.windowStudy);
  assert.deepEqual(m.scenes[0].extras.lift,source.scenes[0].extras.lift);assert.equal(windows.length,16);
  assert.equal(new Set(windows.map(({n})=>n.extras.cellId)).size,16);
  let count=0;
  for(const {n,i} of windows){
   const spec=JSON.parse(n.extras.windowStudy);assert.equal(spec.lod,lod);assert.equal(spec.revealM,.30);assert.equal(spec.glassBehindFrameM,.04);assert.match(spec.status,/assumed/);
   assert.equal(n.extras.featureId,'first-tower');const parts=descendants(m,i).map(j=>m.nodes[j]);
   assert.equal(parts.filter(p=>p.name.startsWith('separate glass')).length,lod===0?6:1);
   assert.ok(parts.some(p=>p.name.startsWith('interior mapping back')));
   const t=triangles(m,i);assert.ok(t<=800,`LOD${lod} window ${n.name} has${t}triangles`);count+=t;
  }
  counts.push(count);
 }
 assert.ok(counts[0]>counts[1]&&counts[1]>counts[2],`LODs must reduce triangles: ${counts}`);
});

test('metric UV derivative preserves detailed panes, geometry and landing contract',()=>{
 const source=read('tower-study-v5-detail-lod0-open-gallery.glb'),mapped=read('tower-study-v5-detail-look-uv.glb');
 assert.deepEqual(mapped.scenes[0].extras.lift,source.scenes[0].extras.lift);
 assert.deepEqual(mapped.nodes.map(n=>[n.name,n.mesh,n.children,n.translation,n.rotation,n.scale]),source.nodes.map(n=>[n.name,n.mesh,n.children,n.translation,n.rotation,n.scale]));
 // Metric UV seams may duplicate vertices; compare actual triangle positions.
 assert.deepEqual(mapped.meshes.map(m=>m.primitives.map(p=>mapped.accessors[p.indices].count)),source.meshes.map(m=>m.primitives.map(p=>source.accessors[p.indices].count)));
 const {read:geometry}=require('./helpers/gltf-study-geometry.cjs');
 const before=geometry(path.join(folder,'tower-study-v5-detail-lod0-open-gallery.glb')),after=geometry(path.join(folder,'tower-study-v5-detail-look-uv.glb'));
 for(let i=0;i<source.meshes.length;i++)for(let j=0;j<source.meshes[i].primitives.length;j++){
  const a=source.meshes[i].primitives[j],b=mapped.meshes[i].primitives[j];
  const signature=(asset,p)=>{const v=asset.data(p.attributes.POSITION,3),indices=asset.data(p.indices,1).flat(),faces=[];for(let k=0;k<indices.length;k+=3)faces.push(indices.slice(k,k+3).map(i=>v[i].map(x=>Math.round(x*1e6)/1e6).join(',')).sort().join(';'));return faces.sort();};
  assert.deepEqual(signature(after,b),signature(before,a));
 }
 assert.equal(mapped.nodes.filter(n=>n.extras?.windowStudy).length,16);
});
