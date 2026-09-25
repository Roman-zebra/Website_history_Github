/* Eight second-tier Kyushu places: public NDL book plus current official sources. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const source = (id, title, url) => ({ id, title, url });
const book = source('ndl-kyushu-guide-1935', '鉄道省『日本案内記 九州篇』（1935年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/1176417');
const edits = [
  ['唐津城',
    '1935年の『日本案内記』は、松浦川の河口にある「舞鶴城址」を唐津の見どころとして紹介しています。舞鶴城は唐津城の別名で、海へ突き出す丘と城下町の形から名付けられました。寺沢広高が17世紀初めに築いた城ですが、当時の天守があったかは分かっていません。現在の天守は1966年に建てられた観光施設です。古い城そのものと、後から造られた町のシンボルを分けて見ると、石垣や海に面した立地の歴史が読み取りやすくなります。航空写真では川、海、城跡の位置関係を確かめてみましょう。',
    [source('official-karatsu-castle', '唐津城（唐津市）', 'https://www.city.karatsu.lg.jp/page/1041.html')]],
  ['崎津集落',
    '1935年の『日本案内記』は、﨑津を羊角湾の奥にある港として紹介し、禁教下でもキリスト教への信仰が続いた土地だと記しています。海と山に挟まれた小さな漁村では、住民が生活を続けながら信仰を守りました。1805年には信仰が明らかになり、多くの人が取り調べを受けました。現在の﨑津教会は1934年に建てられ、かつて絵踏が行われた場所に立っています。世界遺産の一部となった今も、集落は人が暮らす場所です。航空写真では入江、細い道、教会の近さを見てみましょう。',
    [source('official-sakitsu-history', '﨑津集落の歴史（天草市）', 'https://www.city.amakusa.kumamoto.jp/sakitsu-sekai/kiji0037/index.html')]],
  ['阿蘇神社',
    '1935年の『日本案内記』は、阿蘇の火山とともに阿蘇神社を紹介し、農業に関わる信仰も伝えています。神社は火山を望む谷の町にあり、阿蘇地域の人々の祈りと暮らしを長く結びつけてきました。現在の主要な社殿は江戸時代後期に建て直されたものです。2016年の熊本地震では楼門を含む建物が大きく被害を受け、楼門は2023年に復旧しました。歴史の長さだけでなく、災害後に地域で建物を守り継ぐ過程にも目を向けてみましょう。',
    [source('official-aso-shrine', '阿蘇神社（阿蘇市）', 'https://www.city.aso.kumamoto.jp/education/cultural-property/list_of_cultural_property/asoshrine/')]],
  ['臼杵石仏',
    '1935年の『日本案内記』は、臼杵の深田にある岩壁に刻まれた仏像群を紹介しています。「臼杵石仏」は一体の仏像の名ではなく、谷あいに点在する多くの磨崖仏の総称です。今は古園、山王山、ホキ第一群、ホキ第二群の四つに分けて案内されます。柔らかな凝灰岩に彫られたため傷みやすく、長い保存修理を経て守られてきました。制作年代や作者には分からない点も残ります。まず地図で四群の距離を見てから歩くと、一つの谷に広がる信仰の場として理解できます。',
    [source('official-usuki-stone-buddhas', '国宝臼杵石仏（臼杵市）', 'https://www.city.usuki.oita.jp/docs/2014021200019/')]],
  ['杵築城',
    '1935年の『日本案内記』は、杵築を八坂川のほとりに開けた旧城下町として紹介しています。城は海に近い台地の先端に築かれ、麓には藩主の御殿が置かれました。現在の三層の天守は江戸時代の建物ではなく、1970年に建てられた模擬天守です。城跡と、武家屋敷や商家が残る坂の町並みを一緒に見ると、川と台地を使った町のつくりが分かります。航空写真では城の丘から北台・南台へ続く道と、その間の谷を探してみましょう。',
    [source('official-kitsuki-castle-history', '城下町の祭事に関わる建造物（杵築市）', 'https://www.city.kitsuki.lg.jp/material/files/group/38/2syou1.pdf')]],
  ['飫肥城',
    '1935年の『日本案内記』は、酒谷川のそばの飫肥城を訪ね、石垣と堀が残ると記しています。江戸時代には伊東家の城下町として栄え、城の周囲には武家屋敷が並びました。今見える大手門は1978年に復元された建物で、城跡に残る石垣とは時代が異なります。門をくぐって終わりにせず、曲がる道や高低差をたどると、城を中心に組み立てられた町が見えてきます。城下町は重要伝統的建造物群保存地区として守られています。',
    [source('official-obi-district', '日南市飫肥伝統的建造物群保存地区（日南市）', 'https://www.city.nichinan.lg.jp/soshikikarasagasu/shogaigakushuka/2/817.html')]],
  ['高千穂神社',
    '1935年の『日本案内記』は、高千穂町の西側にある高千穂神社を紹介し、かつて「十社大明神」と呼ばれたと記しています。高千穂一帯の神々をまつる中心的な神社として信仰を集め、神話にまつわる伝承も伝わります。彫刻のある本殿や鉄製の狛犬は国の重要文化財です。神話を史実として扱うのではなく、地域が語り継いできた物語として受け止めると、社殿と町とのつながりが見えてきます。周辺の神社や高千穂峡との位置関係も地図で確かめてみましょう。',
    [source('official-takachiho-shrines', '高千穂三田井地区の神社（高千穂町）', 'https://www.town-takachiho.jp/top/soshiki/kikakukanko/2/3/287.html')]],
  ['霧島神宮',
    '1935年の『日本案内記』は、霧島の山の中にある色鮮やかな社殿を紹介しています。霧島神宮は火山と深く結びついた神社です。以前の社殿は噴火で失われ、場所を移しながら再建されました。現在の本殿・幣殿・拝殿は島津吉貴によって1715年に建てられ、国宝に指定されています。朱塗りの建物だけでなく、背後にそびえる霧島の山々を合わせて眺めると、この神社がなぜこの土地で大切にされてきたかが分かります。',
    [source('official-kirishima-shrine', '神社・仏閣（鹿児島県）', 'https://www.pref.kagoshima.jp/ba08/pr/gaiyou/rekishi/bunka/zinja.html'), source('official-kirishima-national-treasure', '国宝及び重要文化財（建造物）の指定について（鹿児島県教育委員会）', 'https://www.pref.kagoshima.jp/ba08/kirisimajinnguu_kagoshimajinnguu.html')]],
];
const target = path.join(root, 'data/regional-landmarks-v1.json');
const doc = JSON.parse(fs.readFileSync(target, 'utf8'));
for (const [name, summary, official] of edits) {
  const spot = doc.landmarks.find(item => item.ja === name);
  if (!spot) throw Error(`Missing ${name}`);
  spot.summaries = { ...spot.summaries, ja: summary };
  spot.researchSources = [book, ...official];
  spot.reviewedOn = '2026-09-25';
}
fs.writeFileSync(target, JSON.stringify(doc, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
const rec = registry.sources.find(item => item.id === book.id);
if (!rec) throw Error('Missing book');
rec.fullTextSearchFrames = [...new Set([...rec.fullTextSearchFrames, 14, 29, 43, 124, 228, 274, 288, 298, 300, 301, 302, 303, 317])].sort((a, b) => a - b);
rec.usedFor = [...new Set([...rec.usedFor, ...edits.map(item => item[0])])];
rec.notes += ' 14・43・124コマに唐津の舞鶴城址、228コマに﨑津の港と信仰、29コマに阿蘇神社、300～303コマに臼杵の磨崖仏、317コマに杵築、288コマに飫肥、298コマに高千穂神社、274コマに霧島神宮を確認。';
const notes = {
  'official-karatsu-castle': ['唐津城', '唐津市', '寺沢広高の築城、旧天守の不確実性、1966年の現在の天守。'],
  'official-sakitsu-history': ['﨑津集落の歴史', '天草市', '禁教下の信仰、1805年、現在の教会と生活集落。'],
  'official-aso-shrine': ['阿蘇神社', '阿蘇市', '江戸後期の社殿、2016年被災と2023年の楼門復旧。'],
  'official-usuki-stone-buddhas': ['国宝臼杵石仏', '臼杵市', '四つの石仏群、凝灰岩の保存、年代の不確実性。'],
  'official-kitsuki-castle-history': ['城下町の祭事に関わる建造物', '杵築市', '旧城跡と1970年の模擬天守を区別。'],
  'official-obi-district': ['日南市飫肥伝統的建造物群保存地区', '日南市', '伊東家の城下町、1970年代の復元、保存地区。'],
  'official-takachiho-shrines': ['高千穂三田井地区の神社', '高千穂町', '高千穂神社の本殿と鉄製狛犬の文化財指定。'],
  'official-kirishima-shrine': ['神社・仏閣', '鹿児島県', '噴火と遷座、1715年の社殿。'],
  'official-kirishima-national-treasure': ['国宝及び重要文化財（建造物）の指定について', '鹿児島県教育委員会', '本殿・幣殿・拝殿の国宝指定。'],
};
for (const [name, , official] of edits) for (const ref of official) {
  if (registry.sources.some(item => item.id === ref.id)) continue;
  const [title, publisher, note] = notes[ref.id];
  registry.sources.push({ id: ref.id, type: 'official', title, publisher, url: ref.url, notes: note, usedFor: [name] });
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_whole, key, contents) => `"${key}": [${JSON.parse(`[${contents}]`).map(item => JSON.stringify(item)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
