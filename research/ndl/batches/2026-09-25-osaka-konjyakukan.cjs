/* Public NDL local-history chapter checked at frame 37; current exhibits checked against museum pages. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-osaka-local-history-reader', title: '魚澄惣五郎『大阪郷土史読本 訂正版』（1943年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/1055542/1/37' };
const edo = { id: 'official-osaka-konjyakukan-edo', title: 'なにわ町家の歳時記（大阪くらしの今昔館）', url: 'https://www.osaka-angenet.jp/konjyakukan/exhibition/9f' };
const modern = { id: 'official-osaka-konjyakukan-modern', title: 'モダン大阪パノラマ遊覧（大阪くらしの今昔館）', url: 'https://www.osaka-angenet.jp/konjyakukan/exhibition/8f' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '大阪くらしの今昔館');
if (!spot) throw Error('大阪くらしの今昔館 not found');
spot.summaries = { ...spot.summaries, ja: '大阪くらしの今昔館は、建物や暮らしの道具から大阪の歴史をたどる博物館です。9階には、1830年代の大坂を想定した架空の町「大坂町三丁目」が実物大で再現されています。通り沿いの呉服屋や本屋をのぞき、路地へ入ると、共同の井戸を使う裏長屋の暮らしも見えてきます。公開書籍『大阪郷土史読本』が描く、川や運河を使った物資の行き来で栄えた商都の姿を、店先と生活の場の両方から想像できる展示です。8階では模型を通して明治から昭和の住まいの変化を紹介。町並みを歩いた後で、どんな仕事や家族がその家にいたか考えると、歴史が身近になります。' };
spot.researchSources = [book, edo, modern];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const entries = [
  { id: book.id, type: 'book', title: '大阪郷土史読本 訂正版', author: '魚澄惣五郎', year: 1943, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I1055542', fullText: 'https://dl.ndl.go.jp/pid/1055542', access: 'ログインなしで閲覧可能／インターネット公開（保護期間満了）', fullTextSearchFrames: [37], notes: '第16章「大阪の繁昌」印刷59～60頁、37コマを画像で確認。川・運河を使う物資輸送と大阪の商業発展についての記述。展示の内容・年次には使用しない。', usedFor: [spot.ja] },
  { ...edo, type: 'official', publisher: '大阪くらしの今昔館', notes: '1830年代を想定した架空の大坂町三丁目、町通りの商家、路地・裏長屋・共同井戸。', usedFor: [spot.ja] },
  { ...modern, type: 'official', publisher: '大阪くらしの今昔館', notes: '8階の明治・大正・昭和の模型展示。', usedFor: [spot.ja] },
];
for (const item of entries) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
