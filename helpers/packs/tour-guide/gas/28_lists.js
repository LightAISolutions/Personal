/**
 * Tour Guide pack — Lists (TG-PHASE-14 WP-14d, Contract C14 wave 2): the owner's saved Google Maps lists, read by the
 * routine from the newest Google Takeout "Saved" export in Drive and mirrored here as the Places tab's `lists` column.
 *   /lists             → one line per list with its count, the day the last `lists` request was answered, what to send next
 *   /lists sync        → request kind `lists` { trip? } (the current trip when there is one), routed to RESEARCH (below)
 *   /list <name>       → the list's places grouped by destination, with status and note line; at most 40, then "and N more"
 *   tgListNames()      → [{ name, count }] sorted by name (WP-14e's compare reads it; keep the shape)
 *   no envelope of its own (--no-envelope): the routine answers with a `places_digest` (places carry `lists`) and a `reply`
 *   no tab of its own (--no-tab): the Places tab's `lists` column (21_sheets.js: absent keeps it, [] clears it)
 * No timer here: the owner sends /lists sync after a new export. App: places.search's `list` filter and `lists` facet
 * (32_app_api.js). Pack side: packs/tour-guide/lists/. Tests: tests/pack_tour-guide_lists.test.js. Defaults:
 * helpers/decisions/WP-14d.md. Other pack files' names are touched only inside functions, at run time.
 * The @branch line below tells `new-branch.mjs --check lists` what this branch declares ("-" = not needed); keep it in step.
 */
// @branch lists command=/lists kind=lists envelope=- tab=- routine=RESEARCH app=-
var TG_LISTS = { KIND: 'lists', SHOW_MAX: 40, ASK_MAX: 10, NAME_SHOWN: 60 };

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

/* ==================== the commands ==================== */

/**
 * Open a `lists` request: the routine reads the newest Saved export and answers with a places digest and a reply.
 * The current trip rides along when there is one (new places from the lists may go to its destination); none → no trip.
 * opts = { chat?, text? } → { id, routine, fired, trip }
 */
function tgListsOpen(opts) {
  opts = opts || {};
  var trip = tgTripCurrent();
  var payload = trip ? { trip: trip.slug } : {};
  var r = tgOpenKindRequest('lists', payload, { chat: opts.chat || null, text: opts.text || '/lists sync',
    ack: '📋 Reading your newest saved-lists export' + (trip ? ' for <b>' + tgCmdTitle(trip) + '</b>' : '') + '…' });
  return { id: r.id, routine: r.routine, fired: !!(r.fired && r.fired.ok), trip: trip ? trip.slug : null };
}
/** The /lists message's lines (escaped). */
function tgListsSummaryLines() {
  var names = tgListNames(), last = tgListsLastRead();
  var lines = names.length ? ['📋 <b>Your lists</b>'].concat(names.map(function (l) { return tgEscape(l.name) + ' — ' + l.count; }))
    : ['📋 No lists yet — send /lists sync to read your newest saved-lists export.'];
  lines.push('', last ? 'Last read from an export: ' + tgEscape(last) : 'Not read from an export yet.');
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
  if (arg === 'sync') { tgListsOpen({ chat: ctx.chat, text: String(ctx.text || '') }); return; }
  if (arg) { ctx.reply('Usage: /lists · /lists sync · /list &lt;name&gt;'); return; }
  tgCmdSendAll(ctx.chatId, tgCmdMessages(tgListsSummaryLines()));
}, 'your saved Google Maps lists with their counts: /lists · /lists sync reads a newer export');

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
