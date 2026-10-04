'use strict';
// WP-13c (A11): a line cut for length is cut only in its visible text — never inside a tag or an entity, every opened
// tag closed, a link kept whole or dropped whole. Places and links are invented ("Fixture …").
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const NOW = '2027-05-01T16:00:00Z';
const maps = (id) => 'https://www.google.com/maps/search/?api=1&amp;query=Fixture&amp;query_place_id=' + id;
const link = (i) => '<a href="' + maps('FixturePlace' + i) + '">Fixture &amp; Hall ' + i + '</a>';
const TENLINKS = '<b>Day 1</b> — <i>stops</i>: ' + Array.from({ length: 10 }, (_, i) => link(i + 1) + ' · ' + '🏯'.repeat(3)).join(' ');

/** A strict check of Telegram's HTML subset: every '<' starts a whole tag, every '&' a whole entity, tags balance,
 *  and every link in the output is one of the input's links, whole. */
function assertValidHtml(html, source) {
  const tags = [];
  let i = 0;
  while (i < html.length) {
    const c = html[i];
    if (c === '<') {
      const end = html.indexOf('>', i);
      assert.ok(end > i, 'a "<" at ' + i + ' never closes: ' + JSON.stringify(html.slice(i, i + 30)));
      const tag = html.slice(i, end + 1);
      assert.match(tag, /^<\/?[a-z]+(?: href="[^"<>]*")?>$/, 'a broken tag: ' + tag);
      const m = /^<(\/?)([a-z]+)/.exec(tag);
      if (m[1]) { assert.equal(tags.pop(), m[2], 'closing ' + tag + ' out of order'); }
      else tags.push(m[2]);
      i = end + 1;
    } else if (c === '&') {
      assert.match(html.slice(i, i + 10), /^&(amp|lt|gt|quot|#\d+);/, 'a cut entity at ' + i + ': ' + JSON.stringify(html.slice(i, i + 10)));
      i = html.indexOf(';', i) + 1;
    } else {
      const code = html.charCodeAt(i);
      if (code >= 0xD800 && code <= 0xDBFF) {
        const lo = html.charCodeAt(i + 1);
        assert.ok(lo >= 0xDC00 && lo <= 0xDFFF, 'a split surrogate pair at ' + i);
        i += 2;
      } else i++;
    }
  }
  assert.deepEqual(tags, [], 'tags left open: ' + tags.join(','));
  const whole = new Set((source.match(/<a [^>]*>[\s\S]*?<\/a>/g) || []));
  (html.match(/<a [^>]*>[\s\S]*?<\/a>/g) || []).forEach((a) => assert.ok(whole.has(a), 'a link was cut: ' + a));
}

test('A11 repro: tgLines cut a line of ten links inside a tag before the fix', () => {
  const { ctx } = H.loadGas({ pack: 'tour-guide', now: NOW });
  for (const max of [200, 333, 517, 700, 901]) {
    assert.ok(TENLINKS.length > max);
    const out = ctx.tgLines([TENLINKS], max);
    assert.equal(out.length, 1);
    assert.ok(out[0].length <= max, 'over ' + max + ': ' + out[0].length);
    assert.ok(out[0].endsWith('…') || /…(<\/[a-z]+>)+$/.test(out[0]), 'the cut is marked');
    assertValidHtml(out[0], TENLINKS);
  }
});

test('A11: tgHtmlClip keeps whole links, closes tags, never splits an entity or a surrogate pair', () => {
  const { ctx } = H.loadGas({ pack: 'tour-guide', now: NOW });
  for (let max = 2; max <= TENLINKS.length + 5; max += 7) {
    const out = ctx.tgHtmlClip(TENLINKS, max);
    assert.ok(out.length <= Math.max(max, 1), 'max ' + max + ' gave ' + out.length);
    assertValidHtml(out, TENLINKS);
  }
  assert.equal(ctx.tgHtmlClip(TENLINKS, TENLINKS.length), TENLINKS, 'a line that fits is untouched');
  const kept = ctx.tgHtmlClip(TENLINKS, 600);
  const links = kept.match(/<a [^>]*>[\s\S]*?<\/a>/g) || [];
  assert.ok(links.length >= 2 && links.length < 10, 'some links survive whole, the rest are dropped: ' + links.length);
  // A link longer than the room is dropped whole, never shortened.
  const big = '<b>x</b> ' + link(1);
  assert.equal(ctx.tgHtmlClip(big, 30), '<b>x</b> …');
  // An entity at the cut stays whole (or goes), a tag opened at the cut does not stay empty.
  assert.equal(ctx.tgHtmlClip('ab &amp; cd', 6), 'ab …');
  assert.equal(ctx.tgHtmlClip('ab &amp; cd', 9), 'ab &amp;…');
  assert.equal(ctx.tgHtmlClip('abcdef <i>ghijkl</i>', 9), 'abcdef …');
  assert.equal(ctx.tgHtmlClip('<b>abcdefghij</b>', 10), '<b>ab…</b>');
});

test('A11: a day card with ten map links over the limit arrives as valid HTML (tgCmdMessages)', () => {
  const { ctx } = H.loadGas({ pack: 'tour-guide', now: NOW });
  const line = TENLINKS.repeat(8);
  assert.ok(line.length > 3900);
  const msgs = ctx.tgCmdMessages([line], null);
  assert.equal(msgs.length, 1);
  assert.ok(msgs[0].html.length <= 3900);
  assertValidHtml(msgs[0].html, line);
});

test('A11: the bookings reminder card is cut in its visible text only (tgBkCard)', () => {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW });
  H.bootstrap(ctx, state);
  const trip = { slug: 'fixture-bay', title: 'Fixture Bay' };
  const entries = Array.from({ length: 24 }, (_, i) => ({ trip, b: { key: 'bk' + i, status: 'todo',
    rec: { kind: 'sight', title: 'Fixture <Hall> & ' + 'Gallery '.repeat(14) + i, rule: 'book a slot ' + '🏯'.repeat(20),
      url: 'https://example.invalid/book?slot=' + i + '&day=fixture' } } }));
  const card = ctx.tgBkCard('🎟 <b>Bookings to make</b>', entries, Date.parse(NOW));
  const src = '🎟 <b>Bookings to make</b>\n' + entries.map((x, i) => ctx.tgBkLine(x.b, x.trip, Date.parse(NOW), ctx.tgOwnerTz(), { n: i + 1, tripName: true })).join('\n');
  assert.ok(src.length > 4096);
  assert.ok(card.html.length <= 4096);
  assertValidHtml(card.html, src);
});

module.exports = { assertValidHtml };

// Developed by: LightAISolutions
