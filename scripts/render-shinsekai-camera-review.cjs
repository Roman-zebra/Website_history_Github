/* Local research review. Embeds protected crops ONLY in an output outside the repository. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {projectPoint,projectLine,residual}=require('./shinsekai-camera.cjs');
const {geometry,cameras,readInputs,scenarioObservation,floorAnchor}=require('./profile-shinsekai-camera.cjs');
const root=path.resolve(__dirname,'..'),workspace=path.dirname(root);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function jpegSize(bytes) {
  if(bytes[0]!==255||bytes[1]!==216)throw new Error('Expected JPEG');
  for(let i=2;i<bytes.length;) {
    if(bytes[i++]!==255)throw new Error('Invalid JPEG marker');
    while(bytes[i]===255)i++;
    const marker=bytes[i++];
    if(marker===217||marker===218)break;
    const length=bytes.readUInt16BE(i);
    if(length<2||i+length>bytes.length)throw new Error('Invalid JPEG segment');
    if([192,193,194].includes(marker))return [bytes.readUInt16BE(i+5),bytes.readUInt16BE(i+3)];
    i+=length;
  }
  throw new Error('JPEG dimensions missing');
}
function prediction(camera,o,anchor) {
  if(o.type==='point')return projectPoint(camera,anchor.world).pixel;
  if(o.type==='edge-sample') {
    const [a,b,c]=projectLine(camera,anchor.origin,anchor.direction);
    if(Math.abs(a)<1e-9)throw new Error('No unique edge x');
    return [-(b*o.y+c)/a,o.y]; // Same row; never invent a world Z.
  }
  if(o.type==='line') {
    const [a,b,c]=projectLine(camera,anchor.origin,anchor.direction),d=a*o.x+b*o.y+c;
    return [o.x-a*d,o.y-b*d]; // Orthogonal residual, matching the solver's line semantics.
  }
  throw new Error('Unsupported bound review type');
}
function lineSegment([a,b,c],[x,y,w,h]) {
  const points=[];
  const add=(px,py)=>{if(px>=x-1e-7&&px<=x+w+1e-7&&py>=y-1e-7&&py<=y+h+1e-7&&!points.some(p=>Math.hypot(p[0]-px,p[1]-py)<1e-7))points.push([px,py]);};
  if(Math.abs(b)>1e-10)for(const px of [x,x+w])add(px,-(a*px+c)/b);
  if(Math.abs(a)>1e-10)for(const py of [y,y+h])add(-(b*py+c)/a,py);
  return points.length===2?points:null;
}
function outsideRepo(output) {
  const absolute=path.resolve(output),relative=path.relative(root,absolute);
  if(!relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('Protected review output must be outside repository');
  // Resolve the existing parent too, rejecting symlink/junction destinations into the repo.
  const realParent=fs.realpathSync(path.dirname(absolute)),realRoot=fs.realpathSync(root),realRel=path.relative(realRoot,realParent);
  if(realRel===''||(!realRel.startsWith('..'+path.sep)&&!path.isAbsolute(realRel)))throw new Error('Output parent resolves inside repository');
  if(fs.existsSync(absolute)&&fs.lstatSync(absolute).isSymbolicLink())throw new Error('Output cannot be a link');
  return absolute;
}
function render(result,imagePaths) {
  if(result.status!=='conditional-profile-not-historical-measurement')throw new Error('Not a conditional profile');
  const scenario=result.scenario,inputs=readInputs(scenario);
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/shinsekai/research/photo-inputs-v2.json')));
  const images=Object.fromEntries(Object.entries(imagePaths).map(([photo,file])=>{
    const bytes=fs.readFileSync(file),view=manifest.views[photo];
    if(!view||JSON.stringify(jpegSize(bytes))!==JSON.stringify(view.crop.sizePx))throw new Error('Crop dimensions disagree: '+photo);
    return [photo,'data:image/jpeg;base64,'+bytes.toString('base64')];
  }));
  const profiles=result.results.map(r=>{
    const anchors=geometry(r.parameters,r.heightM,scenario),north=cameras(r.parameters,['plate46','viewA']);
    const southCosts=r.south.starts.map(s=>s.cost),bestSouth=southCosts.indexOf(Math.min(...southCosts));
    const cams={...north,...cameras(r.south.cameras[bestSouth],['south_c0234001'])};
    const cards=Object.keys(images).map(photo=>{
      const view=manifest.views[photo],{offsetPx:[x,y],sizePx:[w,h]}=view.crop,rect=[x,y,w,h],unit=w/450;
      const marks=[],table=[];
      const dot=(p,color,title,hollow=false)=>`<circle cx="${p[0]}" cy="${p[1]}" r="${3.5*unit}" fill="${hollow?'none':color}" stroke="${color}" stroke-width="${1.6*unit}"><title>${esc(title)}</title></circle>`;
      for(const raw of inputs.observations.filter(o=>o.photo===photo)) {
        if(!(raw.id in scenario.bindings)||(!scenario.includeFarCrown&&raw.id==='plate46:6')) {
          if(raw.x!==null&&raw.y!==null)marks.push(dot([raw.x,raw.y],'#a8a8a8',raw.id+' excluded: '+(scenario.exclusions[raw.id]||'scenario disabled'),true));
          continue;
        }
        const o=scenarioObservation(raw,scenario),anchor=anchors[scenario.bindings[o.id]],p=prediction(cams[photo],o,anchor);
        const role=photo==='south_c0234001'?(scenario.southHoldoutIds.includes(o.id)?'south prediction':'south calibration'):(scenario.northHoldoutIds.includes(o.id)?'north holdout':'training');
        const color=role.includes('prediction')||role.includes('holdout')?'#fb923c':'#38bdf8';
        marks.push(`<path d="M ${o.x} ${o.y} L ${p[0]} ${p[1]}" stroke="${color}" stroke-width="${1.3*unit}"/>`,dot([o.x,o.y],'#facc15',o.id+' observed'),dot(p,color,o.id+' projected '+role,true));
        if(o.type==='line') {
          const p2=prediction(cams[photo],{...o,x:o.x2,y:o.y2},anchor),clip=lineSegment(projectLine(cams[photo],anchor.origin,anchor.direction),rect);
          if(clip)marks.push(`<path d="M ${clip[0].join(' ')} L ${clip[1].join(' ')}" stroke="${color}" stroke-width="${unit}"/>`);
          marks.push(dot([o.x2,o.y2],'#facc15',o.id+' observed second endpoint'),dot(p2,color,o.id+' projected second endpoint',true));
        }
        if(o.y!==raw.y)marks.push(dot([raw.x,raw.y],'#a8a8a8',o.id+' original v2 reading; profile uses declared refined y',true));
        const px=residual(cams[photo],o,anchor).pixels;
        table.push(`<tr><td>${esc(o.id)}</td><td>${esc(o.feature)}</td><td>${esc(role)}</td><td>${px.map(v=>v.toFixed(2)).join(', ')}</td></tr>`);
      }
      const floorSamples=inputs.floor.filter(o=>o.photo===photo),floorLines={};
      for(const name of new Set(floorSamples.map(o=>floorAnchor(o,scenario)))) {
        const anchor=anchors[name],l=projectLine(cams[photo],anchor.origin,anchor.direction),segment=lineSegment(l,rect);floorLines[name]=l;
        if(segment)marks.push(`<path d="M ${segment[0].join(' ')} L ${segment[1].join(' ')}" stroke="#38bdf8" stroke-width="${1.5*unit}" stroke-dasharray="${6*unit} ${4*unit}"><title>${esc(name)}</title></path>`);
      }
      for(const o of floorSamples) {
        marks.push(dot([o.x,o.y],'#facc15',o.id+' visible floor sample'));
        const name=floorAnchor(o,scenario),[a,b,c]=floorLines[name];table.push(`<tr><td>${o.id}</td><td>${esc(name)}</td><td>floor calibration</td><td>${(a*o.x+b*o.y+c).toFixed(2)}</td></tr>`);
      }
      return `<article><h3>${esc(photo)}</h3><svg role="img" aria-label="${esc(photo)} observed and projected anchors" viewBox="${rect.join(' ')}"><image href="${images[photo]}" x="${x}" y="${y}" width="${w}" height="${h}"/>${marks.join('')}</svg><details><summary>Residuals in original pixels</summary><table><thead><tr><th>ID</th><th>Feature</th><th>Role</th><th>Residual</th></tr></thead><tbody>${table.join('')}</tbody></table></details></article>`;
    }).join('');
    return `<section id="h${r.heightM}"><h2>Conditional height ${r.heightM} m</h2><p>${esc(scenario.heightLabelsM?.[r.heightM]||'Chosen comparison scenario; not a measured height')}. Coping thickness: ${r.parameters.copingThickness?.toFixed(3)||'not modelled'} m (conditional). North convergence: ${r.best.converged}; bounds: ${esc(r.best.boundHits.join(', '))}; joint rank ${r.heightDiagnostics.rank}/${r.heightDiagnostics.parameterCount}. South camera start ${bestSouth+1} selected only by base-calibration cost; other starts retained in raw JSON.</p><div class="cards">${cards}</div></section>`;
  }).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Conditional tower photo review</title><style>body{font:16px system-ui;background:#10151d;color:#e5e7eb;margin:24px}h1{font-size:28px}p{max-width:1100px;line-height:1.5}a{color:#7dd3fc;margin-right:20px}section{border-top:1px solid #374151;margin-top:32px;padding-top:12px}.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}article{min-width:0}svg{width:100%;height:580px;background:#1f2937}table{border-collapse:collapse;font-size:12px;width:100%}td,th{padding:5px;border-bottom:1px solid #374151;text-align:left}summary{cursor:pointer;padding:12px 0}@media(max-width:850px){.cards{grid-template-columns:1fr}svg{height:560px}}</style><h1>Conditional tower photo review</h1><p>Local research only. These are projected sparse model anchors, not a rendered GLB silhouette or a historical height measurement. Roof-fixed scale ambiguity, chosen bounds and failed south predictions remain unresolved. Protected north crops must stay outside Git and the published site.</p><p><span style="color:#facc15">● observed</span> · <span style="color:#38bdf8">○ training/calibration prediction</span> · <span style="color:#fb923c">○ withheld prediction</span> · <span style="color:#a8a8a8">○ excluded raw reading</span>. South crown uses the declared y=54 apex alternative; the raw y=50 point remains grey. Floor residuals are perpendicular distances; edge residuals compare x at the observed row.</p><nav>${result.results.map(r=>`<a href="#h${r.heightM}">${r.heightM} m scenario</a>`).join('')}</nav>${profiles}</html>`;
}
function serve(file,port=18766) {
  const body=fs.readFileSync(file);
  return http.createServer((req,res)=>{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
    if(req.url!=='/'&&req.url!=='/review.html'){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Length':body.length});res.end(req.method==='HEAD'?undefined:body);
  }).listen(port,'127.0.0.1',function(){console.log(`Local research review: http://127.0.0.1:${this.address().port}/review.html`);});
}
if(require.main===module) {
  const args=process.argv.slice(2),output=outsideRepo(args[1]||path.join(workspace,'research-cache/camera-review-v1.html'));
  const result=JSON.parse(fs.readFileSync(args[0]||path.join(workspace,'research-cache/camera-profile-v1-reviewed.json')));
  const imagePaths={plate46:path.join(workspace,'refs-claude/ndl-public/p46_photo.jpg'),viewA:path.join(workspace,'refs-claude/ndl-public/A_full.jpg'),south_c0234001:path.join(root,'assets-src/shinsekai/references/oml/c0234001.jpg')};
  fs.writeFileSync(output,render(result,imagePaths));console.log('Saved local review: '+output);
  if(args.includes('--serve'))serve(output);
}
module.exports={jpegSize,prediction,lineSegment,outsideRepo,render,serve};
