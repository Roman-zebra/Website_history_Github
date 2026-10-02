import {positionWorld,materialColor,vec2,float,texture} from 'three/tsl';
export function buildHaoriWallContactNode(original,map,gain){
 if(gain===0)return original??materialColor;
 // Blender X/Y/Z becomes browser X/Z/-Y; white border avoids patch seams.
 const uv=vec2(positionWorld.z.negate().sub(1).div(2.4),positionWorld.y.sub(3.35).div(2.2));
 const mask=uv.x.greaterThanEqual(0).and(uv.x.lessThanEqual(1)).and(uv.y.greaterThanEqual(0)).and(uv.y.lessThanEqual(1)).and(positionWorld.x.sub(.18).abs().lessThan(.02)).select(1,0);
 return (original??materialColor).mul(float(1).sub(float(1).sub(texture(map,uv).r).mul(gain).mul(mask)));
}
