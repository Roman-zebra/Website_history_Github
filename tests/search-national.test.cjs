const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),core=require('../search-core.js'),UI=require('../place-ui.js'),index=require('../scripts/build-search-index.cjs');
test('partial words, kana, categories and combined words match without a result cap',()=>{
 const rows=Array.from({length:80},(_,i)=>core.record({t:'node',i,lat:35+i/100,lon:139,tags:{name:'奥山スキー場 '+i,'name:en':'Okuyama Ski '+i,sport:'ski'}}));
 assert.equal(core.search(rows,'スキー','ja').length,80);assert.equal(core.search(rows,'すきー','ja').length,80);
 assert.equal(core.search(rows,'ski','en').length,80);assert.equal(core.search(rows,'滑雪','zh-Hans').length,80);
 assert.equal(core.search(rows,'奥山 79','ja').length,1);assert.equal(core.search(rows,'no match','ja').length,0);
});
test('the search index was rebuilt after the last change to the places or the search code',()=>{
 const meta=JSON.parse(fs.readFileSync(path.join(root,'data/search/meta.json'),'utf8'));
 assert.equal(meta.stamp,index.stamp(index.sources()),'run: node scripts/build-search-index.cjs');
 assert.deepEqual(meta.files.map(f=>f[0]),index.sources().map(s=>s[0]));
});
test('neighbouring overseas records cannot leak back into the Japan search',()=>{
 assert.equal(core.inJapan(34.743957,128.66329),false,'Geoje');
 assert.equal(core.inJapan(44.019518,145.814758),false,'Russian-administered island');
 assert.equal(core.inJapan(37.5665,126.978),false,'Seoul');
 assert.equal(core.inJapan(39.9042,116.4074),false,'Beijing');
 assert.equal(core.inJapan(43.1155,131.8855),false,'Vladivostok');
 assert.equal(core.inJapan(24.1485,120.6736),false,'Taiwan');
 assert.equal(core.inJapan(35.681236,139.767125),true,'Tokyo');
 assert.equal(core.inJapan(34.2,129.29),true,'Tsushima');
 assert.equal(core.inJapan(24.46,122.98),true,'Yonaguni');
 assert.equal(core.inJapan(26.212,127.68),true,'Okinawa');
 assert.equal(core.inJapan(35.286111,139.694167),true,'Sarushima');
});
/* The worker as the page runs it, reading files from the working tree. */
function worker(){
 const fetched=[],messages=[];let waiting=null;
 const context={self:{},AtlasSearch:core,PlaceUI:UI,importScripts(){},atob:s=>Buffer.from(s,'base64').toString('latin1'),
  fetch:async u=>{fetched.push(u);const file=path.join(root,u.split('?')[0]);return fs.existsSync(file)?{ok:true,json:async()=>JSON.parse(fs.readFileSync(file,'utf8'))}:{ok:false,json:async()=>null};},
  postMessage:m=>{messages.push(m);if(waiting&&m.seq===waiting.seq&&m.type!=='progress'){const w=waiting;waiting=null;w.done(m);}}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'search-worker.js'),'utf8'),context);
 const ask=data=>new Promise(done=>{waiting={seq:data.seq,done};context.self.onmessage({data});});
 return {context,fetched,messages,ask};
}
/* Every record, in the order the old worker read them. */
function everything(){
 const rows=[];
 for(const [file,kind,key] of index.sources()){const data=JSON.parse(fs.readFileSync(path.join(root,file),'utf8')),list=key?(data[key]||data.liminal||[]):data;for(const p of list)if(core.inJapan(p.lat,p.lon))rows.push(core.record(p,kind));}
 return rows;
}
test('a nationwide search reads only the files that can match and answers exactly like a search over everything',async()=>{
 const all=everything(),{fetched,ask}=worker();let seq=0;
 assert.ok(all.length>227000);
 for(const [query,most] of [['軍艦島',8],['函館 温泉',4],['川越 蔵',30],['hakodate',60],['スキー',0],['神社',0],['神社仏閣',0],['温泉 スキー',0],['東京タワー',8]]){
  const before=fetched.length,answer=await ask({type:'search',seq:++seq,query,lang:'ja',dataV:'test',auto:false});
  assert.equal(answer.type,'results',query);
  assert.equal(JSON.stringify(answer.rows),JSON.stringify(core.search(all,query,'ja')),query);
  const places=fetched.slice(before).filter(u=>!u.startsWith('data/search/'));
  assert.ok(places.length<=most,query+' read '+places.length+' place files');
 }
});
test('a typed search that would read many megabytes waits for the reader, and the latest request wins',async()=>{
 const {context,messages,ask}=worker();
 const broad=await ask({type:'search',seq:1,query:'山',lang:'ja',dataV:'test',auto:true});
 assert.equal(broad.type,'broad');assert.ok(broad.files>100&&broad.bytes>5*1048576,JSON.stringify(broad));
 context.self.onmessage({data:{type:'search',seq:2,query:'城',lang:'ja',dataV:'test',auto:false}});
 const last=await ask({type:'search',seq:3,query:'スキー',lang:'ja',dataV:'test',auto:false});
 assert.equal(last.type,'results');assert.ok(last.rows.length>10);
 await new Promise(r=>setTimeout(r,50));
 assert.equal(messages.filter(m=>m.seq===2&&m.type==='results').length,0);
});
