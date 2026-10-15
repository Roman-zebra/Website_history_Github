import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {createPassCacheObserver067} = await import(process.argv[2]
  ? pathToFileURL(resolve(process.argv[2])).href
  : new URL('../pass-cache-observer-067.mjs', import.meta.url).href);

const names = ['cinema__beam_1', 'cinema__doors_3', 'cinema__walls_14', 'cinema__foyer_4', 'cinema__foyer_16', 'cinema__projector_7'];
const scope = {cinemaCompiling: false, render: null};
const cache = new Map(), nodeData = new WeakMap(), pipelineData = new WeakMap();
let objectCalls = 0, pipelineCalls = 0;
function object(name) {
  const material = {transparent: true, forceSinglePass: false, side: 2, version: 0};
  const obj = {name, material, geometry: {}};
  for (const side of [1, 0]) {
    const ro = {object: obj, material, geometry: obj.geometry, context: {}, lightsNode: {}, initialCacheKey: cache.size + 1};
    const pipeline = {cacheKey: name + ':' + side};
    cache.set(name + ':' + side, ro);
    nodeData.set(ro, {nodeBuilderState: {vertexShader: 'v', fragmentShader: 'f'}});
    pipelineData.set(ro, {pipeline});
  }
  return obj;
}
const objects = names.map(object);
const get = function(obj, material) { objectCalls++; return cache.get(obj.name + ':' + material.side); };
const pipeline = function(ro) { pipelineCalls++; return pipelineData.get(ro).pipeline; };
const renderer = {_objects: {get}, _nodes: {data: nodeData}, _pipelines: {data: pipelineData, getForRender: pipeline}};
const observer = createPassCacheObserver067();
observer.ensure(renderer, () => scope);
function draw(obj, id) {
  scope.render = {id, site: 'scheduled-draw', cinemaState: 'ready'};
  const originalSide = obj.material.side;
  try {
    for (const [side, pass] of [[1, 'backSide'], [0, 'default']]) {
      obj.material.side = side;
      const ro = renderer._objects.get(obj, obj.material, {}, {}, {}, {}, {}, pass);
      assert.equal(ro, cache.get(obj.name + ':' + side));
      assert.equal(renderer._pipelines.getForRender(ro), pipelineData.get(ro).pipeline);
    }
  } finally { obj.material.side = originalSide; }
}

observer.beginCinemaCompile();
scope.cinemaCompiling = true;
for (const obj of objects) draw(obj, 0);
scope.cinemaCompiling = false;
// Every object first becomes visible in a different scheduled callback.
for (let index = 0; index < objects.length; index++) {
  draw(objects[index], 100 + index);
  if (index) draw(objects[0], 100 + index);
}
let snap = observer.snapshot();
assert.equal(snap.compileRows.length, 24);
assert.equal(snap.firstDrawRows.length, 24, 'retain later non-projector first appearances');
assert.equal(snap.firstDrawID, 100);
assert.equal(snap.firstProjectorDrawID, 105);
for (let index = 0; index < names.length; index++) {
  const rows = snap.firstDrawRows.filter(row => row.after?.objectName === names[index]);
  assert.equal(rows.length, 4);
  assert.ok(rows.every(row => row.renderID === 100 + index));
  assert.equal(snap.firstObjectDrawIDs[names[index]], 100 + index);
  for (const row of rows.filter(row => row.method === 'objects.get')) {
    const prepared = snap.compileRows.find(r => r.method === row.method && r.after?.objectName === names[index] && r.passID === row.passID);
    assert.equal(row.after.renderObjectID, prepared.after.renderObjectID);
    assert.equal(row.after.nodeBuilderStateID, prepared.after.nodeBuilderStateID);
    assert.equal(row.after.pipelineID, prepared.after.pipelineID);
    assert.equal(row.after.initialCacheKey, prepared.after.initialCacheKey);
  }
}
for (const obj of objects) draw(obj, 500);
assert.equal(observer.snapshot().firstDrawRows.length, 24);
assert.equal(objectCalls, 46);
assert.equal(pipelineCalls, 46);

observer.beginCinemaCompile();
assert.equal(observer.snapshot().firstDrawRows.length, 0);
assert.deepEqual(observer.snapshot().firstObjectDrawIDs, {});
draw(objects[3], 700);
assert.equal(observer.snapshot().firstObjectDrawIDs[names[3]], 700);
assert.ok(observer.snapshot().firstDrawRows.every(row => row.renderID === 700));
observer.restore(renderer);
assert.equal(renderer._objects.get, get);
assert.equal(renderer._pipelines.getForRender, pipeline);
assert.equal(observer.snapshot().activeOwners, 0);

const bounded = createPassCacheObserver067({limitPerPhase: 4});
bounded.ensure(renderer, () => scope);
for (let index = 0; index < 40; index++) draw(object('cinema__bounded_' + index), 1000 + index);
snap = bounded.snapshot();
assert.equal(snap.firstDrawRows.length, 4);
assert.equal(Object.keys(snap.firstObjectDrawIDs).length, 4);
assert.ok(snap.droppedDraw > 0);
bounded.restore(renderer);
console.log(JSON.stringify({schema: 'JTA_FIRST_OBJECT_APPEARANCE_CPU_067_K',
  sixObjectsInSixDifferentCallbacks: true, bothPassesReusePreparedIdentity: true,
  laterNonProjectorRetained: true, repeatedDrawsNotRetained: true, generationReset: true,
  boundedRowsAndNames: true, originalMethodsRestored: true, extraRendererCalls: false,
  fakeFactoriesNotNativeCacheProof: true, nativeQualified: false}));
