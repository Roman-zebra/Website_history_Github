/* Japanese copy checked against the openly readable 1934 Chugoku–Shikoku guide. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = {id:'ndl-chugoku-shikoku-guide-1934', title:'『日本案内記 中国・四国篇』（1934年・国立国会図書館）', url:'https://dl.ndl.go.jp/pid/1176396'};
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
const regional = (id, summary, sources) => edit('regional-landmarks-v1.json', 'landmarks', id, spot => {
  spot.summaries = {...spot.summaries, ja:summary};
  spot.researchSources = [book, ...sources];
  spot.reviewedOn = '2026-09-25';
});

feature('hiroshima',
  '元安橋と原爆ドームを目印に、公園になる前の中島地区と現在の街を重ねます。',
  [
    '1934年の鉄道省の案内書には、元安橋が元安川を越えて中島本町へつながるとあります。中島本町には銀行や映画館も載っています。今の平和記念公園がある一帯は、かつて人が暮らし、商い、映画を見に来る街でした。',
    '1945年8月6日の原子爆弾で、この街は壊滅しました。川沿いの広島県産業奨励館は大破・全焼し、原爆ドームとして残されました。館内にいた人たちも亡くなっています。',
    '戦後、旧中島地区を含む爆心地周辺に平和記念公園が計画されました。広く開けた現在の景色は、1934年の案内書が見た街並みとは異なります。',
    '1945～50年の航空写真では元安川と橋を先に探し、現在の公園の輪郭を重ねてみましょう。川を目印にすると、失われた街の広がりをたどれます。'
  ],
  '1934年の案内書には、元安橋につながる中島本町の銀行や映画館が載っています。1945年の原爆で地区は壊滅し、産業奨励館は原爆ドームとして残りました。戦後に整備された平和記念公園を、元安川と橋を目印に昔の街と重ねてみましょう。',
  [source('official-hiroshima-dome', '広島県産業奨励館（広島市）', 'https://www.city.hiroshima.lg.jp/atomicbomb-peace/fukko/1021101/1026919/1020911.html'),
   source('official-hiroshima-peace-park', '平和記念公園ができるまで（広島市）', 'https://www.city.hiroshima.lg.jp/tourism-culture/history/1003068/1027532/1008364.html')]);

feature('okayama',
  '黒い天守と旭川の曲がりを目印に、戦前の岡山城と現在の城を見比べます。',
  [
    '1934年の案内書は、岡山城の東側を旭川が外堀のように囲み、黒い城から「烏城」と呼ばれると記しています。当時は古い天守のほか、櫓や門も残っていました。',
    'その天守は1945年6月の岡山空襲で焼失しました。現在の黒い天守は1966年に元の位置へ外観を復元して建てたものです。同じ黒い姿でも、1934年の本に載る建物そのものではありません。',
    '旭川の向こうには後楽園があります。案内書は川の左岸にある庭園として紹介し、今も城と庭園は川を挟んで向き合っています。',
    '航空写真では天守の細部より、旭川の曲がり、城の本丸、対岸の庭園を先に探しましょう。川が昔と今の位置合わせを助けます。'
  ],
  '1934年の案内書は、旭川に囲まれた黒い「烏城」と対岸の後楽園を紹介しています。当時の天守は1945年の空襲で焼失し、現在の天守は1966年の外観復元です。旭川の曲がりを目印に城と庭園を比べてみましょう。',
  [source('official-okayama-castle', '岡山城の歴史（岡山城）', 'https://okayama-castle.jp/learn-history/'),
   source('official-okayama-korakuen', '後楽園の歴史・概要（岡山県）', 'https://okayama-korakuen.jp/rekishi/index.html')]);

regional('regional-1054053',
  '1934年の案内書は、倉敷の名を米を保管した倉に結び付け、紡績工場と開館間もない大原美術館も紹介しています。今の美観地区は、昔から観光のためだけに造られた町ではありません。倉敷川沿いの商家や蔵は1979年に国の保存地区に選ばれました。川と白壁の並びをたどり、物流の町が保存された景観になった道筋を想像してみましょう。',
  [source('official-kurashiki-history', '美観地区の沿革（倉敷市）', 'https://www.city.kurashiki.okayama.jp/culture/art/1007596/1007818/1007819/1007820.html'),
   source('official-kurashiki-preservation', '倉敷川畔伝統的建造物群保存地区（倉敷市）', 'https://www2.city.kurashiki.okayama.jp/kurashikitrip/bunkazai/bunkazai-01.html'),
   source('official-ohara-museum', '美術館の歴史（大原美術館）', 'https://www.ohara.or.jp/history/')]);

regional('regional-296607',
  '1934年の案内書は、松江城を「千鳥城」とも呼び、天守と堀の残る城跡を紹介しています。この天守は1611年に完成した建物が今も残る、全国でも少ない現存天守です。2015年には国宝に指定されました。ただし周囲の櫓には後年の復元もあります。堀の輪と小高い城山を地図でたどり、古い天守と後から戻った建物を分けて見てみましょう。',
  [source('official-matsue-castle-history', '歴史・藩主（松江城）', 'https://www.matsue-castle.jp/highlight/history'),
   source('official-matsue-castle-citadel', '城郭（松江城）', 'https://www.matsue-castle.jp/highlight/citadel')]);

regional('regional-43296',
  '1934年の案内書は、錦川に架かる五つの連なった木の橋を「算盤橋」とも呼んでいます。現在の橋は当時の木材がそのまま残るわけではありません。1950年の台風で流失し、地元の希望で1953年に木造で再建、2004年にも木造部分を架け替えました。五つの橋の形を受け継ぐために直し続けてきた橋として、川と両岸を見てみましょう。',
  [source('official-kintaikyo-history', '錦帯橋の概要（岩国市）', 'https://kintaikyo.iwakuni-city.net/summary.html')]);

regional('regional-13585',
  '1934年の案内書は、尾道を背後の三つの山と、向島に面する狭い海峡にはさまれた街として描き、千光寺山の中腹を眺めのよい公園と紹介しています。平地が少ないため、家や寺が斜面に重なり、坂道と路地でつながります。地図では尾道水道の細さ、対岸の向島、千光寺へ上がる斜面を一続きでたどってみましょう。',
  [source('official-onomichi-city', '日本遺産のまち尾道（尾道市）', 'https://www.city.onomichi.hiroshima.jp/soshiki/7/72155.html'),
   source('official-senkoji-park', '千光寺公園（尾道市）', 'https://www.city.onomichi.hiroshima.jp/site/onomichikanko/1316.html')]);

regional('regional-203351',
  '1934年の案内書は、萩城を既に「城址」と呼び、指月山の南東麓に本丸跡のある公園を紹介しています。天守は戦争で失われたのではなく、明治時代の1874年に解体されました。今は石垣と堀の一部が残ります。海へ突き出る指月山、山麓の本丸、城下町の順に地図を広げると、城が山と海を使っていたことが見えてきます。',
  [source('official-hagi-castle', '萩城 本丸・二の丸コース（萩市）', 'https://www.city.hagi.lg.jp/site/machihaku/kochizu-hagijohonmaru.html'),
   source('official-hagi-castle-history', '萩城跡指月公園（萩市）', 'https://www.city.hagi.lg.jp/uploaded/attachment/26680.pdf')]);

regional('regional-313749',
  '1934年の案内書は、栗林公園を池をめぐる庭園として紹介し、背後の紫雲山を景色の大切な一部としています。山は園の外にありますが、庭から見ると奥行きが増して見えます。現在の園には六つの池と十三の築山があり、江戸時代の大名庭園を受け継ぐ南庭と、明治以降に公園として整えた北庭があります。池だけでなく西側の山まで地図で眺めてみましょう。',
  [source('official-ritsurin-garden', '特別名勝 栗林公園（香川県観光協会）', 'https://www.my-kagawa.jp/ritsuringarden/feature/ritsuringarden/garden')]);

regional('regional-172545',
  '1934年の案内書は、金刀比羅宮の門前町に旅館や土産物店が段々に集まり、山の中腹の社へ参道が延びる様子を記しています。御本宮は町から785段の石段を上った先にあり、現在の社殿は1878年の改築です。地図で駅から参道へ進み、町並みが山道に変わる場所と御本宮の高さを確かめてみましょう。',
  [source('official-konpira-guide', '参拝ガイド 御本宮編（金刀比羅宮）', 'https://www.konpira.or.jp/articles/20200616_guide/article.htm')]);

regional('regional-110590',
  '1934年の案内書は、高知城を街の中央の高まりにある城跡として紹介し、天守、追手門、本丸の建物が残ると記しています。天守は1727年の火災後に再建された江戸時代の木造建築です。本丸御殿も残り、天守と一緒に見られるのは全国でも珍しいことです。街から追手門を通り、丘の上の本丸へ進む道筋を地図でたどってみましょう。',
  [source('official-kochi-castle', '高知城（高知市）', 'https://www.city.kochi.kochi.jp/soshiki/90/cas-state-1100500.html'),
   source('official-kochi-castle-architecture', '天守の構造（高知城）', 'https://kochipark.jp/kochijyo/architecture/')]);
