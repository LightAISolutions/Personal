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
    '\nOne-off triggers: ' + listTriggers().length);
}, 'queue / pending / requests / sweep counts');
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
