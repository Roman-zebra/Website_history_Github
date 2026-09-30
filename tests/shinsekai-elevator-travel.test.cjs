const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const load=()=>import('../assets-src/shinsekai/browser-study/elevator-travel.mjs');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('Three binding keeps transformed nested car geometry between marker planes',async()=>{
 const {pathToFileURL}=require('node:url'),url=p=>pathToFileURL(path.resolve(__dirname,p)).href;
 const threeURL=url('../vendor/three-r186/build/three.webgpu.js'),THREE=await import(threeURL);
 const source=fs.readFileSync(path.resolve(__dirname,'../assets-src/shinsekai/browser-study/bind-elevator.mjs'),'utf8').replace("'three/webgpu'",JSON.stringify(threeURL)).replace("'./elevator-travel.mjs'",JSON.stringify(url('../assets-src/shinsekai/browser-study/elevator-travel.mjs')));
 const {bindElevator}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const root=new THREE.Group();root.position.set(3,5,-7);root.rotation.z=.3;root.scale.setScalar(2);
 const parent=new THREE.Group();parent.rotation.y=.4;root.add(parent);
 const car=new THREE.Mesh(new THREE.BoxGeometry(2,3,2),new THREE.MeshBasicMaterial());car.name='elevator_car';car.position.y=8;parent.add(car);
 for(const [name,y] of [['elevator_well_bottom',5],['elevator_well_top',20]]){const marker=new THREE.Object3D();marker.name=name;marker.position.y=y;root.add(marker);}
 const binding=bindElevator(root,.1),rotation=car.quaternion.clone();
 for(const u of [0,.25,1]){binding.setFraction(u);root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert();
  for(const x of [-1,1])for(const y of [-1.5,1.5])for(const z of [-1,1]){const point=car.localToWorld(new THREE.Vector3(x,y,z)).applyMatrix4(inverse);assert.ok(point.y>=5.1-1e-6&&point.y<=19.9+1e-6);}
  assert.ok(car.quaternion.equals(rotation));
 }
 car.geometry.dispose();car.material.dispose();
});
test('safe stops use actual body offsets, including an off-centre pivot',async()=>{
 const {safeElevatorTravel}=await load();const travel=safeElevatorTravel({bottom:[0,10,0],top:[0,30,0],bodyOffsets:[[-1,-2,-1],[1,1,1]],clearance:.2});
 near(travel.point(0)[1],12.2);near(travel.point(1)[1],28.8);
 for(let u=0;u<=1;u+=.01){const y=travel.point(u)[1];assert.ok(y-2>=10.2-1e-6&&y+1<=29.8+1e-6);}
});
test('containment follows a nonvertical well axis and rejects impossible cars',async()=>{
 const {safeElevatorTravel}=await load(),travel=safeElevatorTravel({bottom:[2,3,4],top:[12,3,4],bodyOffsets:[[-2,-1,-1],[1,1,1]],clearance:.1});
 near(travel.point(0)[0],4.1);near(travel.point(1)[0],10.9);near(travel.point(.5)[1],3);
 assert.throws(()=>safeElevatorTravel({bottom:[0,0,0],top:[0,2,0],bodyOffsets:[[0,-2,0],[0,2,0]]}),/does not fit/);
 assert.throws(()=>travel.point(2));assert.throws(()=>safeElevatorTravel({bottom:[0,0,0],top:[0,0,0],bodyOffsets:[[0,0,0],[1,1,1]]}),/Degenerate/);
});
test('both committed tower forms provide a separate car and dimension-aware safe centre stops',async()=>{
 const {safeElevatorTravel}=await load();
 for(const form of ['open-gallery','enclosed-box']){
  const b=fs.readFileSync(path.join(__dirname,'../assets-src/shinsekai/tower-study/tower-study-v3-'+form+'.glb')),m=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
  const named=name=>{const matches=m.nodes.filter(n=>n.name===name);assert.equal(matches.length,1);return matches[0];};
  const car=named('elevator_car'),bottom=named('elevator_well_bottom'),top=named('elevator_well_top');
  assert.ok(car.mesh!==undefined);assert.ok(!car.rotation&&!car.matrix); // This fixture exports scale + translation, Y-up.
  const corners=[];for(const p of m.meshes[car.mesh].primitives){const a=m.accessors[p.attributes.POSITION];assert.ok(a.min&&a.max);for(const x of [a.min[0],a.max[0]])for(const y of [a.min[1],a.max[1]])for(const z of [a.min[2],a.max[2]])corners.push([x,y,z].map((v,i)=>v*(car.scale?.[i]??1)));}
  const travel=safeElevatorTravel({bottom:bottom.translation,top:top.translation,bodyOffsets:corners,clearance:.05});
  near(travel.point(0)[1],17.05);near(travel.point(1)[1],57.5892);assert.ok(travel.point(1)[1]<top.translation[1]);
 }
});
