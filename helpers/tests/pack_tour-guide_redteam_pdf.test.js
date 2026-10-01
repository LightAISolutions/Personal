'use strict';
// Tour Guide pack — red-team I: PDF delivery (Step 3; WP-6a, helpers/decisions/TG-PHASE-6.md §1.1 I). The core reply's
// drive_file_ids → tgSendDocument; an over-size file → a link; plan_digest.drive.brochure_pdf → stored on the trip;
// /brochure and the 📄 button resend the stored PDF, or ask the brain once; a missing file or one outside the helper's
// Drive folder never crashes and is never attached. Mock Drive and Telegram only; files and names are invented.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const START = '2027-05-10T09:00:00Z';
const TRIP = 'harbor-town';
const J = (v) => JSON.parse(JSON.stringify(v));
const maps = (id) => 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=' + id;

function fresh() {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: START });
  H.bootstrap(ctx, state);
  ['CHAT', 'RESEARCH', 'PLAN', 'NOTES', 'BROCHURE', 'PREFS', 'PLACES'].forEach((r) => H.configureRoutine(ctx, state, r));
  return { ctx, state, k: state.props[ctx.PROP.WEBHOOK_SECRET] };
}
const post = (t, upd) => t.ctx.doPost(H.postEvent('tg', { k: t.k }, upd));
const say = (t, text) => post(t, H.tgUpdate({ text }));
const tap = (t, data) => post(t, H.tgUpdate({ callback: data }));
const sends = (t) => t.state.fetch.telegram('sendMessage').map((r) => r.json);
const texts = (t) => sends(t).map((m) => m.text);
const docs = (t) => t.state.fetch.telegram('sendDocument').map((r) => r.options.payload);
const reqs = (t, kind) => t.ctx.storeAll('Requests').filter((r) => !kind || r.kind === kind);
const audits = (t, ev) => t.ctx.storeAll('AuditLog').filter((a) => a.event === ev);
function drop(t, type, payload, over) { H.putEnvelope(t.state, H.envelope(type, payload, over)); return J(t.ctx.pollFromBrain()); }
const pdfIn = (t, name, content) => t.state.drive.putFile('TourGuide/Trips/' + TRIP, name || 'harbor-town-brochure.pdf', content || '%PDF-1.7 fixture brochure', 'application/pdf');
const stop = (n, slug) => ({ n, slug, name: slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), arrive: '10:00', depart: '11:00', minutes: 60, maps_url: maps('FixtureStop' + n), note_line: 'Go early.' });
const digest = (pdf) => ({ trip: TRIP, build_id: 'build-ht-9', verified_on: '2027-05-09',
  days: [{ date: '2027-05-12', theme: 'Quay', stops: [stop(1, 'tide-clock-museum')], legs: [], warnings: [] }],
  later: [], drive: { plan: null, brochure_html: null, brochure_pdf: pdf } });
/** The 📄 button of the newest message that has one. */
function brochureButton(t) {
  const kb = sends(t).filter((m) => m.reply_markup).map((m) => m.reply_markup.inline_keyboard.flat()).reverse();
  for (const row of kb) { const b = row.find((x) => /Brochure/.test(x.text)); if (b) return b.callback_data; }
  assert.fail('no 📄 Brochure button');
}

/* ---------------- tests ---------------- */
test('I1 reply with drive_file_ids → one sendDocument per file with the Drive blob, the label as an escaped HTML caption ≤ 1 024', () => {
  const t = fresh();
  say(t, 'please send the brochure and the plan');
  const [req] = reqs(t, 'message');
  const pdf = pdfIn(t), md = t.state.drive.putFile('TourGuide/Trips/' + TRIP, 'harbor-town-plan.md', '# fixture plan', 'text/markdown');
  const r = drop(t, 'reply', { text: 'Here you go <b>now</b>', drive_file_ids: { 'Brochure (v2).pdf': pdf.getId(), plan_md: md.getId() } }, { in_reply_to: req.id });
  assert.equal(r.processed, 1);
  const d = docs(t);
  assert.equal(d.length, 2);
  assert.deepEqual(d.map((p) => p.caption), ['Brochure (v2).pdf', 'plan_md']);
  assert.ok(d.every((p) => p.parse_mode === 'HTML' && p.caption.length <= 1024 && p.chat_id === '777'));
  assert.equal(d[0].document.getDataAsString(), '%PDF-1.7 fixture brochure', 'the Drive blob itself is attached');
  assert.equal(d[1].document.getDataAsString(), '# fixture plan');
  assert.match(texts(t).pop(), /Here you go &lt;b&gt;now&lt;\/b&gt;/, 'the reply text is escaped (html not set)');
});

test('I2 a file over DOCUMENT_MAX_BYTES → no document, a message with the Drive link, audit document_too_large; /brochure with an over-size stored PDF sends the link and asks nothing', () => {
  const t = fresh();
  say(t, 'brochure please');
  const [req] = reqs(t, 'message');
  const big = pdfIn(t, 'harbor-town-brochure-big.pdf');
  big.getSize = () => 60 * 1024 * 1024;
  const n = sends(t).length;
  drop(t, 'reply', { text: 'Done.', drive_file_ids: { brochure: big.getId() } }, { in_reply_to: req.id });
  assert.equal(docs(t).length, 0);
  const out = texts(t).slice(n);
  assert.ok(out.some((x) => x.includes('(60 MB, too large to attach)') && x.includes(big.getUrl())), out.join(' | '));
  assert.equal(audits(t, 'document_too_large').length, 1);
  t.ctx.tgTripUpsert({ slug: TRIP, destination: 'Harbor Town', status: 'planned', drive_brochure_pdf: big.getId() });
  t.ctx.settingSet('tg_current_trip', TRIP);
  say(t, '/brochure');
  assert.equal(docs(t).length, 0);
  assert.match(texts(t).pop(), /too large to attach/);
  assert.equal(reqs(t, 'brochure').length, 0, 'the link answered it; no rebuild');
});

test('I3 plan_digest with drive.brochure_pdf → stored on the trip (tgTripGet(...).drive_brochure_pdf)', () => {
  const t = fresh();
  const pdf = pdfIn(t);
  assert.equal(drop(t, 'plan_digest', digest(pdf.getId())).processed, 1);
  assert.equal(t.ctx.tgTripGet(TRIP).drive_brochure_pdf, pdf.getId());
});

test('I4 /brochure and the 📄 button with a stored PDF → sendDocument each time with an escaped caption ≤ 1 024, and zero brochure requests after two resends', () => {
  const t = fresh();
  const pdf = pdfIn(t);
  drop(t, 'plan_digest', digest(pdf.getId()));
  t.ctx.tgTripUpsert({ slug: TRIP, title: 'Harbor <Town> & "Quay" ' + 'x'.repeat(56) });
  t.ctx.settingSet('tg_current_trip', TRIP);
  say(t, '/brochure');
  say(t, '/trip');
  tap(t, brochureButton(t));
  const d = docs(t);
  assert.equal(d.length, 2, 'two resends');
  assert.equal(reqs(t, 'brochure').length, 0, 'zero brochure requests');
  for (const p of d) {
    assert.equal(p.document.getDataAsString(), '%PDF-1.7 fixture brochure');
    assert.equal(p.parse_mode, 'HTML');
    assert.ok(p.caption.length <= 1024);
    assert.match(p.caption, /^📄 <b>Harbor &lt;Town&gt; &amp; "Quay" x+<\/b> · checked on 2027-05-09$/);
  }
});

test('I5 /brochure with no stored PDF → exactly one brochure request (with the trip and build id), no document', () => {
  const t = fresh();
  drop(t, 'plan_digest', digest(null));
  t.ctx.settingSet('tg_current_trip', TRIP);
  say(t, '/brochure');
  const r = reqs(t, 'brochure');
  assert.equal(r.length, 1);
  const p = JSON.parse(t.state.drive.readFile('TourGuide/mailbox/to-brain', 'req_' + r[0].id + '.json')).payload;
  assert.deepEqual([p.trip, p.build_id], [TRIP, 'build-ht-9']);
  assert.equal(docs(t).length, 0);
  assert.match(texts(t).join('\n'), /📄 Building the brochure for harbor-town…/);
});

test('I6 the stored PDF is gone (Drive refuses the id) → a brochure request, never a crash; /brochure and the 📄 button alike', () => {
  const t = fresh();
  const pdf = pdfIn(t);
  drop(t, 'plan_digest', digest(pdf.getId()));
  pdf.setTrashed(true); pdf.parent.files = pdf.parent.files.filter((f) => f !== pdf);   // gone from Drive
  t.ctx.settingSet('tg_current_trip', TRIP);
  say(t, '/brochure');
  say(t, '/trip');
  tap(t, brochureButton(t));
  assert.equal(docs(t).length, 0);
  assert.equal(reqs(t, 'brochure').length, 2, 'each ask becomes a rebuild request');
  assert.equal(audits(t, 'document_not_found').length, 2, 'the core still records the missing file');
  assert.equal(audits(t, 'tg_update_error').length + audits(t, 'callback_error').length, 0, 'no crash');
});

test('I7 a stored brochure id that points outside the helper\'s Drive folder → never attached; a rebuild request and an audit row instead (FIXED)', () => {
  const t = fresh();
  const outside = t.state.drive.putFile('Elsewhere/Statements', 'bank-statement.pdf', '%PDF-1.7 not the helper\'s file', 'application/pdf');
  const deep = t.state.drive.putFile('TourGuide/Trips/' + TRIP + '/a/b/c', 'deep-brochure.pdf', '%PDF-1.7 deep', 'application/pdf');
  drop(t, 'plan_digest', digest(outside.getId()));
  assert.equal(t.ctx.tgTripGet(TRIP).drive_brochure_pdf, outside.getId(), 'the id passes the schema (any Drive id shape)');
  t.ctx.settingSet('tg_current_trip', TRIP);
  say(t, '/brochure');
  say(t, '/trip');
  tap(t, brochureButton(t));
  assert.equal(docs(t).length, 0, 'the outside file is never sent');
  assert.equal(reqs(t, 'brochure').length, 2);
  assert.equal(audits(t, 'tg_brochure_outside_root').length, 2);
  t.ctx.tgTripUpsert({ slug: TRIP, drive_brochure_pdf: deep.getId() });
  say(t, '/brochure');
  assert.equal(docs(t).length, 1, 'a file a few folders down inside TourGuide is still sent');
  assert.equal(t.ctx.tgCmdDriveWhere(outside.getId()), 'outside');
  assert.equal(t.ctx.tgCmdDriveWhere('fixtureMissingFile01'), 'missing');
});

test('suite hygiene: reset the harness clock to wall time so later files that build envelopes without a clock (tools_bundle) are not dated 2027', () => {
  // H.envelope() takes created_at from the most recent loadGas() clock; this file runs on fixed 2027 dates.
  const { ctx } = H.loadGas({ pack: 'hello' });
  assert.ok(Math.abs(new Date(H.envelope('greeting', {}).created_at).getTime() - Date.now()) < 60000);
  assert.ok(ctx.HELPER);
});

// Developed by: LightAISolutions
