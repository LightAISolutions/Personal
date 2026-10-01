/**
 * Prefs kit — evidence records. A reader (a routine or the hb-reader agent with connectors) writes one record per
 * signal it found; the kit validates, sanitises and normalises it before anything is held:
 *
 *   {"source_kind":"gmail", "source_ref":"<anything the reader can re-find it by>", "date":"2026-05-14",
 *    "excerpt":"<short quote>", "suggests":{"dimension":"food", "value":"street food", "polarity":"+"},
 *    "injection_suspect":false}
 *
 * The excerpt is DATA: it is sanitised, capped and scanned for instruction-like text, and it never influences which
 * dimension, value or polarity a record carries (only `suggests` does). The raw source_ref never leaves this module:
 * it is replaced by an opaque hash so no message, event or file id lands in memory.
 */
import { sha, isoDay, sanitizeExcerpt, normValue } from './util.mjs';
import { checkValue } from './vocab.mjs';

export const SOURCE_KINDS = ['gmail', 'calendar', 'drive', 'takeout', 'seed', 'owner-chat'];
export const EXCERPT_MAX = 280;
const ALLOWED_KEYS = new Set(['source_kind', 'source_ref', 'date', 'excerpt', 'suggests', 'injection_suspect']);
const SUGGEST_KEYS = new Set(['dimension', 'value', 'polarity']);

/** Instruction-shaped text. A hit marks the record injection_suspect; the kit never clears that flag. */
export const INJECTION_PATTERNS = [
  /\b(ignore|disregard|forget|override)\b.{0,40}\b(instruction|rule|prompt|previous|above|prior)/i,
  /\b(system|developer)\s*(prompt|message|instruction)/i,
  /\byou\s+(are|must|should|will)\s+(now|always|never)\b/i,
  /\b(assistant|claude|system)\s*:\s*\S/i,
  /\b(add|write|save|set|record|promote|store)\b.{0,40}\b(to|in|into)\s+(the\s+|my\s+|your\s+|their\s+)?(profile|memory)\b/i,
  /\bmark\b.{0,40}\b(confirmed|approved)\b/i,
  /\b(owner|user)\s+(has\s+)?(confirmed|approved|agreed|wants\s+you)/i,
  /<\/?(script|iframe|system|instructions?)\b/i,
  /\b(run|execute)\b.{0,20}\b(command|tool|script|code)\b/i,
  // Second-language instruction injection (WP-6b red team): "ignore / forget / bypass … instructions / rules" in French,
  // German, Spanish, Italian, Portuguese and Dutch, and "note / attention to AI assistants" in the same languages.
  /\b(ignorez|ignorer|ignorent|oubliez?|oublie|contournez|ignorier(?:e|en|t|st)|vergiss|vergessen sie|umgeh(?:e|en)|missachte(?:n)?|ignor[aá](?:r|d|lo|las)?|olvid[ae]|ignorate|dimentica(?:te)?|esque[cç]a|esquecer|negeer|vergeet)\b[^.\n]{0,40}\b(instructions?|consignes|directives|r[èe]gles|anweisung(?:en)?|instruktionen|regeln|vorgaben|instrucciones|reglas|istruzioni|regole|instru[cç][oõ]es|regras|instructies|regels)\b/i,
  /\b(note|message|attention|instructions?|consignes?|hinweis|achtung|nachricht|nota|atenci[oó]n|aviso|avviso|attenzione|atenção)\s+(aux?|pour|an|f[üu]r|a|para|per|ai|agli|alle)\s+(les\s+|tous les\s+|die\s+|alle\s+|los\s+|las\s+|todos los\s+|gli\s+|os\s+|todos os\s+)?(assistants?\s+(ia|d'ia|virtuels)|ia|llms?|ki[- ]?assistenten|ki|asistentes?\s+(de\s+)?ia|assistenti\s+(di\s+)?ia|assistentes?\s+(de\s+)?ia|ai[- ]assistenten)\b/i
];

export function injectionReasons(text) {
  // Scan the raw text and a folded copy (zero-width characters, diacritics and odd spacing removed) so simple
  // obfuscation such as 'Ig<U+200B>nore previous instructions' is still caught.
  const raw = String(text || ''), folded = normValue(raw);
  return INJECTION_PATTERNS.map((re, i) => (re.test(raw) || re.test(folded) ? 'pattern-' + (i + 1) : null)).filter(Boolean);
}

/** opaqueRef('gmail', rawId, salt) -> 24 hex chars; deterministic, so re-reading the same message dedupes. */
export function opaqueRef(kind, raw, salt = '') { return sha('prefs-ref', salt, kind, raw).slice(0, 24); }

/** evidenceId(normalised record) -> 'e_' + 12 hex; one id per (source, dimension, value, polarity). */
export function evidenceId(r) { return 'e_' + sha('prefs-ev', r.source_kind, r.source_ref, r.dimension, r.value, r.polarity).slice(0, 12); }

/**
 * normalizeEvidence(raw, vocab, {salt}) -> {record, errors}. record:
 * {id, source_kind, source_ref, date, excerpt, dimension, value, polarity, injection_suspect, injection_reasons}
 */
export function normalizeEvidence(raw, vocab, { salt = '' } = {}) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { record: null, errors: ['evidence must be an object'] };
  for (const k of Object.keys(raw)) if (!ALLOWED_KEYS.has(k)) errors.push('unknown key: ' + k);
  if (!SOURCE_KINDS.includes(raw.source_kind)) errors.push('source_kind must be one of ' + SOURCE_KINDS.join(', '));
  const ref = typeof raw.source_ref === 'string' ? raw.source_ref.trim() : '';
  if (!ref || ref.length > 200) errors.push('source_ref must be a non-empty string of at most 200 chars');
  const date = isoDay(raw.date);
  if (!date) errors.push('date must be YYYY-MM-DD or an ISO datetime');
  if (typeof raw.excerpt !== 'string' || !raw.excerpt.trim()) errors.push('excerpt must be a non-empty string');
  if (raw.injection_suspect != null && typeof raw.injection_suspect !== 'boolean') errors.push('injection_suspect must be a boolean');
  const s = raw.suggests;
  let value = null;
  if (!s || typeof s !== 'object' || Array.isArray(s)) errors.push('suggests must be an object {dimension, value, polarity}');
  else {
    for (const k of Object.keys(s)) if (!SUGGEST_KEYS.has(k)) errors.push('unknown key: suggests.' + k);
    if (!['+', '-'].includes(s.polarity)) errors.push('suggests.polarity must be "+" or "-"');
    const cv = checkValue(vocab, s.dimension, s.value);
    if (cv.error) errors.push(cv.error); else value = cv.value;
  }
  if (errors.length) return { record: null, errors };
  const excerpt = sanitizeExcerpt(raw.excerpt, EXCERPT_MAX);
  const reasons = injectionReasons(raw.excerpt);
  const record = {
    source_kind: raw.source_kind, source_ref: opaqueRef(raw.source_kind, ref, salt), date, excerpt,
    dimension: s.dimension, value, polarity: s.polarity,
    injection_suspect: raw.injection_suspect === true || reasons.length > 0, injection_reasons: reasons
  };
  record.id = evidenceId(record);
  return { record, errors };
}

/** parseEvidenceText(text) -> array of raw records; accepts a JSON array, {"evidence":[…]} or JSON Lines. */
export function parseEvidenceText(text) {
  const t = String(text).trim();
  if (!t) return [];
  if (t.startsWith('[')) return JSON.parse(t);
  if (t.startsWith('{') && !t.includes('\n{')) { const o = JSON.parse(t); return Array.isArray(o.evidence) ? o.evidence : [o]; }
  return t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
}

// Developed by: LightAISolutions
