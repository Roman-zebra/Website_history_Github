/* NDL public book read in Chrome: Hyogo prefectural historic sites (1933), frame 73. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-hyogo-historic-sites-1933', title: '兵庫県編『史蹟名勝と天然紀念物』（1933年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/1146026' };
const history = { id: 'official-asago-takeda-history', title: '竹田城の歴史（朝来市）', url: 'https://www.city.asago.hyogo.jp/site/takeda/3092.html' };
const museum = { id: 'official-hyogo-museum-takeda', title: '但馬竹田城（兵庫県立歴史博物館）', url: 'https://rekihaku.pref.hyogo.lg.jp/castle/takeda/' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '竹田城');
if (!spot) throw Error('竹田城 not found');
spot.summaries = { ...spot.summaries, ja: '竹田城跡は、兵庫県朝来市の山頂に石垣が広がる城跡です。1933年に兵庫県が刊行した『史蹟名勝と天然紀念物』にも「竹田城址」の項があり、山上の城として記されています。始まりは15世紀に山名氏が家臣の太田垣氏に築かせたという伝承ですが、現在見える大きな石垣は、16世紀末の城主・赤松広秀の時代に整えられたと考えられています。1600年に廃城となり、建物は残っていません。石垣の配置を追いながら尾根を歩くと、かつての城の広がりと谷を見渡す位置がわかります。雲海に浮かぶ姿から「天空の城」とも呼ばれます。' };
spot.researchSources = [book, history, museum];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
if (!registry.sources.some(x => x.id === book.id)) registry.sources.push({ id: book.id, type: 'book', title: '史蹟名勝と天然紀念物', author: '兵庫県編', year: 1933, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I1146026', fullText: book.url, access: 'ログインなしで閲覧可能／インターネット公開（保護期間満了）', fullTextSearchFrames: [73], notes: '73コマの「竹田城址」に山上の城跡、太田垣氏・赤松氏の歴史を確認。築城年代は伝承、現存石垣の年代は現行の朝来市・兵庫県立歴史博物館資料による。', usedFor: [spot.ja] });
for (const item of [
  { ...history, type: 'official', publisher: '朝来市', notes: '築城伝承、赤松広秀期の石垣、1600年廃城。', usedFor: [spot.ja] },
  { ...museum, type: 'official', publisher: '兵庫県立歴史博物館', notes: '太田垣氏の旧城から赤松広秀期の石垣造りの山城への変化。', usedFor: [spot.ja] },
]) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
