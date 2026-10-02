/**
 * Helpers core — Telegram client.
 * Conventions: parse_mode HTML + tgEscape() on ALL untrusted text; messages split at LIMITS.TG_SPLIT_AT (tgSplit: never inside a
 * tag or entity, open tags closed and reopened across chunks); single-message fields clipped with tgClip; when Telegram still
 * refuses the HTML, every sender retries once as plain text (tgStripHtml);
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
/** Plain-text fallback for when Telegram refuses the HTML ("can't parse entities"): tags removed, escapes restored. */
function tgStripHtml(html) {
  return String(html === undefined || html === null ? '' : html).replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}
/**
 * Brain-written HTML reduced to Telegram's tag set (a `reply` with `html: true`): everything is escaped, then the plain
 * formatting tags and `<a href="https://…">` are re-opened. A tag Telegram would accept but the brain should not send —
 * `<tg-emoji>`, an attribute on `<b>`, a link with userinfo (an `@` before the host) or a non-https scheme —
 * stays visible text. Unbalanced tags still reach Telegram's 400 and the plain-text retry handles them (Phase 6 red-team A8).
 * Which hosts a place link may open is the pack's decision (Tour Guide links only Google Maps).
 */
var TG_SAFE_TAG_RE = /&lt;(\/?)(b|strong|i|em|u|ins|s|strike|del|code|pre|blockquote|tg-spoiler)&gt;/g;
var TG_SAFE_LINK_RE = /&lt;a href="(https:\/\/(?:[^"<>\s&@]|&amp;){1,400})"&gt;/g;
var TG_SAFE_ENTITY_RE = /&amp;(amp|lt|gt|quot|#[0-9]{1,7}|#x[0-9a-fA-F]{1,6});/g;
function tgSafeHtml(s) {
  // Entities the brain wrote (`&amp;`, `&lt;`, `&#8212;`) are restored last, so an escaped `&lt;b&gt;` stays visible text.
  return tgEscape(s).replace(TG_SAFE_TAG_RE, '<$1$2>').replace(TG_SAFE_LINK_RE, '<a href="$1">').replace(/&lt;\/a&gt;/g, '</a>')
    .replace(TG_SAFE_ENTITY_RE, '&$1;');
}
/** A copy of `params` for the plain-text retry: parse_mode dropped, `field` stripped of HTML. Never mutates the first attempt's object. */
function _tgPlainRetry(params, field) {
  var plain = {};
  for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) plain[k] = params[k];
  delete plain.parse_mode;
  plain[field] = tgStripHtml(params[field]);
  return plain;
}
var TG_HTML_TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)(\s[^<>]*)?>/g;
/** The tags still open at the end of an HTML fragment, outermost first: [{ name, raw }]. A closing tag closes its nearest
 *  open match and everything opened after it (as a parser would). */
function _tgOpenTags(html) {
  var stack = [], m;
  TG_HTML_TAG_RE.lastIndex = 0;
  while ((m = TG_HTML_TAG_RE.exec(html))) {
    var name = m[2].toLowerCase();
    if (m[1]) { for (var i = stack.length - 1; i >= 0; i--) if (stack[i].name === name) { stack.length = i; break; } }
    else if (!/\/\s*>$/.test(m[0])) stack.push({ name: name, raw: m[0] });
  }
  return stack;
}
/** Where to cut `text` so the piece is ≤ max: at the last newline (then space) past the midpoint, else hard — but never
 *  inside a tag (<…>) or an entity (&…;), which Telegram would reject. */
function _tgCutPoint(text, max) {
  if (max < 1) max = 1;
  var cut = text.lastIndexOf('\n', max);
  if (cut < max * 0.5) cut = text.lastIndexOf(' ', max);
  if (cut < max * 0.5) cut = max;
  var lt = text.lastIndexOf('<', cut - 1);
  if (lt >= 0) { var gt = text.indexOf('>', lt); if (gt === -1 || gt >= cut) cut = lt; }
  var amp = text.lastIndexOf('&', cut - 1);
  if (amp >= 0 && cut - amp <= 8) { var semi = text.indexOf(';', amp); if (semi === -1 || semi >= cut) cut = amp; }
  return cut > 0 ? cut : max;
}
/** Split HTML into chunks of ≤ max chars: on newlines (then spaces, then hard), never inside a tag or an entity; tags
 *  left open at a cut are closed at the end of the chunk and reopened at the start of the next, so every chunk parses. */
function tgSplit(text, max) {
  max = max || LIMITS.TG_SPLIT_AT;
  text = String(text || '');
  var chunks = [], carry = '';
  while (carry.length + text.length > max) {
    var room = max - carry.length, piece, open, closers;
    for (var attempt = 0; attempt < 4; attempt++) {
      var cut = _tgCutPoint(text, room);
      piece = text.slice(0, cut);
      open = _tgOpenTags(carry + piece);
      closers = open.map(function (t) { return '</' + t.name + '>'; }).reverse().join('');
      if (carry.length + piece.length + closers.length <= max || room - closers.length < 1) break;
      room -= closers.length;
    }
    chunks.push(carry + piece + closers);
    carry = open.map(function (t) { return t.raw; }).join('');
    text = text.slice(piece.length).replace(/^\n/, '');
  }
  if (text.length || !chunks.length) chunks.push(carry + text);
  return chunks;
}
/** One message's worth of HTML: ≤ max chars with every open tag closed and '…' when something was cut. */
function tgClip(html, max) {
  html = String(html === undefined || html === null ? '' : html);
  if (html.length <= max) return html;
  return tgSplit(html, max - 1)[0] + '…';
}

/** Build an inline keyboard from rows of {text, data}, {text, url} or {text, web_app: {url}} (a Mini App button, https only). Validates callback_data ≤ 64 bytes. */
function tgKeyboard(rows) {
  return {
    inline_keyboard: rows.map(function (row) {
      return row.map(function (b) {
        if (b.web_app) {
          var wu = String(b.web_app.url || '');
          if (!/^https:\/\//.test(wu)) throw new Error('tgKeyboard: web_app url must be https');
          return { text: String(b.text), web_app: { url: wu } };
        }
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
      last = tgApi('sendMessage', _tgPlainRetry(params, 'text'));
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
  var text = tgClip(html, LIMITS.TG_MAX_CHARS);
  var params = { chat_id: chatId, message_id: messageId, text: text, parse_mode: 'HTML', disable_web_page_preview: true };
  params.reply_markup = keyboard || { inline_keyboard: [] };
  var r = tgApi('editMessageText', params);
  if (!r.ok && /can't parse entities/i.test(String(r.description || ''))) {
    r = tgApi('editMessageText', _tgPlainRetry(params, 'text'));
  }
  return r;
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
  if (spec.caption) { params.caption = tgClip(String(spec.caption), LIMITS.DOCUMENT_CAPTION_CHARS); params.parse_mode = 'HTML'; }
  if (spec.replyTo) params.reply_to_message_id = String(spec.replyTo);
  if (spec.silent) params.disable_notification = 'true';
  var r = tgApiMultipart('sendDocument', params);
  if (!r.ok && params.parse_mode && /can't parse entities/i.test(String(r.description || ''))) {
    r = tgApiMultipart('sendDocument', _tgPlainRetry(params, 'caption'));
  }
  return r;
}
function tgSendOwnerDocument(spec) {
  var chat = tgOwnerChatId();
  if (!chat) { auditFail('tg_send_no_owner', '', 'document'); return { ok: false, description: PROP.OWNER_CHAT_ID + ' not set' }; }
  return tgSendDocument(chat, spec);
}
/* ---------------- Mini App (Telegram Web App) ---------------- */
function _tgHex(bytes) { var out = ''; for (var i = 0; i < bytes.length; i++) out += ('0' + ((bytes[i] + 256) % 256).toString(16)).slice(-2); return out; }
/**
 * Verify a Mini App's `initData` (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
 * drop `hash`, sort the remaining key=value pairs, join with "\n", secret = HMAC-SHA256(key "WebAppData", message BOT_TOKEN),
 * hash = hex(HMAC-SHA256(secret, data_check_string)), constant-time compare. Then auth_date must be within maxAgeSec and
 * user.id must be OWNER_CHAT_ID. Returns { ok, user, auth_date, start_param, reason } — reasons are short words, never the data.
 */
function tgVerifyInitData(initData, opts) {
  opts = opts || {};
  var maxAge = opts.maxAgeSec === undefined ? LIMITS.INITDATA_MAX_AGE_SEC : opts.maxAgeSec;
  var fail = function (reason) { return { ok: false, user: null, auth_date: 0, start_param: '', reason: reason }; };
  if (typeof initData !== 'string' || !initData) return fail('missing');
  if (initData.length > LIMITS.INITDATA_MAX_CHARS) return fail('too_long');
  var fields = {}, hash = '', parts = initData.split('&');
  for (var i = 0; i < parts.length; i++) {
    var eq = parts[i].indexOf('=');
    if (eq <= 0) return fail('malformed');
    var k, v;
    try { k = decodeURIComponent(parts[i].slice(0, eq)); v = decodeURIComponent(parts[i].slice(eq + 1)); } catch (e) { return fail('malformed'); }
    if (k === 'hash') { if (hash) return fail('malformed'); hash = v; continue; }
    if (Object.prototype.hasOwnProperty.call(fields, k)) return fail('malformed');
    fields[k] = v;
  }
  if (!/^[0-9a-f]{64}$/.test(hash)) return fail('missing_hash');
  if (!fields.auth_date || !fields.user) return fail('missing_field');
  var dcs = Object.keys(fields).sort().map(function (k2) { return k2 + '=' + fields[k2]; }).join('\n');
  var secret = Utilities.computeHmacSha256Signature(Utilities.newBlob(tgToken()).getBytes(), Utilities.newBlob('WebAppData').getBytes());
  var sig = Utilities.computeHmacSha256Signature(Utilities.newBlob(dcs).getBytes(), secret);
  if (!safeEqual(_tgHex(sig), hash)) return fail('bad_hash');
  var ad = parseInt(fields.auth_date, 10);
  if (!(ad > 0) || !/^\d{1,12}$/.test(fields.auth_date)) return fail('bad_auth_date');
  if (maxAge > 0 && Math.floor(nowMs() / 1000) - ad > maxAge) return fail('expired');
  var u = safeJsonParse(fields.user);
  if (!u.ok || !isPlainObject(u.value) || u.value.id === undefined || u.value.id === null) return fail('bad_user');
  var owner = tgOwnerChatId();
  if (!owner || String(u.value.id) !== String(owner)) return fail('not_owner');
  return { ok: true, user: u.value, auth_date: ad, start_param: typeof fields.start_param === 'string' ? fields.start_param.slice(0, 512) : '', reason: '' };
}
/** The owner chat's menu button opens the Mini App at `url` (https). tgMenuButtonDefault() restores Telegram's default. */
function tgSetMenuButton(url, text) {
  var chat = tgOwnerChatId();
  if (!chat) return { ok: false, description: PROP.OWNER_CHAT_ID + ' not set' };
  url = String(url || '');
  if (!/^https:\/\//.test(url)) return { ok: false, description: 'menu button url must be https' };
  return tgApi('setChatMenuButton', { chat_id: chat, menu_button: { type: 'web_app', text: truncate(String(text || 'Open'), 32), web_app: { url: url } } });
}
function tgMenuButtonDefault() {
  var chat = tgOwnerChatId();
  if (!chat) return { ok: false, description: PROP.OWNER_CHAT_ID + ' not set' };
  return tgApi('setChatMenuButton', { chat_id: chat, menu_button: { type: 'default' } });
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
