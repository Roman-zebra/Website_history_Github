#!/usr/bin/env node
// Fetch the seven Osaka Municipal Library CC0 postcards verified in the source ledger.
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
];

const output = path.join(__dirname, '..', 'assets-src', 'shinsekai', 'references', 'oml');

async function main() {
  await fs.mkdir(output, { recursive: true });
  for (const [id, titleCode] of items) {
    const url = new URL('https://image.oml.city.osaka.lg.jp/da/download');
    url.searchParams.set('id', titleCode);
    url.searchParams.set('size', 'org');
    url.searchParams.set('type', 'image');
    url.searchParams.set('file', `/写真・絵はがき・古文書・地図/${id}.jpg`);
    const response = await fetch(url, { headers: { 'User-Agent': 'JapanTimeAtlas-source-research/1.0' } });
    if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length < 1000 || body[0] !== 0xff || body[1] !== 0xd8) {
      throw new Error(`${id}: response is not a JPEG`);
    }
    await fs.writeFile(path.join(output, `${id}.jpg`), body);
    process.stdout.write(`${id}: ${body.length} bytes\n`);
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
