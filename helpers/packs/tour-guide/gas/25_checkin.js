/**
 * Tour Guide pack — the evening check-in (WP-12b, TG-PHASE-12 §6, suggestion 10): on each trip date with stops, one
 * message lists the day's stops (the running-late overlay applied, dropped stops left out), numbered, one keyboard row
 * per stop: its number, 👍 👎 ⏭, then ⏩ needed longer, 👌 about right, ⏪ less was fine (the review's codes), and
 * ✅ Done. A day's taps take under a minute.
 *   When     alarm `tg_checkin`: 21:00 in the trip's zone, or 15 min after the day's planned end (overlay included)
 *            when that is later, never after 22:30; once per date (Settings tg_checkin_sent); a run after 23:30 local
 *            skips the date. /checkin [date] sends it now: today's is the real one (counts as sent), any other date a
 *            rehearsal whose taps are not saved.
 *   Taps     ci:<trip key>:<yyyymmdd>[r]:<stop index>.<tag4>:<u|d|s|l|r|h|i> (r after the date = rehearsal; i = the
 *            number button, answers with the stop's name) and ci:<trip key>:<yyyymmdd>[r]:<chunk>:ok (✅ Done).
 *            A tap edits the keyboard in place (editMessageReplyMarkup) and ticks the chosen buttons "✓". Real taps are
 *            Choices run `checkin`, kind review, key "<date>|<slug>", value = rating, text = calibration: one row per
 *            stop, so at most two taps per stop and the latest of each wins. A rehearsal's ticks live only in the
 *            message's own keyboard. Done edits the message into a summary.
 *   Never    a request, the trip's status, or anything Claude reads: /review (13_flow_review.js) reads these taps.
 * Defaults: helpers/decisions/WP-12b.md.
 */
var TG_CHECKIN = {
  SENT: 'tg_checkin_sent',
  RUN: 'checkin',            // Choices run of the check-in taps (kind review)
  AT: 21 * 60,               // 21:00
  AFTER_END_MIN: 15,         // …or this long after the day's planned end when later
  LATEST: 22 * 60 + 30,      // never after 22:30
  CUTOFF: 23 * 60 + 30,      // a run this late skips the date
  PER_MESSAGE: 12,           // stops per message (7 buttons a row; Telegram allows 100 buttons a message)
  STOPS_MAX: 40,             // stops listed per day (the review's cap)
  NAME_MAX: 80,
  SENT_KEEP: 60,
  TICK: '✓'
};
var TG_CHECKIN_LABEL = { u: '👍', d: '👎', s: '⏭', l: '⏩', r: '👌', h: '⏪' };

/* ---------------- what was sent ---------------- */
function _tgCiMin(t) { return tgCmdDayClock(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null; }
function _tgCiSentAll() { var v = tgShJson(settingGet(TG_CHECKIN.SENT, ''), {}); return isPlainObject(v) ? v : {}; }
function tgCheckinSent(slug, date) { return !!_tgCiSentAll()[slug + '|' + date]; }
function tgCheckinMark(slug, date) {
  var all = _tgCiSentAll();
  all[slug + '|' + date] = nowIso();
  var keys = Object.keys(all).sort(function (a, b) { return all[a] < all[b] ? 1 : -1; }), out = {};
  keys.slice(0, TG_CHECKIN.SENT_KEEP).forEach(function (k) { out[k] = all[k]; });
  settingSet(TG_CHECKIN.SENT, toJson(out), 'evening check-ins sent (trip|date)');
}

/* ---------------- when ---------------- */
/** The day's planned end, minute of the day: the latest stop departure, dinner end (or start + 60) and end anchor; or null. */
function tgCheckinEndMin(view) {
  var e = null, up = function (m) { if (m !== null && (e === null || m > e)) e = m; };
  (view && Array.isArray(view.stops) ? view.stops : []).forEach(function (s) { if (s) { up(_tgCiMin(s.arrive)); up(_tgCiMin(s.depart)); } });
  var dn = view && view.dinner;
  if (tgCmdDayAnchorOk(dn)) {
    var a = _tgCiMin(dn.start), b = _tgCiMin(dn.end);
    if (a !== null) up(b !== null && b > a ? b : a + TG_LATE.DINNER_MIN);
  }
  if (view && tgCmdDayAnchorOk(view.end)) up(_tgCiMin(view.end.time));
  return e;
}
/** 21:00, or AFTER_END_MIN after the planned end when later, never after 22:30 (minute of the day, trip-local). */
function tgCheckinDueMin(view) {
  var e = tgCheckinEndMin(view);
  return Math.min(TG_CHECKIN.LATEST, Math.max(TG_CHECKIN.AT, e === null ? 0 : e + TG_CHECKIN.AFTER_END_MIN));
}
/** The check-ins still to send: [{ trip, date, due, cutoff }] over each trip's today and tomorrow (its zone), sorted by due. */
function tgCheckinPending(now) {
  var out = [];
  tgTripList().forEach(function (trip) {
    if (!trip || trip.status === 'done') return;
    var tz = tgTripTz(trip), today = isoDateIn(tz, new Date(now));
    [today, isoDateAdd(today, 1)].forEach(function (date) {
      var day = tgDigestDay(trip.slug, date);
      if (!day || day.date !== date || !Array.isArray(day.stops) || !day.stops.length || tgCheckinSent(trip.slug, date)) return;
      var cutoff = msAtLocal(tz, date, Math.floor(TG_CHECKIN.CUTOFF / 60), TG_CHECKIN.CUTOFF % 60);
      if (now >= cutoff) return;
      var m = tgCheckinDueMin(tgLateView(trip, day));
      out.push({ trip: trip, date: date, due: msAtLocal(tz, date, Math.floor(m / 60), m % 60), cutoff: cutoff });
    });
  });
  return out.sort(function (a, b) { return a.due - b.due; });
}

/* ---------------- the stops and their taps ---------------- */
/**
 * { day, view, list: [{ k, i, slug, tag, name, local }] } — the stops shown (overlay applied, dropped ones left out), k the
 * number shown, i the stop's index in the stored day (what the buttons carry, so running late cannot shift them); null
 * when no day is stored for the date.
 */
function tgCheckinList(trip, date) {
  var day = tgDigestDay(trip.slug, date);
  if (!day || day.date !== date) return null;
  var view = tgLateView(trip, day), stored = Array.isArray(day.stops) ? day.stops : [], used = {}, list = [];
  (Array.isArray(view.stops) ? view.stops : []).forEach(function (s) {
    if (!s || typeof s.slug !== 'string' || !s.slug || list.length >= TG_CHECKIN.STOPS_MAX) return;
    var i = -1;
    for (var k = 0; k < stored.length && k < 100; k++) if (stored[k] && stored[k].slug === s.slug && !used[k]) { i = k; break; }
    if (i < 0) return;
    used[i] = true;
    var local = typeof s.local_name === 'string' ? s.local_name : '';
    list.push({ k: list.length + 1, i: i, slug: s.slug, tag: tgCmdTag(s.slug), name: truncate(String(s.name || s.slug), TG_CHECKIN.NAME_MAX),
      local: local ? truncate(local, TG_CHECKIN.NAME_MAX) : '' });
  });
  return { day: day, view: view, list: list };
}
/** The saved taps of one date: { slug: { rating, calibration } } (Choices run checkin, keys "<date>|<slug>"). */
function tgCheckinTaps(slug, date) {
  var out = {};
  tgChoiceList(slug, TG_CHECKIN.RUN, 'review').forEach(function (c) {
    var cut = c.key.indexOf('|');
    if (cut < 0 || c.key.slice(0, cut) !== date) return;
    out[c.key.slice(cut + 1)] = { rating: c.value, calibration: c.text };
  });
  return out;
}
function _tgCiCodeOn(st, code) {
  st = st || {};
  return TG_RV_RATING[code] ? st.rating === TG_RV_RATING[code] : (TG_RV_CAL[code] ? st.calibration === TG_RV_CAL[code] : false);
}
/** "👍 · ⏩ needed longer", or "not rated". */
function tgCheckinShow(st) {
  st = st || {};
  var r = { up: '👍', down: '👎', skipped: '⏭ skipped' }[st.rating] || '';
  var c = { longer: '⏩ needed longer', right: '👌 about right', shorter: '⏪ less was fine' }[st.calibration] || '';
  return r || c ? [r, c].filter(Boolean).join(' · ') : '<i>not rated</i>';
}

/* ---------------- the message ---------------- */
/** The date part of the buttons: yyyymmdd, plus "r" on a rehearsal. */
function tgCheckinD8(date, rehearsal) { return tgLateD8(date) + (rehearsal ? 'r' : ''); }
/** One message's keyboard: a row per stop (number, 👍 👎 ⏭, ⏩ 👌 ⏪), then ✅ Done; stateOf(x) → { rating, calibration }. */
function tgCheckinKeyboard(tk, d8, chunk, j, stateOf) {
  var rows = chunk.map(function (x) {
    var st = stateOf(x), id = x.i + '.' + x.tag;
    var row = [{ text: String(x.k), data: cbEncode('ci', tk, d8, id, 'i') }];
    ['u', 'd', 's', 'l', 'r', 'h'].forEach(function (code) {
      row.push({ text: (_tgCiCodeOn(st, code) ? TG_CHECKIN.TICK : '') + TG_CHECKIN_LABEL[code], data: cbEncode('ci', tk, d8, id, code) });
    });
    return row;
  });
  rows.push([{ text: '✅ Done', data: cbEncode('ci', tk, d8, String(j), 'ok') }]);
  return tgKeyboard(rows);
}
/** The check-in: messages of PER_MESSAGE stops, each with its keyboard (ticks from stateOf). */
function tgCheckinMessages(trip, L, rehearsal, stateOf) {
  var tk = tgCmdTripKey(trip.slug), d8 = tgCheckinD8(L.day.date, rehearsal), out = [], list = L.list;
  for (var j = 0; j * TG_CHECKIN.PER_MESSAGE < list.length; j++) {
    var chunk = list.slice(j * TG_CHECKIN.PER_MESSAGE, (j + 1) * TG_CHECKIN.PER_MESSAGE), lines = [];
    if (j === 0) {
      if (rehearsal) lines.push('🎭 <b>Rehearsal</b> — taps are not saved');
      lines.push('🌙 <b>How was today?</b> · ' + tgCmdDate(L.day.date) + (L.view.late ? ' · <i>with running late</i>' : ''));
      lines.push('<i>👍 worth it · 👎 not really · ⏭ skipped · ⏩ needed longer · 👌 about right · ⏪ less was fine — then ✅ Done.</i>');
    } else lines.push('🌙 <i>' + tgCmdDate(L.day.date) + ', continued</i>');
    chunk.forEach(function (x) { lines.push('<b>' + x.k + '.</b> ' + tgEscape(x.name) + (x.local ? ' · ' + tgEscape(x.local) : '')); });
    out.push({ html: lines.join('\n'), keyboard: tgCheckinKeyboard(tk, d8, chunk, j, stateOf) });
  }
  return out;
}
/**
 * Send the check-in of one date → { ok, messages, rehearsal } (null when no day with stops is stored for it). The real
 * one shows the saved taps and is marked sent when every message went out; a rehearsal starts blank and is not marked.
 */
function tgCheckinSend(trip, date, opts) {
  opts = opts || {};
  var L = tgCheckinList(trip, date);
  if (!L || !L.list.length) return null;
  var chat = opts.chatId || tgOwnerChatId(), rehearsal = !!opts.rehearsal;
  if (!chat) { auditFail('tg_checkin_no_owner', trip.slug, date); return { ok: false, messages: 0, rehearsal: rehearsal }; }
  var taps = rehearsal ? {} : tgCheckinTaps(trip.slug, date), ok = true, sent = 0;
  tgCheckinMessages(trip, L, rehearsal, function (x) { return taps[x.slug]; }).forEach(function (m) {
    var r = tgSend(chat, m.html, { keyboard: m.keyboard });
    if (r && r.ok) sent++; else ok = false;
  });
  if (!rehearsal && ok && sent) tgCheckinMark(trip.slug, date);
  audit('tg_checkin', trip.slug, { date: date, rehearsal: rehearsal, ok: ok, messages: sent, stops: L.list.length });
  return { ok: ok && sent > 0, messages: sent, rehearsal: rehearsal };
}

registerAlarm('tg_checkin', {
  next: function (now) { var p = tgCheckinPending(now); return p.length ? p[0].due : null; },
  run: function (now) {
    tgCheckinPending(now).filter(function (x) { return x.due <= now + LIMITS.ALARM_EARLY_SEC * 1000; })
      .forEach(function (x) { _safe('tg_checkin_send', function () { tgCheckinSend(x.trip, x.date, {}); }); });
  }
});

registerCommand('/checkin', function (ctx) {
  var a = String(ctx.args || '').replace(/\s+/g, ' ').trim().toLowerCase();
  var trip = tgCmdCurrent(ctx);
  if (!trip) return;
  if (a && !/^(day ?\d{1,2}|\d{1,2}|\d{4}-\d{2}-\d{2}|today|tomorrow)$/.test(a)) {
    ctx.reply('Usage: <code>/checkin</code> rates today\'s stops now · <code>/checkin day 2</code> rehearses another day (taps not saved).');
    return;
  }
  var today = tgTripToday(trip), date = a ? tgCmdPlanDate(trip, a) : today;
  var L = date ? tgCheckinList(trip, date) : null;
  if (!L || !L.list.length) {
    ctx.reply(a ? 'That day has no stops in the plan of ' + tgCmdTitle(trip) + '. /trip shows its days.' : 'No stops planned today in ' + tgCmdTitle(trip) + '. To rehearse a day: <code>/checkin day 2</code>.');
    return;
  }
  var r = tgCheckinSend(trip, date, { chatId: ctx.chatId, rehearsal: date !== today });
  if (r && !r.ok) ctx.reply('Part of the check-in did not go out — try <code>/checkin</code> again.');
}, 'the evening check-in: /checkin rates today\'s stops now · /checkin day N rehearses another day');

/* ---------------- taps ---------------- */
/** The ci buttons of the tapped message for this trip key and date part: [{ row, col, id: 'i.tag', code, data }]. */
function _tgCiButtons(ctx, tk, d8) {
  var cq = ctx.callbackQuery || {}, mk = cq.message && cq.message.reply_markup, out = [];
  if (!mk || !Array.isArray(mk.inline_keyboard)) return null;
  mk.inline_keyboard.forEach(function (row, r) {
    (Array.isArray(row) ? row : []).forEach(function (b, c) {
      var q = cbDecode(b && b.callback_data);
      if (q.prefix !== 'ci' || q.parts.length !== 4 || q.parts[0] !== tk || q.parts[1] !== d8) return;
      if (!/^\d{1,2}\.[0-9a-f]{4}$/.test(q.parts[2]) || !/^[udslrhi]$/.test(q.parts[3])) return;
      out.push({ row: r, col: c, id: q.parts[2], code: q.parts[3], on: String(b.text || '').indexOf(TG_CHECKIN.TICK) === 0 });
    });
  });
  return out;
}
/** A rehearsal's ticks, read back from the message's own keyboard: { 'i.tag': { rating, calibration } }. */
function _tgCiMarkupState(buttons) {
  var st = {};
  (buttons || []).forEach(function (b) {
    if (!b.on) return;
    var s = st[b.id] || (st[b.id] = { rating: '', calibration: '' });
    if (TG_RV_RATING[b.code]) s.rating = TG_RV_RATING[b.code]; else if (TG_RV_CAL[b.code]) s.calibration = TG_RV_CAL[b.code];
  });
  return st;
}
/** Re-tick the tapped message's keyboard in place: only this check-in's rating buttons change; stateOf(id) → { rating, calibration }. */
function tgCheckinRetick(ctx, tk, d8, stateOf) {
  var cq = ctx.callbackQuery || {}, mk = cq.message && cq.message.reply_markup;
  if (!ctx.messageId || !mk || !Array.isArray(mk.inline_keyboard)) return null;
  var mine = {};
  (_tgCiButtons(ctx, tk, d8) || []).forEach(function (b) { mine[b.row + ',' + b.col] = b; });
  var rows = mk.inline_keyboard.map(function (row, r) {
    return (Array.isArray(row) ? row : []).map(function (b, c) {
      var m = mine[r + ',' + c];
      if (!m || m.code === 'i') return { text: String(b.text || ''), callback_data: String(b.callback_data || '') };
      return { text: (_tgCiCodeOn(stateOf(m.id), m.code) ? TG_CHECKIN.TICK : '') + TG_CHECKIN_LABEL[m.code], callback_data: String(b.callback_data) };
    });
  });
  return tgApi('editMessageReplyMarkup', { chat_id: ctx.chatId, message_id: ctx.messageId, reply_markup: { inline_keyboard: rows } });
}
/** The new { rating, calibration } of a stop after a tap, or { error } (a time on a skipped stop). */
function tgCheckinApply(cur, code) {
  cur = cur || {};
  var rating = cur.rating || '', cal = cur.calibration || '';
  if (TG_RV_RATING[code]) { rating = TG_RV_RATING[code]; if (rating === 'skipped') cal = ''; }
  else if (TG_RV_CAL[code]) {
    if (rating === 'skipped') return { error: 'Marked skipped — tap 👍 or 👎 first.' };
    cal = TG_RV_CAL[code];
  }
  return { rating: rating, calibration: cal };
}
/** ✅ Done: the message becomes a summary of its stops (from its own keyboard; chunk j of today's list when absent). */
function tgCheckinDone(ctx, trip, date, rehearsal, j) {
  var tk = tgCmdTripKey(trip.slug), d8 = tgCheckinD8(date, rehearsal), L = tgCheckinList(trip, date);
  if (!L) { ctx.answer('That day is no longer in the plan.'); return; }
  var buttons = _tgCiButtons(ctx, tk, d8), rows = [];
  if (buttons && buttons.length) {
    var seen = {};
    buttons.forEach(function (b) {
      if (seen[b.id]) return;
      seen[b.id] = true;
      var i = Number(b.id.split('.')[0]), x = L.list.filter(function (y) { return y.i === i && y.tag === b.id.split('.')[1]; })[0];
      var s = L.day.stops[i];
      if (x) rows.push(x);
      else if (s && tgCmdTag(s.slug) === b.id.split('.')[1]) rows.push({ k: '·', i: i, slug: s.slug, tag: b.id.split('.')[1], name: truncate(String(s.name || s.slug), TG_CHECKIN.NAME_MAX) });
    });
  } else rows = L.list.slice(j * TG_CHECKIN.PER_MESSAGE, (j + 1) * TG_CHECKIN.PER_MESSAGE);
  var saved = rehearsal ? {} : tgCheckinTaps(trip.slug, date), marks = rehearsal ? _tgCiMarkupState(buttons) : {};
  var stateOf = function (x) { return rehearsal ? marks[x.i + '.' + x.tag] : saved[x.slug]; };
  var lines = [rehearsal ? '🎭 <b>Rehearsal</b> — nothing was saved · ' + tgCmdDate(date) : '🌙 <b>Check-in saved</b> · ' + tgCmdDate(date)], rated = 0;
  rows.forEach(function (x) {
    var st = stateOf(x);
    if (st && st.rating) rated++;
    lines.push('<b>' + tgEscape(x.k) + '.</b> ' + tgEscape(x.name) + ' — ' + tgCheckinShow(st));
  });
  if (!rehearsal) lines.push('<i>/review after the trip starts from these; /checkin shows them again.</i>');
  ctx.answer(rehearsal ? 'Rehearsal — nothing saved' : 'Saved');
  ctx.edit(lines.join('\n'), null);
  audit('tg_checkin_done', trip.slug, { date: date, rehearsal: rehearsal, stops: rows.length, rated: rated });
}

/**
 * ci:<trip key>:<yyyymmdd>[r]:<i>.<tag4>:<u|d|s|l|r|h|i> and ci:<trip key>:<yyyymmdd>[r]:<chunk>:ok — exactly those
 * shapes; the stop must still be at index i of the stored day with that tag.
 */
registerCallback('ci', function (ctx) {
  var p = ctx.parts;
  if (p.length !== 4 || !/^\d{8}r?$/.test(String(p[1]))) { ctx.answer('Unknown button'); return; }
  var rehearsal = p[1].length === 9, date = tgLateDate8(p[1].slice(0, 8)), trip = tgCmdTripByKey(p[0]);
  if (!trip || !tgEnvRealDate(date)) { ctx.answer('That trip is gone.'); return; }
  if (p[3] === 'ok') {
    if (!/^\d{1,2}$/.test(String(p[2]))) { ctx.answer('Unknown button'); return; }
    tgCheckinDone(ctx, trip, date, rehearsal, Number(p[2]));
    return;
  }
  var m = /^(\d{1,2})\.([0-9a-f]{4})$/.exec(String(p[2]));
  if (!m || !/^[udslrhi]$/.test(String(p[3]))) { ctx.answer('Unknown button'); return; }
  var day = tgDigestDay(trip.slug, date), s = day && Array.isArray(day.stops) ? day.stops[Number(m[1])] : null;
  if (!s || typeof s.slug !== 'string' || tgCmdTag(s.slug) !== m[2]) { ctx.answer('This list changed — /checkin sends a fresh one.'); return; }
  var code = p[3], tk = p[0], d8 = p[1], id = m[1] + '.' + m[2];
  if (code === 'i') { ctx.answer(truncate(String(s.name || s.slug), 60)); return; }
  if (rehearsal) {
    var marks = _tgCiMarkupState(_tgCiButtons(ctx, tk, d8)), nx = tgCheckinApply(marks[id], code);
    if (nx.error) { ctx.answer(nx.error); return; }
    marks[id] = nx;
    ctx.answer('Rehearsal — not saved');
    tgCheckinRetick(ctx, tk, d8, function (k) { return marks[k]; });
    return;
  }
  var saved = tgCheckinTaps(trip.slug, date), next = tgCheckinApply(saved[s.slug], code);
  if (next.error) { ctx.answer(next.error); return; }
  tgChoiceSet(trip.slug, TG_CHECKIN.RUN, 'review', date + '|' + s.slug, next.rating, next.calibration);
  saved[s.slug] = next;
  ctx.answer(TG_CHECKIN_LABEL[code] + ' noted');
  tgCheckinRetick(ctx, tk, d8, function (k) {
    var st = day.stops[Number(k.split('.')[0])];
    return st && tgCmdTag(st.slug) === k.split('.')[1] ? saved[st.slug] : null;
  });
});

// Developed by: LightAISolutions
