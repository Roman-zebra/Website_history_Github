/* Writes the five language pages of the Gunkanjima 3D reconstruction from one template.
   scripts/lab-3d/gunkanjima.template.html -> 3d/gunkanjima.html, 3d/ja/gunkanjima.html, 3d/ko/…, 3d/zh-cn/…, 3d/zh-tw/…
   Each page keeps only its own language blocks, carries its own title, description, canonical,
   hreflang set, Open Graph tags and structured data, and sends a ?lang= visitor to the sibling page. */
const fs=require('node:fs'),path=require('node:path');
const extras=require('./build-3d-extras.cjs');
const root=path.resolve(__dirname,'..'),tpl=fs.readFileSync(path.join(__dirname,'lab-3d','gunkanjima.template.html'),'utf8').split(String.fromCharCode(13,10)).join(String.fromCharCode(10));
const SITE='https://japantimeatlas.com';
const LANGS=[
 {code:'en',dir:'',html:'en',hreflang:'en',
  title:'Gunkanjima (Hashima Island) in 3D, 1947 to Today | Japan Time Atlas',
  description:'A 3D reconstruction of Gunkanjima, the abandoned coal-mining island off Nagasaki. Slide from 1947 to today over five aerial photographs, watch each building rise and fall, tap a building for its facts, and listen to the audio guide.',
  crumb:'3D reconstruction',badge:'3D reconstruction · 1947 → today'},
 {code:'ja',dir:'ja/',html:'ja',hreflang:'ja',
  title:'軍艦島（端島）3D復元マップ｜1947年から現在まで建物ごとに見る | Japan Time Atlas',
  description:'長崎・軍艦島（端島）を3Dで復元。1947年から最新まで5枚の空中写真を年代スライダーで切り替え、30号棟・65号棟・小中学校など建物が建った年と崩れた年を確認できます。日本語と英語の音声ガイド付き。',
  crumb:'3D復元',badge:'3D復元 · 1947年 → 現在'},
 {code:'ko',dir:'ko/',html:'ko',hreflang:'ko',
  title:'군함도(하시마) 3D 복원 지도: 1947년부터 지금까지 건물별로 보기 | Japan Time Atlas',
  description:'나가사키 군함도(하시마)를 3D로 복원. 1947년부터 최신까지 항공사진 5장을 연도 슬라이더로 바꿔 보며 30호동·65호동·초중학교 등 건물이 지어진 해와 무너진 해를 확인할 수 있습니다. 음성 가이드(영어·일본어) 포함.',
  crumb:'3D 복원',badge:'3D 복원 · 1947년 → 현재'},
 {code:'zh-Hans',dir:'zh-cn/',html:'zh-Hans',hreflang:'zh-Hans',
  title:'军舰岛（端岛）3D复原地图：从1947年到今天，逐栋查看 | Japan Time Atlas',
  description:'长崎军舰岛（端岛）的3D复原。用年代滑块切换从1947年到最新的5张航拍照片，查看30号楼、65号楼、中小学校等建筑的建成年份和倒塌年份。附英语和日语音频导览。',
  crumb:'3D复原',badge:'3D复原 · 1947年 → 今天'},
 {code:'zh-Hant',dir:'zh-tw/',html:'zh-Hant',hreflang:'zh-Hant',
  title:'軍艦島（端島）3D復原地圖：從1947年到今天，逐棟檢視 | Japan Time Atlas',
  description:'長崎軍艦島（端島）的3D復原。用年代滑桿切換從1947年到最新的5張航空照片，檢視30號樓、65號樓、中小學校等建築的建成年份和倒塌年份。附英語和日語語音導覽。',
  crumb:'3D復原',badge:'3D復原 · 1947年 → 今天'},
];
const urlOf=l=>SITE+'/3d/'+l.dir+'gunkanjima';
const esc=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const hreflangs=LANGS.map(l=>`<link rel="alternate" hreflang="${l.hreflang}" href="${urlOf(l)}">`).join('\n')+`\n<link rel="alternate" hreflang="x-default" href="${urlOf(LANGS[0])}">`;
function ld(l){
 const url=urlOf(l);
 return JSON.stringify({'@context':'https://schema.org','@graph':[
  {'@type':'Article','headline':l.title,'description':l.description,'inLanguage':l.html,'url':url,'mainEntityOfPage':url,
   'image':SITE+'/3d/island-from-sea.jpg','datePublished':'2026-09-15','dateModified':'2026-09-15',
   'author':{'@type':'Organization','name':'Japan Time Atlas','url':SITE+'/'},'publisher':{'@type':'Organization','name':'Japan Time Atlas','url':SITE+'/'},
   'about':{'@type':'LandmarksOrHistoricalBuildings','name':'Hashima (Gunkanjima)','alternateName':['端島','軍艦島','Battleship Island'],
     'geo':{'@type':'GeoCoordinates','latitude':32.6278,'longitude':129.7386},'address':{'@type':'PostalAddress','addressLocality':'Nagasaki','addressCountry':'JP'}},
   'hasPart':[{'@type':'AudioObject','name':l.code==='ja'?'岩の上の5,000人　空から見る軍艦島':'Five thousand people on a rock: Gunkanjima from the air','contentUrl':SITE+'/3d/audio/gunkanjima-podcast-'+(l.code==='ja'?'ja':'en')+'.mp3','encodingFormat':'audio/mpeg','inLanguage':l.code==='ja'?'ja':'en'}],
   'keywords':['Gunkanjima','Hashima','軍艦島','端島','3D','aerial photograph','Nagasaki','UNESCO World Heritage']},
  ...extras.ld(l),
  {'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':'Japan Time Atlas','item':SITE+'/'+(l.code==='en'?'':'?lang='+({ja:'ja',ko:'ko','zh-Hans':'zh-CN','zh-Hant':'zh-TW'})[l.code])},{'@type':'ListItem','position':2,'name':l.crumb,'item':SITE+'/3d/'+l.dir},{'@type':'ListItem','position':3,'name':l.code==='ja'?'軍艦島（端島）':'Gunkanjima (Hashima)','item':url}]}
 ]});
}
for(const l of LANGS){
 let s=tpl;
 const url=urlOf(l);
 s=s.replace('<html lang="en">',`<html lang="${l.html}">`);
 s=s.replace(/<meta name="robots" content="noindex">\n?/,'');
 s=s.replace(/<title>[^<]*<\/title>/,`<title>${esc(l.title)}</title>`);
 s=s.replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${esc(l.description)}">\n<link rel="canonical" href="${url}">\n${hreflangs}\n<meta property="og:type" content="article">\n<meta property="og:title" content="${esc(l.title)}">\n<meta property="og:description" content="${esc(l.description)}">\n<meta property="og:url" content="${url}">\n<meta property="og:image" content="${SITE}/3d/island-from-sea.jpg">\n<meta property="og:locale" content="${({en:'en_US',ja:'ja_JP',ko:'ko_KR','zh-Hans':'zh_CN','zh-Hant':'zh_TW'})[l.code]}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${esc(l.title)}">\n<meta name="twitter:description" content="${esc(l.description)}">\n<meta name="twitter:image" content="${SITE}/3d/island-from-sea.jpg">\n<script type="application/ld+json">${ld(l)}</script>`);
 // keep only this language's blocks
 for(const o of LANGS){
  if(o.code===l.code){
   s=s.replace(new RegExp(`(<(?:div|section|p) data-lang="${o.code}" lang="[^"]*"[^>]*) hidden>`,'g'),'$1>');
  } else {
   s=s.replace(new RegExp(`<div data-lang="${o.code}"[^>]*>[\\s\\S]*?<\\/div>\\n?`,'g'),'');
   s=s.replace(new RegExp(`<section data-lang="${o.code}"[^>]*>[\\s\\S]*?<\\/section>\\n?`,'g'),'');
   s=s.replace(new RegExp(`<p[^>]*data-lang="${o.code}"[^>]*>[\\s\\S]*?<\\/p>\\n?`,'g'),'');
  }
 }
 // the page's language is fixed; a ?lang= for another language goes to that page
 const siblings=JSON.stringify(Object.fromEntries(LANGS.map(o=>[o.code,'/3d/'+o.dir+'gunkanjima'])));
 s=s.replace(/  var lang = MAP\[[^\n]*\n  if \(!lang\)\{ try[^\n]*\n  if \(!lang\)\{\n[^\n]*\n[^\n]*\n  \}\n/,
  `  var lang = '${l.code}';\n  var SIBLING = ${siblings};\n  var asked = MAP[(new URLSearchParams(location.search).get('lang') || '').toLowerCase()];\n  if (asked && asked !== lang){ location.replace(SIBLING[asked] + location.hash); return; }\n  try { localStorage.setItem('tn-lang', lang); } catch (e) {}\n`);
 // language links in the nav
 s=s.replace(/<a href="\?lang=en" lang="en">/,`<a href="/3d/gunkanjima" lang="en"${l.code==='en'?' aria-current="page"':''}>`)
    .replace(/<a href="\?lang=ja" lang="ja">/,`<a href="/3d/ja/gunkanjima" lang="ja"${l.code==='ja'?' aria-current="page"':''}>`)
    .replace(/<a href="\?lang=ko" lang="ko">/,`<a href="/3d/ko/gunkanjima" lang="ko"${l.code==='ko'?' aria-current="page"':''}>`)
    .replace(/<a href="\?lang=zh-CN" lang="zh-Hans">/,`<a href="/3d/zh-cn/gunkanjima" lang="zh-Hans"${l.code==='zh-Hans'?' aria-current="page"':''}>`)
    .replace(/<a href="\?lang=zh-TW" lang="zh-Hant">/,`<a href="/3d/zh-tw/gunkanjima" lang="zh-Hant"${l.code==='zh-Hant'?' aria-current="page"':''}>`);
 s=s.replace(/<p class="lab-badge">[^<]*<\/p>/,`<p class="lab-badge">${esc(l.badge)}</p>`);
 s=s.replace('<section class="podcast" id="podcast">',extras.html(l)+'<section class="podcast" id="podcast">');
 s=s.replace('</style>',' '+extras.css+' </style>');
 const out=path.join(root,'3d',l.dir,'gunkanjima.html');
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,s);
 console.log('wrote',path.relative(root,out),s.length);
}
require('./build-3d-index.cjs')(LANGS,SITE);
