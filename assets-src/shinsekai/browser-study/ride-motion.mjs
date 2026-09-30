// Local conditional kinematics. Distances and schedules are assumptions, not history.
export const DEFAULT_RIDES = Object.freeze({span:100, startHeight:15.15, endHeight:15.15, sag:2,
  trackSpacing:4, travelSeconds:65, dwellSeconds:8, elevatorLow:15.15, elevatorHigh:55,
  elevatorTravelSeconds:40, waveRadius:5.45, waveTilt:0.14, wavePeriod:20, wavePrecessionPeriod:0});
function finite(value, name) { if (!Number.isFinite(value)) throw new Error(`Invalid ${name}`); }
export function validateRides(config) {
  for (const name of Object.keys(DEFAULT_RIDES)) finite(config[name],name);
  for (const name of ['span','trackSpacing','travelSeconds','elevatorTravelSeconds','waveRadius','wavePeriod'])
    if(config[name]<=0)throw new Error(`${name} must be positive`);
  if(config.dwellSeconds<0||config.sag<0||config.wavePrecessionPeriod<0||config.elevatorHigh<=config.elevatorLow||Math.abs(config.waveTilt)>=Math.PI/2)
    throw new Error('Invalid ride bounds');
  return config;
}
const smooth = u => u*u*u*(10+u*(-15+6*u)); // zero endpoint velocity AND acceleration
const smoothDerivative = u => 30*u*u*(1-u)*(1-u);
export function shuttle(time, travel, dwell) {
  [time,travel,dwell].forEach((v,i)=>finite(v,['time','travel','dwell'][i]));
  if(time<0||travel<=0||dwell<0)throw new Error('Invalid shuttle timing');
  const cycle=2*(travel+dwell), t=time%cycle;
  if(t<dwell)return {fraction:0,velocity:0,direction:time<cycle?1:-1,phase:'departing-end dwell'};
  if(t<dwell+travel) {const u=(t-dwell)/travel;return {fraction:smooth(u),velocity:smoothDerivative(u)/travel,direction:1,phase:'outbound'};}
  if(t<2*dwell+travel)return {fraction:1,velocity:0,direction:1,phase:'arrival-end dwell'};
  const u=(t-2*dwell-travel)/travel;
  return {fraction:1-smooth(u),velocity:-smoothDerivative(u)/travel,direction:-1,phase:'return'};
}
// Parabolic visual cable; not a catenary or a cable-tension simulation.
export function cablePoint(u, track, config=DEFAULT_RIDES) {
  finite(u,'cable fraction');finite(track,'track');
  if(u<0||u>1)throw new Error('Cable fraction outside span');
  return [(u-0.5)*config.span,config.startHeight+(config.endHeight-config.startHeight)*u-4*config.sag*u*(1-u),track*config.trackSpacing/2];
}
export function ropeway(time,config=DEFAULT_RIDES) {
  const schedule=shuttle(time,config.travelSeconds,config.dwellSeconds);
  const cars=[schedule.fraction,1-schedule.fraction].map((u,i)=>({fraction:u,
    position:cablePoint(u,i===0?-1:1,config),velocity:schedule.velocity*(i===0?1:-1),direction:schedule.direction*(i===0?1:-1),
    tangent:[config.span,config.endHeight-config.startHeight-4*config.sag*(1-2*u),0]}));
  return {schedule,cars};
}
export function elevator(time,config=DEFAULT_RIDES) {
  const schedule=shuttle(time,config.elevatorTravelSeconds,config.dwellSeconds);
  return {height:config.elevatorLow+(config.elevatorHigh-config.elevatorLow)*schedule.fraction,schedule};
}
// One rigid tilted disc candidate. All seats stay coplanar, with no invented flexing.
export function waveSeat(time,index,count,config=DEFAULT_RIDES) {
  finite(time,'wave time');if(time<0||!Number.isInteger(count)||count<1||!Number.isInteger(index)||index<0||index>=count)throw new Error('Invalid wave sample');
  const angle=2*Math.PI*((time%config.wavePeriod)/config.wavePeriod+index/count),r=config.waveRadius;
  const p=config.wavePrecessionPeriod?2*Math.PI*(time%config.wavePrecessionPeriod)/config.wavePrecessionPeriod:0;
  const x=r*Math.cos(angle)*Math.cos(config.waveTilt),y=r*Math.cos(angle)*Math.sin(config.waveTilt),z=r*Math.sin(angle);
  return [x*Math.cos(p)+z*Math.sin(p),y,-x*Math.sin(p)+z*Math.cos(p)];
}
// User pauses and hidden tabs freeze simulation time rather than skipping a trip.
export function createRideClock({canStart=()=>true}={}) {
  let seconds=0, last=null;
  const sample=now=>{finite(now,'clock');if(last!==null){seconds+=Math.max(0,now-last)/1000;last=Math.max(last,now);}return seconds;};
  return {sample,start(now){finite(now,'clock');if(!canStart())return false;sample(now);last=now;return true;},pause(now){sample(now);last=null;},
    seek(value,now){finite(value,'seek');finite(now,'clock');if(value<0)throw new Error('Negative seek');seconds=value;if(last!==null)last=now;},
    get playing(){return last!==null;}};
}
