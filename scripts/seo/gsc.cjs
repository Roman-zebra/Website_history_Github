/* Reads Search Console for the five Gunkanjima 3D pages with a Google service account, no libraries.
     GSC_SERVICE_ACCOUNT_JSON='{...key file...}' node scripts/seo/gsc.cjs --out .seo-cache/gsc-3d.json
   (or GSC_SERVICE_ACCOUNT_FILE=path/to/key.json). The service account must be a user of the Search Console
   property; "Restricted" is enough. GSC_SITE_URL picks the property, otherwise the Domain property for
   japantimeatlas.com is used, then the URL-prefix one.
   With no credentials it writes nothing and exits 0, so the weekly job leaves the titles as they are.
   It prints counts only: the repository and its Actions logs are public. */
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const SCOPE='https://www.googleapis.com/auth/webmasters.readonly',API='https://searchconsole.googleapis.com/webmasters/v3';
const HOST='japantimeatlas.com',PAGES='^https://japantimeatlas\\.com/3d/(ja/|ko/|zh-cn/|zh-tw/)?gunkanjima$';
const addDays=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);

function signedJwt(sa,now=Math.floor(Date.now()/1000)){
 const part=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
 const unsigned=part({alg:'RS256',typ:'JWT'})+'.'+part({iss:sa.client_email,scope:SCOPE,aud:sa.token_uri||'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 return unsigned+'.'+crypto.sign('sha256',Buffer.from(unsigned),sa.private_key).toString('base64url');
}
async function call(url,init,fetchImpl){
 const r=await fetchImpl(url,init);
 const body=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(url.split('?')[0]+' answered HTTP '+r.status+' '+(body.error_description||(body.error&&body.error.message)||body.error||''));
 return body;
}
async function accessToken(sa,fetchImpl=fetch){
 const body=await call(sa.token_uri||'https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:signedJwt(sa)}).toString()},fetchImpl);
 if(!body.access_token)throw new Error('the token reply has no access token');
 return body.access_token;
}
function pickSite(entries,wanted){
 const usable=(entries||[]).filter(e=>e.permissionLevel&&e.permissionLevel!=='siteUnverifiedUser').map(e=>e.siteUrl);
 if(wanted)return usable.includes(wanted)?wanted:null;
 return usable.find(u=>u==='sc-domain:'+HOST)||usable.find(u=>u==='https://'+HOST+'/')||usable.find(u=>u.includes(HOST))||null;
}
async function rows(token,site,body,fetchImpl){
 const all=[];
 for(let startRow=0;;startRow+=25000){
  const res=await call(API+'/sites/'+encodeURIComponent(site)+'/searchAnalytics/query',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({...body,rowLimit:25000,startRow})},fetchImpl);
  all.push(...(res.rows||[]));
  if(!res.rows||res.rows.length<25000)return all;
 }
}
/* The last 28 days of queries by country, and 180 days of daily clicks by country for comparing titles.
   Search Console's final data trails by about three days, so both ranges end three days ago. */
async function fetchAll({sa,site,today=new Date().toISOString().slice(0,10),fetchImpl=fetch}){
 const token=await accessToken(sa,fetchImpl);
 const list=await call(API+'/sites',{headers:{authorization:'Bearer '+token}},fetchImpl);
 const property=pickSite(list.siteEntry,site);
 if(!property)throw new Error('the service account sees no Search Console property for '+HOST+(site?' named '+site:'')+'; add '+sa.client_email+' as a user of the property');
 const end=addDays(today,-3),base={type:'web',dataState:'final',dimensionFilterGroups:[{filters:[{dimension:'page',operator:'includingRegex',expression:PAGES}]}]};
 const flat=(r,names)=>Object.assign(Object.fromEntries(names.map((n,i)=>[n,r.keys[i]])),{clicks:r.clicks,impressions:r.impressions,position:r.position});
 const queries=await rows(token,property,{...base,startDate:addDays(end,-27),endDate:end,dimensions:['page','query','country']},fetchImpl);
 const daily=await rows(token,property,{...base,startDate:addDays(end,-179),endDate:end,dimensions:['page','date','country']},fetchImpl);
 return {property,fetched:today,range:{queries:[addDays(end,-27),end],daily:[addDays(end,-179),end]},
  queries:queries.map(r=>flat(r,['page','query','country'])),daily:daily.map(r=>flat(r,['page','date','country']))};
}
module.exports={signedJwt,accessToken,pickSite,fetchAll,PAGES};

if(require.main===module){
 const i=process.argv.indexOf('--out'),out=i>0?process.argv[i+1]:'.seo-cache/gsc-3d.json';
 const setOutput=(k,v)=>{if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,k+'='+v+'\n');};
 const raw=process.env.GSC_SERVICE_ACCOUNT_JSON||(process.env.GSC_SERVICE_ACCOUNT_FILE?fs.readFileSync(process.env.GSC_SERVICE_ACCOUNT_FILE,'utf8'):'');
 if(!raw.trim()){
  console.log('Search Console: no service account configured, so nothing was read and the titles stay as they are.');
  setOutput('status','skipped');
 }else{
  let sa=null;
  try{sa=JSON.parse(raw);}catch(e){console.error('Search Console: the service account key is not valid JSON');process.exit(1);}
  fetchAll({sa,site:process.env.GSC_SITE_URL||''}).then(data=>{
   fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});
   fs.writeFileSync(out,JSON.stringify(data));
   console.log('Search Console: '+data.property+', queries '+data.range.queries.join('..')+': '+data.queries.length+' rows; daily '+data.range.daily.join('..')+': '+data.daily.length+' rows');
   setOutput('status','ok');
  }).catch(e=>{console.error('Search Console: '+e.message);process.exit(1);});
 }
}
