/**
 * Brochure kit — "the trip at a glance": the intro in two columns, one column per day with its stops and meals,
 * and a sketch of the whole trip with every day's route in its own hue.
 */
import { esc, join, clip } from '../escape.mjs';
import { shortDate, longDate, duration } from '../format.mjs';
import { routeSketch, sketchLegend } from '../sketch.mjs';
import { icon, MEAL_ICON } from '../icons.mjs';
import { secHead, hueStyle, hueOf, clockPlain, pageRef } from './common.mjs';

function dayColumn(d, i, locale) {
  const rows = d.timeline.filter((t) => t.kind === 'stop' || (t.kind === 'meal' && t.place)).map((t) => {
    const n = t.kind === 'stop' ? t.n : icon(MEAL_ICON[t.meal] || 'fork', 11);
    return `<li${t.kind === 'meal' ? ' class="ismeal"' : ''}><span class="n">${n}</span><span>${esc(t.place.name)}${t.closedToday ? ` <span class="closed">${icon('warn', 10)}</span>` : ''}</span><span class="t">${esc(clockPlain(t.start, locale))}</span></li>`;
  });
  const s = d.stats;
  const foot = join([s.walkMin ? `${duration(s.walkMin)} on foot` : '', s.transitMin ? `${duration(s.transitMin)} in transit` : '', s.driveMin ? `${duration(s.driveMin)} by road` : '', d.lodging ? `night at ${esc(d.lodging.name)}` : ''], ' · ');
  return `<div class="gday" style="${hueStyle(i)}"><div class="gday-head"><span class="gday-n">${d.index}</span><span class="gday-date">${esc(shortDate(d.date, locale))}</span></div><p class="gday-theme">${esc(d.theme)}</p><ul class="gday-stops">${rows.join('')}</ul>${foot ? `<p class="gday-foot">${foot}</p>` : ''}</div>`;
}
function tripSketch(m) {
  const points = [], legs = [];
  const idx = new Map();
  const add = (p, extra) => { const key = p.id || p.name; if (!idx.has(key)) { idx.set(key, points.length); points.push({ lat: p.lat, lng: p.lng, ...extra }); } return idx.get(key); };
  (m.trip.lodging || []).forEach((l) => add(l, { kind: 'lodging', label: l.name, id: 'lodging:' + l.name }));
  let order = 0;
  // the first stop of each day carries the day number; every other place is a small ring in the day's hue
  m.days.forEach((d, i) => {
    let prev = d.lodging ? idx.get('lodging:' + d.lodging.name) : null, first = true;
    d.timeline.forEach((t) => {
      if (!t.place) return;
      const k = add(t.place, { kind: t.kind === 'stop' && first ? 'stop' : 'meal', n: d.index, hue: hueOf(i) });
      if (t.kind === 'stop') first = false;
      if (prev !== null && prev !== undefined && prev !== k) legs.push({ from: prev, to: k, mode: 'other', hue: hueOf(i) });
      prev = k;
    });
  });
  return { svg: routeSketch({ points, legs, w: 420, h: 300, title: `All ${order || m.days.length} days on one sketch`, frame: true }), count: points.length };
}

export function glance(ctx) {
  const { m, locale } = ctx;
  const t = m.trip;
  const paras = String(t.intro || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const cols = Math.min(4, Math.max(1, m.days.length));
  const keys = m.days.map((d, i) => `<p class="keyline" style="${hueStyle(i)}"><span class="swatch"></span><span><b>Day ${d.index}</b> · ${esc(d.theme)}</span></p>`).join('');
  const sk = tripSketch(m);
  const meta = t.verified_on ? `Details checked ${esc(longDate(t.verified_on, locale))}` : '';
  return `<section class="sec sec-glance" data-pg="section" data-folio="At a glance">
${secHead(`<b>${esc(t.destination || t.title)}</b> · ${m.days.length} ${m.days.length === 1 ? 'day' : 'days'}`, 'The trip at a glance', meta)}
${paras.length ? `<div class="intro" data-pg="block">${paras.map((p) => `<p>${esc(clip(p, 1200))}</p>`).join('')}</div>` : ''}
<div class="glance-days" data-pg="block" style="--cols:${cols}">${m.days.map((d, i) => dayColumn(d, i, locale)).join('')}</div>
<div class="glance-map" data-pg="block"><figure class="sketch-fig">${sk.svg}<figcaption class="legend">${sketchLegend(['other'])}<span class="legend-item">numbers mark each day's first stop</span></figcaption></figure><div class="glance-keys"><div><p class="eyebrow">Days</p>${keys}</div>${(t.lodging || []).map((l) => `<div><p class="eyebrow">Staying at</p><p>${icon('bed', 13)} <b>${esc(l.name)}</b>${l.address ? `<br><span class="muted">${esc(l.address)}</span>` : ''}${l.check_in || l.check_out ? `<br><span class="muted">${join([l.check_in ? `check-in ${esc(clockPlain(l.check_in, locale))}` : '', l.check_out ? `check-out ${esc(clockPlain(l.check_out, locale))}` : ''], ' · ')}</span>` : ''}</p></div>`).join('')}<div><p class="eyebrow">Place cards</p><p class="muted">Every stop has a card further in — ${pageRef(m.cards[0] ? m.cards[0].place.id : '', 'the first is here')}.</p></div></div></div>
</section>`;
}

// Developed by: LightAISolutions
