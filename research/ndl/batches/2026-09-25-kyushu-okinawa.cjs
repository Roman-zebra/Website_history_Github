/* Japanese copy checked against the openly readable 1935 Kyushu guide. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = {id:'ndl-kyushu-guide-1935', title:'『日本案内記 九州篇』（1935年・国立国会図書館）', url:'https://dl.ndl.go.jp/pid/1176417'};
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
const landmark = (wiki, summary, sources) => edit('landmarks.json', 'landmarks', wiki, spot => {
  spot.summaries = {...spot.summaries, ja:summary};
  spot.researchSources = [book, ...sources];
  spot.reviewedOn = '2026-09-25';
});
const regional = (id, summary, sources) => edit('regional-landmarks-v1.json', 'landmarks', id, spot => {
  spot.summaries = {...spot.summaries, ja:summary};
  spot.researchSources = [book, ...sources];
  spot.reviewedOn = '2026-09-25';
});

feature('fukuoka',
  '那珂川と中洲を目印に、商人の博多と城下町の福岡を見分けます。',
  [
    '1935年の案内書は、博多駅を福岡市の玄関として紹介し、那珂川の中の「東中洲」には劇場や映画館が集まると記しています。川をはさんで西に福岡城址、東に博多の町がありました。今の大きな福岡市の中にも、性格の異なる二つの町の歴史が重なっています。',
    '博多は古くから港と商人の町として栄え、1600年代に黒田長政が西側に福岡城と城下町を築きました。川と橋は単なる景色ではなく、二つの町をつなぐ境目でもありました。',
    '1945年6月の福岡大空襲で中心市街地は大きな被害を受け、案内書が記した東中洲の映画館も失われました。戦後の街並みを古い写真と比べるときは、建物の名前より先に那珂川の流れと中洲の形を探しましょう。',
    '川の東の博多駅、西の福岡城址、その間の中洲を結ぶと、港町と城下町が一つの都市になった道筋を地図でたどれます。'
  ],
  '1935年の案内書は博多駅、那珂川の東中洲にあった劇場や映画館、川の西の福岡城址を紹介しています。商人の町・博多と城下町・福岡を分けた那珂川は、1945年の空襲後に街並みが変わっても位置を探す目印です。',
  [source('official-fukuoka-two-towns', '博多と福岡（福岡市の文化財）', 'https://bunkazai.city.fukuoka.lg.jp/fukuoka-histories/detail/1'),
   source('official-fukuoka-nakagawa', '博多ポートタワー展望室からの景観ガイド（福岡市）', 'https://www.city.fukuoka.lg.jp/kowan/hakata-port/hakataporttower-view001_southwest.html'),
   source('official-fukuoka-air-raid', '福岡市のあゆみ（福岡市）', 'https://www.city.fukuoka.lg.jp/shisei/profile/04.html')]);

const shuriSources = [source('official-shuri-history', '琉球王国とは（首里城公園）', 'https://oki-park.jp/shurijo/about/186'),
  source('official-shuri-university', '沿革（琉球大学附属図書館）', 'https://www.lib.u-ryukyu.ac.jp/about/history/'),
  source('official-shuri-rebuilding', '復興の軌跡（首里城公園）', 'https://oki-park.jp/shurijo/fukkou/7024'),
  source('official-shuri-current', '現在のみどころ（首里城公園）', 'https://oki-park.jp/shurijo/highlights/')];
feature('shuri',
  '丘の上の城壁を手がかりに、琉球王国の王城から現在の復元までをたどります。',
  [
    '首里城は1429年から1879年まで続いた琉球王国の政治・外交・文化の中心でした。丘の上を囲む曲線の石垣は、平地の城とは違う形をしています。王国が終わった後も、城の建物には別の役割が与えられました。',
    '1935年の案内書はここを「首里城址」と呼びながら、王国時代の正殿が沖縄神社の拝殿として残ると記しています。つまり当時の城は、王宮として使われてはいなくても、古い正殿そのものを見ることができました。',
    '1945年の沖縄戦で正殿は焼失し、戦後は城跡に琉球大学が置かれました。1970年代の航空写真は、1992年の復元より前に大学があった時代の景色です。復元した正殿も2019年の火災で再び失われ、いまも復元と公開の段階が進んでいます。',
    '写真を切り替えるときは、建物の有無だけでなく、丘の輪郭と城壁の曲線を追ってください。王城、神社、大学、復元された公園という異なる時代が、同じ高台に重なって見えます。見学可能な範囲は首里城公園の公式案内で確かめましょう。'
  ],
  '1935年の案内書は首里城を「城址」と呼びつつ、古い正殿が沖縄神社の拝殿として残ると記しています。1945年に焼失し、戦後は琉球大学の敷地に。1992年の復元と2019年の火災を経た現在まで、丘と城壁を手がかりに変化をたどれます。',
  shuriSources);

landmark('首里城',
  '1935年の案内書は首里城を「城址」と呼び、琉球王国時代の正殿が沖縄神社の拝殿になっていたことを記しています。その正殿は1945年の沖縄戦で焼失しました。戦後は城跡に琉球大学が開かれ、大学移転後の1992年に復元した正殿も2019年の火災で失われました。現在の復元・公開範囲は公式案内で確認し、航空写真では丘と城壁の曲線を目印に時代を重ねてみましょう。',
  shuriSources);

regional('regional-66044',
  '1935年の案内書が「門司駅」から港や和布刈神社へ向かう順路を載せる、その門司駅が現在の門司港駅です。駅舎は1914年に建ち、1942年に駅名が「門司港駅」へ変わりました。2019年の保存修理では、大正時代の外観を目指して屋根の飾りなどを復原しています。昔の写真と比べると、建物を守るための修理によって、見た目の一部が変わっていることも分かります。駅から港へ歩く道を地図でたどってみましょう。',
  [source('official-mojiko-station', '門司港駅（旧門司駅）本屋（北九州市）', 'https://www.city.kitakyushu.lg.jp/contents/02100281.html'),
   source('official-mojiko-restoration', '100年の時を超え大正時代の門司港駅が復活！（北九州市）', 'https://www.city.kitakyushu.lg.jp/moji/w1100456.html')]);

regional('regional-1467126',
  '1935年の案内書は現在の太宰府天満宮を「太宰府神社」と呼び、菅原道真をめぐる飛梅の伝説や境内の大きなクスノキを紹介しています。飛梅が京都から飛んで来たというのは伝説で、史実として証明された出来事ではありません。道真の墓所の上に社が造られ、現在の御本殿は1591年の建物です。古い案内書の呼び名と現在の名前を重ね、梅、森、社殿がある境内の広がりを地図で見てみましょう。',
  [source('official-dazaifu-history', '御由緒（太宰府天満宮）', 'https://www.dazaifutenmangu.or.jp/about/goyuisho'),
   source('official-dazaifu-plum', '天神さまと梅（太宰府天満宮）', 'https://www.dazaifutenmangu.or.jp/about/tenjinsama-ume')]);
