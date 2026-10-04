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

test('a registered tab that is missing is created on first use (audited sheets_healed); a tab nobody registered still throws', () => {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  ctx.registerSheet('HelloLog', ['id', 'note']);
  H.bootstrap(ctx, state);
  const ss = ctx.getSpreadsheet();
  ss.deleteSheet(ss.getSheetByName('HelloLog'));
  ss.deleteSheet(ss.getSheetByName('Flows'));
  const row = ctx.storeAppend('HelloLog', { id: 'h1', note: 'kept' });   // threw "Sheet tab missing" before the fix
  assert.equal(row.note, 'kept');
  assert.deepEqual([...ctx.storeAll('HelloLog')].map((r) => r.id), ['h1']);
  assert.ok(ss.getSheetByName('Flows'), 'every registered tab is ensured in the same repair');
  const heal = ctx.storeAll('AuditLog').filter((r) => r.event === 'sheets_healed');
  assert.equal(heal.length, 1);
  assert.equal(heal[0].ref, 'HelloLog');
  assert.deepEqual(JSON.parse(heal[0].detail_json).created.sort(), ['Flows', 'HelloLog']);
  assert.throws(() => ctx.getSheet('NobodyRegisteredThis'), /Sheet tab missing: NobodyRegisteredThis/);
});

test('a write naming a registered column the tab lacks adds the column first: append and update keep the field', () => {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  ctx.registerSheet('HelloLog', ['id', 'note', 'tz']);
  H.bootstrap(ctx, state);
  const sh = ctx.getSheet('HelloLog');
  sh.getRange(1, 3, 1, 1).setValues([['']]);                              // a tab made before the tz column existed
  const a = ctx.storeAppend('HelloLog', { id: 'h1', note: 'n', tz: 'Asia/Tokyo', stray: 'not registered' });
  assert.equal(a.tz, 'Asia/Tokyo', 'appended, not dropped');
  assert.equal(a.stray, undefined, 'unregistered keys are still ignored');
  assert.equal(ctx.storeGet('HelloLog', 'h1').tz, 'Asia/Tokyo');
  sh.getRange(1, 4, 1, 1).setValues([['']]);                              // lose it again, then update
  const u = ctx.storeUpdateById('HelloLog', 'h1', { tz: 'Europe/Paris' });
  assert.equal(u.tz, 'Europe/Paris');
  assert.deepEqual([...ctx.sheetHeaders(sh)].filter(Boolean), ['id', 'note', 'tz']);
});

test('ensureSheets never overwrites a header after a blank header cell, and tolerates a tab another run created meanwhile', () => {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  H.bootstrap(ctx, state);
  const ss = ctx.getSpreadsheet();
  const req = ss.getSheetByName('Requests');
  req.getRange(1, 3, 1, 1).setValues([['']]);                             // 'kind' blanked in the middle of the row
  ctx.ensureSheets();
  const head = [...ctx.sheetHeaders(req)];
  assert.equal(head[head.length - 1], 'kind', 'the missing header goes after the last one');
  assert.deepEqual(head.filter(Boolean).sort(), [...ctx.SHEET_HEADERS.Requests].sort(), 'no header was overwritten');
  ss.deleteSheet(ss.getSheetByName('Flows'));
  const insert = ss.insertSheet.bind(ss);
  ss.insertSheet = (n) => { insert(n); throw new Error('A sheet with the name "' + n + '" already exists.'); };   // the other run won
  assert.deepEqual([...ctx.ensureSheets()], []);
  assert.deepEqual([...ctx.sheetHeaders(ss.getSheetByName('Flows'))], [...ctx.SHEET_HEADERS.Flows]);
});

test('a deploy that registers a new tab or column: the first run after it creates them, once (SHEET_SCHEMA)', () => {
  const first = H.loadGas({ pack: 'hello' });
  H.bootstrap(first.ctx, first.state);
  const before = first.state.props[first.ctx.PROP.SHEET_SCHEMA];
  assert.ok(before, 'ensureSheets records the schema it ensured');
  // The next execution runs newer code: one more tab, one more column on a core tab. Setup is not re-run.
  const { ctx, state } = H.loadGas({ pack: 'hello', state: first.state });
  ctx.registerSheet('NewTab', ['id', 'value']);
  ctx.registerSheet('Requests', ['answered_by']);
  ctx.storeAll('Settings');                                               // any first read opens the Sheet
  const ss = ctx.getSpreadsheet();
  assert.deepEqual([...ctx.sheetHeaders(ss.getSheetByName('NewTab'))], ['id', 'value']);
  assert.equal(ctx.sheetHeaders(ss.getSheetByName('Requests')).slice(-1)[0], 'answered_by');
  assert.notEqual(state.props[ctx.PROP.SHEET_SCHEMA], before);
  assert.equal(ctx.syncSheetSchemas(ss), false, 'nothing to do once recorded');
  assert.equal(ctx.storeAll('AuditLog').filter((r) => r.event === 'sheets_healed').length, 0, 'the deploy sync is not a repair');
});

test('Settings keep text as text: a date, a time, TRUE and digits read back exactly even where Sheets types what it is given', () => {
  const { ctx, state } = H.loadGas({ pack: 'hello', tz: 'America/Los_Angeles' });
  H.bootstrap(ctx, state);
  ctx.getSpreadsheet().autoType = true;                                   // the mock now types "2026-10-04" as a date cell, like Sheets
  ctx.storeAppend('Queue', { id: 'q1', kind: 'x', status: 'new', claimed_at: '2026-10-04' });
  assert.notEqual(ctx.storeGet('Queue', 'q1').claimed_at, '2026-10-04', 'the emulation is on: other tabs get typed cells');
  const vals = { d: '2026-10-04', t: 'TRUE', n: '0042', s: 'plain' };
  Object.keys(vals).forEach((k) => ctx.settingSet(k, vals[k]));
  Object.keys(vals).forEach((k) => assert.equal(ctx.settingGet(k), vals[k], k));
  ctx.settingSet('d', '2026-10-05');                                     // an update rewrites the whole row
  assert.equal(ctx.settingGet('d'), '2026-10-05');
  assert.equal(ctx.settingGet('t'), 'TRUE');
  assert.equal(ctx.storeAppend('Settings', { key: 'num', value: 7 }).value, 7, 'numbers stay numbers');
});

// Developed by: LightAISolutions
