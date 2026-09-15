/* Publish only the static site. Tests, git metadata and build files stay private. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
cp.execFileSync(process.execPath,[path.join(__dirname,'build-icons.cjs')],{stdio:'inherit'});
cp.execFileSync(process.execPath,[path.join(__dirname,'build-discovery.cjs')],{stdio:'inherit'});
cp.execFileSync(process.execPath,[path.join(__dirname,'build-3d-pages.cjs')],{stdio:'inherit'});
cp.execFileSync(process.execPath,[path.join(__dirname,'build-3d-index.cjs')],{stdio:'inherit'});
const tests=fs.readdirSync(path.join(root,'tests')).filter(x=>x.endsWith('.test.cjs')).map(x=>path.join(root,'tests',x));
cp.execFileSync(process.execPath,['--test',...tests],{stdio:'inherit'});
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const assetVersion=/const ASSET_V = '([^']+)'/.exec(sw)[1],dataVersion=/const DATA_V = '([^']+)'/.exec(sw)[1];
for(const name of ['app.js','explore.js'])assert.equal(/const DATA_V = '([^']+)'/.exec(fs.readFileSync(path.join(root,name),'utf8'))[1],dataVersion,name+' data version mismatch');
for(const name of ['index.html','explore.html','kids.html','ja.html','ko.html','zh-cn.html','zh-tw.html']){
 const html=fs.readFileSync(path.join(root,name),'utf8');
 for(const m of html.matchAll(/(?:src|href)="[^"?]+\.(?:js|css)\?v=([^"&]+)"/g))assert.equal(m[1],assetVersion,name+' asset version mismatch');
}
/* On a first visit the app shells preload explore.js's start-up files; each must still be a file explore.js fetches. */
const explore=fs.readFileSync(path.join(root,'explore.js'),'utf8');
for(const name of ['index.html','explore.html']){
 const boot=[...fs.readFileSync(path.join(root,name),'utf8').matchAll(/'((?:data[/])?[^'?/]+[.]json)[?]v=[^']+'/g)].map(m=>m[1]);
 assert.ok(boot.length>=8,name+' start-up preloads');
 for(const file of boot)assert.ok(explore.includes("'"+file+"'"),name+' preloads '+file+', which explore.js does not fetch');
}
const directories=['data','icons','3d','place','search','guides','visit','vendor'];
const files=['walking-data.js','walking-time.js','walking-time.css','gyg-products-data.js','gyg-products.js','gyg-frame.html','gyg-widget.js','activities-data.js','search-core.js','search-worker.js','visit.html','about.html','about.js','affiliate-router.js','affiliate-config.json','th.html','.nojekyll','LICENSE-DATA.md','_headers','_redirects','app.js','atmosphere.js','design.css','explore.css','explore.html','explore.js','explore.webmanifest','index.html','ja.html','kids.html','ko.html','loop.js','manifest.webmanifest','og.jpg','page.css','place-ui.js','places.html','robots.txt','sitemap.xml','553bf2e0eaae7329e0477ae46475d218.txt','style.css','sw.js','zh-cn.html','zh-tw.html'];
assert.equal(path.dirname(dist),root);
fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist);
for(const name of [...directories,...files])fs.cpSync(path.join(root,name),path.join(dist,name),{recursive:true});
/* Pages outside the app shells name the root stylesheets and scripts with ?v=. The place, visit and 3D generators take it
   from sw.js, but older hand-made pages (guides, the liminal and landmark place pages) keep the number they were written
   with, and design.css is immutable for a year, so every page in dist is given this release's version. */
const htmlIn=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?htmlIn(path.join(dir,e.name)):e.name.endsWith('.html')?[path.join(dir,e.name)]:[]);
let versioned=0;
for(const file of htmlIn(dist)){
 const html=fs.readFileSync(file,'utf8');
 let next=html.replace(/((?:src|href)="[/]?[^"?/]+[.](?:js|css)[?]v=)[^"&]+"/g,'$1'+assetVersion+'"');
 // the first-visit preload list in the app shells: data files carry the data version, the rest the asset version
 if(path.dirname(file)===dist&&['index.html','explore.html'].includes(path.basename(file)))
  next=next.replace(/'(data[/][^'?]+[.]json)[?]v=[^']+'/g,"'$1?v="+dataVersion+"'").replace(/'(affiliate-config[.]json)[?]v=[^']+'/g,"'$1?v="+assetVersion+"'");
 if(next!==html){fs.writeFileSync(file,next);versioned++;}
}
/* search engine ownership codes (scripts/seo/verification.json) go on the home page as meta tags */
const seo=require('./seo/titles.cjs'),home=path.join(dist,'index.html');
fs.writeFileSync(home,seo.injectVerification(fs.readFileSync(home,'utf8'),seo.loadVerification()));
fs.writeFileSync(path.join(dist,'release.json'),JSON.stringify({assets:assetVersion,data:dataVersion,commit:process.env.CF_PAGES_COMMIT_SHA||process.env.WORKERS_CI_COMMIT_SHA||'local'}));
console.log('Validated static site prepared in dist; asset '+assetVersion+', data '+dataVersion+'; '+versioned+' pages given the asset version');

