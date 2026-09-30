// A hidden/throttled tab must not leave PNG controls locked indefinitely.
export function waitCaptureFrame({request,cancel,setTimer=setTimeout,clearTimer=clearTimeout,timeoutMs=4000}) {
 let frame,timer,settled=false,finish;
 const promise=new Promise((resolve,reject)=>{
  finish=error=>{if(settled)return;settled=true;cancel(frame);clearTimer(timer);if(error)reject(error);else resolve();};
  frame=request(()=>finish());timer=setTimer(()=>finish(new Error('Capture frame timed out. Keep the tab visible and retry.')),timeoutMs);
 });
 return {promise,cancel:()=>finish(new Error('Capture cancelled while hidden or leaving.'))};
}
export function encodeCanvasPng(canvas,{setTimer=setTimeout,clearTimer=clearTimeout,timeoutMs=8000}={}) {
 let timer,settled=false,finish;
 const promise=new Promise((resolve,reject)=>{
  finish=(error,blob)=>{if(settled)return;settled=true;clearTimer(timer);error?reject(error):resolve(blob);};
  timer=setTimer(()=>finish(new Error('PNG encoding timed out. Keep the tab visible and retry.')),timeoutMs);
  try{canvas.toBlob(blob=>finish(blob?null:new Error('PNG encoding failed.'),blob),'image/png');}catch(error){finish(error);}
 });
 return {promise,cancel:()=>finish(new Error('Capture cancelled while encoding.'))};
}
