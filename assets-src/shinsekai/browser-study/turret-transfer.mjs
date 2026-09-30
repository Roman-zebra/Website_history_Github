// Invented switchback layout in one selected turret; coordinates are study assumptions.
export function createTurretTransfer({roofFloor,groundFloor=0,turretX=-12.3,turretZ=10.8,flights=7,stepsPerFlight=12,landingZ=1.9452}) {
 if(![roofFloor,groundFloor,turretX,turretZ,landingZ].every(Number.isFinite)||roofFloor<=groundFloor||!Number.isInteger(flights)||flights<1||!Number.isInteger(stepsPerFlight)||stepsPerFlight<2)throw new Error('Invalid stair parameters');
 const flightRise=(roofFloor-groundFloor)/flights,rise=flightRise/stepsPerFlight,tread=3/stepsPerFlight;
 if(flightRise-.12<1.82||rise>.21||tread<.24)throw new Error('Assumed stair clearance does not fit');
 const steps=[];let exit;
 for(let f=0;f<flights;f++){const direction=f%2===0?1:-1,x=turretX+(f%2===0?-.65:.65);
  for(let i=0;i<stepsPerFlight;i++)steps.push({size:[1,rise,tread],position:[x,groundFloor+f*flightRise+(i+.5)*rise,turretZ+direction*(-1.5+(i+.5)*tread)],kind:'step'});
  const y=groundFloor+(f+1)*flightRise,z=turretZ+direction*1.775;
  steps.push({size:[2.3,.12,.55],position:[turretX,y-.06,z],kind:'landing'});exit=[x,z];
 }
 const points=[exit,[turretX,turretZ],[turretX,3],[0,3],[0,landingZ]];
 const walkway=points.slice(1).map((p,i)=>{const a=points[i],dx=p[0]-a[0],dz=p[1]-a[1];return {centre:[(p[0]+a[0])/2,roofFloor-.06,(p[1]+a[1])/2],length:Math.hypot(dx,dz),yaw:Math.atan2(dx,dz),from:a,to:p};});
 return {steps,walkway,rise,tread,flightRise,roofFloor,selectedTurret:'southwest (assumed)',status:'schematic; not historical geometry or collision certification'};
}
