/* NDL-cataloged public book, Nikko City 2013 upper volume, pp. 37, 63, 68, inspected in the scanned PDF. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-ashio-comprehensive-report-2013', title: '日光市教育委員会『足尾銅山跡総合調査報告書 上巻』（2013年）', url: 'https://www.city.nikko.lg.jp/material/files/group/42/reportojoukan.pdf' };
const history = { id: 'official-nikko-ashio-history', title: '足尾銅山の歴史（日光市）', url: 'https://www.city.nikko.lg.jp/soshiki/10/1041/2_1/1229.html' };
const heritage = { id: 'official-ashio-cultural-property', title: '足尾銅山跡（国指定文化財等データベース）', url: 'https://kunishitei.bunka.go.jp/heritage/detail/401/00003567' };
const target = path.join(root, 'data/liminal.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.places.find(x => x.ja === '足尾銅山');
if (!spot) throw Error('足尾銅山 not found');
spot.hook_ja = '銅を掘った坑道と、鉱害への対策を伝える施設が残る山。';
spot.hooks = { ...spot.hooks, ja: spot.hook_ja };
spot.why_ja = 'かつては全国有数の銅山でした。坑道や製錬所の跡だけでなく、煙害と川の汚染にどう向き合ったかを示す遺構が残り、産業の発展が土地と暮らしに残した影響を考えさせます。';
spot.summaries = { ...spot.summaries, ja: '足尾銅山は、栃木県日光市足尾にある日本有数の銅山跡です。明治時代に古河市兵衛が経営を始め、豊かな鉱脈の発見と坑道・製錬・輸送の近代化によって生産を大きく伸ばしました。日光市の公開書籍『足尾銅山跡総合調査報告書』は、その技術の変化とともに、鉱石を処理する排水や製錬の煙が渡良瀬川流域の農地と周囲の山々に被害を及ぼし、予防工事や調査が重ねられた経緯を詳しく記しています。田中正造らが被害を訴えた足尾鉱毒事件は、近代化の別の側面を示す出来事です。採鉱は1973年に終わりましたが、通洞坑や本山製錬所跡などが残ります。建物や煙突を見るときは、銅を生み出した設備と、被害を抑えるための設備の両方に目を向けてみてください。' };
spot.researchSources = [book, history, heritage];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const entries = [
  { id: book.id, type: 'book', title: '足尾銅山跡総合調査報告書 上巻', author: '日光市教育委員会事務局文化財課 編', year: 2013, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000002-I024736663', fullText: book.url, access: '日光市が全文PDFを公開。NDLサーチでは図書として登録', notes: '本文画像の37頁で生産拡大と通洞坑・新技術、63頁で1897年の鉱毒調査・予防工事命令、68頁で煙害対策とその限界を確認。', usedFor: [spot.ja] },
  { ...history, type: 'official', publisher: '日光市', notes: '銅山の時代区分、鉱害、田中正造、1973年の閉山。', usedFor: [spot.ja] },
  { ...heritage, type: 'official', publisher: '文化庁', notes: '史跡指定の範囲と現存施設。', usedFor: [spot.ja] },
];
for (const item of entries) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => '"' + key + '": [' + JSON.parse('[' + content + ']').map(x => JSON.stringify(x)).join(', ') + ']');
fs.writeFileSync(registryTarget, compact + '\n');
