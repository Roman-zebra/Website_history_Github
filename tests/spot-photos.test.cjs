/* Tabs 03/04/05 got pictorial pins, and the panels of the larger pins (p1-p3) show a ground-level photograph
   instead of the aerial tile (2026-09-29). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=read('explore.js');
const src=read('activities-data.js'),activities=JSON.parse(src.slice(src.indexOf('{'),src.lastIndexOf('}')+1)).places;
const liminal=JSON.parse(read('data/liminal.json')).places;
const featured=JSON.parse(read('data/places-world.json')).places;
const landmarks=JSON.parse(read('data/landmarks.json')).landmarks;
const regional=JSON.parse(read('data/regional-landmarks-v1.json')).landmarks;
const photos=JSON.parse(read('data/spot-photos-v1.json')).photos;

function art(){
 const ctx={document:{addEventListener(){}},L:{divIcon:x=>x},placeName:p=>p.name,esc:s=>String(s)};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('const LANDMARK_ART_BY_ID ='),source.indexOf('const midIcon =')),ctx);
 return ctx;
}

test('every liminal, food and shopping pin resolves to a local WebP picture at its p3 size',()=>{
 const ctx=art(),files=new Set();
 for(const [prefix,list] of [['l:',liminal],['a:',activities]])for(const p of list){
  const url=ctx.landmarkArt({artKey:prefix+p.id},'p3');
  assert.match(url,/^\/icons\/landmarks\/[a-z0-9-]+-v[1-9]\.webp$/,prefix+p.id);
  assert.equal(ctx.landmarkArt({artKey:prefix+p.id},'p3 mini'),url);
  assert.equal(ctx.landmarkArt({artKey:prefix+p.id}),url,'the selected pin shows it too');
  assert.equal(ctx.landmarkArt({artKey:prefix+p.id},'p4'),'');
  const b=fs.readFileSync(path.join(root,url));assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');
  files.add(url);
 }
 assert.equal(liminal.length+activities.length,63);
 assert.ok(files.size>=58,'separate art for all but the shared places');
 assert.equal(ctx.landmarkArt({artKey:'l:no-such-place'},'p3'),'');
 assert.equal(ctx.landmarkArt({artKey:'l:qua-palace'},'p3'),'/icons/landmarks/qua-palace-v1.webp');
 // shared with the landmark that is the same place
 assert.equal(ctx.landmarkArt({artKey:'a:shibuya-shopping'},'p3'),ctx.landmarkArt({wiki_en:'Shibuya Crossing',pop:2},'p2'));
 assert.equal(ctx.landmarkArt({artKey:'a:nakano-shopping'},'p3'),ctx.landmarkArt({artKey:'l:nakano-broadway'},'p3'));
});

test('the pins and the selected pin of tabs 03/04/05 carry their art key',()=>{
 assert.ok(source.includes("bigIcon({ emoji: p.emoji, name: nm, artKey: 'l:' + p.id }, 'ring-lim'"));
 assert.ok(source.includes("p.artKey = 'a:' + p.id"));
 assert.ok(source.includes("emoji: p.emoji, artKey: 'l:' + p.id }]"));
 assert.ok(source.includes("emoji:p.emoji,artKey:'a:'+p.id}]"));
});

test('every p1-p3 record and every tab 03/04/05 record has a checked ground-level photograph',()=>{
 const want=[
  ...featured.filter(p=>p.id!=='aneyoshi').map(p=>'f:'+p.id),   // Aneyoshi's subject is the stone, and its photo is the stone
  ...landmarks.map(p=>'lm:'+p.wiki_en),   // every landmark, p4 included (2026-09-29 round 3)
  ...regional.map(p=>'rg:'+p.id),
  ...activities.map(p=>'a:'+p.id),
  ...liminal.filter(p=>p.id!=='qua-palace').map(p=>'l:'+p.id)];
 assert.equal(want.length,206);
 for(const k of want)assert.ok(photos[k],k+' has no photograph');
 const keys=new Set(want);
 for(const k of Object.keys(photos))assert.ok(keys.has(k),k+' is not a p1-p3 or tab 03/04/05 record');
 assert.equal(photos['l:qua-palace'],undefined,'no free photograph of Qua Palace exists; its panel keeps the aerial tile');
 for(const [k,v] of Object.entries(photos)){
  assert.match(v.src,/^https:\/\/(upload|thumb)\.wikimedia\.org\/wikipedia\/commons\/(thumb\/.+\/500px-[^/]+|[0-9a-f]\/[0-9a-f]{2}\/[^/]+)$/,k);   // the file itself when it is narrower than 500px
  assert.ok(v.file&&!/[?#]/.test(v.src),k);
  assert.match(v.license,/^(CC0|CC BY(-SA)? [0-9.]+( jp)?|Public domain)$/,k+' '+v.license);
 }
});

test('the panels use the photograph first and the aerial tile only as the fallback',()=>{
 assert.ok(source.includes("photoFields(p.regional ? 'rg:' + p.id : 'lm:' + p.wiki_en, airPhoto(p.lat, p.lon), t('photoAir'))"));
 assert.ok(source.includes("...photoFields('a:'+p.id,tileURL("));
 assert.ok(source.includes("...photoFields('l:' + p.id, p.img || tileURL("));
 assert.ok(source.includes("...photoFields('f:' + p.id, (p.monument && p.monument.img) || '',"),'featured: photo first, memorial stone next');
 assert.ok(source.includes("const pic = ph ? ph.src : (p.monument && p.monument.img) || tileURL(lyr, ext, p.lat, p.lon, 15);"),'tab 01 cards use the photograph');
 assert.ok(photos['f:okayama']&&/Okayama/i.test(photos['f:okayama'].file),'Okayama shows the castle');
 // a previous spot's srcset must never survive into the next panel
 assert.ok(/else \{ img\.removeAttribute\('srcset'\); img\.removeAttribute\('sizes'\); \}/.test(source));
 assert.ok(read('sw.js').includes("'spot-photos-v1.json'"));
});

test('the cards of tabs 01, 03, 04, 05 and 06 show the map picture instead of an emoji',()=>{
 const ctx=art();
 for(const p of featured)assert.match(ctx.landmarkArt({...p,pop:p.pop||1},'p1'),/^\/icons\/landmarks\/.+\.webp$/,p.id);
 assert.match(ctx.landmarkArt({artKey:'l:hashima-island'}),/hashima-island/);
 assert.ok(source.includes("cardBadge(p.emoji, landmarkArt({ artKey: 'l:' + p.id }))"));
 assert.ok(source.includes("cardBadge(p.emoji, landmarkArt({ ...p, pop: p.pop || 1 }, 'p1'))"));
 assert.ok(source.includes("+cardBadge(p.emoji,landmarkArt(p))"));
 assert.ok(source.includes("it.artKey ? landmarkArt({ artKey: it.artKey }) : ''"));
 assert.ok(source.includes("path: 'gunkanjima', artKey: 'l:hashima-island'"));
 assert.ok(/onerror="this\.parentElement\.classList\.remove\(\\'card-art\\'\)/.test(source),'a missing picture falls back to the emoji');
});

test('food and shopping cards show the photograph and drop the map-preview label with it',()=>{
 assert.ok(source.includes("(PHOTOS['a:'+p.id]||{}).src||tileURL("));
 assert.ok(source.includes("+(PHOTOS['a:'+p.id]?'':'<span class=\"card-era\">'"));
});

test('local spots with their own Wikipedia article ask for its picture, guarded against a changed panel',()=>{
 assert.ok(source.includes('const wt = wl && wikiTagParse(tg.wikipedia);'));
 assert.ok(source.includes('if (!src || token !== panelToken) return;'));
});
