/**
 * Tour Guide Menu check in the app (TG-PHASE-16 WP-16b): the app ops behind the Menu screen and the day view's 🍽 button,
 * added to TG_APP_OPS (32_app_api.js) from this file — no hook needed, the table is read at request time (as 35_scout_app.js does).
 *   menu.list                          → the last 20 checks, head fields only, newest first
 *   menu.get     { id }                → one check: its dishes, others, sources, the re-plan offer (the card's rules) and
 *                                        whether its trip has a veg card
 *   menu.new     { place, date?, slug? } (write) → opens a `menu` request as /menu does (tgMenuOpen); date takes the
 *                                        command's words (YYYY-MM-DD, M/D, today, tomorrow)
 *   menu.replan  { id, date }          (write) → the card's 🔁 button (tgMenuReplan): the day's dinner is checked again first
 *   menu.day     { trip, date }        → the day's 🍽 button by tgMenuDayButton's rules: null, or { check: <id to resend> | null,
 *                                        fits: <that check's fits> | null }
 * No Google call and no Google content. Defaults: helpers/decisions/WP-16b.md.
 */
function tgAppMenuHead(rec) {
  return { id: rec.id, trip: rec.trip || null, place_slug: rec.place_slug, place_name: rec.place_name, checked: rec.checked,
    fits: rec.fits, date: tgAppS(rec.payload.date) || null, received_at: rec.received_at };
}
function tgAppMenuArg(args) {
  var id = tgAppStr(args, 'id', { required: true, max: 64, re: TG_MENU.ID_RE });
  var rec = tgMenuGet(id);
  if (!rec) tgAppRefuse(404, 'no_menu');
  return rec;
}
function tgAppMenuDate(args, k, required) {
  var d = tgAppStr(args, k, { required: required, max: 10, re: TG_ENV_RE.date });
  if (d && !tgEnvRealDate(d)) tgAppRefuse(400, 'bad_args', { field: k });
  return d;
}

function tgAppOpMenuList() {
  var all = tgMenuList(0);
  return tgAppOk({ items: all.slice(0, TG_MENU.LIST_MAX).map(tgAppMenuHead), total: all.length });
}

function tgAppOpMenuGet(args) {
  var rec = tgAppMenuArg(args), p = rec.payload, place = isPlainObject(p.place) ? p.place : {}, out = tgAppMenuHead(rec), trip = tgMenuTrip(rec);
  out.local_name = tgAppS(place.local_name);
  out.fits_line = TG_MENU_FITS_LINE[rec.fits];
  out.note = tgAppS(p.note);
  out.diet = tgAppS(p.diet);
  out.dishes = (Array.isArray(p.dishes) ? p.dishes : []).filter(isPlainObject).map(function (d) {
    var o = { name: tgAppS(d.name), course: tgAppS(d.course), fits: tgAppS(d.fits) };
    ['local', 'ask', 'price'].forEach(function (k) { if (d[k] !== undefined) o[k] = tgAppS(d[k]); });
    return o;
  });
  out.others = typeof p.others === 'number' ? p.others : 0;
  out.sources = (Array.isArray(p.sources) ? p.sources : []).filter(function (s) { return isPlainObject(s) && /^https:\/\/\S+$/.test(String(s.url || '')); })
    .map(function (s) { return { title: tgAppS(s.title), url: String(s.url) }; });
  out.offer = tgMenuOffer(rec).map(function (o) {
    var e = { n: o.day.n, date: o.day.date, replan: o.replan };
    if (!o.replan) e.from = o.from;
    if (o.again) e.again = true;
    return e;
  });
  out.trip_title = trip ? tgAppS(trip.title || trip.destination || trip.slug) : '';
  out.has_vegcard = !!(rec.trip && tgVegCardHas(rec.trip));
  return tgAppOk({ item: out });
}

function tgAppOpMenuNew(args) {
  var place = tgAppStr(args, 'place', { required: true, max: TG_MENU.PLACE_MAX });
  var slug = tgAppStr(args, 'slug', { max: 64, re: TG_SLUG_RE });
  var words = tgAppStr(args, 'date', { max: 10 }), date = '';
  if (words) {
    var d = tgDaytripDate(words, tgMenuToday(tgTripCurrent()));
    if (d.why) return tgAppNo(400, d.why, { field: 'date' });
    date = d.date;
  }
  var r = tgMenuOpen({ place: place, slug: slug, date: date });
  if (!r.ok) return tgAppNo(400, r.why, { field: r.why === 'bad_slug' ? 'slug' : r.why === 'bad_date' || r.why === 'past_date' ? 'date' : 'place' });
  return tgAppOk({ request_id: r.id, routine: r.routine, fired: r.fired, trip: r.trip || null, place: r.place, slug: r.slug || null, date: r.date || null });
}

function tgAppOpMenuReplan(args) {
  var date = tgAppMenuDate(args, 'date', true), rec = tgAppMenuArg(args), r = tgMenuReplan(rec, date);
  if (!r.ok) return r.why === 'no_trip' ? tgAppNo(409, 'no_trip') : tgAppNo(409, r.why, { field: 'date' });
  return tgAppOk({ id: rec.id, request_id: r.id, routine: r.routine, fired: r.fired, day: r.day.n, date: date });
}

function tgAppOpMenuDay(args) {
  var slug = tgAppStr(args, 'trip', { required: true, max: 64, re: TG_SLUG_RE }), date = tgAppMenuDate(args, 'date', true);
  var trip = tgTripGet(slug);
  if (!trip) return tgAppNo(404, 'no_trip');
  var day = tgDigestDay(trip.slug, date), b = day ? tgMenuDayButton(trip, day) : null;
  return tgAppOk({ button: b ? { check: b.check, fits: b.rec ? b.rec.fits : null } : null });
}

TG_APP_OPS['menu.list'] = { args: [], fn: tgAppOpMenuList };
TG_APP_OPS['menu.get'] = { args: ['id'], fn: tgAppOpMenuGet };
TG_APP_OPS['menu.new'] = { args: ['place', 'date', 'slug'], write: true, fn: tgAppOpMenuNew };
TG_APP_OPS['menu.replan'] = { args: ['id', 'date'], write: true, fn: tgAppOpMenuReplan };
TG_APP_OPS['menu.day'] = { args: ['trip', 'date'], fn: tgAppOpMenuDay };

// Developed by: LightAISolutions
