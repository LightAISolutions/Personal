/**
 * Tour Guide pack — "re-plan from here" (WP-12b, TG-PHASE-12 §5): 📍 on the morning message and on the running-late reply
 * (rp:<trip key>:<yyyymmdd>) asks, on the trip's today only, where the rest of the day starts:
 *   📍 From <the current stop> — the stop the day (running-late overlay included) has the owner at, else the last one started;
 *   📡 Share my location — a one-time reply-keyboard button with request_location;
 *   ☔ Rain — indoor first — from the current stop (no stop started yet: the whole day, rain first);
 *   ✖️ Cancel.
 * The answer opens one `replan` request: { trip, dates: [today], deliverables, from: { time, place } | { time, point },
 * visited: [slugs ended by now, + the current stop when starting from it], rain?: true, reason }. The old private pin reads
 * only trip, dates, promote, demote, reason and trip_update, so it re-plans the whole day (SPEC §16, the pack README).
 *   Location  used for that one request (the request file is its transport) and kept nowhere else: not in Settings
 *             (tg_here_wait holds the trip, date, stop and button labels only), not in a sheet, the audit log or a reply;
 *             the router withholds it from a deferred update (core tgWithholdLocation). A location nobody asked for is
 *             ignored without a word. The reply keyboard is removed after an answer, on Cancel and when the question
 *             times out (WAIT_MIN, alarm tg_here).
 * Defaults: helpers/decisions/WP-12b.md.
 */
var TG_HERE = {
  SETTING: 'tg_here_wait',
  WAIT_MIN: 10,          // the question times out after this; the reply keyboard is removed
  VISITED_MAX: 25,       // C12 visited ≤ 25
  POINT_DECIMALS: 5,     // a shared point is rounded to about a metre before it leaves
  NAME_MAX: 40           // a stop name on a reply-keyboard button
};

/* ---------------- where the day is now ---------------- */
/**
 * The day at time hm (overlay included) → { ended: [slugs whose depart ≤ hm, in order], current: stop | null } — the
 * current stop is the one under way (arrive ≤ hm < depart), else the last one started.
 */
function tgHerePos(view, hm) {
  var now = _tgLateMin(hm), ended = [], current = null, started = null;
  (view.stops || []).forEach(function (s) {
    if (!s || !s.slug) return;
    var a = _tgLateMin(s.arrive), d = _tgLateMin(s.depart);
    if (a === null || now === null || a > now) return;
    started = s;
    if (d !== null && d <= now) ended.push(s.slug); else current = s;
  });
  return { ended: ended, current: current || started };
}

/* ---------------- the waiting question ---------------- */
function tgHereWait() {
  var v = tgShJson(settingGet(TG_HERE.SETTING, ''), null);
  return isPlainObject(v) && v.trip && v.date && isPlainObject(v.labels) ? v : null;
}
function tgHereWaitSet(w) { settingSet(TG_HERE.SETTING, w ? toJson(w) : '', 're-plan from here: the open question (no location)'); }
function tgHereRemoveKb() { return { remove_keyboard: true }; }
/** Close the question: clear it, then tell the owner with the reply keyboard removed. */
function tgHereClose(chat, html) {
  tgHereWaitSet(null);
  _safe('tg_here_arm', function () { alarmArm(); });
  if (chat) tgSend(chat, html, { keyboard: tgHereRemoveKb() });
}
/** Ask where the rest of today starts (a reply keyboard); refuses another date, an empty day and an active conversation. */
function tgHereAsk(chat, trip, date) {
  var day = tgDigestDay(trip.slug, date);
  if (!day || day.date !== date) return 'No plan for today in ' + tgCmdTitle(trip) + '.';
  if (date !== tgTripToday(trip) || !tgTripInProgress(trip)) return 'Re-plan from here works on the day itself.';
  if (typeof flowActive === 'function' && flowActive(chat)) return 'Finish the current conversation first (or /cancel it).';
  var pos = tgHerePos(tgLateView(trip, day), tgLateNowHm(trip));
  // From the current stop and rain-proof from there need a stop under way (or ended); before the first one only a shared
  // location can say where the day restarts (the planner ignores visited and rain without from).
  var labels = { loc: '📡 Share my location', cancel: '✖️ Cancel' }, rows = [];
  if (pos.current) {
    labels.from = '📍 From ' + truncate(String(pos.current.name || pos.current.slug), TG_HERE.NAME_MAX);
    labels.rain = '☔ Rain — indoor first';
    rows.push([{ text: labels.from }]);
  }
  rows.push([{ text: labels.loc, request_location: true }]);
  if (labels.rain) rows.push([{ text: labels.rain }]);
  rows.push([{ text: labels.cancel }]);
  tgHereWaitSet({ trip: trip.slug, date: date, stop: pos.current ? pos.current.slug : '', labels: labels,
    until: new Date(nowMs() + TG_HERE.WAIT_MIN * 60000).toISOString() });
  _safe('tg_here_arm', function () { alarmArm(); });
  tgSend(chat, '📍 <b>Re-plan the rest of today</b> — from where?\n' +
    (pos.current ? 'From <b>' + tgEscape(pos.current.name) + '</b>, from where you are, or rain-proof from there.' : 'Nothing has started yet: share where you are.') +
    '\n<i>A shared location is used for this one re-plan and kept nowhere. The question closes in ' + TG_HERE.WAIT_MIN + ' min.</i>',
    { keyboard: { keyboard: rows, one_time_keyboard: true, resize_keyboard: true } });
  return '';
}

/* ---------------- the request ---------------- */
function _tgHereRound(x) { var f = Math.pow(10, TG_HERE.POINT_DECIMALS); return Math.round(x * f) / f; }
/** A Telegram location → { lat, lng } rounded, or null when it is not two numbers in range. */
function tgHerePoint(loc) {
  if (!isPlainObject(loc)) return null;
  var lat = loc.latitude, lng = loc.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: _tgHereRound(lat), lng: _tgHereRound(lng) };
}
/**
 * C12's request fields, checked with the planner's bounds (planner restartErrors, Contract C12): from { time, place |
 * point } with exactly one of them (place a slug, never the reserved 'here'; point { lat, lng } only), visited ≤ 25 slugs
 * without repeats, rain only true. The planner ignores visited and rain without from, so from is required. → '' or the field.
 */
function tgHereCheck(p) {
  var f = p.from, keys = isPlainObject(f) ? Object.keys(f) : [];
  if (!isPlainObject(f) || !tgCmdDayClock(f.time) || keys.some(function (k) { return ['time', 'place', 'point'].indexOf(k) < 0; })) return 'from';
  if ((f.place !== undefined) === (f.point !== undefined)) return 'from';
  if (f.place !== undefined && !(typeof f.place === 'string' && TG_SLUG_RE.test(f.place) && f.place !== 'here')) return 'from.place';
  if (f.point !== undefined) {
    var pt = f.point;
    if (!isPlainObject(pt) || Object.keys(pt).some(function (k) { return k !== 'lat' && k !== 'lng'; })) return 'from.point';
    if (!(typeof pt.lat === 'number' && pt.lat >= -90 && pt.lat <= 90 && typeof pt.lng === 'number' && pt.lng >= -180 && pt.lng <= 180)) return 'from.point';
  }
  if (p.visited !== undefined) {
    if (!Array.isArray(p.visited) || p.visited.length > TG_HERE.VISITED_MAX) return 'visited';
    var seen = {};
    for (var i = 0; i < p.visited.length; i++) {
      var s = p.visited[i];
      if (typeof s !== 'string' || !TG_SLUG_RE.test(s) || seen[s]) return 'visited';
      seen[s] = true;
    }
  }
  if (p.rain !== undefined && p.rain !== true) return 'rain';
  return '';
}
/**
 * Build and open the replan request for one choice ('from' | 'loc' | 'rain'); point only for 'loc'. → { payload, r }
 * or { error }. The time is the trip-local clock now; what has ended is read from the day as shown (overlay included).
 */
function tgHereRequest(chat, trip, date, choice, point) {
  var day = tgDigestDay(trip.slug, date);
  if (!day) return { error: 'No plan for today in ' + tgCmdTitle(trip) + '.' };
  var hm = tgLateNowHm(trip), pos = tgHerePos(tgLateView(trip, day), hm), visited = pos.ended.slice(), where;
  var payload = { trip: trip.slug, dates: [date], deliverables: tgCmdDeliverables(trip) };
  if (choice === 'loc') {
    if (!point) return { error: 'That location could not be read — share it again.' };
    payload.from = { time: hm, point: point };
    where = 'where you are';
  } else if (pos.current) {
    if (visited.indexOf(pos.current.slug) < 0) visited.push(pos.current.slug);
    payload.from = { time: hm, place: pos.current.slug };
    where = tgEscape(pos.current.name);
  } else return { error: 'No stop has started yet — share your location instead.' };
  if (choice === 'rain') payload.rain = true;
  if (visited.length) payload.visited = visited.slice(0, TG_HERE.VISITED_MAX);
  payload.reason = 'Re-plan the rest of ' + date + ' from ' + (choice === 'loc' ? 'where I am now' : pos.current.name) +
    ' at ' + hm + (choice === 'rain' ? ', rain-proof: indoor and covered places first' : '') + '; keep what I have already done.';
  var bad = tgHereCheck(payload);
  if (bad) { auditFail('tg_here_bad_request', trip.slug, { date: date, field: bad }); return { error: 'That re-plan could not be built (' + bad + ').' }; }
  var r = tgOpenKindRequest('replan', payload, { chat: null, text: 're-plan from here · ' + date, ack: false });
  audit('tg_here', trip.slug, { date: date, choice: choice, visited: visited.length, rain: choice === 'rain' });
  return { payload: payload, r: r, where: where, hm: hm };
}

/* ---------------- the answer ---------------- */
/** Open the request for the answer and confirm it with the reply keyboard removed. */
function tgHereAnswer(chat, w, choice, point) {
  var trip = tgTripGet(w.trip);
  if (!trip || w.date !== tgTripToday(trip)) { tgHereClose(chat, '⌛ That question was for another day — tap 📍 Re-plan from here again.'); return; }
  var out = tgHereRequest(chat, trip, w.date, choice, point);
  if (out.error) { tgHereClose(chat, tgEscape(out.error)); return; }
  var fired = out.r && out.r.fired && out.r.fired.ok;
  tgHereClose(chat, (choice === 'rain' ? '☔' : '📍') + ' Re-planning the rest of today from <b>' + out.where + '</b> (' + tgEscape(out.hm) + ')' +
    (choice === 'rain' ? ', indoor and covered places first' : '') + '.\nIt runs in the background; the day card updates when the new plan is ready — /today shows it.' +
    (fired ? '' : '\n⏳ The routine could not be started right now; it will see the request on its next run.'));
}

/**
 * Owner messages while the question waits (named to run before every other handler): a shared location answers it; the
 * exact button texts answer it; anything else passes on. A location with no question waiting is ignored without a word.
 */
registerMessageHandler('tg_a_here', function (ctx) {
  var msg = ctx.message || {}, located = msg.location !== undefined || msg.venue !== undefined || msg.hb_location_withheld === true;
  var w = tgHereWait();
  if (!w) return located;
  if (Date.parse(w.until) <= nowMs()) {
    tgHereWaitSet(null);
    if (located) return true;   // too late: a stray location, said nothing about
    var stale = ctx.text.trim(), labels = w.labels;
    if (Object.keys(labels).some(function (k) { return labels[k] === stale; })) {
      tgSend(ctx.chatId, '⌛ That question timed out — tap 📍 Re-plan from here again.', { keyboard: tgHereRemoveKb() });
      return true;
    }
    return false;
  }
  if (located) {
    if (msg.hb_location_withheld === true && msg.location === undefined && msg.venue === undefined) {
      tgSend(ctx.chatId, '📡 That location arrived while I was busy and was not kept — please share it again.');
      return true;
    }
    var pt = tgHerePoint(msg.location !== undefined ? msg.location : (msg.venue || {}).location);
    if (!pt) { tgSend(ctx.chatId, '📡 That location could not be read — please share it again.'); return true; }
    tgHereAnswer(ctx.chatId, w, 'loc', pt);
    return true;
  }
  var t = ctx.text.trim();
  if (t === w.labels.cancel) { tgHereClose(ctx.chatId, '✖️ No re-plan — the day stays as it is.'); return true; }
  if (w.labels.from && t === w.labels.from) { tgHereAnswer(ctx.chatId, w, 'from'); return true; }
  if (w.labels.rain && t === w.labels.rain) { tgHereAnswer(ctx.chatId, w, 'rain'); return true; }
  return false;
});

/** The question times out: cleared, and the reply keyboard removed. */
registerAlarm('tg_here', {
  next: function () { var w = tgHereWait(); return w ? Date.parse(w.until) : null; },
  run: function (now) {
    var w = tgHereWait();
    if (!w || Date.parse(w.until) > now + LIMITS.ALARM_EARLY_SEC * 1000) return;
    tgHereWaitSet(null);
    tgSendOwner('⌛ No re-plan — the question timed out. The day stays as it is.', { keyboard: tgHereRemoveKb() });
  }
});

/** rp:<trip key>:<yyyymmdd> — exactly that shape; today only. */
registerCallback('rp', function (ctx) {
  var p = ctx.parts;
  if (p.length !== 2 || !/^\d{8}$/.test(String(p[1]))) { ctx.answer('Unknown button'); return; }
  var trip = tgCmdTripByKey(p[0]), date = tgLateDate8(p[1]);
  if (!trip || !tgEnvRealDate(date)) { ctx.answer('That trip is gone.'); return; }
  var why = tgHereAsk(ctx.chatId, trip, date);
  ctx.answer(why || 'Where from?', !!why);
});

// Developed by: LightAISolutions
