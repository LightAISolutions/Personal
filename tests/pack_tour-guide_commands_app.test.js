'use strict';
// Tour Guide pack — gas/45_commands_app.js: the app's Commands tab (commands.list) and the core's listCommands(). The tab's
// list is the registry: every command the bot answers is shown and described, and nothing it does not answer is offered.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness/gas-mocks');

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
  assert.deepEqual(plan.forms[0], { text: '/plan Lisbon', means: 'start planning a trip; send it again to see where it is' });
  assert.ok(r.tips.length >= 1 && r.tips.every((t) => t.title && t.text));
});

test('commands.list follows the registry: a command without an entry shows under More, an entry without a command is left out', () => {
  const { ctx, state } = fresh();
  ctx.registerCommand('/zzdemo', () => {}, 'a demo hint');
  delete ctx.HB_REGISTRY.command['/whatson'];
  const r = app(ctx, state, 'commands.list');
  const more = r.groups.find((g) => g.id === 'more');
  assert.deepEqual(more.commands.map((c) => c.cmd), [...SKELETON, '/zzdemo'].sort());
  assert.deepEqual(more.commands.find((c) => c.cmd === '/zzdemo'), { cmd: '/zzdemo', does: 'a demo hint', help: 'a demo hint', forms: [{ text: '/zzdemo', means: '' }] });
  assert.ok(!r.groups.flatMap((g) => g.commands).some((c) => c.cmd === '/whatson'));
});

test('commands.list takes no arguments', () => {
  const { ctx, state } = fresh();
  const r = app(ctx, state, 'commands.list', { x: 1 });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad_args');
});
