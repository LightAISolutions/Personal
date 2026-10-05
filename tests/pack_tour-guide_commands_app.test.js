'use strict';
// Tour Guide pack — gas/45_commands_app.js: the app's Commands tab (commands.list) and the core's listCommands(). The tab's
// list is the registry: every command the bot answers is shown and described, and nothing it does not answer is offered.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness/gas-mocks');
const W = require('./pack_tour-guide_phase12_world');

const NOW = '2027-05-01T12:00:00Z';
const J = (v) => JSON.parse(JSON.stringify(v));
function fresh() {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW });
  H.bootstrap(ctx, state);
  return { ctx, state };
}
/** Commands of branch skeletons that new-branch.mjs wrote and nobody has filled in yet (their header still says "Still written by
 *  hand"). The tab shows them under More until their TG_CMD_GUIDE line is written; in this repo the list is empty. */
const GAS = path.join(__dirname, '..', 'packs', 'tour-guide', 'gas');
const SKELETON = fs.readdirSync(GAS).filter((f) => f.endsWith('.js')).flatMap((f) => {
  const src = fs.readFileSync(path.join(GAS, f), 'utf8');
  return /Still written by hand/.test(src) ? [...src.matchAll(/registerCommand\('(\/[a-z0-9_]+)'/g)].map((m) => m[1]) : [];
}).sort();
const app = (ctx, state, op, args) => H.appPost(ctx, state, 'app', args === undefined ? { op } : { op, args });

test('core listCommands: every registered command, sorted, with the help line it was registered with', () => {
  const { ctx } = fresh();
  const list = J(ctx.listCommands());
  const names = list.map((c) => c.cmd);
  assert.deepEqual(names, Object.keys(ctx.HB_REGISTRY.command).sort());
  assert.deepEqual(names, [...names].sort());
  assert.equal(list.find((c) => c.cmd === '/ping').help, 'liveness check');
  assert.equal(list.find((c) => c.cmd === '/start').help, '');   // registered without a help line
});

test('every registered command has a guide entry, and every entry names a registered command', () => {
  const { ctx } = fresh();
  const live = Object.keys(ctx.HB_REGISTRY.command).sort();
  const guide = J(ctx.TG_CMD_GUIDE).map((e) => e.cmd);
  assert.deepEqual(live.filter((c) => !guide.includes(c)), SKELETON, 'registered commands missing from TG_CMD_GUIDE');
  assert.deepEqual(guide.filter((c) => !live.includes(c)), [], 'TG_CMD_GUIDE entries nobody registers');
  assert.equal(new Set(guide).size, guide.length, 'one entry per command');
});

test('guide entries are well formed: a known group, a sentence, forms that start with the command', () => {
  const { ctx } = fresh();
  const groups = J(ctx.TG_CMD_GROUPS).map((g) => g.id);
  J(ctx.TG_CMD_GUIDE).forEach((e) => {
    assert.ok(groups.includes(e.group), e.cmd + ': group ' + e.group);
    assert.ok(typeof e.does === 'string' && e.does.length >= 20 && e.does.length <= 300 && /[.!?]$/.test(e.does), e.cmd + ': does');
    assert.ok(Array.isArray(e.forms) && e.forms.length >= 1 && e.forms.length <= 5, e.cmd + ': forms');
    e.forms.forEach(([text, means]) => {
      assert.ok(text === e.cmd || text.startsWith(e.cmd + ' '), e.cmd + ': form "' + text + '"');
      assert.ok(typeof means === 'string' && means.length > 0 && means.length <= 80, e.cmd + ': means');
    });
  });
});

test('commands.list answers the groups in order with every command once, plus the tips', () => {
  const { ctx, state } = fresh();
  const r = app(ctx, state, 'commands.list');
  assert.equal(r.ok, true);
  assert.deepEqual(r.groups.map((g) => g.id), J(ctx.TG_CMD_GROUPS).map((g) => g.id).concat(SKELETON.length ? ['more'] : []));
  const shown = r.groups.flatMap((g) => g.commands.map((c) => c.cmd));
  assert.equal(r.count, shown.length);
  assert.deepEqual([...shown].sort(), Object.keys(ctx.HB_REGISTRY.command).sort());
  const plan = r.groups.find((g) => g.id === 'plan').commands.find((c) => c.cmd === '/plan');
  assert.match(plan.does, /shortlist/);
  assert.equal(plan.help, 'plan a trip: /plan <destination> (again to see where you are)');
  assert.deepEqual(J(plan.forms[0]), { text: '/plan Lisbon', means: 'start planning a trip; send it again to see where it is', run: 'form', tpl: '/plan {where}',
    parts: [{ t: '/plan ' }, { f: 'where' }] });
  assert.deepEqual(J(plan.forms[1]), { text: '/plan', means: 'where the trip being planned is', run: 'now' });
  assert.deepEqual(J(plan.fields), { where: { kind: 'text', label: 'Destination', hint: 'a city or region', max_len: 80 } });
  assert.equal(plan.runnable, true);
  const start = r.groups.find((g) => g.id === 'start').commands.find((c) => c.cmd === '/start');
  assert.equal(start.runnable, false, '/start stays chat-only');
  const lodging = r.groups.find((g) => g.id === 'plan').commands.find((c) => c.cmd === '/lodging');
  assert.deepEqual(J(lodging.forms.find((f) => f.text === '/lodging clear')), { text: '/lodging clear', means: 'drop every stay', run: 'now', confirm: true });
  assert.ok(r.tips.length >= 1 && r.tips.every((t) => t.title && t.text));
});

test('commands.list follows the registry: a command without an entry shows under More, an entry without a command is left out', () => {
  const { ctx, state } = fresh();
  ctx.registerCommand('/zzdemo', () => {}, 'a demo hint');
  delete ctx.HB_REGISTRY.command['/whatson'];
  const r = app(ctx, state, 'commands.list');
  const more = r.groups.find((g) => g.id === 'more');
  assert.deepEqual(more.commands.map((c) => c.cmd), [...SKELETON, '/zzdemo'].sort());
  assert.deepEqual(more.commands.find((c) => c.cmd === '/zzdemo'), { cmd: '/zzdemo', does: 'a demo hint', help: 'a demo hint', keywords: '', runnable: true, fields: {}, forms: [{ text: '/zzdemo', means: '', run: 'now' }] });
  assert.ok(!r.groups.flatMap((g) => g.commands).some((c) => c.cmd === '/whatson'));
});

test('commands.list takes no arguments', () => {
  const { ctx, state } = fresh();
  const r = app(ctx, state, 'commands.list', { x: 1 });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad_args');
});

/* ---------------- Phase 17a: forms, context, run, the "/" menu ---------------- */

const KINDS = ['trip', 'day', 'date', 'place', 'list', 'number', 'choice', 'time', 'text'];

test('every form says how the app runs it; every template parses, uses only described fields and is filled by its own example', () => {
  const { ctx } = fresh();
  const guide = ctx.TG_CMD_GUIDE;
  guide.forEach((e) => {
    const fields = e.fields || {}, used = new Set();
    Object.entries(fields).forEach(([n, f]) => {
      assert.ok(/^[a-z][a-z0-9_]*$/.test(n), e.cmd + ': field name ' + n);
      assert.ok(KINDS.includes(f.kind), e.cmd + ': {' + n + '} kind ' + f.kind);
      assert.ok(typeof f.label === 'string' && f.label.length >= 2 && f.label.length <= 40, e.cmd + ': {' + n + '} label');
      if (f.kind === 'choice') assert.ok((Array.isArray(f.options) && f.options.length >= 2) || f.from === 'sections', e.cmd + ': {' + n + '} choice needs options');
      if (f.kind === 'number') assert.ok(Number.isInteger(f.min) && Number.isInteger(f.max) && f.min < f.max, e.cmd + ': {' + n + '} number range');
      if (f.kind === 'text') assert.ok(Number.isInteger(f.max_len) && f.max_len <= 400, e.cmd + ': {' + n + '} text max_len');
    });
    e.forms.forEach((f) => {
      const [text, , o = {}] = f;
      const label = e.cmd + ' "' + text + '"';
      assert.ok(Object.keys(o).every((k) => ['tpl', 'fixed', 'confirm', 'opens', 'wait'].includes(k)), label + ': options');
      assert.ok(!o.wait || !!o.opens, label + ': wait without opens');
      if (text === e.cmd) { assert.ok(!o.tpl && !o.fixed, label + ': the bare command needs no options'); return; }
      assert.ok(!!o.tpl !== !!o.fixed, label + ': a form with words after the command says { tpl } or { fixed: true }');
      if (!o.tpl) return;
      const p = J(ctx.cmdTemplateParse(o.tpl));
      assert.equal(p.ok, true, label + ': template ' + o.tpl + ' — ' + p.error);
      assert.ok(o.tpl.startsWith(e.cmd + ' ') || o.tpl.startsWith(e.cmd + '['), label + ': template starts with the command');
      p.names.forEach((n) => { assert.ok(fields[n], label + ': {' + n + '} is not described'); used.add(n); });
      assert.ok(ctx.cmdTemplateMatches(ctx.cmdTemplateParse(o.tpl).parts, fields, text), label + ' does not fill ' + o.tpl);
    });
    Object.keys(fields).forEach((n) => assert.ok(used.has(n), e.cmd + ': {' + n + '} is described but no template uses it'));
  });
  // A template the app fills sends what the command reads: optional parts drop out whole.
  const late = ctx.cmdTemplateParse('/late {min}[ {day}]').parts;
  assert.equal(ctx.cmdTemplateFill(late, { min: '30' }), '/late 30');
  assert.equal(ctx.cmdTemplateFill(late, { min: '30', day: '2027-06-11' }), '/late 30 2027-06-11');
  assert.equal(ctx.cmdTemplateFill(late, { day: '2027-06-11' }), null, 'a required field missing → nothing to send');
});

test('commands.context: trips with the current one first, its dates as days with the plan\'s themes, place names, lists, sections', () => {
  const { ctx, state } = W.fresh(W.at(W.DATES[1], '13:00'));
  ctx.tgTripUpsert({ slug: 'otter-cove', title: 'Otter Cove', destination: 'Otter Cove', start: '2027-09-01', end: '2027-09-03' });
  const r = app(ctx, state, 'commands.context');
  assert.equal(r.ok, true);
  assert.deepEqual(r.trip, { slug: W.TRIP, title: 'Lark Bay', start: W.DATES[0], end: W.DATES[2] });
  assert.deepEqual(r.trips.map((t) => t.slug), [W.TRIP, 'otter-cove']);
  assert.equal(r.today, W.DATES[1]);
  assert.deepEqual(r.days.map((d) => [d.date, d.n, d.planned]), W.DATES.map((d, i) => [d, i + 1, true]));
  assert.ok(r.days.every((d) => typeof d.theme === 'string'));
  assert.ok(r.places.includes('Kite Museum') && r.places.includes('Tide Hall'), 'the plan\'s stops');
  assert.equal(new Set(r.places.map((p) => p.toLowerCase())).size, r.places.length, 'each name once');
  assert.ok(Array.isArray(r.lists));
  assert.ok(r.sections.length >= 3 && r.sections.every((s) => s.value && s.label));
  assert.deepEqual(app(ctx, state, 'commands.context', { x: 1 }).reason, 'bad_args');
});

test('commands.context without a trip: no days, no places, today in the owner\'s zone', () => {
  const { ctx, state } = fresh();
  const r = app(ctx, state, 'commands.context');
  assert.equal(r.ok, true);
  assert.equal(r.trip, null);
  assert.deepEqual([r.trips, r.days, r.places], [[], [], []]);
  assert.match(r.today, /^\d{4}-\d{2}-\d{2}$/);
});

test('commands.run: the bot posts the echo line, the answer comes under it, and a repeated nonce runs nothing', () => {
  const { ctx, state } = W.fresh(W.at(W.DATES[1], '13:00'));
  const r = app(ctx, state, 'commands.run', { text: '/replan 2027-06-11 it will rain', nonce: 'n-abcdef123' });
  assert.equal(r.ok, true);
  assert.equal(r.cmd, '/replan');
  const sent = W.sends(state);
  assert.equal(sent[0].text, '▶️ <code>/replan 2027-06-11 it will rain</code> · from the app');
  assert.equal(sent[0].disable_notification, true, 'the echo line is silent');
  const ack = sent.find((m) => /Replanning/.test(m.text));
  assert.ok(ack, 'the command answered');
  assert.equal(String(ack.reply_to_message_id), String(r.message_id), 'the answer threads under the echo line');
  assert.equal(W.reqOf(state, 'replan').length, 1);
  assert.deepEqual(W.reqOf(state, 'replan')[0].dates, [W.DATES[1]]);
  assert.equal(W.audits(ctx, 'owner_command_run').length, 1);
  const again = app(ctx, state, 'commands.run', { text: '/replan 2027-06-11 it will rain', nonce: 'n-abcdef123' });
  assert.deepEqual([again.ok, again.duplicate], [true, true]);
  assert.equal(W.reqOf(state, 'replan').length, 1, 'a double tap asks once');
});

test('commands.run refuses what is not a registered command it may run', () => {
  const { ctx, state } = fresh();
  const no = (args) => { const r = app(ctx, state, 'commands.run', args); assert.equal(r.ok, false); return r.reason; };
  assert.equal(no({ text: 'is the castle open?' }), 'not_command');
  assert.equal(no({ text: '/nosuchthing' }), 'unknown_command');
  assert.equal(no({ text: '/start' }), 'chat_only');
  assert.equal(no({ text: '' }), 'missing_arg');
  assert.equal(no({ text: '/ask ' + 'x'.repeat(600) }), 'too_long');
  assert.equal(no({ text: '/ping\u0007' }), 'bad_text');
  assert.equal(no({ text: '/ping', nonce: 'bad nonce!' }), 'bad_args');
  assert.equal(no({ text: '/ping', extra: 1 }), 'bad_args');
  assert.equal(state.fetch.telegram('sendMessage').length, 0, 'nothing was posted');
});

test('every guide form run from the app answers exactly as when typed in the chat', () => {
  const norm = (t) => String(t).replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, 'ID').replace(/\b[0-9a-f]{12,}\b/g, 'ID').replace(/req_\w+/g, 'req');
  const guide = J(fresh().ctx.TG_CMD_GUIDE);
  const forms = guide.flatMap((e) => e.forms.map((f) => f[0])).filter((t) => t !== '/start');
  assert.ok(forms.length >= 90, 'every example: ' + forms.length);
  forms.forEach((text) => {
    const a = W.fresh(W.at(W.DATES[1], '13:00')), b = W.fresh(W.at(W.DATES[1], '13:00'));
    const r = app(a.ctx, a.state, 'commands.run', { text });
    assert.equal(r.ok, true, text + ': ' + r.reason);
    W.say(b.ctx, b.state, text);
    const fromApp = W.sends(a.state), typed = W.sends(b.state);
    assert.equal(fromApp[0].text.startsWith('▶️ '), true);
    assert.deepEqual(fromApp.slice(1).map((m) => norm(m.text)), typed.map((m) => norm(m.text)), text);
    assert.equal(W.audits(a.ctx, 'command_error').length, 0, text + ' threw');
  });
});

test('the dates the app sends (YYYY-MM-DD) read exactly like a day number, M/D or "tomorrow" typed in the chat', () => {
  const norm = (t) => String(t).replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, 'ID').replace(/\b[0-9a-f]{12,}\b/g, 'ID').replace(/req_\w+/g, 'req');
  const [d2, d3] = [W.DATES[1], W.DATES[2]];
  [['/day 2', '/day ' + d2], ['/versions 2', '/versions ' + d2], ['/late 30 2', '/late 30 ' + d2], ['/checkin day 2', '/checkin ' + d2],
    ['/morning day 2', '/morning ' + d2], ['/replan 2 it will rain', '/replan ' + d2 + ' it will rain'], ['/quiet Harbour Museum on 6/11', '/quiet Harbour Museum on ' + d2],
    ['/menu Brindle Lantern on 6/11', '/menu Brindle Lantern on ' + d2], ['/daytrip on 6/11', '/daytrip on ' + d2], ['/late 30 tomorrow', '/late 30 ' + d3],
    ['/checkin tomorrow', '/checkin ' + d3], ['/morning tomorrow', '/morning ' + d3]].forEach(([typed, sent]) => {
    const a = W.fresh(W.at(d2, '13:00')), b = W.fresh(W.at(d2, '13:00'));
    W.say(a.ctx, a.state, typed); W.say(b.ctx, b.state, sent);
    assert.deepEqual(W.sends(b.state).map((m) => norm(m.text)), W.sends(a.state).map((m) => norm(m.text)), typed + ' vs ' + sent);
  });
  // /dates and /lodging read only full dates, which is what the app sends and what their examples show.
  const { ctx, state } = W.fresh(W.at(d2, '13:00'));
  W.say(ctx, state, '/dates ' + W.DATES[0] + ' ' + d3);
  assert.match(W.sends(state).slice(-1)[0].text, /Saved\. Lark Bay: Thu 10 Jun → Sat 12 Jun/);
});

test('the "/" menu: the guide\'s order, the registered hints, no /start, set for the owner\'s chat only, and only when it changed', () => {
  const { ctx, state } = fresh();
  const menu = J(ctx.botCommandMenu());
  const guide = J(ctx.TG_CMD_GUIDE).map((e) => e.cmd).filter((c) => c !== '/start');
  const names = menu.map((m) => '/' + m.command);
  assert.deepEqual(names.slice(0, guide.length), guide, 'the guide\'s commands first, in its order');
  const live = J(ctx.listCommands()).map((c) => c.cmd);
  assert.ok(names.slice(guide.length).every((c) => live.includes(c) && !guide.includes(c)), 'then any registered command the guide does not describe yet');
  assert.equal(menu.find((m) => m.command === 'plan').description, 'plan a trip: /plan <destination> (again to see where you are)');
  assert.ok(menu.every((m) => m.description.length >= 1 && m.description.length <= 256));
  assert.equal(J(ctx.syncBotCommands(false)).ok, true);
  const calls = state.fetch.telegram('setMyCommands');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].json.scope, { type: 'chat', chat_id: '777' });
  assert.equal(calls[0].json.commands.length, menu.length);
  assert.equal(J(ctx.syncBotCommands(false)).skipped, true, 'unchanged → not sent again');
  ctx.registerCommand('/zzdemo', () => {}, 'a demo hint');
  ctx.syncBotCommands(false);
  assert.equal(state.fetch.telegram('setMyCommands').length, 2, 'a new command updates the menu');
  assert.equal(state.fetch.telegram('setMyCommands')[1].json.commands.slice(-1)[0].command, 'zzdemo');
});
// Developed by: LightAISolutions

test('every guide command has search keywords, and commands.list carries them for the app\'s search box', () => {
  const { ctx, state } = fresh();
  const kw = J(ctx.TG_CMD_KEYWORDS);
  const guide = J(ctx.TG_CMD_GUIDE).map((e) => e.cmd);
  assert.deepEqual(guide.filter((c) => !kw[c]), [], 'guide commands without keywords');
  assert.deepEqual(Object.keys(kw).filter((c) => !guide.includes(c)), [], 'keywords for a command with no guide entry');
  Object.entries(kw).forEach(([c, k]) => assert.ok(/^[a-z0-9' -]{3,200}$/.test(k), c + ': lower-case words, at most 200 characters'));
  const listed = app(ctx, state, 'commands.list').groups.flatMap((g) => g.commands);
  listed.forEach((c) => assert.equal(typeof c.keywords, 'string', c.cmd));
  assert.match(listed.find((c) => c.cmd === '/late').keywords, /running late/, 'the plain words a traveller would type');
});

test('every form that opens an app screen names a known screen, and waits only where the run op can read what was there before', () => {
  const { ctx, state } = fresh();
  const screens = J(ctx.TG_CMD_OPENS_SCREENS), based = Object.keys(ctx.TG_CMD_OPENS_BASE);
  const forms = app(ctx, state, 'commands.list').groups.flatMap((g) => g.commands).flatMap((c) => (c.forms || []).map((f) => ({ cmd: c.cmd, f })));
  const opening = forms.filter((x) => x.f.opens);
  assert.ok(opening.length >= 15, 'the answer screens are wired');
  opening.forEach(({ cmd, f }) => {
    assert.ok(screens.includes(f.opens), cmd + ' opens ' + f.opens);
    if (f.wait) assert.ok(based.includes(f.opens), cmd + ' waits on ' + f.opens + ' with no baseline');
  });
  forms.filter((x) => !x.f.opens).forEach(({ cmd, f }) => assert.equal(f.wait, undefined, cmd + ': wait without opens'));
  const of = (cmd) => forms.filter((x) => x.cmd === cmd).map((x) => x.f.opens || null);
  assert.ok(of('/scout').every((o) => o === 'scout'));
  assert.ok(of('/today').every((o) => o === 'today'));
  assert.ok(of('/whatson').includes(null), '/whatson auto on|off is a switch, not an answer');
});

test('commands.run says which screen the answer opens in and what was already there, so the app opens the new one', () => {
  const { ctx, state } = W.fresh(W.at(W.DATES[1], '13:00'));
  const p = J(JSON.parse(fs.readFileSync(path.join(H.HELPERS_ROOT, 'packs', 'tour-guide', 'quiet', 'fixtures', 'quiet-sample.json'), 'utf8')).valid[0]);
  p.id = 'qt-20270611-tide-hall'; p.trip = W.TRIP; p.created_on = W.DATES[1]; p.date = W.DATES[1];
  p.magnet = { ...p.magnet, name: 'Tide Hall', slug: 'tide-hall', place_id: 'FixtureLbTide01' };
  delete p.magnet.source;
  assert.equal(W.deliver(ctx, state, 'quiet', p).processed, 1);
  const q = app(ctx, state, 'commands.run', { text: '/quiet Kite Museum' });
  assert.equal(q.ok, true);
  assert.deepEqual(J(q.opens), { screen: 'quiet', wait: true, base: ['qt-20270611-tide-hall'] });
  const s = app(ctx, state, 'commands.run', { text: '/scout ramen in Lark Bay' });
  assert.deepEqual(J(s.opens), { screen: 'scout', wait: true, base: [] });
  assert.deepEqual(J(app(ctx, state, 'commands.run', { text: '/today' }).opens), { screen: 'today' });
  assert.equal(app(ctx, state, 'commands.run', { text: '/whatson auto off' }).opens, undefined, 'a switch opens nothing');
  assert.equal(app(ctx, state, 'commands.run', { text: '/ping' }).opens, undefined);
  const v = app(ctx, state, 'commands.run', { text: '/vegcard rebuild' });
  assert.deepEqual([v.opens.screen, v.opens.wait, v.opens.trip], ['vegcard', true, W.TRIP], 'the veg card is the current trip\'s');
});
