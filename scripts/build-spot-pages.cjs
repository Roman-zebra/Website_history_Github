/* Crawlable pages for every spot the map shows beyond the 19 compared places.
   - food and shopping (activities-data.js): /place/a-<id> in English and the four other languages
   - liminal (data/liminal.json) and landmarks (data/landmarks.json): their English pages already exist
     (place/l-*, place/m-*); this adds Japanese, Korean and both Chinese versions and links them together.
   Thai is not generated: none of these three data sets carries Thai text, and nothing is machine-translated here.
   Every sentence on these pages comes from the data files (hooks, summaries, notes, Wikipedia extracts);
   the only text written here is the interface wording below. Runs after build-discovery.cjs. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base='https://japantimeatlas.com';
const ASSET_V=/const ASSET_V = '([^']+)'/.exec(fs.readFileSync(path.join(root,'sw.js'),'utf8'))[1];
const {labels}=require('./discovery-copy.cjs');
const {labels:guideLabels,liminalGuides}=require('./place-guides.cjs');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),s);};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=o=>JSON.stringify(o).replace(/</g,'\\u003c');
const LANGS=['en','ja','ko','zh-Hans','zh-Hant'];
const ICONS='<link rel="icon" href="/icons/atlas-96.png" type="image/png" sizes="96x96"><link rel="icon" href="/icons/atlas.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icons/atlas-180.png">';
const dir=l=>l==='en'?'':labels[l].route+'/';
const pageURL=(s,l)=>'/place/'+dir(l)+s.key;
const hubURL=l=>l==='en'?'/places':'/'+labels[l].route;
const clip=(t,n=150)=>{t=String(t||'').replace(/\s+/g,' ').trim();return t.length>n?t.slice(0,n-1).replace(/[\s、，,。.]+\S*$/,'')+'…':t;};

const UI={
 en:{kind:{food:'Markets and food streets',shopping:'Shopping streets',liminal:'Liminal places',landmark:'Famous places'},
  title:{food:'Market & food street in Japan',shopping:'Shopping street in Japan',liminal:'A liminal place in Japan, then and now',landmark:'Historic aerial photos & walking map'},
  official:'Official visitor page',notes:'Before you go',checked:'Checked against the sources below',wiki:'Wikipedia',wikiNote:'Excerpt from Wikipedia (CC BY-SA)',
  caution:'Liminal describes a feeling, not permission. Look from public roads and open visitor areas; do not enter closed buildings, ruins, fenced or private land. A pin on the map is not permission to go inside.',
  pin:'The pin marks the area, not a particular shop.',lists:'More places in this language'},
 ja:{kind:{food:'ご当地グルメ・市場',shopping:'商店街・買い物',liminal:'リミナルスペース・異世界スポット',landmark:'名所'},
  title:{food:'ご当地グルメ・市場と食の通り',shopping:'商店街・買い物スポット',liminal:'リミナルスペースの今昔',landmark:'昔の航空写真と街歩きマップ'},
  official:'公式の観光案内',notes:'出かける前に',checked:'下の出典で内容を確認しています',wiki:'ウィキペディア',wikiNote:'ウィキペディアからの抜粋（CC BY-SA）',
  caution:'リミナルは雰囲気の呼び名で、立ち入ってよいという意味ではありません。見るのは公道や公開されている場所からにしてください。閉鎖された建物・廃墟・柵の中・私有地には入らないでください。地図のピンは立ち入りの許可ではありません。',
  pin:'ピンは個別の店ではなく、エリアの目印です。',lists:'ほかの場所も日本語で見る'},
 ko:{kind:{food:'시장 · 먹거리 거리',shopping:'쇼핑 거리',liminal:'리미널 스페이스',landmark:'명소'},
  title:{food:'일본의 시장 · 먹거리 거리',shopping:'일본의 쇼핑 거리',liminal:'일본의 리미널 스페이스, 과거와 현재',landmark:'옛 항공사진과 산책 지도'},
  official:'공식 관광 안내',notes:'가기 전에',checked:'아래 출처로 내용을 확인했습니다',wiki:'위키백과',wikiNote:'위키백과 발췌(CC BY-SA)',
  caution:'리미널은 분위기를 부르는 말이지, 들어가도 된다는 뜻이 아닙니다. 공공 도로나 공개된 곳에서만 보세요. 폐쇄된 건물, 폐허, 울타리 안이나 사유지에는 들어가지 마세요. 지도의 핀은 출입 허가가 아닙니다.',
  pin:'핀은 특정 가게가 아니라 지역을 나타냅니다.',lists:'다른 장소도 한국어로 보기'},
 'zh-Hans':{kind:{food:'市场与美食街',shopping:'购物街',liminal:'阈限空间',landmark:'名胜'},
  title:{food:'日本的市场与美食街',shopping:'日本的购物街',liminal:'日本的阈限空间：过去与现在',landmark:'旧航拍照片与城市漫步地图'},
  official:'官方旅游介绍',notes:'出发之前',checked:'内容已根据下方出处核对',wiki:'维基百科',wikiNote:'摘自维基百科（CC BY-SA）',
  caution:'“阈限”指的是一种氛围，并不代表可以进入。请只在公共道路或开放区域观看；不要进入已关闭的建筑、废墟、围栏内或私人土地。地图上的标记不代表允许进入。',
  pin:'标记表示区域，而不是某一家店。',lists:'用中文查看更多地点'},
 'zh-Hant':{kind:{food:'市場與美食街',shopping:'購物街',liminal:'閾限空間',landmark:'名勝'},
  title:{food:'日本的市場與美食街',shopping:'日本的購物街',liminal:'日本的閾限空間：過去與現在',landmark:'舊航拍照片與城市散步地圖'},
  official:'官方觀光介紹',notes:'出發之前',checked:'內容已依下方出處核對',wiki:'維基百科',wikiNote:'摘自維基百科（CC BY-SA）',
  caution:'「閾限」指的是一種氛圍，並不代表可以進入。請只在公共道路或開放區域觀看；不要進入已關閉的建築、廢墟、圍欄內或私人土地。地圖上的標記不代表允許進入。',
  pin:'標記表示區域，而不是某一家店。',lists:'用中文查看更多地點'},
};

/* ---------------------------------------------------------------- data */
const src=read('activities-data.js');
const activities=JSON.parse(src.slice(src.indexOf('{'),src.lastIndexOf('}')+1)).places;
const liminal=JSON.parse(read('data/liminal.json')).places;
const landmarks=JSON.parse(read('data/landmarks.json')).landmarks;
const cities=JSON.parse(read('data/places-world.json')).places;
const slug=t=>String(t||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const mPages=new Set(fs.readdirSync(path.join(root,'place')).filter(f=>/^m-.+\.html$/.test(f)).map(f=>f.slice(2,-5)));
const landmarkId=m=>[m.name,m.wiki_en,m.wiki].map(slug).find(s=>mPages.has(s));
const wikiURL=(lang,title)=>title?'https://'+lang+'.wikipedia.org/wiki/'+encodeURIComponent(String(title).replace(/ /g,'_')):null;

const spots=[];
for(const a of activities)spots.push({key:'a-'+a.id,kind:a.category,lat:a.lat,lon:a.lon,emoji:a.emoji,names:a.names,
 lead:l=>a.hooks[l],paras:l=>[],notes:l=>a.notes?.[l],english:false,
 map:l=>'/?lang='+encodeURIComponent(l)+'&amp;place=a-'+a.id,
 sources:l=>[a.official&&{url:a.official,label:UI[l].official},...(a.noteSources||[]).map(u=>({url:u,label:new URL(u).hostname.replace(/^www\./,'')}))].filter(Boolean)});
for(const p of liminal)spots.push({key:'l-'+p.id,id:p.id,kind:'liminal',lat:p.lat,lon:p.lon,emoji:p.emoji,names:p.names,english:true,
 lead:l=>p.hooks?.[l],paras:l=>[p.summaries?.[l],l==='ja'?p.why_ja:null].filter(Boolean),wikiText:l=>l==='ja'?p.extract_ja:null,
 map:l=>'/?lang='+encodeURIComponent(l)+'&amp;place=l-'+p.id,
 sources:l=>[{url:wikiURL('ja',p.wiki_ja),label:UI[l].wiki+' (日本語)'},{url:wikiURL('en',p.wiki_en||p.wiki),label:UI[l].wiki+' (English)'}].filter(s=>s.url)});
for(const m of landmarks){const id=landmarkId(m);if(!id)throw Error('landmark without an English page: '+m.name);
 spots.push({key:'m-'+id,kind:'landmark',lat:m.lat,lon:m.lon,emoji:m.emoji,names:m.names,english:true,
  lead:l=>m.summaries?.[l],paras:l=>[],wikiText:l=>l==='ja'?m.extract_ja:null,
  map:l=>'/?lang='+encodeURIComponent(l)+'&amp;name='+encodeURIComponent(m.names?.[l]||m.name)+'&amp;spot='+m.lat.toFixed(5)+','+m.lon.toFixed(5),
  sources:l=>[{url:wikiURL('ja',m.wiki_ja),label:UI[l].wiki+' (日本語)'},{url:wikiURL('en',m.wiki_en||m.wiki),label:UI[l].wiki+' (English)'}].filter(s=>s.url)});}
for(const s of spots)for(const l of LANGS)if(!s.names?.[l]||!s.lead(l))throw Error(s.key+' has no '+l+' name or description');

/* ---------------------------------------------------------------- pages */
const hav=(a,b)=>{const r=Math.PI/180,dl=(b.lat-a.lat)*r,dn=(b.lon-a.lon)*r;return 6371*2*Math.asin(Math.sqrt(Math.sin(dl/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)**2));};
const cityURL=(c,l)=>'/place/'+dir(l)+c.id;
function nearby(s,l){
 const pool=[...spots.filter(o=>o!==s).map(o=>({lat:o.lat,lon:o.lon,name:o.names[l],url:pageURL(o,l)})),
  ...cities.map(c=>({lat:c.lat,lon:c.lon,name:c.names?.[l]||c.name,url:cityURL(c,l)}))];
 return pool.map(o=>({...o,d:hav(s,o)})).sort((a,b)=>a.d-b.d).slice(0,6);
}
function tile(s,l){
 const z=16,n=2**z,x=Math.floor((s.lon+180)/360*n),a=s.lat*Math.PI/180,y=Math.floor((1-Math.asinh(Math.tan(a))/Math.PI)/2*n),t=labels[l];
 return '<figure class="spot-aerial"><img src="https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/'+z+'/'+x+'/'+y+'.jpg" width="256" height="256" loading="lazy" decoding="async" alt="'+esc(s.names[l]+' · '+t.now)+'"><figcaption>'+esc(t.now)+' · <a href="https://maps.gsi.go.jp/development/ichiran.html">GSI Tiles</a></figcaption></figure>';
}
function guideBlock(s,l){
 const g=s.kind==='liminal'&&liminalGuides[s.id]?.[l];if(!g)return '';const t=guideLabels[l];
 const ps=a=>(a||[]).map(x=>'<p>'+esc(x)+'</p>').join(''),li=a=>a&&a.length?'<ul>'+a.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'';
 return '<section class="place-guide"><h2>'+t.why+'</h2>'+ps(g.why)+'<h2>'+t.look+'</h2>'+li(g.look)+'<h2>'+t.visit+'</h2>'+ps(g.visit)+(g.history?'<h2>'+t.history+'</h2>'+ps(g.history):'')
  +'<h2>'+t.sources+'</h2><ul>'+g.sources.map(x=>'<li><a href="'+esc(x.url)+'">'+esc(x.label)+'</a></li>').join('')+'</ul><p class="srcnote">'+t.checked+'</p></section>';
}
const alternates=s=>LANGS.map(l=>[l,pageURL(s,l)]).concat([['x-default',pageURL(s,'en')]]);
function page(s,l){
 const t=labels[l],u=UI[l],name=s.names[l],url=pageURL(s,l);
 const title=name+' | '+u.title[s.kind]+' | Japan Time Atlas';
 const description=clip(s.lead(l));
 const schema={'@context':'https://schema.org','@graph':[
  {'@type':'Article',headline:title,description,inLanguage:l,url:base+url,mainEntityOfPage:base+url,
   publisher:{'@type':'Organization',name:'Japan Time Atlas',url:base+'/'},
   about:{'@type':'TouristAttraction',name,alternateName:s.names.ja,geo:{'@type':'GeoCoordinates',latitude:s.lat,longitude:s.lon},address:{'@type':'PostalAddress',addressCountry:'JP'}}},
  {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:t.home,item:base+hubURL(l)},{'@type':'ListItem',position:2,name:u.kind[s.kind],item:base+hubURL(l)+'#'+s.kind},{'@type':'ListItem',position:3,name,item:base+url}]}]};
 const head='<!doctype html>\n<html lang="'+l+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f3f1ea"><title>'+esc(title)+'</title><meta name="description" content="'+esc(description)+'"><link rel="canonical" href="'+base+url+'">'
  +alternates(s).map(([k,v])=>'<link rel="alternate" hreflang="'+k+'" href="'+base+v+'">').join('')
  +'<meta property="og:site_name" content="Japan Time Atlas"><meta property="og:type" content="article"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'"><meta property="og:url" content="'+base+url+'"><meta property="og:image" content="'+base+'/og.jpg"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'+esc(title)+'"><meta name="twitter:description" content="'+esc(description)+'"><meta name="twitter:image" content="'+base+'/og.jpg"><link rel="stylesheet" href="/page.css?v='+ASSET_V+'"><script type="application/ld+json">'+json(schema)+'</script>'+ICONS+'</head><body>';
 const nav='<nav aria-label="'+esc(t.home)+'"><a href="/">Japan Time Atlas</a><a href="'+hubURL(l)+'">'+esc(t.home)+'</a><a href="/visit">'+esc(t.markets)+'</a></nav>';
 const langNav='<nav aria-label="Language">'+LANGS.map(k=>'<a lang="'+k+'" href="'+pageURL(s,k)+'"'+(k===l?' aria-current="page"':'')+'>'+labels[k].name+'</a>').join('')+'</nav>';
 const notes=s.notes&&s.notes(l)?'<section><h2>'+esc(u.notes)+'</h2><p>'+esc(s.notes(l))+'</p><p class="srcnote">'+esc(u.checked)+'</p></section>':'';
 const wiki=s.wikiText&&s.wikiText(l)?'<section lang="ja"><h2>'+esc(u.wiki)+'</h2><p>'+esc(clip(s.wikiText(l),600))+'</p><p class="srcnote">'+esc(u.wikiNote)+'</p></section>':'';
 const near=nearby(s,l);
 const body='<main><p class="where">'+esc((s.emoji?s.emoji+' ':'')+u.kind[s.kind])+'</p><h1>'+esc(name)+'</h1>'
  +(l!=='ja'?'<p class="where" lang="ja">'+esc(s.names.ja)+'</p>':'')
  +'<p class="cta"><a href="'+s.map(l)+'">'+esc(t.open)+'</a></p>'
  +'<p class="lead">'+esc(s.lead(l))+'</p>'+s.paras(l).map(p=>'<p>'+esc(p)+'</p>').join('')
  +(s.kind==='liminal'?'<p class="caution"><b>⚠</b> '+esc(u.caution)+'</p>':'')
  +((s.kind==='food'||s.kind==='shopping')?'<p class="srcnote">'+esc(u.pin)+'</p>':'')
  +notes+guideBlock(s,l)+tile(s,l)+wiki
  +'<section><h2>'+esc(t.source)+'</h2><ul>'+s.sources(l).map(x=>'<li><a href="'+esc(x.url)+'" rel="noopener">'+esc(x.label)+'</a></li>').join('')+'<li><a href="https://maps.gsi.go.jp/development/ichiran.html">GSI Tiles</a></li></ul></section>'
  +'<section><h2>'+esc(t.near)+'</h2><p class="where">'+esc(t.distance)+'</p><ul class="near">'+near.map(o=>'<li><a href="'+o.url+'">'+esc(o.name)+'</a><span>'+(o.d<1?o.d.toFixed(1):Math.round(o.d))+' km</span></li>').join('')+'</ul></section>'
  +'<p class="cta"><a href="'+s.map(l)+'">'+esc(t.open)+'</a></p></main>';
 const footer='<footer><p>Japan Time Atlas · <a href="/about#'+l+'">'+t.about+'</a> · <a class="site-support-link" href="/support">'+t.support+'</a></p><p><a href="https://maps.gsi.go.jp/development/ichiran.html">GSI Tiles</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · Wikipedia (CC BY-SA)</p></footer></body></html>';
 return head+nav+langNav+body+footer;
}

const written=[];
for(const s of spots)for(const l of LANGS){
 if(l==='en'&&s.english)continue;             // hand-written English page stays
 const url=pageURL(s,l);write(url.slice(1)+'.html',page(s,l));written.push(url);
}

/* ------------------------------------- the existing English l- / m- pages join their translations */
for(const s of spots.filter(s=>s.english)){
 const file='place/'+s.key+'.html';let html=read(file);
 html=html.replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*">/g,'')
  .replace('</head>',()=>alternates(s).map(([k,v])=>'<link rel="alternate" hreflang="'+k+'" href="'+base+v+'">').join('')+'</head>');
 if(!html.includes('og:site_name'))html=html.replace('<meta property="og:type"','<meta property="og:site_name" content="Japan Time Atlas"><meta property="og:type"');
 // 24 of the older liminal titles never named the site; searches for the site name should find them too
 const brand=t=>/\| Japan Time Atlas\s*$/.test(t)?t:t.replace(/\s+$/,'')+' | Japan Time Atlas';
 html=html.replace(/<title>([^<]*)<\/title>/,(m,t)=>'<title>'+brand(t)+'</title>')
  .replace(/(<meta property="og:title" content=")([^"]*)"/,(m,a,t)=>a+brand(t)+'"');
 // the language links in the nav pointed at the language home pages; point them at this place
 for(const l of LANGS.slice(1))html=html.replace(new RegExp('href="/'+labels[l].route+'" lang="'+l+'"','g'),'href="'+pageURL(s,l)+'" lang="'+l+'"');
 write(file,html);
}

/* ------------------------------------------------ lists that link to every page, per language */
const listHTML=(l,kind,hTag)=>{const u=UI[l],items=spots.filter(s=>s.kind===kind);
 return '<section class="spot-list" id="'+kind+'"><'+hTag+'>'+esc(u.kind[kind])+'</'+hTag+'><ul class="list">'+items.map(s=>'<li><a href="'+pageURL(s,l)+'">'+esc((s.emoji?s.emoji+' ':'')+s.names[l])+'</a>'+(l==='en'?' <span lang="ja">'+esc(s.names.ja)+'</span>':'')+'</li>').join('')+'</ul></section>';};
const swap=(html,block)=>{const b='<!--SPOT-LISTS-->'+block+'<!--/SPOT-LISTS-->';
 return html.includes('<!--SPOT-LISTS-->')?html.replace(/<!--SPOT-LISTS-->[\s\S]*?<!--\/SPOT-LISTS-->/,()=>b):null;};
for(const l of LANGS.slice(1)){
 const file=labels[l].route+'.html';let html=read(file);
 // the liminal cards pointed at the English articles
 for(const s of spots.filter(s=>s.kind==='liminal'))html=html.split('href="/place/'+s.key+'"').join('href="'+pageURL(s,l)+'"').split(base+'/place/'+s.key+'"').join(base+pageURL(s,l)+'"');
 const block=['landmark','liminal','food','shopping'].map(k=>listHTML(l,k,'h2')).join('');
 html=swap(html,block)??html.replace('<footer class="locale-foot">',()=>'<!--SPOT-LISTS-->'+block+'<!--/SPOT-LISTS--><footer class="locale-foot">');
 if(!html.includes('<!--SPOT-LISTS-->'))throw Error(file+': no place for the spot lists');
 const hubItems=[
  ...cities.map(c=>({name:c.names?.[l]||c.name,url:base+cityURL(c,l)})),
  ...spots.map(s=>({name:s.names[l],url:base+pageURL(s,l)}))
 ];
 html=html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/,(m,j)=>{let o;try{o=JSON.parse(j);}catch(e){return m;}if(o['@type']!=='CollectionPage')return m;
  o.mainEntity={'@type':'ItemList',numberOfItems:hubItems.length,itemListElement:hubItems.map((x,i)=>({'@type':'ListItem',position:i+1,...x}))};
  return '<script type="application/ld+json">'+json(o)+'</script>';
 });
 write(file,html);
}
{ // English hub: the liminal and famous lists already exist; add the two new ones
 let html=read('places.html');const block=['food','shopping'].map(k=>listHTML('en',k,'h2')).join('');
 html=swap(html,block)??html.replace('</main>',()=>'<!--SPOT-LISTS-->'+block+'<!--/SPOT-LISTS--></main>');
 if(!html.includes('<!--SPOT-LISTS-->'))throw Error('places.html: no place for the spot lists');
 write('places.html',html);
}

/* ---------------------------------------------------------------- sitemap */
const canonical=new Set([...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]));
for(const u of written)canonical.add(base+u);
write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+[...canonical].sort().map(u=>'  <url><loc>'+esc(u)+'</loc></url>').join('\n')+'\n</urlset>\n');
console.log('Spot pages: '+written.length+' written ('+spots.length+' spots). Sitemap: '+canonical.size+' URLs.');
