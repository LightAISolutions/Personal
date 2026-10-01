/**
 * Helpers core — executor + PendingActions.
 * The ONLY path to a side effect on the owner's accounts:
 *   proposeAction() → PendingActions row (status pending) + Telegram message showing the EXACT payload
 *   → owner taps ✅ (callback "a:<id>:y") → decideAction() → registered execute() → status executed.
 * Lifecycle: pending → approved → executed | failed ; pending → rejected | expired.
 * Idempotency: same idempotency_key while pending/approved/executed returns the existing row (no new message).
 */
function actionKeyboard(id) {
  return tgKeyboard([[{ text: '✅ Approve', data: cbEncode('a', id, 'y') }, { text: '❌ Reject', data: cbEncode('a', id, 'n') }]]);
}
function renderActionMessage(row, statusLine) {
  var payload = safeJsonParse(row.payload_json || '{}');
  var json = truncate(toJson(payload.ok ? payload.value : {}), 1200);
  return '<b>Action proposal</b> · <code>' + tgEscape(row.type) + '</code> · <code>' + tgEscape(row.id) + '</code>\n' +
    (row.origin ? '<i>from ' + tgEscape(row.origin) + '</i>\n' : '') +
    '\n' + row.preview + '\n\n<b>Exact payload</b>\n<pre>' + tgEscape(json) + '</pre>\n' +
    'Expires ' + tgEscape(fmtLocal(parseIso(row.expires_at))) + '\n' + (statusLine || '');
}

/**
 * proposeAction({type, payload, origin, idempotency_key, expires_in_min})
 * Returns the PendingActions row. Throws on non-allowlisted type or invalid payload.
 */
function proposeAction(spec) {
  spec = spec || {};
  var type = String(spec.type || '');
  if (ACTION_ALLOWLIST.indexOf(type) < 0) { auditFail('action_rejected', type, 'not in allowlist'); throw new Error('action type not allowed: ' + type); }
  var def = getActionDef(type);
  if (!def) { auditFail('action_rejected', type, 'no implementation'); throw new Error('action type has no implementation: ' + type); }
  if (!isPlainObject(spec.payload)) throw new Error('payload must be an object');
  var pj = toJson(spec.payload);
  if (pj.length > 16000) throw new Error('payload too large');
  var errs = def.validate(spec.payload) || [];
  if (errs.length) { auditFail('action_invalid', type, errs); throw new Error('invalid payload: ' + errs.join('; ')); }

  var key = spec.idempotency_key ? String(spec.idempotency_key).slice(0, 120) : sha1Hex(type + '|' + pj).slice(0, 32);
  var existing = storeFind(SHEETS.PENDING, function (r) {
    return r.idempotency_key === key && ['pending', 'approved', 'executed'].indexOf(r.status) >= 0;
  }, 1)[0];
  if (existing) { audit('action_dedupe', existing.id, { key: key }); return existing; }
  // Cap NEW proposals per local day so a runaway or hijacked routine cannot flood the owner's chat.
  var cap = getIntProp(PROP.MAX_PROPOSALS_PER_DAY, LIMITS.MAX_PROPOSALS_PER_DAY);
  if (settingDailyCount('action_proposals') >= cap) { auditFail('action_cap_reached', type, { cap: cap, origin: spec.origin || '' }); throw new Error('daily proposal cap reached (' + cap + ')'); }

  var minutes = clampInt(spec.expires_in_min, 5, LIMITS.PENDING_MAX_EXPIRY_MIN, LIMITS.PENDING_DEFAULT_EXPIRY_MIN);
  var preview = truncate(String(def.preview(spec.payload) || ''), LIMITS.PENDING_PREVIEW_CHARS);
  var row = storeAppend(SHEETS.PENDING, {
    id: newId('pa'), created_at: nowIso(), type: type, status: 'pending', preview: preview, payload_json: pj,
    idempotency_key: key, expires_at: isoAfterMinutes(minutes), decided_at: '', executed_at: '', result_json: '', error: '',
    tg_chat_id: tgOwnerChatId(), tg_message_id: '', origin: truncate(spec.origin || '', 80)
  });
  settingIncrDaily('action_proposals');
  audit('action_proposed', row.id, { type: type, origin: row.origin }, true, row.origin || 'core');
  if (tgOwnerChatId()) {
    var res = tgSendOwner(renderActionMessage(row, '⏳ awaiting your decision'), { keyboard: actionKeyboard(row.id) });
    if (res && res.ok && res.result) row = storeUpdate(SHEETS.PENDING, row._row, { tg_message_id: res.result.message_id });
  }
  return row;
}

function getPendingAction(id) { return storeGet(SHEETS.PENDING, id); }
function listPendingActions() { return storeFind(SHEETS.PENDING, function (r) { return r.status === 'pending'; }); }
function _pendingExpired(row) { var d = parseIso(row.expires_at); return !!d && d.getTime() <= nowMs(); }

/** decideAction(id, 'y'|'n', actor) → {ok, status, message}. Executes on 'y'. Safe to call twice. */
function decideAction(id, decision, actor) {
  var row = getPendingAction(id);
  if (!row) return { ok: false, status: 'missing', message: 'Unknown action' };
  if (row.status !== 'pending') return { ok: false, status: row.status, message: 'Already ' + row.status };
  if (_pendingExpired(row)) {
    storeUpdate(SHEETS.PENDING, row._row, { status: 'expired', decided_at: nowIso() });
    auditFail('action_expired', id, { type: row.type });
    _refreshActionMessage(id, '⌛ expired — not executed');
    return { ok: false, status: 'expired', message: 'Expired — not executed' };
  }
  if (decision !== 'y') {
    storeUpdate(SHEETS.PENDING, row._row, { status: 'rejected', decided_at: nowIso() });
    audit('action_rejected_by_owner', id, { type: row.type }, true, actor || 'owner');
    _refreshActionMessage(id, '❌ rejected');
    return { ok: true, status: 'rejected', message: 'Rejected' };
  }
  storeUpdate(SHEETS.PENDING, row._row, { status: 'approved', decided_at: nowIso() });
  audit('action_approved', id, { type: row.type }, true, actor || 'owner');
  var r = executePendingAction(id);
  _refreshActionMessage(id, r.ok ? '✅ executed: ' + tgEscape(truncate(r.summary || 'ok', 300)) : '⚠️ failed: ' + tgEscape(truncate(r.error || '', 300)));
  return r;
}

function executePendingAction(id) {
  var row = getPendingAction(id);
  if (!row || row.status !== 'approved') return { ok: false, status: row ? row.status : 'missing', error: 'not approved' };
  var def = getActionDef(row.type);
  if (!def || ACTION_ALLOWLIST.indexOf(row.type) < 0) {
    storeUpdate(SHEETS.PENDING, row._row, { status: 'failed', error: 'type not allowed' });
    auditFail('action_exec_blocked', id, { type: row.type });
    return { ok: false, status: 'failed', error: 'type not allowed' };
  }
  var payload = safeJsonParse(row.payload_json || '{}');
  var errs = payload.ok ? (def.validate(payload.value) || []) : ['payload unparseable'];
  if (errs.length) {
    storeUpdate(SHEETS.PENDING, row._row, { status: 'failed', error: errs.join('; ') });
    auditFail('action_exec_invalid', id, errs);
    return { ok: false, status: 'failed', error: errs.join('; ') };
  }
  try {
    var result = def.execute(payload.value, { id: id, row: row }) || {};
    storeUpdate(SHEETS.PENDING, row._row, { status: 'executed', executed_at: nowIso(), result_json: truncate(toJson(result), 2000), error: '' });
    audit('action_executed', id, { type: row.type, result: result });
    return { ok: true, status: 'executed', result: result, summary: result.summary || '' };
  } catch (e) {
    var err = describeError(e);
    storeUpdate(SHEETS.PENDING, row._row, { status: 'failed', error: err });
    auditFail('action_exec_error', id, { type: row.type, error: err });
    return { ok: false, status: 'failed', error: err };
  }
}

function _refreshActionMessage(id, statusLine) {
  var row = getPendingAction(id);
  if (!row || !row.tg_chat_id || !row.tg_message_id) return;
  try { tgEdit(row.tg_chat_id, row.tg_message_id, renderActionMessage(row, statusLine), null); } catch (e) { /* ignore */ }
}

/** Sweep job: mark expired proposals and update their messages. */
function expirePendingActions() {
  var rows = storeFind(SHEETS.PENDING, function (r) { return r.status === 'pending' && _pendingExpired(r); });
  rows.forEach(function (r) {
    storeUpdate(SHEETS.PENDING, r._row, { status: 'expired', decided_at: nowIso() });
    auditFail('action_expired', r.id, { type: r.type });
    _refreshActionMessage(r.id, '⌛ expired — not executed');
  });
  return rows.length;
}

/** Callback "a:<id>:y|n" — owner decision. */
registerCallback('a', function (ctx) {
  var id = ctx.parts[0], decision = ctx.parts[1];
  var r = decideAction(id, decision === 'y' ? 'y' : 'n', 'owner:' + ctx.from.id);
  ctx.answer(r.message || (r.ok ? 'Done' : (r.error || 'Failed')), !r.ok);
});

// Developed by: LightAISolutions
