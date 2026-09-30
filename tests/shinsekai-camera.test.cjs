'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {cameraBasis, projectPoint, projectLine, cropCamera, cropObservation, residual, huber, parseCsv, readLandmarks} = require('../scripts/shinsekai-camera.cjs');
const {audit} = require('../scripts/audit-shinsekai-photos.cjs');
const north = {centre: [0,-100,2], heading: 0, pitch: 0, roll: 0, focalPx: 1000, principalPx: [800,600]};
const near = (actual, expected) => actual.forEach((x,i) => assert.ok(Math.abs(x-expected[i]) < 1e-8, `${actual} vs ${expected}`));
const observation = (type, x, y, extras = {}) => ({type, x, y, x2: null, y2: null, tolerancePx: 2, ...extras});

test('known pinhole coordinates distinguish east from west on opposite camera sectors', () => {
  near(projectPoint(north, [10,0,12]).pixel, [900,500]);
  const southFacing = {...north, centre: [0,100,2], heading: Math.PI};
  near(projectPoint(southFacing, [10,0,12]).pixel, [700,500]);
  assert.equal(projectPoint(north,[10,0,12]).depth, 100);
});
test('camera axes stay orthonormal under heading, pitch and roll', () => {
  const {right,up,forward} = cameraBasis({...north, heading: 1.2, pitch: 0.4, roll: -0.17});
  const dot = (a,b) => a.reduce((s,x,i) => s+x*b[i],0);
  near([dot(right,right),dot(up,up),dot(forward,forward)], [1,1,1]);
  near([dot(right,up),dot(right,forward),dot(up,forward)], [0,0,0]);
  const tilted = projectPoint({...north,pitch: Math.PI/4}, [0,0,102]);
  near(tilted.pixel,north.principalPx);
});
test('invalid cameras and points on/behind the camera plane are rejected', () => {
  assert.throws(() => projectPoint(north,[0,-100,12]), /behind/);
  assert.throws(() => projectPoint(north,[0,-101,12]), /behind/);
  assert.throws(() => projectPoint({...north,focalPx: 0},[0,0,0]), /positive/);
  assert.throws(() => projectPoint({...north,centre: [NaN,0,0]},[0,0,0]), /Nonfinite/);
});
test('crop/resize transforms the principal point and preserves weighted residuals', () => {
  const c = {...north, heading: 0.12, pitch: 0.04, roll: 0.03}, world = [5,0,15];
  const pixel = projectPoint(c,world).pixel;
  const o = observation('point',pixel[0]+4,pixel[1]-6), transform = {offsetPx:[560,440],scale:0.5};
  const local = cropCamera(c,transform), localObservation = cropObservation(o,transform);
  near(projectPoint(local,world).pixel,pixel.map((x,i) => (x-transform.offsetPx[i])*0.5));
  near(residual(local,localObservation,{kind:'point',world}).scaled, residual(c,o,{kind:'point',world}).scaled);
  assert.equal(localObservation.x2,null); // missing coordinates never become zero
  assert.throws(() => cropCamera(c,{offsetPx:[0,0],scale:0}), /positive/);
});
test('vertical-line observations use perpendicular distance without assigning endpoint heights', () => {
  const model = {kind:'line',origin:[10,0,0],direction:[0,0,1]};
  const o = observation('line',902,300,{x2:902,y2:700});
  const r = residual(north,o,model);
  near(r.pixels.map(Math.abs),[2,2]);
  near(r.scaled.map(Math.abs),[1,1]);
  const shiftedOrigin = {...model,origin:[10,0,15.15]};
  near(residual(north,o,shiftedOrigin).pixels,r.pixels); // infinite-line identity, not a roof landmark
  assert.throws(() => projectLine(north,[0,0,2],[0,1,0]), /projects to a point/);
});
test('edge sample uses x at its observed row, including a rolled camera', () => {
  const camera = {...north,roll:0.1}, model = {kind:'line',origin:[10,0,0],direction:[0,0,1]};
  const p = projectPoint(camera,[10,0,12]).pixel;
  near(residual(camera,observation('edge-sample',p[0]+3,p[1]),model).pixels,[-3]);
  assert.throws(() => residual(north,observation('edge-sample',800,600),{kind:'line',origin:[0,0,2],direction:[1,0,0]}), /no unique x/);
  assert.throws(() => residual(north,observation('edge-sample',900,500),{kind:'point',world:[10,0,12]}), /not an assigned Z/);
});
test('row observations require a separate explicit model and have one residual', () => {
  const o = observation('row',null,1840);
  near(residual(north,o,{kind:'row',predictedY:1848}).scaled,[4]);
  assert.throws(() => residual(north,o,{kind:'point',world:[0,0,0]}), /explicit/);
  assert.throws(() => residual(north,{...o,type:'point'},{kind:'point',world:[0,0,0]}), /observed x/);
  assert.throws(() => residual(north,{...o,tolerancePx:null},{kind:'row',predictedY:1840}), /tolerance/);
});
test('Huber objective remains quadratic near zero and linear in the tail', () => {
  assert.equal(huber(1),0.5); assert.equal(huber(-1),0.5);
  assert.equal(huber(5),8); assert.equal(huber(6)-huber(5),2);
  assert.throws(() => huber(1,0), /positive/);
});
test('scaling camera and world together leaves photos identical, so a scale datum is required', () => {
  const points = [[-12,0,15.15],[0,-8,75.76],[12,3,22]], factor = 1.7;
  const camera = {...north,heading:0.14,pitch:0.06,roll:0.02};
  const scaledCamera = {...camera,centre:camera.centre.map(x => x*factor)};
  for (const point of points) near(projectPoint(camera,point).pixel,projectPoint(scaledCamera,point.map(x => x*factor)).pixel);
});
const dir = path.resolve(__dirname,'../docs/shinsekai/research');
const manifest = JSON.parse(fs.readFileSync(path.join(dir,'photo-inputs-v2.json'),'utf8'));
const input = fs.readFileSync(path.join(dir,'photo-landmarks-v2.csv'),'utf8');
test('v2 snapshot preserves typed missing coordinates, source dimensions and mirrored side labels', () => {
  const report = audit(); assert.equal(report.records,41);
  assert.deepEqual(report.counts.plate46.types,{point:10,line:2,'edge-sample':0,row:2});
  assert.deepEqual(report.counts.viewA.types,{point:9,line:0,'edge-sample':4,row:0});
  assert.deepEqual(report.counts.south_c0234001.types,{point:10,line:0,'edge-sample':4,row:0});
  const rows = readLandmarks(input,manifest.views), feet = rows.find(row => row.photo === 'plate46' && row.feature.includes('arch foot') && row.side.startsWith('east'));
  assert.equal(feet.x,983); assert.equal(rows[0].x,null);
  assert.equal(report.gates.southPrediction,'open');
});
test('CSV parser handles quoted commas/newlines and rejects malformed or semantically invalid observations', () => {
  assert.deepEqual(parseCsv('a,b\r\n"one, two","x""y\nz"\r\n'),[['a','b'],['one, two','x"y\nz']]);
  assert.throws(() => parseCsv('"unfinished'), /Unclosed/);
  assert.throws(() => readLandmarks(fs.readFileSync(path.join(dir,'photo-landmarks-v2-claude.csv'),'utf8'),manifest.views), /Column count at data row 15/);
  assert.throws(() => readLandmarks(input.replace('east (image left),983','west (image left),983'),manifest.views), /West label mismatch/);
  assert.throws(() => readLandmarks(input.replace('centre,190,22.5','centre,999,22.5'),manifest.views), /outside image/);
  assert.throws(() => readLandmarks(input.replace('centre,190,22.5,,,3','centre,,22.5,,,3'),manifest.views), /Coordinate shape/);
  assert.throws(() => readLandmarks(input.replace('347x534','348x534'),manifest.views), /dimensions disagree/);
});
