/**
 * Tour Guide Day trip in the app (TG-PHASE-15 WP-15a): the app ops behind the Day trips screen, added to TG_APP_OPS
 * (32_app_api.js) from this file — no hook needed, the table is read at request time (as 35_scout_app.js does).
 *   daytrip.list                          → the last 20 boards, head fields only, newest first, and the kept trips
 *                                           (`kept_trips`: state.json's `daytrips_kept`, the same rule)
 *   daytrip.get   { id }                  → one board: its items (own fields only), more, what was left out (with the
 *                                           reasons in words), its kept entries, and the planned days of its trip
 *   daytrip.keep  { id, n, keep, date? }  (write) → keep or un-keep item n; a date (a planned day of the board's trip)
 *                                           also opens the replan, as the chat's day buttons do (41_daytrip.js tgDaytripKeep)
 *   daytrip.new   { from?, under?, date? } (write) → opens a `daytrip` request as /daytrip does (tgDaytripOpen); under is
 *                                           minutes (clamped to 30–180), date the command's words (YYYY-MM-DD, M/D, today, tomorrow)
 * No Google call and no Google content. Defaults: helpers/decisions/WP-15a.md.
 */
var TG_APP_DAYTRIP_LIST = 20;

function tgAppDaytripHead(rec) {
  return { id: rec.id, trip: rec.trip || null, base: rec.base.label, created_on: rec.created_on, max_minutes: rec.max_minutes,
    date: rec.date || null, count: rec.count, kept: rec.kept.length, received_at: rec.received_at };
}
function tgAppDaytripArg(args) {
  var id = tgAppStr(args, 'id', { required: true, max: 64, re: TG_DAYTRIP.ID_RE });
  var rec = tgDaytripGet(id);
  if (!rec) tgAppRefuse(404, 'no_daytrip');
  return rec;
}
function tgAppDaytripItem(it) {
  var out = {};
  Object.keys(it).forEach(function (k) { out[k] = it[k]; });
  out.maps_url = tgAppMaps(it.maps_url);
  return out;
}

function tgAppOpDaytripList() {
  var all = tgDaytripList(0);
  return tgAppOk({ boards: all.slice(0, TG_APP_DAYTRIP_LIST).map(tgAppDaytripHead), total: all.length, kept_trips: tgDaytripKeptSnapshot() });
}

function tgAppOpDaytripGet(args) {
  var rec = tgAppDaytripArg(args), head = tgAppDaytripHead(rec), trip = tgDaytripTrip(rec);
  head.items = rec.items.map(tgAppDaytripItem);
  head.more = rec.more;
  head.left_out = rec.left_out.map(function (l) { return { name: l.name, reason: l.reason, words: TG_DAYTRIP_LEFT_WORDS[l.reason] || 'other' }; });
  head.kept_entries = rec.kept;
  head.trip_title = trip ? tgAppS(trip.title || trip.destination || trip.slug) : '';
  head.days = trip ? tgDigestDays(trip.slug).map(function (d) { return { n: d.n, date: d.date }; }) : [];
  return tgAppOk({ board: head });
}

function tgAppOpDaytripKeep(args) {
  var n = args.n, keep = tgAppBool(args, 'keep', null);
  if (n === undefined || n === null) tgAppRefuse(400, 'missing_arg', { field: 'n' });
  if (typeof n !== 'number' || n !== Math.floor(n) || n < 1 || n > TG_DAYTRIP.ITEMS_MAX) tgAppRefuse(400, 'bad_args', { field: 'n' });
  if (keep === null) tgAppRefuse(400, 'missing_arg', { field: 'keep' });
  var date = tgAppStr(args, 'date', { max: 10, re: TG_ENV_RE.date });
  if (date && (!keep || !tgEnvRealDate(date))) tgAppRefuse(400, 'bad_args', { field: 'date' });
  var rec = tgAppDaytripArg(args), r = tgDaytripKeep(rec, n, keep, date || '');
  if (!r.ok) return r.why === 'no_item' ? tgAppNo(404, 'no_item') : r.why === 'no_trip' ? tgAppNo(409, 'no_trip') : tgAppNo(400, 'no_day', { field: 'date' });
  var out = { id: rec.id, n: n, kept: r.kept, kept_entries: r.rec ? r.rec.kept : [] };
  if (r.replan) out.replan = { request_id: r.replan.id, routine: r.replan.routine, fired: r.replan.fired, dates: r.replan.dates, day: r.day.n };
  return tgAppOk(out);
}

function tgAppOpDaytripNew(args) {
  var from = tgAppStr(args, 'from', { max: TG_DAYTRIP.FROM_MAX }), under = args.under, max;
  if (under !== undefined && under !== null && (typeof under !== 'number' || !isFinite(under) || under <= 0 || under > 999)) tgAppRefuse(400, 'bad_args', { field: 'under' });
  max = under === undefined || under === null ? TG_DAYTRIP.DEFAULT : tgDaytripUnder(under, 'min');
  var words = tgAppStr(args, 'date', { max: 10 }), date = '';
  if (words) {
    var d = tgDaytripDate(words, tgDaytripToday(tgTripCurrent()));
    if (d.why) return tgAppNo(400, d.why, { field: 'date' });
    date = d.date;
  }
  var r = tgDaytripOpen({ from: from, maxMinutes: max, date: date });
  if (!r.ok) return tgAppNo(400, r.why, r.why === 'no_trip' ? null : { field: r.why === 'too_long' ? 'from' : 'date' });
  return tgAppOk({ request_id: r.id, routine: r.routine, fired: r.fired, trip: r.trip, from: r.from, max_minutes: r.max_minutes, date: r.date || null });
}

TG_APP_OPS['daytrip.list'] = { args: [], fn: tgAppOpDaytripList };
TG_APP_OPS['daytrip.get'] = { args: ['id'], fn: tgAppOpDaytripGet };
TG_APP_OPS['daytrip.keep'] = { args: ['id', 'n', 'keep', 'date'], write: true, fn: tgAppOpDaytripKeep };
TG_APP_OPS['daytrip.new'] = { args: ['from', 'under', 'date'], write: true, fn: tgAppOpDaytripNew };

// Developed by: LightAISolutions
