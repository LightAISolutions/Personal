// Run state: one plain object (schemas/research-run.schema.json) shared by the CLI and the library session.
// Every recorder checks the budget first; a refused attempt is logged (status "refused") and never citable.
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { normalizeBudgets, checkSpend, remaining, isoSeconds, usage, MAX_REFUSED_RECORDS } from './budget.mjs';
import { entryId, searchEntry, fetchEntry, apiEntry, refusedEntry, SOURCE_KINDS, sourceTags } from './ledger.mjs';
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

/**
 * mentions(state, { source_kind?, language? }) → [{ ref, kind, url, domain, publisher, source_kind, language, official }]
 * Every USABLE web source of the run (status ok, not injection_suspect): one row per fetch (ref `L004`) and one per search
 * result (ref `L002.3`, tagged like its search). Lets a caller count local mentions per place from the refs it kept,
 * without re-reading pages: the kit does no matching — the caller maps its own place → refs and reads the tags here.
 * Filters: `source_kind` (one of SOURCE_KINDS, or 'untagged') and `language` (exact canonical tag, or its primary
 * subtag: 'ja' matches 'ja' and 'ja-JP'). Runs written before these tags existed read as untagged.
 */
export function mentions(state, { source_kind, language } = {}) {
  if (source_kind != null && source_kind !== 'untagged' && !SOURCE_KINDS.includes(source_kind)) throw usage(`source kind filter must be one of ${SOURCE_KINDS.join(', ')}, untagged`);
  const lang = language != null && language !== '' ? sourceTags({ language }).language : null;
  const rows = [];
  for (const e of state.ledger) {
    if (e.status !== 'ok' || (e.kind !== 'search' && e.kind !== 'fetch')) continue;
    const tags = { source_kind: e.source_kind ?? null, language: e.language ?? null };
    if (e.kind === 'fetch') { if (!e.injection_suspect) rows.push({ ref: e.id, kind: 'fetch', url: e.url, domain: e.domain, publisher: e.publisher, ...tags, official: e.official }); continue; }
    e.results.forEach((r, i) => { if (!r.injection_suspect) rows.push({ ref: `${e.id}.${i + 1}`, kind: 'snippet', url: r.url, domain: r.domain, publisher: r.publisher, ...tags, official: false }); });
  }
  return rows.filter((m) => (source_kind == null || (source_kind === 'untagged' ? m.source_kind === null : m.source_kind === source_kind))
    && (lang == null || m.language === lang || (m.language || '').split('-')[0] === lang));
}

/** Counts of usable, non-flagged search and fetch entries per source kind (searches count once, not per result). */
export function sourceKindCounts(state) {
  const out = Object.fromEntries(SOURCE_KINDS.concat('untagged').map((k) => [k, 0]));
  for (const e of state.ledger) if (e.status === 'ok' && (e.kind === 'search' || e.kind === 'fetch') && !e.injection_suspect) out[e.source_kind ?? 'untagged']++;
  return out;
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
    injection_flagged: flagged, labels: report.labels, not_ready: report.not_ready, ready: report.ready,
    source_kinds: sourceKindCounts(state)
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
