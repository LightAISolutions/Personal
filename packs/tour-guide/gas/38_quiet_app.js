/**
 * Tour Guide Quiet in the app (TG-PHASE-16 WP-16a, C16): the app ops behind the Quiet screen and the day view's 🕊
 * buttons, added to TG_APP_OPS (32_app_api.js) from this file — no hook needed, the table is read at request time.
 *   quiet.list                      → the last 20 boards, head fields only, newest first
 *   quiet.get   { id }              → one board: the magnet (quiet line, source), its items (own fields only), more, what
 *                                     was left out (with the reasons in words) and its added entries
 *   quiet.add   { id, n }   (write) → item n onto the Later list, the chat's ➕ rules (43_quiet.js tgQuietAdd)
 *   quiet.new   { place, date?, slug? } (write) → opens a `quiet` request as /quiet does; date in the command's words
 *   quiet.day   { trip, date }      → the day's stops a 🕊 button is offered for, each with the board id to show, or null
 * No Google call and no Google content. Defaults: helpers/decisions/WP-16a.md.
 */
function tgAppQuietHead(rec) {
  return { id: rec.id, trip: rec.trip || null, magnet: rec.magnet.name, magnet_slug: rec.magnet.slug, busy: rec.magnet.busy,
    created_on: rec.created_on, date: rec.date || null, count: rec.count, added: rec.added.length, received_at: rec.received_at };
}
function tgAppQuietArg(args) {
  var id = tgAppStr(args, 'id', { required: true, max: 64, re: TG_QUIET.ID_RE });
  var rec = tgQuietGet(id);
  if (!rec) tgAppRefuse(404, 'no_quiet');
  return rec;
}

function tgAppOpQuietList() {
  var all = tgQuietList(0);
  return tgAppOk({ boards: all.slice(0, TG_QUIET.LIST_MAX).map(tgAppQuietHead), total: all.length });
}

function tgAppOpQuietGet(args) {
  var rec = tgAppQuietArg(args), head = tgAppQuietHead(rec), m = rec.magnet;
  head.quiet = m.quiet;
  head.kind = m.kind;
  head.source = m.source && /^https:\/\/\S+$/.test(m.source.url) ? { title: m.source.title, url: m.source.url } : null;
  head.items = rec.items.map(function (it) {
    var out = {};
    Object.keys(it).forEach(function (k) { out[k] = it[k]; });
    out.maps_url = tgAppMaps(it.maps_url);
    return out;
  });
  head.more = rec.more;
  head.left_out = rec.left_out.map(function (l) { return { name: l.name, reason: l.reason, words: TG_QUIET_LEFT_WORDS[l.reason] || 'other' }; });
  head.added_entries = rec.added;
  return tgAppOk({ board: head });
}

function tgAppOpQuietAdd(args) {
  var n = args.n;
  if (n === undefined || n === null) tgAppRefuse(400, 'missing_arg', { field: 'n' });
  if (typeof n !== 'number' || n !== Math.floor(n) || n < 1 || n > TG_QUIET.ITEMS_MAX) tgAppRefuse(400, 'bad_args', { field: 'n' });
  var rec = tgAppQuietArg(args), r = tgQuietAdd(rec, n);
  if (!r.ok) return r.why === 'no_item' ? tgAppNo(404, 'no_item') : tgAppNo(409, 'no_trip');
  return tgAppOk({ id: rec.id, n: n, trip: r.trip.slug, slug: r.item.slug, added_entries: r.rec.added, days: r.days.map(function (d) { return { n: d.n, date: d.date }; }) });
}

function tgAppOpQuietNew(args) {
  var place = tgAppStr(args, 'place', { required: true, max: 200 }), slug = tgAppStr(args, 'slug', { max: 64, re: TG_SLUG_RE });
  var words = tgAppStr(args, 'date', { max: 10 }), date = '';
  if (words) {
    var d = tgDaytripDate(words, tgQuietToday(tgTripCurrent()));
    if (d.why) return tgAppNo(400, d.why, { field: 'date' });
    date = d.date;
  }
  var r = tgQuietOpen({ place: place, slug: slug, date: date });
  if (!r.ok) return tgAppNo(400, r.why, { field: r.why === 'bad_date' || r.why === 'past_date' ? 'date' : r.why === 'bad_slug' ? 'slug' : 'place' });
  return tgAppOk({ request_id: r.id, routine: r.routine, fired: r.fired, trip: r.trip || null, place: r.place, slug: r.slug || null, date: r.date || null });
}

function tgAppOpQuietDay(args) {
  var slug = tgAppStr(args, 'trip', { required: true, max: 64, re: TG_SLUG_RE }), date = tgAppStr(args, 'date', { required: true, max: 10, re: TG_ENV_RE.date });
  var trip = tgTripGet(slug);
  if (!trip) return tgAppNo(404, 'no_trip');
  var day = tgEnvRealDate(date) ? tgDigestDay(trip.slug, date) : null;
  if (!day || day.date < tgTripToday(trip)) return tgAppOk({ trip: trip.slug, date: date, stops: [] });
  return tgAppOk({ trip: trip.slug, date: date, stops: tgQuietDayStops(day).map(function (s) {
    var b = tgQuietBoardFor(trip, s.slug);
    return { slug: s.slug, name: tgAppS(s.name), board: b ? b.id : null };
  }) });
}

TG_APP_OPS['quiet.list'] = { args: [], fn: tgAppOpQuietList };
TG_APP_OPS['quiet.get'] = { args: ['id'], fn: tgAppOpQuietGet };
TG_APP_OPS['quiet.add'] = { args: ['id', 'n'], write: true, fn: tgAppOpQuietAdd };
TG_APP_OPS['quiet.new'] = { args: ['place', 'date', 'slug'], write: true, fn: tgAppOpQuietNew };
TG_APP_OPS['quiet.day'] = { args: ['trip', 'date'], fn: tgAppOpQuietDay };

// Developed by: LightAISolutions
