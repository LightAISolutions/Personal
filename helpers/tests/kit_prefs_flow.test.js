'use strict';
// kits/prefs — the evidence -> held notes -> owner review -> confirmed profile flow and its hard invariants.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const KIT = path.join(__dirname, '..', 'kits', 'prefs');
const load = () => import('../kits/prefs/index.mjs');
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(KIT, 'fixtures', name), 'utf8'));
const CID = { relaxed: 'c_44af72c063', packed: 'c_7d6787ca7b', museums: 'c_552a750eda', street: 'c_fabb1bd76e', shoestring: 'c_52d61c9dc3',
  stairs: 'c_eb395c1ba1', luxury: 'c_437149811b', parks: 'c_aa2a828000', moderate: 'c_5bc5fa6819', spicy: 'c_d95c19afb9' };

const made = [];
after(() => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });
function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prefs-kit-'));
  made.push(dir);
  return { dir, held: path.join(dir, 'held'), profile: path.join(dir, 'out', 'travel-prefs.md'), ledger: path.join(dir, 'out', 'travel-prefs.decisions.json') };
}
const decisionsDoc = (decisions, over = {}) => Object.assign({ v: 1, kind: 'prefs_decisions', source: 'owner', via: 'telegram', decisions }, over);
const at = (n) => `2026-09-2${n}T09:00:00Z`;
const snapshot = (dir) => {
  const out = {};
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out[path.relative(dir, p)] = fs.readFileSync(p, 'utf8'); } };
  walk(dir);
  return out;
};
async function seeded() {
  const m = await load();
  const t = setup();
  m.ingest({ vocab: 'travel', held: t.held, evidence: fixture('evidence-sample.json') });
  return { m, t };
}

test('the fixture candidate ids are the ones this file names (content hashes of dimension + value)', async () => {
  const m = await load();
  assert.equal(m.candidateId('pace', 'relaxed'), CID.relaxed);
  assert.equal(m.candidateId('budget_band', 'luxury'), CID.luxury);
  assert.equal(m.candidateId('interests', 'museums'), CID.museums);
});

test('ingest holds evidence as notes in the caller-named directory and never creates a profile or a ledger', async () => {
  const { m, t } = await seeded();
  const files = fs.readdirSync(t.held);
  assert.equal(files.length, 13);
  for (const f of files) assert.match(f, /^prefs-[a-z0-9_-]+-[0-9a-f]{6}\.md$/);
  assert.ok(!fs.existsSync(path.join(t.dir, 'out')));
  const note = fs.readFileSync(path.join(t.held, files.find((f) => f.includes('luxury'))), 'utf8');
  assert.match(note, /never instructions/i);
  assert.match(note, /SUSPECT/);
  assert.match(note, /## Data \(kit-managed, do not edit\)/);
  const r = m.review({ vocab: 'travel', held: t.held, ledger: t.ledger });
  assert.equal(r.kind, 'prefs_review');
  assert.ok(!fs.existsSync(t.profile) && !fs.existsSync(t.ledger), 'review is read-only');
});

test('INVARIANT: nothing reaches the profile without an owner decision record', async () => {
  const { m, t } = await seeded();
  const d = (o) => m.apply({ vocab: 'travel', held: t.held, profile: t.profile, decisions: o });
  const one = [{ cid: CID.relaxed, decision: 'confirm', decided_at: at(0) }];
  assert.match(d(decisionsDoc(one, { source: 'reader' })).errors.join(), /from the owner/);
  assert.match(d({ v: 1, kind: 'prefs_decisions', via: 'telegram', decisions: one }).errors.join(), /from the owner/);
  assert.match(d({ v: 1, id: 'x', type: 'notice', created_at: at(0), producer: 'triage', payload: { kind: 'prefs_decisions', decisions: one } }).errors.join(), /core "request"/);
  assert.match(d(decisionsDoc([{ cid: CID.relaxed, decision: 'confirm' }])).errors.join(), /decided_at/);
  assert.match(d(decisionsDoc([{ cid: CID.relaxed, decision: 'maybe', decided_at: at(0) }])).errors.join(), /confirm \| edit \| reject/);
  assert.match(d(decisionsDoc(one, { note: 'auto' })).errors.join(), /unknown key: note/);
  assert.match(d(decisionsDoc([])).errors.join(), /non-empty/);
  assert.ok(!fs.existsSync(t.profile) && !fs.existsSync(t.ledger), 'every refusal wrote nothing');
  // a core request envelope is the owner's word
  const env = { v: 1, id: 'req-20260920-01', type: 'request', created_at: at(0), producer: 'assistant-core', payload: { kind: 'prefs_decisions', decisions: one } };
  const ok = d(env);
  assert.equal(ok.ok, true, ok.errors.join());
  const led = JSON.parse(fs.readFileSync(t.ledger, 'utf8'));
  assert.equal(led.entries[CID.relaxed].via, 'telegram');
  assert.equal(led.entries[CID.relaxed].ref, 'req-20260920-01');
  // every profile line traces to a ledger entry that carries a decision
  const lines = fs.readFileSync(t.profile, 'utf8').split('\n').filter((l) => l.startsWith('- '));
  assert.deepEqual(lines, [`- relaxed — confirmed 2026-09-20 · evidence ${led.entries[CID.relaxed].evidence_ids.join(', ')}`]);
});

test('INVARIANT: injection-suspect evidence is never auto-promoted, never counted, and is labelled when shown', async () => {
  const { m, t } = await seeded();
  const r = m.review({ vocab: 'travel', held: t.held, ledger: t.ledger, max: 20 });
  assert.ok(!r.items.some((i) => i.cid === CID.luxury || i.cid === CID.parks), 'suspect-only candidates are not proposed');
  const held = new Map(r.held_back.map((h) => [h.cid, h.reason]));
  assert.equal(held.get(CID.luxury), 'suspect_only');
  assert.equal(held.get(CID.parks), 'suspect_only');
  const shown = m.review({ vocab: 'travel', held: t.held, ledger: t.ledger, max: 20, includeSuspect: true });
  const lux = shown.items.find((i) => i.cid === CID.luxury);
  assert.ok(lux, 'shown only when explicitly requested');
  assert.equal(lux.suspect, true);
  assert.match(lux.text, /looked like instructions: not counted, excerpt withheld/);
  assert.match(lux.text, /Held back by the kit: suspect_only/);
  assert.match(lux.text, /Evidence: 0 for/);
  assert.ok(!/Ignore previous|Grand Meridian/i.test(lux.text), 'the suspect excerpt is withheld');
  // suspect items sort after clean ones
  const idx = (cid) => shown.items.findIndex((i) => i.cid === cid);
  assert.ok(idx(CID.museums) < idx(CID.luxury));
});

test('the sample run: the owner decisions promote exactly four entries; the planted "luxury" never reaches memory', async () => {
  const { m, t } = await seeded();
  const res = m.apply({ vocab: 'travel', held: t.held, profile: t.profile, decisions: fixture('decisions-sample.json') });
  assert.equal(res.ok, true, res.errors.join());
  assert.equal(res.applied.length, 5);
  assert.deepEqual(res.skipped, []);
  assert.equal(res.profile_entries, 4);
  const prof = fs.readFileSync(t.profile, 'utf8');
  const led = fs.readFileSync(t.ledger, 'utf8');
  for (const want of [/## Pace\n- relaxed — confirmed 2026-09-20/, /## Interests\n- likes "small museums" — edited 2026-09-20 from "museums"/,
    /## Food\n- likes "street food" — confirmed/, /## Mobility\n- avoid "steep stairs" — confirmed/]) assert.match(prof, want);
  assert.ok(!/luxury|shoestring|theme parks|Ignore previous/i.test(prof));
  assert.ok(!/luxury|theme parks/i.test(led));
  assert.match(prof, /<!-- prefs-kit profile v1 · vocab travel · body sha256 [0-9a-f]{16} -->\n$/);
  assert.ok(m.estimateTokens(prof) <= 2000);
});

test('INVARIANT: re-running is idempotent (ingest, review and apply)', async () => {
  const { m, t } = await seeded();
  const before = snapshot(t.held);
  const again = m.ingest({ vocab: 'travel', held: t.held, evidence: fixture('evidence-sample.json') });
  assert.equal(again.added, 0);
  assert.equal(again.duplicates, 16);
  assert.deepEqual(again.written, []);
  assert.deepEqual(snapshot(t.held), before);
  const decisions = fixture('decisions-sample.json');
  m.apply({ vocab: 'travel', held: t.held, profile: t.profile, decisions });
  const once = snapshot(t.dir);
  const twice = m.apply({ vocab: 'travel', held: t.held, profile: t.profile, decisions });
  assert.equal(twice.ok, true);
  assert.equal(twice.applied.length, 0);
  assert.deepEqual([...new Set(twice.skipped.map((s) => s.reason))], ['already applied']);
  assert.equal(twice.ledger_changed, false);
  assert.deepEqual(snapshot(t.dir), once, 'byte-identical tree after a second apply');
  const r1 = m.review({ vocab: 'travel', held: t.held, ledger: t.ledger });
  const r2 = m.review({ vocab: 'travel', held: t.held, ledger: t.ledger });
  assert.deepEqual(r1, r2);
});

test('INVARIANT: an edit keeps its provenance (suggested value, decision date, evidence ids, history)', async () => {
  const { m, t } = await seeded();
  m.apply({ vocab: 'travel', held: t.held, profile: t.profile, decisions: fixture('decisions-sample.json') });
  const e = JSON.parse(fs.readFileSync(t.ledger, 'utf8')).entries[CID.museums];
  assert.equal(e.decision, 'edit');
  assert.equal(e.value, 'small museums');
  assert.equal(e.suggested_value, 'museums');
  assert.equal(e.decided_at, '2026-09-20T10:05:00.000Z');
  assert.equal(e.via, 'telegram');
  assert.equal(e.evidence_count, 2);
  assert.equal(e.evidence_ids.length, 2);
  for (const id of e.evidence_ids) assert.match(id, /^e_[0-9a-f]{12}$/);
  assert.deepEqual(e.history.map((h) => [h.decision, h.value]), [['edit', 'small museums']]);
  const prof = fs.readFileSync(t.profile, 'utf8');
  assert.ok(prof.includes(`- likes "small museums" — edited 2026-09-20 from "museums" · evidence ${e.evidence_ids.join(', ')}`));
  // the held note records the decision too
  const note = fs.readdirSync(t.held).find((f) => f.startsWith('prefs-interests-museums-'));
  assert.match(fs.readFileSync(path.join(t.held, note), 'utf8'), /edit/i);
});

test('rejections are remembered and never re-proposed, even when new evidence arrives', async () => {
  const { m, t } = await seeded();
  m.apply({ vocab: 'travel', held: t.held, profile: t.profile, decisions: fixture('decisions-sample.json') });
  const more = [1, 2, 3].map((n) => ({ source_kind: 'gmail', source_ref: 'hostel-' + n, date: `2026-09-0${n}`, excerpt: 'Hostel bunk again.',
    suggests: { dimension: 'budget_band', value: 'shoestring', polarity: '+' } }));
  const ing = m.ingest({ vocab: 'travel', held: t.held, evidence: more, ledger: t.ledger });
  assert.equal(ing.added, 3);
  const r = m.review({ vocab: 'travel', held: t.held, ledger: t.ledger, max: 20, includeSuspect: true });
  const cids = r.items.map((i) => i.cid).concat(r.held_back.map((h) => h.cid));
  assert.ok(!cids.includes(CID.shoestring), 'a rejected candidate is not proposed or listed again');
  for (const c of [CID.relaxed, CID.museums, CID.street, CID.stairs]) assert.ok(!cids.includes(c), 'decided candidates are not re-proposed');
  assert.equal(JSON.parse(fs.readFileSync(t.ledger, 'utf8')).entries[CID.shoestring].decision, 'reject');
  const note = fs.readdirSync(t.held).find((f) => f.startsWith('prefs-budget-band-shoestring-'));
  assert.match(fs.readFileSync(path.join(t.held, note), 'utf8'), /reject/i);
});

test('the latest decision wins; an older, out-of-order decision is history only; a later reject removes the entry', async () => {
  const { m, t } = await seeded();
  const a = (ds) => m.apply({ vocab: 'travel', held: t.held, profile: t.profile, decisions: decisionsDoc(ds) });
  assert.equal(a([{ cid: CID.street, decision: 'confirm', decided_at: at(3) }]).ok, true);
  const late = a([{ cid: CID.street, decision: 'reject', decided_at: at(1) }]);
  assert.equal(late.applied[0].effective, false);
  assert.match(fs.readFileSync(t.profile, 'utf8'), /street food/);
  const e = JSON.parse(fs.readFileSync(t.ledger, 'utf8')).entries[CID.street];
  assert.deepEqual(e.history.map((h) => h.decision), ['reject', 'confirm']);
  assert.equal(e.decision, 'confirm');
  assert.equal(a([{ cid: CID.street, decision: 'reject', decided_at: at(5) }]).applied[0].effective, true);
  const prof = fs.readFileSync(t.profile, 'utf8');
  assert.ok(!/street food/.test(prof));
  assert.match(prof, /_No confirmed preferences yet\._/);
});

test('a single-value dimension holds one value: confirming a rival replaces it, and the review says so first', async () => {
  const { m, t } = await seeded();
  const a = (ds) => m.apply({ vocab: 'travel', held: t.held, profile: t.profile, decisions: decisionsDoc(ds) });
  a([{ cid: CID.relaxed, decision: 'confirm', decided_at: at(1) }]);
  const r = m.review({ vocab: 'travel', held: t.held, ledger: t.ledger, max: 20 });
  const packed = r.items.find((i) => i.cid === CID.packed);
  assert.match(packed.text, /Profile now: "relaxed"\. Confirming replaces it\./);
  a([{ cid: CID.packed, decision: 'confirm', decided_at: at(2) }]);
  const prof = fs.readFileSync(t.profile, 'utf8');
  assert.match(prof, /## Pace\n- packed — confirmed/);
  assert.ok(!/- relaxed/.test(prof));
});

test('bad decisions are skipped with a reason and change nothing: unknown candidate, closed-vocabulary edit, negative single value', async () => {
  const { m, t } = await seeded();
  // a single-value dimension seen only as a negative cannot be confirmed (nothing to state)
  m.ingest({ vocab: 'travel', held: t.held, evidence: [{ source_kind: 'seed', source_ref: 's9', date: '2026-01-01', excerpt: 'Not a late person.',
    suggests: { dimension: 'day_rhythm', value: 'late', polarity: '-' } }] });
  const lateCid = m.candidateId('day_rhythm', 'late');
  const res = m.apply({ vocab: 'travel', held: t.held, profile: t.profile, decisions: decisionsDoc([
    { cid: 'c_0000000000', decision: 'confirm', decided_at: at(1) },
    { cid: CID.relaxed, decision: 'edit', value: 'glacial', decided_at: at(1) },
    { cid: lateCid, decision: 'confirm', decided_at: at(1) }]) });
  assert.equal(res.ok, true);
  assert.deepEqual(res.applied, []);
  const why = res.skipped.map((s) => s.reason).join('|');
  assert.match(why, /unknown candidate/);
  assert.match(why, /edit value refused: .*not one of relaxed, normal, packed/);
  assert.match(why, /not confirmable: negative_single_value/);
  assert.match(fs.readFileSync(t.profile, 'utf8'), /_No confirmed preferences yet\._/);
});

test('the profile size cap is enforced: an over-cap result writes nothing', async () => {
  const m = await load();
  const t = setup();
  const vocabFile = path.join(t.dir, 'tiny.vocab.json');
  fs.writeFileSync(vocabFile, JSON.stringify({ v: 1, name: 'tiny', title: 'Tiny', max_tokens: 200, dimensions: [{ id: 'topics', cardinality: 'many' }] }));
  const ev = Array.from({ length: 12 }, (_, i) => ({ source_kind: 'drive', source_ref: 'doc-' + i, date: '2026-03-0' + ((i % 9) + 1),
    excerpt: 'Notes on topic ' + i, suggests: { dimension: 'topics', value: 'a fairly long topic name number ' + i, polarity: '+' } }));
  m.ingest({ vocab: vocabFile, held: t.held, evidence: ev });
  const v = m.loadVocab(vocabFile);
  const cids = ev.map((e) => m.candidateId('topics', e.suggests.value));
  const res = m.apply({ vocab: v, held: t.held, profile: t.profile,
    decisions: decisionsDoc(cids.map((cid) => ({ cid, decision: 'confirm', decided_at: at(1) }))) });
  assert.equal(res.ok, false);
  assert.match(res.errors[0], /over the cap of 200; nothing written/);
  assert.ok(!fs.existsSync(t.profile) && !fs.existsSync(t.ledger));
  const small = m.apply({ vocab: v, held: t.held, profile: t.profile, decisions: decisionsDoc([{ cid: cids[0], decision: 'confirm', decided_at: at(1) }]) });
  assert.equal(small.ok, true);
  assert.ok(m.estimateTokens(fs.readFileSync(t.profile, 'utf8')) <= 200);
});

test('a hand-edited or foreign profile file is never overwritten', async () => {
  const { m, t } = await seeded();
  const a = (ds) => m.apply({ vocab: 'travel', held: t.held, profile: t.profile, decisions: decisionsDoc(ds) });
  a([{ cid: CID.relaxed, decision: 'confirm', decided_at: at(1) }]);
  const edited = fs.readFileSync(t.profile, 'utf8').replace('- relaxed', '- relaxed (and luxury)');
  fs.writeFileSync(t.profile, edited);
  const ledgerBefore = fs.readFileSync(t.ledger, 'utf8');
  const res = a([{ cid: CID.street, decision: 'confirm', decided_at: at(2) }]);
  assert.equal(res.ok, false);
  assert.match(res.errors[0], /edited by hand/);
  assert.equal(fs.readFileSync(t.profile, 'utf8'), edited);
  assert.equal(fs.readFileSync(t.ledger, 'utf8'), ledgerBefore);
  fs.writeFileSync(t.profile, '# My own notes\n');
  assert.match(a([{ cid: CID.street, decision: 'confirm', decided_at: at(2) }]).errors[0], /not a prefs-kit profile/);
});

test('the review payload fits Telegram and envelope limits (SPEC §2, §18)', async () => {
  const m = await load();
  const t = setup();
  const long = (i) => ('very long interest name ' + i + ' ').repeat(4).slice(0, 60).trim();
  const ev = Array.from({ length: 25 }, (_, i) => ({ source_kind: 'takeout', source_ref: 'list-' + i, date: '2026-04-01',
    excerpt: 'Saved place: ' + 'x'.repeat(400), suggests: { dimension: 'interests', value: long(i), polarity: '+' } }));
  m.ingest({ vocab: 'travel', held: t.held, evidence: ev });
  const r = m.review({ vocab: 'travel', held: t.held, ledger: t.ledger, max: 500 });
  assert.equal(r.items.length, m.MAX_ITEMS);
  assert.equal(r.more, 25 - m.MAX_ITEMS);
  assert.ok(JSON.stringify(r).length <= m.PAYLOAD_MAX_CHARS);
  assert.match(r.batch_id, /^pfb_[0-9a-f]{16}$/);
  for (const it of r.items) {
    assert.ok(it.text.length <= m.ITEM_TEXT_MAX && it.text.length < 3900);
    assert.deepEqual(it.buttons[0].map((b) => b.data), ['y', 'e', 'n'].map((c) => `pf:${it.cid}:${c}`));
    for (const b of it.buttons[0]) assert.ok(Buffer.byteLength(b.data, 'utf8') <= m.CB_DATA_MAX_BYTES);
    for (const b of it.buttons[0]) assert.match(b.data, /^[a-z][a-z0-9]{0,7}:[A-Za-z0-9_.|:-]+$/);
  }
  assert.equal(m.review({ vocab: 'travel', held: t.held, ledger: t.ledger }).items.length, m.DEFAULT_ITEMS);
  assert.throws(() => m.callbackData('c_' + 'f'.repeat(70), 'y'), /over 64 bytes/);
});

test('the kit is generic: a caller-supplied vocabulary (not travel) runs the whole flow', async () => {
  const m = await load();
  const t = setup();
  const vocab = m.validateVocab({ v: 1, name: 'reading', title: 'Reading preferences', dimensions: [
    { id: 'genre', label: 'Genres', cardinality: 'many' },
    { id: 'length', label: 'Book length', cardinality: 'one', values: ['short', 'any', 'long'] }] });
  assert.deepEqual(vocab.errors, []);
  const v = vocab.vocab;
  const ev = [
    { source_kind: 'drive', source_ref: 'reading-log', date: '2026-02-01', excerpt: 'Finished another sea novel.', suggests: { dimension: 'genre', value: 'sea stories', polarity: '+' } },
    { source_kind: 'owner-chat', source_ref: 'chat-9', date: '2026-02-03', excerpt: 'Prefer shorter books lately.', suggests: { dimension: 'length', value: 'short', polarity: '+' } },
    { source_kind: 'gmail', source_ref: 'travel-sale', date: '2026-02-04', excerpt: 'Pace: relaxed', suggests: { dimension: 'pace', value: 'relaxed', polarity: '+' } }];
  const ing = m.ingest({ vocab: v, held: t.held, evidence: ev });
  assert.equal(ing.added, 2);
  assert.match(ing.rejected[0].errors.join(), /unknown dimension: pace|pace/);
  const r = m.review({ vocab: v, held: t.held, ledger: t.ledger });
  assert.equal(r.vocab, 'reading');
  const res = m.apply({ vocab: v, held: t.held, profile: t.profile, decisions: decisionsDoc(r.items.map((i) => ({ cid: i.cid, decision: 'y', decided_at: at(1) }))) });
  assert.equal(res.ok, true, res.errors.join());
  const prof = fs.readFileSync(t.profile, 'utf8');
  assert.match(prof, /^# Reading preferences/);
  assert.match(prof, /## Genres\n- likes "sea stories"/);
  assert.match(prof, /## Book length\n- short/);
  // a travel run cannot overwrite a reading profile
  assert.match(m.apply({ vocab: 'travel', held: t.held, profile: t.profile, ledger: path.join(t.dir, 'other.json'),
    decisions: decisionsDoc([{ cid: CID.relaxed, decision: 'confirm', decided_at: at(2) }]) }).errors.join(), /vocabulary "reading"/);
});

test('deleting held notes loses no confirmed preference: the profile renders from the ledger alone', async () => {
  const { m, t } = await seeded();
  m.apply({ vocab: 'travel', held: t.held, profile: t.profile, decisions: fixture('decisions-sample.json') });
  const before = fs.readFileSync(t.profile, 'utf8');
  fs.rmSync(t.held, { recursive: true });
  const res = m.apply({ vocab: 'travel', held: t.held, profile: t.profile,
    decisions: decisionsDoc([{ cid: CID.street, decision: 'reject', decided_at: at(8) }]) });
  assert.equal(res.ok, true, res.errors.join());
  const after = fs.readFileSync(t.profile, 'utf8');
  assert.ok(!after.includes('street food'));
  assert.equal(after.split('\n').filter((l) => l.startsWith('- ')).length, before.split('\n').filter((l) => l.startsWith('- ')).length - 1);
});

// Developed by: LightAISolutions
