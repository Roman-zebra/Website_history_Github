const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const element=()=>({hidden:false,children:[],dataset:{},classList:{contains(){return false;}},replaceChildren(){this.children=[];},append(...children){this.children.push(...children);},setAttribute(){}});
 const els={pAff:element(),place:element(),panel:element()},ctx={AFF:null,LANG:'ja',AffiliateRouter:require('../affiliate-router.js'),PlaceUI:require('../place-ui.js'),facilityTags:()=>null,$:id=>els[id],document:{createElement:element},revGeo:async()=>null};
 vm.createContext(ctx);const s=fs.readFileSync(require.resolve('../explore.js'),'utf8');vm.runInContext(s.slice(s.indexOf('let resolveAffiliate'),s.indexOf('/* =========================================================================',s.indexOf('let resolveAffiliate'))),ctx);
 return {ctx,els,run:code=>vm.runInContext(code,ctx)};
}
test('a deep-linked place gains its ad when config arrives, without clicking its marker again',()=>{
 const {ctx,els,run}=setup();ctx.config=require('../affiliate-config.json');
 run('renderAffiliate({at:[41.764,140.713],adTier:1});');assert.equal(els.pAff.hidden,true);
 run('setAffiliateConfig(config);');assert.equal(els.pAff.hidden,false);
 assert.ok(els.pAff.children.some(el=>el.href?.includes('aff_label3=45064')));
});
test('late config uses the latest place and does not reopen a closed overview',()=>{
 const {ctx,els,run}=setup();ctx.config=require('../affiliate-config.json');
 run('renderAffiliate({at:[41.764,140.713],adTier:1});renderAffiliate({at:[0,0],adTier:4});setAffiliateConfig(config);');assert.equal(els.pAff.hidden,true);
 els.place.hidden=true;run('renderAffiliate({at:[41.764,140.713],adTier:1});');els.pAff.hidden=true;run('setAffiliateConfig(config);');assert.equal(els.pAff.hidden,true);
});
test('one card alternates on opening or user request while refreshes keep the selection',()=>{
 const {ctx,els,run}=setup();ctx.config=require('../affiliate-config.json');
 ctx.facilityTags=()=>({aeroway:'aerodrome',iata:'HND'});
 run('setAffiliateConfig(config);affiliateVisit++;renderAffiliate({at:[35.55,139.78],adTier:4});');
 const cards=()=>els.pAff.children.filter(e=>e.href);assert.equal(cards().length,1);assert.ok(cards()[0].href.includes('aff_label3=75806'));
 run('setAffiliateConfig(config);');assert.ok(cards()[0].href.includes('aff_label3=75806'));
 run('affiliateVisit++;renderAffiliate(currentAffiliatePlace);');assert.equal(cards().length,1);assert.ok(cards()[0].href.includes('aff_label3=109393'));
 els.pAff.children.find(e=>e.className==='aff-next').onclick();assert.ok(cards()[0].href.includes('aff_label3=75806'));
});
