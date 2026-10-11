// QA-only passive proof. No resource acquisition or retirement calls.
export function qualifySkippedNativeLossT5067(result,evidence){
 const r=result?.retirement,s=result?.native,b=s?.rendererBackend,e=evidence;
 return r?.status==='retired'&&r.reason==='pagehide'&&r.error===null&&r.step===null&&
 e?.trustedPagehideObserved===true&&e.sourceRegistered===true&&e.deviceObserved===true&&
 e.parentGPUAdapterRealmT4===true&&e.parentGPUAdapterRequestsT4===1&&
 typeof e.expectedBuild==='string'&&e.expectedBuild.length===64&&s?.sourceBuildId===e.expectedBuild&&
 e.nativeDeviceLost?.reason==='destroyed'&&b?.actualBackend==='WebGPU'&&b.initializationSucceeded===true&&
 b.retirementObserved===true&&b.gpuDeviceLossObserved===true&&b.gpuDeviceLoss?.reason==='destroyed'&&
 b.retirementWaitSkipped===true&&b.retirementWaitTimedOut===false&&b.errorCount===0&&b.callbacksRestored===true;
}
export function assertPassiveHallReviewRetiredT5067(result,{canceledBeforeFirstFrame=false,nativePagehideEvidence=null}={}){
 const r=result?.retirement,s=result?.native;
 const check=(ok,label)=>{if(!ok)throw Error('Hall return blocked: '+label);};
 check(r?.status==='retired'&&!r.error,'retirement incomplete');
 check(s?.disposed===true&&s.ready===false,'source still active');
 check(s.ownedModels===0&&s.texturePool?.activeLeases===0,'models or texture leases remain');
 check(s.pendingFetches===0&&s.modelTransport?.disposed===true&&s.modelTransport.pendingNativeTotal===0&&s.modelTransport.leaseCount===0&&s.modelTransport.owned?.totalBytes===0,'transport remains');
 check(s.releaser?.failures===0,'release failure');
 check(s.rooms&&Object.values(s.rooms).every(x=>x.state==='retired'&&x.counts.ownedParts===0&&x.counts.readyGroups===0),'resident room remains');
 const b=s.rendererBackend;
 if(b?.initializationSucceeded){
  check((b.firstFrameObserved===true||(canceledBeforeFirstFrame===true&&s.frames===0))&&b.retirementObserved===true&&b.callbacksRestored===true&&b.errorCount===0,'renderer terminal not proved');
  check(s.rendererMemory&&Object.keys(s.rendererMemory).length>0&&Object.values(s.rendererMemory).every(v=>v===0),'renderer memory remains');
  if(b.actualBackend==='WebGPU')check((b.gpuRetirementConfirmed===true||qualifySkippedNativeLossT5067(result,nativePagehideEvidence))&&b.gpuDeviceLossObserved===true&&b.gpuDeviceLoss?.reason==='destroyed','GPU destruction not proved');
 }else check(!s.rendererMemory||Object.values(s.rendererMemory).every(v=>v===0),'uninitialized renderer memory remains');
 check(s.lowerStair?.ended===true&&s.lowerStair.leased===false,'lower host remains');
 check(Array.isArray(s.stairSourceRenderOwners)&&s.stairSourceRenderOwners.length===0,'private stair source remains');
 for(const p of s.stairSourceRenderRetirements??[])check(p.retired===true&&p.ownedGeometries===0&&p.ownedBytes===0&&p.retainedVerificationBytes===0&&p.rawSourceBindingsRestored===true&&p.sourceBufferWritesByOwner===0&&p.disposalErrors?.length===0,'source copies remain');
 const lower=s.lowerStair.resources;
 if(lower){check(lower.disposed===true&&lower.owner?.disposed===true&&lower.owner.ownedGeometries===0&&lower.owner.ownedMaterials===0&&lower.owner.sourceBindingsRestored===true,'lower drawing remains');for(const p of [lower.guard,lower.packed])check(p?.disposed===true&&['triangles','typedArrayBytes','ownedPacketBytes','groundTriangles','retainedMetadataBytes','sourceIDRows','sourceOwnerRows'].every(k=>p[k]===0),'lower packet remains');check(lower.bindings?.disposed===true&&lower.bindings.copiesBytes===0&&lower.bindings.meshes===0&&lower.bindings.sourceWrites===0,'lower bindings remain');}
 return true;
}
export function patchPassiveRetirementSnapshotT5067(bundle){
 const original=bundle,anchor='  exportEvidence: () => JSON.parse(JSON.stringify(snapshot2(true))),',insert=anchor+'\n  readRetirementT5067: () => ({ retirement: retirement.snapshot(), native: JSON.parse(JSON.stringify(snapshot2())) }),';
 if(typeof bundle!=='string'||bundle.split(anchor).length!==2)throw Error('Unique original lifecycle snapshot seam required');
 const patched=bundle.replace(anchor,insert);
 if(patched.replace(insert,anchor)!==original)throw Error('Passive snapshot exact restoration failed');
 return {bundle:patched,proof:{exactRestoration:true,readOnlySnapshot:true,additionalRetireDisposeCloseCalls:0,originalControlledRetireUnchanged:true}};
}
export function qualifyPassiveHostLossT5067(r){
 const g=r?.lastGate,s=g?.source,b=s?.rendererBackend,p=g?.hostLease?.passiveNativeRetirement;
 return p?.schema==='PASSIVE_NATIVE_RETIREMENT_T5_067'&&p.verified===true&&p.reason==='pagehide'&&p.trustedPagehide===true&&p.originalAllResourceAssertionsPassed===true&&p.observerCallsRetireDisposeClose===false&&p.sourceBuildId===s?.sourceBuildId&&p.actualBackend==='WebGPU'&&p.sourceNativeLoss==='destroyed'&&p.parentNativeLoss==='destroyed'&&r?.deviceLost?.reason==='destroyed'&&b?.gpuDeviceLossObserved===true&&b.gpuDeviceLoss?.reason==='destroyed'&&b.retirementWaitSkipped===true&&b.retirementWaitTimedOut===false;
}
// Exact QA-only seams; original native lifecycle remains the resource owner.
export function patchPassiveIntegrationT5067({ownership,gate,parent,abrupt,host,bundle}){
 const originals={ownership,gate,parent,abrupt,host,bundle},edits=[];
 const edit=(key,a,b)=>{if(typeof originals[key]!=='string'||originals[key].split(a).length!==2)throw Error('Unique passive '+key+' seam required');originals[key]=originals[key].replace(a,b);edits.push([key,a,b]);};
 edit('ownership'," let state='open',pending=null,result=null,error=null;"," let state='open',pending=null,result=null,error=null,passiveNativeProofT5067=null;");
 edit('ownership',"cleanupFailed:state==='failed',error});","cleanupFailed:state==='failed',error,passiveNativeRetirement:passiveNativeProofT5067});");
 edit('ownership',' function close(){'," function observeNativePagehideT5067(evidence){\n  if(state==='closed')return passiveNativeProofT5067;\n  if(state!=='open'||pending||!runtime.readRetirementT5067)return null;\n  let candidate,serialized;\n  try{candidate=runtime.readRetirementT5067();serialized=JSON.stringify(candidate);if(new TextEncoder().encode(serialized).byteLength>96*1024)return null;assertPassiveHallReviewRetiredT5067(candidate,{nativePagehideEvidence:evidence});if(candidate.retirement.reason!=='pagehide'||evidence?.trustedPagehideObserved!==true||evidence.sourceRegistered!==true||candidate.native.sourceBuildId!==evidence.expectedBuild)return null;}catch{return null;}\n  result=candidate;\n  passiveNativeProofT5067=Object.freeze({schema:'PASSIVE_NATIVE_RETIREMENT_T5_067',verified:true,reason:candidate.retirement.reason,sourceBuildId:candidate.native.sourceBuildId,actualBackend:candidate.native.rendererBackend.actualBackend,rawGPUConfirmation:candidate.native.rendererBackend.gpuRetirementConfirmed,sourceNativeLoss:candidate.native.rendererBackend.gpuDeviceLoss?.reason??null,parentNativeLoss:evidence.nativeDeviceLost?.reason??null,trustedPagehide:true,originalAllResourceAssertionsPassed:true,fullSnapshotBytes:new TextEncoder().encode(serialized).byteLength,observerCallsRetireDisposeClose:false});\n  state='closed';return passiveNativeProofT5067;\n }\n"+" function close(){if(state==='closed'&&passiveNativeProofT5067)return Promise.resolve(result);");
 edit('ownership','{snapshot,close,result:()=>result}','{snapshot,close,result:()=>result,observeNativePagehideT5067}');
 edit('gate','const receipt = () => ({','const receipt = nativePagehideEvidence => {if(nativePagehideEvidence)hostEntry?.observeHallReviewNativePagehideT5067(nativePagehideEvidence);return ({');
 edit('gate','published: false });\nfunction publish()','published: false, passiveRetirementResultT5067:hostEntry?.readPassiveRetirementResultT5067()??null });};\nfunction publish()');
 edit('parent','if(r.gateRead)r.lastGate=r.gateRead();',"if(r.gateRead)r.lastGate=r.gateRead(r.abruptDetached?{trustedPagehideObserved:r.events.some(e=>e.kind==='native-pagehide'&&e.detail?.isTrusted===true),sourceRegistered:r.sourceRegistered===true,deviceObserved:r.deviceObserved===true,parentGPUAdapterRealmT4:r.parentGPUAdapterRealmT4===true,parentGPUAdapterRequestsT4:r.parentGPUAdapterRequestsT4??0,expectedBuild:EXPECTED_BUILD,nativeDeviceLost:r.deviceLost}:undefined);");
 edit('abrupt',"(b.actualBackend!=='WebGPU'||b.gpuRetirementConfirmed===true)","(b.actualBackend!=='WebGPU'||b.gpuRetirementConfirmed===true||qualifyPassiveHostLossT5067(r))");
 edit('host','export function readHallReviewEntry067(){return read();}','export function readHallReviewEntry067(){return read();}\nexport function observeHallReviewNativePagehideT5067(evidence){return lease.observeNativePagehideT5067(evidence);}\nexport function readPassiveRetirementResultT5067(){return lease.snapshot().passiveNativeRetirement?.verified?lease.result():null;}');
 const ownershipPrefix="import {assertPassiveHallReviewRetiredT5067} from './passive-native-retirement-T5067.mjs';\n",abruptPrefix="import {qualifyPassiveHostLossT5067} from './passive-native-retirement-T5067.mjs';\n";
 const result={...originals,ownership:ownershipPrefix+originals.ownership,abrupt:abruptPrefix+originals.abrupt,bundle:patchPassiveRetirementSnapshotT5067(bundle).bundle};
 const restored={...result,ownership:result.ownership.slice(ownershipPrefix.length),abrupt:result.abrupt.slice(abruptPrefix.length),bundle};
 for(const [key,a,b]of edits.slice().reverse())restored[key]=restored[key].replace(b,a);
 for(const [key,value]of Object.entries({ownership,gate,parent,abrupt,host,bundle}))if(restored[key]!==value)throw Error('Passive exact restoration '+key+' failed');
 return {...result,proof:{sixOriginalFilesExactlyRestored:true,originalAllResourceAssertionsUnchanged:true,rawSourceGPUConfirmationUnchanged:true,originalControlledCloseUnchanged:true,additionalRetireDisposeCloseCalls:0,passiveMetadataOnly:true,nativeQualified:false}};
}
