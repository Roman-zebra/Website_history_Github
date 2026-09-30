import {float,vec3,positionWorld,mix,mx_fractal_noise_float} from 'three/tsl';

// 109 render_setup.py weather(): source metre datums retained; glTF Y is up.
// MaterialX noise approximates Blender Noise and is not pixel-identical.
// Supply baked local AO separately; default1 does not invent crevice evidence.
export const towerWeatherLedges=Object.freeze([4.6,13.1,14.35,14.95,19,5.8,9.3,12.7,16.1,1.5,2.9]);
export function towerWeatherNodes({albedo,roughness=float(.7),strength=1,ao=float(1),soot=true,streaks=true,ledges=towerWeatherLedges,position=positionWorld}={}){
 if(!albedo)throw new TypeError('An existing linear albedo node is required.');
 if(!Number.isFinite(strength)||strength<0||strength>2)throw new RangeError('Weather strength must be0..2.');
 if(!Array.isArray(ledges)||ledges.some(h=>!Number.isFinite(h)))throw new TypeError('Ledges must be finite metre datums.');
 if(strength===0)return {colorNode:albedo,roughnessNode:roughness};
 const noise=(p,octaves,diminish=.5)=>mx_fractal_noise_float(p,octaves,2,diminish,.5).add(.5).clamp();
 const height=position.y,ragged=height.add(noise(position.mul(6),6).mul(.35));
 const splash=ragged.div(.85).oneMinus().clamp().pow(1.6);
 let col=mix(albedo,vec3(.075,.058,.04),splash.mul(.75*strength).clamp());
 const damp=ragged.lessThan(.55).select(.25*strength,0);
 col=mix(col,col.mul(vec3(.62,.60,.58)),damp.clamp());
 const crevice=ao.clamp().oneMinus().pow(.8).mul(.85*strength).clamp();
 col=mix(col,col.mul(vec3(.09,.075,.06)),crevice);
 if(streaks){
  const streak=noise(position.mul(vec3(11.2,.56,11.2)),3,.4).sub(.52).max(0).mul(3*strength).clamp();
  let ledgeMask=float(0);
  for(const h of ledges){const distance=float(h).sub(height);ledgeMask=ledgeMask.max(distance.greaterThan(0).select(distance.div(1.6).oneMinus().clamp(),0));}
  const runoff=streak.mul(ledgeMask.mul(.8).add(.25)).mul(.65).clamp();
  col=mix(col,col.mul(vec3(.55,.52,.48)),runoff);
 }
 if(soot){const mask=height.div(22).sub(.45).clamp().mul(.6*strength).clamp();col=mix(col,col.mul(vec3(.72,.70,.68)),mask);}
 const mottle=noise(position.mul(.35),2).mul(.16).add(.92);
 return {colorNode:col.mul(mottle),roughnessNode:roughness.add(splash.mul(.1)).clamp(.02,1)};
}
