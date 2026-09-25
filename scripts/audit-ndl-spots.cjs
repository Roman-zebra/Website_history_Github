/* Keep a compact, Git-tracked inventory of the 171 editorial spot records. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const sets = [
  ['places-world.json', 'places', 'featured'],
  ['liminal.json', 'places', 'liminal'],
  ['landmarks.json', 'landmarks', 'landmark'],
  ['regional-landmarks-v1.json', 'landmarks', 'regional'],
];
const escape = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
const rows = [['dataset', 'key', 'ja', 'tier', 'japanese_characters', 'source_ids', 'status']];
for (const [file, field, group] of sets) {
  const doc = JSON.parse(fs.readFileSync(path.join(root, 'data', file), 'utf8'));
  for (const [i, spot] of doc[field].entries()) {
    const text = group === 'featured' ? (spot.story_ja || []).join('') :
      group === 'liminal' ? [spot.hook_ja, spot.why_ja, spot.summaries?.ja].filter(Boolean).join('') :
      group === 'landmark' ? spot.summaries?.ja || '' : spot.summaries?.ja || spot.extract_ja || '';
    rows.push([group, spot.id || spot.wiki_ja || spot.name || String(i), spot.ja || spot.name_ja || spot.name,
      spot.tier ?? (group === 'liminal' ? 3 : ''), text.length, (spot.researchSources || []).map(source => source.id).join(';'),
      spot.researchSources?.length ? 'researched' : 'pending']);
  }
}
if (rows.length !== 172) throw new Error(`Expected 171 spots; got ${rows.length - 1}`);
const out = path.join(root, 'research', 'ndl', 'spot-inventory.csv');
fs.writeFileSync(out, '\ufeff' + rows.map(row => row.map(escape).join(',')).join('\n') + '\n', 'utf8');
console.log(`Wrote ${rows.length - 1} spot records to ${path.relative(root, out)}`);
