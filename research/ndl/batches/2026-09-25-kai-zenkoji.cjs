/* NDL public full text checked in Chrome: Nippon Annaiki, Kanto, frame 217. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-kanto-guide-1930', title: '鉄道省『日本案内記 関東篇』（1930年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/1176338' };
const prefecture = { id: 'official-yamanashi-kai-zenkoji-hondo', title: '善光寺本堂（山梨県文化財ガイド）', url: 'https://www.pref.yamanashi.jp/bunka/bunkazaihogo/bunkazai_data/yamanashinobunkazai_kb0033.html' };
const city = { id: 'official-kofu-kai-zenkoji', title: '寺社・史跡（甲府市）', url: 'https://www.city.kofu.yamanashi.jp/kids/ima/bunka/jisha.html' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '甲斐善光寺');
if (!spot) throw Error('甲斐善光寺 not found');
spot.summaries = { ...spot.summaries, ja: '甲斐善光寺は、武田信玄が1558年に開いた甲府の寺です。戦国の争いから信濃の善光寺の仏像や宝物を守ろうと、甲府へ移したことが創建のきっかけと伝わります。1930年の『日本案内記』も、信州の善光寺にならって建てられ、本尊が一時移されたと紹介しています。ただし、目の前の本堂そのものが戦国時代の建物なのではありません。山梨県の文化財資料によると、現在の本堂は1796年の再建で、奥行きの深い大きな木造建築です。本堂と山門を見比べながら、戦国期の由来と江戸時代の建築が重なる場所として歩けます。' };
spot.researchSources = [book, prefecture, city];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const kanto = registry.sources.find(x => x.id === book.id);
if (!kanto) throw Error('Kanto book not found');
kanto.fullTextSearchFrames = [...new Set([...kanto.fullTextSearchFrames, 217])].sort((a, b) => a - b);
kanto.notes += ' 217コマに甲斐善光寺を信州善光寺に模した寺とし、本尊の一時移転を伝承として記載。';
kanto.usedFor = [...new Set([...kanto.usedFor, spot.ja])];
for (const item of [
  { ...prefecture, type: 'official', publisher: '山梨県', notes: '1558年創建の伝承、1796年再建の本堂と国重要文化財指定。', usedFor: [spot.ja] },
  { ...city, type: 'official', publisher: '甲府市', notes: '信玄が信州善光寺の仏像や宝物を甲府に移した創建事情。', usedFor: [spot.ja] },
]) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
