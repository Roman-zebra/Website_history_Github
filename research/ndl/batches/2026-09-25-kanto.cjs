/* Source-checked Japanese copy from the openly readable 1930 Kanto guide. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const book = {id:'ndl-kanto-guide-1930', title:'『日本案内記 関東篇』（1930年・国立国会図書館）', url:'https://dl.ndl.go.jp/pid/1176338'};
const source = (id, title, url) => ({id, title, url});
const edit = (file, field, key, update) => {
  const target = path.join(root, 'data', file);
  const doc = JSON.parse(fs.readFileSync(target, 'utf8'));
  const spot = doc[field].find(item => item.id === key || item.wiki_ja === key);
  if (!spot) throw Error(`${file}: missing ${key}`);
  update(spot);
  fs.writeFileSync(target, JSON.stringify(doc) + '\n');
};
const feature = (id, hook, story, summary, sources) => edit('places-world.json', 'places', id, spot => {
  spot.hook_ja = hook;
  spot.story_ja = story;
  spot.hooks.ja = hook;
  spot.summaries.ja = summary;
  spot.researchSources = [book, ...sources];
  spot.reviewedOn = '2026-09-25';
});

feature('tokyo',
  '浅草寺へ続く参道を探し、1945～50年の写真と今の街で建物の密度を見比べます。',
  [
    '1930年の鉄道省の案内書は、雷門から露店の並ぶ参道を進み、にぎやかな街に囲まれた浅草寺へ向かう道を紹介しています。浅草は寺へのお参りと娯楽の街が重なる場所でした。',
    'その本堂は1945年3月10日の東京大空襲で焼失しました。現在の本堂は信徒の支援を受けて1958年に再建され、雷門も1960年に建て直されています。1930年の本が見た建物とは同じではありません。',
    '選択中の1945～50年の航空写真は、いずれの再建よりも前の時期です。空いた土地と現在の建物の集まりを見比べると、復興の規模が見えてきます。',
    '雷門から本堂への参道を軸に位置を合わせ、境内の外へ視線を広げてみましょう。店が並ぶ道筋と周辺の街区を続けてたどれます。'
  ],
  '1930年の案内書は雷門から露店の並ぶ参道を通って浅草寺へ向かいます。旧本堂は1945年の空襲で焼失し、今の本堂は1958年、雷門は1960年の再建です。1945～50年の航空写真は再建前の街を写しています。',
  [source('official-sensoji-hondo', '本堂（浅草寺）', 'https://www.senso-ji.jp/guide/guide04.html'),
   source('official-sensoji-kaminarimon', '雷門（浅草寺）', 'https://www.senso-ji.jp/guide/guide01.html')]);

feature('yokohama',
  '桜木町駅から海へ向かい、造船所の跡と埋め立てで変わった海岸線を見比べます。',
  [
    '1930年の鉄道省の案内書は、横浜へ向かう列車から港に浮かぶ大小の汽船が見えると書き、海外へ伸びる航路も紹介しています。港と鉄道が近い街の姿が伝わります。',
    '現在のみなとみらいの中央部には、かつて造船所と国鉄の貨物線・操車場がありました。横浜市はこの場所を横浜駅側と関内側の間を結ぶ新しい都心に変える事業を1983年に始めました。',
    '古い石造りのドックなどは残して使い、海の一部は埋め立てられました。今の公園や高層建物を、戦前から同じ形であった港だと考えないでください。',
    '1945～50年の航空写真で港の輪郭と線路を探し、現在の水際まで視線を移してみましょう。海岸線の変化が、建物の変化より大きく見える場所もあります。'
  ],
  '1930年の案内書は列車から汽船が見える横浜港を描きます。現在のみなとみらいには、かつて造船所と貨物線の操車場があり、1983年から新しい街に変わりました。石造りのドックや埋め立て後の海岸線を、昔の写真と比べてみましょう。',
  [source('official-yokohama-mm21', 'みなとみらい21地区 事業概要（横浜市）', 'https://www.city.yokohama.lg.jp/kurashi/machizukuri-kankyo/toshiseibi/mm21/gaiyo.html'),
   source('official-yokohama-mm21-guide', '横浜港周辺ガイド（横浜市）', 'https://www.city.yokohama.lg.jp/kanko-bunka/minato/taikan/asobu/minatosyuuhen.files/0002_20241216.pdf'),
   source('official-yokohama-dock', '旧横浜船渠第1号ドック（横浜市）', 'https://www.city.yokohama.lg.jp/nishi/shokai/kanko/spot/tekuteku/tekutekusketch1.html')]);

feature('kamakura',
  '高徳院の境内と長谷へ続く道を見つけ、周りの木々と住宅地の広がりを比べます。',
  [
    '1930年の鉄道省の案内書は、長谷にある高徳院の大仏を、銅で造られた阿弥陀如来の座像として紹介しています。鎌倉時代の1252年に造立が始まった像です。',
    '今は青空の下に座っていますが、もともとは大仏殿の中にありました。建物は風雨などによる倒壊と再建を繰り返し、遅くとも15世紀後半には屋外の姿になっていたと考えられています。',
    '大仏そのものは、1930年の案内書の時代にも既に屋外でした。選択中の1945～50年の航空写真では、像の細部より、境内の位置と長谷の道筋を目印にしましょう。',
    '昔と今で周囲の緑や家並みがどう変わったかを見ると、長い歴史を持つ場所が現在の街にどう残っているかがわかります。'
  ],
  '1930年の案内書は長谷の高徳院にある銅製の阿弥陀如来像を紹介しています。大仏は1252年に造立が始まり、昔は大仏殿の中にありましたが、15世紀後半には屋外の姿でした。航空写真では境内と長谷の道を目印に比べてみましょう。',
  [source('official-kotokuin', '鎌倉大仏と高徳院（高徳院）', 'https://kotoku-in.jp/about.html'),
   source('official-kamakura-daibutsuden', '鎌倉大仏殿の歴史（鎌倉市）', 'https://www.city.kamakura.kanagawa.jp/rekibun/highlights.html')]);

edit('landmarks.json', 'landmarks', '東京駅', spot => {
  spot.summaries.ja = '1930年の案内書には丸の内の東京駅と駅構内のホテルが載っています。1914年開業の赤レンガ駅舎は、1945年の空襲でドームと3階を失い、戦後は2階建てで使われました。2012年の保存・復原で3階とドームが戻りましたが、下層には創建時の構造も残ります。';
  spot.researchSources = [book,
    source('official-tokyo-station-history', '東京駅の概要・歴史（Tokyo Station City）', 'https://www.tokyostationcity.com/learning/'),
    source('official-tokyo-station-restoration', '丸の内駅舎のみどころ（Tokyo Station City）', 'https://www.tokyostationcity.com/learning/station_building/'),
    source('official-tokyo-station-airraid', '丸の内駅舎保存・復原工事完成10年（JR東日本）', 'https://www.jreast.co.jp/press/2022/tokyo/20220922_to01.pdf')];
  spot.reviewedOn = '2026-09-25';
});
