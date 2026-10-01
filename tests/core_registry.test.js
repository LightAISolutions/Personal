'use strict';
// 02_registry.js — the only extension point: validation, duplicates, allowlist gating.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

test('registries reject duplicates, bad names and unknown types', () => {
  const { ctx } = H.loadGas({ manifest: { name: 'reg', envelope_types: ['alert'], action_allowlist: ['reg_do'] } });
  assert.throws(() => ctx.registerCommand('/ping', () => {}), /duplicate "\/ping"/);
  assert.throws(() => ctx.registerCommand('ping', () => {}), /bad command/);
  assert.throws(() => ctx.registerCommand('/ok', 'nope'), /handler must be a function/);
  assert.throws(() => ctx.registerCallback('a', () => {}), /duplicate "a"/);
  assert.throws(() => ctx.registerCallback('Bad', () => {}), /prefix must match/);
  assert.throws(() => ctx.registerEnvelopeHandler('greeting', () => ({})), /unknown envelope type "greeting"/);
  assert.throws(() => ctx.registerEnvelopeHandler('alert', { validate: () => [] }), /need handle/);
  assert.throws(() => ctx.registerEnvelopeHandler('notice', () => ({})), /duplicate "notice"/);
  assert.throws(() => ctx.registerAction('other_do', { validate: () => [], preview: () => '', execute: () => ({}) }), /not in ACTION_ALLOWLIST/);
  assert.throws(() => ctx.registerAction('reg_do', { validate: () => [] }), /need \{validate, preview, execute\}/);
  assert.throws(() => ctx.registerQueueHandler('Bad-Kind', () => {}), /bad kind/);
  assert.throws(() => ctx.registerSetupStep('s', { run: () => 'x' }), /need \{label, run\}/);
  assert.throws(() => ctx.registerSheet('T', []), /headers\[\] required/);
});

test('manifest types and actions can be registered; registerSheet merges columns; help lines accumulate', () => {
  const { ctx } = H.loadGas({ manifest: { name: 'reg', envelope_types: ['alert'], action_allowlist: ['reg_do'] } });
  ctx.registerEnvelopeHandler('alert', (env) => ({ got: env.id }));
  assert.equal(typeof ctx.getEnvelopeHandler('alert').handle, 'function');
  ctx.registerAction('reg_do', { validate: () => [], preview: () => 'p', execute: () => ({ summary: 'done' }) });
  assert.ok(ctx.getActionDef('reg_do'));
  assert.deepEqual([...ctx.registerSheet('Extra', ['a', 'b'])], ['a', 'b']);
  assert.deepEqual([...ctx.registerSheet('Extra', ['b', 'c'])], ['a', 'b', 'c']);
  assert.deepEqual([...ctx.registerSheet('Requests', ['note'])], ['note']);
  assert.deepEqual([...ctx.allSheetSchemas().Requests].slice(-1), ['note'], 'pack columns are appended to a core tab');
  const before = ctx.HB_REGISTRY.help.length;
  ctx.registerCommand('/zz', () => {}, 'zz help');
  ctx.registerHelp('extra line');
  assert.equal(ctx.HB_REGISTRY.help.length, before + 2);
  assert.ok(ctx.HB_REGISTRY.help.includes('/zz — zz help'));
  assert.deepEqual([...ctx.registryKeys('daily')], ['core_prune_mailbox', 'core_prune_queue']);
});

// Developed by: LightAISolutions
