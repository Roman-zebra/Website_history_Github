const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'explore.js'),'utf8');
function runtime(){
 const handlers={},ctx={document:{addEventListener:(name,fn)=>handlers[name]=fn},L:{divIcon:x=>x},placeName:p=>p.name||p.wiki_en,esc:s=>String(s).replaceAll('<','&lt;')};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('const LANDMARK_ART_BY_ID ='),source.indexOf('const midIcon =')),ctx);
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
test('Himeji aliases share art and unrelated places get their own art',()=>{
 const {ctx}=runtime();
 assert.equal(ctx.landmarkArt({id:'himeji',pop:1}),ctx.landmarkArt({wiki_en:'Himeji Castle',pop:2}));
 assert.match(ctx.landmarkArt({id:'tokyo',pop:1}),/sensoji-main-hall/);
 assert.notEqual(ctx.landmarkArt({id:'tokyo',pop:1}),ctx.landmarkArt({wiki_en:'Tokyo Tower',pop:2}));
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
test('all 128 top-two-layer records resolve to 124 locally served WebP icons',()=>{
 const {ctx}=runtime();const data=[['places-world.json','places'],['landmarks.json','landmarks'],['regional-landmarks-v1.json','landmarks']].map(([file,key])=>JSON.parse(fs.readFileSync(path.join(root,'data',file),'utf8'))[key]);
 let count=0;const files=new Set();
 for(const list of data)for(const p of list){
  const art=ctx.landmarkArt(p,'p'+p.pop);
  if(p.pop===1||p.pop===2){assert.match(art,/^\/icons\/landmarks\/[a-z0-9-]+-v[1-9]\.webp$/);files.add(path.basename(art));count++;}
  else assert.equal(art,'',p.name||p.id);
 }
 assert.equal(count,128);assert.equal(files.size,124);
 let total=0;for(const file of files){const b=fs.readFileSync(path.join(root,'icons/landmarks',file));assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');total+=b.length;}
 assert.ok(total<3_000_000,'Artwork set should remain lightweight');
});
