export const cushionFabricSettings=Object.freeze({pitchesMetres:[.002,.0026],amplitudeMetres:.00016,fadeCyclesPerPixel:[.2,.45],centre:[3.2,-5.215],yaw:.4});
export function resolveCushionFabricStudy({value=null,contour=null}={}){
 if(value===null)return null;
 if(!['0','0.5','1'].includes(value))throw new Error('Invalid cushion fabric comparison');
 if(contour?.revision!=='035'||contour?.perimeter!=='022')throw new Error('Fabric comparison requires retained005gap022');
 const gain=Number(value);
 return {gain,round:'cushion-fabric-119-006',path:gain?'/study/cushion-fabric-119-006/interior-cushion-fabric.glb':contour.path,exactSourceControl:gain===0};
}
