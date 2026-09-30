// MERGE111 study staging. Unknown/hero/floor views show flowers only; production
// proximity/time staging has not been implemented.
export function dreamObjectForView(view){
 if(['ground-axis','ground-ceiling'].includes(view))return 'UD_Dream_Balloon_Stair';
 if(['ground-corner','ground-window','ground-street'].includes(view))return 'UD_Dream_RabbitStatue';
 if(['upper-axis','upper-window','upper-street'].includes(view))return 'UD_Dream_Phonograph';
 if(view==='upper-corner')return 'UD_Dream_HospitalBed';
 if(view==='upper-ceiling')return 'UD_Dream_Balloon_UpperCeiling';
 return null;
}
export function stageDream(model,view){
 const chosen=dreamObjectForView(view),visible=[];
 model.scene.traverse(o=>{if(!o.userData.dreamObject)return;
  o.visible=o.userData.dreamObject==='flowers'||o.name===chosen;
  if(o.visible)visible.push(o.name);
 });
 return visible;
}
// Disabling/unloading while a GLB is pending invalidates the response. Stale
// models are disposed exactly once and cannot attach to a retired room.
export function createShopDreamLayer({load,attach,release,onChange=()=>{}}){
 let epoch=0,disposed=false,model=null,status='empty',view='',error=null;
 function retire(){epoch++;if(model)release(model);model=null;status='empty';error=null;}
 function update(enabled,nextView){
  if(disposed)return;view=nextView;
  if(!enabled){if(status!=='empty')retire();return;}
  if(model){stageDream(model,view);return;}
  if(status!=='empty')return;
  const token=++epoch;status='loading';
  Promise.resolve().then(load).then(value=>{
   if(disposed||token!==epoch){release(value);return;}
   model=value;stageDream(model,view);status='loaded';attach(model);onChange();
  }).catch(cause=>{if(disposed||token!==epoch)return;error=String(cause.message??cause);status='failed';onChange();});
 }
 return {update,dispose(){if(disposed)return;disposed=true;retire();},
  snapshot:()=>({status,view,error,visible:model?stageDream(model,view):[]})};
}
