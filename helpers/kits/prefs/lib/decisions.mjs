/**
 * Prefs kit — the owner's decisions. The ONLY input that can change the confirmed profile. The core writes it from the
 * owner's Telegram taps (✅ confirm / ✏️ edit + the owner's reply / ❌ reject), either as a decisions document or as a
 * `request` envelope in to-brain/ whose payload.kind is "prefs_decisions":
 *
 *   {"v":1, "kind":"prefs_decisions", "source":"owner", "via":"telegram",
 *    "decisions":[{"cid":"c_0123456789", "decision":"confirm", "decided_at":"2026-09-20T10:04:00Z"},
 *                 {"cid":"c_abcdef0123", "decision":"edit", "value":"small museums", "decided_at":"…"},
 *                 {"cid":"c_9876543210", "decision":"reject", "decided_at":"…"}]}
 *
 * The kit cannot prove who wrote a file; the caller must hand it only a file the core wrote (a to-brain/req_*.json or the
 * core's export), never anything assembled from mail, documents or web pages. What the kit does enforce: the declared
 * provenance, the exact shape (unknown keys refuse the whole document) and an explicit decision per candidate.
 */
import { oneLine } from './util.mjs';

export const DECISION_CODES = { y: 'confirm', e: 'edit', n: 'reject', confirm: 'confirm', edit: 'edit', reject: 'reject' };
export const VIA = ['telegram', 'owner-chat'];
export const MAX_DECISIONS = 50;
const DOC_KEYS = new Set(['v', 'kind', 'source', 'via', 'batch_id', 'decisions']);
const ENV_KEYS = new Set(['v', 'id', 'type', 'created_at', 'producer', 'payload', 'in_reply_to', 'dedupe_key']);
const PAYLOAD_KEYS = new Set(['kind', 'text', 'chat', 'requested_at', 'batch_id', 'decisions', 'via']);
const ITEM_KEYS = new Set(['cid', 'decision', 'value', 'decided_at']);
const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

/** readDecisions(obj) -> {decisions:[{cid, decision, value, decided_at}], via, ref, errors}. Any error refuses all. */
export function readDecisions(raw) {
  const errors = [];
  const fail = (msg) => ({ decisions: [], via: null, ref: null, errors: [msg] });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('decisions must be a JSON object');
  let body, via, ref = null;
  if (raw.type !== undefined) {
    // A core request envelope (SPEC §2/§3): only the core writes `request`, so its provenance is the owner.
    if (raw.type !== 'request') return fail('an envelope carrying decisions must be a core "request", not "' + raw.type + '"');
    for (const k of Object.keys(raw)) if (!ENV_KEYS.has(k)) errors.push('unknown envelope key: ' + k);
    body = raw.payload;
    if (!body || typeof body !== 'object' || body.kind !== 'prefs_decisions') return fail('request payload.kind must be "prefs_decisions"');
    for (const k of Object.keys(body)) if (!PAYLOAD_KEYS.has(k)) errors.push('unknown payload key: ' + k);
    via = body.via || 'telegram';
    ref = typeof raw.id === 'string' ? oneLine(raw.id, 64) : null;
  } else {
    for (const k of Object.keys(raw)) if (!DOC_KEYS.has(k)) errors.push('unknown key: ' + k);
    if (raw.v !== 1 || raw.kind !== 'prefs_decisions') errors.push('decisions document needs v:1 and kind:"prefs_decisions"');
    if (raw.source !== 'owner') return fail('decisions must come from the owner (source:"owner"); refused');
    body = raw;
    via = raw.via;
  }
  if (!VIA.includes(via)) errors.push('via must be one of ' + VIA.join(', '));
  const list = body && body.decisions;
  if (!Array.isArray(list) || !list.length) errors.push('decisions must be a non-empty array');
  else if (list.length > MAX_DECISIONS) errors.push('at most ' + MAX_DECISIONS + ' decisions per document');
  const decisions = [];
  for (const [i, d] of (Array.isArray(list) ? list : []).entries()) {
    const at = `decisions[${i}]`;
    if (!d || typeof d !== 'object' || Array.isArray(d)) { errors.push(at + ' must be an object'); continue; }
    for (const k of Object.keys(d)) if (!ITEM_KEYS.has(k)) errors.push(at + ': unknown key ' + k);
    if (!/^c_[0-9a-f]{10}$/.test(String(d.cid || ''))) errors.push(at + ': cid must look like c_0123456789');
    const decision = DECISION_CODES[d.decision];
    if (!decision) errors.push(at + ': decision must be confirm | edit | reject (or y | e | n)');
    const when = ISO_TS.test(String(d.decided_at || '')) ? Date.parse(d.decided_at) : NaN;
    if (isNaN(when)) errors.push(at + ': decided_at must be an ISO timestamp');
    if (decision === 'edit' && (typeof d.value !== 'string' || !d.value.trim())) errors.push(at + ': an edit needs the owner\'s replacement value');
    if (decision !== 'edit' && d.value !== undefined) errors.push(at + ': only an edit carries a value');
    decisions.push({ cid: d.cid, decision, value: decision === 'edit' ? oneLine(d.value, 200) : null, decided_at: isNaN(when) ? null : new Date(when).toISOString() });
  }
  if (errors.length) return { decisions: [], via: null, ref: null, errors };
  return { decisions, via, ref, errors };
}

// Developed by: LightAISolutions
