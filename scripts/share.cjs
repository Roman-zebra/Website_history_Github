/* Share images and share links for the place pages, used by build-discovery.cjs and build-spot-pages.cjs.
   The images come from scripts/build-og-images.py (og/<key>.jpg, listed in og/manifest.json). One image serves
   every language version of a place; a page whose place has none keeps /og.jpg.
   The links work without a script and carry no tracking parameters. share.js adds the browser's own share
   sheet, which reaches the apps a reader actually uses (KakaoTalk, WhatsApp, WeChat, Messenger...), and a
   copy button. Each language lists the services most used where it is read; any reader can copy the link. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base='https://japantimeatlas.com';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const manifestFile=path.join(root,'og','manifest.json');
const manifest=fs.existsSync(manifestFile)?JSON.parse(fs.readFileSync(manifestFile,'utf8')):{};
const W=1200,H=630;

/* The image of a place page, or the site image. period is the old photograph's series, null when the
   image shows the latest photograph alone. */
function image(key){
 if(key&&manifest[key]&&fs.existsSync(path.join(root,'og',key+'.jpg')))
  return {url:base+'/og/'+key+'.jpg',path:'/og/'+key+'.jpg',width:W,height:H,period:manifest[key].period||null};
 return {url:base+'/og.jpg',path:null,width:W,height:H,period:null};
}

const BRAND={ja:'日本の今昔マップ'};
const COPY={
 en:{heading:'Share this place',native:'Share…',copy:'Copy link',copied:'Link copied',
  alt:(n,p)=>p?n+' from the air: '+p+' on the left, the latest photograph on the right':n+' from the air, in the latest photograph',
  text:(n,p)=>p?n+' from the air, '+p+' and today':n+' from the air',
  nets:['x','facebook','reddit','whatsapp']},
 ja:{heading:'この場所を共有',native:'共有…',copy:'リンクをコピー',copied:'リンクをコピーしました',
  alt:(n,p)=>p?n+'の航空写真。左が'+p+'年、右が最新の写真':n+'の最新の航空写真',
  text:(n,p)=>p?n+'の航空写真、'+p+'年と今':n+'の航空写真',
  nets:['x','line','facebook']},
 ko:{heading:'이 장소 공유하기',native:'공유…',copy:'링크 복사',copied:'링크를 복사했습니다',
  alt:(n,p)=>p?n+' 항공사진: 왼쪽은 '+p+'년, 오른쪽은 최신 사진':n+'의 최신 항공사진',
  text:(n,p)=>p?n+' 항공사진, '+p+'년과 지금':n+' 항공사진',
  nets:['naver','x','facebook']},
 'zh-Hans':{heading:'分享这个地点',native:'分享…',copy:'复制链接',copied:'已复制链接',
  alt:(n,p)=>p?n+'航拍：左为'+p+'年，右为最新照片':n+'的最新航拍照片',
  text:(n,p)=>p?n+'航拍：'+p+'年与今天':n+'航拍',
  nets:['weibo','x','facebook']},
 'zh-Hant':{heading:'分享這個地點',native:'分享…',copy:'複製連結',copied:'已複製連結',
  alt:(n,p)=>p?n+'航空照片：左為'+p+'年，右為最新照片':n+'的最新航空照片',
  text:(n,p)=>p?n+'航空照片：'+p+'年與今天':n+'航空照片',
  nets:['line','facebook','threads','x']},
 th:{heading:'แชร์สถานที่นี้',native:'แชร์…',copy:'คัดลอกลิงก์',copied:'คัดลอกลิงก์แล้ว',
  alt:(n,p)=>p?'ภาพถ่ายทางอากาศของ'+n+' ซ้ายคือช่วง '+p+' ขวาคือภาพล่าสุด':'ภาพถ่ายทางอากาศล่าสุดของ'+n,
  text:(n,p)=>p?n+' จากมุมสูง ช่วง '+p+' กับวันนี้':n+' จากมุมสูง',
  nets:['line','facebook','x']}
};
const NETS={
 x:{label:'X',href:(u,s)=>'https://x.com/intent/post?url='+u+'&text='+s},
 facebook:{label:'Facebook',href:u=>'https://www.facebook.com/sharer/sharer.php?u='+u},
 line:{label:'LINE',href:u=>'https://social-plugins.line.me/lineit/share?url='+u},
 reddit:{label:'Reddit',href:(u,s)=>'https://www.reddit.com/submit?url='+u+'&title='+s},
 whatsapp:{label:'WhatsApp',href:(u,s)=>'https://wa.me/?text='+s+'%20'+u},
 threads:{label:'Threads',href:(u,s)=>'https://www.threads.net/intent/post?text='+s+'%20'+u},
 naver:{label:'NAVER',href:(u,s)=>'https://share.naver.com/web/shareView?url='+u+'&title='+s},
 weibo:{label:'微博',href:(u,s)=>'https://service.weibo.com/share/share.php?url='+u+'&title='+s}
};
const copyFor=l=>COPY[l]||COPY.en;

/* <meta> tags for the page's image. */
function meta(key,lang,name){
 const img=image(key),alt=img.path?copyFor(lang).alt(name,img.period):'Japan Time Atlas';
 return '<meta property="og:image" content="'+img.url+'"><meta property="og:image:width" content="'+W+'"><meta property="og:image:height" content="'+H+'"><meta property="og:image:alt" content="'+esc(alt)+'"><meta name="twitter:image" content="'+img.url+'">';
}
/* Let search results and Google Discover show the image large. */
const robots='<meta name="robots" content="max-image-preview:large">';
const script=v=>'<script src="/share.js?v='+v+'" defer></script>';
const schemaImage=key=>{const img=image(key);return {'@type':'ImageObject',url:img.url,width:W,height:H};};
const author={'@type':'Organization',name:'Japan Time Atlas',url:base+'/about'};

/* The share block: the image as it will appear in a post, then the links. */
function section(key,lang,url,name){
 const c=copyFor(lang),img=image(key),full=base+url;
 const text=c.text(name,img.period)+' · '+(BRAND[lang]||'Japan Time Atlas');
 const u=encodeURIComponent(full),s=encodeURIComponent(text);
 return '<!--SHARE--><section class="share"><h2>'+esc(c.heading)+'</h2>'
  +(img.path?'<figure class="share-card"><img src="'+img.path+'" width="'+W+'" height="'+H+'" loading="lazy" decoding="async" alt="'+esc(c.alt(name,img.period))+'"></figure>':'')
  +'<p class="share-row" data-url="'+esc(full)+'" data-text="'+esc(text)+'"><button class="share-native" type="button" hidden>'+esc(c.native)+'</button>'
  +c.nets.map(n=>'<a class="share-link" href="'+esc(NETS[n].href(u,s))+'" target="_blank" rel="noopener">'+esc(NETS[n].label)+'</a>').join('')
  +'<button class="share-copy" type="button" data-done="'+esc(c.copied)+'" hidden>'+esc(c.copy)+'</button></p></section><!--/SHARE-->';
}

module.exports={image,meta,robots,script,schemaImage,author,section,COPY,NETS};
