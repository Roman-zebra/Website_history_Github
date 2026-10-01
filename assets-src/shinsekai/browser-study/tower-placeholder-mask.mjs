// Inferred115 interface bounds, converted from Blender Z-up to glTF Y-up.
// Allowance covers the authored shallow window boxes, not player collision.
export const placeholderVolumes=Object.freeze({
 hall:{min:[-14.55,.05,-9.1],max:[-10,4.7,9.1]},
 stair:{min:[-14.55,.05,8.55],max:[-10,19.3,13.05]},
 lift:{min:[-2.7,15.05,-2.7],max:[2.7,18.3,2.7]},
 cinema:{min:[-51.3,.05,-9.05],max:[-14.2,9.1,9.05]}
});
export function partitionPlaceholderComponents(positions,indices,toWorld=p=>p){
 if(!(positions instanceof Float32Array)||positions.length%3||!indices.length||indices.length%3||![Uint16Array,Uint32Array].some(type=>indices instanceof type))throw new Error('Expected raw indexed placeholder triangles');
 const count=positions.length/3,parent=Int32Array.from({length:count},(_,i)=>i),aliases=new Map();
 function root(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
 function join(a,b){parent[root(b)]=root(a);}
 for(const id of indices){
  if(id>=count)throw new Error('Placeholder index out of bounds');
  const p=Array.from(positions.subarray(id*3,id*3+3));if(!p.every(Number.isFinite))throw new Error('Non-finite placeholder position');
  const key=p.join(',');if(aliases.has(key))join(id,aliases.get(key));else aliases.set(key,id);
 }
 for(let i=0;i<indices.length;i+=3){join(indices[i],indices[i+1]);join(indices[i],indices[i+2]);}
 const components=new Map();
 for(let i=0;i<indices.length;i+=3){
  const id=root(indices[i]);if(!components.has(id))components.set(id,{offsets:[],min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});
  const c=components.get(id);c.offsets.push(i);
  for(let k=0;k<3;k++){const vertex=indices[i+k],p=toWorld(Array.from(positions.subarray(vertex*3,vertex*3+3)));if(!p.every(Number.isFinite))throw new Error('Non-finite world position');for(let axis=0;axis<3;axis++){c.min[axis]=Math.min(c.min[axis],p[axis]);c.max[axis]=Math.max(c.max[axis],p[axis]);}}
 }
 return [...components.values()].map(c=>{const centre=c.min.map((n,i)=>(n+c.max[i])/2),owners=Object.entries(placeholderVolumes).filter(([,v])=>centre.every((n,i)=>n>=v.min[i]&&n<=v.max[i])).map(([name])=>name);return {...c,centre,owners};});
}
export function createTowerPlaceholderMask(THREE,model){
 const records=[],seen=new Set();model.updateMatrixWorld(true);
 model.traverse(mesh=>{
  if(!mesh.isMesh||!/^TB_EXT_LOD[012]_(backing|backing_dark|curtain)$/.test(mesh.name))return;
  const g=mesh.geometry,p=g.getAttribute('position'),index=g.getIndex();
  if(mesh.isSkinnedMesh||mesh.isInstancedMesh||g.groups.length||Object.keys(g.morphAttributes).length||!index||p.itemSize!==3||p.isInterleavedBufferAttribute||p.normalized||g.drawRange.start!==0||g.drawRange.count!==Infinity||seen.has(g))throw new Error('Unsupported placeholder geometry '+mesh.name);
  seen.add(g);const original=index.array.slice(),point=new THREE.Vector3(),components=partitionPlaceholderComponents(p.array,original,coords=>point.fromArray(coords).applyMatrix4(mesh.matrixWorld).toArray());
  records.push({mesh,g,index,original,components,visible:mesh.visible,drawRange:{...g.drawRange}});
 });
 let active,stats,disposed=false;
 function select(cell){
  if(disposed)throw new Error('Placeholder mask disposed');
  const match=cell===null?null:/^cell_(hall|stair|lift|cinema)(?:_dream)?$/.exec(cell);
  if(cell!==null&&!match)throw new Error('Unknown placeholder room '+cell);
  const room=match?.[1]??null;if(room===active)return stats;
  const meshes=[];
  for(const r of records){
   const hidden=new Set(r.components.filter(c=>c.owners.includes(room)).flatMap(c=>c.offsets));let at=0;
   // Reuse one GPU index buffer; source indices are retained for exact restore.
   r.index.array.set(r.original);
   for(let i=0;i<r.original.length;i+=3)if(!hidden.has(i)){r.index.array[at++]=r.original[i];r.index.array[at++]=r.original[i+1];r.index.array[at++]=r.original[i+2];}
   r.index.needsUpdate=true;r.g.setDrawRange(0,room===null?Infinity:at);r.mesh.visible=r.visible&&at>0;
   meshes.push({name:r.mesh.name,components:r.components.length,hiddenTriangles:hidden.size,retainedTriangles:at/3,originalTriangles:r.original.length/3,unownedComponents:r.components.filter(c=>!c.owners.length).length});
  }
  active=room;stats={room,meshes};return stats;
 }
 function dispose(){if(disposed)return;for(const r of records){r.index.array.set(r.original);r.index.needsUpdate=true;r.g.setDrawRange(r.drawRange.start,r.drawRange.count);r.mesh.visible=r.visible;}records.length=0;disposed=true;}
 return {select,dispose};
}
