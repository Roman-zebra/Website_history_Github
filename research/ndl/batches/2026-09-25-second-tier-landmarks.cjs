/* Tier-two landmark Japanese summaries grounded in readable NDL volumes. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const source = (id, title, url) => ({id, title, url});
const matsumotoBook = source('ndl-matsumoto-guide-1921', '松本案内編輯部『松本案内』（1921年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/965000');
const iseBook = source('ndl-ise-guide-1919', '服部英雄『伊勢参宮案内』（1919年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/958485');
const kantoBook = source('ndl-kanto-guide-1930', '鉄道省『日本案内記 関東篇』（1930年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/1176338');
const kinkiBook = source('ndl-kinki-guide-1941', '鉄道省『日本案内記 近畿篇 上 改版』（1941年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/1172399');
const nagoyaBook = source('ndl-nagoya-guide-1925', '長尾盛之助『名古屋案内』（1925年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/905365');
const target = path.join(root, 'data/landmarks.json');
const doc = JSON.parse(fs.readFileSync(target, 'utf8'));
const edit = (name, summary, sources) => {
  const spot = doc.landmarks.find(item => item.ja === name);
  if (!spot) throw Error(`missing ${name}`);
  spot.summaries.ja = summary;
  spot.researchSources = sources;
  spot.reviewedOn = '2026-09-25';
};

edit('松本城',
  '1921年の『松本案内』は、石川氏が深志城を松本城へ改め、五層の天守が城址の南西にそびえると案内しています。天守は城下を守る建物でしたが、明治に売却され、取り壊しの危機を迎えました。地元の人々が買い戻しと修理を支え、戦後にも大規模な解体修理が行われています。現在の黒い天守は、古い建物を残しながら手を入れて守ってきた姿です。航空写真では天守だけでなく、堀と本丸・二の丸の輪郭を探し、失われた城郭部分との違いを見てみましょう。',
  [matsumotoBook, source('official-matsumoto-history', '松本城の歴史（松本市）', 'https://www.city.matsumoto.nagano.jp/soshiki/135/4121.html'), source('official-matsumoto-tower', '松本城天守（松本市）', 'https://www.city.matsumoto.nagano.jp/soshiki/134/3771.html')]);

edit('名古屋城',
  '1925年の『名古屋案内』は、水害に弱い清須から徳川家康が町を移し、各地の大名が石垣の石を運んだと伝えます。金のしゃちほこを載せた旧天守と本丸御殿は1945年に焼失しました。現在の天守は1959年の再建、本丸御殿は残された図面や写真などを手がかりに復元された建物です。古い航空写真で堀と石垣を先に探すと、建物が失われても城の位置をたどれます。天守は現在閉館中のため、見学範囲は公式案内で確かめてください。',
  [nagoyaBook, source('official-nagoya-tower', '天守閣（名古屋城）', 'https://www.nagoyajo.city.nagoya.jp/guide/tenshu/'), source('official-nagoya-palace', '本丸御殿（名古屋城）', 'https://www.nagoyajo.city.nagoya.jp/guide/honmarugoten/'), source('official-nagoya-faq', 'よくある質問（名古屋城）', 'https://www.nagoyajo.city.nagoya.jp/info/faq/')]);

edit('二条城',
  '1941年の『日本案内記』は、二条城を将軍が京都へ来たときの宿所として築いた城と説明し、二の丸御殿や庭園を紹介しています。1867年には徳川慶喜が二の丸御殿で政権を朝廷へ返す意思を表明しました。明治には皇室の離宮となり、1939年に京都市へ渡されています。同じ敷地でも、将軍の城、離宮、市が公開する史跡と役割が変わりました。航空写真では外堀で囲まれた四角い敷地と、内側の二の丸・本丸を見分けてみましょう。',
  [kinkiBook, source('official-nijo-history', '二条城の歴史（元離宮二条城）', 'https://nijo-jocastle.city.kyoto.lg.jp/introduction/highlights/nenpyo/'), source('official-nijo-overview', '二条城の概要（元離宮二条城）', 'https://nijo-jocastle.city.kyoto.lg.jp/introduction/highlights/overview/')]);

edit('築地',
  '1930年の『日本案内記』は、築地の市場を魚だけでなく青果、肉、卵も扱う卸売の場所として紹介し、魚市場は日本橋河岸から移ったと記しています。震災後の移転を経て、東京都の中央卸売市場として正式に開場したのは1935年でした。2018年には卸売市場の機能が豊洲へ移りましたが、隣の場外市場には今も食材や調理道具の店が並びます。航空写真では隅田川の河口に近い広い市場跡と、周囲に続く細い商店街を分けて見てください。',
  [kantoBook, source('official-tokyo-tsukiji-history', '築地まちづくり方針（東京都）', 'https://www.toshiseibi.metro.tokyo.lg.jp/bosai/toshi_saisei/data/saisei0802_62.pdf'), source('official-tsukiji-outer-market', 'これからの築地（築地場外市場）', 'https://www.tsukiji.or.jp/know/future/')]);

edit('伊勢神宮',
  '1919年の『伊勢参宮案内』は、外宮の鳥居橋や内宮へ向かう道を順に記し、二つの宮を歩いて巡る参詣を案内しています。伊勢神宮は、天照大御神をまつる内宮と、豊受大御神をまつる外宮を中心とする社の集まりです。古くから外宮から内宮へ参るならわしがありますが、必ず守るべき順序ではありません。社殿は式年遷宮で約20年ごとに造り替えられます。古い写真と今を比べるときは、建物だけでなく宇治橋、五十鈴川、外宮と内宮を結ぶ道にも目を向けてください。',
  [iseBook, source('official-ise-about', '神宮について（伊勢神宮）', 'https://www.isejingu.or.jp/about/'), source('official-ise-sengu', '式年遷宮とは（伊勢神宮）', 'https://www.isejingu.or.jp/sengu/the63rd/about.html'), source('official-ise-qa', 'よくあるご質問（伊勢神宮）', 'https://www.isejingu.or.jp/qa/')]);

fs.writeFileSync(target, JSON.stringify(doc) + '\n');

const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const add = record => { if (!registry.sources.some(item => item.id === record.id)) registry.sources.push(record); };
add({id:matsumotoBook.id,type:'book',title:'松本案内 : 附・日本アルプスと松本平',author:'松本案内編輯部',year:1921,ndlSearch:'https://ndlsearch.ndl.go.jp/books/R100000039-I965000',fullText:matsumotoBook.url,access:'ログインなしで閲覧可能／インターネット公開（保護期間満了）',fullTextSearchFrames:[15,44,45],notes:'15コマに初期の深志城、44～45コマに石川氏の改築と五層天守。修理・指定の後年の経緯は松本市資料で確認。',usedFor:['松本城']});
add({id:iseBook.id,type:'book',title:'伊勢参宮案内',author:'服部英雄',year:1919,ndlSearch:'https://ndlsearch.ndl.go.jp/books/R100000039-I958485',fullText:iseBook.url,access:'ログインなしで閲覧可能／インターネット公開（裁定）',fullTextSearchFrames:[10,11,12,13],notes:'10コマで外宮の鳥居橋と内宮へ向かう道を確認。現行の祭神・遷宮・参拝案内は神宮公式資料で補う。',usedFor:['伊勢神宮']});
for (const [id,frames,usedFor,note] of [
  ['ndl-nagoya-guide-1925',[], '名古屋城',''],
  ['ndl-kinki-guide-1941',[30,32,83], '二条城','83コマに二の丸御殿、1939年の京都市への下賜。30・32コマに将軍の上洛と大政奉還。'],
  ['ndl-kanto-guide-1930',[80], '築地','80コマに中央卸売市場築地本場と魚市場の日本橋河岸からの移転。1935年の正式開場とは区別する。']
]) {
  const record = registry.sources.find(item => item.id === id);
  if (!record) throw Error(`missing source ${id}`);
  record.fullTextSearchFrames = [...new Set([...record.fullTextSearchFrames,...frames])].sort((a,b)=>a-b);
  record.usedFor = [...new Set([...record.usedFor, usedFor])];
  if (note && !record.notes.includes(note)) record.notes += ' ' + note;
}
const official = (id,title,publisher,url,notes,usedFor) => add({id,type:'official',title,publisher,url,notes,usedFor:[usedFor]});
official('official-matsumoto-history','松本城の歴史','松本市','https://www.city.matsumoto.nagano.jp/soshiki/135/4121.html','明治の買戻し・修理と昭和の解体修理。','松本城');
official('official-matsumoto-tower','松本城天守','松本市','https://www.city.matsumoto.nagano.jp/soshiki/134/3771.html','天守と堀・郭の歴史。','松本城');
official('official-nijo-history','二条城の歴史','京都市','https://nijo-jocastle.city.kyoto.lg.jp/introduction/highlights/nenpyo/','1603年築城、1867年大政奉還、1939年市へ下賜。','二条城');
official('official-nijo-overview','二条城の概要','京都市','https://nijo-jocastle.city.kyoto.lg.jp/introduction/highlights/overview/','将軍の宿所としての用途と二の丸御殿。','二条城');
official('official-tokyo-tsukiji-history','築地まちづくり方針','東京都','https://www.toshiseibi.metro.tokyo.lg.jp/bosai/toshi_saisei/data/saisei0802_62.pdf','1935年開場、2018年豊洲へ移転。','築地');
official('official-tsukiji-outer-market','これからの築地','築地場外市場','https://www.tsukiji.or.jp/know/future/','現在も場外市場に店舗が並ぶ。','築地');
official('official-ise-about','神宮について','神宮司庁','https://www.isejingu.or.jp/about/','内宮と外宮の祭神と構成。','伊勢神宮');
official('official-ise-sengu','式年遷宮とは','神宮司庁','https://www.isejingu.or.jp/sengu/the63rd/about.html','約20年ごとの式年遷宮。','伊勢神宮');
official('official-ise-qa','よくあるご質問','神宮司庁','https://www.isejingu.or.jp/qa/','外宮から内宮への参拝順序はならわしで、必須ではない。','伊勢神宮');
const compactArrays = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_whole,key,contents) => `"${key}": [${JSON.parse(`[${contents}]`).map(item => JSON.stringify(item)).join(', ')}]`);
fs.writeFileSync(registryTarget, compactArrays + '\n');
