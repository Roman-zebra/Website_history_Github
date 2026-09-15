/* Titles of the 3D pages: hand-written candidates, the weekly choice from Search Console, the Search Console
   reader and the ownership tags. No network: Search Console is replaced by a stub. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const seo=require('../scripts/seo/titles.cjs'),gsc=require('../scripts/seo/gsc.cjs');
const PAGES={en:'3d/gunkanjima.html',ja:'3d/ja/gunkanjima.html',ko:'3d/ko/gunkanjima.html','zh-Hans':'3d/zh-cn/gunkanjima.html','zh-Hant':'3d/zh-tw/gunkanjima.html'};
const esc=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const day=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);

test('every candidate title fits, names the island and needs no escaping',()=>{
 const c=seo.loadCandidates();
 assert.deepEqual(seo.validate(c),[]);
 assert.deepEqual(Object.keys(c.langs).sort(),Object.keys(PAGES).sort());
 for(const [code,page] of Object.entries(c.pages))assert.ok(PAGES[code].startsWith(page.slice(1)),code+' page');
});

test('each page carries its live candidate, and the page script does not put the old title back',()=>{
 const c=seo.loadCandidates(),state=seo.loadState();
 for(const [code,file] of Object.entries(PAGES)){
  const s=read(file),live=seo.pick(code,c,state);
  assert.ok(c.langs[code].candidates.some(x=>x.id===state.langs[code].current),code+' state names a candidate');
  assert.equal(live.id,state.langs[code].current,code+' live id');
  assert.ok(s.includes('<title>'+esc(live.title)+'</title>'),code+' title');
  assert.ok(s.includes('<meta name="description" content="'+esc(live.description)+'">'),code+' description');
  assert.ok(s.includes('<meta property="og:title" content="'+esc(live.title)+'">'),code+' og:title');
  assert.ok(!s.includes('document.title ='),code+' no title set by the script');
 }
});

const CANDS={site:'https://x.test',pages:{en:'/3d/gunkanjima'},langs:{en:{mustInclude:'Gunkanjima',maxLead:60,exclude:['jpn'],candidates:[
 {id:'a',lead:'Gunkanjima in 3D, 1947 to Today',description:'d'.repeat(90)},
 {id:'b',lead:'Gunkanjima Before It Was Abandoned',description:'e'.repeat(90)},
 {id:'c',lead:'Gunkanjima Tour Boats',description:'f'.repeat(90)}]}}};
const URL='https://x.test/3d/gunkanjima';
const q=(query,impressions,position=8,country='usa')=>({page:URL,query,country,clicks:0,impressions,position});
const range=today=>({queries:[day(today,-30),day(today,-3)],daily:[day(today,-182),day(today,-3)]});

test('before Search Console, the suggestions choose once and the choice then holds',()=>{
 const suggest={langs:{en:{phrases:{'gunkanjima before it was abandoned':3,'gunkanjima 3d':1}}}};
 const first=seo.decide({candidates:CANDS,state:{},suggest,today:'2026-09-15'});
 assert.equal(first.decisions[0].action,'switch');
 assert.equal(first.state.langs.en.current,'b');
 assert.equal(first.state.langs.en.basis,'suggestions');
 const again=seo.decide({candidates:CANDS,state:first.state,suggest,today:'2026-09-22'});
 assert.equal(again.decisions[0].action,'keep');
});

test('a title the site owner picked is not replaced by the suggestions, only by Search Console after the cooldown',()=>{
 const suggest={langs:{en:{phrases:{'gunkanjima before it was abandoned':3}}}};
 const state={langs:{en:{current:'c',since:'2026-09-15',basis:'owner',previous:'a',blocked:{}}},periods:[],log:[]};
 const quiet=seo.decide({candidates:CANDS,state,suggest,today:'2026-11-01'});
 assert.equal(quiet.decisions[0].action,'keep');
 assert.equal(quiet.state.langs.en.current,'c');
 const gsc={range:range('2026-11-01'),queries:[q('gunkanjima before it was abandoned',400)],daily:[]};
 const early=seo.decide({candidates:CANDS,state,suggest,gsc,today:'2026-10-01'});
 assert.equal(early.decisions[0].action,'keep','within 28 days of the owner choosing');
 const later=seo.decide({candidates:CANDS,state,suggest,gsc,today:'2026-11-01'});
 assert.equal(later.decisions[0].action,'switch');
 assert.equal(later.state.langs.en.current,'b');
});

test('Search Console demand changes a title only after the cooldown, counting only the page markets',()=>{
 const state={langs:{en:{current:'a',since:'2026-09-15',basis:'suggestions',previous:null,blocked:{}}},periods:[],log:[]};
 const data=today=>({range:range(today),queries:[q('gunkanjima before it was abandoned',400),q('gunkanjima 3d',60),q('gunkanjima tour boats',5000,3,'jpn')],daily:[]});
 const early=seo.decide({candidates:CANDS,state,gsc:data('2026-10-01'),today:'2026-10-01'});
 assert.equal(early.decisions[0].action,'keep');
 assert.match(early.decisions[0].reason,/cooldown/);
 const later=seo.decide({candidates:CANDS,state,gsc:data('2026-10-20'),today:'2026-10-20'});
 assert.equal(later.decisions[0].action,'switch');
 assert.equal(later.state.langs.en.current,'b','Japan is outside the English page markets, so the tour query does not count');
 assert.deepEqual(later.state.periods,[{lang:'en',id:'a',from:'2026-09-15',to:'2026-10-19'}]);
 assert.equal(later.decisions[0].impressions,460);
 const thin=seo.decide({candidates:CANDS,state,gsc:{range:range('2026-10-20'),queries:[q('gunkanjima before it was abandoned',40)],daily:[]},today:'2026-10-20'});
 assert.equal(thin.decisions[0].action,'keep');
 assert.match(thin.decisions[0].reason,/not enough/);
});

test('a title that earns fewer clicks at the same positions is rolled back and kept out for 90 days',()=>{
 const state={langs:{en:{current:'b',since:'2026-10-20',basis:'search-console',previous:'a',blocked:{}}},periods:[{lang:'en',id:'a',from:'2026-09-15',to:'2026-10-19'}],log:[]};
 const daily=[];
 for(let i=0;i<35;i++)daily.push({page:URL,date:day('2026-09-15',i),country:'usa',clicks:6,impressions:100,position:5});
 for(let i=0;i<30;i++)daily.push({page:URL,date:day('2026-10-20',i),country:'usa',clicks:1,impressions:100,position:5});
 const today='2026-11-22',queries=[q('gunkanjima before it was abandoned',400)];
 const r=seo.decide({candidates:CANDS,state,gsc:{range:range(today),queries,daily},today});
 assert.equal(r.decisions[0].action,'rollback');
 assert.equal(r.state.langs.en.current,'a');
 assert.equal(r.state.langs.en.blocked.b,day(today,90));
 const later=seo.decide({candidates:CANDS,state:r.state,gsc:{range:range('2026-12-30'),queries,daily},today:'2026-12-30'});
 assert.equal(later.state.langs.en.current,'a','the rolled-back title stays out although it matches the queries');
 const same=[];
 for(let i=0;i<35;i++)same.push({page:URL,date:day('2026-09-15',i),country:'usa',clicks:6,impressions:100,position:5});
 for(let i=0;i<30;i++)same.push({page:URL,date:day('2026-10-20',i),country:'usa',clicks:6,impressions:100,position:5});
 assert.notEqual(seo.decide({candidates:CANDS,state,gsc:{range:range(today),queries,daily:same},today}).decisions[0].action,'rollback');
 assert.ok(Math.abs(seo.binomCdf(3,10,0.5)-0.171875)<1e-9);
});

test('the Search Console reader signs its token request, prefers the Domain property and reads only the 3D pages',async()=>{
 const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
 const sa={client_email:'titles@example.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'}),token_uri:'https://oauth2.googleapis.com/token'};
 const [h,p,s]=gsc.signedJwt(sa,1000).split('.');
 assert.ok(crypto.verify('sha256',Buffer.from(h+'.'+p),publicKey,Buffer.from(s,'base64url')));
 assert.equal(JSON.parse(Buffer.from(p,'base64url')).scope,'https://www.googleapis.com/auth/webmasters.readonly');
 const calls=[];
 const reply=b=>({ok:true,status:200,json:async()=>b});
 const fake=async(u,init={})=>{
  calls.push({u,init});
  if(u.startsWith('https://oauth2.googleapis.com/'))return reply({access_token:'token'});
  if(u.endsWith('/sites'))return reply({siteEntry:[{siteUrl:'https://japantimeatlas.com/',permissionLevel:'siteFullUser'},{siteUrl:'sc-domain:japantimeatlas.com',permissionLevel:'siteRestrictedUser'}]});
  const body=JSON.parse(init.body);
  return reply({rows:body.dimensions[1]==='query'?[{keys:['https://japantimeatlas.com/3d/gunkanjima','hashima island 3d','usa'],clicks:1,impressions:9,position:7.5}]:[]});
 };
 const data=await gsc.fetchAll({sa,today:'2026-10-20',fetchImpl:fake});
 assert.equal(data.property,'sc-domain:japantimeatlas.com');
 assert.deepEqual(data.range.queries,['2026-09-20','2026-10-17']);
 assert.deepEqual(data.queries,[{page:'https://japantimeatlas.com/3d/gunkanjima',query:'hashima island 3d',country:'usa',clicks:1,impressions:9,position:7.5}]);
 const query=calls.find(c=>c.u.includes('/searchAnalytics/query'));
 assert.ok(query.u.includes(encodeURIComponent('sc-domain:japantimeatlas.com')));
 assert.equal(query.init.headers.authorization,'Bearer token');
 const re=new RegExp(JSON.parse(query.init.body).dimensionFilterGroups[0].filters[0].expression);
 for(const page of Object.values(seo.loadCandidates().pages))assert.ok(re.test('https://japantimeatlas.com'+page),page);
 assert.ok(!re.test('https://japantimeatlas.com/place/l-hashima-island'));
 assert.equal(gsc.pickSite([{siteUrl:'sc-domain:japantimeatlas.com',permissionLevel:'siteUnverifiedUser'}]),null);
});

test('with no service account the weekly job reads nothing and writes nothing',()=>{
 const env={...process.env};
 for(const k of ['GSC_SERVICE_ACCOUNT_JSON','GSC_SERVICE_ACCOUNT_FILE','GITHUB_OUTPUT'])delete env[k];
 const out=path.join(os.tmpdir(),'jta-gsc-'+process.pid+'.json');
 fs.rmSync(out,{force:true});
 assert.match(cp.execFileSync(process.execPath,[path.join(root,'scripts/seo/gsc.cjs'),'--out',out],{env,encoding:'utf8'}),/no service account/);
 assert.ok(!fs.existsSync(out));
});

test('ownership codes for Naver, Baidu and others go on the home page only when set, and only as plain codes',()=>{
 const html='<html><head><title>x</title></head><body></body></html>';
 assert.equal(seo.injectVerification(html,{}),html);
 assert.equal(seo.injectVerification(html,seo.loadVerification()),html,'no codes are set in the repository yet');
 const out=seo.injectVerification(html,{'naver-site-verification':'abc123def456','baidu-site-verification':'codeva-XyZ12345'});
 assert.ok(out.includes('<meta name="naver-site-verification" content="abc123def456">\n<meta name="baidu-site-verification" content="codeva-XyZ12345">\n</head>'));
 assert.throws(()=>seo.injectVerification(html,{'naver-site-verification':'"><script>alert(1)</script>'}));
 assert.deepEqual(Object.keys(seo.loadVerification()).sort(),[...seo.VERIFY].sort());
 assert.ok(read('scripts/build.cjs').includes('seo.injectVerification('),'the build applies them');
});

test('the weekly workflow runs on a schedule, can push, keeps secrets from forks and logs no search terms',()=>{
 const y=read('.github/workflows/seo-3d-titles.yml');
 assert.match(y,/schedule:\s*\n\s*- cron: '[^']+'/);
 assert.ok(y.includes('workflow_dispatch'));
 assert.ok(!y.includes('pull_request'),'no pull request trigger');
 assert.match(y,/contents: write/);
 assert.ok(y.includes('secrets.GSC_SERVICE_ACCOUNT_JSON'));
 assert.ok(!/\$\{\{\s*steps\.[^}]+\}\}[^\n]*\n?\s*run:/.test(y.replace(/env:[\s\S]*?run:/g,'run:')),'step outputs reach the shell through env');
 assert.ok(!/\bquery\b/.test(read('scripts/seo/update-titles.cjs')),'the decision log never prints queries');
});
