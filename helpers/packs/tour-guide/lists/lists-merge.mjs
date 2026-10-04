/**
 * Tour Guide — Lists: the merge, the resolution rule, the destination, the notes and the place files (TG-PHASE-14 WP-14d).
 * Pure: no network, no clock (the caller passes `today`), no file system. README.md states the rules in words.
 *
 *   mergeLists(lists, places, previous, { today }) → { places, new, unresolved, quarantine, index, counts }
 *   recordResolution(index, url, { slug } | { reason, tried }) → index
 *   lookupFor(item, parsed?) → { by: 'place_id' | 'search' | 'none', text, bias, place_id, cid }
 *   acceptResult(item, parsed, result) → { ok, reason }
 *   destinationFor(place, destinations) → slug | null
 *   listNotesFor(item, list) → { note, quarantine }
 *   listedPlace({ item, list, result, slug, destination, category, trip, on }) → a place file (a `candidate`)
 *   applyListTags(place, { lists, list_notes }) → the place file with its tags (no empty fields)
 */
import { parseMapsUrl } from './lists-url.mjs';
import { scanText } from '../../../kits/research/lib/injection.mjs';

export const NOTE_MAX = 300;
export const RETRY_DAYS = 30;
export const MATCH_RADIUS_M = 300;
export const NAME_RATIO = 0.8;
export const DEST_RADIUS_KM = 20;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Case-, accent- and punctuation-insensitive form of a name ("Moss & Pine" → "moss pine"). */
export function foldName(s) {
  return String(s ?? '').normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const days = (a, b) => (Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000;
const keyOf = (p) => String(p.slug ?? p.id ?? '');
const uniq = (xs) => [...new Set(xs)];
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/* ==================== notes ==================== */

/**
 * The owner's note on an item, trimmed to NOTE_MAX characters. A note the injection scanner flags is not returned as a
 * note: it comes back as `quarantine` ({ list, title, note, reasons }) for the driver to write to quarantine/.
 */
export function listNotesFor(item, list) {
  const raw = String(item?.note ?? '').trim();
  if (!raw) return { note: null, quarantine: null };
  const scan = scanText(raw);
  if (scan.injection_suspect) return { note: null, quarantine: { list: String(list), title: String(item?.title ?? ''), note: raw, reasons: scan.reasons } };
  return { note: clip(raw, NOTE_MAX), quarantine: null };
}

/* ==================== the merge ==================== */

/** The index of the last run → url → [{ list, entry }] for lookups by link. */
function indexByUrl(previous) {
  const out = new Map();
  const lists = previous && typeof previous === 'object' && previous.lists && typeof previous.lists === 'object' ? previous.lists : {};
  for (const [list, entries] of Object.entries(lists)) {
    for (const e of Array.isArray(entries) ? entries : []) {
      if (!e || typeof e.url !== 'string') continue;
      if (!out.has(e.url)) out.set(e.url, []);
      out.get(e.url).push({ list, entry: e });
    }
  }
  return out;
}

/**
 * mergeLists(lists, places, previous, { today }) compares an export with the known places and the last run's index.
 *   lists     the reader's `lists` (or its whole result: `{ lists, partial }`)
 *   places    the known places: [{ slug | id, name, place_id?, cid?, lists?, list_notes? }]
 *   previous  the last run's index ({ v: 1, lists: { <name>: [{ title, url, slug? | reason?, tried? }] } }) or null
 *   today     'YYYY-MM-DD', for the 30-day retry rule (without it every unresolved item is tried again)
 * An item matches a place by place_id, then CID, then the slug the index resolved its link to, then an exact folded name
 * only one known place has. Returns:
 *   places      [{ slug, add, drop, lists, list_notes, matched_by, changed }] for every known place on a list before or
 *               after: the list names to add and to drop and the notes to keep. Nothing is ever deleted, and no status
 *               is touched. A list the read did not see whole (truncated, or absent from a partial read) drops nothing.
 *   new         [{ url, title, address, lists, notes, parsed }] — one per link, to look up (lookupFor / acceptResult)
 *   unresolved  [{ list, title, url, reason, tried }] — held as unresolved with the same link, tried under 30 days ago
 *   quarantine  notes the scanner flagged ({ list, title, note, reasons })
 *   index       the new index: each list's items with the slug they resolved to, the reason they did not, or neither
 *               (waiting for a lookup); record lookups with recordResolution
 *   counts      { <list>: { matched, new, unresolved } }
 */
export function mergeLists(lists, places, previous, opts = {}) {
  const read = Array.isArray(lists) ? { lists, partial: false } : { lists: Array.isArray(lists?.lists) ? lists.lists : [], partial: !!lists?.partial };
  const partial = read.partial || !!opts.partial;
  const today = DATE_RE.test(String(opts.today || '')) ? opts.today : null;
  const known = (Array.isArray(places) ? places : []).filter((p) => p && SLUG_RE.test(keyOf(p)));
  const bySlug = new Map(known.map((p) => [keyOf(p), p]));
  const byPid = new Map(), byCid = new Map(), byName = new Map();
  for (const p of known) {
    if (p.place_id) byPid.set(String(p.place_id), p);
    if (p.cid) byCid.set(String(p.cid), p);
    const f = foldName(p.name);
    if (f) byName.set(f, byName.has(f) ? null : p);                  // null: two places share it, so no name match
  }
  const prev = indexByUrl(previous);
  const seen = new Set(read.lists.map((l) => String(l.name)));
  const whole = new Set(read.lists.filter((l) => !l.truncated).map((l) => String(l.name)));

  const now = new Map();                                             // slug → { lists: Map(list → note|null), by }
  const fresh = new Map(), unresolved = [], quarantine = [], counts = {}, index = { v: 1, lists: {} };
  for (const l of read.lists) {
    const name = String(l.name);
    const c = counts[name] = { matched: 0, new: 0, unresolved: 0 };
    const out = index.lists[name] = [];
    for (const it of Array.isArray(l.items) ? l.items : []) {
      const url = String(it.url ?? ''), title = String(it.title ?? '');
      const parsed = parseMapsUrl(url);
      const notes = listNotesFor(it, name);
      if (notes.quarantine) quarantine.push(notes.quarantine);
      let place = null, by = null;
      if (parsed.place_id && byPid.has(parsed.place_id)) { place = byPid.get(parsed.place_id); by = 'place_id'; }
      else if (parsed.cid && byCid.has(parsed.cid)) { place = byCid.get(parsed.cid); by = 'cid'; }
      else {
        const hit = (prev.get(url) || []).map((x) => x.entry.slug).find((s) => typeof s === 'string' && bySlug.has(s));
        if (hit) { place = bySlug.get(hit); by = 'index'; }
        else if (byName.get(foldName(title))) { place = byName.get(foldName(title)); by = 'name'; }
      }
      if (place) {
        const slug = keyOf(place);
        if (!now.has(slug)) now.set(slug, { lists: new Map(), by });
        const rec = now.get(slug);
        if (!rec.lists.has(name) || (notes.note && !rec.lists.get(name))) rec.lists.set(name, notes.note);
        c.matched++;
        out.push({ title, url, slug });
        continue;
      }
      const held = (prev.get(url) || []).map((x) => x.entry).find((e) => typeof e.reason === 'string' && DATE_RE.test(String(e.tried || '')));
      if (held && today && days(held.tried, today) < RETRY_DAYS) {
        unresolved.push({ list: name, title, url, reason: held.reason, tried: held.tried });
        c.unresolved++;
        out.push({ title, url, reason: held.reason, tried: held.tried });
        continue;
      }
      if (!fresh.has(url)) fresh.set(url, { url, title, address: String(it.address ?? ''), lists: [], notes: [], parsed });
      const f = fresh.get(url);
      if (!f.lists.includes(name)) { f.lists.push(name); if (notes.note) f.notes.push({ list: name, note: notes.note }); }
      c.new++;
      out.push({ title, url });
    }
  }

  const res = [];
  for (const p of known) {
    const slug = keyOf(p);
    const before = uniq((Array.isArray(p.lists) ? p.lists : []).map(String));
    const oldNotes = new Map((Array.isArray(p.list_notes) ? p.list_notes : []).filter((n) => n && n.list).map((n) => [String(n.list), String(n.note)]));
    const rec = now.get(slug);
    if (!before.length && !rec) continue;
    const keep = before.filter((l) => !(rec && rec.lists.has(l)) && (!whole.has(l) && (seen.has(l) || partial)));
    const after = uniq([...(rec ? [...rec.lists.keys()] : []), ...keep]).sort(byText);
    const notes = after.map((l) => {
      if (rec && rec.lists.has(l)) return rec.lists.get(l) ? { list: l, note: rec.lists.get(l) } : null;
      return oldNotes.has(l) ? { list: l, note: oldNotes.get(l) } : null;      // a list not seen whole keeps its note
    }).filter(Boolean);
    const add = after.filter((l) => !before.includes(l));
    const drop = before.filter((l) => !after.includes(l)).sort(byText);
    const oldSorted = [...oldNotes].filter(([l]) => before.includes(l)).map(([list, note]) => ({ list, note })).sort((a, b) => byText(a.list, b.list));
    const changed = add.length > 0 || drop.length > 0 || JSON.stringify(notes) !== JSON.stringify(oldSorted);
    res.push({ slug, add, drop, lists: after, list_notes: notes, matched_by: rec ? rec.by : null, changed });
  }
  return { places: res, new: [...fresh.values()], unresolved, quarantine, index, counts };
}

/** recordResolution(index, url, outcome) → a new index with every entry for that link resolved ({ slug }) or not ({ reason, tried }). */
export function recordResolution(index, url, outcome = {}) {
  const out = { v: 1, lists: {} };
  for (const [list, entries] of Object.entries(index?.lists || {})) {
    out.lists[list] = (Array.isArray(entries) ? entries : []).map((e) => {
      if (!e || e.url !== url) return e;
      const base = { title: e.title, url: e.url };
      if (outcome.slug && SLUG_RE.test(outcome.slug)) return { ...base, slug: outcome.slug };
      if (outcome.reason) return { ...base, reason: String(outcome.reason), tried: String(outcome.tried || '') };
      return base;
    });
  }
  return out;
}

/* ==================== the lookup and the resolution rule ==================== */

/**
 * What to look up for a new item: a place id is fetched directly; otherwise a text search of the title plus the address
 * (else the link's name or query), biased to the link's coordinates when it has them. A short link, or a link with
 * nothing to search for, is `none`: name it to the owner as unresolved.
 */
export function lookupFor(item, parsed = parseMapsUrl(item?.url)) {
  const title = String(item?.title ?? '').trim(), address = String(item?.address ?? '').trim();
  const bias = parsed.lat !== null && parsed.lng !== null ? { lat: parsed.lat, lng: parsed.lng } : null;
  const text = [title || parsed.name || parsed.query || '', address].filter(Boolean).join(', ');
  if (parsed.kind === 'short' || parsed.kind === 'none' && !text) return { by: 'none', text, bias, place_id: null, cid: null };
  if (parsed.place_id) return { by: 'place_id', text, bias, place_id: parsed.place_id, cid: parsed.cid };
  if (!text) return { by: 'none', text, bias, place_id: null, cid: parsed.cid };
  return { by: 'search', text, bias, place_id: null, cid: parsed.cid };
}

/** A lookup result's own fields, from the Places API (v1) shape or a flat one. */
function resultFields(r) {
  const name = r.displayName && typeof r.displayName === 'object' ? r.displayName.text : r.name;
  const lat = r.location && typeof r.location === 'object' ? r.location.latitude : r.lat;
  const lng = r.location && typeof r.location === 'object' ? r.location.longitude : r.lng;
  const uri = r.googleMapsUri ?? r.google_maps_uri ?? r.maps_url ?? '';
  return { name: String(name ?? ''), lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null,
    place_id: String(r.id ?? r.place_id ?? ''), cid: parseMapsUrl(String(uri)).cid };
}
export function metres(a, b) {
  const R = 6371008.8, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** Folded names equal, or one inside the other with the shorter at least NAME_RATIO of the longer. */
export function namesMatch(a, b) {
  const x = foldName(a), y = foldName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  return l.includes(s) && s.length >= NAME_RATIO * l.length;
}

/**
 * acceptResult(item, parsed, result) → { ok, reason } — the rule the private driver applies to each lookup. Never a guess:
 *   a CID in the link      accepted only when the result's Google Maps link has the same CID
 *   a place id in the link accepted when the result is that place (the driver fetched it directly)
 *   otherwise              the top result, when its name matches the title and, when the link has coordinates, it lies
 *                          within MATCH_RADIUS_M of them
 */
export function acceptResult(item, parsed = parseMapsUrl(item?.url), result) {
  if (parsed.kind === 'short') return { ok: false, reason: 'a short link' };
  if (!result || typeof result !== 'object') return { ok: false, reason: 'nothing found' };
  const r = resultFields(result);
  if (parsed.cid) return r.cid === parsed.cid ? { ok: true, reason: null } : { ok: false, reason: 'a different place (the saved link names another)' };
  if (parsed.place_id) return r.place_id === parsed.place_id ? { ok: true, reason: null } : { ok: false, reason: 'a different place (the saved link names another)' };
  const title = String(item?.title ?? '').trim() || parsed.name || parsed.query || '';
  if (!namesMatch(title, r.name)) return { ok: false, reason: 'no exact match' };
  if (parsed.lat !== null && parsed.lng !== null) {
    if (r.lat === null || r.lng === null) return { ok: false, reason: 'no location to compare with the saved pin' };
    if (metres({ lat: parsed.lat, lng: parsed.lng }, { lat: r.lat, lng: r.lng }) > MATCH_RADIUS_M) return { ok: false, reason: 'too far from the saved pin' };
  }
  return { ok: true, reason: null };
}

/* ==================== the destination ==================== */

export function slugify(s) {
  return foldName(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '');
}
/**
 * destinationFor(place, destinations) → a slug: the nearest known destination ([{ slug, lat, lng, radius_km }], radius
 * default 20 km) that contains the place, else the place's locality, else its first-level administrative area
 * (`admin1`), slugified; null when there is nothing to go on.
 */
export function destinationFor(place, destinations) {
  const p = place || {};
  if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
    let best = null;
    for (const d of Array.isArray(destinations) ? destinations : []) {
      if (!d || !SLUG_RE.test(String(d.slug)) || !Number.isFinite(d.lat) || !Number.isFinite(d.lng)) continue;
      const m = metres(p, d), r = (Number.isFinite(d.radius_km) && d.radius_km > 0 ? d.radius_km : DEST_RADIUS_KM) * 1000;
      if (m <= r && (!best || m < best.m)) best = { slug: d.slug, m };
    }
    if (best) return best.slug;
  }
  for (const s of [p.locality, p.admin1 ?? p.administrative_area_level_1]) {
    const slug = slugify(s);
    if (slug && SLUG_RE.test(slug)) return slug;
  }
  return null;
}

/* ==================== the place files ==================== */

/** applyListTags(place, { lists, list_notes }) → a copy with `lists` and `list_notes` set, or removed when empty. */
export function applyListTags(place, tags = {}) {
  const out = { ...place };
  const lists = uniq((Array.isArray(tags.lists) ? tags.lists : []).map((l) => clip(String(l).trim(), 80)).filter(Boolean)).slice(0, 20);
  const notes = (Array.isArray(tags.list_notes) ? tags.list_notes : []).filter((n) => n && lists.includes(n.list) && String(n.note || '').trim())
    .map((n) => ({ list: n.list, note: clip(String(n.note).trim(), NOTE_MAX) })).slice(0, 20);
  if (lists.length) out.lists = lists; else delete out.lists;
  if (notes.length) out.list_notes = notes; else delete out.list_notes;
  return out;
}

/**
 * listedPlace({ item, list, result, slug, destination, category, trip, on, notes? }) → the place file for a list item
 * that resolved to a place Tour Guide did not know: a `candidate` with priority 3, the activity "Saved in your <list>
 * list", and a history entry { trip: trip || 'lists', on, event: 'listed', note: <list> }. `category` comes from the Maps
 * kit's mapping (the driver's), the CID from the link or the result.
 */
export function listedPlace({ item, list, result, slug, destination, category, trip, on, notes }) {
  const r = resultFields(result || {});
  const parsed = parseMapsUrl(item?.url);
  const name = clip(String(r.name || item?.title || '').trim(), 120);
  const listName = clip(String(list).trim(), 80);
  const note = notes === undefined ? listNotesFor(item, listName).note : notes;
  const place = { v: 1, id: slug, place_id: r.place_id, name, category: category || 'other', tags: [], status: 'candidate',
    activity: clip(`Saved in your ${listName} list`, 120), priority: 3 };
  if (destination) place.destination = destination;
  place.history = [{ trip: trip && SLUG_RE.test(trip) ? trip : 'lists', on, event: 'listed', note: clip(listName, 120) }];
  const tagged = applyListTags(place, { lists: [listName], list_notes: note ? [{ list: listName, note }] : [] });
  const cid = parsed.cid || r.cid;
  if (cid) tagged.cid = cid;
  return tagged;
}

// Developed by: LightAISolutions
