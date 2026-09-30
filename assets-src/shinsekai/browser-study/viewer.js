import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.querySelector('#view');
const status = document.querySelector('#status');
const buttons = [...document.querySelectorAll('[data-mode]')];
const metrics = document.querySelector('#metrics');
const benchmarkButton = document.querySelector('#benchmark');
if (matchMedia('(max-width: 760px), (max-height: 600px)').matches) {
  document.querySelector('#study-details').open = false;
}
let ready = false;
let disposed = false;
let frame = null;
let renderedFrames = 0;
let benchmark = null;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 600);
const forceWebGL = new URLSearchParams(location.search).has('webgl');
const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));

const sky = new THREE.HemisphereLight(0xd6e7ff, 0x555464, 2);
const sun = new THREE.DirectionalLight(0xffefd6, 3);
sun.position.set(-50, 90, 70);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(450, 450),
  new THREE.MeshStandardMaterial({ color: 0x77766f, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.04;
scene.add(sky, sun, ground);

const modes = {
  day: { background: 0xaec7da, fog: 0xaec7da, ambient: 2, direct: 3, exposure: 1.3 },
  dusk: { background: 0x775f72, fog: 0x775f72, ambient: 1.1, direct: 2, exposure: 1.35 },
  night: { background: 0x172034, fog: 0x172034, ambient: 0.45, direct: 0.55, exposure: 1.65 }
};
function setMode(mode) {
  const value = modes[mode];
  if (!value) return;
  if (benchmark) finishBenchmark('Measurement cancelled: lighting changed. Run again with a fixed view.');
  scene.background = new THREE.Color(value.background);
  scene.fog = new THREE.FogExp2(value.fog, 0.0025);
  sky.intensity = value.ambient;
  sun.intensity = value.direct;
  renderer.toneMappingExposure = value.exposure;
  for (const button of buttons) button.setAttribute('aria-pressed', button.dataset.mode === mode);
  requestRender();
}
for (const button of buttons) button.addEventListener('click', () => setMode(button.dataset.mode));
setMode('day');

camera.position.set(85, 55, 115);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 30, 0);
controls.enableDamping = true;
controls.minDistance = 22;
controls.maxDistance = 270;
controls.maxPolarAngle = Math.PI * 0.49;
controls.update();

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  if (benchmark) finishBenchmark('Measurement cancelled: viewport changed. Run again with a fixed size.');
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  requestRender();
}
window.addEventListener('resize', resize);
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(canvas);

// A static study needs frames only while the camera settles or lighting changes.
// Count actual renders so a foreground idle check can detect accidental loops.
function requestRender() {
  if (ready && !disposed && !document.hidden && frame === null) frame = requestAnimationFrame(draw);
}
function cancelRender() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
}
function finishBenchmark(message) {
  if (benchmark) clearTimeout(benchmark.timeout);
  benchmark = null;
  benchmarkButton.disabled = !ready;
  metrics.textContent = message;
}
function draw(time) {
  frame = null;
  if (!ready || disposed || document.hidden) return;
  try {
    const changed = controls.update();
    const started = performance.now();
    renderer.render(scene, camera);
    renderedFrames++;
    canvas.dataset.renderedFrames = renderedFrames;
    if (benchmark) {
      // Warm up for one second; measure five seconds after shader setup.
      if (time >= benchmark.measureFrom) {
        if (benchmark.last !== null) benchmark.intervals.push(time - benchmark.last);
        benchmark.last = time;
      }
      if (time >= benchmark.measureFrom + 5000 && benchmark.intervals.length) {
        const samples = benchmark.intervals.sort((a, b) => a - b);
        const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
        const percentile = p => samples[Math.min(samples.length - 1, Math.floor(samples.length * p))];
        finishBenchmark(`${(1000 / average).toFixed(1)} frames/s · interval median ${percentile(0.5).toFixed(1)} ms, p95 ${percentile(0.95).toFixed(1)} ms · ${canvas.width}×${canvas.height}. Static model only; not GPU execution time.`);
      }
    } else {
      metrics.textContent = `${renderedFrames} frames rendered · last CPU submission ${(performance.now() - started).toFixed(1)} ms. Idle between changes.`;
    }
    if (changed || benchmark) requestRender();
  } catch (error) {
    ready = false;
    finishBenchmark('Drawing stopped. Reload the study to retry.');
    status.textContent = `Renderer study failed: ${error.message}`;
    console.error(error);
  }
}
controls.addEventListener('change', requestRender);
controls.addEventListener('start', () => {
  if (benchmark) finishBenchmark('Measurement cancelled: camera interaction. Run again with a fixed view.');
});
benchmarkButton.addEventListener('click', () => {
  if (!ready || disposed || document.hidden) {
    metrics.textContent = 'Measurement needs a ready renderer and a visible tab.';
    return;
  }
  const session = { measureFrom: performance.now() + 1000, last: null, intervals: [], timeout: null };
  benchmark = session;
  session.timeout = setTimeout(() => {
    if (benchmark !== session) return;
    finishBenchmark('Measurement cancelled: frames did not complete within 10 seconds. Retry in a visible tab.');
    cancelRender();
  }, 10000);
  benchmarkButton.disabled = true;
  metrics.textContent = 'Measuring a static model for 5 seconds after warm-up… Keep this tab visible.';
  requestRender();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelRender();
    if (benchmark) finishBenchmark('Measurement cancelled: tab became hidden. Run again with this tab visible.');
  } else requestRender();
});
window.addEventListener('pagehide', event => {
  cancelRender();
  if (benchmark) finishBenchmark('Measurement cancelled: page left.');
  if (event.persisted) return; // Keep resources for back/forward cache restoration.
  disposed = true;
  resizeObserver.disconnect();
  controls.dispose();
  const geometries = new Set();
  const materials = new Set();
  scene.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of [].concat(object.material || [])) materials.add(material);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  renderer.dispose();
});
window.addEventListener('pageshow', requestRender);

try {
  await renderer.init();
  resize();
  const gltf = await new GLTFLoader().loadAsync('../tower-study/tower-study.glb');
  scene.add(gltf.scene);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  if (bounds.isEmpty()) throw new Error('The study GLB contains no geometry.');
  const center = bounds.getCenter(new THREE.Vector3());
  controls.target.copy(center);
  controls.update();
  const metres = bounds.getSize(new THREE.Vector3());
  const backend = renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL 2 fallback';
  status.textContent = `${backend} · ${metres.y.toFixed(1)} m study height · ${gltf.scene.children.length} top-level parts. Source records: docs/shinsekai/research/.`;
  ready = true;
  benchmarkButton.disabled = false;
  requestRender();
} catch (error) {
  status.textContent = `Renderer study could not start: ${error.message}`;
  console.error(error);
}
