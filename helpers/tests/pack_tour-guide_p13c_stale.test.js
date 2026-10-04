'use strict';
// WP-13c (C13): the lodging fingerprint (FNV-1a over hand-made UTF-8 — the core has no TextEncoder), its stamp on plan
// and replan requests, the fingerprint a stored plan was built for, and the "built for different lodging" line in
// /trip, the day card and the morning message — in C13's three cases, and never otherwise. Invented data only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('./pack_tour-guide_p13c_world');

/** An independent FNV-1a 32 over Node's own UTF-8 (lone surrogates → U+FFFD, as Buffer does). */
function refFnv(str) {
  let h = 0x811c9dc5n;
  for (const b of Buffer.from(str, 'utf8')) h = ((h ^ BigInt(b)) * 0x01000193n) & 0xffffffffn;
  return h.toString(16).padStart(8, '0');
}
const TWO_STAYS = [{ text: 'Gull  Hōuse 漢 😀 ', from: '2027-06-12', to: '2027-06-15' }, { text: ' Reed\tINN', from: '2027-06-10', to: '2027-06-12' }];
const STALE = /⚠️ This plan was built for different lodging\. Rebuild it with <code>\/replan 2027-06-10 &lt;why&gt;<\/code>\./;
const html = (msgs) => W.J(msgs).map((m) => m.html).join('\n');
/** Every place the line may show: /trip, /day 2 and the morning message of the second day. */
function shows(ctx, state) {
  W.say(ctx, state, '/trip');
  const trip = W.last(state);
  W.say(ctx, state, '/day 2');
  const day = W.last(state);
  const t = ctx.tgTripGet(W.TRIP);
  const morning = html(ctx.tgMorningMessages(t, ctx.tgDigestDay(W.TRIP, '2027-06-11'), 3, null, false));
  return [trip, day, morning].map((s) => STALE.test(s));
}
const none = [false, false, false];
const all = [true, true, true];

test('the fingerprint: FNV-1a over UTF-8 of the normalised stays (or the undated words); the test vectors', () => {
  const { ctx } = W.fresh();
  assert.equal(ctx.tgLgFnv(''), '811c9dc5');
  assert.equal(ctx.tgLgFnv('a'), 'e40c292c');
  ['', 'a', 'Reed Inn', 'hōuse 漢 😀', 'é' + '́', '\uD800 lone', 'tail \uDC00', 'x'.repeat(500), '\u{10FFFF}\u0000\u007f\u0080߿ࠀ￿']
    .forEach((s) => {
      assert.deepEqual(Array.from(W.J(ctx.tgLgUtf8(s))), Array.from(Buffer.from(s, 'utf8')), 'utf-8 of ' + JSON.stringify(s));
      assert.equal(ctx.tgLgFnv(s), refFnv(s), 'fnv of ' + JSON.stringify(s));
    });
  // Vector 1: two stays, out of order, mixed case, tabs, double spaces, kanji and an emoji.
  const norm = '2027-06-10|2027-06-12|reed inn\n2027-06-12|2027-06-15|gull hōuse 漢 😀';
  assert.equal(refFnv(norm), '0b6769ef');
  assert.equal(ctx.tgLgFp({ lodging: JSON.stringify({ text: 'x', stays: TWO_STAYS }) }), 'lfp1:0b6769ef');
  // Vector 2: the undated words alone.
  assert.equal(refFnv('old mill, 3 nights'), '6ae58148');
  assert.equal(ctx.tgLgFp({ lodging: JSON.stringify({ text: '  Old  MILL, 3 nights ' }) }), 'lfp1:6ae58148');
  // No lodging → no fingerprint; an emptied lodging too.
  assert.equal(ctx.tgLgFp({}), '');
  assert.equal(ctx.tgLgFp({ lodging: JSON.stringify({ text: '', stays: [] }) }), '');
  // Stays win over the words beside them (the words are their summary).
  assert.equal(ctx.tgLgFp({ lodging: JSON.stringify({ text: 'anything else', stays: TWO_STAYS }) }), 'lfp1:0b6769ef');
});

test('plan and replan requests carry lodging_fp (the core\'s own, never a caller\'s); other kinds and no lodging carry none', () => {
  const { ctx, state } = W.fresh();
  W.planned(ctx, state);
  W.say(ctx, state, '/replan 2027-06-11 more orchards');
  assert.equal(W.reqOf(state, 'replan').pop().lodging_fp, undefined, 'no lodging → no fingerprint');

  W.say(ctx, state, '/lodging Reed Inn 2027-06-10 to 2027-06-12');
  const fp = ctx.tgLgFp(ctx.tgTripGet(W.TRIP));
  assert.match(fp, /^lfp1:[0-9a-f]{8}$/);
  W.say(ctx, state, '/replan 2027-06-11 more orchards');
  const env = W.reqEnvOf(state, 'replan').filter((e) => e.payload.lodging_fp).pop();
  assert.equal(env.payload.lodging_fp, fp);
  assert.equal(ctx.tgLgReqFp(env.id), fp, 'the core keeps the request\'s fingerprint for a digest that has none');

  // A caller's (or a forged) value is replaced; with no lodging it is dropped.
  const r = W.J(ctx.tgOpenKindRequest('plan', { trip: W.TRIP, lodging_fp: 'lfp1:deadbeef' }, { ack: false }));
  const plan = W.reqEnvs(state).filter((e) => e.id === r.id)[0];
  assert.equal(plan.payload.lodging_fp, fp);
  ctx.tgOpenKindRequest('research', { trip: W.TRIP }, { ack: false });
  assert.equal(W.reqOf(state, 'research').pop().lodging_fp, undefined, 'research carries no fingerprint');
  W.say(ctx, state, '/lodging clear');
  const r2 = W.J(ctx.tgOpenKindRequest('replan', { trip: W.TRIP, lodging_fp: 'lfp1:deadbeef' }, { ack: false }));
  assert.equal(W.reqEnvs(state).filter((e) => e.id === r2.id)[0].payload.lodging_fp, undefined);
  assert.equal(ctx.tgLgReqFp(r2.id), '');
});

test('the request map keeps the newest 60 and ignores ids or values it cannot use', () => {
  const { ctx } = W.fresh();
  for (let i = 0; i < 65; i++) ctx.tgLgReqRemember('req-' + i, 'lfp1:' + String(i).padStart(8, '0'));
  assert.equal(ctx.tgLgReqFp('req-4'), '');
  assert.equal(ctx.tgLgReqFp('req-5'), 'lfp1:00000005');
  assert.equal(ctx.tgLgReqFp('req-64'), 'lfp1:00000064');
  assert.equal(Object.keys(JSON.parse(ctx.settingGet('tg_req_lodging', '{}'))).length, 60);
  ctx.tgLgReqRemember('req-x', 'lfp1:NOTHEX00');
  ctx.tgLgReqRemember('', 'lfp1:00000001');
  assert.equal(ctx.tgLgReqFp('req-x'), '');
  assert.equal(ctx.tgLgReqFp(''), '');
  // A corrupt setting reads as empty.
  ctx.settingSet('tg_req_lodging', '{not json', 'test');
  assert.equal(ctx.tgLgReqFp('req-5'), '');
});

test('stale, case 1: the digest\'s own lodging_fp — no line while it matches, the line once the stays change, gone after the rebuild', () => {
  const { ctx, state } = W.fresh();
  W.trip(ctx);
  W.say(ctx, state, '/lodging Reed Inn 2027-06-10 to 2027-06-12');
  const fp = ctx.tgLgFp(ctx.tgTripGet(W.TRIP));
  assert.equal(W.deliver(ctx, state, 'plan_digest', W.digest({ lodging_fp: fp })).processed, 1);
  assert.deepEqual(shows(ctx, state), none);
  assert.equal(W.J(JSON.parse(ctx.settingGet('tg_plan_lodging', '{}')))[W.TRIP].fp, fp);

  W.say(ctx, state, '/lodging Gull House 2027-06-12 to 2027-06-15');
  assert.deepEqual(shows(ctx, state), all);
  // The line sits right under the day card's header and in /trip just before the days.
  W.say(ctx, state, '/day 2');
  assert.match(W.last(state).split('\n')[1], STALE);

  // The same stays again (written differently) → the same fingerprint → no line.
  W.say(ctx, state, '/lodging remove 2027-06-12');
  W.say(ctx, state, '/lodging  reed   INN 2027-06-10 to 2027-06-12');
  assert.equal(ctx.tgLgFp(ctx.tgTripGet(W.TRIP)), fp);
  assert.deepEqual(shows(ctx, state), none);

  // Changed again, then a rebuild that echoes the new fingerprint clears the line.
  W.say(ctx, state, '/lodging Weir Lodge 2027-06-10 to 2027-06-12');
  assert.deepEqual(shows(ctx, state), all);
  W.deliver(ctx, state, 'plan_digest', W.digest({ build_id: 'build-fh-2', lodging_fp: ctx.tgLgFp(ctx.tgTripGet(W.TRIP)) }));
  assert.deepEqual(shows(ctx, state), none);
});

test('stale, case 2: a digest without lodging_fp uses the fingerprint of the request it answers', () => {
  const { ctx, state } = W.fresh();
  W.planned(ctx, state, { lodging_fp: undefined });
  W.say(ctx, state, '/lodging Reed Inn 2027-06-10 to 2027-06-12');
  W.say(ctx, state, '/replan 2027-06-11 more orchards');
  const req = W.reqEnvOf(state, 'replan').pop();
  ctx.__TEST_NOW = '2027-05-02T09:00:00Z';
  W.deliver(ctx, state, 'plan_digest', W.digest({ build_id: 'build-fh-2' }), { in_reply_to: req.id });
  assert.equal(W.J(JSON.parse(ctx.settingGet('tg_plan_lodging', '{}')))[W.TRIP].fp, req.payload.lodging_fp);
  assert.deepEqual(shows(ctx, state), none);
  ctx.__TEST_NOW = '2027-05-03T09:00:00Z';
  W.say(ctx, state, '/lodging Gull House 2027-06-12 to 2027-06-15');
  assert.deepEqual(shows(ctx, state), all);
  // The digest's own value wins over the request's.
  W.say(ctx, state, '/replan 2027-06-11 more orchards');
  const req2 = W.reqEnvOf(state, 'replan').pop();
  W.deliver(ctx, state, 'plan_digest', W.digest({ build_id: 'build-fh-3', lodging_fp: 'lfp1:00000000' }), { in_reply_to: req2.id });
  assert.deepEqual(shows(ctx, state), all);
});

test('stale, case 3: with neither fingerprint, only a lodging saved after the digest arrived; old lodging never', () => {
  const { ctx, state } = W.fresh();
  W.trip(ctx);
  W.say(ctx, state, '/lodging Old Mill, 3 nights');
  ctx.__TEST_NOW = '2027-05-02T09:00:00Z';
  W.deliver(ctx, state, 'plan_digest', W.digest());   // no lodging_fp, no in_reply_to
  assert.equal(W.J(JSON.parse(ctx.settingGet('tg_plan_lodging', '{}')))[W.TRIP].fp, '');
  assert.deepEqual(shows(ctx, state), none, 'lodging saved before the digest → no line');
  ctx.__TEST_NOW = '2027-05-03T09:00:00Z';
  W.say(ctx, state, '/lodging Quay Rooms, 3 nights');
  assert.deepEqual(shows(ctx, state), all, 'saved after → the line');

  // A lodging saved before this phase (no set_at) and a digest with no fingerprint → no line, whatever the times.
  const old = W.fresh();
  W.trip(old.ctx);
  old.ctx.tgTripUpsert({ slug: W.TRIP, lodging: JSON.stringify({ text: 'Old Mill', nights: 3 }) });
  W.deliver(old.ctx, old.state, 'plan_digest', W.digest());
  old.ctx.__TEST_NOW = '2027-05-09T09:00:00Z';
  assert.deepEqual(shows(old.ctx, old.state), none);
  // …and a plan stored before this phase (no record at all): old lodging → no line; a lodging saved since → the line.
  old.ctx.settingSet('tg_plan_lodging', '{}', 'test');
  assert.deepEqual(shows(old.ctx, old.state), none);
  W.say(old.ctx, old.state, '/lodging Quay Rooms, 3 nights');
  assert.deepEqual(shows(old.ctx, old.state), all);
});

test('no line once no stored day is still to come, with no plan, or with no lodging change at all', () => {
  const { ctx, state } = W.fresh();
  W.trip(ctx);
  assert.equal(ctx.tgLgStaleLine(ctx.tgTripGet(W.TRIP)), '', 'no plan');
  W.say(ctx, state, '/lodging Reed Inn 2027-06-10 to 2027-06-12');
  W.deliver(ctx, state, 'plan_digest', W.digest({ lodging_fp: 'lfp1:00000000' }));
  assert.match(ctx.tgLgStaleLine(ctx.tgTripGet(W.TRIP)), STALE);
  // On the second day the rebuild offer names that day (the first stored day still to come).
  ctx.__TEST_NOW = '2027-06-11T06:00:00Z';
  assert.match(ctx.tgLgStaleLine(ctx.tgTripGet(W.TRIP)), /<code>\/replan 2027-06-11 &lt;why&gt;<\/code>/);
  ctx.__TEST_NOW = '2027-06-13T06:00:00Z';
  assert.equal(ctx.tgLgStaleLine(ctx.tgTripGet(W.TRIP)), '', 'every planned day is past');
  W.say(ctx, state, '/trip');
  assert.doesNotMatch(W.last(state), /different lodging/);
  // A plan with no lodging ever saved, no fingerprint anywhere → no line.
  const bare = W.fresh();
  W.planned(bare.ctx, bare.state);
  assert.deepEqual(shows(bare.ctx, bare.state), none);
});

test('plan_digest lodging_fp: the core accepts exactly ^lfp1:[0-9a-f]{8}$ and refuses the rest; the parts top keeps it', () => {
  const { ctx, state } = W.fresh();
  W.trip(ctx);
  assert.deepEqual(W.J(ctx.tgEnvValidatePlanDigest(W.digest({ lodging_fp: 'lfp1:0b6769ef' }))), []);
  ['lfp1:0B6769EF', 'lfp1:0b6769e', 'lfp1:0b6769eff', 'lfp2:0b6769ef', ' lfp1:0b6769ef', 'lfp1:0b6769ef\n', 'lfp1:0b6769eg', '', 5, null, ['lfp1:0b6769ef']]
    .forEach((v) => assert.ok(W.J(ctx.tgEnvValidatePlanDigest(W.digest({ lodging_fp: v }))).some((e) => /lodging_fp/.test(e)), JSON.stringify(v)));
  // A forged value in the wrong shape is refused with the whole digest; nothing is stored.
  const bad = W.deliver(ctx, state, 'plan_digest', W.digest({ lodging_fp: 'lfp1:<b>x</b>' }));
  assert.equal(bad.processed, 0);
  assert.equal(ctx.tgDigestDays(W.TRIP).length, 0);
  assert.equal(ctx.settingGet('tg_plan_lodging', ''), '');
  // A well-formed value that is not the core's fingerprint only makes the line show (the core trusts its own value).
  W.say(ctx, state, '/lodging Reed Inn 2027-06-10 to 2027-06-12');
  assert.equal(W.deliver(ctx, state, 'plan_digest', W.digest({ lodging_fp: 'lfp1:ffffffff' })).processed, 1);
  assert.deepEqual(shows(ctx, state), all);
  // Parts: the top field joins only when sent, so an old staged part compares unchanged.
  assert.equal(JSON.parse(ctx.tgPartsTop(W.digest({ parts: 2, lodging_fp: 'lfp1:0b6769ef' }))).lodging_fp, 'lfp1:0b6769ef');
  assert.equal('lodging_fp' in JSON.parse(ctx.tgPartsTop(W.digest({ parts: 2 }))), false);
});

test('the pack schema mirrors the core: lodging_fp on the plan digest top, scouted: true on a place', async () => {
  const S = await import('../packs/tour-guide/schemas/index.mjs');
  const ok = S.validatePayload('plan_digest', W.digest({ lodging_fp: 'lfp1:0b6769ef' }));
  assert.ok(ok.ok, S.formatErrors(ok.errors));
  ['lfp1:0B6769EF', 'lfp1:0b6769e', 'lfp2:0b6769ef', 5].forEach((v) => {
    const r = S.validatePayload('plan_digest', W.digest({ lodging_fp: v }));
    assert.ok(!r.ok && r.errors.some((e) => /lodging_fp/.test(e.path)), JSON.stringify(v));
  });
  const plan = require('../packs/tour-guide/schemas/tour-guide-plan-digest.schema.json');
  assert.deepEqual({ type: plan.properties.lodging_fp.type, pattern: plan.properties.lodging_fp.pattern }, { type: 'string', pattern: '^lfp1:[0-9a-f]{8}$' });
  assert.ok(!(plan.required || []).includes('lodging_fp'));
  const places = require('../packs/tour-guide/schemas/tour-guide-places-digest.schema.json');
  assert.equal(places.properties.places.items.properties.scouted.const, true);
});

// Developed by: LightAISolutions
