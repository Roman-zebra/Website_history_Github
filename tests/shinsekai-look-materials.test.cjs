const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'assets-src/shinsekai/browser-study/materials');
const glb=file=>{const b=fs.readFileSync(path.join(root,'assets-src/shinsekai/tower-study',file)),length=b.readUInt32LE(12);const m=JSON.parse(b.subarray(20,20+length));m.binary=b.subarray(28+length);return m;};
test('Claude95 derived CC0 material files retain verified hashes and declared dimensions',()=>{
 const {jpegSize}=require('../scripts/render-shinsekai-camera-review.cjs'),manifest=JSON.parse(fs.readFileSync(path.join(dir,'PROVENANCE.json')));let total=0;
 assert.equal(manifest.sourceHandoff,95);assert.equal(manifest.textures.length,15);
 for(const t of manifest.textures){const b=fs.readFileSync(path.join(dir,t.file));total+=b.length;assert.equal(crypto.createHash('sha256').update(b).digest('hex'),t.sha256,t.file);assert.deepEqual(jpegSize(b),t.sizePx,t.file);assert.equal(t.license,'CC0-1.0');assert.match(t.sourceSha256,/^[a-f0-9]{64}$/);}
 assert.ok(total<6*1024*1024,`Material packet ${total} bytes exceeds study budget`);
});
for(const derived of ['tower-study-v4-look-uv.glb','tower-study-v4-look-ao.glb'])test(derived+' retains every named node, world bounds and landing contract from v4',async()=>{
 const {Matrix4,Vector3,Quaternion}=await import('../vendor/three-r186/build/three.core.js');
 const before=glb('tower-study-v4-open-gallery.glb'),after=glb(derived);
 assert.deepEqual(after.scenes[0].extras.lift,before.scenes[0].extras.lift);assert.deepEqual(after.scenes[0].extras.study,before.scenes[0].extras.study);
 const snapshot=m=>{
  const out=new Map();
  const visit=(index,parent)=>{
   const n=m.nodes[index],matrix=new Matrix4();
   if(n.matrix)matrix.fromArray(n.matrix);
   else{matrix.makeRotationFromQuaternion(new Quaternion(...(n.rotation??[0,0,0,1])));matrix.scale(new Vector3(...(n.scale??[1,1,1])));matrix.setPosition(...(n.translation??[0,0,0]));}
   matrix.premultiply(parent);const entry={position:new Vector3().setFromMatrixPosition(matrix).toArray()};
   if(n.mesh!==undefined){
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let triangles=0;
    for(const p of m.meshes[n.mesh].primitives){
     const a=m.accessors[p.attributes.POSITION],view=m.bufferViews[a.bufferView];assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');
     triangles+=(m.accessors[p.indices]?.count??a.count)/3;
     if(m===after)assert.ok(p.attributes.TEXCOORD_0!==undefined,'UV missing: '+n.name);
     if(m===after&&derived.includes('-ao.'))assert.ok(p.attributes.TEXCOORD_1!==undefined,'AO UV missing: '+n.name);
     // Transform actual vertices, not a rotated local bounding box: Blender may bake the transform.
     for(let j=0;j<a.count;j++){
      const start=(view.byteOffset??0)+(a.byteOffset??0)+j*(view.byteStride??12);
      const v=new Vector3(...[0,4,8].map(i=>m.binary.readFloatLE(start+i))).applyMatrix4(matrix).toArray();
      for(let i=0;i<3;i++){min[i]=Math.min(min[i],v[i]);max[i]=Math.max(max[i],v[i]);}
     }
    }Object.assign(entry,{min,max,triangles});
   }
   out.set(n.name,entry);for(const c of n.children??[])visit(c,matrix);
  };
  for(const index of m.scenes[0].nodes)visit(index,new Matrix4());return out;
 };
 const a=snapshot(before),b=snapshot(after);assert.deepEqual([...b.keys()].sort(),[...a.keys()].sort());
 for(const [name,entry]of a){const next=b.get(name);for(const k of ['position','min','max'])if(entry[k])for(let i=0;i<3;i++)assert.ok(Math.abs(entry[k][i]-next[k][i])<1e-4,`${name} ${k}[${i}] changed: ${entry[k][i]} -> ${next[k][i]}`);if(entry.triangles)assert.equal(next.triangles,entry.triangles,name);}
});
test('original baked AO atlases retain source hash, dimensions and per-node bindings',()=>{
 const aoDir=path.join(dir,'ao'),manifest=JSON.parse(fs.readFileSync(path.join(aoDir,'PROVENANCE.json'))),source=fs.readFileSync(path.join(root,'assets-src/shinsekai/tower-study/tower-study-v4-look-uv.glb'));
 assert.equal(manifest.sourceGlbSha256,crypto.createHash('sha256').update(source).digest('hex'));assert.equal(manifest.maps.length,7);
 const names=new Set();for(const map of manifest.maps){assert.ok(!names.has(map.node));names.add(map.node);const b=fs.readFileSync(path.join(aoDir,map.file));assert.equal(crypto.createHash('sha256').update(b).digest('hex'),map.sha256);assert.deepEqual([b.readUInt32BE(16),b.readUInt32BE(20)],map.sizePx);assert.equal(map.uvChannel,1);assert.ok(b.length>500,'Atlas unexpectedly empty');}
});
