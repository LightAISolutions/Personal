/**
 * Hello pack — the smallest helper. Everything here goes through the registries in helpers/core/02_registry.js;
 * nothing touches a core file. Bundle: node helpers/tools/bundle.mjs hello
 */
registerEnvelopeHandler('greeting', {
  validate: function (p) { return (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80) ? ['name required (≤80 chars)'] : []; },
  handle: function (env) {
    var r = tgSendOwner('👋 Hello, ' + tgEscape(env.payload.name) + '!');
    settingSet('hello_greetings', (parseInt(settingGet('hello_greetings', '0'), 10) || 0) + 1);
    return { sent: !!(r && r.ok) };
  }
});
registerCommand('/hello', function (ctx) { ctx.reply('👋 Hello from ' + tgEscape(HELPER.display_name) + ' v' + tgEscape(HELPER.version)); }, 'say hello');
/** Free text starting with "hello" is answered here; anything else goes to the inbound routine as a request. */
registerMessageHandler('hello_echo', function (ctx) {
  if (!/^hello\b/i.test(ctx.text || '')) return false;
  ctx.reply('👋 ' + tgEscape(ctx.text));
  return true;
});
registerSnapshotProvider('hello', function () { return { greetings_sent: parseInt(settingGet('hello_greetings', '0'), 10) || 0 }; });
registerDailyJob('hello_mark', function () { settingSet('hello_last_daily', nowIso()); return { ok: true }; });
registerSetupStep('hello_wave', { label: 'Hello: wave at the owner', description: 'Sends 👋 to the owner chat', run: function () { var r = tgSendOwner('👋'); return r.ok ? 'waved' : 'failed: ' + (r.description || '?'); } });

// Developed by: LightAISolutions
