/* Publish only the static site. Tests, git metadata and build files stay private. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
const tests=fs.readdirSync(path.join(root,'tests')).filter(x=>x.endsWith('.test.cjs')).map(x=>path.join(root,'tests',x));
cp.execFileSync(process.execPath,['--test',...tests],{stdio:'inherit'});
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const assetVersion=/const ASSET_V = '([^']+)'/.exec(sw)[1],dataVersion=/const DATA_V = '([^']+)'/.exec(sw)[1];
for(const name of ['app.js','explore.js'])assert.equal(/const DATA_V = '([^']+)'/.exec(fs.readFileSync(path.join(root,name),'utf8'))[1],dataVersion,name+' data version mismatch');
for(const name of ['index.html','explore.html','kids.html','ja.html','ko.html','zh-cn.html','zh-tw.html']){
 const html=fs.readFileSync(path.join(root,name),'utf8');
 for(const m of html.matchAll(/(?:src|href)="[^"?]+\.(?:js|css)\?v=([^"&]+)"/g))assert.equal(m[1],assetVersion,name+' asset version mismatch');
}
const directories=['data','icons','place','search'];
const files=['.nojekyll','LICENSE-DATA.md','_headers','app.js','atmosphere.js','design.css','explore.css','explore.html','explore.js','explore.webmanifest','index.html','ja.html','kids.html','ko.html','loop.js','manifest.webmanifest','og.jpg','page.css','place-ui.js','places.html','robots.txt','sitemap.xml','style.css','sw.js','zh-cn.html','zh-tw.html'];
assert.equal(path.dirname(dist),root);
fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist);
for(const name of [...directories,...files])fs.cpSync(path.join(root,name),path.join(dist,name),{recursive:true});
fs.writeFileSync(path.join(dist,'release.json'),JSON.stringify({assets:assetVersion,data:dataVersion,commit:process.env.CF_PAGES_COMMIT_SHA||process.env.WORKERS_CI_COMMIT_SHA||'local'}));
console.log('Validated static site prepared in dist; asset '+assetVersion+', data '+dataVersion);
