'use strict';
// kits/brochure — real Google maps and place photos: addGoogleImages fills a NEW model (static maps per day and for
// the trip, place photos with their author, route lines), degrades with warnings, and the renderer shows the image
// with the brochure's own markers projected on top, the Google credit uncovered, and the photo author credited.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const KIT = path.resolve(__dirname, '..', 'kits', 'brochure');
const fixture = () => JSON.parse(fs.readFileSync(path.join(KIT, 'fixtures', 'sample-trip.json'), 'utf8'));
const brochure = () => import('../kits/brochure/index.mjs');
const frame = () => import('../kits/brochure/lib/mapframe.mjs');

async function client(opts = {}) {
  const k = await import('../kits/maps/index.mjs');
  const transport = k.createMockTransport();
  const ledger = k.createLedger({});
  return { transport, ledger, maps: k.createMapsClient({ transport, ledger, env: {}, staticKey: opts.noKey ? null : 'TESTKEY' }) };
}
function withPhotos(m) {
  for (const [id, p] of Object.entries(m.places)) if (!p.image) p.google_photo = { name: `places/Fixture${id.replace(/-/g, '')}/photos/Ph${id.replace(/-/g, '')}`, author: 'A. Photographer', author_url: 'https://maps.google.com/maps/contrib/1' };
  return m;
}

test('mercator, fitView and projector agree: every point lands inside the padded box', async () => {
  const f = await frame();
  const pts = [{ lat: 48.853, lng: 2.349 }, { lat: 48.861, lng: 2.336 }, { lat: 48.846, lng: 2.346 }];
  const v = f.fitView(pts, { width: 260, height: 320 });
  assert.ok(Number.isInteger(v.zoom) && v.zoom >= 12 && v.zoom <= 17, String(v.zoom));
  const xy = f.projector(v);
  for (const p of pts) {
    const [x, y] = xy(p);
    assert.ok(x >= f.MAP_PAD.left - 0.5 && x <= 260 - f.MAP_PAD.right + 0.5, `x ${x}`);
    assert.ok(y >= f.MAP_PAD.top - 0.5 && y <= 320 - f.MAP_PAD.bottom + 0.5, `y ${y}`);
  }
  const [cx, cy] = xy(v.center);
  assert.ok(Math.abs(cx - 130) < 1e-6 && Math.abs(cy - 160) < 1e-6, 'centre projects to the image centre');
  // one zoom level more would not fit
  const tight = f.fitView(pts, { width: 260, height: 320, minZoom: v.zoom + 1, maxZoom: v.zoom + 1 });
  const xy2 = f.projector(tight);
  assert.ok(pts.some((p) => { const [x, y] = xy2(p); return x < f.MAP_PAD.left - 0.5 || x > 260 - f.MAP_PAD.right + 0.5 || y < f.MAP_PAD.top - 0.5 || y > 320 - f.MAP_PAD.bottom + 0.5; }));
  assert.equal(f.fitView([], { width: 10, height: 10 }), null);
});

test('daySequence starts at the lodging and pairs every hop with the leg that covers it', async () => {
  const { prepare } = await brochure();
  const f = await frame();
  const d = prepare(fixture()).days[0];
  const { points, pairs } = f.daySequence(d);
  assert.equal(points[0].kind, 'lodging');
  assert.ok(points.some((p) => p.kind === 'stop' && p.n === 1));
  for (const q of pairs) { assert.ok(points[q.from] && points[q.to]); assert.notEqual(q.from, q.to); }
});

test('addGoogleImages fills maps, photos and routes into a copy; the input is untouched', async () => {
  const { addGoogleImages, DAY_MAP, TRIP_MAP } = await brochure();
  const { transport, maps } = await client();
  const input = withPhotos(fixture());
  const before = JSON.stringify(input);
  const r = await addGoogleImages(input, { client: maps });
  assert.equal(JSON.stringify(input), before);
  assert.equal(r.stats.maps, input.days.length + 1);
  assert.ok(r.stats.photos >= 1);
  for (const d of r.model.days) {
    assert.match(d.map_image.src, /^data:image\/png;base64,/);
    assert.equal(d.map_image.view.width, DAY_MAP.width);
    assert.equal(d.map_image.credit, 'Map data © Google');
  }
  assert.equal(r.model.trip.map_image.view.height, TRIP_MAP.height);
  const ph = Object.values(r.model.places).find((p) => p.google_photo && p.google_photo.src);
  assert.match(ph.google_photo.src, /^data:image\/png;base64,/);
  assert.equal(ph.google_photo.author, 'A. Photographer');
  // every static map request was centred and zoomed exactly as the overlay assumes, with POIs hidden
  const statics = transport.calls.filter((c) => c.url.includes('/maps/api/staticmap'));
  assert.equal(statics.length, r.stats.maps);
  const u = new URL(statics[0].url);
  assert.equal(u.searchParams.get('zoom'), String(r.model.days[0].map_image.view.zoom));
  for (const st of ['feature:poi.business|visibility:off', 'feature:poi|element:labels.icon|visibility:off', 'feature:road|element:labels.icon|visibility:off']) assert.ok(u.searchParams.getAll('style').includes(st), st);
  // the brochure model still validates
  const { validate } = await brochure();
  assert.deepEqual(validate(r.model), []);
});

test('failures degrade with warnings, never throw: no key, broken photo, maps off', async () => {
  const { addGoogleImages } = await brochure();
  const { maps } = await client({ noKey: true });
  const r = await addGoogleImages(withPhotos(fixture()), { client: maps, routes: false });
  assert.equal(r.stats.maps, 0);
  assert.ok(r.warnings.some((w) => /map/.test(w)));
  assert.ok(r.stats.photos >= 1, 'photos use the Places key, not the static key');
  const m = withPhotos(fixture());
  const first = Object.keys(m.places).find((id) => m.places[id].google_photo);
  const real = (await client()).maps;
  const flaky = { ...real, placePhoto: (name, o) => (name === m.places[first].google_photo.name ? Promise.reject(new Error('HTTP 500')) : real.placePhoto(name, o)) };
  const r2 = await addGoogleImages(m, { client: flaky, maps: false, routes: false });
  assert.ok(!r2.model.places[first].google_photo.src);
  assert.ok(r2.warnings.some((w) => w.includes(first)));
  assert.ok(!r2.model.days[0].map_image);
  await assert.rejects(addGoogleImages(fixture(), {}), /needs a maps client/);
});

test('render: a Google map replaces the sketch, markers overlay it, the credit and photo author are shown', async () => {
  const { addGoogleImages, renderHtml } = await brochure();
  const { maps } = await client();
  const { model } = await addGoogleImages(withPhotos(fixture()), { client: maps });
  const { html, warnings } = renderHtml(model);
  assert.deepEqual(warnings, []);
  const days = (html.match(/class="sec sec-day/g) || []).length;
  assert.equal((html.match(/class="gmap"/g) || []).length, days + 1, 'one Google map per day plus the trip map');
  assert.equal((html.match(/class="gmap-marks"/g) || []).length, days + 1);
  assert.match(html, /Map data © Google/);
  assert.match(html, /Photo by <a[^>]*>A\. Photographer<\/a> · Google Maps/);
  assert.match(html, /class="card-img gphoto"/);
  assert.match(html, /Maps Static API/);
  assert.doesNotMatch(html, /TESTKEY/);
  for (const [, u] of html.matchAll(/\s(?:src|href)="([^"]*)"/g)) assert.match(u, /^(data:|#|https?:\/\/|mailto:)/, u);
});

test('a real-length Google photo name validates in the brochure schema', async () => {
  const { validate } = await brochure();
  const m = fixture();
  const id = Object.keys(m.places).find((k) => !m.places[k].image);
  m.places[id].google_photo = { name: 'places/ChIJ' + 'b'.repeat(16) + '/photos/' + 'AUc7tXy-_'.repeat(55), author: 'A. Photographer' };
  assert.deepEqual(validate(m), []);
});

test('render without Google images keeps the drawn sketch and no Google map credit', async () => {
  const { renderHtml } = await brochure();
  const { html } = renderHtml(fixture());
  assert.doesNotMatch(html, /class="gmap"/);
  assert.doesNotMatch(html, /Maps Static API/);
});

test('a remote map image is refused (nothing is fetched at render time)', async () => {
  const { renderHtml } = await brochure();
  const m = fixture();
  m.days[0].map_image = { src: 'https://maps.googleapis.com/maps/api/staticmap?size=1x1', view: { center: { lat: 0, lng: 0 }, zoom: 3, width: 260, height: 320 } };
  const { html, warnings } = renderHtml(m);
  assert.ok(warnings.length >= 1);
  assert.doesNotMatch(html, /src="https:\/\/maps\.googleapis/);
});

// Developed by: LightAISolutions
