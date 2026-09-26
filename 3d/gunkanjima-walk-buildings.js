/* Walkable study volumes. Footprints/storeys come from the existing source model.
   Stair placement, partitions, furniture and colour are EXPLICITLY INFERRED, not measured. */
(function(root){
'use strict';
const MPP=.805;
function inPoly(p,poly){let v=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])v=!v;}return v;}
function plan(b,coast){
 if(/起重機|タンク|貯水槽|ベルトコンベア|ドルシックナー|風洞|桟橋/.test(b.name||''))return null;
 const poly=b.poly,angles=[];
 for(let i=0;i<poly.length;i++){const a=poly[i],q=poly[(i+1)%poly.length],length=Math.hypot(q[0]-a[0],q[1]-a[1]);angles.push({a:Math.atan2(q[1]-a[1],q[0]-a[0]),length});}
 angles.sort((a,b)=>b.length-a.length);
 for(const edge of angles.slice(0,4)){
  const a=edge.a,c=Math.cos(a),s=Math.sin(a),toLocal=p=>[(p[0]*c+p[1]*s)*MPP,(-p[0]*s+p[1]*c)*MPP],p=poly.map(toLocal),minX=Math.min(...p.map(v=>v[0])),maxX=Math.max(...p.map(v=>v[0])),minZ=Math.min(...p.map(v=>v[1])),maxZ=Math.max(...p.map(v=>v[1]));
  for(const dims of [[3.6,6.2],[3.2,5.6]])for(let x=minX+dims[0]/2;x<=maxX-dims[0]/2;x+=.55)for(let z=minZ+dims[1]/2;z<=maxZ-dims[1]/2;z+=.55){
   if([-1,0,1].every(i=>[-1,0,1].every(j=>(inPoly([x+i*dims[0]/2,z+j*dims[1]/2],p)&&(!coast||inPoly([((x+i*dims[0]/2)*c-(z+j*dims[1]/2)*s)/MPP,((x+i*dims[0]/2)*s+(z+j*dims[1]/2)*c)/MPP],coast))))))return {a,c,s,poly:p,x,z,width:dims[0],length:dims[1],minX,maxX,minZ,maxZ};
  }
 }
 return null;
}
function build(b,coast){
 const p=plan(b,coast);if(!p)return null;
 const boxes=[],height=b.floorH||2.85,floors=Math.max(1,Math.min(15,b.storeys||1)),base=b.ground+.12,run=p.length-2.0,lane=.66,stairWidth=1.05,steps=Math.ceil(height/2/.17),toUV=(x,z)=>[(x*p.c-z*p.s)/MPP,(x*p.s+z*p.c)/MPP];
 const put=(x,z,y,size,color,t,k=3,angle=p.a)=>{const q=toUV(x,z);boxes.push({u:q[0],v:q[1],y,s:size,c:color,t,k,r:angle*180/Math.PI});};
 const shaft=(x,z)=>Math.abs(x-p.x)<1.35&&z>p.z-run/2-.05&&z<p.z+run/2+.85;
 const routes=[];
 // Merge raster spans into floor slabs, leaving a real opening over both stair flights.
 for(let f=0;f<=floors;f++){
  const y=base+f*height,cell=.55;
  for(let z=p.minZ+cell/2;z<p.maxZ;z+=cell){let start=null;
   for(let x=p.minX+cell/2;x<=p.maxX+cell;x+=cell){
    const valid=x<p.maxX&&[-1,1].every(i=>[-1,1].every(j=>inPoly([x+i*cell*.49,z+j*cell*.49],p.poly)))&&!(f>0&&shaft(x,z));
    if(valid&&start===null)start=x;
    if(!valid&&start!==null){const end=x-cell;put((start+end)/2,z,y-.12,[end-start+cell,.12,cell+.015],f===floors?[.73,.77,.70]:[.78,.69,.51],'floor',f===floors?3:0);start=null;}
   }
  }
  // The stair-floor junction is kept whole so ascending and descending remain continuous.
  put(p.x,p.z-run/2-.55,y-.12,[2.8,.12,1.1],[.79,.74,.62],'stair-landing');
  if(f===floors)continue;
  for(let i=0;i<steps;i++){
   const d=run/steps,stepH=height/2/steps;
   put(p.x-lane,p.z-run/2+(i+.5)*d,y+i*stepH,[stairWidth,stepH,d+.025],[.89,.81,.66],'stair-step');
   put(p.x+lane,p.z+run/2-(i+.5)*d,y+height/2+i*stepH,[stairWidth,stepH,d+.025],[.89,.81,.66],'stair-step');
  }
  put(p.x,p.z+run/2+.43,y+height/2-.12,[2.8,.12,.86],[.76,.67,.49],'stair-landing');
  // Short handrail posts at the outside edges; the central turnaround remains open.
  for(const x of [p.x-1.28,p.x+1.28])for(let i=0;i<4;i++){const z=p.z-run/2+(i+.3)*run/4,offset=x<p.x?(z-p.z+run/2)/run:1+(p.z+run/2-z)/run;put(x,z,y+offset*height/2,[.045,.88,.045],[.31,.46,.49],'rail',6);}
  routes.push({floor:f,points:[[p.x-lane,p.z-run/2-.5,y],[p.x-lane,p.z-run/2+.04,y+.17],[p.x-lane,p.z+run/2-.04,y+height/2],[p.x-lane,p.z+run/2+.42,y+height/2],[p.x+lane,p.z+run/2+.42,y+height/2],[p.x+lane,p.z+run/2-.04,y+height/2+.17],[p.x+lane,p.z-run/2+.04,y+height],[p.x+lane,p.z-run/2-.5,y+height]]});
 }
 // Windowed perimeter walls for each storey; the roof is enclosed by a low parapet.
 for(let i=0;i<p.poly.length;i++){
  const a=p.poly[i],q=p.poly[(i+1)%p.poly.length],dx=q[0]-a[0],dz=q[1]-a[1],len=Math.hypot(dx,dz),angle=p.a+Math.atan2(dz,dx);
  for(let f=0;f<floors;f++){
   const y=base+f*height;put((a[0]+q[0])/2,(a[1]+q[1])/2,y,[len,.83,.13],[.87,.84,.71],'wall',11,angle);
   put((a[0]+q[0])/2,(a[1]+q[1])/2,y+height-.55,[len,.55,.13],[.91,.86,.71],'wall',11,angle);
   for(let d=0;d<len;d+=2.4)put(a[0]+dx*d/len,a[1]+dz*d/len,y+.83,[.12,height-1.38,.18],[.38,.56,.57],'window-frame',2,angle);
  }
  put((a[0]+q[0])/2,(a[1]+q[1])/2,base+floors*height,[len,.95,.15],[.75,.79,.69],'parapet',3,angle);
 }
 // A modest set of furnishings expresses the building use; no object is represented as archival evidence.
 const housing=/apartment|nikkyu|wood/.test(b.style),school=b.style==='school';
 for(let f=0;f<floors;f++){
  let count=0;
  for(let x=p.minX+2.3;x<p.maxX-2.3&&count<10;x+=4)for(let z=p.minZ+2.3;z<p.maxZ-2.3&&count<10;z+=4){
   if(Math.abs(x-p.x)<3.2&&Math.abs(z-p.z)<p.length/2+1.8)continue;
   if(![-1,-.5,0,.5,1].every(i=>[-1,-.5,0,.5,1].every(j=>inPoly([x+i*2.1,z+j*2.1],p.poly)&&(!coast||inPoly(toUV(x+i*2.1,z+j*2.1),coast)))))continue;
   const y=base+f*height;count++;
   if(housing){
    // Open-door study rooms, with a clear aisle around each inferred module.
    put(x,z,y+.01,[2.73,.035,2.73],[.66,.71,.39],'tatami',1);
    for(const dx of [-1.55,1.55])put(x+dx,z,y,[.09,2.25,3.1],[.89,.84,.68],'room-wall',11);
    put(x,z+1.55,y,[3.1,2.25,.09],[.89,.84,.68],'room-wall',11);
    for(const dx of [-1.04,1.04])put(x+dx,z-1.55,y,[1.02,2.25,.09],[.87,.81,.63],'room-wall',7);
    put(x,z-1.55,y+2.05,[1.1,.2,.09],[.49,.33,.19],'door-header',2);
    put(x,z,y+.05,[.75,.3,.5],[.52,.28,.12],'table',2);
    put(x+.98,z+.85,y,[.8,1.1,.48],[.38,.25,.14],'cabinet',2);
    put(x-.75,z+.8,y+.06,[.9,.12,.6],[.37,.53,.57],'cushion',9);
   }
   else if(school){put(x,z,y+.65,[.65,.08,.45],[.72,.46,.23],'desk',2);put(x,z,y,[.08,.65,.08],[.30,.37,.43],'desk-leg',6);}
   else{put(x,z,y,[.8,.6,.6],[.52,.40,.24],'crate',2);}
  }
 }
 const spawn=toUV(p.x-lane,p.z-run/2-.55);
 return {building:b.name,ghost:[b.name],floor:base,center:spawn,camera:{u:spawn[0],v:spawn[1],y:base+1.65,az:0,el:0,dist:2},label:{ja:(b.name||'名称未確認')+' · 1階〜屋上（推定）',en:(b.name||'Unnamed building')+' · floors & roof (inferred)'},text:{ja:'建物の輪郭・階数は既存資料モデルを使用。階段の位置・室内配置・家具・色は歩行体験のための推定で、当時の写真による精密復元ではありません。中央の折り返し階段を歩いて各階と屋上へ進めます。',en:'Footprints and storey counts use the source model. Stair positions, interior arrangement, furniture and colours are inferred for exploration, not a precise photographic reconstruction. Walk up the switchback stairs to each floor and the roof.'},sources:[{label:{ja:'実測資料集（NDL書誌・本文未取得）',en:'Measured-survey volume (catalogue; full text not acquired)'},url:'https://ndlsearch.ndl.go.jp/books/R100000002-I000007682767'}],boxes,walkPlan:{...p,base,height,floors,run,lane,routes},inferred:true};
}
const api={plan,build,inPoly};if(typeof module==='object')module.exports=api;else root.JTAWalkBuildings=api;
})(typeof window==='undefined'?this:window);
