import * as THREE from 'three/webgpu';

// A source-only optimization for uniform repeated components already merged
// into one draw. Keeps triangle count/draw count; saves attribute storage only.
export function repeatedMeshInstances(source,{trianglesPerInstance,tolerance=2e-6,normalTolerance=5e-4}={}){
 if(!source?.isMesh||source.isSkinnedMesh||source.isInstancedMesh||Array.isArray(source.material))throw new TypeError('One ordinary mesh/material is required.');
 const material=source.material,geometry=source.geometry;
 const textured=Object.values(material).some(v=>v?.isTexture),uv=geometry.getAttribute('uv');
 if(material.vertexColors||material.isNodeMaterial)throw new Error('Custom nodes and vertex colours require separate review.');
 if(textured&&!uv)throw new Error('Textured components need matching source UVs.');
 if(Object.keys(geometry.attributes).some(name=>!['position','normal','uv'].includes(name)))throw new Error('Additional attributes require separate review.');
 if(Object.keys(geometry.morphAttributes).length||geometry.groups.length>1)throw new Error('Morphs and mixed primitive groups are unsupported.');
 const stride=trianglesPerInstance*3,position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),indices=geometry.index;
 const vertexCount=indices?.count??position?.count;
 if(!Number.isInteger(trianglesPerInstance)||trianglesPerInstance<1||!position||!normal||vertexCount%stride||vertexCount<stride*2)throw new Error('Complete repeated triangle blocks with normals are required.');
 if(!Number.isFinite(tolerance)||tolerance<=0||!Number.isFinite(normalTolerance)||normalTolerance<=0)throw new RangeError('Finite positive tolerances are required.');
 if(geometry.drawRange.start!==0||geometry.drawRange.count<vertexCount)throw new Error('Partial draws are unsupported.');
 const count=vertexCount/stride,centres=[],templatePositions=new Float32Array(stride*3),templateNormals=new Float32Array(stride*3),templateUV=uv?new Float32Array(stride*2):null;
 let maxPositionError=0,maxNormalError=0,maxUVError=0;
 for(let piece=0;piece<count;piece++){
  const ids=Array.from({length:stride},(_,j)=>indices?indices.getX(piece*stride+j):piece*stride+j),box=new THREE.Box3();
  for(const id of ids)box.expandByPoint(new THREE.Vector3().fromBufferAttribute(position,id));
  const centre=box.getCenter(new THREE.Vector3());centres.push(centre);
  for(let j=0;j<stride;j++)for(let axis=0;axis<3;axis++){
   const offset=j*3+axis,coordinate=position.getComponent(ids[j],axis)-centre.getComponent(axis),n=normal.getComponent(ids[j],axis);
   if(!Number.isFinite(coordinate)||!Number.isFinite(n))throw new Error('Non-finite geometry is unsupported.');
   if(piece===0){templatePositions[offset]=coordinate;templateNormals[offset]=n;}
   else{maxPositionError=Math.max(maxPositionError,Math.abs(coordinate-templatePositions[offset]));maxNormalError=Math.max(maxNormalError,Math.abs(n-templateNormals[offset]));}
  }
  if(uv)for(let j=0;j<stride;j++)for(let axis=0;axis<2;axis++){const offset=j*2+axis,value=uv.getComponent(ids[j],axis);if(!Number.isFinite(value))throw new Error('Non-finite UVs are unsupported.');if(piece===0)templateUV[offset]=value;else maxUVError=Math.max(maxUVError,Math.abs(value-templateUV[offset]));}
 }
 if(maxPositionError>tolerance||maxNormalError>normalTolerance||maxUVError>1e-6)throw new Error('Repeated components differ; retain the original geometry.');
 const shared=new THREE.BufferGeometry();shared.setAttribute('position',new THREE.BufferAttribute(templatePositions,3));shared.setAttribute('normal',new THREE.BufferAttribute(templateNormals,3));
 if(templateUV)shared.setAttribute('uv',new THREE.BufferAttribute(templateUV,2));
 shared.computeBoundingBox();shared.computeBoundingSphere();
 const mesh=new THREE.InstancedMesh(shared,material,count),matrix=new THREE.Matrix4();
 centres.forEach((centre,i)=>mesh.setMatrixAt(i,matrix.makeTranslation(...centre.toArray())));mesh.instanceMatrix.needsUpdate=true;
 mesh.name=source.name+'__instances';mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);mesh.matrix.copy(source.matrix);mesh.matrixAutoUpdate=source.matrixAutoUpdate;
 mesh.visible=source.visible;mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;mesh.renderOrder=source.renderOrder;mesh.layers.mask=source.layers.mask;
 mesh.userData={...source.userData,studyRepeatedSource:source.name};mesh.computeBoundingBox();mesh.computeBoundingSphere();
 const originalBytes=Object.values(geometry.attributes).reduce((sum,a)=>sum+a.array.byteLength,0)+(indices?.array.byteLength??0),instancedBytes=templatePositions.byteLength+templateNormals.byteLength+(templateUV?.byteLength??0)+mesh.instanceMatrix.array.byteLength;
 return {mesh,stats:{count,triangles:vertexCount/3,draws:1,originalBytes,instancedBytes,maxPositionError,maxNormalError,maxUVError}};
}
