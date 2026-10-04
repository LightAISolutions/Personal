/**
 * Tour Guide Scout in the app (TG-SCOUT §5, WP-S gas): the app ops behind the Scout screen, added to TG_APP_OPS
 * (32_app_api.js) — no hook needed, the table is read at request time.
 *   scout.list              → the last 20 scouts, head fields only
 *   scout.get   { id }      → one scout: its ranked picks and what was left out (own fields only)
 *   scout.board { id }      → the comparison board HTML inline (≤ TG_APP_SCOUT_MAX_CHARS) or its Drive link; the file must
 *                             sit inside the helper's Drive folder (the brochure.get rule: elsewhere → audited, no_board)
 *   scout.new   { query, where? }  (write) → opens a `scout` request (16_scout.js tgScoutOpen)
 *   scout.add   { id, n }          (write) → pick n onto the Later list of the scout's trip (or the current trip)
 * No Google call and no Google content. Reasons: helpers/decisions/WP-S-gas.md.
 */
var TG_APP_SCOUT_MAX_CHARS = 900000;   // scout.board answers the HTML inline up to this length, else the Drive link
var TG_APP_SCOUT_LIST = 20;

function tgAppScoutHead(rec) {
  var head = { id: rec.id, created_on: rec.created_on, query: rec.query, destination: rec.destination, place_label: rec.place_label,
    trip: rec.trip, group: rec.group, count: rec.count, has_board: !!rec.drive_html, has_pdf: !!rec.drive_pdf,
    received_at: rec.received_at };
  if (rec.mode === 'compare') { head.mode = 'compare'; head.source = rec.source; }   // WP-14e: a scout board's head is unchanged
  return head;
}
function tgAppScoutArg(args) {
  var id = tgAppStr(args, 'id', { required: true, max: 64, re: TG_SCOUT.ID_RE });
  var rec = tgScoutGet(id);
  if (!rec) tgAppRefuse(404, 'no_scout');
  return rec;
}

function tgAppOpScoutList() {
  var all = tgScoutList(0);
  return tgAppOk({ scouts: all.slice(0, TG_APP_SCOUT_LIST).map(tgAppScoutHead), total: all.length });
}

function tgAppOpScoutGet(args) {
  var rec = tgAppScoutArg(args), head = tgAppScoutHead(rec), trip = tgScoutTargetTrip(rec);
  head.items = rec.items;
  head.left_out = rec.left_out;
  head.add_to = trip ? { slug: trip.slug, title: tgAppS(trip.title || trip.destination || trip.slug) } : null;
  return tgAppOk({ scout: head });
}

/** A Drive id the app may open: 'in' the helper's folder; 'outside' is audited. → the file or null. */
function tgAppScoutFile(id, what, scout) {
  if (!id) return null;
  var where = tgCmdDriveWhere(id);
  if (where === 'outside') { auditFail('tg_app_scout_outside_root', String(id), { scout: scout, file: what }); return null; }
  if (where !== 'in') return null;
  return DriveApp.getFileById(String(id));
}

function tgAppOpScoutBoard(args) {
  var rec = tgAppScoutArg(args), file = tgAppScoutFile(rec.drive_html, 'board_html', rec.id);
  if (!file) return tgAppNo(404, 'no_board');
  var head = { id: rec.id }, pdf = tgAppScoutFile(rec.drive_pdf, 'board_pdf', rec.id);
  if (pdf) head.pdf_link = pdf.getUrl();
  var link = function () { head.link = file.getUrl(); return tgAppOk(head); };
  if (file.getSize() > 4 * TG_APP_SCOUT_MAX_CHARS) return link();   // bytes; never read a file that cannot fit
  if (String(file.getMimeType() || '').toLowerCase().indexOf('text/html') !== 0) return link();   // only HTML goes inline
  var html = file.getBlob().getDataAsString();
  if (html.length > TG_APP_SCOUT_MAX_CHARS) return link();
  head.html = html;
  return tgAppOk(head);
}

function tgAppOpScoutNew(args) {
  var query = tgAppStr(args, 'query', { required: true, max: TG_SCOUT.QUERY_MAX });
  var where = tgAppStr(args, 'where', { max: TG_SCOUT.WHERE_MAX });
  var r = tgScoutOpen(query, where, {});   // the request text reads `/scout <what> in <where>`, no suffix (WP-13c item 7)
  if (!r.ok) return r.why === 'no_place' ? tgAppNo(400, 'no_place') : tgAppNo(400, r.why === 'too_long' ? 'too_long' : 'missing_arg', { field: r.field || 'query' });
  return tgAppOk({ request_id: r.id, routine: r.routine, fired: r.fired, query: r.query, where: r.where, trip: r.trip });
}

function tgAppOpScoutAdd(args) {
  var n = args.n;
  if (n === undefined || n === null) tgAppRefuse(400, 'missing_arg', { field: 'n' });
  if (typeof n !== 'number' || n !== Math.floor(n) || n < 1 || n > TG_SCOUT.ITEMS_MAX) tgAppRefuse(400, 'bad_args', { field: 'n' });
  var rec = tgAppScoutArg(args), r = tgScoutAddPick(rec, n);
  if (!r.ok) return r.why === 'no_trip' ? tgAppNo(409, 'no_trip') : tgAppNo(404, 'no_pick');
  return tgAppOk({ trip: r.trip.slug, slug: r.item.slug, name: r.item.name, later: tgLaterList(r.trip.slug).length });
}

TG_APP_OPS['scout.list'] = { args: [], fn: tgAppOpScoutList };
TG_APP_OPS['scout.get'] = { args: ['id'], fn: tgAppOpScoutGet };
TG_APP_OPS['scout.board'] = { args: ['id'], fn: tgAppOpScoutBoard };
TG_APP_OPS['scout.new'] = { args: ['query', 'where'], write: true, fn: tgAppOpScoutNew };
TG_APP_OPS['scout.add'] = { args: ['id', 'n'], write: true, fn: tgAppOpScoutAdd };

// Developed by: LightAISolutions
