/**
 * Gem Funnel — opening hours against the trip's dates. Three input shapes are read, all build-scoped data the skill
 * holds in-run (nothing here is persisted):
 *   · Google `regularOpeningHours`  { periods: [{ open: {day,hour,minute}, close?: {…} }], weekdayDescriptions? }
 *   · the GoogleSnapshot's `content.hours`  { periods, weekday_descriptions }   (same periods)
 *   · a normalized per-date map  { by_date: { 'YYYY-MM-DD': [{ open: 'HH:MM', close: 'HH:MM' }] } }  ([] = closed)
 * null / undefined hours = unknown (never treated as closed). Day 0 = Sunday … 6 = Saturday, as Google.
 */
import { weekdayOf, toMinutes } from '../schemas/tour-guide-dates.mjs';
import { USABLE_OVERLAP_MINUTES } from './gems-weights.mjs';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** hoursKnown(hours) → true when the shape carries periods or a by_date map. */
export function hoursKnown(hours) {
  if (!hours || typeof hours !== 'object') return false;
  if (Array.isArray(hours.periods)) return true;
  return !!hours.by_date && typeof hours.by_date === 'object';
}

/**
 * openWindows(hours, date) → [{ open: minutes, close: minutes }] on that date (minutes from local midnight, close ≤ 1440,
 * a window that crosses midnight is cut at 24:00), [] when closed, null when hours are unknown.
 */
export function openWindows(hours, date) {
  if (!DATE_RE.test(String(date))) throw new Error(`gems: date must be YYYY-MM-DD (got ${JSON.stringify(date)})`);
  if (!hoursKnown(hours)) return null;
  if (hours.by_date) {
    const list = hours.by_date[date];
    if (list === undefined) return null;
    return list.map((w) => ({ open: toMinutes(w.open) ?? 0, close: toMinutes(w.close) ?? 1440 })).filter((w) => w.close > w.open);
  }
  const day = weekdayOf(date);
  const out = [];
  for (const p of hours.periods) {
    if (!p || !p.open) continue;
    if (!p.close) { if (p.open.day === day || hours.periods.length === 1) out.push({ open: 0, close: 1440 }); continue; } // 24/7 shape
    if (p.open.day !== day) continue;
    const open = p.open.hour * 60 + (p.open.minute || 0);
    let close = p.close.hour * 60 + (p.close.minute || 0);
    if (p.close.day !== day || close <= open) close = 1440;
    if (close > open) out.push({ open, close });
  }
  return out.sort((a, b) => a.open - b.open);
}

/** closedOn(hours, date) → true only when hours are known and show no window that day. */
export function closedOn(hours, date) { const w = openWindows(hours, date); return w !== null && w.length === 0; }

/** closedOnAll(hours, dates) → true when hours are known and the place is closed on every date given. */
export function closedOnAll(hours, dates) { return dates.length > 0 && hoursKnown(hours) && dates.every((d) => closedOn(hours, d)); }

/** closedDates(hours, dates) → the dates the place is closed on ([] when unknown). */
export function closedDates(hours, dates) { return hoursKnown(hours) ? dates.filter((d) => closedOn(hours, d)) : []; }

/**
 * usableOn(hours, date, { day_start = '09:00', day_end = '18:00' }) → true when some window overlaps the day window by
 * ≥ USABLE_OVERLAP_MINUTES; null when hours are unknown.
 */
export function usableOn(hours, date, { day_start = '09:00', day_end = '18:00' } = {}) {
  const w = openWindows(hours, date);
  if (w === null) return null;
  const s = toMinutes(day_start) ?? 540, e = toMinutes(day_end) ?? 1080;
  return w.some((x) => Math.min(x.close, e) - Math.max(x.open, s) >= USABLE_OVERLAP_MINUTES);
}

/** usableDates(hours, dates, dayWindow) → dates with a usable window; null when hours are unknown. */
export function usableDates(hours, dates, dayWindow) {
  if (!hoursKnown(hours)) return null;
  return dates.filter((d) => usableOn(hours, d, dayWindow));
}

// Developed by: LightAISolutions
