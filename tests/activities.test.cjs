const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),UI=require('../place-ui.js');
function runtime(){
 const elements=new Map(),storage=new Map(),events={};
 const element=()=>({textContent:'',innerHTML:'',hidden:true,value:'',dataset:{},attrs:{},style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},setAttribute(k,v){this.attrs[k]=v;},addEventListener(){},querySelector(){return element();},querySelectorAll(){return [...this.innerHTML.matchAll(/data-activity="([^"]+)"/g)].map(m=>{const e=element();e.dataset.activity=m[1];return e;});},focus(){},blur(){},remove(){}});
 const ctx={ResizeObserver:class{observe(){}},PlaceUI:UI,URL,URLSearchParams,Map,Set,console,AbortSignal,Event:class{},setTimeout(){return 1;},clearTimeout(){},requestAnimationFrame(){},navigator:{languages:['en']},location:{search:'',pathname:'/',origin:'https://example.com',href:'https://example.com/',hash:''},history:{pushState(o,x,url){ctx.location.hash=url;},replaceState(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){storage.set(k,v);}},document:{documentElement:{},body:{classList:element().classList},getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){}},window:{innerWidth:390,addEventListener(k,fn){events[k]=fn;}},L:{divIcon:o=>o},fetch:async()=>{throw Error('Unexpected network');}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'activities-data.js'),'utf8'),ctx);
 const source=fs.readFileSync(path.join(root,'explore.js'),'utf8');vm.runInContext(source.slice(0,source.indexOf('LANG = detectLang();')),ctx);
 const run=s=>vm.runInContext(s,ctx);ctx.mapStub={setView(at,z){ctx.view={at,z};},invalidateSize(){}};ctx.capture=o=>ctx.panel=o;
 run('map=mapStub; ensureMap=()=>{}; drawDetail=()=>{}; drawSpots=()=>{}; setThenLayer=()=>{}; panelShell=capture;');
 return {ctx,elements,run,events};
}
test('every activity opens its own localized panel and restores from its share link',()=>{
 const {ctx,run,elements}=runtime();
 for(const lang of UI.langs){ctx.lang=lang;run('LANG=lang;');
  for(const category of ['food','shopping']){ctx.category=category;run('setMode(category);');
   const html=elements.get('cards').innerHTML;assert.equal([...html.matchAll(/data-activity=/g)].length,18);assert.match(elements.get('modeNote').textContent,/18/);
   for(const p of ctx.window.AtlasActivities.places.filter(p=>p.category===category)){
    ctx.id=p.id;assert.ok(html.includes(p.names[lang]));run('openSpot({kind:"activity",p:ACTIVITIES.find(p=>p.id===id)});');
    assert.equal(ctx.panel.name,p.names[lang]);assert.equal(ctx.view.z,15);assert.equal(ctx.panel.at[0],p.lat);assert.ok(ctx.panel.bodyHTML.includes(p.official));
    const url=new URL(UI.spotURL('https://japantimeatlas.com',lang,ctx.panel.at,new URL(ctx.panel.share.url).hash,p.name));
    assert.equal(url.searchParams.get('lang'),lang);ctx.location.hash=url.hash;assert.equal(run('restoreActivity()'),true);assert.equal(ctx.panel.placeId,'a-'+p.id);
   }
  }
 }
 ctx.location.hash='#a-nonexistent';assert.equal(run('restoreActivity()'),false);
});
test('activity names are searchable and saved coordinates reopen the full activity panel',()=>{
 const {ctx,run}=runtime();for(const p of ctx.window.AtlasActivities.places){ctx.id=p.id;
  for(const name of Object.values(p.names)){ctx.query=name;assert.ok(run('searchSpots(query).some(r=>r.kind==="activity"&&r.p.id===id)'),name);}
  ctx.row={lat:p.lat,lon:p.lon,name:p.name};run('showSavedSpot(row);');assert.equal(ctx.panel.placeId,'a-'+p.id);
 }
});
test('new home categories load before the app and remain available when returning from a panel',()=>{
 for(const file of ['index.html','explore.html']){const html=fs.readFileSync(path.join(root,file),'utf8');const data=html.match(/<script[^>]+src="activities-data[^>]+>/)[0];assert.doesNotMatch(data,/defer|async/);assert.ok(html.indexOf(data)<html.indexOf('<script src="explore.js'));for(const id of ['mFood','mShopping'])assert.ok(html.includes('id="'+id+'"'));}
 const {ctx,run,events,elements}=runtime();run('setMode("shopping");');ctx.location.hash='';events.popstate();assert.equal(run('mode'),'shopping');assert.equal(elements.get('home').hidden,false);
});
test('catalog stays bounded, unique and geographically ordered without popularity claims',()=>{
 const {ctx}=runtime(),rows=ctx.window.AtlasActivities.places;assert.equal(new Set(rows.map(p=>p.id)).size,36);
 for(const cat of ['food','shopping']){const list=rows.filter(p=>p.category===cat);assert.equal(list.length,18);list.forEach((p,i)=>{assert.ok(p.lat>24&&p.lat<46&&p.lon>122&&p.lon<146);assert.equal(new URL(p.official).protocol,'https:');assert.ok(!i||list[i-1].lat>=p.lat);});}
});
