const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('contour comparisons are off by default and cannot silently discard cabinet or cushion input',async()=>{
 const {resolveCushionContourStudy:r}=await import('../assets-src/shinsekai/browser-study/cushion-contour-study.mjs');assert.equal(r(),null);
 for(const revision of ['035','065']){assert.throws(()=>r({revision}));assert.throws(()=>r({revision,cushion:true}));assert.throws(()=>r({revision,cabinet:true}));assert.deepEqual(r({revision,cushion:true,cabinet:true}),{revision,round:'upper-cushion-119-004',path:`/study/upper-cushion-119-004/interior-cushion-g${revision}.glb`});}
 for(const revision of ['',0,'004','../035','NaN'])assert.throws(()=>r({revision,cushion:true,cabinet:true}));
});
test('contour route remains local-only and metadata identifies the exact optional derivative',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../assets-src/shinsekai/browser-study/building-a.mjs'),'utf8');assert.match(source,/cushionContour&&part==='interior'\?cushionContour.path/);assert.match(source,/\$\{cushionContour.round\}-g\$\{cushionContour.revision\}/);
 const server=fs.readFileSync(path.join(__dirname,'../scripts/serve-shinsekai-study.cjs'),'utf8');assert.match(server,/cushionContourPaths\.has\(pathname\)/);assert.match(server,/\['035','065'\]/);
 const build=fs.readFileSync(path.join(__dirname,'../scripts/build.cjs'),'utf8');assert.doesNotMatch(build,/upper-cushion-119-004|research-cache/);
});
test('perimeter comparisons require exact contour035 and retained cabinet/cushion inputs',async()=>{
 const {resolveCushionContourStudy:r}=await import('../assets-src/shinsekai/browser-study/cushion-contour-study.mjs');
 for(const perimeter of ['022','040']){
  for(const revision of [null,'065','035'])for(const cushion of [false,true])for(const cabinet of [false,true]){const args={perimeter,revision,cushion,cabinet};if(revision==='035'&&cushion&&cabinet)assert.deepEqual(r(args),{revision,perimeter,round:'upper-cushion-119-005',path:`/study/upper-cushion-119-005/interior-cushion-gap${perimeter}.glb`});else assert.throws(()=>r(args));}
 }
 for(const perimeter of ['',0,'3','022/../040','NaN'])assert.throws(()=>r({perimeter,revision:'035',cushion:true,cabinet:true}));
});
