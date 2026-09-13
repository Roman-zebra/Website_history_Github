/* Walking plans reuse the reviewed September 13 preview data and OSM routes. */
window.AtlasWalking = (() => {
  let layer=null, selected=null;
  const colors=['#1675bc','#9a42a6','#09866b'];
  const text=(ja,en)=>LANG==='ja'?ja:en;
  const ix=()=>LANG==='ja'?0:1;
  const name=p=>p.names[({ja:0,en:1,ko:2,'zh-Hant':3,'zh-Hans':4})[LANG]??1];
  const groups={places:ATLAS_WALKS.places.filter(p=>!p.variantOf).map(p=>p.id),food:['kanazawa-market'],shopping:['tokyo','fukuoka','yokohama','kobe','kanazawa-market']};
  const labels={ja:'おすすめの散歩ルートを選ぶ',en:'Choose a recommended walk',ko:'추천 산책 코스 선택','zh-Hans':'选择推荐散步路线','zh-Hant':'選擇推薦散步路線'};
  function plan(p){
    const d=ATLAS_WALKS.details[p.id],r=ATLAS_WALKS.routes[p.id];
    const walking=r.legs.reduce((n,l)=>n+l.minutes,0),visiting=d.stay.reduce((a,b)=>a+b,0);
    const total=Math.max(p.mins,Math.ceil((walking+visiting+5)/5)*5);
    let elapsed=0;
    return {d,r,walking,visiting,total,buffer:total-walking-visiting,slots:d.stay.map((stay,i)=>{const start=elapsed;elapsed+=stay;const end=elapsed;elapsed+=r.legs[i]?.minutes||0;return {start,end,stay};})};
  }
  function clear(){if(layer){layer.clearLayers();}selected=null;}
  function refresh(){
    let box=document.getElementById('walkChooser');
    if(!box){box=document.createElement('section');box.id='walkChooser';box.className='walk-chooser';document.getElementById('cards').before(box);}
    box.hidden=!groups[mode];box.replaceChildren();if(box.hidden)return;
    const toggle=document.createElement('button');toggle.type='button';toggle.className='walk-toggle';toggle.textContent=labels[LANG]||labels.en;toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','walkOptions');
    const list=document.createElement('div');list.id='walkOptions';list.className='walk-options';list.hidden=true;
    toggle.onclick=()=>{list.hidden=!list.hidden;toggle.setAttribute('aria-expanded',String(!list.hidden));};
    if(mode==='shopping'){const note=document.createElement('p');note.textContent=text('商店街・市場・ショップを含む街歩きです。','Walks that include shopping streets, markets or shops.');list.append(note);}
    for(const id of groups[mode]){const p=ATLAS_WALKS.places.find(p=>p.id===id);const b=document.createElement('button');b.type='button';b.textContent=name(p)+' · '+plan(p).total+text('分',' min');b.onclick=()=>open(id);list.append(b);}
    box.append(toggle,list);
  }
  function fit(){if(!selected)return;const p=selected;map.fitBounds(L.latLngBounds(ATLAS_WALKS.routes[p.id].legs.flatMap(l=>l.path)),{paddingTopLeft:[40,90],paddingBottomRight:[40,170],maxZoom:17});}
  function focus(i,fromPin){if(!selected)return;const s=selected.stops[i];map.setView([s[2],s[3]],17);document.querySelectorAll('.walk-stop').forEach((e,j)=>e.classList.toggle('active',i===j));if(fromPin){$('panel').classList.add('open');document.getElementById('walkStop'+i)?.scrollIntoView({block:'nearest',behavior:'smooth'});}else $('panel').classList.remove('open');}
  function open(id,keepHistory=false){
    const p=ATLAS_WALKS.places.find(p=>p.id===id);if(!p)return;
    const q=plan(p),j=ix();
    ensureMap();setThenLayer(null,null);document.body.classList.remove('roaming');$('home').hidden=true;$('place').hidden=false;roaming=false;current=null;
    const routeURL='https://www.google.com/maps/dir/?api=1&travelmode=walking&origin='+p.stops[0].slice(2,4).join(',')+'&destination='+p.stops.at(-1).slice(2,4).join(',')+'&waypoints='+encodeURIComponent(p.stops.slice(1,-1).map(s=>s.slice(2,4).join(',')).join('|'));
    const html='<p>'+esc(p.look[j])+'</p><div class="walk-budget"><strong>'+q.total+text('分',' min')+'</strong><span>'+text('徒歩','Walk')+' '+q.walking+' · '+text('滞在','Visit')+' '+q.visiting+' · '+text('余裕','Buffer')+' '+q.buffer+text('分',' min')+'</span></div><p>'+esc(p.station[j])+' · '+(q.r.distance/1000).toFixed(2)+' km</p><button type="button" id="walkFit">'+text('ルート全体を見る','Show whole route')+'</button><ol class="walk-stops">'+p.stops.map((s,i)=>'<li class="walk-stop" id="walkStop'+i+'" style="--walk-color:'+colors[i]+'"><button type="button" data-walk-stop="'+i+'">'+(i+1)+'. '+esc(s[j])+'</button><p class="walk-time">'+text('開始から','From start')+' '+q.slots[i].start+'–'+q.slots[i].end+text('分・滞在',' min · Visit ')+q.slots[i].stay+text('分',' min')+'</p><p>'+esc(q.d.actions[i][j])+'</p><p class="walk-observe">'+esc(s[j===0?4:5])+'</p>'+(q.d.sources?.[i]?'<a target="_blank" rel="noopener" href="'+esc(q.d.sources[i])+'">'+text('お店の公式情報','Official shop information')+' ↗</a>':'')+(q.r.legs[i]?'<p class="walk-leg">'+(i+1)+' → '+(i+2)+' · '+text('徒歩','Walk')+' '+q.r.legs[i].minutes+text('分',' min')+' / '+Math.round(q.r.legs[i].distance)+' m</p>':'')+'</li>').join('')+'</ol>'+(q.d.note?'<p>'+esc(q.d.note[j])+'</p>':'')+'<a class="walk-route-link" target="_blank" rel="noopener" href="'+routeURL+'">'+text('Google マップで徒歩経路を開く','Open walking directions in Google Maps')+' ↗</a><p class="walk-note">'+text('経路は2026年9月13日取得の道路データ、滞在はおすすめの配分です。信号・混雑・入場待ちで変わります。施設内の見学・入場料は別途。','Routes use road data retrieved September 13, 2026; visit times are suggestions. Signals, crowds and queues vary. Interior visits and admission are separate.')+' <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener">FOSSGIS</a></p>';
    panelShell({name:name(p),at:[p.lat,p.lng],bodyHTML:html,kicker:{emoji:'🚶',label:labels[LANG]||labels.en},share:{title:name(p),url:location.origin+location.pathname+'#walk-'+id},src:'OSM / FOSSGIS · 2026-09-13'});
    selected=p;lastPanel=()=>open(id,true);if(spotLayer){map.removeLayer(spotLayer);spotLayer=null;}
    if(!layer)layer=L.layerGroup().addTo(map);
    q.r.legs.forEach((leg,i)=>{L.polyline(leg.path,{color:'#fff',weight:9,interactive:false}).addTo(layer);L.polyline(leg.path,{color:colors[i],weight:5}).bindTooltip((i+1)+' → '+(i+2)+' · '+leg.minutes+text('分',' min')).addTo(layer);});
    p.stops.forEach((s,i)=>L.marker([s[2],s[3]],{title:s[j],icon:L.divIcon({className:'walk-number',html:'<span style="background:'+colors[i]+'">'+(i+1)+'</span>',iconSize:[32,32],iconAnchor:[16,16]})}).on('click',()=>focus(i,true)).addTo(layer));
    document.querySelectorAll('[data-walk-stop]').forEach(b=>b.onclick=()=>focus(Number(b.dataset.walkStop),false));$('walkFit').onclick=()=>{fit();$('panel').classList.remove('open');};
    map.invalidateSize();fit();drawDetail();if(!keepHistory)history.pushState({walk:id},'','#walk-'+id);
  }
  function restore(){if(!location.hash.startsWith('#walk-'))return false;const id=location.hash.slice(6);if(!ATLAS_WALKS.places.some(p=>p.id===id))return false;open(id,true);return true;}
  return {refresh,clear,open,restore,plan};
})();

window.AtlasTime=(()=>{
  let opened=false, generation=0;
  const label=()=>({ja:'時間を旅する',en:'Travel through time',ko:'시간 여행','zh-Hans':'穿越时光','zh-Hant':'穿越時光'})[LANG]||'Travel through time';
  const text=(ja,en)=>LANG==='ja'?ja:en;
  function paintButton(){const b=$('pCompare');b.hidden=!compareAt;b.textContent='◀▶ '+label();b.classList.toggle('is-on',opened);}
  function close(clearLayer=false){opened=false;++generation;const box=$('timeJourney');if(box)box.hidden=true;if(clearLayer&&map)setThenLayer(null,null);if($('pCompare'))paintButton();}
  async function open(){
    if(!compareAt)return;
    if(opened){close(true);return;}
    const at=compareAt,token=++generation;let userPicked=false;
    // Center once. Period switches keep the user's current position and divider.
    map.setView(at,Math.max(map.getZoom(),16));
    let box=$('timeJourney');if(!box){box=document.createElement('section');box.id='timeJourney';box.className='time-journey';$('place').append(box);}
    box.replaceChildren();box.hidden=false;
    const head=document.createElement('div');head.className='time-heading';const h=document.createElement('strong');h.textContent=label();const exit=document.createElement('button');exit.type='button';exit.textContent=text('閉じる','Close');exit.onclick=()=>close(true);head.append(h,exit);
    const years=document.createElement('div');years.className='time-years';years.setAttribute('role','group');years.setAttribute('aria-label',label());
    const note=document.createElement('p');note.setAttribute('role','status');note.textContent=text('写真を確認中…','Checking imagery…');box.append(head,years,note);
    const choose=cfg=>{const was=opened;opened=true;if(!was)centreSplit();setThenLayer(cfg?.id||null,cfg?.span||null);if(!cfg&&!map.hasLayer(nowLayer))nowLayer.addTo(map);years.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.year===(cfg?.id||'now'))));note.textContent=text('同じ場所を年代ごとに比較。撮影年・範囲は場所によって異なります。最新はリアルタイム写真ではありません。','Compare the same location across surveys. Dates and coverage vary. Latest imagery is not live.');paintButton();};
    for(const cfg of OLD_LAYERS){const b=document.createElement('button');b.type='button';b.dataset.year=cfg.id;b.textContent=cfg.span;b.disabled=true;b.setAttribute('aria-pressed','false');b.onclick=()=>{userPicked=true;choose(cfg);};years.append(b);}
    const now=document.createElement('button');now.type='button';now.dataset.year='now';now.textContent=text('最新','Latest');now.setAttribute('aria-pressed','false');now.onclick=()=>{userPicked=true;choose(null);};years.append(now);
    if(compareLayer)choose(compareLayer);else choose(null);
    opened=true;paintButton();$('panel').classList.remove('open');
    await pickOldLayer(at[0],at[1]);if(token!==generation||compareAt!==at)return;
    const {x,y}=deg2tile(at[0],at[1],16);let count=0;
    for(const cfg of OLD_LAYERS){const b=years.querySelector('[data-year="'+cfg.id+'"]');const ok=coverCache.get(cfg.id+'/'+x+'/'+y);b.disabled=!ok;if(ok)count++;else {b.title=text('この地点では写真を取得できません','Imagery unavailable at this point');b.textContent=cfg.span+' —';}}
    if(count&&!userPicked&&!thenLayer)choose(OLD_LAYERS.find(cfg=>coverCache.get(cfg.id+'/'+x+'/'+y)));
    if(!count)note.textContent=text('この地点の過去の写真は取得できませんでした。最新写真を表示しています。','Historic imagery could not be loaded here. Showing the latest imagery.');
  }
  return {open,close,paintButton,active:()=>opened};
})();
