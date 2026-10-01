/**
 * Tour Guide planner — opening windows for one place on one date, from a GoogleSnapshot's `content.hours.periods`
 * (Google days: 0 = Sunday). Windows are minutes from that date's midnight; an overnight period closes past 1440.
 *   hoursOn(snapshot, date) → { status: 'open' | 'always' | 'closed' | 'unknown' | 'closed_business', windows: [{ open, close }] }
 */
import { weekdayOf } from './planner-time.mjs';

export const DAY_MIN = 1440;
export const ALL_DAY = Object.freeze([{ open: 0, close: DAY_MIN }]);

export function hoursOn(snapshot, date) {
  const c = snapshot && snapshot.content;
  if (!c) return { status: 'unknown', windows: [] };
  if (c.business_status && c.business_status !== 'OPERATIONAL') return { status: 'closed_business', windows: [] };
  const h = c.hours;
  const periods = h && Array.isArray(h.periods) ? h.periods : [];
  const lines = h && Array.isArray(h.weekday_descriptions) ? h.weekday_descriptions : [];
  const w = weekdayOf(date);
  if (!periods.length) {
    if (!lines.length) return { status: 'unknown', windows: [] };
    const line = lines[(w + 6) % 7] || ''; // Google lists Monday first
    return /closed/i.test(line) ? { status: 'closed', windows: [] } : { status: 'unknown', windows: [] };
  }
  const windows = [];
  for (const p of periods) {
    if (!p || !p.open) continue;
    if (!p.close) return { status: 'always', windows: ALL_DAY.slice() }; // "open 24 hours": one period, no close
    const o = (p.open.hour || 0) * 60 + (p.open.minute || 0);
    let cl = (p.close.hour || 0) * 60 + (p.close.minute || 0);
    if (p.open.day === w) {
      if (p.close.day !== w || cl <= o) cl += DAY_MIN;
      windows.push({ open: o, close: cl });
    } else if (p.close.day === w && p.open.day === (w + 6) % 7 && cl > 0) {
      windows.push({ open: 0, close: cl }); // the tail of the previous night (a late bar)
    }
  }
  windows.sort((a, b) => a.open - b.open);
  return { status: windows.length ? 'open' : 'closed', windows };
}

/**
 * Earliest start ≥ `t` of a visit of `minutes` that lies inside one window and ends by `latest`.
 * Returns { start, window } or null. `windows` empty = no constraint (hours unknown → treated as all day).
 */
export function earliestFit(windows, t, minutes, latest) {
  const ws = windows && windows.length ? windows : ALL_DAY;
  for (const w of ws) {
    const start = Math.max(t, w.open);
    if (start + minutes <= w.close && start + minutes <= latest) return { start, window: w };
  }
  return null;
}

/** Why a place cannot be visited on this date inside [dayStart, dayEnd]: a LaterList code, or null when it fits. */
export function unfitCode(hours, minutes, dayStart, dayEnd) {
  if (hours.status === 'closed_business') return 'closed_business';
  if (hours.status === 'closed') return 'closed_day';
  if (hours.status === 'unknown' || hours.status === 'always') return minutes <= dayEnd - dayStart ? null : 'day_full';
  if (earliestFit(hours.windows, dayStart, minutes, dayEnd)) return null;
  const overlaps = hours.windows.some((w) => w.open < dayEnd && w.close > dayStart);
  return overlaps ? 'outside_hours' : 'outside_day';
}

// Developed by: LightAISolutions
