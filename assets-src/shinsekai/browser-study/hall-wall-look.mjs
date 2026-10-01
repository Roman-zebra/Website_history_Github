const names=new Set(['sandstone','plaster_dk']);

// Shared stone also occurs on window sills: only own wall assignments.
export function createHallWallLook(model,{mode='wear',createMaterial,decorateWear}={}){
 if(!['control','wear'].includes(mode)||typeof createMaterial!=='function'||(mode==='wear'&&typeof decorateWear!=='function'))throw new Error('Invalid hall wall comparison');
 const assignments=[],sources=new Set();
 model.scene.traverse(object=>{
  if(!object.isMesh||!/^hall__walls(?:_\d+)?$/.test(object.name))return;
  const originals=Array.isArray(object.material)?object.material:[object.material];
  if(!originals.some(material=>names.has(material?.name)))return;
  assignments.push({object,original:object.material});
  for(const material of originals)if(names.has(material?.name))sources.add(material);
 });
 if(sources.size!==2||new Set([...sources].map(source=>source.name)).size!==2)throw new Error('Expected two measured hall wall materials');
 const copies=new Map();
 try{for(const source of sources){const copy=createMaterial(source);if(!copy||copy===source)throw new Error('Wall copy must have independent ownership');copies.set(source,copy);if(mode==='wear')decorateWear(copy);}}
 catch(error){for(const copy of copies.values())copy.dispose();throw error;}
 for(const {object,original}of assignments)object.material=Array.isArray(original)?original.map(source=>copies.get(source)??source):copies.get(original);
 let disposed=false;
 return {stats:{mode,materials:copies.size,meshes:assignments.length,boundaryLocalY:1.21,newTextures:0,geometryChanged:false,sourceMapsPreserved:true,inferred:true,visualAcceptance:false},dispose(){if(disposed)return;disposed=true;for(const {object,original}of assignments)object.material=original;for(const copy of copies.values())copy.dispose();}};
}
