/**
 * Tour Guide brochure-map — Later lists → the brochure's "Saved for later" lists. Each item keeps its place key and
 * its one-line reason; an item that came off a scheduled day notes that date. Empty lists are dropped (the
 * brochure requires at least one item per list); lists and items are capped at the brochure's limits.
 */
import { clip, compact, SHORT, TEXT } from './brochure-map-text.mjs';

export const LATER_LIMITS = Object.freeze({ lists: 20, items: 40 });
/** Fallback reasons by code, used when an item carries no reason text. */
export const CODE_REASON = Object.freeze({
  closed_day: 'Closed on the day it would fit', outside_hours: 'Opening hours do not fit the day', outside_day: 'Only open outside the planned day',
  day_full: 'The days were full', too_far: 'Too far from the planned route', closed_business: 'Marked closed on Google Maps',
  hours_unknown: 'Opening hours unknown', owner: 'Saved for next time', other: 'Not scheduled'
});

/** mapLater(lists, { cards }) → brochure later[]; items whose place has no card become name-only items. */
export function mapLater(lists, { cards }) {
  const out = [];
  for (const l of lists || []) {
    const items = (l.items || []).slice(0, LATER_LIMITS.items).map((it) => {
      const base = cards[it.place] ? { place: it.place } : { name: clip(it.place, SHORT) || 'Unnamed place' };
      return compact({ ...base, reason: clip(it.reason, SHORT) || CODE_REASON[it.code] || CODE_REASON.other, note: it.from_date ? clip(`Taken off the plan for ${it.from_date}.`, TEXT) : undefined });
    });
    if (!items.length) continue;
    out.push(compact({ name: clip(l.name, SHORT) || 'Saved for later', description: clip(l.description, TEXT), items }));
    if (out.length === LATER_LIMITS.lists) break;
  }
  return out;
}

// Developed by: LightAISolutions
