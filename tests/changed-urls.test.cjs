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
