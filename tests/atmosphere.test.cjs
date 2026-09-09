const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(require('node:path').join(__dirname,'../atmosphere.js'),'utf8');
function boot({reduced=false,saveData=false,effectiveType='4g',hidden=false}={}){
 const listeners={},timers=new Map(),images=[],observers=[];let seq=0;
 const element=()=>({hidden:false,children:[],textContent:'',className:'',attrs:{},classList:{values:new Set(),toggle(x,on){on?this.values.add(x):this.values.delete(x)}},appendChild(x){this.children.push(x)},addEventListener(k,fn){this[k]=fn},setAttribute(k,v){this.attrs[k]=v}});
 const els=Object.fromEntries(['home','heroScene','heroMotion','heroCaption','heroCredit','heroLicense','heroLine1','heroLine2','storiesTitle','allPlacesLink'].map(x=>[x,element()]));els.home.hidden=hidden;
 const document={hidden:false,readyState:'complete',documentElement:{lang:'ja'},querySelector:()=>element(),getElementById:x=>els[x],createElement:element,addEventListener:(k,fn)=>listeners[k]=fn};
 const connection={saveData,effectiveType,addEventListener(k,fn){this[k]=fn}},media={matches:reduced,addEventListener(k,fn){this[k]=fn}};
 const context={document,navigator:{connection},matchMedia:()=>media,Image:function(){const x=element();images.push(x);return x},MutationObserver:function(fn){this.observe=()=>observers.push(fn)},setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq},clearTimeout:id=>timers.delete(id),window:{},Math:Object.create(Math)};
 context.Math.random=()=>0.42;
 vm.runInNewContext(code,context);
 return {els,images,document,media,listeners,observers,timers,
 async flush(){for(let i=0;i<12;i++)await Promise.resolve()},
 async tick(ms){const entry=[...timers].find(([,t])=>t.ms===ms);assert.ok(entry,'expected timer '+ms);timers.delete(entry[0]);entry[1].fn();await this.flush()},
 async finish(ok=true){images.filter(x=>!x.done).forEach(x=>{x.done=true;ok?x.onload():x.onerror()});await this.flush()},
 async start(){await this.tick(1500);await this.finish()},
 current(){return els.heroScene.children.find(x=>x.classList.values.has('current'))?.className}
 };
}
test('loads only when home is visible, after core content',async()=>{const h=boot({hidden:true});assert.equal(h.images.length,0);await h.start();assert.equal(h.images.length,0);h.els.home.hidden=false;h.observers[1]();await h.finish();assert.ok(h.images.length>0);assert.equal(h.els.heroScene.children.length,1)});
test('four chapters per round, no consecutive repeat, bounded image cache',async()=>{const h=boot();await h.start();let seen=[h.current()];for(let i=0;i<23;i++){await h.tick(3000);await h.finish();seen.push(h.current());assert.notEqual(seen[i],seen[i+1]);}for(let i=0;i<24;i+=4)assert.equal(new Set(seen.slice(i,i+4)).size,4);assert.equal(h.images.length,10);assert.equal(h.els.heroScene.children.length,4)});
test('reduced motion and constrained connections keep a static chapter',async()=>{for(const config of [{reduced:true},{saveData:true},{effectiveType:'3g'},{effectiveType:'slow-2g'}]){const h=boot(config);await h.start();assert.equal(h.els.heroScene.children.length,1);assert.equal(h.els.heroMotion.hidden,true);assert.equal(h.timers.size,0)}});
test('pause and hidden tab/home stop scheduling; resume starts one timer',async()=>{const h=boot();await h.start();h.els.heroMotion.click();assert.equal(h.timers.size,0);assert.equal(h.els.heroMotion.attrs['aria-pressed'],'true');h.els.heroMotion.click();h.document.hidden=true;h.listeners.visibilitychange();assert.equal(h.timers.size,0);h.document.hidden=false;h.listeners.visibilitychange();assert.equal(h.timers.size,1);h.els.home.hidden=true;h.observers[1]();assert.equal(h.timers.size,0)});
test('in-flight photo waits for resume without another request',async()=>{const h=boot();await h.start();const before=h.current();await h.tick(3000);h.els.heroMotion.click();await h.finish();assert.equal(h.current(),before);assert.equal(h.timers.size,0);const n=h.images.length;h.els.heroMotion.click();assert.notEqual(h.current(),before);assert.equal(h.images.length,n)});
test('failed photos keep current image and are not requested again',async()=>{const h=boot();await h.start();const before=h.current();await h.tick(3000);const failedSrc=h.images.filter(x=>!x.done).map(x=>x.src);await h.finish(false);assert.equal(h.current(),before);for(let i=0;i<9;i++){await h.tick(3000);await h.finish()}for(const src of failedSrc)assert.equal(h.images.filter(x=>x.src===src).length,1)});
test('localized captions and explicit photo source/license links',async()=>{const h=boot();await h.start();for(let i=0;i<4;i++){const ja=h.els.heroCaption.textContent;h.document.documentElement.lang='en';h.observers[0]();assert.notEqual(h.els.heroCaption.textContent,ja);assert.match(h.els.heroCredit.href,/^https:/);if(/landmark|liminal/.test(h.current())){assert.equal(h.els.heroLicense.hidden,false);assert.match(h.els.heroLicense.href,/creativecommons.org/)}h.document.documentElement.lang='ja';h.observers[0]();await h.tick(3000);await h.finish()}});
