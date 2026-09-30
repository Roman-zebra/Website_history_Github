// Research-only pixel alignment. This never writes coordinates or site assets.
const fs = require('node:fs');
const path = require('node:path');

const file = path.resolve(__dirname, '../docs/shinsekai/research/map-control-candidates.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const controls = new Map(data.controls.map(point => [point.id, point]));

function fitSimilarity(points, era) {
  const n = points.length;
  const sourceMean = [0, 1].map(axis => points.reduce((sum, point) => sum + point.sourcePixel[axis], 0) / n);
  const targetMean = [0, 1].map(axis => points.reduce((sum, point) => sum + point.targetPixels[era][axis], 0) / n);
  let xx = 0;
  let dot = 0;
  let cross = 0;
  for (const point of points) {
    const x = point.sourcePixel[0] - sourceMean[0];
    const y = point.sourcePixel[1] - sourceMean[1];
    const u = point.targetPixels[era][0] - targetMean[0];
    const v = point.targetPixels[era][1] - targetMean[1];
    xx += x * x + y * y;
    dot += x * u + y * v;
    cross += x * v - y * u;
  }
  if (xx < 1) throw new Error('Degenerate similarity controls');
  const a = dot / xx;
  const b = cross / xx;
  const tx = targetMean[0] - a * sourceMean[0] + b * sourceMean[1];
  const ty = targetMean[1] - b * sourceMean[0] - a * sourceMean[1];
  return point => [a * point[0] - b * point[1] + tx, b * point[0] + a * point[1] + ty];
}

function solve3(matrix, values) {
  const augmented = matrix.map((row, i) => [...row, values[i]]);
  for (let pivot = 0; pivot < 3; pivot++) {
    let best = pivot;
    for (let row = pivot + 1; row < 3; row++) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[best][pivot])) best = row;
    }
    [augmented[pivot], augmented[best]] = [augmented[best], augmented[pivot]];
    const divisor = augmented[pivot][pivot];
    if (Math.abs(divisor) < 1e-9) throw new Error('Degenerate affine controls');
    for (let column = pivot; column < 4; column++) augmented[pivot][column] /= divisor;
    for (let row = 0; row < 3; row++) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let column = pivot; column < 4; column++) augmented[row][column] -= factor * augmented[pivot][column];
    }
  }
  return augmented.map(row => row[3]);
}

function fitAffine(points, era) {
  const rows = points.map(point => [...point.sourcePixel, 1]);
  const matrix = [0, 1, 2].map(i => [0, 1, 2].map(j => rows.reduce((sum, row) => sum + row[i] * row[j], 0)));
  const coefficients = [0, 1].map(axis => solve3(
    matrix,
    [0, 1, 2].map(j => rows.reduce((sum, row, i) => sum + row[j] * points[i].targetPixels[era][axis], 0))
  ));
  return point => coefficients.map(row => row[0] * point[0] + row[1] * point[1] + row[2]);
}

function evaluate(fit, points, era) {
  const residuals = points.map(point => {
    const predicted = fit(point.sourcePixel);
    const observed = point.targetPixels[era];
    return {
      id: point.id,
      predicted: predicted.map(value => Number(value.toFixed(1))),
      observed,
      errorPx: Number(Math.hypot(predicted[0] - observed[0], predicted[1] - observed[1]).toFixed(1))
    };
  });
  const rmsPx = Math.sqrt(residuals.reduce((sum, row) => sum + row.errorPx ** 2, 0) / residuals.length);
  return { rmsPx: Number(rmsPx.toFixed(1)), residuals };
}

if (data.status !== 'research-candidates-only') throw new Error('Unexpected coordinate status');
for (const id of [...data.fitIds, ...data.holdoutIds]) {
  if (!controls.has(id)) throw new Error(`Unknown control ${id}`);
}
const training = data.fitIds.map(id => controls.get(id));
const holdout = data.holdoutIds.map(id => controls.get(id));
const result = {};
for (const era of Object.keys(data.targets)) {
  result[era] = {};
  for (const [model, fit] of [['similarity', fitSimilarity], ['affine', fitAffine]]) {
    const transform = fit(training, era);
    result[era][model] = {
      training: evaluate(transform, training, era),
      holdout: evaluate(transform, holdout, era)
    };
  }
}
console.log(JSON.stringify({status: data.status, fitIds: data.fitIds, holdoutIds: data.holdoutIds, result}, null, 2));
