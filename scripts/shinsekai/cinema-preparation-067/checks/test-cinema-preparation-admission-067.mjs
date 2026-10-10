import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCinemaPreparationAdmission067} from '../cinema-preparation-admission-067.mjs';
const names=['cinema__beam_1','cinema__doors_3','cinema__walls_14','cinema__foyer_4','cinema__foyer_16','cinema__projector_7'];
function fixture(){
 const prototype={frustumCulled:true};
 const make=(name,material,own=true)=>Object.assign(Object.create(prototype),{name,isMesh:true,material,geometry:{},visible:true,layers:{mask:1}},own?{frustumCulled:true}:{});
 const objects=names.map((n,i)=>make(n,{transparent:true,forceSinglePass:false,side:2},i!==0));
 objects.push(make('opaque-a',{transparent:false,forceSinglePass:false,side:2}));
 objects.push(make('hidden-opaque',{transparent:false,side:2}));objects.at(-1).visible=false;
 objects.push(make('single-pass',{transparent:true,forceSinglePass:true,side:2}));
 objects.push(make('unknown-double-pass',{transparent:true,forceSinglePass:false,side:2}));
 const outside=make('outside-hall',{transparent:false,side:2});
 const root={name:'cell_cinema',traverse(fn){fn(this);objects.forEach(fn);}};
 const scene={getObjectByName(n){return n==='cell_cinema'?root:objects.find(o=>o.name===n);}};
 return {objects,outside,scene,root,renderer:{_initialized:true}};
}
let checks=0,calls=0;
for(const mode of ['promise','return','throw']){
 const f=fixture(),observer=createCinemaPreparationAdmission067();const before=f.objects.map(o=>Object.getOwnPropertyDescriptors(o));const value=mode==='promise'?Promise.resolve():{},error=new Error('original');
 const invoke=()=>{calls++;for(const o of f.objects.slice(0,9))assert.equal(o.frustumCulled,false);assert.equal(f.objects[9].frustumCulled,true);assert.equal(f.outside.frustumCulled,true);assert.equal(f.objects[7].visible,false);assert.equal(f.objects[0].material.side,2);if(mode==='throw')throw error;return value;};
 if(mode==='throw')assert.throws(()=>observer.compile(f.renderer,f.scene,{}, {owner:'cinema'},invoke),e=>e===error);
 else assert.equal(observer.compile(f.renderer,f.scene,{}, {owner:'cinema'},invoke),value);
 for(let i=0;i<f.objects.length;i++)assert.deepEqual(Object.getOwnPropertyDescriptors(f.objects[i]),before[i]);
 const row=observer.snapshot().rows[0];assert.equal(row.meshCount,10);assert.equal(row.admittedMeshes,9);assert.equal(row.excludedUnknownDoublePass,1);assert.equal(row.restoredBeforeAsyncWait,true);assert.equal(Object.hasOwn(f.objects[0],'frustumCulled'),false);checks++;
}
for(const mode of ['uninitialized','missing-root','missing-baseline','bound','nonwritable','accessor']){
 const f=fixture();const observer=createCinemaPreparationAdmission067({maxMeshes:mode==='bound'?5:512});
 if(mode==='uninitialized')f.renderer._initialized=false;
 if(mode==='missing-root')f.scene.getObjectByName=n=>f.objects.find(o=>o.name===n);
 if(mode==='missing-baseline')f.objects[1].name='unexpected';
 if(mode==='nonwritable')Object.defineProperty(f.objects[2],'frustumCulled',{value:true,writable:false,configurable:true});
 if(mode==='accessor')Object.defineProperty(f.objects[2],'frustumCulled',{get:()=>true,set(){throw Error('must not call');},configurable:true});
 const descriptors=f.objects.map(o=>Object.getOwnPropertyDescriptors(o));
 assert.throws(()=>observer.compile(f.renderer,f.scene,{}, {owner:'cinema'},()=>{throw Error('unexpected original invocation');}));
 f.objects.forEach((o,i)=>assert.deepEqual(Object.getOwnPropertyDescriptors(o),descriptors[i]));checks++;
}
const f=fixture(),bounded=createCinemaPreparationAdmission067({limit:4});for(let i=0;i<11;i++)bounded.compile(f.renderer,f.scene,{}, {owner:'cinema'},()=>{calls++;});
assert.equal(bounded.snapshot().rows.length,4);assert.equal(bounded.snapshot().dropped,7);checks++;
const bypass=createCinemaPreparationAdmission067();const identity={};assert.equal(bypass.compile({},null,null,{owner:'hall'},()=>{calls++;return identity;}),identity);assert.equal(bypass.snapshot().rows.length,0);checks++;
const result={schema:'JTA_CINEMA_ADMISSION_CPU_067_H',checks,originalInvocations:calls,eligible9ExcludedUnknownDouble1:true,originalDescriptorsVisibilityLayersMaterialGeometryPreserved:true,promiseReturnAndErrorIdentity:true,ownAndInheritedPropertiesRestored:true,prevalidationFailsWithoutMutation:true,rowsBound4:true,extraCompileOrDrawCalls:false,nativeQualified:false};
console.log(JSON.stringify(result));
