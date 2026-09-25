/* NDL public book and its publisher PDF read for the Uchiko case study. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-construction-economy-65', title: '建設経済研究所『建設経済レポート 65』（2015年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/13580405' };
const town = { id: 'official-uchiko-youkaichi', title: '八日市・護国の町並み（内子町）', url: 'https://www.town.uchiko.ehime.jp/soshiki/3/132649.html' };
const wax = { id: 'official-uchiko-kamihaga', title: '木蝋資料館上芳我邸（内子町）', url: 'https://www.town.uchiko.ehime.jp/site/hozonsenta/kamihaga.html' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '八日市護国');
if (!spot) throw Error('八日市護国 not found');
spot.summaries = { ...spot.summaries, ja: '八日市・護国は、愛媛県内子町に残る古い町並みです。江戸時代には街道沿いの町として発展し、江戸後期から明治期にはハゼの実から作る木蝋の生産で栄えました。約600メートルの通りには黄色みを帯びた漆喰壁の町家が続き、家と家の間には「せだわ」と呼ばれる細い路地もあります。木蝋資料館上芳我邸では、住まいと釜場・倉庫が一体になった製蝋業者の屋敷を見られます。国会図書館で公開されている『建設経済レポート』は、1970年代に住民が始めた町並み保存が、1982年の国の保存地区選定や地域全体のまちづくりへ広がった経緯を伝えています。美しい壁だけでなく、産業と住民の取り組みが残した風景です。' };
spot.researchSources = [book, town, wax];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
if (!registry.sources.some(x => x.id === book.id)) registry.sources.push({ id: book.id, type: 'book', title: '建設経済レポート : 日本経済と公共投資 (65)', author: '建設経済研究所', year: 2015, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I13580405', fullText: book.url, access: 'ログインなしで閲覧可能／インターネット公開（許諾）', fullTextSearchFrames: [1], notes: '第1章の内子町事例（印刷148ページ）で1970年代の保存運動、1982年の重伝建選定、上芳我邸資料館等と住民主体のまちづくりを確認。出版者公開同版PDF https://www.rice.or.jp/wp-content/uploads/2021/07/NO65.pdf でも本文照合。', usedFor: [spot.ja] });
for (const item of [
  { ...town, type: 'official', publisher: '愛媛県内子町', notes: '木蝋の歴史、町並み・せだわ、住民保存活動と1982年選定。', usedFor: [spot.ja] },
  { ...wax, type: 'official', publisher: '愛媛県内子町', notes: '製蝋業者の住宅・釜場・倉庫と資料館。', usedFor: [spot.ja] },
]) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
