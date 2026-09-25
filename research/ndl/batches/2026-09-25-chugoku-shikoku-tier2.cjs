/* Five second-tier Chugoku/Shikoku places researched in a public 1934 NDL guide. */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const source=(id,title,url)=>({id,title,url});
const book=source('ndl-chugoku-shikoku-guide-1934','鉄道省『日本案内記 中国・四国篇』（1934年・国立国会図書館）','https://dl.ndl.go.jp/pid/1176396');
const edits=[
  ['備中松山城',
    '1934年の『日本案内記』は、高梁の町の北にある臥牛山に「松山城址」があると案内しています。現在の備中松山城は、江戸時代の天守が残る山城として知られます。山陰と山陽を結ぶ道を見渡せる場所に築かれ、戦国時代には城主が何度も替わりました。今の天守は1683年の大改修で整えられた姿です。天守だけを見ると小さな城に感じるかもしれませんが、城の範囲は臥牛山の複数の峰に広がっていました。航空写真では城下町から山頂までの高低差と尾根の連なりを追ってみましょう。',
    [source('official-bitchu-castle','備中松山城（高梁市）','https://www.city.takahashi.lg.jp/soshiki/9/shiro4240131.html'),source('official-bitchu-site','備中松山城跡（高梁市）','https://www.city.takahashi.lg.jp/site/bichu-matsuyama/shiseki.html')]],
  ['石見銀山',
    '1934年の『日本案内記』は、大森町に江戸幕府の代官が駐在し、銀山の発展とともに町が栄えたと記します。刊行時には採掘は休止しており、案内書の筆者は町の衰えにも触れました。現在「石見銀山」として守られているのは坑道だけではありません。代官所跡、商家が続く大森の町、銀山川沿いの道、山中の採掘・製錬跡が一つの歴史を伝えています。航空写真では大森の細長い谷筋から山へ続く道をたどり、町と鉱山の距離を見てみましょう。',
    [source('official-ginzan-map','石見銀山の散策マップ（大田市）','https://ginzan.city.oda.lg.jp/highlights/walking_map/'),source('official-ginzan-buildings','石見銀山の歴史的建造物（大田市）','https://ginzan.city.oda.lg.jp/highlights/historic_buildings/')]],
  ['祖谷のかずら橋',
    '1934年の『日本案内記』は、祖谷の渓谷を下った先にある蔓橋を「溪中第一の奇觀」と紹介し、かつて東西祖谷には複数の橋が架かっていたと記します。祖谷川を渡るため、山に自生するシラクチカズラを編んでつくる橋です。今見られる橋は古い一本がそのまま残ったものではなく、材料と技を受け継ぎながら約3年ごとに架け替えられています。重要有形民俗文化財として守られるのは、その造り方も含めた暮らしの知恵です。航空写真では峡谷と橋の位置関係を探してみましょう。',
    [source('official-iya-bridge','祖谷のかずら橋（三好市公式観光サイト）','https://miyoshi-tourism.jp/spot/46/?spot_classification=culture'),source('official-iya-geopark','祖谷エリア（三好ジオパーク）','https://miyoshi-geopark.jp/area/iya/')]],
  ['道後温泉本館',
    '1934年の『日本案内記』は、道後温泉の浴館に「霊の湯」「神の湯」などがあると紹介しています。今の道後温泉本館の核になる建物は1894年に改築され、その後も増改築を重ねてきました。木造の浴場が日常の入浴の場として使われ続け、建物自体が国の重要文化財になっています。2019年からの保存修理を経て、2024年に全館での営業を再開しました。古い写真と比べるときは屋根の重なりに注目し、温泉街の道が本館の周りへ集まる様子も見てみましょう。',
    [source('official-dogo-history','道後温泉事務所（松山市）','https://www.city.matsuyama.ehime.jp/shisei/kakukaichiran/sangyoukeizaibu/top.html'),source('official-dogo-repair','道後温泉本館保存修理工事完了（松山市）','https://www.city.matsuyama.ehime.jp/hodo/202412/14492120241212144327.html')]],
  ['室戸岬',
    '1934年の『日本案内記』は、室戸岬を太平洋へ突き出す岬として紹介し、岩の海岸、暖地の植物群落、1899年に設けられた灯台を案内しています。現在は、地震による土地の隆起や海の働きでできた地形を読み取れる場所としても知られます。海岸の地層と、アコウやウバメガシが育つ森は、同じ岬でも違う時間の積み重なりを見せてくれます。航空写真では岬の先端と海岸段丘の輪郭を見てから、灯台と海岸の距離を確かめてみましょう。',
    [source('official-muroto-city','室戸市の概要（室戸市）','https://www.city.muroto.kochi.jp/pages/gaiyo.php'),source('official-muroto-geopark','自然科学にどっぷり！理科ジオコース（室戸ユネスコ世界ジオパーク）','https://www.muroto-geo.jp/course/6337/')]],
];
const target=path.join(root,'data/regional-landmarks-v1.json');
const doc=JSON.parse(fs.readFileSync(target,'utf8'));
for(const [name,summary,official] of edits){const spot=doc.landmarks.find(item=>item.ja===name);if(!spot)throw Error(`Missing ${name}`);spot.summaries={...spot.summaries,ja:summary};spot.researchSources=[book,...official];spot.reviewedOn='2026-09-25';}
fs.writeFileSync(target,JSON.stringify(doc,null,2)+'\n');
const registryTarget=path.join(root,'research/ndl/sources.json');
const registry=JSON.parse(fs.readFileSync(registryTarget,'utf8'));
const rec=registry.sources.find(item=>item.id===book.id);if(!rec)throw Error('Missing book');
rec.fullTextSearchFrames=[...new Set([...rec.fullTextSearchFrames,59,96,247,316,339,344,351,352])].sort((a,b)=>a-b);
rec.usedFor=[...new Set([...rec.usedFor,...edits.map(item=>item[0])])];
rec.notes+=' 96コマに備中高梁の臥牛山と松山城址、247コマに大森代官と休坑中の銀山、339コマに祖谷の蔓橋、316コマに道後の浴館と神の湯・霊の湯、344・351・352コマに室戸岬の植生・海岸・灯台を確認。';
const notes={
  'official-bitchu-castle':['備中松山城','高梁市','現存天守、1683年の修築、臥牛山の立地。'],
  'official-bitchu-site':['備中松山城跡','高梁市','山の複数の峰に広がる城跡。'],
  'official-ginzan-map':['石見銀山の散策マップ','大田市','代官所跡から坑道・製錬所跡までの広がり。'],
  'official-ginzan-buildings':['石見銀山の歴史的建造物','大田市','大森の町並みと代官所の役割。'],
  'official-iya-bridge':['祖谷のかずら橋','三好市','シラクチカズラ、約3年ごとの架け替え、文化財指定。'],
  'official-iya-geopark':['祖谷エリア','三好ジオパーク','峡谷の地形とシラクチカズラの材料。'],
  'official-dogo-history':['道後温泉事務所','松山市','1894年の本館改築とその後の増改築。'],
  'official-dogo-repair':['道後温泉本館保存修理工事完了','松山市','2019～2024年の保存修理と全館営業再開。'],
  'official-muroto-city':['室戸市の概要','室戸市','岬の名勝・植物群落と灯台。'],
  'official-muroto-geopark':['自然科学にどっぷり！理科ジオコース','室戸ユネスコ世界ジオパーク','隆起・地層・植物群落の現地解説。'],
};
for(const [name,,official] of edits)for(const ref of official){if(registry.sources.some(item=>item.id===ref.id))continue;const [title,publisher,note]=notes[ref.id];registry.sources.push({id:ref.id,type:'official',title,publisher,url:ref.url,notes:note,usedFor:[name]});}
const compact=JSON.stringify(registry,null,2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g,(_whole,key,contents)=>`"${key}": [${JSON.parse(`[${contents}]`).map(item=>JSON.stringify(item)).join(', ')}]`);
fs.writeFileSync(registryTarget,compact+'\n');
