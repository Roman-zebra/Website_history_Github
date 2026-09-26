const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
test('touch stick ramps speed, sprints at full tilt, and clears on release, cancellation and pause',()=>{
 const nodes=new Map(),events={},draws=[],noop=()=>{};let tick;
 function node(id){if(nodes.has(id))return nodes.get(id);const handlers={};const n={id,textContent:'',style:{},value:'1',options:[{}],selectedOptions:[{textContent:'1962'}],attrs:{},hidden:id==='walkTools',disabled:false,open:false,
  classList:{toggle:noop,remove:noop},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,f){handlers[k]=f;},handlers,
  focus:noop,setPointerCapture:noop,getBoundingClientRect:()=>({left:0,top:0,width:110,height:110}),
  getContext:()=>new Proxy({},{get:(_,k)=>(...args)=>draws.push([k,...args])}),remove:noop,append:noop,replaceChildren:noop,showModal(){this.open=true;}};nodes.set(id,n);return n;}
 const document={documentElement:{},getElementById:node,querySelector:q=>q==='dialog[open]'?null:node('title'),querySelectorAll:()=>[],addEventListener:noop,createElement:()=>node('option')};
 const input={x:0,y:0,run:false,autoRun:false};
 const g={input,pause(){Object.assign(input,{x:0,y:0,run:false,autoRun:false});},scenes:()=>({}),year:()=>1962,fromWorld:(x,y)=>[x,y],indoor:()=>false,floor:()=>null,request:noop};
 const win={addEventListener:(k,f)=>events[k]=f,jtaLab3d:{game:g,st:{wx:0,wz:0,az:0},model:()=>({coast:[[0,0],[10,0],[0,10]],buildings:[]})}};
 vm.runInNewContext(fs.readFileSync('3d/gunkanjima-walk.js','utf8'),{window:win,document,location:{search:'?lang=ja'},URLSearchParams,setInterval:f=>tick=f,setTimeout:noop});
 events['jta-walk-ready']();assert.equal(node('walkTools').hidden,true);
 node('toolsToggle').onclick();assert.equal(node('walkTools').hidden,false);assert.equal(node('toolsToggle').attrs['aria-expanded'],'true');
 node('view').handlers.pointerdown();assert.equal(node('walkTools').hidden,true);
 node('toolsToggle').onclick();node('help').onclick();assert.equal(node('walkTools').hidden,true);assert.equal(node('helpDialog').open,true);
 const stick=node('stick'),e=(x,y)=>({pointerId:1,clientX:x,clientY:y,preventDefault:noop});
 stick.onpointerdown(e(55,55));assert.equal(input.y,0,'center dead zone');
 stick.onpointermove(e(55,37));assert.ok(input.y>.4&&input.y<.6);assert.equal(input.autoRun,false);
 stick.onpointermove(e(55,0));assert.equal(input.y,1);assert.equal(input.autoRun,true);assert.equal(node('run').attrs['aria-pressed'],'true');
 for(const event of ['pointerup','pointercancel','lostpointercapture']){
  stick.handlers[event](e(55,0));assert.equal(input.autoRun,false);assert.equal(input.y,0);stick.onpointerdown(e(55,0));
 }
 events.blur();assert.deepEqual(input,{x:0,y:0,run:false,autoRun:false});
 draws.length=0;win.jtaLab3d.st.wx=20;win.jtaLab3d.st.wz=30;tick();
 assert.ok(draws.some(d=>d[0]==='translate'&&d[1]===90&&d[2]===90),'player remains at map centre');
 assert.ok(draws.some(d=>d[0]==='moveTo'&&Math.abs(d[1]-71.4)<.001&&Math.abs(d[2]-62.1)<.001),'coast scrolls opposite to movement');
 draws.length=0;win.jtaLab3d.st.az=Math.PI/2;tick();assert.ok(draws.some(d=>d[0]==='rotate'&&Math.abs(d[1])<.001),'heading follows camera');
 assert.ok(document.title.includes('デモ版'));assert.ok(node('title').textContent.includes('デモ版'));
});
