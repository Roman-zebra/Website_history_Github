/* The series pages: /3d/ (en), /3d/ja/, /3d/ko/, /3d/zh-cn/, /3d/zh-tw/.
   One page per language listing every reconstruction, generated from ITEMS below, so the next
   place is added here (and to LAB_ITEMS in explore.js) and appears on the tab and the series page. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const ASSET_V=/const ASSET_V = '([^']+)'/.exec(fs.readFileSync(path.join(root,'sw.js'),'utf8'))[1];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const ITEMS=[{
 path:'gunkanjima',img:'/3d/gunkanjima-card.jpg?v=4',years:{en:'1947 → now',ja:'1947 → 現在',ko:'1947 → 현재','zh-Hans':'1947 → 今天','zh-Hant':'1947 → 今天'},
 name:{en:'Gunkanjima (Hashima Island), 1947 to today',ja:'よみがえる軍艦島（端島）　1947年から現在まで',ko:'군함도(하시마), 1947년부터 지금까지','zh-Hans':'军舰岛（端岛），1947年至今','zh-Hant':'軍艦島（端島），1947年至今'},
 hook:{en:'The coal-mining island off Nagasaki rebuilt building by building over five aerial photographs. Every block rises in the year it was completed and falls when it collapsed; tap a building for its year, storeys, use and photographs; step inside twelve rooms and places, from a flat in Building 30 to the rooftop nursery, a classroom, the hospital and the baths; or let the audio guide move the model.',
  ja:'長崎沖の炭鉱の島を、5枚の空中写真の上に建物ごとに復元。建物は竣工年に立ち上がり、崩れた年に消えます。建物を押すと竣工年・階数・用途と写真が出て、30号棟の一室から屋上の保育園・教室・病院・共同浴場まで12か所の中に入れ、音声ガイドに合わせて模型が動きます。',
  ko:'나가사키 앞바다의 탄광 섬을 항공사진 5장 위에 건물별로 복원. 건물은 준공년에 올라가고 무너진 해에 사라집니다. 건물을 누르면 준공년·층수·용도와 사진이 나오고, 30호동의 한 세대부터 옥상 보육원·교실·병원·공동 목욕탕까지 12곳 안에 들어갈 수 있으며, 음성 가이드에 맞춰 모형이 움직입니다.',
  'zh-Hans':'把长崎外海的煤矿岛逐栋复原在5张航拍照片之上。建筑在建成那年立起、在倒塌那年消失；点按建筑可查看竣工年、层数、用途和照片；可走进从30号楼的一户到屋顶保育园、教室、医院和公共浴场的12处内部；音频导览会带动模型移动。',
  'zh-Hant':'把長崎外海的煤礦島逐棟復原在5張航空照片之上。建築在建成那年立起、在倒塌那年消失；點按建築可查看竣工年、層數、用途和照片；可走進從30號樓的一戶到屋頂保育園、教室、醫院和公共浴場的12處內部；語音導覽會帶動模型移動。'},
 map:'#l-hashima-island'
}];
const T={
 en:{title:'Japan in 3D: places rebuilt from aerial photographs and records | Japan Time Atlas',description:'A series of 3D reconstructions of places in Japan, built from aerial photographs, survey records and period photographs. No. 1: Gunkanjima (Hashima Island), 1947 to today, with building facts, interiors and an audio guide.',
  crumb:'3D reconstruction',h1:'3D reconstructions',badge:'Series',
  lead:'Places rebuilt in three dimensions from aerial photographs, survey records and period photographs. Slide the years and each building rises in the year it was completed and falls in the year it collapsed. Where the records allow, you can step inside.',
  no:'No.',open:'▶ Open the 3D model',audio:'🔊 Audio guide (sound will play)',map:'🗾 Where it is (map of Japan, tab 02)',
  next:'Next place',nextText:'The next reconstruction is in preparation. New places are added to this page and to tab 06 on the home page.',
  howH:'How the reconstructions are made',
  how:['Outlines, storey counts and completion years come from surveys, maps and published records; the aerial photographs of each year lie on the roofs and the ground.','Façades are drawn by building type, and heights can be a few metres out where no survey exists.','Interiors are built from published plans, photographs and residents’ accounts. Documented parts are drawn solid; assumptions are drawn translucent and are listed on the page.','Every page credits its photographs and sources.'],
  home:'Japan Time Atlas',back:'Back to the atlas',support:'☕ Support this site'},
 ja:{title:'3Dでよみがえる日本｜昔の航空写真と資料で当時の町並みへタイムスリップ | Japan Time Atlas',description:'昔の航空写真・実測資料・当時の写真から、日本の町並みを建物ごとに3Dで再現するシリーズ。第1回は「よみがえる軍艦島（端島）」、1947年から現在まで。建物の解説、室内の再現、音声ガイド付き。',
  crumb:'3Dでよみがえる',h1:'3Dでよみがえる日本',badge:'シリーズ',
  lead:'昔の航空写真と実測資料、当時の写真から、あの日の町並みを3Dでよみがえらせるシリーズです。年代を動かすと建物は竣工年に立ち上がり、崩れた年に消えます。資料のある建物は中にも入れます。',
  no:'第',open:'▶ 3Dモデルを開く',audio:'🔊 音声ガイド（音が出ます）',map:'🗾 場所を見る（02 日本まるごと地図）',
  next:'次の場所',nextText:'次の復元は準備中です。新しい場所はこのページとトップの06タブに追加します。',
  howH:'復元の方法',
  how:['輪郭・階数・竣工年は実測資料、地図、公刊資料から取り、各年の空中写真を屋根と地面に貼っています。','壁面は建物の種類ごとに描いた模式で、実測のない場所では高さが数メートルずれます。','内部は公開された平面図、写真、元住民の証言から組み立てています。出典のある部分は不透明、推定の部分は半透明で描き、ページに列挙します。','各ページに写真の撮影者と出典を記しています。'],
  home:'Japan Time Atlas',back:'地図にもどる',support:'☕ このサイトを支える'},
 ko:{title:'일본 3D 복원 시리즈: 항공사진과 자료로 장소를 입체로 | Japan Time Atlas',description:'항공사진·실측 자료·당시 사진으로 일본의 장소를 건물별로 3D 복원하는 시리즈. 1편은 군함도(하시마), 1947년부터 지금까지. 건물 해설, 내부 복원, 음성 가이드 포함.',
  crumb:'3D 복원',h1:'3D 복원',badge:'시리즈',
  lead:'항공사진, 실측 자료, 당시 사진으로 장소를 입체로 되살리는 시리즈입니다. 연도를 움직이면 건물은 준공년에 올라가고 무너진 해에 사라집니다. 자료가 있는 건물은 안에도 들어갈 수 있습니다.',
  no:'제',open:'▶ 3D 모델 열기',audio:'🔊 음성 가이드(소리가 납니다)',map:'🗾 위치 보기(02 일본 전체 지도)',
  next:'다음 장소',nextText:'다음 복원을 준비 중입니다. 새 장소는 이 페이지와 홈의 06 탭에 추가됩니다.',
  howH:'복원 방법',
  how:['윤곽·층수·준공년은 실측 자료, 지도, 공개 자료에서 가져오고, 각 해의 항공사진을 지붕과 지면에 입혔습니다.','벽면은 건물 종류별로 그린 모식이며, 실측이 없는 곳은 높이가 몇 미터 어긋납니다.','내부는 공개된 평면도, 사진, 옛 주민의 증언으로 조립했습니다. 출처가 있는 부분은 불투명, 추정 부분은 반투명으로 그리고 페이지에 나열합니다.','각 페이지에 사진의 촬영자와 출처를 적었습니다.'],
  home:'Japan Time Atlas',back:'지도로 돌아가기',support:'☕ 이 사이트 후원'},
 'zh-Hans':{title:'日本3D复原系列：用航拍照片和资料把地点还原成立体 | Japan Time Atlas',description:'用航拍照片、实测资料和当年照片，把日本的地点逐栋复原成3D的系列。第1期：军舰岛（端岛），从1947年到今天。附建筑解说、内部复原和音频导览。',
  crumb:'3D复原',h1:'3D复原',badge:'系列',
  lead:'用航拍照片、实测资料和当年照片把地点还原成立体的系列。拖动年代，建筑在建成那年立起、在倒塌那年消失。有资料的建筑还能走进内部。',
  no:'第',open:'▶ 打开3D模型',audio:'🔊 音频导览（会发出声音）',map:'🗾 查看位置（02 日本全图）',
  next:'下一处',nextText:'下一处复原正在准备。新地点会加到本页和首页的06标签。',
  howH:'复原方法',
  how:['轮廓、层数和竣工年来自实测资料、地图和公开出版物；各年的航拍照片贴在屋顶和地面上。','墙面按建筑类型绘制示意图，没有实测的地方高度可能相差几米。','内部依据公开的平面图、照片和原居民的证言搭建。有出处的部分为不透明，推定部分为半透明，并在页面上列出。','每页都注明照片的拍摄者和出处。'],
  home:'Japan Time Atlas',back:'返回地图',support:'☕ 支持本站'},
 'zh-Hant':{title:'日本3D復原系列：用航空照片和資料把地點還原成立體 | Japan Time Atlas',description:'用航空照片、實測資料和當年照片，把日本的地點逐棟復原成3D的系列。第1期：軍艦島（端島），從1947年到今天。附建築解說、內部復原和語音導覽。',
  crumb:'3D復原',h1:'3D復原',badge:'系列',
  lead:'用航空照片、實測資料和當年照片把地點還原成立體的系列。拖曳年代，建築在建成那年立起、在倒塌那年消失。有資料的建築還能走進內部。',
  no:'第',open:'▶ 開啟3D模型',audio:'🔊 語音導覽（會發出聲音）',map:'🗾 查看位置（02 日本全圖）',
  next:'下一處',nextText:'下一處復原正在準備。新地點會加到本頁和首頁的06標籤。',
  howH:'復原方法',
  how:['輪廓、層數和竣工年來自實測資料、地圖和公開出版物；各年的航空照片貼在屋頂和地面上。','牆面按建築類型繪製示意圖，沒有實測的地方高度可能相差幾公尺。','內部依據公開的平面圖、照片和原居民的證言搭建。有出處的部分為不透明，推定部分為半透明，並在頁面上列出。','每頁都註明照片的拍攝者和出處。'],
  home:'Japan Time Atlas',back:'返回地圖',support:'☕ 支持本站'},
};
const CSS=`.lab-badge{display:inline-block;margin:0 0 .5rem;padding:.15rem .6rem;border:1px dashed #a35945;border-radius:2px;color:#793e30;font-size:.8rem;letter-spacing:.06em}
.series{list-style:none;padding:0;margin:1.25rem 0}
.series li{display:grid;grid-template-columns:minmax(0,15rem) 1fr;gap:1rem 1.25rem;align-items:start;margin:0 0 1.5rem;padding:0 0 1.5rem;border-bottom:1px solid #e2ded3}
.series img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:6px}
.series h2{margin:0 0 .35rem;font-size:1.3rem}.series h2 a{color:#203a37;text-decoration:none}.series h2 a:hover{text-decoration:underline}
.series .no{margin:0 0 .2rem;font-size:.8rem;letter-spacing:.08em;color:#793e30;font-weight:700}
.series .acts{display:flex;flex-wrap:wrap;gap:.5rem .9rem;align-items:center;margin:.75rem 0 0;font-size:.92rem}
.btn-3d{display:inline-block;background:#d9b36e;color:#1b2624;font-weight:800;padding:.6rem 1.15rem;border-radius:99px;text-decoration:none}
.btn-3d:hover{filter:brightness(1.06)}
.series .soon{color:#5b6b69}.series .soon p{margin:.2rem 0 0}
.how{padding-left:1.2rem}.how li{margin:.3rem 0}
@media (max-width:600px){.series li{grid-template-columns:1fr}}`;
module.exports=function(LANGS,SITE){
 const hreflangs=LANGS.map(l=>`<link rel="alternate" hreflang="${l.hreflang}" href="${SITE}/3d/${l.dir}">`).join('\n')+`\n<link rel="alternate" hreflang="x-default" href="${SITE}/3d/">`;
 const langNav=LANGS.map(o=>`<a href="/3d/${o.dir}" lang="${o.html}">${({en:'English',ja:'日本語',ko:'한국어','zh-Hans':'简体中文','zh-Hant':'繁體中文'})[o.code]}</a>`).join(' · ');
 for(const l of LANGS){
  const t=T[l.code],url=SITE+'/3d/'+l.dir,home='/'+(l.code==='en'?'':'?lang='+({ja:'ja',ko:'ko','zh-Hans':'zh-CN','zh-Hant':'zh-TW'})[l.code]);
  const items=ITEMS.map((it,i)=>{
   const href='/3d/'+l.dir+it.path;
   return `<li><a href="${href}"><img src="${it.img}" alt="" loading="lazy" decoding="async"></a><div><p class="no">${esc(t.no)} ${i+1} · ${esc(it.years[l.code]||it.years.en)}</p><h2><a href="${href}">${esc(it.name[l.code]||it.name.en)}</a></h2><p>${esc(it.hook[l.code]||it.hook.en)}</p><p class="acts"><a class="btn-3d" href="${href}">${esc(t.open)}</a> <a href="${href}#play">${esc(t.audio)}</a> <a href="${home}${it.map}">${esc(t.map)}</a></p></div></li>`;
  }).join('\n')+`\n<li class="soon"><div></div><div><p class="no">${esc(t.no)} ${ITEMS.length+1}</p><h2>${esc(t.next)}</h2><p>${esc(t.nextText)}</p></div></li>`;
  const ld=JSON.stringify({'@context':'https://schema.org','@graph':[
   {'@type':'CollectionPage','name':t.title,'description':t.description,'inLanguage':l.html,'url':url,'isPartOf':{'@type':'WebSite','name':'Japan Time Atlas','url':SITE+'/'},
    'mainEntity':{'@type':'ItemList','itemListElement':ITEMS.map((it,i)=>({'@type':'ListItem','position':i+1,'name':it.name[l.code]||it.name.en,'url':SITE+'/3d/'+l.dir+it.path}))}},
   {'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':'Japan Time Atlas','item':SITE+home},{'@type':'ListItem','position':2,'name':t.crumb,'item':url}]}
  ]});
  const html=`<!doctype html>
<html lang="${l.html}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.description)}">
<link rel="canonical" href="${url}">
${hreflangs}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/3d/island-from-sea.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="max-image-preview:large">
<link rel="stylesheet" href="/page.css?v=${ASSET_V}">
<link rel="icon" href="/icons/atlas-96.png" type="image/png" sizes="96x96"><link rel="icon" href="/icons/atlas.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icons/atlas-180.png">
<style>${CSS}</style>
<script type="application/ld+json">${ld}</script>
</head>
<body>
<nav><a href="${home}">${esc(t.home)}</a> &rsaquo; <span>${esc(t.crumb)}</span> · <span class="lab-langs">${langNav}</span></nav>
<main>
<p class="lab-badge">${esc(t.badge)}</p>
<h1>${esc(t.h1)}</h1>
<p class="lead">${esc(t.lead)}</p>
<ol class="series">
${items}
</ol>
<h2>${esc(t.howH)}</h2>
<ul class="how">${t.how.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul>
</main>
<footer><p><a href="${home}">${esc(t.back)}</a> &middot; <a class="site-support-link" href="https://ko-fi.com/japantimeatlas" target="_blank" rel="noopener">${esc(t.support)}</a></p></footer>
</body>
</html>
`;
  const out=path.join(root,'3d',l.dir,'index.html');
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,html);
  console.log('wrote',path.relative(root,out),html.length);
 }
};
