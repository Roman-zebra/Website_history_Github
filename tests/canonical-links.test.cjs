/* Crawl signals: every link a search engine can follow names the canonical URL. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const places=JSON.parse(read('data/places-world.json')).places,liminal=JSON.parse(read('data/liminal.json')).places;
const htmlIn=d=>fs.readdirSync(path.join(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?htmlIn(path.join(d,e.name)):e.name.endsWith('.html')?[path.join(d,e.name)]:[]);
const crawlable=()=>['index.html','explore.html','ja.html','ko.html','zh-cn.html','zh-tw.html','th.html','places.html','visit.html','about.html',...htmlIn('place'),...htmlIn('guides'),...htmlIn('visit')];

function app(){
 const elements=new Map(),replaced=[];
 const element=()=>({textContent:'',innerHTML:'',hidden:false,value:'',dataset:{},attrs:{},style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},setAttribute(k,v){this.attrs[k]=v;},addEventListener(){},querySelector(){return element();},querySelectorAll(){return [];},focus(){},blur(){},remove(){},before(){}});
 const seo=element();
 const ctx={ResizeObserver:class{observe(){}},PlaceUI:require('../place-ui.js'),URL,URLSearchParams,Map,Set,console,AbortSignal,Event:class{},setTimeout(){return 1;},clearTimeout(){},requestAnimationFrame(){},navigator:{languages:['en']},
  location:{search:'',pathname:'/',origin:'https://japantimeatlas.com',href:'https://japantimeatlas.com/',hash:''},
  history:{state:null,pushState(){},replaceState(state,title,url){replaced.push(url);}},localStorage:{getItem:()=>null,setItem(){}},
  document:{documentElement:{},body:{classList:element().classList},getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelector:s=>s==='.seo-list'?seo:null,querySelectorAll(){return [];},addEventListener(){}},
  window:{innerWidth:1200,addEventListener(){}},L:{divIcon:o=>o},fetch:async()=>{throw Error('Unexpected network');}};
 vm.createContext(ctx);vm.runInContext(read('activities-data.js'),ctx);
 const source=read('explore.js');vm.runInContext(source.slice(0,source.indexOf('LANG = detectLang();')),ctx);
 return {ctx,elements,seo,replaced,run:s=>vm.runInContext(s,ctx)};
}

test('no crawlable page reaches a place through a #hash or a .html duplicate',()=>{
 const ids=new Set([...places.map(p=>p.id),...liminal.map(p=>'l-'+p.id)]);
 for(const file of crawlable()){const s=read(file);
  for(const [,href] of s.matchAll(/href=["']([^"']+)["']/g)){
   const [before,hash]=href.split('#');
   assert.ok(!ids.has(hash),file+' -> '+href);
   assert.ok(!/(^|\/)(index|ja|ko|zh-cn|zh-tw|th|places|about|visit)\.html$/.test(before.split('?')[0]),file+' -> '+href);
  }
  assert.ok(!/japantimeatlas\.com\/\?lang=[^"]*#l-/.test(s),file+' structured data');
 }
});

test('home cards and the place list link to articles in the reader\'s language',()=>{
 const {ctx,elements,seo,run}=app();ctx.places=places;ctx.liminal=liminal;run('PLACES=places;LIMINAL=liminal;');
 for(const [lang,dir] of [['en',''],['ja','ja/'],['ko','ko/'],['zh-Hans','zh-cn/'],['zh-Hant','zh-tw/']]){
  ctx.lang=lang;run('LANG=lang;mode="places";buildCards();paintDirectory();');
  const cards=elements.get('cards').innerHTML,list=seo.innerHTML;
  for(const p of places){assert.ok(cards.includes('href="/place/'+dir+p.id+'"'),lang+' card '+p.id);assert.ok(list.includes('href="/place/'+dir+p.id+'"'),lang+' list '+p.id);}
  for(const href of ['/','/ja','/ko','/zh-cn','/zh-tw','/th'])assert.ok(list.includes('href="'+href+'"'),lang+' '+href);
  assert.ok(![...list.matchAll(/href="([^"]+)"/g)].some(m=>/\.html|#/.test(m[1])),lang+' list links');
  run('mode="liminal";buildCards();');const lim=elements.get('cards').innerHTML;
  for(const p of liminal)assert.ok(lim.includes('href="/place/l-'+p.id+'"'),lang+' '+p.id);
 }
});

test('map links from articles arrive as a query and become the hash the app routes on',()=>{
 const {ctx,replaced,run}=app();
 for(const [href,expected] of [
  ['https://japantimeatlas.com/?lang=ja&place=hiroshima','/?lang=ja#hiroshima'],
  ['https://japantimeatlas.com/?lang=en&place=l-doai-station','/?lang=en#l-doai-station'],
  ['https://japantimeatlas.com/?lang=en&name=Himeji%20Castle&spot=34.83944,134.69389','/?lang=en&name=Himeji+Castle#spot=34.83944,134.69389'],
  ['https://japantimeatlas.com/?place=tokyo#hiroshima','/#hiroshima'],
  ['https://japantimeatlas.com/?place=%3Cscript%3E','/']
 ]){ctx.location.href=href;replaced.length=0;run('consumeMapQuery()');assert.equal(replaced.at(-1),expected,href);}
 ctx.location.href='https://japantimeatlas.com/?lang=en#tokyo';replaced.length=0;run('consumeMapQuery()');assert.equal(replaced.length,0);
});

test('duplicate spellings answer with a permanent redirect and the rules ship in the build',()=>{
 const rules=read('_redirects').split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#')).map(s=>s.split(/\s+/));
 const to=Object.fromEntries(rules.map(r=>[r[0],r[1]]));
 for(const r of rules){assert.equal(r.length,3,r.join(' '));assert.equal(r[2],'301');assert.ok(!/[:*]/.test(r[0]),'static rules only: '+r[0]);assert.notEqual(r[0],r[1]);assert.ok(!(r[1] in to),'redirect chain via '+r[1]);}
 for(const [from,dest] of Object.entries({'/index.html':'/','/ja.html':'/ja','/ko.html':'/ko','/zh-cn.html':'/zh-cn','/zh-tw.html':'/zh-tw','/th.html':'/th'}))assert.equal(to[from],dest);
 for(const dest of Object.values(to))assert.ok(fs.existsSync(path.join(root,dest==='/'?'index.html':dest.slice(1)+'.html')),dest);
 assert.match(read('scripts/build.cjs'),/'_redirects'/);
});

test('articles, guides and language pages carry no tour or affiliate links',()=>{
 for(const file of crawlable().filter(f=>!['index.html','explore.html','about.html'].includes(f)))assert.ok(!/getyourguide|klook|affiliate-router|gyg-/i.test(read(file)),file);
 for(const file of ['index.html','explore.html']){const s=read(file);assert.ok(!/<a[^>]+(getyourguide|klook)\./i.test(s.slice(0,s.indexOf('<div id="cards"'))),file+' first view');}
});
