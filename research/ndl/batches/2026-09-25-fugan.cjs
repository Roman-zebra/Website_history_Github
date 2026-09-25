/* Toyama Chamber of Commerce's public 1940 book, frame 9, compared with current park and prefecture pages. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-toyama-1940-fugan', title: '富山商工会議所『とやま 昭和15年版』（1940年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/1100645/1/9' };
const park = { id: 'official-kansui-park-map', title: '公園案内とマップ（富山県富岩運河環水公園）', url: 'https://www.kansui-park.jp/how-to-enjoy-the-park/map/' };
const canal = { id: 'official-toyama-fugan-history', title: '富岩運河の建設と利用の歴史（富山県）', url: 'https://www.pref.toyama.jp/1541/kendodukuri/dourokouwan/toyamakou/kj00016047.html' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '富岩運河環水公園');
if (!spot) throw Error('富岩運河環水公園 not found');
spot.summaries = { ...spot.summaries, ja: '富岩運河環水公園は、富山駅の北側に広がる水辺の公園です。中央を流れる富岩運河は、昭和初期に市街地と東岩瀬の港を結ぶために造られました。1940年刊の富山商工会議所の本は、運河を交通と工業の発展を支える施設として紹介しています。かつて木材や石炭などを運んだ水路の起点が、今は散歩や舟遊びを楽しめる場所になりました。天門橋の展望塔から水辺を眺めたら、遊覧船が通る中島閘門にも注目してください。水位の違う区間を船が進むための、運河の仕組みを今も体験できます。' };
spot.researchSources = [book, park, canal];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const entries = [
  { id: book.id, type: 'book', title: 'とやま 昭和15年版', author: '富山商工会議所', year: 1940, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I1100645', fullText: 'https://dl.ndl.go.jp/pid/1100645', access: 'ログインなしで閲覧可能／インターネット公開（保護期間満了）', fullTextSearchFrames: [9], notes: '富岩運河の節（印刷8～9頁、9コマ）を画像で確認。市街地と東岩瀬港を結ぶ舟運、周辺工場・工業発展への期待についての当時の記述。現代の公園や運航状況には使用しない。', usedFor: [spot.ja] },
  { ...park, type: 'official', publisher: '富山県富岩運河環水公園', notes: '現在の公園施設、運河の産業輸送の歴史、天門橋と水上ライン・中島閘門。', usedFor: [spot.ja] },
  { ...canal, type: 'official', publisher: '富山県', notes: '運河の建設・利用史と富山市・東岩瀬港を結ぶ経緯。', usedFor: [spot.ja] },
];
for (const item of entries) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
