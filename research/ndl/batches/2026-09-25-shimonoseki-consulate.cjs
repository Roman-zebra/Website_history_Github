/* NDL-cataloged public book by Tokyo National Research Institute for Cultural Properties, printed p.69 inspected online. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = { id: 'ndl-brick-conservation-2017-shimonoseki', title: '東京文化財研究所『煉瓦造建造物の保存と修復』（2017年）69頁', url: 'https://www.tobunken.go.jp/image-gallery/conservation/17/HTML/index71.html' };
const city = { id: 'official-shimonoseki-consulate', title: '重要文化財 旧下関英国領事館（下関市）', url: 'https://www.city.shimonoseki.lg.jp/soshiki/104/5885.html' };
const architecture = { id: 'official-shimonoseki-consulate-architecture', title: '旧下関英国領事館の建築について（下関市）', url: 'https://www.city.shimonoseki.lg.jp/soshiki/104/5887.html' };
const target=path.join(root,'data/liminal.json');
const data=JSON.parse(fs.readFileSync(target,'utf8'));
const spot=data.places.find(x=>x.id==='shimonoseki-consulate');
if(!spot) throw Error('旧下関英国領事館 not found');
spot.hook_ja='港を見渡す赤煉瓦の館。1階は外交の仕事場、2階は住まいだった。';
spot.hooks={...spot.hooks,ja:spot.hook_ja};
spot.why_ja='1906年に建てられた、領事館用の建物としては日本最古の現存例です。外から見る赤煉瓦だけでなく、執務室と住居を一つの建物に重ねた構成に、当時の港町と外交の関係が表れています。';
spot.summaries={...spot.summaries,ja:'下関市唐戸の旧下関英国領事館は、1906年に建てられた赤煉瓦の建物です。領事館として使うために建てられた建物のうち、日本に現存する最古の例とされています。設計は英国政府工務局の建築技師ウィリアム・コーワン。1階には領事らの仕事部屋、2階には寝室や居間が置かれ、港のそばで外交と暮らしが同じ建物に収まっていました。1941年に領事館が閉じた後は下関市の公共施設となり、現在は国の重要文化財として公開されています。東京文化財研究所の公開書籍『煉瓦造建造物の保存と修復』は、海に近い立地で煉瓦の中の鉄が錆び、壁に傷みが生じたことや、補強して建物を守った経緯を記しています。外壁の煉瓦の積み方や南側のアーチを見たら、室内の仕事場と住まいの配置にも目を向けてみてください。'};
spot.researchSources=[book,city,architecture];
spot.reviewedOn='2026-09-25';
fs.writeFileSync(target,JSON.stringify(data)+'\n');
const registryTarget=path.join(root,'research/ndl/sources.json');
const registry=JSON.parse(fs.readFileSync(registryTarget,'utf8'));
const entries=[
 {id:book.id,type:'book',title:'煉瓦造建造物の保存と修復（未来につなぐ人類の技17）',author:'国立文化財機構東京文化財研究所保存科学研究センター近代文化遺産研究室 編',year:2017,ndlSearch:'https://ndlsearch.ndl.go.jp/books/R100000001-I31111120162175',fullText:book.url,access:'東京文化財研究所が電子ブックを全文公開。NDLサーチに図書として登録。',notes:'電子ブック71/130の表示ページ、印刷69頁で旧下関英国領事館の煉瓦壁・帯鉄の腐食と補強方法を確認。2014年の下関市修理報告書からの転載と明記。',usedFor:[spot.ja]},
 {...city,type:'official',publisher:'下関市',notes:'1906年建築、1999年重文指定、2014年再開館、現在の公開。',usedFor:[spot.ja]},
 {...architecture,type:'official',publisher:'下関市',notes:'英国政府工務局ウィリアム・コーワンの設計、1階執務室・2階住居、外観の構造。',usedFor:[spot.ja]}
];
for(const entry of entries){const old=registry.sources.find(x=>x.id===entry.id);if(old)Object.assign(old,entry);else registry.sources.push(entry);}
const compact=JSON.stringify(registry,null,2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g,(_a,key,value)=>'"'+key+'": ['+JSON.parse('['+value+']').map(x=>JSON.stringify(x)).join(', ')+']');
fs.writeFileSync(registryTarget,compact+'\n');
