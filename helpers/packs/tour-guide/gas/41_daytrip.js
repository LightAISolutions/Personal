/**
 * Tour Guide pack — Day trip (TG-PHASE-15 WP-15a, Contract C15): from any base, a ranked board of up to 8 day trips within
 * a one-way ride limit; the owner keeps the ones they like and, on a trip with planned days, puts one on a day.
 *   /daytrip [from] <place> [under <N> min|h] [on <date>] → request kind `daytrip` { trip?, from?, date?, max_minutes }
 *                           (no place: from where the current trip stays; no place and no trip: a one-line how-to, nothing
 *                           asked); routed to RESEARCH (TG_KIND_ROUTINE), or to DISCOVER when configured (TG_DISCOVER_KINDS)
 *   /daytrips             → the last 10 boards, kept trips first (✅), each with a 🚆 button that resends its card
 *   envelope `daytrip`    → validated (tgEnvValidateDaytrip, mirror of schemas/tour-guide-daytrip.schema.json and of
 *                           packs/tour-guide/daytrip/daytrip-payload.mjs; own data only, every Google field refused), stored
 *                           in the DayTrips tab (a re-delivered id replaces its row and keeps what was kept), then the card
 *   callback dt:<key>:<n> → keep or un-keep item n; then, on a trip with planned days, "Put <name> on a day?"
 *            dt:<key>:<n>.<d> → that kept trip onto planned day d: a `replan` { trip, dates, daytrip: { board, n } }
 *            dt:<key>:s  → resend the card
 *   state.json `daytrips_kept` (C15) → the kept trips of boards whose trip is not done, and of boards without a trip
 * Board keys are "k" + 12 hex of the board id's hash (Scout's rule). App operations: gas/33_daytrip_app.js. Pack side:
 * packs/tour-guide/daytrip/. Tests: tests/pack_tour-guide_daytrip*.test.js. Defaults: helpers/decisions/WP-15a.md.
 * The @branch line below tells `new-branch.mjs --check daytrip` what this branch declares ("-" = not needed); keep it in step.
 */
// @branch daytrip command=/daytrip kind=daytrip envelope=daytrip tab=DayTrips routine=RESEARCH app=yes discover=yes
var TG_DAYTRIP = {
  SHEET: 'DayTrips', PAYLOAD_MAX: 20000, LIST_MAX: 20, CHAT_LIST: 10, ITEMS_MAX: 8, LEFT_MAX: 20, MORE_MAX: 50, KEPT_MAX: 20,
  MIN: 30, MAX: 180, DEFAULT: 90, FROM_MAX: 80,
  ID_RE: /^dt-\d{8}-[a-z0-9-]{1,40}$/, KEY_RE: /^k[0-9a-f]{12}$/
};
var TG_DAYTRIP_LABELS = ['gem', 'veg_easy', 'booking', 'crowded', 'rain_ok', 'seen_before'];
var TG_DAYTRIP_LEFT = ['too_far', 'no_rail', 'closed_on_dates', 'out_of_season', 'duplicate', 'other'];
var TG_DAYTRIP_LENGTHS = ['half', 'full'];
var TG_DAYTRIP_LEFT_WORDS = { too_far: 'too far', no_rail: 'no train or bus', closed_on_dates: 'closed on your dates',
  out_of_season: 'out of season', duplicate: 'duplicate', other: 'other' };

// The kind's routing, added from this file: tgKindRoutine (00_common.js) reads the table at call time.
TG_KIND_ROUTINE['daytrip'] = 'RESEARCH';
// A discovery kind (--discover): with a DISCOVER routine configured, tgKindRoutine sends it there instead.
if (TG_DISCOVER_KINDS.indexOf('daytrip') < 0) TG_DISCOVER_KINDS.push('daytrip');

registerSheet(TG_DAYTRIP.SHEET, ['id', 'trip', 'base_label', 'created_on', 'max_minutes', 'date', 'count', 'payload_json', 'kept_json', 'received_at']);

/* ==================== the owner's words ==================== */

var TG_DAYTRIP_UNDER_RE = /(?:^|\s+)under\s+(\d{1,3}(?:\.\d{1,2})?)\s*(min|mins|minute|minutes|m|h|hr|hrs|hour|hours)?\s*$/i;
var TG_DAYTRIP_ON_RE = /(?:^|\s+)on\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}|today|tomorrow)\s*$/i;

function tgDaytripClean(s) { return String(s === undefined || s === null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim(); }
function tgDaytripAddDays(date, n) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date));
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n)).toISOString().slice(0, 10);
}
/** Minutes from the "under" clause's number and unit, clamped to 30–180. */
function tgDaytripUnder(num, unit) {
  var m = Math.round(Number(num) * (/^h/i.test(String(unit || '')) ? 60 : 1));
  return Math.min(TG_DAYTRIP.MAX, Math.max(TG_DAYTRIP.MIN, m));
}
/** The "on" clause's date: { date } | { why: 'bad_date' | 'past_date' }. M/D is the next such date from today, today included. */
function tgDaytripDate(token, today) {
  var t = String(token).toLowerCase(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
  if (t === 'today') return { date: today };
  if (t === 'tomorrow') return { date: tgDaytripAddDays(today, 1) };
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    if (!tgEnvRealDate(t)) return { why: 'bad_date' };
    return t < today ? { why: 'past_date' } : { date: t };
  }
  var m = /^(\d{1,2})\/(\d{1,2})$/.exec(t), y = +String(today).slice(0, 4);
  for (var k = 0; m && k <= 8; k++) {
    var d = (y + k) + '-' + pad(+m[1]) + '-' + pad(+m[2]);
    if (tgEnvRealDate(d) && d >= today) return { date: d };
  }
  return { why: 'bad_date' };
}
/**
 * The owner's words → { ok: true, from, max_minutes, date | null } | { ok: false, why: 'bad_date' | 'past_date' | 'too_long' }.
 * Mirror of parseDaytripText (packs/tour-guide/daytrip/daytrip-text.mjs) rule for rule; the shared case list
 * daytrip/fixtures/daytrip-parse-cases.json holds both to one answer. "under …" and "on …" close the text, each at most
 * once, in either order; "on" before anything but a date stays part of the place ("Stoke on Wyvern").
 */
function tgDaytripParse(text, today) {
  var s = tgDaytripClean(text).replace(/^\/daytrip(@[A-Za-z0-9_]+)?(\s+|$)/i, '').replace(/[?.!]+$/, '').trim();
  var max = TG_DAYTRIP.DEFAULT, date = null, onDone = false, underDone = false, m;
  for (var i = 0; i < 2; i++) {
    if (!onDone && (m = TG_DAYTRIP_ON_RE.exec(s))) {
      var r = tgDaytripDate(m[1], today);
      if (r.why) return { ok: false, why: r.why };
      date = r.date; onDone = true; s = s.slice(0, m.index).trim(); continue;
    }
    if (!underDone && (m = TG_DAYTRIP_UNDER_RE.exec(s))) {
      max = tgDaytripUnder(m[1], m[2]); underDone = true; s = s.slice(0, m.index).trim(); continue;
    }
    break;
  }
  var from = tgDaytripClean(s.replace(/^from(\s+|$)/i, ''));
  if (from.length > TG_DAYTRIP.FROM_MAX) return { ok: false, why: 'too_long' };
  return { ok: true, from: from, max_minutes: max, date: date };
}
/** Today where the trip is (the owner's zone without a trip): the day an M/D and "tomorrow" count from. */
function tgDaytripToday(trip) { return trip ? tgTripToday(trip) : isoDateIn(getTz()); }

/* ==================== asking ==================== */

var TG_DAYTRIP_USAGE = '🚆 From where? <code>/daytrip from Lyon under 90 min on 5/14</code> — with a trip planned, <code>/daytrip</code> alone starts from where you stay.';
var TG_DAYTRIP_WHY = {
  too_long: '🚆 Please keep the place under ' + TG_DAYTRIP.FROM_MAX + ' characters — nothing was asked.',
  bad_date: '🚆 I could not read that date — try <code>on 2027-05-14</code>, <code>on 5/14</code>, <code>on today</code> or <code>on tomorrow</code>. Nothing was asked.',
  past_date: '🚆 That date has already passed — nothing was asked.',
  bad_minutes: '🚆 The ride limit must be ' + TG_DAYTRIP.MIN + '–' + TG_DAYTRIP.MAX + ' minutes — nothing was asked.',
  no_trip: TG_DAYTRIP_USAGE
};
/** The request text the app's daytrip.new writes (the chat sends the owner's words as typed). */
function tgDaytripText(from, max, date) {
  return '/daytrip ' + (from ? 'from ' + from + ' ' : '') + 'under ' + max + ' min' + (date ? ' on ' + date : '');
}
/**
 * Open a `daytrip` request (C15): opts = { from?, maxMinutes? (30–180, default 90), date? (YYYY-MM-DD, not past), chat?,
 * text? }. `trip` is the current trip whenever there is one (the routine decides whether the base belongs to it); no
 * `from` means from where that trip stays. No `from` and no trip: nothing is asked.
 * → { ok: true, id, routine, fired, trip, from, max_minutes, date } | { ok: false, why: 'no_trip' | 'too_long' | 'bad_minutes' | 'bad_date' | 'past_date' }
 */
function tgDaytripOpen(opts) {
  opts = opts || {};
  var from = tgDaytripClean(opts.from), max = opts.maxMinutes === undefined || opts.maxMinutes === null ? TG_DAYTRIP.DEFAULT : opts.maxMinutes;
  var date = opts.date || '', trip = tgTripCurrent();
  if (typeof max !== 'number' || Math.floor(max) !== max || max < TG_DAYTRIP.MIN || max > TG_DAYTRIP.MAX) return { ok: false, why: 'bad_minutes' };
  if (from.length > TG_DAYTRIP.FROM_MAX) return { ok: false, why: 'too_long' };
  if (date && !tgEnvRealDate(date)) return { ok: false, why: 'bad_date' };
  if (date && date < tgDaytripToday(trip)) return { ok: false, why: 'past_date' };
  if (!from && !trip) return { ok: false, why: 'no_trip' };
  var payload = {};
  if (trip) payload.trip = trip.slug;
  if (from) payload.from = from;
  if (date) payload.date = date;
  payload.max_minutes = max;
  var r = tgOpenKindRequest('daytrip', payload, { chat: opts.chat || null, text: opts.text || tgDaytripText(from, max, date),
    ack: '🚆 Looking for day trips from ' + (from ? '<b>' + tgEscape(from) + '</b>' : 'where you stay') + ' · under ' + max + ' min' + (date ? ' · ' + tgCmdDate(date) : '') + '…' });
  return { ok: true, id: r.id, routine: r.routine, fired: !!(r.fired && r.fired.ok), trip: payload.trip || '', from: from, max_minutes: max, date: date };
}

registerCommand('/daytrip', function (ctx) {
  var q = tgDaytripParse(String(ctx.args || ''), tgDaytripToday(tgTripCurrent()));
  if (!q.ok) { ctx.reply(TG_DAYTRIP_WHY[q.why]); return; }
  // The request carries the owner's words as typed; the engine's parse of them is the one that counts (Scout's rule).
  var r = tgDaytripOpen({ from: q.from, maxMinutes: q.max_minutes, date: q.date, chat: ctx.chat, text: String(ctx.text || '') });
  if (!r.ok) ctx.reply(TG_DAYTRIP_WHY[r.why] || TG_DAYTRIP_USAGE);
}, 'day trips worth the ride from a base: /daytrip from Lyon under 90 min');

/* ==================== the DayTrips tab ==================== */

function tgDaytripJson(v, def) {
  if (v === undefined || v === null || v === '') return def;
  var p = typeof v === 'string' ? safeJsonParse(v) : { ok: true, value: v };
  return p.ok ? p.value : def;
}
/** A row → { id, trip, base: { label, slug }, created_on, max_minutes, date, count, items, more, left_out, kept, received_at }. */
function tgDaytripRec(r) {
  if (!r) return null;
  var p = tgDaytripJson(r.payload_json, {}), kept = tgDaytripJson(r.kept_json, []);
  if (!isPlainObject(p)) p = {};
  var base = isPlainObject(p.base) ? p.base : {};
  return { id: tgShStr(r.id), trip: tgShStr(r.trip), base: { label: tgShStr(base.label) || tgShStr(r.base_label), slug: tgShStr(base.slug) },
    created_on: tgShDate(r.created_on), max_minutes: tgShInt(r.max_minutes, 0), date: tgShDate(r.date), count: tgShInt(r.count, 0),
    items: Array.isArray(p.items) ? p.items.filter(isPlainObject) : [], more: typeof p.more === 'number' ? p.more : 0,
    left_out: Array.isArray(p.left_out) ? p.left_out.filter(isPlainObject) : [],
    kept: Array.isArray(kept) ? kept.filter(function (k) { return isPlainObject(k) && typeof k.slug === 'string'; }) : [],
    received_at: tgShStr(r.received_at) };
}
function tgDaytripRow(id) {
  id = String(id || '');
  if (!TG_DAYTRIP.ID_RE.test(id)) return null;
  return storeFind(TG_DAYTRIP.SHEET, function (r) { return tgShStr(r.id) === id; }, 1)[0] || null;
}
/** The stored board, or null. */
function tgDaytripGet(id) { return tgDaytripRec(tgDaytripRow(id)); }
/** Newest first (received_at, then row order); limit optional. */
function tgDaytripList(limit) {
  var rows = storeAll(TG_DAYTRIP.SHEET).map(function (r) { var x = tgDaytripRec(r); x._row = r._row; return x; });
  rows.sort(function (a, b) { return a.received_at !== b.received_at ? (a.received_at < b.received_at ? 1 : -1) : b._row - a._row; });
  rows.forEach(function (x) { delete x._row; });
  return limit ? rows.slice(0, limit) : rows;
}
/** Kept entries in board order, renumbered from the items they point at (an entry whose slug left the board is dropped). */
function tgDaytripKeptFor(items, kept) {
  var out = [];
  (kept || []).forEach(function (k) {
    var it = items.filter(function (x) { return x.slug === k.slug; })[0];
    if (!it || out.some(function (o) { return o.slug === k.slug; })) return;
    var e = { n: it.n, slug: it.slug };
    if (typeof k.date === 'string' && tgEnvRealDate(k.date)) e.date = k.date;
    e.at = String(k.at || nowIso());
    out.push(e);
  });
  return out.sort(function (a, b) { return a.n - b.n; });
}
/** Store a validated payload; a re-delivered id replaces its row and keeps each kept entry still on the board. → { rec, replaced, dropped } */
function tgDaytripStore(p) {
  var old = tgDaytripGet(p.id), items = p.items || [], kept = tgDaytripKeptFor(items, old ? old.kept : []);
  storeUpsertById(TG_DAYTRIP.SHEET, { id: p.id, trip: p.trip || '', base_label: p.base.label, created_on: p.created_on,
    max_minutes: p.max_minutes, date: p.date || '', count: items.length, payload_json: toJson(p), kept_json: toJson(kept), received_at: nowIso() });
  return { rec: tgDaytripGet(p.id), replaced: !!old, dropped: old ? old.kept.length - kept.length : 0 };
}
function tgDaytripSaveKept(rec, kept) {
  var row = tgDaytripRow(rec.id);
  if (!row) return null;
  storeUpdate(TG_DAYTRIP.SHEET, row._row, { kept_json: toJson(tgDaytripKeptFor(rec.items, kept)) });
  return tgDaytripGet(rec.id);
}
/** The kept entry of item n, or null. */
function tgDaytripKeptOf(rec, n) {
  var it = rec.items.filter(function (x) { return x.n === n; })[0];
  return it ? rec.kept.filter(function (k) { return k.slug === it.slug; })[0] || null : null;
}
/** The board's own trip while it is on file and not done (the trip a kept day trip goes into), else null. */
function tgDaytripTrip(rec) {
  var t = rec && rec.trip ? tgTripGet(rec.trip) : null;
  return t && t.status !== 'done' ? t : null;
}

/* ==================== keep, and put on a day ==================== */

/**
 * Keep (keep = true) or un-keep item n of a board; with a date (a planned day of the board's trip), also store that date
 * and open the `replan` that plans the day as this day trip (C15 replan `daytrip`): dates = [date, plus the old date when
 * the trip moves from one]. The chat buttons and the app's daytrip.keep both come here.
 * → { ok: true, rec, item, kept, day?, replan? } | { ok: false, why: 'no_item' | 'no_trip' | 'no_day' }
 */
function tgDaytripKeep(rec, n, keep, date) {
  var it = rec.items.filter(function (x) { return x.n === n; })[0];
  if (!it || !TG_SLUG_RE.test(String(it.slug || ''))) return { ok: false, why: 'no_item' };
  var old = tgDaytripKeptOf(rec, n), kept = rec.kept.filter(function (k) { return k.slug !== it.slug; });
  var out = { ok: true, item: it, kept: !!keep };
  if (keep) {
    var e = { n: it.n, slug: it.slug, at: old ? old.at : nowIso() };
    if (old && old.date) e.date = old.date;
    if (date) {
      var trip = tgDaytripTrip(rec);
      if (!trip) return { ok: false, why: 'no_trip' };
      var day = tgDigestDays(trip.slug).filter(function (d) { return d.date === date; })[0];
      if (!day) return { ok: false, why: 'no_day' };
      var dates = [date];
      if (old && old.date && old.date !== date) dates.push(old.date);
      e.date = date;
      var r = tgOpenKindRequest('replan', { trip: trip.slug, dates: dates, daytrip: { board: rec.id, n: it.n }, reason: 'a day trip to ' + truncate(String(it.name), 120),
        deliverables: tgCmdDeliverables(trip) }, { text: 'day trip to ' + it.name + ' on day ' + day.n,
        ack: '🚆 Putting the day trip to <b>' + tgEscape(it.name) + '</b> on day ' + day.n + ' (' + tgCmdDate(day.date) + ') — replanning that day…' });
      out.day = day;
      out.replan = { id: r.id, routine: r.routine, fired: !!(r.fired && r.fired.ok), dates: dates };
    }
    kept.push(e);
  }
  out.rec = tgDaytripSaveKept(rec, kept);
  return out;
}

/* ==================== the card ==================== */

/** A board id as a callback part: always "k" + 12 hex of its hash (the ids run long; Scout's board keys). */
function tgDaytripKey(id) { return 'k' + sha1Hex(String(id || '')).slice(0, 12); }
function tgDaytripByKey(key) {
  key = String(key || '');
  if (!TG_DAYTRIP.KEY_RE.test(key)) return null;
  var all = tgDaytripList();
  for (var i = 0; i < all.length; i++) if (tgDaytripKey(all[i].id) === key) return all[i];
  return null;
}
/** "🚆 ~42 min · full day" — '~' when the minutes come from the estimator. */
function tgDaytripRide(it) {
  var r = isPlainObject(it.ride) ? it.ride : {};
  return '🚆 ' + (r.estimated ? '~' : '') + (r.minutes >= 0 ? r.minutes + ' min' : '?') + ' · ' + (it.length === 'half' ? 'half day' : 'full day');
}
/** "🚆 <b>Day trips from Bramblecombe</b> · under 90 min · Thu 13 May" */
function tgDaytripHeader(rec) {
  return '🚆 <b>Day trips from ' + tgEscape(rec.base.label) + '</b> · under ' + rec.max_minutes + ' min' + (rec.date ? ' · ' + tgCmdDate(rec.date) : '');
}
/** The app button: the shell's Day trips screen opened on this board ([] without APP_SHELL_URL). */
function tgDaytripAppRows(rec, label) {
  var u = tgAppUrl('daytrip', rec.trip || '');
  return u ? [[{ text: label || '📱 Open in the app', web_app: { url: u + '&daytrip=' + encodeURIComponent(rec.id) } }]] : [];
}
/** ➕ n (✅ n when kept), 4 to a row, then 📱 Open in the app; null when there is nothing to show. */
function tgDaytripKeyboard(rec) {
  var key = tgDaytripKey(rec.id), slugs = rec.kept.map(function (k) { return k.slug; });
  var rows = tgCmdRows(rec.items.map(function (it) { return { text: (slugs.indexOf(it.slug) >= 0 ? '✅ ' : '➕ ') + it.n, data: cbEncode('dt', key, it.n) }; }), 4);
  rows = rows.concat(tgDaytripAppRows(rec));
  return rows.length ? tgKeyboard(rows) : null;
}
/** [{ html, keyboard? }]: the header, per item a numbered line and its why, then 🌱 food, 🍂 season and ⛔ closed days when given. What was left out stays in the app. */
function tgDaytripMessages(rec) {
  var lines = [tgDaytripHeader(rec)];
  if (!rec.items.length) lines.push('Nothing worth the ride this time.');
  rec.items.forEach(function (it) {
    lines.push('<b>' + it.n + '.</b> ' + tgCmdHref(it.maps_url, it.name) + ' — ' + tgDaytripRide(it));
    if (it.why) lines.push('<i>' + tgEscape(it.why) + '</i>');
    if (it.eat) lines.push('🌱 ' + tgEscape(it.eat));
    if (it.season) lines.push('🍂 ' + tgEscape(it.season));
    if (Array.isArray(it.closed) && it.closed.length) lines.push('⛔ Closed ' + it.closed.map(tgCmdDate).join(', '));
  });
  if (rec.more > 0) lines.push('<i>…and ' + rec.more + ' more within reach.</i>');
  if (rec.items.length) lines.push('', '➕ keeps a day trip.');
  return tgCmdMessages(lines, tgDaytripKeyboard(rec));
}
function tgDaytripSend(chatId, rec) { return tgCmdSendAll(chatId, tgDaytripMessages(rec)); }

registerCommand('/daytrips', function (ctx) {
  var list = tgDaytripList(TG_DAYTRIP.CHAT_LIST);
  if (!list.length) { ctx.reply('🚆 No day trips yet — try <code>/daytrip from Lyon</code>.'); return; }
  var lines = ['🚆 <b>Your day trips</b>'], btns = [];
  list.forEach(function (b) {
    b.kept.forEach(function (k) {
      var it = b.items.filter(function (x) { return x.slug === k.slug; })[0];
      if (it) lines.push('✅ ' + tgCmdHref(it.maps_url, it.name) + ' — from ' + tgEscape(b.base.label) + ' · ' + tgDaytripRide(it) + (k.date ? ' · ' + tgCmdDate(k.date) : ''));
    });
  });
  list.forEach(function (b, i) {
    lines.push('<b>' + (i + 1) + '.</b> From ' + tgEscape(b.base.label) + ' · under ' + b.max_minutes + ' min · ' + b.count + ' trip' + (b.count === 1 ? '' : 's') +
      (b.date ? ' · ' + tgCmdDate(b.date) : '') + (b.created_on ? ' · asked ' + tgCmdDate(b.created_on) : ''));
    btns.push({ text: '🚆 ' + (i + 1), data: cbEncode('dt', tgDaytripKey(b.id), 's') });
  });
  lines.push('', 'Tap a number to see its board again.');
  tgCmdSendAll(ctx.chatId, tgCmdMessages(lines, tgKeyboard(tgCmdRows(btns, 5).concat(tgAppRows('daytrip', '', '📱 Day trips in the app')))));
}, 'your last 10 day-trip boards and the trips you kept');

/** dt:<key>:s resends · dt:<key>:<n> keeps or un-keeps item n · dt:<key>:<n>.<d> puts kept item n on planned day d (a replan). */
registerCallback('dt', function (ctx) {
  if (ctx.parts.length !== 2) { ctx.answer('Unknown button'); return; }
  var rec = tgDaytripByKey(ctx.parts[0]), what = String(ctx.parts[1]), m = /^([1-8])(?:\.([1-9]\d?))?$/.exec(what);
  if (!rec) { ctx.answer('That board is gone — send /daytrips.'); return; }
  if (what === 's') { ctx.answer(''); tgDaytripSend(ctx.chatId, rec); return; }
  if (!m) { ctx.answer('Unknown button'); return; }
  var n = parseInt(m[1], 10), r;
  if (m[2] === undefined) {
    var keep = !tgDaytripKeptOf(rec, n);
    r = tgDaytripKeep(rec, n, keep);
    if (!r.ok) { ctx.answer('That trip is gone — send /daytrips.'); return; }
    ctx.answer(keep ? 'Kept' : 'Removed');
    var kb = tgDaytripKeyboard(r.rec);
    if (ctx.messageId && kb) tgApi('editMessageReplyMarkup', { chat_id: ctx.chatId, message_id: ctx.messageId, reply_markup: kb });
    var trip = keep ? tgDaytripTrip(r.rec) : null, days = trip ? tgDigestDays(trip.slug) : [];
    if (days.length) {
      tgSend(ctx.chatId, 'Put <b>' + tgEscape(r.item.name) + '</b> on a day?', { keyboard: tgKeyboard(tgCmdRows(days.map(function (d) {
        return { text: d.n + ' · ' + tgCmdDate(d.date), data: cbEncode('dt', ctx.parts[0], n + '.' + d.n) };
      }), 3)) });
    }
    return;
  }
  var t = tgDaytripTrip(rec), day = t ? tgDigestDays(t.slug)[parseInt(m[2], 10) - 1] : null;
  if (!day) { ctx.answer('That day has changed — send /daytrips.'); return; }
  r = tgDaytripKeep(rec, n, true, day.date);
  if (!r.ok) { ctx.answer('That trip is gone — send /daytrips.'); return; }
  ctx.answer('Replanning day ' + day.n);
  if (ctx.messageId) tgApi('editMessageReplyMarkup', { chat_id: ctx.chatId, message_id: ctx.messageId, reply_markup: { inline_keyboard: [] } });
});

/* ==================== the `daytrip` envelope ==================== */

function tgEnvDaytripItem(errs, at, it) {
  if (!tgEnvObj(errs, at, it, ['n', 'slug', 'name', 'ride', 'length', 'why', 'see', 'score', 'parts', 'labels', 'stops', 'maps_url'], ['area', 'eat', 'season', 'closed', 'place_id'])) return;
  if (it.n !== undefined) tgEnvInt(errs, at + '.n', it.n, 1, TG_DAYTRIP.ITEMS_MAX);
  if (it.slug !== undefined) tgEnvSlug(errs, at + '.slug', it.slug);
  if (it.name !== undefined) tgEnvStr(errs, at + '.name', it.name, 1, 120);
  if (it.area !== undefined) tgEnvStr(errs, at + '.area', it.area, 0, 80);
  if (it.ride !== undefined && tgEnvObj(errs, at + '.ride', it.ride, ['minutes', 'estimated'], ['from_station', 'to_station'])) {
    if (it.ride.minutes !== undefined) tgEnvInt(errs, at + '.ride.minutes', it.ride.minutes, 1, 600);
    if (it.ride.estimated !== undefined) tgEnvBool(errs, at + '.ride.estimated', it.ride.estimated);
    ['from_station', 'to_station'].forEach(function (k) { if (it.ride[k] !== undefined) tgEnvStr(errs, at + '.ride.' + k, it.ride[k], 1, 80); });
  }
  if (it.length !== undefined) tgEnvEnum(errs, at + '.length', it.length, TG_DAYTRIP_LENGTHS);
  if (it.why !== undefined) tgEnvStr(errs, at + '.why', it.why, 1, 200);
  if (it.see !== undefined && tgEnvArr(errs, at + '.see', it.see, 4, 1)) it.see.forEach(function (s, j) { tgEnvStr(errs, at + '.see[' + j + ']', s, 1, 80); });
  if (it.eat !== undefined) tgEnvStr(errs, at + '.eat', it.eat, 1, 160);
  if (it.season !== undefined) tgEnvStr(errs, at + '.season', it.season, 1, 120);
  if (it.closed !== undefined && tgEnvArr(errs, at + '.closed', it.closed, 7)) it.closed.forEach(function (d, j) { tgEnvDate(errs, at + '.closed[' + j + ']', d); });
  if (it.score !== undefined) tgEnvInt(errs, at + '.score', it.score, 0, 100);
  if (it.parts !== undefined && tgEnvObj(errs, at + '.parts', it.parts, ['fit', 'reach', 'season', 'food'])) {
    ['fit', 'reach', 'season', 'food'].forEach(function (k) { if (it.parts[k] !== undefined) tgEnvInt(errs, at + '.parts.' + k, it.parts[k], 0, 100); });
  }
  if (it.labels !== undefined && tgEnvArr(errs, at + '.labels', it.labels, 4)) {
    it.labels.forEach(function (l, j) { tgEnvEnum(errs, at + '.labels[' + j + ']', l, TG_DAYTRIP_LABELS); });
    it.labels.forEach(function (l, j) { if (it.labels.indexOf(l) !== j) errs.push(at + '.labels[' + j + ']: duplicate label'); });
  }
  if (it.stops !== undefined && tgEnvArr(errs, at + '.stops', it.stops, 6, 1)) {
    it.stops.forEach(function (s, j) {
      var as = at + '.stops[' + j + ']';
      if (!tgEnvObj(errs, as, s, ['name'], ['place_id'])) return;
      if (s.name !== undefined) tgEnvStr(errs, as + '.name', s.name, 1, 120);
      if (s.place_id !== undefined) tgEnvStr(errs, as + '.place_id', s.place_id, 6, 300, TG_ENV_RE.placeId);
    });
  }
  if (it.place_id !== undefined) tgEnvStr(errs, at + '.place_id', it.place_id, 6, 300, TG_ENV_RE.placeId);
  if (it.maps_url !== undefined) tgEnvUrl(errs, at + '.maps_url', it.maps_url);
}
/**
 * Mirror of schemas/tour-guide-daytrip.schema.json and of validateDaytripPayload (packs/tour-guide/daytrip/daytrip-payload.mjs),
 * rule for rule and message for message (C15): required keys, types, enums, sizes, rank order, unique slugs and labels,
 * real dates, no Google field anywhere (tgScoutGoogleKeys), and the whole payload at most 20 000 characters.
 */
function tgEnvValidateDaytrip(p) {
  var errs = [];
  if (!isPlainObject(p)) return ['payload must be an object'];
  tgScoutGoogleKeys(p, '').forEach(function (k) { errs.push(k + ': Google field refused (own data only)'); });
  if (!tgEnvObj(errs, 'payload', p, ['id', 'trip', 'base', 'created_on', 'max_minutes', 'items', 'left_out'], ['v', 'date', 'more'])) return tgEnvDone(errs);
  if (p.v !== undefined && p.v !== 1) errs.push('v must be 1');
  if (p.id !== undefined) tgEnvStr(errs, 'id', p.id, 1, 52, TG_DAYTRIP.ID_RE);
  if (p.trip !== undefined && p.trip !== null) tgEnvSlug(errs, 'trip', p.trip);
  if (p.base !== undefined && tgEnvObj(errs, 'base', p.base, ['label', 'slug'])) {
    if (p.base.label !== undefined) tgEnvStr(errs, 'base.label', p.base.label, 1, 80);
    if (p.base.slug !== undefined) tgEnvSlug(errs, 'base.slug', p.base.slug);
  }
  if (p.created_on !== undefined) tgEnvDate(errs, 'created_on', p.created_on);
  if (p.max_minutes !== undefined) tgEnvInt(errs, 'max_minutes', p.max_minutes, TG_DAYTRIP.MIN, TG_DAYTRIP.MAX);
  if (p.date !== undefined) tgEnvDate(errs, 'date', p.date);
  if (p.more !== undefined) tgEnvInt(errs, 'more', p.more, 0, TG_DAYTRIP.MORE_MAX);
  if (p.items !== undefined && tgEnvArr(errs, 'items', p.items, TG_DAYTRIP.ITEMS_MAX)) {
    p.items.forEach(function (it, i) {
      tgEnvDaytripItem(errs, 'items[' + i + ']', it);
      if (isPlainObject(it) && typeof it.n === 'number' && it.n !== i + 1) errs.push('items[' + i + '].n must be ' + (i + 1) + ' (rank order)');
    });
    tgEnvDupes(errs, 'items', p.items, 'slug', 'slug');
  }
  if (p.left_out !== undefined && tgEnvArr(errs, 'left_out', p.left_out, TG_DAYTRIP.LEFT_MAX)) {
    p.left_out.forEach(function (l, i) {
      var at = 'left_out[' + i + ']';
      if (!tgEnvObj(errs, at, l, ['name', 'reason'])) return;
      if (l.name !== undefined) tgEnvStr(errs, at + '.name', l.name, 1, 120);
      if (l.reason !== undefined) tgEnvEnum(errs, at + '.reason', l.reason, TG_DAYTRIP_LEFT);
    });
  }
  tgEnvSize(errs, p);
  var n = toJson(p).length;
  if (n > TG_DAYTRIP.PAYLOAD_MAX) errs.push('payload is ' + n + ' chars (max ' + TG_DAYTRIP.PAYLOAD_MAX + ')');
  return tgEnvDone(errs);
}

/** The handler registers only while helper.json lists the type: an unlisted type cannot be registered and the core rejects it, audited. */
if (ENVELOPE_TYPES.indexOf('daytrip') >= 0) {
  registerEnvelopeHandler('daytrip', {
    validate: function (p, env) {
      var errs = tgEnvCleaned(tgEnvValidateDaytrip)(p, env);
      // A board names a trip the core knows, or none (null): the vegcard rule.
      if (!errs.length && p.trip !== null && !tgTripGet(p.trip)) errs.push('trip: unknown trip "' + truncate(String(p.trip), 64) + '"');
      return errs;
    },
    handle: function (env) {
      var st = tgDaytripStore(env.payload), chat = tgOwnerChat(), r = chat ? tgDaytripSend(chat, st.rec) : null;
      return { daytrip: st.rec.id, replaced: st.replaced, kept: st.rec.kept.length, sent: !!(r && r.ok) };
    }
  });
}

/* ==================== state.json `daytrips_kept` (C15) ==================== */

/**
 * The kept day trips the routine plans with: ≤ 20, newest first, of boards whose trip is not done and of boards without a
 * trip: { board, n, trip, base, name, slug, length, ride_minutes, stops, place_id?, date?, kept_at }.
 */
function tgDaytripKeptSnapshot() {
  var out = [];
  tgDaytripList().forEach(function (b) {
    if (b.trip && !tgDaytripTrip(b)) return;
    b.kept.forEach(function (k) {
      var it = b.items.filter(function (x) { return x.slug === k.slug; })[0];
      if (!it) return;
      var e = { board: b.id, n: it.n, trip: b.trip || null, base: b.base.label, name: it.name, slug: it.slug, length: it.length,
        ride_minutes: isPlainObject(it.ride) ? it.ride.minutes : null,
        stops: (Array.isArray(it.stops) ? it.stops : []).map(function (s) { var o = { name: s.name }; if (s.place_id) o.place_id = s.place_id; return o; }) };
      if (it.place_id) e.place_id = it.place_id;
      if (k.date) e.date = k.date;
      e.kept_at = k.at;
      out.push(e);
    });
  });
  out.sort(function (a, b) { return a.kept_at !== b.kept_at ? (a.kept_at < b.kept_at ? 1 : -1) : 0; });
  return out.slice(0, TG_DAYTRIP.KEPT_MAX);
}
registerSnapshotProvider('daytrips_kept', tgDaytripKeptSnapshot);

// Developed by: LightAISolutions
