/* NDL-cataloged Yokosuka City 2022 public book, full PDF chapter 1-2 inspected at PDF pp. 12, 22, 44. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-sarushima-fortress-report-2022', title: '横須賀市教育委員会『史跡東京湾要塞跡猿島砲台跡』（2022年）', url: 'https://www.city.yokosuka.kanagawa.jp/8120/bunkazai/documents/sarushimano2-12.pdf' };
const heritage = { id: 'official-yokosuka-sarushima-heritage', title: '東京湾要塞跡（猿島砲台跡）（横須賀市）', url: 'https://www.city.yokosuka.kanagawa.jp/8120/bunkazai/kuni15.html' };
const target = path.join(root, 'data/liminal.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.places.find(x => x.id === 'sarushima');
if (!spot) throw Error('猿島 not found');
spot.hook_ja = '東京湾の島に、砲台へ続く煉瓦の通路が残る。';
spot.hooks = { ...spot.hooks, ja: spot.hook_ja };
spot.why_ja = '島の緑の中にある煉瓦のトンネルや弾薬庫は、東京湾と横須賀の軍港を守るために造られました。海辺の遊び場と軍事施設の跡が重なる風景から、島の異なる時代が見えてきます。';
spot.summaries = { ...spot.summaries, ja: '猿島は、神奈川県横須賀市沖の東京湾に浮かぶ島です。現在は公園として親しまれていますが、島の中央には明治時代に築かれた砲台跡があります。猿島砲台は1881年に着工し、1884年に完成しました。東京湾の奥へ進む艦船を防ぎ、横須賀の軍港を守る役割を担っていました。横須賀市教育委員会の公開書籍『史跡東京湾要塞跡猿島砲台跡』は、砲座を結ぶ通路や煉瓦造りの弾薬庫、排水施設を調査し、島の地下や斜面にも遺構が広がっていることを記録しています。トンネルの煉瓦と、その先の海を一緒に見ると、ここが単なる隠れ家ではなく、海上を見張り砲を運用する施設だったと分かります。砲台跡は国の史跡「東京湾要塞跡」の一部です。' };
spot.researchSources = [book, heritage];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const entries = [
 { id: book.id, type: 'book', title: '史跡東京湾要塞跡猿島砲台跡：史跡整備事業に伴う資料収集調査', author: '横須賀市教育委員会（教育総務部生涯学習課）編', year: 2022, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000136-I1971993809767868559', fullText: book.url, access: '横須賀市が第1章・第2章を全文PDF公開。NDLサーチに図書として登録。', notes: 'PDF12頁の刊行趣旨、22頁の砲台構造と建設年代、44頁の煉瓦隧道・弾薬庫・排水調査を確認。', usedFor: [spot.ja] },
 { ...heritage, type: 'official', publisher: '横須賀市', notes: '1881年着工、1884年竣工、砲台の目的、2015年の国史跡指定、現在の公園内位置。', usedFor: [spot.ja] }
];
for (const entry of entries) { const old=registry.sources.find(x=>x.id===entry.id); if(old) Object.assign(old,entry); else registry.sources.push(entry); }
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all,key,value) => '"' + key + '": [' + JSON.parse('['+value+']').map(x=>JSON.stringify(x)).join(', ') + ']');
fs.writeFileSync(registryTarget, compact + '\n');
