/** Helpers core — audit log. Every side effect, rejection and auth failure lands here (secrets redacted). */

function audit(event, ref, detail, ok, actor) {
  var row = {
    id: newId('au'), ts: nowIso(), actor: actor || 'core', event: String(event), ref: redactSecrets(ref === undefined || ref === null ? '' : String(ref)),
    detail_json: truncate(redactSecrets(typeof detail === 'string' ? detail : toJson(detail === undefined ? null : detail)), LIMITS.AUDIT_DETAIL_CHARS),
    ok: ok === false ? 'false' : 'true'
  };
  try { return storeAppend(SHEETS.AUDIT, row); } catch (e) {
    // The Sheet may not exist yet during setup — never let auditing break the caller.
    try { Logger.log('AUDIT(unpersisted) ' + toJson(row)); } catch (e2) { /* ignore */ }
    return row;
  }
}
function auditFail(event, ref, detail, actor) { return audit(event, ref, detail, false, actor); }

// Developed by: LightAISolutions
