const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {urlFor,announce}=require('../scripts/seo/changed-urls.cjs');
const sitemap=fs.readFileSync(path.join(__dirname,'..','sitemap.xml'),'utf8');

test('a changed page becomes its canonical URL',()=>{
 assert.equal(urlFor('index.html'),'https://japantimeatlas.com/');
 assert.equal(urlFor('ja.html'),'https://japantimeatlas.com/ja');
 assert.equal(urlFor('place/ja/hiroshima.html'),'https://japantimeatlas.com/place/ja/hiroshima');
 assert.equal(urlFor('3d/ja/gunkanjima.html'),'https://japantimeatlas.com/3d/ja/gunkanjima');
 assert.equal(urlFor('3d/index.html'),'https://japantimeatlas.com/3d/');
 for(const f of ['explore.js','design.css','data/liminal.json','tests/walking.test.cjs','scripts/build.cjs','dist/index.html'])
  assert.equal(urlFor(f),null,f+' should not be announced');
});

test('only pages the sitemap lists are announced, without repeats',()=>{
 const urls=announce(['index.html','index.html','3d/ja/gunkanjima.html','place/hiroshima.html','explore.js','3d/nothing-here.html'],sitemap);
 assert.deepEqual(urls,['https://japantimeatlas.com/','https://japantimeatlas.com/3d/ja/gunkanjima','https://japantimeatlas.com/place/hiroshima']);
});

test('every 3D page in the sitemap can be produced from its file',()=>{
 for(const lang of ['','ja/','ko/','zh-cn/','zh-tw/'])
  assert.ok(announce(['3d/'+lang+'gunkanjima.html'],sitemap).length===1,lang+' 3D page is not announceable');
});

const {waitForRelease}=require('../scripts/seo/after-deploy.cjs');
const quiet=()=>{},noSleep=async()=>{};
const reply=(status,body)=>async()=>({ok:status===200,status,json:async()=>body});

test('a runner that cannot read release.json announces after the blind wait instead of timing out',async()=>{
 let calls=0;
 const state=await waitForRelease('abc1234def',{fetchImpl:async()=>{calls++;return reply(403,null)();},sleepImpl:noSleep,log:quiet});
 assert.equal(state,'unreadable');
 assert.equal(calls,6,'about three minutes of 30-second tries, not the full twenty');
});

test('a readable release.json that names an older commit keeps the job waiting, then gives up quietly',async()=>{
 const state=await waitForRelease('new0000',{fetchImpl:reply(200,{commit:'old0000'}),sleepImpl:noSleep,attempts:12,log:quiet});
 assert.equal(state,'timeout');
});

test('the new commit going live is seen as soon as release.json names it',async()=>{
 let n=0;
 const state=await waitForRelease('new0000',{fetchImpl:async()=>reply(200,{commit:++n<3?'old0000':'new0000'})(),sleepImpl:noSleep,log:quiet});
 assert.equal(state,'live');
 assert.equal(n,3);
});

test('a network error on the first tries does not count as readable',async()=>{
 const state=await waitForRelease('x',{fetchImpl:async()=>{throw new TypeError('fetch failed');},sleepImpl:noSleep,log:quiet});
 assert.equal(state,'unreadable');
});
