/* Public NDL book checked in Chrome; text checked against the publisher's public PDF. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-resilient-community-7', title: '羽生淳子ほか『レジリエントな地域社会 7』（2022年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/13125219' };
const museum = { id: 'official-sannai-about', title: '三内丸山遺跡とは（三内丸山遺跡センター）', url: 'https://sannaimaruyama.pref.aomori.jp/about/iseki/' };
const finds = { id: 'official-sannai-organic-finds', title: '有機質出土品（三内丸山遺跡縄文デジタルアーカイブ）', url: 'https://sannaimaruyama.pref.aomori.jp/sanmaru_search/cat_organic/' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '三内丸山遺跡');
if (!spot) throw Error('三内丸山遺跡 not found');
spot.summaries = { ...spot.summaries, ja: '三内丸山遺跡は、約5900～4200年前に人々が暮らした青森市の大きな縄文集落跡です。住まいの跡だけでなく、大人と子どもの墓、土器や石器を積み重ねた盛土、直径約1メートルのクリの柱が残る大型建物跡も見つかりました。低地では木の実や魚・動物の骨、漆器まで保存され、当時の食卓や手仕事を具体的に思い描けます。羽生淳子らの公開書籍は石器と住居跡の変化を読み解き、長く続いた集落でも食と暮らし方が変わっていった可能性を示しています。見学時には復元建物と発掘された柱穴を見比べてみてください。2021年には「北海道・北東北の縄文遺跡群」の一部として世界文化遺産に登録されました。' };
spot.researchSources = [book, museum, finds];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
if (!registry.sources.some(x => x.id === book.id)) registry.sources.push({ id: book.id, type: 'book', title: 'レジリエントな地域社会 7 アグロエコロジーからみた長期的持続可能性と里山', author: '羽生淳子ほか', year: 2022, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I13125219', fullText: book.url, access: 'ログインなしで閲覧可能／インターネット公開（許諾）', fullTextSearchFrames: [72, 73, 74], notes: '4章「景観研究からみたアグロエコロジーと考古学」のPDF 72～74ページ。石器組成と住居跡の変化から生業・食の変化を論じる。因果関係は著者の仮説であり、説明文では可能性と記載。出版社公開PDF https://www.chikyu.ac.jp/fooddiversity/newsletter/file/Resilient7.pdf でも本文照合。', usedFor: [spot.ja] });
for (const item of [
  { ...museum, type: 'official', publisher: '青森県三内丸山遺跡センター', notes: '年代、建物・墓・盛土、出土品、世界遺産登録。', usedFor: [spot.ja] },
  { ...finds, type: 'official', publisher: '青森県三内丸山遺跡センター', notes: '木の実、魚・動物骨、漆器などの出土。', usedFor: [spot.ja] },
]) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
