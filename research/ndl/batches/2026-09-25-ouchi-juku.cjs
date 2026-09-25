/* Public NDL book, frame 6, read in Chrome alongside official heritage records. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-bosai-machizukuri-4', title: '自治省消防庁『防災まちづくり大賞 第4回』（2000年・国立国会図書館）', url: 'https://dl.ndl.go.jp/pid/9526438/1/6' };
const town = { id: 'official-shimogo-ouchi', title: '下郷町大内宿伝統的建造物群保存地区（下郷町）', url: 'https://www.town.shimogo.fukushima.jp/organization/kyouiku/4/150.html' };
const heritage = { id: 'official-bunka-ouchi', title: '下郷町大内宿（国指定文化財等データベース）', url: 'https://kunishitei.bunka.go.jp/heritage/detail/103/4' };
const target = path.join(root, 'data/regional-landmarks-v1.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const spot = data.landmarks.find(x => x.ja === '大内宿');
if (!spot) throw Error('大内宿 not found');
spot.summaries = { ...spot.summaries, ja: '大内宿は、会津若松と下野今市を結んだ街道の宿場町です。約450メートルの旧街道の両側に、茅葺き屋根の家が妻側を道に向けて並びます。江戸時代には旅人や物資の往来を支えましたが、明治時代に新しい道が別ルートで開くと交通の中心から外れ、昔の町並みが残りました。今も人が暮らし、住民は茅葺きの技術を受け継いでいます。自治省消防庁の公開書籍は、火に弱い屋根を守るため、住民の防災会が訓練や見回りを続けてきた様子を伝えます。通りを歩くときは、建物の形だけでなく、暮らしながら守ってきた町並みとして眺めてみてください。1981年に国の重要伝統的建造物群保存地区に選ばれました。' };
spot.researchSources = [book, town, heritage];
spot.reviewedOn = '2026-09-25';
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
if (!registry.sources.some(x => x.id === book.id)) registry.sources.push({ id: book.id, type: 'book', title: '防災まちづくり大賞 第4回', author: '自治省消防庁', year: 2000, ndlSearch: 'https://ndlsearch.ndl.go.jp/books/R100000039-I9526438', fullText: 'https://dl.ndl.go.jp/pid/9526438', access: 'ログインなしで閲覧可能／インターネット公開（許諾）', fullTextSearchFrames: [6], notes: '6コマの「下郷町大内宿防災会」。国重伝建選定後、各戸の火災報知・消火設備整備、消防団・婦人消防隊・火消組等による防災会、予防査察・訓練・見回りを記載。2000年当時の報告として扱う。', usedFor: [spot.ja] });
for (const item of [
  { ...town, type: 'official', publisher: '福島県下郷町', notes: '宿場の歴史、明治期の交通変化、屋根葺きの技術継承。', usedFor: [spot.ja] },
  { ...heritage, type: 'official', publisher: '文化庁', notes: '全長約450メートルの町並み、家の向き、1981年選定。', usedFor: [spot.ja] },
]) {
  const existing = registry.sources.find(x => x.id === item.id);
  if (existing) existing.usedFor = [...new Set([...(existing.usedFor || []), spot.ja])];
  else registry.sources.push(item);
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_all, key, content) => `"${key}": [${JSON.parse(`[${content}]`).map(x => JSON.stringify(x)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
