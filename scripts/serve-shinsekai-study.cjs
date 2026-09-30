// Local-only source preview. The published Workers build does not include assets-src/.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
// Explicit generated review assets only; never serve author sources/cache trees.
const towerReview = path.resolve(root, '../research-cache/tower-base-113-runtime');
const towerNames = new Set(['manifest.json', ...[0,1,2].map(n=>`TB_EXT_LOD${n}.glb`), ...['hall','stair','lift','cinema'].flatMap(n=>[`cell_${n}.glb`,`cell_${n}_dream.glb`])]);
// Keep this origin separate from the main site's development service worker.
const port = Number(process.env.JTA_STUDY_PORT || 18765);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.css': 'text/css', '.jpg':'image/jpeg','.png':'image/png' };
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('JTA_STUDY_PORT must be 1–65535.');
const allowed = pathname => pathname.startsWith('/assets-src/shinsekai/browser-study/') ||
  ['/assets-src/shinsekai/eval-building-a/hybrid/review-cameras.json',...['manifest.json','exterior-lod0.glb','exterior-lod1.glb','exterior-lod2.glb','interior.glb','dream.glb','dream-petals.glb'].map(name=>'/assets-src/shinsekai/eval-building-a/hybrid/runtime/'+name)].includes(pathname) ||
  pathname.startsWith('/vendor/three-r186/') || ['tower-study.glb','tower-study-v3-open-gallery.glb','tower-study-v3-enclosed-box.glb','tower-study-v4-open-gallery.glb','tower-study-v4-enclosed-box.glb','tower-study-v4-look-uv.glb','tower-study-v4-look-ao.glb'].some(name=>pathname === '/assets-src/shinsekai/tower-study/'+name);
const server = http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end(); return; }
  if (pathname.includes('\0')) { response.writeHead(400).end(); return; }
  const reviewName=pathname.startsWith('/study/tower-base-113/')?pathname.slice('/study/tower-base-113/'.length):null;
  const reviewAllowed=reviewName!==null&&towerNames.has(reviewName);
  const file = reviewAllowed?path.resolve(towerReview,reviewName):path.resolve(root, `.${pathname}`);
  // Check the resolved path as well as the URL, including encoded traversal.
  const relative = `/${path.relative(root, file).split(path.sep).join('/')}`;
  if (reviewAllowed?!file.startsWith(`${towerReview}${path.sep}`):(!file.startsWith(`${root}${path.sep}`) || !allowed(relative))) { response.writeHead(403).end(); return; }
  fs.realpath(file, (error, realFile) => {
    if (error) { response.writeHead(404).end(); return; }
    if (realFile !== file) { response.writeHead(403).end(); return; }
    fs.stat(realFile, (error, stat) => {
      if (error || !stat.isFile()) { response.writeHead(404).end(); return; }
      const type = types[path.extname(file)] || 'application/octet-stream';
      response.setHeader('Content-Type', `${type}${/^(text\/|application\/json)/.test(type) ? '; charset=utf-8' : ''}`);
      response.setHeader('Content-Length', stat.size);
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Cache-Control', 'no-store');
      if (request.method === 'HEAD') { response.end(); return; }
      const stream = fs.createReadStream(realFile);
      stream.on('error', () => response.destroy());
      stream.pipe(response);
    });
  });
});
server.on('error', error => { console.error(`Study server: ${error.message}`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => {
  console.log(`Shinsekai study: http://127.0.0.1:${port}/assets-src/shinsekai/browser-study/index.html`);
});
