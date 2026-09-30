#!/usr/bin/env node
// Download the two 1912 OML cadastral sheets after checking individual CC0 records.
const fs = require('node:fs/promises');
const path = require('node:path');

const sheets = [
  ['s0004038', '0000000021-OSK0186828', '3-8-甲; Shinsekai'],
  ['s0004031', '0000000021-OSK0186821', '2-8-乙; Tennoji east control'],
];
const output = path.join(__dirname, '..', 'assets-src', 'shinsekai', 'references', 'oml', 'maps');
const headers = { 'User-Agent': 'JapanTimeAtlas-source-research/1.0' };

async function main() {
  await fs.mkdir(output, { recursive: true });
  for (const [id, titleCode, description] of sheets) {
    const page = await fetch(`https://image.oml.city.osaka.lg.jp/da/detail?tilcod=${titleCode}`, { headers });
    if (!page.ok) throw new Error(`${id}: record HTTP ${page.status}`);
    const html = await page.text();
    if (!html.includes(id) || !html.includes('申請不要・二次利用可') ||
        !html.includes('CC0（CC0 1.0')) {
      throw new Error(`${id}: individual CC0 notice or management number missing`);
    }
    const file = path.join(output, `${id}.jpg`);
    try {
      if ((await fs.stat(file)).size > 1_000_000) {
        process.stdout.write(`${id}: CC0 confirmed; existing original retained\n`);
        continue;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const url = new URL('https://image.oml.city.osaka.lg.jp/da/download/');
    url.searchParams.set('id', titleCode);
    url.searchParams.set('size', 'org');
    url.searchParams.set('type', 'image');
    url.searchParams.set('file', `/写真・絵はがき・古文書・地図/${id}.jpg`);
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`${id}: image HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1_000_000 || bytes[0] !== 255 || bytes[1] !== 216 ||
        bytes.at(-2) !== 255 || bytes.at(-1) !== 217) {
      throw new Error(`${id}: incomplete or non-JPEG original`);
    }
    const temporary = `${file}.part`;
    await fs.writeFile(temporary, bytes);
    await fs.rename(temporary, file);
    process.stdout.write(`${id}: CC0 confirmed; ${bytes.length} bytes; ${description}\n`);
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
