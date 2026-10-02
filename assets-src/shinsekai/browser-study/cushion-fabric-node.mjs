import {Fn,attribute,positionLocal,positionView,normalView,faceDirection,smoothstep} from 'three/tsl';
import {cushionFabricSettings as settings} from './cushion-fabric-study.mjs';

export function buildCushionFabricNode(gain){
 if(![.5,1].includes(gain))throw new Error('Only nonzero declared fabric gains build a shader');
 return Fn(()=>{
  const c=Math.cos(settings.yaw),s=Math.sin(settings.yaw);
  const dx=positionLocal.x.sub(settings.centre[0]),dz=positionLocal.z.sub(settings.centre[1]);
  const x=dx.mul(c).sub(dz.mul(s)),y=dx.mul(-s).sub(dz.mul(c));
  const wave=(metres,pitch)=>{
   const cycles=metres.div(pitch).toVar();
   return cycles.mul(2*Math.PI).sin().mul(smoothstep(...settings.fadeCyclesPerPixel,cycles.fwidth()).oneMinus());
  };
  // Derivatives run for all fragments before any mask application. Fade threads
  // before undersampling; preserve nearby textures, silhouettes and AA.
  const height=wave(x,settings.pitchesMetres[0]).add(wave(y,settings.pitchesMetres[1])).mul(settings.amplitudeMetres*gain/2).toVar();
  const sx=positionView.dFdx(),sy=positionView.dFdy(),a=sy.cross(normalView),b=normalView.cross(sx);
  const det=sx.dot(a).mul(faceDirection);
  const gradient=a.mul(height.dFdx()).add(b.mul(height.dFdy())).mul(det.sign()).mul(attribute('_cushion','float'));
  // Raw position derivatives retain metre calibration; clamp protects edge-on
  // and degenerate fragments without hiding derivatives in divergent branches.
  return normalView.sub(gradient.div(det.abs().max(1e-12))).normalize();
 })();
}
