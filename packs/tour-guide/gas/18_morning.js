/**
 * Tour Guide pack — the morning message (WP-12b, TG-PHASE-12 §3, suggestion 9a): on each date of a trip with a stored
 * day, unasked, one Telegram message (split like the day card) carries the whole day, so it reads in airplane mode and
 * costs no Claude usage — it reads only what the core has stored, plus the day's weather (15_weather.js).
 *   When     alarm `tg_morning`: the owner's morning time (default 07:00, /morning at HH:MM), or 30 min before leave_by
 *            when that is earlier, never before 05:00, in the trip's zone; a run after 12:00 local is too late and skips
 *            the date. Once per date (Settings tg_morning_sent), marked only when every message went out.
 *   What     date, "Day n of m", towns · Leave by (or the day's own start, with its bag step) · weather + credit · 💴
 *            cash · bookings · stops (time, name, local name, address, last entry, check on the day, map) · 🚆 trains
 *            (stations, or "use the route link") · dinner (its note, its booking) · the day's end · sunset; a day without
 *            stops: date, start or Leave by and bag step, weather, bookings, trains, the day's end, its warnings, "Free
 *            day". Keyboard ⏰ running late 15 · 30 · 60 and 📍 re-plan from here on the last chunk.
 *   Pin      the first chunk, silently; the previous morning message is unpinned (Settings tg_morning_pin); a failed pin or
 *            unpin is audited and ignored.
 *   /morning [date | day N | tomorrow] sends now: today's is the real one (pinned, counts as sent); any other date is a
 *            rehearsal, headed so, never pinned or marked. /morning at HH:MM (05:00–11:59) · /morning off · /morning on.
 * Settings: tg_morning { at, on }. Defaults: helpers/decisions/WP-12b.md.
 */
var TG_MORNING = {
  SETTING: 'tg_morning',
  SENT: 'tg_morning_sent',
  PIN: 'tg_morning_pin',
  AT: '07:00',              // default morning time
  EARLIEST: 5 * 60,         // never before 05:00
  LEAD_MIN: 30,             // …or this long before leave_by when that is earlier
  CUTOFF_HOUR: 12,          // a date not sent by noon is skipped (no breakfast message at tea time)
  BACKSTOP_MIN: 15,         // a run that dies inside a slow weather call is retried this much later
  SENT_KEEP: 60
};

/* ---------------- settings: the time, on/off, what was sent ---------------- */
function _tgMorningMin(t) { return tgCmdDayClock(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null; }
/** { at: 'HH:MM', on: bool } — the owner's morning time (05:00–11:59) and whether the message goes out at all. */
function tgMorningCfg() {
  var v = tgShJson(settingGet(TG_MORNING.SETTING, ''), {}), m = isPlainObject(v) ? _tgMorningMin(v.at) : null;
  return { at: m !== null && m >= TG_MORNING.EARLIEST && m < TG_MORNING.CUTOFF_HOUR * 60 ? v.at : TG_MORNING.AT, on: !(isPlainObject(v) && v.on === false) };
}
function tgMorningCfgSet(patch) {
  var c = tgMorningCfg();
  Object.keys(patch || {}).forEach(function (k) { c[k] = patch[k]; });
  settingSet(TG_MORNING.SETTING, toJson({ at: c.at, on: !!c.on }), 'the morning message: time and on/off (/morning)');
  return c;
}
function _tgMorningSentAll() { var v = tgShJson(settingGet(TG_MORNING.SENT, ''), {}); return isPlainObject(v) ? v : {}; }
function tgMorningSent(slug, date) { return !!_tgMorningSentAll()[slug + '|' + date]; }
/** Mark a date sent (only when every message went out); the newest SENT_KEEP marks are kept. */
function tgMorningMark(slug, date) {
  var all = _tgMorningSentAll();
  all[slug + '|' + date] = nowIso();
  var keys = Object.keys(all).sort(function (a, b) { return all[a] < all[b] ? 1 : -1; }), out = {};
  keys.slice(0, TG_MORNING.SENT_KEEP).forEach(function (k) { out[k] = all[k]; });
  settingSet(TG_MORNING.SENT, toJson(out), 'morning messages sent (trip|date)');
}
/** The trip-local minute of the day the message is due: the morning time, or LEAD_MIN before leave_by when earlier, never before 05:00. */
function tgMorningDueMin(day, cfg) {
  var at = _tgMorningMin(cfg.at), lb = _tgMorningMin(day && day.leave_by);
  if (lb !== null) at = Math.min(at, lb - TG_MORNING.LEAD_MIN);
  return Math.max(TG_MORNING.EARLIEST, at);
}
/**
 * The morning messages still to send: [{ trip, date, due (ms), cutoff (ms) }] — for every trip not done, the trip's
 * today and tomorrow when a day is stored for that date, not yet sent and not past CUTOFF_HOUR there.
 */
function tgMorningPending(now) {
  var cfg = tgMorningCfg(), out = [];
  if (!cfg.on) return out;
  tgTripList().forEach(function (trip) {
    if (!trip || trip.status === 'done') return;
    var tz = tgTripTz(trip), today = isoDateIn(tz, new Date(now));
    [today, isoDateAdd(today, 1)].forEach(function (date) {
      var day = tgDigestDay(trip.slug, date);
      if (!day || day.date !== date || tgMorningSent(trip.slug, date)) return;
      var cutoff = msAtLocal(tz, date, TG_MORNING.CUTOFF_HOUR, 0);
      if (now >= cutoff) return;
      var m = tgMorningDueMin(day, cfg);
      out.push({ trip: trip, date: date, due: msAtLocal(tz, date, Math.floor(m / 60), m % 60), cutoff: cutoff });
    });
  });
  return out.sort(function (a, b) { return a.due - b.due; });
}

/* ---------------- the message ---------------- */
function _tgMorningStr(v) { return typeof v === 'string' && v.trim() ? v : ''; }
/** Where a leg goes, in words (a stop's or dinner's name, your lodging, the day's end, where you are). */
function tgMorningDest(day, slug) {
  var st = (day.stops || []).filter(function (s) { return s && s.slug === slug; })[0];
  if (st) return tgEscape(st.name);
  if (tgCmdDayAnchorOk(day.dinner) && day.dinner.slug === slug) return tgEscape(day.dinner.name);
  if (slug === 'lodging') return 'your lodging';
  if (slug === 'day-end') return tgCmdDayAnchorOk(day.end) ? tgEscape(day.end.name) : "the day's end";
  if (slug === 'here') return 'where you are';
  return tgEscape(slug);
}
/** A place's second line: "   📍 address · 🗺 map" (either part only when it is there); '' when neither. */
function tgMorningWhere(p) {
  var bits = [];
  if (_tgMorningStr(p.address)) bits.push('📍 ' + tgEscape(p.address));
  var map = tgCmdHref(p.maps_url, '🗺 map');
  if (map.indexOf('<a ') === 0) bits.push(map);
  return bits.length ? '   ' + bits.join(' · ') : '';
}
/** ⏰ running late 15 · 30 · 60 and 📍 re-plan from here (rl / rp, as the running-late reply uses them). */
function tgMorningKeyboard(trip, date) {
  var tk = tgCmdTripKey(trip.slug), d8 = tgLateD8(date);
  return tgKeyboard([
    TG_LATE.BUTTONS.map(function (m, i) { return { text: (i ? '' : '⏰ Late ') + m + ' min', data: cbEncode('rl', tk, d8, m) }; }),
    [{ text: '📍 Re-plan from here', data: cbEncode('rp', tk, d8) }]
  ]);
}
/**
 * A place's 💴 parts: its payment, then its price line without the parts that only repeat the payment (WP-12r, found by
 * the rehearsal: the facts' price_line already ends with the payment words, so "Cash only · Cash only" was shown).
 */
function tgMorningPaying(p) {
  var pay = _tgMorningStr(p.payment) ? String(p.payment).trim() : '', key = pay.toLowerCase();
  var price = _tgMorningStr(p.price_line) ? String(p.price_line).split(' · ').filter(function (x) { return x.trim() && x.trim().toLowerCase() !== key; }) : [];
  return (pay ? [pay] : []).concat(price.length ? [price.join(' · ')] : []);
}
/** The 🚆 Trains lines of a day: a transit leg's stations, else its route link (no station is ever inferred). */
function tgMorningTrainLines(day) {
  var trains = (Array.isArray(day.legs) ? day.legs : []).filter(function (l) { return l && l.mode === 'TRANSIT'; }), out = [];
  if (!trains.length) return out;
  out.push('🚆 <b>Trains</b>');
  trains.forEach(function (l) {
    var st = tgCmdStationsText(l.stations), to = tgMorningDest(day, l.to);
    out.push(st ? '• ' + st + ' — for ' + to : '• To ' + to + ': use the ' + tgCmdHref(l.maps_url, 'route link'));
  });
  return out;
}
/**
 * The whole day as [{ html, keyboard? }], split like the day card, the keyboard on the last chunk. wx: tgWxDay's answer.
 * Order (TG-PHASE-12 §3): date · Day n of m · towns; leave by; weather + credit; 💴; bookings; stops; 🚆 trains; dinner;
 * the day's end; sunset. A free day: date, weather, bookings, "Free day" and no buttons.
 * Phase 13 (the coordinator's probe, decisions/TG-PHASE-13.md): a day with a start of its own (a moving day's station)
 * shows the day card's start line with its bag step instead of "Leave by" — its first leg leaves from that start, so
 * "Leave by" only repeated the start time as if it were the time to leave the lodging; a day without one keeps "Leave
 * by", then its bag step. The dinner shows its note (the menu caveat) as the card does. A day without stops that still
 * goes somewhere (a departure) keeps its trains, its end and its warnings — an overrun alert is only raised on such a
 * day — before "Free day"; a rest day is as it was.
 */
function tgMorningMessages(trip, day, total, wx, rehearsal) {
  var lines = [], stops = Array.isArray(day.stops) ? day.stops.filter(function (s) { return s && s.name; }) : [];
  var dn = tgCmdDayAnchorOk(day.dinner) ? day.dinner : null;
  if (rehearsal) lines.push('🎭 <b>Rehearsal</b> — the morning message of ' + tgCmdDate(day.date) + '; not pinned, not counted as sent');
  var areas = (Array.isArray(day.areas) ? day.areas : []).filter(_tgMorningStr).map(tgEscape);
  lines.push('☀️ <b>' + tgCmdDate(day.date) + ' · Day ' + tgEscape(day.n) + (total ? ' of ' + total : '') + '</b>' + (areas.length ? ' · ' + areas.join(' → ') : ''));
  if (_tgMorningStr(day.theme)) lines.push('<i>' + tgEscape(day.theme) + '</i>');
  var staleLg = typeof tgLgStaleLine === 'function' ? tgLgStaleLine(trip) : '';   // C13
  if (staleLg) lines.push(staleLg);
  if (day.late) lines.push('⏰ <i>Running ' + tgEscape(day.late.minutes) + ' min late since ' + tgEscape(day.late.from) + '</i>');
  var startLine = tgCmdDayStartLine(day);
  if (tgCmdDayAnchorOk(day.start)) lines.push(startLine);
  else {
    if (tgCmdDayClock(day.leave_by)) lines.push('🚪 <b>Leave by ' + tgEscape(day.leave_by) + '</b>');
    if (startLine) lines.push(startLine);   // 🧳 the bag step
  }
  (wx && wx.lines || []).forEach(function (l) { lines.push(l); });
  if (wx && wx.credit) lines.push(tgWxCredit());
  if (!stops.length) {
    (typeof tgBkDayLines === 'function' ? tgBkDayLines(trip, day) : []).forEach(function (b) { lines.push(b); });
    tgMorningTrainLines(day).forEach(function (l) { lines.push(l); });
    var freeEnd = tgCmdDayEndLine(day);
    if (freeEnd) lines.push(freeEnd);
    (Array.isArray(day.warnings) ? day.warnings : []).filter(_tgMorningStr).forEach(function (w) { lines.push('⚠️ ' + tgEscape(w)); });
    lines.push('<b>Free day.</b>');
    return tgCmdMessages(lines, null);
  }
  var money = stops.concat(dn ? [dn] : []).filter(function (p) { return _tgMorningStr(p.payment) || _tgMorningStr(p.price_line); });
  if (money.length) {
    lines.push('💴 <b>Paying</b>');
    money.forEach(function (p) {
      lines.push('• ' + tgEscape(p.name) + ': ' + tgMorningPaying(p).map(tgEscape).join(' · '));
    });
  }
  (typeof tgBkDayLines === 'function' ? tgBkDayLines(trip, day) : []).forEach(function (b) { lines.push(b); });
  lines.push('<b>Today</b>');
  stops.forEach(function (s) {
    var time = tgCmdDayTime(s);
    lines.push('<b>' + tgEscape(s.n) + '.</b> ' + (time ? time + ' ' : '') + '<b>' + tgEscape(s.name) + '</b>' +
      (_tgMorningStr(s.local_name) ? ' · ' + tgEscape(s.local_name) : '') + (tgCmdDayClock(s.last_entry) ? ' · last entry ' + tgEscape(s.last_entry) : ''));
    var where = tgMorningWhere(s);
    if (where) lines.push(where);
    if (_tgMorningStr(s.check_on_day)) lines.push('   🕑 <i>' + tgEscape(s.check_on_day) + '</i>');
    if (s.late_check) lines.push('   🕑 <i>moved — check the hours</i>');
  });
  (day.late ? day.late.dropped : []).forEach(function (x) { lines.push('✖️ <i>' + tgEscape(x.name) + ' dropped — ' + tgEscape(x.reason) + '</i>'); });
  tgMorningTrainLines(day).forEach(function (l) { lines.push(l); });
  if (dn) {
    lines.push('🍽 ' + (tgCmdDayClock(dn.start) ? tgEscape(dn.start) + ' ' : '') + 'Dinner at <b>' + tgEscape(dn.name) + '</b>' +
      (_tgMorningStr(dn.local_name) ? ' · ' + tgEscape(dn.local_name) : '') + (dn.late_fixed ? ' · booked, stays' : ''));
    var dw = tgMorningWhere(dn);
    if (dw) lines.push(dw);
    if (_tgMorningStr(dn.note_line)) lines.push('   <i>' + tgEscape(dn.note_line) + '</i>');
    if (_tgMorningStr(dn.booking_line)) lines.push('   🎟 <i>' + tgEscape(dn.booking_line) + '</i>');
  }
  var endLine = tgCmdDayEndLine(day);
  if (endLine) lines.push(endLine);
  if (tgCmdDayClock(day.sunset)) lines.push('🌅 Sunset ' + tgEscape(day.sunset));
  return tgCmdMessages(lines, tgMorningKeyboard(trip, day.date));
}

/* ---------------- sending, pinning ---------------- */
function _tgMorningPinGet() { var v = tgShJson(settingGet(TG_MORNING.PIN, ''), {}); return isPlainObject(v) && v.id ? v : null; }
/** Unpin the previous morning message, pin this one silently; a failure is audited and changes nothing else. */
function tgMorningPin(chat, messageId) {
  var prev = _tgMorningPinGet();
  if (prev && !(String(prev.chat) === String(chat) && prev.id === messageId)) {
    var u = tgApi('unpinChatMessage', { chat_id: prev.chat, message_id: prev.id });
    if (!u || !u.ok) audit('tg_morning_unpin_fail', String(prev.id), { description: truncate(String(u && u.description || ''), 200) });
  }
  var p = tgApi('pinChatMessage', { chat_id: chat, message_id: messageId, disable_notification: true });
  if (!p || !p.ok) {
    audit('tg_morning_pin_fail', String(messageId), { description: truncate(String(p && p.description || ''), 200) });
    settingSet(TG_MORNING.PIN, '', 'the pinned morning message');
    return false;
  }
  settingSet(TG_MORNING.PIN, toJson({ chat: String(chat), id: messageId }), 'the pinned morning message');
  return true;
}
/**
 * Send the morning message of one date → { ok, messages, pinned, rehearsal } (null when the date has no stored day).
 * The real one (not opts.rehearsal) pins its first chunk and is marked sent when every message went out; a rehearsal is
 * headed so and neither pinned nor marked.
 */
function tgMorningSend(trip, date, opts) {
  opts = opts || {};
  var day = tgDigestDay(trip.slug, date);
  if (!day || day.date !== date) return null;
  var chat = opts.chatId || tgOwnerChatId();
  if (!chat) { auditFail('tg_morning_no_owner', trip.slug, date); return { ok: false, messages: 0, pinned: false, rehearsal: !!opts.rehearsal }; }
  var rehearsal = !!opts.rehearsal, wx = tgWxDay(trip, day);
  var msgs = tgMorningMessages(trip, tgLateView(trip, day), tgDigestDays(trip.slug).length, wx, rehearsal);
  var ok = true, sent = 0, first = null;
  msgs.forEach(function (m) {
    var r = tgSend(chat, m.html, m.keyboard ? { keyboard: m.keyboard } : undefined);
    if (r && r.ok) { sent++; if (first === null && r.result && r.result.message_id) first = r.result.message_id; } else ok = false;
  });
  var pinned = false;
  if (!rehearsal && first !== null) pinned = _safe('tg_morning_pin', function () { return tgMorningPin(chat, first); }) === true;
  if (!rehearsal && ok && sent) tgMorningMark(trip.slug, date);
  audit('tg_morning', trip.slug, { date: date, rehearsal: rehearsal, ok: ok, messages: sent, pinned: pinned, weather: wx.lines.length, calls: wx.calls });
  return { ok: ok && sent > 0, messages: sent, pinned: pinned, rehearsal: rehearsal };
}

registerAlarm('tg_morning', {
  next: function (now) { var p = tgMorningPending(now); return p.length ? p[0].due : null; },
  run: function (now) {
    var due = tgMorningPending(now).filter(function (x) { return x.due <= now + LIMITS.ALARM_EARLY_SEC * 1000; });
    if (!due.length) return;
    // The one alarm trigger was deleted as this run started: a run killed inside a slow weather call would leave none.
    _safe('tg_morning_backstop', function () { alarmArm({ now: now, floorMs: now + TG_MORNING.BACKSTOP_MIN * 60000 }); });
    due.forEach(function (x) { _safe('tg_morning_send', function () { tgMorningSend(x.trip, x.date, {}); }); });
  }
});

registerCommand('/morning', function (ctx) {
  var a = String(ctx.args || '').replace(/\s+/g, ' ').trim().toLowerCase(), cfg = tgMorningCfg();
  var when = function (c) { return 'at ' + c.at + ' (or 30 min before “leave by” when earlier, never before 05:00)'; };
  if (a === 'off') { tgMorningCfgSet({ on: false }); ctx.reply('🔕 No morning message from now on. <code>/morning on</code> brings it back.'); return; }
  if (a === 'on') { var c1 = tgMorningCfgSet({ on: true }); _safe('tg_morning_arm', function () { alarmArm(); }); ctx.reply('☀️ The morning message comes each trip day ' + when(c1) + '.'); return; }
  var at = /^at (\d{1,2}):(\d{2})$/.exec(a);
  if (at) {
    var t = ('0' + at[1]).slice(-2) + ':' + at[2], m = _tgMorningMin(t);
    if (m === null || m < TG_MORNING.EARLIEST || m >= TG_MORNING.CUTOFF_HOUR * 60) { ctx.reply('Between 05:00 and 11:59, please.'); return; }
    var c2 = tgMorningCfgSet({ at: t });
    _safe('tg_morning_arm', function () { alarmArm(); });
    ctx.reply('☀️ Saved: the morning message comes ' + when(c2) + (c2.on ? '.' : ' — it is off now; <code>/morning on</code> turns it on.'));
    return;
  }
  var trip = tgCmdCurrent(ctx);
  if (!trip) return;
  if (a && !/^(day ?\d{1,2}|\d{1,2}|\d{4}-\d{2}-\d{2}|today|tomorrow)$/.test(a)) {
    ctx.reply('Usage: <code>/morning</code> sends today\'s now · <code>/morning day 2</code> rehearses another day · <code>/morning at 07:30</code> · ' +
      '<code>/morning off</code> / <code>on</code>. Now: ' + (cfg.on ? when(cfg) : 'off') + '.');
    return;
  }
  var today = tgTripToday(trip), date = a ? tgCmdPlanDate(trip, a) : (tgDigestDay(trip.slug, today) ? today : null);
  if (!date) { ctx.reply(a ? 'That day is not in the plan of ' + tgCmdTitle(trip) + '. /trip shows its days.' : 'No plan for today in ' + tgCmdTitle(trip) + '. To rehearse a day: <code>/morning day 2</code>.'); return; }
  var r = tgMorningSend(trip, date, { chatId: ctx.chatId, rehearsal: date !== today });
  if (r && !r.ok) ctx.reply('Part of the morning message did not go out — try <code>/morning</code> again.');
}, 'the morning message: /morning sends today\'s now · /morning day N rehearses · /morning at HH:MM · /morning off|on');

// Developed by: LightAISolutions
