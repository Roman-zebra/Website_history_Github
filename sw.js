/* まちの れきし たんけんマップ — Service Worker
   ねらい: ①ホーム画面のアプリとして起動できる ②電波が無くても動く。

   3段構え。
     A. アプリ本体と伝承碑データ  … インストール時に precache（無いと何も出ない）
     B. 地図タイル・碑の写真      … cache-first で溜める（一度見た場所は圏外でも出る、枚数上限あり）
     C. Overpass / Wikipedia      … network-only（結果は app.js 側が localStorage に残す）
*/
const VERSION = 'v0.71.0';
const SHELL = `shell-${VERSION}`;
const TILES = `tiles-${VERSION}`;
const TILE_MAX = 700;                       // 端末を圧迫しない範囲。1タイル20-90KB
const REGIONS = `regions-${VERSION}`;
const REGION_MAX = 40;                      // 地域JSONは219本／30.7MB。溜め続けない

/* precache の鍵は URL 丸ごと。アプリ側が付ける ?v= と1文字でも違うと、
   キャッシュは一生ヒットしないのに、エラーも出さず通信に落ちるだけ＝気づけない。
   だから版はここで1回だけ書き、URLは組み立てる。
   そろえる先（全部 tools/bump_version.py が見ている。手で書かない）:
     DATA_V  … explore.js の const DATA_V ＋ app.js の const DATA_V
     ASSET_V … explore.html の ?v=（2箇所）＋ kids.html の ?v=（2箇所）
     ※ ルートの index.html は explore.html の複製。make_deploy.py が作る。
   ※ 以前ここに「app.js に DATA_V は無い」と書いてあったのは、識別子だけを grep した
     ための誤り。app.js は ?v= を直に書いており、0.33 のまま取り残されていた（実測）。
     _headers が /data/* を1年 immutable にしているので、置き去りは「一生古いまま」になる。
     2026-09-08 追記: app.js の ?v= 直書きは const DATA_V に集約した。
     版の数字を直に書いた行が app.js / explore.js に1つでもあれば
     tools/bump_version.py が exit 1 で止める（見張りをコメントでなく道具に置いた）。 */
const DATA_V = '0.47';
const ASSET_V = '0.71';
const DATA_FILES = [
  'monuments-index.json', 'kid-text.json', 'places-index.json',
  'landmarks.json', 'regional-landmarks-v1.json', 'liminal.json', 'places-world.json', 'affiliate.json',
  'topics.json', 'areas.json',
];
const SHELL_FILES = [
  './', './index.html',
  './explore.html', './explore.webmanifest',
  './style.css?v=' + ASSET_V, './app.js?v=' + ASSET_V,
  './place-ui.js?v=' + ASSET_V, './affiliate-router.js?v=' + ASSET_V, './affiliate-config.json?v=' + ASSET_V, './about', './about.js?v=' + ASSET_V,
  './design.css?v=' + ASSET_V, './atmosphere.js?v=' + ASSET_V,
  './ja.html', './ko.html', './zh-cn.html', './zh-tw.html',
  './explore.css?v=' + ASSET_V, './explore.js?v=' + ASSET_V,
  './og.jpg',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  '/vendor/leaflet-1.9.4/leaflet.min.js',
  '/vendor/leaflet-1.9.4/leaflet.min.css',
  '/vendor/leaflet-1.9.4/images/marker-icon.png',
].concat(DATA_FILES.map(f => './data/' + f + '?v=' + DATA_V));

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    // 1つでも失敗すると addAll は全部落ちるので、個別に入れて失敗は記録だけする
    await Promise.all(SHELL_FILES.map(u =>
      c.add(new Request(u, { cache: 'reload' }))
       .catch(err => console.warn('[sw] precache失敗', u, err.message))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys())
      if (![SHELL, TILES, REGIONS].includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

/* 溜めすぎ防止：古いものから消す（Cache API のキーは挿入順） */
/* 同じキャッシュに対して同時に走らせてはいけない。タイルは一度に何十本も届くので、
   put ごとに trim を放っておくと、全員がほぼ同じ瞬間の keys() を見て「同じ古い数本」を
   消しに行き、2番目以降の削除は既に消えた鍵への空打ちになる。結果、入れる量が消す量を
   上回って上限を越えて増え続ける（実測: TILE_MAX=700 なのに36都市のツアーで759件まで
   伸び、放置しても戻らなかった）。キャッシュごとに並べて直列化する。 */
const trimQueue = new Map();       // cache name -> 実行中の trim
function trim(cache, max, name){
  const next = (trimQueue.get(name) || Promise.resolve()).then(async () => {
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
  }).catch(() => {});   // 1回失敗しても後続を止めない
  trimQueue.set(name, next);
  return next;
}

/* 地図タイルの見分け。ホストを1つ書き落とすと、そのタイルは下の
   「本体ファイル」分岐に落ちて SHELL に無制限に溜まる（TILE_MAX が効かない）。
   実測: 36都市を回っただけで Esri のタイルが SHELL に1,989件入っていた。 */
const isTile  = u => /cyberjapandata\.gsi\.go\.jp\/xyz\//.test(u) ||
                     /maps\.gsi\.go\.jp\/(xyz|legend)\//.test(u) ||
                     /server\.arcgisonline\.com\/ArcGIS\/rest\/services\/.+\/tile\//.test(u);
const isPhoto = u => /thumb\.wikimedia\.org|upload\.wikimedia\.org/.test(u);
const isLive  = u => /overpass|wikipedia\.org\/w\/api\.php/.test(u);
/* 地域ごとの places-*.json だけを別のキャッシュへ。places-index / places-world は
   アプリの起動に要るので SHELL に残す（消えると何も出ない）。 */
const isRegion = u => /\/data\/places-(?!index|world)[^\/]*\.json/.test(u);

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = request.url;

  if (isLive(url)) return;                                   // C: 通信専用。SWは触らない

  // A: 画面遷移。圏外なら「そのページ自身」のキャッシュに落とす。
  // index.html を一律で返すと、英語版を開いたのに日本語版が出る。
  if (request.mode === 'navigate'){
    e.respondWith((async () => {
      try { return await fetch(request); }
      catch (err){
        return (await caches.match(request, { ignoreSearch: true }))
            || (await caches.match('./index.html'))
            || Response.error();
      }
    })());
    return;
  }

  // B: 地図タイルと写真は cache-first
  if (isTile(url) || isPhoto(url)){
    e.respondWith((async () => {
      const c = await caches.open(TILES);
      const hit = await c.match(request);
      if (hit) return hit;
      try{
        const res = await fetch(request);
        // opaque(no-cors)は res.ok が false になる。タイルは CORS で取るようにしたが、
        // 経路によっては opaque で来るので、その場合も保存する。
        if (res.ok || res.type === 'opaque'){ await c.put(request, res.clone()); trim(c, TILE_MAX, TILES); }
        return res;
      } catch(err){
        // 圏外で未取得のタイル → 透明1pxを返す。地図が壊れて見えるのを避ける
        return new Response(
          Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='),
            ch => ch.charCodeAt(0)),
          { headers: { 'Content-Type': 'image/png' } });
      }
    })());
    return;
  }

  // B': 地域JSONは cache-first。URL に ?v=DATA_V が入っているので、データを変えれば
  // URL が変わり必ず取り直しになる（古いまま残る事故は起きない。版ずれは
  // make_deploy.py が公開前に止める）。SHELL とは別の枠に入れて上限で切る。
  //
  // 2026-09-09 に network-first から変えた。理由は実測: 新宿(z16)へ寄ると地域JSONを
  // 4本読むが、network-first だと**キャッシュにあっても毎回**343-426ms 待っていた
  // （4本で約1.5秒）。長時間タスクは0件だったので、重さの正体は計算ではなく待ち時間。
  // 保存を await してから返してはいけない。最初にそう書いたとき、同じSWの
  // 同じ瞬間に landmarks.json は通るのに地域JSONだけ58本連続で ERR_FAILED に
  // なった（実測）。原因は特定できていないが、保存の失敗が返事を巻き込む形
  // そのものが危険なので、返事は先に返し、保存は後ろで黙って行う。
  if (isRegion(url) || (new URL(url).origin===location.origin && new URL(url).pathname.startsWith('/search/'))){
    e.respondWith((async () => {
      // まずキャッシュ。あれば通信を待たずに返す。
      try{
        const c0 = await caches.open(REGIONS);
        const hit = await c0.match(request);
        if (hit) return hit;
      } catch(err){ /* キャッシュが使えないだけ。通信で続ける */ }
      try{
        const res = await fetch(request);
        if (res.ok){
          const copy = res.clone();
          const save = (async () => {
            try{
              const c = await caches.open(REGIONS);
              await c.put(request, copy);
              await trim(c, REGION_MAX, REGIONS);
            } catch(err){ /* 容量不足など。地図は通信で動く */ }
          })();
          // waitUntil はイベントが閉じた後だと投げる。投げても返事は壊さない。
          try { e.waitUntil(save); } catch(err){ /* 保存は走り続ける */ }
        }
        return res;
      } catch(err){
        const c = await caches.open(REGIONS);
        return (await c.match(request, { ignoreSearch: true }))
            || (await caches.match(request, { ignoreSearch: true }))
            || Response.error();
      }
    })());
    return;
  }

  // A: 本体ファイルは network-first。
  // cache-first にすると、直したはずのコードが端末に届かない（開発中に実際に踏んだ）。
  // 通信があるときは必ず最新を取り、圏外のときだけキャッシュに落とす。
  e.respondWith((async () => {
    if (new URL(url).origin === location.origin){
      try{
        const res = await fetch(request);
        if (res.ok) (await caches.open(SHELL)).put(request, res.clone());
        return res;
      } catch(err){
        // ここで index.html を返してはいけない。CSS や JSON の要求に HTML が返ると、
        // 「200 なのに中身が HTML」という無言の失敗になり、原因が極めて追いにくい
        // （実際に explore.css と places-world.json がこれで壊れた）。
        return (await caches.match(request, { ignoreSearch: true })) || Response.error();
      }
    }
    // CDNはURLにバージョンが入っていて中身が変わらないので cache-first でよい
    const hit = await caches.match(request);
    if (hit) return hit;
    try{
      const res = await fetch(request);
      if (res.ok) (await caches.open(SHELL)).put(request, res.clone());
      return res;
    } catch(err){ return Response.error(); }
  })());
});
