import assert from 'node:assert/strict';import fs from 'node:fs';
import {createResourcePreparationObserver067} from '../resource-preparation-067.mjs';
let tick=0,objectCalls=0,pipelineCalls=0,backendCalls=0,compileInvokes=0,drawInvokes=0;
const names=['cinema__beam_1','cinema__doors_3','cinema__walls_14','cinema__foyer_4','cinema__foyer_16','cinema__projector_7'];
const meshes=names.map(name=>({name,isMesh:true,frustumCulled:true,material:{side:2,transparent:true,forceSinglePass:false,version:0,name:'fake'},geometry:{}}));
const projector=meshes[5],other=meshes[0],root={traverse(fn){meshes.forEach(fn);}};
const scene={getObjectByName(n){return n==='cell_cinema'?root:meshes.find(m=>m.name===n);}},camera={position:{x:0,y:0,z:0},layers:{mask:1}};
const objects=new WeakMap();for(const object of meshes)objects.set(object,{object,material:object.material,geometry:object.geometry,context:{},lightsNode:{},initialCacheKey:42,initialNodesCacheKey:43,version:0,clippingContext:{cacheKey:''}});
const pipeline={cacheKey:'CPU-FAKE',usedTimes:1},nodes=new WeakMap(),pipelines=new WeakMap();for(const o of meshes){const ro=objects.get(o);nodes.set(ro,{nodeBuilderState:{vertexShader:'CPUfakeVertex',fragmentShader:'CPUfakeFragment'}});pipelines.set(ro,{pipeline});}
const og=function(object){objectCalls++;return objects.get(object);},pg=function(){pipelineCalls++;return pipeline;},bg=function(){backendCalls++;};
const renderer={_initialized:true,backend:{createRenderPipeline:bg},_objects:{get:og},_nodes:{data:nodes},_pipelines:{getForRender:pg,data:pipelines}};
const observer=createResourcePreparationObserver067({now:()=>++tick});const generations=[];
function originalCalls(object){const ro=objects.get(object);renderer._objects.get(object,object.material,scene,camera,ro.lightsNode,ro.context,null);renderer._pipelines.getForRender(ro);}
for(let generation=1;generation<=3;generation++){
 const p=Promise.resolve();assert.equal(observer.compile(renderer,scene,camera,{owner:'cinema'},()=>{compileInvokes++;assert.equal(projector.frustumCulled,false);originalCalls(projector);return p;}),p);
 assert.equal(projector.frustumCulled,true);await p;
 let snapshot=observer.snapshot();assert.equal(snapshot.cinemaPreparationGeneration,generation);assert.equal(snapshot.firstCinemaReadyRender,null);assert.equal(snapshot.firstCinemaProjectorRender,null);assert.equal(snapshot.passCacheObservation.firstProjectorDrawID,null);
 observer.render(renderer,scene,camera,{site:'scheduled-draw',cinemaState:'ready'},()=>{drawInvokes++;originalCalls(other);});
 const first=observer.snapshot();assert.equal(first.firstCinemaReadyRender.methods.createRenderPipeline?.count??0,0);assert.equal(first.firstCinemaProjectorRender,null);
 observer.render(renderer,scene,camera,{site:'scheduled-draw',cinemaState:'ready'},()=>{drawInvokes++;originalCalls(projector);for(let i=0;i<generation;i++)renderer.backend.createRenderPipeline();});
 const late=observer.snapshot();assert.notEqual(late.firstCinemaReadyRender.id,late.firstCinemaProjectorRender.id);assert.equal(late.firstCinemaProjectorRender.newPipelines,generation);assert.equal(late.firstCinemaProjectorRender.cinemaPreparationGeneration,generation);assert.equal(late.passCacheObservation.firstProjectorDrawID,late.firstCinemaProjectorRender.id);assert.equal(late.passCacheObservation.firstDrawRows.length,4);
 for(let i=0;i<103;i++)observer.render(renderer,scene,camera,{site:'scheduled-draw',cinemaState:'ready'},()=>{});
 const latest=observer.snapshot();assert.equal(latest.renders.length,24);assert.equal(latest.firstCinemaReadyRender.id,first.firstCinemaReadyRender.id);assert.equal(latest.firstCinemaProjectorRender.id,late.firstCinemaProjectorRender.id);assert.equal(latest.cinemaReadyRenderCount,105);assert.equal(latest.passCacheObservation.compileRows.length,2);assert.equal(latest.passCacheObservation.firstDrawRows.length,4);assert.equal(latest.passCacheObservation.droppedCompile+latest.passCacheObservation.droppedDraw,0);assert.equal(latest.cinemaReadyRowsBound,3);
 generations.push({generation,firstReadyPipelineCalls:0,lateProjectorPipelineCalls:generation,lateProjectorDifferentRender:true,retainedPastRingEviction:true});
}
observer.restore(renderer);assert.equal(renderer.backend.createRenderPipeline,bg);assert.equal(renderer._objects.get,og);assert.equal(renderer._pipelines.getForRender,pg);assert.equal(objectCalls,9);assert.equal(pipelineCalls,9);assert.equal(backendCalls,6);assert.equal(compileInvokes,3);assert.equal(drawInvokes,6);
const result={schema:'JTA_LATE_PROJECTOR_OBSERVATION_CPU_067_H',generations,originalObjectCalls:9,originalPipelineCalls:9,originalBackendCalls:6,originalCompileInvokes:3,originalDrawInvokes:6,noExtraOriginalCalls:true,rendererMethodsRestored:true,currentGenerationOnly:true,maxCacheRows:64,maxRenderRows:24,maxCompileRows:16,fixedReadyRenderRefs:3,promiseIdentity:true,firstReadyZeroDoesNotImplyLateProjectorZero:true,syntheticBackendNotNativeCacheOrPerformanceProof:true,nativeQualified:false};
console.log(JSON.stringify(result));
