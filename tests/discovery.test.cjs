const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const {langs,labels}=require('../scripts/discovery-copy.cjs'),markets=require('../scripts/market-copy.cjs');
const places=JSON.parse(read('data/places-world.json')).places,base='https://japantimeatlas.com';
const route=(p,l)=>'/place/'+(l==='en'?'':labels[l].route+'/')+p.id;
test('all 114 place variants retain the same location and language through every link',()=>{
 for(const p of places)for(const l of langs){const u=route(p,l),s=read(u.slice(1)+'.html');
  assert.ok(s.includes('<html lang="'+l+'">'));assert.ok(s.includes('rel="canonical" href="'+base+u+'"'));
  assert.equal((s.match(/hreflang=/g)||[]).length,7);
  for(const k of langs)assert.ok(s.includes('hreflang="'+k+'" href="'+base+route(p,k)+'"'));
  assert.ok(s.includes('href="/?lang='+(l==='th'?'en':l)+'#'+p.id+'"'));
  assert.equal((s.match(/<h1>/g)||[]).length,1);
  const schema=JSON.parse(s.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);assert.equal(schema['@graph'][0].inLanguage,l);assert.equal(schema['@graph'][0].about.geo.latitude,p.lat);
  assert.ok(!s.includes('undefined'));assert.ok(s.includes(labels[l].coverage)||s.includes(labels[l].none));
 }
});
test('all sitemap routes resolve locally and article links cannot leave broken relative paths',()=>{
 const urls=[...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
 assert.equal(new Set(urls).size,urls.length);assert.equal(urls.length,196);
 for(const url of urls){const route=new URL(url).pathname,p=route==='/'?'index.html':route.slice(1)+'.html',html=read(p);
  assert.ok(html.includes('href="'+url+'"'),p+' canonical');
  for(const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)){
   const link=new URL(match[1].replaceAll('&amp;','&'),url);if(link.origin!==base)continue;
   const target=decodeURIComponent(link.pathname).replace(/^\//,'');if(!target)continue;
   assert.ok([target,target+'.html',target+'/index.html'].some(f=>fs.existsSync(path.join(root,f))),p+' -> '+link.pathname);
  }
 }
});
test('country guides offer distinct notes, working routes, and honest Thai map fallback',()=>{
 assert.equal(markets.length,10);assert.equal(new Set(markets.map(m=>m.intro)).size,10);
 for(const m of markets){const s=read('visit/'+m.id+'.html');assert.ok(s.includes('<html lang="'+m.lang+'">'));for(const id of m.picks)assert.ok(s.includes(route({id},m.lang)));}
 assert.ok(read('visit/th.html').includes(labels.th.maplang));assert.ok(read('visit/hk.html').includes('香港'));assert.ok(read('visit/tw.html').includes('台灣'));
});
test('historical series dates match the chosen layer and unsupported claims are removed',()=>{
 for(const p of places){assert.equal(p.thenLabel,({ort_USA10:'1945–1950',ort_old10:'1961–1969',gazo1:'1974–1978'}[p.then]||null));}
 for(const p of ['index.html','explore.html','ja.html','data/places-world.json','place/hiroshima.html'])assert.ok(!/One building was left standing|たった一つ残った建物/.test(read(p)),p);
});
test('language detection honors ordered preferences and explicit selection',()=>{
 const source=read('explore.js'),code=/function detectLang\(\)\{[\s\S]*?\n\}/.exec(source)[0];
 const run=(languages,search='',saved=null)=>vm.runInNewContext(code+';detectLang()',{
  navigator:{languages},location:{search},localStorage:{getItem:()=>saved},URLSearchParams,T:Object.fromEntries(langs.map(l=>[l,{}])),PARAM_LANG:{en:'en',ja:'ja',ko:'ko','zh-Hans':'zh-Hans','zh-Hant':'zh-Hant'}});
 assert.equal(run(['en-US','ja']),'en');assert.equal(run(['ko','en-US']),'ko');assert.equal(run(['zh-HK']),'zh-Hant');assert.equal(run(['en-US'],'?lang=ja'),'ja');assert.equal(run(['en-US'],'','ko'),'ko');
});
test('map library and its image assets load from this site, with the upstream license',()=>{
 for(const p of ['index.html','explore.html','kids.html','sw.js']){const s=read(p);assert.ok(s.includes('/vendor/leaflet-1.9.4/leaflet.min.js'));assert.ok(!s.includes('cdnjs.cloudflare.com'));}
 const manifest=JSON.parse(read('vendor/leaflet-1.9.4/PROVENANCE.json'));assert.equal(manifest.length,7);
 const crypto=require('node:crypto');for(const m of manifest)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'vendor/leaflet-1.9.4',m.file))).digest('hex'),m.sha256);
 assert.ok(read('vendor/leaflet-1.9.4/LICENSE').includes('Redistribution'));
});
test('comparison previews use the official image format for each historical series',()=>{
 for(const p of places)for(const l of langs){const s=read(route(p,l).slice(1)+'.html');if(!p.then){assert.ok(!s.includes('class="comparison-preview"'));continue;}
 const images=[...s.matchAll(/<img src="(https:\/\/cyberjapandata[^" ]+)"/g)].map(m=>m[1]);assert.equal(images.length,2);
 assert.ok(images[0].includes('/'+p.then+'/'));assert.ok(images[0].endsWith(p.then.startsWith('ort_')?'.png':'.jpg'));assert.ok(images[1].includes('/seamlessphoto/'));
 }
});
