import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {captureDrawStateR067,attachDrawStateR067,patchDrawStateR067,saveDrawStatePNG_R067,DRAW_LIMITS_R067} from '../capture-draw-state-R067.mjs';
import {patchCaptureControlN067,captureControlN067} from '../capture-control-N067.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const ident=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const m=()=>({elements:[...ident]}),v=()=>({x:0,y:0,z:0});
const node=()=>({name:'',type:'Group',visible:true,children:[],position:v(),quaternion:{x:0,y:0,z:0,w:1},scale:{x:1,y:1,z:1},matrixWorld:m(),layers:{mask:1}});
const texture=()=>({isTexture:true,name:'source texture',version:0,mapping:300,colorSpace:'srgb',format:1023,type:1009,minFilter:1008,magFilter:1006,wrapS:1001,wrapT:1001,anisotropy:1,flipY:true,generateMipmaps:true,offset:{x:0,y:0},repeat:{x:1,y:1},center:{x:0,y:0},rotation:0,matrix:{elements:[1,0,0,0,1,0,0,0,1]},matrixAutoUpdate:true,image:{width:1024,height:1024},source:{version:0}});
const material=()=>({isMaterial:true,name:'source material',type:'MeshStandardMaterial',version:0,opacity:1,visible:true,transparent:false,depthWrite:true,depthTest:true,colorWrite:true,dithering:false,toneMapped:true,roughness:.7,metalness:0,color:{r:1,g:.8,b:.6},map:texture()});
const attr=()=>({count:3,itemSize:3,normalized:false,version:0,usage:35044,array:new Float32Array([0,0,0,1,0,0,0,1,0])});
const geometry=()=>({isBufferGeometry:true,name:'source triangle',type:'BufferGeometry',attributes:{position:attr()},index:null,groups:[],drawRange:{start:0,count:Infinity},morphAttributes:{},morphTargetsRelative:false});
const mesh=()=>({...node(),isMesh:true,type:'Mesh',renderOrder:0,frustumCulled:true,castShadow:false,receiveShadow:false,geometry:geometry(),material:material()});
const camera={...node(),near:.02,far:250,projectionMatrix:m(),projectionMatrixInverse:m(),matrixWorldInverse:m()};
const detail={site:'review-native-capture',backend:'WebGPU',sourceFrames:7};
const scene=node(),visible=mesh(),hidden=mesh(),layered=mesh();hidden.visible=false;layered.layers.mask=2;scene.children=[visible,hidden,layered];
let forbidden=0;for(const owner of [scene,visible,visible.geometry,visible.material,visible.material.map,camera])for(const key of ['render','compileAsync','traverse','updateMatrixWorld','updateMatrix','toArray'])owner[key]=()=>{forbidden++;throw Error('No method invocation: '+key);};
const original=JSON.stringify(scene),record=captureDrawStateR067(scene,camera,detail);
assert.equal(record.complete,true);assert.equal(record.nodes,4);assert.equal(record.meshes.length,1);assert.equal(record.hiddenMeshesSkipped,1);assert.equal(record.layerMeshesSkipped,1);assert.equal(record.materials.length,1);assert.equal(record.textures.length,1);assert.equal(record.meshes[0].geometry.drawRange.count,'all');assert.equal(record.materials[0].booleans.dithering,false);assert.equal(record.textures[0].image.width,1024);assert.equal(forbidden,0);assert.equal(JSON.stringify(scene),original);
assert.ok(Object.isFrozen(record.meshes[0].matrixWorld));assert.ok(Object.isFrozen(record.meshes[0].geometry.attributes));assert.equal(record.retainedOwners,0);assert.equal(record.actualDrawListQualified,false);assert.equal(record.fullMaterialShaderStateQualified,false);assert.equal(record.geometryBufferBytesCompared,false);
visible.position.x=8;visible.material.roughness=.3;visible.geometry.attributes.position.version=2;visible.material.map.image.width=512;assert.equal(record.meshes[0].position[0],0);assert.equal(record.materials[0].scalars.roughness,.7);assert.equal(record.meshes[0].geometry.attributes[0].version,0);assert.equal(record.textures[0].image.width,1024);
const incomplete=setup=>{const root=node(),item=mesh();root.children=[item];setup(root,item);const result=captureDrawStateR067(root,camera,detail);assert.equal(result.complete,false);assert.equal(result.retainedOwners,0);return result;};
incomplete((root,item)=>item.matrixWorld.elements[0]=NaN);incomplete((root,item)=>item.geometry.drawRange.count=-1);incomplete((root,item)=>item.material.opacity=undefined);incomplete((root,item)=>item.material.isShaderMaterial=true);incomplete((root,item)=>item.isSkinnedMesh=true);incomplete((root,item)=>Object.defineProperty(item.material,'roughness',{get(){throw Error('Native getter failed');}}));incomplete(root=>root.children.push(root));incomplete((root,item)=>item.geometry.attributes['x'.repeat(161)]=attr());
incomplete(root=>root.children=Array.from({length:DRAW_LIMITS_R067.nodes+1},node));
incomplete(root=>{let cursor=root;for(let i=0;i<330;i++){const next=node();cursor.children=[next];cursor=next;}});
incomplete((root,item)=>{const sharedGeometry=item.geometry,sharedMaterial=item.material;root.children=Array.from({length:DRAW_LIMITS_R067.meshes+1},()=>({...mesh(),geometry:sharedGeometry,material:sharedMaterial}));});
incomplete((root,item)=>{const sharedGeometry=item.geometry;root.children=Array.from({length:DRAW_LIMITS_R067.materials+1},()=>({...mesh(),geometry:sharedGeometry}));});
incomplete(root=>{root.children=Array.from({length:257},()=>{const item=mesh();for(const slot of ['alphaMap','normalMap','roughnessMap'])item.material[slot]=texture();return item;});});
assert.equal(captureDrawStateR067(scene,camera,{backend:'requested-only'}).complete,false);
const receipt=attachDrawStateR067({original:'receipt'},record);assert.equal(receipt.drawStateR067,record);assert.equal(Object.keys(receipt).includes('drawStateR067'),false);assert.ok(JSON.stringify(receipt).length<600);assert.equal(JSON.parse(JSON.stringify(receipt)).drawStateSummary.complete,true);
// Keep the immutable observation alive while proving no original model owners are retained.
const ownerRefs=[];const retainedSnapshot=(()=>{const root=node(),item=mesh();root.children=[item];for(const owner of [root,item,item.geometry,item.geometry.attributes.position.array,item.material,item.material.map])ownerRefs.push(new WeakRef(owner));return captureDrawStateR067(root,camera,detail);})();
assert.equal(retainedSnapshot.complete,true);assert.equal(typeof global.gc,'function','Run with --expose-gc for the actual owner lifetime check');
for(let i=0;i<12;i++){await new Promise(setImmediate);global.gc();}
assert.ok(ownerRefs.every(ref=>ref.deref()===undefined),'Snapshot must not retain scene/mesh/geometry/buffer/material/texture owners');
console.log(JSON.stringify({passed:true,immutablePrimitiveSnapshot:true,ownerLifetimeVerified:true,failClosedLimits:true,extraRender:0,extraCompile:0,nativeQualified:false}));

// Exercise multipart receipt reconstruction, Unicode and byte hashes through the unchanged limit.
const largeScene=node(),shared=mesh();largeScene.children=Array.from({length:420},(_,i)=>({...mesh(),name:'日本語🙂 '+i,geometry:shared.geometry,material:shared.material}));
const largeRecord=captureDrawStateR067(largeScene,camera,{...detail,backend:'WebGL2'});assert.equal(largeRecord.complete,true);
const blob=new Blob(['original real-PNG bytes are opaque to observation'],{type:'image/png'}),nativeResult={blob,receipt:attachDrawStateR067({original:'retained'},largeRecord)},posted=[];
const saved=await saveDrawStatePNG_R067(nativeResult,{sessionID:'synthetic',backend:'webgl2',nativeFetch:async(url,options)=>{assert.equal(url,'/api/__qa/receipt');assert.equal(options.cache,'no-store');assert.ok(options.body.length<=128000);assert.ok(Buffer.byteLength(options.body)<=128000);posted.push(JSON.parse(options.body));return {ok:true};}});
assert.equal(saved.saved,true);assert.ok(saved.parts>1);const index=posted.at(-1);assert.equal(index.phase,'draw-state-png-index');assert.equal(index.png.sha256,sha(Buffer.from(await blob.arrayBuffer())));assert.equal(index.snapshot.complete,true);
const pieces=posted.slice(0,-1);assert.equal(pieces.length,index.snapshot.parts.length);for(const [i,p] of pieces.entries()){assert.equal(p.captureID,index.captureID);assert.equal(p.index,i);assert.equal(sha(Buffer.from(p.text)),index.snapshot.parts[i].sha256);assert.equal(p.text.length,index.snapshot.parts[i].characters);}
const joined=pieces.map(p=>p.text).join('');assert.equal(sha(Buffer.from(joined)),index.snapshot.sha256);assert.equal(Buffer.byteLength(joined),index.snapshot.bytes);assert.deepEqual(JSON.parse(joined),JSON.parse(JSON.stringify(largeRecord)));
const beforeBlob=sha(Buffer.from(await blob.arrayBuffer())),warnings=[],oldWarn=console.warn;console.warn=value=>warnings.push(value);
try{const failed=await saveDrawStatePNG_R067(nativeResult,{sessionID:'synthetic',backend:'webgl2',nativeFetch:async()=>({ok:false,status:413})});assert.equal(failed.saved,false);assert.equal(warnings.length,1);assert.equal(sha(Buffer.from(await blob.arrayBuffer())),beforeBlob);assert.equal(nativeResult.receipt.original,'retained');}finally{console.warn=oldWarn;}
console.log(JSON.stringify({multipartReceipt:true,exactSnapshotHash:true,exactPNGHash:true,originalReceiptLimit:128000,uploadFailurePreservesCapture:true,nativeQualified:false}));

const fragment=readFileSync(new URL('../fixtures/original-capture-fragments-N.txt',import.meta.url),'utf8');
const anchors=['original-capture','review-native-capture'].map(site=>fragment.split('\n').find(line=>line.includes('observeRender067(renderer, scene, camera, {site:"'+site+'"')).trim());
const nPatched=patchCaptureControlN067(fragment,anchors),patched=patchDrawStateR067(nPatched.source);
assert.equal(patched.proof.captureSites,2);assert.equal(patched.proof.originalExactlyRestored,true);assert.equal(patched.source.match(/observeRender067\(renderer, scene, camera/g).length,2);assert.equal(patched.source.match(/canvas.toBlob/g).length,2);assert.equal(patched.source.match(/requirePreparedCapture067\(\);/g).length,2);assert.throws(()=>patchDrawStateR067(nPatched.source+'\n'+nPatched.source),/unique/);
const sourceBody=patched.source.replace(/^import .*\n/gm,'').replace('\n\nasync capturePNG()','\n\nconst api={async capturePNG()')+'};';
let renders=0,blobs=0,expected=blob,renderError=null;
const renderer={render(){renders++;if(renderError)throw renderError;},toneMapping:4,toneMappingExposure:1.15,outputColorSpace:'srgb'},canvas={width:1920,height:1080,toBlob(resolve,type){blobs++;assert.equal(type,'image/png');resolve(expected);}};
const create=new Function('captureControlN067','captureDrawStateR067','attachDrawStateR067','scene','camera','renderer','canvas','frames','cameraId','rendererObservation','snapshot2','requirePreparedCapture067','observeRender067','player','viewportOwner','applyPose','let ready=true,disposed=false;const bootDone=true,models=new Set(),hall={snapshot:()=>({state:"ready"})},exterior=hall,cinema=hall;\n'+sourceBody+'\nreturn {api,setDisposed:value=>disposed=value};');
const args=[captureControlN067,captureDrawStateR067,attachDrawStateR067,scene,camera,renderer,canvas,7,'rear',{snapshot:()=>({actualBackend:'WebGPU'})},()=>({original:'receipt'}),()=>{},r=>r.render(),{pause(){}},{sync(){}},()=>{}];
const api=create(...args);const result=await api.api.capturePNG();assert.equal(result.blob,blob);assert.equal(result.receipt.original,'receipt');assert.equal(result.receipt.drawStateR067.complete,true);assert.equal(renders,1);assert.equal(blobs,1);
expected=null;await assert.rejects(api.api.capturePNG(),/Capture canceled/);expected=blob;api.setDisposed(true);await assert.rejects(api.api.capturePNG(),/Hall is not ready/);api.setDisposed(false);const exactError=Error('Original render failure');renderError=exactError;await assert.rejects(api.api.capturePNG(),error=>error===exactError);renderError=null;
const softArgs=[...args];softArgs[1]=()=>({schema:'draw-state-R067-v1',complete:false,error:'Unknown active state'});const soft=create(...softArgs);assert.equal((await soft.api.capturePNG()).blob,blob);
console.log(JSON.stringify({actualFrozenCaptureSeams:true,exactRestoration:true,originalPromiseBlobErrorsUnchanged:true,observationFailurePreservesCapture:true,captureSites:2,nativeQualified:false}));
