/**
 * Tour Guide pack — instant commands and the shared chat helpers (WP-5a; plan §5.9 command table, §5.10).
 * Lane A (answered from the pack tabs through WP-5b's storage API, no routine): /profile, /trip, /today, /day, /later,
 * /place, /places. Requests (Lane C, through tgOpenKindRequest with exactly the TG-PHASE-4B §5 fields): /replan, /notes,
 * /brochure (a resend when the PDF id is stored), /lodging (stored on the trip, sent with the next research round), /dates
 * (dates and day hours, sent as trip_update with the next research, plan or replan request).
 * Renderer `core_start` (the interview offer after /start when no profile summary is cached).
 * Callbacks: `dy` (a day), `lt` (promote a Later item onto a day → replan), `rs` (swap a rainy-day option in → replan),
 * `ps` (a place: note · add · check),
 * `pl` (plan actions; other pack files add actions with tgCmdPlAction).
 * Every string from the brain or the owner is escaped (tgEscape / tgCmdHref); every message goes out through tgLines.
 */
var TG_CMD_TRIPKEY_MAX = 36;        // a trip slug longer than this travels in callback data as a hash key
var TG_CMD_URL_MAX = 400;           // longer Maps links are dropped from chat lines (the name stays)
var TG_CMD_PLACES_LAST = 'tg_places_last';   // Settings: JSON [slug…] of the last /places search (ps keys ".<i>")
var TG_CMD_LATER_REASONS = { owner_choice: 'saved by you', not_shown: 'gem not chosen', closed_business: 'closed since last visit' };
var TG_CMD_MODES = { WALK: 'walk', TRANSIT: 'transit', DRIVE: 'drive' };

/* ==================== shared helpers ==================== */

/**
 * Google Maps hosts a place link may point at (WP-6a, red-team A6): the name of a place is a link only when it opens Google
 * Maps — a brain link to any other host (a lookalike login page, `google.com.example.net`, `google.com@example.net`) is
 * shown as plain text, so a tap on a place name never leaves Maps.
 */
var TG_CMD_MAPS_URL = /^https:\/\/((www\.)?google\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})\/maps([\/?#]|$)|maps\.google\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})([\/?#]|$)|maps\.app\.goo\.gl\/|goo\.gl\/maps\/)\S*$/;
/** An escaped link: <a href="url">text</a> when url is a Google Maps https URL of reasonable length, else the escaped text. */
function tgCmdHref(url, text) {
  var t = tgEscape(text), u = String(url || '');
  if (!TG_CMD_MAPS_URL.test(u) || u.length > TG_CMD_URL_MAX) return t;
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

/** A stored day → [{ html, keyboard? }] with ◀ ▶ buttons (dy:<trip key>:<n>). Reads the Phase 10 fields (Contract C10) when
 *  the day has them — honest legs, buffers, spare time, "about" times, check-on-the-day lines — and shows an older day as before. */
function tgCmdDayMessages(trip, day, total) {
  var tk = tgCmdTripKey(trip.slug);
  var lines = ['<b>Day ' + day.n + (total ? ' of ' + total : '') + ' · ' + tgCmdDate(day.date) + '</b>' + (day.theme ? ' — ' + tgEscape(day.theme) : '')];
  var legs = Array.isArray(day.legs) ? day.legs : [];
  var legTo = function (slug) { return legs.filter(function (l) { return l && l.to === slug; })[0] || null; };
  (day.stops || []).forEach(function (s) {
    var l = legTo(s.slug);
    if (l) lines.push(tgCmdDayLegLine(l, ''));
    var time = tgCmdDayTime(s);
    lines.push('<b>' + tgEscape(s.n) + '.</b> ' + (time ? time + ' ' : '') + tgCmdHref(s.maps_url, s.name) + (s.minutes ? ' · ' + tgCmdMinutes(s.minutes) : ''));
    var note = s.note_line ? tgCmdDayNoteGuard(String(s.note_line), { arrive: s.arrive, depart: s.depart }) : '';
    if (note) lines.push('   <i>' + tgEscape(note) + '</i>');
    if (typeof s.check_on_day === 'string' && s.check_on_day) lines.push('   🕑 <i>' + tgEscape(s.check_on_day) + '</i>');
  });
  var home = legTo('lodging');
  if (home) lines.push(tgCmdDayLegLine(home, 'back to your lodging'));
  if (!(day.stops || []).length) lines.push('<i>A free day.</i>');
  if (typeof day.spare_minutes === 'number' && day.spare_minutes >= 0 && (day.stops || []).length) {
    lines.push('Spare time: ' + (day.spare_minutes ? tgCmdDaySpan(day.spare_minutes) : 'none'));
  }
  if (legs.some(function (l) { return l && (l.mode === 'WALK' || l.mode === 'BICYCLE') && !l.estimated; })) lines.push('<i>' + TG_CMD_DAY_WALK_BETA + '</i>');
  (day.warnings || []).forEach(function (w) { lines.push('⚠️ ' + tgEscape(w)); });
  if (typeof tgBkDayLines === 'function') {
    (tgBkDayLines(trip, day) || []).forEach(function (b) { if (typeof b === 'string' && b) lines.push(b); });
  }
  (Array.isArray(day.rain) ? day.rain : []).forEach(function (r, i) {
    if (!i) lines.push('<b>If it rains</b>');
    lines.push('☔ ' + tgCmdHref(r.maps_url, r.name) + ' <i>instead of ' + tgEscape(r.instead_of) + (typeof r.km === 'number' ? ', ' + tgEscape(r.km) + ' km away' : '') + '</i>');
  });
  var rows = (Array.isArray(day.rain) ? day.rain : []).filter(function (r) { return r && r.slug && tgCmdRainStop(day, r); }).map(function (r) {
    return [{ text: '☔ Swap in ' + truncate(String(r.name || r.slug), 40), data: cbEncode('rs', tk, day.n + '.' + day.rain.indexOf(r) + '.' + tgCmdTag(r.slug)) }];
  });
  var nav = [];
  if (day.n > 1) nav.push({ text: '◀ Day ' + (day.n - 1), data: cbEncode('dy', tk, day.n - 1, 'e') });
  if (total && day.n < total) nav.push({ text: 'Day ' + (day.n + 1) + ' ▶', data: cbEncode('dy', tk, day.n + 1, 'e') });
  if (nav.length) rows.push(nav);
  return tgCmdMessages(lines, rows.length ? tgKeyboard(rows) : null);
}
/** The stop a rainy-day option replaces (the digest names it, as the stop's own name), or null. */
function tgCmdRainStop(day, r) { return (day.stops || []).filter(function (st) { return st && st.slug && st.name === r.instead_of; })[0] || null; }
/** The Phase 10 leg fields (Contract C10): a leg carrying any of them shows the honest-leg wording; an older leg shows as before. */
var TG_CMD_DAY_LEG_FIELDS = ['estimated', 'distance_m', 'flags', 'taxi_minutes', 'buffer_minutes'];
/** Google requires this notice wherever a WALK or BICYCLE route is shown (Routes API RouteTravelMode; decisions/WP-10b.md). */
var TG_CMD_DAY_WALK_BETA = 'Walking routes from Google are in beta and may be missing sidewalks or footpaths.';
/** Leg flags in display order (planner FLAG_ORDER). */
var TG_CMD_DAY_FLAGS = ['footpath', 'trail', 'uphill', 'downhill'];
/** One leg → '   <i>↳ walk 22 min · uphill · taxi about 11 min · +5 min spare</i>' (an older leg: '↳ 9 min walk'). */
function tgCmdDayLegLine(l, what) {
  var mode = TG_CMD_MODES[l.mode] || String(l.mode || '').toLowerCase();
  var c10 = TG_CMD_DAY_LEG_FIELDS.some(function (k) { return l[k] !== undefined; });
  var t;
  if (l.estimated) t = 'about ' + tgCmdDaySpan(l.minutes) + ' ' + mode + ' (estimate)';
  else if (c10) t = mode + ' ' + tgCmdDaySpan(l.minutes);
  else t = tgCmdMinutes(l.minutes) + ' ' + mode;
  var extra = [];
  var flags = Array.isArray(l.flags) ? l.flags : [];
  TG_CMD_DAY_FLAGS.forEach(function (f) { if (flags.indexOf(f) >= 0) extra.push(f); });
  if (typeof l.taxi_minutes === 'number' && l.taxi_minutes > 0) extra.push('taxi about ' + tgCmdDaySpan(l.taxi_minutes));
  if (typeof l.buffer_minutes === 'number' && l.buffer_minutes > 0) extra.push('+' + tgCmdDaySpan(l.buffer_minutes) + ' spare');
  return '   <i>↳ ' + tgCmdHref(l.maps_url, t) + (what ? ' ' + what : '') + (extra.length ? ' · ' + tgEscape(extra.join(' · ')) : '') + '</i>';
}
/** 22 → "22 min", 70 → "1 h 10 min", 120 → "2 h". */
function tgCmdDaySpan(m) {
  m = parseInt(m, 10);
  if (!(m >= 0)) return '';
  if (m < 60) return m + ' min';
  return Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
}
/** A stop's time: exact (or no time_style) → "11:50–12:55" as before; "about" → the arrival to the nearest 15 minutes, "about 11:45". */
function tgCmdDayTime(s) {
  if (!s.arrive) return '';
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(s.arrive));
  if (s.time_style === 'about' && m) {
    var q = Math.round((Number(m[1]) * 60 + Number(m[2])) / 15) * 15;
    var h = Math.floor(q / 60) % 24, mm = q % 60;
    return 'about ' + (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
  }
  return tgEscape(s.arrive) + (s.depart ? '–' + tgEscape(s.depart) : '');
}
/**
 * The note guard (Phase 10 fix (a)) — a port of planner/planner-notes.mjs for the day card's note line: drops each sentence whose
 * timing advice the stop's scheduled time contradicts and keeps the rest as written. helpers/tests/pack_tour-guide_note_table.js
 * runs one table through both. sched: { arrive: 'HH:MM', depart: 'HH:MM', window?: { open } | null }.
 */
var TG_CMD_DAY_NOTE_RULES = { OPENING_SLACK: 30, EARLY_BY: 600, MORNING_BY: 720, AFTERNOON_FROM: 720, LATE_AFTERNOON_FROM: 900, EVENING_FROM: 960, BARE_PM_BELOW: 8 };
var TG_CMD_DAY_NOTE_RE = {
  opening: /\b(?:at|for|by|right at|just after|before|around) (?:the )?open(?:ing)?(?: time)?\b|\bwhen (?:it|the doors|the gates|they) opens?\b|\bas soon as (?:it|they) opens?\b|\bfirst thing\b|\bthe moment (?:it|they) opens?\b/i,
  early: /\bearly[- ]morning\b|\b(?:go|arrive|come|get there|visit) early\b|\bbefore the crowds\b|\bat dawn\b|\bsunrise\b/i,
  morning: /\b(?:in|during) the morning\b|\bmornings? (?:are|is) (?:best|quietest|calmest)\b|\bbest in the morning\b|\bmorning light\b/i,
  lateAfternoon: /\blate afternoon\b/i,
  afternoon: /\b(?:in|during) the afternoon\b|\bafternoon light\b|\bafternoons? (?:are|is) (?:best|quietest|calmest)\b/i,
  evening: /\bsunset\b|\bdusk\b|\bgolden hour\b|\b(?:in|during) the evening\b|\bat night\b|\bafter dark\b|\bnight view\b|\blit up\b|\billuminat(?:ed|ion)\b/i,
  before: /\bbefore\s+(noon|midday|\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)(?![\w:])/i,
  after: /\bafter\s+(noon|midday|\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)(?![\w:])/i,
  hoursTalk: /\b(?:opens?|closes?|closing|last (?:entry|admission)|open daily|hours)\b[^.]*$/i
};
function tgCmdDayNoteMin(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
/** '5' → 1020, '10:30' → 630, '9am' → 540, 'noon' → 720; null when not a clock time. */
function tgCmdDayNoteClock(s) {
  var t = String(s || '').trim().toLowerCase();
  if (t === 'noon' || t === 'midday') return 720;
  var m = /^(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/.exec(t);
  if (!m) return null;
  var h = Number(m[1]), min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  var ampm = m[3] ? m[3].charAt(0) : null;
  if (ampm === 'p' && h < 12) h += 12;
  else if (ampm === 'a' && h === 12) h = 0;
  else if (!ampm && !m[2] && h < TG_CMD_DAY_NOTE_RULES.BARE_PM_BELOW) h += 12;
  return h * 60 + min;
}
/** The rule a sentence's timing advice breaks ('opening' | 'early' | 'morning' | 'afternoon' | 'evening' | 'before' | 'after'), or null. */
function tgCmdDayNoteConflict(sentence, sched) {
  var s = String(sentence || ''), X = TG_CMD_DAY_NOTE_RE, R = TG_CMD_DAY_NOTE_RULES;
  var arrive = tgCmdDayNoteMin(sched && sched.arrive), depart = tgCmdDayNoteMin(sched && sched.depart);
  if (arrive === null || depart === null) return null;
  var open = sched.window ? tgCmdDayNoteMin(sched.window.open) : null;
  if (X.opening.test(s) && (open !== null ? arrive - open > R.OPENING_SLACK : arrive >= R.EARLY_BY)) return 'opening';
  if (X.early.test(s) && arrive >= R.EARLY_BY) return 'early';
  if (X.morning.test(s) && arrive >= R.MORNING_BY) return 'morning';
  if (X.lateAfternoon.test(s) ? depart < R.LATE_AFTERNOON_FROM : X.afternoon.test(s) && depart <= R.AFTERNOON_FROM) return 'afternoon';
  if (X.evening.test(s) && depart < R.EVENING_FROM) return 'evening';
  var x, b = X.before.exec(s);
  if (b && !X.hoursTalk.test(s.slice(0, b.index))) { x = tgCmdDayNoteClock(b[1]); if (x !== null && arrive >= x) return 'before'; }
  var a = X.after.exec(s);
  if (a && !X.hoursTalk.test(s.slice(0, a.index))) { x = tgCmdDayNoteClock(a[1]); if (x !== null && arrive < x) return 'after'; }
  return null;
}
/** The note without the sentences the schedule contradicts ('' when nothing is left); unchanged when no sentence conflicts. */
function tgCmdDayNoteGuard(text, sched) {
  if (typeof text !== 'string' || !text) return text;
  var parts = text.match(/[^.!?;]+(?:[.!?;]+(?=\s|$)|[.!?;]*$)\s*/g) || [];
  var kept = parts.filter(function (p) { return !tgCmdDayNoteConflict(p, sched); });
  return kept.length === parts.length ? text : kept.join('').trim();
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
  lines.push.apply(lines, tgBkTripLines(trip));
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

/**
 * "Today in <destination>: Wed 3 Mar" when the trip keeps its own zone and that zone is not at home's offset right now
 * (WP-10a), so the owner sees which day "today" means; '' otherwise.
 */
function tgCmdTodayHeader(trip, today) {
  if (!tgTripAway(trip)) return '';
  return '📍 Today in ' + tgEscape(trip.destination || trip.title || trip.slug) + ': ' + tgCmdDate(today);
}
registerCommand('/today', function (ctx) {
  var trip = tgCmdCurrent(ctx);
  if (!trip) return;
  var today = tgTripToday(trip), day = tgDigestDay(trip.slug, today), head = tgCmdTodayHeader(trip, today);
  if (day) {
    var msgs = tgCmdDayMessages(trip, day, tgDigestDays(trip.slug).length);
    if (head && msgs.length && msgs[0].html.length + head.length + 1 <= 4000) msgs[0].html = head + '\n' + msgs[0].html;
    else if (head) msgs.unshift({ html: head });
    tgCmdSendAll(ctx.chatId, msgs);
    return;
  }
  var pre = head ? head + '\n' : '';
  var days = tgDigestDays(trip.slug);
  if (!days.length) { ctx.reply(pre + 'No day plan for ' + tgCmdTitle(trip) + ' yet.'); return; }
  if (today < days[0].date) {
    var n = tgCmdDaysBetween(today, days[0].date);
    ctx.reply(pre + tgCmdTitle(trip) + ' starts ' + tgCmdDate(days[0].date) + ' (in ' + n + ' day' + (n === 1 ? '' : 's') + ') — /day 1');
  } else ctx.reply(pre + tgCmdTitle(trip) + ' ended ' + tgCmdDate(days[days.length - 1].date) + '. How was it? /review');
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
  var p = safeJsonParse(settingGet(TG_CMD_PLACES_LAST, '[]')), list = p.ok && Array.isArray(p.value) ? p.value : [];
  if (key.charAt(0) !== '.') {
    // A plain key is a slug this bot offered: a place in the repository, or one of the last /place · /places answer
    // (a plan stop that has no Places row yet). Any other slug is a forged or stale button (WP-6a, red-team B).
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(key)) return null;
    var known = tgPlacesGet(key);
    if (known) return known;
    return list.indexOf(key) >= 0 ? { slug: key, name: key } : null;
  }
  var m = /^\.(\d+)\.([0-9a-f]{4})$/.exec(key);
  if (!m) return null;
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
    var app = tgCmdAppRows();
    tgCmdSendAll(ctx.chatId, tgCmdMessages(lines, app.length ? tgKeyboard(app) : undefined));
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
  tgCmdSendAll(ctx.chatId, tgCmdMessages(lines2, tgKeyboard(rows.concat(tgCmdAppRows()))));
}, 'the places repository: /places [name, tag or area]');
/** The /places message's app button (WP-9b): [] without APP_SHELL_URL, so the message is unchanged. */
function tgCmdAppRows() {
  if (!getProp(PROP.APP_SHELL_URL)) return [];
  var cur = tgTripCurrent();
  return tgAppRows('places', cur ? cur.slug : '', '📱 Browse in the app');
}

/* ==================== requests ==================== */

/** 'YYYY-MM-DD', 'N' / 'day N', 'today', 'tomorrow' → a date of the trip's plan, or null. */
function tgCmdPlanDate(trip, word) {
  var w = String(word || '').trim().toLowerCase().replace(/^day\s*/, '');
  if (w === 'today') w = tgTripToday(trip);                      // the trip's own day (WP-10a)
  else if (w === 'tomorrow') w = isoDateAdd(tgTripToday(trip), 1);
  var d = tgDigestDay(trip.slug, w);
  return d ? d.date : null;
}
/**
 * What a replan must rebuild (WP-6c R3): the plan always; the brochure too when the trip has one, so the owner never keeps a
 * stale brochure after a day changed. Mirrors the `deliverables` the /plan flow sends (`gas/12_flow_plan.js`).
 */
function tgCmdDeliverables(trip) { return trip && (trip.drive_brochure_pdf || trip.drive_brochure_html) ? ['plan', 'brochure'] : ['plan']; }

registerCommand('/replan', function (ctx) {
  var trip = tgCmdCurrent(ctx);
  if (!trip) return;
  var m = /^(day\s*\d{1,2}|\d{4}-\d{2}-\d{2}|\d{1,2}|today|tomorrow)\b\s*([\s\S]*)$/i.exec(ctx.args || '');
  if (!m) { ctx.reply('Usage: <code>/replan &lt;date or day N&gt; &lt;what to change&gt;</code> — e.g. <code>/replan day 2 more time at the market</code>'); return; }
  var date = tgCmdPlanDate(trip, m[1]);
  if (!date) { ctx.reply('That day is not in the plan of ' + tgCmdTitle(trip) + '. /trip shows its days.'); return; }
  var why = truncate(String(m[2] || '').trim(), 300);
  var payload = { trip: trip.slug, dates: [date], deliverables: tgCmdDeliverables(trip) };
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

/**
 * Where a Drive file sits — the core's driveFileWhere: 'in' (inside the helper's own folder), 'outside' or 'missing'.
 * The brochure id comes from the brain (plan_digest.drive.brochure_pdf) and the script runs as the owner, so without
 * this check a forged id could make the bot attach any other file the owner can open — WP-6a, red-team I.
 */
function tgCmdDriveWhere(fileId) { return driveFileWhere(fileId); }
/** Resend the stored brochure PDF; without one (or when Drive refuses, or the id points outside the helper's folder), ask the brain to build it. */
function tgCmdBrochure(chatId, trip, chat) {
  var where = trip.drive_brochure_pdf ? tgCmdDriveWhere(trip.drive_brochure_pdf) : '';
  if (where === 'outside') auditFail('tg_brochure_outside_root', String(trip.drive_brochure_pdf), { trip: trip.slug });
  if (where === 'in' || where === 'missing') {   // a missing file still goes through tgSendDocument (its document_not_found audit) and falls back below
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
  var text = ctx.args.replace(/\s+/g, ' ').trim(), lodging = { text: text };
  if (text.length > 300) { ctx.reply('🏨 Please keep it under 300 characters (that was ' + text.length + ') — nothing was saved.'); return; }   // WP-6a G
  var n = /(\d{1,2})\s*nights?\b/i.exec(text);
  if (n) lodging.nights = parseInt(n[1], 10);
  tgTripUpsert({ slug: trip.slug, lodging: lodging });
  ctx.reply('🏨 Saved for ' + tgCmdTitle(trip) + ': ' + tgEscape(text) + '\nIt goes with the next research round.');
}, 'where you are staying on the current trip: /lodging <text>');

/**
 * /dates — the current trip's dates and day hours, set from the chat (Phase 8, pilot finding 3): stored on the trip row
 * (dates) and in Settings (hours); every research, plan and replan request then carries them as trip_update, and the
 * routine writes them into the trip file before it works.
 *   /dates · /dates 2027-05-12 [2027-05-14] · /dates hours 09:30 19:00
 */
function tgCmdDatesLine(trip) {
  var h = tgTripHours(trip.slug);
  var d = trip.start ? tgCmdDate(trip.start) + (trip.end && trip.end !== trip.start ? ' → ' + tgCmdDate(trip.end) : '') : 'no dates yet';
  return '📅 ' + tgCmdTitle(trip) + ': ' + d + (h.day_start ? ' · days ' + tgEscape(h.day_start) + '–' + tgEscape(h.day_end) : '');
}
registerCommand('/dates', function (ctx) {
  var trip = tgCmdCurrent(ctx);
  if (!trip) return;
  var a = ctx.args.replace(/\s+/g, ' ').trim();
  var help = 'Change them with <code>/dates 2027-05-12 2027-05-14</code> (one date for a one-day trip) or set the day hours with <code>/dates hours 09:30 19:00</code>.';
  if (!a) { ctx.reply(tgCmdDatesLine(trip) + '\n' + help); return; }
  var hm = /^hours?\s+(\d{1,2}):(\d{2})\s*(?:-|–|to)?\s*(\d{1,2}):(\d{2})$/i.exec(a);
  if (hm) {
    var st = ('0' + hm[1]).slice(-2) + ':' + hm[2], en = ('0' + hm[3]).slice(-2) + ':' + hm[4];
    if (!TG_HHMM_RE.test(st) || !TG_HHMM_RE.test(en)) { ctx.reply('Those are not clock times. ' + help); return; }
    var mins = function (t) { return Number(t.slice(0, 2)) * 60 + Number(t.slice(3)); };
    if (mins(en) - mins(st) < 120) { ctx.reply('The day must end at least two hours after it starts — nothing was saved.'); return; }
    tgTripHoursSet(trip.slug, st, en);
    ctx.reply('🕘 Saved: days of ' + tgCmdTitle(trip) + ' run ' + st + '–' + en + '. The next plan or <code>/replan</code> uses them.');
    return;
  }
  if (/[a-z]/i.test(a.replace(/\bto\b/gi, ''))) { ctx.reply(help); return; }
  var m = a.match(/\d{4}-\d{2}-\d{2}/g) || [];
  if (m.length === 2 && m[1] < m[0]) { ctx.reply('The end date is before the start — send them as <code>start end</code>. Nothing was saved.'); return; }
  var d = tgPlanParseDates(a);
  if (!d) { ctx.reply('I could not read those dates (one or two dates, at most ' + TG_PLAN_SPAN_MAX_DAYS + ' days). Nothing was saved.'); return; }
  var t2 = tgTripUpsert({ slug: trip.slug, start: d.start, end: d.end });
  ctx.reply('📅 Saved. ' + tgCmdDatesLine(t2 || trip).replace(/^📅 /, '') + '\nThe next plan or <code>/replan</code> uses them; the days already planned stay until then.');
}, 'the current trip\'s dates and day hours: /dates [start [end]] · /dates hours 09:30 19:00');

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
  tgOpenKindRequest('replan', { trip: trip.slug, dates: [day.date], promote: [e.place_slug], reason: 'promoted from the Later list', deliverables: tgCmdDeliverables(trip) },
    { text: 'promote ' + e.name + ' onto day ' + day.n, ack: '🔁 Putting <b>' + tgEscape(e.name) + '</b> on day ' + day.n + ' (' + tgCmdDate(day.date) + ') — replanning that day…' });
});

/** rs:<trip key>:<day n>.<i>.<tag> asks to confirm; …:y opens the replan that puts rainy-day option i on that day instead of its stop. */
registerCallback('rs', function (ctx) {
  var trip = tgCmdTripByKey(ctx.parts[0]);
  var m = /^(\d{1,2})\.(\d)\.([0-9a-f]{4})$/.exec(String(ctx.parts[1] || ''));
  var day = trip && m ? tgDigestDays(trip.slug)[parseInt(m[1], 10) - 1] : null;
  var r = day && Array.isArray(day.rain) ? day.rain[parseInt(m[2], 10)] : null;
  var stop = r ? tgCmdRainStop(day, r) : null;
  if (!r || !stop || tgCmdTag(r.slug) !== m[3] || (ctx.parts[2] !== undefined && ctx.parts[2] !== 'y')) { ctx.answer('That day has changed — send /day again.'); return; }
  if (ctx.parts[2] === undefined) {
    ctx.answer('');
    tgSend(ctx.chatId, 'Swap <b>' + tgEscape(r.name) + '</b> in for <b>' + tgEscape(stop.name) + '</b> on day ' + day.n + ' (' + tgCmdDate(day.date) + ')? ' + tgEscape(stop.name) + ' moves to your Later list.',
      { keyboard: tgKeyboard([[{ text: '✅ Swap', data: cbEncode('rs', ctx.parts[0], ctx.parts[1], 'y') }]]) });
    return;
  }
  ctx.answer('Replanning day ' + day.n);
  if (ctx.messageId) tgApi('editMessageReplyMarkup', { chat_id: ctx.chatId, message_id: ctx.messageId, reply_markup: { inline_keyboard: [] } });
  tgOpenKindRequest('replan', { trip: trip.slug, dates: [day.date], promote: [r.slug], demote: [stop.slug], reason: 'rain: ' + truncate(String(r.name), 120) + ' instead', deliverables: tgCmdDeliverables(trip) },
    { text: 'rain swap ' + r.name + ' for ' + stop.name + ' on day ' + day.n, ack: '☔ Putting <b>' + tgEscape(r.name) + '</b> on day ' + day.n + ' instead of <b>' + tgEscape(stop.name) + '</b> — replanning that day…' });
});

/** ps:<place key>:n (full note) · a (add to the current trip's Later list) · c (fresh check). */
registerCallback('ps', function (ctx) {
  if (ctx.parts.length !== 2) { ctx.answer('Unknown button'); return; }   // exact shape (WP-6a B8)
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
