/**
 * Tour Guide pack — the journey before the days (TG-PHASE-11 wave 2, WP-11f): outlines of the whole trip compared side by side,
 * then two or three versions of each day (one when the day has only one way to go), then one plan built from the chosen
 * mix. Defaults: helpers/decisions/WP-11f.md and helpers/decisions/TG-PHASE-11.md §6.
 *   ✅ Done choosing (plan flow, 12_flow_plan.js) on a dated trip of 1–31 days:
 *     3 days or more → request kind `outline` { trip, dates, picks, later, skip }          stage `outline`
 *     1–2 days       → request kind `day_versions` { trip, dates, picks, later, skip }     stage `versions`
 *     undated, longer than 31 days, or Settings tg_journey not `on` → the plan request as before (stage `planning`)
 *   The switch is the owner's /journey on|off and is OFF until set: the private routine answers `outline` / `day_versions`
 *   only after its Phase 11 update. While it is off, /outline, /versions, the ol:/dv: buttons (but ⏩) and the app's Compare
 *   operations answer that it is off and never send a request.
 *   ⏩ Plan straight away (flow button value `direct`, or ol:<trip key>:d) → the plan request exactly as before
 *   envelope `outline`      → Journeys tab (a re-delivered build replaces its rows), then the outlines side by side with
 *                             ✅ A · B · C (ol:<trip key>:<tag>:<key>), 📱 Mix in the app, ⏩ Plan straight away; an outline
 *                             with one option (a trip with only one shape) is taken as it is while the flow waits for it, and
 *                             the day versions are asked at once
 *   a choice { base, mix? } → stored on the outline, request kind `day_versions` { …, outline: { build_id, base, mix? } }
 *   envelope `day_versions` → DayVersions tab, one summary per version with a button each (dv:<trip key>:<tag>:<mmdd>:<key>);
 *                             a day with one way to go comes as one version, shown without buttons (it is what the plan
 *                             uses); once every trip date has versions, "🧱 Build my plan" (dv:<trip key>:b)
 *   Build my plan           → request kind `plan` as before plus outline and versions [{ date, build_id, key }]
 *   /outline [A | A 3B 5C]  → the newest outline, or choose it (day N or a date takes that day from another outline)
 *   /versions <date|day N>  → a day's stored versions; on a planned day a button replaces the day (dv:…:r<key> → a replan
 *                             for that date carrying alternative { date, build_id, key })
 * Load order: this file runs before 20_envelopes.js and 21_sheets.js; their names are only used inside functions.
 * App operations: 36_journey_app.js.
 */
var TG_JY = {
  SHEET: 'Journeys', DAYS: 'DayVersions', OUTLINE_MIN_DAYS: 3, MAX_DAYS: 31, KEEP_BUILDS: 6, SETTING: 'tg_journey',
  KEYS: ['A', 'B', 'C'], KINDS: ['full', 'light', 'travel', 'rain_spare', 'free'], BUILD_MAX: 120,
  TITLE: 80, GAINS: 200, AREA: 60, NAME: 120, NOTE: 120, NOTES: 300, SUMMARY: 160, STOPS: 12, BOOKINGS: 5, BOOKING: 120,
  LEAVES: 10, WARNINGS: 5, WARNING: 160, MINUTES: 1440
};
var TG_JY_ICON = { full: '●', light: '◐', travel: '🧳', rain_spare: '☔', free: '○' };
var TG_JY_WORD = { full: 'full day', light: 'light day', travel: 'travel day', rain_spare: 'rain spare', free: 'free day' };
var TG_JY_LEGEND = '● full · ◐ light · 🧳 travel · ☔ rain spare · ○ free';

registerSheet(TG_JY.SHEET, ['trip', 'build_id', 'part', 'json', 'choice_json', 'received_at', 'chosen_at']);
registerSheet(TG_JY.DAYS, ['trip', 'build_id', 'date', 'part', 'json', 'chosen', 'received_at', 'chosen_at']);

/* ==================== validators (mirrors of the two payload schemas and their checks) ==================== */

function tgJyPlace(errs, at, x) {
  if (!tgEnvObj(errs, at, x, ['slug', 'name'])) return;
  if (x.slug !== undefined) tgEnvSlug(errs, at + '.slug', x.slug);
  if (x.name !== undefined) tgEnvStr(errs, at + '.name', x.name, 1, TG_JY.NAME);
}
function tgJyOutlineDay(errs, at, d) {
  if (!tgEnvObj(errs, at, d, ['date', 'area', 'kind'], ['anchors', 'note'])) return;
  if (d.date !== undefined) tgEnvDate(errs, at + '.date', d.date);
  if (d.area !== undefined) tgEnvStr(errs, at + '.area', d.area, 0, TG_JY.AREA);
  if (d.kind !== undefined) tgEnvEnum(errs, at + '.kind', d.kind, TG_JY.KINDS);
  if (d.note !== undefined) tgEnvStr(errs, at + '.note', d.note, 0, TG_JY.NOTE);
  if (d.anchors !== undefined && tgEnvArr(errs, at + '.anchors', d.anchors, 3)) {
    d.anchors.forEach(function (a, i) { tgJyPlace(errs, at + '.anchors[' + i + ']', a); });
    tgEnvDupes(errs, at + '.anchors', d.anchors, 'slug', 'anchor slug');
  }
}
/** Mirror of schemas/tour-guide-outline.schema.json + checkOutline: every option covers the same consecutive dates, in order. */
function tgEnvValidateOutline(p) {
  var errs = [];
  if (!tgEnvObj(errs, 'payload', p, ['trip', 'build_id', 'options'], ['v', 'kind', 'notes'])) return tgEnvDone(errs);
  tgEnvHead(errs, p, 'outline');
  if (p.trip !== undefined) tgEnvSlug(errs, 'trip', p.trip);
  if (p.build_id !== undefined) tgEnvStr(errs, 'build_id', p.build_id, 1, TG_JY.BUILD_MAX);
  if (p.notes !== undefined) tgEnvStr(errs, 'notes', p.notes, 0, TG_JY.NOTES);
  if (p.options !== undefined && tgEnvArr(errs, 'options', p.options, 3, 1)) {
    var first = null;
    p.options.forEach(function (o, i) {
      var at = 'options[' + i + ']';
      if (!tgEnvObj(errs, at, o, ['key', 'title', 'gains', 'gives_up', 'days'])) return;
      if (o.key !== undefined) tgEnvEnum(errs, at + '.key', o.key, TG_JY.KEYS);
      if (o.title !== undefined) tgEnvStr(errs, at + '.title', o.title, 1, TG_JY.TITLE);
      if (o.gains !== undefined) tgEnvStr(errs, at + '.gains', o.gains, 1, TG_JY.GAINS);
      if (o.gives_up !== undefined) tgEnvStr(errs, at + '.gives_up', o.gives_up, 1, TG_JY.GAINS);
      if (o.days === undefined || !tgEnvArr(errs, at + '.days', o.days, TG_JY.MAX_DAYS, 1)) return;
      o.days.forEach(function (d, j) {
        tgJyOutlineDay(errs, at + '.days[' + j + ']', d);
        var prev = j ? o.days[j - 1] : null;
        if (prev && isPlainObject(prev) && isPlainObject(d) && tgEnvRealDate(prev.date) && tgEnvRealDate(d.date) && isoDateAdd(prev.date, 1) !== d.date) {
          errs.push(at + '.days[' + j + '].date: every trip date once, in order (the day after the previous one)');
        }
      });
      var dates = o.days.map(function (d) { return isPlainObject(d) ? String(d.date) : ''; }).join(',');
      if (first === null) first = dates;
      else if (dates !== first) errs.push(at + '.days: must cover the same dates as options[0]');
    });
    tgEnvDupes(errs, 'options', p.options, 'key', 'option key');
  }
  tgEnvSize(errs, p);
  return tgEnvDone(errs);
}
function tgJyStrList(errs, at, v, max, len) {
  if (!tgEnvArr(errs, at, v, max)) return;
  v.forEach(function (s, i) { tgEnvStr(errs, at + '[' + i + ']', s, 1, len); });
}
function tgJyVersion(errs, at, x) {
  if (!tgEnvObj(errs, at, x, ['key', 'title', 'summary', 'stops', 'walk_minutes', 'transit_minutes', 'spare_minutes', 'bookings', 'leaves_out', 'warnings'])) return;
  if (x.key !== undefined) tgEnvEnum(errs, at + '.key', x.key, TG_JY.KEYS);
  if (x.title !== undefined) tgEnvStr(errs, at + '.title', x.title, 1, TG_JY.TITLE);
  if (x.summary !== undefined) tgEnvStr(errs, at + '.summary', x.summary, 0, TG_JY.SUMMARY);
  ['walk_minutes', 'transit_minutes', 'spare_minutes'].forEach(function (k) { if (x[k] !== undefined) tgEnvInt(errs, at + '.' + k, x[k], 0, TG_JY.MINUTES); });
  if (x.stops !== undefined && tgEnvArr(errs, at + '.stops', x.stops, TG_JY.STOPS)) {
    x.stops.forEach(function (s, i) {
      var sa = at + '.stops[' + i + ']';
      if (!tgEnvObj(errs, sa, s, ['slug', 'name'], ['time'])) return;
      if (s.slug !== undefined) tgEnvSlug(errs, sa + '.slug', s.slug);
      if (s.name !== undefined) tgEnvStr(errs, sa + '.name', s.name, 1, TG_JY.NAME);
      if (s.time !== undefined) tgEnvStr(errs, sa + '.time', s.time, 5, 5, TG_ENV_RE.time);
    });
    tgEnvDupes(errs, at + '.stops', x.stops, 'slug', 'stop slug');
  }
  if (x.bookings !== undefined) tgJyStrList(errs, at + '.bookings', x.bookings, TG_JY.BOOKINGS, TG_JY.BOOKING);
  if (x.warnings !== undefined) tgJyStrList(errs, at + '.warnings', x.warnings, TG_JY.WARNINGS, TG_JY.WARNING);
  if (x.leaves_out !== undefined && tgEnvArr(errs, at + '.leaves_out', x.leaves_out, TG_JY.LEAVES)) {
    x.leaves_out.forEach(function (l, i) { tgJyPlace(errs, at + '.leaves_out[' + i + ']', l); });
    tgEnvDupes(errs, at + '.leaves_out', x.leaves_out, 'slug', 'left-out slug');
  }
}
/** Mirror of schemas/tour-guide-day-versions.schema.json + checkDayVersions: unique keys, chosen one of them. */
function tgEnvValidateDayVersions(p) {
  var errs = [];
  if (!tgEnvObj(errs, 'payload', p, ['trip', 'build_id', 'date', 'versions'], ['v', 'kind', 'chosen'])) return tgEnvDone(errs);
  tgEnvHead(errs, p, 'day_versions');
  if (p.trip !== undefined) tgEnvSlug(errs, 'trip', p.trip);
  if (p.build_id !== undefined) tgEnvStr(errs, 'build_id', p.build_id, 1, TG_JY.BUILD_MAX);
  if (p.date !== undefined) tgEnvDate(errs, 'date', p.date);
  if (p.versions !== undefined && tgEnvArr(errs, 'versions', p.versions, 3, 1)) {
    p.versions.forEach(function (x, i) { tgJyVersion(errs, 'versions[' + i + ']', x); });
    tgEnvDupes(errs, 'versions', p.versions, 'key', 'version key');
  }
  if (p.chosen !== undefined) {
    tgEnvEnum(errs, 'chosen', p.chosen, TG_JY.KEYS);
    var keys = Array.isArray(p.versions) ? p.versions.map(function (x) { return isPlainObject(x) ? x.key : null; }) : [];
    if (TG_JY.KEYS.indexOf(p.chosen) >= 0 && keys.indexOf(p.chosen) < 0) errs.push('chosen must be one of the version keys');
  }
  tgEnvSize(errs, p);
  return tgEnvDone(errs);
}

/* ==================== the Journeys and DayVersions tabs ==================== */

/** A deployment set up before WP-11f has neither tab: reads see nothing, the first write creates them. */
function tgJyHasTab(name) { return !!getSpreadsheet().getSheetByName(name); }
function tgJyEnsure() { if (!tgJyHasTab(TG_JY.SHEET) || !tgJyHasTab(TG_JY.DAYS)) ensureSheets(); }
function tgJyRows(name, pred) { return tgJyHasTab(name) ? storeFind(name, pred) : []; }
/** Rows of one record (chunks of one JSON) → { head (part 0 row), payload } or null when the JSON does not parse. */
function tgJyJoin(rows) {
  rows = rows.slice().sort(function (a, b) { return tgShInt(a.part, 0) - tgShInt(b.part, 0); });
  var p = tgShJson(rows.map(function (r) { return tgShStr(r.json); }).join(''), null);
  return isPlainObject(p) ? { head: rows[0], payload: p } : null;
}
/** Newest first: received_at, then the later row (a re-delivery is appended after the rows it replaced). */
function tgJyNewest(a, b) { return a.received_at !== b.received_at ? (a.received_at < b.received_at ? 1 : -1) : b._row - a._row; }
function tgJyGroup(rows, keyOf) {
  var by = {}, order = [];
  rows.forEach(function (r) { var k = keyOf(r); if (!by[k]) { by[k] = []; order.push(k); } by[k].push(r); });
  return order.map(function (k) { return by[k]; });
}
function tgJyWrite(name, base, json) {
  _tgChunks(json).forEach(function (c, i) {
    var row = {};
    Object.keys(base).forEach(function (k) { row[k] = i === 0 || k === 'trip' || k === 'build_id' || k === 'date' || k === 'received_at' ? base[k] : ''; });
    row.part = i; row.json = c;
    storeAppend(name, row);
  });
}

/* ---- outlines ---- */
/** { trip, build_id, payload, keys, dates, choice: { base, mix? } | null, received_at, chosen_at, _row } */
function tgJyOutlineRec(rows) {
  var j = tgJyJoin(rows);
  if (!j || !Array.isArray(j.payload.options) || !j.payload.options.length) return null;
  var p = j.payload, h = j.head, choice = tgShJson(h.choice_json, null);
  var first = isPlainObject(p.options[0]) && Array.isArray(p.options[0].days) ? p.options[0].days : [];
  return { trip: tgShStr(h.trip), build_id: tgShStr(h.build_id), payload: p,
    keys: p.options.map(function (o) { return o.key; }), dates: first.map(function (d) { return d.date; }),
    choice: isPlainObject(choice) && typeof choice.base === 'string' ? choice : null,
    received_at: tgShStr(h.received_at), chosen_at: tgShStr(h.chosen_at), _row: h._row };
}
/** The trip's stored outlines, newest first. */
function tgJyOutlines(slug) {
  slug = tgShStr(slug);
  return tgJyGroup(tgJyRows(TG_JY.SHEET, function (r) { return tgShStr(r.trip) === slug; }), function (r) { return tgShStr(r.build_id); })
    .map(tgJyOutlineRec).filter(Boolean).sort(tgJyNewest);
}
function tgJyOutlineGet(slug, build) { return tgJyOutlines(slug).filter(function (o) { return o.build_id === build; })[0] || null; }
function tgJyOutlineByTag(slug, tag) { return tgJyOutlines(slug).filter(function (o) { return tgCmdTag(o.build_id) === tag; })[0] || null; }
/**
 * Check and normalise a choice against an outline: base one of its keys; mix { <date>: key } with dates of the outline and
 * keys of its options (an entry equal to base is dropped). → { ok: true, choice } | { ok: false, why, field? }
 */
function tgJyChoiceNorm(rec, choice) {
  if (!isPlainObject(choice) || typeof choice.base !== 'string' || rec.keys.indexOf(choice.base) < 0) return { ok: false, why: 'bad_base' };
  var out = { base: choice.base }, mix = {}, n = 0;
  if (choice.mix !== undefined && choice.mix !== null) {
    if (!isPlainObject(choice.mix)) return { ok: false, why: 'bad_mix' };
    var ds = Object.keys(choice.mix);
    if (ds.length > TG_JY.MAX_DAYS) return { ok: false, why: 'bad_mix' };
    for (var i = 0; i < ds.length; i++) {
      var k = choice.mix[ds[i]];
      if (rec.dates.indexOf(ds[i]) < 0) return { ok: false, why: 'bad_date', field: ds[i] };
      if (typeof k !== 'string' || rec.keys.indexOf(k) < 0) return { ok: false, why: 'bad_mix', field: ds[i] };
      if (k !== choice.base) { mix[ds[i]] = k; n++; }
    }
  }
  if (n) { out.mix = {}; rec.dates.forEach(function (d) { if (mix[d]) out.mix[d] = mix[d]; }); }
  return { ok: true, choice: out };
}
/** Store a validated outline; a re-delivered build replaces its rows (keeping the owner's choice while it still fits). */
function tgJyStoreOutline(p) {
  tgJyEnsure();
  var old = tgJyOutlineGet(p.trip, p.build_id), choice = '', chosenAt = '';
  if (old && old.choice) {
    var probe = tgJyOutlineRec([{ trip: p.trip, build_id: p.build_id, part: 0, json: toJson(p) }]);
    var n = probe ? tgJyChoiceNorm(probe, old.choice) : { ok: false };
    if (n.ok) { choice = toJson(n.choice); chosenAt = old.chosen_at; }
  }
  tgJyDelete(TG_JY.SHEET, function (r) { return tgShStr(r.trip) === p.trip && tgShStr(r.build_id) === p.build_id; });
  tgJyWrite(TG_JY.SHEET, { trip: p.trip, build_id: p.build_id, choice_json: choice, received_at: nowIso(), chosen_at: chosenAt }, toJson(p));
  var all = tgJyOutlines(p.trip);
  all.slice(TG_JY.KEEP_BUILDS).forEach(function (o) {
    tgJyDelete(TG_JY.SHEET, function (r) { return tgShStr(r.trip) === p.trip && tgShStr(r.build_id) === o.build_id; });
  });
  return { rec: tgJyOutlineGet(p.trip, p.build_id), replaced: !!old };
}
function tgJyDelete(name, pred) {
  var rows = tgJyRows(name, pred);
  if (rows.length) storeDeleteRows(name, rows.map(function (r) { return r._row; }));
  return rows.length;
}
function tgJySetChoice(rec, choice) {
  storeUpdate(TG_JY.SHEET, rec._row, { choice_json: toJson(choice), chosen_at: nowIso() });
  return tgJyOutlineGet(rec.trip, rec.build_id);
}

/* ---- day versions ---- */
/** { trip, build_id, date, payload, keys, chosen (the sheet's), key (the effective choice), received_at, chosen_at, _row } */
function tgJyVersionsRec(rows) {
  var j = tgJyJoin(rows);
  if (!j || !Array.isArray(j.payload.versions) || !j.payload.versions.length) return null;
  var p = j.payload, h = j.head, keys = p.versions.map(function (v) { return v.key; }), chosen = tgShStr(h.chosen);
  var key = keys.indexOf(chosen) >= 0 ? chosen : keys.indexOf(p.chosen) >= 0 ? p.chosen : keys[0];
  return { trip: tgShStr(h.trip), build_id: tgShStr(h.build_id), date: tgShDate(h.date), payload: p, keys: keys,
    chosen: keys.indexOf(chosen) >= 0 ? chosen : '', key: key, received_at: tgShStr(h.received_at), chosen_at: tgShStr(h.chosen_at), _row: h._row };
}
/** Every stored set of versions of the trip, newest first. */
function tgJyVersionsAll(slug) {
  slug = tgShStr(slug);
  return tgJyGroup(tgJyRows(TG_JY.DAYS, function (r) { return tgShStr(r.trip) === slug; }), function (r) { return tgShStr(r.build_id) + '|' + tgShDate(r.date); })
    .map(tgJyVersionsRec).filter(Boolean).sort(tgJyNewest);
}
function tgJyVersionsGet(slug, build, date) {
  return tgJyVersionsAll(slug).filter(function (v) { return v.build_id === build && v.date === date; })[0] || null;
}
/** Store a validated day_versions payload; a re-delivered build and date replaces its rows, the owner's pick kept. */
function tgJyStoreVersions(p) {
  tgJyEnsure();
  var old = tgJyVersionsGet(p.trip, p.build_id, p.date), keys = p.versions.map(function (v) { return v.key; });
  var same = function (r) { return tgShStr(r.trip) === p.trip && tgShStr(r.build_id) === p.build_id && tgShDate(r.date) === p.date; };
  var chosen = old && keys.indexOf(old.chosen) >= 0 ? old.chosen : '';
  tgJyDelete(TG_JY.DAYS, same);
  tgJyWrite(TG_JY.DAYS, { trip: p.trip, build_id: p.build_id, date: p.date, chosen: chosen, received_at: nowIso(), chosen_at: chosen ? old.chosen_at : '' }, toJson(p));
  tgJyVersionsAll(p.trip).filter(function (v) { return v.date === p.date; }).slice(TG_JY.KEEP_BUILDS).forEach(function (v) {
    tgJyDelete(TG_JY.DAYS, function (r) { return tgShStr(r.trip) === p.trip && tgShStr(r.build_id) === v.build_id && tgShDate(r.date) === p.date; });
  });
  return { rec: tgJyVersionsGet(p.trip, p.build_id, p.date), replaced: !!old };
}
function tgJySetVersion(rec, key) {
  storeUpdate(TG_JY.DAYS, rec._row, { chosen: key, chosen_at: nowIso() });
  return tgJyVersionsGet(rec.trip, rec.build_id, rec.date);
}

/* ---- the trip's journey ---- */
/** The trip's dates start..end (a single day without an end); [] when undated or longer than TG_JY.MAX_DAYS. */
function tgJyTripDates(trip) {
  if (!trip || !tgEnvRealDate(trip.start)) return [];
  var end = tgEnvRealDate(trip.end) ? trip.end : trip.start, n = tgCmdDaysBetween(trip.start, end), out = [];
  if (n === null || n < 0 || n + 1 > TG_JY.MAX_DAYS) return [];
  for (var i = 0; i <= n; i++) out.push(isoDateAdd(trip.start, i));
  return out;
}
/** The journey runs only when Settings tg_journey is `on` (/journey on); unset or anything else is off: ✅ Done choosing plans as before. */
function tgJyOn() { return String(settingGet(TG_JY.SETTING, '') || '').trim().toLowerCase() === 'on'; }
var TG_JY_OFF = 'Outlines and day versions are off — /journey on turns them on.';
/** 'outline' (3 days or more), 'versions' (1–2 days) or '' (undated, too long, or switched off). */
function tgJyMode(slug) {
  if (!tgJyOn()) return '';
  var d = tgJyTripDates(tgTripGet(slug));
  return !d.length ? '' : d.length >= TG_JY.OUTLINE_MIN_DAYS ? 'outline' : 'versions';
}
/**
 * Where the trip's journey stands: the newest outline, and per trip date the newest versions received since that outline was
 * chosen (since it arrived while it is not chosen yet; any time for a short trip).
 * → { trip, dates, mode, outline, since, days: [{ date, rec }], have, missing: [date] }
 */
function tgJyState(slug) {
  var trip = tgTripGet(slug), dates = tgJyTripDates(trip), mode = tgJyMode(slug), outline = tgJyOutlines(slug)[0] || null;
  var since = mode === 'outline' && outline ? (outline.choice ? outline.chosen_at : outline.received_at) : '';
  var all = tgJyVersionsAll(slug);
  var days = dates.map(function (d) { return { date: d, rec: all.filter(function (v) { return v.date === d && v.received_at >= since; })[0] || null }; });
  return { trip: trip, dates: dates, mode: mode, outline: outline, since: since, days: days,
    have: days.filter(function (x) { return x.rec; }).length, missing: days.filter(function (x) { return !x.rec; }).map(function (x) { return x.date; }) };
}
/** The current versions of one date (as tgJyState counts them), or null. */
function tgJyCurrent(slug, date) { return tgJyState(slug).days.filter(function (x) { return x.date === date; }).map(function (x) { return x.rec; })[0] || null; }

/* ---- the requests ---- */
/** Picks, later and skip over every shortlist run of the trip (the no-flow path). */
function tgJyTapsAll(slug) { return tgPlanTaps({ trip: slug, runs: tgShortlistRuns(slug) }); }
function tgJyAskBase(slug, taps) {
  return { trip: slug, dates: tgJyTripDates(tgTripGet(slug)), picks: taps.picks.slice(), later: taps.later.slice(), skip: taps.skip.slice() };
}
function tgJyOutlineRef(rec) {
  var o = { build_id: rec.build_id, base: rec.choice.base };
  if (rec.choice.mix) o.mix = rec.choice.mix;
  return o;
}
/** Request kind `outline` { trip, dates, picks, later, skip }. */
function tgJyAskOutline(slug, taps) {
  return tgOpenKindRequest('outline', tgJyAskBase(slug, taps), { text: 'outline · ' + slug + ' (' + taps.picks.length + ' picks)' });
}
/** Request kind `day_versions` { trip, dates, picks, later, skip, outline? }: every trip date, one envelope per date back. */
function tgJyAskVersions(slug, taps, outline) {
  var payload = tgJyAskBase(slug, taps);
  if (outline && outline.choice) payload.outline = tgJyOutlineRef(outline);
  return tgOpenKindRequest('day_versions', payload, { text: 'day versions · ' + slug + ' (' + payload.dates.length + ' days)' });
}
/** The plan request as before, plus the chosen outline and the version chosen for each date that has versions. */
function tgJyPlanPayload(slug, taps, st) {
  st = st || tgJyState(slug);
  var payload = { trip: slug, picks: taps.picks.slice(), later: taps.later.slice(), skip: taps.skip.slice(), deliverables: ['plan', 'notes', 'brochure'] };
  if (st.mode === 'outline' && st.outline && st.outline.choice) payload.outline = tgJyOutlineRef(st.outline);
  var v = st.days.filter(function (x) { return x.rec; }).map(function (x) { return { date: x.date, build_id: x.rec.build_id, key: x.rec.key }; });
  if (v.length) payload.versions = v;
  return payload;
}
function tgJyAskPlan(slug, taps, st) {
  var payload = tgJyPlanPayload(slug, taps, st);
  return { req: tgOpenKindRequest('plan', payload, { text: 'plan · ' + slug + ' (' + taps.picks.length + ' picks, ' + (payload.versions || []).length + ' days chosen)' }), payload: payload };
}
/** /versions on a planned day: the replan for that date carrying the alternative the owner chose. */
function tgJyAskReplace(trip, rec, key) {
  var v = rec.payload.versions.filter(function (x) { return x.key === key; })[0];
  return tgOpenKindRequest('replan', { trip: trip.slug, dates: [rec.date], deliverables: tgCmdDeliverables(trip),
    reason: truncate('owner chose version ' + key + ' (' + v.title + ') of this day', 300), alternative: { date: rec.date, build_id: rec.build_id, key: key } },
  { text: 'replace ' + rec.date + ' with version ' + key, ack: '🔁 Replacing ' + tgCmdDate(rec.date) + ' with version ' + key + ' — <b>' + tgEscape(v.title) + '</b>…' });
}

/* ==================== messages ==================== */

function tgJyTitle(slug) { var t = tgTripGet(slug); return t ? tgCmdTitle(t) : tgEscape(slug); }
function tgJyMmdd(date) { return String(date || '').slice(5, 7) + String(date || '').slice(8, 10); }
function tgJyDirectRow(slug, label) { return [{ text: label || '⏩ Plan straight away', data: cbEncode('ol', tgCmdTripKey(slug), 'd') }]; }
/** "day 3 from B, day 5 from C" for a mix over the outline's dates. */
function tgJyMixWords(rec, mix) {
  return Object.keys(mix || {}).map(function (d) { return 'day ' + (rec.dates.indexOf(d) + 1) + ' from ' + mix[d]; }).join(', ');
}
function tgJyChoiceLine(rec) {
  if (!rec.choice) return '';
  var w = tgJyMixWords(rec, rec.choice.mix);
  return 'Chosen: <b>' + tgEscape(rec.choice.base) + '</b>' + (w ? ' · ' + tgEscape(w) : '');
}
/** One cell of the day-by-day grid: "● Old harbour" (no area: the kind in words). */
function tgJyCell(d) { return (TG_JY_ICON[d.kind] || '•') + ' ' + tgEscape(d.area ? d.area : TG_JY_WORD[d.kind] || d.kind); }
/**
 * The outlines side by side: per option its title, ➕ gains and ➖ gives up; then one line per date with each option's kind
 * and area ("all …" when every option agrees); ✅ A · B · C, 📱 Mix in the app, ⏩ Plan straight away.
 * One option (a trip with only one shape): the same lines without "all"; chosen, it reads "taken as it is" with only the app
 * button (the versions or the build offer that follow carry ⏩); not chosen yet, ✅ A takes it.
 */
function tgJyOutlineMessages(rec) {
  var p = rec.payload, tk = tgCmdTripKey(rec.trip), tag = tgCmdTag(rec.build_id), opts = p.options, one = opts.length === 1;
  var lines = ['🧭 <b>' + tgJyTitle(rec.trip) + ' — ' + (one ? 'one way' : opts.length + ' ways') + ' to shape the trip</b> · ' + rec.dates.length + ' day' + (rec.dates.length === 1 ? '' : 's')];
  opts.forEach(function (o) {
    lines.push('', '<b>' + tgEscape(o.key) + ' · ' + tgEscape(o.title) + '</b>', '➕ ' + tgEscape(o.gains), '➖ ' + tgEscape(o.gives_up));
  });
  lines.push('', '<b>Day by day</b> <i>' + TG_JY_LEGEND + '</i>');
  rec.dates.forEach(function (date, i) {
    var cells = opts.map(function (o) { return o.days[i]; });
    var same = cells.every(function (c) { return c.kind === cells[0].kind && c.area === cells[0].area; });
    var row = one ? tgJyCell(cells[0]) : same ? 'all ' + tgJyCell(cells[0]) : opts.map(function (o, k) { return tgEscape(o.key) + ' ' + tgJyCell(cells[k]); }).join(' · ');
    lines.push('<b>' + (i + 1) + '</b> ' + tgCmdDate(date) + ' · ' + row);
  });
  if (p.notes) lines.push('', '<i>' + tgEscape(p.notes) + '</i>');
  if (one && rec.choice) {
    lines.push('', '✅ Taken as it is: only one way to shape these days came out.');
    return tgCmdMessages(lines, tgKeyboard(tgAppRows('compare', rec.trip, '📱 Open in the app')));
  }
  var chosen = tgJyChoiceLine(rec);
  if (chosen) lines.push('', chosen);
  lines.push('', one ? 'Only one way to shape these days came out: ✅ takes it, then the versions of each day follow.'
    : '✅ takes one outline as it is; <code>/outline ' + tgEscape(rec.keys[0]) + ' ' + (rec.dates.length > 1 ? '2' : '1') + tgEscape(rec.keys[1]) + '</code> takes a day from another; 📱 mixes day by day.');
  var pick = rec.keys.map(function (k) { return { text: (rec.choice && rec.choice.base === k ? '• ' : '') + '✅ ' + k, data: cbEncode('ol', tk, tag, k) }; });
  var rows = [pick].concat(tgAppRows('compare', rec.trip, one ? '📱 Open in the app' : '📱 Mix in the app'), [tgJyDirectRow(rec.trip)]);
  return tgCmdMessages(lines, tgKeyboard(rows));
}
/** "Day 2 of 5 · Thu 13 May" (the trip's dates; a date outside them: just the date). */
function tgJyDayHead(slug, date) {
  var dates = tgJyTripDates(tgTripGet(slug)), i = dates.indexOf(date);
  return (i >= 0 ? 'Day ' + (i + 1) + ' of ' + dates.length + ' · ' : '') + tgCmdDate(date);
}
function tgJyVersionLines(v, chosen) {
  var out = ['<b>' + tgEscape(v.key) + ' · ' + tgEscape(v.title) + '</b>' + (chosen ? ' ✅' : '') + (v.summary ? ' — ' + tgEscape(v.summary) : '')];
  if (v.stops.length) out.push('   ' + v.stops.map(function (s) { return (s.time ? tgEscape(s.time) + ' ' : '') + tgEscape(s.name); }).join(' · '));
  else out.push('   <i>No stops: a free day.</i>');
  out.push('   🚶 ' + tgCmdDaySpan(v.walk_minutes) + ' · 🚆 ' + tgCmdDaySpan(v.transit_minutes) + ' · spare ' + (v.spare_minutes ? tgCmdDaySpan(v.spare_minutes) : 'none'));
  if (v.bookings.length) out.push('   🎟 ' + v.bookings.map(tgEscape).join('; '));
  if (v.leaves_out.length) out.push('   <i>Leaves out: ' + v.leaves_out.map(function (l) { return tgEscape(l.name); }).join(', ') + '</i>');
  v.warnings.forEach(function (w) { out.push('   ⚠️ ' + tgEscape(w)); });
  return out;
}
/**
 * One day's versions: a summary per version and a button each (dv:<trip key>:<tag>:<mmdd>:<key>, the chosen one marked "• ").
 * opts.replace (a planned day, /versions): the buttons replace the day instead (…:r<key>).
 * A day with one way to go (one version): its summary and no buttons — there is nothing to choose or swap in.
 */
function tgJyVersionsMessages(rec, opts) {
  opts = opts || {};
  var vs = rec.payload.versions, tk = tgCmdTripKey(rec.trip), tag = tgCmdTag(rec.build_id), md = tgJyMmdd(rec.date);
  if (vs.length === 1) {
    var one = ['🔀 <b>' + tgJyDayHead(rec.trip, rec.date) + '</b> — one way to go, nothing to choose', ''].concat(tgJyVersionLines(vs[0], false));
    return tgCmdMessages(one);
  }
  var lines = ['🔀 <b>' + tgJyDayHead(rec.trip, rec.date) + '</b> — ' + vs.length + ' versions' + (opts.replace ? ' · this day is planned with ' + tgEscape(rec.key) : '')];
  vs.forEach(function (v) { lines.push(''); tgJyVersionLines(v, v.key === rec.key).forEach(function (l) { lines.push(l); }); });
  var rows = vs.map(function (v) {
    var label = opts.replace ? '🔁 Use ' + v.key + ' · ' + truncate(v.title, 28) : (v.key === rec.key ? '• ' : '') + v.key + ' · ' + truncate(v.title, 32);
    return [{ text: label, data: cbEncode('dv', tk, tag, md, (opts.replace ? 'r' : '') + v.key) }];
  });
  return tgCmdMessages(lines, tgKeyboard(rows));
}
/** "Build my plan", once every trip date has versions (or offered early by /versions with what is there). */
function tgJyBuildMessages(slug, st) {
  st = st || tgJyState(slug);
  var lines = ['🧱 <b>' + tgJyTitle(slug) + '</b> — ' + (st.missing.length ? st.have + ' of ' + st.dates.length + ' days have versions.' : 'every day has its versions.'),
    'Change any choice above (a day you leave keeps the one marked •), then build. One brochure follows.'];
  if (st.missing.length) lines.push('<i>Days without versions are planned freely.</i>');
  var rows = [[{ text: '🧱 Build my plan', data: cbEncode('dv', tgCmdTripKey(slug), 'b') }]].concat(tgAppRows('compare', slug, '📱 Compare in the app'));
  return tgCmdMessages(lines, tgKeyboard(rows));
}
/** The wait while the brain drafts outlines or versions, with ⏩ Plan straight away (a paused flow takes no fl: buttons). */
function tgJyWaitMessages(slug, what, note) {
  var t = what === 'outline' ? '🧭 Sketching two or three outlines of the whole trip — you compare them before any day is planned.'
    : '🔀 Drafting two or three versions of each day — you pick one per day, then build.';
  return [{ html: (note ? note + '\n' : '') + t, keyboard: tgKeyboard([tgJyDirectRow(slug, '⏩ Plan straight away instead')]) }];
}

/* ==================== actions (the chat, the flow and the app share them) ==================== */

var TG_JY_STAGES = ['outline', 'versions'];
/** Why an action was refused, in the owner's words (toasts, replies; the app maps the reason itself). */
var TG_JY_WHY = {
  bad_base: 'Pick one of the outlines shown.', bad_mix: 'That mix does not fit the outline.', bad_date: 'That day is not in the outline.',
  no_picks: 'Tap ✅ on at least one place first.', no_outline: 'That outline is gone — send /outline.', no_versions: 'No day versions yet.',
  stale: 'That list was replaced — send /versions for the newest.', bad_key: 'That version is not on the list.',
  not_planned: 'That day is not planned yet — choose a version, then 🧱 Build my plan.', planning: 'The plan is being built — /repick changes the picks.',
  flow_stage: 'That is from an earlier round — send /plan to see where you are.', busy: 'Finish or /cancel the other conversation first.',
  no_shortlist: 'There is no shortlist to plan from.', no_chat: 'The chat is not paired yet.', off: TG_JY_OFF
};
function tgJyWhy(r) { return TG_JY_WHY[r && r.why] || 'That did not work — send /plan to see where you are.'; }
/** The plan flow of this trip (at one of the given stages), or null. */
function tgJyFlow(slug, stages) {
  var chat = tgOwnerChat(), f = chat ? tgPlanActive(chat) : null;
  return f && f.state.trip === slug && (!stages || stages.indexOf(f.state.stage) >= 0) ? f : null;
}
/**
 * Store a checked choice and ask for the day versions; tells the owner (show: the chosen outline first — an outline taken as
 * it is because it has one option). → { ok, rec, req } | { ok: false, why }
 */
function tgJyChooseNow(rec, choice, taps, show) {
  var n = tgJyChoiceNorm(rec, choice);
  if (!n.ok) return n;
  if (!taps.picks.length) return { ok: false, why: 'no_picks' };
  var chosen = tgJySetChoice(rec, n.choice), req = tgJyAskVersions(rec.trip, taps, chosen), chat = tgOwnerChat();
  if (chat) tgCmdSendAll(chat, show ? tgJyOutlineMessages(chosen).concat(tgJyWaitMessages(rec.trip, 'versions'))
    : tgJyWaitMessages(rec.trip, 'versions', '✅ ' + tgJyChoiceLine(chosen).replace(/^Chosen: /, 'Outline ') + '.'));
  return { ok: true, rec: chosen, req: req };
}
/**
 * A choice from a button, /outline or the app: through the trip's plan flow while it is at outline or versions (the flow
 * moves to versions), else directly with the taps of every shortlist run. → { ok, request_id, via } | { ok: false, why }
 */
function tgJyDoChoose(slug, build, choice) {
  if (!tgJyOn()) return { ok: false, why: 'off' };
  var rec = tgJyOutlineGet(slug, build);
  if (!rec) return { ok: false, why: 'no_outline' };
  var n = tgJyChoiceNorm(rec, choice);
  if (!n.ok) return n;
  var f = tgJyFlow(slug);
  if (f && TG_JY_STAGES.indexOf(f.state.stage) < 0) return { ok: false, why: f.state.stage === 'planning' ? 'planning' : 'flow_stage', stage: f.state.stage };
  if (f) {
    var before = f.state.jy ? f.state.jy.vreq : null;
    flowResume(tgOwnerChat(), { type: 'resume', event: 'jy_choose', build: build, choice: n.choice });
    var a = tgJyFlow(slug), id = a && a.state.jy ? a.state.jy.vreq : null;
    return id && id !== before ? { ok: true, request_id: id, via: 'flow' } : { ok: false, why: 'no_picks' };
  }
  var r = tgJyChooseNow(rec, n.choice, tgJyTapsAll(slug));
  return r.ok ? { ok: true, request_id: r.req.id, via: 'direct' } : r;
}
/** Choose one version of a date (the current set only). → { ok, rec } | { ok: false, why } */
function tgJyDoPick(slug, build, date, key) {
  if (!tgJyOn()) return { ok: false, why: 'off' };
  var rec = tgJyVersionsGet(slug, build, date);
  if (!rec) return { ok: false, why: 'no_versions' };
  if (rec.keys.indexOf(key) < 0) return { ok: false, why: 'bad_key' };
  var cur = tgJyCurrent(slug, date);
  if (!cur || cur.build_id !== build) return { ok: false, why: 'stale' };
  return { ok: true, rec: tgJySetVersion(rec, key) };
}
/** A planned day replaced by one of its stored versions: the pick is stored and a replan for that date opened. */
function tgJyDoReplace(slug, build, date, key) {
  if (!tgJyOn()) return { ok: false, why: 'off' };
  var trip = tgTripGet(slug), rec = tgJyVersionsGet(slug, build, date);
  if (!trip || !rec) return { ok: false, why: 'no_versions' };
  if (rec.keys.indexOf(key) < 0) return { ok: false, why: 'bad_key' };
  if (!tgDigestDay(slug, date)) return { ok: false, why: 'not_planned' };
  var req = tgJyAskReplace(trip, tgJySetVersion(rec, key), key);
  return { ok: true, request_id: req.id };
}
/** 🧱 Build my plan: through the plan flow at versions, else directly. → { ok, request_id, via, missing } | { ok: false, why } */
function tgJyDoBuild(slug) {
  if (!tgJyOn()) return { ok: false, why: 'off' };
  var st = tgJyState(slug);
  if (!st.have) return { ok: false, why: 'no_versions' };
  var f = tgJyFlow(slug);
  if (f && f.state.stage !== 'versions') return { ok: false, why: f.state.stage === 'planning' ? 'planning' : 'flow_stage', stage: f.state.stage };
  if (f) {
    flowResume(tgOwnerChat(), { type: 'resume', event: 'jy_build' });
    var a = tgJyFlow(slug, ['planning']);
    return a && a.state.plan_req ? { ok: true, request_id: a.state.plan_req, via: 'flow', missing: st.missing.length } : { ok: false, why: 'no_picks' };
  }
  var taps = tgJyTapsAll(slug);
  if (!taps.picks.length) return { ok: false, why: 'no_picks' };
  var r = tgJyAskPlan(slug, taps, st), chat = tgOwnerChat();
  if (chat) tgSend(chat, tgJyBuildingLine(taps, r.payload));
  return { ok: true, request_id: r.req.id, via: 'direct', missing: st.missing.length };
}
function tgJyBuildingLine(taps, payload) {
  var n = (payload.versions || []).length, k = taps.picks.length;
  return '🧭 Building the days from ' + k + ' pick' + (k === 1 ? '' : 's') + (n ? ' and the version you chose for ' + n + ' day' + (n === 1 ? '' : 's') : '') +
    '… One brochure follows. /repick changes the picks.';
}
/** ⏩ Plan straight away: the plan request exactly as before (the flow's direct path; no flow → the adopt path, then direct). */
function tgJyDoDirect(slug) {
  var chat = tgOwnerChat();
  if (!chat) return { ok: false, why: 'no_chat' };
  var f = tgJyFlow(slug);
  if (f && ['choose', 'outline', 'versions'].indexOf(f.state.stage) < 0) return { ok: false, why: f.state.stage === 'planning' ? 'planning' : 'flow_stage' };
  if (f) flowResume(chat, { type: 'resume', event: 'jy_direct' });
  else {
    var other = flowActive(chat), runs = tgShortlistRuns(slug);
    if (other) return { ok: false, why: 'busy', flow: other.flow };
    if (!runs.length) return { ok: false, why: 'no_shortlist' };
    flowStart(chat, 'plan', { adopt: { trip: slug, runs: runs, more: false, direct: true } });
  }
  var a = tgJyFlow(slug, ['planning']);
  return a && a.state.plan_req ? { ok: true, request_id: a.state.plan_req } : { ok: false, why: 'no_picks' };
}

/* ==================== the plan flow's journey stages (called from 12_flow_plan.js) ==================== */

/**
 * state.jy while the flow is at outline or versions: { mode, req (the first request), vreq (the day_versions request), at }.
 * Both stages are paused steps with no prompt: the pack sends its own messages and buttons (ol:, dv:), which work while the
 * flow is paused; the free text a paused flow does not claim goes to the commands (/outline A 2B, /versions …).
 */
function tgJyPause(state, msgs) {
  var chat = tgOwnerChat();
  if (chat && msgs && msgs.length) tgCmdSendAll(chat, msgs);
  return { prompt: '', pause: true, state: state };
}
function tgJyNote(html) { return [{ html: html }]; }
/** ✅ Done choosing on a trip with a journey (tgJyMode): ask for outlines or day versions instead of the plan. */
function tgJyStart(state) {
  var taps = tgPlanTaps(state), mode = tgJyMode(state.trip);
  if (!taps.picks.length) return tgPlanChooseStep(state, 'Tap ✅ on at least one place first.');
  if (!mode) return tgPlanBuild(state);
  var r = mode === 'outline' ? tgJyAskOutline(state.trip, taps) : tgJyAskVersions(state.trip, taps, null);
  state.stage = mode;
  state.jy = { mode: mode, req: r.id, vreq: mode === 'versions' ? r.id : null, at: nowIso() };
  return tgJyPause(state, tgJyWaitMessages(state.trip, mode));
}
/** Leaving the journey (⏩ Plan straight away, /repick): its open requests count as dropped (their answers show as old). */
function tgJyDrop(state) {
  if (!state.jy) return state;
  var ids = [state.jy.req, state.jy.vreq].filter(function (x, i, a) { return x && a.indexOf(x) === i; });
  state.dropped = (state.dropped || []).concat(ids).slice(-5);
  state.jy = null;
  return state;
}
function tgJyDropped(state, input) { return !!input.in_reply_to && (state.dropped || []).indexOf(input.in_reply_to) >= 0; }
/** An outline chosen: the flow moves to versions (an earlier day_versions request counts as dropped). */
function tgJyToVersions(state, vreq) {
  var prev = state.jy && state.jy.vreq;
  if (prev) state.dropped = (state.dropped || []).concat([prev]).slice(-5);
  state.jy = { mode: 'outline', req: state.jy ? state.jy.req : null, vreq: vreq, at: state.jy ? state.jy.at : nowIso() };
  state.stage = 'versions';
  return tgJyPause(state, []);
}
/** One outline while the flow waits for outlines: nothing to compare, so it is taken as it is and the versions asked for. */
function tgJyTakeOnly(state, rec) {
  var c = tgJyChooseNow(rec, { base: rec.keys[0] }, tgPlanTaps(state), true);
  return c.ok ? tgJyToVersions(state, c.req.id) : tgJyPause(state, tgJyOutlineMessages(rec));
}
/** The flow's journey events; null when the event is not one of them (12_flow_plan.js goes on as before). */
function tgJyFlowEvent(state, input) {
  var p = input.payload || {}, inJy = TG_JY_STAGES.indexOf(state.stage) >= 0;
  if (input.event === 'outline') {
    var rec = p.build_id ? tgJyOutlineGet(state.trip, p.build_id) : null;
    if (inJy && rec && !tgJyDropped(state, input)) {
      if (state.stage === 'outline' && rec.keys.length === 1) return tgJyTakeOnly(state, rec);
      return tgJyPause(state, tgJyOutlineMessages(rec));
    }
    return tgPlanSame(state, '🧭 Outlines of the trip came in — /outline shows them.');
  }
  if (input.event === 'day_versions') {
    var vr = p.build_id && p.date ? tgJyVersionsGet(state.trip, p.build_id, p.date) : null;
    if (state.stage === 'versions' && vr && !tgJyDropped(state, input)) {
      var cur = tgJyCurrent(state.trip, vr.date);
      if (!cur || cur.build_id !== vr.build_id) return tgJyPause(state, tgJyNote('<i>Versions of ' + tgCmdDate(vr.date) + ' from an earlier outline came in — /versions ' + vr.date + ' shows the newest.</i>'));
      var msgs = tgJyVersionsMessages(vr), st = tgJyState(state.trip);
      if (!st.missing.length) msgs = msgs.concat(tgJyBuildMessages(state.trip, st));
      return tgJyPause(state, msgs);
    }
    return tgPlanSame(state, '🔀 Versions of a day came in — /versions shows them.');
  }
  if (input.event === 'jy_choose') {
    if (!inJy) return tgPlanSame(state);
    var o = tgJyOutlineGet(state.trip, input.build);
    if (!o) return tgJyPause(state, tgJyNote(TG_JY_WHY.no_outline));
    var c = tgJyChooseNow(o, input.choice, tgPlanTaps(state));
    if (!c.ok) return tgJyPause(state, tgJyNote(tgJyWhy(c)));
    return tgJyToVersions(state, c.req.id);
  }
  if (input.event === 'jy_build') {
    if (state.stage !== 'versions') return tgPlanSame(state);
    var s = tgJyState(state.trip), taps = tgPlanTaps(state);
    if (!s.have) return tgJyPause(state, tgJyNote(TG_JY_WHY.no_versions));
    if (!taps.picks.length) { tgJyDrop(state); return tgPlanChooseStep(state, 'Tap ✅ on at least one place first.'); }
    var b = tgJyAskPlan(state.trip, taps, s);
    state.plan_req = b.req.id;
    if (state.jy) state.jy.built = true;
    state.stage = 'planning';
    return tgPlanWait(state, tgJyBuildingLine(taps, b.payload));
  }
  if (input.event === 'jy_direct') {
    if (state.stage !== 'choose' && !inJy) return tgPlanSame(state);
    tgJyDrop(state);
    return tgPlanBuild(state);
  }
  return null;
}
/** Re-show where the journey is (/plan again, an unknown event): the outlines or the wait; the build offer or the wait. */
function tgJySame(state, note) {
  var lead = note ? tgJyNote(note) : [];
  var since = state.jy && state.jy.at ? state.jy.at : '';
  if (state.stage === 'outline') {
    var rec = tgJyOutlines(state.trip)[0];
    return tgJyPause(state, lead.concat(rec && rec.received_at >= since ? tgJyOutlineMessages(rec) : tgJyWaitMessages(state.trip, 'outline')));
  }
  var st = tgJyState(state.trip);
  return tgJyPause(state, lead.concat(st.have ? tgJyBuildMessages(state.trip, st) : tgJyWaitMessages(state.trip, 'versions')));
}

/* ==================== buttons, commands, envelopes ==================== */

/** A trip date from a word: an ISO date of the trip, "day N" / N, today, tomorrow; '' otherwise. */
function tgJyDateWord(trip, word) {
  var dates = tgJyTripDates(trip), w = String(word || '').trim().toLowerCase().replace(/^day\s*/, '');
  if (w === 'today') w = tgTripToday(trip);
  else if (w === 'tomorrow') w = isoDateAdd(tgTripToday(trip), 1);
  if (/^\d{1,2}$/.test(w)) return dates[parseInt(w, 10) - 1] || '';
  return dates.indexOf(w) >= 0 ? w : '';
}
/**
 * "/outline A", "/outline b 3c 2031-05-14=a" → { base, mix } against an outline (day N = the outline's Nth date);
 * null when the text does not parse.
 */
function tgJyParseChoice(rec, text) {
  var t = String(text || '').trim().split(/[\s,]+/).filter(Boolean);
  if (!t.length || !/^[abc]$/i.test(t[0])) return null;
  var out = { base: t[0].toUpperCase(), mix: {} };
  for (var i = 1; i < t.length; i++) {
    var m = /^(?:day)?(\d{1,2})[:=]?([abc])$/i.exec(t[i]), d = /^(\d{4}-\d{2}-\d{2})[:=]?([abc])$/i.exec(t[i]);
    if (m) { var date = rec.dates[parseInt(m[1], 10) - 1]; if (!date) return null; out.mix[date] = m[2].toUpperCase(); }
    else if (d) out.mix[d[1]] = d[2].toUpperCase();
    else return null;
  }
  return out;
}
/** A planned day shows its versions as replacements unless the trip's plan flow is choosing versions right now. */
function tgJyReplaceMode(slug, date) { return !!tgDigestDay(slug, date) && !tgJyFlow(slug, TG_JY_STAGES); }
/** The versions /versions and the renderer show for a date: the current set, else the newest stored. */
function tgJyShownVersions(slug, date) {
  return tgJyCurrent(slug, date) || tgJyVersionsAll(slug).filter(function (v) { return v.date === date; })[0] || null;
}
function tgJyVersionsByButton(slug, tag, mmdd) {
  return tgJyVersionsAll(slug).filter(function (v) { return tgCmdTag(v.build_id) === tag && tgJyMmdd(v.date) === mmdd; })[0] || null;
}

// ol:<trip key>:<tag>:<A|B|C> — take that outline as it is; ol:<trip key>:d — plan straight away (no outlines or versions).
registerCallback('ol', function (ctx) {
  var trip = tgCmdTripByKey(ctx.parts[0]), p = ctx.parts;
  if (!trip) { ctx.answer('That trip is gone.'); return; }
  if (p.length === 2 && p[1] === 'd') {
    var d = tgJyDoDirect(trip.slug);
    ctx.answer(d.ok ? '⏩ Planning straight away' : tgJyWhy(d), !d.ok);
    return;
  }
  if (p.length !== 3 || !/^[0-9a-f]{4}$/.test(p[1]) || TG_JY.KEYS.indexOf(p[2]) < 0) { ctx.answer('Unknown button'); return; }
  var rec = tgJyOutlineByTag(trip.slug, p[1]);
  if (!rec) { ctx.answer(TG_JY_WHY.no_outline); return; }
  var r = tgJyDoChoose(trip.slug, rec.build_id, { base: p[2] });
  if (!r.ok) { ctx.answer(tgJyWhy(r), true); return; }
  ctx.answer('✅ Outline ' + p[2]);
  tgCmdRemark(ctx, 'ol', function (q) { return q[1] === p[1] && q[2] === p[2]; });
});

// dv:<trip key>:<tag>:<mmdd>:<key> — choose a version of a day; …:r<key> — replace a planned day; dv:<trip key>:b — build.
registerCallback('dv', function (ctx) {
  var trip = tgCmdTripByKey(ctx.parts[0]), p = ctx.parts;
  if (!trip) { ctx.answer('That trip is gone.'); return; }
  if (p.length === 2 && p[1] === 'b') {
    var b = tgJyDoBuild(trip.slug);
    ctx.answer(b.ok ? '🧱 Building your plan' : tgJyWhy(b), !b.ok);
    return;
  }
  var m = p.length === 4 ? /^(r?)([ABC])$/.exec(p[3]) : null;
  if (!m || !/^[0-9a-f]{4}$/.test(p[1]) || !/^\d{4}$/.test(p[2])) { ctx.answer('Unknown button'); return; }
  var rec = tgJyVersionsByButton(trip.slug, p[1], p[2]);
  if (!rec) { ctx.answer(TG_JY_WHY.no_versions); return; }
  var r = m[1] ? tgJyDoReplace(trip.slug, rec.build_id, rec.date, m[2]) : tgJyDoPick(trip.slug, rec.build_id, rec.date, m[2]);
  if (!r.ok) { ctx.answer(tgJyWhy(r), true); return; }
  var v = rec.payload.versions.filter(function (x) { return x.key === m[2]; })[0];
  ctx.answer((m[1] ? '🔁 Replacing with ' : '✅ ') + m[2] + ' — ' + truncate(v.title, 60));
  if (!m[1]) tgCmdRemark(ctx, 'dv', function (q) { return q[1] === p[1] && q[2] === p[2] && q[3] === m[2]; });
});

registerCommand('/outline', function (ctx) {
  if (!tgJyOn()) { ctx.reply(TG_JY_OFF); return null; }
  var trip = tgCmdCurrent(ctx);
  if (!trip) return null;
  var rec = tgJyOutlines(trip.slug)[0], args = String(ctx.args || '').trim();
  if (!rec) {
    ctx.reply(tgJyMode(trip.slug) === 'outline' ? 'No outlines for <b>' + tgCmdTitle(trip) + '</b> yet — they come after ✅ Done choosing in /plan.'
      : 'No outlines for <b>' + tgCmdTitle(trip) + '</b> — outlines are for dated trips of ' + TG_JY.OUTLINE_MIN_DAYS + ' days or more.');
    return null;
  }
  if (!args) { tgCmdSendAll(ctx.chatId, tgJyOutlineMessages(rec)); return null; }
  var choice = tgJyParseChoice(rec, args);
  if (!choice) {
    ctx.reply(rec.keys.length === 1 ? 'Send <code>/outline ' + tgEscape(rec.keys[0]) + '</code> to take the outline as it is.'
      : 'Send <code>/outline ' + tgEscape(rec.keys[0]) + '</code> to take an outline as it is, or <code>/outline ' + tgEscape(rec.keys[0]) + ' 2' + tgEscape(rec.keys[1]) + '</code> to take day 2 from ' + tgEscape(rec.keys[1]) + '.');
    return null;
  }
  var r = tgJyDoChoose(trip.slug, rec.build_id, choice);
  if (!r.ok) ctx.reply(tgEscape(tgJyWhy(r)));
  return null;
}, 'compare the outlines of the trip; /outline A or /outline A 3B chooses (day 3 from B)');

registerCommand('/versions', function (ctx) {
  if (!tgJyOn()) { ctx.reply(TG_JY_OFF); return null; }
  var trip = tgCmdCurrent(ctx);
  if (!trip) return null;
  var args = String(ctx.args || '').trim(), dates = tgJyTripDates(trip);
  var have = dates.map(function (d) { return { date: d, rec: tgJyShownVersions(trip.slug, d) }; }).filter(function (x) { return x.rec; });
  if (!have.length) { ctx.reply('No day versions for <b>' + tgCmdTitle(trip) + '</b> yet.'); return null; }
  if (!args) {
    var lines = ['🔀 <b>' + tgCmdTitle(trip) + '</b> — days with versions:'];
    have.forEach(function (x) {
      var v = x.rec.payload.versions.filter(function (y) { return y.key === x.rec.key; })[0];
      var n = x.rec.keys.length;
      lines.push('<b>' + (dates.indexOf(x.date) + 1) + '</b> ' + tgCmdDate(x.date) + ' · ' + (n === 1 ? 'one way to go' : n + ' versions · ' + tgEscape(x.rec.key)) + ' — ' + tgEscape(truncate(v.title, 60)) + (tgDigestDay(trip.slug, x.date) ? ' · planned' : ''));
    });
    lines.push('', 'Send <code>/versions ' + (dates.indexOf(have[0].date) + 1) + '</code> (a day number or a date) to see them.');
    tgCmdSendAll(ctx.chatId, tgCmdMessages(lines));
    return null;
  }
  var date = tgJyDateWord(trip, args), rec = date ? tgJyShownVersions(trip.slug, date) : null;
  if (!date) { ctx.reply('Send <code>/versions</code> with a day number, a date of the trip, today or tomorrow.'); return null; }
  if (!rec) { ctx.reply('No versions of ' + tgCmdDate(date) + ' yet.'); return null; }
  tgCmdSendAll(ctx.chatId, tgJyVersionsMessages(rec, { replace: tgJyReplaceMode(trip.slug, date) }));
  return null;
}, "a day's versions: /versions 2 (or a date); on a planned day a version replaces it");

// /journey on|off — the owner's switch (like /smart): off until the private routine has its Phase 11 update.
registerCommand('/journey', function (ctx) {
  var arg = String(ctx.argv && ctx.argv[0] || '').toLowerCase();
  if (arg === 'on' || arg === 'off') {
    settingSet(TG_JY.SETTING, arg, 'owner /journey');
    audit('tg_journey', arg, {});
    ctx.reply(arg === 'on'
      ? '🧭 Outlines and day versions on: ✅ Done choosing on a dated trip now asks for outlines (3 days or more) or versions of each day first. ' +
        'This needs the private routine\'s Phase 11 update — without it the request waits; ⏩ Plan straight away still plans as before. /journey off to switch back.'
      : '⏩ Outlines and day versions off: ✅ Done choosing plans straight away, as before. /journey on to switch back.');
    return null;
  }
  if (arg) { ctx.reply('Usage: /journey on · /journey off · /journey (show the mode)'); return null; }
  ctx.reply((tgJyOn() ? 'Outlines and day versions: on' : 'Outlines and day versions: off (plans go straight out)') + '\n/journey on · /journey off');
  return null;
}, 'outlines and day versions before the plan on/off: /journey on|off');

if (ENVELOPE_TYPES.indexOf('outline') >= 0) {
  registerEnvelopeHandler('outline', {
    validate: function (p, env) { return tgEnvCleaned(tgEnvValidateOutline)(p, env); },
    handle: function (env) {
      var p = env.payload;
      tgTripUpsert({ slug: p.trip });
      var st = tgJyStoreOutline(p);
      var to = tgEnvDeliver('outline', env, p.options.length === 1 ? '🧭 One outline of <b>' + tgEscape(p.trip) + '</b> — send /outline to see it.'
        : '🧭 ' + p.options.length + ' outlines of <b>' + tgEscape(p.trip) + '</b> — send /outline to compare them.');
      return { trip: p.trip, build_id: p.build_id, options: p.options.length, days: st.rec ? st.rec.dates.length : 0, replaced: st.replaced, to: to };
    }
  });
}
if (ENVELOPE_TYPES.indexOf('day_versions') >= 0) {
  registerEnvelopeHandler('day_versions', {
    validate: function (p, env) { return tgEnvCleaned(tgEnvValidateDayVersions)(p, env); },
    handle: function (env) {
      var p = env.payload;
      tgTripUpsert({ slug: p.trip });
      var st = tgJyStoreVersions(p);
      var to = tgEnvDeliver('day_versions', env, '🔀 ' + (p.versions.length === 1 ? 'One way to go on ' : p.versions.length + ' versions of ') + tgEscape(p.date) + ' for <b>' + tgEscape(p.trip) + '</b> — send /versions ' + tgEscape(p.date) + '.');
      return { trip: p.trip, build_id: p.build_id, date: p.date, versions: p.versions.length, replaced: st.replaced, to: to };
    }
  });
}
// Envelopes that arrive with no plan flow of their trip.
registerRenderer('tg_outline', function (p) {
  var rec = tgJyOutlineGet(p.trip, p.build_id);
  return { messages: rec ? tgJyOutlineMessages(rec) : [] };
});
registerRenderer('tg_day_versions', function (p) {
  var rec = tgJyVersionsGet(p.trip, p.build_id, p.date);
  if (!rec) return { messages: [] };
  var replace = tgJyReplaceMode(p.trip, p.date), msgs = tgJyVersionsMessages(rec, { replace: replace });
  var cur = tgJyCurrent(p.trip, p.date), st = replace ? null : tgJyState(p.trip);
  if (st && cur && cur.build_id === rec.build_id && st.dates.length && !st.missing.length) msgs = msgs.concat(tgJyBuildMessages(p.trip, st));
  return { messages: msgs };
});

// Developed by: LightAISolutions
