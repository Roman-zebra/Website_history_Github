const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../assets-src/shinsekai/eval-building-a/codex');
const b=fs.readFileSync(path.join(dir,'building-a.glb')),length=b.readUInt32LE(12),m=JSON.parse(b.subarray(20,20+length)),binary=b.subarray(28+length);
const descendants=i=>[i,...(m.nodes[i].children??[]).flatMap(descendants)];
const node=name=>m.nodes.findIndex(n=>n.name===name);
const triangles=i=>descendants(i).reduce((sum,j)=>sum+(m.nodes[j].mesh===undefined?0:m.meshes[m.nodes[j].mesh].primitives.reduce((n,p)=>n+m.accessors[p.indices].count/3,0)),0);
test('blind Building A has three decreasing exterior LODs and separate interior within geometry/UV budgets',()=>{
 const counts=[0,1,2].map(lod=>triangles(node('building-a-exterior-lod'+lod)));assert.ok(counts[0]<=20000);assert.ok(counts[0]>counts[1]&&counts[1]>counts[2]);
 const cell=node('building-a-interior-cell');assert.ok(cell>=0);assert.ok(triangles(cell)<150000);assert.equal(m.nodes[cell].extras.loadDistanceM,15);
 for(const mesh of m.meshes)for(const p of mesh.primitives)assert.ok(p.attributes.TEXCOORD_0!==undefined&&p.attributes.TEXCOORD_1!==undefined,'Missing primary/secondary UV');
 const spec=JSON.parse(m.scenes[0].extras.buildingStudy);assert.match(spec.status,/inferred/);assert.deepEqual(spec.footprintM,[6,9]);
});
test('Building A authored stair opening is real geometry, with a connected upper landing and ground walk floor',async()=>{
 const {Matrix4,Quaternion,Vector3,Ray}=await import('../vendor/three-r186/build/three.core.js');const faces=[];
 const data=(index,size)=>{const a=m.accessors[index],v=m.bufferViews[a.bufferView],result=[],stride=v.byteStride??size*(a.componentType===5126||a.componentType===5125?4:2);
  for(let i=0;i<a.count;i++){const start=(v.byteOffset??0)+(a.byteOffset??0)+stride*i;result.push(Array.from({length:size},(_,j)=>a.componentType===5126?binary.readFloatLE(start+j*4):a.componentType===5125?binary.readUInt32LE(start+j*4):binary.readUInt16LE(start+j*2)));}return result;};
 const visit=(index,parent)=>{const n=m.nodes[index],world=new Matrix4();if(n.matrix)world.fromArray(n.matrix);else{world.makeRotationFromQuaternion(new Quaternion(...(n.rotation??[0,0,0,1])));world.scale(new Vector3(...(n.scale??[1,1,1])));world.setPosition(...(n.translation??[0,0,0]));}world.premultiply(parent);
  if(n.mesh!==undefined)for(const p of m.meshes[n.mesh].primitives){const vertices=data(p.attributes.POSITION,3).map(v=>new Vector3(...v).applyMatrix4(world)),indices=data(p.indices,1).flat();for(let i=0;i<indices.length;i+=3)faces.push(indices.slice(i,i+3).map(j=>vertices[j]));}
  for(const i of n.children??[])visit(i,world);};
 visit(node('building-a-exterior-lod0'),new Matrix4());visit(node('building-a-interior-cell'),new Matrix4());
 const hit=(origin,direction)=>{const ray=new Ray(new Vector3(...origin),new Vector3(...direction)),point=new Vector3();let nearest=Infinity;for(const f of faces)if(ray.intersectTriangle(...f,false,point))nearest=Math.min(nearest,point.distanceTo(ray.origin));return nearest;};
 const near=(a,b)=>assert.ok(Math.abs(a-b)<.015,`${a} != ${b}`);
 near(3.5-hit([.8,3.5,-2],[0,-1,0]),3.21);near(3.5-hit([1.89,3.5,-8],[0,-1,0]),3.14);
 assert.ok(hit([1.89,3.4,-4.60],[0,-1,0])>2,'A solid upper-floor slab blocks the stair void');
 near(2-hit([1.65,2,-1.3],[0,-1,0]),.08);
 assert.ok(hit([1.65,1.6,.5],[0,0,-1])>1.0,'Solid wall/door blocks the front aperture');
 const walk=JSON.parse(m.nodes[node('building-a-interior-cell')].extras.walkability);assert.equal(walk.stairs.steps,18);assert.ok(walk.stairs.riserM<.18);
});
