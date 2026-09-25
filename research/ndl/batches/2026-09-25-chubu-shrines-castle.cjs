/* Three Chubu places with public local books and current official sources. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const source = (id, title, url) => ({ id, title, url });
const zenkoji = source('ndl-zenkoji-guide-1918', '倉島元弥編『善光寺案内記』（1918年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/910279');
const eiheiji = source('ndl-eiheiji-shinkei-1939', '永平寺編『永平寺真景 2版』（1939年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/1095050');
const nagoya = source('ndl-nagoya-guide-1925', '長尾盛之助『名古屋案内』（1925年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/905365');
const edits = [
  ['善光寺', zenkoji,
    '1918年の『善光寺案内記』は、山門から本堂へ進みながら境内を紹介しています。善光寺は特定の宗派に属さず、さまざまな人の参拝を受け入れてきた寺です。現在の本堂は1707年の再建で、国宝に指定されています。山門は1750年に建てられました。参道を歩くと、門前の店や院坊の並ぶ町と境内が続いていることが分かります。本堂だけを目的地にせず、町から山門、本堂へと進む道筋をたどってみましょう。',
    [source('official-zenkoji-about', '善光寺の紹介（善光寺）', 'https://www.zenkoji.jp/about/'), source('official-zenkoji-hondo', '善光寺本堂（善光寺）', 'https://www.zenkoji.jp/about/hondou/'), source('official-zenkoji-buildings', '善光寺の主要施設（善光寺）', 'https://www.zenkoji.jp/about/syuyou/')]],
  ['永平寺', eiheiji,
    '1939年に永平寺自身が編んだ『永平寺真景』は、山門を七堂伽藍の一つとして紹介し、山門から仏殿へ進む境内の構成を伝えています。永平寺は道元が1244年に開いた曹洞宗の修行道場です。山深い谷に多くの建物が連なりますが、その中心には座禅や食事など、日々の修行に使われる七堂伽藍があります。観光地としての景色だけでなく、建物どうしのつながりに目を向けると、ここが今も修行の場であることが分かります。',
    [source('official-eiheiji-town-guide', '大本山永平寺（永平寺町）', 'https://www.town.eiheiji.lg.jp/200/300/311/p000773_d/fil/eiheijicho.pdf'), source('official-eiheiji-seven-halls', '永平寺の七堂伽藍（永平寺町広報）', 'https://www.town.eiheiji.lg.jp/420/430/p003271_d/fil/2018-03-kouhou.pdf')]],
  ['犬山城', nagoya,
    '1925年の『名古屋案内』は、犬山城を名古屋の北にある犬山町の見どころとして紹介し、尾張藩の重臣・成瀬家の旧居城と記しています。城は木曽川沿いの小高い丘にあり、天守から川と濃尾平野を見渡せます。成瀬家は1617年から長く城を守り、現存する天守は国宝です。ただし天守がいつ完成したかには諸説があり、一つの年に決めつけられません。川を望む立地と、戦国から江戸へ城主が変わった歴史を合わせて見てみましょう。',
    [source('official-inuyama-castle', '犬山城の見学案内（犬山市）', 'https://www.city.inuyama.aichi.jp/kurashi/bunka/1001052/1003738/1012507.html'), source('official-inuyama-castle-research', '犬山城天守の文化的価値（犬山市）', 'https://www.city.inuyama.aichi.jp/_res/projects/default_project/_page_/001/012/164/hozonkatuyou.pdf')]],
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
for (const rec of [
  { id: 'ndl-zenkoji-guide-1918', type: 'book', title: '善光寺案内記', author: '倉島元弥 編', publisher: '仏都新報社', year: 1918, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I910279', fullText: zenkoji.url, access: 'ログインなしで閲覧可能／インターネット公開（保護期間満了）', fullTextSearchFrames: [3, 10, 13, 14, 43, 44], notes: '10コマに山門から本堂へ向かう案内、3コマに山門・仁王門などの境内構成。古い信仰伝承は史実と区別。', usedFor: ['善光寺'] },
  { id: 'ndl-eiheiji-shinkei-1939', type: 'book', title: '永平寺真景 2版', author: '永平寺 編', publisher: '永平寺', year: 1939, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I1095050', fullText: eiheiji.url, access: 'ログインなしで閲覧可能／インターネット公開（保護期間満了）', fullTextSearchFrames: [16, 17, 18, 19], notes: '16～19コマに山門が七堂伽藍の一つで、仏殿へつながる構成を確認。OCRに欠落が多いため、それ以上の具体的な歴史叙述は公式資料で補う。', usedFor: ['永平寺'] },
]) if (!registry.sources.some(item => item.id === rec.id)) registry.sources.push(rec);
const nagoyaRec = registry.sources.find(item => item.id === nagoya.id);
if (!nagoyaRec) throw Error('Missing Nagoya guide');
nagoyaRec.fullTextSearchFrames = [...new Set([...nagoyaRec.fullTextSearchFrames, 76])].sort((a, b) => a - b);
nagoyaRec.notes += ' 76コマの犬山城の項に名古屋北方の立地と成瀬家の旧居城を確認。';
nagoyaRec.usedFor = [...new Set([...nagoyaRec.usedFor, '犬山城'])];
const notes = {
  'official-zenkoji-about': ['善光寺の紹介', '善光寺', '無宗派の寺としての運営、1707年の再建。'],
  'official-zenkoji-hondo': ['善光寺本堂', '善光寺', '1707年再建と国宝指定。'],
  'official-zenkoji-buildings': ['善光寺の主要施設', '善光寺', '1750年の山門と境内の建物。'],
  'official-eiheiji-town-guide': ['大本山永平寺', '永平寺町', '1244年の開山と現役の修行道場。'],
  'official-eiheiji-seven-halls': ['永平寺の七堂伽藍', '永平寺町', '修行に使う七堂伽藍の構成。'],
  'official-inuyama-castle': ['犬山城の見学案内', '犬山市', '1617年以降の成瀬家、現存天守と眺望。'],
  'official-inuyama-castle-research': ['犬山城天守の文化的価値', '犬山市', '天守の建立年代が断定できないこと。'],
};
for (const [name, , , official] of edits) for (const ref of official) {
  if (registry.sources.some(item => item.id === ref.id)) continue;
  const [title, publisher, note] = notes[ref.id];
  registry.sources.push({ id: ref.id, type: 'official', title, publisher, url: ref.url, notes: note, usedFor: [name] });
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_whole, key, contents) => `"${key}": [${JSON.parse(`[${contents}]`).map(item => JSON.stringify(item)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
