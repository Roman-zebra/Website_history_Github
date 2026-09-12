/* Only reviewed, geolocated Japan products become map pins. */
(function(root){
 'use strict';
 function validProduct(p,now=new Date()){
  if(!p||p.enabled!==true||p.country!=='JP'||!/^\d+$/.test(p.id)||!p.title?.en||!p.title?.ja||!p.locationSource||!Array.isArray(p.points)||!p.points.length)return false;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(p.reviewBefore||'')||!Number.isFinite(Date.parse(p.reviewBefore))||Date.parse(p.reviewBefore+'T23:59:59Z')<+now)return false;
  try{const u=new URL(p.url);if(u.protocol!=='https:'||u.hostname!=='www.getyourguide.com'||!u.pathname.endsWith('-t'+p.id+'/')||u.username||u.password||u.search||u.hash)return false;}catch{return false;}
  return p.points.every(q=>q.id&&Number.isFinite(q.lat)&&Number.isFinite(q.lon)&&q.lat>=20&&q.lat<=46&&q.lon>=122&&q.lon<=154&&q.role==='meeting'&&q.label?.en&&q.label?.ja&&q.mapSource==='https://maps.google.com/?q=@'+q.lat+','+q.lon);
 }
 function points(catalog,now){const seen=new Set();return (catalog?.products||[]).filter(p=>validProduct(p,now)).flatMap(product=>product.points.map(q=>({...q,id:'gyg-'+product.id+'-'+q.id,product,emoji:'🎟',name:product.title.en,ja:product.title.ja}))).filter(p=>{if(seen.has(p.id))return false;seen.add(p.id);return true;});}
 function trackedURL(p,config){if(!config?.enabled||!config.getyourguide?.enabled||!validProduct(p.product)||!/^[A-Z0-9]{5,12}$/.test(config.getyourguide.partnerId||''))return null;const u=new URL(p.product.url);u.searchParams.set('partner_id',config.getyourguide.partnerId);u.searchParams.set('utm_medium','online_publisher');u.searchParams.set('cmp','jta_pin_'+p.product.id+'_'+p.id);return u.href;}
 function clusters(list,project,size=52){const cells=new Map();for(const p of list){const xy=project(p),key=Math.floor(xy.x/size)+':'+Math.floor(xy.y/size);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(p);}return [...cells.values()];}
 function searchRecords(list,search){return list.map(p=>{const r=search.record(p,'gyg');r.labels=r.labels.map((s,i)=>s+' · '+['Ad','広告','광고','广告','廣告'][i]);r.text+='|'+search.norm('GetYourGuide GYG ツアー 体験 広告 tour tours experience experiences advertisement 투어 체험 광고 旅游 體驗 廣告 '+p.product.keywords+' '+p.label.en+' '+p.label.ja);return r;});}
 const api={validProduct,points,trackedURL,clusters,searchRecords};if(typeof module==='object'&&module.exports)module.exports=api;else root.AtlasGygProducts=api;
})(typeof globalThis!=='undefined'?globalThis:this);
