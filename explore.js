/* =========================================================================
   Japan, Then and Now  —  v0.5

   English edition for people outside Japan, now bilingual.
   The Japanese app (index.html) works because you are standing next to the
   stone. From abroad that loop is gone, so this one leans on the thing that
   needs neither language nor presence: the aerial photographs. You drag a line
   across the screen and eighty years pass under your finger.

   Restore point for the previous version: git tag v0.4-stable
   ========================================================================= */

const NOW_YEAR = new Date().getFullYear();
const GSI  = 'https://cyberjapandata.gsi.go.jp/xyz';
const GSI_ATTR = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">GSI Tiles</a>, Geospatial Information Authority of Japan';
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const ESRI_ATTR = 'Basemap &copy; Esri';
/* 地図に出しているピンは OSM 由来なので、ODbL 上いつでも見えていないといけない。
   ベース地図（Esri / 地理院）の切り替えとは独立に、地図そのものに1回だけ足す。 */
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
const NOMINATIM = 'https://nominatim.openstreetmap.org';

const NOW_LAYER = { id: 'seamlessphoto', ext: 'jpg', min: 14, max: 18 };
/* Every aerial series GSI publishes, oldest first. Coverage differs wildly:
   the 1945 survey only covers the areas the US military flew over, so for most
   of the country we have to fall back to a later one. */
/* max is the deepest zoom the tiles actually EXIST at, not the deepest we let
   people zoom to. Measured across all six series and three cities: every one of
   them 404s at z18. With max:18 Leaflet asked for tiles that were not there, the
   old photograph vanished and today's map showed through - which looked exactly
   like the comparison switching itself off. At 17 Leaflet upscales the z17 tile
   instead, so the old photograph stays on screen as you zoom in. */
const OLD_LAYERS = [
  { id: 'ort_USA10', ext: 'png', year: '1945', span: '1945-1950', min: 2,  max: 17 },
  { id: 'ort_old10', ext: 'png', year: '1961', span: '1961-1969', min: 2,  max: 17 },
  { id: 'gazo1',     ext: 'jpg', year: '1974', span: '1974-1978', min: 10, max: 17 },
  { id: 'gazo2',     ext: 'jpg', year: '1979', span: '1979-1983', min: 10, max: 17 },
  { id: 'gazo3',     ext: 'jpg', year: '1984', span: '1984-1986', min: 10, max: 17 },
  { id: 'gazo4',     ext: 'jpg', year: '1987', span: '1987-1990', min: 10, max: 17 },
];
const THEN = {};
for (const L of OLD_LAYERS) THEN[L.id] = L;
const JAPAN = { center: [36.2, 138.3], zoom: 5 };
/* Data files change with every release, and the browser will happily serve
   yesterday's copy from its own HTTP cache without asking the server - which is
   how a rebuilt landmarks.json arrived with no tiers on it. Stamp the release
   onto the URL so a new build is a new resource. Bump with each release. */
const DATA_V = '0.49';
const dj = u => u + (u.indexOf('?') < 0 ? '?v=' : '&v=') + DATA_V;
/* The asset version is read from this script's own URL (explore.js?v=…), so what it fetches is what the page and sw.js
   ask for, not a number written here that falls behind (the search worker sat at 0.80). */
const ASSET_V = ((typeof document !== 'undefined' && document.currentScript && /[?&]v=([^&]+)/.exec(document.currentScript.src)) || [])[1] || '';
const assetUrl = u => ASSET_V ? u + '?v=' + ASSET_V : u;
/* At what zoom each kind of thing appears. The point is that no scale is ever
   empty: pull right back and you still see Fuji, Skytree and the places everyone
   has heard of; zoom in and the map fills up in stages.
   Landmark tiers come from Wikipedia pageviews (tools/rank.py), not from opinion. */
const TIER_ZOOM   = { 1: 4, 2: 6, 3: 8 };
/* 大きさの段 p1..p4。tier とは別の欄。tier は「出し始めるズーム」、pop は「大きさ」。
   一緒にすると、大きさを変えただけのつもりで z4-z5 に出る名所が入れ替わる。
   名所34件は英語版＋日本語版の12か月の閲覧数で機械的に決める（tools/rank.py）。
   物語つき19か所は p1、リミナル26件は p3 で固定。閲覧数では測らない ——
   『命を救った石』の wiki 欄は "2011 Tohoku earthquake and tsunami" で実測 1,677,674。
   測ってしまうと路傍の石が富士山（1,135,329）より大きい日本一のピンになる。
   伝承碑・地元スポット・Wikipedia近傍検索には段を付けない。読まれた数の手がかりが
   無いものに人気度を割り当てるのは、数字の形をした作り話になる。 */
const POP_CLS      = ['p1', 'p2', 'p3', 'p4'];
const POP_CLS_MINI = ['p1 mini', 'p2 mini', 'p3 mini', 'p4 mini'];
const POP_LIM      = 3;   // minZoom is 4, so tier 1 is always on screen
// Regional walking/historical selections use pop=2 in regional-landmarks-v1.json.
// Their size is editorial; the original 34 landmarks retain their measured ranks.
const LIM_ZOOM    = 8;       // the liminal spots, nationwide (件数は data/liminal.json が正本)
const MONU_ZOOM   = 9;       // disaster memorial stones, 2,469 nationwide
const DETAIL_ZOOM = 12;      // wikipedia articles nearby. The geosearch radius
                             // caps at 10km, which still covers most of a phone
                             // screen at z12; below that it would only fill the middle.
const LOCAL_ZOOM  = 15;      // roadside stones, old houses, named slopes
const CLOSE_ZOOM  = 18;      // everything left: the stone by the roadside

/* =========================================================================
   0. Language
   ========================================================================= */
let LANG = 'en';   // 実際の値は T の定義後に detectLang() で決める
/* A stable language URL lets a search result land in the visitor's language.
   The app still falls back to the browser language when no language URL was chosen. */
const LANG_PARAM = { en: 'en', ja: 'ja', ko: 'ko', 'zh-Hans': 'zh-CN', 'zh-Hant': 'zh-TW' };
const PARAM_LANG = Object.fromEntries(Object.entries(LANG_PARAM).flatMap(([lang,param])=>[[param,lang],[lang,lang]]));

/* Crawlable links are built here and nowhere else. Cards, the place list and the language
   links point at the canonical page: never at a #hash on the map (Google reads
   "/?lang=en#hiroshima" as the home page) and never at a .html spelling that only redirects. */
const LOCALE_HOME = { en: '/', ja: '/ja', ko: '/ko', 'zh-Hans': '/zh-cn', 'zh-Hant': '/zh-tw', th: '/th' };
const PLACE_DIR = { en: '', ja: 'ja/', ko: 'ko/', 'zh-Hans': 'zh-cn/', 'zh-Hant': 'zh-tw/' };
const placeURL = (id, lang = LANG) => '/place/' + (PLACE_DIR[lang] || '') + id;
const liminalURL = id => '/place/l-' + id;          // liminal articles are English pages
/* Ctrl/⌘/Shift/middle-click on a card keeps the browser's own link behaviour (new tab). */
const keepLinkClick = e => !!(e && (e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey));

const T = {
  en: {
    lead: 'Compare real aerial photographs on the map.<br>Drag the slider and watch <b>eighty years</b> go by.',
    modePlaces: 'Featured places', modeMap: 'Whole map', modeLiminal: 'Liminal Japan',
    noteLiminal: 'Places that feel like nowhere \u2014 and most are near a city, so you can go.',
    modeLab: '3D reconstruction', noteLab: 'Places rebuilt in 3D from aerial photographs and records. No. 1 is Gunkanjima. Tap the card or the button to open the model.',
    heroSub: 'Historic maps, hidden gems and walks through Japan',
    heroSearch: 'Search a place on the map',
    liminalWhat: 'What makes it liminal',
    limIntroHTML: `<h2>What is a liminal space?</h2>
      <p>You have probably stood in one. A shopping centre ten minutes after it closes.
      Your school during the summer holidays. A hotel corridor at four in the morning.
      Nothing is broken, the lights are on, everything still works &mdash; there is just
      nobody there, and it feels wrong in a way that is hard to put into words.</p>
      <p>That feeling has a name: a <b>liminal space</b>. <i>Liminal</i> means a threshold,
      somewhere you are meant to walk through rather than stop in. Corridors, stairwells,
      lobbies, car parks, station platforms. Catch one empty and it stops being background.
      It starts looking like a place waiting for someone who is not coming.</p>
      <p>The internet's version is <b>the Backrooms</b>. In 2019 someone posted one blurry
      photo of an empty yellow office &mdash; damp carpet, humming lights, no way out in
      shot &mdash; and it travelled the world. Nobody knew where it was taken. Everybody
      recognised the feeling.</p>
      <p>Japan has a lot of these, and there is a reason. The country built hard for a
      population that then stopped growing, and it would rather maintain a building than
      knock it down. So you get a hot-spring town with no guests, a mining town with no
      mine, a station 486 steps deep with about five trains each way a day. Not ruins.
      Not really alive either.</p>
      <p class="lim-note">Every place below is real and on the map, and most are close
      enough to Tokyo, Osaka or Fukuoka that you could actually go. A few cannot be
      entered &mdash; where that is true, the page says so. Please never climb into
      somewhere you are not allowed to be.</p>`,
    photoBy: 'Photo: Wikimedia Commons',
    notePlaces: 'Hand-picked spots, each with a short story.',
    noteMap: 'Search anywhere in Japan, then compare it with 1945.',
    credits: 'Maps and aerial photographs: <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">GSI Tiles</a>, Geospatial Information Authority of Japan. Street basemap © Esri. Places and addresses from © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors (ODbL). Articles from Wikipedia (CC BY-SA 4.0).',
    search: 'Search a place, station or address',
    roamTip: 'Tap a marker to read about it, then compare it with 1945.',
    dragHint: 'drag me', stopCompare: 'Stop comparing',
    compareYear: y => 'Compare ' + y + ' with today',
    noOldPhoto: 'No old aerial photograph covers this spot.',
    readWiki: 'Read more on Wikipedia',
    aboutLead:     'Wikipedia has no article about this exact spot. You can read about:',
    aboutLeadAlso: 'You can also read about:',
    aboutArea:     n => 'About the area: ' + n,
    readWikiJa: 'Read the Japanese article',
    readWikiEn: 'Read on English Wikipedia', gmap: 'Google Maps', share: 'Share',
    zoomIn: 'Zoom in to compare 1945 with today.',
    noPhoto: p => 'No ' + p + ' photograph was taken here. Try Hiroshima, Tokyo, Osaka or Kyoto.',
    jaOnly: 'Japanese source — no English article',
    loading: 'Loading…', noSummary: 'No summary available.',
    srcWikiEn: 'Source: English Wikipedia (CC BY-SA)',
    srcWikiJaTr: 'Source: summary of the Japanese Wikipedia article, translated (CC BY-SA)',
    srcAggregated: 'This description was pieced together from several public web pages. No single source stands behind it, so treat it as a rough guide rather than a checked fact.',
    srcTags: 'This description was assembled automatically from the OpenStreetMap tags on this spot, not from anything written about it. Treat it as a rough guide rather than a checked fact.',
    photoAir: 'This spot from the air today (GSI Tiles)',
    tapRed: 'Tap the red button to read the whole article in English.',
    memorial: 'memorial', memorialStone: 'Memorial stone',
    stoneBody: 'This is a <b>disaster memorial stone</b>. People carved it so that later generations would remember what happened on this spot.',
    stoneRecords: 'What it records',
    stoneJa: 'The inscription is recorded in Japanese:',
    erected: 'erected', yearsAgo: n => n + ' years ago',
    famous: 'One of Japan’s best known places. Tap below to read about it.',
    noResults: 'Nothing found.', located: 'You are here.',
    noGeo: 'Location is not available.', copied: 'Link copied.',
    address: 'Address', localSpot: 'Local landmark',
    official: 'Find official / city pages',
    aKind: k => 'This is a ' + k + '. There is no English Wikipedia article for it yet.',
    showOriginal: 'Show the original Japanese',
    save: '☆ Save', saved: '★ Saved', myTitle: 'My spots',
    savedToast: n => '★ Saved: ' + n,
    unsavedToast: n => 'Removed: ' + n,
    closeTip: 'Fully zoomed in — the small local things appear here: roadside stones, ruins, old sites.',
    myEmpty: 'Nothing saved yet. Open a place and tap Save.',
    guideBtn: '? Guide', guideTitle: 'Guide & FAQ',
    guideHTML: `<h3>How to use it</h3><ol>
      <li><b>Featured places</b> — {places} hand-picked spots. Each one opens with the 1945 photograph already beside today's.</li>
      <li><b>Whole map</b> — search a place, station or address, or tap ◎ for where you are.</li>
      <li>Tap any marker, then tap <b>Compare 1945 with today</b>. Drag the white line across the screen.</li>
      <li>Tap <b>☆ Save</b> to keep a spot on this device. It appears under <b>My spots</b>.</li>
      </ol>
      <h3>What the markers mean</h3>
      <p><b>Large</b> — famous places. The bigger the circle, the more people read about
      that place on Wikipedia over the last year, in English and Japanese together. There are
      four sizes, and every place in a size is drawn the same. Red circles are the places we
      wrote a story for.<br>
      <b>Medium</b> — Wikipedia articles nearby, and red ones are disaster memorial stones.<br>
      <b>Small</b> — little local places, shown once you zoom right in: {locals} of them, across all 47 prefectures.</p>
      <p>Medium and small are not a ranking. There is no way to count how many people read
      about a roadside stone, so we do not pretend to know.</p>
      <p>On a phone the markers keep a minimum distance from each other, so a busy area shows fewer of them. Zoom in and more appear.</p>
      <p class="faq-q">Is it free?</p>
      <p class="faq-a">Yes. No account, no sign-up, nothing to install. It runs in the browser.</p>
      <p class="faq-q">Which year am I comparing with?</p>
      <p class="faq-a">Whichever old survey actually covers that spot. The button tells you: <b>Compare 1945</b>, <b>Compare 1961</b>, and so on. The 1945-1950 photographs were flown by the US military, so they only cover part of the country; where they are missing the app steps forward to the next survey.</p>
      <p class="faq-q">Why is half the screen blank when I compare?</p>
      <p class="faq-a">No aerial survey covers that spot at all. The app says so rather than leaving you guessing.</p>
      <p class="faq-q">What is Liminal Japan?</p>
      <p class="faq-a">A third list, separate from the historical map: {lim} places in Japan that feel
      like nowhere. Abandoned islands, an amusement park with no visitors, a station 486 steps
      underground. Each entry explains what specifically makes it feel that way, and you can still
      compare it with the old aerial photographs.</p>
      <p class="faq-q">Are the liminal places safe to visit?</p>
      <p class="faq-a">Some are ordinary tourist sites. Others are closed, restricted or dangerous,
      and a few are private property. Read the linked article before going anywhere, and do not
      trespass. This site maps them; it does not invite you inside.</p>
      <p class="faq-q">Does it work on a phone?</p>
      <p class="faq-a">It is built for a phone first. Add it to your home screen and it opens full screen like an app. Pinch to zoom; the markers thin out automatically so they stay tappable.</p>
      <p class="faq-q">Some articles are in Japanese.</p>
      <p class="faq-a">Japanese Wikipedia has about four times as many articles on the ground in Japan. Where no English article exists, the button opens the Japanese article and says so on the button. Your browser can translate it. We used to route it through a translation proxy; that stopped working, and an open Japanese page beats a link that goes nowhere.</p>
      <p class="faq-q">Does it cover the whole of Japan, or only the famous places?</p>
      <p class="faq-a">The whole country. Beyond the {places} featured comparisons, zooming in
      shows {locals} small local places &mdash; shrines, stations, monuments, old schools &mdash;
      across all 47 prefectures, drawn from OpenStreetMap, plus {monu} disaster memorial stones
      recorded by the Geospatial Information Authority of Japan. The old photographs work anywhere
      the surveys reached, not only on the featured spots.</p>
      <p class="faq-q">What does the 🏛 button do?</p>
      <p class="faq-a">It searches the local council's own website for that place. Japanese
      municipal sites sit under the lg.jp domain and carry opening hours, access and closures that
      Wikipedia does not. The search is written in Japanese even when you are reading in English,
      because the pages themselves are Japanese &mdash; an English search returns nothing.</p>
      <p class="faq-q">Is my saved list private?</p>
      <p class="faq-a">Yes. It is stored in your own browser only. Nothing is sent anywhere and there is no account.</p>
      <p class="faq-q">Can I use the pictures?</p>
      <p class="faq-a">The maps and aerial photographs belong to the Geospatial Information Authority of Japan and must be credited. See the credits at the bottom of the home screen.</p>`
  },
  ja: {
    lead: '地図で、本物の航空写真を見くらべる。<br>線をドラッグすると、<b>80年</b>が動きます。',
    modePlaces: '空から今昔くらべ', modeMap: '日本まるごと地図', modeLiminal: '異世界スポット',
    noteLiminal: 'どこでもない感じのする、異世界みたいな場所（リミナルスペース）。その多くは、街から行ける距離にある。',
    modeLab: '3Dでよみがえる', noteLab: '昔の空中写真と資料から、あの日の町並みを3Dでよみがえらせるシリーズ。第1回は「よみがえる軍艦島（端島）」。カードかボタンを押すと3Dモデルが開きます。',
    heroSub: '昔の地図と写真から、小さな名所を歩く旅へ',
    heroSearch: '地図から場所・駅名を探す',
    liminalWhat: 'どこがリミナルなのか',
    limIntroHTML: `<h2>リミナルスペースって、なに？</h2>
      <p>たぶん、立ったことがあります。閉店10分後のショッピングモール。夏休みの学校。
      朝4時のホテルの廊下。どこも壊れていないし、照明も点いているし、全部ちゃんと動いている。
      ただ、人がいない。それだけなのに、なんとも落ち着かない。</p>
      <p>あの感じに付いた名前が<b>リミナルスペース</b>です。リミナルは「境目」という意味で、
      立ち止まるためではなく、通り抜けるために作られた場所を指します。廊下、階段、ロビー、
      駐車場、駅のホーム。そこに誰もいない瞬間を見ると、ただの背景だったはずの場所が、
      急に「来ない誰かを待っている場所」に見えてきます。</p>
      <p>ネットでの呼び名が<b>バックルーム（The Backrooms）</b>。2019年、誰かが
      黄色い無人のオフィスの、ぼやけた写真を1枚だけ投稿しました。湿ったカーペット、
      鳴りっぱなしの蛍光灯、出口は写っていない。どこで撮られたのか誰も知らないのに、
      世界中に広がりました。みんな、あの感じを知っていたからです。</p>
      <p>日本にはこういう場所が多くて、それには理由があります。人口が増える前提で
      たくさん作り、そのあと増えなかった。そのうえ日本は、壊すより直して使い続けるほうを
      選びがちです。だから、客のいない温泉街、鉱山の閉じた鉱山町、486段下りた先に、上下とも一日5本ほどしか
      列車が来ない駅が残る。廃墟ではない。かといって、生きているわけでもない。</p>
      <p class="lim-note">下に並んでいる場所はぜんぶ実在して、地図に載っています。
      多くは東京・大阪・福岡から行ける距離です。入れない場所もあります。
      その場合はページに書いてあります。入ってはいけないところには、入らないでください。</p>`,
    photoBy: '写真：Wikimedia Commons',
    notePlaces: '物語つきで選んだ名所。',
    noteMap: '日本のどこでも検索して、1945年と見くらべる。',
    credits: '地図・空中写真：<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>（国土地理院）。街路地図 © Esri。地点と住所：© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors（ODbL）。記事：ウィキペディア（CC BY-SA 4.0）。',
    search: '場所・駅名・住所で検索',
    roamTip: 'マーカーを押すと説明が出ます。そのまま1945年と見くらべられる。',
    dragHint: 'ドラッグ', stopCompare: '比較をやめる',
    compareYear: y => y + '年と今を見くらべる',
    noOldPhoto: 'この場所を写した古い空中写真は残っていません。',
    readWiki: 'ウィキペディアで読む',
    aboutLead:     'この場所そのものの記事はありません。かわりに、こんなものが読めます。',
    aboutLeadAlso: 'こちらも読めます。',
    aboutArea:     n => 'このあたりのまち：' + n,
    readWikiJa: 'ウィキペディアで読む',
    readWikiEn: '英語版ウィキペディアで読む', gmap: 'Googleマップ', share: '共有',
    zoomIn: '拡大すると、1945年と見くらべられます。',
    noPhoto: p => 'このあたりでは' + p + 'の写真は撮られていません。広島・東京・大阪・京都で試してください。',
    jaOnly: '日本語の記事',
    loading: '読み込み中…', noSummary: '説明がありません。',
    srcWikiEn: '出典：英語版ウィキペディア（CC BY-SA）',
    srcWikiJaTr: '出典：日本語版ウィキペディアの要約を訳したもの（CC BY-SA）',
    srcAggregated: 'いくつかの公開ページを突き合わせて書いています。出典がひとつに定まらないので、目安まで。',
    srcTags: '地図（OpenStreetMap）に付いたタグから、機械的に組み立てた一文です。誰かが書いた解説ではないので、目安まで。',
    photoAir: 'いま、空から見たこの場所（地理院タイル）',
    tapRed: '下のボタンで全文が読めます。',
    memorial: 'の碑', memorialStone: '災害の碑',
    stoneBody: '<b>自然災害伝承碑</b>。ここで起きたことを、後の人に伝えるために建てられた石碑です。',
    stoneRecords: '記録されている災害',
    stoneJa: '碑文の記録（原文）：',
    erected: '建立', yearsAgo: n => n + '年まえ',
    famous: '日本でいちばん名の知られた場所のひとつ。下のボタンから詳しく読めます。',
    noResults: '見つかりませんでした。', located: '現在地です。',
    noGeo: '現在地を取得できませんでした。', copied: 'リンクをコピーしました。',
    address: '住所', localSpot: '地元の名所',
    official: '自治体・公式ページを探す',
    aKind: k => 'ここは' + k + 'です。',
    showOriginal: '原文を見る',
    save: '☆ 保存', saved: '★ 保存済み', myTitle: 'お気に入り',
    savedToast: n => '★ 保存しました：' + n,
    unsavedToast: n => '保存を解除：' + n,
    closeTip: 'いちばん拡大した状態。道ばたの石碑や跡地、小さな史跡はこの縮尺で出てきます。',
    myEmpty: 'まだ何もありません。気になる場所を開いて「保存」を押すと、ここに並びます。',
    guideBtn: '? つかいかた', guideTitle: 'つかいかた・よくある質問',
    guideHTML: `<h3>つかいかた</h3><ol>
      <li><b>空から今昔くらべ</b> — 選んだ{places}か所。開くとすぐ1945年と今が並びます。</li>
      <li><b>日本まるごと地図</b> — 場所・駅名・住所で検索、◎で現在地へ。</li>
      <li>マーカーを押して <b>1945年と今を見くらべる</b>。白い線を左右にドラッグします。</li>
      <li><b>☆ 保存</b>でこの端末に残ります。<b>お気に入り</b>に出ます。</li>
      </ol>
      <h3>マーカーの意味</h3>
      <p><b>大</b> — 有名な観光地。丸が大きいほど、この1年でウィキペディアを読まれた数が
      多い場所です（英語版と日本語版の合計）。大きさは4段階で、同じ段の中はすべて同じ大きさ。
      赤い丸は、こちらで物語を書いた場所です。<br>
      <b>中</b> — 近くのウィキペディア記事。赤は自然災害伝承碑<br>
      <b>小</b> — 地元の小さな地点（拡大すると出ます）。全国47都道府県で{locals}件あります。</p>
      <p>中と小は順位ではありません。路傍の石が何人に読まれたかを数える方法は無いので、
      分かったふりをしていません。</p>
      <p>スマホではマーカー同士が一定の距離を保つため、密集地では表示数が絞られます。拡大するとその分だけ増えます。</p>
      <p class="faq-q">無料ですか</p>
      <p class="faq-a">無料です。登録もインストールも要りません。ブラウザだけで動きます。</p>
      <p class="faq-q">何年と比べていますか</p>
      <p class="faq-a">その地点を実際に写している一番古い年代です。ボタンに<b>1961年と今を見くらべる</b>のように年が出ます。1945〜1950年の写真は米軍が撮影したもので全国は覆っていないため、無い場所では次に古い年代へ自動で切り替わります。</p>
      <p class="faq-q">比較すると画面の半分が真っ暗になります</p>
      <p class="faq-a">その地点を写した古い空中写真が一つも無い場合です。黙って空白にせず、その旨を表示します。</p>
      <p class="faq-q">リミナルとは何ですか</p>
      <p class="faq-a">歴史地図とは別の3つめの一覧です。どこでもない感じのする日本の{lim}か所を集めました。
      無人島、客のいない遊園地、486段下の駅など。それぞれ「どこがリミナルなのか」を具体的に書いてあり、
      古い空中写真との比較もできます。</p>
      <p class="faq-q">リミナルの場所には行けますか</p>
      <p class="faq-a">普通の観光地もありますが、立入禁止・危険・私有地の場所もあります。
      行く前に必ずリンク先の記事を読み、無断で立ち入らないでください。
      このサイトは地図に載せているだけで、中に入ることを勧めてはいません。</p>
      <p class="faq-q">スマホで使えますか</p>
      <p class="faq-a">スマホを主に想定して作っています。ホーム画面に追加すると全画面のアプリのように開きます。ピンチで拡大でき、マーカーは自動的に間引かれるので押しやすさが保たれます。</p>
      <p class="faq-q">日本語の記事が混ざります</p>
      <p class="faq-a">日本国内では日本語版ウィキペディアの記事数が約4倍あります。英語版が無い場合は日本語版をそのまま開き、ボタンにその旨を出します。以前は翻訳プロキシを経由していましたが、それが使えなくなったためやめました（開かないリンクより、開く日本語の方がましだと判断）。ブラウザの翻訳機能が使えます。</p>
      <p class="faq-q">有名な場所だけですか、日本全国を覆っていますか</p>
      <p class="faq-a">全国です。選んだ{places}か所のほかに、拡大すると
      神社・駅・石碑・古い学校などの地元の地点が{locals}件、全国47都道府県にわたって出ます
      （OpenStreetMap）。さらに国土地理院の自然災害伝承碑が{monu}基。
      古い空中写真も、撮影されている場所なら名所以外でも使えます。</p>
      <p class="faq-q">🏛 のボタンは何ですか</p>
      <p class="faq-a">その場所の自治体の公式ページを探します（lg.jp 内を検索）。
      開館時間・交通・臨時休業など、ウィキペディアには無いことが書いてあります。
      英語表示中でも検索語は日本語で組みます。自治体のページ自体が日本語なので、
      英語で問うと一件も当たらないからです。</p>
      <p class="faq-q">保存した場所は他人に見えますか</p>
      <p class="faq-a">見えません。お使いのブラウザ内だけに保存され、どこにも送信されません。アカウントも不要です。</p>
      <p class="faq-q">写真は使えますか</p>
      <p class="faq-a">地図と空中写真は国土地理院のもので、出典表示が必要です。ホーム下部の出典をご覧ください。</p>`
  }
};
/* 訳の無いキーは英語に落とす。落ちること自体は異常ではない（長文は未訳）。 */
const t = k => {
  const tbl = T[LANG] || T.en;
  return tbl[k] !== undefined ? tbl[k] : T.en[k];
};

/* --- 5言語化（2026-09-09） -------------------------------------------
   訪日客の実績（JNTO 2025年）で選んだ: 韓国945.9万・中国909.6万・台湾676.3万・
   米国330.7万・香港251.7万 → 英語 / 韓国語 / 簡体字 / 繁体字 / 日本語。

   **en と ja のブロックには触っていない。**新しい言語は下に足すだけで、
   訳の無いキーは t() が英語へ落とす。触る面積を小さくして壊さないための形。

   **長文は未訳**（guideHTML / limIntroHTML / credits）。韓国語・中国語では
   ここだけ英語が出る。訳したふりをしないよう、この行を残しておく。 */
T.ko = {
  lead: '지도에서 실제 항공사진을 비교하세요.<br>슬라이더를 움직이면 <b>80년</b>이 지나갑니다.',
  modePlaces: '주요 장소', modeMap: '전체 지도', modeLiminal: '리미널 재팬',
  noteLiminal: '어디에도 속하지 않은 듯한 곳들. 대개는 도시에서 갈 만한 거리에 있다.',
  modeLab: '3D 복원', noteLab: '항공사진과 자료로 장소를 입체로 복원하는 시리즈. 첫 번째는 군함도(하시마). 카드나 버튼을 누르면 3D 모델이 열립니다.',
  heroSub: '옛 지도와 사진으로 만나는 일본 골목 여행',
  heroSearch: '지도에서 장소 검색',
  liminalWhat: '어떤 점이 리미널한가',
  photoBy: '사진: Wikimedia Commons',
  notePlaces: '짧은 이야기가 있는 엄선된 장소들.',
  noteMap: '일본 어디든 검색해서 1945년과 비교해 보세요.',
  search: '장소, 역, 주소 검색',
  roamTip: '마커를 누르면 설명이 뜹니다. 그대로 1945년과 견줘 볼 수 있어요.',
  dragHint: '드래그', stopCompare: '비교 끝내기',
  compareYear: y => y + '년과 오늘을 비교',
  noOldPhoto: '이 지점을 담은 옛 항공사진이 없습니다.',
  readWiki: '위키백과에서 더 읽기',
  aboutLead: '이 지점 자체에 대한 위키백과 문서는 없습니다. 대신 이런 것을 읽을 수 있습니다:',
  aboutLeadAlso: '이런 것도 읽을 수 있습니다:',
  aboutArea: n => '이 지역에 대해: ' + n,
  readWikiJa: '일본어 문서 읽기',
  readWikiEn: '영어 위키백과에서 읽기', gmap: 'Google 지도', share: '공유',
  zoomIn: '확대하면 1945년과 비교할 수 있습니다.',
  noPhoto: p => '여기에는 ' + p + ' 사진이 없습니다. 히로시마, 도쿄, 오사카, 교토를 시도해 보세요.',
  jaOnly: '일본어 출처 — 영어 문서 없음',
  loading: '불러오는 중…', noSummary: '설명이 없습니다.',
  srcWikiEn: '출처: 영어 위키백과 (CC BY-SA)',
  srcWikiJaTr: '출처: 일본어 위키백과 요약을 번역 (CC BY-SA)',
  srcAggregated: '여러 공개 웹페이지를 맞춰 보며 정리했습니다. 출처가 하나로 모이지 않으니 참고만 해 주세요.',
  srcTags: '지도(OpenStreetMap)에 붙은 태그로 기계가 만든 한 줄입니다. 누가 쓴 설명이 아니니 참고만 해 주세요.',
  photoAir: '오늘 하늘에서 본 이 지점 (GSI 타일)',
  tapRed: '빨간 버튼을 누르면 전문을 읽을 수 있습니다.',
  memorial: '비', memorialStone: '재해 전승비',
  stoneBody: '<b>자연재해 전승비</b>. 이 땅에서 일어난 일을 뒷사람에게 전하려고 세운 비석입니다.',
  stoneRecords: '기록된 재해',
  stoneJa: '비문은 일본어로 기록되어 있습니다:',
  erected: '건립', yearsAgo: n => n + '년 전',
  famous: '일본에서 가장 이름난 곳 중 하나. 아래를 누르면 자세히 볼 수 있습니다.',
  noResults: '찾을 수 없습니다.', located: '현재 위치입니다.',
  noGeo: '위치를 사용할 수 없습니다.', copied: '링크를 복사했습니다.',
  address: '주소', localSpot: '동네의 명소',
  official: '공식 / 지자체 페이지 찾기',
  aKind: k => k + '입니다. 아직 영어 위키백과 문서가 없습니다.',
  showOriginal: '일본어 원문 보기',
  save: '☆ 저장', saved: '★ 저장됨', myTitle: '내 장소',
  savedToast: n => '★ 저장: ' + n,
  unsavedToast: n => '삭제: ' + n,
  closeTip: '가장 크게 확대한 상태입니다 — 길가의 비석, 폐허, 옛터 같은 작은 것들이 여기서 보입니다.',
  myEmpty: '아직 아무것도 없습니다. 마음에 드는 곳을 열고 저장을 누르면 여기에 쌓입니다.',
  guideBtn: '? 가이드', guideTitle: '가이드 & FAQ'
};

T['zh-Hans'] = {
  lead: '在地图上比较真实的航空照片。<br>拖动滑块，<b>八十年</b>就过去了。',
  modePlaces: '精选地点', modeMap: '全图', modeLiminal: '阈限日本',
  noteLiminal: '像是不属于任何地方的地方。多半就在城边，真能去。',
  modeLab: '3D复原', noteLab: '用航拍照片和资料把地点复原成立体的系列。第一期是军舰岛（端岛）。点按卡片或按钮即可打开3D模型。',
  heroSub: '从老地图与照片出发，探索日本小众景点',
  heroSearch: '在地图上搜索地点',
  liminalWhat: '它为何显得阈限',
  photoBy: '照片：Wikimedia Commons',
  notePlaces: '精选地点，每处都有一段短故事。',
  noteMap: '搜索日本任何地方，再与1945年对照。',
  search: '搜索地点、车站或地址',
  roamTip: '点一个标记，说明就出来了。接着就能和1945年对照着看。',
  dragHint: '拖动', stopCompare: '结束对照',
  compareYear: y => '把' + y + '年与今天对照',
  noOldPhoto: '没有覆盖此处的旧航空照片。',
  readWiki: '在维基百科上继续读',
  aboutLead: '维基百科没有关于这个具体地点的条目。你可以读：',
  aboutLeadAlso: '也可以读：',
  aboutArea: n => '关于这一带：' + n,
  readWikiJa: '阅读日文条目',
  readWikiEn: '在英文维基百科阅读', gmap: '谷歌地图', share: '分享',
  zoomIn: '放大后可与1945年对照。',
  noPhoto: p => '此处没有拍摄' + p + '的照片。可以试试广岛、东京、大阪或京都。',
  jaOnly: '日文来源 —— 没有英文条目',
  loading: '载入中…', noSummary: '暂无说明。',
  srcWikiEn: '来源：英文维基百科（CC BY-SA）',
  srcWikiJaTr: '来源：日文维基百科摘要的翻译（CC BY-SA）',
  srcAggregated: '这段是把几个公开网页对着看、拼起来写的。出处不止一个，看个大概就好。',
  srcTags: '这一句是机器照着地图（OpenStreetMap）的标签拼出来的，不是谁写的解说，看个大概就好。',
  photoAir: '今天从空中看这个地点（国土地理院瓦片）',
  tapRed: '点红色按钮可读全文。',
  memorial: '碑', memorialStone: '灾害传承碑',
  stoneBody: '<b>自然灾害传承碑</b>。立在这里，是为了让后来的人记得这片土地上发生过的事。',
  stoneRecords: '碑上记录的灾害',
  stoneJa: '碑文以日文记录：',
  erected: '建立', yearsAgo: n => n + '年前',
  famous: '日本最有名的地方之一。点下面可以看得更细。',
  noResults: '没有找到。', located: '你在这里。',
  noGeo: '无法获取位置。', copied: '已复制链接。',
  address: '地址', localSpot: '本地的名胜',
  official: '查找官方／市政页面',
  aKind: k => '这是' + k + '。目前还没有英文维基百科条目。',
  showOriginal: '显示日文原文',
  save: '☆ 收藏', saved: '★ 已收藏', myTitle: '我的地点',
  savedToast: n => '★ 已收藏：' + n,
  unsavedToast: n => '已移除：' + n,
  closeTip: '已放到最大 —— 路边的石碑、废墟、旧址这些小东西会在这里出现。',
  myEmpty: '还什么都没有。打开一个地方按下收藏，就会攒在这里。',
  guideBtn: '? 指南', guideTitle: '指南与常见问题'
};

T['zh-Hant'] = {
  lead: '在地圖上比較真實的航空照片。<br>拖動滑桿，<b>八十年</b>就過去了。',
  modePlaces: '精選地點', modeMap: '全圖', modeLiminal: '閾限日本',
  noteLiminal: '像是不屬於任何地方的地方。多半就在城邊，真能去。',
  modeLab: '3D復原', noteLab: '用航空照片和資料把地點復原成立體的系列。第一期是軍艦島（端島）。點按卡片或按鈕即可開啟3D模型。',
  heroSub: '從老地圖與照片出發，探索日本私房景點',
  heroSearch: '在地圖上搜尋地點',
  liminalWhat: '它為何顯得閾限',
  photoBy: '照片：Wikimedia Commons',
  notePlaces: '精選地點，每處都有一段短故事。',
  noteMap: '搜尋日本任何地方，再與1945年對照。',
  search: '搜尋地點、車站或地址',
  roamTip: '點一個標記，說明就出來了。接著就能和1945年對照著看。',
  dragHint: '拖動', stopCompare: '結束對照',
  compareYear: y => '把' + y + '年與今天對照',
  noOldPhoto: '沒有涵蓋此處的舊航空照片。',
  readWiki: '在維基百科上繼續讀',
  aboutLead: '維基百科沒有關於這個具體地點的條目。你可以讀：',
  aboutLeadAlso: '也可以讀：',
  aboutArea: n => '關於這一帶：' + n,
  readWikiJa: '閱讀日文條目',
  readWikiEn: '在英文維基百科閱讀', gmap: 'Google 地圖', share: '分享',
  zoomIn: '放大後可與1945年對照。',
  noPhoto: p => '此處沒有拍攝' + p + '的照片。可以試試廣島、東京、大阪或京都。',
  jaOnly: '日文來源 —— 沒有英文條目',
  loading: '載入中…', noSummary: '暫無說明。',
  srcWikiEn: '來源：英文維基百科（CC BY-SA）',
  srcWikiJaTr: '來源：日文維基百科摘要的翻譯（CC BY-SA）',
  srcAggregated: '這段是把幾個公開網頁對著看、拼起來寫的。出處不只一個，看個大概就好。',
  srcTags: '這一句是機器照著地圖（OpenStreetMap）的標籤拼出來的，不是誰寫的解說，看個大概就好。',
  photoAir: '今天從空中看這個地點（國土地理院圖磚）',
  tapRed: '點紅色按鈕可讀全文。',
  memorial: '碑', memorialStone: '災害傳承碑',
  stoneBody: '<b>自然災害傳承碑</b>。立在這裡，是為了讓後來的人記得這片土地上發生過的事。',
  stoneRecords: '碑上記錄的災害',
  stoneJa: '碑文以日文記錄：',
  erected: '建立', yearsAgo: n => n + '年前',
  famous: '日本最有名的地方之一。點下面可以看得更細。',
  noResults: '沒有找到。', located: '你在這裡。',
  noGeo: '無法取得位置。', copied: '已複製連結。',
  address: '地址', localSpot: '在地的名勝',
  official: '尋找官方／市政頁面',
  aKind: k => '這是' + k + '。目前還沒有英文維基百科條目。',
  showOriginal: '顯示日文原文',
  save: '☆ 收藏', saved: '★ 已收藏', myTitle: '我的地點',
  savedToast: n => '★ 已收藏：' + n,
  unsavedToast: n => '已移除：' + n,
  closeTip: '已放到最大 —— 路邊的石碑、廢墟、舊址這些小東西會在這裡出現。',
  myEmpty: '還什麼都沒有。打開一個地方按下收藏，就會攢在這裡。',
  guideBtn: '? 指南', guideTitle: '指南與常見問題'
};

/* 端末の言語から選ぶ。国ではなく**端末の言語**で決める理由:
   東京にいる韓国人旅行者に日本語を出しても読めない。読めるかどうかを決めるのは
   居場所ではなく端末の設定なので、そちらに従う。
   一度でも自分で切り替えたら、その選択を優先する。 */
function detectLang(){
  const requested = new URLSearchParams(location.search).get('lang');
  if (requested && PARAM_LANG[requested]) return PARAM_LANG[requested];
  try {
    const saved = localStorage.getItem('tn-lang');
    if (saved && T[saved]) return saved;
  } catch(e){}
  const list = (navigator.languages && navigator.languages.length)
             ? navigator.languages : [navigator.language || 'en'];
  for (let i = 0; i < list.length; i++){
    const l = String(list[i]).toLowerCase();
    if (l.indexOf('en') === 0) return 'en';
    if (l.indexOf('ja') === 0) return 'ja';
    if (l.indexOf('ko') === 0) return 'ko';
    if (l.indexOf('zh') === 0)
      return /hant|tw|hk|mo/.test(l) ? 'zh-Hant' : 'zh-Hans';
  }
  return 'en';                     // 5言語に無い国はすべて英語
}
const LANG_NAMES = { en: 'English', ja: '日本語', ko: '한국어',
                     'zh-Hans': '简体中文', 'zh-Hant': '繁體中文' };
const LANG_SHORT = { en: 'EN', ja: 'JA', ko: 'KO', 'zh-Hans': '简', 'zh-Hant': '繁' };
const LANG_ORDER = ['en', 'ja', 'ko', 'zh-Hans', 'zh-Hant'];
const SEO = {
  "en": {
    "title": "Japan Time Atlas | Historic Maps, Hidden Gems & Walking Japan",
    "description": "Compare old maps and aerial photos with Japan today. Discover small towns, historic streets, local sights and liminal spaces for your next Japan walking trip.",
    "locale": "en_US"
  },
  "ja": {
    "title": "日本の今昔マップ・街歩き・穴場観光 | Japan Time Atlas",
    "description": "古い地図・航空写真と今の日本を比較。路地、古い街並み、小さな観光地やリミナルスペースを探して、歴史散歩や写真撮影の行き先を見つける無料地図。",
    "locale": "ja_JP"
  },
  "ko": {
    "title": "일본 소도시 여행·골목 산책·옛 지도 | Japan Time Atlas",
    "description": "일본의 옛 지도와 항공사진을 현재 지도와 비교하세요. 소도시 여행, 숨은 명소, 골목 산책, 레트로 거리와 리미널 스페이스를 찾는 무료 지도입니다.",
    "locale": "ko_KR"
  },
  "zh-Hans": {
    "title": "日本小众旅行・城市漫步・历史地图 | Japan Time Atlas",
    "description": "对比日本老地图、历史航拍照片与今日地图。寻找小众景点、复古街区、城市漫步和阈限空间，为日本自由行与街头摄影发现新目的地。",
    "locale": "zh_CN"
  },
  "zh-Hant": {
    "title": "日本自由行・私房景點・老街散策 | Japan Time Atlas",
    "description": "比較日本老地圖、歷史航拍照片與今日地圖。探索小眾景點、懷舊街景、城市散步與閾限空間，為日本自由行及街頭攝影尋找新目的地。",
    "locale": "zh_TW"
  }
};

function applySEO(){
  const seo = SEO[LANG] || SEO.en;
  const set = (id, content) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('content', content);
  };
  document.title = seo.title;
  set('metaDescription', seo.description);
  set('ogTitle', seo.title);
  set('ogDescription', seo.description);
  set('twitterTitle', seo.title);
  set('twitterDescription', seo.description);
  set('ogLocale', seo.locale);

  // The interactive ?lang= switch is a user preference, not a separate
  // crawl target. Actual translated pages live at /ja, /ko and so on.
  const url = 'https://japantimeatlas.com/';
  const canonical = document.getElementById('canonicalUrl');
  if (canonical) canonical.setAttribute('href', url);
  set('ogUrl', url);
}

/* =========================================================================
   1. State
   ========================================================================= */
const ACTIVITIES = window.AtlasActivities?.places || [];


let PLACES = [], LANDMARKS = [], MONUMENTS = null, LOCALS = [], LIMINAL = [];
let TOPICS = null, AREAS = null;   // 種類の記事 / まちの記事。無ければ黙る
let mode = 'places';
let MON_INDEX = [], MON_BY_ID = new Map();
let idxLoading = null;
let map = null, baseLayer = null, nowLayer = null, thenLayer = null;
let spotLayer = null, detailLayer = null, meMarker = null;
let roaming = false, current = null, compareAt = null, sharePayload = null;
let lastPanel = null;      // redraw the open panel when the language changes
let panelToken = 0;        // async replies from an older panel must not land in a newer one
let compareLayer = null;   // which old series is actually available here
const wikiSeen = new Map(), wikiAsked = new Set(), addrCache = new Map();
let monLoading = null;

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const KIND_EN = { '洪水':'Flood', '土砂災害':'Landslide', '高潮':'Storm surge',
  '地震':'Earthquake', '津波':'Tsunami', '火山災害':'Volcanic eruption', 'その他':'Other' };
const KIND_EMOJI = { 'Flood':'🌀','Landslide':'⛰️','Storm surge':'🌊','Earthquake':'💥',
  'Tsunami':'🌊','Volcanic eruption':'🌋','Other':'🪧' };
const kindsRaw = k => String(k || '').split('・').filter(x => KIND_EN[x]);
const kindsOut = k => kindsRaw(k).map(x => LANG === 'ja' ? x : KIND_EN[x]);

/* Google's translation proxy. Verified against an article with no English
   version at all: ルネスホール renders as "Runes Hall" in full English. */
/* Not everything has a Wikipedia article, and OpenStreetMap's `website` tag is
   thin for Japanese heritage sites - measured 0 hits out of 6 well-known spots.
   What does exist for almost every place is the municipality's own page, and in
   Japan those all sit under the lg.jp domain. So we hand over a search scoped to
   lg.jp rather than inventing a link.

   Do NOT route this through Google's translate proxy. Measured 2026-09-07:
   translate.google.com/translate?u=<a google search> redirects to
   www-google-com.translate.goog/search and Google answers with its
   "unusual traffic from your computer network" bot interstitial, so the
   button led nowhere. The plain search URL below returns the intended
   results from the same network in the same minute (checked with
   "姫路城 site:lg.jp" - top hit www.city.himeji.lg.jp/castle).
   English readers get Google's own interface in English via hl=en; the
   municipal pages themselves are Japanese and the browser can translate
   them, which the proxy cannot be relied on to do. */
/* 問いを組むのは日本語の語だけ。lg.jp のページは日本語で書かれているので、
   ローマ字名や英訳名を混ぜると site: と AND で結ばれて一件も返らなくなる。 */
const HAS_JA = s => /[々぀-ヿ㐀-鿿]/.test(String(s || ''));
const OFFICIAL = q => 'https://www.google.com/search?q='
  + encodeURIComponent(q + ' site:lg.jp') + (LANG === 'en' ? '&hl=en' : '');

/* 名前も市町村名も無いうちはボタンを出さない。以前はパネルを開いた瞬間に
   href を入れてしまっていたので、中身の無い問いを押しつけていた。 */
function paintOfficial(){
  const el = $('pOfficial');
  if (!el) return;
  const q = [el.dataset.name || '', el.dataset.muni || ''].filter(Boolean).join(' ');
  if (!el.dataset.at || !q){ el.hidden = true; el.removeAttribute('href'); return; }
  el.hidden = false;
  el.href = OFFICIAL(q);
  el.textContent = '🏛 ' + t('official');
}

/* OSM の wikipedia タグは "言語:記事名"。ja: だけを剥がしていたので、
   "en:Ryūun-in (Matsumae)" のような141件が
   ja.wikipedia.org/wiki/en:Ryūun-in... という存在しないURLになっていた。
   接頭辞が無いものは日本語版として扱う（OSM日本の慣行）。 */
/* 記事名に "#" が入るタグがある（ja:早稲田大学#校歌 など）。丸ごと
   encodeURIComponent すると %23 になり、MediaWiki が不正な記事名として蹴る。 */
const wikiPath = title => String(title).split('#')
  .map(x => encodeURIComponent(x.replace(/ /g, '_'))).join('#');

/* 言語コードの白名簿。知らないコードなら「リンクを出さない」を選ぶ。
   でたらめなホスト名を組み立てて死んだリンクを出すよりよい。 */
const WIKI_LANGS = new Set(('ja en fr de nl zh ko ru es it pt pl sv fi da no cs vi th id '
  + 'tr uk he el hu ro bg ca eu gl lt lv et sl sk hr sr bs mk sq is ga cy la eo ar simple').split(' '));

function wikiTagParse(v){
  const m = /^([a-z]{2,3})[:：](.+)$/.exec(String(v || '').trim());
  if (m) return WIKI_LANGS.has(m[1]) ? { lang: m[1], title: m[2].trim() } : null;
  const t = String(v || '').trim();
  return t ? { lang: 'ja', title: t } : null;
}

/* その記事へのリンクを、読み手の言語に合わせて作る。
   英語話者に日本語版しか無い記事を渡すときは翻訳をかぶせる。
   記事名を推測して作ることは絶対にしない。タグに書かれたものだけを使う。 */
function wikiTagLink(v){
  const p = wikiTagParse(v);
  if (!p) return null;
  const enc = wikiPath(p.title);
  if (p.lang === 'en')
    return { url: 'https://en.wikipedia.org/wiki/' + enc, translated: false };
  if (p.lang !== 'ja')
    return { url: 'https://' + p.lang + '.wikipedia.org/wiki/' + enc, translated: false };
  return LANG === 'en'
    ? { url: JA_ARTICLE(p.title), translated: true }
    : { url: 'https://ja.wikipedia.org/wiki/' + enc, translated: false };
}

/* 英語版の無い記事へのリンク。**日本語版へ直接** つなぐ。
   以前は ja-wikipedia-org.translate.goog を通して英訳を出していたが、
   2026-09-07 に実測したところ Google の
   「お使いのコンピュータ ネットワークから通常と異なるトラフィックが検出されました」
   が返り、記事が1つも開かなかった（同じ回線・同じ分に ja.wikipedia.org は開く）。
   読めない英訳より、読める日本語のほうがましなので直リンクにした。
   翻訳は閲覧者のブラウザの機能に任せる（そちらは止められない）。
   ボタンの文言も「英語で読む」から「日本語の記事を読む」に直してある。 */
const JA_ARTICLE = title => {
  // "#" は URL の断片として残す。encodeURIComponent で %23 にすると記事が開かない。
  const x = String(title), i = x.indexOf('#');
  const base = i < 0 ? x : x.slice(0, i), frag = i < 0 ? '' : x.slice(i + 1);
  return 'https://ja.wikipedia.org/wiki/'
    + encodeURIComponent(base.replace(/ /g, '_'))
    + (frag ? '#' + encodeURIComponent(frag) : '');
};

function toast(msg){
  const el = $('toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2600);
}

/* =========================================================================
   2. Home
   ========================================================================= */
function tileURL(layer, ext, lat, lon, z){
  const n = 2 ** z, r = lat * Math.PI / 180;
  const x = Math.floor((lon + 180) / 360 * n);
  const y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n);
  return GSI + '/' + layer + '/' + z + '/' + x + '/' + y + '.' + ext;
}

/* Wikimedia thumbnail URLs carry their width, so we can ask for a smaller one.
   Thirty cards at 960px is several megabytes before anyone has scrolled, and a
   CSS background cannot be deferred - an <img> can.
   Not every file has every width though: 6 of the 30 answered 400 for 480px,
   so the tag falls back to the URL the API gave us. */
function thumb(url, px){
  const u = String(url || '');
  /* thumb.wikimedia.org は「すでに生成された大きさ」しか返さない。
     960px- を 480px- に書き換えると 400 になる。これまでは onerror で
     フルサイズに落ちて表示はできていたので気づかず、スマホで900px超の画像を
     何十枚も読ませていた。欲しい大きさはビルド時にAPIへ頼んで焼いてある
     （tools/ 参照）ので、ここでは触らない。 */
  if (u.indexOf('thumb.wikimedia.org') >= 0) return u;
  return u.replace(/\/(\d+)px-/, '/' + px + 'px-');
}

function buildLiminalCards(){
  $('cards').innerHTML = LIMINAL.map((p, i) => {
    const hook = (p.hooks && p.hooks[LANG]) || (LANG === 'ja' ? p.hook_ja : p.hook);
    // 最初の数枚は即時に。上端が空のカードで埋まっていると壊れて見える
    const lazy = 'lazy';
    return '<a class="card card-lim" data-lim="' + esc(p.id) + '" href="' + esc(liminalURL(p.id)) + '">'
      + '<img class="card-img card-photo" loading="' + lazy + '" decoding="async" alt="" '
      + 'src="' + esc(p.img ? thumb(p.img, 480) : tileURL(NOW_LAYER.id, NOW_LAYER.ext, p.lat, p.lon, 16))
      + '" data-full="' + esc(p.img || tileURL(NOW_LAYER.id, NOW_LAYER.ext, p.lat, p.lon, 16)) + '" '
      + 'onerror="if(this.dataset.full&&this.src!==this.dataset.full){this.src=this.dataset.full}">'
      + '<span class="card-emoji">' + p.emoji + '</span>'
      + '<div class="card-body">'
      + '<p class="card-ja">' + esc(p.ja) + '</p>'
      + '<p class="card-name">' + esc(placeName(p)) + '</p>'
      + '<p class="card-hook">' + esc(hook) + '</p></div></a>';
  }).join('');
  /* The card is a real link to the article, so crawlers and new tabs get the page.
     A plain click still opens the map, as it always has. */
  for (const b of $('cards').querySelectorAll('.card-lim'))
    b.onclick = e => { if (keepLinkClick(e)) return; e.preventDefault();
                       showLiminal(LIMINAL.find(p => p.id === b.dataset.lim)); };
}


/* Activity cards deliberately reuse the existing atlas card / map / panel flow. */
const ACTIVITY_COPY = {
 en: ['Enjoy Japanese food','Go shopping','Markets, local dishes and food streets across Japan.','Shopping streets, crafts and Japanese design.','Official visitor information','Map preview · GSI','Compare the surrounding streets across time. The marker indicates the area, not a specific shop entrance.','Opening days and services vary by shop. Check the official guide before visiting.','Food stalls may close in bad weather. Check the city guide for today’s options.','Enjoy purchases in the areas provided by each shop.','Shop hours vary; check the official guide for current information.','These destinations are editorial picks, arranged from north to south.'],
 ja: ['ご当地グルメ旅','商店街ぶらり散歩','朝市・市場、郷土料理、食の通りを北から南まで。','レトロな商店街、工芸品、日本のデザインを探す。','公式の訪問案内','地図プレビュー · 国土地理院','今昔マップで周辺の道や町並みを見比べられます。ピンはエリアの代表地点で、個別店舗の入口ではありません。','営業日やサービスは店舗ごとに異なります。訪問前に公式案内をご確認ください。','屋台は天候などで休業することがあります。市の案内で営業情報をご確認ください。','購入した食べ物は、各店が案内する飲食スペースで楽しみましょう。','営業時間は店舗によって異なります。最新情報は公式案内をご確認ください。','スポットは編集部の選定で、北から南の順に掲載しています。'],
 ko: ['일본 음식 즐기기','쇼핑 즐기기','일본 각지의 시장, 향토 요리와 음식 거리.','상점가와 공예품, 일본 디자인을 찾아보세요.','공식 방문 안내','지도 미리보기 · GSI','옛 지도와 현재 지도로 주변 거리를 비교하세요. 핀은 지역의 대표 지점이며 개별 가게 입구가 아닙니다.','영업일과 서비스는 가게마다 다릅니다. 방문 전 공식 안내를 확인하세요.','포장마차는 날씨에 따라 쉬기도 합니다. 시 공식 안내를 확인하세요.','음식은 각 가게가 안내하는 장소에서 즐겨주세요.','영업시간은 가게마다 다릅니다. 최신 공식 안내를 확인하세요.','편집 선정 장소를 북쪽에서 남쪽 순서로 소개합니다.'],
 'zh-Hans': ['品尝日本美食','购物寻宝','探索日本各地的市场、地方料理与美食街。','寻找商店街、工艺品与日本设计。','官方参观指南','地图预览 · GSI','比较周边街道的今昔变化。标记为区域代表地点，并非具体店铺入口。','营业日期和服务因店铺而异，请在到访前查看官方指南。','屋台可能因天气休息，请查看市政府的官方指南。','请在各店指定的用餐区域享用购买的食物。','营业时间因店铺而异，请查看最新官方指南。','地点由编辑精选，按从北到南的顺序排列。'],
 'zh-Hant': ['品嚐日本美食','購物尋寶','探索日本各地的市場、地方料理與美食街。','尋找商店街、工藝品與日本設計。','官方參觀指南','地圖預覽 · GSI','比較周邊街道的今昔變化。標記為區域代表地點，並非個別店鋪入口。','營業日期和服務因店鋪而異，請在到訪前查看官方指南。','屋台可能因天候休息，請查看市政府的官方指南。','請在各店指定的用餐區域享用購買的食物。','營業時間因店鋪而異，請查看最新官方指南。','地點由編輯精選，按從北到南的順序排列。']
};
const activityText = n => (ACTIVITY_COPY[LANG] || ACTIVITY_COPY.en)[n];
const isActivityMode = m => m === 'food' || m === 'shopping';
const activityLabel = category => activityText(category === 'food' ? 0 : 1);
for (const [lang,copy] of Object.entries(ACTIVITY_COPY)) {
 T[lang].modeFood = copy[0]; T[lang].modeShopping = copy[1];
}
function buildActivityCards(){
 $('cards').innerHTML = ACTIVITIES.filter(p=>p.category===mode).map(p=>
  '<button class="card card-activity" data-activity="'+esc(p.id)+'">'
  +'<img class="card-img card-photo" width="480" height="320" alt="" loading="lazy" decoding="async" src="'+tileURL(NOW_LAYER.id,NOW_LAYER.ext,p.lat,p.lon,15)+'">'
  +'<span class="card-emoji" aria-hidden="true">'+p.emoji+'</span>'
  +'<span class="card-era">'+esc(activityText(5))+'</span>'
  +'<div class="card-body"><p class="card-ja">'+esc(p.ja)+'</p>'
  +'<p class="card-name">'+esc(placeName(p))+'</p>'
  +'<p class="card-hook">'+esc(p.hooks[LANG]||p.hooks.en)+'</p>'
  +(p.notes?'<p class="card-note">'+esc(p.notes[LANG]||p.notes.en)+'</p>':'')+'</div></button>'
 ).join('');
 for(const b of $('cards').querySelectorAll('[data-activity]'))
  b.onclick=()=>showActivity(ACTIVITIES.find(p=>p.id===b.dataset.activity));
}
function showActivity(p,keepView,refresh=false){
 if(!p)return;
 lastPanel=()=>showActivity(p,true,true);
 document.body.classList.remove('roaming');
 $('home').hidden=true; $('place').hidden=false;
 ensureMap();
 if(!keepView)map.setView([p.lat,p.lon],15);
 setTimeout(()=>map.invalidateSize(),60);
 setThenLayer(null,null);
 drawSpots([{lat:p.lat,lon:p.lon,name:placeName(p),emoji:p.emoji}],true,()=>showActivity(p,true));
 roaming=false; current=null;
 drawDetail(); setTimeout(drawDetail,900);
 panelShell({
  kicker:{emoji:p.emoji,label:activityLabel(p.category),note:'  '+placeName(p)},
  placeId:'a-'+p.id,adTier:3,kind:p.category,ja:LANG==='ja'?'':p.ja,name:placeName(p),at:[p.lat,p.lon],query:p.name,
  bodyHTML:'<p>'+esc(p.hooks[LANG]||p.hooks.en)+'</p>'+(p.notes?'<p>'+esc(p.notes[LANG]||p.notes.en)+'</p>':'')+'<p>'+esc(activityText(6))+'</p>'
    +'<p class="p-pick">'+esc(activityText(p.category==='shopping'?10:p.id==='nakasu-yatai'?8:7))+'</p>'
    +(p.category==='food'?'<p>'+esc(activityText(9))+'</p>':'')
    +'<p class="place-guide-link"><a href="'+esc(p.official)+'" target="_blank" rel="noopener noreferrer">'+esc(activityText(4))+' ↗</a></p>',
  img:tileURL(NOW_LAYER.id,NOW_LAYER.ext,p.lat,p.lon,16),cap:activityText(5),
  share:{title:placeName(p),url:location.origin+location.pathname+'?lang='+(LANG_PARAM[LANG]||'en')+'#a-'+p.id},
  searchName:p.ja,src:'GSI Tiles · '+activityText(11)
 });
 if(!keepView)history.pushState({activity:p.id},'','#a-'+p.id);
}
function restoreActivity(){
 const p=location.hash.startsWith('#a-')&&ACTIVITIES.find(p=>p.id===location.hash.slice(3));
 if(!p)return false;
 setMode(p.category); noPush(showActivity,p); return true;
}

/* Tab 06: the 3D reconstructions. One entry per reconstruction; the next place is added here and
   gets its card, and scripts/build-3d-pages.cjs lists the same set on the /3d/ series pages. */
const LAB_ITEMS = [{
  path: 'gunkanjima', img: '/3d/gunkanjima-card.jpg?v=4', era: '1947 → NOW · 3D', ja: '端島 · Hashima',
  name: { en: 'Gunkanjima (Hashima Island) in 3D, 1947 to today', ja: 'よみがえる軍艦島（端島）　全盛期の町並みと当時の暮らしを3Dで', ko: '군함도(하시마) 3D 복원, 1947년부터 지금까지', 'zh-Hans': '军舰岛（端岛）3D复原，1947年至今', 'zh-Hant': '軍艦島（端島）3D復原，1947年至今' },
  hook: { en: 'The coal-mining island rebuilt building by building. Slide through the years, tap a building for its facts, step inside, or listen to the audio guide.', ja: '炭鉱で栄えた島を建物ごとに再現。年代を動かすと全盛期の町並みが立ち上がり、建物を押すと竣工年や用途、中に入ると当時の暮らしが見られます。音声ガイドつき。', ko: '탄광 섬을 건물별로 복원. 연도를 움직이고, 건물을 눌러 준공년과 용도를 읽고, 안에 들어가고, 음성 가이드도 들을 수 있습니다.', 'zh-Hans': '逐栋复原煤矿岛。拖动年代，点按建筑查看竣工年和用途，走进内部，也能收听音频导览。', 'zh-Hant': '逐棟復原煤礦島。拖曳年代，點按建築查看竣工年和用途，走進內部，也能收聽語音導覽。' }
}];
const LAB_OPEN = { en: '▶ Open the 3D model', ja: '▶ 3Dモデルを開く', ko: '▶ 3D 모델 열기', 'zh-Hans': '▶ 打开3D模型', 'zh-Hant': '▶ 開啟3D模型' };
const LAB_DIR = { en: '', ja: 'ja/', ko: 'ko/', 'zh-Hans': 'zh-cn/', 'zh-Hant': 'zh-tw/' };
function labHref(item){ return '/3d/' + (LAB_DIR[LANG] || '') + item.path; }
function buildLabCards(){
  $('cards').innerHTML = LAB_ITEMS.map(it => '<a class="card card-lab" href="' + labHref(it) + '">'
    + '<img class="card-img card-photo" alt="" loading="lazy" decoding="async" src="' + it.img + '">'
    + '<span class="card-emoji">🧪</span>'
    + '<span class="card-era">' + esc(it.era) + '</span>'
    + '<span class="card-cta">' + esc(LAB_OPEN[LANG] || LAB_OPEN.en) + '</span>'
    + '<div class="card-body">'
    + '<p class="card-ja">' + esc(it.ja) + '</p>'
    + '<p class="card-name">' + esc(it.name[LANG] || it.name.en) + '</p>'
    + '<p class="card-hook">' + esc(it.hook[LANG] || it.hook.en) + '</p>'
    + '</div></a>').join('');
}

function buildCards(){
  window.AtlasWalking?.refresh();
  if (isActivityMode(mode)) return buildActivityCards();
  if (mode === 'liminal') return buildLiminalCards();
  if (mode === 'lab') return buildLabCards();
  $('cards').innerHTML = PLACES.map(p => {
    const lyr = (p.then && THEN[p.then]) ? p.then : NOW_LAYER.id;
    const cfg = p.then && THEN[p.then];
    const ext = cfg ? cfg.ext : NOW_LAYER.ext;
    return '<a class="card" data-id="' + esc(p.id) + '" href="' + esc(placeURL(p.id)) + '">'
      + '<img class="card-img card-photo" alt="" loading="lazy" decoding="async" src="' + tileURL(lyr, ext, p.lat, p.lon, 15) + '">'
      + '<span class="card-emoji">' + p.emoji + '</span>'
      + (p.thenLabel ? '<span class="card-era">' + esc(p.thenLabel) + ' → NOW</span>' : '')
      + '<div class="card-body">'
      + '<p class="card-ja">' + esc(p.ja) + ' · ' + esc(p.romaji) + '</p>'
      + '<p class="card-name">' + esc(placeName(p)) + '</p>'
      + '<p class="card-hook">' + esc((p.hooks && p.hooks[LANG]) || (LANG === 'ja' ? p.hook_ja : p.hook)) + '</p>'
      + '</div></a>';
  }).join('');
  for (const b of $('cards').querySelectorAll('.card'))
    b.onclick = e => { if (keepLinkClick(e)) return; e.preventDefault();
                       openPlace(PLACES.find(p => p.id === b.dataset.id)); };
}

const DISCOVERY_ENTRY = {"en":["Choose your next walk","Places and photo stories","Country & region guides","Open a guide in your language. Thai guides open the interactive map in English.","/places",["United States","us"],["United Kingdom","gb"],["Australia","au"],["Canada","ca"],["Singapore","sg"],["South Korea · 한국어","kr"],["Taiwan · 繁體中文","tw"],["Hong Kong · 繁體中文","hk"],["Thailand · ไทย","th"]],"ja":["次の街歩きを見つける","場所の解説を読む","国・地域別の旅行案内","日本国内の散歩や、使いたい言語から探せます。タイ語の案内ページから開く地図は英語です。","/ja",["日本国内","jp"]],"ko":["다음 산책 찾기","장소 이야기 읽기","국가·지역별 여행 안내","원하는 언어로 가이드를 선택하세요. 태국어 가이드의 대화형 지도는 영어로 열립니다.","/ko",["한국에서 일본 여행","kr"]],"zh-Hans":["寻找下一段城市漫步","阅读地点故事","国家与地区旅行指南","按语言选择指南。泰语指南中的互动地图以英语打开。","/zh-cn",["从中国大陆出发","cn"],["从新加坡出发 · English","sg"]],"zh-Hant":["尋找下一段城市散步","閱讀地點故事","國家與地區旅行指南","依語言選擇指南。泰語指南中的互動地圖以英語開啟。","/zh-tw",["從台灣出發","tw"],["從香港出發","hk"]]};
function paintDiscovery(){
 const c=DISCOVERY_ENTRY[LANG]||DISCOVERY_ENTRY.en,box=document.getElementById('discoveryEntry');if(!box)return;
 box.setAttribute('aria-label',c[0]);
 box.querySelector('[data-entry-title]').textContent=c[0];
 const guide=box.querySelector('[data-entry-guide]');guide.textContent=c[1];guide.href=c[4];
 box.querySelector('[data-entry-regions]').textContent=c[2];
 box.querySelector('[data-entry-note]').textContent=c[3];
 box.querySelector('[data-entry-picks]').innerHTML=c.slice(5).map(p=>'<a href="/visit/'+p[1]+'">'+esc(p[0])+' ↗</a>').join('');
}

function applyLang(){
  document.documentElement.lang = LANG;
  applySEO();
  paintDiscovery();
  for (const el of document.querySelectorAll('[data-t]')) el.innerHTML = t(el.dataset.t);
  $('langLabel').textContent = LANG_NAMES[LANG] || 'English';
  $('langBtn2').textContent  = LANG_SHORT[LANG] || 'EN';   // 2文字なら375pxでも折り返さない
  $('q').placeholder         = t('search');
  $('modeNote').textContent  = modeNote();
  if (mode === 'liminal') $('limIntro').innerHTML = t('limIntroHTML');
  paintModeIntro();
  $('roamTip').textContent   = t('roamTip');
  $('dragHint').textContent  = t('dragHint');
  $('tagThen').title         = t('stopCompare');
  paintCompareBtn();
  $('pShare').textContent    = '⇪ ' + t('share');
  paintOfficial();
  renderGuide();
  renderSaved();
  paintAuxUI();
  if (PLACES.length) buildCards();
  if (current) openPlace(current, true,true);
  else {
    /* パネルが画面に出ているときだけ描き直す。ホーム画面に戻ったあとでも
       lastPanel は前に開いたスポットを覚えたままなので、そのまま呼ぶと
       パネルが開いて地図へ飛ばされていた（最初のページで日本語に切り替えると
       地図に飛ぶ、という不具合の正体）。 */
    if (lastPanel && !$('place').hidden) lastPanel();
    drawDetail();
  }
}

function setLang(l){
  LANG = l;
  try { localStorage.setItem('tn-lang', l); } catch(e){}
  try {
    const url = new URL(location.href);
    url.searchParams.set('lang', LANG_PARAM[l] || 'en');
    history.replaceState(null, '', url.pathname + '?' + url.searchParams.toString() + url.hash);
  } catch(e){}
  wikiSeen.clear(); wikiAsked.clear();     // titles differ per language
  ++qSeq; $('qResults').hidden = true;
  applyLang();
}

/* =========================================================================
   3. Map
   ========================================================================= */
function ensureMap(){
  if (map) return;
  // minZoom on the map itself: Leaflet otherwise takes the MAXIMUM of the
  // layers' minZoom, and the aerial layer (14) would pin the whole map there.
  map = L.map('map', { zoomControl: false, attributionControl: true, minZoom: 4, maxZoom: 18 });
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  map.attributionControl.addAttribution(OSM_ATTR);   // レイヤーに紐づけない＝常時表示

  // Esri's street basemap labels Japan in both scripts (東京駅 / Tokyo Sta.),
  // which is exactly what a bilingual app needs. GSI has no English labels.
  baseLayer = L.tileLayer(ESRI, {
    maxZoom: 18, minZoom: 2, crossOrigin: 'anonymous',
    attribution: ESRI_ATTR + ' | ' + GSI_ATTR
  }).addTo(map);

  nowLayer = L.tileLayer(GSI + '/' + NOW_LAYER.id + '/{z}/{x}/{y}.' + NOW_LAYER.ext, {
    maxNativeZoom: NOW_LAYER.max, maxZoom: 18, minZoom: NOW_LAYER.min,
    crossOrigin: 'anonymous', attribution: GSI_ATTR
  });

  map.on('move zoom zoomend moveend viewreset zoomanim', clip);
  map.on('zoomend', zoomGate);
  map.on('zoomend', closeHint);
  let dTimer = null;
  map.on('moveend zoomend', () => { clearTimeout(dTimer); dTimer = setTimeout(drawDetail, 300); });
}

/* Build (or clear) the old-photograph layer and the swipe furniture. */
function setThenLayer(id, label){
  if (thenLayer){ map.removeLayer(thenLayer); thenLayer = null; }
  // 前回ぶんの moveend を必ず外す。off が無いと ON/OFF のたびに1個ずつ増える。
  if (setThenLayer._reset){ map.off('moveend', setThenLayer._reset); setThenLayer._reset = null; }
  const has = !!id;
  for (const el of ['swipe','tagThen','tagNow']) $(el).hidden = !has;
  $('cover').hidden = true;
  if (!has){
    $('dragHint').hidden = true;
    if (nowLayer && map.hasLayer(nowLayer)) map.removeLayer(nowLayer);
    return;
  }
  if (!map.hasLayer(nowLayer)) nowLayer.addTo(map);   // compare photo against photo

  const cfg = THEN[id];
  if (!cfg){ console.warn('unknown layer', id); return; }
  thenLayer = L.tileLayer(GSI + '/' + id + '/{z}/{x}/{y}.' + cfg.ext, {
    maxNativeZoom: cfg.max, maxZoom: 18, minZoom: cfg.min,
    crossOrigin: 'anonymous', attribution: label + ' aerial photography / ' + GSI_ATTR
  }).addTo(map);
  $('tagThen').textContent = label;

  // The old photographs do not cover the whole country. Say so, rather than
  // showing a blank half and letting people conclude the app is broken.
  let ok = 0, ng = 0;
  thenLayer.on('tileload',  () => { ok++; });
  thenLayer.on('tileerror', () => { ng++; });
  thenLayer.on('load', () => {
    if (map.getZoom() < DETAIL_ZOOM){ zoomGate(); return; }
    $('cover').textContent = t('noPhoto')(label);
    $('cover').hidden = !(ng > 0 && ok === 0);
  });
  setThenLayer._reset = () => { ok = 0; ng = 0; };
  map.on('moveend', setThenLayer._reset);

  if (!window.AtlasTime?.active()) { splitSet = false; centreSplit(); }
  else clip();
  $('dragHint').hidden = false;
  clearTimeout(setThenLayer._h);
  setThenLayer._h = setTimeout(() => { $('dragHint').hidden = true; }, 4200);
}

let closeHintShown = false;
function closeHint(){
  if (closeHintShown || !roaming || map.getZoom() < CLOSE_ZOOM) return;
  closeHintShown = true;
  toast(t('closeTip'));
}

function zoomGate(){
  if (!thenLayer) return;
  const tooFar = map.getZoom() < DETAIL_ZOOM;
  for (const el of ['swipe','tagThen','tagNow']) $(el).hidden = tooFar;
  if (tooFar){ $('cover').textContent = t('zoomIn'); $('cover').hidden = false; $('dragHint').hidden = true; }
}

/* ---------- the divider ----------
   Width comes from the map element, not window.innerWidth: on first paint the
   pane can report 0 and the slider then pins itself to the left edge.
   Retries run on a timer, not requestAnimationFrame, because rAF is paused
   while the tab is in the background. */
let splitX = 0, splitSet = false;
const viewW = () => Math.round($('map').getBoundingClientRect().width) || window.innerWidth || 0;

function maxSplit(){
  const m = $('map').getBoundingClientRect(), p = $('panel').getBoundingClientRect();
  const side = window.innerWidth >= 860 && p.width && p.left > m.left + 100;
  return side ? Math.max(80, p.left - m.left - 16) : viewW();
}
function setSplit(x){
  const w = viewW();
  if (!w){ setTimeout(() => setSplit(x), 50); return; }
  splitX = Math.max(0, Math.min(maxSplit(), x));
  splitSet = true;
  $('swipe').style.left = splitX + 'px';
  clip();
}
function centreSplit(tries){
  tries = tries || 0;
  const w = viewW();
  if (!w){ if (tries < 60) setTimeout(() => centreSplit(tries + 1), 50); return; }
  setSplit(Math.min(w / 2, maxSplit() * 0.55));
}
/* Leaflet's tile container is a 0x0 absolutely-positioned div and the tiles
   overflow out of it. `clip-path` resolves against that 0x0 box and hides the
   whole layer; the legacy `clip` property clips overflowing content instead. */
function clip(){
  if (!thenLayer) return;
  const el = thenLayer.getContainer();
  if (!el) return;
  const m = $('map').getBoundingClientRect(), c = el.getBoundingClientRect();
  const dx = m.left - c.left, dy = m.top - c.top, PAD = 3000;
  el.style.clipPath = '';
  el.style.clip = 'rect(' + (dy - PAD) + 'px, ' + (dx + splitX) + 'px, '
                + (dy + m.height + PAD) + 'px, ' + (dx - PAD) + 'px)';
}

(function dragging(){
  const sw = $('swipe');
  let on = false;
  const move = e => { if (!on) return; e.preventDefault(); setSplit(e.touches ? e.touches[0].clientX : e.clientX); };
  const stop = () => { on = false; document.body.style.cursor = ''; };
  sw.addEventListener('pointerdown', e => {
    on = true; document.body.style.cursor = 'ew-resize';
    $('dragHint').hidden = true; e.stopPropagation(); move(e);
  });
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
  sw.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
  window.addEventListener('resize', () => {
    if (thenLayer) setSplit(splitX);
    clearTimeout(dragging._r);
    dragging._r = setTimeout(drawDetail, 250);
  });
  new ResizeObserver(() => { if (!thenLayer) return; splitSet ? clip() : centreSplit(); }).observe($('map'));
})();

/* =========================================================================
   4. Markers — three sizes on purpose
   ========================================================================= */
// Size (pop) is independent of the zoom gate (tier). Only reviewed p1/p2 places
// receive pictorial art; unknown places and smaller pins retain their emoji.
const LANDMARK_ART_BY_ID = Object.freeze({
  "aneyoshi": "aneyoshi-tsunami-stone-v2.webp",
  "fukuoka": "hakata-station-v1.webp",
  "hakodate": "hakodate-landform-v1.webp",
  "himeji": "himeji-castle-v1.webp",
  "hiroshima": "hiroshima-dome-v1.webp",
  "kamakura": "kamakura-daibutsu-v1.webp",
  "kanazawa": "kenrokuen-kotoji-lantern-v1.webp",
  "kobe": "kobe-port-tower-v1.webp",
  "kyoto": "kiyomizu-dera-v1.webp",
  "nagasaki": "nagasaki-peace-statue-v1.webp",
  "nagoya": "nagoya-castle-v1.webp",
  "nara": "todaiji-daibutsuden-v1.webp",
  "okayama": "okayama-castle-v1.webp",
  "osaka": "osaka-castle-v1.webp",
  "regional-1018371": "iimoriyama-sazaedo-v1.webp",
  "regional-1027694": "imai-cho-v1.webp",
  "regional-1054053": "kurashiki-bikan-v1.webp",
  "regional-105698": "ashikaga-school-v1.webp",
  "regional-10577": "goryokaku-v1.webp",
  "regional-1060918": "saitama-railway-museum-c57-v1.webp",
  "regional-109545": "hikone-castle-v1.webp",
  "regional-110590": "kochi-castle-v2.webp",
  "regional-1209245": "fugan-kansui-tenmon-bridge-v1.webp",
  "regional-133236": "obi-castle-otemon-v1.webp",
  "regional-13585": "onomichi-senkoji-v1.webp",
  "regional-136755": "kodokan-mito-v1.webp",
  "regional-1411490": "odawara-castle-v2.webp",
  "regional-1426823": "kitsuki-castle-v1.webp",
  "regional-143898": "nakijin-castle-ruins-v1.webp",
  "regional-1441156": "akita-red-brick-museum-v2.webp",
  "regional-144595": "aso-shrine-romon-v1.webp",
  "regional-1467126": "dazaifu-tenmangu-honden-v1.webp",
  "regional-147949": "edo-tokyo-kodakara-yu-v1.webp",
  "regional-149634": "ryusendo-cave-v1.webp",
  "regional-1516067": "kurayoshi-white-wall-storehouses-v1.webp",
  "regional-153196": "dogo-onsen-honkan-v3.webp",
  "regional-154418": "glover-house-v1.webp",
  "regional-1549755": "hirosaki-castle-v1.webp",
  "regional-1638739": "wakimachi-udatsu-v1.webp",
  "regional-1719403": "uchiko-yokaichi-gokoku-v1.webp",
  "regional-172545": "kotohira-gu-hongu-v1.webp",
  "regional-17954": "amanohashidate-v1.webp",
  "regional-187086": "natadera-hondo-v1.webp",
  "regional-2007615": "horyuji-five-storey-pagoda-v1.webp",
  "regional-203351": "hagi-castle-ruins-v1.webp",
  "regional-205162": "yamadera-nokyodo-v1.webp",
  "regional-205858": "yoshinogari-watchtower-v1.webp",
  "regional-207952": "kawagoe-castle-honmaru-v1.webp",
  "regional-215374": "usuki-stone-buddhas-v1.webp",
  "regional-231267": "sannai-maruyama-v2.webp",
  "regional-233160": "tamozawa-imperial-villa-v1.webp",
  "regional-233623": "iwami-ginzan-ryugenji-mabu-v1.webp",
  "regional-236070": "tomioka-silk-mill-v1.webp",
  "regional-236374": "magome-juku-v2.webp",
  "regional-238688": "seki-juku-v1.webp",
  "regional-245249": "narai-juku-v1.webp",
  "regional-247924": "ikuno-silver-mine-portal-v1.webp",
  "regional-248126": "cape-muroto-lighthouse-v1.webp",
  "regional-2605477": "kawaguchiko-music-forest-v1.webp",
  "regional-269961": "takeda-castle-ruins-v1.webp",
  "regional-27176": "meiji-mura-imperial-hotel-v1.webp",
  "regional-272276": "iga-ueno-castle-v1.webp",
  "regional-28228": "usui-pass-ef63-v1.webp",
  "regional-283745": "iya-kazurabashi-v1.webp",
  "regional-28578": "inuyama-castle-v1.webp",
  "regional-285820": "nezu-shrine-romon-v1.webp",
  "regional-296607": "matsue-castle-v1.webp",
  "regional-311250": "ouchijuku-v1.webp",
  "regional-313749": "ritsurin-engetsukyo-v1.webp",
  "regional-3142321": "nirayama-reverberatory-furnaces-v1.webp",
  "regional-316631": "otaru-canal-v1.webp",
  "regional-3260492": "sakitsu-church-v1.webp",
  "regional-32862": "dejima-kapitan-house-v1.webp",
  "regional-335654": "nakagusuku-castle-ruins-v1.webp",
  "regional-343086": "wakayama-castle-v1.webp",
  "regional-349258": "jinpukaku-v1.webp",
  "regional-353012": "karatsu-castle-v1.webp",
  "regional-358475": "kamo-aquarium-jellyfish-v1.webp",
  "regional-397287": "zuiryuji-butsuden-v1.webp",
  "regional-40306": "sumiyoshi-taisha-sorihashi-v1.webp",
  "regional-417333": "kai-zenkoji-v1.webp",
  "regional-41922": "kairakuen-kobuntei-v1.webp",
  "regional-42676": "kumano-hongu-honden-v1.webp",
  "regional-429094": "kirishima-jingu-v1.webp",
  "regional-43296": "kintaikyo-bridge-v1.webp",
  "regional-433291": "northern-culture-museum-wisteria-v1.webp",
  "regional-492524": "takachiho-shrine-haiden-v1.webp",
  "regional-51919": "kunozan-toshogu-v2.webp",
  "regional-624008": "kakunodate-samurai-house-v1.webp",
  "regional-633864": "fukui-dinosaur-museum-v1.webp",
  "regional-652840": "takayama-jinya-v1.webp",
  "regional-66044": "mojiko-station-v1.webp",
  "regional-66837": "naritasan-three-storey-pagoda-v1.webp",
  "regional-67932": "sankeien-pagoda-v1.webp",
  "regional-712357": "zuihoden-nehanmon-v1.webp",
  "regional-720333": "omihachiman-hachimanbori-v1.webp",
  "regional-735563": "kiyotsu-gorge-v1.webp",
  "regional-78794": "nagano-zenkoji-hondo-v1.webp",
  "regional-804212": "osaka-housing-living-museum-v1.webp",
  "regional-83101": "tofukuji-tsutenkyo-v1.webp",
  "regional-87555": "bitchu-matsuyama-castle-v1.webp",
  "regional-88535": "eiheiji-chokushimon-v1.webp",
  "regional-88539": "chusonji-konjikido-cover-v1.webp",
  "regional-88553": "zuiganji-main-hall-v1.webp",
  "regional-931958": "higashi-chaya-v1.webp",
  "regional-939231": "sawara-townscape-v1.webp",
  "sapporo": "sapporo-tv-tower-v1.webp",
  "sendai": "sendai-station-v1.webp",
  "shuri": "shuri-castle-seiden-v1.webp",
  "tokyo": "sensoji-main-hall-v1.webp",
  "yokohama": "yokohama-minato-mirai-v1.webp"
});
const LANDMARK_ART_BY_WIKI = Object.freeze({
  "Akihabara": "akihabara-electric-town-v1.webp",
  "Fushimi Inari-taisha": "fushimi-inari-torii-v1.webp",
  "Himeji Castle": "himeji-castle-v1.webp",
  "Ise Shrine": "ise-jingu-ujibashi-v1.webp",
  "Kinkaku-ji": "kinkakuji-v1.webp",
  "Kiyomizu-dera": "kiyomizu-dera-v1.webp",
  "Kumamoto Castle": "kumamoto-castle-v1.webp",
  "Matsumoto Castle": "matsumoto-castle-v1.webp",
  "Meiji Shrine": "meiji-jingu-torii-v1.webp",
  "Mount Fuji": "mount-fuji-v1.webp",
  "Nijō Castle": "nijo-castle-karamon-v1.webp",
  "Shibuya Crossing": "shibuya-scramble-v1.webp",
  "Shuri Castle": "shuri-castle-seiden-v1.webp",
  "Tōdai-ji": "todaiji-daibutsuden-v1.webp",
  "Tokyo Skytree": "tokyo-skytree-v1.webp",
  "Tokyo Station": "tokyo-station-v1.webp",
  "Tokyo Tower": "tokyo-tower-v1.webp"
});
function landmarkArt(p, size){
  if (p.pop !== 1 && p.pop !== 2) return '';
  if (size && !/^p[12](?:\s|$)/.test(size)) return '';
  const file = p.id ? LANDMARK_ART_BY_ID[p.id] : LANDMARK_ART_BY_WIKI[p.wiki_en || p.wiki_ja || p.wiki];
  return file ? '/icons/landmarks/' + file : '';
}
// Keep the ordinary marker visible until the image has actually loaded. A
// failed download therefore leaves a useful, clickable marker without retrying.
document.addEventListener('load', e => {
  if (e.target.classList?.contains('landmark-image'))
    e.target.parentElement.classList.add('landmark-ready');
}, true);
function bigIcon(p, ring, withLabel, size){
  const art = landmarkArt(p, size);
  return L.divIcon({ className: 'big-pin ' + (size || 'p1'), iconSize: [0,0], iconAnchor: [0,0],
    html: '<div class="big ' + ring + '"><span>' + p.emoji + '</span>'
        + (art ? '<img class="landmark-image" src="' + art + '" alt="" width="192" height="192" decoding="async" draggable="false">' : '') + '</div>'
        + (withLabel === false ? '' : '<div class="big-label">' + esc(placeName(p)) + '</div>') });
}
const midIcon = (emoji, cls) => L.divIcon({ className: 'sm-pin', iconSize: [0,0], iconAnchor: [0,0],
  html: '<div class="sm ' + cls + '"><span>' + emoji + '</span></div>' });
const tinyIcon = (emoji, cls) => L.divIcon({ className: 'sm-pin', iconSize: [0,0], iconAnchor: [0,0],
  html: '<div class="tiny ' + cls + '"><span>' + emoji + '</span></div>' });

function drawSpots(list, withLabel, onTap){
  if (!spotLayer) spotLayer = L.layerGroup().addTo(map);
  spotLayer.clearLayers();
  for (const p of list){
    const icon = withLabel ? bigIcon(p, 'ring-red')
      : L.divIcon({ className:'spot-pin', iconSize:[0,0], iconAnchor:[0,0],
                    html:'<div class="spot"><div class="spot-dot"></div></div>' });
    const m = L.marker([p.lat, p.lon], { title: placeName(p), riseOnHover: true, icon: icon,
                                         zIndexOffset: 500 });
    if (onTap) m.on('click', () => onTap(p));
    m.addTo(spotLayer);
  }
}

/* =========================================================================
   5. Data
   ========================================================================= */
/* Pins only need a position, a kind and a year. The full records carry long
   Japanese texts and addresses - 1.6MB against 181KB - and are not needed until
   somebody actually taps a stone. */
function loadMonumentIndex(){
  if (idxLoading) return idxLoading;
  idxLoading = fetch(dj('data/monuments-index.json')).then(r => r.ok ? r.json() : [])
    .then(rows => { MON_INDEX = rows.map(r => ({ id: r.i, lat: r.a, lon: r.o, kind: r.k, year: r.y })); })
    .catch(() => { MON_INDEX = []; });
  return idxLoading;
}
function loadMonuments(){
  if (monLoading) return monLoading;
  monLoading = fetch(dj('data/monuments.json')).then(r => r.ok ? r.json() : [])
    .then(rows => {
      MONUMENTS = rows;
      MON_BY_ID = new Map(rows.map(r => [r.id, r]));
    }).catch(() => { MONUMENTS = []; MON_BY_ID = new Map(); });
  return monLoading;
}
/* Regional place files, fetched only for the region you are actually looking at.
   All four together are 2.1MB; nobody on a phone should download Kyoto to walk
   around Tokyo. data/places-index.json holds each file's bounding box.
   Adding a prefecture: run tools/build_places.py, then tools/index_places.py.
   No code change. */
const regionRows = new Map();      // name -> rows
const REGION_KEEP = 16;            // これ以上は古いものから捨てる

/* 一度読んだ県データを永久に持ち続けると、日本中を見て回ったときに
   178ファイル・17万行がヒープに残る。実測で5都市12ファイル18,109行＝9MB
   だったので、全国だと桁が変わる。スマホでタブが落ちる側の話になる。
   いま要る範囲(keep)を残して、古いものから落とす。Mapは挿入順を保つ。 */
function trimRegions(keep){
  if (regionRows.size <= REGION_KEEP) return;
  for (const k of [...regionRows.keys()]){
    if (regionRows.size <= REGION_KEEP) break;
    if (keep.has(k)) continue;
    regionRows.delete(k);
    regionPending.delete(k);     // 次に必要になったら取り直す
  }
}
const regionPending = new Map();
let regionIndex = null;
let regionList = null;   // the index once it has arrived

function loadRegionIndex(){
  if (regionIndex) return regionIndex;
  regionIndex = fetch(dj('data/places-index.json'))
    .then(r => r.ok ? r.json() : []).catch(() => []);
  regionIndex.then(l => { regionList = l; });
  return regionIndex;
}

/* Fills LOCALS from whatever is already in memory and returns at once. Anything
   still missing is fetched in the background and redraws when it lands.
   Awaiting it meant a pan at z15 froze the pins until a 300KB prefecture file had
   come down - the map looked stuck when it was only waiting. */
function loadLocals(){
  if (!regionList){ loadRegionIndex().then(l => { regionList = l; drawDetail(); }); return; }
  const b = map.getBounds();
  const want = regionList.filter(r =>
    b.getSouth() <= r.b[2] && b.getNorth() >= r.b[0] &&
    b.getWest()  <= r.b[3] && b.getEast()  >= r.b[1]);
  LOCALS = [];
  for (const r of want){
    const rows = regionRows.get(r.n);
    if (rows){ LOCALS = LOCALS.concat(rows); continue; }
    if (regionPending.has(r.n)) continue;
    /* 失敗を「空の県」として覚えないこと。以前は 404 も通信エラーも
       regionRows に [] を入れていたので、一度でも取り損ねると、その県の
       小さな地点はセッション中ずっと出てこなかった（しかも成功と同じ顔をしていた）。
       失敗したら覚えずに手を引く。次に同じ範囲を見たときに取り直す。 */
    regionPending.set(r.n, fetch(dj('data/places-' + r.n + '.json'))
      .then(x => { if (!x.ok) throw new Error('HTTP ' + x.status); return x.json(); })
      .then(rows => { regionRows.set(r.n, rows || []);
                      console.info('local spots +' + (rows || []).length + ' (' + r.n + ')');
                      drawDetail(); })
      .catch(err => { regionPending.delete(r.n);
                      console.warn('local spots 取得失敗 (' + r.n + ') ' + err.message
                                   + ' — 次に同じ場所を見たときに取り直す'); }));
  }
  trimRegions(new Set(want.map(r => r.n)));
}

/* Japanese Wikipedia carries roughly four times as many articles on the ground
   in Japan (50 vs 13 within 1.5km of Okayama Castle, measured), so we search
   the Japanese edition and upgrade each title to English where one exists.
   Where it does not, the article still opens in English through the proxy. */
function loadWikiSpots(){
  const c = map.getCenter();
  const key = c.lat.toFixed(2) + ',' + c.lng.toFixed(2);
  if (wikiAsked.has(key)) return;
  wikiAsked.add(key);
  const b = map.getBounds();
  const radius = Math.min(10000, Math.max(600,
    Math.round(map.distance(b.getNorthWest(), b.getSouthEast()) / 2)));
  // Deliberately not awaited by drawDetail. Wikipedia's reply took most of a
  // second, and holding the redraw for it made every pan feel like a stall.
  (async () => {
  try{
    const gs = await fetch('https://ja.wikipedia.org/w/api.php?origin=*&format=json&action=query'
      + '&list=geosearch&gscoord=' + c.lat + '%7C' + c.lng
      + '&gsradius=' + radius + '&gslimit=50').then(r => r.json());
    const hits = (gs && gs.query && gs.query.geosearch) || [];
    // HTTP 200 でエラーボディが返ることがある。その回は「聞いていない」に戻す。
    if (!Array.isArray(gs && gs.query && gs.query.geosearch)){ wikiAsked.delete(key); return; }
    /* wikiSeen は伸びる一方で、再描画のたびに先頭から走査される。
       実測で geosearch 11回＝507件。長時間使うと数千件になり、画面外の
       記事のために毎回そこを舐めることになる。古いものから落とす。
       Map は挿入順を保つので、先頭が最も古い。 */
    const WIKI_KEEP = 1200;
    if (wikiSeen.size > WIKI_KEEP)
      for (const k of [...wikiSeen.keys()].slice(0, wikiSeen.size - WIKI_KEEP))
        wikiSeen.delete(k);

    const fresh = hits.filter(h => !wikiSeen.has(h.pageid));
    for (const h of fresh)
      wikiSeen.set(h.pageid, { pageid: h.pageid, ja: h.title, name: h.title,
                               lat: h.lat, lon: h.lon, en: null });
    if (!fresh.length) return;
    drawDetail();                       // show them now; English titles follow

    // Draw the pins now and look up the English titles afterwards. Waiting for
    // both calls meant roughly 800ms of empty map after every pan.
    fetch('https://ja.wikipedia.org/w/api.php?origin=*&format=json&action=query'
      + '&prop=langlinks&lllang=en&lllimit=500&titles='
      + encodeURIComponent(fresh.map(h => h.title).join('|')))
      .then(r => r.json())
      .then(ll => {
        const byTitle = {};
        for (const pg of Object.values((ll && ll.query && ll.query.pages) || {}))
          byTitle[pg.title] = (pg.langlinks && pg.langlinks[0] && pg.langlinks[0]['*']) || '';
        let changed = false;
        for (const w of wikiSeen.values()){
          if (w.en !== null || !(w.ja in byTitle)) continue;
          w.en = byTitle[w.ja];
          w.name = (LANG === 'en' && w.en) ? w.en : w.ja;
          changed = true;
        }
        if (changed) drawDetail();
      })
      .catch(() => {});
  } catch(e){ /* offline or blocked: the map still works */
    wikiAsked.delete(key);          // 次にこの辺へ来たらもう一度聞く
  }
  })();
}

async function wikiExtractByTitle(title, lang){
  try{
    const j = await fetch('https://' + (lang || 'en') + '.wikipedia.org/w/api.php?origin=*&format=json'
      + '&action=query&redirects=1&prop=extracts|pageimages&exintro=1&explaintext=1'
      + '&piprop=thumbnail&pithumbsize=640&titles=' + encodeURIComponent(title)).then(r => r.json());
    const pages = (j && j.query && j.query.pages) || {};
    return Object.values(pages)[0] || null;
  } catch(e){ return null; }
}

async function wikiExtract(pageid, lang){
  try{
    const j = await fetch('https://' + (lang || 'ja') + '.wikipedia.org/w/api.php?origin=*&format=json'
      + '&action=query&prop=extracts|pageimages&exintro=1&explaintext=1'
      + '&piprop=thumbnail&pithumbsize=640&pageids=' + pageid).then(r => r.json());
    return (j && j.query && j.query.pages && j.query.pages[pageid]) || null;
  } catch(e){ return null; }
}

/* Addresses come from Nominatim, which answers in the language we ask for.
   One call per opened panel, cached, which stays inside its usage policy. */
/* 結果ではなく約束をしまっておく。同じパネルで住所と市町村名を続けて聞くので、
   結果をしまう形だと 1 件目が帰る前に 2 件目が出てしまい、日本語表示中は
   まったく同じ問いを 2 回 Nominatim に投げることになる。 */
let geoQueue = Promise.resolve(), geoLast = 0;
function geoFetch(url){
  const task = geoQueue.then(async () => {
    await new Promise(resolve => setTimeout(resolve, Math.max(0,1100-(Date.now()-geoLast))));
    geoLast=Date.now();
    const r=await fetch(url, {signal:AbortSignal.timeout(10000)});
    if(!r.ok) throw new Error('Geocoder unavailable');
    return r.json();
  });
  geoQueue=task.catch(()=>{});return task;
}
function revGeo(lat, lon, lang){
  const key = lang + ':' + lat.toFixed(5) + ',' + lon.toFixed(5);
  if (addrCache.has(key)) return addrCache.get(key);
  const pr = geoFetch(NOMINATIM + '/reverse?format=jsonv2&zoom=18&addressdetails=1'
      + '&accept-language=' + lang + '&lat=' + lat + '&lon=' + lon)
    .catch(() => {addrCache.delete(key);return null;});
  addrCache.set(key, pr);
  return pr;
}

async function addressOf(lat, lon){
  const j = await revGeo(lat, lon, LANG);
  return (j && j.display_name) || '';
}

/* 市町村名を display_name の文字列を切って取っていたが、これは二重に壊れていた。
   ①「県の一つ手前」は北海道だと市ではなく振興局になる。実測（函館山、
     2026-09-07）：ja では「渡島総合振興局」、en では「Oshima Subprefecture」。
   ②検索語に使うのに表示用の言語で取っていた。lg.jp の中身は日本語なので、
     英語表示中は「Oshima Subprefecture site:lg.jp」という一件も当たらない問いになっていた。
   代わりに addressdetails の構造化された項目から、必ず日本語で市町村を取る。 */
const MUNI_KEYS = ['city', 'town', 'village', 'municipality', 'city_district', 'county'];
async function muniOf(lat, lon){
  const j = await revGeo(lat, lon, 'ja');
  const a = (j && j.address) || {};
  for (const k of MUNI_KEYS){
    const v = a[k];
    /* 振興局・支庁は自治体ではない。拾っても lg.jp の検索には効かない。 */
    if (v && !/振興局|支庁|地方$/.test(v)) return v;
  }
  return '';
}

/* -------------------------------------------------------------------------
   Which old photograph exists at this exact spot?
   Ask the tile server, oldest first, and take the first one that answers. GSI
   returns 404 where nothing was flown, and sends CORS headers, so a plain fetch
   is a reliable coverage test. Results are cached per tile.
   ------------------------------------------------------------------------- */
const coverCache = new Map();
function deg2tile(lat, lon, z){
  const n = 2 ** z, r = lat * Math.PI / 180;
  return { x: Math.floor((lon + 180) / 360 * n),
           y: Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n) };
}
async function pickOldLayer(lat, lon){
  const z = 16;   // 全系列がこの深さまでは持っている
  const { x, y } = deg2tile(lat, lon, z);
  // Ask about all six series at once. Sequentially this was six round trips
  // before the button could even be labelled.
  const answers = await Promise.all(OLD_LAYERS.map(async L => {
    const key = L.id + '/' + x + '/' + y;
    if (coverCache.has(key)) return coverCache.get(key);
    let ok = false;
    try {
      const r = await fetch(GSI + '/' + L.id + '/' + z + '/' + x + '/' + y + '.' + L.ext,
                            { cache: 'force-cache', signal: AbortSignal.timeout(10000) });
      ok = r.ok;
    } catch(e){ ok = false; }
    coverCache.set(key, ok);
    return ok;
  }));
  const i = answers.indexOf(true);
  return i < 0 ? null : OLD_LAYERS[i];      // oldest series that actually exists
}

/* =========================================================================
   6. Detail layer
   ========================================================================= */
const isPhone = () => window.innerWidth < 700;

/* On a phone the pins used to pile on top of each other until the map was
   unusable - thirty markers inside a thumb's width around Shibuya station.
   Keep a minimum spacing in SCREEN pixels and drop anything that lands on top
   of a pin we have already placed. Landmarks are laid down first so the famous
   thing always wins the space. */
function spacer(gaps){
  // Bucket by the largest gap, so a candidate only compares itself against the
  // nine cells around it instead of against every pin placed so far.
  /* 種類ごとに間隔を変えられる。置いてある側の間隔も覚えておいて大きいほうを守る。
     こうしないと、22pxしかない一番小さいピンまで名所ラベル用の46pxで弾いてしまい、
     せっかく集めた地元の小さな名所が出てこない（川越 z16 の実測で5件しか残らなかった）。

     マス目の大きさは「表の中で一番大きい間隔」でなければならない。周囲9マスしか
     見ないので、それより大きい間隔を渡されると衝突を静かに見落とす。以前はそれを
     呼び出し側の約束に任せていたが、表ごと受け取れば cell をここで決められるので、
     破りようがない。知らない鍵は最大値＝安全側に倒す。 */
  /* 間隔は数値（＝縦横おなじ）でも {x,y} でもよい。ラベルは横に長いので、
     丸いピンと同じ数字では足りない。 */
  const box = g => (typeof g === 'number') ? { x: g, y: g } : g;
  const vals = Object.values(gaps).map(box);
  const cell = Math.max(...vals.map(v => v.x), ...vals.map(v => v.y));
  const FULL = { x: cell, y: cell };
  const grid = new Map();
  return (lat, lon, key) => {
    const need = gaps[key] ? box(gaps[key]) : FULL;
    const pt = map.latLngToContainerPoint([lat, lon]);
    const cx = Math.floor(pt.x / cell), cy = Math.floor(pt.y / cell);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++){
        const bucket = grid.get((cx + i) + ':' + (cy + j));
        if (!bucket) continue;
        for (const q of bucket){
          const lx = need.x > q.rx ? need.x : q.rx;
          const ly = need.y > q.ry ? need.y : q.ry;
          if (Math.abs(q.x - pt.x) < lx && Math.abs(q.y - pt.y) < ly) return false;
        }
      }
    pt.rx = need.x; pt.ry = need.y;
    const k = cx + ':' + cy;
    const bucket = grid.get(k);
    if (bucket) bucket.push(pt); else grid.set(k, [pt]);
    return true;
  };
}

let FACILITIES=[],facilityPromise=null,facilityRetryAt=0;
function loadFacilities(){
 if(Date.now()<facilityRetryAt)return;
 if(!facilityPromise)facilityPromise=(async()=>{
  const r=await fetch(dj('data/facilities-index-v1.json'));if(!r.ok)throw Error('facilities');const index=await r.json();
  let next=0;const results=[];
  await Promise.all(Array.from({length:4},async()=>{while(next<index.files.length){const file=index.files[next++];const r=await fetch(dj('data/'+file));if(!r.ok)throw Error(file);results.push(...await r.json());}}));
  FACILITIES=results;drawDetail();if(lastPanel&&!$('panel').classList.contains('closed'))lastPanel();
 })().catch(()=>{facilityPromise=null;facilityRetryAt=Date.now()+60000;});
 return facilityPromise;
}
function facilityTags(o){
 if(!o.at)return null;
 const normal=s=>PlaceUI.normalize(s).replace(/駅$|station$/g,'');
 const km=(a,b)=>{const rad=Math.PI/180,dlat=(b[0]-a[0])*rad,dlon=(b[1]-a[1])*rad;const h=Math.sin(dlat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dlon/2)**2;return 6371*2*Math.asin(Math.sqrt(h));};
 const names=[o.name,o.ja,o.searchName].filter(Boolean).map(normal);
 let match=o.travelTags||null,nearest=Infinity;
 for(const p of FACILITIES){if(!p.tags.railway&&!p.tags.aeroway)continue;
  const pn=[p.tags.name,p.tags['name:ja'],p.tags['name:en'],p.tags['full_name'],p.tags['full_name:en']].filter(Boolean).map(normal);
  if(!names.some(n=>pn.includes(n)))continue;
  const d=km(o.at,[p.lat,p.lon]);if(d<(p.tags.aeroway?4:0.4)&&d<nearest){match=p.tags;nearest=d;}
 }
 if(match?.railway==='station'&&FACILITIES.some(p=>p.tags.highspeed==='yes'&&[p.tags.name,p.tags['name:ja'],p.tags['name:en']].filter(Boolean).map(normal).some(n=>names.includes(n))&&km(o.at,[p.lat,p.lon])<0.4))return {...match,highspeed:'yes'};
 return match;
}
let detailGeneration=0;
async function drawDetail(){
  const generation=++detailGeneration;
  // roaming は「スポットが選ばれていない」の意味で、「地図が出ている」ではない。
  // これを条件にしていたため、名所やリミナルから開くと周辺のマーカーが全部消えていた。
  if (!map || $('place').hidden) return;
  const z = map.getZoom(), b = map.getBounds();
  loadFacilities();
  const group = L.layerGroup();
  const phone = isPhone();
  // At full zoom you are looking at one street, so let the markers sit closer
  // together and stop capping so hard. That is where the roadside stones,
  // the ruins and the named slopes finally become visible.
  const close = z >= CLOSE_ZOOM;
  const mini = z < 9;
  /* 間隔の表。ピンの実寸に合わせて種類ごとに変える。46px は「ラベル付きの44pxピン」の
     値で、ラベルの無い中ピン(32px)や小ピン(22px)には広すぎた。同じ値を使っていたせいで
     川越z16 では範囲内61件の地元スポットを6件しか置けていなかった。
     spacer が自分で最大値を取るので、ここに載っていない値は渡せない
     ＝マス目より大きい間隔を渡す事故が構造的に起きない。
     mid と tiny は今までと同じ値。伝承碑と地元スポットの密度は変えていない。 */
  const GAP = close ? (phone ? { p1:36, p2:31, p3:29, p4:26, mid:26, tiny:22 }
                             : { p1:28, p2:23, p3:20, p4:18, mid:20, tiny:16 })
            : mini  ? (phone ? { p1:33, p2:30, p3:27, p4:25, mid:36, tiny:26 }
                             : { p1:30, p2:28, p3:26, p4:24, mid:26, tiny:20 })
            :         (phone ? { p1:56, p2:48, p3:44, p4:40, mid:36, tiny:26 }
                             : { p1:38, p2:32, p3:28, p4:24, mid:26, tiny:20 });
  const free = spacer(GAP);
  /* ラベル専用の間引き。.big-label は幅116px(スマホ)/140px(PC)あり、
     ピン直径基準の GAP では隣のラベルと重なって両方読めなくなる。
     ここで落とすのはラベルだけで、ピンそのものは残す。 */
  const freeLabel = spacer({ lab: phone ? { x: 116, y: 18 } : { x: 140, y: 20 } });
  const CLS  = mini ? POP_CLS_MINI : POP_CLS;   // 描画ごとの確保はゼロ
  const CAP = close ? (phone ? 60 : 120) : (phone ? 28 : 60);

  // Whatever is already selected reserves its space first, so the tiers below
  // never draw a second pin on top of the place you are actually looking at.
  if (spotLayer) spotLayer.eachLayer(m => { const c = m.getLatLng();
    free(c.lat, c.lng);
    freeLabel(c.lat, c.lng, 'lab');   // 選ばれているスポットのラベルも場所を取る
  });

  // Tier 0: the nineteen written-up places. These used to be undecluttered dots
  // drawn only in Whole map, so at low zoom all nineteen piled into one blob and
  // they were invisible from Featured places and Liminal Japan. They are the best
  // thing in the app; they go down first and keep their space.
  for (const p of PLACES){
    const k = (p.pop || 1) - 1;
    if (!b.contains([p.lat, p.lon]) || !free(p.lat, p.lon, POP_CLS[k])) continue;
    L.marker([p.lat, p.lon], { icon: bigIcon(p, 'ring-red', z >= 9 && freeLabel(p.lat, p.lon, 'lab'), CLS[k]), title: placeName(p) })
     .on('click', () => openPlace(p)).addTo(group);
  }

  // Tier 1-3: famous first, so when space is tight the better-known place wins it.
  // LANDMARKS is already sorted by tier at load; re-sorting on every pan was waste.
  for (const p of LANDMARKS){
    if (z < (TIER_ZOOM[p.tier || 3] || 8)) continue;
    const k = (p.pop || 3) - 1;
    if (!b.contains([p.lat, p.lon]) || !free(p.lat, p.lon, POP_CLS[k])) continue;
    L.marker([p.lat, p.lon], { icon: bigIcon(p, 'ring-gold', z >= 10 && freeLabel(p.lat, p.lon, 'lab'), CLS[k]), title: placeName(p) })
     .on('click', () => showLandmark(p)).addTo(group);
  }

  // Activity selections use equal-size pins; they are not measured popularity ranks.
  if(z>=8)for(const p of ACTIVITIES){
    if(!b.contains([p.lat,p.lon])||!free(p.lat,p.lon,POP_CLS[2]))continue;
    L.marker([p.lat,p.lon],{icon:bigIcon(p,'ring-gold',z>=10&&freeLabel(p.lat,p.lon,'lab'),CLS[2]),title:placeName(p)})
      .on('click',()=>showActivity(p)).addTo(group);
  }
  // Liminal Japan was a list you could only reach from the home screen. Thirty-three
  // spots spread over the whole country is real map density, and stumbling on one
  // while panning is the point of them.
  if (z >= LIM_ZOOM)
    for (const p of LIMINAL){
      const k = POP_LIM - 1;
      if (!b.contains([p.lat, p.lon]) || !free(p.lat, p.lon, POP_CLS[k])) continue;
      const nm = placeName(p);
      L.marker([p.lat, p.lon], { icon: bigIcon({ emoji: p.emoji, name: nm }, 'ring-lim',
                                               z >= 10 && freeLabel(p.lat, p.lon, 'lab'),
                                               CLS[k]), title: nm })
       .on('click', () => showLiminal(p)).addTo(group);
    }

  if(z>=9){
   let count=0;for(const p of FACILITIES){if(count>=CAP)break;
    if(!b.contains([p.lat,p.lon])||!free(p.lat,p.lon,'tiny'))continue;count++;
    L.marker([p.lat,p.lon],{icon:tinyIcon(p.tags.landuse==='winter_sports'?'⛷️':localEmoji(p.tags),'tiny-local'),title:localName(p.tags)}).on('click',()=>showLocal(p)).addTo(group);
   }
  }
  if (z >= MONU_ZOOM){
    if(!MON_INDEX.length)loadMonumentIndex().then(()=>{if(MON_INDEX.length)drawDetail();});
    let m = 0;                                   // stones before articles: rarer
    for (const r of MON_INDEX){
      if (m >= CAP) break;
      if (!b.contains([r.lat, r.lon]) || !free(r.lat, r.lon, 'mid')) continue;
      m++;
      const en = kindsRaw(r.kind).map(k => KIND_EN[k]);
      L.marker([r.lat, r.lon], { icon: midIcon(KIND_EMOJI[en[0]] || '🪧', 'sm-lore'),
                                 title: kindsOut(r.kind).join(' / ') })
       .on('click', () => openMonument(r.id)).addTo(group);
    }
  }

  if (z >= DETAIL_ZOOM){
    loadWikiSpots();
    let n = 0;
    for (const w of wikiSeen.values()){
      if (n >= CAP) break;
      if (!b.contains([w.lat, w.lon]) || !free(w.lat, w.lon, 'mid')) continue;
      n++;
      L.marker([w.lat, w.lon], { icon: midIcon(spotEmoji(w.ja), w.en ? 'sm-wiki' : 'sm-ja'), title: w.name })
       .on('click', () => showWiki(w)).addTo(group);
    }
  }

  // smallest tier: little local places that only turn up in local pages
  if (z >= LOCAL_ZOOM){
    loadLocals();                          // fetches in the background, redraws when in
    let k = 0;
    const kcap = close ? (phone ? 90 : 250) : (phone ? 30 : 120);
    for (const p of LOCALS){
      if (k >= kcap) break;
      if (!b.contains([p.lat, p.lon]) || !free(p.lat, p.lon, 'tiny')) continue;
      k++;
      L.marker([p.lat, p.lon], { icon: tinyIcon(localEmoji(p.tags), 'tiny-local'),
                                 title: localName(p.tags) })
       .on('click', () => showLocal(p)).addTo(group);
    }
  }

  // Commit unconditionally. There used to be a run counter here and a
  // `run === detailRun` guard; while the map kept firing moveend (tiles still
  // streaming) every run was cancelled by the next and nothing was ever put on
  // the map. The counter is gone too - it was only being written to, and a
  // write-only counter reads like an order guard that does not exist.
  if(generation!==detailGeneration||$('place').hidden)return;
  if (detailLayer) map.removeLayer(detailLayer);
  detailLayer = group.addTo(map);
}

/* What kind of thing is this small pin?

   Measured over 67,633 collected spots, the old seven-branch version left
   36.3% of them as a featureless pin. Two things fix that. The tags say what
   most of them are (natural=peak 7,016, tourism=artwork 2,485, natural=tree
   1,169, historic=locomotive 182), and where the tags are vague the Japanese
   name is regular enough to read (坂 923, 跡 651, 地蔵 407, 一里塚 151).

   Name rules run first on purpose: a roadside Jizo is usually tagged only
   historic=memorial, which is true but says nothing, while its name says
   exactly what it is. Within each list, most specific first. */
const LOCAL_NAME_RULES = [
  // 街道と道の記憶
  [/一里塚/,                         '🪧', 'milestone mound', '一里塚'],
  [/道標|道しるべ|里程標/,            '🧭', 'old signpost', '道標'],
  [/常夜灯|常夜燈|灯籠|燈籠/,         '🏮', 'stone lantern', '常夜灯・灯籠'],
  [/宿場|本陣|脇本陣|問屋場|高札場/,  '🏘️', 'post town', '宿場'],
  [/関跡|関所|口留番所|番所$/,        '🛂', 'checkpoint', '関所・番所'],
  [/街道|往還|旧道$|並木$/,           '🛤️', 'old highway', '街道'],
  [/渡し場|渡船場|舟着|船着|波止場|河岸$/, '⛴️', 'ferry landing', '渡し場'],
  // 石のもの
  [/地蔵|六地蔵/,                     '🧘', 'roadside Jizō', 'お地蔵さん'],
  [/道祖神/,               '🪨', 'Dōsojin stone', '道祖神'],
  [/庚申|青面金剛/,         '🪨', 'Kōshin stone', '庚申塔'],
  [/馬頭観音/,             '🪨', 'Batō Kannon stone', '馬頭観音'],
  [/供養塔|五輪塔|宝篋印塔|板碑|石幢/, '🪦', 'memorial pagoda', '供養塔'],
  [/句碑|歌碑|詩碑|文学碑/,           '📜', 'poem stone', '句碑・歌碑'],
  [/忠魂碑|慰霊碑|表忠|殉難|遭難碑/,  '🕯️', 'war memorial', '慰霊碑'],
  [/記念碑|顕彰碑|之碑|の碑|碑$/,     '🗿', 'commemorative stone', '記念碑'],
  [/石仏|磨崖仏|石像|石塔/,           '🗿', 'stone figure', '石仏'],
  [/力石/,                            '🪨', 'lifting stone', '力石'],
  [/銅像|像$/,                        '🗿', 'statue', '像'],
  // 城と戦さ
  [/城$|城跡|城址|櫓$|石垣|土塁|堀跡|曲輪/, '🏯', 'castle site', '城跡'],
  [/古戦場|合戦/,                     '⚔️', 'battlefield', '古戦場'],
  [/砲台|台場/,                       '💣', 'gun battery', '砲台'],
  // 信仰
  [/神社|大社|神宮|八幡|稲荷|天満|天神|諏訪|熊野|山王|神明|荒神/, '⛩️', 'Shinto shrine', '神社'],
  [/寺$|寺院|院$|庵$|坊$|大仏|観音|薬師|不動|阿弥陀|弥勒/, '🛕', 'Buddhist temple', 'お寺'],
  [/教会|聖堂|天主堂/,                '⛪', 'church', '教会'],
  [/墓$|墓地|霊園|廟$/,               '⚱️', 'grave', '墓'],
  // 水と土
  [/滝$|大滝/,                        '💦', 'waterfall', '滝'],
  [/湧水|名水|清水$|泉$/,             '💧', 'spring', '湧き水'],
  [/井戸/,                            '🪣', 'old well', '井戸'],
  [/用水$|疏水|井堰|堰$|水門|樋門|樋管|水路橋/, '🚰', 'irrigation works', '用水・水門'],
  [/堤$|土手$|堤防|水塚/,             '🧱', 'embankment', '堤'],
  [/棚田/,                            '🌾', 'terraced fields', '棚田'],
  [/橋$|大橋|眼鏡橋/,                 '🌉', 'bridge', '橋'],
  // 山と木
  [/峠$|越$/,                         '🏔️', 'mountain pass', '峠'],
  [/坂$|坂道$|坂上|坂下/,             '🧗', 'named slope', '坂'],
  [/巨木|大木|名木|神木|老松|大杉|大楠|夫婦/, '🌲', 'great tree', '巨木'],
  [/鍾乳洞|風穴|洞窟/,                '🕳️', 'cave', '洞窟'],
  // 産業
  [/鉱山|銀山|金山|炭鉱|坑道|間歩/,   '⛏️', 'mine', '鉱山'],
  [/窯跡|製鉄|たたら|炉跡|石切|採石/, '🔥', 'kiln or forge', '窯跡・たたら'],
  [/灯台/,                            '🗼', 'lighthouse', '灯台'],
  [/水車/,                            '⚙️', 'watermill', '水車'],
  [/酒蔵|醸造/,                       '🍶', 'brewery', '酒蔵'],
  // 建物と暮らし
  [/家住宅$|生家$|旧宅$|屋敷$|旧家$|本家$/, '🏠', 'historic house', '古い家'],
  [/学校$|小学校|中学校|校舎|学舎/,   '🎓', 'school', '学校'],
  [/駅$|停車場|停留場/,               '🚉', 'station', '駅'],
  [/機関車|蒸気機関車/,               '🚂', 'locomotive', '機関車'],
  [/山門|楼門|門$/,                   '🚪', 'gate', '門'],
  [/公園$|庭園$|緑地/,                '🌳', 'park', '公園'],
  [/古墳|貝塚|横穴|塚$/,              '🏺', 'burial mound', '古墳'],
  [/遺跡|遺構|住居跡/,                '🏺', 'archaeological site', '遺跡'],
  [/温泉/,                            '♨️', 'hot spring', '温泉'],
  [/海水浴場|海岸$|砂丘|ビーチ/,       '🏖️', 'beach', '海岸'],
  [/油田|油井|号井|ポンピング|ガス井/, '🛢️', 'oil or gas well', '油田・井戸'],
  [/工場見学|製作所|醸造所|工場$|製糸|紡績/, '🏭', 'works or factory', '工場'],
  [/展望台|展望所|展望$|パノラマ|見晴/, '🔭', 'lookout', '展望台'],
  [/牧場|農場|酪農/,                   '🐄', 'farm', '牧場'],
  [/ダム$|貯水池|溜池|ため池/,         '🌊', 'dam or pond', 'ダム・ため池'],
  [/スキー場/,                         '🎿', 'ski ground', 'スキー場'],
  [/キャンプ場|野営場/,                '⛺', 'campsite', 'キャンプ場'],
  [/道の駅|物産館|直売所/,             '🏪', 'roadside station', '道の駅'],
  [/資料館|郷土館|記念館|文学館|民俗館/, '🏛️', 'local museum', '資料館'],
  [/美術館|ギャラリー/,                '🖼️', 'art museum', '美術館'],
  [/図書館/,                           '📚', 'library', '図書館'],
  [/獅子|山車|屋台$|神楽|人形|祭$|囃子/, '🎏', 'festival object', '祭りのもの'],
  [/丸$|船$|舟$/,                      '🚢', 'preserved boat', '船'],
  [/城下町|町並み|街並み|集落/,        '🏘️', 'historic townscape', '古い町並み'],
  [/古木|銘木|桜$|梅林|藤$|杉並/,      '🌸', 'notable planting', '名木・花の名所'],
  [/岩$|奇岩|magic|石$|巨石/,          '🪨', 'notable rock', '岩'],
  [/池$|沼$|湖$/,                      '💧', 'pond or lake', '池・湖'],
  [/川$|河原|渓谷|峡$/,                '🏞️', 'river or gorge', '川・渓谷'],
  [/島$|岬$|崎$/,                      '🏝️', 'island or cape', '島・岬'],
  [/跡$|址$/,                         '🏚️', 'site of something gone', '〜跡'],
];

const LOCAL_TAG_RULES = [
  [tg => tg.religion === 'shinto',                    '⛩️', 'Shinto shrine', '神社'],
  [tg => tg.religion === 'buddhist',                  '🛕', 'Buddhist temple', 'お寺'],
  [tg => tg.religion === 'christian',                 '⛪', 'church', '教会'],
  [tg => tg.amenity === 'place_of_worship',           '🙏', 'place of worship', '信仰の場'],
  [tg => tg.historic === 'castle',                    '🏯', 'castle', '城'],
  [tg => tg.historic === 'fort',                      '🛡️', 'fort', '砦'],
  [tg => tg.historic === 'battlefield',               '⚔️', 'battlefield', '古戦場'],
  [tg => tg.historic === 'cannon',                    '💣', 'cannon', '大砲'],
  [tg => tg.historic === 'city_gate',                 '🚪', 'city gate', '城門'],
  [tg => tg.historic === 'tomb',                      '⚱️', 'tomb', '墓'],
  [tg => ['archaeological_site','tumulus'].indexOf(tg.historic) >= 0, '🏺', 'archaeological site', '遺跡'],
  [tg => tg.historic === 'ruins',                     '🏚️', 'ruins', '廃墟'],
  [tg => tg.historic === 'wayside_shrine',            '🪷', 'wayside shrine', '路傍の祠'],
  [tg => tg.historic === 'wayside_cross',             '✝️', 'wayside cross', '路傍の十字架'],
  [tg => ['milestone','boundary_stone'].indexOf(tg.historic) >= 0, '🪧', 'boundary stone', '境界石・里程標'],
  [tg => ['locomotive','railway_car'].indexOf(tg.historic) >= 0, '🚂', 'preserved railway vehicle', '保存車両'],
  [tg => tg.historic === 'aircraft',                  '✈️', 'preserved aircraft', '保存機'],
  [tg => tg.historic === 'ship',                      '🚢', 'preserved ship', '保存船'],
  [tg => ['mine','mine_shaft','mineshaft'].indexOf(tg.historic) >= 0, '⛏️', 'mine', '鉱山'],
  [tg => tg.historic === 'aqueduct',                  '🌊', 'aqueduct', '水路橋'],
  [tg => tg.historic === 'highwater_mark',            '🌊', 'flood marker', '水位標'],
  [tg => ['manor','farm'].indexOf(tg.historic) >= 0,  '🏘️', 'historic estate', '旧邸・農家'],
  [tg => ['building','house'].indexOf(tg.historic) >= 0, '🏠', 'historic building', '古い建物'],
  [tg => ['memorial','monument'].indexOf(tg.historic) >= 0, '🗿', 'memorial', '記念碑'],
  [tg => tg.man_made === 'lighthouse',                '🗼', 'lighthouse', '灯台'],
  [tg => tg.man_made === 'watermill',                 '⚙️', 'watermill', '水車'],
  [tg => tg.man_made === 'windmill',                  '🌬️', 'windmill', '風車'],
  [tg => tg.man_made === 'kiln',                      '🔥', 'kiln', '窯'],
  [tg => tg.man_made === 'water_well',                '🪣', 'well', '井戸'],
  [tg => tg.man_made === 'survey_point',              '📐', 'survey marker', '三角点・水準点'],
  [tg => tg.man_made === 'obelisk',                   '🗿', 'obelisk', '記念塔'],
  [tg => tg.man_made === 'tower',                     '🗼', 'tower', '塔'],
  [tg => tg.man_made === 'pier',                      '⚓', 'pier', '桟橋'],
  [tg => ['embankment','dyke'].indexOf(tg.man_made) >= 0, '🧱', 'embankment', '堤'],
  [tg => tg.man_made === 'stone',                     '🪨', 'standing stone', '石'],
  [tg => tg.natural === 'volcano',                    '🌋', 'volcano', '火山'],
  [tg => tg.natural === 'peak',                       '⛰️', 'peak', '山'],
  [tg => tg.natural === 'saddle',                     '🏔️', 'mountain pass', '峠'],
  [tg => tg.natural === 'hot_spring',                 '♨️', 'hot spring', '温泉'],
  [tg => tg.natural === 'spring',                     '💧', 'spring', '湧き水'],
  [tg => tg.natural === 'cave_entrance',              '🕳️', 'cave', '洞窟'],
  [tg => tg.natural === 'tree',                       '🌳', 'notable tree', '名木'],
  [tg => tg.waterway === 'waterfall',                 '💦', 'waterfall', '滝'],
  [tg => ['weir','dam','sluice_gate'].indexOf(tg.waterway) >= 0, '🚰', 'weir or sluice', '堰・水門'],
  [tg => tg.waterway === 'canal',                     '🚤', 'canal', '運河'],
  [tg => tg.tourism === 'artwork',                    '🎨', 'public artwork', '野外の作品'],
  [tg => tg.tourism === 'viewpoint',                  '🔭', 'viewpoint', '眺めのよい所'],
  [tg => tg.tourism === 'museum',                     '🏛️', 'museum', '博物館'],
  [tg => tg.tourism === 'information',                '🪧', 'information board', '案内板'],
  [tg => tg.place === 'locality',                     '🗺️', 'old place name', '古い地名'],
  [tg => tg.highway === 'bus_stop',                   '🚏', 'bus stop', 'バス停'],
  [tg => !!tg.highway,                                '🛣️', 'named road', '名前のついた道'],
  [tg => !!tg.building,                               '🏠', 'old building', '古い建物'],
  [tg => tg.historic === 'yes',                       '🏛️', 'historic spot', '史跡'],
  [tg => tg.natural === 'rock',                       '🪨', 'notable rock', '岩'],
  [tg => tg.natural === 'water',                      '💧', 'water', '水辺'],
  [tg => tg.man_made === 'water_tower',               '🚰', 'water tower', '給水塔'],
  [tg => tg.amenity === 'shelter',                    '⛱️', 'shelter', '休み処'],
  // OSM の tourism=attraction は何でも入る箱。中身までは分からないが、
  // 「見どころ」であることだけは正しいので、無地のピンよりは伝わる。
  [tg => tg.tourism === 'attraction',                 '🎡', 'local attraction', '見どころ'],
];

function localType(tg){
  const typed = PlaceUI.type(tg);
  // A known station, museum or tree must not become a shrine because of its name.
  if (typed && !['historic=memorial|historic=monument','tourism=attraction'].includes(typed[0])) return [null, typed[1], typed[2], typed[3]];
  const n = tg['name:ja'] || tg.name || '';
  for (const r of LOCAL_NAME_RULES) if (r[0].test(n)) return r;
  for (const r of LOCAL_TAG_RULES)  if (r[0](tg))     return r;
  return null;
}
function localEmoji(tg){ const r = localType(tg); return r ? r[1] : '📍'; }
function localLabel(tg){
  const r = localType(tg);
  return PlaceUI.type(tg) ? PlaceUI.label(tg, LANG) : (r && LANG === 'ja' ? r[3] : r && LANG === 'en' ? r[2] : t('localSpot'));
}
/* All the medium pins used to be the same book icon, which told you nothing.
   Japanese titles are highly regular, so a keyword pass gives a usable type. */
const TYPE_RULES = [
  [/駅$|停留場|停車場/, '🚉', 'railway station', '駅'],
  [/空港/, '✈️', 'airport', '空港'],
  [/神社|大社|神宮|八幡宮|稲荷|天満宮|東照宮/, '⛩️', 'Shinto shrine', '神社'],
  [/寺$|寺院|院$|大仏|観音|廟/, '🛕', 'Buddhist temple', 'お寺'],
  [/教会|聖堂/, '⛪', 'church', '教会'],
  [/城$|城跡|城address|城址|櫓|門$/, '🏯', 'castle', '城'],
  [/古墳|遺跡|貝塚|窯跡/, '🏺', 'ancient site', '遺跡'],
  [/公園|庭園|緑地|御苑/, '🌳', 'park or garden', '公園・庭園'],
  [/動物園/, '🦁', 'zoo', '動物園'],
  [/水族館/, '🐠', 'aquarium', '水族館'],
  [/美術館|ギャラリー/, '🖼️', 'art museum', '美術館'],
  [/博物館|資料館|記念館|文学館/, '🏛️', 'museum', '博物館'],
  [/図書館/, '📚', 'library', '図書館'],
  [/大学|学園|高等学校|中学校|小学校|学校/, '🎓', 'school or university', '学校'],
  [/病院|クリニック|医療/, '🏥', 'hospital', '病院'],
  [/銀行|信用金庫|フィナンシャル|証券/, '🏦', 'bank', '銀行'],
  [/橋$|大橋|歩道橋/, '🌉', 'bridge', '橋'],
  [/川$|河川|用水|運河|滝/, '🏞️', 'river or waterway', '川'],
  [/山$|岳$|峠|丘$/, '⛰️', 'mountain', '山'],
  [/島$|岬/, '🏝️', 'island or cape', '島・岬'],
  [/湖$|池$|沼$|ダム/, '💧', 'lake or dam', '湖・ダム'],
  [/温泉/, '♨️', 'hot spring', '温泉'],
  [/ホテル|旅館/, '🏨', 'hotel or inn', '宿'],
  [/商店街|市場|百貨店|モール/, '🛍️', 'shopping street', '商店街'],
  [/球場|スタジアム|競技場|ドーム/, '⚾', 'stadium', '競技場'],
  [/ホール|劇場|会館|文化センター/, '🎭', 'hall or theatre', 'ホール'],
  [/放送|テレビ|ラジオ/, '📺', 'broadcaster', '放送局'],
  [/タワー|塔$/, '🗼', 'tower', 'タワー'],
  [/市役所|県庁|区役所|町役場|庁舎|裁判所/, '🏛️', 'government building', '役所'],
  [/港$|埠頭|灯台/, '⚓', 'harbour', '港'],
  [/墓地|霊園|墓$/, '🪦', 'cemetery', '墓地'],
  [/株式会社|ホールディングス|グループ$|企業|工場/, '🏢', 'company', '企業'],
  [/神楽|祭$|祭り/, '🎏', 'festival', '祭り'],
  [/城下町|宿場|街道/, '🛤️', 'old town or road', '街道'],
  [/書店|本屋/, '📗', 'bookshop', '書店'],
  [/廃墟|廃校|廃線|跡地$|廃止/, '🏚️', 'abandoned site', '廃墟・跡地'],
  [/鉱山|炭鉱|坑道|精錬/, '⛏️', 'mine', '鉱山'],
  [/団地|住宅$|アパート/, '🏘️', 'housing estate', '団地'],
  [/トンネル|隧道/, '🚇', 'tunnel', 'トンネル'],
  [/灯台/, '🗼', 'lighthouse', '灯台'],
  [/遊園地|テーマパーク|遊具/, '🎡', 'amusement park', '遊園地'],
  [/工場|製作所|製鉄|造船/, '🏭', 'factory', '工場'],
  [/古墳$|塚$/, '⛰️', 'burial mound', '古墳'],
  [/地蔵|石仏|観音$/, '🗿', 'stone figure', '地蔵・石仏'],
  [/道祖神|庚申/, '🪨', 'roadside deity', '道祖神'],
  [/井戸|湧水|清水$/, '💧', 'well or spring', '井戸・湧水'],
  [/一里塚|街道|宿場/, '🛤️', 'old highway marker', '街道'],
  [/家住宅$|生家$|旧宅$|屋敷$/, '🏠', 'historic house', '古民家'],
  [/供養塔|慰霊|墓碑/, '🕯️', 'memorial', '供養塔'],
  [/滝$|瀑布/, '🌊', 'waterfall', '滝'],
  [/砂丘/, '🏜️', 'dunes', '砂丘'],
  [/洞|鍾乳洞/, '🕳️', 'cave', '洞窟'],
  [/火山|噴火口/, '🌋', 'volcano', '火山'],
  [/植物園|花園|梅林|桜/, '🌸', 'garden', '花の名所'],
  [/水門|閘門|樋門/, '🚪', 'floodgate', '水門'],
  [/砲台|要塞|陣屋/, '🧱', 'fort', '砲台・要塞'],
  [/牧場|農場/, '🐄', 'farm', '牧場'],
  [/酒造|醸造|蔵元/, '🍶', 'sake brewery', '酒蔵'],
  [/銅像|像$|碑$/, '🗿', 'statue or monument', '像・碑'],

  /* 実測（仙台・東京・大阪・京都・札幌の記事283件）で60.1%がここまで落ちていた。
     落ちていたものは町名・ビル・郵便局・商業施設・役所で、どれも名前で分かる。
     町名は「一番町」「柳町」のように、その土地の来歴そのものなので拾う値打ちが高い。 */
  [/郵便局/, '📮', 'post office', '郵便局'],
  [/検察庁|裁判所|地方法務局|法務局/, '⚖️', 'court or law office', '裁判所・検察庁'],
  [/警察署|交番|消防署/, '🚨', 'police or fire station', '警察・消防'],
  [/百貨店|三越|大丸|高島屋|パルコ|フォーラス|商業施設|ショッピング/, '🛍️', 'department store', '百貨店・商業施設'],
  [/商店$|商店街|市場$|横丁|問屋/, '🏪', 'shops', '商店・市場'],
  [/ビルヂング|ビル$|センタービル|タワービル/, '🏢', 'office building', 'ビル'],
  [/銀行|信用金庫|信用組合/, '🏦', 'bank', '銀行'],
  [/新聞|出版|印刷/, '📰', 'newspaper or press', '新聞・出版'],
  [/電力|電気|ガス$|天然ガス|水道局/, '⚡', 'utility', '電気・ガス'],
  [/鉄道|軌道|電鉄|線$/, '🚆', 'railway', '鉄道'],
  [/バス$|バスターミナル|バス停/, '🚏', 'bus', 'バス'],
  [/フェリー|航路|船$|丸$/, '⛴️', 'ferry or ship', '船'],
  [/文庫$|草堂|書院|私塾|塾$/, '📚', 'library or old school', '文庫・私塾'],
  [/七夕|祭$|祭り|まつり|山車|神楽|囃子|踊り/, '🎏', 'festival', '祭り'],
  [/温泉郷|湯$|浴場/, '♨️', 'hot spring', '温泉'],
  [/団地|住宅$|マンション/, '🏘️', 'housing', '住宅'],
  [/会館$|公民館|センター$/, '🏢', 'public hall', '会館'],
  [/組合|協会|財団|法人|機構/, '🏢', 'organisation', '団体'],
  [/大橋$|橋梁/, '🌉', 'bridge', '橋'],
  [/ダム$|貯水池|用水|疏水|運河/, '🚰', 'waterworks', '用水・ダム'],
  [/古戦場|合戦|の戦い/, '⚔️', 'battlefield', '古戦場'],
  [/藩$|藩主|城下/, '🏯', 'domain', '藩'],
  [/street|通り$|通$|大通/, '🛣️', 'street', '通り'],
  /* 町名は最後。「◯◯町」は上の具体的なものに当たらなかったものだけが来る。 */
  [/店$|屋$|商会/, '🏪', 'shop', '店'],
  [/広告|コンサルタント|会社$|社$|商事|興業/, '🏢', 'company', '会社'],
  /* 町名は最後。「◯◯町」は上の具体的なものに当たらなかったものだけが来る。 */
  [/丁目$|町$|村$|字$|地区$/, '🗺️', 'district name', '町名・地名'],
];
function spotType(title){
  /* 日本語版の記事名は「大町 (仙台市)」のように曖昧さ回避が末尾に付く。そのままだと
     「町$」のような語尾のルールが全部外れる。実測でも一番町・柳町・立町が
     どれも汎用アイコンに落ちていた。括弧を外したものでも照合する。 */
  const bare = title.replace(/\s*[（(][^）)]*[）)]\s*$/, '');
  for (const r of TYPE_RULES) if (r[0].test(title) || r[0].test(bare)) return r;
  return null;
}
function spotEmoji(title){ const r = spotType(title); return r ? r[1] : '📖'; }
function spotLabel(title){
  const r = spotType(title);
  if (!r) return LANG === 'ja' ? '場所' : 'place';
  return LANG === 'en' ? r[2] : r[3];
}

/* -------------------------------------------------------------------------
   その場所そのものの記事が無いとき、何を出すか。
   出すのは2種類だけ。「これは何か（種類）」と「どこのまちか（自治体）」。
   一番近い記事は使わない。実測で4-6m隣でも別の神社を指す。距離は手がかりにしない。
   記事名を文字列から組み立てる処理は、この経路のどこにも無い。
   ------------------------------------------------------------------------- */
/* その場所自身の記事へのリンク。wiki_en / wiki_ja は tools/verify_wiki.py が
   APIで検証して書いた欄で、片方しか無いことがある（リミナル26件中6件は英語版が無い）。
   無い言語のURLを組み立てない。どちらも無ければ null＝ボタンを出さない。 */
function articleLink(p){
  /* wiki_en が null なのは「検証したが英語版が無い」。キーごと無いのは「未検証」。
     この2つを混ぜると、実在しないと分かっている手書きの英題が復活する
     （実際そうなった。リミナル6件が en.wikipedia の404へ戻っていた）。 */
  const en = ('wiki_en' in p) ? p.wiki_en : p.wiki;
  const ja = p.wiki_ja;
  if (LANG === 'en'){
    if (en) return { url: 'https://en.wikipedia.org/wiki/' + wikiPath(en),
                     label: t('readWiki'), src: 'English Wikipedia (CC BY-SA 4.0).' };
    if (ja) return { url: JA_ARTICLE(ja), label: t('readWikiJa'),
                     src: 'Japanese Wikipedia (CC BY-SA 4.0). No English article exists.' };
  } else {
    if (ja) return { url: 'https://ja.wikipedia.org/wiki/' + wikiPath(ja),
                     label: LANG==='ja'?t('readWiki'):t('readWikiJa'), src: 'Wikipedia (CC BY-SA 4.0)' };
    if (en) return { url: 'https://en.wikipedia.org/wiki/' + wikiPath(en),
                     label: t('readWikiEn'), src: '英語版ウィキペディア（CC BY-SA 4.0）' };
  }
  return null;
}

function relatedKind(tg){
  if (!TOPICS) return null;                      // 読めていなければ黙る
  const r = localType(tg);
  if (!r) return null;
  const row = TOPICS[r[3] + '|' + r[2]];         // 日本語ラベル|英語ラベル
  if (!row || !row.ok || !row.ja) return null;   // 日本語ラベルだけだと4つ衝突する
  const useEn = LANG === 'en' && !!row.en;
  return {
    href: useEn ? 'https://en.wikipedia.org/wiki/' + wikiPath(row.en)
        : LANG === 'en' ? JA_ARTICLE(row.ja)
        : 'https://ja.wikipedia.org/wiki/' + wikiPath(row.ja),
    label: LANG === 'en' ? row.q_en : row.q_ja,
    icon: '📖',
    jaOnly: LANG === 'en' && !row.en
  };
}

/* まちの記事は、その自治体の境界そのものが持つ wikipedia / wikidata タグから取る。
   表示する名前とリンクが同じ1つの応答から来るので、食い違いようがない。
   住所の文字列からは作らない（高梁市 -> en:Takahashi は日本人の姓の記事で、
   曖昧さ回避のフラグも立たない）。 */
/* 日本語版の記事名 -> 英語版の記事名。記事同士のリンクをそのまま辿るだけで、
   名前から組み立てることはしない。自治体ごとに1回だけ引いて覚えておく。
   引けなければ null を返し、呼び出し側は日本語版＋翻訳に落とす。 */
const enTitleCache = new Map();
async function enTitleOf(jaTitle){
  if (enTitleCache.has(jaTitle)) return enTitleCache.get(jaTitle);
  let en = null;
  try{
    const j = await fetch('https://ja.wikipedia.org/w/api.php?origin=*&format=json&action=query'
      + '&redirects=1&prop=langlinks&lllang=en&lllimit=1&titles='
      + encodeURIComponent(jaTitle)).then(r => r.json());
    const pg = Object.values(((j || {}).query || {}).pages || {})[0];
    const ll = pg && pg.langlinks && pg.langlinks[0];
    if (ll && ll['*']) en = ll['*'];
  } catch(e){ en = null; }
  enTitleCache.set(jaTitle, en);
  return en;
}

const areaCache = new Map();
const AREA_TYPES = ['city', 'town', 'village', 'municipality'];
async function areaArticleOf(lat, lon){
  const key = lat.toFixed(3) + ',' + lon.toFixed(3);   // 約110m。市境をまたいで使い回さない
  if (areaCache.has(key)) return areaCache.get(key);
  let out = null;
  try{
    const j = await geoFetch(NOMINATIM + '/reverse?format=jsonv2&zoom=10&extratags=1'
      + '&accept-language=en&lat=' + lat + '&lon=' + lon);
    const et = (j && j.extratags) || {};
    if (j && AREA_TYPES.indexOf(j.addresstype) >= 0 && et.wikipedia){
      const p = wikiTagParse(et.wikipedia);
      const a = (et.wikidata && AREAS) ? AREAS[et.wikidata] : null;
      // Q番号の表がタグの日本語記事名と食い違うなら、表は使わない（古くなった可能性）
      const ok = a && a[0] === (p && p.title);
      if (p && p.lang === 'ja'){
        let en = ok ? a[1] : null;
        // 表に無ければ、その記事自身の言語間リンクを引く。
        // 名前からの推測ではなく記事同士のリンクなので、別の主題に飛ばない。
        if (!en) en = await enTitleOf(p.title);
        out = { ja: p.title, en: en, label: j.name || p.title };
      }
    }
  } catch(e){ out = null; }
  areaCache.set(key, out);
  return out;
}

const localName = tg => PlaceUI.localName(tg, LANG);
const placeName = p => PlaceUI.name(p, LANG);

/* #pWiki には tags.wikipedia しか入らない。関連記事はこの別の箱にしか入らない。
   「ウィキペディアで読む」という文言がこの箱に出る経路は存在しない。
   見出しの一文とボタンを同じ innerHTML でまとめて書くので、
   「見出しだけ出てボタンが無い」「ボタンだけ出て断り書きが無い」が起きない。 */
function renderRelated(o){
  const box = $('pAbout');
  box.hidden = true; box.innerHTML = '';
  const rows = [];
  const k = o.relatedKind ? relatedKind(o.relatedKind) : null;
  if (k) rows.push(k);
  const a = o._area;
  if (a){
    const useEn = LANG === 'en' && !!a.en;
    rows.push({
      href: useEn ? 'https://en.wikipedia.org/wiki/' + wikiPath(a.en)
          : LANG === 'en' ? JA_ARTICLE(a.ja)
          : 'https://ja.wikipedia.org/wiki/' + wikiPath(a.ja),
      label: t('aboutArea')(LANG === 'en' ? a.label : a.ja),
      icon: '🗺️', jaOnly: LANG === 'en' && !a.en });
  }
  if (!rows.length) return;                       // 空の見出しだけを出さない
  box.innerHTML = '<p>' + esc(o.wiki ? t('aboutLeadAlso') : t('aboutLead')) + '</p>'
    + rows.map(r => '<a target="_blank" rel="noopener" href="' + esc(r.href) + '">'
        + '<span>' + r.icon + '</span><span class="p-ab-t">' + esc(r.label) + '</span>'
        + (r.jaOnly ? '<span class="p-lang">' + esc(t('jaOnly')) + '</span>' : '')
        + '</a>').join('');
  box.hidden = false;
}

/* =========================================================================
   7. Panels
   ========================================================================= */
/* One place decides what the compare button says, so the label can never drift
   out of step with whether the comparison is actually running. */
function paintCompareBtn(){
  const b = $('pCompare');
  if (thenLayer){
    b.hidden = false;
    b.innerHTML = '<span>\u2715</span> ' + esc(t('stopCompare'));
    b.classList.add('is-on');
    return;
  }
  b.classList.remove('is-on');
  if (window.AtlasTime){ window.AtlasTime.paintButton(); return; }
  if (!compareLayer){ b.hidden = true; return; }
  b.hidden = false;
  b.innerHTML = '<span>\u25c0\u25b6</span> ' + esc(t('compareYear')(compareLayer.span || compareLayer.year));
}

function panelShell(o){
  window.AtlasWalking?.clear();
  window.AtlasTime?.close();
  compareAt = o.at || null;
  const oldHash = o.share && o.share.url ? new URL(o.share.url, location.href).hash : '';
  sharePayload = o.share ? {title:o.name, url:PlaceUI.spotURL('https://japantimeatlas.com', LANG, o.at, oldHash, o.name)} : null;
  $('pCompare').hidden = !compareAt;
  window.AtlasTime.paintButton();
  $('pShare').hidden   = !o.share;
  $('pShare').textContent = '⇪ '+t('share');
  $('pJa').textContent = o.ja || '';
  $('pName').textContent = o.name;
  $('pAddr').textContent = '';
  o._area = null;          // 前のスポットのまちが残らないように
  $('pStory').innerHTML = o.bodyHTML;

  /* 前のスポットの写真と「昔の写真はありません」の文言が残らないよう、
     ここで必ず消す。pickOldLayer の返事を待つあいだ前の状態が見えていた。 */
  $('pNoOld').hidden = true;
  $('pNoOld').textContent = '';
  const fig = $('pFig');
  if (o.img){ $('pImg').src = o.img; $('pImg').alt = o.cap || o.name;
              $('pCap').textContent = o.cap || ''; fig.hidden = false; }
  else { fig.hidden = true; $('pImg').removeAttribute('src');
         $('pImg').alt = ''; $('pCap').textContent = ''; }

  $('pWord').innerHTML = o.kicker
    ? '<span class="w-jp">' + o.kicker.emoji + '</span><span class="w-txt"><b>'
      + esc(o.kicker.label) + '</b>' + esc(o.kicker.note || '') + '</span>' : '';
  $('pWord').hidden = !o.kicker;

  const w = $('pWiki');
  if (o.wiki){ w.hidden = false; w.href = o.wiki; w.textContent = o.wikiLabel || t('readWiki'); }
  else w.hidden = true;

  /* The municipality's own pages are useful even when a Wikipedia article
     exists - opening hours, access, closures. Previously this button was only
     given an href inside the address callback, so it could be on screen with
     nothing behind it, and a late reply from the previous spot could show it
     with the wrong link. Set it here, upgrade it when the address arrives. */
  const off = $('pOfficial');
  /* 日本語の名前が無いなら名前は使わない。後から届く市町村名だけで
     自治体のサイトには行ける。t('localSpot') のような総称も除く。 */
  const cand = o.searchName || o.name || '';
  off.dataset.name = (o.at && HAS_JA(cand)) ? cand : '';
  off.dataset.muni = '';
  off.dataset.at   = o.at ? '1' : '';
  paintOfficial();

  const g = $('pGmap');
  if (o.at){
    g.hidden = false;
    g.href = 'https://www.google.com/maps/search/?api=1&query=' + o.at[0] + ',' + o.at[1];
    g.textContent = '📍 ' + t('gmap');
  } else g.hidden = true;

  $('pSrc').textContent = o.src || '';
  renderRelated(o);
  paintSaveBtn();
  snsLinks();
  $('panel').classList.remove('closed');
  $('panel').classList.add('open');
  document.body.classList.remove('roaming');
  $('panel').querySelector('.panel-inner').scrollTop = 0;
  window.AtlasWalking?.attach(o);

  const myToken = ++panelToken;
  /* まちの記事は描画のあとで足す。地図の再描画も最初の表示も待たせない。 */


  // Work out which old photograph is available here and label the button with
  // its actual year, rather than promising 1945 everywhere.
  compareLayer = null;
  if (o.at){
    const at = o.at;
    pickOldLayer(at[0], at[1]).then(L => {
      if (myToken !== panelToken || compareAt !== at) return;   // panel changed while we asked
      compareLayer = L;
      if (!L){
        window.AtlasTime.paintButton();
        $('pNoOld').hidden = false;
        $('pNoOld').textContent = t('noOldPhoto');
        return;
      }
      $('pNoOld').hidden = true;
      paintCompareBtn();
    });
  } else {
    $('pNoOld').hidden = true;
  }
}


/* 要約と、その出典の注意書きを1か所で決める。2026-09-09 追加。
   extract=英語版、extract_ja=日本語版。無い言語は「出さない」。
   extractSrc は出典の種類:
     'en.wikipedia'            … 英語版そのまま
     'ja.wikipedia (translated)' … 日本語版を訳したもの
     'web (aggregated)'        … 複数の公開サイトから集めたもの。**確かさが低い旨を必ず出す**
   花平さんの指示（2026-09-09）: 集めてまとめた説明には注釈を付ける。 */
/* 要約を読める長さに切る。**元データは触らない。**

   百科事典の書き出しは「名前（よみ、別名）は、」で始まる。見出しに名前が出ている
   画面では、この繰り返しがいちばん読みにくい（花平さんの指摘）。落とす。
   切るときは必ず文末（。/./！/？）で切る。文の途中で終わると、書きかけに見える。 */
function trimSummary(text, limit){
  let s = String(text || '').split('\n')[0].trim();     // 最初の段落だけ
  /* 「◯◯（よみ、英名…）は、」を落とす。括弧の中に「。」が無いものだけを対象にして、
     長い一文を誤って削らないようにする。 */
  s = s.replace(/^[^。]{1,40}（[^）。]{0,80}）(?:は、|は)/, '');
  s = s.replace(/^[^.]{1,60}\([^).]{0,90}\)\s+(?:is|was|are|were)\s+/, m =>
        m.replace(/^[^.]{1,60}\([^).]{0,90}\)\s+/, ''));
  if (s.length <= limit) return s;
  const cut = s.slice(0, limit);
  let p = -1;
  for (const mark of ['。', '！', '？', '. ', '! ', '? ']){
    p = Math.max(p, cut.lastIndexOf(mark) + (mark.length > 1 ? 0 : 0));
  }
  /* 前半で切れてしまうくらい文が長いときは、無理に文末を探さず「…」で締める。 */
  return p > limit * 0.35 ? cut.slice(0, p + 1) : cut.replace(/[、,\s]+$/, '') + '…';
}

function extractOf(p){
  const text = (p.summaries && p.summaries[LANG]) || (LANG === 'ja' ? p.extract_ja : LANG === 'en' ? p.extract : p['extract_' + LANG]) || '';
  if (!text) return null;
  if(p.summaries && p.summaries[LANG]) return {text,note:PlaceUI.pick(['Short overview based on the linked source.','リンク先の資料に基づく短い概要です。','연결된 자료를 바탕으로 한 짧은 개요입니다.','根据链接资料整理的简短概要。','根據連結資料整理的簡短概要。'],LANG),weak:false};
  const src = p.extractSrc || '';
  const note = src === 'web (aggregated)'    ? t('srcAggregated')
             : src === 'ja.wikipedia (translated)' ? t('srcWikiJaTr')
             : src === 'en.wikipedia'        ? t('srcWikiEn')
             : '';
  return { text: text, note: note, weak: src === 'web (aggregated)' };
}

function extractHTML(p, limit){
  const e = extractOf(p);
  if (!e) return '';
  return '<p class="place-summary">' + esc(p.summaries && p.summaries[LANG] ? e.text : trimSummary(e.text, limit || 220)) + '</p>'
       + (e.note ? '<p class="p-srcnote' + (e.weak ? ' p-weak' : '') + '">'
                 + esc(e.note) + '</p>' : '');
}
function showLandmark(p,refresh=false){
  if (!map || $('place').hidden) noPush(openMap);
  lastPanel = () => showLandmark(p,true);
  /* current は「物語つきの名所を開いている」という意味。ここで消さないと、
     名所を開いたあとに小さなスポットを開いても current が残り、言語を切り替えた
     applyLang() が画面に出ているスポットではなく前の名所を開き直してしまう。 */
  current = null;
  panelShell({
    kicker: { emoji: p.emoji, label: t('localSpot'), note: '  ' + placeName(p) },
    placeId:p.id, adTier:p.pop||3, ja: LANG === 'ja' ? '' : p.ja, name: placeName(p), at: [p.lat, p.lon], query: p.name,
    bodyHTML: extractHTML(p, 240) || '<p>' + (p.regional ? PlaceUI.pick(['Explore this place with the historical map. Details are available in the linked article.','歴史地図を重ねて周辺をたどれます。詳しい由来はリンク先の記事をご覧ください。','옛 지도와 함께 주변을 살펴보세요. 자세한 내용은 연결된 문서에서 확인할 수 있습니다.','叠加历史地图探索周边，详细介绍请参阅链接文章。','疊加歷史地圖探索周邊，詳細介紹請參閱連結文章。'],LANG) : t('famous')) + '</p>',
    wiki: (articleLink(p) || {}).url || '',
    wikiLabel: (articleLink(p) || {}).label,
    img: airPhoto(p.lat, p.lon), cap: t('photoAir'),
    share: { title: p.name, url: location.origin + location.pathname },
    searchName: p.ja,
    src: p.regional ? ((articleLink(p)||{}).src||'Wikipedia (CC BY-SA 4.0)') + ' · ' + (p.coordSource.includes('openstreetmap')?'Coordinates © OpenStreetMap contributors.':'Coordinates from Wikipedia.') : (LANG === 'ja' ? '座標の出典：ウィキペディア' : 'Coordinates from Wikipedia.')
  });
  map.panTo([p.lat, p.lon]);
}

const wikiTitles = new Map();
async function localizedWikiTitle(ja,lang){
  if(lang==='ja')return ja;
  const target=lang.startsWith('zh')?'zh':lang,key=target+':'+ja;
  if(wikiTitles.has(key))return wikiTitles.get(key);
  try{
    const r=await fetch('https://ja.wikipedia.org/w/api.php?origin=*&format=json&action=query&prop=langlinks&lllimit=1&lllang='+target+'&titles='+encodeURIComponent(ja));
    if(!r.ok)return '';
    const j=await r.json(),page=Object.values(j.query?.pages||{})[0],title=page?.langlinks?.[0]?.['*']||'';
    wikiTitles.set(key,title);if(wikiTitles.size>200)wikiTitles.delete(wikiTitles.keys().next().value);return title;
  }catch(e){return '';}
}
async function showWiki(w,refresh=false){
  lastPanel = () => showWiki(w,true);current=null;
  const lang=LANG;
  panelShell({adTier:3,name:lang==='ja'?w.ja:(w.en||w.ja),ja:lang==='ja'?'':w.ja,
    bodyHTML:'<p>'+t('loading')+'</p>',at:[w.lat,w.lon],
    share:{title:w.name,url:location.origin+location.pathname},searchName:w.ja,
    src:'Wikipedia (CC BY-SA 4.0)'});
  const token=panelToken;
  const title=await localizedWikiTitle(w.ja,lang);
  if(token!==panelToken||LANG!==lang)return;
  const wikiLang=lang.startsWith('zh')?'zh':lang;
  const pg=title?await wikiExtractByTitle(title,wikiLang):null;
  if(token!==panelToken||LANG!==lang)return;
  const nm=title||w.en||w.ja;
  const raw=pg?.extract;
  const summary=raw?trimSummary(raw,260):PlaceUI.summary({['name:'+lang]:nm},lang);
  panelShell({adTier:3,name:nm,ja:lang==='ja'?'':w.ja,
    bodyHTML:'<p class="place-summary">'+esc(summary)+'</p>'+(!raw?'<p class="p-srcnote">'+esc(t('noSummary'))+'</p>':''),
    at:[w.lat,w.lon],img:pg?.thumbnail?.source||airPhoto(w.lat,w.lon),cap:pg?.thumbnail?'':t('photoAir'),
    wiki:'https://'+(title?wikiLang:'ja')+'.wikipedia.org/wiki/'+encodeURIComponent(title||w.ja),
    wikiLabel:title?t('readWiki'):t('readWikiJa'),searchName:w.ja,
    share:{title:nm,url:location.origin+location.pathname},src:'Wikipedia (CC BY-SA 4.0)'});
}

/* Tapping a stone is the first moment we need the full text. */
async function openMonument(id){
  const cached = MON_BY_ID.get(id);
  if (cached){ showMonument(cached); return; }
  /* 碑の本文は1.6MB。取りに行っているあいだに別のスポットが開かれることがある。
     そのまま戻ってきて showMonument を呼ぶと、今出ているパネルを丸ごと
     別の場所の内容で置き換えてしまう（showWiki と同じ種類の取り違え）。 */
  const myToken = panelToken;
  await loadMonuments();
  if (myToken !== panelToken) return;
  const r = MON_BY_ID.get(id);
  if (r) showMonument(r);
}

function showMonument(r,refresh=false){
  lastPanel = () => showMonument(r,true);
  current = null;
  const en = kindsRaw(r.kind).map(k => KIND_EN[k]);
  const out = kindsOut(r.kind);
  const dYear = (String(r.dis).match(/(1[6-9]\d{2}|20\d{2})/) || [])[0];
  const built = (String(r.year).match(/(1[6-9]\d{2}|20\d{2})/) || [])[0];
  const head = out.length
    ? (LANG === 'en' ? out[0] + ' ' + t('memorial') : out[0] + t('memorial'))
    : t('memorialStone');
  const body = '<p>' + t('stoneBody') + '</p>'
    + (out.length ? '<p>' + t('stoneRecords') + ': <b>' + esc(out.join(' / ')) + '</b>'
        + (dYear ? ', ' + dYear : '') + '</p>' : '')
    + (dYear ? '<p class="p-when">' + t('yearsAgo')(NOW_YEAR - (+dYear)) + '</p>' : '')
    + '<p class="jp-note">' + t('stoneJa') + '</p>'
    + '<p class="jp-raw">' + esc(r.info || r.name) + '</p>';
  panelShell({
    kicker: { emoji: KIND_EMOJI[en[0]] || '🪧', label: out.join(' / ') || t('memorialStone'),
              note: built ? '  ' + t('erected') + ' ' + built : '' },
    adTier:3, ja: r.name, name: head, kind: 'lore', searchName: r.name, bodyHTML: body, img: r.img, cap: r.addr,
    relatedArea: true,     // 種類は出さない。伝承碑に「記念碑とは」は何も教えない
    at: [r.lat, r.lon], share: { title: head, url: location.origin + location.pathname },
    src: LANG === 'en' ? 'Natural Disaster Memorial Monuments, Geospatial Information Authority of Japan.'
                       : '国土地理院「自然災害伝承碑」'
  });
}


/* ---------------------------------------------------------------------
   説明の無い地元スポットに、2〜3行の説明を組み立てる（2026-09-09 花平さんの指示）。

   実測: 216,464件のうち **192,584件が説明を持たない**（wikipedia も description も
   inscription も無い）。それらは『説明がありません』とだけ出ていた。

   **タグに書いてあることしか書かない。** 推測・創作はしない。材料が無ければ
   何も返さず、従来どおりの表示に任せる。出典が「地図のタグ」であることは必ず出す。

   データに焼き込まずここで組み立てる理由: 192,584件×3行は約29MBあり、
   いまの配信33MBをほぼ倍にする。地図が重くなる原因を自分で作ることになる。
   タグは既に手元にあるので、文章は0バイトで作れる。 */
/* その地点の空中写真。写真が1枚も無いスポットのための最後の受け皿。
   z17 は建物が1軒ずつ見える大きさ。地図が読むタイルと同じURLなので、
   Service Worker のタイルキャッシュにそのまま乗る（新しい通信先を増やさない）。 */
function airPhoto(lat, lon){
  return tileURL(NOW_LAYER.id, NOW_LAYER.ext, lat, lon, 17);
}

function localSummary(tg){ return PlaceUI.summary(tg, LANG); }

function showLocal(p,refresh=false){
  lastPanel = () => showLocal(p,true);
  current = null;
  const tg = p.tags, nm = localName(tg) || t('localSpot');
  const bits = [];
  const description = tg['description:' + LANG] || (LANG==='zh-Hans'?tg['description:zh-CN']:LANG==='zh-Hant'?tg['description:zh-TW']:'') || (LANG === 'ja' ? tg.description : '');
  if (description) bits.push('<p class="place-summary">' + esc(trimSummary(description, 220)) + '</p>');
  else bits.push('<p class="place-summary">' + esc(localSummary(tg)) + '</p><p class="p-srcnote">' + esc(t('srcTags')) + '</p>');
  if (tg.inscription) bits.push('<details class="original-text"><summary>' + esc(t('showOriginal')) + '</summary><p lang="ja">' + esc(tg.inscription) + '</p></details>');
  const wl = wikiTagLink(tg.wikipedia);
  panelShell({
    kicker: { emoji: localEmoji(tg), label: localLabel(tg), note: '  ' + nm },
    /* 検索語には本当の名前だけを渡す。nm は名無しのとき
       t('localSpot')（「地元の名所」）に化けるので、そのまま問いにすると
       総称を検索してしまう。名前が無ければ市町村名だけで問う。 */
    ja: LANG !== 'ja' && nm !== (tg['name:ja'] || tg.name) ? (tg['name:ja'] || tg.name || '') : '', name: nm,
    searchName: tg['name:ja'] || tg.name || '',
    bodyHTML: bits.length ? bits.join('')
            : (localSummary(tg)
               ? '<p>' + esc(localSummary(tg)) + '</p>'
                 + '<p class="p-srcnote p-weak">' + esc(t('srcTags')) + '</p>'
               : '<p class="p-hint">' + t('noSummary') + '</p>'),
    img: airPhoto(p.lat, p.lon), cap: t('photoAir'),
    travelTags:tg, adTier:4, kind:tg.historic==='memorial'?'memorial':(tg.tourism||tg.historic||tg.railway||''), at: [p.lat, p.lon], share: { title: nm, url: location.origin + location.pathname },
    wiki: wl ? wl.url : '',
    relatedKind: tg,
    relatedArea: !wl,          // 自分の記事があるならまちは要らない（Nominatimも叩かない）
    wikiLabel: (wl && wl.translated) ? t('readWikiJa') : t('readWiki'),
    src: LANG === 'en' ? '© OpenStreetMap contributors (ODbL).'
                       : '© OpenStreetMap contributors（ODbL）'
  });
}

/* -------------------------------------------------------------------------
   Saved spots. Deliberately local-only: no account, no server, nothing leaves
   the device. For a children's site that is the right default.
   ------------------------------------------------------------------------- */
const SAVE_KEY = 'tn-saved';
function readSaved(){
  try { return PlaceUI.savedRows(JSON.parse(localStorage.getItem(SAVE_KEY) || '[]')); } catch(e){ return []; }
}
function writeSaved(v){
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(PlaceUI.savedRows(v))); } catch(e){ toast(uiText('saveFailed')); return false; }
  renderSaved(); paintSaveBtn(); return true;
}
function savedKey(o){ return o.lat.toFixed(5) + ',' + o.lon.toFixed(5); }
function isSaved(o){ return readSaved().some(x => x.k === savedKey(o)); }
/* Saving used to change one word on a button and nothing else, so people could
   not tell whether it had worked. Now: the button fills in, the counter in the
   corner pulses, and a line of text says what happened. */
function toggleSave(){
  if (!compareAt) return;
  const o = { lat: compareAt[0], lon: compareAt[1] };
  const k = savedKey(o), list = readSaved();
  const i = list.findIndex(x => x.k === k);
  const name = $('pName').textContent;
  const added = i < 0;
  if (added) list.push({ k: k, lat: o.lat, lon: o.lon, name: name });
  else list.splice(i, 1);
  if (!writeSaved(list)) return;
  paintSaveBtn();
  toast(added ? t('savedToast')(name) : t('unsavedToast')(name));
  const badge = $('myCount');
  if (badge){ badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop'); }
}
function paintSaveBtn(){
  const on = compareAt && isSaved({ lat: compareAt[0], lon: compareAt[1] });
  $('pSave').textContent = on ? t('saved') : t('save');
  $('pSave').classList.toggle('is-on', !!on);
  $('pSave').setAttribute('aria-pressed', String(!!on));
}
function savedDisplayName(row){
  const p=[...PLACES,...LANDMARKS,...LIMINAL,...ACTIVITIES].find(p=>Math.abs(p.lat-row.lat)<0.00002&&Math.abs(p.lon-row.lon)<0.00002);
  return p?placeName(p):row.name;
}
function renderSaved(){
  const list = readSaved();
  $('myCount').textContent = (list.length ? '★ ' : '☆ ') + list.length;
  const b2 = $('myCount2');
  if (b2){ b2.textContent = (list.length ? '★' : '☆') + list.length; }
  const box = $('myList');
  if (!box) return;
  box.innerHTML = list.length
    ? list.slice().reverse().map(x => '<div class="saved-row"><button class="my-item" data-k="'+esc(x.k)+'">'+esc(savedDisplayName(x)||t('localSpot'))+'</button><button class="saved-delete" data-del="'+esc(x.k)+'" aria-label="'+esc(PlaceUI.pick(['Remove','削除','삭제','删除','刪除'],LANG)+' '+x.name)+'">×</button></div>').join('')
    : '<p class="my-empty">'+t('myEmpty')+'</p>';
  for(const b of box.querySelectorAll('.my-item'))b.onclick=()=>{
    const row=readSaved().find(x=>x.k===b.dataset.k);if(!row)return;
    if(!roaming)openMap();map.setView([row.lat,row.lon],17);showSavedSpot(row);
  };
  for(const b of box.querySelectorAll('.saved-delete'))b.onclick=()=>writeSaved(readSaved().filter(x=>x.k!==b.dataset.del));

}
/* 案内文の数字はデータから入れる。手書きは必ず古くなる。
   実例（2026-09-07）: リミナルを 33→26 に削ったあともここは「31か所」のまま、
   SEO 側は「30」、コードの注釈は「33」と、一つの事実に4つの数字があった。 */
function guideNum(n){ return n.toLocaleString(LANG === 'ja' ? 'ja-JP' : 'en-GB'); }
function guideFill(html){
  const v = { places: PLACES.length, lim: LIMINAL.length,
              monu: MON_INDEX.length,
              locals: regionList ? regionList.reduce((a, r) => a + r.c, 0) : 0 };
  /* まだ届いていないものは 0 になる。「0か所」と言い切るのは嘘なので伏せ字を出す。 */
  return html.replace(/[{](places|lim|monu|locals)[}]/g,
    (m, k) => v[k] ? guideNum(v[k]) : '…');
}
function renderGuide(){
  $('guideBody').innerHTML = guideFill(t('guideHTML'));
  /* 索引と伝承碑は地図を見るまで読んでいない。届いたら数字だけ入れ直す。 */
  if (regionList && MON_INDEX.length) return;   // [] は truthy なので長さで見る
  Promise.all([regionList ? null : loadRegionIndex(),
               MON_INDEX.length ? null : loadMonumentIndex()])
    .then(() => { if (!$('guide').hidden) $('guideBody').innerHTML = guideFill(t('guideHTML')); });
}

function snsLinks(){
  const url = (sharePayload && sharePayload.url) || location.href;
  const title = ((sharePayload && sharePayload.title) ? sharePayload.title + ' — ' : '')
              + 'Japan, Then and Now';
  $('snsX').href    = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(title)
                    + '&url=' + encodeURIComponent(url);
  $('snsFb').href   = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url);
  $('snsLine').href = 'https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(url);
}

function showLiminal(p, keepView,refresh=false){
  lastPanel = () => showLiminal(p, true,true);
  const hook = (p.hooks && p.hooks[LANG]) || (LANG === 'ja' ? p.hook_ja : p.hook);
  const why = LANG === 'ja' ? p.why_ja : LANG === 'en' ? p.why : '';
  /* Wikipedia の要約は言語ごとに別の記事から取る。2026-09-09 まで extract は1つしか無く、
     どちらの言語から取れたかで中身の言語が変わっていた。explore.js 側もここだけ
     言語で分岐していなかったため、**英語表示なのに説明が日本語で出ていた**
     （花平さんの指摘。中野ブロードウェイで実測、日本語率84%。逆に日本語表示では
     16件が英語のままだった）。
     **無い言語は「出さない」を選ぶ。**機械翻訳を作って Wikipedia の文として
     見せることはしない。説明は why（自前の英文・和文）が担う。 */
  const extract = LANG === 'ja' ? (p.extract_ja || '') : (p.extract || '');
  document.body.classList.remove('roaming');
  $('home').hidden = true; $('place').hidden = false;
  ensureMap();
  // Only frame the spot when you arrive from the list. Tapping the marker again,
  // or switching language, must not throw away where you had scrolled to.
  if (!keepView) map.setView([p.lat, p.lon], 15);
  setTimeout(() => map.invalidateSize(), 60);
  setThenLayer(null, null);
  drawSpots([{ lat: p.lat, lon: p.lon, name: placeName(p), emoji: p.emoji }],
            true, () => showLiminal(p, true));
  roaming = false; current = null;
  drawDetail();
  setTimeout(drawDetail, 900);

  panelShell({
    kicker: { emoji: p.emoji, label: t('modeLiminal'), note: '  ' + placeName(p) },
    placeId:'l-'+p.id, adTier:POP_LIM, kind:'liminal', ja: p.ja, name: placeName(p), at: [p.lat, p.lon], query: p.name,
    bodyHTML: '<p>' + esc(hook) + '</p>'
            + (why ? '<h3 class="p-h3">' + t('liminalWhat') + '</h3><p>' + esc(why) + '</p>' : '')
            + (p.note && LANG==='en' ? '<p class="p-pick">' + esc(p.note) + '</p>' : '')
            + ((LANG==='en'||LANG==='ja') && (p.extract||p.extract_ja) ? extractHTML({...p,summaries:null},220) : ''),
    img: p.img || tileURL(NOW_LAYER.id, NOW_LAYER.ext, p.lat, p.lon, 17),
    cap: p.img ? t('photoBy') : '',
    wiki: (articleLink(p) || {}).url || '',
    wikiLabel: (articleLink(p) || {}).label,
    share: { title: p.name, url: location.origin + location.pathname + '#l-' + p.id },
    searchName: p.ja,
    src: ((articleLink(p) || {}).src || '') + ' ' + t('photoBy') + '.'
  });
  /* 言語切替やマーカー再タップでも showLiminal は呼ばれる。そのたびに同じ
     #l-<id> を積むと、戻るボタンを押しても同じ画面に戻るだけで効かなく見える。
     openPlace は既に同じ守りを持っている。 */
  if (!keepView) history.pushState({ lim: p.id }, '', '#l-' + p.id);
}

/* =========================================================================
   8. Search / location / share
   ========================================================================= */
let qTimer = null, qComposing = false;
$('q').addEventListener('compositionstart', () => { qComposing = true; clearTimeout(qTimer); ++qSeq; });
$('q').addEventListener('compositionend', () => { qComposing = false; $('q').dispatchEvent(new Event('input')); });
$('q').addEventListener('input', () => {
  ++qSeq;
  const v = $('q').value.trim();
  $('qClear').hidden = !v;
  clearTimeout(qTimer);
  $('qResults').hidden = true;
  clearNationalSearch();
  if (!v){showSearchSuggestions();return;}
  if(qComposing)return;
  qTimer = setTimeout(() => runSearch(v), 450);   // stay inside Nominatim's policy
});

/* Enter で「入力にいちばん近い場所」へ飛ぶ。2026-09-09 追加。
   それまで Enter は何も起きず、候補を指で押すしかなかった（実測で確認）。
   候補が既に出ていれば先頭を押す。まだなら 450ms の待ちを飛ばして今すぐ引き、
   返ってきた先頭へ飛ぶ。Nominatim は関連度順に返すので先頭＝一番近い場所。
   記事名や地名を自分で組み立てることはしない。返ってきたものだけを使う。 */
$('q').addEventListener('keydown', e => {
  if (e.isComposing || qComposing) return;
  if (e.key === 'Escape'){ ++qSeq; $('qResults').hidden = true; return; }
  if (e.key === 'ArrowDown'){ const first = $('qResults').querySelector('button'); if (first && !$('qResults').hidden){e.preventDefault();first.focus();} return; }
  if (e.key !== 'Enter') return;
  e.preventDefault();                       // フォーム送信やページ再読込を止める
  const box = $('qResults');
  if(nationalHits.length&&nationalQuery===$('q').value.trim()){frameNationalHits();box.hidden=true;return;}
  const v = $('q').value.trim();
  if (!v) return;
  clearTimeout(qTimer);
  runSearch(v, true);                       // 引けたら先頭へ自動で飛ぶ
});
/* 飛んでいる検索の返事を無効にするための世代番号。これが無いと、✕で閉じたあとに
   古い返事が届いて結果が勝手に開き直る（[hidden] が効くようになった今は本当に再表示される）。 */
let qSeq = 0;
$('q').addEventListener('focus',()=>{if(!$('q').value.trim())showSearchSuggestions();else if(nationalHits.length){paintSearchList();$('qResults').hidden=false;}});
$('qClear').onclick = () => { clearNationalSearch(); ++qSeq; $('q').value = ''; $('qClear').hidden = true;
                              $('qResults').hidden = true; };

/* --- 自前スポットの検索（2026-09-09） --------------------------------
   照合用に文字を均す。ō→o、全角/半角、中黒や括弧の違いで外さないため。 */
const qnorm = PlaceUI.normalize;

let searchIndex = null;
function spotRows(){
  const key = PLACES.length + ':' + LIMINAL.length + ':' + LANDMARKS.length;
  if (searchIndex && searchIndex.key === key) return searchIndex.rows;
  const rows = [];
  for (const [kind, list] of [['place',PLACES],['liminal',LIMINAL],['landmark',LANDMARKS],['activity',ACTIVITIES]])
    for (const p of list) rows.push({kind,p,names:PlaceUI.names(p).map(qnorm)});
  searchIndex = {key,rows};
  return rows;
}

/* 近い順に返す。完全一致 > 前方一致 > 部分一致。
   打ちかけでも当たるよう、1文字から引く（日本語は1文字でも意味を持つ）。 */
function searchSpots(q){
  const nq = qnorm(q);
  if (!nq) return [];
  const hits = [];
  for (const row of spotRows()){
    let best = 0;
    for (const n of row.names){
      const nn = qnorm(n);
      if (!nn) continue;
      let sc = 0;
      if (nn === nq) sc = 100;
      else if (nn.indexOf(nq) === 0) sc = 80;
      else if (nn.indexOf(nq) > 0) sc = 60;
      else if (nq.length >= 3 && nq.indexOf(nn) >= 0) sc = 45;
      if (sc > best) best = sc;
    }
    if (best) hits.push({ kind: row.kind, p: row.p, score: best });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, 5);
}

/* 表示名は読み手の言語で。無ければ英語に落とす。 */
function spotLabelFor(row){ return placeName(row.p); }
function spotSubFor(row){
  const p = row.p;
  const other = (LANG === 'ja') ? p.name : (p.ja || '');
  const kind = row.kind === 'activity' ? activityLabel(p.category) : row.kind === 'liminal' ? t('modeLiminal')
             : row.kind === 'place'   ? t('modePlaces') : t('localSpot');
  return other ? (kind + ' · ' + other) : kind;
}
function openSpot(row){
  if (row.kind === 'activity') return showActivity(row.p);
  if (row.kind === 'liminal')  return showLiminal(row.p);
  if (row.kind === 'landmark') return showLandmark(row.p);
  return openPlace(row.p);
}

/* --- 全国の地点名検索（2026-09-09） ----------------------------------
   名前のついた地点は210,486件ある。全部を1本のJSONにすると gzip 2.9MB あり、
   検索のためだけに落とさせるには重い。先頭文字で64個に分けてあるので、
   打ち始めた1文字目のバケツ（最大385KB）だけ取る。

   引き換えの制限（正直に）: **先頭が一致する名前しか出ない。**
   「公園」と打って「○○公園」は出ない。全文にすると索引が数倍になるため、
   地名を頭から打つという実際の探し方に合わせた。 */
const NAT_BUCKETS = 64;
const natCache = new Map();          // バケツ番号 -> 行の配列
function natBucketOf(q){
  const k = String(q || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[\s\u3000\-–—_,.'’"()（）・･:：]/g, '').slice(0,1) || '_';
  let n = 0;
  for (const c of k) n += c.codePointAt(0);
  return n % NAT_BUCKETS;
}
async function natRows(q){
  const b = natBucketOf(q);
  if (natCache.has(b)) return natCache.get(b);
  try{
    const name = ('0' + b).slice(-2) + '.json';
    const rows = await fetch(dj('search/' + name)).then(r => r.ok ? r.json() : []);
    natCache.set(b, rows);
    if (natCache.size > 8) natCache.delete(natCache.keys().next().value);
    return rows;
  } catch(e){ return []; }
}
/* 手で選んだ79スポットと重なるものは出さない（同じ場所が二度並ぶと迷う）。 */
function natSearch(rows, q, skip){
  const nq = qnorm(q);
  if (!nq) return [];
  const pre = [], mid = [], coords = new Set();
  for (const r of rows){
    const nn = qnorm(r[0]);
    if (!nn) continue;
    if (skip.has(nn)) continue;
    const coordinate=r[1]+','+r[2];if(coords.has(coordinate))continue;
    const i = nn.indexOf(nq);
    if(i<0)continue;coords.add(coordinate);
    if (i === 0) pre.push(r);
    else if (i > 0) mid.push(r);
    if (pre.length >= 8) break;
  }
  return pre.concat(mid).slice(0, 8);
}
/* 押されたら、その場所へ寄ってから、地域データが届くのを待って
   その地点のパネルを開く（＝右に概要が出る）。 */
function openNational(row){
  if(!map||$('place').hidden||!roaming)noPush(openMap);
  map.setView([row[1],row[2]],17);
  showSavedSpot({name:row[0],lat:row[1],lon:row[2]});
}

/* Nationwide results: every match is painted on one canvas, with a keyboard list. */
let nationalWorker=null,nationalHits=[],nationalLayer=null,nationalQuery='',nationalSeq=0,nationalAllHits=[],nationalScope='all';
const searchText=(en,ja,ko,cn,tw)=>PlaceUI.pick([en,ja,ko,cn,tw],LANG);

const searchChoices=[
 ['♨️','Onsen','温泉','온천','温泉','溫泉'],['🏯','Castles','城','성','城堡','城堡'],['⛩️','Shrines','神社','신사','神社','神社'],['🛕','Temples','寺院','사찰','寺院','寺院'],
 ['🏛️','Museums','博物館','박물관','博物馆','博物館'],['🖼️','Art museums','美術館','미술관','美术馆','美術館'],['💧','Waterfalls','滝','폭포','瀑布','瀑布'],['🌄','Viewpoints','展望台','전망대','观景','觀景'],
 ['🚂','Abandoned railway','廃線跡','폐선','废弃铁路','廢棄鐵路'],['🕰️','Old town','古い町並み','옛 거리','老街','老街'],['🏭','Industrial heritage','産業遺産','산업유산','工业遗产','工業遺產'],['🚪','Liminal','リミナル','liminal','阈限','閾限'],
 ['🎿','Ski','スキー','스키','滑雪','滑雪'],['🌳','Parks','公園','공원','公園','公園'],['🌿','Gardens','庭園','정원','庭园','庭園'],['⛰️','Hiking','登山','등산','爬山','爬山'],
 ['🏖️','Beaches','海岸','해변','海滩','海灘'],['🕳️','Caves','洞窟','동굴','洞窟','洞窟'],['🦁','Zoos','動物園','동물원','动物园','動物園'],['🐠','Aquariums','水族館','아쿠아리움','水族馆','水族館'],
 ['🎡','Theme park','遊園地','놀이공원','游乐园','遊樂園'],['🚉','Stations','駅','기차역','车站','車站'],['✈️','Airports','空港','공항','机场','機場'],['☕','Cafes','カフェ','카페','咖啡','咖啡']
];
function showSearchSuggestions(){
 const box=$('qResults');box.replaceChildren();box.hidden=false;
 const heading=document.createElement('p');heading.className='q-help';heading.textContent=searchText('What would you like to find?','何を探しますか？','무엇을 찾으세요?','想找什么？','想找什麼？');box.appendChild(heading);
 const choices=document.createElement('div');choices.className='q-categories';
 for(const row of searchChoices){const label=PlaceUI.pick(row.slice(1),LANG),btn=document.createElement('button');btn.type='button';btn.textContent=row[0]+' '+label;btn.onclick=()=>{clearTimeout(qTimer);clearNationalSearch();$('q').value=label;$('qClear').hidden=false;runSearch(label,false,true);};choices.appendChild(btn);}box.appendChild(choices);
 const hint=document.createElement('p');hint.className='q-help';hint.textContent=searchText('Move the map, then choose Search this area to narrow the results.','地図を動かして「この範囲で探す」を選ぶと、地域を絞れます。','지도를 이동한 뒤 이 지역 검색으로 범위를 좁히세요.','移动地图后，选择搜索此区域来缩小范围。','移動地圖後，選擇搜尋此範圍來縮小範圍。');box.appendChild(hint);
}
function hitsInBounds(rows,bounds){return rows.filter(r=>bounds.contains([r.lat,r.lon]));}
function setSearchScope(scope){
 nationalScope=scope;nationalHits=scope==='view'&&map?hitsInBounds(nationalAllHits,map.getBounds()):nationalAllHits;
 searchSummary();paintSearchList();
 if(scope==='all'||nationalHits.length===1)frameNationalHits();else paintNationalHits();
}

function clearNationalSearch(){
 nationalSeq=0;nationalHits=[];nationalAllHits=[];nationalScope='all';nationalQuery='';nationalWorker?.postMessage({type:'cancel'});
 if(map&&nationalLayer){map.removeLayer(nationalLayer);nationalLayer=null;}
 document.getElementById('qSummary')?.remove();
}
function paintNationalHits(){
 if(!map)return;if(nationalLayer)map.removeLayer(nationalLayer);
 if(!nationalHits.length){nationalLayer=null;return;}
 const SearchLayer=L.Layer.extend({
  onAdd(m){this.map=m;this.canvas=L.DomUtil.create('canvas','search-halos');this.canvas.setAttribute('aria-hidden','true');
   m.getPanes().markerPane.appendChild(this.canvas);m.on('moveend zoomend resize',this.draw,this);m.on('click',this.pick,this);this.draw();},
  onRemove(m){m.off('moveend zoomend resize',this.draw,this);m.off('click',this.pick,this);this.canvas.remove();},
  draw(){const m=this.map,s=m.getSize(),d=Math.min(devicePixelRatio||1,2),c=this.canvas;
   L.DomUtil.setPosition(c,m.containerPointToLayerPoint([0,0]));c.width=s.x*d;c.height=s.y*d;c.style.width=s.x+'px';c.style.height=s.y+'px';
   const ctx=c.getContext('2d');ctx.scale(d,d);this.points=[];
   for(const row of nationalHits){const p=m.latLngToContainerPoint([row.lat,row.lon]);if(p.x< -14||p.y< -14||p.x>s.x+14||p.y>s.y+14)continue;
    this.points.push({p,row});ctx.beginPath();ctx.arc(p.x,p.y,12,0,Math.PI*2);ctx.fillStyle='rgba(255,181,30,.28)';ctx.fill();
    ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fillStyle='#ffb51e';ctx.fill();ctx.strokeStyle='#674000';ctx.lineWidth=1.5;ctx.stroke();
   }
  },
  pick(e){let best=null,dist=15;for(const p of this.points||[]){const d=e.containerPoint.distanceTo(p.p);if(d<dist){best=p.row;dist=d;}}if(best)openSearchHit(best);}
 });
 nationalLayer=new SearchLayer().addTo(map);
}
function openSearchHit(row){
 ++qSeq;nationalSeq=0;$('qResults').hidden=true;$('q').blur();
 if(!map||$('place').hidden)noPush(openMap);
 map.setView([row.lat,row.lon],17);
 if(row.kind==='monument'){openMonument(row.id);return;}
 if(row.facilityTags){showLocal({lat:row.lat,lon:row.lon,tags:row.facilityTags});return;}
 showSavedSpot(row);
}
function frameNationalHits(){
 if(!nationalHits.length)return;
 if(!map||$('place').hidden)noPush(openMap);
 if(nationalHits.length===1){openSearchHit(nationalHits[0]);paintNationalHits();return;}
 // Closing the overview gives the whole result set room without changing the query.
 closePanel();
 map.fitBounds(L.latLngBounds(nationalHits.map(r=>[r.lat,r.lon])),{padding:[48,80],maxZoom:14});
 paintNationalHits();
}
/* A search typed without Enter that would read many megabytes waits: the worker answers 'broad' and the reader chooses. */
function showBroadSearch(data){
 const box=$('qResults'),q=nationalQuery,mb=(data.bytes/1048576).toFixed(data.bytes<10485760?1:0);box.replaceChildren();box.hidden=false;
 const note=document.createElement('p');note.className='q-help';
 note.textContent=searchText('“'+q+'” matches places in '+data.files+' of the map’s files (about '+mb+' MB). Add another word, or search all of Japan now.','「'+q+'」の候補は全国の'+data.files+'ファイル（約'+mb+'MB）にあります。語を足すか、今すぐ全国を検索できます。','“'+q+'”의 후보가 전국 '+data.files+'개 파일(약 '+mb+'MB)에 있습니다. 단어를 더하거나 지금 일본 전국을 검색하세요.','“'+q+'”的候选分布在全国'+data.files+'个文件中（约'+mb+' MB）。可以再加一个词，或现在搜索全日本。','「'+q+'」的候選分布在全國'+data.files+'個檔案中（約'+mb+' MB）。可以再加一個詞，或現在搜尋全日本。');
 const all=document.createElement('button');all.type='button';all.className='q-item q-all';
 all.textContent=searchText('Search all of Japan','全国を検索する','일본 전국 검색','搜索全日本','搜尋全日本');
 all.onclick=()=>runSearch(q,false,true);
 box.append(note,all);
}
function searchSummary(){
 let el=document.getElementById('qSummary');
 if(!el){el=document.createElement('button');el.id='qSummary';el.className='q-summary';el.type='button';$('q').closest('.search-wrap')?.appendChild(el);
  if(!el.isConnected)$('qResults').parentElement.appendChild(el);el.onclick=()=>{paintSearchList();$('qResults').hidden=false;};}
 el.textContent='“'+nationalQuery+'” · '+nationalHits.length.toLocaleString()+' '+searchText('places','地点','곳','处','處')+(nationalScope==='view'?' · '+searchText('this area','この範囲','이 지역','此区域','此範圍'):'');
}
function paintSearchList(limit=30){
 const box=$('qResults');box.replaceChildren();box.hidden=false;
 const filters=document.createElement('div');filters.className='q-scope';
 for(const [scope,label] of [['all',searchText('All Japan','全国','일본 전국','全日本','全日本')],['view',searchText('Search this area','この範囲で探す','이 지역 검색','搜索此区域','搜尋此範圍')]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-pressed',String(nationalScope===scope));button.onclick=()=>setSearchScope(scope);filters.appendChild(button);}box.appendChild(filters);
 const count=document.createElement('button');count.type='button';count.className='q-item q-all';
 count.textContent=searchText('Show all matches on the map','一致した全地点を地図で見る','전체 결과를 지도에서 보기','在地图显示全部结果','在地圖顯示全部結果')+' ('+nationalHits.length.toLocaleString()+')';
 count.onclick=()=>{frameNationalHits();box.hidden=true;};box.appendChild(count);
 for(const row of nationalHits.slice(0,limit)){const btn=document.createElement('button');btn.type='button';btn.className='q-item';
  const name=document.createElement('b');name.textContent=row.name;btn.appendChild(name);btn.onclick=()=>openSearchHit(row);box.appendChild(btn);}
 if(nationalHits.length>limit){const more=document.createElement('button');more.type='button';more.className='q-item';more.textContent=searchText('Show more','もっと見る','더 보기','显示更多','顯示更多');more.onclick=()=>paintSearchList(limit+30);box.appendChild(more);}
 if(!nationalHits.length){const p=document.createElement('p');p.className='q-none';p.textContent=nationalScope==='view'?searchText('No matches here. Move the map or choose All Japan.','この範囲には該当地点がありません。地図を広げるか「全国」を選んでください。','이 지역에는 결과가 없습니다. 지도를 넓히거나 일본 전국을 선택하세요.','此区域没有结果，请扩大地图或选择全日本。','此範圍沒有結果，請擴大地圖或選擇全日本。'):searchText('No matching places in this map’s data.','この地図の収録データには該当地点がありません。','이 지도에 수록된 일치 장소가 없습니다.','本地图收录的数据中没有匹配地点。','本地圖收錄的資料中沒有符合地點。');box.appendChild(p);}
 const link=document.createElement('a');link.className='q-item';link.target='_blank';link.rel='noopener noreferrer';
 link.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(nationalQuery+' Japan');link.textContent=searchText('Search Google Maps ↗','Googleマップでも探す ↗','Google 지도에서 검색 ↗','在Google地图搜索 ↗','在Google地圖搜尋 ↗');box.appendChild(link);
}
async function runSearch(v,autoPick,explicit){
 const mine=++qSeq;nationalSeq=mine;nationalQuery=v;
 const box=$('qResults');box.hidden=false;box.innerHTML='<div class="q-none" role="status"></div>';
 const loading=searchText('Searching places across Japan…','全国の地点を検索しています…','일본 전국의 장소를 검색 중…','正在搜索日本各地…','正在搜尋日本各地…');box.firstChild.textContent=loading;
 try{
  if(!nationalWorker){nationalWorker=new Worker(assetUrl('search-worker.js'));
   nationalWorker.onmessage=({data})=>{
    if(data.seq!==qSeq||data.seq!==nationalSeq)return;if(data.type==='broad'){showBroadSearch(data);return;}
    if(data.type==='progress'){const status=box.querySelector('[role="status"]');if(status)status.textContent=loading+' '+Math.round(100*data.done/data.total)+'%';return;}
    if(data.type==='error'){box.innerHTML='<div class="q-none" role="status"></div>';box.firstChild.textContent=searchText('Some regions could not load. Please search again.','一部地域を読み込めませんでした。もう一度検索してください。','일부 지역을 불러오지 못했습니다. 다시 검색하세요.','部分地区加载失败，请重试。','部分地區載入失敗，請重試。');return;}
    nationalAllHits=data.rows;nationalScope='all';nationalHits=data.rows;searchSummary();paintSearchList();frameNationalHits();
   };
   nationalWorker.onerror=()=>{if(nationalSeq===qSeq){box.innerHTML='<div class="q-none">'+esc(searchText('Search could not load. Reload to try again.','検索を読み込めませんでした。再読み込みしてください。','검색을 불러오지 못했습니다. 새로고침하세요.','搜索加载失败，请刷新。','搜尋載入失敗，請重新整理。'))+'</div>';}nationalWorker.terminate();nationalWorker=null;};
  }
  nationalWorker.postMessage({type:'search',seq:mine,query:v,lang:LANG,dataV:DATA_V,auto:!autoPick&&!explicit});
 }catch{box.innerHTML='<div class="q-none">'+esc(t('noResults'))+'</div>';}
}

$('locBtn').onclick = () => {
  if (!navigator.geolocation){ toast(t('noGeo')); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    /* 許可を押すのが遅れると、最大10秒後にここへ来る。そのとき利用者は
       ホームやガイドに移っているかもしれない。地図を見ていないなら動かさない。
       roaming は「スポットが選ばれていない」の意味で、「地図が出ている」ではない。 */
    if ($('place').hidden) return;
    const la = pos.coords.latitude, lo = pos.coords.longitude;
    map.setView([la, lo], 16);
    if (meMarker) map.removeLayer(meMarker);
    meMarker = L.circleMarker([la, lo], { radius: 9, color: '#fff', weight: 3,
      fillColor: '#2f7bd6', fillOpacity: 1 }).addTo(map);
    toast(t('located'));
    setTimeout(drawDetail, 400);
  }, () => toast(t('noGeo')), { enableHighAccuracy: true, timeout: 10000 });
};

$('pSave').onclick   = toggleSave;
$('snsCopy').onclick = async () => {
  const url = (sharePayload && sharePayload.url) || location.href;
  try { await navigator.clipboard.writeText(url); toast(t('copied')); }
  catch(e){ showCopyLink(url); }
};
$('myBtn2').onclick = () => {
  closePlace(); setMode(isActivityMode(mode)?mode:'places');
  const sec = $('mySection');
  sec.hidden = false; renderSaved();
  setTimeout(() => sec.scrollIntoView({ behavior: 'smooth' }), 60);
};
$('myBtn').onclick = () => {
  const sec = $('mySection');
  sec.hidden = !sec.hidden;
  if (!sec.hidden){ renderSaved(); sec.scrollIntoView({ behavior: 'smooth' }); }
};
$('guideBtn').onclick = () => {
  const g = $('guide');
  g.hidden = !g.hidden;
  if (!g.hidden){ renderGuide(); g.scrollIntoView({ behavior: 'smooth' }); }
};

$('pShare').onclick = async () => {
  const url = (sharePayload && sharePayload.url) || location.href;
  const title = ((sharePayload && sharePayload.title) ? sharePayload.title + ' — ' : '')
              + 'Japan, Then and Now';
  if (navigator.share){
    try { await navigator.share({ title: title, url: url }); return; } catch(e){ if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast(t('copied')); }
  catch(e){ showCopyLink(url); }
};

/* =========================================================================
   9. Modes and navigation
   ========================================================================= */
function openPlace(p, keepView,refresh=false){
  current = p; roaming = false;
  document.body.classList.remove('roaming');
  $('home').hidden = true; $('place').hidden = false;
  ensureMap();
  if (!keepView){ map.setView([p.lat, p.lon], p.zoom); setTimeout(() => map.invalidateSize(), 60); }
  // The divider no longer appears by itself. It is noisy, and it should be the
  // reader's choice when to bring it up.
  setThenLayer(null, null);
  drawSpots([p], true, () => openPlace(p, true));
  drawDetail();                  // 周りの小さなスポットも出す
  setTimeout(drawDetail, 900);   // データと表示が落ち着いてからもう一度

  const story = LANG === 'ja' ? (p.story_ja || p.story) : LANG === 'en' ? p.story : [p.summaries[LANG]];
  const cap = p.monument && (LANG === 'ja' && p.monument.caption_ja
                             ? p.monument.caption_ja : p.monument.caption);
  panelShell({
    kicker: {emoji:p.emoji,label:t('modePlaces'),note:'  '+placeName(p)},
    placeId:p.id, adTier:p.pop||1, ja: LANG==='ja'?'':p.ja, name:placeName(p),
    query: p.name,
    bodyHTML: story.map(s => '<p>' + esc(s) + '</p>').join('') + '<p class="place-guide-link"><a href="/place/' + ({en:'',ja:'ja/',ko:'ko/','zh-Hans':'zh-cn/','zh-Hant':'zh-tw/'}[LANG] || '') + encodeURIComponent(p.id) + '">' + esc(({en:'Read the place guide',ja:'この場所の解説を読む',ko:'장소 안내 읽기','zh-Hans':'阅读地点指南','zh-Hant':'閱讀地點指南'})[LANG] || 'Read the place guide') + '</a></p>',
    img: p.monument && p.monument.img, cap: cap,
    at: [p.lat, p.lon], share: { title: p.name, url: location.origin + location.pathname + '#' + p.id },
    searchName: p.name_ja || p.ja,
    wiki: (articleLink(p) || {}).url || '',
    wikiLabel: (articleLink(p) || {}).label,
    src: p.source || ''
  });
  if (!keepView) history.pushState({ place: p.id }, '', '#' + p.id);
}

function openMap(){
  roaming = true; current = null;
  document.body.classList.add('roaming');
  $('home').hidden = true; $('place').hidden = false;
  ensureMap();
  if (!map._loaded || map.getZoom() < 5) map.setView(JAPAN.center, JAPAN.zoom);
  setTimeout(() => map.invalidateSize(), 60);
  setThenLayer(null, null);              // the divider is opt-in now
  if (spotLayer) spotLayer.clearLayers();   // the places are pins in drawDetail now
  $('panel').classList.remove('open');
  $('roamTip').hidden = false;
  clearTimeout(openMap._t);
  openMap._t = setTimeout(() => { $('roamTip').hidden = true; }, 6500);
  drawDetail();
  setTimeout(drawDetail, 900);
  history.pushState({ map: 1 }, '', '#map');
}

function closePlace(){
  document.body.classList.remove('roaming');
  roaming = false; current = null;
  lastPanel = null;                  // ホームに戻ったら、開き直す対象はもう無い
  $('cover').hidden = true; $('roamTip').hidden = true;
  $('place').hidden = true; window.AtlasWalking?.clear(); window.AtlasTime?.close(true);
  $('home').hidden = false;
}

/* The longer note under each home tab. modeNote keeps the count; this says what the list is
   and how to use it. Facts were checked against official pages on 2026-09-14
   (sources in DISCOVERY-MAINTENANCE.md and ACTIVITIES-MAINTENANCE.md). */
const MODE_INTRO = {
 en: {
  places: `<h2>Nineteen places to compare, then and now</h2><p>Every place on this list has something you can find in both photographs: a moat, a bend in a river, a temple on a hillside, a harbour wall. Find that first, then look at what changed around it.</p><p>The years on the cards are photo series, not the day a picture was taken. Most of the list uses the 1945–1950 series. Nagasaki, Hakodate, Himeji, Nara and Kanazawa use photographs from the 1960s, and Shuri from the 1970s. The Aneyoshi stone has no old photograph on its card; its warning is carved into the stone.</p><ul><li>Tap a card to open the map with its story, then press Compare and drag the line across the screen.</li><li>Every place also has a written guide with sources, listed under Featured places further down this page.</li></ul>`,
  liminal: `<h2>Before you go: what kind of place is it?</h2><p>Liminal describes a feeling, not the state of a place, and some of these places are busy on an ordinary day. Sorted by how you can visit:</p><ul><li><b>Still a working station.</b> Doai in Gunma is an unstaffed JR East station with about five trains each way a day. Its northbound platform is about 70 m underground, 486 steps down.</li><li><b>Still a working building.</b> Nakano Broadway in Tokyo opened in 1966 with shops below and homes above. People live upstairs.</li><li><b>Now a visitor site.</b> At the Ōya History Museum in Utsunomiya you walk into a former underground quarry. It keeps set opening hours and stays around 8°C inside all year.</li><li><b>Tour only.</b> You can land on Hashima (Gunkanjima) only with a landing tour from Nagasaki, and landings do not go ahead when waves or wind are outside the city’s limits.</li><li><b>Do not enter.</b> Closed hotels, ruins, anything fenced off or on private land. Look from public roads. A pin on this map is not permission to go inside.</li></ul><p><a href="/guides/liminal-japan">Read the full guide to visiting liminal places</a></p>`,
  food: `<h2>Markets and food streets, Sapporo to Naha</h2><p>Hakodate’s morning market, Aomori’s build-your-own seafood bowls, Omicho in Kanazawa, Nishiki in Kyoto, Dotonbori, Fukuoka’s yatai and Naha’s public market: eighteen places where the food is the reason to go, listed from north to south.</p><p>Every shop keeps its own hours, and morning markets mean it. Hakodate Morning Market, for example, runs from about 5 a.m. to 2 p.m. Check the official page linked from each spot before you set out.</p><p>Some markets ask you not to eat while walking. Nishiki Market asks you to eat in front of or inside the shop where you bought the food. The pin marks the area rather than a particular stall, and the card picture is today’s aerial photograph of the area, not the food.</p>`,
  shopping: `<h2>Shopping streets, old and new</h2><p>Covered arcades, specialist streets and a few districts everyone has heard of: Tanukikoji in Sapporo, the kitchen shops of Kappabashi, Ameyoko between Ueno and Okachimachi, Nakano Broadway, the canal district of Kurashiki and Kokusai-dori in Naha.</p><p>Several are older than they look. Kyoto’s Teramachi lines the street where Toyotomi Hideyoshi gathered temples in 1590, Tanukikoji has been trading since the early Meiji era, and Ameyoko began as a market just after the Second World War. Streets like these are worth checking with the comparison slider.</p><p>Pedestrian zones change the feel of a street: Ginza’s Chuo-dori at weekends and on public holidays (it can be cancelled for weather), and Akihabara’s on Sunday afternoons.</p><p>From 1 November 2026, tax-free shopping for visitors moves to a refund system: the tax is refunded once customs confirms, as you leave Japan within 90 days of purchase, that you are taking the goods out. Keep your passport with you, and see the <a href="https://www.nta.go.jp/publication/pamph/shohi/menzei/201805/format/002.htm" target="_blank" rel="noopener">National Tax Agency’s explanation</a>.</p>`,
  lab: `<h2>3D reconstruction: places rebuilt from photographs and records</h2><p class="lab-open"><a class="btn-3d" href="/3d/gunkanjima">▶ Open the Gunkanjima 3D model</a> <span class="lab-open-note">No. 1 · 1947 to today</span></p><p>A series that rebuilds a place building by building from aerial photographs, survey records and period photographs. Slide the years and each block rises in the year it was completed and falls in the year it collapsed. Tap a building for its year, storeys, use and photographs; the audio guide moves the model as it talks, and where the records allow you can step inside.</p><p>One place so far, Gunkanjima (Hashima), with the next in preparation. Documented parts and assumptions are drawn apart: assumptions are translucent. <a href="/3d/">The series page</a>.</p><p class="pod-home">🔊 Listen to the audio guide here (about 9 minutes; sound will play), or <a href="/3d/gunkanjima#play">open the 3D page with the player ready</a>.</p><audio class="pod-home-audio" controls preload="none" style="display:block;width:100%;max-width:28rem;margin:.4rem 0 0" src="/3d/audio/gunkanjima-podcast-en.mp3?v=6"></audio>`
 },
 ja: {
  places: `<h2>空から今昔くらべ　昔の航空写真と今を見くらべる19か所</h2><p>このリストのどの場所にも、昔と今の両方の写真で見つけられる目印があります。城の堀、川の曲がり、山すその寺、港の岸壁。まずそれを両方の写真で見つけてから、まわりで何が変わったかを探してください。</p><p>カードの年代は写真シリーズの期間で、撮影日ではありません。多くは1945〜1950年のシリーズで、長崎・函館・姫路・奈良・金沢は1960年代、首里は1970年代の写真です。姉吉の石のカードには昔の写真がありません。伝えたいことは、石に刻まれています。</p><ul><li>カードを押すと、物語つきで地図が開きます。「1945年と今を見くらべる」などのボタンを押し、線を左右に動かしてください。</li><li>各地点には出典つきの解説ページがあります。このページの下にある「物語のある名所」から開けます。</li></ul>`,
  liminal: `<h2>異世界スポットへ行く前に：どんな状態の場所か</h2><p>リミナルは雰囲気の名前で、場所の状態を表す言葉ではありません。ふだんは人でにぎわう場所も入っています。訪ね方で分けると、次のとおりです。</p><ul><li><b>いまも駅として使われている。</b>群馬の土合駅はJR東日本の無人駅で、列車は上下とも一日5本ほど。下りホームは地下約70m、486段の階段の先です。</li><li><b>いまも建物として使われている。</b>中野ブロードウェイは1966年開業の、下が店、上が住まいのビルです。上の階では人が暮らしています。</li><li><b>見学施設になっている。</b>宇都宮の大谷資料館では、大谷石の地下採掘場跡の中を歩けます。開館時間が決まっていて、中は一年を通して8℃前後です。</li><li><b>ツアーでしか行けない。</b>端島（軍艦島）に上陸できるのは長崎からの上陸ツアーだけで、波や風が市の基準を超えると上陸しません。</li><li><b>入らない。</b>閉鎖されたホテルや廃墟、柵の中や私有地。見るのは公道からにしてください。地図のピンは立ち入りの許可ではありません。</li></ul><p><a href="/guides/liminal-japan">リミナルな場所の訪ね方を詳しく読む（英語）</a></p>`,
  food: `<h2>ご当地グルメ旅　札幌から那覇まで、朝市・市場と食の通り</h2><p>函館朝市、自分で具を選ぶ青森ののっけ丼、金沢の近江町市場、京都の錦市場、道頓堀、福岡の屋台、那覇の公設市場。食べることが目的になる18か所を、北から南の順に並べています。</p><p>営業時間は店ごとに決まっていて、朝市は本当に朝の市場です。たとえば函館朝市は、おおむね朝5時から14時ごろまで。出かける前に、各スポットから開ける公式案内で確認してください。</p><p>食べ歩きを控えるよう求める市場もあります。錦市場は、買ったお店の前か店内で食べるよう呼びかけています。ピンは個別の店ではなくエリアの目印で、カードの画像は料理ではなく、その一帯の今の航空写真です。</p>`,
  shopping: `<h2>商店街ぶらり散歩　レトロな通りと、今の繁華街</h2><p>アーケード商店街、専門店の通り、誰もが名前を知る繁華街。札幌の狸小路、かっぱ橋道具街、上野と御徒町のあいだのアメ横、中野ブロードウェイ、倉敷の美観地区、那覇の国際通りなど18か所です。</p><p>見た目より歴史の古い通りもあります。京都の寺町は1590年に豊臣秀吉が寺を集めた通り、狸小路は明治のはじめから続く商店街、アメ横は終戦直後の闇市が始まりです。こうした通りは、昔と今の写真で見くらべてみる価値があります。</p><p>歩行者天国の日は通りの雰囲気が変わります。銀座の中央通りは土日祝（天候などで中止あり）、秋葉原の中央通りは日曜の午後が歩行者天国です。</p><p>2026年11月1日から、外国人旅行者の免税制度はリファンド方式に変わります。購入日から90日以内の出国時に税関で確認を受けると、消費税相当額が返金される仕組みです。旅券を持ち歩き、詳しくは<a href="https://www.nta.go.jp/publication/pamph/shohi/menzei/201805/format/002.htm" target="_blank" rel="noopener">国税庁の案内</a>を確認してください。</p>`,
  lab: `<h2>3Dでよみがえる　昔の写真と資料で、あの日の町並みへタイムスリップ</h2><p class="lab-open"><a class="btn-3d" href="/3d/ja/gunkanjima">▶ よみがえる軍艦島（端島）を3Dで開く</a> <span class="lab-open-note">第1回・1947年から現在まで</span></p><p>昔の空中写真と実測資料、当時の写真から、失われた町並みを建物ごとに3Dでよみがえらせるシリーズです。年代を動かすと建物は竣工年に立ち上がり、崩れた年に消えます。建物を押すと竣工年・階数・用途と写真が出て、音声ガイドに合わせて模型が動き、資料のある建物は中にも入れます。</p><p>いまは軍艦島（端島）の1か所で、次の場所は準備中です。出典のある部分と推定の部分を分けて描き、推定は半透明にしています。<a href="/3d/ja/">シリーズの一覧</a>。</p><p class="pod-home">🔊 軍艦島の音声ガイドはここでも聞けます（約10分・音が出ます）。<a href="/3d/ja/gunkanjima#play">3Dページを開いてすぐ再生</a>もできます。</p><audio class="pod-home-audio" controls preload="none" style="display:block;width:100%;max-width:28rem;margin:.4rem 0 0" src="/3d/audio/gunkanjima-podcast-ja.mp3?v=6"></audio>`
 },
 ko: {
  places: `<h2>옛 사진과 오늘을 비교하는 19곳</h2><p>이 목록의 모든 장소에는 옛 사진과 지금 사진 양쪽에서 찾을 수 있는 기준점이 있습니다. 성의 해자, 강의 굽이, 산기슭의 절, 항구의 안벽 같은 것들입니다. 먼저 그것을 양쪽에서 찾은 뒤, 주변에서 무엇이 달라졌는지 살펴보세요.</p><p>카드에 적힌 연도는 사진 시리즈의 기간이며 촬영일이 아닙니다. 대부분은 1945~1950년 시리즈이고, 나가사키·하코다테·히메지·나라·가나자와는 1960년대, 슈리는 1970년대 사진입니다. 아네요시 비석 카드에는 옛 사진이 없습니다. 전하고 싶은 말은 비석에 새겨져 있습니다.</p><ul><li>카드를 누르면 이야기와 함께 지도가 열립니다. ‘1945년과 오늘을 비교’ 같은 버튼을 누르고 선을 좌우로 움직여 보세요.</li><li>각 장소에는 출처가 달린 안내 페이지가 있습니다. 이 페이지 아래쪽 ‘이야기가 있는 명소’에서 열 수 있습니다.</li></ul>`,
  liminal: `<h2>가기 전에: 어떤 상태의 장소인가</h2><p>리미널은 분위기를 가리키는 말이지 장소의 상태가 아닙니다. 평소에는 사람이 많은 곳도 들어 있습니다. 방문 방법으로 나누면 다음과 같습니다.</p><ul><li><b>지금도 역으로 쓰인다.</b> 군마현의 도아이역은 JR 동일본의 무인역으로, 열차는 상하행 모두 하루 5편 정도입니다. 하행 승강장은 지하 약 70m, 486계단 아래에 있습니다.</li><li><b>지금도 건물로 쓰인다.</b> 나카노 브로드웨이는 1966년에 문을 연 상점·주거 복합 건물입니다. 위층에는 사람이 살고 있습니다.</li><li><b>견학 시설이 되었다.</b> 우쓰노미야의 오야 자료관에서는 오야석 지하 채굴장 터 안을 걸을 수 있습니다. 개관 시간이 정해져 있고, 안은 연중 8℃ 안팎입니다.</li><li><b>투어로만 갈 수 있다.</b> 하시마(군함도)는 나가사키에서 출발하는 상륙 투어로만 들어갈 수 있고, 파도나 바람이 시의 기준을 넘으면 상륙하지 않습니다.</li><li><b>들어가지 않는다.</b> 폐쇄된 호텔과 폐허, 울타리 안이나 사유지. 공공도로에서만 보세요. 지도 위의 핀은 출입 허가가 아닙니다.</li></ul><p><a href="/guides/liminal-japan">리미널 장소 방문 안내 전체 읽기(영어)</a></p>`,
  food: `<h2>삿포로에서 나하까지, 시장과 먹거리 거리</h2><p>하코다테 아침시장, 해산물을 골라 올리는 아오모리의 놋케동, 가나자와의 오미초 시장, 교토의 니시키 시장, 도톤보리, 후쿠오카의 포장마차, 나하의 공설시장까지. 먹는 것이 여행의 목적이 되는 18곳을 북쪽부터 남쪽 순서로 소개합니다.</p><p>영업시간은 가게마다 다르고, 아침시장은 정말 아침에 열립니다. 예를 들어 하코다테 아침시장은 대략 오전 5시부터 오후 2시까지입니다. 출발 전에 각 장소에서 열 수 있는 공식 안내를 확인하세요.</p><p>걸으면서 먹지 말아 달라고 요청하는 시장도 있습니다. 니시키 시장은 산 가게 앞이나 가게 안에서 먹어 달라고 안내합니다. 핀은 개별 가게가 아니라 지역을 나타내며, 카드 이미지는 음식이 아닌 그 일대의 현재 항공사진입니다.</p>`,
  shopping: `<h2>오래된 거리와 지금의 번화가</h2><p>아케이드 상점가, 전문점 거리, 누구나 이름을 아는 번화가. 삿포로의 다누키코지, 갓파바시 도구 거리, 우에노와 오카치마치 사이의 아메요코, 나카노 브로드웨이, 구라시키 미관지구, 나하의 국제거리 등 18곳입니다.</p><p>보기보다 역사가 오래된 거리도 있습니다. 교토의 데라마치는 1590년 도요토미 히데요시가 사찰을 모은 거리이고, 다누키코지는 메이지 시대 초기부터 이어진 상점가, 아메요코는 종전 직후의 암시장에서 시작되었습니다. 이런 거리는 옛 사진과 비교해 볼 만합니다.</p><p>보행자 천국인 날에는 거리 분위기가 달라집니다. 긴자 주오도리는 주말과 공휴일(날씨 등으로 중지될 수 있음), 아키하바라 주오도리는 일요일 오후에 보행자 천국이 됩니다.</p><p>2026년 11월 1일부터 외국인 여행자 면세 제도가 환급 방식으로 바뀝니다. 구입일로부터 90일 이내에 출국할 때 세관 확인을 받으면 소비세 상당액을 돌려받는 방식입니다. 여권을 지니고 다니고, 자세한 내용은 <a href="https://www.nta.go.jp/publication/pamph/shohi/menzei/201805/format/002.htm" target="_blank" rel="noopener">일본 국세청 안내</a>를 확인하세요.</p>`,
  lab: `<h2>3D 복원: 사진과 자료로 장소를 입체로 되살리다</h2><p class="lab-open"><a class="btn-3d" href="/3d/ko/gunkanjima">▶ 군함도(하시마) 3D 모델 열기</a> <span class="lab-open-note">1편 · 1947년부터 지금까지</span></p><p>항공사진, 실측 자료, 당시 사진으로 장소를 건물별로 입체 복원하는 시리즈입니다. 연도를 움직이면 건물은 준공년에 올라가고 무너진 해에 사라집니다. 건물을 누르면 준공년·층수·용도와 사진이 나오고, 음성 가이드에 맞춰 모형이 움직이며, 자료가 있는 건물은 안에도 들어갈 수 있습니다.</p><p>지금은 군함도(하시마) 한 곳이며 다음 장소를 준비 중입니다. 출처가 있는 부분과 추정 부분을 나누어 그리고, 추정은 반투명입니다. <a href="/3d/ko/">시리즈 목록</a>.</p><p class="pod-home">🔊 음성 가이드(영어·일본어, 약 9~10분·소리가 납니다)를 여기서 들을 수 있습니다. <a href="/3d/ko/gunkanjima#play">3D 페이지를 열어 바로 재생</a>할 수도 있습니다.</p><audio class="pod-home-audio" controls preload="none" style="display:block;width:100%;max-width:28rem;margin:.4rem 0 0" src="/3d/audio/gunkanjima-podcast-en.mp3?v=6"></audio>`
 },
 'zh-Hans': {
  places: `<h2>对照今昔的19个地点</h2><p>列表中的每个地点，都有在新旧两张照片里都能找到的参照物：护城河、河流的弯道、山脚的寺院、港口的岸壁。先在两张照片中找到它，再看看周围发生了什么变化。</p><p>卡片上的年份是照片系列的时期，不是拍摄日期。大多数地点使用1945–1950年系列，长崎、函馆、姬路、奈良和金泽使用1960年代的照片，首里则是1970年代。姉吉石碑的卡片没有旧照片，它要传达的话刻在石头上。</p><ul><li>点按卡片即可打开附带故事的地图。按下“把1945年与今天对照”等按钮，再左右拖动分隔线。</li><li>每个地点都有附出处的介绍页，可从本页下方的“有故事的景点”打开。</li></ul>`,
  liminal: `<h2>出发前：这是什么状态的地方？</h2><p>“阈限”描述的是一种氛围，而不是场所的状态。其中也有平常人来人往的地方。按照能否参观，可分为以下几类：</p><ul><li><b>仍在使用的车站。</b>群马县的土合站是JR东日本的无人车站，上下行每天各约5班列车。下行站台位于地下约70米，要走486级台阶。</li><li><b>仍在使用的建筑。</b>中野百老汇是1966年开业的商住综合楼，楼上仍有人居住。</li><li><b>已成为参观设施。</b>宇都宫的大谷资料馆可以走进大谷石地下采石场遗址，有固定开放时间，馆内全年约8℃。</li><li><b>只能随团前往。</b>端岛（军舰岛）只能参加从长崎出发的登岛团，浪高或风速超过市政府标准时不会登岛。</li><li><b>不要进入。</b>停业的酒店、废墟、围栏内或私人土地。请只在公共道路上观看。地图上的标记不代表可以进入。</li></ul><p><a href="/guides/liminal-japan">阅读完整的参观指南（英文）</a></p>`,
  food: `<h2>从札幌到那霸的市场与美食街</h2><p>函馆朝市、自选配料的青森海鲜盖饭、金泽近江町市场、京都锦市场、道顿堀、福冈屋台和那霸公设市场。按从北到南的顺序，介绍18个值得专程去吃的地方。</p><p>营业时间由各店自定，早市真的只在早上。比如函馆朝市大约从早上5点营业到下午2点。出发前请先查看各地点链接的官方信息。</p><p>有些市场请游客不要边走边吃。锦市场请大家在购买的店门前或店内享用。地图标记代表区域而非某家店，卡片图片是该区域现在的航拍照片，并非食物照片。</p>`,
  shopping: `<h2>老街与今日繁华街</h2><p>拱廊商店街、专门店街，以及人人都听过的繁华区：札幌狸小路、合羽桥道具街、上野与御徒町之间的阿美横、中野百老汇、仓敷美观地区和那霸国际通等18处。</p><p>有些街道的历史比外表更悠久。京都寺町是1590年丰臣秀吉集中寺院的街道，狸小路从明治初期延续至今，阿美横起源于战后初期的黑市。这样的街道值得用今昔对照看一看。</p><p>步行街开放的日子，街道气氛截然不同。银座中央通在周末和节假日（可能因天气取消）、秋叶原中央通在周日下午为步行街。</p><p>2026年11月1日起，日本面向外国游客的免税制度改为退税方式：在购买日起90天内出境时经海关确认后，退还相当于消费税的金额。请随身携带护照，详情请查看<a href="https://www.nta.go.jp/publication/pamph/shohi/menzei/201805/format/002.htm" target="_blank" rel="noopener">日本国税厅的说明</a>。</p>`,
  lab: `<h2>3D复原：用照片和资料把地点还原成立体</h2><p class="lab-open"><a class="btn-3d" href="/3d/zh-cn/gunkanjima">▶ 打开军舰岛（端岛）3D模型</a> <span class="lab-open-note">第1期 · 从1947年到今天</span></p><p>这是用航拍照片、实测资料和当年照片逐栋复原地点的系列。拖动年代，建筑在建成那年立起、在倒塌那年消失。点按建筑可查看竣工年、层数、用途和照片；音频导览会带动模型移动，有资料的建筑还能走进内部。</p><p>目前只有军舰岛（端岛）一处，下一处正在准备。有出处的部分与推定部分分开绘制，推定部分为半透明。<a href="/3d/zh-cn/">系列一览</a>。</p><p class="pod-home">🔊 也可在此收听音频导览（英语·日语，约9～10分钟，会发出声音），或<a href="/3d/zh-cn/gunkanjima#play">打开3D页面直接播放</a>。</p><audio class="pod-home-audio" controls preload="none" style="display:block;width:100%;max-width:28rem;margin:.4rem 0 0" src="/3d/audio/gunkanjima-podcast-en.mp3?v=6"></audio>`
 },
 'zh-Hant': {
  places: `<h2>對照今昔的19個地點</h2><p>清單中的每個地點，都有在新舊兩張照片裡都能找到的參照物：護城河、河流的彎道、山腳的寺院、港口的岸壁。先在兩張照片中找到它，再看看周圍發生了什麼變化。</p><p>卡片上的年份是照片系列的時期，不是拍攝日期。大多數地點使用1945–1950年系列，長崎、函館、姬路、奈良與金澤使用1960年代的照片，首里則是1970年代。姉吉石碑的卡片沒有舊照片，它要傳達的話刻在石頭上。</p><ul><li>點按卡片即可開啟附帶故事的地圖。按下「把1945年與今天對照」等按鈕，再左右拖曳分隔線。</li><li>每個地點都有附出處的介紹頁，可從本頁下方的「有故事的景點」開啟。</li></ul>`,
  liminal: `<h2>出發前：這是什麼狀態的地方？</h2><p>「閾限」描述的是一種氛圍，而不是場所的狀態。其中也有平常人來人往的地方。依能否參觀，可分為以下幾類：</p><ul><li><b>仍在使用的車站。</b>群馬縣的土合站是JR東日本的無人車站，上下行每天各約5班列車。下行月台位於地下約70公尺，要走486級階梯。</li><li><b>仍在使用的建築。</b>中野百老匯是1966年開業的商住綜合大樓，樓上仍有人居住。</li><li><b>已成為參觀設施。</b>宇都宮的大谷資料館可以走進大谷石地下採石場遺址，有固定開放時間，館內全年約8℃。</li><li><b>只能跟團前往。</b>端島（軍艦島）只能參加從長崎出發的登島行程，浪高或風速超過市政府標準時不會登島。</li><li><b>不要進入。</b>停業的飯店、廢墟、圍欄內或私人土地。請只在公共道路上觀看。地圖上的標記不代表可以進入。</li></ul><p><a href="/guides/liminal-japan">閱讀完整的參觀指南（英文）</a></p>`,
  food: `<h2>從札幌到那霸的市場與美食街</h2><p>函館朝市、自選配料的青森海鮮丼、金澤近江町市場、京都錦市場、道頓堀、福岡屋台與那霸公設市場。依由北到南的順序，介紹18個值得專程去吃的地方。</p><p>營業時間由各店自訂，早市真的只在早上。例如函館朝市大約從早上5點營業到下午2點。出發前請先查看各地點連結的官方資訊。</p><p>有些市場請遊客不要邊走邊吃。錦市場請大家在購買的店門前或店內享用。地圖標記代表區域而非某家店，卡片圖片是該區域現在的航拍照片，並非食物照片。</p>`,
  shopping: `<h2>老街與今日繁華街</h2><p>拱廊商店街、專門店街，以及人人都聽過的繁華區：札幌狸小路、合羽橋道具街、上野與御徒町之間的阿美橫、中野百老匯、倉敷美觀地區與那霸國際通等18處。</p><p>有些街道的歷史比外表更悠久。京都寺町是1590年豐臣秀吉集中寺院的街道，狸小路從明治初期延續至今，阿美橫起源於戰後初期的黑市。這樣的街道值得用今昔對照看一看。</p><p>行人徒步區開放的日子，街道氣氛截然不同。銀座中央通在週末與國定假日（可能因天候取消）、秋葉原中央通在週日下午為行人徒步區。</p><p>2026年11月1日起，日本針對外國旅客的免稅制度改為退稅方式：在購買日起90天內出境時經海關確認後，退還相當於消費稅的金額。請隨身攜帶護照，詳情請參閱<a href="https://www.nta.go.jp/publication/pamph/shohi/menzei/201805/format/002.htm" target="_blank" rel="noopener">日本國稅廳的說明</a>。</p>`,
  lab: `<h2>3D復原：用照片和資料把地點還原成立體</h2><p class="lab-open"><a class="btn-3d" href="/3d/zh-tw/gunkanjima">▶ 開啟軍艦島（端島）3D模型</a> <span class="lab-open-note">第1期 · 從1947年到今天</span></p><p>這是用航空照片、實測資料和當年照片逐棟復原地點的系列。拖曳年代，建築在建成那年立起、在倒塌那年消失。點按建築可查看竣工年、層數、用途和照片；語音導覽會帶動模型移動，有資料的建築還能走進內部。</p><p>目前只有軍艦島（端島）一處，下一處正在準備。有出處的部分與推定部分分開繪製，推定部分為半透明。<a href="/3d/zh-tw/">系列一覽</a>。</p><p class="pod-home">🔊 也可在此收聽語音導覽（英語·日語，約9～10分鐘，會發出聲音），或<a href="/3d/zh-tw/gunkanjima#play">開啟3D頁面直接播放</a>。</p><audio class="pod-home-audio" controls preload="none" style="display:block;width:100%;max-width:28rem;margin:.4rem 0 0" src="/3d/audio/gunkanjima-podcast-en.mp3?v=6"></audio>`
 }
};
function paintModeIntro(){
  const box = $('modeIntro');
  if (!box) return;
  const html = mode === 'map' ? '' : ((MODE_INTRO[LANG] || MODE_INTRO.en)[mode] || '');
  box.hidden = !html;
  box.innerHTML = html;
}

function modeNote(){
  /* まだ届いていないものは 0 になる。guideFill と同じで「0か所」と言い切るのは嘘なので
     伏せ字を出す。読み込み前・読み込み失敗のどちらでも 0 なので、ここで一緒に受ける。 */
  const n = c => (c || '…') + PlaceUI.pick([' places. ','か所。','곳. ','处。','處。'], LANG);
  if (mode === 'map' || roaming) return t('noteMap');
  if (isActivityMode(mode)) return n(ACTIVITIES.filter(p=>p.category===mode).length) + activityText(mode==='food'?2:3);
  if (mode === 'lab') return t('noteLab');
  if (mode === 'liminal') return n(LIMINAL.length) + t('noteLiminal');
  return n(PLACES.length) + t('notePlaces');
}

function setMode(m){
  mode = m;
  window.AtlasWalking?.refresh();
  for (const [id, key] of [['mPlaces','places'], ['mMap','map'], ['mLiminal','liminal'], ['mFood','food'], ['mShopping','shopping'], ['mLab','lab']]){
    $(id).classList.toggle('is-on', m === key);
    $(id).setAttribute('aria-selected', String(m === key));
  }
  $('cards').hidden = (m === 'map');
  $('modeNote').textContent = modeNote();
  const intro = $('limIntro');
  intro.hidden = m !== 'liminal';
  if (m === 'liminal') intro.innerHTML = t('limIntroHTML');
  paintModeIntro();
  if (m === 'map') openMap();
  else buildCards();
}

/* 5言語を順に回す。ボタンには**次に切り替わる言語**の名前を出すので、
   押す前に何になるか分かる。 */
/* 言語は一覧から選ぶ。5言語を順送りにすると繁体字→英語に4回押すことになる
   （2026-09-09 花平さんの指摘）。ボタンを押すと全部出す。 */
function buildLangMenu(){
  const box = $('langMenu');
  if (!box) return;
  box.innerHTML = LANG_ORDER.map(l =>
    '<button type="button" class="lang-item' + (l === LANG ? ' on' : '') +
    '" data-lang="' + l + '">' + esc(LANG_NAMES[l]) + '</button>').join('');
  for (const b of box.querySelectorAll('.lang-item'))
    b.onclick = () => { closeLangMenu(); setLang(b.dataset.lang); };
}
function openLangMenu(anchor){
  const box = $('langMenu');
  if (!box) return;
  buildLangMenu();
  box.hidden = false;
  /* 押したボタンの下に出す。地図側のボタンは画面右下にあるので、
     はみ出さないよう右端を合わせる。 */
  const r = anchor.getBoundingClientRect();
  const w = box.offsetWidth || 160;
  box.style.top  = Math.min(r.bottom + 6, innerHeight - box.offsetHeight - 8) + 'px';
  box.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
}
function closeLangMenu(){ const b = $('langMenu'); if (b) b.hidden = true; }
function toggleLangMenu(anchor){
  const b = $('langMenu');
  if (b && !b.hidden) closeLangMenu(); else openLangMenu(anchor);
}
document.addEventListener('click', e => {
  const b = $('langMenu');
  if (!b || b.hidden) return;
  if (!b.contains(e.target) && !e.target.closest('#langBtn, #langBtn2')) closeLangMenu();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLangMenu(); });

function nextLang(){
  const i = LANG_ORDER.indexOf(LANG);
  return LANG_ORDER[(i < 0 ? 0 : i + 1) % LANG_ORDER.length];
}
$('langBtn').onclick  = e => toggleLangMenu(e.currentTarget);
$('langBtn2').onclick = e => toggleLangMenu(e.currentTarget);
/* "English" links point at "/" so crawlers see the canonical home page. On the map app a
   plain link would come back in the saved or browser language, so switch in place. */
document.addEventListener('click', e => {
  const a = e.target.closest?.('a[data-set-lang]');
  if (!a || keepLinkClick(e) || !T[a.dataset.setLang]) return;
  e.preventDefault(); setLang(a.dataset.setLang);
});
$('mPlaces').onclick  = () => setMode('places');
$('mMap').onclick     = () => setMode('map');
$('heroSearch').onclick = () => {
  setMode('map');
  requestAnimationFrame(() => $('q').focus());
};
$('mLiminal').onclick = () => setMode('liminal');
$('mFood').onclick = () => setMode('food');
$('mShopping').onclick = () => setMode('shopping');
$('mLab').onclick = () => setMode('lab');
/* Close for good, not just collapse. Without this the sheet sat over the map
   with no way to dismiss it, so the markers underneath were unreachable. */
function closePanel(){
  const pn = $('panel');
  pn.classList.remove('open');
  pn.classList.add('closed');
  // back in roaming mode the sheet should stay out of the way until the next tap
  if (roaming) document.body.classList.add('roaming');
  compareAt = null;
  lastPanel = null;
  ++panelToken;          // 飛んでいる返事を無効にする。閉じたら何も書かせない
}
$('pClose').onclick   = closePanel;
$('grab').onclick     = () => {
  const pn = $('panel');
  if (pn.classList.contains('closed')){ pn.classList.remove('closed'); pn.classList.add('open'); }
  else pn.classList.toggle('open');
};
$('back').onclick     = () => history.back();
$('tagThen').onclick  = () => window.AtlasTime?.close(true);
$('pCompare').onclick = () => window.AtlasTime.open();

function noPush(fn, arg){
  // fn が投げると pushState がスタブのまま固定され、以後どの画面も履歴を積まなくなる
  const h = history.pushState;
  history.pushState = () => {};
  try { fn(arg); } finally { history.pushState = h; }
}
window.addEventListener('popstate', () => {
  if (window.AtlasWalking?.restore() || restoreActivity() || restoreSharedSpot()) return;
  if (location.hash === '#map' && PLACES.length){ noPush(openMap); return; }
  if (location.hash.startsWith('#l-') && LIMINAL.length){
    const q = LIMINAL.find(x => x.id === location.hash.slice(3));
    if (q){ noPush(showLiminal, q); return; }
  }
  const p = location.hash && PLACES.filter(x => x.id === location.hash.slice(1))[0];
  if (p){ noPush(openPlace, p); return; }
  closePlace(); setMode(isActivityMode(mode)?mode:'places');
});
document.addEventListener('keydown', e => {
  /* 入力欄で打っているキーを横取りしない。#q は #place の中にあり、
     くらべる中も出ているので、矢印で仕切りが動き Escape で記事から追い出されていた。 */
  const el = e.target;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
  if (e.key === 'Escape' && !$('place').hidden){
    if (!$('panel').classList.contains('closed')){ closePanel(); return; }
    history.back();
  }
  if (!thenLayer) return;
  if (e.key === 'ArrowLeft')  setSplit(splitX - 24);
  if (e.key === 'ArrowRight') setSplit(splitX + 24);
});


const DIRECTORY_TEXT={"en":["Japan Then & Now — Historical Maps and Hidden Places","Compare historical aerial photographs with today. Explore Japan’s castles, temples, stations and local places in English, Japanese, Korean, Simplified Chinese and Traditional Chinese.","Explore Japan across time","Open the map","Featured places","Liminal Japan","Saved on this browser","Save your favourite places on this browser. No account required; other devices have separate lists.","Historical aerial photographs","Coverage and years vary by location. The map shows the available survey year.","Search in 5 languages","Search place names, local names, and aliases across five supported languages."],"ja":["日本の今昔マップ｜古い空中写真と名所を探す","古い空中写真と現在の日本を地図で比較。城・寺社・駅・地域の小さな名所を、日本語・英語・韓国語・簡体字・繁体字の5言語で探せます。","日本の風景を、時間をこえて","地図を開いて探す","物語のある名所","リミナルな日本","このブラウザに保存","気になる地点を登録不要で保存できます。保存先はこのブラウザで、別の端末とは共有されません。","昔と今の空中写真","撮影年と収録範囲は地点によって異なります。利用できる写真の年代を地図に表示します。","5言語で検索","地名・駅名・現地名・別名から、5つの対応言語で地点を探せます。"],"ko":["일본 과거와 현재 지도 | 옛 항공사진과 숨은 명소","옛 항공사진과 현재의 일본을 지도에서 비교하세요. 성, 사찰, 역과 작은 지역 명소를 한국어·일본어·영어·중국어 간체·번체로 찾아볼 수 있습니다.","시간을 넘어 일본의 풍경을 만나다","지도에서 장소 찾기","이야기가 있는 명소","리미널 재팬","이 브라우저에 저장","회원가입 없이 마음에 드는 장소를 저장하세요. 저장 목록은 다른 기기와 공유되지 않습니다.","과거와 현재의 항공사진","지역에 따라 촬영 연도와 사진의 범위가 다릅니다. 이용 가능한 촬영 연도를 지도에 표시합니다.","5개 언어로 검색","지명, 역 이름, 현지 이름과 별칭으로 장소를 찾아보세요."],"zh-Hans":["日本今昔地图｜历史航拍照片与当地景点","在地图上对比日本的历史航拍照片与今日风景。用简体中文、繁体中文、日语、英语和韩语探索城堡、寺社、车站与当地小景点。","跨越时间，探索日本风景","打开地图寻找地点","有故事的景点","日本的阈限空间","保存在此浏览器","无需注册即可收藏地点。列表仅保存在此浏览器，不与其他设备同步。","昔日与今日航拍照片","拍摄年份和覆盖范围因地点而异。地图会显示可用照片的年代。","5种语言搜索","通过地名、站名、当地名称和别名查找地点。"],"zh-Hant":["日本今昔地圖｜歷史航拍照片與當地景點","在地圖上對比日本的歷史航拍照片與今日風景。用繁體中文、簡體中文、日語、英語和韓語探索城堡、寺社、車站與當地小景點。","跨越時間，探索日本風景","開啟地圖尋找地點","有故事的景點","日本的閾限空間","儲存在此瀏覽器","無需註冊即可收藏地點。清單僅儲存在此瀏覽器，不與其他裝置同步。","昔日與今日航拍照片","拍攝年份和涵蓋範圍因地點而異。地圖會顯示可用照片的年代。","5種語言搜尋","透過地名、站名、當地名稱和別名尋找地點。"]};
const ATLAS_READING={"en":"<section class=\"atlas-reading\"><h2>Explore Japan on foot, across time</h2><p>Japan Time Atlas is a free map for curious walks through Japan. Compare historical aerial photographs with the present-day map, then explore castles, neighbourhood streets, small local sights and places with a liminal atmosphere.</p><h3>Plan a walk beyond the main sights</h3><p>Start with Tokyo, Kyoto or Osaka, then look closely at the surrounding streets. A station, a small shrine, a waterfront or the remains of an old railway can become the starting point for a different kind of Japan itinerary. Save interesting places in this browser and open them again while planning your walk.</p><h3>Old maps, street photography and everyday history</h3><p>Use the comparison slider to study how coastlines, street patterns and neighbourhoods have changed. This is also a way to explore Japanese architecture and urban history from home. Historical photo coverage and survey years vary by location; use the year shown on the map rather than assuming every photograph was taken in 1945.</p><h3>Liminal Japan and retro places</h3><p>Discover unusual stations, former industrial sites and quiet spaces where the past feels close. Liminal is an atmosphere, not a promise that a place is empty or abandoned. Check official opening and access information before visiting, and explore only public or permitted areas.</p><h3>Markets and food streets</h3><p>The food list brings together morning markets, covered market streets, Fukuoka’s yatai and Naha’s public market, from Sapporo to Naha. Hours are set shop by shop, and some markets, such as Nishiki in Kyoto, ask visitors not to eat while walking.</p><h3>Shopping streets with a past</h3><p>The shopping list mixes covered arcades such as Tanukikoji, specialist streets such as Kappabashi, and districts such as Ginza and Harajuku. Some are much older than they look: Kyoto’s Teramachi lines the street where Toyotomi Hideyoshi gathered temples in 1590.</p></section>","ja":"<section class=\"atlas-reading\"><h2>古い地図から、次の街歩きへ</h2><p>Japan Time Atlasは、昔の航空写真と現在の地図を見比べながら、日本の街を歩きたい人のための無料地図です。有名な城や寺社だけでなく、路地、駅、地域の小さな名所にも目を向けてみてください。</p><h3>観光地の周りにある、小さな発見</h3><p>東京・京都・大阪などの名所を出発点に、周囲の道、水辺、小さな神社や鉄道跡を地図で探せます。気になった場所はこのブラウザに保存し、散歩や日帰り旅行の行き先を考えるときに見返せます。</p><h3>歴史散歩・古地図・街の写真撮影</h3><p>昔と今の写真をスライダーで比較し、街路や海岸線、建物の並びがどう変わったかを観察できます。旅行前の下調べだけでなく、日本の建築や都市の歴史を家から眺める楽しみ方にも向いています。撮影年と収録範囲は場所によって異なるため、地図に表示される年代をご確認ください。</p><h3>レトロな街並みとリミナルスペース</h3><p>独特な駅、産業遺産、時間が止まったように感じる場所を探します。静かに見える場所でも、現役の施設や私有地の場合があります。現地の公開情報と立入条件を確認し、公開・許可された範囲で楽しんでください。</p><h3>市場と食の通り</h3><p>札幌から那覇まで、朝市やアーケードの市場、福岡の屋台、那覇の公設市場を集めています。営業時間は店ごとに違い、京都の錦市場のように食べ歩きを控えるよう求める市場もあります。</p><h3>歴史のある商店街</h3><p>狸小路のようなアーケード商店街、かっぱ橋のような専門店の通り、銀座や原宿のような繁華街を集めています。京都の寺町は、1590年に豊臣秀吉が寺を集めた通りです。</p></section>","ko":"<section class=\"atlas-reading\"><h2>옛 지도에서 시작하는 일본 골목 여행</h2><p>Japan Time Atlas는 옛 항공사진과 현재 지도를 비교하며 일본을 걸어서 둘러보고 싶은 여행자를 위한 무료 지도입니다. 유명한 성과 사찰뿐 아니라 동네 골목, 작은 역, 지역의 숨은 명소도 찾아보세요.</p><h3>일본 자유여행과 소도시 산책</h3><p>도쿄, 교토, 오사카의 명소에서 출발해 주변 골목과 강변, 작은 신사, 옛 철도 흔적을 살펴보세요. 마음에 드는 장소를 이 브라우저에 저장해 산책이나 당일치기 여행을 계획할 때 다시 볼 수 있습니다.</p><h3>옛 사진으로 보는 일본의 거리와 건축</h3><p>슬라이더를 움직이며 도로와 해안선, 동네의 모습이 어떻게 달라졌는지 비교할 수 있습니다. 여행 준비는 물론 일본 건축, 도시의 역사, 거리 사진에 관심이 있는 분도 집에서 탐색할 수 있습니다. 촬영 연도와 범위는 장소마다 다르므로 지도에 표시된 연도를 확인하세요.</p><h3>레트로 감성과 리미널 스페이스</h3><p>독특한 역, 산업유산, 시간이 멈춘 듯한 공간을 찾아보세요. 리미널한 분위기라고 해서 폐허이거나 사람이 없는 곳이라는 뜻은 아닙니다. 방문 전에 공식 운영 정보와 출입 조건을 확인하고 공개되거나 허가된 구역만 이용하세요.</p><h3>시장과 먹거리 거리</h3><p>삿포로부터 나하까지 아침시장, 아케이드 시장, 후쿠오카의 포장마차, 나하의 공설시장을 모았습니다. 영업시간은 가게마다 다르며, 교토 니시키 시장처럼 걸으면서 먹지 말아 달라고 요청하는 곳도 있습니다.</p><h3>역사가 있는 상점가</h3><p>다누키코지 같은 아케이드 상점가, 갓파바시 같은 전문점 거리, 긴자와 하라주쿠 같은 번화가를 모았습니다. 교토의 데라마치는 1590년 도요토미 히데요시가 사찰을 모은 거리입니다.</p></section>","zh-Hans":"<section class=\"atlas-reading\"><h2>从老地图出发，走进日本的街巷</h2><p>Japan Time Atlas是一张免费的日本探索地图。对比历史航拍照片与现在的地图，在城堡、寺社等名胜之外，寻找街巷、小车站和当地的小众景点。</p><h3>日本自由行与城市漫步</h3><p>从东京、京都、大阪的名胜出发，看看周围的街道、河岸、小神社与旧铁路痕迹。把喜欢的地点保存在此浏览器中，规划散步、一日游或下一次日本旅行时再打开。</p><h3>老照片、街头摄影与城市历史</h3><p>移动滑块，观察街道、海岸线与街区如何变化。除了旅行准备，也可以在家探索日本建筑与城市历史，寻找街头摄影的灵感。历史照片的拍摄年份与覆盖范围因地点而异，请以地图显示的年份为准。</p><h3>复古街区与日本阈限空间</h3><p>探索独特的车站、工业遗产和仿佛时间停驻的空间。阈限感不代表某处已废弃或空无一人。出发前请确认官方开放信息与参观条件，仅进入公开或获准进入的区域。</p><h3>市场与美食街</h3><p>从札幌到那霸，收录早市、拱廊市场、福冈屋台和那霸公设市场。营业时间因店而异，也有像京都锦市场这样请游客不要边走边吃的市场。</p><h3>有历史的商店街</h3><p>收录狸小路等拱廊商店街、合羽桥等专门店街，以及银座、原宿等繁华区。京都寺町是1590年丰臣秀吉集中寺院的街道。</p></section>","zh-Hant":"<section class=\"atlas-reading\"><h2>從老地圖出發，走進日本的街巷</h2><p>Japan Time Atlas是一張免費的日本探索地圖。比較歷史航拍照片與現在的地圖，在城堡、寺社等名勝之外，尋找街巷、小車站與當地的私房景點。</p><h3>日本自由行與老街散策</h3><p>從東京、京都、大阪的名勝出發，看看周圍的街道、河岸、小神社與舊鐵路痕跡。將喜歡的地點儲存在此瀏覽器中，規劃散步、一日遊或下一趟日本旅行時再開啟。</p><h3>老照片、街頭攝影與城市歷史</h3><p>移動滑桿，觀察街道、海岸線與街區如何改變。除了旅行前的準備，也可以在家探索日本建築與城市歷史，尋找街頭攝影的靈感。歷史照片的拍攝年份與涵蓋範圍因地點而異，請以地圖顯示的年份為準。</p><h3>懷舊街景與日本閾限空間</h3><p>探索獨特的車站、產業遺產與彷彿時間停留的空間。閾限感不代表某處已廢棄或空無一人。出發前請確認官方開放資訊與參觀條件，僅進入公開或獲准進入的區域。</p><h3>市場與美食街</h3><p>從札幌到那霸，收錄早市、拱廊市場、福岡屋台與那霸公設市場。營業時間因店而異，也有像京都錦市場這樣請遊客不要邊走邊吃的市場。</p><h3>有歷史的商店街</h3><p>收錄狸小路等拱廊商店街、合羽橋等專門店街，以及銀座、原宿等繁華區。京都寺町是1590年豐臣秀吉集中寺院的街道。</p></section>"};
function paintDirectory(){
 const aboutLabels={"en":"About this site","ja":"このサイトについて","ko":"이 사이트에 대하여","zh-Hans":"关于本站","zh-Hant":"關於本站","th":"เกี่ยวกับเว็บไซต์นี้"};
 document.querySelectorAll('.site-about-link').forEach(a=>{a.textContent=aboutLabels[LANG]||aboutLabels.en;a.href='/about#'+LANG;});
 const supportLabels={"en":"☕ Support this site","ja":"☕ このサイトを支える","ko":"☕ 이 사이트 후원","zh-Hans":"☕ 支持本站","zh-Hant":"☕ 支持本站","th":"☕ สนับสนุนเว็บไซต์"};
 document.querySelectorAll('.site-support-link').forEach(a=>{a.textContent=supportLabels[LANG]||supportLabels.en;});
 document.querySelectorAll('.head-about').forEach(a=>{a.href='/about#'+LANG;const t=a.querySelector('.head-text');if(t)t.textContent=aboutLabels[LANG]||aboutLabels.en;a.setAttribute('aria-label',aboutLabels[LANG]||aboutLabels.en);});
 document.querySelectorAll('.head-support').forEach(a=>{const l=(supportLabels[LANG]||supportLabels.en).replace(/^\u2615\s*/,'');const t=a.querySelector('.head-text');if(t)t.textContent=l;a.setAttribute('aria-label',l);});
 const modelLabels={"en": "Gunkanjima in 3D ↗", "ja": "3Dでよみがえる軍艦島 ↗", "ko": "3D로 보는 군함도 ↗", "zh-Hans": "3D复原 军舰岛 ↗", "zh-Hant": "3D復原 軍艦島 ↗", "th": "Gunkanjima in 3D ↗"};
 const modelLinks={"en": "/3d/gunkanjima", "ja": "/3d/ja/gunkanjima", "ko": "/3d/ko/gunkanjima", "zh-Hans": "/3d/zh-cn/gunkanjima", "zh-Hant": "/3d/zh-tw/gunkanjima", "th": "/3d/gunkanjima"};
 document.querySelectorAll('.site-3d-link').forEach(a=>{a.textContent=modelLabels[LANG]||modelLabels.en;a.href=modelLinks[LANG]||modelLinks.en;});
 const shareLinks={"en": {"x": "https://x.com/intent/post?url=https%3A%2F%2Fjapantimeatlas.com%2F&text=Japan%20Time%20Atlas%20%E2%80%94%20old%20aerial%20photographs%20laid%20over%20the%20map%20of%20Japan%20today.&hashtags=JapanTimeAtlas", "fb": "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fjapantimeatlas.com%2F", "line": "https://social-plugins.line.me/lineit/share?url=https%3A%2F%2Fjapantimeatlas.com%2F"}, "ja": {"x": "https://x.com/intent/post?url=https%3A%2F%2Fjapantimeatlas.com%2Fja&text=%E6%97%A5%E6%9C%AC%E3%81%AE%E4%BB%8A%E6%98%94%E3%83%9E%E3%83%83%E3%83%97%E3%80%8CJapan%20Time%20Atlas%E3%80%8D%E3%80%82%E6%98%94%E3%81%AE%E7%A9%BA%E4%B8%AD%E5%86%99%E7%9C%9F%E3%82%92%E4%BB%8A%E3%81%AE%E5%9C%B0%E5%9B%B3%E3%81%AB%E9%87%8D%E3%81%AD%E3%81%A6%E3%80%81%E8%A1%97%E3%82%92%E6%AD%A9%E3%81%8F%E3%80%82&hashtags=JapanTimeAtlas,%E4%BB%8A%E6%98%94%E3%81%82%E3%82%8B%E3%81%8D", "fb": "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fjapantimeatlas.com%2Fja", "line": "https://social-plugins.line.me/lineit/share?url=https%3A%2F%2Fjapantimeatlas.com%2Fja"}, "ko": {"x": "https://x.com/intent/post?url=https%3A%2F%2Fjapantimeatlas.com%2Fko&text=Japan%20Time%20Atlas%20%E2%80%94%20%EC%98%9B%20%ED%95%AD%EA%B3%B5%EC%82%AC%EC%A7%84%EC%9D%84%20%EC%98%A4%EB%8A%98%EC%9D%98%20%EC%A7%80%EB%8F%84%EC%97%90%20%EA%B2%B9%EC%B3%90%20%EB%B3%B4%EB%8A%94%20%EC%A7%80%EB%8F%84.&hashtags=JapanTimeAtlas", "fb": "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fjapantimeatlas.com%2Fko", "line": "https://social-plugins.line.me/lineit/share?url=https%3A%2F%2Fjapantimeatlas.com%2Fko"}, "zh-Hans": {"x": "https://x.com/intent/post?url=https%3A%2F%2Fjapantimeatlas.com%2Fzh-cn&text=Japan%20Time%20Atlas%20%E2%80%94%20%E6%8A%8A%E6%97%A7%E8%88%AA%E6%8B%8D%E7%85%A7%E7%89%87%E5%8F%A0%E5%9C%A8%E4%BB%8A%E5%A4%A9%E7%9A%84%E6%97%A5%E6%9C%AC%E5%9C%B0%E5%9B%BE%E4%B8%8A%E3%80%82&hashtags=JapanTimeAtlas", "fb": "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fjapantimeatlas.com%2Fzh-cn", "line": "https://social-plugins.line.me/lineit/share?url=https%3A%2F%2Fjapantimeatlas.com%2Fzh-cn"}, "zh-Hant": {"x": "https://x.com/intent/post?url=https%3A%2F%2Fjapantimeatlas.com%2Fzh-tw&text=Japan%20Time%20Atlas%20%E2%80%94%20%E6%8A%8A%E8%88%8A%E8%88%AA%E6%8B%8D%E7%85%A7%E7%89%87%E7%96%8A%E5%9C%A8%E4%BB%8A%E5%A4%A9%E7%9A%84%E6%97%A5%E6%9C%AC%E5%9C%B0%E5%9C%96%E4%B8%8A%E3%80%82&hashtags=JapanTimeAtlas", "fb": "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fjapantimeatlas.com%2Fzh-tw", "line": "https://social-plugins.line.me/lineit/share?url=https%3A%2F%2Fjapantimeatlas.com%2Fzh-tw"}, "th": {"x": "https://x.com/intent/post?url=https%3A%2F%2Fjapantimeatlas.com%2Fth&text=Japan%20Time%20Atlas%20%E2%80%94%20%E0%B8%A0%E0%B8%B2%E0%B8%9E%E0%B8%96%E0%B9%88%E0%B8%B2%E0%B8%A2%E0%B8%97%E0%B8%B2%E0%B8%87%E0%B8%AD%E0%B8%B2%E0%B8%81%E0%B8%B2%E0%B8%A8%E0%B9%80%E0%B8%81%E0%B9%88%E0%B8%B2%E0%B8%8B%E0%B9%89%E0%B8%AD%E0%B8%99%E0%B8%9A%E0%B8%99%E0%B9%81%E0%B8%9C%E0%B8%99%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%8D%E0%B8%B5%E0%B9%88%E0%B8%9B%E0%B8%B8%E0%B9%88%E0%B8%99%E0%B8%A7%E0%B8%B1%E0%B8%99%E0%B8%99%E0%B8%B5%E0%B9%89&hashtags=JapanTimeAtlas", "fb": "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fjapantimeatlas.com%2Fth", "line": "https://social-plugins.line.me/lineit/share?url=https%3A%2F%2Fjapantimeatlas.com%2Fth"}};
 const shareLabels={"ja": "このサイトを共有", "en": "Share this site", "ko": "이 사이트 공유", "zh-Hans": "分享本站", "zh-Hant": "分享本站", "th": "แชร์เว็บไซต์นี้"};
 const sl=shareLinks[LANG]||shareLinks.en;
 document.querySelectorAll('.share-row').forEach(r=>{const t=r.querySelector('.share-label');if(t)t.textContent=shareLabels[LANG]||shareLabels.en;for(const [cls,key] of [['share-x','x'],['share-fb','fb'],['share-line','line']]){const a=r.querySelector('.'+cls);if(a)a.href=sl[key];}});
 const reading=document.getElementById('atlasReading');if(reading)reading.innerHTML=ATLAS_READING[LANG]||ATLAS_READING.en;
 const box=document.querySelector('.seo-list');if(!box||!PLACES.length)return;
 const d=DIRECTORY_TEXT[LANG].slice();d[0]=SEO[LANG].title;d[1]=SEO[LANG].description;
 box.innerHTML='<h2>'+esc(d[4])+'</h2><p>'+esc(d[1])+'</p>'+PLACES.map(p=>'<article><h3><a href="'+esc(placeURL(p.id))+'">'+esc(placeName(p))+'</a></h3><p>'+esc(p.hooks[LANG])+'</p></article>').join('')+'<nav class="locale-nav" aria-label="Language">'+Object.entries(LOCALE_HOME).map(([l,href])=>'<a href="'+href+'" lang="'+l+'"'+(l==='en'?' data-set-lang="en"':'')+'>'+esc(LANG_NAMES[l]||'ไทย')+'</a>').join('')+'</nav>';
}

const AUX_UI = {
 saveFailed:['Could not save on this browser. Check storage permissions.','このブラウザでは保存できませんでした。保存領域の設定をご確認ください。','이 브라우저에 저장할 수 없습니다. 저장 권한을 확인하세요.','无法在此浏览器中保存，请检查存储权限。','無法在此瀏覽器中儲存，請檢查儲存權限。'],
 saveNote:['Saved on this browser only. Other devices and browser profiles have separate lists.','保存先はこのブラウザです。別の端末・ブラウザのプロフィールとは共有されません。','이 브라우저에만 저장됩니다. 다른 기기·프로필과는 공유되지 않습니다.','仅保存在此浏览器中，不与其他设备或浏览器配置同步。','僅儲存在此瀏覽器中，不與其他裝置或瀏覽器設定檔同步。'],
 copy:['Copy link','リンクをコピー','링크 복사','复制链接','複製連結'],
 manual:['Select and copy this link','リンクを選択してコピー','링크를 선택해 복사하세요','请选择并复制链接','請選取並複製連結'],
 close:['Close','閉じる','닫기','关闭','關閉'],
 search:['Place or category: onsen, castle…','地名・温泉・城・神社など','장소·키워드 (스키, 사찰 등)','地点或关键词：滑雪、寺院等','地點或關鍵字：滑雪、寺院等']
};
const uiText = key => PlaceUI.pick(AUX_UI[key], LANG);
function paintAuxUI(){
  paintDirectory();
  $('qClear').setAttribute('aria-label',PlaceUI.pick(['Clear search','検索を消去','검색 지우기','清除搜索','清除搜尋'],LANG));
  $('q').placeholder=uiText('search');$('q').setAttribute('aria-label',uiText('search'));
  $('snsCopy').title=uiText('copy');$('snsCopy').setAttribute('aria-label',uiText('copy'));
  $('pShare').title=t('share');$('pShare').setAttribute('aria-label',t('share'));
  const note=$('saveNote');if(note)note.textContent=uiText('saveNote');
}
const localAliases = new Map();
function loadLocalAliases(q){
  const b=(qnorm(q).charCodeAt(0)||0)%64;
  if(!localAliases.has(b)){
    const promise=fetch(dj('search/aliases/'+String(b).padStart(2,'0')+'.json')).then(r=>{if(!r.ok)throw Error('aliases');return r.json();}).catch(()=>{localAliases.delete(b);return [];});
    localAliases.set(b,promise);if(localAliases.size>8)localAliases.delete(localAliases.keys().next().value);
  }
  return localAliases.get(b);
}
function showCopyLink(url){
  let box=$('copyDialog');
  if(!box){box=document.createElement('dialog');box.id='copyDialog';box.className='copy-dialog';document.body.appendChild(box);}
  box.innerHTML='<form method="dialog"><label for="copyURL">'+esc(uiText('manual'))+'</label><input id="copyURL" readonly><button>'+esc(uiText('close'))+'</button></form>';
  box.querySelector('input').value=url;box.showModal();box.querySelector('input').select();
}
function showSavedSpot(row){
  const all=[...PLACES.map(p=>({p,open:openPlace})),...LANDMARKS.map(p=>({p,open:showLandmark})),...LIMINAL.map(p=>({p,open:showLiminal})),...ACTIVITIES.map(p=>({p,open:showActivity}))];
  const known=all.find(x=>Math.abs(x.p.lat-row.lat)<0.00002&&Math.abs(x.p.lon-row.lon)<0.00002);
  if(known){known.open(known.p);return;}
  const local=[...LOCALS,...FACILITIES].find(p=>Math.abs(p.lat-row.lat)<0.00002&&Math.abs(p.lon-row.lon)<0.00002);
  if(local){showLocal(local);return;}
  showLocal({lat:row.lat,lon:row.lon,tags:{name:row.name||t('localSpot')}});
  let tries=0;const token=panelToken;
  const update=()=>{
    if(token!==panelToken||$('place').hidden)return;
    const known=[...PLACES.map(p=>({p,open:openPlace})),...LANDMARKS.map(p=>({p,open:showLandmark})),...LIMINAL.map(p=>({p,open:showLiminal})),...ACTIVITIES.map(p=>({p,open:showActivity}))].find(x=>Math.abs(x.p.lat-row.lat)<0.00002&&Math.abs(x.p.lon-row.lon)<0.00002);
    if(known){noPush(known.open,known.p);return;}
    const p=[...LOCALS,...FACILITIES].find(p=>Math.abs(p.lat-row.lat)<0.00002&&Math.abs(p.lon-row.lon)<0.00002);
    if(p){showLocal(p);return;}
    if(++tries<12)setTimeout(update,500);
  };setTimeout(update,400);
}
function restoreSharedSpot(){
  const m=/^#spot=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(location.hash);
  if(!m)return false;
  const lat=+m[1],lon=+m[2];if(Math.abs(lat)>90||Math.abs(lon)>180)return false;
  const name=new URLSearchParams(location.search).get('name')||'';
  const hash=location.hash;noPush(openMap);map.setView([lat,lon],17);
  showSavedSpot({lat,lon,name:name.slice(0,200)});return true;
}
window.addEventListener('storage',e=>{if(e.key===SAVE_KEY||e.key===null){renderSaved();paintSaveBtn();}});
$('qResults').addEventListener('keydown',e=>{
  if(e.key==='Escape'){++qSeq;$('qResults').hidden=true;$('q').focus();return;}
  if(!['ArrowDown','ArrowUp'].includes(e.key))return;
  const buttons=[...$('qResults').querySelectorAll('button')],i=buttons.indexOf(document.activeElement);
  if(i<0)return;e.preventDefault();const next=i+(e.key==='ArrowDown'?1:-1);
  (buttons[next]||$('q')).focus();
});

/* Other pages open the map with ?place=<id> (landmarks: ?spot=lat,lon) instead of a #hash,
   so the canonical article and the map view are different URLs. The app's own history still
   runs on hashes, so the query is turned into the hash the router already understands.
   Old #hiroshima bookmarks keep working, and an explicit hash wins over the query. */
function consumeMapQuery(){
  try {
    const url = new URL(location.href);
    const place = url.searchParams.get('place'), spot = url.searchParams.get('spot');
    if (place === null && spot === null) return;
    url.searchParams.delete('place'); url.searchParams.delete('spot');
    if (!url.hash){
      if (place && /^[a-z0-9-]{1,80}$/i.test(place)) url.hash = place;
      else if (spot && /^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/.test(spot)) url.hash = 'spot=' + spot;
    }
    const q = url.searchParams.toString();
    history.replaceState(history.state, '', url.pathname + (q ? '?' + q : '') + url.hash);
  } catch(e){}
}

/* =========================================================================
   10. Start
   ========================================================================= */
LANG = detectLang();
consumeMapQuery();
applyLang();
fetch(dj('data/places-world.json')).then(r => r.json()).then(j => {
  PLACES = j.places;
  paintDirectory();
  buildCards();
  /* 件数は起動時（applyLang → modeNote）に PLACES がまだ空のまま書かれる。
     ここで書き直さないと 19枚のカードの上に「0か所」が残る（タブを切り替えるまで直らない）。
     リミナル側は下の liminal.json の .then で同じことをしている。 */
  $('modeNote').textContent = modeNote();
  // Pre-load: when drawDetail() had to await these mid-flight, overlapping runs
  // cancelled each other and nothing was ever committed to the map.
  // Only the small index at start-up. The 1.6MB of monument text is fetched in
  // the background once the page is quiet, and awaited only if you tap a stone
  // before it lands.
  Promise.all([
    loadMonumentIndex(),
    Promise.all(['data/landmarks.json','data/regional-landmarks-v1.json'].map(file =>
      fetch(dj(file)).then(r => r.ok ? r.json() : null).catch(() => null)))
      .then(lists => { LANDMARKS = lists.flatMap(l => l?.landmarks || []).sort(
                    (a, c) => (a.pop || 3) - (c.pop || 3)
                           || (a.tier || 3) - (c.tier || 3)); }).catch(() => {}),
    fetch(dj('data/liminal.json')).then(r => r.ok ? r.json() : null)
      // 読み込み中にリミナルタブを押されていると、代入だけでは白紙の「0か所」が
      // 残り続ける（drawDetail は #place が隠れていれば即 return するため）。
      .then(l => { if (!l) return;
                   LIMINAL = l.places;
                   if (mode === 'liminal'){ buildCards(); $('modeNote').textContent = modeNote(); } })
      .catch(() => {}),
    fetch(dj('data/topics.json')).then(r => r.ok ? r.json() : null)
      .then(j => { if (j) TOPICS = j.t; }).catch(() => {}),
    fetch(dj('data/areas.json')).then(r => r.ok ? r.json() : null)
      .then(j => { if (j) AREAS = j; }).catch(() => {})
  ]).then(drawDetail);
  // Detailed monument text is loaded on demand when a memorial is opened.

  if (window.AtlasWalking?.restore() || restoreActivity() || restoreSharedSpot()) return;
  if (location.hash === '#map') noPush(openMap);
  else if (location.hash.startsWith('#l-')){
    const want = location.hash.slice(3);
    fetch(dj('data/liminal.json')).then(r => r.json()).then(l => {
      LIMINAL = l.places;
      const q = LIMINAL.find(x => x.id === want);
      if (q) noPush(showLiminal, q);
    }).catch(() => {});
  }
  else {
    const p = location.hash && PLACES.filter(x => x.id === location.hash.slice(1))[0];
    if (p) noPush(openPlace, p);
  }
}).catch(err => {
  $('cards').innerHTML = '<p style="color:#a9a396">Could not load the places ('
    + esc(err.message) + ').</p>';
});

/* FAQ が英日どちらでも「ホーム画面に追加するとアプリのように開く」「電波が無くても
   動く」と書いているのに、英語版だけ Service Worker を登録していなかった。
   書いてあることを本当にする。登録できなくてもアプリ自体は動く。 */
if ('serviceWorker' in navigator)
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('sw.js')
      .catch(e => console.warn('SW registration failed', e)));
