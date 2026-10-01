// One complete room, including pending loads. The host detaches before changing
// the selected key; this owner releases it. Failed loads must clean their siblings.
export function createRoomPrefetch({plans,load,release,onChange=()=>{},maxBytes=20971520,maxTextureBytes=134217728}){
 const inventory=new Map(plans.map(p=>[p.id,p]));
 if(inventory.size!==plans.length)throw new Error('Duplicate prefetch room');
 for(const p of plans)if(![p.bytes,p.textureBytes].every(v=>Number.isSafeInteger(v)&&v>=0)||p.bytes<1||p.bytes>maxBytes||p.textureBytes>maxTextureBytes)throw new Error('Unknown or excessive complete-room cost');
 let desired=null,epoch=0,slot=null,inFlight=null,disposed=false,fatal=null,error=null,requestedBytes=0,selected=Promise.resolve(null),serial=selected;
 function snapshot(){return {desired,status:fatal?'cleanup-required':inFlight?'loading':slot?'resident':error?'failed':'empty',residentKey:slot?.key??null,pendingKey:inFlight?.key??null,reservedBytes:(slot?.plan.bytes??0)+(inFlight?.plan.bytes??0),reservedTextureBytes:(slot?.plan.textureBytes??0)+(inFlight?.plan.textureBytes??0),requestedAssetBytes:requestedBytes,...(error?{error:String(error.message??error)}:{})};}
 function notify(){onChange(snapshot());}
 async function clearSlot(){if(!slot)return;try{await release(slot.value);}catch(e){fatal=e;error=e;notify();throw e;}slot=null;notify();}
 function enqueue(key){
  const token=++epoch;desired=key;error=null;
  selected=serial.catch(()=>{}).then(async()=>{
   if(token!==epoch)return null;
   if(fatal)throw fatal;
   if(slot?.key===key)return slot.value;
   await clearSlot();if(token!==epoch||!key)return null;
   const plan=inventory.get(key);inFlight={key,plan};requestedBytes+=plan.bytes;notify();
   let value;
   try{value=await load(key);}catch(e){
    // An aggregate cleanup error means the host could not certify release.
    if(e instanceof AggregateError)fatal=e;else inFlight=null;
    if(token===epoch){error=e;notify();}throw e;
   }
   if(disposed||token!==epoch){
    try{await release(value);}catch(e){fatal=e;error=e;notify();throw e;}
    inFlight=null;notify();return null;
   }
   slot={key,plan,value};inFlight=null;notify();return value;
  });serial=selected;return selected;
 }
 return {snapshot,select(key){
  if(disposed)throw new Error('Prefetch owner disposed');
  if(key!==null&&!inventory.has(key))throw new Error('Unknown prefetch room');
  if(key===desired)return selected;
  return enqueue(key);
 },dispose(){if(disposed)return serial;disposed=true;return enqueue(null);}};
}
export function nearStudyPortal(position,{portal,enter=8,leave=12},retained=false){
 if(!(enter>0&&leave>enter)||position.length!==3||portal.length!==3||![...position,...portal].every(Number.isFinite))throw new Error('Invalid study portal');
 return Math.hypot(...portal.map((v,i)=>v-position[i]))<=(retained?leave:enter);
}
