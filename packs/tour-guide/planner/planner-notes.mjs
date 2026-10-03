/**
 * Tour Guide — the note guard (Phase 10, WP-10b fix (a)). A stable module path: the brochure uses it, and the private
 * repo's digest builder imports it for the day card's note lines. Place notes are researched before the plan exists, so a
 * note can say "arrive at opening" for a stop the schedule puts at noon. The guard drops each sentence whose timing advice
 * the stop's scheduled time contradicts, and keeps every other sentence as written. Pure: no clock, no I/O.
 *   guardNote(text, sched)             → the text without contradicted sentences ('' when nothing is left)
 *   noteConflict(sentence, sched)      → why a sentence contradicts the schedule ('opening' | 'early' | 'morning' |
 *                                        'afternoon' | 'evening' | 'before' | 'after'), or null
 *   guardNoteFields(note, visits, keys) → a copy of a PlaceNote-like object, each text field guarded against every visit
 *   sched / visit: { arrive: 'HH:MM', depart: 'HH:MM', window?: { open, close } | null }
 * The thresholds are in NOTE_RULES (decisions/WP-10b.md). The GAS day card carries a port (tgCmdDayNoteGuard in
 * gas/10_commands.js); helpers/tests/pack_tour-guide_planner_notes.test.js runs one table through both.
 */
export const NOTE_RULES = Object.freeze({
  OPENING_SLACK: 30,   // "arrive at opening" still holds up to 30 minutes after the window opens
  EARLY_BY: 600,       // early-morning / first-thing advice needs an arrival before 10:00
  MORNING_BY: 720,     // morning advice needs an arrival before 12:00
  AFTERNOON_FROM: 720, // afternoon advice needs the visit to run past 12:00 (late afternoon: past 15:00)
  LATE_AFTERNOON_FROM: 900,
  EVENING_FROM: 960,   // sunset / evening / night advice needs the visit to run to 16:00 or later
  BARE_PM_BELOW: 8     // a bare "before 5" means 17:00; hours below 8 with no am/pm are read as pm
});

const OPENING = /\b(?:at|for|by|right at|just after|before|around) (?:the )?open(?:ing)?(?: time)?\b|\bwhen (?:it|the doors|the gates|they) opens?\b|\bas soon as (?:it|they) opens?\b|\bfirst thing\b|\bthe moment (?:it|they) opens?\b/i;
const EARLY = /\bearly[- ]morning\b|\b(?:go|arrive|come|get there|visit) early\b|\bbefore the crowds\b|\bat dawn\b|\bsunrise\b/i;
const MORNING = /\b(?:in|during) the morning\b|\bmornings? (?:are|is) (?:best|quietest|calmest)\b|\bbest in the morning\b|\bmorning light\b/i;
const LATE_AFTERNOON = /\blate afternoon\b/i;
const AFTERNOON = /\b(?:in|during) the afternoon\b|\bafternoon light\b|\bafternoons? (?:are|is) (?:best|quietest|calmest)\b/i;
const EVENING = /\bsunset\b|\bdusk\b|\bgolden hour\b|\b(?:in|during) the evening\b|\bat night\b|\bafter dark\b|\bnight view\b|\blit up\b|\billuminat(?:ed|ion)\b/i;
const BEFORE = /\bbefore\s+(noon|midday|\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)(?![\w:])/i;
const AFTER = /\bafter\s+(noon|midday|\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)(?![\w:])/i;
const HOURS_TALK = /\b(?:opens?|closes?|closing|last (?:entry|admission)|open daily|hours)\b[^.]*$/i;

const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

/** clockOf('5') → 1020, '10:30' → 630, '9am' → 540, 'noon' → 720; null when not a clock time. */
export function clockOf(s) {
  const t = String(s || '').trim().toLowerCase();
  if (t === 'noon' || t === 'midday') return 720;
  const m = /^(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/.exec(t);
  if (!m) return null;
  let h = Number(m[1]); const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  const ampm = m[3] ? m[3][0] : null;
  if (ampm === 'p' && h < 12) h += 12;
  else if (ampm === 'a' && h === 12) h = 0;
  else if (!ampm && !m[2] && h < NOTE_RULES.BARE_PM_BELOW) h += 12;
  return h * 60 + min;
}

/** noteConflict(sentence, sched) → the rule the scheduled time breaks, or null (see the file header). */
export function noteConflict(sentence, sched) {
  const s = String(sentence || '');
  const arrive = toMin(sched && sched.arrive), depart = toMin(sched && sched.depart);
  if (arrive === null || depart === null) return null;
  const open = sched.window ? toMin(sched.window.open) : null;
  const R = NOTE_RULES;
  if (OPENING.test(s) && (open !== null ? arrive - open > R.OPENING_SLACK : arrive >= R.EARLY_BY)) return 'opening';
  if (EARLY.test(s) && arrive >= R.EARLY_BY) return 'early';
  if (MORNING.test(s) && arrive >= R.MORNING_BY) return 'morning';
  if (LATE_AFTERNOON.test(s) ? depart < R.LATE_AFTERNOON_FROM : AFTERNOON.test(s) && depart <= R.AFTERNOON_FROM) return 'afternoon';
  if (EVENING.test(s) && depart < R.EVENING_FROM) return 'evening';
  const b = BEFORE.exec(s);
  if (b && !HOURS_TALK.test(s.slice(0, b.index))) { const x = clockOf(b[1]); if (x !== null && arrive >= x) return 'before'; }
  const a = AFTER.exec(s);
  if (a && !HOURS_TALK.test(s.slice(0, a.index))) { const x = clockOf(a[1]); if (x !== null && arrive < x) return 'after'; }
  return null;
}

/** Sentences, keeping their own punctuation and spacing ("Go early. Tickets online." → ['Go early. ', 'Tickets online.']). */
export function sentences(text) {
  return String(text || '').match(/[^.!?;]+(?:[.!?;]+(?=\s|$)|[.!?;]*$)\s*/g) || [];
}

/** guardNote(text, sched) → text without the sentences the schedule contradicts; unchanged when sched has no times. */
export function guardNote(text, sched) {
  if (typeof text !== 'string' || !text) return text;
  const parts = sentences(text);
  const kept = parts.filter((p) => !noteConflict(p, sched));
  return kept.length === parts.length ? text : kept.join('').trim();
}

/** guardNoteFields(note, visits, keys) → a copy with each listed text field guarded against every visit (a sentence any visit contradicts goes). */
export function guardNoteFields(note, visits, keys) {
  if (!note || !Array.isArray(visits) || !visits.length) return note;
  const out = { ...note };
  for (const k of keys || Object.keys(note)) {
    if (typeof out[k] !== 'string') continue;
    let v = out[k];
    for (const sched of visits) v = guardNote(v, sched);
    if (v) out[k] = v; else delete out[k];
  }
  return out;
}

// Developed by: LightAISolutions
