/**
 * Helpers core — Claude Code Routine fire client.
 * fireRoutine('CHAT', text) → POST <PREFIX>_ROUTINE_FIRE_URL_CHAT with bearer <PREFIX>_ROUTINE_FIRE_TOKEN_CHAT.
 * Daily cap: MAX_ROUTINE_FIRES_PER_DAY (default 12). No gates and no permanent trigger — the core fires only when
 * the owner asks something (openRequest) or a pack calls fireRoutine() itself.
 */
var ROUTINE_BETA_HEADER = 'experimental-cc-routine-2026-04-01';
var ROUTINE_API_VERSION = '2023-06-01'; // api.anthropic.com answers 400 without an anthropic-version header

function routineUrl(name) { return getProp(routineProp(name, 'URL')); }
function routineToken(name) { return getProp(routineProp(name, 'TOKEN')); }
function routineConfigured(name) { return !!(routineUrl(name) && routineToken(name)); }
function routineNames() {
  var all = PropertiesService.getScriptProperties().getProperties() || {};
  var re = new RegExp('^' + propName('ROUTINE_FIRE_URL_') + '(.+)$');
  return Object.keys(all).map(function (k) { var m = re.exec(k); return m ? m[1] : null; }).filter(Boolean).sort();
}

/** Returns {ok, code, skipped?}. Never throws. text is optional and arrives at the routine wrapped as untrusted. */
function fireRoutine(name, text) {
  name = String(name || '').toUpperCase();
  if (!routineConfigured(name)) { auditFail('routine_not_configured', name, null); return { ok: false, skipped: 'not_configured' }; }
  var cap = getIntProp(PROP.MAX_ROUTINE_FIRES_PER_DAY, LIMITS.MAX_ROUTINE_FIRES_PER_DAY);
  if (settingDailyCount('routine_fires') >= cap) { auditFail('routine_cap_reached', name, { cap: cap }); return { ok: false, skipped: 'daily_cap' }; }
  var body = {};
  if (text) body.text = truncate(String(text), 4000);
  var res;
  try {
    res = UrlFetchApp.fetch(routineUrl(name), {
      method: 'post', contentType: 'application/json', payload: toJson(body), muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + routineToken(name), 'anthropic-version': ROUTINE_API_VERSION, 'anthropic-beta': ROUTINE_BETA_HEADER }
    });
  } catch (e) { auditFail('routine_fire_error', name, describeError(e)); return { ok: false, error: describeError(e) }; }
  var code = res.getResponseCode();
  settingIncrDaily('routine_fires');
  var ok = code >= 200 && code < 300;
  var detail = { code: code, text_chars: body.text ? body.text.length : 0 };
  if (!ok) { try { detail.error = truncate(String(res.getContentText() || ''), 300); } catch (e2) { /* body unreadable — code is enough */ } }
  audit('routine_fired', name, detail, ok);
  return { ok: ok, code: code };
}

// Developed by: LightAISolutions
