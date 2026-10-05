/**
 * Tour Guide: how far along a request is, for the app's progress bar (Phase 17d; Jon, 5 Oct 2026: "an ETA or a progress
 * bar that shows live progress"). Added to TG_APP_OPS (32_app_api.js) from this file:
 *   requests.status { id } → { id, kind, status: open | answered | failed | expired, started, fire_problem, created_at,
 *                              answered_at, elapsed_sec, eta_sec, eta_from: history | default, samples }
 * The core cannot see inside a routine's run, so the estimate is measured, not reported: the median time from asking to
 * answer (the Requests tab's created_at → answered_at) over the last TG_REQ_ETA.SAMPLES answered requests of the same kind,
 * else a default per kind until TG_REQ_ETA.MIN_SAMPLES have been answered. Read only; ids are the core's request uuids,
 * which the app already gets back from every op that asks something (scout.new, daytrip.new, …, commands.run).
 */
var TG_REQ_ETA = {
  SAMPLES: 9, MIN_SAMPLES: 2, MAX_SEC: 7200, ROUND_SEC: 15, ID_RE: /^[0-9a-fA-F-]{8,64}$/,
  DEFAULT_SEC: 300,
  DEFAULTS: { vegcard: 120, scout: 240, menu: 300, quiet: 360, whatson: 420, daytrip: 480, daybook: 420 }
};
function tgReqMs(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? 0 : v.getTime();
  var d = parseIso(String(v || ''));
  return d ? d.getTime() : 0;
}
/** How long a request of this kind usually takes → { sec, from: 'history' | 'default', samples }. */
function tgReqEta(kind) {
  kind = String(kind || '');
  var secs = storeFind(SHEETS.REQUESTS, function (r) { return String(r.kind) === kind && String(r.status) === 'answered'; })
    .map(function (r) { var a = tgReqMs(r.created_at), b = tgReqMs(r.answered_at); return a && b ? (b - a) / 1000 : -1; })
    .filter(function (s) { return s > 0 && s <= TG_REQ_ETA.MAX_SEC; })
    .slice(-TG_REQ_ETA.SAMPLES);   // row order is asking order: the newest last
  if (secs.length < TG_REQ_ETA.MIN_SAMPLES) {
    return { sec: Object.prototype.hasOwnProperty.call(TG_REQ_ETA.DEFAULTS, kind) ? TG_REQ_ETA.DEFAULTS[kind] : TG_REQ_ETA.DEFAULT_SEC, from: 'default', samples: secs.length };
  }
  secs.sort(function (x, y) { return x - y; });
  var m = secs.length % 2 ? secs[(secs.length - 1) / 2] : (secs[secs.length / 2 - 1] + secs[secs.length / 2]) / 2;
  return { sec: Math.max(TG_REQ_ETA.ROUND_SEC, Math.round(m / TG_REQ_ETA.ROUND_SEC) * TG_REQ_ETA.ROUND_SEC), from: 'history', samples: secs.length };
}
function tgAppOpRequestStatus(args) {
  var id = tgAppStr(args, 'id', { required: true, max: 64, re: TG_REQ_ETA.ID_RE });
  var r = getRequest(id);
  if (!r) tgAppRefuse(404, 'not_found');
  var kind = String(r.kind || ''), status = String(r.status || 'open'), fired = String(r.fired || '');
  var created = tgReqMs(r.created_at), answered = tgReqMs(r.answered_at), eta = tgReqEta(kind);
  var end = status === 'answered' && answered ? answered : nowMs();
  return tgAppOk({
    id: String(r.id), kind: kind, status: ['open', 'answered', 'failed', 'expired'].indexOf(status) >= 0 ? status : 'open',
    started: fired === 'yes', fire_problem: fired && fired !== 'yes' ? truncate(fired, 40) : '',
    created_at: created ? new Date(created).toISOString() : '', answered_at: answered ? new Date(answered).toISOString() : '',
    elapsed_sec: created ? Math.max(0, Math.round((end - created) / 1000)) : 0,
    eta_sec: eta.sec, eta_from: eta.from, samples: eta.samples
  });
}
TG_APP_OPS['requests.status'] = { args: ['id'], fn: tgAppOpRequestStatus };

// Developed by: LightAISolutions
