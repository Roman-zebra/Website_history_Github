// Fetch only Claude95's selected free asset files. Originals stay outside Git.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../research-cache/materials-93');
const ph='https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/';
const files=[
 ['large_sandstone_blocks','diff',2700600,'6341783d2d5dad5eea7f70852f27e6ce'],
 ['large_sandstone_blocks','nor_gl',2517711,'99004e9ecbec1a38f9516bb14b3c1f53'],
 ['large_sandstone_blocks','arm',2581346,'24770e74c11a4a056a6fe78bb5c7afc5'],
 ['green_metal_rust','diff',787402,'fed1afb0e3b6f5a5710cee229fd54897'],
 ['green_metal_rust','nor_gl',357436,'379dfb43f495a44569674717e974b920'],
 ['green_metal_rust','arm',477556,'d2b0d367da9f077b0f5727be761896fa']
].map(([asset,channel,bytes,md5])=>({asset,channel,bytes,md5,file:`${asset}_${channel}_2k.jpg`,url:`${ph}${asset}/${asset}_${channel}_2k.jpg`,page:`https://polyhaven.com/a/${asset}`,license:'CC0-1.0',licenseUrl:'https://polyhaven.com/license'}));
for(const [asset,bytes] of [['Plaster007',27851755],['PaintedPlaster006',29633094],['Metal041B',24013330]])files.push({asset,bytes,file:`${asset}_2K-JPG.zip`,url:`https://ambientcg.com/get?file=${asset}_2K-JPG.zip`,page:`https://ambientcg.com/view?id=${asset}`,license:'CC0-1.0',licenseUrl:'https://docs.ambientcg.com/license/'});
const hash=(bytes,type)=>crypto.createHash(type).update(bytes).digest('hex');
async function run(){await fs.mkdir(out,{recursive:true});const results=[],failures=[];let index=0;
 const worker=async()=>{while(index<files.length){const file=files[index++],dest=path.join(out,file.file);try{let bytes;try{bytes=await fs.readFile(dest);}catch(error){if(error.code!=='ENOENT')throw error;const response=await fetch(file.url,{signal:AbortSignal.timeout(120000),headers:{'User-Agent':'JapanTimeAtlas-material-authoring'}});if(!response.ok)throw new Error('HTTP '+response.status);bytes=Buffer.from(await response.arrayBuffer());}
  if(bytes.length!==file.bytes)throw new Error(`Expected ${file.bytes} bytes, got ${bytes.length}`);if(file.md5&&hash(bytes,'md5')!==file.md5)throw new Error('MD5 differs from Claude95 selection');
  await fs.writeFile(dest,bytes);results.push({...file,sha256:hash(bytes,'sha256'),downloadedAt:new Date().toISOString(),status:'checked source asset; scene use is an art-direction assumption'});console.log('Verified '+file.file);
 }catch(error){failures.push({file:file.file,error:error.message});console.error(file.file+': '+error.message);}}};
 await Promise.all([worker(),worker()]);await fs.writeFile(path.join(out,'download-receipt.json'),JSON.stringify({sourceHandoff:95,files:results,failures},null,2));if(failures.length)process.exitCode=1;
}
if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1;});
