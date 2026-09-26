/* Walking-only completion of the source cutaways. All added finishes, enclosure
   details and light fittings are inferred visual studies, not measured history. */
(function(root){
'use strict';
const MPP=.805;
const profiles={
 gym:{tags:['floor'],height:7,public:true},
 school:{tags:['floor'],height:3.35,public:true},
 hospital:{tags:['p-tile-floor'],height:2.65,public:true},
 bath:{tags:['floor'],height:2.55,tile:true},
 no3:{tags:['floor'],height:2.6},
 no65flat:{tags:['doma','tatami'],height:2.65,door:true},
 nikkyu:{tags:['doma','tatami'],height:2.65,door:true},
 no30:{tags:['tatami','doma'],height:2.65,door:true},
 no65roof:{tags:['nursery-floor'],height:2.9,door:true,public:true}
};
function complete(sc,id){
 const spec=profiles[id];if(!spec||sc.walkEnclosed)return sc;
 const floors=sc.boxes.filter(b=>spec.tags.includes(b.t));if(!floors.length)return sc;
 const anchor=floors[0],angle=(anchor.r||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 const local=(u,v)=>[(u-anchor.u)*MPP*c+(v-anchor.v)*MPP*s,-(u-anchor.u)*MPP*s+(v-anchor.v)*MPP*c];
 const world=(x,z)=>[anchor.u+(x*c-z*s)/MPP,anchor.v+(x*s+z*c)/MPP];
 let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;
 for(const b of floors){const q=local(b.u,b.v);x0=Math.min(x0,q[0]-b.s[0]/2);x1=Math.max(x1,q[0]+b.s[0]/2);z0=Math.min(z0,q[1]-b.s[2]/2);z1=Math.max(z1,q[1]+b.s[2]/2);}
 // Some source floors include the corridor apron beyond their window wall.
 if(id==='school'||id==='hospital'){
  const wall=sc.boxes.find(b=>b.t==='window-wall');if(wall){const q=local(wall.u,wall.v);if(q[1]<0)z0=Math.max(z0,q[1]);else z1=Math.min(z1,q[1]);}
 }
 const base=Math.min(...floors.map(b=>b.y+b.s[1])),height=spec.height,added=[],windows=[];
 // Replace only perimeter masonry, retaining all internal partitions and furniture.
 const boxes=sc.boxes.filter(b=>{
  if(!/wall$/.test(b.t||''))return true;
  const q=local(b.u,b.v),a=(b.r||0)*Math.PI/180-angle;
  const hx=(Math.abs(Math.cos(a))*b.s[0]+Math.abs(Math.sin(a))*b.s[2])/2,hz=(Math.abs(Math.sin(a))*b.s[0]+Math.abs(Math.cos(a))*b.s[2])/2;
  return !((hz<.25&&(Math.abs(q[1]-z0)<.3||Math.abs(q[1]-z1)<.3))||(hx<.25&&(Math.abs(q[0]-x0)<.3||Math.abs(q[0]-x1)<.3)));
 });
 const put=(x,z,y,size,color,t,k=11,r=0)=>{const q=world(x,z);const b={u:q[0],v:q[1],y,s:size,c:color,t,k,r:(angle+r)*180/Math.PI,a:1};boxes.push(b);added.push(b);return b;};
 const plaster=spec.tile?[.77,.83,.79]:[.83,.79,.65],timber=[.29,.22,.15],trim=[.49,.39,.24],panel=spec.public?[.36,.47,.46]:[.48,.36,.23];
 const sides=[{axis:0,at:z0,lo:x0,hi:x1,sign:-1},{axis:0,at:z1,lo:x0,hi:x1,sign:1},{axis:1,at:x0,lo:z0,hi:z1,sign:-1},{axis:1,at:x1,lo:z0,hi:z1,sign:1}];
 for(const side of sides){
  const horizontal=side.axis===0,span=side.hi-side.lo,openings=[];
  for(const b of sc.boxes){
   if(b.k!==8||b.s[1]<.35)continue;
   const q=local(b.u,b.v),across=horizontal?q[1]:q[0],along=horizontal?q[0]:q[1];
   if(Math.abs(across-side.at)>.35)continue;
   const a=(b.r||0)*Math.PI/180-angle,extent=horizontal?Math.abs(Math.cos(a))*b.s[0]+Math.abs(Math.sin(a))*b.s[2]:Math.abs(Math.sin(a))*b.s[0]+Math.abs(Math.cos(a))*b.s[2];
   const bottom=Math.max(.5,b.y-base),top=Math.min(height-.15,b.y-base+b.s[1]);
   if(extent>.3&&top>bottom)openings.push({lo:Math.max(side.lo,along-extent/2),hi:Math.min(side.hi,along+extent/2),bottom,top});
  }
  // Keep an open passage to the existing corridor/terrace in the small room scenes.
  if(spec.door&&side===sides[1]){const mid=(side.lo+side.hi)/2;openings.push({lo:mid-.65,hi:mid+.65,bottom:0,top:Math.min(2.2,height-.2),door:true});}
  const alongPut=(u,y,w,h,depth,color,tag,k=11,inset=0)=>horizontal?put(u,side.at-side.sign*inset,y,[w,h,depth],color,tag,k):put(side.at-side.sign*inset,u,y,[depth,h,w],color,tag,k);
  // Tile the actual wall around each opening, so glass never substitutes for missing masonry.
  const xs=[side.lo,side.hi,...openings.flatMap(o=>[o.lo,o.hi])].sort((a,b)=>a-b),ys=[0,height,...openings.flatMap(o=>[o.bottom,o.top])].sort((a,b)=>a-b);
  for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){
   const w=xs[i]-xs[i-1],h=ys[j]-ys[j-1],u=(xs[i]+xs[i-1])/2,y=(ys[j]+ys[j-1])/2;if(w<.001||h<.001)continue;
   if(openings.some(o=>u>o.lo&&u<o.hi&&y>o.bottom&&y<o.top))continue;
   alongPut(u,base+ys[j-1],w,h,.19,plaster,'walk-enclosure-wall',spec.tile?5:11,-.07);
  }
  // Framed openings and low wall panelling; these details stay behind the walkable floor edge.
  for(const o of openings){
   const mid=(o.lo+o.hi)/2,w=o.hi-o.lo,h=o.top-o.bottom;
   for(const u of [o.lo,o.hi])alongPut(u,base+o.bottom,.065,h,.24,timber,'walk-window-jamb',2);
   alongPut(mid,base+o.top,w+.08,.08,.25,trim,'walk-window-lintel',2);
   if(!o.door){alongPut(mid,base+o.bottom,w+.14,.075,.30,trim,'walk-window-sill',2);alongPut(mid,base+o.bottom,.045,h,.12,timber,'walk-window-mullion',2);windows.push({side:side.axis,at:side.at,...o});}
  }
  const count=Math.max(1,Math.ceil(span/2.6));
  for(let i=0;i<count;i++){
   const u=side.lo+(i+.5)*span/count,w=span/count-.08;
   if(openings.some(o=>o.bottom<1.1&&u+w/2>o.lo&&u-w/2<o.hi))continue;
   alongPut(u,base+.12,w,.80,.055,panel,'walk-wainscot',spec.tile?5:2,.045);
   alongPut(u,base+.94,w,.07,.085,trim,'walk-dado-rail',2,.06);
   alongPut(u,base,w,.13,.12,timber,'walk-skirting',2,.08);
  }
  alongPut((side.lo+side.hi)/2,base+height-.18,span,.14,.23,trim,'walk-cornice',2,.06);
  for(let u=side.lo+.12;u<side.hi;u+=Math.max(2.8,span/6)){
   if(openings.some(o=>u>o.lo-.2&&u<o.hi+.2))continue;
   alongPut(u,base,.14,height,.16,trim,'walk-pilaster',2,.08);
  }
 }
 // A full ceiling closes the cutaway; a warm inset panel and cross beams give it depth.
 put((x0+x1)/2,(z0+z1)/2,base+height,[x1-x0+.35,.16,z1-z0+.35],[.69,.69,.59],'walk-ceiling',11);
 const beams=Math.max(2,Math.min(7,Math.ceil((x1-x0)/3.2)));
 for(let i=0;i<beams;i++)put(x0+(i+.5)*(x1-x0)/beams,(z0+z1)/2,base+height-.23,[.16,.23,z1-z0],timber,'walk-ceiling-beam',2);
 const lights=[];
 for(let i=0;i<(id==='gym'?4:2);i++){
  const x=x0+(i+1)*(x1-x0)/((id==='gym'?4:2)+1),z=(z0+z1)/2,drop=id==='gym'?1.1:.3,ly=base+height-drop;
  put(x,z,ly,[.025,drop,.025],timber,'walk-lamp-cord',6);
  put(x,z,ly-.12,[.6,.18,.45],trim,'walk-lamp-shade',6);
  put(x,z,ly-.14,[.48,.05,.34],[1,.81,.43],'walk-lamp-glow',14);
  const q=world(x,z);lights.push({u:q[0],v:q[1],y:ly-.2,radius:id==='gym'?8:4});
 }
 if(id==='gym'){
  // Court lines, stage steps and wall details: inferred styling on the existing gym footprint.
  const white=[.90,.85,.65],fw=x1-x0,fd=z1-z0;
  for(const z of [z0+1.3,z1-1.3])put((x0+x1)/2,z,base+.014,[fw-2.6,.015,.055],white,'court-line',0);
  for(const x of [x0+1.3,(x0+x1)/2,x1-1.3])put(x,(z0+z1)/2,base+.014,[.055,.015,fd-2.6],white,'court-line',0);
  for(let i=0;i<40;i++){const a=i*Math.PI/20,x=(x0+x1)/2+1.8*Math.cos(a),z=(z0+z1)/2+1.8*Math.sin(a);put(x,z,base+.016,[.30,.018,.055],white,'court-line',0,a+Math.PI/2);}
  for(let i=0;i<5;i++)put(x0+5.05-i*.27,z1-2.3,base,[.3,.18*(i+1),1.2],trim,'stair-step',2);
  // Benches along the side wall, clear of the central court.
  for(const x of [-3.5,1.5,6.5]){put(x,z0+.65,base+.43,[3,.09,.48],trim,'bench-seat',2);for(const dx of [-1.1,1.1])put(x+dx,z0+.65,base,[.10,.43,.38],timber,'bench-leg',2);}
 }
 const note={ja:'歩行用に補った壁・天井・装飾・照明は推定です。',en:'Enclosures, finishes and lighting added for walking are inferred.'};
 return {...sc,boxes,walkEnclosed:true,walkEnvelope:{x0,x1,z0,z1,base,height,angle,u:anchor.u,v:anchor.v,windows},walkLights:lights,text:{...sc.text,ja:(sc.text.ja||'')+' '+note.ja,en:(sc.text.en||'')+' '+note.en}};
}
const api={complete,profiles};if(typeof module==='object')module.exports=api;else root.JTAWalkInteriors=api;
})(typeof window==='undefined'?this:window);
