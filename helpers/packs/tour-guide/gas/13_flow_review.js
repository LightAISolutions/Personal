/**
 * Tour Guide pack — the post-trip /review (WP-5a; plan §5.10, decision 21; plan §5.3 calibration; contract §1.6).
 * A core flow `review` over the stops of the stored digest, one stop per message: 👍 worth it · 👎 not · ⏭ skipped,
 * then — after 👍 or 👎 — longer · shorter · about right against the planned minutes. ✅ Finish ends early. At the end one
 * `prefs` request with payload.review = { trip, items: [{ slug, rating: up|down|skipped, calibration? }] } and the line
 * "noted — this will shape the next plan"; the trip becomes `done`. Each tap is also kept in Choices (kind review).
 * Offered once by the daily job tg_review_offer the day after a trip's end (button rv:go:<trip key>), and on demand.
 */
var TG_RV_TTL_MIN = 7 * 24 * 60;
var TG_RV_ITEMS_MAX = 40;
var TG_RV_OFFER_WINDOW_DAYS = 7;   // a trip that ended longer ago than this is never offered by the daily job
var TG_RV_RUN = 'review';          // Choices run of the review taps
var TG_RV_RATING = { u: 'up', d: 'down', s: 'skipped' };
var TG_RV_CAL = { l: 'longer', h: 'shorter', r: 'right' };

/** The stops of a trip's digest, first visit order, one per slug: [{ slug, name, date, minutes }]. */
function tgRvItems(slug) {
  var out = [], seen = {};
  tgDigestDays(slug).forEach(function (d) {
    (d.stops || []).forEach(function (s) {
      if (!s || !s.slug || seen[s.slug] || out.length >= TG_RV_ITEMS_MAX) return;
      seen[s.slug] = true;
      out.push({ slug: String(s.slug), name: truncate(String(s.name || s.slug), 120), date: d.date, minutes: parseInt(s.minutes, 10) || 0 });
    });
  });
  return out;
}
function tgRvHead(state) {
  var it = state.items[state.i];
  return '<i>' + (state.i + 1) + ' of ' + state.items.length + ' · ' + tgEscape(state.title) + '</i>\n<b>' + tgEscape(it.name) + '</b> — ' + tgCmdDate(it.date) +
    (it.minutes ? ' · ' + tgCmdMinutes(it.minutes) + ' planned' : '');
}
function tgRvStep(state) {
  if (state.i >= state.items.length) return tgRvFinish(state);
  if (state.phase === 'cal') {
    return { prompt: tgRvHead(state) + '\nAnd the time there?', expect: 'button', state: state,
      keyboard: [[{ text: '⏩ Needed longer', value: 'l' }, { text: '⏪ Less was fine', value: 'h' }, { text: '👌 About right', value: 'r' }], [{ text: '⏭ Not sure', value: 'n' }]] };
  }
  return { prompt: tgRvHead(state) + '\nWorth it?', expect: 'button', state: state,
    keyboard: [[{ text: '👍 Worth it', value: 'u' }, { text: '👎 Not really', value: 'd' }, { text: '⏭ Skipped it', value: 's' }], [{ text: '✅ Finish', value: 'fin' }]] };
}
/** The prefs payload: rated items in stop order. */
function tgRvReview(state) {
  var items = [];
  state.items.forEach(function (it) {
    var r = state.r[it.slug];
    if (!r) return;
    var o = { slug: it.slug, rating: r.rating };
    if (r.calibration) o.calibration = r.calibration;
    items.push(o);
  });
  return { trip: state.trip, items: items };
}
function tgRvMarkOffered(slug) {
  var map = safeJsonParse(settingGet(TG_SETTINGS.REVIEW_OFFERED, '') || '{}');
  map = map.ok && isPlainObject(map.value) ? map.value : {};
  if (!map[slug]) { map[slug] = nowIso(); settingSet(TG_SETTINGS.REVIEW_OFFERED, toJson(map), 'trips offered a /review'); }
  var t = tgTripGet(slug);
  if (t && !t.review_offered_at) tgTripUpsert({ slug: slug, review_offered_at: map[slug] });
  return map;
}
function tgRvFinish(state) {
  var review = tgRvReview(state);
  if (!review.items.length) return { prompt: 'Nothing recorded — send /review whenever you like.', done: true, state: state, result: review };
  tgOpenKindRequest('prefs', { review: review }, { text: 'trip review · ' + state.trip + ' (' + review.items.length + ')' });
  var t = tgTripGet(state.trip);
  if (t && (t.status === 'planned' || t.status === 'delivered')) tgTripSetStatus(state.trip, 'done');
  return { prompt: '🙏 Noted — this will shape the next plan.', done: true, state: state, result: review };
}

registerFlow('review', {
  ttl_min: TG_RV_TTL_MIN,
  /** seed = { trip } */
  start: function (seed) {
    var t = tgTripGet(seed && seed.trip);
    var state = { trip: t ? t.slug : String(seed && seed.trip || ''), title: t ? (t.title || t.destination || t.slug) : '', items: t ? tgRvItems(t.slug) : [], i: 0, phase: 'rate', r: {} };
    if (!state.items.length) return { prompt: 'No planned stops to review for <b>' + tgEscape(state.title || state.trip) + '</b>.', done: true, state: state };
    tgRvMarkOffered(state.trip);
    tgChoiceClear(state.trip, TG_RV_RUN, 'review');
    return tgRvStep(state);
  },
  next: function (state, input) {
    if (input.type !== 'button') return tgRvStep(state);
    var v = String(input.value || ''), it = state.items[state.i];
    if (v === 'fin') return tgRvFinish(state);
    if (!it) return tgRvFinish(state);
    if (state.phase === 'rate' && TG_RV_RATING[v]) {
      state.r[it.slug] = { rating: TG_RV_RATING[v] };
      tgChoiceSet(state.trip, TG_RV_RUN, 'review', it.slug, TG_RV_RATING[v], '');
      if (v === 's') state.i++; else state.phase = 'cal';
      return tgRvStep(state);
    }
    if (state.phase === 'cal' && (TG_RV_CAL[v] || v === 'n')) {
      if (TG_RV_CAL[v]) {
        state.r[it.slug].calibration = TG_RV_CAL[v];
        tgChoiceSet(state.trip, TG_RV_RUN, 'review', it.slug, state.r[it.slug].rating, TG_RV_CAL[v]);
      }
      state.phase = 'rate'; state.i++;
      return tgRvStep(state);
    }
    return tgRvStep(state);
  }
});

/** The trip /review means: /review <name>; else the latest trip that has ended and is not done; else the current trip. */
function tgRvPickTrip(arg) {
  if (arg) return tgCmdFindTrip(arg);
  var today = isoDateLocal();
  var ended = tgTripList().filter(function (t) { return t.status !== 'done' && t.end && t.end < today; });
  if (ended.length) return ended[ended.length - 1];
  return tgTripCurrent();
}
function tgRvStart(chatId, trip) {
  var f = flowActive(chatId);
  if (f && f.flow === 'review' && f.state && f.state.trip === trip.slug) return flowResume(chatId, { type: 'resume', event: 'reprompt' });
  if (f) { tgSend(chatId, 'You are in the middle of /' + tgEscape(f.flow) + ' — finish it or send /cancel first.'); return null; }
  return flowStart(chatId, 'review', { trip: trip.slug });
}
registerCommand('/review', function (ctx) {
  var arg = String(ctx.args || '').trim();
  var trip = tgRvPickTrip(arg);
  if (!trip) { ctx.reply(arg ? 'No trip matches “' + tgEscape(truncate(arg, 60)) + '”.' : 'No trip to review yet.'); return null; }
  return tgRvStart(ctx.chatId, trip);
}, 'rate the places of a trip: /review [trip]');

// rv:go:<trip key> — the daily offer's button.
registerCallback('rv', function (ctx) {
  if (ctx.parts[0] !== 'go') { ctx.answer('Unknown button'); return; }
  var trip = tgCmdTripByKey(ctx.parts[1]);
  if (!trip) { ctx.answer('That trip is gone.'); return; }
  ctx.answer('');
  tgRvStart(ctx.chatId, trip);
});

/** Daily: offer /review once, the day after a trip ends (planned or delivered, with stops, ended ≤ 7 days ago). */
function tgRvOffer() {
  var chat = tgOwnerChat();
  if (!chat) return { offered: [] };
  var today = isoDateLocal();
  var map = safeJsonParse(settingGet(TG_SETTINGS.REVIEW_OFFERED, '') || '{}');
  map = map.ok && isPlainObject(map.value) ? map.value : {};
  var offered = [];
  tgTripList().forEach(function (t) {
    if (!t.end || t.end >= today || map[t.slug] || t.review_offered_at) return;
    if (t.status !== 'planned' && t.status !== 'delivered') return;
    var ago = tgCmdDaysBetween(t.end, today);
    if (ago === null || ago > TG_RV_OFFER_WINDOW_DAYS) return;
    var n = tgRvItems(t.slug).length;
    if (!n) return;
    tgSend(chat, '🧳 Welcome back from <b>' + tgCmdTitle(t) + '</b>. Rate the ' + n + ' place' + (n === 1 ? '' : 's') + ' in two minutes? It shapes the next plan.',
      { keyboard: tgKeyboard([[{ text: '⭐ Review the trip', data: cbEncode('rv', 'go', tgCmdTripKey(t.slug)) }]]) });
    tgRvMarkOffered(t.slug);
    offered.push(t.slug);
  });
  return { offered: offered };
}
registerDailyJob('tg_review_offer', tgRvOffer);

// Developed by: LightAISolutions
