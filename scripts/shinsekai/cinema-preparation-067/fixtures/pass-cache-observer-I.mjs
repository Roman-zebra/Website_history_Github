// Private bounded cache observation. No extra renderer, node, pipeline, or GPU calls.
export function createPassCacheObserver067({limitPerPhase=32}={}){
 const owners=new WeakMap(),active=new Set(),ids=new WeakMap();
 const compileRows=[],firstDrawRows=[];let serial=0,errors=0,droppedCompile=0,droppedDraw=0,firstDrawID=null,firstProjectorDrawID=null,restored=0,generation=0;
 const bound=Math.min(64,Math.max(0,limitPerPhase|0));
 const id=x=>{if(!x||typeof x!=='object')return null;let n=ids.get(x);if(!n){n=++serial;ids.set(x,n);}return n;};
 const hash=s=>{if(typeof s!=='string')return null;let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return {length:s.length,fnv1a32:(h>>>0).toString(16).padStart(8,'0')};};
 function target(scope,material,object){
  if(!String(object?.name??'').startsWith('cinema__'))return null;
  if(!material?.transparent||material.forceSinglePass!==false)return null;
  if(scope?.cinemaCompiling)return compileRows;
  const r=scope?.render;
  if(r?.site!=='scheduled-draw'||r.cinemaState!=='ready')return null;
  if(firstDrawID===null)firstDrawID=r.id;
  if(object.name==='cinema__projector_7'&&firstProjectorDrawID===null){firstProjectorDrawID=r.id;r.projectorVisible067=true;}
  return r.id===firstDrawID||(object.name==='cinema__projector_7'&&r.id===firstProjectorDrawID)?firstDrawRows:null;
 }
 function describe(renderer,ro,withShader=true){
  if(!ro)return null;
  const n=renderer._nodes?.data?.get(ro)?.nodeBuilderState;
  const p=renderer._pipelines?.data?.get(ro)?.pipeline;
  return {renderObjectID:id(ro),objectID:id(ro.object),materialID:id(ro.material),
   objectName:String(ro.object?.name??'').slice(0,100),materialName:String(ro.material?.name??'').slice(0,100),
   geometryID:id(ro.geometry),contextID:id(ro.context),renderContextID:id(ro.renderContext),lightsNodeID:id(ro.lightsNode),
   materialSide:ro.material?.side,materialVersion:ro.material?.version,renderObjectVersion:ro.version,
   initialCacheKey:ro.initialCacheKey,initialNodesCacheKey:ro.initialNodesCacheKey,
   clippingCacheKey:ro.clippingContext?.cacheKey??null,
   rendererContextNodeID:renderer.contextNode?.id,rendererContextNodeVersion:renderer.contextNode?.version,
   nodeBuilderStateID:id(n),...(withShader?{vertex:hash(n?.vertexShader),fragment:hash(n?.fragmentShader)}:{}),
   pipelineID:id(p),pipelineKey:p?.cacheKey??null,pipelineUsedTimes:p?.usedTimes??null};
 }
 function available(rows){if(!rows)return false;if(rows.length<bound)return true;if(rows===compileRows)droppedCompile++;else droppedDraw++;return false;}
 function capture(rows,row){if(!rows)return;if(rows.length>=bound){if(rows===compileRows)droppedCompile++;else droppedDraw++;return;}rows.push(row);}
 function ensure(renderer,getScope){
  if(owners.has(renderer))return;
  const state={renderer,bindings:[]};owners.set(renderer,state);active.add(state);
  function install(object,name,make){const original=object?.[name];if(typeof original!=='function')throw Error('Missing original cache method '+name);const descriptor=Object.getOwnPropertyDescriptor(object,name),wrapper=make(original);
   Object.defineProperty(object,name,{configurable:true,writable:true,enumerable:descriptor?.enumerable??false,value:wrapper});
   state.bindings.push({object,name,original,descriptor,wrapper});
  }
  install(renderer._objects,'get',original=>function(...args){
   let rows=null,scope=null;try{scope=getScope();rows=target(scope,args[1],args[0]);if(!available(rows))rows=null;}catch{errors++;}
   let result,outcome='returned';try{result=Reflect.apply(original,this,args);return result;}catch(e){outcome='threw';throw e;}finally{
    if(rows)try{capture(rows,{method:'objects.get',outcome,renderID:scope.render?.id??null,passID:args[7]??'default',
     input:{objectID:id(args[0]),materialID:id(args[1]),side:args[1]?.side,version:args[1]?.version,
      contextID:id(args[5]),lightsNodeID:id(args[4]),clippingID:id(args[6])},
     after:describe(renderer,result,false)});}catch{errors++;}
   }
  });
  install(renderer._pipelines,'getForRender',original=>function(...args){
   let rows=null,scope=null,before=null;try{scope=getScope();rows=target(scope,args[0]?.material,args[0]?.object);if(!available(rows))rows=null;if(rows){const b=describe(renderer,args[0],false);before={renderObjectID:b.renderObjectID,materialSide:b.materialSide,initialCacheKey:b.initialCacheKey,nodeBuilderStateID:b.nodeBuilderStateID,pipelineID:b.pipelineID,pipelineKey:b.pipelineKey};}}catch{errors++;}
   let result,outcome='returned';try{result=Reflect.apply(original,this,args);return result;}catch(e){outcome='threw';throw e;}finally{
    if(rows)try{capture(rows,{method:'pipelines.getForRender',outcome,renderID:scope.render?.id??null,before,after:describe(renderer,args[0]),returnedPipelineID:id(result)});}catch{errors++;}
   }
  });
 }
 function restore(renderer){const state=owners.get(renderer);if(!state)return;for(const b of state.bindings){if(b.object[b.name]!==b.wrapper)throw Error('Cache observer ownership changed '+b.name);if(b.descriptor)Object.defineProperty(b.object,b.name,b.descriptor);else delete b.object[b.name];}
  state.bindings.length=0;state.renderer=null;owners.delete(renderer);active.delete(state);restored++;
 }
 function beginCinemaCompile(){generation++;compileRows.length=0;firstDrawRows.length=0;firstDrawID=null;firstProjectorDrawID=null;droppedCompile=0;droppedDraw=0;}
 function snapshot(){return {schema:'JTA_PASS_CACHE_OBSERVATION_067_I',shaderDiagnosticPlacement:'pipeline after only; object and pipeline before duplicates omitted',generation,retainsOnlyCurrentCinemaGeneration:true,compileRows,firstDrawRows,firstDrawID,firstProjectorDrawID,firstProjectorCanDifferFromFirstCinemaReadyCallback:true,limitPerPhase:bound,maxRows:bound*2,errors,droppedCompile,droppedDraw,activeOwners:active.size,restoredOwners:restored,shaderHashes:'FNV1a32+length diagnostic only, not cryptographic source pin',extraResourceCalls:false,extraFrames:false,observationCPUIncluded:true,nativeQualified:false};}
 return Object.freeze({ensure,restore,snapshot,beginCinemaCompile});
}
export const passCacheObserver067=createPassCacheObserver067();
