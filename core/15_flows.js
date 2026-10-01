/**
 * Helpers core — conversational flows.
 * A flow is a short owner dialogue a pack drives step by step: a prompt (with optional buttons) goes out, the owner's
 * button press or free text comes back, the pack decides the next step. The core owns the plumbing:
 *   registerFlow(name, { start(seed, ctx) → step, next(state, input, ctx) → step, onDone?(state, ctx), ttl_min? })
 *   step = { prompt: html, keyboard?: rows of {text, value} | {text, url}, expect?: 'button'|'text'|'any',
 *            state, done?: true, result?, pause?: true }
 *   flowStart(chatId, name, seed) · flowActive(chatId) · flowResume(chatId, input) · flowCancel(chatId)
 * Buttons use the reserved callback prefix "fl" (fl:<step>:<value>, encoded by the core, ≤ 64 bytes). The router gives
 * the active flow first claim on free text and on fl callbacks — before message handlers and before a request is
 * opened — while commands always win (so /cancel and every other command keep working mid-flow).
 * State lives in the Flows sheet (one row per chat), survives a fresh execution, expires ttl_min after the last step
 * (default LIMITS.FLOW_DEFAULT_TTL_MIN; the sweep's expireFlows() tells the owner once). A paused step keeps the state
 * but releases the text claim until the pack calls flowResume(). Input shapes handed to next():
 *   { type: 'button', value }  ·  { type: 'text', text }  ·  { type: 'resume', ...whatever the pack passed }
 */
var FLOW_CB_PREFIX = 'fl';
var FLOW_EXPECTS = ['button', 'text', 'any'];
var FLOW_PAUSED = 'paused';

function registerFlow(name, def) {
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(name || '')) throw new Error('registerFlow: name must match /^[a-z][a-z0-9_-]{0,31}$/');
  if (!def || typeof def.start !== 'function' || typeof def.next !== 'function') throw new Error('registerFlow: need {start(seed, ctx), next(state, input, ctx)}');
  if (def.onDone !== undefined && typeof def.onDone !== 'function') throw new Error('registerFlow: onDone must be a function');
  if (def.ttl_min !== undefined && !(parseInt(def.ttl_min, 10) > 0)) throw new Error('registerFlow: ttl_min must be a positive integer');
  return _regPut('flow', name, def, 'Flow');
}
function getFlow(name) { return Object.prototype.hasOwnProperty.call(HB_REGISTRY.flow, name) ? HB_REGISTRY.flow[name] : null; }

function _flowRow(chatId) {
  return storeFind(SHEETS.FLOWS, function (r) { return String(r.chat_id) === String(chatId); }, 1)[0] || null;
}
function _flowView(row) {
  var parsed = safeJsonParse(row.state_json);
  return {
    flow: String(row.flow), step: parseInt(row.step, 10) || 0, expect: String(row.expect || 'any'),
    paused: String(row.expect) === FLOW_PAUSED, state: parsed.ok ? parsed.value : null,
    updated_at: row.updated_at, expires_at: row.expires_at, _row: row._row
  };
}
function _flowCtx(chatId, name, row) {
  return {
    chatId: chatId, flow: name, step: row ? parseInt(row.step, 10) || 0 : 0,
    reply: function (html, opts) { return tgSend(chatId, html, opts); }
  };
}
/** The active flow for a chat (null when none, or when the row has expired — the sweep removes it). */
function flowActive(chatId) {
  var row = _flowRow(chatId);
  if (!row) return null;
  var exp = parseIso(row.expires_at);
  if (exp && exp.getTime() <= nowMs()) return null;
  return _flowView(row);
}
/** Start (or restart) a flow for a chat. Any flow already active in that chat is replaced (audited flow_replaced). */
function flowStart(chatId, name, seed) {
  var def = getFlow(name);
  if (!def) throw new Error('flowStart: unknown flow "' + name + '"');
  var row = _flowRow(chatId);
  if (row) { audit('flow_replaced', String(row.flow), { by: name, step: row.step }); storeDeleteRows(SHEETS.FLOWS, [row._row]); row = null; }
  var fctx = _flowCtx(chatId, name, null);
  var step;
  try { step = def.start(seed, fctx); }
  catch (err) { auditFail('flow_error', name, { phase: 'start', error: describeError(err) }); throw err; }
  audit('flow_started', name, { seed: isPlainObject(seed) ? Object.keys(seed) : typeof seed });
  return _flowApply(chatId, name, def, null, step, fctx);
}
/** Feed the active flow an input — the router does this for text and buttons; a pack does it after a pause. */
function flowResume(chatId, input) {
  var row = _flowRow(chatId);
  if (!row) return null;
  var name = String(row.flow), def = getFlow(name);
  if (!def) { auditFail('flow_orphan', name, { step: row.step }); storeDeleteRows(SHEETS.FLOWS, [row._row]); return null; }
  var inp = isPlainObject(input) ? Object.assign({ type: 'resume' }, input) : { type: 'resume', text: input === undefined || input === null ? '' : String(input) };
  var view = _flowView(row), fctx = _flowCtx(chatId, name, row);
  var step;
  try { step = def.next(view.state, inp, fctx); }
  catch (err) {
    auditFail('flow_error', name, { phase: 'next', step: view.step, error: describeError(err) });
    storeDeleteRows(SHEETS.FLOWS, [row._row]);
    tgSend(chatId, '⚠️ ' + tgEscape(name) + ' stopped: ' + tgEscape(truncate(describeError(err), 200)));
    return { done: true, error: describeError(err) };
  }
  return _flowApply(chatId, name, def, row, step, fctx);
}
/** Cancel the active flow (owner's /cancel or a pack). Returns the cancelled view or null. */
function flowCancel(chatId) {
  var row = _flowRow(chatId);
  if (!row) return null;
  storeDeleteRows(SHEETS.FLOWS, [row._row]);
  audit('flow_cancelled', String(row.flow), { step: row.step });
  return _flowView(row);
}

/** Persist and send one step. Returns { done, result?, step } */
function _flowApply(chatId, name, def, row, step, fctx) {
  if (!isPlainObject(step)) throw new Error('flow "' + name + '": start/next must return a step object');
  var prompt = step.prompt === undefined || step.prompt === null ? '' : String(step.prompt);
  if (step.done) {
    if (row) storeDeleteRows(SHEETS.FLOWS, [row._row]);
    if (prompt) tgSend(chatId, prompt, step.keyboard ? { keyboard: _flowKeyboard(0, step.keyboard) } : undefined);
    if (typeof def.onDone === 'function') {
      try { def.onDone(step.state, fctx); }
      catch (err) { auditFail('flow_error', name, { phase: 'onDone', error: describeError(err) }); }
    }
    audit('flow_done', name, { steps: row ? parseInt(row.step, 10) || 0 : 0 });
    return { done: true, result: step.result, step: 0 };
  }
  var expect = step.pause ? FLOW_PAUSED : (step.expect === undefined ? 'any' : String(step.expect));
  if (expect !== FLOW_PAUSED && FLOW_EXPECTS.indexOf(expect) < 0) throw new Error('flow "' + name + '": expect must be button, text or any');
  if (!prompt && !step.pause) throw new Error('flow "' + name + '": a step needs a prompt');
  var stateJson = toJson(step.state === undefined ? {} : step.state);
  if (stateJson.length > LIMITS.FLOW_STATE_MAX_CHARS) throw new Error('flow "' + name + '": state_json > ' + LIMITS.FLOW_STATE_MAX_CHARS + ' chars');
  var n = (row ? parseInt(row.step, 10) || 0 : 0) + 1;
  var ttl = parseInt(def.ttl_min, 10) > 0 ? parseInt(def.ttl_min, 10) : LIMITS.FLOW_DEFAULT_TTL_MIN;
  var patch = { chat_id: String(chatId), flow: name, step: n, expect: expect, state_json: stateJson, updated_at: nowIso(), expires_at: isoAfterMinutes(ttl) };
  if (row) storeUpdate(SHEETS.FLOWS, row._row, patch); else storeAppend(SHEETS.FLOWS, patch);
  if (prompt) tgSend(chatId, prompt, step.keyboard ? { keyboard: _flowKeyboard(n, step.keyboard) } : undefined);
  return { done: false, step: n, paused: expect === FLOW_PAUSED };
}
/** Rows of {text, value} become fl:<step>:<value> buttons; {text, url} pass through. */
function _flowKeyboard(n, rows) {
  if (!Array.isArray(rows)) throw new Error('flow keyboard must be rows of buttons');
  return tgKeyboard(rows.map(function (r) {
    return (Array.isArray(r) ? r : [r]).map(function (b) {
      if (b && b.url) return { text: b.text, url: b.url };
      if (!b || b.value === undefined) throw new Error('flow button needs value or url');
      return { text: b.text, data: cbEncode(FLOW_CB_PREFIX, n, b.value) };
    });
  }));
}

/** Router hook: true when the active flow consumed the owner's free text (commands never reach here). */
function flowClaimText(ctx) {
  var f = flowActive(ctx.chatId);
  if (!f || f.paused) return false;
  if (f.expect === 'button') { ctx.reply('Please use the buttons above, or send /cancel to stop.'); return true; }
  flowResume(ctx.chatId, { type: 'text', text: String(ctx.text || '') });
  return true;
}
registerCallback(FLOW_CB_PREFIX, function (ctx) {
  var f = flowActive(ctx.chatId);
  if (!f) { ctx.answer('That conversation has ended.'); return; }
  if (f.paused) { ctx.answer('One moment — still working on the previous step.'); return; }
  if (String(ctx.parts[0]) !== String(f.step)) { ctx.answer('That question has moved on.'); return; }
  var value = ctx.parts.slice(1).join(':');
  ctx.answer('');
  if (ctx.messageId) tgApi('editMessageReplyMarkup', { chat_id: ctx.chatId, message_id: ctx.messageId, reply_markup: { inline_keyboard: [] } });
  flowResume(ctx.chatId, { type: 'button', value: value });
});
registerCommand('/cancel', function (ctx) {
  var f = flowCancel(ctx.chatId);
  ctx.reply(f ? '✖️ Cancelled ' + tgEscape(f.flow) + '.' : 'Nothing to cancel.');
}, 'stop the current conversation');

/** Sweep hook: delete expired flow rows; the owner hears about it once per sweep. */
function expireFlows() {
  var now = nowMs();
  var rows = storeAll(SHEETS.FLOWS).filter(function (r) { var d = parseIso(r.expires_at); return !d || d.getTime() <= now; });
  if (!rows.length) return 0;
  storeDeleteRows(SHEETS.FLOWS, rows.map(function (r) { return r._row; }));
  rows.forEach(function (r) { auditFail('flow_expired', String(r.flow), { step: r.step }); });
  _safe('flow_expired_notice', function () {
    tgSendOwner('⌛ ' + tgEscape(rows.map(function (r) { return r.flow; }).join(', ')) + ' timed out — start again when you are ready.');
  });
  return rows.length;
}
registerSnapshotProvider('flows_active', function () {
  return storeAll(SHEETS.FLOWS).map(function (r) { return { chat_id: String(r.chat_id), flow: r.flow, step: r.step, expect: r.expect, updated_at: r.updated_at, expires_at: r.expires_at }; });
});

// Developed by: LightAISolutions
