/**
 * Helpers core — owner setup page (?route=setup&k=ADMIN_SECRET). No public web page, no dashboard.
 * Bootstrap: the owner runs printSetupUrl() in the Apps Script editor once → opens the logged URL.
 * Lessons kept from the first helper: store WEBAPP_URL because getUrl() can return the /dev URL; every form and link
 * must target the top window (<base target="_top">); secrets stay collapsed until clicked; the time zone comes from state.
 */
function h(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function webAppUrl() {
  var u = getProp(PROP.WEBAPP_URL);
  if (u) return u;
  try { u = ScriptApp.getService().getUrl() || ''; } catch (e) { u = ''; }
  return u;
}
/** The editor's getUrl() can return the test deployment (…/dev), which sits behind a Google login — Telegram cannot reach it. */
function isDevUrl(u) { return /\/dev(?:[?#]|$)/.test(String(u || '')); }
var DEV_URL_HINT = 'This is the test (/dev) URL: it needs a Google login, so Telegram and the brain cannot reach it. Set Script Property ' +
  'WEBAPP_URL (see the property names below) to the pinned deployment URL ending in /exec (Deploy → Manage deployments), then reopen setup from that URL.';
function ensureSecrets() {
  [PROP.ADMIN_SECRET, PROP.WEBHOOK_SECRET].forEach(function (k) { if (!getProp(k)) setProp(k, randomToken(40)); });
  if (!getProp(PROP.PAIR_CODE) && !getProp(PROP.OWNER_CHAT_ID)) setProp(PROP.PAIR_CODE, randomToken(8));
}
/** Run from the editor. Logs the setup URL. */
function printSetupUrl() {
  ensureSecrets();
  var url = _setupUrl();
  if (isDevUrl(webAppUrl())) Logger.log('WARNING: ' + DEV_URL_HINT);
  Logger.log('SETUP URL: ' + url);
  return url;
}
function _adminOk(e) { return safeEqual(param(e, 'k'), getProp(PROP.ADMIN_SECRET)); }
function _setupUrl() { return webAppUrl() + '?route=setup&k=' + getProp(PROP.ADMIN_SECRET); }

function setupStatus() {
  var s = { helper: HELPER.name, version: HELPER.version, core_version: CORE_VERSION, webapp_url: webAppUrl(), wake_url: wakeUrl(),
    token_set: !!getProp(PROP.BOT_TOKEN), owner_chat_id: getProp(PROP.OWNER_CHAT_ID), pair_code: getProp(PROP.PAIR_CODE),
    sheet_id: getProp(PROP.SHEET_ID), root_folder_id: getProp(PROP.ROOT_FOLDER_ID), mailbox_folder_id: getProp(PROP.MAILBOX_FOLDER_ID),
    triggers: listTriggers(), routines: routineNames(), tz: getTz(), webhook_set_at: '', last_sweep: '', queue_depth: '', pending: '', open_requests: '' };
  if (s.sheet_id) {
    try {
      s.webhook_set_at = settingGet('webhook_set_at', ''); s.last_sweep = settingGet('last_sweep', '');
      s.queue_depth = queueDepth(); s.pending = listPendingActions().length; s.open_requests = openRequestCount();
    } catch (e) { s.sheet_error = describeError(e); }
  }
  return s;
}
function setupCreateStorage() {
  var out = [];
  if (!getProp(PROP.SHEET_ID)) {
    var ss = SpreadsheetApp.create(HELPER.display_name + ' — state');
    setProp(PROP.SHEET_ID, ss.getId());
    _HB_SS_CACHE = null;
    try { DriveApp.getFileById(ss.getId()).moveTo(getRootFolder()); } catch (e) { /* ignore */ }
    out.push('Sheet created');
  }
  out.push('Tabs ensured: ' + ensureSheets().length + ' created');
  var f = getMailboxFolders();
  out.push('Mailbox folders ready (' + f.mailbox.getId() + ')');
  audit('setup_storage', '', out);
  return out.join(' · ');
}
function setupSetWebhook() {
  ensureSecrets();
  var url = webAppUrl() + '?route=tg&k=' + getProp(PROP.WEBHOOK_SECRET);
  var me = tgGetMe();
  if (!me.ok) return 'getMe failed: ' + (me.description || '?');
  var r = tgSetWebhook(url);
  if (r.ok) { try { settingSet('webhook_set_at', nowIso(), '@' + (me.result && me.result.username)); } catch (e) { /* no sheet yet */ } }
  audit('setup_webhook', '', { ok: r.ok, bot: me.result && me.result.username }, r.ok);
  return r.ok ? 'Webhook set for @' + (me.result && me.result.username) : 'setWebhook failed: ' + (r.description || '?');
}
function runSetupAction(action, e) {
  switch (action) {
    case 'save_token': {
      // Tolerate what a copy from @BotFather really yields: surrounding message text, backticks, zero-width characters.
      var raw = param(e, 'token').replace(/[​-‍⁠﻿`'"]/g, '');
      var m = /(?:^|[^A-Za-z0-9_-])(\d{3,}:[A-Za-z0-9_-]{20,})(?![A-Za-z0-9_-])/.exec(raw);
      if (!m) return 'Token format looks wrong — pasted ' + raw.trim().length + ' characters, expected one token like 123456789:AA… (about 46 characters)';
      setProp(PROP.BOT_TOKEN, m[1]); ensureSecrets(); return 'Token saved';
    }
    case 'save_webapp_url': {
      var u = param(e, 'url').trim();
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u)) return 'URL must look like https://script.google.com/macros/s/<deployment id>/exec';
      setProp(PROP.WEBAPP_URL, u); return 'Web app URL saved — reopen setup from it';
    }
    case 'create_storage': return setupCreateStorage();
    case 'set_webhook': return setupSetWebhook();
    case 'write_snapshot': { var r0 = wakeSweep('setup'); return r0.skipped ? 'Sweep skipped: ' + r0.skipped : 'Swept and snapshot written (' + (r0.processed || 0) + ' envelope(s) handled)'; }
    case 'reset_pairing': delProp(PROP.OWNER_CHAT_ID); setProp(PROP.PAIR_CODE, randomToken(8)); return 'Pairing reset — send /start <code> again';
    case 'rotate_webhook_secret': setProp(PROP.WEBHOOK_SECRET, randomToken(40)); return 'Webhook secret rotated · ' + setupSetWebhook();
    case 'clear_triggers': return 'Removed ' + clearOneOffTriggers() + ' one-off trigger(s)';
    case 'test_message': { var r = tgSendOwner('✅ Test message from ' + tgEscape(HELPER.display_name) + ' v' + tgEscape(HELPER.version)); return r.ok ? 'Sent' : 'Failed: ' + (r.description || '?'); }
    default: {
      var m2 = /^step:([a-z0-9_]+)$/.exec(action || '');
      var step = m2 && HB_REGISTRY.setup[m2[1]];
      if (!step) return 'Unknown action';
      return String(step.run() || 'done');
    }
  }
}

function _page(title, body) {
  // HtmlService renders inside a sandboxed googleusercontent.com iframe; script.google.com refuses to be framed, so every
  // form POST and link must navigate the top window (<base target="_top">), otherwise the browser shows "refused to connect".
  return HtmlService.createHtmlOutput('<!doctype html><html><head><meta charset="utf-8"><base target="_top"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + h(title) + '</title>' +
    '<style>body{font:15px/1.5 system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;color:#222}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:.35rem .5rem;text-align:left;vertical-align:top}code{background:#f4f4f4;padding:0 .25rem}form{display:inline-block;margin:.25rem .5rem .25rem 0}button{padding:.4rem .8rem}.ok{color:#080}.warn{color:#b60}.msg{background:#eef;padding:.6rem 1rem;border-left:4px solid #55c;margin:1rem 0}details.secret{display:inline-block;margin-left:.5rem}details.secret summary{cursor:pointer;color:#55c}</style></head><body>' +
    '<h1>' + h(title) + '</h1>' + body + '<p style="margin-top:3rem;color:#888">' + h(HELPER.display_name) + ' v' + h(HELPER.version) + ' · helpers core v' + h(CORE_VERSION) + '</p></body></html>').setTitle(title);
}
function _form(action, label, extra) {
  return '<form method="post" target="_top" action="' + h(webAppUrl()) + '?route=setup&amp;k=' + h(getProp(PROP.ADMIN_SECRET)) + '"><input type="hidden" name="action" value="' + h(action) + '">' + (extra || '') + '<button>' + h(label) + '</button></form>';
}
function _yes(b) { return b ? '<span class="ok">✔</span>' : '<span class="warn">✘</span>'; }
/** Secrets stay collapsed until clicked (owners screenshot this page). Pure HTML — no script needed in the HtmlService sandbox. */
function _reveal(v, label) { return '<details class="secret"><summary>' + h(label || 'Show') + '</summary><code>' + h(v) + '</code></details>'; }

function renderSetupPage(message) {
  var s = setupStatus();
  var rows = [
    ['Web app URL', '<code>' + h(s.webapp_url || '(unknown — deploy first)') + '</code>' + (isDevUrl(s.webapp_url) ? '<br><span class="warn">⚠ ' + h(DEV_URL_HINT) + '</span>' : '')],
    ['Wake URL (for the brain)', s.wake_url ? '<code>' + h(s.wake_url) + '</code>' : _yes(false)],
    ['Bot token', _yes(s.token_set)],
    ['Owner chat', s.owner_chat_id ? _yes(true) + ' <code>' + h(s.owner_chat_id) + '</code>' : _yes(false) + ' send <code>/start &lt;pair code&gt;</code> to your bot (after the webhook is set)' + _reveal(s.pair_code, 'Show pair code')],
    ['Sheet', s.sheet_id ? '<a href="https://docs.google.com/spreadsheets/d/' + h(s.sheet_id) + '">open</a>' : _yes(false)],
    ['Drive mailbox', s.mailbox_folder_id ? '<a href="https://drive.google.com/drive/folders/' + h(s.mailbox_folder_id) + '">open</a>' : _yes(false)],
    ['Webhook set', s.webhook_set_at ? _yes(true) + ' ' + h(fmtLocalIso(s.webhook_set_at)) : _yes(false)],
    ['Last sweep', h(fmtLocalIso(s.last_sweep)) + ' · queue ' + h(s.queue_depth) + ' · pending ' + h(s.pending) + ' · open requests ' + h(s.open_requests) + ' · one-off triggers ' + h(s.triggers.length)],
    ['Routines configured', h(s.routines.join(', ') || 'none') + '<br><small>add <code>' + h(routineProp('NAME', 'URL')) + '</code> and <code>' + h(routineProp('NAME', 'TOKEN')) + '</code> in Script Properties; the inbound routine is <code>' + h(HELPER.inbound_routine) + '</code></small>'],
    ['Timezone', h(s.tz) + ' <small>(override with Script Property <code>' + h(PROP.TIMEZONE) + '</code>)</small>'],
    ['Property names', '<small>' + PROP_KEYS.map(function (k) { return '<code>' + h(PROP[k]) + '</code>'; }).join(' ') + '</small>']
  ];
  var body = (message ? '<div class="msg">' + h(message) + '</div>' : '') +
    (isDevUrl(s.webapp_url) ? '<div class="msg warn">⚠ ' + h(DEV_URL_HINT) + '</div>' : '') +
    '<table>' + rows.map(function (r) { return '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td></tr>'; }).join('') + '</table>' +
    '<h2>Steps (in order)</h2>' +
    _form('save_webapp_url', '0. Save deployment URL', '<input name="url" placeholder="https://script.google.com/macros/s/…/exec" size="48"> ') +
    _form('save_token', '1. Save bot token', '<input name="token" placeholder="123456:ABC…" size="48"> ') +
    _form('create_storage', '2. Create Sheet + Drive folders') + _form('set_webhook', '3. Set Telegram webhook') +
    (!s.owner_chat_id ? '<div>4. In Telegram send <code>/start &lt;pair code&gt;</code> to your bot.' + _reveal(s.pair_code, 'Show pair code') + '</div>' : '<p>4. Paired ✔ (Maintenance → Reset pairing to pair again).</p>') +
    _form('write_snapshot', '5. Sweep + write snapshot') + _form('test_message', '6. Send test message') +
    '<h2>Pack steps</h2>' + (Object.keys(HB_REGISTRY.setup).sort().map(function (k) { var st = HB_REGISTRY.setup[k]; return _form('step:' + k, st.label) + (st.description ? '<small>' + h(st.description) + '</small><br>' : ''); }).join('') || '<p>none</p>') +
    '<h2>Maintenance</h2>' + _form('clear_triggers', 'Clear one-off triggers') + _form('reset_pairing', 'Reset pairing') + _form('rotate_webhook_secret', 'Rotate webhook secret');
  return _page(HELPER.display_name + ' — setup', body);
}
function routeSetupGet(e) {
  if (!getProp(PROP.ADMIN_SECRET)) return _page('Setup', '<p>Run <code>printSetupUrl()</code> in the Apps Script editor first, then open the logged URL.</p>');
  if (!_adminOk(e)) { auditFail('setup_auth_fail', '', null); return _page('Forbidden', '<p>Bad or missing key.</p>'); }
  return renderSetupPage(param(e, 'msg'));
}
function routeSetupPost(e) {
  if (!_adminOk(e)) { auditFail('setup_auth_fail', '', null); return _page('Forbidden', '<p>Bad or missing key.</p>'); }
  var action = param(e, 'action');
  var msg;
  try { msg = runSetupAction(action, e); } catch (err) { msg = 'Error: ' + describeError(err); auditFail('setup_action_error', action, describeError(err)); }
  audit('setup_action', action, truncate(msg, 300));
  return renderSetupPage(action + ': ' + msg);
}

// Developed by: LightAISolutions
