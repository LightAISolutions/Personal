'use strict';
// kits/brochure — the renderer emits one self-contained document: no <script>, every string escaped, fonts and
// the Google Maps logo inlined, remote images refused (nothing is fetched at render or view time).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const KIT = path.resolve(__dirname, '..', 'kits', 'brochure');
const fixture = () => JSON.parse(fs.readFileSync(path.join(KIT, 'fixtures', 'sample-trip.json'), 'utf8'));

test('fixture renders self-contained: sections, folios, fonts, logo, attribution, no script, no external URL loads', async () => {
  const { renderHtml } = await import('../kits/brochure/index.mjs');
  const { html, warnings, model } = renderHtml(fixture());
  assert.deepEqual(warnings, []);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /\bon[a-z]+\s*=/i);
  for (const cls of ['sec-cover', 'sec-glance', 'sec-day', 'sec-cards', 'sec-later', 'sec-practical', 'sec-attr']) assert.ok(html.includes(`class="sec ${cls}`), cls);
  assert.equal((html.match(/class="sec sec-day/g) || []).length, model.days.length);
  assert.equal((html.match(/@font-face\{font-family:"Charter"/g) || []).length, 4);
  assert.match(html, /src:url\(data:font\/woff2;base64,/);
  assert.match(html, /Google Maps/);
  assert.match(html, /<meta name="brochure-page" content="letter">/);
  // every src/href is a data URI, an in-document anchor, or an http(s)/mailto link — never a file or relative fetch
  for (const [, u] of html.matchAll(/\s(?:src|href)="([^"]*)"/g)) assert.match(u, /^(data:|#|https?:\/\/|mailto:)/, u);
  assert.match(renderHtml(fixture(), { page: 'a4' }).html, /content="a4"/);
  assert.doesNotMatch(renderHtml(fixture(), { embedFonts: false }).html, /@font-face/);
});

test('hostile strings are escaped everywhere; javascript: and data: links are dropped; remote images are skipped with a warning', async () => {
  const { renderHtml } = await import('../kits/brochure/index.mjs');
  const m = fixture();
  const evil = '<script>alert(1)</script>"><img src=x onerror=alert(2)>';
  m.trip.title = `Trip ${evil}`;
  m.trip.subtitle = evil; m.trip.intro = evil;
  m.days[0].theme = evil; m.days[0].stops[0].note = evil; m.days[0].warnings[0].text = evil;
  m.places['tide-museum'].name = evil; m.places['tide-museum'].editorial = evil; m.places['tide-museum'].reviews[0].text = evil;
  m.places['tide-museum'].website = 'javascript:alert(3)'; m.places['tide-museum'].maps_url = 'data:text/html,<b>x</b>';
  m.places['lantern-quay'].sources[0].url = 'vbscript:evil';
  m.trip.cover_image = { src: 'https://cdn.example.com/photo.jpg' };
  m.places['tide-museum'].image = { src: 'missing-file.png' };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brochure-img-'));
  fs.writeFileSync(path.join(dir, 'quay.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]));
  m.places['lantern-quay'].image = { src: 'quay.png', alt: 'the <quay>' };
  const { html, warnings } = renderHtml(m, { baseDir: dir });
  assert.match(html, /<img class="card-img" src="data:image\/png;base64,iVBORw0KGgo[^"]*" alt="the &lt;quay&gt;">/);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /javascript:|vbscript:|data:text\/html/);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.match(warnings.join('\n'), /cover image: remote image skipped/);
  assert.match(warnings.join('\n'), /missing-file\.png/);
});

// Developed by: LightAISolutions
