const test=require('node:test'),assert=require('node:assert/strict'),router=require('../affiliate-router.js'),config=require('../affiliate-config.json');
const base=config.offers[0],at=[35,139],destination=km=>[35+km/6371*180/Math.PI,139];
const offer=(id,km)=>({...base,id,productId:id,at:destination(km),radiusKm:25,aliases:[],reviewedOn:'2026-09-12'});
test('sizes 3 and 4 use the closest product only inside one international mile',()=>{
 const cfg={...config,offers:[offer('1',1.609343),offer('2',1.609345)]};
 for(const adTier of [3,4]){assert.equal(router.select(cfg,{at,adTier},'ja').productId,'1');assert.equal(router.select({...cfg,offers:[cfg.offers[1]]},{at,adTier},'ja'),null);}
 for(const adTier of [1,2])assert.equal(router.select({...cfg,offers:[offer('3',100)]},{at,adTier},'ja').productId,'3');
});
test('small points get neither a distant prefecture fallback nor an unrelated offer',async()=>{
 const cfg={...config,offers:[]};let lookups=0,published;
 await router.createResolver()(cfg,{at,adTier:4},'ja',async()=>{lookups++;return {country_code:'jp',state:'東京都'};},ad=>published=ad);
 assert.equal(lookups,0);assert.equal(published,null);
 assert.equal(router.regional(cfg,{at,adTier:3},'ja',{country_code:'jp',state:'東京都'}),null);
});
