/* Tab 06 is a test bench: Hashima in 3D across five aerial photographs, with places to tap and an
   audio guide. The lab page stays out of search. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),bytes=p=>fs.readFileSync(path.join(root,p));
const LANGS=['en','ja','ko','zh-Hans','zh-Hant'];
const jpegSize=b=>{let i=2;while(i+9<b.length){if(b[i]!==0xFF){i++;continue;}const m=b[i+1],len=b.readUInt16BE(i+2);if(m>=0xC0&&m<=0xCF&&![0xC4,0xC8,0xCC].includes(m))return{h:b.readUInt16BE(i+5),w:b.readUInt16BE(i+7)};i+=2+len;}return null;};
const isJpeg=b=>b[0]===0xFF&&b[1]===0xD8;

test('tab 06 sits after the shopping tab on the home page and the map app',()=>{
 for(const file of ['index.html','explore.html']){const s=read(file);
  assert.ok(s.includes('<button id="mLab" class="mode mode-lab" role="tab" aria-selected="false"><span aria-hidden="true">06</span> <b data-t="modeLab">3D reconstruction</b>'),file);
  assert.ok(s.indexOf('id="mShopping"')<s.indexOf('id="mLab"'),file);
  assert.ok(s.includes('THE ATLAS · 01 — 06')&&!s.includes('01 — 05'),file);
 }
 const js=read('explore.js');
 assert.equal((js.match(/modeLab: '/g)||[]).length,5);assert.equal((js.match(/noteLab: '/g)||[]).length,5);
 for(const snippet of ["['mLab','lab']","if (mode === 'lab') return buildLabCards();","if (mode === 'lab') return t('noteLab');","$('mLab').onclick = () => setMode('lab');","'<a class=\"card card-lab\" href=\"' + labHref(it) + '\">'"])assert.ok(js.includes(snippet),snippet);
 assert.ok(!/Lab · testing|テスト中|testing/.test(js.slice(0,3000)),'no test wording on the tab');
 const intro=vm.runInNewContext(/const MODE_INTRO = \{[\s\S]*?\n\};/.exec(js)[0]+';MODE_INTRO');
 const items=vm.runInNewContext(/const LAB_ITEMS = \[[\s\S]*?\n\}\];/.exec(js)[0]+';LAB_ITEMS');
 assert.ok(items.length>=1);
 for(const l of LANGS){assert.ok(intro[l].lab&&intro[l].lab.replace(/<[^>]+>/g,'').length>=150,l+' intro');assert.ok(intro[l].lab.includes('class="btn-3d"'),l+' intro has the open button');for(const it of items){assert.ok(it.name[l]&&it.hook[l],l+' card text for '+it.path);}}
 assert.ok(isJpeg(bytes('3d/gunkanjima-card.jpg')));
 assert.ok(js.includes("img: '/3d/gunkanjima-card.jpg?v="),'the card points at the card image');
});

test('the five 3D pages are indexable, cross-linked with hreflang, credited, and load nothing from other sites',()=>{
 const pages={en:'3d/gunkanjima.html',ja:'3d/ja/gunkanjima.html',ko:'3d/ko/gunkanjima.html','zh-Hans':'3d/zh-cn/gunkanjima.html','zh-Hant':'3d/zh-tw/gunkanjima.html'};
 const urls={en:'https://japantimeatlas.com/3d/gunkanjima',ja:'https://japantimeatlas.com/3d/ja/gunkanjima',ko:'https://japantimeatlas.com/3d/ko/gunkanjima','zh-Hans':'https://japantimeatlas.com/3d/zh-cn/gunkanjima','zh-Hant':'https://japantimeatlas.com/3d/zh-tw/gunkanjima'};
 const sitemap=read('sitemap.xml');
 for(const [l,file] of Object.entries(pages)){
  const s=read(file);
  assert.ok(s.startsWith('<!doctype html>\n<html lang="'+l+'">'),l+' html lang');
  assert.ok(!s.includes('noindex'),l+' indexable');
  assert.ok(s.includes('<link rel="canonical" href="'+urls[l]+'">'),l+' canonical');
  for(const [m,u] of Object.entries(urls))assert.ok(s.includes('hreflang="'+m+'" href="'+u+'"'),l+' hreflang '+m);
  assert.ok(s.includes('hreflang="x-default" href="'+urls.en+'"'),l+' x-default');
  assert.ok(/<title>[^<]*(Gunkanjima|軍艦島|군함도|军舰岛)[^<]*\| Japan Time Atlas<\/title>/.test(s),l+' title');
  assert.ok(/<meta name="description" content="[^"]{80,}">/.test(s),l+' description');
  assert.ok(s.includes('property="og:image" content="https://japantimeatlas.com/3d/island-from-sea.jpg"'),l+' og image');
  const ld=JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(s)[1]);
  assert.equal(ld['@graph'][0].url,urls[l],l+' ld url');
  for(const need of ['国土地理院','加工して作成','MKU628 C18-2','CKU20103 C44-12','CKU7420 C45-6','USA M185-38','OpenStreetMap contributors','Wikimedia Commons'])assert.ok(s.includes(need),l+' '+need);
  for(const m of Object.keys(pages))assert.equal((s.match(new RegExp('data-lang="'+m+'"','g'))||[]).length,m===l?5:0,l+' keeps only its own blocks ('+m+')');
  assert.ok(!/(test|テスト中|테스트|测试|測試)[)）]/.test(s),l+' no test wording');
  assert.ok(!/<script[^>]+src="https?:/.test(s),l);
  assert.ok(!/href="\/[^"]*\.html/.test(s),l+' links inside the site use clean routes');
  assert.ok(sitemap.includes('<loc>'+urls[l]+'</loc>'),l+' in the sitemap');
 }
 assert.ok(read('_redirects').includes('/lab/gunkanjima-3d /3d/gunkanjima 301'),'old lab route redirects');
 /* the series pages: one per language, indexable, listing the reconstruction and linking to it */
 const idx={en:'3d/index.html',ja:'3d/ja/index.html',ko:'3d/ko/index.html','zh-Hans':'3d/zh-cn/index.html','zh-Hant':'3d/zh-tw/index.html'};
 const idxUrl={en:'https://japantimeatlas.com/3d/',ja:'https://japantimeatlas.com/3d/ja/',ko:'https://japantimeatlas.com/3d/ko/','zh-Hans':'https://japantimeatlas.com/3d/zh-cn/','zh-Hant':'https://japantimeatlas.com/3d/zh-tw/'};
 for(const l of Object.keys(idx)){
  const s=read(idx[l]);
  assert.ok(s.startsWith('<!doctype html>\n<html lang="'+({en:'en',ja:'ja',ko:'ko','zh-Hans':'zh-Hans','zh-Hant':'zh-Hant'})[l]+'">'),l+' series page language');
  assert.ok(!s.includes('noindex'),l+' series page indexable');
  assert.ok(s.includes('<link rel="canonical" href="'+idxUrl[l]+'">'),l+' series canonical');
  assert.equal((s.match(/hreflang=/g)||[]).length,6,l+' series hreflang set');
  assert.ok(s.includes('href="'+urls[l].replace('https://japantimeatlas.com','')+'"'),l+' series links to the reconstruction');
  assert.ok(s.includes('"@type":"ItemList"'),l+' series ItemList');
  assert.ok(sitemap.includes('<loc>'+idxUrl[l]+'</loc>'),l+' series page in the sitemap');
  const page=read(({en:'3d/gunkanjima.html',ja:'3d/ja/gunkanjima.html',ko:'3d/ko/gunkanjima.html','zh-Hans':'3d/zh-cn/gunkanjima.html','zh-Hant':'3d/zh-tw/gunkanjima.html'})[l]);
  assert.ok(page.includes('href="'+idxUrl[l].replace('https://japantimeatlas.com','')+'"'),l+' reconstruction links back to the series');
  assert.ok(page.includes('#l-hashima-island"'),l+' reconstruction links to the island on the map');
 }
 assert.equal(read('explore.js').match(/const LAB_ITEMS = \[/g).length,1,'the home tab lists reconstructions from one array');
 assert.ok(read('explore.js').includes("class=\"card-cta\""),'the card says what a tap does');
 for(const [js,v] of [['3d/gunkanjima-3d.js','17'],['3d/gunkanjima-podcast.js','6']]){
  assert.ok(!/https?:\/\//.test(read(js)),js+' loads nothing from other sites');
  assert.equal(read(js).match(/const V = '(\d+)'/)[1],v,js);
  assert.ok(read('3d/gunkanjima.html').includes('/'+js+'?v='+v),js+' version on the page');
 }
 assert.ok(read('3d/gunkanjima-podcast.js').includes('ensureSeekable'),'player copes with a host that ignores Range');
 assert.ok(/const directories=\[[^\]]*'3d'/.test(read('scripts/build.cjs')),'build copies 3d/');
});

test('the reconstruction supports collision-aware walking, touch controls and four weather presets',()=>{
 const pages=['3d/gunkanjima.html','3d/ja/gunkanjima.html','3d/ko/gunkanjima.html','3d/zh-cn/gunkanjima.html','3d/zh-tw/gunkanjima.html'];
 for(const file of pages){const s=read(file);
  for(const id of ['weatherFx','walkPad','btnWalk','btnWeather'])assert.ok(s.includes('id="'+id+'"'),file+' '+id);
  for(const dir of ['forward','left','back','right'])assert.ok(s.includes('data-walk="'+dir+'"'),file+' '+dir);
  assert.ok(s.includes('/3d/gunkanjima-3d.js?v=17'),file+' current renderer');
 }
 const js=read('3d/gunkanjima-3d.js');
 for(const fn of ['sampleGround','canWalk','updateWalk','drawWeather','beginWalk','endWalk'])assert.ok(js.includes('function '+fn+'('),fn);
 for(const key of ['clear','cloudy','rain','fog'])assert.ok(js.includes("key: '"+key+"'"),key);
 assert.ok(js.includes('pointInPoly(uv, model.coast)'),'walk stays within the coast');
 assert.ok(js.includes('(b.wings || [b.poly]).some(poly => pointInPoly(uv, poly))'),'walk collides with standing buildings');
 for(const lang of ['ja','ko','zh-Hans','zh-Hant'])assert.ok(js.includes("'"+lang+"': {")||js.includes(lang+': {'),lang+' controls');
});

test('height, change and texture files match their description',()=>{
 const lab=JSON.parse(read('3d/gunkanjima-lab.json')),g=lab.grid;
 assert.equal(g.step,1);assert.equal(lab.frame.size,1024);assert.equal(lab.texture.size,2048);
 for(const key of ['h1962','h2010']){
  const b=bytes('3d/'+g[key]);assert.equal(b.length,g.w*g.h*2,key);
  let max=0;for(let i=0;i<b.length;i+=2)max=Math.max(max,b.readUInt16LE(i));
  assert.ok(max*g.unit>20&&max*g.unit<70,key+' tallest point '+max*g.unit+' m');
 }
 assert.equal(bytes('3d/'+g.change).length,g.w*g.h);
 assert.ok(g.x0>=0&&g.y0>=0&&g.x0+g.w<=1024&&g.y0+g.h<=1024);
 const ids=lab.years.map(y=>y.id);
 for(const need of ['1962','2010'])assert.ok(ids.includes(need),need);
 assert.equal(lab.years.find(y=>y.id==='1962').shape,'1962');assert.equal(lab.years.find(y=>y.id==='2010').shape,'2010');
 for(const y of lab.years){const b=bytes('3d/'+y.texture);assert.ok(isJpeg(b),y.id);assert.deepEqual(jpegSize(b),{w:2048,h:2048},y.id);}
 assert.equal(lab.check['1962'].altimeterM,1950);
});

test('every place on the model has text, sources and credited images',()=>{
 const lab=JSON.parse(read('3d/gunkanjima-lab.json')),words=JSON.parse(read('3d/gunkanjima-spots.json'));
 assert.ok(Object.keys(lab.spots).length>=6);
 for(const [id,spot] of Object.entries(lab.spots)){
  const info=words.spots[id];assert.ok(info,id);
  for(const l of LANGS){assert.ok(info.name[l],id+' name '+l);assert.ok(info.text[l]&&info.text[l].length>=40,id+' text '+l);}
  assert.ok(info.sources.length>=1&&info.sources.every(k=>words.sources[k]&&/^https:\/\//.test(words.sources[k].url)),id+' sources');
  assert.ok(spot.u>0&&spot.u<1024&&spot.v>0&&spot.v<1024,id+' position');
  for(const key of ['1962','latest'])assert.ok(isJpeg(bytes('3d/'+spot.images[key])),id+' '+key);
  if(spot.images.photo){
   const ph=words.photos[id];assert.ok(ph,id+' photo credit');
   assert.ok(ph.author&&/^CC BY|Public domain/.test(ph.license)&&/^https:\/\//.test(ph.licenseUrl)&&/^https:\/\/commons\.wikimedia\.org\//.test(ph.page),id+' credit fields');
   for(const l of LANGS)assert.ok(ph.caption[l],id+' caption '+l);
   assert.ok(isJpeg(bytes('3d/'+spot.images.photo)),id+' photo');
  }
 }
});

test('the audio guide has both languages, a timed transcript and cues the model understands',()=>{
 const lab=JSON.parse(read('3d/gunkanjima-lab.json')),years=lab.years.map(y=>y.id),spots=Object.keys(lab.spots);
 for(const lang of ['en','ja']){
  const mp3=bytes('3d/audio/gunkanjima-podcast-'+lang+'.mp3');
  assert.ok(mp3.length>200000,lang+' mp3 size');
  assert.ok(mp3.slice(0,3).toString()==='ID3'||(mp3[0]===0xFF&&(mp3[1]&0xE0)===0xE0),lang+' is MP3');
  const t=JSON.parse(read('3d/audio/gunkanjima-podcast-'+lang+'.json'));
  assert.ok(t.lines.length>=30&&t.chapters.length>=6,lang+' content');
  assert.ok(t.voices&&t.names.A&&t.names.B,lang+' credits');
  let prev=-1;for(const ln of t.lines){assert.ok(ln.start>=prev&&ln.end>ln.start,lang+' order at '+ln.start);prev=ln.start;assert.ok(!ln.t.includes('{'),lang+' placeholder left');
   if(ln.cue){if(ln.cue.year!==undefined)assert.ok(years.includes(ln.cue.year),lang+' year cue '+ln.cue.year);if(ln.cue.spot!==undefined)assert.ok(spots.includes(ln.cue.spot),lang+' spot cue '+ln.cue.spot);}}
  assert.ok(t.lines[t.lines.length-1].end<=t.duration+0.01,lang+' duration');
  for(let i=1;i<t.chapters.length;i++)assert.ok(t.chapters[i].start>t.chapters[i-1].start,lang+' chapters');
 }
});

test('every building photograph exists, is credited with a free licence and captioned in five languages',()=>{
 const ph=JSON.parse(read('3d/gunkanjima-photos.json')).photos,model=JSON.parse(read('3d/gunkanjima-model.json'));
 const names=new Set(model.buildings.map(b=>b.name).filter(Boolean));
 assert.ok(Object.keys(ph).length>=25);
 for(const [name,list] of Object.entries(ph)){
  assert.ok(names.has(name),name+' is a building in the model');
  for(const p of list){
   assert.ok(isJpeg(bytes('3d/'+p.file)),name+' file');
   assert.ok(p.author&&/^CC BY|^CC0|Public domain/.test(p.license)&&/^https:\/\//.test(p.licenseUrl)&&/^https:\/\/commons\.wikimedia\.org\//.test(p.page),name+' credit');
   for(const l of LANGS)assert.ok(p.caption[l],name+' caption '+l);
  }
 }
 assert.ok(!/loading="lazy"/.test(read('3d/gunkanjima-3d.js')),'panel images load at once (lazy images never appear inside the panel)');
});
