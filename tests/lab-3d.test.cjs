/* Tab 06 is a test bench: one place raised in 3D from two 1962 aerial photographs, kept out of search. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const LANGS=['en','ja','ko','zh-Hans','zh-Hant'];

test('tab 06 sits after the shopping tab on the home page and the map app',()=>{
 for(const file of ['index.html','explore.html']){const s=read(file);
  assert.ok(s.includes('<button id="mLab" class="mode mode-lab" role="tab" aria-selected="false"><span aria-hidden="true">06</span>'),file);
  assert.ok(s.indexOf('id="mShopping"')<s.indexOf('id="mLab"'),file);
  assert.ok(s.includes('THE ATLAS · 01 — 06')&&!s.includes('01 — 05'),file);
 }
 const js=read('explore.js');
 assert.equal((js.match(/modeLab: '/g)||[]).length,5);assert.equal((js.match(/noteLab: '/g)||[]).length,5);
 for(const snippet of ["['mLab','lab']","if (mode === 'lab') return buildLabCards();","if (mode === 'lab') return t('noteLab');","$('mLab').onclick = () => setMode('lab');",'href="/lab/gunkanjima-3d?lang='])assert.ok(js.includes(snippet),snippet);
 const intro=vm.runInNewContext(/const MODE_INTRO = \{[\s\S]*?\n\};/.exec(js)[0]+';MODE_INTRO');
 const cards=vm.runInNewContext(/const LAB_CARD = \{[\s\S]*?\n\};/.exec(js)[0]+';LAB_CARD');
 for(const l of LANGS){assert.ok(intro[l].lab&&intro[l].lab.replace(/<[^>]+>/g,'').length>=150,l+' intro');assert.equal(cards[l].length,2,l+' card');}
});

test('the lab page is kept out of search, credits GSI and loads nothing from other sites',()=>{
 const s=read('lab/gunkanjima-3d.html');
 assert.ok(s.includes('<meta name="robots" content="noindex">'));
 assert.ok(!/rel="canonical"/.test(s));
 assert.ok(s.includes('国土地理院の空中写真を加工して作成')&&s.includes('MKU628 C18-2')&&s.includes('30 May 1962'));
 for(const l of LANGS)assert.equal((s.match(new RegExp('data-lang="'+l+'"','g'))||[]).length,2,l);
 assert.ok(!/<script[^>]+src="https?:/.test(s));
 assert.ok(!/\.html["'#?]/.test(s),'links use clean routes');
 assert.ok(!/https?:\/\//.test(read('lab/gunkanjima-3d.js')));
 assert.ok(!read('sitemap.xml').includes('/lab/'));
 assert.ok(/const directories=\[[^\]]*'lab'/.test(read('scripts/build.cjs')),'build copies lab/');
});

test('the height grid matches its description and stays within plausible heights',()=>{
 const meta=JSON.parse(read('lab/gunkanjima-1962.json')),buf=fs.readFileSync(path.join(root,'lab',meta.grid.file));
 assert.equal(buf.length,meta.grid.w*meta.grid.h*2);
 let max=0;for(let i=0;i<buf.length;i+=2)max=Math.max(max,buf.readUInt16LE(i));
 const top=max*meta.grid.unit;assert.ok(top>20&&top<70,'tallest point '+top+' m');
 assert.ok(meta.grid.x0+(meta.grid.w-1)*meta.grid.step<meta.texture.size&&meta.grid.y0+(meta.grid.h-1)*meta.grid.step<meta.texture.size);
 for(const f of [meta.texture.file,'gunkanjima-1962-card.jpg']){const b=fs.readFileSync(path.join(root,'lab',f));assert.ok(b[0]===0xff&&b[1]===0xd8,f+' is a JPEG');}
 assert.equal(read('lab/gunkanjima-3d.js').match(/const V = '(\d+)'/)[1],read('lab/gunkanjima-3d.html').match(/gunkanjima-3d\.js\?v=(\d+)/)[1],'page and viewer share one asset version');
});
