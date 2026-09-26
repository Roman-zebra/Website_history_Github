const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('look panel restores saved settings, builds labelled sliders and saves, switches presets and resets',()=>{
 const nodes=new Map(),events={},noop=()=>{},store=new Map([['jta-walk-look-v1',JSON.stringify({preset:'autumn',grass:.4})]]);
 const make=id=>({id,textContent:'',style:{},value:'',dataset:{},attrs:{},hidden:id==='walkTools',disabled:id==='lookButton',open:false,children:[],options:[{}],selectedOptions:[{textContent:'1962'}],
  classList:{toggle:noop,remove:noop},setAttribute(k,v){this.attrs[k]=v;},addEventListener:noop,focus:noop,append(...c){this.children.push(...c);},remove:noop,replaceChildren:noop,
  getContext:()=>new Proxy({},{get:()=>noop}),showModal(){this.open=true;}});
 const node=id=>{if(!nodes.has(id))nodes.set(id,make(id));return nodes.get(id);};
 const presets=['spring','summer','autumn','winter','magic'].map(p=>Object.assign(make('preset-'+p),{dataset:{preset:p}}));
 const document={documentElement:{},getElementById:node,querySelector:q=>q==='dialog[open]'?null:node('title'),querySelectorAll:q=>q==='[data-preset]'?presets:[],addEventListener:noop,createElement:tag=>make(tag)};
 const defaults={preset:'summer',quality:'auto',exposure:1.04,grass:1,grain:.03},state={...defaults},calls=[];
 const appearance={get:()=>({...state}),set:p=>{calls.push(p);for(const k in p)if(k in state)state[k]=p[k];return {...state};},reset:()=>Object.assign(state,defaults),ranges:()=>({exposure:[.6,1.6],grass:[0,1.5],grain:[0,.12]})};
 const g={input:{x:0,y:0},pause:noop,scenes:()=>({}),year:()=>1962,fromWorld:(x,y)=>[x,y],indoor:()=>false,floor:()=>null,request:noop,appearance};
 const win={addEventListener:(k,f)=>events[k]=f,jtaLab3d:{game:g,st:{wx:0,wz:0,az:0},model:()=>({coast:[[0,0],[10,0],[0,10]],buildings:[]})}};
 const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
 vm.runInNewContext(fs.readFileSync('3d/gunkanjima-walk.js','utf8'),{window:win,document,localStorage,location:{search:'?lang=en'},URLSearchParams,setInterval:noop,setTimeout:noop});
 events['jta-walk-ready']();
 assert.equal(JSON.stringify(calls[0]),JSON.stringify({preset:'autumn',grass:.4}),'saved settings are restored');
 assert.equal(node('lookButton').disabled,false);
 const rows=node('lookSliders').children;assert.equal(rows.length,3,'one slider per range the renderer reports');
 const [name,input,out]=rows[1].children;assert.equal(name.textContent,'Grass');assert.equal(input.type,'range');assert.equal(+input.max,1.5);
 node('lookButton').onclick();assert.equal(node('lookDialog').open,true);assert.equal(+input.value,.4);assert.equal(out.textContent,'0.40');
 assert.equal(presets[2].attrs['aria-pressed'],'true');assert.equal(presets[1].attrs['aria-pressed'],'false');
 input.value='1.2';input.oninput();assert.equal(state.grass,1.2);assert.equal(JSON.parse(store.get('jta-walk-look-v1')).grass,1.2,'saved in this browser');
 presets[4].onclick();assert.equal(state.preset,'magic');assert.equal(presets[4].attrs['aria-pressed'],'true');
 node('lookQuality').value='low';node('lookQuality').onchange();assert.equal(state.quality,'low');
 node('lookReset').onclick();assert.equal(state.preset,'summer');assert.equal(store.has('jta-walk-look-v1'),false);assert.equal(+input.value,1);
});
