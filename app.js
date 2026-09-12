/* =========================================================================
   まちの れきし たんけんマップ  —  prototype v0.1
   地図: 地理院タイル(国土地理院) / 地点: 自然災害伝承碑(国土地理院)・OpenStreetMap・Wikipedia
   ========================================================================= */

const NOW_YEAR = new Date().getFullYear();
const GSI = 'https://cyberjapandata.gsi.go.jp/xyz';
const GSI_ATTR = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>';

/* ---------- 時代（GSI公式のレイヤ定義から取得したタイトルをそのまま使用） ---------- */
const ERAS = [
  { id:'ort_USA10', ext:'png', label:'1945年〜1950年', sub:'せんそうが おわった ころ',  min:2,  max:18 },
  { id:'ort_old10', ext:'png', label:'1961年〜1969年', sub:'まちが どんどん ふえた ころ', min:2,  max:18 },
  { id:'gazo1',     ext:'jpg', label:'1974年〜1978年', sub:'おとうさん おかあさんの こども時代？', min:10, max:18 },
  { id:'gazo2',     ext:'jpg', label:'1979年〜1983年', sub:'',                           min:10, max:18 },
  { id:'gazo3',     ext:'jpg', label:'1984年〜1986年', sub:'',                           min:10, max:18 },
  { id:'gazo4',     ext:'jpg', label:'1987年〜1990年', sub:'しょうわの さいご',           min:10, max:18 },
  { id:'seamlessphoto', ext:'jpg', label:'いまの しゃしん', sub:'さいしんの 空から見た ようす', min:14, max:18 },
];

/* ---------- カテゴリ ---------- */
const CATS = {
  lore:   { emoji:'🪧', name:'さいがいの碑', cls:'pin-lore'   },
  shrine: { emoji:'⛩️', name:'神社',        cls:'pin-shrine' },
  temple: { emoji:'🛕', name:'お寺',        cls:'pin-temple' },
  castle: { emoji:'🏯', name:'城・城あと',   cls:'pin-castle' },
  ruin:   { emoji:'🏺', name:'いせき・古墳', cls:'pin-ruin'   },
  stone:  { emoji:'🗿', name:'石碑・記念碑', cls:'pin-stone'  },
  wiki:   { emoji:'📖', name:'まちの話',     cls:'pin-wiki'   },
  other:  { emoji:'📌', name:'そのほか',     cls:'pin-other'  },
};

/* =========================================================================
   1. 地図
   ========================================================================= */
const map = L.map('map', { zoomControl:false, attributionControl:true, tap:true })
             .setView([34.6656, 133.9360], 16); // 既定：岡山城のあたり
L.control.zoom({ position:'topright' }).addTo(map);

const baseMap = L.tileLayer(`${GSI}/pale/{z}/{x}/{y}.png`, {
  maxZoom:18, minZoom:5, attribution:GSI_ATTR, crossOrigin:'anonymous'
}).addTo(map);

let photoLayer = null;
const landLayer = L.tileLayer(`${GSI}/lcmfc2/{z}/{x}/{y}.png`, {
  maxZoom:16, minZoom:5, opacity:.62, attribution:`治水地形分類図 / ${GSI_ATTR}`,
  crossOrigin:'anonymous'
});

const markerLayer = L.layerGroup().addTo(map);
const meLayer     = L.layerGroup().addTo(map);

/* =========================================================================
   2. 時代スライダー
   ========================================================================= */
const eraRange = document.getElementById('eraRange');
const opaRange = document.getElementById('opaRange');

function applyEra(){
  const era = ERAS[+eraRange.value];
  const opa = (+opaRange.value) / 100;
  document.getElementById('eraLabel').textContent = era.label;
  document.getElementById('eraSub').textContent   = era.sub;

  if (photoLayer) { map.removeLayer(photoLayer); photoLayer = null; }
  hint('');
  if (opa > 0){
    photoLayer = L.tileLayer(`${GSI}/${era.id}/{z}/{x}/{y}.${era.ext}`, {
      maxNativeZoom: era.max, maxZoom: 18, minZoom: era.min,
      opacity: opa, attribution: `${era.label}の空中写真 / ${GSI_ATTR}`,
      crossOrigin: 'anonymous'
    }).addTo(map);

    // 古い写真は全国を覆っていない（1945年は米軍が撮った範囲だけ）。
    // 真っ白な画面を「バグ」と誤解させないよう、撮られていないことを明示する。
    let ok = 0, ng = 0;
    photoLayer.on('tileload',  () => ok++);
    photoLayer.on('tileerror', () => ng++);
    photoLayer.on('load', () => {
      hint(ng > 0 && ok === 0
        ? `📷 ${era.label}の しゃしんは この あたりでは とられていません`
        : '');
    });
  }
}

function hint(msg){
  const el = document.getElementById('hint');
  el.textContent = msg;
  el.hidden = !msg;
}
eraRange.addEventListener('input', () => {
  if (+opaRange.value === 0) opaRange.value = 85;  // 時代を動かしたら自動で写真を出す
  applyEra();
});
opaRange.addEventListener('input', applyEra);
applyEra();

/* 土地のなりたち（治水地形分類図） */
const landBtn = document.getElementById('landBtn');
let landOn = false;
landBtn.addEventListener('click', () => {
  landOn = !landOn;
  landBtn.setAttribute('aria-pressed', String(landOn));
  if (landOn){
    landLayer.addTo(map);
    openSheet(landSheetHTML());
  } else {
    map.removeLayer(landLayer);
  }
});

/* =========================================================================
   3. やさしい日本語ヘルパー
   ========================================================================= */
/* 語を「置きかえる」と文法が壊れる（例: 氾濫→あふれた で「旭川のあふれたにより」）。
   そこで ①壊れない語だけ置換 ②むずかしい語は消さずに一度だけ注釈を足す、の2段構えにする。
   ※これは辞書によるその場しのぎ。本番の書き直しは tools/kidify.mjs（LLM）で事前生成する。 */
const SWAP = [                      // 名詞→名詞。前後の助詞に影響しないものだけ
  [/死傷者/g,'なくなった人や けがをした人'],
  [/負傷者/g,'けがをした人'],
  [/死者/g,'なくなった人'],
  [/家屋/g,'家'],
  [/甚大な/g,'とても 大きな'],
  [/一帯/g,'あたり'],
  [/当時/g,'そのころ'],
  [/現在の/g,'いまの'],
  [/後世/g,'あとの 時代'],
];
const GLOSS = [                     // 語は残し、初出に一度だけ ふりがな的な説明を添える
  ['全半壊', 'ぜんぶ または はんぶん こわれること'],
  ['氾濫',   '水が あふれること'],
  ['決壊',   'ていぼうが こわれること'],
  ['浸水',   '水に つかること'],
  ['冠水',   '水に つかること'],
  ['全壊',   'ぜんぶ こわれること'],
  ['半壊',   'はんぶん こわれること'],
  ['流失',   'ながされて なくなること'],
  ['土石流', '土や石が いっきに ながれること'],
  ['堤防',   '川の 水を とめる かべ'],
  ['高潮',   '台風で 海の水が もりあがること'],
  ['津波',   'じしんで おきる 大きな なみ'],
  ['液状化', 'じめんが どろどろに なること'],
  ['罹災',   'ひがいを うけること'],
  ['慰霊',   'なくなった人を おもうこと'],
  ['建立',   'たてること'],
  ['教訓',   'ここから まなぶこと'],
];

function easyText(s){
  let t = String(s || '');
  for (const [re, to] of SWAP) t = t.replace(re, to);
  // 長い語を先に当てる1パス走査。挿入した注釈自体を再走査しないので二重注釈が起きない
  const terms = GLOSS.slice().sort((a, b) => b[0].length - a[0].length);
  const re = new RegExp(terms.map(([w]) => w).join('|'), 'g');
  const used = new Set();
  return t.replace(re, m => {
    if (used.has(m)) return m;                       // 注釈は初出の一度だけ
    used.add(m);
    return m + '（' + terms.find(([w]) => w === m)[1] + '）';
  });
}

/** 文章の先頭 n 文だけ取り出す */
function firstSentences(s, n = 2){
  const parts = String(s || '').replace(/\s+/g,' ').split(/(?<=。)/).filter(Boolean);
  return parts.slice(0, n).join('');
}

/** 西暦を見つけて「◯年まえ」を添える */
function annotateYears(s){
  return String(s || '').replace(/((?:19|20|17|18)\d{2})年/g, (m, y) => {
    const ago = NOW_YEAR - (+y);
    return ago > 3 ? `${m}（いまから${ago}年まえ）` : m;
  });
}

/** 最初に見つかった西暦 */
function firstYear(...cands){
  for (const c of cands){
    const m = String(c || '').match(/((?:1[6-9]|20)\d{2})/);
    if (m) return +m[1];
  }
  return null;
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* 事前生成テキストの「漢字《かんじ》」を <ruby> に変換する（青空文庫式）。
   形態素解析を積まずに ふりがな を出すための書式で、人間が書いた分だけ正確。 */
function ruby(s){
  // 土台は漢字の連なりだけを取る。[^\s]+ だと「お城《しろ》」の「お」まで
  // ルビの下に入ってしまい、読みがずれて見える。
  return esc(s).replace(/([\u4E00-\u9FFF々〆ヶ]+)《([^》]+)》/g, '<ruby>$1<rt>$2</rt></ruby>');
}

/* 見出しの {ago} を「その災害から何年前か」に差し替える。
   年を焼き込むと来年ずれるのでプレースホルダにしてある。 */
function fillAgo(tpl, ago){
  return ago == null ? String(tpl).replace(/\{ago\}年まえ\s*/, 'むかし ').replace(/\{ago\}/g, '')
                     : String(tpl).replace(/\{ago\}/g, ago);
}

/* =========================================================================
   4. データ取得
   ========================================================================= */
const POIS = new Map();          // key -> poi
/* データの版。?v= を手で書かないこと。7箇所そろっていないと Service Worker の
   precache が一生ヒットせず、しかも黙って通信に落ちるだけで気づけない。
   ここは tools/bump_version.py が書き換える（app.js 側は必ずこの定数を使う）。 */
const DATA_V = '0.47';
/* tools/kidify.py で事前生成した子ども向け文章。あれば辞書置換より優先する。
   無くてもアプリは動く（その場合はその場の辞書置換にフォールバック）。 */
const KID = new Map();
fetch('data/kid-text.json?v=' + DATA_V)
  .then(r => r.ok ? r.json() : null)
  .then(j => { if (j) for (const [id, v] of Object.entries(j))
                 if (!id.startsWith('_')) KID.set(id, v); })   // _meta は説明書きなので除く
  .catch(() => {});
const tileCache = new Set();     // 取得済み z7 タイル
const bboxCache = new Set();     // 取得済み Overpass bbox
let busy = 0;

function setBusy(on, msg){
  busy += on ? 1 : -1;
  const el = document.getElementById('loading');
  if (msg) document.getElementById('loadingTxt').textContent = msg;
  el.hidden = busy <= 0;
}

function lonLat2tile(lat, lon, z){
  const n = 2 ** z, r = lat * Math.PI / 180;
  return {
    x: Math.floor((lon + 180) / 360 * n),
    y: Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)
  };
}

/* ---- 4-1. 自然災害伝承碑（tools/build_monuments.py で全国2,469基を事前ビルド済み） ----
   以前は表示のたびに地理院の z7 GeoJSON を取りに行っていたが、
   ①遅い ②オフラインで何も出ない ③公共サービスに負荷、の3つが不利だった。
   全国分でも 1.6MB しかないので、起動時に一度読んで Service Worker に載せる。 */
let loreLoaded = null;
function loadLore(){
  if (loreLoaded) return loreLoaded;
  setBusy(true, 'さいがいの碑を よみこんでいます…');
  loreLoaded = fetch('data/monuments.json?v=' + DATA_V)
    .then(r => { if (!r.ok) throw new Error('monuments ' + r.status); return r.json(); })
    .then(rows => {
      for (const m of rows){
        POIS.set('lore:' + m.id, {
          cat:'lore', lat:m.lat, lon:m.lon, name:m.name || '災害の碑',
          raw:{ ID:m.id, LoreName:m.name, LoreYear:m.year, Address:m.addr,
                DisasterName:m.dis, DisasterKind:m.kind, DisasterInfo:m.info, Image:m.img }
        });
      }
      console.info(`自然災害伝承碑 ${rows.length}件を読み込み`);
    })
    .catch(err => { console.warn('伝承碑の読み込みに失敗', err); })
    .finally(() => setBusy(false));
  return loreLoaded;
}

/* ---- 4-1b. 事前ビルドした地点（tools/build_places.py） ----
   Overpass は実測で 504 と 45秒ハングを返した。公開サーバの機嫌が
   そのままアプリの品質になるのを避けるため、主要地域は焼いておく。
   ここに無い地域は下の loadOSM が生で取りに行く（あくまで補助）。

   2026-09-08: ここは `data/places-okayama.json` を直に取りに行っていたが、
   その名前のファイルはもう無い（places-okayama-a … -d ほかへ分割済み）。
   404 は `r.ok ? … : []` と `.catch(() => {})` に飲まれるので画面には何も出ず、
   **事前ビルド地点が1件も入らないまま**動いていた（実測 404 / POIS に0件）。
   ファイルの分け方はまた変わる。名前を並べ直すと同じことが起きるので、
   置き場は places-index.json（＝分けた本人が書く索引）から引く。 */
const PLACE_SETS = ['okayama'];
/* 県ごとの事前ビルドは explore 用に広く取ってある（岡山は7,171件で、
   信号・用水路・山頂まで入っている）。この画面が扱うのは loadOSM と同じ3種類だけ
   ＝ historic / 礼拝所 / 石のしるし。ここで絞らないと、地図が「その他」で埋まる。
   実測: 7,171件 → 2,942件（礼拝所1,750＋historic1,192）。 */
const keepForKids = t => 'historic' in t
                      || t.amenity === 'place_of_worship'
                      || t.man_made === 'stone';
let placesLoaded = null;
function loadPlaces(){
  if (placesLoaded) return placesLoaded;
  placesLoaded = fetch('data/places-index.json?v=' + DATA_V)
    .then(r => r.ok ? r.json() : [])
    .then(idx => Promise.all(idx
      .filter(e => PLACE_SETS.some(n => e.n === n || e.n.startsWith(n + '-')))
      .map(e => fetch('data/places-' + e.n + '.json?v=' + DATA_V)
        .then(r => r.ok ? r.json() : [])
        .then(all => {
          const rows = all.filter(p => keepForKids(p.tags));
          for (const p of rows)
            POIS.set(`osm:${p.t}:${p.i}`, {
              cat: osmCat(p.tags), lat: p.lat, lon: p.lon,
              name: p.tags.name || p.tags.inscription?.slice(0, 18) || '石のしるし',
              raw: p.tags, osmType: p.t, osmId: p.i
            });
          return rows.length;
        })
        .catch(() => 0))))
    .then(counts => {
      const n = counts.reduce((a, b) => a + b, 0);
      /* 0件を黙って通さない。ここが黙ると「地図に何も出ない」だけが残る。 */
      if (n) console.info(`事前ビルド地点 ${PLACE_SETS.join('・')}: ${n}件 / ${counts.length}ファイル`);
      else console.warn(`事前ビルド地点が0件（${PLACE_SETS.join('・')}）。`
                      + 'data/places-index.json の名前と実ファイルを確かめること');
    })
    .catch(err => { console.warn('事前ビルド地点の読み込みに失敗', err); });
  return placesLoaded;
}

/* ---- 4-2. OpenStreetMap（神社・寺・城・古墳・石碑…／事前ビルドの無い地域用） ---- */
const OVERPASS_HOSTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const OSM_Q = b => `[out:json][timeout:45];
(
 node["historic"](${b});
 way["historic"](${b});
 node["amenity"="place_of_worship"](${b});
 way["amenity"="place_of_worship"](${b});
 node["man_made"="stone"](${b});
);
out center tags 300;`;

function osmCat(t){
  const h = t.historic || '';
  if (['castle','city_gate','fort'].includes(h)) return 'castle';
  if (['archaeological_site','tomb','tumulus','ruins'].includes(h)) return 'ruin';
  if (['memorial','monument','stone','boundary_stone','milestone','wayside_cross','wayside_shrine','charcoal_pile'].includes(h)) return 'stone';
  if (t.amenity === 'place_of_worship'){
    if (t.religion === 'shinto') return 'shrine';
    if (t.religion === 'buddhist') return 'temple';
    return 'other';
  }
  if (t.man_made === 'stone') return 'stone';
  if (h) return 'stone';
  return 'other';
}

/* Overpass が落ちているときに、動かすたび12秒待たされるのを避ける。
   2回続けて駄目なら5分あきらめる（事前ビルド地点があるので画面は成立する）。 */
let osmFails = 0, osmPauseUntil = 0;

async function loadOSM(){
  if (map.getZoom() < 15) return;
  if (Date.now() < osmPauseUntil) return;
  const b = map.getBounds();
  const bs = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map(v => v.toFixed(4));
  const key = bs.join(',');
  if (bboxCache.has(key)) return;
  bboxCache.add(key);

  setBusy(true, '神社や 石碑を さがしています…');
  try{
    // 公開Overpassは混雑時に504/429を返す。順に当たり、全滅ならこのbboxは再試行できるよう戻す
    const q = encodeURIComponent(OSM_Q(key));
    let j = null;
    for (const host of OVERPASS_HOSTS){
      // 実測で45秒以上返ってこないことがある。待たせるくらいなら諦める。
      const ac = new AbortController();
      const kill = setTimeout(() => ac.abort(), 12000);
      try{
        const r = await fetch(`${host}?data=${q}`, { signal: ac.signal });
        if (!r.ok) throw new Error(host + ' → ' + r.status);
        j = await r.json();
        break;
      } catch(e){
        console.warn('Overpass 応答なし・切替', e.name === 'AbortError' ? '12秒で打ち切り' : e.message);
      } finally { clearTimeout(kill); }
    }
    if (!j){
      bboxCache.delete(key);                       // 直ったら取り直せるように戻す
      if (++osmFails >= 2){
        osmPauseUntil = Date.now() + 5 * 60 * 1000;
        console.warn('Overpass が応答しないため5分休止。事前ビルド地点のみで表示します');
      }
      return;
    }
    osmFails = 0;
    for (const e of (j.elements || [])){
      const t = e.tags || {};
      const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
      if (lat == null || lon == null) continue;
      if (!t.name && !t.inscription && !t.description) continue;   // 名無しは出さない
      POIS.set(`osm:${e.type}:${e.id}`, {
        cat: osmCat(t), lat, lon, name: t.name || t.inscription?.slice(0, 18) || '石のしるし', raw: t,
        osmType: e.type, osmId: e.id
      });
    }
  } catch(err){
    console.warn('OSM取得に失敗', err);
  } finally { setBusy(false); }
}

/* ---- 4-3. Wikipedia（まわりの記事） ---- */
async function loadWiki(){
  if (map.getZoom() < 14) return;
  const c = map.getCenter();
  const radius = Math.min(10000, Math.max(500,
    Math.round(map.distance(map.getBounds().getNorthWest(), map.getBounds().getSouthEast()) / 2)));
  const key = `w:${c.lat.toFixed(3)},${c.lng.toFixed(3)},${radius}`;
  if (bboxCache.has(key)) return;
  bboxCache.add(key);

  setBusy(true, 'まちの お話を さがしています…');
  try{
    const gs = await fetch('https://ja.wikipedia.org/w/api.php?origin=*&format=json&action=query&list=geosearch'
      + `&gscoord=${c.lat}%7C${c.lng}&gsradius=${radius}&gslimit=40`).then(r => r.json());
    const hits = gs?.query?.geosearch || [];
    if (!hits.length) return;

    const ids = hits.map(h => h.pageid).join('|');
    const ex = await fetch('https://ja.wikipedia.org/w/api.php?origin=*&format=json&action=query'
      + '&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=640&pilimit=50'
      + `&pageids=${ids}`).then(r => r.json());
    const pages = ex?.query?.pages || {};

    for (const h of hits){
      const p = pages[h.pageid] || {};
      POIS.set('wiki:' + h.pageid, {
        cat:'wiki', lat:h.lat, lon:h.lon, name:h.title,
        raw:{ extract:p.extract || '', thumb:p.thumbnail?.source || '', pageid:h.pageid, title:h.title }
      });
    }
  } catch(err){
    console.warn('Wikipedia取得に失敗', err);
  } finally { setBusy(false); }
}

/* =========================================================================
   5. 表示
   ========================================================================= */
const activeCats = new Set(Object.keys(CATS));

function buildFilters(){
  const box = document.getElementById('filters');
  box.innerHTML = '';
  for (const [k, c] of Object.entries(CATS)){
    const b = document.createElement('button');
    b.className = 'chip';
    b.setAttribute('aria-pressed', String(activeCats.has(k)));
    b.innerHTML = `<span>${c.emoji}</span><span>${c.name}</span><span class="n" data-n="${k}"></span>`;
    b.onclick = () => {
      activeCats.has(k) ? activeCats.delete(k) : activeCats.add(k);
      b.setAttribute('aria-pressed', String(activeCats.has(k)));
      render();
    };
    box.appendChild(b);
  }
}

const CELL = 58;   // クラスタのマス目（画面ピクセル）。重なったピンを1つにまとめる

function render(){
  markerLayer.clearLayers();
  const b = map.getBounds();
  const z = map.getZoom();
  const counts = {};
  const cells = new Map();

  for (const [key, p] of POIS){
    if (!b.contains([p.lat, p.lon])) continue;   // 件数も「いま画面に見えている数」で数える
    counts[p.cat] = (counts[p.cat] || 0) + 1;
    if (!activeCats.has(p.cat)) continue;

    // 画面上の位置でマス目に振り分ける＝ズームすると自然にほどける
    const pt = map.project([p.lat, p.lon], z);
    const ck = `${Math.floor(pt.x / CELL)},${Math.floor(pt.y / CELL)}`;
    (cells.get(ck) || cells.set(ck, []).get(ck)).push([key, p]);
  }

  for (const group of cells.values()){
    if (group.length === 1){
      const [key, p] = group[0];
      const c = CATS[p.cat];
      L.marker([p.lat, p.lon], {
        title: p.name, keyboard: true,
        icon: L.divIcon({ className:'',
          html:`<div class="pin ${c.cls}" style="width:34px;height:34px"><span>${c.emoji}</span></div>`,
          iconSize:[34,34], iconAnchor:[17,32] })
      }).on('click', () => showPOI(key, p)).addTo(markerLayer);
      continue;
    }
    // まとまり：いちばん多い種類の色をつけ、件数を出す。押すと開く
    const top = group.map(([, p]) => p.cat)
      .reduce((a, c, _, arr) => arr.filter(v => v === c).length > arr.filter(v => v === a).length ? c : a);
    const lat = group.reduce((s, [, p]) => s + p.lat, 0) / group.length;
    const lon = group.reduce((s, [, p]) => s + p.lon, 0) / group.length;
    L.marker([lat, lon], {
      title: `${group.length}か所`, keyboard: true,
      icon: L.divIcon({ className:'',
        html:`<div class="cluster ${CATS[top].cls}"><b>${group.length}</b></div>`,
        iconSize:[42,42], iconAnchor:[21,21] })
    }).on('click', () => {
      if (z < 18) map.setView([lat, lon], Math.min(18, z + 2));
      else openSheet(clusterHTML(group));
    }).addTo(markerLayer);
  }

  for (const el of document.querySelectorAll('.n[data-n]'))
    el.textContent = counts[el.dataset.n] ? counts[el.dataset.n] : '';
}

/* 最大ズームでも重なっている場合は一覧を出す */
function clusterHTML(group){
  const items = group.map(([key, p]) => {
    const c = CATS[p.cat];
    return `<button class="s-btn pick" data-k="${esc(key)}">
      <span>${c.emoji}</span><span>${esc(p.name)}</span></button>`;
  }).join('');
  setTimeout(() => {
    for (const b of document.querySelectorAll('.pick'))
      b.onclick = () => { const k = b.dataset.k; showPOI(k, POIS.get(k)); };
  }, 0);
  return `<div class="s-kicker">📍 ${group.length}か所 あります</div>
    <h2 class="s-title">どれを 見る？</h2>
    <div class="s-actions" style="flex-direction:column;align-items:stretch">${items}</div>`;
}

/* =========================================================================
   6. 詳細シート
   ========================================================================= */
const sheet = document.getElementById('sheet');
const sheetBack = document.getElementById('sheetBack');

function openSheet(html){
  document.getElementById('sheetBody').innerHTML = html;
  sheet.hidden = false; sheetBack.hidden = false;
  sheet.scrollTop = 0;
}
function closeSheet(){ sheet.hidden = true; sheetBack.hidden = true; }
document.getElementById('sheetClose').onclick = closeSheet;
sheetBack.onclick = closeSheet;

function showPOI(key, p){
  stamp(key);
  openSheet(p.cat === 'lore' ? loreHTML(p) : p.cat === 'wiki' ? wikiHTML(p) : osmHTML(p));
  window.__focus = [p.lat, p.lon];
}

/* ---- 6-1. 自然災害伝承碑：構造化データがあるので正確な要約を組み立てられる ---- */
function loreHTML(p){
  const r = p.raw;
  const kind  = (r.DisasterKind || '').trim();
  const dname = (r.DisasterName || '').replace(/<br\s*\/?>/gi, ' ').trim();
  const dYear = firstYear(dname, r.DisasterInfo);
  const bYear = firstYear(r.LoreYear);
  const ago   = dYear ? NOW_YEAR - dYear : null;

  const pre = KID.get(r.ID);                 // 事前生成があればそれを使う
  const headline = pre?.headline ? ruby(fillAgo(pre.headline, ago))
    : dYear ? `${ago}年まえ、ここで<br><b>${esc(kind || 'さいがい')}</b>が おきました`
    : `ここには <b>さいがいを わすれない ための 石</b>が あります`;

  const info = String(r.DisasterInfo || '').trim();
  // 事前生成があればルビ付きで、無ければその場の注釈方式にフォールバック
  const kidBody = pre?.body ? ruby(pre.body)
                            : esc(annotateYears(easyText(firstSentences(info, 3))));

  return `
  <div class="s-kicker">🪧 さいがいの碑</div>
  <h2 class="s-title">${esc(p.name)}</h2>
  <p class="s-when">${bYear ? `${bYear}年（${NOW_YEAR - bYear}年まえ）に たてられた 石` : '石が たてられた 年は わかりません'}</p>

  <div class="s-lead">${headline}</div>

  ${r.Image ? `<img class="s-photo" loading="lazy" crossorigin="anonymous" src="${esc(r.Image)}" alt="${esc(p.name)}の写真">` : ''}

  <div class="s-body kid-only">${kidBody ? `<p>${kidBody}</p>` : '<p>くわしい 話は のこっていません。</p>'}</div>
  <div class="s-body adult-only"><p>${esc(info) || '（伝承内容の記載なし）'}</p></div>

  <div class="s-actions">
    <button class="s-btn s-btn-main" onclick="flyThen1945()">📷 1945年の しゃしんで 見る</button>
    <button class="s-btn" onclick="document.body.classList.toggle('adult')">🔁 ${'もじを きりかえる'}</button>
  </div>

  <div class="s-meta">
    ${dname ? `<div>できごと：${esc(dname)}</div>` : ''}
    ${r.Address ? `<div>ばしょ：${esc(r.Address)}</div>` : ''}
    <div>出典：国土地理院「自然災害伝承碑」</div>
    <div>こども向けの文：${pre ? '原文をもとに書き直したもの（ふりがな付き）'
                              : '未作成のため、原文に自動で注釈を付けて表示'}</div>
  </div>`;
}

/* ---- 6-2. OSM ---- */
const OSM_LABEL = {
  castle:'城・城のあと', ruins:'こわれた たてもの', archaeological_site:'いせき',
  tomb:'おはか・古墳', memorial:'記念の 石', monument:'記念の たてもの',
  wayside_shrine:'道ばたの ほこら', boundary_stone:'さかいの 石', milestone:'道しるべ',
};

function osmHTML(p){
  const t = p.raw;
  const cat = CATS[p.cat];
  const built = firstYear(t.start_date, t['building:start_date'], t.inscription);
  const wikiTag = (t.wikipedia || '').replace(/^ja:/, '');
  const lines = [];
  if (t.inscription) lines.push(`<p><b>石に きざまれた ことば</b><br>${esc(t.inscription)}</p>`);
  if (t.description) lines.push(`<p>${esc(annotateYears(easyText(t.description)))}</p>`);
  if (t['name:en']) lines.push(`<p class="s-hard">英語名：${esc(t['name:en'])}</p>`);

  const kindJa = OSM_LABEL[t.historic] || (t.religion === 'shinto' ? '神社'
                : t.religion === 'buddhist' ? 'お寺' : cat.name);

  return `
  <div class="s-kicker">${cat.emoji} ${esc(cat.name)}</div>
  <h2 class="s-title">${esc(p.name)}</h2>
  <p class="s-when">${built ? `${built}年ごろ（${NOW_YEAR - built}年まえ）` : 'いつからか は わかりません'}</p>

  <div class="s-lead">ここは <b>${esc(kindJa)}</b> です。</div>

  ${lines.length ? `<div class="s-body">${lines.join('')}</div>`
    : `<div class="s-body"><p>この ばしょの くわしい お話は、まだ 地図の データに ありません。</p></div>`}

  <div class="s-actions">
    <button class="s-btn s-btn-main" onclick="flyThen1945()">📷 1945年の しゃしんで 見る</button>
    ${wikiTag ? `<a class="s-btn" target="_blank" rel="noopener"
        href="https://ja.wikipedia.org/wiki/${encodeURIComponent(wikiTag)}">📖 もっと しらべる</a>` : ''}
  </div>

  <div class="s-meta">
    <div>出典：OpenStreetMap contributors（ODbL）
      — <a target="_blank" rel="noopener"
      href="https://www.openstreetmap.org/${p.osmType}/${p.osmId}">この地点のデータ</a></div>
  </div>`;
}

/* ---- 6-3. Wikipedia ---- */
function wikiHTML(p){
  const r = p.raw;
  const y = firstYear(r.extract);
  const kid = annotateYears(easyText(firstSentences(r.extract, 2)));
  return `
  <div class="s-kicker">📖 まちの話</div>
  <h2 class="s-title">${esc(p.name)}</h2>
  <p class="s-when">${y ? `${y}年（${NOW_YEAR - y}年まえ）が 出てきます` : ''}</p>

  ${r.thumb ? `<img class="s-photo" loading="lazy" crossorigin="anonymous" src="${esc(r.thumb)}" alt="${esc(p.name)}">` : ''}

  <div class="s-body kid-only"><p>${esc(kid) || 'せつめいが ありません。'}</p></div>
  <div class="s-body adult-only"><p>${esc(r.extract || '')}</p></div>

  <div class="s-actions">
    <button class="s-btn s-btn-main" onclick="flyThen1945()">📷 1945年の しゃしんで 見る</button>
    <a class="s-btn" target="_blank" rel="noopener"
       href="https://ja.wikipedia.org/?curid=${r.pageid}">📖 ぜんぶ よむ</a>
  </div>

  <div class="s-meta">出典：ウィキペディア日本語版「${esc(r.title)}」（CC BY-SA 4.0）</div>`;
}

/* ---- 6-4. 土地のなりたち ---- */
function landSheetHTML(){
  return `
  <div class="s-kicker">🏞️ 土地の なりたち</div>
  <h2 class="s-title">ここは むかし どんな 土地？</h2>
  <div class="s-lead">
    いろが ついた ところは、むかし <b>川・沼・海</b> だった あとです。<br>
    いまの 家や 田んぼの 下に、むかしの 地形が かくれています。
  </div>
  <div class="s-body">
    <p>青むらさき＝むかしの川すじ / 水色＝水に つかりやすい ひくい土地 /
       みどり＝もりあがった土地（比かく的 安全）。</p>
  </div>
  <div class="s-meta">
    出典：国土地理院「治水地形分類図」 —
    <a target="_blank" rel="noopener"
       href="https://www.gsi.go.jp/bousaichiri/fc_index.html">凡例のせつめい</a><br>
    ※ 地形の分類であり、個々の建物の安全性を示すものではありません。
  </div>`;
}

/* =========================================================================
   7. 操作
   ========================================================================= */
window.flyThen1945 = function(){
  eraRange.value = 0; opaRange.value = 90; applyEra();
  if (window.__focus) map.setView(window.__focus, Math.max(map.getZoom(), 17));
  closeSheet();
};

/* 現在地 */
document.getElementById('locBtn').onclick = () => {
  if (!navigator.geolocation){ alert('この ブラウザでは いまの ばしょが つかえません'); return; }
  setBusy(true, 'いまいる ばしょを さがしています…');
  navigator.geolocation.getCurrentPosition(
    pos => {
      setBusy(false);
      const { latitude:la, longitude:lo } = pos.coords;
      map.setView([la, lo], 17);
      meLayer.clearLayers();
      L.circleMarker([la, lo], { radius:9, color:'#fff', weight:3, fillColor:'#2f7bd6', fillOpacity:1 })
       .addTo(meLayer);
    },
    err => { setBusy(false); alert('ばしょが とれませんでした（' + err.message + '）'); },
    { enableHighAccuracy:true, timeout:10000, maximumAge:60000 }
  );
};

/* こども / おとな */
const modeBtn = document.getElementById('modeBtn');
modeBtn.onclick = () => {
  const kid = document.body.classList.toggle('adult') === false;
  modeBtn.setAttribute('aria-pressed', String(kid));
  modeBtn.querySelector('.pill-ico').textContent = kid ? '🧒' : '🧑';
  document.getElementById('modeLabel').textContent = kid ? 'こども' : 'おとな';
};

/* みつけたスタンプ */
const STAMP_KEY = 'rekishi-stamps';
let stamps = new Set(JSON.parse(localStorage.getItem(STAMP_KEY) || '[]'));
function stamp(id){
  if (stamps.has(id)) return;
  stamps.add(id);
  localStorage.setItem(STAMP_KEY, JSON.stringify([...stamps]));
  paintStamps();
}
function paintStamps(){ document.getElementById('stampCount').textContent = stamps.size; }
document.getElementById('stampBtn').onclick = () => {
  openSheet(`<div class="s-kicker">⭐ たんけん きろく</div>
    <h2 class="s-title">${stamps.size}こ みつけた！</h2>
    <div class="s-lead">タップして 読んだ ばしょの かずです。<br>まちを あるいて ふやそう。</div>`);
};
paintStamps();

/* 出典 */
document.getElementById('creditBtn').onclick = () => {
  const b = document.getElementById('creditBox'); b.hidden = !b.hidden;
};

/* =========================================================================
   8. 起動と再読込
   ========================================================================= */
/* OSM/Wikipedia は通信が要る。一度取れた分は端末に残して、
   圏外や公開サーバ停止のときでも「前に見た場所」は出るようにする。 */
const CACHE_KEY = 'rekishi-poi-cache', CACHE_MAX = 900;
function restoreCache(){
  try{
    for (const [k, p] of JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'))
      if (!POIS.has(k)) POIS.set(k, p);
  } catch(e){ /* 壊れていたら黙って捨てる */ }
}
let saveTimer = null;
function saveCache(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try{
      localStorage.setItem(CACHE_KEY, JSON.stringify(
        [...POIS].filter(([k]) => !k.startsWith('lore:')).slice(-CACHE_MAX)));
    } catch(e){ /* 容量超過なら諦める */ }
  }, 1500);
}

let timer = null;
function refresh(){
  clearTimeout(timer);
  timer = setTimeout(async () => {
    // 事前ビルド分を先に描いてから、通信が要るものを待つ
    await Promise.all([loadLore(), loadPlaces()]);
    render();
    await Promise.all([loadOSM(), loadWiki()]);
    render();
    saveCache();
  }, 350);
}
map.on('moveend zoomend', refresh);
restoreCache();
buildFilters();
render();          // 通信を待たず、端末に残っている分をすぐ出す
refresh();

/* ---- アプリとして入れてもらうための登録 ---- */
if ('serviceWorker' in navigator)
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW登録失敗', e)));

let installEvent = null;
const installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); installEvent = e; installBtn.hidden = false;
});
installBtn.onclick = async () => {
  if (!installEvent) return;
  installBtn.hidden = true;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
};
window.addEventListener('appinstalled', () => { installBtn.hidden = true; });

window.addEventListener('offline', () => hint('📴 いま オフラインです（ほぞんした ぶんだけ 見られます）'));
window.addEventListener('online',  () => hint(''));
