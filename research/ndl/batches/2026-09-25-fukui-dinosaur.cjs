/* Public NDL journal article (not a book) and current museum pages checked. A public book remains to be read. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const paper = { id: 'ndl-fukui-third-excavation-2008', title: '柴田正輝・後藤道治「福井県勝山市における第三次恐竜化石発掘調査報告」（2008年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/3501310' };
const excavation = { id: 'official-fukui-dinosaur-excavation', title: '福井県の恐竜発掘（福井県立恐竜博物館）', url: 'https://www.dinosaur.pref.fukui.jp/dino/excavation/' };
const exhibit = { id: 'official-fukui-dinosaur-exhibit', title: '常設展示（福井県立恐竜博物館）', url: 'https://www.dinosaur.pref.fukui.jp/museum/exhibit.html' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '福井県立恐竜博物館');
if (!spot) throw Error('福井県立恐竜博物館 not found');
spot.summaries = { ...spot.summaries, ja: '福井県立恐竜博物館は、化石の産地・勝山市にある、恐竜と地球の歴史を学べる博物館です。近くの北谷では、1988年に肉食恐竜の歯が見つかって以来、発掘が続いています。公開されている2008年の発掘報告には、地層の中で新たな化石の層を見つけ、長い首をもつ竜脚類の脚の骨や小型の肉食恐竜の骨を採集した経緯が記されています。恐竜だけでなく、貝や植物、カメなどの化石も出るため、当時の生き物が暮らす環境まで想像できます。館内では全身骨格を見上げたあと、福井産の実物化石や岩石、化石に付いた岩を取り除く作業を見比べると、一つの骨から昔の世界を読み解く研究の道筋が分かります。' };
spot.researchSources = [paper, excavation, exhibit];
spot.researchStatus = 'public-report-and-official; public-book-pending';
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const entries = [
  { id: paper.id, type: 'journal-article', title: '福井県勝山市における第三次恐竜化石発掘調査報告（2007年度）', author: '柴田正輝・後藤道治', year: 2008, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I3501310', fullText: 'https://dl.ndl.go.jp/pid/3501310', access: 'インターネット公開・全文PDFを閲覧可能', notes: '福井県立恐竜博物館紀要7号109–116頁。1988年の肉食恐竜の歯、1989年以降の発掘、2007年に見つかった新しい骨化石含有層と竜脚類・獣脚類、周辺の貝・植物・カメ類化石を本文で確認。図書ではなく論文。', usedFor: [spot.ja] },
  { ...excavation, type: 'official', publisher: '福井県立恐竜博物館', notes: '北谷の継続的な発掘と発見史。', usedFor: [spot.ja] },
  { ...exhibit, type: 'official', publisher: '福井県立恐竜博物館', notes: '現在の展示ゾーン、全身骨格、福井産化石と化石クリーニング室。', usedFor: [spot.ja] },
];
for (const item of entries) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
