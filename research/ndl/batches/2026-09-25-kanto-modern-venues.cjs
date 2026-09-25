/* Two modern venues: public 1930 landscape/industry context plus official history. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const source = (id, title, url) => ({ id, title, url });
const book = source('ndl-kanto-guide-1930', '鉄道省『日本案内記 関東篇』（1930年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/1176338');
const edits = [
  ['鉄道博物館 (さいたま市)',
    '1930年の『日本案内記』は、大宮を鉄道の要地として紹介し、大宮鉄道工場では客車・貨車の製造や修理が行われていたと記しています。その大宮に2007年に開いた鉄道博物館は、実物車両を中心に日本の鉄道の歩みを伝える施設です。蒸気機関車から新幹線までを並べて見ると、速さや形だけでなく、働く人や移動する人の暮らしの変化も見えてきます。博物館の建物は戦前の工場そのものではありませんが、鉄道の町として続く大宮の歴史の上にあります。',
    [source('official-railway-museum-about', '当館について（鉄道博物館）', 'https://www.railway-museum.jp/about/')]],
  ['河口湖音楽と森の美術館',
    '1930年の『日本案内記』は、富士山北麓の河口湖を、船津から長浜へ船で渡れる湖として紹介しています。湖畔は昔から富士山を望む旅の場所でした。現在の河口湖音楽と森の美術館は、その景色の中でオルゴールや自動演奏楽器の音を楽しめる施設です。1999年に旧「河口湖オルゴールの森美術館」として開館し、2020年に今の名称になりました。湖と富士山という古くからの名所に、近年の音楽文化が重なった場所として歩いてみましょう。',
    [source('official-music-forest', '河口湖音楽と森の美術館（公式サイト）', 'https://kawaguchikomusicforest.jp/'), source('official-music-forest-renaming', '芸術家支援プロジェクト（河口湖音楽と森の美術館）', 'https://kawaguchikomusicforest.jp/art/'), source('official-music-forest-25', '開館25周年記念（河口湖音楽と森の美術館）', 'https://kawaguchikomusicforest.jp/news/25th-anniversary-event/')]],
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
if (!rec) throw Error('Missing book');
rec.fullTextSearchFrames = [...new Set([...rec.fullTextSearchFrames, 209, 233])].sort((a, b) => a - b);
rec.notes += ' 233コマに大宮鉄道工場の車両製造・修理、209コマに河口湖の湖上交通を確認。現代の博物館施設については公式資料を用いる。';
rec.usedFor = [...new Set([...rec.usedFor, ...edits.map(item => item[0])])];
const notes = {
  'official-railway-museum-about': ['当館について', '鉄道博物館', '2007年開館、実物車両と産業史の展示。'],
  'official-music-forest': ['河口湖音楽と森の美術館', '河口湖音楽と森の美術館', '現在のオルゴール・自動演奏楽器と庭園。'],
  'official-music-forest-renaming': ['芸術家支援プロジェクト', '河口湖音楽と森の美術館', '2020年の施設名変更。'],
  'official-music-forest-25': ['開館25周年記念', '河口湖音楽と森の美術館', '1999年の開館時期。'],
};
for (const [name, , official] of edits) for (const ref of official) {
  if (registry.sources.some(item => item.id === ref.id)) continue;
  const [title, publisher, note] = notes[ref.id];
  registry.sources.push({ id: ref.id, type: 'official', title, publisher, url: ref.url, notes: note, usedFor: [name] });
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_whole, key, contents) => `"${key}": [${JSON.parse(`[${contents}]`).map(item => JSON.stringify(item)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
