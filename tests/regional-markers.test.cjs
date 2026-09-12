const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const config=require('../affiliate-config.json'),router=require('../affiliate-router.js'),regional=require('../data/regional-landmarks-v1.json').landmarks;
const old=require('../data/landmarks.json').landmarks,featured=require('../data/places-world.json').places;
test('regional additions cover all 47 prefectures and have verifiable place coordinates',()=>{
 assert.equal(new Set(regional.map(p=>p.prefecture)).size,47);assert.ok(regional.length>=90);assert.equal(new Set(regional.map(p=>p.id)).size,regional.length);
 for(const p of regional){assert.equal(p.pop,2);assert.equal(p.tier,2);assert.ok(p.lat>=24&&p.lat<=46&&p.lon>=122&&p.lon<=146,p.ja);assert.ok(p.wiki_ja);assert.ok(!p.views);assert.match(p.coordSource,/^https:\/\/(ja.wikipedia.org\/wiki\/|www.openstreetmap.org\/(node|way)\/)/);assert.ok(p.sizeSource.includes('not a pageview rank'));}
 assert.equal([...featured,...old,...regional].filter(p=>(p.pop||3)<=2).length,128);
});
test('expanded products resolve to their physical locality and stay close to major Tokyo spots',()=>{
 assert.ok(config.offers.length>=90);
 for(const [name,at,id] of [['Tokyo Tower',[35.658611,139.745556],'4911'],['Tokyo Skytree',[35.7101,139.8107],'41352']]){const ad=router.select(config,{at,name,adTier:2},'en');assert.equal(ad.productId,id);assert.ok(ad.km<0.2);}
 const js=fs.readFileSync(path.join(__dirname,'../explore.js'),'utf8');assert.ok(js.includes("Promise.all(['data/landmarks.json','data/regional-landmarks-v1.json']"));assert.ok(js.includes('lists.flatMap(l => l?.landmarks || [])'));
});
