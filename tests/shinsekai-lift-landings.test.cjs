const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const load=()=>import('../assets-src/shinsekai/browser-study/lift-landings.mjs');
const fixture=form=>{const b=fs.readFileSync(path.resolve(__dirname,'../assets-src/shinsekai/tower-study/tower-study-v4-'+form+'.glb'));return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const bounds=(m,name)=>{const n=m.nodes.find(n=>n.name===name);assert.ok(n,name);const p=m.meshes[n.mesh].primitives[0],a=m.accessors[p.attributes.POSITION];return {node:n,min:a.min.map((v,i)=>v*(n.scale?.[i]??1)+(n.translation?.[i]??0)),max:a.max.map((v,i)=>v*(n.scale?.[i]??1)+(n.translation?.[i]??0))};};
test('v4 car floors meet declared landings and body bounds stay within derived well and head',async()=>{
 const {readLiftLandings}=await load(),{safeElevatorTravel}=await import('../assets-src/shinsekai/browser-study/elevator-travel.mjs');
 const m=fixture('open-gallery'),layout=readLiftLandings(m.scenes[0].extras.lift),car=bounds(m,'elevator_car'),h=layout.car.height;
 assert.equal(layout.canTravel,true);const bottom=m.nodes.find(n=>n.name==='elevator_well_bottom'),top=m.nodes.find(n=>n.name==='elevator_well_top');
 const travel=safeElevatorTravel({bottom:bottom.translation,top:top.translation,bodyOffsets:[[0,-h/2,0],[0,h/2,0]],clearance:layout.data.well.clearance});
 for(const i of [0,1]){const pivot=travel.point(i)[1];near(pivot+layout.floorOffset,layout.floors[i]);assert.ok(pivot-h/2>=layout.data.well.bottom-1e-5);assert.ok(pivot+h/2<=layout.data.well.top+1e-5);}
 near(car.node.translation[1],layout.stops[0]);assert.ok(layout.data.well.top<=layout.data.structure.headTop);
 near(bounds(m,'roof_garden_deck').max[1],15.15);near(bounds(m,'open_gallery_floor').max[1],layout.floors[1]);
});
test('enclosed form has a correct roof surface but no invented upper landing or upper binding',async()=>{
 const {readLiftLandings}=await load(),{createRideAccess}=await import('../assets-src/shinsekai/browser-study/ride-access.mjs'),m=fixture('enclosed-box'),layout=readLiftLandings(m.scenes[0].extras.lift);
 assert.equal(layout.canTravel,false);assert.equal(layout.floors[1],null);assert.ok(!m.nodes.some(n=>n.name==='landing_top_floor'||n.name==='elevator_well_top'));near(bounds(m,'roof_garden_deck').max[1],15.15);
 const access=createRideAccess({stops:layout.stops,landingEnabled:layout.landingEnabled,width:layout.car.width,depth:layout.car.depth,height:layout.car.height});
 assert.throws(()=>access.reset(1));assert.equal(access.board({fraction:1,velocity:0,phase:'arrival-end dwell'}),false);assert.equal(access.board({fraction:0,velocity:0,phase:'departing-end dwell'}),true);access.advance(2);assert.equal(access.exit({fraction:1,velocity:0,phase:'arrival-end dwell'}),false);
});
test('landing validator rejects incompatible floor, fake unresolved travel and insufficient headroom',async()=>{
 const {readLiftLandings}=await load(),valid=JSON.parse(fixture('open-gallery').scenes[0].extras.lift);
 for(const mutate of [d=>d.landings[0].floor+=.2,d=>d.structure.headTop-=10,d=>d.landings[1].floor=null]){const d=structuredClone(valid);mutate(d);assert.throws(()=>readLiftLandings(d));}
});
