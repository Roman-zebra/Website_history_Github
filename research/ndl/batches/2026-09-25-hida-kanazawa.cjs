/* Public NDL books checked in Chrome: Hida no Takayama frame 13;
   Kanazawa Shigai Hitori Annai frames 15-17 and 59-60. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const source = (id, title, url) => ({ id, title, url });
const hida = source('ndl-hida-takayama-1912', '奥田正造編『飛騨之高山』（1912年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/947777');
const kanazawa = source('ndl-kanazawa-city-guide-1894', '雲田平太郎『金沢市街独案内』（1894年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/764578');
const edits = [
  {
    file: 'data/regional-landmarks-v1.json', name: '高山陣屋', book: hida,
    summary: '高山陣屋は、江戸幕府が飛騨を直接治めたときの役所です。1912年の『飛騨之高山』にも、金森氏の支配が終わったあと「高山御役所」、または「高山陣屋」と呼ばれたと記されています。高山市の資料によると、幕府が飛騨を直轄地にしたのは1692年、役所を現在地に移したのは1695年。ここで代官・郡代が税や治安などを扱いました。現存する御役所の建物は1816年のもので、幕末を経て明治以降も地方官庁として使われました。座敷や御白洲、米を納めた蔵を巡ると、町の観光名所である前に長く行政の中心だったことがわかります。',
    official: [source('official-takayama-jinya-history', '高山陣屋跡（高山市）', 'https://www.city.takayama.lg.jp/kurashi/1000021/1000119/1000847/1000954/1000956.html')],
  },
  {
    file: 'data/regional-landmarks-v1.json', name: 'ひがし茶屋街', book: kanazawa,
    summary: '浅野川の東側にあるひがし茶屋街は、1820年に公認されて形づくられた茶屋町です。明治27年の『金沢市街独案内』は、ここを「東廓」と呼び、当時の金沢の遊廓の一つとして紹介しています。華やかな芸能やもてなしとともに、そうした歴史もあった場所です。現在は木虫籠と呼ばれる細い出格子や、二階の座敷を持つ茶屋建築が続き、国の重要伝統的建造物群保存地区として守られています。表通りの格子だけでなく、脇道の奥行きにも目を向けると、江戸後期から続く町の造りが見えてきます。',
    official: [source('official-kanazawa-higashi-plan', '東山ひがし伝統的建造物群保存地区保存計画（金沢市）', 'https://digilib.city.kanazawa.ishikawa.jp/preview/pdf/DDOtoQAAA'), source('official-kanazawa-higashi-guide', '東山周辺観光案内（金沢市）', 'https://digilib.city.kanazawa.ishikawa.jp/preview/pdf/Br_-JAAAA')],
  },
  {
    file: 'data/landmarks.json', name: '兼六園', book: kanazawa,
    summary: '兼六園は、金沢城に隣接する加賀藩前田家ゆかりの庭園です。明治27年の『金沢市街独案内』は、園内を一つの眺めで終わらせず、池、橋、碑、茶店などを次々に案内しています。歩く場所によって景色が変わる「回遊式」の楽しみ方は、当時の旅行者にも伝えられていました。石川県によると、13代藩主の前田斉泰が霞ヶ池を広げ、1860年ごろに庭園の形を整えました。1874年には市民へ全面開放されています。池の周りを歩きながら、城の庭が人々の散策の場になっていった歴史を感じられます。',
    official: [source('official-kenrokuen-history', '兼六園の歴史（石川県）', 'https://shiro-niwa.pref.ishikawa.lg.jp/kenrokuen-garden/history.html'), source('official-kenrokuen-design', '兼六園（石川県文化財）', 'https://www.pref.ishikawa.lg.jp/kyoiku/bunkazai/siseki/2-1.html')],
  },
];
for (const file of [...new Set(edits.map(e => e.file))]) {
  const target = path.join(root, file);
  const doc = JSON.parse(fs.readFileSync(target, 'utf8'));
  for (const edit of edits.filter(e => e.file === file)) {
    const spot = doc.landmarks.find(item => item.ja === edit.name);
    if (!spot) throw Error(`Missing ${edit.name}`);
    spot.summaries = { ...spot.summaries, ja: edit.summary };
    spot.researchSources = [edit.book, ...edit.official];
    spot.reviewedOn = '2026-09-25';
  }
  fs.writeFileSync(target, JSON.stringify(doc, null, file === 'data/landmarks.json' ? 0 : 2) + '\n');
}
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const books = [
  { id: hida.id, type: 'book', title: '飛騨之高山', author: '奥田正造 編', year: 1912, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I947777', fullText: hida.url, access: 'ログインなしで閲覧可能／インターネット公開（保護期間満了）', fullTextSearchFrames: [13], notes: '13コマで金森氏の転封後に幕府が高山御役所（高山陣屋）を置いた記述を本文画像と全文検索で確認。現在残る建物の年代は高山市資料で確認。', usedFor: ['高山陣屋'] },
  { id: kanazawa.id, type: 'book', title: '金沢市街独案内', author: '雲田平太郎', year: 1894, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I764578', fullText: kanazawa.url, access: 'ログインなしで閲覧可能／インターネット公開（保護期間満了）', fullTextSearchFrames: [15, 16, 17, 59, 60], notes: '15〜17コマに兼六園の池・橋・碑や茶店の案内、59コマに東廓を金沢三遊廓の一つとする説明、60コマに東廓の街並み挿絵を本文画像で確認。1894年当時の呼称・性格であり、現在の業態を示すものではない。', usedFor: ['ひがし茶屋街', '兼六園'] },
];
for (const book of books) if (!registry.sources.some(s => s.id === book.id)) registry.sources.push(book);
const notes = {
  'official-takayama-jinya-history': ['高山陣屋跡', '高山市', '1692年の直轄地化、1695年の現在地移転、1816年の御役所と明治後の使用。'],
  'official-kanazawa-higashi-plan': ['東山ひがし伝統的建造物群保存地区保存計画', '金沢市', '1820年に公許された茶屋町、建物と町並みの保全。'],
  'official-kanazawa-higashi-guide': ['東山周辺観光案内', '金沢市', '木虫籠と茶屋建築の特徴。'],
  'official-kenrokuen-history': ['兼六園の歴史', '石川県', '斉泰による霞ヶ池拡張、1860年の整備、1874年の全面開放。'],
  'official-kenrokuen-design': ['兼六園', '石川県', '回遊式庭園と池、橋、茶亭等の構成。'],
};
for (const edit of edits) for (const ref of edit.official) {
  const existing = registry.sources.find(s => s.id === ref.id);
  if (existing) { existing.usedFor = [...new Set([...(existing.usedFor || []), edit.name])]; continue; }
  const [title, publisher, note] = notes[ref.id];
  registry.sources.push({ id: ref.id, type: 'official', title, publisher, url: ref.url, notes: note, usedFor: [edit.name] });
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
