/* What a place page looks like when someone shares it, and the links that let them. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const base='https://japantimeatlas.com';
const {NETS,COPY}=require('../scripts/share.cjs');
const manifest=JSON.parse(read('og/manifest.json'));
const pagesIn=d=>fs.readdirSync(path.join(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?pagesIn(path.join(d,e.name)):e.name.endsWith('.html')?[path.join(d,e.name)]:[]);
const hosts=new Set(Object.values(NETS).map(n=>new URL(n.href('u','s')).host));
const PERIOD={ort_USA10:'1945–1950',ort_old10:'1961–1969',gazo1:'1974–1978',gazo2:'1979–1983',gazo3:'1984–1986',gazo4:'1987–1990'};
function jpegSize(buf){
 for(let i=2;i<buf.length-8;){
  if(buf[i]!==0xFF){i++;continue;}
  const m=buf[i+1];
  if(m>=0xC0&&m<=0xCF&&![0xC4,0xC8,0xCC].includes(m))return {height:buf.readUInt16BE(i+5),width:buf.readUInt16BE(i+7)};
  i+=2+buf.readUInt16BE(i+2);
 }
 return null;
}

test('every place has a 1200x630 share image with the series it was drawn from',()=>{
 const keys=fs.readdirSync(path.join(root,'place')).filter(f=>f.endsWith('.html')).map(f=>f.slice(0,-5)).sort();
 assert.deepEqual(Object.keys(manifest).sort(),keys);
 for(const [key,m] of Object.entries(manifest)){
  const buf=fs.readFileSync(path.join(root,'og',key+'.jpg'));
  assert.equal(buf.readUInt16BE(0),0xFFD8,key+' is a JPEG');
  assert.deepEqual(jpegSize(buf),{height:630,width:1200},key);
  assert.ok(buf.length<400*1024,key+' is '+Math.round(buf.length/1024)+' KB');
  assert.equal(m.period,m.then?PERIOD[m.then]:null,key+' period');
 }
 const places=JSON.parse(read('data/places-world.json')).places;
 for(const p of places)if(p.then)assert.equal(manifest[p.id].then,p.then,p.id+' uses the series its page names');
});

test('each place page shares its own image, its own URL and its own language',()=>{
 for(const file of pagesIn('place')){
  const s=read(file),key=path.basename(file,'.html'),img=base+'/og/'+key+'.jpg',lang=/<html lang="([^"]+)">/.exec(s)[1];
  assert.equal((s.match(/property="og:image"/g)||[]).length,1,file+' one og:image');
  assert.ok(s.includes('<meta property="og:image" content="'+img+'">'),file+' og:image');
  assert.ok(s.includes('<meta name="twitter:image" content="'+img+'">'),file+' twitter:image');
  assert.ok(s.includes('<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'),file+' size');
  assert.equal((s.match(/<meta name="robots" content="max-image-preview:large">/g)||[]).length,1,file+' large previews, once');
  assert.equal((s.match(/<!--SHARE-->/g)||[]).length,1,file+' one share block');
  assert.equal((s.match(/<script src="\/share\.js\?v=[^"]+" defer><\/script>/g)||[]).length,1,file+' share.js once');
  assert.ok(s.includes('<img src="/og/'+key+'.jpg" width="1200" height="630" loading="lazy"'),file+' shows the image it shares');
  assert.ok(s.includes('<h2>'+(COPY[lang]||COPY.en).heading+'</h2>'),file+' share heading in '+lang);
  const ld=JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(s)[1]);
  assert.equal((ld['@graph']?ld['@graph'][0]:ld).image.url,img,file+' structured data image');
  const canonical=/<link rel="canonical" href="([^"]+)">/.exec(s)[1];
  assert.equal(/<p class="share-row" data-url="([^"]+)"/.exec(s)[1],canonical,file+' shares its canonical URL');
  const links=[...s.matchAll(/<a class="share-link" href="([^"]+)"/g)].map(m=>new URL(m[1].replaceAll('&amp;','&')));
  assert.ok(links.length>=3,file+' share links');
  for(const u of links){
   assert.ok(hosts.has(u.host),file+' links to '+u.host);
   assert.ok(decodeURIComponent(u.search).includes(canonical),file+' '+u.host+' carries the page URL');
   assert.ok(!/utm_|fbclid|gclid/.test(u.search),file+' no tracking parameters');
  }
  // the two buttons need share.js; without it they stay hidden
  assert.ok(/<button class="share-native" type="button" hidden>/.test(s)&&/<button class="share-copy" type="button" data-done="[^"]+" hidden>/.test(s),file+' buttons wait for the script');
 }
 for(const [dir,host] of [['ko','share.naver.com'],['zh-cn','service.weibo.com'],['zh-tw','www.threads.net'],['ja','social-plugins.line.me'],['th','social-plugins.line.me']])
  assert.ok(read('place/'+dir+'/hiroshima.html').includes('href="https://'+host+'/'),dir+' offers '+host);
 assert.ok(read('place/hiroshima.html').includes('href="https://www.reddit.com/'),'en offers Reddit');
});

test('pages without a place keep the site image and also allow large previews',()=>{
 for(const file of ['visit.html',...pagesIn('visit'),...pagesIn('guides'),'index.html','ja.html','ko.html','zh-cn.html','zh-tw.html','th.html','places.html','about.html']){
  const s=read(file);
  assert.equal((s.match(/<meta name="robots" content="max-image-preview:large">/g)||[]).length,1,file);
 }
 for(const file of ['visit.html',...pagesIn('visit')])assert.ok(read(file).includes('<meta property="og:image" content="'+base+'/og.jpg">'),file);
 for(const file of ['3d/gunkanjima.html','3d/ko/gunkanjima.html','3d/index.html'])assert.ok(read(file).includes('<meta name="robots" content="max-image-preview:large">'),file);
});

test('a share says the site name, and the images ship without filling the app cache',()=>{
 const explore=read('explore.js');
 assert.ok(!/'Japan, Then and Now'/.test(explore),'map share title');
 assert.ok((explore.match(/\+ 'Japan Time Atlas';/g)||[]).length===2,'both map share buttons');
 for(const f of ['index.html','explore.html'])assert.ok(read(f).includes('<meta name="apple-mobile-web-app-title" content="Time Atlas">'),f);
 assert.ok(!read('places.html').includes('Then &amp; Now'),'places.html');
 assert.match(read('sw.js'),/!u\.pathname\.startsWith\('\/og\/'\)/);
 const build=read('scripts/build.cjs');assert.match(build,/'og'\]/);assert.match(build,/'share\.js'/);
 assert.match(read('_headers'),/\n\/share\.js\n  Cache-Control: public, max-age=31536000, immutable/);
});
