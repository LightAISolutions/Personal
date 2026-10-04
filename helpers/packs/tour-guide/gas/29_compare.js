/**
 * Tour Guide pack — Compare: a branch written by helpers/tools/new-branch.mjs (helpers/tools/README.md "Branches"), filled in
 * by TG-PHASE-14 WP-14e (item 12; contract C14 wave 2; helpers/decisions/TG-SCOUT.md "Compare").
 *   /compare <a>, <b>[, <c>, <d>] [in <place>] → request kind `compare` { trip?, where?, names }   (two to four names)
 *   /compare <list> [in <place>]              → request kind `compare` { trip?, where?, list }    (one of the owner's lists,
 *                                               matched folded against tgListNames(), WP-14d's 28_lists.js)
 *   anything else                             → the usage line ("/lists shows your lists"); no request
 *   routed to RESEARCH (TG_KIND_ROUTINE, below), or to DISCOVER when that routine is configured (a discovery kind)
 *   no envelope of its own (--no-envelope): the answer is a `scout` envelope with mode "compare" (16_scout.js validates,
 *   stores and shows it — the ⚖️ card, its warnings and its ➕ buttons)
 *   no tab of its own (--no-tab): compare boards are rows of the Scouts tab (16_scout.js), with mode "compare"
 * No app operations (--no-app): the app shows compare boards on its Scout screen (35_scout_app.js scout.get).
 * Pack side: packs/tour-guide/compare/ and the engine's compare mode (scout/scout-rank.mjs rankScout mode "compare").
 * Tests: tests/pack_tour-guide_compare.test.js (the command), tests/pack_tour-guide_p14e_compare.test.js (the board).
 * Other pack files' names are touched only inside functions, at run time.
 * The @branch line below tells `new-branch.mjs --check compare` what this branch declares ("-" = not needed); keep it in step.
 */
// @branch compare command=/compare kind=compare envelope=- tab=- routine=RESEARCH app=- discover=yes
var TG_COMPARE = { NAMES_MIN: 2, NAMES_MAX: 4, NAME_MAX: 120, LIST_MAX: 80, WHERE_MAX: 80 };

// The kind's routing, added from this file: tgKindRoutine (00_common.js) reads the table at call time.
TG_KIND_ROUTINE['compare'] = 'RESEARCH';
// A discovery kind (--discover): with a DISCOVER routine configured, tgKindRoutine sends it there instead.
if (TG_DISCOVER_KINDS.indexOf('compare') < 0) TG_DISCOVER_KINDS.push('compare');

/* ==================== asking ==================== */

var TG_COMPARE_USAGE = '⚖️ Send two to four places, or one of your lists: <code>/compare Reed Mill, Pear Press</code> or ' +
  '<code>/compare Dinner list</code>, with <code>in &lt;place&gt;</code> if you like. /lists shows your lists.';

/** A list name folded for matching: lower case, no accents, single spaces. */
function tgCompareFold(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}
/** The owner's list whose folded name is `arg` (or `arg` without a leading "my "), in its stored spelling; '' when none. */
function tgCompareList(arg) {
  if (typeof tgListNames !== 'function') return '';   // WP-14d's lists module is not in this build
  var lists = _safe('tg_compare_lists', function () { return tgListNames(); }) || [];
  var want = [tgCompareFold(arg)];
  if (/^my /.test(want[0])) want.push(want[0].slice(3));
  for (var w = 0; w < want.length; w++) {
    for (var i = 0; i < lists.length; i++) {
      var name = lists[i] && typeof lists[i].name === 'string' ? lists[i].name : '';
      if (name && tgCompareFold(name) === want[w]) return name;
    }
  }
  return '';
}
/**
 * The owner's words → { ok: true, names? | list?, where? } | { ok: false }. Names are comma-separated; only the last part
 * may end in " in <place>" (an earlier " in " belongs to a name). One part alone must be one of the owner's lists.
 */
function tgCompareParse(text) {
  var parts = String(text || '').split(','), where = '';
  var last = parts[parts.length - 1], i = last.toLowerCase().lastIndexOf(' in ');
  if (i > 0) { where = last.slice(i + 4).replace(/\s+/g, ' ').trim(); parts[parts.length - 1] = last.slice(0, i); }
  parts = parts.map(function (p) { return p.replace(/\s+/g, ' ').trim(); });
  if (where.length > TG_COMPARE.WHERE_MAX || (i > 0 && !where)) return { ok: false };
  if (parts.some(function (p) { return !p || p.length > TG_COMPARE.NAME_MAX; })) return { ok: false };
  var out = { ok: true };
  if (where) out.where = where;
  if (parts.length === 1) {
    var list = tgCompareList(parts[0]);
    if (!list) return { ok: false };
    out.list = list.slice(0, TG_COMPARE.LIST_MAX);
    return out;
  }
  if (parts.length > TG_COMPARE.NAMES_MAX) return { ok: false };
  out.names = parts;
  return out;
}

/** Open a `compare` request: q = tgCompareParse's result; opts = { chat?, text? } → { ok: true, id, routine, fired, trip } */
function tgCompareOpen(q, opts) {
  opts = opts || {};
  var trip = tgTripCurrent(), payload = {};
  if (trip) payload.trip = trip.slug;
  if (q.where) payload.where = q.where;
  if (q.list) payload.list = q.list; else payload.names = q.names.slice();
  var what = q.list ? 'your list <b>' + tgEscape(q.list) + '</b>' : '<b>' + tgEscape(q.names.join(', ')) + '</b>';
  var r = tgOpenKindRequest('compare', payload, { chat: opts.chat || null, text: opts.text || '/compare',
    ack: '⚖️ Comparing ' + what + (q.where ? ' in <b>' + tgEscape(q.where) + '</b>' : '') + '…' });
  return { ok: true, id: r.id, routine: r.routine, fired: !!(r.fired && r.fired.ok), trip: payload.trip || '' };
}

registerCommand('/compare', function (ctx) {
  var q = tgCompareParse(ctx.args);
  if (!q.ok) { ctx.reply(TG_COMPARE_USAGE); return; }
  tgCompareOpen(q, { chat: ctx.chat, text: String(ctx.text || '') });
}, 'two to four places, or one of your lists, side by side: /compare Reed Mill, Pear Press');

// Developed by: LightAISolutions
