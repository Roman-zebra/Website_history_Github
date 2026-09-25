/* Top-tier Japanese copy checked against openly readable NDL book pages. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const target = path.join(root, 'data/places-world.json');
const doc = JSON.parse(fs.readFileSync(target, 'utf8'));
const source = (id, title, url) => ({id, title, url});
const feature = (id, hook, story, summary, sources) => {
  const spot = doc.places.find(item => item.id === id);
  if (!spot) throw Error(`missing ${id}`);
  spot.hook_ja = hook;
  spot.story_ja = story;
  spot.hooks.ja = hook;
  spot.summaries.ja = summary;
  spot.researchSources = sources;
  spot.reviewedOn = '2026-09-25';
};

feature('nagoya',
  '堀を目印に、清須から移った城下町と戦後に再建された名古屋城をたどります。',
  [
    '1925年の『名古屋案内』は、徳川家康が清須から町を移して名古屋城を築いた経緯を説明しています。水害に弱かった清須に代わる新しい拠点でした。石垣のために各地の大名が大きな石を運び、天守には金のしゃちほこが載りました。',
    '天守と本丸御殿は1945年の空襲で焼失しました。古い航空写真の時代には、江戸時代から続いた天守はすでにありません。堀の形と石垣の位置を先に探すと、建物が失われても城の輪郭を追えます。',
    '現在見える天守は、市民の寄付も受けて1959年に再建されたものです。本丸御殿も、残された図面や写真などを手がかりに2018年までに復元されました。築城時の建物がそのまま残った姿と、戦後に取り戻した姿を分けて見てみましょう。',
    '天守は現在閉館中です。見学できる場所や公開状況は名古屋城の公式案内で確認してください。地図では、堀の内側に建物が戻り、外側の街路が変化した様子を比べられます。'
  ],
  '1925年の『名古屋案内』は、徳川家康が水害に弱い清須から町を移し、各地の大名が石垣の石を運んだと記します。1945年に天守と本丸御殿は焼失。現在の天守は1959年の再建、本丸御殿は2018年までの復元です。堀を目印に、失われた建物と戻った建物を見分けましょう。',
  [source('ndl-nagoya-guide-1925', '長尾盛之助『名古屋案内』（1925年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/905365'),
   source('official-nagoya-tower', '天守閣（名古屋城）', 'https://www.nagoyajo.city.nagoya.jp/guide/tenshu/'),
   source('official-nagoya-palace', '本丸御殿（名古屋城）', 'https://www.nagoyajo.city.nagoya.jp/guide/honmarugoten/'),
   source('official-nagoya-faq', 'よくある質問（名古屋城）', 'https://www.nagoyajo.city.nagoya.jp/info/faq/')]);

feature('kanazawa',
  '犀川と浅野川に挟まれた城下町で、城跡が大学から公園へ変わる様子を追います。',
  [
    '金沢市が編んだ『稿本金沢市史』は、城下の地形を犀川と浅野川という二つの川、そして間の台地や坂道から説明しています。前田利家が1583年に金沢城へ入り、川と高低差を生かした城下町が広がりました。まず二つの川と城・兼六園の位置を地図で探してください。',
    '1960年代の航空写真に写る城跡は、現在の公園とは使われ方が違います。戦後は金沢大学のキャンパスとなり、1995年の大学移転後に金沢城公園として整備されました。城の石垣や石川門が残る一方、内部の広場や建物は時代ごとに変わっています。',
    '城の隣には、前田家が育てた庭園・兼六園があります。浅野川の向こうのひがし茶屋街は1820年に整えられた町割りが今に続きます。ただし、金沢全体が江戸時代のまま残ったわけではありません。昔の区画を生かしながら、新しい施設や使い方が加わってきました。',
    '川、坂、城の石垣、庭園、茶屋街を順に追うと、一つの観光地ではなく、地形に沿って重なった町の歴史が見えてきます。'
  ],
  '金沢市刊の『稿本金沢市史』は、犀川と浅野川、その間の台地や坂道から町の形を説明します。1960年代の城跡には金沢大学があり、1995年の移転後は公園として整備されました。兼六園と浅野川沿いの茶屋街も、城を中心にした町の広がりを読む目印です。',
  [source('ndl-kanazawa-city-history-1925', '金沢市『稿本金沢市史 市街編 第1』（1925年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/951540'),
   source('official-kanazawa-history', '金沢の歴史と文化（金沢市）', 'https://digilib.city.kanazawa.ishikawa.jp/preview/pdf/Br_-JAAAA'),
   source('official-kanazawa-castle-park', '金沢の維持及び向上すべき歴史的風致（金沢市）', 'https://digilib.city.kanazawa.ishikawa.jp/preview/pdf/BFFzQgAAA'),
   source('official-kanazawa-teahouse', '時を歩くまち 金沢（金沢市観光協会）', 'https://www.kanazawa-kankoukyoukai.or.jp/modelCourse/detail_136.html')]);

feature('aneyoshi',
  '津波碑の言葉を手がかりに、姉吉の海岸・斜面・家並みの位置関係を読みます。',
  [
    '姉吉は、湾の奥から山が迫る小さな集落です。岩手県が1934年に刊行した『岩手県昭和震災誌』は、1933年の津波で姉吉の家や家財が流され、集落が壊滅した様子を記録しています。1896年の明治三陸津波でも大きな被害を受けていました。',
    '二度の災害を伝える大津浪記念碑には、「此処より下に家を建てるな」と刻まれています。1934年の震災誌も、沿岸の町村に津波の浸水線を示す石標や記念碑を建てる取組を記しています。姉吉の碑は、災害を忘れないための言葉を住まいの位置に結びつけました。',
    '国土地理院によると、住民は碑より低い場所に家を建てず、2011年の東日本大震災では家屋に被害がありませんでした。これは姉吉で確認された過去の結果です。石碑の高さだけで、将来の津波に対する安全を判断することはできません。',
    '航空写真で石碑そのものを見分けるのは難しいため、入り江から続く道と急な斜面、その上の家並みを見てください。現在の避難場所や浸水想定は、宮古市の総合防災ハザードマップで確かめましょう。'
  ],
  '岩手県の1934年の震災誌は、1933年の津波で姉吉の家や家財が流されたと記録しています。1896年にも被災した集落の碑は「此処より下に家を建てるな」と伝え、2011年には碑より高い場所の家屋が被害を免れました。航空写真では海岸からの斜面と家並みを追い、現在の避難情報は宮古市の防災地図で確認してください。',
  [source('ndl-iwate-1934-tsunami', '岩手県『岩手県昭和震災誌』（1934年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/1746255'),
   source('official-miyako-tsunami-history', '三陸海岸の景観と津波の伝承（宮古市）', 'https://www.city.miyako.iwate.jp/gyosei/soshiki/spo_bunka/5/2/0000000/miyakkostory/10044.html'),
   source('official-gsi-aneyoshi', '自然災害伝承碑・大津浪記念碑（国土地理院）', 'https://www.gsi.go.jp/bousaichiri/bousaichiri41080.html'),
   source('official-miyako-hazard', '宮古市総合防災ハザードマップ（宮古市）', 'https://www.city.miyako.iwate.jp/gyosei/soshiki/kikikanri/1/4/maps/hazard/3194.html')]);

fs.writeFileSync(target, JSON.stringify(doc) + '\n');
