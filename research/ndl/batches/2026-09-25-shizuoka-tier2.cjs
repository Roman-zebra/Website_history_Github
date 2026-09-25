/* Two Shizuoka places documented in the public 1930 Kanto guide. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const source = (id, title, url) => ({ id, title, url });
const book = source('ndl-kanto-guide-1930', '鉄道省『日本案内記 関東篇』（1930年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/1176338');
const edits = [
  ['韮山反射炉',
    '1930年の『日本案内記』は、韮山の反射炉跡を幕末の江川英龍に結びつけ、江川邸などと一緒に巡る場所として案内しています。反射炉は高温で鉄を溶かし、西洋式の大砲を鋳造するための施設です。英龍が建設を進めましたが、完成は彼の死後の1857年でした。実際に稼働した反射炉が残る国内唯一の例として、現在は世界遺産の構成資産になっています。煙突のような二つの塔を見るだけでなく、炉と大砲づくりの関係を想像してみましょう。',
    [source('official-nirayama-furnace', '韮山反射炉とは（伊豆の国市）', 'https://www.city.izunokuni.shizuoka.jp/bunka_bunkazai/manabi/bunkazai/hansyaro/documents/hansyarotoha.html'), source('official-nirayama-heritage', '韮山反射炉（伊豆の国市）', 'https://www.city.izunokuni.shizuoka.jp/bunka_bunkazai/manabi/bunkazai/hansyaro/')]],
  ['久能山東照宮',
    '1930年の『日本案内記』は、海に向いた山麓から曲がりくねった道を上り、久能山東照宮に参る道筋を記しています。社には徳川家康がまつられ、1616年に亡くなった家康の墓所もあります。色鮮やかな社殿は江戸初期の建築で、国宝に指定されています。建物の装飾だけでなく、駿河湾を見下ろす山の地形にも注目してください。山上の社殿と海へ開けた眺めを合わせて見ると、家康が久能山を墓所に選んだ歴史が身近になります。',
    [source('official-kunozan-about', '久能山東照宮について（久能山東照宮）', 'https://www.toshogu.or.jp/about/'), source('official-kunozan-ieyasu', '徳川家康公について（久能山東照宮）', 'https://www.toshogu.or.jp/about/ieyasu.php'), source('official-shizuoka-bay', '駿河湾の文化（静岡県）', 'https://www.pref.shizuoka.jp/machizukuri/kowan/1040846/1025743.html')]],
];
const target = path.join(root, 'data/regional-landmarks-v1.json');
const doc = JSON.parse(fs.readFileSync(target, 'utf8'));
for (const [name, summary, official] of edits) {
  const spot = doc.landmarks.find(item => item.ja === name);
  if (!spot) throw Error(`Missing ${name}`);
  spot.summaries = { ...spot.summaries, ja: summary };
  spot.researchSources = [book, ...official];
  spot.reviewedOn = '2026-09-25';
}
fs.writeFileSync(target, JSON.stringify(doc, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const rec = registry.sources.find(item => item.id === book.id);
if (!rec) throw Error('Missing Kanto book');
rec.fullTextSearchFrames = [...new Set([...rec.fullTextSearchFrames, 43, 44, 54, 181, 194, 195])].sort((a, b) => a - b);
rec.notes += ' 43～44・181コマに江川英龍と韮山反射炉跡、54・194～195コマに久能山東照宮への参道と社殿を確認。反射炉の完成年は現行資料に従う。';
rec.usedFor = [...new Set([...rec.usedFor, ...edits.map(item => item[0])])];
const notes = {
  'official-nirayama-furnace': ['韮山反射炉とは', '伊豆の国市', '英龍の計画、1857年完成、稼働した反射炉の現存例。'],
  'official-nirayama-heritage': ['韮山反射炉', '伊豆の国市', '世界遺産構成資産としての位置づけ。'],
  'official-kunozan-about': ['久能山東照宮について', '久能山東照宮', '家康をまつる神社と国宝の社殿。'],
  'official-kunozan-ieyasu': ['徳川家康公について', '久能山東照宮', '1616年の家康の死去。'],
  'official-shizuoka-bay': ['駿河湾の文化', '静岡県', '家康の墓所と駿河湾への眺望。'],
};
for (const [name, , official] of edits) for (const ref of official) {
  if (registry.sources.some(item => item.id === ref.id)) continue;
  const [title, publisher, note] = notes[ref.id];
  registry.sources.push({ id: ref.id, type: 'official', title, publisher, url: ref.url, notes: note, usedFor: [name] });
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_whole, key, contents) => `"${key}": [${JSON.parse(`[${contents}]`).map(item => JSON.stringify(item)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
