// Private candidate adapter. Keeps source UV1 in the reference GLB; its unused
// lightmap pack is omitted only from instances when no material binds channel1.
export function createTowerBalusterInstances(THREE,source,placements,repeat){
 if(!source?.isMesh||Array.isArray(source.material)||!source.geometry.index||!Array.isArray(placements)||placements.length!==150)throw new Error('Expected113 trim and150 baluster placements');
 for(const a of Object.values(source.geometry.attributes))if(a.normalized||a.isInterleavedBufferAttribute||!(a.array instanceof Float32Array))throw new Error('Attribute encoding requires a separate adapter');
 if(Object.values(source.material).some(t=>t?.isTexture&&t.channel!==0))throw new Error('Retain unique packed UVs when a material binds another channel');
 const g=source.geometry,index=g.index,position=g.getAttribute('position'),selected=[],removed=new Set(),e=.00009;
 for(const [x,y,z,height]of placements){
  if(![x,y,z,height].every(Number.isFinite)||height<=0)throw new Error('Invalid baluster placement');
  const lo=[x-.075-e,z-e,-y-.075-e],hi=[x+.075+e,z+height+e,-y+.075+e],piece=[];
  for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(ids.every(id=>[0,1,2].every(k=>{const p=position.getComponent(id,k);return p>=lo[k]&&p<=hi[k];})))piece.push({start:i,ids});}
  if(piece.length!==50||piece.some(p=>removed.has(p.start)))throw new Error('Baluster face selection is ambiguous; retain source');
  for(const p of piece){removed.add(p.start);selected.push(...p.ids);}
 }
 const separated=g.clone();separated.setIndex(selected);separated.deleteAttribute('uv1');
 const temp=new THREE.Mesh(separated,source.material);temp.name=source.name+'__balusters';temp.position.copy(source.position);temp.quaternion.copy(source.quaternion);temp.scale.copy(source.scale);temp.castShadow=source.castShadow;temp.receiveShadow=source.receiveShadow;
 let result;
 try{result=repeat(temp,{trianglesPerInstance:50});}finally{separated.dispose();}
 const kept=[];for(let i=0;i<index.count;i+=3)if(!removed.has(i))kept.push(index.getX(i),index.getX(i+1),index.getX(i+2));
 // Compact remaining trim vertices, so removed instances do not leave their
 // duplicated source vertex buffers allocated under the retained draw.
 const ids=[...new Set(kept)],remap=new Map(ids.map((v,i)=>[v,i])),remaining=new THREE.BufferGeometry();
 for(const [name,a]of Object.entries(g.attributes)){const values=new Float32Array(ids.length*a.itemSize);ids.forEach((id,i)=>{for(let k=0;k<a.itemSize;k++)values[i*a.itemSize+k]=a.getComponent(id,k);});remaining.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize));}
 remaining.setIndex(kept.map(i=>remap.get(i)));remaining.computeBoundingBox();remaining.computeBoundingSphere();
 const bytes=geometry=>Object.values(geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(geometry.index?.array.byteLength??0);
 const {originalBytes:temporarySelectionBytes,...instanceStats}=result.stats;
 return {mesh:result.mesh,remaining,stats:{...instanceStats,temporarySelectionBytes,removedTriangles:removed.size,retainedTrimTriangles:kept.length/3,sourceTriangles:index.count/3,sourceBytes:bytes(g),retainedBytes:bytes(remaining),newDraws:2,sourceDraws:1,unusedInstanceUV1Omitted:true}};
}
