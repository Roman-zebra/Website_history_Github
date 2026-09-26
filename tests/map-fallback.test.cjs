/* If Esri's street tiles stop loading, the map still gets a base layer: GSI's pale map. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','explore.js'),'utf8');
const start=source.indexOf('function watchBaseLayer');
const watcher=source.slice(start,start+source.slice(start).search(/\r?\n\}\r?\n/))+'\n}\n';

function setup(online){
 const map={layers:new Set(),removeLayer(l){this.layers.delete(l);}};
 const tileLayer=(url,opts)=>{const on={};const l={url,opts,back:false,
  on(n,f){(on[n]=on[n]||[]).push(f);return l;},off(n,f){on[n]=(on[n]||[]).filter(g=>g!==f);return l;},
  fire(n){for(const f of [...(on[n]||[])])f();},addTo(m){m.layers.add(l);return l;},bringToBack(){l.back=true;return l;}};return l;};
 const ctx={navigator:{onLine:online},L:{tileLayer},GSI:'https://cyberjapandata.gsi.go.jp/xyz',GSI_ATTR:'GSI Tiles',map};
 vm.createContext(ctx);vm.runInContext('var baseLayer;'+watcher,ctx);
 const esri=tileLayer('https://server.arcgisonline.com/tile').addTo(map);
 ctx.baseLayer=esri;vm.runInContext('watchBaseLayer()',ctx);
 return {ctx,map,esri,fail:n=>{for(let i=0;i<n;i++)ctx.baseLayer.fire('tileerror');}};
}

test('eight failed Esri tiles in a row swap in the GSI pale map beneath the photographs',()=>{
 const {ctx,map,esri,fail}=setup(true);
 fail(7);assert.equal(ctx.baseLayer,esri,'seven misses are not enough');
 fail(1);
 assert.ok(!map.layers.has(esri),'the Esri layer is removed');
 assert.match(ctx.baseLayer.url,/\/xyz\/pale\/\{z\}\/\{x\}\/\{y\}\.png$/);
 assert.ok(map.layers.has(ctx.baseLayer)&&ctx.baseLayer.back,'the pale map sits under the photo layers');
 assert.equal(ctx.baseLayer.opts.attribution,'GSI Tiles');
 fail(20);assert.equal(map.layers.size,1,'the pale map is not watched or replaced again');
});

test('a tile that loads resets the count, and nothing changes while offline',()=>{
 const patchy=setup(true);
 for(let i=0;i<5;i++){patchy.fail(7);patchy.esri.fire('tileload');}
 assert.equal(patchy.ctx.baseLayer,patchy.esri);
 const offline=setup(false);offline.fail(30);
 assert.equal(offline.ctx.baseLayer,offline.esri);
});
