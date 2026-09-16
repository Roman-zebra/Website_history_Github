/* The site carries no advertising; the only money link is the support link, and it is the same one everywhere. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),KOFI='https://ko-fi.com/japantimeatlas';
const htmlIn=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
 if(['.git','dist','vendor','node_modules','tests','scripts','data','icons'].includes(e.name))return [];
 const p=path.join(dir,e.name);return e.isDirectory()?htmlIn(p):e.name.endsWith('.html')?[p]:[];});
const pages=htmlIn(root),rel=p=>path.relative(root,p).split(path.sep).join('/');
/* kids.html is written for children and carries no site footer, so it asks for nothing. */
const EXEMPT=['kids.html','visit.html'];

test('no page loads an advert or an affiliate script',()=>{
 for(const p of pages){const s=fs.readFileSync(p,'utf8');
  assert.ok(!/getyourguide|klook|viator|stay22|adsbygoogle|googlesyndication|affiliate|gyg/i.test(s),rel(p));}
 for(const gone of ['affiliate-router.js','affiliate-config.json','gyg-products.js','gyg-widget.js','gyg-frame.html','data/affiliate.json'])
  assert.ok(!fs.existsSync(path.join(root,gone)),gone+' still exists');
});

test('every page with a site footer offers the support link, and always the same address',()=>{
 const withFooter=pages.filter(p=>!EXEMPT.includes(rel(p))&&/site-about-link|<footer/.test(fs.readFileSync(p,'utf8')));
 assert.ok(withFooter.length>50,'expected the whole site, got '+withFooter.length);
 for(const p of withFooter){const s=fs.readFileSync(p,'utf8');
  assert.ok(s.includes(KOFI),rel(p)+' has no support link');
  assert.ok(!/ko-fi\.com\/(?!japantimeatlas)/.test(s),rel(p)+' points at another Ko-fi page');
  for(const m of s.matchAll(/<a[^>]*href="https:\/\/ko-fi\.com[^"]*"[^>]*>/g))
   assert.match(m[0],/rel="noopener"/,rel(p)+' support link needs rel=noopener');}
});

test('the about page explains the support in all six languages and names the hashtags',()=>{
 const s=fs.readFileSync(path.join(root,'about.html'),'utf8');
 assert.equal((s.match(new RegExp(KOFI,'g'))||[]).length,6,'one support link per language section');
 assert.equal((s.match(/#JapanTimeAtlas/g)||[]).length,6,'every language names the shared hashtag');
 assert.ok(s.includes('#\u4eca\u6614\u3042\u308b\u304d'),'the Japanese section names the Japanese hashtag');
 for(const id of ['ja','en','ko','zh-Hans','zh-Hant','th']){
  const section=s.slice(s.indexOf('id="'+id+'"'),s.indexOf('</section>',s.indexOf('id="'+id+'"')));
  assert.ok(section.includes(KOFI),id+' section has no support link');}
});
