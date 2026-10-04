/**
 * Tour Guide What's on in the app (C15, TG-PHASE-15 WP-15b): the app ops behind the What's on screen, added to TG_APP_OPS
 * (32_app_api.js) from this file — no hook needed, the table is read at request time (as 35_scout_app.js does).
 *   whatson.list                → the last 20 boards, head fields only
 *   whatson.get    { id }       → one board: its items (with the days each covers in the window, the days it can be
 *                                 chosen for and whether it can be chosen), sources, what was left out, its choices and the
 *                                 trip's planned dates
 *   whatson.choose { id, item, choose, chosen_on?, replan? }  (write) → the ➕ button's rules (42_whatson.js
 *                                 tgWhatsonChoose); with replan: true and a planned day, also opens the re-plan
 *   whatson.new    { place?, from?, to? }                     (write) → opens the request as /whatson does
 * Own fields only; no Google call and no Google content.
 */
var TG_APP_WHATSON_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** `chosen` counts the board's items chosen on it or on another board of the same trip and place (C15 coordinator); `all` as tgWhatsonChosenCount. */
function tgAppWhatsonHead(rec, all) {
  return { id: rec.id, trip: rec.trip || null, place: rec.place, from: rec.from, to: rec.to, created_on: rec.created_on,
    auto: rec.auto, count: rec.count, chosen: tgWhatsonChosenCount(rec, all), received_at: rec.received_at };
}
function tgAppWhatsonArg(args) {
  var id = tgAppStr(args, 'id', { required: true, max: 52, re: TG_WHATSON.ID_RE });
  var rec = tgWhatsonGet(id);
  if (!rec) tgAppRefuse(404, 'no_whatson');
  return rec;
}
/** The board as the screen reads it. */
function tgAppWhatsonBoard(rec) {
  var head = tgAppWhatsonHead(rec), trip = tgWhatsonTrip(rec);
  head.items = rec.items.map(function (it) {
    var c = tgWhatsonChoice(rec, it.id), o = JSON.parse(toJson(it));
    o.days_in = tgWoDaysIn(it, rec.from, rec.to);
    o.choosable = TG_WHATSON_CHOOSABLE.indexOf(it.kind) >= 0;
    o.choose_days = o.choosable ? tgWhatsonCandidateDays(rec, it) : [];
    o.chosen_on = c ? c.chosen_on : null;
    return o;
  });
  head.sources = rec.sources;
  head.left_out = rec.left_out;
  head.more = rec.more;
  // C15 (coordinator): the choices of this board's items, wherever on the trip and place's boards they were made.
  head.choices = rec.items.map(function (it) { return tgWhatsonChoice(rec, it.id); }).filter(Boolean)
    .map(function (c) { return { item: c.item, chosen_on: c.chosen_on, at: c.at }; });
  head.planned = trip ? tgDigestDays(trip.slug).map(function (d) { return d.date; }) : [];
  head.trip_title = trip ? tgAppS(trip.title || trip.destination || trip.slug) : null;
  return head;
}

function tgAppOpWhatsonList() {
  var all = tgWhatsonList(0);
  return tgAppOk({ boards: all.slice(0, TG_WHATSON.LIST_MAX).map(function (b) { return tgAppWhatsonHead(b, all); }), total: all.length });
}
function tgAppOpWhatsonGet(args) { return tgAppOk({ board: tgAppWhatsonBoard(tgAppWhatsonArg(args)) }); }

/** 409 which_day (with days) when more than one day fits and none was given; 409 not_choosable · no_day; 400 bad_day. */
function tgAppOpWhatsonChoose(args) {
  var rec = tgAppWhatsonArg(args), itemId = tgAppStr(args, 'item', { required: true, max: 64, re: TG_APP_WHATSON_SLUG_RE });
  if (typeof args.choose !== 'boolean') tgAppRefuse(400, args.choose === undefined || args.choose === null ? 'missing_arg' : 'bad_args', { field: 'choose' });
  var day = tgAppStr(args, 'chosen_on', { max: 10 });
  if (day && !tgEnvRealDate(day)) tgAppRefuse(400, 'bad_args', { field: 'chosen_on' });
  if (args.replan !== undefined && args.replan !== null && typeof args.replan !== 'boolean') tgAppRefuse(400, 'bad_args', { field: 'replan' });
  var it = rec.items.filter(function (x) { return x.id === itemId; })[0];
  if (!it) return tgAppNo(404, 'no_item');
  var r = tgWhatsonChoose(rec, it, args.choose, day || null);
  if (!r.ok) return r.why === 'bad_day' ? tgAppNo(400, 'bad_day', { days: r.days }) : tgAppNo(409, r.why, r.why === 'which_day' ? { days: r.days.slice(0, TG_WHATSON.ASK_DAYS) } : null);
  var replan = null;
  if (r.chosen && args.replan === true && r.planned) {
    var rp = tgWhatsonReplan(r.rec, it, {});
    if (rp.ok) replan = { request_id: rp.id, day: rp.day, date: rp.date };
  }
  return tgAppOk({ chosen: r.chosen, chosen_on: r.chosen ? r.chosen_on : null, planned: !!(r.chosen && r.planned), replan: replan,
    message: r.chosen ? '' : TG_WHATSON_REMOVED, board: tgAppWhatsonBoard(r.rec) });
}

/** The same words /whatson takes: place, then from (and to); refusals as 400 with the parse's reason. */
function tgAppOpWhatsonNew(args) {
  var place = tgAppStr(args, 'place', { max: TG_WHATSON.PLACE_MAX }).replace(/\s+/g, ' ').trim();
  var from = tgAppStr(args, 'from', { max: 10 }), to = tgAppStr(args, 'to', { max: 10 });
  if (from && !tgEnvRealDate(from)) tgAppRefuse(400, 'bad_args', { field: 'from' });
  if (to && !tgEnvRealDate(to)) tgAppRefuse(400, 'bad_args', { field: 'to' });
  if (to && !from) tgAppRefuse(400, 'missing_arg', { field: 'from' });
  var text = [place, from ? from + (to && to !== from ? ' to ' + to : '') : ''].filter(Boolean).join(' ');
  var r = tgWhatsonResolve(text, tgTripCurrent());
  if (!r.ok) return tgAppNo(400, r.why);
  var o = tgWhatsonOpen(r.payload, { text: '/whatson ' + text });
  return tgAppOk({ request_id: o.id, routine: o.routine, fired: o.fired, request: r.payload });
}

TG_APP_OPS['whatson.list'] = { args: [], fn: tgAppOpWhatsonList };
TG_APP_OPS['whatson.get'] = { args: ['id'], fn: tgAppOpWhatsonGet };
TG_APP_OPS['whatson.choose'] = { args: ['id', 'item', 'choose', 'chosen_on', 'replan'], write: true, fn: tgAppOpWhatsonChoose };
TG_APP_OPS['whatson.new'] = { args: ['place', 'from', 'to'], write: true, fn: tgAppOpWhatsonNew };

// Developed by: LightAISolutions
