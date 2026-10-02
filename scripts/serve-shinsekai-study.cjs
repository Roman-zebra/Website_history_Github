// Local-only source preview. The published Workers build does not include assets-src/.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
// Explicit generated review assets only; never serve author sources/cache trees.
const towerReview = path.resolve(root, '../research-cache/tower-base-113-runtime');
const towerNames = new Set(['manifest.json', ...[0,1,2].map(n=>`TB_EXT_LOD${n}.glb`), ...['hall','stair','lift','cinema'].flatMap(n=>[`cell_${n}.glb`,`cell_${n}_dream.glb`])]);
const tower115Review=path.resolve(root,'../research-cache/tower-base-115-runtime');
const tower115Names=new Set([...towerNames,...[0,1,2].map(n=>`TW_LOD${n}.glb`)]);
const towerMobileReview=path.resolve(root,'../research-cache/tower-mobile-transport-001');
const towerMobileNames=new Set([...tower115Names,'phone-manifest.json']);
const cinemaProposal=path.resolve(root,'../research-cache/cinema-115-proposal');
const cinemaNames=new Set(['lossless-summary.json','cell_cinema-lossless-meshopt.glb','cell_cinema_dream-lossless-meshopt.glb']);
const hallProposal=path.resolve(root,'../research-cache/hall-115-proposal');
const hallNames=new Set(['split-summary.json','cell_hall-retained.glb','cell_hall_dream-retained.glb']);
const hallStreamReview=path.resolve(root,'../research-cache/hall-stream-transport-002');
const hallContactReview=path.resolve(root,'../research-cache/hall-contact-119-010');
const hallContactPath='/study/hall-contact-119-010/floor-contact.png';
const haoriSupportReview=path.resolve(root,'../research-cache/haori-support-119-003');
const haoriSupportPath='/study/haori-support-119-003/upper-cloth-support.glb';
const haoriContactReviews=new Map(['006','009'].map(rev=>[`/study/haori-wall-contact-119-${rev}/wall-contact.png`,path.resolve(root,`../research-cache/haori-wall-contact-119-${rev}`)]));
const cushionReview=path.resolve(root,'../research-cache/upper-cushion-119-003');
const cushionPath='/study/upper-cushion-119-003/interior-cushion.glb';
const cushionContourReview=path.resolve(root,'../research-cache/upper-cushion-119-004');
const cushionContourPaths=new Map(['035','065'].map(g=>[`/study/upper-cushion-119-004/interior-cushion-g${g}.glb`,`interior-cushion-g${g}.glb`]));
const cushionPerimeterReview=path.resolve(root,'../research-cache/upper-cushion-119-005');
const cushionPerimeterPaths=new Map(['022','040'].map(g=>[`/study/upper-cushion-119-005/interior-cushion-gap${g}.glb`,`interior-cushion-gap${g}.glb`]));
const cushionFabricReview=path.resolve(root,'../research-cache/cushion-fabric-119-006');
const cushionFabricPath='/study/cushion-fabric-119-006/interior-cushion-fabric.glb';
const cabinetReview=path.resolve(root,'../research-cache/cabinet-ink-119-001');
const cabinetPath='/study/cabinet-ink-119-001/interior-cabinet.glb';
const haoriFoldReviews=new Map(['007','008'].map(rev=>[`/study/haori-frontfold-119-${rev}/upper-cloth-support.glb`,path.resolve(root,`../research-cache/haori-frontfold-119-${rev}`)]));
const hallStreamNames=new Set(['stream-summary.json',...['cell_hall','cell_hall_dream'].flatMap(cell=>['core','desk','lamps','furnishings'].map(part=>cell+'-'+part+'.glb'))]);
const liftProposal=path.resolve(root,'../research-cache/lift-115-proposal');
const liftNames=new Set(['split-summary.json','cell_lift-retained.glb','cell_lift_dream-retained.glb']);
const tripoReview=path.resolve(root,'../research-cache/tripo-intake/baluster-001');
const tripoNames=new Set(['source.glb','receipt.json']);
const tripoMobileReview=path.resolve(root,'../research-cache');
const tripoMobileNames=new Set(['004','006','007'].flatMap(n=>['baluster-mobile.glb','receipt.json'].map(f=>'tripo-mobile-'+n+'/'+f)));
// Keep this origin separate from the main site's development service worker.
const port = Number(process.env.JTA_STUDY_PORT || 18765);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.css': 'text/css', '.jpg':'image/jpeg','.png':'image/png' };
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('JTA_STUDY_PORT must be 1–65535.');
const allowed = pathname => pathname.startsWith('/assets-src/shinsekai/browser-study/') ||
  ['/assets-src/shinsekai/eval-building-a/hybrid/review-cameras.json',...['manifest.json','exterior-lod0.glb','exterior-lod1.glb','exterior-lod2.glb','interior.glb','dream.glb','dream-petals.glb','upper-cloth.glb','upper-cloth-v2.glb','upper-cloth-v2-sewn.glb','upper-cloth-v2-sewn-hat.glb','upper-cloth-v2-sewn-rail.glb'].map(name=>'/assets-src/shinsekai/eval-building-a/hybrid/runtime/'+name)].includes(pathname) ||
  pathname.startsWith('/vendor/three-r186/') || ['tower-study.glb','tower-study-v3-open-gallery.glb','tower-study-v3-enclosed-box.glb','tower-study-v4-open-gallery.glb','tower-study-v4-enclosed-box.glb','tower-study-v4-look-uv.glb','tower-study-v4-look-ao.glb'].some(name=>pathname === '/assets-src/shinsekai/tower-study/'+name);
const server = http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end(); return; }
  if (pathname.includes('\0')) { response.writeHead(400).end(); return; }
  const tripoName=pathname.startsWith('/study/tripo/baluster-001/')?pathname.slice('/study/tripo/baluster-001/'.length):null;
  const tripoAllowed=tripoNames.has(tripoName);
  const tripoMobileName=pathname.startsWith('/study/tripo/mobile/')?pathname.slice('/study/tripo/mobile/'.length):null;
  const tripoMobileAllowed=tripoMobileNames.has(tripoMobileName);
  const cinemaName=pathname.startsWith('/study/cinema-115-proposal/')?pathname.slice('/study/cinema-115-proposal/'.length):null;
  const cinemaAllowed=cinemaNames.has(cinemaName);
  const hallName=pathname.startsWith('/study/hall-115-proposal/')?pathname.slice('/study/hall-115-proposal/'.length):null;
  const hallAllowed=hallNames.has(hallName);
  const hallStreamName=pathname.startsWith('/study/hall-115-stream/')?pathname.slice('/study/hall-115-stream/'.length):null;
  const hallStreamAllowed=hallStreamNames.has(hallStreamName);
  const hallContactAllowed=pathname===hallContactPath;
  const haoriSupportAllowed=pathname===haoriSupportPath;
  const haoriContactAllowed=haoriContactReviews.has(pathname);
  const cushionAllowed=pathname===cushionPath;
  const cushionContourAllowed=cushionContourPaths.has(pathname);
  const cushionPerimeterAllowed=cushionPerimeterPaths.has(pathname);
  const cushionFabricAllowed=pathname===cushionFabricPath;
  const cabinetAllowed=pathname===cabinetPath;
  const haoriFoldAllowed=haoriFoldReviews.has(pathname);
  const liftName=pathname.startsWith('/study/lift-115-proposal/')?pathname.slice('/study/lift-115-proposal/'.length):null;
  const liftAllowed=liftNames.has(liftName);
  const reviewPrefix=['113','115'].find(n=>pathname.startsWith('/study/tower-base-'+n+'/'));
  const mobileName=pathname.startsWith('/study/tower-mobile-115/')?pathname.slice('/study/tower-mobile-115/'.length):null;
  const mobileAllowed=towerMobileNames.has(mobileName);
  const reviewName=reviewPrefix?pathname.slice(('/study/tower-base-'+reviewPrefix+'/').length):null;
  const reviewRoot=cushionFabricAllowed?cushionFabricReview:cushionPerimeterAllowed?cushionPerimeterReview:cushionContourAllowed?cushionContourReview:haoriFoldAllowed?haoriFoldReviews.get(pathname):cabinetAllowed?cabinetReview:cushionAllowed?cushionReview:haoriContactAllowed?haoriContactReviews.get(pathname):haoriSupportAllowed?haoriSupportReview:hallContactAllowed?hallContactReview:hallStreamAllowed?hallStreamReview:mobileAllowed?towerMobileReview:tripoMobileAllowed?tripoMobileReview:tripoAllowed?tripoReview:liftAllowed?liftProposal:hallAllowed?hallProposal:cinemaAllowed?cinemaProposal:reviewPrefix==='115'?tower115Review:towerReview;
  const reviewAllowed=cushionFabricAllowed||cushionPerimeterAllowed||cushionContourAllowed||haoriFoldAllowed||cabinetAllowed||cushionAllowed||haoriContactAllowed||haoriSupportAllowed||hallContactAllowed||hallStreamAllowed||mobileAllowed||tripoMobileAllowed||tripoAllowed||liftAllowed||hallAllowed||cinemaAllowed||(reviewName!==null&&(reviewPrefix==='115'?tower115Names:towerNames).has(reviewName));
  const file = reviewAllowed?path.resolve(reviewRoot,cushionFabricAllowed?'interior-cushion-fabric.glb':cushionPerimeterAllowed?cushionPerimeterPaths.get(pathname):cushionContourAllowed?cushionContourPaths.get(pathname):haoriFoldAllowed?'upper-cloth-support.glb':cabinetAllowed?'interior-cabinet.glb':cushionAllowed?'interior-cushion.glb':haoriContactAllowed?'wall-contact.png':haoriSupportAllowed?'upper-cloth-support.glb':hallContactAllowed?'floor-contact.png':hallStreamAllowed?hallStreamName:mobileAllowed?mobileName:tripoMobileAllowed?tripoMobileName:tripoAllowed?tripoName:liftAllowed?liftName:hallAllowed?hallName:cinemaAllowed?cinemaName:reviewName):path.resolve(root, `.${pathname}`);
  // Check the resolved path as well as the URL, including encoded traversal.
  const relative = `/${path.relative(root, file).split(path.sep).join('/')}`;
  if (reviewAllowed?!file.startsWith(`${reviewRoot}${path.sep}`):(!file.startsWith(`${root}${path.sep}`) || !allowed(relative))) { response.writeHead(403).end(); return; }
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
