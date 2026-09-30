const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
async function methods(){const url=pathToFileURL(path.resolve(__dirname,'../vendor/three-r186/build/three.core.js')).href,THREE=await import(url),text=fs.readFileSync(path.resolve(__dirname,'../assets-src/shinsekai/browser-study/repeated-mesh-instances.mjs'),'utf8').replace("'three/webgpu'",JSON.stringify(url));return {THREE,...await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64')),...await import('../assets-src/shinsekai/browser-study/tower-baluster-instances.mjs')};}
function fixture(THREE){
 const placements=Array.from({length:150},(_,i)=>[(i%15)*.4-3,Math.floor(i/15)*.4-2,15.57,.58]),pos=[],normal=[],uv=[],uv1=[],ids=[];
 const profile=[[.075,0],[.045,.1],[.075,.34],[.045,.5],[.042,.6],[.075,.72]];
 const add=(x,y,z,u,v,slot)=>{ids.push(pos.length/3);pos.push(x,z,-y);normal.push(0,1,0);uv.push(u,v);uv1.push((u+slot)/151,v*.1);};
 for(const [slot,[x,y,z,height]]of placements.entries())for(let ring=0;ring<5;ring++)for(let side=0;side<5;side++){
  const points=[[ring,side],[ring,(side+1)%5],[ring+1,(side+1)%5],[ring+1,side]].map(([r,k])=>{const a=Math.PI/5+k*Math.PI*2/5;return [x+profile[r][0]*Math.cos(a),y+profile[r][0]*Math.sin(a),z+profile[r][1]*height/.72,k/5,r/5,slot];});
  for(const i of [0,1,2,0,2,3])add(...points[i]);
 }
 for(const p of [[20,20,0,0,0,0],[21,20,0,1,0,0],[20,21,0,0,1,0]])add(...p);
 const g=new THREE.BufferGeometry();for(const [name,values,size]of [['position',pos,3],['normal',normal,3],['uv',uv,2],['uv1',uv1,2]])g.setAttribute(name,new THREE.Float32BufferAttribute(values,size));g.setIndex(ids);
 return {mesh:new THREE.Mesh(g,new THREE.MeshStandardMaterial()),placements};
}
test('150 exact repeated components preserve shape/UV0 while compacted trim keeps its packed UV1',async()=>{
 const {THREE,repeatedMeshInstances,createTowerBalusterInstances}=await methods(),{mesh,placements}=fixture(THREE),old=mesh.geometry;
 const r=createTowerBalusterInstances(THREE,mesh,placements,repeatedMeshInstances);assert.equal(r.mesh.count,150);assert.equal(r.stats.triangles,7500);assert.equal(r.stats.retainedTrimTriangles,1);assert.equal(r.stats.sourceTriangles,7501);assert.equal(r.stats.newDraws,2);assert.equal(r.stats.sourceDraws,1);
 assert.equal(r.remaining.getAttribute('position').count,3);assert.equal(r.remaining.getAttribute('uv1').count,3);assert.equal(r.mesh.geometry.getAttribute('uv1'),undefined);assert.equal(r.stats.maxUVError,0);assert.ok(r.stats.maxPositionError<2e-6);assert.ok(r.stats.retainedBytes+r.stats.instancedBytes<r.stats.sourceBytes);
 assert.equal(mesh.geometry,old);assert.equal(old.index.count,7501*3);assert.equal(r.mesh.material,mesh.material);r.mesh.dispose();r.mesh.geometry.dispose();r.remaining.dispose();old.dispose();mesh.material.dispose();
});
test('ambiguous faces or a material bound to UV1 leave original geometry intact',async()=>{
 const {THREE,repeatedMeshInstances,createTowerBalusterInstances}=await methods(),{mesh,placements}=fixture(THREE),original=mesh.geometry;
 const bad=placements.map(p=>p.slice());bad[0][0]+=20;assert.throws(()=>createTowerBalusterInstances(THREE,mesh,bad,repeatedMeshInstances),/ambiguous/);assert.equal(mesh.geometry,original);
 const texture=new THREE.Texture();texture.channel=1;mesh.material.aoMap=texture;assert.throws(()=>createTowerBalusterInstances(THREE,mesh,placements,repeatedMeshInstances),/another channel/);assert.equal(mesh.geometry,original);texture.dispose();original.dispose();mesh.material.dispose();
});
