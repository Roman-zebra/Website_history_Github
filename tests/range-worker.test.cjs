/* The Range worker in front of the audio files: a browser must get 206 with the bytes it asked for,
   or it marks the track unseekable and every skip in the audio guide snaps back to 0:00 (seen on
   production on 2026-09-15). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const bytes=new Uint8Array(1000).map((_,i)=>i%251);
const env={ASSETS:{fetch:async req=>{const u=new URL(req.url);if(u.pathname==='/3d/audio/x.mp3')return new Response(bytes,{status:200,headers:{'Content-Type':'audio/mpeg','ETag':'"abc"','Content-Length':'1000'}});return new Response('no',{status:404});}}};
const load=()=>import(pathToFileURL(path.join(root,'worker.mjs')).href);
const get=(headers={},method='GET')=>load().then(w=>w.default.fetch(new Request('https://japantimeatlas.com/3d/audio/x.mp3?v=5',{method,headers}),env));

test('wrangler runs the worker first only for the audio files and binds the assets',()=>{
 const c=JSON.parse(read('wrangler.jsonc'));
 assert.equal(c.main,'worker.mjs');
 assert.equal(c.assets.binding,'ASSETS');
 assert.deepEqual(c.assets.run_worker_first,['/3d/audio/*']);
 assert.ok(read('scripts/build.cjs').includes("'worker.mjs'")===false,'the worker is deployed by wrangler, not copied into dist');
});

test('a plain request passes through with Accept-Ranges added',async()=>{
 const r=await get();
 assert.equal(r.status,200);
 assert.equal(r.headers.get('Accept-Ranges'),'bytes');
 assert.equal((await r.arrayBuffer()).byteLength,1000);
});

test('a byte range is answered with 206 and exactly those bytes',async()=>{
 const r=await get({Range:'bytes=10-19'});
 assert.equal(r.status,206);
 assert.equal(r.headers.get('Content-Range'),'bytes 10-19/1000');
 assert.equal(r.headers.get('Content-Length'),'10');
 assert.equal(r.headers.get('Content-Type'),'audio/mpeg');
 assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[...bytes.subarray(10,20)]);
 const open=await get({Range:'bytes=990-'});
 assert.equal(open.headers.get('Content-Range'),'bytes 990-999/1000');
 assert.equal((await open.arrayBuffer()).byteLength,10);
 const suffix=await get({Range:'bytes=-5'});
 assert.equal(suffix.headers.get('Content-Range'),'bytes 995-999/1000');
 const clipped=await get({Range:'bytes=0-5000'});
 assert.equal(clipped.headers.get('Content-Range'),'bytes 0-999/1000');
});

test('an unsatisfiable range is 416; a stale If-Range gets the whole file',async()=>{
 const r=await get({Range:'bytes=2000-3000'});
 assert.equal(r.status,416);
 assert.equal(r.headers.get('Content-Range'),'bytes */1000');
 const stale=await get({Range:'bytes=0-9','If-Range':'"old"'});
 assert.equal(stale.status,200);
 const fresh=await get({Range:'bytes=0-9','If-Range':'"abc"'});
 assert.equal(fresh.status,206);
 const head=await get({Range:'bytes=0-9'},'HEAD');
 assert.equal(head.status,200);
 const missing=await load().then(w=>w.default.fetch(new Request('https://japantimeatlas.com/3d/audio/none.mp3',{headers:{Range:'bytes=0-1'}}),env));
 assert.equal(missing.status,404);
});
