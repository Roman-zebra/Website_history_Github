const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const candidate = path.join(root, 'scripts/shinsekai/cinema-preparation-067');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('067 engine and renderer fixtures retain their verified source hashes', () => {
  const pins = JSON.parse(fs.readFileSync(path.join(candidate, 'provenance.json')));
  for (const row of pins.engineFiles) {
    assert.equal(sha(path.join(candidate, row.path)), row.sha256, row.path);
    assert.equal(fs.statSync(path.join(candidate, row.path)).size, row.bytes);
  }
  assert.equal(sha(path.join(candidate, pins.captureObservation.path)), pins.captureObservation.sha256);
  assert.equal(sha(path.join(candidate, pins.captureObservation.fixture.path)), pins.captureObservation.fixture.sha256);
  assert.equal(sha(path.join(root, pins.fixedVendor.path)), pins.fixedVendor.sha256);
  for (const row of [pins.compiledFragments, pins.historicalObserver, pins.historicalFirstAppearanceObserver]) {
    assert.equal(sha(path.join(candidate, row.path)), row.sha256, row.path);
  }
});

for (const file of [
  'test-targeted-side-067.mjs',
  'test-pass-cache-observer-067.mjs',
  'test-cinema-visibility-probe-067.mjs',
  'test-cinema-preparation-admission-067.mjs',
  'test-generation-observation-067.mjs',
  'test-receipt-compaction-067.mjs',
  'test-first-object-appearance-067.mjs',
]) {
  test(file, () => {
    const result = JSON.parse(execFileSync(process.execPath, [path.join(candidate, 'checks', file)], {
      cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
    }));
    assert.equal(result.nativeQualified, false);
  });
}

test('067 patch CLI fails closed and never replaces existing files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jta-cinema-067-'));
  const bad = path.join(dir, 'bad.mjs');
  const output = path.join(dir, 'patched.mjs');
  const cli = path.join(candidate, 'patch-fixed-renderer.mjs');
  const vendor = path.join(root, 'vendor/three-r186/build/three.webgpu.js');
  const invoke = (input, target) => execFileSync(process.execPath, [cli, input, target], {
    cwd: root, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    fs.writeFileSync(bad, 'untrusted input');
    assert.throws(() => invoke(bad, output), /SHA256 mismatch/);
    assert.equal(fs.existsSync(output), false);
    assert.throws(() => invoke(vendor, vendor), /Distinct input/);
    const proof = JSON.parse(invoke(vendor, output));
    assert.equal(proof.exactReversal, true);
    assert.equal(sha(output), proof.candidateSHA256);
    const before = sha(output);
    assert.throws(() => invoke(vendor, output), /EEXIST/);
    assert.equal(sha(output), before);
    assert.equal(sha(vendor), proof.sourceSHA256);
  } finally {
    for (const file of [bad, output]) if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(dir);
  }
});

test('067 prior observer loses later first appearances while the candidate retains them', () => {
  const regression = path.join(candidate, 'checks/test-first-object-appearance-067.mjs');
  const prior = path.join(candidate, 'fixtures/pass-cache-observer-I.mjs');
  assert.throws(() => execFileSync(process.execPath, [regression, prior], {
    cwd: root, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'],
  }), /retain later non-projector first appearances/);
});


test('067 captures retain bounded immutable numeric state and original PNG behavior', () => {
  const output=execFileSync(process.execPath,[path.join(candidate,'checks/test-capture-control-N067.mjs')],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  const rows=output.trim().split(/\r?\n/).map(line=>JSON.parse(line));
  assert.equal(rows.length,3);
  assert.equal(rows[0].passed,true);
  assert.equal(rows[0].nativeQualified,false);
  assert.equal(rows[1].exactPNGHash,true);
  assert.equal(rows[1].uploadFailurePreservesCapture,true);
  assert.equal(rows[2].actualFrozenCaptureSeams,true);
  assert.equal(rows[2].exactRestoration,true);
});
