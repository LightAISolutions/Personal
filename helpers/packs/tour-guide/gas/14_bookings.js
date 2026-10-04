/**
 * Tour Guide pack — booking deadlines and reminders (WP-10a, suggestion 6; brief helpers/prompts/TG-PHASE-10.md).
 *   Store    `Bookings` tab (registered, and created on first use for a deployment set up before it existed): one row per
 *            (trip, id) — record_json (the brain's record), status, status_by (brain | owner), snooze_until, last_reminded,
 *            alerted_at, updated_at. tgBkStore(payload) applies a `bookings` envelope: the brain's list replaces the trip's
 *            rows, except that an owner's ✅ booked / not needed stays when the brain sends todo or not_needed (the brain
 *            may still move a record to booked); records missing from the list are removed.
 *   Show     tgBkTripLines(trip) for /trip · /bookings (every open booking, nearest deadline first) · tgBkDayLines(trip, day)
 *            for the day card (WP-10b) · each time in the trip's zone and in the owner's current zone ("your time").
 *            A booking with a place and no for_date shows on the first stored day that plans its place (tgBkPlannedDate).
 *   Remind   one core alarm (registerAlarm 'tg_bookings', 17_alarms.js): an opening alert ~30 min before opens_at and one
 *            daily reminder at 09:00 in the owner's current zone (tgOwnerTz). Timed triggers run at or after their time,
 *            sometimes minutes late, so every check compares against "now" and nothing depends on exact timing.
 *   Buttons  bk:<10 hex of sha1(trip|id)>:<b|n|t> — ✅ Booked · Not needed · Tomorrow (snooze to the next local day);
 *            a tap edits the message in place and re-arms the alarm. /bookings now sends today's reminder at once.
 * All text goes through tgEscape; links are https only. Defaults: helpers/decisions/WP-10a.md.
 */
var TG_BK_SHEET = 'Bookings';
var TG_BK_COLS = ['trip', 'id', 'record_json', 'status', 'status_by', 'snooze_until', 'last_reminded', 'alerted_at', 'updated_at'];
registerSheet(TG_BK_SHEET, TG_BK_COLS);
var TG_BK = {
  ALERT_LEAD_MIN: 30,      // the opening alert goes about this long before opens_at
  ALERT_STALE_MIN: 30,     // a record that opened longer ago than this when it arrives gets no opening alert
  DAILY_HOUR: 9,           // the daily reminder, local hour in the owner's current zone
  DAILY_LATE_HOURS: 3,     // a daily reminder not sent by 12:00 waits for tomorrow (no evening nag after a late arrival)
  DAILY_SETTING: 'tg_bk_daily',   // Settings: the local date (YYYY-MM-DD) of the last daily reminder
  DAILY_AT_SETTING: 'tg_bk_daily_at',   // Settings: the instant (ISO) of the last daily reminder (WP-13c, A10)
  DAILY_GAP_HOURS: 12,     // a daily reminder never goes out within this long of the previous one (a zone change)
  PER_MESSAGE: 10,         // reminder lines per message (3 buttons each)
  KEY_HEX: 10
};
var TG_BK_DONE = ['booked', 'not_needed'];
var TG_BK_CODES = { b: 'booked', n: 'not_needed', t: 'snooze' };
var TG_BK_ICON = { train: '🚆', lodging: '🛏', meal: '🍽', sight: '🎟', experience: '🎟', other: '🎟' };

/* ---------------- storage ---------------- */
function _tgBkHasTab() { return !!getSpreadsheet().getSheetByName(TG_BK_SHEET); }
/** Before a write: the tab (and every column) exists — setup is not re-run on every deploy. */
function _tgBkEnsure() { if (!_tgBkHasTab()) ensureSheets(); else _tgEnsureCols(TG_BK_SHEET, TG_BK_COLS); }
/** A booking instant in ms (NaN when absent or malformed). */
function tgBkMs(v) { var s = tgShStr(v); return tgEnvBkAtOk(s) ? Date.parse(s) : NaN; }
function tgBkKey(trip, id) { return sha1Hex(String(trip) + '|' + String(id)).slice(0, TG_BK.KEY_HEX); }
/**
 * Stored bookings, optionally for one trip (slug or trip object): [{ _row, trip, id, key, rec, status, status_by,
 * snooze_until, last_reminded, alerted_at, updated_at }]. No tab yet → [] (reads never create it).
 */
function tgBkAll(trip) {
  if (!_tgBkHasTab()) return [];
  var slug = trip === undefined || trip === null ? null : tgShStr(typeof trip === 'object' ? trip.slug : trip);
  return storeAll(TG_BK_SHEET).map(function (r) {
    var rec = tgShJson(r.record_json, null), st = tgShStr(r.status);
    if (!isPlainObject(rec) || typeof rec.title !== 'string') return null;
    var t = tgShStr(r.trip), id = tgShStr(r.id);
    return { _row: r._row, trip: t, id: id, key: tgBkKey(t, id), rec: rec, status: TG_ENV_BOOKING_STATUSES.indexOf(st) >= 0 ? st : 'todo',
      status_by: tgShStr(r.status_by) === 'owner' ? 'owner' : 'brain', snooze_until: tgShStr(r.snooze_until),
      last_reminded: tgShStr(r.last_reminded), alerted_at: tgShStr(r.alerted_at), updated_at: tgShStr(r.updated_at) };
  }).filter(function (b) { return b && (slug === null || b.trip === slug); });
}
function tgBkByKey(key) { return tgBkAll().filter(function (b) { return b.key === key; })[0] || null; }
/** '' — or now, when the record opened so long ago that an "opens soon" alert would be noise. */
function _tgBkAlertSeed(rec, now) {
  var o = tgBkMs(rec.opens_at);
  return isFinite(o) && o < now - TG_BK.ALERT_STALE_MIN * 60000 ? new Date(now).toISOString() : '';
}
/**
 * Apply a validated `bookings` payload: the trip exists (created like other envelopes do), its zone is p.tz, and its rows
 * become exactly p.bookings — an owner's booked / not_needed survives a brain todo / not_needed; snooze and reminder
 * marks are kept; a changed opens_at re-arms its opening alert. → { total, todo, added_todo, removed, kept_owner }
 */
function tgBkStore(p) {
  var now = nowMs(), iso = new Date(now).toISOString();
  tgTripUpsert({ slug: p.trip });
  tgTripSetTz(p.trip, p.tz);
  _tgBkEnsure();
  var old = {}, out = { total: p.bookings.length, todo: 0, added_todo: 0, removed: 0, kept_owner: 0 };
  tgBkAll(p.trip).forEach(function (b) { old[b.id] = b; });
  p.bookings.forEach(function (rec) {
    var prev = Object.prototype.hasOwnProperty.call(old, rec.id) ? old[rec.id] : null, status = rec.status, by = 'brain';
    if (prev) {
      delete old[rec.id];
      if (prev.status_by === 'owner' && TG_BK_DONE.indexOf(prev.status) >= 0 && rec.status !== 'booked') {
        status = prev.status; by = 'owner';
        if (rec.status !== prev.status) out.kept_owner++;
      } else if (prev.status_by === 'owner' && prev.status === rec.status) by = 'owner';
      var moved = tgShStr(prev.rec.opens_at) !== tgShStr(rec.opens_at);
      storeUpdate(TG_BK_SHEET, prev._row, { record_json: toJson(rec), status: status, status_by: by,
        alerted_at: moved ? _tgBkAlertSeed(rec, now) : prev.alerted_at, updated_at: iso });
    } else {
      storeAppend(TG_BK_SHEET, { trip: p.trip, id: rec.id, record_json: toJson(rec), status: status, status_by: by, snooze_until: '',
        last_reminded: '', alerted_at: _tgBkAlertSeed(rec, now), updated_at: iso });
      if (status === 'todo') out.added_todo++;
    }
    if (status === 'todo') out.todo++;
  });
  var gone = Object.keys(old).map(function (k) { return old[k]._row; });
  if (gone.length) out.removed = storeDeleteRows(TG_BK_SHEET, gone);
  return out;
}
/** Snapshot (tour_guide.bookings): { <trip>: [{ id, status, status_by, updated_at }] }. */
function tgBkSnapshot() {
  var out = {};
  tgBkAll().forEach(function (b) { (out[b.trip] = out[b.trip] || []).push({ id: b.id, status: b.status, status_by: b.status_by, updated_at: b.updated_at }); });
  return out;
}

/* ---------------- show ---------------- */
/** 24 h "Mon 1 Mar 10:00" or 12 h "Sun 28 Feb 1:00 pm" in tz. */
function tgBkFmt(ms, tz, twelve) {
  var s = Utilities.formatDate(new Date(ms), tz, twelve ? 'EEE d MMM h:mm a' : 'EEE d MMM HH:mm');
  return twelve ? s.replace(/ AM$/, ' am').replace(/ PM$/, ' pm') : s;
}
/**
 * Both times: "Mon 1 Mar 10:00 in Port Sorrel · Sun 28 Feb 1:00 pm your time" (trip zone, then the owner's current zone);
 * one time when both read the same (no trip zone, or the owner is on the trip).
 */
function tgBkBoth(ms, trip, ownerTz) {
  var tz = tgTripTz(trip), there = tgBkFmt(ms, tz, false);
  if (there === tgBkFmt(ms, ownerTz, false)) return there;
  return there + ' in ' + tgEscape(trip.destination || trip.title || trip.slug) + ' · ' + tgBkFmt(ms, ownerTz, true) + ' your time';
}
/** The deadline a list sorts by: book_by, else opens_at, else the start of for_date in the trip's zone, else last. */
function tgBkDue(b, trip) {
  var by = tgBkMs(b.rec.book_by);
  if (isFinite(by)) return by;
  var o = tgBkMs(b.rec.opens_at);
  if (isFinite(o)) return o;
  var d = tgEnvRealDate(b.rec.for_date) ? msAtLocal(tgTripTz(trip), b.rec.for_date, 0, 0) : NaN;
  return isFinite(d) ? d : Infinity;
}
function _tgBkSnoozed(b, now) { var s = Date.parse(b.snooze_until); return isFinite(s) && s > now; }
/** An https booking link (escaped, ≤ 2000 chars) or ''. */
function tgBkHref(url) {
  var u = String(url || '');
  if (!TG_ENV_RE.url.test(u) || u.length > 2000) return '';
  return '<a href="' + tgEscape(u).replace(/"/g, '&quot;') + '">book here</a>';
}
/**
 * One booking as escaped HTML lines: title (and trip), the rule, when it opens / is due in both zones, the day it is for,
 * the link, and its state. opts: { n, tripName }.
 */
function tgBkLine(b, trip, now, ownerTz, opts) {
  opts = opts || {};
  var r = b.rec, out = [];
  out.push((opts.n ? '<b>' + opts.n + '.</b> ' : '') + (TG_BK_ICON[r.kind] || '🎟') + ' <b>' + tgEscape(r.title) + '</b>' +
    (opts.tripName ? ' <i>· ' + tgCmdTitle(trip) + '</i>' : ''));
  out.push('   ' + tgEscape(r.rule) + (r.how ? ' · ' + tgEscape(r.how) : ''));
  var o = tgBkMs(r.opens_at), by = tgBkMs(r.book_by), open = b.status === 'todo';
  if (isFinite(o) && (!open || o > now)) out.push('   opens ' + tgBkBoth(o, trip, ownerTz));
  else if (isFinite(o)) out.push('   open since ' + tgBkBoth(o, trip, ownerTz));
  if (isFinite(by)) out.push('   ' + (open && by < now ? '⚠️ <b>overdue</b> — was due ' : 'book by ') + tgBkBoth(by, trip, ownerTz));
  if (tgEnvRealDate(r.for_date)) out.push('   for ' + tgCmdDate(r.for_date));
  else { var pd = tgBkPlannedDate(b, typeof tgDigestDays === 'function' ? tgDigestDays(trip.slug) : []); if (pd) out.push('   planned for ' + tgCmdDate(pd)); }
  var link = open ? tgBkHref(r.url) : '';
  if (link) out.push('   ' + link);
  if (b.status === 'booked') out.push('   ✅ booked');
  else if (b.status === 'not_needed') out.push('   ➖ not needed');
  else if (_tgBkSnoozed(b, now)) out.push('   💤 snoozed until ' + tgBkFmt(Date.parse(b.snooze_until), ownerTz, false).replace(/ 00:00$/, ''));
  return out.join('\n');
}
/** /trip: the trip's open bookings (nearest deadline first) with the done ones folded into one count; [] when none. */
function tgBkTripLines(trip) {
  var all = tgBkAll(trip.slug);
  if (!all.length) return [];
  var now = nowMs(), tz = tgOwnerTz();
  var open = all.filter(function (b) { return b.status === 'todo'; }).sort(function (a, c) { return tgBkDue(a, trip) - tgBkDue(c, trip); });
  var booked = all.filter(function (b) { return b.status === 'booked'; }).length, skip = all.length - open.length - booked;
  var out = ['', '🎟 <b>Bookings</b>' + (open.length ? ' — ' + open.length + ' to make' : ' — all sorted')];
  open.forEach(function (b) { out.push(tgBkLine(b, trip, now, tz)); });
  if (booked || skip) out.push('<i>' + [booked ? '✅ ' + booked + ' booked' : '', skip ? skip + ' not needed' : ''].filter(String).join(' · ') + '</i>');
  return out;
}
/**
 * WP-12d REQUEST 2: a booking with a place but no for_date belongs to the first stored day (tgDigestDays order) whose
 * stops, or dinner, name that place — the same rule as the planner's dinner line and the brochure. Read only: the date
 * is never written into for_date. → 'YYYY-MM-DD' or ''.
 */
function tgBkPlannedDate(b, days) {
  var r = b && b.rec, place = r && typeof r.place === 'string' ? r.place : '';
  if (!place || tgEnvRealDate(r.for_date)) return '';
  for (var i = 0; i < (days || []).length; i++) {
    var d = days[i] || {};
    var onStops = (d.stops || []).some(function (s) { return s && s.slug === place; });
    if (onStops || (isPlainObject(d.dinner) && d.dinner.slug === place)) return String(d.date || '');
  }
  return '';
}
/**
 * The day card's lines (WP-10b, behind a typeof guard): bookings for that day, booked or still to book ("not needed"
 * ones are left out). trip: slug or trip object; day: the stored day object (its `date`) or a 'YYYY-MM-DD' string.
 */
function tgBkDayLines(trip, day) {
  var t = trip && typeof trip === 'object' ? trip : tgTripGet(trip);
  var d = day && typeof day === 'object' ? day.date : day;   // the day card passes the stored day; tests pass its date
  if (!t || !d) return [];
  var all = tgBkAll(t.slug), days = null;
  return all.filter(function (b) {
    if (b.status === 'not_needed') return false;
    if (tgEnvRealDate(b.rec.for_date)) return b.rec.for_date === d;   // a dated booking stays on its own date
    if (!b.rec.place) return false;
    if (days === null) days = typeof tgDigestDays === 'function' ? tgDigestDays(t.slug) : [];
    return tgBkPlannedDate(b, days) === d;
  })
    .sort(function (a, c) { return tgBkDue(a, t) - tgBkDue(c, t); })
    .map(function (b) {
      return (TG_BK_ICON[b.rec.kind] || '🎟') + ' ' + tgEscape(b.rec.title) + ' · ' +
        (b.status === 'booked' ? '✅ booked' : '⏳ still to book — ' + tgEscape(b.rec.rule));
    });
}
/** Every open (todo) booking of a trip that is not done and whose day has not passed: [{ b, trip, due }], nearest first. */
function tgBkOpenList() {
  var trips = {};
  tgTripList().forEach(function (t) { trips[t.slug] = t; });
  return tgBkAll().filter(function (b) {
    var t = trips[b.trip];
    return b.status === 'todo' && t && t.status !== 'done' && !(tgEnvRealDate(b.rec.for_date) && b.rec.for_date < tgTripToday(t));
  }).map(function (b) { return { b: b, trip: trips[b.trip], due: tgBkDue(b, trips[b.trip]) }; })
    .sort(function (x, y) { return x.due - y.due || (x.b.trip + '|' + x.b.id < y.b.trip + '|' + y.b.id ? -1 : 1); });
}
registerCommand('/bookings', function (ctx) {
  var arg = String(ctx.args || '').trim().toLowerCase(), now = nowMs();
  if (arg === 'now') {
    var r = tgBkSendDaily(now, { force: true });
    if (!r.sent) ctx.reply(r.text);
    _safe('alarm_arm', function () { return alarmArm(); });
    return;
  }
  if (arg) { ctx.reply('Use <code>/bookings</code> (the list) or <code>/bookings now</code> (today\'s reminder).'); return; }
  var list = tgBkOpenList();
  if (!list.length) { ctx.reply('🎟 No bookings left to make.'); return; }
  var tz = tgOwnerTz(), trips = {};
  list.forEach(function (x) { trips[x.b.trip] = 1; });
  var many = Object.keys(trips).length > 1;
  var lines = ['🎟 <b>Bookings to make</b> (' + list.length + ') — nearest deadline first'];
  list.forEach(function (x, i) { lines.push(tgBkLine(x.b, x.trip, now, tz, { n: i + 1, tripName: many })); });
  lines.push('', '<i>/bookings now sends the reminder with ✅ buttons.</i>');
  tgCmdSendAll(ctx.chatId, tgCmdMessages(lines));
}, 'bookings still to make, nearest deadline first (/bookings now: today\'s reminder with buttons)');

/* ---------------- remind: one alarm, opening alerts and the 09:00 reminder ---------------- */
/** ✅ Booked · Not needed · Tomorrow for one record (n labels the row when a message holds several). */
function tgBkButtons(b, n) {
  var p = n ? n + ' ' : '';
  return [{ text: p + '✅ Booked', data: cbEncode('bk', b.key, 'b') }, { text: p + 'Not needed', data: cbEncode('bk', b.key, 'n') },
    { text: p + 'Tomorrow', data: cbEncode('bk', b.key, 't') }];
}
/** A reminder message for entries [{ b, trip }]: header + numbered lines; buttons only for records still to book now. */
function tgBkCard(header, entries, now) {
  var tz = tgOwnerTz(), many = entries.length > 1, rows = [], lines = [header];
  entries.forEach(function (x, i) {
    lines.push(tgBkLine(x.b, x.trip, now, tz, { n: many ? i + 1 : 0, tripName: true }));
    if (x.b.status === 'todo' && !_tgBkSnoozed(x.b, now)) rows.push(tgBkButtons(x.b, many ? i + 1 : 0));
  });
  return { html: tgHtmlClip(lines.join('\n'), LIMITS.TG_MAX_CHARS), keyboard: rows.length ? tgKeyboard(rows) : { inline_keyboard: [] } };
}
/** Todo records whose window is open now and that are not snoozed — what the daily reminder lists. */
function tgBkReminderList(now) {
  return tgBkOpenList().filter(function (x) { var o = tgBkMs(x.b.rec.opens_at); return !_tgBkSnoozed(x.b, now) && !(o > now); });
}
/** When the daily reminder is next due: 09:00 today in the owner's zone (until 12:00, if not yet sent today), else tomorrow. */
function tgBkDailyDue(now) {
  var tz = tgOwnerTz(), today = isoDateIn(tz, new Date(now));
  var at = msAtLocal(tz, today, TG_BK.DAILY_HOUR, 0);
  // A10: a day whose 09:00 comes within 12 h of the last reminder (the owner's zone just moved ahead) waits for the next.
  var last = Date.parse(String(settingGet(TG_BK.DAILY_AT_SETTING, '') || '')), floor = isFinite(last) ? last + TG_BK.DAILY_GAP_HOURS * 3600000 : -Infinity;
  if (String(settingGet(TG_BK.DAILY_SETTING, '')).slice(0, 10) !== today && now <= at + TG_BK.DAILY_LATE_HOURS * 3600000 && at >= floor) return at;
  var d = isoDateAdd(today, 1), next = msAtLocal(tz, d, TG_BK.DAILY_HOUR, 0);
  for (var i = 0; i < 3 && next < floor; i++) { d = isoDateAdd(d, 1); next = msAtLocal(tz, d, TG_BK.DAILY_HOUR, 0); }
  return next;
}
/**
 * Send the daily reminder (opts.force: /bookings now, whatever was sent today). Marks the local day as done only when
 * every message went out (a failed send is retried by the alarm). → { sent, messages, text }
 */
function tgBkSendDaily(now, opts) {
  opts = opts || {};
  var tz = tgOwnerTz(), list = tgBkReminderList(now), ok = true, messages = 0, iso = new Date(now).toISOString();
  for (var i = 0; i < list.length; i += TG_BK.PER_MESSAGE) {
    var chunk = list.slice(i, i + TG_BK.PER_MESSAGE);
    var head = '⏰ <b>Bookings to make</b>' + (list.length > TG_BK.PER_MESSAGE ? ' (' + (i + 1) + '–' + (i + chunk.length) + ' of ' + list.length + ')' : '');
    var card = tgBkCard(head, chunk, now), r = tgSendOwner(card.html, { keyboard: card.keyboard });
    if (r && r.ok) { messages++; chunk.forEach(function (x) { storeUpdate(TG_BK_SHEET, x.b._row, { last_reminded: iso }); }); } else ok = false;
  }
  if (ok) settingSet(TG_BK.DAILY_SETTING, isoDateIn(tz, new Date(now)), 'last daily booking reminder');
  if (messages) settingSet(TG_BK.DAILY_AT_SETTING, iso, 'when the last daily booking reminder went (A10: 12 h apart)');
  var text = '';
  if (!list.length) {
    var next = tgBkOpenList().map(function (x) { return { x: x, o: tgBkMs(x.b.rec.opens_at) }; }).filter(function (y) { return y.o > now; })
      .sort(function (a, c) { return a.o - c.o; })[0];
    text = '🎟 Nothing to book right now.' + (next ? ' Next to open: <b>' + tgEscape(next.x.b.rec.title) + '</b>, ' + tgBkBoth(next.o, next.x.trip, tz) + '.' : '');
  }
  return { sent: list.length && ok ? list.length : 0, messages: messages, text: text };
}
/** Records due an opening alert: todo, not yet alerted, not snoozed, opening no longer ago than ALERT_STALE_MIN. */
function tgBkAlertList(now) {
  return tgBkOpenList().filter(function (x) {
    var o = tgBkMs(x.b.rec.opens_at);
    return isFinite(o) && !x.b.alerted_at && !_tgBkSnoozed(x.b, now) && o > now - TG_BK.ALERT_STALE_MIN * 60000;
  });
}
function tgBkSendAlerts(now) {
  var slack = LIMITS.ALARM_EARLY_SEC * 1000, sent = 0, iso = new Date(now).toISOString();
  tgBkAlertList(now).forEach(function (x) {
    var o = tgBkMs(x.b.rec.opens_at);
    if (o - TG_BK.ALERT_LEAD_MIN * 60000 > now + slack) return;
    var mins = Math.round((o - now) / 60000);
    var head = mins > 0 ? '🔔 <b>Booking opens in about ' + mins + ' min</b>' : '🔔 <b>Booking is open now</b>';
    var card = tgBkCard(head, [x], now), r = tgSendOwner(card.html, { keyboard: card.keyboard });
    if (r && r.ok) { storeUpdate(TG_BK_SHEET, x.b._row, { alerted_at: iso }); sent++; }
  });
  return sent;
}
registerAlarm('tg_bookings', {
  next: function (now) {
    var list = tgBkOpenList();
    if (!list.length) return null;
    var best = tgBkDailyDue(now);
    tgBkAlertList(now).forEach(function (x) { best = Math.min(best, tgBkMs(x.b.rec.opens_at) - TG_BK.ALERT_LEAD_MIN * 60000); });
    return isFinite(best) ? best : null;
  },
  run: function (now) {
    tgBkSendAlerts(now);
    if (tgBkOpenList().length && tgBkDailyDue(now) <= now + LIMITS.ALARM_EARLY_SEC * 1000) tgBkSendDaily(now, {});
  }
});

/* ---------------- buttons ---------------- */
registerCallback('bk', function (ctx) {
  var key = String(ctx.parts[0] || ''), code = String(ctx.parts[1] || '');
  if (ctx.parts.length !== 2 || !/^[0-9a-f]{10}$/.test(key) || !TG_BK_CODES[code]) { ctx.answer('Unknown button'); return; }   // exact shape
  var b = tgBkByKey(key);
  if (!b) { ctx.answer('That booking is no longer on the list.'); return; }
  var now = nowMs(), patch = { updated_at: new Date(now).toISOString() };
  if (code === 't') {
    var tz = tgOwnerTz();
    patch.snooze_until = new Date(msAtLocal(tz, isoDateAdd(isoDateIn(tz, new Date(now)), 1), 0, 0)).toISOString();
  } else { patch.status = TG_BK_CODES[code]; patch.status_by = 'owner'; patch.snooze_until = ''; }
  storeUpdate(TG_BK_SHEET, b._row, patch);
  ctx.answer(code === 'b' ? '✅ Marked booked' : code === 'n' ? 'Marked not needed' : '💤 Again tomorrow');
  tgBkRedraw(ctx, key, now);
  _safe('alarm_arm', function () { return alarmArm(); });
});
/** Edit the tapped message in place: every record its keyboard named, re-read; the header is the message's first line. */
function tgBkRedraw(ctx, key, now) {
  var cq = ctx.callbackQuery || {}, msg = cq.message || {}, keys = [];
  var mk = msg.reply_markup && Array.isArray(msg.reply_markup.inline_keyboard) ? msg.reply_markup.inline_keyboard : [];
  mk.forEach(function (row) {
    (row || []).forEach(function (btn) {
      var m = /^bk:([0-9a-f]{10}):[bnt]$/.exec(String(btn && btn.callback_data || ''));
      if (m && keys.indexOf(m[1]) < 0) keys.push(m[1]);
    });
  });
  if (keys.indexOf(key) < 0) keys.push(key);
  var trips = {};
  tgTripList().forEach(function (t) { trips[t.slug] = t; });
  var all = tgBkAll(), entries = [];
  keys.forEach(function (k) {
    var b = all.filter(function (x) { return x.key === k; })[0];
    if (b) entries.push({ b: b, trip: trips[b.trip] || { slug: b.trip } });
  });
  if (!entries.length || !ctx.messageId) return null;
  var first = String(msg.text || '').split('\n')[0];
  var head = first && /^(⏰|🔔)/.test(first) ? '<b>' + tgEscape(first) + '</b>' : '🎟 <b>Bookings</b>';
  var card = tgBkCard(head, entries, now);
  return ctx.edit(card.html, card.keyboard);
}

// Developed by: LightAISolutions
