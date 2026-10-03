/**
 * Tour Guide planner — a place's researched facts in the schedule (Phase 11, WP-11a; Contract C11 `place.facts`).
 * The facts come from the place's own site, so where they speak they win over Google's hours:
 *   · `closed_weekdays` (0 = Sunday) closes the place on those days; a weekday it omits is open even when Google says
 *     closed (Google's hours for another weekday are used, as for irregular places);
 *   · `close` replaces the closing time of the day's last opening window (earlier windows are cut at it);
 *   · `last_entry` is the latest start (the window's `last`, honoured by earliestFit);
 *   · `visit_minutes` { min, max } sets the visit length (factsMinutes), `minutes_source: 'official'`.
 * When the place's own hours disagree with Google's (ownHoursConflict), the day plan carries an info warning.
 *   placeFacts(place) → normalised facts or null (malformed fields are ignored, never fatal)
 *   factsHours(hours, facts, date, snapshot, name) → { hours, conflict }   hours as hoursOn() returns them
 */
import { weekdayOf, hm } from './planner-time.mjs';
import { knownWindows } from './planner-hours.mjs';
import { factsConflict, CLOSE_TOLERANCE_MINUTES as FACTS_CLOSE_TOLERANCE } from '../facts/index.mjs';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const tmin = (s) => (TIME_RE.test(String(s || '')) ? +s.slice(0, 2) * 60 + +s.slice(3) : null);
export const MENU_FITS = Object.freeze(['yes', 'partly', 'no', 'unknown']);

/** placeFacts(place) → { last_entry, close, closed_weekdays, visit, booking, menu_fits, last_entry_text } or null. */
export function placeFacts(place) {
  const f = place && place.facts;
  if (!f || typeof f !== 'object') return null;
  const vm = f.visit_minutes;
  const visit = vm && Number.isInteger(vm.min) && Number.isInteger(vm.max) && vm.min >= 15 && vm.max <= 720 && vm.min <= vm.max ? { min: vm.min, max: vm.max } : null;
  const cw = Array.isArray(f.closed_weekdays) ? [...new Set(f.closed_weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))] : null;
  const fits = f.menu && MENU_FITS.includes(f.menu.fits) ? f.menu.fits : null;
  const out = {
    last_entry: tmin(f.last_entry), close: tmin(f.close), closed_weekdays: cw, visit,
    booking: f.booking && typeof f.booking === 'object' ? f.booking : null, menu_fits: fits,
    last_entry_text: TIME_RE.test(String(f.last_entry || '')) ? f.last_entry : null
  };
  return out;
}

/** Own and Google closing times this close (minutes) are the same time: WP-11b's facts/facts-check.mjs value. */
export const CLOSE_TOLERANCE_MINUTES = FACTS_CLOSE_TOLERANCE;

/**
 * ownHoursConflict(facts, hours, date, name) → the info line when the place's own facts disagree with Google's hours on
 * `date` (hours as hoursOn() returns them, before the facts apply), or null. The rule itself is WP-11b's
 * facts/index.mjs factsConflict() (one rule for the planner, the app and the brochure; pointed at it at the Phase 11
 * merge): this passes it the day's windows as a by_date map and the facts as clock times, and joins its items:
 *   closed_day — own facts closed that weekday, Google open; google_closed — Google closed, own closed weekdays omit it;
 *   close_time — own close and Google's last close differ by more than CLOSE_TOLERANCE_MINUTES;
 *   last_entry_after_close — own last entry at or after Google's last close.
 * Unknown or irregular Google hours never conflict. A window past midnight counts as closing at 24:00.
 */
export function ownHoursConflict(facts, hours, date, name = 'This place') {
  if (!facts || !hours) return null;
  const st = hours.status;
  if (st !== 'open' && st !== 'always' && st !== 'closed') return null;
  const ws = st === 'always' ? [{ open: 0, close: 1440 }] : st === 'open' ? hours.windows : [];
  const clock = (m) => (m >= 1440 ? '24:00' : hm(m));
  const own = {
    ...(facts.closed_weekdays ? { closed_weekdays: facts.closed_weekdays } : {}),
    ...(facts.close !== null ? { close: hm(facts.close) } : {}),
    ...(facts.last_entry !== null ? { last_entry: hm(facts.last_entry) } : {})
  };
  const google = { by_date: { [date]: ws.map((x) => ({ open: hm(Math.min(x.open, 1439)), close: clock(x.close) })) } };
  const { items } = factsConflict(own, google, date);
  return items.length ? line(name, items.map((x) => x.text.replace(/^Its /, 'its '))) : null;
}

/**
 * factsHours(hours, facts, date, snapshot, name) → { hours, conflict: string | null }. `hours` is not mutated.
 * The schedule always follows the place's own facts; `conflict` is ownHoursConflict()'s line.
 * A place with unknown Google hours keeps status 'unknown' and gets `bounds` (the facts' close and last entry) that the
 * schedule honours; its stop shows no window. A business Google lists as closed stays closed.
 */
export function factsHours(hours, facts, date, snapshot, name = 'This place') {
  if (!facts || !hours) return { hours, conflict: null };
  if (hours.status === 'closed_business') return { hours, conflict: null };
  const conflict = ownHoursConflict(facts, hours, date, name);
  const w = weekdayOf(date);
  let h = { status: hours.status, windows: hours.windows.map((x) => ({ ...x })) }, changed = false;
  if (facts.closed_weekdays) {
    if (facts.closed_weekdays.includes(w)) return { hours: { status: 'closed', windows: [], own: true }, conflict };
    if (h.status === 'closed') {   // its own site lists the weekday as open: Google's known hours for another weekday
      const ws = knownWindows(snapshot);
      h = { status: ws.length ? 'open' : 'unknown', windows: ws };
      changed = true;
    }
  }
  const close = facts.close, last = facts.last_entry;
  if (close === null && last === null) return { hours: changed ? { ...h, own: true } : hours, conflict };
  if (h.status === 'closed') return { hours, conflict };
  if (h.status === 'unknown' || (h.status === 'irregular' && !h.windows.length)) {
    const bounds = [{ open: 0, close: close !== null ? close : 1440, ...(last !== null ? { last } : {}) }];
    return { hours: { ...h, bounds, own: true }, conflict };
  }
  let ws = h.status === 'always' ? [{ open: 0, close: 1440 }] : h.windows;
  if (close !== null) {
    ws = ws.filter((x) => x.open < close).map((x) => ({ ...x }));
    if (ws.length) {
      for (const x of ws.slice(0, -1)) x.close = Math.min(x.close, close);
      ws[ws.length - 1].close = close;   // its own closing time, earlier or later than Google's
    }
  }
  if (last !== null) {
    ws = ws.filter((x) => x.open <= last);
    const at = ws.find((x) => x.open <= last && last <= x.close) || ws[ws.length - 1];
    if (at) at.last = Math.min(last, at.close);
  }
  const status = ws.length ? (h.status === 'always' ? 'open' : h.status) : 'closed';
  return { hours: { status, windows: ws, own: true }, conflict };
}
const line = (name, notes) => `${name}: ${notes.join('; ')}. Planned on its own hours`.slice(0, 200);

/** The minutes a place's own visit length gives, scaled by the caller's factor and kept inside its range (round 5). */
export function factsMinutes(visit, factor = 1) {
  if (!visit) return null;
  const mid = ((visit.min + visit.max) / 2) * (Number.isFinite(factor) && factor > 0 ? factor : 1);
  return Math.min(visit.max, Math.max(visit.min, Math.max(5, Math.round(mid / 5) * 5)));
}

// Developed by: LightAISolutions
