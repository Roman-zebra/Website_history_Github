// Research-only pixel alignment. This never writes coordinates or site assets.
const fs = require('node:fs');
const path = require('node:path');

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
  // Centre and scale pixels before solving, so the translation column does not
  // compete with squared coordinates from a large source scan.
  const mean = [0, 1].map(axis => points.reduce((sum, point) => sum + point.sourcePixel[axis], 0) / points.length);
  const scale = Math.sqrt(points.reduce((sum, point) => sum +
    (point.sourcePixel[0] - mean[0]) ** 2 + (point.sourcePixel[1] - mean[1]) ** 2, 0) / points.length);
  if (!Number.isFinite(scale) || scale < 1e-9) throw new Error('Degenerate affine controls');
  const rows = points.map(point => [(point.sourcePixel[0] - mean[0]) / scale, (point.sourcePixel[1] - mean[1]) / scale, 1]);
  const matrix = [0, 1, 2].map(i => [0, 1, 2].map(j => rows.reduce((sum, row) => sum + row[i] * row[j], 0)));
  const coefficients = [0, 1].map(axis => solve3(
    matrix,
    [0, 1, 2].map(j => rows.reduce((sum, row, i) => sum + row[j] * points[i].targetPixels[era][axis], 0))
  ));
  return point => coefficients.map(row => row[0] * (point[0] - mean[0]) / scale + row[1] * (point[1] - mean[1]) / scale + row[2]);
}

function evaluate(fit, points, era) {
  let squaredError = 0;
  const residuals = points.map(point => {
    const predicted = fit(point.sourcePixel);
    const observed = point.targetPixels[era];
    const error = Math.hypot(predicted[0] - observed[0], predicted[1] - observed[1]);
    squaredError += error ** 2;
    return {
      id: point.id,
      predicted: predicted.map(value => Number(value.toFixed(1))),
      observed,
      errorPx: Number(error.toFixed(1))
    };
  });
  const rmsPx = Math.sqrt(squaredError / residuals.length);
  return { rmsPx: Number(rmsPx.toFixed(1)), residuals };
}

function run(data, sourceLayer = 'S063') {
  if (data.status !== 'research-candidates-only') throw new Error('Unexpected coordinate status');
  if (sourceLayer !== 'S063' && !Object.hasOwn(data.targets, sourceLayer)) throw new Error(`Unknown source layer ${sourceLayer}`);
  const controls = new Map(data.controls.map(point => [point.id, {
    ...point, sourcePixel: sourceLayer === 'S063' ? point.sourcePixel : point.targetPixels[sourceLayer]
  }]));
  if (data.fitIds.some(id => data.holdoutIds.includes(id))) throw new Error('Training and holdout must be independent');
  for (const id of [...data.fitIds, ...data.holdoutIds]) {
    if (!controls.has(id)) throw new Error(`Unknown control ${id}`);
  }
  const training = data.fitIds.map(id => controls.get(id));
  const holdout = data.holdoutIds.map(id => controls.get(id));
  const result = {};
  for (const era of Object.keys(data.targets).filter(era => era !== sourceLayer)) {
    result[era] = {};
    for (const [model, fit] of [['similarity', fitSimilarity], ['affine', fitAffine]]) {
      const transform = fit(training, era);
      result[era][model] = { training: evaluate(transform, training, era), holdout: evaluate(transform, holdout, era) };
    }
  }
  return {status: data.status, sourceLayer, fitIds: data.fitIds, holdoutIds: data.holdoutIds, result};
}
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--source-layer')) throw new Error('Usage: node scripts/fit-shinsekai-map.cjs [--source-layer 1928|1936-42]');
  const file = path.resolve(__dirname, '../docs/shinsekai/research/map-control-candidates.json');
  console.log(JSON.stringify(run(JSON.parse(fs.readFileSync(file, 'utf8')), args[1]), null, 2));
}
module.exports = {fitSimilarity, fitAffine, evaluate, run};
