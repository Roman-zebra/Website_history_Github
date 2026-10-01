// Inferred browser-only daytime balance; retain source data for comparison.
// Limited ranges reduce cross-floor fill; they do not provide light occlusion.
export function connectShopDaylight(model){
 const lights=[];
 model.scene.traverse(o=>{if(o.isPointLight)lights.push({light:o,intensity:o.intensity,distance:o.distance});});
 function apply(daytime){
  for(const {light,intensity,distance} of lights){
   light.intensity=intensity*(daytime ? .3 : 1);
   light.distance=daytime?(light.name==='HybridLamp_upper_room'?4.5:2.5):distance;
  }
  return {lights:lights.length,daytime,gain:daytime ? .0009 : .003,range:daytime?'upper 4.5m, other 2.5m':'source study 8m',inferred:true,extraShadowMaps:0};
 }
 return {apply,dispose(){for(const {light,intensity,distance} of lights){light.intensity=intensity;light.distance=distance;}}};
}
