/* Research-only camera/measurement primitives. No site or GLB coordinates are written. */
'use strict';
const EPS = 1e-9;
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const finite = (value, name) => { if (!Number.isFinite(value)) throw new Error(`Nonfinite ${name}`); return value; };
function vector(value, name) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`Expected three coordinates: ${name}`);
  value.forEach(x => finite(x, name)); return value;
}
function cameraBasis(camera) {
  const {heading, pitch, roll = 0, focalPx, principalPx, centre} = camera;
  vector(centre, 'camera centre');
  [heading, pitch, roll, focalPx].forEach(x => finite(x, 'camera parameter'));
  if (!(focalPx > 0)) throw new Error('Focal length must be positive');
  if (!Array.isArray(principalPx) || principalPx.length !== 2) throw new Error('Expected principal point');
  principalPx.forEach(x => finite(x, 'principal point'));
  // X east, Y north, Z up; heading 0 faces north, positive pitch looks up.
  const forward = [Math.sin(heading)*Math.cos(pitch), Math.cos(heading)*Math.cos(pitch), Math.sin(pitch)];
  const right0 = [Math.cos(heading), -Math.sin(heading), 0], up0 = cross(right0, forward);
  const right = right0.map((x, i) => Math.cos(roll)*x + Math.sin(roll)*up0[i]);
  const up = up0.map((x, i) => Math.cos(roll)*x - Math.sin(roll)*right0[i]);
  return {right, up, forward};
}
function homogeneous(camera, direction) {
  vector(direction, 'direction');
  const {right, up, forward} = cameraBasis(camera), z = dot(direction, forward);
  return [camera.principalPx[0]*z + camera.focalPx*dot(direction, right),
    camera.principalPx[1]*z - camera.focalPx*dot(direction, up), z];
}
function projectPoint(camera, point) {
  vector(point, 'world point');
  const h = homogeneous(camera, point.map((x, i) => x - camera.centre[i]));
  if (!(h[2] > EPS)) throw new Error('World point is at or behind camera plane');
  return {pixel: [h[0]/h[2], h[1]/h[2]], depth: h[2]};
}
function projectLine(camera, origin, direction) {
  // An infinite line, not a pair of points given invented heights. Its direction can be at infinity.
  vector(origin, 'line origin'); vector(direction, 'line direction');
  projectPoint(camera, origin); // require a visible anchor; endpoints are not assigned to observed rows
  const a = homogeneous(camera, origin.map((x, i) => x - camera.centre[i]));
  const b = homogeneous(camera, direction), line = cross(a, b), n = Math.hypot(line[0], line[1]);
  if (!(n > EPS)) throw new Error('World line projects to a point');
  return line.map(x => x/n); // ax + by + c = 0, signed pixel distance
}
function cropCamera(camera, transform) {
  const {offsetPx, scale} = transform;
  validateTransform(transform);
  cameraBasis(camera);
  return {...camera, focalPx: camera.focalPx*scale,
    principalPx: camera.principalPx.map((x, i) => (x-offsetPx[i])*scale)};
}
function validateTransform({offsetPx, scale}) {
  if (!Array.isArray(offsetPx) || offsetPx.length !== 2) throw new Error('Expected crop offset');
  offsetPx.forEach(x => finite(x, 'crop offset')); finite(scale, 'crop scale');
  if (!(scale > 0)) throw new Error('Crop scale must be positive and isotropic');
}
function cropObservation(observation, transform) {
  validateTransform(transform);
  const result = {...observation, tolerancePx: observation.tolerancePx*transform.scale};
  for (const [key, axis] of [['x', 0], ['y', 1], ['x2', 0], ['y2', 1]]) {
    result[key] = observation[key] === null ? null : (observation[key]-transform.offsetPx[axis])*transform.scale;
  }
  return result;
}
function residual(camera, observation, model) {
  const required = {point:['x','y'], line:['x','y','x2','y2'], 'edge-sample':['x','y'], row:['y']}[observation.type];
  if (!required) throw new Error(`Unknown observation type: ${observation.type}`);
  for (const key of required) if (!Number.isFinite(observation[key])) throw new Error(`Missing/nonfinite observed ${key}`);
  let pixels;
  if (observation.type === 'point') {
    if (model.kind !== 'point') throw new Error('Point observation requires a world point');
    const predicted = projectPoint(camera, model.world).pixel;
    pixels = [predicted[0]-observation.x, predicted[1]-observation.y];
  } else if (observation.type === 'line' || observation.type === 'edge-sample') {
    if (model.kind !== 'line') throw new Error('Edge observation requires a world line, not an assigned Z');
    const [a, b, c] = projectLine(camera, model.origin, model.direction);
    if (observation.type === 'line') pixels = [a*observation.x+b*observation.y+c, a*observation.x2+b*observation.y2+c];
    else {
      if (Math.abs(a) < EPS) throw new Error('Projected line has no unique x at the observed row');
      pixels = [-(b*observation.y+c)/a-observation.x];
    }
  } else if (observation.type === 'row') {
    // Row meaning must be bound explicitly by the scenario. A width note is not a width measurement.
    if (model.kind !== 'row') throw new Error('Row observation requires an explicit predicted-row model');
    pixels = [finite(model.predictedY, 'predicted row')-observation.y];
  } else throw new Error(`Unknown observation type: ${observation.type}`);
  if (!(observation.tolerancePx > 0) || !Number.isFinite(observation.tolerancePx)) throw new Error('Invalid tracing tolerance');
  if (pixels.some(x => !Number.isFinite(x))) throw new Error('Nonfinite residual');
  return {pixels, scaled: pixels.map(x => x/observation.tolerancePx)};
}
function huber(value, delta = 2) {
  finite(value, 'residual'); finite(delta, 'Huber transition');
  if (!(delta > 0)) throw new Error('Huber transition must be positive');
  const a = Math.abs(value); return a <= delta ? 0.5*a*a : delta*(a-0.5*delta);
}
function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i+1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else cell += c;
    } else if (c === '"') {
      if (cell || closed) throw new Error('Invalid CSV quote'); quoted = true;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(cell); cell = ''; closed = false;
      if (c !== ',') { if (row.some(x => x !== '')) rows.push(row); row = []; if (c === '\r' && text[i+1] === '\n') i++; }
    } else { if (closed) throw new Error('Unexpected text after CSV quote'); cell += c; }
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const COLUMNS = ['version','photo','source','original_px','type','feature','side','x_orig','y_orig','x2_orig','y2_orig','tol_px','alt_readings','notes'];
function readLandmarks(text, views) {
  const [header, ...rows] = parseCsv(text.replace(/^\uFEFF/, ''));
  if (JSON.stringify(header) !== JSON.stringify(COLUMNS)) throw new Error('Unexpected v2 landmark schema');
  return rows.map((cells, index) => {
    if (cells.length !== COLUMNS.length) throw new Error(`Column count at data row ${index+1}`);
    const raw = Object.fromEntries(header.map((name, i) => [name, cells[i]])), view = views[raw.photo];
    if (raw.version !== 'v2' || !view || !raw.feature || !raw.source) throw new Error(`Unknown version/view or missing identity at row ${index+1}`);
    if (raw.original_px !== view.originalPx.join('x')) throw new Error(`Image dimensions disagree: ${raw.photo}`);
    if (!['point','row','line','edge-sample'].includes(raw.type)) throw new Error(`Unknown observation type: ${raw.type}`);
    const number = (cell, name) => {
      if (cell === '') return null;
      if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(cell)) throw new Error(`Invalid numeric field: ${name}`);
      return finite(Number(cell), name);
    };
    const observation = {id: `${raw.photo}:${index+1}`, photo: raw.photo, type: raw.type, feature: raw.feature, side: raw.side,
      x: number(raw.x_orig, 'x'), y: number(raw.y_orig, 'y'), x2: number(raw.x2_orig, 'x2'), y2: number(raw.y2_orig, 'y2'),
      tolerancePx: number(raw.tol_px, 'tolerance'), alternatives: raw.alt_readings, notes: raw.notes, source: raw.source};
    if (!(observation.tolerancePx > 0)) throw new Error(`Missing/invalid tracing tolerance: ${observation.id}`);
    const present = ['x','y','x2','y2'].filter(key => observation[key] !== null).join(',');
    const expected = {point:'x,y', row:'y', line:'x,y,x2,y2', 'edge-sample':'x,y'}[observation.type];
    if (present !== expected) throw new Error(`Coordinate shape for ${observation.id}: ${present}, expected ${expected}`);
    for (const [key, axis] of [['x',0],['y',1],['x2',0],['y2',1]]) {
      const value = observation[key]; if (value !== null && (value < 0 || value >= view.originalPx[axis])) throw new Error(`Pixel outside image: ${observation.id}`);
    }
    if (observation.type === 'line' && observation.x === observation.x2 && observation.y === observation.y2) throw new Error('Observed line has identical endpoints');
    if (!['', 'centre', 'east (image left)', 'east (image right)', 'west (image left)', 'west (image right)'].includes(observation.side)) throw new Error(`Unknown physical side: ${observation.id}`);
    if (observation.side.startsWith('east') && !observation.side.includes(`image ${view.imageLeft === 'east' ? 'left' : 'right'}`)) throw new Error(`East label mismatch: ${observation.id}`);
    if (observation.side.startsWith('west') && !observation.side.includes(`image ${view.imageLeft === 'west' ? 'left' : 'right'}`)) throw new Error(`West label mismatch: ${observation.id}`);
    return observation;
  });
}
module.exports = {cameraBasis, projectPoint, projectLine, cropCamera, cropObservation, residual, huber, parseCsv, readLandmarks};
