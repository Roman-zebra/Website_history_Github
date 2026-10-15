// Surviving-parent QA only. The controller observes; native pagehide owns cleanup.
export function createAbruptDepartureT067({getActive,read,isReleased,detachFrame,publish,send,setStatus,now=()=>performance.now(),pause=()=>new Promise(resolve=>setTimeout(resolve,40)),deadlineMs=5000}={}){
  if(![getActive,read,isReleased,detachFrame,publish,send,setStatus,now,pause].every(x=>typeof x==='function')||!Number.isFinite(deadlineMs)||deadlineMs<0||deadlineMs>10000)throw Error('Invalid abrupt departure dependencies');
  const event=(r,kind,detail)=>{r.events.push({kind,detail,at:new Date().toISOString()});while(r.events.length>32)r.events.shift();};
  const count=x=>Number.isSafeInteger(x)&&x>=0?x:null;
  function before(r){const g=r.lastGate,s=g?.source??r.lastSource,p=s?.resourcePreparation;return Object.freeze({backend:typeof s?.rendererBackend?.actualBackend==='string'?s.rendererBackend.actualBackend:r.backend,sourceReady:typeof s?.ready==='boolean'?s.ready:null,sourceDisposed:typeof s?.disposed==='boolean'?s.disposed:null,ownedModels:count(s?.ownedModels),activeLeases:count(s?.texturePool?.activeLeases),pendingFetches:count(s?.pendingFetches),pendingCompiles:count(p?.pendingCompiles),cinemaState:typeof s?.rooms?.cinema?.state==='string'?s.rooms.cinema.state:null,gateLoading:typeof g?.loading==='boolean'?g.loading:null,gateClosed:typeof g?.closed==='boolean'?g.closed:null,gatePreparationActive:typeof g?.preparation?.active==='boolean'?g.preparation.active:null,gatePreparationPending:count(g?.preparation?.pendingRequests),hostLeaseState:typeof g?.hostLease?.state==='string'?g.hostLease.state:null});}
  function finish(r){r.released=true;r.closing=false;r.abruptObservationPending=false;r.sourceRead=null;r.gateRead=null;r.gateClose=null;r.device=null;publish();send(r,'abrupt-owned-resources-released');setStatus('表示を外しました。元の離脱処理による解放を確認しました。');}
  function reconcile(r=getActive()){
    if(!r?.abruptDetached||r.released)return !!r?.released;
    read(r);
    const trusted=r.events.some(e=>e.kind==='native-pagehide'&&e.detail?.isTrusted===true);
    if(trusted&&isReleased(r)===true){finish(r);return true;}
    publish();return false;
  }
  async function depart({reason='review-button'}={}){
    const r=getActive();
    if(!r||r.closing||r.abruptDetached||r.left)return {started:false,reason:'No active undeparted record'};
    r.closing=true;r.controlledClose=false;r.abruptDetached=true;r.abruptObservationPending=true;r.returnRequested=false;
    r.abruptCallsGateClose=false;r.abruptCallsSourceRetire=false;r.abruptRequestsEndButton=false;r.endButtonRequested=false;r.leaseCloseRequested=false;
    try{
      read(r);r.beforeAbruptDeparture=before(r);event(r,'abrupt-departure-requested',{reason});
      // Discard the close callback before detaching: it cannot be a fallback.
      r.gateClose=null;
      const proof=detachFrame();
      if(!proof||proof.oldFrameConnected!==false||proof.replacementFrameConnected!==true||proof.replacementSource!=='about:blank')throw Error('Native iframe removal not confirmed');
      r.abruptFrameProof=Object.freeze({...proof});r.left=true;event(r,'original-iframe-removed',r.abruptFrameProof);send(r,'abrupt-original-iframe-removed');setStatus('表示を外しました。元の離脱処理の解放を観測しています…');publish();
      const started=now();
      while(true){
        if(reconcile(r))return {started:true,released:true,timedOut:false};
        if(now()-started>=deadlineMs){r.timedOut=true;r.closing=false;event(r,'abrupt-observation-deadline',{deadlineMs});publish();send(r,'abrupt-observation-pending');setStatus('離脱は完了しました。資源の解放は確認中です。同じ記録を保持しています。');return {started:true,released:false,timedOut:true,terminal:false};}
        await pause();
      }
    }catch(error){r.closing=false;r.closeError=String(error?.message??error).slice(0,240);event(r,'abrupt-departure-failed',{error:r.closeError});publish();send(r,'abrupt-departure-failed');setStatus('表示の離脱確認ができませんでした。この記録を保持しています。');return {started:true,released:false,error:r.closeError};}
  }
  return Object.freeze({depart,reconcile,observerCallsRetirement:false,maximumObservationMs:deadlineMs});
}
export function qualifyAbruptResourcesT067(r,legacyReleased){
  try{
    const s=r.lastGate?.source??r.lastSource,p=s?.resourcePreparation,b=s?.rendererBackend;
    return legacyReleased===true&&r.sourceRegistered===true&&s?.disposed===true&&s.ownedModels===0&&s.pendingFetches===0&&s.texturePool?.activeLeases===0&&s.viewport?.disposed===true&&p?.pendingCompiles===0&&p.activeBackendOwners===0&&p.passCacheObservation?.activeOwners===0&&b?.retirementObserved===true&&b.errorCount===0&&b.callbacksRestored===true&&['WebGPU','WebGL2'].includes(b.actualBackend)&&(b.actualBackend!=='WebGPU'||b.gpuRetirementConfirmed===true);
  }catch{return false;}
}
export function patchAbruptParentT067({entry,html,modulePath='./abrupt-departure-T067.mjs',sourceBuildId='38e55b7454463300ba83fa0b6306b48b8ae29192862d2eb005812b3c3711e564'}){
  if(!/^[a-f0-9]{64}$/.test(sourceBuildId))throw Error('Invalid frozen source build');
  const originalEntry=entry,originalHTML=html,entryEdits=[],htmlEdits=[];
  const editEntry=(a,b)=>{if(entry.split(a).length!==2)throw Error('Abrupt parent entry seam must be unique');entry=entry.replace(a,b);entryEdits.push([a,b]);};
  const editHTML=(a,b)=>{if(html.split(a).length!==2)throw Error('Abrupt parent HTML seam must be unique');html=html.replace(a,b);htmlEdits.push([a,b]);};
  editEntry("const EXPECTED_BUILD='38e55b7454463300ba83fa0b6306b48b8ae29192862d2eb006712b3c3711e564';",'const EXPECTED_BUILD='+JSON.stringify(sourceBuildId)+';');
  editEntry("const frame=document.getElementById('child'),records=[],","let frame=document.getElementById('child');const records=[],");
  const summary='controlledClose:r.controlledClose,';
  editEntry(summary,summary+'abruptDetached:r.abruptDetached===true,abruptObservationPending:r.abruptObservationPending===true,beforeAbruptDeparture:r.beforeAbruptDeparture??null,abruptFrameProof:r.abruptFrameProof??null,abruptCallsGateClose:r.abruptCallsGateClose??null,abruptCallsSourceRetire:r.abruptCallsSourceRetire??null,abruptRequestsEndButton:r.abruptRequestsEndButton??null,');
  const registered='const r=active;r.backend=actualBackend;';
  editEntry(registered,"const r=active;r.devicePreviouslyObserved=device?seenDevicesT067.has(device):false;if(device)seenDevicesT067.add(device);r.sourceReaderPreviouslyObserved=seenSourceReadersT067.has(sourceRead);seenSourceReadersT067.add(sourceRead);r.backend=actualBackend;");
  const sourceRegistered='sourceRegistered:!!r.sourceRegistered,';
  editEntry(sourceRegistered,sourceRegistered+'devicePreviouslyObserved:r.devicePreviouslyObserved??null,sourceReaderPreviouslyObserved:r.sourceReaderPreviouslyObserved??null,');
  const cinema='cinemaPreparationStarted067(){const q=';
  editEntry(cinema,"cinemaPreparationStarted067(){const drop=document.getElementById('qa-drop-cinema-preparation');if(drop?.checked&&active){drop.checked=false;void abruptDepartureT067.depart({reason:'native-cinema-compile-start'});return;}const q=");
  const refresh="if(active){read(active);send(active,'parent-manual-observation');}publish();";
  editEntry(refresh,"if(active){if(active.abruptDetached)abruptDepartureT067.reconcile(active);else read(active);send(active,'parent-manual-observation');}publish();");
  const leave='<button id="leave-child">閉じて離脱</button>';
  editHTML(leave,leave+'<button id="drop-child">表示を外して離脱</button>');
  const detail='<details><summary>起動中の終了検証</summary>';
  editHTML(detail,detail+'<label><input id="qa-drop-cinema-preparation" type="checkbox">次の映画館準備で表示を外す（一回のみ）</label>');
  const prefix='import {createAbruptDepartureT067,qualifyAbruptResourcesT067} from '+JSON.stringify(modulePath)+';\nconst seenDevicesT067=new WeakSet(),seenSourceReadersT067=new WeakSet();\n';
  const suffix="\nconst abruptDepartureT067=createAbruptDepartureT067({getActive:()=>active,read,isReleased:r=>qualifyAbruptResourcesT067(r,released(r)),detachFrame:()=>{const oldFrame=frame,newFrame=oldFrame.cloneNode(false);newFrame.src='about:blank';oldFrame.replaceWith(newFrame);frame=newFrame;return {oldFrameConnected:oldFrame.isConnected,replacementFrameConnected:newFrame.isConnected,replacementSource:newFrame.getAttribute('src'),observerCallsCloseRetireOrEnd:false};},publish,send,setStatus:text=>{document.getElementById('return-status').textContent=text;}});\ndocument.getElementById('drop-child').addEventListener('click',()=>{void abruptDepartureT067.depart();});\n";
  entry=prefix+entry+suffix;
  let restoredEntry=entry.slice(prefix.length,-suffix.length),restoredHTML=html;
  for(const [a,b]of entryEdits)restoredEntry=restoredEntry.replace(b,a);
  for(const [a,b]of htmlEdits)restoredHTML=restoredHTML.replace(b,a);
  if(restoredEntry!==originalEntry||restoredHTML!==originalHTML)throw Error('Abrupt parent exact restoration failed');
  return {entry,html,proof:{originalParentEntryExactlyRestored:true,originalParentHTMLExactlyRestored:true,sourceModuleEdits:0,originalControlledCloseUnchanged:true,originalCompileNotificationUnchanged:true,delayAdded:false,observerCallsRetirement:false,browserEvaluatedMutation:false,newQAOnlyDepartureControl:true,sourceBuildId,sourceRegisterPinMatchesExplicitInput:true,timeoutDoesNotClaimTerminal:true}};
}
