/* The Gunkanjima 3D model in five languages: the building list is Japanese, so every name, use,
   structure and note the viewer or the building table can show needs its other languages in
   3d/gunkanjima-names.json. Until 2026-09-16 the labels on the model and the building panel stayed
   Japanese on the English, Korean and Chinese pages, and the English table listed five uses in Japanese. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),json=p=>JSON.parse(read(p));
const LANGS=['en','ja','ko','zh-Hans','zh-Hant'],OTHERS=['en','ko','zh-Hans','zh-Hant'];
const PAGES={en:'3d/gunkanjima.html',ja:'3d/ja/gunkanjima.html',ko:'3d/ko/gunkanjima.html','zh-Hans':'3d/zh-cn/gunkanjima.html','zh-Hant':'3d/zh-tw/gunkanjima.html'};
const KANA=/[぀-ヿ]/,CJK=/[぀-ヿ㐀-鿿가-힯＀-￯]/,HANGUL=/[가-힯]/;
const names=json('3d/gunkanjima-names.json'),model=json('3d/gunkanjima-model.json');
const spots=json('3d/gunkanjima-spots.json'),interiors=json('3d/gunkanjima-interiors.json');
const NUMBERED=/^(\d+)号棟$/;
const strings=field=>[...new Set(model.buildings.map(b=>b[field]).filter(v=>v!==null&&v!==undefined&&v!==''))];
const sources=()=>{const m=new Map();for(const s of Object.values(spots.sources))m.set(s.url,s.label);for(const sc of Object.values(interiors.scenes))for(const x of sc.sources||[])m.set(x.url,x.label);return m;};
/* a value must read as its own language: no kana outside Japanese, nothing East Asian in English, Hangul in Korean */
function sounds(l,v,what){
 assert.equal(typeof v,'string',what);assert.ok(v.trim().length>0,what+' is empty');
 if(l==='en')assert.ok(!CJK.test(v),what+' has Japanese or other East Asian text: '+v);
 if(l!=='ja')assert.ok(!KANA.test(v),what+' has kana: '+v);
 if(l==='ko')assert.ok(HANGUL.test(v),what+' has no Hangul: '+v);
 if(l==='zh-Hans'||l==='zh-Hant')assert.ok(!HANGUL.test(v),what+' has Hangul: '+v);
}
/* the viewer's own lookups, taken from 3d/gunkanjima-3d.js and run for one language */
function viewerFor(lang,withNames=true){
 const js=read('3d/gunkanjima-3d.js').split('\r\n').join('\n');
 const a=js.indexOf("  /* ---------- the building list in the reader's language ----------"),b=js.indexOf('  /* ---------- spots, building labels and the panel ---------- */');
 assert.ok(a>0&&b>a,'the name block is in the viewer');
 const T={schoolShort:{en:'School',ja:'小中学校',ko:'학교','zh-Hans':'学校','zh-Hant':'學校'}[lang]};
 return vm.runInNewContext(js.slice(a,b)+'\nnames = NAMES_IN;\n({ buildingName, buildingLabel, useText, noteText, structureText, sourceLabel })',{LANG:lang,T,NAMES_IN:withNames?names:null});
}

test('every string of the building list has its other languages',()=>{
 for(const l of LANGS){sounds(l,names.numbered.name[l],'numbered name '+l);sounds(l,names.numbered.label[l],'numbered label '+l);assert.ok(names.numbered.name[l].includes('{n}')&&names.numbered.label[l].includes('{n}'),l+' number slot');}
 for(const n of strings('name')){
  if(NUMBERED.test(n))continue;
  const e=names.names[n];assert.ok(e,'no translation for the name '+n);
  for(const l of OTHERS)sounds(l,e[l],n+' '+l);
  if(e.short)for(const l of LANGS)sounds(l,e.short[l],n+' short '+l);
 }
 for(const u of strings('use')){const e=names.uses[u];assert.ok(e,'no translation for the use '+u);for(const l of OTHERS)sounds(l,e[l],u+' '+l);}
 for(const f of ['notes','builtNote','storeysNote','goneNote'])for(const t of strings(f)){const e=names.notes[t];assert.ok(e,'no translation for the '+f+' '+t);for(const l of OTHERS)sounds(l,e[l],t+' '+l);}
 for(const c of strings('structure')){const e=names.structures[c];assert.ok(e,'no name for the structure '+c);for(const l of LANGS)sounds(l,e[l],c+' '+l);}
 for(const [url,label] of sources()){
  assert.ok(label.en&&label.ja,url+' carries English and Japanese in its own data');
  const e=names.sources[url];assert.ok(e,'no Korean or Chinese label for '+url);
  for(const l of ['ko','zh-Hans','zh-Hant']){sounds(l,e[l],url+' '+l);assert.notEqual(e[l],label.en,url+' '+l+' is the English label');}
 }
});

test('the labels on the model and the building panel follow the page language',()=>{
 const named=model.buildings.filter(b=>b.name);
 assert.ok(named.length>=40,'the model names its buildings');
 const seen={};
 for(const l of LANGS){
  const v=viewerFor(l);
  const labels=named.map(b=>v.buildingLabel(b.name));
  seen[l]=labels;
  for(const b of named){
   sounds(l,v.buildingLabel(b.name),b.name+' label in '+l);
   sounds(l,v.buildingName(b.name),b.name+' title in '+l);
   assert.ok(v.buildingLabel(b.name).length<=28,b.name+' label is short enough for the model in '+l+': '+v.buildingLabel(b.name));
   if(b.use)sounds(l,v.useText(b.use),b.name+' use in '+l);
   if(b.structure)sounds(l,v.structureText(b.structure),b.name+' structure in '+l);
   for(const f of ['notes','builtNote','storeysNote','goneNote'])if(b[f])sounds(l,v.noteText(b[f]),b.name+' '+f+' in '+l);
  }
  for(const [url,label] of sources()){const s=v.sourceLabel({url,label});sounds(l,s,url+' in '+l);if(l==='en'||l==='ja')assert.equal(s,label[l],url+' keeps its own '+l+' label');}
 }
 /* Japanese pages show the list as before; the other four show no Japanese name at all */
 assert.deepEqual(seen.ja,named.map(b=>b.name.replace('端島小中学校','小中学校')));
 const v=viewerFor('en');
 assert.equal(v.buildingLabel('65号棟'),'No. 65');assert.equal(v.buildingName('65号棟'),'Building 65');
 assert.equal(v.buildingLabel('端島小中学校体育館'),'School gymnasium','not "School体育館"');
 assert.equal(v.buildingLabel('総合事務所'),'General office','the bracket stays in the panel title only');
 assert.equal(viewerFor('ko').buildingLabel('30号棟'),'30호동');
 assert.equal(viewerFor('zh-Hant').structureText('RC'),'鋼筋混凝土結構');
 assert.equal(viewerFor('ja').structureText('brick'),'れんが造','Japanese pages no longer show "brick"');
 /* negative control: without the file the English labels are the Japanese list, which the checks above reject */
 const bare=viewerFor('en',false);
 assert.equal(bare.buildingLabel('65号棟'),'65号棟');
 assert.equal(bare.buildingLabel('端島小中学校'),'School');
 assert.throws(()=>sounds('en',bare.buildingLabel('オリバーフィルター室'),'bare label'));
 assert.throws(()=>sounds('ko',bare.useText('鉱員社宅'),'bare use'));
});

test('the viewer loads the names and uses them wherever the building list is shown',()=>{
 const js=read('3d/gunkanjima-3d.js');
 for(const need of [
  "fetch(asset('gunkanjima-names.json'))",
  'el.textContent = buildingLabel(b.name);',
  "$('spotTitle').textContent = b.name ? buildingName(b.name) : T.unknown;",
  'esc(useText(b.use))','esc(structureText(b.structure))','esc(noteText(b.notes))',
  'esc(noteText(b.builtNote))','esc(noteText(b.storeysNote))','esc(noteText(b.goneNote))',
  'esc(sourceLabel(src))','esc(sourceLabel(x))'
 ])assert.ok(js.includes(need),need);
 for(const raw of ["b.name.replace('端島小中学校'",'esc(b.use)','esc(b.structure)','esc(b.notes)','esc(b.builtNote)','esc(b.storeysNote)','esc(b.goneNote)','src.label[LANG] || src.label.en)','x.label[LANG] || x.label.en)',"textContent = b.name || T.unknown"])
  assert.ok(!js.includes(raw),'the viewer still shows the raw list: '+raw);
});

test('the building table under the model is in the page language',()=>{
 const JA=new Set([...strings('name'),...strings('use'),...strings('builtNote')]);
 for(const [l,file] of Object.entries(PAGES)){
  const s=read(file);
  const m=/<table class="bld-table">([\s\S]*?)<\/table>/.exec(s);
  assert.ok(m,l+' has the building table');
  const cells=[...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].flatMap(x=>x[1].split(/<small>|<\/small>/)).map(x=>x.replace(/<[^>]+>/g,'').trim()).filter(Boolean);
  assert.ok(cells.length>100,l+' table has rows');
  for(const c of cells){
   if(l==='ja')continue;
   /* years, storeys and dashes carry no script, so only the absence of Japanese is checked here */
   if(l==='en')assert.ok(!CJK.test(c),'en table cell: '+c);else assert.ok(!KANA.test(c),l+' table cell: '+c);
   /* Chinese may write a name or note exactly as Japanese does (端島神社, 1925年以前); that is only right when the file says so */
   if(JA.has(c)){const same=[names.names[c],names.uses[c],names.notes[c]].some(e=>e&&e[l]===c);assert.ok(same,l+' table shows the Japanese '+c);}
  }
  if(l!=='ja')for(const u of ['会議室','会社事務所','仕上工場','資材倉庫'])assert.ok(!m[1].includes('<td>'+u+'</td>'),l+' '+u);
 }
});
