// Capture-only index copies. No source owners or source buffers survive the call.
export const INDEX_LIMITS_S067=Object.freeze({nodes:16384,meshes:2048,indices:2048,path:640,name:160,groups:64,elementsPerIndex:262144,totalElements:4194304,copyBytes:16777216,retainedCopyBytes:33554432,pendingRecords:16,snapshotBytes:1048576,parts:64,partBytes:120000});
const savedCopies=new WeakMap();
// Weak keys make abandoned capture results collectible. Active digest calls keep
// their record alive until finally; their raw copies remain in this admission sum.
const pendingRecords=new Set();
function copyAdmission(){let bytes=0;for(const lease of pendingRecords){if(lease.record.deref())bytes+=lease.bytes;else pendingRecords.delete(lease);}if(pendingRecords.size>=INDEX_LIMITS_S067.pendingRecords)throw Error('Pending index record limit exceeded');return bytes;}
const safeCount=x=>Number.isSafeInteger(x)&&x>=0?x:null;
const text=x=>typeof x==='string'?x.slice(0,INDEX_LIMITS_S067.name):null;
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
const incomplete=error=>freeze({schema:'index-state-S067-v1',complete:false,error:String(error?.message??error).slice(0,240),retainedSourceOwners:0,extraRenderCalls:0,extraCompileCalls:0,indexValuesQualified:false});
const littleEndian=new Uint8Array(new Uint16Array([0x1234]).buffer)[0]===0x34;
const widthOf=array=>Object.getPrototypeOf(array)===Uint8Array.prototype?1:Object.getPrototypeOf(array)===Uint16Array.prototype?2:Object.getPrototypeOf(array)===Uint32Array.prototype?4:0;
export function copyIndexStateS067(scene,camera,detail={}){
  try{
    if(!scene||!Number.isInteger(camera?.layers?.mask))throw Error('Unknown scene/camera layers');
    const existingCopyBytes=copyAdmission(),seen=new WeakSet(),indexIDs=new WeakMap(),indices=[],meshes=[],copies=[],stack=[{node:scene,visible:true,path:'root'}];
    let nodes=0,copyBytes=0,totalElements=0,hiddenMeshesSkipped=0,layerMeshesSkipped=0;
    while(stack.length){
      if(nodes>=INDEX_LIMITS_S067.nodes)throw Error('Node limit exceeded');
      const item=stack.pop(),node=item.node;
      if(!node||typeof node!=='object'||seen.has(node))throw Error('Unknown, repeated or cyclic graph node');
      seen.add(node);nodes++;
      if(typeof node.visible!=='boolean')throw Error('Unknown node visibility');
      const visible=item.visible&&node.visible;
      if(node.isMesh===true){
        if(!Number.isInteger(node.layers?.mask))throw Error('Unknown mesh layers');
        if(!visible)hiddenMeshesSkipped++;
        else if((node.layers.mask&camera.layers.mask)===0)layerMeshesSkipped++;
        else{
          if(meshes.length>=INDEX_LIMITS_S067.meshes)throw Error('Mesh limit exceeded');
          const geometry=node.geometry;
          if(geometry?.isBufferGeometry!==true)throw Error('Unknown mesh geometry');
          const index=geometry.index;
          let id=null;
          if(index!==null){
            if(!index||index.isBufferAttribute!==true||index.isInterleavedBufferAttribute===true||index.itemSize!==1||index.normalized!==false)throw Error('Unknown index attribute');
            if(indexIDs.has(index))id=indexIDs.get(index);
            else{
              if(indices.length>=INDEX_LIMITS_S067.indices)throw Error('Index registry limit exceeded');
              const array=index.array,width=widthOf(array),count=safeCount(index.count),version=safeCount(index.version);
              if(!width||count===null||version===null||array.length!==count||array.byteLength!==count*width||!(array.buffer instanceof ArrayBuffer)||array.buffer.resizable===true)throw Error('Unknown or mutable index storage');
              if(count>INDEX_LIMITS_S067.elementsPerIndex)throw Error('Per-index element limit exceeded');
              totalElements+=count;copyBytes+=array.byteLength;
              if(totalElements>INDEX_LIMITS_S067.totalElements||copyBytes>INDEX_LIMITS_S067.copyBytes)throw Error('Index copy total limit exceeded');
              if(existingCopyBytes+copyBytes>INDEX_LIMITS_S067.retainedCopyBytes)throw Error('Retained index copy limit exceeded');
              const raw=new Uint8Array(array.byteLength);
              Uint8Array.prototype.set.call(raw,new Uint8Array(array.buffer,array.byteOffset,array.byteLength));
              id=indices.length;indexIDs.set(index,id);copies.push(raw);
              indices.push({id,name:text(index.name??''),arrayType:width===1?'Uint8Array':width===2?'Uint16Array':'Uint32Array',width,count,version,normalized:false,itemSize:1,byteLength:raw.length,rawByteOrder:littleEndian?'little':'big'});
            }
          }
          if(!Array.isArray(geometry.groups)||geometry.groups.length>INDEX_LIMITS_S067.groups)throw Error('Unknown index groups');
          const range=x=>x===Infinity?'all':safeCount(x);
          const groups=geometry.groups.map(g=>({start:safeCount(g.start),count:range(g.count),materialIndex:safeCount(g.materialIndex)}));
          const drawRange={start:safeCount(geometry.drawRange?.start),count:range(geometry.drawRange?.count)};
          if(Object.values(drawRange).includes(null)||groups.some(g=>Object.values(g).includes(null)))throw Error('Unknown index draw range');
          meshes.push({path:item.path,name:text(node.name),indexID:id,drawRange,groups});
        }
      }
      if(!Array.isArray(node.children)||node.children.length>INDEX_LIMITS_S067.nodes-nodes-stack.length)throw Error('Unknown graph children or stack limit');
      for(let i=node.children.length-1;i>=0;i--){const path=item.path+'/'+i;if(path.length>INDEX_LIMITS_S067.path)throw Error('Graph path limit exceeded');stack.push({node:node.children[i],visible,path});}
    }
    const record=freeze({schema:'index-state-S067-v1',complete:true,site:text(detail.site),backend:text(detail.backend),sourceFrames:safeCount(detail.sourceFrames),nodes,hiddenMeshesSkipped,layerMeshesSkipped,meshes,indices,copyBytes,totalElements,limits:{...INDEX_LIMITS_S067},retainedSourceOwners:0,extraRenderCalls:0,extraCompileCalls:0,postOriginalRenderOnly:true,actualDrawListQualified:false,fullGeometryQualified:false,indexValuesQualified:false,hashesReady:false});
    if(!['WebGPU','WebGL2'].includes(record.backend))throw Error('Unknown actual backend');
    if(new TextEncoder().encode(JSON.stringify(record)).length>INDEX_LIMITS_S067.snapshotBytes)throw Error('Index snapshot limit exceeded');
    const lease={record:new WeakRef(record),bytes:copyBytes};pendingRecords.add(lease);savedCopies.set(record,{copies,lease});return record;
  }catch(error){return incomplete(error);}
}
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
export async function digestIndexStateS067(record,{hash=digest}={}){
  const saved=savedCopies.get(record);savedCopies.delete(record);
  if(record?.complete!==true)return record??incomplete('Missing index record');
  if(!saved)return incomplete('Index copies already consumed or missing');
  const {copies,lease}=saved;
  try{
    const indices=[];
    for(const row of record.indices){
      const raw=copies[row.id],view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),canonical=new Uint8Array(row.count*4),out=new DataView(canonical.buffer);
      let minimum=null,maximum=null,valuesFFFF=0,valuesFFFFFFFF=0;
      for(let i=0;i<row.count;i++){
        const value=row.width===1?view.getUint8(i):row.width===2?view.getUint16(i*2,littleEndian):view.getUint32(i*4,littleEndian);
        out.setUint32(i*4,value,true);minimum=minimum===null?value:Math.min(minimum,value);maximum=maximum===null?value:Math.max(maximum,value);
        if(value===0xffff)valuesFFFF++;if(value===0xffffffff)valuesFFFFFFFF++;
      }
      const rawSHA256=await hash(raw),canonicalUint32LESHA256=await hash(canonical);
      if(!/^[a-f0-9]{64}$/.test(rawSHA256)||!/^[a-f0-9]{64}$/.test(canonicalUint32LESHA256))throw Error('Invalid index hash');
      indices.push({...row,rawSHA256,canonicalUint32LESHA256,canonicalByteLength:canonical.length,minimum,maximum,valuesFFFF,valuesFFFFFFFF,restartSentinelsNormalized:false});
      canonical.fill(0);raw.fill(0);copies[row.id]=null;
    }
    return freeze({...record,indices,hashesReady:true,canonicalFormat:'Uint32 little-endian numeric values; no restart sentinel normalization',indexValuesQualified:false});
  }catch(error){return incomplete(error);}
  finally{for(const raw of copies)if(raw)raw.fill(0);copies.length=0;pendingRecords.delete(lease);}
}
export function attachIndexStateS067(receipt,record){
  Object.defineProperty(receipt,'indexStateS067',{value:record,enumerable:false});
  receipt.indexStateSummary={schema:record.schema,complete:record.complete,indices:record.indices?.length??0,copyBytes:record.copyBytes??0,error:record.error??null,indexValuesQualified:false};return receipt;
}
export function patchIndexStateS067(source,{modulePath='../../capture-index-state-S067.mjs'}={}){
  const original=source,edits=[];
  const replace=(a,b)=>{if(source.split(a).length!==2)throw Error('Index capture seam must be unique');source=source.replace(a,b);edits.push([a,b]);};
  const sample=site=>'copyIndexStateS067(scene,camera,{site:'+JSON.stringify(site)+',sourceFrames:frames,backend:rendererObservation?.snapshot()?.actualBackend??"not-created"})';
  const seam='attachDrawStateR067(Object.assign(snapshot2(), {captureControl:captureControlRecordN067}),drawStateRecordR067)';
  replace(seam,'attachIndexStateS067('+seam+','+sample('original-capture')+')');
  const native='    attachDrawStateR067(receipt,captureDrawStateR067(scene,camera,{site:"review-native-capture",sourceFrames:frames,backend:rendererObservation?.snapshot()?.actualBackend??"not-created"}));';
  replace(native,native+'\n    attachIndexStateS067(receipt,'+sample('review-native-capture')+');');
  const prefix='import {copyIndexStateS067,attachIndexStateS067} from '+JSON.stringify(modulePath)+';\n';source=prefix+source;
  let restored=source.slice(prefix.length);for(const [a,b]of edits)restored=restored.replace(b,a);
  if(restored!==original)throw Error('Index capture restoration failed');
  return {source,proof:{captureSites:2,originalExactlyRestored:true,postOriginalRenderOnly:true,extraRenderCalls:0,extraCompileCalls:0,hotFrameObservation:false,sourceMutation:false,originalBlobPromiseAndErrorsUnchanged:true}};
}
export async function saveIndexStatePNG_S067(result,{sessionID,backend,nativeFetch}){
  try{
    const record=await digestIndexStateS067(result.receipt.indexStateS067),text=JSON.stringify(record),bytes=new TextEncoder().encode(text);
    if(bytes.length>INDEX_LIMITS_S067.snapshotBytes)throw Error('Index transport snapshot limit exceeded');
    const pngSHA256=await digest(await result.blob.arrayBuffer()),snapshotSHA256=await digest(bytes),captureID=crypto.randomUUID(),parts=[];
    let offset=0;
    while(offset<text.length){
      if(parts.length>=INDEX_LIMITS_S067.parts)throw Error('Index part limit exceeded');
      let length=Math.min(40000,text.length-offset),body;
      while(true){body=JSON.stringify({packet:'DOTS-CODEX-011-PROTECTED-HALL-ASYNC-PASS-SIDE-PREPARATION-067',phase:'index-state-png-part',sessionID,backend,captureID,index:parts.length,text:text.slice(offset,offset+length)});if(body.length<=INDEX_LIMITS_S067.partBytes&&new TextEncoder().encode(body).length<=INDEX_LIMITS_S067.partBytes)break;if(length<2)throw Error('Index part cannot fit');length=Math.floor(length/2);}
      parts.push({body,index:parts.length,characters:length,sha256:await digest(new TextEncoder().encode(text.slice(offset,offset+length)))});offset+=length;
    }
    const post=async body=>{const response=await nativeFetch('/api/__qa/receipt',{method:'POST',headers:{'Content-Type':'application/json'},body,cache:'no-store'});if(!response.ok)throw Error('Index observation refused: '+response.status);};
    for(const part of parts)await post(part.body);
    await post(JSON.stringify({packet:'DOTS-CODEX-011-PROTECTED-HALL-ASYNC-PASS-SIDE-PREPARATION-067',phase:'index-state-png-index',sessionID,backend,captureID,at:new Date().toISOString(),png:{bytes:result.blob.size,sha256:pngSHA256},snapshot:{bytes:bytes.length,characters:text.length,sha256:snapshotSHA256,complete:record.complete,parts:parts.map(({index,characters,sha256})=>({index,characters,sha256}))},accepted:false,adopted:false,physicalDeviceQualified:false}));
    return {saved:true,complete:record.complete,captureID,pngSHA256,snapshotSHA256};
  }catch(error){console.warn('Index observation save failed: '+String(error.message));return {saved:false,complete:false,error:String(error.message)};}
}
