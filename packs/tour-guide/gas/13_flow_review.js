/**
 * Tour Guide pack — the post-trip /review (WP-5a; plan §5.10, decision 21; plan §5.3 calibration; contract §1.6).
 * A core flow `review` over the stops of the stored digest, one stop per message: 👍 worth it · 👎 not · ⏭ skipped,
 * then — after 👍 or 👎 — longer · shorter · about right against the planned minutes. ✅ Finish ends early. At the end one
 * `prefs` request with payload.review = { trip, items: [{ slug, rating: up|down|skipped, calibration? }] } and the line
 * "noted — this will shape the next plan"; the trip becomes `done`. Each tap is also kept in Choices (kind review).
 * Offered once by the daily job tg_review_offer the day after a trip's end (button rv:go:<trip key>), and on demand.
 * WP-12b (TG-PHASE-12 §7): stops rated in an evening check-in (25_checkin.js, Choices run `checkin`) are skipped; when
 * every stop is rated the review offers 📨 Send my ratings or 🔁 Review again (every stop, check-in answers kept until
 * changed). The request merges both sources in stop order; the review's answer wins for a stop rated twice. Starting a
 * review clears only the review's own taps.
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
/**
 * The check-in ratings of a trip: { slug: { rating, calibration? } } — per slug the latest tap (any date) that has a
 * rating; a time is kept only with 👍 or 👎.
 */
function tgRvCheckins(slug) {
  var out = {}, at = {};
  if (typeof TG_CHECKIN === 'undefined') return out;
  tgChoiceList(slug, TG_CHECKIN.RUN, 'review').forEach(function (c) {
    var cut = c.key.indexOf('|'), s = cut < 0 ? '' : c.key.slice(cut + 1);
    if (!s || ['up', 'down', 'skipped'].indexOf(c.value) < 0) return;
    if (at[s] && at[s] > c.updated_at) return;
    at[s] = c.updated_at;
    out[s] = { rating: c.value };
    if (c.value !== 'skipped' && ['longer', 'shorter', 'right'].indexOf(c.text) >= 0) out[s].calibration = c.text;
  });
  return out;
}
function tgRvShort(r) {
  if (!r) return '';
  return ({ up: '👍', down: '👎', skipped: '⏭' }[r.rating] || '') + (r.calibration ? ' ' + ({ longer: '⏩', shorter: '⏪', right: '👌' }[r.calibration] || '') : '');
}
function tgRvHead(state) {
  var it = state.items[state.i];
  return '<i>' + (state.i + 1) + ' of ' + state.items.length + ' · ' + tgEscape(state.title) + '</i>\n<b>' + tgEscape(it.name) + '</b> — ' + tgCmdDate(it.date) +
    (it.minutes ? ' · ' + tgCmdMinutes(it.minutes) + ' planned' : '') +
    (state.pre && state.pre[it.slug] ? '\n<i>Evening check-in: ' + tgRvShort(state.pre[it.slug]) + ' — kept unless you change it</i>' : '');
}
function tgRvStep(state) {
  if (state.phase === 'all') {
    var n = Object.keys(state.pre || {}).length;
    return { prompt: '⭐ <b>' + tgEscape(state.title || state.trip) + '</b>: all ' + n + ' place' + (n === 1 ? ' is' : 's are') +
      ' rated from your evening check-ins.', expect: 'button', state: state,
      keyboard: [[{ text: '📨 Send my ratings', value: 'send' }], [{ text: '🔁 Review again', value: 'again' }]] };
  }
  if (state.i >= state.items.length) return tgRvFinish(state);
  if (state.phase === 'cal') {
    return { prompt: tgRvHead(state) + '\nAnd the time there?', expect: 'button', state: state,
      keyboard: [[{ text: '⏩ Needed longer', value: 'l' }, { text: '⏪ Less was fine', value: 'h' }, { text: '👌 About right', value: 'r' }], [{ text: '⏭ Not sure', value: 'n' }]] };
  }
  return { prompt: tgRvHead(state) + '\nWorth it?', expect: 'button', state: state,
    keyboard: [[{ text: '👍 Worth it', value: 'u' }, { text: '👎 Not really', value: 'd' }, { text: '⏭ Skipped it', value: 's' }], [{ text: '✅ Finish', value: 'fin' }]] };
}
/**
 * The prefs payload: rated items in stop order over every stop of the trip — the review's answer, else the check-in's.
 * The review's rating wins; its time too, and when it gave none (⏭ Not sure) the check-in's time stays, never for a skip.
 */
function tgRvReview(state) {
  var items = [], pre = state.pre || {};
  (state.all || state.items).forEach(function (it) {
    var r = state.r[it.slug], c = pre[it.slug];
    if (!r && !c) return;
    var o = { slug: it.slug, rating: r ? r.rating : c.rating };
    var cal = r && r.calibration ? r.calibration : (c && c.calibration && o.rating !== 'skipped' ? c.calibration : '');
    if (cal) o.calibration = cal;
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

/**
 * A review's starting state: every stop of the trip, less those an evening check-in rated (kept in state.pre, all stops
 * in state.all); phase 'all' when nothing is left to ask.
 */
function tgRvState(slug) {
  var t = tgTripGet(slug);
  var all = t ? tgRvItems(t.slug) : [], pre = t ? tgRvCheckins(t.slug) : {}, kept = {};
  all.forEach(function (it) { if (pre[it.slug]) kept[it.slug] = pre[it.slug]; });
  var state = { trip: t ? t.slug : String(slug || ''), title: t ? (t.title || t.destination || t.slug) : '', items: all, i: 0, phase: 'rate', r: {} };
  if (Object.keys(kept).length) {
    state.pre = kept; state.all = all;
    state.items = all.filter(function (it) { return !kept[it.slug]; });
    if (!state.items.length) state.phase = 'all';
  }
  return state;
}

registerFlow('review', {
  ttl_min: TG_RV_TTL_MIN,
  /** seed = { trip } */
  start: function (seed) {
    var state = tgRvState(seed && seed.trip);
    if (!state.items.length && !state.all) return { prompt: 'No planned stops to review for <b>' + tgEscape(state.title || state.trip) + '</b>.', done: true, state: state };
    tgRvMarkOffered(state.trip);
    tgChoiceClear(state.trip, TG_RV_RUN, 'review');   // the review's own taps only; check-in taps stay (WP-12b)
    return tgRvStep(state);
  },
  next: function (state, input) {
    if (input.type !== 'button') return tgRvStep(state);
    var v = String(input.value || ''), it = state.items[state.i];
    if (state.phase === 'all') {
      if (v === 'send') return tgRvFinish(state);
      if (v === 'again') { state.items = state.all || state.items; state.i = 0; state.phase = 'rate'; state.again = true; }
      return tgRvStep(state);
    }
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
  var ended = tgTripList().filter(function (t) { return t.status !== 'done' && t.end && t.end < tgTripToday(t); });   // each trip's own day
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
// rv:send:<trip key> — the offer's one-tap 📨 Send my ratings, shown when evening check-ins rated every stop (WP-12b).
registerCallback('rv', function (ctx) {
  if ((ctx.parts[0] !== 'go' && ctx.parts[0] !== 'send') || ctx.parts.length !== 2) { ctx.answer('Unknown button'); return; }
  var trip = tgCmdTripByKey(ctx.parts[1]);
  if (!trip) { ctx.answer('That trip is gone.'); return; }
  if (ctx.parts[0] === 'send') {
    var st = tgRvState(trip.slug);
    if (trip.status === 'done') { ctx.answer('Already sent — /review rates the trip again.'); return; }
    if (st.phase !== 'all' || flowActive(ctx.chatId)) { ctx.answer(''); tgRvStart(ctx.chatId, trip); return; }
    ctx.answer('Sending');
    tgRvMarkOffered(trip.slug);
    tgChoiceClear(trip.slug, TG_RV_RUN, 'review');
    tgSend(ctx.chatId, tgRvFinish(st).prompt);
    return;
  }
  ctx.answer('');
  tgRvStart(ctx.chatId, trip);
});

/** Daily: offer /review once, the day after a trip ends (planned or delivered, with stops, ended ≤ 7 days ago). */
function tgRvOffer() {
  var chat = tgOwnerChat();
  if (!chat) return { offered: [] };
  var map = safeJsonParse(settingGet(TG_SETTINGS.REVIEW_OFFERED, '') || '{}');
  map = map.ok && isPlainObject(map.value) ? map.value : {};
  var offered = [];
  tgTripList().forEach(function (t) {
    var today = tgTripToday(t);   // the day after the trip ends where the trip was (WP-10a)
    if (!t.end || t.end >= today || map[t.slug] || t.review_offered_at) return;
    if (t.status !== 'planned' && t.status !== 'delivered') return;
    var ago = tgCmdDaysBetween(t.end, today);
    if (ago === null || ago > TG_RV_OFFER_WINDOW_DAYS) return;
    var items = tgRvItems(t.slug), pre = tgRvCheckins(t.slug);
    if (!items.length) return;
    var n = items.filter(function (it) { return !pre[it.slug]; }).length, done = items.length - n;
    var ask = n ? 'Rate the ' + n + ' place' + (n === 1 ? '' : 's') + (done ? ' your evening check-ins left open' : '') + ' in two minutes? It shapes the next plan.'
      : 'Your evening check-ins rated all ' + done + ' place' + (done === 1 ? '' : 's') + ' — send them in one tap? It shapes the next plan.';
    tgSend(chat, '🧳 Welcome back from <b>' + tgCmdTitle(t) + '</b>. ' + ask,
      { keyboard: tgKeyboard([[{ text: n ? '⭐ Review the trip' : '📨 Send my ratings', data: cbEncode('rv', n ? 'go' : 'send', tgCmdTripKey(t.slug)) }]]) });
    tgRvMarkOffered(t.slug);
    offered.push(t.slug);
  });
  return { offered: offered };
}
registerDailyJob('tg_review_offer', tgRvOffer);

// Developed by: LightAISolutions
