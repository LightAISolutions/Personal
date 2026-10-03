/**
 * Tour Guide pack — the people the owner travels with and the trip facts the owner sets in the chat (Phase 8).
 *   tgPeopleList() → [{ slug, name, interviewed }]   (Settings tg_people, ≤ TG_PEOPLE_MAX; the owner is never in it)
 *   tgPeopleAdd(name) → { slug, name } | { error }   (a name already there returns that person)
 *   tgTripPeople(trip) → [slug] · tgTripPeopleSet(trip, slugs) → [slug]   (Settings tg_trip_people: who comes on which trip)
 *   tgTripHours(trip) → { day_start?, day_end? } · tgTripHoursSet(trip, start, end)   (Settings tg_trip_hours)
 *   tgTripDays(trip) · tgTripDay(trip, date) · tgTripDaySet(trip, date, patch) · tgTripDayClear(trip, date)
 *     (Settings tg_trip_days: the /dates per-day forms — start, end, hours, bags; WP-11c)
 *   tgTripUpdateOf(trip) → { start_date?, end_date?, day_start?, day_end?, travelers?, day_overrides? } | null — what the owner set here,
 *     carried by every research / plan / replan request so the routine writes it into trips/<slug>.md before it works
 *     (the owner never needs a pull request to change a date). Names and slugs stay in the core and the private repo.
 */
var TG_PEOPLE_KEY = 'tg_people';
var TG_TRIP_PEOPLE_KEY = 'tg_trip_people';
var TG_TRIP_HOURS_KEY = 'tg_trip_hours';
var TG_PEOPLE_MAX = 8;
var TG_PERSON_NAME_MAX = 40;
var TG_PERSON_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
var TG_HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function _tgPeopleJson(key, def) {
  var p = safeJsonParse(settingGet(key, ''));
  return p.ok && p.value && typeof p.value === 'object' ? p.value : def;
}
function tgPeopleList() {
  var v = _tgPeopleJson(TG_PEOPLE_KEY, []);
  return (Array.isArray(v) ? v : []).filter(function (p) { return isPlainObject(p) && TG_PERSON_SLUG_RE.test(String(p.slug || '')); })
    .map(function (p) { return { slug: String(p.slug), name: String(p.name || p.slug), interviewed: String(p.interviewed || '') }; });
}
function tgPerson(slug) {
  var all = tgPeopleList();
  for (var i = 0; i < all.length; i++) if (all[i].slug === slug) return all[i];
  return null;
}
function _tgPeopleSave(list) { settingSet(TG_PEOPLE_KEY, toJson(list), 'people the owner travels with'); }
/** A plain display name: letters, spaces and . ' - only, folded whitespace, ≤ TG_PERSON_NAME_MAX. */
function tgPersonNameProblem(name) {
  var s = String(name || '').replace(/\s+/g, ' ').trim();
  if (!s) return 'empty';
  if (s.length > TG_PERSON_NAME_MAX) return 'too_long';
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(s)) return 'bad_name';
  return '';
}
function tgPeopleAdd(name) {
  var s = String(name || '').replace(/\s+/g, ' ').trim(), bad = tgPersonNameProblem(s);
  if (bad) return { error: bad };
  var list = tgPeopleList(), slug = tgSlug(s).slice(0, 40).replace(/-+$/, '');
  if (!slug || !TG_PERSON_SLUG_RE.test(slug)) return { error: 'bad_name' };
  for (var i = 0; i < list.length; i++) if (list[i].slug === slug) return { slug: slug, name: list[i].name };
  if (list.length >= TG_PEOPLE_MAX) return { error: 'too_many' };
  list.push({ slug: slug, name: s, interviewed: '' });
  _tgPeopleSave(list);
  return { slug: slug, name: s };
}
/** Stamp a person's last interview (the date the app sent it). */
function tgPersonInterviewed(slug) {
  var list = tgPeopleList();
  list.forEach(function (p) { if (p.slug === slug) p.interviewed = isoDateLocal(); });
  _tgPeopleSave(list);
}
function tgTripPeople(trip) {
  var all = _tgPeopleJson(TG_TRIP_PEOPLE_KEY, {}), known = tgPeopleList().map(function (p) { return p.slug; });
  var v = Array.isArray(all[trip]) ? all[trip] : [];
  return v.filter(function (s) { return known.indexOf(s) >= 0; });
}
function tgTripPeopleSet(trip, slugs) {
  var all = _tgPeopleJson(TG_TRIP_PEOPLE_KEY, {}), known = tgPeopleList().map(function (p) { return p.slug; }), out = [];
  (slugs || []).forEach(function (s) { if (known.indexOf(s) >= 0 && out.indexOf(s) < 0) out.push(s); });
  all[trip] = out;   // kept when empty: the next request then clears the trip file's travellers
  settingSet(TG_TRIP_PEOPLE_KEY, toJson(all), 'who comes on which trip');
  return out;
}
function tgTripHours(trip) {
  var h = _tgPeopleJson(TG_TRIP_HOURS_KEY, {})[trip];
  return isPlainObject(h) ? h : {};
}
function tgTripHoursSet(trip, start, end) {
  var all = _tgPeopleJson(TG_TRIP_HOURS_KEY, {});
  all[trip] = { day_start: start, day_end: end };
  settingSet(TG_TRIP_HOURS_KEY, toJson(all), 'day hours the owner set with /dates');
}
/**
 * Per-day settings (WP-11c, Contract C11) — Settings tg_trip_days: { <trip>: { <YYYY-MM-DD>: { start?: { text, time },
 * end?: { text, time }, day_start?, day_end?, bags?, bags_note? } } }. The place words are the owner's, kept as typed
 * (hidden characters stripped) and escaped wherever shown; the routine reads them through trip_update.day_overrides.
 */
var TG_TRIP_DAYS_KEY = 'tg_trip_days';
var TG_TRIP_BAGS = ['hotel', 'locker', 'forward', 'carry'];
var TG_TRIP_DAY_KEYS = ['start', 'end', 'day_start', 'day_end', 'bags', 'bags_note'];
var TG_TRIP_DAY_PLACE_MAX = 120;
var TG_TRIP_DAY_NOTE_MAX = 120;
function _tgTripDayClean(date, e) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isPlainObject(e)) return null;
  var o = { date: date };
  ['start', 'end'].forEach(function (k) {
    var a = e[k];
    if (isPlainObject(a) && typeof a.text === 'string' && a.text && TG_HHMM_RE.test(String(a.time || ''))) o[k] = { text: a.text, time: a.time };
  });
  if (TG_HHMM_RE.test(String(e.day_start || '')) && TG_HHMM_RE.test(String(e.day_end || ''))) { o.day_start = e.day_start; o.day_end = e.day_end; }
  if (TG_TRIP_BAGS.indexOf(e.bags) >= 0) { o.bags = e.bags; if (typeof e.bags_note === 'string' && e.bags_note) o.bags_note = e.bags_note; }
  return Object.keys(o).length > 1 ? o : null;
}
/** The trip's per-day settings in date order: [{ date, start?, end?, day_start?, day_end?, bags?, bags_note? }]. */
function tgTripDays(trip) {
  var m = _tgPeopleJson(TG_TRIP_DAYS_KEY, {})[trip];
  if (!isPlainObject(m)) return [];
  return Object.keys(m).sort().map(function (d) { return _tgTripDayClean(d, m[d]); }).filter(function (x) { return !!x; });
}
function tgTripDay(trip, date) { return tgTripDays(trip).filter(function (d) { return d.date === date; })[0] || null; }
/** Merge patch into one day (a null value removes that key); returns the day's settings after the change, or null when empty. */
function tgTripDaySet(trip, date, patch) {
  var all = _tgPeopleJson(TG_TRIP_DAYS_KEY, {});
  if (!isPlainObject(all[trip])) all[trip] = {};
  var cur = isPlainObject(all[trip][date]) ? all[trip][date] : {};
  Object.keys(patch || {}).forEach(function (k) {
    if (TG_TRIP_DAY_KEYS.indexOf(k) < 0) return;
    if (patch[k] === null) delete cur[k]; else cur[k] = patch[k];
  });
  var clean = _tgTripDayClean(date, cur);
  if (clean) { delete clean.date; all[trip][date] = clean; } else delete all[trip][date];
  settingSet(TG_TRIP_DAYS_KEY, toJson(all), 'per-day settings the owner set with /dates');
  return clean ? tgTripDay(trip, date) : null;
}
/** Remove one day's settings; true when there was something. The trip key stays (an empty map), so the next request
 *  carries day_overrides: [] and the routine clears the trip file too (the tg_trip_people rule). */
function tgTripDayClear(trip, date) {
  var all = _tgPeopleJson(TG_TRIP_DAYS_KEY, {});
  if (!isPlainObject(all[trip]) || !all[trip][date]) return false;
  delete all[trip][date];
  settingSet(TG_TRIP_DAYS_KEY, toJson(all), 'per-day settings the owner set with /dates');
  return true;
}
function tgTripUpdateOf(trip) {
  var t = trip ? tgTripGet(trip) : null;
  if (!t) return null;
  var out = {}, h = tgTripHours(t.slug), ppl = tgTripPeople(t.slug), set = Array.isArray(_tgPeopleJson(TG_TRIP_PEOPLE_KEY, {})[t.slug]);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(t.start || ''))) { out.start_date = t.start; out.end_date = /^\d{4}-\d{2}-\d{2}$/.test(String(t.end || '')) ? t.end : t.start; }
  if (TG_HHMM_RE.test(String(h.day_start || '')) && TG_HHMM_RE.test(String(h.day_end || ''))) { out.day_start = h.day_start; out.day_end = h.day_end; }
  if (set) out.travelers = ppl.map(function (s) { var p = tgPerson(s); return { slug: s, name: p ? p.name : s }; });
  if (isPlainObject(_tgPeopleJson(TG_TRIP_DAYS_KEY, {})[t.slug])) out.day_overrides = tgTripDays(t.slug);   // C11
  return Object.keys(out).length ? out : null;
}

// Developed by: LightAISolutions
