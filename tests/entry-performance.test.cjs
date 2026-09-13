const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('background cache installation has four workers and survives a failed asset',async()=>{
 let active=0,peak=0,done=0,skipped=false,install;const requests=[];
 const ctx={self:{addEventListener:(name,fn)=>{if(name==='install')install=fn;},skipWaiting:()=>skipped=true},caches:{open:async()=>({add:async req=>{requests.push(req);active++;peak=Math.max(peak,active);await new Promise(resolve=>setImmediate(resolve));active--;done++;if(done===2)throw Error('offline');}})},Request:class{constructor(url,options){this.url=url;this.cache=options.cache;}},console:{warn(){}}};
 const source=read('sw.js');vm.runInNewContext(source.slice(0,source.indexOf("self.addEventListener('activate'")),ctx);
 let promise;install({waitUntil:p=>promise=p});await promise;
 assert.equal(peak,4);assert.equal(done,requests.length);assert.ok(skipped);assert.ok(requests.length>20);
 assert.ok(requests.filter(r=>r.url.includes('?v=')).every(r=>r.cache==='default'));
});
test('every crawlable page has a real square PNG icon and Apple touch icon',()=>{
 for(const [,url] of read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)){
  const p=new URL(url).pathname,s=read(p==='/'?'index.html':p.slice(1)+'.html');
  assert.equal((s.match(/rel="icon"/g)||[]).length,2,url);
  assert.ok(s.includes('href="/icons/atlas-96.png"'));assert.ok(s.includes('href="/icons/atlas-180.png"'));
 }
 for(const size of [32,96,180,192,512]){const p=fs.readFileSync(path.join(root,'icons/atlas-'+size+'.png'));assert.equal(p.readUInt32BE(16),size);assert.equal(p.readUInt32BE(20),size);assert.ok(p.length<10000);}
});
test('domestic guide is directly linked from Japanese entry and indexed',()=>{
 assert.ok(read('ja.html').includes('href="/visit/jp"'));assert.ok(read('visit.html').includes('href="/visit/jp"'));assert.ok(read('sitemap.xml').includes('/visit/jp</loc>'));
 const s=read('visit/jp.html');assert.ok(s.includes('<html lang="ja">'));assert.ok(s.includes('href="/?lang=ja#kamakura"'));
});
