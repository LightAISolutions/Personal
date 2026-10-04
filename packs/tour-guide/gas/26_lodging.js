/**
 * Tour Guide pack — the trip's lodging: dated stays and every /lodging form, the C13 check and trip_update.lodging, the
 * lodging fingerprint and the stale-plan line (WP-13c, Contract C13; sections below), and the re-plan offer.
 *
 * The offer (WP-12r; Phase 10's carried item 3, TG-PHASE-11 §7). After a /lodging change on a trip with stored plan days
 * not yet over, the reply carries two buttons:
 *   🔁 Re-plan N days from <day>   lg:<trip key>:<yyyymmdd>   → request kind `replan` { trip, dates: every stored day from
 *                                  that date (and from the trip's today) on, deliverables, reason: "The lodging changed…" }
 *   Keep the plan                  lg:<trip key>:k            → nothing is sent; the stored plan counts as kept for the
 *                                                                lodging as it is now, so the stale line stops until it changes
 * Either tap edits the message so it cannot be tapped twice. Undated /lodging words are trip-wide, so the days they touch
 * are every planned day from the trip's today on (all of them before the trip); a dated stay touches the planned days from
 * its first night (and the trip's today) on, or from the first night of an earlier stay it replaces. The offer starts at the
 * earliest night any change touched since the stored plan arrived, so a change the owner let pass is not dropped by the next
 * one, and `/lodging` alone repeats the offer while the stale line shows (Phase 13 coordinator). The lodging itself
 * travels in the reason, and since WP-13c (C13) in trip_update.lodging once a dated stay is set. A trip without a
 * plan, or whose days are all over, gets the reply exactly as before. Decisions: helpers/decisions/WP-12r.md, WP-13c.md,
 * TG-PHASE-13.md.
 */
var TG_LG = { MAX_DATES: 31, REASON_MAX: 300, TEXT_MAX: 200, STAYS_MAX: 12, STAY_TEXT_MAX: 200, UNDATED_MAX: 300 };

/* ==================== stays (WP-13c, Contract C13) ====================
 * The trip's lodging: { text, nights?, stays?: [{ text, from, to }], set_at? }. `from` is the first night and `to` the
 * check-out date: a stay covers the nights from … to − 1 (the trip's night rule). `text` and `nights` stay readable by old
 * code: with stays, `text` is one line per stay and `nights` their sum. Once a stay is set, every kind carrying a
 * trip_update sends trip_update.lodging, the whole list (tgLgTripUpdate). The lodging fingerprint (tgLgFp) is
 * lfp1: + the lower-case 8-hex FNV-1a 32-bit of the stays, each "from|to|text" (text lower-cased, whitespace collapsed,
 * trimmed), one per line in from order, joined by "\n", over the UTF-8 bytes; without stays, of the undated text alone
 * (normalised the same way); no lodging → ''. Decisions: helpers/decisions/WP-13c.md.
 */
var TG_LG_DATE = '(\\d{4}-\\d{2}-\\d{2}|today|tomorrow|day\\s*\\d{1,2})';
var TG_LG_ADD_RE = new RegExp('^(?:([\\s\\S]*?)\\s+)?' + TG_LG_DATE + '\\s+(?:to|→|–|-)\\s+' + TG_LG_DATE + '$', 'i');
var TG_LG_REMOVE_RE = new RegExp('^remove(?:\\s+' + TG_LG_DATE + ')?$', 'i');
var TG_LG_USAGE = '<code>/lodging &lt;name&gt; &lt;first night&gt; to &lt;check-out&gt;</code>';
// C13 carries 1–12 stays, so a request never says "no stays": after a clear (or removing the last stay) the routine's
// trip file keeps its stays until new ones arrive, and the reply says so (Phase 13 coordinator, WP-13c REQUEST 1).
var TG_LG_KEEPS = 'The plan keeps using the old stays until you add new ones.';
var TG_LG_HELP = 'Add a stay with ' + TG_LG_USAGE + ' (e.g. <code>/lodging Reed Inn 2027-06-10 to 2027-06-12</code>) · remove one with ' +
  '<code>/lodging remove &lt;first night&gt;</code> · <code>/lodging clear</code> removes them all.';

/** The UTF-8 bytes of a string (lone surrogates as U+FFFD), without TextEncoder (GAS V8). */
function tgLgUtf8(str) {
  var s = String(str), out = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF) {
      var d = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (d >= 0xDC00 && d <= 0xDFFF) { c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00); i++; } else c = 0xFFFD;
    } else if (c >= 0xDC00 && c <= 0xDFFF) c = 0xFFFD;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}
/** FNV-1a 32-bit of a string's UTF-8 bytes → 8 lower-case hex digits. */
function tgLgFnv(str) {
  var h = 0x811c9dc5, b = tgLgUtf8(str);
  for (var i = 0; i < b.length; i++) h = Math.imul(h ^ b[i], 0x01000193) >>> 0;
  return ('0000000' + h.toString(16)).slice(-8);
}
function _tgLgNorm(t) { return String(t || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
/** The trip's lodging object (a JSON string read back too) or null. */
function tgLgOf(trip) {
  var l = trip && trip.lodging;
  if (typeof l === 'string') { var j = safeJsonParse(l); l = j.ok ? j.value : (l ? { text: l } : null); }
  return isPlainObject(l) ? l : null;
}
/** The stored stays, well-formed ones only, in from order. */
function tgLgStays(trip) {
  var l = tgLgOf(trip);
  if (!l || !Array.isArray(l.stays)) return [];
  return l.stays.filter(function (x) {
    return isPlainObject(x) && typeof x.text === 'string' && x.text && tgEnvRealDate(x.from) && tgEnvRealDate(x.to) && x.to > x.from;
  }).map(function (x) { return { text: x.text, from: x.from, to: x.to }; })
    .sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : 0; });
}
function tgLgNights(s) { return tgCmdDaysBetween(s.from, s.to) || 0; }
function _tgLgN(n) { return n + ' night' + (n === 1 ? '' : 's'); }
/** The lodging fingerprint the core holds now: 'lfp1:xxxxxxxx', or '' with no lodging. */
function tgLgFp(trip) {
  var stays = tgLgStays(trip), l = tgLgOf(trip);
  if (stays.length) return 'lfp1:' + tgLgFnv(stays.map(function (x) { return x.from + '|' + x.to + '|' + _tgLgNorm(x.text); }).join('\n'));
  var t = l ? _tgLgNorm(l.text) : '';
  return t ? 'lfp1:' + tgLgFnv(t) : '';
}
/** One line per stay, for old code and the research request: "Reed Inn: 2 nights, 2027-06-10 to 2027-06-12; …". */
function tgLgSummary(stays) {
  return stays.map(function (x) { return x.text + ': ' + _tgLgN(tgLgNights(x)) + ', ' + x.from + ' to ' + x.to; }).join('; ');
}
/** A stay for the chat, escaped: "Reed Inn · Thu 10 Jun → Sat 12 Jun (2 nights)". */
function tgLgStayLine(x) {
  return tgEscape(x.text) + ' · ' + tgCmdDate(x.from) + ' → ' + tgCmdDate(x.to) + ' (' + _tgLgN(tgLgNights(x)) + ')';
}
/** The stay for the night of `date` (from ≤ date < to), else null. */
function tgLgStayOn(trip, date) {
  return tgLgStays(trip).filter(function (x) { return x.from <= date && date < x.to; })[0] || null;
}
/** C13 check of a trip_update.lodging list → [] when valid, else the errors. */
function tgLgCheck(list) {
  var errs = [];
  if (!Array.isArray(list)) return ['lodging: array required'];
  if (list.length < 1 || list.length > TG_LG.STAYS_MAX) errs.push('lodging: 1–' + TG_LG.STAYS_MAX + ' stays');
  list.forEach(function (x, i) {
    var at = 'lodging[' + i + ']';
    if (!isPlainObject(x)) { errs.push(at + ': object required'); return; }
    Object.keys(x).forEach(function (k) { if (['text', 'from', 'to'].indexOf(k) < 0) errs.push(at + '.' + k + ': unknown key'); });
    if (typeof x.text !== 'string' || x.text.length < 1 || x.text.length > TG_LG.STAY_TEXT_MAX) errs.push(at + '.text: 1–' + TG_LG.STAY_TEXT_MAX + ' characters');
    if (!tgEnvRealDate(x.from)) errs.push(at + '.from: a real YYYY-MM-DD date');
    if (!tgEnvRealDate(x.to)) errs.push(at + '.to: a real YYYY-MM-DD date');
    else if (tgEnvRealDate(x.from) && !(x.to > x.from)) errs.push(at + '.to: after from');
    var prev = i > 0 && isPlainObject(list[i - 1]) ? list[i - 1] : null;
    if (prev && typeof prev.from === 'string' && typeof x.from === 'string') {
      if (!(x.from > prev.from)) errs.push(at + '.from: sorted by from');
      else if (typeof prev.to === 'string' && x.from < prev.to) errs.push(at + ': nights overlap lodging[' + (i - 1) + ']');
    }
  });
  return errs;
}
/** trip_update.lodging: the whole list once a stay is set, else null (absent → the trip file's lodging is untouched). */
function tgLgTripUpdate(trip) {
  var stays = tgLgStays(trip);
  return stays.length && !tgLgCheck(stays).length ? stays : null;
}
/** The trip's nights (start … end − 1); [] without dates. */
function tgLgTripNights(trip) {
  if (!trip || !tgEnvRealDate(trip.start)) return [];
  var end = tgEnvRealDate(trip.end) ? trip.end : trip.start, out = [];
  for (var d = trip.start; d < end && out.length < 400; d = isoDateAdd(d, 1)) out.push(d);
  return out;
}
/** Runs of dates → "Sat 12 Jun" / "Sat 12 Jun–Mon 14 Jun", joined by ", ". */
function _tgLgRuns(dates) {
  var runs = [];
  dates.forEach(function (d) {
    var r = runs[runs.length - 1];
    if (r && isoDateAdd(r[1], 1) === d) r[1] = d; else runs.push([d, d]);
  });
  return runs.map(function (r) { return r[0] === r[1] ? tgCmdDate(r[0]) : tgCmdDate(r[0]) + '–' + tgCmdDate(r[1]); }).join(', ');
}
/** Store the stays (or none): text and nights for old code, set_at now → the trip read back. */
function tgLgSave(trip, stays) {
  var nights = stays.reduce(function (a, x) { return a + tgLgNights(x); }, 0), lodging = { text: tgLgSummary(stays), stays: stays, set_at: nowIso() };
  if (nights) lodging.nights = nights;
  tgTripUpsert({ slug: trip.slug, lodging: lodging });
  return tgTripGet(trip.slug);
}
/** A date word of /lodging: YYYY-MM-DD, today, tomorrow (the trip's own day), day N (N = 1 is the trip's first day). */
function tgLgDateWord(trip, w) {
  w = String(w || '').toLowerCase().replace(/\s+/g, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(w)) return tgEnvRealDate(w) ? w : null;
  if (w === 'today') return tgTripToday(trip);
  if (w === 'tomorrow') return isoDateAdd(tgTripToday(trip), 1);
  var m = /^day(\d{1,2})$/.exec(w);
  return m && +m[1] >= 1 && tgEnvRealDate(trip.start) ? isoDateAdd(trip.start, +m[1] - 1) : null;
}
function _tgLgBadDate(trip, w) {
  return /^day\s*\d/i.test(w) && !tgEnvRealDate(trip.start)
    ? '🏨 <code>' + tgEscape(w) + '</code> needs the trip\'s dates first: <code>/dates 2027-05-12 2027-05-14</code> — nothing was saved.'
    : '🏨 <code>' + tgEscape(w) + '</code> is not a date I know: use YYYY-MM-DD, today, tomorrow or day N — nothing was saved.';
}
/** /lodging alone: the stays with their nights, the trip nights no stay covers, any stay outside the trip's dates. */
function tgLgList(trip) {
  var stays = tgLgStays(trip), l = tgLgOf(trip);
  if (!stays.length) {
    return l && l.text ? 'Staying: ' + tgEscape(l.text) + '\nChange it with <code>/lodging &lt;where&gt;</code>.'
      : 'Where are you staying? <code>/lodging &lt;name, area or address&gt;</code>';
  }
  var nights = tgLgTripNights(trip), hasDates = tgEnvRealDate(trip.start), end = tgEnvRealDate(trip.end) ? trip.end : trip.start;
  var lines = ['🏨 <b>Stays for ' + tgCmdTitle(trip) + '</b>'];
  stays.forEach(function (x) {
    var out = hasDates && (x.from < trip.start || x.to > end);
    lines.push('• ' + tgLgStayLine(x) + (out ? ' — ⚠️ outside the trip\'s dates' : ''));
  });
  var open = nights.filter(function (d) { return !stays.some(function (x) { return x.from <= d && d < x.to; }); });
  if (open.length) lines.push('No stay yet for the night' + (open.length === 1 ? '' : 's') + ' of ' + _tgLgRuns(open) + '.');
  else if (nights.length) lines.push('Every night of the trip has a stay.');
  lines.push(TG_LG_HELP);
  return lines.join('\n');
}
function _tgLgSend(ctx, said, offer) { ctx.reply(said + (offer ? '\n' + offer.line : ''), offer ? { keyboard: offer.keyboard } : undefined); }
/** /lodging alone: the list, and while the stored plan is stale the re-plan offer again — the stale line points here. */
function _tgLgListReply(ctx, trip) { _tgLgSend(ctx, tgLgList(trip), tgLgPlanStale(trip) ? tgLgOffer(trip, tgLgChangedFrom(trip)) : null); }
/** The earliest first night of some stays, else ''. */
function _tgLgEarliest(list) { return list.map(function (x) { return x.from; }).sort()[0] || ''; }
/** The /lodging command: every form (TG_LG_HELP); the undated form behaves as before while no stay is set. */
function tgLgCmd(ctx, trip) {
  var a = String(ctx.args || '').trim(), stays = tgLgStays(trip), l = tgLgOf(trip), cur;
  if (!a) { _tgLgListReply(ctx, trip); return; }
  if (/^clear$/i.test(a)) {
    if (!stays.length && !(l && l.text)) { ctx.reply('🏨 No lodging is saved for ' + tgCmdTitle(trip) + '.'); return; }
    tgLgSave(trip, []);
    tgLgNoteChange(trip, _tgLgEarliest(stays));   // the next stay's offer covers the nights cleared here
    ctx.reply('🏨 Cleared the lodging of ' + tgCmdTitle(trip) + '. ' + TG_LG_KEEPS + ' Add a stay with ' + TG_LG_USAGE + '.');
    return;
  }
  var rm = TG_LG_REMOVE_RE.exec(a);
  if (rm) {
    if (!rm[1]) { ctx.reply('🏨 Which stay? <code>/lodging remove &lt;first night&gt;</code> — /lodging lists them.'); return; }
    var day = tgLgDateWord(trip, rm[1]);
    if (!day) { ctx.reply(_tgLgBadDate(trip, rm[1]).replace('saved', 'removed')); return; }
    var hit = stays.filter(function (x) { return x.from === day; })[0];
    if (!hit) { ctx.reply('🏨 No stay starts on ' + tgCmdDate(day) + ' — nothing was removed. /lodging lists them.'); return; }
    cur = tgLgSave(trip, stays.filter(function (x) { return x !== hit; }));
    var left = tgLgStays(cur).length, offer = tgLgChanged(cur, hit.from);   // noted even with no stay left, for the next one
    _tgLgSend(ctx, '🏨 Removed ' + tgLgStayLine(hit) + '.' + (left ? '' : ' ' + TG_LG_KEEPS), left ? offer : null);
    return;
  }
  var m = TG_LG_ADD_RE.exec(a);
  if (m) {
    var text = stripHidden(m[1] || '').replace(/\s+/g, ' ').trim();
    if (!text) { ctx.reply('🏨 Which lodging? ' + TG_LG_USAGE + ' — nothing was saved.'); return; }
    if (text.length > TG_LG.STAY_TEXT_MAX) { ctx.reply('🏨 Please keep a stay under ' + TG_LG.STAY_TEXT_MAX + ' characters (that was ' + text.length + ') — nothing was saved.'); return; }
    var from = tgLgDateWord(trip, m[2]), to = tgLgDateWord(trip, m[3]);
    if (!from) { ctx.reply(_tgLgBadDate(trip, m[2])); return; }
    if (!to) { ctx.reply(_tgLgBadDate(trip, m[3])); return; }
    if (!(to > from)) { ctx.reply('🏨 The check-out date must come after the first night (' + tgCmdDate(from) + ' → ' + tgCmdDate(to) + ') — nothing was saved.'); return; }
    var stay = { text: text, from: from, to: to };
    var gone = stays.filter(function (x) { return x.from < to && from < x.to; });
    var keep = stays.filter(function (x) { return gone.indexOf(x) < 0; }).concat([stay]).sort(function (p, q) { return p.from < q.from ? -1 : 1; });
    if (keep.length > TG_LG.STAYS_MAX) { ctx.reply('🏨 A trip holds at most ' + TG_LG.STAYS_MAX + ' stays — remove one with <code>/lodging remove &lt;first night&gt;</code> first. Nothing was saved.'); return; }
    var undated = !stays.length && l && l.text ? String(l.text) : '';
    cur = tgLgSave(trip, keep);
    var said = '🏨 Saved for ' + tgCmdTitle(trip) + ': ' + tgLgStayLine(stay) + '.';
    if (gone.length) said += '\nIt replaces ' + gone.map(tgLgStayLine).join('; ') + '.';
    else if (undated) said += '\nIt replaces “' + tgEscape(truncate(undated, TG_LG.TEXT_MAX)) + '”.';
    // A replaced stay that began earlier leaves its first nights without that stay: they are touched too.
    _tgLgSend(ctx, said + '\nIt goes with the next research round. /lodging lists your stays.', tgLgChanged(cur, _tgLgEarliest(gone.concat([stay]))));
    return;
  }
  if (stays.length) {
    ctx.reply('🏨 ' + tgCmdTitle(trip) + ' has dated stays, so a stay needs its nights: ' + TG_LG_USAGE + '. To start over, <code>/lodging clear</code> removes them all — nothing was saved.');
    return;
  }
  // The undated form, as before (WP-6a G: under 300 characters); it now strips hidden characters and records set_at.
  var words = stripHidden(a).replace(/\s+/g, ' ').trim(), lodging = { text: words, set_at: nowIso() };
  if (words.length > TG_LG.UNDATED_MAX) { ctx.reply('🏨 Please keep it under ' + TG_LG.UNDATED_MAX + ' characters (that was ' + words.length + ') — nothing was saved.'); return; }
  if (!words) { _tgLgListReply(ctx, trip); return; }
  var n = /(\d{1,2})\s*nights?\b/i.exec(words);
  if (n) lodging.nights = parseInt(n[1], 10);
  tgTripUpsert({ slug: trip.slug, lodging: lodging });
  _tgLgSend(ctx, '🏨 Saved for ' + tgCmdTitle(trip) + ': ' + tgEscape(words) + '\nIt goes with the next research round.', tgLgChanged(tgTripGet(trip.slug), ''));   // WP-12r; trip-wide
}

/** The stored plan days a lodging change touches: the dates from max(from, the trip's today) on, in order. */
function tgLgDates(trip, from) {
  if (!trip || typeof tgDigestDays !== 'function') return [];
  var today = tgTripToday(trip), lo = from && from > today ? from : today;
  return tgDigestDays(trip.slug).map(function (d) { return d.date; }).filter(function (d) { return d >= lo; }).slice(0, TG_LG.MAX_DATES);
}
function _tgLgCount(n) { return n + ' day' + (n === 1 ? '' : 's'); }
/** The offer under the /lodging reply, for the planned days from `from` (default: the trip's today) on: { line, keyboard } or null. */
function tgLgOffer(trip, from) {
  var dates = tgLgDates(trip, from);
  if (!dates.length) return null;
  var tk = tgCmdTripKey(trip.slug);
  return {
    line: '🔁 The plan still starts and ends ' + (dates.length === 1 ? 'that day' : 'those days') + ' at the old lodging: re-plan ' +
      _tgLgCount(dates.length) + ' from ' + tgCmdDate(dates[0]) + '?',
    keyboard: tgKeyboard([[{ text: '🔁 Re-plan ' + _tgLgCount(dates.length) + ' from ' + tgCmdDate(dates[0]), data: cbEncode('lg', tk, dates[0].replace(/-/g, '')) }],
      [{ text: 'Keep the plan', data: cbEncode('lg', tk, 'k') }]])
  };
}
/** A /lodging change touched the stored plan from `from` on ('' = trip-wide, from the trip's today): note it
 *  (tgLgNoteChange), then the offer for every day any change touched since the plan arrived. */
function tgLgChanged(trip, from) {
  tgLgNoteChange(trip, from);
  return tgLgOffer(trip, tgLgChangedFrom(trip) || from);
}
/** The replan request for a lodging change, from `date` on — or from an earlier night a later change touched (an old
 *  offer tapped after another change) → the request, or a word for the owner (a string). */
function tgLgAsk(trip, date) {
  var text = trip.lodging && trip.lodging.text ? String(trip.lodging.text) : '';
  if (!text) return 'No lodging is saved — /lodging <where>.';
  var lo = tgLgChangedFrom(trip), dates = tgLgDates(trip, lo && lo < date ? lo : date);
  if (!dates.length) return 'Those days are over.';
  var reason = truncate('The lodging changed: ' + truncate(typeof tgCmdLodgingText === 'function' ? tgCmdLodgingText(trip) : text, TG_LG.TEXT_MAX) +
    '. Re-plan these days to start and end there.', TG_LG.REASON_MAX);
  return { dates: dates, req: tgOpenKindRequest('replan', { trip: trip.slug, dates: dates, deliverables: tgCmdDeliverables(trip), reason: reason },
    { text: 'lodging changed · re-plan ' + dates.length + ' day' + (dates.length === 1 ? '' : 's') }) };
}

registerCallback('lg', function (ctx) {
  var p = ctx.parts;
  if (p.length !== 2 || !(p[1] === 'k' || /^\d{8}$/.test(String(p[1])))) { ctx.answer('Unknown button'); return; }
  var trip = tgCmdTripByKey(p[0]);
  if (!trip) { ctx.answer('That trip is gone.'); return; }
  var head = '🏨 ' + tgCmdTitle(trip) + (trip.lodging && trip.lodging.text ? ': ' + tgEscape(truncate(trip.lodging.text, TG_LG.TEXT_MAX)) : '');
  if (p[1] === 'k') {
    tgLgKeep(trip);
    ctx.answer('Kept');
    ctx.edit(head + '\nThe plan stays as it is; /replan changes one day.');
    return;
  }
  var date = tgLateDate8(p[1]);
  if (!tgEnvRealDate(date)) { ctx.answer('Unknown button'); return; }
  var r = tgLgAsk(trip, date);
  if (typeof r === 'string') { ctx.answer(r, true); return; }
  ctx.answer('Re-planning');
  ctx.edit(head + '\n🔁 Re-planning ' + _tgLgCount(r.dates.length) + ' from ' + tgCmdDate(r.dates[0]) + ' for the new lodging. It runs in the background; the day cards update when the new plan is ready.');
});

/* ==================== fingerprints and stale plans (WP-13c, C13) ====================
 * Every plan and replan request carries lodging_fp (stamped in tgOpenKindRequest); the id → fp pair is kept in Settings
 * tg_req_lodging (the last 60) so a digest answering it can be matched without reading the mailbox. A stored plan keeps
 * its fp in Settings tg_plan_lodging { <trip slug>: { fp, at } } (a digest replaces every stored day of its trip): the
 * digest's own lodging_fp, else the one kept for the request it answers, else '' with its arrival time.
 * The stale rule: an fp that differs from the trip's current one → stale. Neither fp → stale only when the lodging's set_at
 * is later than the digest's arrival; a digest stored before this phase has no record and arrived before any set_at
 * (set_at is written from this phase on); a lodging without set_at → no line. The line shows only while a stored day is
 * still to come. No lodging at all (after a clear) → no line: C13 never sends "no stays", so a rebuild would use the stays
 * the routine already has, and the clear's reply says the plan keeps them (Phase 13 coordinator, WP-13c REQUEST 1).
 * The Phase 13 coordinator's probe added (decisions/TG-PHASE-13.md): /replan rebuilds one day, so the line points at
 * /lodging, whose offer re-plans every day a change touched. The plan's record also keeps `changed` (the earliest night a
 * change touched since the plan arrived; tgLgNoteChange) and `kept` (the fingerprint the owner kept the plan for: "Keep
 * the plan" → no line until the lodging changes again). A replan that leaves out some of the touched days while the plan
 * is stale carries the stored plan's own fingerprint (tgLgStampFp), so its digest does not clear the line; a digest still
 * built for the same lodging as the record keeps `changed` and `kept`.
 */
var TG_LG_FP_RE = /^lfp1:[0-9a-f]{8}$/;
var TG_LG_KEYS = { REQ: 'tg_req_lodging', PLAN: 'tg_plan_lodging', REQ_KEEP: 60 };
function _tgLgMap(key) { var v = tgShJson(settingGet(key, ''), null); return isPlainObject(v) ? v : {}; }
function _tgLgPlanSave(m) { settingSet(TG_LG_KEYS.PLAN, toJson(m), 'the lodging fingerprint each stored plan was built for (WP-13c)'); }
/** Keep the fp a plan or replan request was sent with (the newest 60). */
function tgLgReqRemember(id, fp) {
  if (!id || !TG_LG_FP_RE.test(String(fp || ''))) return;
  var m = _tgLgMap(TG_LG_KEYS.REQ), k = String(id);
  delete m[k];
  m[k] = fp;
  var keys = Object.keys(m);
  while (keys.length > TG_LG_KEYS.REQ_KEEP) delete m[keys.shift()];
  settingSet(TG_LG_KEYS.REQ, toJson(m), 'the lodging fingerprint each plan / replan request was sent with (WP-13c)');
}
/** The fp kept for a request id, else ''. */
function tgLgReqFp(id) {
  var v = id ? _tgLgMap(TG_LG_KEYS.REQ)[String(id)] : '';
  return typeof v === 'string' && TG_LG_FP_RE.test(v) ? v : '';
}
/** A plan_digest was stored: remember the fp it was built for (its own, else its request's, else '') and when it arrived. */
function tgLgOnDigest(p, inReplyTo) {
  var slug = String(p && p.trip || '');
  if (!slug) return null;
  var own = typeof p.lodging_fp === 'string' && TG_LG_FP_RE.test(p.lodging_fp) ? p.lodging_fp : '';
  var rec = { fp: own || tgLgReqFp(inReplyTo), at: nowIso() }, m = _tgLgMap(TG_LG_KEYS.PLAN), prev = m[slug];
  // Still built for the same lodging (a replan that left touched days out, a request sent before a change): the change
  // waiting for the plan and the owner's keep still hold.
  if (rec.fp && isPlainObject(prev) && prev.fp === rec.fp) {
    if (tgEnvRealDate(prev.changed)) rec.changed = prev.changed;
    if (typeof prev.kept === 'string' && TG_LG_FP_RE.test(prev.kept)) rec.kept = prev.kept;
  }
  m[slug] = rec;
  _tgLgPlanSave(m);
  return rec;
}
/** A lodging change touched the stored plan from `from` on ('' → the trip's today): the plan's record keeps the earliest
 *  such night until the next plan arrives or the owner keeps the plan. No record (no plan, or one stored before Phase 13)
 *  → nothing to note: the offer then starts where the change does, as before. */
function tgLgNoteChange(trip, from) {
  if (!trip || !trip.slug) return;
  var m = _tgLgMap(TG_LG_KEYS.PLAN), rec = m[trip.slug], d = tgEnvRealDate(from) ? from : tgTripToday(trip);
  if (!isPlainObject(rec) || (tgEnvRealDate(rec.changed) && rec.changed <= d)) return;
  rec.changed = d;
  _tgLgPlanSave(m);
}
/** The earliest night a lodging change touched since the stored plan arrived (or was kept), else ''. */
function tgLgChangedFrom(trip) {
  var rec = trip ? _tgLgMap(TG_LG_KEYS.PLAN)[trip.slug] : null;
  return isPlainObject(rec) && tgEnvRealDate(rec.changed) ? rec.changed : '';
}
/** "Keep the plan": the stored plan counts as kept for the lodging as it is now, so the line stops until the lodging
 *  changes again; the change waiting for it is dropped. Nothing is sent. → whether a plan was kept. */
function tgLgKeep(trip) {
  var cur = trip ? tgLgFp(trip) : '';
  if (!cur || !tgLgNextPlanned(trip)) return false;
  var m = _tgLgMap(TG_LG_KEYS.PLAN), rec = isPlainObject(m[trip.slug]) ? m[trip.slug] : { fp: '', at: nowIso() };
  rec.kept = cur;
  delete rec.changed;
  m[trip.slug] = rec;
  _tgLgPlanSave(m);
  return true;
}
/** The first stored plan date still to come (the trip's today or later), else ''. */
function tgLgNextPlanned(trip) {
  var today = tgTripToday(trip);
  return (tgDigestDays(trip.slug).map(function (d) { return d.date; }).filter(function (d) { return d >= today; })[0]) || '';
}
/** C13's stale rule for the trip's stored plan (false when no stored day is still to come). */
function tgLgPlanStale(trip) {
  if (!trip || !tgLgNextPlanned(trip)) return false;
  var rec = _tgLgMap(TG_LG_KEYS.PLAN)[trip.slug], l = tgLgOf(trip), cur = tgLgFp(trip);
  rec = isPlainObject(rec) ? rec : null;
  if (!cur || (rec && rec.kept === cur)) return false;
  var fp = rec && typeof rec.fp === 'string' && TG_LG_FP_RE.test(rec.fp) ? rec.fp : '';
  if (fp) return fp !== cur;
  var setAt = l && typeof l.set_at === 'string' ? Date.parse(l.set_at) : NaN;
  if (isNaN(setAt)) return false;
  if (!rec) return true;
  var at = Date.parse(String(rec.at || ''));
  return !isNaN(at) && setAt > at;
}
/** The line /trip, each planned day's card and the morning message show while the plan is stale, else ''. */
function tgLgStaleLine(trip) {
  if (!tgLgPlanStale(trip)) return '';
  return '⚠️ This plan was built for different lodging. <code>/lodging</code> offers to re-plan the days that changed or to keep the plan.';
}
/** The fingerprint a plan or replan request carries (stamped in tgOpenKindRequest): the current one — except a replan
 *  that leaves out some of the days a lodging change touched while the stored plan is stale, which carries the stored
 *  plan's own, so the digest answering it does not clear the line while those days still start and end at the old
 *  lodging. A plan without a fingerprint of its own (stored before Phase 13) has none to carry. */
function tgLgStampFp(trip, kind, payload) {
  var cur = trip ? tgLgFp(trip) : '';
  if (!cur || kind !== 'replan' || !tgLgPlanStale(trip)) return cur;
  var rec = _tgLgMap(TG_LG_KEYS.PLAN)[trip.slug];
  var old = isPlainObject(rec) && typeof rec.fp === 'string' && TG_LG_FP_RE.test(rec.fp) ? rec.fp : '';
  if (!old) return cur;
  var got = payload && Array.isArray(payload.dates) ? payload.dates.map(String) : [];
  return tgLgDates(trip, tgLgChangedFrom(trip)).every(function (d) { return got.indexOf(d) >= 0; }) ? cur : old;
}

// Developed by: LightAISolutions
