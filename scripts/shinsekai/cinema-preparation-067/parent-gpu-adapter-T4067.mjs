// QA only. Acquire an adapter in the surviving parent; the original backend owns requestDevice/dispose.
export function createParentGPUAdapterBrokerT4067({gpu,getActive,getFrameWindow}={}){
  if(typeof getActive!=='function'||typeof getFrameWindow!=='function')throw Error('Invalid parent adapter ownership dependencies');
  const nativeRequestAdapter=gpu?.requestAdapter;
  return Object.freeze({requestAdapter(options,child){
    const r=getActive();
    if(!r||r.left||r.closing||r.abruptDetached||child!==getFrameWindow())throw Error('Inactive parent adapter owner');
    if((r.parentGPUAdapterRequestsT4??0)!==0)throw Error('Duplicate parent adapter acquisition');
    if(typeof nativeRequestAdapter!=='function')throw Error('Native WebGPU adapter unavailable');
    r.parentGPUAdapterRequestsT4=1;r.parentGPUAdapterRealmT4=true;
    return nativeRequestAdapter.call(gpu,options);
  },deviceRequestsAdded:0,deviceRetirementCallsAdded:0});
}
export function requestSurvivingGPUAdapterT4067(options){
  const parent=window.parent;
  if(parent===window||parent.location.origin!==location.origin)throw Error('Same-origin surviving GPU parent required');
  const request=parent.__jtaProtectedParent067?.requestNativeGPUAdapterT4067;
  if(typeof request!=='function')throw Error('Surviving GPU adapter broker unavailable');
  return request(options,window);
}
export function patchParentGPUAdapterT4067({entry,bundle}){
  const originalEntry=entry,originalBundle=bundle;
  const parentAnchor='window.__jtaProtectedParent067={cinemaPreparationStarted067(){';
  const parentReplacement='window.__jtaProtectedParent067={requestNativeGPUAdapterT4067:(options,child)=>gpuAdapterBrokerT4067.requestAdapter(options,child),cinemaPreparationStarted067(){';
  const summaryAnchor='deviceObserved:!!r.deviceObserved,';
  const summaryReplacement=summaryAnchor+'parentGPUAdapterRealmT4:r.parentGPUAdapterRealmT4===true,parentGPUAdapterRequestsT4:r.parentGPUAdapterRequestsT4??0,';
  const adapterAnchor='await navigator.gpu.requestAdapter(adapterOptions)',adapterReplacement='await requestSurvivingGPUAdapterT4067(adapterOptions)';
  if(typeof entry!=='string'||typeof bundle!=='string'||entry.split(parentAnchor).length!==2||entry.split(summaryAnchor).length!==2||bundle.split(adapterAnchor).length!==2)throw Error('Parent GPU adapter seams must be unique');
  const parentPrefix='import {createParentGPUAdapterBrokerT4067} from "./parent-gpu-adapter-T4067.mjs";\n';
  const parentSuffix='\nconst gpuAdapterBrokerT4067=createParentGPUAdapterBrokerT4067({gpu:navigator.gpu,getActive:()=>active,getFrameWindow:()=>frame.contentWindow});\n';
  const bundlePrefix='import {requestSurvivingGPUAdapterT4067} from "../../parent-gpu-adapter-T4067.mjs";\n';
  entry=parentPrefix+entry.replace(parentAnchor,parentReplacement).replace(summaryAnchor,summaryReplacement)+parentSuffix;
  bundle=bundlePrefix+bundle.replace(adapterAnchor,adapterReplacement);
  if(entry.slice(parentPrefix.length,-parentSuffix.length).replace(parentReplacement,parentAnchor).replace(summaryReplacement,summaryAnchor)!==originalEntry||bundle.slice(bundlePrefix.length).replace(adapterReplacement,adapterAnchor)!==originalBundle)throw Error('Parent adapter exact restoration failed');
  return {entry,bundle,proof:{parentAdapterSeams:1,parentAPIBindingSeams:1,parentSummarySeams:1,originalParentExactlyRestored:true,originalBundleExactlyRestored:true,originalInternalDeviceCreationUnchanged:true,originalFeatureAndLimitSelectionUnchanged:true,parametersDeviceNotAssigned:true,originalNativeDestroyBranchUnchanged:true,extraAdapterCalls:0,extraDeviceCalls:0,retirementCallsAdded:0,sourceMovementAndRenderUnchanged:true,nativeQualified:false}};
}
