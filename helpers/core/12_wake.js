/**
 * Helpers core — wake route, sweeps, requests and one-off triggers.
 * There is NO permanent time trigger. Work happens when:
 *   · the brain calls GET/POST ?route=wake after writing an envelope (unauthenticated, rate-limited, idempotent),
 *   · a one-off trigger fires: fallback sweeps scheduled when a request opens (+3 and +10 min), an hourly follow-up
 *     while a request is open, or the queue worker (06_queue.js),
 *   · the owner presses "Sweep + write snapshot" on the setup page (/wake in Telegram schedules a one-off trigger),
 *   · the single pending alarm trigger fires (17_alarms.js: registerAlarm — e.g. a booking reminder at a set time).
 * Daily housekeeping (registerDailyJob) runs once per local day inside the first sweep of that day.
 */
var ONE_OFF_HANDLERS = ['queueTrigger', 'wakeTrigger', 'alarmTrigger'];   // alarmTrigger: 17_alarms.js (at most one pending)

function scheduleOneOff(fn, minutes) {
  if (ONE_OFF_HANDLERS.indexOf(fn) < 0) throw new Error('scheduleOneOff: unknown handler ' + fn);
  ScriptApp.newTrigger(fn).timeBased().after(Math.max(1, Math.round(minutes || 1)) * 60000).create();
}
/** Delete the trigger that fired this run (Apps Script does not remove one-off triggers after they fire). */
function deleteOneOffTrigger(e) {
  var uid = e && e.triggerUid;
  if (!uid) return false;
  var found = false;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (String(t.getUniqueId()) === String(uid)) { ScriptApp.deleteTrigger(t); found = true; }
  });
  return found;
}
function listTriggers() { return ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); }).sort(); }
/** Remove every core one-off trigger (setup page "Clear triggers"). */
function clearOneOffTriggers() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) { if (ONE_OFF_HANDLERS.indexOf(t.getHandlerFunction()) >= 0) { ScriptApp.deleteTrigger(t); n++; } });
  if (n) audit('triggers_cleared', '', { count: n });
  return n;
}
function _safe(label, fn) {
  try { return fn(); } catch (e) { auditFail(label + '_error', '', describeError(e)); return null; }
}
function _onceFor(key, ttlSec) {
  var cache = CacheService.getScriptCache();
  if (cache.get(key)) return false;
  cache.put(key, '1', ttlSec);
  return true;
}
/** Public wake URL the brain calls (also written into state.json). '' until WEBAPP_URL / deployment is known. */
function wakeUrl() { var u = webAppUrl(); return u ? u + '?route=wake' : ''; }

/** One sweep: mailbox → expiries → daily jobs → snapshot. Returns counts; {skipped:'busy'} when another run holds the lock. */
function wakeSweep(source) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) { if (source === 'wake') _scheduleFollowUp(); return { skipped: 'busy', source: source }; }
  var r = { source: source || 'manual' };
  try {
    r.mailbox = _safe('mailbox', function () { return pollFromBrain(LIMITS.SWEEP_BUDGET_MS * 0.6); }) || { processed: 0, rejected: 0, failed: 0, duplicate: 0 };
    r.expired = _safe('expire', expirePendingActions) || 0;
    r.requests_expired = _safe('requests_expire', expireRequests) || 0;
    r.flows_expired = _safe('flows_expire', expireFlows) || 0;
    r.daily = _safe('daily', runDailyJobs);
    if (r.daily) r.alarm = _safe('alarm_arm', function () { return alarmArm(); });   // daily backstop for the one alarm trigger (17_alarms.js)
    r.open_requests = _safe('requests_count', openRequestCount) || 0;
    var touched = r.mailbox.processed + r.mailbox.rejected + r.mailbox.failed + r.mailbox.duplicate + r.expired + r.requests_expired + r.flows_expired;
    r.processed = touched;
    if (touched > 0 || source !== 'wake') r.snapshot = !!_safe('snapshot', function () { writeSnapshot(); return true; });
    _safe('sweep_setting', function () { settingSet('last_sweep', nowIso(), r.source); });
    if (r.open_requests > 0 && _onceFor('sweep:hourly', LIMITS.HOURLY_SWEEP_MIN * 60)) _safe('schedule_hourly', function () { scheduleOneOff('wakeTrigger', LIMITS.HOURLY_SWEEP_MIN); });
  } finally { lock.releaseLock(); }
  return r;
}
function _scheduleFollowUp() { if (_onceFor('wake:followup', 90)) _safe('schedule_followup', function () { scheduleOneOff('wakeTrigger', 1); }); }
function wakeTrigger(e) { deleteOneOffTrigger(e); return wakeSweep('trigger'); }

/** ?route=wake — the brain says "I wrote something". No auth: it can only cause a sweep that would happen anyway. */
function routeWake(e) {
  if (!getProp(PROP.SHEET_ID)) return jsonOut({ ok: false, error: 'not set up' });
  var cache = CacheService.getScriptCache();
  var minGap = getIntProp(PROP.WAKE_MIN_INTERVAL_SEC, LIMITS.WAKE_MIN_INTERVAL_SEC);
  if (minGap > 0 && cache.get('wake:rl')) { _scheduleFollowUp(); return jsonOut({ ok: true, throttled: true, retry_in_sec: minGap }); }
  var cap = getIntProp(PROP.MAX_WAKES_PER_DAY, LIMITS.MAX_WAKES_PER_DAY);
  var used = settingDailyCount('wakes');
  if (used >= cap) { if (!seenOnce('wake:cap')) auditFail('wake_cap_reached', '', { cap: cap }); return jsonOut({ ok: false, throttled: true, reason: 'daily_cap' }); }
  if (minGap > 0) cache.put('wake:rl', '1', minGap);
  settingIncrDaily('wakes');
  var r = wakeSweep('wake');
  if (r.processed > 0 || r.skipped || _onceFor('wake:audited', LIMITS.WAKE_AUDIT_TTL_SEC)) audit('wake', '', { processed: r.processed || 0, skipped: r.skipped || '', open_requests: r.open_requests || 0 });
  return jsonOut({ ok: true, processed: r.processed || 0, skipped: r.skipped || undefined, open_requests: r.open_requests || 0, remaining: cap - used - 1 });
}

/* ---------------- Requests (core → brain) ---------------- */
/**
 * openRequest({kind, text, chat?, routine?, payload?}) → {id, row, fired}.
 * Writes to-brain/req_<id>.json, a Requests row, a fresh snapshot, fires the routine and schedules the fallback sweeps.
 */
function openRequest(spec) {
  spec = spec || {};
  var kind = String(spec.kind || 'message');
  var text = truncate(String(spec.text || ''), LIMITS.REQUEST_TEXT_CHARS);
  var routine = String(spec.routine || HELPER.inbound_routine || '').toUpperCase();
  var chat = isPlainObject(spec.chat) ? spec.chat : null;
  var payload = Object.assign({}, isPlainObject(spec.payload) ? spec.payload : {}, { kind: kind, text: text, chat: chat, requested_at: nowIso() });
  var id = mailboxWriteRequest(payload);
  var row = storeAppend(SHEETS.REQUESTS, {
    id: id, created_at: nowIso(), kind: kind, status: 'open', routine: routine, fired: '', answered_at: '',
    tg_chat_id: chat && chat.chat_id !== undefined ? String(chat.chat_id) : '', tg_message_id: chat && chat.message_id !== undefined ? String(chat.message_id) : '',
    text_preview: truncate(text, 200)
  });
  _safe('snapshot', writeSnapshot);
  var fr = fireRoutine(routine, 'req_' + id);
  row = storeUpdate(SHEETS.REQUESTS, row._row, { fired: fr.ok ? 'yes' : String(fr.skipped || fr.error || ('http_' + fr.code)) });
  LIMITS.FALLBACK_SWEEP_MIN.forEach(function (m) { _safe('schedule_fallback', function () { scheduleOneOff('wakeTrigger', m); }); });
  audit('request_opened', id, { kind: kind, routine: routine, fired: row.fired });
  return { id: id, row: row, fired: fr };
}
function getRequest(id) { return id ? storeGet(SHEETS.REQUESTS, id) : null; }
function listOpenRequests() { return storeFind(SHEETS.REQUESTS, function (r) { return r.status === 'open'; }); }
function openRequestCount() { return storeCount(SHEETS.REQUESTS, function (r) { return r.status === 'open'; }); }
/** Called by dispatchEnvelope() for any envelope with in_reply_to. Returns the row or null. */
function markRequestAnswered(id, env) {
  var row = getRequest(id);
  if (!row) return null;
  if (row.status === 'open') { row = storeUpdate(SHEETS.REQUESTS, row._row, { status: 'answered', answered_at: nowIso() }); audit('request_answered', id, { by: env ? env.type : '' }); }
  return row;
}
/** Requests older than REQUEST_MAX_AGE_HOURS get status expired; the owner hears about it once per sweep. */
function expireRequests() {
  var cut = nowMs() - LIMITS.REQUEST_MAX_AGE_HOURS * 3600000;
  var rows = listOpenRequests().filter(function (r) { var d = parseIso(r.created_at); return d && d.getTime() < cut; });
  rows.forEach(function (r) { storeUpdate(SHEETS.REQUESTS, r._row, { status: 'expired' }); auditFail('request_expired', r.id, { kind: r.kind }); });
  if (rows.length) _safe('request_expired_notice', function () { tgSendOwner('⌛ ' + rows.length + ' request(s) got no answer within ' + LIMITS.REQUEST_MAX_AGE_HOURS + ' h: ' + tgEscape(rows.map(function (r) { return r.text_preview || r.kind; }).join(' · ').slice(0, 500))); });
  return rows.length;
}
registerSnapshotProvider('requests_open', function () {
  return listOpenRequests().map(function (r) { return { id: r.id, kind: r.kind, created_at: r.created_at, routine: r.routine, fired: r.fired, text_preview: r.text_preview }; });
});

/* ---------------- Daily jobs ---------------- */
function runDailyJobs() {
  var today = isoDateLocal();
  if (settingGet('last_daily_date', '') === today) return null;
  settingSet('last_daily_date', today);
  var r = {};
  Object.keys(HB_REGISTRY.daily).sort().forEach(function (name) { r[name] = _safe('daily_' + name, HB_REGISTRY.daily[name]); });
  return r;
}
registerDailyJob('core_prune_queue', function () { return pruneQueue(); });
registerDailyJob('core_prune_mailbox', function () { return pruneMailbox(); });

// Developed by: LightAISolutions
