import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {inspectGlb, MAX_GLB_BYTES} from '../assets-src/shinsekai/browser-study/tripo-intake.mjs';

const [input, candidate, assetUrl] = process.argv.slice(2);
if (!input || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(candidate ?? '') || !assetUrl) {
  console.error('Usage: node scripts/shinsekai-tripo-intake.mjs <export.glb> <fresh-candidate-id> <https://studio.tripo3d.ai/...>');
  process.exit(1);
}
try {
  const source = new URL(assetUrl);
  if (source.origin !== 'https://studio.tripo3d.ai' || source.username || source.password || source.hash || [...source.searchParams.keys()].some(key => !['id','task_id','model_id'].includes(key))) throw new Error('Provide the TRIPO asset URL without credentials or signed download parameters.');
  const stat = fs.statSync(input);
  if (!stat.isFile() || stat.size > MAX_GLB_BYTES || path.extname(input).toLowerCase() !== '.glb') throw new Error('Input must be a GLB file under 512 MiB.');
  const bytes = fs.readFileSync(input), {stats} = inspectGlb(bytes);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const out = path.resolve(repo, '../research-cache/tripo-intake', candidate);
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.mkdirSync(out); // Preserve numbered candidates; never overwrite a prior intake.
  fs.writeFileSync(path.join(out, 'source.glb'), bytes, {flag:'wx'});
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify({schemaVersion:1, candidate, importedAt:new Date().toISOString(), source:'TRIPO Studio export', assetUrl:source.href, sha256, stats, validation:'transport-only; full GLB validation pending', coordinates:'not calibrated; source orientation retained', classification:'AI-generated artistic candidate; not historical evidence', inputRights:'record input provenance before production adoption', commercialEntitlement:'verify plan and model entitlement before production adoption', productionApproved:false, next:'Open the local tripo.html review and select source.glb; compare scale, appearance and scene budget before adoption.'}, null, 2)+'\n', {flag:'wx'});
  console.log(JSON.stringify({candidate, directory:out, sha256, stats, productionApproved:false}, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
