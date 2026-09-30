#!/usr/bin/env node
// Fetch Osaka Municipal Library originals after checking each item's CC0 notice.
const fs = require('node:fs/promises');
const path = require('node:path');

const items = [
  ['c1529001', '0000000021-OSK0158237'],
  ['c0234001', '0000000021-OSK0157352'],
  ['e0347001', '0000000021-OSK0160200'],
  ['d0289001', '0000000021-OSK0158891'],
  ['c1819001', '0000000021-OSK0158514'],
  ['d0285001', '0000000021-OSK0158887'],
  ['e0343001', '0000000021-OSK0160196'],
  ['e0346001', '0000000021-OSK0160199'],
  ['c1524001', '0000000021-OSK0158232'],
  ['d0286001', '0000000021-OSK0158888'],
  ['c1526001', '0000000021-OSK0158234'],
  ['c1816001', '0000000021-OSK0158511'],
  ['c1528001', '0000000021-OSK0158236'],
  ['c1525001', '0000000021-OSK0158233'],
  ['c1527001', '0000000021-OSK0158235'],
  ['c1188001', '0000000021-OSK0157930'],
  ['c1815001', '0000000021-OSK0158510'],
  ['d0278001', '0000000021-OSK0158880'],
  ['d0284001', '0000000021-OSK0158886'],
  ['e0341001', '0000000021-OSK0160194'],
  ['e0344001', '0000000021-OSK0160197'],
  ['c0313001', '0000000021-OSK0157431'],
  ['c0319001', '0000000021-OSK0157437'],
  ['d0761001', '0000000021-OSK0159201'],
  ['d1160001', '0000000021-OSK0159382'],
  ['c0120001', '0000000021-OSK0157238'],
  ['d1979001', '0000000021-OSK0159601'],
  ['e0342001', '0000000021-OSK0160195'],
  ['c1523001', '0000000021-OSK0158231'],
  ['c1518001', '0000000021-OSK0158226'],
];

const output = path.join(__dirname, '..', 'assets-src', 'shinsekai', 'references', 'oml');

async function fetchRetry(url, options) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const startId = process.argv[2];
  const startIndex = startId ? items.findIndex(([id]) => id === startId) : 0;
  if (startIndex < 0) throw new Error(`unknown management number: ${startId}`);
  for (const [id, titleCode] of items.slice(startIndex)) {
    const detailUrl = `https://image.oml.city.osaka.lg.jp/da/detail?tilcod=${titleCode}`;
    const detail = await fetchRetry(detailUrl, { headers: { 'User-Agent': 'JapanTimeAtlas-source-research/1.0' } });
    if (!detail.ok) throw new Error(`${id}: detail HTTP ${detail.status}`);
    const detailHtml = await detail.text();
    if (!detailHtml.includes(id) || !detailHtml.includes('申請不要・二次利用可') ||
        !detailHtml.includes('CC0（CC0 1.0')) {
      throw new Error(`${id}: individual CC0 notice or management number missing`);
    }
    const filePath = path.join(output, `${id}.jpg`);
    try {
      if ((await fs.stat(filePath)).size > 1000) {
        process.stdout.write(`${id}: CC0 confirmed; existing scan retained\n`);
        continue;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const url = new URL('https://image.oml.city.osaka.lg.jp/da/download');
    url.searchParams.set('id', titleCode);
    url.searchParams.set('size', 'org');
    url.searchParams.set('type', 'image');
    url.searchParams.set('file', `/写真・絵はがき・古文書・地図/${id}.jpg`);
    const response = await fetchRetry(url, { headers: { 'User-Agent': 'JapanTimeAtlas-source-research/1.0' } });
    if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length < 1000 || body[0] !== 0xff || body[1] !== 0xd8) {
      throw new Error(`${id}: response is not a JPEG`);
    }
    await fs.writeFile(filePath, body);
    process.stdout.write(`${id}: CC0 confirmed; ${body.length} bytes\n`);
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
