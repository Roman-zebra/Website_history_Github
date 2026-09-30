'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {readLandmarks, parseCsv} = require('./shinsekai-camera.cjs');
const directory = path.resolve(__dirname, '../docs/shinsekai/research');
function audit() {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'photo-inputs-v2.json'), 'utf8'));
  const bytes = fs.readFileSync(path.join(directory, manifest.landmarks.file));
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== manifest.landmarks.sha256) throw new Error('Landmark snapshot hash differs from manifest');
  const rawBytes = fs.readFileSync(path.join(directory, manifest.landmarks.rawFile));
  if (crypto.createHash('sha256').update(rawBytes).digest('hex') !== manifest.landmarks.rawSha256) throw new Error('Raw Claude snapshot hash differs from manifest');
  const rawCells = parseCsv(rawBytes.toString('utf8')), broken = rawCells[15];
  if (broken.length !== 17 || broken[1] !== 'viewA' || broken.slice(13).join(',') !== 'A_full = region (2090,660,890,1650) scale 1') throw new Error('Declared CSV repair no longer matches');
  rawCells[15] = [...broken.slice(0,13), broken.slice(13).join(',')];
  if (JSON.stringify(rawCells) !== JSON.stringify(parseCsv(bytes.toString('utf8')))) throw new Error('Normalized input changed more than declared quoting repair');
  const rows = readLandmarks(bytes.toString('utf8'), manifest.views);
  const counts = Object.fromEntries(Object.keys(manifest.views).map(photo => [photo, {
    records: rows.filter(row => row.photo === photo).length,
    types: Object.fromEntries(['point','line','edge-sample','row'].map(type => [type, rows.filter(row => row.photo === photo && row.type === type).length]))
  }]));
  return {status: 'research-observations-only', handoff: 59, records: rows.length, counts,
    geometryBindings: 'Not assigned; metric dimensions and cross-era/face identities need explicit scenarios.',
    gates: {heightAdoption: 'open', southPrediction: 'open'},
    warnings: ['Tracing tolerances are working weights, not measured noise or historical confidence intervals.',
      'The two row-only notes do not establish an optical horizon or a measured exit width.',
      'Unknown edge heights stay line constraints; no Z=roof-height substitution.',
      'South camera sector is probable, not independently surveyed; its scan is only 347x534.']};
}
if (require.main === module) console.log(JSON.stringify(audit(), null, 2));
module.exports = {audit};
