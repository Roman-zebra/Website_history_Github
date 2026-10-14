const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const createRail = require('../facility-rail.js');

function fixture(count, reduced = false) {
  function element(initial = {}) {
    const attributes = new Map(Object.entries(initial)), listeners = new Map(), classes = new Set();
    return {attributes, listeners, classList:{contains:k=>classes.has(k), toggle(k,on){if(on)classes.add(k);else classes.delete(k);}, remove:k=>classes.delete(k)},
      getAttribute:k=>attributes.has(k)?attributes.get(k):null, setAttribute:(k,v)=>attributes.set(k,String(v)), removeAttribute:k=>attributes.delete(k),
      addEventListener:(k,fn)=>listeners.set(k,fn), removeEventListener:(k,fn)=>{if(listeners.get(k)===fn)listeners.delete(k);},
      emit:(k,event)=>listeners.get(k)?.(event)};
  }
  const track = element({tabindex:'3',role:'list','aria-label':'Existing places'});
  track.children = Array.from({length:count},(_,id)=>({id, onclick:()=>id, classList:{contains:k=>k==='card'}, getBoundingClientRect:()=>({width:280})}));
  track.clientWidth = 320;
  track.scrollWidth = Math.max(320,count*294-14);
  track.scrollLeft = 0;
  track.scrollTo = options => {track.lastScroll=options;track.scrollLeft=options.left;track.emit('scroll');};
  const previous=element(),next=element(),toolbar={},status={},hint={},frames=new Map(),observers=[];
  let sequence=0;
  const environment={requestAnimationFrame:fn=>{frames.set(++sequence,fn);return sequence;},cancelAnimationFrame:id=>frames.delete(id),
    getComputedStyle:()=>({columnGap:'14px'}),matchMedia:()=>({matches:reduced}),
    ResizeObserver:class {constructor(fn){this.callback=fn;observers.push(this);}observe(target){this.target=target;}disconnect(){this.disconnected=true;}}};
  const rail=createRail({track,previous,next,toolbar,status,hint,environment});
  const labels={previous:'Previous',next:'Next',hint:'Scroll sideways',count:'{total} places',list:'Places'};
  const flush=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
  const key=(key,target=track,extra={})=>{const event={key,target,preventDefault(){this.prevented=true;},...extra};track.emit('keydown',event);flush();return event;};
  return {rail,track,previous,next,toolbar,status,hint,frames,observers,labels,flush,key};
}

for (const reduced of [false,true]) for (const count of [0,1,4,30]) test(`native rail logic with ${count} cards, reduced motion ${reduced}`,()=>{
  const f=fixture(count,reduced),records=f.track.children.slice(),actions=records.map(x=>x.onclick);
  f.rail.update({enabled:true,labels:f.labels,reset:true});f.flush();
  assert.equal(f.toolbar.hidden,count===0);
  if(count===0){assert.equal(f.track.getAttribute('role'),'list');return;}
  assert.equal(f.status.textContent,`${count} places`);
  assert.equal(f.previous.disabled,true);assert.equal(f.next.disabled,count<=1);
  assert.deepEqual(f.track.children,records);assert.deepEqual(records.map(x=>x.onclick),actions);
  assert.equal(f.track.getAttribute('aria-label'),'Places');
  if(count>1){
    f.next.emit('click');f.flush();assert.equal(f.track.scrollLeft,Math.min(294,f.track.scrollWidth-320));
    assert.equal(f.track.lastScroll.behavior,reduced?'auto':'smooth');
    assert.equal(f.key('End').prevented,true);assert.equal(f.next.disabled,true);
    f.key('Home');assert.equal(f.previous.disabled,true);
    assert.equal(f.key('ArrowRight',records[0]).prevented,undefined);
    assert.equal(f.key('ArrowRight',f.track,{altKey:true}).prevented,undefined);
    assert.equal(f.track.scrollLeft,0);
    f.key('ArrowRight');assert.equal(f.track.scrollLeft,Math.min(294,f.track.scrollWidth-320));
    f.rail.update({enabled:true,labels:{...f.labels,count:'全 {total}か所'},reset:true});f.flush();
    assert.equal(f.status.textContent,`全 ${count}か所`);assert.equal(f.track.scrollLeft,0);
    f.track.clientWidth=f.track.scrollWidth;f.observers[0].callback();f.flush();assert.equal(f.next.disabled,true);
  }
  f.rail.destroy();
});

test('disabled modes restore the original list and cannot intercept its controls',()=>{
  const f=fixture(4);f.rail.update({enabled:true,labels:f.labels});f.flush();
  f.rail.update({enabled:false,labels:f.labels});f.flush();
  assert.equal(f.toolbar.hidden,true);assert.equal(f.track.classList.contains('facility-rail'),false);
  assert.equal(f.track.getAttribute('tabindex'),'3');assert.equal(f.track.getAttribute('role'),'list');
  assert.equal(f.track.getAttribute('aria-label'),'Existing places');
  f.next.emit('click');assert.equal(f.key('End').prevented,undefined);assert.equal(f.track.scrollLeft,0);
  f.rail.destroy();
});

test('retirement removes listeners, disconnects observers, and cancels a scheduled frame',()=>{
  const f=fixture(30);f.rail.update({enabled:true,labels:f.labels});
  assert.equal(f.frames.size,1);const late=[...f.frames.values()][0];
  f.rail.destroy();f.rail.destroy();
  assert.equal(f.frames.size,0);assert.equal(f.track.listeners.size,0);assert.equal(f.next.listeners.size,0);
  assert.equal(f.observers[0].disconnected,true);
  const before=f.status.textContent;f.track.children=[];late();f.rail.update({enabled:true,labels:f.labels});
  assert.equal(f.status.textContent,before);assert.equal(f.toolbar.hidden,true);
});

test('both existing shells ship the controller before the host and keep the real registry rendering',()=>{
  const root=path.resolve(__dirname,'..');
  for(const shell of ['index.html','explore.html']){
    const html=fs.readFileSync(path.join(root,shell),'utf8');
    assert(html.indexOf('src="facility-rail.js?')<html.indexOf('src="explore.js?'));
    assert.match(html,/id="facilityRailPrevious"[^>]+aria-controls="cards"/);
    assert.match(html,/id="facilityRailNext"[^>]+aria-controls="cards"/);
  }
  const host=fs.readFileSync(path.join(root,'explore.js'),'utf8');
  assert.match(host,/PLACES\.map\(p/);assert.match(host,/LIMINAL\.map\(\(p, i\)/);
  assert.match(host,/openPlace\(PLACES\.find/);assert.match(host,/showLiminal\(LIMINAL\.find/);
  assert.match(host,/enabled:\(mode === 'places' \|\| mode === 'liminal'\)/);
  assert.match(fs.readFileSync(path.join(root,'sw.js'),'utf8'),/facility-rail\.js\?v=/);
  assert.match(fs.readFileSync(path.join(root,'scripts/build.cjs'),'utf8'),/'facility-rail\.js'/);
});
