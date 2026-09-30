// Explicit look-dev placement assumptions; no surveyed tram/ropeway alignment.
export function catenaryPoints(a,b,sag=1,segments=32) {
 if(![...a,...b,sag].every(Number.isFinite)||a.length!==3||b.length!==3||a[1]!==b[1]||!Number.isInteger(segments)||segments<2)throw new Error('Catenary needs finite, level endpoints and segments');
 const span=Math.hypot(b[0]-a[0],b[2]-a[2]);if(span<=0||sag<0||sag>span*.5)throw new Error('Catenary span/sag out of study bounds');
 let radius=Infinity;
 if(sag>span*1e-8){let lo=span/200,hi=span*span/(4*sag);for(let i=0;i<70;i++){const m=(lo+hi)/2,drop=m*(Math.cosh(span/(2*m))-1);if(drop>sag)lo=m;else hi=m;}radius=(lo+hi)/2;}
 return Array.from({length:segments+1},(_,i)=>{const t=i/segments,drop=Number.isFinite(radius)?radius*(Math.cosh((t-.5)*span/radius)-Math.cosh(span/(2*radius))):0;return [a[0]+(b[0]-a[0])*t,a[1]+drop,a[2]+(b[2]-a[2])*t];});
}
export function bulbOutlineGroups({roof=15.15,shaftTop=58.7892,galleryFloor=63.4183}={}) {
 if(![roof,shaftTop,galleryFloor].every(Number.isFinite)||roof<0||shaftTop<=roof||galleryFloor<=shaftTop)throw new Error('Invalid outline levels');
 const groups=[],edge=(a,b,points)=>{const count=Math.ceil(Math.hypot(...a.map((n,i)=>b[i]-n))/.8);for(let i=0;i<count;i++)points.push(a.map((n,j)=>n+(b[j]-n)*i/count));};
 for(const [tier,w,d,y] of [['roof',14.8,13,roof+.15],['band',4.15,3.95,shaftTop+.1],['gallery',4.15,3.95,galleryFloor+.15]]) {
  const points=[],corners=[[-w,y,-d],[w,y,-d],[w,y,d],[-w,y,d]];for(let i=0;i<4;i++)edge(corners[i],corners[(i+1)%4],points);groups.push({id:'tower-bulbs-'+tier,area:'tower',tier,points});
 }
 const points=[];
 for(const x of [-1,1])for(const z of [-1,1])for(let y=roof+.7;y<shaftTop;y+=.8){const u=(shaftTop-y)/(shaftTop-roof-.7),mid=(.59-.47)/(1-.47),s=(u-.55)/.45,p=u<=.55?mid*u/.55:mid+(mid/.55*.45)*s+(1-mid-mid/.55*.45)*s*s;points.push([x*(2.65+(5.7-2.65)*p),y,z*(2.4+(5.7-2.4)*p)]);}
 groups.push({id:'tower-bulbs-shaft',area:'tower',tier:'shaft',points});return groups;
}
export function bulbOutline(args){return bulbOutlineGroups(args).flatMap(g=>g.points);}
