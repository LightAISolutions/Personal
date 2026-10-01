/**
 * Prefs kit — interview answers. The core asks the bank's questions in Telegram and writes the owner's taps as an
 * answers file; the kit turns them into evidence and, for picks, into an owner decisions document:
 *
 *   {"version":1, "answers":[{"qid":"pace-01", "dimension":"pace", "value":"relaxed", "polarity":"+", "kind":"pick"},
 *                            {"qid":"favourites-02", "dimension":"food", "value":"night markets", "polarity":"+", "kind":"text"}]}
 *
 * Accepted as that object, as a request payload carrying it under `interview`, or as the core's whole `request`
 * envelope (its created_at is the decision time, its id the decision ref). The answers file has the trust of a
 * decisions document: only the core writes it, from the owner's own taps. A text answer is only ever data the caller
 * already turned into {dimension, value, polarity}; the kit never parses prose.
 */
import { oneLine } from './util.mjs';
import { checkValue } from './vocab.mjs';
import { activeEntries } from './confirmed-prefs.mjs';

export const MAX_ANSWERS = 200;
export const SUMMARY_MAX = 1200;
export const PICK_KINDS = ['pick', 'multi', 'scale'];
export const ANSWER_KINDS = [...PICK_KINDS, 'text'];
const ANSWER_KEYS = new Set(['qid', 'dimension', 'value', 'polarity', 'kind']);
const DOC_KEYS = new Set(['version', 'answers']);
const QID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;
const PROSE = 'a text answer must already carry a legal {dimension, value, polarity}; the kit never parses prose';

export const isPick = (a) => PICK_KINDS.includes(a.kind);

/**
 * readAnswers(raw, {now}) -> {answers, rejected, errors, decided_at, ref, shape}.
 * answers: [{index, qid, dimension, value (normalised), polarity, kind}] in file order, each legal for the vocabulary.
 * rejected: [{index, qid, reason}] — a bad answer is left out and reported. errors: the whole file is refused.
 * decided_at: the envelope's created_at when the input is an envelope, else `now` (an ISO timestamp); the kit keeps
 * no clock, so one of the two is required.
 */
export function readAnswers(raw, vocab, { now = null } = {}) {
  const fail = (msg) => ({ answers: [], rejected: [], errors: [msg], decided_at: null, ref: null, shape: null });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('interview answers must be a JSON object');
  let doc = raw, created = null, ref = null, shape = 'answers';
  if (raw.type !== undefined) {
    if (raw.type !== 'request') return fail('an envelope carrying interview answers must be a core "request", not "' + raw.type + '"');
    if (!raw.payload || typeof raw.payload !== 'object' || Array.isArray(raw.payload)) return fail('the request envelope has no payload object');
    doc = raw.payload.interview;
    shape = 'envelope';
    if (raw.created_at !== undefined) {
      if (!ISO_TS.test(String(raw.created_at)) || isNaN(Date.parse(raw.created_at))) return fail('envelope created_at must be an ISO timestamp');
      created = raw.created_at;
    }
    if (typeof raw.id === 'string' && raw.id) ref = oneLine(raw.id, 64);
  } else if (raw.interview !== undefined) { doc = raw.interview; shape = 'payload'; }
  else if (raw.answers === undefined && raw.version === undefined) return fail('no interview object found (expected {version, answers}, a payload carrying interview, or a core request envelope)');
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return fail('no interview object found');
  for (const k of Object.keys(doc)) if (!DOC_KEYS.has(k)) return fail('unknown interview key: ' + k);
  if (doc.version !== 1) return fail('interview version must be 1');
  if (!Array.isArray(doc.answers) || !doc.answers.length) return fail('interview answers must be a non-empty array');
  if (doc.answers.length > MAX_ANSWERS) return fail(`at most ${MAX_ANSWERS} answers per interview`);
  const when = created || now;
  if (!when) return fail('no decision time: pass --now <ISO timestamp> (a core request envelope supplies its created_at)');
  if (!ISO_TS.test(String(when)) || isNaN(Date.parse(when))) return fail('--now must be an ISO timestamp');
  const answers = [], rejected = [];
  doc.answers.forEach((a, index) => {
    const qid = a && typeof a.qid === 'string' ? oneLine(a.qid, 64) : null;
    const reject = (reason) => rejected.push({ index, qid, reason });
    if (!a || typeof a !== 'object' || Array.isArray(a)) return reject('answer must be an object');
    const bad = Object.keys(a).filter((k) => !ANSWER_KEYS.has(k));
    if (bad.length) return reject('unknown key: ' + bad.join(', '));
    if (!QID_RE.test(String(a.qid || ''))) return reject('qid must be 1-64 chars of A-Z a-z 0-9 _ . : -');
    if (!ANSWER_KINDS.includes(a.kind)) return reject('kind must be one of ' + ANSWER_KINDS.join(', '));
    const hasTriple = typeof a.dimension === 'string' && a.dimension && typeof a.value === 'string' && a.value.trim() && ['+', '-'].includes(a.polarity);
    if (!hasTriple) return reject(a.kind === 'text' ? PROSE : 'a pick needs dimension, value and polarity "+" or "-"');
    const cv = checkValue(vocab, a.dimension, a.value);
    if (cv.error) return reject(a.kind === 'text' ? cv.error + ' (' + PROSE + ')' : cv.error);
    answers.push({ index, qid: a.qid, dimension: a.dimension, value: cv.value, polarity: a.polarity, kind: a.kind });
  });
  return { answers, rejected, errors: [], decided_at: new Date(Date.parse(when)).toISOString(), ref, shape };
}

/**
 * supersede(answers, vocab) -> {kept, superseded}. Within one file the later of two picks wins: on a single-value
 * dimension any earlier "+" pick of the same dimension, on a multi-value dimension an earlier pick of the same value
 * (whatever its polarity). Text answers never supersede and are never superseded.
 */
export function supersede(answers, vocab) {
  const key = (a) => (vocab.dims.get(a.dimension).cardinality === 'one' && a.polarity === '+' ? a.dimension : a.dimension + '\u0001' + a.value);
  const last = new Map();
  for (const a of answers) if (isPick(a)) last.set(key(a), a.index);
  const kept = [], superseded = [];
  for (const a of answers) {
    if (isPick(a) && last.get(key(a)) !== a.index) superseded.push({ index: a.index, qid: a.qid, by: last.get(key(a)) });
    else kept.push(a);
  }
  return { kept, superseded };
}

/** bankWarnings(answers, bank) -> [{index, qid, warning}]: answers that do not match the bank (reported, not refused). */
export function bankWarnings(answers, bank) {
  const out = [];
  for (const a of answers) {
    const q = bank.questions.get(a.qid);
    const warn = (warning) => out.push({ index: a.index, qid: a.qid, warning });
    if (!q) { warn('not a question of the bank'); continue; }
    const typedOther = a.kind === 'text' && q.kind === 'multi' && q.other === true; // the owner typed a value under ✏️ Other
    if (!typedOther && (a.kind === 'text') !== (q.kind === 'text')) { warn(`answer kind "${a.kind}" does not match the question kind "${q.kind}"`); continue; }
    if (a.kind === 'text') continue;
    if (a.dimension !== q.dimension || !q.options.some((o) => o.value === a.value && o.polarity === a.polarity)) warn('not one of the question\'s options');
  }
  return out;
}

/** answerEvidence(answer, day) -> one raw evidence record (owner-chat, source_ref interview:<qid>). */
export function answerEvidence(a, day) {
  return { source_kind: 'owner-chat', source_ref: 'interview:' + a.qid, date: day,
    excerpt: `Interview ${a.kind} (${a.qid}): ${a.dimension} ${a.polarity} ${a.value}`,
    suggests: { dimension: a.dimension, value: a.value, polarity: a.polarity } };
}

/**
 * profileSummary(ledger, vocab, max = 1200) -> plain text (no HTML, no Markdown) for /profile: one line per dimension
 * with confirmed entries, in vocabulary order. Cut at a line boundary with a "+N more" line when it would not fit.
 */
export function profileSummary(ledger, vocab, max = SUMMARY_MAX) {
  const active = activeEntries(ledger, vocab);
  const head = active.length ? `${vocab.title}: ${active.length} confirmed preference${active.length === 1 ? '' : 's'}.` : `${vocab.title}: no confirmed preferences yet.`;
  const lines = [];
  for (const dim of vocab.dims.values()) {
    const rows = active.filter((e) => e.dimension === dim.id).sort((a, b) => (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
    if (!rows.length) continue;
    if (dim.cardinality === 'one') { lines.push(oneLine(`${dim.label}: ${rows[0].value}`, 300)); continue; }
    const words = dim.polarity_labels || { '+': 'likes', '-': 'avoids' };
    const parts = ['+', '-'].map((s) => { const vs = rows.filter((e) => e.stance === s).map((e) => e.value); return vs.length ? `${words[s]} ${vs.join(', ')}` : null; }).filter(Boolean);
    lines.push(oneLine(`${dim.label}: ${parts.join('; ')}`, 300));
  }
  const out = [oneLine(head, 200)], RESERVE = 12; // room for a final "+NN more" line
  let len = out[0].length;
  for (let i = 0; i < lines.length; i++) {
    const last = i === lines.length - 1;
    if (len + 1 + lines[i].length + (last ? 0 : RESERVE) > max) { out.push(`+${lines.length - i} more`); break; }
    out.push(lines[i]);
    len += 1 + lines[i].length;
  }
  return out.join('\n').slice(0, max);
}

// Developed by: LightAISolutions
