// Run state: one plain object (schemas/research-run.schema.json) shared by the CLI and the library session.
// Every recorder checks the budget first; a refused attempt is logged (status "refused") and never citable.
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { normalizeBudgets, checkSpend, remaining, isoSeconds, usage, MAX_REFUSED_RECORDS } from './budget.mjs';
import { entryId, searchEntry, fetchEntry, apiEntry, refusedEntry } from './ledger.mjs';
import { upsertClaim, labelClaim, resolveRef, LABELS } from './claims.mjs';
import { durationRange, parseMinutes } from './duration.mjs';
import { sanitizeLine } from './sanitize.mjs';
import { validate } from './schema.mjs';

export const RUN_FILE_MAX_BYTES = 2000000;

export function startRun({ topic, budgets = {}, now = Date.now(), runId } = {}) {
  const t = sanitizeLine(topic ?? '', 200);
  if (!t) throw usage('a run needs a --topic');
  return {
    v: 1, kit: 'research', run_id: runId || randomUUID(), topic: t, status: 'open', started_at: isoSeconds(now), finished_at: null,
    budgets: normalizeBudgets(budgets), counters: { searches: 0, fetches: 0, api: 0, refused: 0 }, ledger: [], claims: []
  };
}

const COUNTER = { search: 'searches', fetch: 'fetches', api: 'api' };
const BUILD = { search: searchEntry, fetch: fetchEntry, api: apiEntry };

/**
 * Record one search / fetch / api read. Returns { ok: true, entry, remaining } or, when the budget is spent,
 * { ok: false, code, message, entry|null, remaining } — the refused attempt is logged but carries no content.
 */
export function record(state, kind, input, now) {
  const verdict = checkSpend(state, kind, now);
  if (!verdict.ok) {
    let entry = null;
    if (state.counters.refused < MAX_REFUSED_RECORDS) {
      entry = refusedEntry(entryId(state.ledger.length + 1), now, { kind, query: input.query, url: input.url, note: verdict.message });
      state.ledger.push(entry);
    }
    state.counters.refused++;
    return { ok: false, code: verdict.code, message: verdict.message, entry, remaining: remaining(state, now) };
  }
  if (input.derived_from && !state.ledger.some((e) => e.id === input.derived_from)) throw usage(`derived-from ${input.derived_from} is not in the ledger`);
  const entry = BUILD[kind](entryId(state.ledger.length + 1), now, input); // throws usage errors before anything changes
  state.ledger.push(entry);
  state.counters[COUNTER[kind]]++;
  return { ok: true, entry, remaining: remaining(state, now) };
}

export function claim(state, input, now) { return upsertClaim(state, input, now); }

/** Two-source / label report. `ready` is true when every claim is plan-ready (critical claims need "confirmed"). */
export function check(state, now) {
  const claims = state.claims.map((c) => labelClaim(state, c, now));
  const counts = Object.fromEntries(LABELS.map((l) => [l, claims.filter((c) => c.label === l).length]));
  const not_ready = claims.filter((c) => !c.plan_ready).map((c) => c.id);
  return { run_id: state.run_id, checked_at: isoSeconds(now), ready: not_ready.length === 0, not_ready, labels: counts, claims };
}

/** Duration mentions "<minutes>@<ref>" (e.g. "60-120@L004", "90@L002.3") → durationRange() with publishers from the ledger. */
export function duration(state, specs) {
  const mentions = specs.map((spec) => {
    const at = String(spec).lastIndexOf('@');
    const mins = at > 0 ? parseMinutes(String(spec).slice(0, at)) : null;
    if (!mins) throw usage(`duration mention must look like 60-120@L004 (got ${JSON.stringify(spec)})`);
    const src = resolveRef(state, String(spec).slice(at + 1));
    const unusable = src.status !== 'ok';
    return { ...mins, ref: src.ref, source_key: unusable ? null : src.keys[0], injection_suspect: src.injection_suspect };
  });
  return durationRange(mentions);
}

export function summary(state, now) {
  const flagged = state.ledger.filter((e) => e.injection_suspect)
    .map((e) => ({ id: e.id, kind: e.kind, url: e.url, rules: [...new Set(e.injection_reasons.map((r) => r.rule))] }));
  const report = check(state, now);
  return {
    run_id: state.run_id, topic: state.topic, status: state.status, started_at: state.started_at, finished_at: state.finished_at,
    budgets: state.budgets, counters: state.counters, remaining: remaining(state, now),
    refused: state.ledger.filter((e) => e.status === 'refused').map((e) => ({ id: e.id, kind: e.kind, note: e.note })),
    errors: state.ledger.filter((e) => e.status === 'error').map((e) => e.id),
    injection_flagged: flagged, labels: report.labels, not_ready: report.not_ready, ready: report.ready
  };
}

export function finish(state, now) {
  if (state.status === 'open') { state.status = 'finished'; state.finished_at = isoSeconds(now); }
  return summary(state, now);
}

export function assertValid(state) {
  const errors = validate(state);
  if (errors.length) { const e = new Error(`run file does not match the schema: ${errors.slice(0, 5).join('; ')}`); e.exitCode = 1; throw e; }
  return state;
}

export function loadRun(file) {
  if (!existsSync(file)) throw usage(`no run file at ${file} (start one with: start --run ${file} --topic …)`);
  const raw = readFileSync(file, 'utf8');
  if (raw.length > RUN_FILE_MAX_BYTES) throw usage('run file is too large');
  let state;
  try { state = JSON.parse(raw); } catch { const e = new Error('run file is not valid JSON'); e.exitCode = 1; throw e; }
  return assertValid(state);
}

export function saveRun(file, state) {
  assertValid(state);
  const text = JSON.stringify(state, null, 1) + '\n';
  if (text.length > RUN_FILE_MAX_BYTES) throw usage('run file would exceed 2 MB');
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, text, { mode: 0o600 });
  renameSync(tmp, file);
}

// Developed by: LightAISolutions
