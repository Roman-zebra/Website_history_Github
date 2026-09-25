/* NDL public full text checked in Chrome: Meiji Kogyoshi vol. 5, frame 386. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-meiji-kogyoshi-architecture-1927', title: '日本工学会編『明治工業史 〔第5〕』（1927年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/1836175' };
const facility = { id: 'official-tochigi-tamozawa-facility', title: '施設のご案内（日光田母沢御用邸記念公園）', url: 'https://www.park-tochigi.com/tamozawa/facility' };
const faq = { id: 'official-tochigi-tamozawa-faq', title: 'よくあるご質問（日光田母沢御用邸記念公園）', url: 'https://www.park-tochigi.com/tamozawa/faq' };
const prefecture = { id: 'official-tochigi-tamozawa-history', title: '日光田母沢御用邸記念公園の開園（栃木県）', url: 'https://www.pref.tochigi.lg.jp/c05/kensei/aramashi/rekishi/bakumatsu-kingendai_08.html' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '日光田母沢御用邸記念公園');
if (!spot) throw Error('日光田母沢御用邸記念公園 not found');
spot.summaries = { ...spot.summaries, ja: '日光田母沢御用邸記念公園は、1899年に皇太子嘉仁親王（のちの大正天皇）の静養のため造られた旧御用邸です。1927年の『明治工業史』は、地元にあった別邸に旧紀州徳川家の江戸屋敷から移した建物を組み合わせ、増改築した経緯を記しています。現在の邸宅には江戸・明治・大正の建築が重なり、106室が廊下でつながっています。部屋の役割や庭への眺めを比べて歩くと、皇室の滞在を支えた空間の広さがわかります。御用邸は1947年に廃止され、修復後の2000年に公園として公開されました。建物は国の重要文化財です。' };
spot.researchSources = [book, facility, faq, prefecture];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
if (!registry.sources.some(x => x.id === book.id)) registry.sources.push({ id: book.id, type: 'book', title: '明治工業史 〔第5〕', author: '日本工学会編', year: 1927, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I1836175', fullText: book.url, access: 'ログインなしで閲覧可能／インターネット公開（保護期間満了）', fullTextSearchFrames: [386], notes: '386コマの「日光田母沢御用邸」に、地元の別邸と旧紀州徳川家邸宅の一部を移築・増改築した経緯を確認。現存部屋数、文化財指定、公開年は現行の公式資料で確認。', usedFor: [spot.ja] });
for (const item of [
  { ...facility, type: 'official', publisher: '日光田母沢御用邸記念公園', notes: '1899年完成、建物の由来と江戸・明治・大正の構成。', usedFor: [spot.ja] },
  { ...faq, type: 'official', publisher: '日光田母沢御用邸記念公園', notes: '106室、国重要文化財。', usedFor: [spot.ja] },
  { ...prefecture, type: 'official', publisher: '栃木県', notes: '修復後の2000年開園。', usedFor: [spot.ja] },
]) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
