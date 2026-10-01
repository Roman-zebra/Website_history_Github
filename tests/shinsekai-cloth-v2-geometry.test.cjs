const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),h=require('./helpers/gltf-study-geometry.cjs');
const folder=path.join(__dirname,'../assets-src/shinsekai/eval-building-a/hybrid/runtime');
const names=['UD_CoatRail_Haori','UD_DryingPole_Cloths','UD_ClothBolt_Spread'];
function hardware(asset,node){
 const result=[];
 for(const p of asset.json.meshes[asset.json.nodes[node].mesh].primitives){
  const m=asset.json.materials[p.material].name;
  if(m==='UD_cloth'||m.startsWith('Original cloth with fine wrinkle normal'))continue;
  const attrs=['POSITION','TEXCOORD_0','COLOR_0'].filter(k=>k in p.attributes);
  const data=attrs.map(k=>{const a=asset.json.accessors[p.attributes[k]];return asset.data(p.attributes[k],Number(a.type.slice(3)));});
  const indices=asset.data(p.indices,1).flat();
  for(let i=0;i<indices.length;i+=3){
   const vertices=indices.slice(i,i+3).map(v=>JSON.stringify(data.map(a=>a[v])));
   const rotations=[0,1,2].map(j=>[vertices[j],vertices[(j+1)%3],vertices[(j+2)%3]].join('|'));
   result.push(m+':'+rotations.sort()[0]);
  }
 }
 return result.sort();
}
for(const file of ['upper-cloth-v2.glb','upper-cloth-v2-sewn.glb']){
test(file+' retains source hardware triangles, UV0 and colours exactly',()=>{
 const source=h.read(path.join(folder,'upper-cloth.glb')),v2=h.read(path.join(folder,file));
 let total=0;
 for(const name of names){
  const original=source.node(name),revised=v2.node(name+'_v2');
  assert.ok(original>=0&&revised>=0,name);
  for(const field of ['translation','rotation','scale','matrix'])assert.deepEqual(v2.json.nodes[revised][field],source.json.nodes[original][field],name+' '+field);
  assert.deepEqual(hardware(v2,revised),hardware(source,original),name+' hardware');
  total+=v2.triangles(revised);
 }
 assert.ok(total>0);assert.ok(146554-4612+total<=150000);
 for(const node of v2.json.nodes)if(node.mesh!==undefined)for(const p of v2.json.meshes[node.mesh].primitives){
  assert.ok(v2.data(p.attributes.POSITION,3).every(v=>v.every(Number.isFinite)),node.name);
 }
});

test(file+' fabric bodies and rolled winding have closed exported surfaces',()=>{
 const a=h.read(path.join(folder,file));
 const nodes=a.json.nodes.filter(n=>/^(Haori_|Laundry_fold_|Bolt_unrolled$|Bolt_cotton_roll$)/.test(n.name));
 assert.equal(nodes.length,file.includes('sewn')?6:12);
 for(const node of nodes){
  const edges=new Map();
  for(const p of a.json.meshes[node.mesh].primitives){
   const positions=a.data(p.attributes.POSITION,3).map(v=>v.map(x=>Math.round(x*1e6)/1e6).join(','));
   const indices=a.data(p.indices,1).flat();
   for(let i=0;i<indices.length;i+=3)for(const [j,k]of [[0,1],[1,2],[2,0]]){
    const key=[positions[indices[i+j]],positions[indices[i+k]]].sort().join('|');
    edges.set(key,(edges.get(key)??0)+1);
   }
  }
  assert.ok([...edges.values()].every(n=>n===2),node.name+' closed boundary');
 }
});
}

test('sewn haori is one connected exported garment with attached sleeves and collar',()=>{
 const a=h.read(path.join(folder,'upper-cloth-v2-sewn.glb'));
 const nodes=a.json.nodes.filter(n=>n.mesh!==undefined&&n.name.startsWith('Haori_'));
 assert.equal(nodes.length,1);assert.equal(nodes[0].name,'Haori_connected');
 const neighbours=new Map();
 const edge=(x,y)=>{if(!neighbours.has(x))neighbours.set(x,new Set());neighbours.get(x).add(y);};
 for(const p of a.json.meshes[nodes[0].mesh].primitives){
  const positions=a.data(p.attributes.POSITION,3).map(v=>v.map(x=>Math.round(x*1e6)/1e6).join(',')),indices=a.data(p.indices,1).flat();
  for(let i=0;i<indices.length;i+=3)for(const [j,k]of [[0,1],[1,2],[2,0]]){const x=positions[indices[i+j]],y=positions[indices[i+k]];edge(x,y);edge(y,x);}
 }
 const unseen=new Set(neighbours.keys());let components=0;
 while(unseen.size){components++;const stack=[unseen.values().next().value];unseen.delete(stack[0]);
  while(stack.length)for(const n of neighbours.get(stack.pop()))if(unseen.delete(n))stack.push(n);
 }
 assert.equal(components,1,'shoulder, body, sleeve and collar connectivity');
});
