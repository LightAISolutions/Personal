/**
 * Tour Guide pack — Quiet (TG-PHASE-16 WP-16a, Contract C16): for a crowd magnet the owner wants to see anyway, one board
 * of up to 3 quieter places of the same kind within 30 minutes of it, and the magnet's quietest hours.
 *   /quiet <place> [on <date>] → request kind `quiet` { trip?, place, slug?, date? } (trip: the current trip whenever there
 *                            is one); routed to RESEARCH (TG_KIND_ROUTINE), or to DISCOVER when configured (TG_DISCOVER_KINDS)
 *   /quiet                   → 🕊 buttons for the coming stops the plan times around the crowds (≤ 8), the last 5 boards
 *                            as resend buttons, then a one-line how-to (with neither, only the how-to)
 *   envelope `quiet`         → validated (tgEnvValidateQuiet, mirror of schemas/tour-guide-quiet.schema.json and of
 *                            packs/tour-guide/quiet/quiet-payload.mjs; own data only, every Google field refused, ≤ 12 000
 *                            characters, an unknown trip refused), stored in the Quiet tab (a re-delivered id replaces its
 *                            row and keeps what was added), then the card
 *   callback qt:<key>:<n>    → item n onto the Later list of the board's trip, else the current trip (reason owner_choice)
 *            qt:<key>:s      → resend the card
 *            qt:<trip key>:<YYYYMMDD>:<tag> → a day's 🕊 button: the stop found again in that day's digest, then its request
 *   tgQuietDayRows(trip, day) → ≤ 2 rows of one 🕊 button for the skeleton's day hooks (day card, morning message)
 * Board keys are "k" + 12 hex of the board id's hash (Scout's rule). App operations: gas/38_quiet_app.js. Pack side:
 * packs/tour-guide/quiet/. Tests: tests/pack_tour-guide_quiet*.test.js. Defaults: helpers/decisions/WP-16a.md.
 * The @branch line below tells `new-branch.mjs --check quiet` what this branch declares ("-" = not needed); keep it in step.
 */
// @branch quiet command=/quiet kind=quiet envelope=quiet tab=Quiet routine=RESEARCH app=yes discover=yes
var TG_QUIET = {
  SHEET: 'Quiet', PAYLOAD_MAX: 12000, LIST_MAX: 20, PLACE_MAX: 80, ITEMS_MAX: 3, MORE_MAX: 20, LEFT_MAX: 12, LABELS_MAX: 6,
  DAY_ROWS: 2,         // 🕊 rows under one day: a hint, not a second plan
  NAME_CUT: 30,        // a button's stop name, cut so "🕊 Quieter than <name>" fits a phone's width
  BOARD_DAYS: 30,      // a board older than this is asked for again rather than resent
  LIST_STOPS: 8,       // /quiet alone: the coming stops offered
  LIST_BOARDS: 5,      // /quiet alone: the boards offered again
  ID_RE: /^qt-\d{8}-[a-z0-9-]{1,40}$/, KEY_RE: /^k[0-9a-f]{12}$/,
  // Mirror of the planner's noQuietSlotText (planner/planner-crowd.mjs): the warning names the stop first. A prefix match,
  // so a warning the digest cut at 200 characters still names its stop (the parity test holds the two together).
  WARN_RE: /^(.+?): no quieter slot fitted\b/
};
var TG_QUIET_LABELS = ['local_favourite', 'veg_verified', 'veg_likely', 'booking', 'rain_ok', 'seen_before'];
var TG_QUIET_LEFT = ['the_magnet', 'duplicate', 'not_same_kind', 'closed', 'closed_on_dates', 'low_rating', 'unproven', 'diet', 'also_busy', 'not_quieter', 'too_far', 'other'];
var TG_QUIET_WORDS = ['much', 'clearly', 'somewhat'];
var TG_QUIET_MODES = ['WALK', 'TRANSIT'];
var TG_QUIET_PARTS = ['quiet', 'quality', 'fit', 'local', 'reach'];
var TG_QUIET_LEFT_WORDS = { the_magnet: 'part of the place itself', duplicate: 'duplicate', not_same_kind: 'not the same kind of place',
  closed: 'closed', closed_on_dates: 'closed on your day', low_rating: 'low rating', unproven: 'too new to judge', diet: 'does not fit your diet',
  also_busy: 'just as famous', not_quieter: 'not clearly quieter', too_far: 'more than 30 minutes away', other: 'other' };

// The kind's routing, added from this file: tgKindRoutine (00_common.js) reads the table at call time.
TG_KIND_ROUTINE['quiet'] = 'RESEARCH';
// A discovery kind (--discover): with a DISCOVER routine configured, tgKindRoutine sends it there instead.
if (TG_DISCOVER_KINDS.indexOf('quiet') < 0) TG_DISCOVER_KINDS.push('quiet');

registerSheet(TG_QUIET.SHEET, ['id', 'trip', 'magnet_slug', 'magnet_name', 'created_on', 'date', 'count', 'payload_json', 'added_json', 'received_at']);

/* ==================== the owner's words ==================== */

var TG_QUIET_ON_RE = /(?:^|\s+)on\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}|today|tomorrow)\s*$/i;
function tgQuietClean(s) { return String(s === undefined || s === null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim(); }
/**
 * The owner's words → { ok: true, place, date | null } | { ok: false, why: 'bad_date' | 'past_date' | 'too_long' }.
 * Mirror of parseQuietText (packs/tour-guide/quiet/quiet-text.mjs) rule for rule; the shared case list
 * quiet/fixtures/quiet-parse-cases.json holds both to one answer. "on <date>" closes the text, at most once, with
 * /daytrip's date words (tgDaytripDate, 41_daytrip.js); "on" before anything else stays part of the place.
 */
function tgQuietParse(text, today) {
  var s = tgQuietClean(text).replace(/^\/quiet(@[A-Za-z0-9_]+)?(\s+|$)/i, '').replace(/[?.!]+$/, '').trim();
  var date = null, m = TG_QUIET_ON_RE.exec(s);
  if (m) {
    var r = tgDaytripDate(m[1], today);
    if (r.why) return { ok: false, why: r.why };
    date = r.date; s = s.slice(0, m.index);
  }
  var place = tgQuietClean(s);
  if (place.length > TG_QUIET.PLACE_MAX) return { ok: false, why: 'too_long' };
  return { ok: true, place: place, date: date };
}
/** Today where the trip is (the owner's zone without a trip): the day an M/D and "tomorrow" count from. */
function tgQuietToday(trip) { return trip ? tgTripToday(trip) : isoDateIn(getTz()); }

/* ==================== asking ==================== */

var TG_QUIET_USAGE = '🕊 Name a busy place — <code>/quiet &lt;place&gt;</code> or <code>/quiet &lt;place&gt; on 5/14</code> — for up to 3 quieter places of the same kind nearby, and its quietest hours.';
var TG_QUIET_WHY = {
  too_long: '🕊 Please keep the place under ' + TG_QUIET.PLACE_MAX + ' characters — nothing was asked.',
  bad_date: '🕊 I could not read that date — try <code>on 2027-05-14</code>, <code>on 5/14</code>, <code>on today</code> or <code>on tomorrow</code>. Nothing was asked.',
  past_date: '🕊 That date has already passed — nothing was asked.',
  no_place: TG_QUIET_USAGE,
  bad_slug: TG_QUIET_USAGE
};
/** The request text the app and the 🕊 buttons write (the chat sends the owner's words as typed). */
function tgQuietText(place, date) { return '/quiet ' + place + (date ? ' on ' + date : ''); }
/**
 * Open a `quiet` request (C16): opts = { place (1–80), slug? (the trip's place, from a 🕊 button), date? (YYYY-MM-DD,
 * not past), trip? (a trip record; default the current trip), chat?, text? }. → { ok: true, id, routine, fired, trip,
 * place, slug, date } | { ok: false, why: 'no_place' | 'too_long' | 'bad_slug' | 'bad_date' | 'past_date' }
 */
function tgQuietOpen(opts) {
  opts = opts || {};
  var place = tgQuietClean(opts.place), slug = String(opts.slug || ''), date = String(opts.date || '');
  var trip = opts.trip || tgTripCurrent();
  if (!place) return { ok: false, why: 'no_place' };
  if (place.length > TG_QUIET.PLACE_MAX) return { ok: false, why: 'too_long' };
  if (slug && !TG_SLUG_RE.test(slug)) return { ok: false, why: 'bad_slug' };
  if (date && !tgEnvRealDate(date)) return { ok: false, why: 'bad_date' };
  if (date && date < tgQuietToday(trip)) return { ok: false, why: 'past_date' };
  var payload = {};
  if (trip) payload.trip = trip.slug;
  payload.place = place;
  if (slug) payload.slug = slug;
  if (date) payload.date = date;
  var r = tgOpenKindRequest('quiet', payload, { chat: opts.chat || null, text: opts.text || tgQuietText(place, date),
    ack: '🕊 Looking for places quieter than <b>' + tgEscape(place) + '</b>…' });
  return { ok: true, id: r.id, routine: r.routine, fired: !!(r.fired && r.fired.ok), trip: payload.trip || '', place: place, slug: slug, date: date };
}

registerCommand('/quiet', function (ctx) {
  var q = tgQuietParse(String(ctx.args || ''), tgQuietToday(tgTripCurrent()));
  if (!q.ok) { ctx.reply(TG_QUIET_WHY[q.why]); return; }
  if (!q.place) {
    var msgs = q.date ? null : tgQuietListMessages();
    if (msgs) tgCmdSendAll(ctx.chatId, msgs); else ctx.reply(TG_QUIET_USAGE);
    return;
  }
  // The request carries the owner's words as typed; the engine's parse of them is the one that counts (Scout's rule).
  var r = tgQuietOpen({ place: q.place, date: q.date, chat: ctx.chat, text: String(ctx.text || '') });
  if (!r.ok) ctx.reply(TG_QUIET_WHY[r.why] || TG_QUIET_USAGE);
}, 'quieter places of the same kind near a busy one: /quiet <place> [on <date>]');

/**
 * /quiet alone: 🕊 buttons for the coming planned days' stops that tgQuietDayRows would offer (≤ 8, by day and stop
 * order), then the last 5 boards as resend buttons, then the how-to. null when there is neither (the caller sends the how-to).
 */
function tgQuietListMessages() {
  var trip = tgTripCurrent(), stops = [], boards = tgQuietList(TG_QUIET.LIST_BOARDS);
  if (trip) {
    var today = tgTripToday(trip);
    tgDigestDays(trip.slug).forEach(function (d) {
      if (d.date < today) return;
      tgQuietDayStops(d).forEach(function (s) {
        if (stops.length < TG_QUIET.LIST_STOPS) stops.push(tgQuietStopButton(trip, d.date, s, '🕊 ' + truncate(s.name, TG_QUIET.NAME_CUT) + ' · day ' + d.n));
      });
    });
  }
  if (!stops.length && !boards.length) return null;
  var lines = ['🕊 <b>Quieter places</b>'], rows = stops.map(function (b) { return [b]; }), again = [];
  if (stops.length) lines.push('Coming stops your plan times around the crowds — tap one for quieter places nearby.');
  if (boards.length) {
    lines.push('Your last boards:');
    boards.forEach(function (b, i) {
      lines.push('<b>' + (i + 1) + '.</b> Quieter than ' + tgEscape(b.magnet.name) + ' · ' + b.count + ' place' + (b.count === 1 ? '' : 's') +
        (b.date ? ' · ' + tgCmdDate(b.date) : '') + (b.created_on ? ' · asked ' + tgCmdDate(b.created_on) : ''));
      again.push({ text: '🔁 ' + (i + 1), data: cbEncode('qt', tgQuietKey(b.id), 's') });
    });
  }
  lines.push('', TG_QUIET_USAGE);
  return tgCmdMessages(lines, tgKeyboard(rows.concat(tgCmdRows(again, 5))));
}

/* ==================== the Quiet tab ==================== */

function tgQuietJson(v, def) {
  if (v === undefined || v === null || v === '') return def;
  var p = typeof v === 'string' ? safeJsonParse(v) : { ok: true, value: v };
  return p.ok ? p.value : def;
}
/** A row → { id, trip, magnet: { name, slug, place_id, kind, busy, quiet, source }, created_on, date, count, items, more, left_out, added, received_at }. */
function tgQuietRec(r) {
  if (!r) return null;
  var p = tgQuietJson(r.payload_json, {}), added = tgQuietJson(r.added_json, []);
  if (!isPlainObject(p)) p = {};
  var m = isPlainObject(p.magnet) ? p.magnet : {}, src = isPlainObject(m.source) ? m.source : null;
  return { id: tgShStr(r.id), trip: tgShStr(r.trip),
    magnet: { name: tgShStr(m.name) || tgShStr(r.magnet_name), slug: tgShStr(m.slug) || tgShStr(r.magnet_slug), place_id: tgShStr(m.place_id),
      kind: tgShStr(m.kind), busy: m.busy === true, quiet: tgShStr(m.quiet), source: src ? { title: tgShStr(src.title), url: tgShStr(src.url) } : null },
    created_on: tgShDate(r.created_on), date: tgShDate(r.date), count: tgShInt(r.count, 0),
    items: Array.isArray(p.items) ? p.items.filter(isPlainObject) : [], more: typeof p.more === 'number' ? p.more : 0,
    left_out: Array.isArray(p.left_out) ? p.left_out.filter(isPlainObject) : [],
    added: Array.isArray(added) ? added.filter(function (a) { return isPlainObject(a) && typeof a.slug === 'string'; }) : [],
    received_at: tgShStr(r.received_at) };
}
function tgQuietRow(id) {
  id = String(id || '');
  if (!TG_QUIET.ID_RE.test(id)) return null;
  return storeFind(TG_QUIET.SHEET, function (r) { return tgShStr(r.id) === id; }, 1)[0] || null;
}
/** The stored board, or null. */
function tgQuietGet(id) { return tgQuietRec(tgQuietRow(id)); }
/** Newest first (received_at, then row order); limit optional. */
function tgQuietList(limit) {
  var rows = storeAll(TG_QUIET.SHEET).map(function (r) { var x = tgQuietRec(r); x._row = r._row; return x; });
  rows.sort(function (a, b) { return a.received_at !== b.received_at ? (a.received_at < b.received_at ? 1 : -1) : b._row - a._row; });
  rows.forEach(function (x) { delete x._row; });
  return limit ? rows.slice(0, limit) : rows;
}
/** Added entries whose slug is still on the board, each once, in the order they were added. */
function tgQuietAddedFor(items, added) {
  var out = [];
  (added || []).forEach(function (a) {
    if (!items.some(function (x) { return x.slug === a.slug; }) || out.some(function (o) { return o.slug === a.slug; })) return;
    out.push({ slug: a.slug, at: String(a.at || nowIso()) });
  });
  return out;
}
/** Store a validated payload; a re-delivered id replaces its row and keeps each added entry still on the board. → { rec, replaced, dropped } */
function tgQuietStore(p) {
  var old = tgQuietGet(p.id), items = p.items || [], added = tgQuietAddedFor(items, old ? old.added : []);
  storeUpsertById(TG_QUIET.SHEET, { id: p.id, trip: p.trip || '', magnet_slug: p.magnet.slug, magnet_name: p.magnet.name, created_on: p.created_on,
    date: p.date || '', count: items.length, payload_json: toJson(p), added_json: toJson(added), received_at: nowIso() });
  return { rec: tgQuietGet(p.id), replaced: !!old, dropped: old ? old.added.length - added.length : 0 };
}
/** The board's own trip while it is on file and not done, else the current trip (Scout's rule for ➕). */
function tgQuietTargetTrip(rec) {
  var t = rec && rec.trip ? tgTripGet(rec.trip) : null;
  return t && t.status !== 'done' ? t : tgTripCurrent();
}
/**
 * ➕ item n: onto the Later list of tgQuietTargetTrip (reason owner_choice, as Scout's ➕: a rebuild keeps those rows),
 * and its slug into added_json. The chat button and the app's quiet.add both come here.
 * → { ok: true, rec, trip, item, index, days } | { ok: false, why: 'no_item' | 'no_trip' }
 */
function tgQuietAdd(rec, n) {
  var it = rec.items.filter(function (x) { return x.n === n; })[0];
  if (!it || !TG_SLUG_RE.test(String(it.slug || ''))) return { ok: false, why: 'no_item' };
  var trip = tgQuietTargetTrip(rec);
  if (!trip) return { ok: false, why: 'no_trip' };
  tgLaterAdd(trip.slug, { place_slug: it.slug, name: it.name, reason: 'owner_choice' });
  var index = -1;
  tgLaterList(trip.slug).forEach(function (e, k) { if (e.place_slug === it.slug) index = k; });
  var added = rec.added.some(function (a) { return a.slug === it.slug; }) ? rec.added : rec.added.concat([{ slug: it.slug, at: nowIso() }]);
  var row = tgQuietRow(rec.id);
  if (row) storeUpdate(TG_QUIET.SHEET, row._row, { added_json: toJson(tgQuietAddedFor(rec.items, added)) });
  return { ok: true, rec: tgQuietGet(rec.id) || rec, trip: trip, item: it, index: index, days: tgDigestDays(trip.slug) };
}

/* ==================== the card ==================== */

/** A board id as a callback part: always "k" + 12 hex of its hash (Scout's board keys). */
function tgQuietKey(id) { return 'k' + sha1Hex(String(id || '')).slice(0, 12); }
function tgQuietByKey(key) {
  key = String(key || '');
  if (!TG_QUIET.KEY_RE.test(key)) return null;
  var all = tgQuietList();
  for (var i = 0; i < all.length; i++) if (tgQuietKey(all[i].id) === key) return all[i];
  return null;
}
/** "🚶 12 min" on foot, "🚆 about 18 min" by transit when estimated. */
function tgQuietReach(it) {
  var r = isPlainObject(it.reach) ? it.reach : {};
  return (r.mode === 'WALK' ? '🚶 ' : '🚆 ') + (r.estimated ? 'about ' : '') + (r.minutes >= 0 ? r.minutes + ' min' : '?');
}
/** An https page as a link (the validators allow https only); anything else is plain text. */
function tgQuietHref(url, text) {
  var u = String(url || ''), t = tgEscape(text);
  return /^https:\/\/\S+$/.test(u) && u.length <= 2000 ? '<a href="' + tgEscape(u).replace(/"/g, '&quot;') + '">' + t + '</a>' : t;
}
/** "🕊 <b>Quieter than Lantern Shrine</b> · Thu 13 May" */
function tgQuietHeader(rec) { return '🕊 <b>Quieter than ' + tgEscape(rec.magnet.name) + '</b>' + (rec.date ? ' · ' + tgCmdDate(rec.date) : ''); }
/** "🕐 <b>If you go anyway:</b> <quiet line> (<source link>)" */
function tgQuietGoLine(rec) {
  var s = rec.magnet.source;
  return '🕐 <b>If you go anyway:</b> ' + tgEscape(rec.magnet.quiet || 'early is usually quieter') + (s && s.url ? ' (' + tgQuietHref(s.url, s.title || 'source') + ')' : '');
}
/** The app button: the shell's Quiet screen opened on this board ([] without APP_SHELL_URL). */
function tgQuietAppRows(rec, label) {
  var u = tgAppUrl('quiet', rec.trip || '');
  return u ? [[{ text: label || '📱 Open in the app', web_app: { url: u + '&quiet=' + encodeURIComponent(rec.id) } }]] : [];
}
/** ➕ n (✅ n when added), in one row, then 📱 Open in the app; null when there is nothing to show. */
function tgQuietKeyboard(rec) {
  var key = tgQuietKey(rec.id), slugs = rec.added.map(function (a) { return a.slug; });
  var rows = tgCmdRows(rec.items.map(function (it) { return { text: (slugs.indexOf(it.slug) >= 0 ? '✅ ' : '➕ ') + it.n, data: cbEncode('qt', key, it.n) }; }), 3);
  rows = rows.concat(tgQuietAppRows(rec));
  return rows.length ? tgKeyboard(rows) : null;
}
/** [{ html, keyboard? }]: the header, the not-busy line, per item its line, why and best time, then the quiet line. What was left out stays in the app. */
function tgQuietMessages(rec) {
  var lines = [tgQuietHeader(rec)];
  if (!rec.magnet.busy) lines.push('<i>' + tgEscape(rec.magnet.name) + ' is not one of the busiest places nearby, so these are a choice rather than an escape.</i>');
  if (!rec.items.length) lines.push('Nothing of the same kind within 30 minutes is clearly quieter.');
  rec.items.forEach(function (it) {
    lines.push('<b>' + it.n + '.</b> ' + tgCmdHref(it.maps_url, it.name) + ' — ' + tgQuietReach(it) + ' · ' + tgEscape(it.quieter) + ' quieter');
    if (it.why) lines.push('<i>' + tgEscape(it.why) + '</i>');
    if (it.best) lines.push('🕐 ' + tgEscape(it.best));
  });
  if (rec.more > 0) lines.push('<i>…and ' + rec.more + ' more that were also quieter.</i>');
  lines.push(tgQuietGoLine(rec));
  if (rec.items.length) lines.push('', '➕ adds a place to the Later list.');
  return tgCmdMessages(lines, tgQuietKeyboard(rec));
}
function tgQuietSend(chatId, rec) { return tgCmdSendAll(chatId, tgQuietMessages(rec)); }

/** qt:<key>:s resends · qt:<key>:<n> adds item n · qt:<trip key>:<YYYYMMDD>:<tag> asks for a day's stop. */
registerCallback('qt', function (ctx) {
  if (ctx.parts.length === 3) { tgQuietDayTap(ctx); return; }
  if (ctx.parts.length !== 2) { ctx.answer('Unknown button'); return; }
  var rec = tgQuietByKey(ctx.parts[0]), what = String(ctx.parts[1]);
  if (!rec) { ctx.answer('That board is gone — send /quiet.'); return; }
  if (what === 's') { ctx.answer(''); tgQuietSend(ctx.chatId, rec); return; }
  if (!/^[1-3]$/.test(what)) { ctx.answer('Unknown button'); return; }
  var r = tgQuietAdd(rec, parseInt(what, 10));
  if (!r.ok) { ctx.answer(r.why === 'no_trip' ? 'No current trip — /plan one first.' : 'That place is gone — send /quiet.', r.why === 'no_trip'); return; }
  ctx.answer('Added');
  var kb = tgQuietKeyboard(r.rec);
  if (ctx.messageId && kb) tgApi('editMessageReplyMarkup', { chat_id: ctx.chatId, message_id: ctx.messageId, reply_markup: kb });
  var m = tgScoutAddedMessage(r);
  tgSend(ctx.chatId, m.html, m.keyboard ? { keyboard: m.keyboard } : undefined);
});

/* ==================== the 🕊 rows under a day ==================== */

/** The stop names the day's warnings give as having no quiet slot (TG_QUIET.WARN_RE; a warning is text, or { text }). */
function tgQuietWarnedNames(day) {
  var out = [];
  (isPlainObject(day) && Array.isArray(day.warnings) ? day.warnings : []).forEach(function (w) {
    var t = typeof w === 'string' ? w : isPlainObject(w) && typeof w.text === 'string' ? w.text : '';
    var m = TG_QUIET.WARN_RE.exec(t);
    if (m) out.push(m[1]);
  });
  return out;
}
/**
 * The day's stops a 🕊 button is offered for, each once: first the stops with a crowd_slot, then the stops a warning names
 * (the name matching a stop's name exactly, else ignoring case), each group in stop order. A stop needs a slug and a name.
 */
function tgQuietDayStops(day) {
  var stops = (isPlainObject(day) && Array.isArray(day.stops) ? day.stops : []).filter(function (s) {
    return isPlainObject(s) && TG_SLUG_RE.test(String(s.slug || '')) && typeof s.name === 'string' && !!s.name.trim();
  });
  var out = [], warned = {};
  var add = function (s) { if (!out.some(function (o) { return o.slug === s.slug; })) out.push(s); };
  stops.forEach(function (s) { if (s.crowd_slot === 'opening' || s.crowd_slot === 'late') add(s); });
  tgQuietWarnedNames(day).forEach(function (nm) {
    var hit = stops.filter(function (s) { return s.name === nm; })[0] ||
      stops.filter(function (s) { return s.name.toLowerCase() === nm.toLowerCase(); })[0];
    if (hit) warned[hit.slug] = true;
  });
  stops.forEach(function (s) { if (warned[s.slug]) add(s); });
  return out;
}
/** The newest board for a magnet slug received in the last 30 days, of this trip or of none; null when there is none. */
function tgQuietBoardFor(trip, slug) {
  var since = new Date(nowDate().getTime() - TG_QUIET.BOARD_DAYS * 86400000).toISOString();
  return tgQuietList().filter(function (b) {
    return b.magnet.slug === slug && (!b.trip || (trip && b.trip === trip.slug)) && b.received_at >= since;
  })[0] || null;
}
/** One stop's 🕊 button: the resend of its recent board, else the ask (qt:<trip key>:<YYYYMMDD>:<tag>, four parts). */
function tgQuietStopButton(trip, date, stop, text) {
  var b = tgQuietBoardFor(trip, stop.slug);
  return { text: text, data: b ? cbEncode('qt', tgQuietKey(b.id), 's') : cbEncode('qt', tgCmdTripKey(trip.slug), String(date).replace(/-/g, ''), tgCmdTag(stop.slug)) };
}
/**
 * C16: the 🕊 rows tgCmdDayRows (10_commands.js) puts under a day — at most 2 rows of one button, "🕊 Quieter than <name>"
 * (the name cut to 30). A day before the trip's today gets none.
 */
function tgQuietDayRows(trip, day) {
  if (!trip || !isPlainObject(day) || !tgEnvRealDate(String(day.date || ''))) return [];
  if (day.date < tgTripToday(trip)) return [];
  return tgQuietDayStops(day).slice(0, TG_QUIET.DAY_ROWS).map(function (s) {
    return [tgQuietStopButton(trip, day.date, s, '🕊 Quieter than ' + truncate(s.name.trim(), TG_QUIET.NAME_CUT))];
  });
}
/** qt:<trip key>:<YYYYMMDD>:<tag>: the stop found again in that day's digest, then its request { trip, place, slug, date }. */
function tgQuietDayTap(ctx) {
  var trip = tgCmdTripByKey(ctx.parts[0]), d8 = String(ctx.parts[1]), tag = String(ctx.parts[2]);
  var date = /^\d{8}$/.test(d8) ? d8.slice(0, 4) + '-' + d8.slice(4, 6) + '-' + d8.slice(6) : '';
  var day = trip && tgEnvRealDate(date) ? tgDigestDay(trip.slug, date) : null;
  var stop = day ? (Array.isArray(day.stops) ? day.stops : []).filter(function (s) {
    return isPlainObject(s) && TG_SLUG_RE.test(String(s.slug || '')) && typeof s.name === 'string' && !!s.name.trim() && tgCmdTag(s.slug) === tag;
  })[0] : null;
  if (!stop) { ctx.answer('That day has changed — send /day again.'); return; }
  var r = tgQuietOpen({ trip: trip, place: truncate(tgQuietClean(stop.name), TG_QUIET.PLACE_MAX), slug: stop.slug, date: date, chat: ctx.chat || null });
  if (!r.ok) { ctx.answer(r.why === 'past_date' ? 'That day has passed.' : 'That day has changed — send /day again.'); return; }
  ctx.answer('Asked');
}

/* ==================== the `quiet` envelope ==================== */

function tgEnvQuietItem(errs, at, it) {
  if (!tgEnvObj(errs, at, it, ['n', 'slug', 'name', 'kind', 'reach', 'quieter', 'why', 'score', 'parts', 'labels', 'maps_url'], ['place_id', 'best'])) return;
  if (it.n !== undefined) tgEnvInt(errs, at + '.n', it.n, 1, TG_QUIET.ITEMS_MAX);
  if (it.slug !== undefined) tgEnvSlug(errs, at + '.slug', it.slug);
  if (it.name !== undefined) tgEnvStr(errs, at + '.name', it.name, 1, 120);
  if (it.place_id !== undefined) tgEnvStr(errs, at + '.place_id', it.place_id, 6, 300, TG_ENV_RE.placeId);
  if (it.kind !== undefined) tgEnvStr(errs, at + '.kind', it.kind, 1, 40);
  if (it.reach !== undefined && tgEnvObj(errs, at + '.reach', it.reach, ['minutes', 'mode', 'estimated'])) {
    if (it.reach.minutes !== undefined) tgEnvInt(errs, at + '.reach.minutes', it.reach.minutes, 0, 180);
    if (it.reach.mode !== undefined) tgEnvEnum(errs, at + '.reach.mode', it.reach.mode, TG_QUIET_MODES);
    if (it.reach.estimated !== undefined) tgEnvBool(errs, at + '.reach.estimated', it.reach.estimated);
  }
  if (it.quieter !== undefined) tgEnvEnum(errs, at + '.quieter', it.quieter, TG_QUIET_WORDS);
  if (it.why !== undefined) tgEnvStr(errs, at + '.why', it.why, 1, 200);
  if (it.best !== undefined) tgEnvStr(errs, at + '.best', it.best, 1, 120);
  if (it.score !== undefined) tgEnvInt(errs, at + '.score', it.score, 0, 100);
  if (it.parts !== undefined && tgEnvObj(errs, at + '.parts', it.parts, TG_QUIET_PARTS)) {
    TG_QUIET_PARTS.forEach(function (k) { if (it.parts[k] !== undefined) tgEnvInt(errs, at + '.parts.' + k, it.parts[k], 0, 100); });
  }
  if (it.labels !== undefined && tgEnvArr(errs, at + '.labels', it.labels, TG_QUIET.LABELS_MAX)) {
    it.labels.forEach(function (l, j) { tgEnvEnum(errs, at + '.labels[' + j + ']', l, TG_QUIET_LABELS); });
    it.labels.forEach(function (l, j) { if (it.labels.indexOf(l) !== j) errs.push(at + '.labels[' + j + ']: duplicate label'); });
  }
  if (it.maps_url !== undefined) tgEnvUrl(errs, at + '.maps_url', it.maps_url);
}
/**
 * Mirror of schemas/tour-guide-quiet.schema.json and of validateQuietPayload (packs/tour-guide/quiet/quiet-payload.mjs),
 * rule for rule and message for message (C16): required keys, types, enums, sizes, rank order, unique slugs and labels,
 * real dates, no Google field anywhere (tgScoutGoogleKeys), and the whole payload at most 12 000 characters.
 */
function tgEnvValidateQuiet(p) {
  var errs = [];
  if (!isPlainObject(p)) return ['payload must be an object'];
  tgScoutGoogleKeys(p, '').forEach(function (k) { errs.push(k + ': Google field refused (own data only)'); });
  if (!tgEnvObj(errs, 'payload', p, ['id', 'trip', 'created_on', 'magnet', 'items', 'left_out'], ['v', 'date', 'more'])) return tgEnvDone(errs);
  if (p.v !== undefined && p.v !== 1) errs.push('v must be 1');
  if (p.id !== undefined) tgEnvStr(errs, 'id', p.id, 1, 52, TG_QUIET.ID_RE);
  if (p.trip !== undefined && p.trip !== null) tgEnvSlug(errs, 'trip', p.trip);
  if (p.created_on !== undefined) tgEnvDate(errs, 'created_on', p.created_on);
  if (p.date !== undefined) tgEnvDate(errs, 'date', p.date);
  if (p.magnet !== undefined && tgEnvObj(errs, 'magnet', p.magnet, ['name', 'slug', 'kind', 'busy', 'quiet'], ['place_id', 'source'])) {
    var m = p.magnet;
    if (m.name !== undefined) tgEnvStr(errs, 'magnet.name', m.name, 1, 120);
    if (m.slug !== undefined) tgEnvSlug(errs, 'magnet.slug', m.slug);
    if (m.place_id !== undefined) tgEnvStr(errs, 'magnet.place_id', m.place_id, 6, 300, TG_ENV_RE.placeId);
    if (m.kind !== undefined) tgEnvStr(errs, 'magnet.kind', m.kind, 1, 40);
    if (m.busy !== undefined) tgEnvBool(errs, 'magnet.busy', m.busy);
    if (m.quiet !== undefined) tgEnvStr(errs, 'magnet.quiet', m.quiet, 1, 160);
    if (m.source !== undefined && tgEnvObj(errs, 'magnet.source', m.source, ['title', 'url'])) {
      if (m.source.title !== undefined) tgEnvStr(errs, 'magnet.source.title', m.source.title, 1, 120);
      if (m.source.url !== undefined) tgEnvUrl(errs, 'magnet.source.url', m.source.url);
    }
  }
  if (p.more !== undefined) tgEnvInt(errs, 'more', p.more, 0, TG_QUIET.MORE_MAX);
  if (p.items !== undefined && tgEnvArr(errs, 'items', p.items, TG_QUIET.ITEMS_MAX)) {
    p.items.forEach(function (it, i) {
      tgEnvQuietItem(errs, 'items[' + i + ']', it);
      if (isPlainObject(it) && typeof it.n === 'number' && it.n !== i + 1) errs.push('items[' + i + '].n must be ' + (i + 1) + ' (rank order)');
    });
    tgEnvDupes(errs, 'items', p.items, 'slug', 'slug');
  }
  if (p.left_out !== undefined && tgEnvArr(errs, 'left_out', p.left_out, TG_QUIET.LEFT_MAX)) {
    p.left_out.forEach(function (l, i) {
      var at = 'left_out[' + i + ']';
      if (!tgEnvObj(errs, at, l, ['name', 'reason'])) return;
      if (l.name !== undefined) tgEnvStr(errs, at + '.name', l.name, 1, 120);
      if (l.reason !== undefined) tgEnvEnum(errs, at + '.reason', l.reason, TG_QUIET_LEFT);
    });
  }
  tgEnvSize(errs, p);
  var n = toJson(p).length;
  if (n > TG_QUIET.PAYLOAD_MAX) errs.push('payload is ' + n + ' chars (max ' + TG_QUIET.PAYLOAD_MAX + ')');
  return tgEnvDone(errs);
}

/** The handler registers only while helper.json lists the type: an unlisted type cannot be registered and the core rejects it, audited. */
if (ENVELOPE_TYPES.indexOf('quiet') >= 0) {
  registerEnvelopeHandler('quiet', {
    validate: function (p, env) {
      var errs = tgEnvCleaned(tgEnvValidateQuiet)(p, env);
      // A board names a trip the core knows, or none (null): the vegcard rule.
      if (!errs.length && p.trip !== null && !tgTripGet(p.trip)) errs.push('trip: unknown trip "' + truncate(String(p.trip), 64) + '"');
      return errs;
    },
    handle: function (env) {
      var st = tgQuietStore(env.payload), chat = tgOwnerChat(), r = chat ? tgQuietSend(chat, st.rec) : null;
      return { quiet: st.rec.id, replaced: st.replaced, added: st.rec.added.length, sent: !!(r && r.ok) };
    }
  });
}

// Developed by: LightAISolutions
