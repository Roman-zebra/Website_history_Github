/* NDL public full text checked in Chrome: Nippon Annaiki, Kyushu, frames 27 and 158. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-kyushu-guide-1935', title: '鉄道省『日本案内記 九州篇』（1935年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/1176417' };
const garden = { id: 'official-glover-garden-about', title: 'グラバー園について（グラバー園）', url: 'https://glover-garden.jp/about/' };
const prefecture = { id: 'official-nagasaki-glover-house', title: '旧グラバー住宅（長崎県文化財データベース）', url: 'https://www.pref.nagasaki.jp/bunkadb/index.php/view/171' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === 'グラバー園');
if (!spot) throw Error('グラバー園 not found');
spot.summaries = { ...spot.summaries, ja: 'グラバー園は、長崎港を望む南山手で、開港後の外国人居留地の建物を歩いて見られる場所です。1935年の『日本案内記』は、大浦の南山手に外国人住宅の面影が残ると書いています。当時はまだ「グラバー園」はなく、長崎市が旧グラバー住宅を公開したのは1958年、ほかの洋館を集めて園を開いたのは1974年です。園内の旧グラバー住宅、旧リンガー住宅、旧オルト住宅はこの丘に建ち続けてきた建物で、別の場所から移した洋館もあります。旧グラバー住宅は1863年築の重要文化財で、世界遺産の構成資産でもあります。建物ごとに元の所在地を確かめ、港を見渡す眺めとともに居留地の暮らしを想像してみてください。' };
spot.researchSources = [book, garden, prefecture];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const kyushu = registry.sources.find(x => x.id === book.id);
if (!kyushu) throw Error('Kyushu book not found');
kyushu.fullTextSearchFrames = [...new Set([...kyushu.fullTextSearchFrames, 27, 158])].sort((a, b) => a - b);
kyushu.notes += ' 27コマの総説に大浦の南山手に残る外国人住宅の面影、158コマに南山手町の大浦天主堂を確認。1935年にはグラバー園は存在しないため、園の開設・建物構成は公式資料による。';
kyushu.usedFor = [...new Set([...kyushu.usedFor, spot.ja])];
for (const item of [
  { ...garden, type: 'official', publisher: 'グラバー園', notes: '1863年の住宅建築、1958年の公開、1974年の開園、現地に残る3棟と移築6棟、世界遺産構成資産。', usedFor: [spot.ja] },
  { ...prefecture, type: 'official', publisher: '長崎県', notes: '旧グラバー住宅の建築と文化財としての価値。', usedFor: [spot.ja] },
]) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
