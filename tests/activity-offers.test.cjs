const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const router=require('../affiliate-router.js'),config=require('../affiliate-config.json'),UI=require('../place-ui.js');
const root=path.resolve(__dirname,'..'),now=Date.parse('2026-09-12T12:00:00Z'),dataContext={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'activities-data.js'),'utf8'),dataContext);
const places=Array.from(dataContext.window.AtlasActivities.places);
const panel=p=>({placeId:'a-'+p.id,kind:p.category,at:[p.lat,p.lon],name:p.name,ja:p.ja});
const fresh=()=>{const c=structuredClone(config);for(const o of c.klook.activityOffers){o.reviewedOn=new Date(Date.now()-86400000).toISOString();delete o.expiresOn;}return c;};
test('all 36 food/shopping destinations have one explicit Klook product in all five interface languages',()=>{
 const offers=config.klook.activityOffers,ids=offers.flatMap(o=>o.placeIds);
 assert.equal(offers.length,34);assert.equal(ids.length,36);assert.equal(new Set(ids).size,36);
 assert.deepEqual([...ids].sort(),places.map(p=>'a-'+p.id).sort());
 for(const p of places)for(const lang of UI.langs){
  const ad=router.resolveOffer(config,panel(p),lang,now);assert.ok(ad,p.id+' '+lang);assert.ok(ad.activity);assert.ok(ad.placeIds.includes('a-'+p.id));assert.equal(ad.km,undefined);assert.equal(router.getYourGuide(config,panel(p),lang),null);
  assert.equal(ad.label,ad.names[lang]);assert.equal(ad.note,ad.notes[lang]);
  const u=new URL(ad.url),destination=new URL(u.searchParams.get('k_site'));
  assert.equal(u.hostname,'affiliate.klook.com');assert.equal(u.searchParams.get('aid'),'134890');assert.equal(u.searchParams.get('aff_label1'),'jta_map');assert.equal(u.searchParams.get('aff_label2'),ad.prefecture);assert.equal(u.searchParams.get('aff_label3'),ad.productId);
  assert.equal([...u.searchParams.keys()].at(-1),'k_site');assert.equal(destination.hostname,'www.klook.com');assert.ok(destination.pathname.endsWith('/activity/'+ad.productId+'/'));assert.equal(new URL(ad.source).hostname,'www.klook.com');
 }
});
test('unreviewed, expired, disabled, invalid and unknown activity offers never become unrelated ads',()=>{
 const p=panel(places.find(p=>p.id==='nijo-market')),selected=config.klook.activityOffers.find(o=>o.placeIds.includes(p.placeId));
 for(const patch of [{enabled:false},{productId:'bad'},{reviewedOn:'2020-01-01'},{reviewedOn:'2027-01-01'},{reviewedOn:'bad'},{expiresOn:'2026-09-11'},{prefecture:'JP-99'},{names:{en:'Only English'}},{placeIds:['a-unknown']}]){
  const c={...config,klook:{...config.klook,activityOffers:[{...selected,...patch}]}};
  assert.equal(router.resolveOffer(c,p,'ja',now),null,JSON.stringify(patch));
 }
 assert.equal(router.resolveOffer({...config,enabled:false},p,'en',now),null);
 assert.equal(router.resolveOffer(config,{...p,placeId:'a-unknown',adTier:1,travelTags:{railway:'station',operator:'JR'}},'en',now),null);
 assert.equal(router.regional(config,p,'en',{country_code:'jp',state:'Hokkaido'}),null);
 assert.equal(router.select(config,p,'en',now),null);
 const coupon=config.klook.activityOffers.find(o=>o.productId==='149059');assert.ok(coupon.expiresOn);
 assert.equal(router.activity(config,panel(places.find(p=>p.id==='tenjin-shopping')),'ja',Date.parse(coupon.expiresOn)),null);
});
test('a previous regional lookup cannot replace a new activity card and unmatched activities skip geocoding',async()=>{
 const resolve=router.createResolver(),c=fresh(),paints=[];c.getyourguide.enabled=false;let finish;
 const older=resolve({...c,offers:[]},{at:[35,135],adTier:1},'en',()=>new Promise(r=>finish=r),o=>paints.push(o));
 await resolve(c,panel(places[0]),'ja',()=>{throw Error('Unexpected activity geocode');},o=>paints.push(o));
 const current=paints.at(-1);assert.ok(current.activity);finish({country_code:'jp',state:'東京都'});await older;assert.equal(paints.at(-1),current);
 let lookups=0;await resolve(c,{...panel(places[0]),placeId:'a-unknown',adTier:1},'ja',async()=>{lookups++;return {};},o=>paints.push(o));assert.equal(lookups,0);assert.equal(paints.at(-1),null);
});
function runtime(){
 const elements=new Map(),element=()=>({children:[],textContent:'',innerHTML:'',hidden:true,dataset:{},style:{},attrs:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},setAttribute(k,v){this.attrs[k]=v;},append(...els){this.children.push(...els);},replaceChildren(...els){this.children=els;},addEventListener(){},querySelectorAll(){return [];}});
 const ctx={AffiliateRouter:router,PlaceUI:UI,URL,URLSearchParams,Map,Set,console,AbortSignal,setTimeout(){},clearTimeout(){},requestAnimationFrame(){},navigator:{languages:['en']},location:{search:'',pathname:'/',origin:'https://example.com',href:'https://example.com/',hash:''},history:{pushState(){},replaceState(){}},localStorage:{getItem(){return null;},setItem(){}},document:{documentElement:{},body:{classList:element().classList},getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){}},window:{innerWidth:390,addEventListener(){}},L:{divIcon:o=>o},fetch:async()=>{throw Error('Unexpected network');}};
 ctx.ResizeObserver=class{observe(){}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'activities-data.js'),'utf8'),ctx);const js=fs.readFileSync(path.join(root,'explore.js'),'utf8');vm.runInContext(js.slice(0,js.indexOf('LANG = detectLang();')),ctx);
 const run=s=>vm.runInContext(s,ctx);ctx.config=fresh();ctx.mapStub={setView(){},invalidateSize(){}};
 run('map=mapStub;ensureMap=()=>{};drawDetail=()=>{};drawGygPins=()=>{};drawSpots=()=>{};setThenLayer=()=>{};facilityTags=()=>({});panelShell=o=>{ $("place").hidden=false;renderAffiliate(o); };');
 return {ctx,run,elements};
}
test('real activity panel metadata renders translated disclosed ads and refreshes after late config loading',()=>{
 const {ctx,run,elements}=runtime();ctx.id='nijo-market';run('LANG="ja";showActivity(ACTIVITIES.find(p=>p.id===id));');assert.equal(elements.get('pAff').hidden,true);
 run('setAffiliateConfig(config);');assert.equal(elements.get('pAff').hidden,false);
 for(const lang of UI.langs)for(const p of places){ctx.id=p.id;ctx.lang=lang;run('LANG=lang;showActivity(ACTIVITIES.find(p=>p.id===id));');
  const box=elements.get('pAff'),ad=config.klook.activityOffers.find(o=>o.placeIds.includes('a-'+p.id));assert.equal(box.hidden,false);
  const link=box.children.find(e=>e.className==='aff-card');assert.equal(link.dataset.offerId,ad.id);assert.equal(link.children[0].textContent,ad.names[lang]);assert.equal(link.rel,'sponsored nofollow noopener');assert.equal(box.children.find(e=>e.className==='aff-note').textContent,ad.notes[lang]);assert.ok(box.children.find(e=>e.className==='aff-disclosure').textContent);
 }
 run('closePlace();');const children=elements.get('pAff').children;run('setAffiliateConfig(config);');assert.equal(elements.get('place').hidden,true);assert.equal(elements.get('pAff').children,children);
});
