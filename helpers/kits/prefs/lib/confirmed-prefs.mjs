/**
 * Prefs kit — the owner's ledger and the confirmed-preferences document (the profile).
 *
 * The ledger (JSON, beside the profile) records every owner decision with its provenance; the profile is rendered from
 * the ledger alone, so it can only ever contain what the owner confirmed or wrote. Re-applying the same decisions
 * produces byte-identical files. The profile carries a trailer with the hash of its body: a profile edited by hand is
 * refused rather than overwritten, and a profile over the vocabulary's token cap is refused before anything is written.
 */
import { readFileSync, existsSync } from 'node:fs';
import { sha, stableJson, estimateTokens } from './util.mjs';
import { checkValue } from './vocab.mjs';

export const LEDGER_KIND = 'prefs-ledger';
export const PROVENANCE_IDS = 3;
const TRAILER_RE = /\n<!-- prefs-kit profile v1 · vocab ([a-z0-9_]+) · body sha256 ([0-9a-f]{16}) -->\n?$/;

export function emptyLedger(vocab) { return { v: 1, kind: LEDGER_KIND, vocab: vocab.name, entries: {} }; }

export function readLedger(file, vocab) {
  if (!existsSync(file)) return emptyLedger(vocab);
  const l = JSON.parse(readFileSync(file, 'utf8'));
  if (!l || l.v !== 1 || l.kind !== LEDGER_KIND || typeof l.entries !== 'object') throw new Error('not a prefs ledger: ' + file);
  if (l.vocab !== vocab.name) throw new Error(`ledger ${file} belongs to vocabulary "${l.vocab}", not "${vocab.name}"`);
  return l;
}
export function ledgerText(ledger) { return stableJson(ledger); }

const sameDecision = (a, b) => a.decision === b.decision && a.value === b.value && a.decided_at === b.decided_at;
const byTime = (a, b) => (a.decided_at < b.decided_at ? -1 : a.decided_at > b.decided_at ? 1 : 0);

/**
 * applyDecisions({ledger, decisions, via, ref, candidates: Map cid -> candidate, vocab}) -> {ledger, applied, skipped}
 * Pure: returns a new ledger. The latest decision (by decided_at) for a candidate is its state; older or repeated
 * decisions are kept in its history and change nothing.
 */
export function applyDecisions({ ledger, decisions, via, ref = null, candidates, vocab }) {
  const next = JSON.parse(JSON.stringify(ledger));
  const applied = [], skipped = [];
  for (const d of [...decisions].sort((a, b) => byTime(a, b) || (a.cid < b.cid ? -1 : 1))) {
    const cand = candidates.get(d.cid);
    const prev = next.entries[d.cid];
    if (!cand && !prev) { skipped.push({ cid: d.cid, reason: 'unknown candidate (no held note and no ledger entry)' }); continue; }
    if (prev && prev.history.some((h) => sameDecision(h, { ...d, value: d.decision === 'edit' ? checkValue(vocab, prev.dimension, d.value).value : null }))) { skipped.push({ cid: d.cid, reason: 'already applied' }); continue; }
    if (cand && !prev && d.decision !== 'reject' && ['negative_single_value', 'unknown_dimension'].includes(cand.hold_reason)) {
      skipped.push({ cid: d.cid, reason: 'not confirmable: ' + cand.hold_reason }); continue;
    }
    const base = prev || { cid: d.cid, dimension: cand.dimension, suggested_value: cand.value, stance: cand.stance, history: [] };
    let value = null;
    if (d.decision === 'edit') {
      const cv = checkValue(vocab, base.dimension, d.value);
      if (cv.error) { skipped.push({ cid: d.cid, reason: 'edit value refused: ' + cv.error }); continue; }
      value = cv.value;
    }
    const item = { decision: d.decision, value, decided_at: d.decided_at, via, ref };
    base.history = [...base.history, item].sort(byTime);
    const latest = base.history[base.history.length - 1];
    if (latest === item) {
      Object.assign(base, { decision: item.decision, value: item.decision === 'edit' ? item.value : base.suggested_value, decided_at: item.decided_at, via, ref });
      if (cand) {
        base.stance = cand.stance;
        const clean = cand.evidence.filter((r) => !r.injection_suspect);
        base.evidence_ids = clean.slice(0, PROVENANCE_IDS).map((r) => r.id);
        base.evidence_count = clean.length;
      }
    }
    next.entries[d.cid] = base;
    applied.push({ cid: d.cid, decision: d.decision, effective: latest === item });
  }
  return { ledger: next, applied, skipped };
}

/** activeEntries(ledger, vocab) -> entries the profile shows (latest decision confirm/edit; one value per "one" dimension). */
export function activeEntries(ledger, vocab) {
  const live = Object.values(ledger.entries).filter((e) => (e.decision === 'confirm' || e.decision === 'edit') && vocab.dims.has(e.dimension));
  live.sort((a, b) => (a.decided_at > b.decided_at ? -1 : a.decided_at < b.decided_at ? 1 : a.cid < b.cid ? -1 : 1));
  const seen = new Set(), out = [];
  for (const e of live) {
    const dim = vocab.dims.get(e.dimension);
    const key = dim.cardinality === 'one' ? e.dimension : `${e.dimension}\u0001${e.value}\u0001${e.stance}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function phrase(e, dim) {
  if (dim.cardinality === 'one') return e.value;
  const words = dim.polarity_labels || { '+': 'likes', '-': 'avoids' };
  return `${words[e.stance] || e.stance} "${e.value}"`;
}

/** renderProfile(ledger, vocab) -> Markdown text with a hash trailer (deterministic). */
export function renderProfile(ledger, vocab) {
  const active = activeEntries(ledger, vocab);
  const lines = [`# ${vocab.title}`, '',
    'Owner-confirmed preferences, written by the prefs kit from the owner\'s own decisions only. To change an entry,',
    'confirm, edit or reject it in Telegram; do not edit this file by hand (the kit refuses to overwrite hand edits).', ''];
  if (!active.length) lines.push('_No confirmed preferences yet._', '');
  for (const dim of vocab.dims.values()) {
    const rows = active.filter((e) => e.dimension === dim.id).sort((a, b) => (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
    if (!rows.length) continue;
    lines.push(`## ${dim.label}`);
    for (const e of rows) {
      const how = e.decision === 'edit' ? `edited ${e.decided_at.slice(0, 10)} from "${e.suggested_value}"` : `confirmed ${e.decided_at.slice(0, 10)}`;
      const ids = e.evidence_ids && e.evidence_ids.length
        ? ` · evidence ${e.evidence_ids.join(', ')}${e.evidence_count > e.evidence_ids.length ? ` (+${e.evidence_count - e.evidence_ids.length})` : ''}` : '';
      lines.push(`- ${phrase(e, dim)} — ${how}${ids}`);
    }
    lines.push('');
  }
  const body = lines.join('\n');
  return `${body}\n<!-- prefs-kit profile v1 · vocab ${vocab.name} · body sha256 ${sha(body).slice(0, 16)} -->\n`;
}

/** checkProfileFile(text|null, vocab) -> null when the kit may overwrite it, else the reason it may not. */
export function checkProfileFile(text, vocab) {
  if (text == null) return null;
  const m = TRAILER_RE.exec(text);
  if (!m) return 'the file is not a prefs-kit profile (no kit trailer); refusing to overwrite it';
  if (m[1] !== vocab.name) return `the profile belongs to vocabulary "${m[1]}", not "${vocab.name}"`;
  if (sha(text.slice(0, m.index)).slice(0, 16) !== m[2]) return 'the profile was edited by hand since the kit wrote it; refusing to overwrite (record the change as an owner decision instead)';
  return null;
}

/** sizeProblem(text, vocab) -> null, or the reason the profile is too big. */
export function sizeProblem(text, vocab) {
  const t = estimateTokens(text);
  return t > vocab.max_tokens ? `profile would be ~${t} tokens, over the cap of ${vocab.max_tokens}; nothing written (reject or merge entries first)` : null;
}

// Developed by: LightAISolutions
