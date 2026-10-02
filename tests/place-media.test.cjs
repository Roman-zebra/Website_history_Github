const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const media=require('../place-media.js'),boundary=require('../japan-boundary.js');
test('OpenPOI handles missing coordinates, preserves attribution, and keeps distinct branches',()=>{
 const base={name:'小さな店',lat:35.68,lng:139.76,prefecture:'東京都',city:'千代田区',address:'東京都千代田区1-2',attributions:['Provider'],licenses:['CC BY 4.0']};
 const rows=media.rows({results:[base,{...base,lat:''},{...base,lng:null},{...base,lat:'nan'},{...base,lat:37.56,lng:126.97}]},boundary.contains);
 assert.equal(rows.length,1);assert.equal(rows[0].address,'東京都千代田区1-2');assert.deepEqual(rows[0].attributions,['Provider']);
 assert.equal(media.merge(rows,[{...rows[0],lat:35.68001},{...rows[0],lat:35.69}]).length,2);
 const url=new URL(media.searchURL('カフェ',{west:139,south:35,east:140,north:36},true));assert.equal(url.searchParams.get('bbox'),'139,35,140,36');assert.equal(url.searchParams.get('limit'),'200');
 const nameURL=new URL(media.searchURL('世田谷区 カフェ'));assert.equal(nameURL.pathname,'/v1/suggest');assert.equal(nameURL.searchParams.get('limit'),'20');
 const links=media.links('同名店',[35.68,139.76],'千代田区1-2');assert.match(new URL(links.maps).searchParams.get('query'),/同名店 千代田区1-2/);assert.equal(new URL(links.street).searchParams.get('viewpoint'),'35.68,139.76');
});
test('photographs require an exact name, matching Earth coordinates and a free image licence',async()=>{
 const entity={labels:{ja:{value:'小さな店'}},claims:{P625:[{mainsnak:{datavalue:{value:{latitude:35.68,longitude:139.76,globe:'http://www.wikidata.org/entity/Q2'}}}}],P18:[{mainsnak:{datavalue:{value:'Shop.jpg'}}}]}};
 let calls=0,license='CC BY-SA 4.0';
 const fetcher=async url=>{calls++;const action=new URL(url).searchParams.get('action');return {ok:true,json:async()=>action==='wbsearchentities'?{search:[{id:'Q1'}]}:action==='wbgetentities'?{entities:{Q1:entity}}:{query:{pages:{1:{imageinfo:[{mime:'image/jpeg',thumburl:'https://upload.wikimedia.org/shop.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Shop.jpg',extmetadata:{Artist:{value:'<a>Photographer</a>'},LicenseShortName:{value:license}}}]}}}}};};
 const p={name:'小さな店',lat:35.68,lon:139.76};const photo=await media.photoForPlace(p,null,fetcher);assert.match(photo.cap,/Photographer · CC BY-SA 4.0/);assert.equal(calls,3);
 entity.labels.ja.value='同名に似た店';assert.equal(await media.photoForPlace(p,null,fetcher),null);
 entity.labels.ja.value=p.name;entity.claims.P625[0].mainsnak.datavalue.value.latitude=35.69;assert.equal(await media.photoForPlace(p,null,fetcher),null);
 license='All rights reserved';assert.equal(await media.commonsPhoto('File:Shop.jpg',null,fetcher),null);
});
test('name searches use AND suggestions and area searches reject nationwide fallback',async()=>{
 const p={name:'店',lat:35.68,lng:139.76};let requested='';
 const fetcher=async url=>{requested=url;return {ok:true,json:async()=>({scope:'nationwide',suggestions:[p]})};};
 const result=await media.search('店 カフェ',{west:139,south:35,east:140,north:36},boundary.contains,null,fetcher);
 assert.equal(result.rows.length,0);assert.match(requested,/\/v1\/suggest\?/);
 const all=await media.search('店 カフェ',null,boundary.contains,null,fetcher);assert.equal(all.rows.length,1);
});
function runtime(){
 const pending=[],ui={paints:0,frames:0},els={qResults:{hidden:false,firstChild:{},innerHTML:''}};
 const ctx={PlaceMedia:{...media,search:(q,b,inside,signal)=>new Promise((resolve,reject)=>pending.push({q,b,signal,resolve,reject}))},JapanBoundary:boundary,PlaceUI:require('../place-ui.js'),LANG:'ja',qnorm:media.normal,qSeq:1,AbortController,setTimeout,clearTimeout,document:{},$:id=>els[id],map:{getBounds:()=>({getWest:()=>139,getSouth:()=>35,getEast:()=>140,getNorth:()=>36,contains:at=>at[0]<40})}};
 vm.createContext(ctx);const s=fs.readFileSync(require.resolve('../explore.js'),'utf8');vm.runInContext(s.slice(s.indexOf('/* Nationwide results:'),s.indexOf("$('locBtn').onclick")),ctx);
 ctx.ui=ui;vm.runInContext('paintSearchList=()=>ui.paints++;searchSummary=()=>{};paintNationalHits=()=>{};frameNationalHits=()=>ui.frames++;nationalQuery="カフェ";',ctx);
 return {ctx,pending,ui,run:s=>vm.runInContext(s,ctx)};
}
test('a later query or dismissal prevents an earlier network result from repainting the UI',async()=>{
 const {run,pending,ui}=runtime();const first=run('searchLocalFacilities("カフェ","all",qSeq)');
 run('qSeq++;nationalQuery="薬局"');const second=run('searchLocalFacilities("薬局","all",qSeq)');assert.ok(pending[0].signal.aborted);
 pending[1].resolve({rows:[{name:'薬局',lat:35.6,lon:139.7}],limited:false});await second;const paints=ui.paints;
 pending[0].resolve({rows:[{name:'古いカフェ',lat:35.6,lon:139.7}],limited:false});await first;assert.equal(ui.paints,paints);assert.equal(run('nationalHits[0].name'),'薬局');
 const third=run('searchLocalFacilities("薬局","all",qSeq)');run('qSeq++');pending[2].resolve({rows:[],limited:false});await third;assert.equal(ui.paints,paints+1);
});
test('area search fetches the new viewport and survives network failure with stored results',async()=>{
 const {run,pending}=runtime();run('storedSearchRows=[{name:"近所",lat:35.6,lon:139.7},{name:"遠く",lat:43,lon:141}];storedSearchReady=true;');
 const p=run('searchLocalFacilities("カフェ","view",qSeq)');assert.deepEqual(JSON.parse(JSON.stringify(pending[0].b)),{west:139,south:35,east:140,north:36});
 pending[0].reject(new Error('offline'));await p;assert.equal(run('localPOIStatus'),'error');assert.equal(run('nationalHits.length'),1);assert.equal(run('nationalAllHits.length'),2);
});
test('all map shells load the photo helper before explore and the build includes it',()=>{
 for(const file of ['index.html','explore.html']){const html=fs.readFileSync(file,'utf8');assert.ok(html.indexOf('place-media.js')<html.indexOf('<script src="explore.js'));assert.ok(!/place-media.js[^>]*defer/.test(html));}
 assert.match(fs.readFileSync('scripts/build.cjs','utf8'),/const files=\['place-media.js'/);
});
