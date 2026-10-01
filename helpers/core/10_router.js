/**
 * Helpers core — web-app router.
 * Routes: ?route=tg (Telegram webhook, POST) · ?route=wake (brain wake-up, GET/POST, no auth) · ?route=setup (owner page,
 *         GET/POST, ?k=ADMIN_SECRET) · anything else → health JSON (no secrets).
 * Telegram route ALWAYS returns HtmlService (HTTP 200) — ContentService would 302 and Telegram would retry.
 * Auth: tg → ?k=WEBHOOK_SECRET + from.id === OWNER_CHAT_ID; setup → ?k=ADMIN_SECRET; wake → none (rate-limited, idempotent).
 */
function htmlOut(text) { return HtmlService.createHtmlOutput(text); }
function jsonOut(obj) { return ContentService.createTextOutput(toJson(obj)).setMimeType(ContentService.MimeType.JSON); }
function param(e, name) { return (e && e.parameter && e.parameter[name] !== undefined) ? String(e.parameter[name]) : ''; }
function postBody(e) { return (e && e.postData && e.postData.contents) ? String(e.postData.contents) : ''; }

function doGet(e) {
  var route = param(e, 'route') || 'health';
  try {
    if (route === 'setup') return routeSetupGet(e);
    if (route === 'wake') return routeWake(e);
    if (route === 'tg') return htmlOut('OK');
    return jsonOut({ ok: true, app: HELPER.name, version: HELPER.version, core: CORE_VERSION, ts: nowIso() });
  } catch (err) {
    auditFail('doGet_error', route, describeError(err));
    return route === 'wake' ? jsonOut({ ok: false, error: 'internal' }) : htmlOut('error');
  }
}
function doPost(e) {
  var route = param(e, 'route') || '';
  try {
    if (route === 'tg') return routeTg(e);
    if (route === 'wake') return routeWake(e);
    if (route === 'setup') return routeSetupPost(e);
    auditFail('route_unknown', route, null);
    return htmlOut('not found');
  } catch (err) {
    auditFail('doPost_error', route, describeError(err));
    return route === 'tg' ? htmlOut('OK') : jsonOut({ ok: false, error: 'internal' });
  }
}

/** Dedupe key seen within DEDUPE_TTL_SEC → true (and does NOT re-mark). First sight marks it. */
function seenOnce(key) {
  var cache = CacheService.getScriptCache();
  if (cache.get(key)) return true;
  cache.put(key, '1', LIMITS.DEDUPE_TTL_SEC);
  return false;
}

/* ---------------- Telegram ---------------- */
function routeTg(e) {
  if (!safeEqual(param(e, 'k'), getProp(PROP.WEBHOOK_SECRET))) { auditFail('tg_auth_fail', '', null); return htmlOut('forbidden'); }
  var parsed = safeJsonParse(postBody(e));
  if (!parsed.ok || !isPlainObject(parsed.value)) { auditFail('tg_bad_body', '', null); return htmlOut('OK'); }
  var update = parsed.value;
  if (update.update_id === undefined || seenOnce('tgu:' + update.update_id)) return htmlOut('OK');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    // Never lose an update: defer it to the worker instead of letting Telegram retry (we already said 200).
    enqueue('tg_update_deferred', update, 'telegram');
    return htmlOut('OK');
  }
  try { handleTelegramUpdate(update); }
  catch (err) { auditFail('tg_update_error', update.update_id, describeError(err)); }
  finally { lock.releaseLock(); }
  return htmlOut('OK');
}
registerQueueHandler('tg_update_deferred', function (item) { handleTelegramUpdate(item.payload); return { ok: true }; });

function handleTelegramUpdate(update) {
  if (update.callback_query) return handleTelegramCallback(update.callback_query);
  if (update.message) return handleTelegramMessage(update.message);
  return null;
}
function _isOwner(from) { var o = tgOwnerChatId(); return !!(o && from && String(from.id) === String(o)); }

function handleTelegramMessage(msg) {
  var from = msg.from || {}, chatId = msg.chat && msg.chat.id;
  var text = typeof msg.text === 'string' ? msg.text : (typeof msg.caption === 'string' ? msg.caption : '');
  var owner = tgOwnerChatId();
  if (!owner) {
    // Pairing: only "/start <PAIR_CODE>" from a private chat may claim ownership, exactly once.
    var m = /^\/start(?:@\w+)?\s+(\S+)\s*$/.exec(text || '');
    var code = getProp(PROP.PAIR_CODE);
    if (m && code && safeEqual(m[1], code) && msg.chat && msg.chat.type === 'private') {
      setProp(PROP.OWNER_CHAT_ID, String(from.id));
      delProp(PROP.PAIR_CODE);
      audit('owner_paired', String(from.id), { username: from.username || '' });
      tgSend(chatId, '✅ Paired. This chat is now the owner channel for ' + tgEscape(HELPER.display_name) + '. Send /help to see commands.');
      startExtras(chatId);
    } else if (!seenOnce('tgstranger:' + String(from.id || ''))) { auditFail('tg_unpaired_ignored', String(from.id || ''), null); }
    return null;
  }
  // Strangers who find the bot get no reply; audit each sender once per DEDUPE_TTL_SEC (not once per message) so a
  // spammer cannot grow the AuditLog by the message.
  if (!_isOwner(from) || String(chatId) !== String(owner)) { if (!seenOnce('tgstranger:' + String(from.id || ''))) auditFail('tg_unauthorized', String(from.id || ''), { chat: chatId }); return null; }
  var ctx = {
    chatId: chatId, from: from, text: text, message: msg,
    chat: { chat_id: chatId, message_id: msg.message_id, ts: msg.date ? new Date(msg.date * 1000).toISOString() : nowIso() },
    reply: function (html, opts) { return tgSend(chatId, html, opts); }
  };
  if (/^\/[a-zA-Z0-9_]+/.test(text)) {
    var mm = /^\/([a-zA-Z0-9_]+)(?:@\w+)?\s*([\s\S]*)$/.exec(text);
    var cmd = '/' + mm[1].toLowerCase();
    ctx.args = (mm[2] || '').trim();
    ctx.argv = ctx.args ? ctx.args.split(/\s+/) : [];
    var fn = getCommand(cmd);
    if (!fn) { ctx.reply('Unknown command. Send /help.'); return null; }
    try { return fn(ctx); }
    catch (err) { auditFail('command_error', cmd, describeError(err)); ctx.reply('⚠️ ' + tgEscape(cmd) + ' failed: ' + tgEscape(truncate(describeError(err), 200))); return null; }
  }
  // Free text (or media with a caption): the active flow has first claim (15_flows.js), then pack message handlers,
  // then the inbound routine via a request.
  if (flowClaimText(ctx)) return null;
  var names = Object.keys(HB_REGISTRY.message).sort();
  for (var i = 0; i < names.length; i++) {
    try { if (HB_REGISTRY.message[names[i]](ctx) === true) return null; }
    catch (err) { auditFail('message_handler_error', names[i], describeError(err)); }
  }
  if (!text.trim()) { ctx.reply('I only read text here. Add a caption to send a file.'); return null; }
  return requestFromMessage(ctx, 'message', text);
}

/** Open a request for the inbound routine from an owner message and acknowledge it. Shared by free text and /ask. */
function requestFromMessage(ctx, kind, text) {
  var routine = HELPER.inbound_routine;
  if (!routineConfigured(routine)) {
    ctx.reply('No routine is configured to answer here yet. Set <code>' + tgEscape(routineProp(routine, 'URL')) + '</code> and <code>' + tgEscape(routineProp(routine, 'TOKEN')) + '</code> in Script Properties.');
    return null;
  }
  var r = openRequest({ kind: kind, text: text, chat: ctx.chat, routine: routine });
  if (r.fired.ok) ctx.reply('🧠 Working on it…', { replyTo: ctx.chat.message_id, silent: true });
  else ctx.reply('⏳ Noted — the routine could not be fired right now (' + tgEscape(r.fired.skipped || r.fired.error || ('HTTP ' + r.fired.code)) + '). It will see the request on its next run.', { replyTo: ctx.chat.message_id });
  return r;
}

function handleTelegramCallback(cq) {
  var from = cq.from || {};
  if (!_isOwner(from)) { if (!seenOnce('tgstranger:' + String(from.id || ''))) auditFail('tg_callback_unauthorized', String(from.id || ''), null); return null; }
  // The bot only ever sends keyboards to the owner's chat, so a callback whose message lives in another chat is forged
  // (it would otherwise make handlers reply into that chat via ctx.chatId).
  if (cq.message && cq.message.chat && String(cq.message.chat.id) !== String(tgOwnerChatId())) {
    auditFail('tg_callback_unauthorized', String(from.id || ''), { chat: cq.message.chat.id, reason: 'foreign chat' });
    return null;
  }
  var dec = cbDecode(cq.data);
  var answered = false;
  var ctx = {
    chatId: cq.message && cq.message.chat ? cq.message.chat.id : tgOwnerChatId(),
    messageId: cq.message ? cq.message.message_id : null,
    from: from, data: cq.data, parts: dec.parts, callbackQuery: cq,
    answer: function (text, alert) { answered = true; return tgAnswerCallback(cq.id, text, alert); },
    edit: function (html, keyboard) { return ctx.messageId ? tgEdit(ctx.chatId, ctx.messageId, html, keyboard) : null; }
  };
  var fn = getCallback(dec.prefix);
  try {
    if (!fn) { auditFail('callback_unknown', dec.prefix, null); ctx.answer('Unknown button'); return null; }
    fn(ctx);
  } catch (err) {
    auditFail('callback_error', cq.data, describeError(err));
    if (!answered) ctx.answer('⚠️ failed', true);
  } finally { if (!answered) tgAnswerCallback(cq.id, ''); }
  return null;
}

// Developed by: LightAISolutions
