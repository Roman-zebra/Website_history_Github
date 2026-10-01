// Own the additional baked scalar map; floor-copy ownership stays with floorLook.
export function createHallFloorContactLook(map,{gain=.8,buildNode}={}){
 if(!map?.isTexture||map.image?.width!==512||map.image?.height!==2048||map.colorSpace!==''||map.flipY!==true||![0,.8,1].includes(gain)||typeof buildNode!=='function')throw new Error('Invalid baked hall contact input');
 let disposed=false;const decorated=new Set();
 return {get stats(){return {route:'geometry-baked-static-floor-contact',gain,mapSize:[512,2048],ownedTextureObjects:1,estimatedRGBABytes:4194304,estimatedRGBABytesWithMips:5592405,materials:decorated.size,sourceMapsPreserved:true,geometryChanged:false,movingLightShadow:false,visualAcceptance:false};},decorate(material){
  if(disposed||!['stone_floor','stone_floor_worn'].includes(material?.name)||decorated.has(material))throw new Error('Invalid baked floor decoration');
  const original=material.colorNode,node=buildNode(original,map,gain);if(!node)throw new Error('Missing baked floor node');material.colorNode=node;decorated.add(material);
 },dispose(){if(disposed)return null;disposed=true;map.dispose();decorated.clear();return {ownedTexturesDisposed:1,geometryChanged:false};}};
}
