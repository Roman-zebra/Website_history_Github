// Inferred source-light balance. Restore before releasing/reusing a cached room.
export function createHallDirectionalLook(model,{gain=.01}={}){
 const lights=[];model.scene.traverse(o=>{if(o.isDirectionalLight)lights.push(o);});
 if(lights.length!==1||!Number.isFinite(lights[0].intensity)||lights[0].intensity<=0||!Number.isFinite(gain)||gain<=0||gain>1)throw new Error('Expected one measured hall directional light and bounded gain');
 const light=lights[0],source=light.intensity;
 return {apply(enabled){light.intensity=source*(enabled?gain:1);return {light:light.name,sourceIntensity:source,intensity:light.intensity,gain:enabled?gain:1,inferred:true,visualAcceptance:false};},dispose(){light.intensity=source;}};
}
