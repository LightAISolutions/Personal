'use strict';
// Tour Guide — the Takeout fetch, core half (TG-PHASE-14 WP-14f, 28_lists.js): ?route=takeout (list the owner's newest
// Takeout exports, hand one part's exact bytes to the routine under a request's upload key), the daily check that opens
// one `lists` request for a new export, /lists sync looking for an export first, the /lists lines and /lists auto.
// Invented data only (made-up archives and stamps); no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const H = require('./harness/gas-mocks');

const PACK_DIR = path.join(H.HELPERS_ROOT, 'packs', 'tour-guide');
const FIX = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'lists', 'fixtures', 'lists-sample.json'), 'utf8'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'helper.json'), 'utf8'));
const NOW = '2027-05-01T12:00:00Z';
const J = (v) => JSON.parse(JSON.stringify(v));
const TO_BRAIN = MANIFEST.drive_root + '/mailbox/to-brain';

function fresh(o = {}) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW, manifest: MANIFEST });
  H.bootstrap(ctx, state);
  H.configureRoutine(ctx, state, 'RESEARCH');
  if (o.trip !== false) ctx.tgTripUpsert(FIX.trip);
  return { ctx, state };
}
const say = (ctx, state, text) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, H.tgUpdate({ text })));
const texts = (state) => state.fetch.telegram('sendMessage').map((r) => r.json.text);
const requests = (state) => (state.drive.listFiles(TO_BRAIN) || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile(TO_BRAIN, n)));
const post = (ctx, body) => JSON.parse(ctx.doPost(H.postEvent('takeout', {}, body)).content);
/** n invented bytes, different per seed (the content of a made-up archive part). */
const bytesOf = (seed, n) => Buffer.from(Array.from({ length: n }, (_, i) => (i * 37 + seed.charCodeAt(0) * 11 + seed.length) % 256));
/** Open a request of `kind` and read its upload key from the request file, as the routine would. */
function openKind(ctx, state, kind) {
  const r = ctx.openRequest({ kind, text: kind, chat: null });
  const file = JSON.parse(state.drive.readFile(TO_BRAIN, `req_${r.id}.json`));
  return { id: r.id, key: file.payload.upload_key };
}
function deliver(ctx, state, type, payload, over) {
  H.putEnvelope(state, H.envelope(type, payload, over));
  return J(ctx.pollFromBrain());
}
/**
 * Every folder and file in the mock Drive outside the helper's own folder (whose mailbox changes as requests open), trashed
 * or not: kind, path, trashed flag, parent and a content hash.
 */
function snapshot(state) {
  const out = [];
  const walk = (f) => {
    if (f.parent && !f.parent.parent && f.name === MANIFEST.drive_root) return;
    out.push(['D', f.path(), f.trashed, f.parent ? f.parent.id : null]);
    f.files.forEach((x) => out.push(['F', x.path(), x.trashed, x.parent.id, crypto.createHash('sha1').update(x.bytes || Buffer.from(x.content, 'utf8')).digest('hex')]));
    f.folders.forEach(walk);
  };
  walk(state.drive.root);
  return JSON.stringify(out);
}
/** A Drive with four exports in the root Takeout folder (one in a direct subfolder) and the files the route must not see. */
function stockDrive(state) {
  const P = {
    a1: bytesOf('a1', 1200), b1: bytesOf('b1', 2048), b2: bytesOf('b2', 512), c1: bytesOf('c1', 700), d1: bytesOf('d1', 90)
  };
  H.putTakeout(state, 'takeout-20270301T080000Z-001.zip', P.a1, { created: '2027-03-01T08:20:00Z' });
  H.putTakeout(state, 'takeout-20270420T101500Z-002.tgz', P.b2, { created: '2027-04-20T10:31:00Z' });   // the second part first
  H.putTakeout(state, 'takeout-20270420T101500Z-001.tgz', P.b1, { created: '2027-04-20T10:30:00Z' });
  H.putTakeout(state, 'takeout-20270425T090000Z-2-001.zip', P.c1, { folder: 'Takeout/Older', created: '2027-04-25T09:05:00Z' });
  H.putTakeout(state, 'takeout-20270101T000000Z-001.zip', P.d1, { created: '2027-01-01T00:10:00Z' });   // the fourth: capped
  // Invisible: outside a root Takeout folder, too deep, trashed, a non-matching name, in a trashed subfolder.
  H.putTakeout(state, 'takeout-20270430T000000Z-001.zip', bytesOf('x1', 10), { folder: '' });
  H.putTakeout(state, 'takeout-20270430T000001Z-001.zip', bytesOf('x2', 10), { folder: 'Elsewhere/Takeout' });
  H.putTakeout(state, 'takeout-20270430T000002Z-001.zip', bytesOf('x3', 10), { folder: 'Takeout/Older/Deeper' });
  H.putTakeout(state, 'takeout-20270430T000003Z-001.zip', bytesOf('x4', 10), { trashed: true });
  H.putTakeout(state, 'notes-20270430T000004Z-001.zip', bytesOf('x5', 10));
  H.putTakeout(state, 'takeout-20270430T000005Z-001.rar', bytesOf('x6', 10));
  H.putTakeout(state, 'takeout-20270430T000006Z-001.zip', bytesOf('x7', 10), { folder: 'Takeout/Bin' });
  state.drive.findFolder('Takeout/Bin').setTrashed(true);
  return P;
}

/* ---------------- registration ---------------- */
test('takeout: the route (POST, no router auth, no lock), the daily job and the constants are registered', () => {
  const { ctx } = fresh();
  const r = ctx.getRoute('takeout');
  assert.deepEqual(J(r.methods), ['POST']);
  assert.equal(r.auth, 'none');
  assert.equal(r.lock, false);
  assert.equal(typeof ctx.HB_REGISTRY.daily.tg_lists_takeout, 'function');
  assert.deepEqual(J(ctx.TG_LISTS.TAKEOUT_KINDS), ['lists', 'research']);
  assert.equal(ctx.TG_LISTS.TAKEOUT_EXPORTS_MAX, 3);
  assert.equal(ctx.TG_LISTS.TAKEOUT_PART_MAX_BYTES, 10 * 1024 * 1024);
  assert.equal(ctx.TG_LISTS.TAKEOUT_EXPORT_MAX_BYTES, 30 * 1024 * 1024);
  assert.equal(ctx.TG_LISTS.TAKEOUT_GETS_MAX, 10);
  const get = JSON.parse(ctx.doGet(H.getEvent('takeout')).content);
  assert.equal(get.reason, 'method_not_allowed');
});

/* ---------------- op: list ---------------- */
test('takeout list: newest first, parts grouped and ordered, capped at three, sizes and created; hidden files stay hidden; Drive untouched', () => {
  const { ctx, state } = fresh();
  const P = stockDrive(state);
  const { id, key } = openKind(ctx, state, 'lists');
  const before = snapshot(state);
  const r = post(ctx, { req: id, key, op: 'list' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.exports, [
    { stamp: '20270425T090000Z', created: '2027-04-25T09:05:00.000Z', bytes: P.c1.length, parts: [{ name: 'takeout-20270425T090000Z-2-001.zip', bytes: P.c1.length }], too_large: false },
    { stamp: '20270420T101500Z', created: '2027-04-20T10:30:00.000Z', bytes: P.b1.length + P.b2.length,
      parts: [{ name: 'takeout-20270420T101500Z-001.tgz', bytes: P.b1.length }, { name: 'takeout-20270420T101500Z-002.tgz', bytes: P.b2.length }], too_large: false },
    { stamp: '20270301T080000Z', created: '2027-03-01T08:20:00.000Z', bytes: P.a1.length, parts: [{ name: 'takeout-20270301T080000Z-001.zip', bytes: P.a1.length }], too_large: false }
  ]);
  assert.equal(snapshot(state), before, 'listing changes nothing in Drive');
  // req_ prefix works; a research request may list too; no export → an empty array.
  assert.equal(post(ctx, { req: 'req_' + id, key, op: 'list' }).exports.length, 3);
  const res = openKind(ctx, state, 'research');
  assert.equal(post(ctx, { req: res.id, key: res.key, op: 'list' }).ok, true);
  const empty = fresh();
  const e = openKind(empty.ctx, empty.state, 'lists');
  assert.deepEqual(post(empty.ctx, { req: e.id, key: e.key, op: 'list' }), { ok: true, exports: [] });
});

test('takeout list: the same stamp with and without a middle number are two exports; the middle number sorts within a stamp', () => {
  const { ctx, state } = fresh();
  H.putTakeout(state, 'takeout-20270420T101500Z-3-001.zip', bytesOf('m3', 5));
  H.putTakeout(state, 'takeout-20270420T101500Z-12-001.zip', bytesOf('m12', 6));
  H.putTakeout(state, 'takeout-20270420T101500Z-12-002.zip', bytesOf('m12b', 7));
  const { id, key } = openKind(ctx, state, 'lists');
  const r = post(ctx, { req: id, key, op: 'list' });
  assert.deepEqual(r.exports.map((x) => x.parts.map((p) => p.name)), [
    ['takeout-20270420T101500Z-12-001.zip', 'takeout-20270420T101500Z-12-002.zip'], ['takeout-20270420T101500Z-3-001.zip']]);
  assert.deepEqual(r.exports.map((x) => x.bytes), [13, 5]);
});

test('takeout list: an export over 30 MB in all, or with a part over 10 MB, is flagged too_large', () => {
  const { ctx, state } = fresh();
  const MB = 1024 * 1024;
  H.putTakeout(state, 'takeout-20270420T101500Z-001.zip', Buffer.alloc(10 * MB + 1));
  H.putTakeout(state, 'takeout-20270410T101500Z-001.zip', Buffer.alloc(9 * MB));
  H.putTakeout(state, 'takeout-20270410T101500Z-002.zip', Buffer.alloc(9 * MB));
  H.putTakeout(state, 'takeout-20270410T101500Z-003.zip', Buffer.alloc(9 * MB));
  H.putTakeout(state, 'takeout-20270410T101500Z-004.zip', Buffer.alloc(4 * MB));
  H.putTakeout(state, 'takeout-20270401T101500Z-001.zip', Buffer.alloc(10 * MB));
  const { id, key } = openKind(ctx, state, 'lists');
  const r = post(ctx, { req: id, key, op: 'list' });
  assert.deepEqual(r.exports.map((x) => [x.stamp, x.too_large]), [['20270420T101500Z', true], ['20270410T101500Z', true], ['20270401T101500Z', false]]);
  // A part over 10 MB cannot be fetched.
  const g = post(ctx, { req: id, key, op: 'get', name: 'takeout-20270420T101500Z-001.zip' });
  assert.deepEqual([g.ok, g.status, g.reason], [false, 413, 'too_large']);
});

/* ---------------- op: get ---------------- */
test('takeout get: base64 of the exact bytes, its size and date; audited; the eleventh get is refused; Drive untouched', () => {
  const { ctx, state } = fresh();
  const P = stockDrive(state);
  const { id, key } = openKind(ctx, state, 'lists');
  const before = snapshot(state);
  const g = post(ctx, { req: id, key, op: 'get', name: 'takeout-20270420T101500Z-002.tgz' });
  assert.equal(g.ok, true);
  assert.equal(g.name, 'takeout-20270420T101500Z-002.tgz');
  assert.equal(g.bytes, P.b2.length);
  assert.equal(g.created, '2027-04-20T10:31:00.000Z');
  assert.ok(Buffer.from(g.data, 'base64').equals(P.b2), 'the decoded data is the file, byte for byte');
  const c = post(ctx, { req: id, key, op: 'get', name: 'takeout-20270425T090000Z-2-001.zip' });
  assert.ok(Buffer.from(c.data, 'base64').equals(P.c1), 'a part in a direct subfolder');
  const au = J(ctx.storeAll('AuditLog')).filter((x) => x.event === 'takeout_get');
  assert.equal(au.length, 2);
  assert.equal(au[0].ref, id);
  assert.deepEqual(JSON.parse(au[0].detail_json), { name: 'takeout-20270420T101500Z-002.tgz', bytes: P.b2.length });
  assert.equal(snapshot(state), before, 'a get changes nothing in Drive');
  // Names that are not a listed export's part: the capped fourth export, a trashed file, one outside, a path.
  for (const name of ['takeout-20270101T000000Z-001.zip', 'takeout-20270430T000003Z-001.zip', 'takeout-20270430T000000Z-001.zip',
    'takeout-20270430T000002Z-001.zip', '../takeout-20270301T080000Z-001.zip', '', undefined]) {
    const r = post(ctx, { req: id, key, op: 'get', name });
    assert.deepEqual([r.ok, r.status, r.reason], [false, 404, 'unknown_file'], String(name));
  }
  // Ten gets per request in all: eight more succeed, the eleventh is refused before the read.
  for (let i = 0; i < 8; i++) assert.equal(post(ctx, { req: id, key, op: 'get', name: 'takeout-20270301T080000Z-001.zip' }).ok, true, 'get ' + (i + 3));
  const over = post(ctx, { req: id, key, op: 'get', name: 'takeout-20270301T080000Z-001.zip' });
  assert.deepEqual([over.ok, over.status, over.reason], [false, 429, 'too_many_gets']);
  assert.equal(J(ctx.storeAll('AuditLog')).filter((x) => x.event === 'takeout_get').length, 10);
  // Another request has its own count.
  const other = openKind(ctx, state, 'lists');
  assert.equal(post(ctx, { req: other.id, key: other.key, op: 'get', name: 'takeout-20270301T080000Z-001.zip' }).ok, true);
  assert.equal(snapshot(state), before);
});

/* ---------------- refusals ---------------- */
test('takeout refusals, in order, each with its status and reason; audited per request after the key, once per 6 h before it', () => {
  const { ctx, state } = fresh();
  stockDrive(state);
  const before = snapshot(state);
  const lists = openKind(ctx, state, 'lists');
  const r = (body) => { const x = post(ctx, body); return [x.ok, x.status, x.reason]; };
  const ok = { req: lists.id, key: lists.key, op: 'list' };

  assert.deepEqual(r({ ...ok, req: 'not-a-request' }), [false, 400, 'bad_request_id']);
  assert.deepEqual(r({ ...ok, req: 12345 }), [false, 400, 'bad_request_id']);
  assert.deepEqual(r({ ...ok, key: 'f'.repeat(64) }), [false, 403, 'bad_key']);
  assert.deepEqual(r({ ...ok, key: undefined }), [false, 403, 'bad_key']);
  assert.deepEqual(r({ ...ok, key: openKind(ctx, state, 'lists').key }), [false, 403, 'bad_key'], 'another request\'s key');
  const ghost = crypto.randomUUID();
  assert.deepEqual(r({ req: ghost, key: ctx.uploadKey(ghost), op: 'list' }), [false, 404, 'unknown_request']);
  const msg = openKind(ctx, state, 'message');
  assert.deepEqual(r({ req: msg.id, key: msg.key, op: 'list' }), [false, 403, 'wrong_kind']);
  const scout = openKind(ctx, state, 'scout');
  assert.deepEqual(r({ req: scout.id, key: scout.key, op: 'get', name: 'takeout-20270301T080000Z-001.zip' }), [false, 403, 'wrong_kind']);
  assert.deepEqual(r({ ...ok, op: 'delete' }), [false, 400, 'bad_op']);
  assert.deepEqual(r({ ...ok, op: undefined }), [false, 400, 'bad_op']);
  // Not set up comes first, before anything is read.
  const sheet = state.props[ctx.PROP.SHEET_ID];
  delete state.props[ctx.PROP.SHEET_ID];
  assert.deepEqual(r({ ...ok, req: 'garbage' }), [false, 503, 'not_set_up']);
  state.props[ctx.PROP.SHEET_ID] = sheet;
  ctx._HB_SS_CACHE = null;

  // Answered: still served for an hour, then closed.
  assert.equal(deliver(ctx, state, 'reply', { text: 'Read your lists.' }, { in_reply_to: lists.id }).processed, 1);
  ctx.__TEST_NOW = '2027-05-01T12:59:00Z';
  assert.equal(post(ctx, ok).ok, true, 'answered 59 minutes ago');
  ctx.__TEST_NOW = '2027-05-01T13:01:00Z';
  assert.deepEqual(r(ok), [false, 403, 'request_closed']);
  // Too old: an open request past REQUEST_MAX_AGE_HOURS.
  const old = openKind(ctx, state, 'research');
  ctx.__TEST_NOW = new Date(Date.parse('2027-05-01T13:01:00Z') + (ctx.LIMITS.REQUEST_MAX_AGE_HOURS * 3600 + 60) * 1000).toISOString();
  assert.deepEqual(r({ req: old.id, key: old.key, op: 'list' }), [false, 403, 'request_too_old']);

  const audits = J(ctx.storeAll('AuditLog')).filter((x) => x.event === 'takeout_refused');
  const by = (reason) => audits.filter((a) => JSON.parse(a.detail_json).reason === reason);
  assert.equal(by('bad_request_id').length, 1, 'twice refused, audited once');
  assert.equal(by('bad_key').length, 1, 'three times refused, audited once');
  assert.equal(by('bad_request_id')[0].ref, '');
  assert.deepEqual(by('unknown_request').map((a) => a.ref), [ghost]);
  assert.deepEqual(by('wrong_kind').map((a) => a.ref), [msg.id, scout.id]);
  assert.equal(by('bad_op').length, 2, 'after the key: every refusal');
  assert.deepEqual(by('request_closed').map((a) => a.ref), [lists.id]);
  assert.deepEqual(by('request_too_old').map((a) => a.ref), [old.id]);
  assert.equal(snapshot(state), before, 'no refusal touches Drive');
});

/* ---------------- the daily check ---------------- */
test('daily check: off, never_synced, none, seen, open and opened; opens one lists request with the trip, the stamp and auto', () => {
  const { ctx, state } = fresh();
  const daily = () => ctx.tgListsTakeoutDaily();
  H.putTakeout(state, 'takeout-20270301T080000Z-001.zip', bytesOf('a', 40));
  assert.equal(daily(), 'never_synced', 'no lists request answered yet: the routine side may not answer one');
  assert.equal(requests(state).length, 0);

  // A first, manual sync, answered.
  say(ctx, state, '/lists sync');
  const first = requests(state)[0];
  assert.equal(first.payload.takeout, '20270301T080000Z');
  assert.equal(deliver(ctx, state, 'reply', { text: 'Read 3 lists.' }, { in_reply_to: first.id }).processed, 1);
  assert.equal(daily(), 'seen', 'the export /lists sync read is seen');

  ctx.settingSet('lists_auto', 'off');
  H.putTakeout(state, 'takeout-20270420T101500Z-001.zip', bytesOf('b', 50));
  assert.equal(daily(), 'off');
  ctx.settingSet('lists_auto', 'on');

  // A lists request still open: nothing new is opened.
  ctx.tgListsOpen({});
  assert.equal(daily(), 'open');
  const openRow = J(ctx.storeAll('Requests')).find((x) => x.kind === 'lists' && x.status === 'open');
  deliver(ctx, state, 'reply', { text: 'Nothing new.' }, { in_reply_to: openRow.id });
  const n = J(ctx.storeAll('Requests')).length;

  const sent = texts(state).length;
  assert.equal(daily(), 'opened');
  assert.equal(J(ctx.storeAll('Requests')).length, n + 1, 'one request more');
  const reqs = requests(state);   // the open request files (answered ones are archived by the sweep)
  const auto = reqs.find((x) => x.payload.auto === true);
  assert.equal(auto.payload.kind, 'lists');
  assert.equal(auto.payload.takeout, '20270420T101500Z');
  assert.equal(auto.payload.trip, FIX.trip.slug);
  assert.equal(J(ctx.storeAll('Requests')).find((x) => x.id === auto.id).routine, 'RESEARCH');
  assert.equal(ctx.settingGet('lists_takeout_seen'), '20270420T101500Z');
  assert.match(texts(state).slice(sent).join('\n'), /new saved-lists export/i, 'the owner hears that it is being read');
  assert.equal(daily(), 'seen', 'the next day: the export it opened a request for is seen');

  // No export at all (trashed by the owner): none.
  const b = fresh();
  b.ctx.tgListsOpen({});
  const row = J(b.ctx.storeAll('Requests'))[0];
  deliver(b.ctx, b.state, 'reply', { text: 'No export.' }, { in_reply_to: row.id });
  assert.equal(b.ctx.tgListsTakeoutDaily(), 'none');
  // No trip: the automatic request has none.
  const c = fresh({ trip: false });
  c.ctx.tgListsOpen({});
  deliver(c.ctx, c.state, 'reply', { text: 'Ok.' }, { in_reply_to: J(c.ctx.storeAll('Requests'))[0].id });
  H.putTakeout(c.state, 'takeout-20270420T101500Z-001.zip', bytesOf('c', 10));
  assert.equal(c.ctx.tgListsTakeoutDaily(), 'opened');
  assert.equal('trip' in requests(c.state).find((x) => x.payload.auto).payload, false);
});

test('daily check: a Drive failure is audited and returns error; the other daily jobs still run', () => {
  const { ctx, state } = fresh();
  ctx.tgListsOpen({});
  deliver(ctx, state, 'reply', { text: 'Ok.' }, { in_reply_to: J(ctx.storeAll('Requests'))[0].id });
  ctx.DriveApp.getRootFolder = () => { throw new Error('Drive is down'); };
  assert.equal(ctx.tgListsTakeoutDaily(), 'error');
  assert.ok(J(ctx.storeAll('AuditLog')).some((a) => a.event === 'tg_lists_takeout_error'));
  ctx.settingSet('last_daily_date', '');
  const r = J(ctx.runDailyJobs());
  assert.equal(r.tg_lists_takeout, 'error');
  assert.ok('core_prune_queue' in r, 'the other jobs ran');
});

/* ---------------- the chat ---------------- */
test('/lists sync: no export → how to make one, no request; an export → the request carries its stamp and it is seen', () => {
  let { ctx, state } = fresh();
  say(ctx, state, '/lists sync');
  const out = texts(state).pop();
  assert.match(out, /takeout\.google\.com/);
  assert.match(out, /Deselect all/);
  assert.match(out, /<b>Saved<\/b>/);
  assert.match(out, /Add to Drive/);
  assert.match(out, /Export every 2 months/);
  assert.match(out, /\.zip or \.tgz/);
  assert.equal(requests(state).length, 0, 'nothing opened without an export');
  assert.equal(ctx.settingGet('lists_takeout_seen'), '');

  H.putTakeout(state, 'takeout-20270420T101500Z-7-001.zip', bytesOf('s', 20));
  H.putTakeout(state, 'takeout-20270301T080000Z-001.zip', bytesOf('t', 20));
  say(ctx, state, '/lists sync');
  const reqs = requests(state);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].payload.kind, 'lists');
  assert.equal(reqs[0].payload.trip, FIX.trip.slug);
  assert.equal(reqs[0].payload.takeout, '20270420T101500Z');
  assert.equal('auto' in reqs[0].payload, false);
  assert.match(texts(state).join('\n'), /Reading your newest saved-lists export/);
  assert.equal(ctx.settingGet('lists_takeout_seen'), '20270420T101500Z-007', 'the group key: stamp and the padded middle number');
});

test('/lists: the newest export in Drive (date, size) or the how-to; once a request was answered, whether new exports are read automatically', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/lists');
  let out = texts(state).pop();
  assert.match(out, /No saved-lists export in Drive yet/);
  assert.match(out, /takeout\.google\.com/);
  assert.doesNotMatch(out, /automatic/i, 'nothing about automatic reading before a first answered sync');

  H.putTakeout(state, 'takeout-20270420T101500Z-001.zip', Buffer.alloc(3 * 1024 + 10), { created: '2027-04-20T23:30:00Z' });
  H.putTakeout(state, 'takeout-20270420T101500Z-002.zip', Buffer.alloc(1536 * 1024));
  say(ctx, state, '/lists');
  out = texts(state).pop();
  assert.match(out, /Newest export in Drive: 2027-04-20, 1\.5 MB/);

  say(ctx, state, '/lists sync');
  deliver(ctx, state, 'reply', { text: 'Read.' }, { in_reply_to: requests(state)[0].id });
  say(ctx, state, '/lists');
  assert.match(texts(state).pop(), /New exports are read automatically — \/lists auto off to stop/);
  say(ctx, state, '/lists auto off');
  assert.match(texts(state).pop(), /off/i);
  assert.equal(ctx.settingGet('lists_auto'), 'off');
  say(ctx, state, '/lists');
  assert.match(texts(state).pop(), /Automatic reading is off — \/lists auto on to resume/);
  say(ctx, state, '/lists AUTO On');
  assert.match(texts(state).pop(), /automatically/i);
  assert.equal(ctx.settingGet('lists_auto'), 'on');
  say(ctx, state, '/lists auto sometimes');
  assert.match(texts(state).pop(), /Usage: \/lists auto on · \/lists auto off/);
  say(ctx, state, '/lists auto');
  assert.match(texts(state).pop(), /Usage: \/lists auto on · \/lists auto off/);
  assert.equal(ctx.settingGet('lists_auto'), 'on');
  // The help line names auto.
  assert.ok(J(ctx.HB_REGISTRY.help).some((l) => l.indexOf('/lists — ') === 0 && /auto/.test(l)));
});

test('/lists: the export line is in the owner\'s zone and a small export reads in KB', () => {
  const { ctx, state } = fresh({ trip: false });
  state.props[ctx.PROP.TIMEZONE] = 'Pacific/Auckland';
  H.putTakeout(state, 'takeout-20270420T101500Z-001.tgz', Buffer.alloc(700), { created: '2027-04-20T13:30:00Z' });
  say(ctx, state, '/lists');
  assert.match(texts(state).pop(), /Newest export in Drive: 2027-04-21, 1 KB/);
});

// Developed by: LightAISolutions
