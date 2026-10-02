/**
 * Tour Guide pack — sheet tabs and the storage API (WP-5b; contract helpers/decisions/TG-PHASE-5.md §1.3).
 * Every other pack file reads and writes the pack tabs ONLY through these functions, never storeAppend on a pack tab.
 *   Trips      tgTripGet · tgTripList · tgTripUpsert · tgTripCurrent · tgTripSetStatus
 *   DayPlans   tgDigestStore · tgDigestDays · tgDigestDay        (one row per day; a cell over 50 000 chars continues
 *                                                                  in `part` 1, 2, … rows of the same day)
 *   Later      tgLaterList · tgLaterAdd
 *   Places     tgPlacesUpsert · tgPlacesSearch · tgPlacesGet · tgPlacesCounts   (own data only — never a Google field)
 *   Choices    tgChoiceSet · tgChoiceList · tgChoiceClear       (the tap store for flows: fact · shortlist · review)
 *   Settings   tgProfileSummaryGet · tgProfileSummaryStore
 *   Shortlist  tgShortlistStore · tgShortlistItems · tgShortlistRunKey · tgShortlistLatest
 * Values come back as plain strings (dates as YYYY-MM-DD even when a real Sheet turned them into Date cells); JSON
 * columns come back parsed. Reasons for each default: helpers/decisions/WP-5b.md.
 */
var TG_SHEETS = { TRIPS: 'Trips', DAYS: 'DayPlans', LATER: 'Later', PLACES: 'Places', CHOICES: 'Choices', SHORTLIST: 'Shortlist' };
var TG_TRIP_STATUSES = ['intake', 'researched', 'choosing', 'planned', 'delivered', 'done'];
var TG_CHOICE_KINDS = ['fact', 'shortlist', 'review'];
var TG_CELL_MAX = 50000;      // Google Sheets' per-cell character limit
var TG_CELL_CHUNK = 45000;    // chunk size used when a DayPlans JSON cell would exceed TG_CELL_MAX
var TG_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** Google Places content that must never be stored in the Places tab (Maps terms: own data only). */
var TG_GOOGLE_FIELDS = ['hours', 'opening_hours', 'regular_opening_hours', 'current_opening_hours', 'open_now', 'rating',
  'user_rating_count', 'review_count', 'reviews', 'website', 'website_uri', 'address', 'formatted_address',
  'short_formatted_address', 'business_status', 'price_level', 'price_range', 'phone', 'international_phone_number',
  'national_phone_number', 'types', 'primary_type', 'editorial_summary', 'photos'];
var TG_PLACE_OWN = ['slug', 'name', 'area', 'category', 'tags', 'status', 'last_trip', 'last_researched', 'last_verified',
  'note_line', 'maps_url', 'history_summary'];

registerSheet(TG_SHEETS.TRIPS, ['slug', 'title', 'destination', 'start', 'end', 'status', 'build_id', 'verified_on', 'drive_plan',
  'drive_brochure_html', 'drive_brochure_pdf', 'updated_at', 'lodging', 'review_offered_at']);
registerSheet(TG_SHEETS.DAYS, ['slug', 'date', 'theme', 'stops_json', 'legs_json', 'warnings_json', 'part', 'rain_json']);
registerSheet(TG_SHEETS.LATER, ['slug', 'place_slug', 'name', 'reason']);
registerSheet(TG_SHEETS.PLACES, ['slug', 'name', 'destination', 'area', 'category', 'tags', 'status', 'last_trip', 'last_researched',
  'last_verified', 'note_line', 'maps_url', 'history_json']);
registerSheet(TG_SHEETS.CHOICES, ['trip', 'run', 'kind', 'key', 'value', 'text', 'updated_at']);
registerSheet(TG_SHEETS.SHORTLIST, ['trip', 'run', 'round', 'group', 'n', 'slug', 'name', 'gem', 'payload_json']);

/* ---------------- cell helpers ---------------- */
function tgShStr(v) { return v === undefined || v === null ? '' : (isDate(v) ? v.toISOString() : String(v)); }
/** A date cell back to YYYY-MM-DD (a real Sheet may have turned "2027-05-12" into a Date at local midnight). */
function tgShDate(v) {
  if (v === undefined || v === null || v === '') return '';
  if (isDate(v)) return isoDateLocal(v);
  var s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) { var d = parseIso(s); return d ? isoDateLocal(d) : s.slice(0, 10); }
  return s;
}
function tgShJson(v, def) {
  if (v === undefined || v === null || v === '') return def;
  if (typeof v !== 'string') return v;
  var p = safeJsonParse(v);
  return p.ok ? p.value : def;
}
function tgShInt(v, def) { var n = parseInt(v, 10); return isNaN(n) ? def : n; }
function tgShBool(v) { return v === true || String(v).toLowerCase() === 'true'; }
function tgShFold(s) { return String(s === undefined || s === null ? '' : s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, ''); }
function tgShSlug(slug, what) {
  var s = tgShStr(slug);
  if (!TG_SLUG_RE.test(s)) throw new Error((what || 'slug') + ' must match ' + TG_SLUG_RE + ' (got "' + truncate(s, 40) + '")');
  return s;
}

/* ---------------- Trips ---------------- */
var TG_TRIP_DATE_COLS = ['start', 'end', 'verified_on'];
function tgShTripOut(r) {
  if (!r) return null;
  var out = {};
  _tgShCols(TG_SHEETS.TRIPS).forEach(function (h) {
    if (h === 'lodging') { var l = tgShJson(r.lodging, null); out.lodging = isPlainObject(l) ? l : (r.lodging ? { text: tgShStr(r.lodging) } : null); }
    else if (TG_TRIP_DATE_COLS.indexOf(h) >= 0) out[h] = tgShDate(r[h]);
    else out[h] = tgShStr(r[h]);
  });
  return out;
}
function _tgShCols(name) { return HB_REGISTRY.sheet[name].slice(); }
function _tgTripRow(slug) { return storeFind(TG_SHEETS.TRIPS, function (r) { return tgShStr(r.slug) === slug; }, 1)[0] || null; }

function tgTripGet(slug) { return tgShTripOut(_tgTripRow(tgShStr(slug))); }
/** All trips, by start date (undated last), then slug. */
function tgTripList() {
  return storeAll(TG_SHEETS.TRIPS).map(tgShTripOut).sort(function (a, b) {
    if (a.start !== b.start) return !a.start ? 1 : !b.start ? -1 : (a.start < b.start ? -1 : 1);
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });
}
/**
 * Insert or merge a trip by slug. Only Trips columns are written; lodging may be an object ({ text, nights? }) or a
 * string; null/undefined fields in obj are left alone (pass '' to clear). A new trip starts as status intake.
 */
function tgTripUpsert(obj) {
  if (!isPlainObject(obj)) throw new Error('tgTripUpsert: object required');
  var slug = tgShSlug(obj.slug, 'trip slug');
  if (obj.status !== undefined && obj.status !== null && obj.status !== '' && TG_TRIP_STATUSES.indexOf(obj.status) < 0) {
    throw new Error('tgTripUpsert: status must be one of ' + TG_TRIP_STATUSES.join(' · '));
  }
  var patch = {};
  _tgShCols(TG_SHEETS.TRIPS).forEach(function (h) {
    if (h === 'slug' || h === 'updated_at' || obj[h] === undefined || obj[h] === null) return;
    patch[h] = h === 'lodging' && typeof obj[h] === 'object' ? toJson(obj[h]) : obj[h];
  });
  patch.updated_at = nowIso();
  var row = _tgTripRow(slug);
  if (row) return tgShTripOut(storeUpdate(TG_SHEETS.TRIPS, row._row, patch));
  patch.slug = slug;
  if (!patch.status) patch.status = 'intake';
  return tgShTripOut(storeAppend(TG_SHEETS.TRIPS, patch));
}
/** Set a trip's status (intake · researched · choosing · planned · delivered · done). null when the trip is unknown. */
function tgTripSetStatus(slug, status) {
  if (TG_TRIP_STATUSES.indexOf(status) < 0) throw new Error('tgTripSetStatus: status must be one of ' + TG_TRIP_STATUSES.join(' · '));
  var row = _tgTripRow(tgShStr(slug));
  if (!row) return null;
  return tgShTripOut(storeUpdate(TG_SHEETS.TRIPS, row._row, { status: status, updated_at: nowIso() }));
}
/**
 * The trip the owner is working on: Settings.tg_current_trip when that row exists and is not done; else the trip in
 * progress today (start ≤ today ≤ end); else the next upcoming one; else null. Done trips are never current.
 */
function tgTripCurrent() {
  var pinned = settingGet(TG_SETTINGS.CURRENT_TRIP, '');
  if (pinned) { var t = tgTripGet(pinned); if (t && t.status !== 'done') return t; }
  var today = isoDateLocal();
  var open = tgTripList().filter(function (t) { return t.status !== 'done'; });
  var now = open.filter(function (t) { return t.start && t.start <= today && (t.end || t.start) >= today; });
  if (now.length) return now[0];
  var next = open.filter(function (t) { return t.start && t.start > today; });
  return next.length ? next[0] : null;
}

/* ---------------- DayPlans + Later (plan_digest) ---------------- */
var TG_DAY_JSON_COLS = ['stops_json', 'legs_json', 'warnings_json', 'rain_json'];
function _tgChunks(s) {
  if (s.length <= TG_CELL_MAX) return [s];
  var out = [];
  for (var i = 0; i < s.length; i += TG_CELL_CHUNK) out.push(s.slice(i, i + TG_CELL_CHUNK));
  return out;
}
/** Rows for one digest day: part 0 holds date + theme + the first chunk of each JSON column, part 1… the rest. */
function _tgDayRows(slug, day) {
  var cols = {}, parts = 1;
  cols.stops_json = _tgChunks(toJson(day.stops || []));
  cols.legs_json = _tgChunks(toJson(day.legs || []));
  cols.warnings_json = _tgChunks(toJson(day.warnings || []));
  cols.rain_json = _tgChunks(toJson(day.rain || []));
  TG_DAY_JSON_COLS.forEach(function (c) { parts = Math.max(parts, cols[c].length); });
  var rows = [];
  for (var p = 0; p < parts; p++) {
    var r = { slug: slug, date: String(day.date), theme: p === 0 ? String(day.theme || '') : '', part: p };
    TG_DAY_JSON_COLS.forEach(function (c) { r[c] = cols[c][p] || ''; });
    rows.push(r);
  }
  return rows;
}
/**
 * Store a validated plan_digest payload: the Trips row (build, verified_on, Drive ids, status planned unless done, start
 * and end from the days when still blank), every DayPlans row of the trip replaced by this build's days (a digest is
 * always a whole plan — a replan rebuilds from the prior plan), and the trip's Later rows replaced by the digest's list
 * — except rows the owner added (reason owner_choice) that this build neither lists nor schedules.
 * Returns { trip, days, rows, later, kept_owner_later }.
 */
function tgDigestStore(p) {
  var slug = tgShSlug(p && p.trip, 'plan_digest trip');
  var days = (p.days || []).slice();
  var prev = tgTripGet(slug);
  var drive = isPlainObject(p.drive) ? p.drive : {};
  var trip = { slug: slug, build_id: String(p.build_id || ''), verified_on: String(p.verified_on || ''),
    drive_plan: drive.plan || '', drive_brochure_html: drive.brochure_html || '', drive_brochure_pdf: drive.brochure_pdf || '' };
  if (!prev || prev.status !== 'done') trip.status = 'planned';
  if (days.length && (!prev || !prev.start)) trip.start = String(days[0].date);
  if (days.length && (!prev || !prev.end)) trip.end = String(days[days.length - 1].date);
  tgTripUpsert(trip);

  // A tab made before rain_json existed gets the column now (setup is not re-run on every deploy).
  if (sheetHeaders(getSheet(TG_SHEETS.DAYS)).indexOf('rain_json') < 0) ensureSheets();
  var old = storeFind(TG_SHEETS.DAYS, function (r) { return tgShStr(r.slug) === slug; }).map(function (r) { return r._row; });
  if (old.length) storeDeleteRows(TG_SHEETS.DAYS, old);
  var rows = 0;
  days.forEach(function (d) { _tgDayRows(slug, d).forEach(function (r) { storeAppend(TG_SHEETS.DAYS, r); rows++; }); });

  var listed = {};
  (p.later || []).forEach(function (l) { listed[l.slug] = true; });
  days.forEach(function (d) { (d.stops || []).forEach(function (s) { listed[s.slug] = true; }); });
  var oldLater = storeFind(TG_SHEETS.LATER, function (r) { return tgShStr(r.slug) === slug; });
  var keep = oldLater.filter(function (r) { return tgShStr(r.reason) === 'owner_choice' && !listed[tgShStr(r.place_slug)]; })
    .map(function (r) { return { slug: slug, place_slug: tgShStr(r.place_slug), name: tgShStr(r.name), reason: 'owner_choice' }; });
  if (oldLater.length) storeDeleteRows(TG_SHEETS.LATER, oldLater.map(function (r) { return r._row; }));
  (p.later || []).forEach(function (l) { storeAppend(TG_SHEETS.LATER, { slug: slug, place_slug: l.slug, name: l.name, reason: l.reason }); });
  keep.forEach(function (r) { storeAppend(TG_SHEETS.LATER, r); });
  return { trip: slug, days: days.length, rows: rows, later: (p.later || []).length, kept_owner_later: keep.length };
}
/** The stored days of a trip, in date order: [{ date, n (1-based), theme, stops[], legs[], warnings[], rain[] }]. */
function tgDigestDays(slug) {
  slug = tgShStr(slug);
  var byDate = {};
  storeFind(TG_SHEETS.DAYS, function (r) { return tgShStr(r.slug) === slug; }).forEach(function (r) {
    var date = tgShDate(r.date);
    (byDate[date] = byDate[date] || []).push(r);
  });
  return Object.keys(byDate).sort().map(function (date, i) {
    var parts = byDate[date].sort(function (a, b) { return tgShInt(a.part, 0) - tgShInt(b.part, 0); });
    var joined = {};
    TG_DAY_JSON_COLS.forEach(function (c) { joined[c] = parts.map(function (r) { return tgShStr(r[c]); }).join(''); });
    return { date: date, n: i + 1, theme: tgShStr(parts[0].theme), stops: tgShJson(joined.stops_json, []),
      legs: tgShJson(joined.legs_json, []), warnings: tgShJson(joined.warnings_json, []), rain: tgShJson(joined.rain_json, []) };
  });
}
/** One day by number (1-based, number or numeric string) or by date 'YYYY-MM-DD'; null when absent. */
function tgDigestDay(slug, key) {
  var days = tgDigestDays(slug), k = tgShStr(key).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(k)) return days.filter(function (d) { return d.date === k; })[0] || null;
  var n = /^\d+$/.test(k) ? parseInt(k, 10) : NaN;
  return n >= 1 && n <= days.length ? days[n - 1] : null;
}
/** The trip's Later rows: [{ place_slug, name, reason }] in stored order. */
function tgLaterList(slug) {
  slug = tgShStr(slug);
  return storeFind(TG_SHEETS.LATER, function (r) { return tgShStr(r.slug) === slug; })
    .map(function (r) { return { place_slug: tgShStr(r.place_slug), name: tgShStr(r.name), reason: tgShStr(r.reason) }; });
}
/** Add (or update by place_slug) one Later row; returns the entry. */
function tgLaterAdd(slug, entry) {
  slug = tgShSlug(slug, 'trip slug');
  entry = entry || {};
  var ps = tgShSlug(entry.place_slug, 'place_slug');
  var e = { place_slug: ps, name: truncate(tgShStr(entry.name) || ps, 120), reason: truncate(tgShStr(entry.reason) || 'owner_choice', 300) };
  var row = storeFind(TG_SHEETS.LATER, function (r) { return tgShStr(r.slug) === slug && tgShStr(r.place_slug) === ps; }, 1)[0];
  if (row) storeUpdate(TG_SHEETS.LATER, row._row, { name: e.name, reason: e.reason });
  else storeAppend(TG_SHEETS.LATER, { slug: slug, place_slug: ps, name: e.name, reason: e.reason });
  return e;
}

/* ---------------- Places (own data only) ---------------- */
var TG_PLACE_CONTENT = ['name', 'destination', 'area', 'category', 'tags', 'status', 'last_trip', 'note_line', 'maps_url'];
function tgShPlaceOut(r) {
  if (!r) return null;
  var tags = tgShJson(r.tags, []);
  var hist = tgShJson(r.history_json, {});
  return {
    slug: tgShStr(r.slug), name: tgShStr(r.name), destination: tgShStr(r.destination), area: tgShStr(r.area),
    category: tgShStr(r.category), tags: Array.isArray(tags) ? tags.map(String) : [], status: tgShStr(r.status),
    last_trip: tgShStr(r.last_trip), last_researched: tgShDate(r.last_researched), last_verified: tgShDate(r.last_verified),
    note_line: tgShStr(r.note_line), maps_url: tgShStr(r.maps_url),
    history_summary: isPlainObject(hist) && hist.summary !== undefined ? String(hist.summary) : ''
  };
}
/** Google fields present on an object (top level), for refusal. */
function tgGoogleFieldsIn(o) {
  if (!isPlainObject(o)) return [];
  return Object.keys(o).filter(function (k) { return TG_GOOGLE_FIELDS.indexOf(String(k).toLowerCase()) >= 0; });
}
/**
 * Upsert every place of a places_digest payload ({ destination, places[] }) by slug. Only our own fields are kept:
 * any Google field (TG_GOOGLE_FIELDS) or other unknown key is stripped and reported, never stored.
 * Returns { destination, added, changed, verified, same, refused: [{ slug, field }], places: [{ slug, name, kind:
 * new | changed | verified | same, status, note_line, last_verified, changed_fields[] }] } — `verified` = only dates or
 * history moved, `changed` = name, area, category, tags, status, last trip, note line or link moved.
 */
function tgPlacesUpsert(digest) {
  if (!isPlainObject(digest) || !Array.isArray(digest.places)) throw new Error('tgPlacesUpsert: { destination, places[] } required');
  var dest = tgShSlug(digest.destination, 'destination');
  var res = { destination: dest, added: 0, changed: 0, verified: 0, same: 0, refused: [], places: [] };
  var existing = {};
  storeAll(TG_SHEETS.PLACES).forEach(function (r) { existing[tgShStr(r.slug)] = r; });
  digest.places.forEach(function (pl) {
    if (!isPlainObject(pl)) return;
    var slug = tgShSlug(pl.slug, 'place slug');
    Object.keys(pl).forEach(function (k) { if (TG_PLACE_OWN.indexOf(k) < 0) res.refused.push({ slug: slug, field: k }); });
    var tags = Array.isArray(pl.tags) ? pl.tags.map(function (t) { return truncate(tgShStr(t), 40); }).slice(0, 20) : [];
    var row = {
      slug: slug, name: truncate(tgShStr(pl.name), 120), destination: dest, area: truncate(tgShStr(pl.area), 120),
      category: tgShStr(pl.category), tags: toJson(tags), status: tgShStr(pl.status), last_trip: tgShStr(pl.last_trip),
      last_researched: tgShStr(pl.last_researched), last_verified: tgShStr(pl.last_verified),
      note_line: truncate(tgShStr(pl.note_line), 160), maps_url: tgShStr(pl.maps_url),
      history_json: toJson({ summary: truncate(tgShStr(pl.history_summary), 120) })
    };
    var old = existing[slug], kind, changedFields = [];
    var stored;
    if (!old) { stored = storeAppend(TG_SHEETS.PLACES, row); kind = 'new'; res.added++; }
    else {
      var before = tgShPlaceOut(old), after = tgShPlaceOut(row);
      TG_PLACE_CONTENT.forEach(function (f) { if (toJson(before[f]) !== toJson(after[f])) changedFields.push(f); });
      var datesMoved = ['last_researched', 'last_verified', 'history_summary'].some(function (f) { return before[f] !== after[f]; });
      kind = changedFields.length ? 'changed' : datesMoved ? 'verified' : 'same';
      res[kind]++;
      stored = kind === 'same' ? old : storeUpdate(TG_SHEETS.PLACES, old._row, row);
    }
    existing[slug] = stored;
    res.places.push({ slug: slug, name: row.name, kind: kind, status: row.status, note_line: row.note_line,
      last_verified: row.last_verified, changed_fields: changedFields });
  });
  return res;
}
function tgPlacesGet(slug) {
  slug = tgShStr(slug);
  return tgShPlaceOut(storeFind(TG_SHEETS.PLACES, function (r) { return tgShStr(r.slug) === slug; }, 1)[0] || null);
}
/**
 * Search the Places tab on name, tags and area (case- and accent-insensitive; every word of the query must match).
 * Order: the destination first (opts.destination, else the current trip's destination as a slug), then names that
 * start with the query, names that contain it, the rest; then by name. opts.limit default 8 (1–25).
 */
function tgPlacesSearch(query, opts) {
  opts = opts || {};
  var q = tgShFold(query).trim().replace(/\s+/g, ' ');
  if (!q) return [];
  var words = q.split(' ');
  var limit = clampInt(opts.limit, 1, 25, 8);
  var dest = opts.destination ? tgSlug(opts.destination) : '';
  if (!dest && !opts.destination) { var cur = tgTripCurrent(); dest = cur && cur.destination ? tgSlug(cur.destination) : ''; }
  var hits = [];
  storeAll(TG_SHEETS.PLACES).forEach(function (r) {
    var p = tgShPlaceOut(r);
    var name = tgShFold(p.name);
    var hay = name + ' ' + tgShFold(p.area) + ' ' + tgShFold(p.tags.join(' ')) + ' ' + tgShFold(p.slug.replace(/-/g, ' '));
    if (!words.every(function (w) { return hay.indexOf(w) >= 0; })) return;
    var rank = name.indexOf(q) === 0 ? 0 : name.indexOf(q) > 0 ? 1 : 2;
    hits.push({ p: p, d: dest && p.destination === dest ? 0 : 1, rank: rank, name: name });
  });
  hits.sort(function (a, b) { return a.d - b.d || a.rank - b.rank || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); });
  return hits.slice(0, limit).map(function (h) { return h.p; });
}
/** { <destination slug>: number of places } */
function tgPlacesCounts() {
  var out = {};
  storeAll(TG_SHEETS.PLACES).forEach(function (r) { var d = tgShStr(r.destination) || '(none)'; out[d] = (out[d] || 0) + 1; });
  return out;
}

/* ---------------- Choices (tap store) ---------------- */
function _tgChoiceRows(trip, run, kind) {
  trip = tgShStr(trip); run = tgShStr(run); kind = tgShStr(kind);
  return storeFind(TG_SHEETS.CHOICES, function (r) { return tgShStr(r.trip) === trip && tgShStr(r.run) === run && tgShStr(r.kind) === kind; });
}
/** Record one tap: (trip, run, kind, key) → value (+ optional text, e.g. an edited fact). A later tap overwrites. */
function tgChoiceSet(trip, run, kind, key, value, text) {
  if (TG_CHOICE_KINDS.indexOf(kind) < 0) throw new Error('tgChoiceSet: kind must be one of ' + TG_CHOICE_KINDS.join(' · '));
  if (!tgShStr(trip) || !tgShStr(run) || !tgShStr(key)) throw new Error('tgChoiceSet: trip, run and key are required');
  var obj = { trip: tgShStr(trip), run: tgShStr(run), kind: kind, key: tgShStr(key), value: tgShStr(value),
    text: truncate(tgShStr(text), 2000), updated_at: nowIso() };
  var row = _tgChoiceRows(trip, run, kind).filter(function (r) { return tgShStr(r.key) === obj.key; })[0];
  if (row) storeUpdate(TG_SHEETS.CHOICES, row._row, obj); else storeAppend(TG_SHEETS.CHOICES, obj);
  return { key: obj.key, value: obj.value, text: obj.text, updated_at: obj.updated_at };
}
/** [{ key, value, text, updated_at }] in the order the keys were first tapped. */
function tgChoiceList(trip, run, kind) {
  return _tgChoiceRows(trip, run, kind).map(function (r) {
    return { key: tgShStr(r.key), value: tgShStr(r.value), text: tgShStr(r.text), updated_at: tgShStr(r.updated_at) };
  });
}
/** Delete every tap of (trip, run, kind); returns how many rows went. */
function tgChoiceClear(trip, run, kind) {
  var rows = _tgChoiceRows(trip, run, kind).map(function (r) { return r._row; });
  if (rows.length) storeDeleteRows(TG_SHEETS.CHOICES, rows);
  return rows.length;
}

/* ---------------- Profile summary (Settings) ---------------- */
/** { text, dimensions_count?, updated?, received_at } or null. */
function tgProfileSummaryGet() {
  var p = tgShJson(settingGet(TG_SETTINGS.PROFILE_SUMMARY, ''), null);
  return isPlainObject(p) && typeof p.text === 'string' && p.text ? p : null;
}
/** Cache a validated profile_summary payload; returns the stored object. */
function tgProfileSummaryStore(payload) {
  var o = { text: String(payload.text), received_at: nowIso() };
  if (payload.dimensions_count !== undefined) o.dimensions_count = payload.dimensions_count;
  if (payload.updated !== undefined) o.updated = String(payload.updated);
  settingSet(TG_SETTINGS.PROFILE_SUMMARY, toJson(o), 'profile_summary from the brain');
  return o;
}

/* ---------------- Shortlist rounds ---------------- */
/** Short run key for callback data (≤ 12 chars of [A-Za-z0-9_.-]): the run_id itself when it fits, else r + 11 hex. */
function tgShortlistRunKey(trip, runId) {
  var s = tgShStr(runId);
  if (/^[A-Za-z0-9_.-]{1,12}$/.test(s)) return s;
  return 'r' + sha1Hex(tgShStr(trip) + '|' + s).slice(0, 11);
}
/**
 * Store one validated shortlist payload as one row per item (a re-delivered round replaces its own rows).
 * Returns { trip, run (the short key), run_id, round, count }.
 */
function tgShortlistStore(p) {
  var trip = tgShSlug(p && p.trip, 'shortlist trip');
  var run = tgShortlistRunKey(trip, p.run_id), round = tgShInt(p.round, 0);
  var old = storeFind(TG_SHEETS.SHORTLIST, function (r) { return tgShStr(r.trip) === trip && tgShStr(r.run) === run && tgShInt(r.round, -1) === round; });
  if (old.length) storeDeleteRows(TG_SHEETS.SHORTLIST, old.map(function (r) { return r._row; }));
  var count = 0;
  (p.groups || []).forEach(function (g) {
    (g.items || []).forEach(function (it) {
      storeAppend(TG_SHEETS.SHORTLIST, { trip: trip, run: run, round: round, group: String(g.id), n: it.n, slug: it.slug,
        name: it.name, gem: it.gem === true, payload_json: toJson(it) });
      count++;
    });
  });
  return { trip: trip, run: run, run_id: String(p.run_id), round: round, count: count };
}
/** Items of a run (short key or the full run_id), every round: [{ round, group, n, slug, name, gem, item }] by round, n. */
function tgShortlistItems(trip, run) {
  trip = tgShStr(trip);
  var key = tgShortlistRunKey(trip, run);
  return storeFind(TG_SHEETS.SHORTLIST, function (r) { return tgShStr(r.trip) === trip && tgShStr(r.run) === key; })
    .map(function (r) {
      return { round: tgShInt(r.round, 0), group: tgShStr(r.group), n: tgShInt(r.n, 0), slug: tgShStr(r.slug),
        name: tgShStr(r.name), gem: tgShBool(r.gem), item: tgShJson(r.payload_json, {}) };
    })
    .sort(function (a, b) { return a.round - b.round || a.n - b.n; });
}
/** Every shortlist run key of a trip, in the order first stored. */
function tgShortlistRuns(trip) {
  trip = tgShStr(trip);
  var out = [];
  storeAll(TG_SHEETS.SHORTLIST).forEach(function (r) { var k = tgShStr(r.run); if (tgShStr(r.trip) === trip && out.indexOf(k) < 0) out.push(k); });
  return out;
}
/** The most recently stored round (of one trip, or of any trip): { trip, run, round } or null. */
function tgShortlistLatest(trip) {
  var rows = storeAll(TG_SHEETS.SHORTLIST).filter(function (r) { return !trip || tgShStr(r.trip) === tgShStr(trip); });
  if (!rows.length) return null;
  var r = rows[rows.length - 1];
  return { trip: tgShStr(r.trip), run: tgShStr(r.run), round: tgShInt(r.round, 0) };
}

/* ---------------- Snapshot (to-brain/state.json → tour_guide) ---------------- */
var TG_SNAPSHOT_TRIPS = 20;
/**
 * Small on purpose: trips with their status (open ones first, at most 20), the open choice round (the latest shortlist
 * of a trip in `choosing`, with the owner's want / later / skip tap counts so far), the date of the cached profile
 * summary and how many places the repository holds per destination.
 */
function tgSnapshot() {
  var trips = tgTripList();
  var open = trips.filter(function (t) { return t.status !== 'done'; }), done = trips.filter(function (t) { return t.status === 'done'; });
  var shown = open.concat(done).slice(0, TG_SNAPSHOT_TRIPS).map(function (t) {
    return { slug: t.slug, destination: t.destination, start: t.start, end: t.end, status: t.status, build_id: t.build_id };
  });
  var round = null;
  var rows = storeAll(TG_SHEETS.SHORTLIST);
  for (var i = rows.length - 1; i >= 0 && !round; i--) {
    var t = tgTripGet(tgShStr(rows[i].trip));
    if (!t || t.status !== 'choosing') continue;
    var run = tgShStr(rows[i].run), counts = { want: 0, later: 0, skip: 0 };
    tgChoiceList(t.slug, run, 'shortlist').forEach(function (c) {
      var v = c.value.charAt(0);
      if (v === 'w') counts.want++; else if (v === 'l') counts.later++; else if (v === 's') counts.skip++;
    });
    var items = rows.filter(function (r) { return tgShStr(r.trip) === t.slug && tgShStr(r.run) === run; }).length;
    round = { trip: t.slug, run: run, round: tgShInt(rows[i].round, 0), items: items, want: counts.want, later: counts.later, skip: counts.skip };
  }
  var prof = tgProfileSummaryGet();
  return {
    trips: shown, trips_total: trips.length, choice_round: round,
    profile_summary: prof ? { updated: tgShDate(prof.updated || prof.received_at) } : null,
    places: tgPlacesCounts()
  };
}
registerSnapshotProvider('tour_guide', tgSnapshot);

// Developed by: LightAISolutions
