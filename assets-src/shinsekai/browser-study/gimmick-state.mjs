// Stable machine/feature hooks for later puzzles; no answers, UI or unlock persistence.
export const MACHINES=Object.freeze([
 {id:'tower-lift',featureId:'first-tower'},
 {id:'ropeway',featureId:'ropeway'},
 {id:'circling-wave',featureId:'circling-wave'},
 ...['roof','shaft','band','gallery'].map(tier=>({id:'tower-bulbs-'+tier,featureId:'first-tower',area:'tower',tier}))
]);
export function createGimmickState(machines,{onStart=()=>true,getTime=()=>0}={}) {
 const states=new Map();for(const m of machines){if(!m.id||!m.featureId||states.has(m.id))throw new Error('Invalid or duplicate machine');states.set(m.id,{...m,state:'parked'});}
 return {
  get(id){const m=states.get(id);return m?{...m}:null;},
  startGimmick(id){const m=states.get(id);if(!m||m.state!=='parked')return false;const epoch=getTime();if(!Number.isFinite(epoch)||epoch<0)throw new Error('Invalid start time');if(onStart(id)===false)return false;m.startedAt=epoch;m.state='started';return true;},
  park(id){const m=states.get(id);if(!m)return false;m.state='parked';return true;},
  parkAll(){for(const m of states.values())m.state='parked';},
  time(id,elapsed){if(!Number.isFinite(elapsed)||elapsed<0)throw new Error('Invalid machine time');const m=states.get(id);return m?.state==='started'?Math.max(0,elapsed-m.startedAt):0;}
 };
}
export function connectGimmickEvents(target,state) {
 const handler=event=>state.startGimmick(typeof event.detail==='string'?event.detail:event.detail?.id);
 target.addEventListener('startGimmick',handler);return ()=>target.removeEventListener('startGimmick',handler);
}
