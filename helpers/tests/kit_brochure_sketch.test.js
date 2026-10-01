'use strict';
// kits/brochure — the route sketch is generated SVG from coordinates: schematic, escaped, never a map tile.
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('project() fits points into the box and keeps a usable metres-per-unit', async () => {
  const { project, niceScale } = await import('../kits/brochure/lib/sketch.mjs');
  const pts = [{ lat: 51.5, lng: -0.1 }, { lat: 51.51, lng: -0.09 }, { lat: 51.49, lng: -0.12 }];
  const P = project(pts, 300, 200, 20);
  assert.ok(P.ok);
  for (const p of pts) { const [x, y] = P.xy(p); assert.ok(x >= 20 && x <= 280 && y >= 20 && y <= 180, `${x},${y}`); }
  assert.ok(P.metersPerUnit > 1 && P.metersPerUnit < 100);
  const sc = niceScale(P.metersPerUnit, 66);
  assert.ok([50, 100, 200, 250, 500, 1000, 2000].includes(sc.meters));
  assert.match(sc.label, /^\d+ m$|^\d+(\.\d+)? km$/);
  assert.equal(project([{ lat: NaN, lng: 1 }], 100, 100, 10).ok, false);
  assert.equal(niceScale(0, 50), null);
});

test('routeSketch draws numbered stops, lodging, meals and dashed legs; empty days say so; labels are escaped', async () => {
  const { routeSketch, sketchLegend, DASH } = await import('../kits/brochure/lib/sketch.mjs');
  const svg = routeSketch({
    points: [{ lat: 51.5, lng: -0.1, kind: 'lodging', label: 'inn <b>' }, { lat: 51.51, lng: -0.09, kind: 'stop', n: 1 }, { lat: 51.505, lng: -0.11, kind: 'meal' }],
    legs: [{ from: 0, to: 1, mode: 'walk' }, { from: 1, to: 2, mode: 'ferry' }, { from: 2, to: 9, mode: 'walk' }],
    title: 'Day 1 "route"'
  });
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
  assert.doesNotMatch(svg, /<script|<image|href=/i);
  assert.equal((svg.match(/<path d="M[\d. ]+Q/g) || []).length, 2, 'two legs drawn, the one to a missing point skipped');
  assert.match(svg, new RegExp(`stroke-dasharray="${DASH.walk}"`));
  assert.match(svg, new RegExp(`stroke-dasharray="${DASH.ferry}"`));
  assert.match(svg, />1<\/text>/);
  assert.match(svg, /inn &lt;b&gt;/);
  assert.match(svg, /aria-label="Day 1 &quot;route&quot;"/);
  assert.match(svg, />N<\/text>/);
  assert.match(routeSketch({ points: [], legs: [] }), /no coordinates for this day/);
  const legend = sketchLegend(['walk', 'walk', 'ferry', 'nope']);
  assert.equal((legend.match(/legend-item/g) || []).length, 2);
  assert.match(legend, /on foot.*ferry/);
});

// Developed by: LightAISolutions
