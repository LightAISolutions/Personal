'use strict';
// Tour Guide pack — mock end to end (WP-5c; helpers/decisions/TG-PHASE-5.md §1). The whole Telegram ↔ core ↔ mailbox loop
// with the real pack files (5a commands + flows, 5b envelopes + sheets, 5c Lane B + /route): webhook updates in, requests
// checked in to-brain, brain envelopes dropped in from-brain and picked up by the wake route, a one-off fallback trigger
// or pollFromBrain. Also counts the one-off trigger runs one /plan costs (helpers/decisions/WP-5c.md §M).
// Every trip, place, person and wording here is invented ("Harbor Town"); no live call of any kind is made.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const START = '2027-04-20T09:00:00Z';
const TRIP = 'harbor-town';
const ROUTINES = ['CHAT', 'RESEARCH', 'PLAN', 'NOTES', 'BROCHURE', 'PREFS', 'PLACES'];
const J = (v) => JSON.parse(JSON.stringify(v));
const maps = (id) => 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=' + id;

/* ---------------- harness glue ---------------- */
function fresh(now) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: now || START });
  H.bootstrap(ctx, state);
  ROUTINES.forEach((r) => H.configureRoutine(ctx, state, r));
  // Today's daily jobs already ran (a live core does them in its first sweep of the day). Without this the first sweep of a
  // test would run core_prune_mailbox, and the mock Drive stamps files with the wall clock, not the 2027 test clock, so
  // every archived file would look months old and be trashed (harness quirk, see helpers/status/WP-5c.md).
  ctx.runDailyJobs();
  const t = { ctx, state, k: state.props[ctx.PROP.WEBHOOK_SECRET], scheduled: [], runs: 0, wakes: 0 };
  const orig = ctx.scheduleOneOff;
  ctx.scheduleOneOff = (fn, min) => { t.scheduled.push(fn + '+' + min); return orig(fn, min); };
  return t;
}
const nowMs = (t) => new Date(t.ctx.__TEST_NOW).getTime();
function advance(t, minutes) { t.ctx.__TEST_NOW = new Date(nowMs(t) + minutes * 60000).toISOString(); }
function setNow(t, iso) { t.ctx.__TEST_NOW = iso; }
const post = (t, upd) => t.ctx.doPost(H.postEvent('tg', { k: t.k }, upd));
const say = (t, text) => post(t, H.tgUpdate({ text }));
const tap = (t, data) => post(t, H.tgUpdate({ callback: data }));
const sends = (t) => t.state.fetch.telegram('sendMessage').map((r) => r.json);
const texts = (t) => sends(t).map((m) => m.text);
const last = (t) => texts(t).slice(-1)[0];
const since = (t, n) => texts(t).slice(n);
/** Every request the core wrote, oldest first: the request file's payload plus its id. Open ones sit in to-brain; the core
 *  moves a request file to archive/processed once a reply to it arrives (09_mailbox.js _archiveRequest). */
function requests(t, where) {
  const dirs = where ? [where] : ['to-brain', 'archive/processed'];
  return dirs.flatMap((d) => (t.state.drive.listFiles('TourGuide/mailbox/' + d) || []).filter((n) => /^req_/.test(n))
    .map((n) => { const env = JSON.parse(t.state.drive.readFile('TourGuide/mailbox/' + d, n)); return { id: n.replace(/^req_|\.json$/g, ''), env_id: env.id, where: d, ...env.payload }; }))
    .sort((a, b) => (a.requested_at < b.requested_at ? -1 : a.requested_at > b.requested_at ? 1 : 0));
}
const reqsOf = (t, kind) => requests(t).filter((r) => r.kind === kind);
const status = (t, id) => J(t.ctx.getRequest(id)).status;
/** The callback data of the newest button whose label matches (string: equal or ends with; RegExp: test). */
function button(t, match) {
  const all = sends(t).filter((m) => m.reply_markup && m.reply_markup.inline_keyboard).map((m) => m.reply_markup.inline_keyboard.flat());
  for (let i = all.length - 1; i >= 0; i--) {
    const b = all[i].find((x) => (typeof match === 'string' ? x.text === match || x.text.endsWith(match) : match.test(x.text)));
    if (b) return b.callback_data;
  }
  assert.fail('no button ' + match);
}
const press = (t, match) => tap(t, button(t, match));
/** The brain writes an envelope; `via` says how the core picks it up: the wake route (web app), the fallback trigger, or a direct poll. */
function brain(t, type, payload, over = {}, via = 'wake') {
  const env = H.envelope(type, payload, over);
  H.putEnvelope(t.state, env);
  if (via === 'wake') { t.wakes++; return { env, out: JSON.parse(t.ctx.doGet(H.getEvent('wake')).getContent()) }; }
  if (via === 'poll') return { env, out: J(t.ctx.pollFromBrain()) };
  return { env, out: null };
}
/** Run the one-off triggers whose time has come (spec.at ≤ now), as Apps Script would. */
function fireDue(t) {
  const due = t.state.triggers.filter((x) => x.spec.at && x.spec.at.getTime() <= nowMs(t));
  const out = due.map((x) => t.ctx[x.fn]({ triggerUid: x.id }));
  t.runs += due.length;
  return out;
}
/** The routine takes `minutes` to answer: the clock moves minute by minute and the due fallback sweeps run meanwhile. */
function wait(t, minutes) { for (let i = 0; i < minutes; i++) { advance(t, 1); fireDue(t); } }
const files = (t, p) => (t.state.drive.listFiles('TourGuide/mailbox/' + p) || []).sort();

/* ---------------- fixtures (invented) ---------------- */
const title = (slug) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const item = (n, slug, over = {}) => ({ n, slug, name: title(slug), why_you: 'Quiet before noon, close to the quay.', fit: 0.8, est_minutes: 60,
  area: 'Old quay', maps_url: maps('FixtureHt' + n), labels: ['verified'], ...over });
const FACTS = {
  trip: TRIP,
  found: [{ n: 1, kind: 'lodging', text: 'Quay Inn, two nights' },
    { n: 2, kind: 'booking', text: 'Ferry to Gull Rock, Thu 10:00 <confirmed>' }],
  missing: ['dates', 'flight']
};
const ROUND1 = { trip: TRIP, run_id: 'ht-r1-a', round: 1, more: true, decided: [],
  groups: [{ id: 'activities', gems_wanted: 1, gems_shown: 1, items: [item(1, 'tide-clock-museum'),
    item(2, 'gull-rock-lighthouse', { gem: true, gem_line: 'Small, loved by locals, rarely in guidebooks.' })] },
  { id: 'food', items: [item(3, 'net-loft-chowder')] }] };
const ROUND2 = { trip: TRIP, run_id: 'ht-r2-b', round: 2, more: false, decided: ['tide-clock-museum', 'gull-rock-lighthouse', 'net-loft-chowder'],
  groups: [{ id: 'activities', items: [item(4, 'salt-marsh-boardwalk')] }, { id: 'food', items: [item(5, 'smokehouse-row')] }] };
const stop = (n, slug, arrive, depart, minutes) => ({ n, slug, name: title(slug), arrive, depart, minutes, maps_url: maps('FixtureStop' + n), note_line: 'Go early; it fills by noon.' });
function digest(drive) {
  return { trip: TRIP, build_id: 'build-ht-1', verified_on: '2027-04-21',
    days: [
      { date: '2027-05-12', theme: 'Quay and clocks', stops: [stop(1, 'tide-clock-museum', '10:00', '11:00', 60)],
        legs: [{ from: 'lodging', to: 'tide-clock-museum', mode: 'WALK', minutes: 8 }], warnings: [] },
      { date: '2027-05-13', theme: 'Marsh and smoke', stops: [stop(1, 'salt-marsh-boardwalk', '09:30', '11:00', 90), stop(2, 'smokehouse-row', '12:00', '13:00', 60)],
        legs: [{ from: 'lodging', to: 'salt-marsh-boardwalk', mode: 'TRANSIT', minutes: 20 }, { from: 'salt-marsh-boardwalk', to: 'smokehouse-row', mode: 'WALK', minutes: 12 }],
        warnings: ['The boardwalk closes at high tide.'] }],
    later: [{ slug: 'gull-rock-lighthouse', name: 'Gull Rock Lighthouse', reason: 'owner_choice' }],
    drive: { plan: drive.plan, brochure_html: null, brochure_pdf: drive.pdf } };
}
const place = (slug, over = {}) => ({ slug, name: title(slug), area: 'Old quay', category: 'museum', tags: ['history'], status: 'candidate',
  last_trip: null, last_researched: '2027-04-21', last_verified: null, note_line: 'Quiet before noon.', maps_url: maps('FixturePl' + slug.length),
  history_summary: '', ...over });
const PLACES = { destination: TRIP, places: [place('tide-clock-museum'), place('gull-rock-lighthouse', { category: 'viewpoint', tags: ['coast'] })] };
const CIDS = ['c_0a1b2c3d4e', 'c_1b2c3d4e5f'];
function prefsReview() {
  const st = ['You like a relaxed pace', 'You start the day early'];
  return { v: 1, kind: 'prefs_review', vocab: 'travel', batch_id: 'pfb_0123456789abcdef', more: 0, held_back: [],
    items: CIDS.map((cid, i) => ({ cid, dimension: 'pace', value: 'v' + i, stance: '+', statement: st[i], suspect: false, text: st[i] + ' (from the interview)',
      buttons: [[{ text: 'Yes', data: 'pf:' + cid + ':y' }, { text: 'Edit', data: 'pf:' + cid + ':e' }, { text: 'No', data: 'pf:' + cid + ':n' }]] })) };
}

/* ---------------- tests ---------------- */
test('e2e interview: /start offer → /interview pace → prefs request → prefs_review taps → decisions request → profile_summary → /profile', () => {
  const t = fresh();
  say(t, '/start');
  assert.match(texts(t).join('\n'), /start with a short interview/);
  press(t, '🧭 Start the interview');
  assert.equal(J(t.ctx.flowActive('777')).flow, 'interview');
  say(t, '/cancel');
  assert.equal(t.ctx.flowActive('777'), null);

  say(t, '/interview pace');
  press(t, 'Packed');
  press(t, 'Early riser');
  press(t, '⏭ Skip');
  assert.match(last(t), /Thanks — 2 answers noted\. Building your profile/);
  const [pr] = reqsOf(t, 'prefs');
  assert.ok(pr, 'one prefs request in to-brain');
  assert.equal(J(t.ctx.getRequest(pr.id)).routine, 'PREFS');
  assert.equal(pr.interview.answers.length, 2);
  assert.ok(pr.interview.answers.every((a) => /^pace-0[12]$/.test(a.qid)));
  assert.equal(t.ctx.flowActive('777'), null);

  // The brain answers with a review batch (in reply to the interview request), through the wake route.
  advance(t, 6);
  const { out } = brain(t, 'prefs_review', prefsReview(), { in_reply_to: pr.id });
  assert.equal(out.processed, 1);
  assert.equal(status(t, pr.id), 'answered');
  assert.ok(texts(t).some((x) => /2 preferences to review/.test(x)));
  tap(t, 'pf:' + CIDS[0] + ':y');
  tap(t, 'pf:' + CIDS[1] + ':e');
  say(t, 'I start around <8>');                             // tg_capture_pf_edit takes it (Lane B is off and sorts after it)
  assert.ok(texts(t).some((x) => /Noted: <b>I start around &lt;8&gt;<\/b>/.test(x)));
  const dec = reqsOf(t, 'prefs').filter((r) => r.decisions);
  assert.equal(dec.length, 1, 'a fully decided batch opens one prefs request with payload.decisions');
  assert.deepEqual(J(dec[0].decisions.decisions.map((d) => [d.cid, d.decision, d.value || null])),
    [[CIDS[0], 'confirm', null], [CIDS[1], 'edit', 'I start around <8>']]);
  assert.equal(reqsOf(t, 'message').length, 0, 'the edit text never became a message request');

  advance(t, 5);
  brain(t, 'profile_summary', { v: 1, kind: 'profile_summary', text: 'Pace: packed\nMornings: early <riser>', dimensions_count: 2, updated: '2027-04-20T09:10:00Z' },
    { in_reply_to: dec[0].id });
  assert.match(last(t), /Your travel profile<\/b>\nPace: packed\nMornings: early &lt;riser&gt;/);
  assert.equal(status(t, dec[0].id), 'answered');
  say(t, '/profile');
  assert.match(last(t), /^<b>Your travel profile<\/b> <i>\(2027-04-20\)<\/i>\nPace: packed\nMornings: early &lt;riser&gt;/);
  say(t, '/start');
  assert.ok(!/short interview/.test(last(t)), 'no interview offer once a profile exists');
});

test('e2e /plan: intake → trip_facts (one ✏️, missing dates asked) → research → shortlist ×2 → choices → plan → digest + reply with files → /today; trigger runs counted', (tt) => {
  const t = fresh();
  const fetches = () => t.state.fetch.requests.filter((r) => !/api\.telegram\.org/.test(r.url)).length;

  // 1. /plan opens the intake research request (routine RESEARCH fired, +3/+10 fallbacks scheduled).
  say(t, '/plan Harbor Town');
  assert.match(last(t), /Looking at what I already know about <b>Harbor Town<\/b>/);
  const [intake] = reqsOf(t, 'research');
  assert.deepEqual(J([intake.trip, intake.scope, intake.destination]), [TRIP, 'intake', 'Harbor Town']);
  assert.deepEqual(t.scheduled, ['wakeTrigger+3', 'wakeTrigger+10']);
  assert.equal(fetches(), 1, 'one routine fire');
  assert.equal(J(t.ctx.flowActive('777')).state.stage, 'intake');

  // 2. The routine is slow: +3 runs with the request open (and schedules the hourly guard once); the facts land at
  //    minute 8 but the wake call is lost — the +10 fallback sweep delivers them.
  wait(t, 8);
  brain(t, 'trip_facts', FACTS, { in_reply_to: intake.id }, 'none');
  wait(t, 2);
  assert.equal(status(t, intake.id), 'answered', 'the +10 fallback picked the envelope up');
  assert.ok(texts(t).some((x) => /What I found for .*\n<b>1\.<\/b> Staying: Quay Inn, two nights\n<b>2\.<\/b> Booked: Ferry to Gull Rock, Thu 10:00 &lt;confirmed&gt;\nStill missing: dates, flight/.test(x)));
  assert.equal(J(t.ctx.flowActive('777')).state.stage, 'confirm');

  // 3. ✏️ on fact 1, the corrected line, ✅ keeps 2, Continue → the dates question, then the flight question (skipped).
  press(t, '1 ✏️');
  assert.match(last(t), /Send the corrected line for <b>1<\/b>/);
  say(t, 'Quay Inn, three nights');
  assert.match(last(t), /Noted for 1: <i>Quay Inn, three nights<\/i>/);
  press(t, '2 ✅');
  press(t, '▶️ Continue');
  assert.match(last(t), /What are the dates\?/);
  say(t, 'sometime in May');
  assert.match(last(t), /could not read those dates/);
  say(t, '2027-05-12 to 2027-05-13');
  assert.match(last(t), /Any flights/);
  press(t, '⏭ Skip');
  assert.match(last(t), /Researching <b>Harbor Town<\/b> for .*12.*13/);
  const research = reqsOf(t, 'research').filter((r) => r.scope === 'new');
  assert.equal(research.length, 1);
  assert.deepEqual(J([research[0].start_date, research[0].end_date, research[0].lodging, research[0].booked]),
    ['2027-05-12', '2027-05-13', 'Quay Inn, three nights', ['Booked: Ferry to Gull Rock, Thu 10:00 <confirmed>']]);
  const trip0 = J(t.ctx.tgTripGet(TRIP));
  assert.deepEqual([trip0.start, trip0.end, trip0.lodging.text], ['2027-05-12', '2027-05-13', 'Quay Inn, three nights']);

  // 4. Shortlist round 1 (via the wake route) → taps → ➕ More options → round 2 → tap → Done choosing.
  wait(t, 12);
  brain(t, 'shortlist', ROUND1, { in_reply_to: research[0].id });
  assert.equal(status(t, research[0].id), 'answered');
  assert.ok(texts(t).some((x) => /round 1<\/b>[\s\S]*💎 <b><a href=[^>]+>Gull Rock Lighthouse<\/a><\/b>/.test(x)));
  assert.equal(J(t.ctx.flowActive('777')).state.stage, 'choose');
  press(t, '1 ✅'); press(t, '2 🔖'); press(t, '3 ❌');
  press(t, '➕ More options');
  const more = reqsOf(t, 'research').filter((r) => r.scope === 'more');
  assert.equal(more.length, 1);
  assert.deepEqual(J(more[0].decided).sort(), ['gull-rock-lighthouse', 'net-loft-chowder', 'tide-clock-museum']);
  wait(t, 9);
  brain(t, 'shortlist', ROUND2, { in_reply_to: more[0].id });
  press(t, '4 ✅'); press(t, '5 ✅');
  assert.ok(!sends(t).slice(-1)[0].reply_markup.inline_keyboard.flat().some((b) => /More options/.test(b.text)), 'no more rounds after more:false');
  press(t, '✅ Done choosing');
  const [plan] = reqsOf(t, 'plan');
  assert.deepEqual(J([plan.picks.sort(), plan.later, plan.skip, plan.deliverables]),
    [['salt-marsh-boardwalk', 'smokehouse-row', 'tide-clock-museum'], ['gull-rock-lighthouse'], ['net-loft-chowder'], ['plan', 'notes', 'brochure']]);
  assert.equal(J(t.ctx.getRequest(plan.id)).routine, 'PLAN');

  // 5. The plan: plan_digest (stored, rendered by the flow, which ends) and the core reply with two Drive files.
  wait(t, 14);
  const pdf = t.state.drive.putFile('TourGuide/Trips', 'harbor-town-brochure.pdf', '%PDF-fixture', 'application/pdf');
  const md = t.state.drive.putFile('TourGuide/Trips', 'harbor-town-plan.md', '# fixture plan', 'text/markdown');
  brain(t, 'plan_digest', digest({ plan: md.getId(), pdf: pdf.getId() }), { in_reply_to: plan.id }, 'poll');
  assert.equal(t.ctx.flowActive('777'), null, 'the plan flow ended with the digest');
  assert.ok(texts(t).some((x) => /🗓 <b>Harbor Town<\/b> — 2 days · checked on 2027-04-21[\s\S]*⚠️ 1 note[\s\S]*🔖 <b>Later<\/b>\n• Gull Rock Lighthouse/.test(x)));
  advance(t, 1);
  brain(t, 'reply', { text: 'Your Harbor Town plan is ready.', drive_file_ids: { plan: md.getId(), brochure_pdf: pdf.getId() } }, { in_reply_to: plan.id });
  const docs = t.state.fetch.telegram('sendDocument');
  assert.equal(docs.length, 2, 'the core sends both files of the reply');
  assert.match(texts(t).join('\n'), /Your Harbor Town plan is ready\./);
  const trip = J(t.ctx.tgTripGet(TRIP));
  assert.deepEqual([trip.status, trip.build_id, trip.drive_brochure_pdf], ['planned', 'build-ht-1', pdf.getId()]);
  assert.equal(J(t.ctx.tgDigestDays(TRIP)).length, 2);

  // Every request of the journey is answered; the remaining fallbacks find nothing to do.
  wait(t, 120);
  // Counted from the Requests sheet, the core's record (request files move to archive/processed when answered and are pruned later).
  const rows = J(t.ctx.storeAll(t.ctx.SHEETS.REQUESTS));
  assert.deepEqual(rows.map((r) => r.status), ['answered', 'answered', 'answered', 'answered']);
  assert.deepEqual(rows.map((r) => r.kind), ['research', 'research', 'research', 'plan']);
  assert.equal(t.state.triggers.length, 0, 'no trigger left behind');
  const opened = rows.length;
  assert.equal(opened, 4, 'intake, new, more, plan');
  assert.equal(t.scheduled.filter((s) => s === 'wakeTrigger+3' || s === 'wakeTrigger+10').length, 2 * opened);
  const hourly = t.scheduled.filter((s) => s === 'wakeTrigger+60').length;
  assert.ok(hourly >= 1 && hourly <= 2, 'the hourly guard is shared: ' + hourly);
  assert.equal(t.runs, t.scheduled.length, 'every scheduled one-off ran once');
  tt.diagnostic('/plan (4 requests, 1 More round): one-off trigger runs=' + t.runs + ' (' + t.scheduled.join(' ') + '), wake-route runs=' + t.wakes + ', routine fires=' + fetches());

  // 6. /today from the sheet, on the trip's second day.
  setNow(t, '2027-05-13T07:30:00Z');
  say(t, '/today');
  assert.match(last(t), /^<b>Day 2 of 2 · .*13.*<\/b> — Marsh and smoke\n[\s\S]*09:30–11:00 <a href=[^>]+>Salt Marsh Boardwalk<\/a> · 1 h 30[\s\S]*⚠️ The boardwalk closes at high tide\./);
  say(t, '/brochure');
  assert.equal(t.state.fetch.telegram('sendDocument').length, 3, '/brochure resends the stored PDF');
  assert.equal(reqsOf(t, 'brochure').length, 0);
});

/** A trip that is planned and has its digest, without walking /plan again (that is the test above). */
function plannedTrip(t) {
  t.ctx.tgTripUpsert({ slug: TRIP, destination: 'Harbor Town', start: '2027-05-12', end: '2027-05-13', status: 'planned' });
  const pdf = t.state.drive.putFile('TourGuide/Trips', 'harbor-town-brochure.pdf', '%PDF-fixture', 'application/pdf');
  const md = t.state.drive.putFile('TourGuide/Trips', 'harbor-town-plan.md', '# fixture plan', 'text/markdown');
  brain(t, 'plan_digest', digest({ plan: md.getId(), pdf: pdf.getId() }));
  advance(t, 1);
  assert.equal(J(t.ctx.tgDigestDays(TRIP)).length, 2);
}

test('e2e places: places_digest → count line; /places <query> → 🔁 opens a places check → the answer names what it checked; an hours field is refused', () => {
  const t = fresh();
  t.ctx.tgTripUpsert({ slug: TRIP, destination: 'Harbor Town', start: '2027-05-12', end: '2027-05-13', status: 'researched' });

  // Unsolicited digest (the brain refreshed the repository on its own): one count line.
  const { out } = brain(t, 'places_digest', PLACES);
  assert.equal(out.processed, 1);
  assert.equal(last(t), '📍 Places for <b>harbor-town</b> updated: 2 new, 0 changed — /places to look.');

  // /places tide → one match with 📝 / ➕ / 🔁; 🔁 opens a places request in to-brain (routine PLACES fired).
  advance(t, 1);
  say(t, '/places tide');
  assert.match(last(t), /^📚 <b>1 match<\/b>[\s\S]*Tide Clock Museum/);
  press(t, '🔁 1');
  assert.match(last(t), /🔁 Checking <b>Tide Clock Museum<\/b>…/);
  const [chk] = reqsOf(t, 'places');
  assert.deepEqual(J([chk.scope, chk.destination, chk.slugs]), ['check', TRIP, ['tide-clock-museum']]);
  assert.equal(J(t.ctx.getRequest(chk.id)).routine, 'PLACES');
  assert.equal(status(t, chk.id), 'open');

  // The answer (via the +3 fallback, no wake call): the fresh-check lines, and the request is answered.
  advance(t, 2);
  const fixed = { destination: TRIP, places: [place('tide-clock-museum', { last_verified: '2027-04-20' })] };
  brain(t, 'places_digest', fixed, { in_reply_to: chk.id }, 'none');
  wait(t, 1);
  assert.equal(status(t, chk.id), 'answered');
  assert.equal(last(t), '🔁 <b>Fresh check — harbor-town</b>\n✅ still open: <b>Tide Clock Museum</b> · checked 2027-04-20');

  // A digest carrying opening hours (a Google field) is refused as a whole: archived to rejected, nothing stored, owner not told.
  advance(t, 1);
  const n = sends(t).length;
  const bad = J(PLACES); bad.places[1].hours = 'Mon–Sun 09:00–17:00'; bad.places[1].note_line = 'Changed <never stored>';
  const r = brain(t, 'places_digest', bad);
  assert.equal(r.out.processed, 1, 'the sweep touched it');
  assert.equal(files(t, 'archive/rejected').length, 1, 'archived to rejected');
  assert.ok(J(t.ctx.storeAll(t.ctx.SHEETS.AUDIT)).some((a) => a.event === 'envelope_rejected' && /Google field \\"hours\\" refused/.test(a.detail_json)));
  assert.equal(sends(t).length, n, 'the owner is not messaged');
  assert.equal(J(t.ctx.tgPlacesGet('gull-rock-lighthouse')).note_line, 'Quiet before noon.');
});

test('e2e review: the daily job offers /review the day after the trip ends → tap → fl ratings → one prefs request with payload.review; trip done', () => {
  const t = fresh();
  plannedTrip(t);

  // During the trip and on its last day: no offer.
  setNow(t, '2027-05-13T18:00:00Z');
  t.ctx.wakeTrigger({});
  assert.ok(!texts(t).some((x) => /Welcome back/.test(x)));

  // The first sweep of the next day runs the daily jobs: one offer.
  setNow(t, '2027-05-14T08:00:00Z');
  t.ctx.wakeTrigger({});
  assert.equal(last(t), '🧳 Welcome back from <b>Harbor Town</b>. Rate the 3 places in two minutes? It shapes the next plan.');
  t.ctx.wakeTrigger({});
  setNow(t, '2027-05-15T08:00:00Z');
  t.ctx.wakeTrigger({});
  assert.equal(texts(t).filter((x) => /Welcome back/.test(x)).length, 1, 'offered once, never again');

  press(t, '⭐ Review the trip');
  assert.match(last(t), /^<i>1 of 3 · Harbor Town<\/i>\n<b>Tide Clock Museum<\/b> — .*12.* · 1 h planned\nWorth it\?/);
  press(t, '👍 Worth it');
  assert.match(last(t), /And the time there\?/);
  press(t, '⏩ Needed longer');
  press(t, '👎 Not really');
  press(t, '👌 About right');
  assert.match(last(t), /3 of 3[\s\S]*Smokehouse Row/);
  press(t, '⏭ Skipped it');
  assert.equal(last(t), '🙏 Noted — this will shape the next plan.');
  assert.equal(t.ctx.flowActive('777'), null);

  const prefs = reqsOf(t, 'prefs');
  assert.equal(prefs.length, 1, 'exactly one prefs request');
  assert.equal(J(t.ctx.getRequest(prefs[0].id)).routine, 'PREFS');
  assert.deepEqual(J(prefs[0].review), { trip: TRIP, items: [
    { slug: 'tide-clock-museum', rating: 'up', calibration: 'longer' },
    { slug: 'salt-marsh-boardwalk', rating: 'down', calibration: 'right' },
    { slug: 'smokehouse-row', rating: 'skipped' }] });
  assert.equal(J(t.ctx.tgTripGet(TRIP)).status, 'done');
});

test('e2e refusals and wake fallbacks: a shortlist with an unknown field is refused and the flow waits; a throttled wake falls back to +1', () => {
  const t = fresh();
  say(t, '/plan Harbor Town');
  const [intake] = reqsOf(t, 'research');
  advance(t, 1);

  // A shortlist whose item carries a rating: validate refuses the envelope; the flow and the request are untouched.
  const n = sends(t).length;
  const bad = J(ROUND1); bad.groups[0].items[0].rating = 4.6;
  const r = brain(t, 'shortlist', bad, { in_reply_to: intake.id });
  assert.equal(r.out.processed, 1);
  assert.equal(files(t, 'archive/rejected').length, 1, 'archived to rejected');
  assert.equal(files(t, 'from-brain').length, 0);
  assert.equal(sends(t).length, n, 'the owner is not messaged');
  assert.equal(status(t, intake.id), 'open', 'a refused envelope answers nothing');
  assert.equal(J(t.ctx.flowActive('777')).state.stage, 'intake');
  const audit = J(t.ctx.storeAll(t.ctx.SHEETS.AUDIT)).filter((a) => a.event === 'envelope_rejected');
  assert.equal(audit.length, 1);
  assert.match(String(audit[0].detail_json), /rating/);

  // The real answer arrives seconds later: the wake inside the 15 s window is throttled and schedules a +1 follow-up sweep.
  t.ctx.__TEST_NOW = new Date(nowMs(t) + 5000).toISOString();
  const ok = brain(t, 'trip_facts', FACTS, { in_reply_to: intake.id });
  assert.deepEqual([ok.out.ok, ok.out.throttled], [true, true]);
  assert.ok(t.scheduled.includes('wakeTrigger+1'));
  assert.equal(files(t, 'from-brain').length, 1, 'still waiting');
  wait(t, 1);
  assert.equal(status(t, intake.id), 'answered', 'the +1 follow-up delivered it');
  assert.equal(J(t.ctx.flowActive('777')).state.stage, 'confirm');
  // The +3 and +10 fallbacks of the intake still run (cheap no-ops) and leave nothing behind but the hourly guard.
  wait(t, 70);
  assert.equal(t.state.triggers.length, 0);
});

// Developed by: LightAISolutions
