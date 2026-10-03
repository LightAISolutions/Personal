/**
 * Tour Guide pack — a lodging change offers to re-plan the days it touches (WP-12r; Phase 10's carried item 3,
 * TG-PHASE-11 §7). After /lodging <text> on a trip with stored plan days not yet over, the reply carries two buttons:
 *   🔁 Re-plan N days from <day>   lg:<trip key>:<yyyymmdd>   → request kind `replan` { trip, dates: every stored day from
 *                                  that date (and from the trip's today) on, deliverables, reason: "The lodging changed…" }
 *   Keep the plan                  lg:<trip key>:k            → nothing is sent
 * Either tap edits the message so it cannot be tapped twice. /lodging words are trip-wide and carry no start date, so the
 * days a change touches are every planned day from the trip's today on (all of them before the trip). The lodging itself
 * travels in the reason: trip_update has no lodging field (a contract change for the private routine). A trip without a
 * plan, or whose days are all over, gets the reply exactly as before. Decisions: helpers/decisions/WP-12r.md.
 */
var TG_LG = { MAX_DATES: 31, REASON_MAX: 300, TEXT_MAX: 200 };

/** The stored plan days a lodging change touches: the dates from max(from, the trip's today) on, in order. */
function tgLgDates(trip, from) {
  if (!trip || typeof tgDigestDays !== 'function') return [];
  var today = tgTripToday(trip), lo = from && from > today ? from : today;
  return tgDigestDays(trip.slug).map(function (d) { return d.date; }).filter(function (d) { return d >= lo; }).slice(0, TG_LG.MAX_DATES);
}
function _tgLgCount(n) { return n + ' day' + (n === 1 ? '' : 's'); }
/** The offer under the /lodging reply: { line, keyboard } or null when no planned day is left. */
function tgLgOffer(trip) {
  var dates = tgLgDates(trip);
  if (!dates.length) return null;
  var tk = tgCmdTripKey(trip.slug);
  return {
    line: '🔁 The plan still starts and ends ' + (dates.length === 1 ? 'that day' : 'those days') + ' at the old lodging: re-plan ' +
      _tgLgCount(dates.length) + ' from ' + tgCmdDate(dates[0]) + '?',
    keyboard: tgKeyboard([[{ text: '🔁 Re-plan ' + _tgLgCount(dates.length) + ' from ' + tgCmdDate(dates[0]), data: cbEncode('lg', tk, dates[0].replace(/-/g, '')) }],
      [{ text: 'Keep the plan', data: cbEncode('lg', tk, 'k') }]])
  };
}
/** The replan request for a lodging change, from `date` on → the request, or a word for the owner (a string). */
function tgLgAsk(trip, date) {
  var text = trip.lodging && trip.lodging.text ? String(trip.lodging.text) : '';
  if (!text) return 'No lodging is saved — /lodging <where>.';
  var dates = tgLgDates(trip, date);
  if (!dates.length) return 'Those days are over.';
  var reason = truncate('The lodging changed: ' + truncate(typeof tgCmdLodgingText === 'function' ? tgCmdLodgingText(trip) : text, TG_LG.TEXT_MAX) +
    '. Re-plan these days to start and end there.', TG_LG.REASON_MAX);
  return { dates: dates, req: tgOpenKindRequest('replan', { trip: trip.slug, dates: dates, deliverables: tgCmdDeliverables(trip), reason: reason },
    { text: 'lodging changed · re-plan ' + dates.length + ' day' + (dates.length === 1 ? '' : 's') }) };
}

registerCallback('lg', function (ctx) {
  var p = ctx.parts;
  if (p.length !== 2 || !(p[1] === 'k' || /^\d{8}$/.test(String(p[1])))) { ctx.answer('Unknown button'); return; }
  var trip = tgCmdTripByKey(p[0]);
  if (!trip) { ctx.answer('That trip is gone.'); return; }
  var head = '🏨 ' + tgCmdTitle(trip) + (trip.lodging && trip.lodging.text ? ': ' + tgEscape(truncate(trip.lodging.text, TG_LG.TEXT_MAX)) : '');
  if (p[1] === 'k') {
    ctx.answer('Kept');
    ctx.edit(head + '\nThe plan stays as it is; /replan changes one day.');
    return;
  }
  var date = tgLateDate8(p[1]);
  if (!tgEnvRealDate(date)) { ctx.answer('Unknown button'); return; }
  var r = tgLgAsk(trip, date);
  if (typeof r === 'string') { ctx.answer(r, true); return; }
  ctx.answer('Re-planning');
  ctx.edit(head + '\n🔁 Re-planning ' + _tgLgCount(r.dates.length) + ' from ' + tgCmdDate(r.dates[0]) + ' for the new lodging. It runs in the background; the day cards update when the new plan is ready.');
});

// Developed by: LightAISolutions
