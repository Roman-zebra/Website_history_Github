// Validate the entire selection before mutating a material. Custom mask has no
// mixed faces, so interpolated zero never contaminates unrelated cloth.
export function connectCushionFabric(model,{gain=1,createMaterial,buildNode}={}){
 if(![0,.5,1].includes(gain))throw new Error('Invalid cushion fabric gain');
 const stats={gain,materials:0,targetVertices:0,targetTriangles:0,addedTextures:0,addedDraws:0,addedTriangles:0,inferred:true,nativeVerified:false,phoneMeasured:false};
 if(gain===0)return {...stats,exactSourceControl:true};
 const root=model.scene.getObjectByName('Hybrid_Sonnet_upper'),targets=[];
 if(!root)throw new Error('Missing source cushion node');
 root.traverse(o=>{if(o.isMesh&&o.geometry.hasAttribute('_cushion'))targets.push(o);});
 if(targets.length!==1)throw new Error('Requires one masked source primitive');
 const mesh=targets[0],source=mesh.material,mask=mesh.geometry.getAttribute('_cushion'),pos=mesh.geometry.getAttribute('position'),index=mesh.geometry.index;
 if(Array.isArray(source)||source.name!=='CLOTH'||!source.isMeshStandardMaterial||source.normalMap||source.bumpMap||source.normalNode||source.userData.studyOriginalCushionMaterial||!source.vertexColors||!mesh.geometry.hasAttribute('color')||source.roughness<.94||source.metalness!==0)throw new Error('Unexpected source cushion material');
 if(mask.itemSize!==1||mask.count!==1608||pos.count!==1608||!index||index.count%3)throw new Error('Invalid cushion mask layout');
 let vertices=0,faces=0;
 for(let i=0;i<mask.count;i++){
  const v=mask.getX(i);if(v!==0&&v!==1)throw new Error('Non-binary cushion mask');vertices+=v;
  if(v===1&&!(pos.getX(i)>2.79&&pos.getX(i)<3.61&&pos.getY(i)>3.45&&pos.getY(i)<3.54&&pos.getZ(i)>-5.63&&pos.getZ(i)<-4.80))throw new Error('Mask leaves the source cushion');
 }
 for(let i=0;i<index.count;i+=3){const sum=mask.getX(index.getX(i))+mask.getX(index.getX(i+1))+mask.getX(index.getX(i+2));if(sum!==0&&sum!==3)throw new Error('Mixed cushion and unrelated cloth face');if(sum===3)faces++;}
 if(vertices!==432||faces!==240)throw new Error('Unexpected cushion selection');
 let material;
 try{material=createMaterial(source);if(material===source)throw new Error('Cushion material must be a copy');material.normalNode=buildNode(gain);material.userData.studyOriginalCushionMaterial=source;}
 catch(error){if(material&&material!==source)material.dispose();throw error;}
 mesh.material=material;
 return {...stats,materials:1,targetVertices:vertices,targetTriangles:faces,sourceColourRoughnessUVGeometryPreserved:true,otherClothMaskZero:true};
}
