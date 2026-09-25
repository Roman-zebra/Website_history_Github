/* Public NDL texts checked in Chrome: Kiso reprint frames 152, 179-180;
   Kawagoe Annai frames 62-64. The 1916 reprint contains an 1805 work. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const source = (id, title, url) => ({ id, title, url });
const kiso = source('ndl-kiso-meisho-1916', '『大日本地誌大系 第12冊』（『木曽路名所図会』所収、1916年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/1879477');
const kawagoe = source('ndl-kawagoe-guide-1908', '伊藤栄一編『川越案内』（1908年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/763764');
const edits = [
  ['奈良井宿', '奈良井宿は、江戸と京都を結んだ中山道の宿場町です。江戸後期の『木曽路名所図会』は、奈良井と鳥居峠を続く道の名所として記しています。峠を越える旅人を迎えた町は奈良井川沿いに長く伸び、宿場の仕事とともに檜物や塗櫛づくりでも栄えました。今も約1キロにわたり、出梁造りの家や格子、軒先の意匠が続きます。1978年に国の重要伝統的建造物群保存地区に選ばれ、住民が暮らしながら建物を守ってきました。通りに残る水場や屋号にも目を向けると、旅の道と生活の場が重なっていたことがわかります。', kiso,
    [source('official-narai-preservation', '塩尻市奈良井重要伝統的建造物群保存地区', 'https://www.city.shiojiri.lg.jp/soshiki/36/3735.html'), source('official-narai-road', '中山道（4）（塩尻市）', 'https://www.city.shiojiri.lg.jp/soshiki/35/3949.html')]],
  ['馬籠宿', '馬籠宿は、中山道の急な坂に沿って家々が並ぶ宿場町です。江戸後期の『木曽路名所図会』は「馬籠駅」を挙げ、集落が山中に広がる様子を記しています。今歩く石畳と家並みからも、平らな町ではない旅の道が実感できます。ここは小説『夜明け前』を書いた島崎藤村の生まれた地でもあり、本陣跡には藤村記念館があります。もとの本陣や宿場の大半は1895年の火災で失われたため、見えている町並みをすべて江戸時代の建物と考えるのではなく、焼失後も守り継がれた街道の形と暮らしを見て歩く場所です。', kiso,
    [source('official-magome-town', '馬籠宿（中津川市）', 'https://www.city.nakatsugawa.lg.jp/kanko/miru/1/3760.html'), source('official-magome-history', '神坂地区の観光情報（中津川市）', 'https://www.city.nakatsugawa.lg.jp/soshikikarasagasu/misaka/kanko/1319.html')]],
  ['川越城', '川越城は、江戸の北を守る重要な城として使われた場所です。1908年刊の『川越案内』には「川越城墟」が名所旧跡として独立した項目で載り、明治の人々も城の跡を訪ねていたことがわかります。現在見られる本丸御殿は1848年に建てられたものの一部で、明治以降に多くが取り壊されたあと、玄関と大広間などが残りました。幅の広い玄関と畳敷きの大広間は、石垣や天守とは違う、藩主が人を迎え政務を行った城の姿を伝えます。そばの家老詰所は別の場所に移されていた建物を復元移築したものです。', kawagoe,
    [source('official-kawagoe-honmaru', '県指定有形文化財 川越城本丸御殿及び家老詰所（川越市）', 'https://www.city.kawagoe.saitama.jp/kurashi/bunka/1003787/1003798/1003828/1003829/1003836.html'), source('official-kawagoe-castle-history', '川越城本丸御殿（川越市）', 'https://www.city.kawagoe.saitama.jp/1014520/c0000/1014698/c2005.html')]],
];
const target = path.join(root, 'data/regional-landmarks-v1.json');
const doc = JSON.parse(fs.readFileSync(target, 'utf8'));
for (const [name, summary, book, official] of edits) {
  const spot = doc.landmarks.find(item => item.ja === name);
  if (!spot) throw Error(`Missing ${name}`);
  spot.summaries = { ...spot.summaries, ja: summary };
  spot.researchSources = [book, ...official];
  spot.reviewedOn = '2026-09-25';
}
fs.writeFileSync(target, JSON.stringify(doc, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const books = [
  { id: kiso.id, type: 'book', title: '大日本地誌大系 第12冊（木曽路名所図会所収）', author: '大日本地誌大系刊行会 編・日本歴史地理学会 校訂（原著・秋里籬島）', year: 1916, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I1879477', fullText: kiso.url, access: 'ログインなしで閲覧可能／インターネット公開（保護期間満了）', fullTextSearchFrames: [152, 179, 180], notes: '152コマに馬籠駅の山中の集落、179〜180コマに鳥居峠と奈良井駅の記述を公開本文画像と全文検索で確認。収録元の『木曽路名所図会』は1805年刊。現存建物・保存状況は自治体資料で補う。', usedFor: ['奈良井宿', '馬籠宿'] },
  { id: kawagoe.id, type: 'book', title: '川越案内', author: '伊藤栄一 編', year: 1908, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I763764', fullText: kawagoe.url, access: 'ログインなしで閲覧可能／インターネット公開（裁定）', fullTextSearchFrames: [62, 63, 64], notes: '「名所旧蹟」中の「川越城墟」（42〜46頁、62〜64コマ）を公開本文画像で確認。現存本丸御殿の範囲・年代は川越市文化財資料で確認。', usedFor: ['川越城'] },
];
for (const book of books) if (!registry.sources.some(s => s.id === book.id)) registry.sources.push(book);
const notes = {
  'official-narai-preservation': ['塩尻市奈良井重要伝統的建造物群保存地区', '塩尻市', '奈良井川沿いの宿場と町並み保存。'],
  'official-narai-road': ['中山道（4）', '塩尻市', '鳥居峠、建築細部、檜物と塗櫛。'],
  'official-magome-town': ['馬籠宿', '中津川市', '坂の宿場町、藤村記念館。'],
  'official-magome-history': ['神坂地区の観光情報', '中津川市', '1895年の大火、本陣と宿場の焼失。'],
  'official-kawagoe-honmaru': ['県指定有形文化財 川越城本丸御殿及び家老詰所', '川越市', '1848年築、現存部分、家老詰所の移築復元。'],
  'official-kawagoe-castle-history': ['川越城本丸御殿', '川越市', '江戸の北の守りと城の位置づけ。'],
};
for (const [name, , , official] of edits) for (const ref of official) {
  const existing = registry.sources.find(s => s.id === ref.id);
  if (existing) { existing.usedFor = [...new Set([...(existing.usedFor || []), name])]; continue; }
  const [title, publisher, note] = notes[ref.id];
  registry.sources.push({ id: ref.id, type: 'official', title, publisher, url: ref.url, notes: note, usedFor: [name] });
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
