const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),base='https://japantimeatlas.com';
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pages=['index.html','ja.html','ko.html','zh-cn.html','zh-tw.html','th.html'];
test('six language entry pages have reciprocal crawlable, canonical URLs',()=>{
 const urls=['/','/ja','/ko','/zh-cn','/zh-tw','/th'];
 pages.forEach((p,i)=>{const s=read(p);assert.ok(s.includes('rel="canonical" href="'+base+urls[i]+'"'));for(const u of urls)assert.ok(s.includes('href="'+base+u+'"'),p+' '+u);assert.equal((s.match(/hreflang=/g)||[]).length,7);assert.ok(!s.includes('hiddenjapan.workers.dev'));});
});
test('canonical remains on the custom domain when the app runs on workers.dev or a preview',()=>{
 const source=read('explore.js'),code=/const SEO = [\s\S]*?\nfunction applySEO\(\)\{[\s\S]*?\n\}/.exec(source)[0];
 for(const origin of [base,'https://japan-then-and-now.hiddenjapan.workers.dev','http://localhost:8765'])for(const LANG of ['en','ja','ko','zh-Hans','zh-Hant']){
  const attributes={};const document={title:'',getElementById:id=>({setAttribute:(k,v)=>attributes[id+':'+k]=v})};
  vm.runInNewContext(code+'\napplySEO();',{document,LANG,location:{origin,pathname:'/explore.html'}});
  assert.equal(attributes['canonicalUrl:href'],base+'/');assert.equal(attributes['ogUrl:content'],base+'/');assert.ok(document.title.includes('Japan Time Atlas'));
 }
});
test('sitemap contains unique existing canonical pages and new guides',()=>{
 const urls=[...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);assert.equal(new Set(urls).size,urls.length);
 for(const url of urls){assert.ok(url.startsWith(base+'/'));const route=new URL(url).pathname;assert.ok(!route.endsWith('.html'));assert.ok(fs.existsSync(path.join(root,route==='/'?'index.html':route.slice(1)+'.html')),route);}
 assert.ok(urls.includes(base+'/th'));assert.equal(urls.filter(u=>u.includes('/guides/')).length,3);
});
test('old hostname remains enabled alongside both custom hostnames',()=>{
 const config=JSON.parse(read('wrangler.jsonc'));assert.equal(config.workers_dev,true);assert.deepEqual(config.routes.map(x=>x.pattern),['japantimeatlas.com','www.japantimeatlas.com']);
});
