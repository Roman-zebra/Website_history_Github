const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {readGlb,writeGlb}=require('../scripts/shinsekai-glb-cell.cjs');
const {repairUpperCushion}=require('../scripts/shinsekai-glb-upper-cushion.cjs'),{repairCabinetInk}=require('../scripts/shinsekai-glb-cabinet-ink.cjs'),{roundCushionContour}=require('../scripts/shinsekai-glb-cushion-contour.cjs'),{thickenCushionPerimeter}=require('../scripts/shinsekai-glb-cushion-perimeter.cjs'),{maskCushionFabric}=require('../scripts/shinsekai-glb-cushion-fabric.cjs');
const original=fs.readFileSync(path.join(__dirname,'../assets-src/shinsekai/eval-building-a/hybrid/runtime/interior.glb'));
const guide=repairCabinetInk(repairUpperCushion(original,{shiftY:.165,seamBottom:.04}).bytes).bytes;
const source=thickenCushionPerimeter(roundCushionContour(guide,{strength:.35}).bytes,guide,{gap:.022}).bytes;
const result=maskCushionFabric(source),before=readGlb(source),after=readGlb(result.bytes);
const target=j=>j.meshes[j.nodes.find(n=>n.name==='Hybrid_Sonnet_upper').mesh].primitives.find(p=>j.materials[p.material]?.name==='CLOTH');
const block=(f,id)=>{const a=f.json.accessors[id],v=f.json.bufferViews[a.bufferView];return f.binary.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);};
const url=relative=>pathToFileURL(path.resolve(__dirname,'..',relative)).href;
// Test-only import mapping, identical to the study page's pinned import map.
require('node:module').registerHooks({resolve(specifier,context,next){
 const aliases={'three':'vendor/three-r186/build/three.webgpu.js','three/webgpu':'vendor/three-r186/build/three.webgpu.js','three/tsl':'vendor/three-r186/build/three.tsl.js'};
 return aliases[specifier]?{url:url(aliases[specifier]),shortCircuit:true}:next(specifier,context);
}});
async function studyNode(){return import('../assets-src/shinsekai/browser-study/cushion-fabric-node.mjs');}
async function setup(){
 const THREE=await import('../vendor/three-r186/build/three.webgpu.js');
 const {GLTFLoader}=await import('../vendor/three-r186/examples/jsm/loaders/GLTFLoader.js');
 // Actual pinned loader on the unchanged source primitive plus new mask. Omit
 // unrelated image dependencies for Node, preserving every target attribute.
 const j=JSON.parse(JSON.stringify(after.json)),p=target(j);p.material=0;
 j.materials=[after.json.materials[target(after.json).material]];j.nodes=[{name:'Hybrid_Sonnet_upper',mesh:0}];j.meshes=[{primitives:[p]}];j.scenes=[{nodes:[0]}];j.scene=0;
 for(const name of ['images','textures','samplers','extensionsUsed','extensionsRequired','extensions','animations','skins','cameras'])delete j[name];
 const bytes=writeGlb(j,after.binary),model=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
 const mesh=model.scene.getObjectByName('Hybrid_Sonnet_upper'),material=mesh.material;
 const other=new THREE.Mesh(mesh.geometry,material);other.name='Unrelated cloth using shared source';model.scene.add(other);
 const {connectCushionFabric}=await import('../assets-src/shinsekai/browser-study/cushion-fabric-look.mjs'),{buildCushionFabricNode}=await studyNode();
 const options={gain:1,createMaterial:s=>new THREE.MeshStandardNodeMaterial().copy(s),buildNode:buildCushionFabricNode};
 return {THREE,model,mesh,other,material,connectCushionFabric,options};
}
test('fabric mask preserves all existing GLB data and isolates432 vertices with no mixed triangles',()=>{
 assert.ok(after.binary.subarray(0,before.binary.length).equals(before.binary));
 const a=target(before.json),b=target(after.json);assert.equal(b.indices,a.indices);
 for(const [name,id]of Object.entries(a.attributes)){assert.equal(b.attributes[name],id);assert.ok(block(before,id).equals(block(after,id)));}
 const j=JSON.parse(JSON.stringify(after.json));delete target(j).attributes._CUSHION;j.accessors.pop();j.bufferViews.pop();j.buffers[0].byteLength=before.json.buffers[0].byteLength;assert.deepEqual(j,before.json);
 const mask=block(after,b.attributes._CUSHION),idx=block(after,b.indices),pos=block(after,b.attributes.POSITION);let count=0,faces=0;
 for(let i=0;i<1608;i++){const m=mask.readFloatLE(i*4);assert.ok(m===0||m===1);count+=m;if(m){const xyz=[0,1,2].map(k=>pos.readFloatLE(i*12+k*4));assert.ok(xyz[0]>2.79&&xyz[0]<3.61&&xyz[1]>3.45&&xyz[1]<3.54&&xyz[2]>-5.63&&xyz[2]<-4.80);}}
 for(let i=0;i<idx.length;i+=6){const sum=[0,1,2].reduce((v,k)=>v+mask.readFloatLE(idx.readUInt16LE(i+k*2)*4),0);assert.ok(sum===0||sum===3);if(sum===3)faces++;}
 assert.equal(count,432);assert.equal(faces,240);assert.throws(()=>maskCushionFabric(original));assert.throws(()=>maskCushionFabric(result.bytes));
});
test('fabric routing is default off, null uses exact005 source, every gain needs retained contour and perimeter',async()=>{
 const {resolveCushionFabricStudy:r}=await import('../assets-src/shinsekai/browser-study/cushion-fabric-study.mjs');assert.equal(r(),null);
 const contour={revision:'035',perimeter:'022',path:'/study/upper-cushion-119-005/interior-cushion-gap022.glb'};
 for(const value of ['0','0.5','1']){assert.throws(()=>r({value}));assert.throws(()=>r({value,contour:{...contour,perimeter:'040'}}));const q=r({value,contour});assert.equal(q.gain,Number(value));assert.equal(q.path,value==='0'?contour.path:'/study/cushion-fabric-119-006/interior-cushion-fabric.glb');}
 for(const value of ['',0,'2','NaN','../1'])assert.throws(()=>r({value,contour}));
});
test('pinned GLTFLoader actually loads custom mask and copies only the selected shared cloth material',async()=>{
 const {model,mesh,other,material,connectCushionFabric:c,options}=await setup();
 assert.equal(mesh.geometry.getAttribute('_cushion').count,1608);const position=mesh.geometry.getAttribute('position'),colour=mesh.geometry.getAttribute('color'),uv=mesh.geometry.getAttribute('uv');
 const stats=c(model,options);assert.equal(stats.materials,1);assert.equal(stats.targetVertices,432);assert.equal(stats.targetTriangles,240);assert.notEqual(mesh.material,material);assert.equal(other.material,material);
 assert.equal(mesh.geometry.getAttribute('position'),position);assert.equal(mesh.geometry.getAttribute('color'),colour);assert.equal(mesh.geometry.getAttribute('uv'),uv);assert.equal(mesh.material.roughness,material.roughness);assert.ok(mesh.material.color.equals(material.color));assert.equal(mesh.material.vertexColors,material.vertexColors);assert.equal(mesh.material.side,material.side);assert.ok(mesh.material.normalNode.isNode);assert.equal(mesh.material.userData.studyOriginalCushionMaterial,material);assert.throws(()=>c(model,options));
});
test('zero gain does not copy, build a shader or change source identity; invalid gains fail atomically',async()=>{
 const {model,mesh,material,connectCushionFabric:c}=await setup();
 assert.equal(c(model,{gain:0}).exactSourceControl,true);assert.equal(mesh.material,material);
 for(const gain of [-1,2,NaN,Infinity])assert.throws(()=>c(model,{gain}));assert.equal(mesh.material,material);
});
test('corrupt masks, mixed faces and material changes are rejected before replacing shared cloth',async()=>{
 for(const kind of ['fractional','count','mixed','material']){
  const {model,mesh,other,material,connectCushionFabric:c,options}=await setup(),mask=mesh.geometry.getAttribute('_cushion');
  if(kind==='fractional')mask.setX(0,.25);
  if(kind==='count')for(let i=0;i<mask.count;i++)mask.setX(i,0);
  if(kind==='mixed'){const idx=mesh.geometry.index;for(let i=0;i<idx.count;i+=3)if(mask.getX(idx.getX(i))===1){mask.setX(idx.getX(i),0);break;}}
  if(kind==='material')material.roughness=.5;
  let copied=0;assert.throws(()=>c(model,{...options,createMaterial:s=>{copied++;return options.createMaterial(s);}}));assert.equal(copied,0);assert.equal(mesh.material,material);assert.equal(other.material,material);
 }
});
test('failed shader construction disposes its copy and preserves the source',async()=>{
 const {model,mesh,material,connectCushionFabric:c,options}=await setup();let disposed=0;
 assert.throws(()=>c(model,{...options,createMaterial:s=>{const m=options.createMaterial(s);m.addEventListener('dispose',()=>disposed++);return m;},buildNode:()=>{throw new Error('diagnostic failure');}}));assert.equal(disposed,1);assert.equal(mesh.material,material);
});
test('pinned GLSL and WGSL builders translate real height derivatives, frequency fade and mask without UV resampling',async()=>{
 const {THREE:T,mesh}=await setup(),tsl=await import('three/tsl'),{buildCushionFabricNode}=await studyNode();
 for(const [label,Builder]of [['GLSL',T.GLSLNodeBuilder],['WGSL',T.WGSLNodeBuilder]]){
  // Standalone expression translation: substitute normal/camera inputs, not a
  // renderer or driver test. Actual material/native images remain pending.
  const renderer={debug:{diagnostics:{keywords:false}},coordinateSystem:label==='GLSL'?T.WebGLCoordinateSystem:T.WebGPUCoordinateSystem,backend:{isWebGPUBackend:label==='WGSL'},hasFeature:()=>true,hasCompatibility:()=>true,getRenderTarget:()=>null};
  const builder=new Builder(mesh,renderer);builder.context.setupNormal=()=>tsl.vec3(0,1,0);builder.context.setupPositionView=()=>tsl.positionLocal;builder.setShaderStage('fragment');
  const node=buildCushionFabricNode(1);
  for(const stage of ['setup','analyze']){builder.setBuildStage(stage);node.build(builder,'vec3');}builder.setBuildStage('generate');const flow=builder.flowNode(node),code=flow.code+flow.result;
  assert.match(code,/fwidth\(/);assert.match(code,/smoothstep\( 0.2, 0.45/);assert.match(code,label==='GLSL'?/dFdx\( nodeVar/:/dpdx\( nodeVar/);assert.match(code,label==='GLSL'?/dFdy\( nodeVar/:/dpdy\( nodeVar/);assert.match(code,/max\( abs\(/);assert.ok(builder.attributes.some(a=>a.name==='_cushion'));assert.doesNotMatch(code,/textureSample|texture2D/);
 }
});
