/* NDL public book read in Chrome: Wada, Natadera-shi (1897), frames 7, 8, 15, 22. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-natadera-history-1897', title: '和田文次郎編『那谷寺誌』（1897年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/819693' };
const city = { id: 'official-komatsu-natadera', title: '那谷寺（小松市）', url: 'https://www.city.komatsu.lg.jp/kanko_bunka/kanko/2/6608.html' };
const temple = { id: 'official-natadera-history', title: '那谷寺の歴史（那谷寺）', url: 'https://www.natadera.com/shiru_rekishi/' };
const prefecture = { id: 'official-ishikawa-natadera-landscape', title: 'おくのほそ道の風景地（石川県）', url: 'https://www.pref.ishikawa.lg.jp/kyoiku/bunkazai/siseki/2-8.html' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '那谷寺');
if (!spot) throw Error('那谷寺 not found');
spot.summaries = { ...spot.summaries, ja: '那谷寺は、岩山と森の中に堂宇が点在する小松の寺です。1897年の『那谷寺誌』は、泰澄が養老年間に開いたという伝承に加え、奇岩や怪石の景色、江戸初期に前田利常が荒れた堂塔の跡を見たことを記しています。寺と小松市の資料によると、利常は1640年から本堂や三重塔などを再建しました。目を引く「奇岩遊仙境」は、穴の開いた岩壁と木々、岩に寄り添う本堂を一緒に眺められる場所です。芭蕉もこの寺を訪れ、「石山の石より白し秋の風」と詠みました。建物だけを追うより、岩の形と堂の位置を見比べると、自然を信仰の場としてきた歴史が伝わります。' };
spot.researchSources = [book, city, temple, prefecture];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
if (!registry.sources.some(x => x.id === book.id)) registry.sources.push({ id: book.id, type: 'book', title: '那谷寺誌', author: '和田文次郎 編', year: 1897, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I819693', fullText: book.url, access: 'ログインなしで閲覧可能／インターネット公開（保護期間満了）', fullTextSearchFrames: [7, 8, 15, 22], notes: '7・15コマに泰澄による開基・本尊安置の伝承、8コマに前田利常と寛永17年、22コマに奇巖怪石を確認。1897年刊行の寺誌に記された伝承と現存建物の年代は区別する。', usedFor: [spot.ja] });
for (const item of [
  { ...city, type: 'official', publisher: '小松市', notes: '創建伝承、前田利常の再建、芭蕉の句。', usedFor: [spot.ja] },
  { ...temple, type: 'official', publisher: '那谷寺', notes: '1640年からの堂宇再建と白山信仰、奇岩遊仙境。', usedFor: [spot.ja] },
  { ...prefecture, type: 'official', publisher: '石川県', notes: '奇石・洞穴・木々・本堂が組み合わさった名勝景観。', usedFor: [spot.ja] },
]) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
