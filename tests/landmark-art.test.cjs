const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../explore.js'),'utf8');
function runtime(){
 const handlers={},ctx={document:{addEventListener:(name,fn)=>handlers[name]=fn},L:{divIcon:x=>x},placeName:p=>p.name||p.wiki_en,esc:s=>String(s).replaceAll('<','&lt;')};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('const LANDMARK_ART ='),source.indexOf('const midIcon =')),ctx);
 return {ctx,handlers};
}
test('pictorial markers use size, never the independent zoom tier',()=>{
 const {ctx}=runtime();
 assert.match(ctx.landmarkArt({wiki_en:'Mount Fuji',pop:1,tier:3},'p1 mini'),/mount-fuji/);
 assert.match(ctx.landmarkArt({wiki_en:'Tokyo Tower',pop:2,tier:1},'p2'),/tokyo-tower/);
 for(const pop of [undefined,0,3,4,'1',-1,NaN])assert.equal(ctx.landmarkArt({wiki_en:'Mount Fuji',pop,tier:1},'p1'),'');
 assert.equal(ctx.landmarkArt({wiki_en:'Mount Fuji',pop:1},'p3'),'');
 assert.equal(ctx.landmarkArt({wiki_en:'Unreviewed Castle',pop:1},'p1'),'');
});
test('Himeji aliases share art and unrelated places cannot inherit it',()=>{
 const {ctx}=runtime();
 assert.equal(ctx.landmarkArt({id:'himeji',pop:1}),ctx.landmarkArt({wiki_en:'Himeji Castle',pop:2}));
 assert.equal(ctx.landmarkArt({id:'tokyo',pop:1}), '');
});
test('failed or pending image keeps emoji; successful load activates only that marker',()=>{
 const {ctx,handlers}=runtime();const p={id:'himeji',pop:1,emoji:'🏯',name:'<castle>'};
 const icon=ctx.bigIcon(p,'ring-red',true,'p1');
 assert.ok(icon.html.includes('<span>🏯</span>'));assert.ok(!icon.html.includes('landmark-ready'));
 assert.ok(icon.html.includes('alt=""'));assert.ok(icon.html.includes('&lt;castle>'));
 let ready=0;const parentElement={classList:{add:x=>{assert.equal(x,'landmark-ready');ready++;}}};
 handlers.load({target:{classList:{contains:()=>false},parentElement}});assert.equal(ready,0);
 handlers.load({target:{classList:{contains:x=>x==='landmark-image'},parentElement}});assert.equal(ready,1);
 assert.ok(!ctx.bigIcon({...p,pop:3},'ring-red',false,'p3').html.includes('<img'));
 assert.ok(!ctx.bigIcon(p,'ring-red',false,'p1 mini').html.includes('big-label'));
});
test('every referenced illustration is a small locally served WebP',()=>{
 const files=[...new Set([...source.matchAll(/'([a-z-]+-v1\.webp)'/g)].map(m=>m[1]))];assert.equal(files.length,3);
 let total=0;for(const file of files){const b=fs.readFileSync(path.join(__dirname,'../icons/landmarks',file));assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');total+=b.length;}
 assert.ok(total<45000,'Three icons should stay below 45KB combined');
});
