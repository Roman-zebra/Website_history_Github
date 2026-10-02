// Borrow one scalar during a frame or awaited preparation; keep source identity.
export function createHallFillLook(light,{gain=.1}={}){
 if(!light?.isDirectionalLight||![0,.1,.25,.5,1].includes(gain)||!Number.isFinite(light.intensity)||light.intensity<0)throw new Error('Invalid hall fill comparison');
 let active=false,disposed=false,last=null;
 return {get stats(){return {route:'original-directional-intensity-uniform',gain,last,lightIdentityPreserved:true,shadowStateChanged:false,rendererContextChanged:false,geometryChanged:false,mapsChanged:false,visualAcceptance:false};},withApplied(render){
  if(disposed||active||typeof render!=='function'||!Number.isFinite(light.intensity)||light.intensity<0)throw new Error('Invalid hall fill scope');
  const source=light.intensity,candidate=source*gain;active=true;
  try{light.intensity=candidate;return render();}
  finally{light.intensity=source;active=false;last={sourceIntensity:source,candidateIntensity:candidate,restoredIntensity:light.intensity,sourceRestored:light.intensity===source};}
 },async withAppliedAsync(prepare){
  if(disposed||active||typeof prepare!=='function'||!Number.isFinite(light.intensity)||light.intensity<0)throw new Error('Invalid hall fill scope');
  const source=light.intensity,candidate=source*gain;active=true;
  try{light.intensity=candidate;return await prepare();}
  finally{light.intensity=source;active=false;last={sourceIntensity:source,candidateIntensity:candidate,restoredIntensity:light.intensity,sourceRestored:light.intensity===source};}
 },dispose(){if(disposed)return null;if(active)throw new Error('Cannot dispose active hall fill');disposed=true;return {sourceRestored:last?.sourceRestored??true,ownedResources:0};}};
}
