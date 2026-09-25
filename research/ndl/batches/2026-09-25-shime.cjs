/* NDL-cataloged 2013 preservation book; 2023 revised full-text edition inspected (cover and printed p.7). */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-shime-preservation-plan-2013-rev2023', title: '志免町『重要文化財 旧志免鉱業所竪坑櫓保存活用計画 改訂版』（2023年）', url: 'https://www.town.shime.lg.jp/uploaded/attachment/23873.pdf' };
const town = { id: 'official-shime-shaft-tower', title: '旧志免鉱業所竪坑櫓（志免町）', url: 'https://www.town.shime.lg.jp/site/bunkazai/tatekou-yagura2.html' };
const facilities = { id: 'official-shime-shimate-facilities', title: 'シーメイト施設のご案内（志免町）', url: 'https://www.town.shime.lg.jp/site/shimate/shisetsu-annai.html' };
const target = path.join(root, 'data/liminal.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.places.find(x => x.id === 'shime-fukuoka');
if (!spot) throw Error('志免町 not found');
spot.hook_ja = '町の広場に残る炭鉱の塔。地下430メートルと地上をつないだ。';
spot.hooks = { ...spot.hooks, ja: spot.hook_ja };
spot.why_ja = '金づちを立てたような形には理由があります。塔の上の機械で人と石炭を乗せるケージを上下させ、深い竪坑と地上を結んでいました。いまは国の重要文化財として、炭鉱と町の歩みを伝えています。';
spot.summaries = { ...spot.summaries, ja: '福岡県志免町の「旧志免鉱業所竪坑櫓」は、1943年に完成した高さ47.6メートルの鉄筋コンクリートの塔です。真下には深さ約430メートルの竪坑があり、塔の上部に据えた巻き上げ機で、鉱員や石炭を運ぶケージを動かしました。志免町が公開する保存活用計画の改訂版は、海軍の炭鉱として造られた後、戦後に国鉄へ引き継がれ、1964年の閉山まで使われた経緯を伝えています。かつての炭鉱跡には現在、町の複合施設シーメイトや広場があり、塔は地域の風景の一部になっています。下が開いたように見える独特の形は、機械と人の動線を収めるための構造です。外から形を見上げると、地中で働いた人々と、それを支えた地上の技術を想像できます。' };
spot.researchSources = [book, town, facilities];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const entries = [
  { id: book.id, type: 'book', title: '重要文化財旧志免鉱業所竪坑櫓保存活用計画（2013年刊、2023年改訂版）', author: '志免町教育委員会／志免町', year: 2013, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000002-I024913616', fullText: book.url, access: 'NDLサーチは2013年版を図書として登録。志免町が改訂版の全文PDFを公開。両版は同一ではない。', notes: '改訂版の表紙と印刷7頁を画像で確認。竪坑櫓の沿革、構造、海軍・国鉄・閉山後の経緯。', usedFor: [spot.ja] },
  { ...town, type: 'official', publisher: '志免町', notes: '1943年竣工、高さ47.6m、竪坑430m、ケージと巻き上げ機、国重要文化財の指定。', usedFor: [spot.ja] },
  { ...facilities, type: 'official', publisher: '志免町', notes: '現地のシーメイトと広場・公園の状況。', usedFor: [spot.ja] },
];
for (const entry of entries) {
  const old = registry.sources.find(x => x.id === entry.id);
  if (old) Object.assign(old, entry); else registry.sources.push(entry);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => '"' + key + '": [' + JSON.parse('[' + content + ']').map(x => JSON.stringify(x)).join(', ') + ']');
fs.writeFileSync(registryTarget, compact + '\n');

