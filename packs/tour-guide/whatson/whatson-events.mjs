/**
 * Tour Guide — What's on (C15, WP-15b): the board's items, and the bridge from a chosen item to the season sheet.
 *   foldName(name)                         → the name for comparing: accents off, lower case, words only
 *   eventId(name, from)                    → '<slug of the name>-<mmdd>', the same from run to run
 *   normalizeWhatson(items, { from, to })  → { items, more, left_out }: clean, one of each, in the window, in order, ≤ 20
 *   newItems(previous, next)               → next's items whose id was not on previous
 *   toSeasonEvent(item, { chosen_on })     → a season_event (trip schema + checkSeason)
 *   mergeChosen(season, choices, { tripStart, tripEnd, checked }) → { season, added, marked, unmarked, dropped }
 * Pure: no clock, no network.
 */
import { KINDS, LABELS, CONFIDENCE, LEFT_REASONS, LIMITS, SLUG_RE, isRealDate, firstDayIn, compareItems } from './whatson-check.mjs';
import { normalizeSeason } from '../season/season-normalize.mjs';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const URL_RE = /^https:\/\/\S+$/;
const PLACE_ID_RE = /^[A-Za-z0-9_-]{6,300}$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clip = (s, max) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t; };
const SEASON_EVENTS_MAX = 40;

/** foldName(name) → lower case, accents off, every run of other characters one space (Unicode letters and digits kept). */
export function foldName(name) {
  return String(name ?? '').normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
/** FNV-1a over the UTF-16 units → 8 hex digits. */
function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
/**
 * eventId(name, from) → the slug of the name (Latin letters and digits; a name with none is 'e' + a hash of its folded
 * form) plus '-' and the start date's mmdd, at most 64 characters: the same event keeps its id from run to run.
 */
export function eventId(name, from) {
  const mmdd = isRealDate(from) ? from.slice(5, 7) + from.slice(8, 10) : '0000';
  let slug = foldName(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) slug = 'e' + fnv(foldName(name) || String(name ?? ''));
  return slug.slice(0, 64 - 5).replace(/-+$/, '') + '-' + mmdd;
}

const overlaps = (a, b) => a.from <= b.to && b.from <= a.to;
const fieldCount = (it) => Object.keys(it).length + (it.venue ? Object.keys(it.venue).length : 0);
/** One raw item → a clean item, or { why: 'other' } when it lacks what an item must have. */
function cleanItem(raw) {
  const name = clip(raw.name, LIMITS.NAME);
  if (!name) return null;
  const kind = String(raw.kind ?? '').trim().toLowerCase(), confidence = String(raw.confidence ?? '').trim().toLowerCase();
  const url = String(raw.url ?? '').trim(), why = clip(raw.why, LIMITS.WHY);
  if (!KINDS.includes(kind) || !CONFIDENCE.includes(confidence) || !isRealDate(raw.from) || !isRealDate(raw.to) || raw.from > raw.to ||
    !URL_RE.test(url) || url.length > LIMITS.URL || !why) return { name, bad: true };
  const it = { id: eventId(name, raw.from), name, kind, from: raw.from, to: raw.to };
  if (Array.isArray(raw.days) && raw.days.length) {
    const days = [...new Set(raw.days.filter((d) => isRealDate(d) && d >= raw.from && d <= raw.to))].sort().slice(0, LIMITS.DAYS);
    if (!days.length) return { name, bad: true };
    it.days = days;
  }
  if (TIME_RE.test(raw.start || '')) it.start = raw.start;
  if (TIME_RE.test(raw.end || '')) it.end = raw.end;
  if (isObj(raw.venue) && clip(raw.venue.name, LIMITS.NAME)) {
    const v = { name: clip(raw.venue.name, LIMITS.NAME) };
    if (clip(raw.venue.area, LIMITS.AREA)) v.area = clip(raw.venue.area, LIMITS.AREA);
    if (PLACE_ID_RE.test(String(raw.venue.place_id ?? ''))) v.place_id = raw.venue.place_id;
    it.venue = v;
  }
  it.why = why;
  for (const [k, max] of [['food', LIMITS.FOOD], ['price', LIMITS.PRICE], ['booking', LIMITS.BOOKING]]) if (clip(raw[k], max)) it[k] = clip(raw[k], max);
  it.url = url;
  it.confidence = confidence;
  const labels = Array.isArray(raw.labels) ? LABELS.filter((l) => raw.labels.includes(l)).slice(0, LIMITS.LABELS) : [];
  if (labels.length) it.labels = labels;
  return it;
}

/**
 * normalizeWhatson(items, { from, to }) → { items, more, left_out }. Each item is cleaned (strings trimmed and cut, ids
 * from eventId, unknown labels and broken times dropped); one without a kind, run, url, why or confidence is left out as
 * `other`. Duplicates — the same name ignoring case and accents, with overlapping runs — keep the confirmed one, else the
 * one with more fields (the first on a tie); the rest are `duplicate`. An item with no day in the window is
 * `outside_dates`. The board is sorted (first day in the window, start, name), cut to 20, and `more` counts the rest.
 */
export function normalizeWhatson(items, { from, to } = {}) {
  if (!isRealDate(from) || !isRealDate(to) || from > to) throw new Error('whatson: normalizeWhatson needs the window { from, to }');
  const left = [], kept = [];
  for (const raw of Array.isArray(items) ? items : []) {
    if (!isObj(raw)) continue;
    const it = cleanItem(raw);
    if (!it) continue;
    if (it.bad) { left.push({ name: it.name, reason: 'other' }); continue; }
    const i = kept.findIndex((k) => foldName(k.name) === foldName(it.name) && overlaps(k, it));
    if (i < 0) { kept.push(it); continue; }
    const k = kept[i];
    const better = (it.confidence === 'confirmed') !== (k.confidence === 'confirmed') ? it.confidence === 'confirmed' : fieldCount(it) > fieldCount(k);
    if (better) { kept[i] = it; left.push({ name: k.name, reason: 'duplicate' }); } else left.push({ name: it.name, reason: 'duplicate' });
  }
  const inWindow = [];
  for (const it of kept) {
    if (firstDayIn(it, from, to)) inWindow.push(it);
    else left.push({ name: it.name, reason: 'outside_dates' });
  }
  const ids = new Set();
  for (const it of inWindow) {
    let id = it.id;
    for (let n = 2; ids.has(id); n++) id = it.id.slice(0, 64 - String(n).length - 1).replace(/-+$/, '') + '-' + n;
    it.id = id;
    ids.add(id);
  }
  inWindow.sort((a, b) => compareItems(a, b, from, to));
  const out = { items: inWindow.slice(0, LIMITS.ITEMS), more: Math.min(LIMITS.MORE, Math.max(0, inWindow.length - LIMITS.ITEMS)),
    left_out: left.slice(0, LIMITS.LEFT_OUT).filter((l) => LEFT_REASONS.includes(l.reason)) };
  return out;
}

/** newItems(previous, next) → the items of `next` (a payload or an item list) whose id is not on `previous` (same; null = none). */
export function newItems(previous, next) {
  const list = (x) => (Array.isArray(x) ? x : x && Array.isArray(x.items) ? x.items : []);
  const seen = new Set(list(previous).map((it) => it && it.id));
  return list(next).filter((it) => it && !seen.has(it.id));
}

/**
 * toSeasonEvent(item, { chosen_on }) → a season_event: id 'wo-' + the item id (cut to 64), the name, kind, run, times and
 * url, `place_id` and `area` from the venue (the planner locates an event by its place_id, never by an area alone), the
 * note from `why` (cut to 160) and `chosen_on`. An item that runs only on some `days` becomes that one day: `chosen_on`
 * when given, else its first day. Throws when `chosen_on` is not one of the item's days.
 */
export function toSeasonEvent(item, { chosen_on } = {}) {
  if (!isObj(item) || !SLUG_RE.test(String(item.id ?? '')) || !KINDS.includes(item.kind) || !isRealDate(item.from) || !isRealDate(item.to)) {
    throw new Error('whatson: toSeasonEvent needs a board item (id, name, kind, from, to)');
  }
  const days = Array.isArray(item.days) && item.days.length ? item.days : null;
  if (chosen_on !== undefined && (!isRealDate(chosen_on) || chosen_on < item.from || chosen_on > item.to || (days && !days.includes(chosen_on)))) {
    throw new Error(`whatson: ${item.id} does not run on ${chosen_on}`);
  }
  const one = days ? (chosen_on || days[0]) : null;
  const ev = { id: ('wo-' + item.id).slice(0, 64).replace(/-+$/, ''), name: clip(item.name, LIMITS.NAME), kind: item.kind, from: one || item.from, to: one || item.to };
  if (TIME_RE.test(item.start || '')) ev.start = item.start;
  if (TIME_RE.test(item.end || '')) ev.end = item.end;
  const v = isObj(item.venue) ? item.venue : {};
  if (PLACE_ID_RE.test(String(v.place_id ?? ''))) ev.place_id = v.place_id;
  if (clip(v.area, LIMITS.AREA)) ev.area = clip(v.area, LIMITS.AREA);
  if (clip(item.why, 160)) ev.note = clip(item.why, 160);
  if (URL_RE.test(String(item.url ?? ''))) ev.url = item.url;
  if (chosen_on !== undefined) ev.chosen_on = chosen_on;
  return ev;
}

/** A choice as the snapshot (`whatson_chosen`) or the store holds it → { item, chosen_on }. */
function choiceOf(c) {
  if (!isObj(c) || !isRealDate(c.chosen_on)) return null;
  if (isObj(c.item)) return { item: c.item, chosen_on: c.chosen_on };
  if (typeof c.item !== 'string') return null;
  const item = { id: c.item, name: c.name, kind: c.kind, from: c.from, to: c.to, url: c.url };
  for (const k of ['days', 'start', 'end', 'venue']) if (c[k] !== undefined) item[k] = c[k];
  return { item, chosen_on: c.chosen_on };
}
const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * mergeChosen(season, choices, { tripStart, tripEnd, checked }) → { season, added, marked, unmarked, dropped }.
 * `choices` is the trip's whole current set — the `whatson_chosen` entries ({ item: slug, name, kind, … chosen_on }) or
 * { item: <board item>, chosen_on }; holidays and closures are never added.
 *  · A choice whose event is already in the sheet — the same id, or the same name ignoring case and accents with a run
 *    that overlaps and holds `chosen_on` — marks that event with `chosen_on` and adds nothing (`marked`).
 *  · Other choices are added (`added`; an id taken by another event gets -2, -3…).
 *  · An event still marked but no longer chosen loses `chosen_on` (`unmarked`), or, if a choice added it ('wo-' id),
 *    leaves the sheet (`dropped`).
 *  · Over 40 events, unchosen ones go (`dropped`): first those wholly outside tripStart..tripEnd, then the latest
 *    starting. A chosen event is never dropped.
 * With no sheet, one is started: `checked` (else the newest chosen_on, else tripStart) and the chosen items' pages as
 * its sources. Returns `season: null` when there is no sheet and nothing to add. The result passes normalizeSeason
 * (throws, listing the errors, when it cannot).
 */
export function mergeChosen(season, choices, { tripStart = null, tripEnd = null, checked = null } = {}) {
  const want = (Array.isArray(choices) ? choices : []).map(choiceOf).filter((c) => c && KINDS.includes(c.item.kind) && c.item.kind !== 'holiday' && c.item.kind !== 'closure');
  const events = season && Array.isArray(season.events) ? clone(season.events) : [];
  const added = [], marked = [], unmarked = [], dropped = [], hit = new Set();
  for (const c of want) {
    const ev = toSeasonEvent(c.item, { chosen_on: c.chosen_on });
    let i = events.findIndex((e, k) => !hit.has(k) && e.id === ev.id);
    if (i < 0) i = events.findIndex((e, k) => !hit.has(k) && foldName(e.name) === foldName(ev.name) && overlaps(e, ev) && ev.chosen_on >= e.from && ev.chosen_on <= e.to);
    if (i >= 0) {
      events[i] = events[i].id === ev.id && ev.id.indexOf('wo-') === 0 ? ev : { ...events[i], chosen_on: ev.chosen_on };
      hit.add(i);
      marked.push(events[i].id);
      continue;
    }
    const ids = new Set(events.map((e) => e.id));
    for (let n = 2; ids.has(ev.id); n++) ev.id = ('wo-' + c.item.id).slice(0, 64 - String(n).length - 1).replace(/-+$/, '') + '-' + n;
    events.push(ev);
    hit.add(events.length - 1);
    added.push(ev.id);
  }
  let kept = events.filter((e, k) => {
    if (hit.has(k) || e.chosen_on === undefined) return true;
    if (String(e.id).indexOf('wo-') === 0) { dropped.push(e.id); return false; }
    delete e.chosen_on;
    unmarked.push(e.id);
    return true;
  });
  while (kept.length > SEASON_EVENTS_MAX) {
    const free = kept.filter((e) => e.chosen_on === undefined);
    if (!free.length) break;
    const outside = tripStart && tripEnd ? free.filter((e) => e.to < tripStart || e.from > tripEnd) : [];
    const pool = outside.length ? outside : free;
    const victim = pool.reduce((a, b) => (b.from > a.from || (b.from === a.from && b.id > a.id) ? b : a));
    kept = kept.filter((e) => e !== victim);
    dropped.push(victim.id);
  }
  if (!season && !added.length) return { season: null, added, marked, unmarked, dropped };
  let base;
  if (season) base = { ...clone(season), events: kept };
  else {
    const on = checked || want.map((c) => c.chosen_on).sort().pop() || tripStart;
    const urls = [...new Map(want.filter((c) => URL_RE.test(String(c.item.url ?? ''))).map((c) => [c.item.url, c])).values()].slice(0, 10);
    base = { checked: on, sources: urls.map((c) => ({ url: c.item.url, title: clip(c.item.name, 120) || 'What\'s on', accessed: on })), events: kept };
  }
  if (season && !Array.isArray(season.events) && !kept.length) delete base.events;
  const r = normalizeSeason(base);
  if (!r.ok) throw Object.assign(new Error('whatson: the merged season sheet is invalid: ' + r.errors.map((e) => e.path + ' ' + e.message).join('; ')), { errors: r.errors });
  return { season: r.season, added, marked, unmarked, dropped };
}

// Developed by: LightAISolutions
