// Private one-factor study. Copies retain every source property except the
// optional single-pass flag; sources and geometry remain owned by the loader.
const names=new Set(['hall__windows_doors_4','TB_EXT_LOD0_glass','TW_LOD0_glass']);
export function createHallGlassPassStudy(scene,{mode='clonecontrol'}={}){
 if(!scene?.traverse||!['clonecontrol','exteriorcontrol','singlepass'].includes(mode))throw new Error('Invalid glass pass study');
 const assignments=[],copies=new Map();let disposed=false;
 try{scene.traverse(object=>{
  if(!object.isMesh||!names.has(object.name)||(mode==='exteriorcontrol'&&object.name==='hall__windows_doors_4'))return;
  const original=object.material;
  const convert=source=>{
   if(!source?.transparent||source.side!==2)throw new Error('Expected double-sided transparent glass');
   if(!copies.has(source)){
    const copy=source.clone();if(copy===source)throw new Error('Glass study must own copies');
    copies.set(source,copy);
    for(const key of ['opacity','transparent','side','depthWrite','depthTest','forceSinglePass','map','normalMap','roughnessMap','alphaMap'])if(copy[key]!==source[key])throw new Error('Glass clone changed '+key);
    if(mode==='singlepass')copy.forceSinglePass=true;
   }
   return copies.get(source);
  };
  const candidate=Array.isArray(original)?original.map(convert):convert(original);
  assignments.push({object,original,candidate});object.material=candidate;
 });}catch(error){for(const a of assignments)a.object.material=a.original;for(const copy of copies.values())copy.dispose();throw error;}
 return {get stats(){return {mode,meshes:assignments.map(a=>a.object.name),ownedMaterials:copies.size,sourceAlphaUnchanged:true,sourceMapsUnchanged:true,sourceGeometryUnchanged:true,visualAcceptance:false};},dispose(){if(disposed)return null;disposed=true;for(const a of assignments)a.object.material=a.original;for(const copy of copies.values())copy.dispose();return {ownedMaterialsDisposed:copies.size,sourceAssignmentsRestored:true,sourceGeometryDisposed:false};}};
}
