/* Location matching only. No cookies, geolocation requests or tracking scripts. */
(function(root){
 'use strict';
 const providers={viator:['viator.com'],klook:['klook.com'],getyourguide:['getyourguide.com'],stay22:['stay22.com'],booking:['booking.com']};
 const blocked=new Set(['lore','memorial']);
 const locales={en:'en-US',ja:'ja',ko:'ko','zh-Hans':'zh-CN','zh-Hant':'zh-TW',th:'th'};
 const copy={
  en:{ad:'Advertisement · Klook',disclosure:'Bookings through this link may earn this site a commission.',cta:'Check options on Klook ↗',near:'An idea for this area',search:'Explore experiences in ',searchNote:'Browse regional listings. Check the location, dates and language on Klook.',note:'Check dates, meeting point and available options on Klook.'},
  ja:{ad:'広告・PR · Klook',disclosure:'このリンクから予約すると、サイト運営者に報酬が入ることがあります。',cta:'Klookでプランを見る ↗',near:'このあたりをもう少し楽しむ',search:'の体験・チケットを探す',searchNote:'地域の商品一覧へ移動します。場所・日程・対応言語をご確認ください。',note:'日程・集合場所・プランの詳細はKlookでご確認ください。'},
  ko:{ad:'광고 · Klook',disclosure:'이 링크로 예약하면 사이트 운영자에게 수수료가 지급될 수 있습니다.',cta:'Klook에서 옵션 보기 ↗',near:'이 지역에서 즐길 거리',search:' 체험과 입장권 찾기',searchNote:'지역 상품을 검색합니다. 위치, 날짜와 지원 언어를 확인하세요.',note:'날짜, 집합 장소와 옵션은 Klook에서 확인하세요.'},
  'zh-Hans':{ad:'广告 · Klook',disclosure:'通过此链接预订，本站可能获得佣金。',cta:'在Klook查看选项 ↗',near:'探索这一带',search:'的体验与门票',searchNote:'查看地区商品列表。请确认地点、日期和服务语言。',note:'请在Klook确认日期、集合地点和套餐详情。'},
  'zh-Hant':{ad:'廣告 · Klook',disclosure:'透過此連結預訂，本站可能獲得佣金。',cta:'在Klook查看方案 ↗',near:'探索這一帶',search:'的體驗與門票',searchNote:'查看地區商品列表。請確認地點、日期和服務語言。',note:'請在Klook確認日期、集合地點和方案詳情。'},
  th:{ad:'โฆษณา · Klook',disclosure:'เว็บไซต์อาจได้รับค่าคอมมิชชันจากการจองผ่านลิงก์นี้',cta:'ดูตัวเลือกบน Klook ↗',near:'กิจกรรมน่าสนใจในบริเวณนี้',search:'ค้นหากิจกรรมใน ',searchNote:'ค้นหารายการในพื้นที่ โปรดตรวจสอบสถานที่ วันที่ และภาษาที่ให้บริการ',note:'ตรวจสอบวันที่ จุดนัดพบ และตัวเลือกบน Klook'}
 };
 const prominent=place=>place?.adTier===1||place?.adTier===2;
 const small=place=>place?.adTier===3||place?.adTier===4;
 const MILE_KM=1.609344;
 const sizePolicy=config=>config.klook?.smallRadiusKm===MILE_KM;
 const activityPlace=place=>['food','shopping'].includes(place?.kind)&&/^a-[a-z0-9-]+$/.test(place?.placeId||'');
 function eligible(config,place){return !!(config?.enabled&&point(place?.at)&&(activityPlace(place)||(sizePolicy(config)?(prominent(place)||small(place)):(!config.klook?.topTwoOnly||prominent(place))&&(prominent(place)||(!blocked.has(place.kind)&&!(config.excludeKinds||[]).includes(place.kind))))));}
 function trackedURL(config,destination,prefecture,tag){
  const aid=config?.klook?.affiliateId;if(!/^\d+$/.test(aid||''))return null;
  try{const target=new URL(destination);if(target.protocol!=='https:'||target.hostname!=='www.klook.com'||target.username||target.password)return null;
   const u=new URL('https://affiliate.klook.com/redirect');
   u.searchParams.set('aid',aid);u.searchParams.set('aff_label1',config.klook.sourceTag||'jta_map');
   u.searchParams.set('aff_label2',prefecture);u.searchParams.set('aff_label3',tag);
   u.searchParams.set('k_site',target.href);return u.href;
  }catch{return null;}
 }
 function topic(place){const s=String(place.kind||'');return /rail|station|halt|train/.test(s)?'rail':/peak|water|beach|nature|park/.test(s)?'nature':/viewpoint|tower/.test(s)?'viewpoint':'culture';}
 const point=a=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite)&&Math.abs(a[0])<=90&&Math.abs(a[1])<=180;
 function distance(a,b){const rad=Math.PI/180,dlat=(b[0]-a[0])*rad,dlon=(b[1]-a[1])*rad;const h=Math.sin(dlat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dlon/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));}
 function trustedURL(value,provider,config){
  try{const u=new URL(value);const domains=providers[provider];
   // Affiliate networks may use separate redirect hosts. Add only the exact
   // host supplied in an approved account, scoped to its provider.
   const redirectHosts=config.approvedRedirectHosts?.[provider]||[];
   return u.protocol==='https:'&&!u.username&&!u.password&&domains&&(domains.some(h=>u.hostname===h||u.hostname.endsWith('.'+h))||redirectHosts.includes(u.hostname));
  }catch{return false;}
 }
 function select(config,place,lang,now=Date.now()){
  if(!eligible(config,place)||activityPlace(place))return null;
  const matches=[];
  for(const original of config.offers||[]){
   let offer=original;
   if(offer.provider==='klook'&&offer.productId){
    if(!locales[lang]||!/^\d+$/.test(offer.productId)||!config.klook?.prefectures?.some(p=>p.code===offer.prefecture))continue;
    const label=offer.names?.[lang]||offer.names?.en;
    offer={...offer,url:trackedURL(config,'https://www.klook.com/'+locales[lang]+'/activity/'+offer.productId+'/',offer.prefecture,offer.productId),labels:{[lang]:label},languages:[lang]};
   }
   if(!offer.enabled||offer.commissionPercent===0||!offer.id||!providers[offer.provider]||!trustedURL(offer.url,offer.provider,config))continue;
   if(!point(offer.at)||!Number.isFinite(offer.radiusKm)||offer.radiusKm<=0||offer.radiusKm>25)continue;
   const reviewed=Date.parse(offer.reviewedOn),expires=Date.parse(offer.expiresOn);
   if(!Number.isFinite(reviewed)||reviewed>now||now-reviewed>180*86400000||(Number.isFinite(expires)&&expires<=now))continue;
   const km=distance(place.at,offer.at);if(!prominent(place)&&km>(sizePolicy(config)?MILE_KM:offer.radiusKm))continue;
   const ids=offer.placeIds||[];if(ids.length&&!ids.includes(place.placeId))continue;
   if(offer.kinds?.length&&!offer.kinds.includes(place.kind))continue;
   // An offer needs copy and booking support in the reader's selected language.
   // No silent English substitution for a different-language product.
   const label=offer.labels?.[lang];if(!offer.languages?.includes(lang)||!label?.trim())continue;
   const names=[place.name,place.ja,place.searchNameJa].filter(Boolean).join(' ').toLocaleLowerCase();
   const named=(offer.aliases||[]).some(s=>s.length>=3&&names.includes(s.toLocaleLowerCase()));
   matches.push({...offer,label,km,nearest:prominent(place)||sizePolicy(config),exact:ids.includes(place.placeId)||named,score:km-(offer.category===topic(place)?2:0),priority:Number.isFinite(offer.priority)?offer.priority:0});
  }
  matches.sort((a,b)=>((prominent(place)||sizePolicy(config))?a.km-b.km:Number(b.exact)-Number(a.exact)||b.priority-a.priority||a.score-b.score)||String(a.id).localeCompare(String(b.id)));
  return matches[0]||null;
 }
 function regional(config,place,lang,address){
  if(!eligible(config,place)||activityPlace(place)||(sizePolicy(config)&&!prominent(place))||!config.klook?.regionalSearch||!locales[lang]||address?.country_code!=='jp')return null;
  const list=config.klook.prefectures||[],iso=Object.entries(address).find(([k,v])=>k.startsWith('ISO3166-2-')&&/^JP-\d{2}$/.test(v))?.[1];
  const state=String(address.state||address.province||'').toLowerCase().replace(/ prefecture| metropolis|都$|府$|県$/g,'');
  const pref=list.find(p=>p.code===iso)||list.find(p=>state===p.en.toLowerCase()||state===p.ja.replace(/[都府県]$/,''));
  if(!pref)return null;
  const city=['city','town','village','municipality'].map(k=>address[k]).find(v=>typeof v==='string'&&v.length<100&&!/振興局|支庁/.test(v));
  const region=city||(lang==='ja'?pref.ja:pref.en),query=[region,lang==='ja'?pref.ja:pref.en,lang==='ja'?'日本':'Japan'].filter((v,i,a)=>a.indexOf(v)===i).join(' ');
  const destination=new URL('https://www.klook.com/'+locales[lang]+'/search/result/');destination.searchParams.set('query',query);
  const url=trackedURL(config,destination.href,pref.code,'search');if(!url)return null;
  const c=copy[lang],label=['en','th'].includes(lang)?c.search+region:region+c.search;
  return{id:'klook-search-'+pref.code,provider:'klook',label,url,regional:true,prefecture:pref.code};
 }
 function travel(config,place,lang,now=Date.now()){
  if(!eligible(config,place)||activityPlace(place)||!locales[lang])return null;
  const t=place.travelTags||{},operator=[t.operator,t.network,t['operator:en'],t['network:en']].filter(Boolean).join(' ');
  let type='';
  if(t.aeroway==='aerodrome'&&config.klook.internationalAirports?.includes(t.iata))type='esim';
  else if(['station','halt'].includes(t.railway)){
   if((/東京地下鉄|東京メトロ|Tokyo Metro|都営地下鉄|Toei Subway/i.test(operator)||(/東京都交通局/.test(operator)&&(t.station==='subway'||t.subway==='yes')))&&t.station!=='light_rail'&&t.tram!=='yes')type='tokyo-subway';
   else if(/JR|旅客鉄道|Japan Rail/i.test(operator))type='jr-national';
   else {try{const host=new URL(t['contact:website']||t.website).hostname;if(['jreast.co.jp','jr-central.co.jp','jr-odekake.net','jrhokkaido.co.jp','jr-shikoku.co.jp','jrkyushu.co.jp'].some(h=>host===h||host.endsWith('.'+h)))type='jr-national';}catch{}}
  }
  const item=config.klook.travelOffers?.find(o=>o.match===type&&o.enabled&&o.commissionPercent!==0);
  if(!item||!/^\d+$/.test(item.productId)||!Number.isFinite(Date.parse(item.reviewedOn))||now-Date.parse(item.reviewedOn)>180*86400000||Date.parse(item.reviewedOn)>now)return null;
  const prefecture=place.prefecture||'JP',url=trackedURL(config,'https://www.klook.com/'+locales[lang]+'/activity/'+item.productId+'/',prefecture,item.productId);
  if(!url)return null;
  return {...item,id:'klook-'+item.productId,provider:'klook',url,label:item.names[lang]||item.names.en,travel:true,note:item.notes[lang]||item.notes.en};
 }
 // Curated itineraries may have several stops. Match their reviewed place IDs,
 // never an invented product coordinate or a distant nearest-neighbour offer.
 function activity(config,place,lang,now=Date.now()){
  if(!eligible(config,place)||!activityPlace(place)||!locales[lang])return null;
  for(const item of config.klook.activityOffers||[]){
   if(!item.enabled||item.commissionPercent===0||!item.id||item.provider!=='klook'||!item.placeIds?.includes(place.placeId)||!/^\d+$/.test(item.productId))continue;
   if(!config.klook.prefectures?.some(p=>p.code===item.prefecture))continue;
   const reviewed=Date.parse(item.reviewedOn),expires=Date.parse(item.expiresOn);
   if(!Number.isFinite(reviewed)||reviewed>now||now-reviewed>180*86400000||(Number.isFinite(expires)&&expires<=now))continue;
   const label=item.names?.[lang],note=item.notes?.[lang];if(!label?.trim()||!note?.trim())continue;
   const url=trackedURL(config,'https://www.klook.com/'+locales[lang]+'/activity/'+item.productId+'/',item.prefecture,item.productId);
   if(url)return {...item,label,note,url,activity:true};
  }
  return null;
 }
 function resolveOffer(config,place,lang,now=Date.now()){
  if(activityPlace(place))return activity(config,place,lang,now);
  const direct=select(config,place,lang,now),extra=travel(config,place,lang,now);
  return extra&&(!direct||direct.km>MILE_KM)?extra:direct;
 }
 function tourHub(config,place){
  const t=place.travelTags||{};
  if(t.aeroway==='aerodrome')return 'airport';
  if(t.railway==='station'&&(t.highspeed==='yes'||(config.klook?.tourRegions||[]).some(r=>r.shinkansenStationNames?.some(n=>[t.name,t['name:ja'],place.name,place.ja,place.searchName].includes(n))&&distance(place.at,r.at)<0.8)))return 'station';
  const names=[place.name,place.ja,place.searchName,place.searchNameJa].filter(Boolean).map(s=>s.normalize('NFKC').toLowerCase().trim());
  return (config.klook?.tourRegions||[]).some(r=>point(r.at)&&distance(place.at,r.at)<=r.radiusKm&&(r.downtownNames||[]).some(n=>names.includes(n.toLowerCase())))?'downtown':null;
 }
 function tours(config,place,lang,now=Date.now()){
  if(!eligible(config,place)||activityPlace(place)||!locales[lang])return [];
  const hub=tourHub(config,place);if(!hub)return [];
  const regions=(config.klook.tourRegions||[]).filter(r=>hub==='airport'?(r.airports||[]).includes(place.travelTags.iata):point(r.at)&&distance(place.at,r.at)<=r.radiusKm);
  return (config.klook.tourOffers||[]).flatMap(o=>{
   const region=regions.find(r=>o.regions?.includes(r.id)),reviewed=Date.parse(o.reviewedOn);
   if(!region||!o.enabled||o.commissionPercent===0||!/^\d+$/.test(o.productId)||!Number.isFinite(reviewed)||reviewed>now||now-reviewed>180*86400000||(o.expiresOn&&Date.parse(o.expiresOn)<=now))return [];
   const url=trackedURL(config,'https://www.klook.com/'+locales[lang]+'/activity/'+o.productId+'/',region.prefecture,o.productId);
   if(!url)return [];
   return [{...o,id:'klook-'+o.productId,provider:'klook',url,label:o.names[lang]||o.names.en,tour:true,note:o.notes[lang]||o.notes.en}];
  });
 }
 function offerChoices(config,place,lang,now=Date.now()){
  const list=[...tours(config,place,lang,now),resolveOffer(config,place,lang,now)].filter(Boolean);
  return list.filter((o,i)=>list.findIndex(p=>p.id===o.id)===i);
 }
 // Counts actual overview openings, never configuration/language/data refreshes.
 function createRotation(){
  const visits=new Map();return {index(key,visit){let v=visits.get(key);if(!v){v={visit,index:0};visits.set(key,v);}else if(v.visit!==visit){v.visit=visit;v.index++;}if(visits.size>256)visits.delete(visits.keys().next().value);return v.index;},next(key){const v=visits.get(key);if(v)v.index++;return v?.index||0;}};
 }
 // Only the latest opened panel may display an asynchronous region lookup.
 function createResolver(){let revision=0;return async function(config,place,lang,lookup,publish){
  const mine=++revision;publish(null);if(!eligible(config,place))return;
  const choices=offerChoices(config,place,lang);if(choices.length){const index=Math.max(0,Math.floor(place.adCycle||0))%choices.length;publish({...choices[index],choiceCount:choices.length});return;}
  if(activityPlace(place)||!config.klook?.regionalSearch||(sizePolicy(config)&&!prominent(place)))return;
  try{const address=await lookup();if(mine===revision)publish(regional(config,place,lang,address));}catch{/* No irrelevant fallback on lookup failure. */}
 };}
 const api={select,travel,activity,tourHub,tours,offerChoices,createRotation,resolveOffer,distance,regional,trackedURL,createResolver,copy};if(typeof module==='object'&&module.exports)module.exports=api;else root.AffiliateRouter=api;
})(typeof window==='object'?window:globalThis);
