/* 1941 Tsuruoka local reader checked in public NDL scan at frame 63; current museum facts checked against official pages. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-tsuruoka-local-reader-1941', title: '鶴岡市教育会編『郷土読本』（1941年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/1055554/1/63' };
const museum = { id: 'official-kamo-about', title: 'かもすいとは（鶴岡市立加茂水族館）', url: 'https://kamo-kurage.jp/kamosui/' };
const renewed = { id: 'official-kamo-renewal-2026', title: '2026年のリニューアル（鶴岡市立加茂水族館）', url: 'https://kamo-kurage.jp/?p=21093' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '鶴岡市立加茂水族館');
if (!spot) throw Error('鶴岡市立加茂水族館 not found');
spot.summaries = { ...spot.summaries, ja: '鶴岡市立加茂水族館は、クラゲの展示と研究で知られる、庄内の海辺の水族館です。始まりは1930年、地元の人々がお金を出し合って建てた「山形県水族館」。1941年の公開書籍『郷土読本』にも、加茂の磯や出漁する船とともに水族館が登場します。1990年代には来館者が減り存続が危ぶまれましたが、水槽に偶然現れた小さなクラゲをきっかけに、飼育と展示を深めました。現在は約100種類を展示し、2026年に増設した研究所では繁殖や生態の研究も進めています。大きな水槽で漂う姿を見た後、顕微鏡で小さなクラゲを観察すると、その多様さがよく分かります。' };
spot.researchSources = [book, museum, renewed];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const entries = [
  { id: book.id, type: 'book', title: '郷土読本', author: '鶴岡市教育会 編', year: 1941, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I1055554', fullText: 'https://dl.ndl.go.jp/pid/1055554', access: 'ログインなしで閲覧可能／インターネット公開（保護期間満了）', fullTextSearchFrames: [63], notes: '「郷土巡り」113～114頁の加茂の磯、漁船、水族館に言及する韻文を画像で確認。1930年の創立や現在の展示数・設備の根拠には用いない。', usedFor: [spot.ja] },
  { ...museum, type: 'official', publisher: '鶴岡市立加茂水族館', notes: '1930年の地域出資による開館、1997年の存続危機とクラゲ展示への転換、現在の約100種類展示と研究所。', usedFor: [spot.ja] },
  { ...renewed, type: 'official', publisher: '鶴岡市立加茂水族館', notes: '2026年4月の研究所棟増設、マイクロアクアリウムと顕微鏡・ルーペによる小型クラゲの観察。', usedFor: [spot.ja] },
];
for (const item of entries) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
