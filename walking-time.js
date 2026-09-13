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
  function eligible(o){return !!o.at&&(o.adTier===1||o.kind==='food'||o.kind==='shopping'||PLACES.some(p=>p.id===o.placeId));}
  function distance(a,b){const rad=Math.PI/180,dlat=(b[0]-a[0])*rad,dlon=(b[1]-a[1])*rad;const h=Math.sin(dlat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dlon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
  const purposes={
    heritage:{icon:'🏛️',stay:20,names:['名所と歴史をじっくり','Sights & history','명소와 역사','名胜与历史','名勝與歷史'],notes:['史跡や寺社、街の成り立ちをたどる。','Trace historic places and the story of the city.']},
    food:{icon:'🍜',stay:30,names:['日本食とひと休み','Local food & a break','현지 음식과 휴식','美食与休息','美食與休息'],notes:['市場や食のスポットで、土地の味を楽しむ。','Pause at a market or a local food destination.']},
    shopping:{icon:'🛍️',stay:25,names:['買い物と街歩き','Shopping & streets','쇼핑과 거리 산책','购物与街巷','購物與街巷'],notes:['商店街や店先を眺め、お土産を探す。','Browse shopping streets and look for souvenirs.']},
    scenery:{icon:'📷',stay:10,names:['景色と写真を楽しむ','Scenery & photos','풍경과 사진','风景与摄影','風景與攝影'],notes:['水辺・公園・眺めのよい場所で立ち止まる。','Pause by the water, in a park or at a viewpoint.']},
    art:{icon:'🎨',stay:15,names:['街角のアートを探す','Art along the way','거리 예술 찾기','街角艺术','街角藝術'],notes:['屋外作品や美術館の周辺を見て歩く。館内の鑑賞は別途。','Look for public artworks and museum surroundings. Allow extra time for indoor visits.']},
    short:{icon:'🚶',stay:8,names:['近くを短くひと歩き','A short nearby walk','가까운 짧은 산책','附近短程散步','附近短程散步'],notes:['近くの見どころを1か所だけ。短い空き時間に。','One nearby stop for a short break.']}
  };
  const purposeName=key=>purposes[key].names[({ja:0,en:1,ko:2,'zh-Hans':3,'zh-Hant':4})[LANG]??1];
  function purposeOf(p,title){
    const tg=p.tags||{},kinds=new Set(),words=title+' '+(p.name||'')+' '+(p.ja||'');
    if(p.category==='food'||['restaurant','cafe','fast_food','food_court','marketplace','pub'].includes(tg.amenity))kinds.add('food');
    if(p.category==='shopping'||(tg.shop&&!['no','vacant'].includes(tg.shop)))kinds.add('shopping');
    if(tg.historic||tg.amenity==='place_of_worship'||tg.tourism==='museum'||/城|寺|神社|史跡|教会|castle|temple|shrine|historic|cathedral/i.test(words))kinds.add('heritage');
    if(tg.tourism==='viewpoint'||['park','garden'].includes(tg.leisure)||/公園|庭園|橋|水辺|港|海岸|展望|park|garden|bridge|waterfront|harbou?r|viewpoint/i.test(words))kinds.add('scenery');
    if(tg.tourism==='artwork'||/美術館|彫刻|art museum|sculpture/i.test(words))kinds.add('art');
    return [...kinds];
  }
  function candidates(o,extra=[]){
    const seen=[o.at],names=new Set([o.name]),points=[];
    const rows=[...ACTIVITIES,...PLACES,...LANDMARKS,...LOCALS,...extra].filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)).map(p=>({p,d:distance(o.at,[p.lat,p.lon])})).filter(x=>x.d>80&&x.d<=1800).sort((a,b)=>a.d-b.d);
    for(const {p,d} of rows){
      const at=[p.lat,p.lon],title=p.tags?localName(p.tags):placeName(p);
      if(!title||names.has(title)||['no','private'].includes(p.tags?.access)||seen.some(x=>distance(x,at)<80))continue;
      seen.push(at);names.add(title);
      points.push({at,name:title,d,purposes:purposeOf(p,title),official:p.official||'',description:p.hooks?.[LANG]||p.hooks?.en||p.summaries?.[LANG]||(p.tags?(p.tags['description:'+LANG]||(LANG==='ja'?p.tags.description:'')||localSummary(p.tags)):'')});
    }
    return points;
  }
  function nearby(o,extra=[]){return candidates(o,extra).slice(0,2);}
  function routeChoices(o,extra=[]){
    const pool=candidates(o,extra),choices=[],signatures=new Set();
    const courses=ATLAS_WALKS.places.filter(p=>distance(o.at,[p.lat,p.lng])<3000).sort((a,b)=>distance(o.at,[a.lat,a.lng])-distance(o.at,[b.lat,b.lng]));
    const coursePurpose=p=>p.variantOf?'food':['yokohama','kobe'].includes(p.id)?'scenery':'heritage';
    for(const key of ['heritage','food','shopping','scenery','art','short']){
      const course=courses.find(p=>coursePurpose(p)===key);
      let stops=pool.filter(p=>key==='short'||p.purposes.includes(key)).slice(0,key==='short'?1:2);
      if(!course&&!stops.length)continue;
      const points=course?course.stops.map(s=>({at:[s[2],s[3]],name:s[ix()]})):[{at:o.at,name:o.name},...stops];
      const signature=points.map(p=>p.at.map(n=>n.toFixed(4)).join(',')).sort().join('|');
      if(signatures.has(signature))continue;
      signatures.add(signature);
      choices.push({purpose:key,course,points:course?points:[{at:o.at,name:o.name,description:o.walkDescription||''},...stops]});
      if(choices.length===3)break;
    }
    return choices;
  }
  async function loadNearbyCatalog(o){
    try{
      const index=regionList||await fetch(dj('data/places-index.json'),{signal:AbortSignal.timeout(8000)}).then(r=>r.json());
      const [lat,lon]=o.at,dy=.018,dx=dy/Math.cos(lat*Math.PI/180);
      const regions=index.filter(r=>lat-dy<=r.b[2]&&lat+dy>=r.b[0]&&lon-dx<=r.b[3]&&lon+dx>=r.b[1]);
      const responses=await Promise.allSettled(regions.map(r=>regionRows.get(r.n)||fetch(dj('data/places-'+r.n+'.json'),{signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error('catalog');return r.json();})));
      return responses.flatMap(r=>r.status==='fulfilled'&&Array.isArray(r.value)?r.value:[]);
    }catch(e){return [];}
  }
  function attach(o){
    $('spotWalk')?.remove();if(!eligible(o))return;
    const box=document.createElement('section');box.id='spotWalk';box.className='spot-walk';
    const toggle=document.createElement('button');toggle.type='button';toggle.className='walk-toggle';toggle.textContent='🚶 '+(labels[LANG]||labels.en);toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','spotWalkOptions');
    const list=document.createElement('div');list.id='spotWalkOptions';list.hidden=true;let built=false;
    toggle.onclick=async()=>{
      list.hidden=!list.hidden;toggle.setAttribute('aria-expanded',String(!list.hidden));if(built||list.hidden)return;built=true;
      const status=document.createElement('p');status.setAttribute('role','status');status.textContent=text('目的に合う周辺のルートを探しています…','Finding walks for different interests…');list.append(status);
      const extra=await loadNearbyCatalog(o);if(!list.isConnected)return;
      const choices=routeChoices({...o,walkDescription:$('pStory').querySelector('p')?.textContent||''},extra);status.remove();
      const intro=document.createElement('p');intro.className='walk-choice-intro';intro.textContent=choices.length?text('今日の気分に合わせて、歩き方を選ぶ。','Choose a walk to suit your mood.'):text('近くにルートを作れる登録スポットがありません。','No nearby registered stops are available for a walk.');list.append(intro);
      if(choices.length<3&&choices.length){const note=document.createElement('p');note.className='walk-choice-note';note.textContent=text('この場所で案内できる目的別ルートを表示しています。','Showing the themed walks available near this place.');list.append(note);}
      choices.forEach((choice,i)=>{
        const b=document.createElement('button');b.type='button';b.className='walk-purpose-card';b.dataset.purpose=choice.purpose;b.setAttribute('aria-pressed','false');
        const title=document.createElement('strong');title.textContent=purposes[choice.purpose].icon+' '+purposeName(choice.purpose);
        const brief=document.createElement('span');brief.className='walk-choice-brief';brief.textContent=purposes[choice.purpose].notes[ix()];
        const via=document.createElement('span');via.className='walk-choice-via';via.textContent=choice.points.map(p=>p.name).join(' → ');
        const budget=document.createElement('span');budget.className='walk-choice-budget';budget.textContent=choice.course?plan(choice.course).total+text('分・徒歩と滞在込み',' min including walking and visits'):text('滞在目安 ','Suggested visits: ')+(15+(choice.points.length-1)*purposes[choice.purpose].stay)+text('分 ＋ 徒歩（選択後に表示）',' min + walking (shown after selection)');
        b.append(title,brief,via,budget);b.onclick=()=>{list.querySelectorAll('[data-purpose]').forEach(el=>{el.setAttribute('aria-pressed',String(el===b));el.disabled=false;});localRoute(o,list,b,choice);};list.append(b);
      });
    };
    box.append(toggle,list);$('pStory').before(box);
  }
  async function localRoute(o,list,button,choice){
    list.querySelector('[data-nearby-result]')?.remove();const result=document.createElement('div');result.dataset.nearbyResult='';list.append(result);clear();
    button.disabled=true;const status=document.createElement('p');status.setAttribute('role','status');status.textContent=text('徒歩経路を確認中…','Checking walking directions…');result.append(status);
    const cfg=purposes[choice.purpose],q=choice.course?plan(choice.course):null;
    const points=q?choice.course.stops.map((s,i)=>({at:[s[2],s[3]],name:s[ix()],description:q.d.actions[i][ix()],official:q.d.sources?.[i]})):choice.points;
    const stays=q?q.d.stay:points.map((p,i)=>i===0?15:cfg.stay);
    const link=document.createElement('a');link.className='walk-route-link';link.target='_blank';link.rel='noopener';link.textContent=text('Google マップで徒歩経路を開く ↗','Open walking directions in Google Maps ↗');link.href='https://www.google.com/maps/dir/?api=1&travelmode=walking&origin='+points[0].at.join(',')+'&destination='+points.at(-1).at.join(',')+'&waypoints='+encodeURIComponent(points.slice(1,-1).map(p=>p.at.join(',')).join('|'));result.append(link);
    try{
      let legs,path,distanceM;
      if(q){legs=q.r.legs;path=legs.flatMap(l=>l.path);distanceM=q.r.distance;}
      else{
        const coords=points.map(p=>p.at[1]+','+p.at[0]).join(';');
        const response=await fetch('https://routing.openstreetmap.de/routed-foot/route/v1/driving/'+coords+'?overview=full&geometries=geojson&steps=true',{signal:AbortSignal.timeout(12000)});const json=await response.json();
        if(!result.isConnected)return;if(!response.ok||json.code!=='Ok'||!json.routes?.length)throw Error('route');
        const r=json.routes[0];if(r.distance>8000)throw Error('detour');
        legs=r.legs.map(l=>({minutes:Math.max(1,Math.ceil(l.duration/60)),distance:l.distance,path:l.steps.flatMap(s=>s.geometry.coordinates.map(c=>[c[1],c[0]]))}));path=r.geometry.coordinates.map(c=>[c[1],c[0]]);distanceM=r.distance;
      }
      if(!result.isConnected)return;if(!layer)layer=L.layerGroup().addTo(map);
      const walk=legs.reduce((a,l)=>a+l.minutes,0),stay=stays.reduce((a,b)=>a+b,0),buffer=q?q.buffer:5,total=walk+stay+buffer;
      status.textContent=purposeName(choice.purpose)+' · '+total+text('分',' min')+' · '+(distanceM/1000).toFixed(2)+' km';
      const breakdown=document.createElement('p');breakdown.className='walk-choice-budget';breakdown.textContent=text('徒歩 ','Walk ')+walk+text('分・滞在 ',' min · Visits ')+stay+text('分・余裕 ',' min · Buffer ')+buffer+text('分',' min');result.insertBefore(breakdown,link);
      const stops=document.createElement('ol');stops.className='walk-stops';let elapsed=0;
      points.forEach((p,i)=>{
        const item=document.createElement('li');item.className='walk-stop';item.style.setProperty('--walk-color',colors[i]);
        const title=document.createElement('button');title.type='button';title.textContent=(i+1)+'. '+p.name;title.onclick=()=>{map.setView(p.at,17);$('panel').classList.remove('open');};
        const timing=document.createElement('p');timing.className='walk-time';timing.textContent=elapsed+'–'+(elapsed+stays[i])+text('分・滞在 ',' min · Visit ')+stays[i]+text('分',' min');
        const desc=document.createElement('p');desc.textContent=p.description||cfg.notes[ix()];item.append(title,timing,desc);
        if(p.official){const official=document.createElement('a');official.target='_blank';official.rel='noopener';official.href=p.official;official.textContent=text('公式の訪問案内 ↗','Official visitor information ↗');item.append(official);}
        if(legs[i]){const leg=document.createElement('p');leg.className='walk-leg';leg.textContent=(i+1)+' → '+(i+2)+' · '+legs[i].minutes+text('分の徒歩',' min walk');item.append(leg);}
        elapsed+=stays[i]+(legs[i]?.minutes||0);stops.append(item);
        L.marker(p.at,{title:p.name,icon:L.divIcon({className:'walk-number',html:'<span style="background:'+colors[i]+'">'+(i+1)+'</span>',iconSize:[32,32],iconAnchor:[16,16]})}).bindTooltip(p.name).addTo(layer);
      });
      legs.forEach((leg,i)=>{L.polyline(leg.path,{color:'#fff',weight:9,interactive:false}).addTo(layer);L.polyline(leg.path,{color:colors[i],weight:5}).bindTooltip(leg.minutes+text('分',' min')).addTo(layer);});result.insertBefore(stops,link);
      const fitButton=document.createElement('button');fitButton.type='button';fitButton.className='walk-fit';fitButton.textContent=text('ルート全体を地図で見る','See the full route on the map');const fitRoute=()=>map.fitBounds(L.latLngBounds(path),{padding:[50,100],maxZoom:17});fitButton.onclick=()=>{fitRoute();$('panel').classList.remove('open');};result.insertBefore(fitButton,stops);fitRoute();
      const note=document.createElement('p');note.className='walk-note';note.textContent=(q?.d.note?q.d.note[ix()]+' ':'')+text('滞在時間はおすすめの配分です。混雑・営業・通行状況で変わります。館内の見学や入場は別途。','Visit times are suggested budgets. Crowds, opening and access conditions vary. Interior visits and admission are separate.');result.append(note);
      map.attributionControl.addAttribution('<a href="https://routing.openstreetmap.de/about.html">Routing: FOSSGIS / OSM</a>');
      button.querySelector('.walk-choice-budget').textContent=total+text('分・徒歩と滞在込み',' min including walking and visits');
    }catch(e){if(!result.isConnected)return;status.textContent=text('徒歩経路を取得できませんでした。Google マップで次の地点を結ぶ経路を確認できます：','Walking geometry could not be loaded. Open Google Maps for directions via: ')+points.map(p=>p.name).join(' → ');}
    finally{button.disabled=false;}
  }

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
    panelShell({name:name(p),at:[p.lat,p.lng],bodyHTML:html,kicker:{emoji:'🚶',label:labels[LANG]||labels.en},share:{title:name(p),url:location.origin+location.pathname+'?lang='+(LANG_PARAM[LANG]||'en')+'#walk-'+id},src:'OSM / FOSSGIS · 2026-09-13'});
    selected=p;lastPanel=()=>open(id,true);if(spotLayer){map.removeLayer(spotLayer);spotLayer=null;}
    if(!layer)layer=L.layerGroup().addTo(map);
    q.r.legs.forEach((leg,i)=>{L.polyline(leg.path,{color:'#fff',weight:9,interactive:false}).addTo(layer);L.polyline(leg.path,{color:colors[i],weight:5}).bindTooltip((i+1)+' → '+(i+2)+' · '+leg.minutes+text('分',' min')).addTo(layer);});
    p.stops.forEach((s,i)=>L.marker([s[2],s[3]],{title:s[j],icon:L.divIcon({className:'walk-number',html:'<span style="background:'+colors[i]+'">'+(i+1)+'</span>',iconSize:[32,32],iconAnchor:[16,16]})}).on('click',()=>focus(i,true)).addTo(layer));
    document.querySelectorAll('[data-walk-stop]').forEach(b=>b.onclick=()=>focus(Number(b.dataset.walkStop),false));$('walkFit').onclick=()=>{fit();$('panel').classList.remove('open');};
    map.invalidateSize();fit();drawDetail();if(!keepHistory)history.pushState({walk:id},'','#walk-'+id);
  }
  function restore(){if(!location.hash.startsWith('#walk-'))return false;const id=location.hash.slice(6);if(!ATLAS_WALKS.places.some(p=>p.id===id))return false;open(id,true);return true;}
  return {refresh,clear,open,restore,plan,attach,eligible,nearby,routeChoices,purposeOf};
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
