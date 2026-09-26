const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const N=require('../3d/gunkanjima-walk-nature.js'),{fitTerrain}=require('../3d/gunkanjima-walk-buildings.js'),model=require('../3d/gunkanjima-model.json');
const footprints=model.buildings.flatMap(b=>b.wings||[b.poly]),spawn=[490,650];
function terrain(step){
 const t=model.terrain,raw=fs.readFileSync('3d/'+t.file),w=Math.floor((t.w-1)/step)+1,h=Math.floor((t.h-1)/step)+1;
 const heights=Float32Array.from({length:w*h},(_,i)=>raw.readUInt16LE((Math.floor(i/w)*step*t.w+(i%w)*step)*2)*t.unit);
 const grid={w,h,step,x0:t.x0,y0:t.y0};fitTerrain(heights,grid,model.buildings);
 return {grid,heights,field:N.field(grid,heights,model.buildings,model.coast,{year:1962})};
}
for(const step of [1,2])test('placeholder nature stays outside every footprint and the sea (terrain step '+step+')',()=>{
 const {grid,heights,field:f}=terrain(step);
 let covered=0;
 for(let k=0;k<grid.w*grid.h;k++){
  for(const key of ['grass','path','flower','weed','rock'])assert.ok(f[key][k]>=0&&f[key][k]<=1,key+' in range');
  if(f.built[k]||heights[k]<.05)assert.equal(f.grass[k]+f.path[k]+f.flower[k],0,'no cover inside a footprint or the sea');
  if(f.grass[k]>.5)covered++;
 }
 assert.ok(covered*f.cell*f.cell>8000,'meadow and hillside cover present');
 const set=N.scatter(f,heights,{lowEnd:step>1,avoid:footprints,spawn});
 assert.ok(set.trees.length>=30&&set.trees.length<=(step>1?90:200),'tree count '+set.trees.length);
 assert.ok(set.bushes.length>=100&&set.rocks.length>=60);
 for(const o of [...set.trees,...set.bushes,...set.rocks]){
  assert.ok(N.inPoly([o.u,o.v],model.coast),'plant inside the coast');
  assert.ok(!footprints.some(p=>N.inPoly([o.u,o.v],p)),'plant outside every footprint of every era');
  assert.ok(Math.hypot(o.u-spawn[0],o.v-spawn[1])*N.MPP>3,'arrival point stays clear');
  assert.ok(Number.isFinite(o.y)&&o.y>-1&&o.y<45);
 }
 const toPath=N.distance(Uint8Array.from(f.path,p=>p>.5?1:0),f.w,f.h,f.cell);
 for(const t of set.trees){
  assert.ok(N.sample(f,f.toBuilding,t.u,t.v)>t.radius*.8+.6,'canopy trunk clears walls');
  assert.ok(N.sample(f,toPath,t.u,t.v)>=Math.max(3,t.radius*.9)-1e-6,'canopy stays off the worn paths');
 }
 const again=N.scatter(N.field(grid,heights,model.buildings,model.coast,{year:1962}),heights,{lowEnd:step>1,avoid:footprints,spawn});
 assert.deepEqual(again,set,'deterministic placement');
});
test('nature meshes fit 16-bit indices and blades wrap inside their patch',()=>{
 const {heights,field:f}=terrain(2),set=N.scatter(f,heights,{lowEnd:true,avoid:footprints,spawn});
 for(const b of N.meshes(set)){
  assert.ok(b.count<65536&&b.pos.length===b.count*3&&b.nor.length===b.count*3&&b.info.length===b.count*3);
  assert.ok(b.idx.every(i=>i<b.count),'indices in range');
  for(let i=0;i<b.count;i++){const l=Math.hypot(b.nor[i*3],b.nor[i*3+1],b.nor[i*3+2]);assert.ok(Math.abs(l-1)<1e-3,'unit normals');}
 }
 const blades=N.blades(500,40),flowers=N.flowers(100,50);
 assert.equal(blades.length,500*3*5);assert.equal(flowers.length,100*9*5);
 for(let i=0;i<blades.length;i+=5)assert.ok(blades[i]>=0&&blades[i]<40&&blades[i+1]>=0&&blades[i+1]<40&&[0,1].includes(blades[i+3]));
});
test('ground texture stores heights to the centimetre',()=>{
 const {heights,field:f}=terrain(2),tex=N.groundTexture(f,heights);
 assert.equal(tex.length,f.w*f.h*4);
 for(let k=0;k<f.w*f.h;k+=97)assert.ok(Math.abs((tex[k*4]*256+tex[k*4+1])/100-Math.max(0,heights[k]))<=.006);
});
test('set pieces: pond with a bridge on its path, and fences with end posts beside paths and coasts',()=>{
 for(const step of [1,2]){
  const {heights,field:f}=terrain(step),F=N.features(f,heights,{spawn,avoid:footprints,coast:model.coast,lowEnd:step>1});
  assert.equal(F.ponds.length,1);assert.equal(F.bridges.length,1);
  const br=F.bridges[0];assert.ok(br.span>2*F.ponds[0].r,'the bridge spans the pond');
  let beside=0;
  for(const run of F.fences){
   assert.ok(run.length>=3,'every run has two end posts and a middle post');
   for(let i=0;i<run.length;i++){
    const [u,v]=run[i];
    assert.ok(N.inPoly([u,v],model.coast)&&!footprints.some(p=>N.inPoly([u,v],p)),'posts stand on land outside buildings');
    assert.ok(N.sample(f,f.path,u,v)<.25,'posts stay off the path');
    assert.ok(Math.hypot(u-spawn[0],v-spawn[1])*N.MPP>5,'arrival point stays open');
    if(i)assert.ok(Math.hypot(u-run[i-1][0],v-run[i-1][1])*N.MPP<3.5,'rails are short spans');
   }
   const mid=run[Math.floor(run.length/2)];let near=1e9;
   for(let dv=-8;dv<=8;dv+=.5)for(let du=-8;du<=8;du+=.5)if(N.sample(f,f.path,mid[0]+du,mid[1]+dv)>.6)near=Math.min(near,Math.hypot(du,dv)*N.MPP);
   if(near<4.5)beside++;
  }
  assert.ok(beside>=2,'some fences follow worn paths ('+beside+')');
 }
});
