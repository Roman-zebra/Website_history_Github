/* Collision support for the existing reconstructed rooms, in crop-frame metres. */
(function(root){
  'use strict';
  const support = b => /jigokudan|stair-step|stair-landing|floor|slab|tatami|corridor|gallery|terrace|walkway|doma|genkan|duckboard|roof\d*$/i.test(b.t || '');
  const opening = b => /door|handle|curtain|line|water|shade|bulb/i.test(b.t || '') || b.k === 12;
  function inside(b,u,v,mpp,pad){
    const a=(b.r||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=(u-b.u)*mpp,z=(v-b.v)*mpp;
    return Math.abs(x*c+z*s)<=b.s[0]/2+pad && Math.abs(-x*s+z*c)<=b.s[2]/2+pad;
  }
  const indexes=new WeakMap(),cell=4;
  function nearby(sc,u,v,mpp){
    let index=indexes.get(sc);
    if(!index||index.mpp!==mpp){
      const bins=new Map();
      for(const b of sc.boxes){
        const a=(b.r||0)*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a)),hx=(c*b.s[0]+s*b.s[2])/2+.25,hz=(s*b.s[0]+c*b.s[2])/2+.25;
        const item={b,support:support(b),obstacle:!opening(b)&&!support(b)};
        for(let x=Math.floor((b.u*mpp-hx)/cell);x<=Math.floor((b.u*mpp+hx)/cell);x++)for(let z=Math.floor((b.v*mpp-hz)/cell);z<=Math.floor((b.v*mpp+hz)/cell);z++){
          const key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(item);
        }
      }
      index={mpp,bins};indexes.set(sc,index);
    }
    return index.bins.get(Math.floor(u*mpp/cell)+','+Math.floor(v*mpp/cell))||[];
  }
  function ground(sc,u,v,mpp,current){
    const items=nearby(sc,u,v,mpp);
    const under=items.filter(x=>x.support&&inside(x.b,u,v,mpp,0.025)).map(x=>x.b);
    const jigokudan=under.filter(b=>b.t==='jigokudan').sort((a,b)=>(a.u-u)**2+(a.v-v)**2-(b.u-u)**2-(b.v-v)**2);
    const floors=(jigokudan.length?jigokudan.slice(0,1):under).map(b=>b.y+b.s[1]).filter(y=>y<=current+0.4&&y>=current-0.6);
    if(!floors.length)return null;
    const y=Math.max(...floors);
    // The source scene's decorative rock volumes overlap two inferred treads.
    // Let the labelled stair surface win there, while structural props still collide.
    if(items.some(x=>x.obstacle&&!(jigokudan.length&&/^(rock|bush|trunk)$/.test(x.b.t||''))&&x.b.y+x.b.s[1]>y+0.4&&x.b.y<y+1.7&&inside(x.b,u,v,mpp,0.22)))return null;
    return y;
  }
  function spawn(sc,mpp){
    const c=sc.camera;
    for(let r=0;r<25;r+=0.4)for(let i=0,n=Math.max(1,Math.ceil(r*16));i<n;i++){
      const a=i/n*Math.PI*2,u=c.u+Math.cos(a)*r/mpp,v=c.v+Math.sin(a)*r/mpp;
      const y=ground(sc,u,v,mpp,sc.floor+0.15);
      if(y!==null)return {u,v,y};
    }
    return null;
  }
  const api={inside,ground,spawn};
  if(typeof module==='object')module.exports=api;else root.JTAWalkNav=api;
})(typeof window==='undefined'?this:window);
