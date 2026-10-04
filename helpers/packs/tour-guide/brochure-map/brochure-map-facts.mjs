/**
 * Tour Guide brochure-map — the one adapter between Contract C11's researched inputs (a place's `facts`, the trip's
 * `season`) and the brochure's display lines. Every fact or season line in the brochure goes through this file.
 *
 * Swap points. `factsLines`, `menuLine`, `factsStale`, `eventsOn` and `bloomOn` are WP-11b's functions
 * (helpers/packs/tour-guide/facts/index.mjs and season/index.mjs), bound in IMPL at the Phase 11 merge (WP-11d built
 * against local stand-ins with the same signatures; they were removed at the merge). The rest of the adapter calls
 * them only through IMPL and passes `now` as YYYY-MM-DD; the small formatter below covers the card rows they do not.
 *   cardFacts(facts, { now, diet, locale }) → the kit's place `facts` block, or undefined
 *   stopLines(facts, { now, diet }) → { booking_line? } for a stop's row
 *   seasonModel(season, { start_date, end_date, cards }) → the kit's `season`, or undefined
 *   factsSourceRows(facts) / seasonSourceRows(season) → rows for the trip's attribution ledger
 * Pure: links are https only (anything else is dropped), lines are clipped, nothing is fetched.
 */
import { clip, compact } from './brochure-map-text.mjs';
import { toSource } from './brochure-map-attribution.mjs';
import { clockText } from '../../../kits/brochure/lib/format.mjs';
import { factsLines, menuLine, factsStale } from '../facts/index.mjs';
import { eventsOn, bloomOn } from '../season/index.mjs';

export const LINE = 160;
export const SEASON_SOURCES = 10;
export const FACT_SOURCES = 6;
export const FACTS_SUPPORTS = 'place facts';
export const SEASON_SUPPORTS = 'season';
export const BLOOM_LABEL = Object.freeze({ autumn_leaves: 'Autumn leaves', cherry: 'Cherry blossom', plum: 'Plum blossom', wisteria: 'Wisteria', hydrangea: 'Hydrangeas', iris: 'Irises', lotus: 'Lotus', roses: 'Roses', lavender: 'Lavender', other: 'Blossom' });
export const EVENT_KINDS = Object.freeze(['light_up', 'special_opening', 'festival', 'market', 'exhibition', 'performance', 'holiday', 'closure']);   // C15: + exhibition, performance (the season sheet's new kinds)
export const BLOOM_STATUS = Object.freeze(['before', 'starting', 'peak', 'past']);
export const MINUTES_SOURCES = Object.freeze(['official', 'research', 'estimate']);
export const CROWD_SLOTS = Object.freeze(['opening', 'late']);
const PLURAL_DAY = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;
const SLUG = /^[A-Za-z0-9_-]{1,64}$/;
export const isDate = (s) => typeof s === 'string' && DATE.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
export const isTime = (s) => typeof s === 'string' && TIME.test(s);
/** https URLs only (C11), no spaces or quotes, at most 2,000 characters. */
export function https(u) {
  if (typeof u !== 'string') return undefined;
  const s = u.trim();
  return /^https:\/\/[^\s<>"'`\\]+$/i.test(s) && s.length <= 2000 ? s : undefined;
}
const line = (s, n = LINE) => clip(s, n);
const nowMs = (now) => (now instanceof Date ? now.getTime() : typeof now === 'number' ? now : typeof now === 'string' ? Date.parse(isDate(now) ? now + 'T00:00:00Z' : now) : NaN);
const time = (t, locale) => (isTime(t) ? clockText(t, locale || 'en-US') : '');

// ── the small formatter (pieces shared by the local swap points and the card block) ──
/** 'about 60–90 min', 'about 2–3 h', 'about 45 min'. */
export function visitText(v) {
  if (!v || !Number.isInteger(v.min) || !Number.isInteger(v.max) || v.min < 1 || v.max < v.min) return undefined;
  const h = (n) => `${+(n / 60).toFixed(1)}`.replace(/\.0$/, '');
  if (v.min === v.max) return v.min >= 120 ? `about ${h(v.min)} h` : `about ${v.min} min`;
  if (v.min >= 120) return `about ${h(v.min)}–${h(v.max)} h`;
  if (v.max >= 120) return `about ${v.min} min – ${h(v.max)} h`;
  return `about ${v.min}–${v.max} min`;
}
/** [1] → 'Mondays'; [6, 0] → 'Saturdays and Sundays' (Monday first). */
export function closedText(days) {
  const d = [...new Set((Array.isArray(days) ? days : []).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((x) => PLURAL_DAY[x]);
  return d.length ? (d.length === 1 ? d[0] : `${d.slice(0, -1).join(', ')} and ${d[d.length - 1]}`) : undefined;
}
/** The booking rule as one line: its own text, else 'Book 2 days ahead by phone · 2 people or more' / 'No booking needed'. */
export function bookingText(b) {
  if (!b || typeof b !== 'object') return undefined;
  if (b.text) return line(b.text);
  const party = Number.isInteger(b.party_min) && b.party_min >= 2 ? `${b.party_min} people or more` : '';
  if (b.required === false) return party ? `No booking needed · ${party}` : 'No booking needed';
  const head = b.required === true || b.lead || b.how ? [`Book ${b.lead ? clip(b.lead, 80) : 'ahead'}`, b.how ? clip(b.how, 80) : ''].filter(Boolean).join(' ') : '';
  return line([head, party].filter(Boolean).join(' · ') || undefined);
}
/** '€25 set lunch · includes garden entry'. */
export function priceText(p) {
  if (!p || !p.text) return undefined;
  const inc = p.includes ? String(p.includes).trim() : '';
  return line(inc ? `${String(p.text).trim()} · ${/^(incl|includes|with|plus)\b/i.test(inc) ? inc : `includes ${inc}`}` : p.text);
}
/** The diet as words: 'vegetarian'; ['vegetarian', 'no nuts'] → 'vegetarian and no nuts'. */
export function dietText(diet) {
  const d = (Array.isArray(diet) ? diet : [diet]).map((x) => clip(x, 40)).filter(Boolean);
  return d.length ? (d.length === 1 ? d[0] : `${d.slice(0, -1).join(', ')} and ${d[d.length - 1]}`) : '';
}
/** '1 Mar 2027' (day month year, in English, from a YYYY-MM-DD date). */
/** 'Last entry 4:00 PM (30 min before closing) · closes 4:30 PM'. */
export function lastEntryText(f, locale) {
  const le = time(f.last_entry, locale), close = time(f.close, locale);
  const note = f.last_entry_note ? ` (${clip(f.last_entry_note, 80)})` : '';
  return le ? line(`${le}${note}${close ? ` · closes ${close}` : ''}`) : close ? line(`Closes ${close}`) : undefined;
}

// ── local swap points (C11; replaced by WP-11b's functions when merged) ──
/** The swap points, bound to WP-11b's `facts/` and `season/` (see the file header); a test may rebind them. */
export const IMPL = { factsLines, menuLine, factsStale, eventsOn, bloomOn };
/** `now` as YYYY-MM-DD (UTC), the form every swap point takes; undefined when unknown. */
const nowDay = (now) => { const t = now instanceof Date ? now.getTime() : nowMs(now); return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : undefined; };
/** A factsStale result is { facts, menu } (WP-11b); a rebound test double may return a boolean (facts only). */
function staleOf(facts, now) {
  if (!now) return { facts: false, menu: false };
  const s = IMPL.factsStale(facts, now);
  if (s && typeof s === 'object') return { facts: Boolean(s.facts ?? s.stale), menu: Boolean(s.menu) };
  return { facts: Boolean(s), menu: false };
}
const linesOf = (facts, opts) => { const r = IMPL.factsLines(facts, opts); return r && typeof r === 'object' ? r : {}; };
const sourceRows = (list, max, supports) => (Array.isArray(list) ? list : []).filter((s) => s && https(s.url)).slice(0, max).map((s) => toSource({ ...s, url: https(s.url), title: clip(s.title, 120) }, supports)).filter(Boolean);

// ── the adapter's outputs ──
/**
 * cardFacts(facts, { now, diet, locale }) → the kit's place `facts` (display lines + sources + the dates checked and
 * stale marks), or undefined when the facts carry no valid `checked` date. Booking and the menu date come from
 * factsLines, the menu's fit from menuLine and the stale marks from factsStale (the swap points); visit, last entry,
 * closed days, price (with what it includes; payment has its own row), payment and gate from the formatter above.
 * The kit prints the menu date and its "check again" mark itself, so the menu row keeps only menuLine's text after
 * "Menu checked <date>:"; a menu line in another shape is kept whole and the separate date is left out.
 */
export function cardFacts(facts, { now, diet, locale } = {}) {
  if (!facts || typeof facts !== 'object' || !isDate(facts.checked)) return undefined;
  const day = nowDay(now);
  const l = linesOf(facts, { now: day, diet });
  const st = staleOf(facts, day);
  const ml = String(IMPL.menuLine(facts, { now: day, diet }) || '').trim();
  const fit = ml.replace(/^Menu checked [^:]*:\s*/i, '');
  const split = Boolean(ml) && fit !== ml;
  const menuChecked = isDate(l.menu_checked) ? l.menu_checked : (facts.menu && isDate(facts.menu.checked) ? facts.menu.checked : undefined);
  return compact({
    checked: facts.checked,
    stale: st.facts || undefined,
    visit: visitText(facts.visit_minutes),
    last_entry: lastEntryText(facts, locale),
    closed: closedText(facts.closed_weekdays),
    booking: line(l.booking_line) || bookingText(facts.booking),
    price: priceText(facts.price),
    payment: clip(facts.payment, 80),
    gate: clip(facts.gate_name, 80),
    menu: ml ? line(split ? fit.charAt(0).toUpperCase() + fit.slice(1) : ml) : undefined,
    menu_fits: facts.menu && ['yes', 'partly', 'no', 'unknown'].includes(facts.menu.fits) ? facts.menu.fits : undefined,
    menu_checked: split || !ml ? menuChecked : undefined,
    menu_stale: ((split || !ml) && menuChecked && st.menu) || undefined,
    sources: sourceRows(facts.sources, FACT_SOURCES)
  });
}
/** stopLines(facts, { now, diet }) → { booking_line? } for a stop's row (from factsLines), or {} without facts. */
export function stopLines(facts, { now, diet } = {}) {
  if (!facts || typeof facts !== 'object') return {};
  return compact({ booking_line: line(linesOf(facts, { now: nowDay(now), diet }).booking_line) });
}
/** Every date from start to end inclusive (at most 62). */
export function tripDates(start, end) {
  if (!isDate(start) || !isDate(end) || end < start) return [];
  const out = [];
  for (let t = Date.parse(start + 'T00:00:00Z'), e = Date.parse(end + 'T00:00:00Z'); t <= e && out.length < 62; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
/**
 * seasonModel(season, { start_date, end_date, cards }) → the kit's `season`, or undefined without a valid `checked`
 * date. Events are the ones running on a trip date (eventsOn, the swap point), first date first; the lede is bloomOn's
 * line for the trip's dates (at most two different lines). Links are https only; an event's place is kept only when
 * that place has a card.
 */
export function seasonModel(season, { start_date, end_date, cards = {} } = {}) {
  if (!season || typeof season !== 'object' || !isDate(season.checked)) return undefined;
  const dates = tripDates(start_date, end_date);
  const seen = new Set(), events = [];
  for (const d of dates) for (const e of IMPL.eventsOn(season, d) || []) {
    const key = e && (e.id || `${e.name}|${e.from}`);
    if (!e || seen.has(key) || !e.name || !EVENT_KINDS.includes(e.kind) || !isDate(e.from)) continue;
    seen.add(key);
    const to = isDate(e.to) && e.to >= e.from ? e.to : e.from;
    events.push(compact({
      name: clip(e.name, 120), kind: e.kind, from: e.from, to,
      start: isTime(e.start) ? e.start : undefined, end: isTime(e.end) ? e.end : undefined,
      area: clip(e.area, 80), place: SLUG.test(String(e.place || '')) && cards[e.place] ? e.place : undefined,
      note: clip(e.note, LINE), url: https(e.url)
    }));
    if (events.length >= 40) break;
  }
  const bloom = (Array.isArray(season.bloom) ? season.bloom : []).filter((b) => b && b.kind).slice(0, 6).map((b) => compact({
    label: BLOOM_LABEL[b.kind] || BLOOM_LABEL.other,
    from: isDate(b.from) ? b.from : undefined, to: isDate(b.to) ? b.to : undefined,
    status: BLOOM_STATUS.includes(b.status) ? b.status : undefined,
    note: clip(b.note, LINE), url: https(b.url)
  }));
  const w = season.weather && season.weather.text ? compact({
    text: clip(season.weather.text, 200),
    high_c: Number.isFinite(season.weather.high_c) && Math.abs(season.weather.high_c) <= 60 ? season.weather.high_c : undefined,
    low_c: Number.isFinite(season.weather.low_c) && Math.abs(season.weather.low_c) <= 60 ? season.weather.low_c : undefined,
    rain_days: Number.isInteger(season.weather.rain_days) && season.weather.rain_days >= 0 && season.weather.rain_days <= 31 ? season.weather.rain_days : undefined
  }) : undefined;
  const leads = [...new Set(dates.map((d) => IMPL.bloomOn(season, d)).filter((s) => typeof s === 'string' && s.trim()))].slice(0, 2);
  const lead = leads.length ? clip(leads.map((s) => s.trim().replace(/[.;]?$/, '.')).map((s) => s[0].toUpperCase() + s.slice(1)).join(' '), 240) : undefined;
  return compact({
    checked: season.checked, lead, weather: w, bloom, events,
    sources: sourceRows(season.sources, SEASON_SOURCES).map(({ supports, ...r }) => r)
  });
}
/** Rows for the trip's attribution ledger. */
export const factsSourceRows = (facts) => (facts && isDate(facts.checked) ? sourceRows(facts.sources, FACT_SOURCES, FACTS_SUPPORTS) : []);
export const seasonSourceRows = (season) => (season && isDate(season.checked) ? sourceRows(season.sources, SEASON_SOURCES, SEASON_SUPPORTS) : []);

// Developed by: LightAISolutions
