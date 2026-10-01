#!/usr/bin/env node
// git merge driver for log/maps-usage-ledger.json — `node scripts/merge-maps-ledger.mjs %O %A %B` (wired in
// .gitattributes `merge=maps-ledger` and configured by .github/workflows/merge-routine-memory.yml before the sweep).
// Two routine runs that start from the same main both spend Maps units and both rewrite the ledger's rows and
// updated_at, so a plain three-way merge conflicts on every pair of runs. Both sides spent their units independently,
// so per (month, sku, field): result = ours + theirs − base; updated_at = the later one. Writes the result over %A and
// exits 0; anything that is not a v1 maps-usage-ledger exits 1 and git reports the conflict as usual.
import fs from 'node:fs';
const [basePath, oursPath, theirsPath] = process.argv.slice(2);
const read = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8') || '{}'); } catch { return null; } };
const base = read(basePath) || {}, ours = read(oursPath), theirs = read(theirsPath);
const ok = (d) => d && d.v === 1 && d.kind === 'maps-usage-ledger' && d.months && typeof d.months === 'object';
if (!ok(ours) || !ok(theirs)) process.exit(1);
const n = (d, m, s, k) => Number(d?.months?.[m]?.[s]?.[k] ?? 0);
const out = { ...ours, updated_at: [ours.updated_at, theirs.updated_at].filter(Boolean).sort().pop() || null, months: {} };
for (const m of new Set([...Object.keys(ours.months), ...Object.keys(theirs.months)])) {
  out.months[m] = {};
  for (const s of new Set([...Object.keys(ours.months[m] || {}), ...Object.keys(theirs.months[m] || {})])) {
    const row = {};
    for (const k of new Set([...Object.keys(ours.months[m]?.[s] || {}), ...Object.keys(theirs.months[m]?.[s] || {})])) row[k] = n(ours, m, s, k) + n(theirs, m, s, k) - n(base, m, s, k);
    out.months[m][s] = row;
  }
}
fs.writeFileSync(oursPath, JSON.stringify(out, null, 2) + '\n');
// Developed by: LightAISolutions
