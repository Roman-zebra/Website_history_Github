/* Shared search logic. Searches recorded names and category tags, never invented places. */
(function(root){
 'use strict';
 const UI=typeof module==='object'?require('./place-ui.js'):root.PlaceUI;
 const norm=UI.normalize;
 const topics=[
  ['ski',['スキー','スノーボード','ski','snowboard','スキー場','滑雪','스키'],t=>/ski|snowboard|winter_sports|downhill|nordic/.test([t.sport,t.landuse,t['piste:type']].join(' '))],
  ['onsen',['温泉','おんせん','日帰り温泉','onsen','hot spring','온천','溫泉'],t=>t.natural==='hot_spring'||t.amenity==='public_bath'||t.bath==='onsen'],
  ['castle',['城','お城','城跡','城址','castle','성','城堡'],t=>t.historic==='castle'||t.historic==='castle_wall'],
  ['museum',['博物館','資料館','歴史館','museum','박물관','博物馆'],t=>t.tourism==='museum'],
  ['aquarium',['水族館','aquarium','아쿠아리움','水族馆'],t=>t.tourism==='aquarium'],
  ['temple',['寺','お寺','寺院','仏閣','temple','사찰'],t=>t.amenity==='place_of_worship'&&t.religion==='buddhist'],
  ['shrine',['神社','神宮','大社','shrine','신사'],t=>t.amenity==='place_of_worship'&&t.religion==='shinto'],
  ['waterfall',['滝','たき','waterfall','폭포','瀑布','瀧'],t=>t.waterway==='waterfall'],
  ['station',['駅','station','기차역','车站','車站'],t=>['station','halt','tram_stop'].includes(t.railway)],
  ['ruins',['遺跡','廃墟','ruins','폐허','遗址','遺址'],t=>t.historic==='ruins'||t.ruins==='yes'],
  ['beach',['海岸','ビーチ','beach','해변','海滩','海灘'],t=>t.natural==='beach'],
  ['park',['公園','park','공원'],t=>t.leisure==='park'],
  ['view',['展望','展望台','展望所','絶景','見晴らし','viewpoint','observation deck','scenic view','전망대','观景','觀景'],t=>t.tourism==='viewpoint'],
['art',['美術館','アート','art museum','art gallery','미술관','美术馆','美術館'],t=>t.tourism==='gallery'||t.museum==='art'],
['zoo',['動物園','zoo','동물원','动物园'],t=>t.tourism==='zoo'],
['amusement',['遊園地','テーマパーク','amusement park','theme park','놀이공원','游乐园','遊樂園'],t=>t.tourism==='theme_park'],
['airport',['空港','airport','공항','机场','機場'],t=>t.aeroway==='aerodrome'],
['rail-remains',['廃線','廃線跡','鉄道遺構','abandoned railway','disused railway','폐선','废弃铁路','廢棄鐵路'],t=>['abandoned','disused','razed'].includes(t.railway)||t['abandoned:railway']||t['disused:railway']],
['industrial',['産業遺産','炭鉱','鉱山','精錬所','industrial heritage','mine','refinery','산업유산','工业遗产','工業遺產'],t=>['mine','mine_shaft','mine_adit','industrial'].includes(t.historic)||['mineshaft','adit'].includes(t.man_made)],
['garden',['庭園','日本庭園','garden','정원','庭园'],t=>t.leisure==='garden'],
['mountain',['登山','山登り','山頂','ハイキング','mountain','hiking','summit','등산','爬山'],t=>t.natural==='peak'||t.route==='hiking'],
['cave',['洞窟','鍾乳洞','cave','동굴'],t=>t.natural==='cave_entrance'],
['bridge',['橋','橋梁','bridge','다리','橋樑'],t=>t.man_made==='bridge'],
['lighthouse',['灯台','lighthouse','등대','燈塔'],t=>t.man_made==='lighthouse'],
['memorial',['記念碑','慰霊碑','石碑','memorial','monument','기념비','纪念碑','紀念碑'],t=>['memorial','monument'].includes(t.historic)],
['old-town',['宿場','宿場町','町並み','街並み','古い町並み','old town','historic street','옛 거리','老街'],t=>t.historic==='yes'&&t.place==='quarter'],
['port',['港','港町','漁港','harbour','harbor','fishing port','항구','港口'],t=>t.landuse==='port'||t.harbour==='yes'],
['camp',['キャンプ','キャンプ場','camping','campsite','캠핑','露营','露營'],t=>['camp_site','caravan_site'].includes(t.tourism)],
['ropeway',['ロープウェイ','ロープウエイ','ケーブルカー','ropeway','cable car','케이블카','缆车','纜車'],t=>t.aerialway==='station'||t.railway==='funicular'],
['shopping',['商店街','市場','shopping street','market','상점가','商店街'],t=>t.amenity==='marketplace'],
['food',['食事','グルメ','レストラン','飲食店','restaurant','food','음식점','餐厅','餐廳'],t=>['restaurant','food_court','fast_food'].includes(t.amenity)],
['cafe',['カフェ','喫茶店','コーヒー','cafe','coffee','카페','咖啡'],t=>t.amenity==='cafe'],
['hotel',['宿泊','ホテル','旅館','hotel','ryokan','호텔','住宿','酒店'],t=>['hotel','guest_house','hostel','motel'].includes(t.tourism)],
['toilet',['トイレ','お手洗い','toilet','restroom','화장실','厕所','廁所'],t=>t.amenity==='toilets'],
['night',['夜景','night view','야경'],t=>t.viewpoint==='night_view'],
['cherry',['桜','桜並木','花見','cherry blossom','sakura','벚꽃','樱花','櫻花'],t=>/Prunus (serrulata|yedoensis)|Cerasus/i.test(t.species||'')]
 ];
 const topicWords=topics.map(([,words])=>words.filter(w=>w.length>1).map(w=>({word:norm(w),latin:/^[a-z ]+$/i.test(w),pattern:new RegExp('(^|[^a-z])'+w.toLowerCase().replace(/ /g,'[ -]?')+'($|[^a-z])')})));
 const topicAliases=new Map(topics.flatMap(([id,words])=>words.map(w=>[norm(w),id])));
 for(const [word,id] of Object.entries({"castles":"castle","shrines":"shrine","temples":"temple","museums":"museum","art museums":"art","waterfalls":"waterfall","viewpoints":"view","parks":"park","gardens":"garden","beaches":"beach","caves":"cave","zoos":"zoo","aquariums":"aquarium","stations":"station","airports":"airport","cafes":"cafe"}))topicAliases.set(norm(word),id);
 topicAliases.set(norm('神社仏閣'),'religious');topicAliases.set(norm('寺社'),'religious');
 function record(p,kind='local'){
  const t=p.tags||{},names=p.tags?Object.entries(t).filter(([k])=>/^(name(?::|$)|alt_name(?::|$)|old_name(?::|$)|short_name(?::|$)|loc_name(?::|$)|int_name$)/.test(k)).map(([,v])=>v):UI.names(p);
  const nameText=names.map(norm).join('|');
  const labels=UI.langs.map(l=>p.tags?UI.localName(t,l):UI.name(p,l));
  const rawNames=names.join('|').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'');
  const exactCategories=topics.filter(([,words,test])=>test(t)).map(([id])=>id);
  // A station called Zoo-mae, a trail sign or a museum's office is not the destination itself.
  const specific=exactCategories.length>0||!!t.railway||t.tourism==='information'||['parking','toilets','school','hospital','university'].includes(t.amenity)||['museum','gallery','zoo','aquarium','theme_park','hotel','hostel','guest_house','motel','camp_site'].includes(t.tourism);
  const categories=topics.filter(([id],i)=>exactCategories.includes(id)||(!specific||(t.tourism==='museum'&&id==='art'))&&topicWords[i].some(w=>w.latin?w.pattern.test(rawNames):nameText.includes(w.word))).map(([id])=>id);
  if(!t.railway){if(/寺$/.test(t['name:ja']||t.name||p.ja||''))categories.push('temple');if(/城(?:跡|址)?$/.test(t['name:ja']||t.name||p.ja||''))categories.push('castle');}
  if(kind==='liminal')categories.push('liminal');
  if(kind==='monument'&&!categories.includes('memorial'))categories.push('memorial');
  const tokens=topics.filter(([id])=>categories.includes(id)).flatMap(([,words])=>words);
  if(p.tags){const type=UI.type(t);if(type)tokens.push(...type.slice(2));}
  if(kind==='liminal')tokens.push('liminal','リミナル','閾限','阈限');
  const tagText=Object.entries(t).filter(([k])=>/^(sport|leisure|tourism|historic|natural|railway|religion|amenity|piste:type|addr:)/.test(k)).map(([,v])=>v);
  return {id:kind==='local'?p.t+'-'+p.i:p.id,kind,lat:p.lat,lon:p.lon,labels,categories,names:nameText,text:norm([...names,...tokens,...tagText].join('|')),...(t.railway||t.aeroway||t.landuse==='winter_sports'?{facilityTags:t}:{})};
 }
 function search(rows,query,lang){
  const parts=String(query).trim().split(/\s+/).map(norm).filter(Boolean),q=norm(query);if(!parts.length)return [];
  const li=Math.max(0,UI.langs.indexOf(lang)),hits=[],coords=new Set();
  for(const r of rows){if(!parts.every(p=>{const category=topicAliases.get(p);return category==='religious'?r.categories?.some(c=>c==='temple'||c==='shrine'):category?r.categories?.includes(category):r.text.includes(p);}))continue;
   const key=r.lat+','+r.lon;if(coords.has(key))continue;coords.add(key);
   const names=r.names.split('|'),score=names.includes(q)?3:names.some(n=>n.startsWith(q))?2:names.some(n=>n.includes(q))?1:0;
   hits.push({id:r.id,kind:r.kind,lat:r.lat,lon:r.lon,name:r.labels[li]||r.labels.find(Boolean)||query,score,...(r.facilityTags?{facilityTags:r.facilityTags}:{})});
  }
  return hits.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)||a.lat-b.lat);
 }
 const api={record,search,norm};if(typeof module==='object'&&module.exports)module.exports=api;else root.AtlasSearch=api;
})(typeof self==='object'?self:globalThis);
