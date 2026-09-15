/* After the weekly job has pushed new titles: wait until Cloudflare serves that commit (release.json), then
   tell the IndexNow engines (Bing, Naver, Yandex, Seznam, Yep) which pages changed, and Baidu too when
   BAIDU_PUSH_TOKEN is set. Google takes no pings; it rereads the pages on its own.
     node scripts/seo/after-deploy.cjs <commit> <url> [url ...] */
const cp=require('node:child_process'),path=require('node:path');
const [commit,...urls]=process.argv.slice(2);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 if(!commit||!urls.length){console.log('Nothing to announce.');return;}
 let live=false;
 for(let i=0;i<40&&!live;i++){
  try{
   const r=await fetch('https://japantimeatlas.com/release.json?after='+Date.now(),{signal:AbortSignal.timeout(15000)});
   live=r.ok&&(await r.json()).commit===commit;
  }catch(e){}
  if(!live)await sleep(30000);
 }
 if(!live){console.log('The site did not serve '+commit.slice(0,7)+' within 20 minutes; no pings sent.');return;}
 cp.execFileSync(process.execPath,[path.join(__dirname,'..','indexnow.cjs'),...urls],{stdio:'inherit'});
 const zh=urls.filter(u=>u.includes('/zh-cn/'));
 if(process.env.BAIDU_PUSH_TOKEN&&zh.length){
  const r=await fetch('http://data.zz.baidu.com/urls?site=https://japantimeatlas.com&token='+encodeURIComponent(process.env.BAIDU_PUSH_TOKEN),{method:'POST',headers:{'content-type':'text/plain'},body:zh.join('\n'),signal:AbortSignal.timeout(20000)});
  console.log('Baidu push: HTTP '+r.status+' '+(await r.text()).slice(0,160));
 }
})().catch(e=>{console.error('after-deploy: '+e.message);process.exit(1);});
