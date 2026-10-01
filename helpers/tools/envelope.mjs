#!/usr/bin/env node
// Routine helper: stamp a from-brain envelope with a REAL random id, the real clock and the canonical file name.
// Live runs showed routines inventing UUIDs (patterned after the SKILL.md examples) and timestamps; an invented id can
// collide with an earlier one and the core drops the envelope as a duplicate. Zero deps.
//   node helpers/tools/envelope.mjs <type> <producer> <payload.json> [--pack NAME] [--dedupe-key K] [--in-reply-to ID] [--out DIR]
// Prints {"file_name","content","errors"}; with --out, also writes DIR/<file_name>. Keep payload + output files OUTSIDE the repo.
// --pack NAME adds the pack's envelope_types (helpers/packs/NAME/helper.json) to the accepted core types.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** The core envelope types, read from the same source the core validates against (no drift). */
export const TYPES = JSON.parse(/var ENVELOPE_TYPES = (\[[^\]]*\])/.exec(fs.readFileSync(path.join(ROOT, 'core/00_config.js'), 'utf8'))[1].replace(/'/g, '"'));
/** typesFor('hello') → core types + the pack's envelope_types. */
export function typesFor(pack) {
  if (!pack) return TYPES.slice();
  const file = path.join(ROOT, 'packs', pack, 'helper.json');
  if (!fs.existsSync(file)) throw new Error('unknown pack: ' + pack + ' (no ' + path.relative(ROOT, file) + ')');
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  return TYPES.concat((m.envelope_types || []).filter((t) => !TYPES.includes(t)));
}
const longest = (v) => (typeof v === 'string' ? v.length : v && typeof v === 'object' ? Math.max(0, ...Object.values(v).map(longest)) : 0);

/** Build an envelope object + file name. `now` is injectable for tests. Structural checks mirror helpers/core/09_mailbox.js. */
export function makeEnvelope({ type, producer, payload, dedupeKey, inReplyTo, now = new Date(), id = crypto.randomUUID(), types = TYPES }) {
  const env = { v: 1, id, type, created_at: now.toISOString().replace(/\.\d{3}Z$/, 'Z'), producer, payload };
  if (dedupeKey) env.dedupe_key = dedupeKey;
  if (inReplyTo) env.in_reply_to = inReplyTo;
  const errors = [];
  if (!types.includes(type)) errors.push('unknown type: ' + type + ' (see helpers/SPEC.md §2; pack types need --pack NAME)');
  if (type === 'reply' && !inReplyTo) errors.push('reply needs --in-reply-to <request id>');
  if (!/^[a-z0-9_-]{1,64}$/.test(String(producer))) errors.push('producer must match ^[a-z0-9_-]{1,64}$ (use the skill name)');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) errors.push('payload must be a JSON object');
  else {
    const pj = JSON.stringify(payload);
    if (pj.length > 65536) errors.push('payload too large (' + pj.length + ' chars > 65536)');
    if (longest(payload) > 16000) errors.push('a payload string exceeds 16000 chars');
  }
  if (dedupeKey && dedupeKey.length > 120) errors.push('dedupe_key longer than 120');
  if (inReplyTo && inReplyTo.length > 64) errors.push('in_reply_to longer than 64');
  const stamp = env.created_at.replace(/[-:]/g, '').replace(/Z$/, '');
  return { file_name: stamp + '_' + type + '_' + id + '.json', envelope: env, errors };
}

function main(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i]; else pos.push(argv[i]); }
  const [type, producer, file] = pos;
  if (!type || !producer || !file) { console.error('usage: node helpers/tools/envelope.mjs <type> <producer> <payload.json> [--pack NAME] [--dedupe-key K] [--in-reply-to ID] [--out DIR]'); return 2; }
  const r = makeEnvelope({ type, producer, payload: JSON.parse(fs.readFileSync(file, 'utf8')), dedupeKey: opt['dedupe-key'], inReplyTo: opt['in-reply-to'], types: typesFor(opt.pack) });
  const content = JSON.stringify(r.envelope);
  if (!r.errors.length && opt.out) fs.writeFileSync(path.join(opt.out, r.file_name), content);
  console.log(JSON.stringify({ file_name: r.file_name, content, errors: r.errors }));
  return r.errors.length ? 1 : 0;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));

// Developed by: LightAISolutions
