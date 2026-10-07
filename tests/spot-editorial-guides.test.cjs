'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),guides=require('../scripts/spot-editorial-guides.cjs');
const targets=['ko/m-nagoya-castle','ja/l-okunoshima'];
const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

test('two sourced guides retain crawlable language, canonical, map links and matching metadata',()=>{
 for(const key of targets){
  const html=fs.readFileSync(path.join(root,'place',key+'.html'),'utf8'),g=guides[key],lang=key.split('/')[0];
  assert.ok(html.includes('<html lang="'+lang+'">'));
  assert.ok(html.includes('rel="canonical" href="https://japantimeatlas.com/place/'+key+'"'));
  assert.ok(html.includes('data-source-checked="'+g.checkedOn+'"'));
  assert.ok(html.includes(g.checkedLabel));
  assert.ok(html.includes('<p class="lead">'+g.lead+'</p>'));
  const main=/<main>([\s\S]*?)<\/main>/.exec(html)[1];
  assert.equal(main.split(g.lead).length-1,1,'the lead is not repeated in the body');
  const schema=JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)[1]);
  assert.equal(schema['@graph'][0].description,g.lead);
  assert.equal(schema['@graph'][0].inLanguage,lang);
  assert.ok(html.includes('/?lang='+lang+'&amp;'));
  assert.equal((html.match(/hreflang=/g)||[]).length,6);
  assert.ok(!/noindex/i.test(html));
  for(const s of g.sources)assert.ok(html.includes(s.url));
 }
 assert.ok(!fs.readFileSync(path.join(root,'place/ja/l-okunoshima.html'),'utf8').includes('秘密裏に毒ガスを製造した島。いまは兎だらけ。'));
});

test('scoped regeneration is reproducible and rejects an invalid route before writing valid routes',t=>{
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'jta-spot-guides-'));
 t.after(()=>{assert.ok(fixture.startsWith(path.join(os.tmpdir(),'jta-spot-guides-')));fs.rmSync(fixture,{recursive:true,force:true});});
 for(const name of ['data','place'])fs.cpSync(path.join(root,name),path.join(fixture,name),{recursive:true});
 fs.mkdirSync(path.join(fixture,'scripts'));
 for(const name of ['build-spot-pages.cjs','discovery-copy.cjs','place-guides.cjs','spot-editorial-guides.cjs'])fs.copyFileSync(path.join(root,'scripts',name),path.join(fixture,'scripts',name));
 for(const name of ['activities-data.js','sw.js','sitemap.xml','places.html','ja.html','ko.html','zh-cn.html','zh-tw.html'])fs.copyFileSync(path.join(root,name),path.join(fixture,name));
 const files=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(d,e.name)):[path.join(d,e.name)]);
 const protectedFiles=[...files(path.join(fixture,'place')).filter(p=>!targets.some(k=>p===path.join(fixture,'place',k+'.html'))),...['sitemap.xml','places.html','ja.html','ko.html','zh-cn.html','zh-tw.html'].map(p=>path.join(fixture,p))];
 const before=new Map(protectedFiles.map(p=>[p,digest(p)]));
 cp.execFileSync(process.execPath,[path.join(fixture,'scripts/build-spot-pages.cjs'),'--only='+targets.join(',')]);
 for(const [p,hash] of before)assert.equal(digest(p),hash,p+' remains unchanged');
 for(const k of targets)assert.equal(digest(path.join(fixture,'place',k+'.html')),digest(path.join(root,'place',k+'.html')));
 const targetHashes=targets.map(k=>digest(path.join(fixture,'place',k+'.html')));
 const invalid=cp.spawnSync(process.execPath,[path.join(fixture,'scripts/build-spot-pages.cjs'),'--only='+targets[0]+',ja/not-a-place'],{encoding:'utf8'});
 assert.notEqual(invalid.status,0);
 assert.match(invalid.stderr,/Not a generated spot page/);
 assert.deepEqual(targets.map(k=>digest(path.join(fixture,'place',k+'.html'))),targetHashes);
});
