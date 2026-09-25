/* Japanese copy checked against the openly readable 1936 Hokkaido guide. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = {id:'ndl-hokkaido-guide-1936', title:'『日本案内記 北海道篇』（1936年・国立国会図書館）', url:'https://dl.ndl.go.jp/pid/1877025'};
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

feature('sapporo',
  '創成川と大通を十字の目印に、札幌の街が広がった順序をたどります。',
  [
    '1936年の案内書は、創成川が街の中央を南北に流れ、街路がおよそ100メートルごとの格子に区切られると紹介しています。現在の地図でも、創成川をはさんだ「西」と「東」、大通をはさんだ「北」と「南」という住所の並びに、その骨組みが残っています。',
    '札幌市によると、この街路計画は1871年に始まりました。まっすぐな道が先に引かれ、周囲に建物や公園が増えていったため、古い写真と今の地図を比べると、同じ区画が別の使われ方をしているのが分かります。',
    '大通は市街の南北を分ける広い帯です。創成川と大通が交わるところを探してから東西南北に目を移すと、似た形の区画の中でも街の育ち方が違って見えます。'
  ],
  '1936年の案内書にも、創成川と格子状の街路が描かれています。創成川で東西、大通で南北を分ける住所の仕組みは、1871年からの街路計画を今に伝えます。二つが交わる場所を起点に、同じ区画の昔と今を見比べてみましょう。',
  [source('official-sapporo-grid', '札幌の街路の歴史（札幌市）', 'https://www.city.sapporo.jp/kensetsu/yuki/library/hist/01.html'),
   source('official-sapporo-blocks', '中央区のまちの姿（札幌市）', 'https://www.city.sapporo.jp/chuo/gaiyo/profile.html')]);

feature('hakodate',
  '函館山のふもとから港へ下る坂をたどり、港町の形を読みます。',
  [
    '1936年の案内書は、函館山の北東側へ街が扇のように広がる姿と、元町の高台に響く教会の鐘を描いています。山と海にはさまれた狭い土地に道を通したため、坂から港を見下ろせる場所が多くあります。',
    '函館は1859年に外国貿易の港として開かれました。港に近い元町・末広町には、明治から戦前にかけて建てられた教会や商館などの建物が残り、街並みは保存地区として守られています。',
    '古い写真を見るときは、建物が同じまま残ったと決めつけず、函館山、坂の向き、港の岸を手がかりにしてください。山から港へ下る道筋をたどると、港とともに発展した街の位置が分かります。'
  ],
  '1936年の案内書は、函館山のふもとから北東へ広がる街と元町の教会を描いています。1859年に外国貿易の港として開かれた函館では、港を見下ろす坂に明治から戦前の建物が残ります。山、坂、港の順に昔と今を重ねてみましょう。',
  [source('official-hakodate-port-history', '函館市のあゆみ（函館市）', 'https://www.city.hakodate.hokkaido.jp/docs/2014012000086/'),
   source('official-hakodate-preservation', '函館市元町末広町伝統的建造物群保存地区（函館市）', 'https://www.city.hakodate.hokkaido.jp/docs/2014022000335/')]);

regional('regional-10577',
  '1936年の案内書は、五稜郭をオランダ式の築城法による、五つの角を持つ城跡として紹介しています。1864年には郭内の箱館奉行所で業務が始まり、のちに箱館戦争の舞台にもなりました。かつての奉行所の建物は解体され、現在中心に立つ建物は2010年に一部を復元したものです。地図では星形の堀と土塁を先に見て、中央の建物が昔からそのまま残ったものではないことも確かめてみましょう。',
  [source('official-goryokaku-history', '函館市の概要（函館市）', 'https://www.city.hakodate.hokkaido.jp/docs/2014012300506/'),
   source('official-goryokaku-office', '箱館奉行所の歴史（箱館奉行所）', 'https://hakodate-bugyosho.jp/history/')]);

regional('regional-316631',
  '1936年の案内書は、小樽を日本海側の重要な港町として紹介し、港の近くに北海製罐の倉庫や工場があったことも記しています。小樽運河自体の成立は小樽市の資料で確かめられます。1923年、海岸の沖を埋め立て、船から倉庫へ荷物を運びやすくする水路が完成しました。運河は後に一部が埋め立てられましたが、市民の保存運動を経て1986年に散策路が整いました。ゆるく曲がる水路と倉庫の並びを見て、働く港が観光の景色へ変わった過程をたどりましょう。',
  [source('official-otaru-canal', '小樽運河（小樽市）', 'https://www.city.otaru.lg.jp/docs/2020100900367'),
   source('official-otaru-port-history', '小樽港の沿革と自然状況（小樽市）', 'https://www.city.otaru.lg.jp/docs/2020100700011/')]);
