/* Source-checked Japanese editorial batch for the lower Kinki volume. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = {id:'ndl-kinki-guide-1933', title:'『日本案内記 近畿篇 下』（1933年・国立国会図書館）', url:'https://dl.ndl.go.jp/pid/1176380'};
const source = (id, title, url) => ({id, title, url});
const edit = (file, field, key, update) => {
  const target = path.join(root, 'data', file);
  const doc = JSON.parse(fs.readFileSync(target, 'utf8'));
  const spot = doc[field].find(item => item.id === key || item.wiki_ja === key);
  if (!spot) throw Error(`${file}: missing ${key}`);
  update(spot);
  fs.writeFileSync(target, JSON.stringify(doc, null, file === 'regional-landmarks-v1.json' ? 2 : 0) + '\n');
};
const feature = (id, hook, story, summary, sources) => edit('places-world.json', 'places', id, spot => {
  spot.hook_ja = hook;
  spot.story_ja = story;
  spot.hooks.ja = hook;
  spot.summaries.ja = summary;
  spot.researchSources = [book, ...sources];
  spot.reviewedOn = '2026-09-25';
});
const landmark = (name, summary, sources) => edit('landmarks.json', 'landmarks', name, spot => {
  spot.summaries.ja = summary;
  spot.researchSources = [book, ...sources];
  spot.reviewedOn = '2026-09-25';
});

feature('osaka',
  '1931年に完成した天守と堀を探し、その東側の土地が昔の写真からどう変わったかを見比べます。',
  [
    'いま見える大阪城の天守は、豊臣秀吉の時代の建物ではありません。市民の寄付で1931年に建てられた、歴史上3代目の天守です。石垣や堀には徳川時代以後のものが残ります。',
    'そのわずか2年後に刊行された鉄道省の案内書は、天守を耐震・耐火を考えた近代建築として紹介し、開かれたばかりの大阪城公園にも触れています。古い本にとっての「新しい名所」でした。',
    '案内書には城の東に大阪陸軍造兵廠があるとも記されています。城の周辺は、現在のような緑の公園ばかりではありませんでした。',
    '選択中の1945～50年の航空写真と現在を重ね、天守と堀を目印に東へ視線を動かしてみましょう。戦争をはさみ、工場のあった一帯の土地の使われ方が変わっていきます。'
  ],
  '大阪城の天守は市民の寄付で1931年に建てられた3代目。1933年の案内書は新しい天守と公園、城の東の陸軍造兵廠を記しています。1945～50年の航空写真を天守と堀で位置合わせし、現在の緑地との違いを見てみましょう。',
  [source('official-osaka-castle', '大阪城天守閣の歴史（大阪城天守閣）', 'https://www.osakacastle.net/')]);

feature('nara',
  '東大寺の南大門から大仏殿へ続く道と、境内の東側に広がる山裾をたどります。',
  [
    '8世紀に都が置かれた奈良。東大寺の大仏は、聖武天皇の時代に国家的な事業として造られました。1933年の鉄道省の案内書も、大仏殿、南大門、法華堂を順に紹介しています。',
    'ただし、目の前の大仏殿が創建時のまま残ったわけではありません。戦火で二度失われ、現在の建物は1709年に完成しました。幅は創建時や鎌倉時代の建物のおよそ6割です。',
    '南大門は鎌倉時代の再建です。大仏殿と同じ道の上にありながら、建てられた時代は違います。門から堂まで歩くつもりで、地図上の配置を見てみましょう。',
    '1960年代の航空写真と今を切り替えると、寺の大きな屋根、公園の開けた場所、東側の山林が位置合わせの目印になります。'
  ],
  '東大寺の大仏殿は8世紀の創建後に二度焼失し、現建物は1709年の再建です。1933年の案内書は大仏殿、鎌倉時代の南大門、法華堂を紹介しています。1960年代の写真で、門から堂への道と東の山裾をたどってみましょう。',
  [source('official-todaiji-daibutsuden', '大仏殿（東大寺）', 'https://www.todaiji.or.jp/information/daibutsuden/'),
   source('official-todaiji-nandaimon', '南大門（東大寺）', 'https://www.todaiji.or.jp/information/nandaimon/')]);

landmark('東大寺',
  '1933年の案内書は東大寺の大仏殿、南大門、法華堂を順に紹介しています。大仏殿は8世紀に始まり、戦火を経て現在の建物が1709年に完成しました。鎌倉時代再建の南大門から大仏殿まで、長い参道と建物の位置関係を地図でたどれます。',
  [source('official-todaiji-daibutsuden', '大仏殿（東大寺）', 'https://www.todaiji.or.jp/information/daibutsuden/'),
   source('official-todaiji-nandaimon', '南大門（東大寺）', 'https://www.todaiji.or.jp/information/nandaimon/')]);

feature('kobe',
  'メリケンパークの東側で、まっすぐな岸壁と震災で崩れた岸壁を見比べます。',
  [
    '1933年の鉄道省の案内書は、神戸港の海岸に荷揚げ場、倉庫、工場が並び、船と鉄道がつながる商港を描いています。現在の散歩道とは、海辺の使われ方が大きく違います。',
    'メリケン波止場と中突堤の間を埋め立てて、1987年にメリケンパークが開かれました。つまり、戦前の案内書にある港を、そのまま現在の公園だと考えることはできません。',
    '1995年1月17日の阪神・淡路大震災で港も被災しました。公園の北東部には、崩れたメリケン波止場の岸壁約60メートルが保存されています。',
    '1945～50年の航空写真と今を比べ、古い突堤、埋め立て後の公園、保存された岸壁の位置を探してみましょう。震災の跡は公園全体ではなく、その一角にあります。'
  ],
  '1933年の案内書が描く神戸港の荷揚げ場や倉庫は、現在のメリケンパークとは異なる海辺の姿です。公園は1987年に埋め立て地に開園。北東部には1995年の震災で崩れた岸壁約60メートルが保存されています。',
  [source('official-kobe-port-history', '神戸港の歴史（神戸市）', 'https://www.city.kobe.lg.jp/a74134/kurashi/access/harbor/rekishi.html'),
   source('official-kobe-meriken-history', 'メリケン波止場のあゆみ（神戸市）', 'https://www.city.kobe.lg.jp/documents/76691/20251016141744.pdf'),
   source('official-kobe-memorial', '神戸港震災メモリアルパーク（神戸市）', 'https://www.city.kobe.lg.jp/z/kowankyoku/kanko/leisure/harbor/kankou/memorialpark.html')]);

landmark('道頓堀',
  '道頓堀は自然の川ではなく、1615年に完成した堀川です。1933年の案内書も、川の南岸を芝居や映画の劇場が集まる娯楽の街として紹介しています。川と橋を目印に、昔から人が集まった岸辺が今どう使われているか見てみましょう。',
  [source('official-dotonbori', '道頓堀川の歴史（大阪市）', 'https://www.city.osaka.lg.jp/kensetsu/cmsfiles/contents/0000010/10856/01J.pdf')]);

const regional = (id, summary, sources) => edit('regional-landmarks-v1.json', 'landmarks', id, spot => {
  spot.summaries = {...spot.summaries, ja:summary};
  spot.researchSources = [book, ...sources];
  spot.reviewedOn = '2026-09-25';
});

regional('regional-2007615',
  '法隆寺は一つの建物ではありません。1933年の案内書は、金堂と五重塔を中心とする西院伽藍と、夢殿のある東院伽藍を分けて紹介しています。創建時の建物は670年の火災で失われ、現在の西院はその後の再建です。地図で二つの区画と、その間の道をたどってみましょう。',
  [source('official-horyuji-precinct', '法隆寺伽藍（法隆寺）', 'https://www.horyuji.or.jp/garan/'),
   source('official-horyuji-unesco', '法隆寺地域の仏教建造物（UNESCO）', 'https://whc.unesco.org/en/list/660/')]);

regional('regional-40306',
  '1933年の案内書は、住吉大社の反橋（太鼓橋）を渡ると四棟の本殿へ進む、と記します。現在も反橋は神池に架かり、第一～第三本宮が奥へ一直線に、第四本宮が第三本宮の横に並びます。橋を入口に、四つの屋根の並び方を地図で探してみましょう。',
  [source('official-sumiyoshi-bridge', '住吉っさんの見所（住吉大社）', 'https://www.sumiyoshitaisha.net/grounds/highlights.html'),
   source('official-sumiyoshi-honden', '本殿（住吉大社）', 'https://www.sumiyoshitaisha.net/grounds/honden.html')]);

regional('regional-272276',
  '1933年の案内書は伊賀上野城を「城址」と呼び、丘の公園に残る石垣と堀を紹介しています。現在見える白い木造の天守は、その2年後の1935年に建てられました。藤堂高虎が築いた高い石垣と、昭和に建てた天守を同じ時代のものと思わず、堀を囲む地形も見てみましょう。',
  [source('official-iga-castle', '伊賀市都市公園案内（伊賀市）', 'https://www.city.iga.lg.jp/0000000237.html')]);

regional('regional-343086',
  '1933年の案内書には、1850年に再建された和歌山城の天守が、城跡の公園から見えると記されています。その天守は1945年の空襲で焼失し、現在の天守は1958年に鉄筋コンクリートで再建されました。時代の違う三つの姿を思い浮かべながら、虎伏山の高まりと堀の形を見比べてみましょう。',
  [source('official-wakayama-castle', '和歌山城の施設・名所（史跡 和歌山城）', 'https://wakayamajo.jp/kouzou/'),
   source('official-wakayama-guide', '史跡 和歌山城（和歌山市）', 'https://www.city.wakayama.wakayama.jp/_res/projects/default_project/_page_/001/027/769/castle_jap-p2023.pdf')]);
