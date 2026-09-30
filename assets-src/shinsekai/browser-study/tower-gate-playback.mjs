// Loaded-cell-only playback; open/close latch sequencing uses both real clips.
export function createTowerGatePlayback(THREE,model,key){
 const open=model.animations.find(a=>a.name===key+'_open'),close=model.animations.find(a=>a.name===key+'_close');
 if(!open||!close)return null;
 for(const clip of [open,close])for(const track of clip.tracks){const parsed=THREE.PropertyBinding.parseTrackName(track.name);if(!THREE.PropertyBinding.findNode(model.scene,parsed.nodeName))throw new Error('Gate clip targets an unloaded node');}
 const mixer=new THREE.AnimationMixer(model.scene);let active=null,elapsed=0,playing=false,disposed=false,phase='open',progress=0;
 function pose(clip,time){if(active?.getClip()!==clip){mixer.stopAllAction();active=mixer.clipAction(clip);active.play();active.paused=true;}active.time=Math.max(0,Math.min(clip.duration,time));mixer.update(0);}
 function requireLive(){if(disposed)throw new Error('Gate cell has been released');}
 return {
  scrub(value){requireLive();if(!Number.isFinite(value)||value<0||value>1)throw new Error('Gate progress must be0–1');playing=false;phase='open';progress=value;pose(open,value*open.duration);},
  play(){requireLive();elapsed=0;playing=true;phase='open';progress=0;pose(open,0);},
  update(delta){requireLive();if(!Number.isFinite(delta)||delta<0)throw new Error('Finite nonnegative elapsed time required');if(!playing)return false;elapsed+=delta;
   if(elapsed<open.duration){phase='open';progress=elapsed/open.duration;pose(open,elapsed);}
   else{phase='close';const t=Math.min(close.duration,elapsed-open.duration);progress=1-t/close.duration;pose(close,t);if(t===close.duration)playing=false;}
   return playing;
  },
  snapshot(){return {playing,phase,progress,elapsed};},
  dispose(){if(disposed)return;disposed=true;playing=false;mixer.stopAllAction();mixer.uncacheRoot(model.scene);}
 };
}
