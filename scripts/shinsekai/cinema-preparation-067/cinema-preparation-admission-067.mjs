// Fixed cinema preparation only; normal draw flags restore synchronously.
const baselineDoublePassNames = new Set([
 'cinema__beam_1','cinema__doors_3','cinema__walls_14',
 'cinema__foyer_4','cinema__foyer_16','cinema__projector_7'
]);
export function createCinemaPreparationAdmission067({limit=4,maxMeshes=512}={}) {
 const rows=[];let dropped=0;
 const rowBound=Math.min(8,Math.max(0,limit|0));
 function compile(renderer,scene,camera,phase,invoke){
  if(phase?.owner!=='cinema')return invoke();
  if(renderer._initialized!==true)throw Error('Cinema admission requires initialized original renderer');
  const root=scene.getObjectByName('cell_cinema');
  const projector=scene.getObjectByName('cinema__projector_7');
  if(!root||typeof root.traverse!=='function'||!projector||Array.isArray(projector.material)||
   projector.material?.transparent!==true||projector.material.forceSinglePass!==false||projector.material.side!==2)
   throw Error('Fixed cinema preparation contract changed');
  const candidates=[],found=new Set();let meshCount=0,excludedDoublePass=0;
  root.traverse(object=>{
   if(object.isMesh!==true)return;
   if(++meshCount>Math.min(512,Math.max(1,maxMeshes|0)))throw Error('Fixed cinema mesh bound exceeded');
   if(baselineDoublePassNames.has(object.name))found.add(object.name);
   const materials=Array.isArray(object.material)?object.material:[object.material];
   if(!materials.length||materials.some(m=>!m))throw Error('Fixed cinema material missing');
   const sideInvariant=materials.every(m=>m.transparent!==true||m.forceSinglePass===true||m.side!==2);
   if(!sideInvariant&&!baselineDoublePassNames.has(object.name)){excludedDoublePass++;return;}
   const descriptor=Object.getOwnPropertyDescriptor(object,'frustumCulled');
   if(descriptor&&(!Object.hasOwn(descriptor,'value')||descriptor.writable!==true))
    throw Error('Cinema frustum descriptor cannot be safely changed');
   if(!descriptor&&!Object.isExtensible(object))throw Error('Cinema frustum owner is not extensible');
   candidates.push({object,descriptor,original:object.frustumCulled});
  });
  for(const name of baselineDoublePassNames)if(!found.has(name))throw Error('Fixed cinema baseline mesh missing: '+name);
  if(!candidates.some(c=>c.object===projector))throw Error('Fixed projector is outside cinema root');
  const row={name:'cinema__projector_7',meshCount,admittedMeshes:candidates.length,excludedUnknownDoublePass:excludedDoublePass,
   admittedNames:candidates.slice(0,12).map(c=>String(c.object.name).slice(0,100)),
   originalFrustumCulled:projector.frustumCulled,admittedDuringOriginalTraversal:true,
   restoredBeforeAsyncWait:false,materialSideAtAdmission:projector.material.side,
   materialGeometryVisibilityAndLayersUnchanged:true};
  if(rows.length<rowBound)rows.push(row);else dropped++;
  let changed=0;
  try{
   for(const c of candidates){changed++;c.object.frustumCulled=false;if(c.object.frustumCulled!==false)throw Error('Cinema admission assignment failed');}
   return invoke();
  }finally{
   let restored=true;
   for(let i=changed-1;i>=0;i--){const c=candidates[i];if(c.descriptor)Object.defineProperty(c.object,'frustumCulled',c.descriptor);else delete c.object.frustumCulled;restored=restored&&c.object.frustumCulled===c.original;}
   row.restoredBeforeAsyncWait=restored;
   if(!restored)throw Error('Cinema frustum state restoration failed');
  }
 }
 const snapshot=()=>({schema:'JTA_CINEMA_ADMISSION_067_H',rows,dropped,maxRows:rowBound,
  extraCompileOrDrawCalls:false,normalRenderFrustumUnchanged:true,
  restoredBeforeAsyncWait:rows.every(r=>r.restoredBeforeAsyncWait),
  unknownTransparentDoublePassFrustumPreserved:true,concurrentCompileOrDrawQualified:false,nativeQualified:false});
 return Object.freeze({compile,snapshot});
}
export const cinemaPreparationAdmission067=createCinemaPreparationAdmission067();
