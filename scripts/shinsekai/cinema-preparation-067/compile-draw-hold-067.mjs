// Hold only GPU submission while original asynchronous scene preparation is pending.
// Original draw simulation, UI and room lifetime remain outside this guard; no replacement frames.
import {resourcePreparation067} from './resource-preparation-067.mjs';
export function createCompileDrawHold067({isPending=()=>resourcePreparation067.hasPending()}={}){
 let deferredDrawCallbacks=0,blockedCaptureRequests=0;
 function shouldSubmit(){if(isPending()){deferredDrawCallbacks++;return false;}return true;}
 function requirePreparedCapture(){if(isPending()){blockedCaptureRequests++;throw Error('Display preparation is still in progress');}}
 function snapshot(){return{schema:'JTA_COMPILE_DRAW_HOLD_067',deferredDrawCallbacks,blockedCaptureRequests,pendingCompilation:isPending(),extraFramesScheduled:false,simulationOrUIReplaced:false,rendererOrSceneRetained:false};}
 return Object.freeze({shouldSubmit,requirePreparedCapture,snapshot});
}
export const compileDrawHold067=createCompileDrawHold067();
export const shouldSubmitScheduledDraw067=()=>compileDrawHold067.shouldSubmit();
export const requirePreparedCapture067=()=>compileDrawHold067.requirePreparedCapture();
