// Versioned authoring interface. Heights are source-relative or assumed, not surveyed.
export function readLiftLandings(raw) {
 const data=typeof raw==='string'?JSON.parse(raw):raw;
 if(!data||data.schemaVersion!==1||!Array.isArray(data.landings)||data.landings.length!==2)throw new Error('Missing landing interface');
 const [roof,top]=data.landings,{car,well,pivots,structure}=data;
 const finite=(v,name)=>{if(!Number.isFinite(v))throw new Error('Invalid '+name);};
 finite(roof.floor,'roof floor');for(const k of ['height','width','depth','floorThickness'])finite(car?.[k],'car '+k);
 finite(well?.bottom,'well bottom');finite(well?.clearance,'clearance');finite(pivots?.bottom,'lower pivot');
 if(car.height<=0||car.width<=0||car.depth<=0||car.floorThickness<=0||car.floorThickness>=car.height||well.clearance<0)throw new Error('Invalid car envelope');
 const floorOffset=car.floorThickness-car.height/2,near=(a,b)=>Math.abs(a-b)<=1e-5;
 if(!near(pivots.bottom+floorOffset,roof.floor)||!near(well.bottom,pivots.bottom-car.height/2-well.clearance))throw new Error('Lower landing mismatch');
 const canTravel=top.floor!==null;
 if(canTravel){finite(top.floor,'upper floor');finite(pivots.top,'upper pivot');finite(well.top,'well top');finite(structure?.headTop,'head top');
  if(top.floor<=roof.floor||!near(pivots.top+floorOffset,top.floor)||!near(well.top,pivots.top+car.height/2+well.clearance)||well.top>structure.headTop+1e-5)throw new Error('Upper landing/head mismatch');
 }else if(pivots.top!==null||well.top!==null)throw new Error('Unresolved upper must not have a travel stop');
 return {data,car,floors:[roof.floor,top.floor],floorOffset,canTravel,stops:[pivots.bottom,canTravel?pivots.top:pivots.bottom],landingEnabled:[true,canTravel]};
}
