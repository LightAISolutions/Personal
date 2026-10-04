'use strict';
// tools/new-branch.mjs (WP-14a) — the branch scaffold and its --check. Branches are generated in a temporary copy laid
// out like the repo (<tmp>/helpers, plus <tmp>/live-site-pages when the repo has one): four shapes (everything; --no-tab;
// --no-envelope; --no-envelope --no-tab --no-app) each pass their own check, their own test, the bundle, the boundary check
// and the whole suite on that copy; a removed piece is named; every clash is refused; --dry-run writes nothing; --check
// scout passes on the real tree. Invented data only; no network.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const H = require('./harness/gas-mocks');

const REAL = H.HELPERS_ROOT;
const PAGES = path.join(REAL, '..', 'live-site-pages');   // outside helpers/: absent in a vendored copy, and then not copied
const made = [];
after(() => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });
const tmpDir = (tag) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'wp14a-' + tag + '-')); made.push(d); return d; };

/** A copy of helpers/ (this file left out, so the copy's suite run does not recurse) → the copy's helpers root. */
function copyTree(tag) {
  const dir = tmpDir(tag);
  fs.cpSync(REAL, path.join(dir, 'helpers'), { recursive: true });
  fs.rmSync(path.join(dir, 'helpers', 'tests', path.basename(__filename)), { force: true });
  if (fs.existsSync(PAGES)) fs.cpSync(PAGES, path.join(dir, 'live-site-pages'), { recursive: true });
  return path.join(dir, 'helpers');
}
const cleanEnv = () => { const e = { ...process.env }; delete e.NODE_TEST_CONTEXT; return e; };   // a nested node --test reports on its own
const node = (args, cwd) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8', env: cleanEnv(), timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
/** Run a copy's new-branch.mjs from the copy's repo root. → { code, out } */
function tool(root, args) {
  const r = node([path.join(root, 'tools', 'new-branch.mjs'), ...args], path.dirname(root));
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
/** status of one --check row ('ok' | 'missing' | 'not needed'), or undefined. */
const rowOf = (out, part) => (new RegExp(`^\\s+(ok|missing|not needed)\\s+${part.replace(/ /g, '\\s')}\\s`, 'm').exec(out) || [])[1];
/** path → sha1 of every file under dir. */
function snapshot(dir) {
  const out = {};
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else out[path.relative(dir, f)] = crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex'); } };
  walk(dir);
  return out;
}
/** The four branch shapes, all generated into one copy (one suite run covers them together). */
const SHAPES = { demo: [], notab: ['--no-tab'], noenv: ['--no-envelope'], bare: ['--no-envelope', '--no-tab', '--no-app'] };
const ENV_PARTS = ['envelope type', 'envelope handler', 'core validator', 'schema', 'pack validator', 'envelope tool', 'parity test'];
let W = null;
/** The shared copy: { root, pack, gas, before (helper.json before), written: { name: out } }. Tests in a file run in order. */
function world() {
  if (W) return W;
  const root = copyTree('world'), pack = path.join(root, 'packs', 'tour-guide');
  W = { root, pack, gas: path.join(pack, 'gas'), before: JSON.parse(fs.readFileSync(path.join(pack, 'helper.json'), 'utf8')), written: {} };
  for (const [name, flags] of Object.entries(SHAPES)) {
    const r = tool(root, [name, ...flags]);
    assert.equal(r.code, 0, r.out);
    W.written[name] = r.out;
  }
  return W;
}
const gasFile = (w, re) => fs.readdirSync(w.gas).find((f) => re.test(f));

test('four shapes are written and each passes its own --check on the copy; "not needed" for what a shape leaves out', () => {
  const w = world();
  for (const name of Object.keys(SHAPES)) {
    const r = tool(w.root, ['--check', name]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /\ncomplete\s*$/);
    assert.equal(rowOf(r.out, 'command'), 'ok', name);
    assert.equal(rowOf(r.out, 'kind routing'), 'ok', name);
  }
  const check = (name) => tool(w.root, ['--check', name]).out;
  const full = check('demo');
  for (const part of [...ENV_PARTS, 'tab', 'app ops']) assert.equal(rowOf(full, part), 'ok', 'demo ' + part);
  assert.equal(rowOf(check('notab'), 'tab'), 'not needed');
  assert.equal(rowOf(check('notab'), 'envelope handler'), 'ok');
  const noenv = check('noenv');
  for (const part of ENV_PARTS) assert.equal(rowOf(noenv, part), 'not needed', 'noenv ' + part);
  assert.equal(rowOf(noenv, 'tab'), 'ok');
  const bare = check('bare');
  for (const part of [...ENV_PARTS, 'tab', 'app ops']) assert.equal(rowOf(bare, part), 'not needed', 'bare ' + part);
  // --no-envelope: no schema, no pack validator, no parity test, no helper.json or PAYLOAD_KINDS entry
  const m = JSON.parse(fs.readFileSync(path.join(w.pack, 'helper.json'), 'utf8'));
  assert.deepEqual(m.envelope_types, [...w.before.envelope_types, 'demo', 'notab']);
  const idx = fs.readFileSync(path.join(w.pack, 'schemas', 'index.mjs'), 'utf8');
  for (const name of ['noenv', 'bare']) {
    assert.equal(fs.existsSync(path.join(w.pack, 'schemas', `tour-guide-${name}.schema.json`)), false, name);
    assert.equal(fs.existsSync(path.join(w.pack, name, `${name}-payload.mjs`)), false, name);
    assert.doesNotMatch(fs.readFileSync(path.join(w.root, 'tests', `pack_tour-guide_${name}.test.js`), 'utf8'), /parity/);
    assert.doesNotMatch(idx, new RegExp(`\\b${name}\\b`));
    assert.doesNotMatch(fs.readFileSync(path.join(w.gas, gasFile(w, new RegExp(`^\\d\\d_${name}\\.js$`))), 'utf8'), /registerEnvelopeHandler/);
  }
  // --no-tab: no registerSheet; the app ops read no tab of their own and say so
  for (const name of ['notab', 'bare']) assert.doesNotMatch(fs.readFileSync(path.join(w.gas, gasFile(w, new RegExp(`^\\d\\d_${name}\\.js$`))), 'utf8'), /registerSheet\(/);
  assert.match(fs.readFileSync(path.join(w.gas, gasFile(w, /^\d\d_notab_app\.js$/)), 'utf8'), /TODO \(--no-tab\)/);
  assert.equal(gasFile(w, /^\d\d_bare_app\.js$/), undefined, '--no-app writes no app file');
  // numbering: core modules in the 1x–2x band, then after 40; app files after 32_app_api.js; helper.json keeps its one-line layout
  for (const name of Object.keys(SHAPES)) assert.match(gasFile(w, new RegExp(`^\\d\\d_${name}\\.js$`)), /^([12]\d|4[1-9]|[5-9]\d)_/);
  for (const name of ['demo', 'notab', 'noenv']) assert.ok(Number(gasFile(w, new RegExp(`^\\d\\d_${name}_app\\.js$`)).slice(0, 2)) > 32);
  assert.match(fs.readFileSync(path.join(w.pack, 'helper.json'), 'utf8'), /"envelope_types": \[[^\n\]]*"demo", "notab"\]/);
});

test('on that copy: each branch\'s own test, bundle --all --check and the boundary check pass', () => {
  const w = world(), cwd = path.dirname(w.root);
  const t = node(['--test', ...Object.keys(SHAPES).map((n) => path.join('helpers', 'tests', `pack_tour-guide_${n}.test.js`))], cwd);
  assert.equal(t.status, 0, t.stdout + t.stderr);
  assert.match(t.stdout, /# fail 0/);
  const b = node([path.join('helpers', 'tools', 'bundle.mjs'), '--all', '--check'], cwd);
  assert.equal(b.status, 0, b.stdout + b.stderr);
  const c = node([path.join('helpers', 'tools', 'boundary-check.mjs')], cwd);
  assert.equal(c.status, 0, c.stdout + c.stderr);
});

/**
 * Tests outside WP-14a that pin the pack's exact type and kind lists: any new envelope type fails them until they read the
 * list from helper.json (REQUEST in helpers/status/WP-14a.md). They are the only failures allowed on the copy.
 */
const PINNED = [
  ['pack_tour-guide_payloads.test.js', 'PAYLOAD_KINDS maps exactly the manifest envelope_types'],
  ['pack_tour-guide_schemas.test.js', 'every kind has a schema file in the validator subset'],
  ['tools_envelope.test.js', 'output passes core validateEnvelope and uses the canonical file name']
];
test('the whole suite passes on the copy with all four branches (only the type-list pins of PINNED may fail)', () => {
  const w = world();
  const r = node(['--test', '--test-reporter=tap', path.join('helpers', 'tests') + path.sep], path.dirname(w.root));
  const out = r.stdout || '';
  assert.match(out, /# pass \d+/, (r.stderr || '').slice(0, 2000));
  const failed = [];
  const re = /^not ok \d+ - (.*)$/gm;
  for (let m; (m = re.exec(out));) {
    const loc = /location: '([^']*)'/.exec(out.slice(m.index, m.index + 4000));
    failed.push([loc ? path.basename(loc[1].replace(/:\d+:\d+$/, '')) : '?', m[1]]);
  }
  const unexpected = failed.filter(([f, name]) => !PINNED.some(([pf, pn]) => f === pf && name.indexOf(pn) === 0));
  assert.deepEqual(unexpected, [], 'unexpected failures on the copy');
  for (const n of Object.keys(SHAPES)) assert.ok(out.includes(`pack_tour-guide_${n}.test.js`) || out.includes(`${n}: the command`), n + ' ran');
});

test('the generated core and app modules load in the GAS harness of the copy', () => {
  const w = world();
  const CH = require(path.join(w.root, 'tests', 'harness', 'gas-mocks.js'));
  const { ctx } = CH.loadGas({ pack: 'tour-guide', now: '2027-05-01T12:00:00Z' });
  for (const n of Object.keys(SHAPES)) {
    assert.equal(typeof ctx.getCommand('/' + n), 'function', n);
    assert.equal(ctx.TG_KIND_ROUTINE[n], 'RESEARCH', n);
  }
  assert.ok(ctx.getEnvelopeHandler('demo') && ctx.getEnvelopeHandler('notab'));
  assert.equal(ctx.getEnvelopeHandler('noenv'), null);
  assert.ok(Object.keys(ctx.allSheetSchemas()).includes('Demos') && Object.keys(ctx.allSheetSchemas()).includes('Noenvs'));
  assert.ok(!Object.keys(ctx.allSheetSchemas()).some((t) => /^(Notabs|Bares)$/.test(t)));
  assert.deepEqual(['demo', 'notab', 'noenv'].map((n) => typeof ctx.TG_APP_OPS[n + '.get']), ['object', 'object', 'object']);
  assert.equal(ctx.TG_APP_OPS['bare.get'], undefined);
});
/** Change one file, run --check, put the file back. → the check's { code, out } */
function without(w, file, change, name) {
  const orig = fs.existsSync(file) ? fs.readFileSync(file) : null;
  try { change(file, orig && orig.toString('utf8')); return tool(w.root, ['--check', name]); } finally { if (orig !== null) fs.writeFileSync(file, orig); }
}
test('removing one piece makes --check fail (exit 1) naming it', () => {
  const w = world();
  const core = path.join(w.gas, gasFile(w, /^\d\d_demo\.js$/)), appf = path.join(w.gas, gasFile(w, /^\d\d_demo_app\.js$/));
  const rm = (f) => fs.rmSync(f);
  const edit = (from, to) => (f, s) => { assert.ok(s.includes(from), from); fs.writeFileSync(f, s.replace(from, to)); };
  const cases = [
    ['schema', path.join(w.pack, 'schemas', 'tour-guide-demo.schema.json'), rm],
    ['app ops', appf, rm],
    ['parity test', path.join(w.root, 'tests', 'pack_tour-guide_demo.test.js'), rm],
    ['pack validator', path.join(w.pack, 'demo', 'demo-payload.mjs'), edit('export function validateDemoPayload', 'function validateDemoPayload')],
    ['kind routing', core, edit("TG_KIND_ROUTINE['demo'] = 'RESEARCH';", '')],
    ['kind request', core, edit("tgOpenKindRequest('demo'", "tgOpenKindRequest('demox'")],
    ['command', core, edit("registerCommand('/demo'", "registerCommand('/demox'")],
    ['tab', core, edit("registerSheet(TG_DEMO.SHEET, ['id', 'trip', 'received_at', 'payload_json']);", '')],
    ['core validator', core, edit('function tgEnvValidateDemo(p)', 'function tgEnvValidateDemoX(p)')],
    ['envelope type', path.join(w.pack, 'helper.json'), edit('"demo", ', '')],
    ['envelope tool', path.join(w.pack, 'schemas', 'index.mjs'), edit("  demo: 'demo'", "  demox: 'demo'")]
  ];
  for (const [part, file, change] of cases) {
    const r = without(w, file, change, 'demo');
    assert.equal(r.code, 1, part + '\n' + r.out);
    assert.equal(rowOf(r.out, part), 'missing', part + '\n' + r.out);
    assert.match(r.out, new RegExp(`incomplete — missing: .*${part}`), part);
  }
  assert.equal(tool(w.root, ['--check', 'demo']).code, 0, 'every piece is back');
});

test('--no-tab and --no-envelope are read from the @branch line: removing the line makes --check name the missing tab', () => {
  const w = world();
  const notab = path.join(w.gas, gasFile(w, /^\d\d_notab\.js$/));
  const r = without(w, notab, (f, s) => fs.writeFileSync(f, s.replace(/^\/\/ @branch .*\n/m, '')), 'notab');
  assert.equal(r.code, 1, r.out);
  assert.equal(rowOf(r.out, 'tab'), 'missing');
  assert.match(r.out, /no @branch line: every part expected/);
  const bare = path.join(w.gas, gasFile(w, /^\d\d_bare\.js$/));
  const b = without(w, bare, (f, s) => fs.writeFileSync(f, s.replace(/^\/\/ @branch .*\n/m, '')), 'bare');
  assert.equal(b.code, 1);
  for (const part of ['envelope type', 'schema', 'tab', 'app ops']) assert.equal(rowOf(b.out, part), 'missing', part);
});

test('every clash is refused (exit 2, naming it) and nothing is written', () => {
  const w = world(), before = snapshot(path.dirname(w.root));
  const cases = [
    [['demo'], /the name "demo" is taken/],
    [['other', '--command', '/demo'], /command \/demo is already registered/],
    [['other', '--kind', 'demo'], /request kind "demo" is already used/],
    [['other', '--kind', 'scout'], /request kind "scout" is already used/],
    [['other', '--envelope', 'demo'], /envelope type "demo" already has a handler/],
    [['other', '--envelope', 'scout'], /envelope type "scout" already has a handler/],
    [['other', '--envelope', 'notice'], /envelope type "notice" is a core type/],
    [['other', '--tab', 'Demos'], /tab "Demos" already exists/],
    [['other', '--tab', 'Scouts'], /tab "Scouts" already exists/],
    [['other', '--tab', 'Trips'], /tab "Trips" already exists/],
    [['scout'], /command \/scout is already registered[\s\S]*the name "scout" is taken/],
    [['scout', '--force'], /--force rewrites only a branch new-branch wrote/],
    [['vegcard', '--force'], /--force rewrites only a branch new-branch wrote/],   // coordinator: a hand-built branch with an @branch line
    [['trip', '--command', '/tripx', '--kind', 'tripx', '--tab', 'Tripxs'], /identifier tgTripGet is already defined/],
    [['Bad'], /the name must match/],
    [['x'], /the name must match/],
    [['other', '--no-tab', '--tab', 'Others'], /--tab and --no-tab together/],
    [['other', '--prefix', '16'], /--prefix 16 is already used/],
    [['other', '--prefix', '00'], /--prefix must be 01–99/],
    [['other', '--bogus'], /unknown option --bogus/]
  ];
  for (const [args, re] of cases) {
    const r = tool(w.root, args);
    assert.equal(r.code, 2, args.join(' ') + '\n' + r.out);
    assert.match(r.out, re, args.join(' '));
  }
  assert.deepEqual(snapshot(path.dirname(w.root)), before);
});

test('--dry-run prints every file it would write or change and writes nothing; --force rewrites a generated branch identically', () => {
  const w = world(), before = snapshot(path.dirname(w.root)), priv = path.join(tmpDir('dry'), 'skills');
  const r = tool(w.root, ['other', '--dry-run', '--private-out', priv]);
  assert.equal(r.code, 0, r.out);
  for (const f of [/write {3}packs\/tour-guide\/gas\/\d\d_other\.js/, /write {3}packs\/tour-guide\/gas\/\d\d_other_app\.js/, /schemas\/tour-guide-other\.schema\.json/,
    /other\/other-payload\.mjs/, /other\/index\.mjs/, /other\/README\.md/, /other\/fixtures\/other-sample\.json/, /tests\/pack_tour-guide_other\.test\.js/,
    /change {2}packs\/tour-guide\/helper\.json/, /change {2}packs\/tour-guide\/schemas\/index\.mjs/, /other\/SKILL\.md/, /other-start\.mjs/, /other-finish\.mjs/]) assert.match(r.out, f);
  assert.deepEqual(snapshot(path.dirname(w.root)), before);
  assert.equal(fs.existsSync(priv), false);
  const f = tool(w.root, ['demo', '--force']);
  assert.equal(f.code, 0, f.out);
  assert.deepEqual(snapshot(path.dirname(w.root)), before, 'the same options write the same bytes');
});

test('--check scout passes on the real tree (a hand-built branch: every part expected, names read from its code)', () => {
  const r = node([path.join(REAL, 'tools', 'new-branch.mjs'), '--check', 'scout'], path.dirname(REAL));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /no @branch line: every part expected/);
  assert.match(r.stdout, /\ncomplete\s*$/);
  for (const part of ['command', 'kind request', 'kind routing', ...ENV_PARTS, 'tab', 'app ops']) assert.equal(rowOf(r.stdout, part), 'ok', part);
});
test('--private-out: the skill and its two drivers run in a private-repo layout; the printed envelope command passes tools/envelope.mjs --pack', () => {
  const w = world(), priv = tmpDir('priv'), scratch = tmpDir('scratch');
  const shapes = [['priv', [], 'priv'], ['privr', ['--no-envelope', '--no-tab', '--no-app'], 'reply']];
  for (const [name, flags] of shapes) { const g = tool(w.root, [name, ...flags, '--private-out', path.join(priv, 'skills')]); assert.equal(g.code, 0, g.out); }
  // the private repo vendors helpers/ as a real directory at vendor/helpers/ (a symlink would defeat the tools' "run as main" check)
  fs.cpSync(w.root, path.join(priv, 'vendor', 'helpers'), { recursive: true });
  for (const [name, , type] of shapes) {
    const dir = path.join(priv, 'skills', name), skill = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
    assert.match(skill, new RegExp(`^---\\nname: ${name}\\ndescription: `));
    for (const h of ['## Purpose', '## Inputs', '## Output', '## Memory', '## Silence rule', '## Safety']) assert.ok(skill.includes(h), name + ' ' + h);
    assert.ok(skill.includes(`"type":"${type}"`), name + ': the example is a ' + type + ' envelope');
    const req = path.join(scratch, `req_${name}.json`), input = path.join(scratch, `${name}-input.json`), judg = path.join(scratch, `${name}-judgment.json`);
    fs.writeFileSync(req, JSON.stringify({ v: 1, id: 'req-' + name + '-1', type: 'request', payload: { kind: name, trip: 'quillmere-2027', text: '/' + name } }));
    fs.writeFileSync(judg, JSON.stringify({ note: '  Two quiet   mornings by the reed beds. ' }));
    const s = node([path.join('skills', name, `${name}-start.mjs`), '--request', req, '--out', input], priv);
    assert.equal(s.status, 0, s.stdout + s.stderr);
    assert.deepEqual(JSON.parse(s.stdout), { ok: true, input, request_id: 'req-' + name + '-1', trip: 'quillmere-2027' });
    const inside = node([path.join('skills', name, `${name}-start.mjs`), '--request', req, '--out', path.join(priv, 'x.json')], priv);
    assert.equal(inside.status, 1, 'scratch output inside the repo is refused');
    const f = node([path.join('skills', name, `${name}-finish.mjs`), '--input', input, '--judgment', judg, '--out', path.join(scratch, `${name}-payload.json`)], priv);
    assert.equal(f.status, 0, f.stdout + f.stderr);
    const fin = JSON.parse(f.stdout);
    assert.equal(fin.command[2], type);
    const e = node(fin.command.slice(1), priv);
    assert.equal(e.status, 0, e.stdout + e.stderr);
    const env = JSON.parse(e.stdout);
    assert.deepEqual(env.errors, [], name);
    const content = JSON.parse(env.content);
    assert.equal(content.in_reply_to, 'req-' + name + '-1');
    assert.equal(content.producer, name);
    if (type === 'reply') assert.deepEqual(content.payload, { text: 'Two quiet mornings by the reed beds.' });
    else { assert.deepEqual(content.payload, { v: 1, trip: 'quillmere-2027', note: 'Two quiet mornings by the reed beds.' }); assert.equal(content.dedupe_key, name + ':req-' + name + '-1'); }
    const bad = node([path.join('skills', name, `${name}-start.mjs`), '--request', judg, '--out', input], priv);
    assert.equal(JSON.parse(bad.stdout).ok, false, 'a file that is not a request of the kind is refused');
  }
});

test('library: render nests sections and refuses unknown keys; helper.json and schemas/index.mjs edits keep their layout and are idempotent', async () => {
  const B = await import('../tools/new-branch.mjs');
  assert.equal(B.render('{{#A}}a{{#B}}b{{/B}}{{^B}}c{{/B}}{{/A}}{{^A}}d{{/A}}-{{X}}', { X: 1 }, { A: true, B: false }), 'ac-1');
  assert.throws(() => B.render('{{Y}}', {}, {}), /unknown key Y/);
  assert.throws(() => B.render('{{#Z}}z{{/Z}}', {}, {}), /unknown section Z/);
  const one = '{\n  "name": "x",\n  "envelope_types": ["a", "b"],\n  "scopes": []\n}\n';
  assert.equal(B.addEnvelopeType(one, 'c').text, one.replace('"b"]', '"b", "c"]'));
  assert.equal(B.addEnvelopeType(one, 'a').changed, false);
  const multi = '{\n  "envelope_types": [\n    "a",\n    "b"\n  ]\n}\n';
  assert.equal(B.addEnvelopeType(multi, 'c').text, '{\n  "envelope_types": [\n    "a",\n    "b",\n    "c"\n  ]\n}\n');
  assert.equal(B.addEnvelopeType('{"envelope_types":[]}', 'c').text, '{"envelope_types":["c"]}');
  const src = "const KINDS = Object.freeze({\n  'a': null\n});\nexport const PAYLOAD_KINDS = Object.freeze({\n  a: 'a'\n});\n";
  const once = B.addPayloadKind(src, 'new_type', 'new-type');
  assert.equal(once.text, "const KINDS = Object.freeze({\n  'a': null,\n  'new-type': null\n});\nexport const PAYLOAD_KINDS = Object.freeze({\n  a: 'a',\n  new_type: 'new-type'\n});\n");
  assert.equal(B.addPayloadKind(once.text, 'new_type', 'new-type').changed, false);
  assert.deepEqual(B.parseMarker('x\n// @branch demo command=/demo kind=demo envelope=- tab=- routine=RESEARCH app=-\n'),
    { name: 'demo', command: '/demo', kind: 'demo', envelope: '-', tab: '-', routine: 'RESEARCH', app: '-' });
  assert.equal(B.resolveOptions({ name: 'lists' }).tab, 'Lists', 'no double s');
  assert.equal(B.resolveOptions({ name: 'demo' }).tab, 'Demos');
});

// Developed by: LightAISolutions
