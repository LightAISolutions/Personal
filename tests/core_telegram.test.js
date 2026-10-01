'use strict';
// Core Telegram client — the HTML-safety hardening of Phase 6 (helpers/decisions/TG-PHASE-6.md §4, carried item 7):
// tgSplit never cuts inside a tag or an entity and closes/reopens tags across chunks; tgClip bounds single-message fields
// the same way; tgEdit, tgSend and tgSendDocument retry once as plain text when Telegram answers "can't parse entities".
// Everything here is invented text against the mock harness; no live call is made.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

function fresh() {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  H.bootstrap(ctx, state);
  return { ctx, state };
}
const balanced = (ctx, html) => ctx._tgOpenTags(html).length === 0;
const plain = (s) => s.replace(/<[^>]*>/g, '').replace(/\n/g, '');
/** Telegram refuses the first call of `method` with the entity-parse error, then behaves normally. */
function refuseOnce(state, method) {
  let refused = false;
  state.fetch.responder = (url) => {
    if (!refused && url.endsWith('/' + method)) { refused = true; return { code: 400, body: { ok: false, error_code: 400, description: "Bad Request: can't parse entities: Unsupported start tag" } }; }
    return null;
  };
}

test('tgSplit: every chunk is within the limit, balanced, and nothing but newlines at the cuts is lost', () => {
  const { ctx } = fresh();
  const lines = [];
  for (let i = 0; i < 120; i++) lines.push('<b>Stop ' + i + '</b> — <i>a line of invented plan text that is long enough to force several chunks ' + i + '</i>');
  const html = lines.join('\n');
  const chunks = ctx.tgSplit(html, 400);
  assert.ok(chunks.length > 3);
  chunks.forEach((c) => { assert.ok(c.length <= 400, 'chunk ≤ max: ' + c.length); assert.ok(balanced(ctx, c), 'balanced: ' + c.slice(-60)); });
  assert.equal(plain(chunks.join('')), plain(html));
});

test('tgSplit: a cut never lands inside a tag or an entity, even when the only break points are inside them', () => {
  const { ctx } = fresh();
  // No newline or space anywhere: the hard cut would land inside the <a …> tag or the &amp; entity without the guard.
  const word = 'x'.repeat(95);
  const html = word + '<a href="https://example.test/path?a=1&amp;b=2">' + word + '</a>' + word + '&amp;' + word;
  const chunks = ctx.tgSplit(html, 100);
  chunks.forEach((c) => {
    assert.ok(c.length <= 100 + 60, 'a reopened <a …> tag may carry over but the text part stays bounded: ' + c.length);
    assert.ok(!/<[^>]*$/.test(c), 'no open tag at the end: ' + c.slice(-30));
    assert.ok(!/&[a-z]*$/.test(c), 'no cut entity at the end: ' + c.slice(-10));
    assert.ok(balanced(ctx, c), 'balanced: ' + c);
  });
  assert.equal(plain(chunks.join('')).replace(/&amp;/g, '&'), plain(html).replace(/&amp;/g, '&'));
});

test('tgSplit: an open <a href> is closed at the cut and reopened with the same href on the next chunk', () => {
  const { ctx } = fresh();
  const open = '<a href="https://example.test/map">';
  const html = 'Lead text\n' + open + ('link words that run on and on\n').repeat(30) + '</a>\ntail';
  const chunks = ctx.tgSplit(html, 300);
  assert.ok(chunks.length >= 2);
  assert.ok(chunks[0].endsWith('</a>'), 'first chunk closes the link: ' + chunks[0].slice(-20));
  assert.ok(chunks[1].startsWith(open), 'second chunk reopens it: ' + chunks[1].slice(0, 50));
  chunks.forEach((c) => assert.ok(balanced(ctx, c)));
});

test('tgSplit: short text is one chunk, untouched', () => {
  const { ctx } = fresh();
  // Arrays come back from the GAS vm realm, so compare plain copies rather than prototypes.
  assert.deepEqual(Array.from(ctx.tgSplit('<b>hi</b> &amp; bye', 3900)), ['<b>hi</b> &amp; bye']);
  assert.deepEqual(Array.from(ctx.tgSplit('', 3900)), ['']);
});

test('tgClip: bounds the text, closes the tags it cut through and marks the cut', () => {
  const { ctx } = fresh();
  const html = '<b>' + 'word '.repeat(300) + '</b> <i>more</i>';
  const out = ctx.tgClip(html, 200);
  assert.ok(out.length <= 200, String(out.length));
  assert.ok(out.endsWith('…'));
  assert.ok(balanced(ctx, out), out.slice(-40));
  assert.equal(ctx.tgClip('<b>short</b>', 200), '<b>short</b>');
});

test('tgStripHtml: removes tags and restores the escaped characters for the plain-text fallback', () => {
  const { ctx } = fresh();
  assert.equal(ctx.tgStripHtml('<b>a &lt; b &amp; c</b> <a href="x">&quot;q&quot;</a>'), 'a < b & c "q"');
});

test('tgEdit: an edit Telegram cannot parse is retried once as plain text, within the limit', () => {
  const { ctx, state } = fresh();
  refuseOnce(state, 'editMessageText');
  const html = '<b>Pending</b> ' + '<i>detail line</i>\n'.repeat(400);
  const r = ctx.tgEdit(1, 7, html, null);
  assert.equal(r.ok, true);
  const calls = state.fetch.telegram('editMessageText');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].json.parse_mode, 'HTML');
  assert.ok(calls[0].json.text.length <= ctx.LIMITS.TG_MAX_CHARS);
  assert.ok(balanced(ctx, calls[0].json.text));
  assert.equal(calls[1].json.parse_mode, undefined);
  assert.ok(!/<[^>]+>/.test(calls[1].json.text), 'plain retry carries no tags');
});

test('tgSend: the plain-text retry shows the owner "<" and "&", not "&lt;" and "&amp;"', () => {
  const { ctx, state } = fresh();
  refuseOnce(state, 'sendMessage');
  ctx.tgSend(1, '<b>a &lt; b &amp; c</b>');
  const calls = state.fetch.telegram('sendMessage');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].json.text, 'a < b & c');
});

test('tgSendDocument: the caption is clipped tag-safe to the caption limit and retried plain when Telegram refuses it', () => {
  const { ctx, state } = fresh();
  const file = state.drive.root.createFile('brochure.pdf', 'pdf bytes', 'application/pdf');
  refuseOnce(state, 'sendDocument');
  const caption = '<b>' + 'Harbor Town brochure '.repeat(80) + '</b>';
  const r = ctx.tgSendDocument(1, { driveFileId: file.getId(), caption });
  assert.equal(r.ok, true);
  const calls = state.fetch.telegram('sendDocument');
  assert.equal(calls.length, 2);
  const first = calls[0].options.payload, second = calls[1].options.payload;
  assert.ok(first.caption.length <= ctx.LIMITS.DOCUMENT_CAPTION_CHARS, String(first.caption.length));
  assert.ok(balanced(ctx, first.caption));
  assert.equal(first.parse_mode, 'HTML');
  assert.equal(second.parse_mode, undefined);
  assert.ok(!/<[^>]+>/.test(second.caption));
  assert.ok(second.document, 'the file goes out again with the plain caption');
});

test('tgSafeHtml keeps Telegram\'s plain tags and https links and shows everything else as text (red-team A8 / R1)', () => {
  const { ctx } = fresh();
  assert.equal(ctx.tgSafeHtml('<b>Day 2</b> · <i>rain</i> · <code>09:30</code>'), '<b>Day 2</b> · <i>rain</i> · <code>09:30</code>');
  assert.equal(ctx.tgSafeHtml('<a href="https://maps.app.goo.gl/x?q=1&z=2">map</a>'), '<a href="https://maps.app.goo.gl/x?q=1&amp;z=2">map</a>');
  const userinfo = 'https://google.com' + '@' + 'evil.example/login';   // built at runtime: the boundary check reads a literal as an e-mail address
  assert.equal(ctx.tgSafeHtml('<a href="' + userinfo + '">Open</a>'), '&lt;a href="' + userinfo + '"&gt;Open</a>', 'userinfo in the host is not a link');
  assert.equal(ctx.tgSafeHtml('<a href="javascript:alert(1)">x</a>'), '&lt;a href="javascript:alert(1)"&gt;x</a>');
  assert.equal(ctx.tgSafeHtml('<script>alert(1)</script> <tg-emoji emoji-id="1">x</tg-emoji> <b class="y">z</b>'), '&lt;script&gt;alert(1)&lt;/script&gt; &lt;tg-emoji emoji-id="1"&gt;x&lt;/tg-emoji&gt; &lt;b class="y"&gt;z</b>');
  assert.equal(ctx.tgSafeHtml('5 < 6 & 7 > 3'), '5 &lt; 6 &amp; 7 &gt; 3');
});

test('stripHidden removes controls, bidi marks, zero-width space and the BOM but keeps ZWJ sequences and newlines (red-team A7 / R2)', () => {
  const { ctx } = fresh();
  assert.equal(ctx.stripHidden('pa‮id​ ﻿\u0007ok\nnext'), 'paid ok\nnext');
  assert.equal(ctx.stripHidden('\u{1F468}‍\u{1F469}‍\u{1F467} ن‌ت'), '\u{1F468}‍\u{1F469}‍\u{1F467} ن‌ت');
  assert.equal(ctx.stripHidden(null), '');
});

// Developed by: LightAISolutions
