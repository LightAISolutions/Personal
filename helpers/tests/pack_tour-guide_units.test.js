'use strict';
// Tour Guide pack — gas/47_units.js: /units, the brochure clock and temperatures (Phase 18, item 13). The command shows and
// sets them, refuses anything else without changing a thing; settings.get and the state snapshot carry them, defaults applied.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const NOW = '2027-05-01T12:00:00Z';
const J = (v) => JSON.parse(JSON.stringify(v));
function fresh() {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW });
  H.bootstrap(ctx, state);
  return { ctx, state };
}
const say = (ctx, state, text) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, H.tgUpdate({ text })));
const last = (state) => state.fetch.telegram('sendMessage').map((r) => r.json.text).pop();
const app = (ctx, state, op, args) => H.appPost(ctx, state, 'app', args === undefined ? { op } : { op, args });
const stored = (ctx) => [ctx.settingGet(ctx.TG_UNITS.SET_CLOCK, ''), ctx.settingGet(ctx.TG_UNITS.SET_TEMP, '')];

test('/units shows the defaults when nothing is set: 24-hour clock and both temperatures', () => {
  const { ctx, state } = fresh();
  assert.deepEqual(J(ctx.tgUnits()), { clock: '24h', temp: 'both' });
  say(ctx, state, '/units');
  assert.equal(last(state), 'Brochures: 24-hour clock, °C and °F.');
  assert.deepEqual(stored(ctx), ['', ''], 'showing writes nothing');
});

test('/units sets the clock and the temperatures, each on its own, and answers with the new line', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/units 12h');
  assert.equal(last(state), 'Brochures: 12-hour clock, °C and °F.');
  say(ctx, state, '/units c');
  assert.equal(last(state), 'Brochures: 12-hour clock, °C.');
  say(ctx, state, '/units F');
  assert.equal(last(state), 'Brochures: 12-hour clock, °F.');
  say(ctx, state, '/units 24h');
  assert.equal(last(state), 'Brochures: 24-hour clock, °F.');
  assert.deepEqual(stored(ctx), ['24h', 'f']);
  say(ctx, state, '/units 12h °c');
  assert.equal(last(state), 'Brochures: 12-hour clock, °C.', 'both in one message');
  say(ctx, state, '/units both');
  assert.deepEqual(J(ctx.tgUnits()), { clock: '12h', temp: 'both' });
  say(ctx, state, '/units');
  assert.equal(last(state), 'Brochures: 12-hour clock, °C and °F.');
});

test('/units refuses anything else and changes nothing', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/units 12h f');
  ['/units kelvin', '/units 12h 24h', '/units c f', '/units 12h f both', '/units 13h', '/units celsius'].forEach((t) => {
    say(ctx, state, t);
    assert.match(last(state), /^Usage: \/units 24h\|12h · \/units c\|f\|both/, t);
    assert.deepEqual(J(ctx.tgUnits()), { clock: '12h', temp: 'f' }, t + ' changed nothing');
  });
});

test('an unknown stored value reads as the default', () => {
  const { ctx } = fresh();
  ctx.settingSet(ctx.TG_UNITS.SET_CLOCK, 'sundial', 'test');
  ctx.settingSet(ctx.TG_UNITS.SET_TEMP, 'K', 'test');
  assert.deepEqual(J(ctx.tgUnits()), { clock: '24h', temp: 'both' });
});

test('settings.get carries display, defaults first, then what the app set by running /units', () => {
  const { ctx, state } = fresh();
  assert.deepEqual(app(ctx, state, 'settings.get').display, { clock: '24h', temp: 'both' });
  let n = 0;
  ['/units 12h', '/units c'].forEach((text) => assert.equal(app(ctx, state, 'commands.run', { text, nonce: 'n-units-' + (++n) }).ok, true, text));
  assert.deepEqual(app(ctx, state, 'settings.get').display, { clock: '12h', temp: 'c' });
  assert.equal(last(state), 'Brochures: 12-hour clock, °C.', 'the chat gets the same answer');
});

test('state.json carries tour_guide.display, always, with the defaults applied', () => {
  const { ctx, state } = fresh();
  assert.deepEqual(J(ctx.buildSnapshot()).tour_guide.display, { clock: '24h', temp: 'both' });
  say(ctx, state, '/units f');
  assert.deepEqual(J(ctx.buildSnapshot()).tour_guide.display, { clock: '24h', temp: 'f' });
});

test('the Commands tab describes /units with a choice form whose examples fill it; the "/" menu lists it', () => {
  const { ctx, state } = fresh();
  const e = J(ctx.TG_CMD_GUIDE).find((g) => g.cmd === '/units');
  assert.equal(e.group, 'chat');
  assert.deepEqual(e.fields.unit.options, ['24h', '12h', 'c', 'f', 'both']);
  assert.ok(ctx.TG_CMD_KEYWORDS['/units'].includes('fahrenheit'));
  const r = app(ctx, state, 'commands.list');
  const c = r.groups.find((g) => g.id === 'chat').commands.find((x) => x.cmd === '/units');
  assert.equal(c.runnable, true);
  const form = c.forms.find((f) => f.run === 'form');
  assert.equal(form.tpl, '/units {unit}');
  const parts = ctx.cmdTemplateParse(form.tpl).parts;
  ['24h', '12h', 'c', 'f', 'both'].forEach((v) => {
    const text = ctx.cmdTemplateFill(parts, { unit: v });
    assert.equal(text, '/units ' + v);
    assert.ok(ctx.cmdTemplateMatches(parts, e.fields, text), text);
  });
  assert.equal(ctx.cmdTemplateMatches(parts, e.fields, '/units kelvin'), false, 'the choice holds only the five values');
  const menu = J(ctx.getRenderer('command_menu')(ctx.listCommands()));
  const i = menu.findIndex((m) => m.cmd === '/units');
  assert.ok(i > menu.findIndex((m) => m.cmd === '/smart'), 'after /smart, in guide order');
  assert.match(menu[i].description, /clock and temperatures/);
});

// Developed by: LightAISolutions
