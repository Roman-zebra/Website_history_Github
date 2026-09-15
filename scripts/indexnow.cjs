/* Tell the IndexNow engines (Bing, Yandex, Naver, Seznam, Yep) which pages changed. Google does not
   take part; for Google the URLs are requested in Search Console by hand.
     node scripts/indexnow.cjs [url ...]      (no urls: every 3D page from the sitemap)
   The key file <key>.txt sits at the site root and is copied into dist by build.cjs. */
const fs=require('node:fs'),path=require('node:path'),https=require('node:https');
const root=path.resolve(__dirname,'..');
const key=fs.readdirSync(root).find(f=>/^[0-9a-f]{32}\.txt$/.test(f)).slice(0,32);
const host='japantimeatlas.com';
let urls=process.argv.slice(2);
if(!urls.length)urls=[...fs.readFileSync(path.join(root,'sitemap.xml'),'utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]).filter(u=>/\/3d\//.test(u)||/hashima|nagasaki/.test(u));
const body=JSON.stringify({host,key,keyLocation:'https://'+host+'/'+key+'.txt',urlList:urls});
const req=https.request({host:'api.indexnow.org',path:'/indexnow',method:'POST',headers:{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body)}},res=>{
 let out='';res.on('data',c=>out+=c);res.on('end',()=>console.log('IndexNow',res.statusCode,urls.length,'urls',out.slice(0,200)));});
req.on('error',e=>{console.error('IndexNow failed',e.message);process.exit(1);});
req.end(body);
