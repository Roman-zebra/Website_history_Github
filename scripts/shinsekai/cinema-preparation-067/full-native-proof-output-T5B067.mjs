// QA-only DOM output. Existing beacon and resource lifecycle are unchanged.
export function serializeFullPassiveNativeProofT5B067(active,{maxBytes=100*1024}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1024||maxBytes>100*1024)throw Error('Invalid full native proof output bound');
 const g=active?.lastGate,p=g?.hostLease?.passiveNativeRetirement,result=g?.passiveRetirementResultT5067;
 if(p?.verified!==true||!result)return JSON.stringify({schema:'FULL_NATIVE_RETIREMENT_OUTPUT_T5B_067',sessionID:active?.id??null,available:false});
 const text=JSON.stringify({schema:'FULL_NATIVE_RETIREMENT_OUTPUT_T5B_067',sessionID:active.id,requestedBackend:active.requestedBackend,runtimeQualified:active.released===true,trustedPagehideObserved:active.events.some(e=>e.kind==='native-pagehide'&&e.detail?.isTrusted===true),nativeParentDeviceLost:active.deviceLost??null,passiveMetadata:p,originalResult:result});
 if(new TextEncoder().encode(text).byteLength>maxBytes)throw Error('Full native proof exceeds bound; no truncation');
 return text;
}
export function publishFullPassiveNativeProofT5B067({active,node}){
 if(!node)return false;
 try{node.textContent=serializeFullPassiveNativeProofT5B067(active);return true;}catch(e){node.textContent=JSON.stringify({schema:'FULL_NATIVE_RETIREMENT_OUTPUT_T5B_067',sessionID:active?.id??null,available:false,error:String(e.message??e).slice(0,160),truncated:false});return false;}
}
export function patchFullNativeProofOutputT5B067({entry,html}){
 const originalEntry=entry,originalHTML=html;
 const anchor="function publish(){document.getElementById('parent-receipt').textContent=JSON.stringify(records.map(summary),null,2);document.getElementById('return-hub').disabled=!!active?.closing;}",replacement=anchor.slice(0,-1)+"publishFullPassiveNativeProofT5B067({active,node:document.getElementById('full-native-retirement-proof')});}";
 if(entry.split(anchor).length!==2||html.split('</body>').length!==2)throw Error('Unique full native proof output seams required');
 const prefix="import {publishFullPassiveNativeProofT5B067} from './full-native-proof-output-T5B067.mjs';\n",view='<details><summary>元の完全終了原本（読み取り専用）</summary><pre id="full-native-retirement-proof"></pre></details>';
 entry=prefix+entry.replace(anchor,replacement);html=html.replace('</body>',view+'</body>');
 if(entry.slice(prefix.length).replace(replacement,anchor)!==originalEntry||html.replace(view,'')!==originalHTML)throw Error('Full native proof output exact restoration failed');
 return {entry,html,proof:{exactEntryAndHTMLRestoration:true,originalBeaconUnchanged:true,sourceAndLeaseAndQualifierChanges:0,extraRetireDisposeCloseOrRenderCalls:0,boundedReadOnlyDOMOutput:true,nativeQualified:false}};
}
