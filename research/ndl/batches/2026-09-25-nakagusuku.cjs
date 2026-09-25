/* NDL public book read in Chrome: Okinawa Shashincho vol. 2 (1925), frame 23. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-okinawa-photo-book-2-1925', title: '坂口総一郎『沖縄写真帖 第2輯』（1925年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/12899967' };
const village = { id: 'official-nakagusuku-castle', title: '世界遺産 中城城跡（中城村）', url: 'https://www.vill.nakagusuku.okinawa.jp/kanko/nakagusukujoato/' };
const heritage = { id: 'official-nakagusuku-castle-heritage', title: '沖縄の世界遺産 中城城跡（中城城跡公式サイト）', url: 'https://www.nakagusuku-jo.jp/heritage' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '中城城');
if (!spot) throw Error('中城城 not found');
spot.summaries = { ...spot.summaries, ja: '中城城跡は、沖縄本島中部の高台に石垣が連なるグスク（城）です。1925年の『沖縄写真帖 第2輯』は、石垣の写真を添えて、護佐丸ゆかりの城として紹介しています。現在の調査では、城の始まりは護佐丸より前にさかのぼり、護佐丸が15世紀に北の郭と三の郭を増築したと考えられています。郭とは石垣で囲んだ城の区画で、中城城には六つあります。曲線を描く石垣と門をたどると、丘の地形を生かした造りが見えてきます。琉球王国のグスク及び関連遺産群の一つとして、2000年に世界遺産に登録されました。' };
spot.researchSources = [book, village, heritage];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
if (!registry.sources.some(x => x.id === book.id)) registry.sources.push({ id: book.id, type: 'book', title: '沖縄写真帖 第2輯', author: '坂口総一郎', year: 1925, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I12899967', fullText: book.url, access: 'ログインなしで閲覧可能／インターネット公開（保護期間満了）', fullTextSearchFrames: [23], notes: '23コマの「中城城址」に石垣の写真と護佐丸ゆかりの説明を確認。築城時期・郭数は中城村の現行解説に基づく。', usedFor: [spot.ja] });
for (const item of [
  { ...village, type: 'official', publisher: '中城村', notes: '先中城按司による築城、護佐丸の増築、六つの郭。', usedFor: [spot.ja] },
  { ...heritage, type: 'official', publisher: '中城城跡公式サイト', notes: '2000年の世界遺産登録。', usedFor: [spot.ja] },
]) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
