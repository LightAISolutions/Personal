'use strict';
// 02_registry.js registerRoute + 10_router.js registered-route dispatch: methods, auth none | admin | webapp, JSON errors, daily cap.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

function fresh() {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  H.bootstrap(ctx, state);
  ctx.__TEST_NOW = '2026-10-02T12:00:00Z';
  return { ctx, state, k: state.props[ctx.PROP.ADMIN_SECRET] };
}
const J = (out) => JSON.parse(out.content);
const audits = (ctx, ev) => ctx.storeAll('AuditLog').filter((x) => x.event === ev);

test('registerRoute refuses core names, bad names, bad methods, bad auth, GET on a webapp route and duplicates', () => {
  const { ctx } = fresh();
  const ok = { methods: ['POST'], auth: 'none', handler: () => ({ status: 200, body: { ok: true } }) };
  for (const name of ['tg', 'wake', 'setup', 'health', 'upload']) assert.throws(() => ctx.registerRoute(name, ok), /core route/, name);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.CORE_ROUTES)), ['tg', 'wake', 'setup', 'health', 'upload']);
  assert.throws(() => ctx.registerRoute('Bad Name', ok), /name must match/);
  assert.throws(() => ctx.registerRoute('x', { ...ok, methods: [] }), /methods/);
  assert.throws(() => ctx.registerRoute('x', { ...ok, methods: ['PUT'] }), /methods/);
  assert.throws(() => ctx.registerRoute('x', { ...ok, auth: 'owner' }), /auth must be/);
  assert.throws(() => ctx.registerRoute('x', { ...ok, auth: 'webapp', methods: ['GET', 'POST'] }), /POST only/);
  assert.throws(() => ctx.registerRoute('x', { methods: ['GET'], auth: 'none' }), /handler/);
  ctx.registerRoute('x', ok);
  assert.throws(() => ctx.registerRoute('x', ok), /duplicate/);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.registryKeys('route'))), ['x']);
});

test('unknown routes: POST → 404 JSON (audited), GET → health; a core name planted in the registry is never looked up', () => {
  const { ctx, state } = fresh();
  assert.deepEqual(J(ctx.doPost(H.postEvent('nope', {}, {}))), { ok: false, status: 404, reason: 'not_found' });
  assert.equal(audits(ctx, 'route_unknown').length, 1);
  assert.equal(J(ctx.doGet(H.getEvent('nope'))).app, 'hello');
  const planted = { methods: ['GET', 'POST'], auth: 'none', handler: () => ({ status: 200, body: { planted: true } }) };
  ctx.HB_REGISTRY.route.health = planted;
  ctx.HB_REGISTRY.route.upload = planted;
  assert.equal(ctx.getRoute('health'), null);
  assert.equal(ctx.getRoute('upload'), null);
  assert.equal(J(ctx.doPost(H.postEvent('health', {}, {}))).reason, 'not_found');
  assert.equal(J(ctx.doGet(H.getEvent('health'))).planted, undefined);
  assert.equal(J(ctx.doPost(H.postEvent('upload', {}, {}))).planted, undefined); // the core upload route answers, not the plant
  // prototype-named routes resolve to nothing: GET → health, POST → 404, and the AuditLog grows by one row per name, not per request
  const before = audits(ctx, 'doGet_error').length + audits(ctx, 'doPost_error').length;
  for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']) {
    assert.equal(ctx.getRoute(name), null);
    assert.equal(J(ctx.doGet(H.getEvent(name))).app, 'hello');
    assert.deepEqual(J(ctx.doPost(H.postEvent(name, {}, {}))), { ok: false, status: 404, reason: 'not_found' });
    assert.deepEqual(J(ctx.doPost(H.postEvent(name, {}, {}))), { ok: false, status: 404, reason: 'not_found' });
  }
  assert.equal(audits(ctx, 'doGet_error').length + audits(ctx, 'doPost_error').length, before);
  assert.equal(audits(ctx, 'route_unknown').length, 2 + 5);   // 'nope', the planted 'health' POST, then one row per prototype name
  assert.equal(JSON.stringify(state.props).includes('planted'), false);
});

test('auth none: GET and POST reach the handler with params and parsed body; bad JSON, oversize body, wrong method and throws are JSON errors', () => {
  const { ctx } = fresh();
  const seen = [];
  ctx.registerRoute('echo', { methods: ['GET', 'POST'], auth: 'none', handler: (req) => { seen.push(req); return { status: 200, body: { ok: true, method: req.method, q: req.params.q || '', body: req.body } }; } });
  ctx.registerRoute('post-only', { methods: ['POST'], auth: 'none', handler: () => ({ status: 201, body: { made: true } }) });
  ctx.registerRoute('boom', { methods: ['GET'], auth: 'none', handler: () => { throw new Error('secret detail'); } });
  ctx.registerRoute('bare', { methods: ['GET'], auth: 'none', handler: () => undefined });
  ctx.registerRoute('teapot', { methods: ['GET'], auth: 'none', handler: () => ({ status: 418 }) });
  assert.deepEqual(J(ctx.doGet(H.getEvent('echo', { q: 'hi' }))), { ok: true, method: 'GET', q: 'hi', body: {} });
  assert.deepEqual(J(ctx.doPost(H.postEvent('echo', {}, { a: 1 }))), { ok: true, method: 'POST', q: '', body: { a: 1 } });
  assert.equal(seen[1].user, null);
  assert.deepEqual(J(ctx.doPost(H.postEvent('echo', {}, 'not json'))), { ok: false, status: 400, reason: 'bad_json' });
  assert.deepEqual(J(ctx.doPost(H.postEvent('echo', {}, '[1,2]'))), { ok: false, status: 400, reason: 'bad_json' });
  assert.deepEqual(J(ctx.doPost(H.postEvent('echo', {}, '{"a":"' + 'x'.repeat(ctx.LIMITS.ROUTE_BODY_MAX_CHARS) + '"}'))), { ok: false, status: 400, reason: 'body_too_large' });
  assert.deepEqual(J(ctx.doGet(H.getEvent('post-only'))), { ok: false, status: 405, reason: 'method_not_allowed' });
  assert.deepEqual(J(ctx.doPost(H.postEvent('post-only', {}, {}))), { made: true, ok: false, status: 201, reason: 'bad_request' }, 'a non-200 status fills ok/status/reason');
  const b = J(ctx.doGet(H.getEvent('boom')));
  assert.deepEqual(b, { ok: false, status: 500, reason: 'internal' });
  assert.equal(audits(ctx, 'route_error').length, 1);
  assert.match(audits(ctx, 'route_error')[0].detail_json, /secret detail/, 'the detail is audited, not answered');
  assert.deepEqual(J(ctx.doGet(H.getEvent('bare'))), { ok: true });
  assert.deepEqual(J(ctx.doGet(H.getEvent('teapot'))), { ok: false, status: 418, reason: 'bad_request' });
  assert.equal(ctx.doGet(H.getEvent('boom')).mime, 'JSON');
});

test('auth admin: ?k=ADMIN_SECRET gates the handler; a wrong key is 403 and audited once per window', () => {
  const { ctx, k } = fresh();
  ctx.registerRoute('adm', { methods: ['GET', 'POST'], auth: 'admin', handler: () => ({ status: 200, body: { ok: true, admin: true } }) });
  assert.deepEqual(J(ctx.doGet(H.getEvent('adm', { k }))), { ok: true, admin: true });
  assert.deepEqual(J(ctx.doPost(H.postEvent('adm', { k }, {}))), { ok: true, admin: true });
  assert.deepEqual(J(ctx.doGet(H.getEvent('adm', { k: 'wrong' }))), { ok: false, status: 403, reason: 'forbidden' });
  assert.deepEqual(J(ctx.doGet(H.getEvent('adm'))), { ok: false, status: 403, reason: 'forbidden' });
  assert.equal(audits(ctx, 'route_auth_fail').length, 1, 'one audit row per window, not per attempt');
});

test('auth webapp: initData in the POST body is verified before the handler; 403 without it, on a stranger or a tampered string', () => {
  const { ctx, state } = fresh();
  const seen = [];
  ctx.registerRoute('app', { methods: ['POST'], auth: 'webapp', handler: (req) => { seen.push(req); return { status: 200, body: { ok: true, op: req.body.op, uid: req.user.id, sp: req.start_param } }; } });
  assert.deepEqual(J(ctx.doPost(H.postEvent('app', {}, { op: 'home' }))), { ok: false, status: 403, reason: 'forbidden' });
  assert.deepEqual(J(ctx.doPost(H.postEvent('app', {}, { op: 'home', initData: 'garbage' }))), { ok: false, status: 403, reason: 'forbidden' });
  assert.deepEqual(J(ctx.doPost(H.postEvent('app', {}, { op: 'home', initData: H.initData(ctx, state, { userId: 42 }) }))), { ok: false, status: 403, reason: 'forbidden' });
  const good = H.initData(ctx, state, { startParam: 'core_1' });
  assert.deepEqual(J(ctx.doPost(H.postEvent('app', {}, { op: 'home', initData: good.replace('core_1', 'core_2') }))), { ok: false, status: 403, reason: 'forbidden' });
  assert.equal(seen.length, 0, 'the handler never ran');
  const reasons = audits(ctx, 'route_auth_fail').map((a) => JSON.parse(a.detail_json).reason).sort();
  assert.deepEqual(JSON.parse(JSON.stringify(reasons)), ['bad_hash', 'malformed', 'missing', 'not_owner']);
  assert.doesNotMatch(audits(ctx, 'route_auth_fail').map((a) => a.detail_json).join(''), /hash=|TESTTOKEN/);
  assert.deepEqual(J(ctx.doPost(H.postEvent('app', {}, { op: 'home', initData: good }))), { ok: true, op: 'home', uid: 777, sp: 'core_1' });
  assert.equal(seen[0].auth_date, Math.floor(state.now() / 1000));
  assert.equal(seen[0].body.initData, good, 'the body reaches the handler as sent');
  assert.deepEqual(H.appPost(ctx, state, 'app', { op: 'x' }), { ok: true, op: 'x', uid: 777, sp: '' }, 'the harness helper signs for the owner');
  assert.deepEqual(J(ctx.doGet(H.getEvent('app'))), { ok: false, status: 405, reason: 'method_not_allowed' });
});

test('daily cap: MAX_APP_CALLS_PER_DAY (property over LIMITS default 2000) answers 429 daily_cap, audited once a day', () => {
  const { ctx, state } = fresh();
  assert.equal(ctx.LIMITS.MAX_APP_CALLS_PER_DAY, 2000);
  assert.equal(ctx.PROP.MAX_APP_CALLS_PER_DAY, ctx.propName('MAX_APP_CALLS_PER_DAY'));
  ctx.registerRoute('app', { methods: ['POST'], auth: 'webapp', handler: () => ({ status: 200, body: { ok: true } }) });
  state.props[ctx.PROP.MAX_APP_CALLS_PER_DAY] = '2';
  assert.equal(H.appPost(ctx, state, 'app', { op: 'a' }).ok, true);
  assert.equal(H.appPost(ctx, state, 'app', { op: 'a' }).ok, true);
  assert.equal(ctx.settingDailyCount('app_calls'), 2);
  for (let i = 0; i < 3; i++) assert.deepEqual(H.appPost(ctx, state, 'app', { op: 'a' }), { ok: false, status: 429, reason: 'daily_cap' });
  assert.equal(audits(ctx, 'app_cap_reached').length, 1);
  assert.equal(ctx.settingDailyCount('app_calls'), 2, 'refused calls are not counted');
  assert.equal(H.appPost(ctx, state, 'app', { op: 'a' }, { userId: 9 }).reason, 'forbidden', 'strangers hit auth, not the counter');
  ctx.__TEST_NOW = '2026-10-03T12:00:00Z';
  assert.equal(H.appPost(ctx, state, 'app', { op: 'a' }).ok, true, 'a new local day resets the count');
  assert.equal(ctx.settingDailyCount('app_calls'), 1);
});

// Developed by: LightAISolutions
