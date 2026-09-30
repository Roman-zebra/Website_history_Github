// Runtime-independent lazy cell lifecycle. The host supplies scene attachment,
// loading and disposal; stale asynchronous results never revive retired cells.
export function createInteriorCells({cells,load,attach,detach,onChange=()=>{},enter=15,leave=18}) {
 if(!(enter>0&&leave>enter))throw new Error('Cell distances require positive hysteresis');
 const states=new Map(cells.map(cell=>[cell.id,{cell,epoch:0,status:'empty',value:null}]));
 if(states.size!==cells.length)throw new Error('Duplicate interior cell id');
 let disposed=false;
 function retire(state){state.epoch++;if(state.value)detach(state.cell,state.value);state.value=null;state.status='empty';}
 function update(position){
  if(disposed)return;
  for(const state of states.values()){
   const distance=Math.hypot(...state.cell.position.map((v,i)=>v-position[i]));
   if(distance>leave){if(state.status!=='empty')retire(state);continue;}
   if(distance>enter||state.status!=='empty')continue;
   const epoch=++state.epoch;state.status='loading';
   Promise.resolve().then(()=>load(state.cell)).then(value=>{
    if(disposed||epoch!==state.epoch){detach(state.cell,value);return;}
    state.value=value;state.status='loaded';attach(state.cell,value);onChange();
   }).catch(error=>{
    if(disposed||epoch!==state.epoch)return;
    state.status='failed';state.error=String(error.message??error);onChange();
   });
  }
 }
 return {update,dispose(){if(disposed)return;disposed=true;for(const state of states.values())retire(state);},
  snapshot:()=>[...states.values()].map(({cell,status,error})=>({id:cell.id,status,...(error?{error}:{})}))};
}
