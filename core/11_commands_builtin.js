/** Helpers core — built-in Telegram commands. Packs add theirs via registerCommand/registerCallback. */

registerCommand('/start', function (ctx) {
  ctx.reply('👋 ' + tgEscape(HELPER.display_name) + ' is paired to this chat. Send /help for commands.\nAnything else you type goes to the helper as a request.');
  startExtras(ctx.chatId);
});
/**
 * A pack may add one message after the /start greeting (and after pairing) by registering the renderer 'core_start':
 * fn({chatId}) → '' | html | {html, keyboard?} (keyboard built with tgKeyboard). A failing renderer is audited, never fatal.
 */
function startExtras(chatId) {
  var r = getRenderer('core_start');
  if (!r) return null;
  try {
    var out = r({ chatId: chatId });
    if (!out) return null;
    if (typeof out === 'string') return tgSend(chatId, out);
    return out.html ? tgSend(chatId, String(out.html), out.keyboard ? { keyboard: out.keyboard } : undefined) : null;
  } catch (err) { auditFail('start_extras_error', '', describeError(err)); return null; }
}
/* ---------------- Telegram's own "/" menu (setMyCommands), from the registry ---------------- */
var HB_MENU_MAX = 100;            // Telegram: at most 100 commands
var HB_MENU_DESC_MAX = 256;       // Telegram: description 1–256 characters
/**
 * The commands Telegram lists when the owner types "/" in the chat: [{ command, description }] in menu order. A pack may
 * order and describe them by registering the renderer 'command_menu': fn(listCommands()) → [{ cmd, description }]; the core
 * keeps only registered commands with a non-empty description (cut to 256), once each, at most 100. Without the renderer,
 * every command with a help line, sorted. Chat-only commands (/start) are left out: the menu is for what you send.
 */
function botCommandMenu() {
  var live = listCommands(), known = {}, out = [], seen = {};
  live.forEach(function (c) { known[c.cmd] = c.help; });
  var rows = live.map(function (c) { return { cmd: c.cmd, description: c.help }; });
  var r = getRenderer('command_menu');
  if (r) {
    try { var got = r(live); if (Array.isArray(got)) rows = got; }
    catch (err) { auditFail('command_menu_error', '', describeError(err)); }
  }
  rows.forEach(function (x) {
    if (!isPlainObject(x) || out.length >= HB_MENU_MAX) return;
    var cmd = String(x.cmd || ''), d = String(x.description || '').replace(/\s+/g, ' ').trim();
    if (!Object.prototype.hasOwnProperty.call(known, cmd) || seen[cmd] || HB_CHAT_ONLY_COMMANDS.indexOf(cmd) >= 0 || !d) return;
    seen[cmd] = true;
    out.push({ command: cmd.slice(1), description: truncate(d, HB_MENU_DESC_MAX) });
  });
  return out;
}
function _botMenuHash(menu) {
  var s = toJson(menu), h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return 'v1:' + h.toString(16) + ':' + s.length;
}
/**
 * Sends the menu to Telegram for the owner's chat only (scope chat), so a stranger who finds the bot sees no list. Records
 * its fingerprint (BOT_COMMANDS) when Telegram accepts it. → { ok, count, skipped? , description? }
 */
function syncBotCommands(force) {
  var owner = tgOwnerChatId();
  if (!owner) return { ok: false, count: 0, description: PROP.OWNER_CHAT_ID + ' not set' };
  var menu = botCommandMenu(), hash = _botMenuHash(menu);
  if (!force && getProp(PROP.BOT_COMMANDS) === hash) return { ok: true, count: menu.length, skipped: true };
  var r = tgApi('setMyCommands', { commands: menu, scope: { type: 'chat', chat_id: owner } });
  if (r && r.ok) { setProp(PROP.BOT_COMMANDS, hash); audit('bot_commands_set', String(menu.length), null); }
  return { ok: !!(r && r.ok), count: menu.length, description: r && !r.ok ? String(r.description || '') : '' };
}
/** Once per run, on the first owner update: a deploy that added, renamed or re-described a command updates the menu. */
var _HB_MENU_CHECKED = false;
function syncBotCommandsOnce() {
  if (_HB_MENU_CHECKED) return null;
  _HB_MENU_CHECKED = true;
  try { return syncBotCommands(false); } catch (err) { auditFail('bot_commands_error', '', describeError(err)); return null; }
}
registerSetupStep('bot_commands', {
  label: 'Telegram "/" menu: list the commands',
  description: 'Typing "/" in the chat shows every command with a one-line hint; also refreshed by itself after a deploy',
  run: function () {
    var r = syncBotCommands(true);
    return r.ok ? 'menu set: ' + r.count + ' commands' : 'failed: ' + truncate(String(r.description || '?'), 200);
  }
});

registerCommand('/help', function (ctx) {
  var lines = HB_REGISTRY.help.slice().sort();
  ctx.reply('<b>Commands</b>\n' + lines.map(tgEscape).join('\n') + '\n\nPlain text → a request the helper answers here.');
}, 'this list');
registerCommand('/ping', function (ctx) { ctx.reply('pong · ' + tgEscape(fmtLocal()) + ' · ' + tgEscape(HELPER.name) + ' v' + tgEscape(HELPER.version) + ' · core v' + CORE_VERSION); }, 'liveness check');
registerCommand('/id', function (ctx) { ctx.reply('chat <code>' + tgEscape(ctx.chatId) + '</code> · user <code>' + tgEscape(ctx.from.id) + '</code>'); }, 'show chat/user id');
registerCommand('/status', function (ctx) {
  ctx.reply('<b>Status</b> ' + tgEscape(HELPER.name) + ' v' + tgEscape(HELPER.version) +
    '\nQueue: ' + queueDepth() + ' waiting' +
    '\nPending actions: ' + listPendingActions().length +
    '\nOpen requests: ' + openRequestCount() +
    '\nLast sweep: ' + tgEscape(fmtLocalIso(settingGet('last_sweep', ''))) +
    '\nWakes today: ' + settingDailyCount('wakes') +
    '\nRoutine fires today: ' + settingDailyCount('routine_fires') +
    '\nOne-off triggers: ' + listTriggers().length + statusExtras());
}, 'queue / pending / requests / sweep counts');
/**
 * A pack may add lines to /status by registering the renderer 'core_status': fn() → '' | html (already escaped; one
 * or more lines). A failing renderer is audited and leaves /status as the core writes it.
 */
function statusExtras() {
  var r = getRenderer('core_status');
  if (!r) return '';
  try { var out = r(); return out ? '\n' + String(out) : ''; }
  catch (err) { auditFail('status_extras_error', '', describeError(err)); return ''; }
}
registerCommand('/pending', function (ctx) {
  var rows = listPendingActions();
  if (!rows.length) { ctx.reply('No pending actions.'); return; }
  rows.slice(0, 20).forEach(function (r) {
    ctx.reply(renderActionMessage(r, '⏳ awaiting your decision'), { keyboard: actionKeyboard(r.id) });
  });
}, 're-send pending action proposals');
registerCommand('/expire', function (ctx) {
  var n = expirePendingActions();
  ctx.reply('Expired ' + n + ' stale proposal(s).');
}, 'expire stale proposals now');
registerCommand('/ask', function (ctx) {
  var text = String(ctx.args || '').trim();
  if (!text) { ctx.reply('Usage: /ask &lt;question or task&gt;'); return; }
  requestFromMessage(ctx, 'ask', text);
}, 'send a request to the helper: /ask <text>');
// The webhook handler holds the script lock and must answer Telegram fast, so /wake schedules the sweep instead of running it.
registerCommand('/wake', function (ctx) {
  scheduleOneOff('wakeTrigger', 1);
  ctx.reply('⏱ Sweep scheduled — the mailbox is read within a minute.');
}, 'sweep the mailbox soon');

// Developed by: LightAISolutions
