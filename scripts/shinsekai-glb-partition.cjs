// Lossless authored-group partitions. No triangle trimming, welding or resampling.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {readGlb,extractRoot}=require('./shinsekai-glb-cell.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function partitionGlb(bytes,{root,sourceSha256,parts,lightOwner}={}){
 if(sourceSha256!==sha(bytes))throw new Error('Source hash mismatch');
 const source=readGlb(bytes),doc=source.json,rootIds=doc.nodes.map((n,i)=>n.name===root?i:-1).filter(i=>i>=0);
 if(rootIds.length!==1)throw new Error('One uniquely named root required');
 if(!parts||!Object.keys(parts).length||!Object.hasOwn(parts,lightOwner))throw new Error('Explicit partitions and light owner required');
 const active=new Set(),walk=id=>{if(active.has(id))throw new Error('Shared/cyclic hierarchy rejected');active.add(id);for(const child of doc.nodes[id].children??[])walk(child);};walk(rootIds[0]);
 const meshNodes=[...active].filter(id=>doc.nodes[id].mesh!==undefined),names=new Map();
 for(const id of meshNodes){const name=doc.nodes[id].name;if(!name||names.has(name))throw new Error('Mesh nodes need unique names');names.set(name,id);}
 const owners=new Map();
 for(const [part,nodes]of Object.entries(parts)){
  if(!/^[a-z][a-z0-9_-]{0,63}$/.test(part)||!Array.isArray(nodes)||!nodes.length)throw new Error('Invalid partition');
  for(const name of nodes){const id=names.get(name);if(id===undefined||owners.has(id))throw new Error('Unknown or duplicate mesh owner: '+name);owners.set(id,part);}
 }
 if(owners.size!==meshNodes.length)throw new Error('Every source mesh must have exactly one owner');
 const outputs=[];
 for(const part of Object.keys(parts)){
  const copy=structuredClone(doc);
  copy.nodes.forEach((n,id)=>{
   if(n.mesh!==undefined&&owners.get(id)!==part){delete n.mesh;if(n.extensions?.EXT_mesh_gpu_instancing){delete n.extensions.EXT_mesh_gpu_instancing;if(!Object.keys(n.extensions).length)delete n.extensions;}}
   if(part!==lightOwner&&n.extensions?.KHR_lights_punctual){delete n.extensions.KHR_lights_punctual;if(!Object.keys(n.extensions).length)delete n.extensions;}
  });
  const out=extractRoot({json:copy,binary:source.binary},root,{excludeCollision:false});
  outputs.push({part,bytes:out,sha256:sha(out),ownedMeshes:parts[part]});
 }
 return outputs;
}
module.exports={partitionGlb};
if(require.main===module){
 const [file,planFile,outDir]=process.argv.slice(2);if(!file||!planFile||!outDir)throw new Error('Usage: source.glb plan.json fresh-output-directory');
 const input=fs.readFileSync(file),plan=JSON.parse(fs.readFileSync(planFile)),outputs=partitionGlb(input,plan);
 fs.mkdirSync(outDir,{recursive:false}); // Preserve every previous numbered trial.
 for(const row of outputs)fs.writeFileSync(path.join(outDir,row.part+'.glb'),row.bytes);
 if(sha(fs.readFileSync(file))!==plan.sourceSha256)throw new Error('Source changed');
 const receipt={sourceSha256:plan.sourceSha256,sourceUnchanged:true,triangleAndAttributeResampling:false,lightOwner:plan.lightOwner,graphicsApproved:false,parts:outputs.map(({bytes,...row})=>({...row,bytes:bytes.length}))};
 fs.writeFileSync(path.join(outDir,'partition.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt.parts));
}
