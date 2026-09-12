const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),router=require('../affiliate-router.js'),config=require('../affiliate-config.json');
test('all top-two pins and verified hubs use the official GYG inventory without a fixed product whitelist',()=>{
 const markers=[...require('../data/landmarks.json').landmarks,...require('../data/regional-landmarks-v1.json').landmarks].filter(p=>p.pop<=2);
 for(const p of markers){const o=router.getYourGuide(config,{at:[p.lat,p.lon],adTier:p.pop},'ja');assert.ok(o?.widget,p.ja);assert.equal(o.provider,'getyourguide');assert.equal(o.partnerId,'BHO3FAQ');assert.ok(!o.productId);}
 const airport=router.getYourGuide(config,{at:[35.77,140.39],adTier:4,travelTags:{aeroway:'aerodrome',iata:'NRT'}},'en');assert.equal(airport.international,true);assert.deepEqual(airport.at,config.klook.tourRegions.find(r=>r.id==='tokyo').at);
 for(const p of [{at:[35.681,139.767],travelTags:{railway:'station',highspeed:'yes'}},{at:[34.6687,135.5013],name:'道頓堀'}])assert.ok(router.getYourGuide(config,{...p,adTier:4},'ja'));
});
test('ordinary small pins preserve one-mile rules, disabled configuration and foreign coordinates do not load GYG',()=>{
 const p={at:[35.7,139.7],adTier:4};for(const adTier of [3,4])assert.equal(router.getYourGuide(config,{...p,adTier},'ja'),null);
 for(const x of [{...p,adTier:1,skipGyg:true},{...p,adTier:1,at:[0,0]},{...p,adTier:1,at:[NaN,139]}])assert.equal(router.getYourGuide(config,x,'ja'),null);
 assert.equal(router.getYourGuide({...config,getyourguide:{enabled:false}},{...p,adTier:1},'ja'),null);
 for(const [lang,locale] of Object.entries({ja:'ja-JP',en:'en-US',ko:'ko-KR','zh-Hans':'zh-CN','zh-Hant':'zh-TW'}))assert.equal(router.getYourGuide(config,{...p,adTier:1},lang).locale,locale);
 assert.equal(router.getYourGuide(config,{...p,adTier:1},'th'),null);
});
test('GYG has same-point priority over all Klook choices and provider labels stay accurate',async()=>{
 const p={at:config.offers[0].at,adTier:1},out=[];
 await router.createResolver()(config,p,'ja',async()=>{throw Error('not needed');},o=>out.push(o));assert.equal(out.length,1);assert.equal(out[0].provider,'getyourguide');
 assert.match(router.providerCopy('ja','getyourguide').ad,/GetYourGuide/);assert.doesNotMatch(router.providerCopy('ja','getyourguide').cta,/Klook/);assert.match(router.providerCopy('ja','klook').ad,/Klook/);
});
test('widget uses portal-generated parameters, one item and scoped analyzer installation',()=>{
 const js=fs.readFileSync(require.resolve('../gyg-widget.js'),'utf8'),html=fs.readFileSync(require.resolve('../gyg-frame.html'),'utf8');
 for(const token of ['data-gyg-lat','data-gyg-lon','data-gyg-cmp','data-gyg-partner-id','https://widget.getyourguide.com/dist/pa.umd.production.min.js'])assert.ok(js.includes(token));
 assert.ok(js.includes("'data-gyg-number-of-items':'1'"));assert.match(html,/noindex,nofollow/);
 for(const file of ['index.html','explore.html'])assert.ok(!fs.readFileSync(require.resolve('../'+file),'utf8').includes('pa.umd.production.min.js'),'only the visible advert frame initializes the provider');
});
