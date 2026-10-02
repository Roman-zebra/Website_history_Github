// An interior cell owns this map/copy; the exterior wall owns geometry.
export function createHaoriWallContactLook(map,{gain=.6,createMaterial,buildNode}={}){
 if(!map?.isTexture||map.image?.width!==512||map.image?.height!==512||map.colorSpace!==''||map.flipY!==true||![0,.6,1].includes(gain)||typeof createMaterial!=='function'||typeof buildNode!=='function')throw new Error('Invalid haori contact input');
 let disposed=false,root=null,enabled=false;const targets=[],copies=new Map();
 function restore(){for(const target of targets){if(target.mesh.material===target.installed)target.mesh.material=target.original;target.installed=null;}enabled=false;}
 function clear(){restore();for(const copy of copies.values())copy.dispose();copies.clear();targets.length=0;root=null;}
 return {
  get stats(){return {route:'geometry-baked-static-haori-wall-contact',gain,enabled,materials:copies.size,targets:targets.length,ownedTextureObjects:1,estimatedRGBABytes:1048576,estimatedRGBABytesWithMips:1398101,geometryChanged:false,movingLightShadow:false,visualAcceptance:false};},
  bind(model){
   if(disposed)throw new Error('Haori contact disposed');
   if(model.scene===root)return;
   clear();root=model.scene;
   const wall=root.getObjectByName('BldgA_LOD0_sideL');if(!wall){clear();throw new Error('Missing actual haori wall');}
   try{wall.traverse(mesh=>{
    if(!mesh.isMesh)return;const original=mesh.material;
    const replace=source=>{
     if(source.name!=='M_Plaster_Int'||gain===0)return source;
     if(copies.has(source))return copies.get(source);
     const copy=createMaterial(source);copies.set(source,copy);
     copy.colorNode=buildNode(source.colorNode,map,gain);if(!copy.colorNode)throw new Error('Missing haori contact node');return copy;
    };
    if(![].concat(original).some(m=>m.name==='M_Plaster_Int'))return;
    const replacement=Array.isArray(original)?original.map(replace):replace(original);
    targets.push({mesh,original,replacement,installed:null});
   });if(!targets.length)throw new Error('Missing actual haori plaster');}
   catch(error){clear();throw error;}
  },
  setEnabled(value){
   if(disposed)throw new Error('Haori contact disposed');
   if(!value||gain===0){restore();return;}
   for(const target of targets){
    // Glass reconciliation may reinstall an equivalent source material array.
    if(target.mesh.material!==target.installed){
     const now=[].concat(target.mesh.material),source=[].concat(target.original);
     if(now.length!==source.length||now.some((m,i)=>m!==source[i]))throw new Error('Haori wall ownership changed');
     target.original=target.mesh.material;target.mesh.material=target.replacement;target.installed=target.replacement;
    }
   }enabled=targets.length>0;
  },
  dispose(){if(disposed)return null;clear();disposed=true;map.dispose();return {ownedTexturesDisposed:1,originalWallRestored:true,geometryChanged:false};}
 };
}
