/* NDL public book read in Chrome: Niigata historic sites (1938), frame 35. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-niigata-historic-sites-1938', title: '新潟県史蹟名勝天然記念物調査会編『新潟県史蹟名勝天然記念物』（1938年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/1263506' };
const city = { id: 'official-tokamachi-kiyotsukyo', title: '清津峡（十日町市）', url: 'https://www.city.tokamachi.lg.jp/soshiki/nakasatoshisho/chiikishinkoka/1/gyomu/1450421453063.html' };
const tourism = { id: 'official-tokamachi-tourism-kiyotsukyo', title: '清津峡／Tunnel of Light（十日町市観光協会）', url: 'https://www.tokamachishikankou.jp/spot/kiyotsukyo/' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '清津峡');
if (!spot) throw Error('清津峡 not found');
spot.summaries = { ...spot.summaries, ja: '清津峡は、新潟県十日町市で清津川が深く刻んだV字形の峡谷です。1938年の『新潟県史蹟名勝天然記念物』は、川を挟む岩壁に柱のような割れ目が並ぶ「柱状節理」と、岩の間を流れる清津川の景色を写真とともに紹介しています。この岩の形は、熱い岩石が冷えるときに縮んでできた割れ目です。現在は国の名勝・天然記念物。渓谷トンネルの見晴所から岩壁を近くで観察でき、終点の水鏡には峡谷が映ります。トンネルは2018年に「Tunnel of Light」として改修され、自然の景観と現代アートを一緒に楽しめます。' };
spot.researchSources = [book, city, tourism];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
if (!registry.sources.some(x => x.id === book.id)) registry.sources.push({ id: book.id, type: 'book', title: '新潟県史蹟名勝天然記念物', author: '新潟県史蹟名勝天然記念物調査会編', year: 1938, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I1263506', fullText: book.url, access: 'ログインなしで閲覧可能／インターネット公開（保護期間満了）', fullTextSearchFrames: [35], notes: '35コマの「清津峽」は写真と本文で清津川、柱状節理の岩壁、V字形の景観を紹介。現在の文化財指定と2018年改修は十日町市・観光協会で確認。', usedFor: [spot.ja] });
for (const item of [
  { ...city, type: 'official', publisher: '十日町市', notes: '国名勝・天然記念物、柱状節理と渓谷トンネル。', usedFor: [spot.ja] },
  { ...tourism, type: 'official', publisher: '十日町市観光協会', notes: '2018年のTunnel of Light改修、パノラマステーションの水鏡。', usedFor: [spot.ja] },
]) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
