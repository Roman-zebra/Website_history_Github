// Fetch each public NDL source once. The local cache is outside the repository;
// findings and source URLs are committed separately after inspection.
const fs = require('node:fs/promises');
const path = require('node:path');

const cache = path.resolve(__dirname, '../../research-cache/ndl');
const sources = [
  ['962657', '建築写真類聚 第1期 第24 特殊建築 巻1'],
  ['952032', '大阪独案内'],
  ['917709', '大大阪独案内'],
  ['964429', '四五日の旅'],
  ['1112102', '新日本写真大観'],
  ['966056', '大阪府写真帖']
];

async function getOnce(pid, kind, url) {
  const file = path.join(cache, `${pid}-${kind}.json`);
  try {
    await fs.access(file);
    return { file, cached: true };
  } catch {}
  const response = await fetch(url, { headers: { 'User-Agent': 'JapanTimeAtlas-Shinsekai-Research/1.0' } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const body = await response.text();
  JSON.parse(body);
  await fs.writeFile(file, body, { flag: 'wx' });
  return { file, cached: false };
}

async function main() {
  await fs.mkdir(cache, { recursive: true });
  for (const [pid, title] of sources) {
    for (const [kind, url] of [
      ['manifest', `https://dl.ndl.go.jp/api/iiif/${pid}/manifest.json`],
      ['ocr', `https://lab.ndl.go.jp/dl/api/book/fulltext-json/${pid}`]
    ]) {
      try {
        const result = await getOnce(pid, kind, url);
        const stat = await fs.stat(result.file);
        process.stdout.write(`${pid}\t${title}\t${kind}\t${result.cached ? 'cached' : 'downloaded'}\t${stat.size}\n`);
      } catch (error) {
        process.stdout.write(`${pid}\t${title}\t${kind}\tERROR\t${error.message}\n`);
      }
    }
  }

  // Small inspection copies only; original IIIF scans remain at NDL.
  for (const [pid, page] of [
    ['962657', 48], ['962657', 49],
    ['952032', 19], ['952032', 30], ['952032', 47], ['952032', 95],
    ['917709', 39], ['964429', 170], ['1112102', 62],
    ['966056', 174], ['966056', 176], ['966056', 177],
    ['966056', 178], ['966056', 179], ['966056', 180], ['966056', 182]
  ]) {
    const file = path.join(cache, `${pid}-page-${page}.jpg`);
    try {
      await fs.access(file);
      process.stdout.write(`${pid}\tpage ${page}\tcached\n`);
      continue;
    } catch {}
    const manifest = JSON.parse(await fs.readFile(path.join(cache, `${pid}-manifest.json`), 'utf8'));
    const canvas = manifest.sequences[0].canvases[page - 1];
    const imageService = canvas.images[0].resource.service['@id'];
    const response = await fetch(`${imageService}/full/1600,/0/default.jpg`);
    if (!response.ok) {
      process.stdout.write(`${pid}\tpage ${page}\tERROR ${response.status}\n`);
      continue;
    }
    await fs.writeFile(file, Buffer.from(await response.arrayBuffer()), { flag: 'wx' });
    process.stdout.write(`${pid}\tpage ${page}\tdownloaded\n`);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
