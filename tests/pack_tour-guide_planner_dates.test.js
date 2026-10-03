'use strict';
// packs/tour-guide/planner — dates in words (WP-12d): a Later reason and the brochure's "Taken off the plan for …" note
// name their day as the Telegram day card does ("Wed 12 May", tgCmdDate in gas/10_commands.js), never as YYYY-MM-DD.
// The planner's dayDate() is proven equal to tgCmdDate (run in the GAS harness) on every day of two years.
// Invented data only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const planner = () => import('../packs/tour-guide/planner/index.mjs');
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

test('dayDate writes a date exactly as the day card does (tgCmdDate), every day of 2027 and the leap year 2028', async () => {
  const { dayDate } = await planner();
  const { ctx } = H.loadGas({ pack: 'tour-guide', now: '2027-05-01T08:00:00Z' });
  let n = 0;
  for (let t = Date.UTC(2027, 0, 1); t <= Date.UTC(2028, 11, 31); t += 86400000, n++) {
    const d = iso(t);
    assert.equal(dayDate(d), ctx.tgCmdDate(d), d);
    assert.ok(dayDate(d).length <= d.length, `${d}: never longer than the date it replaces`);
  }
  assert.equal(n, 731);
  assert.equal(dayDate('2027-05-12'), 'Wed 12 May');
  assert.equal(dayDate('2028-02-29'), 'Tue 29 Feb');
  assert.equal(dayDate('2027-09-03'), 'Fri 3 Sep', 'fixed English month names (no "Sept")');
});

test('dayDate leaves anything that is not a real date as it is', async () => {
  const { dayDate } = await planner();
  for (const x of ['2027-02-30', '2027-5-12', 'tomorrow', '', null, undefined]) assert.equal(dayDate(x), x);
});

test('the planner\'s dated Later reasons name the day in words and stay within 300 characters', async () => {
  const { assign } = await planner();
  const { createRng } = await import('../packs/tour-guide/planner/planner-rng.mjs');
  const town = { id: 'inn-town', lat: 10, lng: 20 }, city = { id: 'inn-city', lat: 10.3, lng: 20.2 };   // about 40 km apart
  const day = (date, inn) => ({ date, mode: 'WALK', dayStart: 600, dayEnd: 1080, pace: { breakfast: 0 }, lodging_start: inn, lodging_end: inn });
  const open = { status: 'open', windows: [{ open: 540, close: 1020 }] }, shut = { status: 'closed', windows: [] };
  const near = { lat: 10.002, lng: 20.002 }, long = 'Long Name '.repeat(40).trim();
  const cand = (id, name) => ({ id, name, loc: near, minutes: 60, priority: 2, hours: { '2027-10-18': shut, '2027-10-19': open } });
  const { later } = assign({ days: [day('2027-10-18', town), day('2027-10-19', city)], rng: createRng(3), cands: [cand('kiln', 'Kiln Yard'), cand('loom', long)] });
  const why = Object.fromEntries(later.map((x) => [x.cand.id, x.reason]));
  assert.equal(why.kiln, 'Kiln Yard is closed on Mon 18 Oct, the day you are near it');
  assert.equal(why.loom.length, 300, 'a long name is still clipped at 300');
  for (const r of Object.values(why)) assert.doesNotMatch(r, /\d{4}-\d{2}-\d{2}/);
  // the restart prefix keeps the words and the bound
  const { restartReason } = await import('../packs/tour-guide/planner/planner-restart.mjs');
  const r = restartReason({ T: 700 }, 'no room left on Mon 18 Oct for Loom Hall');
  assert.equal(r, 're-planned at 11:40: no room left on Mon 18 Oct for Loom Hall');
  assert.ok(restartReason({ T: 700 }, why.loom).length <= 300);
});

test('the brochure note names the day in words; a stored reason is shown as stored; bounds hold', async () => {
  const { mapLater } = await import('../packs/tour-guide/brochure-map/brochure-map-later.mjs');
  const lists = [{ name: "Didn't fit", items: [
    { place: 'kiln', reason: 'no room left on 2027-10-18 for Kiln Yard', code: 'day_full', from_date: '2027-10-18' },
    { place: 'loom', reason: 'x'.repeat(400), code: 'day_full', from_date: '2027-10-19' },
    { place: 'quay', code: 'too_far' }] }];
  const [l] = mapLater(lists, { cards: { kiln: {}, loom: {}, quay: {} } });
  assert.equal(l.items[0].note, 'Taken off the plan for Mon 18 Oct.');
  assert.equal(l.items[0].reason, 'no room left on 2027-10-18 for Kiln Yard', 'an older plan\'s reason is not rewritten here');
  assert.equal(l.items[1].note, 'Taken off the plan for Tue 19 Oct.');
  assert.equal(l.items[1].reason.length, 300);
  assert.equal(l.items[2].note, undefined);
});

// Developed by: LightAISolutions
