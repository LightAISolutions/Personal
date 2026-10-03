'use strict';
// The note guard's shared table (Phase 10 fix (a)): planner/planner-notes.mjs and the GAS day card's port must agree on it.
const NOON = { arrive: '12:00', depart: '13:00', window: { open: '09:00', close: '17:00' } };
const EARLY = { arrive: '09:10', depart: '10:10', window: { open: '09:00', close: '17:00' } };
const AFTERNOON = { arrive: '15:00', depart: '16:30', window: null };

/** [sentence, schedule, the conflict expected (null = keep)] — shared with the GAS port's test. */
const TABLE = [
  ['Arrive at opening to beat the crowds.', NOON, 'opening'],
  ['Arrive at opening to beat the crowds.', EARLY, null],
  ['Go first thing, before the tour buses.', NOON, 'opening'],
  ['Get there when the gates open.', { arrive: '10:20', depart: '11:00', window: { open: '10:00', close: '18:00' } }, null],
  ['Early-morning light on the façade is the best.', NOON, 'early'],
  ['Go early; queues build by mid-morning.', EARLY, null],
  ['Mornings are quietest.', AFTERNOON, 'morning'],
  ['Best at sunset.', NOON, 'evening'],
  ['Best at sunset.', AFTERNOON, null],
  ['The lanterns are lit up after dark.', EARLY, 'evening'],
  ['Late afternoon light suits the garden.', NOON, 'afternoon'],
  ['Come before 10 for calm.', NOON, 'before'],
  ['Come before 10 for calm.', EARLY, null],
  ['Visit after 3pm when the school groups leave.', NOON, 'after'],
  ['Visit after 3pm when the school groups leave.', AFTERNOON, null],
  ['Quiet before 5.', AFTERNOON, null],
  ['It opens at 9:00 and closes before 17:00.', AFTERNOON, null],
  ['Last entry is before 16:30.', { arrive: '16:40', depart: '17:00', window: null }, null],
  ['Buy tickets online.', NOON, null]
];

module.exports = { TABLE, NOON, EARLY, AFTERNOON };

// Developed by: LightAISolutions
