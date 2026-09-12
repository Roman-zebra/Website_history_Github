const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const router=require('../affiliate-router.js'),config=require('../affiliate-config.json'),idx=require('../data/facilities-index-v1.json');
const facilities=idx.files.flatMap(f=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data',f),'utf8'))),now=Date.parse('2026-09-12T12:00:00Z');
const place=tags=>({at:[35,139],adTier:4,travelTags:tags});
test('eSIM fallback covers verified international airports, not domestic airports or nearby landmarks',()=>{
 const airports=facilities.filter(p=>p.tags.aeroway==='aerodrome');assert.equal(airports.length,32);
 assert.deepEqual(new Set(airports.map(p=>p.tags.iata)),new Set(config.klook.internationalAirports));
 for(const p of airports)assert.equal(router.travel(config,place(p.tags),'ja',now).match,'esim');
 for(const p of [place({aeroway:'aerodrome',iata:'ITM'}),place({iata:'HND'}),place({tourism:'museum'})])assert.equal(router.travel(config,p,'ja',now),null);
});
test('rail fallbacks respect operators, excluding private railways and Toei trams',()=>{
 for(const operator of ['東日本旅客鉄道','JR西日本','Japan Railway Company'])assert.equal(router.travel(config,place({railway:'station',operator}),'ja',now).match,'jr-national');
 for(const operator of ['東京地下鉄','Tokyo Metro'])assert.equal(router.travel(config,place({railway:'station',operator}),'ja',now).match,'tokyo-subway');
 assert.equal(router.travel(config,place({railway:'station',operator:'東京都交通局',station:'subway'}),'en',now).match,'tokyo-subway');
 for(const tags of [{operator:'小田急電鉄'},{operator:'東京都交通局',station:'light_rail',tram:'yes'},{},{website:'https://jreast.co.jp.evil.example/'}])assert.equal(router.travel(config,place({railway:'station',...tags}),'ja',now),null);
 assert.equal(router.travel(config,place({railway:'station',website:'https://www.jreast.co.jp/estation/'}),'en',now).match,'jr-national');
 assert.equal(router.travel(config,place({railway:'station',operator:'JR東日本'}),'ja',now+181*86400000),null);
});
test('nearby physical products take precedence; relevant travel replaces distant station ads at every size',()=>{
 const p=place({railway:'station',operator:'JR東日本'}),base=config.offers[0];
 const near={...base,at:[35.001,139],reviewedOn:'2026-09-12'},far={...near,at:[38,139]};
 for(const adTier of [1,2,3,4]){
  assert.equal(router.resolveOffer({...config,offers:[near]},{...p,adTier},'ja',now).travel,undefined);
  assert.equal(router.resolveOffer({...config,offers:[far]},{...p,adTier},'ja',now).match,'jr-national');
 }
});
test('all facility coordinates are usable and classifications yield real station coverage',()=>{
 assert.equal(facilities.length,9519);for(const p of facilities)assert.ok(Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.tags.name);
 const stations=facilities.filter(p=>p.tags.railway==='station');assert.equal(stations.length,9071);
 const matched=stations.filter(p=>router.travel(config,place(p.tags),'ja',now));
 for(const name of ['東京駅','大阪駅'])assert.ok(matched.some(p=>p.tags.name===name));
 assert.ok(matched.some(p=>p.tags.operator==='東日本旅客鉄道'&&p.tags.highspeed!=='yes'));
 assert.ok(stations.some(p=>!p.tags.operator&&!p.tags.website&&!p.tags['contact:website']&&!p.tags.network&&!router.travel(config,place(p.tags),'ja',now)));
 console.log('Operator-verified rail fallback points: '+matched.length+' of '+stations.length+' station nodes.');
});
test('known zero-commission products cannot displace an eligible physical or travel offer',()=>{
 const base=config.offers[0],p=place({railway:'station',operator:'JR東日本'});
 const zero={...base,enabled:true,at:p.at,commissionPercent:0};
 assert.equal(router.select({...config,offers:[zero]},p,'ja',now),null);
 assert.equal(router.resolveOffer({...config,offers:[zero]},p,'ja',now).match,'jr-national');
 const klook={...config.klook,travelOffers:config.klook.travelOffers.map(o=>({...o,commissionPercent:0}))};
 assert.equal(router.travel({...config,klook},p,'ja',now),null);
});
