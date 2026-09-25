/* Two Tohoku places and one Kanto garden: public NDL guides and official histories. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const source = (id, title, url) => ({ id, title, url });
const tohoku = source('ndl-tohoku-guide-1929', '鉄道省『日本案内記 東北篇』（1929年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/1176351');
const kanto = source('ndl-kanto-guide-1930', '鉄道省『日本案内記 関東篇』（1930年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/1176338');
const edits = [
  ['龍泉洞', tohoku,
    '1929年の『日本案内記』は、岩泉にいくつもの石灰洞があり、水が大量に湧く洞窟や、まだ探検されていない洞窟もあると記しています。現在「龍泉洞」と呼ばれる洞窟の魅力は、地下水がつくった地底湖と、長い時間をかけてできた石灰岩の空間です。地底湖が観光客に公開されるようになったのは案内書の刊行後で、現在の第1～第3地底湖は1968年に一般公開されました。昔の本の「未探検」という言葉から、洞窟を知る過程もまた歴史の一部だったと分かります。',
    [source('official-ryusendo-history', '龍泉洞の探検と観光の歩み（岩泉町広報）', 'https://www.town.iwaizumi.lg.jp/docs/2025080100028/file_contents/No967_hp_mihiraki.pdf'), source('official-iwate-nature', '岩手県の自然（岩手県）', 'https://www.pref.iwate.jp/kensei/profile/1000652.html')]],
  ['秋田市立赤れんが郷土館', tohoku,
    '1929年の『日本案内記』は、秋田市大町三丁目に秋田銀行があると記しています。その本店として1912年に完成した赤れんがの建物が、現在の秋田市立赤れんが郷土館の中心です。銀行の窓口だった空間は、今では秋田の歴史や美術工芸を紹介する場所になっています。1981年に銀行から市へ寄贈され、建物は国の重要文化財にも指定されました。外観のれんがと内部の装飾を見比べると、近代の銀行が町の中でどんな存在感を持っていたか想像できます。',
    [source('official-akita-redbrick', '赤れんが郷土館について（秋田市）', 'https://www.city.akita.lg.jp/kanko/kanrenshisetsu/1003617/1009785/1002315.html')]],
  ['三溪園', kanto,
    '1930年の『日本案内記』は、横浜・本牧の名所として三溪園を挙げています。庭園をつくった原三溪は生糸貿易で事業を広げた実業家で、1906年に外苑を一般に開きました。園内に立つ古い建物は、この場所に昔からあったものばかりではありません。京都や鎌倉などから移され、池や丘との関係を考えて配置されました。建物を一棟ずつ見るとともに、三重塔が遠くの丘に見えるような景色のつくり方にも注目してみましょう。',
    [source('official-sankeien-history', '三溪園の歴史（三溪園保勝会）', 'https://www.sankeien.or.jp/learn/history/'), source('official-yokohama-sankeien', '三溪園の歴史的風致（横浜市）', 'https://www.city.yokohama.lg.jp/kurashi/machizukuri-kankyo/toshiseibi/design/ikasu/keikaku.files/rekimachi03.pdf')]],
];
const target = path.join(root, 'data/regional-landmarks-v1.json');
const doc = JSON.parse(fs.readFileSync(target, 'utf8'));
for (const [name, book, summary, official] of edits) {
  const spot = doc.landmarks.find(item => item.ja === name);
  if (!spot) throw Error(`Missing ${name}`);
  spot.summaries = { ...spot.summaries, ja: summary };
  spot.researchSources = [book, ...official];
  spot.reviewedOn = '2026-09-25';
}
fs.writeFileSync(target, JSON.stringify(doc, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
for (const [id, frames, note, names] of [
  ['ndl-tohoku-guide-1929', [128, 177], ' 128コマに岩泉の複数の石灰洞と未探検の洞窟、177コマに大町三丁目の秋田銀行を確認。', ['龍泉洞', '秋田市立赤れんが郷土館']],
  ['ndl-kanto-guide-1930', [138], ' 138コマに本牧の三溪園が横浜の名所として掲載される。', ['三溪園']],
]) {
  const rec = registry.sources.find(item => item.id === id);
  if (!rec) throw Error(`Missing ${id}`);
  rec.fullTextSearchFrames = [...new Set([...rec.fullTextSearchFrames, ...frames])].sort((a, b) => a - b);
  rec.notes += note;
  rec.usedFor = [...new Set([...rec.usedFor, ...names])];
}
const notes = {
  'official-ryusendo-history': ['龍泉洞の探検と観光の歩み', '岩泉町', '地底湖公開の年代と探検史。'],
  'official-iwate-nature': ['岩手県の自然', '岩手県', '龍泉洞の地下水と地底湖。'],
  'official-akita-redbrick': ['赤れんが郷土館について', '秋田市', '1912年竣工、1981年寄贈、文化財指定と現在の利用。'],
  'official-sankeien-history': ['三溪園の歴史', '三溪園保勝会', '原三溪の経歴、1906年開園と古建築移築。'],
  'official-yokohama-sankeien': ['三溪園の歴史的風致', '横浜市', '庭園内の移築建造物と景観。'],
};
for (const [name, , , official] of edits) for (const ref of official) {
  if (registry.sources.some(item => item.id === ref.id)) continue;
  const [title, publisher, note] = notes[ref.id];
  registry.sources.push({ id: ref.id, type: 'official', title, publisher, url: ref.url, notes: note, usedFor: [name] });
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_whole, key, contents) => `"${key}": [${JSON.parse(`[${contents}]`).map(item => JSON.stringify(item)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
