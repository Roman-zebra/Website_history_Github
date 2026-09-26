/* The Japanese map speaks Japanese: local names, landmark summaries and source lines (2026-09-26). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),UI=require('../place-ui.js'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const famous=read('data/landmarks.json').landmarks,regional=read('data/regional-landmarks-v1.json').landmarks;
const featured=read('data/places-world.json').places;
const landmarks=[...famous,...regional];
function runtime(lang){
 const element=()=>({textContent:'',innerHTML:'',hidden:true,value:'',dataset:{},style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},setAttribute(){},addEventListener(){},querySelector(){return element();},querySelectorAll(){return [];},focus(){},blur(){},remove(){}});
 const elements=new Map();
 const ctx={ResizeObserver:class{observe(){}},PlaceUI:UI,URL,URLSearchParams,Map,Set,console,AbortSignal,Event:class{},setTimeout(){return 1;},clearTimeout(){},requestAnimationFrame(){},navigator:{languages:['en']},location:{search:'',pathname:'/',origin:'https://example.com',href:'https://example.com/',hash:''},history:{pushState(){},replaceState(){}},localStorage:{getItem(){return null;},setItem(){}},document:{documentElement:{},body:{classList:element().classList},getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){}},window:{innerWidth:390,addEventListener(){}},L:{divIcon:o=>o},fetch:async()=>{throw Error('Unexpected network');}};
 vm.createContext(ctx);const source=fs.readFileSync(path.join(root,'explore.js'),'utf8');
 vm.runInContext(source.slice(0,source.indexOf('LANG = detectLang();')),ctx);
 vm.runInContext('LANG='+JSON.stringify(lang),ctx);
 return code=>vm.runInContext(code,ctx);
}
const latinWords=s=>(String(s).match(/[A-Za-z]{3,}/g)||[]);

test('a local place with an English name but no name:ja keeps its Japanese name on the Japanese map',()=>{
 const tags={name:'日暮里駅','name:en':'Nippori Station',railway:'station'};
 assert.equal(UI.localName(tags,'ja'),'日暮里駅');
 assert.equal(UI.localName(tags,'en'),'Nippori Station');
 assert.ok(UI.summary(tags,'ja').startsWith('日暮里駅'));
 assert.equal(UI.localName({name:'東京駅','name:ja':'東京駅','name:en':'Tokyo Station'},'ja'),'東京駅');
 // Nothing else to show: a name in Latin letters is still better than an empty title
 assert.equal(UI.localName({'name:en':'Ferris wheel'},'ja'),'Ferris wheel');
});

test('landmarks with the three largest pin sizes show more than about three lines of Japanese',()=>{
 const run=runtime('ja');
 for(const p of landmarks.filter(p=>(p.pop||3)<=3)){
  const shown=p.summaries?.ja||run('trimSummary')(p.extract_ja,240);
  assert.ok(shown.length>=95,(p.ja||p.name)+' shows '+shown.length+' characters in Japanese');
 }
});

test('Japanese landmark summaries carry no English aliases, name prefixes or doubled full stops',()=>{
 for(const p of landmarks){
  const s=p.summaries?.ja;if(!s)continue;
  assert.ok(!s.includes('。。'),p.name+' has a doubled full stop');
  if(!p.summaryChecked)continue;
  assert.ok(!/英[:：]/.test(s),p.name+' keeps an English alias');
  assert.ok(!s.startsWith(p.ja+'（'),p.name+' repeats its heading as a reading');
  assert.deepEqual(latinWords(s).filter(w=>!['JR'].includes(w)),[],p.name+' has Latin words');
  assert.match(p.summaryChecked,/^\d{4}-\d{2}-\d{2}$/);
 }
});

test('extra summary sources are listed once, as web links with a label',()=>{
 let listed=0;
 for(const p of landmarks)for(const [lang,list] of Object.entries(p.summarySources||{})){
  assert.ok(p.summaries?.[lang],p.name+' lists sources for a missing '+lang+' summary');
  const urls=list.map(s=>s.url);assert.equal(new Set(urls).size,urls.length,p.name+' repeats a source');
  for(const s of list){assert.match(s.url,/^https?:\/\/[^\s]+$/);assert.ok(s.label&&s.label.trim(),p.name);}
  listed++;
 }
 assert.ok(listed>=40);
});

test('the Japanese panel names those sources, and English keeps its own note',()=>{
 const himeji=famous.find(p=>p.name==='Himeji Castle');
 const ja=runtime('ja')('extractHTML')(himeji,240);
 assert.ok(ja.includes('ウィキペディアと次の資料に基づく概要です：'));
 for(const s of himeji.summarySources.ja)assert.ok(ja.includes('href="'+s.url.replace(/&/g,'&amp;')+'"'),s.url);
 const en=runtime('en')('extractHTML')(himeji,240);
 assert.ok(!en.includes('<a '));assert.ok(en.includes('Short overview based on the linked source.'));
 const plain=famous.find(p=>p.summaries.ja&&!p.summarySources);
 assert.ok(runtime('ja')('extractHTML')(plain,240).includes('リンク先の資料に基づく短い概要です。'));
});

test('source lines on the Japanese map are written in Japanese',()=>{
 const run=runtime('ja'),note=run('coordNote');
 for(const p of [...regional,...famous])assert.deepEqual(latinWords(note(p)).filter(w=>!['OpenStreetMap','contributors'].includes(w)),[],p.name);
 assert.equal(note(regional.find(p=>p.coordSource.includes('openstreetmap'))),'座標：© OpenStreetMap contributors');
 assert.equal(runtime('en')('coordNote')(famous[0]),'Coordinates from Wikipedia.');
 for(const p of featured.filter(p=>p.source))assert.ok(p.source_ja&&!latinWords(p.source_ja).length,p.id+' needs a Japanese source line');
});

test('a long Japanese lead becomes a page description of whole sentences, not its first clause',()=>{
 const dir=path.join(root,'place','ja'),unescape=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
 for(const f of fs.readdirSync(dir).filter(f=>/^m-.+\.html$/.test(f))){
  const h=fs.readFileSync(path.join(dir,f),'utf8');
  const description=unescape(h.match(/<meta name="description" content="([^"]*)"/)[1]),lead=unescape(h.match(/<p class="lead">([^<]*)<\/p>/)[1]).replace(/\s+/g,' ');
  assert.ok(description.length>=Math.min(lead.length,75),f+': '+description);
  assert.ok(lead.startsWith(description.replace(/…$/,'')),f);
 }
});
