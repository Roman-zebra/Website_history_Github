/* Location matching only. No cookies, geolocation requests or tracking scripts. */
(function(root){
 'use strict';
 const providers={viator:['viator.com'],klook:['klook.com'],getyourguide:['getyourguide.com'],stay22:['stay22.com'],booking:['booking.com']};
 const blocked=new Set(['lore','memorial']);
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
  if(!config?.enabled||!point(place?.at)||blocked.has(place.kind)||(config.excludeKinds||[]).includes(place.kind))return null;
  const matches=[];
  for(const offer of config.offers||[]){
   if(!offer.enabled||!offer.id||!providers[offer.provider]||!trustedURL(offer.url,offer.provider,config))continue;
   if(!point(offer.at)||!Number.isFinite(offer.radiusKm)||offer.radiusKm<=0||offer.radiusKm>25)continue;
   const reviewed=Date.parse(offer.reviewedOn),expires=Date.parse(offer.expiresOn);
   if(!Number.isFinite(reviewed)||reviewed>now||now-reviewed>180*86400000||(Number.isFinite(expires)&&expires<=now))continue;
   const km=distance(place.at,offer.at);if(km>offer.radiusKm)continue;
   const ids=offer.placeIds||[];if(ids.length&&!ids.includes(place.placeId))continue;
   if(offer.kinds?.length&&!offer.kinds.includes(place.kind))continue;
   // An offer needs copy and booking support in the reader's selected language.
   // No silent English substitution for a different-language product.
   const label=offer.labels?.[lang];if(!offer.languages?.includes(lang)||!label?.trim())continue;
   matches.push({...offer,label,km,exact:ids.includes(place.placeId),priority:Number.isFinite(offer.priority)?offer.priority:0});
  }
  matches.sort((a,b)=>Number(b.exact)-Number(a.exact)||b.priority-a.priority||a.km-b.km||String(a.id).localeCompare(String(b.id)));
  return matches[0]||null;
 }
 const api={select,distance};if(typeof module==='object'&&module.exports)module.exports=api;else root.AffiliateRouter=api;
})(typeof window==='object'?window:globalThis);
