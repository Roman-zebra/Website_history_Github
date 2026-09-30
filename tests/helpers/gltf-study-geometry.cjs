const fs=require('node:fs');
exports.read=function(file){
 const bytes=fs.readFileSync(file),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length)),binary=bytes.subarray(28+length);
 const node=name=>json.nodes.findIndex(n=>n.name===name);
 const descendants=i=>[i,...(json.nodes[i].children??[]).flatMap(descendants)];
 const triangles=i=>descendants(i).reduce((sum,j)=>sum+(json.nodes[j].mesh===undefined?0:json.meshes[json.nodes[j].mesh].primitives.reduce((n,p)=>n+json.accessors[p.indices].count/3,0)),0);
 const data=(index,size)=>{const a=json.accessors[index],v=json.bufferViews[a.bufferView],result=[],width=({5126:4,5125:4,5123:2,5121:1})[a.componentType],stride=v.byteStride??size*width;
  for(let i=0;i<a.count;i++){const start=(v.byteOffset??0)+(a.byteOffset??0)+stride*i;result.push(Array.from({length:size},(_,j)=>a.componentType===5126?binary.readFloatLE(start+j*width):a.componentType===5125?binary.readUInt32LE(start+j*width):a.componentType===5123?binary.readUInt16LE(start+j*width):binary.readUInt8(start+j)));}return result;};
 return {json,bytes,node,descendants,triangles,data};
};
exports.rays=async function(asset,roots){
 const {Matrix4,Quaternion,Vector3,Ray}=await import('../../vendor/three-r186/build/three.core.js'),faces=[];
 const visit=(index,parent)=>{const n=asset.json.nodes[index],world=new Matrix4();if(n.matrix)world.fromArray(n.matrix);else world.compose(new Vector3(...(n.translation??[0,0,0])),new Quaternion(...(n.rotation??[0,0,0,1])),new Vector3(...(n.scale??[1,1,1])));world.premultiply(parent);
  if(n.mesh!==undefined)for(const p of asset.json.meshes[n.mesh].primitives){const vertices=asset.data(p.attributes.POSITION,3).map(v=>new Vector3(...v).applyMatrix4(world)),indices=asset.data(p.indices,1).flat();for(let i=0;i<indices.length;i+=3)faces.push(indices.slice(i,i+3).map(j=>vertices[j]));}
  for(const i of n.children??[])visit(i,world);};
 for(const root of roots)visit(asset.node(root),new Matrix4());
 return(origin,direction)=>{const ray=new Ray(new Vector3(...origin),new Vector3(...direction)),point=new Vector3();let nearest=Infinity;for(const f of faces)if(ray.intersectTriangle(...f,false,point))nearest=Math.min(nearest,point.distanceTo(ray.origin));return nearest;};
};
