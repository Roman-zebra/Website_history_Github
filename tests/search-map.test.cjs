const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function runtime(){
 const state={arcs:0,closed:0,opened:[],bounds:null,view:null,removed:0},els=new Map();
 const canvas={setAttribute(){},style:{},remove(){state.removed++;},getContext(){return {scale(){},beginPath(){},arc(){state.arcs++;},fill(){},stroke(){}};}};
 const element=()=>({hidden:false,blur(){},remove(){state.removed++;}});
 const map={getPanes:()=>({markerPane:{appendChild(){}}}),on(){},off(){},getSize:()=>({x:1000,y:1000}),containerPointToLayerPoint:p=>p,latLngToContainerPoint:()=>({x:500,y:500}),removeLayer:l=>l.onRemove(map),setView:(at,z)=>state.view={at,z},fitBounds:(points,options)=>state.bounds={points,options}};
 const ctx={map,devicePixelRatio:1,LANG:'ja',qSeq:0,PlaceUI:require('../place-ui.js'),document:{getElementById:id=>els.get(id)},$:id=>{if(!els.has(id))els.set(id,element());return els.get(id);},closePanel:()=>state.closed++,showSavedSpot:r=>state.opened.push(r),openMonument:id=>state.opened.push(id),noPush:fn=>fn(),openMap(){},L:{Layer:{extend:o=>class{constructor(){Object.assign(this,o);}addTo(m){this.onAdd(m);return this;}}},DomUtil:{create:()=>canvas,setPosition(){}},latLngBounds:r=>r}};
 vm.createContext(ctx);const source=fs.readFileSync(require.resolve('../explore.js'),'utf8');vm.runInContext(source.slice(source.indexOf('/* Nationwide results:'),source.indexOf("$('locBtn').onclick")),ctx);
 return {ctx,state,run:s=>vm.runInContext(s,ctx)};
}
test('all matching points are painted without the ordinary marker cap and fit together',()=>{
 const {ctx,state,run}=runtime();ctx.rows=Array.from({length:1500},(_,i)=>({lat:35+i/10000,lon:139,name:'ski'}));
 run('nationalHits=rows;frameNationalHits();');assert.equal(state.bounds.points.length,1500);assert.equal(state.arcs,3000);assert.equal(state.closed,1);assert.equal(state.opened.length,0);
 run('clearNationalSearch();');assert.equal(run('nationalHits.length'),0);assert.equal(run('nationalLayer'),null);assert.ok(state.removed);
});
test('a single result opens at street level and invalidates in-flight searches',()=>{
 const {ctx,state,run}=runtime();ctx.rows=[{lat:36.94,lon:138.78,name:'GALA'}];
 run('nationalHits=rows;nationalSeq=12;qSeq=12;frameNationalHits();');assert.equal(state.view.z,17);assert.equal(state.opened.length,1);assert.equal(state.bounds,null);assert.equal(run('nationalSeq'),0);assert.equal(run('qSeq'),13);
});
