/* Each overview gets a fresh document for the official GYG widget lifecycle. */
(function(){
 'use strict';
 const p=new URLSearchParams(location.search),lat=Number(p.get('lat')),lon=Number(p.get('lon'));
 const locales=['en-US','ja-JP','ko-KR','zh-CN','zh-TW'],lang=p.get('lang'),campaign=p.get('cmp')||'';
 const send=(phase,height)=>parent.postMessage({type:'jta-gyg',phase,height},location.origin);
 const fail=()=>send('error',0);
 if(!p.has('lat')||!p.has('lon')||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<20||lat>46||lon<122||lon>154||!locales.includes(lang)||!/^jta_map_[\d._-]{1,48}$/.test(campaign)){fail();return;}
 document.documentElement.lang=lang;
 document.title='Local experiences in Japan · Japan Time Atlas';
 const node=document.getElementById('widget'),status=document.getElementById('status');
 status.textContent=({'ja-JP':'広告を読み込み中…','ko-KR':'광고 불러오는 중…','zh-CN':'正在加载广告…','zh-TW':'正在載入廣告…'})[lang]||'Loading advertisement…';
 let settled=false,watchdog;
 const report=()=>{
  const inner=node.querySelector('iframe');
  if(!inner)return;
  const h=inner.getBoundingClientRect().height;
  if(h>100){settled=true;clearTimeout(watchdog);status.hidden=true;send('ready',Math.ceil(Math.min(900,Math.max(180,document.body.scrollHeight))));}
 };
 fetch('/affiliate-config.json?v=0.75').then(r=>{if(!r.ok)throw Error('config');return r.json();}).then(c=>{
  const id=c.getyourguide?.partnerId;if(!c.enabled||!c.getyourguide?.enabled||!/^[A-Z0-9]{5,12}$/.test(id||''))throw Error('disabled');
  const attrs={'data-gyg-href':'https://widget.getyourguide.com/default/activities.frame','data-gyg-locale-code':lang,'data-gyg-widget':'activities','data-gyg-number-of-items':'1','data-gyg-cmp':campaign,'data-gyg-partner-id':id,'data-gyg-lat':String(lat),'data-gyg-lon':String(lon)};
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
  const span=document.createElement('span'),a=document.createElement('a');a.href='https://www.getyourguide.com/';a.target='_blank';a.rel='sponsored nofollow noopener';a.textContent='GetYourGuide';span.append('Powered by ',a);node.append(span);
  const observer=new MutationObserver(report);observer.observe(node,{childList:true,subtree:true,attributes:true});
  const resize=new ResizeObserver(report);resize.observe(node);
  const script=document.createElement('script');script.async=true;script.defer=true;script.src='https://widget.getyourguide.com/dist/pa.umd.production.min.js';script.dataset.gygPartnerId=id;script.onerror=fail;document.head.append(script);
  watchdog=setTimeout(()=>{if(!settled)fail();},20000);
  addEventListener('pagehide',()=>{clearTimeout(watchdog);observer.disconnect();resize.disconnect();},{once:true});
 }).catch(fail);
})();
