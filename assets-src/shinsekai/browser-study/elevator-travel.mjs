// Geometric containment along a well axis, not a structural/collision certification.
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const vector=(a,name)=>{if(!Array.isArray(a)||a.length!==3||!a.every(Number.isFinite))throw new Error('Invalid '+name);};
export function safeElevatorTravel({bottom,top,bodyOffsets,clearance=0.05}) {
  vector(bottom,'bottom');vector(top,'top');
  if(!Number.isFinite(clearance)||clearance<0||!Array.isArray(bodyOffsets)||bodyOffsets.length<2)throw new Error('Invalid containment inputs');
  bodyOffsets.forEach(v=>vector(v,'body corner'));
  const span=top.map((v,i)=>v-bottom[i]),length=Math.hypot(...span);
  if(!(length>0))throw new Error('Degenerate well axis');
  const axis=span.map(v=>v/length),offsets=bodyOffsets.map(v=>dot(v,axis));
  const minOffset=Math.min(...offsets),maxOffset=Math.max(...offsets);
  const low=clearance-minOffset,high=length-clearance-maxOffset;
  if(!(high>low))throw new Error('Car does not fit between well limits');
  return {bottom:bottom.slice(),axis,length,low,high,minOffset,maxOffset,clearance,
    point(fraction){if(!Number.isFinite(fraction)||fraction<0||fraction>1)throw new Error('Invalid travel fraction');const s=low+(high-low)*fraction;return bottom.map((v,i)=>v+axis[i]*s);}};
}
