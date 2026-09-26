/* The site carries no advertising. The only money link is Ko-fi, and only /support carries it: that page says what
   reaches the owner and what never does before anyone pays, and every other page sends its readers there first. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),KOFI='https://ko-fi.com/japantimeatlas',LANGS=['ja','en','ko','zh-Hans','zh-Hant','th'];
const htmlIn=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
 if(['.git','dist','vendor','node_modules','tests','scripts','data','icons'].includes(e.name))return [];
 const p=path.join(dir,e.name);return e.isDirectory()?htmlIn(p):e.name.endsWith('.html')?[p]:[];});
const pages=htmlIn(root),rel=p=>path.relative(root,p).split(path.sep).join('/');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const section=(s,id)=>{const i=s.indexOf('<section id="'+id+'"');assert.ok(i>=0,'no '+id+' section');return s.slice(i,s.indexOf('</section>',i));};
/* kids.html is written for children and carries no site footer, so it asks for nothing. */
const EXEMPT=['kids.html','visit.html'];

test('no page loads an advert or an affiliate script',()=>{
 for(const p of pages){const s=fs.readFileSync(p,'utf8');
  assert.ok(!/getyourguide|klook|viator|stay22|adsbygoogle|googlesyndication|affiliate|gyg/i.test(s),rel(p));}
 for(const gone of ['affiliate-router.js','affiliate-config.json','gyg-products.js','gyg-widget.js','gyg-frame.html','data/affiliate.json'])
  assert.ok(!fs.existsSync(path.join(root,gone)),gone+' still exists');
});

test('every page with a site footer offers the support page in its own language',()=>{
 const withFooter=pages.filter(p=>!EXEMPT.includes(rel(p))&&rel(p)!=='support.html'&&/site-about-link|<footer/.test(fs.readFileSync(p,'utf8')));
 assert.ok(withFooter.length>50,'expected the whole site, got '+withFooter.length);
 for(const p of withFooter){const s=fs.readFileSync(p,'utf8'),lang=/<html[^>]*\blang="([^"]+)"/.exec(s)[1];
  assert.ok(s.includes('href="/support#'+lang+'"'),rel(p)+' has no support link in '+lang);}
 for(const p of pages){const s=fs.readFileSync(p,'utf8');
  assert.ok(!/href="\/support(?!#(ja|en|ko|zh-Hans|zh-Hant|th)")/.test(s),rel(p)+' links to /support without one of its languages');}
});

test('nothing but the support page links straight to Ko-fi',()=>{
 for(const p of pages)if(rel(p)!=='support.html')
  assert.ok(!/<a[^>]*href="https:\/\/ko-fi\.com/.test(fs.readFileSync(p,'utf8')),rel(p)+' skips the support page and links straight to Ko-fi');
 const s=read('support.html');
 assert.ok(!/ko-fi\.com\/(?!japantimeatlas"|privacy")/.test(s),'the support page points at another Ko-fi page');
 for(const m of s.matchAll(/<a[^>]*href="https:\/\/[^"]*"[^>]*>/g))assert.match(m[0],/rel="noopener"/,'external link needs rel=noopener: '+m[0]);
});

test('in all six languages the support page says what the owner can see before the Ko-fi button',()=>{
 const s=read('support.html');
 assert.equal((s.match(new RegExp('href="'+KOFI+'"','g'))||[]).length,6,'one Ko-fi button per language section');
 for(const id of LANGS){const t=section(s,id),button=t.indexOf(KOFI);
  assert.ok(t.includes('lang="'+id+'"'),id+' section carries its language');
  // the reader meets the card, email and privacy facts before the button, not after it
  for(const word of ['Stripe','PayPal','Somebody','Private Message'])assert.ok(t.indexOf(word)>=0&&t.indexOf(word)<button,id+' explains '+word+' before the Ko-fi button');
  assert.ok(t.indexOf('class="never"')<button&&t.indexOf('class="promise"')<button,id+' lists what never reaches the owner and the promise before the button');
  for(const policy of ['https://more.ko-fi.com/privacy','https://stripe.com/privacy','https://www.paypal.com/'])assert.ok(t.includes('href="'+policy),id+' links '+policy);
  assert.ok(t.includes('href="/about#'+id+'"'),id+' links back to its About section');}
 assert.ok(read('_redirects').includes('/support.html /support 301'));
 assert.ok(read('sitemap.xml').includes('<loc>https://japantimeatlas.com/support</loc>'));
});

test('the about page sends each language to its own part of the support page and names the hashtags',()=>{
 const s=read('about.html');
 assert.ok(!s.includes(KOFI),'the about page links straight to Ko-fi');
 assert.equal((s.match(/#JapanTimeAtlas/g)||[]).length,6,'every language names the shared hashtag');
 assert.ok(s.includes('#\u4eca\u6614\u3042\u308b\u304d'),'the Japanese section names the Japanese hashtag');
 for(const id of LANGS)assert.ok(section(s,id).includes('href="/support#'+id+'"'),id+' section has no support link to its language');
});

test('the map points its header and footer support links at the reader\'s language',()=>{
 /* the same stand-in document as canonical-links.test.cjs, with the three support anchors the app shells carry */
 const element=()=>({href:'',textContent:'',innerHTML:'',hidden:false,value:'',dataset:{},attrs:{},style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},setAttribute(k,v){this.attrs[k]=v;},addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];},focus(){},blur(){},remove(){},before(){}});
 const found={'.site-support-link':[element(),element()],'.head-support':[element()]},elements=new Map();
 const ctx={ResizeObserver:class{observe(){}},PlaceUI:require('../place-ui.js'),URL,URLSearchParams,Map,Set,console,
  navigator:{languages:['en']},location:{search:'',pathname:'/',origin:'https://japantimeatlas.com',href:'https://japantimeatlas.com/',hash:''},
  history:{replaceState(){}},localStorage:{getItem:()=>null,setItem(){}},setTimeout(){return 1;},clearTimeout(){},
  document:{documentElement:{},body:{classList:element().classList},getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelector:()=>null,
   querySelectorAll:s=>found[s]||[],addEventListener(){}},window:{innerWidth:1200,addEventListener(){}},L:{divIcon:o=>o},AbortSignal,Event:class{},requestAnimationFrame(){},fetch:async()=>{throw Error('Unexpected network');}};
 vm.createContext(ctx);vm.runInContext(read('activities-data.js'),ctx);
 const source=read('explore.js');vm.runInContext(source.slice(0,source.indexOf('LANG = detectLang();')),ctx);
 for(const lang of LANGS){ctx.lang=lang;vm.runInContext('LANG=lang;paintDirectory();',ctx);
  for(const a of [...found['.site-support-link'],...found['.head-support']])assert.equal(a.href,'/support#'+lang,lang);}
});
