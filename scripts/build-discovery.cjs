/* Reproducible static, crawlable guides. No browser translation or remote build dependency. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base='https://japantimeatlas.com';
const {langs,rows,labels,thaiNames}=require('./discovery-copy.cjs');
const markets=require('./market-copy.cjs');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),s);};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=o=>JSON.stringify(o).replace(/</g,'\\u003c');
const data=JSON.parse(read('data/places-world.json')),places=data.places;
const route=(p,l)=>'/place/'+(l==='en'?'':labels[l].route+'/')+p.id;
const pname=(p,l)=>l==='th'?thaiNames[places.indexOf(p)]:(p.names?.[l]||p.name);
const period=p=>({ort_USA10:'1945–1950',ort_old10:'1961–1969',gazo1:'1974–1978'}[p.then]||'');
const article=(p,l)=>rows[p.id][langs.indexOf(l)];
const map=(p,l)=>'/?lang='+encodeURIComponent(l==='th'?'en':l)+'#'+p.id;
function head(lang,title,description,url,alternates=[],type='article',schema){
 return '<!doctype html>\n<html lang="'+lang+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f3f1ea"><title>'+esc(title)+'</title><meta name="description" content="'+esc(description)+'"><link rel="canonical" href="'+base+url+'">'+alternates.map(([l,u])=>'<link rel="alternate" hreflang="'+l+'" href="'+base+u+'">').join('')+'<meta property="og:type" content="'+type+'"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'"><meta property="og:url" content="'+base+url+'"><meta property="og:image" content="'+base+'/og.jpg"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'+esc(title)+'"><meta name="twitter:description" content="'+esc(description)+'"><meta name="twitter:image" content="'+base+'/og.jpg"><link rel="stylesheet" href="/page.css?v=0.75">'+(schema?'<script type="application/ld+json">'+json(schema)+'</script>':'')+'</head><body>';
}
function footer(l){const t=labels[l];return '<footer><p>Japan Time Atlas · <a href="/about#'+(l==='th'?'en':l)+'">'+t.about+'</a></p><p><a href="https://maps.gsi.go.jp/development/ichiran.html">GSI Tiles</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · Wikipedia (CC BY-SA)</p></footer></body></html>';}
function nav(l){const t=labels[l];return '<nav aria-label="'+t.home+'"><a href="/">Japan Time Atlas</a><a href="'+(l==='en'?'/places':'/'+t.route)+'">'+t.home+'</a><a href="/visit">'+t.markets+'</a></nav>';}
function hav(a,b){const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r;return 6371*2*Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2));}
function tiles(p,l){
 if(!p.then)return '';
 const z=15,n=2**z,x=Math.floor((p.lon+180)/360*n),a=p.lat*Math.PI/180,y=Math.floor((1-Math.asinh(Math.tan(a))/Math.PI)/2*n),t=labels[l];
 return '<div class="comparison-preview">'+[[p.then,t.period+' '+period(p)],['seamlessphoto',t.now]].map(([layer,label])=>'<figure><img src="https://cyberjapandata.gsi.go.jp/xyz/'+layer+'/'+z+'/'+x+'/'+y+'.'+(layer.startsWith('ort_')?'png':'jpg')+'" width="256" height="256" loading="lazy" decoding="async" alt="'+esc(pname(p,l)+' · '+label)+'"><figcaption>'+esc(label)+'</figcaption></figure>').join('')+'</div><p class="srcnote">'+t.fallback+' · <a href="https://maps.gsi.go.jp/development/ichiran.html">GSI Tiles</a></p>';
}
for(const p of places){
 for(const l of langs){const t=labels[l],name=pname(p,l),url=route(p,l),description=article(p,l),title=name+' | '+t.title+' | Japan Time Atlas';
 const nearby=places.filter(q=>q!==p).map(q=>({p:q,d:hav(p,q)})).sort((a,b)=>a.d-b.d).slice(0,3);
 const alternate=langs.map(k=>[k,route(p,k)]).concat([['x-default',route(p,'en')]]);
 const schema={'@context':'https://schema.org','@graph':[{'@type':'Article',headline:title,description,inLanguage:l,url:base+url,mainEntityOfPage:base+url,publisher:{'@type':'Organization',name:'Japan Time Atlas',url:base},about:{'@type':'Place',name,alternateName:p.name_ja,geo:{'@type':'GeoCoordinates',latitude:p.lat,longitude:p.lon}}},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:t.home,item:base+(l==='en'?'/places':'/'+t.route)},{'@type':'ListItem',position:2,name,item:base+url}]}]};
 const languageNav='<nav aria-label="Language">'+langs.map(k=>'<a lang="'+k+'" href="'+route(p,k)+'"'+(k===l?' aria-current="page"':'')+'>'+labels[k].name+'</a>').join('')+'</nav>';
 const history=l==='en'?p.story:l==='ja'?p.story_ja:[];
 const wiki='https://'+(l==='ja'?'ja':'en')+'.wikipedia.org/wiki/'+encodeURIComponent(l==='ja'?p.wiki_ja:p.wiki_en||p.wiki);
 let body=head(l,title,description,url,alternate,'article',schema)+nav(l)+languageNav+'<main><h1>'+esc(name)+'</h1>'+(l!=='ja'?'<p class="where" lang="ja">'+esc(p.name_ja||p.ja)+'</p>':'')+'<p class="cta"><a href="'+map(p,l)+'">'+t.open+'</a></p>'+(l==='th'?'<p>'+t.maplang+'</p>':'')+'<section><h2>'+t.look+'</h2><p class="lead">'+esc(description)+'</p>'+((history||[]).map(s=>'<p>'+esc(s)+'</p>').join(''))+'</section>'+tiles(p,l)+'<section><h2>'+t.how+'</h2><p>'+t.help+'</p><p>'+esc(p.then?t.period+': '+period(p)+'. '+t.coverage:t.none)+'</p></section><section><h2>'+t.source+'</h2><ul><li><a href="https://maps.gsi.go.jp/development/ichiran.html">GSI · '+t.period+'</a></li><li><a href="'+wiki+'">Wikipedia · '+esc(l==='ja'?p.wiki_ja:p.wiki_en||p.wiki)+'</a></li>'+(p.id==='hiroshima'?'<li><a href="https://www.city.hiroshima.lg.jp/english/peace/1029869/1009931.html">City of Hiroshima · Atomic Bomb Dome</a></li>':'')+(p.id==='shuri'?'<li><a href="https://oki-park.jp/shurijo/">首里城公園 · Shurijo Castle Park</a></li>':'')+'</ul></section><section><h2>'+t.near+'</h2><p class="where">'+t.distance+'</p><ul class="near">'+nearby.map(q=>'<li><a href="'+route(q.p,l)+'">'+esc(pname(q.p,l))+'</a><span>'+Math.round(q.d)+' km</span></li>').join('')+'</ul></section><p class="cta"><a href="'+map(p,l)+'">'+t.open+'</a></p></main>'+footer(l);
 write(url.slice(1)+'.html',body);
 }
}
for(const m of markets){const l=m.lang,t=labels[l],url='/visit/'+m.id;
 const intro='<p class="lead">'+m.intro+'</p>',links=m.picks.map((id,i)=>{const p=places.find(p=>p.id===id);return '<article><h2><a href="'+route(p,l)+'">'+esc(pname(p,l))+'</a></h2><p>'+m.reasons[i]+'</p><a href="'+map(p,l)+'">'+t.open+'</a></article>';}).join('');
 write('visit/'+m.id+'.html',head(l,m.title+' | Japan Time Atlas',m.intro,url,[],'article')+nav(l)+'<main><h1>'+m.title+'</h1>'+intro+'<div class="discovery-grid">'+links+'</div><h2>'+t.how+'</h2><p>'+m.tip+'</p><p>'+t.help+'</p><p>'+t.maplang+'</p>'+(m.id==='sg'?'<p><a href="/zh-cn" lang="zh-Hans">简体中文</a></p>':'')+'<h2>'+t.markets+'</h2><ul class="market-links">'+markets.filter(n=>n!==m).map(n=>'<li><a href="/visit/'+n.id+'" lang="'+n.lang+'">'+n.name+'</a></li>').join('')+'</ul></main>'+footer(l));
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
 for(const p of places){html=html.replaceAll(base+map(p,l),base+route(p,l)).replaceAll(map(p,l),route(p,l));
  const card=new RegExp('(<article><h3><a href="'+route(p,l)+'"[^]*?</h3><p>)[^]*?(</p></article>)');
  html=html.replace(card,(_,a,b)=>a+esc(article(p,l))+b);
 }
 // Thai previously only had an introductory page: add all 19 place guides.
 if(l==='th'&&!html.includes('class="translated-places"'))html=html.replace('</main>','<section class="translated-places"><h2>'+t.home+'</h2><ul>'+places.map(p=>'<li><a href="'+route(p,l)+'">'+esc(pname(p,l))+'</a></li>').join('')+'</ul></section></main>');
 if(!html.includes('class="market-entry"'))html=html.replace('</header>','<p class="market-entry"><a href="/visit/'+({'ja':'','ko':'kr','zh-Hans':'cn','zh-Hant':'tw','th':'th'}[l])+'">'+t.markets+'</a>'+(l==='zh-Hant'?' · <a href="/visit/hk">香港</a>':'')+'</p></header>');
 html=html.replace('href="/visit/"','href="/visit"');write(t.route+'.html',html);
}
// Generate sitemap from the final canonical set, retaining existing articles and guides.
const canonical=new Set([...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]));
for(const p of places)for(const l of langs)canonical.add(base+route(p,l));
canonical.add(base+'/visit');for(const m of markets)canonical.add(base+'/visit/'+m.id);
write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+[...canonical].sort().map(u=>'  <url><loc>'+esc(u)+'</loc></url>').join('\n')+'\n</urlset>\n');
console.log('Generated 114 place guides, 10 market guides and their index. Sitemap: '+canonical.size+' URLs.');
