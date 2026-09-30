import * as THREE from 'three/webgpu';
import {texture,positionWorld,mix,color,reflector,textureBicubic} from 'three/tsl';

// Original procedural study ground, not a documented 1912 paving/pond surface.
export function createWetGround({scene,ground,low=false}) {
 const size=128,bytes=new Uint8Array(size*size*4);
 const hash=(x,y)=>{let n=Math.imul(x,374761393)^Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return (n>>>0)/4294967295;};
 const noise=(x,y,period)=>{const X=Math.floor(x),Y=Math.floor(y),u=x-X,v=y-Y,U=u*u*(3-2*u),V=v*v*(3-2*v),sample=(a,b)=>hash(a%period,b%period);return (sample(X,Y)*(1-U)+sample(X+1,Y)*U)*(1-V)+(sample(X,Y+1)*(1-U)+sample(X+1,Y+1)*U)*V;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const value=.55*noise(x/size*7,y/size*7,7)+.3*noise(x/size*18,y/size*18,18)+.15*noise(x/size*48,y/size*48,48),i=(y*size+x)*4;bytes[i]=bytes[i+1]=bytes[i+2]=Math.round(value*255);bytes[i+3]=255;}
 const grain=new THREE.DataTexture(bytes,size,size);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.minFilter=grain.magFilter=THREE.LinearFilter;grain.needsUpdate=true;
 const sample=texture(grain,positionWorld.xz.mul(.025)).r,puddles=sample.smoothstep(.43,.62);
 const dry=new THREE.MeshStandardNodeMaterial({roughness:1});dry.colorNode=mix(color(0x504b40),color(0x6a6252),sample);
 const wet=new THREE.MeshStandardNodeMaterial({roughness:.25});wet.colorNode=dry.colorNode.mul(.42);wet.roughnessNode=puddles.mul(.6).oneMinus().mul(.65);
 let reflection=null;
 if(!low){reflection=reflector({resolutionScale:.35,bounces:false,generateMipmaps:true});reflection.target.rotation.x=-Math.PI/2;reflection.target.position.y=ground.position.y;scene.add(reflection.target);wet.emissiveNode=textureBicubic(reflection,puddles.oneMinus().mul(3)).rgb.mul(puddles.mul(.55).add(.08));}
 ground.material.dispose();ground.material=dry;
 return {setWet(value){ground.material=value?wet:dry;},dispose(){reflection?.dispose();dry.dispose();wet.dispose();grain.dispose();},label:low?'wet shading; reflections disabled':'wet procedural ground;35% planar reflection'};
}
