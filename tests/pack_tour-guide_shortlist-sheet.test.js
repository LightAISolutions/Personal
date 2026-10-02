'use strict';
// Tour Guide pack — the shortlist sheet: the chat's numbers, escaped text, gem badge, notes cap, and (when Chromium is
// present) a real PDF. Invented trip and places only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MAPS = 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=FixturePlace';
const item = (n, name, over = {}) => ({ n, slug: name.toLowerCase().replace(/\W+/g, '-'), name, why_you: 'Quiet in the morning.', fit: 0.8, est_minutes: 75, area: 'Old harbour', maps_url: MAPS, labels: ['verified'], ...over });
const SL = { v: 1, kind: 'shortlist', trip: 'harbor-town', run_id: 'r1', round: 2, more: false, decided: [], groups: [
  { id: 'activities', gems_wanted: 2, gems_shown: 1, items: [item(2, 'Signal <Hill>', { gem: true, gem_line: 'Few reviewers, all glowing.' }), item(1, 'Lantern Museum', { seen_before: { trip: 'harbor-2026', on: '2026-10-04', outcome: 'skipped' } })] },
  { id: 'food', items: [item(3, 'Saffron Row', { maps_url: 'javascript:alert(1)' })] }] };

test('the sheet keeps the chat numbers in order, escapes text, badges gems, drops unsafe links and caps notes', async () => {
  const { shortlistSheetHtml, minutesLabel, MAX_NOTES } = await import('../packs/tour-guide/shortlist-sheet/index.mjs');
  assert.equal(minutesLabel(30), '~30 min');
  assert.equal(minutesLabel(60), '~1 h');
  assert.equal(minutesLabel(75), '~1 h 15');
  const notes = Array.from({ length: 20 }, (_, i) => `note ${i}`);
  const html = shortlistSheetHtml(SL, { title: 'Harbor Town', dates: '12–14 May', stay: 'Harbour Lane', notes, embedFonts: false });
  assert.match(html, /Shortlist · round 2 · 3 places/);
  assert.ok(html.indexOf('Lantern Museum') < html.indexOf('Signal &lt;Hill&gt;'), 'items sorted by n');
  assert.ok(!html.includes('<Hill>'));
  assert.match(html, /hidden gem/);
  assert.match(html, /1 of the 2 hidden gems you asked for/);
  assert.match(html, /You were here on harbor-2026/);
  assert.ok(!html.includes('javascript:'), 'unsafe Maps link is dropped');
  assert.equal((html.match(/<li>note \d+<\/li>/g) || []).length, MAX_NOTES);
  assert.match(html, /staying at Harbour Lane/);
});

test('renderShortlistPdf writes a PDF when Chromium is available, else returns the HTML only', async () => {
  const { renderShortlistPdf, pdfAvailable } = await import('../packs/tour-guide/shortlist-sheet/index.mjs');
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sls-')), 'sheet.pdf');
  const r = await renderShortlistPdf(SL, out, { title: 'Harbor Town', embedFonts: false });
  assert.match(r.html, /<!doctype html>/);
  if (!pdfAvailable()) { assert.equal(r.pdf, null); return; }
  assert.equal(r.pdf, out);
  assert.equal(fs.readFileSync(out).subarray(0, 5).toString(), '%PDF-');
});

// Developed by: LightAISolutions
