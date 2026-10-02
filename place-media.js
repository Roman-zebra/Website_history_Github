/* Public POI search and identity-checked Commons photographs. No Google API key. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PlaceMedia=api;
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const attribution='https://openpoiapi.com/attribution.html';
  const normal=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s・･]/g,'');
  const text=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
  function address(p){
    const parts=[];
    for(const value of [p.prefecture,p.city,p.address])if(value&&!parts.some(s=>s.includes(value))){
      while(parts.length&&value.includes(parts[parts.length-1]))parts.pop();
      parts.push(value);
    }
    return parts.join(' ');
  }
  function rows(data,inJapan){
    if(!Array.isArray(data.results))throw new Error('Invalid OpenPOI response');
    return data.results.flatMap(p=>{
      const lat=Number(p.lat),lon=Number(p.lng);
      if(!p.name||p.lat===''||p.lng===''||p.lat==null||p.lng==null||!Number.isFinite(lat)||!Number.isFinite(lon)||!inJapan(lat,lon))return [];
      return [{name:p.name,lat,lon,address:address(p),category:p.category||p.business_type||'',
        kind:'openpoi',level:p.level,licenses:(p.licenses||[]).filter(x=>typeof x==='string'),
        attributions:(p.attributions||[]).filter(x=>typeof x==='string')}];
    });
  }
  function merge(a,b){
    const out=a.slice();
    for(const p of b){
      const same=out.find(r=>normal(r.name)===normal(p.name)&&distance(r,p)<35);
      if(same){if(!same.address)same.address=p.address;continue;}
      out.push(p);
    }
    return out;
  }
  function distance(a,b){
    const rad=Math.PI/180,x=(b.lon-a.lon)*rad*Math.cos((a.lat+b.lat)*rad/2),y=(b.lat-a.lat)*rad;
    return Math.hypot(x,y)*6371000;
  }
  function searchURL(query,bounds,category=false){
    const url=new URL('https://api.openpoiapi.com/v1/'+(category?'search':'suggest'));
    url.searchParams.set('q',query);url.searchParams.set('limit',category?'200':'20');
    // suggest implements AND, kana normalization and relevance ranking; search is for exact categories.
    const box=bounds||(!category?{west:122,south:20,east:154,north:46}:null);
    if(box)url.searchParams.set('bbox',[box.west,box.south,box.east,box.north].join(','));
    return url.href;
  }
  function links(name,at,addr){
    const query=[name,addr||at.join(','),'Japan'].filter(Boolean).join(' ');
    return {maps:'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query),
      street:'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint='+encodeURIComponent(at.join(',')),
      images:'https://www.google.com/search?tbm=isch&q='+encodeURIComponent(query+' 外観')};
  }
  async function request(url,signal,fetcher=fetch){
    const r=await fetcher(url,{signal});if(!r.ok)throw new Error('HTTP '+r.status);return r.json();
  }
  async function search(query,bounds,inJapan,signal,fetcher,category=false){
    const data=await request(searchURL(query,bounds,category),signal,fetcher);
    const results=category?data.results:data.suggestions;
    if(!Array.isArray(results))throw new Error('Invalid OpenPOI response');
    // Area search must never silently fall back to nationwide suggestions.
    const found=bounds&&data.scope==='nationwide'?[]:results;
    return {rows:rows({results:found},inJapan),limited:found.length>=(category?200:20)};
  }
  async function commonsPhoto(file,signal,fetcher){
    if(!file||!/^File:/i.test(file))return null;
    const url=new URL('https://commons.wikimedia.org/w/api.php');
    url.search=new URLSearchParams({action:'query',format:'json',origin:'*',titles:file,
      prop:'imageinfo',iiprop:'url|extmetadata|mime',iiurlwidth:'960'});
    const data=await request(url.href,signal,fetcher);
    const info=Object.values(data.query?.pages||{})[0]?.imageinfo?.[0];
    if(!info||!/^image\/(jpeg|png|webp)$/.test(info.mime))return null;
    const meta=info.extmetadata||{},license=text(meta.LicenseShortName?.value);
    if(!/^(CC0|CC BY(?:-SA)? [\d.]+(?: [a-z]+)?|Public domain)$/i.test(license))return null;
    const src=info.thumburl||info.url;
    if(!/^https:\/\/upload\.wikimedia\.org\//.test(src)||!/^https:\/\/commons\.wikimedia\.org\//.test(info.descriptionurl))return null;
    return {img:src,name:file.slice(5),cap:'Wikimedia Commons · '+text(meta.Artist?.value||meta.Credit?.value||info.user)+' · '+license,
      capHref:info.descriptionurl};
  }
  async function photoForPlace(p,signal,fetcher){
    if(p.file)return commonsPhoto(p.file,signal,fetcher);
    // No guess from a nearby photo or a name alone: both identity and coordinates must match.
    const search=new URL('https://www.wikidata.org/w/api.php');
    search.search=new URLSearchParams({action:'wbsearchentities',format:'json',origin:'*',search:p.name,language:'ja',uselang:'ja',limit:'5'});
    const hits=await request(search.href,signal,fetcher);
    const ids=(hits.search||[]).map(x=>x.id).filter(x=>/^Q\d+$/.test(x));if(!ids.length)return null;
    const entities=new URL('https://www.wikidata.org/w/api.php');
    entities.search=new URLSearchParams({action:'wbgetentities',format:'json',origin:'*',ids:ids.join('|'),props:'labels|aliases|claims',languages:'ja|en'});
    const data=await request(entities.href,signal,fetcher);
    for(const entity of Object.values(data.entities||{})){
      const names=[...Object.values(entity.labels||{}).map(x=>x.value),...Object.values(entity.aliases||{}).flat().map(x=>x.value)];
      if(!names.some(n=>normal(n)===normal(p.name)))continue;
      const coords=(entity.claims?.P625||[]).filter(c=>c.rank!=='deprecated').map(c=>c.mainsnak?.datavalue?.value);
      if(!coords.some(c=>c&&c.globe==='http://www.wikidata.org/entity/Q2'&&distance(p,{lat:c.latitude,lon:c.longitude})<100))continue;
      const file=(entity.claims?.P18||[]).find(c=>c.rank!=='deprecated')?.mainsnak?.datavalue?.value;
      if(file)return commonsPhoto('File:'+file,signal,fetcher);
    }
    return null;
  }
  return {attribution,normal,address,rows,merge,distance,searchURL,links,search,commonsPhoto,photoForPlace};
});
