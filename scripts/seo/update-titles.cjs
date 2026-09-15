/* Once a week: keep or change the title of each Gunkanjima 3D page (see titles.cjs for the rules).
     node scripts/seo/update-titles.cjs [--gsc .seo-cache/gsc-3d.json] [--today YYYY-MM-DD] [--dry-run]
   Writes scripts/seo/state-3d.json; then build-3d-pages.cjs puts the chosen titles into the pages.
   The log names candidates and reasons, never search terms, and impressions only in broad bands. */
const fs=require('node:fs');
const seo=require('./titles.cjs');
const arg=name=>{const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:null;};
const today=arg('--today')||new Date().toISOString().slice(0,10),gscFile=arg('--gsc'),dry=process.argv.includes('--dry-run');
const candidates=seo.loadCandidates(),problems=seo.validate(candidates);
if(problems.length){console.error('Candidates need fixing:\n'+problems.join('\n'));process.exit(1);}
const gsc=gscFile&&fs.existsSync(gscFile)?JSON.parse(fs.readFileSync(gscFile,'utf8')):null;
const state=seo.loadState();
const {state:next,decisions}=seo.decide({candidates,state,gsc,suggest:seo.loadSuggestions(),today});
const band=n=>n<100?'under 100':n<1000?'100-999':n<10000?'1,000-9,999':'10,000+';
for(const d of decisions)console.log(d.lang+': '+(d.action==='keep'?'keep '+d.from:d.action+' '+d.from+' -> '+d.to)+' | basis: '+(d.basis||'none')+(gsc?' | impressions: '+band(d.impressions):'')+' | '+d.reason);
const changed=decisions.filter(d=>d.action!=='keep');
if(!dry&&JSON.stringify(next)!==JSON.stringify(state))seo.saveState(next);
if(process.env.GITHUB_OUTPUT){
 fs.appendFileSync(process.env.GITHUB_OUTPUT,'changed='+(changed.length>0)+'\n'+'urls='+changed.map(d=>d.url).join(' ')+'\n'+'summary='+(changed.map(d=>d.lang+' '+d.to).join(', ')||'none')+'\n');
}
console.log(changed.length?changed.length+' page(s) change'+(dry?' (dry run, nothing written)':''):'no change');
