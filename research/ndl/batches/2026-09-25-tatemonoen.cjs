/* Korekiyo Takahashi autobiography checked in the public NDL scan at frame 326; relocated buildings checked against museum pages. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-takahashi-autobiography-1936', title: '『高橋是清自伝』（1936年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/1207485/1/326' };
const center = { id: 'official-tatemonoen-center', title: 'センターゾーンの復元建造物（江戸東京たてもの園）', url: 'https://www.tatemonoen.jp/restore/intro/center.php' };
const east = { id: 'official-tatemonoen-east', title: '東ゾーンの復元建造物（江戸東京たてもの園）', url: 'https://www.tatemonoen.jp/restore/intro/east.php' };
const overview = { id: 'official-tatemonoen-overview', title: '概要・沿革（江戸東京たてもの園）', url: 'https://www.tatemonoen.jp/about/overview.php' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '江戸東京たてもの園');
if (!spot) throw Error('江戸東京たてもの園 not found');
spot.summaries = { ...spot.summaries, ja: '江戸東京たてもの園は、東京各地から歴史的な建物を移し、町並みや暮らしを体感できる野外博物館です。中央にある高橋是清邸は、1902年に赤坂に建てられた住まいの主屋部分。公開書籍『高橋是清自伝』には、赤坂の新宅がほぼ完成し、同じ敷地内の古い家から移った時のことが記されています。2階は是清の書斎・寝室で、1936年の二・二六事件の現場にもなりました。東側へ歩けば、醤油店、居酒屋、銭湯などが並びます。政治家の家から下町の店先まで、建物の形だけでなく、そこで働き暮らした人の一日を想像してみてください。' };
spot.researchSources = [book, center, east, overview];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const entries = [
  { id: book.id, type: 'book', title: '高橋是清自伝', author: '高橋是清', year: 1936, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I1207485', fullText: 'https://dl.ndl.go.jp/pid/1207485', access: 'ログインなしで閲覧可能／インターネット公開（保護期間満了）', fullTextSearchFrames: [326], notes: '326コマの「赤坂表町に新築中の新宅」「ほぼ落成」「邸内の旧家から」などの回想を画像で確認。現存する移築建物の範囲や二・二六事件は園の公式資料で確認。', usedFor: [spot.ja] },
  { ...center, type: 'official', publisher: '江戸東京たてもの園', notes: '高橋是清邸の1902年建築、移築された主屋部分、2階の書斎・寝室と二・二六事件。', usedFor: [spot.ja] },
  { ...east, type: 'official', publisher: '江戸東京たてもの園', notes: '東ゾーンの醤油店、居酒屋、銭湯など。', usedFor: [spot.ja] },
  { ...overview, type: 'official', publisher: '江戸東京たてもの園', notes: '建物の移築・保存と生活情景の復元という園の目的。', usedFor: [spot.ja] },
];
for (const item of entries) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
