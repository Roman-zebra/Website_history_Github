/* 1923 contemporary photograph album checked in public NDL scans, frames 2, 9 and 11. Current site facts checked against Meiji-mura. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-imperial-hotel-1923', title: '高梨由太郎編『帝国ホテル』（1923年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/970774/1/9' };
const museum = { id: 'official-meijimura-about', title: '明治村とは？（博物館明治村）', url: 'https://www.meijimura.com/about/' };
const building = { id: 'official-meijimura-imperial-hotel', title: '帝国ホテル中央玄関（博物館明治村）', url: 'https://www.meijimura.com/sight/%E5%B8%9D%E5%9B%BD%E3%83%9B%E3%83%86%E3%83%AB%E4%B8%AD%E5%A4%AE%E7%8E%84%E9%96%A2/' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '博物館明治村');
if (!spot) throw Error('博物館明治村 not found');
spot.summaries = { ...spot.summaries, ja: '博物館明治村は、取り壊されそうになった歴史的な建物を移して残す、愛知県犬山市の野外博物館です。1965年に開村し、保存・復原した建物は60を超えます。木造の伝統を受け継ぎながら西洋の技術や材料を取り入れた、近代化の時代の工夫を建物そのもので見られます。なかでも帝国ホテル中央玄関は、建築家フランク・ロイド・ライトが設計し、1923年に完成した旧ホテルの一部。同年刊の写真集『帝国ホテル』を見ると、東京にあったころは客室棟まで広がる大きな建物だったことが分かります。明治村に残るのはその中央玄関部分です。大谷石の彫刻やレンガの模様、床と天井の高さが次々に変わる室内を歩き、当時の新しい建築を体感してみてください。' };
spot.researchSources = [book, museum, building];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const entries = [
  { id: book.id, type: 'book', title: '帝国ホテル', author: '高梨由太郎 編', year: 1923, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I970774', fullText: 'https://dl.ndl.go.jp/pid/970774', access: 'ログインなしで閲覧可能／インターネット公開（保護期間満了）', fullTextSearchFrames: [2, 9, 11], notes: '1923年刊の写真集。2コマの序文には新館工事と旧本館焼失の経緯、9・11コマには当時の建物の写真がある。明治村への移築や現在の保存範囲の根拠には用いない。', usedFor: [spot.ja] },
  { ...museum, type: 'official', publisher: '博物館明治村', notes: '1965年開村、60超の移築・復原建造物と保存目的。', usedFor: [spot.ja] },
  { ...building, type: 'official', publisher: '博物館明治村', notes: 'ライト設計、1923年竣工、旧所在地、移築範囲、材料と空間の特徴。', usedFor: [spot.ja] },
];
for (const item of entries) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
