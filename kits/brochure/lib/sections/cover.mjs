/**
 * Brochure kit — the cover. Cream paper, generative contour art seeded by the trip title, a constellation of the
 * trip's stops drawn in the day hues, the title set large in Charter, and a strip of facts along the bottom.
 */
import { esc, attr, join } from '../escape.mjs';
import { dateRange, longDate } from '../format.mjs';
import { contours, compass, rng } from '../art.mjs';
import { project, curve } from '../sketch.mjs';
import { hueOf } from './common.mjs';
import { COLORS } from '../tokens.mjs';

function constellation(m, w, h) {
  const pts = [];
  m.days.forEach((d, i) => d.timeline.forEach((t) => { const p = t.place; if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) pts.push({ lat: p.lat, lng: p.lng, day: i, id: p.id }); }));
  if (pts.length < 2) return '';
  // fit into the upper-right quarter so the title never collides with it
  const box = { x: w * 0.5, y: h * 0.1, w: w * 0.4, h: h * 0.38 };
  const P = project(pts, box.w, box.h, 18);
  let out = '';
  const seen = new Set();
  m.days.forEach((d, i) => {
    const dp = pts.filter((p) => p.day === i);
    for (let k = 1; k < dp.length; k++) {
      const [x1, y1] = P.xy(dp[k - 1]), [x2, y2] = P.xy(dp[k]);
      if (Math.hypot(x2 - x1, y2 - y1) < 1) continue;
      out += `<path d="${curve([x1 + box.x, y1 + box.y], [x2 + box.x, y2 + box.y], k % 2 ? 0.14 : -0.14)}" fill="none" stroke="${hueOf(i)}" stroke-width="1.1" stroke-dasharray="3 4" stroke-opacity=".75"/>`;
    }
  });
  for (const p of pts) {
    const [x, y] = P.xy(p); const key = x.toFixed(0) + ',' + y.toFixed(0);
    if (seen.has(key)) continue; seen.add(key);
    out += `<circle cx="${(x + box.x).toFixed(1)}" cy="${(y + box.y).toFixed(1)}" r="4" fill="#fff" stroke="${hueOf(p.day)}" stroke-width="1.6"/>`;
  }
  return out;
}
/** Full-bleed art: contours bottom-right, constellation top-right, a few seeded dots. */
export function coverArt(m, w = 850, h = 1100) {
  const r = rng(m.trip.title + '|dots');
  let dots = '';
  for (let i = 0; i < 26; i++) dots += `<circle cx="${(r() * w).toFixed(0)}" cy="${(r() * h).toFixed(0)}" r="${(0.8 + r() * 1.4).toFixed(1)}" fill="${COLORS.accent}" fill-opacity="${(0.15 + r() * 0.3).toFixed(2)}"/>`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${contours({ seed: m.trip.title, w, h, rings: 13, cx: w * 0.76, cy: h * 0.68, stroke: COLORS.accent, opacity: 0.36, strokeWidth: 0.9 })}${dots}${constellation(m, w, h)}</svg>`;
}

/** The section. `data-pg="sheet"` + `data-bleed`: the paginator gives it a whole sheet with no margins. */
export function cover(ctx) {
  const { m, locale } = ctx;
  const t = m.trip;
  const lodging = (t.lodging || [])[0];
  const facts = [
    ['Dates', dateRange(t.start_date, t.end_date, locale)],
    ['Base', lodging ? lodging.name : ''],
    ['Pace', t.pace ? t.pace[0].toUpperCase() + t.pace.slice(1) : ''],
    ['Travelling', (t.travelers || []).join(' & ')]
  ].filter(([, v]) => v);
  const nDays = m.days.length;
  const img = t.cover_image ? ctx.img.resolve(t.cover_image, 'cover image') : '';
  return `<section class="sec sec-cover" data-pg="sheet" data-bleed data-folio="">
<div class="cover-art">${img ? `<img src="${img}" alt="${attr(t.cover_image.alt || '')}" style="width:100%;height:100%;object-fit:cover;opacity:.9">` : coverArt(m)}</div>
<div class="cover-days"><b>${nDays}</b>${nDays === 1 ? 'day' : 'days'}<br>${esc(dateRange(t.start_date, t.end_date, locale))}</div>
<div class="cover-text">
<p class="eyebrow">${t.destination ? `<b>${esc(t.destination)}</b>${t.country ? ` · ${esc(t.country)}` : ''}` : 'A trip'}${t.prepared_for ? ` · prepared for ${esc(t.prepared_for)}` : ''}</p>
<h1 class="cover-title">${esc(t.title)}</h1>
${t.subtitle ? `<p class="cover-sub">${esc(t.subtitle)}</p>` : ''}
<dl class="cover-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
</div>
<div class="cover-foot"><span>${join([t.built_on ? `Prepared ${esc(longDate(t.built_on, locale))}` : '', t.build_id ? `build ${esc(t.build_id)}` : ''], ' · ')}</span><span class="compass">${compass(40, COLORS.ink)}</span></div>
</section>`;
}

// Developed by: LightAISolutions
