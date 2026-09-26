/* The supporters page: a name typed into the Ko-fi support form reaches /supporters as it was written, only with a
   real payment (the webhook's verification token), only when the supporter did not choose private, and nothing else
   about the payment is kept. The page says so in all six languages, next to every support button. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const load=()=>import(pathToFileURL(path.join(root,'worker.mjs')).href),helpers=()=>import(pathToFileURL(path.join(root,'supporters.mjs')).href);
const TOKEN='5f1b2c3d-kofi-token',KOFI='https://ko-fi.com/japantimeatlas',LANGS=['ja','en','ko','zh-Hans','zh-Hant','th'];

/* Durable Object storage as the Worker sees it: async get/put/list/delete. */
function storage(){const m=new Map();return {m,
 async put(k,v){m.set(k,structuredClone(v));},async get(k){return structuredClone(m.get(k));},
 async list({prefix=''}={}){return new Map([...m].filter(([k])=>k.startsWith(prefix)).sort(([a],[b])=>a<b?-1:1).map(([k,v])=>[k,structuredClone(v)]));},
 async delete(keys){if(!Array.isArray(keys))return m.delete(keys);assert.ok(keys.length<=128,'at most 128 keys per delete');let n=0;for(const k of keys)if(m.delete(k))n++;return n;}};}

async function site({token=TOKEN,bound=true,broken=false}={}){
 const w=await load(),store=storage(),book=new w.SupporterBook({storage:store},{}),html=read('supporters.html'),seen=[];
 const env={ASSETS:{fetch:async req=>{seen.push(req);const u=new URL(req.url);
  if(u.pathname!=='/supporters')return new Response('no',{status:404});
  if(req.headers.get('If-None-Match')==='"static"')return new Response(null,{status:304});
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','ETag':'"static"','Cache-Control':'no-cache'}});}}};
 if(token)env.KOFI_VERIFICATION_TOKEN=token;
 if(bound)env.SUPPORTERS={idFromName:n=>n,get:()=>({fetch:async(input,init)=>{if(broken)throw new Error('unreachable');return book.fetch(new Request(input,init));}})};
 const call=(p,init)=>w.default.fetch(new Request('https://japantimeatlas.com'+p,init),env);
 const kofi=p=>call('/api/kofi',{method:'POST',body:new URLSearchParams({data:JSON.stringify(p)})});
 const listed=async(init)=>{const r=await call('/supporters',init);assert.equal(r.status,200);const s=await r.text();
  const ul=s.match(/<ul class="supporter-list">([\s\S]*?)<\/ul>/);return {r,s,names:ul?[...ul[1].matchAll(/<li dir="auto">([\s\S]*?)<\/li>/g)].map(m=>m[1]):[]};};
 return {w,env,store,seen,call,kofi,listed};
}

let n=0;
/* The shape Ko-fi posts (help.ko-fi.com, "Does Ko-fi have an API or webhook?"). */
const payment=(o={})=>{n++;return {verification_token:TOKEN,message_id:'msg-'+n,timestamp:'2026-09-26T10:'+String(n%60).padStart(2,'0')+':00Z',type:'Donation',is_public:true,
 from_name:'Taro',message:'Keep walking!',amount:'5.00',url:'https://ko-fi.com/Home/CoffeeShop?txid=tx-'+n,email:'taro@example.com',currency:'JPY',
 is_subscription_payment:false,is_first_subscription_payment:false,kofi_transaction_id:'tx-'+n,shop_items:null,tier_name:null,shipping:null,...o};};

test('a public donation puts the name on /supporters exactly as typed, in place of the empty note',async()=>{
 const {kofi,listed,store}=await site();
 const before=await listed();
 assert.deepEqual(before.names,[]);assert.equal((before.s.match(/class="supporters-none"/g)||[]).length,6);
 const r=await kofi(payment({from_name:'山田　花子 (Hanako) 🌸'}));
 assert.equal(r.status,200);assert.equal(store.m.size,1);
 const after=await listed();
 assert.deepEqual(after.names,['山田　花子 (Hanako) 🌸']);
 assert.equal((after.s.match(/class="supporters-none"/g)||[]).length,0,'the "nobody yet" lines go once there is a name');
 assert.ok(!after.s.includes('<!--supporters-->'));
 assert.equal(after.r.headers.get('Cache-Control'),'no-cache');assert.equal(after.r.headers.get('ETag'),null);
});

test('newest first, each name once; a webhook Ko-fi sends again is not a second entry; memberships count',async()=>{
 const {kofi,listed,store}=await site();
 const first=payment({from_name:'Aki',timestamp:'2026-09-01T00:00:00Z'});
 await kofi(first);await kofi(first);
 await kofi(payment({from_name:'Ben',timestamp:'2026-09-02T00:00:00Z',type:'Subscription',is_subscription_payment:true,is_first_subscription_payment:true,tier_name:'Walker'}));
 await kofi(payment({from_name:'Aki',timestamp:'2026-09-03T00:00:00Z'}));
 await kofi(payment({from_name:'Chie',timestamp:'2026-08-30T00:00:00Z'}));
 assert.equal(store.m.size,4,'one entry per payment');
 assert.deepEqual((await listed()).names,['Aki','Ben','Chie']);
});

test('private support, no name, Ko-fi\'s "Someone", purchases and the test button stay off the page',async()=>{
 const {kofi,listed,store}=await site();
 for(const p of [payment({is_public:false,from_name:'Hidden'}),payment({is_public:undefined,from_name:'Unsaid'}),payment({from_name:''}),payment({from_name:' \n\t '}),
  payment({from_name:null}),payment({from_name:'Someone'}),payment({type:'Shop Order',from_name:'Buyer'}),payment({type:'Commission',from_name:'Client'}),
  payment({from_name:'Jo Example',kofi_transaction_id:'00000000-1111-2222-3333-444444444444'})]){
  const r=await kofi(p);assert.equal(r.status,200,'Ko-fi must not retry these');}
 assert.equal(store.m.size,0);assert.deepEqual((await listed()).names,[]);
});

test('only the name, the time and the transaction id are stored: no e-mail, amount or message',async()=>{
 const {kofi,store}=await site();
 await kofi(payment({from_name:'Dan',email:'dan@example.com',amount:'12.34',message:'a private thought'}));
 const saved=JSON.stringify([...store.m]);
 assert.deepEqual(Object.keys([...store.m.values()][0]).sort(),['at','name']);
 for(const s of ['dan@example.com','12.34','a private thought','JPY'])assert.ok(!saved.includes(s),s);
});

test('without the right verification token nothing is stored, and the webhook says why',async t=>{
 t.mock.method(console,'error',()=>{});
 const {kofi,call,store}=await site();
 assert.equal((await kofi(payment({verification_token:'guess'}))).status,403);
 assert.equal((await kofi(payment({verification_token:TOKEN+'x'}))).status,403);
 assert.equal((await kofi(payment({verification_token:undefined}))).status,403);
 assert.equal((await call('/api/kofi',{method:'POST',body:new URLSearchParams({data:'{not json'})})).status,400);
 assert.equal((await call('/api/kofi',{method:'POST',body:JSON.stringify(payment()),headers:{'Content-Type':'application/json'}})).status,400);
 assert.equal((await call('/api/kofi',{method:'POST',body:new URLSearchParams({data:JSON.stringify(payment({message:'x'.repeat(70000)}))})})).status,400,'oversized body');
 const get=await call('/api/kofi');assert.equal(get.status,405);assert.equal(get.headers.get('Allow'),'POST');
 assert.equal(store.m.size,0);
 const unset=await site({token:null});assert.equal((await unset.kofi(payment())).status,503,'no secret: refuse everything');
 const unbound=await site({bound:false});assert.equal((await unbound.kofi(payment())).status,503);
 const broken=await site({broken:true});assert.equal((await broken.kofi(payment())).status,500,'Ko-fi retries anything but 200');
});

test('names are shown as text: markup escaped, "$" patterns literal, controls out, long names shortened',async()=>{
 const {kofi,listed}=await site();
 await kofi(payment({from_name:'<img src=x onerror=alert(1)>',timestamp:'2026-09-05T00:00:00Z'}));
 await kofi(payment({from_name:'$& $\' $` $1 "quoted"',timestamp:'2026-09-04T00:00:00Z'}));
 await kofi(payment({from_name:'evil\u202egnp.exe\u0000\u200b',timestamp:'2026-09-03T00:00:00Z'}));
 await kofi(payment({from_name:'long '.repeat(30),timestamp:'2026-09-02T00:00:00Z'}));
 const {s,names}=await listed();
 assert.ok(!s.includes('<img src=x'));
 assert.deepEqual(names.slice(0,3),['&lt;img src=x onerror=alert(1)&gt;','$&amp; $&#39; $` $1 &quot;quoted&quot;','evil gnp.exe']);
 assert.ok(!s.includes('\u202e'));
 const long=names[3];assert.ok(long.endsWith('\u2026'));assert.equal([...long].length,50);
 const {displayName}=await helpers();
 assert.equal(displayName(displayName('long '.repeat(30))),displayName('long '.repeat(30)),'shortening twice changes nothing');
 const coder='\u{1F469}\u200d\u{1F4BB}';assert.equal(displayName(coder.repeat(60)).split(coder).length-1,49,'a character built from several code points is never cut in half');
 assert.equal(displayName('山田　花子'),'山田　花子','a full-width space inside a name stays as typed');
});

test('the owner can take a name down with the same token; nobody else can',async()=>{
 const {kofi,call,listed}=await site();
 await kofi(payment({from_name:'Rude Words',timestamp:'2026-09-01T00:00:00Z'}));await kofi(payment({from_name:'Rude Words',timestamp:'2026-09-02T00:00:00Z'}));
 await kofi(payment({from_name:'Kind Words',timestamp:'2026-09-03T00:00:00Z'}));
 const remove=(auth,name)=>call('/api/supporters/remove',{method:'POST',headers:auth?{Authorization:auth}:{},body:new URLSearchParams({name})});
 assert.equal((await remove(null,'Rude Words')).status,403);
 assert.equal((await remove('Bearer wrong','Rude Words')).status,403);
 assert.equal((await remove('Bearer '+TOKEN,'')).status,400);
 const ok=await remove('Bearer '+TOKEN,'Rude Words');assert.equal(ok.status,200);assert.match(await ok.text(),/removed 2 entries/);
 assert.deepEqual((await listed()).names,['Kind Words']);
 assert.equal((await call('/api/supporters/remove')).status,405);
});

test('the page still opens when the names cannot be read, and a HEAD request gets no body',async t=>{
 const logged=t.mock.method(console,'error',()=>{});
 for(const opts of [{bound:false},{broken:true}]){
  const {listed}=await site(opts);const {s,names}=await listed();
  assert.deepEqual(names,[]);assert.equal((s.match(/class="supporters-none"/g)||[]).length,6,JSON.stringify(opts));}
 assert.equal(logged.mock.callCount(),1,'an unreachable store is logged; an unbound one is not');
 const {kofi,call}=await site();await kofi(payment({from_name:'Eri'}));
 const head=await call('/supporters',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
});

test('the static page is fetched without the browser\'s If-None-Match, so a 304 never hides a new name',async()=>{
 const {kofi,seen,listed}=await site();await kofi(payment({from_name:'Fumi'}));
 const {names}=await listed({headers:{'If-None-Match':'"static"'}});
 assert.deepEqual(names,['Fumi']);assert.equal(seen.at(-1).headers.get('If-None-Match'),null);
});

test('every other address still goes to the static files and the audio ranges',async()=>{
 const w=await load(),seen=[];
 const env={ASSETS:{fetch:async req=>{seen.push(new URL(req.url).pathname);return new Response('static',{status:200});}}};
 for(const p of ['/about','/supporters.html','/api','/apiary','/supporters/x']){const r=await w.default.fetch(new Request('https://japantimeatlas.com'+p),env);assert.equal(await r.text(),'static',p);}
 assert.deepEqual(seen,['/about','/supporters.html','/api','/apiary','/supporters/x']);
});

test('supporters.html says in all six languages, beside each support button, that the name is published as written',()=>{
 const s=read('supporters.html');
 assert.ok(s.includes('<link rel="canonical" href="https://japantimeatlas.com/supporters">'));
 assert.equal((s.match(/<!--supporters-->/g)||[]).length,1);assert.equal((s.match(/<!--\/supporters-->/g)||[]).length,1);
 assert.ok(s.indexOf('<!--supporters-->')<s.indexOf('<!--/supporters-->'));
 for(const id of LANGS){
  assert.match(s,new RegExp('<section id="'+id+'" lang="'+id+'" class="founder-note"><h2>'),id+' section');
  assert.match(s,new RegExp('<p class="supporters-none" data-lang="'+id+'" lang="'+id+'">'),id+' empty note');
  const tail=s.match(new RegExp('<div data-lang="'+id+'" lang="'+id+'">([\\s\\S]*?)</div>'));assert.ok(tail,id+' notice');
  const aside=tail[1].match(/<aside class="name-note">([\s\S]*?)<\/aside>/)[1];
  assert.ok(aside.includes('<strong>'),id+': the notice that names are public');
  assert.ok(aside.includes('Private'),id+': how to stay off the list');
  assert.ok(aside.includes('(Name)')||aside.includes('（Name）')||aside.includes('Name box'),id+': which box on the form');
  assert.ok(aside.indexOf('<strong>')<aside.indexOf(KOFI),id+': the notice comes before the button');
  assert.match(aside,new RegExp('<a class="support-link" href="'+KOFI+'" target="_blank" rel="noopener">'),id+' button');
 }
 assert.ok(read('about.js').includes('[data-lang]'),'about.js switches the per-language blocks too');
});

test('the About page tells readers the same thing before its button and links to the supporters page',()=>{
 const s=read('about.html');
 for(const id of LANGS){
  const section=s.slice(s.indexOf('id="'+id+'"'),s.indexOf('</section>',s.indexOf('id="'+id+'"')));
  const link=section.indexOf('href="/supporters#'+id+'"');
  assert.ok(link>0,id+' links to /supporters#'+id);assert.ok(link<section.indexOf(KOFI),id+': the notice comes before the button');
  assert.ok(section.includes('Private'),id+': how to stay off the list');
 }
});

test('wrangler creates the name store on deploy; the page ships, the worker modules do not',()=>{
 const c=JSON.parse(read('wrangler.jsonc'));
 assert.deepEqual(c.durable_objects.bindings,[{name:'SUPPORTERS',class_name:'SupporterBook'}]);
 assert.ok(c.migrations.some(m=>(m.new_sqlite_classes||[]).includes('SupporterBook')),'SQLite storage: no id to create by hand, and it runs on the Free plan');
 assert.ok(!c.migrations.some(m=>(m.new_classes||[]).includes('SupporterBook')));
 assert.ok(!/KOFI_VERIFICATION_TOKEN/.test(read('wrangler.jsonc')),'the token is a secret, never in the repository');
 const build=read('scripts/build.cjs');
 assert.ok(build.includes("'supporters.html'"));assert.ok(!build.includes("'supporters.mjs'"),'deployed by wrangler, not copied into dist');
 assert.ok(read('sitemap.xml').includes('<loc>https://japantimeatlas.com/supporters</loc>'));
 assert.match(read('_redirects'),/^\/supporters\.html \/supporters 301\r?$/m);
 assert.match(read('_headers'),/^\/supporters\r?\n  Cache-Control: no-cache/m);
});
