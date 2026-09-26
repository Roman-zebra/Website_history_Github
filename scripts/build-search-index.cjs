/* Nationwide search without the nationwide download.
   search-worker.js used to read all 264 place files (about 37 MB) and build 228,000+ records before it could answer,
   on the first search after every page load. This writes what lets it read only the files that can hold a match.
   The records, their order and AtlasSearch.search stay the same, so the results do too
   (tests/search-national.test.cjs compares them with a search over everything).
     data/search/meta.json    the files in search order [path, kind, list key, bytes, records, [s,w,n,e]],
                              each category with its record count and files, and a stamp of the inputs
     data/search/pNN.json     for each piece of record text (AtlasSearch.pieces), the files that contain it
     data/search/c-<id>.json  every record of one category in search order, so 温泉 or 神社 is one file
   A set of files is written as dot-separated base-36 numbers when short, otherwise as a base64 bitset.
   Rerun after changing data/, search-core.js or place-ui.js; the test fails while the stamp is stale.
     node scripts/build-search-index.cjs */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'data','search');
const core=require('../search-core.js');
const FORMAT=1,SHARDS=64;
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));

/* The order search-worker.js has always used; results are sorted by score and name, but duplicates at the same
   coordinates keep the first record, so the order still matters. */
function sources(){
 const regions=read('data/places-index.json'),facilities=read('data/facilities-index-v1.json');
 return [['data/places-world.json','place','places'],['data/landmarks.json','landmark','landmarks'],['data/regional-landmarks-v1.json','landmark','landmarks'],
  ['data/liminal.json','liminal','places'],['data/monuments.json','monument',null],
  ...regions.map(r=>['data/places-'+r.n+'.json','local',null]),...facilities.files.map(f=>['data/'+f,'local',null])];
}
/* Line endings are ignored so a Windows checkout and the Linux build agree. */
function stamp(jobs){
 const h=crypto.createHash('sha1');h.update('format '+FORMAT+'\n');
 for(const f of ['search-core.js','place-ui.js','japan-boundary.js',...jobs.map(j=>j[0])])h.update(f+'\n').update(fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n'));
 return h.digest('hex').slice(0,12);
}
function encode(set,fileCount){
 if(set.size<=6)return [...set].sort((a,b)=>a-b).map(x=>x.toString(36)).join('.');
 const bits=Buffer.alloc(Math.ceil(fileCount/8));
 for(const x of set)bits[x>>3]|=1<<(x&7);
 return bits.toString('base64');
}
function build(){
 const jobs=sources(),files=[],categories=new Map(),pieceFiles=new Map();
 let index=0;
 jobs.forEach(([file,kind,key],fi)=>{
  const data=read(file),list=key?(data[key]||data.liminal||[]):data;
  let count=0,s=90,w=180,n=-90,e=-180;
  for(const p of list){
   if(!core.inJapan(p.lat,p.lon))continue;
   const r=core.record(p,kind);
   for(const piece of core.pieces(r.text,false)){let set=pieceFiles.get(piece);if(!set)pieceFiles.set(piece,set=new Set());set.add(fi);}
   const labels=r.labels.every(l=>l===r.labels[0])?r.labels[0]:r.labels;
   for(const c of new Set(r.categories)){
    let cat=categories.get(c);if(!cat)categories.set(c,cat={files:new Set(),rows:[]});
    cat.files.add(fi);cat.rows.push([index,r.id,r.kind,r.lat,r.lon,labels,r.names,r.categories,r.facilityTags||0]);
   }
   s=Math.min(s,r.lat);n=Math.max(n,r.lat);w=Math.min(w,r.lon);e=Math.max(e,r.lon);
   count++;index++;
  }
  files.push([file,kind,key,fs.statSync(path.join(root,file)).size,count,count?[s,w,n,e]:null]);
 });
 const shards=Array.from({length:SHARDS},()=>[]);
 for(const piece of [...pieceFiles.keys()].sort())shards[core.shardOf(piece,SHARDS)].push(piece);
 fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
 const write=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value)+'\n');
 shards.forEach((keys,i)=>write('p'+String(i).padStart(2,'0')+'.json',Object.fromEntries(keys.map(k=>[k,encode(pieceFiles.get(k),files.length)]))));
 const cats={};
 for(const id of [...categories.keys()].sort()){const cat=categories.get(id);cats[id]=[cat.rows.length,encode(cat.files,files.length)];write('c-'+id+'.json',cat.rows);}
 const meta={format:FORMAT,stamp:stamp(jobs),shards:SHARDS,records:index,files,categories:cats};
 write('meta.json',meta);
 return {meta,pieces:pieceFiles.size};
}
module.exports={build,sources,stamp,FORMAT,SHARDS};
if(require.main===module){
 const t=Date.now(),{meta,pieces}=build();
 const bytes=fs.readdirSync(out).reduce((a,f)=>a+fs.statSync(path.join(out,f)).size,0);
 console.log('search index '+meta.stamp+': '+meta.records+' records in '+meta.files.length+' files, '+pieces+' pieces, '+Object.keys(meta.categories).length+' categories, '+(bytes/1048576).toFixed(1)+' MB in data/search, '+((Date.now()-t)/1000).toFixed(1)+' s, peak '+(process.memoryUsage().rss/1048576).toFixed(0)+' MB');
}
