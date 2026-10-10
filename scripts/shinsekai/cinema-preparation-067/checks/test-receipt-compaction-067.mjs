import assert from 'node:assert/strict';import fs from 'node:fs';
import {createPassCacheObserver067 as createH} from '../fixtures/pass-cache-observer-H.mjs';
import {createPassCacheObserver067 as createI} from '../pass-cache-observer-067.mjs';
function fixture(factory){
 let scope={cinemaCompiling:true},objects=0,pipelines=0;
 const material={transparent:true,forceSinglePass:false,side:1,version:0},object={name:'cinema__projector_7',material,geometry:{}};
 const ro={object,material,geometry:object.geometry,context:{},renderContext:{},lightsNode:{},initialCacheKey:42,initialNodesCacheKey:43,version:0,clippingContext:{cacheKey:''}};
 const p={cacheKey:'CPUfake',usedTimes:1},n={vertexShader:'v'.repeat(4096),fragmentShader:'f'.repeat(65000)};
 const og=function(){objects++;return ro;},pg=function(){pipelines++;return p;};
 const renderer={_objects:{get:og},_nodes:{data:new WeakMap([[ro,{nodeBuilderState:n}]])},_pipelines:{getForRender:pg,data:new WeakMap([[ro,{pipeline:p}]])}};
 const observer=factory();observer.ensure(renderer,()=>scope);observer.beginCinemaCompile();
 for(let i=0;i<2;i++){material.side=i;assert.equal(renderer._objects.get(object,material),ro);assert.equal(renderer._pipelines.getForRender(ro),p);}
 scope={render:{id:1,site:'scheduled-draw',cinemaState:'ready'}};
 for(let i=0;i<2;i++){material.side=i;assert.equal(renderer._objects.get(object,material),ro);assert.equal(renderer._pipelines.getForRender(ro),p);}
 observer.restore(renderer);assert.equal(renderer._objects.get,og);assert.equal(renderer._pipelines.getForRender,pg);
 return {snapshot:observer.snapshot(),objects,pipelines};
}
function stripDuplicates(snapshot){
 const result=structuredClone(snapshot);
 for(const rows of [result.compileRows,result.firstDrawRows])for(const row of rows){
  if(row.method==='objects.get'){delete row.after.vertex;delete row.after.fragment;}
  if(row.before){delete row.before.vertex;delete row.before.fragment;}
 }
 return result;
}
const h=fixture(createH),i=fixture(createI),normalized=stripDuplicates(h.snapshot);
normalized.schema=i.snapshot.schema;normalized.shaderDiagnosticPlacement=i.snapshot.shaderDiagnosticPlacement;
assert.deepEqual(i.snapshot,normalized);assert.equal(h.objects,i.objects);assert.equal(h.pipelines,i.pipelines);
assert.ok(i.snapshot.compileRows.filter(r=>r.method==='pipelines.getForRender').every(r=>r.after.fragment.length===65000));
assert.ok(i.snapshot.compileRows.filter(r=>r.method==='objects.get').every(r=>!Object.hasOwn(r.after,'fragment')));
let replay=null;
if(process.argv[2]){
 const original=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),compacted=structuredClone(original);
 compacted.source.resourcePreparation.passCacheObservation=stripDuplicates(compacted.source.resourcePreparation.passCacheObservation);
 const originalChars=JSON.stringify(original).length,compactedChars=JSON.stringify(compacted).length;
 assert.ok(originalChars-compactedChars>3000);assert.ok(compactedChars<124000);
 replay={actualHChildGateInput:true,originalChars,compactedChars,savedChars:originalChars-compactedChars,originalCeiling128000Unchanged:true,replayOnlyNotNativeParentSaveProof:true};
}
const result={schema:'JTA_RECEIPT_COMPACTION_CPU_067_I',exactNonduplicateObservationsPreserved:true,shaderHashesRetainedInPipelineAfter:true,originalObjectCalls:h.objects,originalPipelineCalls:h.pipelines,noExtraOriginalCalls:true,methodsRestored:true,replay,nativeQualified:false};
console.log(JSON.stringify(result));
