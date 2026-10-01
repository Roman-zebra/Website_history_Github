const scalars=['name','side','transparent','opacity','alphaTest','roughness','metalness','emissiveIntensity','vertexColors','depthTest','depthWrite','toneMapped'];

// Stage owned copies, then borrow assignments only for a synchronous main draw.
// Alpha materials and the renderer context never enter this scope.
export function createHallScopedMaterialAO(root,{clone,decorate}={}){
 if(!root?.traverse||typeof clone!=='function'||typeof decorate!=='function')throw new Error('Invalid hall material AO');
 const assignments=[],sources=new Set(),originals=new Set(),copies=new Map(),owned=new Set();
 root.traverse(object=>{
  if(!object.isMesh)return;
  const materials=Array.isArray(object.material)?object.material:[object.material];
  for(const source of materials)if(source)originals.add(source);
  if(!materials.some(source=>source&&source.transparent!==true))return;
  assignments.push({object,original:object.material});
  for(const source of materials)if(source&&source.transparent!==true)sources.add(source);
 });
 try{for(const source of sources){
  const copy=clone(source);
  if(!copy||originals.has(copy)||owned.has(copy))throw new Error('Hall AO copies must have independent ownership');
  owned.add(copy);copies.set(source,copy);
  for(const key of scalars)if(copy[key]!==source[key])throw new Error('Hall AO clone changed '+key);
  for(const key of Object.keys(source))if((key==='map'||key.endsWith('Map'))&&copy[key]!==source[key])throw new Error('Hall AO clone changed map '+key);
  for(const key of ['color','emissive'])if(source[key])for(const channel of ['r','g','b'])if(copy[key]?.[channel]!==source[key][channel])throw new Error('Hall AO clone changed '+key);
  for(const key of ['colorNode','fragmentNode','normalNode'])if(copy[key]!==source[key])throw new Error('Hall AO clone changed '+key);
  decorate(copy,source);
 }}catch(error){for(const copy of owned)copy.dispose();throw error;}
 let disposed=false,active=false;
 function restore(){for(const {object,original}of assignments)object.material=original;}
 return {stats:{materials:copies.size,meshes:assignments.length,transparentMaterialsUnchanged:true,rendererContextChanged:false,newTextures:0,geometryChanged:false,sourceMapsPreserved:true},withApplied(render){
  if(disposed||active||typeof render!=='function')throw new Error('Invalid hall AO material scope');
  active=true;
  try{for(const {object,original}of assignments)object.material=Array.isArray(original)?original.map(source=>copies.get(source)??source):copies.get(original);return render();}finally{restore();active=false;}
 },dispose(){if(disposed)return;if(active)throw new Error('Cannot dispose active hall AO material scope');disposed=true;restore();for(const copy of owned)copy.dispose();}};
}
