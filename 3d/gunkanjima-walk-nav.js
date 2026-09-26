/* Collision support for the existing reconstructed rooms, in crop-frame metres. */
(function(root){
  'use strict';
  const support = b => /floor|slab|tatami|corridor|gallery|terrace|walkway|doma|genkan|duckboard|roof\d*$/i.test(b.t || '');
  const opening = b => /door|handle|curtain|line|water|shade|bulb/i.test(b.t || '') || b.k === 12;
  function inside(b,u,v,mpp,pad){
    const a=(b.r||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=(u-b.u)*mpp,z=(v-b.v)*mpp;
    return Math.abs(x*c+z*s)<=b.s[0]/2+pad && Math.abs(-x*s+z*c)<=b.s[2]/2+pad;
  }
  function ground(sc,u,v,mpp,current){
    const floors=sc.boxes.filter(b=>support(b)&&inside(b,u,v,mpp,-0.2)).map(b=>b.y+b.s[1]).filter(y=>y<=current+0.4&&y>=current-0.6);
    if(!floors.length)return null;
    const y=Math.max(...floors);
    if(sc.boxes.some(b=>!opening(b)&&b.y+b.s[1]>y+0.4&&b.y<y+1.7&&inside(b,u,v,mpp,0.22)))return null;
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
