// Read-only GLB accounting. No re-export, network call or historical acceptance.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Matrix4,Quaternion,Vector3,Box3} from '../vendor/three-r186/build/three.core.js';
import {readGlb} from './shinsekai-glb-cell.cjs';

export function imageDimensions(bytes){
  if(bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR')return {format:'PNG',width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
  if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216){
    for(let p=2;p<bytes.length;){
      if(bytes[p++]!==255)throw new Error('Malformed JPEG marker');
      while(bytes[p]===255)p++;
      const marker=bytes[p++];if(marker===217||marker===218)break;
      if(marker===1||(marker>=208&&marker<=215))continue;
      if(p+2>bytes.length)throw new Error('Truncated JPEG');
      const n=bytes.readUInt16BE(p);if(n<2||p+n>bytes.length)throw new Error('Truncated JPEG segment');
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){
        if(n<8)throw new Error('Invalid JPEG frame');return {format:'JPEG',width:bytes.readUInt16BE(p+5),height:bytes.readUInt16BE(p+3)};
      }p+=n;
    }throw new Error('JPEG has no supported frame');
  }throw new Error('Unsupported image format; decoded memory must remain unknown');
}
export function rgbaMipBytes(width,height){
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)throw new Error('Invalid image dimensions');
  let total=0;for(;;){total+=width*height*4;if(width===1&&height===1)return total;width=Math.max(1,width>>1);height=Math.max(1,height>>1);}
}
export function inventoryGlb(bytes,{selected=/roof|wire|shell/i}={}){
  const {json:j,binary}=readGlb(bytes),meshRows=[],materialIds=new Set(),notes=[];
  const data=id=>{
    const a=j.accessors[id],v=j.bufferViews[a.bufferView];
    if(a.sparse||v.extensions||v.buffer!==0)throw new Error('Decode compressed/sparse data before inventory');
    const kinds={5121:[1,'readUInt8'],5123:[2,'readUInt16LE'],5125:[4,'readUInt32LE'],5126:[4,'readFloatLE']},kind=kinds[a.componentType];
    const size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];if(!kind||!size||a.normalized)throw new Error('Unsupported accessor');
    const stride=v.byteStride??size*kind[0],start=(v.byteOffset??0)+(a.byteOffset??0);
    if(a.count&&start+(a.count-1)*stride+size*kind[0]>binary.length)throw new Error('Truncated accessor');
    return {a,get:(i,c=0)=>binary[kind[1]](start+i*stride+c*kind[0])};
  };
  const faces=new Map(),duplicates=[];
  const walk=(id,parent)=>{
    const n=j.nodes[id],local=new Matrix4();
    if(n.matrix)local.fromArray(n.matrix);else local.compose(new Vector3().fromArray(n.translation??[0,0,0]),new Quaternion().fromArray(n.rotation??[0,0,0,1]),new Vector3().fromArray(n.scale??[1,1,1]));
    const world=parent.clone().multiply(local),instanceAttributes=n.extensions?.EXT_mesh_gpu_instancing?.attributes;
    const instanceCounts=Object.values(instanceAttributes??{}).map(a=>j.accessors[a].count);
    if(new Set(instanceCounts).size>1)throw new Error('Mismatched instance attribute counts');
    const instances=instanceCounts[0]??1;
    if(n.mesh!==undefined){
      const mesh=j.meshes[n.mesh];
      for(let primitive=0;primitive<mesh.primitives.length;primitive++){
        const p=mesh.primitives[primitive];if((p.mode??4)!==4||p.extensions)throw new Error('Inventory supports decoded triangles only');
        const pos=data(p.attributes.POSITION),index=p.indices===undefined?null:data(p.indices),count=index?.a.count??pos.a.count;
        if(count%3)throw new Error('Incomplete triangle');
        const box=new Box3();for(let i=0;i<pos.a.count;i++)box.expandByPoint(new Vector3(pos.get(i,0),pos.get(i,1),pos.get(i,2)).applyMatrix4(world));
        const material=p.material===undefined?null:j.materials[p.material],passes=material?.alphaMode==='BLEND'&&material.doubleSided?2:1;
        const row={node:n.name??String(id),mesh:n.mesh,primitive,trianglesPerInstance:count/3,instances,renderPasses:passes,renderedTriangles:count/3*instances*passes,draws:instances?passes:0,material:p.material??null,bounds:[box.min.toArray(),box.max.toArray()],boundsScope:instanceAttributes?'prototype world bounds; instance transforms excluded':'active node world bounds'};
        meshRows.push(row);if(p.material!==undefined)materialIds.add(p.material);
        if(selected.test(row.node)&&!instanceAttributes){
          for(let i=0;i<count;i+=3){
            const points=[0,1,2].map(k=>{const v=index?index.get(i+k):i+k;if(v>=pos.a.count)throw new Error('Invalid triangle index');return new Vector3(pos.get(v,0),pos.get(v,1),pos.get(v,2)).applyMatrix4(world);});
            if(new Vector3().subVectors(points[1],points[0]).cross(new Vector3().subVectors(points[2],points[0])).lengthSq()<1e-18)continue;
            const key=points.map(v=>v.toArray().map(x=>Math.round(x*1e6)).join(',')).sort().join('|');
            const old=faces.get(key);if(old)duplicates.push({first:old,second:{node:row.node,primitive,triangle:i/3,material:p.material??null}});else faces.set(key,{node:row.node,primitive,triangle:i/3,material:p.material??null});
          }
        }
      }
    }for(const child of n.children??[])walk(child,world);
  };
  for(const root of j.scenes[j.scene??0].nodes??[])walk(root,new Matrix4());
  const textureIds=new Set(),scan=x=>{if(!x||typeof x!=='object')return;for(const [k,v]of Object.entries(x)){if(k.endsWith('Texture')&&v?.index!==undefined)textureIds.add(v.index);else scan(v);}};
  for(const id of materialIds)scan(j.materials[id]);
  const images=(j.images??[]).map((image,id)=>{
    if(image.uri||image.bufferView===undefined)return {id,unknown:'External image unsupported'};
    const v=j.bufferViews[image.bufferView],start=v.byteOffset??0;
    try{const d=imageDimensions(binary.subarray(start,start+v.byteLength));return {id,...d,encodedBytes:v.byteLength,estimatedRgbaMipBytes:rgbaMipBytes(d.width,d.height)};}catch(e){return {id,encodedBytes:v.byteLength,unknown:e.message};}
  });
  let decoded=0,known=true;for(const id of textureIds){const t=j.textures[id],image=images[t.source];if(!image?.estimatedRgbaMipBytes){known=false;notes.push('Texture'+id+' decoded memory unknown');}else decoded+=image.estimatedRgbaMipBytes;}
  if(meshRows.some(r=>r.boundsScope.startsWith('prototype')))notes.push('Instanced node bounds exclude per-instance transforms; triangle/draw counts include instances');
  return {bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),activeGeometryTriangles:meshRows.reduce((a,r)=>a+r.trianglesPerInstance*r.instances,0),activeRenderedTriangles:meshRows.reduce((a,r)=>a+r.renderedTriangles,0),primitiveDrawsBeforeRuntimeBatching:meshRows.reduce((a,r)=>a+r.draws,0),activeTextureObjects:textureIds.size,estimatedActiveRgbaMipBytes:known?decoded:null,images,selectedMeshes:meshRows.filter(r=>selected.test(r.node)),selectedDuplicateFacesAtMicrometrePrecision:duplicates,materials:[...materialIds].map(id=>({id,name:j.materials[id].name,alphaMode:j.materials[id].alphaMode??'OPAQUE',doubleSided:j.materials[id].doubleSided??false})),meshRows,notes};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [manifestFile,out]=process.argv.slice(2);if(!manifestFile||!out)throw new Error('Usage: manifest.json fresh-output-directory');
  fs.mkdirSync(out,{recursive:true}); // Never replace an existing audit receipt.
  if(fs.existsSync(path.join(out,'inventory.json')))throw new Error('Use a fresh numbered output directory');
  const manifest=JSON.parse(fs.readFileSync(manifestFile)),directory=path.dirname(manifestFile),rows=[];
  for(const entry of manifest.parts){const source=path.join(directory,entry.file),r=inventoryGlb(fs.readFileSync(source));if(entry.sha256&&r.sha256!==entry.sha256)throw new Error('Manifest hash mismatch: '+entry.file);rows.push({file:entry.file,...r});}
  const receipt={at:new Date().toISOString(),revision:manifest.revision,sourceUnchanged:true,limits:['active scene source accounting before runtime masking/batching','RGBA8+mips estimate per referenced texture object, not measured GPU memory','selected exact-position duplicate faces are diagnostics, not all near-coplanar contacts','no historical or real-device acceptance'],parts:rows};
  fs.writeFileSync(path.join(out,'inventory.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(rows.map(r=>({file:r.file,bytes:r.bytes,triangles:r.activeRenderedTriangles,draws:r.primitiveDrawsBeforeRuntimeBatching,textureMiB:r.estimatedActiveRgbaMipBytes===null?null:+(r.estimatedActiveRgbaMipBytes/1048576).toFixed(2),selectedDuplicateFaces:r.selectedDuplicateFacesAtMicrometrePrecision.length})),null,2));
}
