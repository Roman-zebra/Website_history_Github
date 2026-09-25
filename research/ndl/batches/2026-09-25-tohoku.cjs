/* Japanese copy checked against the openly readable 1929 Tohoku guide. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = {id:'ndl-tohoku-guide-1929', title:'『日本案内記 東北篇』（1929年・国立国会図書館）', url:'https://dl.ndl.go.jp/pid/1176351'};
const source = (id, title, url) => ({id, title, url});
const edit = (file, field, key, update) => {
  const target = path.join(root, 'data', file);
  const doc = JSON.parse(fs.readFileSync(target, 'utf8'));
  const spot = doc[field].find(item => item.id === key);
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
const regional = (id, summary, sources) => edit('regional-landmarks-v1.json', 'landmarks', id, spot => {
  spot.summaries = {...spot.summaries, ja:summary};
  spot.researchSources = [book, ...sources];
  spot.reviewedOn = '2026-09-25';
});

feature('sendai',
  '仙台駅から広瀬川を越えて城跡へ。戦前の緑と戦後の並木も比べます。',
  [
    '1929年の案内書は、仙台駅を出発し、瑞鳳殿、仙台城址、芭蕉の辻などを回って駅に戻る順路を載せています。今の地図では駅の西に広がる市街をたどり、さらに広瀬川を越えて青葉山の城跡へ進むと、城下町と丘の位置関係が見えてきます。',
    '伊達政宗は1601年から青葉山に城を築き始めました。東の広瀬川沿いの崖を守りに使い、平地に町を広げました。案内書の時代には既に「城址」でした。天守が昔から立ち続けている城ではありません。',
    '仙台が「森の都」と呼ばれた記録は1909年に残り、屋敷林や寺社林がその緑のもとでした。1945年の空襲で中心部の木々は多く失われ、現在目立つ青葉通のケヤキは1950年から、定禅寺通は1958年に植えられました。',
    '古い写真と現在の空撮を重ねるときは、まず広瀬川と城跡の丘を探し、次に駅から伸びる通りを追いましょう。緑の多さだけでなく、緑が残った場所と植え直された場所の違いも読み取れます。'
  ],
  '1929年の案内書は仙台駅から瑞鳳殿、仙台城址などを回る道筋を載せています。城跡は広瀬川西側の青葉山にあり、政宗は1601年から築城を始めました。「森の都」の緑は戦災で大きく失われ、現在の青葉通・定禅寺通のケヤキは戦後の植樹です。',
  [source('official-sendai-castle', '仙台城の紹介（仙台市）', 'https://www.city.sendai.jp/shisekichosa/kurashi/manabu/kyoiku/inkai/bunkazai/bunkazai/joseki/shokai.html'),
   source('official-sendai-green', '緑の歴史・今昔（仙台市）', 'https://www.city.sendai.jp/hyakunen-chose/kurashi/shizen/midori/shinse/kids/konjaku.html')]);

regional('regional-712357',
  '1929年の案内書は、仙台駅から瑞鳳寺を経て坂を上がると瑞鳳殿に着くと記し、1637年に建てられた伊達政宗の霊廟として紹介しています。ただし、当時見えた建物は1945年の仙台空襲で焼失しました。現在の華やかな建物は1979年の再建です。木立の中の参道をたどり、政宗の墓所が街の中心から少し離れた高みに置かれたことと、建物が作り直された歴史を一緒に見てみましょう。',
  [source('official-zuihoden', '瑞鳳殿のご案内（瑞鳳殿）', 'https://www.zuihoden.com/about/')]);

regional('regional-88553',
  '1929年の案内書は、仙台から松島へ向かう旅で、五大堂と瑞巌寺を続けて訪ねる道筋を紹介し、瑞巌寺を桃山時代の建築として挙げています。現在の本堂は、伊達政宗が1609年に建てた建物です。海に近い五大堂から内陸の寺へ歩くと、島々を眺める観光地と、政宗が整えた祈りの場が一続きだと分かります。',
  [source('official-zuiganji-history', '縁起（瑞巌寺）', 'https://www.zuiganji.or.jp/history/'),
   source('official-zuiganji-guide', '境内のご案内（瑞巌寺）', 'https://zuiganji.or.jp/guide/keidai_01.php')]);

regional('regional-1549755',
  '1929年の案内書は、弘前城址の本丸・二の丸・三の丸に堀、土塁、石垣が残り、一部が公園として親しまれていると紹介しています。城は1611年に完成し、現在の天守は1810年に建てられた木造の建物です。古い建物ですが、築城当初の天守そのものではありません。石垣の修理に合わせて天守を移した時期もあります。空撮では天守の位置だけに頼らず、重なる堀と広い城郭の形を先に探してみましょう。',
  [source('official-hirosaki-castle', '弘前城と石垣修理の歴史（弘前市）', 'https://www.city.hirosaki.aomori.jp/ishigaki/rekishi.html')]);

regional('regional-205162',
  '1929年の案内書は、立石寺を川の北側にそびえる山腹の寺と紹介し、ふもとの根本中堂から坂と石段を上って奥之院へ進む道をたどっています。寺の歴史は860年にさかのぼります。山寺の堂々は一か所に集まらず、岩と木の間に段々と置かれています。地図では川、集落、山門、山腹の堂の順に見て、参拝が山を上る道そのものでもあることを感じてみましょう。',
  [source('official-risshakuji', '立石寺について（立石寺）', 'https://rissyakuji.jp/about/'),
   source('official-yamagata-yamadera', '松尾芭蕉と山寺立石寺（山形市）', 'https://www.city.yamagata-yamagata.lg.jp/shiseijoho/shicho/1006787/1006790/1005497.html')]);

regional('regional-88539',
  '1929年の案内書は、奥州藤原氏が平泉に中尊寺や毛越寺を築き、当時も金色堂が残っていると紹介しています。1124年に藤原清衡が建てた金色堂は、平安時代の姿を伝える建物です。一方、境内の建物すべてが創建時から同じ姿で残っているわけではありません。月見坂を上りながら堂や経蔵の位置をたどり、山の寺と周囲に広がった平泉の町・寺院跡を一緒に眺めてみましょう。',
  [source('official-chusonji-history', '中尊寺の歴史（中尊寺）', 'https://www.chusonji.or.jp/know/history.html'),
   source('official-chusonji-konjikido', '金色堂について（中尊寺）', 'https://www.chusonji.or.jp/know/konjikido.html'),
   source('official-hiraizumi-buildings', '建造物（平泉の文化遺産）', 'https://www.town.hiraizumi.iwate.jp/heritage/property/kenzou.html')]);
