// Native Blender4.5.10 Blackbody2350K, Linear Rec.709; private probe receipt.
export const HALL_LAMP_2350K=Object.freeze([2.1790616512298584,.7413240075111389,.1008404791355133]);
const expected=Object.freeze(['light_desklamp_a','light_pend10_17','light_pend13_17','light_pend1_17','light_pend4_17','light_pend7_17','light_sconceE4','light_sconceE6','light_sconceW1','light_sconceW3','light_sconceW5']);
const emitting=new Set(['bulb','lamp_milk']);
const luminance=rgb=>rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
export function hallLampColour(rgb){
 if(!Array.isArray(rgb)||rgb.length!==3||rgb.some(v=>!Number.isFinite(v)||v<0)||luminance(rgb)<=0)throw new Error('Invalid measured lamp colour');
 const scale=luminance(rgb)/luminance(HALL_LAMP_2350K);return HALL_LAMP_2350K.map(v=>v*scale);
}

// Temporary emitter assignments and point-colour snapshots; source stays reusable.
export function createHallLampLook(model,{mode='colour',pointGain=1,pointRange=0,createMaterial=source=>source.clone()}={}){
 if(!['control','colour'].includes(mode)||typeof createMaterial!=='function'||![1,.7,.5,.35].includes(pointGain)||![0,4,5,6].includes(pointRange)||(mode==='control'&&(pointGain!==1||pointRange!==0)))throw new Error('Invalid hall lamp comparison');
 const assignments=[],sources=new Set(),points=[];
 model.scene.traverse(object=>{
  if(object.isPointLight){const canonical=expected.find(name=>object.name.startsWith(name)&&/^(?:_?\d+)?$/.test(object.name.slice(name.length)));const colour=object.color.toArray();points.push({object,canonical,colour,candidate:hallLampColour(colour),intensity:object.intensity,distance:object.distance,decay:object.decay});}
  if(!object.isMesh)return;
  const originals=Array.isArray(object.material)?object.material:[object.material];
  if(!originals.some(material=>emitting.has(material?.name)))return;
  assignments.push({object,original:object.material});for(const material of originals)if(emitting.has(material?.name))sources.add(material);
 });
 if(points.length!==11||new Set(points.map(p=>p.canonical)).size!==11||points.some(p=>!p.canonical||!Number.isFinite(p.intensity)||p.intensity<=0||!Number.isFinite(p.distance)||!Number.isFinite(p.decay))||sources.size!==6||[...emitting].some(name=>[...sources].filter(source=>source.name===name).length!==3))throw new Error('Expected eleven measured points and six hall emitter materials');
 const copies=new Map();
 try{for(const source of sources){const rgb=source.emissive.toArray(),candidate=hallLampColour(rgb),copy=createMaterial(source);if(!copy||copy===source)throw new Error('Emitter copy must have independent ownership');copies.set(source,copy);if(copy.emissive===source.emissive)throw new Error('Emitter colour must have independent ownership');if(mode==='colour')copy.emissive.fromArray(candidate);}}
 catch(error){for(const copy of copies.values())copy.dispose();throw error;}
 if(mode==='colour')for(const point of points){point.object.color.fromArray(point.candidate);point.object.intensity=point.intensity*pointGain;if(pointRange!==0)point.object.distance=pointRange;}
 for(const {object,original}of assignments)object.material=Array.isArray(original)?original.map(source=>copies.get(source)??source):copies.get(original);
 let disposed=false;
 return {stats:{mode,kelvin:mode==='colour'?2350:null,pointGain,pointRange,points:points.length,materials:copies.size,meshes:assignments.length,luminanceMatched:true,intensityAndRangePreserved:pointGain===1&&pointRange===0,distanceAndDecayPreserved:pointRange===0,decayPreserved:true,newTextures:0,geometryChanged:false,inferred:true,visualAcceptance:false,pointColours:points.map(p=>({name:p.object.name,source:p.colour,candidate:mode==='colour'?p.candidate:p.colour,sourceIntensity:p.intensity,intensity:p.object.intensity,sourceDistance:p.distance,distance:p.object.distance,decay:p.decay})),emission:[...copies].map(([source,copy])=>({name:source.name,source:source.emissive.toArray(),candidate:copy.emissive.toArray(),strength:copy.emissiveIntensity}))},dispose(){if(disposed)return;disposed=true;for(const point of points){point.object.color.fromArray(point.colour);point.object.intensity=point.intensity;point.object.distance=point.distance;}for(const {object,original}of assignments)object.material=original;for(const copy of copies.values())copy.dispose();}};
}
