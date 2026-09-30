import * as THREE from 'three/webgpu';
import {pass,renderOutput,texture3D,uniform,screenUV,rand,vec4} from 'three/tsl';
import {bloom} from 'three/addons/tsl/display/BloomNode.js';
import {lut3D} from 'three/addons/tsl/display/Lut3DNode.js';

// Claude108/dreamcore-study numerical art direction. Generated colours only;
// no reference-video pixels, new props or source architectural changes.
export function createShopDreamLook(renderer,scene,camera){
 const size=16,data=new Uint8Array(size**3*4);
 for(let b=0;b<size;b++)for(let g=0;g<size;g++)for(let r=0;r<size;r++){
  const rgb=[r/(size-1),g/(size-1),b/(size-1)],max=Math.max(...rgb),min=Math.min(...rgb),chroma=max-min;
  let h=chroma===0?0:max===rgb[0]?((rgb[1]-rgb[2])/chroma+6)%6:max===rgb[1]?(rgb[2]-rgb[0])/chroma+2:(rgb[0]-rgb[1])/chroma+4;
  h*=60;
  // Warm colours drift toward coral10deg; cyan/green toward teal185deg.
  const target=h<65||h>330?10:h>125&&h<235?185:h;
  const delta=((target-h+540)%360)-180;h=(h+delta*.55+360)%360;
  const c=chroma*.85,x=c*(1-Math.abs((h/60)%2-1)),m=max-c;
  const sectors=[[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]];
  const i=((b*size+g)*size+r)*4;
  sectors[Math.floor(h/60)].forEach((v,k)=>data[i+k]=Math.round(255*(.07+.88*(v+m))));data[i+3]=255;
 }
 const lut=new THREE.Data3DTexture(data,size,size,size);lut.minFilter=lut.magFilter=THREE.LinearFilter;lut.unpackAlignment=1;lut.needsUpdate=true;
 const scenePass=pass(scene,camera),beauty=scenePass.getTextureNode('output');
 // .7 is30% below the base threshold1; broad radius and modest strength.
 const glow=bloom(beauty,.2,.6,.7),tick=uniform(0),pipeline=new THREE.RenderPipeline(renderer);
 const graded=lut3D(renderOutput(beauty.add(glow)),texture3D(lut),size,uniform(1));
 const grain=rand(screenUV.mul(2048).add(tick)).sub(.5).mul(.04);
 pipeline.outputColorTransform=false;pipeline.outputNode=vec4(graded.rgb.add(grain).clamp(0,1),graded.a);
 return {render(time){tick.value=Math.floor(time*.024);pipeline.render();},dispose(){glow.dispose();scenePass.dispose();pipeline.dispose();lut.dispose();}};
}
