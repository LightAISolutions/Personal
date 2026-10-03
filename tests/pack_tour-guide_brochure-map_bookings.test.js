'use strict';
// packs/tour-guide/brochure-map — bookingsSection (WP-10a): the "Bookings" practical section with both times, records
// still to book first, booked after, "not needed" left out; https links only; a model carrying it validates and renders
// with the record text escaped. Invented data: the trip "Port Sorrel" in Pacific/Auckland, owner in America/New_York.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const load = async () => ({
  bk: await import('../packs/tour-guide/brochure-map/brochure-map-bookings.mjs'),
  bm: await import('../packs/tour-guide/brochure-map/index.mjs'),
  kit: await import('../kits/brochure/index.mjs'),
  sample: (await import('../packs/tour-guide/brochure-map/brochure-map-sample.mjs')).sampleInput
});
const OPTS = { tripTz: 'Pacific/Auckland', ownerTz: 'America/New_York', now: '2027-03-01T12:00:00Z' };
const tower = (over = {}) => ({ id: 'clock-tower-climb', title: 'Clock tower climb', kind: 'sight', rule: 'Tickets release 14 days ahead at 10:00',
  status: 'todo', for_date: '2027-03-16', opens_at: '2027-03-02T10:00:00+13:00', book_by: '2027-03-10T20:00:00+13:00', how: 'Online only',
  party_min: 2, url: 'https://tickets.example.org/clock-tower', ...over });
const ferry = (over = {}) => ({ id: 'harbour-ferry', title: 'Harbour ferry', kind: 'train', rule: 'Seats sell out a week before', status: 'todo',
  opens_at: '2027-02-20T09:00:00+13:00', book_by: '2027-02-28T12:00:00+13:00', ...over });
const guesthouse = (over = {}) => ({ id: 'harbour-lane-guesthouse', title: 'Harbour Lane guesthouse', kind: 'lodging', rule: 'Pay the deposit',
  status: 'booked', book_by: '2027-02-01T12:00:00+13:00', url: 'https://stay.example.org/harbour-lane', ...over });

test('bookingsSection: open records first (nearest deadline first), booked after, not needed left out; both times in each line', async () => {
  const { bk } = await load();
  const s = bk.bookingsSection([guesthouse(), tower(), tower({ id: 'quay-lunch', title: 'Quay lunch', status: 'not_needed' }), ferry()], OPTS);
  assert.equal(s.title, 'Bookings');
  assert.deepEqual(s.items, [
    { label: 'Harbour ferry', text: 'Seats sell out a week before. Open since Sat 20 Feb 09:00 local time (Fri 19 Feb 3:00 pm your time). ' +
      'Was due Sun 28 Feb 12:00 local time (Sat 27 Feb 6:00 pm your time). Still to book.' },
    { label: 'Clock tower climb', text: 'Tickets release 14 days ahead at 10:00 · Online only. Opens Tue 2 Mar 10:00 local time (Mon 1 Mar 4:00 pm your time). ' +
      'Book by Wed 10 Mar 20:00 local time (Wed 10 Mar 2:00 am your time). For Tue 16 Mar. At least 2 people. Still to book.', url: 'https://tickets.example.org/clock-tower' },
    { label: 'Harbour Lane guesthouse', text: 'Pay the deposit. Book by Mon 1 Feb 12:00 local time (Sun 31 Jan 6:00 pm your time). Booked.' }
  ], 'a booked record carries no link');
});

test('bookingsSection: one time when the zones read the same; no "now" → neutral wording; empty or all not-needed → null', async () => {
  const { bk } = await load();
  const same = bk.bookingsSection([ferry()], { tripTz: 'Pacific/Auckland', ownerTz: 'Pacific/Auckland' });
  assert.equal(same.items[0].text, 'Seats sell out a week before. Opens Sat 20 Feb 09:00. Book by Sun 28 Feb 12:00. Still to book.');
  const noOwner = bk.bookingsSection([ferry()], { tripTz: 'Pacific/Auckland' });
  assert.equal(noOwner.items[0].text, same.items[0].text);
  assert.equal(bk.bookingsSection([], OPTS), null);
  assert.equal(bk.bookingsSection(null, OPTS), null);
  assert.equal(bk.bookingsSection([tower({ status: 'not_needed' })], OPTS), null);
  const bare = bk.bookingsSection([{ id: 'x', title: 'Night market stall', kind: 'other', rule: 'Ask at the hotel', status: 'todo' }], OPTS);
  assert.deepEqual(bare.items, [{ label: 'Night market stall', text: 'Ask at the hotel. Still to book.' }]);
  const many = Array.from({ length: 35 }, (_, i) => ferry({ id: 'f' + i, title: 'Ferry ' + i }));
  assert.equal(bk.bookingsSection(many, OPTS).items.length, bk.BOOKINGS_MAX);
  assert.equal(bk.bookingsSection([ferry({ opens_at: '2027-02-20T09:00:00', book_by: 'soon' })], OPTS).items[0].text,
    'Seats sell out a week before. Still to book.', 'a time without offset is not printed');
});

test('red team: a javascript:, data: or http: link is dropped; HTML in title / rule stays text and is escaped by the renderer', async () => {
  const { bk, bm, kit, sample } = await load();
  ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'http://tickets.example.org/x', 'https://', ' javascript:x'].forEach((url) => {
    assert.equal(bk.bookingsSection([tower({ url })], OPTS).items[0].url, undefined, url);
  });
  const evil = tower({ title: '<img src=x onerror=alert(1)> Tower', rule: '<script>alert(1)</script> & co', url: 'javascript:alert(1)' });
  const sec = bk.bookingsSection([evil, guesthouse()], OPTS);
  assert.equal(sec.items[0].label, '<img src=x onerror=alert(1)> Tower', 'kept as plain text; escaping is the renderer\'s job');
  const model = bm.toBrochureModel(sample());
  model.practical = [...(model.practical || []), sec];
  assert.deepEqual(kit.validate(model), [], 'a model carrying the section validates against the brochure schema');
  const { html } = kit.renderHtml(model, { embedFonts: false });
  assert.doesNotMatch(html, /<script>alert|<img src=x/i);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; co'));
  assert.ok(html.includes('Harbour Lane guesthouse') && html.includes('local time (Mon 1 Mar 4:00 pm your time)'));
  assert.doesNotMatch(html, /href="javascript:/i);
});

// Developed by: LightAISolutions
