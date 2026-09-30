'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {parseCsv,readLandmarks,projectLine,residual}=require('./shinsekai-camera.cjs');
const {multiStart,jacobian,spectrum}=require('./shinsekai-least-squares.cjs');
const {audit}=require('./audit-shinsekai-photos.cjs');
const directory=path.resolve(__dirname,'../docs/shinsekai/research');
const point=world=>({kind:'point',world}),line=(origin,direction)=>({kind:'line',origin,direction});
function geometry(g,H,scenario) {
  const W=g.width,L=g.depth,T=g.turretWidth,A=g.archCrown,F=g.archFeet,R=scenario.roofM;
  const crown=H-g.rodLength,top=crown-g.crownHeight,bottom=top-g.galleryHeight;
  if(!(W>g.archSpan && T<W/2 && F<A && A<R && bottom>g.domeTop)) return null;
  const anchors={earlyTip:point([0,(0.5-scenario.shaftSetbackFraction)*L,H]),earlyCrown:point([0,(0.5-scenario.shaftSetbackFraction)*L,crown]),
    earlyGalleryTop:point([0,(0.5-scenario.shaftSetbackFraction)*L,top]),earlyGalleryBottom:point([0,(0.5-scenario.shaftSetbackFraction)*L,bottom])};
  for(const [face,sign] of [['north',1],['south',-1]]) {
    const y=sign*L/2;
    anchors[face+'ArchCrown']=point([0,y,A]);anchors[face+'ArchOuter']=point([0,y,A+scenario.outerArchOffsetM]);
    anchors[face+'Floor']=line([-W/2,y,R],[1,0,0]);
    for(const [side,xsign] of [['E',1],['W',-1]]) {
      anchors[face+'ArchFoot'+side]=point([xsign*g.archSpan/2,y,F]);
      anchors[face+'Dome'+side]=point([xsign*(W-T)/2,sign*(L-T)/2,g.domeTop]);
      anchors[face+'Edge'+side]=line([xsign*W/2,y,0],[0,0,1]);
    }
  }
  return anchors;
}
function cameraSpecs(photo) {
  const south=photo==='south_c0234001', cx=south?180:photo==='plate46'?1262:2500,cy=south?300:1840;
  const p=(name,lower,upper,scale,initial)=>({name:photo+'.'+name,lower,upper,scale,initial});
  return [p('east',-80,80,30,0),p('distance',30,250,70,south?60:photo==='plate46'?50:75),p('eye',0.5,25,5,south?12:2),
    p('heading',(south?0:Math.PI)-0.5,(south?0:Math.PI)+0.5,0.2,south?0:Math.PI),p('pitch',-0.3,0.4,0.1,0.01),
    p('roll',-0.12,0.12,0.04,south?0.015:photo==='viewA'?0.036:0),p('focal',south?60:400,south?1500:5000,south?300:1400,south?280:photo==='plate46'?1100:1200),
    p('cx',cx-(south?100:500),cx+(south?100:500),south?100:500,cx),p('cy',cy-(south?250:900),cy+(south?300:900),south?150:500,cy)];
}
function cameras(parameters,photos) {
  return Object.fromEntries(photos.map(photo=>{
    const get=name=>parameters[photo+'.'+name],south=photo==='south_c0234001';
    return [photo,{centre:[get('east'),get('distance')*(south?-1:1),get('eye')],heading:get('heading'),pitch:get('pitch'),roll:get('roll'),focalPx:get('focal'),principalPx:[get('cx'),get('cy')]}];
  }));
}
function readInputs(scenario) {
  audit();
  const manifest=JSON.parse(fs.readFileSync(path.join(directory,'photo-inputs-v2.json')));
  const observations=readLandmarks(fs.readFileSync(path.join(directory,manifest.landmarks.file),'utf8'),manifest.views);
  const floorBytes=fs.readFileSync(path.join(directory,'floor-line-samples-claude.csv'));
  if(crypto.createHash('sha256').update(floorBytes).digest('hex')!==scenario.floorSourceSha256) throw new Error('Floor snapshot hash mismatch');
  const rows=parseCsv(floorBytes.toString('utf8'));
  const expected=['version','photo','source','original_px','feature','side','x_orig','y_orig','tol_x','tol_y','visibility','method','notes'];
  if(JSON.stringify(rows[0])!==JSON.stringify(expected)) throw new Error('Unknown floor schema');
  const floor=rows.slice(1).map((row,i)=>{
    if(row.length!==expected.length) throw new Error('Malformed floor CSV');
    const o=Object.fromEntries(expected.map((key,j)=>[key,row[j]])),view=manifest.views[o.photo];
    if(o.version!=='fl1'||!view||o.original_px!==view.originalPx.join('x')||!o.visibility.startsWith('visible')) throw new Error('Unverified floor sample identity');
    const [x,y,tx,ty]=[o.x_orig,o.y_orig,o.tol_x,o.tol_y].map(Number);
    if(![x,y,tx,ty].every(Number.isFinite)||tx<=0||ty<=0||x<0||y<0||x>=view.originalPx[0]||y>=view.originalPx[1]) throw new Error('Invalid floor coordinates/tolerances');
    return {id:'floor:'+i,photo:o.photo,x,y,tx,ty,alternative:o.feature.startsWith('ALT:')};
  }).filter(o=>o.photo!=='viewA'||o.alternative===(scenario.floorVariant==='cornice'));
  const ids=new Set(observations.map(o=>o.id));
  for(const id of Object.keys(scenario.bindings)) if(!ids.has(id)) throw new Error('Binding without observation: '+id);
  for(const o of observations) if(!(o.id in scenario.bindings)&&!(o.id in scenario.exclusions)) throw new Error('Unclassified observation: '+o.id);
  for(const [role,list] of [['northHoldout',scenario.northHoldoutIds],['southCalibration',scenario.southCalibrationIds],['southHoldout',scenario.southHoldoutIds]]) {
    if(new Set(list).size!==list.length) throw new Error('Duplicate role id');
    for(const id of list) if(!(id in scenario.bindings)||id.startsWith('south_')!==role.startsWith('south')) throw new Error('Unknown or wrong-sector role id: '+id);
  }
  if(Object.keys(scenario.bindings).some(id=>id in scenario.exclusions)) throw new Error('Bound observation also excluded');
  for(const id of scenario.northHoldoutIds) if(scenario.southCalibrationIds.includes(id)) throw new Error('Holdout leakage');
  if(scenario.southCalibrationIds.some(id=>scenario.southHoldoutIds.includes(id))) throw new Error('South calibration/prediction must be disjoint');
  return {observations,floor};
}
function scenarioObservation(o) {
  // The raw south point marks finial/rib ends; this profile uses the declared apex-ring alternative.
  return o.id==='south_c0234001:29' ? {...o,y:54} : o;
}
function measurements(anchors,cams,observations,floor,scenario) {
  const rows=[];
  for(const o of observations) {
    if(!(o.id in scenario.bindings)||(!scenario.includeFarCrown&&o.id==='plate46:6')) continue;
    const measurement=scenarioObservation(o);
    const r=residual(cams[o.photo],measurement,anchors[scenario.bindings[o.id]]);
    rows.push({id:o.id,photo:o.photo,pixels:r.pixels,scaled:r.scaled});
  }
  for(const o of floor) {
    const [a,b,c]=projectLine(cams[o.photo],anchors[o.photo==='south_c0234001'?'southFloor':'northFloor'].origin,[1,0,0]);
    const pixel=a*o.x+b*o.y+c,tolerance=Math.hypot(a*o.tx,b*o.ty);
    rows.push({id:o.id,photo:o.photo,pixels:[pixel],scaled:[pixel/tolerance]});
  }
  return rows;
}
function summarise(rows) {
  return Object.fromEntries([...new Set(rows.map(o=>o.photo))].map(photo=>{
    const selected=rows.filter(o=>o.photo===photo),pixels=selected.flatMap(o=>o.pixels),scaled=selected.flatMap(o=>o.scaled);
    return [photo,{components:pixels.length,rmsPx:Math.sqrt(pixels.reduce((sum,x)=>sum+x*x,0)/pixels.length),scaledRms:Math.sqrt(scaled.reduce((sum,x)=>sum+x*x,0)/scaled.length),rows:selected}];
  }));
}
function fitHeight(H,scenario,inputs,options={}) {
  const photos=['plate46','viewA'],specs=[...scenario.geometryParameters,...photos.flatMap(cameraSpecs)];
  const northObs=inputs.observations.filter(o=>photos.includes(o.photo)), northFloor=inputs.floor.filter(o=>photos.includes(o.photo));
  const toParameters=x=>Object.fromEntries(specs.map((s,i)=>[s.name,x[i]]));
  const evaluateRows=(x,height=H)=>{
    const p=toParameters(x),anchors=geometry(p,height,scenario);if(!anchors)return null;
    try{return measurements(anchors,cameras(p,photos),northObs,northFloor,scenario);}catch(e){if(/behind camera|projects to a point|no unique x/.test(e.message))return null;throw e;}
  };
  const trainRows=rows=>rows.filter(o=>!scenario.northHoldoutIds.includes(o.id));
  const fn=x=>{const rows=evaluateRows(x);return rows?trainRows(rows).flatMap(o=>o.scaled):null;};
  const initials=[0.85,1,1.25].map(factor=>specs.map(s=>/\.distance$|\.focal$/.test(s.name)?s.initial*factor:s.initial));
  const fit=multiStart(fn,specs,initials,options),p=toParameters(fit.best.values),rows=evaluateRows(fit.best.values);
  // Fixed-H nuisance rank cannot establish H identifiability. Include the height column explicitly.
  const jointSpecs=[...specs,{name:'earlyTipHeight',lower:50,upper:100,scale:70}],jointQ=[...fit.best.values,H].map((x,i)=>x/jointSpecs[i].scale);
  const jointJ=jacobian(q=>{const x=q.map((v,i)=>v*jointSpecs[i].scale),r=evaluateRows(x.slice(0,-1),x.at(-1));return r?trainRows(r).flatMap(o=>o.scaled):null;},jointQ,jointSpecs.map(s=>[s.lower/s.scale,s.upper/s.scale]));
  const heightDiagnostics=spectrum(jointJ);
  heightDiagnostics.weakModes=heightDiagnostics.weakModes.map(mode=>({...mode,direction:Object.fromEntries(jointSpecs.map((s,i)=>[s.name,mode.direction[i]]))}));
  const anchors=geometry(p,H,scenario),south='south_c0234001',southSpecs=cameraSpecs(south);
  const southRows=x=>{
    const values=Object.fromEntries(southSpecs.map((s,i)=>[s.name,x[i]]));
    try{return measurements(anchors,cameras(values,[south]),inputs.observations.filter(o=>o.photo===south),inputs.floor.filter(o=>o.photo===south),scenario);}catch(e){if(/behind camera|projects to a point|no unique x/.test(e.message))return null;throw e;}
  };
  const calibration=rows=>rows.filter(o=>scenario.southCalibrationIds.includes(o.id)||o.id.startsWith('floor:'));
  const southFit=multiStart(x=>{const r=southRows(x);return r?calibration(r).flatMap(o=>o.scaled):null;},southSpecs,[0.8,1,1.2].map(factor=>southSpecs.map(s=>/\.distance$|\.focal$/.test(s.name)?s.initial*factor:s.initial)),options);
  const predictions=southFit.runs.map(run=>summarise(southRows(run.values).filter(o=>scenario.southHoldoutIds.includes(o.id))));
  const brief=run=>({cost:run.cost,converged:run.converged,reason:run.reason,iterations:run.iterations,boundHits:run.boundHits,rank:run.diagnostics.rank,parameters:run.diagnostics.parameterCount});
  return {heightM:H,parameters:p,training:summarise(trainRows(rows)),northHoldout:summarise(rows.filter(o=>scenario.northHoldoutIds.includes(o.id))),
    best:brief(fit.best),starts:fit.runs.map(brief),diagnostics:fit.best.diagnostics,heightDiagnostics,
    south:{cameraOnlyCalibration:summarise(calibration(southRows(southFit.best.values))),starts:southFit.runs.map(brief),predictions,
      cameras:southFit.runs.map(run=>Object.fromEntries(southSpecs.map((s,i)=>[s.name,run.values[i]]))),gate:'open: compare multiple camera solutions; no default geometry adopted'}};
}
function run(scenario,options) {
  if(scenario.status!=='conditional-research-scenario'||!scenario.heightsM.every(h=>Number.isFinite(h)&&h>scenario.roofM)||!['rail-base','cornice'].includes(scenario.floorVariant)) throw new Error('Invalid scenario');
  const inputs=readInputs(scenario);
  return {status:'conditional-profile-not-historical-measurement',scenario,results:scenario.heightsM.map(H=>fitHeight(H,scenario,inputs,options)),
    gates:{historicalHeight:'open',southPrediction:'open',productionGeometry:'open'},note:'Bounds, near/far correspondence and base/upper model choices determine these conditional results. No confidence intervals or GLB/site updates.'};
}
if(require.main===module) {
  const args=process.argv.slice(2),configFlag=args.indexOf('--scenario'),outFlag=args.indexOf('--output');
  const scenario=JSON.parse(fs.readFileSync(configFlag>=0?args[configFlag+1]:path.join(directory,'camera-scenario-v1.json')));
  const result=run(scenario);
  if(outFlag>=0)fs.writeFileSync(path.resolve(args[outFlag+1]),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result.results.map(r=>({heightM:r.heightM,cost:r.best.cost,converged:r.best.converged,rank:r.best.rank,parameters:r.best.parameters,bounds:r.best.boundHits,
    northHoldout:Object.fromEntries(Object.entries(r.northHoldout).map(([k,v])=>[k,v.rmsPx])),southPredictions:r.south.predictions.map(p=>p.south_c0234001.rmsPx)})),null,2));
}
module.exports={geometry,cameraSpecs,cameras,readInputs,scenarioObservation,measurements,fitHeight,run};
