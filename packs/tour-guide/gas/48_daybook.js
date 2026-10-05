/**
 * Tour Guide Day book (Contract C18 wave 3, WP-18e): one day of the current trip as its own printed booklet — that day's
 * cover, the day, its place cards and the sources, with room for more food and if-then lines and the order inside a big
 * stop (helpers/decisions/TG-PHASE-18.md §4).
 *   /daybook <date>   → a request of kind `daybook` { trip, date, build_id? } for the BROCHURE routine (as /brochure);
 *                       the routine's reply names the PDF in drive_file_ids, which the core sends to the chat.
 *   /daybook          → today's Day book while today is a day of the plan (a free day says so); otherwise the usage line.
 * <date> takes the words the other day commands take (/replan, the app's day picker): YYYY-MM-DD, day N or N, today,
 * tomorrow. A date outside the plan, or a free day with no stops, gets a plain reply and no request. The Day book is never
 * stored on the trip (only a `brochure` reply is, 20_envelopes.js), so it never replaces the trip's brochure.
 */
var TG_DAYBOOK = { KIND: 'daybook', ROUTINE: 'BROCHURE' };
var TG_DAYBOOK_USAGE = 'Usage: <code>/daybook &lt;date or day N&gt;</code> — e.g. <code>/daybook 2027-05-13</code>, <code>/daybook day 2</code>, <code>/daybook tomorrow</code>';
TG_KIND_ROUTINE[TG_DAYBOOK.KIND] = TG_DAYBOOK.ROUTINE;   // read by tgKindRoutine at call time (00_common.js)

/** The words /daybook reads as a day: YYYY-MM-DD, day N, N, today, tomorrow (the same as /replan's). */
var TG_DAYBOOK_DAY_RE = /^(day\s*\d{1,2}|\d{4}-\d{2}-\d{2}|\d{1,2}|today|tomorrow)$/i;

/**
 * /daybook's argument → { date, day } (a planned day), or { error: html } to reply with. Bare: today, when today is a day
 * of the plan (a free day gets the free-day reply); else the usage line.
 */
function tgDaybookDay(trip, args) {
  var w = String(args || '').trim();
  if (!w) {
    var today = tgTripToday(trip), d0 = today ? tgDigestDay(trip.slug, today) : null;
    if (!d0) return { error: TG_DAYBOOK_USAGE };
    w = today;
  }
  if (!TG_DAYBOOK_DAY_RE.test(w)) return { error: TG_DAYBOOK_USAGE };
  var date = tgCmdPlanDate(trip, w);
  if (!date) return { error: 'That day is not in the plan of ' + tgCmdTitle(trip) + '. /trip shows its days.' };
  var day = tgDigestDay(trip.slug, date);
  if (!day || !(day.stops || []).length) return { error: tgCmdDate(date) + ' is a free day with nothing planned, so there is no Day book for it.' };
  return { date: date, day: day };
}

/** Opens the `daybook` request for one planned day of the trip; returns tgOpenKindRequest's result. */
function tgDaybookRequest(trip, date, opts) {
  opts = opts || {};
  var payload = { trip: trip.slug, date: date };
  if (trip.build_id) payload.build_id = trip.build_id;
  return tgOpenKindRequest(TG_DAYBOOK.KIND, payload, { chat: opts.chat || null, text: opts.text || '/daybook ' + date, replyTo: opts.replyTo,
    ack: '📘 Building the Day book for ' + tgCmdDate(date) + ' of ' + tgCmdTitle(trip) + '…' });
}

registerCommand('/daybook', function (ctx) {
  var trip = tgCmdCurrent(ctx);
  if (!trip) return;
  var r = tgDaybookDay(trip, ctx.args);
  if (r.error) { ctx.reply(r.error); return; }
  tgDaybookRequest(trip, r.date, { chat: ctx.chat, text: ctx.text, replyTo: ctx.chat && ctx.chat.message_id });
}, 'one day as its own booklet (PDF): /daybook <date or day N>');

// Developed by: LightAISolutions
