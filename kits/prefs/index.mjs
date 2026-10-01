#!/usr/bin/env node
/**
 * Prefs kit — evidence -> held notes (quarantine) -> owner review -> owner-confirmed profile.
 * CLI: node helpers/kits/prefs/index.mjs <check|ingest|review|apply> … (see README.md). Also the library API.
 * Nothing here reads a connector, sends a message or calls the network; every path is a caller-supplied argument.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadVocab, validateVocab, checkValue } from './lib/vocab.mjs';
import { normalizeEvidence, parseEvidenceText, injectionReasons, opaqueRef, SOURCE_KINDS } from './lib/evidence.mjs';
import { buildCandidates, candidateId } from './lib/candidates.mjs';
import { readHeld, writeHeld, renderNote, parseNote, MAX_EVIDENCE_PER_NOTE } from './lib/held-notes.mjs';
import { buildReview } from './lib/review.mjs';
import { readDecisions } from './lib/decisions.mjs';
import { readLedger, ledgerText, applyDecisions, renderProfile, checkProfileFile, sizeProblem, activeEntries } from './lib/confirmed-prefs.mjs';

export { loadVocab, validateVocab, checkValue, normalizeEvidence, parseEvidenceText, injectionReasons, opaqueRef, SOURCE_KINDS,
  buildCandidates, candidateId, readHeld, writeHeld, renderNote, parseNote, buildReview, readDecisions, readLedger,
  applyDecisions, renderProfile, checkProfileFile, sizeProblem, activeEntries };
export { EXCERPT_MAX } from './lib/evidence.mjs';
export { CALLBACK_PREFIX, MAX_ITEMS, DEFAULT_ITEMS, ITEM_TEXT_MAX, CB_DATA_MAX_BYTES, PAYLOAD_MAX_CHARS, callbackData } from './lib/review.mjs';
export { MAX_DECISIONS } from './lib/decisions.mjs';
export { estimateTokens } from './lib/util.mjs';

const asVocab = (v) => (typeof v === 'string' ? loadVocab(v) : v);
export function defaultLedgerPath(profile) { return String(profile).replace(/\.md$/i, '') + '.decisions.json'; }

function writeAtomic(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = file + '.tmp-prefs';
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

/** Keep the newest MAX_EVIDENCE_PER_NOTE records per candidate, so what is written is exactly what was counted. */
function capPerCandidate(records) {
  const by = new Map();
  for (const r of records) {
    const id = candidateId(r.dimension, r.value);
    if (!by.has(id)) by.set(id, new Map());
    by.get(id).set(r.id, r);
  }
  const out = [];
  for (const m of by.values()) {
    const list = [...m.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? -1 : 1));
    out.push(...list.slice(0, MAX_EVIDENCE_PER_NOTE));
  }
  return out;
}

/** check({vocab, evidence:[raw]}) -> {records, errors:[{index, errors}]}; writes nothing. */
export function check({ vocab, evidence, salt = '' }) {
  const v = asVocab(vocab), records = [], errors = [];
  evidence.forEach((raw, index) => {
    const r = normalizeEvidence(raw, v, { salt });
    if (r.errors.length) errors.push({ index, errors: r.errors }); else records.push(r.record);
  });
  return { records, errors };
}

/** ingest({vocab, held, evidence:[raw], ledger?, salt?, minSupport?}) -> summary; valid records are held, invalid ones reported. */
export function ingest({ vocab, held, evidence, ledger = null, salt = '', minSupport }) {
  const v = asVocab(vocab);
  const { records, errors } = check({ vocab: v, evidence, salt });
  const existing = readHeld(held);
  const known = new Set(existing.records.map((r) => r.id));
  const fresh = records.filter((r) => !known.has(r.id));
  const all = capPerCandidate([...existing.records, ...fresh]);
  const candidates = buildCandidates(all, v, { minSupport });
  const led = ledger ? readLedger(ledger, v) : { entries: {} };
  const w = writeHeld(held, candidates, led, v, existing.files);
  const added = new Set(fresh.map((r) => r.id)).size;
  return { added, duplicates: records.length - added, rejected: errors,
    suspect: fresh.filter((r) => r.injection_suspect).map((r) => r.id), candidates: candidates.length,
    written: w.written, unchanged: w.unchanged.length, skipped_files: existing.skipped };
}

/** review({vocab, held, ledger, max?, includeSuspect?, minSupport?}) -> prefs_review payload; read-only. */
export function review({ vocab, held, ledger, max, includeSuspect = false, minSupport }) {
  const v = asVocab(vocab);
  const candidates = buildCandidates(readHeld(held).records, v, { minSupport });
  return buildReview({ candidates, ledger: readLedger(ledger, v), vocab: v, max, includeSuspect });
}

/**
 * apply({vocab, held, profile, ledger?, decisions: raw object, minSupport?}) -> summary.
 * The only path into the profile. Validates the owner's decisions, refuses a hand-edited or oversize profile before
 * writing anything, then writes the ledger, the profile and the held notes (status lines).
 */
export function apply({ vocab, held, profile, ledger, decisions, minSupport }) {
  const v = asVocab(vocab);
  const ledgerFile = ledger || defaultLedgerPath(profile);
  const d = readDecisions(decisions);
  if (d.errors.length) return { ok: false, errors: d.errors, applied: [], skipped: [] };
  const existing = readHeld(held);
  const candidates = buildCandidates(existing.records, v, { minSupport });
  const res = applyDecisions({ ledger: readLedger(ledgerFile, v), decisions: d.decisions, via: d.via, ref: d.ref,
    candidates: new Map(candidates.map((c) => [c.id, c])), vocab: v });
  const text = renderProfile(res.ledger, v);
  const refuse = checkProfileFile(existsSync(profile) ? readFileSync(profile, 'utf8') : null, v) || sizeProblem(text, v);
  if (refuse) return { ok: false, errors: [refuse], applied: [], skipped: res.skipped };
  const lt = ledgerText(res.ledger);
  const changed = !existsSync(ledgerFile) || readFileSync(ledgerFile, 'utf8') !== lt;
  if (changed) writeAtomic(ledgerFile, lt);
  if (!existsSync(profile) || readFileSync(profile, 'utf8') !== text) writeAtomic(profile, text);
  const notes = writeHeld(held, candidates.filter((c) => res.ledger.entries[c.id]), res.ledger, v, existing.files);
  return { ok: true, errors: [], applied: res.applied, skipped: res.skipped, profile_entries: activeEntries(res.ledger, v).length,
    ledger_changed: changed, notes_written: notes.written };
}

// ---------------------------------------------------------------------------------------------------------------- CLI
const USAGE = `usage: node helpers/kits/prefs/index.mjs <command> [options]
  check   --vocab V <evidence.json>                                  validate + normalise evidence, write nothing
  ingest  --vocab V --held DIR [--profile F | --ledger F] <evidence.json>   hold evidence as notes in DIR
  review  --vocab V --held DIR (--profile F | --ledger F) [--max N] [--include-suspect]   print the review payload
  apply   --vocab V --held DIR --profile F [--ledger F] <decisions.json>   promote the owner's decisions into F
options: --min-support N (default 1) · --salt-env NAME (env var whose value salts source refs; default PREFS_REF_SALT)
V is a preset name (travel) or a vocabulary JSON file. Output is JSON on stdout. Exit 0 ok · 1 finding · 2 usage.`;

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--include-suspect') o.includeSuspect = true;
    else if (a.startsWith('--')) { if (i + 1 >= argv.length) throw new Error('missing value for ' + a); o[a.slice(2)] = argv[++i]; }
    else o._.push(a);
  }
  return o;
}
const readJson = (f) => JSON.parse(readFileSync(resolve(f), 'utf8'));

export function main(argv, out = (s) => process.stdout.write(s + '\n'), err = (s) => process.stderr.write(s + '\n')) {
  let o;
  try { o = parseArgs(argv); } catch (e) { err(e.message + '\n' + USAGE); return 2; }
  const cmd = o._[0], file = o._[1];
  const need = (...keys) => keys.filter((k) => !o[k]);
  const salt = process.env[o['salt-env'] || 'PREFS_REF_SALT'] || '';
  const minSupport = o['min-support'] ? Number(o['min-support']) : undefined;
  if (minSupport !== undefined && !(Number.isInteger(minSupport) && minSupport >= 1)) { err('--min-support must be a whole number >= 1\n' + USAGE); return 2; }
  const ledger = o.ledger || (o.profile ? defaultLedgerPath(o.profile) : null);
  try {
    if (cmd === 'check' || cmd === 'ingest') {
      const missing = need('vocab', ...(cmd === 'ingest' ? ['held'] : []));
      if (missing.length || !file) { err('missing: ' + [...missing.map((k) => '--' + k), ...(file ? [] : ['<evidence.json>'])].join(' ') + '\n' + USAGE); return 2; }
      const evidence = parseEvidenceText(readFileSync(resolve(file), 'utf8'));
      const r = cmd === 'check' ? check({ vocab: o.vocab, evidence, salt })
        : ingest({ vocab: o.vocab, held: resolve(o.held), evidence, ledger: ledger && resolve(ledger), salt, minSupport });
      out(JSON.stringify(r, null, 2));
      return (cmd === 'check' ? r.errors : r.rejected).length ? 1 : 0;
    }
    if (cmd === 'review') {
      if (need('vocab', 'held').length || !ledger) { err('missing: --vocab, --held and --profile or --ledger\n' + USAGE); return 2; }
      out(JSON.stringify(review({ vocab: o.vocab, held: resolve(o.held), ledger: resolve(ledger), max: o.max, includeSuspect: !!o.includeSuspect, minSupport }), null, 2));
      return 0;
    }
    if (cmd === 'apply') {
      if (need('vocab', 'held', 'profile').length || !file) { err('missing: --vocab --held --profile <decisions.json>\n' + USAGE); return 2; }
      const r = apply({ vocab: o.vocab, held: resolve(o.held), profile: resolve(o.profile), ledger: ledger && resolve(ledger), decisions: readJson(file), minSupport });
      out(JSON.stringify(r, null, 2));
      return r.ok && !r.skipped.some((s) => s.reason !== 'already applied') ? 0 : 1;
    }
  } catch (e) { err('prefs: ' + e.message); return 1; }
  err(USAGE);
  return 2;
}

if (process.argv[1] && [fileURLToPath(import.meta.url), dirname(fileURLToPath(import.meta.url))].includes(resolve(process.argv[1]))) {
  process.exitCode = main(process.argv.slice(2));
}

// Developed by: LightAISolutions
