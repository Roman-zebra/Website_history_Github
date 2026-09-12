/* Shared search logic. Searches recorded names and category tags, never invented places. */
(function(root){
 'use strict';
 const UI=typeof module==='object'?require('./place-ui.js'):root.PlaceUI;
 const norm=UI.normalize;
 const topics=[
  ['ski',['スキー','スノーボード','ski','snowboard','スキー場','滑雪','스키'],t=>/ski|snowboard|winter_sports|downhill|nordic/.test([t.sport,t.landuse,t['piste:type']].join(' '))],
  ['onsen',['温泉','onsen','hot spring','온천','溫泉'],t=>t.natural==='hot_spring'||t.amenity==='public_bath'||t.bath==='onsen'],
  ['castle',['城','城跡','castle','성','城堡'],t=>t.historic==='castle'||t.historic==='castle_wall'],
  ['museum',['博物館','museum','박물관','博物馆'],t=>t.tourism==='museum'],
  ['aquarium',['水族館','aquarium','아쿠아리움','水族馆'],t=>t.tourism==='aquarium'],
  ['temple',['寺','寺院','temple','사찰'],t=>t.amenity==='place_of_worship'&&t.religion==='buddhist'],
  ['shrine',['神社','shrine','신사'],t=>t.amenity==='place_of_worship'&&t.religion==='shinto'],
  ['waterfall',['滝','waterfall','폭포','瀑布','瀧'],t=>t.waterway==='waterfall'],
  ['station',['駅','station','기차역','车站','車站'],t=>['station','halt','tram_stop'].includes(t.railway)],
  ['ruins',['遺跡','廃墟','ruins','폐허','遗址','遺址'],t=>t.historic==='ruins'||t.ruins==='yes'],
  ['beach',['海岸','ビーチ','beach','해변','海滩','海灘'],t=>t.natural==='beach'],
  ['park',['公園','park','공원'],t=>t.leisure==='park'],
  ['view',['展望','viewpoint','전망대','观景','觀景'],t=>t.tourism==='viewpoint']
 ];
 const topicWords=topics.map(([,words])=>words.filter(w=>w.length>1).map(norm));
 function record(p,kind='local'){
  const t=p.tags||{},names=p.tags?Object.entries(t).filter(([k])=>/^(name(?::|$)|alt_name(?::|$)|old_name(?::|$)|short_name(?::|$)|loc_name(?::|$)|int_name$)/.test(k)).map(([,v])=>v):UI.names(p);
  const nameText=names.map(norm).join('|');
  const labels=UI.langs.map(l=>p.tags?UI.localName(t,l):UI.name(p,l));
  const tokens=topics.filter(([,words,test],i)=>test(t)||topicWords[i].some(w=>nameText.includes(w))).flatMap(([,words])=>words);
  if(p.tags){const type=UI.type(t);if(type)tokens.push(...type.slice(2));}
  if(kind==='liminal')tokens.push('liminal','リミナル','閾限','阈限');
  const tagText=Object.entries(t).filter(([k])=>/^(sport|leisure|tourism|historic|natural|railway|religion|amenity|piste:type|addr:)/.test(k)).map(([,v])=>v);
  return {id:kind==='local'?p.t+'-'+p.i:p.id,kind,lat:p.lat,lon:p.lon,labels,names:nameText,text:norm([...names,...tokens,...tagText].join('|')),...(t.railway||t.aeroway||t.landuse==='winter_sports'?{facilityTags:t}:{})};
 }
 function search(rows,query,lang){
  const parts=String(query).trim().split(/\s+/).map(norm).filter(Boolean),q=norm(query);if(!parts.length)return [];
  const li=Math.max(0,UI.langs.indexOf(lang)),hits=[],coords=new Set();
  for(const r of rows){if(!parts.every(p=>r.text.includes(p)))continue;
   const key=r.lat+','+r.lon;if(coords.has(key))continue;coords.add(key);
   const names=r.names.split('|'),score=names.includes(q)?3:names.some(n=>n.startsWith(q))?2:names.some(n=>n.includes(q))?1:0;
   hits.push({id:r.id,kind:r.kind,lat:r.lat,lon:r.lon,name:r.labels[li]||r.labels.find(Boolean)||query,score,...(r.facilityTags?{facilityTags:r.facilityTags}:{})});
  }
  return hits.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)||a.lat-b.lat);
 }
 const api={record,search,norm};if(typeof module==='object'&&module.exports)module.exports=api;else root.AtlasSearch=api;
})(typeof self==='object'?self:globalThis);
