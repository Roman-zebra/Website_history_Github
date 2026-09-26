const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const load=()=>import(pathToFileURL(path.join(root,'worker.mjs')).href+'?supporters='+Date.now());

test('the support page states that the public display name will be published',()=>{
 const html=read('support.html'),js=read('support.js');
 assert.match(html,/表示名 \/ Your name/);
 assert.match(html,/自動掲載することに同意/);
 assert.match(html,/メールアドレス、寄付額、メッセージは掲載しません/);
 assert.match(html,/hidefeed=true&amp;widget=true&amp;embed=true/);
 assert.ok(js.includes("item.textContent=String(s.name||'')"),'supporter names must be inserted as text');
});

test('supporter names keep their visible spelling but lose controls and stop at 50 characters',async()=>{
 const {cleanSupporterName}=await load();
 assert.equal(cleanSupporterName('  北海道\u0000の人  '),'北海道の人');
 assert.equal(Array.from(cleanSupporterName('あ'.repeat(60))).length,50);
 assert.equal(cleanSupporterName(null),'');
});

test('the Worker owns the supporter API routes and deploys a SQLite Durable Object',()=>{
 const config=JSON.parse(read('wrangler.jsonc'));
 assert.deepEqual(config.assets.run_worker_first,['/api/*','/3d/audio/*']);
 assert.equal(config.durable_objects.bindings[0].name,'SUPPORTERS');
 assert.deepEqual(config.migrations[0].new_sqlite_classes,['SupporterStore']);
 for(const file of ['support.html','support.js'])assert.ok(read('scripts/build.cjs').includes("'"+file+"'"),file+' is not published');
});
