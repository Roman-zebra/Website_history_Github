import {VelocityNode} from 'three/webgpu';
import {Fn,attribute,vec4,positionGeometry,modelViewMatrix,cameraProjectionMatrix,nodeObject} from 'three/tsl';

// Default r186 velocity assumes the geometry's original vertex positions. These
// static bulb fixtures instead put a billboard at bulbOffset, with identity world
// transforms. Use the prior camera's billboard corners for temporal reprojection.
export function fixtureVelocity(unjitteredProjection) {
 class FixtureVelocityNode extends VelocityNode {
  setup(builder) {
   if(!builder.geometry.hasAttribute('bulbOffset'))return super.setup(builder);
   return Fn(()=>{
    const offset=vec4(attribute('bulbOffset','vec3'),1),corner=positionGeometry.xy.mul(.23);
    const current=modelViewMatrix.mul(offset),previous=this.previousCameraViewMatrix.mul(offset);
    const currentClip=unjitteredProjection.mul(vec4(current.xy.add(corner),current.zw));
    const previousClip=this.previousProjectionMatrix.mul(vec4(previous.xy.add(corner),previous.zw));
    return currentClip.xy.div(currentClip.w).sub(previousClip.xy.div(previousClip.w));
   })();
  }
 }
 return nodeObject(new FixtureVelocityNode());
}
