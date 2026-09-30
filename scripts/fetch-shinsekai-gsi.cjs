// Cache a small, fixed GSI aerial tile set for historical georeferencing.
// Source imagery stays outside Git and is never treated as a 1912 site survey.
const fs = require('node:fs/promises');
const path = require('node:path');

const latitude = 34.6525393;
const longitude = 135.5063098; // modern tower control point, NOT the 1912 tower
const cache = path.resolve(__dirname, '../../research-cache/gsi');
const layers = [
  ['std', 18, 2, 'current GSI street map: persistent road-control cross-check only'],
  ['ort_1928', 18, 2, '1928 aerial: first tower still present, Luna Park closed'],
  ['ort_riku10', 18, 2, '1936–1942 aerial: first tower still present, Luna Park closed'],
  ['ort_USA10', 17, 1, '1945–1950 aerial: after first tower removal']
];

async function main() {
  await fs.mkdir(cache, { recursive: true });
  for (const [layer, zoom, radius, purpose] of layers) {
    const n = 2 ** zoom;
    const centerX = Math.floor((longitude + 180) / 360 * n);
    const centerY = Math.floor((1 - Math.asinh(Math.tan(latitude * Math.PI / 180)) / Math.PI) / 2 * n);
    const dir = path.join(cache, layer);
    await fs.mkdir(dir, { recursive: true });
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        const file = path.join(dir, `${zoom}-${x}-${y}.png`);
        try {
          await fs.access(file);
          process.stdout.write(`${layer}\t${x}/${y}\tcached\n`);
          continue;
        } catch {}
        const url = `https://cyberjapandata.gsi.go.jp/xyz/${layer}/${zoom}/${x}/${y}.png`;
        const response = await fetch(url, { headers: { 'User-Agent': 'JapanTimeAtlas-Shinsekai-Research/1.0' } });
        if (!response.ok) {
          process.stdout.write(`${layer}\t${x}/${y}\tHTTP ${response.status}\n`);
          continue;
        }
        const body = Buffer.from(await response.arrayBuffer());
        if (body.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
          throw new Error(`Unexpected tile format: ${url}`);
        }
        await fs.writeFile(file, body, { flag: 'wx' });
        process.stdout.write(`${layer}\t${x}/${y}\t${body.length} bytes\n`);
      }
    }
    process.stdout.write(`${layer}: ${purpose}\n`);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
