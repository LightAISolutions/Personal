/**
 * Helpers core — Telegram client.
 * Conventions: parse_mode HTML + tgEscape() on ALL untrusted text; messages split at LIMITS.TG_SPLIT_AT;
 * callback_data ≤ 64 bytes encoded as "<prefix>:<part>:<part>"; always answerCallbackQuery.
 * Automatic messages go ONLY to the owner chat (tgSendOwner). Never send to any other chat id.
 * Files: tgSendDocument / tgSendOwnerDocument (multipart sendDocument, ≤ LIMITS.DOCUMENT_MAX_BYTES, else the Drive link).
 */
var TG_API_BASE = 'https://api.telegram.org/bot';

function tgToken() {
  var t = getProp(PROP.BOT_TOKEN);
  if (!t) throw new Error(PROP.BOT_TOKEN + ' not set');
  return t;
}
function tgOwnerChatId() { return getProp(PROP.OWNER_CHAT_ID); }

/** Low-level call. Returns the parsed Telegram response ({ok, result|description}). Never throws on API errors. */
function tgApi(method, params) {
  return _tgCall(method, { method: 'post', contentType: 'application/json', payload: toJson(params || {}), muteHttpExceptions: true });
}
/** Same, as multipart/form-data (UrlFetchApp builds the form when the payload object holds a Blob). Used for files. */
function tgApiMultipart(method, params) {
  return _tgCall(method, { method: 'post', payload: params || {}, muteHttpExceptions: true });
}
function _tgCall(method, options) {
  var res;
  try { res = UrlFetchApp.fetch(TG_API_BASE + tgToken() + '/' + method, options); }
  catch (e) {
    auditFail('tg_api_error', method, describeError(e));
    return { ok: false, description: describeError(e) };
  }
  var parsed = safeJsonParse(res.getContentText());
  var body = parsed.ok ? parsed.value : { ok: false, description: 'non-JSON response ' + res.getResponseCode() };
  if (!body.ok) auditFail('tg_api_fail', method, { code: res.getResponseCode(), description: body.description });
  return body;
}

function tgEscape(s) {
  return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
/** Split on newlines (then hard) so every chunk is ≤ max chars. */
function tgSplit(text, max) {
  max = max || LIMITS.TG_SPLIT_AT;
  text = String(text || '');
  var chunks = [];
  while (text.length > max) {
    var cut = text.lastIndexOf('\n', max);
    if (cut < max * 0.5) cut = text.lastIndexOf(' ', max);
    if (cut < max * 0.5) cut = max;
    chunks.push(text.slice(0, cut));
    text = text.slice(cut).replace(/^\n/, '');
  }
  if (text.length || !chunks.length) chunks.push(text);
  return chunks;
}

/** Build an inline keyboard from rows of {text, data} or {text, url}. Validates callback_data ≤ 64 bytes. */
function tgKeyboard(rows) {
  return {
    inline_keyboard: rows.map(function (row) {
      return row.map(function (b) {
        if (b.url) return { text: String(b.text), url: String(b.url) };
        var data = String(b.data);
        if (utf8Bytes(data) > LIMITS.CB_DATA_MAX_BYTES) throw new Error('callback_data > 64 bytes: ' + data);
        return { text: String(b.text), callback_data: data };
      });
    })
  };
}
/** cbEncode('a', id, 'y') -> 'a:<id>:y'. Parts may only contain [A-Za-z0-9_.|-]. */
function cbEncode(prefix) {
  var parts = Array.prototype.slice.call(arguments, 1).map(String);
  if (!/^[a-z][a-z0-9]{0,7}$/.test(prefix)) throw new Error('cbEncode: bad prefix');
  parts.forEach(function (p) { if (!/^[A-Za-z0-9_.|-]*$/.test(p)) throw new Error('cbEncode: bad part "' + p + '"'); });
  var data = [prefix].concat(parts).join(':');
  if (utf8Bytes(data) > LIMITS.CB_DATA_MAX_BYTES) throw new Error('cbEncode: > 64 bytes');
  return data;
}
function cbDecode(data) {
  var parts = String(data || '').split(':');
  return { prefix: parts[0] || '', parts: parts.slice(1) };
}

/** Send HTML text (already escaped by caller) to a chat; splits; keyboard rides on the LAST chunk. */
function tgSend(chatId, html, opts) {
  opts = opts || {};
  var chunks = tgSplit(html);
  var last = null;
  for (var i = 0; i < chunks.length; i++) {
    var params = { chat_id: chatId, text: chunks[i], parse_mode: 'HTML', disable_web_page_preview: opts.preview ? false : true };
    if (opts.replyTo) params.reply_to_message_id = opts.replyTo;
    if (opts.silent) params.disable_notification = true;
    if (i === chunks.length - 1 && opts.keyboard) params.reply_markup = opts.keyboard;
    last = tgApi('sendMessage', params);
    if (!last.ok && /can't parse entities/i.test(String(last.description || ''))) {
      delete params.parse_mode; params.text = chunks[i].replace(/<[^>]+>/g, '');
      last = tgApi('sendMessage', params);
    }
  }
  return last;
}
function tgSendOwner(html, opts) {
  var chat = tgOwnerChatId();
  if (!chat) { auditFail('tg_send_no_owner', '', truncate(html, 200)); return { ok: false, description: PROP.OWNER_CHAT_ID + ' not set' }; }
  return tgSend(chat, html, opts);
}
function tgEdit(chatId, messageId, html, keyboard) {
  var params = { chat_id: chatId, message_id: messageId, text: truncate(html, LIMITS.TG_MAX_CHARS), parse_mode: 'HTML', disable_web_page_preview: true };
  params.reply_markup = keyboard || { inline_keyboard: [] };
  return tgApi('editMessageText', params);
}
function tgAnswerCallback(callbackQueryId, text, showAlert) {
  var p = { callback_query_id: callbackQueryId };
  if (text) p.text = truncate(text, 200);
  if (showAlert) p.show_alert = true;
  return tgApi('answerCallbackQuery', p);
}
/**
 * Send a file as a Telegram document: tgSendDocument(chatId, { driveFileId | blob, filename?, caption? (html), replyTo? }).
 * Files over LIMITS.DOCUMENT_MAX_BYTES cannot go through the Bot API — the owner gets the Drive link instead
 * (audited document_too_large). Returns the Telegram response ({ok, ...}); never throws on API errors.
 */
function tgSendDocument(chatId, spec) {
  spec = spec || {};
  var blob = spec.blob || null, file = null, bytes = 0, name = spec.filename ? String(spec.filename) : '';
  if (!blob && spec.driveFileId) {
    try { file = DriveApp.getFileById(String(spec.driveFileId)); }
    catch (e) { auditFail('document_not_found', String(spec.driveFileId), describeError(e)); return { ok: false, description: 'file not found' }; }
    bytes = file.getSize();
    if (!name) name = file.getName();
    if (bytes > LIMITS.DOCUMENT_MAX_BYTES) {
      auditFail('document_too_large', String(spec.driveFileId), { bytes: bytes, name: name });
      var line = '📎 <b>' + tgEscape(name) + '</b> (' + Math.round(bytes / 1048576) + ' MB, too large to attach)' + (spec.caption ? '\n' + spec.caption : '') + '\n' + tgEscape(file.getUrl());
      var sent = tgSend(chatId, line, { replyTo: spec.replyTo });
      return { ok: !!(sent && sent.ok), fallback: 'link', description: 'document_too_large', result: sent && sent.result };
    }
    blob = file.getBlob();
  }
  if (!blob) return { ok: false, description: 'tgSendDocument: driveFileId or blob required' };
  if (!file) {
    try { bytes = blob.getBytes().length; } catch (e) { bytes = 0; }
    if (bytes > LIMITS.DOCUMENT_MAX_BYTES) { auditFail('document_too_large', name || '(blob)', { bytes: bytes }); return { ok: false, description: 'document_too_large' }; }
  }
  if (name && typeof blob.setName === 'function') blob.setName(name);
  var params = { chat_id: String(chatId), document: blob };
  if (spec.caption) { params.caption = truncate(String(spec.caption), LIMITS.DOCUMENT_CAPTION_CHARS); params.parse_mode = 'HTML'; }
  if (spec.replyTo) params.reply_to_message_id = String(spec.replyTo);
  if (spec.silent) params.disable_notification = 'true';
  return tgApiMultipart('sendDocument', params);
}
function tgSendOwnerDocument(spec) {
  var chat = tgOwnerChatId();
  if (!chat) { auditFail('tg_send_no_owner', '', 'document'); return { ok: false, description: PROP.OWNER_CHAT_ID + ' not set' }; }
  return tgSendDocument(chat, spec);
}
function tgGetMe() { return tgApi('getMe', {}); }
function tgSetWebhook(url) {
  return tgApi('setWebhook', { url: url, drop_pending_updates: true, allowed_updates: ['message', 'callback_query'], max_connections: 4 });
}
function tgDeleteWebhook() { return tgApi('deleteWebhook', { drop_pending_updates: false }); }
function tgGetFileUrl(fileId) {
  var r = tgApi('getFile', { file_id: fileId });
  if (!r.ok || !r.result || !r.result.file_path) return null;
  return 'https://api.telegram.org/file/bot' + tgToken() + '/' + r.result.file_path;
}

// Developed by: LightAISolutions
