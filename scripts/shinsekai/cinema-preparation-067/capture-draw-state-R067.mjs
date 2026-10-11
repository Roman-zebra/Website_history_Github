// Post-original-render primitive observations only. Never calls a scene/renderer method.
export const DRAW_LIMITS_R067 = Object.freeze({nodes:16384,meshes:2048,materials:512,textures:1024,attributes:64,groups:64,path:640,name:160,bytes:1048576,parts:64,partBytes:120000});
const number = value => Number.isFinite(value) ? value : null;
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const name = value => typeof value === 'string' ? value.slice(0,DRAW_LIMITS_R067.name) : null;
const bool = value => typeof value === 'boolean' ? value : null;
const vector = (value,keys) => value ? keys.map(key=>number(value[key])) : null;
const matrix = (value,length) => value?.elements?.length === length ? Array.from(value.elements,number) : null;
const valid = (value,length) => Array.isArray(value)&&value.length===length&&value.every(Number.isFinite);
const range = value => value === Infinity ? 'all' : count(value);
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function limitedKeys(value,limit){const keys=[];for(const key in value??{})if(Object.hasOwn(value,key)){if(keys.length>=limit)throw Error('Attribute limit exceeded');if(key.length>DRAW_LIMITS_R067.name)throw Error('Attribute key limit exceeded');keys.push(key);}return keys.sort();}
function attribute(value){if(!value)return null;return {count:count(value.count),itemSize:count(value.itemSize),normalized:bool(value.normalized),version:count(value.version??value.data?.version),usage:number(value.usage??value.data?.usage),arrayType:name(value.array?.constructor?.name??value.data?.array?.constructor?.name)};}
function geometry(value){
  if(!value?.isBufferGeometry)throw Error('Unknown mesh geometry');
  const attributes=limitedKeys(value.attributes,DRAW_LIMITS_R067.attributes).map(key=>({key:name(key),...attribute(value.attributes[key])}));
  if(!attributes.some(a=>a.key==='position'&&a.count!==null&&a.itemSize!==null))throw Error('Unknown position attribute');
  if(attributes.some(a=>a.count===null||a.itemSize===null||a.itemSize===0||a.version===null))throw Error('Unknown attribute counts/version');
  if(!Array.isArray(value.groups)||value.groups.length>DRAW_LIMITS_R067.groups)throw Error('Unknown geometry groups or group limit');
  const groups=value.groups.map(g=>({start:count(g.start),count:range(g.count),materialIndex:count(g.materialIndex)}));
  const drawRange={start:count(value.drawRange?.start),count:range(value.drawRange?.count)};
  if(drawRange.start===null||drawRange.count===null||groups.some(g=>Object.values(g).includes(null)))throw Error('Unknown geometry draw range');
  const index=attribute(value.index);
  if(index&&(index.count===null||index.itemSize===null||index.version===null))throw Error('Unknown index attribute');
  const morph=limitedKeys(value.morphAttributes,DRAW_LIMITS_R067.attributes).map(key=>{const values=value.morphAttributes[key];if(!Array.isArray(values)||values.length>DRAW_LIMITS_R067.attributes)throw Error('Morph limit exceeded');return {key:name(key),attributes:values.map(attribute)};});
  if(morph.some(m=>m.attributes.some(a=>!a||a.count===null||a.itemSize===null||a.version===null)))throw Error('Unknown morph attributes');
  return {name:name(value.name),type:name(value.type),attributes,index,groups,drawRange,morph,morphTargetsRelative:bool(value.morphTargetsRelative),bufferBytesCompared:false};
}
const textureSlots=['map','alphaMap','aoMap','bumpMap','normalMap','displacementMap','emissiveMap','roughnessMap','metalnessMap','envMap','lightMap','clearcoatMap','clearcoatNormalMap','clearcoatRoughnessMap','transmissionMap','thicknessMap','specularMap','specularColorMap','specularIntensityMap','iridescenceMap','iridescenceThicknessMap','sheenColorMap','sheenRoughnessMap','anisotropyMap'];
const materialScalars=['opacity','alphaTest','side','blending','blendSrc','blendDst','blendEquation','depthFunc','polygonOffsetFactor','polygonOffsetUnits','roughness','metalness','bumpScale','displacementScale','displacementBias','emissiveIntensity','aoMapIntensity','lightMapIntensity','envMapIntensity','clearcoat','clearcoatRoughness','transmission','thickness','ior','iridescence','iridescenceIOR','sheen','sheenRoughness','anisotropy','anisotropyRotation','specularIntensity'];
const materialBooleans=['visible','transparent','depthTest','depthWrite','colorWrite','dithering','alphaToCoverage','premultipliedAlpha','forceSinglePass','toneMapped','wireframe','polygonOffset','flatShading','vertexColors'];
function dimensions(image){if(!image)return {kind:'none'};if(Array.isArray(image)){if(image.length>6)throw Error('Texture image limit exceeded');return {kind:'array',images:image.map(dimensions)};}return {kind:'image',width:number(image.width),height:number(image.height),depth:number(image.depth)};}
export function captureDrawStateR067(scene,camera,detail={}){
  try{
    if(!scene||!Number.isInteger(camera?.layers?.mask))throw Error('Unknown scene/camera layers');
    const meshes=[],materials=[],textures=[],materialIDs=new WeakMap(),textureIDs=new WeakMap(),seen=new WeakSet();
    const textureID=value=>{
      if(value===null||value===undefined)return null;
      if(!value?.isTexture)throw Error('Unknown material texture');
      if(textureIDs.has(value))return textureIDs.get(value);
      if(textures.length>=DRAW_LIMITS_R067.textures)throw Error('Texture limit exceeded');
      const row={name:name(value.name),version:count(value.version),mapping:number(value.mapping),colorSpace:name(value.colorSpace),format:number(value.format),type:number(value.type),minFilter:number(value.minFilter),magFilter:number(value.magFilter),wrapS:number(value.wrapS),wrapT:number(value.wrapT),anisotropy:number(value.anisotropy),flipY:bool(value.flipY),generateMipmaps:bool(value.generateMipmaps),offset:vector(value.offset,['x','y']),repeat:vector(value.repeat,['x','y']),center:vector(value.center,['x','y']),rotation:number(value.rotation),matrix:matrix(value.matrix,9),matrixAutoUpdate:bool(value.matrixAutoUpdate),image:dimensions(value.image),sourceVersion:count(value.source?.version),sourceDataBytesCompared:false};
      if(['version','mapping','format','type','minFilter','magFilter','wrapS','wrapT','anisotropy','rotation','sourceVersion'].some(k=>row[k]===null)||['flipY','generateMipmaps','matrixAutoUpdate'].some(k=>row[k]===null)||row.colorSpace===null||!valid(row.matrix,9)||!valid(row.offset,2)||!valid(row.repeat,2)||!valid(row.center,2))throw Error('Unknown texture critical fields');
      const id=textures.length;textureIDs.set(value,id);textures.push(row);return id;
    };
    const materialID=value=>{
      if(!value?.isMaterial)throw Error('Unknown mesh material');
      if(materialIDs.has(value))return materialIDs.get(value);
      if(materials.length>=DRAW_LIMITS_R067.materials)throw Error('Material limit exceeded');
      if(value.isShaderMaterial===true||value.isRawShaderMaterial===true)throw Error('Custom shader uniforms are unobserved');
      const row={name:name(value.name),type:name(value.type),version:count(value.version),scalars:{},booleans:{},colors:{},textures:{},normalScale:vector(value.normalScale,['x','y']),ownCompileHook:Object.hasOwn(value,'onBeforeCompile'),nodeMaterial:value.isNodeMaterial===true,fullShaderStateQualified:false};
      for(const key of materialScalars)if(key in value)row.scalars[key]=number(value[key]);
      for(const key of materialBooleans)if(key in value)row.booleans[key]=bool(value[key]);
      for(const key of ['color','emissive','specular','specularColor','sheenColor','attenuationColor'])if(value[key])row.colors[key]=vector(value[key],['r','g','b']);
      for(const key of textureSlots)if(key in value)row.textures[key]=textureID(value[key]);
      if(!row.type||row.version===null||row.scalars.opacity===null||row.scalars.opacity===undefined||row.booleans.visible===null||row.booleans.visible===undefined||Object.values(row.scalars).includes(null)||Object.values(row.booleans).includes(null)||Object.values(row.colors).some(v=>!valid(v,3))||(row.normalScale!==null&&!valid(row.normalScale,2)))throw Error('Unknown material critical fields');
      const id=materials.length;materialIDs.set(value,id);materials.push(row);return id;
    };
    const pending=[{node:scene,visible:true,path:'root'}];let nodes=0,hiddenMeshesSkipped=0,layerMeshesSkipped=0;
    while(pending.length){
      if(nodes>=DRAW_LIMITS_R067.nodes)throw Error('Node limit exceeded');
      const item=pending.pop(),node=item.node;if(!node||typeof node!=='object')throw Error('Unknown graph node');
      if(seen.has(node))throw Error('Cycle or repeated owner in graph');seen.add(node);nodes++;
      if(typeof node.visible!=='boolean')throw Error('Unknown node visibility');
      const effectiveVisible=item.visible&&node.visible;
      if(node.isMesh===true){
        if(!Number.isInteger(node.layers?.mask))throw Error('Unknown mesh layers');
        if(!effectiveVisible)hiddenMeshesSkipped++;
        else if((node.layers.mask&camera.layers.mask)===0)layerMeshesSkipped++;
        else {
          if(meshes.length>=DRAW_LIMITS_R067.meshes)throw Error('Mesh limit exceeded');
          const row={path:item.path,name:name(node.name),type:name(node.type),effectiveVisible,layersMask:node.layers.mask,renderOrder:number(node.renderOrder),frustumCulled:bool(node.frustumCulled),castShadow:bool(node.castShadow),receiveShadow:bool(node.receiveShadow),position:vector(node.position,['x','y','z']),quaternion:vector(node.quaternion,['x','y','z','w']),scale:vector(node.scale,['x','y','z']),matrixWorld:matrix(node.matrixWorld,16),geometry:geometry(node.geometry),materials:[],ownBeforeRenderHook:Object.hasOwn(node,'onBeforeRender'),ownAfterRenderHook:Object.hasOwn(node,'onAfterRender'),instances:node.isInstancedMesh?{count:count(node.count),matrix:attribute(node.instanceMatrix),color:attribute(node.instanceColor),bufferBytesCompared:false}:null,morphInfluences:null,skinned:node.isSkinnedMesh===true};
          if(!valid(row.position,3)||!valid(row.quaternion,4)||!valid(row.scale,3)||!valid(row.matrixWorld,16)||row.renderOrder===null||row.frustumCulled===null||row.castShadow===null||row.receiveShadow===null)throw Error('Unknown mesh critical fields');
          const meshMaterials=Array.isArray(node.material)?node.material:[node.material];if(meshMaterials.length>DRAW_LIMITS_R067.materials)throw Error('Mesh material limit exceeded');
          row.materials=meshMaterials.map(materialID);
          if(node.morphTargetInfluences){if(node.morphTargetInfluences.length>DRAW_LIMITS_R067.attributes)throw Error('Morph influence limit exceeded');row.morphInfluences=Array.from(node.morphTargetInfluences,number);if(row.morphInfluences.includes(null))throw Error('Unknown morph influence');}
          if(row.skinned)throw Error('Skeleton state is unobserved');
          if(row.instances&&(row.instances.count===null||!row.instances.matrix||row.instances.matrix.version===null))throw Error('Unknown instance state');
          meshes.push(row);
        }
      }
      const children=node.children;if(!Array.isArray(children))throw Error('Unknown node children');
      if(children.length>DRAW_LIMITS_R067.nodes-nodes-pending.length)throw Error('Graph stack limit exceeded');
      for(let i=children.length-1;i>=0;i--){const path=item.path+'/'+i;if(path.length>DRAW_LIMITS_R067.path)throw Error('Graph path limit exceeded');pending.push({node:children[i],visible:effectiveVisible,path});}
    }
    const result={schema:'draw-state-R067-v1',complete:true,site:name(detail.site),backend:name(detail.backend),sourceFrames:count(detail.sourceFrames),nodes,hiddenMeshesSkipped,layerMeshesSkipped,meshes,materials,textures,limits:{...DRAW_LIMITS_R067},retainedOwners:0,extraRenderCalls:0,extraCompileCalls:0,postRenderObservation:true,actualDrawListQualified:false,fullMaterialShaderStateQualified:false,geometryBufferBytesCompared:false};
    if(!['WebGPU','WebGL2'].includes(result.backend))throw Error('Unknown actual backend');
    if(new TextEncoder().encode(JSON.stringify(result)).length>DRAW_LIMITS_R067.bytes)throw Error('Snapshot byte limit exceeded');
    return freeze(result);
  }catch(error){return freeze({schema:'draw-state-R067-v1',complete:false,error:String(error?.message??error).slice(0,240),retainedOwners:0,extraRenderCalls:0,extraCompileCalls:0});}
}
// Full primitives are private to this capture result; original receipt serialization stays small.
export function attachDrawStateR067(receipt,record){
  Object.defineProperty(receipt,'drawStateR067',{value:record,enumerable:false});
  receipt.drawStateSummary={schema:record.schema,complete:record.complete,nodes:record.nodes??null,meshes:record.meshes?.length??0,materials:record.materials?.length??0,textures:record.textures?.length??0,error:record.error??null,fullMaterialShaderStateQualified:false};return receipt;
}
export function patchDrawStateR067(source,{modulePath='../../capture-draw-state-R067.mjs'}={}){
  const original=source,edits=[];
  const replace=(a,b)=>{if(source.split(a).length!==2)throw Error('Draw state capture seam must be unique');source=source.replace(a,b);edits.push([a,b]);};
  const sample=site=>'captureDrawStateR067(scene,camera,{site:'+JSON.stringify(site)+',sourceFrames:frames,backend:rendererObservation?.snapshot()?.actualBackend??"not-created"})';
  replace('  const receipt = Object.assign(snapshot2(), {captureControl:captureControlRecordN067}), blob =','  const drawStateRecordR067 = '+sample('original-capture')+';\n  const receipt = attachDrawStateR067(Object.assign(snapshot2(), {captureControl:captureControlRecordN067}),drawStateRecordR067), blob =');
  replace('    receipt.captureControl = captureControlRecordN067;','    receipt.captureControl = captureControlRecordN067;\n    attachDrawStateR067(receipt,'+sample('review-native-capture')+');');
  const prefix='import {captureDrawStateR067,attachDrawStateR067} from '+JSON.stringify(modulePath)+';\n';source=prefix+source;
  let restored=source.slice(prefix.length);for(const [a,b]of edits)restored=restored.replace(b,a);
  if(restored!==original)throw Error('Draw state restoration failed');
  return {source,proof:{captureSites:2,originalExactlyRestored:true,postOriginalRenderOnly:true,originalBlobPromiseAndErrorsUnchanged:true,noHotFrameObservation:true,noOwnerRetention:true,extraRender:false,extraCompile:false,originalReceiptSizeLimitUnchanged:true}};
}
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
export async function saveDrawStatePNG_R067(result,{sessionID,backend,nativeFetch}){
  try{
    const record=result.receipt.drawStateR067;if(!record)throw Error('Draw state capture missing');
    const text=JSON.stringify(record),bytes=new TextEncoder().encode(text);
    if(bytes.length>DRAW_LIMITS_R067.bytes)throw Error('Draw state transport byte limit exceeded');
    const pngSHA256=await digest(await result.blob.arrayBuffer()),snapshotSHA256=await digest(bytes),captureID=crypto.randomUUID();
    const parts=[];let offset=0;
    while(offset<text.length){
      if(parts.length>=DRAW_LIMITS_R067.parts)throw Error('Draw state part limit exceeded');
      let length=Math.min(40000,text.length-offset),body;
      while(true){body=JSON.stringify({packet:'DOTS-CODEX-011-PROTECTED-HALL-ASYNC-PASS-SIDE-PREPARATION-067',phase:'draw-state-png-part',sessionID,backend,captureID,index:parts.length,text:text.slice(offset,offset+length)});if(body.length<=DRAW_LIMITS_R067.partBytes&&new TextEncoder().encode(body).length<=DRAW_LIMITS_R067.partBytes)break;if(length<2)throw Error('Draw state part cannot fit');length=Math.floor(length/2);}
      parts.push({body,index:parts.length,characters:length,sha256:await digest(new TextEncoder().encode(text.slice(offset,offset+length)))});offset+=length;
    }
    const post=async body=>{const response=await nativeFetch('/api/__qa/receipt',{method:'POST',headers:{'Content-Type':'application/json'},body,cache:'no-store'});if(!response.ok)throw Error('Draw state observation refused: '+response.status);};
    for(const part of parts)await post(part.body);
    const index={packet:'DOTS-CODEX-011-PROTECTED-HALL-ASYNC-PASS-SIDE-PREPARATION-067',phase:'draw-state-png-index',sessionID,backend,captureID,at:new Date().toISOString(),png:{bytes:result.blob.size,sha256:pngSHA256},snapshot:{bytes:bytes.length,sha256:snapshotSHA256,characters:text.length,complete:record.complete,parts:parts.map(({index,characters,sha256})=>({index,characters,sha256}))},accepted:false,adopted:false,physicalDeviceQualified:false};
    await post(JSON.stringify(index));return {saved:true,complete:record.complete,captureID,parts:parts.length,pngSHA256,snapshotSHA256,snapshotBytes:bytes.length};
  }catch(error){console.warn('Draw state observation save failed: '+String(error.message));return {saved:false,complete:false,error:String(error.message)};}
}
