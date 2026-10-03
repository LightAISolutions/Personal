/**
 * Helpers core — web-app router.
 * Routes: ?route=tg (Telegram webhook, POST) · ?route=wake (brain wake-up, GET/POST, no auth) · ?route=setup (owner page,
 *         GET/POST, ?k=ADMIN_SECRET) · ?route=upload (routine file upload, POST, per-request key — 16_upload.js) ·
 *         ?route=<name> registered by a pack (registerRoute: auth none | admin | webapp) ·
 *         anything else → health JSON on GET (no secrets), 404 JSON on POST.
 * Telegram route ALWAYS returns HtmlService (HTTP 200) — ContentService would 302 and Telegram would retry.
 * Auth: tg → ?k=WEBHOOK_SECRET + from.id === OWNER_CHAT_ID; setup → ?k=ADMIN_SECRET; wake → none (rate-limited, idempotent);
 *       upload → the request's HMAC upload key (open or just-answered request only);
 *       registered 'webapp' routes → Telegram Mini App initData in the POST body (tgVerifyInitData) + MAX_APP_CALLS_PER_DAY.
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
    var reg = getRoute(route);
    if (reg) return routeRegistered(e, route, reg, 'GET');
    return jsonOut({ ok: true, app: HELPER.name, version: HELPER.version, core: CORE_VERSION, ts: nowIso() });
  } catch (err) {
    auditFail('doGet_error', route, describeError(err));
    return route === 'wake' || getRoute(route) ? routeError(500, 'internal') : htmlOut('error');
  }
}
function doPost(e) {
  var route = param(e, 'route') || '';
  try {
    if (route === 'tg') return routeTg(e);
    if (route === 'wake') return routeWake(e);
    if (route === 'setup') return routeSetupPost(e);
    if (route === 'upload') return routeUpload(e);
    var reg = getRoute(route);
    if (reg) return routeRegistered(e, route, reg, 'POST');
    if (!seenOnce('route:unknown:' + route.slice(0, 40))) auditFail('route_unknown', route, null);   // once per 6 h per name — a scanner cannot grow the AuditLog
    return routeError(404, 'not_found');
  } catch (err) {
    auditFail('doPost_error', route, describeError(err));
    return route === 'tg' ? htmlOut('OK') : routeError(500, 'internal');
  }
}

/* ---------------- Registered routes (registerRoute, 02_registry.js) ---------------- */
/**
 * Apps Script web apps always answer HTTP 200 (ContentService cannot set a status), so the status travels in the JSON:
 * errors are { ok:false, status, reason } — never a stack, never the request. A handler returns { status, body } (body is
 * JSON-serialised as is; a non-200 status gets ok/status/reason filled in when the body lacks them).
 */
function routeError(status, reason) { return jsonOut({ ok: false, status: status, reason: reason }); }
function routeRegistered(e, name, def, method) {
  if (def.methods.indexOf(method) < 0) return routeError(405, 'method_not_allowed');
  var req = { method: method, params: e && e.parameter ? e.parameter : {}, body: {}, user: null, auth_date: 0, start_param: '' };
  if (method === 'POST') {
    var raw = postBody(e);
    if (raw.length > LIMITS.ROUTE_BODY_MAX_CHARS) return routeError(400, 'body_too_large');
    if (raw.trim()) {
      var parsed = safeJsonParse(raw);
      if (!parsed.ok || !isPlainObject(parsed.value)) return routeError(400, 'bad_json');
      req.body = parsed.value;
    }
  }
  if (def.auth === 'admin') {
    if (!_adminOk(e)) { if (!seenOnce('route:authfail:' + name)) auditFail('route_auth_fail', name, { auth: 'admin' }); return routeError(403, 'forbidden'); }
  } else if (def.auth === 'webapp') {
    var v = tgVerifyInitData(req.body.initData);
    if (!v.ok) { if (!seenOnce('route:authfail:' + name + ':' + v.reason)) auditFail('route_auth_fail', name, { auth: 'webapp', reason: v.reason }); return routeError(403, 'forbidden'); }
    req.user = v.user; req.auth_date = v.auth_date; req.start_param = v.start_param;
    var cap = getIntProp(PROP.MAX_APP_CALLS_PER_DAY, LIMITS.MAX_APP_CALLS_PER_DAY);
    if (settingDailyCount('app_calls') >= cap) { if (!seenOnce('app:cap:' + isoDateLocal())) auditFail('app_cap_reached', name, { cap: cap }); return routeError(429, 'daily_cap'); }
    settingIncrDaily('app_calls');
  }
  var out, lock = _routeWantsLock(def, req) ? LockService.getScriptLock() : null;
  if (lock && !lock.tryLock(LIMITS.ROUTE_LOCK_WAIT_MS)) return routeError(503, 'busy');
  try { out = def.handler(req); }
  catch (err) { auditFail('route_error', name, describeError(err)); return routeError(500, 'internal'); }
  finally { if (lock) lock.releaseLock(); }
  if (!isPlainObject(out)) return jsonOut(out === undefined ? { ok: true } : out);
  var status = clampInt(out.status, 100, 599, 200), body = out.body === undefined ? (status === 200 ? { ok: true } : {}) : out.body;
  if (status !== 200 && isPlainObject(body)) {
    if (body.ok === undefined) body.ok = false;
    if (body.status === undefined) body.status = status;
    if (body.reason === undefined) body.reason = status === 404 ? 'not_found' : status === 403 ? 'forbidden' : status === 429 ? 'daily_cap' : 'bad_request';
  }
  return jsonOut(body);
}

/** registerRoute({ lock }): true, or a predicate on the request (a predicate that throws locks — the safe side). */
function _routeWantsLock(def, req) {
  if (def.lock === true) return true;
  if (typeof def.lock !== 'function') return false;
  try { return !!def.lock(req); } catch (err) { return true; }
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
    enqueue('tg_update_deferred', tgWithholdLocation(update), 'telegram');
    return htmlOut('OK');
  }
  try { handleTelegramUpdate(update); }
  catch (err) { auditFail('tg_update_error', update.update_id, describeError(err)); }
  finally { lock.releaseLock(); }
  return htmlOut('OK');
}
registerQueueHandler('tg_update_deferred', function (item) { handleTelegramUpdate(item.payload); return { ok: true }; });
/**
 * A deferred update is stored in the Queue sheet until the worker runs it, so a shared location (message.location or a
 * venue, also in edited_message for live locations) is taken out first and the message marked hb_location_withheld:
 * a location serves one request and is never kept (tour-guide's re-plan from here asks for it again). Returns a copy.
 */
function tgWithholdLocation(update) {
  if (!isPlainObject(update)) return update;
  var out = Object.assign({}, update);
  ['message', 'edited_message'].forEach(function (k) {
    var m = out[k];
    if (!isPlainObject(m) || (m.location === undefined && m.venue === undefined)) return;
    var c = Object.assign({}, m);
    delete c.location; delete c.venue;
    c.hb_location_withheld = true;
    out[k] = c;
  });
  return out;
}

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
  // A shared location is never a flow's answer (flows ask for text or buttons): it goes to the pack handlers only.
  var located = !text && (msg.location !== undefined || msg.venue !== undefined || msg.hb_location_withheld === true);
  if (!located && flowClaimText(ctx)) return null;
  var names = Object.keys(HB_REGISTRY.message).sort();
  for (var i = 0; i < names.length; i++) {
    try { if (HB_REGISTRY.message[names[i]](ctx) === true) return null; }
    catch (err) { auditFail('message_handler_error', names[i], describeError(err)); }
  }
  if (located) return null;   // nobody asked for a location: ignored without a word, and never forwarded
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
