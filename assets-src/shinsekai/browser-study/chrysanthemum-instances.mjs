// Original procedural petal profiles/relief. No sampled image pixels.
// Caller owns supplied materials; returned disposal owns geometries only.
export function createPetalAtlas(THREE,size=128){
 if(!Number.isInteger(size)||size<16||size>256)throw new Error('Petal tile size must be16–256');
 const width=size*4,colour=new Uint8Array(width*size*4),normal=new Uint8Array(colour.length);
 const height=(u,v,tile)=>.018*Math.cos((u-.5)*Math.PI*6+v*3+tile)*Math.sin(Math.PI*v)+.035*Math.exp(-(((u-.5)*12)**2))*Math.sin(Math.PI*v);
 for(let tile=0;tile<4;tile++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x+.5)/size,v=(y+.5)/size,index=(y*width+tile*size+x)*4;
  const profile=Math.pow(Math.sin(Math.PI*v),.45+tile*.1)*(.93-.04*tile);
  const edge=profile-Math.abs(u-.5)*2;
  const alpha=Math.max(0,Math.min(1,edge*size/2));
  const vein=.5+.5*Math.cos((u-.5)*Math.PI*(8+tile*2)+v*2);
  const tone=.79+.15*v+.045*vein;
  colour.set([Math.round(tone*255),Math.round((tone-.015)*255),Math.round((tone-.025)*255),Math.round(alpha*255)],index);
  const e=1/size,dx=(height(u+e,v,tile)-height(u-e,v,tile))/(2*e),dy=(height(u,v+e,tile)-height(u,v-e,tile))/(2*e);
  const length=Math.hypot(dx,dy,1);
  normal.set([Math.round((-.5*dx/length+.5)*255),Math.round((-.5*dy/length+.5)*255),Math.round((.5/length+.5)*255),255],index);
 }
 const texture=data=>{const t=new THREE.DataTexture(data,width,size,THREE.RGBAFormat);t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;};
 const albedo=texture(colour),relief=texture(normal);albedo.colorSpace=THREE.SRGBColorSpace;
 return {albedo,relief,width,height:size,bytes:colour.byteLength+normal.byteLength,dispose(){albedo.dispose();relief.dispose();}};
}

export function createPetalRibbon(THREE){
 const geometry=new THREE.BufferGeometry();
 // Broad distal envelope lets the alpha outline round the tip; tapering the
 // mesh itself to a point made the first study look like a star again.
 const positions=[.10,0,0,.58,.22,-.16,1,.26,-.13,1,.26,.13,.58,.22,.16];
 const uv=[.5,0,0,.55,0,1,1,1,1,.55];
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setIndex([0,4,3,0,3,2,0,2,1]);geometry.computeVertexNormals();
 return geometry;
}

export function createChrysanthemumInstances(THREE,anchors,{petalMaterial,coreMaterial}){
 if(!Array.isArray(anchors)||!anchors.length)throw new Error('At least one bloom anchor is required');
 for(const a of anchors)if(!Array.isArray(a.matrix)||a.matrix.length!==16||!a.matrix.every(Number.isFinite)||!Array.isArray(a.colour)||a.colour.length!==3||!a.colour.every(c=>Number.isFinite(c)&&c>=0&&c<=255)||!Array.isArray(a.core)||a.core.length!==3||!a.core.every(c=>Number.isFinite(c)&&c>=0&&c<=255))throw new Error('Invalid original bloom anchor');
 const group=new THREE.Group(),geometry=createPetalRibbon(THREE),coreGeometry=new THREE.OctahedronGeometry(.16,0);
 const petals=new THREE.InstancedMesh(geometry,petalMaterial,anchors.length*24),cores=new THREE.InstancedMesh(coreGeometry,coreMaterial,anchors.length);
 const tiles=new Float32Array(anchors.length*24),matrix=new THREE.Matrix4(),rotation=new THREE.Matrix4(),scale=new THREE.Matrix4(),colour=new THREE.Color();
 let cursor=0;
 for(const [index,a] of anchors.entries()){
  const anchor=new THREE.Matrix4().fromArray(a.matrix);
  colour.setRGB(...a.colour.map(c=>c/255),THREE.SRGBColorSpace);
  for(let ring=0;ring<3;ring++)for(let petal=0;petal<8;petal++){
   const angle=petal*Math.PI/4+ring*.43+(index%7)*.07;
   rotation.makeRotationY(angle);scale.makeScale([1,.68,.40][ring],[1,1.65,1.85][ring],[1,.90,.78][ring]);
   matrix.copy(anchor).multiply(rotation).multiply(scale);petals.setMatrixAt(cursor,matrix);petals.setColorAt(cursor,colour);
   tiles[cursor]=(petal+ring+index)%4/4;cursor++;
  }
  const coreScale=new THREE.Matrix4().makeScale(1,.65,1);
  matrix.copy(anchor).multiply(new THREE.Matrix4().makeTranslation(0,.02,0)).multiply(coreScale);cores.setMatrixAt(index,matrix);
  colour.setRGB(...a.core.map(c=>c/255),THREE.SRGBColorSpace);cores.setColorAt(index,colour);
 }
 geometry.setAttribute('petalTile',new THREE.InstancedBufferAttribute(tiles,1));
 for(const mesh of [petals,cores]){mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);}
 const bytes=Object.values(geometry.attributes).reduce((sum,a)=>sum+a.array.byteLength,0)+geometry.index.array.byteLength+Object.values(coreGeometry.attributes).reduce((sum,a)=>sum+a.array.byteLength,0)+(coreGeometry.index?.array.byteLength??0)+petals.instanceMatrix.array.byteLength+petals.instanceColor.array.byteLength+cores.instanceMatrix.array.byteLength+cores.instanceColor.array.byteLength;
 return {group,petals,cores,stats:{blooms:anchors.length,petalInstances:anchors.length*24,triangles:anchors.length*80,draws:2,attributeAndMatrixBytes:bytes},dispose(){geometry.dispose();coreGeometry.dispose();}};
}
