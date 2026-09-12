const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const router=require('../affiliate-router.js'),published=require('../affiliate-config.json');
// Test generic local/fallback behavior separately from the published size restriction.
const config={...published,klook:{...published.klook,topTwoOnly:false,smallRadiusKm:undefined}};
const now=Date.parse('2026-09-12T12:00:00Z'),langs=['en','ja','ko','zh-Hans','zh-Hant','th'];
test('all 47 prefectures generate localized regional links with bounded source tags',()=>{
 assert.equal(config.klook.prefectures.length,47);assert.equal(new Set(config.klook.prefectures.map(p=>p.code)).size,47);
 const tags=new Set();
 for(const pref of config.klook.prefectures)for(const lang of langs){
  const ad=router.regional(config,{at:[35,135]},lang,{country_code:'jp','ISO3166-2-lvl4':pref.code,state:pref.ja});assert.ok(ad);
  const url=new URL(ad.url);assert.equal(url.hostname,'affiliate.klook.com');assert.equal(url.searchParams.get('aid'),'134890');
  assert.equal(url.searchParams.get('aff_label2'),pref.code);assert.equal([...url.searchParams.keys()].at(-1),'k_site');
  const target=new URL(url.searchParams.get('k_site'));assert.equal(target.hostname,'www.klook.com');assert.ok(target.pathname.endsWith('/search/result/'));assert.ok(target.searchParams.get('query').includes(lang==='ja'?pref.ja:pref.en));
  tags.add([1,2,3].map(i=>url.searchParams.get('aff_label'+i)).join('|'));
 }
 assert.equal(tags.size,47);
});
test('every reviewed product yields a valid product link in all UI languages',()=>{
 assert.equal(new Set(config.offers.map(o=>o.productId)).size,config.offers.length);
 for(const item of config.offers)for(const lang of langs){
  const ad=router.select({...config,offers:[item]},{at:item.at,name:item.names.ja},lang,now);assert.ok(ad,item.id+' '+lang);
  const u=new URL(ad.url),target=new URL(u.searchParams.get('k_site'));assert.equal(u.searchParams.get('aff_label3'),item.productId);assert.ok(target.pathname.endsWith('/activity/'+item.productId+'/'));
 }
});
test('nearby attractions follow the opened point; named attraction beats a nearby alternative',()=>{
 assert.equal(router.select(config,{at:[38.2601,140.8824],name:'仙台駅'},'ja',now).productId,'116919');
 assert.equal(router.select(config,{at:[35.2506,139.1544],name:'小田原城'},'ja',now).productId,'76575');
 assert.equal(router.select(config,{at:[36.375,140.47],name:'弘道館'},'en',now).productId,'152953');
 assert.equal(router.select(config,{at:[33.56,133.53],name:'高知城'},'ja',now),null);
 const ad=router.regional(config,{at:[33.56,133.53]},'ja',{country_code:'jp',state:'高知県',city:'高知市'});
 assert.ok(new URL(new URL(ad.url).searchParams.get('k_site')).searchParams.get('query').includes('高知市'));
});
test('unknown location, foreign addresses, invalid IDs and memorials do not get unrelated ads',()=>{
 for(const address of [{country_code:'in',state:'Kochi'},{country_code:'jp',state:'unknown'},null])assert.equal(router.regional(config,{at:[35,135]},'en',address),null);
 assert.equal(router.regional(config,{at:[35,135],kind:'memorial'},'ja',{country_code:'jp',state:'東京都'}),null);
 assert.equal(router.trackedURL(config,'https://www.klook.com.evil.test/','JP-13','search'),null);
 assert.equal(router.trackedURL({...config,klook:{affiliateId:'bad'}},'https://www.klook.com/','JP-13','search'),null);
});
test('a slow previous lookup cannot overwrite a newer place or language',async()=>{
 const resolve=router.createResolver(),c={...config,offers:[]},paint=[];let finish;
 const old=resolve(c,{at:[35,135]},'en',()=>new Promise(r=>finish=r),ad=>paint.push(ad));
 await resolve(c,{at:[33.56,133.53]},'ja',async()=>({country_code:'jp',state:'高知県'}),ad=>paint.push(ad));
 finish({country_code:'jp',state:'東京都'});await old;
 assert.equal(paint.filter(Boolean).length,1);assert.equal(paint.at(-1).prefecture,'JP-39');assert.ok(paint.at(-1).label.includes('高知'));
 const pending=resolve(c,{at:[35,135]},'en',()=>new Promise(r=>finish=r),ad=>paint.push(ad));
 await resolve(c,{at:[35,135],kind:'memorial'},'en',async()=>{},ad=>paint.push(ad));finish({country_code:'jp',state:'東京都'});await pending;assert.equal(paint.at(-1),null);
});
test('actual map entry pages put one ad after the source and before the about link',()=>{
 for(const f of ['index.html','explore.html']){const s=fs.readFileSync(path.join(__dirname,'..',f),'utf8');assert.equal((s.match(/id="pAff"/g)||[]).length,1);assert.ok(s.indexOf('id="pSrc"')<s.indexOf('id="pAff"'));assert.ok(s.indexOf('id="pAff"')<s.indexOf('class="panel-about"'));assert.ok(s.indexOf('src="affiliate-router.js')<s.indexOf('src="explore.js'));}
});
test('all actual top-two marker sizes, including Aneyoshi, get the closest listed product',()=>{
 const featured=require('../data/places-world.json').places.map(p=>({...p,adTier:p.pop||1}));
 const landmarks=[...require('../data/landmarks.json').landmarks,...require('../data/regional-landmarks-v1.json').landmarks].map(p=>({...p,adTier:p.pop||3}));
 const places=[...featured,...landmarks].filter(p=>p.adTier<=2);assert.ok(places.some(p=>p.id==='aneyoshi'));
 for(const p of places){const at=[p.lat,p.lon],minimum=Math.min(...config.offers.map(o=>router.distance(at,o.at)));
  for(const lang of langs){const ad=router.select(published,{at,name:p.name,adTier:p.adTier,kind:p.id==='aneyoshi'?'memorial':''},lang,now);assert.ok(ad,p.id+' '+lang);assert.ok(ad.nearest);assert.ok(Math.abs(ad.km-minimum)<0.00001,p.id);}
 }
 const js=fs.readFileSync(path.join(__dirname,'../explore.js'),'utf8');assert.ok(js.includes('adTier:p.pop||1'));assert.ok(js.includes('adTier:p.pop||3'));
});
