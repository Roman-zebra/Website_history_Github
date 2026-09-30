import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createFrameBenchmark } from './frame-benchmark.mjs';
import {LOOK_DEV_VIEWS,LOOK_DEV_SIZE} from './look-dev-views.mjs';

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
let capturing=false,currentMode='day';
const lookView=document.querySelector('#lookView'),capture=document.querySelector('#capture'),captureStatus=document.querySelector('#captureStatus');
const benchmark = createFrameBenchmark({
  canStart: () => ready && !disposed && !document.hidden,
  onTimeout: cancelRender,
  onChange: ({ running, message, result }) => {
    benchmarkButton.disabled = running || !ready;
    metrics.textContent = result
      ? `${result.framesPerSecond.toFixed(1)} frames/s · interval median ${result.medianMs.toFixed(1)} ms, p95 ${result.p95Ms.toFixed(1)} ms · ${canvas.width}×${canvas.height}. Static model only; not GPU execution time.`
      : message;
  }
});
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
  currentMode=mode;
  benchmark.cancel('Measurement cancelled: lighting changed. Run again with a fixed view.');
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

function fixedView() {
  const view=LOOK_DEV_VIEWS[lookView.value];
  benchmark.cancel('Measurement cancelled: fixed view changed.');
  // Flush orbit damping before installing a deterministic review pose.
  controls.enableDamping=false;controls.update();
  camera.position.set(...view.position);controls.target.set(...view.target);camera.fov=view.fov;camera.updateProjectionMatrix();controls.update();controls.enableDamping=true;
  requestRender();
}
lookView.addEventListener('change',fixedView);
capture.addEventListener('click',async()=>{
  if(!ready||disposed||capturing||document.hidden)return;
  benchmark.cancel('Measurement cancelled: PNG capture.');
  fixedView();cancelRender();capturing=true;controls.enabled=false;
  capture.disabled=lookView.disabled=true;buttons.forEach(b=>b.disabled=true);benchmarkButton.disabled=true;
  const pixelRatio=renderer.getPixelRatio();
  try {
    renderer.setPixelRatio(1);renderer.setSize(...LOOK_DEV_SIZE,false);camera.aspect=LOOK_DEV_SIZE[0]/LOOK_DEV_SIZE[1];camera.updateProjectionMatrix();
    renderer.render(scene,camera);
    await new Promise(resolve=>requestAnimationFrame(resolve));
    if(disposed||document.hidden)throw new Error('Capture cancelled while hidden or leaving.');
    renderer.render(scene,camera);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('PNG encoding failed.');
    const name=`tower-v2-${lookView.value}-${currentMode}-1280x720.png`,url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
    captureStatus.textContent=`Saved ${name} · ${renderer.backend?.isWebGPUBackend?'WebGPU':'WebGL 2'} · provisional appearance`;
  } catch(error) {captureStatus.textContent=error.message;}
  finally {
    capturing=false;
    if(!disposed){renderer.setPixelRatio(pixelRatio);controls.enabled=true;capture.disabled=lookView.disabled=false;buttons.forEach(b=>b.disabled=false);benchmarkButton.disabled=!ready;resize();}
  }
});

function resize() {
  if(capturing||disposed)return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  benchmark.cancel('Measurement cancelled: viewport changed. Run again with a fixed size.');
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
  if (ready && !disposed && !capturing && !document.hidden && frame === null) frame = requestAnimationFrame(draw);
}
function cancelRender() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
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
    if (benchmark.active) {
      benchmark.sample(time);
    } else {
      metrics.textContent = `${renderedFrames} frames rendered · last CPU submission ${(performance.now() - started).toFixed(1)} ms. Idle between changes.`;
    }
    if (changed || benchmark.active) requestRender();
  } catch (error) {
    ready = false;
    benchmark.cancel('Drawing stopped. Reload the study to retry.');
    benchmarkButton.disabled = true;
    metrics.textContent = 'Drawing stopped. Reload the study to retry.';
    status.textContent = `Renderer study failed: ${error.message}`;
    console.error(error);
  }
}
controls.addEventListener('change', requestRender);
controls.addEventListener('start', () => {
  benchmark.cancel('Measurement cancelled: camera interaction. Run again with a fixed view.');
});
benchmarkButton.addEventListener('click', () => {
  if (benchmark.start()) requestRender();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelRender();
    benchmark.cancel('Measurement cancelled: tab became hidden. Run again with this tab visible.');
  } else requestRender();
});
window.addEventListener('pagehide', event => {
  cancelRender();
  benchmark.cancel('Measurement cancelled: page left.');
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
  lookView.disabled=capture.disabled=false;
  benchmarkButton.disabled = false;
  requestRender();
} catch (error) {
  status.textContent = `Renderer study could not start: ${error.message}`;
  console.error(error);
}
