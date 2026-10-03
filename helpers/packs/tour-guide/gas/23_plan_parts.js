/**
 * Tour Guide pack — plans in parts (WP-11c, Contract C11). A plan_digest that carries `part` and `parts` is one piece of a
 * plan the brain split to stay under the envelope size cap. Each part is staged in the DigestParts tab (one row per
 * 45 000-character chunk of the part's JSON, never a whole part in one cell); when the last part arrives the days are
 * joined in part order, checked as one plan (date order, no duplicates, at most 31 days), stored once with tgDigestStore
 * and delivered once (one owner notice or one plan-flow event).
 *   same build, same part again     → replaces the staged part (a re-send is idempotent)
 *   a part of another build         → the earlier build's staged parts are discarded (the newest build wins)
 *   top fields differ between parts → the build is dropped, audited, the owner told once
 *   still incomplete 24 h after its first part → dropped by the alarm `tg_digest_parts`, audited, the owner told once
 *   a part of a dropped build       → refused and audited, no new notice
 * A digest without `parts` never comes here. Defaults: helpers/decisions/WP-11c.md.
 */
var TG_PARTS_SHEET = 'DigestParts';
var TG_PARTS_COLS = ['trip', 'build_id', 'part', 'parts', 'chunk', 'json', 'top', 'env_id', 'in_reply_to', 'received_at'];
var TG_PARTS = { TTL_MS: 24 * 3600 * 1000, DROPPED: 'tg_digest_dropped', KEEP_DROPPED: 20, MAX_DAYS: 31,
  NOTICE: 'a plan arrived incomplete; /replan tries again.' };
registerSheet(TG_PARTS_SHEET, TG_PARTS_COLS);

/** The top fields every part must repeat, as one string in a fixed key order (compared as text). */
function tgPartsTop(p) {
  return toJson({ trip: p.trip, build_id: p.build_id, verified_on: p.verified_on, tz: p.tz === undefined ? null : p.tz,
    drive: isPlainObject(p.drive) ? { plan: p.drive.plan === undefined ? null : p.drive.plan,
      brochure_html: p.drive.brochure_html === undefined ? null : p.drive.brochure_html,
      brochure_pdf: p.drive.brochure_pdf === undefined ? null : p.drive.brochure_pdf } : null,
    parts: p.parts });
}
function tgPartsRows(trip) { return storeFind(TG_PARTS_SHEET, function (r) { return tgShStr(r.trip) === trip; }); }
function tgPartsDelete(rows) { if (rows.length) storeDeleteRows(TG_PARTS_SHEET, rows.map(function (r) { return r._row; })); }
function tgPartsDroppedList() { var l = tgShJson(settingGet(TG_PARTS.DROPPED, ''), null); return Array.isArray(l) ? l : []; }
function tgPartsIsDropped(trip, build) { return tgPartsDroppedList().some(function (d) { return d && d.trip === trip && d.build_id === build; }); }
function tgPartsMarkDropped(trip, build, reason) {
  var l = tgPartsDroppedList().filter(function (d) { return !(d && d.trip === trip && d.build_id === build); });
  l.push({ trip: trip, build_id: build, reason: reason, at: nowIso() });
  settingSet(TG_PARTS.DROPPED, toJson(l.slice(-TG_PARTS.KEEP_DROPPED)), 'plan builds dropped while arriving in parts');
}
/** A deployment set up before WP-11c has no DigestParts tab yet: create it (setup is not re-run on every deploy). */
function tgPartsHasTab() { return !!getSpreadsheet().getSheetByName(TG_PARTS_SHEET); }
function tgPartsEnsure() { if (!tgPartsHasTab()) ensureSheets(); }
/** Every staged build: [{ trip, build_id, at (ms of its first part), rows }]. */
function tgPartsBuilds() {
  if (!tgPartsHasTab()) return [];
  var by = {}, out = [];
  storeAll(TG_PARTS_SHEET).forEach(function (r) {
    var key = tgShStr(r.trip) + '|' + tgShStr(r.build_id), d = parseIso(tgShStr(r.received_at)), ms = d ? d.getTime() : 0;
    if (!by[key]) { by[key] = { trip: tgShStr(r.trip), build_id: tgShStr(r.build_id), at: ms, rows: [] }; out.push(by[key]); }
    by[key].at = Math.min(by[key].at, ms);
    by[key].rows.push(r);
  });
  return out;
}
/** The owner's one notice for a build that will not arrive whole. */
function tgPartsNotice(trip) {
  var t = tgTripGet(trip) || { slug: trip };
  var r = tgSendOwner('⚠️ <b>' + tgCmdTitle(t) + '</b>: ' + TG_PARTS.NOTICE);
  return !!(r && r.ok);
}
/** Drop a build: delete its staged rows, remember it (late parts are refused), audit, tell the owner once. */
function tgPartsDrop(trip, build, rows, reason) {
  tgPartsDelete(rows);
  tgPartsMarkDropped(trip, build, reason);
  auditFail('tg_parts_dropped', trip, 'build ' + truncate(build, 60) + ': ' + reason);
  return tgPartsNotice(trip);
}
/** Staged rows → { <part>: payload } (chunks joined in chunk order; a part that does not parse is left out). */
function tgPartsLoad(rows) {
  var by = {}, out = {};
  rows.forEach(function (r) { var k = tgShInt(r.part, 0); (by[k] = by[k] || []).push(r); });
  Object.keys(by).forEach(function (k) {
    var s = by[k].sort(function (a, b) { return tgShInt(a.chunk, 0) - tgShInt(b.chunk, 0); }).map(function (r) { return tgShStr(r.json); }).join('');
    var p = tgShJson(s, null);
    if (isPlainObject(p)) out[k] = p;
  });
  return out;
}
/** The whole plan: part 1's top fields and Later list, every part's days in part order; no part / parts keys. */
function tgPartsJoin(byPart, parts) {
  var first = byPart[1], joined = {};
  Object.keys(first).forEach(function (k) { if (k !== 'part' && k !== 'parts') joined[k] = first[k]; });
  joined.days = [];
  for (var k = 1; k <= parts; k++) joined.days = joined.days.concat(byPart[k].days || []);
  joined.later = first.later || [];
  return joined;
}
/** The checks that only the whole plan can fail (the size cap stays per part). */
function tgPartsJoinErrors(joined) {
  var errs = [], days = joined.days;
  if (days.length > TG_PARTS.MAX_DAYS) errs.push(days.length + ' days (max ' + TG_PARTS.MAX_DAYS + ')');
  for (var i = 1; i < days.length; i++) if (!(String(days[i].date) > String(days[i - 1].date))) { errs.push('days[' + i + '].date: days must be in date order without duplicates'); break; }
  return errs;
}
/** A whole digest (no parts) arrived: an older build still staged for the trip can never win any more. */
function tgPartsSupersede(trip, build) {
  if (!tgPartsHasTab()) return 0;
  var other = storeFind(TG_PARTS_SHEET, function (r) { return tgShStr(r.trip) === trip && tgShStr(r.build_id) !== build; });
  if (!other.length) return 0;
  tgPartsDelete(other);
  audit('tg_parts_superseded', trip, other.length + ' staged row(s) of an earlier build discarded for build ' + truncate(build, 60));
  _safe('alarm_arm', function () { return alarmArm(); });
  return other.length;
}
/**
 * Stage one part. Returns { state: 'staged' | 'complete' | 'duplicate' | 'refused' | 'dropped', trip, part, parts, … };
 * 'complete' also carries env (the joined plan as an envelope: the last part's id, part 1's in_reply_to or the first
 * one any part carried) and stored (tgDigestStore's result). Delivery is the caller's.
 */
function tgPartsTake(env) {
  var p = env.payload, trip = String(p.trip), build = String(p.build_id), part = p.part, parts = p.parts;
  var res = { trip: trip, part: part, parts: parts };
  var prev = tgTripGet(trip);
  if (prev && prev.build_id === build) {
    audit('tg_parts_duplicate', trip, 'build ' + truncate(build, 60) + ' part ' + part + ' is already stored');
    res.state = 'duplicate'; return res;
  }
  if (tgPartsIsDropped(trip, build)) {
    auditFail('tg_parts_refused', trip, 'build ' + truncate(build, 60) + ' part ' + part + ' arrived after the build was dropped');
    res.state = 'refused'; return res;
  }
  tgPartsEnsure();
  tgPartsSupersede(trip, build);
  var rows = tgPartsRows(trip), top = tgPartsTop(p);
  if (rows.some(function (r) { return tgShStr(r.top) !== top; })) {
    res.notice = tgPartsDrop(trip, build, rows, 'part ' + part + ' repeats different top fields');
    res.state = 'dropped'; _safe('alarm_arm', function () { return alarmArm(); }); return res;
  }
  // The build's clock starts at its first part; a re-sent part replaces its own rows but keeps that time.
  var firstMs = nowMs();
  rows.forEach(function (r) { var d = parseIso(tgShStr(r.received_at)); if (d) firstMs = Math.min(firstMs, d.getTime()); });
  var same = rows.filter(function (r) { return tgShInt(r.part, 0) === part; });
  tgPartsDelete(same);
  var at = new Date(firstMs).toISOString();
  _tgChunks(toJson(p)).forEach(function (c, i) {
    storeAppend(TG_PARTS_SHEET, { trip: trip, build_id: build, part: part, parts: parts, chunk: i, json: c, top: top,
      env_id: String(env.id || ''), in_reply_to: String(env.in_reply_to || ''), received_at: at });
  });
  rows = tgPartsRows(trip);
  var byPart = tgPartsLoad(rows), have = 0;
  for (var k = 1; k <= parts; k++) if (byPart[k]) have++;
  res.have = have;
  if (have < parts) { res.state = 'staged'; _safe('alarm_arm', function () { return alarmArm(); }); return res; }

  var irt = '';
  var byRow = {};
  rows.forEach(function (r) { var n = tgShInt(r.part, 0); if (!byRow[n] && tgShStr(r.in_reply_to)) byRow[n] = tgShStr(r.in_reply_to); });
  for (var j = 1; j <= parts && !irt; j++) irt = byRow[j] || '';
  tgPartsDelete(rows);
  _safe('alarm_arm', function () { return alarmArm(); });
  var joined = tgPartsJoin(byPart, parts), errs = tgPartsJoinErrors(joined);
  if (errs.length) {
    res.notice = tgPartsDrop(trip, build, [], 'the joined plan fails: ' + errs.join('; '));
    res.state = 'dropped'; res.errors = errs; return res;
  }
  res.stored = tgDigestStore(joined);
  res.env = { id: env.id, type: 'plan_digest', in_reply_to: irt || null, payload: joined };
  res.state = 'complete';
  return res;
}
/** Builds still incomplete TTL after their first part: dropped, audited, the owner told once per build. */
function tgPartsExpire(now) {
  var slack = LIMITS.ALARM_EARLY_SEC * 1000, n = 0;
  tgPartsBuilds().forEach(function (b) {
    if (b.at + TG_PARTS.TTL_MS > now + slack) return;
    tgPartsDrop(b.trip, b.build_id, b.rows, 'still incomplete 24 h after its first part');
    n++;
  });
  return n;
}
registerAlarm('tg_digest_parts', {
  next: function () {
    var best = null;
    tgPartsBuilds().forEach(function (b) { var due = b.at + TG_PARTS.TTL_MS; if (best === null || due < best) best = due; });
    return best;
  },
  run: function (now) { tgPartsExpire(now); }
});

// Developed by: LightAISolutions
