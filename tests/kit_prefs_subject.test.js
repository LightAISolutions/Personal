'use strict';
// kits/prefs — a profile about one named person (a companion's): the subject in the heading, the opening line and the
// /profile count line, and `refresh` re-rendering a kit profile from the ledger alone. Without a subject nothing changes.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const KIT = path.join(__dirname, '..', 'kits', 'prefs');
const load = () => import('../kits/prefs/index.mjs');
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(KIT, 'fixtures', name), 'utf8'));
const NOW = '2026-09-20T10:00:00Z';

const made = [];
after(() => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });
async function seeded() {
  const m = await load();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prefs-subject-'));
  made.push(dir);
  const t = { held: path.join(dir, 'held'), profile: path.join(dir, 'out', 'companion.md') };
  m.ingest({ vocab: 'travel', held: t.held, evidence: fixture('evidence-sample.json') });
  return { m, t };
}
const read = (f) => fs.readFileSync(f, 'utf8');
const lines = (text) => text.split('\n');
/** Everything after the heading and the two opening lines, without the trailer: the sections. */
const sections = (text) => lines(text).slice(4, -2).join('\n');

test('profileSubject and profileTitle: one plain line, no Markdown that opens a block, blank means none', async () => {
  const m = await load();
  const v = m.loadVocab('travel');
  assert.equal(m.profileTitle(v), v.title);
  assert.equal(m.profileTitle(v, 'Robin'), `Robin — ${v.title}`);
  assert.equal(m.profileSubject('  Ro#bin\n<b>  '), 'Ro bin b');
  assert.equal(m.profileSubject("Ana-Lu O'Neil"), "Ana-Lu O'Neil", 'hyphens and apostrophes stay');
  assert.equal(m.profileSubject('莉子'), '莉子');
  for (const blank of [null, undefined, '', '   ', '#`*']) assert.equal(m.profileSubject(blank), null, JSON.stringify(blank));
  assert.equal(m.profileSubject('x'.repeat(100)).length, 60);
});

test('apply with a subject: the heading and opening line name the person; the sections and trailer rules are unchanged', async () => {
  const plain = await seeded(), named = await seeded();
  const r1 = plain.m.apply({ vocab: 'travel', held: plain.t.held, profile: plain.t.profile, decisions: fixture('decisions-sample.json') });
  const r2 = named.m.apply({ vocab: 'travel', held: named.t.held, profile: named.t.profile, decisions: fixture('decisions-sample.json'), subject: 'Robin' });
  assert.ok(r1.ok && r2.ok);
  const a = read(plain.t.profile), b = read(named.t.profile);
  assert.deepEqual(lines(a).slice(0, 3), ['# Travel profile', '', 'Owner-confirmed preferences, written by the prefs kit from the owner\'s own decisions only. To change an entry,'], 'no subject: as before');
  assert.deepEqual(lines(b).slice(0, 3), ['# Robin — Travel profile', '', 'Preferences confirmed for Robin, written by the prefs kit from confirmed decisions only. To change an entry,']);
  assert.equal(lines(a)[3], lines(b)[3]);
  assert.equal(sections(a), sections(b), 'the same entries, lines and provenance');
  const v = named.m.loadVocab('travel');
  assert.equal(named.m.checkProfileFile(b, v), null, 'the kit may overwrite its own named profile');
  // a profile written before the subject existed is accepted, then renamed by the next apply
  const again = plain.m.apply({ vocab: 'travel', held: plain.t.held, profile: plain.t.profile, decisions: fixture('decisions-sample.json'), subject: 'Robin' });
  assert.ok(again.ok, again.errors.join('; '));
  assert.equal(read(plain.t.profile), b, 'replaying already-applied decisions with a subject writes the named profile');
});

test('interview with a subject: the profile heading and the /profile count line name the person', async () => {
  const { m, t } = await seeded();
  const r = m.interview({ vocab: 'travel', bank: 'travel', held: t.held, profile: t.profile, answers: fixture('interview-answers-sample.json'), now: NOW, subject: 'Robin' });
  assert.ok(r.ok, r.errors.join('; '));
  assert.ok(r.applied.length > 0);
  assert.match(r.profile_summary, /^Robin — Travel profile: \d+ confirmed preferences?\.\n/);
  assert.equal(lines(read(t.profile))[0], '# Robin — Travel profile');
  const v = m.loadVocab('travel');
  assert.match(m.profileSummary({ entries: {} }, v), /^Travel profile: no confirmed preferences yet\.$/, 'no subject: as before');
});

test('refresh: re-renders a kit profile from the ledger alone, writes only on change, refuses missing or hand-edited files', async () => {
  const { m, t } = await seeded();
  assert.deepEqual(m.refresh({ vocab: 'travel', profile: t.profile, subject: 'Robin' }),
    { ok: false, errors: ['no profile to refresh; a profile is first written by apply'], changed: false, profile_entries: null });
  assert.ok(m.apply({ vocab: 'travel', held: t.held, profile: t.profile, decisions: fixture('decisions-sample.json') }).ok);
  const before = read(t.profile);
  const same = m.refresh({ vocab: 'travel', profile: t.profile });
  assert.deepEqual(same, { ok: true, errors: [], changed: false, profile_entries: 4 }, 'nothing new: no write');
  const named = m.refresh({ vocab: 'travel', profile: t.profile, subject: 'Robin' });
  assert.equal(named.changed, true);
  const after = read(t.profile);
  assert.equal(lines(after)[0], '# Robin — Travel profile');
  assert.equal(sections(after), sections(before));
  assert.equal(m.refresh({ vocab: 'travel', profile: t.profile, subject: 'Robin' }).changed, false, 'idempotent');
  fs.writeFileSync(t.profile, after.replace('# Robin', '# Robin (edited)'));
  const refused = m.refresh({ vocab: 'travel', profile: t.profile, subject: 'Robin' });
  assert.equal(refused.ok, false);
  assert.match(refused.errors[0], /edited by hand/);
  assert.equal(read(t.profile), after.replace('# Robin', '# Robin (edited)'), 'a hand-edited profile is left as it is');
});

test('CLI: apply and refresh take --subject', async () => {
  const { m, t } = await seeded();
  const dec = path.join(path.dirname(t.held), 'decisions.json');
  fs.writeFileSync(dec, JSON.stringify(fixture('decisions-sample.json')));
  const out = [], err = [];
  const code = m.main(['apply', '--vocab', 'travel', '--held', t.held, '--profile', t.profile, '--subject', 'Robin', dec], (s) => out.push(s), (s) => err.push(s));
  assert.equal(code, 0, err.join('\n'));
  assert.equal(lines(read(t.profile))[0], '# Robin — Travel profile');
  const code2 = m.main(['refresh', '--vocab', 'travel', '--profile', t.profile, '--subject', 'Sam'], (s) => out.push(s), (s) => err.push(s));
  assert.equal(code2, 0, err.join('\n'));
  assert.equal(JSON.parse(out[1]).changed, true);
  assert.equal(lines(read(t.profile))[0], '# Sam — Travel profile');
  assert.equal(m.main(['refresh', '--vocab', 'travel'], () => {}, () => {}), 2, 'missing --profile is a usage error');
});

// Developed by: LightAISolutions
