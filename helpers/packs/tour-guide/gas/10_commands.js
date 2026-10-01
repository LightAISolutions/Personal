/**
 * Tour Guide pack — instant commands and the shared chat helpers (WP-5a; plan §5.9 command table, §5.10).
 * Lane A (answered from the pack tabs through WP-5b's storage API, no routine): /profile, /trip, /today, /day, /later,
 * /place, /places. Requests (Lane C, through tgOpenKindRequest with exactly the TG-PHASE-4B §5 fields): /replan, /notes,
 * /brochure (a resend when the PDF id is stored), /lodging (stored on the trip, sent with the next research round).
 * Renderer `core_start` (the interview offer after /start when no profile summary is cached).
 * Callbacks: `dy` (a day), `lt` (promote a Later item onto a day → replan), `ps` (a place: note · add · check),
 * `pl` (plan actions; other pack files add actions with tgCmdPlAction).
 * Every string from the brain or the owner is escaped (tgEscape / tgCmdHref); every message goes out through tgLines.
 */
var TG_CMD_TRIPKEY_MAX = 36;        // a trip slug longer than this travels in callback data as a hash key
var TG_CMD_URL_MAX = 400;           // longer Maps links are dropped from chat lines (the name stays)
var TG_CMD_PLACES_LAST = 'tg_places_last';   // Settings: JSON [slug…] of the last /places search (ps keys ".<i>")
var TG_CMD_LATER_REASONS = { owner_choice: 'saved by you', not_shown: 'gem not chosen', closed_business: 'closed since last visit' };
var TG_CMD_MODES = { WALK: 'walk', TRANSIT: 'transit', DRIVE: 'drive' };

/* ==================== shared helpers ==================== */

/** An escaped link: <a href="url">text</a> when url is a plain https URL of reasonable length, else the escaped text. */
function tgCmdHref(url, text) {
  var t = tgEscape(text), u = String(url || '');
  if (!/^https:\/\/\S+$/.test(u) || u.length > TG_CMD_URL_MAX) return t;
  return '<a href="' + tgEscape(u).replace(/"/g, '&quot;') + '">' + t + '</a>';
}
/** 45 → "45 min", 90 → "1 h 30", 120 → "2 h". */
function tgCmdMinutes(m) {
  m = parseInt(m, 10);
  if (!(m >= 0)) return '';
  if (m < 60) return m + ' min';
  return Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) : '');
}
/** 'YYYY-MM-DD' → "Wed 12 May" (calendar date, no time zone shift); anything else comes back escaped as is. */
function tgCmdDate(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return tgEscape(iso || '');
  return Utilities.formatDate(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)), 'UTC', 'EEE d MMM');
}
/** Whole days from a to b ('YYYY-MM-DD'). */
function tgCmdDaysBetween(a, b) {
  var pa = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(a || '')), pb = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(b || ''));
  if (!pa || !pb) return null;
  return Math.round((Date.UTC(+pb[1], +pb[2] - 1, +pb[3]) - Date.UTC(+pa[1], +pa[2] - 1, +pa[3])) / 86400000);
}
/** A trip slug as a callback part: the slug itself when short, else "t" + 11 hex of its hash. */
function tgCmdTripKey(slug) {
  slug = String(slug || '');
  return slug.length <= TG_CMD_TRIPKEY_MAX && /^[a-z0-9-]+$/.test(slug) ? slug : 't' + sha1Hex(slug).slice(0, 11);
}
function tgCmdTripByKey(key) {
  key = String(key || '');
  var t = /^[a-z0-9-]+$/.test(key) ? tgTripGet(key) : null;
  if (t) return t;
  var all = tgTripList();
  for (var i = 0; i < all.length; i++) if (tgCmdTripKey(all[i].slug) === key) return all[i];
  return null;
}
/** Four hex chars of a slug's hash: guards index-based buttons against a list that changed in between. */
function tgCmdTag(slug) { return sha1Hex(String(slug || '')).slice(0, 4); }
/** The trip a command works on: the current trip (tgTripCurrent); tells the owner when there is none. */
function tgCmdCurrent(ctx) {
  var t = tgTripCurrent();
  if (!t && ctx) ctx.reply('No trip yet — start one with <code>/plan &lt;destination&gt;</code>.');
  return t;
}
function tgCmdTitle(trip) { return tgEscape(trip.title || trip.destination || trip.slug); }
/** Send [{ html, keyboard? }] in order. */
function tgCmdSendAll(chatId, messages) {
  var last = null;
  (messages || []).forEach(function (m) { if (m && m.html) last = tgSend(chatId, m.html, m.keyboard ? { keyboard: m.keyboard } : undefined); });
  return last;
}
/** Lines (already escaped) → messages; the keyboard rides on the last one. */
function tgCmdMessages(lines, keyboard) {
  var msgs = tgLines(lines).map(function (h) { return { html: h }; });
  if (keyboard && msgs.length) msgs[msgs.length - 1].keyboard = keyboard;
  return msgs;
}
/** Rows of n buttons. */
function tgCmdRows(buttons, n) {
  var rows = [];
  for (var i = 0; i < buttons.length; i += n) rows.push(buttons.slice(i, i + n));
  return rows;
}
/**
 * Re-mark the tapped message's keyboard: every button whose callback_data starts with `prefix:` gets "• " in front when
 * chosen(parts) is true (parts = the data split on ':' without the prefix). Uses the keyboard Telegram sends back with
 * the callback; when it is absent the toast is the only feedback.
 */
function tgCmdRemark(ctx, prefix, chosen) {
  var cq = ctx.callbackQuery || {}, mk = cq.message && cq.message.reply_markup;
  if (!ctx.messageId || !mk || !Array.isArray(mk.inline_keyboard)) return null;
  var rows = mk.inline_keyboard.map(function (row) {
    return row.map(function (b) {
      var out = {}, k;
      for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) out[k] = b[k];
      var d = String(b.callback_data || '');
      if (d.indexOf(prefix + ':') !== 0) return out;
      var base = String(b.text || '').replace(/^• /, '');
      out.text = (chosen(d.split(':').slice(1)) ? '• ' : '') + base;
      return out;
    });
  });
  return tgApi('editMessageReplyMarkup', { chat_id: ctx.chatId, message_id: ctx.messageId, reply_markup: { inline_keyboard: rows } });
}
/** pl:<action>:… — other pack files add actions here (12_flow_plan.js, 13_flow_review.js). fn(ctx, args[]). */
var TG_CMD_PL = {};
function tgCmdPlAction(name, fn) {
  if (!/^[a-z]{1,4}$/.test(name)) throw new Error('tgCmdPlAction: name must be 1–4 lower-case letters');
  TG_CMD_PL[name] = fn;
}

/* ==================== core_start, /profile ==================== */

function tgCmdInterviewButton(label) { return tgKeyboard([[{ text: label || '🧭 Start the interview', data: cbEncode('pl', 'iv') }]]); }

/** After /start (and after pairing): offer the interview once there is no cached profile summary; otherwise nothing. */
registerRenderer('core_start', function () {
  if (tgProfileSummaryGet()) return '';
  var n = tgIvQids('').length;
  return {
    html: '🧭 To make plans fit you, start with a short interview — ' + n + ' quick questions, one at a time, skip any.',
    keyboard: tgCmdInterviewButton()
  };
});

registerCommand('/profile', function (ctx) {
  var p = tgProfileSummaryGet();
  if (!p) { ctx.reply('No profile yet — the interview builds it.', { keyboard: tgCmdInterviewButton() }); return; }
  var when = String(p.updated || p.received_at || '').slice(0, 10);
  var lines = ['<b>Your travel profile</b>' + (when ? ' <i>(' + tgEscape(when) + ')</i>' : '')];
  String(p.text).split('\n').forEach(function (l) { lines.push(tgEscape(l)); });
  lines.push('', 'Redo a section:');
  var buttons = tgIvSections().map(function (s) { return { text: truncate(s.title, 22), data: cbEncode('pl', 'ivs', s.id) }; });
  var rows = tgCmdRows(buttons, 2);
  rows.push([{ text: '🧭 Whole interview', data: cbEncode('pl', 'iv') }]);
  tgCmdSendAll(ctx.chatId, tgCmdMessages(lines, tgKeyboard(rows)));
}, 'your travel profile, with buttons to redo a section of the interview');

tgCmdPlAction('iv', function (ctx) { ctx.answer(''); tgIvStart(ctx.chatId, ''); });
tgCmdPlAction('ivs', function (ctx, args) {
  var s = tgIvSection(String(args[0] || ''));
  if (!s) { ctx.answer('That section is gone.'); return; }
  ctx.answer('');
  tgIvStart(ctx.chatId, s.id);
});

/* ==================== trips and days ==================== */

/** A stored day → [{ html, keyboard? }] with ◀ ▶ buttons (dy:<trip key>:<n>). */
function tgCmdDayMessages(trip, day, total) {
  var tk = tgCmdTripKey(trip.slug);
  var lines = ['<b>Day ' + day.n + (total ? ' of ' + total : '') + ' · ' + tgCmdDate(day.date) + '</b>' + (day.theme ? ' — ' + tgEscape(day.theme) : '')];
  var legs = Array.isArray(day.legs) ? day.legs : [];
  var legTo = function (slug) { return legs.filter(function (l) { return l && l.to === slug; })[0] || null; };
  var legLine = function (l, what) {
    var t = tgCmdMinutes(l.minutes) + ' ' + (TG_CMD_MODES[l.mode] || String(l.mode || '').toLowerCase());
    return '   <i>↳ ' + tgCmdHref(l.maps_url, t) + (what ? ' ' + what : '') + '</i>';
  };
  (day.stops || []).forEach(function (s) {
    var l = legTo(s.slug);
    if (l) lines.push(legLine(l, ''));
    var time = s.arrive ? tgEscape(s.arrive) + (s.depart ? '–' + tgEscape(s.depart) : '') + ' ' : '';
    lines.push('<b>' + tgEscape(s.n) + '.</b> ' + time + tgCmdHref(s.maps_url, s.name) + (s.minutes ? ' · ' + tgCmdMinutes(s.minutes) : ''));
    if (s.note_line) lines.push('   <i>' + tgEscape(s.note_line) + '</i>');
  });
  var home = legTo('lodging');
  if (home) lines.push(legLine(home, 'back to your lodging'));
  if (!(day.stops || []).length) lines.push('<i>A free day.</i>');
  (day.warnings || []).forEach(function (w) { lines.push('⚠️ ' + tgEscape(w)); });
  var nav = [];
  if (day.n > 1) nav.push({ text: '◀ Day ' + (day.n - 1), data: cbEncode('dy', tk, day.n - 1, 'e') });
  if (total && day.n < total) nav.push({ text: 'Day ' + (day.n + 1) + ' ▶', data: cbEncode('dy', tk, day.n + 1, 'e') });
  return tgCmdMessages(lines, nav.length ? tgKeyboard([nav]) : null);
}
function tgCmdSendDay(chatId, trip, key) {
  var days = tgDigestDays(trip.slug), day = tgDigestDay(trip.slug, key);
  if (!day) {
    tgSend(chatId, days.length ? 'No day ' + tgEscape(key) + ' in ' + tgCmdTitle(trip) + ' — it has days 1–' + days.length + '.' : 'No day plan for ' + tgCmdTitle(trip) + ' yet.');
    return null;
  }
  return tgCmdSendAll(chatId, tgCmdDayMessages(trip, day, days.length));
}

/** /trip: the current trip's summary, a button per day, brochure and Later buttons. */
function tgCmdTripMessages(trip) {
  var tk = tgCmdTripKey(trip.slug), days = tgDigestDays(trip.slug);
  var lines = ['🧳 <b>' + tgCmdTitle(trip) + '</b> · ' + tgEscape(trip.status || 'intake')];
  if (trip.start) {
    var n = tgCmdDaysBetween(trip.start, trip.end || trip.start);
    lines.push(tgCmdDate(trip.start) + (trip.end && trip.end !== trip.start ? ' → ' + tgCmdDate(trip.end) : '') + (n !== null ? ' (' + (n + 1) + ' day' + (n ? 's' : '') + ')' : ''));
  }
  if (trip.lodging && trip.lodging.text) lines.push('Staying: ' + tgEscape(truncate(trip.lodging.text, 200)));
  if (trip.verified_on) lines.push('<i>Checked on ' + tgEscape(trip.verified_on) + '</i>');
  if (days.length) {
    lines.push('');
    days.forEach(function (d) {
      var k = (d.stops || []).length;
      lines.push('<b>' + d.n + '.</b> ' + tgCmdDate(d.date) + (d.theme ? ' — ' + tgEscape(d.theme) : '') + ' <i>(' + k + ' stop' + (k === 1 ? '' : 's') + ')</i>');
    });
  } else {
    lines.push('', trip.status === 'choosing' ? 'Still choosing — the day plan comes after <i>Done choosing</i>.' : 'No day plan yet.');
  }
  var later = tgLaterList(trip.slug).length;
  if (later) lines.push('🔖 ' + later + ' on the Later list — /later');
  var others = tgTripList().filter(function (t) { return t.slug !== trip.slug && t.status !== 'done'; }).slice(0, 5);
  if (others.length) lines.push('', '<i>Other trips: ' + others.map(function (t) { return tgEscape(t.slug); }).join(', ') + ' — /trip &lt;name&gt; to switch</i>');
  var rows = tgCmdRows(days.map(function (d) { return { text: String(d.n), data: cbEncode('dy', tk, d.n) }; }), 7);
  var act = [];
  if (days.length || trip.drive_brochure_pdf) act.push({ text: '📄 Brochure', data: cbEncode('pl', 'br', tk) });
  if (later) act.push({ text: '🔖 Later', data: cbEncode('pl', 'lt', tk) });
  if (act.length) rows.push(act);
  return tgCmdMessages(lines, rows.length ? tgKeyboard(rows) : null);
}
/** A trip for /trip <name>: slug, slug prefix, or a title/destination containing the words. */
function tgCmdFindTrip(q) {
  var f = String(q || '').trim().toLowerCase();
  if (!f) return null;
  var all = tgTripList(), s = tgSlug(f);
  var hit = all.filter(function (t) { return t.slug === s; })[0] || all.filter(function (t) { return s && t.slug.indexOf(s) === 0; })[0];
  return hit || all.filter(function (t) { return (String(t.title) + ' ' + String(t.destination)).toLowerCase().indexOf(f) >= 0; })[0] || null;
}
registerCommand('/trip', function (ctx) {
  var trip;
  if (ctx.args) {
    trip = tgCmdFindTrip(ctx.args);
    if (!trip) { ctx.reply('No trip matches “' + tgEscape(truncate(ctx.args, 60)) + '”.'); return; }
    settingSet(TG_SETTINGS.CURRENT_TRIP, trip.slug, 'set by /trip');
  } else trip = tgCmdCurrent(ctx);
  if (trip) tgCmdSendAll(ctx.chatId, tgCmdTripMessages(trip));
}, 'the current trip: dates, days and buttons (/trip <name> switches trip)');

registerCommand('/today', function (ctx) {
  var trip = tgCmdCurrent(ctx);
  if (!trip) return;
  var today = isoDateLocal(), day = tgDigestDay(trip.slug, today);
  if (day) { tgCmdSendAll(ctx.chatId, tgCmdDayMessages(trip, day, tgDigestDays(trip.slug).length)); return; }
  var days = tgDigestDays(trip.slug);
  if (!days.length) { ctx.reply('No day plan for ' + tgCmdTitle(trip) + ' yet.'); return; }
  if (today < days[0].date) {
    var n = tgCmdDaysBetween(today, days[0].date);
    ctx.reply(tgCmdTitle(trip) + ' starts ' + tgCmdDate(days[0].date) + ' (in ' + n + ' day' + (n === 1 ? '' : 's') + ') — /day 1');
  } else ctx.reply(tgCmdTitle(trip) + ' ended ' + tgCmdDate(days[days.length - 1].date) + '. How was it? /review');
}, "today's plan of the current trip");

registerCommand('/day', function (ctx) {
  var trip = tgCmdCurrent(ctx);
  if (!trip) return;
  var key = String(ctx.argv[0] || '').trim();
  if (!/^(\d{1,2}|\d{4}-\d{2}-\d{2})$/.test(key)) { ctx.reply('Which day? <code>/day 2</code> or <code>/day 2027-05-13</code>'); return; }
  tgCmdSendDay(ctx.chatId, trip, key);
}, 'one day of the plan: /day N or /day YYYY-MM-DD');

/** /later list of a trip with ⬆️ buttons (lt:<trip key>:<i>.<tag>). */
function tgCmdLaterMessages(trip) {
  var list = tgLaterList(trip.slug), tk = tgCmdTripKey(trip.slug);
  if (!list.length) return [{ html: 'The Later list of ' + tgCmdTitle(trip) + ' is empty.' }];
  var lines = ['🔖 <b>Later — ' + tgCmdTitle(trip) + '</b>'];
  list.forEach(function (e, i) {
    var why = TG_CMD_LATER_REASONS[e.reason] || e.reason;
    lines.push('<b>' + (i + 1) + '.</b> ' + tgEscape(e.name) + (why ? ' — <i>' + tgEscape(truncate(why, 160)) + '</i>' : ''));
  });
  var days = tgDigestDays(trip.slug).length;
  if (days) lines.push('', 'Tap a number to move it onto a day (the plan is rebuilt for that day).');
  var rows = days ? tgCmdRows(list.slice(0, 40).map(function (e, i) { return { text: '⬆️ ' + (i + 1), data: cbEncode('lt', tk, i + '.' + tgCmdTag(e.place_slug)) }; }), 5) : [];
  return tgCmdMessages(lines, rows.length ? tgKeyboard(rows) : null);
}
registerCommand('/later', function (ctx) {
  var trip = tgCmdCurrent(ctx);
  if (trip) tgCmdSendAll(ctx.chatId, tgCmdLaterMessages(trip));
}, 'the saved-for-later list, with buttons to move one onto a day');

/** /place <name>: the stop or Later item of the current trip, else the places repository. */
function tgCmdFindStop(trip, q) {
  var f = String(q || '').trim().toLowerCase(), hits = [];
  if (!trip || !f) return hits;
  tgDigestDays(trip.slug).forEach(function (d) {
    (d.stops || []).forEach(function (s) { if (String(s.name).toLowerCase().indexOf(f) >= 0) hits.push({ slug: s.slug, name: s.name, note_line: s.note_line, maps_url: s.maps_url, day: d }); });
  });
  tgLaterList(trip.slug).forEach(function (e) { if (String(e.name).toLowerCase().indexOf(f) >= 0) hits.push({ slug: e.place_slug, name: e.name, later: e.reason }); });
  return hits;
}
registerCommand('/place', function (ctx) {
  if (!ctx.args) { ctx.reply('Which place? <code>/place &lt;name&gt;</code>'); return; }
  var trip = tgTripCurrent(), hits = tgCmdFindStop(trip, ctx.args);
  if (!hits.length) {
    hits = tgPlacesSearch(ctx.args, { limit: 3 }).map(function (p) { return { slug: p.slug, name: p.name, note_line: p.note_line, maps_url: p.maps_url, status: p.status }; });
  }
  if (!hits.length) { ctx.reply('Nothing called “' + tgEscape(truncate(ctx.args, 60)) + '” in the plan or the places I know. /places lists them.'); return; }
  var h = hits[0], lines = ['📍 <b>' + tgCmdHref(h.maps_url, h.name) + '</b>'];
  if (h.day) lines.push('Day ' + h.day.n + ' · ' + tgCmdDate(h.day.date));
  if (h.later) lines.push('🔖 Later — <i>' + tgEscape(TG_CMD_LATER_REASONS[h.later] || h.later) + '</i>');
  if (h.status) lines.push('<i>' + tgEscape(h.status) + '</i>');
  lines.push(h.note_line ? tgEscape(h.note_line) : '<i>No note line yet.</i>');
  if (hits.length > 1) lines.push('', '<i>Also: ' + hits.slice(1, 4).map(function (x) { return tgEscape(x.name); }).join(', ') + '</i>');
  tgCmdSendAll(ctx.chatId, tgCmdMessages(lines, tgKeyboard([[{ text: '📝 Full note', data: cbEncode('ps', tgCmdPlaceKeys([h.slug])[0], 'n') }]])));
}, 'the note line and map link of a place: /place <name>');

/* ==================== places ==================== */

/**
 * Callback keys for place slugs: the slug itself when it is callback-safe and "ps:<slug>:n" fits in 64 bytes, else
 * ".<i>.<tag>" — an index into the list remembered in Settings (TG_CMD_PLACES_LAST, the last /places search or /place
 * answer) plus four hex of the slug's hash, so a button from an older list (overwritten by a later /place or /places)
 * is refused instead of acting on whichever place now sits at that index. Slugs never contain ".".
 */
function tgCmdPlaceKeys(slugs) {
  settingSet(TG_CMD_PLACES_LAST, toJson(slugs || []), 'last /places search (ps buttons)');
  return (slugs || []).map(function (s, i) {
    s = String(s);
    return /^[A-Za-z0-9_|-]+$/.test(s) && utf8Bytes('ps:' + s + ':n') <= LIMITS.CB_DATA_MAX_BYTES ? s : '.' + i + '.' + tgCmdTag(s);
  });
}
function tgCmdPlaceByKey(key) {
  key = String(key || '');
  if (key.charAt(0) !== '.') return tgPlacesGet(key) || { slug: key, name: key };
  var m = /^\.(\d+)\.([0-9a-f]{4})$/.exec(key);
  if (!m) return null;
  var p = safeJsonParse(settingGet(TG_CMD_PLACES_LAST, '[]')), list = p.ok && Array.isArray(p.value) ? p.value : [];
  var slug = list[parseInt(m[1], 10)];
  if (!slug || tgCmdTag(slug) !== m[2]) return null;
  return tgPlacesGet(slug) || { slug: slug, name: slug };
}
function tgCmdPlaceLine(p, i) {
  var bits = [];
  if (p.status) bits.push(tgEscape(p.status));
  if (p.last_trip) bits.push('last trip ' + tgEscape(p.last_trip));
  if (p.area) bits.push(tgEscape(truncate(p.area, 60)));
  var line = '<b>' + (i + 1) + '.</b> ' + tgCmdHref(p.maps_url, p.name) + (bits.length ? ' · ' + bits.join(' · ') : '');
  return p.note_line ? line + '\n   <i>' + tgEscape(p.note_line) + '</i>' : line;
}
registerCommand('/places', function (ctx) {
  if (!ctx.args) {
    var counts = tgPlacesCounts(), dests = Object.keys(counts).sort();
    if (!dests.length) { ctx.reply('📚 No places yet — they arrive with research rounds and plans.'); return; }
    var lines = ['📚 <b>Places I know</b>'].concat(dests.map(function (d) { return tgEscape(d) + ' — ' + counts[d]; }));
    lines.push('', 'Search: <code>/places &lt;name, tag or area&gt;</code>');
    tgCmdSendAll(ctx.chatId, tgCmdMessages(lines));
    return;
  }
  var hits = tgPlacesSearch(ctx.args, { limit: 8 });
  if (!hits.length) { ctx.reply('No place matches “' + tgEscape(truncate(ctx.args, 60)) + '”.'); return; }
  var keys = tgCmdPlaceKeys(hits.map(function (p) { return p.slug; }));
  var lines2 = ['📚 <b>' + hits.length + ' match' + (hits.length === 1 ? '' : 'es') + '</b> — 📝 full note · ➕ add to the current trip · 🔁 fresh check'];
  var rows = [];
  hits.forEach(function (p, i) {
    lines2.push(tgCmdPlaceLine(p, i));
    rows.push([{ text: '📝 ' + (i + 1), data: cbEncode('ps', keys[i], 'n') }, { text: '➕ ' + (i + 1), data: cbEncode('ps', keys[i], 'a') },
      { text: '🔁 ' + (i + 1), data: cbEncode('ps', keys[i], 'c') }]);
  });
  tgCmdSendAll(ctx.chatId, tgCmdMessages(lines2, tgKeyboard(rows)));
}, 'the places repository: /places [name, tag or area]');

/* ==================== requests ==================== */

/** 'YYYY-MM-DD', 'N' / 'day N', 'today', 'tomorrow' → a date of the trip's plan, or null. */
function tgCmdPlanDate(trip, word) {
  var w = String(word || '').trim().toLowerCase().replace(/^day\s*/, '');
  if (w === 'today') w = isoDateLocal();
  else if (w === 'tomorrow') w = isoDateLocal(new Date(nowMs() + 86400000));
  var d = tgDigestDay(trip.slug, w);
  return d ? d.date : null;
}
registerCommand('/replan', function (ctx) {
  var trip = tgCmdCurrent(ctx);
  if (!trip) return;
  var m = /^(day\s*\d{1,2}|\d{4}-\d{2}-\d{2}|\d{1,2}|today|tomorrow)\b\s*([\s\S]*)$/i.exec(ctx.args || '');
  if (!m) { ctx.reply('Usage: <code>/replan &lt;date or day N&gt; &lt;what to change&gt;</code> — e.g. <code>/replan day 2 more time at the market</code>'); return; }
  var date = tgCmdPlanDate(trip, m[1]);
  if (!date) { ctx.reply('That day is not in the plan of ' + tgCmdTitle(trip) + '. /trip shows its days.'); return; }
  var why = truncate(String(m[2] || '').trim(), 300);
  var payload = { trip: trip.slug, dates: [date] };
  if (why) payload.reason = why;
  tgOpenKindRequest('replan', payload, { chat: ctx.chat, text: ctx.text, replyTo: ctx.chat.message_id, ack: '🔁 Replanning ' + tgCmdDate(date) + '…' });
}, 'rebuild one day: /replan <date or day N> <why>');

registerCommand('/notes', function (ctx) {
  var trip = tgCmdCurrent(ctx);
  if (!trip) return;
  var payload = { trip: trip.slug }, missing = [];
  if (ctx.args) {
    var slugs = [];
    ctx.args.split(/[\n,;]+/).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (name) {
      var h = tgCmdFindStop(trip, name)[0];
      if (h) { if (slugs.indexOf(h.slug) < 0) slugs.push(h.slug); } else missing.push(name);
    });
    if (!slugs.length) { ctx.reply('None of those is in the plan of ' + tgCmdTitle(trip) + '.'); return; }
    payload.places = slugs;
  }
  tgOpenKindRequest('notes', payload, { chat: ctx.chat, text: ctx.text, replyTo: ctx.chat.message_id,
    ack: '📝 Writing ' + (payload.places ? payload.places.length + ' note' + (payload.places.length === 1 ? '' : 's') : 'the place notes') + '…' + (missing.length ? ' (not in the plan: ' + tgEscape(missing.join(', ')) + ')' : '') });
}, 'write the place notes of the current trip: /notes [names]');

/** Resend the stored brochure PDF; without one (or when Drive refuses), ask the brain to build it. */
function tgCmdBrochure(chatId, trip, chat) {
  if (trip.drive_brochure_pdf) {
    var cap = '📄 <b>' + tgCmdTitle(trip) + '</b>' + (trip.verified_on ? ' · checked on ' + tgEscape(trip.verified_on) : '');
    var r = tgSendDocument(chatId, { driveFileId: trip.drive_brochure_pdf, caption: cap });
    if (r && r.ok) return r;
  }
  var payload = { trip: trip.slug };
  if (trip.build_id) payload.build_id = trip.build_id;
  return tgOpenKindRequest('brochure', payload, { chat: chat || null, text: '/brochure', ack: '📄 Building the brochure for ' + tgCmdTitle(trip) + '…' });
}
registerCommand('/brochure', function (ctx) {
  var trip = tgCmdCurrent(ctx);
  if (trip) tgCmdBrochure(ctx.chatId, trip, ctx.chat);
}, 'the brochure PDF of the current trip');

registerCommand('/lodging', function (ctx) {
  var trip = tgCmdCurrent(ctx);
  if (!trip) return;
  if (!ctx.args) {
    ctx.reply(trip.lodging && trip.lodging.text ? 'Staying: ' + tgEscape(trip.lodging.text) + '\nChange it with <code>/lodging &lt;where&gt;</code>.' : 'Where are you staying? <code>/lodging &lt;name, area or address&gt;</code>');
    return;
  }
  var text = truncate(ctx.args.replace(/\s+/g, ' ').trim(), 300), lodging = { text: text };
  var n = /(\d{1,2})\s*nights?\b/i.exec(text);
  if (n) lodging.nights = parseInt(n[1], 10);
  tgTripUpsert({ slug: trip.slug, lodging: lodging });
  ctx.reply('🏨 Saved for ' + tgCmdTitle(trip) + ': ' + tgEscape(text) + '\nIt goes with the next research round.');
}, 'where you are staying on the current trip: /lodging <text>');

/** The lodging line a research request carries: the owner's /lodging words (+ nights). */
function tgCmdLodgingText(trip) {
  var l = trip && trip.lodging;
  if (!l || !l.text) return '';
  return l.nights && !/nights?/i.test(l.text) ? l.text + ' (' + l.nights + ' nights)' : String(l.text);
}

/* ==================== callbacks ==================== */

/** dy:<trip key>:<n> sends day n; …:e (the ◀ ▶ of a day view) edits that view in place; …:r is "replan this day". */
registerCallback('dy', function (ctx) {
  var trip = tgCmdTripByKey(ctx.parts[0]), n = parseInt(ctx.parts[1], 10);
  if (!trip || !(n >= 1)) { ctx.answer('That trip is gone.'); return; }
  var days = tgDigestDays(trip.slug), day = days[n - 1];
  if (!day) { ctx.answer('No day ' + n + ' any more.'); return; }
  ctx.answer('');
  if (ctx.parts[2] === 'r') {
    tgSend(ctx.chatId, '🔁 What should change on day ' + n + ' (' + tgCmdDate(day.date) + ')? Send <code>/replan ' + tgEscape(day.date) + ' &lt;what to change&gt;</code>');
    return;
  }
  var msgs = tgCmdDayMessages(trip, day, days.length);
  if (ctx.parts[2] === 'e' && msgs.length === 1 && ctx.messageId) ctx.edit(msgs[0].html, msgs[0].keyboard);
  else tgCmdSendAll(ctx.chatId, msgs);
});

/** lt:<trip key>:<i>.<tag> asks which day; lt:<trip key>:<i>.<tag>:<n> opens the replan that promotes it onto day n. */
registerCallback('lt', function (ctx) {
  var trip = tgCmdTripByKey(ctx.parts[0]);
  var m = /^(\d+)\.([0-9a-f]{4})$/.exec(String(ctx.parts[1] || ''));
  var list = trip ? tgLaterList(trip.slug) : [], e = m ? list[parseInt(m[1], 10)] : null;
  if (!trip || !e || tgCmdTag(e.place_slug) !== m[2]) { ctx.answer('That list has changed — send /later again.'); return; }
  var days = tgDigestDays(trip.slug);
  if (!days.length) { ctx.answer('There is no day plan to put it in yet.'); return; }
  if (ctx.parts[2] === undefined) {
    ctx.answer('');
    var rows = tgCmdRows(days.map(function (d) { return { text: d.n + ' · ' + tgCmdDate(d.date), data: cbEncode('lt', ctx.parts[0], ctx.parts[1], d.n) }; }), 3);
    tgSend(ctx.chatId, 'Move <b>' + tgEscape(e.name) + '</b> onto which day?', { keyboard: tgKeyboard(rows) });
    return;
  }
  var day = days[parseInt(ctx.parts[2], 10) - 1];
  if (!day) { ctx.answer('No such day.'); return; }
  ctx.answer('Replanning day ' + day.n);
  if (ctx.messageId) tgApi('editMessageReplyMarkup', { chat_id: ctx.chatId, message_id: ctx.messageId, reply_markup: { inline_keyboard: [] } });
  tgOpenKindRequest('replan', { trip: trip.slug, dates: [day.date], promote: [e.place_slug], reason: 'promoted from the Later list' },
    { text: 'promote ' + e.name + ' onto day ' + day.n, ack: '🔁 Putting <b>' + tgEscape(e.name) + '</b> on day ' + day.n + ' (' + tgCmdDate(day.date) + ') — replanning that day…' });
});

/** ps:<place key>:n (full note) · a (add to the current trip's Later list) · c (fresh check). */
registerCallback('ps', function (ctx) {
  var p = tgCmdPlaceByKey(ctx.parts[0]), what = ctx.parts[1];
  if (!p) { ctx.answer('That list has changed — search again.'); return; }
  var trip = tgTripCurrent();
  if (what === 'n') {
    ctx.answer('Asking for the full note');
    var payload = { places: [p.slug] };
    if (trip) payload.trip = trip.slug;
    tgOpenKindRequest('notes', payload, { text: 'full note: ' + p.name, ack: '📝 Writing the full note for <b>' + tgEscape(p.name) + '</b>…' });
  } else if (what === 'a') {
    if (!trip) { ctx.answer('No current trip — /plan one first.', true); return; }
    tgLaterAdd(trip.slug, { place_slug: p.slug, name: p.name, reason: 'owner_choice' });
    ctx.answer('Added');
    var list = tgLaterList(trip.slug), i = -1;
    list.forEach(function (e, k) { if (e.place_slug === p.slug) i = k; });
    var days = tgDigestDays(trip.slug), kb = null;
    if (days.length && i >= 0) {
      kb = tgKeyboard(tgCmdRows(days.map(function (d) { return { text: d.n + ' · ' + tgCmdDate(d.date), data: cbEncode('lt', tgCmdTripKey(trip.slug), i + '.' + tgCmdTag(p.slug), d.n) }; }), 3));
    }
    tgSend(ctx.chatId, '🔖 <b>' + tgEscape(p.name) + '</b> is on the Later list of ' + tgCmdTitle(trip) + '.' + (kb ? ' Put it on a day now?' : ''), kb ? { keyboard: kb } : undefined);
  } else if (what === 'c') {
    var dest = p.destination || (trip && trip.destination ? tgSlug(trip.destination) : '');
    if (!dest) { ctx.answer('I do not know where that place is.', true); return; }
    ctx.answer('Checking');
    tgOpenKindRequest('places', { scope: 'check', destination: dest, slugs: [p.slug] }, { text: 'check ' + p.name, ack: '🔁 Checking <b>' + tgEscape(p.name) + '</b>…' });
  } else ctx.answer('Unknown button');
});

/** pl:<action>:… — the table TG_CMD_PL. */
registerCallback('pl', function (ctx) {
  var fn = TG_CMD_PL[ctx.parts[0]];
  if (!fn) { ctx.answer('Unknown button'); return; }
  fn(ctx, ctx.parts.slice(1));
});
tgCmdPlAction('br', function (ctx, args) {
  var trip = tgCmdTripByKey(args[0]);
  if (!trip) { ctx.answer('That trip is gone.'); return; }
  ctx.answer('');
  tgCmdBrochure(ctx.chatId, trip, null);
});
tgCmdPlAction('lt', function (ctx, args) {
  var trip = tgCmdTripByKey(args[0]);
  if (!trip) { ctx.answer('That trip is gone.'); return; }
  ctx.answer('');
  tgCmdSendAll(ctx.chatId, tgCmdLaterMessages(trip));
});
tgCmdPlAction('rp', function (ctx, args) {
  var trip = tgCmdTripByKey(args[0]), days = trip ? tgDigestDays(trip.slug) : [];
  if (!days.length) { ctx.answer('No day plan to change.'); return; }
  ctx.answer('');
  var rows = tgCmdRows(days.map(function (d) { return { text: d.n + ' · ' + tgCmdDate(d.date), data: cbEncode('dy', args[0], d.n, 'r') }; }), 3);
  tgSend(ctx.chatId, '🔁 Which day should change?', { keyboard: tgKeyboard(rows) });
});

// Developed by: LightAISolutions
