// Camera-volume boarding schematic; not an accepted historical interior.
const finite=(v,name)=>{if(!Number.isFinite(v))throw new Error('Invalid '+name);};
const smooth=u=>u*u*u*(10+u*(-15+6*u));
export function nextLandingTime(time,travel,dwell) {
 for(const [name,v] of Object.entries({time,travel,dwell}))finite(v,name);
 if(time<0||travel<=0||dwell<=0)throw new Error('Invalid docking timing');
 const cycle=2*(travel+dwell),base=Math.floor(time/cycle)*cycle,upper=base+dwell+travel;
 return time<upper?upper:base+cycle;
}
export function dockedStation(schedule) {
 if(!schedule||!Number.isFinite(schedule.fraction)||!Number.isFinite(schedule.velocity))return null;
 if(schedule.velocity!==0||!['departing-end dwell','arrival-end dwell'].includes(schedule.phase))return null;
 return schedule.fraction===0?0:schedule.fraction===1?1:null;
}
export function createRideAccess({stops,width,depth,height,landingEnabled=[true,true],floorThickness=.08,eyeHeight=1.6,radius=.18,margin=.04,duration=1.25}) {
 if(!Array.isArray(landingEnabled)||landingEnabled.length!==2||!landingEnabled.every(v=>typeof v==='boolean')||!landingEnabled[0])throw new Error('Invalid landing availability');
 if(!Array.isArray(stops)||stops.length!==2||!stops.every(Number.isFinite)||(landingEnabled[1]?stops[1]<=stops[0]:stops[1]!==stops[0]))throw new Error('Invalid stops');
 for(const [name,v] of Object.entries({width,depth,height,floorThickness,eyeHeight,radius,margin,duration}))finite(v,name);
 // 5cm corner posts and 8cm floor/ceiling are assumed schematic thicknesses.
 if(radius<=0||margin<0||duration<=0||floorThickness<=0||eyeHeight<=radius||width<=2*(radius+margin+.05)||depth<=2*(radius+margin+.05)||height<=eyeHeight+radius+margin+floorThickness+.08)throw new Error('Camera volume does not fit');
 const floorOffset=-height/2+floorThickness,landingZ=depth/2+1.5;
 let mode='landing',station=0,elapsed=0;
 const reset=(at=0)=>{if((at!==0&&at!==1)||!landingEnabled[at])throw new Error('Invalid landing');mode='landing';station=at;elapsed=0;};
 return {duration,floorOffset,landingZ,
  get mode(){return mode;},get station(){return station;},get transitioning(){return mode==='boarding'||mode==='exiting';},
  canBoard(schedule){return mode==='landing'&&landingEnabled[station]&&dockedStation(schedule)===station;},
  canExit(schedule){const at=dockedStation(schedule);return mode==='riding'&&at!==null&&landingEnabled[at];},
  board(schedule){if(!this.canBoard(schedule))return false;mode='boarding';elapsed=0;return true;},
  exit(schedule){if(!this.canExit(schedule))return false;station=dockedStation(schedule);mode='exiting';elapsed=0;return true;},
  advance(seconds){finite(seconds,'transition delta');if(seconds<0)throw new Error('Negative transition delta');if(!this.transitioning)return;elapsed=Math.min(duration,elapsed+seconds);if(elapsed===duration){mode=mode==='boarding'?'riding':'landing';elapsed=0;}},
  pose(carHeight,look=0){finite(carHeight,'car height');finite(look,'look angle');if(carHeight<stops[0]-1e-6||carHeight>stops[1]+1e-6)throw new Error('Car outside stops');
   if(this.transitioning&&Math.abs(carHeight-stops[station])>1e-6)throw new Error('Car moved during crossing');
   const u=this.transitioning?smooth(elapsed/duration):0;
   const landing=mode==='landing',riding=mode==='riding',boarding=mode==='boarding';
   const progress=landing?0:riding?1:boarding?u:1-u;
   // Stationary during crossing; camera remains on the centre of the open doorway.
   const y=(riding?carHeight:stops[station])+floorOffset+eyeHeight;
   return {position:[0,y,landingZ*(1-progress)],yaw:Math.PI*(1-progress)+Math.max(-Math.PI/3,Math.min(Math.PI/3,look))*progress,progress};
  },reset
 };
}
