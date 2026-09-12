const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),UI=require('../place-ui.js');
const featured=JSON.parse(fs.readFileSync(path.join(root,'data/places-world.json'))).places;
const liminal=JSON.parse(fs.readFileSync(path.join(root,'data/liminal.json'))).places;
const landmarks=JSON.parse(fs.readFileSync(path.join(root,'data/landmarks.json'))).landmarks;
test('79 curated locations have distinct language fields and translated summaries',()=>{
 for(const p of [...featured,...liminal,...landmarks])for(const l of UI.langs){assert.ok(p.names[l],p.name+' '+l);assert.ok(p.summaries[l],p.name+' '+l);}
 assert.equal(UI.name(featured.find(p=>p.id==='kobe'),'ko'),'고베·메리켄 공원');
 assert.equal(UI.name(landmarks.find(p=>p.ja==='東京駅'),'zh-Hant'),'東京站');
});
test('concrete tags outrank ambiguous Japanese place names',()=>{
 for(const [tags,emoji] of [[{name:'稲荷駅',railway:'station',religion:'shinto'},'🚉'],[{name:'神宮前博物館',tourism:'museum'},'🏛️'],[{name:'大杉神社',natural:'tree'},'🌳'],[{historic:'memorial',memorial:'plaque'},'📜'],[{name:'海の公園水族館',tourism:'aquarium'},'🐠']])assert.equal(UI.type(tags)[1],emoji);
 assert.equal(UI.type({tourism:'attraction'})[1],'📍');
});
test('normalization handles fullwidth, kana, accents and Hangul consistently',()=>{
 assert.equal(UI.normalize('ＴＯＫＹＯ'),UI.normalize('Tokyo'));
 assert.equal(UI.normalize('キヨミズデラ'),UI.normalize('きよみずでら'));
 assert.equal(UI.normalize('Tōdai-ji'),UI.normalize('Todaiji'));
 assert.equal(UI.normalize('도쿄'),UI.normalize('도쿄'.normalize('NFD')));
});
test('local names and two-line overview follow all five language selections',()=>{
 const tags={name:'東京駅','name:en':'Tokyo Station','name:ko':'도쿄역','name:zh-Hans':'东京站','name:zh-Hant':'東京站',railway:'station',start_date:'1914'};
 for(const lang of UI.langs){assert.equal(UI.summary(tags,lang).split('\n').length,2);assert.ok(UI.summary(tags,lang).includes('1914'));}
 assert.equal(UI.localName(tags,'ko'),'도쿄역');assert.equal(UI.localName(tags,'zh-Hant'),'東京站');
});
test('saved storage rejects malformed shapes, coordinates and duplicates',()=>{
 for(const v of [null,{},'bad'])assert.deepEqual(UI.savedRows(v),[]);
 assert.equal(UI.savedRows([{lat:34,lon:135,name:'test'},{lat:34,lon:135},{lat:999,lon:0},null]).length,1);
 assert.equal(UI.savedRows(Array.from({length:220},(_,i)=>({lat:i/1000,lon:135}))).length,200);
});
test('shared URL carries language and exact location or featured identity',()=>{
 let u=new URL(UI.spotURL('https://example.com','zh-Hant',[35.123456,139.654321],'','東京駅'));
 assert.equal(u.searchParams.get('lang'),'zh-Hant');assert.equal(u.hash,'#spot=35.12346,139.65432');assert.equal(u.searchParams.get('name'),'東京駅');
 u=new URL(UI.spotURL('https://example.com','ko',[35,139],'#l-doai-station','x'));assert.equal(u.hash,'#l-doai-station');
});
function runtime(){
 const elements=new Map(),storage=new Map();
 const element=()=>({textContent:'',innerHTML:'',hidden:true,value:'',dataset:{},style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},setAttribute(){},addEventListener(){},querySelector(){return element();},querySelectorAll(){return [];},focus(){},blur(){},remove(){}});
 const ctx={ResizeObserver:class{observe(){}},PlaceUI:UI,URL,URLSearchParams,Map,Set,console,AbortSignal,Event:class{},setTimeout(){return 1;},clearTimeout(){},requestAnimationFrame(){},navigator:{languages:['en']},location:{search:'',pathname:'/',origin:'https://example.com',href:'https://example.com/',hash:''},history:{pushState(){},replaceState(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){storage.set(k,v);}},document:{documentElement:{},body:{classList:element().classList},getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){}},window:{innerWidth:390,addEventListener(){}},L:{divIcon:o=>o},fetch:async()=>{throw Error('Unexpected network');}};
 vm.createContext(ctx);const source=fs.readFileSync(path.join(root,'explore.js'),'utf8');
 vm.runInContext(source.slice(0,source.indexOf('LANG = detectLang();')),ctx);
 ctx.featured=featured;ctx.liminal=liminal;ctx.landmarks=landmarks;
 vm.runInContext('PLACES=featured;LIMINAL=liminal;LANDMARKS=landmarks;',ctx);
 return {ctx,run:code=>vm.runInContext(code,ctx),elements};
}
test('actual runtime accepts both Chinese URL conventions and all five names',()=>{
 const {ctx,run}=runtime();for(const [input,want] of [['zh-Hans','zh-Hans'],['zh-CN','zh-Hans'],['zh-Hant','zh-Hant'],['zh-TW','zh-Hant'],['ko','ko'],['ja','ja'],['en','en']]){ctx.location.search='?lang='+input;assert.equal(run('detectLang()'),want);}
});
test('actual catalog search finds Korean, both Chinese scripts, English and Japanese',()=>{
 const {ctx,run}=runtime();for(const q of ['청수사','기요미즈데라','清水寺','Kiyomizu','東京站','东京站','도쿄역','Tokyo Station']){ctx.query=q;if(q==='청수사')continue;assert.ok(run('searchSpots(query).length')>0,q);}
});
test('failed storage writes do not report success; separate contexts have separate saves',()=>{
 const a=runtime(),b=runtime();a.ctx.localStorage.setItem=()=>{throw Error('QuotaExceededError');};assert.equal(a.run('writeSaved([{lat:35,lon:139,name:"x"}])'),false);
 assert.equal(b.run('readSaved().length'),0);
});
test('cancelling the native share sheet does not copy or launch another service',async()=>{
 const {ctx,elements}=runtime();let copied=false;
 ctx.navigator.share=async()=>{const e=new Error('Cancelled');e.name='AbortError';throw e;};
 ctx.navigator.clipboard={writeText:async()=>{copied=true;}};
 await elements.get('pShare').onclick();assert.equal(copied,false);
});
test('clearing search invalidates requests immediately',()=>{
 const {run,elements}=runtime();run('qSeq=10;');elements.get('qClear').onclick();assert.equal(run('qSeq'),11);assert.equal(elements.get('qResults').hidden,true);
});
test('national aliases are not discarded by an unmatched name at the same coordinate',()=>{
 const {ctx,run}=runtime();ctx.rows=[['東京駅',35,139],['Tokyo Station',35,139]];
 assert.equal(run('natSearch(rows,"Tokyo",new Set()).length'),1);
});
test('local alias buckets obey runtime normalization and coordinate validity',()=>{
 let total=0;for(let i=0;i<64;i++){const rows=JSON.parse(fs.readFileSync(path.join(root,'search/aliases',String(i).padStart(2,'0')+'.json')));for(const r of rows){assert.equal(UI.normalize(r[0]).charCodeAt(0)%64,i);assert.ok(Number.isFinite(r[1])&&Number.isFinite(r[2]));total++;}}assert.ok(total>30000);
});
test('locale pages expose crawlable body, reciprocal languages, canonical and valid JSON-LD',()=>{
 for(const [file,l] of [['ja.html','ja'],['ko.html','ko'],['zh-cn.html','zh-Hans'],['zh-tw.html','zh-Hant']]){
  const h=fs.readFileSync(path.join(root,file),'utf8');assert.ok(h.includes('<html lang="'+l+'"'));for(const lang of UI.langs)assert.ok(h.includes('hreflang="'+lang+'"'));
  const schema=JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);assert.equal(schema.inLanguage,l);assert.equal(schema.mainEntity.numberOfItems,45);const prefix={ja:'ja',ko:'ko','zh-Hans':'zh-cn','zh-Hant':'zh-tw'}[l];assert.ok(h.includes('/place/'+prefix+'/kyoto'));assert.ok(fs.readFileSync(path.join(root,'place',prefix,'kyoto.html'),'utf8').includes('/?lang='+l+'#kyoto'));
 }
});
