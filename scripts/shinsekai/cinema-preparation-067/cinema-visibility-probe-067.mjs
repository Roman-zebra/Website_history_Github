// Observe original projector visibility/intersection once per existing cinema compile. No new intersection or GPU calls.
export function createCinemaVisibilityProbe067({limit=4}={}){
 const rows=[];let dropped=0,errors=0;
 function observeCompile(renderer,scene,camera,phase,invoke){
  if(phase?.owner!=='cinema')return invoke();
  if(rows.length>=Math.min(8,Math.max(0,limit|0))){dropped++;return invoke();}
  let object,row,descriptor,original,wrapper;
  try{
   object=scene.getObjectByName('cinema__projector_7');
   row={name:'cinema__projector_7',found:!!object,rendererInitialized:renderer._initialized===true,
    cameraPosition:[camera.position?.x,camera.position?.y,camera.position?.z],
    cameraLayers:camera.layers?.mask,intersections:[],methodRestored:false};
   if(object){
    row.visible=object.visible;row.frustumCulled=object.frustumCulled;row.objectLayers=object.layers?.mask;
    row.materialVisible=object.material?.visible;row.materialSide=object.material?.side;
    row.ancestorVisibility=[];let p=object.parent;for(let i=0;p&&i<8;i++,p=p.parent)row.ancestorVisibility.push({name:String(p.name??'').slice(0,80),visible:p.visible});
    original=object.intersectsFrustum;
    if(typeof original==='function'){
     descriptor=Object.getOwnPropertyDescriptor(object,'intersectsFrustum');
     wrapper=function(...args){let result,outcome='returned';try{result=Reflect.apply(original,this,args);return result;}catch(e){outcome='threw';throw e;}finally{if(row.intersections.length<2)row.intersections.push({result,outcome});}};
     Object.defineProperty(object,'intersectsFrustum',{configurable:true,writable:true,enumerable:descriptor?.enumerable??false,value:wrapper});
    }
   }
   rows.push(row);
  }catch{errors++;}
  try{return invoke();}finally{
   if(wrapper&&object)try{if(object.intersectsFrustum!==wrapper)throw Error('Visibility probe ownership changed');if(descriptor)Object.defineProperty(object,'intersectsFrustum',descriptor);else delete object.intersectsFrustum;row.methodRestored=true;}catch{errors++;}
   else if(row)row.methodRestored=true;
  }
 }
 const snapshot=()=>({schema:'JTA_CINEMA_VISIBILITY_067_E',rows,dropped,errors,maxRows:Math.min(8,Math.max(0,limit|0)),extraIntersectionCalls:false,extraRendererCalls:false,temporaryWrapperRestoredBeforeAsyncWait:true,nativeQualified:false});
 return Object.freeze({observeCompile,snapshot});
}
export const cinemaVisibilityProbe067=createCinemaVisibilityProbe067();
