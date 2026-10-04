/**
 * Tour Guide pack — Lists (TG-PHASE-14 WP-14d, Contract C14 wave 2): the owner's saved Google Maps lists, read by the
 * routine from the newest Google Takeout "Saved" export in Drive and mirrored here as the Places tab's `lists` column.
 *   /lists             → one line per list with its count, the day the last `lists` request was answered, what to send next
 *   /lists sync        → request kind `lists` { trip?, takeout? } (the current trip when there is one), routed to RESEARCH
 *                        (below); with no Takeout export in Drive it explains how to make one and opens nothing (WP-14f)
 *   /lists auto on|off → whether the daily check reads a new export by itself (setting `lists_auto`, default on)
 *   /list <name>       → the list's places grouped by destination, with status and note line; at most 40, then "and N more"
 *   tgListNames()      → [{ name, count }] sorted by name (WP-14e's compare reads it; keep the shape)
 *   no envelope of its own (--no-envelope): the routine answers with a `places_digest` (places carry `lists`) and a `reply`
 *   no tab of its own (--no-tab): the Places tab's `lists` column (21_sheets.js: absent keeps it, [] clears it)
 *   ?route=takeout     → (WP-14f) the routine lists the owner's newest Takeout exports and fetches one part's exact bytes,
 *                        under a `lists` or `research` request's upload key; reads Drive, never changes it
 *   daily job          → tg_lists_takeout: one automatic `lists` request { trip?, takeout, auto } for a new export, once
 *                        a `lists` request has been answered at least once
 * App: places.search's `list` filter and `lists` facet (32_app_api.js). Pack side: packs/tour-guide/lists/ (the client:
 * lists/lists-fetch.mjs). Tests: tests/pack_tour-guide_lists.test.js, tests/pack_tour-guide_lists_takeout.test.js.
 * Defaults: helpers/decisions/WP-14d.md, helpers/decisions/WP-14f.md. Other pack files' names are touched only inside
 * functions, at run time.
 * The @branch line below tells `new-branch.mjs --check lists` what this branch declares ("-" = not needed); keep it in step.
 */
// @branch lists command=/lists kind=lists envelope=- tab=- routine=RESEARCH app=-
var TG_LISTS = {
  KIND: 'lists', SHOW_MAX: 40, ASK_MAX: 10, NAME_SHOWN: 60,
  // WP-14f — the Takeout fetch. Mirrored in lists/lists-fetch.mjs (a test keeps the name pattern equal).
  TAKEOUT_FOLDER: 'Takeout',                          // in My Drive's root; its files and its direct subfolders' files
  TAKEOUT_RE: /^takeout-(\d{8}T\d{6}Z)(?:-(\d{1,3}))?-(\d{1,4})\.(zip|tgz)$/i,   // stamp, optional middle number, part
  TAKEOUT_KINDS: ['lists', 'research'],               // the request kinds whose key may read the owner's exports
  TAKEOUT_EXPORTS_MAX: 3,                             // newest first
  TAKEOUT_PART_MAX_BYTES: 10 * 1024 * 1024,           // a get of a larger part is refused (413)
  TAKEOUT_EXPORT_MAX_BYTES: 30 * 1024 * 1024,         // a larger export is flagged too_large
  TAKEOUT_GETS_MAX: 10,                               // gets per request, counted in the script cache
  TAKEOUT_GETS_TTL_SEC: 21600,
  SET_AUTO: 'lists_auto',                             // 'off' stops the daily check; anything else is on
  SET_SEEN: 'lists_takeout_seen'                      // the group key of the newest export a lists request was opened for
};

// The kind's routing, added from this file: tgKindRoutine (00_common.js) reads the table at call time.
TG_KIND_ROUTINE['lists'] = 'RESEARCH';

/* ==================== reading ==================== */

/** Folded for comparing and sorting: case, accents and runs of spaces do not matter. */
function tgListsFold(s) { return tgShFold(s).replace(/\s+/g, ' ').trim(); }
function tgListsByName(a, b) {
  var x = tgListsFold(a), y = tgListsFold(b);
  return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0;
}

/** Every list name on a stored place, with how many places are on it: [{ name, count }], sorted by name. */
function tgListNames() {
  var counts = {};
  storeAll(TG_SHEETS.PLACES).forEach(function (r) {
    var seen = {};
    tgShPlaceLists(r.lists).forEach(function (n) {
      if (seen[n]) return;
      seen[n] = true;
      counts[n] = (counts[n] || 0) + 1;
    });
  });
  return Object.keys(counts).sort(tgListsByName).map(function (n) { return { name: n, count: counts[n] }; });
}
/** The stored places on one list (exact name), by destination then name. */
function tgListPlaces(name) {
  return storeAll(TG_SHEETS.PLACES).map(tgShPlaceOut).filter(function (p) {
    return p && Array.isArray(p.lists) && p.lists.indexOf(name) >= 0;
  }).sort(function (a, b) {
    if (a.destination !== b.destination) return !a.destination ? 1 : !b.destination ? -1 : a.destination < b.destination ? -1 : 1;
    return tgListsByName(a.name, b.name);
  });
}
/** The day ('YYYY-MM-DD', owner's zone) the last `lists` request was answered (the core's Requests record), or ''. */
function tgListsLastRead() {
  var best = null;
  storeFind(SHEETS.REQUESTS, function (r) { return r.kind === TG_LISTS.KIND && r.status === 'answered'; }).forEach(function (r) {
    var d = r.answered_at instanceof Date ? r.answered_at : parseIso(String(r.answered_at || ''));
    if (d && !isNaN(d.getTime()) && (!best || d.getTime() > best.getTime())) best = d;
  });
  return best ? isoDateIn(tgOwnerTz(), best) : '';
}
/**
 * The list a name means: the one whose folded name equals it, else the one it starts, else the one it is part of.
 * → { name } | { ambiguous: [names] } | { none: true }
 */
function tgListResolve(text, names) {
  var q = tgListsFold(text);
  var all = (names || tgListNames()).map(function (l) { return l.name; });
  var tiers = [
    all.filter(function (n) { return tgListsFold(n) === q; }),
    all.filter(function (n) { return tgListsFold(n).indexOf(q) === 0; }),
    all.filter(function (n) { return tgListsFold(n).indexOf(q) > 0; })
  ];
  for (var i = 0; i < tiers.length; i++) {
    if (tiers[i].length === 1) return { name: tiers[i][0] };
    if (tiers[i].length > 1) return { ambiguous: tiers[i] };
  }
  return { none: true };
}

/* ==================== the Takeout exports in Drive (WP-14f) ==================== */

/** An export's group key: its stamp, plus the middle number padded to three digits when the name has one. Sorts as it compares. */
function tgTakeoutKey(stamp, middle) { return stamp + (middle ? '-' + ('00' + middle).slice(-3) : ''); }

/**
 * The Takeout parts the routine may see: files of every non-trashed `Takeout` folder in My Drive's root and of its
 * non-trashed direct subfolders, not trashed, named like a Takeout part. A name seen twice keeps its first file.
 * Reads only: nothing is written, moved, renamed, shared or trashed. → [{ file, name, stamp, middle, part }]
 */
function tgTakeoutFiles() {
  var out = [], seen = {};
  var add = function (it) {
    while (it.hasNext()) {
      var f = it.next();
      if (f.isTrashed()) continue;
      var name = String(f.getName()), m = TG_LISTS.TAKEOUT_RE.exec(name);
      if (!m || seen[name]) continue;
      seen[name] = true;
      out.push({ file: f, name: name, stamp: m[1].toUpperCase(), middle: m[2] || '', part: parseInt(m[3], 10) });
    }
  };
  var roots = DriveApp.getRootFolder().getFoldersByName(TG_LISTS.TAKEOUT_FOLDER);
  while (roots.hasNext()) {
    var t = roots.next();
    if (t.isTrashed()) continue;
    add(t.getFiles());
    var subs = t.getFolders();
    while (subs.hasNext()) { var sub = subs.next(); if (!sub.isTrashed()) add(sub.getFiles()); }
  }
  return out;
}
/**
 * The newest TAKEOUT_EXPORTS_MAX exports, newest first (stamp, then middle number, descending), and the files of their
 * parts by name: { exports: [{ key, stamp, created, bytes, parts: [{ name, bytes }], too_large }], files: { name: file } }.
 */
function tgTakeoutScan() {
  var groups = {};
  tgTakeoutFiles().forEach(function (x) {
    var key = tgTakeoutKey(x.stamp, x.middle);
    if (!groups[key]) groups[key] = { key: key, stamp: x.stamp, middle: x.middle ? parseInt(x.middle, 10) : -1, files: [] };
    groups[key].files.push(x);
  });
  var files = {};
  var exports = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) {
    return a.stamp < b.stamp ? 1 : a.stamp > b.stamp ? -1 : b.middle - a.middle;
  }).slice(0, TG_LISTS.TAKEOUT_EXPORTS_MAX).map(function (g) {
    var bytes = 0, created = null, big = false;
    var parts = g.files.sort(function (a, b) { return a.part - b.part || (a.name < b.name ? -1 : 1); }).map(function (x) {
      var n = Number(x.file.getSize()) || 0, d = x.file.getDateCreated();
      bytes += n;
      if (n > TG_LISTS.TAKEOUT_PART_MAX_BYTES) big = true;
      if (d && !isNaN(d.getTime()) && (!created || d.getTime() < created.getTime())) created = d;
      files[x.name] = x.file;
      return { name: x.name, bytes: n };
    });
    return { key: g.key, stamp: g.stamp, created: created ? new Date(created.getTime()).toISOString() : '', bytes: bytes, parts: parts,
      too_large: big || bytes > TG_LISTS.TAKEOUT_EXPORT_MAX_BYTES };
  });
  return { exports: exports, files: files };
}
/** The exports, newest first (tgTakeoutScan without the files). */
function tgTakeoutExports() { return tgTakeoutScan().exports; }
/** The newest export, null when there is none, undefined when Drive could not be read (audited). */
function tgListsNewestExport() {
  try { return tgTakeoutExports()[0] || null; } catch (err) { auditFail('tg_lists_takeout_error', '', describeError(err)); return undefined; }
}
/** '1 KB' · '412 KB' · '1.5 MB'. */
function tgListsSize(bytes) {
  var n = Number(bytes) || 0;
  return n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : Math.round(n / 104857.6) / 10 + ' MB';
}

/* ==================== ?route=takeout (WP-14f) ==================== */

var TG_TAKEOUT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A refusal: audited with the request id once its key checked out, else at most once per 6 h per reason. */
function tgTakeoutRefuse(status, reason, id) {
  if (id) auditFail('takeout_refused', id, { reason: reason });
  else if (!seenOnce('takeout:refused:' + reason)) auditFail('takeout_refused', '', { reason: reason });
  return { status: status, body: { ok: false, status: status, reason: reason } };
}
/**
 * POST ?route=takeout, body { req, key, op: 'list' | 'get', name? }. The auth is the request's upload key (uploadKey,
 * 16_upload.js) on an open — or answered within LIMITS.UPLOAD_AFTER_ANSWER_MIN — `lists` or `research` request younger
 * than LIMITS.REQUEST_MAX_AGE_HOURS. list → { ok, exports }; get → { ok, name, bytes, created, data (base64) }.
 * Refusals { ok: false, status, reason }, checked in this order: not_set_up, bad_request_id, bad_key, unknown_request,
 * wrong_kind, request_too_old, request_closed, bad_op; then for a get unknown_file, too_large, too_many_gets.
 */
function tgTakeoutRoute(req) {
  if (!getProp(PROP.SHEET_ID)) return tgTakeoutRefuse(503, 'not_set_up', '');
  var b = req && isPlainObject(req.body) ? req.body : {};
  var id = typeof b.req === 'string' ? b.req.replace(/^req_/, '') : '';
  if (!TG_TAKEOUT_ID_RE.test(id)) return tgTakeoutRefuse(400, 'bad_request_id', '');
  if (!safeEqual(b.key === undefined || b.key === null ? '' : String(b.key), uploadKey(id))) return tgTakeoutRefuse(403, 'bad_key', '');
  var row = getRequest(id);
  if (!row) return tgTakeoutRefuse(404, 'unknown_request', id);
  if (TG_LISTS.TAKEOUT_KINDS.indexOf(String(row.kind)) < 0) return tgTakeoutRefuse(403, 'wrong_kind', id);
  var created = new Date(row.created_at).getTime();
  if (!(created > 0) || nowMs() - created > LIMITS.REQUEST_MAX_AGE_HOURS * 3600000) return tgTakeoutRefuse(403, 'request_too_old', id);
  if (row.status !== 'open') {
    var answered = new Date(row.answered_at).getTime();
    if (row.status !== 'answered' || !(answered > 0) || nowMs() - answered > LIMITS.UPLOAD_AFTER_ANSWER_MIN * 60000) return tgTakeoutRefuse(403, 'request_closed', id);
  }
  if (b.op !== 'list' && b.op !== 'get') return tgTakeoutRefuse(400, 'bad_op', id);
  var scan = tgTakeoutScan();
  if (b.op === 'list') {
    return { status: 200, body: { ok: true, exports: scan.exports.map(function (e) {
      return { stamp: e.stamp, created: e.created, bytes: e.bytes, parts: e.parts, too_large: e.too_large };
    }) } };
  }
  var name = typeof b.name === 'string' ? b.name : '';
  var file = name && Object.prototype.hasOwnProperty.call(scan.files, name) ? scan.files[name] : null;
  if (!file) return tgTakeoutRefuse(404, 'unknown_file', id);
  if ((Number(file.getSize()) || 0) > TG_LISTS.TAKEOUT_PART_MAX_BYTES) return tgTakeoutRefuse(413, 'too_large', id);
  var cache = CacheService.getScriptCache(), ck = 'takeout:n:' + id, used = parseInt(cache.get(ck) || '0', 10) || 0;
  if (used >= TG_LISTS.TAKEOUT_GETS_MAX) return tgTakeoutRefuse(429, 'too_many_gets', id);
  cache.put(ck, String(used + 1), TG_LISTS.TAKEOUT_GETS_TTL_SEC);
  var bytes = file.getBlob().getBytes(), d = file.getDateCreated();
  audit('takeout_get', id, { name: name, bytes: bytes.length });
  return { status: 200, body: { ok: true, name: name, bytes: bytes.length, created: d ? new Date(d.getTime()).toISOString() : '',
    data: Utilities.base64Encode(bytes) } };
}
registerRoute('takeout', { methods: ['POST'], auth: 'none', handler: tgTakeoutRoute, lock: false });

/* ==================== the daily check (WP-14f) ==================== */

/**
 * Once a day: open ONE `lists` request { trip?, takeout, auto: true } when automatic reading is on, a `lists` request has
 * been answered before (the routine side has shown it answers the kind), the newest export's group key is past the
 * last one seen, and no `lists` request is open. → 'off' | 'never_synced' | 'none' | 'seen' | 'open' | 'opened' | 'error'.
 */
function tgListsTakeoutDaily() {
  try {
    if (settingGet(TG_LISTS.SET_AUTO, '') === 'off') return 'off';
    if (!tgListsLastRead()) return 'never_synced';
    var newest = tgTakeoutExports()[0];
    if (!newest) return 'none';
    if (!(newest.key > settingGet(TG_LISTS.SET_SEEN, ''))) return 'seen';
    if (listOpenRequests().some(function (r) { return r.kind === TG_LISTS.KIND; })) return 'open';
    tgListsOpen({ takeout: newest.stamp, auto: true });
    settingSet(TG_LISTS.SET_SEEN, newest.key);
    return 'opened';
  } catch (err) {
    auditFail('tg_lists_takeout_error', '', describeError(err));
    return 'error';
  }
}
registerDailyJob('tg_lists_takeout', tgListsTakeoutDaily);

/* ==================== the commands ==================== */

/**
 * Open a `lists` request: the routine reads the newest Saved export and answers with a places digest and a reply.
 * The current trip rides along when there is one (new places from the lists may go to its destination); none → no trip.
 * opts = { chat?, text?, takeout? (the export's stamp), auto? (opened by the daily check) } → { id, routine, fired, trip }
 */
function tgListsOpen(opts) {
  opts = opts || {};
  var trip = tgTripCurrent();
  var payload = trip ? { trip: trip.slug } : {};
  if (opts.takeout) payload.takeout = String(opts.takeout);
  if (opts.auto) payload.auto = true;
  var forTrip = trip ? ' for <b>' + tgCmdTitle(trip) + '</b>' : '';
  var r = tgOpenKindRequest('lists', payload, { chat: opts.chat || null, text: opts.text || (opts.auto ? '/lists sync (a new export in Drive)' : '/lists sync'),
    ack: opts.auto ? '📋 A new saved-lists export is in Drive — reading it' + forTrip + '…' : '📋 Reading your newest saved-lists export' + forTrip + '…' });
  return { id: r.id, routine: r.routine, fired: !!(r.fired && r.fired.ok), trip: trip ? trip.slug : null };
}
/** How to make an export (escaped). */
function tgListsHowTo() {
  return '📋 No saved-lists export in Drive yet. To make one: takeout.google.com → <b>Deselect all</b> → tick only <b>Saved</b> → ' +
    'Next step → delivery <b>Add to Drive</b>, frequency <b>Export every 2 months</b>, file type .zip or .tgz. ' +
    'When Takeout says it is ready, send /lists sync.';
}
/** /lists sync: an export in Drive → the request (with its stamp; the export counts as seen); none → how to make one. */
function tgListsSync(ctx) {
  var newest = tgListsNewestExport();   // undefined (Drive unreadable): the request still goes, as before WP-14f
  if (newest === null) { ctx.reply(tgListsHowTo()); return; }
  tgListsOpen({ chat: ctx.chat, text: String(ctx.text || ''), takeout: newest ? newest.stamp : '' });
  if (newest) settingSet(TG_LISTS.SET_SEEN, newest.key);
}
/** /lists auto on|off. */
function tgListsAuto(ctx, value) {
  if (value !== 'on' && value !== 'off') { ctx.reply('Usage: /lists auto on · /lists auto off'); return; }
  settingSet(TG_LISTS.SET_AUTO, value);
  ctx.reply(value === 'off' ? '📋 Automatic reading is off — send /lists sync after a new export.' : '📋 New saved-lists exports in Drive will be read automatically.');
}
/** The /lists message's lines (escaped). */
function tgListsSummaryLines() {
  var names = tgListNames(), last = tgListsLastRead();
  var lines = names.length ? ['📋 <b>Your lists</b>'].concat(names.map(function (l) { return tgEscape(l.name) + ' — ' + l.count; }))
    : ['📋 No lists yet — send /lists sync to read your newest saved-lists export.'];
  lines.push('', last ? 'Last read from an export: ' + tgEscape(last) : 'Not read from an export yet.');
  var ex = tgListsNewestExport();
  if (ex) {
    var when = ex.created ? isoDateIn(tgOwnerTz(), new Date(ex.created)) + ', ' : '';
    lines.push('Newest export in Drive: ' + when + tgListsSize(ex.bytes) + (ex.too_large ? ' — too large to read' : ''));
  } else if (ex === null) {
    lines.push('No saved-lists export in Drive yet — takeout.google.com → Deselect all → only Saved → Add to Drive, every 2 months.');
  }
  if (last) lines.push(settingGet(TG_LISTS.SET_AUTO, '') === 'off' ? 'Automatic reading is off — /lists auto on to resume' : 'New exports are read automatically — /lists auto off to stop');
  if (names.length) lines.push('/list &lt;name&gt; to see one · /lists sync to read a newer export');
  return lines;
}
/** The /list <name> messages: the places grouped by destination, at most SHOW_MAX, the app row on the last message. */
function tgListMessages(name) {
  var places = tgListPlaces(name), shown = places.slice(0, TG_LISTS.SHOW_MAX);
  var lines = ['📋 <b>' + tgEscape(name) + '</b> — ' + places.length + ' place' + (places.length === 1 ? '' : 's')];
  var dest = null;
  shown.forEach(function (p) {
    if (p.destination !== dest) { dest = p.destination; lines.push('', '<b>' + tgEscape(dest || '(no destination)') + '</b>'); }
    var line = '• ' + tgCmdHref(p.maps_url, p.name) + (p.status ? ' · ' + tgEscape(p.status) : '');
    lines.push(p.note_line ? line + '\n   <i>' + tgEscape(p.note_line) + '</i>' : line);
  });
  if (places.length > shown.length) lines.push('', '… and ' + (places.length - shown.length) + ' more — open Places in the app');
  var app = tgCmdAppRows();
  return tgCmdMessages(lines, app.length ? tgKeyboard(app) : undefined);
}

registerCommand('/lists', function (ctx) {
  var arg = String(ctx.args || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (arg === 'sync') { tgListsSync(ctx); return; }
  var auto = /^auto(?: (.*))?$/.exec(arg);
  if (auto) { tgListsAuto(ctx, auto[1] || ''); return; }
  if (arg) { ctx.reply('Usage: /lists · /lists sync · /list &lt;name&gt; · /lists auto on|off'); return; }
  tgCmdSendAll(ctx.chatId, tgCmdMessages(tgListsSummaryLines()));
}, 'your saved Google Maps lists with their counts: /lists · /lists sync reads the newest export · /lists auto on|off');

registerCommand('/list', function (ctx) {
  var arg = String(ctx.args || '').replace(/\s+/g, ' ').trim();
  if (!arg) { ctx.reply('Usage: /list &lt;name&gt; — /lists shows your lists'); return; }
  var r = tgListResolve(arg);
  if (r.none) { ctx.reply('No list called “' + tgEscape(truncate(arg, TG_LISTS.NAME_SHOWN)) + '” — /lists shows them'); return; }
  if (r.ambiguous) {
    var some = r.ambiguous.slice(0, TG_LISTS.ASK_MAX).map(tgEscape).join(' · ');
    ctx.reply('Which list? ' + some + (r.ambiguous.length > TG_LISTS.ASK_MAX ? ' · …' : ''));
    return;
  }
  tgCmdSendAll(ctx.chatId, tgListMessages(r.name));
}, 'one saved list\'s places by destination: /list <name>');

// Developed by: LightAISolutions
