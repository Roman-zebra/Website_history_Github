/* Four photographic chapters, shuffled without adjacent repeats. */
(() => {
  'use strict';
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const home = document.getElementById('home');
  const scene = document.getElementById('heroScene');
  const button = document.getElementById('heroMotion');
  const caption = document.getElementById('heroCaption');
  const credit = document.getElementById('heroCredit');
  const license = document.getElementById('heroLicense');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  const copy = {
    en: ['A journey through time.', 'Explore Japan, layer by layer.', 'Tokyo · Historical aerial photographs / present-day map', 'Pause background', 'Play background', 'Explore the stories', 'All places'],
    ja: ['時を重ねて、', '日本を旅する。', '東京 · 昔の航空写真 / 現在の地図', '背景を停止', '背景を再生', '場所の物語をたどる', 'すべての場所'],
    ko: ['시간을 겹쳐,', '일본을 여행하다.', '도쿄 · 과거 항공사진 / 현재 지도', '배경 일시정지', '배경 재생', '장소의 이야기 탐색', '모든 장소'],
    'zh-CN': ['重叠时光，', '走进日本。', '东京 · 历史航空照片 / 现代地图', '暂停背景', '播放背景', '探索地方故事', '所有地点'],
    'zh-TW': ['重疊時光，', '走進日本。', '東京 · 歷史航空照片 / 現代地圖', '暫停背景', '播放背景', '探索地方故事', '所有地點']
  };

  const gsi = 'https://maps.gsi.go.jp/development/ichiran.html';
  const tiles = (id, ext) => [0,1,2,3].map(n => 'https://cyberjapandata.gsi.go.jp/xyz/' + id + '/14/' + (14552+n%2) + '/' + (6450+Math.floor(n/2)) + '.' + ext);
  const slides = [
    {id:'past', src:tiles('ort_USA10','png'), credit:'国土地理院 / GSI', source:gsi,
      titles:['Tokyo · Historical aerial photographs (1945–1950 series)','東京 · 昔の航空写真（1945–1950年シリーズ）','도쿄 · 과거 항공사진 (1945–1950 시리즈)','东京 · 历史航空照片（1945–1950系列）','東京 · 歷史航空照片（1945–1950系列）']},
    {id:'present', src:tiles('seamlessphoto','jpg'), credit:'国土地理院 / GSI', source:gsi,
      titles:['Tokyo · Present-day aerial imagery (capture dates vary)','東京 · 現代の航空写真（撮影時期は場所により異なります）','도쿄 · 현대 항공사진 (촬영 시기는 지역별로 다름)','东京 · 现代航空影像（拍摄时间因地而异）','東京 · 現代航空影像（拍攝時間因地而異）']},
    {id:'landmark', src:['https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Himeji_castle.JPG/960px-Himeji_castle.JPG'], credit:'Faure Guillaume / Asgatlat', source:'https://commons.wikimedia.org/wiki/File:Himeji_castle.JPG', license:'CC BY-SA 3.0', licenseURL:'https://creativecommons.org/licenses/by-sa/3.0/',
      titles:['Landmarks · Himeji Castle (2005)','名所 · 姫路城（2005年撮影）','명소 · 히메지성 (2005)','名胜 · 姬路城（2005年）','名勝 · 姬路城（2005年）']},
    {id:'liminal', src:['https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Battle-Ship_Island_Nagasaki_Japan.jpg/960px-Battle-Ship_Island_Nagasaki_Japan.jpg'], credit:'kntrty', source:'https://commons.wikimedia.org/wiki/File:Battle-Ship_Island_Nagasaki_Japan.jpg', license:'CC BY 2.0', licenseURL:'https://creativecommons.org/licenses/by/2.0/',
      titles:['Liminal places · Hashima Island (2008)','リミナルスポット · 軍艦島（2008年撮影）','리미널 장소 · 하시마섬 (2008)','阈限空间 · 军舰岛（2008年）','閾限空間 · 軍艦島（2008年）']}
  ];
  let current = null, pending = null, busy = false, settled = false, paused = false, inView = true, timer = null, deck = [];
  const failed = new Set();
  const cache = new Map();
  const constrained = () => media.matches || !!(connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType) || connection.effectiveType === '3g'));
  const active = () => !home.hidden && inView && !document.hidden;
  const allowed = () => active() && !paused && !constrained();
  const langIndex = () => Math.max(0,['en','ja','ko','zh-CN','zh-TW'].indexOf(document.documentElement.lang));
  function paint() {
    const c = copy[document.documentElement.lang] || copy.en;
    document.getElementById('heroLine1').textContent = c[0];
    document.getElementById('heroLine2').textContent = c[1];
    if (current) {
      caption.textContent = current.titles[langIndex()];
      credit.textContent = current.credit;
      credit.href = current.source;
      license.hidden = !current.license;
      license.textContent = current.license || '';
      license.href = current.licenseURL || gsi;
    }
    button.textContent = (paused ? '▷ ' : 'Ⅱ ') + c[paused ? 4 : 3];
    button.setAttribute('aria-pressed', String(paused));
    document.getElementById('storiesTitle').textContent = c[5];
    document.getElementById('allPlacesLink').textContent = c[6] + ' ↗';
  }
  function next() {
    if (!deck.length) {
      deck = slides.filter(s => !failed.has(s.id));
      for (let i=deck.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]]; }
      if (deck.length>1 && deck[0]===current) [deck[0],deck[1]]=[deck[1],deck[0]];
    }
    return deck.shift();
  }
  function load(s) {
    if (cache.has(s.id)) return Promise.resolve(cache.get(s.id));
    const el = document.createElement('div');
    el.className = 'hero-layer hero-' + s.id + (s.src.length>1 ? ' hero-mosaic' : '');
    const jobs = s.src.map(src => new Promise(resolve => {
      const img = new Image();
      img.alt=''; img.decoding='async'; img.fetchPriority='low';
      let done=false;
      const finish=ok=>{if(done)return;done=true;clearTimeout(timeout);resolve(ok);};
      const timeout=setTimeout(()=>finish(false),12000);
      img.onload=()=>finish(true); img.onerror=()=>finish(false);
      img.src=src; el.appendChild(img);
    }));
    return Promise.all(jobs).then(results=>{
      if(!results.every(Boolean))return null;
      cache.set(s.id,el); scene.appendChild(el); return el;
    });
  }
  function show(s,el) {
    for(const layer of cache.values()) layer.classList.toggle('current',layer===el);
    current=s; pending=null; paint();
  }
  function advance() {
    const s=next();
    if(!s || s===current)return;
    busy=true;
    load(s).then(el=>{
      busy=false;
      if(!el){failed.add(s.id);deck=deck.filter(x=>x!==s);}
      else if(active() && (!current || allowed()))show(s,el);
      else pending={s,el};
      sync();
    });
  }
  function sync() {
    if(timer!==null){clearTimeout(timer);timer=null;}
    const canRotate=slides.length-failed.size>1;
    button.hidden=!current || constrained() || !canRotate;
    scene.classList.toggle('paused',!allowed());
    if(!settled || !active() || busy)return;
    if(pending && (!current || allowed()))show(pending.s,pending.el);
    if(!current) { if(slides.length>failed.size)advance(); return; }
    // Keep each chapter long enough to read its source, with a brisk editorial rhythm.
    if(allowed() && canRotate)timer=setTimeout(()=>{timer=null;advance();},3000);
  }
  button.addEventListener('click',()=>{paused=!paused;paint();sync();});
  new MutationObserver(()=>{paint();sync();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  new MutationObserver(sync).observe(home,{attributes:true,attributeFilter:['hidden']});
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync();},{root:home}).observe(hero);
  document.addEventListener('visibilitychange',sync);
  media.addEventListener('change',sync);
  if(connection)connection.addEventListener('change',sync);
  paint();
  const begin=()=>setTimeout(()=>{settled=true;sync();},1500);
  if(document.readyState==='complete')begin();else window.addEventListener('load',begin,{once:true});
})();
