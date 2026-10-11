import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {patchAsyncPassSide067} from './async-pass-side-067.mjs';

// Only the pinned upstream renderer is accepted. Never replace the input file.
const expected = 'a78400fa1d359e81fcc12b84ed0a89a7fbecb4b8373e28ae8f9d2b11f6ea13bc';
export async function patchFixedRenderer(input, output) {
  if (!input || !output || resolve(input) === resolve(output)) throw Error('Distinct input and new output paths required');
  const bytes = await fs.readFile(input);
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== expected) throw Error('Fixed Three.js r186 input SHA256 mismatch');
  const result = patchAsyncPassSide067(bytes.toString('utf8'));
  await fs.writeFile(output, result.source, {flag: 'wx'});
  return result.proof;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    console.log(JSON.stringify(await patchFixedRenderer(process.argv[2], process.argv[3]), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
