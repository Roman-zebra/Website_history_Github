/* Kashihara city history is public at NDL; volume and PDF pages checked against the city's edition. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-kashihara-history-upper', title: '改訂橿原市史編纂委員会『橿原市史 本編 上巻』（1987年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/11669939/1/7' };
const town = { id: 'official-kashihara-imai-town', title: '今井町（橿原市）', url: 'https://www.city.kashihara.nara.jp/kanko_bunka_sports/rekishi_bunkazai/1/15367.html' };
const moat = { id: 'official-kashihara-imai-moat', title: '今井西環濠広場（橿原市）', url: 'https://www.city.kashihara.nara.jp/kanko_bunka_sports/kanko/1/5/3/11537.html' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '今井町');
if (!spot) throw Error('今井町 not found');
spot.summaries = { ...spot.summaries, ja: '今井町は、奈良県橿原市に残る寺内町です。戦国時代に称念寺を中心として形づくられ、町の周囲には水路と防御を兼ねた環濠がめぐらされました。江戸時代には商業で栄え、今も瓦屋根の町家が並ぶ道を歩けます。公開されている『橿原市史』を読むと、町家の通り側には商いにも使う「ミセ」、奥には家族の生活の場があり、裏長屋では複数の家が井戸を共有していました。立派な商家だけでなく、働き暮らした人々もいた町です。道が曲がるところや、かつての濠の位置にも目を向けると、自治を守ってきた町の形が見えてきます。1993年に国の重要伝統的建造物群保存地区に選ばれました。' };
spot.researchSources = [book, town, moat];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
if (!registry.sources.some(x => x.id === book.id)) registry.sources.push({ id: book.id, type: 'book', title: '橿原市史 本編 上巻', author: '改訂橿原市史編纂委員会', year: 1987, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I11669939', fullText: 'https://dl.ndl.go.jp/pid/11669939', access: 'ログインなしで閲覧可能／インターネット公開（許諾）', fullTextSearchFrames: [7], notes: '第7ファイル「各説2」のPDF 80～87ページで町家のミセ・奥の間、裏長屋17軒と共同井戸、町並み保存の住民活動を確認。橿原市公開同版PDF https://www.city.kashihara.nara.jp/material/files/group/7/5c34c21af1a7f00f31b18fb6.pdf で本文照合。', usedFor: [spot.ja] });
for (const item of [
  { ...town, type: 'official', publisher: '橿原市', notes: '寺内町の成り立ち、江戸期の商業、現存町家と1993年の選定。', usedFor: [spot.ja] },
  { ...moat, type: 'official', publisher: '橿原市', notes: '環濠の時期と水利・防御の役割。', usedFor: [spot.ja] },
]) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
