/* Recorded editorial batch: apply after the source checks in sources.json. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const edit = (file, field, id, fn) => {
  const target = path.join(root, 'data', file);
  const doc = JSON.parse(fs.readFileSync(target, 'utf8'));
  const spot = doc[field].find(item => item.id === id || item.wiki_ja === id);
  if (!spot) throw Error(`${file}: missing ${id}`);
  fn(spot);
  const formatted = file === 'regional-landmarks-v1.json';
  fs.writeFileSync(target, JSON.stringify(doc, null, formatted ? 2 : 0) + '\n');
};

edit('places-world.json', 'places', 'nagasaki', spot => {
  spot.hook_ja = '浦上の谷をたどり、爆心地の標柱と、その北側にある平和祈念像の位置を見比べます。';
  spot.story_ja = [
    '1934年刊の江見水蔭の紀行には、長崎駅へ向かう車窓から、丘の浦上天主堂と十字架の墓標が見えたとあります。一人の旅行者の見聞ですが、被爆前の浦上を思い浮かべる手掛かりになります。',
    '1945年8月9日、原子爆弾が浦上地区の上空で炸裂し、天主堂も破壊されました。原爆落下中心地には、現在、黒御影石の標柱が立っています。',
    'その北側の小高い丘には、平和祈念像のある公園があります。中心地の標柱と祈念像は別の場所にあるので、地図で両方を探してみてください。',
    'ここで重ねる昔の航空写真は1960年代のものです。被爆直後ではなく、復興が進んだ時期の街を記録しています。谷の形を手掛かりに、写真と今の街を見比べてみましょう。'
  ];
  spot.hooks.ja = spot.hook_ja;
  spot.summaries.ja = '1934年の紀行が描く浦上天主堂のある谷は、1945年8月9日の原爆で大きく変わりました。現在の爆心地の標柱は、平和祈念像のある公園より南にあります。選択中の昔の航空写真は1960年代のもので、被爆直後ではなく復興期の街を写しています。';
  spot.researchSources = [
    {id:'ndl-hashima-1934', title:'『水蔭行脚全集 第5巻』（1934年・国立国会図書館）', url:'https://dl.ndl.go.jp/pid/1107310'},
    {id:'official-nagasaki-park', title:'平和公園の概要（長崎市）', url:'https://www.city.nagasaki.lg.jp/page/44706.html'},
    {id:'official-urakami-cathedral', title:'浦上天主堂の歴史（長崎市）', url:'https://www.city.nagasaki.lg.jp/nagazine/hakken0403/urakami_tensyudou/index.html'}
  ];
  spot.reviewedOn = '2026-09-25';
});

edit('regional-landmarks-v1.json', 'landmarks', 'regional-32862', spot => {
  spot.summaries = {...spot.summaries, ja:'出島は江戸時代、海外との交易を担った扇形の人工島でした。明治期の川の付け替えと港の埋め立てで島の輪郭が失われ、1934年の紀行はその変化を惜しんでいます。現在の建物は発掘調査と史料をもとに復元が進められたものです。昔と今の地図で、海岸線がどう動いたか見比べてみましょう。'};
  spot.researchSources = [
    {id:'ndl-hashima-1934', title:'『水蔭行脚全集 第5巻』（1934年・国立国会図書館）', url:'https://dl.ndl.go.jp/pid/1107310'},
    {id:'official-dejima-excavation', title:'出島の発掘調査（長崎市）', url:'https://www.city.nagasaki.lg.jp/uploaded/life/2960_557823_misc.pdf'}
  ];
  spot.reviewedOn = '2026-09-25';
});

edit('landmarks.json', 'landmarks', '鹿苑寺', spot => {
  spot.summaries.ja = '1941年の鉄道省の案内書は、金閣を足利義満の山荘に残る建物として紹介しています。しかしその建物は1950年に焼失し、今の金閣は1955年の再建です。鏡湖池に映る三層の姿と、背後の衣笠山を取り込む庭の景色を、昔の記述と重ねて見てみましょう。';
  spot.researchSources = [
    {id:'ndl-kinki-guide-1941', title:'『日本案内記 近畿篇 上』（1941年・国立国会図書館）', url:'https://dl.ndl.go.jp/pid/1172399'},
    {id:'official-kinkaku-history', title:'鹿苑寺（金閣寺）（京都市）', url:'https://ja.kyoto.travel/tourism/single01.php?category_id=7&tourism_id=490'}
  ];
  spot.reviewedOn = '2026-09-25';
});

edit('landmarks.json', 'landmarks', '慈照寺', spot => {
  spot.summaries.ja = '銀閣寺の正式名は慈照寺。1941年の案内書は、足利義政の山荘が戦乱などを経ても銀閣と東求堂を残したと記します。義政は銀閣の完成を見ずに亡くなりました。金閣と対になる名前ですが、まず庭の池を挟む二つの建物の位置関係を見てみましょう。';
  spot.researchSources = [
    {id:'ndl-kinki-guide-1941', title:'『日本案内記 近畿篇 上』（1941年・国立国会図書館）', url:'https://dl.ndl.go.jp/pid/1172399'},
    {id:'official-ginkaku-history', title:'銀閣寺について（相国寺派）', url:'https://www.shokoku-ji.jp/ginkakuji/about/'}
  ];
  spot.reviewedOn = '2026-09-25';
});

edit('places-world.json', 'places', 'kyoto', spot => {
  spot.hook_ja = '清水寺の本堂から斜面に張り出す舞台を見つけ、東山の坂道との位置関係をたどります。';
  spot.story_ja = [
    '清水寺の舞台は、本堂の前から谷へ張り出した木の床です。1941年の鉄道省の案内書は、崖に並ぶ長い柱を貫でつないで支える造りを紹介しています。',
    '現在の本堂は1633年に再建されました。柱に横木を通して組む舞台の構造は、釘に頼らずに斜面の上で人を支えています。',
    '案内書は舞台の下にある音羽の滝にも触れています。寺の建物だけでなく、斜面、水の流れ、門前へ続く道も、この場所の一部です。',
    '昔の航空写真と今を重ね、木々に包まれた寺域が東山の市街地へどうつながるかを探してみてください。'
  ];
  spot.hooks.ja = spot.hook_ja;
  spot.summaries.ja = '清水寺の舞台は本堂から谷へ張り出し、柱と貫で支えられています。1941年の案内書にも舞台と音羽の滝の位置が記されました。1633年再建の本堂から門前の坂道まで、山の斜面と街のつながりを昔の写真でたどれます。';
  spot.researchSources = [
    {id:'ndl-kinki-guide-1941', title:'『日本案内記 近畿篇 上』（1941年・国立国会図書館）', url:'https://dl.ndl.go.jp/pid/1172399'},
    {id:'official-kiyomizu-history', title:'清水寺の歴史と舞台（清水寺）', url:'https://www.kiyomizudera.or.jp/history.php'},
    {id:'official-kiyomizu-date', title:'清水寺（京都市）', url:'https://ja.kyoto.travel/tourism/single01.php?category_id=7&tourism_id=267'}
  ];
  spot.reviewedOn = '2026-09-25';
});

edit('landmarks.json', 'landmarks', '清水寺', spot => {
  spot.summaries.ja = '本堂の前から谷に張り出す「清水の舞台」。1941年の案内書も、崖に立つ柱を横木でつなぐ構造と、その下方にある音羽の滝を紹介しています。現本堂は1633年の再建。地図では寺の境内だけでなく、斜面から門前の街へ続く道を見てみましょう。';
  spot.researchSources = [
    {id:'ndl-kinki-guide-1941', title:'『日本案内記 近畿篇 上』（1941年・国立国会図書館）', url:'https://dl.ndl.go.jp/pid/1172399'},
    {id:'official-kiyomizu-history', title:'清水寺の歴史と舞台（清水寺）', url:'https://www.kiyomizudera.or.jp/history.php'},
    {id:'official-kiyomizu-date', title:'清水寺（京都市）', url:'https://ja.kyoto.travel/tourism/single01.php?category_id=7&tourism_id=267'}
  ];
  spot.reviewedOn = '2026-09-25';
});

edit('landmarks.json', 'landmarks', '伏見稲荷大社', spot => {
  spot.summaries.ja = '1941年の鉄道省の案内書は「千本鳥居」を写真に載せ、稲荷山の三つの峰を信仰の起点として紹介しています。朱色の鳥居は、参拝者が祈りと感謝を込めて奉納してきたもの。江戸時代に広まったその習慣は今も続きます。鳥居の道が山の奥へ伸びる様子を、地図でもたどってみましょう。';
  spot.researchSources = [
    {id:'ndl-kinki-guide-1941', title:'『日本案内記 近畿篇 上』（1941年・国立国会図書館）', url:'https://dl.ndl.go.jp/pid/1172399'},
    {id:'official-inari-history', title:'伏見稲荷大社の沿革（伏見稲荷大社）', url:'https://inari.jp/sp/history/'},
    {id:'official-inari-torii', title:'千本鳥居（伏見稲荷大社）', url:'https://inari.jp/sp/map/spot_07/'}
  ];
  spot.reviewedOn = '2026-09-25';
});
