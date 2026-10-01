'use strict';
// Tour Guide pack — gas/11_flow_interview.js: the bank-driven interview flow. Answers here are invented.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness/gas-mocks');

const BANK = JSON.parse(fs.readFileSync(path.join(H.HELPERS_ROOT, 'kits', 'prefs', 'presets', 'travel.interview.json'), 'utf8'));
const TOTAL = BANK.sections.reduce((n, s) => n + s.questions.length, 0);
const J = (v) => JSON.parse(JSON.stringify(v));

function fresh() {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide' });
  H.bootstrap(ctx, state);
  H.configureRoutine(ctx, state, 'PREFS');
  return { ctx, state, k: state.props[ctx.PROP.WEBHOOK_SECRET] };
}
const tg = (ctx, k, upd) => ctx.doPost(H.postEvent('tg', { k }, upd));
const sent = (state) => state.fetch.telegram('sendMessage').map((r) => r.json.text);
const lastMsg = (state) => { const c = state.fetch.telegram('sendMessage'); return c[c.length - 1].json; };
const lastKb = (state) => state.fetch.telegram('sendMessage').map((r) => r.json).filter((j) => j.reply_markup).pop();
const kbData = (state) => { const m = lastMsg(state).reply_markup; return m ? m.inline_keyboard.flat().map((b) => b.callback_data) : []; };
const kbText = (state) => { const m = lastMsg(state).reply_markup; return m ? m.inline_keyboard.flat().map((b) => b.text) : []; };
const requests = (state) => (state.drive.listFiles('TourGuide/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile('TourGuide/mailbox/to-brain', n)));
/** Press the button whose label (or value suffix) matches on the last keyboard. */
function press(ctx, k, state, match) {
  const m = lastKb(state).reply_markup.inline_keyboard.flat();
  const b = m.find((x) => (typeof match === 'string' ? x.text === match || x.text.endsWith(match) : match.test(x.text)));
  assert.ok(b, 'button ' + match + ' among ' + m.map((x) => x.text).join(' | '));
  tg(ctx, k, H.tgUpdate({ callback: b.callback_data }));
}

test('the bank constant is the prefs kit preset; sections and qids drive the flow', () => {
  const { ctx } = fresh();
  assert.deepEqual(J(ctx.TG_INTERVIEW_BANK), BANK);
  assert.equal(ctx.tgIvQids('').length, TOTAL);
  assert.deepEqual(J(ctx.tgIvQids('pace')), ['pace-01', 'pace-02', 'pace-03']);
  assert.equal(ctx.tgIvMatchSection('Food').id, 'food');
  assert.equal(ctx.tgIvMatchSection('hidden').id, 'hidden-gems');
  assert.equal(ctx.tgIvMatchSection('nothing-here'), null);
  assert.deepEqual(J(ctx.tgIvTextValues(' tide pools,\n night  markets ; ; ' + 'x'.repeat(80))), ['tide pools', 'night markets', 'x'.repeat(60)]);
  assert.equal(ctx.tgIvTextValues('a,b,c,d,e,f,g').length, 5);
});

test('full interview: pick, scale, multi toggle + Done, text, Skip, progress line → one prefs request with the kit shape', () => {
  const { ctx, state, k } = fresh();
  tg(ctx, k, H.tgUpdate({ text: '/interview' }));
  assert.match(sent(state).pop(), new RegExp('^<i>1 of ' + TOTAL + ' · Pace &amp; rhythm</i>\\n<b>How full should'));
  assert.deepEqual(kbText(state), ['Relaxed', 'Normal', 'Packed', '⏭ Skip']);
  assert.equal(lastMsg(state).reply_markup.inline_keyboard[0].length, 3, 'a scale is one ordered row');
  assert.ok(kbData(state).every((d) => /^fl:\d+:(o\d+|skip|done)$/.test(d) && Buffer.byteLength(d) <= 64));
  assert.equal(ctx.flowActive('777').flow, 'interview');

  // Typing during a button question is nudged by the core.
  tg(ctx, k, H.tgUpdate({ text: 'packed please' }));
  assert.match(sent(state).pop(), /use the buttons/);

  press(ctx, k, state, 'Packed');                                 // pace-01 (scale)
  assert.match(sent(state).pop(), new RegExp('^<i>2 of ' + TOTAL + ' · '));
  press(ctx, k, state, 'Early riser');                            // pace-02 (pick)
  press(ctx, k, state, '⏭ Skip');                                  // pace-03 skipped → nothing written
  assert.match(sent(state).pop(), /4 of \d+ · Food/);
  press(ctx, k, state, 'Bakeries');                               // food-01 (multi): toggle on
  assert.match(sent(state).pop(), /Picked: Bakeries/);
  assert.ok(kbText(state).includes('✓ Bakeries'));
  press(ctx, k, state, 'Seafood');
  press(ctx, k, state, '✓ Bakeries');                             // toggle off
  press(ctx, k, state, 'Local specialties');
  assert.match(sent(state).pop(), /Picked: Seafood, Local specialties/);
  press(ctx, k, state, '✅ Done');                                 // food-01 → two answers in option order
  press(ctx, k, state, 'Shellfish');                              // food-02: a "-" option
  press(ctx, k, state, '✅ Done');
  press(ctx, k, state, '✅ Done');                                 // food-03 with nothing picked → nothing written
  // Skip until the first text question (activities-04).
  let guard = 0;
  while (!/activities-04|Any other thing/.test(sent(state).slice(-1)[0]) && guard++ < 10) press(ctx, k, state, '⏭ Skip');
  assert.match(sent(state).pop(), /Type your answer/);
  tg(ctx, k, H.tgUpdate({ text: 'tide pools, <b>old</b> lighthouses' }));
  // Skip everything else.
  guard = 0;
  while (ctx.flowActive('777') && guard++ < TOTAL + 5) press(ctx, k, state, '⏭ Skip');
  assert.equal(ctx.flowActive('777'), null);
  assert.match(sent(state).pop(), /^✅ Thanks — 7 answers noted\. Building your profile…$/);

  const reqs = requests(state);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].payload.kind, 'prefs');
  assert.deepEqual(reqs[0].payload.interview, { version: 1, answers: [
    { qid: 'pace-01', dimension: 'pace', value: 'packed', polarity: '+', kind: 'scale' },
    { qid: 'pace-02', dimension: 'day_rhythm', value: BANK.sections[0].questions[1].options[0].value, polarity: '+', kind: 'pick' },
    { qid: 'food-01', dimension: 'food', value: BANK.sections[1].questions[0].options[0].value, polarity: '+', kind: 'multi' },
    { qid: 'food-01', dimension: 'food', value: BANK.sections[1].questions[0].options[1].value, polarity: '+', kind: 'multi' },
    { qid: 'food-02', dimension: 'food', value: BANK.sections[1].questions[1].options[0].value, polarity: '-', kind: 'multi' },
    { qid: 'activities-04', dimension: 'activities', value: 'tide pools', polarity: '+', kind: 'text' },
    { qid: 'activities-04', dimension: 'activities', value: '<b>old</b> lighthouses', polarity: '+', kind: 'text' }
  ] });
  assert.equal(ctx.storeAll('Requests')[0].routine, 'PREFS');
  // The owner text is escaped wherever it is echoed (it is not echoed at all here) and no message is over the limit.
  assert.ok(sent(state).every((t) => t.length <= ctx.LIMITS.TG_MAX_CHARS && !/<b>old<\/b>/.test(t)));
});

test('/interview <section> redoes one section; the closing line counts answers, not questions', () => {
  const { ctx, state, k } = fresh();
  tg(ctx, k, H.tgUpdate({ text: '/interview climate' }));
  assert.match(sent(state).pop(), /^<i>1 of 5 · Climate<\/i>/);
  press(ctx, k, state, 'Avoid the heat');
  press(ctx, k, state, '⏭ Skip');
  press(ctx, k, state, '⏭ Skip');
  press(ctx, k, state, '⏭ Skip');
  press(ctx, k, state, 'High altitude');
  press(ctx, k, state, '✅ Done');
  assert.match(sent(state).pop(), /^✅ Thanks — 2 answers noted\. Building your profile…$/);
  const r = requests(state)[0].payload;
  assert.deepEqual(r.interview.answers.map((a) => [a.qid, a.value, a.polarity]), [['climate-01', 'heat', '-'], ['climate-05', 'altitude', '-']]);
  assert.match(r.text, /interview answers \(2\) · climate/);
});

test('resumable: state survives a new execution; /interview re-asks; another flow is never replaced; all-skipped sends nothing', () => {
  const { ctx, state, k } = fresh();
  tg(ctx, k, H.tgUpdate({ text: '/interview pace' }));
  press(ctx, k, state, 'Relaxed');
  const row = ctx.storeAll('Flows')[0];
  const ttlMin = (Date.parse(row.expires_at) - Date.parse(row.updated_at)) / 60000;
  assert.ok(ttlMin >= 7 * 24 * 60 - 1, 'a week to come back');

  // A fresh execution against the same data (next day): /interview re-sends the current question.
  const again = H.loadGas({ pack: 'tour-guide', state });
  again.ctx._HB_SS_CACHE = null;
  const before = sent(state).length;
  tg(again.ctx, k, H.tgUpdate({ text: '/interview' }));
  assert.equal(sent(state).length, before + 1);
  assert.match(sent(state).pop(), /^<i>2 of 3 · Pace/);
  press(again.ctx, k, state, 'Late starter');
  press(again.ctx, k, state, '⏭ Skip');
  assert.deepEqual(requests(state)[0].payload.interview.answers.map((a) => a.qid), ['pace-01', 'pace-02']);

  // Unknown section → the list of sections.
  tg(again.ctx, k, H.tgUpdate({ text: '/interview nowhere' }));
  assert.match(sent(state).pop(), /No section called “nowhere”\. Sections: <code>pace<\/code>, <code>food<\/code>/);

  // A plan flow in progress is not replaced.
  again.ctx.registerFlow('plan', { start() { return { pause: true, state: { trip: 'x' } }; }, next(s) { return { pause: true, state: s }; } });
  again.ctx.flowStart('777', 'plan', {});
  tg(again.ctx, k, H.tgUpdate({ text: '/interview food' }));
  assert.match(sent(state).pop(), /middle of \/plan/);
  assert.equal(again.ctx.flowActive('777').flow, 'plan');
  again.ctx.flowCancel('777');

  // Everything skipped → no request.
  tg(again.ctx, k, H.tgUpdate({ text: '/interview planning' }));
  press(again.ctx, k, state, '⏭ Skip');
  assert.match(sent(state).pop(), /Nothing recorded/);
  assert.equal(requests(state).length, 1);

  // /interview all restarts from question 1; /cancel ends it.
  tg(again.ctx, k, H.tgUpdate({ text: '/interview food' }));
  tg(again.ctx, k, H.tgUpdate({ text: '/interview all' }));
  assert.match(sent(state).pop(), new RegExp('^<i>1 of ' + TOTAL + ' · '));
  tg(again.ctx, k, H.tgUpdate({ text: '/cancel' }));
  assert.match(sent(state).pop(), /Cancelled interview/);
});

test('a text question takes several values and Skip; empty text re-asks; stale fl buttons are refused by the core', () => {
  const { ctx, state, k } = fresh();
  tg(ctx, k, H.tgUpdate({ text: '/interview favourites' }));
  const firstButtons = kbData(state);
  tg(ctx, k, H.tgUpdate({ text: ' , ; ' }));
  assert.match(sent(state).pop(), /^<i>1 of 3 · Past favourites/);
  tg(ctx, k, H.tgUpdate({ text: 'the harbour walk' }));
  tg(ctx, k, H.tgUpdate({ callback: firstButtons[firstButtons.length - 1] }));   // stale Skip from question 1
  assert.match(state.fetch.telegram('answerCallbackQuery').pop().json.text, /moved on/);
  press(ctx, k, state, '⏭ Skip');
  tg(ctx, k, H.tgUpdate({ text: 'Overnight buses\nlong queues' }));
  const a = requests(state)[0].payload.interview.answers;
  assert.deepEqual(a.map((x) => [x.qid, x.dimension, x.value, x.kind]), [
    ['favourites-01', 'interests', 'the harbour walk', 'text'],
    ['favourites-03', 'must_avoid', 'Overnight buses', 'text'],
    ['favourites-03', 'must_avoid', 'long queues', 'text']
  ]);
});

// Developed by: LightAISolutions
