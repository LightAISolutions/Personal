/**
 * Prefs kit — the review the owner sees. Builds one Telegram-sized item per candidate (text + ✅ / ✏️ / ❌ buttons) and
 * the payload the core turns into messages. The kit never sends anything: the brain wraps the payload in an envelope
 * (tools/envelope.mjs) and the core shows it; the owner's taps come back as a decisions document (decisions.mjs).
 *
 * Texts are plain text; excerpts are untrusted, so the core must HTML-escape them like any `notice` text. Excerpts of
 * injection_suspect evidence are never shown, only labelled. Nothing already decided (confirmed, edited or rejected)
 * is proposed again.
 */
import { sha, oneLine } from './util.mjs';
import { statement } from './held-notes.mjs';
import { activeEntries } from './confirmed-prefs.mjs';

export const CALLBACK_PREFIX = 'pf';
export const MAX_ITEMS = 20;
export const DEFAULT_ITEMS = 8;
export const ITEM_TEXT_MAX = 1200;          // one Telegram message each; far under TG_SPLIT_AT 3900 (SPEC §18)
export const CB_DATA_MAX_BYTES = 64;        // SPEC §18
export const PAYLOAD_MAX_CHARS = 65536;     // SPEC §2
const EXAMPLES = 2, EXCERPT_SHOWN = 160;

export function callbackData(cid, code) {
  const data = `${CALLBACK_PREFIX}:${cid}:${code}`;
  if (Buffer.byteLength(data, 'utf8') > CB_DATA_MAX_BYTES) throw new Error('callback_data over 64 bytes: ' + data);
  return data;
}

function itemText(c, vocab, current) {
  const out = [`Preference? ${statement(c, vocab)}`];
  out.push(`Evidence: ${c.pro} for, ${c.con} against · ${c.sources.join(', ') || 'no clean source'} · ${c.first_seen} to ${c.last_seen}`);
  for (const r of c.evidence.filter((x) => !x.injection_suspect).slice(0, EXAMPLES)) {
    out.push(`• ${r.date} ${r.source_kind} (${r.polarity}): "${oneLine(r.excerpt, EXCERPT_SHOWN)}"`);
  }
  if (c.suspect) out.push(`⚠ ${c.suspect} item(s) looked like instructions: not counted, excerpt withheld.`);
  if (c.hold_reason) out.push(`⚠ Held back by the kit: ${c.hold_reason}. Shown because suspect candidates were requested.`);
  if (current) out.push(`Profile now: "${current}". Confirming replaces it.`);
  if (c.rivals.length) out.push(`Conflicts: also seen ${c.rivals.map((r) => `"${r.value}" (${r.pro})`).join(', ')}.`);
  out.push('✅ confirm · ✏️ edit (then reply with the right value) · ❌ reject');
  return oneLineEach(out).join('\n').slice(0, ITEM_TEXT_MAX);
}
const oneLineEach = (lines) => lines.map((l) => oneLine(l, 400));

/**
 * buildReview({candidates, ledger, vocab, max, includeSuspect}) -> payload
 * {v:1, kind:"prefs_review", vocab, batch_id, items:[{cid, dimension, value, stance, statement, text, suspect, buttons}],
 *  held_back:[{cid, statement, reason}], more}
 */
export function buildReview({ candidates, ledger, vocab, max = DEFAULT_ITEMS, includeSuspect = false }) {
  const limit = Math.max(1, Math.min(MAX_ITEMS, Number(max) || DEFAULT_ITEMS));
  const open = candidates.filter((c) => !ledger.entries[c.id]);
  const held_back = [], eligible = [];
  for (const c of open) {
    const suspectOk = includeSuspect && ['suspect_only', 'tied', 'low_support'].includes(c.hold_reason);
    if (c.proposable || suspectOk) eligible.push(c);
    else held_back.push({ cid: c.id, statement: statement(c, vocab), reason: c.hold_reason });
  }
  eligible.sort((a, b) => b.support - a.support || a.suspect - b.suspect || (a.id < b.id ? -1 : 1));
  const chosen = eligible.slice(0, limit);
  const now = new Map(activeEntries(ledger, vocab).filter((e) => vocab.dims.get(e.dimension).cardinality === 'one').map((e) => [e.dimension, e.value]));
  const items = chosen.map((c) => ({
    cid: c.id, dimension: c.dimension, value: c.value, stance: c.stance, statement: statement(c, vocab),
    suspect: c.suspect > 0 || !!c.hold_reason, text: itemText(c, vocab, now.get(c.dimension)),
    buttons: [[{ text: '✅ Confirm', data: callbackData(c.id, 'y') }, { text: '✏️ Edit', data: callbackData(c.id, 'e') },
      { text: '❌ Reject', data: callbackData(c.id, 'n') }]]
  }));
  const batch_id = 'pfb_' + sha('prefs-batch', vocab.name, ...chosen.map((c) => c.id + ':' + c.evidence.length)).slice(0, 16);
  const payload = { v: 1, kind: 'prefs_review', vocab: vocab.name, batch_id, items, held_back, more: Math.max(0, eligible.length - chosen.length) };
  while (JSON.stringify(payload).length > PAYLOAD_MAX_CHARS && payload.held_back.length) payload.held_back.pop();
  return payload;
}

// Developed by: LightAISolutions
