/* Two Tohoku tier-two summaries based on the publicly readable 1929 guide. */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const source=(id,title,url)=>({id,title,url});
const book=source('ndl-tohoku-guide-1929','鉄道省『日本案内記 東北篇』（1929年・国立国会図書館）','https://dl.ndl.go.jp/pid/1176351');
const edits=[
  ['角館',
    '1929年の『日本案内記』は、角館を秋田藩の支藩が置かれた町として紹介し、シダレザクラや樺細工にも触れています。町の骨格がつくられたのは1620年。武家の住む内町と商人の住む外町は、火除けと呼ぶ土塁で分けられました。今も武家屋敷通りには門、塀、樹木が連なり、1976年に重要伝統的建造物群保存地区に選ばれています。航空写真では一本の通りだけでなく、旧武家町の広い屋敷割と、桧木内川に沿う町の形を見てみましょう。',
    [source('official-kakunodate-town','角館の町並み（仙北市）','https://www.city.semboku.akita.jp/sightseeing/spot/07_matinami.html'),source('official-kakunodate-property','仙北市角館伝統的建造物群保存地区（仙北市）','https://www.city.semboku.akita.jp/citizens/12_07.html')]],
  ['飯盛山 (会津若松市)',
    '1929年の『日本案内記』は、会津若松を巡る人に飯盛山の白虎隊士の墓と、麓の「さざえ堂」を案内しています。1868年の戊辰戦争で、戸ノ口原から退いた白虎隊の少年たちはこの山に至り、城下を望む場所で命を絶ちました。案内書は山を眺望のよい場所とも記しますが、ここは戦争で亡くなった人々を悼む場所です。1796年に建てられたさざえ堂と墓域を歩き、山の斜面から鶴ヶ城の方向を確かめてみましょう。航空写真では、墓域と城が離れていることも分かります。',
    [source('official-iimoriyama-graves','会津飯盛山白虎隊士墳墓域（会津若松市）','https://www.city.aizuwakamatsu.fukushima.jp/docs/2014061900030/'),source('official-iimoriyama-landscape','飯盛山と白虎隊をはじめとする先人慰霊にみる歴史的風致（会津若松市）','https://www.city.aizuwakamatsu.fukushima.jp/docs/2023042400018/file_contents/08ni4.pdf')]],
];
const target=path.join(root,'data/regional-landmarks-v1.json');
const doc=JSON.parse(fs.readFileSync(target,'utf8'));
for(const [name,summary,official] of edits){const spot=doc.landmarks.find(item=>item.ja===name);if(!spot)throw Error(`Missing ${name}`);spot.summaries={...spot.summaries,ja:summary};spot.researchSources=[book,...official];spot.reviewedOn='2026-09-25';}
fs.writeFileSync(target,JSON.stringify(doc,null,2)+'\n');
const registryTarget=path.join(root,'research/ndl/sources.json');
const registry=JSON.parse(fs.readFileSync(registryTarget,'utf8'));
const rec=registry.sources.find(item=>item.id===book.id);if(!rec)throw Error('Missing book');
rec.fullTextSearchFrames=[...new Set([...rec.fullTextSearchFrames,29,45,46,47,170,190])].sort((a,b)=>a-b);
rec.usedFor=[...new Set([...rec.usedFor,...edits.map(item=>item[0])])];
rec.notes+=' 170コマに角館の支藩とシダレザクラ、29コマに樺細工、45～47・190コマに飯盛山の白虎隊墓とさざえ堂を確認。';
const notes={
  'official-kakunodate-town':['角館の町並み','仙北市','1620年の町割、火除け、武家町と町人町。'],
  'official-kakunodate-property':['仙北市角館伝統的建造物群保存地区','仙北市','1976年選定、屋敷割と門・塀・樹木。'],
  'official-iimoriyama-graves':['会津飯盛山白虎隊士墳墓域','会津若松市','墓域の登録記念物指定と追悼の石造物。'],
  'official-iimoriyama-landscape':['飯盛山と白虎隊をはじめとする先人慰霊にみる歴史的風致','会津若松市','1868年の白虎隊、1796年建立のさざえ堂、眺望。'],
};
for(const [name,,official] of edits)for(const ref of official){if(registry.sources.some(item=>item.id===ref.id))continue;const [title,publisher,note]=notes[ref.id];registry.sources.push({id:ref.id,type:'official',title,publisher,url:ref.url,notes:note,usedFor:[name]});}
const compact=JSON.stringify(registry,null,2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g,(_whole,key,contents)=>`"${key}": [${JSON.parse(`[${contents}]`).map(item=>JSON.stringify(item)).join(', ')}]`);
fs.writeFileSync(registryTarget,compact+'\n');
