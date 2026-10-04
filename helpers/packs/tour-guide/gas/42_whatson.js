/**
 * Tour Guide pack — What's on (item 20, C15, TG-PHASE-15 WP-15b): what is on in any place over up to 31 days, grouped
 * by date with its sources; the owner chooses things for days and the plan carries them.
 *   /whatson [in] [<place>] [<when>] → request kind `whatson` { trip?, place?, from, to, dates_given?, auto? }, routed to
 *     RESEARCH (TG_KIND_ROUTINE, below), or to DISCOVER when that routine is configured (a discovery kind)
 *   /whatson last · /whatson auto on|off
 *   envelope `whatson` → validated (tgEnvValidateWhatson, word for word with whatson/whatson-check.mjs
 *     validateWhatsonPayload and the rules of schemas/tour-guide-whatson.schema.json), stored in the WhatsOn tab (one row
 *     per board id; a re-delivery replaces it and keeps the choices still on the board), then the card — or, for the weekly
 *     check (`auto`), nothing unless something is new
 *   callback wo:<key>:<n>.<tag>[:<yyyymmdd>|:r] chooses / un-chooses item n (asking which day), or re-plans its day;
 *     wo:<key>:s resends the card
 *   alarm tg_whatson → the weekly check of every trip that is not done; snapshot `whatson_chosen` → the choices
 * App operations: gas/34_whatson_app.js. Pack side: packs/tour-guide/whatson/. Tests: tests/pack_tour-guide_whatson*.test.js.
 * Other pack files' names are touched only inside functions, at run time.
 * The @branch line below tells `new-branch.mjs --check whatson` what this branch declares ("-" = not needed); keep it in step.
 */
// @branch whatson command=/whatson kind=whatson envelope=whatson tab=WhatsOn routine=RESEARCH app=yes discover=yes
var TG_WHATSON = {
  SHEET: 'WhatsOn', PAYLOAD_MAX: 40000, ENV_MAX: 60000, LIST_MAX: 20, CHAT_LIST: 10, ITEMS_MAX: 20, MORE_MAX: 50, SOURCES_MAX: 10,
  LEFT_MAX: 20, DAYS_MAX: 31, WINDOW_DAYS: 31, LABELS_MAX: 4, PLACE_MAX: 80, CARD_MAX: 4000, ASK_DAYS: 8, SNAP_MAX: 40,
  SOURCES_SHOWN: 3, DEFAULT_DAYS: 7, AUTO_LEAD_DAYS: 21, AUTO_EVERY_DAYS: 7, AUTO_HOUR: 9, OPEN_RETRY_MS: 3600000,
  ID_RE: /^wo-\d{8}-[a-z0-9-]{1,40}$/, KEY_RE: /^k[0-9a-f]{12}$/, TIME_RE: /^([01]\d|2[0-3]):[0-5]\d$/, PLACE_ID_RE: /^[A-Za-z0-9_-]{6,300}$/,
  SET_AUTO: 'whatson_auto', SET_CHECKS: 'tg_whatson_checks', SET_OPEN: 'tg_whatson_open'
};
var TG_WHATSON_KINDS = ['light_up', 'special_opening', 'festival', 'market', 'exhibition', 'performance', 'holiday', 'closure'];
/** Holidays and closures inform; they cannot be chosen. */
var TG_WHATSON_CHOOSABLE = ['light_up', 'special_opening', 'festival', 'market', 'exhibition', 'performance'];
var TG_WHATSON_LABELS = ['evening', 'free', 'crowded', 'rain_ok', 'veg_food', 'booking'];
var TG_WHATSON_LEFT = ['outside_dates', 'duplicate', 'unconfirmed', 'sold_out', 'other'];
var TG_WHATSON_CONFIDENCE = ['confirmed', 'likely'];
var TG_WHATSON_EMOJI = { light_up: '🏮', special_opening: '🏛', festival: '🎉', market: '🧺', exhibition: '🖼', performance: '🎭', holiday: '📅', closure: '🚫' };
var TG_WHATSON_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

// The kind's routing, added from this file: tgKindRoutine (00_common.js) reads the table at call time.
TG_KIND_ROUTINE['whatson'] = 'RESEARCH';
// A discovery kind (--discover): with a DISCOVER routine configured, tgKindRoutine sends it there instead.
if (TG_DISCOVER_KINDS.indexOf('whatson') < 0) TG_DISCOVER_KINDS.push('whatson');

registerSheet(TG_WHATSON.SHEET, ['id', 'trip', 'place_label', 'from', 'to', 'created_on', 'auto', 'count', 'payload_json', 'chosen_json', 'received_at']);

/* ==================== dates ==================== */

function tgWoPad(n) { return (n < 10 ? '0' : '') + n; }
/** Whole days from a to b (b − a), both 'YYYY-MM-DD'. */
function tgWoDaysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
/** 0 = Sunday. */
function tgWoDow(iso) { return new Date(iso + 'T00:00:00Z').getUTCDay(); }
/** An item's dates inside from..to, in order: its `days` when it lists them, else every day of its run the window covers. */
function tgWoDaysIn(it, from, to) {
  if (!isPlainObject(it) || !tgEnvRealDate(it.from) || !tgEnvRealDate(it.to)) return [];
  if (Array.isArray(it.days)) return it.days.filter(function (d) { return tgEnvRealDate(d) && d >= from && d <= to && d >= it.from && d <= it.to; });
  var out = [];
  for (var d = it.from > from ? it.from : from, end = it.to < to ? it.to : to; d <= end; d = isoDateAdd(d, 1)) out.push(d);
  return out;
}
function tgWoFirstDay(it, from, to) {
  if (!isPlainObject(it) || !tgEnvRealDate(it.from) || !tgEnvRealDate(it.to)) return null;
  if (Array.isArray(it.days)) return tgWoDaysIn(it, from, to)[0] || null;
  var d = it.from > from ? it.from : from;
  return d <= (it.to < to ? it.to : to) ? d : null;
}
/** The board's order (whatson-check.mjs compareItems): the first day in the window, then the start (none first), then the name. */
function tgWoCompare(a, b, from, to) {
  var ka = [tgWoFirstDay(a, from, to) || '9999-12-31', TG_WHATSON.TIME_RE.test(a.start || '') ? a.start : '', String(a.name || '').toLowerCase()];
  var kb = [tgWoFirstDay(b, from, to) || '9999-12-31', TG_WHATSON.TIME_RE.test(b.start || '') ? b.start : '', String(b.name || '').toLowerCase()];
  for (var i = 0; i < 3; i++) { if (ka[i] < kb[i]) return -1; if (ka[i] > kb[i]) return 1; }
  return 0;
}
/** "Wed 12 May" for one day, "8–10 Jun" within a month, "30 May – 2 Jun" across months, years added when they differ. */
function tgWhatsonWindowText(from, to) {
  if (!from) return '';
  if (!to || to === from) return tgCmdDate(from);
  var fmt = function (iso, f) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); return Utilities.formatDate(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)), 'UTC', f); };
  if (from.slice(0, 4) !== to.slice(0, 4)) return fmt(from, 'd MMM yyyy') + ' – ' + fmt(to, 'd MMM yyyy');
  if (from.slice(0, 7) === to.slice(0, 7)) return fmt(from, 'd') + '–' + fmt(to, 'd MMM');
  return fmt(from, 'd MMM') + ' – ' + fmt(to, 'd MMM');
}

/* ==================== the owner's words (mirror of whatson/whatson-text.mjs parseWhatsonText) ==================== */

/** A month word (three letters or more of an English month name) → 1–12, else 0. */
function tgWoMonth(w) {
  w = String(w || '').toLowerCase().replace(/\.$/, '');
  if (w.length < 3) return 0;
  for (var i = 0; i < 12; i++) if (TG_WHATSON_MONTHS[i].indexOf(w) === 0) return i + 1;
  return 0;
}
/** The first real date with month m and day d on or after ref (a leap day may wait some years), else null. */
function tgWoOnOrAfter(m, d, ref) {
  var y0 = Number(ref.slice(0, 4));
  for (var y = y0; y <= y0 + 8; y++) {
    var iso = y + '-' + tgWoPad(m) + '-' + tgWoPad(d);
    if (tgEnvRealDate(iso) && iso >= ref) return iso;
  }
  return null;
}
function tgWoMd(m, d) { return m >= 1 && m <= 12 && d >= 1 && tgEnvRealDate('2028-' + tgWoPad(m) + '-' + tgWoPad(d)) ? { m: m, d: d } : null; }
/** One date token → { iso } | { m, d } (year-less) | null. */
function tgWoDateToken(s) {
  var r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (r) return tgEnvRealDate(s) ? { iso: s } : null;
  r = /^(\d{1,2})\/(\d{1,2})$/.exec(s);
  if (r) return tgWoMd(Number(r[1]), Number(r[2]));
  r = /^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+\.?)$/.exec(s);
  if (r && tgWoMonth(r[2])) return tgWoMd(tgWoMonth(r[2]), Number(r[1]));
  r = /^([a-z]+\.?) (\d{1,2})(?:st|nd|rd|th)?$/.exec(s);
  if (r && tgWoMonth(r[1])) return tgWoMd(tgWoMonth(r[1]), Number(r[2]));
  return null;
}
function tgWoStartOf(t, today) { return t.iso ? t.iso : tgWoOnOrAfter(t.m, t.d, today); }
/** A range's end: as written; year-less, the first on or after the start (same month, earlier day: kept reversed). */
function tgWoEndOf(t, start) {
  if (t.iso) return t.iso;
  var cand = start.slice(0, 4) + '-' + tgWoPad(t.m) + '-' + tgWoPad(t.d);
  if (tgEnvRealDate(cand) && (cand >= start || t.m === Number(start.slice(5, 7)))) return cand;
  return tgWoOnOrAfter(t.m, t.d, start);
}
function tgWoRange(a, b, today) {
  var ta = tgWoDateToken(a), tb = tgWoDateToken(b);
  if (!ta || !tb) return null;
  var from = tgWoStartOf(ta, today), to = from && tgWoEndOf(tb, from);
  return from && to ? { from: from, to: to } : null;
}
/** A <when> phrase (lower case, single spaces) → { from, to } as written (may be past or reversed), else null. */
function tgWoWhen(s, today) {
  var wd = tgWoDow(today), r, i;
  if (s === 'today') return { from: today, to: today };
  if (s === 'tomorrow') return { from: isoDateAdd(today, 1), to: isoDateAdd(today, 1) };
  if (s === 'this week') return { from: today, to: isoDateAdd(today, (7 - wd) % 7) };
  if (s === 'next week') { var mon = isoDateAdd(today, (8 - wd) % 7 || 7); return { from: mon, to: isoDateAdd(mon, 6) }; }
  if (s === 'this weekend') return wd === 0 ? { from: today, to: today } : { from: isoDateAdd(today, 6 - wd), to: isoDateAdd(today, 7 - wd) };
  r = /^(\d{1,2})\s*[-–]\s*(\d{1,2}) ([a-z]+\.?)$/.exec(s);
  if (r && tgWoMonth(r[3])) return tgWoRange(r[1] + ' ' + r[3], r[2] + ' ' + r[3], today);
  r = /^([a-z]+\.?) (\d{1,2})\s*[-–]\s*(\d{1,2})$/.exec(s);
  if (r && tgWoMonth(r[1])) return tgWoRange(r[1] + ' ' + r[2], r[1] + ' ' + r[3], today);
  var split = s.split(/ to |\s*\.\.\s*/);
  if (split.length === 2) return tgWoRange(split[0].trim(), split[1].trim(), today);
  if (split.length > 2) return null;
  for (i = 1; i < s.length - 1; i++) {
    if (s[i] !== '-' && s[i] !== '–') continue;
    var got = tgWoRange(s.slice(0, i).trim(), s.slice(i + 1).trim(), today);
    if (got) return got;
  }
  var t = tgWoDateToken(s);
  if (!t) return null;
  var d = tgWoStartOf(t, today);
  return d ? { from: d, to: d } : null;
}
/**
 * tgWhatsonParse(text, today) → { ok: true, place, from, to, dates_given } | { ok: false, reason: 'past' | 'reversed' |
 * 'too_long' | 'long_place', place }. `[in] [<place>] [<when>]`: the longest run of words at the end that reads as a
 * <when> is the window; the rest, minus a leading "in", is the place. No window: from and to are null.
 */
function tgWhatsonParse(text, today) {
  var words = String(text === undefined || text === null ? '' : text).slice(0, 300).replace(/^\s*\/whatson(@\w+)?(?=\s|$)/i, '').trim().split(/\s+/).filter(Boolean);
  var when = null, k = words.length;
  for (var i = 0; i < words.length; i++) {
    var w = tgWoWhen(words.slice(i).join(' ').toLowerCase(), today);
    if (w) { when = w; k = i; break; }
  }
  var rest = words.slice(0, k);
  if (rest.length && rest[0].toLowerCase() === 'in') rest.shift();
  var place = rest.join(' ') || null;
  if (place && place.length > TG_WHATSON.PLACE_MAX) return { ok: false, reason: 'long_place', place: null };
  if (!when) return { ok: true, place: place, from: null, to: null, dates_given: false };
  if (when.from > when.to) return { ok: false, reason: 'reversed', place: place };
  if (when.to < today) return { ok: false, reason: 'past', place: place };
  var from = when.from < today ? today : when.from;
  if (tgWoDaysBetween(from, when.to) > TG_WHATSON.WINDOW_DAYS - 1) return { ok: false, reason: 'too_long', place: place };
  return { ok: true, place: place, from: from, to: when.to, dates_given: true };
}

/* ==================== asking ==================== */

/** The trip's days from its today as a window of at most 31 days: { from, to }, or null (no dates, or the trip is over). */
function tgWhatsonTripWindow(trip) {
  if (!trip || !tgEnvRealDate(trip.start)) return null;
  var end = tgEnvRealDate(trip.end) && trip.end >= trip.start ? trip.end : trip.start, today = tgTripToday(trip);
  var from = today > trip.start ? today : trip.start;
  if (from > end) return null;
  return { from: from, to: tgWoDaysBetween(from, end) > TG_WHATSON.WINDOW_DAYS - 1 ? isoDateAdd(from, TG_WHATSON.WINDOW_DAYS - 1) : end };
}
/**
 * The owner's words (and the current trip, or null) → { ok: true, payload } | { ok: false, why: 'past' | 'reversed' |
 * 'too_long' | 'long_place' | 'no_place' }. "Today" is the trip's today when there is a trip, else the home zone's.
 * No <when>: the trip's days from its today (at most 31), else today and the next 6 days. The trip rides along when no
 * place is named (the routine checks the trip's cities) or when the window meets the trip's dates.
 */
function tgWhatsonResolve(text, trip) {
  var today = trip ? tgTripToday(trip) : isoDateIn(getTz());
  var q = tgWhatsonParse(text, today);
  if (!q.ok) return { ok: false, why: q.reason };
  if (!q.place && !trip) return { ok: false, why: 'no_place' };
  var from = q.from, to = q.to, tw = tgWhatsonTripWindow(trip);
  if (!q.dates_given) {
    if (tw) { from = tw.from; to = tw.to; } else { from = today; to = isoDateAdd(today, TG_WHATSON.DEFAULT_DAYS - 1); }
  }
  var payload = {};
  var meets = trip && tgEnvRealDate(trip.start) && from <= (tgEnvRealDate(trip.end) ? trip.end : trip.start) && to >= trip.start;
  if (trip && (!q.place || meets)) payload.trip = trip.slug;
  if (q.place) payload.place = q.place;
  payload.from = from;
  payload.to = to;
  if (q.dates_given) payload.dates_given = true;
  return { ok: true, payload: payload };
}
var TG_WHATSON_SAY = {
  past: '🗓 Those dates are already past — nothing was asked.',
  reversed: '🗓 That range ends before it starts — nothing was asked.',
  too_long: '🗓 Please keep it to 31 days or fewer — nothing was asked.',
  long_place: '🗓 Please keep the place under 80 characters — nothing was asked.',
  no_place: '🗓 Which place? <code>/whatson &lt;place&gt; &lt;dates&gt;</code> — for example <code>/whatson Old Town 8-10 Jun</code>. ' +
    'Dates may be today, tomorrow, this week, next week, this weekend, a date or a range (31 days at most); none means the next 7 days.'
};
/** The open `whatson` request of each trip: { slug: request id } (Settings). */
function tgWhatsonOpenMap() { var p = safeJsonParse(settingGet(TG_WHATSON.SET_OPEN, '') || '{}'); return p.ok && isPlainObject(p.value) ? p.value : {}; }
/** True while the trip's last `whatson` request is still open. */
function tgWhatsonOpenFor(slug) {
  var id = tgWhatsonOpenMap()[slug], row = id ? getRequest(id) : null;
  return !!(row && row.status === 'open');
}
/**
 * Open a `whatson` request. payload = tgWhatsonResolve's (or the weekly check's); opts = { chat?, text?, ack?: false }.
 * → { ok: true, id, routine, fired, payload }
 */
function tgWhatsonOpen(payload, opts) {
  opts = opts || {};
  var trip = payload.trip ? tgTripGet(payload.trip) : null;
  var where = payload.place ? '<b>' + tgEscape(payload.place) + '</b>' : trip ? 'the cities of <b>' + tgCmdTitle(trip) + '</b>' : 'your trip';
  var text = opts.text || ('/whatson ' + (payload.place ? payload.place + ' ' : '') + payload.from + (payload.to !== payload.from ? ' to ' + payload.to : '') + (payload.auto ? ' (weekly check)' : ''));
  var r = tgOpenKindRequest('whatson', payload, { chat: opts.chat || null, text: text,
    ack: opts.ack === false ? false : '🗓 Looking up what\'s on in ' + where + ' · ' + tgWhatsonWindowText(payload.from, payload.to) + '…' });
  if (payload.trip && r.id) {
    var m = tgWhatsonOpenMap();
    m[payload.trip] = r.id;
    settingSet(TG_WHATSON.SET_OPEN, toJson(m), 'the last What\'s on request of each trip');
  }
  return { ok: true, id: r.id, routine: r.routine, fired: !!(r.fired && r.fired.ok), payload: payload };
}
/** /whatson auto on|off — the weekly check (on unless set off). */
function tgWhatsonAuto(ctx, value) {
  if (value !== 'on' && value !== 'off') { ctx.reply('Usage: /whatson auto on · /whatson auto off'); return; }
  settingSet(TG_WHATSON.SET_AUTO, value, 'the weekly What\'s on check (on unless off)');
  _safe('tg_whatson_arm', alarmArm);
  ctx.reply(value === 'off' ? '🗓 The weekly What\'s on check is off — send /whatson whenever you like.'
    : '🗓 Before and during a trip, its cities are checked once a week; you hear only about new things.');
}
function tgWhatsonAutoOn() { return settingGet(TG_WHATSON.SET_AUTO, '') !== 'off'; }

registerCommand('/whatson', function (ctx) {
  var arg = String(ctx.args || '').replace(/\s+/g, ' ').trim(), low = arg.toLowerCase();
  if (low === 'last') { tgWhatsonLast(ctx); return; }
  var auto = /^auto(?: (.*))?$/.exec(low);
  if (auto) { tgWhatsonAuto(ctx, auto[1] || ''); return; }
  var r = tgWhatsonResolve(arg, tgTripCurrent());
  if (!r.ok) { ctx.reply(TG_WHATSON_SAY[r.why]); return; }
  tgWhatsonOpen(r.payload, { chat: ctx.chat, text: String(ctx.text || '') });
}, 'what is on in a place, up to 31 days: /whatson [<place>] [<dates>] · /whatson last · /whatson auto on|off');

/* ==================== the WhatsOn tab ==================== */

/** A row → { id, trip, place: { label, slug }, from, to, created_on, auto, count, items, sources, left_out, more, chosen, received_at }. */
function tgWhatsonRec(r) {
  if (!r) return null;
  var p = tgShJson(r.payload_json, {}), ch = tgShJson(r.chosen_json, []);
  if (!isPlainObject(p)) p = {};
  var place = isPlainObject(p.place) ? p.place : {};
  return { id: tgShStr(r.id), trip: tgShStr(r.trip), place: { label: String(place.label || tgShStr(r.place_label)), slug: String(place.slug || '') },
    from: tgShDate(r.from), to: tgShDate(r.to), created_on: tgShDate(r.created_on), auto: tgShBool(r.auto), count: tgShInt(r.count, 0),
    items: Array.isArray(p.items) ? p.items.filter(isPlainObject) : [], sources: Array.isArray(p.sources) ? p.sources.filter(isPlainObject) : [],
    left_out: Array.isArray(p.left_out) ? p.left_out.filter(isPlainObject) : [], more: typeof p.more === 'number' ? p.more : 0,
    chosen: Array.isArray(ch) ? ch.filter(function (c) { return isPlainObject(c) && typeof c.item === 'string' && tgEnvRealDate(c.chosen_on); }) : [],
    received_at: tgShStr(r.received_at) };
}
/** One stored board, or null. */
function tgWhatsonGet(id) {
  id = String(id || '');
  if (!TG_WHATSON.ID_RE.test(id)) return null;
  return tgWhatsonRec(storeFind(TG_WHATSON.SHEET, function (r) { return tgShStr(r.id) === id; }, 1)[0] || null);
}
/** Newest first (received_at, then row order); limit optional. */
function tgWhatsonList(limit) {
  var rows = storeAll(TG_WHATSON.SHEET).map(function (r) { var x = tgWhatsonRec(r); x._row = r._row; return x; });
  rows.sort(function (a, b) { return a.received_at !== b.received_at ? (a.received_at < b.received_at ? 1 : -1) : b._row - a._row; });
  rows.forEach(function (x) { delete x._row; });
  return limit ? rows.slice(0, limit) : rows;
}
/** A board id as a callback part: always "k" + 12 hex of its hash (Scout's board key). */
function tgWhatsonKey(id) { return 'k' + sha1Hex(String(id || '')).slice(0, 12); }
function tgWhatsonByKey(key) {
  key = String(key || '');
  if (!TG_WHATSON.KEY_RE.test(key)) return null;
  var all = tgWhatsonList();
  for (var i = 0; i < all.length; i++) if (tgWhatsonKey(all[i].id) === key) return all[i];
  return null;
}
/** The board an `auto` board is compared with: the same id when stored, else the newest with the same trip and place slug. */
function tgWhatsonPrevious(p) {
  var same = tgWhatsonGet(p.id);
  if (same) return same;
  var slug = isPlainObject(p.place) ? p.place.slug : '';
  return tgWhatsonList().filter(function (b) { return b.trip === (p.trip || '') && b.place.slug === slug; })[0] || null;
}
/**
 * C15 (coordinator): the choices are one set per trip and place. An item is chosen on one board at most (the board it was
 * chosen on), and every board with the same trip and place slug shows that choice: the weekly check stores a new board
 * each week, and its ✅ and the app's chosen days must not forget a choice made on an earlier one.
 * → { item id: { item, chosen_on, at, board } } for rec's group, rec's own choices first. `all` (optional) is
 * tgWhatsonList() when the caller already has it. Worked out once per record.
 */
function tgWhatsonGroupChoices(rec, all) {
  if (!rec) return {};
  if (rec._group) return rec._group;
  var map = {}, slug = rec.place ? String(rec.place.slug || '') : '';
  [rec].concat((all || tgWhatsonList()).filter(function (b) { return b.id !== rec.id && b.trip === (rec.trip || '') && b.place.slug === slug; })).forEach(function (b) {
    (b.chosen || []).forEach(function (c) { if (!map[c.item]) map[c.item] = { item: c.item, chosen_on: c.chosen_on, at: c.at, board: b.id }; });
  });
  try { Object.defineProperty(rec, '_group', { value: map, enumerable: false, configurable: true }); } catch (e) { /* not cached */ }
  return map;
}
/** The other boards of rec's trip and place that hold a choice of itemId (C15 coordinator). */
function tgWhatsonHolders(rec, itemId) {
  var slug = rec.place ? String(rec.place.slug || '') : '';
  return tgWhatsonList().filter(function (b) {
    return b.id !== rec.id && b.trip === (rec.trip || '') && b.place.slug === slug && b.chosen.some(function (c) { return c.item === itemId; });
  });
}
/** An item's choice, made on this board or on another of the same trip and place (C15 coordinator), or null: { item, chosen_on, at, board }. */
function tgWhatsonChoice(rec, itemId) { return tgWhatsonGroupChoices(rec)[itemId] || null; }
/** How many of the board's items are chosen, on it or on another board of the same trip and place (C15 coordinator). */
function tgWhatsonChosenCount(rec, all) {
  tgWhatsonGroupChoices(rec, all);
  return (rec.items || []).filter(function (it) { return !!tgWhatsonChoice(rec, it.id); }).length;
}
/**
 * Store a validated payload; a re-delivered id replaces its row and keeps each choice whose item is still on the board
 * and still runs on the chosen day. → { rec, replaced }
 */
function tgWhatsonStore(p) {
  var old = tgWhatsonGet(p.id), byId = {};
  (p.items || []).forEach(function (it) { byId[it.id] = it; });
  var kept = (old ? old.chosen : []).filter(function (c) {
    var it = byId[c.item];
    return !!it && tgWoDaysIn(it, it.from, it.to).indexOf(c.chosen_on) >= 0;
  });
  storeUpsertById(TG_WHATSON.SHEET, { id: p.id, trip: p.trip || '', place_label: p.place.label, from: p.from, to: p.to, created_on: p.created_on,
    auto: p.auto === true ? true : '', count: (p.items || []).length, payload_json: toJson(p), chosen_json: toJson(kept), received_at: nowIso() });
  return { rec: tgWhatsonGet(p.id), replaced: !!old };
}
function tgWhatsonSaveChosen(rec, list) {
  storeUpdateById(TG_WHATSON.SHEET, rec.id, { chosen_json: toJson(list) });
  return tgWhatsonGet(rec.id);
}

/* ==================== the `whatson` envelope ==================== */

function tgEnvWhatsonItem(errs, at, it, w) {
  if (!tgEnvObj(errs, at, it, ['id', 'name', 'kind', 'from', 'to', 'why', 'url', 'confidence'], ['days', 'start', 'end', 'venue', 'food', 'price', 'booking', 'labels'])) return;
  if (it.id !== undefined) tgEnvStr(errs, at + '.id', it.id, 1, 64, TG_ENV_RE.slug);
  if (it.name !== undefined) tgEnvStr(errs, at + '.name', it.name, 1, 120);
  if (it.kind !== undefined) tgEnvEnum(errs, at + '.kind', it.kind, TG_WHATSON_KINDS);
  if (it.from !== undefined) tgEnvDate(errs, at + '.from', it.from);
  if (it.to !== undefined) tgEnvDate(errs, at + '.to', it.to);
  var run = tgEnvRealDate(it.from) && tgEnvRealDate(it.to);
  if (run && it.from > it.to) errs.push(at + '.to must not be before from');
  if (it.days !== undefined && tgEnvArr(errs, at + '.days', it.days, TG_WHATSON.DAYS_MAX)) {
    it.days.forEach(function (d, j) {
      tgEnvDate(errs, at + '.days[' + j + ']', d);
      if (!tgEnvRealDate(d)) return;
      if (run && (d < it.from || d > it.to)) errs.push(at + '.days[' + j + '] outside from..to');
      if (j > 0 && tgEnvRealDate(it.days[j - 1]) && d <= it.days[j - 1]) errs.push(at + '.days[' + j + '] out of order or repeated');
    });
  }
  if (it.start !== undefined) tgEnvStr(errs, at + '.start', it.start, 5, 5, TG_WHATSON.TIME_RE);
  if (it.end !== undefined) tgEnvStr(errs, at + '.end', it.end, 5, 5, TG_WHATSON.TIME_RE);
  if (it.venue !== undefined && tgEnvObj(errs, at + '.venue', it.venue, ['name'], ['area', 'place_id'])) {
    if (it.venue.name !== undefined) tgEnvStr(errs, at + '.venue.name', it.venue.name, 1, 120);
    if (it.venue.area !== undefined) tgEnvStr(errs, at + '.venue.area', it.venue.area, 1, 80);
    if (it.venue.place_id !== undefined) tgEnvStr(errs, at + '.venue.place_id', it.venue.place_id, 1, 300, TG_WHATSON.PLACE_ID_RE);
  }
  if (it.why !== undefined) tgEnvStr(errs, at + '.why', it.why, 1, 200);
  if (it.food !== undefined) tgEnvStr(errs, at + '.food', it.food, 1, 160);
  if (it.price !== undefined) tgEnvStr(errs, at + '.price', it.price, 1, 80);
  if (it.booking !== undefined) tgEnvStr(errs, at + '.booking', it.booking, 1, 120);
  if (it.url !== undefined) tgEnvStr(errs, at + '.url', it.url, 1, 2000, TG_ENV_RE.url);
  if (it.confidence !== undefined) tgEnvEnum(errs, at + '.confidence', it.confidence, TG_WHATSON_CONFIDENCE);
  if (it.labels !== undefined && tgEnvArr(errs, at + '.labels', it.labels, TG_WHATSON.LABELS_MAX)) {
    it.labels.forEach(function (l, j) {
      tgEnvEnum(errs, at + '.labels[' + j + ']', l, TG_WHATSON_LABELS);
      if (it.labels.indexOf(l) < j) errs.push(at + '.labels[' + j + ']: duplicate ' + truncate(l, 40));
    });
  }
  if (w && run && it.from <= it.to && tgWoFirstDay(it, w.from, w.to) === null) errs.push(at + ' has no day in from..to');
}
/** An item the order rule can place: a day in the window, a string name and no broken start. */
function tgWoPlaceable(it, w) {
  return isPlainObject(it) && typeof it.name === 'string' && (it.start === undefined || TG_WHATSON.TIME_RE.test(it.start)) && tgWoFirstDay(it, w.from, w.to) !== null;
}
/**
 * Mirror of schemas/tour-guide-whatson.schema.json and of validateWhatsonPayload (packs/tour-guide/whatson/whatson-check.mjs),
 * rule for rule and word for word: no Google field, the window (from ≤ to, ≤ 31 days), each item's run and days, a day in
 * the window, the board's order, unique ids, and the 40 000-character cap of one Sheet cell.
 */
function tgEnvValidateWhatson(p) {
  var errs = [];
  if (!isPlainObject(p)) return ['payload must be an object'];
  tgScoutGoogleKeys(p, '').forEach(function (k) { errs.push(k + ': Google field refused (own data only)'); });
  if (!tgEnvObj(errs, 'payload', p, ['id', 'trip', 'place', 'from', 'to', 'created_on', 'items', 'sources', 'left_out'], ['v', 'kind', 'auto', 'more'])) return tgEnvDone(errs);
  tgEnvHead(errs, p, 'whatson');
  if (p.id !== undefined) tgEnvStr(errs, 'id', p.id, 1, 52, TG_WHATSON.ID_RE);
  if (p.trip !== undefined && p.trip !== null) tgEnvSlug(errs, 'trip', p.trip);
  if (p.place !== undefined && tgEnvObj(errs, 'place', p.place, ['label', 'slug'])) {
    if (p.place.label !== undefined) tgEnvStr(errs, 'place.label', p.place.label, 1, TG_WHATSON.PLACE_MAX);
    if (p.place.slug !== undefined) tgEnvSlug(errs, 'place.slug', p.place.slug);
  }
  ['from', 'to', 'created_on'].forEach(function (k) { if (p[k] !== undefined) tgEnvDate(errs, k, p[k]); });
  var w = null;
  if (tgEnvRealDate(p.from) && tgEnvRealDate(p.to)) {
    if (p.from > p.to) errs.push('to must not be before from');
    else if (tgWoDaysBetween(p.from, p.to) > TG_WHATSON.WINDOW_DAYS - 1) errs.push('from..to: at most ' + TG_WHATSON.WINDOW_DAYS + ' days');
    else w = { from: p.from, to: p.to };
  }
  if (p.auto !== undefined && p.auto !== true) errs.push('auto must be true when present');
  if (p.more !== undefined) tgEnvInt(errs, 'more', p.more, 0, TG_WHATSON.MORE_MAX);
  if (p.items !== undefined && tgEnvArr(errs, 'items', p.items, TG_WHATSON.ITEMS_MAX)) {
    p.items.forEach(function (it, i) { tgEnvWhatsonItem(errs, 'items[' + i + ']', it, w); });
    tgEnvDupes(errs, 'items', p.items, 'id');
    if (w) p.items.forEach(function (it, i) {
      if (i > 0 && tgWoPlaceable(p.items[i - 1], w) && tgWoPlaceable(it, w) && tgWoCompare(p.items[i - 1], it, w.from, w.to) > 0) {
        errs.push('items[' + i + '] out of order (first day in from..to, then start, then name)');
      }
    });
  }
  if (p.sources !== undefined && tgEnvArr(errs, 'sources', p.sources, TG_WHATSON.SOURCES_MAX)) {
    p.sources.forEach(function (s, i) {
      var at = 'sources[' + i + ']';
      if (!tgEnvObj(errs, at, s, ['title', 'url'])) return;
      if (s.title !== undefined) tgEnvStr(errs, at + '.title', s.title, 1, 120);
      if (s.url !== undefined) tgEnvStr(errs, at + '.url', s.url, 1, 2000, TG_ENV_RE.url);
    });
  }
  if (p.left_out !== undefined && tgEnvArr(errs, 'left_out', p.left_out, TG_WHATSON.LEFT_MAX)) {
    p.left_out.forEach(function (l, i) {
      var at = 'left_out[' + i + ']';
      if (!tgEnvObj(errs, at, l, ['name', 'reason'])) return;
      if (l.name !== undefined) tgEnvStr(errs, at + '.name', l.name, 1, 120);
      if (l.reason !== undefined) tgEnvEnum(errs, at + '.reason', l.reason, TG_WHATSON_LEFT);
    });
  }
  tgEnvSize(errs, p);
  var n = toJson(p).length;
  if (n > TG_WHATSON.PAYLOAD_MAX) errs.push('payload is ' + n + ' chars (max ' + TG_WHATSON.PAYLOAD_MAX + ' for one cell)');
  return tgEnvDone(errs);
}

/* ==================== the card ==================== */

function tgWhatsonPlace(rec) { return rec.place && rec.place.label ? rec.place.label : (rec.trip || 'your trip'); }
/** An item's https page as a link (the validators allow https only); anything else is plain text. */
function tgWhatsonHref(url, text) {
  var u = String(url || ''), t = tgEscape(text);
  return /^https:\/\/\S+$/.test(u) && u.length <= 2000 ? '<a href="' + tgEscape(u).replace(/"/g, '&quot;') + '">' + t + '</a>' : t;
}
/** The app button opened on this board ([] without APP_SHELL_URL). */
function tgWhatsonAppRows(rec, label) {
  var u = tgAppUrl('whatson', rec.trip || '');
  return u ? [[{ text: label || '📱 Open in the app', web_app: { url: u + '&board=' + encodeURIComponent(rec.id) } }]] : [];
}
/**
 * The items in the card's order: with a window of more than one day, those on every day of it first ("All these days"),
 * then the rest under their first day; board order within a group. → [{ it, i (board index), group }]
 */
function tgWhatsonGroups(rec, only) {
  var all = tgWoDaysBetween(rec.from, rec.to) + 1, every = [], rest = [];
  rec.items.forEach(function (it, i) {
    if (only && only.indexOf(it.id) < 0) return;
    var days = tgWoDaysIn(it, rec.from, rec.to);
    if (!days.length) return;
    if (all > 1 && days.length === all) every.push({ it: it, i: i, group: 'all' });
    else rest.push({ it: it, i: i, group: days[0] });
  });
  rest.sort(function (a, b) { return a.group !== b.group ? (a.group < b.group ? -1 : 1) : a.i - b.i; });
  return every.concat(rest);
}
/** One item's lines: number, kind, times, linked name, "until", day count, "(dates not yet confirmed)", ✅; then why; then 🌱 💴 🎟. */
function tgWhatsonItemLines(rec, it, n) {
  var days = tgWoDaysIn(it, rec.from, rec.to), all = tgWoDaysBetween(rec.from, rec.to) + 1, bits = [];
  if (it.to > rec.to) bits.push('until ' + tgCmdDate(it.to));
  if (days.length > 1 && days.length < all) bits.push(days.length + ' days');
  var times = it.start ? it.start + (it.end ? '–' + it.end : '') + ' ' : '';
  var lines = ['<b>' + n + '.</b> ' + (TG_WHATSON_EMOJI[it.kind] || '•') + ' ' + times + tgWhatsonHref(it.url, it.name) + (bits.length ? ' · ' + bits.join(' · ') : '') +
    (it.confidence === 'likely' ? ' (dates not yet confirmed)' : '') + (tgWhatsonChoice(rec, it.id) ? ' ✅' : '')];
  if (it.why) lines.push('<i>' + tgEscape(it.why) + '</i>');
  var extra = [it.food ? '🌱 ' + tgEscape(it.food) : '', it.price ? '💴 ' + tgEscape(it.price) : '', it.booking ? '🎟 ' + tgEscape(it.booking) : ''].filter(Boolean);
  if (extra.length) lines.push(extra.join(' · '));
  return lines;
}
/**
 * The card as one message { html, keyboard }: opts = { title?, only?: item ids, empty? }. Grouped as tgWhatsonGroups; a
 * "Sources:" line with up to 3 links; ➕ n (✅ n when chosen) for the choosable kinds and the app button. Past CARD_MAX
 * characters the rest is "… and N more in the app".
 */
function tgWhatsonCard(rec, opts) {
  opts = opts || {};
  var head = (opts.title || '🗓 <b>What\'s on in ' + tgEscape(tgWhatsonPlace(rec)) + '</b>') + ' · ' + tgWhatsonWindowText(rec.from, rec.to);
  var src = rec.sources.slice(0, TG_WHATSON.SOURCES_SHOWN).map(function (s) { return tgWhatsonHref(s.url, s.title); });
  var tail = src.length ? ['', 'Sources: ' + src.join(' · ')] : [];
  var rows = tgWhatsonGroups(rec, opts.only), body = [], btns = [], shown = 0, group = null;
  var max = Math.min(TG_WHATSON.CARD_MAX, LIMITS.TG_SPLIT_AT);   // one message: tgSend splits past TG_SPLIT_AT
  for (var k = 0; k < rows.length; k++) {
    var x = rows[k], block = [];
    if (x.group !== group) block.push('', x.group === 'all' ? '<b>All these days</b>' : '<b>' + tgCmdDate(x.group) + '</b>');
    block = block.concat(tgWhatsonItemLines(rec, x.it, k + 1));
    var size = [head].concat(body, block, tail).join('\n').length + 100;   // room for the "… and N more" and ➕ lines
    if (size > max && shown) break;
    body = body.concat(block);
    group = x.group;
    shown++;
    if (TG_WHATSON_CHOOSABLE.indexOf(x.it.kind) >= 0) {
      btns.push({ text: (tgWhatsonChoice(rec, x.it.id) ? '✅ ' : '➕ ') + (k + 1), data: cbEncode('wo', tgWhatsonKey(rec.id), (x.i + 1) + '.' + tgCmdTag(x.it.id)) });
    }
  }
  if (!rows.length) body.push('', opts.empty || 'Nothing special is on those days.');
  if (shown < rows.length) body.push('', '… and ' + (rows.length - shown) + ' more in the app');
  if (btns.length) body.push('', '➕ chooses a thing for its day; the plan then carries it.');
  var kb = tgCmdRows(btns, 5).concat(tgWhatsonAppRows(rec));
  return { html: [head].concat(body, tail).join('\n'), keyboard: kb.length ? tgKeyboard(kb) : null };
}
function tgWhatsonSend(chatId, rec, opts) {
  var m = tgWhatsonCard(rec, opts);
  return tgSend(chatId, m.html, m.keyboard ? { keyboard: m.keyboard } : undefined);
}
/** /whatson last — the last 10 boards, 🗓 n resends one. */
function tgWhatsonLast(ctx) {
  var all = tgWhatsonList(), list = all.slice(0, TG_WHATSON.CHAT_LIST);
  if (!list.length) { ctx.reply('🗓 No What\'s on boards yet — try <code>/whatson Old Town this weekend</code>.'); return; }
  var lines = ['🗓 <b>Your last What\'s on boards</b>'], btns = [];
  list.forEach(function (b, i) {
    var nChosen = tgWhatsonChosenCount(b, all);   // C15 (coordinator): with the choices made on the trip and place's other boards
    lines.push('<b>' + (i + 1) + '.</b> ' + tgEscape(tgWhatsonPlace(b)) + ' · ' + tgWhatsonWindowText(b.from, b.to) + ' · ' + b.count + ' thing' + (b.count === 1 ? '' : 's') +
      (nChosen ? ' · ✅ ' + nChosen : ''));
    btns.push({ text: '🗓 ' + (i + 1), data: cbEncode('wo', tgWhatsonKey(b.id), 's') });
  });
  lines.push('', 'Tap a number to see its board again.');
  tgCmdSendAll(ctx.chatId, tgCmdMessages(lines, tgKeyboard(tgCmdRows(btns, 5).concat(tgAppRows('whatson', '', '📱 What\'s on in the app')))));
}

/* ==================== choosing ==================== */

/** The board's trip while it is on file, else null. */
function tgWhatsonTrip(rec) { return rec && rec.trip ? tgTripGet(rec.trip) : null; }
/** The days an item can be chosen for: its days in the window, within the trip's days when the board's trip is on file with dates. */
function tgWhatsonCandidateDays(rec, it) {
  var from = rec.from, to = rec.to, trip = tgWhatsonTrip(rec);
  if (trip && tgEnvRealDate(trip.start)) {
    var end = tgEnvRealDate(trip.end) && trip.end >= trip.start ? trip.end : trip.start;
    if (trip.start > from) from = trip.start;
    if (end < to) to = end;
  }
  return from <= to ? tgWoDaysIn(it, from, to) : [];
}
/** The trip's planned day on that date: { trip, day } or null. */
function tgWhatsonPlannedDay(rec, date) {
  var trip = tgWhatsonTrip(rec);
  var day = trip ? tgDigestDays(trip.slug).filter(function (d) { return d.date === date; })[0] : null;
  return day ? { trip: trip, day: day } : null;
}
/** Item n (1-based board position) when its tag still matches, else null. */
function tgWhatsonItemAt(rec, n, tag) {
  var it = rec && n >= 1 ? rec.items[n - 1] : null;
  return it && (tag === undefined || tgCmdTag(it.id) === tag) ? it : null;
}
/**
 * Choose (choose = true, on `day` or the only day that fits) or un-choose an item. → { ok: true, chosen, chosen_on?, rec,
 * planned? } | { ok: false, why: 'not_choosable' | 'no_day' | 'which_day' | 'bad_day', days }
 */
function tgWhatsonChoose(rec, it, choose, day) {
  var list = rec.chosen.filter(function (c) { return c.item !== it.id; }), own = list.length !== rec.chosen.length;
  // C15 (coordinator): a choice lives on one board — un-choosing, or choosing it here, clears it from the trip and place's other boards.
  var clear = function () {
    var holders = tgWhatsonHolders(rec, it.id);
    holders.forEach(function (b) { tgWhatsonSaveChosen(b, b.chosen.filter(function (c) { return c.item !== it.id; })); });
    return holders.length;
  };
  if (!choose) { var was = clear() > 0 || own; return { ok: true, chosen: false, was: was, rec: own ? tgWhatsonSaveChosen(rec, list) : was ? tgWhatsonGet(rec.id) : rec }; }
  if (TG_WHATSON_CHOOSABLE.indexOf(it.kind) < 0) return { ok: false, why: 'not_choosable', days: [] };
  var days = tgWhatsonCandidateDays(rec, it);
  if (!days.length) return { ok: false, why: 'no_day', days: days };
  if (!day) { if (days.length > 1) return { ok: false, why: 'which_day', days: days }; day = days[0]; }
  if (days.indexOf(day) < 0) return { ok: false, why: 'bad_day', days: days };
  clear();
  list.push({ item: it.id, chosen_on: day, at: nowIso() });
  rec = tgWhatsonSaveChosen(rec, list);
  return { ok: true, chosen: true, chosen_on: day, rec: rec, planned: tgWhatsonPlannedDay(rec, day) };
}
/** Open the replan that fits a chosen item into its planned day. → { ok: true, id, day, date } | { ok: false, why: 'not_chosen' | 'not_planned' } */
function tgWhatsonReplan(rec, it, opts) {
  opts = opts || {};
  var c = tgWhatsonChoice(rec, it.id);
  if (!c) return { ok: false, why: 'not_chosen' };
  var pd = tgWhatsonPlannedDay(rec, c.chosen_on);
  if (!pd) return { ok: false, why: 'not_planned' };
  var r = tgOpenKindRequest('replan', { trip: pd.trip.slug, dates: [c.chosen_on], whatson: { board: c.board || rec.id, item: it.id },
    reason: 'added ' + truncate(String(it.name), 120) + ' from What\'s on', deliverables: tgCmdDeliverables(pd.trip) },
    { chat: opts.chat || null, text: 're-plan day ' + pd.day.n + ' for ' + it.name, ack: opts.ack === false ? false
      : '🔁 Fitting <b>' + tgEscape(it.name) + '</b> into day ' + pd.day.n + ' (' + tgCmdDate(c.chosen_on) + ') — replanning that day…' });
  return { ok: true, id: r.id, day: pd.day.n, date: c.chosen_on };
}
/** The answer to a choice: "✅ <name> is chosen for <day>", with "🔁 Re-plan <day>" when that day is planned. */
function tgWhatsonChosenMessage(rec, it, r) {
  var kb = null, html = '✅ <b>' + tgEscape(it.name) + '</b> is chosen for ' + tgCmdDate(r.chosen_on) + '.';
  if (r.planned) {
    html += ' Day ' + r.planned.day.n + ' is already planned — re-plan it to fit this in?';
    var n = rec.items.map(function (x) { return x.id; }).indexOf(it.id) + 1;
    kb = tgKeyboard([[{ text: '🔁 Re-plan ' + tgCmdDate(r.chosen_on), data: cbEncode('wo', tgWhatsonKey(rec.id), n + '.' + tgCmdTag(it.id), 'r') }]]);
  } else if (tgWhatsonTrip(rec)) html += ' The plan carries it when that day is planned.';
  return { html: html, keyboard: kb };
}
var TG_WHATSON_REMOVED = 'Removed — any day already planned keeps it until that day is re-planned';

/**
 * wo:<key>:s resends the card · wo:<key>:<n>.<tag> chooses (asking which day) or un-chooses item n ·
 * wo:<key>:<n>.<tag>:<yyyymmdd> chooses it for that day · wo:<key>:<n>.<tag>:r re-plans its day.
 */
registerCallback('wo', function (ctx) {
  var rec = tgWhatsonByKey(ctx.parts[0]), what = String(ctx.parts[1] || ''), extra = ctx.parts[2];
  if (!rec) { ctx.answer('That board is gone — send /whatson last.'); return; }
  if (what === 's' && extra === undefined) { ctx.answer(''); tgWhatsonSend(ctx.chatId, rec); return; }
  var m = /^(\d{1,2})\.([0-9a-f]{4})$/.exec(what), it = m ? tgWhatsonItemAt(rec, parseInt(m[1], 10), m[2]) : null;
  if (!it) { ctx.answer('That board has changed — send /whatson last.'); return; }
  if (extra === 'r') {
    var rp = tgWhatsonReplan(rec, it, {});
    if (!rp.ok) { ctx.answer(rp.why === 'not_chosen' ? 'It is no longer chosen.' : 'That day has no plan yet.'); return; }
    ctx.answer('Replanning day ' + rp.day);
    if (ctx.messageId) tgApi('editMessageReplyMarkup', { chat_id: ctx.chatId, message_id: ctx.messageId, reply_markup: { inline_keyboard: [] } });
    return;
  }
  var day = null;
  if (extra !== undefined) {
    var d = /^(\d{4})(\d{2})(\d{2})$/.exec(String(extra));
    if (!d) { ctx.answer('Unknown button'); return; }
    day = d[1] + '-' + d[2] + '-' + d[3];
  } else if (tgWhatsonChoice(rec, it.id)) {
    tgWhatsonChoose(rec, it, false);
    ctx.answer(TG_WHATSON_REMOVED, true);
    return;
  }
  var r = tgWhatsonChoose(rec, it, true, day);
  if (!r.ok && r.why === 'which_day') {
    ctx.answer('');
    var btns = r.days.slice(0, TG_WHATSON.ASK_DAYS).map(function (x) { return { text: tgCmdDate(x), data: cbEncode('wo', ctx.parts[0], what, x.replace(/-/g, '')) }; });
    tgSend(ctx.chatId, 'Which day for <b>' + tgEscape(it.name) + '</b>?', { keyboard: tgKeyboard(tgCmdRows(btns, 2)) });
    return;
  }
  if (!r.ok) {
    ctx.answer(r.why === 'not_choosable' ? 'Holidays and closures are for information only.' : r.why === 'no_day' ? 'It runs on none of the trip\'s days.' : 'That day no longer fits.', true);
    return;
  }
  ctx.answer('Chosen');
  if (day && ctx.messageId) tgApi('editMessageReplyMarkup', { chat_id: ctx.chatId, message_id: ctx.messageId, reply_markup: { inline_keyboard: [] } });
  var msg = tgWhatsonChosenMessage(r.rec, it, r);
  tgSend(ctx.chatId, msg.html, msg.keyboard ? { keyboard: msg.keyboard } : undefined);
});

/* ==================== the weekly check (alarm tg_whatson) ==================== */

/** { slug: the date of its last weekly check } (Settings). */
function tgWhatsonChecks() { var p = safeJsonParse(settingGet(TG_WHATSON.SET_CHECKS, '') || '{}'); return p.ok && isPlainObject(p.value) ? p.value : {}; }
/**
 * Each trip's next weekly check, soonest first: [{ trip, date, due }] — trips not done, with dates, whose check day is on or
 * before their last day and whose today has not passed it. The first check is 21 days before the first day, then 7 days
 * after the last; due at 09:00 in the trip's zone, and not before an hour from now while its last request is still open.
 * [] when `whatson_auto` is off.
 */
function tgWhatsonDue(now) {
  if (!tgWhatsonAutoOn()) return [];
  var checks = tgWhatsonChecks(), out = [];
  tgTripList().forEach(function (t) {
    if (!t || t.status === 'done' || !tgEnvRealDate(t.start)) return;
    var end = tgEnvRealDate(t.end) && t.end >= t.start ? t.end : t.start;
    if (tgTripToday(t, new Date(now)) > end) return;
    var date = tgEnvRealDate(checks[t.slug]) ? isoDateAdd(checks[t.slug], TG_WHATSON.AUTO_EVERY_DAYS) : isoDateAdd(t.start, -TG_WHATSON.AUTO_LEAD_DAYS);
    if (date > end) return;
    var due = msAtLocal(tgTripTz(t), date, TG_WHATSON.AUTO_HOUR, 0);
    if (!isFinite(due)) return;
    if (tgWhatsonOpenFor(t.slug)) due = Math.max(due, now + TG_WHATSON.OPEN_RETRY_MS);
    out.push({ trip: t, date: date, due: due });
  });
  return out.sort(function (a, b) { return a.due - b.due; });
}
/** One weekly check: `whatson { trip, from: max(trip today, first day), to: min(last day, from + 30), auto: true }`, no ack. */
function tgWhatsonRunCheck(t, now) {
  var w = tgWhatsonTripWindow(t), today = tgTripToday(t, new Date(now));
  if (!w || today > w.to) return null;
  if (today > w.from) w = { from: today, to: w.to };
  var r = tgWhatsonOpen({ trip: t.slug, from: w.from, to: w.to, auto: true }, { ack: false });
  var checks = tgWhatsonChecks();
  checks[t.slug] = today;
  settingSet(TG_WHATSON.SET_CHECKS, toJson(checks), 'the date of each trip\'s last weekly What\'s on check');
  return r;
}
registerAlarm('tg_whatson', {
  next: function (now) { var d = tgWhatsonDue(now); return d.length ? d[0].due : null; },
  run: function (now) {
    tgWhatsonDue(now).filter(function (x) { return x.due <= now + LIMITS.ALARM_EARLY_SEC * 1000 && !tgWhatsonOpenFor(x.trip.slug); })
      .forEach(function (x) { _safe('tg_whatson_check', function () { tgWhatsonRunCheck(x.trip, now); }); });
  }
});

/* ==================== the `whatson_chosen` snapshot (C15) ==================== */

/**
 * The chosen items of boards whose trip is not done, and of boards without a trip, newest first, ≤ 40:
 * { board, item, trip, place, name, kind, from, to, days?, start?, end?, venue?, url, booking?, chosen_on, chosen_at }.
 */
function tgWhatsonChosenSnapshot() {
  var out = [], done = {};
  tgTripList().forEach(function (t) { if (t.status === 'done') done[t.slug] = true; });
  tgWhatsonList().forEach(function (b) {
    if (b.trip && done[b.trip]) return;
    b.chosen.forEach(function (c) {
      var it = b.items.filter(function (x) { return x.id === c.item; })[0];
      if (!it) return;
      var o = { board: b.id, item: it.id, trip: b.trip || null, place: tgWhatsonPlace(b), name: it.name, kind: it.kind, from: it.from, to: it.to };
      ['days', 'start', 'end', 'venue'].forEach(function (k) { if (it[k] !== undefined) o[k] = it[k]; });
      o.url = it.url;
      if (it.booking !== undefined) o.booking = it.booking;
      o.chosen_on = c.chosen_on;
      o.chosen_at = String(c.at || '');
      Object.defineProperty(o, '_key', { value: (b.trip || '') + '|' + b.place.slug + '|' + it.id, enumerable: false });
      out.push(o);
    });
  });
  out.sort(function (a, b) { return a.chosen_at !== b.chosen_at ? (a.chosen_at < b.chosen_at ? 1 : -1) : 0; });
  // C15 (coordinator): one entry per item of a trip and place, the newest choice, even if two boards ever held it.
  var seen = {};
  out = out.filter(function (o) { if (seen[o._key]) return false; seen[o._key] = true; return true; });
  return out.slice(0, TG_WHATSON.SNAP_MAX);
}
registerSnapshotProvider('whatson_chosen', tgWhatsonChosenSnapshot);

/* ==================== the handler ==================== */

/** The ids on `next` that were not on `prev` (all of them when there is no previous board). */
function tgWhatsonNewIds(prev, next) {
  var had = {};
  (prev ? prev.items : []).forEach(function (it) { had[it.id] = true; });
  return (next.items || []).filter(function (it) { return !had[it.id]; }).map(function (it) { return it.id; });
}

/** The handler registers only while helper.json lists the type: an unlisted type cannot be registered and the core rejects it, audited. */
if (ENVELOPE_TYPES.indexOf('whatson') >= 0) {
  registerEnvelopeHandler('whatson', {
    validate: function (p, env) { return tgEnvCleaned(tgEnvValidateWhatson)(p, env); },
    handle: function (env) {
      var p = env.payload, prev = p.auto === true ? tgWhatsonPrevious(p) : null;
      var st = tgWhatsonStore(p), chat = tgOwnerChat(), r = null, fresh = [];
      if (p.auto === true) {
        fresh = tgWhatsonNewIds(prev, p);
        if (chat && fresh.length) r = tgWhatsonSend(chat, st.rec, { title: '🗓 <b>New on in ' + tgEscape(tgWhatsonPlace(st.rec)) + '</b>', only: fresh });
      } else if (chat) r = tgWhatsonSend(chat, st.rec);
      return { whatson: st.rec.id, items: st.rec.items.length, chosen: st.rec.chosen.length, replaced: st.replaced, auto: p.auto === true, new_items: fresh.length, sent: !!(r && r.ok) };
    }
  });
}

// Developed by: LightAISolutions
