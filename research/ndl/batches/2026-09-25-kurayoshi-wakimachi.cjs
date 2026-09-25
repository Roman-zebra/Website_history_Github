/* Two historic commercial districts in the public Chugoku/Shikoku guide. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const source = (id, title, url) => ({ id, title, url });
const book = source('ndl-chugoku-shikoku-guide-1934', '鉄道省『日本案内記 中国・四国篇』（1934年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/1176396');
const edits = [
  ['倉吉市打吹玉川伝統的建造物群保存地区',
    '1934年の『日本案内記』は、倉吉を鳥取県中部の中心地として紹介し、打吹山の北麓と周辺の町を案内しています。現在の保存地区は、玉川沿いの白壁の土蔵と、本町通りに続く商家が見どころです。江戸時代には打吹山の麓に陣屋が置かれ、商いも盛んになりました。赤い瓦と白い漆喰の景色は、見た目の美しさだけでなく、蔵に品物を納め、川と道を使って町が営まれた歴史を伝えます。地図では打吹山、通り、玉川の位置を重ねてみましょう。',
    [source('official-kurayoshi-district', '倉吉市打吹玉川伝統的建造物群保存地区（倉吉市）', 'https://www.city.kurayoshi.lg.jp/5172.htm'), source('official-kurayoshi-overview', '倉吉市の概要（倉吉市）', 'https://www.city.kurayoshi.lg.jp/5450.htm')]],
  ['脇町南町',
    '1934年の『日本案内記』は、吉野川沿いの脇町付近に製糸工場があったと記します。町が発展した土台には、それ以前から続く阿波藍の商いもありました。川舟が荷を運ぶ脇町の南町通りには、富を蓄えた商家が並び、二階の壁から張り出す「うだつ」が特徴です。うだつは火が隣家に広がるのを抑える造りでもあり、商家の存在感も示しました。現在は重要伝統的建造物群保存地区として守られています。通りを歩くときは、家の屋根際と吉野川への距離に注目してみましょう。',
    [source('official-wakimachi-streetscape', 'うだつの町並み（美馬市）', 'https://www.city.mima.lg.jp/kanko/map/list/11506.html'), source('official-wakimachi-indigo', '吉野川、藍、うだつ（美馬市）', 'https://www.city.mima.lg.jp/kanko/map/list/11486.html'), source('official-wakimachi-district', '美馬市脇町南町重要伝統的建造物群保存地区（美馬市）', 'https://www.city.mima.lg.jp/kanko/kana/map/list/4048.html')]],
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
rec.fullTextSearchFrames = [...new Set([...rec.fullTextSearchFrames, 46, 194])].sort((a, b) => a - b);
rec.notes += ' 194コマに鳥取県中部の倉吉町と打吹公園、46コマに吉野川沿いの脇町の製糸工場を確認。保存地区の成立や藍商の歴史は自治体資料で補う。';
rec.usedFor = [...new Set([...rec.usedFor, ...edits.map(item => item[0])])];
const notes = {
  'official-kurayoshi-district': ['倉吉市打吹玉川伝統的建造物群保存地区', '倉吉市', '本町通りの商家と玉川沿いの土蔵。'],
  'official-kurayoshi-overview': ['倉吉市の概要', '倉吉市', '打吹山麓の陣屋、商工業都市、白壁土蔵群。'],
  'official-wakimachi-streetscape': ['うだつの町並み', '美馬市', '藍の集散地と通りの商家。'],
  'official-wakimachi-indigo': ['吉野川、藍、うだつ', '美馬市', '吉野川の水運と藍商人。'],
  'official-wakimachi-district': ['美馬市脇町南町重要伝統的建造物群保存地区', '美馬市', '保存地区の指定と範囲。'],
};
for (const [name, , official] of edits) for (const ref of official) {
  if (registry.sources.some(item => item.id === ref.id)) continue;
  const [title, publisher, note] = notes[ref.id];
  registry.sources.push({ id: ref.id, type: 'official', title, publisher, url: ref.url, notes: note, usedFor: [name] });
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_whole, key, contents) => `"${key}": [${JSON.parse(`[${contents}]`).map(item => JSON.stringify(item)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
