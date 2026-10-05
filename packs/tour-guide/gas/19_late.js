/**
 * Tour Guide pack — "running late" (WP-12b, TG-PHASE-12 §4): /late <5–240> [date] and the ⏰ buttons move the rest of
 * today later, at once, without a routine and without touching the stored day.
 *   Overlay  Settings tg_late { "<trip>|<date>": { taps: [{ t: 'HH:MM', m }], base: <12 hex of the stored day>, at } }.
 *            Taps add up. tgLateView(trip, day) applies the taps whenever the day is shown (/today, the day card, the
 *            morning message, the evening check-in); a stored day that changed since (a new digest) no longer matches
 *            `base`, and tgLateOnDigest drops the overlay as the digest is stored. ↩️ Undo deletes it.
 *   Moves    at the tap's trip-local time every stop, meal and leg not yet ended moves later; fixed items stay: a stop or
 *            dinner booked in the core's bookings (status booked, its place, that date), a stop whose time_style is
 *            "exact", and the day's own end (end.time, or the day's hours). Nothing moves earlier.
 *   Drops    a moved stop now starting after its own last_entry, ending after its own close, or (with the leg's minutes)
 *            running into the next fixed item or the day's end; each with its reason. A stop without its own hours keeps
 *            its slot with "check the hours"; the legs around a dropped stop join into one leg with its stations (when
 *            both ends have them) and "travel time not recalculated".
 *   Buttons  rl:<trip key>:<yyyymmdd>:<15|30|60|u> (u = Undo); a date other than the trip's today is a rehearsal: shown,
 *            headed "Rehearsal", never saved, with the time of day now standing in for the tap's time.
 * Defaults: helpers/decisions/WP-12b.md.
 */
var TG_LATE = {
  SETTING: 'tg_late',
  MIN: 5, MAX: 240,       // /late minutes
  TAPS_MAX: 20,           // taps kept per day; after that a re-plan is the better tool
  KEEP_DAYS: 3,           // overlays of dates older than this (home date) are pruned
  DINNER_MIN: 60,         // a dinner without its own end counts this long
  BUTTONS: [15, 30, 60]
};

/* ---------------- small helpers ---------------- */
function _tgLateMin(t) { return tgCmdDayClock(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null; }
function _tgLateHm(m) { m = Math.max(0, Math.min(1439, m)); var h = Math.floor(m / 60), mm = m % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }
function tgLateD8(date) { return String(date).replace(/-/g, ''); }
function tgLateDate8(d8) { return /^\d{8}$/.test(String(d8)) ? d8.slice(0, 4) + '-' + d8.slice(4, 6) + '-' + d8.slice(6) : ''; }
/** The trip-local wall clock now, 'HH:MM'. */
function tgLateNowHm(trip) { return Utilities.formatDate(nowDate(), tgTripTz(trip), 'HH:mm'); }
/** A fingerprint of what running late reads from a stored day (a new digest that changes it voids the overlay). */
function tgLateBase(day) {
  return sha1Hex(toJson({ stops: day.stops || [], legs: day.legs || [], dinner: day.dinner || null, end: day.end || null })).slice(0, 12);
}
function _tgLateAll() { var v = tgShJson(settingGet(TG_LATE.SETTING, ''), {}); return isPlainObject(v) ? v : {}; }
function _tgLateSave(all) {
  var keep = isoDateAdd(isoDateIn(getTz()), -TG_LATE.KEEP_DAYS);
  Object.keys(all).forEach(function (k) { if (String(k.split('|')[1] || '') < keep) delete all[k]; });
  settingSet(TG_LATE.SETTING, toJson(all), 'running-late overlays (trip|date → taps)');
}
/** The stored overlay of one day, or null. */
function tgLateGet(slug, date) {
  var e = _tgLateAll()[slug + '|' + date];
  return isPlainObject(e) && Array.isArray(e.taps) ? e : null;
}

/* ---------------- what stays put ---------------- */
/** Slugs booked in the core's bookings for that date (status booked, a place, for that date or no date). */
function tgLateBooked(slug, date) {
  var out = {};
  if (typeof tgBkAll !== 'function') return out;
  tgBkAll(slug).forEach(function (b) {
    if (b.status === 'booked' && typeof b.rec.place === 'string' && b.rec.place && (!b.rec.for_date || b.rec.for_date === date)) out[b.rec.place] = true;
  });
  return out;
}
/** The day's own end: its end anchor's time (a departure), else the day's hours (that date's, then the trip's); or null. */
function tgLateDayEnd(trip, day) {
  if (tgCmdDayAnchorOk(day.end) && tgCmdDayClock(day.end.time)) return { start: _tgLateMin(day.end.time), slug: 'day-end', reason: 'the ' + day.end.time + ' departure' };
  var per = typeof tgTripDay === 'function' ? tgTripDay(trip.slug, day.date) : null, h = typeof tgTripHours === 'function' ? tgTripHours(trip.slug) : {};
  var e = per && per.day_end ? per.day_end : h && h.day_end;
  return tgCmdDayClock(e) ? { start: _tgLateMin(e), slug: null, reason: "the day's end " + e } : null;
}
/**
 * Minutes from a stop to `toSlug` along the day's legs: the legs from the stop onward are summed while they chain (a stop
 * → lodging → dinner), stopping at `toSlug`; a chain that reaches another stop first, or no `toSlug`, counts the first leg.
 */
function tgLateLegTo(legs, stopSlugs, fromSlug, toSlug) {
  var i = -1, k;
  for (k = 0; k < legs.length; k++) if (legs[k] && legs[k].from === fromSlug) { i = k; break; }
  if (i < 0) return 0;
  var first = Number(legs[i].minutes) || 0, sum = 0;
  for (k = i; k < legs.length && k < i + 4; k++) {
    var l = legs[k];
    if (!l || (k > i && l.from !== legs[k - 1].to)) break;
    sum += Number(l.minutes) || 0;
    if (!toSlug || l.to === toSlug) return toSlug ? sum : first;
    if (stopSlugs[l.to]) return first;
  }
  return first;
}
/** Why a moved stop no longer fits ('' when it does). b: its planned minutes { a, d }; c: now. */
function tgLateWhy(s, b, c, fixed, legTo) {
  var le = _tgLateMin(s.last_entry), cl = _tgLateMin(s.close);
  if (le !== null && c.a > le && b.a <= le) return 'last entry ' + s.last_entry;
  if (cl !== null && c.d > cl && b.d <= cl) return 'closes ' + s.close;
  if (c.d > 1439) return 'past midnight';
  for (var i = 0; i < fixed.length; i++) {
    var F = fixed[i];
    if (F.start < b.d || F.slug === s.slug) continue;
    var leg = legTo(s.slug, F.slug);
    return b.d + leg <= F.start && c.d + leg > F.start ? F.reason : '';   // only the nearest fixed item; a stop that never fit is left alone
  }
  return '';
}
/**
 * The mode of a joined leg: the one that reaches farthest (WP-12r, found by the rehearsal: a train leg then a short walk
 * joined into "walk" between two towns). A train stays a train, then a drive; two walks stay a walk.
 */
var TG_LATE_JOIN_ORDER = ['TRANSIT', 'DRIVE'];
function tgLateJoinMode(a, b) {
  for (var i = 0; i < TG_LATE_JOIN_ORDER.length; i++) if (a === TG_LATE_JOIN_ORDER[i] || b === TG_LATE_JOIN_ORDER[i]) return TG_LATE_JOIN_ORDER[i];
  return a === b ? a : b;
}
/** Join the legs around a dropped stop into one: stations when both ends have them, "travel time not recalculated". */
function tgLateJoin(legs, slug) {
  var i = -1, j = -1;
  for (var k = 0; k < legs.length; k++) {
    if (i < 0 && legs[k] && legs[k].to === slug) i = k;
    if (j < 0 && legs[k] && legs[k].from === slug) j = k;
  }
  if (i < 0 && j < 0) return;
  if (i < 0 || j < 0) { legs.splice(i < 0 ? j : i, 1); return; }
  var a = legs[i], b = legs[j], st = null;
  if (isPlainObject(a.stations) && isPlainObject(b.stations)) {
    st = { from: a.stations.from, to: b.stations.to };
    if (a.stations.from_line) st.from_line = a.stations.from_line;
    if (b.stations.to_line) st.to_line = b.stations.to_line;
  }
  var jl = { from: a.from, to: b.to, mode: st ? 'TRANSIT' : tgLateJoinMode(a.mode, b.mode), joined: true };
  if (st) jl.stations = st;
  if (j > i) { legs[i] = jl; legs.splice(j, 1); } else { legs.splice(j, 1); legs[i - 1] = jl; }
}

/* ---------------- the overlay applied ---------------- */
/**
 * The day with taps applied (a copy; the stored day is never changed): moved stops carry late_moved (and late_check when
 * they have no hours of their own), fixed ones after the first tap late_fixed; dropped stops are gone; day.late =
 * { minutes, from, taps, moved, dropped: [{ n, slug, name, reason }] }. Taps outside the bounds are ignored.
 */
function tgLateCompute(trip, day, taps) {
  var p = safeJsonParse(toJson(day)), out = p.ok && isPlainObject(p.value) ? p.value : null;
  if (!out) return day;
  var stops = Array.isArray(out.stops) ? out.stops : [], legs = Array.isArray(out.legs) ? out.legs.slice() : [];
  var booked = tgLateBooked(trip.slug, day.date), stopSlugs = {};
  stops.forEach(function (s) { stopSlugs[s.slug] = true; });
  var base = stops.map(function (s) { return { a: _tgLateMin(s.arrive), d: _tgLateMin(s.depart) }; });
  var cur = base.map(function (b) { return { a: b.a, d: b.d }; });
  var st = stops.map(function () { return { moved: false, dropped: '', fixed: false }; });
  var fixed = [];
  stops.forEach(function (s, i) {
    if (base[i].a === null) return;
    if (booked[s.slug]) fixed.push({ start: base[i].a, slug: s.slug, reason: 'your ' + s.arrive + ' ' + String(s.name) + ' booking' });
    else if (s.time_style === 'exact') fixed.push({ start: base[i].a, slug: s.slug, reason: String(s.name) + ' at ' + s.arrive });
    else return;
    st[i].fixed = true;
  });
  var dn = tgCmdDayAnchorOk(out.dinner) && _tgLateMin(out.dinner.start) !== null ? out.dinner : null;
  var dnS = dn ? _tgLateMin(dn.start) : null, dnE0 = dn ? _tgLateMin(dn.end) : null;
  var dnE = dn ? (dnE0 !== null && dnE0 > dnS ? dnE0 : dnS + TG_LATE.DINNER_MIN) : null;
  var dnFixed = !!(dn && typeof dn.slug === 'string' && booked[dn.slug]), dnMoved = false;
  if (dnFixed) fixed.push({ start: dnS, slug: dn.slug, reason: 'your ' + dn.start + ' dinner booking' });
  var end = tgLateDayEnd(trip, out);
  if (end) fixed.push(end);
  fixed.sort(function (x, y) { return x.start - y.start; });
  var legTo = function (from, to) { return tgLateLegTo(day.legs || [], stopSlugs, from, to); };
  var total = 0, first = null, n = 0, dropped = [];
  (Array.isArray(taps) ? taps : []).forEach(function (tp) {
    var t = isPlainObject(tp) ? _tgLateMin(tp.t) : null, m = isPlainObject(tp) ? Number(tp.m) : NaN;
    if (t === null || !(m >= TG_LATE.MIN && m <= TG_LATE.MAX) || Math.floor(m) !== m) return;
    total += m; n++;
    if (first === null) first = t;
    stops.forEach(function (s, i) {
      if (st[i].fixed || st[i].dropped || cur[i].a === null || cur[i].d === null) return;
      if (cur[i].d > t) { cur[i].a += m; cur[i].d += m; st[i].moved = true; }
    });
    if (dn && !dnFixed && dnE > t) { dnS += m; dnE += m; dnMoved = true; }
    stops.forEach(function (s, i) {
      if (!st[i].moved || st[i].dropped) return;
      var why = tgLateWhy(s, base[i], cur[i], fixed, legTo);
      if (why) { st[i].dropped = why; dropped.push({ i: i, n: s.n, slug: s.slug, name: String(s.name), reason: why }); }
    });
  });
  if (!n) return day;
  dropped.sort(function (x, y) { return x.i - y.i; });   // in the day's order, whichever tap dropped them
  dropped.forEach(function (d) { delete d.i; });
  var kept = [], moved = 0;
  stops.forEach(function (s, i) {
    if (st[i].dropped) return;
    if (st[i].moved) {
      s.arrive = _tgLateHm(cur[i].a); s.depart = _tgLateHm(cur[i].d); s.late_moved = true; moved++;
      if (_tgLateMin(s.last_entry) === null && _tgLateMin(s.close) === null) s.late_check = true;
    } else if (st[i].fixed && base[i].a >= first) s.late_fixed = true;
    kept.push(s);
  });
  if (dnMoved) { dn.start = _tgLateHm(dnS); if (dnE0 !== null) dn.end = _tgLateHm(dnE); dn.late_moved = true; moved++; }
  else if (dnFixed && _tgLateMin(dn.start) >= first) dn.late_fixed = true;
  dropped.forEach(function (d) { tgLateJoin(legs, d.slug); });
  out.stops = kept;
  out.legs = legs;
  out.late = { minutes: total, from: _tgLateHm(first), taps: n, moved: moved, dropped: dropped };
  return out;
}
/** The day as shown: with today's overlay when one is stored for it and the stored day has not changed since. */
function tgLateView(trip, day) {
  if (!trip || !day || day.late) return day;
  var e = tgLateGet(trip.slug, day.date);
  if (!e || e.base !== tgLateBase(day)) return day;
  return tgLateCompute(trip, day, e.taps);
}

/* ---------------- saving, undo, a new digest ---------------- */
/** Save one tap on a stored day (the real, today case) → { view } | { error }. */
function tgLateTap(trip, date, minutes, hm) {
  var day = tgDigestDay(trip.slug, date);
  if (!day) return { error: 'No plan for ' + tgCmdDate(date) + ' in ' + tgCmdTitle(trip) + '.' };
  var all = _tgLateAll(), k = trip.slug + '|' + date, base = tgLateBase(day);
  var e = isPlainObject(all[k]) && all[k].base === base && Array.isArray(all[k].taps) ? all[k] : { taps: [] };
  if (e.taps.length >= TG_LATE.TAPS_MAX) return { error: 'That is ' + TG_LATE.TAPS_MAX + ' changes to today already — 📍 Re-plan from here builds a fresh day.' };
  e.taps.push({ t: hm, m: minutes });
  e.base = base; e.at = nowIso(); all[k] = e;
  _tgLateSave(all);
  return { view: tgLateCompute(trip, day, e.taps) };
}
/** ↩️ Undo: the day back to its plan; false when there was nothing to undo. */
function tgLateUndo(slug, date) {
  var all = _tgLateAll(), k = slug + '|' + date;
  if (!all[k]) return false;
  delete all[k];
  _tgLateSave(all);
  return true;
}
/** After a digest is stored: drop the overlays of this trip whose day changed or is gone (a re-plan clears running late). */
function tgLateOnDigest(slug) {
  var all = _tgLateAll(), changed = false;
  Object.keys(all).forEach(function (k) {
    if (k.indexOf(slug + '|') !== 0) return;
    var d = tgDigestDay(slug, k.slice(slug.length + 1));
    if (!d || !isPlainObject(all[k]) || tgLateBase(d) !== all[k].base) { delete all[k]; changed = true; }
  });
  if (changed) _tgLateSave(all);
  return changed;
}

/* ---------------- the reply ---------------- */
/** The moved day, what stays, what dropped and why; ↩️ Undo and 📍 Re-plan from here (none on a rehearsal). */
function tgLateMessages(trip, view, rehearsal) {
  var L = view.late || { minutes: 0, from: '', moved: 0, dropped: [] }, lines = [];
  if (rehearsal) lines.push('🎭 <b>Rehearsal</b> — nothing is saved');
  lines.push('⏰ <b>Running ' + tgEscape(L.minutes) + ' min late</b> · ' + tgCmdDate(view.date) + (L.from ? ' · from ' + tgEscape(L.from) : ''));
  (view.stops || []).forEach(function (s) {
    if (!s.late_moved && !s.late_fixed) return;
    lines.push('<b>' + tgEscape(s.n) + '.</b> ' + tgCmdDayTime(s) + ' ' + tgEscape(s.name) + (s.late_fixed ? ' · stays' : '') +
      (s.late_check ? ' · <i>check the hours</i>' : ''));
  });
  var dn = view.dinner;
  if (tgCmdDayAnchorOk(dn) && (dn.late_moved || dn.late_fixed)) lines.push('🍽 ' + tgEscape(dn.start) + ' Dinner at ' + tgEscape(dn.name) + (dn.late_fixed ? ' · booked, stays' : ''));
  if (tgCmdDayAnchorOk(view.end) && tgCmdDayClock(view.end.time) && L.from && view.end.time >= L.from) lines.push('🏁 ' + tgEscape(view.end.time) + ' ' + tgEscape(view.end.name) + ' · stays');
  if (!L.moved) lines.push('<i>Nothing left today moves after ' + tgEscape(L.from) + '.</i>');
  (L.dropped || []).forEach(function (x) { lines.push('✖️ <b>' + tgEscape(x.name) + '</b> dropped — ' + tgEscape(x.reason)); });
  if ((view.legs || []).some(function (l) { return l && l.joined; })) lines.push('<i>Where a stop dropped out, the travel time to the next one was not recalculated.</i>');
  if (!rehearsal) lines.push('<i>/today shows the whole day.</i>');
  var tk = tgCmdTripKey(trip.slug), d8 = tgLateD8(view.date);
  var kb = rehearsal ? null : tgKeyboard([[{ text: '↩️ Undo', data: cbEncode('rl', tk, d8, 'u') }, { text: '📍 Re-plan from here', data: cbEncode('rp', tk, d8) }]]);
  return tgCmdMessages(lines, kb);
}
/** Running late on a date: the real thing on the trip's today (saved), a rehearsal on any other date (not saved). */
function tgLateRun(chatId, trip, date, minutes) {
  var day = tgDigestDay(trip.slug, date), hm = tgLateNowHm(trip), rehearsal = date !== tgTripToday(trip), view;
  if (!day) { tgSend(chatId, 'No plan for ' + tgCmdDate(date) + ' in ' + tgCmdTitle(trip) + '.'); return null; }
  if (rehearsal) view = tgLateCompute(trip, day, [{ t: hm, m: minutes }]);
  else {
    var r = tgLateTap(trip, date, minutes, hm);
    if (r.error) { tgSend(chatId, r.error); return null; }
    view = r.view;
  }
  audit('tg_late', trip.slug, { date: date, minutes: minutes, rehearsal: rehearsal, dropped: view.late ? view.late.dropped.length : 0 });
  return tgCmdSendAll(chatId, tgLateMessages(trip, view, rehearsal));
}

registerCommand('/late', function (ctx) {
  var trip = tgCmdCurrent(ctx);
  if (!trip) return;
  var m = /^(\d{1,3})\s*(?:m|min|mins|minutes)?(?:\s+(day\s*\d{1,2}|\d{4}-\d{2}-\d{2}|\d{1,2}|today|tomorrow))?$/i.exec(String(ctx.args || '').trim());
  if (!m) { ctx.reply('Usage: <code>/late 30</code> moves the rest of today 30 minutes later (' + TG_LATE.MIN + '–' + TG_LATE.MAX + '); <code>/late 30 2</code> rehearses day 2.'); return; }
  var mins = parseInt(m[1], 10);
  if (!(mins >= TG_LATE.MIN && mins <= TG_LATE.MAX)) { ctx.reply('Between ' + TG_LATE.MIN + ' and ' + TG_LATE.MAX + ' minutes, please.'); return; }
  var date = m[2] ? tgCmdPlanDate(trip, m[2]) : tgTripToday(trip);
  if (!date) { ctx.reply(tgCmdNotInPlan(trip)); return; }
  if (!m[2] && !tgDigestDay(trip.slug, date)) { ctx.reply('No plan for today in ' + tgCmdTitle(trip) + '. To rehearse a day: <code>/late 30 &lt;day N&gt;</code>.'); return; }
  tgLateRun(ctx.chatId, trip, date, mins);
}, 'running late: /late <minutes> moves the rest of today later; /late 30 <day N> rehearses another day');

/** rl:<trip key>:<yyyymmdd>:<15|30|60|u> — exactly that shape. */
registerCallback('rl', function (ctx) {
  var p = ctx.parts;
  if (p.length !== 3 || !/^\d{8}$/.test(String(p[1])) || !/^(15|30|60|u)$/.test(String(p[2]))) { ctx.answer('Unknown button'); return; }
  var trip = tgCmdTripByKey(p[0]), date = tgLateDate8(p[1]);
  if (!trip || !tgEnvRealDate(date)) { ctx.answer('That trip is gone.'); return; }
  if (p[2] === 'u') {
    var ok = tgLateUndo(trip.slug, date);
    ctx.answer(ok ? 'Undone' : 'Nothing to undo');
    if (ok) tgSend(ctx.chatId, '↩️ ' + tgCmdDate(date) + ' is back to the plan. /today shows it.');
    return;
  }
  ctx.answer('Moving the day ' + p[2] + ' min later');
  tgLateRun(ctx.chatId, trip, date, Number(p[2]));
});

// Developed by: LightAISolutions
