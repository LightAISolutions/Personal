'use strict';
// Tour Guide Phase 10 fix (a) — the note guard: a stop's note never contradicts its scheduled time. One table
// (pack_tour-guide_note_table.js) runs through the module (planner/planner-notes.mjs) and the GAS day card's port
// (pack_tour-guide_gas_commands.test.js); the brochure test is below. Invented places and notes only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const notes = () => import('../packs/tour-guide/planner/planner-notes.mjs');

const { TABLE, NOON, EARLY, AFTERNOON } = require('./pack_tour-guide_note_table.js');

test('(a) noteConflict: each kind of timing advice against the schedule that breaks it, and one that keeps it', async () => {
  const n = await notes();
  for (const [text, sched, want] of TABLE) assert.equal(n.noteConflict(text, sched), want, `${text} @ ${sched.arrive}`);
  assert.equal(n.noteConflict('Arrive at opening.', { arrive: null }), null, 'no schedule, nothing to contradict');
});

test('(a) clockOf: bare hours below 8 read as pm; am/pm, minutes and noon', async () => {
  const { clockOf } = await notes();
  assert.deepEqual(['5', '10', '10:30', '9am', '12pm', '12am', '3 p.m.', 'noon', '7', '25', 'x'].map(clockOf), [1020, 600, 630, 540, 720, 0, 900, 720, 1140, null, null]);
});

test('(a) guardNote drops only the contradicted sentences and keeps the rest as written', async () => {
  const { guardNote, guardNoteFields } = await notes();
  const text = 'Arrive at opening to beat the crowds. Buy tickets online; the queue is slow.';
  assert.equal(guardNote(text, EARLY), text, 'before the fix and after: an early stop keeps its note unchanged');
  assert.equal(guardNote(text, NOON), 'Buy tickets online; the queue is slow.', 'a noon stop loses the opening advice');
  assert.equal(guardNote('Best at sunset.', NOON), '');
  assert.equal(guardNote(undefined, NOON), undefined);
  const out = guardNoteFields({ best_time: 'Best at sunset.', tickets: 'Cash only.', pairings: ['x'] }, [AFTERNOON, NOON], ['best_time', 'tickets']);
  assert.deepEqual(out, { tickets: 'Cash only.', pairings: ['x'] }, 'a sentence any visit contradicts goes; an emptied field is removed');
});

test('(a) the brochure shows a stop note without the timing advice its scheduled time contradicts', async () => {
  const bm = await import('../packs/tour-guide/brochure-map/index.mjs');
  const { sampleInput } = await import('../packs/tour-guide/brochure-map/brochure-map-sample.mjs');
  const input = sampleInput();
  // The copper market is scheduled 12:30–13:45 on day 1; its invented note was written before the plan.
  input.notes.push({ v: 1, place_id: 'FixtureCopperMarket01', best_time: 'Arrive at opening, when the fish comes in. The noodle stall is at the back.', what_to_do: 'Best at sunset from the roof.', sources: [], last_researched: '2027-04-20' });
  const card = bm.toBrochureModel(input).places['copper-market'];
  assert.equal(card.note.best_time, 'The noodle stall is at the back.');
  assert.equal(card.note.what_to_do, undefined, 'a field left empty is dropped');
  assert.equal(bm.toBrochureModel(input).places['lark-hill'].note.best_time, 'Sunrise; the path faces east.', 'a 09:30 hill walk keeps its sunrise note');
  assert.equal(bm.toBrochureModel(input).places['fennel-park'].note, undefined, 'a Later place has no visit to guard against');
});

// Developed by: LightAISolutions
