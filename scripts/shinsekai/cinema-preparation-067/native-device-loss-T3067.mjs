// QA surviving-parent realm only. Observe the native loss Promise; never dispose a device.
const intrinsicThen=Promise.prototype.then;
export function observeNativeDeviceLossT3067(loss,onLoss,onFailure=()=>{}){
  if(typeof onLoss!=='function'||typeof onFailure!=='function')throw Error('Invalid native loss observation callbacks');
  // Avoid foreign thenable assimilation and the foreign .then property.
  return intrinsicThen.call(loss,onLoss,onFailure);
}
export function patchParentDeviceLossT3067(source){
  const anchor='if(device)Promise.resolve(device.lost).then(info=>',replacement='if(device)observeNativeDeviceLossT3067(device.lost,info=>';
  if(typeof source!=='string'||source.split(anchor).length!==2)throw Error('Native device loss parent seam must be unique');
  const prefix='import {observeNativeDeviceLossT3067} from "./native-device-loss-T3067.mjs";\n';
  const result=prefix+source.replace(anchor,replacement);
  if(result.slice(prefix.length).replace(replacement,anchor)!==source)throw Error('Parent device loss exact restoration failed');
  return {source:result,proof:{seams:1,originalParentExactlyRestored:true,avoidsForeignThenableAssimilation:true,observesOriginalNativePromise:true,deviceRetirementCallsAdded:0,deviceChanged:false,sourceRetirementChanged:false,nativeQualified:false}};
}
