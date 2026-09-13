/* Original atlas mark: a vermilion location pin, ivory clock and teal map.
   Dependency-free PNG output keeps builds portable and assets reproducible. */
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..');
const palette={teal:[27,72,64],paper:[255,248,225],red:[224,77,49],gold:[224,177,98]};
const circle=(x,y,cx,cy,r)=>(x-cx)**2+(y-cy)**2<=r*r;
function triangle(x,y,a,b,c){const s=(p,q)=>(x-q[0])*(p[1]-q[1])-(p[0]-q[0])*(y-q[1]);const d=[s(a,b),s(b,c),s(c,a)];return d.every(v=>v>=0)||d.every(v=>v<=0);}
function line(x,y,ax,ay,bx,by,w){const t=Math.max(0,Math.min(1,((x-ax)*(bx-ax)+(y-ay)*(by-ay))/((bx-ax)**2+(by-ay)**2)));return circle(x,y,ax+t*(bx-ax),ay+t*(by-ay),w/2);}
function color(x,y){
 let c=palette.teal;
 if(line(x,y,10,77,30,68,2)||line(x,y,30,68,73,84,2)||line(x,y,73,84,91,74,2)||line(x,y,24,90,37,61,2)||line(x,y,63,92,75,67,2))c=palette.gold;
 if(circle(x,y,50,39,29)||triangle(x,y,[25,53],[75,53],[50,83]))c=palette.red;
 if(circle(x,y,50,39,20))c=palette.paper;
 if(line(x,y,50,39,50,26,4)||line(x,y,50,39,61,44,4)||circle(x,y,50,39,2.5))c=palette.teal;
 return c;
}
function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length);t.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([t,data])),8+data.length);return out;}
function png(size){const raw=Buffer.alloc(size*(1+size*3));for(let y=0;y<size;y++)for(let x=0;x<size;x++){const sum=[0,0,0];for(let j=0;j<4;j++)for(let i=0;i<4;i++){const c=color((x+(i+.5)/4)*100/size,(y+(j+.5)/4)*100/size);for(let k=0;k<3;k++)sum[k]+=c[k];}for(let k=0;k<3;k++)raw[y*(1+size*3)+1+x*3+k]=Math.round(sum[k]/16);}const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
for(const size of [32,96,180,192,512])fs.writeFileSync(path.join(root,'icons','atlas-'+size+'.png'),png(size));
fs.writeFileSync(path.join(root,'icons','atlas.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="#1b4840"/><path d="M10 77 30 68 73 84 91 74M24 90 37 61M63 92 75 67" fill="none" stroke="#e0b162" stroke-width="2"/><path d="M25 53 50 83 75 53" fill="#e04d31"/><circle cx="50" cy="39" r="29" fill="#e04d31"/><circle cx="50" cy="39" r="20" fill="#fff8e1"/><path d="M50 26V39L61 44" fill="none" stroke="#1b4840" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
console.log('Built atlas icons (32–512px).');
