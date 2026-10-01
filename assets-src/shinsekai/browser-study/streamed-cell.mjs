// Atomic room assembly: never expose an incomplete set of nearby source meshes.
export function hallStreamParts(receipt,cell){
 if(!['cell_hall','cell_hall_dream'].includes(cell)||receipt?.revision!=='aa030cd'||!receipt.sourceUnchanged||!receipt.partitionUnionExact)throw new Error('Invalid hall stream source receipt');
 const parts=['core','desk','lamps','furnishings'].map(group=>{
  const file=cell+'-'+group+'.glb',matches=receipt.parts.filter(p=>p.file===file);
  if(matches.length!==1)throw new Error('Missing or duplicate hall stream part');
  const p=matches[0];
  if(!/^[a-f0-9]{64}$/.test(p.sha256)||!Number.isSafeInteger(p.bytes)||p.bytes<1||p.bytes>20971520||!p.attributesAndAnimationBytesExact||!p.sourceEncodedImagesExact||!p.triangleOrderAndWindingExact)throw new Error('Unqualified hall stream part');
  return p;
 });
 if(parts.reduce((n,p)=>n+p.bytes,0)>20971520)throw new Error('Hall stream total exceeds study transfer ceiling');
 return parts;
}
export async function loadStreamedCell(parts,{load,createScene,release}){
 if(!Array.isArray(parts)||!parts.length)throw new Error('A complete non-empty stream plan is required');
 const settled=await Promise.allSettled(parts.map(p=>Promise.resolve().then(()=>load(p.file))));
 const models=settled.filter(r=>r.status==='fulfilled').map(r=>r.value);
 try{
  const failure=settled.find(r=>r.status==='rejected');if(failure)throw failure.reason;
  if(models.some(m=>!m?.scene||m.animations?.length))throw new Error('Static source parts required; animation binding needs separate qualification');
  const scene=createScene();for(const model of models)scene.add(model.scene);
  return {scene,animations:[],streamParts:parts.map(p=>({file:p.file,bytes:p.bytes,sha256:p.sha256}))};
 }catch(error){
  const cleaned=await Promise.allSettled(models.map(m=>Promise.resolve().then(()=>release(m))));
  const failures=cleaned.filter(r=>r.status==='rejected').map(r=>r.reason);
  if(failures.length)throw new AggregateError([error,...failures],'Stream load failed; some resource cleanup also failed');
  throw error;
 }
}
