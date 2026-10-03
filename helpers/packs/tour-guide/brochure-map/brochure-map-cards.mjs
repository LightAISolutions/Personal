/**
 * Tour Guide brochure-map — place cards. A brochure place = our Place (name, category, why it fits) + its PlaceNote
 * (why you, what to do, tickets…) + the build-scoped GoogleSnapshot content (address, weekday hours, rating,
 * website, Maps link, business status, fetched date) + the sources behind the note and the visit estimate.
 * With showGoogle false, every field read from Places is left out and the Maps link is our own URL built from the
 * place id (place ids may be kept indefinitely; the other content may not be cached — decisions TG-PHASE-2 F1).
 */
import { placeUrl } from '../../../kits/maps/lib/maps-urls.mjs';
import { clip, compact, localDate, weekdayName, WEEKDAYS, SHORT, TEXT } from './brochure-map-text.mjs';
import { mergeSources, placeSourceRows, MAX_PLACE_SOURCES } from './brochure-map-attribution.mjs';
import { guardNoteFields } from '../planner/planner-notes.mjs';

const STATUSES = new Set(['OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY']);
const NOTE_TEXT = ['why_you', 'what_to_do', 'what_to_skip', 'best_time', 'tickets', 'accessibility', 'food'];

/** 'neighbourhood' → 'Neighbourhood', 'night-market' → 'Night market'. */
export function categoryLabel(c) {
  const t = clip(String(c || '').replace(/[-_]+/g, ' '), SHORT);
  return t ? t[0].toUpperCase() + t.slice(1) : undefined;
}
/** hoursLine(lines, 'Monday') → '9:00 AM – 5:00 PM' (the text after "Monday:"), or undefined. */
export function hoursLine(lines, dayName) {
  const line = (lines || []).find((h) => typeof h === 'string' && h.toLowerCase().startsWith(dayName.toLowerCase() + ':'));
  return line ? line.slice(dayName.length + 1).trim() : undefined;
}
/**
 * closedDays(hours) → weekday names the place is closed. From Google's weekday lines ("Monday: Closed"); when there
 * are no lines, from the periods (a weekday with no opening period; none when any period has no close = open 24/7).
 * Order: as the lines give them, or Monday first from periods.
 */
export function closedDays(hours) {
  if (!hours) return [];
  const lines = Array.isArray(hours.weekday_descriptions) ? hours.weekday_descriptions : [];
  if (lines.length) {
    return lines.map((l) => String(l)).filter((l) => /^[A-Za-z]+:\s*closed\s*$/i.test(l)).map((l) => l.slice(0, l.indexOf(':')).trim())
      .map((d) => WEEKDAYS.find((w) => w.toLowerCase() === d.toLowerCase()) || d);
  }
  const periods = Array.isArray(hours.periods) ? hours.periods : [];
  if (!periods.length || periods.some((p) => !p || !p.close)) return [];
  const open = new Set(periods.map((p) => p.open && p.open.day).filter((d) => Number.isInteger(d)));
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => !open.has(d)).map((d) => WEEKDAYS[d]);
}
/** hoursToday(lines, dates) → the day's line when every visit date shares it, else undefined (the kit then looks it up per day). */
export function hoursToday(lines, dates) {
  if (!lines || !lines.length || !dates.length) return undefined;
  const vals = [...new Set(dates.map((d) => hoursLine(lines, weekdayName(d))))];
  return vals.length === 1 && vals[0] ? clip(vals[0].replace(/^open\s+/i, ''), SHORT) : undefined; // the kit prints "open <hours>"; Google's line already says "Open 24 hours"
}
function noteFields(note) {
  if (!note) return undefined;
  const out = {};
  for (const k of NOTE_TEXT) { const v = clip(note[k], TEXT); if (v) out[k] = v; }
  const pairings = (note.pairings || []).map((p) => clip(p, SHORT)).filter(Boolean).slice(0, 8);
  if (pairings.length) out.pairings = pairings;
  return Object.keys(out).length ? out : undefined;
}
/** mapsLink(place) → our own Google Maps URL for a place (name + place id). */
export function mapsLink(place) { return placeUrl({ name: place.name, placeId: place.place_id }); }

/**
 * placeCard({ place, snapshot, notesByPlace, estimatesByPlace, visitDates, visits, showGoogle, timeZone }) → brochure place.
 * visits: the place's scheduled stops [{ arrive, depart, window }]; the note's timing advice is guarded against each
 * (Phase 10 fix (a): a sentence any visit contradicts — "arrive at opening" on a noon stop — is left out).
 */
export function placeCard({ place, snapshot, notesByPlace, estimatesByPlace, visitDates = [], visits = [], showGoogle = true, timeZone }) {
  const content = snapshot && snapshot.content ? snapshot.content : null;
  const card = {
    name: clip(place.name, SHORT) || clip(content && content.display_name, SHORT) || place.id,
    category: categoryLabel(place.category),
    tagline: clip(place.why_fit, SHORT),
    place_id: place.place_id ? String(place.place_id).slice(0, 300) : undefined
  };
  // Coordinates only feed the schematic route sketch (never printed); kept in both modes (decision 5).
  if (snapshot && snapshot.location && Number.isFinite(snapshot.location.lat) && Number.isFinite(snapshot.location.lng)) {
    card.lat = snapshot.location.lat; card.lng = snapshot.location.lng;
  }
  card.maps_url = mapsLink(place);
  if (showGoogle && content) {
    const lines = content.hours && Array.isArray(content.hours.weekday_descriptions) ? content.hours.weekday_descriptions.slice(0, 7).map((l) => clip(l, SHORT)).filter(Boolean) : [];
    Object.assign(card, {
      address: clip(content.address, SHORT),
      hours: lines,
      hours_today: hoursToday(lines, visitDates),
      closed_days: closedDays(content.hours),
      rating: Number.isFinite(content.rating) && content.rating >= 0 && content.rating <= 5 ? content.rating : undefined,
      review_count: Number.isInteger(content.review_count) && content.review_count >= 0 ? content.review_count : undefined,
      website: content.website ? String(content.website).slice(0, 2000) : undefined,
      business_status: STATUSES.has(content.business_status) ? content.business_status : undefined,
      fetched_on: snapshot.fetched_at ? localDate(snapshot.fetched_at, timeZone) : undefined
    });
    if (content.maps_uri) card.maps_url = String(content.maps_uri).slice(0, 2000);
  }
  card.note = noteFields(guardNoteFields(notesByPlace.get(place.place_id), visits, NOTE_TEXT));
  card.sources = mergeSources(placeSourceRows(place.place_id, { notesByPlace, estimatesByPlace }), MAX_PLACE_SOURCES);
  return compact(card);
}

// Developed by: LightAISolutions
