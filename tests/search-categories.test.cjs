const test=require('node:test'),assert=require('node:assert/strict'),core=require('../search-core.js');
const record=(id,name,tags={})=>core.record({t:'node',i:id,lat:35+id/1000,lon:139,tags:{name,...tags}});
test('related words and alternate scripts resolve to meaningful categories',()=>{
 const examples=[['おんせん',{natural:'hot_spring'}],['お城',{historic:'castle'}],['神社仏閣',{amenity:'place_of_worship',religion:'shinto'}],['絶景',{tourism:'viewpoint'}],['廃線跡',{railway:'abandoned'}],['美術館',{tourism:'gallery'}],['キャンプ',{tourism:'camp_site'}],['カフェ',{amenity:'cafe'}],['動物園',{tourism:'zoo'}],['空港',{aeroway:'aerodrome'}]];
 for(const [i,[q,t]] of examples.entries())assert.equal(core.search([record(i,'施設'+i,t)],q,'ja').length,1,q);
 const temple=record(50,'清水寺');for(const q of ['寺院','お寺','Temples','사찰'])assert.equal(core.search([temple],q,'ja').length,1,q);
});
test('category queries do not match unrelated name substrings or imply unverified nighttime access',()=>{
 const rows=[record(1,'Miyagi 宮城県公園',{leisure:'park'}),record(2,'Dostoevski Memorial',{historic:'memorial'}),record(3,'Skipper Shop',{shop:'convenience'}),record(4,'展望台',{tourism:'viewpoint'})];
 assert.equal(core.search(rows,'スキー','ja').length,0);assert.equal(core.search(rows,'城','ja').length,0);assert.equal(core.search(rows,'夜景','ja').length,0);
 const ancillary=[record(10,'動物園前駅',{railway:'station'}),record(11,'動物園案内図',{tourism:'information'}),record(12,'Park Hotel',{tourism:'hotel'})];
 assert.equal(core.search(ancillary,'動物園','ja').length,0);assert.equal(core.search(ancillary,'公園','ja').length,0);assert.equal(core.search(ancillary,'駅','ja').length,1);
});
test('multiple words use actual names and recorded addresses',()=>{
 const rows=[record(1,'山の湯',{natural:'hot_spring','addr:city':'函館市'}),record(2,'海の湯',{natural:'hot_spring','addr:city':'札幌市'})];
 assert.equal(core.search(rows,'函館 温泉','ja').length,1);assert.equal(core.search(rows,'札幌 温泉','ja')[0].name,'海の湯');
});
