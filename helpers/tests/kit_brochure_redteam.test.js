'use strict';
// kits/brochure — red team (WP-6b). Place names, notes and why-lines are web-sourced or typed text; the renderer must
// treat every one as data: escaped in HTML and SVG, no attribute or style injection, oversize text refused or clipped
// with the layout intact. Fixture: the kit's invented sample trip (reserved domains, no real place).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const KIT = path.resolve(__dirname, '..', 'kits', 'brochure');
const fixture = () => JSON.parse(fs.readFileSync(path.join(KIT, 'fixtures', 'sample-trip.json'), 'utf8'));
const B = () => import('../kits/brochure/index.mjs');

const SCRIPT = '<script>alert(1)</script>';
const ONERROR = '"><img src=x onerror=alert(2)>';
const STYLE = '</style><style>body{display:none}</style>';
const MUSTACHE = '{{constructor.constructor("return process")().exit()}}';
const CSSURL = 'background:url(javascript:alert(3));color:red" style="position:fixed';
const RTL = 'Open ‮desolc‬ daily ⁦x⁩​';
const ALL = [SCRIPT, ONERROR, STYLE, MUSTACHE, CSSURL].join(' ');
// What must never appear raw in the document: a live tag, an event handler, a javascript: URL, a closing style tag.
// (escaped text may still SAY "onerror=" or "javascript:" — what matters is that neither sits inside a tag or attribute)
const RAW = [/<script/i, /<[a-z][^>]*\son[a-z]+\s*=/i, /(?:src|href|style|xlink:href)\s*=\s*"[^"]*javascript:/i, /style="[^"]*url\(/i, /<img src=x/, /<\/style><style>body/i];
const assertInert = (html) => { for (const re of RAW) assert.doesNotMatch(html, re, String(re)); };
const assertLayout = (html, model) => {
  for (const cls of ['sec-cover', 'sec-glance', 'sec-day', 'sec-cards', 'sec-later', 'sec-practical', 'sec-attr']) assert.ok(html.includes(`class="sec ${cls}`), cls);
  assert.equal((html.match(/class="sec sec-day/g) || []).length, model.days.length, 'every day page still renders');
  assert.match(html, /<\/html>\s*$/);
};
const hostileModel = () => {
  const m = fixture();
  const tm = m.places['tide-museum'];
  m.trip.title = `Trip ${ALL}`; m.trip.subtitle = RTL; m.trip.intro = MUSTACHE;
  tm.name = `Tide ${SCRIPT} ${ONERROR}`; tm.tagline = STYLE; tm.editorial = CSSURL; tm.category = ONERROR;
  tm.note = { ...(tm.note || {}), why_you: `Why ${ALL} ${RTL}`, tickets: ONERROR, pairings: tm.note && tm.note.pairings };
  tm.reviews[0].text = ALL; tm.reviews[0].author = ONERROR;
  tm.sources[0].title = SCRIPT;
  m.days[0].theme = ONERROR; m.days[0].stops[0].note = ALL; m.days[0].warnings[0].text = STYLE;
  m.later[0].items[0].reason = ALL; m.later[0].name = ONERROR;
  m.practical[0].items[0].text = CSSURL; m.practical[0].title = SCRIPT;
  return m;
};

test('<script>, <img onerror>, </style>, {{…}} and CSS url(javascript:) in names, notes, why-lines, reviews, later and practical text are escaped, not rendered', async () => {
  const { renderHtml } = await B();
  const m = hostileModel();
  const { html, warnings } = renderHtml(m);
  assertInert(html);
  assertLayout(html, m);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'the text survives as visible, escaped text');
  assert.ok(html.includes('&lt;/style&gt;'), 'a closing style tag in text cannot close the document stylesheet');
  assert.equal((html.match(/<\/style>/g) || []).length, (renderHtml(fixture()).html.match(/<\/style>/g) || []).length, 'exactly the renderer\'s own style blocks');
  assert.ok(html.includes('{{constructor.constructor(&quot;return process&quot;)().exit()}}') || html.includes('{{constructor.constructor(&#34;'), 'mustache text is inert text');
  for (const [, u] of html.matchAll(/\s(?:src|href)="([^"]*)"/g)) assert.match(u, /^(data:image\/|data:font\/|#|https?:\/\/|mailto:)/, u);
  // No attribute was opened by text: every style="" value is one the renderer wrote (no fixed positioning from a note).
  assert.doesNotMatch(html, /style="[^"]*position:fixed/);
  assert.doesNotMatch(html, /style="[^"]*url\(/);
  assert.deepEqual(warnings, []);
});

test('an SVG route sketch and the map overlay escape place labels (no <script> or event handler inside <svg>)', async () => {
  const { renderHtml } = await B();
  const m = hostileModel();
  for (const l of m.trip.lodging || []) { const old = l.name; l.name = ONERROR + SCRIPT; for (const d of m.days) if (d.lodging === old) d.lodging = l.name; }
  const { html } = renderHtml(m);
  for (const svg of html.match(/<svg[\s\S]*?<\/svg>/g) || []) { assertInert(svg); assert.doesNotMatch(svg, /<\/svg>[\s\S]+<\/svg>/); }
  assert.ok((html.match(/<svg/g) || []).length >= m.days.length, 'the sketches still render');
});

test('a 5 000-character note is refused by the schema with a pointer path; a 3 999-character note renders clipped with the layout intact', async () => {
  const { validate, formatErrors, renderHtml } = await B();
  const m = fixture();
  m.days[0].stops[0].note = 'x'.repeat(5000);
  m.places['tide-museum'].note = { ...(m.places['tide-museum'].note || {}), why_you: 'w'.repeat(5000) };
  const errs = validate(m);
  const text = formatErrors(errs);
  assert.match(text, /\/days\/0\/stops\/0\/note: .*4000/);
  assert.match(text, /\/places\/tide-museum\/note\/why_you: .*(4000|300)/);
  const ok = fixture();
  ok.days[0].stops[0].note = 'y'.repeat(3999);
  ok.places['tide-museum'].editorial = 'e'.repeat(3999);
  ok.later[0].items[0].reason = 'r'.repeat(299);
  assert.deepEqual(validate(ok), []);
  const { html, warnings } = renderHtml(ok);
  assertLayout(html, ok);
  assert.deepEqual(warnings, []);
  assert.ok(!/y{1000}/.test(html), 'the stop note is clipped well under its schema cap');
  assert.ok(!/e{500}/.test(html), 'the editorial is clipped to the card');
  assert.ok(html.length < 2 * renderHtml(fixture()).html.length, 'oversize text cannot balloon the document');
});

test('RTL override, isolate and zero-width characters in text are dropped by the escaper so a name cannot flip the line around it', async () => {
  const { esc, renderHtml } = await import('../kits/brochure/lib/escape.mjs').then(async (e) => ({ ...e, ...(await B()) }));
  assert.equal(esc(RTL), 'Open desolc daily x');
  assert.equal(esc('‎ ok ‏'), '‎ ok ‏', 'the plain LRM/RLM marks (harmless) are kept');
  const m = fixture();
  m.places['tide-museum'].name = `Tide${RTL}`;
  m.days[0].stops[0].note = RTL;
  const { html } = renderHtml(m);
  assert.doesNotMatch(html, /[‪-‮⁦-⁩​-‍⁠﻿]/u);
});

test('an image "data URI" carrying a quote or an event handler cannot break out of src=""; only clean base64 image URIs are inlined', async () => {
  const { renderHtml } = await B();
  const m = fixture();
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  m.trip.cover_image = { src: 'data:image/png;base64,AAAA" onerror="alert(1)', alt: 'x' };
  m.places['tide-museum'].image = { src: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><a href="javascript:x"/></svg>').toString('base64'), alt: 'svg' };
  m.places['lantern-quay'].image = { src: png, alt: 'ok' };
  m.places['corran-arcade'] && (m.places['corran-arcade'].image = { src: 'data:image/png;base64,QUJD<script>', alt: 'x' });
  const { html, warnings } = renderHtml(m);
  assertInert(html);
  assert.doesNotMatch(html, /onerror|onload/);
  assert.ok(html.includes(`src="${png}"`), 'the clean PNG data URI is inlined untouched');
  assert.match(warnings.join('\n'), /cover image: data URI rejected/);
  assert.match(warnings.join('\n'), /SVG rejected|data URI rejected/);
  for (const [, u] of html.matchAll(/\s(?:src|href)="([^"]*)"/g)) assert.match(u, /^(data:(?:image|font)\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]*|#|https?:\/\/|mailto:)/, u);
});

// Developed by: LightAISolutions
