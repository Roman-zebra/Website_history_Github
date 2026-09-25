/* Park history and remains pages reproduce parts of an archaeological book. The complete 2020 report is cataloged online but was not read. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const history = { id: 'official-yoshinogari-history', title: '吉野ヶ里の歴史（吉野ヶ里歴史公園）', url: 'https://www.yoshinogari.jp/introduction/history/' };
const remains = { id: 'official-yoshinogari-remains', title: '吉野ヶ里遺跡とは（吉野ヶ里歴史公園）', url: 'https://www.yoshinogari.jp/introduction/remains/' };
const catalog = { id: 'ndl-yoshinogari-report-2020-catalog', title: '『吉野ヶ里遺跡』（2020年・国立国会図書館サーチ書誌）', url: 'https://ndlsearch.ndl.go.jp/books/R000000025-I011440004546094' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '吉野ヶ里遺跡');
if (!spot) throw Error('吉野ヶ里遺跡 not found');
spot.summaries = { ...spot.summaries, ja: '吉野ヶ里遺跡は、佐賀平野の丘に残る弥生時代の大きな集落跡です。発掘された建物や墓、集落を囲む深い溝の跡から、およそ700年の間に小さなムラが大きな「クニ」の中心へ変わっていく様子をたどれます。溝は「環壕」と呼ばれ、周囲を守る役割があったと考えられます。中期には有力者を葬った大きな墓が造られ、後期には北内郭や南内郭という特別な区画、大型建物や高床倉庫が現れました。現在の公園に立つ建物は、発掘成果などをもとに弥生時代後期の姿を推定して復元したものです。復元建物を眺めるだけでなく、北墳丘墓で実際の遺構を見ると、分かったことと復元した部分の違いを感じられます。' };
spot.researchSources = [history, remains, catalog];
spot.researchStatus = 'official-with-book-excerpts; full-public-book-pending';
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const entries = [
  { ...history, type: 'official', publisher: '吉野ヶ里歴史公園', notes: '時期ごとの集落の拡大、環壕・墓・北内郭・南内郭、公園での復元方針。ページは佐賀県教育委員会編『弥生時代の吉野ヶ里』の内容を一部転載。', usedFor: [spot.ja] },
  { ...remains, type: 'official', publisher: '吉野ヶ里歴史公園', notes: '発掘史と特別史跡の説明。佐賀県教育委員会の刊行物からの一部転載を含む。', usedFor: [spot.ja] },
  { id: catalog.id, type: 'book-catalog-only', title: '吉野ヶ里遺跡（佐賀県文化財調査報告書227）', author: '佐賀県文化課文化財保護室 編', year: 2020, ndlSearch: catalog.url, fullText: 'https://sitereports.nabunken.go.jp/71578', access: 'インターネット公開と書誌に記載。本文PDFは今回未確認', notes: '書誌情報のみ確認。本文PDFの内容を説明文の根拠としていない。', usedFor: [spot.ja] },
];
for (const item of entries) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => '"' + key + '": [' + JSON.parse('[' + content + ']').map(x => JSON.stringify(x)).join(', ') + ']');
fs.writeFileSync(registryTarget, compact + '\n');
