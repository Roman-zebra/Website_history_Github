import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {patchAsyncPassSide067} from '../async-pass-side-067.mjs';
const root=path.resolve(import.meta.dirname,'..');
const repositoryRoot=path.resolve(root,'../../..');
const vendor=fs.readFileSync(path.join(repositoryRoot,'vendor/three-r186/build/three.webgpu.js'),'utf8');
const cases=[];
function method(source,name,after=0) {
  const pattern=new RegExp('\\n([ \\t]+)'+name+'\\([^\\n]+\\) \\{','g');
  const m=[...source.matchAll(pattern)].find(x=>x.index>=after);assert(m,name);
  const end=source.indexOf('\n'+m[1]+'}',m.index)+m[1].length+2;
  assert(end>m.index);return source.slice(m.index+1,end);
}
const chainStart=vendor.indexOf('class ChainMap {');
const chainEnd=vendor.indexOf('\n}\n',chainStart)+3;
const ChainMap=new Function(vendor.slice(chainStart,chainEnd)+';return ChainMap;')();
const objectStart=vendor.indexOf('class RenderObjects {');
const actualGet=method(vendor,'get',objectStart);
const actualGetChainMap=method(vendor,'getChainMap',objectStart);
const ActualGetEngine=new Function('ChainMap',`const _chainKeys$3=[];return class {constructor(create){this._chainMaps={};this.create=create;this.nodes={};this.geometries={};this.renderer={};}${actualGet}${actualGetChainMap}\ncreateRenderObject(...args){return this.create(...args);}}`)(ChainMap);

function extract(source) {
  const queue=method(source,'_createObjectPipeline');
  const totalStart=source.indexOf('const total = compilationPromises.length');assert(totalStart>=0);
  const compile=/\n([ \t]+)async compileAsync\([^\n]+\) \{/g;
  const cm=[...source.matchAll(compile)].filter(m=>m.index<totalStart).at(-1);assert(cm);
  const end=source.indexOf('\n'+cm[1]+'}',cm.index);
  const begin=source.indexOf('for (',totalStart);assert(begin<end);
  const loop=source.slice(begin,end);assert(loop.trimEnd().endsWith('}'));
  return new Function('yieldToMain','ProgressEvent',`return class {${queue}\nasync run(compilationPromises,onProgress=null){const total=compilationPromises.length;let loaded=0;${loop}\nreturn loaded;}}`);
}
function fixture(Factory,failure='none',target=true,patched=true) {
 const material={side:2,version:0,transparent:true,forceSinglePass:false},object={name:target?'cinema__projector_7':'cinema__beam_1',geometry:{drawRange:{start:0,count:24}}},scene={},camera={},lights={},context={};
 const error=Object.assign(new Error(failure),{name:failure==='abort'?'AbortError':'Error'});
 const nodeSides=[],pipelineSides=[],objects=[];let rejectNode,originalCalls=0;
 const expected=row=>target&&patched?(row.pass==='backSide'?1:0):2;
 const fail=at=>{if(failure===at)throw error;};
 const check=row=>assert.equal(material.side,expected(row));
 const Engine=Factory(async()=>{assert.equal(material.side,2);assert.equal(engine._isPreCompiling,false);fail('yield');},class{constructor(type,info){Object.assign(this,info);}});
 const engine=new Engine();engine._isPreCompiling=false;engine._compilationPromises=[];engine._currentRenderContext=context;
 engine._objects=new ActualGetEngine((nodes,geometries,renderer,o,m,s,c,l,r,k,pass)=>{
  assert.equal(m,material);assert.equal(m.side,target&&patched?(pass==='backSide'?1:0):2);fail('objects');
  const row={material:m,version:m.version,initialCacheKey:m.side,needsUpdate:false,needsGeometryUpdate:false,updateClipping(){},pass,getCacheKey(){return this.material.side;}};objects.push(row);return row;
 });
 engine._nodes={getForRenderAsync(row){nodeSides.push(material.side);check(row);assert.equal(engine._isPreCompiling,false);originalCalls++;if(failure==='abort')return new Promise((resolve,reject)=>{rejectNode=reject;});if(failure==='nodeAsync')return Promise.reject(error);return Promise.resolve();},updateBefore(row){check(row);assert.equal(engine._isPreCompiling,true);fail('before');},updateForRender(row){check(row);fail('nodes');},updateAfter(row){check(row);assert.equal(engine._isPreCompiling,true);fail('after');}};
 engine._geometries={updateForRender(row){check(row);fail('geometry');}};
 engine._bindings={updateForRender(row){check(row);fail('bindings');}};
 engine._pipelines={getForRender(row,promises){assert.equal(engine._isPreCompiling,false);pipelineSides.push(material.side);assert.equal(material.side,patched?(row.pass==='backSide'?1:0):2);fail('pipelineSync');if(promises)promises.push(Promise.resolve().then(()=>{check(row);fail('pipelineAsync');}));}};
 for(const [side,pass]of [[1,'backSide'],[0,undefined]]){material.side=side;engine._createObjectPipeline(object,material,scene,camera,lights,null,null,pass);}material.side=2;
 return {engine,material,error,objects,nodeSides,pipelineSides,get rejectNode(){return rejectNode;},get originalCalls(){return originalCalls;}};
}
for(const [format,source]of [['compiled',fs.readFileSync(path.join(root,'fixtures/compiled-renderer-fragments.txt'),'utf8')],['vendor',vendor]]){
 const bundle=patchAsyncPassSide067(source);assert(bundle.proof.exactReversal);const patched=bundle.source;
 for(const target of [true,false])for(const failure of ['none','objects','nodeAsync','before','geometry','nodes','bindings','pipelineSync','pipelineAsync','after','progress','yield','abort']){
  const f=fixture(extract(patched),failure,target);assert.deepEqual(f.engine._compilationPromises.map(x=>x.materialSide067),[1,0]);
  const promise=f.engine.run(f.engine._compilationPromises,()=>{assert.equal(f.material.side,2);assert.equal(f.engine._isPreCompiling,false);if(failure==='progress')throw f.error;});
  const atFirstWait=f.material.side;
  if(failure==='abort'){assert(f.rejectNode);assert.equal(atFirstWait,target?1:2);assert.equal(f.engine._isPreCompiling,false);f.rejectNode(f.error);}
  if(failure==='none'){assert.equal(await promise,2);assert.deepEqual(f.nodeSides,target?[1,0]:[2,2]);assert.deepEqual(f.pipelineSides,[1,0]);assert.equal(f.originalCalls,2);assert.equal(f.objects.length,2);}else await assert.rejects(promise,e=>e===f.error);
  assert.equal(f.material.side,2);assert.equal(f.engine._isPreCompiling,false);
  cases.push({format,target,failure,observedSideAtFirstWait:atFirstWait,nodeSides:f.nodeSides,pipelineSides:f.pipelineSides,restoredMaterialSide:2,restoredFlag:false,errorIdentityPreserved:failure!=='none'});
 }
 for(const target of [true,false]){const f=fixture(extract(source),'none',target,false);assert.equal(await f.engine.run(f.engine._compilationPromises),2);assert.deepEqual(f.nodeSides,[2,2]);assert.deepEqual(f.pipelineSides,[2,2]);cases.push({format,target,originalBaseline:true,nodeSides:f.nodeSides,pipelineSides:f.pipelineSides});}
}
const result={packet:'DOTS-CODEX-011-PROTECTED-HALL-ASYNC-PASS-SIDE-PREPARATION-067',revision:'targeted-projector-F',at:new Date().toISOString(),casesPassed:cases.length,cases,exactSourceQueueAndLoop:true,exactSourceRenderObjectsGetAndChainMap:true,renderObjectFactoryAndBackendFake:true,noSimulatedCacheZeroQualification:true,onlyExactProjectorNodeSideChanged:true,otherNodesKeepOriginalSide:true,targetSideRemainsSetAcrossAwait:true,restoredBeforeProgressAndYield:true,existingCompileDrawHoldAndDrainRequired:true,nativeQualified:false,concurrentCompileOrDrawQualified:false};
console.log(JSON.stringify({casesPassed:cases.length,onlyTargetedProjector:true,restoreOnAll13PathsBothFormats:true,nativeQualified:false}));
