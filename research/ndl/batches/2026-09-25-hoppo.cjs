/* Public NDL government book checked at frames 53–54; present building/history checked against museum pages. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-landlords-tenants-1909', title: '農商務省農務局『地主ト小作人』（1909年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/1172814/1/53' };
const history = { id: 'official-hoppo-history', title: '伊藤家の歴史（北方文化博物館）', url: 'https://hoppou-bunka.com/history/' };
const building = { id: 'official-hoppo-building', title: '建物のご案内（北方文化博物館）', url: 'https://hoppou-bunka.com/building/' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '北方文化博物館');
if (!spot) throw Error('北方文化博物館 not found');
spot.summaries = { ...spot.summaries, ja: '北方文化博物館は、新潟市沢海にある大地主・伊藤家の屋敷を公開する博物館です。明治期に約8年かけて建てられた屋敷では、帳場や茶の間で土地の経営にかかわる仕事が行われ、奥には庭園に面した大広間があります。1909年の農商務省の書籍『地主ト小作人』は、伊藤文吉が小作人の貯蓄奨励や農事改良に取り組み、肥料の共同購入などの仕組みを設けたと伝えています。立派な座敷とともに、この土地を耕した人々の暮らしも思い浮かべてみてください。戦後、農地改革を経て屋敷や所蔵品は博物館へ受け継がれました。' };
spot.researchSources = [book, history, building];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const entries = [
  { id: book.id, type: 'book', title: '地主ト小作人（農務彙纂 第5）', author: '農商務省農務局', year: 1909, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I1172814', fullText: 'https://dl.ndl.go.jp/pid/1172814', access: 'ログインなしで閲覧可能／インターネット公開（保護期間満了）', fullTextSearchFrames: [53, 54], notes: '「伊藤文吉氏ノ恒産會ト農事改良」83頁以降を画像で確認。小作人の貯蓄奨励、農事改良、肥料共同購入など。地主・小作関係の当時の行政資料であり、屋敷の現況には使用しない。', usedFor: [spot.ja] },
  { ...history, type: 'official', publisher: '北方文化博物館', notes: '伊藤家の歩み、明治期の屋敷建築、戦後の農地改革と博物館設立。', usedFor: [spot.ja] },
  { ...building, type: 'official', publisher: '北方文化博物館', notes: '帳場・茶の間・大広間と庭園の位置づけ。', usedFor: [spot.ja] },
];
for (const item of entries) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
