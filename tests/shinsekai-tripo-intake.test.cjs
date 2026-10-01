const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const modulePromise = import('../assets-src/shinsekai/browser-study/tripo-intake.mjs');
function fixture(patch = {}) {
  const json = Buffer.from(JSON.stringify({asset:{version:'2.0'},...patch}));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const out = Buffer.alloc(20 + padded.length);
  out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);
  out.writeUInt32LE(padded.length,12);out.writeUInt32LE(0x4e4f534a,16);padded.copy(out,20);
  return out;
}
test('TRIPO intake rejects corrupt lengths before model decoding', async()=>{
  const {inspectGlb}=await modulePromise, bytes=fixture();bytes.writeUInt32LE(bytes.length+4,8);
  assert.throws(()=>inspectGlb(bytes),/file length/);
  const chunk=fixture();chunk.writeUInt32LE(0xffffffff,12);assert.throws(()=>inspectGlb(chunk),/chunk length/);
});
test('downloaded GLB cannot request remote or relative resources', async()=>{
  const {inspectGlb}=await modulePromise;
  for(const uri of ['https://example.org/texture.png','../texture.png','file:///private','blob:arbitrary']) assert.throws(()=>inspectGlb(fixture({images:[{uri}]})),/external URIs/);
  assert.doesNotThrow(()=>inspectGlb(fixture({images:[{uri:'data:image/png;base64,AAAA'}]})));
  assert.throws(()=>inspectGlb(fixture({extensions:{arbitrary:{uri:'https://example.org'}}})),/external URIs/);
});
test('unsupported mesh compression is reported before rendering', async()=>{
  const {inspectGlb}=await modulePromise;
  assert.throws(()=>inspectGlb(fixture({extensionsRequired:['KHR_draco_mesh_compression']})),/separate decoder/);
});
test('existing source GLB passes intake without modifying source bytes', async()=>{
  const {inspectGlb}=await modulePromise, file=path.join(__dirname,'../assets-src/shinsekai/tower-study/tower-study.glb');
  const before=fs.readFileSync(file), copy=Buffer.from(before), {stats}=inspectGlb(before);
  assert.ok(stats.trianglesInMeshDefinitions>0);assert.ok(stats.meshDefinitions>0);
  assert.deepEqual(before,copy);assert.deepEqual(fs.readFileSync(file),copy);
});
