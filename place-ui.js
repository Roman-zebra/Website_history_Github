/* Shared, dependency-free place presentation. No runtime translation requests. */
(function(root){
  'use strict';
  const langs = ['en','ja','ko','zh-Hans','zh-Hant'];
  const pick = (values, lang) => values[Math.max(0, langs.indexOf(lang))];
  const fields = {en:['name:en','int_name'],ja:['name:ja'],ko:['name:ko'],
    'zh-Hans':['name:zh-Hans','name:zh-CN','name:zh'], 'zh-Hant':['name:zh-Hant','name:zh-TW','name:zh']};
  function name(p, lang){
    const localized = p.names && p.names[lang];
    if (localized) return localized;
    const key = {en:'name',ja:'name_ja',ko:'name_ko','zh-Hans':'name_zh_cn','zh-Hant':'name_zh_tw'}[lang];
    return p[key] || (lang === 'ja' && p.ja) || (lang.startsWith('zh') && p.name_zh) || p.name || p.ja || '';
  }
  function localName(tags, lang){
    for (const key of fields[lang] || fields.en) if (tags[key]) return tags[key];
    return tags['name:en'] || tags.int_name || tags['name:ja'] || tags.name || '';
  }
  const normalize = s => String(s || '').normalize('NFKD').toLowerCase()
    .replace(/[\u0300-\u036f]/g,'').replace(/[\u30a1-\u30f6]/g,c=>String.fromCharCode(c.charCodeAt(0)-96))
    .replace(/[\s\u3000\-–—_,.'’"()（）・･:：]/g,'');
  function names(p){
    return [...Object.values(p.names || {}),
      p.name,p.ja,p.name_ja,p.romaji,p.name_ko,p.name_zh,p.name_zh_cn,p.name_zh_tw,...(p.aliases || [])].filter(Boolean);
  }
  // Specific types precede generic religion/building/attraction tags.
  const types = [
    ['railway=station|railway=halt','🚉','railway station','駅','기차역','车站','車站'],
    ['railway=tram_stop','🚊','tram stop','路面電車の停留場','노면전차 정류장','电车站','電車站'],
    ['aeroway=aerodrome','✈️','airport','空港','공항','机场','機場'],
    ['tourism=zoo','🦁','zoo','動物園','동물원','动物园','動物園'],
    ['tourism=aquarium','🐠','aquarium','水族館','수족관','水族馆','水族館'],
    ['tourism=theme_park','🎡','amusement park','遊園地','놀이공원','游乐园','遊樂園'],
    ['tourism=gallery','🖼️','art gallery','美術館・ギャラリー','미술관','美术馆','美術館'],
    ['tourism=museum','🏛️','museum','博物館','박물관','博物馆','博物館'],
    ['tourism=viewpoint','🔭','viewpoint','展望地','전망대','观景点','觀景點'],
    ['tourism=camp_site','🏕️','campsite','キャンプ場','캠핑장','露营地','露營地'],
    ['tourism=picnic_site','🧺','picnic spot','休憩地','피크닉 장소','野餐地','野餐地'],
    ['tourism=hotel|tourism=guest_house','🏨','accommodation','宿泊施設','숙박 시설','住宿设施','住宿設施'],
    ['information=guidepost|information=route_marker','🧭','guidepost','道標','이정표','路标','路標'],
    ['information=map','🗺️','map board','案内図','안내 지도','导览地图','導覽地圖'],
    ['information=office','ℹ️','visitor information office','観光案内所','관광안내소','游客中心','旅客服務中心'],
    ['information=board','📜','information board','案内板','안내판','说明牌','說明牌'],
    ['memorial=plaque','📜','memorial plaque','記念銘板','기념 명판','纪念铭牌','紀念銘牌'],
    ['memorial=statue|artwork_type=statue','🗿','statue','像','동상','雕像','雕像'],
    ['memorial=war_memorial','🕯️','war memorial','戦没者慰霊碑','전쟁 추모비','战争纪念碑','戰爭紀念碑'],
    ['memorial=hazard_memorial','🌊','disaster memorial','災害伝承碑','재해 전승비','灾害纪念碑','災害紀念碑'],
    ['memorial=stele|memorial=stone','🗿','memorial stone','石碑','기념비','石碑','石碑'],
    ['artwork_type=mural','🎨','mural','壁画','벽화','壁画','壁畫'],
    ['artwork_type=sculpture|tourism=artwork','🗿','public artwork','屋外の作品','공공 미술 작품','公共艺术作品','公共藝術作品'],
    ['historic=wayside_shrine','🌸','wayside shrine','路傍の祠','길가의 작은 사당','路旁小祠','路旁小祠'],
    ['historic=wayside_cross','✝️','wayside cross','路傍の十字架','길가의 십자가','路旁十字架','路旁十字架'],
    ['historic=castle','🏯','castle or castle site','城・城跡','성·성터','城堡或城址','城堡或城址'],
    ['historic=fort','🛡️','fort','砦','요새','堡垒','堡壘'],
    ['historic=battlefield','⚔️','battlefield','古戦場','옛 전쟁터','古战场','古戰場'],
    ['historic=tomb|historic=tumulus','⚱️','tomb or burial mound','墓・古墳','무덤·고분','墓葬','墓葬'],
    ['historic=archaeological_site','🏺','archaeological site','遺跡','유적','遗址','遺址'],
    ['historic=ruins','🏚️','ruins','遺構・廃墟','폐허·유구','遗迹','遺跡'],
    ['historic=locomotive|historic=railway_car','🚂','preserved railway vehicle','保存車両','보존 철도 차량','保存铁路车辆','保存鐵路車輛'],
    ['historic=ship','🚢','preserved ship','保存船','보존 선박','保存船舶','保存船舶'],
    ['historic=aircraft','🛩️','preserved aircraft','保存航空機','보존 항공기','保存飞机','保存飛機'],
    ['historic=mine|historic=mine_shaft|man_made=mineshaft','⛏️','mine site','鉱山跡','광산 유적','矿山遗址','礦山遺址'],
    ['historic=boundary_stone|historic=milestone','📜','boundary or distance marker','境界石・里程標','경계석·이정표','界石或里程碑','界石或里程碑'],
    ['man_made=lighthouse','🗼','lighthouse','灯台','등대','灯塔','燈塔'],
    ['man_made=bridge','🌉','bridge','橋','다리','桥梁','橋梁'],
    ['man_made=water_well','💧','well','井戸','우물','水井','水井'],
    ['man_made=watermill','⚙️','watermill','水車','물레방아','水车','水車'],
    ['man_made=windmill','🌬️','windmill','風車','풍차','风车','風車'],
    ['man_made=survey_point','📐','survey marker','三角点・水準点','측량 기준점','测量点','測量點'],
    ['man_made=tower','🗼','tower','塔','탑','塔','塔'],
    ['man_made=pier','⚓','pier','桟橋','부두','码头','碼頭'],
    ['natural=volcano','🌋','volcano','火山','화산','火山','火山'],
    ['natural=peak','⛰️','mountain peak','山頂','산봉우리','山峰','山峰'],
    ['natural=saddle','🏔️','mountain pass','峠','고개','山口','山口'],
    ['natural=hot_spring','♨️','hot spring','温泉','온천','温泉','溫泉'],
    ['natural=spring','💧','spring','湧水','샘','泉水','泉水'],
    ['natural=cave_entrance','🕳️','cave entrance','洞窟の入口','동굴 입구','洞穴入口','洞穴入口'],
    ['natural=tree','🌳','tree','木','나무','树木','樹木'],
    ['natural=wood|landuse=forest','🌲','woodland','森林','숲','森林','森林'],
    ['natural=beach','🏖️','beach','浜辺','해변','海滩','海灘'],
    ['natural=cape','🌊','cape','岬','곶','海角','海角'],
    ['natural=rock|natural=stone','🗿','rock','岩','바위','岩石','岩石'],
    ['natural=water','💧','body of water','水辺','수역','水域','水域'],
    ['waterway=waterfall','💦','waterfall','滝','폭포','瀑布','瀑布'],
    ['waterway=dam|waterway=weir','🚰','dam or weir','ダム・堰','댐·보','水坝','水壩'],
    ['waterway=river|waterway=stream|waterway=canal','🏞️','waterway','川・水路','하천·수로','河流或水道','河流或水道'],
    ['leisure=garden','🌷','garden','庭園','정원','庭园','庭園'],
    ['leisure=park','🌳','park','公園','공원','公园','公園'],
    ['amenity=library','📚','library','図書館','도서관','图书馆','圖書館'],
    ['amenity=school|amenity=university','🎓','school','学校','학교','学校','學校'],
    ['amenity=fountain','⛲','fountain','噴水','분수','喷泉','噴泉'],
    ['amenity=grave_yard|landuse=cemetery','⚱️','cemetery','墓地','묘지','墓地','墓地'],
    ['highway=bus_stop','🚏','bus stop','バス停','버스 정류장','公交站','公車站'],
    ['highway=steps','🚶','steps','階段','계단','台阶','階梯'],
    ['highway=path|highway=footway','🥾','footpath','歩道・小道','산책로','步道','步道'],
    ['place=islet|place=island','🏝️','island','島','섬','岛屿','島嶼'],
    ['religion=shinto','⛩️','Shinto site','神道の信仰の場','신토 신앙 장소','神道信仰场所','神道信仰場所'],
    ['religion=buddhist','🛕','Buddhist site','仏教の信仰の場','불교 신앙 장소','佛教场所','佛教場所'],
    ['religion=christian','⛪','Christian site','キリスト教の信仰の場','기독교 신앙 장소','基督教场所','基督教場所'],
    ['amenity=place_of_worship','🙏','place of worship','信仰の場','종교 시설','宗教场所','宗教場所'],
    ['historic=memorial|historic=monument','🗿','memorial','記念碑','기념비','纪念碑','紀念碑'],
    ['historic=building|historic=house','🏠','historic building','歴史的な建物','역사적 건물','历史建筑','歷史建築'],
    ['tourism=information','ℹ️','information point','案内地点','안내 지점','信息点','資訊點'],
    ['tourism=attraction','📍','local attraction','見どころ','지역 명소','当地景点','當地景點']
  ];
  const rules = types.map(row=>({row,tests:row[0].split('|').map(s=>s.split('='))}));
  function type(tags){return rules.find(r=>r.tests.some(([k,v])=>tags[k]===v))?.row || null;}
  function label(tags,lang){const row=type(tags);return row?pick(row.slice(2),lang):pick(['local place','地域の地点','지역 장소','当地地点','當地地點'],lang);}
  function summary(tags,lang){
    const kind=label(tags,lang), n=localName(tags,lang);
    if(!type(tags))return pick([
      (n||'This place')+' is shown at this position on the map.\nExplore the surroundings; a detailed description is not yet available.',
      (n||'この地点')+'の位置を地図で確認できます。\n詳しい説明は未登録ですが、周辺の風景を地図でたどれます。',
      (n||'이 장소')+'의 위치를 지도에서 확인할 수 있습니다.\n자세한 설명은 아직 없지만 주변 풍경을 살펴볼 수 있습니다.',
      '可在地图上查看'+(n||'此处')+'的位置。\n尚无详细说明，可先探索周边风景。',
      '可在地圖上查看'+(n||'此處')+'的位置。\n尚無詳細說明，可先探索周邊風景。'],lang);
    const first=pick([
      `${n || 'This place'} is recorded on OpenStreetMap as a ${kind}.`,
      `${n || 'この地点'}は、地図に${kind}として登録されている場所です。`,
      `${n || '이 장소'}: OpenStreetMap에 ${kind}(으)로 등록된 장소입니다.`,
      `${n || '此处'}在OpenStreetMap中被标记为${kind}。`,
      `${n || '此處'}在OpenStreetMap中被標記為${kind}。`],lang);
    let second=pick(['Explore its surroundings on the map and compare aerial photographs where available.',
      '地図で周辺をたどり、空中写真がある場所では昔と今の風景を見くらべられます。',
      '지도에서 주변을 살펴보고 항공사진이 있는 곳에서는 과거와 현재를 비교해 보세요.',
      '可在地图上探索周边，并在有航拍照片的地方对比昔日与今日。',
      '可在地圖上探索周邊，並在有航拍照片的地方對比昔日與今日。'],lang);
    if(tags.start_date) second=pick([`The map records a date of ${tags.start_date}.`,`地図には年代として${tags.start_date}と記録されています。`,
      `지도에 기록된 연대는 ${tags.start_date}입니다.`,`地图记录的年代为${tags.start_date}。`,`地圖記錄的年代為${tags.start_date}。`],lang);
    else if(tags['addr:city']) second=pick([`Its recorded municipality is ${tags['addr:city']}.`,`所在地は${tags['addr:city']}と記録されています。`,
      `지도에 기록된 소재지는 ${tags['addr:city']}입니다.`,`记录的所在地为${tags['addr:city']}。`,`記錄的所在地為${tags['addr:city']}。`],lang);
    return first+'\n'+second;
  }
  function savedRows(value){
    if(!Array.isArray(value)) return [];
    const seen=new Set();
    return value.filter(p=>p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat)<=90 && Math.abs(p.lon)<=180)
      .map(p=>({k:p.lat.toFixed(5)+','+p.lon.toFixed(5),lat:p.lat,lon:p.lon,name:String(p.name||'').slice(0,200)}))
      .filter(p=>!seen.has(p.k)&&seen.add(p.k)).slice(-200);
  }
  function spotURL(origin,lang,at,hash,title){
    const u=new URL('/',origin);u.searchParams.set('lang',lang);
    if(hash && hash!=='#map') u.hash=hash;
    else if(at){u.hash='spot='+at[0].toFixed(5)+','+at[1].toFixed(5);if(title)u.searchParams.set('name',title.slice(0,200));}
    else u.hash='map';
    return u.href;
  }
  const api={langs,pick,name,localName,normalize,names,type,label,summary,savedRows,spotURL};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PlaceUI=api;
})(typeof window!=='undefined'?window:globalThis);
