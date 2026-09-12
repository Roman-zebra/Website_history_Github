const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const api=require('../gyg-products.js'),catalog=require('../gyg-products-data.js'),config=require('../affiliate-config.json'),search=require('../search-core.js');
const now=new Date('2026-09-13T00:00:00Z');
test('all reviewed Japan products have source-linked coordinates; unresolved products do not become pins',()=>{
 const pins=api.points(catalog,now);assert.equal(catalog.products.length,18);assert.equal(pins.length,23);assert.equal(new Set(pins.map(p=>p.id)).size,23);assert.equal(catalog.completeJapanInventory,false);
 for(const p of pins){assert.ok(api.validProduct(p.product,now));assert.ok(!catalog.pending.some(x=>x.id===p.product.id));assert.equal(new URL(p.mapSource).searchParams.get('q'),'@'+p.lat+','+p.lon);}
});
test('expired, disabled, foreign, malformed and ambiguous product locations fail closed',()=>{
 const p=catalog.products[0];for(const bad of [{...p,enabled:false},{...p,country:'FR'},{...p,url:'https://evil.test/a-t647215/'},{...p,reviewBefore:'bad'},{...p,reviewBefore:'2020-01-01'},{...p,points:[]},{...p,points:[{...p.points[0],lat:NaN}]},{...p,points:[{...p.points[0],mapSource:'https://maps.google.com/'}]}])assert.equal(api.validProduct(bad,now),false);
 assert.equal(api.points(catalog,new Date('2027-01-01')).length,0);
});
test('clustering retains every product and option without moving their stored coordinates',()=>{
 const pins=api.points(catalog,now),before=JSON.stringify(pins);const clusters=api.clusters(pins,p=>({x:p.lon*2,y:p.lat*2}));assert.equal(clusters.flat().length,pins.length);assert.equal(new Set(clusters.flat().map(p=>p.id)).size,pins.length);assert.equal(JSON.stringify(pins),before);
 assert.equal(pins.filter(p=>p.product.id==='1030473').length,3);assert.equal(pins.filter(p=>p.product.id==='1368252').length,2);
});
test('direct product links retain product ID, partner and per-option campaign; configuration can disable ads',()=>{
 for(const p of api.points(catalog,now)){const u=new URL(api.trackedURL(p,config));assert.equal(u.searchParams.get('partner_id'),'BHO3FAQ');assert.equal(u.searchParams.get('utm_medium'),'online_publisher');assert.ok(u.pathname.endsWith('-t'+p.product.id+'/'));assert.ok(u.searchParams.get('cmp').includes(p.id));}
 assert.equal(api.trackedURL(api.points(catalog,now)[0],{...config,enabled:false}),null);
});
test('nationwide keyword search finds product pins and excludes unlocated candidates',()=>{
 const rows=api.searchRecords(api.points(catalog,now),search);
 for(const [q,id] of [['茶道','647215'],['白川郷','366250'],['相撲','1042988'],['sumo','601502'],['屋久島','1030473'],['GetYourGuide','1181414']])assert.ok(search.search(rows,q,'ja').some(p=>p.id.startsWith('gyg-'+id+'-')),q);
 assert.equal(search.search(rows,'GetYourGuide','en').length,23);
});
test('published entrypoints and worker load the product catalog and direct hash restoration before generic spots',()=>{
 for(const f of ['index.html','explore.html']){const s=fs.readFileSync(require.resolve('../'+f),'utf8');assert.ok(s.indexOf('gyg-products-data.js')<s.indexOf('src="explore.js'));assert.ok(s.includes('gyg-products.js'));}
 const ui=fs.readFileSync(require.resolve('../explore.js'),'utf8');assert.match(ui,/restoreGygPoint\(\) \|\| restoreActivity/);assert.match(ui,/drawGygPins\(\);\s+const z = map.getZoom/);assert.match(ui,/if\(o.gygPoints\)/);assert.match(ui,/if\(row.kind==='gyg'\)/);
});
