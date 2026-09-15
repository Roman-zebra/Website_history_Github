/* Which title and description each Gunkanjima 3D page shows, and how that choice is made.
   The candidates in titles-3d.json are written by hand, so every title stays true to the page; only the
   choice among them is automatic. update-titles.cjs makes it once a week from Search Console (the queries
   searchers in each page's markets typed, weighted by impressions and position) and, until a page has
   never had enough of that, from suggest-2026-09-15.json (what Google, Bing, Naver, Baidu and DuckDuckGo
   suggested for the island's names).
   state-3d.json keeps the live candidate per language, since when, the periods each one was live, and
   what was set aside. A switch waits 28 days after the last one and needs a clearly better match; a new
   title that earns significantly fewer clicks than the old one at the same positions is rolled back. */
const fs=require('node:fs'),path=require('node:path');
const BRAND=' | Japan Time Atlas';
const at=name=>path.join(__dirname,name);
const readJson=name=>JSON.parse(fs.readFileSync(at(name),'utf8'));
const loadCandidates=()=>readJson('titles-3d.json');
const loadSuggestions=()=>readJson('suggest-2026-09-15.json');
const loadVerification=()=>readJson('verification.json');
const loadState=()=>fs.existsSync(at('state-3d.json'))?readJson('state-3d.json'):{langs:{},periods:[],log:[]};
const saveState=s=>fs.writeFileSync(at('state-3d.json'),JSON.stringify(s,null,1)+'\n');
const DEFAULTS={minImpressions:100,cooldownDays:28,hysteresis:1.25,minGain:5,rollbackP:0.05,minClicks:20,minDays:14,blockDays:90,logLimit:200};
const addDays=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
const daysBetween=(a,b)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/864e5);

/* Words for Latin text; character pairs for Japanese, Korean and Chinese, which need no word breaks. */
const STOP=new Set('a an and are can did do does for from how in is it of on the to was what when where who why with you'.split(' '));
function tokens(text){
 const out=[];
 for(const [w] of String(text).normalize('NFKC').toLowerCase().matchAll(/[a-z0-9]+|[^\s\p{P}\p{S}a-z0-9]+/gu)){
  if(/^[a-z0-9]+$/.test(w)){if(!STOP.has(w))out.push(w.length>3&&/[^s]s$/.test(w)?w.slice(0,-1):w);}
  else if(w.length<2)out.push(w);
  else for(let i=0;i<w.length-1;i++)out.push(w.slice(i,i+2));
 }
 return out;
}
function coverage(have,phrase){
 const need=[...new Set(tokens(phrase))];
 return need.length?need.filter(t=>have.has(t)).length/need.length:0;
}
/* How well a candidate answers the phrases people search: a phrase counts fully when every word of it is in
   the title, 60% when the words are only found with the description's help. */
function score(c,phrases){
 const lead=new Set(tokens(c.lead)),all=new Set([...lead,...tokens(c.description)]);
 let s=0;
 for(const p of phrases){const cov=Math.max(coverage(lead,p.text),0.6*coverage(all,p.text));s+=p.weight*cov*cov;}
 return s;
}
const suggestionPhrases=(snapshot,code)=>Object.entries(((snapshot||{}).langs||{})[code]?.phrases||{}).map(([text,weight])=>({text,weight}));
function searchPhrases(rows){
 const m=new Map();
 for(const r of rows){const k=String(r.query||'').toLowerCase();if(!k)continue;const e=m.get(k)||{i:0,pw:0};e.i+=r.impressions;e.pw+=r.position*r.impressions;m.set(k,e);}
 return [...m].map(([text,e])=>{const pos=e.i?e.pw/e.i:100;return {text,weight:e.i*(pos<=10?1:pos<=20?0.7:0.4)};});
}
/* Clicks a title should earn at a position, only to compare two titles on the same footing. */
const expectedCtr=pos=>0.3*Math.pow(Math.max(1,pos),-0.9);
function periodStats(daily,url,inMarket,from,to){
 let clicks=0,impressions=0,expected=0;
 for(const r of daily){if(r.page!==url||!inMarket(r.country)||r.date<from||r.date>to)continue;clicks+=r.clicks;impressions+=r.impressions;expected+=r.impressions*expectedCtr(r.position);}
 return {clicks,impressions,expected,days:to>=from?daysBetween(from,to)+1:0};
}
/* P(X <= k) for X ~ Binomial(n, p) */
function binomCdf(k,n,p){
 if(k>=n||p<=0)return 1;if(k<0)return 0;if(p>=1)return 0;
 let logc=0,sum=0;const lp=Math.log(p),lq=Math.log(1-p);
 for(let i=0;i<=k;i++){if(i)logc+=Math.log((n-i+1)/i);sum+=Math.exp(logc+i*lp+(n-i)*lq);}
 return Math.min(1,sum);
}

function decide({candidates,state,gsc,suggest,today,opts}){
 const o={...DEFAULTS,...opts};
 const next=JSON.parse(JSON.stringify(state||{}));
 next.langs=next.langs||{};next.periods=next.periods||[];next.log=next.log||[];
 const dataEnd=gsc&&gsc.range&&gsc.range.daily?gsc.range.daily[1]:null;
 const decisions=[];
 for(const [code,spec] of Object.entries(candidates.langs)){
  const byId=new Map(spec.candidates.map(c=>[c.id,c]));
  const st=next.langs[code]||(next.langs[code]={current:spec.candidates[0].id,since:null,basis:null,previous:null,blocked:{}});
  st.blocked=st.blocked||{};
  if(!byId.has(st.current))Object.assign(st,{current:spec.candidates[0].id,since:null,basis:null,previous:null});
  for(const [id,until] of Object.entries(st.blocked))if(until<=today||!byId.has(id))delete st.blocked[id];
  const url=candidates.site+candidates.pages[code];
  const exclude=new Set(spec.exclude||[]),inMarket=country=>!exclude.has(country);
  const d={lang:code,url,action:'keep',from:st.current,to:st.current,basis:null,impressions:0,reason:''};
  const move=(to,action,basis,reason)=>{
   if(st.since)next.periods.push({lang:code,id:st.current,from:st.since,to:addDays(today,-1)});
   Object.assign(st,{previous:st.current,current:to,since:today,basis});
   Object.assign(d,{action,to,basis,reason});
   next.log.push({date:today,lang:code,action,from:d.from,to,basis,reason});
  };
  decisions.push(d);

  /* 1. a newer title that loses clicks against the one before it, at the same positions, goes back */
  if(gsc&&dataEnd&&st.since&&st.previous&&byId.has(st.previous)&&!st.blocked[st.previous]){
   const prev=[...next.periods].reverse().find(p=>p.lang===code&&p.id===st.previous);
   if(prev){
    const now=periodStats(gsc.daily||[],url,inMarket,st.since,dataEnd),before=periodStats(gsc.daily||[],url,inMarket,prev.from,prev.to);
    const n=now.clicks+before.clicks;
    if(now.days>=o.minDays&&before.days>=o.minDays&&n>=o.minClicks&&now.expected>0&&before.expected>0){
     const p=binomCdf(now.clicks,n,now.expected/(now.expected+before.expected));
     if(p<o.rollbackP){
      const dropped=st.current;
      move(st.previous,'rollback','search-console','fewer clicks than the previous title at the same positions (p='+p.toFixed(3)+')');
      st.blocked[dropped]=addDays(today,o.blockDays);
      continue;
     }
    }
   }
  }

  /* 2. what people search: Search Console when there is enough, otherwise the suggestions snapshot, which is used
        only until the first Search Console decision (so the two never pull against each other) and never against a
        title the site owner picked (basis 'owner'); Search Console data can still replace that after the cooldown */
  let phrases=null;
  if(gsc){
   const rows=(gsc.queries||[]).filter(r=>r.page===url&&inMarket(r.country));
   d.impressions=rows.reduce((a,r)=>a+r.impressions,0);
   if(d.impressions>=o.minImpressions){phrases=searchPhrases(rows);d.basis='search-console';}
  }
  if(!phrases&&st.basis!=='search-console'&&st.basis!=='owner'){
   const s=suggestionPhrases(suggest,code);
   if(s.length){phrases=s;d.basis='suggestions';}
  }
  if(!phrases){d.reason=gsc?'not enough Search Console impressions yet':'no data';continue;}

  /* 3. a clearly better candidate replaces the live one, but not within the cooldown */
  const ranked=spec.candidates.filter(c=>c.id===st.current||!st.blocked[c.id]).map(c=>({id:c.id,s:score(c,phrases)}))
   .sort((x,y)=>y.s-x.s||(x.id===st.current?-1:y.id===st.current?1:0));
  const cur=ranked.find(x=>x.id===st.current),best=ranked[0];
  const minGain=d.basis==='search-console'?o.minGain:0;
  if(best.id===st.current)d.reason='the live title matches the searches best';
  else if(st.since&&daysBetween(st.since,today)<o.cooldownDays)d.reason='cooldown until '+addDays(st.since,o.cooldownDays);
  else if(best.s<cur.s*o.hysteresis||best.s-cur.s<minGain)d.reason='no candidate is clearly better';
  else move(best.id,'switch',d.basis,'better match to '+(d.basis==='search-console'?'Search Console queries':'search suggestions')+' ('+cur.s.toFixed(1)+' → '+best.s.toFixed(1)+')');
 }
 if(next.log.length>o.logLimit)next.log=next.log.slice(-o.logLimit);
 return {state:next,decisions};
}

const width=(s,code)=>code==='en'?s.length:[...s].reduce((a,ch)=>a+(ch.charCodeAt(0)<128?0.5:1),0);
function validate(cands){
 const problems=[],seen=new Set();
 for(const [code,spec] of Object.entries(cands.langs)){
  if(!cands.pages[code])problems.push(code+': no page');
  if(!spec.candidates||spec.candidates.length<2)problems.push(code+': needs at least two candidates');
  for(const c of spec.candidates||[]){
   if(seen.has(c.id))problems.push(c.id+': duplicate id');
   seen.add(c.id);
   if(!c.lead.includes(spec.mustInclude))problems.push(c.id+': lead lacks '+spec.mustInclude);
   if(width(c.lead,code)>spec.maxLead)problems.push(c.id+': lead too long ('+width(c.lead,code)+' > '+spec.maxLead+')');
   const n=[...c.description].length;
   if(n<80||n>(code==='en'?240:160))problems.push(c.id+': description length '+n);
   if(/[&"<>\\]/.test(c.lead+c.description))problems.push(c.id+': characters that need escaping');
   if((c.lead+c.description).includes('Japan Time Atlas'))problems.push(c.id+': brand inside the text');
  }
 }
 return problems;
}
function pick(code,cands=loadCandidates(),state=loadState()){
 const spec=cands.langs[code];
 if(!spec)return null;
 const id=state.langs&&state.langs[code]&&state.langs[code].current;
 const c=spec.candidates.find(x=>x.id===id)||spec.candidates[0];
 return {id:c.id,title:c.lead+BRAND,description:c.description};
}

/* Ownership codes from Naver Search Advisor, Baidu, Bing, Yandex or Google go on the home page as meta tags
   (a verification file would be answered with a redirect to the extensionless path). Empty codes add nothing. */
const VERIFY=['google-site-verification','msvalidate.01','naver-site-verification','baidu-site-verification','yandex-verification'];
function injectVerification(html,codes){
 const tags=VERIFY.filter(n=>codes&&codes[n]).map(n=>{
  if(!/^[\w.:-]{6,120}$/.test(codes[n]))throw new Error('verification code for '+n+' has unexpected characters');
  return '<meta name="'+n+'" content="'+codes[n]+'">';
 });
 if(!tags.length)return html;
 if(!html.includes('</head>'))throw new Error('no </head> for the verification tags');
 return html.replace('</head>',tags.join('\n')+'\n</head>');
}

module.exports={BRAND,DEFAULTS,tokens,score,decide,validate,pick,binomCdf,expectedCtr,loadCandidates,loadSuggestions,loadState,saveState,loadVerification,injectVerification,VERIFY};
