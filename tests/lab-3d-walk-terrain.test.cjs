const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {fitTerrain,inPoly}=require('../3d/gunkanjima-walk-buildings.js'),model=require('../3d/gunkanjima-model.json');
for(const step of [1,2,4])test('building footprints remain below floors at terrain grid step '+step,()=>{
 const t=model.terrain,raw=fs.readFileSync('3d/'+t.file),w=Math.floor((t.w-1)/step)+1,h=Math.floor((t.h-1)/step)+1;
 const a=Float32Array.from({length:w*h},(_,i)=>raw.readUInt16LE((Math.floor(i/w)*step*t.w+(i%w)*step)*2)*t.unit),before=a.slice();
 fitTerrain(a,{w,h,step,x0:t.x0,y0:t.y0},model.buildings);
 let checks=0,changed=0;
 for(const b of model.buildings)for(const poly of b.wings||[b.poly]){
  for(let v=Math.min(...poly.map(p=>p[1]));v<Math.max(...poly.map(p=>p[1]));v+=.55)for(let u=Math.min(...poly.map(p=>p[0]));u<Math.max(...poly.map(p=>p[0]));u+=.55){
   if(!inPoly([u,v],poly))continue;
   const x=Math.floor((u-t.x0)/step),z=Math.floor((v-t.y0)/step);
   if(x<0||x>=w-1||z<0||z>=h-1)continue;
   // Every corner must clear the floor: this bounds both render triangles and bilinear collision.
   for(const i of [z*w+x,z*w+x+1,(z+1)*w+x,(z+1)*w+x+1])assert.ok(a[i]<=b.ground-.0999,(b.name||b.id)+' terrain must stay below the floor');
   checks++;
  }
 }
 for(let i=0;i<a.length;i++){assert.ok(a[i]<=before[i]+.0001,'never raise the terrain');if(a[i]!==before[i])changed++;}
 assert.ok(checks>1000);assert.ok(changed>100);assert.equal(a[0],before[0],'faraway terrain remains unchanged');
 console.log({step,footprintSamples:checks,loweredVertices:changed});
});
