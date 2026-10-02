// Observe the pinned r186 reversePainterSortStable without changing its order.
export function createHallTransparentSort(renderer,scene,{mode='observe'}={}){
 if(typeof renderer?.setTransparentSort!=='function'||typeof scene?.traverse!=='function'||mode!=='observe')throw new Error('Invalid hall transparent sort');
 let ranks=new Map(),pairs=[],observed=new Map(),disposed=false;
 const sort=(a,b)=>{
  for(const item of [a,b]){const o=item.object,key=item.id+':'+item.material?.id;if(!observed.has(key)&&observed.size<256)observed.set(key,{name:o?.name,material:item.material?.name,id:item.id,rank:ranks.get(o),z:item.z,alpha:item.material?.opacity,world:o?.matrixWorld?.toArray(),sphere:o?.geometry?.boundingSphere?.center.toArray()});}
  if(a.groupOrder!==b.groupOrder)return a.groupOrder-b.groupOrder;
  if(a.renderOrder!==b.renderOrder)return a.renderOrder-b.renderOrder;
  if(a.z!==b.z)return b.z-a.z;
  if(a.object!==b.object&&pairs.length<32)pairs.push({a:a.object?.name,b:b.object?.name,aId:a.id,bId:b.id,z:a.z,aRank:ranks.get(a.object),bRank:ranks.get(b.object)});
  return a.id-b.id;
 };
 renderer.setTransparentSort(sort);
 return {prepare(){if(disposed)throw new Error('Disposed hall transparent sort');ranks=new Map();pairs=[];observed=new Map();let rank=0;scene.traverse(o=>ranks.set(o,rank++));},get stats(){return {mode,depthPrioritiesPreserved:true,sourceAlphaFlagsUnchanged:true,geometryUnchanged:true,equalDepthPairs:pairs,items:[...observed.values()]};},dispose(){if(disposed)return;disposed=true;renderer.setTransparentSort(null);ranks.clear();observed.clear();}};
}
