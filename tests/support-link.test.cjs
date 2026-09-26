/* The site carries no advertising. Every support link first shows the publication notice on our site. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),SUPPORT='href="/support"',KOFI='https://ko-fi.com/japantimeatlas';
const htmlIn=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
 if(['.git','dist','vendor','node_modules','tests','scripts','data','icons','place','3d','visit'].includes(e.name))return [];
 const p=path.join(dir,e.name);return e.isDirectory()?htmlIn(p):e.name.endsWith('.html')?[p]:[];});
const rel=p=>path.relative(root,p).split(path.sep).join('/');
const generatedRoot=new Set(['ja.html','ko.html','zh-cn.html','zh-tw.html','places.html']);
const pages=htmlIn(root).filter(p=>!generatedRoot.has(rel(p)));
/* kids.html is written for children and carries no site footer, so it asks for nothing. */
const EXEMPT=['kids.html','visit.html'];

test('no page loads an advert or an affiliate script',()=>{
 for(const p of pages){const s=fs.readFileSync(p,'utf8');
  assert.ok(!/getyourguide|klook|viator|stay22|adsbygoogle|googlesyndication|affiliate|gyg/i.test(s),rel(p));}
 for(const gone of ['affiliate-router.js','affiliate-config.json','gyg-products.js','gyg-widget.js','gyg-frame.html','data/affiliate.json'])
  assert.ok(!fs.existsSync(path.join(root,gone)),gone+' still exists');
});

test('every page with a site footer routes support through the publication notice',()=>{
 const withFooter=pages.filter(p=>rel(p)!=='support.html'&&!EXEMPT.includes(rel(p))&&/site-about-link|<footer/.test(fs.readFileSync(p,'utf8')));
 assert.ok(withFooter.length>=7,'expected the hand-written site entry pages, got '+withFooter.length);
 for(const p of withFooter){const s=fs.readFileSync(p,'utf8');
  assert.ok(s.includes(SUPPORT),rel(p)+' has no internal support link');
  assert.ok(!s.includes('href="'+KOFI+'"'),rel(p)+' skips the publication notice');}
});

test('the about page links to support in all six languages and names the hashtags',()=>{
 const s=fs.readFileSync(path.join(root,'about.html'),'utf8');
 assert.equal((s.match(/href="\/support"/g)||[]).length,6,'one support link per language section');
 assert.equal((s.match(/#JapanTimeAtlas/g)||[]).length,6,'every language names the shared hashtag');
 assert.ok(s.includes('#\u4eca\u6614\u3042\u308b\u304d'),'the Japanese section names the Japanese hashtag');
 for(const id of ['ja','en','ko','zh-Hans','zh-Hant','th']){
  const section=s.slice(s.indexOf('id="'+id+'"'),s.indexOf('</section>',s.indexOf('id="'+id+'"')));
  assert.ok(section.includes(SUPPORT),id+' section has no support link');}
});

test('Ko-fi is embedded only on the support page, with a safe fallback link',()=>{
 const s=fs.readFileSync(path.join(root,'support.html'),'utf8');
 assert.ok(s.includes('https://ko-fi.com/japantimeatlas/?hidefeed=true'));
 assert.match(s,new RegExp('href="'+KOFI.replaceAll('.','\\.')+'"[^>]*target="_blank"[^>]*rel="noopener"'));
});

test('every generated page template sends support links through the notice',()=>{
 for(const file of ['scripts/build-discovery.cjs','scripts/build-spot-pages.cjs','scripts/build-3d-index.cjs','scripts/lab-3d/gunkanjima.template.html']){
  const s=fs.readFileSync(path.join(root,file),'utf8');
  assert.ok(s.includes(SUPPORT),file+' has no internal support link');
  assert.ok(!s.includes('href="'+KOFI+'"'),file+' skips the publication notice');
 }
});
