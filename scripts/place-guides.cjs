/* Long-form guides for the few places written up in depth (English and Japanese).
   Every factual sentence was checked against the source listed with it on 2026-09-14.
   Descriptions of the photographs come from the GSI tiles at zoom 16–17 and can be checked on the map.
   fieldNotes is for notes from an actual visit. Leave it empty rather than write one nobody made. */
const GSI_TILES={en:'GSI · Tile list: photo series, years and zoom levels',ja:'国土地理院 · 地理院タイル一覧（写真シリーズ・年代・ズームレベル）',url:'https://maps.gsi.go.jp/development/ichiran.html'};
const GSI_PHOTOS={en:'GSI · Aerial photographs and the Map and Aerial Photo Viewing Service',ja:'国土地理院 · 空中写真と地図・空中写真閲覧サービス',url:'https://www.gsi.go.jp/gazochosa/gazochosa41006.html'};
const src=(s,l)=>({label:s[l],url:s.url});

const labels={
 en:{why:'Why open this place',look:'On the map, step by step',dates:'Reading the photographs',visit:'Visiting',history:'History and responsibility',theme:'Same kind of place',field:'Field notes',sources:'Sources',checked:'Facts on this page were checked against these sources on 14 September 2026.'},
 ja:{why:'この場所を開く理由',look:'地図で順に見る',dates:'写真の読み方',visit:'訪ねるときに',history:'歴史と責任',theme:'同じ型の場所',field:'現地メモ',sources:'出典',checked:'このページの内容は、2026年9月14日にこれらの出典で確認しています。'}
};

const HIROSHIMA_SOURCES=[
 {en:'City of Hiroshima · Atomic Bomb Dome and its preservation',ja:'広島市 · 原爆ドームと保存の経緯（英語）',url:'https://www.city.hiroshima.lg.jp/english/peace/1029869/1009931.html'},
 {en:'City of Hiroshima FAQ · Why the Dome stayed standing (distance and height of the explosion)',ja:'広島市FAQ · 原爆ドームはなぜ崩れずに残ったのか',url:'https://www.city.hiroshima.lg.jp/faq/atomicbomb-peace/1001613/1028187/1002370.html'},
 {en:'City of Hiroshima FAQ · Atomic-bombed buildings still standing',ja:'広島市FAQ · 被爆建物は今も残っているのか',url:'https://www.city.hiroshima.lg.jp/faq/atomicbomb-peace/1001613/1028187/1002368.html'},
 {en:'City of Hiroshima · The Nakajima district, lost to the bomb (walking map)',ja:'広島市 · 平和記念公園めぐり 原爆で失われた街・中島地区をたずねて',url:'https://www.city.hiroshima.lg.jp/atomicbomb-peace/1036664/1021115/1003095.html'},
 GSI_TILES,GSI_PHOTOS
];
const HIMEJI_SOURCES=[
 {en:'Himeji Castle official site · Photographs of the Showa restoration',ja:'姫路城公式サイト · 姫路城・昭和の大修理写真',url:'https://www.city.himeji.lg.jp/castle/category/10-2-2-0-0-0-0-0-0-0.html'},
 {en:'Himeji Castle official site · Visitor information',ja:'姫路城公式サイト · ご利用案内',url:'https://www.city.himeji.lg.jp/castle/0000007671.html'},
 {en:'Cultural Heritage Online (Agency for Cultural Affairs) · Himeji Castle main keep',ja:'文化遺産オンライン（文化庁） · 姫路城大天守',url:'https://online.bunka.go.jp/heritages/detail/147461'},
 {en:'Peace Memorial Museum (Ministry of Internal Affairs and Communications) · Himeji Castle and recovery from the air raids',ja:'平和祈念展示資料館（総務省委託） · 焼け跡からの復興 姫路城と手柄山慰霊塔',url:'https://www.heiwakinen.go.jp/kikaku/20210820-0900/'},
 GSI_TILES,GSI_PHOTOS
];
const ANEYOSHI_SOURCES=[
 {en:'GSI · Natural disaster memorial monuments',ja:'国土地理院 · 自然災害伝承碑',url:'https://www.gsi.go.jp/bousaichiri/denshouhi.html'},
 {en:'Miyako City Disaster Archive · The lesson of Omoe-Aneyoshi',ja:'宮古市災害資料アーカイブ · 重茂姉吉地区の教訓「ここより下に家を建てるな」',url:'https://miyako-archive.irides.tohoku.ac.jp/tatakai/showasanriku/4/'},
 GSI_TILES
];

const guides={
 hiroshima:{schemaType:'TouristAttraction',
  theme:{ids:['nagasaki'],en:'Cities rebuilt after an atomic bombing',ja:'原爆のあとに復興した街',notes:{nagasaki:{en:'Its old photograph is from the 1960s, after rebuilding had begun.',ja:'昔の写真は、復興が進んだ1960年代のものです。'}}},
  en:{
   why:['Most photographs of Hiroshima show the Atomic Bomb Dome on its own. From above you can also see what stood beside it: the Nakajima district, one of the city’s main commercial districts before the bombing, on the island that is now Peace Memorial Park.',
    'The rivers make the comparison work. Their shape has barely changed, so line the two photographs up on the water first, then look at the land.'],
   look:['Aioi Bridge, where the river divides. Its T shape is clear in both photographs: the long arm crosses the river and the short stem runs south onto the island.',
    'The Atomic Bomb Dome, on the east bank of the Motoyasu River just south-east of the bridge. The City of Hiroshima says the bomb exploded about 160 metres south-east of the building, at a height of about 600 metres.',
    'The Nakajima district: the wedge of land south of the bridge, between the Motoyasu and Honkawa rivers. In the 1945–1950 photograph it is mostly bare ground with a few small buildings. Today it lies under the trees of Peace Memorial Park.',
    'The blocks east of the Dome. The old photograph shows wide gaps between the buildings; now the same blocks are almost fully built up.'],
   dates:['1945–1950 is the date range of the whole GSI photo series, not the day this frame was taken. The ground around the Dome is largely cleared, so the picture shows Hiroshima after the bombing. To find the date of an individual photograph, search GSI’s Map and Aerial Photo Viewing Service.',
    'GSI publishes the old series up to zoom level 17. Zoom in further and the image only gets bigger, not sharper.',
    'The Dome was not the only building left standing. The city counts 86 atomic-bombed buildings still standing within 5 km of the hypocentre, the Dome among them (as of 1 March 2022).'],
   visit:['The Dome and the park are a few minutes apart on foot: from the Dome, cross Aioi Bridge and you are on the island.',
    'The ruin is there because the city chose to keep it. Hiroshima City Council resolved to preserve it in July 1966, and the first preservation work was carried out in 1967.',
    'This is a place of mourning as well as a park. Keep your voice down, and follow any signs about photography or ceremonies.'],
   sources:HIROSHIMA_SOURCES.map(s=>src(s,'en')),fieldNotes:[]},
  ja:{
   why:['原爆ドームの写真は、たいていドームだけを写しています。上から見ると、その隣に何があったかも分かります。被爆前は市内有数の繁華街だった中島地区で、いまは平和記念公園になっている中州です。',
    '見くらべの手がかりは川です。流れの形はほとんど変わっていないので、まず川で二枚の写真を合わせ、それから陸を見てください。'],
   look:['川が分かれるところに架かる相生橋。T字の形が昔と今のどちらの写真にもはっきり写っています。長い方が川を渡り、短い方が南の中州へ下りています。',
    '原爆ドームは、相生橋の南東、元安川の東岸にあります。広島市によると、原子爆弾はドームの南東約160m、高さ約600mで炸裂しました。',
    '中島地区は、相生橋の南、元安川と本川にはさまれた三角形の土地です。1945〜1950年の写真ではほとんどが更地で、小さな建物が点々とあるだけ。今の写真では平和記念公園の木々に覆われています。',
    'ドームの東側の街区。昔の写真では建物と建物のあいだが大きく空いていますが、今はほぼ隙間なく建っています。'],
   dates:['「1945〜1950年」は国土地理院の写真シリーズ全体の期間で、この一枚の撮影日ではありません。ドームの周りがほとんど更地になっているので、被爆後の広島だと分かります。個々の写真の撮影日は、国土地理院の「地図・空中写真閲覧サービス」で調べられます。',
    '昔の写真シリーズはズームレベル17まで公開されています。それ以上拡大しても、画像が大きくなるだけで細かくはなりません。',
    '残った建物は原爆ドームだけではありません。広島市によると、爆心地から5km以内には、原爆ドームを含めて86件の被爆建物が残っています（2022年3月1日時点）。'],
   visit:['原爆ドームと公園は歩いて数分です。ドームの側から相生橋を渡ると、そのまま中州に入れます。',
    'ドームは、残すと決めて残された建物です。広島市議会が保存を決議したのは1966年7月、最初の保存工事は1967年に行われました。',
    'ここは公園であると同時に、慰霊の場所です。静かに歩き、撮影や式典についての案内があれば従ってください。'],
   sources:HIROSHIMA_SOURCES.map(s=>src(s,'ja')),fieldNotes:[]}
 },
 himeji:{schemaType:'LandmarksOrHistoricalBuildings',
  theme:{ids:['osaka','okayama','nagoya','kanazawa','shuri'],en:'Castles and their moats',ja:'城と堀'},
  en:{
   why:['Himeji Castle is known for coming through the war. Two large air raids in June and July 1945 left the city centre in ashes, and the castle survived.',
    'The castle has changed in other ways. In the Showa restoration of 1956–1964 the main keep was taken down and put back together, and the 1960s photographs come from around the end of that work.'],
   look:['The inner moat. Its curve to the north and west of the keep is the same in both photographs, which makes it the easiest thing to line up.',
    'Sannomaru Square, the open lawn just south of the keep. In the 1960s photograph the same ground is covered with rows of large buildings.',
    'The keep itself. A temporary cover building was put over it at the start of the restoration, and work on the keep complex finished at the end of March 1964. Depending on when the frame was taken, the old photograph may show repair work, so zoom in and look.'],
   dates:['1961–1969 is the date range of the GSI series. The map does not show the date of this particular frame; GSI’s Map and Aerial Photo Viewing Service can help you find it.',
    'The old photographs stop at zoom level 17.'],
   visit:['The castle is open from 9 a.m. to 5 p.m., with last entry at 4 p.m., and closed on 29 and 30 December. Check the official site before you go, as arrangements can change.',
    'The stairs inside the keep and turrets are very steep and narrow. There are handrails but no lifts, and the official site says wheelchair users cannot make the visit on their own.',
    'The main keep is thought to have been largely complete by the end of 1609, under Ikeda Terumasa.'],
   sources:HIMEJI_SOURCES.map(s=>src(s,'en')),fieldNotes:[]},
  ja:{
   why:['姫路城は、戦災を免れた城として知られています。1945年6月と7月の2度の大きな空襲で市街地は焦土になりましたが、城は焼け残りました。',
    '城そのものも変わっています。1956年から1964年の「昭和の大修理」で大天守はいったん解体され、組み直されました。1960年代の写真は、その工事が終わるころのものです。'],
   look:['内堀。天守の北から西へ回り込む曲線は昔も今も同じ形で、二枚の写真を合わせるいちばんの目印になります。',
    '天守のすぐ南にある三の丸広場の芝生。1960年代の写真では、同じ場所に大きな建物が何棟も並んでいます。',
    '大天守そのもの。昭和の大修理ではまず天守に素屋根（工事用の覆い屋）を架け、天守群の工事は1964年3月末に終わりました。撮影の時期によっては修理中の姿かもしれないので、拡大して確かめてください。'],
   dates:['「1961〜1969年」は写真シリーズの期間です。この一枚の撮影日は地図には出ないので、国土地理院の「地図・空中写真閲覧サービス」で調べてください。',
    '昔の写真はズームレベル17までです。'],
   visit:['開城時間は9時〜17時（最終入城は16時）、休城日は12月29日・30日です。変わることもあるので、出かける前に公式サイトで確認してください。',
    '天守や櫓の中は、とても急で狭い階段です。手すりはありますがエレベーターはなく、公式サイトによると車いすの方が単独で見学することはできません。',
    '大天守は、池田輝政によって慶長14年（1609年）末にはおおむね完成したと考えられています。'],
   sources:HIMEJI_SOURCES.map(s=>src(s,'ja')),fieldNotes:[]}
 },
 aneyoshi:{schemaType:'LandmarksOrHistoricalBuildings',
  en:{
   why:['There is no photograph from the 1940s or 1960s for this hamlet, and this page does not depend on one. The record here is the stone: a warning, carved after the tsunami of 1933, about where not to build.',
    'According to GSI’s record, the hamlet was wiped out by tsunamis twice, with two survivors in 1896 and four in 1933. The families kept to the stone’s warning, and in March 2011 no houses were damaged.'],
   look:['The stone stands by the road below the houses, about 60 metres above sea level and some 800 metres from the shore, according to Miyako City’s disaster archive.',
    'On today’s photograph, follow the road up the valley. The houses sit on the slope above the stone, and the sea is well below.'],
   dates:['The map can compare this spot with a colour photograph from GSI’s 1974–1978 series, which shows the hamlet more than thirty years before 2011.',
    'The year the stone was put up is not certain. GSI records it as unknown, possibly 1934.'],
   visit:['Aneyoshi is a small hamlet where people live, not a tourist site. If you go to see the stone, keep to the road, park where you will not block anyone, and remember that this is someone’s home.',
    'This page is about disaster memory, not an evacuation map. For hazard and evacuation information, use Miyako City’s official guidance.',
    'The inscription, as GSI records it: 高き住居は児孫の和楽　想へ惨禍の大津浪　此処より下に家を建てるな. Roughly: high homes bring peace to our descendants; remember the disaster of the great tsunami; do not build houses below this point.',
    'Figures for 2011 differ between sources. Miyako City’s disaster archive gives a run-up height of 38.9 metres at Aneyoshi.'],
   sources:ANEYOSHI_SOURCES.map(s=>src(s,'en')),fieldNotes:[]},
  ja:{
   why:['この集落には1940年代や1960年代の航空写真がありません。でも、このページはそれに頼っていません。ここで記録を伝えているのは石です。1933年の津波のあと、家を建ててはいけない場所を刻んだ碑です。',
    '国土地理院の記録によると、姉吉の集落は津波で2度全滅し、生存者は1896年に2人、1933年に4人でした。人々は碑の教えを守り、2011年3月の東日本大震災では家屋に被害がありませんでした。'],
   look:['碑は家々より下、道路のそばに立っています。宮古市災害資料アーカイブによると、標高は約60m、海岸から約800mの場所です。',
    '今の写真で谷沿いの道をたどると、家々は碑より上の斜面にあり、海ははるか下にあります。'],
   dates:['地図では、国土地理院の1974〜1978年のカラー写真と見くらべられます。2011年より30年以上前の集落の姿です。',
    '碑が建てられた年ははっきりしていません。国土地理院の記録では「不明（1934？）」です。'],
   visit:['姉吉は人が暮らす小さな集落で、観光地ではありません。碑を見に行くときは道路から外れず、通行の妨げにならない場所に車を止めてください。ここは誰かの暮らしの場です。',
    'このページは災害の記憶を伝えるためのもので、避難経路図ではありません。災害や避難の情報は、宮古市の公式情報で確認してください。',
    '碑文（国土地理院の記録より）：「高き住居は児孫の和楽　想へ惨禍の大津浪　此処より下に家を建てるな」',
    '2011年の津波の数値は資料によって異なります。宮古市災害資料アーカイブは、姉吉での遡上高を38.9mとしています。'],
   sources:ANEYOSHI_SOURCES.map(s=>src(s,'ja')),fieldNotes:[]}
 }
};

const DOAI_SOURCES=[
 {en:'Gunma Prefecture official tourism site · Doai Station (6 March 2026)',ja:'群馬県観光公式サイト · 「日本一のモグラ駅」土合駅を探索（2026年3月6日）',url:'https://gunma-kanko.jp/features/334'},
 {en:'JR East · Doai Station information',ja:'JR東日本 · 駅の情報（土合駅）',url:'https://www.jreast.co.jp/estation/station/info.aspx?StationCd=1035'},
 {en:'JR East · Doai Station timetable',ja:'JR東日本 · 時刻表 土合駅',url:'https://timetables.jreast.co.jp/timetable/list1035.html'},
 {en:'JR East (JRE Media) · DOAI VILLAGE, the outdoor hotel at Doai Station',ja:'JREメディア · 土合駅直結のアウトドアホテル DOAI VILLAGE',url:'https://media.jreast.co.jp/articles/6208'},
 GSI_TILES
];
const HASHIMA_SOURCES=[
 {en:'Nagasaki City · Landing on Gunkanjima (landing criteria)',ja:'長崎市 · 軍艦島上陸について',url:'https://www.city.nagasaki.lg.jp/teian/31312.html'},
 {en:'Nagasaki City · Hashima (Gunkanjima) conservation fund',ja:'長崎市 · 端島（軍艦島）整備基金への寄附',url:'https://www.city.nagasaki.lg.jp/page/3927.html'},
 {en:'Nagasaki City tourism (at Nagasaki) · Hashima',ja:'長崎市公式観光サイト あっと!ながさき · 端島（軍艦島）',url:'https://www.at-nagasaki.jp/spot/51797'},
 {en:'Gunkanjima Concierge (tour operator) · About Gunkanjima',ja:'軍艦島コンシェルジュ · 軍艦島とは',url:'https://www.gunkanjima-concierge.com/about/'},
 {en:'Ministry of Foreign Affairs of Japan · Inscription of the Sites of Japan’s Meiji Industrial Revolution (2015)',ja:'外務省 · 明治日本の産業革命遺産の世界遺産登録（2015年・英語）',url:'https://www.mofa.go.jp/press/release/press2e_000009.html'},
 GSI_TILES
];

const liminalGuides={
 'doai-station':{schemaType:'TrainStation',
  theme:{ids:['l-musashino-kyogijomae'],en:'Other railway places on the map',ja:'地図にあるほかの鉄道の場所'},
  en:{title:'Doai Station: 486 Steps Down to an Underground Platform',
   description:'Doai is a working JR East station in Gunma whose northbound platform is about 70 m underground, 486 steps down. What the map shows, how many trains stop, and what to know before you go.',
   why:['Doai is a working JR East station on the Joetsu Line, in Minakami, Gunma. The platform for trains towards Echigo-Yuzawa and Nagaoka is about 70 metres underground, and you reach it on foot: 462 steps down to the platform plus 24 along the connecting passage, 486 in all.',
    'Nothing here is abandoned. Trains run to a timetable. What feels strange is the length of the walk between the ticket gate and the train.'],
   look:['The map shows the station building beside the road. The northbound platform never appears, because it is inside the mountain.',
    'There is no photograph from the 1940s or 1960s here. The map compares today’s image with a colour photograph from GSI’s 1974–1978 series.'],
   visit:['Allow about ten minutes to walk between the station building and the underground platform, according to Gunma Prefecture’s official tourism site.',
    'Trains are few: about five each way a day on JR East’s September 2026 timetable. Check the timetable before you travel and leave time for the stairs.',
    'The station is unstaffed. Kissaten Mogura, a café in the renovated former station office, opened in 2020, and DOAI VILLAGE, an outdoor hotel with a sauna, is connected to the station.',
    'There is no car park at the station; the prefecture’s tourism site asks visitors to come by train.'],
   sources:DOAI_SOURCES.map(s=>src(s,'en')),fieldNotes:[]},
  ja:{heading:'土合駅を訪ねる前に',
   why:['土合駅は、群馬県みなかみ町にあるJR東日本上越線の現役の駅です。越後湯沢・長岡方面の下りホームは地下約70mにあり、そこまでは歩いて下ります。ホームまでの階段が462段、連絡通路の24段と合わせて486段です。',
    '廃墟ではありません。列車は時刻表どおりに来ます。不思議なのは、改札から列車までの道のりの長さです。'],
   look:['地図には道路沿いの駅舎が写っています。下りホームは山の中にあるので、写真には一度も出てきません。',
    'ここには1940年代や1960年代の写真はなく、今の写真と国土地理院の1974〜1978年のカラー写真を見くらべます。'],
   visit:['群馬県の観光公式サイトによると、駅舎から地下のホームまでは約10分です。',
    '列車は少なく、JR東日本の2026年9月の時刻表で上下とも一日5本ほどです。出かける前に時刻表を確認し、階段を歩く時間も見ておいてください。',
    '無人駅です。旧駅務室を改装した「喫茶モグラ」が2020年に開店し、サウナのあるアウトドアホテル「DOAI VILLAGE」が駅に直結しています。',
    '駅に駐車場はなく、群馬県の観光サイトは列車での来訪を案内しています。'],
   sources:DOAI_SOURCES.map(s=>src(s,'ja')),fieldNotes:[]}
 },
 'hashima-island':{schemaType:'TouristAttraction',
  theme:{ids:['l-ikeshima','l-yubari-hokkaido','l-shime-fukuoka'],en:'Other coal-mining places on the map',ja:'地図にあるほかの炭鉱の場所'},
  en:{title:'Hashima (Gunkanjima): What the Map Shows and How to Visit',
   description:'Hashima, or Gunkanjima, off Nagasaki: compare the 1960s aerial photograph with today, see how landing tours work, and read the island’s history, including wartime forced labour.',
   why:['Hashima, better known as Gunkanjima, is a former coal-mining island off Nagasaki. At its peak in 1960 about 5,300 people lived on an island of roughly 6.3 hectares. The mine closed in 1974, and nobody has lived there since.',
    'From above you can take in the whole island at once. That is the point of it: there was very little land, so people built upwards.'],
   look:['The outline. The island was enlarged by reclamation in six stages between 1893 and 1931, according to the tour operator Gunkanjima Concierge.',
    'The 1960s photograph (GSI series 1961–1969) is from the years when people still lived here: rooftops and bare concrete cover almost the whole island. In today’s photograph, trees and scrub have spread over large parts of it.',
    'Building No. 30 is described as the oldest high-rise reinforced-concrete building in Japan.'],
   visit:['You can land only on a tour. The public has been able to land since 2009, and you have to join a landing tour run by a boat operator from Nagasaki; the crossing takes about 40 minutes.',
    'Landings do not go ahead when wave height, wind speed or visibility are outside the limits set by Nagasaki City.',
    'On the island you stay within the visitor facilities. Fifty years after the mine closed, the buildings are deteriorating badly.'],
   history:['Hashima was designated a National Historic Site in 2014 and inscribed on the World Heritage List in July 2015 as part of the Sites of Japan’s Meiji Industrial Revolution.',
    'When the sites were inscribed, Japan’s delegation told the World Heritage Committee it would take measures so that people understand that many Koreans and others were ‘brought against their will and forced to work under harsh conditions in the 1940s’ at some of the sites. Hashima is one of the places where that history is remembered.'],
   sources:HASHIMA_SOURCES.map(s=>src(s,'en')),fieldNotes:[]},
  ja:{heading:'端島（軍艦島）を地図で読む',
   why:['端島は、軍艦島の名で知られる長崎沖の炭鉱の島です。最盛期の1960年には、面積およそ6.3ヘクタールの島に約5,300人が暮らしていました。1974年に閉山し、それ以来、誰も住んでいません。',
    '上から見ると、島全体が一度に見渡せます。そこにこの島の特徴があります。土地がほとんどないので、人は上へ建てていきました。'],
   look:['島の輪郭。ツアー事業者の軍艦島コンシェルジュによると、島は1893年から1931年まで6回の埋め立てで広げられました。',
    '1960年代の写真（1961〜1969年のシリーズ）は、まだ人が暮らしていた時期のものです。屋根とコンクリートが島のほぼ全体を覆っています。今の写真では、島の広い範囲に木や草が茂っています。',
    '30号棟は、国内最古の高層鉄筋コンクリート造の建物とされています。'],
   visit:['上陸はツアーでしかできません。一般の人が上陸できるようになったのは2009年で、長崎から出る船会社の上陸ツアーに参加します。船で約40分です。',
    '波の高さや風速、視程が長崎市の定めた基準を外れると、上陸は行われません。',
    '島では見学施設の範囲から出られません。閉山から50年がたち、建物の劣化は著しく進んでいます。'],
   history:['2014年に国の史跡に指定され、2015年7月に「明治日本の産業革命遺産」の構成資産のひとつとして世界遺産に登録されました。',
    '登録の際、日本政府代表団は世界遺産委員会で、1940年代に一部の施設で多くの朝鮮半島出身者などが本人の意思に反して連れて来られ、厳しい環境の下で働かされたことを理解できるような措置をとると表明しました（外務省）。端島は、その歴史とともに記憶されている場所のひとつです。'],
   sources:HASHIMA_SOURCES.map(s=>src(s,'ja')),fieldNotes:[]}
 }
};

module.exports={labels,guides,liminalGuides};
