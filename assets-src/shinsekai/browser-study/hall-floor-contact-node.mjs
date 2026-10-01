import {positionLocal,materialColor,vec2,float,texture} from 'three/tsl';
// Blender X/-Z/Y planar bake. Keep UV0 and every source colour/normal map.
export function buildHallFloorContactNode(original,map,gain){
 if(gain===0)return original??materialColor;
 const uv=vec2(positionLocal.x.div(3.55),positionLocal.z.negate().div(17.2));
 const ao=texture(map,uv).r;
 return (original??materialColor).mul(float(1).sub(float(1).sub(ao).mul(gain)));
}
