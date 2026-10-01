const targets=Object.freeze({stone_floor:.72,stone_floor_worn:.76});

// Own temporary material copies only. Restore assignments before cached reuse.
export function createHallFloorLook(model,{mode='roughness',createMaterial,decorateWear}={}){
 if(!['control','roughness','wear'].includes(mode)||typeof createMaterial!=='function'||(mode==='wear'&&typeof decorateWear!=='function'))throw new Error('Invalid hall floor comparison');
 const assignments=[],sources=new Set();
 model.scene.traverse(object=>{
  if(!object.isMesh)return;
  const originals=Array.isArray(object.material)?object.material:[object.material];
  if(!originals.some(material=>Object.hasOwn(targets,material?.name)))return;
  assignments.push({object,original:object.material});
  for(const material of originals)if(Object.hasOwn(targets,material?.name))sources.add(material);
 });
 if(sources.size!==2||new Set([...sources].map(source=>source.name)).size!==2||[...sources].some(source=>!Number.isFinite(source.roughness)||source.roughnessMap))throw new Error('Expected two measured unmapped hall floor materials');
 const copies=new Map();
 try{
  for(const source of sources){const copy=createMaterial(source);if(!copy||copy===source)throw new Error('Floor copy must have independent ownership');copies.set(source,copy);if(mode!=='control')copy.roughness=targets[source.name];if(mode==='wear')decorateWear(copy);}
 }catch(error){for(const copy of copies.values())copy.dispose();throw error;}
 for(const {object,original} of assignments)object.material=Array.isArray(original)?original.map(source=>copies.get(source)??source):copies.get(original);
 let disposed=false;
 return {stats:{mode,materials:copies.size,meshes:assignments.length,roughness:Object.fromEntries([...copies].map(([source,copy])=>[source.name,{source:source.roughness,candidate:copy.roughness}])),newTextures:0,geometryChanged:false,sourceMapsPreserved:true,inferred:true,visualAcceptance:false},dispose(){if(disposed)return;disposed=true;for(const {object,original} of assignments)object.material=original;for(const copy of copies.values())copy.dispose();}};
}
