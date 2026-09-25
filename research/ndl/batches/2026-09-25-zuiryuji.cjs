/* NDL public book read in Chrome: Takaoka Kaibyaku Yuraiki (1934), frame 8. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-takaoka-origin-1934', title: '高岡文化会編『高岡開闢由来記・高岡町由緒聞書』（1934年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/1212507' };
const city = { id: 'official-takaoka-zuiryuji', title: '高岡山瑞龍寺（高岡市）', url: 'https://www.city.takaoka.toyama.jp/gyosei/kanko_bunka_sports/rekishi_bunkazai/9/3/5928.html' };
const road = { id: 'official-takaoka-hatchomichi', title: '高岡市歴史的風致維持向上計画・第2章（高岡市）', url: 'https://www.city.takaoka.toyama.jp/material/files/group/42/rekimachi_2.pdf' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '瑞龍寺 (高岡市)');
if (!spot) throw Error('瑞龍寺 not found');
spot.summaries = { ...spot.summaries, ja: '瑞龍寺は、高岡の町を開いた前田利長を弔うため、後を継いだ利常が大きく整えた禅寺です。1934年刊の『高岡開闢由来記・高岡町由緒聞書』には、利長の墓所と寺を結ぶ道を「八丁道」と呼ぶ記述もあります。現在もこの道を歩けば、寺と墓所を一つの計画として見ることができます。境内では総門、山門、仏殿、法堂が一直線に並び、左右の回廊が空間を囲みます。高岡市によると、仏殿と法堂は17世紀半ば、山門は火災後の1818年の再建で、仏殿・法堂・山門は国宝です。入口から奥へ進みながら、時代の異なる建物が整った禅寺の姿をつくっていることを確かめてみてください。' };
spot.researchSources = [book, city, road];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
if (!registry.sources.some(x => x.id === book.id)) registry.sources.push({ id: book.id, type: 'book', title: '高岡開闢由来記・高岡町由緒聞書 : 附・高岡町旧家覚', author: '高岡文化会 編', year: 1934, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I1212507', fullText: book.url, access: 'ログインなしで閲覧可能／インターネット公開（保護期間満了）', fullTextSearchFrames: [8], notes: '8コマの「第八 高岡山瑞龍寺の事」に利常による利長追善の寺、同コマに寺と利長墓所を結ぶ八丁道を確認。中国の寺を調べた人物に関する原文は編者が注記で修正しているため採用しない。', usedFor: [spot.ja] });
for (const item of [
  { ...city, type: 'official', publisher: '高岡市', notes: '寺の沿革、山門の1818年再建、仏殿・法堂・山門の国宝指定と回廊の配置。', usedFor: [spot.ja] },
  { ...road, type: 'official', publisher: '高岡市', notes: '瑞龍寺と前田利長墓所を結ぶ八丁道。', usedFor: [spot.ja] },
]) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
