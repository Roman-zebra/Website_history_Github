/* NDL public book read in Chrome: Tottori Meisho (1911), frames 3-4. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-tottori-meisho-1911', title: '鳥取市『鳥取名所』（1911年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/766250' };
const prefecture = { id: 'official-tottori-jinpukaku', title: '仁風閣（鳥取県）', url: 'https://www.pref.tottori.lg.jp/304420.htm' };
const restoration = { id: 'official-tottori-city-jinpukaku-restoration', title: '仁風閣保存整備事業「令和の大修理」（鳥取市）', url: 'https://www.city.tottori.lg.jp/page/6226.html' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '仁風閣');
if (!spot) throw Error('仁風閣 not found');
spot.summaries = { ...spot.summaries, ja: '仁風閣は、鳥取城跡の麓に立つ白い木造洋館です。1907年、旧鳥取藩主池田家が皇太子（のちの大正天皇）の鳥取訪問に合わせて建てました。設計は赤坂離宮も手がけた片山東熊。完成から間もない1911年の鳥取市刊『鳥取名所』は、城の跡に建つ壮大な西洋風の建物として仁風閣を紹介しています。左右対称の外観と、背後の久松山や庭園を合わせて見ると、城下町から近代へ変わる景色がよくわかります。国の重要文化財で、2026年9月現在は保存修理のため館内休館中。敷地内の展示館では建物と鳥取城跡の歴史を紹介しています。' };
spot.researchSources = [book, prefecture, restoration];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
if (!registry.sources.some(x => x.id === book.id)) registry.sources.push({ id: book.id, type: 'book', title: '鳥取名所', author: '鳥取市', year: 1911, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I766250', fullText: book.url, access: 'ログインなしで閲覧可能／インターネット公開（保護期間満了）', fullTextSearchFrames: [3, 4], notes: '3～4コマの扇邸の項に、旧鳥取城の場所に建つ洋館・皇太子の宿舎・仁風閣の名を確認。現在の休館状況は鳥取市の2026年更新資料による。', usedFor: [spot.ja] });
for (const item of [
  { ...prefecture, type: 'official', publisher: '鳥取県', notes: '1907年の建立、片山東熊の設計、国重要文化財、長期休館と展示館。', usedFor: [spot.ja] },
  { ...restoration, type: 'official', publisher: '鳥取市', notes: '2026年9月時点の保存修理・館内休館。', usedFor: [spot.ja] },
]) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
