/**
 * Helpers core — alarms: pack code that must run at a time (registerAlarm in 02_registry.js).
 * There is still no permanent tick. At most ONE `alarmTrigger` is pending for all alarms together, set with
 * `ScriptApp.newTrigger('alarmTrigger').timeBased().at(<earliest next()>)`. Apps Script runs a timed trigger at or after
 * its time (sometimes minutes late), so alarms must never depend on exact timing: when the trigger fires, every alarm
 * whose next() is due (≤ now + ALARM_EARLY_SEC) runs, then alarmArm() deletes and re-creates the one trigger.
 * Re-armed by: each alarmTrigger run, pack code after a change (alarmArm()), and wakeSweep() on the first sweep of each local day
 * (the backstop when the trigger was cleared from the setup page). clearOneOffTriggers() clears it with the other one-off triggers.
 */
var ALARM_HANDLER = 'alarmTrigger';
var ALARM_SETTING = 'alarm_next';   // Settings: "<ISO>|<alarm name>" of the pending trigger, '' when none

function _alarmTriggers() { return ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === ALARM_HANDLER; }); }
/** { name: ms } for every alarm with something pending (a throwing next() is audited and skipped). */
function alarmNextAll(now) {
  now = now === undefined ? nowMs() : now;
  var out = {};
  registryKeys('alarm').forEach(function (name) {
    var ms = _safe('alarm_next_' + name, function () { return HB_REGISTRY.alarm[name].next(now); });
    if (typeof ms === 'number' && isFinite(ms)) out[name] = ms;
  });
  return out;
}
/**
 * (Re)arm the single alarm trigger at the earliest next() of every alarm: delete every pending alarmTrigger, then create
 * one with timeBased().at(), never sooner than ALARM_MIN_LEAD_SEC (or opts.floorMs) from now. Returns { at, name } or
 * null when no alarm has anything pending (then no trigger is left at all).
 */
function alarmArm(opts) {
  opts = opts || {};
  var now = opts.now === undefined ? nowMs() : opts.now;
  var next = alarmNextAll(now), best = null;
  Object.keys(next).forEach(function (name) {
    var ms = next[name];
    if (opts.defer && opts.defer[name] !== undefined) ms = Math.max(ms, opts.defer[name]);
    if (!best || ms < best.ms) best = { ms: ms, name: name };
  });
  _alarmTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  var mark = '';
  if (best) {
    var at = Math.max(best.ms, now + LIMITS.ALARM_MIN_LEAD_SEC * 1000, opts.floorMs || 0);
    ScriptApp.newTrigger(ALARM_HANDLER).timeBased().at(new Date(at)).create();
    best = { at: new Date(at).toISOString(), name: best.name };
    mark = best.at + '|' + best.name;
  }
  if (settingGet(ALARM_SETTING, '') !== mark) _safe('alarm_setting', function () { settingSet(ALARM_SETTING, mark, 'pending alarm trigger'); });
  return best;
}
/** The pending alarm as recorded by the last alarmArm(): { at, name, triggers } or null. */
function alarmPending() {
  var s = settingGet(ALARM_SETTING, ''), n = _alarmTriggers().length;
  if (!s && !n) return null;
  var p = s.split('|');
  return { at: p[0] || '', name: p[1] || '', triggers: n };
}

/** The handler of the one pending alarm trigger. Runs every due alarm under the script lock, then re-arms. */
function alarmTrigger(e) {
  deleteOneOffTrigger(e);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {   // a webhook or sweep holds the lock: try again shortly (never leave no trigger behind)
    if (!_alarmTriggers().length) ScriptApp.newTrigger(ALARM_HANDLER).timeBased().at(new Date(nowMs() + LIMITS.ALARM_RETRY_MIN * 60000)).create();
    return { skipped: 'busy' };
  }
  var r = { ran: [], failed: [] };
  try {
    var now = nowMs();
    if (settingDailyCount('alarm_runs') >= LIMITS.ALARM_MAX_RUNS_PER_DAY) {
      if (!seenOnce('alarm:cap:' + isoDateLocal())) auditFail('alarm_cap_reached', '', { cap: LIMITS.ALARM_MAX_RUNS_PER_DAY });
      r.capped = true;
      r.armed = alarmArm({ now: now, floorMs: now + 6 * 3600000 });
      return r;
    }
    settingIncrDaily('alarm_runs');
    var due = alarmNextAll(now), defer = {};
    Object.keys(due).sort().forEach(function (name) {
      if (due[name] > now + LIMITS.ALARM_EARLY_SEC * 1000) return;
      try { HB_REGISTRY.alarm[name].run(now); r.ran.push(name); } catch (err) { r.failed.push(name); auditFail('alarm_' + name + '_error', '', describeError(err)); }
    });
    // An alarm still due right after it ran would loop every minute: hold it back ALARM_RETRY_MIN instead.
    var after = alarmNextAll(nowMs());
    r.ran.concat(r.failed).forEach(function (name) {
      if (after[name] !== undefined && after[name] <= now + LIMITS.ALARM_EARLY_SEC * 1000) defer[name] = now + LIMITS.ALARM_RETRY_MIN * 60000;
    });
    r.armed = alarmArm({ defer: defer });
  } finally { lock.releaseLock(); }
  return r;
}
// Developed by: LightAISolutions
