/* NDL public book read in Chrome: Okinawa Annai, frame 2. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-okinawa-annai-showa', title: '沖縄県商工課『沖縄案内』（昭和期・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/1122474' };
const village = { id: 'official-nakijin-castle-history', title: '今帰仁城跡・今帰仁城の歴史（今帰仁村）', url: 'https://www.nakijin.jp/pagtop/kakuka/somuka/3/3/5/2/564.html' };
const site = { id: 'official-nakijin-castle-site', title: '世界遺産 今帰仁城跡（公式サイト）', url: 'https://www.nakijinjoseki-osi.jp/' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '今帰仁城');
if (!spot) throw Error('今帰仁城 not found');
spot.summaries = { ...spot.summaries, ja: '今帰仁城跡は、沖縄本島北部の丘に築かれたグスク（城）です。昭和期の『沖縄案内』は「北山城址」の別名とともに、この城跡を名所として紹介しています。琉球が一つの王国にまとまる前、北部を治めた北山王の居城でした。北山が中山に併合された後も、王府から派遣された監守がここに置かれました。古い石灰岩を積み上げた長い城壁が丘の地形に沿って曲がり、城内からは海を望めます。現在も発掘調査で建物跡や交易を物語る品々が見つかっています。2000年に「琉球王国のグスク及び関連遺産群」の一つとして世界遺産に登録されました。' };
spot.researchSources = [book, village, site];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
if (!registry.sources.some(x => x.id === book.id)) registry.sources.push({ id: book.id, type: 'book', title: '沖縄案内', author: '沖縄県商工課', year: null, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I1122474', fullText: book.url, access: 'ログインなしで閲覧可能／インターネット公開（保護期間満了）', fullTextSearchFrames: [2], notes: '2コマの名所案内欄で「今歸仁城址（北山城址）」を今泊の丘上の名所として確認。出版年は書誌どおり昭和期・年不詳。城の政治的役割、調査成果、世界遺産登録は今帰仁村と現行公式サイトで確認。', usedFor: [spot.ja] });
for (const item of [
  { ...village, type: 'official', publisher: '今帰仁村', notes: '北山の歴史、監守の役割と発掘成果。', usedFor: [spot.ja] },
  { ...site, type: 'official', publisher: '今帰仁城跡公式サイト', notes: '北山城の別名、監守と2000年の世界遺産登録。', usedFor: [spot.ja] },
]) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
