/**
 * Brochure kit — "the trip at a glance": the intro in two columns, one column per day with its stops and meals,
 * and a map of the whole trip with every day's route in its own hue (a real Google map when the build fetched one,
 * otherwise a drawn sketch). C18 wave 2: a day's `contents` line names its column and key line instead of its theme.
 */
import { esc, join, clip } from '../escape.mjs';
import { shortDate, longDate, duration } from '../format.mjs';
import { routeSketch, sketchLegend } from '../sketch.mjs';
import { tripSequence, mapFigure, mapCredit } from '../mapframe.mjs';
import { icon, MEAL_ICON } from '../icons.mjs';
import { secHead, hueStyle, hueOf, clockPlain, pageRef } from './common.mjs';
import { estMark } from './day.mjs';

function dayColumn(d, i, locale) {
  const rows = d.timeline.filter((t) => t.kind === 'stop' || (t.kind === 'meal' && t.place)).map((t) => {
    const n = t.kind === 'stop' ? t.n : icon(MEAL_ICON[t.meal] || 'fork', 11);
    const cls = t.kind === 'meal' ? 'ismeal' : t.visited === true ? 'isdone' : '';
    return `<li${cls ? ` class="${cls}"` : ''}><span class="n">${n}</span><span>${esc(t.place.name)}${t.closedToday ? ` <span class="closed">${icon('warn', 10)}</span>` : ''}${cls === 'isdone' ? ' <span class="done-tick">✓ visited</span>' : ''}</span><span class="t">${esc(clockPlain(t.start, locale))}</span></li>`;
  });
  const s = d.stats;
  const foot = join([s.walkMin ? estMark(`${duration(s.walkMin)} on foot`, s.walkEstimated) : '', s.transitMin ? estMark(`${duration(s.transitMin)} in transit`, s.transitEstimated) : '', s.driveMin ? `${duration(s.driveMin)} by road` : '', d.lodging ? `night at ${esc(d.lodging.name)}` : ''], ' · ');
  return `<div class="gday" style="${hueStyle(i)}"><div class="gday-head"><span class="gday-n">${d.index}</span><span class="gday-date">${esc(shortDate(d.date, locale))}</span></div><p class="gday-theme">${esc(d.contents || d.theme)}</p><ul class="gday-stops">${rows.join('')}</ul>${foot ? `<p class="gday-foot">${foot}</p>` : ''}</div>`;
}
function tripSketch(m) {
  const { points, pairs } = tripSequence(m, hueOf);
  return { svg: routeSketch({ points, legs: pairs, w: 420, h: 300, title: `All ${m.days.length} days on one sketch`, frame: true }), count: points.length, points };
}
function tripMap(ctx, sk) {
  const { m } = ctx;
  const src = m.trip.map_image ? ctx.img.resolve(m.trip.map_image, 'Trip map') : '';
  const days = m.days.map((d, i) => `<span class="legend-item"><svg viewBox="0 0 22 8" width="22" height="8" aria-hidden="true"><path d="M1 4H21" stroke="${hueOf(i)}" stroke-width="2.6" stroke-linecap="round"/></svg>Day ${d.index}</span>`).join('');
  if (src) return mapFigure({ src, image: m.trip.map_image, points: sk.points, title: `All ${m.days.length} days on one map`, caption: `${days}<span class="legend-item">numbers mark each day's first stop · ${mapCredit(m.trip.map_image)}</span>` });
  return `<figure class="sketch-fig">${sk.svg}<figcaption class="legend">${sketchLegend(['other'])}<span class="legend-item">numbers mark each day's first stop</span></figcaption></figure>`;
}

export function glance(ctx) {
  const { m, locale } = ctx;
  const t = m.trip;
  const paras = String(t.intro || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const cols = Math.min(4, Math.max(1, m.days.length));
  const keys = m.days.map((d, i) => `<p class="keyline" style="${hueStyle(i)}"><span class="swatch"></span><span><b>Day ${d.index}</b> · ${esc(d.contents || d.theme)}</span></p>`).join('');
  const sk = tripSketch(m);
  const meta = t.verified_on ? `Details checked ${esc(longDate(t.verified_on, locale))}` : '';
  return `<section class="sec sec-glance" data-pg="section" data-folio="At a glance">
${secHead(`<b>${esc(t.destination || t.title)}</b> · ${m.days.length} ${m.days.length === 1 ? 'day' : 'days'}`, 'The trip at a glance', meta)}
${paras.length ? `<div class="intro" data-pg="block">${paras.map((p) => `<p>${esc(clip(p, 1200))}</p>`).join('')}</div>` : ''}
<div class="glance-days" data-pg="block" style="--cols:${cols}">${m.days.map((d, i) => dayColumn(d, i, locale)).join('')}</div>
<div class="glance-map" data-pg="block">${tripMap(ctx, sk)}<div class="glance-keys"><div><p class="eyebrow">Days</p>${keys}</div>${(t.lodging || []).map((l) => `<div><p class="eyebrow">Staying at</p><p>${icon('bed', 13)} <b>${esc(l.name)}</b>${l.address ? `<br><span class="muted">${esc(l.address)}</span>` : ''}${l.check_in || l.check_out ? `<br><span class="muted">${join([l.check_in ? `check-in ${esc(clockPlain(l.check_in, locale))}` : '', l.check_out ? `check-out ${esc(clockPlain(l.check_out, locale))}` : ''], ' · ')}</span>` : ''}</p></div>`).join('')}<div><p class="eyebrow">Place cards</p><p class="muted">Every stop has a card further in — ${pageRef(m.cards[0] ? m.cards[0].place.id : '', 'the first is here')}.</p></div></div></div>
</section>`;
}

// Developed by: LightAISolutions
