/* Decorative GSI map layers. No video, font download, map engine or tracking. */
(() => {
  'use strict';
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const home = document.getElementById('home');
  const scene = document.getElementById('heroScene');
  const button = document.getElementById('heroMotion');
  const caption = document.getElementById('heroCaption');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  const copy = {
    en: ['A journey through time.', 'Explore Japan, layer by layer.', 'Tokyo · Historical aerial photographs / present-day map', 'Pause background', 'Play background', 'Explore the stories', 'All places'],
    ja: ['時を重ねて、', '日本を旅する。', '東京 · 昔の航空写真 / 現在の地図', '背景を停止', '背景を再生', '場所の物語をたどる', 'すべての場所'],
    ko: ['시간을 겹쳐,', '일본을 여행하다.', '도쿄 · 과거 항공사진 / 현재 지도', '배경 일시정지', '배경 재생', '장소의 이야기 탐색', '모든 장소'],
    'zh-CN': ['重叠时光，', '走进日本。', '东京 · 历史航空照片 / 现代地图', '暂停背景', '播放背景', '探索地方故事', '所有地点'],
    'zh-TW': ['重疊時光，', '走進日本。', '東京 · 歷史航空照片 / 現代地圖', '暫停背景', '播放背景', '探索地方故事', '所有地點']
  };
  let visible = !home.hidden, paused = false, loaded = false, started = false;
  let ready = false, inView = true, settled = false;
  const constrained = () => media.matches || !!(connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType) || connection.effectiveType === '3g'));
  const labels = () => copy[document.documentElement.lang] || copy.en;
  function paint() {
    const c = labels();
    document.getElementById('heroLine1').textContent = c[0];
    document.getElementById('heroLine2').textContent = c[1];
    caption.textContent = c[2];
    button.textContent = (paused ? '▷ ' : 'Ⅱ ') + c[paused ? 4 : 3];
    button.setAttribute('aria-pressed', String(paused));
    document.getElementById('storiesTitle').textContent = c[5];
    document.getElementById('allPlacesLink').textContent = c[6] + ' ↗';
  }
  function layer(id, ext, className) {
    const el = document.createElement('div');
    el.className = 'hero-layer ' + className;
    // Four adjacent z14 tiles around the Imperial Palace, Tokyo.
    const promises = [];
    for (let y = 6450; y <= 6451; y++) for (let x = 14551; x <= 14552; x++) {
      const img = new Image(256, 256);
      img.alt = ''; img.decoding = 'async'; img.fetchPriority = 'low';
      promises.push(new Promise(resolve => { img.onload = () => resolve(true); img.onerror = () => resolve(false); }));
      img.src = 'https://cyberjapandata.gsi.go.jp/xyz/' + id + '/14/' + x + '/' + y + '.' + ext;
      el.appendChild(img);
    }
    scene.appendChild(el);
    return Promise.all(promises).then(results => {
      if (!results.every(Boolean)) { el.remove(); return false; }
      el.classList.add('ready'); return true;
    });
  }
  function sync() {
    visible = !home.hidden;
    const allowed = !constrained();
    button.hidden = !ready || !allowed;
    scene.classList.toggle('animated', ready && allowed);
    scene.classList.toggle('paused', paused || !visible || !inView || document.hidden || !allowed);
    if (!started && settled && visible && inView && !document.hidden) {
      started = true;
      layer('ort_USA10', 'png', 'hero-past').then(ok => { loaded = ok; sync(); });
    }
    if (loaded && !ready && allowed && visible && inView && !document.hidden) {
      loaded = false;
      layer('std', 'png', 'hero-present').then(ok => { ready = ok; sync(); });
    }
  }
  button.addEventListener('click', () => { paused = !paused; paint(); sync(); });
  new MutationObserver(() => { paint(); sync(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  new MutationObserver(sync).observe(home, { attributes: true, attributeFilter: ['hidden'] });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting; sync();
  }, { root: home }).observe(hero);
  document.addEventListener('visibilitychange', sync);
  media.addEventListener('change', sync);
  if (connection) connection.addEventListener('change', sync);
  paint();
  // Let core content and deep-link restoration finish first; no hero traffic on map entry.
  const begin = () => setTimeout(() => { settled = true; sync(); }, 1500);
  if (document.readyState === 'complete') begin(); else window.addEventListener('load', begin, { once: true });
})();
