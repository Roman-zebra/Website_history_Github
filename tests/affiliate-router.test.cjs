const test=require('node:test'),assert=require('node:assert/strict'),router=require('../affiliate-router.js');
const now=Date.parse('2026-09-12T12:00:00Z');
const place={placeId:'tokyo',at:[35.7148,139.7967]};
const offer={id:'asakusa',provider:'viator',url:'https://www.viator.com/tours/Tokyo/example',enabled:true,at:place.at,radiusKm:2,reviewedOn:'2026-09-12',labels:{en:'Walk around Asakusa',ja:'浅草を歩く'},languages:['en','ja'],priority:0};
const config=(offers=[offer])=>({enabled:true,offers});
test('no account/disabled config, unrelated places and unsupported languages show no advert',()=>{
 assert.equal(router.select({...config(),enabled:false},place,'en',now),null);
 assert.equal(router.select(config(),{at:[34.99,135.77]},'en',now),null);
 assert.equal(router.select(config(),place,'ko',now),null);
 assert.equal(router.select(config(),{at:[NaN,139]},'en',now),null);
});
test('opening another place selects its local offer, never the previous result',()=>{
 const kyoto={...offer,id:'kyoto',at:[34.99,135.77],labels:{en:'Walk in Kyoto'}};const c=config([offer,kyoto]);
 assert.equal(router.select(c,place,'en',now).id,'asakusa');
 assert.equal(router.select(c,{at:kyoto.at},'en',now).id,'kyoto');
 assert.equal(router.select(c,{at:[43,141]},'en',now),null);
});
test('exact-place relevance wins; disclosure language follows the reader',()=>{
 const specific={...offer,id:'specific',placeIds:['tokyo'],priority:-10};
 assert.equal(router.select(config([offer,specific]),place,'ja',now).id,'specific');
 assert.equal(router.select(config(),place,'ja',now).label,'浅草を歩く');
 assert.equal(router.select(config([specific]),{...place,placeId:'other'},'en',now),null);
});
test('memorials, expired and stale listings are excluded even with valid tracking URLs',()=>{
 for(const kind of ['lore','memorial'])assert.equal(router.select(config(),{...place,kind},'en',now),null);
 for(const patch of [{expiresOn:'2026-09-11'},{reviewedOn:'2025-01-01'},{reviewedOn:'2030-01-01'},{reviewedOn:''},{radiusKm:999}])assert.equal(router.select(config([{...offer,...patch}]),place,'en',now),null);
});
test('URLs reject scripts, fake provider domains and unapproved redirect hosts',()=>{
 for(const url of ['javascript:alert(1)','https://viator.com.example.org/','https://tracker.example/offer','http://www.viator.com/'])assert.equal(router.select(config([{...offer,url}]),place,'en',now),null);
 const c=config([{...offer,url:'https://tracker.example/offer'}]);c.approvedRedirectHosts={viator:['tracker.example']};assert.ok(router.select(c,place,'en',now));
});
