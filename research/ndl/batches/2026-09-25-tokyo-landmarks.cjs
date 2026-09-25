/* Japanese copy: 1930 NDL guide, checked against openly readable frames. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const target = path.join(root, 'data/landmarks.json');
const doc = JSON.parse(fs.readFileSync(target, 'utf8'));
const book = {id:'ndl-kanto-guide-1930', title:'鉄道省『日本案内記 関東篇』（1930年・国立国会図書館）', url:'https://dl.ndl.go.jp/pid/1176338'};
const official = (id, title, url) => ({id, title, url});
function edit(name, summary, sources) {
  const spot = doc.landmarks.find(item => item.ja === name);
  if (!spot) throw Error(`missing ${name}`);
  spot.summaries.ja = summary;
  spot.researchSources = [book, ...sources];
  spot.reviewedOn = '2026-09-25';
}

edit('秋葉原',
  '1930年の『日本案内記』には、秋葉原駅前に青果を扱う中央卸売市場の神田分場が載っています。今の電気街だけを思い浮かべると意外ですが、ここは物資が集まる駅前でもありました。戦後にはラジオ部品の店が高架下などに集まり、家電、パソコン、アニメ文化へと街の顔が変わりました。「秋葉原」の名は、明治初めに火災を防ぐため設けた空き地と鎮火の社に由来します。古い航空写真では駅と線路を目印に、市場の時代から商店の街へ変わった一帯を比べてみましょう。',
  [official('official-akihabara-origin', '秋葉原の由来（秋葉原電気街振興会）', 'https://akiba.or.jp/archives/history00'),
   official('official-akihabara-postwar', '焼け野原からの出発（秋葉原電気街振興会）', 'https://akiba.or.jp/archives/history02'),
   official('official-akihabara-popculture', '変容する街・秋葉原（秋葉原電気街振興会）', 'https://akiba.or.jp/archives/history08')]);

edit('渋谷スクランブル交差点',
  '1930年の『日本案内記』には、渋谷町の玉川電気鉄道や渋谷駅につながる電車が載っています。人と路線が集まる駅前だった一方、いま知られるスクランブル交差点は当時まだありません。渋谷区の資料によると、駅前交差点が歩行者の斜め横断もできる方式になったのは1973年です。信号が切り替わると多方向から人が歩き出す、現在の渋谷を象徴する風景が生まれました。航空写真では駅、ハチ公口、交差点の位置を先に探し、線路や駅前広場の変化も一緒に見てください。',
  [official('official-shibuya-crossing-history', '渋谷駅前の基盤整備を語る（渋谷区）', 'https://www.city.shibuya.tokyo.jp/e-book/kankyo/shuhen-machizukuri/koremade-torikumi/pageindices/index28.html'),
   official('official-tokyo-shibuya-crossing', '渋谷スクランブル交差点（東京観光財団）', 'https://www.gotokyo.org/jp/spot/78/')]);

edit('東京タワー',
  '1930年の『日本案内記』が紹介する芝公園には、増上寺や徳川家の墓所、丸山古墳がありました。東京タワーはまだなく、古い航空写真の芝公園を読むときは、この寺と公園の広がりが目印になります。戦後、テレビ放送の電波を送るため、高さ333メートルの塔が建てられ、1958年に営業を始めました。塔は展望施設でもありますが、出発点は放送のための設備です。写真を切り替え、増上寺の北西に現れた細い塔と周辺の街並みの変化を追ってみましょう。',
  [official('official-tokyo-tower-history', '会社概要・年表（東京タワー）', 'https://www.tokyotower.co.jp/company/'),
   official('official-tokyo-tower-facts', 'Towerpedia（東京タワー）', 'https://www.tokyotower.co.jp/plan/towerpedia/')]);

edit('東京スカイツリー',
  '1930年の『日本案内記』には、押上に向かう京成電車や東武鉄道の路線が載っています。現在スカイツリーが立つ業平橋・押上地区は、長く貨物を扱う鉄道の場所でした。貨物列車の運行が1993年に終わり、跡地に高さ634メートルの電波塔が建設され、2012年に開業しました。塔の南を流れる北十間川も、かつて鉄道の荷物を船へ積み替えて運ぶ道でした。古い航空写真では大きな貨物ヤードと川を探し、現在の塔と商業施設が占める場所を比べてください。',
  [official('official-skytree-site-history', '東京スカイツリーが建つ場所（東京スカイツリー）', 'https://www.tokyo-skytree.jp/group/pre-learning/skytree/construction/'),
   official('official-skytree-overview', '東京スカイツリーの概要（東京スカイツリー）', 'https://www.tokyo-skytree.jp/group/pre-learning/skytree/construction/overview.php'),
   official('official-skytree-industry', 'すみだの産業（東京スカイツリー）', 'https://www.tokyo-skytree.jp/group/pre-learning/sumida/industry/')]);

fs.writeFileSync(target, JSON.stringify(doc) + '\n');

const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const guide = registry.sources.find(item => item.id === book.id);
if (!guide) throw Error(`missing source ${book.id}`);
guide.fullTextSearchFrames = [...new Set([...guide.fullTextSearchFrames, 69, 71, 80, 98, 115, 116])].sort((a,b)=>a-b);
if (!guide.notes.includes('98コマに秋葉原駅前')) guide.notes += ' 追加確認：69・115コマに戦前の渋谷の鉄道、71・116コマに押上方面の路線、80コマに芝公園・増上寺、98コマに秋葉原駅前の中央卸売市場神田分場。新しい交差点・塔・電気街の歴史は各公式資料で確認。';
guide.usedFor = [...new Set([...guide.usedFor, '秋葉原', '渋谷スクランブル交差点', '東京タワー', '東京スカイツリー'])];
const add = (id, title, publisher, url, notes, usedFor) => {
  if (registry.sources.some(item => item.id === id)) return;
  registry.sources.push({id, type:'official', title, publisher, url, notes, usedFor:[usedFor]});
};
add('official-akihabara-origin', '秋葉原の由来', '秋葉原電気街振興会', 'https://akiba.or.jp/archives/history00', '火除地・秋葉神社に由来する地名と戦後の電気街の起点。', '秋葉原');
add('official-akihabara-postwar', '焼け野原からの出発', '秋葉原電気街振興会', 'https://akiba.or.jp/archives/history02', '戦後のラジオ部品店と高架下の商店街。', '秋葉原');
add('official-akihabara-popculture', '変容する街・秋葉原', '秋葉原電気街振興会', 'https://akiba.or.jp/archives/history08', '家電・パソコンからアニメ文化への変化。', '秋葉原');
add('official-shibuya-crossing-history', '渋谷駅前の基盤整備を語る', '渋谷区', 'https://www.city.shibuya.tokyo.jp/e-book/kankyo/shuhen-machizukuri/koremade-torikumi/pageindices/index28.html', '2023年の座談会で交差点のスクランブル化が約50年前と説明。1973年頃に相当する。', '渋谷スクランブル交差点');
add('official-tokyo-shibuya-crossing', '渋谷スクランブル交差点', '東京観光財団', 'https://www.gotokyo.org/jp/spot/78/', '現在の交差点の位置と駅・センター街の関係。', '渋谷スクランブル交差点');
add('official-tokyo-tower-history', '会社概要・年表', '株式会社TOKYO TOWER', 'https://www.tokyotower.co.jp/company/', '1958年営業開始と総合電波塔としての事業。', '東京タワー');
add('official-tokyo-tower-facts', 'Towerpedia', '株式会社TOKYO TOWER', 'https://www.tokyotower.co.jp/plan/towerpedia/', '333メートルの高さとテレビ放送のための建設。', '東京タワー');
add('official-skytree-site-history', '東京スカイツリーが建つ場所', '東武タワースカイツリー株式会社', 'https://www.tokyo-skytree.jp/group/pre-learning/skytree/construction/', '貨物ヤード跡、1993年の貨物列車運行終了と2012年開業。', '東京スカイツリー');
add('official-skytree-overview', '東京スカイツリーの概要', '東武タワースカイツリー株式会社', 'https://www.tokyo-skytree.jp/group/pre-learning/skytree/construction/overview.php', '高さ634メートルと2012年5月22日開業。', '東京スカイツリー');
add('official-skytree-industry', 'すみだの産業', '東武タワースカイツリー株式会社', 'https://www.tokyo-skytree.jp/group/pre-learning/sumida/industry/', '鉄道貨物から北十間川の舟運への積み替え。', '東京スカイツリー');
const compactArrays = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_whole, key, contents) =>
  `"${key}": [${JSON.parse(`[${contents}]`).map(item => JSON.stringify(item)).join(', ')}]`);
fs.writeFileSync(registryTarget, compactArrays + '\n');
