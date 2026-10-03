'use strict';
// packs/tour-guide — the outline and day_versions payloads (TG-PHASE-11 WP-11f): every bound of the two schemas and their
// checks, run through the Node validator (schemas/index.mjs) and the core's mirror (gas/17_journey.js) — both must agree.
// Trips and places are invented.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');
const S = () => import('../packs/tour-guide/schemas/index.mjs');
const clone = (x) => JSON.parse(JSON.stringify(x));

const D = ['2031-05-12', '2031-05-13', '2031-05-14'];
const day = (date, kind = 'full') => ({ date, area: 'Old harbour', kind, anchors: [{ slug: 'lantern-museum', name: 'Lantern Museum' }] });
const opt = (key) => ({ key, title: 'Harbour first', gains: 'A calm last day.', gives_up: 'No day trip.', days: D.map((d, i) => day(d, ['full', 'light', 'free'][i])) });
const outline = () => ({ v: 1, kind: 'outline', trip: 'port-sorrel', build_id: 'b1', options: [opt('A'), opt('B')], notes: 'Both keep day 2 light.' });
const ver = (key) => ({ key, title: 'Museums', summary: 'Indoor day', stops: [{ slug: 'a-b', name: 'A B', time: '10:00' }], walk_minutes: 30,
  transit_minutes: 20, spare_minutes: 60, bookings: ['Tower 10:00'], leaves_out: [{ slug: 'c-d', name: 'C D' }], warnings: ['Busy at noon.'] });
const versions = () => ({ v: 1, kind: 'day_versions', trip: 'port-sorrel', build_id: 'b1', date: D[0], versions: [ver('A'), ver('B')], chosen: 'B' });
const s = (n) => 'x'.repeat(n);

/** [name, payload maker, mutate, valid?] — each bound once at its edge and once past it. */
const OUTLINE = [
  ['as given', outline, () => {}, true],
  ['no v and kind (optional)', outline, (p) => { delete p.v; delete p.kind; }, true],
  ['three options', outline, (p) => { p.options.push(opt('C')); }, true],
  ['one option (a trip with one shape)', outline, (p) => { p.options.pop(); }, true],
  ['no options', outline, (p) => { p.options = []; }, false],
  ['four options', outline, (p) => { p.options.push(opt('C'), opt('C')); }, false],
  ['key D', outline, (p) => { p.options[1].key = 'D'; }, false],
  ['duplicate keys', outline, (p) => { p.options[1].key = 'A'; }, false],
  ['title 80', outline, (p) => { p.options[0].title = s(80); }, true],
  ['title 81', outline, (p) => { p.options[0].title = s(81); }, false],
  ['empty title', outline, (p) => { p.options[0].title = ''; }, false],
  ['gains 200', outline, (p) => { p.options[0].gains = s(200); }, true],
  ['gives_up 201', outline, (p) => { p.options[0].gives_up = s(201); }, false],
  ['area 60', outline, (p) => { p.options[0].days[0].area = s(60); }, true],
  ['area 61', outline, (p) => { p.options[0].days[0].area = s(61); }, false],
  ['empty area', outline, (p) => { p.options[0].days[0].area = ''; }, true],
  ['each kind', outline, (p) => { ['travel', 'rain_spare', 'free'].forEach((k, i) => { p.options[1].days[i].kind = k; }); }, true],
  ['unknown kind', outline, (p) => { p.options[0].days[0].kind = 'party'; }, false],
  ['three anchors', outline, (p) => { p.options[0].days[0].anchors = [1, 2, 3].map((i) => ({ slug: 'p-' + i, name: 'P' })); }, true],
  ['four anchors', outline, (p) => { p.options[0].days[0].anchors = [1, 2, 3, 4].map((i) => ({ slug: 'p-' + i, name: 'P' })); }, false],
  ['anchor name 120', outline, (p) => { p.options[0].days[0].anchors[0].name = s(120); }, true],
  ['anchor name 121', outline, (p) => { p.options[0].days[0].anchors[0].name = s(121); }, false],
  ['bad anchor slug', outline, (p) => { p.options[0].days[0].anchors[0].slug = 'Bad Slug'; }, false],
  ['note 120', outline, (p) => { p.options[0].days[0].note = s(120); }, true],
  ['note 121', outline, (p) => { p.options[0].days[0].note = s(121); }, false],
  ['notes 300', outline, (p) => { p.notes = s(300); }, true],
  ['notes 301', outline, (p) => { p.notes = s(301); }, false],
  ['a date skipped', outline, (p) => { p.options.forEach((o) => { o.days[2].date = '2031-05-15'; }); }, false],
  ['dates out of order', outline, (p) => { p.options.forEach((o) => { o.days.reverse(); }); }, false],
  ['option with fewer days', outline, (p) => { p.options[1].days.pop(); }, false],
  ['not a calendar date', outline, (p) => { p.options.forEach((o) => { o.days[0].date = '2031-02-30'; }); }, false],
  ['unknown top key', outline, (p) => { p.extra = 1; }, false],
  ['unknown option key', outline, (p) => { p.options[0].extra = 1; }, false],
  ['unknown day key', outline, (p) => { p.options[0].days[0].extra = 1; }, false],
  ['build_id 120', outline, (p) => { p.build_id = s(120); }, true],
  ['build_id 121', outline, (p) => { p.build_id = s(121); }, false],
  ['kind mismatch', outline, (p) => { p.kind = 'day_versions'; }, false]
];
const VERSIONS = [
  ['as given', versions, () => {}, true],
  ['no chosen', versions, (p) => { delete p.chosen; }, true],
  ['three versions', versions, (p) => { p.versions.push(ver('C')); }, true],
  ['one version (a day with one way to go)', versions, (p) => { p.versions.pop(); delete p.chosen; }, true],
  ['no versions', versions, (p) => { p.versions = []; delete p.chosen; }, false],
  ['four versions', versions, (p) => { p.versions.push(ver('C'), ver('C')); }, false],
  ['chosen not a version', versions, (p) => { p.chosen = 'C'; }, false],
  ['title 80', versions, (p) => { p.versions[0].title = s(80); }, true],
  ['title 81', versions, (p) => { p.versions[0].title = s(81); }, false],
  ['summary 160', versions, (p) => { p.versions[0].summary = s(160); }, true],
  ['summary 161', versions, (p) => { p.versions[0].summary = s(161); }, false],
  ['12 stops', versions, (p) => { p.versions[0].stops = Array.from({ length: 12 }, (_, i) => ({ slug: 's-' + i, name: 'S' })); }, true],
  ['13 stops', versions, (p) => { p.versions[0].stops = Array.from({ length: 13 }, (_, i) => ({ slug: 's-' + i, name: 'S' })); }, false],
  ['no stops (a free day)', versions, (p) => { p.versions[0].stops = []; }, true],
  ['stop time 25:00', versions, (p) => { p.versions[0].stops[0].time = '25:00'; }, false],
  ['minutes 1440', versions, (p) => { p.versions[0].walk_minutes = 1440; }, true],
  ['minutes 1441', versions, (p) => { p.versions[0].transit_minutes = 1441; }, false],
  ['negative spare', versions, (p) => { p.versions[0].spare_minutes = -1; }, false],
  ['fractional minutes', versions, (p) => { p.versions[0].walk_minutes = 1.5; }, false],
  ['5 bookings', versions, (p) => { p.versions[0].bookings = [1, 2, 3, 4, 5].map((i) => 'B' + i); }, true],
  ['6 bookings', versions, (p) => { p.versions[0].bookings = [1, 2, 3, 4, 5, 6].map((i) => 'B' + i); }, false],
  ['booking 121', versions, (p) => { p.versions[0].bookings = [s(121)]; }, false],
  ['10 left out', versions, (p) => { p.versions[0].leaves_out = Array.from({ length: 10 }, (_, i) => ({ slug: 'l-' + i, name: 'L' })); }, true],
  ['11 left out', versions, (p) => { p.versions[0].leaves_out = Array.from({ length: 11 }, (_, i) => ({ slug: 'l-' + i, name: 'L' })); }, false],
  ['5 warnings', versions, (p) => { p.versions[0].warnings = [1, 2, 3, 4, 5].map((i) => 'W' + i); }, true],
  ['warning 161', versions, (p) => { p.versions[0].warnings = [s(161)]; }, false],
  ['missing walk_minutes', versions, (p) => { delete p.versions[0].walk_minutes; }, false],
  ['unknown version key', versions, (p) => { p.versions[0].extra = 1; }, false],
  ['unknown stop key', versions, (p) => { p.versions[0].stops[0].extra = 1; }, false],
  ['duplicate stop slug', versions, (p) => { p.versions[0].stops.push({ slug: 'a-b', name: 'Again' }); }, false],
  ['not a calendar date', versions, (p) => { p.date = '2031-13-01'; }, false]
];

for (const [label, kind, cases] of [['outline', 'outline', OUTLINE], ['day_versions', 'day_versions', VERSIONS]]) {
  test(label + ': every bound accepted at its edge and refused past it, the Node validator and the core mirror agreeing', async () => {
    const { validatePayload } = await S();
    const { ctx } = H.loadGas({ pack: 'tour-guide', now: '2031-05-01T12:00:00Z' });
    const gas = kind === 'outline' ? ctx.tgEnvValidateOutline : ctx.tgEnvValidateDayVersions;
    for (const [name, make, mutate, valid] of cases) {
      const p = make();
      mutate(p);
      const node = validatePayload(kind, clone(p));
      const core = JSON.parse(JSON.stringify(gas(clone(p))));
      assert.equal(node.ok, valid, label + ' / ' + name + ' (node): ' + JSON.stringify(node.errors));
      assert.equal(core.length === 0, valid, label + ' / ' + name + ' (core): ' + core.join(' | '));
    }
  });
}

// Developed by: LightAISolutions
