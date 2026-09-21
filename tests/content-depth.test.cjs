/* The written depth promised on the page: long guides, tab explanations, spot notes, corrected facts. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const {labels,guides,liminalGuides}=require('../scripts/place-guides.cjs');
const text=h=>h.replace(/<script[\s\S]*?<\/script>/g,' ').replace(/<[^>]+>/g,' ').replace(/&[a-z#0-9]+;/g,' ').replace(/\s+/g,' ');
const cjk=s=>[...s].filter(c=>/[぀-ヿ一-鿿]/.test(c)).length;
const words=s=>s.split(' ').filter(w=>/[A-Za-z]/.test(w)).length;

test('the five places written up in depth carry the full guide',()=>{
 for(const [file,l] of [['place/hiroshima.html','en'],['place/ja/hiroshima.html','ja'],['place/himeji.html','en'],['place/ja/himeji.html','ja'],['place/aneyoshi.html','en'],['place/ja/aneyoshi.html','ja']]){
  const s=read(file),body=text(s);
  for(const k of ['why','look','dates','visit'])assert.ok(s.includes('<h2>'+labels[l][k]+'</h2>'),file+' '+k);
  assert.ok(s.includes(labels[l].checked),file+' check date');
  if(l==='ja')assert.ok(cjk(body)>=800,file+' has '+cjk(body)+' Japanese characters');else assert.ok(words(body)>=450,file+' has '+words(body)+' words');
 }
 for(const file of ['place/l-doai-station.html','place/l-hashima-island.html']){const s=read(file),body=text(s);
  assert.equal((s.match(/<!--GUIDE-->/g)||[]).length,1,file+' guide block appears once');
  for(const l of ['en','ja'])for(const k of ['why','look','visit'])assert.ok(s.includes('<h2>'+labels[l][k]+'</h2>'),file+' '+l+' '+k);
  assert.ok(words(body)>=450,file+' has '+words(body)+' words');assert.ok(cjk(body)>=700,file+' has '+cjk(body)+' Japanese characters');
  const ld=JSON.parse(s.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.ok(ld['@graph'].some(n=>n['@type']==='BreadcrumbList'));assert.ok(!s.includes('undefined'));
 }
});

test('every guide has matching English and Japanese sections and https sources',()=>{
 for(const g of [...Object.values(guides),...Object.values(liminalGuides)]){
  for(const k of ['why','look','visit'])assert.equal(g.en[k].length,g.ja[k].length,k);
  for(const l of ['en','ja']){assert.ok(g[l].sources.length>=2);for(const s of g[l].sources){assert.match(s.url,/^https:\/\//);assert.ok(s.label);}assert.ok(Array.isArray(g[l].fieldNotes));}
 }
});

test('each home tab explains its list in all five map languages',()=>{
 const code=/const MODE_INTRO = \{[\s\S]*?\n\};/.exec(read('explore.js'))[0];
 const intro=vm.runInNewContext(code+';MODE_INTRO');
 for(const l of ['en','ja','ko','zh-Hans','zh-Hant'])for(const m of ['places','liminal','food','shopping']){
  const h=intro[l][m];assert.ok(h&&text(h).length>=150,l+' '+m);assert.ok(!/undefined/.test(h),l+' '+m);
 }
 for(const file of ['index.html','explore.html']){const s=read(file),box=s.match(/<section id="modeIntro"[\s\S]*?<\/section>/);assert.ok(box,file);assert.ok(text(box[0]).length>=300,file);}
});

test('every food and shopping spot has a sourced note in five languages',()=>{
 const ctx={window:{}};vm.runInNewContext(read('activities-data.js'),ctx);
 for(const p of ctx.window.AtlasActivities.places){
  for(const l of ['en','ja','ko','zh-Hans','zh-Hant'])assert.ok(p.notes&&p.notes[l]&&p.notes[l].length>=12,p.id+' '+l);
  assert.ok(p.noteSources.length&&p.noteSources.every(u=>u.startsWith('https://')),p.id);
 }
});

test('facts corrected against official sources stay corrected',()=>{
 const lim=JSON.parse(read('data/liminal.json')).places,h=lim.find(p=>p.id==='hashima-island'),n=lim.find(p=>p.id==='nakano-broadway');
 assert.ok(!/sixteen storeys|nine hectares|16階建て|9ヘクタール/.test(h.why+h.why_ja));
 assert.ok(!/escalator|エスカレーター/.test(n.why+n.why_ja));
 // The place pages are static, so they must be corrected too, not only the data they came from.
 assert.ok(!/sixteen storeys|nine hectares|16階建て|9ヘクタール/.test(read('place/l-hashima-island.html')),'Hashima page lead');
 assert.ok(!/(<p class='lead'>|<h2>日本語<\/h2><p>)[^<]*<\/p><p>[^<]*(escalator|エスカレーター)/i.test(read('place/l-nakano-broadway.html')),'Nakano Broadway page lead');
 assert.ok(!/four trains a day|一日4本/.test(read('explore.js')));
 const himeji=JSON.parse(read('data/places-world.json')).places.find(p=>p.id==='himeji');
 assert.ok(himeji.story[1].includes('June and July 1945')&&himeji.story_ja[1].includes('6月と7月'));
 const ctx={window:{}};vm.runInNewContext(read('activities-data.js'),ctx);
 const hasshoku=ctx.window.AtlasActivities.places.find(p=>p.id==='hasshoku-center');
 assert.ok(hasshoku.notes.en.includes('124-seat')&&hasshoku.notes.ja.includes('124席'));
 assert.deepEqual([...hasshoku.noteSources],[
  'https://www.849net.com/map/',
  'https://www.849net.com/map/shop/shichirin.html',
  'https://www.849net.com/access/'
 ]);
});
