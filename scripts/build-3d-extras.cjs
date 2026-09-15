/* Static, indexable sections for the Gunkanjima 3D pages: the building list (from the model),
   questions people ask, and the audio guide's full transcript. Also the matching structured data.
   Used by build-3d-pages.cjs; everything here is plain HTML so search engines see it without WebGL. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const model=JSON.parse(fs.readFileSync(path.join(root,'3d','gunkanjima-model.json'),'utf8'));
const SITE='https://japantimeatlas.com';
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const FACILITY={
 '端島小中学校':{en:'Hashima Elementary and Junior High School (Building 70)',ko:'하시마 초·중학교(70호동)','zh-Hans':'端岛中小学校（70号楼）','zh-Hant':'端島中小學校（70號樓）'},
 '端島小中学校体育館':{en:'School gymnasium (Building 71)',ko:'학교 체육관(71호동)','zh-Hans':'学校体育馆（71号楼）','zh-Hant':'學校體育館（71號樓）'},
 'ちどり荘':{en:'Chidori-so (teachers’ housing)',ko:'치도리소(교원 주택)','zh-Hans':'千鸟庄（教员住宅）','zh-Hant':'千鳥莊（教員住宅）'},
 '総合事務所':{en:'General office (former winding-engine house)',ko:'종합사무소(옛 권양기실)','zh-Hans':'综合事务所（旧卷扬机房）','zh-Hant':'綜合事務所（舊捲揚機房）'},
 '第二坑捲':{en:'No. 2 shaft winding house',ko:'제2갱 권양기실','zh-Hans':'第二竖井卷扬机房','zh-Hant':'第二豎井捲揚機房'},
 '会社事務所':{en:'Company office',ko:'회사 사무소','zh-Hans':'公司办公楼','zh-Hant':'公司辦公樓'},
 '会議室':{en:'Meeting room',ko:'회의실','zh-Hans':'会议室','zh-Hant':'會議室'},
 '資材倉庫':{en:'Materials store',ko:'자재 창고','zh-Hans':'材料仓库','zh-Hant':'材料倉庫'},
 '貯水槽':{en:'Water tank',ko:'저수조','zh-Hans':'储水槽','zh-Hant':'儲水槽'},
 '仕上工場':{en:'Finishing workshop',ko:'마무리 공장','zh-Hans':'精整车间','zh-Hant':'精整車間'},
 '変電所':{en:'Substation',ko:'변전소','zh-Hans':'变电所','zh-Hant':'變電所'},
 'オリバーフィルター室':{en:'Oliver filter house',ko:'올리버 필터실','zh-Hans':'奥利弗过滤室','zh-Hant':'奧利弗過濾室'},
 'ドルシックナー':{en:'Dorr thickener',ko:'도르 시크너','zh-Hans':'多尔浓缩池','zh-Hant':'多爾濃縮池'},
 '扇風機圧気機室':{en:'Fan and compressor house',ko:'송풍기·압축기실','zh-Hans':'风机压气机室','zh-Hant':'風機壓氣機室'},
 '二坑口桟橋':{en:'No. 2 pithead gantry',ko:'제2갱구 잔교','zh-Hans':'二坑口栈桥','zh-Hant':'二坑口棧橋'},
 '消火タンク':{en:'Fire-fighting tank',ko:'소화 탱크','zh-Hans':'消防水箱','zh-Hant':'消防水箱'},
 '四坑上家':{en:'No. 4 shaft headframe house',ko:'제4갱 상옥','zh-Hans':'四号井井口房','zh-Hant':'四號井井口房'},
 '圧気機室':{en:'Compressor house',ko:'압축기실','zh-Hans':'压气机室','zh-Hant':'壓氣機室'},
 '浮選機室':{en:'Flotation house',ko:'부유선광실','zh-Hans':'浮选机室','zh-Hant':'浮選機室'},
 '第四竪坑風洞':{en:'No. 4 shaft air duct',ko:'제4수갱 풍동','zh-Hans':'第四竖井风洞','zh-Hant':'第四豎井風洞'},
 '起重機':{en:'Crane',ko:'기중기','zh-Hans':'起重机','zh-Hant':'起重機'},
 '詰込室':{en:'Loading room',ko:'적재실','zh-Hans':'装载室','zh-Hant':'裝載室'},
 'ブロワー室':{en:'Blower house',ko:'블로어실','zh-Hans':'鼓风机室','zh-Hant':'鼓風機室'},
 'ベルトコンベアー':{en:'Belt conveyor',ko:'벨트 컨베이어','zh-Hans':'传送带','zh-Hant':'輸送帶'},
};
const USE={
 '端島神社':{en:'Hashima Shrine',ko:'하시마 신사','zh-Hans':'端岛神社','zh-Hant':'端島神社'},
 '職員社宅':{en:'Staff housing',ko:'직원 사택','zh-Hans':'职员宿舍','zh-Hant':'職員宿舍'},
 '職員社宅（幹部）':{en:'Senior staff housing',ko:'간부 직원 사택','zh-Hans':'干部职员宿舍','zh-Hant':'幹部職員宿舍'},
 '町営住宅（教員）':{en:'Town housing (teachers)',ko:'읍영 주택(교원)','zh-Hans':'町营住宅（教员）','zh-Hant':'町營住宅（教員）'},
 '鉱員社宅（日給社宅）':{en:'Miners’ housing (daily-wage blocks)',ko:'광부 사택(일급 사택)','zh-Hans':'矿工宿舍（日薪宿舍）','zh-Hant':'礦工宿舍（日薪宿舍）'},
 '鉱員社宅':{en:'Miners’ housing',ko:'광부 사택','zh-Hans':'矿工宿舍','zh-Hant':'礦工宿舍'},
 '町営住宅（かもめ荘）・町役場':{en:'Town housing (Kamome-so) and town office',ko:'읍영 주택(가모메소)·읍사무소','zh-Hans':'町营住宅（海鸥庄）、町公所','zh-Hant':'町營住宅（海鷗莊）、町公所'},
 '鉱員社宅（のち下請飯場）':{en:'Miners’ housing, later contractors’ lodging',ko:'광부 사택(후에 하청 숙소)','zh-Hans':'矿工宿舍（后为分包工住所）','zh-Hant':'礦工宿舍（後為分包工住所）'},
 '町立端島公民館':{en:'Community hall',ko:'공민관','zh-Hans':'公民馆','zh-Hant':'公民館'},
 '鉱員社宅（報国寮）':{en:'Miners’ housing (Hokoku-ryo)',ko:'광부 사택(호코쿠료)','zh-Hans':'矿工宿舍（报国寮）','zh-Hant':'礦工宿舍（報國寮）'},
 '鉱員合宿（啓明寮）':{en:'Miners’ dormitory (Keimei-ryo)',ko:'광부 합숙소(게이메이료)','zh-Hans':'矿工宿舍（启明寮）','zh-Hant':'礦工宿舍（啟明寮）'},
 '鉱員合宿':{en:'Miners’ dormitory',ko:'광부 합숙소','zh-Hans':'矿工合宿','zh-Hant':'礦工合宿'},
 '隔離病棟':{en:'Isolation ward',ko:'격리 병동','zh-Hans':'隔离病房','zh-Hant':'隔離病房'},
 '高島鉱業所端島病院':{en:'Hashima Hospital',ko:'하시마 병원','zh-Hans':'端岛医院','zh-Hant':'端島醫院'},
 '町立端島小中学校':{en:'Elementary and junior high school',ko:'초·중학교','zh-Hans':'中小学校','zh-Hant':'中小學校'},
 '体育館（1階は武道場・食堂）':{en:'Gymnasium (dojo and canteen below)',ko:'체육관(1층은 무도장·식당)','zh-Hans':'体育馆（1层为武道场、食堂）','zh-Hant':'體育館（1樓為武道場、食堂）'},
 '教員用住宅':{en:'Teachers’ housing',ko:'교원 주택','zh-Hans':'教员住宅','zh-Hant':'教員住宅'},
 '総合事務所（旧捲座）':{en:'General office (former winding-engine house)',ko:'종합사무소(옛 권양기실)','zh-Hans':'综合事务所（旧卷扬机房）','zh-Hant':'綜合事務所（舊捲揚機房）'},
 '第二竪坑の捲座':{en:'Winding house of No. 2 shaft',ko:'제2수갱 권양기실','zh-Hans':'第二竖井卷扬机房','zh-Hant':'第二豎井捲揚機房'},
 '貯水槽':{en:'Water tank (undersea pipeline of 1957)',ko:'저수조','zh-Hans':'储水槽','zh-Hant':'儲水槽'},
};
const S={
 en:{h:'Every building on Gunkanjima: completion year, storeys and use',intro:'The reconstruction draws these buildings. Numbers follow the island’s own numbering; the list comes from the building list on Japanese Wikipedia and is checked against the 1962 aerial photograph. Tap a name on the model for the same facts and, where one exists, a photograph.',cols:['Building','Completed','Storeys','Use','Collapsed'],bld:n=>'Building '+n,unknown:'—',c2000:'by 2010',faqH:'Questions people ask about Gunkanjima',trH:'Audio guide: full transcript',trNote:'The English episode (about 9 minutes). Two synthetic voices; the script was written from the sources on this page.'},
 ja:{h:'軍艦島の建物一覧（竣工年・階数・用途）',intro:'この復元模型に描いている建物です。番号は島で使われていた号棟番号で、一覧はWikipedia「端島」の建物一覧をもとに1962年の空中写真と照合しました。模型の建物名を押すと同じ諸元と、あれば実写が出ます。',cols:['建物','竣工','階数','用途','崩壊'],bld:n=>n+'号棟',unknown:'—',c2000:'2010年までに',faqH:'軍艦島についてよくある質問',trH:'音声ガイドの全文',trNote:'日本語の回（約10分）。声は合成音声で、台本はこのページの出典から書いています。'},
 ko:{h:'군함도의 건물 목록(준공년·층수·용도)',intro:'이 복원 모형에 그린 건물입니다. 번호는 섬에서 쓰던 동 번호이며, 목록은 일본어 위키백과 「端島」의 건물 목록을 1962년 항공사진과 대조한 것입니다. 모형의 건물 이름을 누르면 같은 정보와, 있을 경우 실제 사진이 나옵니다.',cols:['건물','준공','층수','용도','붕괴'],bld:n=>n+'호동',unknown:'—',c2000:'2010년까지',faqH:'군함도에 대해 자주 묻는 질문',trH:'음성 가이드 전문(영어)',trNote:'영어 에피소드(약 8분). 합성 음성이며 대본은 이 페이지의 출처로 썼습니다.'},
 'zh-Hans':{h:'军舰岛建筑一览（竣工年、层数、用途）',intro:'这是复原模型中绘制的建筑。编号是岛上原有的楼号，列表以日语维基百科“端島”的建筑列表为准，并与1962年航拍照片核对。点按模型上的建筑名可看到相同信息，有实景照片的也会显示。',cols:['建筑','竣工','层数','用途','倒塌'],bld:n=>n+'号楼',unknown:'—',c2000:'2010年前',faqH:'关于军舰岛的常见问题',trH:'音频导览全文（英语）',trNote:'英语一集（约9分钟）。合成语音，稿子根据本页出处撰写。'},
 'zh-Hant':{h:'軍艦島建築一覽（竣工年、層數、用途）',intro:'這是復原模型中繪製的建築。編號是島上原有的樓號，列表以日語維基百科「端島」的建築列表為準，並與1962年航空照片核對。點按模型上的建築名可看到相同資訊，有實景照片的也會顯示。',cols:['建築','竣工','層數','用途','倒塌'],bld:n=>n+'號樓',unknown:'—',c2000:'2010年前',faqH:'關於軍艦島的常見問題',trH:'語音導覽全文（英語）',trNote:'英語一集（約9分鐘）。合成語音，稿子根據本頁出處撰寫。'},
};
const FAQ={
 en:[
  ['What is Gunkanjima?','Gunkanjima (“Battleship Island”) is the nickname of Hashima, a coal-mining island about 15 km off Nagasaki. It is roughly 480 m long and 160 m wide, about 6.3 hectares, and was enlarged six times behind a sea wall between the late Meiji years and 1931. In 1960 the census counted 5,267 people living on it.'],
  ['When was Gunkanjima abandoned?','The Mitsubishi mine closed on 15 January 1974 and the last residents left on 20 April 1974. The island has been uninhabited since.'],
  ['What is Building No. 30?','Building No. 30, completed in 1916, is usually described as Japan’s first high-rise apartment block in reinforced concrete. It opened with four storeys and was raised to seven, with a courtyard in the middle.'],
  ['Can you visit Gunkanjima?','Yes. Landing tours from Nagasaki port have run since 22 April 2009. Visitors stay on a walkway in the south-east of the island, and landings are cancelled when waves, wind or visibility exceed the city’s limits.'],
  ['Is Gunkanjima a World Heritage Site?','Hashima is one of the Sites of Japan’s Meiji Industrial Revolution, inscribed on the World Heritage List on 5 July 2015. At the inscription Japan’s representative said that in the 1940s many Koreans and others were brought against their will and forced to work under harsh conditions at some of the sites.'],
  ['How was this 3D model made?','Heights were measured from pairs of aerial photographs (1962 and 2010) by stereo matching; the buildings are then drawn from their outlines, storey counts and completion years, on GSI’s 5 m elevation model. Façades are drawn by type, not photographed. Its limits are listed under “What to keep in mind” below.'],
 ],
 ja:[
  ['軍艦島とは？','軍艦島は長崎港から約15kmの沖にある炭鉱の島・端島（はしま）の通称です。南北約480m、東西約160m、面積約6.3haで、明治の終わりから1931年まで6回の埋め立てで護岸の内側に広げられました。1960年の国勢調査では5,267人が住んでいました。'],
  ['軍艦島はいつから無人ですか？','三菱の炭鉱は1974年1月15日に閉山し、同年4月20日に最後の住民が島を離れました。それ以来無人です。'],
  ['30号棟とは？','1916年に完成した30号棟は、日本初の鉄筋コンクリート造高層アパートとされています。完成時は4階建てで、のちに7階まで増築されました。中央に中庭があります。'],
  ['軍艦島に上陸できますか？','できます。長崎港からの上陸ツアーが2009年4月22日から運航しています。島では南東側の見学通路の中だけを歩き、波・風・視程が長崎市の基準を超える日は上陸できません。'],
  ['軍艦島は世界遺産ですか？','端島は「明治日本の産業革命遺産」の構成資産として、2015年7月5日に世界遺産に登録されました。登録時に日本政府代表は、1940年代に一部の施設で多くの朝鮮半島出身者などが意思に反して連れて来られ、厳しい環境の下で働かされたと述べています。'],
  ['この3Dはどうやって作ったのですか？','1962年と2010年の空中写真をそれぞれ2枚ずつ画像照合して高さを測り、建物は輪郭・階数・竣工年から角柱として描き、国土地理院の5mメッシュ標高の地面に置いています。壁面は種類ごとに描いた模式で、写真ではありません。限界はこのページの「見るときの注意」に書いています。'],
 ],
 ko:[
  ['군함도란?','군함도는 나가사키항에서 약 15km 떨어진 탄광 섬 하시마의 별칭입니다. 남북 약 480m, 동서 약 160m, 면적 약 6.3ha로, 메이지 말기부터 1931년까지 여섯 차례 매립해 방파제 안쪽으로 넓혔습니다. 1960년 국세조사에서는 5,267명이 살고 있었습니다.'],
  ['군함도는 언제부터 무인도입니까?','미쓰비시 탄광은 1974년 1월 15일에 폐광했고, 같은 해 4월 20일에 마지막 주민이 섬을 떠났습니다. 그 뒤로 무인도입니다.'],
  ['30호동이란?','1916년에 완공된 30호동은 일본 최초의 철근콘크리트 고층 아파트로 알려져 있습니다. 완공 당시 4층이었고 뒤에 7층까지 증축되었으며 가운데에 중정이 있습니다.'],
  ['군함도에 상륙할 수 있습니까?','가능합니다. 나가사키항에서 출발하는 상륙 투어가 2009년 4월 22일부터 운항합니다. 섬에서는 남동쪽 견학 통로 안만 걷고, 파도·바람·시정이 나가사키시 기준을 넘는 날은 상륙할 수 없습니다.'],
  ['군함도는 세계유산입니까?','하시마는 「메이지 일본의 산업혁명 유산」의 구성 자산으로 2015년 7월 5일 세계유산에 등재되었습니다. 등재 당시 일본 정부 대표는 1940년대에 일부 시설에서 많은 한반도 출신자 등이 본인의 의사에 반해 끌려와 가혹한 환경에서 일해야 했다고 밝혔습니다.'],
  ['이 3D는 어떻게 만들었습니까?','1962년과 2010년의 항공사진을 각각 두 장씩 영상 정합해 높이를 재고, 건물은 윤곽·층수·준공년으로 각기둥을 그려 일본 국토지리원 5m 표고의 지면에 놓았습니다. 벽면은 종류별로 그린 모식도이며 사진이 아닙니다. 한계는 이 페이지의 「볼 때 유의할 점」에 적었습니다.'],
 ],
 'zh-Hans':[
  ['军舰岛是什么？','军舰岛是长崎港外约15公里处煤矿岛“端岛”的俗称。南北约480米、东西约160米，面积约6.3公顷，从明治末年到1931年经六次填海在护岸内扩建而成。1960年人口普查有5,267人居住。'],
  ['军舰岛从何时起无人居住？','三菱的煤矿于1974年1月15日关闭，同年4月20日最后一批居民离岛。此后一直无人居住。'],
  ['30号楼是什么？','1916年建成的30号楼被认为是日本第一座钢筋混凝土高层公寓。建成时为4层，后加建到7层，中间有天井。'],
  ['可以登上军舰岛吗？','可以。从长崎港出发的登岛团自2009年4月22日起运营。在岛上只能走东南侧的参观通道，浪高、风速或能见度超过长崎市标准的日子不能登岛。'],
  ['军舰岛是世界遗产吗？','端岛作为“明治日本的产业革命遗产”的组成部分，于2015年7月5日列入世界遗产。列入时日本政府代表表示，1940年代在部分设施有许多朝鲜半岛出身者等人违背本人意愿被带来、在严酷环境下被迫劳动。'],
  ['这个3D是怎么做的？','用1962年和2010年各两张航拍照片做影像匹配测出高度，建筑按轮廓、层数和竣工年画成棱柱，放在日本国土地理院5米高程的地面上。墙面是按类型画的示意图，不是照片。局限见本页的“注意事项”。'],
 ],
 'zh-Hant':[
  ['軍艦島是什麼？','軍艦島是長崎港外約15公里處煤礦島「端島」的俗稱。南北約480公尺、東西約160公尺，面積約6.3公頃，從明治末年到1931年經六次填海在護岸內擴建而成。1960年人口普查有5,267人居住。'],
  ['軍艦島從何時起無人居住？','三菱的煤礦於1974年1月15日關閉，同年4月20日最後一批居民離島。此後一直無人居住。'],
  ['30號樓是什麼？','1916年建成的30號樓被認為是日本第一座鋼筋混凝土高層公寓。建成時為4層，後加建到7層，中間有天井。'],
  ['可以登上軍艦島嗎？','可以。從長崎港出發的登島行程自2009年4月22日起營運。在島上只能走東南側的參觀通道，浪高、風速或能見度超過長崎市標準的日子不能登島。'],
  ['軍艦島是世界遺產嗎？','端島作為「明治日本的產業革命遺產」的組成部分，於2015年7月5日列入世界遺產。列入時日本政府代表表示，1940年代在部分設施有許多朝鮮半島出身者等人違反本人意願被帶來、在嚴酷環境下被迫勞動。'],
  ['這個3D是怎麼做的？','用1962年和2010年各兩張航空照片做影像比對測出高度，建築按輪廓、層數和竣工年畫成稜柱，放在日本國土地理院5公尺高程的地面上。牆面是按類型畫的示意圖，不是照片。局限見本頁的「注意事項」。'],
 ],
};
function bname(name,code){
 const m=/^(\d+)号棟$/.exec(name);
 if(m)return S[code].bld(m[1]);
 if(code==='ja')return name;
 return (FACILITY[name]&&FACILITY[name][code])||name;
}
function buse(use,code){ if(!use)return ''; if(code==='ja')return use; return (USE[use]&&USE[use][code])||use; }
function table(code){
 const t=S[code];
 const rows=model.buildings.filter(b=>b.name&&(b.built||b.use)).sort((a,b)=>{
  const na=/^(\d+)号棟$/.exec(a.name),nb=/^(\d+)号棟$/.exec(b.name);
  if(na&&nb)return +na[1]-+nb[1]; if(na)return -1; if(nb)return 1; return a.name.localeCompare(b.name,'ja');
 });
 const seen=new Set();
 let html=`<section>\n<h2 id="buildings">${esc(t.h)}</h2>\n<p>${esc(t.intro)}</p>\n<div class="table-wrap"><table class="bld-table">\n<thead><tr>${t.cols.map(c=>'<th>'+esc(c)+'</th>').join('')}</tr></thead>\n<tbody>\n`;
 for(const b of rows){
  if(seen.has(b.name))continue; seen.add(b.name);
  const built=b.built?String(b.built)+(b.builtNote&&code==='ja'?'<small>'+esc(b.builtNote)+'</small>':''):t.unknown;
  const gone=b.gone?(b.gone===2000?t.c2000:String(b.gone)):'';
  html+=`<tr id="b-${esc(b.name.replace(/[^\w一-鿿ぁ-ヿ]/g,''))}"><th scope="row">${esc(bname(b.name,code))}</th><td>${built}</td><td>${esc(String(b.storeys))}</td><td>${esc(buse(b.use,code))}</td><td>${esc(gone)}</td></tr>\n`;
 }
 html+='</tbody></table></div>\n</section>\n';
 return html;
}
function faq(code){
 const t=S[code];
 return `<section>\n<h2 id="faq">${esc(t.faqH)}</h2>\n`+FAQ[code].map(([q,a])=>`<h3>${esc(q)}</h3>\n<p>${esc(a)}</p>\n`).join('')+'</section>\n';
}
function transcript(code){
 const t=S[code],lang=code==='ja'?'ja':'en';
 const tr=JSON.parse(fs.readFileSync(path.join(root,'3d','audio','gunkanjima-podcast-'+lang+'.json'),'utf8'));
 let html=`<section>\n<h2 id="transcript">${esc(t.trH)}</h2>\n<p class="pod-note">${esc(t.trNote)}</p>\n<details class="transcript"><summary>${esc(tr.title)}</summary>\n`;
 let ci=0;
 for(let i=0;i<tr.lines.length;i++){
  const ln=tr.lines[i];
  while(ci<tr.chapters.length&&tr.chapters[ci].start<=ln.start+0.01){html+=`<h3>${esc(tr.chapters[ci].title)}</h3>\n`;ci++;}
  html+=`<p><b>${esc(tr.names[ln.s])}</b> ${esc(ln.t)}</p>\n`;
 }
 return html+'</details>\n</section>\n';
}
module.exports={
 html:l=>table(l.code)+faq(l.code)+transcript(l.code),
 ld:l=>[{'@type':'FAQPage','mainEntity':FAQ[l.code].map(([q,a])=>({'@type':'Question','name':q,'acceptedAnswer':{'@type':'Answer','text':a}}))},
  {'@type':'ImageObject','contentUrl':SITE+'/3d/island-from-sea.jpg','url':SITE+'/3d/island-from-sea.jpg','name':'Gunkanjima (Hashima Island) from the sea','license':'https://creativecommons.org/licenses/by-sa/3.0/','acquireLicensePage':'https://commons.wikimedia.org/wiki/File:Gunkanjima_Island_from_the_Sea.jpg','creditText':'Jordy Meow, CC BY-SA 3.0','creator':{'@type':'Person','name':'Jordy Meow'},'copyrightNotice':'Jordy Meow'}],
 css:'.table-wrap{overflow-x:auto;margin:.5rem 0 1rem}.bld-table{border-collapse:collapse;font-size:.9rem;min-width:36rem}.bld-table th,.bld-table td{text-align:left;padding:.3rem .6rem .3rem 0;border-bottom:1px solid #e2ded3;vertical-align:top}.bld-table thead th{color:#56645d;font-weight:600}.bld-table tbody th{font-weight:600;white-space:nowrap}.bld-table small{display:block;color:#7a857e;font-weight:400}.transcript{border:1px solid #d3d8ce;border-radius:6px;padding:.5rem .9rem;background:#f4f2ec}.transcript summary{cursor:pointer;font-weight:600}.transcript h3{font-size:.95rem;margin:.9rem 0 .3rem}.transcript p{margin:.3rem 0;font-size:.93rem}'
};
