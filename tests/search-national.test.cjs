const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),core=require('../search-core.js'),UI=require('../place-ui.js');
test('partial words, kana, categories and combined words match without a result cap',()=>{
 const rows=Array.from({length:80},(_,i)=>core.record({t:'node',i,lat:35+i/100,lon:139,tags:{name:'奥山スキー場 '+i,'name:en':'Okuyama Ski '+i,sport:'ski'}}));
 assert.equal(core.search(rows,'スキー','ja').length,80);assert.equal(core.search(rows,'すきー','ja').length,80);
 assert.equal(core.search(rows,'ski','en').length,80);assert.equal(core.search(rows,'滑雪','zh-Hans').length,80);
 assert.equal(core.search(rows,'奥山 79','ja').length,1);assert.equal(core.search(rows,'no match','ja').length,0);
});
test('the nationwide worker searches every region and monuments, latest request wins',async()=>{
 const out=[];let finish;const done=new Promise(r=>finish=r);
 const context={self:{},AtlasSearch:core,PlaceUI:UI,importScripts(){},caches:{open:async()=>({match:async()=>null,put:async()=>{}})},Response,
  fetch:async u=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,u.split('?')[0]),'utf8'))}),
  postMessage:m=>{out.push(m);if(m.type==='results'||m.type==='error')finish(m);}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'search-worker.js'),'utf8'),context);
 context.self.onmessage({data:{seq:1,query:'城',lang:'ja'}});context.self.onmessage({data:{seq:2,query:'スキー',lang:'ja'}});
 const result=await done;assert.equal(result.type,'results');assert.equal(result.seq,2);assert.ok(result.indexed>210000);assert.ok(result.rows.length>10);
 assert.ok(result.rows.every(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lon)));assert.equal(out.filter(r=>r.type==='results').length,1);
 console.log('Nationwide index: '+result.indexed+' records; skiing: '+result.rows.length+' matching points.');
});
