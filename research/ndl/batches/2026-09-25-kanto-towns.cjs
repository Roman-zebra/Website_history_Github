/* Kanto towns, temple and shrine: NDL guide checked in Chrome, later facts from official sources. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const source = (id,title,url) => ({id,title,url});
const book = source('ndl-kanto-guide-1930','鉄道省『日本案内記 関東篇』（1930年・国立国会図書館）','https://dl.ndl.go.jp/pid/1176338');
const edits = [
  ['佐原の町並み',
    '1930年の『日本案内記』は、佐原を利根川の河港として栄えた町と記し、酒造りや伊能忠敬の旧宅も紹介しています。川で運んだ物資が集まる商業の町だったことが、今の小野川沿いと香取街道の町並みからも読み取れます。土蔵や店を一軒ずつ見るだけでなく、川に向けて町が開いていることに目を向けてください。1996年には関東で初めて重要伝統的建造物群保存地区に選ばれました。航空写真では小野川が利根川へつながる道筋と、忠敬橋周辺の街区を追ってみましょう。',
    [source('official-sawara-town','佐原の町並み（香取市）','https://www.city.katori.lg.jp/sightseeing/machinami/index.html'),source('official-sawara-preservation','佐原の伝統的建造物群保存地区（香取市）','https://www.city.katori.lg.jp/living/sumai/machinamihozon.html')]],
  ['成田山新勝寺',
    '1930年の『日本案内記』は、成田山新勝寺を「成田不動」とも呼び、成田駅から参る寺として紹介しています。境内には当時すでに江戸時代の建物があり、初詣や節分会も案内書に載るほど親しまれていました。寺の伝承では940年、寛朝が不動明王に祈り、のちに新勝寺の名を受けたことが始まりです。現在の大本堂と、古い堂塔は造られた時代が違います。航空写真では駅から続く参道の曲がり方と、広い境内に建物が重なる様子を見てみましょう。',
    [source('official-narita-history','成田山略年表（成田山新勝寺）','https://www.naritasan.or.jp/about/history/'),source('official-narita-halls','各御堂のご案内（成田山新勝寺）','https://www.naritasan.or.jp/tour/hall/')]],
  ['小田原城',
    '1930年の『日本案内記』は、小田原城址を後北条氏と大久保氏の城の跡として案内し、松の茂る城址を車窓から見られると記します。後北条氏は戦国時代、城下町まで囲む「総構」を築きました。江戸時代には城の範囲が縮まり、明治の廃城後には建物の多くが失われました。今の天守は1960年に復興されたものです。航空写真では天守の建つ本丸だけでなく、堀と二の丸、さらに市街地に残る総構の地形を探してみましょう。',
    [source('official-odawara-castle','小田原城（小田原市）','https://www.city.odawara.kanagawa.jp/kanko/corridor/castle/p09978.html'),source('official-odawara-tower','天守閣（小田原市）','https://www.city.odawara.kanagawa.jp/kanko/corridor/castle/p09991.html')]],
  ['根津神社',
    '1930年の『日本案内記』は、根津神社を市電で訪ねる東京の名所として挙げています。社殿は1706年、五代将軍徳川綱吉の命で現在地に造られ、本殿や楼門、唐門などが残ります。境内のつつじは、かつてこの場所にあった甲府松平家の屋敷に植えられたことに始まると伝わります。建物を見るときは一つの社殿だけでなく、門から拝殿、本殿へ進む配置に注目してください。航空写真では住宅街の中に残る広い緑地と参道を見つけてみましょう。',
    [source('official-nezu-bunkyo','根津神社（文京区）','https://www.city.bunkyo.lg.jp/rekishikan/p004327.html'),source('official-nezu-cultural','根津神社（文京区文化財）','https://www.city.bunkyo.lg.jp/b014/p003823.html?lang=ja')]],
];
const target=path.join(root,'data/regional-landmarks-v1.json');
const doc=JSON.parse(fs.readFileSync(target,'utf8'));
for(const [name,summary,official] of edits){
  const spot=doc.landmarks.find(item=>item.ja===name);
  if(!spot) throw Error(`Missing ${name}`);
  spot.summaries={...spot.summaries,ja:summary};
  spot.researchSources=[book,...official];
  spot.reviewedOn='2026-09-25';
}
fs.writeFileSync(target,JSON.stringify(doc,null,2)+'\n');
const registryTarget=path.join(root,'research/ndl/sources.json');
const registry=JSON.parse(fs.readFileSync(registryTarget,'utf8'));
const record=registry.sources.find(item=>item.id===book.id);
record.fullTextSearchFrames=[...new Set([...record.fullTextSearchFrames,29,56,99,155,156,361,362])].sort((a,b)=>a-b);
record.usedFor=[...new Set([...record.usedFor,...edits.map(item=>item[0])])];
record.notes+=' 29・56・361コマに成田不動、99コマに根津神社、155～156コマに小田原城址、362コマに佐原の河港と伊能忠敬旧宅を確認。';
const meta={
  'official-sawara-town':['佐原の町並み','香取市','小野川沿いの商家と1996年の選定。'],
  'official-sawara-preservation':['佐原の伝統的建造物群保存地区','香取市','忠敬橋と保存地区の範囲。'],
  'official-narita-history':['成田山略年表','成田山新勝寺','940年の開山と寛朝の伝承。'],
  'official-narita-halls':['各御堂のご案内','成田山新勝寺','現在の堂塔と建造年の違い。'],
  'official-odawara-castle':['小田原城','小田原市','後北条氏の総構、江戸期、廃城、1960年の天守復興。'],
  'official-odawara-tower':['天守閣','小田原市','1960年の復興天守。'],
  'official-nezu-bunkyo':['根津神社','文京区','1706年の社殿とつつじの伝承。'],
  'official-nezu-cultural':['根津神社','文京区','本殿・楼門・唐門などの重要文化財。'],
};
for(const [name,,official] of edits) for(const ref of official){
  if(registry.sources.some(item=>item.id===ref.id)) continue;
  const [title,publisher,notes]=meta[ref.id];
  registry.sources.push({id:ref.id,type:'official',title,publisher,url:ref.url,notes,usedFor:[name]});
}
const compact=JSON.stringify(registry,null,2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g,(_whole,key,contents)=>`"${key}": [${JSON.parse(`[${contents}]`).map(item=>JSON.stringify(item)).join(', ')}]`);
fs.writeFileSync(registryTarget,compact+'\n');
