const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('English walk translates archive, help, initial era and accessible labels',()=>{
 const html=fs.readFileSync('3d/gunkanjima-walk.html','utf8'),nodes=new Map(),translated=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',style:{},classList:{},addEventListener(){},setAttribute(k,v){this[k]=v;}});return nodes.get(id);};
 for(const m of html.matchAll(/<[^>]*\b(data-t(?:-aria|-alt)?)="([^"]+)"[^>]*>([^<]*)/g)){
  const key=m[1]==='data-t'?'t':m[1]==='data-t-aria'?'tAria':'tAlt';translated.push({...node(m[2]),dataset:{[key]:m[2]},textContent:m[3],key,original:m[0]});
 }
 const document={getElementById:node,querySelector:()=>node('title'),querySelectorAll:q=>translated.filter(n=>q==='[data-t]'?n.key==='t':q==='[data-t-aria]'?n.key==='tAria':q==='[data-t-alt]'?n.key==='tAlt':false),documentElement:{},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync('3d/gunkanjima-walk.js','utf8'),{document,window:{addEventListener(){}},URLSearchParams,location:{search:'?lang=en'}});
 assert.equal(document.documentElement.lang,'en');assert.match(node('eraLabel').textContent,/1962.*first person/);
 assert.ok(translated.length>50);
 for(const n of translated){const value=n.key==='t'?n.textContent:n[n.key==='tAria'?'aria-label':'alt'];assert.equal(typeof value,'string',n.original);assert.ok(!/[\u3040-\u30ff\u3400-\u9fff]/.test(value),value);}
 assert.ok(translated.some(n=>n.textContent==='Photo archive'));
 // Every Japanese static text node must be localized, except native language names.
 for(const m of html.matchAll(/<([^>]+)>([^<]*[\u3040-\u30ff\u3400-\u9fff][^<]*)</g)){
  assert.ok(/data-t|id="eraLabel"|^title|^option value="(?:ja|zh-Hans|zh-Hant)"/.test(m[1]),'untranslated static text: '+m[2]);
 }
});
