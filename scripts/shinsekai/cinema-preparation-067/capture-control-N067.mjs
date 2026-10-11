// Numeric observations only, sampled after the original PNG render. No owners or hot-frame hooks.
export const CAPTURE_LIMITS_N067 = Object.freeze({nodes:16384,lights:64,name:160});
const finite = x => Number.isFinite(x) ? x : null;
const text = x => typeof x === 'string' ? x.slice(0,CAPTURE_LIMITS_N067.name) : null;
const vector = (v,keys) => v ? keys.map(k=>finite(v[k])) : null;
const matrix = v => v?.elements?.length === 16 ? Array.from(v.elements,finite) : null;
const color = v => v ? vector(v,['r','g','b']) : null;
const transform = v => v ? {position:vector(v.position,['x','y','z']),quaternion:vector(v.quaternion,['x','y','z','w']),scale:vector(v.scale,['x','y','z']),matrixWorld:matrix(v.matrixWorld),layersMask:finite(v.layers?.mask)} : null;
const cameraNumbers = v => v ? {...transform(v),type:text(v.type),near:finite(v.near),far:finite(v.far),aspect:finite(v.aspect),fov:finite(v.fov),zoom:finite(v.zoom),filmGauge:finite(v.filmGauge),filmOffset:finite(v.filmOffset),left:finite(v.left),right:finite(v.right),top:finite(v.top),bottom:finite(v.bottom),projection:matrix(v.projectionMatrix),projectionInverse:matrix(v.projectionMatrixInverse),worldInverse:matrix(v.matrixWorldInverse)} : null;
const textureNumbers = v => v ? {name:text(v.name),type:text(v.type),mapping:finite(v.mapping),colorSpace:text(v.colorSpace),imageWidth:finite(v.image?.width),imageHeight:finite(v.image?.height)} : null;
function freeze(v){if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
export function captureControlN067(scene,camera,renderer,canvas,detail={}) {
  try {
    const lights=[],pending=[{node:scene,visible:true,path:'root'}],seen=new WeakSet();
    let nodes=0,truncated=false,cycle=false;
    while(pending.length){
      if(nodes>=CAPTURE_LIMITS_N067.nodes){truncated=true;break;}
      const item=pending.pop(),node=item.node;
      if(!node||typeof node!=='object')continue;
      if(seen.has(node)){cycle=true;continue;}seen.add(node);nodes++;
      const visible=item.visible&&node.visible!==false;
      if(node.isLight===true){
        if(lights.length>=CAPTURE_LIMITS_N067.lights){truncated=true;break;}
        lights.push({path:item.path,name:text(node.name),type:text(node.type),visible:node.visible!==false,effectiveVisible:visible,...transform(node),color:color(node.color),groundColor:color(node.groundColor),intensity:finite(node.intensity),distance:finite(node.distance),decay:finite(node.decay),angle:finite(node.angle),penumbra:finite(node.penumbra),castShadow:node.castShadow===true,target:transform(node.target),shadow:node.shadow?{camera:cameraNumbers(node.shadow.camera),mapWidth:finite(node.shadow.mapSize?.x),mapHeight:finite(node.shadow.mapSize?.y),bias:finite(node.shadow.bias),normalBias:finite(node.shadow.normalBias),radius:finite(node.shadow.radius)}:null});
      }
      const children=Array.isArray(node.children)?node.children:[];
      // Bound the stack itself as well as visited nodes, even for malformed graphs.
      if(children.length>CAPTURE_LIMITS_N067.nodes-nodes-pending.length){truncated=true;break;}
      for(let i=children.length-1;i>=0;i--)pending.push({node:children[i],visible,path:(item.path+'/'+i).slice(0,CAPTURE_LIMITS_N067.name)});
    }
    const result={schema:'capture-control-N067-v1',complete:!truncated&&!cycle&&!!camera&&!!renderer&&!!canvas,truncated,cycle,nodes,limits:{...CAPTURE_LIMITS_N067},sourceFrames:finite(detail.sourceFrames),cameraId:text(detail.cameraId),backend:text(detail.backend),site:text(detail.site),camera:cameraNumbers(camera),canvas:{width:finite(canvas?.width),height:finite(canvas?.height)},renderer:{toneMapping:finite(renderer?.toneMapping),toneMappingExposure:finite(renderer?.toneMappingExposure),outputColorSpace:text(renderer?.outputColorSpace),antialias:typeof renderer?.antialias==='boolean'?renderer.antialias:null,alpha:typeof renderer?.alpha==='boolean'?renderer.alpha:null},scene:{background:scene?.background?.isColor?color(scene.background):textureNumbers(scene?.background),environment:textureNumbers(scene?.environment),backgroundIntensity:finite(scene?.backgroundIntensity),environmentIntensity:finite(scene?.environmentIntensity),backgroundBlurriness:finite(scene?.backgroundBlurriness),backgroundRotation:vector(scene?.backgroundRotation,['x','y','z']),environmentRotation:vector(scene?.environmentRotation,['x','y','z']),fog:scene?.fog?{type:text(scene.fog.type),color:color(scene.fog.color),near:finite(scene.fog.near),far:finite(scene.fog.far),density:finite(scene.fog.density)}:null},lights,retainedOwners:0,extraRenderCalls:0,extraCompileCalls:0};
    const validArray=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
    result.criticalFieldsValid=validArray(result.camera?.position,3)&&validArray(result.camera?.quaternion,4)&&validArray(result.camera?.projection,16)&&validArray(result.camera?.matrixWorld,16)&&validArray(result.camera?.worldInverse,16)&&Number.isFinite(result.camera?.near)&&Number.isFinite(result.camera?.far)&&result.camera.near>0&&result.camera.far>result.camera.near&&Number.isFinite(result.canvas.width)&&Number.isFinite(result.canvas.height)&&result.canvas.width>0&&result.canvas.height>0&&['WebGPU','WebGL2'].includes(result.backend)&&result.lights.every(l=>validArray(l.color,3)&&Number.isFinite(l.intensity)&&validArray(l.matrixWorld,16));
    result.complete=result.complete&&result.criticalFieldsValid;
    return freeze(result);
  }catch(error){return freeze({schema:'capture-control-N067-v1',complete:false,error:String(error?.message??error).slice(0,240),retainedOwners:0,extraRenderCalls:0,extraCompileCalls:0});}
}
export function patchCaptureControlN067(source,renderAnchors,{modulePath='../../capture-control-N067.mjs'}={}){
  const original=source,edits=[];
  const replace=(a,b)=>{if(source.split(a).length!==2)throw Error('Capture seam must be unique');source=source.replace(a,b);edits.push([a,b]);};
  const sample=site=>'captureControlN067(scene,camera,renderer,canvas,{site:'+JSON.stringify(site)+',sourceFrames:frames,cameraId,backend:rendererObservation?.snapshot()?.actualBackend??"not-created"})';
  replace(renderAnchors[0]+'\n  const receipt = snapshot2(), blob =',renderAnchors[0]+'\n  const captureControlRecordN067 = '+sample('original-capture')+';\n  const receipt = Object.assign(snapshot2(), {captureControl:captureControlRecordN067}), blob =');
  replace(renderAnchors[1]+'\n    const receipt = JSON.parse(JSON.stringify(snapshot2()));',renderAnchors[1]+'\n    const captureControlRecordN067 = '+sample('review-native-capture')+';\n    const receipt = JSON.parse(JSON.stringify(snapshot2()));\n    receipt.captureControl = captureControlRecordN067;');
  const prefix='import {captureControlN067} from '+JSON.stringify(modulePath)+';\n';source=prefix+source;
  let restored=source.slice(prefix.length);for(const [a,b]of edits)restored=restored.replace(b,a);
  if(restored!==original)throw Error('Capture restoration failed');
  return {source,proof:{schema:'capture-seams-N067-v1',captureSites:2,originalExactlyRestored:true,postOriginalRenderOnly:true,originalBlobPromiseAndErrorsUnchanged:true,originalCameraLightMovementUnchanged:true,extraRender:false,extraCompile:false,noHotFrameObservation:true,noRetainedOwners:true}};
}

// Save a small separate receipt so the existing source receipt stays below its unchanged 128000-character limit.
export async function saveCaptureControlPNG_N067(result,{sessionID,backend,nativeFetch}){
  try{
    const bytes=await result.blob.arrayBuffer();
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    const sha256=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
    const value={packet:'DOTS-CODEX-011-PROTECTED-HALL-ASYNC-PASS-SIDE-PREPARATION-067',phase:'capture-control-png-saved',sessionID,backend,at:new Date().toISOString(),png:{bytes:result.blob.size,sha256},captureControl:result.receipt.captureControl,accepted:false,adopted:false,physicalDeviceVerified:false};
    const body=JSON.stringify(value);if(body.length>128000)throw Error('Capture observation exceeds original receipt limit');
    const response=await nativeFetch('/api/__qa/receipt',{method:'POST',headers:{'Content-Type':'application/json'},body,cache:'no-store'});
    if(!response.ok)throw Error('Capture observation refused: '+response.status);
    return {saved:true,bytes:body.length,pngSHA256:sha256};
  }catch(error){console.warn('Capture observation save failed: '+String(error.message));return {saved:false,error:String(error.message)};}
}
