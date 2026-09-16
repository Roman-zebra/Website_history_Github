/* Every spot the map shows has a crawlable page in each language its data covers, linked both ways. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),has=p=>fs.existsSync(path.join(root,p));
const base='https://japantimeatlas.com';
const src=read('activities-data.js'),activities=JSON.parse(src.slice(src.indexOf('{'),src.lastIndexOf('}')+1)).places;
const liminal=JSON.parse(read('data/liminal.json')).places,landmarks=JSON.parse(read('data/landmarks.json')).landmarks;
const DIRS={en:'',ja:'ja/',ko:'ko/','zh-Hans':'zh-cn/','zh-Hant':'zh-tw/'},LANGS=Object.keys(DIRS);
const sitemap=new Set([...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]));
const mKeys=fs.readdirSync(path.join(root,'place')).filter(f=>/^m-.+\.html$/.test(f)).map(f=>f.slice(0,-5));
const keys=[...activities.map(a=>'a-'+a.id),...liminal.map(p=>'l-'+p.id),...mKeys];

test('36 food and shopping spots, 26 liminal places and 34 landmarks each have five language pages',()=>{
 assert.equal(activities.length,36);assert.equal(liminal.length,26);assert.equal(mKeys.length,landmarks.length);
 for(const k of keys)for(const l of LANGS){const f='place/'+DIRS[l]+k+'.html';assert.ok(has(f),f+' is missing');}
});

test('each page names itself as canonical, lists all five languages plus x-default, and is in the sitemap',()=>{
 for(const k of keys)for(const l of LANGS){
  const url='/place/'+DIRS[l]+k,html=read(url.slice(1)+'.html');
  assert.ok(html.includes('<link rel="canonical" href="'+base+url+'">'),url+' canonical');
  for(const x of LANGS)assert.ok(html.includes('hreflang="'+x+'" href="'+base+'/place/'+DIRS[x]+k+'"'),url+' hreflang '+x);
  assert.ok(html.includes('hreflang="x-default" href="'+base+'/place/'+k+'"'),url+' x-default');
  assert.equal((html.match(/rel="canonical"/g)||[]).length,1,url+' one canonical');
  assert.ok(sitemap.has(base+url),url+' not in sitemap');
  assert.ok(/<title>[^<]+\| Japan Time Atlas<\/title>/.test(html),url+' title carries the site name');
  assert.ok(html.includes('og:site_name'),url+' og:site_name');
 }
});

test('generated pages are written in their own language and carry the page language',()=>{
 for(const k of keys.filter(k=>k.startsWith('a-')||true))for(const l of ['ja','ko','zh-Hans','zh-Hant']){
  const html=read('place/'+DIRS[l]+k+'.html');
  assert.ok(html.startsWith('<!doctype html>\n<html lang="'+l+'">'),k+' '+l+' lang');
  const h1=/<h1>([^<]+)<\/h1>/.exec(html)[1];
  const script={ja:/[\u3040-\u30ff\u4e00-\u9fff]/,ko:/[\uac00-\ud7af]/,'zh-Hans':/[\u4e00-\u9fff]/,'zh-Hant':/[\u4e00-\u9fff]/}[l];
  assert.match(h1,script,k+' '+l+' heading is not in '+l);
 }
});

test('liminal pages carry the do-not-enter note in every language',()=>{
 for(const p of liminal)for(const l of ['ja','ko','zh-Hans','zh-Hant'])assert.ok(read('place/'+DIRS[l]+'l-'+p.id+'.html').includes('class="caution"'),p.id+' '+l);
});

test('the English liminal and landmark pages point at their translations',()=>{
 for(const k of keys.filter(k=>!k.startsWith('a-'))){
  const html=read('place/'+k+'.html');
  for(const l of ['ja','ko','zh-Hans','zh-Hant'])assert.ok(html.includes('hreflang="'+l+'" href="'+base+'/place/'+DIRS[l]+k+'"'),k+' hreflang '+l);
  assert.ok(!/href="\/(ja|ko|zh-cn|zh-tw)" lang=/.test(html),k+' language nav still points at the home pages');
 }
});

test('every generated page is reachable: the language home pages and /places list them',()=>{
 for(const [l,file] of [['ja','ja.html'],['ko','ko.html'],['zh-Hans','zh-cn.html'],['zh-Hant','zh-tw.html']]){
  const html=read(file);
  for(const k of keys)assert.ok(html.includes('href="/place/'+DIRS[l]+k+'"'),file+' does not link '+k);
  assert.ok(!/href="\/place\/l-/.test(html),file+' still sends readers to the English liminal pages');
  assert.equal((html.match(/<!--SPOT-LISTS-->/g)||[]).length,1,file+' lists written once');
 }
 const places=read('places.html');
 for(const a of activities)assert.ok(places.includes('href="/place/a-'+a.id+'"'),'/places does not link a-'+a.id);
});

test('the home page tells search engines the site name',()=>{
 const html=read('index.html'),m=/<script type="application\/ld\+json" id="site-ld">(.*?)<\/script>/.exec(html);
 assert.ok(m,'WebSite structured data');const o=JSON.parse(m[1]);
 assert.equal(o['@type'],'WebSite');assert.equal(o.name,'Japan Time Atlas');assert.equal(o.url,base+'/');
 assert.ok(o.alternateName.includes('日本の今昔マップ'));
 assert.ok(html.includes('<meta property="og:site_name" content="Japan Time Atlas">'));
});
