const test = require('node:test');
const assert = require('node:assert/strict');
const { fitSimilarity, fitAffine, evaluate, run } = require('../scripts/fit-shinsekai-map.cjs');

const pointsFor = transform => [[0, 0], [100, 0], [0, 100], [100, 100]].map((pixel, i) => {
  const sourcePixel = pixel.map(value => value + 1000000);
  return { id: `P${i}`, sourcePixel, targetPixels: { target: transform(sourcePixel) } };
});
const near = (a, b) => a.forEach((value, i) => assert.ok(Math.abs(value - b[i]) < 1e-6));

test('similarity and centred affine recover a known transform at an independent point', () => {
  const transform = ([x, y]) => [0.8 * x - 0.6 * y + 17, 0.6 * x + 0.8 * y - 31];
  const points = pointsFor(transform), withheld = [1000345, 999876];
  for (const fit of [fitSimilarity, fitAffine]) near(fit(points, 'target')(withheld), transform(withheld));
});
test('centred affine recovers shear without mistaking it for a similarity', () => {
  const transform = ([x, y]) => [0.2 * x + 0.03 * y + 80, -0.02 * x + 0.19 * y - 20];
  const points = pointsFor(transform), withheld = [999750, 1000432];
  near(fitAffine(points, 'target')(withheld), transform(withheld));
  assert.ok(evaluate(fitSimilarity(points, 'target'), points, 'target').rmsPx > 0);
});
test('affine rejects collinear controls and holdout leakage is forbidden', () => {
  const points = [0, 100, 200].map(x => ({ sourcePixel: [x, 2*x], targetPixels: {target: [x+4, 2*x+2]} }));
  assert.throws(() => fitAffine(points, 'target'), /Degenerate/);
  assert.throws(() => run({status:'research-candidates-only',targets:{},controls:[],fitIds:['W0'],holdoutIds:['W0']}), /independent/);
});
test('layer registration uses historical image pixels and keeps W0 withheld', () => {
  const data = require('../docs/shinsekai/research/map-control-candidates.json');
  const result = run(data, '1928');
  assert.equal(result.sourceLayer, '1928');
  assert.deepEqual(Object.keys(result.result), ['1936-42']);
  assert.deepEqual(result.result['1936-42'].affine.holdout.residuals.map(row => row.id), ['W0']);
  assert.throws(() => run(data, 'std'), /Unknown source layer/);
});
