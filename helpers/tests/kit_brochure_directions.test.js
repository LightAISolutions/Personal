'use strict';
// kits/brochure — a Google Maps directions link per leg (Maps URLs, no key): built from both ends' coordinates and
// place ids, the lodging resolved for 'lodging' ends, transit mode for taxi legs (train alternative), an explicit
// maps_url kept as is, and no link when an end has no coordinates.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const KIT = path.resolve(__dirname, '..', 'kits', 'brochure');
const fixture = () => JSON.parse(fs.readFileSync(path.join(KIT, 'fixtures', 'sample-trip.json'), 'utf8'));
const brochure = () => import('../kits/brochure/index.mjs');

test('directionsUrl builds a keyless Maps URL with coordinates, place ids and the travel mode', async () => {
  const { directionsUrl, DIRECTIONS_BASE } = await brochure();
  const u = new URL(directionsUrl({ lat: 35.71479, lng: 139.796655, place_id: 'PidA' }, { lat: 35.6812, lng: 139.7671 }, 'taxi'));
  assert.equal(u.origin + u.pathname, DIRECTIONS_BASE);
  assert.equal(u.searchParams.get('api'), '1');
  assert.equal(u.searchParams.get('origin'), '35.71479,139.796655');
  assert.equal(u.searchParams.get('origin_place_id'), 'PidA');
  assert.equal(u.searchParams.get('destination'), '35.6812,139.7671');
  assert.ok(!u.searchParams.has('destination_place_id'));
  assert.equal(u.searchParams.get('travelmode'), 'transit', 'a taxi leg links to the train options');
  assert.ok(!u.searchParams.has('key'));
  assert.equal(new URL(directionsUrl({ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, 'walk')).searchParams.get('travelmode'), 'walking');
  assert.equal(directionsUrl({ lat: 1, lng: 2 }, { name: 'no coords' }, 'walk'), '');
});

const noMapsUrls = (m) => { for (const d of m.days) for (const l of d.legs || []) delete l.maps_url; return m; };

test('every leg gets a link from its two ends (the lodging for "lodging"); an explicit maps_url wins', async () => {
  const { prepare, renderHtml } = await brochure();
  const m = noMapsUrls(fixture());
  const p = prepare(m);
  const legs = p.days.flatMap((d) => d.legs);
  assert.ok(legs.length > 0);
  for (const l of legs) assert.match(l.directions_url, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&/);
  const home = new URL(p.days[0].legs[0].directions_url);
  assert.equal(home.searchParams.get('origin'), `${m.trip.lodging[0].lat},${m.trip.lodging[0].lng}`);
  assert.equal(home.searchParams.get('destination_place_id'), m.places[p.days[0].legs[0].to].place_id);
  const { html } = renderHtml(m);
  const rows = html.split('class="ti ti-leg"').slice(1);
  assert.equal(rows.length, legs.length);
  for (const r of rows) assert.match(r.slice(0, r.indexOf('class="ti ')), /href="https:\/\/www\.google\.com\/maps\/dir\//);
  const own = fixture();
  assert.equal(prepare(own).days[0].legs[0].directions_url, own.days[0].legs[0].maps_url);
  delete own.places[own.days[0].legs[0].to].lat;
  assert.equal(prepare(noMapsUrls(own)).days[0].legs[0].directions_url, '', 'no coordinates, no link');
});

test('a taxi leg renders "by train" linking to transit directions; a walk leg links walking', async () => {
  const { renderHtml } = await brochure();
  const m = noMapsUrls(fixture());
  m.days[0].legs[1].mode = 'taxi';
  const { html } = renderHtml(m);
  assert.match(html, /href="https:\/\/www\.google\.com\/maps\/dir\/\?api=1&amp;[^"]*travelmode=transit[^"]*">by train ↗<\/a>/);
  assert.match(html, /travelmode=walking[^"]*">Google Maps ↗<\/a>/);
});

// Developed by: LightAISolutions
