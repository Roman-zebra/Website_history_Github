/* Four Kinki second-tier places cross-checked against public NDL guides. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const source = (id, title, url) => ({ id, title, url });
const upper = source('ndl-kinki-guide-1941', '鉄道省『日本案内記 近畿篇 上 改版』（1941年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/1172399');
const lower = source('ndl-kinki-guide-1933', '鉄道省『日本案内記 近畿篇 下』（1933年・国立国会図書館）', 'https://dl.ndl.go.jp/pid/1176380');
const edits = [
  ['近江八幡市八幡伝統的建造物群保存地区', upper,
    '1941年の『日本案内記』は、近江八幡駅から北西へ進んだ先の八幡町を案内し、鉄道と町を結ぶ交通にも触れています。現在歩ける保存地区は、豊臣秀次が築いた城下町を基に、八幡商人の活動で発展した地域です。新町通りや永原町通りには商家や蔵が並び、八幡堀は物資の運搬を支えました。1991年に国の重要伝統的建造物群保存地区に選定されています。家の外観だけでなく、通りと堀がつながる町の仕組みを見てみましょう。',
    [source('official-omihachiman-preservation', '重要伝統的建造物群保存地区について（近江八幡市）', 'https://www.city.omihachiman.lg.jp/kanko/rekishi/1/2/14115.html')]],
  ['関宿', upper,
    '1941年の『日本案内記』は、関町を通る道から関西山を望み、伊勢別街道の分岐にも触れています。関宿は東海道の宿場町で、東の追分から伊勢別街道、西の追分から大和街道へ道が分かれました。旅人や荷物が行き交った道沿いに、江戸後期から明治時代の町家が今も続きます。1984年に重要伝統的建造物群保存地区に選ばれ、修理しながら暮らしの場として守られています。一本道に見える町でも、両端の追分を意識すると交通の要地だった理由が分かります。',
    [source('official-seki-historic-plan', '東海道沿道区域における歴史的風致維持向上計画（亀山市）', 'https://www.city.kameyama.mie.jp/docs/2021033000056/file_contents/kyokasinnseityuu.pdf')]],
  ['生野銀山', lower,
    '1933年の『日本案内記』は、生野鉱山が明治に官営となり、その後三菱の事業として操業したことを記します。当時は鉱石を選別し、鉄道や港を経て製錬所へ送る、広い産業の流れの一部でした。生野銀山の歴史はさらに古く、戦国時代から銀の産地として知られます。1973年に採掘は終わりましたが、坑道や町には採掘、運搬、生活の跡が残ります。坑内を見るときは、銀を掘る人だけでなく、鉱石を運び加工した人たちの仕事も思い浮かべてみましょう。',
    [source('official-ikuno-mine', '史跡 生野銀山（朝来市）', 'https://www.city.asago.hyogo.jp/soshiki/24/1119.html')]],
  ['熊野本宮大社', lower,
    '1933年の『日本案内記』は、田辺から熊野本宮へ通じる中辺路を紹介し、本宮を熊野三山の一つとして案内しています。山道を歩いた参詣者が目指した社は、もとは熊野川の中州に近い大斎原にありました。1889年の大洪水で多くの社殿が失われ、残った建物を現在の場所へ移しました。今の社殿と大斎原を別々に訪ねると、信仰の歴史に加えて、水害後に場所を選び直した歴史も見えてきます。地図では川、旧社地、現在の社殿の位置を確かめてみましょう。',
    [source('official-kumano-hongu', '熊野本宮大社（和歌山県）', 'https://www.pref.wakayama.lg.jp/prefg/081300/d00214505.html')]],
];
const target = path.join(root, 'data/regional-landmarks-v1.json');
const doc = JSON.parse(fs.readFileSync(target, 'utf8'));
for (const [name, book, summary, official] of edits) {
  const spot = doc.landmarks.find(item => item.ja === name);
  if (!spot) throw Error(`Missing ${name}`);
  spot.summaries = { ...spot.summaries, ja: summary };
  spot.researchSources = [book, ...official];
  spot.reviewedOn = '2026-09-25';
}
fs.writeFileSync(target, JSON.stringify(doc, null, 2) + '\n');
const registryTarget = path.join(root, 'research/ndl/sources.json');
const registry = JSON.parse(fs.readFileSync(registryTarget, 'utf8'));
for (const [id, frames, note, names] of [
  ['ndl-kinki-guide-1941', [229, 235], ' 229コマに関町と伊勢別街道の分岐、235コマに八幡町と近江八幡駅の関係を確認。', ['近江八幡市八幡伝統的建造物群保存地区', '関宿']],
  ['ndl-kinki-guide-1933', [145, 146, 344, 359], ' 145～146コマに生野鉱山の官営化・三菱への移行と鉱石輸送、344・359コマに中辺路と熊野本宮を確認。', ['生野銀山', '熊野本宮大社']],
]) {
  const rec = registry.sources.find(item => item.id === id);
  if (!rec) throw Error(`Missing ${id}`);
  rec.fullTextSearchFrames = [...new Set([...rec.fullTextSearchFrames, ...frames])].sort((a, b) => a - b);
  rec.notes += note;
  rec.usedFor = [...new Set([...rec.usedFor, ...names])];
}
const notes = {
  'official-omihachiman-preservation': ['重要伝統的建造物群保存地区について', '近江八幡市', '城下町の成り立ち、八幡堀と商家、1991年の選定。'],
  'official-seki-historic-plan': ['東海道沿道区域における歴史的風致維持向上計画', '亀山市', '東海道・伊勢別街道・大和街道の追分、保存地区。'],
  'official-ikuno-mine': ['史跡 生野銀山', '朝来市', '鉱山の歴史、1896年の払い下げ、1973年の閉山。'],
  'official-kumano-hongu': ['熊野本宮大社', '和歌山県', '1889年洪水、大斎原から現社地への移転。'],
};
for (const [name, , , official] of edits) for (const ref of official) {
  if (registry.sources.some(item => item.id === ref.id)) continue;
  const [title, publisher, note] = notes[ref.id];
  registry.sources.push({ id: ref.id, type: 'official', title, publisher, url: ref.url, notes: note, usedFor: [name] });
}
const compact = JSON.stringify(registry, null, 2).replace(/"(fullTextSearchFrames|usedFor)": \[\s*([\s\S]*?)\s*\]/g, (_whole, key, contents) => `"${key}": [${JSON.parse(`[${contents}]`).map(item => JSON.stringify(item)).join(', ')}]`);
fs.writeFileSync(registryTarget, compact + '\n');
