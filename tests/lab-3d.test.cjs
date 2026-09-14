/* Tab 06 is a test bench: Hashima in 3D across five aerial photographs, with places to tap and an
   audio guide. The lab page stays out of search. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),bytes=p=>fs.readFileSync(path.join(root,p));
const LANGS=['en','ja','ko','zh-Hans','zh-Hant'];
const jpegSize=b=>{let i=2;while(i+9<b.length){if(b[i]!==0xFF){i++;continue;}const m=b[i+1],len=b.readUInt16BE(i+2);if(m>=0xC0&&m<=0xCF&&![0xC4,0xC8,0xCC].includes(m))return{h:b.readUInt16BE(i+5),w:b.readUInt16BE(i+7)};i+=2+len;}return null;};
const isJpeg=b=>b[0]===0xFF&&b[1]===0xD8;

test('tab 06 sits after the shopping tab on the home page and the map app',()=>{
 for(const file of ['index.html','explore.html']){const s=read(file);
  assert.ok(s.includes('<button id="mLab" class="mode mode-lab" role="tab" aria-selected="false"><span aria-hidden="true">06</span>'),file);
  assert.ok(s.indexOf('id="mShopping"')<s.indexOf('id="mLab"'),file);
  assert.ok(s.includes('THE ATLAS · 01 — 06')&&!s.includes('01 — 05'),file);
 }
 const js=read('explore.js');
 assert.equal((js.match(/modeLab: '/g)||[]).length,5);assert.equal((js.match(/noteLab: '/g)||[]).length,5);
 for(const snippet of ["['mLab','lab']","if (mode === 'lab') return buildLabCards();","if (mode === 'lab') return t('noteLab');","$('mLab').onclick = () => setMode('lab');",'href="/lab/gunkanjima-3d?lang='])assert.ok(js.includes(snippet),snippet);
 const intro=vm.runInNewContext(/const MODE_INTRO = \{[\s\S]*?\n\};/.exec(js)[0]+';MODE_INTRO');
 const cards=vm.runInNewContext(/const LAB_CARD = \{[\s\S]*?\n\};/.exec(js)[0]+';LAB_CARD');
 for(const l of LANGS){assert.ok(intro[l].lab&&intro[l].lab.replace(/<[^>]+>/g,'').length>=150,l+' intro');assert.equal(cards[l].length,2,l+' card');}
 assert.ok(isJpeg(bytes('lab/gunkanjima-card.jpg')));
 assert.ok(js.includes('src="/lab/gunkanjima-card.jpg?v='),'the card points at the card image');
});

test('the lab page is kept out of search, credits its sources and loads nothing from other sites',()=>{
 const s=read('lab/gunkanjima-3d.html');
 assert.ok(s.includes('<meta name="robots" content="noindex">'));
 assert.ok(!/rel="canonical"/.test(s));
 for(const need of ['国土地理院の空中写真を加工して作成','MKU628 C18-2','CKU20103 C44-12','CKU7420 C45-6','USA M185-38','OpenStreetMap contributors','Wikimedia Commons'])assert.ok(s.includes(need),need);
 for(const l of LANGS)assert.equal((s.match(new RegExp('data-lang="'+l+'"','g'))||[]).length,3,l);
 assert.ok(!/<script[^>]+src="https?:/.test(s));
 assert.ok(!/href="\/[^"]*\.html/.test(s),'links inside the site use clean routes');
 for(const js of ['lab/gunkanjima-3d.js','lab/gunkanjima-podcast.js']){
  assert.ok(!/https?:\/\//.test(read(js)),js+' loads nothing from other sites');
  assert.equal(read(js).match(/const V = '(\d+)'/)[1],'2',js);
  assert.ok(s.includes('/'+js+'?v=2'),js+' version on the page');
 }
 assert.ok(!read('sitemap.xml').includes('/lab/'));
 assert.ok(/const directories=\[[^\]]*'lab'/.test(read('scripts/build.cjs')),'build copies lab/');
});

test('height, change and texture files match their description',()=>{
 const lab=JSON.parse(read('lab/gunkanjima-lab.json')),g=lab.grid;
 assert.equal(g.step,1);assert.equal(lab.frame.size,1024);assert.equal(lab.texture.size,2048);
 for(const key of ['h1962','h2010']){
  const b=bytes('lab/'+g[key]);assert.equal(b.length,g.w*g.h*2,key);
  let max=0;for(let i=0;i<b.length;i+=2)max=Math.max(max,b.readUInt16LE(i));
  assert.ok(max*g.unit>20&&max*g.unit<70,key+' tallest point '+max*g.unit+' m');
 }
 assert.equal(bytes('lab/'+g.change).length,g.w*g.h);
 assert.ok(g.x0>=0&&g.y0>=0&&g.x0+g.w<=1024&&g.y0+g.h<=1024);
 const ids=lab.years.map(y=>y.id);
 for(const need of ['1962','2010'])assert.ok(ids.includes(need),need);
 assert.equal(lab.years.find(y=>y.id==='1962').shape,'1962');assert.equal(lab.years.find(y=>y.id==='2010').shape,'2010');
 for(const y of lab.years){const b=bytes('lab/'+y.texture);assert.ok(isJpeg(b),y.id);assert.deepEqual(jpegSize(b),{w:2048,h:2048},y.id);}
 assert.equal(lab.check['1962'].altimeterM,1950);
});

test('every place on the model has text, sources and credited images',()=>{
 const lab=JSON.parse(read('lab/gunkanjima-lab.json')),words=JSON.parse(read('lab/gunkanjima-spots.json'));
 assert.ok(Object.keys(lab.spots).length>=6);
 for(const [id,spot] of Object.entries(lab.spots)){
  const info=words.spots[id];assert.ok(info,id);
  for(const l of LANGS){assert.ok(info.name[l],id+' name '+l);assert.ok(info.text[l]&&info.text[l].length>=40,id+' text '+l);}
  assert.ok(info.sources.length>=1&&info.sources.every(k=>words.sources[k]&&/^https:\/\//.test(words.sources[k].url)),id+' sources');
  assert.ok(spot.u>0&&spot.u<1024&&spot.v>0&&spot.v<1024,id+' position');
  for(const key of ['1962','latest'])assert.ok(isJpeg(bytes('lab/'+spot.images[key])),id+' '+key);
  if(spot.images.photo){
   const ph=words.photos[id];assert.ok(ph,id+' photo credit');
   assert.ok(ph.author&&/^CC BY|Public domain/.test(ph.license)&&/^https:\/\//.test(ph.licenseUrl)&&/^https:\/\/commons\.wikimedia\.org\//.test(ph.page),id+' credit fields');
   for(const l of LANGS)assert.ok(ph.caption[l],id+' caption '+l);
   assert.ok(isJpeg(bytes('lab/'+spot.images.photo)),id+' photo');
  }
 }
});

test('the audio guide has both languages, a timed transcript and cues the model understands',()=>{
 const lab=JSON.parse(read('lab/gunkanjima-lab.json')),years=lab.years.map(y=>y.id),spots=Object.keys(lab.spots);
 for(const lang of ['en','ja']){
  const mp3=bytes('lab/audio/gunkanjima-podcast-'+lang+'.mp3');
  assert.ok(mp3.length>200000,lang+' mp3 size');
  assert.ok(mp3.slice(0,3).toString()==='ID3'||(mp3[0]===0xFF&&(mp3[1]&0xE0)===0xE0),lang+' is MP3');
  const t=JSON.parse(read('lab/audio/gunkanjima-podcast-'+lang+'.json'));
  assert.ok(t.lines.length>=30&&t.chapters.length>=6,lang+' content');
  assert.ok(t.voices&&t.names.A&&t.names.B,lang+' credits');
  let prev=-1;for(const ln of t.lines){assert.ok(ln.start>=prev&&ln.end>ln.start,lang+' order at '+ln.start);prev=ln.start;assert.ok(!ln.t.includes('{'),lang+' placeholder left');
   if(ln.cue){if(ln.cue.year!==undefined)assert.ok(years.includes(ln.cue.year),lang+' year cue '+ln.cue.year);if(ln.cue.spot!==undefined)assert.ok(spots.includes(ln.cue.spot),lang+' spot cue '+ln.cue.spot);}}
  assert.ok(t.lines[t.lines.length-1].end<=t.duration+0.01,lang+' duration');
  for(let i=1;i<t.chapters.length;i++)assert.ok(t.chapters[i].start>t.chapters[i-1].start,lang+' chapters');
 }
});
