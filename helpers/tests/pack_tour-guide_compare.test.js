'use strict';
// Tour Guide — the compare branch (TG-PHASE-14 WP-14e, item 12), written by helpers/tools/new-branch.mjs and filled in:
// /compare <a>, <b>[, <c>, <d>] [in <place>] or /compare <list> [in <place>] opens a `compare` request
// { trip?, where?, names | list } (Contract C14, wave 2); anything else gets the usage line. The owner's list names come
// from WP-14d's tgListNames(), stubbed here. Invented data only; no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness/gas-mocks');

const PACK_DIR = path.join(H.HELPERS_ROOT, 'packs', 'tour-guide');
const FIX = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'compare', 'fixtures', 'compare-sample.json'), 'utf8'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'helper.json'), 'utf8'));
const NOW = '2027-05-01T12:00:00Z';
const J = (v) => JSON.parse(JSON.stringify(v));
const LISTS = [{ name: 'Dinner list', count: 6 }, { name: 'Café Crawl', count: 3 }];

function fresh(o = {}) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW, manifest: o.manifest || MANIFEST });
  H.bootstrap(ctx, state);
  H.configureRoutine(ctx, state, 'RESEARCH');
  if (o.trip !== false) ctx.tgTripUpsert(FIX.trip);
  if (o.lists !== false) ctx.tgListNames = () => J(o.lists || LISTS);   // WP-14d's function, stubbed
  return { ctx, state };
}
const say = (ctx, state, text) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, H.tgUpdate({ text })));
const texts = (state) => state.fetch.telegram('sendMessage').map((r) => r.json.text);
const requests = (state) => (state.drive.listFiles(MANIFEST.drive_root + '/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile(MANIFEST.drive_root + '/mailbox/to-brain', n)));
/** The one request's own fields (the request file adds kind and the routing fields). */
const fields = (state) => { const r = requests(state); assert.equal(r.length, 1, 'one request'); const p = r[0].payload; return { trip: p.trip, where: p.where, names: p.names, list: p.list }; };
const clean = (o) => JSON.parse(JSON.stringify(o));

test('compare: the command and the kind\'s routing are registered; the kind is a discovery kind', () => {
  const { ctx } = fresh();
  assert.equal(typeof ctx.getCommand('/compare'), 'function');
  assert.ok(J(ctx.HB_REGISTRY.help).some((l) => l.indexOf('/compare — ') === 0), 'a help line');
  assert.equal(ctx.TG_KIND_ROUTINE['compare'], 'RESEARCH');
  assert.equal(ctx.tgKindRoutine('compare'), 'RESEARCH');
  assert.ok(J(ctx.TG_DISCOVER_KINDS).includes('compare'));
  assert.equal(J(ctx.TG_DISCOVER_KINDS).filter((k) => k === 'compare').length, 1, 'listed once, though 00_common.js already has it');
});

test('/compare names: two to four, comma-separated, for the current trip; acknowledged "⚖️ Comparing …"', () => {
  let { ctx, state } = fresh();
  say(ctx, state, '/compare Reed Mill, Pear Press');
  assert.deepEqual(clean(fields(state)), { trip: FIX.trip.slug, names: ['Reed Mill', 'Pear Press'] });
  assert.equal(requests(state)[0].payload.kind, 'compare');
  assert.equal(requests(state)[0].payload.text, '/compare Reed Mill, Pear Press', 'the owner\'s words as typed');
  assert.match(texts(state).join('\n'), /⚖️ Comparing <b>Reed Mill, Pear Press<\/b>…/);
  ({ ctx, state } = fresh());
  say(ctx, state, '/compare  Reed Mill ,Pear Press,  Lantern & Loom , Fig Yard ');
  assert.deepEqual(fields(state).names, ['Reed Mill', 'Pear Press', 'Lantern & Loom', 'Fig Yard']);
  assert.match(texts(state).join('\n'), /Lantern &amp; Loom/, 'escaped in the acknowledgement');
  // No current trip: the request still goes, without a trip.
  ({ ctx, state } = fresh({ trip: false }));
  say(ctx, state, '/compare Reed Mill, Pear Press');
  assert.deepEqual(clean(fields(state)), { names: ['Reed Mill', 'Pear Press'] });
});

test('/compare <list>: one argument matching a list name, folded (case, accents, spaces, a leading "my")', () => {
  for (const typed of ['Dinner list', 'dinner LIST', '  dinner   list ', 'my dinner list']) {
    const { ctx, state } = fresh();
    say(ctx, state, '/compare ' + typed);
    assert.deepEqual(clean(fields(state)), { trip: FIX.trip.slug, list: 'Dinner list' }, typed);
    assert.match(texts(state).join('\n'), /⚖️ Comparing your list <b>Dinner list<\/b>…/);
  }
  const { ctx, state } = fresh();
  say(ctx, state, '/compare cafe crawl');
  assert.equal(fields(state).list, 'Café Crawl', 'the stored spelling is sent');
});

test('/compare … in <place>: the place goes in `where`, for names and for a list', () => {
  let { ctx, state } = fresh();
  say(ctx, state, '/compare Reed Mill, Pear Press in Old Brindlewick');
  assert.deepEqual(clean(fields(state)), { trip: FIX.trip.slug, where: 'Old Brindlewick', names: ['Reed Mill', 'Pear Press'] });
  assert.match(texts(state).join('\n'), /⚖️ Comparing <b>Reed Mill, Pear Press<\/b> in <b>Old Brindlewick<\/b>…/);
  ({ ctx, state } = fresh());
  say(ctx, state, '/compare Dinner list in Quillmere');
  assert.deepEqual(clean(fields(state)), { trip: FIX.trip.slug, where: 'Quillmere', list: 'Dinner list' });
  // " in " inside an earlier name is part of that name; only the last part can carry the place.
  ({ ctx, state } = fresh());
  say(ctx, state, '/compare Inn in the Park, Pear Press');
  assert.deepEqual(clean(fields(state)), { trip: FIX.trip.slug, names: ['Inn in the Park', 'Pear Press'] });
});

test('/compare usage: nothing, one name that is no list, more than four names, an empty name or a name too long — no request', () => {
  const cases = ['/compare', '/compare Reed Mill', '/compare Reed Mill in Quillmere', '/compare A one, B two, C three, D four, E five', '/compare Reed Mill, , Pear Press',
    '/compare Reed Mill,', '/compare ' + 'x'.repeat(121) + ', Pear Press', '/compare Reed Mill, Pear Press in ' + 'y'.repeat(81)];
  for (const c of cases) {
    const { ctx, state } = fresh();
    say(ctx, state, c);
    assert.equal(requests(state).length, 0, c);
    const t = texts(state).join('\n');
    assert.match(t, /\/lists shows your lists/, c);
    assert.match(t, /\/compare Reed Mill, Pear Press/, c);
  }
  // Without WP-14d's lists (tgListNames not defined), one argument is still the usage line, and nothing throws.
  const { ctx, state } = fresh({ lists: false });
  assert.equal(typeof ctx.tgListNames, 'undefined');
  say(ctx, state, '/compare Dinner list');
  assert.equal(requests(state).length, 0);
  assert.match(texts(state).join('\n'), /\/lists shows your lists/);
  // A broken tgListNames is the same as none.
  const b = fresh({ lists: false });
  b.ctx.tgListNames = () => { throw new Error('boom'); };
  say(b.ctx, b.state, '/compare Dinner list');
  assert.equal(requests(b.state).length, 0);
});

// Developed by: LightAISolutions
