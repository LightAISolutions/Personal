/**
 * Tour Guide pack — Scout: one food or activity searched across a whole city, answered as a ranked list (contract
 * helpers/decisions/TG-SCOUT.md §1, §2 core side, §3, §6).
 *   /scout <what> [in <where>]  → request kind `scout` { query, where?, destination?, trip? } (no "in": the current trip's
 *                                 destination); routed to routine SCOUT when configured, else RESEARCH (00_common.js)
 *   /scouts                     → the last 10 scouts, each with a 🔎 button that resends its ranked list
 *   envelope `scout`            → validated (tgEnvValidateScout, mirror of schemas/tour-guide-scout.schema.json — own data
 *                                 only, every Google field refused), stored in the Scouts tab (a re-delivered scout_id
 *                                 replaces its row), then the ranked message: numbered lines, ➕ buttons, 📱 Open the board
 *   callback sc:<id key>:<n>    → ➕ pick n onto the Later list (the scout's own trip, else the current trip), then the same
 *                                 day buttons as the /places ➕; sc:<id key>:s resends the list (/scouts)
 * Load order: this file runs before 20_envelopes.js and 21_sheets.js, so their names (tgEnv*, TG_ENV_RE, TG_GOOGLE_FIELDS)
 * are only touched inside functions, at run time. App operations: 35_scout_app.js.
 */
var TG_SCOUT = {
  SHEET: 'Scouts', QUERY_MAX: 80, WHERE_MAX: 80, ITEMS_MAX: 20, LEFT_MAX: 20, CHAT_LIST: 10,
  ID_RE: /^sc-\d{8}-[a-z0-9-]{1,40}$/, KEY_RE: /^k[0-9a-f]{12}$/
};
var TG_SCOUT_GROUPS = ['food', 'activities'];
var TG_SCOUT_LABELS = ['gem', 'veg_verified', 'veg_likely', 'booking', 'queue', 'cash_only', 'chain', 'new', 'seen_before', 'far', 'not_judged'];   // not_judged: TG-PHASE-14 C14
var TG_SCOUT_LEFT = ['off_topic', 'diet', 'diet_unproven', 'low_rating', 'unproven', 'closed', 'closed_on_trip', 'too_far', 'duplicate', 'other'];
var TG_SCOUT_LEFT_WORDS = { off_topic: 'off topic', diet: 'nothing you can eat', diet_unproven: 'vegetarian not confirmed', low_rating: 'poorly rated',
  unproven: 'too little evidence', closed: 'closed', closed_on_trip: 'closed on your days', too_far: 'too far', duplicate: 'duplicate', other: 'other' };
var TG_SCOUT_MODES = { WALK: '🚶', TRANSIT: '🚇', DRIVE: '🚗' };
/** Google Places field names in any spelling (snake_case or the API's camelCase) plus a few the Places API adds. */
var TG_SCOUT_GOOGLE_EXTRA = ['photo', 'location', 'lat', 'lng', 'latitude', 'longitude', 'googlemapsuri', 'servesvegetarianfood', 'displayname',
  'reviewcount', 'reviews', 'pricerange', 'userratingcount', 'userratingstotal', 'regularopeninghours', 'pricelevel', 'geometry', 'vicinity'];

registerSheet(TG_SCOUT.SHEET, ['id', 'created_on', 'query', 'destination', 'place_label', 'trip', 'group', 'count', 'items_json', 'left_json',
  'drive_html', 'drive_pdf', 'received_at']);

/* ==================== asking ==================== */

/** 'matcha in Kyoto' → { what, where }; also "matcha near Gion, Kyoto", "matcha @ Kyoto", "matcha, Kyoto"; where '' when absent.
 *  Only words the acknowledgement and fills the request's old fields (query, where, destination, trip) for the current
 *  pin: the request's `text` is the owner's words as typed and the engine's parse of it is the one that counts. */
function tgScoutParse(text) {
  var s = String(text || '').replace(/\s+/g, ' ').trim(), i = s.toLowerCase().lastIndexOf(' in '), m;
  if (i > 0) return { what: s.slice(0, i).trim(), where: s.slice(i + 4).trim() };
  m = /^(.+?)\s+near\s+(.+)$/i.exec(s) || /^(.+?)\s*@\s*(.+)$/.exec(s) || /^(.+?)\s*,\s*(.+)$/.exec(s);
  return m ? { what: m[1].trim(), where: m[2].trim() } : { what: s, where: '' };
}
/** The current trip is the one asked about when the place named is its destination (either slug contains the other). */
function tgScoutSameDest(trip, where) {
  var a = trip && trip.destination ? tgSlug(trip.destination) : '', b = tgSlug(where);
  return !!(a && b && (a === b || b.indexOf(a) >= 0 || a.indexOf(b) >= 0));
}
/**
 * Open a `scout` request: what (≤ 80) and where (≤ 80, blank = the current trip's destination). opts = { chat?, text? }:
 * text is the owner's words as typed; without it (the app) the request reads `/scout <what> in <where>`, where resolved.
 * → { ok: true, id, routine, fired, query, where, trip } | { ok: false, why: 'missing_query' | 'too_long' | 'no_place', field? }
 */
function tgScoutOpen(what, where, opts) {
  opts = opts || {};
  what = String(what || '').replace(/\s+/g, ' ').trim();
  where = String(where || '').replace(/\s+/g, ' ').trim();
  if (!what) return { ok: false, why: 'missing_query', field: 'query' };
  if (what.length > TG_SCOUT.QUERY_MAX) return { ok: false, why: 'too_long', field: 'query' };
  if (where.length > TG_SCOUT.WHERE_MAX) return { ok: false, why: 'too_long', field: 'where' };
  var trip = tgTripCurrent(), payload = { query: what };
  if (where) {
    payload.where = where;
    if (trip && tgScoutSameDest(trip, where)) { payload.destination = tgSlug(trip.destination); payload.trip = trip.slug; }
  } else if (trip && trip.destination && tgSlug(trip.destination)) {
    where = truncate(String(trip.destination), TG_SCOUT.WHERE_MAX);
    payload.where = where; payload.destination = tgSlug(trip.destination); payload.trip = trip.slug;
  } else return { ok: false, why: 'no_place' };
  var r = tgOpenKindRequest('scout', payload, { chat: opts.chat || null, text: opts.text || ('/scout ' + what + ' in ' + where),
    ack: '🔎 Scouting <b>' + tgEscape(what) + '</b> in <b>' + tgEscape(where) + '</b>…' });
  return { ok: true, id: r.id, routine: r.routine, fired: !!(r.fired && r.fired.ok), query: what, where: where, trip: payload.trip || '' };
}
var TG_SCOUT_USAGE = '🔎 What should I look for, and where? <code>/scout matcha in Kyoto</code>\nWith a trip planned, <code>/scout matcha</code> searches its destination.';

registerCommand('/scout', function (ctx) {
  if (!String(ctx.args || '').trim()) { ctx.reply(TG_SCOUT_USAGE); return; }
  var q = tgScoutParse(ctx.args);
  // The request carries the owner's words as typed; the engine's parse of them is the one that counts (WP-13c item 7).
  var r = tgScoutOpen(q.what, q.where, { chat: ctx.chat, text: String(ctx.text || '') });
  if (r.ok) return;
  if (r.why === 'too_long') ctx.reply('🔎 Please keep ' + (r.field === 'where' ? 'the place' : 'what to look for') + ' under ' + TG_SCOUT.QUERY_MAX + ' characters — nothing was asked.');
  else if (r.why === 'no_place') ctx.reply('🔎 Where should I look? There is no current trip to search. <code>/scout ' + tgEscape(truncate(q.what, 60)) + ' in &lt;city&gt;</code>');
  else ctx.reply(TG_SCOUT_USAGE);
}, 'a ranked list of one food or activity in a place: /scout matcha in Kyoto');

/* ==================== the Scouts tab ==================== */

function tgScoutParseJson(v, def) {
  if (v === undefined || v === null || v === '') return def;
  var p = typeof v === 'string' ? safeJsonParse(v) : { ok: true, value: v };
  return p.ok ? p.value : def;
}
function tgScoutRec(r) {
  if (!r) return null;
  var items = tgScoutParseJson(r.items_json, []), left = tgScoutParseJson(r.left_json, []);
  return { id: tgShStr(r.id), created_on: tgShDate(r.created_on), query: tgShStr(r.query), destination: tgShStr(r.destination),
    place_label: tgShStr(r.place_label), trip: tgShStr(r.trip), group: tgShStr(r.group), count: tgShInt(r.count, 0),
    items: Array.isArray(items) ? items.filter(isPlainObject) : [], left_out: Array.isArray(left) ? left.filter(isPlainObject) : [],
    drive_html: tgShStr(r.drive_html), drive_pdf: tgShStr(r.drive_pdf), received_at: tgShStr(r.received_at) };
}
function tgScoutGet(id) {
  id = String(id || '');
  if (!TG_SCOUT.ID_RE.test(id)) return null;
  return tgScoutRec(storeFind(TG_SCOUT.SHEET, function (r) { return tgShStr(r.id) === id; }, 1)[0] || null);
}
/** Newest first (received_at, then row order); limit optional. */
function tgScoutList(limit) {
  var rows = storeAll(TG_SCOUT.SHEET).map(function (r) { var x = tgScoutRec(r); x._row = r._row; return x; });
  rows.sort(function (a, b) { return a.received_at !== b.received_at ? (a.received_at < b.received_at ? 1 : -1) : b._row - a._row; });
  rows.forEach(function (x) { delete x._row; });
  return limit ? rows.slice(0, limit) : rows;
}
/** One pick as stored: own fields only, the Maps link kept only when the chat may show it (Google Maps host, ≤ TG_CMD_URL_MAX). */
function tgScoutItemOut(it) {
  var out = { n: it.n, slug: it.slug, name: it.name, area: it.area, category: it.category, score: it.score, parts: it.parts,
    why_you: it.why_you, labels: (it.labels || []).slice() };
  ['try', 'rated', 'reach', 'place_id'].forEach(function (k) { if (it[k] !== undefined) out[k] = it[k]; });
  var u = String(it.maps_url || '');
  out.maps_url = TG_CMD_MAPS_URL.test(u) && u.length <= TG_CMD_URL_MAX ? u : '';
  return out;
}
/** Store a validated scout payload; a re-delivered scout_id replaces its row. → { rec, replaced } */
function tgScoutStore(p) {
  var items = (p.items || []).map(tgScoutItemOut), itemsJson = toJson(items);
  if (itemsJson.length > TG_CELL_MAX) { items.forEach(function (it) { delete it.place_id; }); itemsJson = toJson(items); }
  var drive = isPlainObject(p.drive) ? p.drive : {};
  var row = { id: p.scout_id, created_on: p.created_on, query: p.query, destination: p.destination, place_label: p.place_label,
    trip: p.trip || '', group: p.group, count: items.length, items_json: itemsJson,
    left_json: toJson((p.left_out || []).map(function (l) { return { name: l.name, reason: l.reason }; })),
    drive_html: drive.board_html || '', drive_pdf: drive.board_pdf || '', received_at: nowIso() };
  var replaced = !!storeFind(TG_SCOUT.SHEET, function (r) { return tgShStr(r.id) === p.scout_id; }, 1)[0];
  storeUpsertById(TG_SCOUT.SHEET, row);
  var rec = tgScoutGet(p.scout_id);
  return { rec: rec, replaced: replaced };
}

/* ==================== the ranked message ==================== */

/** A scout id as a callback part: the id itself while "sc:<id>:20" fits in 64 bytes, else "k" + 12 hex of its hash. */
function tgScoutKey(id) {
  id = String(id || '');
  return TG_SCOUT.ID_RE.test(id) && utf8Bytes('sc:' + id + ':20') <= LIMITS.CB_DATA_MAX_BYTES ? id : 'k' + sha1Hex(id).slice(0, 12);
}
function tgScoutByKey(key) {
  key = String(key || '');
  if (TG_SCOUT.ID_RE.test(key)) return tgScoutGet(key);
  if (!TG_SCOUT.KEY_RE.test(key)) return null;
  var all = tgScoutList();
  for (var i = 0; i < all.length; i++) if ('k' + sha1Hex(String(all[i].id)).slice(0, 12) === key) return all[i];
  return null;
}
/** "Matcha in Kyoto" — the query with a capital, the place label's first part (Kyoto, Japan → Kyoto). */
function tgScoutTitle(rec) {
  var q = String(rec.query || ''), place = String(rec.place_label || '').split(',')[0].trim() || rec.destination;
  return (q.charAt(0).toUpperCase() + q.slice(1)) + ' in ' + place;
}
function tgScoutReach(r) {
  if (!isPlainObject(r) || !(r.minutes >= 0)) return '';
  return (TG_SCOUT_MODES[r.mode] || '') + ' ' + (r.estimated ? '~' : '') + tgCmdMinutes(r.minutes);
}
/** The trip a ➕ adds to: the scout's own trip while it is on file and not done, else the current trip (null: none). */
function tgScoutTargetTrip(rec) {
  var t = rec && rec.trip ? tgTripGet(rec.trip) : null;
  return t && t.status !== 'done' ? t : tgTripCurrent();
}
/** The app button: the shell's scout screen opened on this scout ([] without APP_SHELL_URL). */
function tgScoutAppRows(rec, label) {
  var u = tgAppUrl('scout', rec.trip || '');
  return u ? [[{ text: label || '📱 Open the board', web_app: { url: u + '&scout=' + encodeURIComponent(rec.id) } }]] : [];
}
/** [{ html, keyboard? }] — header, one line per pick (name · area · reach · why), what was left out, ➕ buttons and the app button. */
function tgScoutMessages(rec) {
  var items = rec.items || [], left = rec.left_out || [], n = items.length, trip = tgScoutTargetTrip(rec);
  var lines = ['🔎 <b>' + tgEscape(tgScoutTitle(rec)) + '</b> — ' + (n ? n + ' pick' + (n === 1 ? '' : 's') + ', ranked for you' : 'nothing worth the trip this time')];
  items.forEach(function (it) {
    var labels = it.labels || [], marks = (labels.indexOf('gem') >= 0 ? ' 💎' : '') + (labels.indexOf('veg_verified') >= 0 || labels.indexOf('veg_likely') >= 0 ? ' 🌱' : '') +
      (labels.indexOf('seen_before') >= 0 ? ' 🔁' : '') +   // 🔁 already in your places
      (labels.indexOf('new') >= 0 ? ' 🆕' : '') + (labels.indexOf('not_judged') >= 0 ? ' · not judged' : '');   // 🆕 new, vouched for by the judgment (WP-14b)
    var bits = [it.area ? tgEscape(it.area) : '', tgScoutReach(it.reach)].filter(Boolean);
    lines.push('<b>' + it.n + '.</b> ' + tgCmdHref(it.maps_url, it.name) + marks + (bits.length ? ' · ' + bits.join(' · ') : '') + (it.why_you ? ' — <i>' + tgEscape(it.why_you) + '</i>' : ''));
  });
  if (left.length) {
    var by = {}, order = [];
    left.forEach(function (l) { var w = TG_SCOUT_LEFT_WORDS[l.reason] || 'other'; if (!by[w]) { by[w] = 0; order.push(w); } by[w]++; });
    lines.push('<i>Left out: ' + order.map(function (w) { return by[w] + ' ' + w; }).join(' · ') + '</i>');
  }
  var rows = [];
  if (n && trip) {
    lines.push('', '➕ puts a pick on the Later list of ' + tgCmdTitle(trip) + '.');
    var key = tgScoutKey(rec.id);
    rows = tgCmdRows(items.map(function (it) { return { text: '➕ ' + it.n, data: cbEncode('sc', key, it.n) }; }), 5);
  }
  rows = rows.concat(tgScoutAppRows(rec));
  return tgCmdMessages(lines, rows.length ? tgKeyboard(rows) : null);
}
function tgScoutSend(chatId, rec) { return tgCmdSendAll(chatId, tgScoutMessages(rec)); }

registerCommand('/scouts', function (ctx) {
  var list = tgScoutList(TG_SCOUT.CHAT_LIST);
  if (!list.length) { ctx.reply('🔎 No scouts yet — try <code>/scout matcha in Kyoto</code>.'); return; }
  var lines = ['🔎 <b>Your last scouts</b>'], btns = [];
  list.forEach(function (s, i) {
    lines.push('<b>' + (i + 1) + '.</b> ' + tgEscape(tgScoutTitle(s)) + ' · ' + s.count + ' pick' + (s.count === 1 ? '' : 's') + (s.created_on ? ' · ' + tgCmdDate(s.created_on) : ''));
    btns.push({ text: '🔎 ' + (i + 1), data: cbEncode('sc', tgScoutKey(s.id), 's') });
  });
  lines.push('', 'Tap a number to see its list again.');
  var app = tgAppRows('scout', '', '📱 Scout in the app');
  tgCmdSendAll(ctx.chatId, tgCmdMessages(lines, tgKeyboard(tgCmdRows(btns, 5).concat(app))));
}, 'your last 10 scouts');

/* ==================== ➕ a pick onto the Later list ==================== */

/** → { ok: true, trip, item, index, days } | { ok: false, why: 'no_pick' | 'no_trip' } */
function tgScoutAddPick(rec, n) {
  var it = (rec.items || []).filter(function (x) { return x.n === n; })[0];
  if (!it || !TG_SLUG_RE.test(String(it.slug || ''))) return { ok: false, why: 'no_pick' };
  var trip = tgScoutTargetTrip(rec);
  if (!trip) return { ok: false, why: 'no_trip' };
  tgLaterAdd(trip.slug, { place_slug: it.slug, name: it.name, reason: 'owner_choice' });
  var index = -1;
  tgLaterList(trip.slug).forEach(function (e, k) { if (e.place_slug === it.slug) index = k; });
  return { ok: true, trip: trip, item: it, index: index, days: tgDigestDays(trip.slug) };
}
/** The /places ➕ answer: "on the Later list", with one button per planned day (lt:… — promotes it with a replan). */
function tgScoutAddedMessage(r) {
  var kb = null;
  if (r.days.length && r.index >= 0) {
    kb = tgKeyboard(tgCmdRows(r.days.map(function (d) { return { text: d.n + ' · ' + tgCmdDate(d.date), data: cbEncode('lt', tgCmdTripKey(r.trip.slug), r.index + '.' + tgCmdTag(r.item.slug), d.n) }; }), 3));
  }
  return { html: '🔖 <b>' + tgEscape(r.item.name) + '</b> is on the Later list of ' + tgCmdTitle(r.trip) + '.' + (kb ? ' Put it on a day now?' : ''), keyboard: kb };
}

registerCallback('sc', function (ctx) {
  if (ctx.parts.length !== 2) { ctx.answer('Unknown button'); return; }
  var rec = tgScoutByKey(ctx.parts[0]), what = String(ctx.parts[1]);
  if (!rec) { ctx.answer('That scout is gone — send /scouts.'); return; }
  if (what === 's') { ctx.answer(''); tgScoutSend(ctx.chatId, rec); return; }
  if (!/^[1-9]\d?$/.test(what)) { ctx.answer('Unknown button'); return; }
  var r = tgScoutAddPick(rec, parseInt(what, 10));
  if (!r.ok) { ctx.answer(r.why === 'no_trip' ? 'No current trip — /plan one first.' : 'That pick is gone — send /scouts.', r.why === 'no_trip'); return; }
  ctx.answer('Added');
  var m = tgScoutAddedMessage(r);
  tgSend(ctx.chatId, m.html, m.keyboard ? { keyboard: m.keyboard } : undefined);
});

/* ==================== the `scout` envelope ==================== */

function tgScoutNormKey(k) { return String(k).toLowerCase().replace(/[^a-z]/g, ''); }
/** Every Google field name anywhere in the payload, as "path.key" (snake_case, camelCase or the API's own names). */
function tgScoutGoogleKeys(v, path, out) {
  out = out || [];
  var bad = TG_GOOGLE_FIELDS.map(tgScoutNormKey).concat(TG_SCOUT_GOOGLE_EXTRA);
  (function walk(x, at, depth) {
    if (depth > 6 || out.length > 20) return;
    if (Array.isArray(x)) { x.forEach(function (y, i) { walk(y, at + '[' + i + ']', depth + 1); }); return; }
    if (!isPlainObject(x)) return;
    Object.keys(x).forEach(function (k) {
      if (bad.indexOf(tgScoutNormKey(k)) >= 0) out.push((at ? at + '.' : '') + truncate(k, 40));
      walk(x[k], (at ? at + '.' : '') + truncate(k, 40), depth + 1);
    });
  })(v, path || '', 0);
  return out;
}
function tgEnvScoutItem(errs, at, it) {
  if (!tgEnvObj(errs, at, it, ['n', 'slug', 'name', 'area', 'category', 'score', 'parts', 'why_you', 'labels', 'maps_url'], ['try', 'rated', 'reach', 'place_id'])) return;
  if (it.n !== undefined) tgEnvInt(errs, at + '.n', it.n, 1, TG_SCOUT.ITEMS_MAX);
  if (it.slug !== undefined) tgEnvSlug(errs, at + '.slug', it.slug);
  if (it.name !== undefined) tgEnvStr(errs, at + '.name', it.name, 1, 120);
  if (it.area !== undefined) tgEnvStr(errs, at + '.area', it.area, 0, 80);
  if (it.category !== undefined) tgEnvStr(errs, at + '.category', it.category, 1, 32, TG_ENV_RE.category);
  if (it.score !== undefined) tgEnvInt(errs, at + '.score', it.score, 0, 100);
  if (it.parts !== undefined && tgEnvObj(errs, at + '.parts', it.parts, ['topic', 'quality', 'fit', 'reach'], ['local'])) {   // local: optional (C14)
    ['topic', 'quality', 'fit', 'local', 'reach'].forEach(function (k) { if (it.parts[k] !== undefined) tgEnvInt(errs, at + '.parts.' + k, it.parts[k], 0, 100); });
  }
  if (it.why_you !== undefined) tgEnvStr(errs, at + '.why_you', it.why_you, 1, 200);
  if (it['try'] !== undefined) tgEnvStr(errs, at + '.try', it['try'], 0, 120);
  if (it.labels !== undefined && tgEnvArr(errs, at + '.labels', it.labels, 8)) {
    it.labels.forEach(function (l, j) { tgEnvEnum(errs, at + '.labels[' + j + ']', l, TG_SCOUT_LABELS); });
    it.labels.forEach(function (l, j) { if (it.labels.indexOf(l) !== j) errs.push(at + '.labels[' + j + ']: duplicate label'); });
  }
  if (it.rated !== undefined) {
    tgEnvStr(errs, at + '.rated', it.rated, 1, 40);
    if (typeof it.rated === 'string' && /\d/.test(it.rated)) errs.push(at + '.rated must be a band word, never a number (own data only)');
  }
  if (it.reach !== undefined && tgEnvObj(errs, at + '.reach', it.reach, ['minutes', 'mode', 'estimated'])) {
    if (it.reach.minutes !== undefined) tgEnvInt(errs, at + '.reach.minutes', it.reach.minutes, 0, 600);
    if (it.reach.mode !== undefined) tgEnvEnum(errs, at + '.reach.mode', it.reach.mode, Object.keys(TG_SCOUT_MODES));
    if (it.reach.estimated !== undefined) tgEnvBool(errs, at + '.reach.estimated', it.reach.estimated);
  }
  if (it.maps_url !== undefined) tgEnvUrl(errs, at + '.maps_url', it.maps_url);
  if (it.place_id !== undefined) tgEnvStr(errs, at + '.place_id', it.place_id, 6, 300, TG_ENV_RE.placeId);
}
/** Mirror of schemas/tour-guide-scout.schema.json (TG-SCOUT §3): required keys, types, enums, sizes, rank order, no Google field. */
function tgEnvValidateScout(p) {
  var errs = [];
  if (!isPlainObject(p)) return ['payload must be an object'];
  tgScoutGoogleKeys(p, '').forEach(function (k) { errs.push(k + ': Google field refused (own data only)'); });
  if (!tgEnvObj(errs, 'payload', p, ['scout_id', 'query', 'destination', 'place_label', 'group', 'created_on', 'items', 'left_out'],
    ['v', 'kind', 'trip', 'from', 'diet', 'more', 'drive'])) return tgEnvDone(errs);
  tgEnvHead(errs, p, 'scout');
  if (p.scout_id !== undefined) tgEnvStr(errs, 'scout_id', p.scout_id, 1, 52, TG_SCOUT.ID_RE);
  if (p.query !== undefined) tgEnvStr(errs, 'query', p.query, 1, TG_SCOUT.QUERY_MAX);
  if (p.destination !== undefined) tgEnvSlug(errs, 'destination', p.destination);
  if (p.place_label !== undefined) tgEnvStr(errs, 'place_label', p.place_label, 1, 80);
  if (p.trip !== undefined) tgEnvSlug(errs, 'trip', p.trip);
  if (p.group !== undefined) tgEnvEnum(errs, 'group', p.group, TG_SCOUT_GROUPS);
  if (p.created_on !== undefined) tgEnvDate(errs, 'created_on', p.created_on);
  if (p.from !== undefined) tgEnvStr(errs, 'from', p.from, 1, 80);
  if (p.diet !== undefined) tgEnvStr(errs, 'diet', p.diet, 1, 80);
  if (p.more !== undefined) tgEnvInt(errs, 'more', p.more, 0);
  if (p.drive !== undefined && tgEnvObj(errs, 'drive', p.drive, [], ['board_html', 'board_pdf'])) {
    ['board_html', 'board_pdf'].forEach(function (k) { if (p.drive[k] !== undefined && p.drive[k] !== null) tgEnvStr(errs, 'drive.' + k, p.drive[k], 10, 200, TG_ENV_RE.driveId); });
  }
  if (p.items !== undefined && tgEnvArr(errs, 'items', p.items, TG_SCOUT.ITEMS_MAX)) {
    p.items.forEach(function (it, i) {
      tgEnvScoutItem(errs, 'items[' + i + ']', it);
      if (isPlainObject(it) && typeof it.n === 'number' && it.n !== i + 1) errs.push('items[' + i + '].n must be ' + (i + 1) + ' (rank order)');
    });
    tgEnvDupes(errs, 'items', p.items, 'slug', 'slug');
  }
  if (p.left_out !== undefined && tgEnvArr(errs, 'left_out', p.left_out, TG_SCOUT.LEFT_MAX)) {
    p.left_out.forEach(function (l, i) {
      var at = 'left_out[' + i + ']';
      if (!tgEnvObj(errs, at, l, ['name', 'reason'])) return;
      if (l.name !== undefined) tgEnvStr(errs, at + '.name', l.name, 1, 120);
      if (l.reason !== undefined) tgEnvEnum(errs, at + '.reason', l.reason, TG_SCOUT_LEFT);
    });
  }
  tgEnvSize(errs, p);
  return tgEnvDone(errs);
}

/**
 * The handler registers only while helper.json lists the `scout` envelope type (the engine work package adds it with the
 * pack schema): an unlisted type cannot be registered (registerEnvelopeHandler throws) and the core rejects such envelopes
 * as "unknown type", audited — the chat side (/scout, /scouts, sc buttons) works either way.
 */
if (ENVELOPE_TYPES.indexOf('scout') >= 0) {
  registerEnvelopeHandler('scout', {
    validate: function (p, env) { return tgEnvCleaned(tgEnvValidateScout)(p, env); },
    handle: function (env) {
      var st = tgScoutStore(env.payload), chat = tgOwnerChat(), last = null;
      if (chat) last = tgScoutSend(chat, st.rec);
      return { scout: st.rec.id, items: st.rec.items.length, left_out: st.rec.left_out.length, replaced: st.replaced, sent: !!(last && last.ok) };
    }
  });
}

// Developed by: LightAISolutions
