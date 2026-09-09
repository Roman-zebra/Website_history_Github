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
const DATA_V = '0.42';
const dj = u => u + (u.indexOf('?') < 0 ? '?v=' : '&v=') + DATA_V;
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
let LANG = localStorage.getItem('tn-lang') || 'en';

const T = {
  en: {
    lead: 'These are real photographs taken from aeroplanes.<br>Drag the slider and watch <b>eighty years</b> go by.',
    modePlaces: 'Featured places', modeMap: 'Whole map', modeLiminal: 'Liminal Japan',
    noteLiminal: 'Places that feel like nowhere \u2014 and most are near a city, so you can go.',
    heroSub: 'Before and after WW2 — 1945 vs today, on one map',
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
      mine, a station 486 steps underground served by four trains a day. Not ruins.
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
    lead: 'すべて飛行機から撮った本物の写真です。<br>線をドラッグすると<b>80年</b>が動きます。',
    modePlaces: '名所を見る', modeMap: '日本全体の地図', modeLiminal: 'リミナル',
    noteLiminal: 'どこでもない感じのする場所。多くは街から行ける距離にあります。',
    heroSub: '戦前と戦後 — 1945年と今を、ひとつの地図で',
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
      選びがちです。だから、客のいない温泉街、鉱山の閉じた鉱山町、486段下りて一日4本しか
      来ない駅が残る。廃墟ではない。かといって、生きているわけでもない。</p>
      <p class="lim-note">下に並んでいる場所はぜんぶ実在して、地図に載っています。
      多くは東京・大阪・福岡から行ける距離です。入れない場所もあります。
      その場合はページに書いてあります。入ってはいけないところには、入らないでください。</p>`,
    photoBy: '写真：Wikimedia Commons',
    notePlaces: '物語つきで選んだ名所。',
    noteMap: '日本のどこでも検索して、1945年と見くらべる。',
    credits: '地図・空中写真：<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>（国土地理院）。街路地図 © Esri。地点と住所：© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors（ODbL）。記事：ウィキペディア（CC BY-SA 4.0）。',
    search: '場所・駅名・住所で検索',
    roamTip: 'マーカーを押すと説明が出ます。そこから1945年と比べられます。',
    dragHint: 'ドラッグ', stopCompare: '比較をやめる',
    compareYear: y => y + '年と今を見くらべる',
    noOldPhoto: 'この地点を写した古い空中写真はありません。',
    readWiki: 'ウィキペディアで読む',
    aboutLead:     'この場所そのものの記事はありません。かわりに、こちらが読めます。',
    aboutLeadAlso: 'こちらも読めます。',
    aboutArea:     n => 'このあたりのまち：' + n,
    readWikiJa: 'ウィキペディアで読む',
    readWikiEn: '英語版ウィキペディアで読む', gmap: 'Googleマップ', share: '共有',
    zoomIn: '拡大すると1945年と比べられます。',
    noPhoto: p => 'このあたりでは' + p + 'の写真は撮られていません。広島・東京・大阪・京都で試してください。',
    jaOnly: '日本語の記事',
    loading: '読み込み中…', noSummary: '説明がありません。',
    tapRed: '下のボタンで全文が読めます。',
    memorial: 'の碑', memorialStone: '災害の碑',
    stoneBody: 'これは<b>自然災害伝承碑</b>です。ここで起きたことを後の人に伝えるために建てられました。',
    stoneRecords: '記録されている災害',
    stoneJa: '碑文の記録（原文）：',
    erected: '建立', yearsAgo: n => n + '年まえ',
    famous: '日本を代表する名所のひとつです。下のボタンで詳しく読めます。',
    noResults: '見つかりませんでした。', located: '現在地です。',
    noGeo: '現在地を取得できませんでした。', copied: 'リンクをコピーしました。',
    address: '住所', localSpot: '地元の名所',
    official: '自治体・公式ページを探す',
    aKind: k => 'ここは' + k + 'です。',
    showOriginal: '原文を見る',
    save: '☆ 保存', saved: '★ 保存済み', myTitle: 'お気に入り',
    savedToast: n => '★ 保存しました：' + n,
    unsavedToast: n => '保存を解除：' + n,
    closeTip: 'いちばん拡大した状態です。道ばたの石碑・跡地・小さな史跡はここで出ます。',
    myEmpty: 'まだありません。スポットを開いて「保存」を押してください。',
    guideBtn: '? つかいかた', guideTitle: 'つかいかた・よくある質問',
    guideHTML: `<h3>つかいかた</h3><ol>
      <li><b>名所を見る</b> — 選んだ{places}か所。開くとすぐ1945年と今が並びます。</li>
      <li><b>日本全体の地図</b> — 場所・駅名・住所で検索、◎で現在地へ。</li>
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
const t = k => T[LANG][k];

/* =========================================================================
   1. State
   ========================================================================= */
let PLACES = [], LANDMARKS = [], MONUMENTS = null, LOCALS = [], LIMINAL = [];
let TOPICS = null, AREAS = null;   // 種類の記事 / まちの記事。無ければ黙る
let mode = 'places';
let MON_INDEX = [], MON_BY_ID = new Map();
let idxLoading = null;
let AFF = null;      // data/affiliate.json
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
const kindsOut = k => kindsRaw(k).map(x => LANG === 'en' ? KIND_EN[x] : x);

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
    const hook = (LANG === 'ja' && p.hook_ja) ? p.hook_ja : p.hook;
    // 最初の数枚は即時に。上端が空のカードで埋まっていると壊れて見える
    const lazy = i < 6 ? 'eager' : 'lazy';
    return '<button class="card card-lim" data-lim="' + esc(p.id) + '">'
      + '<img class="card-img card-photo" loading="' + lazy + '" decoding="async" alt="" '
      + 'src="' + esc(p.img ? thumb(p.img, 480) : tileURL(NOW_LAYER.id, NOW_LAYER.ext, p.lat, p.lon, 16))
      + '" data-full="' + esc(p.img || tileURL(NOW_LAYER.id, NOW_LAYER.ext, p.lat, p.lon, 16)) + '" '
      + 'onerror="if(this.dataset.full&&this.src!==this.dataset.full){this.src=this.dataset.full}">'
      + '<span class="card-emoji">' + p.emoji + '</span>'
      + '<div class="card-body">'
      + '<p class="card-ja">' + esc(p.ja) + '</p>'
      + '<p class="card-name">' + esc(LANG === 'ja' ? p.ja : p.name) + '</p>'
      + '<p class="card-hook">' + esc(hook) + '</p></div></button>';
  }).join('');
  for (const b of document.querySelectorAll('.card-lim'))
    b.onclick = () => showLiminal(LIMINAL.find(p => p.id === b.dataset.lim));
}

function buildCards(){
  if (mode === 'liminal') return buildLiminalCards();
  $('cards').innerHTML = PLACES.map(p => {
    const lyr = (p.then && THEN[p.then]) ? p.then : NOW_LAYER.id;
    const cfg = p.then && THEN[p.then];
    const ext = cfg ? cfg.ext : NOW_LAYER.ext;
    return '<button class="card" data-id="' + esc(p.id) + '">'
      + '<div class="card-img" style="background-image:url(\'' + tileURL(lyr, ext, p.lat, p.lon, 15) + '\')"></div>'
      + '<span class="card-emoji">' + p.emoji + '</span>'
      + (p.thenLabel ? '<span class="card-era">' + esc(p.thenLabel) + ' → NOW</span>' : '')
      + '<div class="card-body">'
      + '<p class="card-ja">' + esc(p.ja) + ' · ' + esc(p.romaji) + '</p>'
      + '<p class="card-name">' + esc((LANG === 'ja' && p.name_ja) ? p.name_ja : p.name) + '</p>'
      + '<p class="card-hook">' + esc((LANG === 'ja' && p.hook_ja) ? p.hook_ja : p.hook) + '</p>'
      + '</div></button>';
  }).join('');
  for (const b of document.querySelectorAll('.card'))
    b.onclick = () => openPlace(PLACES.find(p => p.id === b.dataset.id));
}

function applyLang(){
  document.documentElement.lang = LANG;
  for (const el of document.querySelectorAll('[data-t]')) el.innerHTML = t(el.dataset.t);
  $('langLabel').textContent = LANG === 'en' ? '日本語' : 'English';
  $('langBtn2').textContent  = LANG === 'en' ? 'JA' : 'EN';   // 2文字なら375pxでも折り返さない
  $('q').placeholder         = t('search');
  $('modeNote').textContent  = modeNote();
  if (mode === 'liminal') $('limIntro').innerHTML = t('limIntroHTML');
  $('roamTip').textContent   = t('roamTip');
  $('dragHint').textContent  = t('dragHint');
  $('tagThen').title         = t('stopCompare');
  paintCompareBtn();
  $('pShare').textContent    = '⇪ ' + t('share');
  paintOfficial();
  renderGuide();
  renderSaved();
  if (PLACES.length) buildCards();
  if (current) openPlace(current, true);
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
  wikiSeen.clear(); wikiAsked.clear();     // titles differ per language
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

  splitSet = false;
  centreSplit();
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
function bigIcon(p, ring, withLabel, size){
  return L.divIcon({ className: 'big-pin ' + (size || 'p1'), iconSize: [0,0], iconAnchor: [0,0],
    html: '<div class="big ' + ring + '"><span>' + p.emoji + '</span></div>'
        + (withLabel === false ? '' : '<div class="big-label">' + esc(p.name) + '</div>') });
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
    const m = L.marker([p.lat, p.lon], { title: p.name, riseOnHover: true, icon: icon,
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
function revGeo(lat, lon, lang){
  const key = lang + ':' + lat.toFixed(5) + ',' + lon.toFixed(5);
  if (addrCache.has(key)) return addrCache.get(key);
  const pr = fetch(NOMINATIM + '/reverse?format=jsonv2&zoom=18&addressdetails=1'
      + '&accept-language=' + lang + '&lat=' + lat + '&lon=' + lon)
    .then(r => r.json())
    .catch(() => null);
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
                            { cache: 'force-cache' });
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

async function drawDetail(){
  // roaming は「スポットが選ばれていない」の意味で、「地図が出ている」ではない。
  // これを条件にしていたため、名所やリミナルから開くと周辺のマーカーが全部消えていた。
  if (!map || $('place').hidden) return;
  const z = map.getZoom(), b = map.getBounds();
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
    L.marker([p.lat, p.lon], { icon: bigIcon(p, 'ring-red', z >= 9 && freeLabel(p.lat, p.lon, 'lab'), CLS[k]), title: p.name })
     .on('click', () => openPlace(p)).addTo(group);
  }

  // Tier 1-3: famous first, so when space is tight the better-known place wins it.
  // LANDMARKS is already sorted by tier at load; re-sorting on every pan was waste.
  for (const p of LANDMARKS){
    if (z < (TIER_ZOOM[p.tier || 3] || 8)) continue;
    const k = (p.pop || 3) - 1;
    if (!b.contains([p.lat, p.lon]) || !free(p.lat, p.lon, POP_CLS[k])) continue;
    L.marker([p.lat, p.lon], { icon: bigIcon(p, 'ring-gold', z >= 10 && freeLabel(p.lat, p.lon, 'lab'), CLS[k]), title: p.name })
     .on('click', () => showLandmark(p)).addTo(group);
  }

  // Liminal Japan was a list you could only reach from the home screen. Thirty-three
  // spots spread over the whole country is real map density, and stumbling on one
  // while panning is the point of them.
  if (z >= LIM_ZOOM)
    for (const p of LIMINAL){
      const k = POP_LIM - 1;
      if (!b.contains([p.lat, p.lon]) || !free(p.lat, p.lon, POP_CLS[k])) continue;
      const nm = LANG === 'ja' ? p.ja : p.name;
      L.marker([p.lat, p.lon], { icon: bigIcon({ emoji: p.emoji, name: nm }, 'ring-lim',
                                               z >= 10 && freeLabel(p.lat, p.lon, 'lab'),
                                               CLS[k]), title: nm })
       .on('click', () => showLiminal(p)).addTo(group);
    }

  if (z >= MONU_ZOOM){
    await loadMonumentIndex();
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
  const n = tg.name || tg.inscription || '';
  for (const r of LOCAL_NAME_RULES) if (r[0].test(n)) return r;
  for (const r of LOCAL_TAG_RULES)  if (r[0](tg))     return r;
  return null;
}
function localEmoji(tg){ const r = localType(tg); return r ? r[1] : '📍'; }
function localLabel(tg){
  const r = localType(tg);
  return r ? (LANG === 'en' ? r[2] : r[3]) : t('localSpot');
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
  if (!r) return LANG === 'en' ? 'place' : '場所';
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
                     label: t('readWiki'), src: '日本語版ウィキペディア（CC BY-SA 4.0）' };
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
    const j = await fetch(NOMINATIM + '/reverse?format=jsonv2&zoom=10&extratags=1'
      + '&accept-language=en&lat=' + lat + '&lon=' + lon).then(r => r.json());
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

const localName = tg => (LANG === 'en' && tg['name:en']) ? tg['name:en'] : (tg.name || tg.inscription || '');

/* -------------------------------------------------------------------------
   Affiliate slot.
   Rules baked in rather than left to judgement later:
     - one line, bottom of the panel, below the story and the sources
     - never on the map itself, never on the home screen
     - never on a disaster memorial stone (an advert under a memorial to the
       dead would cost more trust than the click is worth)
     - always carries a PR label; Japan's disclosure rules require it
   Nothing renders at all until data/affiliate.json has enabled:true and an id.
   ------------------------------------------------------------------------- */
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

function renderAffiliate(o){
  const box = $('pAff');
  box.hidden = true;
  box.innerHTML = '';
  if (!AFF || !AFF.enabled || !o.at) return;
  if (o.kind && (AFF.excludeKinds || []).indexOf(o.kind) >= 0) return;

  const name = o.name || '';
  const query = encodeURIComponent(o.query || name);
  const rows = [];
  for (const slot of ['stay', 'things']){
    const cfg = AFF[slot];
    if (!cfg || !cfg.id) continue;
    const href = cfg.url.replace('{query}', query).replace('{id}', encodeURIComponent(cfg.id));
    const label = (LANG === 'ja' ? cfg.label_ja : cfg.label_en).replace('{name}', name);
    rows.push('<a href="' + esc(href) + '" target="_blank" rel="nofollow sponsored noopener">'
      + '<span class="pr">PR</span><span>' + esc(label) + '</span></a>');
  }
  if (!rows.length) return;
  box.innerHTML = rows.join('');
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
  if (!compareLayer){ b.hidden = true; return; }
  b.hidden = false;
  b.innerHTML = '<span>\u25c0\u25b6</span> ' + esc(t('compareYear')(compareLayer.year));
}

function panelShell(o){
  compareAt = o.at || null;
  sharePayload = o.share
    ? { title: o.share.title, url: o.share.url || location.href }
    : null;
  $('pCompare').hidden = true;          // shown once we know a photograph exists
  $('pShare').hidden   = !o.share;
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
  renderAffiliate(o);
  renderRelated(o);
  paintSaveBtn();
  snsLinks();
  $('panel').classList.remove('closed');
  $('panel').classList.add('open');
  document.body.classList.remove('roaming');
  $('panel').querySelector('.panel-inner').scrollTop = 0;

  const myToken = ++panelToken;
  /* まちの記事は描画のあとで足す。地図の再描画も最初の表示も待たせない。 */
  if (o.relatedArea && o.at) areaArticleOf(o.at[0], o.at[1]).then(a => {
    if (myToken !== panelToken || !a) return;    // すでに別のスポットが開かれている
    o._area = a; renderRelated(o);
  });
  if (o.at) addressOf(o.at[0], o.at[1]).then(a => {
    if (myToken !== panelToken) return;           // a newer panel is on screen
    if (a) $('pAddr').textContent = t('address') + ': ' + a;
    /* 市町村名は必ず日本語で取る。英語表示中でも問いは日本語にする。
       住所の返事のあとに聞く。Nominatim は 1 秒 1 件まで。 */
    return muniOf(o.at[0], o.at[1]).then(m => {
      if (myToken !== panelToken || !m) return;
      const el = $('pOfficial');
      el.dataset.muni = m;
      paintOfficial();
    });
  });

  // Work out which old photograph is available here and label the button with
  // its actual year, rather than promising 1945 everywhere.
  compareLayer = null;
  if (o.at){
    const at = o.at;
    pickOldLayer(at[0], at[1]).then(L => {
      if (myToken !== panelToken || compareAt !== at) return;   // panel changed while we asked
      compareLayer = L;
      if (!L){
        $('pCompare').hidden = true;
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

function showLandmark(p){
  lastPanel = () => showLandmark(p);
  /* current は「物語つきの名所を開いている」という意味。ここで消さないと、
     名所を開いたあとに小さなスポットを開いても current が残り、言語を切り替えた
     applyLang() が画面に出ているスポットではなく前の名所を開き直してしまう。 */
  current = null;
  panelShell({
    kicker: { emoji: p.emoji, label: p.kind, note: '  ' + p.ja },
    ja: p.ja, name: LANG === 'en' ? p.name : p.ja, at: [p.lat, p.lon], query: p.name,
    bodyHTML: '<p>' + t('famous') + '</p>',
    wiki: (articleLink(p) || {}).url || '',
    wikiLabel: (articleLink(p) || {}).label,
    share: { title: p.name, url: location.origin + location.pathname },
    searchName: p.ja,
    src: LANG === 'en' ? 'Coordinates from Wikipedia.' : '座標の出典：ウィキペディア'
  });
  map.panTo([p.lat, p.lon]);
}

async function showWiki(w){
  lastPanel = () => showWiki(w);
  current = null;
  /* null は「まだ聞いていない」、'' は「聞いたが英語版は無い」。
     ここを区別せず !!w.en で判定していた。 */
  if (LANG === 'en' && w.en === null){
    const before = panelToken;
    const en = await enTitleOf(w.ja);
    if (before !== panelToken) return;      // 待っているあいだに別のパネルが開いた
    w.en = en || '';
    w.name = (LANG === 'en' && w.en) ? w.en : w.ja;
  }
  const hasEn = !!w.en;
  const link = (hasEn && LANG === 'en')
    ? 'https://en.wikipedia.org/wiki/' + encodeURIComponent(w.en.replace(/ /g,'_'))
    : (LANG === 'ja' ? 'https://ja.wikipedia.org/wiki/' + encodeURIComponent(w.ja)
                     : JA_ARTICLE(w.ja));
  const tag = (!hasEn && LANG === 'en') ? '<span class="p-lang">' + t('jaOnly') + '</span>' : '';
  panelShell({
    ja: (LANG === 'en' && hasEn) ? w.ja : '',
    name: (LANG === 'en' && hasEn) ? w.en : w.ja,
    bodyHTML: tag + '<p>' + t('loading') + '</p>',
    wiki: link, wikiLabel: (!hasEn && LANG === 'en') ? t('readWikiJa') : t('readWiki'),
    at: [w.lat, w.lon], share: { title: w.name, url: location.origin + location.pathname },
    searchName: w.ja,
    src: hasEn ? 'Wikipedia (CC BY-SA 4.0)'
               : (LANG === 'en' ? 'Japanese Wikipedia (CC BY-SA 4.0). No English article exists.'
                                : '日本語版ウィキペディア（CC BY-SA 4.0）')
  });
  /* The summary must be in the chosen language. When an English article exists we
     pull the English extract; when it does not, we say what the place is in English
     and keep the Japanese original folded away rather than dumping it on the reader. */
  /* panelShell が採番した番号を控える。await のあいだに別のスポットが開かれたら、
     こちらの返事はもう画面に書いてはいけない。これが無いために「題名は晩翠草堂、
     本文と写真は大町（仙台市）」という取り違えが起きていた（再現確認済み）。
     panelShell 自身の住所・年代の書き込みは既に同じ守りを持っている。 */
  const myToken = panelToken;
  let pg = null, body = '';
  if (LANG === 'en' && hasEn){
    pg = await wikiExtractByTitle(w.en, 'en');
    const raw = ((pg && pg.extract) || '').replace(/\s+/g, ' ').slice(0, 260);
    body = raw ? '<p>' + esc(raw) + '</p>' : '<p>' + t('noSummary') + '</p>';
  } else {
    pg = await wikiExtract(w.pageid, 'ja');
    const raw = ((pg && pg.extract) || '').replace(/\s+/g, ' ').slice(0, 260);
    if (LANG === 'ja'){
      body = raw ? '<p>' + esc(raw) + '</p>' : '<p>' + t('noSummary') + '</p>';
    } else {
      body = '<p>' + t('aKind')(spotLabel(w.ja)) + '</p>'
           + '<p class="p-hint">' + t('tapRed') + '</p>'
           + (raw ? '<details class="jp-fold"><summary>' + t('showOriginal')
                    + '</summary><p class="jp-raw">' + esc(raw) + '</p></details>' : '');
    }
  }
  if (myToken !== panelToken) return;          // すでに別のスポットが開かれている
  $('pStory').innerHTML = tag + body;
  if (pg && pg.thumbnail && pg.thumbnail.source){
    $('pImg').src = pg.thumbnail.source; $('pImg').alt = w.name;
    $('pCap').textContent = ''; $('pFig').hidden = false;
  }
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

function showMonument(r){
  lastPanel = () => showMonument(r);
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
    ja: r.name, name: head, kind: 'lore', searchName: r.name, bodyHTML: body, img: r.img, cap: r.addr,
    relatedArea: true,     // 種類は出さない。伝承碑に「記念碑とは」は何も教えない
    at: [r.lat, r.lon], share: { title: head, url: location.origin + location.pathname },
    src: LANG === 'en' ? 'Natural Disaster Memorial Monuments, Geospatial Information Authority of Japan.'
                       : '国土地理院「自然災害伝承碑」'
  });
}

function showLocal(p){
  lastPanel = () => showLocal(p);
  current = null;
  const tg = p.tags, nm = localName(tg) || t('localSpot');
  const bits = [];
  if (tg.inscription) bits.push('<p class="jp-raw">' + esc(tg.inscription) + '</p>');
  if (tg.description) bits.push('<p>' + esc(tg.description) + '</p>');
  const wl = wikiTagLink(tg.wikipedia);
  panelShell({
    kicker: { emoji: localEmoji(tg), label: localLabel(tg), note: tg.name ? '  ' + tg.name : '' },
    /* 検索語には本当の名前だけを渡す。nm は名無しのとき
       t('localSpot')（「地元の名所」）に化けるので、そのまま問いにすると
       総称を検索してしまう。名前が無ければ市町村名だけで問う。 */
    ja: (tg.name && tg['name:en']) ? tg.name : '', name: nm,
    searchName: tg['name:ja'] || tg.name || '',
    bodyHTML: bits.length ? bits.join('') : '<p class="p-hint">' + t('noSummary') + '</p>',
    at: [p.lat, p.lon], share: { title: nm, url: location.origin + location.pathname },
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
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '[]'); } catch(e){ return []; }
}
function writeSaved(v){
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(v.slice(-200))); } catch(e){}
  renderSaved();
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
  writeSaved(list);
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
function renderSaved(){
  const list = readSaved();
  $('myCount').textContent = (list.length ? '★ ' : '☆ ') + list.length;
  const b2 = $('myCount2');
  if (b2){ b2.textContent = (list.length ? '★' : '☆') + list.length; }
  const box = $('myList');
  if (!box) return;
  box.innerHTML = list.length
    ? list.slice().reverse().map((x, i) =>
        '<button class="my-item" data-k="' + esc(x.k) + '">' + esc(x.name || 'spot')
        + ' <span class="x" data-del="' + esc(x.k) + '">×</span></button>').join('')
    : '<p class="my-empty">' + t('myEmpty') + '</p>';
  for (const b of box.querySelectorAll('.my-item')) b.onclick = e => {
    const k = b.dataset.k, row = readSaved().find(x => x.k === k);
    if (!row) return;
    if (e.target.dataset.del){ writeSaved(readSaved().filter(x => x.k !== k)); return; }
    if (!roaming) openMap();
    map.setView([row.lat, row.lon], 16);
    setTimeout(drawDetail, 400);
  };
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

function showLiminal(p, keepView){
  lastPanel = () => showLiminal(p, true);
  const hook = (LANG === 'ja' && p.hook_ja) ? p.hook_ja : p.hook;
  const why  = (LANG === 'ja' && p.why_ja)  ? p.why_ja  : (p.why || '');
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
  drawSpots([{ lat: p.lat, lon: p.lon, name: LANG === 'ja' ? p.ja : p.name, emoji: p.emoji }],
            true, () => showLiminal(p, true));
  roaming = false; current = null;
  drawDetail();
  setTimeout(drawDetail, 900);

  panelShell({
    kicker: { emoji: p.emoji, label: t('modeLiminal'), note: '  ' + p.ja },
    ja: p.ja, name: LANG === 'ja' ? p.ja : p.name, at: [p.lat, p.lon], query: p.name,
    bodyHTML: '<p>' + esc(hook) + '</p>'
            + (why ? '<h3 class="p-h3">' + t('liminalWhat') + '</h3><p>' + esc(why) + '</p>' : '')
            + (p.note ? '<p class="p-pick">' + esc(p.note) + '</p>' : '')
            + (extract ? '<p class="p-hint">' + esc(extract.slice(0, 220)) + '</p>' : ''),
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
let qTimer = null;
$('q').addEventListener('input', () => {
  const v = $('q').value.trim();
  $('qClear').hidden = !v;
  clearTimeout(qTimer);
  if (v.length < 2){ $('qResults').hidden = true; return; }
  qTimer = setTimeout(() => runSearch(v), 450);   // stay inside Nominatim's policy
});

/* Enter で「入力にいちばん近い場所」へ飛ぶ。2026-09-09 追加。
   それまで Enter は何も起きず、候補を指で押すしかなかった（実測で確認）。
   候補が既に出ていれば先頭を押す。まだなら 450ms の待ちを飛ばして今すぐ引き、
   返ってきた先頭へ飛ぶ。Nominatim は関連度順に返すので先頭＝一番近い場所。
   記事名や地名を自分で組み立てることはしない。返ってきたものだけを使う。 */
$('q').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();                       // フォーム送信やページ再読込を止める
  const box = $('qResults');
  const first = box.hidden ? null : box.querySelector('.q-item');
  if (first){ first.click(); return; }
  const v = $('q').value.trim();
  if (v.length < 2) return;
  clearTimeout(qTimer);
  runSearch(v, true);                       // 引けたら先頭へ自動で飛ぶ
});
/* 飛んでいる検索の返事を無効にするための世代番号。これが無いと、✕で閉じたあとに
   古い返事が届いて結果が勝手に開き直る（[hidden] が効くようになった今は本当に再表示される）。 */
let qSeq = 0;
$('qClear').onclick = () => { ++qSeq; $('q').value = ''; $('qClear').hidden = true;
                              $('qResults').hidden = true; };

async function runSearch(v, autoPick){
  const mine = ++qSeq;
  try{
    const j = await fetch(NOMINATIM + '/search?format=jsonv2&limit=6&countrycodes=jp'
      + '&accept-language=' + LANG + '&q=' + encodeURIComponent(v)).then(r => r.json());
    if (mine !== qSeq) return;        // もっと新しい検索が始まっている／✕で閉じられた
    const box = $('qResults');
    if (!j.length){ box.innerHTML = '<div class="q-none">' + t('noResults') + '</div>'; box.hidden = false; return; }
    box.innerHTML = j.map((r, i) =>
      '<button class="q-item" data-i="' + i + '"><b>'
      + esc(r.name || String(r.display_name).split(',')[0]) + '</b><span>'
      + esc(r.display_name) + '</span></button>').join('');
    box.hidden = false;
    for (const b of box.querySelectorAll('.q-item'))
      b.onclick = () => {
        const r = j[+b.dataset.i];
        box.hidden = true; $('q').blur();
        if (!roaming) openMap();
        map.setView([+r.lat, +r.lon], 16);
        setTimeout(drawDetail, 400);
      };
    /* Enter から来たときは、先頭（＝一番近い場所）を自分で押す。
       押す先は上で作った本物のボタンなので、クリックと完全に同じ道を通る。 */
    if (autoPick){
      const f = box.querySelector('.q-item');
      if (f) f.click();
    }
  } catch(e){ toast(t('noResults')); }
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
  catch(e){ toast(url); }
};
$('myBtn2').onclick = () => {
  closePlace(); setMode('places');
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
    try { await navigator.share({ title: title, url: url }); return; } catch(e){ /* cancelled */ }
  }
  try { await navigator.clipboard.writeText(url); toast(t('copied')); }
  catch(e){ window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(title)
                        + '&url=' + encodeURIComponent(url), '_blank', 'noopener'); }
};

/* =========================================================================
   9. Modes and navigation
   ========================================================================= */
function openPlace(p, keepView){
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

  const story = (LANG === 'ja' && p.story_ja) ? p.story_ja : p.story;
  const cap = p.monument && (LANG === 'ja' && p.monument.caption_ja
                             ? p.monument.caption_ja : p.monument.caption);
  panelShell({
    kicker: p.word ? { emoji: p.word.jp, label: p.word.romaji,
                       note: '  ' + (LANG === 'ja' && p.word.meaning_ja
                                     ? p.word.meaning_ja : p.word.meaning) } : null,
    ja: p.ja + ' · ' + p.romaji,
    name: (LANG === 'ja' && p.name_ja) ? p.name_ja : p.name,
    query: p.name,
    bodyHTML: story.map(s => '<p>' + esc(s) + '</p>').join(''),
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
  $('place').hidden = true; $('home').hidden = false;
}

function modeNote(){
  /* まだ届いていないものは 0 になる。guideFill と同じで「0か所」と言い切るのは嘘なので
     伏せ字を出す。読み込み前・読み込み失敗のどちらでも 0 なので、ここで一緒に受ける。 */
  const n = c => (c ? c : '…') + (LANG === 'ja' ? 'か所。' : ' places. ');
  if (mode === 'map' || roaming) return t('noteMap');
  if (mode === 'liminal') return n(LIMINAL.length) + t('noteLiminal');
  return n(PLACES.length) + t('notePlaces');
}

function setMode(m){
  mode = m;
  for (const [id, key] of [['mPlaces','places'], ['mMap','map'], ['mLiminal','liminal']]){
    $(id).classList.toggle('is-on', m === key);
    $(id).setAttribute('aria-selected', String(m === key));
  }
  $('cards').hidden = (m === 'map');
  $('modeNote').textContent = modeNote();
  const intro = $('limIntro');
  intro.hidden = m !== 'liminal';
  if (m === 'liminal') intro.innerHTML = t('limIntroHTML');
  if (m === 'map') openMap();
  else buildCards();
}

$('langBtn').onclick  = () => setLang(LANG === 'en' ? 'ja' : 'en');
$('langBtn2').onclick = () => setLang(LANG === 'en' ? 'ja' : 'en');
$('mPlaces').onclick  = () => setMode('places');
$('mMap').onclick     = () => setMode('map');
$('mLiminal').onclick = () => setMode('liminal');
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
$('tagThen').onclick  = () => { setThenLayer(null, null); paintCompareBtn(); };
$('pCompare').onclick = () => {
  if (thenLayer){ setThenLayer(null, null); paintCompareBtn(); return; }   // press again to stop
  if (!compareAt || !compareLayer) return;
  map.setView(compareAt, Math.max(map.getZoom(), 16));
  setThenLayer(compareLayer.id, compareLayer.year);
  paintCompareBtn();
  // Collapse the panel to its handle so the map is visible, but do NOT put the
  // body back into roaming state: `body.roaming .panel` slides the panel right
  // off the screen, so the summary disappeared the moment you pressed compare.
  $('panel').classList.remove('open');
};

function noPush(fn, arg){
  // fn が投げると pushState がスタブのまま固定され、以後どの画面も履歴を積まなくなる
  const h = history.pushState;
  history.pushState = () => {};
  try { fn(arg); } finally { history.pushState = h; }
}
window.addEventListener('popstate', () => {
  if (location.hash === '#map' && PLACES.length){ noPush(openMap); return; }
  if (location.hash.startsWith('#l-') && LIMINAL.length){
    const q = LIMINAL.find(x => x.id === location.hash.slice(3));
    if (q){ noPush(showLiminal, q); return; }
  }
  const p = location.hash && PLACES.filter(x => x.id === location.hash.slice(1))[0];
  if (p){ noPush(openPlace, p); return; }
  closePlace(); setMode('places');
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

/* =========================================================================
   10. Start
   ========================================================================= */
applyLang();
fetch(dj('data/places-world.json')).then(r => r.json()).then(j => {
  PLACES = j.places;
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
    fetch(dj('data/landmarks.json')).then(r => r.ok ? r.json() : null)
      .then(l => { if (l) LANDMARKS = l.landmarks.sort(
                    (a, c) => (a.pop || 3) - (c.pop || 3)
                           || (a.tier || 3) - (c.tier || 3)); }).catch(() => {}),
    fetch(dj('data/affiliate.json')).then(r => r.ok ? r.json() : null)
      .then(a => { AFF = a; }).catch(() => {}),
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
  setTimeout(loadMonuments, 2500);

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
