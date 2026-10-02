// Inferred browser-only daytime balance; retain source data for comparison.
// Limited ranges reduce cross-floor fill; they do not provide light occlusion.
export function connectShopDaylight(model,{upperGain=null}={}){
 if(upperGain!==null&&![.3,1].includes(upperGain))throw new Error('Invalid upper room lamp gain');
 const lights=[];
 model.scene.traverse(o=>{if(o.isPointLight)lights.push({light:o,intensity:o.intensity,distance:o.distance});});
 const upper=lights.filter(({light})=>light.name==='HybridLamp_upper_room');
 if(upperGain!==null&&upper.length!==1)throw new Error('Upper room lamp comparison requires one exact source light');
 function apply(daytime){
  for(const {light,intensity,distance} of lights){
   light.intensity=intensity*(daytime ? (light.name==='HybridLamp_upper_room'?(upperGain??.3):.3) : 1);
   light.distance=daytime?(light.name==='HybridLamp_upper_room'?4.5:2.5):distance;
  }
  return {lights:lights.length,daytime,gain:daytime ? .0009 : .003,upperRoom:{matched:upper.length,gain:daytime?(upperGain??.3):1,intensities:upper.map(({light})=>light.intensity)},range:daytime?'upper 4.5m, other 2.5m':'source study 8m',inferred:true,extraShadowMaps:0};
 }
 return {apply,dispose(){for(const {light,intensity,distance} of lights){light.intensity=intensity;light.distance=distance;}}};
}
