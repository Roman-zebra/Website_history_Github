/* Lazy nationwide index in a worker, so reading 200k places never blocks the map. */
importScripts('place-ui.js?v=0.72','search-core.js?v=0.72');
const VERSION='0.72-0.47',rows=[],loaded=new Set();
let pending=null,loading=null;
async function json(url){const r=await fetch(url);if(!r.ok)throw Error(url);return r.json();}
function emit(type,extra={}){if(pending)postMessage({type,seq:pending.seq,...extra});}
async function readCache(){
 try{const c=await caches.open('atlas-search-'+VERSION),r=await c.match('index');if(r){const data=await r.json();if(!Array.isArray(data)||!data.length)return false;for(const row of data)rows.push(row);return true;}}catch{}
 return false;
}
async function load(){
 if(await readCache())return;
 const [idx,facilities]=await Promise.all([json('data/places-index.json?v=0.47'),json('data/facilities-index-v1.json?v=0.47')]);
 const jobs=[['data/places-world.json','place','places'],['data/landmarks.json','landmark','landmarks'],['data/regional-landmarks-v1.json','landmark','landmarks'],['data/liminal.json','liminal','places'],['data/monuments.json','monument',null],...idx.map(r=>['data/places-'+r.n+'.json','local',null]),...facilities.files.map(f=>['data/'+f,'local',null])];
 let cursor=0;
 const failures=[];
 await Promise.all(Array.from({length:4},async()=>{while(cursor<jobs.length){const [url,kind,key]=jobs[cursor++];if(loaded.has(url))continue;
  try{const data=await json(url+'?v=0.47'),list=key?(data[key]||data.liminal||[]):data;
   for(const p of list){if(Number.isFinite(p.lat)&&Number.isFinite(p.lon))rows.push(AtlasSearch.record(p,kind));}loaded.add(url);
  }catch{failures.push(url);}
  emit('progress',{done:loaded.size,total:jobs.length});
 }}));
 if(failures.length)throw Error('Some regions could not be loaded');
 try{const c=await caches.open('atlas-search-'+VERSION);await c.put('index',new Response(JSON.stringify(rows),{headers:{'Content-Type':'application/json'}}));}catch{}
}
self.onmessage=e=>{
 if(e.data.type==='cancel'){pending=null;return;}
 pending=e.data;
 if(!loading)loading=load().catch(error=>{loading=null;throw error;});
 const request=pending;
 loading.then(()=>{if(pending!==request)return;emit('results',{rows:AtlasSearch.search(rows,request.query,request.lang),indexed:rows.length});})
 .catch(()=>{if(pending===request)emit('error');});
};
