/* Five Kanto regional summaries grounded in a publicly readable NDL volume. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const source = (id, title, url) => ({id, title, url});
const book = source('ndl-kanto-guide-1930', '鉄道省『日本案内記 関東篇』（1930年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/1176338');
const spots = [
  ['偕楽園',
    '1930年の『日本案内記』は、偕楽園を「常磐公園」と呼び、千波湖を見下ろす梅林と好文亭を紹介しています。水戸藩主の徳川斉昭は1842年、藩士だけでなく領内の人々とも楽しみを分かち合う場として園を開きました。「偕楽」という名にも、その考えが込められています。好文亭は景色を眺め、人を招くための建物でした。現在の建物には戦災後に復元された部分もあります。航空写真では梅林だけでなく、千波湖と園の高低差、周囲の景色まで一緒に見てみましょう。',
    [source('official-kairakuen-history', '偕楽園の歴史（偕楽園）', 'https://ibaraki-kairakuen.jp/history/'), source('official-kairakuen-kobuntei', '好文亭（偕楽園）', 'https://ibaraki-kairakuen.jp/kobuntei/')]],
  ['弘道館',
    '1930年の『日本案内記』は、旧弘道館を水戸城の大手橋に面した藩校として紹介し、文館・武館・医学館などを挙げています。徳川斉昭が進めた教育は、書物を読むだけでなく、武術や医学も学ぶ大きな構想でした。1841年に仮開館し、徳川慶喜も維新の際にここで過ごしたと案内書に記されています。広い敷地の多くは姿を変えましたが、正庁・至善堂・正門は残っています。航空写真では水戸城跡との近さを探し、学ぶ場が城下のどこに置かれたか確かめてみましょう。',
    [source('official-kodokan-cultural-property', '旧弘道館（茨城県教育委員会）', 'https://kyoiku.pref.ibaraki.jp/bunkazai/kuni-10/'), source('official-kodokan-ibaraki', '弘道館（水戸市）（茨城県）', 'https://www.pref.ibaraki.jp/bugai/koho/kenmin/download/koudoukan.html')]],
  ['足利学校',
    '1930年の『日本案内記』は、足利学校の起源は明らかでないものの、15世紀前半には存在し、戦国時代にも学びが続いたと記します。上杉憲実が1439年に書籍を寄進したことから、歴史を具体的にたどれます。学校では儒学の書物などが学ばれ、今も貴重な蔵書が伝わります。見えている建物の一部は発掘調査や古図をもとに1990年に復原された江戸時代中期の姿です。航空写真では土塁と堀に囲まれた敷地を、隣の鑁阿寺と見比べてみましょう。',
    [source('official-ashikaga-history', '足利学校の歴史（足利市）', 'https://www.city.ashikaga.tochigi.jp/education/000031/000180/p001417.html'), source('official-ashikaga-site', '足利学校跡（足利市）', 'https://www.city.ashikaga.tochigi.jp/education/000029/000169/000627/p001274.html')]],
  ['富岡製糸場',
    '1930年の『日本案内記』は、富岡を日本初の模範製糸工場が置かれた町として紹介し、繭と生糸の取引にも触れています。明治政府は1872年、フランスの技術を取り入れた器械製糸の工場を開きました。ここで技術を学んだ人たちが各地へ広めたことも、工場の大きな役割です。操業は1987年に終わりましたが、繰糸所や繭を保管した建物が残り、2014年には関連施設とともに世界遺産になりました。航空写真では長い繰糸所と二つの繭倉庫の配置を探してみましょう。',
    [source('official-tomioka-history', '富岡製糸場の歴史（富岡市観光公式）', 'https://www.tomioka-silk.jp/_tomioka-silk-mill/guide/history.html'), source('official-tomioka-guide', '世界遺産「富岡製糸場」の完全ガイド（富岡市観光公式）', 'https://www.tomioka-silk.jp/_special/detail/tomioka_silk_mill_sp.html')]],
  ['碓氷峠鉄道文化むら',
    '1930年の『日本案内記』は、碓氷峠の急坂を列車がアプト式の線路と電気機関車で越えていたと説明します。歯車を使って坂を登る仕組みが必要なほど、横川と軽井沢の間は難しい区間でした。その後は専用の電気機関車を使う方式に変わり、1997年にこの区間の鉄道が廃止されました。旧横川運転区の跡に1999年に開いた鉄道文化むらでは、峠で活躍した車両や資料が伝えられています。航空写真では横川駅、展示車両、山へ向かう線路のつながりを追ってみましょう。',
    [source('official-usui-annaka', '鉄道文化むら 碓氷峠の歴史を学ぶ（安中市）', 'https://www.city.annaka.lg.jp/page/21648.html'), source('official-usui-museum', '鉄道文化むらについて（碓氷峠鉄道文化むら）', 'https://www.usuitouge.com/bunkamura/about/')]],
];
const target = path.join(root, 'data/regional-landmarks-v1.json');
const doc = JSON.parse(fs.readFileSync(target, 'utf8'));
for (const [name, summary, official] of spots) {
  const spot = doc.landmarks.find(item => item.ja === name);
  if (!spot) throw Error(`Missing ${name}`);
  spot.summaries = {...spot.summaries, ja: summary};
  spot.researchSources = [book, ...official];
  spot.reviewedOn = '2026-09-25';
}
fs.writeFileSync(target, JSON.stringify(doc, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const bookRecord = registry.sources.find(item => item.id === book.id);
if (!bookRecord) throw Error('Missing Kanto book registry entry');
bookRecord.fullTextSearchFrames = [...new Set([...bookRecord.fullTextSearchFrames, 50, 242, 245, 285, 339, 340])].sort((a,b) => a-b);
bookRecord.usedFor = [...new Set([...bookRecord.usedFor, ...spots.map(item => item[0])])];
bookRecord.notes += ' 50・245コマに碓氷峠のアプト式、242コマに富岡の模範製糸工場、285コマに足利学校、339～340コマに弘道館・常磐公園（偕楽園）と好文亭を確認。';
const notes = {
  'official-kairakuen-history':['偕楽園の歴史','偕楽園','1842年の開園と「偕楽」の理念。','偕楽園'],
  'official-kairakuen-kobuntei':['好文亭','偕楽園','好文亭の用途と戦後の復元。','偕楽園'],
  'official-kodokan-cultural-property':['旧弘道館','茨城県教育委員会','文館・武館・医学館を含む藩校の構想と現存建物。','弘道館'],
  'official-kodokan-ibaraki':['弘道館（水戸市）','茨城県','1841年仮開館と重要文化財の建物。','弘道館'],
  'official-ashikaga-history':['足利学校の歴史','足利市','創建の諸説、1439年の記録、1990年の復原。','足利学校'],
  'official-ashikaga-site':['足利学校跡','足利市','土塁・堀に囲まれた敷地。','足利学校'],
  'official-tomioka-history':['富岡製糸場の歴史','富岡市','1872年開業、技術の普及、1987年操業停止。','富岡製糸場'],
  'official-tomioka-guide':['世界遺産「富岡製糸場」の完全ガイド','富岡市','現存する繰糸所・繭倉庫と2014年世界遺産登録。','富岡製糸場'],
  'official-usui-annaka':['鉄道文化むら 碓氷峠の歴史を学ぶ','安中市','1997年の廃線と1999年の開園。','碓氷峠鉄道文化むら'],
  'official-usui-museum':['鉄道文化むらについて','碓氷峠鉄道文化むら','アプト式から専用機関車への変遷と展示。','碓氷峠鉄道文化むら'],
};
for (const [, , official] of spots) for (const ref of official) {
  if (registry.sources.some(item => item.id === ref.id)) continue;
  const [title,publisher,note,usedFor] = notes[ref.id];
  registry.sources.push({id:ref.id,type:'official',title,publisher,url:ref.url,notes:note,usedFor:[usedFor]});
}
const compact = JSON.stringify(registry,null,2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_whole,key,contents) => `"${key}": [${JSON.parse(`[${contents}]`).map(item => JSON.stringify(item)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
