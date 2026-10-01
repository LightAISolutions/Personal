#!/usr/bin/env node
/**
 * Prefs kit — evidence -> held notes (quarantine) -> owner review -> owner-confirmed profile.
 * CLI: node helpers/kits/prefs/index.mjs <check|ingest|review|apply|interview> … (see README.md). Also the library API.
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
import { MAX_DECISIONS } from './lib/decisions.mjs';
import { isoDay } from './lib/util.mjs';
import { loadBank, validateBank, loadBankSchema, bankQuestionCount } from './lib/interview-bank.mjs';
import { readAnswers, supersede, bankWarnings, answerEvidence, profileSummary, isPick } from './lib/interview.mjs';

export { loadVocab, validateVocab, checkValue, normalizeEvidence, parseEvidenceText, injectionReasons, opaqueRef, SOURCE_KINDS,
  buildCandidates, candidateId, readHeld, writeHeld, renderNote, parseNote, buildReview, readDecisions, readLedger,
  applyDecisions, renderProfile, checkProfileFile, sizeProblem, activeEntries, loadBank, validateBank, loadBankSchema, bankQuestionCount,
  readAnswers, supersede, bankWarnings, answerEvidence, profileSummary };
export { BANK_SCHEMA_PATH } from './lib/interview-bank.mjs';
export { MAX_ANSWERS, SUMMARY_MAX, ANSWER_KINDS, PICK_KINDS } from './lib/interview.mjs';
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
export function apply({ vocab, held, profile, ledger, decisions, minSupport, ref = null }) {
  const v = asVocab(vocab);
  const ledgerFile = ledger || defaultLedgerPath(profile);
  const d = readDecisions(decisions);
  if (d.errors.length) return { ok: false, errors: d.errors, applied: [], skipped: [] };
  const existing = readHeld(held);
  const candidates = buildCandidates(existing.records, v, { minSupport });
  const res = applyDecisions({ ledger: readLedger(ledgerFile, v), decisions: d.decisions, via: d.via, ref: d.ref || ref,
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

const NOT_SAVED = {
  suspect: 'looked like an instruction; held for review',
  negative_single_value: 'a single-value dimension seen only negatively; held for review',
  unknown_dimension: 'unknown dimension; held',
  missing: 'no held candidate; held for review'
};

/**
 * interview({vocab, bank, held, profile, ledger?, answers: raw object, now?, salt?, minSupport?, max?, includeSuspect?})
 *   -> {ok, errors, decided_at, ref, applied, already, held, rejected, superseded, warnings, review, profile_summary, profile_entries}
 *
 * One call for the owner's interview answers (the core-written answers object, a payload carrying `interview`, or the
 * core's whole request envelope). Every legal answer becomes owner-chat evidence (source_ref interview:<qid>) held like
 * any other; each pick is then confirmed through an auto-built owner decisions document and the ordinary apply() —
 * decisions remain the only input that changes the profile. A pick is not saved (it stays held and goes to review)
 * when its record looks like an instruction or other clean evidence ties or outvotes it. Text answers are held only;
 * they and the unsaved picks come back in a prefs_review payload. decided_at = the request's created_at (else `now`)
 * plus the answer's index in milliseconds, so a later answer wins and a re-run changes no file.
 */
export function interview({ vocab, bank, held, profile, ledger, answers, now = null, salt = '', minSupport, max, includeSuspect = false }) {
  const v = asVocab(vocab);
  const ledgerFile = ledger || defaultLedgerPath(profile);
  const empty = { applied: [], already: [], held: [], rejected: [], superseded: [], warnings: [], review: null, profile_summary: null, profile_entries: null };
  const b = validateBank(typeof bank === 'string' ? loadBank(bank) : bank, v);
  if (b.errors.length) return { ok: false, errors: b.errors.map((e) => 'question bank: ' + e), decided_at: null, ref: null, ...empty };
  const r = readAnswers(answers, v, { now });
  if (r.errors.length) return { ok: false, errors: r.errors, decided_at: null, ref: null, ...empty };
  const base = Date.parse(r.decided_at), day = isoDay(r.decided_at);
  const ref = r.ref ? 'interview:' + r.ref : 'interview';
  const rejected = [...r.rejected];
  const { kept, superseded } = supersede(r.answers, v);
  const warnings = bankWarnings(kept, b.bank);

  // 1. Evidence: every kept answer, normalised exactly as ingest() will, so the pick's own record is known.
  const items = [];
  for (const a of kept) {
    const raw = answerEvidence(a, day);
    const n = normalizeEvidence(raw, v, { salt });
    if (n.errors.length) { rejected.push({ index: a.index, qid: a.qid, reason: n.errors.join('; ') }); continue; }
    items.push({ answer: a, raw, record: n.record, cid: candidateId(n.record.dimension, n.record.value) });
  }
  rejected.sort((x, y) => x.index - y.index);
  if (items.length) ingest({ vocab: v, held, evidence: items.map((i) => i.raw), ledger: ledgerFile, salt, minSupport });
  const candidates = buildCandidates(readHeld(held).records, v, { minSupport });
  const byCid = new Map(candidates.map((c) => [c.id, c]));

  // 2. Picks -> one confirm each, unless the record is suspect or the candidate's stance disagrees with the pick.
  const heldOut = [], toConfirm = new Map();
  const row = (i, extra) => ({ index: i.answer.index, qid: i.answer.qid, kind: i.answer.kind, cid: i.cid, dimension: i.record.dimension, value: i.record.value, polarity: i.record.polarity, ...extra });
  for (const i of items) {
    if (!isPick(i.answer)) { heldOut.push(row(i, { reason: i.record.injection_suspect ? 'text answer looked like an instruction; held back' : 'text answer: held for review' })); continue; }
    const c = byCid.get(i.cid);
    let why = null;
    if (i.record.injection_suspect) why = NOT_SAVED.suspect;
    else if (!c) why = NOT_SAVED.missing;
    else if (['negative_single_value', 'unknown_dimension'].includes(c.hold_reason)) why = NOT_SAVED[c.hold_reason];
    else if (c.stance !== i.record.polarity) why = `other evidence ${c.pro === c.con ? 'ties' : 'outvotes'} it; held for review`;
    if (why) { heldOut.push(row(i, { reason: why })); continue; }
    toConfirm.delete(i.cid);
    toConfirm.set(i.cid, row(i, { decided_at: new Date(base + i.answer.index).toISOString() }));
  }

  // 3. The auto-built owner decisions document(s), applied through the ordinary path.
  const list = [...toConfirm.values()], applied = [], already = [], errors = [];
  for (let k = 0; k < list.length && !errors.length; k += MAX_DECISIONS) {
    const chunk = list.slice(k, k + MAX_DECISIONS);
    const doc = { v: 1, kind: 'prefs_decisions', source: 'owner', via: 'telegram',
      decisions: chunk.map((d) => ({ cid: d.cid, decision: 'confirm', decided_at: d.decided_at })) };
    const res = apply({ vocab: v, held, profile, ledger: ledgerFile, decisions: doc, minSupport, ref });
    if (!res.ok) { errors.push(...res.errors); break; }
    const pick = new Map(chunk.map((d) => [d.cid, d]));
    for (const a of res.applied) applied.push({ ...pick.get(a.cid), effective: a.effective });
    for (const s of res.skipped) {
      if (s.reason === 'already applied') already.push(pick.get(s.cid));
      else heldOut.push({ ...pick.get(s.cid), decided_at: undefined, reason: s.reason });
    }
  }
  heldOut.sort((x, y) => x.index - y.index);
  for (const h of heldOut) delete h.decided_at;

  // 4. Review of what this interview left held, and the profile summary for /profile.
  const led = readLedger(ledgerFile, v);
  const mine = new Set(heldOut.map((h) => h.cid));
  for (const h of heldOut) if (led.entries[h.cid]) h.reason = 'already decided by the owner (' + led.entries[h.cid].decision + ')';
  const review = buildReview({ candidates: candidates.filter((c) => mine.has(c.id)), ledger: led, vocab: v, max, includeSuspect });
  return { ok: !errors.length, errors, decided_at: r.decided_at, ref, applied, already, held: heldOut, rejected, superseded, warnings,
    review, profile_summary: profileSummary(led, v), profile_entries: activeEntries(led, v).length };
}
export { interview as runInterview };

// ---------------------------------------------------------------------------------------------------------------- CLI
const USAGE = `usage: node helpers/kits/prefs/index.mjs <command> [options]
  check   --vocab V <evidence.json>                                  validate + normalise evidence, write nothing
  ingest  --vocab V --held DIR [--profile F | --ledger F] <evidence.json>   hold evidence as notes in DIR
  review  --vocab V --held DIR (--profile F | --ledger F) [--max N] [--include-suspect]   print the review payload
  apply   --vocab V --held DIR --profile F [--ledger F] <decisions.json>   promote the owner's decisions into F
  interview --vocab V --bank B --held DIR --profile F [--ledger F] [--now ISO] [--max N] <answers.json>
          the owner's interview answers: picks confirmed into F, text answers held and returned for review
options: --min-support N (default 1) · --salt-env NAME (env var whose value salts source refs; default PREFS_REF_SALT)
V is a preset name (travel) or a vocabulary JSON file; B a preset name (travel) or a question-bank JSON file.
Output is JSON on stdout. Exit 0 ok · 1 finding · 2 usage.`;

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
    if (cmd === 'interview') {
      if (need('vocab', 'bank', 'held', 'profile').length || !file) { err('missing: --vocab --bank --held --profile <answers.json>\n' + USAGE); return 2; }
      const r = interview({ vocab: o.vocab, bank: o.bank, held: resolve(o.held), profile: resolve(o.profile), ledger: ledger && resolve(ledger),
        answers: readJson(file), now: o.now || null, salt, minSupport, max: o.max, includeSuspect: !!o.includeSuspect });
      out(JSON.stringify(r, null, 2));
      return r.ok && !r.rejected.length ? 0 : 1;
    }
  } catch (e) { err('prefs: ' + e.message); return 1; }
  err(USAGE);
  return 2;
}

if (process.argv[1] && [fileURLToPath(import.meta.url), dirname(fileURLToPath(import.meta.url))].includes(resolve(process.argv[1]))) {
  process.exitCode = main(process.argv.slice(2));
}

// Developed by: LightAISolutions
