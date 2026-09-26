/* Nationwide keyword search in a worker. It reads only the place files that can hold a match
   (see scripts/build-search-index.cjs) and runs the same AtlasSearch.search over their records in the same order,
   so the answer is what a search over all 228,000+ records gives, without first downloading 37 MB and building
   every record. A category search (温泉, 神社 …) reads one prepared file.
   A search sent while typing (auto) that would still read more than AUTO_LIMIT answers 'broad' instead, and the
   page offers to search all of Japan. The version comes from this worker's own URL, never a number written here. */
const V=((self.location&&/[?&]v=([^&]*)/.exec(self.location.search))||[])[1]||'';
importScripts(...['place-ui.js','japan-boundary.js','search-core.js'].map(f=>V?f+'?v='+V:f));
const AUTO_LIMIT=5*1048576,KEEP_RECORDS=80000,PARALLEL=4;
let pending=null,meta=null,metaKey='',cleaned=false;
const shards=new Map(),files=new Map(),loading=new Map(),categories=new Map();
/* x-atlas-bulk: sw.js leaves these to the browser cache (data/* is immutable) instead of its 40-file region cache. */
async function json(url){const r=await fetch(url,{headers:{'x-atlas-bulk':'1'}});if(!r.ok)throw Error(url);return r.json();}
function emit(request,type,extra={}){if(pending===request)postMessage({type,seq:request.seq,...extra});}
function cached(map,key,load){if(!map.has(key))map.set(key,load().catch(error=>{map.delete(key);throw error;}));return map.get(key);}
/* A set of file numbers: dot-separated base 36 when short, otherwise a base64 bitset. */
function fileSet(code){
 const set=new Set();if(!code)return set;
 if(code.length<4||code.includes('.')){for(const x of code.split('.'))set.add(parseInt(x,36));return set;}
 const bits=atob(code);
 for(let i=0;i<bits.length;i++){const b=bits.charCodeAt(i);if(b)for(let k=0;k<8;k++)if(b&(1<<k))set.add(i*8+k);}
 return set;
}
const common=(a,b)=>{const out=new Set();for(const x of a)if(b.has(x))out.add(x);return out;};
async function prepare(dataV){
 const key=dataV+'-'+V;
 if(meta&&metaKey===key)return;
 const next=await json('data/search/meta.json?v='+encodeURIComponent(key));
 if(!meta||meta.stamp!==next.stamp){shards.clear();files.clear();loading.clear();categories.clear();}
 meta=next;metaKey=key;
}
const shard=i=>cached(shards,i,()=>json('data/search/p'+String(i).padStart(2,'0')+'.json?v='+meta.stamp));
function place(i,dataV){
 if(files.has(i))return Promise.resolve(files.get(i));
 return cached(loading,i,async()=>{
  const [path,kind,key]=meta.files[i],data=await json(path+'?v='+encodeURIComponent(dataV)),list=key?(data[key]||data.liminal||[]):data,out=[];
  for(const p of list)if(AtlasSearch.inJapan(p.lat,p.lon))out.push(AtlasSearch.record(p,kind));
  loading.delete(i);files.set(i,out);return out;
 });
}
function category(id){
 return cached(categories,id,async()=>(await json('data/search/c-'+id+'.json?v='+meta.stamp)).filter(row=>AtlasSearch.inJapan(row[3],row[4])).map(([index,rid,kind,lat,lon,labels,names,cats,tags])=>
  // landmarks have no id; JSON stored it as null, and the answer must match a full search (where it is left out)
  ({index,id:rid===null?undefined:rid,kind,lat,lon,labels:Array.isArray(labels)?labels:PlaceUI.langs.map(()=>labels),names,categories:cats,text:'',...(tags?{facilityTags:tags}:{})})));
}
/* The files whose records can satisfy every word: a category word by the files holding that category, a text word by
   the files holding all of its pieces. */
async function candidates(words){
 const need=new Map();
 for(const w of words)for(const p of w.pieces||[])need.set(p,AtlasSearch.shardOf(p,meta.shards));
 const loaded=new Map();
 await Promise.all([...new Set(need.values())].map(async i=>loaded.set(i,await shard(i))));
 let set=null;
 for(const w of words){
  let s=null;
  if(w.categories){s=new Set();for(const c of w.categories)for(const f of fileSet((meta.categories[c]||[])[1]))s.add(f);}
  else for(const p of w.pieces){const f=fileSet(loaded.get(need.get(p))[p]);s=s?common(s,f):f;if(!s.size)break;}
  set=set?common(set,s):s;
  if(!set.size)break;
 }
 return [...(set||[])].sort((a,b)=>a-b);
}
function byIndex(lists){
 const seen=new Set(),out=[];
 for(const r of lists.flat().sort((a,b)=>a.index-b.index))if(!seen.has(r.index)){seen.add(r.index);out.push(r);}
 return out;
}
function trim(keep){
 let total=0;for(const r of files.values())total+=r.length;
 for(const [i,r] of [...files]){if(total<=KEEP_RECORDS)break;if(keep.has(i))continue;files.delete(i);total-=r.length;}
}
async function run(request){
 const words=AtlasSearch.plan(request.query);
 if(!words.length){emit(request,'results',{rows:[],indexed:0,files:0});return;}
 await prepare(request.dataV);
 if(pending!==request)return;
 let rows,read=0;
 if(words.every(w=>w.categories)){
  // search() still applies every word; the smallest category only decides which records to read
  const size=w=>w.categories.reduce((a,c)=>a+((meta.categories[c]||[0])[0]),0);
  const smallest=words.reduce((a,w)=>size(w)<size(a)?w:a);
  rows=byIndex(await Promise.all(smallest.categories.filter(c=>meta.categories[c]).map(category)));
 }else{
  const wanted=await candidates(words);
  if(pending!==request)return;
  const bytes=wanted.reduce((a,i)=>a+(files.has(i)?0:meta.files[i][3]),0);
  if(request.auto&&bytes>AUTO_LIMIT){emit(request,'broad',{files:wanted.length,bytes});return;}
  const lists=new Array(wanted.length);let cursor=0,done=0;
  await Promise.all(Array.from({length:Math.min(PARALLEL,wanted.length)},async()=>{
   while(cursor<wanted.length){const k=cursor++;lists[k]=await place(wanted[k],request.dataV);done++;if(wanted.length>2)emit(request,'progress',{done,total:wanted.length});}
  }));
  for(const i of wanted)if(files.has(i)){const r=files.get(i);files.delete(i);files.set(i,r);}
  trim(new Set(wanted));
  rows=lists.flat();read=wanted.length;
 }
 if(pending!==request)return;
 emit(request,'results',{rows:AtlasSearch.search(rows,request.query,request.lang),indexed:rows.length,files:read});
}
self.onmessage=e=>{
 if(e.data.type==='cancel'){pending=null;return;}
 const request=pending=e.data;
 // the old worker kept all 228,000+ records in Cache Storage (about 90 MB); nothing reads them now
 if(!cleaned&&typeof caches!=='undefined'&&caches.keys){cleaned=true;caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('atlas-search-')).map(k=>caches.delete(k)))).catch(()=>{});}
 run(request).catch(()=>emit(request,'error'));
};
