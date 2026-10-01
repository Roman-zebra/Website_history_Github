export const PHONE_BUDGET=Object.freeze({bufferEdge:720,initialBytes:8388608,cellBytes:4194304,triangles:160000,draws:200,textureBytes:134217728});
// Conservative whole-active-asset totals; actual frustum culling may draw less.
export function checkPhoneAssembly(parts,cell=null){
  const exterior=['TB_EXT_LOD2.glb','TW_LOD2.glb'].map(file=>parts.find(p=>p.file===file));
  const room=cell?parts.find(p=>p.file===cell+'.glb'):null;
  const active=[...exterior,...(cell?[room]:[])],reasons=[];
  if(active.some(p=>!p))return {allowed:false,reasons:['missing measured asset inventory']};
  if(active.some(p=>![p.bytes,p.triangles,p.draws,p.estimatedTextureBytes].every(Number.isFinite)))return {allowed:false,reasons:['unknown asset cost']};
  const totals={initialBytes:exterior.reduce((n,p)=>n+p.bytes,0),cellBytes:room?.bytes??0,triangles:active.reduce((n,p)=>n+p.triangles,0),draws:active.reduce((n,p)=>n+p.draws,0),textureBytes:active.reduce((n,p)=>n+p.estimatedTextureBytes,0)};
  for(const [key,value]of Object.entries(totals))if(value>PHONE_BUDGET[key])reasons.push(key+' exceeds phone budget');
  return {...totals,allowed:reasons.length===0,reasons};
}
export function phoneBuffer(width,height){const scale=Math.min(1,PHONE_BUDGET.bufferEdge/Math.max(width,height));return [Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale))];}
