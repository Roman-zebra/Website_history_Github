/* Reproducible static, crawlable guides. No browser translation or remote build dependency. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base='https://japantimeatlas.com';
/* Root stylesheets carry the release's ?v= from sw.js; build.cjs checks every page for it. */
const ASSET_V=/const ASSET_V = '([^']+)'/.exec(fs.readFileSync(path.join(root,'sw.js'),'utf8'))[1];
const {langs,rows,labels,thaiNames}=require('./discovery-copy.cjs');
const markets=require('./market-copy.cjs');
const {labels:guideLabels,guides,liminalGuides}=require('./place-guides.cjs');
const share=require('./share.cjs');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),s);};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=o=>JSON.stringify(o).replace(/</g,'\\u003c');
const data=JSON.parse(read('data/places-world.json')),places=data.places;
const OG_LOCALE={en:'en_US',ja:'ja_JP',ko:'ko_KR','zh-Hans':'zh_CN','zh-Hant':'zh_TW',th:'th_TH'};
/* Nagasaki pages point at the Gunkanjima 3D reconstruction (its own page, five languages). */
const CTA3D={en:['/3d/gunkanjima','See Gunkanjima (Hashima Island) in 3D, 1947 to today',' — every building drawn from its outline, storey count and completion year, with an audio guide.'],
 ja:['/3d/ja/gunkanjima','軍艦島（端島）を3Dで見る（1947年から現在まで）','。建物ごとに竣工年・階数・用途をたどれる復元模型と音声ガイド。'],
 ko:['/3d/ko/gunkanjima','군함도(하시마)를 3D로 보기, 1947년부터 지금까지','. 건물별 준공년·층수·용도를 담은 복원 모형과 음성 가이드.'],
 'zh-Hans':['/3d/zh-cn/gunkanjima','3D查看军舰岛（端岛）：从1947年到今天','。逐栋标注竣工年、层数和用途的复原模型，附音频导览。'],
 'zh-Hant':['/3d/zh-tw/gunkanjima','3D檢視軍艦島（端島）：從1947年到今天','。逐棟標註竣工年、層數和用途的復原模型，附語音導覽。'],
 th:['/3d/gunkanjima','See Gunkanjima (Hashima Island) in 3D, 1947 to today',' — every building drawn from its outline, storey count and completion year, with an audio guide.']};
const cta3d=(p,l)=>{if(p.id!=='nagasaki')return '';const c=CTA3D[l]||CTA3D.en;return '<p class="cta-3d" style="margin:.75rem 0 1rem;padding:.6rem .9rem;border-left:3px solid #a35945;background:#f6f3ec"><a href="'+c[0]+'"><b>'+c[1]+'</b></a>'+c[2]+'</p>';};
const route=(p,l)=>'/place/'+(l==='en'?'':labels[l].route+'/')+p.id;
const pname=(p,l)=>l==='th'?thaiNames[places.indexOf(p)]:(p.names?.[l]||p.name);
const period=p=>({ort_USA10:'1945–1950',ort_old10:'1961–1969',gazo1:'1974–1978'}[p.then]||'');
const article=(p,l)=>rows[p.id][langs.indexOf(l)];
// Map links carry the place as a query, never a #hash: Google folds "/?lang=en#hiroshima" into
// the home page. explore.js turns ?place= back into the hash its router uses.
const mapLang=l=>encodeURIComponent(l==='th'?'en':l);
const map=(p,l)=>'/?lang='+mapLang(l)+'&amp;place='+p.id;
const legacyMap=(p,l)=>'/?lang='+mapLang(l)+'#'+p.id;
// place: {key, name} for a place page (its own share image and the share script), omitted elsewhere.
function head(lang,title,description,url,alternates=[],type='article',schema,place){
 return '<!doctype html>\n<html lang="'+lang+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f3f1ea"><title>'+esc(title)+'</title><meta name="description" content="'+esc(description)+'"><link rel="canonical" href="'+base+url+'">'+alternates.map(([l,u])=>'<link rel="alternate" hreflang="'+l+'" href="'+base+u+'">').join('')+'<meta property="og:site_name" content="Japan Time Atlas"><meta property="og:type" content="'+type+'"><meta property="og:locale" content="'+OG_LOCALE[lang]+'"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'"><meta property="og:url" content="'+base+url+'">'+share.meta(place?.key,lang,place?.name)+'<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'+esc(title)+'"><meta name="twitter:description" content="'+esc(description)+'">'+share.robots+'<link rel="stylesheet" href="/page.css?v='+ASSET_V+'">'+(place?share.script(ASSET_V):'')+(schema?'<script type="application/ld+json">'+json(schema)+'</script>':'')+'</head><body>';
}
function footer(l){const t=labels[l];return '<footer><p>Japan Time Atlas · <a href="/about#'+(l==='th'?'en':l)+'">'+t.about+'</a> · <a class="site-support-link" href="https://ko-fi.com/japantimeatlas" target="_blank" rel="noopener">'+t.support+'</a></p><p><a href="https://maps.gsi.go.jp/development/ichiran.html">GSI Tiles</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · Wikipedia (CC BY-SA)</p></footer></body></html>';}
function nav(l){const t=labels[l];return '<nav aria-label="'+t.home+'"><a href="/">Japan Time Atlas</a><a href="'+(l==='en'?'/places':'/'+t.route)+'">'+t.home+'</a><a href="/visit">'+t.markets+'</a></nav>';}
function hav(a,b){const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r;return 6371*2*Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2));}
function tiles(p,l){
 if(!p.then)return '';
 const z=15,n=2**z,x=Math.floor((p.lon+180)/360*n),a=p.lat*Math.PI/180,y=Math.floor((1-Math.asinh(Math.tan(a))/Math.PI)/2*n),t=labels[l];
 return '<div class="comparison-preview">'+[[p.then,t.period+' '+period(p)],['seamlessphoto',t.now]].map(([layer,label])=>'<figure><img src="https://cyberjapandata.gsi.go.jp/xyz/'+layer+'/'+z+'/'+x+'/'+y+'.'+(layer.startsWith('ort_')?'png':'jpg')+'" width="256" height="256" loading="lazy" decoding="async" alt="'+esc(pname(p,l)+' · '+label)+'"><figcaption>'+esc(label)+'</figcaption></figure>').join('')+'</div><p class="srcnote">'+t.fallback+' · <a href="https://maps.gsi.go.jp/development/ichiran.html">GSI Tiles</a></p>';
}
// Long-form guides (scripts/place-guides.cjs) for the few places written up in depth.
const paras=a=>(a||[]).map(s=>'<p>'+esc(s)+'</p>').join('');
const items=a=>a&&a.length?'<ul>'+a.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>':'';
function guideSections(p,l){const g=guides[p.id]?.[l],t=guideLabels[l];if(!g)return '';
 return '<section><h2>'+t.why+'</h2>'+paras(g.why)+'</section><section><h2>'+t.look+'</h2>'+items(g.look)+'</section><section><h2>'+t.dates+'</h2>'+paras(g.dates)+'</section><section><h2>'+t.visit+'</h2>'+paras(g.visit)+'</section>'+(g.fieldNotes&&g.fieldNotes.length?'<section><h2>'+t.field+'</h2>'+paras(g.fieldNotes)+'</section>':'');}
function guideSources(p,l){const g=guides[p.id]?.[l];if(!g)return '';
 const seen=new Set(['https://maps.gsi.go.jp/development/ichiran.html','https://www.city.hiroshima.lg.jp/english/peace/1029869/1009931.html','https://oki-park.jp/shurijo/']);
 return g.sources.filter(s=>!seen.has(s.url)&&seen.add(s.url)).map(s=>'<li><a href="'+esc(s.url)+'">'+esc(s.label)+'</a></li>').join('');}
function guideTheme(p,l){const g=guides[p.id],t=guideLabels[l];if(!g?.[l]||!g.theme)return '';
 return '<section><h2>'+t.theme+'</h2><p class="where">'+esc(g.theme[l])+'</p><ul class="near">'+g.theme.ids.map(id=>places.find(q=>q.id===id)).filter(Boolean).map(q=>'<li><a href="'+route(q,l)+'">'+esc(pname(q,l))+'</a>'+(g.theme.notes?.[q.id]?.[l]?'<span>'+esc(g.theme.notes[q.id][l])+'</span>':'')+'</li>').join('')+'</ul></section>';}
for(const p of places){
 for(const l of langs){const t=labels[l],name=pname(p,l),url=route(p,l),description=article(p,l),title=name+' | '+t.title+' | Japan Time Atlas';
 const nearby=places.filter(q=>q!==p).map(q=>({p:q,d:hav(p,q)})).sort((a,b)=>a.d-b.d).slice(0,3);
 const alternate=langs.map(k=>[k,route(p,k)]).concat([['x-default',route(p,'en')]]);
 const schema={'@context':'https://schema.org','@graph':[{'@type':'Article',headline:title,description,inLanguage:l,url:base+url,mainEntityOfPage:base+url,image:share.schemaImage(p.id),author:share.author,publisher:{'@type':'Organization',name:'Japan Time Atlas',url:base},about:{'@type':guides[p.id]?.schemaType||'Place',name,alternateName:p.name_ja,geo:{'@type':'GeoCoordinates',latitude:p.lat,longitude:p.lon}}},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:t.home,item:base+(l==='en'?'/places':'/'+t.route)},{'@type':'ListItem',position:2,name,item:base+url}]}]};
 const languageNav='<nav aria-label="Language">'+langs.map(k=>'<a lang="'+k+'" href="'+route(p,k)+'"'+(k===l?' aria-current="page"':'')+'>'+labels[k].name+'</a>').join('')+'</nav>';
 const history=l==='en'?p.story:l==='ja'?p.story_ja:[];
 const wiki='https://'+(l==='ja'?'ja':'en')+'.wikipedia.org/wiki/'+encodeURIComponent(l==='ja'?p.wiki_ja:p.wiki_en||p.wiki);
 let body=head(l,title,description,url,alternate,'article',schema,{key:p.id,name})+nav(l)+languageNav+'<main><h1>'+esc(name)+'</h1>'+(l!=='ja'?'<p class="where" lang="ja">'+esc(p.name_ja||p.ja)+'</p>':'')+'<p class="cta"><a href="'+map(p,l)+'">'+t.open+'</a></p>'+(l==='th'?'<p>'+t.maplang+'</p>':'')+'<section><h2>'+t.look+'</h2><p class="lead">'+esc(description)+'</p>'+((history||[]).map(s=>'<p>'+esc(s)+'</p>').join(''))+cta3d(p,l)+'</section>'+tiles(p,l)+share.section(p.id,l,url,name)+guideSections(p,l)+'<section><h2>'+t.how+'</h2><p>'+t.help+'</p><p>'+esc(p.then?t.period+': '+period(p)+'. '+t.coverage:t.none)+'</p></section><section><h2>'+t.source+'</h2><ul><li><a href="https://maps.gsi.go.jp/development/ichiran.html">GSI · '+t.period+'</a></li><li><a href="'+wiki+'">Wikipedia · '+esc(l==='ja'?p.wiki_ja:p.wiki_en||p.wiki)+'</a></li>'+(p.id==='hiroshima'?'<li><a href="https://www.city.hiroshima.lg.jp/english/peace/1029869/1009931.html">City of Hiroshima · Atomic Bomb Dome</a></li>':'')+(p.id==='shuri'?'<li><a href="https://oki-park.jp/shurijo/">首里城公園 · Shurijo Castle Park</a></li>':'')+guideSources(p,l)+'</ul>'+(guides[p.id]?.[l]?'<p class="srcnote">'+guideLabels[l].checked+'</p>':'')+'</section>'+guideTheme(p,l)+'<section><h2>'+t.near+'</h2><p class="where">'+t.distance+'</p><ul class="near">'+nearby.map(q=>'<li><a href="'+route(q.p,l)+'">'+esc(pname(q.p,l))+'</a><span>'+Math.round(q.d)+' km</span></li>').join('')+'</ul></section><p class="cta"><a href="'+map(p,l)+'">'+t.open+'</a></p></main>'+footer(l);
 write(url.slice(1)+'.html',body);
 }
}
for(const m of markets){const l=m.lang,t=labels[l],url='/visit/'+m.id;
 const intro='<p class="lead">'+m.intro+'</p>',links=m.picks.map((id,i)=>{const p=places.find(p=>p.id===id);return '<article><h2><a href="'+route(p,l)+'">'+esc(pname(p,l))+'</a></h2><p>'+m.reasons[i]+'</p><a href="'+map(p,l)+'">'+t.open+'</a></article>';}).join('');
 const picked=m.picks.map(id=>places.find(p=>p.id===id));
 const schema={'@context':'https://schema.org','@graph':[
  {'@type':'CollectionPage',name:m.title,description:m.intro,inLanguage:l,url:base+url,mainEntity:{'@type':'ItemList',numberOfItems:picked.length,itemListElement:picked.map((p,i)=>({'@type':'ListItem',position:i+1,name:pname(p,l),url:base+route(p,l)}))}},
  {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:t.markets,item:base+'/visit'},{'@type':'ListItem',position:2,name:m.title,item:base+url}]}
 ]};
 write('visit/'+m.id+'.html',head(l,m.title+' | Japan Time Atlas',m.intro,url,[],'article',schema)+nav(l)+'<main><h1>'+m.title+'</h1>'+intro+'<div class="discovery-grid">'+links+'</div><h2>'+t.how+'</h2><p>'+m.tip+'</p><p>'+t.help+'</p><p>'+t.maplang+'</p>'+(m.id==='sg'?'<p><a href="/zh-cn" lang="zh-Hans">简体中文</a></p>':'')+'<h2>'+t.markets+'</h2><ul class="market-links">'+markets.filter(n=>n!==m).map(n=>'<li><a href="/visit/'+n.id+'" lang="'+n.lang+'">'+n.name+'</a></li>').join('')+'</ul></main>'+footer(l));
}
write('visit.html',head('en','Japan travel guides by country and region | Japan Time Atlas','Choose a language and a starting point for exploring Japan with old aerial photographs and city walks.','/visit',[],'website')+nav('en')+'<main><h1>Plan your Japan exploration</h1><p>Choose your country or region for practical planning notes and a few places to start. You can use any guide and switch languages at any time.</p><ul class="market-links">'+markets.map(m=>'<li><a href="/visit/'+m.id+'" lang="'+m.lang+'">'+m.name+'</a></li>').join('')+'</ul><p><a href="/ja" lang="ja">日本語で探す</a></p></main>'+footer('en'));
// Keep the static homepage fallback in sync with corrected map content.
for(const file of ['index.html','explore.html']){
 let html=read(file);
 for(const p of places){html=html.replaceAll('href="place/'+p.id+'.html"','href="'+route(p,'en')+'"');
  const card=new RegExp('(<article><h3><a href="'+route(p,'en')+'"[^]*?</h3><p>)[^]*?(</p></article>)');
  html=html.replace(card,(_,a,b)=>a+esc(article(p,'en'))+b);
 }
 write(file,html);
}
// Locale entry cards become actual article links. Their separate map CTA remains.
for(const l of langs.filter(l=>l!=='en')){
 const t=labels[l];let html=read(t.route+'.html');
 for(const p of places){html=html.replaceAll(base+legacyMap(p,l),base+route(p,l)).replaceAll(legacyMap(p,l),route(p,l));
  const card=new RegExp('(<article><h3><a href="'+route(p,l)+'"[^]*?</h3><p>)[^]*?(</p></article>)');
  html=html.replace(card,(_,a,b)=>a+esc(article(p,l))+b);
 }
 // Thai previously only had an introductory page: add all 19 place guides.
 if(l==='th'&&!html.includes('class="translated-places"'))html=html.replace('</main>','<section class="translated-places"><h2>'+t.home+'</h2><ul>'+places.map(p=>'<li><a href="'+route(p,l)+'">'+esc(pname(p,l))+'</a></li>').join('')+'</ul></section></main>');
 if(!html.includes('class="market-entry"'))html=html.replace('</header>','<p class="market-entry"><a href="/visit/'+({'ja':'jp','ko':'kr','zh-Hans':'cn','zh-Hant':'tw','th':'th'}[l])+'">'+t.markets+'</a>'+(l==='zh-Hant'?' · <a href="/visit/hk">香港</a>':'')+'</p></header>');
 if(l==='ja')html=html.replace('<p class="market-entry"><a href="/visit">','<p class="market-entry"><a href="/visit/jp">');
 // The liminal list and its ItemList opened the map (/?lang=ja#l-doai-station). Point both at the article.
 html=html.replace(/(https:\/\/japantimeatlas\.com)?\/\?lang=[A-Za-z-]+#l-([a-z0-9-]+)/g,(m,host,id)=>fs.existsSync(path.join(root,'place','l-'+id+'.html'))?(host||'')+'/place/l-'+id:m);
 html=html.replace('href="/visit/"','href="/visit"');write(t.route+'.html',html);
}
// The older liminal (l-) and landmark (m-) pages predate the language routes. Keep their text,
// point every link at a canonical URL and open the map with a query instead of a #hash.
for(const entry of fs.readdirSync(path.join(root,'place'))){
 if(!/^[lm]-[a-z0-9-]+\.html$/.test(entry))continue;
 const file='place/'+entry,before=read(file);
 const html=before
  .replace(/href="\.\.\/(ja|ko|zh-cn|zh-tw)\.html"/g,'href="/$1"')
  .replace(/href="\.\.\/(places)?"/g,(m,p)=>'href="/'+(p||'')+'"')
  .replace(/href="\.\.\/page\.css/g,'href="/page.css')
  .replace(/href="\.\.\/#(l-[a-z0-9-]+)"/g,'href="/?lang=en&amp;place=$1"')
  .replace(/href="\.\.\/\?lang=en&amp;name=([^"#]*)#spot=(-?[\d.]+,-?[\d.]+)"/g,'href="/?lang=en&amp;name=$1&amp;spot=$2"')
  .replace(/href='([a-z0-9-]+)'/g,(m,slug)=>fs.existsSync(path.join(root,'place',slug+'.html'))?"href='/place/"+slug+"'":m);
 // Structured data: add the breadcrumb that the newer place pages already carry.
 const out=html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/,(m,j)=>{let o;try{o=JSON.parse(j);}catch(e){return m;}if(o['@graph'])return m;
  const {['@context']:context,...node}=o;
  return '<script type="application/ld+json">'+json({'@context':context||'https://schema.org','@graph':[node,{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'All places',item:base+'/places'},{'@type':'ListItem',position:2,name:node.name,item:node.url}]}]})+'</script>';});
 if(out!==before)write(file,out);
}
// Liminal places written up in depth: refresh title, description and structured data, and swap
// the guide block between its markers so a rebuild never duplicates it.
const liminalRows=JSON.parse(read('data/liminal.json')).places;
for(const [id,g] of Object.entries(liminalGuides)){
 const file='place/l-'+id+'.html',row=liminalRows.find(r=>r.id===id),url=base+'/place/l-'+id;
 if(!row)throw Error('guide for an unknown liminal place: '+id);
 const title=g.en.title+' | Japan Time Atlas',desc=g.en.description;
 let html=read(file).replace(/<!--GUIDE-->[\s\S]*?<!--\/GUIDE-->/,'')
  .replace(/<title>[\s\S]*?<\/title>/,()=>'<title>'+esc(title)+'</title>')
  .replace(/(<meta name="description" content=")[^"]*"/,(m,a)=>a+esc(desc)+'"')
  .replace(/(<meta property="og:title" content=")[^"]*"/,(m,a)=>a+esc(title)+'"')
  .replace(/(<meta property="og:description" content=")[^"]*"/,(m,a)=>a+esc(desc)+'"');
 const schema={'@context':'https://schema.org','@graph':[{'@type':g.schemaType,name:row.name,alternateName:row.ja,description:desc,url,geo:{'@type':'GeoCoordinates',latitude:row.lat,longitude:row.lon},address:{'@type':'PostalAddress',addressCountry:'JP'}},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'All places',item:base+'/places'},{'@type':'ListItem',position:2,name:row.name,item:url}]}]};
 html=html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/,()=>'<script type="application/ld+json">'+json(schema)+'</script>');
 const block='<!--GUIDE-->'+['en','ja'].map(l=>{const x=g[l],t=guideLabels[l];
  const theme=g.theme?'<h2>'+t.theme+'</h2><p class="where">'+esc(g.theme[l])+'</p><ul class="near">'+g.theme.ids.filter(s=>fs.existsSync(path.join(root,'place',s+'.html'))).map(s=>{const r=liminalRows.find(q=>'l-'+q.id===s);return '<li><a href="/place/'+s+'">'+esc(r?(l==='ja'?r.ja:r.name):s)+'</a></li>';}).join('')+'</ul>':'';
  return '<section class="place-guide"'+(l==='ja'?' lang="ja"><h2>'+esc(x.heading)+'</h2>':'>')+'<h2>'+t.why+'</h2>'+paras(x.why)+'<h2>'+t.look+'</h2>'+items(x.look)+'<h2>'+t.visit+'</h2>'+paras(x.visit)+(x.history?'<h2>'+t.history+'</h2>'+paras(x.history):'')+(x.fieldNotes&&x.fieldNotes.length?'<h2>'+t.field+'</h2>'+paras(x.fieldNotes):'')+'<h2>'+t.sources+'</h2><ul>'+x.sources.map(s=>'<li><a href="'+esc(s.url)+'">'+esc(s.label)+'</a></li>').join('')+'</ul><p class="srcnote">'+t.checked+'</p>'+theme+'</section>';
 }).join('')+'<!--/GUIDE-->';
 const anchor='<h2>Explore other places</h2>';if(!html.includes(anchor))throw Error(file+': cannot place the guide');
 write(file,html.replace(anchor,()=>block+anchor));
}
// Refresh shared brand metadata for authored and generated HTML alike.
const iconLinks='<link rel="icon" href="/icons/atlas-96.png" type="image/png" sizes="96x96"><link rel="icon" href="/icons/atlas.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icons/atlas-180.png">';
for(const dir of ['', 'place','guides','visit']){
 const scan=d=>{for(const entry of fs.readdirSync(path.join(root,d),{withFileTypes:true})){
  const file=path.join(d,entry.name);if(entry.isDirectory()){if(d)scan(file);continue;}
  if(!file.endsWith('.html'))continue;
  let html=read(file).replace(/<link\b[^>]*rel="(?:icon|apple-touch-icon)"[^>]*>/g,'').replace(/<meta name="robots" content="max-image-preview:large">/g,'');
  html=html.replace('</head>',share.robots+iconLinks+'</head>');write(file,html);
 }};scan(dir);
}
// Generate sitemap from the final canonical set, retaining existing articles and guides.
const canonical=new Set([...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]));
for(const p of places)for(const l of langs)canonical.add(base+route(p,l));
canonical.add(base+'/visit');for(const m of markets)canonical.add(base+'/visit/'+m.id);
write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+[...canonical].sort().map(u=>'  <url><loc>'+esc(u)+'</loc></url>').join('\n')+'\n</urlset>\n');
console.log('Generated 114 place guides, 11 market guides and their index. Sitemap: '+canonical.size+' URLs.');
