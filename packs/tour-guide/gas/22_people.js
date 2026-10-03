/**
 * Tour Guide pack — the people the owner travels with and the trip facts the owner sets in the chat (Phase 8).
 *   tgPeopleList() → [{ slug, name, interviewed }]   (Settings tg_people, ≤ TG_PEOPLE_MAX; the owner is never in it)
 *   tgPeopleAdd(name) → { slug, name } | { error }   (a name already there returns that person)
 *   tgTripPeople(trip) → [slug] · tgTripPeopleSet(trip, slugs) → [slug]   (Settings tg_trip_people: who comes on which trip)
 *   tgTripHours(trip) → { day_start?, day_end? } · tgTripHoursSet(trip, start, end)   (Settings tg_trip_hours)
 *   tgTripUpdateOf(trip) → { start_date?, end_date?, day_start?, day_end?, travelers? } | null — what the owner set here,
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
function tgTripUpdateOf(trip) {
  var t = trip ? tgTripGet(trip) : null;
  if (!t) return null;
  var out = {}, h = tgTripHours(t.slug), ppl = tgTripPeople(t.slug), set = Array.isArray(_tgPeopleJson(TG_TRIP_PEOPLE_KEY, {})[t.slug]);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(t.start || ''))) { out.start_date = t.start; out.end_date = /^\d{4}-\d{2}-\d{2}$/.test(String(t.end || '')) ? t.end : t.start; }
  if (TG_HHMM_RE.test(String(h.day_start || '')) && TG_HHMM_RE.test(String(h.day_end || ''))) { out.day_start = h.day_start; out.day_end = h.day_end; }
  if (set) out.travelers = ppl.map(function (s) { var p = tgPerson(s); return { slug: s, name: p ? p.name : s }; });
  return Object.keys(out).length ? out : null;
}

// Developed by: LightAISolutions
