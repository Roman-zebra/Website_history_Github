const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const router=require('../affiliate-router.js'),config=require('../affiliate-config.json'),now=Date.parse('2026-09-12T12:00:00Z');
const p=(at,t={},name='')=>({at,adTier:4,travelTags:t,name});
test('regional tours match service-verified stations, downtown identities and explicitly assigned airports',()=>{
 for(const [id,at] of [['tokyo',[35.6812,139.767]],['hiroshima',[34.3985,132.475]],['nagoya',[35.171,136.882]],['kanazawa',[36.578,136.648]],['fukuoka',[33.59,130.42]]]){
  const choices=router.tours(config,p(at,{railway:'station',highspeed:'yes'}),'ja',now);assert.ok(choices.some(o=>o.regions.includes(id)),id);
  assert.equal(router.tours(config,p(at,{railway:'station',operator:'JR'}),'ja',now).length,0,'ordinary station');
 }
 const airport=p([35.772,140.393],{aeroway:'aerodrome',iata:'NRT'});
 assert.equal(router.tours(config,airport,'ja',now)[0].productId,'75806');
 assert.match(router.tours(config,airport,'en',now)[0].note,/not a pickup/);
 assert.equal(router.tours(config,p([35.7,139.7],{aeroway:'aerodrome',iata:'XXX'}),'ja',now).length,0);
 assert.equal(router.tours(config,p([34.6687,135.5013],{},'道頓堀'),'ja',now)[0].productId,'16167');
 for(const place of [p([35.685,139.71],{},'新宿御苑'),p([43,141],{},'道頓堀'),p([35.68,139.77],{tourism:'museum'})])assert.equal(router.tours(config,place,'ja',now).length,0);
});
test('tour validity and tracking checks do not invent venue distance or current availability',()=>{
 const airport=p([35.55,139.78],{aeroway:'aerodrome',iata:'HND'});
 for(const lang of ['ja','en','ko','zh-Hans','zh-Hant']){
  const o=router.tours(config,airport,lang,now)[0];assert.equal(o.km,undefined);assert.ok(o.note);assert.equal(new URL(o.url).searchParams.get('aid'),'134890');assert.equal(new URL(o.url).searchParams.get('aff_label3'),o.productId);
 }
 for(const patch of [{enabled:false},{commissionPercent:0},{reviewedOn:'2020-01-01'},{reviewedOn:'2030-01-01'},{productId:'javascript:1'},{expiresOn:'2026-01-01'}]){
  const c={...config,klook:{...config.klook,tourOffers:config.klook.tourOffers.map(o=>({...o,...patch}))}};assert.equal(router.tours(c,airport,'en',now).length,0);
 }
});
test('rotation preserves refreshes, alternates openings and leaves ordinary small markers within one mile',()=>{
 const r=router.createRotation();assert.equal(r.index('HND',1),0);assert.equal(r.index('HND',1),0);assert.equal(r.index('HND',2),1);assert.equal(r.next('HND'),2);assert.equal(r.index('HND',2),2);assert.equal(r.index('HND',3),3);
 const airport=p([35.55,139.78],{aeroway:'aerodrome',iata:'HND'}),choices=router.offerChoices(config,airport,'ja',now);assert.ok(choices.some(o=>o.tour));assert.ok(choices.some(o=>o.match==='esim'));
 assert.equal(new Set(choices.map(o=>o.id)).size,choices.length);
 const ordinary=p([35.55,139.78],{tourism:'museum'});assert.equal(router.offerChoices(config,ordinary,'ja',now).length,0);
});
test('all tour catalog entries have real sources, reviewed commissions and localized departure notices',()=>{
 assert.equal(config.klook.tourOffers.length,8);
 for(const o of config.klook.tourOffers){assert.match(o.source,new RegExp('/'+o.productId+'-'));assert.equal(o.commissionPercent,5);for(const lang of ['ja','en','ko','zh-Hans','zh-Hant'])assert.ok(o.names[lang]&&o.notes[lang]);}
 for(const r of config.klook.tourRegions)assert.match(r.coordSource,/openstreetmap\.org\/(node|way)\/\d+$/);
});
test('real departure station records with missing service tags still receive their regional tour',()=>{
 const idx=require('../data/facilities-index-v1.json'),all=idx.files.flatMap(f=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data',f))));
 for(const name of ['東京駅','京都駅','新大阪駅','名古屋駅','金沢駅','広島駅','博多駅']){
  const station=all.find(x=>x.tags.name===name);assert.ok(station);assert.ok(router.tours(config,p([station.lat,station.lon],station.tags,name),'ja',now).length,name);
 }
 assert.equal(router.tours(config,p([35.171,136.882],{},'名古屋駅'),'ja',now).length,0,'station tag is required');
});
