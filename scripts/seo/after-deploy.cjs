/* After a push: wait until Cloudflare serves that commit (release.json), then tell the IndexNow engines
   (Bing, Naver, Yandex, Seznam, Yep) which pages changed, and Baidu too when BAIDU_PUSH_TOKEN is set.
   Google takes no pings; it rereads the pages on its own.
     node scripts/seo/after-deploy.cjs <commit> <url> [url ...]
   A GitHub runner may not be able to read release.json at all (a bot challenge answers 403 to data-centre
   addresses). The first two runs waited the full 20 minutes for that reason and sent nothing. So: a readable
   release.json that still names an older commit means "keep waiting"; a release.json that cannot be read
   even once in three minutes means "this runner cannot tell" — Workers Builds takes about a minute — and the
   pages are announced anyway. */
const cp=require('node:child_process'),path=require('node:path');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const RELEASE='https://japantimeatlas.com/release.json';

/* 'live' | 'unreadable' | 'timeout' */
async function waitForRelease(commit,{fetchImpl=fetch,sleepImpl=sleep,attempts=40,blindAfter=6,log=console.log}={}){
 let readable=false,last='';
 for(let i=0;i<attempts;i++){
  try{
   const r=await fetchImpl(RELEASE+'?after='+Date.now(),{signal:AbortSignal.timeout(15000)});
   last='HTTP '+r.status;
   const body=r.ok?await r.json().catch(()=>null):null;
   if(body&&typeof body.commit==='string'){
    readable=true;
    if(body.commit===commit)return 'live';
    last+=' serving '+body.commit.slice(0,7);
   }
  }catch(e){last=e.name||'fetch failed';}
  if(!readable&&i+1>=blindAfter){log('release.json unreadable from this runner ('+last+'); announcing without confirmation.');return 'unreadable';}
  await sleepImpl(30000);
 }
 log('The site did not serve '+commit.slice(0,7)+' in time ('+last+'); no pings sent.');
 return 'timeout';
}

async function main(){
 const [commit,...urls]=process.argv.slice(2);
 if(!commit||!urls.length){console.log('Nothing to announce.');return;}
 const state=await waitForRelease(commit);
 if(state==='timeout')return;
 console.log('Announcing '+urls.length+' page(s) ('+state+').');
 cp.execFileSync(process.execPath,[path.join(__dirname,'..','indexnow.cjs'),...urls],{stdio:'inherit'});
 const zh=urls.filter(u=>u.includes('/zh-cn/'));
 if(process.env.BAIDU_PUSH_TOKEN&&zh.length){
  const r=await fetch('http://data.zz.baidu.com/urls?site=https://japantimeatlas.com&token='+encodeURIComponent(process.env.BAIDU_PUSH_TOKEN),{method:'POST',headers:{'content-type':'text/plain'},body:zh.join('\n'),signal:AbortSignal.timeout(20000)});
  console.log('Baidu push: HTTP '+r.status+' '+(await r.text()).slice(0,160));
 }
}

if(require.main===module)main().catch(e=>{console.error('after-deploy: '+e.message);process.exit(1);});
module.exports={waitForRelease};
