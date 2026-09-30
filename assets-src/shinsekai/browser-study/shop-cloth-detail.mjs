const targets=['UD_CoatRail_Haori','UD_DryingPole_Cloths','UD_ClothBolt_Spread'];

// Attach only after the complete replacement has loaded and passed placement checks.
// The interior owns its resources, so stale responses and far-cell retirement
// use the existing interior disposal path.
export function connectShopCloth(interior,replacement){
 const originals=targets.map(name=>interior.scene.getObjectByName(name));
 const revised=targets.map(name=>replacement.scene.getObjectByName(name));
 if(originals.some(o=>!o)||revised.some(o=>!o))throw new Error('布の差し替えノードがそろっていません。');
 interior.scene.updateMatrixWorld(true);replacement.scene.updateMatrixWorld(true);
 for(let i=0;i<targets.length;i++){
  if(originals[i].matrixWorld.elements.some((v,k)=>Math.abs(v-revised[i].matrixWorld.elements[k])>1e-7))throw new Error('布の配置が元の部屋と一致しません。');
 }
 const allowed=new Set();for(const node of revised)node.traverse(o=>allowed.add(o));
 replacement.scene.traverse(o=>{if(o.isMesh&&!allowed.has(o))throw new Error('布以外の差し替えメッシュがあります。');});
 let originalTriangles=0,replacementTriangles=0;
 const count=root=>{let sum=0;root.traverse(o=>{if(o.isMesh)sum+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});return sum;};
 originals.forEach(o=>originalTriangles+=count(o));revised.forEach(o=>replacementTriangles+=count(o));
 interior.scene.add(replacement.scene);originals.forEach(o=>o.visible=false);
 return {nodes:targets.slice(),originalTriangles,replacementTriangles,addedTriangles:replacementTriangles-originalTriangles};
}
