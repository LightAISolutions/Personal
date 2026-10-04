/**
 * Tour Guide planner — crowd timing (Phase 11, WP-11a; Contract C11 suggestion 7). When the travellers' profile excerpt
 * asks to avoid crowds or peak hours (`avoid`, matched by CROWD_RULE_RE), a place flagged `crowd_magnet` is visited
 * within CROWD_SLOT.OPENING_MIN minutes of its opening or in the last CROWD_SLOT.LATE_MIN minutes before its effective
 * close, and its stop carries `crowd_slot` ('opening' | 'late'). A magnet no quiet slot fits is kept where it fits, with
 * a warning: this rule never drops a place (planner-day.mjs).
 *   avoidsCrowds(profile) → boolean
 *   crowdWindows(windows) → the opening and late slots of each window ([] when none can hold a visit)
 *   crowdSlotOf(start, windows) → 'opening' | 'late' | null
 *   noQuietSlotText(name, at) → the warning for a magnet no quiet slot fits (C16: Phase 16's 🕊 buttons read its name back)
 */
export const CROWD_SLOT = Object.freeze({ OPENING_MIN: 60, LATE_MIN: 90 });
/** Profile `avoid` lines that mean "keep us away from the crowds": crowds, crowded places, peak hours or times, rush hour, queues, tour groups, mass tourism, busy times. */
export const CROWD_RULE_RE = /\bcrowd(?:s|ed|ing)?\b|\bpeak(?:[- ](?:hours?|times?|season))?\b|\brush[- ]hours?\b|\bqueu(?:e|es|ing)\b|\btour groups?\b|\bmass tourism\b|\bbusy (?:times?|hours?|places?|sights?|spots?)\b/i;

export function avoidsCrowds(profile) {
  const a = profile && Array.isArray(profile.avoid) ? profile.avoid : [];
  return a.some((x) => CROWD_RULE_RE.test(String(x)));
}

/** Each window → an opening slot (start by open + 60, and by its last entry) and a late slot (start ≥ close − 90). */
export function crowdWindows(windows) {
  const out = [];
  for (const w of windows || []) {
    const last = Number.isFinite(w.last) ? w.last : Infinity;
    out.push({ ...w, last: Math.min(last, w.open + CROWD_SLOT.OPENING_MIN), slot: 'opening' });
    const lateOpen = Math.max(w.open, w.close - CROWD_SLOT.LATE_MIN);
    if (lateOpen <= last) out.push({ ...w, open: lateOpen, ...(Number.isFinite(w.last) ? { last: w.last } : {}), slot: 'late' });
  }
  return out;
}

/** The slot a visit starting at `start` sits in, for the place's real windows; null when it is in neither. */
export function crowdSlotOf(start, windows) {
  for (const w of windows || []) {
    if (start < w.open || start > w.close) continue;
    if (start <= w.open + CROWD_SLOT.OPENING_MIN) return 'opening';
    if (start >= w.close - CROWD_SLOT.LATE_MIN) return 'late';
  }
  return null;
}

/**
 * The warning for a magnet that no quiet slot fits, planned at `at` ("HH:MM"), cut to 200 characters with the name first.
 * C16 (TG-PHASE-16 skeleton): moved here from planner-day.mjs without changing a character, so that the 🕊 buttons'
 * mirror (TG_QUIET.WARN_RE in gas/43_quiet.js) has one text to follow, held by a parity test.
 */
export function noQuietSlotText(name, at) {
  return `${name}: no quieter slot fitted (the first ${CROWD_SLOT.OPENING_MIN} min after opening or the last ${CROWD_SLOT.LATE_MIN} before closing); planned at ${at}`.slice(0, 200);
}

// Developed by: LightAISolutions
